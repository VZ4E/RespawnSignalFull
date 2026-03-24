const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { supabase } = require('../supabase');
const { authMiddleware, PLAN_DEFAULTS } = require('../middleware/auth');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_PRICE_MAP = {
  starter: process.env.STRIPE_STARTER_PRICE || 'price_1TEP9mBVOMJTwlq1LnkpaaXH',
  pro: process.env.STRIPE_PRO_PRICE || 'price_1TEP9nBVOMJTwlq1AsNSiqCd',
  agency: process.env.STRIPE_AGENCY_PRICE || 'price_1TEP9nBVOMJTwlq1Ta0wBwjd',
  topup_500: process.env.STRIPE_TOPUP_500 || 'price_1TEP9oBVOMJTwlq1UIoVwhTv',
  topup_1500: process.env.STRIPE_TOPUP_1500 || 'price_1TEP9oBVOMJTwlq11ED5EViJ',
  topup_3000: process.env.STRIPE_TOPUP_3000 || 'price_1TEP9oBVOMJTwlq1wgfx5Fov',
};

// POST /api/billing/create-checkout
router.post('/create-checkout', authMiddleware, async (req, res) => {
  const { plan } = req.body;
  const priceId = PLAN_PRICE_MAP[plan];
  if (!priceId || priceId === 'placeholder') {
    return res.status(400).json({ error: 'Invalid plan or Stripe not configured' });
  }

  try {
    // Get or create Stripe customer
    let customerId = req.dbUser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: req.dbUser.email });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', req.dbUser.id);
    }

    // Determine if this is a subscription (plan) or one-time payment (top-up)
    const isTopup = plan.startsWith('topup_');
    const mode = isTopup ? 'payment' : 'subscription';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?billing=success`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/?billing=cancelled`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/portal
router.post('/portal', authMiddleware, async (req, res) => {
  const customerId = req.dbUser.stripe_customer_id;
  if (!customerId) {
    return res.status(400).json({ error: 'No billing account found. Subscribe to a plan first.' });
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL || 'http://localhost:3000'}/`,
    });
    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Updated credit amounts for new pricing tiers
  const PLAN_CREDIT_MAP = {
    starter: 1000,
    pro: 2500,
    agency: 5000,
    topup_500: 500,
    topup_1500: 1500,
    topup_3000: 3000,
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Get line items to determine plan/topup
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        const itemType = Object.entries(PLAN_PRICE_MAP).find(([,v]) => v === priceId)?.[0];
        if (!itemType) break;
        
        // Handle subscription plans
        if (session.mode === 'subscription') {
          await supabase.from('users')
            .update({
              plan: itemType,
              stripe_subscription_id: session.subscription,
              credits_remaining: PLAN_CREDIT_MAP[itemType],
              credits_reset_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', session.customer);
          console.log(`Subscription updated to ${itemType} for customer ${session.customer}`);
        }
        
        // Handle one-time top-up purchases
        if (session.mode === 'payment' && itemType.startsWith('topup_')) {
          const creditsToAdd = PLAN_CREDIT_MAP[itemType];
          // Get current user
          const { data: user } = await supabase
            .from('users')
            .select('credits_remaining')
            .eq('stripe_customer_id', session.customer)
            .single();
          
          if (user) {
            await supabase.from('users')
              .update({
                credits_remaining: (user.credits_remaining || 0) + creditsToAdd,
              })
              .eq('stripe_customer_id', session.customer);
            console.log(`Top-up of ${creditsToAdd} credits added for customer ${session.customer}`);
          }
        }
        break;
      }

      case 'invoice.paid': {
        // Monthly renewal — reset credits
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_cycle') {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          const priceId = sub.items.data[0]?.price?.id;
          const plan = Object.entries(PLAN_PRICE_MAP).find(([,v]) => v === priceId)?.[0];
          if (!plan) break;
          await supabase.from('users')
            .update({
              credits_remaining: PLAN_CREDIT_MAP[plan] || 300,
              credits_reset_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', invoice.customer);
          console.log(`Credits reset for customer ${invoice.customer} on renewal`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Downgrade to none on cancellation — hits paywall
        const sub = event.data.object;
        await supabase.from('users')
          .update({ plan: 'none', stripe_subscription_id: null, credits_remaining: 0 })
          .eq('stripe_customer_id', sub.customer);
        console.log(`Subscription cancelled for customer ${sub.customer}`);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  res.json({ received: true });
});

// POST /api/billing/contact-enterprise
router.post('/contact-enterprise', async (req, res) => {
  const { name, email, company, message } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  const { error } = await supabase.from('enterprise_inquiries').insert({ name, email, company: company || null, message: message || null });
  if (error) return res.status(500).json({ error: 'Failed to save inquiry' });
  return res.json({ success: true });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  return res.json({ 
    user: data.user, 
    session: data.session,
    accessToken: data.session?.access_token,
    refreshToken: data.session?.refresh_token,
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  return res.json({ 
    user: data.user, 
    session: data.session,
    accessToken: data.session?.access_token,
    refreshToken: data.session?.refresh_token,
  });
});

// POST /api/auth/exchange-code — PKCE code exchange
router.post('/exchange-code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({
      access_token: data.session?.access_token,
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      user: data.user,
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/google-url
router.get('/google-url', async (req, res) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/callback.html`,
    },
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ url: data.url });
});

// GET /auth/callback — Google OAuth redirect lands here
router.get('/callback', async (req, res) => {
  // Supabase handles token exchange client-side via fragment — just serve the app
  res.redirect('/?oauth=1');
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  await supabase.auth.signOut();
  return res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  // Always fetch fresh from DB instead of using cached req.dbUser
  const { data: freshUser, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', req.user.email)
    .single();
  
  if (error) {
    console.error('[/api/auth/me] Fresh fetch error:', error.message);
    // Fall back to middleware-loaded user
    const { email, plan, credits_remaining, created_at } = req.dbUser;
    return res.json({ email, plan, credits_remaining, created_at });
  }
  
  if (freshUser) {
    const { email, plan, credits_remaining, created_at } = freshUser;
    return res.json({ email, plan, credits_remaining, created_at });
  }
  
  return res.status(500).json({ error: 'User not found' });
});

// POST /api/auth/refresh — refresh access token using refresh token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error) return res.status(401).json({ error: 'Refresh failed: ' + error.message });

    return res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Refresh error: ' + err.message });
  }
});

// POST /api/auth/admin/set-plan — Admin endpoint to set plan by stripe_customer_id
// ⚠️ SECURITY: Remove this endpoint in production or add proper authentication
router.post('/admin/set-plan', async (req, res) => {
  const { stripe_customer_id, plan } = req.body;
  if (!stripe_customer_id || !plan) {
    return res.status(400).json({ error: 'stripe_customer_id and plan required' });
  }

  const validPlans = ['none', 'starter', 'pro', 'agency', 'enterprise'];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: `Invalid plan. Must be one of: ${validPlans.join(', ')}` });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        plan,
        credits_remaining: plan === 'agency' ? 5000 : plan === 'pro' ? 2500 : plan === 'starter' ? 1000 : 0,
        credits_reset_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', stripe_customer_id)
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No user found with that stripe_customer_id' });
    }

    console.log(`[Admin] Updated ${data[0].email} to plan=${plan}`);
    return res.json({ success: true, user: data[0] });
  } catch (err) {
    console.error('[Admin] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

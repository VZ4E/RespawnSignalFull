# Credits & Billing System

## How Credits Work

### Plan-Based Credits (Monthly Allocation)
Each subscription plan includes monthly credits that reset on the billing cycle:

- **Starter**: 1,000 credits/month ($299/mo)
- **Pro**: 2,500 credits/month ($599/mo)
- **Agency**: 5,000 credits/month ($999/mo)
- **Enterprise**: 9,999 credits/month (custom)

### Top-Up Credits (One-Time Purchase)
Users can buy additional credits anytime:

- **500 credits**: $119 ($0.24 per credit)
- **1,500 credits**: $299 ($0.20 per credit)
- **3,000 credits**: $499 ($0.17 per credit)

Top-up credits **do NOT reset** — they're permanent additions to the account.

---

## Credit Reset Cycle

### Current Implementation
Credits reset monthly **when Stripe notifies the app via webhook**:

**Event:** `invoice.paid` (when subscription renews)
**Trigger:** Stripe sends webhook → `/api/billing/webhook`
**Action:** `credits_remaining` is set back to the plan's monthly amount

**When does this happen?**
- At the **renewal date** of the subscription (monthly)
- When the customer's invoice is marked as "paid" by Stripe
- Typically within minutes of the billing cycle

### Important Notes

⚠️ **Webhook Dependency**: Credit resets depend on Stripe webhooks. If webhooks fail:
- Webhook might need to be re-triggered manually
- See [Troubleshooting](#troubleshooting) below

⚠️ **Used Credits**: When you run a scan:
- Credits are deducted from `credits_remaining`
- These are **not** refunded at reset — only the plan's base amount is restored
- Example: Agency plan has 5,000/month. If you use 4,000, reset gives you 5,000 (not 9,000)

### Database Fields

| Field | Meaning | Example |
|-------|---------|---------|
| `plan` | Current subscription plan | `'agency'` |
| `credits_remaining` | Credits available right now | `956` |
| `credits_reset_at` | When credits were last reset | `2026-03-24T18:33:00Z` |
| `stripe_subscription_id` | Stripe subscription ID | `sub_1TEP...` |
| `stripe_customer_id` | Stripe customer ID | `cus_U9UYZWoqx6NF8y` |

---

## Troubleshooting

### "I didn't get my monthly credits"

**Cause**: Stripe webhook didn't fire or failed

**Solution 1: Check Stripe Dashboard**
1. Log into Stripe dashboard
2. Navigate to **Developers** → **Webhooks**
3. Check if the webhook attempted to trigger (look for recent attempts)
4. If you see failed attempts, click "Resend" on the latest one

**Solution 2: Manual Reset (Admin)**
Use the reset endpoint:

```bash
POST /api/billing/reset-credits
Content-Type: application/json

{
  "stripe_customer_id": "cus_U9UYZWoqx6NF8y",
  "plan": "agency"
}
```

Or via Supabase SQL:

```sql
UPDATE users
SET 
  credits_remaining = 5000,
  credits_reset_at = NOW()
WHERE stripe_customer_id = 'cus_U9UYZWoqx6NF8y';
```

---

### "Top-ups aren't working"

**Cause**: Top-up webhook didn't fire

**Verification Steps**:
1. Check your Stripe dashboard under **Payments** → look for the charge
2. If charge succeeded but credits didn't add, the webhook failed
3. Manually add credits via Supabase:

```sql
UPDATE users
SET credits_remaining = credits_remaining + 1500
WHERE stripe_customer_id = 'cus_U9UYZWoqx6NF8y';
```

---

### "Credits show as wrong amount"

**Check these**:

1. **Is the webhook configured?**
   - Supabase → SQL Editor → Check `users` table
   - Look at `credits_reset_at` timestamp — is it recent?

2. **Has the billing cycle happened?**
   - If you just subscribed today, credits reset on your **next** billing cycle, not immediately
   - Check Stripe dashboard → Subscription → Next billing date

3. **Did a scan use credits?**
   - Each scan costs 1-2 credits per video per creator
   - This is deducted immediately from `credits_remaining`

---

## Future Improvements

The current system could be enhanced with:

1. **Scheduled Credit Resets** (Cron Job)
   - Instead of relying on webhooks, run a scheduled task at 12:00 UTC daily
   - Check for subscriptions whose reset date has passed
   - Automatically reset their credits

2. **Credit Expiration Warning**
   - Email users when credits are running low
   - Show countdown to next reset in the UI

3. **Partial Top-Up Usage**
   - Track which credits came from top-ups (don't reset them)
   - Only reset the plan's base allocation
   - Current: Top-ups are mixed; all credits reset together

---

## For Your Customers

### How to Communicate

**"When do my credits reset?"**
> Your monthly credits reset on your subscription renewal date. Check Stripe for your exact renewal date. One-time top-ups never reset — they're permanent additions.

**"I bought a top-up but didn't get credits"**
> Top-ups are processed immediately. If you don't see them, [contact support] or manually check your Stripe invoice. If Stripe charged you, we'll credit your account.

**"Can I roll over unused credits?"**
> No. Monthly credits reset to your plan's amount each cycle. Unused credits from the previous month are replaced (not added to). Top-up credits never expire.

---

## Implementation Checklist

- [x] Stripe webhook handles `checkout.session.completed` for both plans & top-ups
- [x] Stripe webhook handles `invoice.paid` for monthly credit resets
- [x] Database stores `credits_reset_at` timestamp
- [x] API endpoint `/api/billing/reset-credits` for manual resets
- [ ] **TODO**: Cron job for automatic daily resets (if webhooks are unreliable)
- [ ] **TODO**: Email notifications for low credits
- [ ] **TODO**: UI warning when credits are low (< 100)


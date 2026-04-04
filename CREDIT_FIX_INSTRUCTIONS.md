# Credit Reset Fix for cus_U9UYZWoqx6NF8y

## Issue
Customer `cus_U9UYZWoqx6NF8y` (a@respawnmedia.co) has Agency plan but only **956 credits** instead of **5,000**.

## Immediate Fix

### Option A: Direct SQL (Fastest)

Go to **Supabase Dashboard** → **SQL Editor** → Run:

```sql
UPDATE users
SET 
  credits_remaining = 5000,
  credits_reset_at = NOW()
WHERE stripe_customer_id = 'cus_U9UYZWoqx6NF8y';
```

Then refresh the app. Credits should show 5,000.

### Option B: API Endpoint (After Deployment)

Once you deploy the updated code with the `/api/billing/reset-credits` endpoint:

```bash
curl -X POST https://your-app.com/api/billing/reset-credits \
  -H "Content-Type: application/json" \
  -d '{
    "stripe_customer_id": "cus_U9UYZWoqx6NF8y",
    "plan": "agency"
  }'
```

---

## Why This Happened

**Likely Cause**: Customer made a scan that used credits, and the Stripe webhook for the monthly reset either:
- Hasn't fired yet (renewal date hasn't passed)
- Failed to trigger
- The initial credit allocation didn't happen

**Current Status**:
- Plan: Agency (✓ Correct)
- Credits: 956 (✗ Should be 5,000)
- Credits Reset At: NULL (suggests webhook never fired)

---

## After the Fix

1. **Verify in Supabase**: Refresh the users table, should see `credits_remaining = 5000`
2. **Verify in App**: Go to Pricing page, refresh. Should show 5,000 credits with full bar
3. **Monitor**: Check `credits_reset_at` is set to now

---

## Prevent Future Issues

Add to your deployment checklist:

- [ ] Verify Stripe webhook is properly configured in Stripe Dashboard
- [ ] Check webhook "Resend" history — if failures, investigate why
- [ ] Set up a monitoring alert for failed webhook deliveries
- [ ] Consider adding a cron job as backup (resets credits daily if webhook doesn't fire)


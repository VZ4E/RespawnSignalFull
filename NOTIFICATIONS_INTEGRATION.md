# Slack/Webhook Notifications Integration Guide

This document explains how to integrate the new notification system into your app.

---

## Files Added

1. **`src/services/notificationService.js`** — Core notification logic
   - `sendSlackNotification()` — Send formatted Slack messages
   - `notifyOnScanComplete()` — Notify when a scan finishes
   - `notifyOnLowCredits()` — Alert when credits are running low
   - `notifyOnGroupScanComplete()` — Notify on bulk scan completion

2. **`src/routes/notifications.js`** — API endpoints
   - `GET /api/notifications/preferences` — Get user's notification settings
   - `POST /api/notifications/preferences` — Update settings
   - `POST /api/notifications/test-slack` — Send test message
   - `GET /api/notifications/history` — View notification log

3. **`supabase/migrations/add_notifications.sql`** — Database schema
   - Adds `slack_webhook_url`, notification settings columns to `users` table
   - Creates `notifications_log` table for audit trail

---

## Integration Steps

### 1. Register the Notification Routes

In `server.js`, add:

```javascript
const notificationsRouter = require('./src/routes/notifications');
app.use('/api/notifications', notificationsRouter);
```

**Location** (in `server.js` after other route registrations):
```javascript
// Routes
app.use('/api/auth', authRouter);
app.use('/api/scan', scanRouter);
app.use('/api/billing', billingRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/notifications', notificationsRouter);  // <- ADD THIS LINE
```

### 2. Run Database Migration

In Supabase dashboard:

1. Go to **SQL Editor**
2. Copy the contents of `supabase/migrations/add_notifications.sql`
3. Run the query
4. Verify columns were added to `users` table

**Or via CLI:**
```bash
supabase db push
```

### 3. Add Notifications to Scan Endpoint

In `src/routes/scan.js`, after a successful scan completes:

**Current (around line 395-410):**
```javascript
// Return results to client
return res.json({
  videos,
  deals,
  creditsUsed: totalCredits
});
```

**Updated:**
```javascript
// Send notification if deals found
if (deals.length > 0 || dbUser.notification_on_deals) {
  notifyOnScanComplete(dbUser.id, username, platform, deals, scanId);
}

// Check for low credits
if (dbUser.credits_remaining - totalCredits < 100) {
  notifyOnLowCredits(dbUser.id, dbUser.credits_remaining - totalCredits);
}

// Return results to client
return res.json({
  videos,
  deals,
  creditsUsed: totalCredits
});
```

### 4. Add Notifications to Group Scan

In `src/routes/groups.js`, after bulk scan completes:

```javascript
const { notifyOnGroupScanComplete } = require('../services/notificationService');

// ... after all creators scanned ...

if (results.length > 0) {
  await notifyOnGroupScanComplete(req.dbUser.id, groupName, results);
}
```

### 5. Update Frontend Settings Page

In `public/index.html`, add a Notifications Settings section:

**Add HTML:**
```html
<div class="settings-tab" data-tab="notifications">
  <h3>Notifications</h3>
  
  <div class="form-group">
    <label>Slack Webhook URL</label>
    <input type="text" id="slack-webhook" placeholder="https://hooks.slack.com/..." />
    <button onclick="testSlackWebhook()">Test Connection</button>
  </div>
  
  <div class="form-group">
    <label><input type="checkbox" id="notify-on-deals" /> Notify when deals found</label>
    <label><input type="checkbox" id="notify-every-deal" /> Notify on every deal (not just scans)</label>
    <label><input type="checkbox" id="notify-low-credits" /> Notify when credits low</label>
  </div>
  
  <button onclick="saveNotificationSettings()">Save Settings</button>
  <div id="notification-msg"></div>
</div>
```

**Add JavaScript:**
```javascript
async function loadNotificationSettings() {
  try {
    const prefs = await api('/api/notifications/preferences');
    document.getElementById('slack-webhook').value = prefs.slack_webhook_url || '';
    document.getElementById('notify-on-deals').checked = prefs.notification_on_deals;
    document.getElementById('notify-every-deal').checked = prefs.notification_on_every_deal;
    document.getElementById('notify-low-credits').checked = prefs.notification_on_low_credits;
  } catch (err) {
    console.error('Failed to load notification settings:', err);
  }
}

async function saveNotificationSettings() {
  try {
    const msg = document.getElementById('notification-msg');
    msg.textContent = 'Saving...';
    
    const result = await api('/api/notifications/preferences', 'POST', {
      slack_webhook_url: document.getElementById('slack-webhook').value,
      notification_on_deals: document.getElementById('notify-on-deals').checked,
      notification_on_every_deal: document.getElementById('notify-every-deal').checked,
      notification_on_low_credits: document.getElementById('notify-low-credits').checked,
    });
    
    msg.textContent = '✓ Settings saved!';
    msg.style.color = 'var(--green)';
  } catch (err) {
    const msg = document.getElementById('notification-msg');
    msg.textContent = '✗ ' + err.message;
    msg.style.color = 'var(--red)';
  }
}

async function testSlackWebhook() {
  try {
    const result = await api('/api/notifications/test-slack', 'POST', {
      slack_webhook_url: document.getElementById('slack-webhook').value,
    });
    
    alert('✓ Test message sent to Slack!');
  } catch (err) {
    alert('✗ Failed: ' + err.message);
  }
}
```

---

## How to Use

### For End Users

1. Go to **Settings** → **Notifications**
2. Paste their Slack Workspace Webhook URL (how to get it: see below)
3. Check the notification preferences they want
4. Click "Test Connection" to verify
5. Save

### Getting a Slack Webhook URL

1. Go to https://api.slack.com/apps
2. Create New App → From scratch
3. Give it a name (e.g., "RespawnSignal Notifications")
4. Select workspace
5. Go to **Incoming Webhooks** → Turn on
6. Click **Add New Webhook to Workspace**
7. Select a channel (e.g., #respawn-alerts)
8. Copy the webhook URL
9. Paste into RespawnSignal settings

---

## Testing

### Test from CLI

```bash
curl -X POST http://localhost:3000/api/notifications/test-slack \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"slack_webhook_url": "https://hooks.slack.com/..."}'
```

### Test from Frontend

1. Fill in Slack webhook URL
2. Click "Test Connection"
3. Should see test message in Slack

---

## Notification Types

### Scan Complete
Sent when a user finishes scanning a creator.

```
Scan Complete
📱 TikTok: @somecreator
🎉 Found 3 deals!
```

### Deal Found
Sent for each deal if `notification_on_every_deal` is enabled.

```
New Deal Found
🎯 Nike, Adidas
📱 @somecreator (TikTok)
💼 Sponsorship
```

### Low Credits
Sent when credits drop below 100.

```
⚠️ Low Credits Alert
You have 45 credits remaining on your PRO plan.
Upgrade or buy a top-up to continue scanning.
```

### Group Scan Complete
Sent when bulk scan of a group finishes.

```
Bulk Scan Complete: My Group
✅ 12 successful, ❌ 1 failed
🎯 Found 28 total deals

Summary:
• @creator1 (TikTok): 5 deals
• @creator2 (YouTube): 3 deals
... and 10 more creators
```

---

## Advanced Configuration

### Environment Variables

Add to `.env` (optional):

```env
# Email notifications (future)
SENDGRID_API_KEY=sg_...
SENDGRID_FROM_EMAIL=notifications@respawnsignal.com

# Slack (already supported)
SLACK_WORKSPACE_ID=T12345678

# Discord (future)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Custom Notification Logic

You can extend `notificationService.js` to add:
- Email notifications (SendGrid, Resend)
- Discord webhooks
- SMS alerts (Twilio)
- Custom webhooks

Example:

```javascript
async function sendDiscordNotification(webhookUrl, message, deals = []) {
  // Similar to Slack but with Discord message format
  // ...
}

async function sendEmailNotification(email, subject, html) {
  // Use SendGrid or Resend API
  // ...
}
```

---

## Testing Checklist

- [ ] Routes registered in `server.js`
- [ ] Database migration ran (check Supabase)
- [ ] Notification settings appear in UI
- [ ] Can save Slack webhook URL
- [ ] Test message sends to Slack
- [ ] Notification appears after scan with deals
- [ ] Low credit notification triggers
- [ ] Notification history appears in UI
- [ ] Group scan notifications work

---

## Known Limitations

1. **Async Webhooks**: All notifications are async (non-blocking). If Slack is down, the scan still completes.
2. **No Retries**: Failed webhook sends are not retried. Consider adding retry logic.
3. **Email**: Email notifications are stubbed but not implemented. Add SendGrid integration.
4. **Rate Limits**: Slack webhook rate limits are not handled. For high-volume scans, add queue system.

---

## Future Enhancements

1. **Notification Digest**: Send one email per day with all deals
2. **Smart Filtering**: Only notify if deal threshold met (e.g., "minimum sponsorship value")
3. **Customizable Messages**: Let users customize Slack message templates
4. **Notification Analytics**: Track which notifications users engage with
5. **Two-Way Slack**: Reply in Slack to approve/ignore deals


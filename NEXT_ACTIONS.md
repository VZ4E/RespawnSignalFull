# Next Actions - Immediate Implementation Tasks

## 🎯 Priorities

### 🔴 DO THIS FIRST (Blocking Feature for Pro Plan)
**Task**: Integrate Slack notifications into scan workflow  
**Time**: 2-3 hours  
**Effort**: Moderate (copy/paste + testing)

#### Steps:

**1. Register notification routes in `server.js`**
```javascript
// Add near top with other require()s
const notificationsRouter = require('./src/routes/notifications');

// Add with other route registrations (around line 50-60)
app.use('/api/notifications', notificationsRouter);
```

**2. Run database migration in Supabase**
- Go to Supabase dashboard → SQL Editor
- Copy contents of `supabase/migrations/add_notifications.sql`
- Run the query
- Verify: Check `users` table has new columns (`slack_webhook_url`, `notification_on_deals`, etc.)

**3. Wire notifications into scan endpoint (`src/routes/scan.js`)**

Find the line where scan results are returned (~line 395):
```javascript
// BEFORE (current)
return res.json({
  videos,
  deals,
  creditsUsed: totalCredits
});
```

Replace with:
```javascript
// AFTER (with notifications)
// Send notification if deals found
if (deals && deals.length > 0) {
  const { notifyOnScanComplete } = require('../services/notificationService');
  notifyOnScanComplete(dbUser.id, username, platform, deals, null).catch(err => {
    console.error('Notification failed:', err);
  });
}

// Check for low credits (warn if <100 credits remaining)
if (dbUser.credits_remaining - totalCredits < 100) {
  const { notifyOnLowCredits } = require('../services/notificationService');
  notifyOnLowCredits(dbUser.id, dbUser.credits_remaining - totalCredits).catch(err => {
    console.error('Low credit notification failed:', err);
  });
}

return res.json({
  videos,
  deals,
  creditsUsed: totalCredits
});
```

**4. Add group scan notifications (`src/routes/groups.js`)**

Find where group scans complete (search for "scan all creators in group"):
```javascript
// Add at the top if not already there
const { notifyOnGroupScanComplete } = require('../services/notificationService');

// At the end of group scan, after results collected:
if (results.length > 0) {
  notifyOnGroupScanComplete(req.dbUser.id, groupName, results).catch(err => {
    console.error('Group scan notification failed:', err);
  });
}
```

**5. Add notification settings UI to `public/index.html`**

Find the settings section. Add this new tab:
```html
<!-- In your settings tabs container -->
<div class="settings-tab" data-tab="notifications">
  <h3>Notifications</h3>
  
  <div style="margin-bottom:20px">
    <label style="display:block; margin-bottom:8px">
      <strong>Slack Webhook URL</strong><br/>
      <small>Get from <a href="https://api.slack.com/apps" target="_blank">api.slack.com/apps</a></small>
    </label>
    <input 
      type="text" 
      id="slack-webhook" 
      placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX"
      style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px"
    />
    <button onclick="testSlackWebhook()" style="margin-top:8px; padding:8px 16px; background:var(--accent); color:white; border:none; border-radius:6px; cursor:pointer">
      Test Connection
    </button>
  </div>
  
  <div style="margin-bottom:20px">
    <label><input type="checkbox" id="notify-on-deals" /> Notify when deals found</label><br/>
    <label><input type="checkbox" id="notify-every-deal" /> Notify on every deal (not just scans)</label><br/>
    <label><input type="checkbox" id="notify-low-credits" /> Notify when credits low (&lt;100)</label>
  </div>
  
  <button onclick="saveNotificationSettings()" style="padding:10px 20px; background:var(--accent); color:white; border:none; border-radius:6px; cursor:pointer">
    Save Settings
  </button>
  <div id="notification-msg" style="margin-top:10px; font-size:12px"></div>
</div>
```

Add JavaScript functions:
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
    msg.style.color = 'var(--text2)';
    
    await api('/api/notifications/preferences', 'POST', {
      slack_webhook_url: document.getElementById('slack-webhook').value,
      notification_on_deals: document.getElementById('notify-on-deals').checked,
      notification_on_every_deal: document.getElementById('notify-every-deal').checked,
      notification_on_low_credits: document.getElementById('notify-low-credits').checked,
    });
    
    msg.textContent = '✓ Settings saved!';
    msg.style.color = 'var(--green)';
  } catch (err) {
    msg.textContent = '✗ ' + (err.message || 'Failed to save');
    msg.style.color = 'var(--red)';
  }
}

async function testSlackWebhook() {
  try {
    const webhookUrl = document.getElementById('slack-webhook').value;
    if (!webhookUrl) {
      alert('Please enter a Slack webhook URL first');
      return;
    }
    
    await api('/api/notifications/test-slack', 'POST', {
      slack_webhook_url: webhookUrl,
    });
    
    alert('✓ Test message sent to your Slack workspace!');
  } catch (err) {
    alert('✗ Failed to send test message:\n' + err.message);
  }
}

// Call when settings page loads
// (Add to wherever your other settings loading happens)
window.addEventListener('DOMContentLoaded', () => {
  // ... other init code ...
  loadNotificationSettings();
});
```

**6. Test the integration**

1. Start your app locally or deploy
2. Go to Settings → Notifications
3. Get a Slack webhook URL:
   - Go to https://api.slack.com/apps
   - Create New App → From scratch
   - Name it "RespawnSignal"
   - Enable Incoming Webhooks
   - Add New Webhook to Workspace
   - Copy the URL
4. Paste webhook into the app
5. Click "Test Connection"
6. Should see test message in Slack ✅
7. Run a scan with deals
8. Should see notification in Slack ✅

**7. Commit and push**
```bash
git add -A
git commit -m "Integrate Slack notifications into scan workflow"
git push
```

---

### 🟡 DO THIS SECOND (Blocking Feature for Agency Plan)
**Task**: Build team permission system (RBAC)  
**Time**: 8-10 hours  
**Effort**: High (multiple files, complex logic)

#### What's needed:
- [ ] Add `roles` table or `roles` column to users table
- [ ] Add permission checks to auth middleware
- [ ] Add permission checks to all protected endpoints
- [ ] Create team management UI
- [ ] Test role-based access

**Reference**: See `FEATURE_COMPLETION_TRACKER.md` for details

This is a larger task. Would you like me to start building this next?

---

### 🟢 DO THIS THIRD (Nice to Have)
**Task**: Priority processing queue  
**Time**: 4-6 hours  
**Impact**: Differentiates Pro from Starter  
**Reference**: `FEATURE_COMPLETION_TRACKER.md`

---

## ✅ Already Done This Session

- [x] Fixed Pricing page blue highlight bug
- [x] Fixed Account/Pricing plan mismatch
- [x] Fixed customer credit allocation (cus_U9UYZWoqx6NF8y)
- [x] Built complete Slack notification system
- [x] Created comprehensive documentation
- [x] Provided customer credit fix tools

---

## 📋 Testing Checklist

Before shipping notifications to production:

- [ ] Slack webhook connection works
- [ ] Test message appears in Slack
- [ ] Settings save correctly
- [ ] Scan with deals triggers notification
- [ ] Low credit warning triggers
- [ ] Group scan notifications work
- [ ] Notification history appears in UI
- [ ] No crashes on webhook failure (should be graceful)

---

## 🚀 Deployment Checklist

Before going live:

- [ ] Notifications integrated and tested
- [ ] Database migration ran in production Supabase
- [ ] Code deployed to production
- [ ] Settings UI visible to users
- [ ] Documentation updated
- [ ] Send customer update email about new feature

---

## Questions?

- **How do I get a Slack webhook URL?** → See step 3 above
- **Will notifications fail if Slack is down?** → No, they fail gracefully (non-blocking)
- **Can I add email notifications?** → Yes, extend `notificationService.js` with SendGrid
- **How do I monitor notification delivery?** → Check `notifications_log` table in Supabase

---

## Timeline Estimate

| Task | Time | Status |
|------|------|--------|
| Integrate notifications | 2-3 hrs | Ready to start |
| Test notifications | 1 hr | After integration |
| Build team permission system | 8-10 hrs | Next (after notifications) |
| Test permissions | 2 hrs | After build |
| Deploy to production | 1 hr | Final step |
| **TOTAL** | **14-16 hrs** | **~2-3 days work** |

---

Good luck! You've got all the code built. Now it's just wiring it together! 🚀


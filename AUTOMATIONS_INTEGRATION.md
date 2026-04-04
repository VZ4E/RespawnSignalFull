# Automations Integration - Code Snippets

Add these snippets to your main Express app file (likely `src/index.js`).

## 1. Register Automations Router

Add this in your main app file where other routes are registered:

```javascript
// Around line where you register other routes (after scan, settings, etc.)

const automationsRouter = require('./routes/automations');
app.use('/api/automations', automationsRouter);
```

**Location**: Typically near other `app.use('/api/...')` declarations.

---

## 2. Set Up Cron Job

Add this in your main app file, after all routes are registered:

```javascript
// Automation Scheduler (cron job runs every 60 minutes)
const { runAutomationScheduler } = require('./services/automationScheduler');

console.log('[Cron] Starting automation scheduler (runs every 60 minutes)');
setInterval(() => {
  console.log('[Cron] Running scheduled automations check...');
  runAutomationScheduler().catch(err => {
    console.error('[Cron] Automation scheduler failed:', err.message);
  });
}, 60 * 60 * 1000); // 60 minutes

// Optional: Run on startup (first check is 60 min away otherwise)
console.log('[Cron] Queuing initial automation check in 5 minutes');
setTimeout(() => {
  console.log('[Cron] Running initial automation check');
  runAutomationScheduler().catch(err => {
    console.error('[Cron] Initial check failed:', err.message);
  });
}, 5 * 60 * 1000); // 5 minutes
```

**Notes**:
- If using Railway/Render, this works fine (persistent process)
- If using serverless (AWS Lambda, Vercel), use external cron service (Easycron, AWS EventBridge, etc.)
- The `setTimeout` on startup ensures first check runs 5 minutes after app starts

---

## 3. Add Automation Page Link to Navigation

In your main HTML template or nav file, add:

```html
<a href="/automation">Automations</a>
```

**Example placement** (assuming nav structure similar to existing):
```html
<nav>
  <a href="/dashboard">Dashboard</a>
  <a href="/scan">Scan</a>
  <a href="/scan-history">History</a>
  <a href="/automation">Automations</a> <!-- ← ADD HERE -->
  <a href="/settings">Settings</a>
</nav>
```

---

## 4. Serve Automation HTML Page

Ensure your Express app serves the automation page:

```javascript
// In your app, where you serve HTML pages
app.get('/automation', (req, res) => {
  res.sendFile(__dirname + '/../public/automation.html');
});
```

**Alternative** (if using a router):
```javascript
const pagesRouter = express.Router();

pagesRouter.get('/automation', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/automation.html'));
});

app.use(pagesRouter);
```

---

## 5. Environment Variables

Add to your `.env` file:

```bash
# Existing (already set)
RAPIDAPI_KEY=<your-key>
PERPLEXITY_KEY=<your-key>

# Email service (choose ONE):

# Option A: Resend
RESEND_API_KEY=<your-resend-api-key>

# Option B: Gmail
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password

# Optional:
APP_URL=https://app.respawnsignal.com
```

**Email Setup**:

**Resend** (recommended):
1. Go to https://resend.com
2. Create account and get API key
3. Set `RESEND_API_KEY` in env

**Gmail**:
1. Enable "Less secure app access" or use App Password
2. Set `GMAIL_USER` and `GMAIL_PASS` in env

---

## 6. Create Settings Route (if missing)

If you don't have `/api/settings/creators`, create it:

```javascript
// In src/routes/settings.js or similar
router.get('/creators', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', req.dbUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch creators' });
    }

    return res.json(data || []);
  } catch (err) {
    console.error('Settings error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch creators' });
  }
});

// Or if using an existing settings route:
// app.get('/api/settings/creators', ...)
```

---

## 7. Auth User Endpoint (if missing)

Frontend needs to fetch current user email:

```javascript
// In src/routes/auth.js or similar
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(req.headers.authorization);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      // other fields...
    });
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Or use your existing user endpoint:
// app.get('/api/auth/user', ...)
```

---

## 8. Complete Integration Example

Here's what a section of your main `src/index.js` might look like:

```javascript
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
const scanRouter = require('./routes/scan');
const settingsRouter = require('./routes/settings');
const automationsRouter = require('./routes/automations');

app.use('/api/scan', scanRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/automations', automationsRouter);

// Page routes
app.get('/automation', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/automation.html'));
});

// Cron: Automation Scheduler
const { runAutomationScheduler } = require('./services/automationScheduler');

console.log('[Cron] Starting automation scheduler (runs every 60 minutes)');
setInterval(() => {
  console.log('[Cron] Running scheduled automations check...');
  runAutomationScheduler().catch(err => {
    console.error('[Cron] Automation scheduler failed:', err.message);
  });
}, 60 * 60 * 1000);

console.log('[Cron] Queuing initial automation check in 5 minutes');
setTimeout(() => {
  console.log('[Cron] Running initial automation check');
  runAutomationScheduler().catch(err => {
    console.error('[Cron] Initial check failed:', err.message);
  });
}, 5 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 9. Testing the Integration

1. **Start the app**:
   ```bash
   npm start
   ```

2. **Check logs**:
   ```
   [Cron] Starting automation scheduler (runs every 60 minutes)
   [Cron] Queuing initial automation check in 5 minutes
   ```

3. **Access the page**:
   ```
   http://localhost:3001/automation
   ```

4. **Create test automation**:
   - Add a test creator first (Settings)
   - Go to Automations page
   - Click "Add Automation"
   - Fill in form and save

5. **Verify API**:
   ```bash
   curl http://localhost:3001/api/automations \
     -H "Authorization: Bearer <your-token>"
   ```

6. **Test email** (optional):
   Manually trigger scheduler in Node console:
   ```javascript
   const { runAutomationScheduler } = require('./src/services/automationScheduler');
   runAutomationScheduler();
   ```

---

## 10. Troubleshooting

| Issue | Solution |
|-------|----------|
| Route not found (`/api/automations`) | Check router is registered in main app |
| Email not sending | Check RESEND_API_KEY or GMAIL credentials in env |
| Cron not running | Check logs for `[Cron]` prefix, verify setInterval is executing |
| Creator dropdown empty | Verify `/api/settings/creators` endpoint exists and returns data |
| Automation page 404 | Check `/automation` route is defined |

---

**Ready to integrate!** Follow steps 1-8 and you're done. 🚀

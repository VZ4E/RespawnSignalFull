# Automations Feature - Implementation Guide

## Overview
Complete automated scan scheduling system for tracking brand deals across creators on a recurring basis.

**Status**: Ready for implementation
**Complexity**: High
**Deployment**: 3 main components (DB + Backend + Frontend)

---

## 1. Database Setup

### Schema Migration
Run this SQL in Supabase once:

```sql
CREATE TABLE automations (
 id BIGSERIAL PRIMARY KEY,
 user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 creator_username VARCHAR(100) NOT NULL,
 platform VARCHAR(20) DEFAULT 'tiktok',
 frequency VARCHAR(20) NOT NULL,
 email VARCHAR(255) NOT NULL,
 last_run_at TIMESTAMP,
 last_deals JSONB DEFAULT '[]',
 next_run_at TIMESTAMP,
 active BOOLEAN DEFAULT true,
 created_at TIMESTAMP DEFAULT NOW(),
 updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_automations_next_run_active ON automations(next_run_at, active)
  WHERE active = true;
CREATE INDEX idx_automations_user_id ON automations(user_id);
CREATE UNIQUE INDEX idx_automations_user_creator ON automations(user_id, creator_username)
  WHERE active = true;
```

**File**: `AUTOMATIONS_SCHEMA.sql`

---

## 2. Backend Implementation

### API Routes
New file: `src/routes/automations.js`

**Endpoints**:
- `GET /api/automations` — Fetch user's automations
- `POST /api/automations` — Create new automation
- `PATCH /api/automations/:id` — Update automation (active, frequency, email)
- `DELETE /api/automations/:id` — Delete automation

**Features**:
- Validates frequency (twice_weekly, weekly, biweekly, monthly)
- Auto-calculates next_run_at based on frequency
- Prevents duplicate creator automations
- All operations verify user ownership

**Integration**:
Update `src/index.js` (or main app file) to register route:
```javascript
const automationsRouter = require('./routes/automations');
app.use('/api/automations', automationsRouter);
```

### Scheduler Service
New file: `src/services/automationScheduler.js`

**Functions**:
- `runAutomationScheduler()` — Main entry point, called by cron job
- `processAutomation(automation)` — Handle single due automation
- `runCreatorScan()` — Execute scan using existing Perplexity + TikTok logic
- `findNewDeals()` — Compare new deals against last_deals
- `sendAutomationEmail()` — Email via Resend or Gmail
- `calculateNextRunAt()` — Frequency → next_run_at math

**Deal Comparison Logic**:
```javascript
// Deals match if: same brands + deal_type + evidence
const lastSigs = lastDeals.map(d => 
  `${(d.brands || []).sort().join('|')}::${d.deal_type}::${d.evidence}`
);
const newDeals = newDeals.filter(d => {
  const sig = `${(d.brands || []).sort().join('|')}::${d.deal_type}::${d.evidence}`;
  return !lastSigs.includes(sig);
});
```

**Email Format**:
- **New deals**: Lists each new deal with brand, type, confidence, evidence quote
- **No new deals**: Shows current full list with same format
- Uses HTML email template with badges and styling
- Configurable via Resend API or Gmail (env-based)

### Cron Integration
Add to your cron scheduler (e.g., OpenClaw cron, node-cron, or external service):

```javascript
// Run every 60 minutes
const { runAutomationScheduler } = require('./services/automationScheduler');

setInterval(() => {
  runAutomationScheduler().catch(err => {
    console.error('[Cron] Automation scheduler failed:', err.message);
  });
}, 60 * 60 * 1000);
```

Or use system cron / task scheduler:
```bash
# crontab -e
0 * * * * cd /path/to/app && node -e "require('./src/services/automationScheduler').runAutomationScheduler()"
```

### Environment Variables Required
```bash
RAPIDAPI_KEY=<your-rapidapi-key>
PERPLEXITY_KEY=<your-perplexity-api-key>

# Email service (choose one):
RESEND_API_KEY=<resend-key>  # OR
GMAIL_USER=<email@gmail.com>
GMAIL_PASS=<app-password>

# Optional:
APP_URL=https://app.respawnsignal.com
```

---

## 3. Frontend Implementation

### New Page: /automation
File: `public/automation.html`

**Features**:
- List all user automations with status
- Add Automation modal with:
  - Creator dropdown (fetches from existing creators list)
  - Frequency selector (4 fixed options)
  - Email input (prefilled with account email)
- Edit and Delete buttons
- Toggle active/paused status
- Next run date countdown
- Last run timestamp

**API Calls**:
- GET `/api/automations` — Load list
- GET `/api/settings/creators` — Populate creator dropdown
- GET `/api/auth/user` — Get account email
- POST `/api/automations` — Create
- PATCH `/api/automations/{id}` — Update
- DELETE `/api/automations/{id}` — Delete

**Styling**:
- Clean card-based layout
- Modal for add/edit
- Toggle switch for active status
- Toast notifications
- Loading states
- Empty state message

**Auto-refresh**: Page refreshes automation list every 30 seconds

### Update Navigation
Add link to Automation page in main nav:
```html
<a href="/automation">Automations</a>
```

---

## 4. Implementation Checklist

### Database
- [ ] Run SQL in Supabase
- [ ] Verify indexes created
- [ ] Test with manual insert

### Backend
- [ ] Create `src/routes/automations.js`
- [ ] Create `src/services/automationScheduler.js`
- [ ] Register route in main app
- [ ] Set up cron job (every 60 minutes)
- [ ] Configure environment variables
- [ ] Test API endpoints manually

### Frontend
- [ ] Create `public/automation.html`
- [ ] Test modal open/close
- [ ] Test form submission
- [ ] Test creator dropdown loads
- [ ] Test email input prefill
- [ ] Add nav link
- [ ] Test delete confirmation
- [ ] Test active toggle

### Integration Testing
- [ ] Create test automation
- [ ] Wait for scheduled run (or manually trigger)
- [ ] Verify email sent
- [ ] Verify last_run_at updated
- [ ] Verify last_deals stored
- [ ] Verify next_run_at recalculated
- [ ] Test with multiple automations

---

## 5. Deployment Steps

1. **Database**: Run SQL migration in Supabase
2. **Backend**: Commit and deploy
   - New files: `src/routes/automations.js`, `src/services/automationScheduler.js`
   - Modified: `src/index.js` (register route + set up cron)
3. **Frontend**: Commit and deploy
   - New file: `public/automation.html`
   - Modified: Main nav template (add link)
4. **Cron Setup**: Configure scheduler (Railway/Render has cron support, or use external)
5. **Email Service**: Set environment variables (Resend API key or Gmail credentials)

---

## 6. Testing

### Manual Test Flow
1. Go to Settings, add a test creator (@testhandle, tiktok)
2. Go to Automations, click "Add Automation"
3. Select test creator, weekly frequency, test email
4. Save automation
5. Edit automation to verify modal pre-fills correctly
6. Toggle active status (should disable/enable)
7. For testing scheduler: manually call `runAutomationScheduler()` in dev console
8. Verify email received with deals list

### Debug Logging
All components log with prefixes:
- `[Automations]` — API routes
- `[AutomationScheduler]` — Scheduler service
- `[renderDeals]` — Frontend rendering

---

## 7. Future Enhancements

- SMS notifications (Twilio)
- In-app notifications instead of email
- Custom notification frequency per deal type
- Deal filtering (e.g., only high-confidence deals)
- Batch email (combine multiple creators per email)
- Webhook integration for external tools
- Export automation results to CSV

---

## Files Reference

| File | Purpose |
|------|---------|
| `AUTOMATIONS_SCHEMA.sql` | Database schema migration |
| `src/routes/automations.js` | API endpoints (GET/POST/PATCH/DELETE) |
| `src/services/automationScheduler.js` | Cron job logic + email service |
| `public/automation.html` | Frontend UI page |
| `AUTOMATIONS_IMPLEMENTATION_GUIDE.md` | This guide |

---

## Estimated Timeline

- Database: 5 minutes (SQL execution)
- Backend: 30 minutes (integrate + test)
- Frontend: 30 minutes (add page + test)
- Deployment: 15 minutes (commit + deploy + verify)

**Total**: ~1.5 hours

---

## Support

For issues:
1. Check logs: `[Automations]`, `[AutomationScheduler]` prefixes
2. Verify cron job is running (check process logs)
3. Verify email service is configured (Resend key or Gmail)
4. Verify database schema was created
5. Test API endpoints with curl/Postman

---

**Status**: ✅ Ready to implement

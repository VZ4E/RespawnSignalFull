# Feature Audit: Promised vs Implemented

Based on the pricing page and marketing claims, here's what **should exist** vs what **actually exists**:

---

## STARTER PLAN ($299/mo)

### ✅ Implemented
- [x] 1,000 credits/month (database + billing webhook)
- [x] TikTok brand deal detection (via `/api/scan`)
- [x] YouTube scanning (new integration)
- [x] Instagram scanning (basic - via `/api/scan`)
- [x] CSV export (history can be exported)

### ❌ NOT Implemented
- [ ] **Explicitly missing**: Nothing critical

---

## PRO PLAN ($599/mo)

### ✅ Implemented
- [x] 2,500 credits/month
- [x] All platforms included (TikTok, YouTube, Instagram, Twitch)
- [x] Campaign history + reporting (stored in database)

### ⚠️ PARTIAL/NEEDS WORK
- [ ] **Slack/webhook notifications** — NOT BUILT
  - Status: 0% (no Slack integration, no webhook system)
  - Priority: HIGH (customers expect real-time alerts)

- [ ] **Priority processing** — NOT BUILT
  - Status: 0% (all scans process at same speed)
  - Priority: MEDIUM (nice-to-have, not essential)

---

## AGENCY PLAN ($999/mo)

### ✅ Implemented
- [x] 5,000 credits/month
- [x] All platforms
- [x] Bulk automation (groups + scan configs)
- [x] Team collaboration setup (settings exist)

### ❌ NOT Implemented
- [ ] **Multi-user seats (up to 5)** — PARTIALLY BUILT
  - Status: 50% (UI exists, permission system missing)
  - Issue: Anyone with token can access; no permission levels
  - Priority: HIGH (security & compliance risk)

- [ ] **White-label ready** — NOT BUILT
  - Status: 0% (no branding customization system)
  - Priority: MEDIUM (only matters if reselling)

- [ ] **Dedicated support** — N/A (operational, not technical)
  - Status: Not code-related

- [ ] **Custom integrations** — NOT BUILT
  - Status: 0% (no plugin/extension system)
  - Priority: LOW (advanced feature)

---

## CROSS-PLAN FEATURES

### ✅ Working
- [x] Brand deal detection via AI
- [x] CSV export
- [x] Scan history storage
- [x] All major platforms

### ❌ Missing (All Plans Affected)
- [ ] **Notifications** (Slack/Email)
  - Current: No notification system exists
  - Needed: Slack/email alerts when deals are found

- [ ] **Permission levels** (CRITICAL for Teams)
  - Current: No role system (owner/manager/viewer)
  - Needed: Granular access control

- [ ] **API access** (promised as "Custom integrations")
  - Current: Only internal endpoints
  - Needed: Public API with tokens

---

## What To Build First

### 🔴 CRITICAL (Revenue Impact)
1. **Slack/Webhook notifications** (Pro+ promise)
   - Effort: 4-6 hours
   - Files: Create `src/routes/notifications.js`
   - Why: Customers paid for real-time alerts

2. **Team permission system** (Agency promise)
   - Effort: 8-10 hours
   - Files: Add roles to `users` table, update auth middleware
   - Why: Without this, Agency plan lacks promised feature

### 🟡 IMPORTANT (UX/Feature)
3. **Priority processing queue** (Pro promise)
   - Effort: 3-4 hours
   - Files: Add priority column to scans table
   - Why: Differentiates Pro from Starter

### 🟢 NICE-TO-HAVE (Advanced)
4. **White-label customization** (Agency promise)
   - Effort: 6-8 hours
   - Files: Create branding table, update frontend
   - Why: Only needed if customers are reselling

5. **Custom integrations / API** (Agency promise)
   - Effort: 10-12 hours
   - Files: Create public API with auth tokens
   - Why: Advanced feature, low immediate demand

---

## Implementation Roadmap

### Phase 1: Core (This Week)
- [ ] Add Slack integration (webhook notifications)
- [ ] Add email notifications (backup to Slack)
- [ ] Test with real users

**Estimated**: 6-8 hours

### Phase 2: Compliance (Next Week)
- [ ] Implement team roles (owner/manager/viewer)
- [ ] Add permission checks to all endpoints
- [ ] Update UI for role-based features

**Estimated**: 10-12 hours

### Phase 3: Polish (Following Week)
- [ ] Priority processing queue
- [ ] Better notification UI
- [ ] User management dashboard (for owners)

**Estimated**: 8-10 hours

---

## Budget Reality Check

⚠️ **Your code currently doesn't match your marketing.**

| Feature | Promised | Exists | Risk |
|---------|----------|--------|------|
| Slack Notifications | ✅ Pro+ | ❌ No | HIGH |
| Team Seats | ✅ Agency | ⚠️ Partial | HIGH |
| Priority Processing | ✅ Pro | ❌ No | MEDIUM |
| Custom Integrations | ✅ Agency | ❌ No | MEDIUM |
| White-Label | ✅ Agency | ❌ No | LOW |

**Action**: Either implement these features or update marketing to match reality.


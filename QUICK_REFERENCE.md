# ⚡ Quick Reference - Agency Search Deployment

**Copy-paste this into your task list. Check off each item as you complete it.**

---

## 🔴 CRITICAL PATH (Must do in this order)

### Step 1: Database Setup (5 minutes)
```
[ ] Open https://supabase.com and log in
[ ] Go to your project → SQL Editor
[ ] Click "New Query"
[ ] Copy entire contents of: SUPABASE_SCHEMA.sql
[ ] Paste into SQL Editor
[ ] Click "Run" (or Ctrl+Enter)
[ ] ✅ Wait for "Success" message
```

### Step 2: Verify Database
```
[ ] Go to Table Editor in sidebar
[ ] Count tables: should see 6
    - agencies ✓
    - agency_creators ✓
    - agency_scans ✓
    - creator_profiles ✓
    - creator_alerts ✓
    - analytics_snapshots ✓
[ ] Click each table and verify columns exist
[ ] ✅ All tables present and correct
```

### Step 3: Deploy Frontend
```
[ ] Go to public/index.html in your repo
[ ] Verify navigation section updated with:
    - Agency Search (in Tools)
    - Creator Profiles (in Tools)
    - Creator Radar (in Tools)
    - Analytics (in Tools)
    - Alerts (in Tools)
[ ] Merge and deploy to production
[ ] ✅ Navigation shows new items
```

### Step 4: Get Supabase Credentials
```
[ ] Supabase dashboard → Settings → API
[ ] Copy "Project URL" → save as SUPABASE_URL
[ ] Copy "anon public" key → save as SUPABASE_ANON_KEY
[ ] ✅ Credentials ready for integration
```

### Step 5: Integrate Supabase Client
```
[ ] npm install @supabase/supabase-js
[ ] Create supabase client:

    import { createClient } from '@supabase/supabase-js';
    
    const supabase = createClient(
      'YOUR_SUPABASE_URL',
      'YOUR_SUPABASE_ANON_KEY'
    );

[ ] Test connection: console.log(supabase)
[ ] ✅ Client initializes without errors
```

### Step 6: Test Database Operations
```
[ ] Test CREATE agency:
    const { data, error } = await supabase
      .from('agencies')
      .insert([{ name: 'Test', domain: 'test.com' }])
      .select();
    console.log(data, error);

[ ] Check Supabase dashboard → Table Editor → agencies
[ ] ✅ Can see new agency record
```

---

## 🟢 MAIN FEATURES (Build after critical path)

### Agency Management
```
✅ Create agency (modal step 1)
  - Save to agencies table
  - Redirect to step 2

✅ Add creators (modal step 2)
  - Insert to agency_creators table
  - Show selected count

✅ Confirm & save (modal step 3)
  - Show summary
  - Enable scan button

✅ View agencies (main list)
  - Fetch from agencies table
  - Show creator count
  - Show last scan date

✅ Delete agency
  - Confirm with user
  - Delete from agencies table
  - Cascades to agency_creators
```

### Creator Management
```
✅ Add creator to agency
  - Insert to agency_creators
  - Update follower_count from discovery API

✅ Filter creators
  - By agency (dropdown)
  - By platform (dropdown)
  - Combine filters

✅ Scan creator
  - Individual: run scanner on one
  - Bulk: run scanner on selected
  - Log results to agency_scans

✅ View profiles
  - Show in creator_profiles table
  - Link to agency_creators
```

### Scanning & Tracking
```
✅ Log scan
  - Insert to agency_scans
  - Record started_at, completed_at
  - Count deals found

✅ Update agency stats
  - Set last_scan_at on agency
  - Update follower counts
  - Record engagement_rate

✅ View scan history
  - Query agency_scans by agency_id
  - Show results with details
```

---

## 🟡 POLISH (After main features work)

```
[ ] Error handling - Show friendly messages
[ ] Loading states - Show spinners during API calls
[ ] Empty states - Show helpful guidance when no data
[ ] Pagination - Handle 100+ agencies smoothly
[ ] Real-time - Subscribe to table changes (optional)
[ ] Alerts - Notify user of new deals (optional)
[ ] Analytics - Show trends and metrics (optional)
```

---

## 🧪 Testing Checklist

**Before merging to main:**

```
[ ] Can create agency with mock data
[ ] Can create agency with real API data
[ ] Can add 5+ creators to agency
[ ] Can filter creators by platform
[ ] Can delete agency without errors
[ ] Can scan single creator
[ ] Can scan multiple creators at once
[ ] Database shows correct counts
[ ] Timestamps auto-update
[ ] No RLS violations (logged in user only)
[ ] Mobile looks good (responsive)
[ ] No console errors
[ ] Performance acceptable (<2s per operation)
```

---

## 📊 Database Schema Cheat Sheet

### Insert Agency
```sql
INSERT INTO agencies (name, domain, website_url)
VALUES ('Fashion Forward', 'fashionforward.com', 'https://...');
```

### Add Creators
```sql
INSERT INTO agency_creators (agency_id, creator_handle, platform, follower_count)
VALUES ('{agency_id}', 'hotrodd', 'tiktok', 2500000);
```

### Get All Agencies
```sql
SELECT * FROM agencies WHERE user_id = auth.uid();
```

### Get Agency with Creators
```sql
SELECT a.*, COUNT(ac.id) as creator_count
FROM agencies a
LEFT JOIN agency_creators ac ON a.id = ac.agency_id
WHERE a.user_id = auth.uid()
GROUP BY a.id;
```

### Log Scan
```sql
INSERT INTO agency_scans (agency_id, scan_type, creator_count, deals_found, status)
VALUES ('{agency_id}', 'full', 15, 3, 'completed');
```

---

## 🔴 Common Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| "RLS violation" | User not logged in | `const user = await supabase.auth.getUser()` |
| Can't see data | Wrong user_id | Check `auth.uid()` matches logged-in user |
| Foreign key error | Agency doesn't exist | Create agency first, then creators |
| Timestamps not updating | Trigger not created | Re-run schema, check trigger exists |
| Slow queries | Missing indexes | All indexes included in schema |
| CORS error | Wrong credentials | Verify SUPABASE_URL and ANON_KEY |
| Data appearing twice | Duplicate inserts | Check for duplicate saves in UI |

---

## 📋 Files You Have

```
✅ SUPABASE_SCHEMA.sql
   → Run this first in SQL Editor
   → Creates all 6 tables, indexes, policies, triggers

✅ SUPABASE_SETUP_GUIDE.md
   → Step-by-step: how to run schema, what each table does
   → Troubleshooting guide

✅ FRONTEND_SUPABASE_INTEGRATION.md
   → Code samples for all database operations
   → Copy-paste functions
   → Error handling examples

✅ AGENCY_SEARCH_COMPLETE.md
   → Original UI implementation details
   → Features list and testing

✅ DEPLOYMENT_SUMMARY.md
   → Full timeline and checklist
   → Go/no-go decision points

✅ QUICK_REFERENCE.md
   → This file - start here!
   → Condensed checklists
```

---

## ⏰ Time Estimates

- Database setup: **5 min**
- Verify setup: **5 min**
- Deploy frontend: **2 min**
- Supabase integration: **1-2 hours**
- Feature implementation: **2-4 hours**
- Testing & polish: **1-2 hours**

**Total: 4-8 hours for complete feature**

---

## 🎯 Success = These All Work

```
[ ] Agency appears in database after creating
[ ] Creators appear in database after adding
[ ] Can see 0 errors in browser console
[ ] Can see data in Supabase Table Editor
[ ] Can delete and it cascades correctly
[ ] Another test user can't see your data
[ ] Scans log to agency_scans table
[ ] Analytics snapshots record daily
[ ] Mobile view doesn't break
[ ] All 5 new nav items work
```

---

## 🚀 Ship It!

When all checkboxes above are ✅:

```
git commit -m "chore: Add Agency Search feature with Supabase backend"
git push origin main
Deploy to production
```

---

## 💬 Need Help?

1. **Setup question?** → Read SUPABASE_SETUP_GUIDE.md
2. **Code question?** → Read FRONTEND_SUPABASE_INTEGRATION.md
3. **Feature question?** → Read AGENCY_SEARCH_COMPLETE.md
4. **Timeline question?** → Read DEPLOYMENT_SUMMARY.md
5. **Quick answer?** → You're already reading it!

---

**Print this page. Check off each box. Ship it.**

🎉

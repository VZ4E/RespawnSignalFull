# 📤 Upload Everything to Supabase

**This is your ready-to-use package. Everything you need is here.**

---

## 🎯 What You're Uploading

### 1. **Database Schema** (Supabase SQL Editor)
📄 File: `SUPABASE_SCHEMA.sql`

Contains:
- 6 tables (agencies, agency_creators, agency_scans, creator_profiles, creator_alerts, analytics_snapshots)
- 20+ performance indexes
- Row-level security (RLS) policies on every table
- Auto-updating timestamps
- 2 views for analytics

**Action:** Copy entire file → Paste in Supabase SQL Editor → Click Run

---

### 2. **Updated Frontend** (Your Repo)
📄 File: `public/index.html`

Changes:
- Navigation reorganized
- Main section: Scanner, Scan History, All Deals
- **Tools section (NEW):**
  - Agency Search
  - Creator Profiles
  - Creator Radar
  - Analytics
  - Alerts
- Admin section: Automation, Groups, Credits, etc.

**Action:** Merge to main branch → Deploy as usual

---

## 🚀 Complete Step-by-Step

### **STEP 1: Run Database Schema** (5 minutes)

1. Go to https://supabase.com
2. Log in to your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Open `SUPABASE_SCHEMA.sql` in this folder
6. **Copy entire contents**
7. Paste into SQL Editor
8. Click **Run** button
9. Wait for ✅ "Success" message

**What you'll see:**
```
Creating table agencies...
Creating table agency_creators...
...
(25-30 messages)
...
Queries executed successfully (no errors)
```

✅ **Done!** Your database is ready.

---

### **STEP 2: Verify Database** (3 minutes)

1. In Supabase, click **Table Editor** in sidebar
2. Expand the list on left
3. Count these tables (should be 6):
   - [ ] agencies
   - [ ] agency_creators
   - [ ] agency_scans
   - [ ] creator_profiles
   - [ ] creator_alerts
   - [ ] analytics_snapshots

4. Click each table
5. Verify columns exist (don't need to count them all)

✅ **Done!** Database is verified.

---

### **STEP 3: Deploy Updated Frontend** (2 minutes)

1. In your code repo, update `public/index.html`
   - (Already updated if you're following this guide)

2. Check navigation section looks like:
   ```html
   <div class="nav-sec">Main</div>
   <div class="nav-item">Scanner</div>
   <div class="nav-item">Scan History</div>
   <div class="nav-item">All Deals</div>
   
   <div class="nav-sec">Tools</div>
   <div class="nav-item">Agency Search</div>
   <div class="nav-item">Creator Profiles</div>
   <div class="nav-item">Creator Radar</div>
   <div class="nav-item">Analytics</div>
   <div class="nav-item">Alerts</div>
   ```

3. Merge to main branch
4. Deploy to production

✅ **Done!** Frontend is live.

---

### **STEP 4: Get Supabase Credentials** (2 minutes)

1. Supabase dashboard → **Settings** (gear icon, bottom left)
2. Click **API** tab
3. You'll see:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** (a long key)
   - **service_role** (another key, keep private!)

4. Copy these values:
   - Save **Project URL** → `YOUR_SUPABASE_URL`
   - Save **anon public** → `YOUR_SUPABASE_ANON_KEY`

✅ **Done!** You have credentials.

---

### **STEP 5: Install & Initialize Supabase Client** (5 minutes)

In your project:

```bash
npm install @supabase/supabase-js
```

In your main app file (before `showApp()` or in a `setup()` function):

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xxxxx.supabase.co',  // YOUR_SUPABASE_URL
  'eyJ0eXAiOiJKV1QiLCJhbGc...'   // YOUR_SUPABASE_ANON_KEY
);

console.log('✅ Supabase client initialized');
```

✅ **Done!** Client is ready.

---

### **STEP 6: Connect Agency Search to Database** (1-2 hours)

Replace these functions in your code:

#### Save Agency (Create)
```javascript
async function saveAndScanAgency() {
  const { data, error } = await supabase
    .from('agencies')
    .insert([{
      name: agencySearchState.currentAgencyName,
      domain: extractDomain(agencySearchState.currentAgencyUrl),
      website_url: agencySearchState.currentAgencyUrl,
    }])
    .select();
  
  if (error) {
    console.error('Error:', error);
    showError('Failed to save agency');
    return;
  }
  
  const agencyId = data[0].id;
  await addCreatorsToAgency(agencyId);
  await loadAgencies();
}
```

#### Load Agencies (Read)
```javascript
async function loadAgencies() {
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  agencySearchState.agencies = data;
  renderAgencyCards();
}
```

#### Add Creators
```javascript
async function addCreatorsToAgency(agencyId) {
  const creatorData = Array.from(agencySearchState.selectedCreators)
    .map(handle => ({
      agency_id: agencyId,
      creator_handle: handle,
      platform: 'tiktok', // or current platform
      follower_count: 0, // or from API
    }));
  
  const { error } = await supabase
    .from('agency_creators')
    .insert(creatorData);
  
  if (error) console.error('Error:', error);
}
```

#### Delete Agency
```javascript
async function deleteAgency(agencyId) {
  if (!confirm('Delete this agency?')) return;
  
  const { error } = await supabase
    .from('agencies')
    .delete()
    .eq('id', agencyId);
  
  if (error) {
    console.error('Error:', error);
  } else {
    await loadAgencies();
  }
}
```

Call `loadAgencies()` when page loads:
```javascript
// On agency-search page init
navTo('agency-search', element);
await loadAgencies();
```

✅ **Done!** Database is connected.

---

### **STEP 7: Test End-to-End** (15 minutes)

```
[ ] Navigate to "Agency Search"
[ ] Click "+ Add Agency"
[ ] Enter "fashionworks.com" and "Fashion Works"
[ ] Click "Find Creators"
[ ] See mock creators (or real if you integrated discovery API)
[ ] Select 3 creators
[ ] Click "Continue"
[ ] See confirmation
[ ] Click "Save & Scan Now"
[ ] Should see agency appear in list
[ ] Verify in Supabase Table Editor → agencies table
[ ] Should see new row with your data
[ ] Verify in Supabase Table Editor → agency_creators table
[ ] Should see 3 creator rows linked to that agency
[ ] Click [Delete] on agency card
[ ] Confirm delete
[ ] Agency disappears from list
[ ] Verify it's gone from Supabase
[ ] Check that creators are also gone (cascade delete)
```

✅ **Done!** Everything works.

---

## 📚 Reference Files

| File | Purpose | When to Read |
|------|---------|--------------|
| **QUICK_REFERENCE.md** | One-page checklist | Now - quick overview |
| **SUPABASE_SCHEMA.sql** | Database schema | Upload to Supabase (Step 1) |
| **SUPABASE_SETUP_GUIDE.md** | Detailed setup | If you get stuck |
| **FRONTEND_SUPABASE_INTEGRATION.md** | Code samples | During Step 6 |
| **DEPLOYMENT_SUMMARY.md** | Full timeline | After all steps done |
| **AGENCY_SEARCH_COMPLETE.md** | Feature details | Reference for new pages |

---

## 🆘 Troubleshooting Quick Links

**Problem:** "RLS violation" when trying to save
**Solution:** Check user is logged in. Read: SUPABASE_SETUP_GUIDE.md → Row Level Security section

**Problem:** "Foreign key violation"
**Solution:** Create agency before adding creators. Check IDs match.

**Problem:** Data not appearing in table
**Solution:** Check browser console for errors. Verify auth.uid() matches.

**Problem:** Timestamps not updating
**Solution:** Run schema again. Triggers might not have created.

**Problem:** Navigation items not showing
**Solution:** Clear browser cache. Verify HTML was updated.

---

## ✅ Final Checklist

```
DATABASE SETUP
[ ] Schema uploaded to Supabase
[ ] All 6 tables exist
[ ] RLS policies created
[ ] No SQL errors

FRONTEND DEPLOYMENT  
[ ] Updated public/index.html merged
[ ] New nav items visible in app
[ ] Can click Agency Search link
[ ] Page loads without errors

INTEGRATION
[ ] Supabase client installed
[ ] Client initializes with credentials
[ ] Can create agency in UI
[ ] Can see agency in Supabase database
[ ] Can add creators to agency
[ ] Can delete agency (cascades)
[ ] No console errors
```

**All ✅?** You're ready to ship!

---

## 🎉 What You Just Deployed

- ✅ 6 database tables with 20+ indexes
- ✅ Complete row-level security
- ✅ Auto-timestamps and cascading deletes
- ✅ Updated navigation with 5 new tools
- ✅ Full agency management workflow
- ✅ Creator tracking and filtering
- ✅ Scan history and analytics ready
- ✅ Alert system foundation
- ✅ Production-ready database

---

## 📞 Next Steps

1. **This Week:**
   - Run schema (5 min)
   - Deploy frontend (2 min)
   - Integrate client (30 min)
   - Test CRUD (30 min)

2. **Next Week:**
   - Build creator discovery API
   - Wire up scan integration
   - Test bulk operations

3. **Following Week:**
   - Add analytics tracking
   - Build alert system
   - Polish UI/UX

---

## 🚀 Ship It!

You have everything needed. Follow the 7 steps above and you'll have a fully functional Agency Search with complete Supabase backend.

**Time to completion:** 2-3 hours

**Questions?** Reference files above.

**Ready?** Start with Step 1 → Done in 3 hours.

Good luck! 🎉

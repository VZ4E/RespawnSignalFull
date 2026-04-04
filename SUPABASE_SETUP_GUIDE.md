# 🗄️ Supabase Setup Guide - Agency Search Feature

Complete step-by-step instructions to set up the database for the Agency Search feature in Respawn Signal.

---

## 📋 Quick Summary

**What's included:**
- 6 main tables (agencies, agency_creators, agency_scans, creator_profiles, creator_alerts, analytics_snapshots)
- 20+ performance indexes
- Row-level security (RLS) policies for all tables
- Auto-updating timestamps
- 2 useful views for analytics
- All connections properly constrained

**Setup time:** ~5 minutes

---

## 🚀 Step 1: Access Supabase SQL Editor

1. Go to [https://supabase.com](https://supabase.com) and log in to your project
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query** button

---

## 📝 Step 2: Copy & Run the Schema

1. Open the file: `SUPABASE_SCHEMA.sql` in this directory
2. Copy **ALL** the SQL code
3. Paste it into the Supabase SQL Editor
4. Click **Run** button (or press `Ctrl+Enter`)

**Expected result:** ✅ No errors, all tables and policies created

---

## 🔍 Step 3: Verify Tables Created

In Supabase dashboard:

1. Go to **Table Editor** in the left sidebar
2. You should see these new tables:
   - `agencies`
   - `agency_creators`
   - `agency_scans`
   - `creator_profiles`
   - `creator_alerts`
   - `analytics_snapshots`

3. Click on each table to verify columns are correct

---

## 🔐 Step 4: Enable Row Level Security (Optional - Already Enabled)

The schema enables RLS automatically, but verify:

1. Go to **Authentication** → **Policies** in sidebar
2. Select each table and confirm "RLS is enabled" appears
3. Click on table name to see all policies

---

## 📊 Step 5: Test Data (Optional)

To add sample data for testing:

```sql
-- Add a test agency
INSERT INTO public.agencies (user_id, name, domain, website_url, industry, description)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),  -- Your user ID
  'Fashion Forward Collective',
  'fashionforward.com',
  'https://fashionforward.com',
  'Fashion & Beauty',
  'A collective of fashion creators'
);

-- Add creators to the agency
INSERT INTO public.agency_creators (agency_id, user_id, creator_handle, platform, follower_count, engagement_rate)
SELECT 
  a.id,
  a.user_id,
  'hotrodd',
  'tiktok',
  2500000,
  4.5
FROM public.agencies a
WHERE a.name = 'Fashion Forward Collective'
LIMIT 1;
```

---

## 🔌 Step 6: Connect from Frontend

Now your frontend can connect using Supabase client:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
);

// Example: Fetch all agencies for current user
const { data, error } = await supabase
  .from('agencies')
  .select('*')
  .eq('user_id', user.id);
```

---

## 📚 Table Reference

### 1. **agencies**
Stores agency information and metadata.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | Owner (FK: auth.users) |
| name | TEXT | Agency name |
| domain | TEXT | Domain (required, unique per user) |
| website_url | TEXT | Full URL |
| description | TEXT | Optional description |
| logo_url | TEXT | Optional logo |
| industry | TEXT | Optional (e.g., "Fashion", "Tech") |
| founded_year | INTEGER | Optional |
| employee_count | INTEGER | Optional |
| contact_email | TEXT | Optional |
| contact_phone | TEXT | Optional |
| created_at | TIMESTAMP | Auto-set on insert |
| updated_at | TIMESTAMP | Auto-updated |
| last_scan_at | TIMESTAMP | Updated when scanned |

**Indexes:** user_id, domain, created_at, last_scan_at

---

### 2. **agency_creators**
Junction table linking agencies to creators.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| agency_id | UUID | FK: agencies.id |
| user_id | UUID | FK: auth.users.id |
| creator_handle | TEXT | Handle without @ |
| platform | TEXT | tiktok, youtube, instagram, twitch |
| platform_url | TEXT | Full profile URL |
| follower_count | INTEGER | Latest count |
| engagement_rate | DECIMAL(5,2) | Percentage (e.g., 4.5) |
| last_scan_at | TIMESTAMP | When last scanned |
| status | TEXT | active, inactive, archived |
| notes | TEXT | Internal notes |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated |

**Indexes:** agency_id, user_id, platform, handle, status, last_scan_at

---

### 3. **agency_scans**
History of scans performed on agencies.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| agency_id | UUID | FK: agencies.id |
| user_id | UUID | FK: auth.users.id |
| scan_type | TEXT | full, creators_only, scheduled |
| creator_count | INTEGER | How many creators scanned |
| deals_found | INTEGER | Number of deals detected |
| status | TEXT | pending, running, completed, failed |
| error_message | TEXT | If status = failed |
| started_at | TIMESTAMP | When scan started |
| completed_at | TIMESTAMP | When scan finished |

**Indexes:** agency_id, user_id, status, started_at

---

### 4. **creator_profiles**
Master list of creators (denormalized for performance).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK: auth.users.id |
| creator_handle | TEXT | Unique handle |
| platform | TEXT | tiktok, youtube, instagram, twitch |
| platform_url | TEXT | Unique profile URL |
| follower_count | INTEGER | Latest follower count |
| engagement_rate | DECIMAL(5,2) | Percentage |
| average_views | INTEGER | Avg views per video |
| bio | TEXT | Creator bio |
| profile_image_url | TEXT | Avatar URL |
| verified_badge | BOOLEAN | Platform verified |
| last_fetched_at | TIMESTAMP | When data was refreshed |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated |

**Indexes:** user_id, platform, handle, verified, followers

---

### 5. **creator_alerts**
Alert configurations for creators/agencies.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK: auth.users.id |
| creator_id | UUID | FK: creator_profiles.id (optional) |
| agency_id | UUID | FK: agencies.id (optional) |
| alert_type | TEXT | deal_found, scan_complete, performance_change, follower_milestone |
| notification_method | TEXT | email, sms, push, in_app |
| is_active | BOOLEAN | Whether alert is on |
| threshold_value | TEXT | Trigger condition (JSON) |
| last_triggered_at | TIMESTAMP | When last fired |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated |

**Indexes:** user_id, creator_id, agency_id, alert_type, is_active

---

### 6. **analytics_snapshots**
Daily analytics metrics for trends.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK: auth.users.id |
| agency_id | UUID | FK: agencies.id (optional) |
| snapshot_date | DATE | Which day |
| metric_type | TEXT | total_creators, total_deals, avg_engagement, scan_count |
| metric_value | DECIMAL(12,2) | The metric value |
| created_at | TIMESTAMP | Auto-set |

**Indexes:** user_id, agency_id, snapshot_date, metric_type

---

## 🔐 Row Level Security (RLS) Policies

All tables have RLS enabled with these rules:

**SELECT:** Users can only see their own data (WHERE user_id = auth.uid())

**INSERT:** Users can only insert into their own records, with foreign key validation

**UPDATE:** Users can only update their own records

**DELETE:** Users can only delete their own records

This ensures complete data isolation between users.

---

## 🔗 API Endpoints Setup

Once tables are created, you can use Supabase Auto-API:

### Get All Agencies
```bash
GET /rest/v1/agencies?user_id=eq.{user_id}
```

### Add Agency
```bash
POST /rest/v1/agencies
{
  "name": "Fashion Forward",
  "domain": "fashionforward.com",
  "website_url": "https://..."
}
```

### Get Agency with Creators
```bash
GET /rest/v1/agency_summary?id=eq.{agency_id}
```

### Add Creator to Agency
```bash
POST /rest/v1/agency_creators
{
  "agency_id": "{agency_id}",
  "creator_handle": "hotrodd",
  "platform": "tiktok",
  "follower_count": 2500000
}
```

All endpoints automatically enforce RLS based on current user.

---

## 📊 Useful Views

Two views are created for common queries:

### `agency_summary`
Shows agency with aggregated creator stats:
- creator_count
- max_follower_creator
- avg_engagement_rate
- last_scan_at

### `creator_metrics`
Shows creator with agency count and scan history:
- follower_count
- engagement_rate
- in_agencies (how many agencies they're in)
- last_scan_at

Use in queries:
```sql
SELECT * FROM agency_summary WHERE user_id = auth.uid();
```

---

## 🆘 Troubleshooting

**Q: "RLS violation" error when querying**
- A: Make sure you're authenticated and the `user_id` matches your auth user
- Add `.eq('user_id', userId)` to your query

**Q: Tables not appearing**
- A: Refresh the page, or check for SQL errors in execution log
- Run schema again to verify

**Q: "Foreign key violation"**
- A: Ensure parent record exists before adding child records
- For example, create agency before adding creators

**Q: Timestamps not updating**
- A: Check that triggers were created (they are if no SQL errors)
- Manually verify with: `SELECT updated_at FROM agencies WHERE id = 'xxx'`

---

## 🎉 You're Ready!

The database is now fully set up. You can:

1. ✅ Create agencies from the UI
2. ✅ Add creators to agencies
3. ✅ Track scan history
4. ✅ Set up alerts
5. ✅ View analytics

Next steps:
- Connect frontend to Supabase client
- Update Agency Search modal to POST to `/agencies`
- Wire up creator discovery API
- Implement scan queue

---

## 📄 Files Reference

- **SUPABASE_SCHEMA.sql** — Full SQL schema (run this first)
- **SUPABASE_SETUP_GUIDE.md** — This file
- **public/index.html** — Updated with navigation links
- **AGENCY_SEARCH_COMPLETE.md** — Frontend implementation details

---

Questions? Check the Supabase docs: https://supabase.com/docs

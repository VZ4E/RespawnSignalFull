# Database Migrations

## How to Apply Migrations

### Using Supabase Dashboard (Easiest)
1. Go to https://app.supabase.com
2. Select your project (RespawnSignal)
3. Go to SQL Editor
4. Click "New Query"
5. Copy the contents of the migration file from `migrations/` directory
6. Click "Run"

### Migrations List

#### create_brand_reports_table.sql
Creates the `brand_reports` table for storing generated brand intelligence reports.

**What it does:**
- Creates `brand_reports` table with user_id, brand_name, format, stats, and content
- Adds indexes for user_id, brand_name, and created_at
- Enables RLS with policies for users to manage their own reports
- Stores full report JSON in `content` field

**To apply:**
1. Open Supabase dashboard SQL Editor
2. Copy entire contents of `migrations/create_brand_reports_table.sql`
3. Run the query
4. Verify: Go to Table Editor and confirm `brand_reports` table exists

**Status:** ⏳ Awaiting manual application in Supabase dashboard

## Future Migrations

Additional migrations for:
- Report sharing and permissions
- Report analytics and metrics
- Archived reports

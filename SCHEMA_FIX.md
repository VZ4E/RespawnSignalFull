# Schema Fix Required

## Problem
The `scans` table is missing the `videos` JSONB column, causing HTTP 400 errors when saving manual analyses.

**Error:** `Could not find the 'videos' column of 'scans' in the schema cache`

## Solution

Go to your Supabase dashboard and run this SQL in the **SQL Editor**:

```sql
ALTER TABLE scans ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]';
```

### Steps:
1. Open https://app.supabase.com
2. Log in to your project
3. Go to **SQL Editor** (left sidebar)
4. Click **+ New Query**
5. Paste the SQL above
6. Click **Run** (Cmd/Ctrl + Enter)
7. You should see: `Query executed successfully`

## Verification

Run this to confirm:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'scans';
```

You should see a row for `videos | jsonb`

---

After the fix:
- Manual link analysis will save to database ✅
- Schema cache will refresh automatically
- Restart the backend server if you want to force immediate cache refresh:
  ```bash
  npm run dev  # or equivalent
  ```

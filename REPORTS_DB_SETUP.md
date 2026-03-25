# Reports Database Setup

Run this SQL in your Supabase SQL Editor to create the reports_log table:

```sql
CREATE TABLE IF NOT EXISTS reports_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_handle TEXT NOT NULL,
  platform TEXT NOT NULL,
  email TEXT NOT NULL,
  deals_count INTEGER DEFAULT 0,
  scans_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_created ON reports_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports_log(status);
```

Then update your Railway environment:
```
RESEND_API_KEY=re_f9hAZPKp_MKQ4EMQHMhF62dZaFcbjAu2M
```

That's it! The Reports tab should now work.

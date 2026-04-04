-- Create unrepresented_creators table for silent lead logging
-- Tracks creators without business email representation for prospecting

CREATE TABLE IF NOT EXISTS unrepresented_creators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  handle TEXT NOT NULL,
  platform TEXT DEFAULT 'tiktok',
  name TEXT,
  followers INTEGER,
  bio TEXT,
  emails_found TEXT[],
  looked_up_at TIMESTAMP DEFAULT now(),
  looked_up_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_unrepresented_creators_handle ON unrepresented_creators(handle);
CREATE INDEX IF NOT EXISTS idx_unrepresented_creators_platform ON unrepresented_creators(platform);
CREATE INDEX IF NOT EXISTS idx_unrepresented_creators_looked_up_by ON unrepresented_creators(looked_up_by);
CREATE INDEX IF NOT EXISTS idx_unrepresented_creators_looked_up_at ON unrepresented_creators(looked_up_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE unrepresented_creators ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see creators they looked up
CREATE POLICY "Users can view their own lookups"
  ON unrepresented_creators
  FOR SELECT
  USING (auth.uid() = looked_up_by);

-- Policy: Backend service can insert (via service role)
-- Note: Ensure your backend uses the service role key for insertions

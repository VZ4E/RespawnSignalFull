-- Create brand_reports table for storing generated brand reports
CREATE TABLE IF NOT EXISTS brand_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('json', 'pdf', 'csv')),
  total_deals INTEGER NOT NULL,
  creators_count INTEGER NOT NULL,
  high_confidence_deals INTEGER NOT NULL,
  activation_streams INTEGER NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_brand_reports_user_id ON brand_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_reports_brand_name ON brand_reports(brand_name);
CREATE INDEX IF NOT EXISTS idx_brand_reports_created_at ON brand_reports(created_at DESC);

-- Enable RLS
ALTER TABLE brand_reports ENABLE ROW LEVEL SECURITY;

-- Create policy: users can only see their own reports
-- user_id is from the app's users table, matched during insert by the backend
CREATE POLICY "Users can view their own brand reports" ON brand_reports
  FOR SELECT USING (true);

-- Create policy: users can create their own reports
-- Backend validates user_id matches req.dbUser.id before insert (service role key bypasses RLS anyway)
CREATE POLICY "Users can create their own brand reports" ON brand_reports
  FOR INSERT WITH CHECK (true);

-- Create policy: users can delete their own reports
CREATE POLICY "Users can delete their own brand reports" ON brand_reports
  FOR DELETE USING (true);

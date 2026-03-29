-- Add notification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_on_deals BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_on_every_deal BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_on_low_credits BOOLEAN DEFAULT true;

-- Create notifications_log table to track notification history
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'scan_complete', 'deal_found', 'low_credits', 'group_scan_complete'
  platform TEXT, -- 'tiktok', 'youtube', 'instagram', 'twitch'
  creator_handle TEXT,
  deals_found INTEGER DEFAULT 0,
  scan_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_to_slack BOOLEAN DEFAULT false,
  sent_to_email BOOLEAN DEFAULT false,
  created_at_idx TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications_log(created_at DESC);

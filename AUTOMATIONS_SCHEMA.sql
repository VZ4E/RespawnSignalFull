-- Automations table schema
-- Run this in Supabase SQL editor once to set up automations feature

CREATE TABLE automations (
 id BIGSERIAL PRIMARY KEY,
 user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 creator_username VARCHAR(100) NOT NULL,
 platform VARCHAR(20) DEFAULT 'tiktok',
 frequency VARCHAR(20) NOT NULL, -- 'twice_weekly', 'weekly', 'biweekly', 'monthly'
 email VARCHAR(255) NOT NULL,
 last_run_at TIMESTAMP,
 last_deals JSONB DEFAULT '[]',
 next_run_at TIMESTAMP,
 active BOOLEAN DEFAULT true,
 created_at TIMESTAMP DEFAULT NOW(),
 updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient cron queries (find due automations)
CREATE INDEX idx_automations_next_run_active ON automations(next_run_at, active)
  WHERE active = true;

-- Index for user automations queries
CREATE INDEX idx_automations_user_id ON automations(user_id);

-- Index for finding automations by user + creator
CREATE UNIQUE INDEX idx_automations_user_creator ON automations(user_id, creator_username)
  WHERE active = true;

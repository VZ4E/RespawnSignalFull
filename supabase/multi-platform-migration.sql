-- Multi-Platform Creator Management Schema
-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS scan_results CASCADE;
DROP TABLE IF EXISTS scanned_videos CASCADE;
DROP TABLE IF EXISTS config_members CASCADE;
DROP TABLE IF EXISTS scan_configs CASCADE;
DROP TABLE IF EXISTS creator_accounts CASCADE;
DROP TABLE IF EXISTS creators CASCADE;
DROP TABLE IF EXISTS creator_shares CASCADE;

-- 1. creators (user's creator list)
CREATE TABLE creators (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  notes TEXT,
  is_agency BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_creators_user_id ON creators(user_id);

-- 2. creator_accounts (platform-specific handles)
CREATE TABLE creator_accounts (
  id BIGSERIAL PRIMARY KEY,
  creator_id BIGINT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'tiktok', 'youtube', 'twitch', 'instagram'
  handle TEXT NOT NULL,
  platform_id TEXT NOT NULL, -- YouTube channel ID, TikTok user ID, Twitch user ID, etc.
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, platform)
);
CREATE INDEX idx_creator_accounts_creator_id ON creator_accounts(creator_id);
CREATE INDEX idx_creator_accounts_platform ON creator_accounts(platform);
CREATE INDEX idx_creator_accounts_platform_id ON creator_accounts(platform_id);

-- 3. scan_configs (named bundles for bulk scanning)
CREATE TABLE scan_configs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_agency BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
CREATE INDEX idx_scan_configs_user_id ON scan_configs(user_id);

-- 4. config_members (creators in each config)
CREATE TABLE config_members (
  config_id BIGINT NOT NULL REFERENCES scan_configs(id) ON DELETE CASCADE,
  creator_account_id BIGINT NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (config_id, creator_account_id)
);
CREATE INDEX idx_config_members_config_id ON config_members(config_id);
CREATE INDEX idx_config_members_creator_account_id ON config_members(creator_account_id);

-- 5. scanned_videos (track what we've already processed)
CREATE TABLE scanned_videos (
  id BIGSERIAL PRIMARY KEY,
  creator_account_id BIGINT NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT,
  video_url TEXT,
  last_scanned_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_account_id, video_id)
);
CREATE INDEX idx_scanned_videos_creator_account_id ON scanned_videos(creator_account_id);
CREATE INDEX idx_scanned_videos_platform ON scanned_videos(platform);

-- 6. scan_results (deals per video)
CREATE TABLE scan_results (
  id BIGSERIAL PRIMARY KEY,
  scanned_video_id BIGINT NOT NULL REFERENCES scanned_videos(id) ON DELETE CASCADE,
  deals JSONB DEFAULT '[]'::jsonb,
  dedupe_group_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_scan_results_scanned_video_id ON scan_results(scanned_video_id);
CREATE INDEX idx_scan_results_dedupe_group_id ON scan_results(dedupe_group_id);

-- 7. creator_shares (public shareable links)
CREATE TABLE creator_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id BIGINT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_creator_shares_creator_id ON creator_shares(creator_id);
CREATE INDEX idx_creator_shares_created_by ON creator_shares(created_by);

-- RLS Policies
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_shares ENABLE ROW LEVEL SECURITY;

-- Creators: Users see only their own
CREATE POLICY "Users can see their own creators" ON creators
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own creators" ON creators
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own creators" ON creators
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own creators" ON creators
  FOR DELETE USING (auth.uid() = user_id);

-- Creator Accounts: Via creator_id relationship
CREATE POLICY "Users can see their creator accounts" ON creator_accounts
  FOR SELECT USING (
    creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert creator accounts" ON creator_accounts
  FOR INSERT WITH CHECK (
    creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can update their creator accounts" ON creator_accounts
  FOR UPDATE USING (
    creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can delete their creator accounts" ON creator_accounts
  FOR DELETE USING (
    creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
  );

-- Scan Configs: Users see only their own
CREATE POLICY "Users can see their scan configs" ON scan_configs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert scan configs" ON scan_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their scan configs" ON scan_configs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their scan configs" ON scan_configs
  FOR DELETE USING (auth.uid() = user_id);

-- Config Members: Via config_id relationship
CREATE POLICY "Users can see their config members" ON config_members
  FOR SELECT USING (
    config_id IN (SELECT id FROM scan_configs WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can manage their config members" ON config_members
  FOR INSERT WITH CHECK (
    config_id IN (SELECT id FROM scan_configs WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can delete their config members" ON config_members
  FOR DELETE USING (
    config_id IN (SELECT id FROM scan_configs WHERE user_id = auth.uid())
  );

-- Scanned Videos & Results: Via creator_accounts relationship
CREATE POLICY "Users can see their scanned videos" ON scanned_videos
  FOR SELECT USING (
    creator_account_id IN (
      SELECT id FROM creator_accounts WHERE creator_id IN 
      (SELECT id FROM creators WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Users can insert scanned videos" ON scanned_videos
  FOR INSERT WITH CHECK (
    creator_account_id IN (
      SELECT id FROM creator_accounts WHERE creator_id IN 
      (SELECT id FROM creators WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can see their scan results" ON scan_results
  FOR SELECT USING (
    scanned_video_id IN (
      SELECT id FROM scanned_videos WHERE creator_account_id IN 
      (SELECT id FROM creator_accounts WHERE creator_id IN 
      (SELECT id FROM creators WHERE user_id = auth.uid()))
    )
  );
CREATE POLICY "Users can insert scan results" ON scan_results
  FOR INSERT WITH CHECK (
    scanned_video_id IN (
      SELECT id FROM scanned_videos WHERE creator_account_id IN 
      (SELECT id FROM creator_accounts WHERE creator_id IN 
      (SELECT id FROM creators WHERE user_id = auth.uid()))
    )
  );

-- Creator Shares: Users see their own, anyone can view via shared link
CREATE POLICY "Users can see their shares" ON creator_shares
  FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can create shares" ON creator_shares
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can delete their shares" ON creator_shares
  FOR DELETE USING (auth.uid() = created_by);

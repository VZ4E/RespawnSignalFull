-- ═══════════════════════════════════════════════════════════════════════════
-- SIGNAL — SUPABASE SCHEMA SETUP
-- Run this in your Supabase SQL editor to create all tables + RLS policies
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. AGENCIES TABLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agencies_user_id ON public.agencies(user_id);

-- RLS: Users can only see/edit their own agencies
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agencies"
  ON public.agencies
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agencies"
  ON public.agencies
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agencies"
  ON public.agencies
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agencies"
  ON public.agencies
  FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. AGENCY_CREATORS TABLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  name TEXT,
  bio TEXT,
  platform TEXT[],
  niche TEXT DEFAULT 'Uncategorized',
  follower_count BIGINT,
  follower_count_formatted TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  description TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agency_creators_agency_id ON public.agency_creators(agency_id);
CREATE INDEX idx_agency_creators_user_id ON public.agency_creators(user_id);
CREATE INDEX idx_agency_creators_niche ON public.agency_creators(niche);
CREATE INDEX idx_agency_creators_handle ON public.agency_creators(handle);

-- RLS: Users can only see creators from their own agencies
ALTER TABLE public.agency_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view creators from their agencies"
  ON public.agency_creators
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert creators to their agencies"
  ON public.agency_creators
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their creators"
  ON public.agency_creators
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their creators"
  ON public.agency_creators
  FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. CREATOR_WATCHLIST TABLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.creator_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.agency_creators(id) ON DELETE CASCADE,
  notes TEXT,
  priority INTEGER DEFAULT 0,  -- 0=normal, 1=high, -1=low
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, creator_id)
);

CREATE INDEX idx_watchlist_user_id ON public.creator_watchlist(user_id);
CREATE INDEX idx_watchlist_creator_id ON public.creator_watchlist(creator_id);

-- RLS: Users can only see their own watchlist
ALTER TABLE public.creator_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their watchlist"
  ON public.creator_watchlist
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to watchlist"
  ON public.creator_watchlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update watchlist"
  ON public.creator_watchlist
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove from watchlist"
  ON public.creator_watchlist
  FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. CREATOR_GROUPS TABLE (for group scans)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.creator_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  scan_status TEXT DEFAULT 'pending',  -- pending, running, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_groups_user_id ON public.creator_groups(user_id);
CREATE INDEX idx_groups_status ON public.creator_groups(scan_status);

-- RLS: Users can only see/edit their own groups
ALTER TABLE public.creator_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their groups"
  ON public.creator_groups
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create groups"
  ON public.creator_groups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their groups"
  ON public.creator_groups
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their groups"
  ON public.creator_groups
  FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. GROUP_CREATORS TABLE (many-to-many)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.creator_groups(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.agency_creators(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, creator_id)
);

CREATE INDEX idx_group_creators_group_id ON public.group_creators(group_id);
CREATE INDEX idx_group_creators_creator_id ON public.group_creators(creator_id);

-- RLS: Allow access via group (which is already RLS protected)
ALTER TABLE public.group_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view group creators via groups"
  ON public.group_creators
  FOR SELECT
  USING (
    group_id IN (
      SELECT id FROM public.creator_groups WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add creators to their groups"
  ON public.group_creators
  FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT id FROM public.creator_groups WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove creators from their groups"
  ON public.group_creators
  FOR DELETE
  USING (
    group_id IN (
      SELECT id FROM public.creator_groups WHERE user_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 6. CREATOR_ALERTS TABLE (for post/deal detection)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.creator_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.agency_creators(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,  -- 'new_post', 'brand_mention', 'deal_detected', etc.
  title TEXT NOT NULL,
  description TEXT,
  post_url TEXT,
  post_id TEXT,
  confidence FLOAT DEFAULT 1.0,  -- 0-1 confidence score
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_id ON public.creator_alerts(user_id);
CREATE INDEX idx_alerts_creator_id ON public.creator_alerts(creator_id);
CREATE INDEX idx_alerts_read ON public.creator_alerts(read);
CREATE INDEX idx_alerts_type ON public.creator_alerts(alert_type);

-- RLS: Users can only see their own alerts
ALTER TABLE public.creator_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their alerts"
  ON public.creator_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update alert read status"
  ON public.creator_alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete alerts"
  ON public.creator_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. SCAN_JOBS TABLE (for tracking background scan jobs)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.creator_groups(id) ON DELETE CASCADE,
  job_status TEXT DEFAULT 'queued',  -- queued, running, completed, failed
  created_creators BIGINT DEFAULT 0,
  alerts_created BIGINT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_scan_jobs_user_id ON public.scan_jobs(user_id);
CREATE INDEX idx_scan_jobs_status ON public.scan_jobs(job_status);
CREATE INDEX idx_scan_jobs_group_id ON public.scan_jobs(group_id);

-- RLS: Users can only see their own jobs
ALTER TABLE public.scan_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their scan jobs"
  ON public.scan_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 8. USER_SETTINGS TABLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_alerts BOOLEAN DEFAULT TRUE,
  alert_frequency TEXT DEFAULT 'realtime',  -- realtime, daily, weekly
  preferred_niches TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can only see/edit their own settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their settings"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = id);

-- ───────────────────────────────────────────────────────────────────────────
-- 9. CREATE VIEW: User Creator Stats (for dashboard)
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.user_creator_stats AS
SELECT
  ac.user_id,
  COUNT(DISTINCT ac.id) as total_creators,
  COUNT(DISTINCT ac.agency_id) as total_agencies,
  COUNT(DISTINCT cw.id) as watchlist_count,
  COUNT(DISTINCT CASE WHEN ac.niche != 'Uncategorized' THEN ac.niche END) as unique_niches,
  SUM(ac.follower_count) as total_followers
FROM public.agency_creators ac
LEFT JOIN public.creator_watchlist cw ON ac.id = cw.creator_id
GROUP BY ac.user_id;

-- ───────────────────────────────────────────────────────────────────────────
-- 10. FUNCTIONS & TRIGGERS
-- ───────────────────────────────────────────────────────────────────────────

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for agencies table
CREATE TRIGGER update_agencies_timestamp
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- Trigger for agency_creators table
CREATE TRIGGER update_agency_creators_timestamp
  BEFORE UPDATE ON public.agency_creators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- Trigger for creator_groups table
CREATE TRIGGER update_creator_groups_timestamp
  BEFORE UPDATE ON public.creator_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- Trigger for user_settings table
CREATE TRIGGER update_user_settings_timestamp
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- Function: Create user settings on signup
CREATE OR REPLACE FUNCTION public.create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auth.users (on signup)
CREATE TRIGGER create_settings_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_settings();

-- ───────────────────────────────────────────────────────────────────────────
-- DONE! Database is ready.
-- ───────────────────────────────────────────────────────────────────────────

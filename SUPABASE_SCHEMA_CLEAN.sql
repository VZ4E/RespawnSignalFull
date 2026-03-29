-- RESPAWN SIGNAL - SUPABASE SCHEMA (CLEAN VERSION)
-- Agency Search Feature Complete Setup

-- 1. AGENCIES TABLE
CREATE TABLE IF NOT EXISTS public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  website_url TEXT,
  description TEXT,
  logo_url TEXT,
  industry TEXT,
  founded_year INTEGER,
  employee_count INTEGER,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_scan_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_agency_per_user UNIQUE(user_id, domain)
);

-- 2. AGENCY_CREATORS TABLE
CREATE TABLE IF NOT EXISTS public.agency_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_handle TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'youtube', 'instagram', 'twitch')),
  platform_url TEXT,
  follower_count INTEGER,
  engagement_rate DECIMAL(5,2),
  last_scan_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_creator_per_agency UNIQUE(agency_id, creator_handle, platform)
);

-- 3. AGENCY_SCANS TABLE
CREATE TABLE IF NOT EXISTS public.agency_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('full', 'creators_only', 'scheduled')),
  creator_count INTEGER,
  deals_found INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. CREATOR_PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_handle TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'youtube', 'instagram', 'twitch')),
  platform_url TEXT,
  follower_count INTEGER,
  engagement_rate DECIMAL(5,2),
  average_views INTEGER,
  bio TEXT,
  profile_image_url TEXT,
  verified_badge BOOLEAN DEFAULT FALSE,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_profile UNIQUE(user_id, creator_handle, platform)
);

-- 5. CREATOR_ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.creator_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('deal_found', 'scan_complete', 'performance_change', 'follower_milestone')),
  notification_method TEXT CHECK (notification_method IN ('email', 'sms', 'push', 'in_app')),
  is_active BOOLEAN DEFAULT TRUE,
  threshold_value TEXT,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ANALYTICS_SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('total_creators', 'total_deals', 'avg_engagement', 'scan_count')),
  metric_value DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_daily_metric UNIQUE(user_id, agency_id, snapshot_date, metric_type)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_agencies_user_id ON public.agencies(user_id);
CREATE INDEX IF NOT EXISTS idx_agencies_domain ON public.agencies(domain);
CREATE INDEX IF NOT EXISTS idx_agencies_created_at ON public.agencies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agencies_last_scan ON public.agencies(last_scan_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_creators_agency_id ON public.agency_creators(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_creators_user_id ON public.agency_creators(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_creators_platform ON public.agency_creators(platform);
CREATE INDEX IF NOT EXISTS idx_agency_creators_handle ON public.agency_creators(creator_handle);
CREATE INDEX IF NOT EXISTS idx_agency_creators_status ON public.agency_creators(status);
CREATE INDEX IF NOT EXISTS idx_agency_creators_last_scan ON public.agency_creators(last_scan_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_scans_agency_id ON public.agency_scans(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_scans_user_id ON public.agency_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_scans_status ON public.agency_scans(status);
CREATE INDEX IF NOT EXISTS idx_agency_scans_created_at ON public.agency_scans(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id ON public.creator_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_platform ON public.creator_profiles(platform);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_handle ON public.creator_profiles(creator_handle);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_verified ON public.creator_profiles(verified_badge);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_followers ON public.creator_profiles(follower_count DESC);

CREATE INDEX IF NOT EXISTS idx_creator_alerts_user_id ON public.creator_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_alerts_creator_id ON public.creator_alerts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_alerts_agency_id ON public.creator_alerts(agency_id);
CREATE INDEX IF NOT EXISTS idx_creator_alerts_type ON public.creator_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_creator_alerts_active ON public.creator_alerts(is_active);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_id ON public.analytics_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_agency_id ON public.analytics_snapshots(agency_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON public.analytics_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_metric ON public.analytics_snapshots(metric_type);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- DROP EXISTING POLICIES (if any)
DROP POLICY IF EXISTS agencies_select_own ON public.agencies;
DROP POLICY IF EXISTS agencies_insert_own ON public.agencies;
DROP POLICY IF EXISTS agencies_update_own ON public.agencies;
DROP POLICY IF EXISTS agencies_delete_own ON public.agencies;

DROP POLICY IF EXISTS agency_creators_select_own ON public.agency_creators;
DROP POLICY IF EXISTS agency_creators_insert_own ON public.agency_creators;
DROP POLICY IF EXISTS agency_creators_update_own ON public.agency_creators;
DROP POLICY IF EXISTS agency_creators_delete_own ON public.agency_creators;

DROP POLICY IF EXISTS agency_scans_select_own ON public.agency_scans;
DROP POLICY IF EXISTS agency_scans_insert_own ON public.agency_scans;
DROP POLICY IF EXISTS agency_scans_update_own ON public.agency_scans;

DROP POLICY IF EXISTS creator_profiles_select_own ON public.creator_profiles;
DROP POLICY IF EXISTS creator_profiles_insert_own ON public.creator_profiles;
DROP POLICY IF EXISTS creator_profiles_update_own ON public.creator_profiles;
DROP POLICY IF EXISTS creator_profiles_delete_own ON public.creator_profiles;

DROP POLICY IF EXISTS creator_alerts_select_own ON public.creator_alerts;
DROP POLICY IF EXISTS creator_alerts_insert_own ON public.creator_alerts;
DROP POLICY IF EXISTS creator_alerts_update_own ON public.creator_alerts;
DROP POLICY IF EXISTS creator_alerts_delete_own ON public.creator_alerts;

DROP POLICY IF EXISTS analytics_snapshots_select_own ON public.analytics_snapshots;
DROP POLICY IF EXISTS analytics_snapshots_insert_own ON public.analytics_snapshots;
DROP POLICY IF EXISTS analytics_snapshots_update_own ON public.analytics_snapshots;

-- CREATE POLICIES FOR AGENCIES
CREATE POLICY agencies_select_own 
  ON public.agencies 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY agencies_insert_own 
  ON public.agencies 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY agencies_update_own 
  ON public.agencies 
  FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY agencies_delete_own 
  ON public.agencies 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- CREATE POLICIES FOR AGENCY_CREATORS
CREATE POLICY agency_creators_select_own 
  ON public.agency_creators 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY agency_creators_insert_own 
  ON public.agency_creators 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY agency_creators_update_own 
  ON public.agency_creators 
  FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY agency_creators_delete_own 
  ON public.agency_creators 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- CREATE POLICIES FOR AGENCY_SCANS
CREATE POLICY agency_scans_select_own 
  ON public.agency_scans 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY agency_scans_insert_own 
  ON public.agency_scans 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY agency_scans_update_own 
  ON public.agency_scans 
  FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- CREATE POLICIES FOR CREATOR_PROFILES
CREATE POLICY creator_profiles_select_own 
  ON public.creator_profiles 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY creator_profiles_insert_own 
  ON public.creator_profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY creator_profiles_update_own 
  ON public.creator_profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY creator_profiles_delete_own 
  ON public.creator_profiles 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- CREATE POLICIES FOR CREATOR_ALERTS
CREATE POLICY creator_alerts_select_own 
  ON public.creator_alerts 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY creator_alerts_insert_own 
  ON public.creator_alerts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY creator_alerts_update_own 
  ON public.creator_alerts 
  FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY creator_alerts_delete_own 
  ON public.creator_alerts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- CREATE POLICIES FOR ANALYTICS_SNAPSHOTS
CREATE POLICY analytics_snapshots_select_own 
  ON public.analytics_snapshots 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY analytics_snapshots_insert_own 
  ON public.analytics_snapshots 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY analytics_snapshots_update_own 
  ON public.analytics_snapshots 
  FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- AUTO-UPDATE TRIGGERS
DROP TRIGGER IF EXISTS update_agencies_updated_at ON public.agencies;
DROP TRIGGER IF EXISTS update_agency_creators_updated_at ON public.agency_creators;
DROP TRIGGER IF EXISTS update_agency_scans_updated_at ON public.agency_scans;
DROP TRIGGER IF EXISTS update_creator_profiles_updated_at ON public.creator_profiles;
DROP TRIGGER IF EXISTS update_creator_alerts_updated_at ON public.creator_alerts;
DROP TRIGGER IF EXISTS update_analytics_snapshots_updated_at ON public.analytics_snapshots;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agencies_updated_at 
  BEFORE UPDATE ON public.agencies 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agency_creators_updated_at 
  BEFORE UPDATE ON public.agency_creators 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agency_scans_updated_at 
  BEFORE UPDATE ON public.agency_scans 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_profiles_updated_at 
  BEFORE UPDATE ON public.creator_profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_alerts_updated_at 
  BEFORE UPDATE ON public.creator_alerts 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analytics_snapshots_updated_at 
  BEFORE UPDATE ON public.analytics_snapshots 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

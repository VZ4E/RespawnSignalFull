-- Respawn Signal — Groups Feature Migration
-- Run this in your Supabase project SQL editor

-- Create creator_groups table
CREATE TABLE IF NOT EXISTS creator_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creator_groups_user_id ON creator_groups(user_id);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES creator_groups(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, platform, handle)
);

CREATE INDEX idx_group_members_group_id ON group_members(group_id);

-- Create bulk_scans table
CREATE TABLE IF NOT EXISTS bulk_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES creator_groups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  results JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bulk_scans_user_id ON bulk_scans(user_id);
CREATE INDEX idx_bulk_scans_group_id ON bulk_scans(group_id);
CREATE INDEX idx_bulk_scans_status ON bulk_scans(status);

-- Add column to scans table to link to group (if not exists)
ALTER TABLE scans ADD COLUMN group_id UUID REFERENCES creator_groups(id) ON DELETE SET NULL;
ALTER TABLE scans ADD COLUMN bulk_scan_id UUID REFERENCES bulk_scans(id) ON DELETE SET NULL;

CREATE INDEX idx_scans_group_id ON scans(group_id);
CREATE INDEX idx_scans_bulk_scan_id ON scans(bulk_scan_id);

-- Row Level Security Policies

-- creator_groups: Users can only access their own groups
ALTER TABLE creator_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own groups" ON creator_groups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own groups" ON creator_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups" ON creator_groups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups" ON creator_groups
  FOR DELETE USING (auth.uid() = user_id);

-- group_members: Users can access members of their own groups
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their groups" ON group_members
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM creator_groups WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert members to their groups" ON group_members
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT id FROM creator_groups WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete members from their groups" ON group_members
  FOR DELETE USING (
    group_id IN (
      SELECT id FROM creator_groups WHERE user_id = auth.uid()
    )
  );

-- bulk_scans: Users can only access their own scans
ALTER TABLE bulk_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scans" ON bulk_scans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scans" ON bulk_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scans" ON bulk_scans
  FOR UPDATE USING (auth.uid() = user_id);

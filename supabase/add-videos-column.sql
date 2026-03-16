-- Fix: Add missing videos column to scans table
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new

ALTER TABLE scans ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]';

-- Verify it was created:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'scans'
ORDER BY ordinal_position;

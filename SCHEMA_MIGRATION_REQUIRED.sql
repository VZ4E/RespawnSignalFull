-- Schema Migration Required for Creator Info Feature
-- Run this in Supabase SQL Editor to enable business_email and bio_links storage
-- Date: 2026-04-04

-- Add business_email column to scans table
ALTER TABLE scans ADD COLUMN IF NOT EXISTS business_email text;

-- Add bio_links column to scans table (array of URLs)
ALTER TABLE scans ADD COLUMN IF NOT EXISTS bio_links text[];

-- Verify the columns were added
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'scans' AND column_name IN ('business_email', 'bio_links');

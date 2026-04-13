-- Add ticket selection columns to standups table
-- Stores arrays of ticket IDs selected for each standup section
ALTER TABLE standups ADD COLUMN IF NOT EXISTS yesterday_tickets jsonb DEFAULT '[]';
ALTER TABLE standups ADD COLUMN IF NOT EXISTS today_tickets jsonb DEFAULT '[]';
ALTER TABLE standups ADD COLUMN IF NOT EXISTS blocker_tickets jsonb DEFAULT '[]';

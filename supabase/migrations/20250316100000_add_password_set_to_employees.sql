-- Add password_set column to employees table
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS password_set boolean DEFAULT true;

-- Mark existing users as having their password set (they're already active)
UPDATE employees SET password_set = true WHERE password_set IS NULL;

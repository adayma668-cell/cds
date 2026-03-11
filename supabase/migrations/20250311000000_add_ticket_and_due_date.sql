-- Add ticket_number and due_date to standups table
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query

ALTER TABLE standups
ADD COLUMN IF NOT EXISTS ticket_number text,
ADD COLUMN IF NOT EXISTS due_date date;

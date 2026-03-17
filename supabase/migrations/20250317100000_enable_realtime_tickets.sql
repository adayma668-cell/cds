-- ============================================================
-- RUN THIS IN SUPABASE:
-- Go to Supabase Dashboard -> SQL Editor -> New Query
-- Paste this entire file and click "Run"
-- ============================================================

-- Enable realtime for the tickets table so admin dashboard auto-updates
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;

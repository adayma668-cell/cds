-- Track whether a standup has been presented in a meeting session.
-- After a meeting finishes, presented standups are marked true so
-- the next session starts with a clean slate.
ALTER TABLE standups ADD COLUMN IF NOT EXISTS presented BOOLEAN DEFAULT FALSE;

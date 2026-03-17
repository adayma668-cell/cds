-- ============================================================
-- RUN THIS IN SUPABASE:
-- Go to Supabase Dashboard -> SQL Editor -> New Query
-- Paste this entire file and click "Run"
-- ============================================================

-- Audit trail table for tracking all changes across the application
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text        NOT NULL,
  entity_id   text        NOT NULL,
  action      text        NOT NULL,
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name  text,
  old_data    jsonb,
  new_data    jsonb,
  changes     jsonb,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_logs (actor_id);
CREATE INDEX idx_audit_time   ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs (entity_type, action);

-- Keep the complete pre-simplification workspace for recovery.
CREATE TABLE IF NOT EXISTS wedding.workspace_backups (
  name text PRIMARY KEY,
  version bigint NOT NULL,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO wedding.workspace_backups(name, version, body)
SELECT 'before-simple-planner-v2', version, body FROM wedding.workspace WHERE id = 'our-wedding'
ON CONFLICT(name) DO NOTHING;
ALTER TABLE wedding.workspace DROP CONSTRAINT IF EXISTS workspace_body_check;
ALTER TABLE wedding.workspace ADD CONSTRAINT workspace_body_check
CHECK (jsonb_typeof(body) = 'object' AND body->>'schema' IN ('1', '2'));

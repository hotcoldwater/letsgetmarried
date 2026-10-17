-- Versioned private aggregate for one two-person workspace.
-- No browser/Data API access: only the server connection may query this schema.
CREATE SCHEMA IF NOT EXISTS wedding;
CREATE TABLE IF NOT EXISTS wedding.workspace (
  id text PRIMARY KEY CHECK (id = 'our-wedding'),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  body jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object' AND body->>'schema' = '1'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wedding.changes (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES wedding.workspace(id),
  version bigint NOT NULL,
  actor text NOT NULL CHECK (actor IN ('groom', 'bride')),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, version)
);
REVOKE ALL ON SCHEMA wedding FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA wedding FROM PUBLIC;

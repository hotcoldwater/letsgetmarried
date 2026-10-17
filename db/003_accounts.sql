CREATE TABLE IF NOT EXISTS wedding.accounts (
  role text PRIMARY KEY CHECK (role IN ('groom', 'bride')),
  username text UNIQUE NOT NULL,
  password_hash text,
  password_changed_at timestamptz,
  CHECK ((role = 'groom' AND username = 'integer0125') OR (role = 'bride' AND username = 'hawe123789'))
);
CREATE TABLE IF NOT EXISTS wedding.account_invites (
  role text PRIMARY KEY REFERENCES wedding.accounts(role),
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at timestamptz
);
CREATE TABLE IF NOT EXISTS wedding.sessions (
  token_hash text PRIMARY KEY,
  role text NOT NULL REFERENCES wedding.accounts(role),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS sessions_role ON wedding.sessions(role);
CREATE TABLE IF NOT EXISTS wedding.auth_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
INSERT INTO wedding.accounts(role, username) VALUES ('groom', 'integer0125'), ('bride', 'hawe123789') ON CONFLICT DO NOTHING;
REVOKE ALL ON ALL TABLES IN SCHEMA wedding FROM PUBLIC;

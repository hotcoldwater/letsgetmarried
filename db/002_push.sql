CREATE TABLE IF NOT EXISTS wedding.push_subscriptions (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('groom','bride')),
  endpoint text UNIQUE NOT NULL,
  subscription jsonb NOT NULL,
  changes boolean NOT NULL DEFAULT true,
  reminder_days jsonb NOT NULL DEFAULT '[1]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wedding.push_jobs (
  id text PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES wedding.push_subscriptions(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_jobs_pending ON wedding.push_jobs(available_at) WHERE sent_at IS NULL;
REVOKE ALL ON ALL TABLES IN SCHEMA wedding FROM PUBLIC;

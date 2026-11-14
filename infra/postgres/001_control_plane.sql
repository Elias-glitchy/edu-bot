BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS build_bot;
CREATE OR REPLACE FUNCTION build_bot.current_organization_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.organization_id', true),'')::uuid $$;

CREATE TABLE IF NOT EXISTS build_bot.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Johannesburg', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS build_bot.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS build_bot.memberships (
  organization_id uuid NOT NULL REFERENCES build_bot.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES build_bot.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  PRIMARY KEY (organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS build_bot.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES build_bot.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL, name text NOT NULL, role text NOT NULL, kind text NOT NULL,
  enabled boolean NOT NULL DEFAULT false, allowed_tools jsonb NOT NULL DEFAULT '[]', version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,slug)
);
CREATE TABLE IF NOT EXISTS build_bot.computers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES build_bot.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES build_bot.agents(id) ON DELETE CASCADE, provider text NOT NULL,
  provider_ref text, volume_ref text, image_version text NOT NULL, state text NOT NULL,
  last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,agent_id)
);
CREATE TABLE IF NOT EXISTS build_bot.durable_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES build_bot.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL, idempotency_key text NOT NULL, payload jsonb NOT NULL, status text NOT NULL,
  attempt integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
  budget_units bigint NOT NULL DEFAULT 0, consumed_units bigint NOT NULL DEFAULT 0,
  lease_token_hash text, lease_expires_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,kind,idempotency_key)
);
CREATE TABLE IF NOT EXISTS build_bot.agent_action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES build_bot.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES build_bot.agents(id), computer_id uuid NOT NULL REFERENCES build_bot.computers(id),
  action_type text NOT NULL, action_hash text NOT NULL, payload jsonb NOT NULL, status text NOT NULL,
  policy_version integer NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz, executed_at timestamptz, error text
);
CREATE TABLE IF NOT EXISTS build_bot.connector_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES build_bot.organizations(id) ON DELETE CASCADE,
  connector_type text NOT NULL, display_name text NOT NULL, status text NOT NULL, scopes jsonb NOT NULL, config jsonb NOT NULL DEFAULT '{}',
  secret_ref text, last_verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,connector_type,display_name)
);
CREATE TABLE IF NOT EXISTS build_bot.audit_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES build_bot.organizations(id) ON DELETE CASCADE,
  actor text NOT NULL, event_type text NOT NULL, entity_type text, entity_id text,
  request_id uuid, trace_id text, policy_version integer, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['memberships','agents','computers','durable_jobs','agent_action_proposals','connector_connections','audit_events'] LOOP
    EXECUTE format('ALTER TABLE build_bot.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE build_bot.%I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON build_bot.%I',table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON build_bot.%I USING (organization_id = build_bot.current_organization_id()) WITH CHECK (organization_id = build_bot.current_organization_id())',table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS durable_jobs_ready ON build_bot.durable_jobs(status,next_attempt_at,lease_expires_at);
CREATE INDEX IF NOT EXISTS audit_events_tenant_seq ON build_bot.audit_events(organization_id,seq);
COMMIT;

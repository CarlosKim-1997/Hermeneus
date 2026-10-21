-- T-034 authorised synthetic Alpha metadata; canonical content is unchanged.
-- Generated with Supabase CLI, mapped to the installed repository migration sequence.
-- No answers, questions, consent, raw access/Share tokens or submission digests.
CREATE TABLE mcp_web_approvals (
  nonce_hash TEXT PRIMARY KEY CHECK (nonce_hash ~ '^[a-f0-9]{64}$'),
  connection_hash TEXT NOT NULL CHECK (connection_hash ~ '^[a-f0-9]{64}$'),
  capability_id TEXT NOT NULL REFERENCES share_capabilities(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  consumed_at BIGINT
);
CREATE TABLE mcp_delegations (
  context_ref TEXT PRIMARY KEY CHECK (context_ref ~ '^[A-Za-z0-9_-]{43}$'),
  connection_hash TEXT NOT NULL CHECK (connection_hash ~ '^[a-f0-9]{64}$'),
  capability_id TEXT NOT NULL REFERENCES share_capabilities(id) ON DELETE CASCADE,
  publication_ref TEXT NOT NULL CHECK (publication_ref ~ '^pub_[a-f0-9]{32}$'),
  packet_digest TEXT NOT NULL CHECK (packet_digest ~ '^sha256:[a-f0-9]{64}$'),
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL CHECK (expires_at>created_at AND expires_at<=created_at+1800000),
  revoked_at BIGINT
);
CREATE INDEX mcp_delegations_parent_idx ON mcp_delegations(capability_id);
CREATE INDEX mcp_delegations_expiry_idx ON mcp_delegations(expires_at);
CREATE INDEX mcp_web_approvals_expiry_idx ON mcp_web_approvals(expires_at);
CREATE TABLE mcp_widget_tickets (
  nonce_hash TEXT PRIMARY KEY CHECK (nonce_hash ~ '^[a-f0-9]{64}$'),
  context_ref TEXT NOT NULL REFERENCES mcp_delegations(context_ref) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  consumed_at BIGINT
);
CREATE INDEX mcp_widget_tickets_expiry_idx ON mcp_widget_tickets(expires_at);
REVOKE ALL ON TABLE mcp_web_approvals,mcp_delegations,mcp_widget_tickets FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE mcp_web_approvals,mcp_delegations,mcp_widget_tickets FROM %I',r);
  END LOOP;
END $$;

CREATE TABLE mcp_oauth_transactions (
 ref text PRIMARY KEY CHECK(ref ~ '^[A-Za-z0-9_-]{43}$'),
 cookie_hash text NOT NULL CHECK(cookie_hash ~ '^[a-f0-9]{64}$'),
 csrf_hash text NOT NULL CHECK(csrf_hash ~ '^[a-f0-9]{64}$'),
 client_id text NOT NULL, redirect_uri text NOT NULL, state text NOT NULL,
 challenge text NOT NULL CHECK(challenge ~ '^[A-Za-z0-9_-]{43}$'), resource text NOT NULL,
 created_at bigint NOT NULL, expires_at bigint NOT NULL CHECK(expires_at>created_at AND expires_at<=created_at+60000)
);
CREATE TABLE mcp_oauth_sessions (
 id text PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{43}$'), subject text NOT NULL CHECK(subject ~ '^[A-Za-z0-9_-]{43}$'),
 connection_hash text NOT NULL UNIQUE CHECK(connection_hash ~ '^[a-f0-9]{64}$'),
 client_id text NOT NULL, browser_hash text NOT NULL CHECK(browser_hash ~ '^[a-f0-9]{64}$'),
 csrf_hash text NOT NULL CHECK(csrf_hash ~ '^[a-f0-9]{64}$'),
 issued_at bigint NOT NULL, expires_at bigint NOT NULL CHECK(expires_at>issued_at AND expires_at<=issued_at+3600000),
 revoked_at timestamptz
);
CREATE TABLE mcp_oauth_codes (
 code_hash text PRIMARY KEY CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 session_id text NOT NULL REFERENCES mcp_oauth_sessions(id) ON DELETE CASCADE,
 context_ref text NOT NULL REFERENCES mcp_delegations(context_ref) ON DELETE CASCADE,
 client_id text NOT NULL, redirect_uri text NOT NULL, resource text NOT NULL,
 challenge text NOT NULL CHECK(challenge ~ '^[A-Za-z0-9_-]{43}$'), expires_at bigint NOT NULL, consumed_at timestamptz
);
CREATE INDEX mcp_oauth_transactions_expiry ON mcp_oauth_transactions(expires_at);
CREATE INDEX mcp_oauth_sessions_expiry ON mcp_oauth_sessions(expires_at);
CREATE INDEX mcp_oauth_codes_expiry ON mcp_oauth_codes(expires_at);
CREATE INDEX mcp_oauth_codes_session ON mcp_oauth_codes(session_id);
CREATE INDEX mcp_oauth_codes_parent ON mcp_oauth_codes(context_ref);
REVOKE ALL ON mcp_oauth_transactions,mcp_oauth_sessions,mcp_oauth_codes FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON mcp_oauth_transactions,mcp_oauth_sessions,mcp_oauth_codes FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON mcp_oauth_transactions,mcp_oauth_sessions,mcp_oauth_codes FROM authenticated;
 END IF;
END $$;

-- Credential provisioning is separate; no password or raw key belongs in a migration.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hermeneus_mcp_alpha') THEN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hermeneus_mcp_alpha' AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
   RAISE EXCEPTION 'Existing MCP role has unexpected privileges';
  END IF;
 ELSE
  CREATE ROLE hermeneus_mcp_alpha NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 8;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO hermeneus_mcp_alpha;
GRANT SELECT (id,token_hash,handoff_id,version,revoked_at) ON share_capabilities TO hermeneus_mcp_alpha;
GRANT SELECT (id,owner_creator_id) ON handoffs TO hermeneus_mcp_alpha;
GRANT SELECT (id,lifecycle_status) ON creators TO hermeneus_mcp_alpha;
GRANT SELECT (handoff_id,version,snapshot_json) ON published_handoff_versions TO hermeneus_mcp_alpha;
GRANT SELECT,INSERT,UPDATE,DELETE ON mcp_web_approvals,mcp_delegations,mcp_widget_tickets,mcp_oauth_transactions,mcp_oauth_sessions,mcp_oauth_codes TO hermeneus_mcp_alpha;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['mcp_web_approvals','mcp_delegations','mcp_widget_tickets','mcp_oauth_transactions','mcp_oauth_sessions','mcp_oauth_codes'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY mcp_service_only ON public.%I FOR ALL TO hermeneus_mcp_alpha USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
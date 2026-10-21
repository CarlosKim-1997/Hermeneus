-- Candidate ONLY. Apply after postgres-schema.sql in disposable tests; no target migration.
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

-- Local T-032 candidate only: NOT in the automatic migration directory.
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

CREATE TABLE share_capabilities (
  id TEXT PRIMARY KEY,
  handoff_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (handoff_id, version)
    REFERENCES published_handoff_versions (handoff_id, version)
    ON DELETE RESTRICT
);

CREATE INDEX share_capabilities_handoff_version_idx
  ON share_capabilities (handoff_id, version);

CREATE OR REPLACE FUNCTION share_capabilities_immutable_except_revoke()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
     OR OLD.handoff_id IS DISTINCT FROM NEW.handoff_id
     OR OLD.version IS DISTINCT FROM NEW.version
     OR OLD.token_hash IS DISTINCT FROM NEW.token_hash
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'share_capabilities rows are immutable except revocation timestamp';
  END IF;

  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'share_capabilities cannot change revocation timestamp or be reactivated';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER share_capabilities_immutable_except_revoke_trg
  BEFORE UPDATE ON share_capabilities
  FOR EACH ROW
  EXECUTE FUNCTION share_capabilities_immutable_except_revoke();

CREATE TABLE creator_external_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES creators (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider, subject)
);

CREATE OR REPLACE FUNCTION creator_external_identities_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'creator_external_identities rows are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER creator_external_identities_immutable_trg
  BEFORE UPDATE ON creator_external_identities
  FOR EACH ROW
  EXECUTE FUNCTION creator_external_identities_immutable();

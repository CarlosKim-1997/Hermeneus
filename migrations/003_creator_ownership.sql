CREATE TABLE creators (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL
);

INSERT INTO creators (id, created_at)
VALUES ('creator_legacy_pre_m9', NOW())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE handoffs
  ADD COLUMN owner_creator_id TEXT REFERENCES creators (id);

UPDATE handoffs
SET owner_creator_id = 'creator_legacy_pre_m9'
WHERE owner_creator_id IS NULL;

ALTER TABLE handoffs
  ALTER COLUMN owner_creator_id SET NOT NULL;

CREATE OR REPLACE FUNCTION handoffs_owner_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.owner_creator_id IS DISTINCT FROM NEW.owner_creator_id THEN
    RAISE EXCEPTION 'handoffs.owner_creator_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER handoffs_owner_immutable_trg
  BEFORE UPDATE ON handoffs
  FOR EACH ROW
  EXECUTE FUNCTION handoffs_owner_immutable();

ALTER TABLE creators
  ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE creators
  ADD CONSTRAINT creators_lifecycle_status_check
  CHECK (lifecycle_status IN ('active', 'erasing'));

UPDATE creators SET lifecycle_status = 'active';

CREATE OR REPLACE FUNCTION creators_lifecycle_monotonic()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.lifecycle_status IS DISTINCT FROM NEW.lifecycle_status THEN
    IF OLD.lifecycle_status = 'active' AND NEW.lifecycle_status = 'erasing' THEN
      RETURN NEW;
    END IF;
    IF OLD.lifecycle_status = 'erasing' AND NEW.lifecycle_status = 'erasing' THEN
      RETURN NEW;
    END IF;
    IF OLD.lifecycle_status = 'active' AND NEW.lifecycle_status = 'active' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'creators lifecycle transition rejected: % -> %', OLD.lifecycle_status, NEW.lifecycle_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creators_lifecycle_monotonic_trg ON creators;

CREATE TRIGGER creators_lifecycle_monotonic_trg
  BEFORE UPDATE OF lifecycle_status ON creators
  FOR EACH ROW
  EXECUTE FUNCTION creators_lifecycle_monotonic();

CREATE OR REPLACE FUNCTION creator_external_identities_lifecycle_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'creator_external_identities rows are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM creators
      WHERE id = OLD.creator_id
        AND lifecycle_status = 'erasing'
    ) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'creator_external_identities delete rejected while Creator is not erasing';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_external_identities_immutable_trg ON creator_external_identities;

CREATE TRIGGER creator_external_identities_immutable_trg
  BEFORE UPDATE OR DELETE ON creator_external_identities
  FOR EACH ROW
  EXECUTE FUNCTION creator_external_identities_lifecycle_guard();

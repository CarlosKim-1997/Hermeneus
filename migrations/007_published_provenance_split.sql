-- M12 T-016: separate Published canonical snapshots from Published provenance.

CREATE TABLE published_handoff_provenance (
  handoff_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  item_id TEXT NOT NULL,
  source_index INTEGER NOT NULL CHECK (source_index >= 0),
  message_id TEXT NOT NULL REFERENCES source_messages (id) ON DELETE RESTRICT,
  excerpt TEXT CHECK (excerpt IS NULL OR length(trim(excerpt)) > 0),
  PRIMARY KEY (handoff_id, version, item_id, source_index),
  FOREIGN KEY (handoff_id, version)
    REFERENCES published_handoff_versions (handoff_id, version)
    ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION prevent_published_provenance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'published_handoff_provenance rows are immutable except authorized DELETE';
END;
$$;

CREATE TRIGGER published_handoff_provenance_no_update
  BEFORE UPDATE ON published_handoff_provenance
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_provenance_update();

DO $$
DECLARE
  pub RECORD;
  item JSONB;
  source JSONB;
  item_index INTEGER;
  source_index INTEGER;
  conversation_id TEXT;
  message_content TEXT;
  expected_count BIGINT := 0;
  inserted_count BIGINT := 0;
BEGIN
  FOR pub IN SELECT handoff_id, version, snapshot_json FROM published_handoff_versions LOOP
    IF jsonb_typeof(pub.snapshot_json) <> 'object' THEN
      RAISE EXCEPTION 'invalid published snapshot for % v%', pub.handoff_id, pub.version;
    END IF;
    IF (pub.snapshot_json->>'handoffId') IS DISTINCT FROM pub.handoff_id THEN
      RAISE EXCEPTION 'snapshot handoffId mismatch for % v%', pub.handoff_id, pub.version;
    END IF;
    IF (pub.snapshot_json->>'version')::INTEGER IS DISTINCT FROM pub.version THEN
      RAISE EXCEPTION 'snapshot version mismatch for % v%', pub.handoff_id, pub.version;
    END IF;
    IF jsonb_typeof(pub.snapshot_json->'items') <> 'array' THEN
      RAISE EXCEPTION 'snapshot items must be array for % v%', pub.handoff_id, pub.version;
    END IF;

    SELECT h.source_conversation_id INTO conversation_id
    FROM handoffs h
    WHERE h.id = pub.handoff_id;

    IF conversation_id IS NULL THEN
      RAISE EXCEPTION 'handoff % missing source_conversation_id before migration', pub.handoff_id;
    END IF;

    item_index := 0;
    FOR item IN SELECT value FROM jsonb_array_elements(pub.snapshot_json->'items') LOOP
      IF jsonb_typeof(item->'sources') <> 'array' THEN
        RAISE EXCEPTION 'item % missing sources array in % v%', item->>'id', pub.handoff_id, pub.version;
      END IF;
      source_index := 0;
      FOR source IN SELECT value FROM jsonb_array_elements(item->'sources') LOOP
        IF coalesce(trim(source->>'messageId'), '') = '' THEN
          RAISE EXCEPTION 'empty messageId in % v% item %', pub.handoff_id, pub.version, item->>'id';
        END IF;
        IF source ? 'excerpt' AND coalesce(trim(source->>'excerpt'), '') = '' THEN
          RAISE EXCEPTION 'blank excerpt in % v% item %', pub.handoff_id, pub.version, item->>'id';
        END IF;

        SELECT sm.content INTO message_content
        FROM source_messages sm
        WHERE sm.id = source->>'messageId';

        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing source message % referenced by % v%', source->>'messageId', pub.handoff_id, pub.version;
        END IF;

        IF (SELECT sm.conversation_id FROM source_messages sm WHERE sm.id = source->>'messageId') <> conversation_id THEN
          RAISE EXCEPTION 'message % wrong conversation for handoff %', source->>'messageId', pub.handoff_id;
        END IF;

        IF source ? 'excerpt' AND NOT message_content LIKE '%' || (source->>'excerpt') || '%' THEN
          RAISE EXCEPTION 'excerpt not supported by message % for % v%', source->>'messageId', pub.handoff_id, pub.version;
        END IF;

        INSERT INTO published_handoff_provenance (handoff_id, version, item_id, source_index, message_id, excerpt)
        VALUES (
          pub.handoff_id,
          pub.version,
          item->>'id',
          source_index,
          source->>'messageId',
          CASE WHEN source ? 'excerpt' THEN source->>'excerpt' ELSE NULL END
        );

        expected_count := expected_count + 1;
        source_index := source_index + 1;
      END LOOP;
      item_index := item_index + 1;
    END LOOP;
  END LOOP;

  SELECT COUNT(*) INTO inserted_count FROM published_handoff_provenance;
  IF inserted_count <> expected_count THEN
    RAISE EXCEPTION 'provenance backfill count mismatch: expected %, got %', expected_count, inserted_count;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS published_handoff_versions_no_update ON published_handoff_versions;

UPDATE published_handoff_versions
SET snapshot_json = jsonb_set(
  snapshot_json,
  '{items}',
  (
    SELECT COALESCE(
      jsonb_agg(
        (item - 'sources')
        ORDER BY ordinality
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(snapshot_json->'items') WITH ORDINALITY AS t(item, ordinality)
  )
);

DO $$
DECLARE
  row RECORD;
  item JSONB;
BEGIN
  FOR row IN SELECT handoff_id, version, snapshot_json FROM published_handoff_versions LOOP
    IF jsonb_typeof(row.snapshot_json->'items') = 'array' THEN
      FOR item IN SELECT value FROM jsonb_array_elements(row.snapshot_json->'items') LOOP
        IF item ? 'sources' THEN
          RAISE EXCEPTION 'sources remain in snapshot % v%', row.handoff_id, row.version;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

CREATE TRIGGER published_handoff_versions_no_update
  BEFORE UPDATE ON published_handoff_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_handoff_update();

ALTER TABLE handoffs
  ALTER COLUMN source_conversation_id DROP NOT NULL;

ALTER TABLE handoffs
  ADD COLUMN source_erased_at TIMESTAMPTZ NULL;

ALTER TABLE handoffs
  ADD CONSTRAINT handoffs_source_lifecycle_check CHECK (
    (source_conversation_id IS NOT NULL AND source_erased_at IS NULL)
    OR (source_conversation_id IS NULL AND source_erased_at IS NOT NULL)
  );

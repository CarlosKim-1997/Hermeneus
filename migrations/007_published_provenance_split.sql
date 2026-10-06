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

CREATE OR REPLACE FUNCTION m12_assert_legacy_published_snapshot(
  p_handoff_id TEXT,
  p_version INTEGER,
  p_published_at TIMESTAMPTZ,
  snapshot JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  unexpected_key TEXT;
  item JSONB;
  source JSONB;
  snap_version INTEGER;
  snap_published_at TIMESTAMPTZ;
BEGIN
  IF jsonb_typeof(snapshot) <> 'object' THEN
    RAISE EXCEPTION 'invalid published snapshot for % v%: root must be object', p_handoff_id, p_version;
  END IF;

  SELECT key INTO unexpected_key
  FROM jsonb_object_keys(snapshot) AS key
  WHERE key NOT IN ('handoffId', 'version', 'publishedAt', 'items')
  LIMIT 1;
  IF unexpected_key IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected top-level key % in % v%', unexpected_key, p_handoff_id, p_version;
  END IF;

  IF jsonb_typeof(snapshot->'handoffId') <> 'string' OR length(trim(snapshot->>'handoffId')) = 0 THEN
    RAISE EXCEPTION 'invalid handoffId in % v%', p_handoff_id, p_version;
  END IF;
  IF (snapshot->>'handoffId') IS DISTINCT FROM p_handoff_id THEN
    RAISE EXCEPTION 'snapshot handoffId mismatch for % v%', p_handoff_id, p_version;
  END IF;

  IF jsonb_typeof(snapshot->'version') <> 'number' THEN
    RAISE EXCEPTION 'invalid version type in % v%', p_handoff_id, p_version;
  END IF;
  snap_version := (snapshot->>'version')::INTEGER;
  IF snap_version IS NULL OR snap_version <= 0 OR snap_version IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION 'snapshot version mismatch for % v%', p_handoff_id, p_version;
  END IF;

  IF jsonb_typeof(snapshot->'publishedAt') <> 'string' OR length(trim(snapshot->>'publishedAt')) = 0 THEN
    RAISE EXCEPTION 'invalid publishedAt in % v%', p_handoff_id, p_version;
  END IF;
  BEGIN
    snap_published_at := (snapshot->>'publishedAt')::timestamptz;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid publishedAt timestamp in % v%', p_handoff_id, p_version;
  END;
  IF snap_published_at IS DISTINCT FROM p_published_at THEN
    RAISE EXCEPTION 'publishedAt mismatch for % v% (% vs %)', p_handoff_id, p_version, snapshot->>'publishedAt', p_published_at;
  END IF;

  IF jsonb_typeof(snapshot->'items') <> 'array' THEN
    RAISE EXCEPTION 'snapshot items must be array for % v%', p_handoff_id, p_version;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'items') LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION 'item must be object in % v%', p_handoff_id, p_version;
    END IF;

    SELECT key INTO unexpected_key
    FROM jsonb_object_keys(item) AS key
    WHERE key NOT IN ('id', 'type', 'statement', 'priority', 'createdBy', 'sources')
    LIMIT 1;
    IF unexpected_key IS NOT NULL THEN
      RAISE EXCEPTION 'unexpected item key % in % v%', unexpected_key, p_handoff_id, p_version;
    END IF;

    IF jsonb_typeof(item->'id') <> 'string' OR length(trim(item->>'id')) = 0 THEN
      RAISE EXCEPTION 'invalid item id in % v%', p_handoff_id, p_version;
    END IF;
    IF jsonb_typeof(item->'statement') <> 'string' OR length(trim(item->>'statement')) = 0 THEN
      RAISE EXCEPTION 'invalid item statement for % in % v%', item->>'id', p_handoff_id, p_version;
    END IF;
    IF item->>'type' NOT IN (
      'CORE_INTENT', 'CONTEXT', 'CONFIRMED', 'TENTATIVE', 'OPEN', 'REJECTED', 'CONSTRAINT', 'RATIONALE'
    ) THEN
      RAISE EXCEPTION 'invalid item type % in % v%', item->>'type', p_handoff_id, p_version;
    END IF;
    IF item->>'priority' NOT IN ('CORE', 'IMPORTANT', 'SUPPORTING') THEN
      RAISE EXCEPTION 'invalid item priority % in % v%', item->>'priority', p_handoff_id, p_version;
    END IF;
    IF item->>'createdBy' NOT IN ('EXTRACTION', 'CREATOR') THEN
      RAISE EXCEPTION 'invalid item createdBy % in % v%', item->>'createdBy', p_handoff_id, p_version;
    END IF;
    IF jsonb_typeof(item->'sources') <> 'array' THEN
      RAISE EXCEPTION 'item % missing sources array in % v%', item->>'id', p_handoff_id, p_version;
    END IF;

    FOR source IN SELECT value FROM jsonb_array_elements(item->'sources') LOOP
      IF jsonb_typeof(source) <> 'object' THEN
        RAISE EXCEPTION 'source must be object in % v% item %', p_handoff_id, p_version, item->>'id';
      END IF;
      SELECT key INTO unexpected_key
      FROM jsonb_object_keys(source) AS key
      WHERE key NOT IN ('messageId', 'excerpt')
      LIMIT 1;
      IF unexpected_key IS NOT NULL THEN
        RAISE EXCEPTION 'unexpected source key % in % v% item %', unexpected_key, p_handoff_id, p_version, item->>'id';
      END IF;
      IF jsonb_typeof(source->'messageId') <> 'string' OR length(trim(source->>'messageId')) = 0 THEN
        RAISE EXCEPTION 'empty messageId in % v% item %', p_handoff_id, p_version, item->>'id';
      END IF;
      IF source ? 'excerpt' THEN
        IF jsonb_typeof(source->'excerpt') <> 'string' OR length(trim(source->>'excerpt')) = 0 THEN
          RAISE EXCEPTION 'blank excerpt in % v% item %', p_handoff_id, p_version, item->>'id';
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION m12_assert_canonical_published_snapshot(
  p_handoff_id TEXT,
  p_version INTEGER,
  p_published_at TIMESTAMPTZ,
  snapshot JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  unexpected_key TEXT;
  item JSONB;
BEGIN
  IF jsonb_typeof(snapshot) <> 'object' THEN
    RAISE EXCEPTION 'invalid canonical snapshot for % v%', p_handoff_id, p_version;
  END IF;

  SELECT key INTO unexpected_key
  FROM jsonb_object_keys(snapshot) AS key
  WHERE key NOT IN ('handoffId', 'version', 'publishedAt', 'items')
  LIMIT 1;
  IF unexpected_key IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected top-level key % in canonical % v%', unexpected_key, p_handoff_id, p_version;
  END IF;

  IF (snapshot->>'handoffId') IS DISTINCT FROM p_handoff_id
     OR (snapshot->>'version')::INTEGER IS DISTINCT FROM p_version
     OR (snapshot->>'publishedAt')::timestamptz IS DISTINCT FROM p_published_at THEN
    RAISE EXCEPTION 'canonical snapshot identity mismatch for % v%', p_handoff_id, p_version;
  END IF;

  IF jsonb_typeof(snapshot->'items') <> 'array' THEN
    RAISE EXCEPTION 'canonical items must be array for % v%', p_handoff_id, p_version;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'items') LOOP
    IF item ? 'sources' THEN
      RAISE EXCEPTION 'sources remain in canonical snapshot % v%', p_handoff_id, p_version;
    END IF;
    SELECT key INTO unexpected_key
    FROM jsonb_object_keys(item) AS key
    WHERE key NOT IN ('id', 'type', 'statement', 'priority', 'createdBy')
    LIMIT 1;
    IF unexpected_key IS NOT NULL THEN
      RAISE EXCEPTION 'unexpected canonical item key % in % v%', unexpected_key, p_handoff_id, p_version;
    END IF;
    IF length(trim(item->>'id')) = 0 OR length(trim(item->>'statement')) = 0 THEN
      RAISE EXCEPTION 'invalid canonical item fields in % v%', p_handoff_id, p_version;
    END IF;
    IF item->>'type' NOT IN (
      'CORE_INTENT', 'CONTEXT', 'CONFIRMED', 'TENTATIVE', 'OPEN', 'REJECTED', 'CONSTRAINT', 'RATIONALE'
    ) OR item->>'priority' NOT IN ('CORE', 'IMPORTANT', 'SUPPORTING')
       OR item->>'createdBy' NOT IN ('EXTRACTION', 'CREATOR') THEN
      RAISE EXCEPTION 'invalid canonical item enum in % v%', p_handoff_id, p_version;
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  pub RECORD;
  item JSONB;
  source JSONB;
  source_index INTEGER;
  conversation_id TEXT;
  message_content TEXT;
  expected_count BIGINT := 0;
  inserted_count BIGINT := 0;
BEGIN
  FOR pub IN SELECT handoff_id, version, snapshot_json, published_at FROM published_handoff_versions LOOP
    PERFORM m12_assert_legacy_published_snapshot(pub.handoff_id, pub.version, pub.published_at, pub.snapshot_json);

    SELECT h.source_conversation_id INTO conversation_id
    FROM handoffs h
    WHERE h.id = pub.handoff_id;

    IF conversation_id IS NULL THEN
      RAISE EXCEPTION 'handoff % missing source_conversation_id before migration', pub.handoff_id;
    END IF;

    FOR item IN SELECT value FROM jsonb_array_elements(pub.snapshot_json->'items') LOOP
      source_index := 0;
      FOR source IN SELECT value FROM jsonb_array_elements(item->'sources') LOOP
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
BEGIN
  FOR row IN SELECT handoff_id, version, snapshot_json, published_at FROM published_handoff_versions LOOP
    PERFORM m12_assert_canonical_published_snapshot(row.handoff_id, row.version, row.published_at, row.snapshot_json);
  END LOOP;
END;
$$;

DROP FUNCTION m12_assert_legacy_published_snapshot(TEXT, INTEGER, TIMESTAMPTZ, JSONB);
DROP FUNCTION m12_assert_canonical_published_snapshot(TEXT, INTEGER, TIMESTAMPTZ, JSONB);

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

-- Existing rows remain imported-source Handoffs; no published snapshot is rewritten.
ALTER TABLE handoffs
  DROP CONSTRAINT handoffs_source_lifecycle_check;

ALTER TABLE handoffs
  ADD COLUMN ingress_kind TEXT NOT NULL DEFAULT 'IMPORTED_CONVERSATION',
  ADD COLUMN display_title TEXT NULL,
  ADD COLUMN bootstrap_request_key TEXT NULL;

ALTER TABLE handoffs
  ADD CONSTRAINT handoffs_ingress_lifecycle_check CHECK (
    (
      ingress_kind = 'IMPORTED_CONVERSATION'
      AND bootstrap_request_key IS NULL
      AND display_title IS NULL
      AND (
        (source_conversation_id IS NOT NULL AND source_erased_at IS NULL)
        OR (source_conversation_id IS NULL AND source_erased_at IS NOT NULL)
      )
    )
    OR (
      ingress_kind = 'BOOTSTRAP_PROPOSAL'
      AND source_conversation_id IS NULL
      AND source_erased_at IS NULL
      AND bootstrap_request_key IS NOT NULL
      AND length(bootstrap_request_key) BETWEEN 16 AND 128
      AND (display_title IS NULL OR (length(trim(display_title)) BETWEEN 1 AND 160))
    )
  );

CREATE UNIQUE INDEX handoffs_bootstrap_request_owner_unique
  ON handoffs (owner_creator_id, bootstrap_request_key)
  WHERE bootstrap_request_key IS NOT NULL;

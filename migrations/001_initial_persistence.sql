CREATE TABLE source_conversations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE source_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES source_conversations (id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('creator', 'assistant', 'other')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  source_provider TEXT NOT NULL,
  original_id TEXT,
  UNIQUE (conversation_id, ordinal)
);

CREATE TABLE handoffs (
  id TEXT PRIMARY KEY,
  source_conversation_id TEXT NOT NULL REFERENCES source_conversations (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE handoff_drafts (
  handoff_id TEXT PRIMARY KEY REFERENCES handoffs (id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  snapshot_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE published_handoff_versions (
  handoff_id TEXT NOT NULL REFERENCES handoffs (id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  published_at TIMESTAMPTZ NOT NULL,
  snapshot_json JSONB NOT NULL,
  PRIMARY KEY (handoff_id, version)
);

CREATE OR REPLACE FUNCTION prevent_published_handoff_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'published_handoff_versions snapshots are immutable';
END;
$$;

CREATE TRIGGER published_handoff_versions_no_update
  BEFORE UPDATE ON published_handoff_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_handoff_update();

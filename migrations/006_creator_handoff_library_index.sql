CREATE INDEX IF NOT EXISTS handoffs_owner_created_idx
  ON handoffs (owner_creator_id, created_at DESC, id DESC);

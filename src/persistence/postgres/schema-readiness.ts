import type { Queryable } from "./pool.js";

// Keep the complete set, not just the latest filename. A test compares this
// build-time manifest with the repository migration directory.
export const REQUIRED_MIGRATIONS = [
  "001_initial_persistence.sql", "002_share_capabilities.sql", "003_creator_ownership.sql",
  "004_external_identities.sql", "005_external_identity_hardening.sql",
  "006_creator_handoff_library_index.sql", "007_published_provenance_split.sql",
  "008_creator_lifecycle.sql", "009_bootstrap_ingress.sql", "010_verifier_pilot_budget.sql",
  "011_private_public_schema_grants.sql",
  "012_scoped_mcp_metadata.sql",
] as const;

export async function isSchemaReady(db: Queryable): Promise<boolean> {
  const result = await db.query<{ ready: boolean }>(`
    SELECT NOT EXISTS (
      SELECT required.filename FROM unnest($1::text[]) AS required(filename)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.schema_migrations AS applied
        WHERE applied.filename = required.filename
      )
    ) AS ready`, [REQUIRED_MIGRATIONS]);
  return result.rows[0]?.ready === true;
}

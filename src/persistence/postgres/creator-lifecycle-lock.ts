import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

/** Deterministic int32 pair for PostgreSQL transaction advisory locks. */
export function creatorLifecycleAdvisoryKeyPair(creatorId: string): [number, number] {
  const digest = createHash("sha256").update(`hermeneus:m12:creator-lifecycle:${creatorId}`).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

export async function acquireCreatorSharedXactLock(client: PoolClient, creatorId: string): Promise<void> {
  const [k1, k2] = creatorLifecycleAdvisoryKeyPair(creatorId);
  await client.query(`SELECT pg_advisory_xact_lock_shared($1::integer, $2::integer)`, [k1, k2]);
}

export async function acquireCreatorExclusiveXactLock(client: PoolClient, creatorId: string): Promise<void> {
  const [k1, k2] = creatorLifecycleAdvisoryKeyPair(creatorId);
  await client.query(`SELECT pg_advisory_xact_lock($1::integer, $2::integer)`, [k1, k2]);
}

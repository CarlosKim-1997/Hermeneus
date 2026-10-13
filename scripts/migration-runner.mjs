import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// A session lock covers discovery and every per-file transaction. Callers must
// use a dedicated direct/session connection, never a transaction pooler.
export const MIGRATION_LOCK_KEYS = [1212502605, 1];

/**
 * @param {import('pg').Client | import('pg').PoolClient} client
 * @param {{directory: string, lockWaitMs?: number, onApplied?: (filename: string) => void}} options
 */
export async function runMigrations(client, {
  directory, lockWaitMs = 30_000, onApplied = () => {},
}) {
  let locked = false;
  const deadline = performance.now() + lockWaitMs;
  try {
    do {
      const result = await client.query("SELECT pg_try_advisory_lock($1::integer, $2::integer) AS locked", MIGRATION_LOCK_KEYS);
      locked = result.rows[0]?.locked === true;
      if (locked) break;
      if (performance.now() >= deadline) throw new Error("Migration lock wait timed out");
      await delay(Math.min(100, Math.max(1, deadline - performance.now())));
    } while (!locked);

    await client.query("SET search_path TO public");
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    for (const filename of files) {
      const applied = await client.query("SELECT 1 FROM public.schema_migrations WHERE filename = $1", [filename]);
      if (applied.rowCount) continue;
      const sql = await readFile(path.join(directory, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO public.schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      onApplied(filename);
    }
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1::integer, $2::integer)", MIGRATION_LOCK_KEYS);
  }
}

import { createPoolConfig } from "../persistence/postgres/pool.js";
import { isSchemaReady } from "../persistence/postgres/schema-readiness.js";
import { readCreatorAuthConfig, isDevCreatorAuthAllowedInRuntime } from "../creator/auth-config.js";
import pg from "pg";

let readinessPool: pg.Pool | undefined;

export async function isApplicationReady(): Promise<boolean> {
  try {
    const auth = readCreatorAuthConfig();
    if (auth.mode === "disabled" || (auth.mode === "dev" && !isDevCreatorAuthAllowedInRuntime())) return false;
    const url = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
    if (!url) return false;
    if (!readinessPool) {
      readinessPool = new pg.Pool({ ...createPoolConfig(url), max: 1,
        connectionTimeoutMillis: 1_500, idleTimeoutMillis: 30_000, query_timeout: 2_500 });
      // pg emits idle-client errors separately; a disconnected probe must not
      // crash the app or print infrastructure details.
      readinessPool.on("error", () => {});
    }
    const client = await readinessPool.connect();
    let discard = true;
    try {
      // SET LOCAL is safe with a transaction pooler and cannot alter a later
      // application session. The probe cannot mutate schema or user records.
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '2000ms'");
      const ready = await isSchemaReady(client);
      await client.query("COMMIT");
      discard = false;
      return ready;
    } finally {
      // On timeout/error, disconnect instead of returning an open transaction.
      client.release(discard);
    }
  } catch {
    return false;
  }
}

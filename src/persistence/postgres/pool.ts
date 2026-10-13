import pg from "pg";
import { SUPABASE_ROOT_CA } from "./supabase-root-ca.js";

const { Pool } = pg;

export type Queryable = Pick<pg.Pool, "query">;

function isSupabaseDatabaseHost(hostname: string): boolean {
  return hostname.endsWith(".pooler.supabase.com") || /^db\.[a-z0-9]+\.supabase\.co$/.test(hostname);
}

export function createPoolConfig(connectionString: string): pg.PoolConfig {
  const url = new URL(connectionString);
  if (!isSupabaseDatabaseHost(url.hostname)) {
    return { connectionString };
  }

  if (url.searchParams.get("sslmode") === "disable") {
    throw new Error("Supabase database connections require TLS");
  }
  if (["sslcert", "sslkey", "sslrootcert"].some((key) => url.searchParams.has(key))) {
    throw new Error("Supabase TLS credentials must not override the trusted CA configuration");
  }

  // pg-connection-string replaces the ssl object when sslmode is present in the URL.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("uselibpqcompat");
  return {
    connectionString: url.toString(),
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
  };
}

export function createPool(connectionString: string): pg.Pool {
  return new Pool(createPoolConfig(connectionString));
}

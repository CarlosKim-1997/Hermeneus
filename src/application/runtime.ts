import { createPostgresRepositories } from "../persistence/postgres/create-repositories.js";
import { createPool } from "../persistence/postgres/pool.js";

let pool: ReturnType<typeof createPool> | undefined;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL is required");
  }
  return url;
}

export function getPool() {
  if (!pool) {
    pool = createPool(getDatabaseUrl());
  }
  return pool;
}

export function getRepositories() {
  return createPostgresRepositories(getPool());
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

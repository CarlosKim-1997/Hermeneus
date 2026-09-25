import pg from "pg";

const { Pool } = pg;

export type Queryable = Pick<pg.Pool, "query">;

export function createPool(connectionString: string): pg.Pool {
  return new Pool({ connectionString });
}

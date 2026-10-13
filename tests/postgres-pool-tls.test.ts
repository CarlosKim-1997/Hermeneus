import { describe, expect, it } from "vitest";
import pg from "pg";
import { createPoolConfig } from "../src/persistence/postgres/pool.js";
import { SUPABASE_ROOT_CA } from "../src/persistence/postgres/supabase-root-ca.js";

describe("Supabase PostgreSQL TLS", () => {
  const pooled = "postgresql://postgres.example:password@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";

  it("verifies the server with the Supabase CA even when the URL requests SSL", () => {
    const config = createPoolConfig(`${pooled}?sslmode=require&application_name=hermeneus`);
    expect(config.ssl).toEqual({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
    const client = new pg.Client(config);
    const parameters = client as pg.Client & { connectionParameters: { ssl: unknown } };
    expect(parameters.connectionParameters.ssl).toEqual({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
    const url = new URL(config.connectionString!);
    expect(url.searchParams.has("sslmode")).toBe(false);
    expect(url.searchParams.get("application_name")).toBe("hermeneus");
  });

  it("rejects attempts to disable or override TLS for Supabase", () => {
    expect(() => createPoolConfig(`${pooled}?sslmode=disable`)).toThrow(/require TLS/);
    expect(() => createPoolConfig(`${pooled}?sslrootcert=other.crt`)).toThrow(/must not override/);
  });

  it("does not apply the Supabase CA to unrelated hosts", () => {
    const local = "postgresql://postgres:password@localhost:5432/hermeneus";
    const lookalike = "postgresql://postgres:password@pooler.supabase.com.evil.test:5432/postgres";
    expect(createPoolConfig(local)).toEqual({ connectionString: local });
    expect(createPoolConfig(lookalike)).toEqual({ connectionString: lookalike });
  });
});

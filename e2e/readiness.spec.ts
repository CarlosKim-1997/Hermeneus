import { test, expect } from "@playwright/test";
import pg from "pg";

test.describe("database readiness HTTP probe", () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  test.skip(!databaseUrl || !["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname), "Disposable local TEST_DATABASE_URL required");

  test("healthy schema is ready; missing history is 503 and recovers after repair", async ({ request }) => {
    const healthy = await request.get("/api/ready");
    expect(healthy.status()).toBe(200);
    expect(await healthy.json()).toEqual({ status: "ready" });
    expect(healthy.headers()["cache-control"]).toContain("no-store");
    const db = new pg.Client({ connectionString: databaseUrl });
    await db.connect();
    const filename = "002_share_capabilities.sql";
    const original = await db.query("SELECT applied_at FROM public.schema_migrations WHERE filename=$1", [filename]);
    expect(original.rowCount).toBe(1);
    try {
      await db.query("DELETE FROM public.schema_migrations WHERE filename=$1", [filename]);
      const missing = await request.get("/api/ready");
      expect(missing.status()).toBe(503);
      expect(await missing.json()).toEqual({ status: "unavailable" });
      expect(missing.headers()["cache-control"]).toContain("no-store");
    } finally {
      await db.query("INSERT INTO public.schema_migrations(filename,applied_at) VALUES($1,$2) ON CONFLICT(filename) DO NOTHING", [filename, original.rows[0].applied_at]);
      await db.end();
    }
    expect((await request.get("/api/ready")).status()).toBe(200);
  });
});

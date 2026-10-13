import { readdir } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_MIGRATIONS, isSchemaReady } from "../src/persistence/postgres/schema-readiness.js";
import type { Queryable } from "../src/persistence/postgres/pool.js";

describe("schema readiness", () => {
  it("binds the build manifest to every checked-in migration", async () => {
    const files = (await readdir(new URL("../migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort();
    expect([...REQUIRED_MIGRATIONS]).toEqual(files);
  });

  it("does not treat a missing or malformed query result as ready", async () => {
    for (const rows of [[], [{ ready: false }], [{ ready: "true" }]]) {
      const db = { query: vi.fn().mockResolvedValue({ rows }) } as unknown as Queryable;
      expect(await isSchemaReady(db)).toBe(false);
    }
  });
});

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { LEGACY_PRE_M9_CREATOR_ID } from "../../src/creator/types.js";

const url = process.env.TEST_DATABASE_URL;
const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

async function readMigration(name: string) {
  return readFile(path.join(migrationsDir, name), "utf8");
}

if (!url) {
  describe.skip("M9 migration compatibility", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("M9 migration compatibility", () => {
    const pool = createPool(url);
    const schema = `temporary_m9_migration_test_${Date.now()}`;

    beforeAll(async () => {
      await pool.query(`CREATE SCHEMA ${schema}`);
    });

    afterAll(async () => {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
    });

    it("M9C1 — existing M1–M8 Handoff backfills to legacy owner with NOT NULL/FK/immutability", async () => {
      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO ${schema}`);
        await client.query(await readMigration("001_initial_persistence.sql"));
        await client.query(await readMigration("002_share_capabilities.sql"));

        await client.query(
          `INSERT INTO source_conversations (id, provider, imported_at) VALUES ('conv-legacy', 'generic-text', NOW())`,
        );
        await client.query(
          `INSERT INTO source_messages (id, conversation_id, ordinal, role, content, source_provider)
           VALUES ('msg-legacy-1', 'conv-legacy', 1, 'creator', 'Pre-M9 content', 'generic-text')`,
        );
        await client.query(
          `INSERT INTO handoffs (id, source_conversation_id, created_at)
           VALUES ('hd-legacy-pre-m9', 'conv-legacy', '2026-09-01T00:00:00.000Z')`,
        );

        await client.query(await readMigration("003_creator_ownership.sql"));

        const legacy = await client.query(`SELECT 1 FROM creators WHERE id = $1`, [LEGACY_PRE_M9_CREATOR_ID]);
        expect(legacy.rowCount).toBe(1);

        const handoff = await client.query<{ owner_creator_id: string }>(
          `SELECT owner_creator_id FROM handoffs WHERE id = 'hd-legacy-pre-m9'`,
        );
        expect(handoff.rows[0]?.owner_creator_id).toBe(LEGACY_PRE_M9_CREATOR_ID);

        const nullCheck = await client.query(
          `SELECT COUNT(*)::int AS c FROM handoffs WHERE owner_creator_id IS NULL`,
        );
        expect(nullCheck.rows[0]!.c).toBe(0);

        await expect(
          client.query(`INSERT INTO handoffs (id, source_conversation_id, owner_creator_id) VALUES ('hd-bad', 'conv-legacy', 'missing_creator')`),
        ).rejects.toThrow();

        await expect(
          client.query(`UPDATE handoffs SET owner_creator_id = 'creator_other' WHERE id = 'hd-legacy-pre-m9'`),
        ).rejects.toThrow(/immutable/i);
      } finally {
        client.release();
      }
    });
  });
}

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { creatorLifecycleAdvisoryKeyPair } from "../../src/persistence/postgres/creator-lifecycle-lock.js";

const url = process.env.TEST_DATABASE_URL;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(root, "migrations");
const migration008 = path.join(migrationsDir, "008_creator_lifecycle.sql");

async function applyMigrationsThrough(client: import("pg").PoolClient, throughFilename: string) {
  await client.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    CREATE TABLE schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  for (const filename of files) {
    if (filename > throughFilename) break;
    const sql = await readFile(path.join(migrationsDir, filename), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

async function applyMigration008(client: import("pg").PoolClient) {
  const sql = await readFile(migration008, "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

if (!url) {
  describe.skip("M12 migration 008", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("M12 migration 008 — Creator lifecycle", () => {
    const pool = createPool(url);

    afterAll(async () => {
      await pool.end();
    });

    it("M18-1 — existing Creators migrate to active", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "007_published_provenance_split.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m18_1', NOW())`);
        await applyMigration008(client);
        const row = await client.query(`SELECT lifecycle_status FROM creators WHERE id = 'creator_m18_1'`);
        expect(row.rows[0]?.lifecycle_status).toBe("active");
      } finally {
        client.release();
      }
    });

    it("M18-2 — invalid lifecycle value rejected", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "008_creator_lifecycle.sql");
        await expect(
          client.query(`INSERT INTO creators (id, created_at, lifecycle_status) VALUES ('bad', NOW(), 'erased')`),
        ).rejects.toThrow(/check|lifecycle/i);
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('good', NOW())`);
        await expect(
          client.query(`UPDATE creators SET lifecycle_status = 'paused' WHERE id = 'good'`),
        ).rejects.toThrow(/check|lifecycle/i);
      } finally {
        client.release();
      }
    });

    it("M18-3 — active → erasing allowed", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "008_creator_lifecycle.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m18_3', NOW())`);
        await client.query(`UPDATE creators SET lifecycle_status = 'erasing' WHERE id = 'creator_m18_3'`);
        const row = await client.query(`SELECT lifecycle_status FROM creators WHERE id = 'creator_m18_3'`);
        expect(row.rows[0]?.lifecycle_status).toBe("erasing");
      } finally {
        client.release();
      }
    });

    it("M18-4 — erasing → active rejected", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "008_creator_lifecycle.sql");
        await client.query(
          `INSERT INTO creators (id, created_at, lifecycle_status) VALUES ('creator_m18_4', NOW(), 'erasing')`,
        );
        await expect(
          client.query(`UPDATE creators SET lifecycle_status = 'active' WHERE id = 'creator_m18_4'`),
        ).rejects.toThrow(/transition rejected|lifecycle/i);
      } finally {
        client.release();
      }
    });

    it("M18-5 — external identity UPDATE still forbidden", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "008_creator_lifecycle.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m18_5', NOW())`);
        await client.query(
          `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
           VALUES ('google', 'sub-m18-5', 'creator_m18_5', NOW())`,
        );
        await expect(
          client.query(
            `UPDATE creator_external_identities SET creator_id = 'other' WHERE provider = 'google' AND subject = 'sub-m18-5'`,
          ),
        ).rejects.toThrow(/immutable/i);
      } finally {
        client.release();
      }
    });

    it("M18-6 — external identity DELETE while Creator active rejected", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "008_creator_lifecycle.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m18_6', NOW())`);
        await client.query(
          `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
           VALUES ('google', 'sub-m18-6', 'creator_m18_6', NOW())`,
        );
        await expect(
          client.query(`DELETE FROM creator_external_identities WHERE provider = 'google' AND subject = 'sub-m18-6'`),
        ).rejects.toThrow(/not erasing/i);
      } finally {
        client.release();
      }
    });

    it("M18-7 — external identity DELETE while Creator erasing allowed", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "008_creator_lifecycle.sql");
        await client.query(
          `INSERT INTO creators (id, created_at, lifecycle_status) VALUES ('creator_m18_7', NOW(), 'erasing')`,
        );
        await client.query(
          `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
           VALUES ('google', 'sub-m18-7', 'creator_m18_7', NOW())`,
        );
        await client.query(`DELETE FROM creator_external_identities WHERE provider = 'google' AND subject = 'sub-m18-7'`);
        const left = await client.query(
          `SELECT 1 FROM creator_external_identities WHERE provider = 'google' AND subject = 'sub-m18-7'`,
        );
        expect(left.rowCount).toBe(0);
      } finally {
        client.release();
      }
    });

    it("M18-8 — Creator row deletion FK-blocked until mappings deleted", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "008_creator_lifecycle.sql");
        await client.query(
          `INSERT INTO creators (id, created_at, lifecycle_status) VALUES ('creator_m18_8', NOW(), 'erasing')`,
        );
        await client.query(
          `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
           VALUES ('google', 'sub-m18-8', 'creator_m18_8', NOW())`,
        );
        await expect(client.query(`DELETE FROM creators WHERE id = 'creator_m18_8'`)).rejects.toThrow(/foreign key|violates/i);
        await client.query(`DELETE FROM creator_external_identities WHERE creator_id = 'creator_m18_8'`);
        await client.query(`DELETE FROM creators WHERE id = 'creator_m18_8'`);
        const gone = await client.query(`SELECT 1 FROM creators WHERE id = 'creator_m18_8'`);
        expect(gone.rowCount).toBe(0);
      } finally {
        client.release();
      }
    });

    it("creator lifecycle advisory key is deterministic and stable", () => {
      const a = creatorLifecycleAdvisoryKeyPair("creator_test_a");
      const b = creatorLifecycleAdvisoryKeyPair("creator_test_a");
      const c = creatorLifecycleAdvisoryKeyPair("creator_test_b");
      expect(a).toEqual(b);
      expect(a).not.toEqual(c);
    });
  });
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;
const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

async function readMigration(name: string) {
  return readFile(path.join(migrationsDir, name), "utf8");
}

const old004TriggerOnlyUpdate = `
CREATE OR REPLACE FUNCTION creator_external_identities_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'creator_external_identities rows are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER creator_external_identities_immutable_trg
  BEFORE UPDATE ON creator_external_identities
  FOR EACH ROW
  EXECUTE FUNCTION creator_external_identities_immutable();
`;

if (!url) {
  describe.skip("M10 migration hardening", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("M10 migration hardening (M10M)", () => {
    const rootPool = createPool(url);

    afterAll(async () => {
      await rootPool.end();
    });

    it("M10M1 — fresh 001→005 rejects UPDATE and DELETE on mappings", async () => {
      const schema = `m10m1_${Date.now()}`;
      const client = await rootPool.connect();
      try {
        await client.query(`CREATE SCHEMA ${schema}`);
        await client.query(`SET search_path TO ${schema}`);
        await client.query(await readMigration("001_initial_persistence.sql"));
        await client.query(await readMigration("002_share_capabilities.sql"));
        await client.query(await readMigration("003_creator_ownership.sql"));
        await client.query(await readMigration("004_external_identities.sql"));
        await client.query(await readMigration("005_external_identity_hardening.sql"));

        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m10m1', NOW())`);
        await client.query(
          `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
           VALUES ('google', 'subject-m10m1', 'creator_m10m1', NOW())`,
        );

        await expect(
          client.query(`UPDATE creator_external_identities SET creator_id = 'creator_other' WHERE provider = 'google'`),
        ).rejects.toThrow(/immutable/i);
        await expect(
          client.query(`DELETE FROM creator_external_identities WHERE provider = 'google'`),
        ).rejects.toThrow(/immutable/i);
      } finally {
        client.release();
        await rootPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      }
    });

    it("M10M2 — early 004 DB converges via 005 to reject DELETE", async () => {
      const schema = `m10m2_${Date.now()}`;
      const client = await rootPool.connect();
      try {
        await client.query(`CREATE SCHEMA ${schema}`);
        await client.query(`SET search_path TO ${schema}`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        await client.query(await readMigration("001_initial_persistence.sql"));
        await client.query(await readMigration("002_share_capabilities.sql"));
        await client.query(await readMigration("003_creator_ownership.sql"));

        await client.query(`
          CREATE TABLE creator_external_identities (
            provider TEXT NOT NULL,
            subject TEXT NOT NULL,
            creator_id TEXT NOT NULL REFERENCES creators (id) ON DELETE RESTRICT,
            created_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (provider, subject)
          )
        `);
        await client.query(old004TriggerOnlyUpdate);

        await client.query(`INSERT INTO schema_migrations (filename) VALUES ('004_external_identities.sql')`);

        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m10m2', NOW())`);
        await client.query(
          `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
           VALUES ('google', 'subject-m10m2', 'creator_m10m2', NOW())`,
        );

        await client.query(await readMigration("005_external_identity_hardening.sql"));

        await expect(
          client.query(`DELETE FROM creator_external_identities WHERE provider = 'google' AND subject = 'subject-m10m2'`),
        ).rejects.toThrow(/immutable/i);

        const preserved = await client.query(
          `SELECT creator_id FROM creator_external_identities WHERE provider = 'google' AND subject = 'subject-m10m2'`,
        );
        expect(preserved.rowCount).toBe(1);
        expect(preserved.rows[0]!.creator_id).toBe("creator_m10m2");
      } finally {
        client.release();
        await rootPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      }
    });
  });
}

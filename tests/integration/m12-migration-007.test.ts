import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDraft } from "../../src/handoff/draft.js";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(root, "migrations");
const migration007 = path.join(migrationsDir, "007_published_provenance_split.sql");

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return { priority: "CORE", createdBy: "CREATOR", sources: [], ...partial };
}

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

async function seedLegacyPublished(client: import("pg").PoolClient) {
  const creator = "creator_m16";
  await client.query(`INSERT INTO creators (id, created_at) VALUES ($1, NOW())`, [creator]);
  await client.query(
    `INSERT INTO source_conversations (id, provider, imported_at) VALUES ('conv-m16', 'generic-text', NOW())`,
  );
  await client.query(
    `INSERT INTO source_messages (id, conversation_id, ordinal, role, content, source_provider)
     VALUES ('conv-m16:m1', 'conv-m16', 0, 'creator', 'Actually, web first.', 'generic-text')`,
  );
  await client.query(
    `INSERT INTO handoffs (id, source_conversation_id, created_at, owner_creator_id)
     VALUES ('hd-m16', 'conv-m16', NOW(), $1)`,
    [creator],
  );
  await client.query(
    `INSERT INTO handoff_drafts (handoff_id, revision, snapshot_json, updated_at)
     VALUES ('hd-m16', 1, $1::jsonb, NOW())`,
    [JSON.stringify(createDraft("hd-m16", []))],
  );
  const snapshot = {
    handoffId: "hd-m16",
    version: 1,
    publishedAt: "2026-09-25T00:00:00.000Z",
    items: [
      {
        id: "web",
        type: "CONFIRMED",
        statement: "Web-first is confirmed.",
        priority: "CORE",
        createdBy: "CREATOR",
        sources: [{ messageId: "conv-m16:m1", excerpt: "Actually, web first." }],
      },
      {
        id: "empty",
        type: "CONTEXT",
        statement: "No sources here.",
        priority: "SUPPORTING",
        createdBy: "CREATOR",
        sources: [],
      },
    ],
  };
  await client.query(
    `INSERT INTO published_handoff_versions (handoff_id, version, published_at, snapshot_json)
     VALUES ('hd-m16', 1, $2, $1::jsonb)`,
    [JSON.stringify(snapshot), snapshot.publishedAt],
  );
  return snapshot;
}

if (!url) {
  describe.skip("M12 migration 007 harness", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("M12 migration 007 harness", () => {
    const pool = createPool(url);

    afterAll(async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "007_published_provenance_split.sql");
      } finally {
        client.release();
        await pool.end();
      }
    });

    it("M16-1/M16-2/M16-3 — canonical preservation and provenance backfill", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        const legacySnapshot = await seedLegacyPublished(client);
        const sql007 = await readFile(migration007, "utf8");
        await client.query("BEGIN");
        await client.query(sql007);
        await client.query("COMMIT");

        const after = await client.query(`SELECT snapshot_json FROM published_handoff_versions WHERE handoff_id = 'hd-m16'`);
        const snapshot = after.rows[0].snapshot_json;
        expect(snapshot.handoffId).toBe(legacySnapshot.handoffId);
        expect(snapshot.version).toBe(legacySnapshot.version);
        expect(snapshot.publishedAt).toBe(legacySnapshot.publishedAt);
        expect(snapshot.items[0].id).toBe("web");
        expect(snapshot.items[0].statement).toBe(legacySnapshot.items[0].statement);
        expect(snapshot.items[0].sources).toBeUndefined();

        const prov = await client.query(
          `SELECT item_id, source_index, message_id, excerpt FROM published_handoff_provenance WHERE handoff_id = 'hd-m16' ORDER BY item_id, source_index`,
        );
        expect(prov.rowCount).toBe(1);
        expect(prov.rows[0].message_id).toBe("conv-m16:m1");
        expect(prov.rows[0].excerpt).toBe("Actually, web first.");
      } finally {
        client.release();
      }
    });

    it("M16-5 — broken source reference aborts migration", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m16_bad', NOW())`);
        await client.query(
          `INSERT INTO source_conversations (id, provider, imported_at) VALUES ('conv-m16-bad', 'generic-text', NOW())`,
        );
        await client.query(
          `INSERT INTO handoffs (id, source_conversation_id, created_at, owner_creator_id)
           VALUES ('hd-m16-bad', 'conv-m16-bad', NOW(), 'creator_m16_bad')`,
        );
        await client.query(
          `INSERT INTO published_handoff_versions (handoff_id, version, published_at, snapshot_json)
           VALUES ('hd-m16-bad', 1, '2026-09-25T00:00:00.000Z', $1::jsonb)`,
          [
            JSON.stringify({
              handoffId: "hd-m16-bad",
              version: 1,
              publishedAt: "2026-09-25T00:00:00.000Z",
              items: [
                {
                  id: "web",
                  type: "CONFIRMED",
                  statement: "Bad ref.",
                  priority: "CORE",
                  createdBy: "CREATOR",
                  sources: [{ messageId: "missing-message" }],
                },
              ],
            }),
          ],
        );
        const sql007 = await readFile(migration007, "utf8");
        await expect(async () => {
          await client.query("BEGIN");
          try {
            await client.query(sql007);
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        }).rejects.toThrow(/missing source message/i);

        const reg = await client.query(`SELECT to_regclass('public.published_handoff_provenance') AS t`);
        if (reg.rows[0].t) {
          const prov = await client.query(`SELECT 1 FROM published_handoff_provenance LIMIT 1`);
          expect(prov.rowCount).toBe(0);
        }
        const snap = await client.query(
          `SELECT snapshot_json->'items'->0 ? 'sources' AS has_sources FROM published_handoff_versions WHERE handoff_id = 'hd-m16-bad'`,
        );
        expect(snap.rows[0].has_sources).toBe(true);
      } finally {
        client.release();
      }
    });

    it("M16-8 — Published UPDATE remains rejected after migration", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await seedLegacyPublished(client);
        await client.query("BEGIN");
        await client.query(await readFile(migration007, "utf8"));
        await client.query("COMMIT");
        await expect(
          client.query(`UPDATE published_handoff_versions SET snapshot_json = snapshot_json WHERE handoff_id = 'hd-m16'`),
        ).rejects.toThrow(/immutable/i);
      } finally {
        client.release();
      }
    });

    it("M16-10 — failed migration leaves legacy published JSON intact", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m16_rb', NOW())`);
        await client.query(
          `INSERT INTO source_conversations (id, provider, imported_at) VALUES ('conv-m16-rb', 'generic-text', NOW())`,
        );
        await client.query(
          `INSERT INTO handoffs (id, source_conversation_id, created_at, owner_creator_id)
           VALUES ('hd-m16-rb', 'conv-m16-rb', NOW(), 'creator_m16_rb')`,
        );
        const legacyJson = {
          handoffId: "hd-m16-rb",
          version: 1,
          publishedAt: "2026-09-25T00:00:00.000Z",
          items: [
            {
              id: "x",
              type: "CONFIRMED",
              statement: "Rollback case.",
              priority: "CORE",
              createdBy: "CREATOR",
              sources: [{ messageId: "no-such-msg" }],
            },
          ],
        };
        await client.query(
          `INSERT INTO published_handoff_versions (handoff_id, version, published_at, snapshot_json)
           VALUES ('hd-m16-rb', 1, '2026-09-25T00:00:00.000Z', $1::jsonb)`,
          [JSON.stringify(legacyJson)],
        );
        const sql007 = await readFile(migration007, "utf8");
        await expect(async () => {
          await client.query("BEGIN");
          try {
            await client.query(sql007);
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        }).rejects.toThrow();
        const after = await client.query(
          `SELECT snapshot_json FROM published_handoff_versions WHERE handoff_id = 'hd-m16-rb'`,
        );
        expect(after.rows[0].snapshot_json).toEqual(legacyJson);
      } finally {
        client.release();
      }
    });

    it("M16-9 — handoff source lifecycle CHECK", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "007_published_provenance_split.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m16_check', NOW())`);
        await client.query(
          `INSERT INTO source_conversations (id, provider, imported_at) VALUES ('conv-check', 'generic-text', NOW())`,
        );
        await expect(
          client.query(
            `INSERT INTO handoffs (id, source_conversation_id, source_erased_at, created_at, owner_creator_id)
             VALUES ('hd-bad-null', NULL, NULL, NOW(), 'creator_m16_check')`,
          ),
        ).rejects.toThrow();
        await expect(
          client.query(
            `INSERT INTO handoffs (id, source_conversation_id, source_erased_at, created_at, owner_creator_id)
             VALUES ('hd-bad-both', 'conv-check', NOW(), NOW(), 'creator_m16_check')`,
          ),
        ).rejects.toThrow();
        await client.query(
          `INSERT INTO handoffs (id, source_conversation_id, source_erased_at, created_at, owner_creator_id)
           VALUES ('hd-retained', 'conv-check', NULL, NOW(), 'creator_m16_check')`,
        );
        await client.query(
          `INSERT INTO handoffs (id, source_conversation_id, source_erased_at, created_at, owner_creator_id)
           VALUES ('hd-erased', NULL, NOW(), NOW(), 'creator_m16_check')`,
        );
      } finally {
        client.release();
      }
    });
  });

  describe("M12 post-migration runtime", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "007_published_provenance_split.sql");
      } finally {
        client.release();
      }
    });

    afterAll(async () => {
      await pool.end();
    });

    it("publish writes canonical snapshot and provenance rows atomically", async () => {
      const client = await pool.connect();
      try {
        await client.query(
          "TRUNCATE share_capabilities, published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
        );
      } finally {
        client.release();
      }
      await repos.creators.ensure({ id: "creator_pub", createdAt: "2026-09-25T00:00:00.000Z" });
      await repos.conversations.create({
        id: "conv-pub",
        source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
        messages: [
          {
            id: "conv-pub:m1",
            role: "creator",
            content: "Actually, web first.",
            source: { provider: "generic-text" },
          },
        ],
      });
      await repos.handoffs.create("hd-pub", "conv-pub", "creator_pub");
      await repos.drafts.save(
        createDraft("hd-pub", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-pub:m1", excerpt: "Actually, web first." }],
          }),
        ]),
      );
      const published = await repos.published.publish("hd-pub", "2026-09-25T00:00:00.000Z", 1);
      expect(Object.hasOwn(published.items[0]!, "sources")).toBe(false);
      const row = await pool.query(`SELECT snapshot_json FROM published_handoff_versions WHERE handoff_id = 'hd-pub'`);
      expect(row.rows[0].snapshot_json.items[0].sources).toBeUndefined();
      const prov = await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-pub'`);
      expect(prov.rows[0].c).toBe(1);
      const provenance = await repos.receiver.getProvenance("hd-pub", 1, ["web"]);
      expect(provenance.availability).toBe("retained");
    });
  });
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDraft } from "../../src/handoff/draft.js";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import {
  runPreflightOnClient,
  validateLegacyPublishedSnapshot,
} from "../../scripts/preflight-m12-provenance.mjs";

const execFileAsync = promisify(execFile);

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

async function applyMigration007(client: import("pg").PoolClient) {
  const sql007 = await readFile(migration007, "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql007);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function expectMigration007Fails(client: import("pg").PoolClient, pattern?: RegExp) {
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
  }).rejects.toThrow(pattern);
}

async function assertNoCommittedProvenanceTable(client: import("pg").PoolClient) {
  const reg = await client.query(`SELECT to_regclass('public.published_handoff_provenance') AS t`);
  if (reg.rows[0].t) {
    const prov = await client.query(`SELECT 1 FROM published_handoff_provenance LIMIT 1`);
    expect(prov.rowCount).toBe(0);
  }
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

    it("M16-1 — canonical preservation after migration", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        const legacySnapshot = await seedLegacyPublished(client);
        await applyMigration007(client);

        const after = await client.query(`SELECT snapshot_json FROM published_handoff_versions WHERE handoff_id = 'hd-m16'`);
        const snapshot = after.rows[0].snapshot_json;
        expect(snapshot.handoffId).toBe(legacySnapshot.handoffId);
        expect(snapshot.version).toBe(legacySnapshot.version);
        expect(snapshot.publishedAt).toBe(legacySnapshot.publishedAt);
        expect(snapshot.items[0].id).toBe("web");
        expect(snapshot.items[0].statement).toBe(legacySnapshot.items[0].statement);
        expect(snapshot.items[0].sources).toBeUndefined();
        expect(snapshot.items[1].id).toBe("empty");
        expect(snapshot.items[1].sources).toBeUndefined();
      } finally {
        client.release();
      }
    });

    it("M16-2 — provenance backfill", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await seedLegacyPublished(client);
        await applyMigration007(client);

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

    it("M16-3 — empty sources migrate with zero provenance rows", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await seedLegacyPublished(client);
        await applyMigration007(client);

        const prov = await client.query(
          `SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-m16' AND item_id = 'empty'`,
        );
        expect(prov.rows[0].c).toBe(0);
      } finally {
        client.release();
      }
    });

    it("M16-4 — multiple refs and duplicate message positions stay distinct", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        const creator = "creator_m16_dup";
        await client.query(`INSERT INTO creators (id, created_at) VALUES ($1, NOW())`, [creator]);
        await client.query(
          `INSERT INTO source_conversations (id, provider, imported_at) VALUES ('conv-m16-dup', 'generic-text', NOW())`,
        );
        await client.query(
          `INSERT INTO source_messages (id, conversation_id, ordinal, role, content, source_provider)
           VALUES ('conv-m16-dup:m1', 'conv-m16-dup', 0, 'creator', 'Alpha. Beta repeat Alpha.', 'generic-text')`,
        );
        await client.query(
          `INSERT INTO handoffs (id, source_conversation_id, created_at, owner_creator_id)
           VALUES ('hd-m16-dup', 'conv-m16-dup', NOW(), $1)`,
          [creator],
        );
        await client.query(
          `INSERT INTO published_handoff_versions (handoff_id, version, published_at, snapshot_json)
           VALUES ('hd-m16-dup', 1, '2026-09-25T00:00:00.000Z', $1::jsonb)`,
          [
            JSON.stringify({
              handoffId: "hd-m16-dup",
              version: 1,
              publishedAt: "2026-09-25T00:00:00.000Z",
              items: [
                {
                  id: "multi",
                  type: "CONFIRMED",
                  statement: "Multi-source item.",
                  priority: "CORE",
                  createdBy: "CREATOR",
                  sources: [
                    { messageId: "conv-m16-dup:m1", excerpt: "Alpha." },
                    { messageId: "conv-m16-dup:m1", excerpt: "Beta repeat" },
                    { messageId: "conv-m16-dup:m1" },
                  ],
                },
              ],
            }),
          ],
        );
        await applyMigration007(client);

        const prov = await client.query(
          `SELECT source_index, message_id, excerpt FROM published_handoff_provenance
           WHERE handoff_id = 'hd-m16-dup' AND item_id = 'multi'
           ORDER BY source_index ASC`,
        );
        expect(prov.rowCount).toBe(3);
        expect(prov.rows.map((row) => row.source_index)).toEqual([0, 1, 2]);
        expect(prov.rows.every((row) => row.message_id === "conv-m16-dup:m1")).toBe(true);
        expect(prov.rows[0].excerpt).toBe("Alpha.");
        expect(prov.rows[1].excerpt).toBe("Beta repeat");
        expect(prov.rows[2].excerpt).toBeNull();
      } finally {
        client.release();
      }
    });

    it("preflight PASS on valid legacy 001–006 fixture", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await seedLegacyPublished(client);
        const pub = await client.query(
          `SELECT handoff_id, version, snapshot_json, published_at FROM published_handoff_versions WHERE handoff_id = 'hd-m16'`,
        );
        expect(() => validateLegacyPublishedSnapshot(pub.rows[0].snapshot_json, pub.rows[0])).not.toThrow();
        const stats = await runPreflightOnClient(client);
        expect(stats.publishedVersions).toBe(1);
        expect(stats.sourceReferences).toBe(1);
        const { stdout } = await execFileAsync("node", ["scripts/preflight-m12-provenance.mjs"], {
          cwd: root,
          env: { ...process.env, TEST_DATABASE_URL: url },
        });
        expect(stdout).toMatch(/preflight PASS/i);
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
        await expectMigration007Fails(client, /missing source message/i);
        await assertNoCommittedProvenanceTable(client);
        const snap = await client.query(
          `SELECT snapshot_json->'items'->0 ? 'sources' AS has_sources FROM published_handoff_versions WHERE handoff_id = 'hd-m16-bad'`,
        );
        expect(snap.rows[0].has_sources).toBe(true);
      } finally {
        client.release();
      }
    });

    it("M16-6 — wrong conversation reference blocks migration", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m16_wrong', NOW())`);
        await client.query(
          `INSERT INTO source_conversations (id, provider, imported_at) VALUES ('conv-a', 'generic-text', NOW()), ('conv-b', 'generic-text', NOW())`,
        );
        await client.query(
          `INSERT INTO source_messages (id, conversation_id, ordinal, role, content, source_provider)
           VALUES ('conv-b:m1', 'conv-b', 0, 'creator', 'Wrong conv content.', 'generic-text')`,
        );
        await client.query(
          `INSERT INTO handoffs (id, source_conversation_id, created_at, owner_creator_id)
           VALUES ('hd-m16-wrong', 'conv-a', NOW(), 'creator_m16_wrong')`,
        );
        const legacyJson = {
          handoffId: "hd-m16-wrong",
          version: 1,
          publishedAt: "2026-09-25T00:00:00.000Z",
          items: [
            {
              id: "web",
              type: "CONFIRMED",
              statement: "Wrong conv ref.",
              priority: "CORE",
              createdBy: "CREATOR",
              sources: [{ messageId: "conv-b:m1", excerpt: "Wrong conv" }],
            },
          ],
        };
        await client.query(
          `INSERT INTO published_handoff_versions (handoff_id, version, published_at, snapshot_json)
           VALUES ('hd-m16-wrong', 1, '2026-09-25T00:00:00.000Z', $1::jsonb)`,
          [JSON.stringify(legacyJson)],
        );
        expect(() =>
          validateLegacyPublishedSnapshot(legacyJson, {
            handoff_id: "hd-m16-wrong",
            version: 1,
            published_at: new Date("2026-09-25T00:00:00.000Z"),
          }),
        ).not.toThrow();
        await expect(runPreflightOnClient(client)).rejects.toThrow(/wrong conversation/i);

        await expectMigration007Fails(client, /wrong conversation/i);
        await assertNoCommittedProvenanceTable(client);
        const after = await client.query(`SELECT snapshot_json FROM published_handoff_versions WHERE handoff_id = 'hd-m16-wrong'`);
        expect(after.rows[0].snapshot_json).toEqual(legacyJson);
      } finally {
        client.release();
      }
    });

    it("M16-7 — malformed legacy snapshot rejected by preflight and migration", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await client.query(`INSERT INTO creators (id, created_at) VALUES ('creator_m16_mal', NOW())`);
        await client.query(
          `INSERT INTO source_conversations (id, provider, imported_at) VALUES ('conv-mal', 'generic-text', NOW())`,
        );
        await client.query(
          `INSERT INTO handoffs (id, source_conversation_id, created_at, owner_creator_id)
           VALUES ('hd-m16-mal-type', 'conv-mal', NOW(), 'creator_m16_mal')`,
        );
        const badType = {
          handoffId: "hd-m16-mal-type",
          version: 1,
          publishedAt: "2026-09-25T00:00:00.000Z",
          items: [
            {
              id: "x",
              type: "NOT_A_REAL_TYPE",
              statement: "Bad type.",
              priority: "CORE",
              createdBy: "CREATOR",
              sources: [],
            },
          ],
        };
        await client.query(
          `INSERT INTO published_handoff_versions (handoff_id, version, published_at, snapshot_json)
           VALUES ('hd-m16-mal-type', 1, '2026-09-25T00:00:00.000Z', $1::jsonb)`,
          [JSON.stringify(badType)],
        );

        expect(() =>
          validateLegacyPublishedSnapshot(badType, {
            handoff_id: "hd-m16-mal-type",
            version: 1,
            published_at: new Date("2026-09-25T00:00:00.000Z"),
          }),
        ).toThrow(/invalid type/i);

        await expectMigration007Fails(client, /invalid item type/i);
        await assertNoCommittedProvenanceTable(client);
        const row = await client.query(
          `SELECT snapshot_json FROM published_handoff_versions WHERE handoff_id = 'hd-m16-mal-type'`,
        );
        expect(row.rows[0].snapshot_json).toEqual(badType);
      } finally {
        client.release();
      }
    });

    it("M16-7b — invalid priority blocked by preflight validator", async () => {
      const badPriority = {
        handoffId: "hd-m16-mal-pri",
        version: 1,
        publishedAt: "2026-09-25T00:00:00.000Z",
        items: [
          {
            id: "y",
            type: "CONFIRMED",
            statement: "Bad priority.",
            priority: "LOW",
            createdBy: "CREATOR",
            sources: [],
          },
        ],
      };
      expect(() =>
        validateLegacyPublishedSnapshot(badPriority, {
          handoff_id: "hd-m16-mal-pri",
          version: 1,
          published_at: new Date("2026-09-25T00:00:00.000Z"),
        }),
      ).toThrow(/invalid priority/i);
    });

    it("M16-8 — Published UPDATE remains rejected after migration", async () => {
      const client = await pool.connect();
      try {
        await applyMigrationsThrough(client, "006_creator_handoff_library_index.sql");
        await seedLegacyPublished(client);
        await applyMigration007(client);
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
        await expectMigration007Fails(client);
        await assertNoCommittedProvenanceTable(client);
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
        await applyMigrationsThrough(client, "008_creator_lifecycle.sql");
      } finally {
        client.release();
      }
    });

    afterAll(async () => {
      await pool.end();
    });

    it("publication provenance rollback — failed provenance insert rolls back published version", async () => {
      const client = await pool.connect();
      try {
        await client.query(
          "TRUNCATE share_capabilities, published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
        );
        await client.query(`
          CREATE OR REPLACE FUNCTION test_reject_provenance_insert()
          RETURNS TRIGGER LANGUAGE plpgsql AS $$
          BEGIN
            IF NEW.handoff_id = 'hd-prov-fail' THEN
              RAISE EXCEPTION 'test injected provenance insert failure';
            END IF;
            RETURN NEW;
          END;
          $$;
        `);
        await client.query(`
          CREATE TRIGGER test_reject_provenance_insert
          BEFORE INSERT ON published_handoff_provenance
          FOR EACH ROW EXECUTE FUNCTION test_reject_provenance_insert();
        `);
      } finally {
        client.release();
      }

      await repos.creators.ensure({ id: "creator_fail", createdAt: "2026-09-25T00:00:00.000Z" });
      await repos.conversations.create({
        id: "conv-fail",
        source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
        messages: [
          {
            id: "conv-fail:m1",
            role: "creator",
            content: "Inject failure path.",
            source: { provider: "generic-text" },
          },
        ],
      });
      await repos.handoffs.create("hd-prov-fail", "conv-fail", "creator_fail");
      await repos.drafts.save(
        createDraft("hd-prov-fail", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Should not publish.",
            sources: [{ messageId: "conv-fail:m1", excerpt: "Inject failure" }],
          }),
        ]),
      );

      await expect(repos.published.publish("hd-prov-fail", "2026-09-25T00:00:00.000Z", 1)).rejects.toThrow(
        /test injected provenance insert failure/i,
      );

      const pub = await pool.query(`SELECT 1 FROM published_handoff_versions WHERE handoff_id = 'hd-prov-fail'`);
      expect(pub.rowCount).toBe(0);
      const prov = await pool.query(`SELECT 1 FROM published_handoff_provenance WHERE handoff_id = 'hd-prov-fail'`);
      expect(prov.rowCount).toBe(0);

      const cleanup = await pool.connect();
      try {
        await cleanup.query(`DROP TRIGGER IF EXISTS test_reject_provenance_insert ON published_handoff_provenance`);
        await cleanup.query(`DROP FUNCTION IF EXISTS test_reject_provenance_insert()`);
      } finally {
        cleanup.release();
      }
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

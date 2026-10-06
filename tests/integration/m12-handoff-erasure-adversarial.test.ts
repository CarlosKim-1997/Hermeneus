import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDraft } from "../../src/handoff/draft.js";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { SourceBackedDraftRejectedError, SourceUnavailableError } from "../../src/persistence/errors.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { generateHandoffExtractionProposal } from "../../src/application/use-cases/generate-extraction-proposal.js";
import {
  askSharedReceiverQuestion,
  fetchSharedReceiverProvenance,
  loadSharedReceiverView,
  SHARE_UNAVAILABLE_MESSAGE,
} from "../../src/application/use-cases/shared-receiver-qa.js";
import { issueShareCapability } from "../../src/application/use-cases/share-capability.js";
import { generateShareToken, hashShareToken } from "../../src/share/token.js";
import type { HandoffExtractor } from "../../src/extraction/extractor.js";
import type { Pool, PoolClient } from "pg";

const url = process.env.TEST_DATABASE_URL;
const CREATOR_A = "creator_adv_a";

/** Test-only advisory lock keys (session-level; released explicitly in tests). */
const LOCK_DRAFT_UPDATE = 92001;
const LOCK_SHARE_INSERT = 92002;
const LOCK_PUBLISH_VERSION_INSERT = 92003;

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return { priority: "CORE", createdBy: "CREATOR", sources: [], ...partial };
}

const conversation = {
  id: "conv-adv",
  source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
  messages: [
    {
      id: "conv-adv:m1",
      role: "creator" as const,
      content: "Actually, web first.",
      source: { provider: "generic-text" },
    },
  ],
};

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function installAdvisoryLockTrigger(
  client: PoolClient,
  opts: {
    functionName: string;
    triggerName: string;
    table: string;
    event: "INSERT" | "UPDATE" | "DELETE";
    lockKey: number;
    whenClause?: string;
  },
) {
  const when = opts.whenClause ? `WHEN (${opts.whenClause})` : "";
  await client.query(`
    CREATE OR REPLACE FUNCTION ${opts.functionName}()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_lock(${opts.lockKey});
      PERFORM pg_advisory_unlock(${opts.lockKey});
      RETURN ${opts.event === "DELETE" ? "OLD" : "NEW"};
    END;
    $$;
  `);
  await client.query(`DROP TRIGGER IF EXISTS ${opts.triggerName} ON ${opts.table}`);
  await client.query(`
    CREATE TRIGGER ${opts.triggerName}
      BEFORE ${opts.event} ON ${opts.table}
      FOR EACH ROW ${when}
      EXECUTE FUNCTION ${opts.functionName}();
  `);
}

async function dropTriggerFunction(client: PoolClient, triggerName: string, functionName: string, table: string) {
  await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON ${table}`);
  await client.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
}

async function installSourceEraseRollbackTrigger(client: PoolClient, handoffId: string) {
  await client.query(`
    CREATE OR REPLACE FUNCTION test_fail_handoff_source_erase_update()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id = '${handoffId}' AND NEW.source_erased_at IS NOT NULL AND OLD.source_erased_at IS NULL THEN
        RAISE EXCEPTION 'test injected source erase rollback';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
  await client.query(`
    DROP TRIGGER IF EXISTS test_fail_handoff_source_erase_trg ON handoffs;
    CREATE TRIGGER test_fail_handoff_source_erase_trg
      BEFORE UPDATE ON handoffs
      FOR EACH ROW EXECUTE FUNCTION test_fail_handoff_source_erase_update();
  `);
}

async function dropSourceEraseRollbackTrigger(client: PoolClient) {
  await client.query(`DROP TRIGGER IF EXISTS test_fail_handoff_source_erase_trg ON handoffs`);
  await client.query(`DROP FUNCTION IF EXISTS test_fail_handoff_source_erase_update()`);
}

async function countAdvisoryLockWaiters(pool: Pool, lockKey: number): Promise<number> {
  const r = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c
     FROM pg_locks
     WHERE locktype = 'advisory'
       AND classid = 0
       AND objid = $1::bigint
       AND objsubid = 1
       AND NOT granted`,
    [lockKey],
  );
  return r.rows[0]?.c ?? 0;
}

async function countBackendLockWaits(pool: Pool): Promise<number> {
  const r = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c
     FROM pg_stat_activity
     WHERE datname = current_database()
       AND wait_event_type = 'Lock'`,
  );
  return r.rows[0]?.c ?? 0;
}

async function waitUntil(
  predicate: () => Promise<boolean>,
  { timeoutMs = 8000, intervalMs = 25 }: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("waitUntil timed out");
}

async function sourceErasedAt(pool: Pool, handoffId: string): Promise<Date | null> {
  const row = await pool.query<{ source_erased_at: Date | null }>(
    `SELECT source_erased_at FROM handoffs WHERE id = $1`,
    [handoffId],
  );
  return row.rows[0]?.source_erased_at ?? null;
}

if (!url) {
  describe.skip("M12 handoff erasure adversarial", () => undefined);
} else {
  describe("M12 handoff erasure adversarial", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      execSync("node scripts/migrate.mjs", { env: { ...process.env, TEST_DATABASE_URL: url }, stdio: "pipe" });
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE share_capabilities, published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
      await repos.creators.ensure({ id: CREATOR_A, createdAt: "2026-09-25T00:00:00.000Z" });
    });

    afterAll(async () => {
      const client = await pool.connect();
      try {
        await dropSourceEraseRollbackTrigger(client);
        await dropTriggerFunction(client, "test_barrier_draft_update_trg", "test_barrier_draft_update", "handoff_drafts");
        await dropTriggerFunction(
          client,
          "test_barrier_publish_insert_trg",
          "test_barrier_publish_insert",
          "published_handoff_versions",
        );
      } finally {
        client.release();
        await pool.end();
      }
    });

    async function seedPublished(handoffId: string, withProvenance = true) {
      await repos.conversations.create(conversation);
      await repos.handoffs.create(handoffId, "conv-adv", CREATOR_A);
      await repos.drafts.save(
        createDraft(handoffId, [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: withProvenance ? [{ messageId: "conv-adv:m1", excerpt: "Actually, web first." }] : [],
          }),
        ]),
      );
      return repos.published.publish(handoffId, "2026-09-25T00:00:00.000Z", 1);
    }

    it("E17-S5 — Published canonical bytes unchanged by Source Erasure", async () => {
      const before = await seedPublished("hd-s5");
      const snapBefore = JSON.stringify(before);
      await repos.erasure.eraseSource("hd-s5", CREATOR_A, "2026-10-06T12:00:00.000Z");
      const after = await repos.published.get("hd-s5", 1);
      expect(JSON.stringify(after)).toBe(snapBefore);
    });

    it("E17-S10 — extraction erased while model in flight", async () => {
      await seedPublished("hd-s10");
      const started = deferred();
      let resolveModel!: () => void;
      const modelDone = new Promise<void>((r) => {
        resolveModel = r;
      });
      let extractCalls = 0;
      const extractor: HandoffExtractor = {
        extract: async () => {
          extractCalls += 1;
          started.resolve();
          await modelDone;
          return {
            candidates: [
              {
                type: "CONFIRMED",
                statement: "Should not return.",
                priority: "CORE",
                sources: [{ messageId: "conv-adv:m1", excerpt: "Actually, web first." }],
              },
            ],
          };
        },
      };
      const running = generateHandoffExtractionProposal(repos, extractor, "hd-s10");
      await started.promise;
      await repos.erasure.eraseSource("hd-s10", CREATOR_A, "2026-10-06T12:00:00.000Z");
      resolveModel();
      await expect(running).rejects.toBeInstanceOf(SourceUnavailableError);
      expect(extractCalls).toBe(1);
    });

    it("E17-S11 shared — canonical share survives Source Erasure; provenance unavailable", async () => {
      await seedPublished("hd-s11-sh");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s11-sh", version: 1 });
      const viewBefore = await loadSharedReceiverView(repos, issued.rawToken);
      expect(viewBefore?.items.length).toBeGreaterThan(0);
      const qaBefore = await askSharedReceiverQuestion(repos, { token: issued.rawToken, question: "web?" });
      expect(qaBefore.kind).toBe("answer");

      await repos.erasure.eraseSource("hd-s11-sh", CREATOR_A, "2026-10-06T12:00:00.000Z");

      const viewAfter = await loadSharedReceiverView(repos, issued.rawToken);
      expect(viewAfter?.items[0]?.statement).toBe(viewBefore?.items[0]?.statement);
      const qaAfter = await askSharedReceiverQuestion(repos, { token: issued.rawToken, question: "web?" });
      expect(qaAfter.kind).toBe("answer");
      const prov = await fetchSharedReceiverProvenance(repos, { token: issued.rawToken, itemIds: ["web"] });
      expect(prov.kind).toBe("unavailable");
      expect(JSON.stringify(prov)).not.toMatch(/messageId|conv-adv|source_erased|erasedAt/i);
    });

    it("E17-S12 — Source Erasure rollback restores all state", async () => {
      await seedPublished("hd-s12-rb");
      const client = await pool.connect();
      try {
        await installSourceEraseRollbackTrigger(client, "hd-s12-rb");
        const beforeDraft = await repos.drafts.get("hd-s12-rb");
        const revBefore = await repos.drafts.getRevision("hd-s12-rb");
        const publishedBefore = await repos.published.get("hd-s12-rb", 1);
        const provBefore = await pool.query(
          `SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-s12-rb'`,
        );
        const msgBefore = await pool.query(
          `SELECT COUNT(*)::int AS c FROM source_messages WHERE conversation_id = 'conv-adv'`,
        );
        await expect(repos.erasure.eraseSource("hd-s12-rb", CREATOR_A, "2026-10-06T12:00:00.000Z")).rejects.toThrow(
          /test injected source erase rollback/i,
        );
        const erasedCol = await pool.query<{ source_erased_at: Date | null }>(
          `SELECT source_erased_at FROM handoffs WHERE id = 'hd-s12-rb'`,
        );
        expect(erasedCol.rows[0]!.source_erased_at).toBeNull();
        expect((await repos.handoffs.getHandoffSourceState("hd-s12-rb"))?.kind).toBe("retained");
        expect(await repos.drafts.getRevision("hd-s12-rb")).toBe(revBefore);
        expect(await repos.drafts.get("hd-s12-rb")).toEqual(beforeDraft);
        expect(beforeDraft?.items[0]?.sources.length).toBeGreaterThan(0);
        expect(await repos.published.get("hd-s12-rb", 1)).toEqual(publishedBefore);
        const provAfter = await pool.query(
          `SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-s12-rb'`,
        );
        expect(provAfter.rows[0].c).toBe(provBefore.rows[0].c);
        expect(await repos.conversations.get("conv-adv")).toBeDefined();
        const msgAfter = await pool.query(
          `SELECT COUNT(*)::int AS c FROM source_messages WHERE conversation_id = 'conv-adv'`,
        );
        expect(msgAfter.rows[0].c).toBe(msgBefore.rows[0].c);
      } finally {
        await dropSourceEraseRollbackTrigger(client);
        client.release();
      }
    });

    it("E17-H1 — multi-version multi-share complete delete", async () => {
      await seedPublished("hd-h1-full");
      await repos.drafts.save(
        createDraft("hd-h1-full", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Version two statement.",
            sources: [{ messageId: "conv-adv:m1", excerpt: "Actually, web first." }],
          }),
        ]),
        1,
      );
      await repos.published.publish("hd-h1-full", "2026-10-06T13:00:00.000Z", 2);
      const t1 = generateShareToken();
      const t2 = generateShareToken();
      await repos.shareCapabilities.create({
        id: "sh-1",
        handoffId: "hd-h1-full",
        version: 1,
        tokenHash: hashShareToken(t1),
        createdAt: "2026-09-25T00:00:00.000Z",
      });
      await repos.shareCapabilities.create({
        id: "sh-2",
        handoffId: "hd-h1-full",
        version: 2,
        tokenHash: hashShareToken(t2),
        createdAt: "2026-09-25T00:00:00.000Z",
      });
      await repos.erasure.deleteHandoff("hd-h1-full", CREATOR_A);
      expect((await pool.query(`SELECT COUNT(*)::int AS c FROM handoffs WHERE id = 'hd-h1-full'`)).rows[0].c).toBe(0);
      expect((await pool.query(`SELECT COUNT(*)::int AS c FROM handoff_drafts WHERE handoff_id = 'hd-h1-full'`)).rows[0].c).toBe(0);
      expect((await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_versions WHERE handoff_id = 'hd-h1-full'`)).rows[0].c).toBe(0);
      expect((await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-h1-full'`)).rows[0].c).toBe(0);
      expect((await pool.query(`SELECT COUNT(*)::int AS c FROM share_capabilities WHERE handoff_id = 'hd-h1-full'`)).rows[0].c).toBe(0);
      expect((await pool.query(`SELECT COUNT(*)::int AS c FROM source_conversations WHERE id = 'conv-adv'`)).rows[0].c).toBe(0);
      expect((await pool.query(`SELECT COUNT(*)::int AS c FROM source_messages WHERE conversation_id = 'conv-adv'`)).rows[0].c).toBe(0);
    });

    it("E17-H2 — shared view/Q&A/provenance fail closed after delete", async () => {
      await seedPublished("hd-h2");
      const issued = await issueShareCapability(repos, { handoffId: "hd-h2", version: 1 });
      await repos.erasure.deleteHandoff("hd-h2", CREATOR_A);
      expect(await loadSharedReceiverView(repos, issued.rawToken)).toBeUndefined();
      const qa = await askSharedReceiverQuestion(repos, { token: issued.rawToken, question: "web?" });
      expect(qa).toEqual({ kind: "unavailable" });
      const prov = await fetchSharedReceiverProvenance(repos, { token: issued.rawToken, itemIds: ["web"] });
      expect(prov).toEqual({ kind: "unavailable" });
      expect(JSON.stringify({ qa, prov })).not.toMatch(/hd-h2|conv-adv|messageId/i);
      expect(SHARE_UNAVAILABLE_MESSAGE).toBeTruthy();
    });

    it("E17-H6 — Whole-Handoff delete rollback", async () => {
      await seedPublished("hd-h6-rb");
      const issued = await issueShareCapability(repos, { handoffId: "hd-h6-rb", version: 1 });
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE OR REPLACE FUNCTION test_fail_handoff_root_delete()
          RETURNS TRIGGER LANGUAGE plpgsql AS $$
          BEGIN
            IF OLD.id = 'hd-h6-rb' THEN
              RAISE EXCEPTION 'test injected handoff delete rollback';
            END IF;
            RETURN OLD;
          END;
          $$;
        `);
        await client.query(`
          DROP TRIGGER IF EXISTS test_fail_handoff_root_delete_trg ON handoffs;
          CREATE TRIGGER test_fail_handoff_root_delete_trg
            BEFORE DELETE ON handoffs
            FOR EACH ROW EXECUTE FUNCTION test_fail_handoff_root_delete();
        `);
        await expect(repos.erasure.deleteHandoff("hd-h6-rb", CREATOR_A)).rejects.toThrow(/test injected handoff delete rollback/i);
        expect(await repos.handoffs.getOwnerCreatorId("hd-h6-rb")).toBe(CREATOR_A);
        expect((await pool.query(`SELECT COUNT(*)::int AS c FROM handoff_drafts WHERE handoff_id = 'hd-h6-rb'`)).rows[0].c).toBe(1);
        expect((await pool.query(`SELECT COUNT(*)::int AS c FROM share_capabilities WHERE handoff_id = 'hd-h6-rb'`)).rows[0].c).toBe(1);
        expect(await repos.published.get("hd-h6-rb", 1)).toBeDefined();
        expect(await loadSharedReceiverView(repos, issued.rawToken)).toBeDefined();
        const prov = await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-h6-rb'`);
        expect(prov.rows[0].c).toBeGreaterThan(0);
        expect((await pool.query(`SELECT COUNT(*)::int AS c FROM source_conversations WHERE id = 'conv-adv'`)).rows[0].c).toBe(1);
        expect((await pool.query(`SELECT COUNT(*)::int AS c FROM source_messages WHERE conversation_id = 'conv-adv'`)).rows[0].c).toBeGreaterThan(0);
      } finally {
        await client.query(`DROP TRIGGER IF EXISTS test_fail_handoff_root_delete_trg ON handoffs`);
        await client.query(`DROP FUNCTION IF EXISTS test_fail_handoff_root_delete()`);
        client.release();
      }
    });

    it(
      "E17-H7 — delete wins while share issuance waits (Handoff FOR UPDATE gate)",
      async () => {
        const handoffId = "hd-h7-del";
        await seedPublished(handoffId);
        const gate = await pool.connect();
        try {
          await gate.query("BEGIN");
          await gate.query(`SELECT id FROM handoffs WHERE id = $1 FOR UPDATE`, [handoffId]);

          const deletePromise = repos.erasure.deleteHandoff(handoffId, CREATOR_A);
          await waitUntil(async () => (await countBackendLockWaits(pool)) >= 1);

          const sharePromise = issueShareCapability(repos, { handoffId, version: 1 }).catch((error) => error);
          await waitUntil(async () => (await countBackendLockWaits(pool)) >= 1);

          await gate.query("COMMIT");
          await deletePromise;
          const shareOutcome = await sharePromise;
          expect(shareOutcome).toBeInstanceOf(Error);
          expect(String(shareOutcome)).toMatch(/unavailable|Only a published Handoff version can be shared/i);
          expect(await repos.handoffs.getOwnerCreatorId(handoffId)).toBeUndefined();
          expect((await pool.query(`SELECT COUNT(*)::int AS c FROM share_capabilities WHERE handoff_id = $1`, [handoffId])).rows[0].c).toBe(0);
        } finally {
          await gate.query("ROLLBACK").catch(() => undefined);
          gate.release();
        }
      },
      30_000,
    );

    it(
      "E17-H7 — share wins via issueShareCapability while delete waits (INSERT advisory barrier)",
      async () => {
        const handoffId = "hd-h7-sh";
        await seedPublished(handoffId);
        const setup = await pool.connect();
        const gate = await pool.connect();
        try {
          await installAdvisoryLockTrigger(setup, {
            functionName: "test_barrier_share_insert",
            triggerName: "test_barrier_share_insert_trg",
            table: "share_capabilities",
            event: "INSERT",
            lockKey: LOCK_SHARE_INSERT,
          });
          await gate.query(`SELECT pg_advisory_lock($1)`, [LOCK_SHARE_INSERT]);

          const sharePromise = (async () => {
            const published = await repos.published.get(handoffId, 1);
            if (!published) throw new Error("missing published version");
            return issueShareCapability(repos, { handoffId, version: 1 });
          })();
          await waitUntil(async () => (await countAdvisoryLockWaiters(pool, LOCK_SHARE_INSERT)) > 0);

          const deletePromise = repos.erasure.deleteHandoff(handoffId, CREATOR_A);
          await waitUntil(async () => (await countBackendLockWaits(pool)) >= 1);

          await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_SHARE_INSERT]);
          const issued = await sharePromise;
          await deletePromise;
          expect(await loadSharedReceiverView(repos, issued.rawToken)).toBeUndefined();
        } finally {
          await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_SHARE_INSERT]).catch(() => undefined);
          gate.release();
          await dropTriggerFunction(setup, "test_barrier_share_insert_trg", "test_barrier_share_insert", "share_capabilities");
          setup.release();
        }
      },
      30_000,
    );

    it("provenance read first then Source Erasure (external FOR SHARE holds erase; repos.receiver.getProvenance)", async () => {
      await seedPublished("hd-pr1");
      const readClient = await pool.connect();
      try {
        await readClient.query("BEGIN");
        await readClient.query(`SELECT source_erased_at FROM handoffs WHERE id = $1 FOR SHARE`, ["hd-pr1"]);
        const erasePromise = repos.erasure.eraseSource("hd-pr1", CREATOR_A, "2026-10-06T12:00:00.000Z");
        await waitUntil(async () => (await sourceErasedAt(pool, "hd-pr1")) === null);
        const bundle = await repos.receiver.getProvenance("hd-pr1", 1, ["web"]);
        expect(bundle.availability).toBe("retained");
        if (bundle.availability === "retained") {
          expect(bundle.items[0]?.references.length).toBeGreaterThan(0);
        }
        await readClient.query("COMMIT");
        await erasePromise;
        const after = await repos.receiver.getProvenance("hd-pr1", 1, ["web"]);
        expect(after.availability).toBe("unavailable_erased");
      } finally {
        await readClient.query("ROLLBACK").catch(() => undefined);
        readClient.release();
      }
    });

    it("Source Erasure first then provenance read returns unavailable_erased", async () => {
      await seedPublished("hd-pr2");
      await repos.erasure.eraseSource("hd-pr2", CREATOR_A, "2026-10-06T12:00:00.000Z");
      const after = await repos.receiver.getProvenance("hd-pr2", 1, ["web"]);
      expect(after.availability).toBe("unavailable_erased");
    });

    it("Draft save first via PostgresDraftRepository.save then Source Erasure", async () => {
      const handoffId = "hd-ds1";
      await seedPublished(handoffId);
      const setup = await pool.connect();
      const gate = await pool.connect();
      try {
        await installAdvisoryLockTrigger(setup, {
          functionName: "test_barrier_draft_update",
          triggerName: "test_barrier_draft_update_trg",
          table: "handoff_drafts",
          event: "UPDATE",
          lockKey: LOCK_DRAFT_UPDATE,
          whenClause: `OLD.handoff_id = '${handoffId}'`,
        });
        await gate.query(`SELECT pg_advisory_lock($1)`, [LOCK_DRAFT_UPDATE]);

        const savePromise = repos.drafts.save(
          createDraft(handoffId, [
            item({
              id: "web",
              type: "OPEN",
              statement: "Saved via repos.drafts.save while erase waited.",
              sources: [{ messageId: "conv-adv:m1", excerpt: "Actually, web first." }],
            }),
          ]),
          1,
        );
        await waitUntil(async () => (await countAdvisoryLockWaiters(pool, LOCK_DRAFT_UPDATE)) > 0);

        const erasePromise = repos.erasure.eraseSource(handoffId, CREATOR_A, "2026-10-06T12:00:00.000Z");
        await waitUntil(async () => (await sourceErasedAt(pool, handoffId)) === null);

        await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_DRAFT_UPDATE]);
        await savePromise;
        await erasePromise;

        const finalDraft = await repos.drafts.get(handoffId);
        expect(finalDraft?.items[0]?.statement).toBe("Saved via repos.drafts.save while erase waited.");
        expect(finalDraft?.items[0]?.sources).toEqual([]);
        expect(await repos.drafts.getRevision(handoffId)).toBe(3);
      } finally {
        await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_DRAFT_UPDATE]).catch(() => undefined);
        gate.release();
        await dropTriggerFunction(setup, "test_barrier_draft_update_trg", "test_barrier_draft_update", "handoff_drafts");
        setup.release();
      }
    });

    it("Source Erasure first rejects stale source-backed Draft save", async () => {
      await seedPublished("hd-ds2");
      await repos.erasure.eraseSource("hd-ds2", CREATOR_A, "2026-10-06T12:00:00.000Z");
      const stale = createDraft("hd-ds2", [
        item({ id: "web", type: "CONFIRMED", statement: "Stale.", sources: [{ messageId: "conv-adv:m1" }] }),
      ]);
      await expect(repos.drafts.save(stale, 2)).rejects.toBeInstanceOf(SourceBackedDraftRejectedError);
    });

    it("Publish first via repos.published.publish then Source Erasure (publish barrier)", async () => {
      const handoffId = "hd-pe1";
      await seedPublished(handoffId);
      await repos.drafts.save(
        createDraft(handoffId, [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "V2 canonical.",
            sources: [{ messageId: "conv-adv:m1", excerpt: "Actually, web first." }],
          }),
        ]),
        1,
      );
      const setup = await pool.connect();
      const gate = await pool.connect();
      try {
        await installAdvisoryLockTrigger(setup, {
          functionName: "test_barrier_publish_insert",
          triggerName: "test_barrier_publish_insert_trg",
          table: "published_handoff_versions",
          event: "INSERT",
          lockKey: LOCK_PUBLISH_VERSION_INSERT,
          whenClause: `NEW.handoff_id = '${handoffId}'`,
        });
        await gate.query(`SELECT pg_advisory_lock($1)`, [LOCK_PUBLISH_VERSION_INSERT]);

        const publishPromise = repos.published.publish(handoffId, "2026-10-06T13:00:00.000Z", 2);
        await waitUntil(async () => (await countAdvisoryLockWaiters(pool, LOCK_PUBLISH_VERSION_INSERT)) > 0);

        const erasePromise = repos.erasure.eraseSource(handoffId, CREATOR_A, "2026-10-06T14:00:00.000Z");
        await waitUntil(async () => (await sourceErasedAt(pool, handoffId)) === null);

        await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_PUBLISH_VERSION_INSERT]);
        const v2 = await publishPromise;
        await erasePromise;

        expect((await repos.published.get(handoffId, 2))?.items[0]?.statement).toBe(v2.items[0]?.statement);
        const prov = await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = $1`, [
          handoffId,
        ]);
        expect(prov.rows[0].c).toBe(0);
      } finally {
        await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_PUBLISH_VERSION_INSERT]).catch(() => undefined);
        gate.release();
        await dropTriggerFunction(
          setup,
          "test_barrier_publish_insert_trg",
          "test_barrier_publish_insert",
          "published_handoff_versions",
        );
        setup.release();
      }
    });

    it("Source Erasure first blocks stale publication; canonical-only publish succeeds", async () => {
      await seedPublished("hd-pe2");
      await repos.erasure.eraseSource("hd-pe2", CREATOR_A, "2026-10-06T12:00:00.000Z");
      await repos.drafts.save(createDraft("hd-pe2", [item({ id: "web", type: "CONFIRMED", statement: "Only canonical.", sources: [] })]), 2);
      const v2 = await repos.published.publish("hd-pe2", "2026-10-06T13:00:00.000Z", 3);
      expect(v2.version).toBe(2);
    });
  });
}

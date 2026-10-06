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
import type { PoolClient } from "pg";

const url = process.env.TEST_DATABASE_URL;
const CREATOR_A = "creator_adv_a";
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
        await expect(repos.erasure.eraseSource("hd-s12-rb", CREATOR_A, "2026-10-06T12:00:00.000Z")).rejects.toThrow(
          /test injected source erase rollback/i,
        );
        expect((await repos.handoffs.getHandoffSourceState("hd-s12-rb"))?.kind).toBe("retained");
        expect(await repos.drafts.getRevision("hd-s12-rb")).toBe(revBefore);
        expect(await repos.drafts.get("hd-s12-rb")).toEqual(beforeDraft);
        expect(await repos.published.get("hd-s12-rb", 1)).toEqual(publishedBefore);
        const provAfter = await pool.query(
          `SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-s12-rb'`,
        );
        expect(provAfter.rows[0].c).toBe(provBefore.rows[0].c);
        expect(await repos.conversations.get("conv-adv")).toBeDefined();
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
        expect(await repos.published.get("hd-h6-rb", 1)).toBeDefined();
        expect(await loadSharedReceiverView(repos, issued.rawToken)).toBeDefined();
        const prov = await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-h6-rb'`);
        expect(prov.rows[0].c).toBeGreaterThan(0);
      } finally {
        await client.query(`DROP TRIGGER IF EXISTS test_fail_handoff_root_delete_trg ON handoffs`);
        await client.query(`DROP FUNCTION IF EXISTS test_fail_handoff_root_delete()`);
        client.release();
      }
    });

    it("E17-H7 — delete vs share concurrent linearization (delete path)", async () => {
      const handoffId = "hd-h7-del";
      await seedPublished(handoffId);
      const deletePromise = repos.erasure.deleteHandoff(handoffId, CREATOR_A);
      const sharePromise = issueShareCapability(repos, { handoffId, version: 1 });
      const outcomes = await Promise.allSettled([deletePromise, sharePromise]);
      const deleteOk = outcomes[0].status === "fulfilled";
      const shareOk = outcomes[1].status === "fulfilled";
      expect(deleteOk).toBe(true);
      expect(shareOk).toBe(false);
      expect(await repos.handoffs.getOwnerCreatorId(handoffId)).toBeUndefined();
    });

    it("E17-H7 — share wins concurrent delete race", async () => {
      const handoffId = "hd-h7-sh";
      await seedPublished(handoffId);
      const shareClient = await pool.connect();
      try {
        await shareClient.query("BEGIN");
        await shareClient.query(`SELECT 1 FROM handoffs WHERE id = $1 FOR SHARE`, [handoffId]);
        const deletePromise = repos.erasure.deleteHandoff(handoffId, CREATOR_A);
        await new Promise((r) => setTimeout(r, 50));
        const raw = generateShareToken();
        await shareClient.query(
          `INSERT INTO share_capabilities (id, handoff_id, version, token_hash, created_at)
           VALUES ('sh-h7', $1, 1, $2, NOW())`,
          [handoffId, hashShareToken(raw)],
        );
        await shareClient.query("COMMIT");
        await deletePromise;
        expect(await loadSharedReceiverView(repos, raw)).toBeUndefined();
      } finally {
        shareClient.release();
      }
    });

    it("provenance read first then Source Erasure linearizes retained", async () => {
      await seedPublished("hd-pr1");
      const readClient = await pool.connect();
      try {
        await readClient.query("BEGIN");
        await readClient.query(`SELECT source_erased_at FROM handoffs WHERE id = $1 FOR SHARE`, ["hd-pr1"]);
        const erasePromise = repos.erasure.eraseSource("hd-pr1", CREATOR_A, "2026-10-06T12:00:00.000Z");
        await new Promise((r) => setTimeout(r, 80));
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
        readClient.release();
      }
    });

    it("Source Erasure first then provenance read returns unavailable_erased", async () => {
      await seedPublished("hd-pr2");
      await repos.erasure.eraseSource("hd-pr2", CREATOR_A, "2026-10-06T12:00:00.000Z");
      const after = await repos.receiver.getProvenance("hd-pr2", 1, ["web"]);
      expect(after.availability).toBe("unavailable_erased");
    });

    it("Draft save first then Source Erasure strips latest edits", async () => {
      await seedPublished("hd-ds1");
      const saveClient = await pool.connect();
      try {
        await saveClient.query("BEGIN");
        await saveClient.query(`SELECT source_erased_at FROM handoffs WHERE id = $1 FOR UPDATE`, ["hd-ds1"]);
        const erasePromise = repos.erasure.eraseSource("hd-ds1", CREATOR_A, "2026-10-06T12:00:00.000Z");
        await new Promise((r) => setTimeout(r, 50));
        const draft = createDraft("hd-ds1", [
          item({ id: "web", type: "OPEN", statement: "Saved while erase waited.", sources: [{ messageId: "conv-adv:m1" }] }),
        ]);
        await saveClient.query(
          `UPDATE handoff_drafts SET revision = 2, snapshot_json = $2::jsonb, updated_at = NOW()
           WHERE handoff_id = $1 AND revision = 1`,
          ["hd-ds1", JSON.stringify(draft)],
        );
        await saveClient.query("COMMIT");
        await erasePromise;
        const finalDraft = await repos.drafts.get("hd-ds1");
        expect(finalDraft?.items[0]?.statement).toBe("Saved while erase waited.");
        expect(finalDraft?.items[0]?.sources).toEqual([]);
        expect(await repos.drafts.getRevision("hd-ds1")).toBe(3);
      } finally {
        saveClient.release();
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

    it("Publish first then Source Erasure removes new provenance only", async () => {
      await seedPublished("hd-pe1");
      await repos.drafts.save(
        createDraft("hd-pe1", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "V2 canonical.",
            sources: [{ messageId: "conv-adv:m1", excerpt: "Actually, web first." }],
          }),
        ]),
        1,
      );
      const v2 = await repos.published.publish("hd-pe1", "2026-10-06T13:00:00.000Z", 2);
      await repos.erasure.eraseSource("hd-pe1", CREATOR_A, "2026-10-06T14:00:00.000Z");
      expect((await repos.published.get("hd-pe1", 2))?.items[0]?.statement).toBe(v2.items[0]?.statement);
      const prov = await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-pe1'`);
      expect(prov.rows[0].c).toBe(0);
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

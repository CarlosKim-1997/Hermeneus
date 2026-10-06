import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDraft } from "../../src/handoff/draft.js";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { CreatorLifecycleUnavailableError } from "../../src/persistence/errors.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { issueShareCapability, revokeShareCapability } from "../../src/application/use-cases/share-capability.js";
import {
  askSharedReceiverQuestion,
  fetchSharedReceiverProvenance,
  loadSharedReceiverView,
  SHARE_UNAVAILABLE_MESSAGE,
} from "../../src/application/use-cases/shared-receiver-qa.js";
import { resolveOrCreateCreatorForExternalIdentity } from "../../src/application/use-cases/resolve-external-creator.js";
import { generateHandoffExtractionProposal } from "../../src/application/use-cases/generate-extraction-proposal.js";
import type { HandoffExtractor } from "../../src/extraction/extractor.js";
import { SourceUnavailableError } from "../../src/persistence/errors.js";
import type { Pool, PoolClient } from "pg";

const url = process.env.TEST_DATABASE_URL;
const CREATOR_A = "creator_acc_a";
const CREATOR_B = "creator_acc_b";

const LOCK_DRAFT_UPDATE = 93001;
const LOCK_SHARE_DELETE = 93002;
const LOCK_SHARE_REVOKE = 93003;

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return { priority: "CORE", createdBy: "CREATOR", sources: [], ...partial };
}

const conversation = {
  id: "conv-acc",
  source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
  messages: [
    {
      id: "conv-acc:m1",
      role: "creator" as const,
      content: "Actually, web first.",
      source: { provider: "generic-text" },
    },
  ],
};

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("waitUntil timeout");
}

async function countAdvisoryLockWaiters(pool: Pool, lockKey: number) {
  const result = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND granted = false`,
    [lockKey],
  );
  return result.rows[0]?.c ?? 0;
}

async function installDraftUpdateBarrier(client: PoolClient, handoffId: string) {
  await client.query(`
    CREATE OR REPLACE FUNCTION test_barrier_draft_update_acc()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_lock(${LOCK_DRAFT_UPDATE});
      PERFORM pg_advisory_unlock(${LOCK_DRAFT_UPDATE});
      RETURN NEW;
    END;
    $$;
  `);
  await client.query(`DROP TRIGGER IF EXISTS test_barrier_draft_update_acc_trg ON handoff_drafts`);
  await client.query(`
    CREATE TRIGGER test_barrier_draft_update_acc_trg
      BEFORE UPDATE ON handoff_drafts
      FOR EACH ROW
      WHEN (OLD.handoff_id = '${handoffId}')
      EXECUTE FUNCTION test_barrier_draft_update_acc();
  `);
}

async function dropDraftUpdateBarrier(client: PoolClient) {
  await client.query(`DROP TRIGGER IF EXISTS test_barrier_draft_update_acc_trg ON handoff_drafts`);
  await client.query(`DROP FUNCTION IF EXISTS test_barrier_draft_update_acc()`);
}

async function installShareDeleteBarrier(client: PoolClient) {
  await client.query(`
    CREATE OR REPLACE FUNCTION test_barrier_share_delete_acc()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_lock(${LOCK_SHARE_DELETE});
      PERFORM pg_advisory_unlock(${LOCK_SHARE_DELETE});
      RETURN OLD;
    END;
    $$;
  `);
  await client.query(`DROP TRIGGER IF EXISTS test_barrier_share_delete_acc_trg ON share_capabilities`);
  await client.query(`
    CREATE TRIGGER test_barrier_share_delete_acc_trg
      BEFORE DELETE ON share_capabilities
      FOR EACH ROW
      EXECUTE FUNCTION test_barrier_share_delete_acc();
  `);
}

async function dropShareDeleteBarrier(client: PoolClient) {
  await client.query(`DROP TRIGGER IF EXISTS test_barrier_share_delete_acc_trg ON share_capabilities`);
  await client.query(`DROP FUNCTION IF EXISTS test_barrier_share_delete_acc()`);
}

async function installShareRevokeBarrier(client: PoolClient) {
  await client.query(`
    CREATE OR REPLACE FUNCTION test_barrier_share_revoke_acc()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_lock(${LOCK_SHARE_REVOKE});
      PERFORM pg_advisory_unlock(${LOCK_SHARE_REVOKE});
      RETURN NEW;
    END;
    $$;
  `);
  await client.query(`DROP TRIGGER IF EXISTS test_barrier_share_revoke_acc_trg ON share_capabilities`);
  await client.query(`
    CREATE TRIGGER test_barrier_share_revoke_acc_trg
      BEFORE UPDATE OF revoked_at ON share_capabilities
      FOR EACH ROW
      WHEN (NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL)
      EXECUTE FUNCTION test_barrier_share_revoke_acc();
  `);
}

async function dropShareRevokeBarrier(client: PoolClient) {
  await client.query(`DROP TRIGGER IF EXISTS test_barrier_share_revoke_acc_trg ON share_capabilities`);
  await client.query(`DROP FUNCTION IF EXISTS test_barrier_share_revoke_acc()`);
}

async function seedRichHandoff(
  repos: ReturnType<typeof createPostgresRepositories>,
  handoffId: string,
  owner: string,
  convId = "conv-acc",
) {
  await repos.conversations.create(conversation);
  await repos.handoffs.create(handoffId, convId, owner);
  await repos.drafts.save(
    createDraft(handoffId, [
      item({
        id: "web",
        type: "CONFIRMED",
        statement: "Web-first is confirmed.",
        sources: [{ messageId: "conv-acc:m1", excerpt: "Actually, web first." }],
      }),
    ]),
  );
  await repos.published.publish(handoffId, "2026-09-25T00:00:00.000Z", 1);
  const issued = await issueShareCapability(repos, { handoffId, version: 1 });
  return issued.rawToken;
}

async function installPhase2FailureTrigger(client: PoolClient, creatorId: string) {
  await client.query(`
    CREATE OR REPLACE FUNCTION test_fail_account_phase2()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.id = '${creatorId}' THEN
        RAISE EXCEPTION 'test injected account phase2 failure';
      END IF;
      RETURN OLD;
    END;
    $$;
  `);
  await client.query(`DROP TRIGGER IF EXISTS test_fail_account_phase2_trg ON creators`);
  await client.query(`
    CREATE TRIGGER test_fail_account_phase2_trg
      BEFORE DELETE ON creators
      FOR EACH ROW
      EXECUTE FUNCTION test_fail_account_phase2();
  `);
}

async function dropPhase2FailureTrigger(client: PoolClient) {
  await client.query(`DROP TRIGGER IF EXISTS test_fail_account_phase2_trg ON creators`);
  await client.query(`DROP FUNCTION IF EXISTS test_fail_account_phase2()`);
}

if (!url) {
  describe.skip("M12 account erasure", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("M12 account erasure", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      const migrateEnv = { ...process.env, TEST_DATABASE_URL: url } as NodeJS.ProcessEnv;
      delete migrateEnv.DATABASE_URL;
      execSync("node scripts/migrate.mjs", { env: migrateEnv, stdio: "pipe" });
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE creator_external_identities, share_capabilities, published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
      await repos.creators.ensure({ id: CREATOR_A, createdAt: "2026-09-25T00:00:00.000Z" });
      await repos.creators.ensure({ id: CREATOR_B, createdAt: "2026-09-25T00:00:00.000Z" });
    });

    afterAll(async () => {
      await pool.end();
    });

    it("A18-1 — successful lifecycle active → erasing → row deleted", async () => {
      await seedRichHandoff(repos, "hd-a18-1", CREATOR_A);
      const phase1 = await repos.accountErasure.enterErasingPhase(CREATOR_A);
      expect(phase1.alreadyErasing).toBe(false);
      expect(await repos.creators.getLifecycleStatus(CREATOR_A)).toBe("erasing");
      await repos.accountErasure.completeAccountErasure(CREATOR_A);
      expect(await repos.creators.exists(CREATOR_A)).toBe(false);
    });

    it("A18-2 — multi-Handoff erase removes owned rows", async () => {
      await seedRichHandoff(repos, "hd-a18-2a", CREATOR_A);
      await repos.conversations.create({
        ...conversation,
        id: "conv-acc-2",
        messages: [{ ...conversation.messages[0]!, id: "conv-acc-2:m1" }],
      });
      await repos.handoffs.create("hd-a18-2b", "conv-acc-2", CREATOR_A);
      await repos.drafts.save(createDraft("hd-a18-2b", [item({ id: "b", type: "CONFIRMED", statement: "B." })]));
      await repos.published.publish("hd-a18-2b", "2026-09-25T00:00:00.000Z", 1);
      await repos.accountErasure.enterErasingPhase(CREATOR_A);
      await repos.accountErasure.completeAccountErasure(CREATOR_A);
      for (const id of ["hd-a18-2a", "hd-a18-2b"]) {
        expect(await repos.handoffs.getOwnerCreatorId(id)).toBeUndefined();
        expect((await pool.query(`SELECT 1 FROM handoff_drafts WHERE handoff_id = $1`, [id])).rowCount).toBe(0);
        expect((await pool.query(`SELECT 1 FROM published_handoff_versions WHERE handoff_id = $1`, [id])).rowCount).toBe(0);
        expect((await pool.query(`SELECT 1 FROM share_capabilities WHERE handoff_id = $1`, [id])).rowCount).toBe(0);
        expect(
          (await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = $1`, [id])).rows[0]
            .c,
        ).toBe(0);
      }
      expect(await repos.conversations.get("conv-acc")).toBeUndefined();
      expect(await repos.conversations.get("conv-acc-2")).toBeUndefined();
      expect(
        (await pool.query(`SELECT COUNT(*)::int AS c FROM source_messages WHERE conversation_id IN ('conv-acc', 'conv-acc-2')`))
          .rows[0].c,
      ).toBe(0);
    });

    it("A18-3 — cross-owner shared source: delete A, B remains functional", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("hd-a18-a", "conv-acc", CREATOR_A);
      await repos.handoffs.create("hd-a18-b", "conv-acc", CREATOR_B);
      await repos.drafts.save(createDraft("hd-a18-a", [item({ id: "a", type: "CONFIRMED", statement: "A." })]));
      await repos.drafts.save(
        createDraft("hd-a18-b", [
          item({
            id: "b",
            type: "CONFIRMED",
            statement: "B.",
            sources: [{ messageId: "conv-acc:m1", excerpt: "Actually, web first." }],
          }),
        ]),
      );
      await repos.published.publish("hd-a18-a", "2026-09-25T00:00:00.000Z", 1);
      await repos.published.publish("hd-a18-b", "2026-09-25T00:00:00.000Z", 1);
      await repos.accountErasure.enterErasingPhase(CREATOR_A);
      await repos.accountErasure.completeAccountErasure(CREATOR_A);
      expect(await repos.conversations.get("conv-acc")).toBeDefined();
      expect(await repos.handoffs.getOwnerCreatorId("hd-a18-b")).toBe(CREATOR_B);
      const prov = await repos.receiver.getProvenance("hd-a18-b", 1, ["b"]);
      expect(prov.availability).toBe("retained");
    });

    it("A18-4 — share tokens unavailable immediately after Phase 1", async () => {
      const token = await seedRichHandoff(repos, "hd-a18-4", CREATOR_A);
      expect(await loadSharedReceiverView(repos, token)).toBeDefined();
      await repos.accountErasure.enterErasingPhase(CREATOR_A);
      expect(await loadSharedReceiverView(repos, token)).toBeUndefined();
      const qa = await askSharedReceiverQuestion(repos, { token, question: "Web?" });
      expect(qa).toEqual({ kind: "unavailable" });
      const provenance = await fetchSharedReceiverProvenance(repos, { token, itemIds: ["web"] });
      expect(provenance).toEqual({ kind: "unavailable" });
      const leakProbe = JSON.stringify({ qa, provenance });
      expect(leakProbe).not.toMatch(/erasing|creator_acc|hd-a18-4|conv-acc/i);
      await repos.accountErasure.completeAccountErasure(CREATOR_A);
      expect(await loadSharedReceiverView(repos, token)).toBeUndefined();
      expect(SHARE_UNAVAILABLE_MESSAGE).toMatch(/unavailable/i);
    });

    it("A18-5 — identity mapping removed on successful erase", async () => {
      const creatorId = await resolveOrCreateCreatorForExternalIdentity(repos, {
        provider: "google",
        subject: "subject-a18-5",
      });
      await seedRichHandoff(repos, "hd-a18-5", creatorId);
      await repos.accountErasure.enterErasingPhase(creatorId);
      await repos.accountErasure.completeAccountErasure(creatorId);
      expect(await repos.externalIdentities.resolve("google", "subject-a18-5")).toBeUndefined();
    });

    it("A18-6 — Creator row removed last (external identities deleted first)", async () => {
      const creatorId = await resolveOrCreateCreatorForExternalIdentity(repos, {
        provider: "google",
        subject: "subject-a18-6",
      });
      await repos.accountErasure.enterErasingPhase(creatorId);
      await repos.accountErasure.completeAccountErasure(creatorId);
      expect(await repos.creators.exists(creatorId)).toBe(false);
      expect(await repos.externalIdentities.resolve("google", "subject-a18-6")).toBeUndefined();
    });

    it("Phase 2 rollback leaves erasing with full owned data restored", async () => {
      const handoffId = "hd-rollback";
      await pool.query(
        `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
         VALUES ('google', 'subject-rollback', $1, NOW())`,
        [CREATOR_A],
      );
      const token = await seedRichHandoff(repos, handoffId, CREATOR_A);
      const draftBefore = await repos.drafts.get(handoffId);
      const revisionBefore = await repos.drafts.getRevision(handoffId);
      const publishedBefore = await repos.published.get(handoffId, 1);
      const provBefore = await pool.query(
        `SELECT message_id, excerpt FROM published_handoff_provenance WHERE handoff_id = $1 ORDER BY item_id, source_index`,
        [handoffId],
      );
      const shareBefore = await pool.query(`SELECT id, revoked_at FROM share_capabilities WHERE handoff_id = $1`, [handoffId]);
      const messagesBefore = await pool.query(`SELECT id, content FROM source_messages WHERE conversation_id = 'conv-acc' ORDER BY ordinal`);

      await repos.accountErasure.enterErasingPhase(CREATOR_A);
      const setup = await pool.connect();
      try {
        await installPhase2FailureTrigger(setup, CREATOR_A);
      } finally {
        setup.release();
      }
      await expect(repos.accountErasure.completeAccountErasure(CREATOR_A)).rejects.toThrow(/phase2 failure/i);

      expect(await repos.creators.exists(CREATOR_A)).toBe(true);
      expect(await repos.creators.getLifecycleStatus(CREATOR_A)).toBe("erasing");
      expect(await repos.externalIdentities.resolve("google", "subject-rollback")).toBe(CREATOR_A);
      expect(await repos.handoffs.getOwnerCreatorId(handoffId)).toBe(CREATOR_A);
      expect(await repos.drafts.getRevision(handoffId)).toBe(revisionBefore);
      expect(await repos.drafts.get(handoffId)).toEqual(draftBefore);
      expect(await repos.published.get(handoffId, 1)).toEqual(publishedBefore);
      expect(
        await pool.query(
          `SELECT message_id, excerpt FROM published_handoff_provenance WHERE handoff_id = $1 ORDER BY item_id, source_index`,
          [handoffId],
        ),
      ).toEqual(provBefore);
      expect(await pool.query(`SELECT id, revoked_at FROM share_capabilities WHERE handoff_id = $1`, [handoffId])).toEqual(
        shareBefore,
      );
      expect(await repos.conversations.get("conv-acc")).toBeDefined();
      expect(await pool.query(`SELECT id, content FROM source_messages WHERE conversation_id = 'conv-acc' ORDER BY ordinal`)).toEqual(
        messagesBefore,
      );

      await expect(
        repos.drafts.save(createDraft(handoffId, [item({ id: "web", type: "OPEN", statement: "Blocked." })]), revisionBefore!),
      ).rejects.toBeInstanceOf(CreatorLifecycleUnavailableError);
      expect(await loadSharedReceiverView(repos, token)).toBeUndefined();

      const cleanup = await pool.connect();
      try {
        await dropPhase2FailureTrigger(cleanup);
      } finally {
        cleanup.release();
      }
      await repos.accountErasure.completeAccountErasure(CREATOR_A);
      expect(await repos.creators.exists(CREATOR_A)).toBe(false);
    });

    it("Retry Phase 2 after rollback completes deletion", async () => {
      await seedRichHandoff(repos, "hd-retry", CREATOR_A);
      await repos.accountErasure.enterErasingPhase(CREATOR_A);
      const setup = await pool.connect();
      try {
        await installPhase2FailureTrigger(setup, CREATOR_A);
        await expect(repos.accountErasure.completeAccountErasure(CREATOR_A)).rejects.toThrow();
        await dropPhase2FailureTrigger(setup);
      } finally {
        setup.release();
      }
      await repos.accountErasure.completeAccountErasure(CREATOR_A);
      expect(await repos.creators.exists(CREATOR_A)).toBe(false);
      expect(await repos.creators.getLifecycleStatus(CREATOR_A)).toBeUndefined();
    });

    it("Phase 1 wins before Draft save (active check rejects)", async () => {
      await seedRichHandoff(repos, "hd-conc1", CREATOR_A);
      await repos.accountErasure.enterErasingPhase(CREATOR_A);
      await expect(
        repos.drafts.save(
          createDraft("hd-conc1", [item({ id: "web", type: "OPEN", statement: "Too late." })]),
          1,
        ),
      ).rejects.toBeInstanceOf(CreatorLifecycleUnavailableError);
    });

    it(
      "Draft save wins before Phase 1 (exclusive waits for shared)",
      async () => {
        const handoffId = "hd-conc2";
        await seedRichHandoff(repos, handoffId, CREATOR_A);
        const setup = await pool.connect();
        const gate = await pool.connect();
        try {
          await installDraftUpdateBarrier(setup, handoffId);
          await gate.query(`SELECT pg_advisory_lock($1)`, [LOCK_DRAFT_UPDATE]);
          const savePromise = repos.drafts.save(
            createDraft(handoffId, [item({ id: "web", type: "OPEN", statement: "Saved first." })]),
            1,
          );
          await waitUntil(async () => (await countAdvisoryLockWaiters(pool, LOCK_DRAFT_UPDATE)) > 0);
          const phase1Promise = repos.accountErasure.enterErasingPhase(CREATOR_A);
          await waitUntil(async () => {
            const waits = await pool.query<{ c: number }>(
              `SELECT COUNT(*)::int AS c FROM pg_locks WHERE granted = false`,
            );
            return (waits.rows[0]?.c ?? 0) > 0;
          });
          await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_DRAFT_UPDATE]);
          await savePromise;
          const phase1 = await phase1Promise;
          expect(phase1.alreadyErasing).toBe(false);
          expect(await repos.creators.getLifecycleStatus(CREATOR_A)).toBe("erasing");
        } finally {
          await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_DRAFT_UPDATE]).catch(() => undefined);
          gate.release();
          await dropDraftUpdateBarrier(setup);
          setup.release();
        }
      },
      30_000,
    );

    it(
      "Share revoke vs Phase 2 — no deadlock; revoke waits on Creator lock without Share row lock",
      async () => {
        const handoffId = "hd-revoke-deadlock";
        await seedRichHandoff(repos, handoffId, CREATOR_A);
        const issued = await issueShareCapability(repos, { handoffId, version: 1 });
        await repos.accountErasure.enterErasingPhase(CREATOR_A);

        const setup = await pool.connect();
        const gate = await pool.connect();
        try {
          await installShareDeleteBarrier(setup);
          await gate.query(`SELECT pg_advisory_lock($1)`, [LOCK_SHARE_DELETE]);

          const phase2Promise = repos.accountErasure.completeAccountErasure(CREATOR_A);
          await waitUntil(async () => (await countAdvisoryLockWaiters(pool, LOCK_SHARE_DELETE)) > 0);

          const revokePromise = revokeShareCapability(repos, { capabilityId: issued.metadata.id }).catch((error) => error);
          await waitUntil(async () => (await countAdvisoryLockWaiters(pool, LOCK_SHARE_DELETE)) > 0);

          await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_SHARE_DELETE]);
          await phase2Promise;
          const revokeOutcome = await revokePromise;
          expect(revokeOutcome).toBeInstanceOf(CreatorLifecycleUnavailableError);
          expect(await repos.creators.exists(CREATOR_A)).toBe(false);
          expect(
            (await pool.query(`SELECT COUNT(*)::int AS c FROM share_capabilities WHERE handoff_id = $1`, [handoffId])).rows[0].c,
          ).toBe(0);
        } finally {
          await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_SHARE_DELETE]).catch(() => undefined);
          gate.release();
          await dropShareDeleteBarrier(setup);
          setup.release();
        }
      },
      30_000,
    );

    it(
      "Share revoke wins before Phase 1 (exclusive waits for shared)",
      async () => {
        const handoffId = "hd-revoke-phase1";
        await seedRichHandoff(repos, handoffId, CREATOR_A);
        const issued = await issueShareCapability(repos, { handoffId, version: 1 });
        const setup = await pool.connect();
        const gate = await pool.connect();
        try {
          await installShareRevokeBarrier(setup);
          await gate.query(`SELECT pg_advisory_lock($1)`, [LOCK_SHARE_REVOKE]);

          const revokePromise = revokeShareCapability(repos, { capabilityId: issued.metadata.id });
          await waitUntil(async () => (await countAdvisoryLockWaiters(pool, LOCK_SHARE_REVOKE)) > 0);

          const phase1Promise = repos.accountErasure.enterErasingPhase(CREATOR_A);
          await waitUntil(async () => {
            const waits = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM pg_locks WHERE granted = false`);
            return (waits.rows[0]?.c ?? 0) > 0;
          });

          await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_SHARE_REVOKE]);
          const revoked = await revokePromise;
          expect(revoked?.revokedAt).toBeDefined();
          const phase1 = await phase1Promise;
          expect(phase1.alreadyErasing).toBe(false);
          expect(await repos.creators.getLifecycleStatus(CREATOR_A)).toBe("erasing");
        } finally {
          await gate.query(`SELECT pg_advisory_unlock($1)`, [LOCK_SHARE_REVOKE]).catch(() => undefined);
          gate.release();
          await dropShareRevokeBarrier(setup);
          setup.release();
        }
      },
      30_000,
    );

    it("Share revoke rejected when Creator is erasing", async () => {
      const handoffId = "hd-revoke";
      await seedRichHandoff(repos, handoffId, CREATOR_A);
      const issued = await issueShareCapability(repos, { handoffId, version: 1 });
      await repos.accountErasure.enterErasingPhase(CREATOR_A);
      await expect(revokeShareCapability(repos, { capabilityId: issued.metadata.id })).rejects.toBeInstanceOf(
        CreatorLifecycleUnavailableError,
      );
    });

    it("Import atomicity — late failure rolls back conversation, handoff, and draft", async () => {
      const setup = await pool.connect();
      try {
        await setup.query(`
          CREATE OR REPLACE FUNCTION test_fail_handoff_insert_acc()
          RETURNS TRIGGER LANGUAGE plpgsql AS $$
          BEGIN
            IF NEW.id = 'hd-import-fail' THEN
              RAISE EXCEPTION 'test injected import failure';
            END IF;
            RETURN NEW;
          END;
          $$;
        `);
        await setup.query(`DROP TRIGGER IF EXISTS test_fail_handoff_insert_acc_trg ON handoffs`);
        await setup.query(`
          CREATE TRIGGER test_fail_handoff_insert_acc_trg
            BEFORE INSERT ON handoffs
            FOR EACH ROW
            EXECUTE FUNCTION test_fail_handoff_insert_acc();
        `);
      } finally {
        setup.release();
      }
      await expect(
        repos.importHandoff.importHandoffAtomic({
          ownerCreatorId: CREATOR_A,
          conversation,
          handoffId: "hd-import-fail",
          draft: createDraft("hd-import-fail", []),
        }),
      ).rejects.toThrow(/import failure/i);
      expect(await repos.conversations.get("conv-acc")).toBeUndefined();
      expect(await repos.handoffs.getOwnerCreatorId("hd-import-fail")).toBeUndefined();
      expect(await repos.drafts.get("hd-import-fail")).toBeUndefined();
      const cleanup = await pool.connect();
      try {
        await cleanup.query(`DROP TRIGGER IF EXISTS test_fail_handoff_insert_acc_trg ON handoffs`);
        await cleanup.query(`DROP FUNCTION IF EXISTS test_fail_handoff_insert_acc()`);
      } finally {
        cleanup.release();
      }
    });

    it("External identity re-registration after deletion creates new CreatorId", async () => {
      const first = await resolveOrCreateCreatorForExternalIdentity(repos, {
        provider: "google",
        subject: "subject-relink",
      });
      await repos.accountErasure.enterErasingPhase(first);
      await repos.accountErasure.completeAccountErasure(first);
      const second = await resolveOrCreateCreatorForExternalIdentity(repos, {
        provider: "google",
        subject: "subject-relink",
      });
      expect(second).not.toBe(first);
      expect(await repos.creators.exists(second)).toBe(true);
      const library = await repos.handoffs.listSummariesForOwner(second);
      expect(library).toHaveLength(0);
    });

    it("Extraction discards suggestions when Phase 1 commits during model call", async () => {
      await seedRichHandoff(repos, "hd-ext", CREATOR_A);
      const gate = deferred<void>();
      const extractor: HandoffExtractor = {
        extract: async () => {
          await gate.promise;
          return { candidates: [] };
        },
      };
      const run = generateHandoffExtractionProposal(repos, extractor, "hd-ext");
      await repos.accountErasure.enterErasingPhase(CREATOR_A);
      gate.resolve();
      await expect(run).rejects.toBeInstanceOf(SourceUnavailableError);
    });
  });
}

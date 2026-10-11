import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadCreatorReview } from "../../src/application/use-cases/creator-review.js";
import { issueShareCapability, revokeShareCapability } from "../../src/application/use-cases/share-capability.js";
import { verifyExternalAnswer } from "../../src/application/use-cases/verify-external-answer.js";
import { buildReceiverPacket } from "../../src/portable/receiver-packet.js";
import type { ExternalVerifierPort } from "../../src/receiver/external/verifier.js";
import { createDraft } from "../../src/handoff/draft.js";
import { HandoffLifecycleUnavailableError, SourceBackedDraftRejectedError } from "../../src/persistence/errors.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;
const OWNER = "creator_bootstrap_test";
const requestKey = "bootstrap-request-key-0001";

function draft(handoffId: string) {
  return createDraft(handoffId, [{ id: "server_item_1", type: "OPEN", priority: "IMPORTANT",
    statement: "The distribution channel remains undecided.", createdBy: "EXTRACTION", sources: [] }]);
}

if (!url) {
  describe.skip("bootstrap Handoff persistence", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("bootstrap Handoff persistence", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      const migrateEnv: NodeJS.ProcessEnv = { ...process.env, TEST_DATABASE_URL: url };
      delete migrateEnv.DATABASE_URL;
      execSync("node scripts/migrate.mjs", { env: migrateEnv, stdio: "pipe" });
    });
    beforeEach(async () => {
      await pool.query("TRUNCATE share_capabilities, published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE");
      await repos.creators.ensure({ id: OWNER, createdAt: "2026-10-11T00:00:00.000Z" });
    });
    afterAll(async () => { await pool.end(); });

    it("creates an atomic source-free Draft, publishes immutable meaning, and never claims erased source", async () => {
      const created = await repos.bootstrapHandoff.createAtomic({ ownerCreatorId: OWNER, handoffId: "hd_bootstrap_1",
        requestKey, draft: draft("hd_bootstrap_1"), displayTitle: "  Private navigation  " });
      expect(created).toEqual({ handoffId: "hd_bootstrap_1", revision: 1, idempotent: false });
      expect(await repos.handoffs.getHandoffSourceState("hd_bootstrap_1")).toEqual({ kind: "not_collected" });
      expect((await loadCreatorReview(repos, "hd_bootstrap_1"))?.kind).toBe("not_collected");
      const root = await pool.query("SELECT display_title, source_conversation_id, source_erased_at FROM handoffs WHERE id = $1", ["hd_bootstrap_1"]);
      expect(root.rows[0]).toMatchObject({ display_title: "Private navigation", source_conversation_id: null, source_erased_at: null });
      expect((await pool.query("SELECT COUNT(*)::int AS count FROM source_conversations")).rows[0].count).toBe(0);
      const published = await repos.published.publish("hd_bootstrap_1", "2026-10-11T00:00:00.000Z", 1);
      expect(JSON.stringify(published)).not.toContain("Private navigation");
      expect(await repos.receiver.getProvenance("hd_bootstrap_1", 1, ["server_item_1"]))
        .toMatchObject({ availability: "unavailable_not_collected", items: [] });
      await expect(repos.erasure.eraseSource("hd_bootstrap_1", OWNER, "2026-10-11T01:00:00.000Z"))
        .rejects.toBeInstanceOf(HandoffLifecycleUnavailableError);
      expect(await repos.handoffs.getHandoffSourceState("hd_bootstrap_1")).toEqual({ kind: "not_collected" });
      await repos.erasure.deleteHandoff("hd_bootstrap_1", OWNER);
      expect((await pool.query("SELECT 1 FROM handoffs WHERE id = $1", ["hd_bootstrap_1"])).rowCount).toBe(0);
    });

    it("omits unselected title and deduplicates a retried request for the same owner", async () => {
      const first = await repos.bootstrapHandoff.createAtomic({ ownerCreatorId: OWNER, handoffId: "hd_first",
        requestKey, draft: draft("hd_first") });
      const retry = await repos.bootstrapHandoff.createAtomic({ ownerCreatorId: OWNER, handoffId: "hd_retry",
        requestKey, draft: draft("hd_retry") });
      expect(first.idempotent).toBe(false);
      expect(retry).toEqual({ handoffId: "hd_first", revision: 1, idempotent: true });
      const roots = await pool.query("SELECT id, display_title FROM handoffs");
      expect(roots.rows).toEqual([{ id: "hd_first", display_title: null }]);
    });

    it("rejects forged source references on create and later Draft save", async () => {
      const forged = createDraft("hd_forged", [{ ...draft("hd_forged").items[0]!, sources: [{ messageId: "invented" }] }]);
      await expect(repos.bootstrapHandoff.createAtomic({ ownerCreatorId: OWNER, handoffId: "hd_forged",
        requestKey, draft: forged })).rejects.toThrow(/source-free/);
      expect((await pool.query("SELECT 1 FROM handoffs WHERE id = $1", ["hd_forged"])).rowCount).toBe(0);
      await repos.bootstrapHandoff.createAtomic({ ownerCreatorId: OWNER, handoffId: "hd_forged",
        requestKey, draft: draft("hd_forged") });
      await expect(repos.drafts.save(forged, 1)).rejects.toBeInstanceOf(SourceBackedDraftRejectedError);
      expect(await repos.drafts.getRevision("hd_forged")).toBe(1);
    });

    it("rolls back Handoff root when Draft insertion fails", async () => {
      await pool.query(`CREATE OR REPLACE FUNCTION test_fail_bootstrap_draft() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.handoff_id = 'hd_atomic_fail' THEN RAISE EXCEPTION 'test draft failure'; END IF; RETURN NEW; END $$`);
      await pool.query(`CREATE TRIGGER test_fail_bootstrap_draft BEFORE INSERT ON handoff_drafts
        FOR EACH ROW EXECUTE FUNCTION test_fail_bootstrap_draft()`);
      try {
        await expect(repos.bootstrapHandoff.createAtomic({ ownerCreatorId: OWNER, handoffId: "hd_atomic_fail",
          requestKey, draft: draft("hd_atomic_fail") })).rejects.toThrow(/test draft failure/);
        expect((await pool.query("SELECT 1 FROM handoffs WHERE id = 'hd_atomic_fail'")).rowCount).toBe(0);
      } finally {
        await pool.query("DROP TRIGGER IF EXISTS test_fail_bootstrap_draft ON handoff_drafts");
        await pool.query("DROP FUNCTION IF EXISTS test_fail_bootstrap_draft()");
      }
    });

    it("rejects forged packet identity before invoking analysis", async () => {
      await repos.bootstrapHandoff.createAtomic({ ownerCreatorId: OWNER, handoffId: "hd_verify_gate", requestKey, draft: draft("hd_verify_gate") });
      await repos.published.publish("hd_verify_gate", "2026-10-11T00:00:00.000Z", 1);
      const issued = await issueShareCapability(repos, { handoffId: "hd_verify_gate", version: 1 });
      let calls = 0;
      const verifier: ExternalVerifierPort = { analyze: async () => { calls += 1; throw new Error("must not run"); } };
      const result = await verifyExternalAnswer(repos, issued.rawToken, {
        protocol: "hermeneus.receiver-submission/v0", publicationRef: `pub_${"0".repeat(32)}`,
        packetDigest: `sha256:${"0".repeat(64)}`, answerText: "Forged answer",
      }, verifier);
      expect(result.kind).toBe("invalid");
      expect(calls).toBe(0);
    });

    it("rechecks Share after awaited analysis and hides a revoked result", async () => {
      await repos.bootstrapHandoff.createAtomic({ ownerCreatorId: OWNER, handoffId: "hd_verify_race", requestKey, draft: draft("hd_verify_race") });
      await repos.published.publish("hd_verify_race", "2026-10-11T00:00:00.000Z", 1);
      const issued = await issueShareCapability(repos, { handoffId: "hd_verify_race", version: 1 });
      const packet = buildReceiverPacket((await repos.receiver.getPublishedView("hd_verify_race", 1))!);
      let begin!: () => void;
      const started = new Promise<void>((resolve) => { begin = resolve; });
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const verifier: ExternalVerifierPort = { analyze: async () => {
        begin();
        await held;
        throw new Error("provider unavailable");
      } };
      const pending = verifyExternalAnswer(repos, issued.rawToken, {
        protocol: "hermeneus.receiver-submission/v0", publicationRef: packet.publicationRef,
        packetDigest: packet.canonicalDigest, answerText: "Hosting remains open [HI-001].",
      }, verifier);
      await started;
      await revokeShareCapability(repos, { capabilityId: issued.metadata.id });
      release();
      expect((await pending).kind).toBe("unavailable");
    });
  });
}

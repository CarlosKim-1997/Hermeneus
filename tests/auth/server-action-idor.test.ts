import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandoffItem } from "../../src/handoff/schema.js";
import {
  deleteHandoffAction,
  eraseSourceAction,
  fetchCreatorReview,
  fetchPublishedHandoff,
  generateExtractionSuggestionsAction,
  publishHandoffAction,
  saveDraftAction,
} from "../../src/application/actions.js";
import {
  issueShareCapabilityAction,
  listShareCapabilitiesAction,
  revokeShareCapabilityAction,
} from "../../src/application/share-actions.js";
import {
  askReceiverQuestionAction,
  fetchReceiverProvenanceAction,
} from "../../src/application/receiver-actions.js";
import { setCreatorSessionProviderForTests } from "../../src/application/creator-session-factory.js";
import { setHandoffExtractorForTests } from "../../src/application/extraction-factory.js";
import { setReceiverSemanticInterpreterForTests } from "../../src/application/receiver-interpreter-factory.js";
import { importAndCreateHandoff } from "../../src/application/use-cases/import-conversation.js";
import {
  loadCreatorReview,
  requireRetainedCreatorReview,
  saveCreatorDraft,
} from "../../src/application/use-cases/creator-review.js";
import { publishHandoff } from "../../src/application/use-cases/publish-handoff.js";
import { issueShareCapability } from "../../src/application/use-cases/share-capability.js";
import { loadSharedReceiverView } from "../../src/application/use-cases/shared-receiver-qa.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;
const CREATOR_A = "creator_action_a";
const CREATOR_B = "creator_action_b";

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return {
    priority: "CORE",
    createdBy: "CREATOR",
    sources: [],
    ...partial,
  };
}

function sessionAs(creatorId: string | undefined) {
  setCreatorSessionProviderForTests({
    getCurrentPrincipal: async () =>
      creatorId ? { creatorId, lifecycleStatus: "active" as const } : undefined,
  });
}

async function seedPublishedHandoff(repos: ReturnType<typeof createPostgresRepositories>) {
  const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: Web-first confirmed for the MVP.");
  const review = await loadCreatorReview(repos, imported.handoffId);
  const message = requireRetainedCreatorReview(review).sourceConversation.messages[0]!;
  await saveCreatorDraft(
    repos,
    imported.handoffId,
    [
      item({
        id: "web",
        type: "CONFIRMED",
        statement: "Web-first is confirmed.",
        sources: [{ messageId: message.id, excerpt: message.content }],
      }),
    ],
    1,
  );
  const revision = (await repos.drafts.getRevision(imported.handoffId))!;
  await publishHandoff(repos, imported.handoffId, revision);
  return { handoffId: imported.handoffId, revision, messageId: message.id };
}

if (!url) {
  describe.skip("Server Action IDOR", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("Server Action IDOR", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      process.env.DATABASE_URL = url;
      const migrateEnv = { ...process.env, TEST_DATABASE_URL: url } as NodeJS.ProcessEnv;
      execSync("node scripts/migrate.mjs", { env: migrateEnv, stdio: "pipe" });
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE share_capabilities, published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
      await repos.creators.ensure({ id: CREATOR_A, createdAt: "2026-09-25T00:00:00.000Z" });
      await repos.creators.ensure({ id: CREATOR_B, createdAt: "2026-09-25T00:00:00.000Z" });
      setHandoffExtractorForTests(undefined);
      setReceiverSemanticInterpreterForTests(undefined);
      sessionAs(undefined);
    });

    afterAll(async () => {
      await pool.end();
    });

    it("SA1 — non-owner saveDraftAction rejected; draft unchanged", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: keep me");
      await saveCreatorDraft(repos, imported.handoffId, [item({ id: "a", type: "CONFIRMED", statement: "Original." })], 1);
      sessionAs(CREATOR_B);
      const result = await saveDraftAction({
        handoffId: imported.handoffId,
        expectedRevision: 1,
        items: [item({ id: "a", type: "CONFIRMED", statement: "Forged." })],
      });
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      const draft = await repos.drafts.get(imported.handoffId);
      expect(draft?.items[0]?.statement).toBe("Original.");
    });

    it("SA2 — non-owner extraction rejected before extractor", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      const extract = vi.fn(async () => ({ candidates: [] }));
      setHandoffExtractorForTests({ extract });
      sessionAs(CREATOR_B);
      const result = await generateExtractionSuggestionsAction(handoffId);
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      expect(extract).not.toHaveBeenCalled();
    });

    it("SA3 — non-owner publish rejected; no new published version", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: publish");
      await saveCreatorDraft(repos, imported.handoffId, [item({ id: "p", type: "CONFIRMED", statement: "Ready." })], 1);
      sessionAs(CREATOR_B);
      const result = await publishHandoffAction(imported.handoffId, 1);
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      expect(await repos.published.get(imported.handoffId, 1)).toBeUndefined();
    });

    it("SA4 — non-owner fetchCreatorReview and fetchPublishedHandoff unavailable", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      sessionAs(CREATOR_B);
      expect(await fetchCreatorReview(handoffId)).toBeUndefined();
      expect(await fetchPublishedHandoff(handoffId, 1)).toBeUndefined();
    });

    it("SA5 — non-owner share issue rejected", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      sessionAs(CREATOR_B);
      const before = await pool.query(`SELECT COUNT(*)::int AS c FROM share_capabilities`);
      const result = await issueShareCapabilityAction({ handoffId, version: 1 });
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      const after = await pool.query(`SELECT COUNT(*)::int AS c FROM share_capabilities`);
      expect(after.rows[0]!.c).toBe(before.rows[0]!.c);
    });

    it("SA6 — non-owner share list rejected", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      sessionAs(CREATOR_A);
      await issueShareCapabilityAction({ handoffId, version: 1 });
      sessionAs(CREATOR_B);
      const result = await listShareCapabilitiesAction({ handoffId, version: 1 });
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
    });

    it("SA7 — non-owner revoke rejected; token stays active", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      sessionAs(CREATOR_A);
      const issued = await issueShareCapability(repos, { handoffId, version: 1 });
      sessionAs(CREATOR_B);
      const result = await revokeShareCapabilityAction({ capabilityId: issued.metadata.id });
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      const row = await pool.query(`SELECT revoked_at FROM share_capabilities WHERE id = $1`, [issued.metadata.id]);
      expect(row.rows[0]!.revoked_at).toBeNull();
      expect(await loadSharedReceiverView(repos, issued.rawToken)).toBeTruthy();
    });

    it("SA8 — non-owner internal Q&A rejected before model", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      const interpret = vi.fn();
      setReceiverSemanticInterpreterForTests({ interpret });
      sessionAs(CREATOR_B);
      const result = await askReceiverQuestionAction({ handoffId, version: 1, question: "Web?" });
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      expect(interpret).not.toHaveBeenCalled();
    });

    it("SA9 — non-owner internal provenance rejected", async () => {
      const { handoffId, messageId } = await seedPublishedHandoff(repos);
      sessionAs(CREATOR_B);
      const result = await fetchReceiverProvenanceAction({ handoffId, version: 1, itemIds: ["web"] });
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      expect(messageId).toBeTruthy();
    });

    it("SA11 — anonymous eraseSourceAction unauthenticated", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      sessionAs(undefined);
      const provBefore = await pool.query(
        `SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = $1`,
        [handoffId],
      );
      const result = await eraseSourceAction(handoffId);
      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Sign in to continue." },
      });
      const provAfter = await pool.query(
        `SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = $1`,
        [handoffId],
      );
      expect(provAfter.rows[0].c).toBe(provBefore.rows[0].c);
    });

    it("SA12 — non-owner eraseSourceAction unavailable", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      sessionAs(CREATOR_B);
      const result = await eraseSourceAction(handoffId);
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      expect((await repos.handoffs.getHandoffSourceState(handoffId))?.kind).toBe("retained");
    });

    it("SA13 — anonymous deleteHandoffAction unauthenticated", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      sessionAs(undefined);
      const result = await deleteHandoffAction(handoffId);
      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Sign in to continue." },
      });
      expect(await repos.handoffs.getOwnerCreatorId(handoffId)).toBe(CREATOR_A);
    });

    it("SA14 — non-owner deleteHandoffAction unavailable", async () => {
      const { handoffId } = await seedPublishedHandoff(repos);
      sessionAs(CREATOR_B);
      const result = await deleteHandoffAction(handoffId);
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
      });
      expect(await repos.handoffs.getOwnerCreatorId(handoffId)).toBe(CREATOR_A);
    });

    it("SA10 — anonymous saveDraftAction unauthenticated", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: anon");
      sessionAs(undefined);
      const result = await saveDraftAction({
        handoffId: imported.handoffId,
        expectedRevision: 1,
        items: [item({ id: "x", type: "CONFIRMED", statement: "Nope." })],
      });
      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Sign in to continue." },
      });
    });

  });
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { createDraft, updateItem } from "../../src/handoff/draft.js";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { closePool, getRepositories } from "../../src/application/runtime.js";
import { importAndCreateHandoff } from "../../src/application/use-cases/import-conversation.js";
import {
  loadCreatorReview,
  requireRetainedCreatorReview,
  saveCreatorDraft,
} from "../../src/application/use-cases/creator-review.js";
import { loadPublishedHandoff, publishHandoff } from "../../src/application/use-cases/publish-handoff.js";
import { ProvenanceValidationError } from "../../src/persistence/errors.js";
import { PersistenceConflictError } from "../../src/persistence/errors.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;
const APP_CREATOR = "creator_application_test";
const transcript = `creator: Maybe mobile first would be good.
assistant: We could start there.
creator: Actually, web first.`;

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return {
    priority: "CORE",
    createdBy: "CREATOR",
    sources: [],
    ...partial,
  };
}

async function publishCurrentDraft(repos: ReturnType<typeof getRepositories>, handoffId: string) {
  const revision = await repos.drafts.getRevision(handoffId);
  if (revision === undefined) throw new Error(`Missing draft revision for ${handoffId}`);
  return publishHandoff(repos, handoffId, revision);
}

if (!url) {
  describe.skip("Creator application workflow", () => {});
} else {
  describe("Creator application workflow", () => {
    const pool = createPool(url);
    let repos: ReturnType<typeof getRepositories>;

    beforeAll(() => {
      process.env.DATABASE_URL = url;
      execSync("node scripts/migrate.mjs", { env: { ...process.env, TEST_DATABASE_URL: url }, stdio: "pipe" });
      repos = getRepositories();
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
      await repos.creators.ensure({ id: APP_CREATOR, createdAt: "2026-09-25T00:00:00.000Z" });
    });

    afterAll(async () => {
      await closePool();
      await pool.end();
    });

    it("U1 — import flow creates persisted empty draft", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      const review = await loadCreatorReview(repos, imported.handoffId);
      expect(review?.draft.items).toEqual([]);
      expect(review?.revision).toBe(1);
      expect(requireRetainedCreatorReview(review).sourceConversation.messages.length).toBeGreaterThan(0);
    });

    it("U2 — manual item editing persists", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })],
        1,
      );
      const review = await loadCreatorReview(repos, imported.handoffId);
      expect(review?.draft.items[0]?.statement).toBe("Web-first is confirmed.");
    });

    it("U3 — reclassification persists", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "mobile", type: "CONFIRMED", statement: "Mobile-first is confirmed." })],
        1,
      );
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "mobile", type: "REJECTED", statement: "Mobile-first is rejected." })],
        2,
      );
      const review = await loadCreatorReview(repos, imported.handoffId);
      expect(review?.draft.items[0]?.type).toBe("REJECTED");
    });

    it("U4 — provenance attachment publishes", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      const review = await loadCreatorReview(repos, imported.handoffId);
      const messageId = requireRetainedCreatorReview(review).sourceConversation.messages.at(-1)!.id;
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId, excerpt: "Actually, web first." }],
          }),
        ],
        1,
      );
      const published = await publishCurrentDraft(repos, imported.handoffId);
      expect(published.version).toBe(1);
    });

    it("U5 — fabricated excerpt fails publication", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      const review = await loadCreatorReview(repos, imported.handoffId);
      const messageId = requireRetainedCreatorReview(review).sourceConversation.messages.at(-1)!.id;
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId, excerpt: "Mobile-first was approved." }],
          }),
        ],
        1,
      );
      await expect(publishCurrentDraft(repos, imported.handoffId)).rejects.toBeInstanceOf(ProvenanceValidationError);
      expect(await loadPublishedHandoff(repos, imported.handoffId, 1)).toBeUndefined();
    });

    it("U6 — stale revision conflict", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      let draft = createDraft(imported.handoffId, [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await repos.drafts.save(draft, 1);
      draft = updateItem(draft, "web", { statement: "Revision two." });
      await repos.drafts.save(draft, 2);
      await expect(
        saveCreatorDraft(
          repos,
          imported.handoffId,
          [item({ id: "web", type: "CONFIRMED", statement: "Stale overwrite attempt." })],
          1,
        ),
      ).rejects.toBeInstanceOf(PersistenceConflictError);
    });

    it("U7 — publish v1 immutability", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })],
        1,
      );
      const v1 = await publishCurrentDraft(repos, imported.handoffId);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Changed after publish." })],
        2,
      );
      expect((await loadPublishedHandoff(repos, imported.handoffId, 1))?.items[0]?.statement).toBe(
        v1.items[0]?.statement,
      );
    });

    it("U8 — publish v2 keeps v1", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Web-first v1." })],
        1,
      );
      const v1 = await publishCurrentDraft(repos, imported.handoffId);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Web-first v2." })],
        2,
      );
      const v2 = await publishCurrentDraft(repos, imported.handoffId);
      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect((await loadPublishedHandoff(repos, imported.handoffId, 1))?.items[0]?.statement).toBe("Web-first v1.");
    });

    it("U9 — approval cannot publish an intervening edit", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      const approved = await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Creator A approved content." })],
        1,
      );
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Creator B intervening edit." })],
        approved.revision,
      );
      await expect(publishHandoff(repos, imported.handoffId, approved.revision)).rejects.toBeInstanceOf(
        PersistenceConflictError,
      );
      expect(await loadPublishedHandoff(repos, imported.handoffId, 1)).toBeUndefined();
    });
  });
}

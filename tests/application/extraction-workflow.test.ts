import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { closePool, getRepositories } from "../../src/application/runtime.js";
import { setHandoffExtractorForTests } from "../../src/application/extraction-factory.js";
import { fixtureExtractor } from "../../src/extraction/fixture-extractor.js";
import { ExtractionError } from "../../src/extraction/errors.js";
import { importAndCreateHandoff } from "../../src/application/use-cases/import-conversation.js";
import { loadCreatorReview, saveCreatorDraft } from "../../src/application/use-cases/creator-review.js";
import { generateHandoffExtractionProposal } from "../../src/application/use-cases/generate-extraction-proposal.js";
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

if (!url) {
  describe.skip("Creator extraction workflow", () => {});
} else {
  describe("Creator extraction workflow", () => {
    const pool = createPool(url);
    let repos: ReturnType<typeof getRepositories>;

    beforeAll(() => {
      process.env.DATABASE_URL = url;
      execSync("node scripts/migrate.mjs", { env: { ...process.env, TEST_DATABASE_URL: url }, stdio: "pipe" });
      repos = getRepositories();
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
      await repos.creators.ensure({ id: APP_CREATOR, createdAt: "2026-09-25T00:00:00.000Z" });
      setHandoffExtractorForTests(undefined);
    });

    afterEach(() => {
      setHandoffExtractorForTests(undefined);
    });

    afterAll(async () => {
      await closePool();
      await pool.end();
    });

    it("U10 — generation does not modify draft", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      const before = await loadCreatorReview(repos, imported.handoffId);
      const messageId = before!.sourceConversation.messages.at(-1)!.id;
      const extractor = fixtureExtractor([
        {
          type: "CONFIRMED",
          statement: "Web-first is confirmed.",
          priority: "CORE",
          sources: [{ messageId, excerpt: "web first" }],
        },
      ]);
      setHandoffExtractorForTests(extractor);
      await generateHandoffExtractionProposal(repos, extractor, imported.handoffId);
      const after = await loadCreatorReview(repos, imported.handoffId);
      expect(after?.revision).toBe(before?.revision);
      expect(after?.draft.items).toEqual(before?.draft.items);
    });

    it("U11 — accept suggestion persists draft content (client save uses CREATOR origin)", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      const review = await loadCreatorReview(repos, imported.handoffId);
      const messageId = review!.sourceConversation.messages.at(-1)!.id;
      const extractor = fixtureExtractor([
        {
          type: "CONFIRMED",
          statement: "Web-first is confirmed.",
          priority: "CORE",
          sources: [{ messageId, excerpt: "web first" }],
        },
      ]);
      const { suggestions } = await generateHandoffExtractionProposal(repos, extractor, imported.handoffId);
      await saveCreatorDraft(repos, imported.handoffId, suggestions, review!.revision);
      const reloaded = await loadCreatorReview(repos, imported.handoffId);
      expect(reloaded?.draft.items).toHaveLength(1);
      expect(reloaded?.draft.items[0]?.createdBy).toBe("CREATOR");
      expect(reloaded?.draft.items[0]?.statement).toBe("Web-first is confirmed.");
    });

    it("U12 — creator edit changes origin when persisted EXTRACTION item exists", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      const review = await loadCreatorReview(repos, imported.handoffId);
      const messageId = review!.sourceConversation.messages.at(-1)!.id;
      const extractionItem = {
        id: "extracted_item",
        type: "CONFIRMED" as const,
        statement: "Web-first is confirmed.",
        priority: "CORE" as const,
        createdBy: "EXTRACTION" as const,
        sources: [{ messageId, excerpt: "web first" }],
      };
      await repos.drafts.save(
        { id: imported.handoffId, items: [extractionItem] },
        review!.revision,
      );
      const edited = { ...extractionItem, statement: "Web-first is confirmed for the MVP." };
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [edited],
        (await loadCreatorReview(repos, imported.handoffId))!.revision,
      );
      const reloaded = await loadCreatorReview(repos, imported.handoffId);
      expect(reloaded?.draft.items[0]?.createdBy).toBe("CREATOR");
    });

    it("U13 — existing manual items survive generation", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "manual", type: "CONTEXT", statement: "Manual context item." })],
        1,
      );
      const review = await loadCreatorReview(repos, imported.handoffId);
      const messageId = review!.sourceConversation.messages.at(-1)!.id;
      setHandoffExtractorForTests(
        fixtureExtractor([
          {
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            priority: "CORE",
            sources: [{ messageId, excerpt: "web first" }],
          },
        ]),
      );
      await generateHandoffExtractionProposal(
        repos,
        fixtureExtractor([
          {
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            priority: "CORE",
            sources: [{ messageId, excerpt: "web first" }],
          },
        ]),
        imported.handoffId,
      );
      const after = await loadCreatorReview(repos, imported.handoffId);
      expect(after?.draft.items).toHaveLength(1);
      expect(after?.draft.items[0]?.id).toBe("manual");
    });

    it("U14 — invalid proposal does not mutate draft", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcript);
      const before = await loadCreatorReview(repos, imported.handoffId);
      const invalid = fixtureExtractor([
        {
          type: "CONFIRMED",
          statement: "Fabricated.",
          priority: "CORE",
          sources: [{ messageId: "missing", excerpt: "nope" }],
        },
      ]);
      await expect(generateHandoffExtractionProposal(repos, invalid, imported.handoffId)).rejects.toBeInstanceOf(
        ExtractionError,
      );
      const after = await loadCreatorReview(repos, imported.handoffId);
      expect(after?.revision).toBe(before?.revision);
      expect(after?.draft.items).toEqual(before?.draft.items);
    });
  });
}

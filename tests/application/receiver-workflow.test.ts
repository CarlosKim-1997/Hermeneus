import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { closePool, getRepositories } from "../../src/application/runtime.js";
import { importAndCreateHandoff } from "../../src/application/use-cases/import-conversation.js";
import { loadCreatorReview, saveCreatorDraft } from "../../src/application/use-cases/creator-review.js";
import { publishHandoff } from "../../src/application/use-cases/publish-handoff.js";
import {
  askReceiverQuestion,
  fetchReceiverProvenance,
  loadReceiverPublishedView,
} from "../../src/application/use-cases/receiver-qa.js";
import { UNKNOWN_ANSWER } from "../../src/receiver/interpret.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;
const APP_CREATOR = "creator_application_test";
const SECRET_MARKER = "SECRET PRIVATE MATERIAL";
const transcriptWithSecret = `creator: ${SECRET_MARKER} maybe mobile first.
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
  describe.skip("Receiver application workflow", () => {});
} else {
  describe("Receiver application workflow", () => {
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
    });

    afterAll(async () => {
      await closePool();
      await pool.end();
    });

    it("R1 — pinned version answers from v1 after v2 exists", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed for version one." })],
        1,
      );
      await publishCurrentDraft(repos, imported.handoffId);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "mobile", type: "CONFIRMED", statement: "Mobile-first is confirmed for version two." })],
        2,
      );
      await publishCurrentDraft(repos, imported.handoffId);

      const v1Answer = await askReceiverQuestion(repos, {
        handoffId: imported.handoffId,
        version: 1,
        question: "Are we building web first?",
      });
      const v2View = await loadReceiverPublishedView(repos, imported.handoffId, 2);
      expect(v1Answer?.answer).toMatch(/Web-first is confirmed for version one/);
      expect(v1Answer?.answer).not.toMatch(/Mobile-first is confirmed for version two/);
      expect(v2View?.items[0]?.statement).toMatch(/Mobile-first/);
    });

    it("R2 — SUPPORTED with canonical citation for web-first", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })],
        1,
      );
      await publishCurrentDraft(repos, imported.handoffId);

      const result = await askReceiverQuestion(repos, {
        handoffId: imported.handoffId,
        version: 1,
        question: "Are we building web first?",
      });
      expect(result?.classification).toBe("SUPPORTED");
      expect(result?.citedItems.map((entry) => entry.id)).toContain("web");
      expect(result?.answer).toMatch(/Web-first is confirmed/);
    });

    it("R3 — OPEN for explicit unresolved authentication", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [
          item({
            id: "auth",
            type: "OPEN",
            statement: "The authentication provider, including Google login, is unresolved.",
          }),
        ],
        1,
      );
      await publishCurrentDraft(repos, imported.handoffId);

      const result = await askReceiverQuestion(repos, {
        handoffId: imported.handoffId,
        version: 1,
        question: "Are we using Google login?",
      });
      expect(result?.classification).toBe("OPEN");
      expect(result?.answer).toMatch(/has not decided/i);
    });

    it("R4 — UNKNOWN when pricing is absent", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })],
        1,
      );
      await publishCurrentDraft(repos, imported.handoffId);

      const result = await askReceiverQuestion(repos, {
        handoffId: imported.handoffId,
        version: 1,
        question: "What will this cost users?",
      });
      expect(result?.classification).toBe("UNKNOWN");
      expect(result?.answer).toBe(UNKNOWN_ANSWER);
      expect(result?.citedItems).toEqual([]);
    });

    it("R5 — transcript conflict cannot override published Canon", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })],
        1,
      );
      await publishCurrentDraft(repos, imported.handoffId);

      const result = await askReceiverQuestion(repos, {
        handoffId: imported.handoffId,
        version: 1,
        question: "Is web-first confirmed despite other notes?",
      });
      expect(result?.classification).toBe("SUPPORTED");
      expect(result?.answer).toMatch(/Web-first is confirmed/);
      expect(result?.answer).not.toMatch(SECRET_MARKER);
      expect(result?.answer.toLowerCase()).not.toMatch(/maybe mobile first/);
    });

    it("R6 — safe provenance returns approved excerpt only", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      const review = await loadCreatorReview(repos, imported.handoffId);
      const messageId = review!.sourceConversation.messages.at(-1)!.id;
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
      await publishCurrentDraft(repos, imported.handoffId);

      const provenance = await fetchReceiverProvenance(repos, {
        handoffId: imported.handoffId,
        version: 1,
        itemIds: ["web"],
      });
      expect(provenance?.items[0]?.references[0]?.excerpt).toBe("Actually, web first.");
      expect(JSON.stringify(provenance)).not.toContain(SECRET_MARKER);
      expect(provenance?.items[0]?.references[0]).not.toHaveProperty("content");
    });

    it("R7 — provenance without excerpt marks excerptAvailable false", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      const review = await loadCreatorReview(repos, imported.handoffId);
      const messageId = review!.sourceConversation.messages.at(-1)!.id;
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId }],
          }),
        ],
        1,
      );
      await publishCurrentDraft(repos, imported.handoffId);

      const provenance = await fetchReceiverProvenance(repos, {
        handoffId: imported.handoffId,
        version: 1,
        itemIds: ["web"],
      });
      const reference = provenance?.items[0]?.references[0];
      expect(reference?.excerptAvailable).toBe(false);
      expect(reference?.excerpt).toBeUndefined();
      expect(JSON.stringify(provenance)).not.toContain(SECRET_MARKER);
    });

    it("R8 — rejected item reflects canonical REJECTED state", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [
          item({
            id: "rejected-mobile",
            type: "REJECTED",
            statement: "Mobile-first was explored and rejected.",
          }),
          item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
        ],
        1,
      );
      await publishCurrentDraft(repos, imported.handoffId);

      const result = await askReceiverQuestion(repos, {
        handoffId: imported.handoffId,
        version: 1,
        question: "Are we building mobile first?",
      });
      expect(result?.classification).toBe("SUPPORTED");
      expect(result?.answer).toMatch(/Mobile-first was explored and rejected/);
      expect(result?.citedItems.some((entry) => entry.type === "REJECTED")).toBe(true);
    });

    it("R9 — published version URL stability after newer publication", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "v1", type: "CONFIRMED", statement: "Version one canonical statement." })],
        1,
      );
      const first = await publishCurrentDraft(repos, imported.handoffId);
      await saveCreatorDraft(
        repos,
        imported.handoffId,
        [item({ id: "v2", type: "CONFIRMED", statement: "Version two canonical statement." })],
        2,
      );
      await publishCurrentDraft(repos, imported.handoffId);

      const pinned = await loadReceiverPublishedView(repos, imported.handoffId, first.version);
      expect(pinned?.items[0]?.statement).toBe("Version one canonical statement.");
      const answer = await askReceiverQuestion(repos, {
        handoffId: imported.handoffId,
        version: 1,
        question: "What is the version one canonical statement?",
      });
      expect(answer?.answer).toMatch(/Version one canonical statement/);
      expect(answer?.answer).not.toMatch(/Version two canonical statement/);
    });

    it("R10 — serialized Receiver state excludes raw secret material", async () => {
      const imported = await importAndCreateHandoff(repos, APP_CREATOR, transcriptWithSecret);
      const review = await loadCreatorReview(repos, imported.handoffId);
      const messageId = review!.sourceConversation.messages.at(-1)!.id;
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
      await publishCurrentDraft(repos, imported.handoffId);

      const view = await loadReceiverPublishedView(repos, imported.handoffId, 1);
      const answer = await askReceiverQuestion(repos, {
        handoffId: imported.handoffId,
        version: 1,
        question: "Are we building web first?",
      });
      const provenance = await fetchReceiverProvenance(repos, {
        handoffId: imported.handoffId,
        version: 1,
        itemIds: ["web"],
      });

      const bundles = [view, answer, provenance];
      for (const bundle of bundles) {
        expect(JSON.stringify(bundle)).not.toContain(SECRET_MARKER);
      }
      expect(JSON.stringify(provenance)).toContain("Actually, web first.");
    });

    it("R11 — Receiver surface module excludes Creator navigation affordances", () => {
      const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
      const receiverPage = readFileSync(
        path.join(repoRoot, "src/app/receiver/[handoffId]/[version]/page.tsx"),
        "utf8",
      );
      const receiverConsole = readFileSync(path.join(repoRoot, "src/app/components/receiver-console.tsx"), "utf8");
      for (const source of [receiverPage, receiverConsole]) {
        expect(source).not.toMatch(/\/handoffs\//);
        expect(source).not.toMatch(/View publication record/i);
        expect(source).not.toMatch(/Return to draft review/i);
        expect(source).not.toMatch(/Source Conversation/i);
      }
    });
  });
}

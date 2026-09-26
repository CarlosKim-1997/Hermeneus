import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDraft, updateItem } from "../../src/handoff/draft.js";
import type { DraftHandoff, HandoffItem } from "../../src/handoff/schema.js";
import { PersistenceConflictError, ProvenanceValidationError } from "../../src/persistence/errors.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { authorityFromReceiverView } from "../../src/receiver/interpretation-authority.js";
import { interpretPublished } from "../../src/receiver/interpret.js";

const url = process.env.TEST_DATABASE_URL;
const TEST_CREATOR = "creator_integration_test";
const OWNER_A = "creator_owner_a";
const OWNER_B = "creator_owner_b";

type Repos = ReturnType<typeof createPostgresRepositories>;

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return {
    priority: "CORE",
    createdBy: "CREATOR",
    sources: [],
    ...partial,
  };
}

const conversation = {
  id: "conv-p",
  source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
  messages: [
    {
      id: "conv-p:m1",
      role: "creator" as const,
      content: "Maybe mobile first would be good.",
      source: { provider: "generic-text" },
    },
    {
      id: "conv-p:m2",
      role: "assistant" as const,
      content: "We could start there.",
      source: { provider: "generic-text" },
    },
    {
      id: "conv-p:m3",
      role: "creator" as const,
      content: "Actually, web first.",
      source: { provider: "generic-text" },
    },
    {
      id: "conv-p:m4",
      role: "creator" as const,
      content: "SECRET exploratory salary discussion.",
      source: { provider: "generic-text" },
    },
  ],
};

async function saveInitialDraft(repos: Repos, draft: DraftHandoff) {
  return repos.drafts.save(draft);
}

async function saveDraftUpdate(repos: Repos, draft: DraftHandoff) {
  const revision = await repos.drafts.getRevision(draft.id);
  if (revision === undefined) throw new Error(`Missing draft revision for ${draft.id}`);
  return repos.drafts.save(draft, revision);
}

async function publishCurrentDraft(repos: Repos, handoffId: string, publishedAt: string) {
  const revision = await repos.drafts.getRevision(handoffId);
  if (revision === undefined) throw new Error(`Missing draft revision for ${handoffId}`);
  return repos.published.publish(handoffId, publishedAt, revision);
}

if (!url) {
  describe.skip("PostgreSQL persistence", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("PostgreSQL persistence", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      execSync("node scripts/migrate.mjs", {
        env: { ...process.env, TEST_DATABASE_URL: url },
        stdio: "pipe",
      });
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE share_capabilities, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
      await repos.creators.ensure({ id: TEST_CREATOR, createdAt: "2026-09-25T00:00:00.000Z" });
      await repos.creators.ensure({ id: OWNER_A, createdAt: "2026-09-25T00:00:00.000Z" });
      await repos.creators.ensure({ id: OWNER_B, createdAt: "2026-09-25T00:00:00.000Z" });
    });

    afterAll(async () => {
      await pool.end();
    });

    it("P1 — normalized conversation round trip", async () => {
      await repos.conversations.create(conversation);
      const loaded = await repos.conversations.get("conv-p");
      expect(loaded).toEqual(conversation);
    });

    it("P2 — draft round trip", async () => {
      await repos.conversations.create(conversation);
      const draft = createDraft("handoff-p2", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await repos.handoffs.create("handoff-p2", "conv-p", TEST_CREATOR);
      await saveInitialDraft(repos, draft);
      expect(await repos.drafts.get("handoff-p2")).toEqual(draft);
    });

    it("P3 — publish v1", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p3", "conv-p", TEST_CREATOR);
      const draft = createDraft("handoff-p3", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await saveInitialDraft(repos, draft);
      const published = await publishCurrentDraft(repos, "handoff-p3", "2026-09-25T00:00:00.000Z");
      const loaded = await repos.published.get("handoff-p3", 1);
      expect(loaded).toEqual(published);
    });

    it("P4 — draft mutation after publish leaves v1 unchanged", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p4", "conv-p", TEST_CREATOR);
      let draft = createDraft("handoff-p4", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await saveInitialDraft(repos, draft);
      const v1 = await publishCurrentDraft(repos, "handoff-p4", "2026-09-25T00:00:00.000Z");
      draft = updateItem(draft, "web", { statement: "Native mobile is confirmed." });
      await saveDraftUpdate(repos, draft);
      expect(await repos.published.get("handoff-p4", 1)).toEqual(v1);
    });

    it("P5 — publish v2 after draft change", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p5", "conv-p", TEST_CREATOR);
      let draft = createDraft("handoff-p5", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await saveInitialDraft(repos, draft);
      const v1 = await publishCurrentDraft(repos, "handoff-p5", "2026-09-25T00:00:00.000Z");
      draft = updateItem(draft, "web", { statement: "Native mobile is confirmed." });
      await saveDraftUpdate(repos, draft);
      const v2 = await publishCurrentDraft(repos, "handoff-p5", "2026-09-25T01:00:00.000Z");
      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(await repos.published.get("handoff-p5", 1)).toEqual(v1);
      expect(await repos.published.get("handoff-p5", 2)).toEqual(v2);
    });

    it("P6 — direct published UPDATE rejected", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p6", "conv-p", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p6", [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })]),
      );
      await publishCurrentDraft(repos, "handoff-p6", "2026-09-25T00:00:00.000Z");
      await expect(
        pool.query(
          `UPDATE published_handoff_versions
           SET snapshot_json = '{"handoffId":"handoff-p6","version":1,"publishedAt":"x","items":[]}'::jsonb
           WHERE handoff_id = $1 AND version = 1`,
          ["handoff-p6"],
        ),
      ).rejects.toThrow(/immutable/i);
    });

    it("P7 — receiver view isolation", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p7", "conv-p", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p7", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-p:m3", excerpt: "Actually, web first." }],
          }),
        ]),
      );
      await publishCurrentDraft(repos, "handoff-p7", "2026-09-25T00:00:00.000Z");
      const view = await repos.receiver.getPublishedView("handoff-p7", 1);
      expect(view?.items.every((entry) => !("sources" in entry))).toBe(true);
      expect(JSON.stringify(view)).not.toMatch(/SECRET exploratory salary discussion/);
      expect(await repos.conversations.get("conv-p")).toBeDefined();
    });

    it("P8 — explicit provenance returns only referenced excerpts", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p8", "conv-p", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p8", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-p:m3", excerpt: "Actually, web first." }],
          }),
        ]),
      );
      await publishCurrentDraft(repos, "handoff-p8", "2026-09-25T00:00:00.000Z");
      const provenance = await repos.receiver.getProvenance("handoff-p8", 1, ["web"]);
      expect(provenance.items).toHaveLength(1);
      expect(provenance.items[0]?.references).toHaveLength(1);
      expect(provenance.items[0]?.references[0]?.messageId).toBe("conv-p:m3");
      expect(provenance.items[0]?.references[0]?.excerpt).toBe("Actually, web first.");
      expect(provenance.items[0]?.references[0]).not.toHaveProperty("content");
      expect(JSON.stringify(provenance)).not.toMatch(/SECRET exploratory salary discussion/);
    });

    it("P9 — transcript/canonical conflict survives persistence", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p9", "conv-p", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p9", [
          item({
            id: "rejected-mobile",
            type: "REJECTED",
            statement: "Mobile-first was explored and rejected.",
          }),
          item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
        ]),
      );
      await publishCurrentDraft(repos, "handoff-p9", "2026-09-25T00:00:00.000Z");
      const view = await repos.receiver.getPublishedView("handoff-p9", 1);
      expect(view).toBeDefined();
      const result = interpretPublished("Are we building mobile first?", authorityFromReceiverView(view!));
      expect(result.answer).toMatch(/Web-first is confirmed/);
      expect(result.answer).not.toMatch(/Maybe mobile first would be good/);
    });

    it("P10 — concurrent publication assigns distinct versions", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p10", "conv-p", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p10", [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })]),
      );
      const [first, second] = await Promise.all([
        publishCurrentDraft(repos, "handoff-p10", "2026-09-25T00:00:00.000Z"),
        publishCurrentDraft(repos, "handoff-p10", "2026-09-25T00:00:00.001Z"),
      ]);
      expect(new Set([first.version, second.version])).toEqual(new Set([1, 2]));
      expect(await repos.published.listVersions("handoff-p10")).toHaveLength(2);
    });

    it("P11 — identical re-import is idempotent", async () => {
      await repos.conversations.create(conversation);
      await repos.conversations.create(conversation);
      const loaded = await repos.conversations.get("conv-p");
      expect(loaded).toEqual(conversation);
      const count = await pool.query("SELECT COUNT(*)::int AS count FROM source_messages WHERE conversation_id = $1", [
        "conv-p",
      ]);
      expect(count.rows[0].count).toBe(conversation.messages.length);
    });

    it("P12 — conflicting re-import rejected", async () => {
      await repos.conversations.create(conversation);
      const conflicting = {
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === "conv-p:m3" ? { ...message, content: "Native mobile is confirmed." } : message,
        ),
      };
      await expect(repos.conversations.create(conflicting)).rejects.toBeInstanceOf(PersistenceConflictError);
      expect(await repos.conversations.get("conv-p")).toEqual(conversation);
    });

    it("P13 — published provenance cannot drift", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p13", "conv-p", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p13", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-p:m3", excerpt: "Actually, web first." }],
          }),
        ]),
      );
      await publishCurrentDraft(repos, "handoff-p13", "2026-09-25T00:00:00.000Z");
      const conflicting = {
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === "conv-p:m3" ? { ...message, content: "Mobile-first is confirmed." } : message,
        ),
      };
      await expect(repos.conversations.create(conflicting)).rejects.toBeInstanceOf(PersistenceConflictError);
      const provenance = await repos.receiver.getProvenance("handoff-p13", 1, ["web"]);
      expect(provenance.items[0]?.references[0]?.excerpt).toBe("Actually, web first.");
    });

    it("P14 — failed import is atomic", async () => {
      const broken = {
        id: "conv-p14",
        source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
        messages: [
          {
            id: "conv-p14:m1",
            role: "creator" as const,
            content: "First message",
            source: { provider: "generic-text" },
          },
          {
            id: "conv-p14:m1",
            role: "assistant" as const,
            content: "Duplicate ID should fail",
            source: { provider: "generic-text" },
          },
        ],
      };
      await expect(repos.conversations.create(broken)).rejects.toThrow();
      expect(await repos.conversations.get("conv-p14")).toBeUndefined();
      const count = await pool.query("SELECT COUNT(*)::int AS count FROM source_messages WHERE conversation_id = $1", [
        "conv-p14",
      ]);
      expect(count.rows[0].count).toBe(0);
    });

    it("handoff root rebinding conflict is rejected", async () => {
      await repos.conversations.create(conversation);
      const other = {
        ...conversation,
        id: "conv-other",
        messages: conversation.messages.map((message) => ({
          ...message,
          id: message.id.replace("conv-p:", "conv-other:"),
        })),
      };
      await repos.conversations.create(other);
      await repos.handoffs.create("handoff-root", "conv-p", TEST_CREATOR);
      await expect(repos.handoffs.create("handoff-root", "conv-other", TEST_CREATOR)).rejects.toBeInstanceOf(
        PersistenceConflictError,
      );
      await expect(repos.handoffs.create("handoff-root", "conv-p", TEST_CREATOR)).resolves.toBeUndefined();
    });

    it("draft stale revision write is rejected", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-draft", "conv-p", TEST_CREATOR);
      const draft = createDraft("handoff-draft", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await saveInitialDraft(repos, draft);
      await expect(repos.drafts.save(draft, 0)).rejects.toBeInstanceOf(PersistenceConflictError);
    });

    it("concurrent draft writes reject stale revision", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-concurrent", "conv-p", TEST_CREATOR);
      const draft = createDraft("handoff-concurrent", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await saveInitialDraft(repos, draft);
      const first = updateItem(draft, "web", { statement: "Revision two." });
      const second = updateItem(draft, "web", { statement: "Revision two alternate." });
      await repos.drafts.save(first, 1);
      await expect(repos.drafts.save(second, 1)).rejects.toBeInstanceOf(PersistenceConflictError);
      expect((await repos.drafts.get("handoff-concurrent"))?.items[0]?.statement).toBe("Revision two.");
    });

    it("provenance never exposes unrelated message content", async () => {
      const sensitive = {
        ...conversation,
        id: "conv-secret",
        messages: [
          {
            id: "conv-secret:m1",
            role: "creator" as const,
            content: "SECRET PRIVATE MATERIAL ... relevant approved sentence.",
            source: { provider: "generic-text" },
          },
        ],
      };
      await repos.conversations.create(sensitive);
      await repos.handoffs.create("handoff-secret", "conv-secret", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-secret", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-secret:m1", excerpt: "relevant approved sentence." }],
          }),
        ]),
      );
      await publishCurrentDraft(repos, "handoff-secret", "2026-09-25T00:00:00.000Z");
      const provenance = await repos.receiver.getProvenance("handoff-secret", 1, ["web"]);
      expect(JSON.stringify(provenance)).toMatch(/relevant approved sentence/);
      expect(JSON.stringify(provenance)).not.toMatch(/SECRET PRIVATE MATERIAL/);
      expect(provenance.items[0]?.references[0]).not.toHaveProperty("content");
    });

    it("P15 — concurrent identical conversation create", async () => {
      const payload = {
        ...conversation,
        id: "conv-p15",
        messages: conversation.messages.map((message) => ({
          ...message,
          id: message.id.replace("conv-p:", "conv-p15:"),
        })),
      };
      const [first, second] = await Promise.allSettled([
        repos.conversations.create(payload),
        repos.conversations.create(payload),
      ]);
      expect(first.status).toBe("fulfilled");
      expect(second.status).toBe("fulfilled");
      const loaded = await repos.conversations.get("conv-p15");
      expect(loaded).toEqual(payload);
      const count = await pool.query("SELECT COUNT(*)::int AS count FROM source_messages WHERE conversation_id = $1", [
        "conv-p15",
      ]);
      expect(count.rows[0].count).toBe(payload.messages.length);
    });

    it("P16 — concurrent conflicting conversation create", async () => {
      const base = {
        ...conversation,
        id: "conv-p16",
        messages: conversation.messages.map((message) => ({
          ...message,
          id: message.id.replace("conv-p:", "conv-p16:"),
        })),
      };
      const conflicting = {
        ...base,
        messages: base.messages.map((message) =>
          message.id.endsWith(":m3") ? { ...message, content: "Native mobile is confirmed." } : message,
        ),
      };
      const results = await Promise.allSettled([
        repos.conversations.create(base),
        repos.conversations.create(conflicting),
      ]);
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected" && result.reason instanceof PersistenceConflictError,
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const loaded = await repos.conversations.get("conv-p16");
      expect([base, conflicting].some((candidate) => JSON.stringify(candidate) === JSON.stringify(loaded))).toBe(true);
      const count = await pool.query("SELECT COUNT(*)::int AS count FROM source_messages WHERE conversation_id = $1", [
        "conv-p16",
      ]);
      expect(count.rows[0].count).toBe(base.messages.length);
    });

    it("P17 — concurrent identical handoff root create", async () => {
      await repos.conversations.create(conversation);
      const [first, second] = await Promise.allSettled([
        repos.handoffs.create("handoff-p17", "conv-p", TEST_CREATOR),
        repos.handoffs.create("handoff-p17", "conv-p", TEST_CREATOR),
      ]);
      expect(first.status).toBe("fulfilled");
      expect(second.status).toBe("fulfilled");
    });

    it("P18 — concurrent conflicting handoff root binding", async () => {
      await repos.conversations.create(conversation);
      const other = {
        ...conversation,
        id: "conv-p18-other",
        messages: conversation.messages.map((message) => ({
          ...message,
          id: message.id.replace("conv-p:", "conv-p18-other:"),
        })),
      };
      await repos.conversations.create(other);
      const results = await Promise.allSettled([
        repos.handoffs.create("handoff-p18", "conv-p", OWNER_A),
        repos.handoffs.create("handoff-p18", "conv-p18-other", OWNER_B),
      ]);
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected" && result.reason instanceof PersistenceConflictError,
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });

    it("P19 — concurrent initial draft writers", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p19", "conv-p", TEST_CREATOR);
      const firstDraft = createDraft("handoff-p19", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      const secondDraft = createDraft("handoff-p19", [
        item({ id: "web", type: "CONFIRMED", statement: "Alternate draft candidate." }),
      ]);
      const results = await Promise.allSettled([
        repos.drafts.save(firstDraft),
        repos.drafts.save(secondDraft),
      ]);
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected" && result.reason instanceof PersistenceConflictError,
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(await repos.drafts.get("handoff-p19")).toBeDefined();
    });

    it("P20 — nonexistent source message rejected at publication", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p20", "conv-p", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p20", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "missing-message" }],
          }),
        ]),
      );
      await expect(publishCurrentDraft(repos, "handoff-p20", "2026-09-25T00:00:00.000Z")).rejects.toBeInstanceOf(
        ProvenanceValidationError,
      );
      expect(await repos.published.get("handoff-p20", 1)).toBeUndefined();
    });

    it("P21 — cross-conversation source reference rejected at publication", async () => {
      await repos.conversations.create(conversation);
      const other = {
        ...conversation,
        id: "conv-p21-other",
        messages: conversation.messages.map((message) => ({
          ...message,
          id: message.id.replace("conv-p:", "conv-p21-other:"),
        })),
      };
      await repos.conversations.create(other);
      await repos.handoffs.create("handoff-p21", "conv-p", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p21", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-p21-other:m3" }],
          }),
        ]),
      );
      await expect(publishCurrentDraft(repos, "handoff-p21", "2026-09-25T00:00:00.000Z")).rejects.toBeInstanceOf(
        ProvenanceValidationError,
      );
      expect(await repos.published.get("handoff-p21", 1)).toBeUndefined();
    });

    it("P22 — fabricated excerpt rejected at publication", async () => {
      const excerptConversation = {
        ...conversation,
        id: "conv-p22",
        messages: [
          {
            id: "conv-p22:m1",
            role: "creator" as const,
            content: "We decided web-first.",
            source: { provider: "generic-text" },
          },
        ],
      };
      await repos.conversations.create(excerptConversation);
      await repos.handoffs.create("handoff-p22", "conv-p22", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p22", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-p22:m1", excerpt: "Mobile-first was approved." }],
          }),
        ]),
      );
      await expect(publishCurrentDraft(repos, "handoff-p22", "2026-09-25T00:00:00.000Z")).rejects.toBeInstanceOf(
        ProvenanceValidationError,
      );
      expect(await repos.published.get("handoff-p22", 1)).toBeUndefined();
    });

    it("P23 — valid excerpt accepted at publication", async () => {
      const excerptConversation = {
        ...conversation,
        id: "conv-p23",
        messages: [
          {
            id: "conv-p23:m1",
            role: "creator" as const,
            content: "We decided web-first.",
            source: { provider: "generic-text" },
          },
        ],
      };
      await repos.conversations.create(excerptConversation);
      await repos.handoffs.create("handoff-p23", "conv-p23", TEST_CREATOR);
      await saveInitialDraft(
        repos,
        createDraft("handoff-p23", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-p23:m1", excerpt: "We decided web-first." }],
          }),
        ]),
      );
      const published = await publishCurrentDraft(repos, "handoff-p23", "2026-09-25T00:00:00.000Z");
      expect(published.version).toBe(1);
    });

    it("P24 — publication rejects changed draft revision", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p24", "conv-p", TEST_CREATOR);
      let draft = createDraft("handoff-p24", [
        item({ id: "web", type: "CONFIRMED", statement: "Initial revision one." }),
      ]);
      await saveInitialDraft(repos, draft);
      draft = updateItem(draft, "web", { statement: "Creator A approved revision two." });
      await saveDraftUpdate(repos, draft);
      draft = updateItem(draft, "web", { statement: "Creator B revision three." });
      await saveDraftUpdate(repos, draft);

      await expect(
        repos.published.publish("handoff-p24", "2026-09-25T00:00:00.000Z", 2),
      ).rejects.toBeInstanceOf(PersistenceConflictError);
      expect(await repos.published.get("handoff-p24", 1)).toBeUndefined();
      expect(await repos.drafts.getRevision("handoff-p24")).toBe(3);
      expect((await repos.drafts.get("handoff-p24"))?.items[0]?.statement).toBe("Creator B revision three.");
    });

    it("P25 — publication never publishes a revision newer than approved", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("handoff-p25", "conv-p", TEST_CREATOR);
      let draft = createDraft("handoff-p25", [
        item({ id: "web", type: "CONFIRMED", statement: "Revision one baseline." }),
      ]);
      await saveInitialDraft(repos, draft);
      const approvedStatement = "Creator approved revision two.";
      const interveningStatement = "Concurrent revision three.";
      draft = updateItem(draft, "web", { statement: approvedStatement });
      await saveDraftUpdate(repos, draft);
      const revisionTwoSnapshot = structuredClone(await repos.drafts.get("handoff-p25"));

      const draftForConcurrentSave = updateItem(draft, "web", { statement: interveningStatement });
      const [publishResult, saveResult] = await Promise.allSettled([
        repos.published.publish("handoff-p25", "2026-09-25T00:00:00.000Z", 2),
        repos.drafts.save(draftForConcurrentSave, 2),
      ]);

      const published = await repos.published.get("handoff-p25", 1);
      const finalRevision = await repos.drafts.getRevision("handoff-p25");
      const finalDraft = await repos.drafts.get("handoff-p25");

      if (published) {
        expect(published.items[0]?.statement).toBe(revisionTwoSnapshot?.items[0]?.statement);
        expect(published.items[0]?.statement).toBe(approvedStatement);
        expect(published.items[0]?.statement).not.toBe(interveningStatement);
      }

      if (publishResult.status === "fulfilled" && saveResult.status === "fulfilled") {
        expect(finalRevision).toBe(3);
        expect(finalDraft?.items[0]?.statement).toBe(interveningStatement);
      } else if (publishResult.status === "rejected" && saveResult.status === "fulfilled") {
        expect(publishResult.reason).toBeInstanceOf(PersistenceConflictError);
        expect(finalRevision).toBe(3);
        expect(published).toBeUndefined();
      } else if (publishResult.status === "fulfilled" && saveResult.status === "rejected") {
        expect(saveResult.reason).toBeInstanceOf(PersistenceConflictError);
        expect(finalRevision).toBe(2);
      } else {
        expect(publishResult.status === "rejected" || saveResult.status === "rejected").toBe(true);
      }

      expect(
        !(published && published.items[0]?.statement === interveningStatement),
      ).toBe(true);
    });
  });
}

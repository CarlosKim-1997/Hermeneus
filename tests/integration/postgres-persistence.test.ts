import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDraft, updateItem } from "../../src/handoff/draft.js";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { publishedForInterpretation } from "../../src/persistence/postgres/receiver-read-repository.js";
import { interpretPublished } from "../../src/receiver/interpret.js";

const url = process.env.TEST_DATABASE_URL;

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return {
    priority: "CORE",
    createdBy: "CREATOR",
    sources: [{ messageId: "m1" }],
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
        "TRUNCATE published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations RESTART IDENTITY CASCADE",
      );
    });

    afterAll(async () => {
      await pool.end();
    });

    it("P1 — normalized conversation round trip", async () => {
      await repos.conversations.save(conversation);
      const loaded = await repos.conversations.get("conv-p");
      expect(loaded).toEqual(conversation);
    });

    it("P2 — draft round trip", async () => {
      await repos.conversations.save(conversation);
      const draft = createDraft("handoff-p2", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await repos.handoffs.create("handoff-p2", "conv-p");
      await repos.drafts.save(draft);
      expect(await repos.drafts.get("handoff-p2")).toEqual(draft);
    });

    it("P3 — publish v1", async () => {
      await repos.conversations.save(conversation);
      await repos.handoffs.create("handoff-p3", "conv-p");
      const draft = createDraft("handoff-p3", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await repos.drafts.save(draft);
      const published = await repos.published.publish("handoff-p3", "2026-09-25T00:00:00.000Z");
      const loaded = await repos.published.get("handoff-p3", 1);
      expect(loaded).toEqual(published);
    });

    it("P4 — draft mutation after publish leaves v1 unchanged", async () => {
      await repos.conversations.save(conversation);
      await repos.handoffs.create("handoff-p4", "conv-p");
      let draft = createDraft("handoff-p4", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await repos.drafts.save(draft);
      const v1 = await repos.published.publish("handoff-p4", "2026-09-25T00:00:00.000Z");
      draft = updateItem(draft, "web", { statement: "Native mobile is confirmed." });
      await repos.drafts.save(draft);
      expect(await repos.published.get("handoff-p4", 1)).toEqual(v1);
    });

    it("P5 — publish v2 after draft change", async () => {
      await repos.conversations.save(conversation);
      await repos.handoffs.create("handoff-p5", "conv-p");
      let draft = createDraft("handoff-p5", [
        item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
      ]);
      await repos.drafts.save(draft);
      const v1 = await repos.published.publish("handoff-p5", "2026-09-25T00:00:00.000Z");
      draft = updateItem(draft, "web", { statement: "Native mobile is confirmed." });
      await repos.drafts.save(draft);
      const v2 = await repos.published.publish("handoff-p5", "2026-09-25T01:00:00.000Z");
      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(await repos.published.get("handoff-p5", 1)).toEqual(v1);
      expect(await repos.published.get("handoff-p5", 2)).toEqual(v2);
    });

    it("P6 — direct published UPDATE rejected", async () => {
      await repos.conversations.save(conversation);
      await repos.handoffs.create("handoff-p6", "conv-p");
      await repos.drafts.save(
        createDraft("handoff-p6", [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })]),
      );
      await repos.published.publish("handoff-p6", "2026-09-25T00:00:00.000Z");
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
      await repos.conversations.save(conversation);
      await repos.handoffs.create("handoff-p7", "conv-p");
      await repos.drafts.save(
        createDraft("handoff-p7", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-p:m3", excerpt: "Actually, web first." }],
          }),
        ]),
      );
      await repos.published.publish("handoff-p7", "2026-09-25T00:00:00.000Z");
      const view = await repos.receiver.getPublishedView("handoff-p7", 1);
      expect(view?.items.every((entry) => !("sources" in entry))).toBe(true);
      expect(JSON.stringify(view)).not.toMatch(/SECRET exploratory salary discussion/);
      expect(await repos.conversations.get("conv-p")).toBeDefined();
    });

    it("P8 — explicit provenance returns only referenced messages", async () => {
      await repos.conversations.save(conversation);
      await repos.handoffs.create("handoff-p8", "conv-p");
      await repos.drafts.save(
        createDraft("handoff-p8", [
          item({
            id: "web",
            type: "CONFIRMED",
            statement: "Web-first is confirmed.",
            sources: [{ messageId: "conv-p:m3", excerpt: "Actually, web first." }],
          }),
        ]),
      );
      await repos.published.publish("handoff-p8", "2026-09-25T00:00:00.000Z");
      const provenance = await repos.receiver.getProvenance("handoff-p8", 1, ["web"]);
      expect(provenance.items).toHaveLength(1);
      expect(provenance.items[0]?.messages).toHaveLength(1);
      expect(provenance.items[0]?.messages[0]?.messageId).toBe("conv-p:m3");
      expect(provenance.items[0]?.messages[0]?.content).toBe("Actually, web first.");
      expect(JSON.stringify(provenance)).not.toMatch(/SECRET exploratory salary discussion/);
    });

    it("P9 — transcript/canonical conflict survives persistence", async () => {
      await repos.conversations.save(conversation);
      await repos.handoffs.create("handoff-p9", "conv-p");
      await repos.drafts.save(
        createDraft("handoff-p9", [
          item({
            id: "rejected-mobile",
            type: "REJECTED",
            statement: "Mobile-first was explored and rejected.",
          }),
          item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
        ]),
      );
      await repos.published.publish("handoff-p9", "2026-09-25T00:00:00.000Z");
      const view = await repos.receiver.getPublishedView("handoff-p9", 1);
      expect(view).toBeDefined();
      const result = interpretPublished("Are we building mobile first?", publishedForInterpretation(view!));
      expect(result.answer).toMatch(/Web-first is confirmed/);
      expect(result.answer).not.toMatch(/Maybe mobile first would be good/);
    });

    it("P10 — concurrent publication assigns distinct versions", async () => {
      await repos.conversations.save(conversation);
      await repos.handoffs.create("handoff-p10", "conv-p");
      await repos.drafts.save(
        createDraft("handoff-p10", [item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." })]),
      );
      const [first, second] = await Promise.all([
        repos.published.publish("handoff-p10", "2026-09-25T00:00:00.000Z"),
        repos.published.publish("handoff-p10", "2026-09-25T00:00:00.001Z"),
      ]);
      expect(new Set([first.version, second.version])).toEqual(new Set([1, 2]));
      expect(await repos.published.listVersions("handoff-p10")).toHaveLength(2);
    });
  });
}

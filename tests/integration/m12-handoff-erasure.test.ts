import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDraft } from "../../src/handoff/draft.js";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { SourceBackedDraftRejectedError } from "../../src/persistence/errors.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { generateShareToken, hashShareToken } from "../../src/share/token.js";
import { generateHandoffExtractionProposal } from "../../src/application/use-cases/generate-extraction-proposal.js";
import { resolveActiveShareTarget } from "../../src/application/use-cases/share-capability.js";
import type { HandoffExtractor } from "../../src/extraction/extractor.js";

const url = process.env.TEST_DATABASE_URL;
const CREATOR_A = "creator_erase_a";
const CREATOR_B = "creator_erase_b";

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return { priority: "CORE", createdBy: "CREATOR", sources: [], ...partial };
}

const conversation = {
  id: "conv-er",
  source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
  messages: [
    {
      id: "conv-er:m1",
      role: "creator" as const,
      content: "Actually, web first.",
      source: { provider: "generic-text" },
    },
  ],
};

async function seedHandoff(repos: ReturnType<typeof createPostgresRepositories>, handoffId: string, owner: string) {
  await repos.conversations.create(conversation);
  await repos.handoffs.create(handoffId, "conv-er", owner);
  await repos.drafts.save(
    createDraft(handoffId, [
      item({
        id: "web",
        type: "CONFIRMED",
        statement: "Web-first is confirmed.",
        sources: [{ messageId: "conv-er:m1", excerpt: "Actually, web first." }],
      }),
    ]),
  );
  return repos.published.publish(handoffId, "2026-09-25T00:00:00.000Z", 1);
}

if (!url) {
  describe.skip("M12 handoff erasure", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("M12 handoff erasure", () => {
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
      await repos.creators.ensure({ id: CREATOR_B, createdAt: "2026-09-25T00:00:00.000Z" });
    });

    afterAll(async () => {
      await pool.end();
    });

    it("E17-S1 — retained to erased source lifecycle", async () => {
      const published = await seedHandoff(repos, "hd-s1", CREATOR_A);
      const beforeDraft = await repos.drafts.get("hd-s1");
      const result = await repos.erasure.eraseSource("hd-s1", CREATOR_A, "2026-10-06T12:00:00.000Z");
      expect(result.idempotent).toBe(false);
      const state = await repos.handoffs.getHandoffSourceState("hd-s1");
      expect(state?.kind).toBe("erased");
      const prov = await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-s1'`);
      expect(prov.rows[0].c).toBe(0);
      const afterPublished = await repos.published.get("hd-s1", 1);
      expect(afterPublished).toEqual(published);
      const afterDraft = await repos.drafts.get("hd-s1");
      expect(afterDraft?.items[0]?.statement).toBe(beforeDraft?.items[0]?.statement);
      expect(afterDraft?.items.every((entry) => entry.sources.length === 0)).toBe(true);
      expect(afterDraft?.items[0]?.sources).toEqual([]);
      expect(result.draftRevision).toBe(2);
    });

    it("E17-S2 — physical source deleted when unreferenced", async () => {
      await seedHandoff(repos, "hd-s2", CREATOR_A);
      await repos.erasure.eraseSource("hd-s2", CREATOR_A, "2026-10-06T12:00:00.000Z");
      expect(await repos.conversations.get("conv-er")).toBeUndefined();
    });

    it("E17-S3 — shared source retained for other Handoff", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("hd-a", "conv-er", CREATOR_A);
      await repos.handoffs.create("hd-b", "conv-er", CREATOR_B);
      await repos.drafts.save(createDraft("hd-a", [item({ id: "a", type: "CONFIRMED", statement: "A." })]));
      await repos.drafts.save(
        createDraft("hd-b", [
          item({
            id: "b",
            type: "CONFIRMED",
            statement: "B.",
            sources: [{ messageId: "conv-er:m1", excerpt: "Actually, web first." }],
          }),
        ]),
      );
      await repos.published.publish("hd-a", "2026-09-25T00:00:00.000Z", 1);
      await repos.published.publish("hd-b", "2026-09-25T00:00:00.000Z", 1);

      await repos.erasure.eraseSource("hd-a", CREATOR_A, "2026-10-06T12:00:00.000Z");

      expect((await repos.handoffs.getHandoffSourceState("hd-a"))?.kind).toBe("erased");
      expect((await repos.handoffs.getHandoffSourceState("hd-b"))?.kind).toBe("retained");
      expect(await repos.conversations.get("conv-er")).toBeDefined();
      const provB = await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-b'`);
      expect(provB.rows[0].c).toBe(1);
      const prov = await repos.receiver.getProvenance("hd-b", 1, ["b"]);
      expect(prov.availability).toBe("retained");
    });

    it("E17-S4 — repeat erase is idempotent", async () => {
      await seedHandoff(repos, "hd-s4", CREATOR_A);
      await repos.erasure.eraseSource("hd-s4", CREATOR_A, "2026-10-06T12:00:00.000Z");
      const rev = await repos.drafts.getRevision("hd-s4");
      const again = await repos.erasure.eraseSource("hd-s4", CREATOR_A, "2026-10-06T12:00:00.000Z");
      expect(again.idempotent).toBe(true);
      expect(await repos.drafts.getRevision("hd-s4")).toBe(rev);
    });

    it("E17-S6 — stale draft source reintroduction rejected", async () => {
      await seedHandoff(repos, "hd-s6", CREATOR_A);
      const stale = createDraft("hd-s6", [
        item({
          id: "web",
          type: "CONFIRMED",
          statement: "Web-first is confirmed.",
          sources: [{ messageId: "conv-er:m1" }],
        }),
      ]);
      await repos.erasure.eraseSource("hd-s6", CREATOR_A, "2026-10-06T12:00:00.000Z");
      await expect(repos.drafts.save(stale, 2)).rejects.toBeInstanceOf(SourceBackedDraftRejectedError);
    });

    it("E17-S7 — canonical-only draft edit after erasure", async () => {
      await seedHandoff(repos, "hd-s7", CREATOR_A);
      await repos.erasure.eraseSource("hd-s7", CREATOR_A, "2026-10-06T12:00:00.000Z");
      const draft = createDraft("hd-s7", [
        item({ id: "web", type: "OPEN", statement: "Updated canonical only.", sources: [] }),
      ]);
      const saved = await repos.drafts.save(draft, 2);
      expect(saved.revision).toBe(3);
    });

    it("E17-S8 — canonical-only publish after erasure", async () => {
      await seedHandoff(repos, "hd-s8", CREATOR_A);
      await repos.erasure.eraseSource("hd-s8", CREATOR_A, "2026-10-06T12:00:00.000Z");
      const published = await repos.published.publish("hd-s8", "2026-10-06T13:00:00.000Z", 2);
      expect(published.version).toBe(2);
      const prov = await pool.query(`SELECT COUNT(*)::int AS c FROM published_handoff_provenance WHERE handoff_id = 'hd-s8' AND version = 2`);
      expect(prov.rows[0].c).toBe(0);
    });

    it("E17-S9 — extraction after erasure does not invoke extractor", async () => {
      await seedHandoff(repos, "hd-s9", CREATOR_A);
      await repos.erasure.eraseSource("hd-s9", CREATOR_A, "2026-10-06T12:00:00.000Z");
      let called = false;
      const extractor: HandoffExtractor = {
        extract: async () => {
          called = true;
          return { candidates: [] };
        },
      };
      await expect(generateHandoffExtractionProposal(repos, extractor, "hd-s9")).rejects.toThrow(/erased/i);
      expect(called).toBe(false);
    });

    it("E17-S11 — provenance unavailable after erasure", async () => {
      await seedHandoff(repos, "hd-s11", CREATOR_A);
      await repos.erasure.eraseSource("hd-s11", CREATOR_A, "2026-10-06T12:00:00.000Z");
      const prov = await repos.receiver.getProvenance("hd-s11", 1, ["web"]);
      expect(prov.availability).toBe("unavailable_erased");
    });

    it("E17-H1/E17-H2 — complete Handoff delete and bearer unavailable", async () => {
      await seedHandoff(repos, "hd-h1", CREATOR_A);
      const rawToken = generateShareToken();
      await repos.shareCapabilities.create({
        id: "shcap-h1",
        handoffId: "hd-h1",
        version: 1,
        tokenHash: hashShareToken(rawToken),
        createdAt: "2026-09-25T00:00:00.000Z",
      });
      await repos.erasure.deleteHandoff("hd-h1", CREATOR_A);
      expect(await resolveActiveShareTarget(repos, rawToken)).toBeUndefined();
      expect(await repos.drafts.get("hd-h1")).toBeUndefined();
      expect(await repos.published.get("hd-h1", 1)).toBeUndefined();
      expect(await repos.handoffs.getOwnerCreatorId("hd-h1")).toBeUndefined();
      const shares = await pool.query(`SELECT 1 FROM share_capabilities WHERE handoff_id = 'hd-h1'`);
      expect(shares.rowCount).toBe(0);
    });

    it("E17-H5 — unauthorized delete is unavailable", async () => {
      await seedHandoff(repos, "hd-h5", CREATOR_A);
      await expect(repos.erasure.deleteHandoff("hd-h5", CREATOR_B)).rejects.toThrow(/unavailable/i);
      expect(await repos.handoffs.getOwnerCreatorId("hd-h5")).toBe(CREATOR_A);
    });

    it("E17-H3 — cross-owner source safety on Handoff delete", async () => {
      await repos.conversations.create(conversation);
      await repos.handoffs.create("hd-del-a", "conv-er", CREATOR_A);
      await repos.handoffs.create("hd-del-b", "conv-er", CREATOR_B);
      await repos.drafts.save(createDraft("hd-del-a", [item({ id: "a", type: "CONFIRMED", statement: "A." })]));
      await repos.drafts.save(createDraft("hd-del-b", [item({ id: "b", type: "CONFIRMED", statement: "B." })]));
      await repos.erasure.deleteHandoff("hd-del-a", CREATOR_A);
      expect(await repos.handoffs.getOwnerCreatorId("hd-del-b")).toBe(CREATOR_B);
      expect(await repos.conversations.get("conv-er")).toBeDefined();
    });

    it("E17-H4 — delete after source erasure", async () => {
      await seedHandoff(repos, "hd-h4", CREATOR_A);
      await repos.erasure.eraseSource("hd-h4", CREATOR_A, "2026-10-06T12:00:00.000Z");
      await repos.erasure.deleteHandoff("hd-h4", CREATOR_A);
      expect(await repos.handoffs.getOwnerCreatorId("hd-h4")).toBeUndefined();
    });
  });
}

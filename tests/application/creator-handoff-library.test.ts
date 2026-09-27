import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { HandoffItem } from "../../src/handoff/schema.js";
import { closePool, getRepositories } from "../../src/application/runtime.js";
import { importAndCreateHandoff } from "../../src/application/use-cases/import-conversation.js";
import { listCreatorHandoffs } from "../../src/application/use-cases/list-creator-handoffs.js";
import { saveCreatorDraft } from "../../src/application/use-cases/creator-review.js";
import { publishHandoff } from "../../src/application/use-cases/publish-handoff.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;
const CREATOR_A = "creator_library_a";
const CREATOR_B = "creator_library_b";
const LEGACY = "creator_legacy_pre_m9";
const transcript = `creator: Library test line one.
assistant: Acknowledged.`;

function item(id: string, statement: string, messageId: string, excerpt?: string): HandoffItem {
  return {
    id,
    type: "CONFIRMED",
    statement,
    priority: "CORE",
    createdBy: "CREATOR",
    sources: [{ messageId, excerpt: excerpt ?? statement }],
  };
}

if (!url) {
  describe.skip("Creator Handoff Library (L)", () => undefined);
} else {
  describe("Creator Handoff Library (L)", () => {
    const pool = createPool(url);
    let repos: ReturnType<typeof getRepositories>;

    beforeAll(() => {
      process.env.DATABASE_URL = url;
      execSync("node scripts/migrate.mjs", { env: { ...process.env, TEST_DATABASE_URL: url }, stdio: "pipe" });
      repos = getRepositories();
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE share_capabilities, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creator_external_identities RESTART IDENTITY CASCADE",
      );
      await pool.query("DELETE FROM creators WHERE id NOT IN ($1)", [LEGACY]);
      await repos.creators.ensure({ id: CREATOR_A, createdAt: "2026-01-01T00:00:00.000Z" });
      await repos.creators.ensure({ id: CREATOR_B, createdAt: "2026-01-01T00:00:00.000Z" });
      await repos.creators.ensure({ id: LEGACY, createdAt: "2026-01-01T00:00:00.000Z" });
    });

    afterAll(async () => {
      await closePool();
    });

    it("L1 — owner A lists only A Handoffs", async () => {
      const a1 = await importAndCreateHandoff(repos, CREATOR_A, transcript);
      const a2 = await importAndCreateHandoff(repos, CREATOR_A, transcript);
      await importAndCreateHandoff(repos, CREATOR_B, transcript);

      const list = await listCreatorHandoffs(repos, CREATOR_A);
      expect(list.map((h) => h.handoffId).sort()).toEqual([a1.handoffId, a2.handoffId].sort());
    });

    it("L2 — owner B lists only B Handoffs", async () => {
      await importAndCreateHandoff(repos, CREATOR_A, transcript);
      const b1 = await importAndCreateHandoff(repos, CREATOR_B, transcript);

      const list = await listCreatorHandoffs(repos, CREATOR_B);
      expect(list.map((h) => h.handoffId)).toEqual([b1.handoffId]);
    });

    it("L3 — legacy-owned Handoff absent for normal Creator", async () => {
      const legacyHandoff = await importAndCreateHandoff(repos, LEGACY, transcript);
      expect(legacyHandoff.handoffId).toBeTruthy();
      await importAndCreateHandoff(repos, CREATOR_A, transcript);

      const list = await listCreatorHandoffs(repos, CREATOR_A);
      expect(list.every((h) => h.handoffId !== legacyHandoff.handoffId)).toBe(true);
    });

    it("L4 — draft-only summary has no published fields", async () => {
      const created = await importAndCreateHandoff(repos, CREATOR_A, transcript);
      const list = await listCreatorHandoffs(repos, CREATOR_A);
      const row = list.find((h) => h.handoffId === created.handoffId);
      expect(row?.draftRevision).toBe(1);
      expect(row?.latestPublishedVersion).toBeUndefined();
      expect(row?.latestPublishedAt).toBeUndefined();
    });

    it("L5 — latest published version summary", async () => {
      const created = await importAndCreateHandoff(repos, CREATOR_A, transcript);
      const convId = await repos.handoffs.getSourceConversationId(created.handoffId);
      const conv = await repos.conversations.get(convId!);
      const creatorMsg = conv!.messages.find((m) => m.role === "creator")!;
      const msgId = creatorMsg.id;
      const excerpt = creatorMsg.content;

      let revision = (await repos.drafts.getRevision(created.handoffId))!;
      for (let version = 1; version <= 3; version += 1) {
        const saved = await saveCreatorDraft(
          repos,
          created.handoffId,
          [item(`item_v${version}`, `Statement v${version}`, msgId, excerpt)],
          revision,
        );
        revision = saved.revision;
        await publishHandoff(repos, created.handoffId, revision);
        revision = (await repos.drafts.getRevision(created.handoffId))!;
      }

      const list = await listCreatorHandoffs(repos, CREATOR_A);
      const row = list.find((h) => h.handoffId === created.handoffId);
      expect(row?.latestPublishedVersion).toBe(3);
      expect(row?.latestPublishedAt).toBeTruthy();
    });

    it("L6 — stable newest-first order", async () => {
      const older = await importAndCreateHandoff(repos, CREATOR_A, transcript);
      const newer = await importAndCreateHandoff(repos, CREATOR_A, transcript);
      await pool.query(`UPDATE handoffs SET created_at = $1 WHERE id = $2`, [
        "2019-01-01T00:00:00.000Z",
        older.handoffId,
      ]);

      const list = await listCreatorHandoffs(repos, CREATOR_A);
      expect(list[0]!.handoffId).toBe(newer.handoffId);
    });

    it("L7 — summary excludes source, provenance, and external identity fields", async () => {
      await importAndCreateHandoff(repos, CREATOR_A, transcript);
      const list = await listCreatorHandoffs(repos, CREATOR_A);
      const serialized = JSON.stringify(list);
      expect(serialized).not.toMatch(/sourceConversationId|source_messages|NormalizedConversation|google|subject|email|token/i);
      for (const row of list) {
        expect(Object.keys(row).sort()).toEqual(
          [
            "createdAt",
            "draftRevision",
            "draftUpdatedAt",
            "handoffId",
            "latestPublishedAt",
            "latestPublishedVersion",
          ].sort(),
        );
      }
    });
  });
}

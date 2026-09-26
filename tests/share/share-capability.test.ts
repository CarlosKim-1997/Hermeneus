import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft } from "../../src/handoff/draft.js";
import type { DraftHandoff, HandoffItem } from "../../src/handoff/schema.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { toSharedReceiverView } from "../../src/persistence/share-types.js";
import { setReceiverSemanticInterpreterForTests } from "../../src/application/receiver-interpreter-factory.js";
import {
  issueShareCapability,
  resolveActiveShareTarget,
  revokeShareCapability,
  ShareCapabilityError,
} from "../../src/application/use-cases/share-capability.js";
import {
  askSharedReceiverQuestion,
  fetchSharedReceiverProvenance,
  loadSharedReceiverView,
} from "../../src/application/use-cases/shared-receiver-qa.js";
import { hashShareToken } from "../../src/share/token.js";

const url = process.env.TEST_DATABASE_URL;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type Repos = ReturnType<typeof createPostgresRepositories>;

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return { priority: "CORE", createdBy: "CREATOR", sources: [], ...partial };
}

async function seedPublished(repos: Repos, handoffId: string, statement: string, secretMarker?: string) {
  const messageContent = secretMarker ?? statement;
  const conversation = {
    id: `conv-${handoffId}`,
    source: { provider: "generic-text" as const, importedAt: "2026-09-25T00:00:00.000Z" },
    messages: [
      {
        id: `${handoffId}:m1`,
        role: "creator" as const,
        content: messageContent,
        source: { provider: "generic-text" as const },
      },
    ],
  };
  await repos.conversations.create(conversation);
  await repos.handoffs.create(handoffId, conversation.id);
  const draft = createDraft(handoffId, [
    item({
      id: "core",
      type: "CONFIRMED",
      statement,
      sources: secretMarker
        ? [{ messageId: `${handoffId}:m1` }]
        : [{ messageId: `${handoffId}:m1`, excerpt: statement }],
    }),
  ]);
  await repos.drafts.save(draft);
  const revision = await repos.drafts.getRevision(handoffId);
  return repos.published.publish(handoffId, "2026-09-25T12:00:00.000Z", revision!);
}

if (!url) {
  describe.skip("Share capability", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("Share capability", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      const migrateEnv = { ...process.env, TEST_DATABASE_URL: url } as NodeJS.ProcessEnv;
      delete migrateEnv.DATABASE_URL;
      execSync("node scripts/migrate.mjs", {
        env: migrateEnv,
        stdio: "pipe",
      });
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE share_capabilities, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations RESTART IDENTITY CASCADE",
      );
      setReceiverSemanticInterpreterForTests(undefined);
    });

    afterAll(async () => {
      await pool.end();
    });

    it("S1 — issuance returns token once and resolves", async () => {
      await seedPublished(repos, "hd-s1", "Browser-first MVP.");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s1", version: 1 });
      expect(issued.rawToken.startsWith("hsh_")).toBe(true);
      expect(issued.metadata.version).toBe(1);
      const target = await resolveActiveShareTarget(repos, issued.rawToken);
      expect(target).toEqual({ handoffId: "hd-s1", version: 1 });
    });

    it("S2 — raw secret not persisted", async () => {
      await seedPublished(repos, "hd-s2", "Pinned.");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s2", version: 1 });
      const rows = await pool.query(`SELECT token_hash::text AS token_hash FROM share_capabilities WHERE id = $1`, [
        issued.metadata.id,
      ]);
      expect(rows.rows[0]?.token_hash).toBe(hashShareToken(issued.rawToken));
      const serialized = JSON.stringify(rows.rows);
      expect(serialized).not.toContain(issued.rawToken);
      expect(serialized).not.toContain(issued.rawToken.slice(4));
    });

    it("S3 — malformed token unavailable", async () => {
      await seedPublished(repos, "hd-s3", "Pinned.");
      expect(await resolveActiveShareTarget(repos, "not-a-token")).toBeUndefined();
      expect(await loadSharedReceiverView(repos, "hsh_tooshort")).toBeUndefined();
    });

    it("S4 — modified token unavailable", async () => {
      await seedPublished(repos, "hd-s4", "Pinned.");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s4", version: 1 });
      const mutated = `${issued.rawToken.slice(0, -1)}X`;
      expect(await resolveActiveShareTarget(repos, mutated)).toBeUndefined();
    });

    it("S5 — revocation blocks resolution without mutating publication", async () => {
      const published = await seedPublished(repos, "hd-s5", "Immutable body.");
      const before = JSON.stringify(await repos.published.get("hd-s5", 1));
      const issued = await issueShareCapability(repos, { handoffId: "hd-s5", version: 1 });
      expect(await resolveActiveShareTarget(repos, issued.rawToken)).toBeTruthy();
      await revokeShareCapability(repos, { capabilityId: issued.metadata.id });
      expect(await resolveActiveShareTarget(repos, issued.rawToken)).toBeUndefined();
      const after = JSON.stringify(await repos.published.get("hd-s5", 1));
      expect(after).toBe(before);
      expect(published.version).toBe(1);
    });

    it("S6 — independent capabilities revoke separately", async () => {
      await seedPublished(repos, "hd-s6", "Shared.");
      const a = await issueShareCapability(repos, { handoffId: "hd-s6", version: 1 });
      const b = await issueShareCapability(repos, { handoffId: "hd-s6", version: 1 });
      await revokeShareCapability(repos, { capabilityId: a.metadata.id });
      expect(await resolveActiveShareTarget(repos, a.rawToken)).toBeUndefined();
      expect(await resolveActiveShareTarget(repos, b.rawToken)).toEqual({ handoffId: "hd-s6", version: 1 });
    });

    it("S7 — token stays on v1 after v2 publication", async () => {
      await seedPublished(repos, "hd-s7", "Version one scope.");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s7", version: 1 });
      const draft = await repos.drafts.get("hd-s7");
      const updated: DraftHandoff = {
        ...draft!,
        items: [...draft!.items, item({ id: "v2-only", type: "CONFIRMED", statement: "Version two addition." })],
      };
      const revision = await repos.drafts.getRevision("hd-s7");
      await repos.drafts.save(updated, revision!);
      await repos.published.publish("hd-s7", "2026-09-26T12:00:00.000Z", revision! + 1);
      expect(await resolveActiveShareTarget(repos, issued.rawToken)).toEqual({ handoffId: "hd-s7", version: 1 });
    });

    it("S8 — separate tokens pin v1 and v2", async () => {
      await seedPublished(repos, "hd-s8", "v1 item.");
      const tokenV1 = await issueShareCapability(repos, { handoffId: "hd-s8", version: 1 });
      const draft = await repos.drafts.get("hd-s8");
      const revision = await repos.drafts.getRevision("hd-s8");
      await repos.drafts.save(
        { ...draft!, items: [...draft!.items, item({ id: "v2", type: "CONFIRMED", statement: "v2 only." })] },
        revision!,
      );
      await repos.published.publish("hd-s8", "2026-09-26T12:00:00.000Z", revision! + 1);
      const tokenV2 = await issueShareCapability(repos, { handoffId: "hd-s8", version: 2 });
      expect(await resolveActiveShareTarget(repos, tokenV1.rawToken)).toEqual({ handoffId: "hd-s8", version: 1 });
      expect(await resolveActiveShareTarget(repos, tokenV2.rawToken)).toEqual({ handoffId: "hd-s8", version: 2 });
    });

    it("S9 — draft cannot be shared", async () => {
      await repos.conversations.create({
        id: "conv-s9",
        source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
        messages: [],
      });
      await repos.handoffs.create("hd-s9", "conv-s9");
      await repos.drafts.save(createDraft("hd-s9", [item({ id: "d", type: "CONFIRMED", statement: "draft only" })]));
      await expect(issueShareCapability(repos, { handoffId: "hd-s9", version: 1 })).rejects.toBeInstanceOf(
        ShareCapabilityError,
      );
    });

    it("S10 — share lifecycle does not mutate published snapshot", async () => {
      await seedPublished(repos, "hd-s10", "Frozen.");
      const before = JSON.stringify(await repos.published.get("hd-s10", 1));
      const issued = await issueShareCapability(repos, { handoffId: "hd-s10", version: 1 });
      await revokeShareCapability(repos, { capabilityId: issued.metadata.id });
      const after = JSON.stringify(await repos.published.get("hd-s10", 1));
      expect(after).toBe(before);
    });

    it("S11 — shared view omits handoffId", async () => {
      await seedPublished(repos, "hd-s11", "Shared view.");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s11", version: 1 });
      const view = await loadSharedReceiverView(repos, issued.rawToken);
      const serialized = JSON.stringify(view);
      expect(serialized).not.toMatch(/handoffId/);
      expect(serialized).not.toMatch(/sourceConversation/);
      expect(view).toEqual(
        toSharedReceiverView({
          version: 1,
          publishedAt: view!.publishedAt,
          items: view!.items,
        }),
      );
    });

    it("S12 — shared Q&A does not leak raw secret transcript", async () => {
      const secret = "SECRET-SHARE-MARKER-XYZZY";
      await seedPublished(repos, "hd-s12", "Public canonical only.", secret);
      const issued = await issueShareCapability(repos, { handoffId: "hd-s12", version: 1 });
      const outcome = await askSharedReceiverQuestion(repos, {
        token: issued.rawToken,
        question: "What is public?",
      });
      expect(outcome.kind).toBe("answer");
      const payload = JSON.stringify(outcome);
      expect(payload).not.toContain(secret);
    });

    it("S13 — shared provenance omits conversation and message identifiers", async () => {
      const conversationId = "conv-share-secret-internal-id";
      const messageId = `${conversationId}:m1`;
      const approvedExcerpt = "Approved excerpt for shared provenance.";
      await repos.conversations.create({
        id: conversationId,
        source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
        messages: [
          {
            id: messageId,
            role: "creator",
            content: `${approvedExcerpt} ${conversationId} tail`,
            source: { provider: "generic-text" },
          },
        ],
      });
      await repos.handoffs.create("hd-s13", conversationId);
      const draft = createDraft("hd-s13", [
        item({
          id: "core",
          type: "CONFIRMED",
          statement: "Shared provenance item.",
          sources: [{ messageId, excerpt: approvedExcerpt }],
        }),
      ]);
      await repos.drafts.save(draft);
      const revision = await repos.drafts.getRevision("hd-s13");
      await repos.published.publish("hd-s13", "2026-09-25T12:00:00.000Z", revision!);

      const issued = await issueShareCapability(repos, { handoffId: "hd-s13", version: 1 });
      const outcome = await fetchSharedReceiverProvenance(repos, { token: issued.rawToken, itemIds: ["core"] });
      expect(outcome.kind).toBe("provenance");
      if (outcome.kind !== "provenance") return;
      const serialized = JSON.stringify(outcome);
      expect(serialized).not.toMatch(/handoffId/);
      expect(serialized).not.toMatch(/sourceConversationId/);
      expect(serialized).not.toMatch(/messageId/);
      expect(serialized).not.toContain(conversationId);
      expect(serialized).toContain(approvedExcerpt);

      const reference = outcome.provenance.items[0]!.references[0]!;
      expect(reference).toEqual({
        role: "creator",
        excerpt: approvedExcerpt,
        excerptAvailable: true,
      });
      expect(reference).not.toHaveProperty("messageId");
    });

    it("S14 — revoked capability blocks subsequent Q&A", async () => {
      await seedPublished(repos, "hd-s14", "Live revoke.");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s14", version: 1 });
      expect((await loadSharedReceiverView(repos, issued.rawToken))?.version).toBe(1);
      await revokeShareCapability(repos, { capabilityId: issued.metadata.id });
      const outcome = await askSharedReceiverQuestion(repos, { token: issued.rawToken, question: "What?" });
      expect(outcome).toEqual({ kind: "unavailable" });
    });

    it("S15 — revoked capability blocks provenance", async () => {
      await seedPublished(repos, "hd-s15", "Prov revoke.");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s15", version: 1 });
      await revokeShareCapability(repos, { capabilityId: issued.metadata.id });
      const outcome = await fetchSharedReceiverProvenance(repos, { token: issued.rawToken, itemIds: ["core"] });
      expect(outcome).toEqual({ kind: "unavailable" });
    });

    it("S32 — share actions are token-scoped in API surface", () => {
      const shareActionsSource = readFileSync(path.join(repoRoot, "src/application/share-actions.ts"), "utf8");
      expect(shareActionsSource).toMatch(/askSharedReceiverQuestionAction\(input: \{ token: string; question: string \}\)/);
      expect(shareActionsSource).toMatch(/fetchSharedReceiverProvenanceAction\(input: \{ token: string; itemIds: string\[\] \}\)/);
      expect(shareActionsSource).not.toMatch(/askSharedReceiverQuestionAction[\s\S]*handoffId/);
      const sharedConsole = readFileSync(path.join(repoRoot, "src/app/components/shared-receiver-console.tsx"), "utf8");
      expect(sharedConsole).toContain("askSharedReceiverQuestionAction");
      expect(sharedConsole).not.toContain("askReceiverQuestionAction");
    });

    it("S33 — share token and handoffId do not reach semantic interpreter payload", async () => {
      await seedPublished(repos, "hd-s33", "Model boundary.");
      const issued = await issueShareCapability(repos, { handoffId: "hd-s33", version: 1 });
      const marker = "hsh_MODEL_BOUNDARY_MARKER";
      const interpret = vi.fn(async () => ({
        classification: "SUPPORTED" as const,
        citationIds: ["core"],
      }));
      setReceiverSemanticInterpreterForTests({ interpret });
      await askSharedReceiverQuestion(repos, {
        token: issued.rawToken,
        question: "What is canonical?",
      });
      expect(interpret).toHaveBeenCalled();
      const payload = JSON.stringify(interpret.mock.calls);
      expect(payload).not.toContain(marker);
      expect(payload).not.toContain("hd-s33");
      expect(payload).not.toContain(issued.rawToken);
      expect(payload).not.toContain(hashShareToken(issued.rawToken));
      expect(payload).not.toContain(issued.metadata.id);
    });
  });
}

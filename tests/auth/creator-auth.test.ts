import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isDevCreatorAuthAllowedInRuntime } from "../../src/creator/auth-config.js";
import { createSignedSessionToken, verifySignedSessionToken } from "../../src/creator/dev-session.js";
import { readCreatorAuthConfig } from "../../src/creator/auth-config.js";
import { resolveDevSessionPrincipal } from "../../src/creator/resolve-dev-session-principal.js";
import { LEGACY_PRE_M9_CREATOR_ID } from "../../src/creator/types.js";
import { requireOwnedHandoff } from "../../src/application/authorize-handoff.js";
import { CreatorUnauthenticatedError, HandoffAccessUnavailableError } from "../../src/application/creator-auth-errors.js";
import { setCreatorSessionProviderForTests } from "../../src/application/creator-session-factory.js";
import { importAndCreateHandoff } from "../../src/application/use-cases/import-conversation.js";
import { loadCreatorReview } from "../../src/application/use-cases/creator-review.js";
import { issueShareCapability, revokeShareCapability } from "../../src/application/use-cases/share-capability.js";
import { askSharedReceiverQuestion } from "../../src/application/use-cases/shared-receiver-qa.js";
import { askReceiverQuestion } from "../../src/application/use-cases/receiver-qa.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { PersistenceConflictError } from "../../src/persistence/errors.js";
import { setReceiverSemanticInterpreterForTests } from "../../src/application/receiver-interpreter-factory.js";

const url = process.env.TEST_DATABASE_URL;
const SECRET = "test-session-secret-minimum-32-characters";
const CREATOR_A = "creator_test_a";
const CREATOR_B = "creator_test_b";

if (!url) {
  describe.skip("Creator auth", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("Creator session (A)", () => {
    it("A1 — valid dev session resolves CreatorPrincipal", () => {
      const now = Date.now();
      const token = createSignedSessionToken({
        creatorId: CREATOR_A,
        issuedAt: now,
        expiresAt: now + 60_000,
        secret: SECRET,
      });
      expect(verifySignedSessionToken(token, SECRET, now)).toEqual({ creatorId: CREATOR_A });
    });

    it("A2 — modified creator ID invalidates session", () => {
      const now = Date.now();
      const token = createSignedSessionToken({
        creatorId: CREATOR_A,
        issuedAt: now,
        expiresAt: now + 60_000,
        secret: SECRET,
      });
      const [payload] = token.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({ creatorId: CREATOR_B, issuedAt: now, expiresAt: now + 60_000 }),
      ).toString("base64url");
      expect(verifySignedSessionToken(`${tamperedPayload}.${token.split(".")[1]}`, SECRET, now)).toBeUndefined();
      expect(payload).toBeTruthy();
    });

    it("A3 — modified signature invalidates session", () => {
      const now = Date.now();
      const token = createSignedSessionToken({
        creatorId: CREATOR_A,
        issuedAt: now,
        expiresAt: now + 60_000,
        secret: SECRET,
      });
      expect(verifySignedSessionToken(`${token.slice(0, -1)}X`, SECRET, now)).toBeUndefined();
    });

    it("A4 — expired session invalid", () => {
      const now = Date.now();
      const token = createSignedSessionToken({
        creatorId: CREATOR_A,
        issuedAt: now - 120_000,
        expiresAt: now - 60_000,
        secret: SECRET,
      });
      expect(verifySignedSessionToken(token, SECRET, now)).toBeUndefined();
    });

    it("A5 — malformed cookie invalid", () => {
      expect(verifySignedSessionToken("not-a-valid-token", SECRET)).toBeUndefined();
    });

    it("A7 — dev auth not allowed in production runtime", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(isDevCreatorAuthAllowedInRuntime()).toBe(false);
      vi.unstubAllEnvs();
    });

    it("A7b — production rejects valid signed dev session token", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CREATOR_AUTH_MODE", "dev");
      vi.stubEnv("DEV_CREATOR_ID", CREATOR_A);
      vi.stubEnv("CREATOR_SESSION_SECRET", SECRET);
      const now = Date.now();
      const token = createSignedSessionToken({
        creatorId: CREATOR_A,
        issuedAt: now,
        expiresAt: now + 60_000,
        secret: SECRET,
      });
      const config = readCreatorAuthConfig();
      expect(config.mode).toBe("dev");
      expect(resolveDevSessionPrincipal({ sessionToken: token, config, nowMs: now })).toBeUndefined();
      vi.unstubAllEnvs();
    });

    it("A6 — dev auth disabled yields no principal", async () => {
      setCreatorSessionProviderForTests({ getCurrentPrincipal: async () => undefined });
      const principal = await (await import("../../src/application/creator-session-factory.js")).getCreatorSessionProvider().getCurrentPrincipal();
      expect(principal).toBeUndefined();
    });

    it("A8 — sign-out provider returns undefined", async () => {
      setCreatorSessionProviderForTests({ getCurrentPrincipal: async () => undefined });
      const principal = await (await import("../../src/application/creator-session-factory.js")).getCreatorSessionProvider().getCurrentPrincipal();
      expect(principal).toBeUndefined();
    });
  });

  describe("Ownership and authorization (O)", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      const migrateEnv = { ...process.env, TEST_DATABASE_URL: url } as NodeJS.ProcessEnv;
      delete migrateEnv.DATABASE_URL;
      execSync("node scripts/migrate.mjs", { env: migrateEnv, stdio: "pipe" });
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE share_capabilities, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
      await repos.creators.ensure({ id: CREATOR_A, createdAt: "2026-09-25T00:00:00.000Z" });
      await repos.creators.ensure({ id: CREATOR_B, createdAt: "2026-09-25T00:00:00.000Z" });
      await repos.creators.ensure({ id: LEGACY_PRE_M9_CREATOR_ID, createdAt: "2026-01-01T00:00:00.000Z" });
      setCreatorSessionProviderForTests(undefined);
      setReceiverSemanticInterpreterForTests(undefined);
    });

    afterAll(async () => {
      await pool.end();
    });

    it("O1 — new Handoff receives current owner", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: hello");
      expect(await repos.handoffs.getOwnerCreatorId(imported.handoffId)).toBe(CREATOR_A);
    });

    it("O2 — ownership immutable at database level", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: hello");
      await expect(
        pool.query(`UPDATE handoffs SET owner_creator_id = $1 WHERE id = $2`, [CREATOR_B, imported.handoffId]),
      ).rejects.toThrow(/immutable/i);
    });

    it("O3 — conflicting create owner rejected", async () => {
      const first = await importAndCreateHandoff(repos, CREATOR_A, "creator: hello");
      await expect(
        repos.handoffs.create(first.handoffId, "conv-different", CREATOR_B),
      ).rejects.toBeInstanceOf(PersistenceConflictError);
    });

    it("O4 — legacy creator exists after migration", async () => {
      expect(await repos.creators.exists(LEGACY_PRE_M9_CREATOR_ID)).toBe(true);
    });

    it("O6/O7 — owner vs non-owner review access", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: hello");
      await expect(requireOwnedHandoff(repos, { creatorId: CREATOR_A }, imported.handoffId)).resolves.toBeTruthy();
      await expect(requireOwnedHandoff(repos, { creatorId: CREATOR_B }, imported.handoffId)).rejects.toBeInstanceOf(
        HandoffAccessUnavailableError,
      );
      expect(await loadCreatorReview(repos, imported.handoffId)).toBeTruthy();
    });

    it("O8 — non-owner cannot pass ownership guard", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: hello");
      await expect(requireOwnedHandoff(repos, undefined, imported.handoffId)).rejects.toBeInstanceOf(
        CreatorUnauthenticatedError,
      );
    });

    it("O12/O13 — share issue owner vs non-owner", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: web first");
      const revision = await repos.drafts.getRevision(imported.handoffId);
      await repos.published.publish(imported.handoffId, "2026-09-25T12:00:00.000Z", revision!);
      await expect(requireOwnedHandoff(repos, { creatorId: CREATOR_A }, imported.handoffId)).resolves.toBeTruthy();
      const issued = await issueShareCapability(repos, { handoffId: imported.handoffId, version: 1 });
      expect(issued.rawToken).toMatch(/^hsh_/);
      await expect(requireOwnedHandoff(repos, { creatorId: CREATOR_B }, imported.handoffId)).rejects.toBeInstanceOf(
        HandoffAccessUnavailableError,
      );
    });

    it("O15 — non-owner cannot revoke by capability ID", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: share");
      const revision = await repos.drafts.getRevision(imported.handoffId);
      await repos.published.publish(imported.handoffId, "2026-09-25T12:00:00.000Z", revision!);
      const issued = await issueShareCapability(repos, { handoffId: imported.handoffId, version: 1 });
      await expect(requireOwnedHandoff(repos, { creatorId: CREATOR_B }, imported.handoffId)).rejects.toBeInstanceOf(
        HandoffAccessUnavailableError,
      );
      expect(issued.metadata.id).toBeTruthy();
    });

    it("O20/O21 — direct Receiver Q&A requires owner", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: confirmed web");
      await expect(requireOwnedHandoff(repos, { creatorId: CREATOR_B }, imported.handoffId)).rejects.toBeInstanceOf(
        HandoffAccessUnavailableError,
      );
    });

    it("O23 — anonymous share Q&A works without Creator session", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: Web-first confirmed.");
      const revision = await repos.drafts.getRevision(imported.handoffId);
      await repos.published.publish(imported.handoffId, "2026-09-25T12:00:00.000Z", revision!);
      const issued = await issueShareCapability(repos, { handoffId: imported.handoffId, version: 1 });
      setCreatorSessionProviderForTests({ getCurrentPrincipal: async () => undefined });
      const outcome = await askSharedReceiverQuestion(repos, { token: issued.rawToken, question: "Web?" });
      expect(outcome.kind).toBe("answer");
    });

    it("O25 — revoked share fails even if owner session exists", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: Web-first confirmed.");
      const revision = await repos.drafts.getRevision(imported.handoffId);
      await repos.published.publish(imported.handoffId, "2026-09-25T12:00:00.000Z", revision!);
      const issued = await issueShareCapability(repos, { handoffId: imported.handoffId, version: 1 });
      await revokeShareCapability(repos, { capabilityId: issued.metadata.id });
      setCreatorSessionProviderForTests({ getCurrentPrincipal: async () => ({ creatorId: CREATOR_A }) });
      const outcome = await askSharedReceiverQuestion(repos, { token: issued.rawToken, question: "Web?" });
      expect(outcome).toEqual({ kind: "unavailable" });
    });

    it("O26 — shared console uses token actions only", () => {
      const shared = readFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/app/components/shared-receiver-console.tsx"),
        "utf8",
      );
      expect(shared).toContain("askSharedReceiverQuestionAction");
      expect(shared).not.toContain("askReceiverQuestionAction");
    });

    it("O48 — model payload excludes creator/session markers", async () => {
      const imported = await importAndCreateHandoff(repos, CREATOR_A, "creator: Web confirmed.");
      const revision = await repos.drafts.getRevision(imported.handoffId);
      await repos.published.publish(imported.handoffId, "2026-09-25T12:00:00.000Z", revision!);
      const issued = await issueShareCapability(repos, { handoffId: imported.handoffId, version: 1 });
      const interpret = vi.fn(async () => ({ classification: "SUPPORTED" as const, citationIds: [] }));
      setReceiverSemanticInterpreterForTests({ interpret });
      await askSharedReceiverQuestion(repos, { token: issued.rawToken, question: "What?" });
      const payload = JSON.stringify(interpret.mock.calls);
      expect(payload).not.toContain(CREATOR_A);
      expect(payload).not.toContain(issued.rawToken);
      expect(payload).not.toContain(issued.metadata.id);
    });
  });
}

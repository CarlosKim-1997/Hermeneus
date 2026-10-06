import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyVerifiedExternalAccountToToken } from "../../src/application/external-auth-callback.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  describe.skip("Auth.js callback mapping", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("Auth.js callback mapping", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      process.env.DATABASE_URL = url;
      execSync("node scripts/migrate.mjs", { env: { ...process.env, TEST_DATABASE_URL: url }, stdio: "pipe" });
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE creator_external_identities, share_capabilities, published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
    });

    afterAll(async () => {
      await pool.end();
    });

    it("maps verified google account to internal CreatorId on token", async () => {
      const token = await applyVerifiedExternalAccountToToken(
        {},
        { provider: "google", providerAccountId: "google-subject-callback" },
      );
      expect(token.creatorId).toMatch(/^creator_/);
      expect(await repos.externalIdentities.resolve("google", "google-subject-callback")).toBe(token.creatorId);
    });

    it("reuses mapping on subsequent callback invocations", async () => {
      const first = await applyVerifiedExternalAccountToToken({}, { provider: "google", providerAccountId: "reuse-subject" });
      const second = await applyVerifiedExternalAccountToToken({}, { provider: "google", providerAccountId: "reuse-subject" });
      expect(second.creatorId).toBe(first.creatorId);
    });
  });
}

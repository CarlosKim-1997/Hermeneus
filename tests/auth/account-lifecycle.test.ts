import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readCreatorAuthConfig } from "../../src/creator/auth-config.js";
import { createSignedSessionToken } from "../../src/creator/dev-session.js";
import { resolveDevSessionCredential } from "../../src/creator/resolve-dev-session-principal.js";
import { resolveCreatorPrincipalWithLifecycle } from "../../src/application/creator-lifecycle-session.js";
import { requireActiveCreatorPrincipal } from "../../src/application/creator-action-auth.js";
import { setCreatorSessionProviderForTests } from "../../src/application/creator-session-factory.js";
import { CreatorLifecycleBlockedError } from "../../src/application/creator-auth-errors.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;
const CREATOR = "creator_lifecycle_auth";

if (!url) {
  describe.skip("Account lifecycle auth", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("Account lifecycle auth", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);
    const SECRET = "test-session-secret-minimum-32-characters";

    beforeAll(() => {
      const migrateEnv = { ...process.env, TEST_DATABASE_URL: url } as NodeJS.ProcessEnv;
      delete migrateEnv.DATABASE_URL;
      execSync("node scripts/migrate.mjs", { env: migrateEnv, stdio: "pipe" });
    });

    beforeEach(async () => {
      await pool.query("TRUNCATE creators RESTART IDENTITY CASCADE");
      await repos.creators.ensure({ id: CREATOR, createdAt: "2026-09-25T00:00:00.000Z" });
    });

    afterAll(async () => {
      await pool.end();
    });

    it("dev cookie + active Creator resolves principal", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("CREATOR_AUTH_MODE", "dev");
      vi.stubEnv("DEV_CREATOR_ID", CREATOR);
      vi.stubEnv("CREATOR_SESSION_SECRET", SECRET);
      const now = Date.now();
      const token = createSignedSessionToken({
        creatorId: CREATOR,
        issuedAt: now,
        expiresAt: now + 60_000,
        secret: SECRET,
      });
      const credential = resolveDevSessionCredential({
        sessionToken: token,
        config: readCreatorAuthConfig(),
        nowMs: now,
      });
      expect(credential?.creatorId).toBe(CREATOR);
      const principal = await resolveCreatorPrincipalWithLifecycle(repos, CREATOR);
      expect(principal?.lifecycleStatus).toBe("active");
      vi.unstubAllEnvs();
    });

    it("erasing Creator + valid cookie resolves but ordinary auth rejects", async () => {
      await pool.query(`UPDATE creators SET lifecycle_status = 'erasing' WHERE id = $1`, [CREATOR]);
      setCreatorSessionProviderForTests({
        getCurrentPrincipal: async () => ({ creatorId: CREATOR, lifecycleStatus: "erasing" }),
      });
      await expect(requireActiveCreatorPrincipal()).rejects.toBeInstanceOf(CreatorLifecycleBlockedError);
    });

    it("deleted Creator + stale cookie yields no principal", async () => {
      await pool.query(`DELETE FROM creators WHERE id = $1`, [CREATOR]);
      const principal = await resolveCreatorPrincipalWithLifecycle(repos, CREATOR);
      expect(principal).toBeUndefined();
    });
  });
}

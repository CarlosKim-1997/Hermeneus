import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteAccountAction } from "../../src/application/account-actions.js";
import { setCreatorSessionProviderForTests } from "../../src/application/creator-session-factory.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";
import type { PoolClient } from "pg";

const url = process.env.TEST_DATABASE_URL;
const CREATOR = "creator_recovery_action";

async function installPhase2FailureTrigger(client: PoolClient, creatorId: string) {
  await client.query(`
    CREATE OR REPLACE FUNCTION test_fail_account_phase2_action()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.id = '${creatorId}' THEN
        RAISE EXCEPTION 'test injected account phase2 failure';
      END IF;
      RETURN OLD;
    END;
    $$;
  `);
  await client.query(`DROP TRIGGER IF EXISTS test_fail_account_phase2_action_trg ON creators`);
  await client.query(`
    CREATE TRIGGER test_fail_account_phase2_action_trg
      BEFORE DELETE ON creators
      FOR EACH ROW
      EXECUTE FUNCTION test_fail_account_phase2_action();
  `);
}

async function dropPhase2FailureTrigger(client: PoolClient) {
  await client.query(`DROP TRIGGER IF EXISTS test_fail_account_phase2_action_trg ON creators`);
  await client.query(`DROP FUNCTION IF EXISTS test_fail_account_phase2_action()`);
}

if (!url) {
  describe.skip("Account erasure recovery action", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("Account erasure recovery action", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      process.env.DATABASE_URL = url;
      const migrateEnv = { ...process.env, TEST_DATABASE_URL: url } as NodeJS.ProcessEnv;
      delete migrateEnv.DATABASE_URL;
      execSync("node scripts/migrate.mjs", { env: migrateEnv, stdio: "pipe" });
    });

    beforeEach(async () => {
      await pool.query("TRUNCATE creators RESTART IDENTITY CASCADE");
      await repos.creators.ensure({ id: CREATOR, createdAt: "2026-09-25T00:00:00.000Z" });
      setCreatorSessionProviderForTests({
        getCurrentPrincipal: async () => ({ creatorId: CREATOR, lifecycleStatus: "active" as const }),
      });
    });

    afterAll(async () => {
      setCreatorSessionProviderForTests(undefined);
      await pool.end();
    });

    it("returns ERASURE_INCOMPLETE when Phase 2 fails after Phase 1 commits", async () => {
      const setup = await pool.connect();
      try {
        await installPhase2FailureTrigger(setup, CREATOR);
      } finally {
        setup.release();
      }

      const result = await deleteAccountAction("DELETE");
      expect(result).toEqual({
        ok: false,
        error: {
          code: "ERASURE_INCOMPLETE",
          message: expect.stringContaining("did not finish"),
        },
      });
      expect(await repos.creators.getLifecycleStatus(CREATOR)).toBe("erasing");

      const cleanup = await pool.connect();
      try {
        await dropPhase2FailureTrigger(cleanup);
      } finally {
        cleanup.release();
      }
    });
  });
}

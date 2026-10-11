import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool } from "../../src/persistence/postgres/pool.js";
import { PilotBudgetExhaustedError, reserveVerifierPilotBudget } from "../../src/receiver/external/pilot-budget.js";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  describe.skip("external verifier pilot budget", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("external verifier pilot budget", () => {
    const pool = createPool(url);
    beforeAll(() => {
      const env: NodeJS.ProcessEnv = { ...process.env, TEST_DATABASE_URL: url };
      delete env.DATABASE_URL;
      execSync("node scripts/migrate.mjs", { env, stdio: "pipe" });
    });
    beforeEach(async () => { await pool.query("TRUNCATE verifier_pilot_budget"); });
    afterAll(async () => { await pool.end(); });

    it("atomically stops concurrent calls at the day ceiling", async () => {
      await pool.query("INSERT INTO verifier_pilot_budget VALUES ('day', '2026-10-11', 495)");
      const results = await Promise.allSettled([
        reserveVerifierPilotBudget(pool, new Date("2026-10-11T00:00:00Z")),
        reserveVerifierPilotBudget(pool, new Date("2026-10-11T00:00:00Z")),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason)
        .toBeInstanceOf(PilotBudgetExhaustedError);
      const rows = await pool.query("SELECT period_kind, reserved_cents FROM verifier_pilot_budget ORDER BY period_kind");
      expect(rows.rows).toEqual([{ period_kind: "day", reserved_cents: 500 }, { period_kind: "month", reserved_cents: 5 }]);
    });

    it("rolls back the daily reservation when the monthly ceiling is reached", async () => {
      await pool.query("INSERT INTO verifier_pilot_budget VALUES ('month', '2026-10-01', 2500)");
      await expect(reserveVerifierPilotBudget(pool, new Date("2026-10-11T00:00:00Z")))
        .rejects.toBeInstanceOf(PilotBudgetExhaustedError);
      const rows = await pool.query("SELECT period_kind, reserved_cents FROM verifier_pilot_budget");
      expect(rows.rows).toEqual([{ period_kind: "month", reserved_cents: 2500 }]);
    });
  });
}

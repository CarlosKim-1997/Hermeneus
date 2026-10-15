import type pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PilotBudgetExhaustedError, reserveVerifierPilotBudget } from "../src/receiver/external/pilot-budget.js";

afterEach(() => vi.unstubAllEnvs());

describe("bounded Alpha smoke budget", () => {
  it("passes the reduced monthly limit into the atomic reservation", async () => {
    vi.stubEnv("HERMENEUS_VERIFIER_SMOKE_MONTH", "2026-10");
    vi.stubEnv("HERMENEUS_VERIFIER_SMOKE_LIMIT_CENTS", "25");
    const query = vi.fn(async () => ({ rowCount: 1 }));
    const release = vi.fn();
    const pool = { connect: async () => ({ query, release }) } as unknown as pg.Pool;
    await reserveVerifierPilotBudget(pool, new Date("2026-10-15T00:00:00Z"));
    expect(query.mock.calls[1]).toEqual([expect.stringContaining("WHERE verifier_pilot_budget.reserved_cents"), ["month", "2026-10-01", 5, 25]]);
    expect(query.mock.calls[2]).toEqual([expect.any(String), ["day", "2026-10-15", 5, 500]]);
    expect(query.mock.calls[3]).toEqual(["COMMIT"]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("denies expired, partial, invalid or widening settings before DB access", async () => {
    for (const [month, limit] of [["2026-09", "25"], ["2026-10", undefined], [undefined, "25"],
      ["2026-10", ""], ["2026-10", "0"], ["2026-10", "4"], ["2026-10", "2501"],
      ["2026-10", "25.5"], ["2026-10", "NaN"]]) {
      vi.stubEnv("HERMENEUS_VERIFIER_SMOKE_MONTH", month);
      vi.stubEnv("HERMENEUS_VERIFIER_SMOKE_LIMIT_CENTS", limit);
      const connect = vi.fn();
      await expect(reserveVerifierPilotBudget({ connect } as unknown as pg.Pool, new Date("2026-10-15T00:00:00Z")))
        .rejects.toBeInstanceOf(PilotBudgetExhaustedError);
      expect(connect).not.toHaveBeenCalled();
    }
  });
});

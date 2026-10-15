import type pg from "pg";

export const PILOT_RESERVATION_CENTS = 5;
export const PILOT_DAILY_LIMIT_CENTS = 500;
export const PILOT_MONTHLY_LIMIT_CENTS = 2500;

export class PilotBudgetExhaustedError extends Error {
  constructor() {
    super("External verification pilot budget reached.");
    this.name = "PilotBudgetExhaustedError";
  }
}

/** Reserve the worst-case pilot allowance before a provider request. Failed requests keep their reservation. */
export async function reserveVerifierPilotBudget(pool: pg.Pool, now = new Date()): Promise<void> {
  const date = now.toISOString().slice(0, 10);
  const month = `${date.slice(0, 7)}-01`;
  const smokeMonth = process.env.HERMENEUS_VERIFIER_SMOKE_MONTH;
  const smokeLimit = process.env.HERMENEUS_VERIFIER_SMOKE_LIMIT_CENTS;
  let monthlyLimit = PILOT_MONTHLY_LIMIT_CENTS;
  if (smokeMonth !== undefined || smokeLimit !== undefined) {
    // Both values are server-only. A smoke campaign cannot reset in another month,
    // or silently widen its allowance when configuration is partial or malformed.
    if (smokeMonth !== date.slice(0, 7) || !/^[1-9]\d*$/.test(smokeLimit ?? "")) {
      throw new PilotBudgetExhaustedError();
    }
    monthlyLimit = Number(smokeLimit);
    if (!Number.isSafeInteger(monthlyLimit) || monthlyLimit < PILOT_RESERVATION_CENTS ||
        monthlyLimit > PILOT_MONTHLY_LIMIT_CENTS) throw new PilotBudgetExhaustedError();
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [kind, start, limit] of [
      ["month", month, monthlyLimit],
      ["day", date, PILOT_DAILY_LIMIT_CENTS],
    ] as const) {
      const result = await client.query(
        `INSERT INTO verifier_pilot_budget (period_kind, period_start, reserved_cents)
         VALUES ($1, $2::date, $3)
         ON CONFLICT (period_kind, period_start) DO UPDATE
           SET reserved_cents = verifier_pilot_budget.reserved_cents + EXCLUDED.reserved_cents
         WHERE verifier_pilot_budget.reserved_cents + EXCLUDED.reserved_cents <= $4
         RETURNING reserved_cents`,
        [kind, start, PILOT_RESERVATION_CENTS, limit],
      );
      if (result.rowCount !== 1) throw new PilotBudgetExhaustedError();
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

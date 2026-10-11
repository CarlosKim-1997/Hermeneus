-- Monetary reservation counters only. No Receiver content or consent record is stored.
CREATE TABLE verifier_pilot_budget (
  period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'month')),
  period_start DATE NOT NULL,
  reserved_cents INTEGER NOT NULL DEFAULT 0 CHECK (reserved_cents >= 0),
  PRIMARY KEY (period_kind, period_start)
);

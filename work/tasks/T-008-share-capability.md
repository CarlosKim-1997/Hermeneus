---
schema: task/v1
id: T-008
status: VERIFYING
areas:
  - handoff
depends_on:
  - T-007
implements:
  - D-005
  - C-005
related_to:
  - D-003
  - D-004
  - C-001
---
# Version-pinned share capability (Milestone 8)

## Objective

Introduce revocable, version-pinned Receiver share capabilities without weakening existing Receiver or Published Handoff authority boundaries.

## Scope

In scope: migration 002, token issuance/hashing, share repository, `/share/[token]`, token-gated Q&A/provenance, Creator share controls, S1–S15 + E2E.

Out of scope: Creator auth, expiry, email delivery, Receiver memory, production security claims.

## Authority

Authorized on `cursor/share-capability-m8-6f39`. Not authorized to merge or modify D-001–D-004 / C-001–C-004.

## Constraints

C-001–C-005 remain binding. M6/M7 pipeline unchanged after capability resolution.

## Verification

Observed 2026-09-26:

- `node tooling/governance/check.mjs` — PASS
- `npm run test:share` — 17 passed (S1–S15, S32, S33)
- Full regression: unit 31, application 25, receiver 11, receiver-semantic 10, receiver-answer 22, integration 29, extraction 15, typecheck, migrate, build, e2e 4 (includes share-flow) — PASS

Live M6/M7 suites not re-run (share layer only; model payload unchanged).

## Stop Conditions

Stop if shared surface exposes handoffId or raw tokens persist in PostgreSQL.

## Completion Criteria

Creator can issue/revoke version-pinned share links; Receivers authorize per request; revocation blocks subsequent operations; model payloads exclude share secrets.

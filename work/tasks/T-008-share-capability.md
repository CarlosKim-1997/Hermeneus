---
schema: task/v1
id: T-008
status: COMPLETE
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

Observed 2026-09-26 (including final review correction on PR #8):

- Shared provenance projection excludes `messageId`; known `sourceConversationId` leakage fixture (strengthened S13) passes.
- C-005 reconciled: application-controlled logging boundary enforced; infrastructure/access-log redaction remains deferred (not a production security claim).
- `node tooling/governance/check.mjs` — PASS
- `npm run test:share` — 17 PASS
- Full deterministic regression — PASS: `npm test` 31; `test:application` 25; `test:receiver` 11; `test:receiver-semantic` 10; `test:receiver-answer` 22; `test:integration` 29; `test:extraction` 15; typecheck; migrate; build; `test:e2e` 4 (includes share-flow)

Live M6/M7 suites were not rerun because model-facing runtime code was unchanged.

## Stop Conditions

Stop if shared surface exposes handoffId or raw tokens persist in PostgreSQL.

## Completion Criteria

Creator can issue/revoke version-pinned share links; Receivers authorize per request; revocation blocks subsequent operations; model payloads exclude share secrets.

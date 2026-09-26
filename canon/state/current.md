---
schema: state/v1
status: READY
areas:
  - global
---
# Current Project State

## Current Position

Milestones 1–8 are merged into `main` (baseline `ccb6810`). Version-pinned, revocable share capabilities gate `/share/[token]` with per-request authorization into the M5–M7 Receiver pipeline. Shared provenance omits internal conversation and message identifiers.

## Active Work

None. T-008 is COMPLETE.

## Blockers

None.

## Material Risks

- No Creator authentication or ownership enforcement yet.
- Direct Creator routes and internal `/receiver/[handoffId]/[version]` remain unauthenticated until a later milestone adds route authorization.
- Share bearer secrets appear in share URLs (`/share/[token]`).
- Hermeneus application code deliberately avoids logging raw share tokens; persisted metadata stores hash only.
- Production infrastructure or access-log redaction for share URLs has not yet been verified.
- This milestone is not production-safe public sharing.

## Verification Basis

On 2026-09-26: governance PASS; typecheck PASS; migrate PASS; build PASS. Deterministic counts: `test:share` 17; `npm test` 31; application 25; receiver 11; receiver-semantic 10; receiver-answer 22; integration 29; extraction 15; e2e 4. Shared provenance projection omits `messageId`, `sourceConversationId`, and `handoffId`; strengthened S13 passes. C-005 reflects application-controlled vs deferred infrastructure logging boundaries.

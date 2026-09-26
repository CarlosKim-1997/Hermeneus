---
schema: state/v1
status: VERIFYING
areas:
  - global
---
# Current Project State

## Current Position

Milestones 1–7 are merged into `main` (baseline `0c3ca45`). Milestone 8 version-pinned share capabilities are implemented on PR branch `cursor/share-capability-m8-6f39`: revocable bearer tokens gate `/share/[token]` with per-request authorization into the existing M5–M7 Receiver pipeline. **PR remains unmerged.**

## Active Work

T-008: shared provenance data minimization and C-005 logging-boundary reconciliation on PR #8.

## Blockers

None.

## Material Risks

Share links are high-entropy bearer secrets without Creator authentication in M8. This milestone is not production-safe public sharing. Share tokens are bearer secrets embedded in share URLs. Hermeneus application code does not deliberately log them, but production infrastructure or access-log redaction has not yet been verified. Direct `/receiver/[handoffId]/[version]` and Creator routes remain unauthenticated until a later milestone adds ownership and route authorization.

## Verification Basis

On 2026-09-26: governance PASS; `test:share` 17; full deterministic regression and E2E share-flow PASS. Share tokens are hashed at rest; shared surfaces omit internal handoff IDs.

---
schema: state/v1
status: READY
areas:
  - global
---
# Current Project State

## Current Position

Milestones 1–5 are merged into `main`. Milestone 6 implementation is complete on PR #6 (`cursor/receiver-semantic-m6-6f39`): live semantic selection uses pinned canonical Handoff items only; final answer prose remains Hermeneus-rendered; hybrid product-path live smoke and Q1–Q10 eval passed. **PR #6 remains unmerged.**

## Active Work

None. T-006 is COMPLETE pending PR #6 merge review.

## Blockers

None.

## Material Risks

Live Receiver sends pinned canonical items and Receiver questions to configured external models only when `RECEIVER_INTERPRETER=openai` (`store: false`). Application remains local/development-only without authentication.

## Verification Basis

On 2026-09-26: `node tooling/governance/check.mjs` PASS; unit 14; application 25; receiver 11; receiver-semantic 10 (RO1–RO10); integration 29; extraction 15; typecheck/build PASS; E2E 3. Live Receiver smoke PASS (`interpretReceiverQuestion`, semantic mode). Hybrid Q1–Q10 live eval PASS; unexpectedFallbacks 0 on the current 10-case fixture set.

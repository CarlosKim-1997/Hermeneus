---
schema: state/v1
status: READY
areas:
  - global
---
# Current Project State

## Current Position

Milestones 1–7 are merged into `main` (baseline `c166355`). M6 selects canonical evidence; optional M7 generator + grounding verifier produces natural prose for SUPPORTED only (`RECEIVER_ANSWER_MODE=openai-grounded`, default deterministic).

## Active Work

None. T-007 is COMPLETE.

## Blockers

None.

## Material Risks

Live answer generation uses pinned canonical items only (`store: false`) when `RECEIVER_ANSWER_MODE=openai-grounded`. Application remains local/development-only.

## Verification Basis

On 2026-09-26: unit 14; application 25; receiver 11; receiver-semantic 10; receiver-answer 22; integration 29; extraction 15; E2E 3; governance/typecheck/build PASS. Grounding verification enforces one-to-one sentence indices and verifier citations ⊆ generator-declared citations. Live M7 smoke/eval re-run after verifier prompt clarification; unsupported claims displayed 0.

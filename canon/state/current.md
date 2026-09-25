---
schema: state/v1
status: IN_PROGRESS
areas:
  - global
---
# Current Project State

## Current Position

Milestones 1–3 are merged into `main`. Milestone 4 (PR #4) implements live Handoff extraction on `cursor/live-handoff-extraction-e41b` with OpenAI SDK v7, refusal handling, deterministic validation (E1–E10, O1–O4), and opt-in live semantic eval (L1–L6). Deterministic verification passes; **live OpenAI smoke and semantic evaluation are pending** in environments without configured credentials.

## Active Work

T-004 implementation complete; live-provider verification pending human/local run of `npm run test:live-extraction` and `npm run test:live-extraction-eval`.

## Blockers

None for merge review of deterministic behavior. Live-model verification blocked only by missing `OPENAI_API_KEY` / `OPENAI_MODEL` in this environment.

## Material Risks

Live extraction sends persisted source conversations to configured external model providers on explicit Creator action only (`store: false`). The application remains local/development-only without production privacy controls.

## Verification Basis

Deterministic (2026-09-25): governance checker, 14 unit, 14 application, 29 integration, 14 extraction (10 validation + 4 adapter), typecheck, migrate, build, 2 Playwright flows. Live OpenAI commands skipped here — not claimed as verified.

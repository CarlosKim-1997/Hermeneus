---
schema: state/v1
status: READY
areas:
  - global
---
# Current Project State

## Current Position

Milestones 1–3 are merged into `main`. Milestone 4 live Handoff extraction is implemented on `cursor/live-handoff-extraction-e41b` (PR pending): explicit **Generate AI suggestions**, validated non-authoritative proposals, Creator accept/edit/save, and unchanged publication with expected draft revision. OpenAI is the first extraction-model adapter; source import provider remains separate. Receiver AI is not productized.

## Active Work

None. T-004 complete pending PR merge review.

## Blockers

None.

## Material Risks

Live extraction sends persisted source conversations to configured external model providers on explicit Creator action only (`store: false`). The application remains local/development-only without production privacy controls.

## Verification Basis

On 2026-09-25, local verification passed: governance checker, 14 unit tests, 14 application tests, 29 integration tests, 10 extraction eval tests, typecheck, migrate, build, 2 Playwright flows (fixture-backed extraction UI). Live OpenAI smoke test was skipped in this environment because `OPENAI_API_KEY` / `OPENAI_MODEL` were not configured.

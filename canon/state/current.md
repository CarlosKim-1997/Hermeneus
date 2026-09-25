---
schema: state/v1
status: READY
areas:
  - global
---
# Current Project State

## Current Position

Repository Governance 1.0.0 is adopted. D-001 through D-004 and C-001 through C-004 record the product direction and persistence boundaries the human owner ratified on 2026-09-25.

Milestone 1 is merged into `main`. Milestone 2 is complete on PR #2 (`cursor/postgres-persistence-e41b`) but not yet merged into `main`. PostgreSQL persistence covers normalized conversations, drafts, and immutable published Handoff versions. The deterministic receiver and epistemic fixtures remain. There is no production UI and no live-model integration.

## Active Work

No task is in progress. T-002 is complete.

## Blockers

None.

## Material Risks

`CarlosKim-1997/repository-governance` was not readable here (GitHub 404). The installed protocol is the Governance 1.0.0 snapshot vendored in CarlosLab at `d9d325857fdb61fd5979fc925514aebbc0c61df2`. See `work/reports/governance-adoption-v1.md`.

Privacy controls listed in the README are not implemented.

## Verification Basis

On 2026-09-25, local verification passed: `node tooling/governance/check.mjs`, `npm test` (14), `npm run typecheck`, `npm run migrate`, and `npm run test:integration` (27) against PostgreSQL 16. No hosted CI PostgreSQL run is claimed. Unit tests do not call a live model.

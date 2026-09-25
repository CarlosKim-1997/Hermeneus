---
schema: state/v1
status: IN_PROGRESS
areas:
  - global
---
# Current Project State

## Current Position

Repository Governance 1.0.0 is adopted. D-001 through D-004 and C-001 through C-003 record the product direction the human owner ratified on 2026-09-25.

Milestone 1 is merged into `main`. Milestone 2 adds PostgreSQL persistence for normalized conversations, drafts, and immutable published Handoff versions on `cursor/postgres-persistence-e41b`. The deterministic receiver and epistemic fixtures remain. There is no production UI and no live-model integration.

## Active Work

T-002 pre-merge integrity correction is in progress on PR #2.

## Blockers

None.

## Material Risks

`CarlosKim-1997/repository-governance` was not readable here (GitHub 404). The installed protocol is the Governance 1.0.0 snapshot vendored in CarlosLab at `d9d325857fdb61fd5979fc925514aebbc0c61df2`. See `work/reports/governance-adoption-v1.md`.

Privacy controls listed in the README are not implemented.

## Verification Basis

On 2026-09-25, `node tooling/governance/check.mjs`, `npm test`, `npm run typecheck`, `npm run migrate`, and `npm run test:integration` passed against local PostgreSQL 16. Unit tests do not call a live model.

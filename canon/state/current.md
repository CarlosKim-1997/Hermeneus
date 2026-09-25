---
schema: state/v1
status: READY
areas:
  - global
---
# Current Project State

## Current Position

Repository Governance 1.0.0 is adopted. D-001 through D-004 and C-001 through C-003 record the product direction the human owner ratified on 2026-09-25.

Milestone 1 is implemented on `cursor/hermeneus-milestone-1-e41b`: generic text import, draft publication, and a deterministic receiver. There is no production UI and no live-model integration.

## Active Work

No task is in progress. T-001 is complete.

## Blockers

None.

## Material Risks

`CarlosKim-1997/repository-governance` was not readable here (GitHub 404). The installed protocol is the Governance 1.0.0 snapshot vendored in CarlosLab at `d9d325857fdb61fd5979fc925514aebbc0c61df2`. See `work/reports/governance-adoption-v1.md`.

Privacy controls listed in the README are not implemented.

## Verification Basis

`node tooling/governance/check.mjs`, `npm test`, and `npm run typecheck` passed on 2026-09-25 for the milestone 1 tree. The test suite does not call a live model.

---
schema: task/v1
id: T-014
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-013
related_to:
  - D-009
  - D-010
  - C-008
  - C-009
  - C-010
---
# M12 Layered Erasure normative canonicalization

## Objective

Canonicalize the human-ratified M12 Creator Data Lifecycle / Layered Erasure authority without implementing product behavior.

## Scope

In scope:

- supersede D-003 with D-009
- supersede D-007 with D-010
- supersede C-001 with C-008
- supersede C-007 with C-010
- create C-009
- update Current State narrowly to reflect policy-defined / implementation-not-yet-started status
- structural verification
- commit, push, open draft PR

Out of scope:

- `src/**`
- `migrations/**`
- tests for runtime erasure behavior
- DB schema implementation
- API/UI implementation
- destructive data mutation
- actual account/Handoff/source deletion
- production/external mutation
- changes to D-006, D-008, C-005, C-006
- Governance Core changes
- merge
- post-merge reconciliation

## Authority

Authorized on `cursor/m12-layered-erasure-canon-t014` for this execution episode:

- inspect repository authority
- create T-014
- canonicalize exactly the human-ratified D-009/D-010/C-008/C-009/C-010 package
- change D-003, D-007, C-001, C-007 lifecycle status to SUPERSEDED
- make the narrow authorized Current State update
- commit, push, open a draft PR

Not authorized to merge, implement M12, mutate runtime or database behavior, perform destructive Git, mutate production or external systems, create additional normative policy, or alter unrelated Canon.

## Constraints

The complete M12 Layered Erasure package was explicitly human-ratified in the task prompt before this canonicalization. The agent did not infer or expand policy.

## Verification

- D-003 → SUPERSEDED by D-009 (bodies preserved)
- D-007 → SUPERSEDED by D-010 (bodies preserved)
- C-001 → SUPERSEDED by C-008 (bodies preserved)
- C-007 → SUPERSEDED by C-010 (bodies preserved)
- C-009 created ACTIVE
- D-009, D-010, C-008, C-010 created ACTIVE with ratified semantics
- Current State narrowed to policy-defined / implementation-pending truth
- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — clean
- Runtime/product, migrations, tests, Governance Core unchanged; D-008 byte-unchanged

## Stop Conditions

Stop if baseline SHA differs materially, checker fails with no authorized repair, diff exceeds scope, or D-008 structural conflict requires unapproved relation cleanup.

## Completion Criteria

Ratified package canonicalized; structural checker PASS; draft PR opened unmerged; no implementation performed.

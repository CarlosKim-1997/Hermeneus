---
schema: task/v1
id: T-015
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-014
related_to:
  - D-009
  - D-010
  - C-008
  - C-009
  - C-010
  - D-008
  - C-005
  - C-006
---
# M12 Implementation Architecture & Threat Model

## Objective

Produce a non-normative engineering architecture and threat-model report for M12 Layered Erasure implementation, grounded in observed repository/runtime reality, without changing product behavior.

## Scope

In scope:

- inspect `src/**`, `migrations/**`, and tests as needed for factual recovery
- write `work/reports/m12-implementation-architecture-and-threat-model.md`
- structural verification of Governance/Work artifacts only

Out of scope:

- `src/**`, `migrations/**`, tests, package manifests
- erasure implementation, DB mutation, external mutation
- new normative Canon (Decisions/Constraints)
- Current State update (design awaiting human review of report)
- merge
- T-016+ execution

## Authority

Authorized on `cursor/m12-implementation-architecture-t015` for this execution episode:

- inspect repository authority and implementation surfaces
- create T-015 and the engineering report
- commit, push, open a draft PR

Not authorized to merge, implement M12, mutate runtime/database/production, ratify new product policy, alter unrelated Canon, or perform destructive Git.

## Constraints

Canon authority remains D-009/D-010/C-008/C-009/C-010. Unresolved product choices must appear as Human Decision Required in the report, not agent-inferred policy.

## Verification

- `work/reports/m12-implementation-architecture-and-threat-model.md` documents recovered implementation reality and evaluates the target storage/erasure architecture
- Threat model and test matrix defined; implementation slices T-016–T-018 proposed
- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — clean
- Diff limited to T-015 and the report; `canon/state/current.md` unchanged

## Stop Conditions

Stop if baseline SHA differs materially, or design work would require normative Canon change or runtime edits.

## Completion Criteria

Report and T-015 complete; checker PASS; draft PR opened unmerged; no implementation started.

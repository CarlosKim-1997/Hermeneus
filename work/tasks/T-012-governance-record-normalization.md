---
schema: task/v1
id: T-012
status: COMPLETE
areas:
  - global
related_to:
  - T-011
---
# Governance record normalization

## Objective

Repair mechanically recoverable, historically evidenced, non-normative drift in Hermeneus Governance, Canon, and Work records after Milestone 11 integration—without changing product/runtime behavior or creating new normative authority.

## Scope

In scope:

- read-only audit findings capture (`work/reports/governance-health-audit-2026-09-28.md`)
- restore historical Task Authority for T-007 through T-010 from pre-merge execution authorization
- preserve T-011 Authority unchanged
- rebuild `canon/state/current.md` as current-position compression
- semantic post-repair review of COMPLETE/CANCELLED Task Authority sections
- governance structural verification

Out of scope:

- product/runtime code, migrations, package manifests
- new Decisions or Constraints
- mechanical edit of D-005 or D-006 temporal language
- Repository Governance Core changes
- Milestone 12
- merge

## Authority

Authorized on `cursor/governance-normalization-t012-4b16` for this execution episode:

- inspect the repository
- edit Governance/Canon/Work normalization artifacts only (Tasks T-007–T-010 Authority, T-012, Current State, audit report)
- commit, push, and open a draft PR

Not authorized to merge, change product/runtime behavior, ratify or supersede Decisions/Constraints, modify reusable Governance Core files, perform destructive Git operations, or mutate production or external systems.

## Constraints

Repository Governance v1 semantics unchanged. Humans hold normative authority. Checker PASS proves structure only.

## Verification

Baseline verified: `main` and `origin/main` at `ee0b366218051eb938acbd4d280713fc3a04cbdb`, clean worktree.

Repairs applied:

- T-007–T-010 `## Authority` restored to pre-merge branch authorization text; Verification sections preserved
- T-011 Authority unchanged (historically correct)
- `canon/state/current.md` compressed; stale M11 “pending merge” removed
- Audit report recorded; D-005 flagged REVIEW only (not edited)

Checks:

- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — clean
- `src/**`, `migrations/**`, and package manifests unchanged in diff

Upstream comparison: vendored Core matches `CarlosKim-1997/repository-governance` template at `fdcdea87ce7fb8ff60821356706b1148ea00d056` (byte-identical for AGENTS.md, SPEC.md, schemas, checker, version.json).

## Stop Conditions

Stop if baseline SHA differs materially, runtime/product files would change, or a repair requires normative human decision without unambiguous historical evidence.

## Completion Criteria

Normalization artifacts committed; structural checker PASS; audit report published; draft PR opened unmerged; no new normative Canon.

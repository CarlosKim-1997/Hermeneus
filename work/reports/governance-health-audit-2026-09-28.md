# Governance health audit — 2026-09-28

**Normative authority:** none. This report is documentary findings from a read-only audit and subsequent authorized normalization (T-012). It does not ratify, supersede, or amend Canon.

## Audited baseline

| Item | Value |
|------|--------|
| Hermeneus repository | CarlosKim-1997/Hermeneus |
| Baseline branch | `main` |
| Baseline SHA | `ee0b366218051eb938acbd4d280713fc3a04cbdb` (M11 integration merge) |
| Audit date | 2026-09-28 |

## Upstream comparison basis

| Item | Value |
|------|--------|
| Upstream | `CarlosKim-1997/repository-governance` @ `fdcdea87ce7fb8ff60821356706b1148ea00d056` |
| Compared paths | `template/` tree: `AGENTS.md`, `governance/SPEC.md`, `governance/README.md`, `governance/schemas/*`, `tooling/governance/check.mjs`, `tooling/governance/version.json` |
| Result | **Exact match** (byte-identical) |

Installed Governance version: **1.0.0** (`tooling/governance/version.json`).

## Findings summary

| Finding | Classification | Action |
|---------|----------------|--------|
| Current State stale merge truth (M11 “pending human PR merge” while M11 already on `main`) | **FIXED** | Rewrote `canon/state/current.md` |
| Current State overload (PR chronology, branch names, long test ledger) | **FIXED** | Compressed to current-position sections |
| T-007 Authority repurposed as integration outcome | **FIXED** | Restored pre-merge authorization text |
| T-008 Authority repurposed as integration outcome | **FIXED** | Restored pre-merge authorization text |
| T-009 Authority repurposed as integration outcome | **FIXED** | Restored pre-merge authorization text |
| T-010 Authority repurposed as integration outcome | **FIXED** | Restored pre-merge authorization text |
| T-011 Authority (branch-scoped, not merge outcome) | **KEEP** | No change |
| D-005 temporal/normative ambiguity vs later D-006/C-006 Creator auth | **REVIEW** | Human normative decision required; not mechanically edited |
| D-006 temporal language cross-reference to D-005 | **KEEP** | Out of scope for mechanical rewrite |
| Governance Core vendored snapshot | **KEEP** | Unchanged (verified match upstream) |
| Other COMPLETE Tasks (T-001–T-006) Authority sections | **KEEP** | No “Integrated into main” / merge-outcome pattern found |

## Detail — Current State

**Observed:** `canon/state/current.md` stated Milestone 11 was complete on a feature branch “pending human PR merge,” while repository reality (`main` @ `ee0b366…`) already contained M11. The file also carried extensive verification counts and PR merge narrative inappropriate for current-position compression.

**Recovery scope:** Rewrite Current Position, Active Work, Blockers, Material Risks, and Verification Basis only.

**Exclusions:** No Task registry, no PR history, no transient draft-PR workflow encoding (unless genuinely necessary for the next actor).

## Detail — Task Authority drift (T-007–T-010)

Dogfooding merged integration results into `## Authority` on COMPLETE Tasks. Under Repository Governance v1, Authority records **delegated execution permission** for an episode; integration outcome belongs in Git/PR history and may appear in Verification, not as retroactive enlargement of agent authority.

**Recovered texts** (from final pre-merge PR heads):

- **T-007:** Authorized on `cursor/receiver-grounded-answer-m7-6f39`. Not authorized to merge or change D-001–D-004 / C-001–C-004 without a Decision Request.
- **T-008:** Authorized on `cursor/share-capability-m8-6f39`. Not authorized to merge or modify D-001–D-004 / C-001–C-004.
- **T-009:** Authorized on `cursor/creator-ownership-m9-6f39`. Not authorized to merge.
- **T-010:** Authorized on `cursor/external-identity-m10-6f39`. Not authorized to merge.

Verification sections on those Tasks were **not** removed.

## Detail — T-011

Authority `Authorized on cursor/creator-library-m11. Not authorized to merge.` is historically correct. Human merge does not retroactively expand agent authority. Status remains COMPLETE.

## Detail — D-005 (REVIEW ONLY)

`canon/decisions/D-005-share-capability-access-model.md` states Creator authentication and ownership enforcement “remain deferred.” Later **D-006** / **C-006** (M9) introduced Creator auth and ownership.

This is **temporal/normative ambiguity**, not a structurally invalid record. T-012 is **not** authorized to choose among:

- leave unchanged after human interpretation,
- clarify through later authority,
- supersede via a new Decision.

**Classification: REVIEW — human normative decision required.**

## Material risks (Current State)

Preserved actionable risks evidenced in repository Canon and constraints (e.g. C-005 deferred access-log redaction; incomplete production hardening; unresolved data lifecycle/deletion product semantics; no hosted CI in repository).

## Explicit exclusions

- Product/runtime code, migrations, dependencies
- New Decisions or Constraints
- M12
- Merge of normalization PR
- Changes to Governance Core (`AGENTS.md`, `governance/SPEC.md`, schemas, checker, `version.json`)

## Post-repair verification

- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — clean
- Semantic scan: COMPLETE Tasks T-001–T-011 for merge-outcome Authority phrasing — only T-007–T-010 required repair in this episode

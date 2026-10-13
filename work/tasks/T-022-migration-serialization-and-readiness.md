---
schema: task/v1
id: T-022
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-019
related_to:
  - C-006
  - T-021
---
# Slice C migration serialization and readiness

## Objective

Serialize competing migrators and detect an unavailable or incompletely migrated
database through a bounded, generic readiness probe.

## Scope

Migration runner, build-time required migration manifest, read-only readiness
HTTP route, focused failure/concurrency tests, operations notes, and factual
Current State reconciliation. Preserve per-file atomicity and all existing
ownership, publication, Share and erasure behavior. Backup/PITR provisioning and
restore drills are separate remaining Slice C work.

## Authority

The owner accepted this next development step on 2026-10-13 after the plan
recheck. Local code/document edits and verification against a disposable local
PostgreSQL database are authorized. This task records that scope, not a new
grant for remote push, PR integration, deployment, shared/operating database
changes, protection changes, paid provider calls or normative decisions.

## Constraints

Installed Governance and current Project Canon govern. Readiness reads only
migration history, reveals generic status and never bypasses Creator or Share
authorization. Use a dedicated direct/session migrator connection; preserve
rollback and release locks on failures. No automatic application migration,
erasure or restore. Preserve unowned local attachments and other worktrees.

## Verification

Unit and HTTP contract tests, actual concurrent CLI and failing-file tests on
disposable PostgreSQL 16, existing integration/auth and browser regression,
typecheck/build, Governance checker, whitespace check and internal adversarial
self-review. Bind final observations to the local artifact; hosted/deployed
readiness evidence is not implied.

Observed on 2026-10-13, branch `codex/db-readiness-hardening`, uncommitted diff
based on `feb32dec0f10935164ec0e4e4e48cf9380d1f793`, Windows Node 24.20.0 and
a dedicated disposable PostgreSQL 16 container bound to local port 15433:

- Unit: 15 files / 55 tests PASS.
- Integration: 9 files / 112 tests PASS, including seven migration/readiness
  cases with two actual concurrent CLI processes, rollback/retry, lock timeout,
  missing history and both Supabase transaction-pooler rejection paths.
- Authentication: 11 files / 72 tests PASS.
- Playwright: 15 tests PASS, including readiness 200 → missing history 503 →
  repaired history 200, and existing ownership/Share/erasure flows.
- Typecheck, production build, Governance structure and whitespace: PASS.
- Internal adversarial self-review corrected incomplete transaction-pooler
  rejection and checked lock-before-DDL, rollback/unlock, dirty probe connection
  discard, read-only transaction scope and generic error responses. No remaining
  actionable finding within this diff; this is not independent assurance.

Exact runtime/test content fingerprint and bounded remaining gates are in
`work/reports/t022-local-verification.md`. Node 22 hosted CI, release wiring and
target deployment verification have not run for this diff.

## Stop Conditions

Stop for normative ambiguity, a changed ownership/erasure boundary, unapproved
remote or operating DB action, or inability to verify critical serialization
and failure cleanup. Preserve safe partial work.

## Completion Criteria

The local implementation passes focused negative and existing regression gates,
with instructions for the target readiness check and clear separation of the
remaining release, backup/restore and hosted verification work.

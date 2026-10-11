---
schema: task/v1
id: T-021
status: IN_PROGRESS
areas:
  - handoff
depends_on:
  - T-020
implements:
  - D-011
  - D-012
  - D-013
  - D-014
  - C-011
  - C-012
---
# vNext bootstrap and external Receiver vertical slice

## Objective

Implement and verify the S1–S6 local flow from a portable Sender proposal through Creator review and immutable publication to token-free Receiver transfer and bounded independent verification.

## Scope

Use the reconciled `hermeneus_codex_reconciled_v0_1.zip` design input (SHA-256 `c41e2428ed9ecc46c85e3ab1010266411fa8eb5a2ec4423e6ba63306d1c6432f`), with its `integration/UNIFIED_IMPLEMENTATION_CONTRACT_v0_1.md` prevailing only among attached design documents. Preserve existing imported-source, internal Receiver, ownership, sharing, and M12 erasure paths. Implement pure contracts, additive migration source, application and UI paths, adversarial fixtures, and regression checks in an isolated branch.

## Authority

The owner approved the enumerated integration and implementation gates on 2026-10-11. PR #22 and PR #23 were integrated under that approval; implementation starts from `main` commit `2948c6f1f194ca1b5867eaec91418e4699693cc1`. Local code and test edits, disposable local/test database use, and local commits are delegated. Permission for those two PR operations does not grant a later implementation push, new PR, production database change, deployment, or paid external model call.

## Constraints

Installed Governance and active Project Canon govern. Do not fabricate source provenance or classify uncovered, unsupported, or ambiguous material claims as aligned. Keep title private and opt-in, review notes transient, packet/share secrets excluded, and Published versions immutable. Do not weaken existing erasure or authorization boundaries.

## Verification

Run installed Governance checker, Node 22 typecheck/build, deterministic tests, disposable PostgreSQL migration/integration and Playwright E2E, plus focused negative fixtures. Bind evidence to exact local HEAD; distinguish local from hosted checks and record unavailable environment or paid-model coverage honestly.

## Stop Conditions

Stop affected work for a new normative or privacy decision, altered access/erasure authority, unapproved provider disclosure or cost, production side effect, destructive Git, or inability to verify a critical integrity boundary.

## Completion Criteria

All S1–S6 slice acceptance checks pass on a clean local commit, with remaining external provider, hosted CI, and release permissions identified separately. No deployment is part of this task.

## Local execution status (2026-10-11)

- S1 portable Proposal parser and Draft mapping implemented with strict input and duplicate-key checks.
- S2 source-free Bootstrap ingress and explicit NOT_COLLECTED lifecycle implemented through additive migration 009; applied only to a disposable local PostgreSQL 16 container. Imported-source and M12 erasure paths remain covered by regression tests.
- S3 Creator preview, transient note acknowledgment, optional private title, owner-only Library display, and source-free review implemented. The server action receives canonical item fields and an acknowledgment flag, not review-note text.
- S4 exact-version, token-free Receiver Packet v0 and Submission v0 projection implemented; digest uses RFC 8785 JCS and SHA-256, with published conformance sample and Unicode tests.
- S5 v0.1 claim-inventory/span/coverage and deterministic aggregate gates implemented with a model port and test doubles. No external semantic provider is configured or called; the live answer-check action returns `INDETERMINATE` and never claims semantic alignment without that provider. A provider, data-disclosure policy, and spend boundary require separate approval before enabling paid verification.
- S6 local Node 22 typecheck, build, Governance, deterministic suites, disposable PostgreSQL integration/auth/application/share suites, and Playwright E2E have passed during implementation. Final clean-commit rerun and exact-HEAD evidence remain to be recorded. Hosted CI requires later push permission; production DB migration and deployment remain unapproved.

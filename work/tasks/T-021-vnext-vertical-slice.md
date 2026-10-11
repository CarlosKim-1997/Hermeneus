---
schema: task/v1
id: T-021
status: COMPLETE
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

## Completion evidence (2026-10-11)

- S1 portable Proposal parser and Draft mapping implemented with strict input and duplicate-key checks.
- S2 source-free Bootstrap ingress and explicit NOT_COLLECTED lifecycle implemented through additive migration 009; applied only to a disposable local PostgreSQL 16 container. Imported-source and M12 erasure paths remain covered by regression tests.
- S3 Creator preview, transient note acknowledgment, optional private title, owner-only Library display, and source-free review implemented. The server action receives canonical item fields and an acknowledgment flag, not review-note text.
- S4 exact-version, token-free Receiver Packet v0 and Submission v0 projection implemented; digest uses RFC 8785 JCS and SHA-256, with published conformance sample and Unicode tests.
- S5 v0.1 claim-inventory/span/coverage and deterministic aggregate gates implemented. The guarded OpenAI pilot provider uses explicit per-request consent and app-side spend reservations; absent configuration or consent, verification does not claim alignment. No paid external semantic evaluation is claimed.
- S6 exact implementation commit `62902314429c2a875548ce323a27bbdd24805c38` passed PR #24 hosted `verify`, `postgres`, `e2e`, and `dependency-audit` checks. Merge commit `e2bc37ab5f93095cdc38c35a0b9e294aa4f147e1` passed the same four jobs in [main run 38149293147](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38149293147). The PostgreSQL and E2E runs used disposable CI infrastructure. These observations satisfy the local vertical-slice completion criteria; target deployment, production migration, and paid-model quality evaluation belong to later authorization and verification.

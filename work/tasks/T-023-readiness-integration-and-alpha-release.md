---
schema: task/v1
id: T-023
status: IN_PROGRESS
areas:
  - handoff
depends_on:
  - T-022
related_to:
  - C-006
  - C-005
---
# Readiness integration and synthetic Alpha release

## Objective

Integrate the verified T-022 implementation through the protected main branch,
verify Node 22 hosted CI, and deploy/check that exact artifact in synthetic Alpha.

## Scope

Commit and push the existing implementation branch; create and integrate its
PR after actual required checks pass; check the resulting main commit's CI;
deploy to the existing Seoul synthetic Alpha and check protected readiness,
unauthenticated product surfaces and runtime errors. Record actionable evidence.
Do not provision the real-data target or change application schema/data.

## Authority

On 2026-10-13 the owner explicitly approved all next steps proposed after
T-022: commit, push, PR integration, Node 22 CI and synthetic Alpha deployment
verification. This authorizes the necessary PR metadata and bounded release
evidence edits, including factual Current State reconciliation. Use the existing
Vercel CarlosLab team and `hermeneus-alpha-synthetic` project. Prefer existing
authenticated access; any temporary verification access must be limited to that
deployment, kept secret and revoked after use. No protection-rule relaxation,
shared DB mutation, paid model invocation or normative change is authorized.
T-022's terminal Authority remains its historical local-only scope.

## Constraints

Installed Governance and applicable active Canon govern. Preserve required CI,
Creator/Share authorization, synthetic-only use, deployment protection, disabled
external verifier and unowned attachments/worktrees. Bind CI and deployment to
exact commits. No force push, history rewrite or administrator CI bypass.

## Verification

Confirm the T-022 runtime/test fingerprint, remote freshness, local structure and
whitespace checks; required PR checks and post-integration Node 22 main CI;
deployment team/project/SHA/region; protected `/api/ready` response and generic
product denial surfaces; bounded runtime error inspection and temporary access
cleanup. Record results in a release report. Hosted smoke is not proof of a
fresh Google login, external participant access or backup restore.

## Stop Conditions

Stop release for a SHA/target mismatch, failing required checks, readiness 503,
material authority conflict, unapproved shared DB action or need to relax
protection. Diagnose ordinary failures and reverify within this scope.

## Completion Criteria

Exact integrated SHA passes required hosted CI, the synthetic deployment is
READY and protected readiness/product smoke pass, with residual gates and
cleanup evidence recorded. Backup/PITR restore and automated readiness promotion
wiring remain separate work.

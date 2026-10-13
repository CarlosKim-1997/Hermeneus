---
schema: task/v1
id: T-023
status: COMPLETE
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

Observed on 2026-10-13:

- PR #34 HEAD `ae9c0e4c029d5cf40b49297a89dd003d9d5b499c`: all four required
  checks PASS in run `38386670996`. Its tested temporary merge candidate was
  `77c7963efc355cb4d1bf6c2edeb05212be9899fe`.
- Integrated main `7b014fe3d07ffbde13db6b4c2f84b7d7e9b90749`: all four required
  checks PASS in run `38387114454`, Node 22.23.3; auth 72, integration 112 and
  Playwright 15 PASS. No administrator bypass or protection change.
- Deployment `dpl_2MmV7DPFebTPVRqtSKnzk8FxLTiG`: exact integrated SHA, READY,
  production target of the synthetic-only project, `icn1`, default Alpha alias.
- Protected `/api/ready`: 200 `{"status":"ready"}`, private/no-store.
  Unauthenticated app Handoff access renders a login redirect; Google login UI
  renders; empty Share is unavailable and the legacy token route returns 404.
- Cookie-free readiness requests to the default and deployment-specific hosts
  return 302 to Vercel SSO. Project inspection still shows protection on all
  deployments. No error/fatal groups observed in the deployment's latest 10m.
- The one temporary verification link created for this deployment was revoked;
  the returned protection-bypass map no longer contains it. No shared DB writes
  or paid model calls occurred.

Full bounded evidence and remaining gates:
`work/reports/t023-readiness-alpha-release.md`. The follow-up evidence PR changes
only these records, not the deployed application.

## Stop Conditions

Stop release for a SHA/target mismatch, failing required checks, readiness 503,
material authority conflict, unapproved shared DB action or need to relax
protection. Diagnose ordinary failures and reverify within this scope.

## Completion Criteria

Exact integrated SHA passes required hosted CI, the synthetic deployment is
READY and protected readiness/product smoke pass, with residual gates and
cleanup evidence recorded. Backup/PITR restore and automated readiness promotion
wiring remain separate work.

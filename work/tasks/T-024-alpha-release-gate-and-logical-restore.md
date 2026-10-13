---
schema: task/v1
id: T-024
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-023
related_to:
  - C-005
  - C-006
  - C-009
---
# Synthetic Alpha release gate and isolated logical restore

## Objective

Prepare automatic readiness-gated synthetic Alpha release and verify an actual
logical backup/restore in a disposable local PostgreSQL environment.

## Scope

Implement a disabled-by-default GitHub release workflow and negative tests;
extend the existing PostgreSQL CI job with an isolated synthetic restore test;
document activation, cleanup, recovery boundaries and verification evidence.

## Authority

On 2026-10-13 the owner said “진행해줘” in response to the proposed automatic
deployment Gate and backup/restore follow-ups. This permits implementation,
local verification and necessary disposable synthetic DB/container operations.
Prepare a concrete integration and activation handoff. T-023's completed release
permission is historical; it is not rewritten as permission for this episode.
Do not activate unattended releases, register a deployment credential, push or
integrate this new workflow without explicit authorization for those actions.
No paid PITR provisioning, shared DB restore/migration, real-data backup,
retention/RPO/RTO ratification or external model call belongs to this episode.

## Constraints

Preserve installed Governance, active Canon, four required CI checks, all-deploy
Vercel Authentication, synthetic-only operation, disabled external verifier and
unowned attachments/worktrees. Secrets stay in protected mechanisms. No fork/PR
code receives deployment credentials. Logical restores stay isolated from app
traffic and never claim that a schema-history readiness probe reconciles later
erasure or revocation events.

## Verification

Exact current-main CI selection, rejected stale/fork/failed/skipped runs,
team/project/SHA/region/production/protection checks, readiness failures,
redirect denial, temporary access expiry/cleanup and no promotion on failure.
Actual pg_dump/pg_restore of all migrations and synthetic published data;
effective ACLs, default privileges, lifecycle/immutability guards and pre-backup
erasure/revocation; demonstrate post-backup erasure/revocation drift. Record
local and hosted verification separately in the T-024 report.

Local implementation and verification completed. See
`work/reports/t024-release-gate-and-restore.md` for the exact baseline and
implementation fingerprint, test observations, adversarial findings/fixes,
owned fixture cleanup and integration/activation prerequisites. No hosted
release, push, integration or shared DB action occurred in this episode.

## Stop Conditions

Missing release credential or activation permission, target/SHA mismatch,
failed checks/readiness/cleanup, normative conflict, unapproved shared-data
operation or need to relax deployment/branch protection. Diagnose ordinary
technical failures and reverify within scope.

## Completion Criteria

Local implementation and review are verified, CI wiring is reviewable and the
remaining integration/activation and real-data recovery boundaries are explicit.
Do not declare unattended deployment active before an actual protected hosted
run succeeds with its own GitHub environment credential.

---
schema: task/v1
id: T-025
status: IN_PROGRESS
areas:
  - handoff
depends_on:
  - T-024
related_to:
  - C-005
  - C-006
  - C-009
---
# Release Gate integration and synthetic Alpha activation

## Objective

Integrate the locally verified release Gate/restore test and activate the
approved automatic deployment flow for the existing synthetic-only Alpha.

## Scope

Commit/push the T-024 change, create/merge its PR after actual required CI,
verify post-integration main CI, create a main-restricted GitHub deployment
environment, activate the opt-in variable after its credential is registered,
observe and repair the first automatic staged/probed/cleaned/promoted release.
Record exact artifacts and reconcile factual Current State when material.

## Authority

On 2026-10-13 the owner explicitly approved all remaining commit, push, merge
and automatic-deployment activation actions. This includes necessary PR metadata,
GitHub deployment environment/variable setup and bounded verification access
for the CarlosLab `hermeneus-alpha-synthetic` project. Deployment credentials
must be registered directly by the owner in GitHub's environment-secret UI;
the agent does not retrieve or print them. Ordinary failure diagnosis and
repairs/reverification stay within this approved integration episode.
T-024's completed local-only Authority remains historical. No paid PITR target,
real-data release, shared DB mutation/restore, policy change, paid model call,
history rewrite or protection relaxation is authorized by these actions.

## Constraints

Installed Governance, active Canon and observed GitHub protection govern.
Keep four required checks, synthetic-only use, deployment protection on all
deployments, disabled external verifier and existing database unchanged.
Preserve unowned worktrees/attachments. No fork/PR code receives Vercel secrets.

## Verification

Exact T-024 fingerprint, local structure/whitespace, actual PR HEAD and required
checks, tested merge candidate and resulting main CI on Node 22; environment
branch restriction, token-name presence only, opt-in variable, exact hosted
release SHA, deployment team/project/region/provenance, readiness, access cleanup
and promotion/alias state. Observe an interrupted side effect before retrying.

PR #36 HEAD `e347800db6a2ee56d7943e17a0d3a0e47776e899` passed all four
required jobs in CI `38394388834` and was merged without protection changes.
Integrated main `e25655178a905f95c8f8da85e5998e08af9dc0c5` passed all four
jobs in CI `38394774004` on Node 22.23.3, including actual synthetic logical
restore, auth 72, integration 113 and E2E 15 PASS. The main-restricted deployment
environment and opt-in variable are prepared. Owner credential registration
and the first hosted release remain pending; T-025 remains IN_PROGRESS.
Details: `work/reports/t025-release-gate-integration.md`.

## Stop Conditions

Stop affected activation for missing credential, target/SHA mismatch, failing
CI/readiness/cleanup, unapproved data operation or normative conflict. Continue
authorized integration and preparation independent of credential registration.

## Completion Criteria

PR integrated with passing exact required CI and post-integration main CI;
automatic release of that trusted main observed successful, with exact artifact,
protected readiness, owned temporary-access cleanup and aliases recorded.
If credential registration is pending, hand off completed integration and the
one actionable activation prerequisite without claiming release is active.

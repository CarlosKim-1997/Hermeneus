---
schema: task/v1
id: T-025
status: COMPLETE
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

On 2026-10-14 the owner separately approved restoring the exact generated
secondary alias to the previous verified deployment, and then accepted the
primary-domain release Gate: only the literal provider-generated base alias may
move before readiness; the primary service domain must retain its captured
mapping until verified same-artifact promotion. Other aliases remain denied,
all-deployment protection and synthetic-only use remain required. This changes
the execution boundary, not formal product Canon meaning.

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

Complete on 2026-10-14. PR #42 HEAD
`e8190dde8b28b858fac59ef72b9250dde4bd7615` passed all four required jobs in
`38422539774`; integrated main `059a3a85c06f1386ef57047de4372b9dfbfa3e8c`
passed `38422946338`. Automatic release `38423302896` succeeded through exact
main selection, credential validation, staging, protected readiness and owned
access cleanup, one same-artifact promotion and primary mapping confirmation.
Fresh external reads confirmed READY production deployment
`dpl_G8kS2EJRYKETiP1DC1MhxceLACjb` in `icn1`, the primary domain's mapping,
all-deployment protection and opt-in `enabled`. Local final Gate 65,
typecheck/Governance/whitespace PASS; hosted regression gates also passed.

Bounded detailed evidence and ordinary failure repairs:
`work/reports/t025-generated-alias-decision.md`. Earlier integration/restore and
authentication preflight are in `work/reports/t025-release-gate-integration.md`
and the T-024 report. No real-data, target PITR or live-model readiness is claimed.

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

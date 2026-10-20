---
schema: task/v1
id: T-031
status: IN_PROGRESS
areas:
  - handoff
related_to:
  - T-030
  - D-013
  - C-005
  - C-008
  - C-012
---
# Integrate and deploy the reference-led UI

## Objective

Release the approved local T-029/T-030 UI through a reviewed PR, required CI, main integration and the existing guarded synthetic Alpha deployment, then inspect the actual deployed interface.

## Authority

On 2026-10-20 the owner explicitly authorized committing, pushing, merging and deploying this UI, including actual post-deployment screen inspection. This is a new execution episode; it does not rewrite the historical local-only authority of T-029/T-030. Necessary reversible fixes, test updates and ordinary release sequencing are included. Keep the owner's actual Chat roundtrip and participant tests paused. No paid API call, real-data use, target DB/schema mutation, new security access, protection weakening or Canon ratification is inferred.

## Scope

Use a dedicated managed worktree based on observed origin/main. Package the UI, relevant E2E/UX tooling and design/evidence records. Preserve the existing dirty primary tree and exclude MCP prototype execution code and its dedicated dependencies. T-028's Work task is included only as a dependency/provenance record for T-029; this does not ship its implementation. Verify configured protection and exact remote checks before merging. Use the existing Alpha staging/readiness/cleanup/same-artifact promotion workflow and confirm the primary domain's artifact and actual screens.

## Constraints

Preserve Canon text/order/classifications/priorities, immutable versions, private-title opt-in, temporary notes and answers, per-check consent, capability secrecy, erasure scopes and authentication. No new collection, provider spend, access grants or production DB changes. Existing all-deployment protection and synthetic-only operation remain. Do not claim that mock UI tests exercise the live provider or that the synthetic MCP path is integrated with real shares.

## Verification

Record the isolated artifact, local checks, internal review, PR head, required CI, merge SHA, release run/deployment/primary alias, real-screen observations and limitations. Stop on a concrete failed gate and investigate it; do not bypass CI or change branch protection.

## Stop Conditions

Escalate new normative choices, material authority conflict, security-access expansion, real-data use, paid-provider operation or irreversible external work beyond this release.

## Completion Criteria

Approved UI is committed, pushed, integrated after required checks, deployed through existing guards, and visually confirmed on the actual primary service. Report any remaining blocker honestly.

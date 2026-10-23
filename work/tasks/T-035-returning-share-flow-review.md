---
schema: task/v1
id: T-035
status: VERIFYING
areas:
  - handoff
depends_on:
  - T-034
implements:
  - D-015
  - C-005
  - C-006
  - C-008
  - C-009
  - C-012
---
# Returning Receiver and two-Share flow review

## Objective

Check two synthetic Handoffs, return of selected answers, grant expiry and explicit
reconnection, separating server access control from actual ChatGPT usability.

## Authority

On 2026-10-23 the owner requested the proposed flow review. This authorizes reads,
local disposable synthetic tests, test/evidence files and a findings report.
T-034 is closed and is not reopened to infer new release or provisioning powers.
Browser actions that create new scoped access require action-time confirmation.
No real data, paid semantic API, target DB/schema changes, push, merge, deployment,
global account setting or normative change is inferred from this review request.

The owner subsequently approved the isolated local recovery UI prototype and
explicitly requested its application and merge. This adds permission to commit,
push and integrate the T-035 tests, prototype and Work records after required CI.
The prototype remains a review artifact; simulated authorization/results must not
be connected to product routes. Actual ChatGPT testing is deferred by the owner.

## Scope

Review current main, inspect deployed identity/readiness and reproduce distinct
Published v1 Handoffs, concurrent windows, cross-answer rejection, repeated use,
30-minute grant versus 60-minute session expiry and fresh explicit authorization.
Use local simulated host behavior as such; do not call it real ChatGPT evidence.

## Constraints

D-015 and the implemented Constraints apply. Keep Share secrets outside logs,
Chat URLs/model input and durable records. Keep answers and confirmations out of
security metadata. Preserve pinned Published meaning, explicit per-share approval,
connection separation and failure on absent semantics. Preserve unowned changes.

## Verification

Exact artifact, local HTTP OAuth/MCP tests and intercepted local browser fixtures;
no target credentials in the disposable environment. Record actual host checks
separately. Review failures adversarially before proposing changes.

## Stop Conditions

Escalate new authority/policy, real-data or paid-provider use, release needs and
unavailable action-time approval. Continue independent read/test/report work if
the live browser is unavailable; report that acceptance boundary accurately.

## Completion Criteria

Report verified paths, concrete repeated-use gaps and their basis, unverified live
host boundaries, and a bounded next fix. Complete this review without claiming
that found product defects have been repaired or deployed.

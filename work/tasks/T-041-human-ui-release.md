---
schema: task/v1
id: T-041
status: VERIFYING
areas:
  - handoff
related_to:
  - T-030
  - D-015
  - C-005
  - C-008
  - C-012
---
# Human-centered UI integration and synthetic release

## Objective
Ship the owner-reviewed T-040 interface to the existing synthetic web Alpha and
scoped MCP Alpha, then verify the deployed artifacts and visible screens.

## Scope
Extract the web UI, copy, tests and MCP presentation into a clean release branch
from current main. Preserve earlier local MCP behavior and connection-policy
work in its original checkout. The scoped widget retains the main v1 protocol,
ticket timing and exact script behavior; only its template/style changes.

## Authority
The owner requested deployment on 2026-10-27 after reviewing the local UI work,
following explicit authorization for necessary UI work. This episode authorizes
ordinary release corrections, local tests, commit, branch push, PR integration,
existing synthetic Vercel releases and bounded post-deploy inspection. It does
not authorize new product/security policy, protection changes, real data,
target schema changes, new resources or paid semantic calls.

## Constraints
Retain all four required CI checks, web all-deployment SSO, MCP Preview SSO and
Production OAuth, Seoul routing, exact-version Canon and explicit consent.
Preserve answer non-persistence and unavailable-verifier representation. Use
the existing web staged/readiness/temporary-access-cleanup/promotion Gate.
Never disclose credentials or replace another operator's unfinished work.

## Verification
Current main is 4f1088680dd0d46004099daa7378db5d6a0d945a, with no open PRs
observed. Actual main protection requires verify, postgres, e2e and dependency-audit,
strict checks, and zero approving reviews. Exact release artifact tests, CI and
deployment observations will be recorded in the release report.

## Stop Conditions
Stop for authority conflict, incompatible concurrent changes, failed required CI,
wrong project/region/protection, failed release Gate or uncertain promotion state.
Do not weaken a gate or silently deploy the pending T-039 policy.

## Completion Criteria
Exact UI commit integrated after required CI; existing synthetic web/MCP targets
READY and verified; actual accessible screen checks and remaining limitations
reported. Local tests alone do not establish deployment success.

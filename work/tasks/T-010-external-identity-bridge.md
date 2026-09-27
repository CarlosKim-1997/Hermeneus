---
schema: task/v1
id: T-010
status: VERIFYING
areas:
  - handoff
depends_on:
  - T-009
implements:
  - D-007
  - C-007
related_to:
  - D-006
  - C-006
---
# External identity bridge (Milestone 10)

## Objective

Map authenticated external provider subjects to stable internal Creator identities and use that identity through the existing M9 authorization boundary.

## Scope

Auth.js Google adapter, migration 004, external identity mapping, session bridge to CreatorSessionProvider, deterministic EI/ES tests. Real Google OAuth smoke when credentials exist.

## Authority

Authorized on `cursor/external-identity-m10-6f39`. Not authorized to merge.

## Constraints

C-006 ownership unchanged. C-007 mapping integrity. M8 share bearer independent.

## Verification

Deterministic bridge on PR #10 head: next-auth@5.0.0-beta.32; Creator insert fail-closed (no ON CONFLICT on candidate id, EI10); transactional first-login (EI7/EI9); mapping UPDATE+DELETE immutability via migrations 004+005 (EI6/EI6b, M10M1/M10M2); AUTH_TRUST_HOST policy; architecture doc drift corrected; external-mode `/login` runtime provider loading fix (Next dev dynamic import); `test:auth` 61 green. Real Google OAuth interactive smoke not yet run.

## Stop Conditions

Stop if Handoff ownership schema changes or email becomes mapping authority.

## Completion Criteria

Deterministic identity bridge green; real Google round-trip observed for COMPLETE.

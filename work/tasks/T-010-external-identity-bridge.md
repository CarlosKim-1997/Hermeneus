---
schema: task/v1
id: T-010
status: COMPLETE
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

Deterministic bridge on PR #10: next-auth@5.0.0-beta.32; Creator insert fail-closed (EI10); transactional first-login (EI7/EI9); mapping UPDATE+DELETE immutability (004+005, M10M1/M10M2); AUTH_TRUST_HOST policy; external `/login` and Import redirect runtime fixes; `test:auth` 61 green. **Live Google OAuth smoke PASS:** first login → `/new`; mapping cardinality 1; real UI Handoff ownership; sign-out → `/login`; same-account relogin reused internal CreatorId; no duplicate mapping/Creator; ownership stable; anonymous M8 bearer share load + revoke unavailable (smoke Handoff v1).

## Stop Conditions

Stop if Handoff ownership schema changes or email becomes mapping authority.

## Completion Criteria

Deterministic identity bridge green; real Google round-trip observed for COMPLETE.

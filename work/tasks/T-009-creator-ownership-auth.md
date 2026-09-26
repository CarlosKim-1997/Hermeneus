---
schema: task/v1
id: T-009
status: IN_PROGRESS
areas:
  - handoff
depends_on:
  - T-008
implements:
  - D-006
  - C-006
related_to:
  - D-005
  - C-005
---
# Creator identity, ownership, and route authorization (Milestone 9)

## Objective

Establish Creator identity, immutable Handoff ownership, and server-enforced owner authorization without weakening M8 share capability access.

## Scope

In scope: migration 003, Creator repository, dev signed session, ownership guards, protected Creator/internal Receiver actions, login surface, A/O tests, two-Creator E2E.

Out of scope: production auth provider, ownership transfer, teams, MFA, rate limiting.

## Authority

Authorized on `cursor/creator-ownership-m9-6f39`. Not authorized to merge.

## Constraints

C-001–C-006 remain binding. Share bearer authorization remains independent.

## Verification

PR #9 review correction in progress: production session rejection, Server Action IDOR tests, M1–M8 migration backfill proof.

## Stop Conditions

Stop if shared Receiver requires Creator login or if client can supply owner ID.

## Completion Criteria

Owner-only Creator/internal Receiver; M8 share path unchanged; session/metadata absent from model payloads.

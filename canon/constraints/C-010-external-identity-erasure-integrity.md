---
schema: constraint/v1
id: C-010
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
supersedes:
  - C-007
implements:
  - D-010
related_to:
  - D-006
  - D-009
  - C-006
  - C-009
---
# External identity integrity with account erasure

## Constraint

During an active Creator lifecycle, external identity mapping is keyed only by verified `(provider, subject)` and is immutable.

The mapping must resolve to an existing internal Creator before Creator authorization.

Forbidden:

- email-based identity authority;
- email-derived account linking;
- mapping reassignment;
- ordinary UPDATE;
- ordinary DELETE.

The only authorized mapping-deletion path is the Creator Account Erasure lifecycle governed by D-010 and C-009.

After completed account erasure, future authentication by the same external identity must not automatically relink erased Creator IDs, Handoffs, ownership, or provenance.

OAuth access tokens, refresh tokens, ID tokens, or provider session metadata must not become Canonical Handoff content or persistent ownership authority.

## Rationale

Preserve strong identity integrity during account life while permitting complete authorized lifecycle termination.

## Operational Effect

Future persistence constraints may allow deletion only through the explicit erasure orchestration while continuing to reject ordinary mutation/reassignment paths.

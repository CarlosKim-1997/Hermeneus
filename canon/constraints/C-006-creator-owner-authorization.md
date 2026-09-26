---
schema: constraint/v1
id: C-006
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-006
related_to:
  - C-005
  - D-005
---
# Creator-owner authorization boundary

## Constraint

Creator and internal Receiver operations require a valid authenticated Creator session (when auth is enabled) and server-side verification that the current Creator owns the target Handoff. Client-supplied Handoff or Creator identifiers alone never establish Creator authority.

M8 Share Capability access is independent bearer authorization and does not require Creator session authentication.

## Rationale

Knowing a Handoff ID must not grant Creator control. Knowing a Creator session must not grant share-link authority.

## Operational Effect

- Cross-owner access attempts return generic unavailable responses without leaking owner metadata.
- Share tokens and Creator sessions must not enter canonical Handoff items or M6/M7 model payloads.

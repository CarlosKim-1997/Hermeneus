---
schema: decision/v1
id: D-006
status: ACTIVE
areas:
  - handoff
implements:
  - D-003
related_to:
  - D-005
---
# Creator identity and ownership model

## Decision

Hermeneus assigns each Creator an internal stable `CreatorId`. Every Handoff has exactly one immutable Creator owner stored on the Handoff root. Draft, Published versions, source-conversation access, and Share Capability management inherit ownership through the Handoff; ownership is not duplicated on child rows.

External authentication provider choice remains deferred. A future provider may map an external subject to an internal `CreatorId`.

Pre-M9 Handoffs are backfilled to a reserved legacy owner for schema integrity and are not automatically claimable through the M9 development login.

## Context

Milestone 9 introduces authorization without selecting a commercial auth vendor or coupling domain ownership to provider identifiers.

## Rationale

Creator control and shared Receiver access are different credentials. Ownership must be server-enforced and immutable to preserve Handoff authority boundaries.

## Consequences

- Creator/internal routes require authenticated ownership checks on every sensitive operation.
- M8 Share Capability bearer authorization remains independent and does not require Creator session authentication.

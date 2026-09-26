---
schema: decision/v1
id: D-005
status: ACTIVE
areas:
  - handoff
implements:
  - D-003
related_to:
  - D-004
---
# Share capability access model

## Decision

Published Handoff versions remain immutable. Access to a specific published version is represented separately as a Share Capability.

Each Share Capability targets exactly one published `(handoffId, version)` pair. Multiple independent capabilities may reference the same version. Revoking a capability does not mutate the published snapshot.

Receivers authorized through a share link present a high-entropy opaque bearer token. The server resolves that token to the pinned target on every protected operation. The shared Receiver surface does not expose the internal handoff identifier.

Creator authentication, ownership enforcement, and production route authorization remain deferred.

## Context

Milestone 8 introduces a development vertical slice for revocable, version-pinned sharing without collapsing share access into publication state.

## Rationale

Immutability and revocability are different lifecycle concerns. Coupling them would force republication or silent mutation to withdraw access.

## Consequences

- Share tokens grant access; they are not canonical Handoff content.
- Direct `/receiver/[handoffId]/[version]` remains an internal development route until Creator auth exists.
- New capabilities are required to access newly published versions; existing tokens stay pinned.

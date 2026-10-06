---
schema: decision/v1
id: D-008
status: ACTIVE
areas:
  - handoff
depends_on:
  - D-006
  - C-006
supersedes:
  - D-005
implements:
  - D-003
related_to:
  - D-004
  - D-007
  - C-005
---
# Share Capability access model (current)

## Decision

Published Handoff versions and Share Capabilities are separate lifecycle objects.

Each Share Capability targets exactly one published `(handoffId, version)` pair. Multiple independent capabilities may reference the same published version. Revoking a Share Capability does not mutate or revoke the Published Handoff itself.

Receivers authorized through a share link present a high-entropy opaque bearer token. For each protected shared-Receiver operation, the server resolves the bearer capability to its exact pinned published version. The shared Receiver surface must not expose the internal Handoff identifier as its access credential.

Creation, inspection, and revocation of Share Capabilities are Creator-controlled operations and therefore require authenticated server-side owner authorization under D-006 / C-006.

Receiver access through a valid Share Capability remains independent bearer authorization. A Receiver using a valid share link does not require a Creator session. Creator authentication must not substitute for possession of a valid Share Capability on the shared Receiver surface.

Internal Creator/Receiver routes addressed by Handoff identity remain subject to C-006 owner authorization.

External authentication provider choice or adapter implementation does not alter the Share Capability authorization model.

## Context

D-005 established the Milestone 8 separation between immutable published versions and revocable Share Capabilities. D-006 and C-006 later established Creator identity and server-enforced ownership for Creator-controlled operations. D-005 retained a milestone-temporal sentence stating that Creator authentication, ownership enforcement, and production route authorization remained deferred. The human owner explicitly ratified this successor Decision so current Share Capability authority can be read durably without that obsolete implementation-state wording. This successor preserves the substantive capability model and states its relationship to the now-existing Creator authorization boundary.

## Rationale

Publication immutability and access revocability remain different concerns. Creator control and Receiver bearer authorization are different credentials. Explicit separation prevents Creator session authority from accidentally becoming share-link authority and vice versa. Whole-object supersession preserves historical D-005 instead of silently rewriting transient language inside an ACTIVE Decision.

## Consequences

- Share tokens remain non-canonical access credentials; they are not Handoff content.
- Multiple capabilities per published version remain valid.
- Revocation affects only the Share Capability, not the published snapshot.
- Share Capability creation, inspection, and revocation require owner-authorized Creator sessions under D-006 / C-006.
- Valid share bearer access remains anonymous with respect to Creator login.
- Existing product behavior already implements this model; this Decision records current authority and does not imply a runtime change.
- D-005 becomes historical superseded authority; its body remains readable as Milestone 8 context.

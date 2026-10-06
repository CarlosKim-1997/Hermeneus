---
schema: decision/v1
id: D-007
status: SUPERSEDED
areas:
  - handoff
implements:
  - D-006
related_to:
  - D-006
---
# External identity bridge

## Decision

Verified external provider identities map to Hermeneus-owned internal Creator IDs using immutable `(provider, subject)` records. Handoff ownership remains expressed only through the internal Creator ID on the Handoff root.

Provider choice and adapter libraries may change without rewriting Handoff ownership. Provider email is not identity authority.

## Context

Milestone 10 connects one external identity provider while preserving the M9 ownership and authorization model.

## Rationale

Authentication and ownership are separate concerns. External subjects must not become Handoff ownership columns or canonical content.

## Consequences

- Creator authorization continues through C-006 and `handoffs.owner_creator_id`.
- Additional providers can be added by extending mapping rows, not Handoff schema.

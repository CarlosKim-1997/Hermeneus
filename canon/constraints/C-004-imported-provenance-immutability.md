---
schema: constraint/v1
id: C-004
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-003
related_to:
  - C-002
---
# Imported conversation provenance is immutable

## Constraint

Once an imported conversation is used as provenance for a Handoff, that imported conversation must not be silently rewritten in place with different content.

Reprocessing the exact same import may be idempotent. Different content must become a different source conversation or import rather than replacing existing provenance.

## Rationale

Published Handoff items point at message IDs from a specific import. In-place rewrites would change provenance under already-approved meaning without a new publication boundary.

## Operational Effect

- Persistence must reject conflicting re-imports for the same conversation ID.
- Identical re-imports must not mutate stored messages.
- Failed imports must not leave partial conversations.

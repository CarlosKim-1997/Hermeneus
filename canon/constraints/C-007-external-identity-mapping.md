---
schema: constraint/v1
id: C-007
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-007
related_to:
  - C-006
  - D-006
---
# External identity mapping integrity

## Constraint

External identity mapping is keyed by verified `(provider, subject)`, is immutable once created (including no reassignment or deletion in M10), cannot be inferred or linked by email, and must resolve to an existing Hermeneus Creator before Creator authorization occurs.

Provider session or OAuth token metadata must not enter Canonical Handoff content or Receiver model payloads.

## Rationale

Email collision must not merge distinct people. Mapping stability is required for durable ownership references.

## Operational Effect

- Automatic email-based account linking is forbidden.
- OAuth access, refresh, and ID tokens are not persisted in Hermeneus application tables.

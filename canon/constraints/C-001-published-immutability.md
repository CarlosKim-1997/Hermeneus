---
schema: constraint/v1
id: C-001
kind: HARD_CONSTRAINT
status: SUPERSEDED
areas:
  - handoff
overridable: false
implements:
  - D-003
---
# Published handoff versions are immutable

## Constraint

A published handoff version cannot be silently mutated. Changing approved meaning requires a new published version. Draft edits after publication do not alter any existing published version.

## Rationale

Receivers and share recipients have to be able to rely on the exact version they were given. In-place edits make provenance and later disagreement unresolvable.

## Operational Effect

- Publication copies draft state into a version snapshot.
- Subsequent draft mutations must leave prior snapshots unchanged.
- Tests must fail if a published version changes without a new version number.

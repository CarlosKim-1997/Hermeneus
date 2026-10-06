---
schema: constraint/v1
id: C-008
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
supersedes:
  - C-001
implements:
  - D-009
related_to:
  - D-008
  - C-009
---
# Published meaning immutability and erasure boundary

## Constraint

A surviving Published Handoff version's approved canonical meaning cannot be modified in place.

Changing approved semantic content requires a new Published version.

This protection applies to canonical meaning including:

- item identity;
- classification/type;
- statement;
- priority;
- Creator-approved semantic content.

Source/provenance metadata does not share the same mandatory retention lifecycle.

Authorized Source Erasure under D-009 may remove provenance references and excerpts without creating a new Published version.

Provenance Erasure must never be used to:

- rewrite a surviving statement;
- change its classification;
- alter approved meaning;
- silently substitute new provenance;
- reinterpret the item.

Whole-Handoff Erasure may remove all Published versions together.

Selective deletion of one Published version while retaining other versions of the same Handoff is not an authorized M12 erasure primitive.

## Rationale

Preserve the trust guarantee of immutable approved meaning while allowing a distinct privacy/data lifecycle for provenance.

## Operational Effect

Storage must support the conceptual distinction between immutable surviving canonical meaning and erasable provenance. If the current physical representation couples them, the future implementation must migrate that representation without changing approved meaning.

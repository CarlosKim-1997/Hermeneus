---
schema: constraint/v1
id: C-002
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-003
---
# Raw provenance cannot override an approved handoff

## Constraint

Raw imported source and normalized conversation text cannot override a Published Canonical Handoff. Extraction output has no canonical authority until explicit creator approval.

When approved handoff text and earlier transcript text disagree, receiver behavior follows the approved handoff. Provenance may explain that the earlier text was considered. It must not reinstate it as the current position.

## Rationale

Retrieval over a long transcript will surface superseded exploration. Treating that text as current intent defeats creator review.

## Operational Effect

- The receiver interpretation path accepts a published version as its authority input.
- A raw transcript, even if supplied beside that call, is not an authority source for the conclusion.
- Tests must cover a direct conflict between transcript text and approved text, and an extraction proposal the creator reverses before publication.

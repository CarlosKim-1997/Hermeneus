---
schema: decision/v1
id: D-010
status: ACTIVE
areas:
  - handoff
depends_on:
  - D-009
supersedes:
  - D-007
implements:
  - D-006
related_to:
  - C-006
---
# External identity lifecycle and account erasure

## Decision

Verified external provider identities map to Hermeneus-owned internal Creator IDs through `(provider, subject)` identity records.

During an active Creator account lifecycle, the mapping is immutable.

Forbidden during an active lifecycle:

- provider reassignment;
- subject reassignment;
- CreatorId reassignment;
- email-derived linking;
- ordinary standalone mapping deletion.

An external identity mapping may be deleted only as part of an authorized Creator Account Erasure after the Creator-owned data lifecycle has been terminated as required by D-009 / C-009.

This deletion is lifecycle termination, not reassignment.

After completed account erasure, later authentication by the same external `(provider, subject)` may create a new Creator lifecycle.

A new lifecycle must not automatically recover or relink:

- erased CreatorId;
- erased Handoffs;
- erased ownership;
- erased provenance;
- erased account data.

Provider choice and adapter implementation remain replaceable.

Provider email is not identity authority.

## Context

D-007 established provider-subject → internal CreatorId mapping. M10 intentionally made mappings permanently undeletable. M12 requires account erasure without weakening ordinary identity integrity. Ordinary mapping immutability therefore remains, with one explicit lifecycle-termination path.

## Rationale

Mapping stability and account erasure solve different problems. Free reassignment would compromise ownership integrity. Permanent retention would make true account lifecycle termination impossible.

## Consequences

- Mapping mutation remains forbidden during active account lifecycle.
- Account erasure is the sole authorized mapping-deletion path.
- Re-registration creates a new Creator lifecycle.
- Erased historical ownership cannot silently reappear.

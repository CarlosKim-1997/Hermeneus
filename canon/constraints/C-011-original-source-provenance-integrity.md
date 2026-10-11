---
schema: constraint/v1
id: C-011
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-012
related_to:
  - C-004
  - C-008
  - C-009
---
# Original-source provenance honesty

## Constraint

A bootstrap-created Handoff must not be assigned fabricated original conversation messages, provider exports, provenance excerpts, timestamps, or evidence references solely to satisfy legacy import/persistence structures. The original-source state NOT_COLLECTED must be distinguishable from RETAINED and ERASED. A bootstrap proposal, if stored, may evidence what that model submitted, but must not masquerade as the Sender's original source transcript or human ratification. Retention and authorized erasure of stored bootstrap materials must not bypass D-009 / C-009 lifecycle controls.

## Rationale

Invented provenance makes a structurally valid report look like verified historical evidence and corrupts privacy/erasure claims.

## Operational Effect

Fail closed on invalid origin/provenance combinations; no synthetic source-message workaround; preserve original import provenance integrity and ownership isolation.

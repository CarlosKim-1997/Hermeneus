---
schema: constraint/v1
id: C-012
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-013
related_to:
  - C-002
  - C-003
  - C-005
  - C-008
---
# Receiver verification representation integrity

## Constraint

Hermeneus must not label an arbitrary third-party AI output as Canon-aligned without checking its association to the exact published Handoff version, structural validity and cited Canon identifiers, and all material claims through an adequate bounded semantic-verification path. Missing verification, contradiction, unsupported claims, indeterminate claims and verifier errors must not be silently represented as successful verification. An AI-output verification result must not be described as certification of actual Receiver comprehension or of the truth of original-source claims. Transfer packets must never contain Share Capability bearer secrets, Creator credentials, or provenance that is unavailable due to authorized erasure.

## Rationale

Citation marks and model confidence are untrusted claims. Conflating an unverified generation, a successful grounding check, and human comprehension would counterfeit the product's trust guarantee.

## Operational Effect

Separate canonical IDs, model annotations, semantic check results and aggregated verdict; fail closed on uncertain/failed checks; gate product wording and UI labels to the verified scope.

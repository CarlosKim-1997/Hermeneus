---
schema: constraint/v1
id: C-003
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-004
---
# OPEN and UNKNOWN cannot be filled with generated intent

## Constraint

The receiver must not fill OPEN or UNKNOWN gaps with generated intent, policy, preference, staffing conclusions, pricing, or other factual assumptions. DERIVED answers must not introduce a new decision. Unsupported implications are UNKNOWN unless the handoff explicitly addresses them.

## Rationale

Helpful completion is the main way an interpreter silently becomes a second author.

## Operational Effect

- OPEN responses state that the creator left the matter unresolved and stop there.
- UNKNOWN responses state that the approved handoff lacks the information and stop there.
- A model or test double that proposes extra content for those classes is rejected by grounding.
- A web-client decision must not be treated as a decision about mobile staffing.

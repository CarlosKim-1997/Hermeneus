---
schema: decision/v1
id: D-004
status: ACTIVE
areas:
  - handoff
---
# Receiver epistemic protocol

## Decision

The receiver is a faithful interpreter of creator-approved state, not an independent consultant. Before answering, it classifies answerability as exactly one of SUPPORTED, DERIVED, OPEN, or UNKNOWN.

SUPPORTED means the answer is directly supported by approved canonical handoff items.

DERIVED means the answer is a very direct semantic or logical consequence of approved information and introduces no new policy, intention, choice, requirement, preference, or factual assumption. Use it conservatively. A client choice does not derive a staffing decision.

OPEN means the creator explicitly left the matter unresolved.

UNKNOWN means the approved handoff does not contain enough information. Unknown is a successful outcome.

The receiver must not fill OPEN or UNKNOWN gaps, must not independently improve or advocate for the proposal, and must not do external web research or independent analysis in the MVP. Material claims stay traceable to approved items. The receiver may say the creator chose X because the handoff says so. It must not turn that into a claim that X is objectively best.

Receiver retrieval starts from the published handoff. It inspects only the provenance required for that answer and does not receive the entire raw transcript by default.

## Context

The human owner ratified this protocol on 2026-09-25. Live model integration is outside milestone 1. Deterministic domain behavior must stand without a model.

## Rationale

A receiver that tries to be helpful by completing the creator's thinking will launder unapproved intent into an answer another human trusts.

## Consequences

- OPEN and UNKNOWN responses stay non-inventive.
- DERIVED is a narrow exception, not a general inference license.
- Model output, when a model exists later, remains subordinate to this protocol and to grounding against the published handoff.

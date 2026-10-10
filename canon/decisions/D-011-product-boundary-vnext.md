---
schema: decision/v1
id: D-011
status: ACTIVE
areas:
  - handoff
supersedes:
  - D-001
depends_on:
  - D-009
related_to:
  - D-008
---
# Human-approved meaning transfer across persons and AI services

## Decision

Hermeneus is a human-to-human, provider-neutral system for transferring Sender-approved meaning. It preserves a versioned authority boundary for the Sender's intention, decisions, constraints, rationales, rejections and unresolved matters when those semantics are explained through another person's AI.

The primary vNext user journey permits the Sender's existing AI session to prepare a portable proposal and the Receiver's existing AI to personalize how the approved Canon is presented. Hermeneus is not required to reproduce or own either provider's general chat experience.

Only the Sender's explicit review and publication establishes Canon authority. Hermeneus owns the immutable published snapshot, exact-version access and revocation mechanisms, and bounded verification results on submitted Receiver AI output. The Receiver's provider and personal context do not acquire authority to modify the Sender's approved meaning.

Hermeneus verifies alignment of specified outputs to the pinned Canon; it does not, by default, establish that the Sender AI correctly reconstructed uncollected source material, that approved assertions are objectively true, or that the human Receiver comprehended the meaning. Human comprehension may be evaluated only when a distinct Receiver-produced understanding artifact is available and verified.

Hermeneus remains the primary product name. "Got it?" may label a future understanding-check function. The product does not claim exclusivity or novelty merely because it combines existing memory, handoff or evaluation techniques.

## Context

D-001 established a human-to-human context handoff system using a constrained interpreter. The Sender bootstrap and external Receiver approach separates AI presentation from Canon authority and post-hoc verification. Existing M1–M12 implementation established substantial reusable immutable-publication, identity, share, erasure, and receiver-grounding infrastructure.

## Rationale

The durable product value is trustworthy transfer of approved meaning between people, not ownership of a chat generator. Receiver-specific AI services may offer personalization that Hermeneus does not need to recreate; their behavior, however, is not controllable by prompt alone. The trustworthy boundary therefore remains with Sender ratification, exact-version Canon, and independent post-hoc verification.

## Consequences

- Retain Creator review, immutable versioning, share capability, ownership, and erasure as fundamental infrastructure.
- Make portable-proposal ingress and external Receiver interoperability the preferred future path, not a demand to delete historical ingestion or internal Receiver implementation immediately.
- Do not conflate verification of an AI answer with certification of the Sender's original transcript or a person's understanding.
- Do not create product authority from AI-generated text without explicit Sender approval.

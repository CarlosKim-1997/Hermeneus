---
schema: decision/v1
id: D-001
status: SUPERSEDED
areas:
  - handoff
---
# Hermeneus product boundary

## Decision

Hermeneus is a human-to-human context handoff system. Its job is to convert a conversation in which a human developed an idea with an AI into a creator-reviewed, provider-neutral, verifiable handoff that another human can understand through a constrained interpreter.

The working product name is Hermeneus. That name is not a ratified trademark. Receiver-side understanding-check UX may later use "Got it?"; that phrase is not the primary name.

Source AI systems are source providers. Hermeneus does not reproduce or replace their conversational products.

## Context

The human owner ratified this product direction on 2026-09-25 as the starting authority for the greenfield repository.

## Rationale

The problem is transfer of understanding between humans. Treating Hermeneus as another chat product would optimize the wrong behavior and couple the domain to a provider's interface.

## Consequences

- Do not build a ChatGPT-style creator chat as the product.
- Do not describe source providers as products Hermeneus replaces.
- Future understanding-check UX stays subordinate to the handoff, not a rebrand.

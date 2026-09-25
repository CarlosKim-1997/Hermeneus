---
schema: decision/v1
id: D-003
status: ACTIVE
areas:
  - handoff
---
# Canonical handoff authority

## Decision

Inside the product, authority order is:

1. Published Canonical Handoff
2. Draft Handoff
3. Normalized Conversation
4. Raw Imported Source

Raw conversation history is provenance. It is not canonical truth. An earlier transcript statement never overrides a later creator-approved handoff.

AI extraction creates only a draft proposal. Extraction does not become canonical by itself. Before publication the creator can edit an item, delete an item, change its classification, inspect its provenance, and add a missing item.

Only explicit creator approval publishes a handoff version. Published versions are immutable. A later change creates a new version.

The initial item types are CORE_INTENT, CONTEXT, CONFIRMED, TENTATIVE, OPEN, REJECTED, CONSTRAINT, and RATIONALE. The initial priorities are CORE, IMPORTANT, and SUPPORTING. Items that came from the source conversation remain traceable to source messages.

## Context

The human owner ratified this authority model on 2026-09-25, including the superseded-exploration example: an early "mobile first" remark does not survive a later approved "web-first" handoff.

## Rationale

Without an explicit human publication boundary, retrieval will treat exploratory conversation as current intent. That is the failure Hermeneus exists to prevent.

## Consequences

- Publication stores a snapshot. Later draft edits must not change an already published version.
- Receiver answers resolve against a published version, not against the raw transcript by default.
- Schema evolution may add fields later, but it must not collapse this authority order.

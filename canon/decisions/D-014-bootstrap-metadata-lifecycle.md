---
schema: decision/v1
id: D-014
status: ACTIVE
areas:
  - handoff
depends_on:
  - D-012
  - D-009
related_to:
  - C-009
  - C-011
---
# Bootstrap proposal metadata lifecycle

## Decision

A Portable Canon Proposal may omit `title`. A supplied title is an untrusted display suggestion, not a Canon item or evidence of Sender intent or approval.

The Creator may explicitly choose to retain a bounded, normalized title as private Handoff navigation metadata. Without that choice, no title is stored. A retained `display_title` is readable only through Creator-owned Handoff paths; it is excluded from Published Canon, Receiver packets, share projections, and grounding evidence. Whole-Handoff Erasure and Creator Account Erasure remove it with the Handoff.

Optional `reviewNotes` are shown to the Creator before Draft creation, with an explicit acknowledgement that they will disappear. They are not persistently stored in the Handoff, Draft, Published snapshot, analytics, application logs, or temporary application storage. A Creator may instead manually turn a durable uncertainty into a reviewed Draft item; the system does not promote notes automatically.

## Context

D-012 authorized bootstrap proposals without an original transcript. The owner reconciled the Phase 1–4 implementation inputs and explicitly approved optional private title storage and transient review notes before implementation. These ancillary fields require a distinct lifecycle from approved Canon and retained original-source provenance.

## Rationale

Navigation can benefit from a Creator-chosen title without granting the proposal semantic authority or disclosing private metadata to Receivers. Review notes can guide the Creator's initial review without creating a second, hidden retention surface.

## Consequences

- The bootstrap preview must disclose the title choice and require review-note acknowledgement before creating a Handoff.
- The server must enforce owner-only title access and erase retained titles with the Handoff or Creator account.
- The proposal parser and persistence boundary must not silently save unselected titles or review notes.
- Future review-note retention or wider title disclosure requires a separate human-ratified policy change.

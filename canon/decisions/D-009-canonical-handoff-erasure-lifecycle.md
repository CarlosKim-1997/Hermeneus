---
schema: decision/v1
id: D-009
status: ACTIVE
areas:
  - handoff
supersedes:
  - D-003
related_to:
  - D-006
  - D-008
  - C-006
---
# Canonical Handoff authority and erasure lifecycle

## Decision

Inside Hermeneus, semantic authority remains:

1. Published Canonical Handoff
2. Draft Handoff
3. Normalized Conversation
4. Raw Imported Source

Raw and normalized conversation history and source provenance are not canonical truth.

AI extraction creates only a Draft proposal.

Only explicit Creator approval publishes canonical meaning.

A surviving Published Handoff version has immutable canonical meaning.

Changing approved canonical meaning requires a new Published version.

Canonical meaning and source provenance have separate lifecycles.

While source provenance is retained, source-derived items must remain traceable to that retained provenance.

An authorized Source Erasure may remove:

- raw conversation content;
- normalized/source messages;
- source/provenance associations;
- source message references;
- stored provenance excerpts.

After Source Erasure, an already-approved canonical statement may remain authoritative.

Its provenance state becomes explicitly unavailable.

Hermeneus must not reconstruct, hallucinate, or infer erased provenance.

Canonical content erasure operates on the whole Handoff, not on one selected Published version.

Whole-Handoff Erasure terminates the lifecycle of:

- Draft;
- all Published versions;
- Handoff-specific provenance;
- all Share Capabilities;
- Handoff root.

Whole-Handoff Erasure is not an in-place modification of one surviving version.

It removes the complete Handoff lifecycle.

Selective deletion of a single Published version is not an M12 lifecycle primitive.

If the Creator wants to stop Receiver access while retaining the Handoff, use Share Capability revocation instead.

Creator Account Erasure terminates the Creator-owned lifecycle after owned Handoffs and Creator-specific provenance have been erased.

This Decision does not create a general legal-hold, indefinite-retention, or regulatory retention exception.

Any such future retention regime requires separate human-ratified authority.

## Context

D-003 established the core authority ordering and raw-source-as-provenance model. It also assumed continuing traceability to source messages. M12 preserves the authority ordering but introduces an independently erasable provenance lifecycle. Current persistence physically couples some provenance metadata to Published snapshots; implementation must later make the storage model conform to this conceptual distinction. This Decision is policy canonicalization only and does not itself authorize implementation.

## Rationale

Hermeneus exists to preserve Creator-approved meaning, not necessarily every source transcript forever. Equating meaning immutability with permanent source retention makes privacy and data lifecycle impossible. Automatically deleting approved meaning whenever source provenance is erased would collapse the existing authority/provenance distinction. Canonical meaning and provenance therefore require separate lifecycles.

## Consequences

- Source erasure can make provenance unavailable without invalidating surviving approved meaning.
- Erased provenance must never be silently reconstructed.
- Whole-Handoff Erasure removes all published versions together.
- Per-version erasure is not supported by this policy.
- Share Capability revocation remains the non-destructive access-removal mechanism.
- Implementation must eventually separate erasable provenance from immutable canonical meaning.

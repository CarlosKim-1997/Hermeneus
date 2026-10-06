---
schema: constraint/v1
id: C-009
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-009
related_to:
  - D-008
  - D-010
  - C-005
  - C-006
  - C-008
---
# Creator data erasure integrity boundary

## Constraint

Creator-controlled erasure requires authenticated owner authorization.

Erasure by one Creator must never delete another Creator's independently retained data.

Source Erasure must remove the requesting Creator's source/provenance association and must make erased provenance unavailable through that Creator's Handoffs.

If the same physical source material is independently retained because another Creator still has a valid separate association, that other Creator's retained data may remain.

However, the erased Creator's association and access must be removed.

Whole-Handoff Erasure must logically and safely:

1. invalidate all Share Capabilities for the Handoff;
2. remove the Draft;
3. remove all Published versions;
4. remove Handoff-specific provenance;
5. remove the Handoff root.

Partial failure must not leave:

- active bearer access to erased content;
- partially readable erased Handoffs;
- cross-owner deletion;
- orphan access paths that bypass lifecycle termination.

Receiver/share requests for an erased Handoff must fail closed using generic unavailable behavior.

External callers must not be able to distinguish reliably among erased, never existed, and revoked/unavailable where that distinction would leak existence metadata.

Once Creator Account Erasure begins, new Creator-owned mutations must not be accepted into the lifecycle being terminated.

Account Erasure must logically complete in this order:

owned Handoffs and Creator-specific provenance → external identity mappings → Creator record

A UI-only hide, archive flag, or deleted-at marker that leaves ordinary application-readable personal content intact is not sufficient to claim Erasure.

## Rationale

Erasure is a lifecycle operation, not merely presentation state. Atomicity, owner boundaries, capability invalidation, and fail-closed behavior are required to prevent ghost access and cross-owner data loss.

## Operational Effect

Future implementation must provide transactional or equivalently fail-safe orchestration and adversarial ownership/deletion tests.

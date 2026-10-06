---
schema: task/v1
id: T-017
status: IN_PROGRESS
areas:
  - handoff
depends_on:
  - T-016
related_to:
  - D-009
  - D-008
  - C-006
  - C-008
  - C-009
---
# M12 Source Erasure and Whole-Handoff Erasure

## Objective

Implement authenticated, owner-scoped, transactional Source Erasure and Whole-Handoff Erasure, including Creator UX and adversarial concurrency/integrity tests.

## Scope

In scope: HandoffErasureRepository, draft save serialization, publication/extraction/provenance-read hardening, Creator lifecycle UX, deterministic integration/application tests, architecture and Current State updates.

Out of scope: Account Erasure, Creator lifecycle schema, advisory locks, identity deletion, typed DELETE account UX, Canon changes, production mutation, merge.

## Authority

Authorized on `cursor/m12-handoff-erasure-t017` for erasure code, tests, docs, Current State update, commit, push, draft PR.

Not authorized to merge, implement Account Erasure, or change ratified Canon.

## Constraints

M12 Canon and T-015/T-016 engineering contracts bound semantics. Destructive operations are single PostgreSQL transactions with in-transaction ownership re-verification.

## Verification

Recorded after implementation completes.

## Stop Conditions

Stop on Canon conflict, production DB requirement, or scope creep into T-018 Account Erasure.

## Completion Criteria

Atomic erasure, concurrency-safe draft/share/provenance paths, UX, deterministic tests PASS, governance PASS.

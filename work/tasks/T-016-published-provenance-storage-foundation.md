---
schema: task/v1
id: T-016
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-015
related_to:
  - D-009
  - C-004
  - C-008
  - C-009
  - D-008
---
# M12 published provenance/storage foundation

## Objective

Implement persistence and type foundation that physically separates Published canonical meaning from Published provenance and migrates legacy Published snapshots safely.

## Scope

In scope: migration 007, preflight utility, Draft/Published type split, publication atomicity, receiver provenance reads, integration tests, architecture docs, narrow Current State update.

Out of scope: Source/Handoff/Account erasure operations, Creator lifecycle, advisory locks, identity erasure, destructive UI, Canon changes, merge.

## Authority

Authorized on `cursor/m12-provenance-storage-t016` for foundation code, migration 007, tests, docs, Current State update, commit, push, draft PR.

Not authorized to merge, implement erasure operations, mutate production databases, or change ratified Canon.

## Constraints

T-015 engineering contract and M12 Canon (D-009, C-008, etc.) bound semantics. No new product policy.

## Verification

- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — clean
- `npm run typecheck` — PASS
- `npm run preflight:m12-provenance` — PASS (test DB, read-only)
- `npm run test:integration` — PASS (35 tests, including M12 migration 007 harness M16-1–M16-10)
- `npm run test:share` — PASS (17)
- `npm run test:application` — PASS (32)
- `npm run test:receiver` — PASS (11)
- `npm test` — PASS (14)

## Stop Conditions

Stop on Canon conflict, production DB requirement, or scope creep into T-017/T-018 erasure features.

## Completion Criteria

Preflight + migration 007 + tests + checker PASS; erasure operations absent.

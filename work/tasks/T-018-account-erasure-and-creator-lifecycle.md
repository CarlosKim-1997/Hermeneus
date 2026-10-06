---
schema: task/v1
id: T-018
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-017
related_to:
  - D-006
  - D-009
  - D-010
  - C-006
  - C-009
  - C-010
  - D-008
---
# M12 Creator Lifecycle and Account Erasure

## Objective

Implement fail-safe Creator Account Erasure with Creator-wide mutation serialization, lifecycle-aware auth/session behavior, external identity deletion, share fail-closed behavior, and destructive Account UX.

## Scope

In scope: migration 008, advisory locks, mutation retrofit, atomic import, Account Erasure Phase 1/2, session parity, `/account` UX, deterministic tests, architecture and Current State updates.

Out of scope: archive/trash, restore, retention window, legal hold, team ownership, transfer, email linking, per-version deletion, Canon changes, production mutation, merge.

## Authority

Authorized on `cursor/m12-account-erasure-t018` for lifecycle code, tests, docs, Current State update, commit, push, draft PR.

Not authorized to merge or change ratified Canon.

## Constraints

M12 Canon and T-015 engineering contracts bound semantics. Account Erasure is two-phase: Phase 1 durably commits `erasing`; Phase 2 is one atomic destructive transaction with full rollback on failure. No `erased` Creator row state or reactivation to `active`.

## Verification

- **Migration 008:** M18-1–M18-8 (`tests/integration/m12-migration-008.test.ts`); advisory key determinism.
- **Account Erasure:** A18-1–A18-6, Phase 2 rollback + retry, import atomicity, share fail-closed after Phase 1, cross-owner source, external relink (`tests/integration/m12-account-erasure.test.ts`).
- **Concurrency:** Phase 1 vs draft save ordering; erasing rejects draft save and share revoke.
- **Extraction:** Phase 1 during model call discards suggestions.
- **Auth/session:** `tests/auth/account-lifecycle.test.ts`, external session erasing credential, dev cookie lifecycle DB lookup.
- **E2E:** `e2e/account-erasure.spec.ts` (typed DELETE gate; successful deletion redirect).

Commands:

- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — PASS
- `npm run typecheck` — PASS
- `npm run test:integration` — 95 PASS
- `npm run test:share` — 17 PASS
- `npm run test:application` — 34 PASS
- `npm run test:auth` — 69 PASS
- `npm run test:receiver` — 11 PASS
- `npm test` — 14 PASS
- `npm run test:e2e` — 13/13 PASS

## Stop Conditions

Stop on Canon conflict, production DB requirement, or scope creep beyond T-018.

## Completion Criteria

Met: lifecycle schema, monotonic transitions, identity DELETE only when erasing, Creator shared-lock serialization on mutation paths, atomic import, Phase 1 freeze, share fail-closed, Phase 2 atomic erase with rollback/retry, session hardening, Account UX, tests and governance PASS.

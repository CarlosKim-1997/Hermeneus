---
schema: task/v1
id: T-002
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-001
implements:
  - C-001
  - C-002
  - C-003
  - C-004
related_to:
  - D-003
  - D-004
---
# PostgreSQL persistence boundary

## Objective

Persist normalized conversations, editable drafts, and immutable published Handoff versions in PostgreSQL without weakening Milestone 1 authority and epistemic invariants.

## Scope

In scope:
- domain-facing persistence ports
- PostgreSQL adapter with versioned SQL migrations
- transactional publication with row locking
- database immutability protection for published snapshots
- receiver read boundary without automatic source excerpts
- explicit provenance retrieval
- PostgreSQL integration coverage through P23, including root rebinding, draft concurrency, receiver provenance isolation, concurrent create safety, and publication-time provenance validation

Out of scope:
- UI, Next.js, authentication, share links
- live LLM integration
- raw provider payload retention
- creator deletion lifecycle
- hosted database provisioning or CI expansion

## Authority

Authorized:
- implement persistence on `cursor/postgres-persistence-e41b`
- add migrations, scripts, integration tests, and documentation
- update T-002 and Current State
- append a governance verification note if warranted
- commit, push, and open a draft pull request

Not authorized:
- merge the pull request
- change D-001 through D-004 or C-001 through C-003 without a Decision Request
- mutate production or hosted databases

## Constraints

C-001, C-002, C-003, and C-004 remain binding. Domain code must not import PostgreSQL client libraries. Do not weaken Milestone 1 tests.

## Verification

Observed on 2026-09-25 against local PostgreSQL 16 with `TEST_DATABASE_URL`:

- `node tooling/governance/check.mjs` — PASS (including after T-002 and Current State completion)
- `npm test` — 14 passed (Milestone 1 epistemic fixtures A–G preserved)
- `npm run typecheck` — PASS
- `npm run migrate` — applied `001_initial_persistence.sql`
- `npm run test:integration` — 27 passed: P1–P23 plus handoff-root rebinding, draft stale/concurrent writes, and provenance secret-isolation cases
- C-004 immutable/idempotent conversation import, optimistic draft revision, minimal receiver provenance (`excerpt` only), `InterpretationAuthority` interpreter boundary, publication-time provenance validation (message existence, conversation binding, exact excerpt support)

## Stop Conditions

Stop and report if:
- implementation requires changing ratified product semantics
- no real PostgreSQL instance is available for integration verification
- a normative conflict appears between persistence design and Canon

## Completion Criteria

PostgreSQL round-trips conversations and drafts, publishes immutable versioned snapshots transactionally, isolates receiver reads from source conversations, supports explicit provenance lookup, and preserves Milestone 1 epistemic behavior after reload.

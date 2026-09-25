---
schema: task/v1
id: T-002
status: IN_PROGRESS
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
- PostgreSQL integration tests P1 through P10

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

C-001, C-002, and C-003 remain binding. Domain code must not import PostgreSQL client libraries. Do not weaken Milestone 1 tests.

## Verification

Observed on 2026-09-25 against local PostgreSQL 16 with `TEST_DATABASE_URL`:

- `node tooling/governance/check.mjs` — PASS
- `npm test` — 14 passed (Milestone 1 fixtures preserved)
- `npm run typecheck` — PASS
- `npm run migrate` — applied `001_initial_persistence.sql`
- `npm run test:integration` — P1 through P10 passed

## Stop Conditions

Stop and report if:
- implementation requires changing ratified product semantics
- no real PostgreSQL instance is available for integration verification
- a normative conflict appears between persistence design and Canon

## Completion Criteria

PostgreSQL round-trips conversations and drafts, publishes immutable versioned snapshots transactionally, isolates receiver reads from source conversations, supports explicit provenance lookup, and preserves Milestone 1 epistemic behavior after reload.

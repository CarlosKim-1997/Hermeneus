---
schema: task/v1
id: T-003
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-002
implements:
  - D-003
  - C-001
  - C-002
  - C-004
related_to:
  - D-001
  - D-004
---
# Creator review vertical slice

## Objective

Deliver the first human-usable Creator workflow: import generic text, manually build and review a Handoff draft with provenance, and publish immutable versions through a local web UI without live LLM behavior.

## Scope

In scope:
- Next.js App Router Creator UI on existing domain and PostgreSQL ports
- application use cases for import, draft edit/save, and publication
- Creator-only full source conversation reads separate from Receiver boundaries
- explicit Save with optimistic draft revision and conflict surfacing
- publication bound to an expected draft revision verified under row lock
- Playwright smoke path when the environment supports it

Out of scope:
- live LLM extraction, Receiver AI, authentication, share links, provider parsers, public deployment, vector search, hosted production database

## Authority

Authorized to implement on `cursor/creator-review-milestone-3-e41b`, update T-003 and Current State, commit, push, and open a draft PR. Not authorized to merge or change D-001–D-004 / C-001–C-004 without a Decision Request.

## Constraints

C-001 through C-004 remain binding. UI must not duplicate publication or provenance authority rules. No fake AI extraction in production paths.

## Verification

Observed on 2026-09-25 with local PostgreSQL 16:

- `node tooling/governance/check.mjs` — PASS
- `npm test` — 14 passed
- `npm run test:application` — 9 passed (U1–U9)
- `npm run test:integration` — 29 passed (P1–P25)
- `npm run typecheck` — PASS
- `npm run migrate` — OK
- `npm run build` — PASS
- `npm run test:e2e` — 1 passed (Creator import → review → publish path)

## Stop Conditions

Stop if Milestone 2 is not on `main`, if implementation requires new normative Canon, or if verification cannot run against real PostgreSQL for persistence-backed tests.

## Completion Criteria

A human can paste a generic transcript, manually curate a Handoff with provenance, publish v1/v2, and inspect immutable published artifacts in a browser locally. Publication publishes only the draft revision the Creator explicitly approved at publish time.

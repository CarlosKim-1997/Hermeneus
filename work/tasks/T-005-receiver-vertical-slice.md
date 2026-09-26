---
schema: task/v1
id: T-005
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-004
implements:
  - D-003
  - C-001
  - C-002
  - C-004
related_to:
  - D-001
  - D-004
---
# Receiver vertical slice (Milestone 5)

## Objective

Let a Receiver open one explicit Published Handoff version and ask questions against only that canonical version, with safe citations and optional provenance excerpts—using existing deterministic Receiver semantics without live Receiver AI.

## Scope

In scope:
- Receiver-facing local web route with explicit version pinning (`/receiver/[handoffId]/[version]`)
- `askReceiverQuestion` application use case via `ReceiverReadRepository` and `interpretPublished`
- answerability display (SUPPORTED / DERIVED / OPEN / UNKNOWN)
- canonical item citations and on-demand safe provenance
- Receiver isolation from raw source conversation
- deterministic application tests (R1–R8+) and fixture-backed Playwright Receiver flow

Out of scope:
- live Receiver LLM, conversational memory, Receiver persistence, public share tokens, authentication, organizations, web search, independent critique, “Got it?”, analytics, newest-version auto-follow, native provider imports

## Authority

Authorized on `cursor/receiver-milestone-5-6f39`. Not authorized to merge or change D-001–D-004 / C-001–C-004 without a Decision Request.

## Constraints

C-001 through C-004 remain binding. Receiver answers only from pinned published authority. Provenance excerpts do not override canonical Handoff statements (C-002 / D-003).

## Verification

Observed 2026-09-26 with local PostgreSQL 16:

- `node tooling/governance/check.mjs` — PASS
- `npm test` — 14 passed
- `npm run test:application` — 25 passed (U1–U9, extraction U-flows, R1–R11)
- `npm run test:receiver` — 11 passed
- `npm run test:integration` — 29 passed
- `npm run test:extraction` — 15 passed
- `npm run typecheck` — PASS
- `npm run migrate` — OK
- `npm run build` — PASS
- `npm run test:e2e` — 3 passed (Creator, extraction UI, Receiver)

Live OpenAI extraction tests were not rerun (Receiver-only changes).

## Stop Conditions

Stop if implementation requires new normative Canon, if Receiver paths access full source conversation, or if version pinning is implicit.

## Completion Criteria

A Receiver can open a pinned published version, inspect canonical items, ask a question, receive SUPPORTED / DERIVED / OPEN / UNKNOWN with canonical citations, and optionally view safe provenance excerpts—without escaping Creator-approved Handoff authority.

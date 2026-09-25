---
schema: task/v1
id: T-004
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-003
implements:
  - D-003
  - C-001
  - C-002
  - C-004
related_to:
  - D-001
  - D-004
---
# Live Handoff extraction (Milestone 4)

## Objective

Introduce the first model-backed Handoff extraction workflow while preserving that model output is only a proposal and cannot become canonical without Creator review, draft save, and explicit publication approval.

## Scope

In scope:
- ExtractionProposal domain separate from DraftHandoff authority
- provider-neutral HandoffExtractor returning proposals
- OpenAI Responses API adapter with Structured Outputs (`store: false`)
- deterministic post-model provenance validation
- Creator UI: explicit Generate AI suggestions, non-authoritative suggestion panel, accept/edit/save flow
- extraction evaluation fixtures E1–E10 and application tests U10–U14
- opt-in live OpenAI smoke test command

Out of scope:
- Receiver AI, auth, sharing, extraction audit/history in PostgreSQL, Anthropic/Gemini extraction adapters, native provider import parsers

## Authority

Authorized on `cursor/live-handoff-extraction-e41b`. Not authorized to merge or change D-001–D-004 / C-001–C-004 without a Decision Request.

## Constraints

C-001 through C-004 remain binding. Model output is proposal-only. Extraction must not publish, overwrite drafts, or bypass publication provenance validation.

## Stop Conditions

Stop if Milestone 3 is not on `main`, if implementation requires new normative Canon, or if verification cannot run against real PostgreSQL for persistence-backed tests.

## Verification

Observed on 2026-09-25 with local PostgreSQL 16:

- `node tooling/governance/check.mjs` — PASS
- `npm test` — 14 passed
- `npm run test:application` — 14 passed (U1–U9, U10–U14)
- `npm run test:integration` — 29 passed
- `npm run test:extraction` — 10 passed (E1–E10)
- `npm run typecheck` — PASS
- `npm run migrate` — OK
- `npm run build` — PASS
- `npm run test:e2e` — 2 passed (manual + extraction UI with fixture provider)
- `npm run test:live-extraction` — skipped (OPENAI credentials not configured in agent environment)

## Completion Criteria

A Creator can explicitly request AI extraction, review evidence-backed suggestions separately from the persisted draft, accept and curate items, save, and publish under the existing approval-revision boundary. The model cannot publish or silently overwrite drafts.

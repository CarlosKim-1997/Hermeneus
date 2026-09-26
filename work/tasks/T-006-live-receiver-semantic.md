---
schema: task/v1
id: T-006
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-005
implements:
  - D-003
  - C-001
  - C-002
  - C-004
related_to:
  - D-001
  - D-004
---
# Live Receiver semantic interpretation (Milestone 6)

## Objective

Replace lexical Receiver item matching with live semantic interpretation while preserving Hermeneus epistemic authority: the model selects classification and canonical citations; Hermeneus renders final answers.

## Scope

In scope:
- provider-neutral `ReceiverSemanticInterpreter` port
- OpenAI SDK v7 Responses adapter (`store: false`, Structured Outputs)
- `ReceiverInterpretationProposal` validation and deterministic answer rendering
- hybrid order: deterministic DERIVED → optional live semantic → validated render with deterministic fallback
- `RECEIVER_INTERPRETER=deterministic|openai` (default deterministic)
- RO1–RO10 adapter/hybrid tests, semantic eval fixtures Q1–Q10, opt-in live smoke/eval commands

Out of scope:
- model-authored final prose, arbitrary model DERIVED, Receiver chat memory, provenance in model payload, auth, public sharing, web search, independent critique

## Authority

Authorized on `cursor/receiver-semantic-m6-6f39`. Not authorized to merge or change D-001–D-004 / C-001–C-004 without a Decision Request.

## Constraints

C-001 through C-004 remain binding. Receiver model input is pinned canonical items + question only.

## Verification

### Deterministic verification

Observed 2026-09-26 with local PostgreSQL 16:

- `node tooling/governance/check.mjs` — PASS
- `npm test` — 14 passed
- `npm run test:application` — 25 passed
- `npm run test:receiver` — 11 passed
- `npm run test:receiver-semantic` — 10 passed (RO1–RO10; RO9 unexpected errors propagate; RO10 deterministic DERIVED skips semantic call)
- `npm run test:integration` — 29 passed
- `npm run test:extraction` — 15 passed
- `npm run typecheck` — PASS
- `npm run migrate` — OK
- `npm run build` — PASS
- `npm run test:e2e` — 3 passed

### Live OpenAI Receiver verification

Observed 2026-09-26 in Cursor Cloud with `RECEIVER_INTERPRETER=openai` and configured `OPENAI_MODEL` (10-case fixture set only—not general production accuracy):

- `npm run test:live-receiver` — PASS via hybrid `interpretReceiverQuestion(...)` (`interpretationMode=semantic`, SUPPORTED, citation `web`)
- `npm run test:live-receiver-eval` — PASS Q1–Q10 via Hybrid Receiver product path (not adapter-only)

Metrics on the fixture set: classification accuracy 100%; citation accuracy 100%; false SUPPORTED 0; false OPEN 0; missed SUPPORTED 0; unexpected fallback count 0.

Fallback policy: only `ReceiverSemanticError` (provider/refusal/malformed structured output) and invalid parsed proposals trigger deterministic fallback. Unexpected implementation errors propagate. Invalid or failed semantic proposals use deterministic `interpretPublished` when it yields SUPPORTED/DERIVED/OPEN; otherwise UNKNOWN. Provider refusal is not treated as epistemic UNKNOWN.

## Stop Conditions

Stop if implementation sends raw source or provenance to the Receiver model, or if invalid proposals are shown as authoritative answers.

## Completion Criteria

Semantic question matching improves on lexical baseline while citations are validated, OPEN/UNKNOWN preserved, answers rendered by Hermeneus, and live verification passes when credentials are configured.

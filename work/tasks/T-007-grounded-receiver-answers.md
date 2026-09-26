---
schema: task/v1
id: T-007
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-006
implements:
  - D-003
  - C-001
  - C-002
  - C-004
related_to:
  - D-001
  - D-004
---
# Grounded natural-language Receiver answers (Milestone 7)

## Objective

After M6 selects valid canonical evidence, optionally generate natural-language answers grounded in that evidence only, with a separate verifier gate before display.

## Scope

In scope:
- `ReceiverAnswerGenerator` and `ReceiverGroundingVerifier` ports
- OpenAI adapters (`store: false`), structural validation, M7 orchestration after M6
- SUPPORTED-only generation; DERIVED/OPEN/UNKNOWN unchanged
- `RECEIVER_ANSWER_MODE=deterministic|openai-grounded` (default deterministic)
- GA/GV deterministic tests and opt-in live answer smoke/eval (A1–A10)

Out of scope:
- chat memory, sharing, auth, web search, model DERIVED, provenance in prompts, Got it?

## Authority

Authorized on `cursor/receiver-grounded-answer-m7-6f39`. Not authorized to merge or change D-001–D-004 / C-001–C-004 without a Decision Request.

## Constraints

C-001 through C-004 remain binding. Generated prose is not canonical authority; grounding failure must fall back to M6 rendering.

## Verification

### Deterministic verification

Observed 2026-09-26:

- `node tooling/governance/check.mjs` — PASS
- `npm test` — 14 passed
- `npm run test:application` — 25 passed
- `npm run test:receiver` — 11 passed
- `npm run test:receiver-semantic` — 10 passed
- `npm run test:receiver-answer` — 17 passed (GA/GV + bypass + fabrication gates)
- `npm run test:integration` — 29 passed
- `npm run test:extraction` — 15 passed
- `npm run typecheck` / `npm run build` / `npm run test:e2e` — PASS

### Live M7 verification (fixture set)

Observed 2026-09-26 with `RECEIVER_ANSWER_MODE=openai-grounded` and configured OpenAI credentials:

- `npm run test:live-receiver-answer` — PASS (`interpretReceiverQuestion` + M7 path, `answerMode=generated-grounded`)
- `npm run test:live-receiver-answer-eval` — PASS A1, A5–A7 on current fixture set; A1 generated-grounded; OPEN/UNKNOWN/DERIVED bypass generation; unsupported claims displayed 0

M6 live suites (`test:live-receiver`, `test:live-receiver-eval`) remain unchanged.

## Stop Conditions

Stop if generated prose displays without grounding verification or if raw source reaches generator/verifier.

## Completion Criteria

SUPPORTED answers may use verified generated prose; grounding failure degrades to M6 deterministic rendering with zero unsupported claims on the evaluation fixture set.

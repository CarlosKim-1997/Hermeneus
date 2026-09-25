---
schema: task/v1
id: T-001
status: COMPLETE
areas:
  - handoff
implements:
  - D-001
  - D-002
  - D-003
  - D-004
  - C-001
  - C-002
  - C-003
---
# Offline deterministic handoff slice

## Objective

Prove a provider-neutral domain path from a generic text transcript through normalization, draft extraction, explicit human publication, and receiver answerability, with deterministic tests for the epistemic invariants.

## Scope

In scope:
- Repository Governance adoption for this greenfield repository
- Canon for the ratified product direction
- GenericTextAdapter and a normalized conversation
- Draft handoff, creator edit, and immutable publication
- Receiver answerability classification and grounding against the published handoff
- Deterministic fixtures A through G
- Concise project documentation and deferred privacy notes

Out of scope:
- Production UI, chat UX, and "Got it?" quiz UI
- Live LLM calls or API keys
- ChatGPT, Claude, or Gemini parsers
- Scraping, web search, vector search, billing, teams, and other exclusions listed in the milestone brief

## Authority

Authorized for this execution:
- inspect this repository
- add Governance, Canon, and Work records that restate the owner's 2026-09-25 ratification
- implement the milestone 1 domain slice on `cursor/hermeneus-milestone-1-e41b`
- install test and typecheck tooling required by that slice
- commit, push, and open a pull request for that branch

Not authorized:
- merge the pull request
- ratify new product rules beyond the owner's direction
- mutate production systems or external services
- invent provider export formats or dummy Canon records

## Constraints

C-001, C-002, and C-003 are binding. D-001 through D-004 are binding. Do not claim deferred privacy controls are implemented.

## Verification

Observed on 2026-09-25 after the milestone 1 implementation:

- `node tooling/governance/check.mjs` exits 0
- `npm test` passes adapter normalization, schema rejection of provider fields, publication immutability, authority precedence, grounding, and fixtures A through G
- `npm run typecheck` exits 0
- The core test suite does not require an API key

## Stop Conditions

Stop and report if:
- a conflicting Governance installation is discovered
- implementing the slice would require changing a ratified product rule
- a normative choice is ambiguous and not covered by D-001 through D-004
- secrets would need to be written into the repository
- an external destructive or production mutation would be required

## Completion Criteria

A later reader can see a provider-neutral model, an explicit human approval boundary, immutable published versions, and tests showing that raw conversational history cannot silently become or override creator-approved meaning. The checker passes, and the test suite passes without a live model.

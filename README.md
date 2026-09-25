# Hermeneus

Hermeneus turns a conversation in which a human developed an idea with an AI into a creator-reviewed, provider-neutral handoff that another human can check through a constrained interpreter.

It is not a chat product and does not reproduce ChatGPT, Claude, Gemini, or another provider's conversational UX. Source systems are providers. The working name is Hermeneus. "Got it?" is a possible later understanding-check label, not the product name.

Normative product rules live in `canon/`. This file is an explanation, not authority. Start with `AGENTS.md` and `canon/state/current.md`.

## Authority inside the product

Published Canonical Handoff, then draft handoff, then normalized conversation, then raw imported source. Raw history is provenance. See D-003, C-001, and C-002.

Extraction proposes a draft. Only explicit creator approval publishes a version, and that version is immutable.

## Receiver

Before answering, the receiver classifies the question as exactly one of `SUPPORTED`, `DERIVED`, `OPEN`, or `UNKNOWN`. `UNKNOWN` is a successful outcome. The receiver does not fill gaps or argue for the proposal. See D-004 and C-003.

## Milestone 1

Implemented now:

- generic text import (`creator:` / `assistant:` / `other:` lines)
- normalized conversation
- draft edits and immutable publication
- PostgreSQL persistence for conversations, drafts, and published versions
- local Creator web UI for manual Handoff review and publication (`npm run dev`)
- receiver views without automatic source excerpts; explicit provenance lookup
- deterministic answerability and grounding
- fixtures for superseded exploration, unknown facts, explicit open questions, unsupported implications, transcript conflicts, creator edits, and published immutability

Not implemented:

- live model extraction or Receiver AI chat
- authentication, public sharing, or production-safe deployment
- ChatGPT, Claude, or Gemini export parsers
- scraping, web search, vector search, teams, billing, or a "Got it?" quiz

## Deferred privacy controls

These are requirements, not current behavior:

- raw transcripts stay private by default
- share identifiers become high-entropy opaque values
- receiver pages are not indexed by search engines
- the creator can delete imported data and handoffs
- provenance views show only the relevant excerpt

Secrets do not belong in source, Canon, tasks, or reports. Do not treat this milestone as a production privacy implementation.

## Checks

```bash
node tooling/governance/check.mjs
npm test
npm run test:application
npm run typecheck
npm run migrate
TEST_DATABASE_URL=... npm run test:integration
npm run build
```

Set `DATABASE_URL` for the Creator UI and `TEST_DATABASE_URL` for PostgreSQL-backed tests. See `.env.example` for placeholder variable names only.

The Creator UI is for local development only. Do not deploy it publicly without authentication and privacy controls.

The unit test suite does not need an API key.

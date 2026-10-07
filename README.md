# Hermeneus

Hermeneus turns a conversation in which a human developed an idea with an AI into a creator-reviewed, provider-neutral handoff that another human can check through a constrained interpreter.

It is not a chat product and does not reproduce ChatGPT, Claude, Gemini, or another provider's conversational UX. Source systems are providers. The working name is Hermeneus.

**Normative product rules live in `canon/`.** This file is descriptive, not authority. Start with `AGENTS.md` and `canon/state/current.md`.

## Authority inside the product

Published Canonical Handoff, then draft handoff, then normalized conversation, then raw imported source. Raw history is provenance.

Extraction proposes a draft. Only explicit creator approval publishes a version, and that version is immutable.

## Creator workflow (through Milestone 11)

- **Import & review:** Generic text import (`creator:` / `assistant:` / `other:`), normalized conversation, Creator review UI, draft edits, immutable publication (PostgreSQL).
- **Handoff Library:** Authenticated Creators open `/handoffs` to see only Handoffs they own, resume Review, or open the latest published version; `/new` creates another Handoff.
- **Live extraction (optional):** OpenAI-backed Handoff extraction suggestions when configured; deterministic fixture mode for tests.
- **Ownership & auth:** Creator session (dev cookie locally, Google OAuth via Auth.js in external mode); server-side Handoff ownership on every protected path (M9).
- **External identity (M10):** Google subject mapped to stable internal `creator_*` identity; no email authority or automatic linking.

## Receiver (M5–M7)

Version-pinned internal Receiver (`/receiver/[handoffId]/[version]`) and **Share Capability** bearer surface (`/share/[token]`) for external recipients. Deterministic interpretation by default; optional OpenAI semantic selection (M6) and grounded answer expression (M7) when configured. Receiver classifies questions as `SUPPORTED`, `DERIVED`, `OPEN`, or `UNKNOWN`.

## Checks

**Hosted CI:** Pull requests and pushes to `main` run the [CI workflow](.github/workflows/ci.yml) (governance, typecheck, build, deterministic Vitest suites, PostgreSQL integration, Playwright E2E, and a production-dependency audit with a **critical** threshold). Live OpenAI suites (`test:live-*`) are intentionally excluded from mandatory CI.

Use the Node version in `.nvmrc` (Node 20 LTS line; see `package.json` `engines`).

Local parity (PostgreSQL required for integration/E2E):

```bash
node tooling/governance/check.mjs
npm ci
npm run typecheck
npm run build
npm test
npm run test:application
npm run test:auth
npm run test:share
npm run test:receiver
npm run test:receiver-semantic
npm run test:receiver-answer
npm run test:extraction
npm run migrate
npm run test:integration
npm run test:e2e
```

Set `DATABASE_URL` for the app and `TEST_DATABASE_URL` for PostgreSQL-backed tests. See `.env.example` for variable names only (no secrets).

External Google OAuth requires `CREATOR_AUTH_MODE=external` and Auth.js variables in `.env.local` (never commit secrets).

The Creator UI remains intended for controlled deployment: use authentication, HTTPS, and privacy controls before any public exposure.

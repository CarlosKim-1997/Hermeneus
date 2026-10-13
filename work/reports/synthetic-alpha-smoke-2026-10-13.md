# Synthetic Alpha smoke checkpoint — 2026-10-13

This is work evidence, not Canon or release authority. The Free Supabase project is synthetic-only; the external verifier is off.

## Exact baseline and observations

- Git baseline: `origin/main` `42dce010deaed93b05c5cb277665e31df7eb2e9d`. This report and the accompanying UI/State edits are an uncommitted local diff on `codex/alpha-synthetic-smoke`.
- Vercel deployment `dpl_58MeTKwyCpPbtnr5rSfn8rNYKZ9d` reached READY in `icn1` from that baseline. An owner-provided screenshot showed an authenticated Creator and an empty Handoffs page. A runtime error query around that observation returned no errors. This verifies one interactive login and page load, not repeat login or the complete flow.
- Read-only counts in Supabase `dzaibwrrylxlrxbgnyaw` on 2026-10-13: two Creators, one external identity mapping, zero Handoffs, zero published versions, zero Share capabilities. No identity, content, or token values were read.

## Local verification of this diff

- `npm run governance`: PASS (read-only checker; required unsandboxed filesystem access after `realpath` EPERM in the sandbox).
- `npm run typecheck`: PASS.
- `npm test`: 11 files, 35 tests passed.
- `npx vitest run --config vitest.auth.config.ts tests/auth/external-session.test.ts tests/auth/auth-config-external.test.ts`: 13 tests passed.
- `npm run build`: PASS.
- `git diff --check`: PASS.
- Full `npm run test:auth` was not a valid pass without `TEST_DATABASE_URL`: 13 passed, seven skipped, three failed before DB access. `npm run test:share` skipped its DB-backed case. The local Docker engine was unavailable even after attempting to start Docker Desktop; no test used the shared synthetic database as a disposable fixture.

## Hosted checks still required

Use only synthetic claims and no real personal data. In the protected, authenticated deployment, verify the following against a single test Handoff, recording timestamps and result states without copying any Share bearer into a report or chat:

1. Sign out and sign in again with the same Google identity; confirm the existing Creator workspace resolves without a duplicate mapping.
2. Submit a portable proposal with a review note and optional private title. Confirm the note is displayed and acknowledged before Draft creation, absent after Draft creation, and the title is absent from Published Canon and Receiver Packet.
3. Review and publish version 1; confirm the Receiver Packet is v0 and the published version remains pinned.
4. Issue a `/share#token` link, open it in the authorized Receiver browser, and confirm the address bar clears the fragment before the server action. Verify no bearer appears in request-path logs and `/share/[token]` is unavailable. Revoke the capability and confirm subsequent access fails.
5. Verify Receiver question/answer and bounded verifier behavior with the external verifier still off; do not infer live-model quality.
6. Delete the synthetic Handoff and then the synthetic Creator account through the UI. Confirm old links and ownership access fail. Reauthentication must create a new lifecycle without recovering erased records.

The owner-authenticated browser session is not available to this agent. An earlier automated protected fetch was denied by approval review because it would create a temporary Vercel Authentication bypass URL; no alternate bypass was attempted. The hosted sequence therefore remains unverified. The future Pro/Small/PITR real-data target, backup/restore rehearsal, external participant access, and paid model evaluation are separate gates.

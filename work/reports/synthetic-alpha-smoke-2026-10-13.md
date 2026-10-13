# Synthetic Alpha smoke checkpoint — 2026-10-13

This is work evidence, not Canon or release authority. The Free Supabase project is synthetic-only; the external verifier is off.

## Exact baseline and observations

- Initial Git baseline: `origin/main` `42dce010deaed93b05c5cb277665e31df7eb2e9d`. This report and the accompanying UI/State edits were prepared on `codex/alpha-synthetic-smoke`, then integrated through PR #29. The observations below describe that initial checkpoint; the later checkpoint records subsequent verification.
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

## Subsequent owner smoke and security checkpoint

Observed on 2026-10-13 against `main` commit `2596fbc848f63d66b95b5a7b5d9828dca2125197`, deployment `dpl_6WZ7uyFoVUo4dCvjnGMxBsHRck9Z`, READY in `icn1`. [Main CI run 38353447028](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38353447028) passed `verify`, `postgres`, `e2e`, and `dependency-audit`; these used disposable CI databases. The deployment identity and CI result were rechecked at this checkpoint.

### Confirmed evidence

- The owner reported successful same-identity sign-out/relogin, mobile Bootstrap preview and acknowledgment, Draft creation/publication, Share open/packet preparation/revoke, Handoff erasure, and account erasure/relogin. These are owner acceptance observations, not independently captured browser traces.
- Read-only PostgreSQL statistics corroborated one Handoff/Draft/Published version created and deleted and three Share capabilities created and deleted. Subsequent counts found zero Handoffs, Drafts, Published versions, provenance, Share capabilities, source conversations, and source messages. Statistics are cumulative and do not timestamp individual UI actions.
- A first DB observation at about 06:32 UTC preceded the completed account-erasure observation. The subsequent query found the previous Creator and external mapping absent, one Creator and one mapping deletion in cumulative statistics, and a new mapped Creator created at 06:50:58.632 UTC. The remaining unmapped Creator is the `creator_legacy_pre_m9` migration seed, not a retained external login mapping. No provider subject was fetched.
- Vercel project inspection returned `ssoProtection.enabled=true`, `deploymentType=all`. Credential-free GET requests at about 07:37 UTC to `/share` on both the default alias and deployment-specific host returned HTTP 302 to `vercel.com/sso-api`. This confirms denial before the app for those requests; it does not establish authorized external participant access.
- Read-only grant checks found 11 app tables, zero `anon`/`authenticated` table-access pairs, and zero client-executable app-function pairs. `verifier_pilot_budget` has zero rows.
- Focused local tests on the same code SHA passed: `npx vitest run tests/receiver-packet.test.ts tests/receiver-isolation.test.ts tests/external-verifier.test.ts tests/external-verifier-consent.test.ts tests/external-openai-verifier.test.ts` — five files, 13 tests. The provider client is mocked; these checks make no external model call and use no shared database. They cover packet/privacy isolation, provider-unavailable `INDETERMINATE`, unsupported/ambiguous/incomplete-review gates, consent rejection, and bounded provider payloads with `store:false`.
- CI's `e2e/bootstrap-external.spec.ts` exercises an answer with the external verifier off and expects `INDETERMINATE`; `e2e/share-flow.spec.ts` captures browser request paths, checks fragment removal and the legacy token-path 404, asks a Receiver question, and verifies revocation. CI evidence does not substitute for the deployed Vercel/authentication boundary.
- Supabase's repeated SQLSTATE `3F000` errors came from `PostgREST 14.18`: `schema "pg_pgrst_no_exposed_schemas" does not exist`, still observed at 07:24 UTC. [Supabase's documented issue](https://supabase.com/docs/guides/troubleshooting/schema-pg_pgrst_no_exposed_schemas-does-not-exist) explains that disabling Data API leaves PostgREST running and can generate these log entries. No DB setting workaround was applied; this is separate from the previously fixed application connection/TLS errors.

### Remaining deployment checks

1. Confirm the one authorized external participant can enter the protected deployment, while an unauthorized account remains denied. Participant identity/access has not been observed at this checkpoint.
2. In a fresh browser context without Vercel SSO cookies, open a synthetic `/share#token` link, complete authorized Vercel authentication, and verify the fragment survives the authentication round trip until the app consumes it, then clears from the address bar. The owner's earlier Share-open test does not identify whether a fresh authentication redirect occurred.
3. Capture browser request URLs during that fresh synthetic flow and inspect infrastructure request paths in the same observation window. Store only redacted paths/counts and pass/fail, never the bearer. Current Vercel runtime-log queries grouped by request path returned no records; application runtime output is not a complete infrastructure access-log record. Empty results do not prove no token leak. Use a supported access-log view or explicitly report its unavailability.
4. Resolve the reproduced same-document Share navigation defect and recheck the final deployed artifact. The previously pending hosted provider-off Receiver checks were completed below.

Do not classify the whole hosted security gate as satisfied until these checks are resolved. The Pro/Small/PITR real-data target and isolated restore rehearsal remain unprovisioned/unverified. The separate OpenAI pilot requires provider project/key and spend controls plus synthetic live evaluation before activation; no paid-model evaluation or real-data use is established by this checkpoint.

## Agent browser verification and local remediation

The Chrome session could pass existing Vercel authentication; Google login with the existing owner account resolved to the same post-erasure Creator lifecycle. The in-app browser had no Vercel login session and stopped at its login page. No temporary bypass link or protection change was used. A fresh-authentication round trip remains unverified.

Between about 07:44 and 07:52 UTC, the agent created a synthetic source-free Handoff through the approved UI flow, explicitly opted into its private title, acknowledged the transient review note, and published version 1. It issued one synthetic Share capability, then observed:

- On an already-mounted `/share` page initially loaded without a fragment, navigation to the issued fragment left the unavailable view and retained the fragment. The production effect runs only on mount. This is a reproducible deployment defect, not an inference from empty logs.
- Reloading that fragment URL exercised initial loading successfully and cleared the fragment. The resulting shared view stayed pinned to version 1 and omitted Creator controls.
- Prepared Receiver Packet protocol was v0; it excluded the synthetic private title, review note, and bearer.
- A submitted synthetic answer with the provider off returned `INDETERMINATE` and the verification-unavailable notice. A deterministic question about the synthetic logo returned `SUPPORTED` with the approved statement. No external model call was made.
- After revocation, asking another question returned the generic unavailable message. The agent then permanently deleted only its newly created synthetic Handoff through the UI. A subsequent read-only query found zero Handoffs, Drafts, Published versions, provenance, Share capabilities, source conversations/messages, and pilot-budget rows.
- The Bootstrap Draft also incorrectly described absent provenance as “source erased” at item level, although the enclosing source panel correctly said not collected. The local copy fix uses the existing review-kind distinction. An obsolete “development” Share heading was also removed. These changes introduce no new source/retention policy.

Local remediation is on `codex/alpha-security-checkpoint`, based on `2596fbc848f63d66b95b5a7b5d9828dca2125197`. A lifecycle-bound fragment listener consumes later hash changes before server requests, clears old Receiver state during a new resolution, ignores late results/errors from superseded requests and unmounted effects, and retains the consumed token only in memory for development effect replay. Receiver state is keyed by the current capability so prior answers/packets cannot carry into a new link. No bearer is logged or persisted by the new helper.

Final local verification: six test files / 21 tests PASS, including eight navigation/replay/race/unmount cases; TypeScript and production build PASS. Internal read-only adversarial review found queued hash-event races; both were corrected and re-reviewed with no remaining actionable finding. Empty fragment events cannot revoke the already-consumed in-memory capability; server-side revocation remains authoritative. This review is not external independent assurance.

The Share E2E now starts with an empty mounted `/share` page before navigating to the issued fragment. The Bootstrap E2E now checks not-collected copy. These changed E2E cases have not run against a disposable DB yet: the local Docker engine is unavailable. Earlier CI belongs to the deployed baseline, not the new working-tree fix. Remote push, integration, and redeployment of this new fix have not occurred. The working-tree changes require their own CI and deployment verification before closing the hosted security gate.

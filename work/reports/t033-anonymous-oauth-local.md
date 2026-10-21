# T-033 — dedicated anonymous OAuth local verification

2026-10-21, synthetic/disposable local execution only.

## Authority and exact artifact

The owner approved the recommended dedicated anonymous issuer, separated from
Creator Google login, and formal recording of the already approved per-share
delegation policy. The explicit approval reply was received during execution.
Installed Governance, D-009/D-013 and C-005/C-006/C-008/C-009/C-012 retain their
meaning. D-015 supersedes D-008 locally; only the old status changes, not its body.
Current State identifies the local/deployed boundary and removes an obsolete
agent-browser availability explanation, without inventing provider-smoke evidence.

Integration basis: managed worktree `codex/scoped-mcp-local`, HEAD
`4e17be8c5d1e41be462022f51c148eae854584b1`. Read-only `git ls-remote` confirmed
the same remote main during this episode. T-032's staged predecessor delta was
preserved. T-033 is a subsequent local delta, not a retroactive T-032 permission.
The primary checkout's older main and unrelated UI/prototype edits were preserved.
The integration-ready package/lock belong to the managed worktree, not the older
primary package. `t033-oauth-artifacts.sha256` identifies the combined local artifact.
There is no new commit SHA, hosted CI run, PR or deployment to cite.

## Implemented

- `src/mcp/oauth.ts`: dedicated anonymous connection, predefined exact clients and
  HTTPS callbacks, bounded same-browser approval, ES256 RFC 9068 access tokens,
  exact issuer/resource/scope, no email/profile, no refresh and live-session checks.
  Public JWK fields are whitelisted and the supplied private/public pair is tested
  before startup. Creator keys/tokens are not imported or used as fallbacks.
- `oauth-http.ts`: default-disabled explicit Express factory using installed SDK
  authorization, token, revocation and MCP handlers. Discovery advertises only
  supported code/S256/none, no DCR or refresh, plus JWKS and RFC 9207 issuer responses.
  Strict duplicates/fields, Host, Origin, cookie/CSRF and input size checks; no
  request/error logging, body echo, analytics, external assets or durable UI state.
  Form-encoded MCP bodies are rejected rather than waiting on a parsed stream.
- The local browser approval accepts a pinned-origin original Share fragment link,
  extracts its secret only in memory and POSTs it in the body. A unique transaction
  cookie binds one connection/selected Share; no global current-Handoff slot exists.
  The receipt shows the version and non-secret contextRef, and an explicit callback
  link completes code exchange. The original web Share remains usable separately.
- `oauth-postgres.ts` / `oauth-schema.sql`: durable security metadata for one-use
  transactions/codes and expiring, monotonically revoked sessions. Raw Share,
  authorization code, access token, browser secret, answer/question/confirmation
  body and submission digest are not stored. Parent deletion cascades grant/code
  mappings; unrelated anonymous sessions survive. Cleanup functions remove expired
  and revoked rows; no production scheduler is configured or claimed.
- `PostgresOAuthMcpMetadata` joins the current session and parent lifecycle in the
  final grant read and atomic inspection-ticket consumption. Activation must use
  this issuer-specific adapter, not just T-032's generic metadata adapter.
- Candidate SQL remains outside `migrations/`; existing Next routes, app persistence,
  regular Alpha, fixed public synthetic MCP host and release workflows are untouched.
  No paid/semantic provider is wired into this widget: STRUCTURE_ONLY / INDETERMINATE.

Runtime additions beyond T-032: declare the already installed `express@5.3.0`
directly, plus development `@types/express@5.0.6`. SDK 1.32.1 and jose 6.2.12 remain
pinned. No auth framework/provider migration or external registration occurred.

## Final verification

Commands run from the managed worktree on Node 22.23.3:

| Check | Observation |
| --- | --- |
| Full `vitest run` | 201 passed, 23 files; includes 25 OAuth cases and existing 45 scoped/JWT/transport cases |
| `tsc --noEmit` | PASS |
| `tsc --noEmit -p tsconfig.mcp-local.json` | PASS |
| `scripts/test-scoped-mcp-local.ps1` | existing PostgreSQL 9 + OAuth PostgreSQL 7 + browser 8 passed |
| Installed Governance | structural PASS; semantic authority/permission review performed separately |
| Diff whitespace / preserved old D-008 body | PASS |
| Runtime dependency audit | 0 critical, 3 high, 1 moderate; inherited findings below |

Final isolated run: `dist/t033-verified-final.log`, with screenshots/results under
`dist/scoped-mcp-48a302639d8141c1ac5391fd3b55be64/test-results/mcp-local`.
Full unit result: `dist/t033-unit-final.log` (19:19 KST). Production audit:
`dist/t033-audit.json`. Final post-document verification is in
`dist/t033-final-checks.log`. The SQL/production OAuth sources in the successful
isolated run match the final artifact; the later unit-only test adds a focused
form-body/Creator-cookie rejection and metadata inspection assertion.

The runner copies an allowlist, excluding `.env`, Git state, profiles and deployment
secrets. It uses PostgreSQL 17 tmpfs on a unique internal Docker network and pinned
Playwright 1.63.0 image digest
`sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`.
It disconnects the browser container's external bridge after dependency preparation.
All task-owned containers/networks were removed; unrelated resources were untouched.
The candidate schemas were applied only there, following existing migrations 001–011.

## Internal adversarial review and corrections

This is Codex internal review, not independent third-party assurance.

1. Authenticated connection alone cannot read a Handoff. Test both contextRef-only
   and wrong-connection access; original Share possession and explicit browser
   approval create the exact grant. Creator cookies never substitute for OAuth.
2. Reject wrong/unknown client, callback suffix/query, audience/resource, scope,
   PKCE/plain/missing verifier, duplicate values, forged/missing/null Origin,
   missing/wrong cookie and CSRF. Return generic failures without raw request data.
3. Default SDK metadata advertises refresh. Compose its handlers with exact supported
   discovery instead; no refresh or dynamic registration endpoint is exposed.
   Add `iss` to successful and error authorization responses, preserving client state.
4. Eight independent AS workers race one PostgreSQL code: exactly one wins.
   Expired/reused codes and transaction replay fail. Wrong-client revocation cannot
   revoke another client's token; revoking one connection preserves the parent Share.
5. A live session check followed by a parent-only final query left an interleaving
   opportunity. The issuer-specific SQL now checks both in one snapshot. Negative
   tests revoke a session inside the final read/ticket consume and a parent inside
   atomic code consumption; no future Canon/result is disclosed by those operations.
   Revocation after a completed authorization snapshot cannot recall prior disclosure.
6. Initial browser fixtures lost Host/cookie headers: use loopback native HTTP and
   Playwright `allHeaders`, not an authorization bypass. A real Chromium observation
   then showed `Origin: null` on a no-referrer form POST. OAuth-only HTML uses
   `strict-origin`: only the HTTPS origin can enter Referer, never query/code/body.
   Exact Origin and nonce checks remain; MCP/answer responses retain `no-referrer`.
7. CSP `form-action 'self'` blocked a cross-origin cancellation 303. The denied
   response navigates to the exact registered callback with issuer/state using a
   nonce script plus explicit link fallback; form action remains self-only.
8. Browser verifies approval, cancellation, disconnect, exact original display,
   manual confirmation, conservative result, empty web storage, expiry, late output,
   parent revocation, literal HTML and failure/no automatic retry. URL observations
   contain no Share bearer, answerText or access token. This is a fixture host,
   not evidence of actual ChatGPT/plugin callback compatibility or platform log policy.

Earlier failed runs remain in `dist/t033-isolated.log`,
`dist/t033-isolated-final.log`, `dist/t033-browser-boundary.log` and
`dist/t033-verified.log`. They are failures, not passing evidence.

## Dependencies and remaining external boundary

Production audit findings are inherited from the base lock: next 15.5.26
(moderate), its postcss 8.4.31, sharp 0.35.4 and source-map-js 1.2.1 (high).
SDK/jose/Express introduce no reported production advisory in this observation.
This is not a zero-vulnerability or exploitability claim; triage before public
release remains necessary. Development findings are outside this production-only
audit claim. Required CI has not run on this unpushed artifact.

Before external activation, obtain the distinct permissions described in
`work/proposals/scoped-mcp-activation.md`:

1. Apply reviewed numbered metadata migration to synthetic Free target only and
   provision a separate least-privilege MCP DB credential. It needs read access to
   Share id/hash/target/revocation, Handoff id/owner, Creator id/lifecycle and Published
   key/snapshot only; CRUD on the six MCP security tables; no source/provenance,
   external identity lookup, Draft or Creator mutation/ownership/DDL privilege.
   Verify effective/public/default grants and lifecycle behavior under that role
   before connecting a live endpoint; the current local DB suite uses its fixture owner.
2. Provision a separate OAuth-protected synthetic MCP Alpha origin in icn1, with
   issuer at its exact origin and resource at `/mcp`. Inject separate ES256 signing
   key/JWKS kid, inspection key and DB credential through secure secret management.
   No Creator/OpenAI keys, random startup signing keys or raw secrets in source/logs.
   Apply platform rate limits and log/body redaction; observe a cleanup cadence
   within 24 hours, including cold starts and multiple workers. No new paid plan.
3. Register the actual private ChatGPT plugin's displayed client/callback, without
   guessing IDs or allowing arbitrary DCR. New access grants need action-time human
   confirmation. Test real-host success/cancel/revoke/expiry with synthetic Handoffs.
4. Finish the existing Share-page handover UI to the issuer. This local proof
   intentionally requires explicit link paste and contextRef handoff; it does not
   claim the final automatic cross-origin/new-Chat UX already exists. Carry no raw
   bearer/answer in redirect state or Chat URLs; preserve original Share access.
5. Separately authorize commit/push/integration/release for the combined reviewed
   T-032/T-033 delta and exact required CI. Existing web deployment protection,
   fixed synthetic plugin, real-data restrictions and semantic-call budget remain.

No such external action was performed. The local execution episode is complete;
external activation, seamless Share handover and actual private-plugin acceptance
are subsequent work, not silently satisfied gates.

Official protocol basis: [OpenAI authentication](https://developers.openai.com/plugins/build/auth),
searched and opened during this episode, plus installed SDK 1.32.1 sources. Local
tests, not the documentation, are the evidence for the behavior reported above.

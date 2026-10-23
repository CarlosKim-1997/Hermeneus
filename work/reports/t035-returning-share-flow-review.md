# T-035 returning Receiver flow review — 2026-10-23

Follow-up: browser acceptance is deferred at the owner's request. See
`work/reports/t035-browser-resume.md` for the current tool observation and restart
steps, and `work/proposals/t035-returning-flow-repair.md` for the repair draft.
The draft corrects the grant-only renewal suggestion below: D-015 requires explicit
reconnection and delegation after expiry. No product behavior was changed.

## Artifact and authority

Owner requested the proposed two-synthetic-Handoff flow check. Current main is
5825a889875a96645ac447de86debb924a350de1. Dedicated MCP deployment
dpl_3TGyxqFwea8NuvjbMAZfhQwAjvZD is READY and actual /api/ready returned
5532cef32947dae379cb133cee9cd2a44319b761, SYNTHETIC_ONLY, NOT_CONNECTED.
The two commits have identical application/deployment code; later Work records
do not establish additional live-host usability. T-034 remains closed.

This episode adds only local tests and Work records. No product code, installed
Governance, normative Canon, target DB, credentials, permissions, remote branch,
PR or deployment was changed. No paid provider was called.

## Evidence and limits

- Node22.23.3: `vitest run tests/mcp/returning-flow.test.ts tests/mcp/oauth.test.ts`:
  29 PASS, including two new real-loopback-HTTP OAuth/MCP scenarios.
- Node22.23.3: `playwright test --config playwright.mcp-local.config.ts`:
  12 PASS, including two new intercepted browser scenarios; generated
  test-results/mcp-local/.last-run.json reports passed with no failed tests.
- `tsc --noEmit -p tsconfig.mcp-local.json` and installed Governance: PASS.
- Existing actual browser binding was unavailable. Inventory returned no browsers;
  opening a fresh IAB tab also failed. These tests never contacted ChatGPT.
- Docker engine was initially unavailable. The official detached start was issued,
  but a later engine probe still failed and a hanging CLI status command was
  interrupted. Native bundled Playwright successfully ran the isolated HTTP/browser
  fixtures without Docker. No PostgreSQL/target-DB test is claimed for this episode.

Both synthetic Handoffs are distinct Published v1 records with deliberately
different statements: Friday web draft versus Tuesday purple print draft. This
avoids the earlier easier distinction between version 1 and version 2 of fixtures.
All browser URLs for issuer/ChatGPT domains are intercepted. External navigation
is aborted, no personal browser profile or actual service credentials are used.

## Verified paths

1. Two simultaneous windows expose distinct, explicitly selected offers even when
   both versions are 1. Authorizing B enables only B's new-Chat control; explicit
   authorization of A then enables A. References, packets and connections differ.
2. A's token cannot read B's reference and vice versa. A B-packet answer cannot
   be reviewed as A; A's review ticket cannot inspect B. Correct tickets produce
   INDETERMINATE/structure-only once, and cannot be replayed.
3. Original Share secrets, signed access tokens and answer bodies stay outside
   browser request URLs in these fixtures; landing storage remains empty.
4. A freshly approved reconnection issues a fresh reference; neither old nor new
   tokens inherit the other connection's grant. Original Share remains usable
   after its anonymous connection expires.
5. Existing browser regressions confirm original review, changed-input reset,
   late-result rejection, cancellation, disconnect and conservative inspection.

## Finding 1 — P1: repeated Share handover has no deterministic linking trigger

src/mcp/handover.ts:18 opens only the private plugin page. The landing enables
new Chat only after a delegated BroadcastChannel receipt (lines 23–24), and offers
its Share only after a new authorization transaction discovers it (line 21).
Opening the plugin page alone does not initiate such a transaction in our app.

The new browser characterization first approves A, then opens B with the same
browser cookies. In an explicitly labeled already-connected host model that does
not initiate OAuth again, clicking B's plugin button opens that host page but
creates no second grant, no receipt and no contextRef; B's new-Chat control stays
disabled. There is no deterministic recovery path in the landing itself.

This demonstrates our implementation's dependency on a fresh host linking flow.
It does NOT establish that today's live ChatGPT always behaves like this host
model. Earlier browser tests manually created the authorization request after
opening a dummy plugin page, thereby testing the handover after linking started,
not the returning user's ability to start it.

OpenAI's current Authentication documentation distinguishes selected OAuth
connections and additional account linking. It does not guarantee that opening
a connected plugin page starts a new per-Handoff authorization transaction:
https://developers.openai.com/plugins/build/auth . No email/OIDC/profile access
should be added merely to work around this usability gap.

## Finding 2 — P1: grant expiry does not surface a reconnection action

After the 30-minute grant expires, its OAuth session can remain valid until the
60-minute connection limit. The new test advances only its injected clock to the
exact grant boundary; it does not claim 30 minutes of live waiting.

The real SDK HTTP MCP call then returns HTTP200 with isError=true and
HANDOFF_ACCESS_UNAVAILABLE. It has neither WWW-Authenticate nor tool-result
_meta[mcp/www_authenticate]. src/mcp/server.ts:25–27 catches the grant failure
as a generic tool error; lines 68–70 challenge only failed connection authentication.
Therefore this grant-expiry path provides no auth challenge for the host to use
and no app-provided action for the Receiver to restart explicit delegation.

Security fails closed as intended. Usability is incomplete: a user should not have
to infer token/session/grant differences from the generic unavailable message.
Do not fix this by silently extending grants, inheriting them on a new token,
or declaring every unknown reference a successful authorization.

## Bounded proposed repair, not implemented or ratified here

Separate connection establishment from explicit authorization of this Share.
Provide a first-party action for an already authenticated, explicitly selected
connection to authorize the exact previewed Published version using its valid
browser proof and fresh one-use CSRF/nonce. Keep both absolute lifetimes, all
parent checks and the new non-secret contextRef. Do not guess the selected ChatGPT
account or choose a per-account current Handoff automatically.

When the connection or a grant expires, require explicit reconnection and fresh
per-Share approval under D-015. Display a clear waiting/expired/error
state and a concrete recovery action. Preserve the generic unauthorized server
surface, original bearer containment and answer non-persistence.

The exact existing-connection browser binding, account-selection UX and host
reconnect action must be reviewed before implementation. This report is a proposal,
not new authority or a permission to deploy. A reviewed fix needs negative tests
for connection/Share mix-ups, CSRF, expiry and silent grant inheritance, followed
by actual normal-Chat acceptance.

## Remaining live acceptance

Browser connection restoration was requested while independent work continued.
No response had arrived at report preparation. Still unverified on the actual
current ChatGPT UI: existing-connection entry for B, account selection with two
anonymous connections, grant-expiry recovery and explicit reconnection afterward.
Fresh live Share grants require action-time confirmation under the browser policy.
Local test success is not acceptance of this repeated-use flow.

Screenshots copied to the primary ignored dist directory:
- t035-two-v1-handoffs.png: selected B after explicit fixture-initiated OAuth.
- t035-returning-host-no-trigger.png: B waits without a delegated receipt.

Verdict: access/version separation PASS locally; repeated-use acceptance NOT READY.
Next valid work is a bounded repair proposal/implementation authorization and
actual host replay when the browser is connected. No new policy decision is
established by the findings alone.

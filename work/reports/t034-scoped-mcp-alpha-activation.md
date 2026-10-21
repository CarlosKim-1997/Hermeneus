# T-034 scoped MCP synthetic Alpha activation

## Scope and authority

Owner application authorization on 2026-10-21 covers synthetic-target migration,
dedicated least-privilege credentials/keys, separate deployment, private ChatGPT
connection and Git integration/release. The owner separately confirmed that only
the new MCP Production loses Vercel SSO and uses application OAuth. Preview SSO,
the regular web Alpha and the fixed synthetic MCP service remain unchanged.
D-015 is the product authority; this report cannot enlarge it.

## Integrated foundation

PR [53](https://github.com/CarlosKim-1997/Hermeneus/pull/53), head
`8af637578a6109682ad72fdab97a3240e5de454b`, merged normally as
`cbd73e804bdd2e990f62134ab1c8e020fda6f0e0`.
All four required jobs passed on
[PR CI 39586400381](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/39586400381)
and [main CI 39586783900](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/39586783900).
The existing web release
[39587077704](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/39587077704)
succeeded. This foundation release did not mount a live MCP route.
Observed GitHub checks are strict verify/postgres/e2e/dependency-audit with zero
required approval reviews; no branch protection change or admin bypass was used.

## Activation implementation and local evidence

- Migration 012 promotes the six previously isolated security tables. A dedicated
  NOINHERIT/non-superuser/non-bypass/non-DDL role reads only the necessary columns
  of Share/Handoff/Creator-lifecycle/Published tables and has CRUD only on those
  security tables. All six have RLS and a service-role policy; PUBLIC/anon/
  authenticated receive no grants. No original message, private title, identity,
  Draft/provenance, answer/question/consent body or submission digest is stored.
- The runtime requires the literal synthetic project, pooled custom role,
  issuer/resource and separate signing/inspection keys. URL query options cannot
  override TLS certificate verification. Empty client registration fails closed.
- Share UI sends its fragment only to the separate first-party handover window;
  that window removes the fragment immediately. Same-origin BroadcastChannel
  memory, per-window selector, explicit selection, transaction nonce and bearer
  fingerprint bind the chosen Share to OAuth. No global current-Handoff slot,
  browser storage, Chat URL secret or model argument secret is introduced.
- The prompt in a new Chat contains only a non-authorizing contextRef. The host
  plugin still must be connected/selected. The receipt says preparation, not
  successful host authentication. The widget remains STRUCTURE_ONLY and cannot
  claim semantic ALIGNED or call a paid provider.
- Internal adversarial review covered host/issuer/resource, CSRF/cookies, exact
  client/callback, expiry, one-use code/ticket races, parent/session rechecks,
  multiple open Shares, selected-answer isolation and restricted DB privileges.
  This is internal review, not third-party assurance.
- Node 22 local unit run: **208/208 PASS**; normal and scoped TypeScript checks
  and installed Governance checker PASS (`dist/t034-unit.log`).
- Isolated PG17/Node22/Playwright run: existing scoped DB **9/9**, OAuth DB **8/8**,
  browser **10/10 PASS** (`dist/t034-isolated.log`). OAuth operations run under
  the actual restricted role, not its fixture owner; forbidden reads/writes/DDL
  return PostgreSQL 42501. Two new browser cases exercise ephemeral handover and
  selecting only one of two open Shares. The task-owned containers were removed.
- React review: server supplies a literal nonsecret origin; secret transfer is
  an explicit click handler behind the disclosure checkbox. No new storage,
  render-time side effect, fetch waterfall, whole-history read or dependency.

## Observed external preparation (2026-10-21)

Target `dzaibwrrylxlrxbgnyaw` only, Seoul Free synthetic project:

- Before apply: schema/role/history 012 absent. Applied exact reviewed 012 SQL and
  app schema-history insert atomically under the repository advisory lock.
- After apply: app history 012 present; all six tables have RLS. Dedicated role
  has no superuser/bypass/createdb/createrole/replication privileges. Source read
  and Creator update are denied. It was provisioned with an independent random
  password via a SCRAM verifier, connection limit 8 and 15-second SQL/idle timeout.
  Plaintext password and private keys are not in SQL, Git or this report.
- Actual dashboard Connect dialog reports shared transaction pooler
  `aws-0-ap-northeast-2.pooler.supabase.com:6543`. Data API remains disabled.
- Security advisor reports seven pre-existing public trigger functions with
  mutable search_path; migration 012 creates no such functions. This is not a
  clean-advisor claim. Remediation reference:
  [function search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- pg_cron enabled. Scheduling the cleanup through connectors repeatedly returned
  Invalid/expired requestState; observed job list remained empty. The exact
  `ops/mcp-alpha-cleanup.sql` schedule is staged in the target SQL UI pending the
  browser tool's action-time deletion confirmation. It deletes expired/consumed/
  revoked MCP security metadata, plus only this job's execution records older
  than 24 hours. It does not delete Canon, answers or Creator data.

New CarlosLab Hobby project `hermeneus-mcp-alpha`,
`prj_I6s9iH2UuzljwXdW2NZhuiBJY8q0`, Node22/icn1, root deploy/mcp-alpha:

- Owner-confirmed Production application-OAuth boundary applied; Preview SSO
  retained (`deploymentType: preview`). Existing web/fixed synthetic settings
  unchanged. No new paid plan.
- Independent DB URL, ES256 private JWK and inspection key registered as sensitive
  Production variables. Exact synthetic issuer/share-origin flags and initially
  empty client list registered. No Creator Google/OpenAI key reuse.
- No deployment/host acceptance yet. Intended issuer is
  https://hermeneus-mcp-alpha.vercel.app; actual alias/build/DB/TLS readiness still
  requires observation. Local Vercel CLI credential is invalid; connectors are
  used for the authorized deployment instead.

## Remaining acceptance and recovery

Run exact activation CI before normal merge; deploy and verify the actual alias,
discovery/JWKS/401 and restricted-role readiness. Read the actual ChatGPT callback
from its private-plugin form, configure only that client with code/PKCE S256 and
both scopes, then obtain the browser action-time confirmation at final creation.
Configure the resulting private plugin URL and enable the web handover only after
host acceptance. Verify actual synthetic read/review/revoke/expiry, cleanup runs
and request-log boundaries. Until then T-034 remains IN_PROGRESS.

Recovery is fail closed: keep client allowlist empty or disable the new runtime;
hide the web handover flag; revoke the dedicated role LOGIN if necessary. Do not
drop the additive tables, weaken the existing web authentication or replay erased
user data. Private-key compromise needs deliberate key revocation/rotation.
Real data, paid semantic calls and target backup/PITR readiness remain separate.

## First hosted activation observation

PR 54 head `556f1da6e252e572177d58aa9d31651bb948efdb` passed all four jobs
in CI 39614838589 and merged normally as
`5c6edac4f257f207a55dac2e7212b5a4cbf40cbb`.
Vercel `dpl_GtbY1iDpQmuiHd7vYNbe2w3FtbiB` reported READY in icn1 and mapped
the exact intended primary alias, but actual endpoint probes returned invocation
500. This is a failed activation, not host acceptance. Build logs show that the
nearest function package installed no root dependencies, then emitted missing
SDK/jose/pg/Express/type errors while still marking the build READY. Runtime log
queries returned no records and are not evidence that the failure did not occur.

Correction: the nearest package now has the documented Node `vercel-build` hook
that installs the pinned root lock with dev type dependencies and runs the scoped
TypeScript gate. The runtime uses native IncomingMessage/Express; disable Vercel
Node helpers explicitly to preserve its raw request-body handling. Clients remain
empty and the web handover flag remains off during repair. Relevant reference:
https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration .
Performance advisor additionally reports two new informational missing FK indexes
on MCP approvals/tickets; these are bounded synthetic tables, not a new security
warning. The seven mutable-search-path trigger warnings predate migration 012.

The final build hook uses scripts/build-mcp-alpha.mjs and process.execPath for
both npm and TypeScript subprocesses; it refuses runtimes other than Node22.
This avoids Windows npm.cmd selecting its bundled Node24 despite the parent
Node22 invocation. The final Node22.23.3 build hook exited 0. CI verify now uses
that same deployment hook as its install step. NODEJS_HELPERS=0 was set only on
the new MCP Production. The first hosted failure remains unaccepted evidence.

## 2026-10-22 continuation

Owner supplied the action-time cleanup confirmation. The staged SQL UI executed
successfully; cron job 1 hermeneus-mcp-metadata-cleanup is active at */15 * * * *.
Its first scheduled-run evidence is still pending. Screenshot in local ignored
dist/t034-cleanup-scheduled.png corroborates schedule creation, not a completed run.

PR55 exact head 9e2fc51a2cbd81a6c7f68beb4b4a8e47308b5e5d passed all four required
jobs in 39616348040. Auto-review initially used stale queued evidence; fresh
required-check reads proved PASS, then normal merge succeeded as
25d62a3d15ea2705c2d7cc96dfd56f6c9b2b1443. No protection bypass or change.
MCP deployment dpl_4k671tSFmqAanueN1kGfD9Nju4BM builds without the former missing
module/type errors and serves the correct primary alias in icn1. Actual probes now
return the application's generic 503, so initialization is not yet accepted.
All nine expected new-project Production variables are present; sensitive values
were not retrieved. Client allowlist remains empty; web handover stays disabled.

To resolve the actual startup failure, add fixed stage and whitelisted cause
categories to operational logs, never an exception message, URL, SQL, key or
request body. Failed initialization closes its DB pool. Focused runtime tests
include arbitrary-detail redaction and generic failure behavior; 9/9 PASS.

Cleanup run 1 succeeded at 2026-10-21 15:30:00 UTC (2026-10-22 00:30 KST),
return_message DO, observed through cron.job_run_details. The schedule is active.
PR56 head 1bfb46508202b9c60bf3b8b754c84f671b6d8ffc passed all four checks in
39625332923 and merged as 98c21a0a42d4a4c500aaff27e6225ec9fb67b9dd. Its deployment
is dpl_GhjrdKEQxruHwZJKkuzCNYwEPZjF; generic initialization 503 persists and log
queries still returned no records. Do not infer a cause from absent logs.

A credential-free Node22 PostgreSQL TLS probe to the actual Seoul pooler failed
with SELF_SIGNED_CERT_IN_CHAIN under default roots. The project's Database Settings
Download certificate link provides this public provider CA:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt .
Browser download event timed out; the same observed HTTPS file was fetched directly.
X509 checks: CA=true, self-signature valid, Supabase Root 2021 CA, validity through
2031-04-26, SHA256 fingerprint
80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA.
A second credential-free TLS probe using only this CA and hostname verification
succeeded, authorized=true, peer CN *.pooler.supabase.com, issuer Supabase
Intermediate 2021 CA. The Vercel startup cause is still not independently logged.

Register the public CA as MCP_DATABASE_CA_CERT only on the dedicated MCP project.
Runtime pins its fingerprint/CA validity and exact observed aws-0 Seoul host/6543;
pg retains rejectUnauthorized=true. Do not disable certificate or hostname checks
and do not change the OS/global trust store. A valid unrelated root is rejected.
The public certificate is a test fixture, not a private key. Local Node22 units
212/212, scoped types and Governance PASS (dist/t034-ca-unit.log).

After a normal ChatGPT UI reload, the actual new custom-MCP callback loaded as
https://chatgpt.com/connector/oauth/HhtKfq0OQ3jX . Only this exact redirect was
registered for public client hermeneus-chatgpt-alpha; no secret/OIDC/email scope,
DCR or wildcard. The creation form has both handoff scopes and PKCE S256 set;
final private-plugin creation/access confirmation has not yet been requested or
performed. Existing public client configuration alone creates no Share grant.

PR57 head 323884fb435dfdea74d4b57681faf39e2bbc9580 passed four required checks
in 39626810961 and merged as 65b3808c9aa58a8f4bff4c6d707bdc283b3570bc.
MCP dpl_G9GGLSTX1pv7YSx91PcnCB4sBQs8 now returns actual readiness 200 with that
commit, synthetic-only, one predefined client and semanticProvider NOT_CONNECTED.
Issuer/resource metadata and public-only JWKS return 200; unauthenticated MCP is
401 with the exact resource challenge, unknown client is 400. CA validation was
not weakened. Main/web release validation is observed separately from this host.

Live fixture preview exposed a distinct integration bug: original Share bearers
use hsh_ plus a secret, while the new handover had reused the 43-character OAuth
selector/nonce validator. Earlier browser fixtures used unprefixed opaque test
values, so those passing fixture checks did not establish original-Share format
compatibility. No plugin or delegated grant was created by this failed attempt.

Fix only the scoped bearer boundary to the existing Share prefix/format with a
512-character request bound. Keep all OAuth selectors/nonces at 43 characters.
Manual link paste, fragment intake and BroadcastChannel bearer checks now agree.
Browser helpers use the actual generateShareToken function. A new restricted-role
DB regression previews an actually issued capability, excludes raw/private fields,
rejects a bare OAuth nonce and creates no delegation. Local units 212 PASS;
isolated scoped DB 9 + OAuth DB 9 + browser 10 PASS, types PASS. Exact logs:
dist/t034-prefixed-unit.log and dist/t034-issued-share-regression.log.
The initial named live fixture has not been delegated; its invalid test capability
will be revoked and replaced using the actual app token format for acceptance.

## Final ChatGPT callback and locale compatibility

Owner action-time approval confirmed the actual stable callback
https://chatgpt.com/connector_platform_oauth_redirect, private plugin creation and
one prepared synthetic Published v1 read/review grant (connection <=60min,
grant <=30min; no paid verification). The exact redirect replaced the obsolete
pre-discovery redirect; dpl_CvoUVE7RRBE8aQgQwRu5jT4vMbrF serves main
44e1a03512ccbfb2103439971ed82325bf285aeb with actual readiness 200. Its main CI
39629134448 and regular web release 39629544526 both succeeded.

The actually issued hsh_ Share preview succeeded, removed the fragment and exposed
only the safe v1 summary, excluding its private navigation title. ChatGPT's final
OAuth request included ui_locales=ko-KR; our unknown-input guard rejected this
presentation hint before creating a transaction. No scoped connection/grant or
roundtrip success is claimed from that attempt.

Allow only a bounded language-tag list as this optional hint, ignore it for all
authorization decisions, and neither reflect nor persist it. Other unknown keys,
duplicates, URL-like/empty/oversized hints remain rejected. Exact registered
client/redirect/resource/scopes, PKCE and CSRF checks remain intact. Internal
adversarial review examined parameter pollution, injection, identity/scope bypass
and metadata persistence; the targeted 26-test OAuth suite and scoped types PASS.
This is interoperability within D-015, not OIDC identity or new authority.

## Actual private-plugin scoped acceptance, 2026-10-22 KST

PR59 head 29499f99657ca96e0c8698d302c7d079daa0fb3d passed four required jobs in
39630953943 and merged as 2542f8d1b0693d00811a5331d79b1cf3284791e1. Main CI
39631414685 succeeded. Dedicated MCP dpl_4L7YkaqRL2kxq79Xd6wZy6iRR55b was READY
in icn1; actual /api/ready returned that SHA, SYNTHETIC_ONLY and NOT_CONNECTED.

Created only the private plugin Hermeneus Scoped Alpha:
https://chatgpt.com/plugins/plugin_asdk_app_6ad8e1087cfc8191a698657416e5c290 .
Its URL is configured only on the dedicated MCP Production. The real ChatGPT
request with ui_locales=ko-KR reached approval, discovered the consenting v1
landing window, selected that one offer and completed the exact registered
callback. DB observation: one grant, 30-minute grant, 60-minute connection,
authorization code consumed. The original Share remained outside the Chat URL,
model prompt and tool arguments; the new Chat received only a non-secret selector.

Actual normal Chat https://chatgpt.com/c/6ad8e302-3ab8-83ee-b25c-cc917c919d42
called get_handoff_packet and displayed the two pinned Canon statements with
CONFIRMED/OPEN distinguished. The explicitly selected two-sentence answer with
its newline and HI citations returned through review_handoff_answer to the widget.
Agent compared the visible original, checked confirmation and clicked inspection.
The widget displayed INDETERMINATE / semantic verification not executed, structure
and pinned version confirmed, and disabled repeat inspection. DB had one consumed
ticket and no answer/question/submission/confirmation body columns in the six MCP
security tables. This does not assert that ChatGPT has no copies or retention.
Local ignored screenshot: dist/t034-live-scoped-widget-result.png.

The web Production-only HERMENEUS_MCP_ALPHA_ORIGIN flag now points to the exact
MCP origin. Existing automatic release 39631810425 attempt 2 succeeded, promoting
dpl_5rWsAuCe5hkQ68WGtpS2sDcDbmVx at the same 2542f8d commit after readiness and
temporary-access cleanup. The actual protected web Share showed the new explicit
connection control; its click opened the v1 first-party handover with fragment
removed and consent unchecked. No grant was created just by this preview. Web
Vercel all-deployment SSO remained enabled, and an unauthenticated request was
302 to vercel.com. The original fixed synthetic plugin was not modified.

Negative live-host checks:
- Set only the named test grant's expiry to the past, preserving the valid schema
  interval. This is forced registry expiry, not a claim of waiting 30/60 minutes.
  A fresh real Chat tool call returned HANDOFF_ACCESS_UNAVAILABLE.
- Started a second ChatGPT authorization and pressed Cancel before selecting any
  Share. ChatGPT returned access_denied; session count stayed one and no active
  grant appeared. No second connection was approved.
- Revoked the one named test client's sole connection in security metadata. A real
  Chat tool call surfaced ChatGPT's reconnect requirement; chose Later, with no
  new sign-in or delegation. This is administrative registry revocation, distinct
  from the locally tested browser-cookie disconnect and token revocation paths.
- Revoked the named synthetic parent capability. A fresh first-party handover
  preview failed closed; both test capabilities are now revoked. Closed the Share
  and landing test tabs and discarded the raw bearer from agent memory.

Cleanup natural runs at 15:45 and 16:00 UTC also succeeded. No paid semantic API,
real data or new plan was used. Observed ChatGPT global custom-app CSP enforcement
was off; it was not changed because it affects other apps. Local widget CSP
metadata/negative tests do not establish enforced host CSP in this setting.
Infrastructure logging/privacy remains a separate unproven boundary.

## Final proxy-throttle correction

Post-flow runtime logs exposed SDK express-rate-limit validation warnings for
Vercel Forwarded/X-Forwarded-For with Express trust proxy false. There was no
observed authorization failure or request-body disclosure in those warning lines.
Keep proxy trust disabled; explicitly key each endpoint's existing limiter to a
conservative shared warm-instance bucket. Keep SDK windows/limits (authorize100,
token50, revoke50 per15min), validation and enforcement enabled. Rotating spoofed
forwarding headers cannot create fresh buckets. This is neither per-user fairness
nor a distributed abuse limit; broad rollout needs separate capacity assessment.

Internal adversarial review examined spoofed IP bypass, cross-endpoint counters,
threshold off-by-one and authorization changes. Focused Node22 OAuth suite 27/27,
including the unchanged successful exchange/inspection and negative security flow,
and scoped TypeScript PASS. A new test observes 429 after100 authorization and50
token/revoke requests despite rotating forged forwarding headers, with no session
issued by invalid requests. This correction changes request grouping only; the
actual full ChatGPT success above is explicitly bound to 2542f8d. Final hosted
CI/deployment identity and forward-header probe are reported in the final handoff.

## Final artifact observation and closure

PR60 final head 2498b0a6888bd28e429e86d71c00055e95ca76ea passed all four required
jobs in 39634031448, then merged as 5532cef32947dae379cb133cee9cd2a44319b761.
That exact main CI 39634523337 also passed all four jobs. Dedicated MCP deployment
dpl_3TGyxqFwea8NuvjbMAZfhQwAjvZD is READY in icn1 and /api/ready returned exactly
5532cef, SYNTHETIC_ONLY and semanticProvider NOT_CONNECTED.

Small public boundary probes on that deployment included forwarding headers:
authorization page 200 with approval form and limit100; unissued authorization
code exchange 400 with limit50; unissued token revocation 200 with limit50.
They created no connection or delegation. The scoped error-log query since10m
returned no records after these probes; that observation is not proof of complete
log coverage or of absent infrastructure data retention.

Final metadata observation before the public probe: zero active test-client
sessions, zero active test grants, zero unrevoked test capabilities; scheduled
cleanup remains active. The probe's unapproved transaction expires in60s and is
covered by that cleanup. No new keys or grants were created for the final probe.

T-034's synthetic activation criteria are satisfied. This closure changes only
Work records; it does not expand D-015 or claim semantic verification, real-data
readiness, distributed abuse protection, or enforced global ChatGPT CSP. The
previously listed real-data gates and repeated/multiple-share user-experience
acceptance remain separate. Existing web automatic release 39634914836 was
in progress when this record was prepared; observe its external result rather
than treating this Work record as release evidence.

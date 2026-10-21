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

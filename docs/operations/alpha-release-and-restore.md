# Synthetic Alpha release and restore verification

Non-normative operations guidance. Installed Governance, active Canon and the
owner's action-specific authorization govern. This workflow is limited to the
existing CarlosLab synthetic-only Alpha; it does not change data policy or
authorize migration, real-data use or paid resources.

## Activation prerequisites

The workflow is inert unless repository variable `HERMENEUS_ALPHA_AUTO_DEPLOY`
equals `enabled`. Prepare and verify these settings before enabling it:

1. Review/integrate the exact change through the existing required CI checks.
2. Create GitHub environment `synthetic-alpha`, restricted to branch `main`.
   No new required approving reviewer is imposed by this change. Preserve actual
   branch protection and the four required checks.
3. The owner creates a CarlosLab-scoped Vercel token with an appropriate expiry
   at [Vercel tokens](https://vercel.com/account/settings/tokens) and saves it
   directly as that environment's secret `VERCEL_TOKEN`. The agent's connector
   login is not a credential available to GitHub runners. Never paste the token
   into chat, repository files, workflow arguments or logs.
4. Confirm existing project protection covers all deployments, region `icn1`,
   production environment settings, disabled external verifier, and synthetic DB
   schema readiness. Confirm no parallel Git-triggered/manual process assigns
   Alpha domains before the Gate; this workflow cannot gate unrelated deployers.
5. Enable the variable only with explicit unattended synthetic-release approval.
   A new successful main push CI triggers the first release; rerunning an old CI
   whose SHA differs from current main is rejected. Inspect that first hosted run
   and exact deployment before claiming activation verified.

Settings: [GitHub environments](https://github.com/CarlosKim-1997/Hermeneus/settings/environments),
[repository variables](https://github.com/CarlosKim-1997/Hermeneus/settings/variables/actions).

## Release sequence and failure boundaries

The no-deployment-secret selection job validates the CI event and fetched run:
exact repository, push to main, current main SHA, current run attempt, expected
CI workflow path, and exactly one successful result for each of `verify`,
`postgres`, `e2e`, `dependency-audit`. No PR/fork artifacts are downloaded.
Credentials are bound only to staging/probe/promotion steps after checking out
that verified main SHA with persisted GitHub checkout credentials disabled.

Vercel CLI 63.1.2 is installed without the deployment secret. The remote build
uses the linked project's production settings and `--prod --skip-domain`:
fixed `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` bind the project. Avoid a redundant
`--scope` slug lookup: CLI 63.1.2 queries the personal user for it, which failed
with 404 during the first scoped-token release. Before staging, check the
credential against the exact protected project API; never print the response or
credential. Token compatibility is verified by the actual hosted release.
The owner approved a synthetic-only generated-alias exception on 2026-10-14:
only `hermeneus-alpha-synthetic-carloslab.vercel.app` may follow candidate
uploads before readiness. Do not use it as a participant/service address.
Vercel automatically generates that CLI project/scope URL even with
`--skip-domain`; its [URL contract](https://vercel.com/docs/deployments/generated-urls)
describes it. `hermeneus-alpha-synthetic.vercel.app` is the sole service address.
Capture its deployment ID before staging; reject project/name/redirect mismatch,
and require the mapping unchanged before readiness and immediately before
promotion. Reject all other candidate aliases, including the primary domain.
The Gate checks deployment
owner, project, production target, SHA metadata, READY state, Seoul region and
only the exact allowed generated alias; it also checks all-deployment project protection.
The CLI metadata is tied to the workflow's exact clean checkout; it is not a
third-party attestation of arbitrary uploaded files.

On this new staged deployment only, the probe creates temporary URL access with
a five-minute TTL. Deployment share tokens require `_vercel_share` URL access;
they are not project-wide `x-vercel-protection-bypass` automation secrets. The
probe uses that URL only at the exact inspected deployment's `/api/ready`. If
Vercel responds 307, it accepts only the same exact clean readiness URL and one
well-formed `_vercel_jwt` cookie, then makes one request with that cookie. Foreign
origins, other paths/query strings, missing/duplicate/malformed cookies and further
redirects fail closed. API bearer credentials never enter either app request.
It requires 200, private/no-store, and exactly `{"status":"ready"}`.
The short-lived Vercel share token can appear in provider request-query logs;
the probe never prints its URL, token, cookie or error body. It is not a
Hermeneus Share bearer, and no product Share token is involved in this probe.
Finally it revokes its own access and checks the returned map. An unexpected
response or failed cleanup stops promotion. API errors print a generic message,
not the response or secret. A killed runner may skip cleanup; the created access
expires after five minutes. If creation has an unknown outcome or multiple keys
are returned, investigate the deployment's access configuration before retrying;
do not revoke another operator's secret.

Immediately before promotion, recheck current main/CI and inspect the same
deployment/project and the captured primary mapping again. Promote that existing production artifact with the
[official same-artifact API](https://vercel.com/docs/rest-api/projects/point-production-traffic-to-a-given-deployment),
one POST to the fixed project/team/deployment endpoint with an empty body and no
forced-check bypass or preview rebuild, then poll the primary mapping for up to
two minutes (bounded individual requests). Only the captured prior or target
mapping is accepted while waiting. Failure/unknown outcome requires inspection;
never retry the POST automatically. The CLI is used only for staging; its
separate promotion account-context path failed in the hosted pilot. Release jobs are serialized without
cancellation. There remains a small race between the last main read and the
provider's promotion request; a later CI will release the next SHA. GitHub's
serial group does not serialize a separate human release process.

503, redirects, stale SHA, wrong target, failed CI or cleanup leave current
primary domain untouched by this workflow. The generated base alias may already
serve an unverified candidate under the approved synthetic-only exception.
A staged artifact can remain for
operator inspection. No database migration, fallback bypass, automatic rollback
or automatic promotion retry runs here. A promotion timeout has an unknown
outcome: inspect deployment, aliases and promotion state before retrying.
Disabling the variable prevents future starts; an already running release must
be inspected/stopped separately. Readiness checks configuration/history, not
OAuth round trips, user flows, physical schema integrity or recovery compliance.

Provider references: [staged deployment](https://vercel.com/docs/cli/deploy#skip-domain),
[promotion](https://vercel.com/docs/cli/promote),
[temporary URL access](https://vercel.com/docs/rest-api/aliases/update-the-protection-bypass-for-a-url).

## Disposable logical restore rehearsal

`tests/integration/logical-restore.test.ts` runs in the existing PostgreSQL CI
job using its container ID. Locally use a freshly created PostgreSQL 16 container
on loopback, set `TEST_DATABASE_URL` to it and `TEST_POSTGRES_CONTAINER` to its
exact ID, then run:

```text
npm run test:integration -- tests/integration/logical-restore.test.ts
```

It verifies that the container and local connection have the same PostgreSQL
system identifier, creates two unique empty databases and migrates only the
new source. It seeds synthetic sources/Drafts/Published versions and lifecycle
fixtures, takes a custom-format `pg_dump`, and restores into the other empty
database using `pg_restore --exit-on-error --single-transaction`. ACLs/ownership
are retained; no `--no-privileges` or trigger-disabling shortcut is used.
It compares all public-table rows, effective table ACLs, function definitions/
ACLs and default privileges, then challenges published/owner immutability,
monotonic erasure, revocation, erased-Handoff absence and PUBLIC table denial.
It verifies that `anon`/`authenticated` cannot access existing or future tables
and functions. Missing NOLOGIN fixture roles are created only in the disposable
cluster and removed after dropping its test databases; existing roles are not
altered. The fixture uses the same database owner and cluster roles. It is not proof
that a different Supabase target recreates roles, passwords, platform settings,
Data API shutdown, client-role grants, storage objects or PITR configuration.

The test deliberately deletes/revokes additional synthetic records *after* the
backup. The restore contains those older records despite passing readiness.
Keep any real recovery target disconnected from application traffic and Share
access until an authorized operator reconciles later erasure/revocation events
and verifies ownership, identities, grants, Data API and runtime settings. The
current repository has no durable recovery ledger for those events. Do not
reconnect a stale snapshot merely because `/api/ready` returns 200. Choosing
such a ledger or changing retention/deletion guarantees requires human review.

Cleanup drops only the two test-created database names and removes their unique
synthetic archive, then the local operator removes the exact owned disposable
container and its anonymous volume. No shared target or real data is copied.
CI's service teardown removes its container. Missing local/container settings
skip this test; a skipped run is not evidence of restoration.

Local timing is an experimental observation, not an approved RPO/RTO. This
logical rehearsal does not provision or verify paid Supabase PITR, define backup
retention, or clear the real-data deployment Gate.
[Supabase backups](https://supabase.com/docs/guides/platform/backups) remain the
reference for those separately authorized target checks.

# T-023 readiness integration and synthetic Alpha release

Non-normative evidence, observed 2026-10-13. Owner explicitly approved commit,
push, PR integration, Node 22 CI and synthetic Alpha deployment verification.
No shared DB mutation, paid model call or protection-rule change occurred.

## Artifact and authority

- Repository: `CarlosKim-1997/Hermeneus`.
- Implementation PR: [#34](https://github.com/CarlosKim-1997/Hermeneus/pull/34).
- PR HEAD: `ae9c0e4c029d5cf40b49297a89dd003d9d5b499c`.
- Tested PR merge candidate: `77c7963efc355cb4d1bf6c2edeb05212be9899fe`.
- Integrated and deployed main: `7b014fe3d07ffbde13db6b4c2f84b7d7e9b90749`.
- Observed main protection: strict required checks `verify`, `postgres`, `e2e`,
  `dependency-audit`; zero required approving reviews. Normal merge, no admin
  exception. GitHub review requirements are distinct from internal code review.
- T-022 remains the terminal local implementation episode. T-023 records the
  separately approved integration/release scope; no historical authority rewrite.

## Hosted verification

| Run | Checked artifact | Result |
| --- | --- | --- |
| [PR CI 38386670996](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38386670996) | Required checks associated with PR HEAD; checkout of temporary merge candidate above | Four required jobs PASS |
| [Main CI 38387114454](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38387114454) | Exact integrated main SHA above; verify job records that SHA | Four required jobs PASS |

Setup-node logs show Node 22.23.3. Main logs report unit 55, auth 72,
integration 112 and Playwright 15 tests PASS; the additional deterministic
application/Share/Receiver/extraction suites also passed in `verify`. Postgres
and E2E used disposable CI PostgreSQL 16 databases. Dependency audit passed
the configured critical-severity gate; this does not assert zero lower-severity
vulnerabilities. The implementation's adversarial self-review and local negative
test evidence are in `t022-local-verification.md`.

## Deployment

- Team: CarlosLab, `team_ll3FPTKyAnl8VYk0CqJ90tHV`.
- Project: `hermeneus-alpha-synthetic`, `prj_YtYWbSBvS0AvVHiJiqbnRHcIgZA8`.
- Deployment: `dpl_2MmV7DPFebTPVRqtSKnzk8FxLTiG`.
- Target: existing synthetic project's production slot; synthetic-only data.
- State: READY; region `icn1`; Node setting `22.x`.
- Exact Git metadata SHA: `7b014fe3d07ffbde13db6b4c2f84b7d7e9b90749`.
- [Deployment URL](https://hermeneus-alpha-synthetic-h1eo9f35w-carloslab.vercel.app).
- [Default Alpha alias](https://hermeneus-alpha-synthetic.vercel.app), observed
  assigned to that deployment.
- Build start `1791889390506`, ready `1791889427599` (about 37 seconds).

The target was verified after integrated-main CI passed. No migration was run
on Alpha: all required SQL filenames were already installed, and this change
adds no migration SQL. The probe uses a read-only transaction.

## Protected HTTP smoke and cleanup

Observed around 11:05–11:07 UTC through the authenticated Vercel connector:

| Request | Observation |
| --- | --- |
| Exact deployment `/api/ready` | HTTP 200, `{"status":"ready"}`, `Cache-Control: private, no-store`, cache MISS |
| `/handoffs` without Creator login | HTTP 200 streaming shell containing `NEXT_REDIRECT` and a refresh to `/login`; no Creator content. Do not describe this as an observed HTTP 307. |
| `/login` | HTTP 200; Creator sign-in and Sign in with Google text render |
| `/share` without capability | HTTP 200; generic unavailable state |
| `/share/legacy-test-disabled` | HTTP 404; legacy path denied; intentionally fake non-secret string only |
| Cookie-free `/api/ready` on default and exact-deployment hosts | HTTP 302, redirect host `vercel.com`; deployment protection denies access before the app |

Project inspection still shows `ssoProtection.enabled=true`,
`deploymentType=all`. Initial Chrome automation was blocked by the client, so
the smoke used authenticated connector requests, not a captured browser flow.
One connector-generated temporary access link was created for this new exact
deployment, retained only in memory and revoked with `regenerate:false` after
the checks. The returned protection-bypass map had zero entries and omitted the
owned secret. No secret or authenticated response cookie is stored here.

A deployment-scoped runtime query for `error`/`fatal` grouped by level over the
latest 10 minutes returned no groups. This is a bounded absence of observed
runtime errors, not proof of complete infrastructure request logging or token
redaction. There was no new Google login, product data creation or erasure in
this smoke.

## Remaining work

- Wire readiness into automatic release/promotion checks. The endpoint itself
  does not intercept other app routes or automatically roll back.
- Provision the separately selected real-data backup/PITR target, verify its
  authorization/configuration and rehearse restore in isolation. Free remains
  synthetic-only; Slice C is not wholly complete.
- Verify external participant access, Share fragment survival through fresh
  Vercel SSO, and supported infrastructure request-path evidence.
- Provision and evaluate the live semantic-verifier pilot before activation.

The follow-up release-evidence PR is documentation only. Its later commit is
not substituted for the exact tested/deployed runtime artifact recorded above.

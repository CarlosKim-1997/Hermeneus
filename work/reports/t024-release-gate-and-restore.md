# T-024 — local synthetic release Gate and logical restore verification

## Result and artifact

**READY_WITH_CONDITIONS for integration; automatic deployment is not active.**
This is a locally verified, uncommitted change on
`codex/alpha-release-gate-and-restore`, based on main
`e0575afc8bd46891ea9d7993de58d41c81635732`.

Implementation fingerprint:
`ca4f6ca834181539b6f9b919a01c8c49cee0a34d58437db327c38f94a377f3b9`.
Compute SHA-256 over the UTF-8 payload of sorted `path=sha256(file)` lines, each
terminated with LF, for exactly these files:

- `.github/workflows/alpha-release.yml`
- `.github/workflows/ci.yml`
- `.gitignore`
- `scripts/alpha-release-gate.mjs`
- `tests/alpha-release-gate.test.ts`
- `tests/integration/logical-restore.test.ts`

Operations guidance and permissions are in
`docs/operations/alpha-release-and-restore.md` and T-024. No product policy or
active normative Decision/Constraint was changed. Current State received only
the actionable local-verification/activation boundary and observed restore risk.

## Implemented

- Disabled-by-default `workflow_run` release: exact successful current-main CI,
  all four required jobs from the current attempt, trusted clean checkout,
  pinned CLI 63.1.2, production staging with no domain assignment, inspected
  owner/project/SHA/region/protection, bounded read-only readiness request,
  temporary access cleanup, main/target recheck, promotion of the same artifact.
- Deployment token only enters the three release steps that require it. No
  fork/PR artifact or code gets that token. Selection uses read-only GitHub
  permissions. No DB migration, rollback or forced-check bypass is automated.
- Actual custom-format pg_dump/pg_restore of migrations 001–011 and synthetic
  records in two newly created disposable databases. Integrated into the
  existing PostgreSQL CI job, preserving the four required job names.
- Restored rows, effective ACLs, function definitions/ACLs and default privileges
  match. Published/owner immutability, monotonic Creator erasure, pre-backup
  revocation/erasure, PUBLIC denial and anon/authenticated denial for existing
  and future tables/functions are challenged after restore.
- The test demonstrates that post-backup erasure/revocation is absent from the
  restored snapshot despite schema readiness. Its target remains disconnected
  from all app traffic and is dropped after verification.

## Local verification, 2026-10-13

Windows, Node 24.20.0, disposable Docker PostgreSQL 16. The repository/hosted CI
uses Node 22; this new workflow and restore test have not run on hosted Node 22.

| Command/check | Observation |
| --- | --- |
| `npm test`, final artifact | 87 PASS, including 32 release Gate cases |
| `npm run test:integration`, disposable full schema | 113 PASS; no integration skips |
| Final strengthened restore test with `CI=true` | 1 PASS, after adding client-role/future-object checks and CI configuration enforcement |
| `npm run test:auth`, same disposable DB | 72 PASS |
| `npm run typecheck`, final code | PASS |
| `npm run governance` | PASS, structure only |
| `git diff --check` and new-file whitespace scan | PASS |
| Pinned CLI deploy/promote `--help` | 63.1.2 supports production staging, skip-domain, SHA metadata and bounded promotion wait |

The local dump/restore plus post-dump checks measured 673ms in the final focused
run (total focused test 1606ms). This tiny local fixture does not establish
target capacity, storage/network throughput, approved RPO/RTO or PITR behavior.
No application component/runtime path changed; new E2E/build runs were not
needed for this local operations change. The future PR/main CI must pass its
normal build, product suites and E2E on Node 22.

## Internal adversarial review and fixes

This is Codex internal review, not independent third-party assurance.

1. Compared the wire schema with Vercel's official OpenAPI. The connector's
   summarized protection `enabled` flag and a presumed deployment `teamId`
   are not the REST contract. Fixed validation to use project accountId,
   all-deployment protection type and deployment ownerId/projectId. Missing or
   unexpected API shapes stop release; no live API compatibility claim is made.
2. First restore test failed on literal ACL equality: pg_dump omits an explicit
   owner-only ACL equivalent to the PostgreSQL default. Fixed comparison to
   effective ACLs and retained actual deny checks, rather than weakening access
   requirements. Restored functions/default privileges are still compared.
3. Challenged stale CI/main, fork/PR events, missing/duplicate/skipped jobs,
   wrong target/SHA/owner/region, disabled protection, assigned aliases, existing
   bypass metadata, readiness 503/redirect/cache/wrong body/network failure and
   cleanup failure. Added current-main and target recheck before promotion.
4. Checked credential forwarding: only fixed GitHub/Vercel API origins receive
   their bearer credentials; readiness gets only the short-lived bypass header
   at the validated deployment origin, with redirects disabled. Invalid staged
   URLs never receive Vercel credentials. Top-level CLI errors are generic.
5. Prevented a missing CI service ID/URL from silently skipping the restore
   test. Local runs without an explicit disposable environment still skip and
   cannot be reported as successful restore evidence.
6. Reproduced stale-backup resurrection after later whole-Handoff deletion and
   Share revocation. No recovery ledger or new erasure/retention guarantee is
   invented. Real recovery needs authorized lifecycle reconciliation.

## External observations and cleanup

- GitHub secret list, repository variable list and environment list were empty
  during this episode. No credential or environment was created.
- Existing deployment `dpl_2MmV7DPFebTPVRqtSKnzk8FxLTiG` remains READY in icn1
  at runtime SHA `7b014fe3d07ffbde13db6b4c2f84b7d7e9b90749`; existing project
  inspection reports all-deployment SSO protection. No new deployment or
  verification link was created.
- Baseline main Node 22 CI
  [38388719652](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38388719652)
  passed four required jobs. It predates these changes and does not verify them.
- Dedicated container `hermeneus-restore-t024`, exact ID
  `a872e5b811a92e3875008fc0ac0588409f84f9150d432dc181eaafb341dcb03c`, was created
  with task label T024 on loopback port 15434. Final queries returned zero owned
  restore databases and zero fixture-created anon/authenticated roles. Unique
  synthetic archives were removed by the test. Identity/name/label were verified
  before removing that container and its anonymous volume; subsequent listing
  returned no container. Other worktrees/attachments were preserved.

## Remaining actions and boundaries

1. Explicit integration authority for this new change: commit, push, PR and
   merge after actual exact-HEAD and post-integration Node 22 CI pass. Existing
   required checks/protection are retained.
2. Explicit unattended synthetic-release activation: configure main-restricted
   GitHub environment `synthetic-alpha`; owner registers a CarlosLab Vercel
   token directly as environment secret `VERCEL_TOKEN`; enable opt-in variable
   last. Observe an actual staged/probed/cleaned/promoted hosted run before
   declaring the automatic Gate operational. A connector login cannot be
   exported as a GitHub runner credential.
3. The selected paid Pro/Small/seven-day PITR target remains unprovisioned.
   Billing, real-data backup/restore authorization and approved retention/RPO/RTO
   are distinct decisions. This local logical rehearsal does not clear them.
4. Real recovery cannot reconnect an old snapshot without checking later
   erasure/revocation. The current implementation has no durable recovery ledger;
   a proposal for one is a separate data-lifecycle decision.
5. Fresh protected Share authentication/participant access, infrastructure bearer
   log absence and live verifier quality remain separate existing exit gates.

Reference procedure: `docs/operations/alpha-release-and-restore.md`. No remote
push/PR/merge, shared DB write/restore, paid model invocation, deployment,
protection relaxation or paid-resource operation occurred in T-024.

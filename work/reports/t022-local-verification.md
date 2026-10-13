# T-022 local implementation verification

Non-normative evidence, observed 2026-10-13. No remote write, deployment,
shared Alpha DB mutation or external model call occurred in this episode.

## Artifact

- Branch: `codex/db-readiness-hardening`.
- Base HEAD: `feb32dec0f10935164ec0e4e4e48cf9380d1f793`.
- Implementation is an uncommitted working-tree diff, not that base commit.
- Runtime/test fingerprint (SHA-256):
  `65b8f67f1fb759d93d5fd9dded9d569c83f46c795a3d52e3a90a1f5c53245784`.

Fingerprint input: the following paths sorted ordinally, each line
`path=lowercase-SHA256-of-file-bytes`, joined with LF and a final LF, UTF-8,
then SHA-256. Documentation is excluded to avoid a circular evidence hash.

```
e2e/readiness.spec.ts
scripts/migrate.mjs
scripts/migration-runner.mjs
src/app/api/ready/route.ts
src/application/readiness.ts
src/persistence/postgres/schema-readiness.ts
tests/application-readiness.test.ts
tests/integration/migration-readiness.test.ts
tests/readiness-route.test.ts
tests/schema-readiness.test.ts
```

## Environment and observed verification

Windows, Node 24.20.0, PostgreSQL 16 in the newly created disposable container
`hermeneus-slice-c-20261013`, bound only to `127.0.0.1:15433`. Synthetic local
database credentials only. Integration tests created/dropped their own random
databases; the HTTP test temporarily removed/restored one history row only in
the disposable database. The container is removed after verification.

| Command | Observation |
| --- | --- |
| `npm run migrate` | Fresh local DB applied all migrations 001–011. |
| `npm test` | 15 files, 55 tests PASS. |
| `npm run test:integration` | 9 files, 112 tests PASS. Final run includes both transaction-pooler rejection cases. |
| `npm run test:auth` | 11 files, 72 tests PASS. |
| `npm run test:e2e` | 15 tests PASS, including readiness failure/recovery, ownership, publication, Share, packet privacy and erasure. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS; `/api/ready` is dynamic. |
| `npm run governance` | PASS: structure only. Initial sandbox run failed Windows `EPERM`; rerun with approved local execution passed. |
| `git diff --check` | PASS. |

The new seven-case DB suite observes two real simultaneous CLI migrators
applying each file once, overlapping slow runs, failed-file rollback with older
commits retained, lock release and repaired retry, lock timeout before metadata
or schema writes, absent/intermediate-missing history, newer history acceptance,
and credential-free error output when rejecting known Supabase transaction
poolers. The new HTTP test observes 200 → history hole 503 → repaired 200.

## Internal adversarial review

Read-only self-review of the runner, CLI, readiness application/route, manifest,
new tests and operations guide against C-005/C-006/C-009/C-011/C-012 and installed
Governance. This is Codex internal challenge, not third-party assurance.

Corrections and checked boundaries:

- Extended the pooler guard from the shared host to the dedicated Supabase
  transaction-pooler host; both are tested before connection.
- Read-only probes use transaction-local settings, never persistent session
  read-only state. A failed/timed-out probe destroys its client rather than
  returning an open transaction to the pool.
- The cooperating migrators lock before metadata DDL/discovery. Each file's SQL
  and history row commit atomically. Failure rolls back and attempts unlock;
  disconnect also releases the session lock. Older successful files remain.
- Probes read only migration metadata and reveal generic HTTP status. Errors
  do not reveal hostnames, SQL, user records or credentials. No login identity,
  bearer authorization or erasure operation is introduced.
- Probe timeouts/connection count are bounded; the migration lock deadline is
  checked between completed attempts, not a network or migration-SQL timeout.
- No remaining actionable finding within this diff. No claim that the metadata
  manifest proves physical schema integrity or an OAuth round trip.

## Remaining gates

1. Authorized commit, push/PR integration, Node 22 hosted CI for the exact
   artifact, then separately authorized synthetic Alpha deployment and protected
   `/api/ready`/product smoke. Local Node 24 results do not prove Node 22 parity.
2. Wire readiness into the release process; this route itself does not block
   other application requests, promote or roll back a deployment.
3. Target backup/PITR provisioning and an isolated restore rehearsal. Slice C
   is not wholly complete, and no real-data readiness is established.
4. Existing external participant access, fresh Vercel SSO Share-fragment
   survival, infrastructure request-path evidence and live-verifier evaluation
   remain separate gates.

The UI baseline had previously been observed at deployment
`dpl_FYCTSXpmed23sYptFpuFZGHkB2JX`, READY in `icn1`, at the base SHA above, with
all four jobs passing in [main CI 38382634361](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38382634361).
That earlier observation identifies the baseline; it is not CI or deployment
evidence for T-022 and was not rechecked live in this implementation episode.

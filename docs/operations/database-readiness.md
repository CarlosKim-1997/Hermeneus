# Migration serialization and readiness

Non-normative operations guidance for the Slice C implementation. It changes
neither product Canon nor permission to mutate a target database or deploy.

## Migration execution

Run `npm run migrate` only against an explicitly authorized target, using a
dedicated direct PostgreSQL connection or a session-mode connection. Do not use
a transaction pooler: a session advisory lock must stay on one backend across
the per-file commits. The CLI rejects both known Supabase shared and dedicated
transaction-pooler endpoints on port 6543; other proxies must be checked by the
operator. The web app never runs
migrations automatically.

The migrator acquires a database-scoped, session advisory lock before creating
the history table or reading applied filenames. Contenders wait at most 30
seconds for that lock, then fail without applying files. The winner keeps the
lock across the complete ordered run, while retaining one transaction per
migration. A failed file rolls back its SQL and history row; previous committed
files stay applied. Unlock runs on success or failure, and closing the dedicated
connection releases session locks. A later authorized retry skips committed
files. This is forward migration, not an automatic downgrade or data restore.

Connection setup has a five-second timeout. The 30-second lock deadline is
checked between completed lock attempts; it does not bound a stalled network
query or long-running migration SQL. CLI failures print a generic message
and, when available, SQLSTATE; they do not echo SQL or connection credentials.

## Readiness contract

`GET /api/ready` is a dynamic Node route with `Cache-Control: private, no-store`:

| Response | Meaning |
| --- | --- |
| 200 `{"status":"ready"}` | Auth configuration is usable for this runtime and every migration required by this build appears in `public.schema_migrations`. |
| 503 `{"status":"unavailable"}` | Missing/disabled/invalid auth, production dev auth, DB unavailability, missing or unreadable history, missing required filename, or probe timeout. |

No missing filename, database host, credential, SQL error, Creator identity, or
user data is returned. The probe uses one bounded connection per application
instance, a read-only transaction, a two-second server statement timeout and
client timeouts. Failed probes discard their connection rather than returning
an open transaction to the pool. Additional newer migration filenames do not
invalidate an otherwise complete required set. The manifest has a drift test
against all checked-in SQL migrations.

This is a migration-history check, not proof that schema objects have never
been altered, OAuth round trips work, backups restore, or all product flows
work. It reads no user tables and does not create a login identity. The probe's
database role needs read access to the migration history. Existing deployment
protection still applies; no monitoring bypass is provisioned by this change.

## Release and recovery procedure

1. On an authorized target, take the required backup and run the reviewed
   migrator separately from the web process, with one dedicated connection.
2. Stage the exact main artifact whose post-integration CI passed. Check
   `/api/ready` through authorized deployment access, then the synthetic product
   smoke. A 503 is a failed readiness gate: investigate before promotion.
3. For lock timeout, identify the competing migrator; do not forcibly unlock or
   run parallel DDL as a workaround. Retry after it finishes under the same
   target authorization.
4. For a failed file, inspect the authorized operator diagnostics, repair the
   migration code and test in a disposable database before retrying. Do not
   mark a filename applied manually to turn readiness green.

The endpoint does not automatically intercept other app routes, change Vercel
routing or promote/roll back a deployment. The follow-up disabled-by-default
release workflow and isolated synthetic logical restore rehearsal are described
in `docs/operations/alpha-release-and-restore.md`. Their activation and target
backup/PITR provisioning remain separate permission and verification boundaries.

Connection-mode reference: [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
The read-only transaction deliberately avoids persistent session settings as
described in [Supabase's transaction-pooler troubleshooting guidance](https://supabase.com/docs/guides/troubleshooting/resolving-cannot-execute-update-in-a-read-only-transaction-on-transaction-pooler-connections-ef582c).

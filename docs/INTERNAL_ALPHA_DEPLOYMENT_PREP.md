# Internal Alpha deployment preparation

This is an operational checklist, not Canon or release authority. Complete the checks against the exact reviewed commit and target resources before allowing real data. Do not infer a passing gate from local or hosted CI alone.

## Selected target

- A new isolated Supabase Pro project in `ap-northeast-2` (Seoul), with Small or larger compute and seven-day PITR. Confirm PITR availability and the current price in the project creation flow before committing to the project; published regional documentation alone does not confirm this combination.
- Vercel Hobby for personal, noncommercial internal Alpha use, with one owner and one named external participant. The repository sets the Function region to `icn1` in `vercel.json`; confirm the deployed Function region in the target project.
- Vercel Authentication protecting **all deployments**, including any production URL. Do not use Vercel shareable bypass links for real-data tests. Confirm the single external participant's access and unauthorized denial in the deployed environment.
- Auth.js Google OAuth for Creator identity over HTTPS (`CREATOR_AUTH_MODE=external`). Validate the exact callback URL, host/proxy trust, secure cookies, sign-in/out, and cross-Creator denial on the target URL.

## Synthetic-only interim environment

The owner approved a Free interim project for synthetic testing only. Supabase project `hermeneus-alpha-synthetic` (`dzaibwrrylxlrxbgnyaw`) is isolated in Seoul; its Data API is disabled. Migrations 001–011 were applied there. Migration 011 revokes `anon`/`authenticated` access to Hermeneus tables and functions and blocks future client-role defaults. Read-only verification found 11 app tables, zero client-accessible app tables, zero client-executable app functions, and zero handoffs. The Free project has no PITR/automatic-backup evidence and must not hold real user data.

Vercel project `hermeneus-alpha-synthetic` (`prj_YtYWbSBvS0AvVHiJiqbnRHcIgZA8`) exists under CarlosLab with Node 22.x and Vercel Authentication configured for all deployments. It has no Git link, environment secrets, domain, or deployment. The selected Pro/Small/PITR target for real-data use remains unprovisioned.

## Database exposure and connectivity

The owner selected **Data API disabled** for this Alpha. Hermeneus uses server-side `pg` connections and does not use Supabase REST, GraphQL, or `supabase-js`. Its migrations create tables in `public` without RLS; Supabase projects may grant API roles access to newly created public objects by default. Before applying any Hermeneus migration:

1. In the new Supabase project's **Data API** integration settings, turn **Enable Data API** off. Record the target project reference and a non-secret screenshot or setting observation in the release evidence.
2. Confirm `public` is not reachable through generated REST endpoints. Use a synthetic table or an empty-schema request; do not expose a real Share token or user record in a test URL. Recheck after migrations and before admitting real data.
3. Use the dashboard's transaction-pooler connection string for the Vercel server-only `DATABASE_URL`; use a direct connection for the one-time migration command. Copy hostnames from the target dashboard rather than constructing them from the region. Keep both strings and passwords in protected environment secrets, never in Git or build output.
4. Apply reviewed migrations 001–011 to the future real-data project only after reviewing that target and taking a baseline backup. Check migration history, schema objects, anonymous/authenticated grants, and the Data API disabled setting afterward. Do not enable Data API later without a separate table/function access and RLS review.
5. With synthetic records, exercise import, Bootstrap, publication, Share issue/revoke, provenance, and erasure. Verify backup/PITR status and rehearse recovery on an isolated disposable target; do not restore over live Alpha data as a test.

## External processing and Share boundary

- Leave `HERMENEUS_EXTERNAL_VERIFIER=off` until a separate OpenAI project/key and provider-side monthly cap exist, model pricing is checked, and synthetic live evaluation passes. The application reserves at most $0.05 per request, $5 per UTC day, and $25 per UTC month; these reservations are a guard, not a billing guarantee.
- Before real answer verification, confirm the per-request consent UI, sent fields, `store:false`, and no Hermeneus persistence of answer or consent in the deployed target.
- Issue only `/share#token` links. Verify a protected browser session can complete any Vercel Authentication redirect and still open the pinned Share view. Check that the address bar is cleared before the server action, that Vercel request-path logs contain no bearer, and that the old `/share/[token]` route is unavailable. Use synthetic capabilities for this inspection.

## Release gate

PR #24 was merged at `e2bc37ab5f93095cdc38c35a0b9e294aa4f147e1` after its four protected checks passed. The owner authorized an administrator exception to the then-required approval review for that PR. The integrated `main` commit passed all four jobs in [run 38149293147](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38149293147). PR #26 added migration 011 at `f6886a3e23d7d6858486e01303e2e5b9dd7464fe`, with four passing jobs in [main run 38156366618](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38156366618). Check live branch protection and exact HEAD CI before each future integration. Repository integration does not itself establish target-resource readiness. Record the target settings, migration run, smoke results, restore evidence, and remaining risks before admitting real data.

References: [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api), [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase backups and PITR](https://supabase.com/docs/guides/platform/backups), [Vercel Function regions](https://vercel.com/docs/functions/configuring-functions/region), [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication), [Vercel all-deployment protection update](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan).

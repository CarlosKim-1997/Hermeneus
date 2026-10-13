---
schema: state/v1
status: IN_PROGRESS
areas:
  - handoff
---
# Current Project State

## Current Position

The approved vNext S1–S6 vertical slice is integrated into `main`: source-free bootstrap with Creator review, exact-version Receiver Packet/Submission, bounded v0.1 verification, and a guarded OpenAI pilot path. The earlier M1–M12 imported-source, internal Receiver, publication, ownership, and layered erasure paths remain supported. Owner and agent synthetic checks exercised Bootstrap, publication, Share issue/open/revoke, packet privacy, provider-off verification, deterministic Receiver questions, and erasure. Database observations corroborate cleanup and a new Creator lifecycle after account erasure. The same-document Share navigation defect is fixed and deployed: an already-mounted Share page consumed a valid synthetic link, cleared the fragment, displayed pinned version 1, and rejected a subsequent request after revocation.

## Active Work

Migration serialization and `/api/ready` schema-history checks are integrated,
passed Node 22 hosted CI and deployed in synthetic Alpha. Protected readiness
returns 200. The automatic promotion Gate and isolated synthetic logical restore
test are integrated and passed Node 22 main CI. The owner registered
`VERCEL_TOKEN` in main-only `synthetic-alpha`; actual credential verification
and staging succeeded. The first staged release failed the zero-alias Gate:
Vercel's generated secondary alias moved before readiness despite `--skip-domain`.
It was restored under specific approval. The owner approved an amended Gate
that permits only that literal generated alias and pins the primary service
domain until verified promotion. Integration/full release verification of that
amendment remains pending; the opt-in is disabled meanwhile. Target backup/PITR
provisioning and an actual target restore rehearsal remain outstanding.

Complete authorized participant access, Share fragment survival through fresh Vercel authentication, and request-path log inspection in Seoul Supabase Free project `dzaibwrrylxlrxbgnyaw` and Vercel Hobby project `prj_YtYWbSBvS0AvVHiJiqbnRHcIgZA8`. The database has migrations 001–011, Data API disabled, and app-table/function client grants revoked. Vercel Authentication covers all deployments; unauthenticated requests to the default and deployment-specific Share URLs redirect to Vercel SSO. The external verifier remains off. The separate Supabase Pro/Small target with seven-day PITR selected for real-data use remains unprovisioned.

## Blockers

Automatic synthetic release awaits integration and a successful hosted run of
the approved primary-domain Gate. Credential registration and required execution
permissions are present; do not relax the other target/readiness/cleanup checks.

Before real data use, provision and verify the separate Pro/Small/PITR target, its billing and regional availability, Data API shutdown and grants, backup/restore rehearsal, target OAuth, deployment authentication, and protected Share access. The Free project is synthetic-only.

## Material Risks

- The live semantic verifier and its cost/consent controls have not been evaluated against an external model in the target environment. Deterministic checks cannot establish semantic quality by themselves.
- External participant access, Share fragment survival through a fresh Vercel authentication redirect, and absence of Share bearers in infrastructure request logs remain unverified. Current runtime log queries returned no records; they do not prove absence of a token leak.
- Legal retention/hold and team ownership transfer are outside current product scope.
- The approved generated secondary alias can serve a candidate before readiness;
  use only `hermeneus-alpha-synthetic.vercel.app` for participant/service access.
  All-deployment authentication and synthetic-only operation remain required.
- Restoring a snapshot can resurrect Handoffs erased or capabilities revoked
  after its backup. The local drill demonstrated this despite schema readiness;
  a real recovery target must remain isolated pending lifecycle reconciliation.

## Verification Basis

The verified synthetic deployment serving the primary domain is `dpl_2MmV7DPFebTPVRqtSKnzk8FxLTiG`,
READY in `icn1`, at `7b014fe3d07ffbde13db6b4c2f84b7d7e9b90749`;
[main CI run 38387114454](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38387114454)
passed all four required jobs. Protected readiness, generic access surfaces,
deployment authentication and temporary verification-link cleanup are recorded
in `work/reports/t023-readiness-alpha-release.md`.
Earlier deployed same-document Share and erasure
evidence and remaining hosted checks are in
`work/reports/synthetic-alpha-smoke-2026-10-13.md`. Local T-022 negative,
concurrency and regression verification is recorded separately in
`work/reports/t022-local-verification.md`. These observations do not establish
real-data readiness, target restore capability or paid-model behavior. Local
release Gate/isolated logical restore evidence is in
`work/reports/t024-release-gate-and-restore.md`; Node 22 integration and activation
preparation are in `work/reports/t025-release-gate-integration.md`. Main CI
[38394774004](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38394774004)
passed all four required jobs for `e25655178a905f95c8f8da85e5998e08af9dc0c5`,
including the actual isolated logical restore. The first automatic attempts
stopped before primary-domain promotion. Main CI `38416854496` passed all four
jobs for `83d42ef2a474223849d35ba432aca4ea33945728`; release `38417177954`
staged a READY candidate and failed the alias Gate. Observed generated-alias
movement, approved restoration and amended safety boundary are recorded in
`work/reports/t025-generated-alias-decision.md`.

Hosted activation preflight verified readiness through a scoped Vercel share-link
cookie exchange; the Gate's earlier automation-header assumption required a
repair. The bounded protocol, negative tests and cleanup evidence are recorded
in the T-025 report. This is not evidence of the full automatic release path.

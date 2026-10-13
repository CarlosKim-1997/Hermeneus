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
test are integrated and passed Node 22 main CI. Automatic synthetic releases
are enabled and the full staged/readiness/access-cleanup/same-artifact promotion
path succeeded. GitHub's credential-bearing environment is restricted to main.
The owner-approved Gate permits only the literal generated secondary alias
before readiness, pins the primary service domain until promotion, and verifies
its exact resulting mapping. Use only the primary domain for service access.
Target backup/PITR
provisioning and an actual target restore rehearsal remain outstanding.

Complete authorized participant access, Share fragment survival through fresh Vercel authentication, and request-path log inspection in Seoul Supabase Free project `dzaibwrrylxlrxbgnyaw` and Vercel Hobby project `prj_YtYWbSBvS0AvVHiJiqbnRHcIgZA8`. The database has migrations 001–011, Data API disabled, and app-table/function client grants revoked. Vercel Authentication covers all deployments; unauthenticated requests to the default and deployment-specific Share URLs redirect to Vercel SSO. The external verifier remains off. The separate Supabase Pro/Small target with seven-day PITR selected for real-data use remains unprovisioned.

## Blockers

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

The observed full automatic release
[38423302896](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38423302896)
succeeded for `059a3a85c06f1386ef57047de4372b9dfbfa3e8c`; its exact main CI
[38422946338](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38422946338)
passed all four required jobs. Vercel deployment
`dpl_G8kS2EJRYKETiP1DC1MhxceLACjb` was READY in `icn1`; a fresh primary-alias
read confirmed it serves that artifact, with all-deployment protection retained.
Activation, failure observations, approved alias boundary and actual readiness/
cleanup/promotion evidence are in `work/reports/t025-generated-alias-decision.md`.
Earlier deployed same-document Share and erasure
evidence and remaining hosted checks are in
`work/reports/synthetic-alpha-smoke-2026-10-13.md`. Local T-022 negative,
concurrency and regression verification is recorded separately in
`work/reports/t022-local-verification.md`. These observations do not establish
real-data readiness, target restore capability or paid-model behavior. Local
release Gate/isolated logical restore evidence is in
`work/reports/t024-release-gate-and-restore.md`; hosted Node 22 integration and
historical activation preparation are in `work/reports/t025-release-gate-integration.md`.

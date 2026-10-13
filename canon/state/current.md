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

Migration serialization and `/api/ready` schema-history checks are implemented
and verified locally in T-022. T-023 is authorized to commit, push/integrate,
verify Node 22 hosted CI and check the protected synthetic target; the local
endpoint is not yet deployed or wired into automatic promotion checks. Remaining
Slice C work includes target backup/PITR provisioning and restore rehearsal.

Complete authorized participant access, Share fragment survival through fresh Vercel authentication, and request-path log inspection in Seoul Supabase Free project `dzaibwrrylxlrxbgnyaw` and Vercel Hobby project `prj_YtYWbSBvS0AvVHiJiqbnRHcIgZA8`. The database has migrations 001–011, Data API disabled, and app-table/function client grants revoked. Vercel Authentication covers all deployments; unauthenticated requests to the default and deployment-specific Share URLs redirect to Vercel SSO. The external verifier remains off. The separate Supabase Pro/Small target with seven-day PITR selected for real-data use remains unprovisioned.

## Blockers

Before real data use, provision and verify the separate Pro/Small/PITR target, its billing and regional availability, Data API shutdown and grants, backup/restore rehearsal, target OAuth, deployment authentication, and protected Share access. The Free project is synthetic-only.

## Material Risks

- The live semantic verifier and its cost/consent controls have not been evaluated against an external model in the target environment. Deterministic checks cannot establish semantic quality by themselves.
- External participant access, Share fragment survival through a fresh Vercel authentication redirect, and absence of Share bearers in infrastructure request logs remain unverified. Current runtime log queries returned no records; they do not prove absence of a token leak.
- Legal retention/hold and team ownership transfer are outside current product scope.

## Verification Basis

The latest observed UI deployment is `dpl_FYCTSXpmed23sYptFpuFZGHkB2JX`, READY in
`icn1`, at `feb32dec0f10935164ec0e4e4e48cf9380d1f793`;
[main CI run 38382634361](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38382634361)
passed all four required jobs. Earlier deployed same-document Share and erasure
evidence and remaining hosted checks are in
`work/reports/synthetic-alpha-smoke-2026-10-13.md`. Local T-022 negative,
concurrency and regression verification is recorded separately in
`work/reports/t022-local-verification.md`; it does not establish hosted readiness,
real-data readiness, restore capability or paid-model behavior.

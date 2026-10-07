---
schema: task/v1
id: T-019
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-018
---
# Production Readiness / Internal Alpha Exit Audit

## Objective

Perform an evidence-backed readiness audit separating Controlled Internal Alpha, Limited Beta, and later public operation requirements; produce a prioritized remediation plan without implementing fixes.

## Scope

In scope: repository, CI/change control, dependencies, deployment assumptions, security boundaries (auth, share bearer, headers, logs), database/migrations, backups/DR, observability, LLM operations, abuse limits, privacy/erasure beyond DB, runbooks, health, capacity, GitHub settings (read-only).

Out of scope: remediation implementation, Canon changes, production mutation, hosted CI addition, branch protection changes, deployment config changes, new product features, legal/compliance certification.

## Authority

Authorized on `cursor/production-readiness-audit-t019` to inspect code/config/tests, run deterministic checks, non-mutating `npm audit`/`outdated`, read-only GitHub API where permitted, author audit report and Task, commit, push, open draft PR.

Not authorized to implement findings, merge, mutate GitHub/deployment/production, rotate secrets, or create follow-up implementation Tasks.

## Constraints

Audit report is non-normative analysis. Findings that imply product policy are `Human Decision Required`. Installed Governance and Canon remain authoritative. Do not exceed evidence in security claims.

## Verification

Baseline: `origin/main` at `edf7c6baf566fd55baf40ea650bc64273cffee3e` (PR #20 / T-018 merge).

Deliverable: `work/reports/production-readiness-internal-alpha-exit-audit.md` with gate matrix, findings, remediation slices, human decisions.

Commands (2026-10-07 UTC):

- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — PASS (audit-only diff)
- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm test` — 14 PASS
- `npm run test:application` — 37 PASS
- `npm run test:auth` — 72 PASS
- `npm run test:integration` — 97 PASS
- `npm run test:share` — 17 PASS
- `npm run test:receiver` — 11 PASS
- `npm run test:e2e` — 13/13 PASS
- `npm audit` — 7 vulnerabilities (2 critical in dev chain: tinypool/vitest)
- `npm audit --omit=dev` — 4 vulnerabilities (transitive build/runtime)
- `npm outdated` — recorded in report
- GitHub branch protection API — 403 (UNKNOWN_EXTERNAL detail)

## Stop Conditions

Stop on Canon conflict, request to implement remediation in T-019, or production access requirement.

## Completion Criteria

Met: evidence-backed audit, Alpha vs Beta separation, strengths documented, findings classified, slices proposed (not implemented), Governance PASS, no runtime behavior change, `canon/state/current.md` unchanged.

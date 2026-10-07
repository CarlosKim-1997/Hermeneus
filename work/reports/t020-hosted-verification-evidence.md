---
schema: report/v1
title: T-020 Hosted Verification Evidence
task: T-020
status: non-normative
---
# T-020 — Hosted verification evidence

## Baseline

Post–PR #21 merge `origin/main`: **`ee23d40190847c63e654d1041f989e76f65d1029`** (contains T-019 reconciliation `c6c1667b1aa4aa0b728e972b02777e741e135a72`).

## Workflow

- **Path:** `.github/workflows/ci.yml`
- **Workflow display name:** `CI`
- **Triggers:** `pull_request` → `main`; `push` → `main`
- **Permissions:** `contents: read`
- **Concurrency:** cancel in-progress runs per PR/ref

### Jobs (stable names)

| Job | Purpose |
|-----|---------|
| `verify` | Governance, typecheck, build, deterministic Vitest (no DB); PR `git diff --check` vs base SHA |
| `postgres` | Disposable PostgreSQL 16, `npm run migrate`, `test:auth`, `test:integration` |
| `e2e` | Disposable PostgreSQL 16, Playwright via `scripts/start-e2e-server.mjs` |
| `dependency-audit` | `npm ci --omit=dev`; blocking `npm audit --omit=dev --audit-level=critical` |

**Note:** `test:auth` runs in `postgres` because T-018 lifecycle-blocked auth tests require `TEST_DATABASE_URL`.

## Runtime pin

| Location | Value |
|----------|-------|
| `.nvmrc` | `22` |
| `package.json` `engines.node` | `>=22.0.0 <23.0.0` |
| Hosted `setup-node` | resolves **v22.20.2** (2026-10-07 run) |

**Rationale:** Next.js 15 supports Node ≥20; `openai@7.23.0` declares `engines.node >=22.0.0`. Node **22 LTS** matches the successful local agent environment (v22.14.0) without upgrading Next.js or OpenAI for Slice A.

## Hosted execution (PR #22)

| Field | Value |
|-------|-------|
| PR | [#22](https://github.com/CarlosKim-1997/Hermeneus/pull/22) |
| HEAD SHA | `7e928ffad382e5c5feb41fa102d6b6b3e1273947` |
| Workflow run | [37553741751](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/37553741751) |
| Event | `pull_request` |

### Check contexts (exact names from commit check-runs API)

| Context | Conclusion |
|---------|------------|
| `verify` | success |
| `postgres` | success |
| `e2e` | success |
| `dependency-audit` | success |

### Test counts (hosted)

| Job | Result |
|-----|--------|
| `verify` | Deterministic Vitest suites green (includes `npm test`, `test:application`, share/receiver/extraction configs; auth excluded) |
| `postgres` | **72** auth + **97** integration tests passed |
| `e2e` | **13/13** Playwright tests passed |

### PostgreSQL (test service)

- **Image:** `postgres:16`
- **Migrations:** `npm run migrate` applied cleanly before integration/auth tests (001–008 on empty DB per job lifecycle)

## Dependency audit

- **Blocking gate:** `npm audit --omit=dev --audit-level=critical` → **pass** (no production CRITICAL at audit time)
- **Informational:** production tree still reports **4** advisories (1 moderate, 3 high) — consistent with T-019; not blocking Slice A gate
- Dev-only Vitest/tinypool CRITICAL advisories are **not** part of the production-only gate

## Branch protection

### Before (2026-10-07)

`GET .../branches/main`: `protected: false`, `protection.enabled: false`, required checks off.

### Mutation attempt

`PUT .../branches/main/protection` with required contexts `verify`, `postgres`, `e2e`, `dependency-audit`, PR required with **0** approvals, force-push and deletion disabled → **HTTP 403** `Resource not accessible by integration`.

### After

**Unchanged** — human GitHub admin must apply protection using the exact contexts above.

Recommended settings:

- Require pull request (0 required approving reviews for solo maintainer)
- Require status checks: `verify`, `postgres`, `e2e`, `dependency-audit`
- Require branches up to date (strict)
- Block force push and branch deletion
- `enforce_admins`: preserve owner break-glass unless org policy requires otherwise

## Finding disposition

| Finding | Status |
|---------|--------|
| PR-RC-001 | **CLOSED** (hosted CI on PR/main) — protection pending admin |
| PR-RC-002 | **OPEN** until admin enables protection |
| PR-SC-004 | **CLOSED** (Node pin aligned) |
| PR-SC-001 | **Partially closed** — hosted critical audit gate; HIGH/MODERATE remain |
| PR-RC-003 | **PARTIAL** — repository/CI SHA provenance in workflow summary + `docs/operations/change-control.md`; deployed-artifact provenance awaits Slice B |

## Residual human action

**GitHub admin:** enable `main` branch protection with the four check contexts listed above, then verify via branch API.

## T-020 task status

**IN_PROGRESS** until branch protection is applied and verified externally.

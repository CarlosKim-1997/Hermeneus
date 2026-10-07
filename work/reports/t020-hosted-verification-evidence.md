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
| Implementation HEAD (pre-closure) | `7e928ffad382e5c5feb41fa102d6b6b3e1273947` — run [37553741751](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/37553741751) |
| Evidence + closure HEAD | `d0e3a833d27135e00ee066056f50c45cbcf054bd` — run [37554061009](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/37554061009) |
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

### Before (T-020 start)

**Machine verified:** `GET /repos/.../branches/main` → `protected: false`, `protection.enabled: false`, required status checks off.

### Agent mutation attempt (2026-10-07)

`PUT .../branches/main/protection` → **HTTP 403** `Resource not accessible by integration`.

### After (owner-configured; re-verified 2026-10-07)

**Machine verified** (`GET /repos/CarlosKim-1997/Hermeneus/branches/main`):

| Field | Value |
|-------|-------|
| `protected` | **true** |
| `protection.enabled` | **true** |
| Required status check contexts | **`verify`**, **`postgres`**, **`e2e`**, **`dependency-audit`** (GitHub Actions app_id 15368) |
| Status check enforcement | `enforcement_level`: **`non_admins`** |

**Not readable** via this integration (admin protection endpoint and GraphQL `branchProtectionRules` return **403** / forbidden): strict/up-to-date flag, force-push allow/deny, branch deletion allow/deny, required approving review count, conversation resolution, admin enforcement (`isAdminEnforced`). Those settings were applied manually by the repository owner; treat as **human-admin configured** unless confirmed in GitHub UI.

**PR #22 under protection (machine verified):**

- State **OPEN**, draft (acceptable for closure verification).
- HEAD `d0e3a833d27135e00ee066056f50c45cbcf054bd` matches T-020 branch.
- All four required checks **SUCCESS** on run [37554061009](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/37554061009).
- `mergeable`: **MERGEABLE**; `mergeStateStatus`: **BLOCKED** (draft + `reviewDecision`: **REVIEW_REQUIRED** — normal gating, not missing CI contexts).

## Finding disposition (final)

| Finding | Status |
|---------|--------|
| PR-RC-001 | **CLOSED** — hosted CI on PR and push to `main` |
| PR-RC-002 | **CLOSED** — `main` protected with required CI contexts |
| PR-SC-004 | **CLOSED** — Node runtime pinned (`.nvmrc`, `engines`, Actions) |
| PR-SC-001 | Hosted production-**CRITICAL** audit gate established; known HIGH/MODERATE advisories remain for later remediation |
| PR-RC-003 | **PARTIAL** — tested Git SHA / hosted CI provenance established; deployment artifact/runtime SHA propagation awaits deployment slice |

## Closure verification (final HEAD)

| Field | Value |
|-------|-------|
| Closure commit | `0bf50cd0e2d5106806be1d291084e30f51cd0a3e` |
| Workflow run | [37562068022](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/37562068022) |
| Jobs | `verify`, `postgres`, `e2e`, `dependency-audit` — all **success** |

## T-020 task status

**COMPLETE** (2026-10-07) — hosted CI green, required contexts match, `main` protection verified via branch API. PR #22 remains open for human merge.

---
schema: task/v1
id: T-020
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-019
---
# T-020 — Hosted Verification & Repository Protection

## Objective

Create deterministic GitHub-hosted verification for every PR/main update, pin the repository's Node runtime, establish a meaningful production-dependency audit gate, and protect `main` from unverified changes.

## Scope

In scope: `.github/workflows/ci.yml`, Node pin (`.nvmrc`, `engines`), production-critical audit gate, repository-side change-control documentation, `main` branch protection after green checks, narrow `canon/state/current.md` update when protection is verified, evidence report.

Out of scope: deployment provider, TLS, Share log redaction, target OAuth smoke, backups/PITR, migration lock, readiness, pool tuning, rate limits, LLM timeouts, observability, deploy automation, Canon changes.

## Authority

Authorized on `cursor/hosted-verification-t020` to add CI workflow, pin Node, document change control, enable `main` branch protection with observed check contexts, update Current State when Slice A is complete, commit, push, open draft PR.

Not authorized to merge T-020 PR, begin Slice B+, mutate deployment/production secrets, or change Canon.

## Constraints

No live OpenAI in CI. Least GitHub Actions permissions. Do not weaken tests for green CI. Branch protection only after successful hosted checks. T-020 remains IN_PROGRESS until protection is verified.

## Verification

Baseline: post–PR #21 `origin/main` **`ee23d40190847c63e654d1041f989e76f65d1029`**.

Hosted CI (PR #22): workflow run [37554061009](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/37554061009) at `d0e3a833d27135e00ee066056f50c45cbcf054bd` — jobs `verify`, `postgres`, `e2e`, `dependency-audit` all **success**.

Branch protection: `GET .../branches/main` → `protected: true`; required contexts **`verify`**, **`postgres`**, **`e2e`**, **`dependency-audit`**.

`test:auth` runs in the `postgres` job (T-018 DB-backed auth tests).

Closure: `node tooling/governance/check.mjs` PASS; `canon/state/current.md` updated for hosted CI + protected `main`.

## Stop Conditions

Stop if T-019 not on `main`, Canon conflict, or request to implement out-of-scope slices.

## Completion Criteria

Met: Node pinned; hosted workflow green; mandatory jobs pass; `main` protection verified with matching contexts; evidence report and Current State updated; Governance PASS; T-020 **COMPLETE** (PR #22 not merged per authority).

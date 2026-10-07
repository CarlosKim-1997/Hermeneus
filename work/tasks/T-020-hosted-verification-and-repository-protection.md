---
schema: task/v1
id: T-020
status: IN_PROGRESS
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

Baseline: post–PR #21 `origin/main` (recorded in evidence report).

Hosted: CI workflow on T-020 PR — all jobs green; exact check names captured. `test:auth` runs in the `postgres` job (subset requires `TEST_DATABASE_URL`; see T-018 lifecycle-blocked auth tests).

Local: governance, typecheck, build, deterministic suites, integration, E2E, `npm audit --omit=dev --audit-level=critical`.

## Stop Conditions

Stop if T-019 not on `main`, Canon conflict, or request to implement out-of-scope slices.

## Completion Criteria

Node pinned consistently; hosted workflow green on PR; mandatory jobs pass; `main` protection enabled with required checks; evidence report complete; Current State updated; Governance PASS; T-020 status COMPLETE (PR may remain unmerged).

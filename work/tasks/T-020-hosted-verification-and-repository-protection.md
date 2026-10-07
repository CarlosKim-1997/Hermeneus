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

## Out of scope

- Deployment provider, TLS/reverse proxy, Share URL log redaction, Google OAuth target-environment smoke
- DB backup/PITR, migration serialization, health/readiness, DB pool tuning
- Application rate limiting, LLM cost/timeouts, observability, production deploy automation
- Provider adapters, Canon changes

## Findings addressed

- PR-RC-001 — hosted CI
- PR-RC-002 — `main` branch protection
- PR-SC-004 — Node runtime pin
- PR-SC-001 — hosted production-dependency audit gate (critical threshold)
- PR-RC-003 — repository-side build provenance (partial)

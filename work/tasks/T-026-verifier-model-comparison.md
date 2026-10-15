---
schema: task/v1
id: T-026
status: IN_PROGRESS
areas:
  - handoff
depends_on:
  - T-025
related_to:
  - C-012
  - D-013
---
# Bounded synthetic verifier comparison

## Objective

Compare GPT-6 Luna and GPT-6.1 Sol on identical synthetic Receiver fixtures,
record safety failures, useful results, latency and usage-derived cost bounds.

## Scope

Prepare the harness, focused negative tests and a read-only comparison report.
At most 20 generation calls and $1 total reserved allowance for this episode.
No automatic provider retry, real user data or model cascade. Keep the deployed
verifier off until synthetic evaluation and credential/cost prerequisites pass.

## Authority

On 2026-10-15 the owner accepted the proposed small Luna/Sol comparison within
the earlier proposed 20-call/$1 pilot boundary. Local code, tests and synthetic
provider evaluation and the earlier enumerated test/integration preparation
are authorized. Existing provider, per-check consent and
monthly $25/daily $5 direction is retained. Credentials are entered directly by
the owner in protected mechanisms, never read into chat or reports. Production
model selection is not inferred from fixture success or a new policy ratified.

## Constraints

Installed Governance, active Canon and C-012 govern. No source transcript,
bearer, ownership credentials or actual Receiver answer enters this experiment.
Preserve unowned work. Do not retrieve a Vercel Secret for local execution.

## Verification

Allowlisted models, standard service tier, complete request cost guard,
reservation before dispatch, usage-only metrics, fixed identical fixtures,
nonpassing results under uncertainty and sequential at-most-20 calls.
No live-provider result is claimed before an observed credentialed execution.
Use the main-only GitHub synthetic-alpha environment for a single manual
comparison workflow. The owner confirmed the dedicated OpenAI project, spend
limit and Vercel key registration; GitHub secret registration is checked
separately. No Vercel secret is exported to an agent or runner.
Local typecheck, production build and Governance checks passed during
preparation. The live command without opt-in was skipped with no provider call;
this is not live evaluation evidence. Usage/cost/run-gate negative tests cover
the new execution boundary. Exact hosted CI follows the integration PR.

## Stop Conditions

Missing project/key/spend limit, exhausted reservation, unknown usage or service
tier, provider error, critical false-ALIGNED result, authority conflict or any
need to exceed the authorized calls/cost. Never blindly restart a partial run.

## Completion Criteria

Record the exact evaluated artifact, model-specific results and remaining
limitations. Recommend the least expensive candidate meeting the bounded
fixture criteria; do not claim a field false-positive rate from this sample.

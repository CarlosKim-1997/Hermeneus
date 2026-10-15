# Synthetic verifier comparison T-026

This is an engineering experiment, not a model-quality guarantee or Canon.
The owner approved at most 20 generation calls/$1. Ordinary CI never calls the
model. Keep the deployed verifier off until prerequisites and evaluation pass.

## Credential and execution

Use the same dedicated OpenAI project, with owner-confirmed monthly $25 enforced
limit, in Vercel Production and GitHub's main-only `synthetic-alpha` environment.
The owner registers `OPENAI_API_KEY` directly in each secret UI. Do not
retrieve a Vercel Secret for transfer. No key is passed in CLI arguments or logs.

`OPENAI_API_KEY` belongs to verification only. Registering it does not enable
legacy source extraction or server-generated Receiver answers: those adapters
require the separately configured `OPENAI_EXTRACTION_API_KEY` and `OPENAI_MODEL`.
Leave that legacy credential unset for the personal-AI workflow. The verifier
also still requires `HERMENEUS_EXTERNAL_VERIFIER=openai`; key registration is
not activation. A Vercel secret is not available to the GitHub evaluation runner;
the existing GitHub environment needs its own direct secret registration.

After the exact PR and integrated main pass all four required CI jobs, manually
dispatch `verifier-comparison.yml` on main, supplying that main CI run ID.
The guard checks current trusted main CI again immediately before evaluation.
It allows only the first workflow dispatch in this workflow's history and run
attempt 1. Repeated/concurrent/rerun campaigns fail closed. Never remove run
history or a local ledger to bypass this restriction. Inspect a failed or killed
run and its sanitized ledger before proposing a separately authorized remainder.

## Experiment

Ten frozen synthetic answers use one packet, alternating model order per case.
Both models use low reasoning, Standard service tier, max 2,000 output tokens,
the same structured schema and deterministic aggregator, no tools and no retries.
The request byte guard includes the full serialized body/schema and uses a
conservative one-token-per-byte bound and the more expensive Sol cache-write
input rate ($2.50/M) plus output ($10/M), checked 2026-10-15. The caller reserves
$0.05 durably before each call; unknown outcomes retain their reservation.
This relies on the documented Standard rates and text tokenization; recheck if
model pricing, service tier, schema or input representation changes.

The sanitized artifact includes fixture IDs, requested/returned model, status,
verdict, latency and token usage. Its cost column is a conservative usage-derived
upper estimate (all input charged at cache-write rate), not the provider's actual
invoice. Provider billing/usage must be reconciled separately. Raw prompts,
answers, explanations and secrets are not saved. `store:false` is used; ordinary
provider processing/abuse retention still applies.

Stop on provider error, unknown usage/tier, exceeded bound or a critical
false-ALIGNED result. Report exact matches, safe but unhelpful INDETERMINATE
results, critical failures, latency and cost separately. Refusing everything is
not a useful verifier. Do not automatically select a production model or add a
paid cascade based on ten fixtures. The sample cannot estimate field error rate.

For a provisional pilot recommendation, require no critical false-ALIGNED, all
three supported answers ALIGNED, at least eight exact expected verdicts out of
ten, and no technical/unknown-billing failure for that model. If neither meets
these bounded engineering criteria, recommend neither and keep verification off.
These are evaluation criteria, not a change to Canon or proof of deployment
safety. Compare actual token counts and latency separately from verdict quality.

The local equivalent is `npm run test:verifier-comparison`, opt-in only with
`RUN_VERIFIER_COMPARISON=1`, `VERIFIER_PROJECT_SPEND_CAP_CONFIRMED=1` and a dedicated
key already supplied securely in the process environment. It writes a single-use
gitignored ledger under `work/.verifier-comparison/`. Do not run locally as well
as in GitHub during this same 20-call episode.

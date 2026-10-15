---
schema: task/v1
id: T-027
status: IN_PROGRESS
areas:
  - handoff
depends_on:
  - T-026
related_to:
  - C-005
  - C-012
  - D-013
---
# Bounded Sol verifier activation and synthetic Alpha smoke

## Objective

Activate the existing Sol verifier in protected synthetic Alpha and check the
actual consent, verdict, budget reservation and failure path.

## Scope

At most five additional provider calls and $0.25 reserved allowance, synthetic
data only. Narrow the server budget to the approved smoke window before
activation; retain the existing five-cent reservation, daily/monthly ceilings,
no retries and fail-closed behavior. No source extraction or server answer
generation activation. Preserve the completed T-026 evaluation evidence.

## Authority

On 2026-10-15 the owner explicitly approved Sol activation in synthetic Alpha
and the proposed at-most-five-call/$0.25 end-to-end check. This covers the
necessary scoped configuration, ordinary implementation/testing, integration
and protected synthetic deployment under the previously authorized release
process. Provider credentials stay in secure mechanisms. No real-data release,
normative change, schema migration, target restore or protection relaxation is
authorized. Credential presence does not expand this authority.

## Constraints

Installed Governance and active Canon govern. Preserve all-deployment Vercel
authentication, synthetic-only Seoul Free target, Sender/Receiver personal-AI
workflow and per-check consent. Do not retrieve provider secret values or
persist bearer tokens, user answers or consent. App budget writes caused by
the approved smoke are expected; do not reset their reservation to retry.

## Verification

Before activation, target budget query returned no rows. Target configuration
was verifier off, Receiver interpretation/expression deterministic and a
Production sensitive OPENAI_API_KEY present. Browser inventory returned no
enabled surfaces; both Chrome and IAB creation returned unavailable. Continue
independent preparation, but do not claim actual-screen verification without
an observed browser result.

Verify scoped budget parsing/expiry before DB/provider, atomic concurrency cap,
consent rejection before DB/provider, exact CI and release SHA, readiness,
effective settings and target budget delta. Record the actual observed scope.

## Stop Conditions

Missing authority, real data, wrong target, uncertain external side effect,
exhausted five-call/25-cent allowance, critical false ALIGNED or key disclosure.
No blind retries. Pause only browser-dependent steps if no browser is available.

## Completion Criteria

Exact deployed artifact and bounded configuration observed; actual synthetic
screen checks, budget delta and cleanup recorded, with no false-success claim.
Any unavailable execution surface remains an explicit unverified boundary.

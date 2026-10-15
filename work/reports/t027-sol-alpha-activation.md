# T-027 Sol synthetic Alpha activation — 2026-10-15

## Observed activation

The owner approved the recommended Sol activation and at most five additional
synthetic calls/$0.25 reserved allowance. PR
[#49](https://github.com/CarlosKim-1997/Hermeneus/pull/49) HEAD
`52298b32fbb5cbd69bc4fcf259767a92864ab26a` passed four required jobs in
[38682556709](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38682556709).
Integrated main `6193e601e457d4634e4405d0c34af53c2f82c306` passed four jobs in
[38682801606](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38682801606).
Release [38682997295](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38682997295)
passed staging, protected readiness, temporary-access cleanup and promotion.
Fresh metadata showed the primary `hermeneus-alpha-synthetic.vercel.app` points
to `dpl_AuMFL9s3NG93HXy6N2dbQUnbyR7F`, READY in icn1 at that exact main SHA,
with zero temporary protection-bypass entries.

Production project settings (plain values only) observed:

- `HERMENEUS_EXTERNAL_VERIFIER=openai` (runtime model remains gpt-6.1-sol).
- `HERMENEUS_VERIFIER_SMOKE_MONTH=2026-10`.
- `HERMENEUS_VERIFIER_SMOKE_LIMIT_CENTS=25`.
- Sensitive `OPENAI_API_KEY` present; no legacy `OPENAI_EXTRACTION_API_KEY`.
- Preview verifier remains off. Receiver interpretation/expression remain
  deterministic. No source-generation activation or secret-value retrieval.

The lower cap reuses the atomic monthly reservation ledger. The observed target
ledger was initially empty; five five-cent reservations fit, a sixth cannot.
Concurrent requests share the same cap. Partial/invalid settings and a different
UTC month deny requests before DB access. Expiry is not a recurring allowance.
The ordinary monthly $25 and daily $5 ceilings are not increased. Do not remove
the smoke settings or erase reservations to authorize more calls.

## Verification

Six focused smoke-budget/credential/consent tests, typecheck, production build,
Governance and whitespace passed locally. Hosted PostgreSQL integration passed
the new test: eight concurrent attempts yield exactly five successful
reservations, three denials and 25 cents in both day/month counters.
Internal adversarial review checked partial settings, expiry, initial-insert
minimum, lower ceiling, atomic conflict updates and rollback. This is not an
independent third-party assurance.

The target Supabase `dzaibwrrylxlrxbgnyaw` budget query returned no rows before
activation and again after release. **Zero additional provider calls and zero
target reservations** were observed during this episode. Comparison T-026's
20 calls are a separate exhausted episode, not these five calls.

## Remaining actual-screen check

This session's browser inventory returned no enabled browsers. Both Chrome and
IAB creation returned `Browser is not available`; opening the primary Handoffs
page through the app returned queued. No browser protection was weakened and
no alternate credential or provider-key extraction was attempted.

Thus this is activation/readiness evidence, not a completed live UI smoke or
proof of deployed provider success. T-027 remains IN_PROGRESS. When browser
access is restored, recheck target/SHA/configuration and current budget before
any call. Use only a synthetic Published Handoff and a freshly issued Share
fragment, never store its bearer in a report or log.

Planned live checks: consent absent means no call; five consented synthetic
answers cover supported, contradicted, unsupported, Korean/emoji-supported and
irrelevant-citation outcomes. Check per-request consent reset and budget delta
after each request, including unknown failures. After five reservations, a
further attempt must be nonpassing without another provider call. Inspect any
unexpected outcome before proceeding; do not reset counters or repeat blindly.
No additional approval is needed to resume these already approved five calls.

Real-data readiness remains blocked by the separate target and operational
requirements in Current State. All-deployment authentication and synthetic-only
operation remain required.

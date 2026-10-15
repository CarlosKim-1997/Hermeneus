# T-026 synthetic verifier comparison — 2026-10-15

## Execution evidence

Evaluated commit: `4d341b90a8c9da0f3857b9fbb2efcdf82ec1b8ab`.
Exact main CI [38666670825](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38666670825)
passed all four required jobs. Name-only inspection confirmed GitHub
`synthetic-alpha` secret `OPENAI_API_KEY`, current main and no previous campaign
before the owner-authorized dispatch. No secret values were retrieved.
Comparison [38671965919](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38671965919)
completed successfully on its first attempt: 20 calls, ten per model, expected
returned model names and Standard/default tier throughout. No retries.

Its `t026-comparison-ledger` artifact (seven-day retention) was downloaded to
ignored `work/.verifier-comparison/run-38671965919/t026.json`. This record
preserves the summary after hosted artifact expiry. All $1 of campaign
reservation capacity was consumed. No real data, shared DB mutation or service
activation occurred.

## Results

| Measure | GPT-6 Luna | GPT-6.1 Sol |
| --- | ---: | ---: |
| Exact expected aggregate verdicts | 6/10 | 10/10 |
| Supported answers accepted | 2/3 | 3/3 |
| Critical cases incorrectly ALIGNED | 0/7 | 0/7 |
| INDETERMINATE | 4 | 0 |
| Mean call and aggregation time | 6.383 s | 14.143 s |
| Median time | 5.862 s | 11.686 s |
| Input tokens | 12,642 | 12,642 |
| Output tokens | 5,956 | 5,608 |
| Conservative usage-derived total cost estimate | $0.00455825 | $0.087685 |
| Predeclared provisional pilot criteria | Not satisfied | Satisfied |

Luna returned INDETERMINATE for `unicode-support`, `invented-rationale`,
`invented-intent`, and `hidden-unsupported-claim`. The other six fixtures
matched expectations; Sol matched all ten. Luna did not silently pass those
unsupported claims, but did not produce their expected useful verdicts and
also refused the supported Korean/emoji answer. The sanitized ledger excludes
claim spans and explanations, so the exact cause of these outcomes is not
established. A UTF-16 span defect cannot be inferred from the Unicode case alone.

## Cost and limitations

Combined conservative usage-derived estimate: **$0.09224325**. This is not an
invoice or observed account charge. All input is charged at the cache-write
rate without cached-token discounts. Reconcile provider billing separately.
Official [pricing](https://developers.openai.com/api/docs/pricing?tab=suite)
was rechecked at execution: Standard short-context Luna cache writes/output
$0.125/$0.50 per million tokens and Sol $2.50/$10.00, as used by the harness.

One sample per model/case on ten fixed synthetic cases does not establish field
accuracy, a general false-positive rate, long-answer reliability, or an SLA.
This does not exercise the deployed browser/consent/budget/DB path with an
active provider. This 20-call campaign is exhausted; the difference between
the allowance and estimated usage is not permission for additional calls.

## Recommendation and next boundary

Recommend **GPT-6.1 Sol** for the provisional synthetic Alpha pilot. It is the
only candidate meeting the predeclared criteria: zero critical false ALIGNED,
all three supported answers accepted, at least 8/10 exact verdicts, and no
technical/unknown-billing failure. Do not choose Luna solely for cost or add an
automatic paid fallback. This recommendation does not ratify policy or
automatically select/activate a production model.

The service verifier remains off. Next approval: activate the existing Sol
verifier in the protected synthetic Alpha, with a separately bounded end-to-end
check of consent, verdict, budget reservation and failures. Sender proposal
generation remains in the Sender's personal AI. The verifier key alone cannot
activate legacy server generation. Real-data readiness remains subject to
the infrastructure and operational gates in Current State.

# T-031 deployed UI hydration correction

2026-10-20. Non-normative execution evidence within the owner's UI release authorization.

## Observed release

UI PR #51 merged as c27b86f386bf7ca273bc229f3463c51f610b1ad7 after all four required checks. Main CI 39412666303 passed. Synthetic Alpha release 39412931678 attempt 1 stopped at the readiness HTTP/cache guard and kept the primary domain on its prior artifact; the exact failure cause was not established. One unchanged failed-job rerun passed every guard and promoted dpl_dBhmdLC87oh3J635RBnitgMxuKJn (icn1, same c27 commit).

Actual browser inspection of the primary service succeeded through existing Vercel SSO and Google sign-in. Library filters/search, local JSON preview with unchecked notes/title options, published statements and owner Reader outline worked without data mutations or provider calls. Console inspection then found React hydration error #418. A ShareCapabilityPanel with existing link metadata rendered dates with implicit locale/time zone, producing different SSR and browser text.

## Correction and review

Use shared explicit UTC ISO metadata labels for creation, revocation, erasure and publication timestamps and library dates. No stored timestamps, content, schema, permissions, consent, provider configuration or deployment guards change. Invalid metadata displays a readable fallback. Reviewed the exact presentation diff, direct shared helper imports, client directive boundaries and synthetic test isolation; no extra state, effect or dependency is added to production components.

## Regression evidence

Playwright preview server runs in UTC. A ko-KR / Asia/Seoul browser hydrates a synthetic published version with an existing revoked link and dates spanning midnight, plus Reader, erased-source and library states. A fixture-only effect marks completed hydration; errors are collected from both pageerror and console. Assert the literal UTC labels as well as absence of errors.

- Red: the new regression against pre-correction product files failed with React's exact server/client text mismatch: server 10/19/2026, 11:30:05 PM versus browser 2026. 10. 20. 오전 8:30:05. Existing 13 tests passed. Fixed source files were restored from a path-scoped backup in finally.
- Green: 14 UX tests passed, including the same cross-time-zone hydration check.
- Node 22 typecheck: passed.
- Unit suite: 131 tests / 19 files passed.
- Governance and whitespace checks: passed.
- No dependency, CI, protection, Canon, target DB or paid API changes.

Local evidence under the isolated release worktree:
- dist/utc-hydration-red.log
- dist/ux-verify-9565664de35342309fbbb27a712a8e6d/test-results/ux
- dist/utc-hydration-green.log
- dist/ux-verify-410ea6d6d47e497cb5205b4a97a518a8/test-results/ux

Required exact-head hosted CI, normal merge, guarded release and fresh real-screen/console confirmation are still required for this correction. This record does not claim those future results.

# Change control and build provenance (repository)

Non-normative operator notes for Hermeneus. Canon is unchanged.

## Source of truth

The authoritative source for application code is the Git commit SHA on `main` (or the merge commit that lands a reviewed PR onto `main`).

## Hosted CI

Every pull request targeting `main` and every push to `main` runs the **CI** workflow (`.github/workflows/ci.yml`). On a `pull_request` run, the default checkout tests GitHub's temporary merge commit (`GITHUB_SHA`), while the run and required checks are associated with the PR head commit. The `verify` job records `GITHUB_SHA` in its job summary; the other jobs do not currently write a SHA summary. On a `push` to `main`, the jobs check out the actual `main` commit.

Release and deploy operations **must record the actual `main` commit SHA** that passed the post-integration `push` CI before that artifact or environment is promoted. A passing PR check alone verifies its tested merge candidate, not a later integration commit. Deployment-provider propagation (environment variables, container labels, release notes) is deferred to later production-hardening work (Slice B+); this document does not claim deployed-artifact provenance is complete.

## Protected `main`

Direct changes to `main` should go through a pull request with required CI checks. See `work/reports/t020-hosted-verification-evidence.md` for the exact required check contexts configured on the repository.

## Local verification parity

Developers should use the Node version in `.nvmrc` (aligned with `package.json` `engines`). Live OpenAI evaluation suites are opt-in locally and are **not** required for merge.

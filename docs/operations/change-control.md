# Change control and build provenance (repository)

Non-normative operator notes for Hermeneus. Canon is unchanged.

## Source of truth

The authoritative source for application code is the Git commit SHA on `main` (or the merge commit that lands a reviewed PR onto `main`).

## Hosted CI

Every pull request targeting `main` and every push to `main` runs the **CI** workflow (`.github/workflows/ci.yml`). Each job runs against the exact commit GitHub checked out; logs and the job summary record `${GITHUB_SHA}` for that run.

Release and deploy operations **must record the same commit SHA** that passed CI before that artifact or environment was promoted. Deployment-provider propagation (environment variables, container labels, release notes) is deferred to later production-hardening work (Slice B+); this document does not claim deployed-artifact provenance is complete.

## Protected `main`

Direct changes to `main` should go through a pull request with required CI checks. See `work/reports/t020-hosted-verification-evidence.md` for the exact required check contexts configured on the repository.

## Local verification parity

Developers should use the Node version in `.nvmrc` (aligned with `package.json` `engines`). Live OpenAI evaluation suites are opt-in locally and are **not** required for merge.

# Governance snapshot

This directory contains the repository-owned Governance protocol. `SPEC.md` is normative; `schemas/` summarizes record shapes; `manifest.yaml` selects the adopted protocol and Current State. `OPERATIONS.md` is non-normative guidance for keeping State, Task Authority, external evidence, and workspace lifecycle small and recoverable.

Project-specific authority lives in `canon/`. Tasks and reports live in `work/`.

Run:

```sh
node tooling/governance/check.mjs
```

for deterministic structural validation. A PASS does not prove semantic correctness.

Optional read-only helpers:

```sh
node tooling/governance/preflight.mjs
node tooling/governance/context.mjs T-123
```

`preflight.mjs` observes local Git/worktree facts and never fetches. `context.mjs` suggests context candidates from existing areas and relations; it is advisory and never proves complete applicability or permission.

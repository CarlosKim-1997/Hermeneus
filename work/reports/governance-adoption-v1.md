# Greenfield Governance Adoption — Hermeneus

Date: 2026-09-25

## Adoption basis

Hermeneus was greenfield. The only committed content before adoption was `README.md` containing the title, at `1745d51fea821184de63c8c9fbd23e623a310cf1` on `main`.

The requested upstream protocol repository `CarlosKim-1997/repository-governance` returned GitHub 404 to this environment, including authenticated repository lookup. It was not modified.

The installed files are the Repository Governance 1.0.0 snapshot already vendored in `CarlosKim-1997/CarlosLab` at `d9d325857fdb61fd5979fc925514aebbc0c61df2`:

- `AGENTS.md`
- `governance/SPEC.md`
- `governance/schemas/*`
- `tooling/governance/check.mjs`
- `tooling/governance/version.json` (governance 1.0.0, checker 0.1.0, distribution 0.1.0)

CarlosLab's project Canon was not copied. `governance/README.md` text matches that snapshot's generic governance readme. `governance/manifest.yaml` is project-local.

Greenfield procedure from SPEC Part II.K: install the skeleton, then record only Canon the human owner had already ratified. No dummy open questions were created.

## Authority recorded

- D-001 product boundary
- D-002 provider-neutral ingestion
- D-003 canonical handoff authority
- D-004 receiver epistemic protocol
- C-001 published immutability
- C-002 provenance cannot override an approved handoff
- C-003 no silent gap filling
- T-001 milestone 1 execution contract

## Provenance limit

This report does not grant authority. If a later fetch of `repository-governance` differs from the CarlosLab snapshot, reconcile through the upgrade procedure in SPEC Part II.L before treating either side as a silent overwrite.

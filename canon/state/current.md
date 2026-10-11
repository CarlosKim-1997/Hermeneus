---
schema: state/v1
status: READY
areas:
  - handoff
---
# Current Project State

## Current Position

This branch proposes vNext authority for Sender-AI bootstrap proposals with Creator review, optional legacy source ingestion, external Receiver AI, and independent Canon-grounding verification (D-011–D-013, C-011–C-012). Human review and integration remain pending; vNext protocol and runtime paths are not yet implemented.

Milestones 1–11 are integrated into `main`. M12 Creator Data Lifecycle / Layered Erasure semantics are human-ratified in Canon. Published canonical meaning and Published provenance are physically separated in storage (T-016). Handoff-level Source Erasure and Whole-Handoff Erasure are implemented and verified (T-017). Creator Account Erasure, active/erasing Creator lifecycle with Creator-wide mutation serialization, external identity lifecycle erasure, lifecycle-aware session behavior, and Account deletion/recovery UX are implemented (T-018).

## Active Work

None.

## Blockers

None.

## Material Risks

- The vNext bootstrap and external Receiver workflow is not implemented; existing runtime continues to follow M1–M12 paths.

- Production hardening (including deployment-level protections beyond the current development vertical slices) remains incomplete.
- Share Capability infrastructure and access-log redaction for share URLs remain deferred (see C-005).
- Legal retention/hold and team ownership transfer are outside current product scope.
- Hosted deterministic CI and protected-main change control are configured. Mandatory merge verification covers governance, typecheck/build, deterministic application suites, PostgreSQL migrations/integration tests, E2E, and production-critical dependency audit. Live LLM evaluation remains opt-in and is not a mandatory merge gate.

## Verification Basis

This State describes the vNext proposal pending human review. No production, deployment, runtime, or database verification of the new path is claimed.

M1–M11 integration is present on `main`. M12 lifecycle policy was human-ratified under T-014; T-015 recorded the implementation architecture; T-016 adds provenance/storage foundation; T-017 adds verified Handoff-level erasure; T-018 adds verified Account Erasure and Creator lifecycle controls.

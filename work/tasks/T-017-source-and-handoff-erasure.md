---
schema: task/v1
id: T-017
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-016
related_to:
  - D-009
  - D-008
  - C-006
  - C-008
  - C-009
---
# M12 Source Erasure and Whole-Handoff Erasure

## Objective

Implement authenticated, owner-scoped, transactional Source Erasure and Whole-Handoff Erasure, including Creator UX and adversarial concurrency/integrity tests.

## Scope

In scope: HandoffErasureRepository, draft save serialization, publication/extraction/provenance-read hardening, Creator lifecycle UX, deterministic integration/application tests, architecture and Current State updates.

Out of scope: Account Erasure, Creator lifecycle schema, advisory locks, identity deletion, typed DELETE account UX, Canon changes, production mutation, merge.

## Authority

Authorized on `cursor/m12-handoff-erasure-t017` for erasure code, tests, docs, Current State update, commit, push, draft PR.

Not authorized to merge, implement Account Erasure, or change ratified Canon.

## Constraints

M12 Canon and T-015/T-016 engineering contracts bound semantics. Destructive operations are single PostgreSQL transactions with in-transaction ownership re-verification.

## Verification

Representative adversarial completion evidence (reconciliation HEAD):

- **Source Erasure:** E17-S1–S4, S5, S6, S7, S8, S9, S10 (in-flight model + post-check), S11 (internal + shared surface), S12 (transaction rollback via injected trigger).
- **Concurrency:** `repos.drafts.save`→erase (draft `UPDATE` advisory barrier); erase→draft save; `repos.published.publish`→erase (published version `INSERT` barrier); erase→publish; provenance read→erase and erase→provenance read via `repos.receiver.getProvenance` (external `FOR SHARE` holds erase only).
- **Whole-Handoff:** H1 multi-version/multi-share delete with SQL counts; H2 shared view/Q&A/provenance fail closed; H3–H5; H6 delete rollback; H7 share vs delete linearization (Handoff `FOR UPDATE` gate + share `INSERT` advisory barrier with `issueShareCapability`).
- **Security:** SA11–SA14 server-action auth for erase/delete (anonymous UNAUTHENTICATED; non-owner NOT_FOUND, no mutation).
- **Application:** U15 `SOURCE_UNAVAILABLE` extraction facing code; E17-CR1 `loadCreatorReview` `kind: "erased"` without source identifiers.
- **E2E:** `e2e/handoff-lifecycle.spec.ts` (erase source UX; delete two-step confirm); `e2e/share-surface-isolation.spec.ts` (revoke sync fix; full suite green).

Commands:

- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — PASS
- `npm run typecheck` — PASS
- `npm run test:integration` — 72 PASS
- `npm run test:share` — 17 PASS
- `npm run test:application` — 34 PASS
- `npm run test:auth` — 65 PASS
- `npm run test:receiver` — 11 PASS
- `npm test` — 14 PASS
- `npm run test:e2e` — 11/11 PASS
- `npx playwright test e2e/share-surface-isolation.spec.ts --repeat-each=3` — PASS
- `npx playwright test e2e/handoff-lifecycle.spec.ts` — 2 PASS

## Stop Conditions

Stop on Canon conflict, production DB requirement, or scope creep into T-018 Account Erasure.

## Completion Criteria

Atomic erasure, concurrency-safe draft/share/provenance paths, UX, deterministic tests PASS, governance PASS.

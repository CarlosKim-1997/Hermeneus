---
schema: task/v1
id: T-011
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-010
related_to:
  - D-006
  - C-006
  - D-007
  - C-007
---
# Creator Handoff Library (Milestone 11)

## Objective

Give authenticated Creators an owner-scoped library of their Handoffs to resume review or open the latest published version without opaque URLs.

## Scope

Owner-scoped `listSummariesForOwner`, `/handoffs` Server Component, authenticated home redirect, minimal Creator navigation, deterministic L1–L7 and E2E library flows.

## Authority

Authorized on `cursor/creator-library-m11`. Not authorized to merge.

## Constraints

C-006 ownership unchanged. No client-side owner filtering. No delete/search/teams. No model calls for listing.

## Verification

Governance PASS. Deterministic: application 32 (L1–L7 library), auth 61, receiver 11, receiver-semantic 10, receiver-answer 22, share 17, unit 14, integration 29, extraction 15. E2E 7 (library isolation, published link, anonymous `/handoffs` → login). typecheck, migrate, build PASS.

## Stop Conditions

Stop if library query can return another Creator's Handoff or requires new Canon for read-only navigation.

## Completion Criteria

Authenticated Creator uses `/handoffs` to list only owned Handoffs, open Review/latest Published, and create New Handoff; isolation and regression tests green.

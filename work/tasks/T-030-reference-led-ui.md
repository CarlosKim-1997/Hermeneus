---
schema: task/v1
id: T-030
status: COMPLETE
areas:
  - handoff
related_to:
  - T-029
  - D-013
  - C-005
  - C-008
  - C-012
---
# Reference-led interface redesign

## Objective

Inspect multiple real services' public product interfaces and official UI examples, select useful interaction patterns, and apply a coherent local Hermeneus redesign.

## Authority

The owner explicitly delegated this research and local implementation on 2026-10-20, without requiring the current layout to be preserved. This episode permits local UI/documentation edits and regression checks. It does not infer commit, push, merge, deployment, real DB mutation, paid provider calls, new normative authority or participant contact. Preserve the earlier T-028/T-029 uncommitted work. The owner's actual user and Chat roundtrip tests remain paused.

## Scope

Public, read-only reference research; distinguish observed official screenshots from authenticated product use and design hypotheses. Rework workspace navigation/library, creation, review, published reading/sharing and receiver wayfinding.

## Constraints

Preserve canonical text, order, item identities/types/priorities, version binding, private-title opt-in, temporary notes/answers, disclosure/consent, capability secrecy and deletion boundaries. Do not claim that the prototype MCP route is connected to real shares. No imported third-party branding/assets or tracking.

## Verification

Record reference URLs, selection/rejection rationale, exact artifact hashes, viewport/keyboard and focused regression evidence. Use synthetic UI fixtures and disposable local application/database tests. No live third-party Chat test.

Completed: official reference study and local implementation, 180 unit PASS, 13 UX PASS at 390/820/1280px, 14 unique application E2E cases PASS across full and focused correction runs, one existing localhost-only Readiness SKIP; typecheck, Governance and diff checks PASS. Evidence/limitations: `work/reports/t030-reference-led-ui.md`. No integration or external release is implied.

## Stop Conditions

Escalate changes to product authority, data lifecycle, security access or unapproved external mutation. Routine reversible design and test failures are handled locally.

## Completion Criteria

Reference analysis with traceable adaptations, working local redesign, regression results, screenshots and an explicit account of remaining user validation.

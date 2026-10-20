---
schema: task/v1
id: T-029
status: COMPLETE
areas:
  - handoff
related_to:
  - D-013
  - C-005
  - C-008
  - C-012
  - T-028
---
# End-to-end UX refinement

## Objective

Make the existing Sender preparation/review/share and Receiver reading/personal-AI/verification journeys understandable, coherent and accessible.

## Scope

Inventory screens and states; document research questions, evidence, prioritized problems, design changes and a future participant protocol. Refine local product UI across library, creation, review, publication/share, receiver, account/authentication and recovery states. Verify on synthetic local fixtures using the actual components. Keep proposed new product capabilities distinct from present behavior.

## Authority

On 2026-10-20 the owner asked Codex to take responsibility for the complete UI refinement process, including investigation planning and reinforcement methods. This permits local design/documentation/code edits and necessary local regression checks. Remote push, merge, public deployment, actual DB changes, paid API calls and new Canon authority are not inferred. The owner paused their hands-on user test and actual Chat roundtrip work until they resume it; this episode does not restart that test or contact participants.

## Constraints

Preserve existing permissions, payload/schema/version semantics, external disclosure and per-check consent, optional private title opt-in, non-persistent review notes and answer handling, immutable publication and deletion confirmation. Display wording may clarify machine classifications but must not change their meanings or invent Sender requests. Do not present the MCP prototype as an integrated production route. Do not claim user research occurred without participants. No new tracking, retention or recordings. Preserve the pre-existing T-028 working tree.

## Verification

Capture the baseline, exact local artifact, synthetic fixture scope, screenshots, keyboard/responsive and negative states, typecheck and relevant regression results. Distinguish component-level fixture evidence from live service/API/DB verification. Record the user test as deferred.

The local refinement episode is complete: unit 180 PASS; synthetic UX browser 10 PASS; isolated real Next/PostgreSQL E2E 14 PASS and one existing localhost-only Readiness case SKIP; typecheck, Governance and diff check PASS. Research plan and future user protocol: `docs/UX_DESIGN_PLAN.md`. Review findings, fixes, artifacts and limitations: `work/reports/t029-ux-refinement.md`. Actual human and Chat roundtrip tests remain deferred; no external release is implied.

## Stop Conditions

Escalate normative changes, new data collection, unapproved external access or product promises unsupported by current authority. Continue reversible UI work independently.

## Completion Criteria

A complete screen/state inventory and research protocol, coherent local UI implementation with no known blocking UI regressions, evidence and an actionable future user-test script. T-028 actual Chat/provider gates remain separately visible.

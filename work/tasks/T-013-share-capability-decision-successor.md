---
schema: task/v1
id: T-013
status: COMPLETE
areas:
  - handoff
related_to:
  - D-005
  - D-008
  - T-012
---
# Share Capability Decision successor canonicalization

## Objective

Canonicalize the human-ratified current Share Capability access model by superseding D-005 with D-008, without changing product/runtime behavior.

## Scope

In scope:

- create D-008
- change only D-005 lifecycle status from ACTIVE to SUPERSEDED
- preserve D-005 historical body
- verify relationships and Governance structure
- commit, push, open draft PR

Out of scope:

- product/runtime code
- migrations
- D-006 rewrite
- D-007 rewrite
- Constraints changes
- M12
- Current State bookkeeping
- Governance Core changes
- merge

## Authority

Authorized on `cursor/d008-share-capability-successor-t013` for this execution episode:

- inspect repository authority
- create T-013
- canonicalize the already human-ratified D-008
- change D-005 status to SUPERSEDED
- commit
- push
- open a draft PR

Not authorized to merge, change product/runtime behavior, invent additional normative changes, alter D-006/D-007/C-005/C-006/C-007, mutate production or external systems, or perform destructive Git operations.

## Constraints

Human ratification for D-008 was supplied explicitly in the task prompt; the agent did not infer or ratify new policy. Repository Governance 1.0 / Distribution 0.2 semantics unchanged.

## Verification

- D-005 status changed to SUPERSEDED; historical Decision body preserved
- D-008 ACTIVE created with human-ratified successor semantics and specified formal relationships
- `node tooling/governance/check.mjs` — PASS
- `git diff --check` — clean
- No runtime/product files changed; diff limited to D-005, D-008, and T-013

## Stop Conditions

Stop if baseline SHA differs materially from authorized main, structural checker fails, or diff exceeds authorized Canon/Task scope.

## Completion Criteria

D-008 ACTIVE and D-005 SUPERSEDED committed; structural checker PASS; draft PR opened unmerged; product/runtime unchanged.

# Codex review operations for Hermeneus

This is non-normative execution guidance. It records the owner's 2026-10-12
review-routing instruction; it does not grant permission to edit, commit, push,
merge, deploy, change Canon, mutate a database, or spend on an external API.
Installed Repository Governance, active Project Canon, the authorized Task,
explicit human permissions, and observed GitHub protection settings govern
their respective boundaries.

## Review and verification

1. For authorized R0/R1 implementation, Codex plans, implements, reviews the
   exact local diff, runs relevant tests, fixes findings, and rechecks the final
   artifact. A read-only Codex `/review` or `codex review` run, or a separate
   read-only Codex subagent, may provide a second context. Record the review
   scope and findings. For a PR, verify its configured CI against the exact
   HEAD before declaring it ready. External ChatGPT audit is not a routine
   completion gate.
2. For behavioral changes affecting security, database behavior,
   authentication, or data deletion, require an adversarial Codex review and
   focused negative and regression tests. Check the intended access, lifecycle,
   failure, and rollback boundaries. Review documentation-only changes against
   their actual effect and evidence needs. Internal challenge is not a claim of
   independent third-party assurance.
3. Stop affected work for new normative rules, material Canon meaning changes,
   unapproved external operations, destructive or operationally irreversible
   actions, missing authority, or a material Canon/reality conflict. Security
   relevance alone does not create a new policy approval or ChatGPT audit gate.
4. Run external ChatGPT audit only when the owner explicitly requests it or a
   separately approved execution contract requires it. Its protocol then
   governs that requested audit's inputs and report, not ordinary Codex work.

## GitHub and evidence

Codex review, including a subagent or built-in review, does not submit an
approving GitHub review. Check the actual branch protection or ruleset for the
target branch and exact PR. If it requires an approving review, satisfy that
GitHub requirement through an eligible reviewer or a separately authorized
exception. Do not infer a platform requirement from a ZIP, past prompt, or
general recommendation. Likewise, passing CI does not grant merge permission.

At each handoff, identify the exact commit or working-tree diff, test commands
and results, hosted CI run when applicable, adversarial findings and fixes,
unverified boundaries, and permissions still needed. When proposing an
independent reviewer, label the reason as Repository Governance, active Canon,
the approved Task, observed GitHub protection, or a recommendation.

## Reconciliation of historical handoff documents

The following files exist in the historical
`hermeneus_codex_reconciled_v0_1.zip` `integration/` directory, not in the
installed repository. The earlier `hermeneus_codex_full_handoff.zip` also
contains versions of all four. They remain design and execution-contract
history. The owner's 2026-10-12 instruction supersedes their conflicting review
routing for current work, unless a separately approved current execution
contract requires an external audit. This document records that instruction;
the ZIP's product design content retains only its lower-priority design-input
role.

| Historical file | Review-routing conflict | Current reading |
| --- | --- | --- |
| `CODEX_AUTONOMY_CONTRACT.md` | R1 requests ChatGPT audit after a slice; R2 calls it mandatory; R3 calls for independent risk review. | Apply the risk-sensitive internal review above. Human decisions and separately authorized side effects remain required; external audit is opt-in unless a later approved contract requires it. |
| `CODEX_IMPLEMENTATION_HANDOFF.md` | Describes ChatGPT review at risk boundaries and a ready-for-audit exit. | Its S2/S4/S5 wording already conditions ChatGPT audit on human initiation. Report a reviewable handoff without requesting one automatically. |
| `INTEGRATION_EXECUTION_PLAN.md` | Section 5 treats self-review as preliminary to independent external audit. | Use internal adversarial review, negative tests, and CI for the approved implementation. Request external audit only under the trigger above. |
| `EXTERNAL_AUDIT_PROTOCOL.md` | Its Review triggers section calls several audits mandatory, including before integration or deploy. | Activate this protocol only for an owner-requested or separately contracted external audit. It does not set ordinary PR gates. |

Earlier prompts and ZIP instructions cannot override installed Governance,
active Canon, current human authorization, or observed GitHub protection.

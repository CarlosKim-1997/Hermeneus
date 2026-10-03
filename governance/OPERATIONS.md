# Operating guidance

This guide is procedural guidance for Repository Governance 1.0.0. It does not create authority, change schema validity, or replace the SPEC. If this guide conflicts with the SPEC, the SPEC governs.

## 1. Keep different truths on different surfaces

Use the smallest durable home that matches the fact.

| Fact | Natural home |
| --- | --- |
| Binding product/project choice | ratified Decision |
| Hard reusable boundary | Constraint |
| Material unresolved uncertainty | Open Question |
| Permissions for one execution episode | Task Authority |
| Detailed verification for that episode | Task Verification |
| Historical execution/integration provenance worth keeping | Work report or external history |
| Current actionable project position | Current State |
| Live CI/deployment/service health | the external system, with bounded repository observation when useful |
| Branch/worktree identity | Git/workspace inspection, not Project Canon by default |

Do not copy a fact into a more authoritative or hotter bootstrap surface merely to make it visible.

## 2. Closing Tasks without rewriting history

A terminal Task preserves the execution episode that actually happened.

- Keep `## Authority` as the permissions held during that episode.
- A later human merge, release, or deployment does not retroactively enlarge that Authority.
- If a terminal Authority section is wrong, correct it only to restore the historical authorization.
- Put useful later outcome facts in Verification, a Work report, Git/PR history, or another natural provenance source.
- Do not create a reconciliation episode solely to say that a human merged already-complete work.

An optional prose `## Outcome` section may be experimented with locally, but it is not part of `task/v1` and is not required.

## 3. Compress Current State

Current State exists to help a fresh worker choose the correct next action.

Normally exclude:

- ordinary branch names and PR status;
- merge chronology;
- completed Task registries;
- long CI/deployment run histories;
- historical test-count ledgers;
- superseded operational observations;
- execution diaries;
- facts already durably recoverable elsewhere with no effect on the next action.

A useful inclusion test is:

> If this fact vanished from Current State but remained recoverable from its natural source, would a fresh worker choose a materially wrong next action?

If no, it usually does not belong in Current State.

`Verification Basis` should be representative rather than exhaustive. Preserve exact artifact identity and enough basis to recover confidence; point to Task/report/external detail instead of duplicating the ledger.

## 4. Integration is not a default Canon event

A branch merge, PR merge, deployment, or verification result may matter, but the event itself does not automatically require Canon mutation.

Update Canon or State when the event materially changes:

- normative truth;
- current project position;
- the next valid action;
- a blocker;
- a material current risk;
- another durable coordination fact.

Otherwise let Git, PR, CI, release, or report history carry the event.

Normal lifecycle can therefore be:

```text
bounded Task
→ implementation and verification
→ Task closes accurately
→ authorized human/integrator merges
→ no reconciliation record unless durable/current truth actually changed
```

## 5. Write Decisions for durable reading

Prefer Decision text that remains normatively readable after implementation evolves.

Good durable statements:

- provider identity must remain replaceable;
- production publication requires explicit human authorization;
- published snapshots are immutable.

Usually transient:

- authentication is not implemented yet;
- deferred for this milestone;
- currently unavailable;
- planned for the next release.

Temporal words such as `currently`, `not yet`, `for now`, `deferred`, and `future milestone` deserve review. They are valid in a Decision when the temporal boundary is itself the ratified policy, not merely implementation status.

When a material Decision changes, existing whole-object supersession remains the deterministic v1 mechanism. Restating a complete successor package is verbose but avoids hidden field-level inheritance. Do not invent partial-amendment semantics locally.

## 6. Treat external live state as external

Hosted CI, deployment platforms, databases, provider health, and similar systems own their own live observations.

Repository records may preserve:

- exact verified artifact SHA;
- a bounded observation;
- verification class;
- observation time/environment;
- a recovery pointer.

Do not create an endless chain whose only purpose is recording the newest CI/deployment result inside the repository.

A repository claim about an external system is an observation at a point in time, not permanent ownership of that live truth.

## 7. Workspace entry and retirement

Before mutation, when Git is available, inspect at least:

- repository/worktree root;
- branch or detached state;
- HEAD;
- expected integration baseline when known;
- ahead/behind against a locally available comparison ref when available;
- tracked/untracked cleanliness relevant to the work;
- linked worktrees.

The installed optional helper:

```sh
node tooling/governance/preflight.mjs
node tooling/governance/preflight.mjs --json
node tooling/governance/preflight.mjs --expect origin/main
```

is read-only and does not fetch the network. An `origin/main` result therefore describes the locally fetched remote-tracking ref, not guaranteed remote freshness.

After integration or Task closure:

- identify the surviving reference/integration baseline;
- retire finished mutation worktrees when practical;
- clearly label forensic divergence that must be preserved;
- do not silently begin later work from a stale sibling checkout.

A central lock service is not required by Governance 1.0.0.

## 8. Advisory context discovery

The optional helper:

```sh
node tooling/governance/context.mjs T-123
node tooling/governance/context.mjs work/tasks/T-123.md
node tooling/governance/context.mjs T-123 --json
```

suggests a bounded preload from existing areas and formal relations.

Its output is advisory. Areas are discovery filters, not ownership or permission, and unloaded authoritative material may still apply. Never treat helper output as proof that all binding authority has been found.

## 9. Semantic health audit

The structural checker remains deterministic and non-semantic. Periodically perform a read-only semantic health review when the cost is justified.

Useful triggers include:

- a major milestone boundary;
- several significant Task closures;
- public/production rollout;
- Governance upgrade preparation;
- repeated reconciliation work;
- discovery of a Canon/reality mismatch.

Review for:

- Current State/reality mismatch;
- history or CI ledgers accumulating in State;
- terminal Task Authority rewritten as outcome;
- the same current fact maintained on multiple writable surfaces;
- transient implementation language aging inside ACTIVE Decisions;
- ambiguous or missing supersession;
- deprecated status/milestone documents still updated as current truth;
- unsupported "latest" external-state claims;
- inflated Tasks/OQs;
- Work detail leaking into Canon;
- stale or divergent mutation workspaces.

Record findings as non-normative Work provenance unless a genuine normative change needs human ratification.

## 10. Minimality is also exclusion

Do not persist a fact merely because it was important during execution.

Normally avoid durable Canon for:

- short-lived operational observations;
- ordinary merge events;
- live external health already observable at its source;
- duplicate history already preserved by Git/PR/report;
- transient facts with no recovery value after Task closure;
- execution diaries.

The goal is not fewer records at any cost. The goal is fewer durable truth surfaces while preserving what future workers genuinely need.

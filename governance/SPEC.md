# Repository Governance 1.0.0

This SPEC is the semantic authority for the reusable protocol. The five schema files are compact normative structural references derived from it and must remain consistent with it. Adoption guides provide procedural guidance. Project Canon supplies project-specific truth.

## Part I — Core Rules

Repository Governance preserves only durable coordination truth. Humans hold normative authority; agents may inspect, propose, implement within delegated scope, verify, and report, but may not ratify their own policy or enlarge their authority. Default deny applies. Editing, committing, pushing, integrating, releasing, and external mutation are distinct permissions. Credentials grant no permission.

Repository Authority is Governance plus Project Canon. Canon has exactly five conceptual types: prose Principles, Decisions, Constraints, one Current State, and Open Questions. Tasks and reports belong to Work. Normative truth, observable truth, and Canonical State differ. If State and reality conflict, investigate and reconcile; neither silently wins. Agent claims are not evidence.

Bootstrap through `AGENTS.md`, then `governance/manifest.yaml`, this SPEC's Core Rules, Current State, applicable active Constraints, the current Task, and direct dependencies. Expand context only as needed. Start with authoritative paths and explicit IDs before searching broadly. Unloaded material can still be authoritative.

Principles guide judgment but cannot defeat Governance, Constraints, or a specific active Decision. Decisions require explicit human ratification: `PROPOSED` → `APPROVED` → authorized canonicalization → `ACTIVE`. Material changes supersede with a new ID. Constraints are active boundaries; Invariants are Governance-only and never overridable. A scoped exception to an overridable Hard Constraint needs a human-ratified Decision. Open Questions hold material unresolved uncertainty. State is one mutable current summary, not a history. Significant Tasks are bounded execution contracts and cannot create authority.

Use immutable repository-wide IDs `D-*`, `INV-*`, `C-*`, `OQ-*`, `T-*`; no State or Principle ID. Formal relationships are directed, typed, and checked. Stop and escalate for missing authority, normative conflict, material scope expansion, unauthorized side effects, or Canon/reality conflict. Do not guess approval.

Verification must identify the exact artifact and observed state. A checker PASS proves structure only. Before Canon mutation, reread authoritative sources and concurrent changes. Use isolated branches/worktrees or serialized writes; never overwrite unowned work. Destructive Git, history rewrite, production mutation, release, and destructive external action require explicit authority. Observe an interrupted external side effect before retrying it. Secrets belong in secure mechanisms, not Governance files.

Handoffs pass actionable state and verification basis, not hidden reasoning. Reports are Work provenance, not authority. A roadmap is optional intended future, never Current State. The installed checker is deterministic, read-only, offline, and structural. Governance, distribution, and checker versions are separate. Keep repository truth smaller than the work it governs.

## Part II — Extended Specification

### A. Governance Model

Owner Authority is human. Delegated Authority is bounded execution permission. Implementation Judgment covers reversible choices within that scope. A choice future workers must preserve after a rewrite may need durable normative treatment. Governance Invariants are absolute. Applicable Hard Constraints remain binding unless Governance permits a scoped exception and a valid human-ratified Decision provides it within its declared scope. Ordinary Decisions operate inside applicable Constraints. A Task may narrow delegated execution but cannot widen normative authority or defeat applicable Governance or Canon. Human approval of one action does not imply another.

### B. Bootstrap and Discovery

Root `AGENTS.md` is a small router and must not duplicate mutable State, Task details, registries, or this SPEC. Nested instructions cannot override Repository Authority. Manifest schema is `governance-manifest/v1` and requires `schema`, `governance_version: 1.0.0`, unique `areas` including `global`, `current_state`, and `supported_schemas` containing the five v1 schemas. Unknown manifest fields are errors. Area names match `^[a-z][a-z0-9-]*$`. Areas are discovery filters, never ownership or permission. An object's `[global]` is valid, but `global` cannot be combined with another area. `current_state` is a repository-local path into `canon/state/`. No external or escaped path is valid.

### C. Project Canon

`canon/principles/PROJECT.md` is prose, may initially contain no Principles, and has no formal schema or IDs. Recommended prose lifecycle is ACTIVE, SUPERSEDED, RETIRED. Principles are not relation targets. Decision records in `canon/decisions/` use `decision/v1`, ID `D-[0-9]+`, statuses PROPOSED, APPROVED, ACTIVE, SUPERSEDED, REJECTED, DEFERRED, and headings Decision, Context, Rationale, Consequences. Vague positivity is not ratification. A material change to an ACTIVE Decision creates a new Decision.

Constraint records use `constraint/v1`, headings Constraint, Rationale, Operational Effect, and statuses ACTIVE, SUPERSEDED, RETIRED. Governance constraints live in `governance/constraints/`; Project constraints in `canon/constraints/`. `INV-[0-9]+` requires kind INVARIANT and Governance location. `C-[0-9]+` requires kind HARD_CONSTRAINT. Project Invariants are forbidden. Optional `overridable` defaults false and must be boolean. Invariants cannot be overridable. No proposed Constraint object exists: retain proposals outside active Constraint Canon until ratified. An ACTIVE Decision or Constraint with `supersedes` points to a SUPERSEDED target. A narrow exception may be an explicit Decision only for a Hard Constraint with `overridable: true`; it must state scope, reason, validity, and compensating conditions where applicable. It does not supersede the Constraint. There is no waiver or override schema.

Open Questions in `canon/open-questions/` use `open-question/v1`, IDs `OQ-[0-9]+`, statuses OPEN, BLOCKING, RESOLVED, DROPPED, and headings Question, Why It Matters. They record material future-relevant uncertainty, not a backlog. BLOCKING identifies specific blocked work, not necessarily the whole project. RESOLVED and DROPPED are terminal. `resolved_by` is a scalar Decision ID, required for RESOLVED, forbidden for OPEN/BLOCKING, optional for DROPPED. Evidence IDs are unsupported in v1.

Exactly one `state/v1` record exists in `canon/state/`, at `manifest.current_state`; it has no ID or formal relationships. It has statuses NOT_READY, READY, IN_PROGRESS, BLOCKED, VERIFYING, COMPLETE, CANCELLED and headings Current Position, Active Work, Blockers, Material Risks, Verification Basis. State is current-position compression, not a history, roadmap, Task registry, or test log. Freshness is semantic, not age-based.

### D. Work Domain

`task/v1` lives in `work/tasks/`, uses `T-[0-9]+`, the State status vocabulary, and headings Objective, Scope, Authority, Constraints, Verification, Stop Conditions, Completion Criteria. Create a Task only when coordination, risk, dependency, verification, or handoff pressure justifies it. Scope says what work belongs; authority says which actions are allowed. Omitted high-risk permission is denied. COMPLETE and CANCELLED end an execution episode; later work gets a new Task. Implementation, commit, push, and branch test do not individually prove Task completion. Stop on missing authority, Constraint conflict, material scope expansion, ambiguous ownership, unauthorized destructive or external action, or material Canon/reality inconsistency. Preserve safe partial work.

Reports under `work/reports/` preserve useful provenance for migration, milestones, high-risk work, long-lived partial work, or recovery. They have no normative authority. Roadmaps, if used, describe intended future and are not Canon.

### E. Identity and Relationships

Stable IDs are immutable, repository-wide unique, never reused, and may have gaps. Numbering conveys no authority or guaranteed chronology. No central next-ID registry. Allowed edges are `depends_on`, `blocked_by`, `supersedes`, `implements`, `related_to`; Open Questions alone also support scalar `resolved_by`. Store general edges as nonempty YAML lists, with no duplicate targets, self-references, unresolved IDs, or reverse aliases. Direction: dependent → dependency; blocked object → blocker; new → old for supersedes; implementation → normative source; OQ → authoritative Decision for resolved_by.

Allowed targets: Decision depends_on D/INV/C, blocked_by OQ/T, supersedes D, implements D, related_to D/INV/C/OQ/T. Governance Constraint depends_on Governance INV/C, supersedes same Governance kind, implements Governance INV/C, related_to any stable class. Project Hard Constraint depends_on D/INV/C, supersedes Project C, implements D/INV/C, related_to any stable class. OQ depends_on D/INV/C/OQ, related_to any stable class, resolved_by D. Task depends_on T, blocked_by OQ/T, implements D/INV/C, related_to any stable class. State has no formal edges. There are no formal Principle targets.

Reject cycles in `depends_on`, combined Task execution edges (`depends_on` and Task-to-Task `blocked_by`), `supersedes`, and `implements`. `related_to` cycles are allowed. Relations serve recovery and traceability, not a complete knowledge graph.

### F. Verification and Evidence

There is no `evidence/v1` or `E-*` object in v1. Evidence may be static, executable, integration, external, or human acceptance support in prose. Verification gates are UNVERIFIED, SATISFIED, NOT_SATISFIED, or BLOCKED as conceptual report language, not a new object lifecycle. Bind claims to exact artifact, command, environment, and observation; material changes invalidate earlier evidence. Checker PASS never proves semantic correctness.

### G. Concurrency and Mutation Safety

Reread Canon immediately before writing; make a narrow authorized delta. Do not resolve normative conflicts by naive text merge. Isolate concurrent work with branches/worktrees or serialize writes. Integration revalidates the resulting artifact. Editing, local commit, push, integration, history rewrite, destructive Git, and release are separate authority boundaries.

### H. External Systems

Distinguish READ_EXTERNAL, CALL_EXTERNAL, MUTATE_EXTERNAL, COST_INCURRING, RELEASE_EXTERNAL, and DESTRUCTIVE_EXTERNAL. Credentials do not grant authority. Production mutation, release, destructive external action, and significant cost require explicit approval. Observe whether an interrupted side effect happened before a retry. Do not place secret values in Governance, Canon, Tasks, reports, or source just to expose them to agents.

### I. Escalation and Recovery

Use clear Decision Requests, Approval Requests, Conflict Reports, Risk Escalations, or Information Requests; these are communication patterns, not schemas. A Decision Request states question, urgency, facts, options, trade-offs, affected work, blocking status, and needed response. Distinguish a project choice from permission for an action. Handoff passes Task, status, material changes, verified/unverified basis, blocker, and next valid action. Receiver revalidates reality.

### J. Structural Validation

The checker follows bootstrap → manifest → discovery → local schema → ID map → typed relations → cycles → lifecycle → State → sorted findings. It is read-only, deterministic, offline, and non-semantic. Exit 0 means no ERROR (including WARN-only), 1 means structural ERROR, 2 means tool/runtime failure. Diagnostics expose severity, stable rule ID, file, record ID where possible, message, and target where relevant. Unknown manifest field is ERROR; ordinary unknown record field is WARN; known forbidden or reverse relation is ERROR. The checker neither repairs nor allocates IDs. A second State file in `canon/state/` is ERROR.

### K. Adoption

Greenfield creates a NOT_READY State and empty collections; no fake Canon or Tasks. Brownfield begins with a read-only authority survey and Git baseline, then installs a safe skeleton. Mechanical installation cannot infer historical ratification. Classify old material as Canon candidate, supporting evidence, working context, or obsolete/noise; label historical authority KNOWN, PARTIALLY_RECOVERABLE, or UNKNOWN. Migrate only justified items, write State late, neutralize competing legacy authority without deleting history, verify, audit, and write `work/reports/governance-adoption-v1.md`. A checker PASS does not complete semantic adoption.

### L. Upgrade

An upgrade is explicit plan → review → apply → verify. Compare original upstream A, project copy B, target upstream C. Classify unchanged, local-only, upstream-only, or both-changed. Core/schema/checker are normally upstream-owned, Canon and Work project-owned, AGENTS and manifest mixed. Never overwrite Canon automatically. For semantic upgrades update `manifest.governance_version` only after migration and validation. Mixed versions require explicit resolution.

### M. Distribution and Release

Installed Core and checker are vendored repository-owned snapshots, functional offline without the upstream repository, package registry, Git, or project dependencies. Governance Version, Distribution Release Version, and Checker Version are independent. Distribution 0.x remains prerelease until the release gate passes. A release contains a versioned archive, `governance-distribution-manifest/v1`, and SHA-256 checksums. No external publication is implied by building artifacts.

### N. Compatibility and Evolution

Governance 1.0 supports exactly five structured schemas plus prose Principles. New first-class types, ID prefixes, or semantic authority changes require a new explicit protocol version and migration. The installed manifest declares the version the project has adopted, not the latest available upstream.

### O. Minimality and Health

Govern what must survive; leave ordinary work ordinary. Review for stale State, duplicated authority, inflated Tasks/OQs, unsupported verification claims, and conflicting legacy sources. No central service, database, lock manager, generated context index, semantic AI in checker/installer, or automatic policy inference is required.

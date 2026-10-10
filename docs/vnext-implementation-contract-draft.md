# Hermeneus vNext implementation contract (draft)

**Status:** Non-normative integration proposal. This document grants no permission to implement, push, merge, run an external model, migrate a live database, or deploy. Installed Repository Governance and active Project Canon on the eventual implementation base take precedence. PR #23 is proposed Canon until human review, ratification, and authorized integration.

**Inputs:** The Phase 1–4 design files in `hermeneus_codex_full_handoff.zip`, the integration plan, and the owner's 2026-10-11 conflict resolutions. The ZIP is design evidence, not repository authority. This draft replaces no historical design file.

## Gates before implementation

1. Integrate PR #22 only after separate human approval. Observe the resulting `main` commit and its four required checks: `verify`, `postgres`, `e2e`, `dependency-audit`. A PR check on a temporary merge ref is not post-integration `main` evidence.
2. Bring PR #23 onto that observed `main` without rewriting another worker's branch. Reconcile Current State, retain the owner's review of D-011–D-013 and C-011–C-012, and run the installed Governance checker plus all required hosted checks on the updated PR. Proposed `ACTIVE` frontmatter on an unmerged branch is not installed Canon.
3. Obtain a separately bounded S1–S6 implementation delegation. Local implementation permission does not imply push, PR mutation, merge, live database mutation, paid external model use, or deployment permission.

## One wire and lifecycle contract

| Boundary | Frozen first-slice choice | Authority guard |
| --- | --- | --- |
| Sender input | `hermeneus.portable-proposal/v0`; strict JSON shape, unique proposal IDs, existing eight item types and three priorities. `title` is optional and nonblank when present. | The Phase 1 draft schema currently requires `title`; update the schema, prompt, examples, and validator together before implementing. Shape validation is not source fidelity or Creator approval. |
| Review notes | `reviewNotes` may be present in the input. Display them before Draft creation, require explicit acknowledgment, then discard the raw Proposal and notes. | Do not persist notes in the first slice or imply they are recoverable on the Review page. Any future retention is a separate lifecycle decision. |
| Navigation title | An optional owner-only `display_title` may be stored as Handoff navigation metadata, erased with the Handoff or Creator account. | It is not a Canon item, Published meaning, provenance, or Receiver Packet field. |
| Original source | `IMPORTED_CONVERSATION` retained/erased and `BOOTSTRAP_PROPOSAL` not-collected are distinct, enforced states. | Never create synthetic conversation messages, source references, excerpts, or erasure timestamps for a bootstrap Proposal. |
| Publication | Existing Draft revision check and explicit Creator approval create an immutable Published version. | Server assigns Handoff and item IDs. Draft save and Publish both reject impossible source references; existing imported-source and erasure paths remain intact. |
| Receiver Packet | `hermeneus.receiver-packet/v0`, projected from the exact authorized Published version; packet-local `HI-###` aliases; RFC 8785 JCS SHA-256 digest over the packet without its digest field. | No bearer token, internal Handoff ID, Creator credentials, title, notes, raw source, or unavailable provenance. Digest and `publicationRef` grant no access. |
| Receiver Submission | `hermeneus.receiver-submission/v0` with the answer, optional question, and packet identity. | Re-resolve the capability, version, aliases, and digest server-side. Do not trust user-supplied Canon, citations, or identity fields. Do not persist raw submitted answers by default. |
| Verifier Result | `hermeneus.receiver-verdict/v0.1` with source spans, atomic claims, answer-claim coverage, question coverage, issues, and limitations. | Phase 3 verdict v0 cannot express the required coverage proof and is not an acceptable positive-verdict contract. Do not present v0 as equivalent to v0.1. |

## Verdict rule

The verifier inventories all substantive answer spans, keeps UTF-16 offsets against the submitted text, independently reviews coverage, checks cited aliases against the pinned Canon, and uses bounded semantic grounding. The aggregate is deterministic:

1. Invalid or unavailable authorization/identity → `INVALID` or a generic unavailable response.
2. Reliably detected contradiction or Sender status flip → `CONTRADICTED`.
3. Material `AMBIGUOUS` claim, unresolved substantive span, incomplete coverage, provider failure, timeout, or cap exhaustion → `INDETERMINATE`.
4. Material Sender claim lacking Canon support → `UNSUPPORTED`.
5. Grounded claims with missing citations, separately disclosed external facts, or required question omissions → `PARTIAL`; this label never excuses an unsupported Sender claim.
6. `ALIGNED` is possible only after complete reviewed claim coverage, required valid support, and no remaining negative or uncertain condition. It says nothing about objective truth, unseen source fidelity, or human comprehension.

No model-generated `complete=true` flag alone proves coverage. A revoked capability must fail closed again immediately before an asynchronous result is returned. Any user-visible result must disclose that copied third-party AI content cannot be retroactively revoked.

## Verification and outstanding decisions

- Exercise strict JSON parsing (including duplicate keys, UTF-8 byte limits and Unicode), proposal mapping, three source states, atomic bootstrap creation, Draft/Publish source guards, owner isolation, erasure, packet JCS vectors and version pinning, revoked-share races, claim omissions, status flips, hidden claims in lists/tables, model failures, and legacy M1–M12 regression.
- Use Node 22, disposable PostgreSQL 16 and Playwright for local parity. Run the installed Governance checker, typecheck, build, deterministic suites, PostgreSQL integration and E2E. Bind every result to the tested commit and distinguish local from hosted evidence.
- A specific external verifier provider, disclosure/retention terms, and model spending limit are **not** authorized by this draft. A material change to access, retention, erasure, Published meaning, or verification promise requires a human decision before implementation. No live model call or live DB migration belongs to this preparation episode.

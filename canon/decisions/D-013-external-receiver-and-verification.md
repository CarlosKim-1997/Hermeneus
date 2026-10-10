---
schema: decision/v1
id: D-013
status: ACTIVE
areas:
  - handoff
supersedes:
  - D-004
depends_on:
  - D-009
  - C-003
related_to:
  - D-008
  - C-002
  - C-005
---
# External Receiver interpretation and independent verification boundary

## Decision

A Receiver may use a personally selected third-party AI to explain and discuss the exact version-pinned Published Canon. Hermeneus supplies a bounded Receiver Protocol and canonical content packet. A prompt is behavior guidance, not enforceable authority over an external provider.

A compliant Receiver AI may personalize order, language, difficulty, examples, analogies, and question phrasing. It may not transform confirmed decisions into options, revive rejected directions, fill OPEN or UNKNOWN with invented Sender choices, introduce Sender intent or causal rationales absent from the approved Canon, or disguise external knowledge as approved Canon content.

Receiver answerability retains the distinct classifications SUPPORTED, DERIVED, OPEN, UNKNOWN: SUPPORTED requires direct canonical support; DERIVED is only an unusually direct consequence adding no Sender policy, intent, assumption or decision; OPEN is explicitly unresolved by the Sender; UNKNOWN is insufficiently represented and is a legitimate result.

The Receiver AI's submitted text and asserted citations are untrusted. Hermeneus verifies the output against the exact pinned published version through deterministic packet/citation/structure checks and a separate bounded semantic grounding check before labeling the response as Canon-aligned. Claimed citations are not proof. Contradiction, unsupported material claims, missing evidence, model uncertainty, malformed output, version mismatch, or verifier failures may not be silently converted into a passing verification result.

Verifier results concern only the reviewed output relative to the provided Canon snapshot. They must not imply factual truth outside Canon, fidelity of the Sender AI's proposal to uncollected history, or actual human comprehension. A recipient-understanding claim requires a separate Receiver-produced demonstration of understanding and a distinct assessment boundary.

External AI packets must exclude live bearer capability tokens, ownership credentials and unavailable/erased provenance. The external provider can receive the canonical packet the Receiver elects to paste; a local Hermeneus verifier does not make such third-party disclosure disappear.

The existing internal deterministic/grounded Receiver remains an optional controlled implementation; it does not define the primary vNext product boundary. This Decision does not require a separate verifier model family, specific LLM provider, or human understanding certification in the first release.

## Context

D-004 assumed the Receiver interpretation could be constrained before display by Hermeneus. In the external-Receiver path, model-generated statements appear outside Hermeneus's control and may only be checked after submission. The historical M7 generator/verifier separation provides reusable implementation patterns, but does not itself establish arbitrary external-output verification quality.

## Rationale

Personalization is a useful capability of recipients' existing AI services. The Sender's semantic authority cannot be delegated to such services. Separating generation from after-the-fact verification preserves the core epistemic boundary without attempting to recreate a general chat product. Verdicts must be narrow enough not to overclaim user understanding or semantic truth.

## Consequences

- Preserve conservative OPEN/UNKNOWN handling and constrained DERIVED semantics.
- Define output annotation and verifier result vocabularies separately from Canon item types and answerability classes.
- Generalize existing M7 grounding only in a separately authorized implementation phase.
- Treat arbitrary external AI output as untrusted and reject unsafe or indeterminate verification assertions.
- Do not claim that prompt compliance alone guarantees integrity.

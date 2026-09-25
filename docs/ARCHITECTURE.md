# Architecture

This note points at the Hermeneus layout. Durable rules are D-001 through D-004 and C-001 through C-004.

## Flow

```text
generic text
  -> GenericTextAdapter
  -> NormalizedConversation
  -> (optional) Model-backed HandoffExtractor
  -> Validated ExtractionProposal
  -> Creator review / accept / edit
  -> Draft save
  -> Approve & Publish (expected draft revision)
  -> immutable PublishedHandoff
  -> interpretPublished (deterministic receiver)
```

Source conversation **import provider** (ChatGPT export, Claude, Gemini, generic text) is separate from **extraction model provider** (OpenAI in Milestone 4). Extraction adapters do not alter Handoff domain schemas.

## Modules

| Path | Role |
| --- | --- |
| `src/import` | Adapter boundary. Only `generic-text` is implemented. |
| `src/handoff` | Item schema, draft edits, immutable versions. |
| `src/extraction` | Proposal schema, validation, fixture and OpenAI-backed extractors. |
| `src/llm/openai` | First extraction-model adapter (Responses API, Structured Outputs). |
| `src/receiver` | Answerability and grounding. |
| `src/persistence` | Domain ports, receiver view types. |
| `src/persistence/postgres` | PostgreSQL adapter (`pg`, SQL migrations). |
| `src/application` | Use cases, server actions, extraction factory. |
| `src/app` | Creator UI (import, review, publish). |

Dependency direction is inward: adapters and model ports do not own handoff authority. The receiver reads a published version, not a provider payload.

Provider-specific data may remain on a normalized message as `source.provider`. Handoff items do not carry an extraction-provider field.

## Extraction authority

`HandoffExtractor` returns an `ExtractionProposal` (candidates without canonical IDs). Post-model validation enforces Creator-role provenance, exact excerpts, and candidate limits. Materialized suggestions use `createdBy: "EXTRACTION"` but are not persisted until the Creator saves the draft. Publication still requires explicit human approval with an expected draft revision.

Live extraction sends the persisted source conversation to the configured external model only when the Creator clicks **Generate AI suggestions** (`store: false` on OpenAI requests). No extraction prompt/response history is stored in PostgreSQL in this milestone.

## Publication

Publication locks the handoff and draft rows, verifies the expected draft revision, validates provenance, and inserts the next immutable version. Editing the draft afterward does not change earlier versions.

## Answerability

Lexical overlap with approved items supports a direct answer. A single conservative derivation covers "web search is disabled" implying the receiver will not browse. Staffing is not derived from a client choice. If nothing qualifies, the result is `UNKNOWN`. An `OPEN` item at the best overlap stays unresolved.

Model proposals that add claims absent from the cited items, or that try to answer `OPEN` or `UNKNOWN`, are discarded.

## Persistence (Milestone 2+)

Tables:

- `source_conversations` / `source_messages` — normalized provenance
- `handoffs` — root linked to a source conversation
- `handoff_drafts` — editable JSON snapshot with revision counter
- `published_handoff_versions` — immutable JSON snapshots; `BEFORE UPDATE` trigger rejects mutation

Publication runs in a transaction: lock the handoff row, lock the draft row, verify expected revision, validate provenance, compute the next version, insert only.

Receiver reads use `ReceiverReadRepository.getPublishedView`, which returns items without `sources`. Provenance is fetched separately through `getProvenance` and returns receiver-safe excerpts only.

## Creator UI (Milestones 3–4)

```text
Web UI (src/app)
  ↓ server actions
Application use cases (src/application)
  ↓
Domain / ports (src/handoff, src/import, src/extraction, src/persistence)
  ↓
PostgreSQL adapter / OpenAI adapter
```

The Creator UI may inspect the full imported source conversation through a Creator-only read path. Receiver read boundaries remain unchanged. AI suggestions are visibly non-authoritative until saved and published.

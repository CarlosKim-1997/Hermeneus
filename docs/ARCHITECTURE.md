# Architecture

This note points at the milestone 1 layout. Durable rules are D-001 through D-004 and C-001 through C-003.

## Flow

```text
generic text
  -> GenericTextAdapter
  -> NormalizedConversation
  -> HandoffExtractor (draft only)
  -> creator edit
  -> PublicationLedger snapshot
  -> interpretPublished
  -> grounding check when a model proposal exists
```

## Modules

| Path | Role |
| --- | --- |
| `src/import` | Adapter boundary. Only `generic-text` is implemented. |
| `src/handoff` | Item schema, draft edits, immutable versions. |
| `src/extraction` | Extractor interface and a fixture double. |
| `src/receiver` | Answerability and grounding. |
| `src/llm` | Unused live-model port. |
| `src/persistence` | In-memory store. Receiver views omit raw transcripts. |

Dependency direction is inward: adapters and the model port do not own handoff authority. The receiver reads a published version, not a provider payload.

Provider-specific data may remain on a normalized message as `source.provider`. Handoff items do not carry a provider field.

## Publication

`PublicationLedger.publish` copies the draft into the next version and freezes that snapshot. Editing the draft afterward does not change earlier versions.

## Answerability

Lexical overlap with approved items supports a direct answer. A single conservative derivation covers "web search is disabled" implying the receiver will not browse. Staffing is not derived from a client choice. If nothing qualifies, the result is `UNKNOWN`. An `OPEN` item at the best overlap stays unresolved.

Model proposals that add claims absent from the cited items, or that try to answer `OPEN` or `UNKNOWN`, are discarded.

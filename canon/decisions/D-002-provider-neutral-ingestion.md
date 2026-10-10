---
schema: decision/v1
id: D-002
status: SUPERSEDED
areas:
  - handoff
---
# Provider-neutral ingestion

## Decision

Source conversations enter through provider adapters and become a normalized conversation. After normalization, the core handoff domain must not depend on which provider produced the source.

Hermeneus may cooperate with official export mechanisms or APIs a provider documents in the future. It must not depend on undocumented scraping, and it must not invent a provider's export format.

Only a provider format the project actually possesses is implemented. Milestone 1 implements GenericTextAdapter. ChatGPT, Claude, Gemini, and generic JSON adapters are registration points only until real representative samples exist.

## Context

The human owner ratified provider-neutral ingestion on 2026-09-25. No official ChatGPT, Claude, or Gemini export sample is part of this repository.

## Rationale

Provider-specific structure is provenance detail. Letting it leak into the handoff domain would make every later feature re-learn each vendor's transcript shape.

## Consequences

- Adapter implementations stay outside the handoff domain.
- Do not add a parser that pretends to support an unseen export.
- Normalized messages may record the provider name as provenance metadata, but handoff rules must not branch on it.

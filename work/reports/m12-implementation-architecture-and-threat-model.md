# M12 Implementation Architecture & Threat Model

Date: 2026-10-06  
Task: T-015 (engineering design; non-normative)  
Normative baseline: `main @ b3c42d070db1a9d9ac000b8f2b9491ffbc351796` (T-014 / D-009, D-010, C-008–C-010)

This report evaluates an implementation architecture against **observed Hermeneus code and schema**. It does not ratify policy. Canon remains authoritative for semantics.

---

## 1. Recovered implementation reality

### 1.1 Persistence layout (PostgreSQL)

| Surface | Location | Role |
|---------|----------|------|
| Source | `source_conversations`, `source_messages` | Raw/normalized transcript storage; messages CASCADE with conversation |
| Handoff root | `handoffs` | `id`, **`source_conversation_id NOT NULL`** → `source_conversations` **ON DELETE RESTRICT**, `owner_creator_id` → `creators` |
| Draft | `handoff_drafts.snapshot_json` | Full `DraftHandoff` including **`items[].sources[]`** |
| Published | `published_handoff_versions.snapshot_json` | Full `PublishedHandoff` including **`items[].sources[]`** (copied from draft at publish) |
| Share | `share_capabilities` | FK `(handoff_id, version)` → `published_handoff_versions` **ON DELETE RESTRICT** |
| Creator | `creators` | Minimal row |
| External identity | `creator_external_identities` | `(provider, subject)` → `creator_id`; **UPDATE/DELETE blocked by trigger** |

Immutability triggers: published snapshots cannot UPDATE; share rows immutable except `revoked_at`; handoff `owner_creator_id` immutable.

**There is no erasure API, no DELETE path for handoffs/creators, and no provenance side table today.**

### 1.2 Canonical vs provenance coupling (current)

- Zod schemas (`src/handoff/schema.ts`) require every `HandoffItem` to include `sources: SourceReference[]` (messageId + optional excerpt).
- `PostgresPublishedHandoffRepository.publish` copies `draft.items` verbatim into `published_handoff_versions.snapshot_json` (`structuredClone`).
- **Receiver published view** strips `sources` at read time via `toReceiverItems` — but provenance reads **`item.sources` from the stored published JSON**, then joins `source_messages` for role/content validation (`PostgresReceiverReadRepository.getProvenance`).
- If a message row is missing, references are **silently dropped** (`filter(Boolean)`), not distinguished as “erased” vs “corrupt”.

### 1.3 Import and source sharing

- `importAndCreateHandoff` allocates a **new opaque** `conversationId` per import (`generateOpaqueId("conv")`); no cross-Handoff deduplication.
- Schema **allows** multiple `handoffs` rows to reference the **same** `source_conversation_id` (no UNIQUE on that column). Tests often reuse one conversation across multiple handoffs in one DB; production import path does not intentionally share.
- Deleting a conversation is blocked while any handoff references it (RESTRICT). No orphan-GC exists.

### 1.4 Authorization (current)

- Creator routes: `requireOwnedHandoff` checks session principal + `handoffs.owner_creator_id` match. Missing handoff → generic unavailable.
- **External auth** session: `AuthJsCreatorSessionProvider` validates `creators.exists(creatorId)` on each request.
- **Dev auth** session: signed cookie only; **does not** verify Creator row still exists.
- Share: bearer token hash lookup; invalid/revoked/missing → `"This share link is unavailable."` (`SHARE_UNAVAILABLE_MESSAGE`).

### 1.5 Publication / draft concurrency (current)

- Publish: transaction with `SELECT handoffs FOR UPDATE`, draft `FOR UPDATE`, `validatePublicationProvenance`, insert published row.
- Draft save: optimistic revision increment; **no** validation that source messages still exist or that sources were not erased.
- Extraction: loads conversation via `handoffs.source_conversation_id`; fails if conversation missing.

### 1.6 Share vs erasure (current)

- Revocation sets `revoked_at` only; published snapshot and source data untouched.
- Whole-Handoff deletion impossible without new orchestration (RESTRICT FKs from published versions and share capabilities).

---

## 2. Target architecture (evaluation)

### 2.1 Physical separation: canonical meaning vs provenance

**Recommendation: adopt** the proposed split.

| Store | Contents after M12 foundation |
|-------|----------------------------------|
| `published_handoff_versions.snapshot_json` | Canonical items only: `id`, `type`, `statement`, `priority`, `createdBy` — **no `sources`** |
| New `published_handoff_provenance` (name TBD) | Rows keyed by `(handoff_id, version, item_id, source_index)` or JSONB bundle per `(handoff_id, version, item_id)` with `message_id`, `excerpt` |

Draft JSON may retain `sources` while source is retained; after Source Erasure, draft items must have **`sources: []`** and writes referencing erased message IDs must **reject**.

**Receiver contract:**

- Internal Creator/Receiver provenance API: return per-reference status **`retained`** vs **`unavailable_erased`** (and optionally **`unavailable_missing`** for integrity failures during migration only).
- Shared surface (`SharedProvenanceBundle`): never expose `messageId`; map erased to `excerptAvailable: false` without fabricated excerpts; do not leak “erased” vs “never existed” beyond generic unavailability where C-009 requires.

Published view behavior (strip sources) already matches “meaning-only” externally; provenance becomes a **second read path** only.

### 2.2 Migration: extract `items[*].sources` from published snapshots

**Algorithm (online or maintenance window):**

1. For each `published_handoff_versions` row, parse snapshot; for each item, insert provenance rows; rewrite snapshot JSON without `sources` fields (preserve item identity, type, statement, priority, createdBy, version, publishedAt exactly).
2. Validate checksum/count: provenance row count equals pre-migration source reference count.
3. Re-run structural tests P7/P8/P13 patterns against migrated DB.

** Preconditions / hazards:** see §7.

### 2.3 Handoff source lifecycle column(s)

**Recommendation:**

```text
handoffs.source_conversation_id  NULL allowed after erasure
handoffs.source_erased_at         TIMESTAMPTZ NULL  -- set when Source Erasure completes
```

Semantics:

- `source_conversation_id IS NOT NULL` && `source_erased_at IS NULL` → retained source (current behavior).
- `source_erased_at IS NOT NULL` → source intentionally erased; `source_conversation_id` should be NULL (or retain ID only for audit — **Human Decision Required**, §8).
- `source_conversation_id IS NULL` && `source_erased_at IS NULL` → treat as **integrity error** (not valid post-migration normal state except mid-transaction).

Requires migration altering NOT NULL on `source_conversation_id`.

### 2.4 Source garbage collection (no dedup product feature)

Maintain **`handoff_source_refs(conversation_id)`** count or `SELECT EXISTS (SELECT 1 FROM handoffs WHERE source_conversation_id = $1)` before `DELETE FROM source_conversations`.

Erasing one Handoff’s association must not DELETE conversation if another Handoff still references it (possibly different owners). **Observed schema already allows shared conversation ID**; GC must be reference-counted, not “delete conversation when one Handoff erases.”

---

## 3. Erasure operations (transactional design)

All erasure entrypoints: **authenticated owner** (C-006) + **re-verify ownership inside transaction** (`SELECT handoffs ... FOR UPDATE` + owner check).

### 3.1 Source Erasure

**Order (single transaction):**

1. Lock handoff row (+ draft row FOR UPDATE).
2. Re-verify `owner_creator_id`.
3. Delete all rows in provenance table for `(handoff_id, *)` (all published versions + any draft-side provenance store if split).
4. Update draft snapshot: strip sources from all items; reject if client payload reintroduces message IDs when `source_erased_at` set (application validation).
5. Set `source_erased_at = now()`, `source_conversation_id = NULL` (or HD-required variant).
6. Commit; then **separately** GC source conversation if unreferenced.

**Post-conditions:**

- Published canonical meaning unchanged (same snapshot_json items minus sources already removed at foundation).
- Provenance reads return **`unavailable_erased`** for all items that had sources.
- `generateHandoffExtractionProposal` must fail closed with user-safe error (no re-extraction).

**Serialize against:** draft save, publish, extraction (handoff row lock + check `source_erased_at`).

### 3.2 Whole-Handoff Erasure

**Order (single transaction):**

1. Lock handoff FOR UPDATE; verify owner.
2. `UPDATE share_capabilities SET revoked_at = COALESCE(revoked_at, now())` for all capabilities on handoff (or DELETE rows — revocation sufficient for bearer lookup if rows remain; **DELETE** cleaner for FK teardown).
3. Delete provenance rows; delete all `published_handoff_versions`; delete `handoff_drafts`; delete `share_capabilities`; delete `handoffs`.
4. Commit; GC source if unreferenced.

**Post-conditions:** all bearer tokens → same **`unavailable`** as invalid/revoked (no row in `share_capabilities` with matching hash, or handoff gone → resolve fails).

Note: current FK requires deleting/revoking shares before published rows, or use ON DELETE CASCADE in a new migration (T-016).

### 3.3 Creator Account Erasure

**Order (C-009):**

1. Begin account erasure (see §4).
2. For each owned handoff: Whole-Handoff Erasure (nested or batched in one outer transaction — prefer **one outer transaction** with savepoints per handoff only if failure isolation required; C-009 prefers fail-safe atomicity).
3. GC orphaned sources.
4. Delete `creator_external_identities` via erasure-only path (§5).
5. Delete `creators` row.

**Re-login:** `resolveOrCreate` must create **new** CreatorId; mapping row absent after erasure → new lifecycle (D-010).

---

## 4. C-009 account-erasure mutation freeze — mechanism comparison

| Option | Description | Meets C-009? | Assessment |
|--------|-------------|--------------|------------|
| **A. Transaction/row locking only** | `FOR UPDATE` on creator/handoffs during erasure | **Partial** | Locks prevent concurrent mutations **only while transaction open**. New HTTP request after partial commit can still mutate unless state checked. |
| **B. Explicit Creator lifecycle state** | `creators.lifecycle_status ∈ {active, erasing, erased}` | **Yes** | Every Creator mutation begins with `active` check; transition to `erasing` at start of account erasure; reject imports/draft/publish/share issue. Clear failure messages internally; generic externally where needed. |
| **C. Advisory locks** | `pg_advisory_xact_lock(creator_id)` on all Creator work | **Partial** | Serializes concurrent sessions but does not block post-erasure if lock released and state still `active`; also easy to miss code paths. |

**Recommendation: B primary, with C as secondary serialization during erasure orchestration.**

- Set `lifecycle_status = 'erasing'` in the **first** statement of account erasure (same transaction as first handoff lock).
- All Creator entrypoints (`importAndCreateHandoff`, draft save, publish, share issue, extraction) call **`requireActiveCreator(creatorId)`** after auth.
- Use **`pg_advisory_xact_lock(hashtext(creator_id))`** inside account erasure to serialize erasure vs long-running publish (optional but recommended).

Option A alone is **insufficient** for C-009.

---

## 5. External identity trigger — erasure-only DELETE

**Current:** `creator_external_identities_immutable()` raises on UPDATE/DELETE always (`migrations/004`, `005`).

**Design:** Replace with guard:

```sql
IF current_setting('hermeneus.erasure_orchestration', true) = 'account_erasure' THEN
  -- allow DELETE only
ELSE
  RAISE EXCEPTION ...
END IF;
```

Set `SET LOCAL hermeneus.erasure_orchestration = 'account_erasure'` at start of account-erasure transaction (application or `SET LOCAL` via repository).

**Classification:** **Both** correctness guard (prevents accidental mapping deletion) **and** security boundary (mapping deletion only inside authenticated erasure orchestration). Not a substitute for app-layer auth.

---

## 6. Stale sessions after Creator deletion

**Observed gap:** Dev mode never checks `creators.exists`.

**Recommendation:**

1. Centralize in `requireCreatorPrincipalFromSession`: after resolving principal, **`requireActiveCreator(principal.creatorId)`** (lifecycle `active` + row exists).
2. External auth already checks existence but not lifecycle — extend to lifecycle.
3. OAuth callback / `resolveOrCreateCreatorForExternalIdentity`: if mapping deleted after erasure, create **new** creator (existing behavior) — ensure erased CreatorId not injected from stale JWT; refresh token/session should re-resolve mapping on each session load.

---

## 7. Migration preconditions & hazard matrix

| Case | Observed in repo? | Migration disposition |
|------|-------------------|------------------------|
| Same `source_conversation_id` on Handoffs with **different** `owner_creator_id` | Schema allows; import path does not create | **Safe to migrate** provenance extraction; **GC must remain reference-counted**. Flag in migration report if found in prod data. |
| Orphan `source_conversations` (no handoff) | Possible via test TRUNCATE partial / manual SQL | **Safe**; leave orphans or optional cleanup job (non-normative) |
| Published item references missing `source_messages` | Would fail publish today; legacy bad rows possible | **Quarantine**: migration script skips or fails handoff; manual review |
| Malformed `snapshot_json` (invalid Zod) | Unlikely if only app wrote DB | **Stop migration** for that row; quarantine |
| Duplicate message IDs in snapshot sources | Valid | Migrate as-is |
| Empty `sources: []` on published items | Valid | No provenance rows; strip field |
| Interrupted migration mid-handoff | N/A until run | **Idempotent per-row** migration with `provenance_migrated_at` column or version flag on published row |

---

## 8. Human Decision Required (not settled by Canon)

1. **Audit retention of `source_conversation_id` after Source Erasure** — NULL only vs retain opaque ID with erased timestamp for support logs (C-009 leak considerations).
2. **Share capability rows after Whole-Handoff Erasure** — hard DELETE vs revoke-only leave rows (bearer must fail either way).
3. **Draft `sources` after foundation migration** — keep in draft JSON until Source Erasure vs move draft provenance to side table immediately (implementation cost).
4. **Mid-account-erasure failure UX** — partial handoff deletion vs all-or-nothing outer transaction (C-009 favors latter).
5. **Dev auth parity** — whether dev sessions must observe lifecycle the same as external (recommended yes; confirm).

---

## 9. Threat model

Legend: **Inv** = invariant, **Mech** = serialization/failure mechanism, **Obs** = observable result, **Tests** = automated test class (to be implemented post–T-015).

### 9.1 Source Erasure vs Draft save

| | |
|--|--|
| **Inv** | Erased source cannot reappear in draft; approved meaning unchanged |
| **Mech** | Handoff `FOR UPDATE`; reject save if payload contains message IDs when `source_erased_at` set; revision conflict otherwise |
| **Obs** | 409/conflict or validation error; no silent strip |
| **Tests** | Application + Postgres integration (concurrent save threads) |

### 9.2 Source Erasure vs AI extraction

| | |
|--|--|
| **Inv** | No extraction after source erased (D-009) |
| **Mech** | Check `source_erased_at` / missing conversation before load |
| **Obs** | User-safe extraction error |
| **Tests** | Application |

### 9.3 Source Erasure vs publication

| | |
|--|--|
| **Inv** | Publish cannot attach provenance from erased source |
| **Mech** | Publish validates provenance + source state under handoff lock |
| **Obs** | Publication rejected if sources reference missing conversation |
| **Tests** | Integration |

### 9.4 Source Erasure vs provenance read

| | |
|--|--|
| **Inv** | No reconstruction of erased provenance (C-008, D-009) |
| **Mech** | Provenance table empty + erased flag → `unavailable_erased` |
| **Obs** | Creator/internal: explicit unavailable; Share: no excerpt, no IDs |
| **Tests** | Integration + share suite |

### 9.5 Whole-Handoff Erasure vs share issuance

| | |
|--|--|
| **Inv** | Cannot issue capability for erased handoff |
| **Mech** | Handoff existence check; lock |
| **Obs** | Generic unavailable |
| **Tests** | Share + auth |

### 9.6 Whole-Handoff Erasure vs share Q&A/provenance

| | |
|--|--|
| **Inv** | Bearer fails closed (C-009) |
| **Mech** | Delete/revoke capabilities before/with handoff delete |
| **Obs** | `SHARE_UNAVAILABLE_MESSAGE` |
| **Tests** | Share + E2E |

### 9.7 Account Erasure vs new import

| | |
|--|--|
| **Inv** | No new mutations once erasure begins (C-009) |
| **Mech** | `lifecycle_status = erasing` |
| **Obs** | Import rejected |
| **Tests** | Auth/security + application |

### 9.8 Account Erasure vs draft save/publication

| | |
|--|--|
| **Inv** | Same |
| **Mech** | Lifecycle gate on all Creator mutations |
| **Obs** | Unauthenticated/unavailable-style errors |
| **Tests** | Auth/security + integration |

### 9.9 Account Erasure vs external-auth callback / re-login

| | |
|--|--|
| **Inv** | New lifecycle; no relink to erased IDs (D-010, C-010) |
| **Mech** | Mapping deleted; new creator row + mapping insert |
| **Obs** | Empty library; new CreatorId |
| **Tests** | Auth/security |

### 9.10 Partial SQL failure (each erasure type)

| | |
|--|--|
| **Inv** | No ghost access / partial readable erased handoffs (C-009) |
| **Mech** | Single transaction; ROLLBACK on any failure |
| **Obs** | Prior state unchanged |
| **Tests** | Integration with injected SQL fault hooks |

### 9.11 Cross-owner source reference

| | |
|--|--|
| **Inv** | Erasure by Creator A must not delete B’s retained data |
| **Mech** | Reference-count GC; owner-scoped erasure only |
| **Obs** | B’s handoff provenance intact |
| **Tests** | Integration adversarial two-creator fixture |

### 9.12 Repeated/idempotent erasure

| | |
|--|--|
| **Inv** | Safe retry |
| **Mech** | Idempotent flags (`source_erased_at` already set → success no-op) |
| **Obs** | 200/ success without error leak |
| **Tests** | Application |

### 9.13 Stale bearer token

| | |
|--|--|
| **Inv** | Fail closed |
| **Mech** | Existing hash lookup |
| **Obs** | Unavailable (already) |
| **Tests** | Share (extend post-erasure) |

### 9.14 Stale Creator session

| | |
|--|--|
| **Inv** | Deleted/erasing creator cannot mutate |
| **Mech** | Lifecycle + exists check |
| **Obs** | Unauthenticated/unavailable |
| **Tests** | Auth/security |

### 9.15 Migration interrupted / legacy data

| | |
|--|--|
| **Inv** | No partial provenance split |
| **Mech** | Per-version transactional migrate + marker |
| **Obs** | Migration job retry safe |
| **Tests** | Integration migration harness |

---

## 10. Test matrix (implement after T-015)

| Layer | Config / path | M12 focus |
|-------|---------------|-----------|
| Unit / application | `vitest.application.config.ts` | Draft validation rejects erased-source refs; lifecycle gates; erasure use-case orchestration (mock repos) |
| PostgreSQL integration | `vitest.integration.config.ts` | Provenance table, migration backfill, transactional erasure, GC reference counts |
| Auth / security | `vitest.auth.config.ts` | Account erasure + session + external re-login + dev session lifecycle |
| Share | `vitest.share.config.ts` | Post-erasure bearer/provenance/Q&A unavailable |
| E2E | Playwright | Creator erasure flows (when UI exists in T-017/T-018) |

Existing suites (P7/P8/P13/S13) become regression anchors when snapshots lose embedded sources.

---

## 11. Recommended implementation slices

| Task | Scope | Rationale |
|------|-------|-----------|
| **T-016 — Provenance/storage foundation + migration** | Provenance table; canonical-only published snapshots; schema nullable source + `source_erased_at`; backfill migration; read paths split; receiver provenance contract types | Decouples meaning from provenance before erasure writes |
| **T-017 — Source Erasure + Whole-Handoff Erasure** | Use cases, API/actions, transactional orchestration, share invalidation, GC | Delivers Handoff-layer lifecycle without account scope |
| **T-018 — Creator Account Erasure + auth/UI hardening** | Creator lifecycle, identity trigger bypass, mapping delete path, session checks, UI | Depends on T-017 handoff erasure primitive |

No safer decomposition found without splitting atomicity guarantees C-009 requires across two releases.

---

## 12. Key invariants (implementation checklist)

1. Published **meaning** bytes stable across Source Erasure (modulo already-separated storage).
2. Provenance erasure never mutates canonical item fields (C-008).
3. Share revocation ≠ source erasure ≠ whole-handoff ≠ account erasure (distinct code paths).
4. Bearer and Creator credentials remain orthogonal (D-008, C-006).
5. GC never deletes shared source while any handoff references it.
6. Generic unavailable for share/receiver on erased targets (C-009).
7. Mapping DELETE only inside account erasure orchestration (C-010).
8. No normative policy edits during implementation Tasks unless human-ratified.

---

## 13. References inspected

- Migrations: `001`–`006`
- Persistence: `handoff-root-repository`, `draft-repository`, `published-handoff-repository`, `receiver-read-repository`, `share-capability-repository`, `conversation-repository`, `external-identity-repository`, `creator-repository`, `validate-publication-provenance`
- Application: `import-conversation`, `generate-extraction-proposal`, `creator-review`, `shared-receiver-qa`, `authorize-handoff`, session providers
- Tests: `tests/integration/postgres-persistence.test.ts`, `tests/share/share-capability.test.ts`, `tests/auth/*`

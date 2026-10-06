# M12 Implementation Architecture & Threat Model

Date: 2026-10-06 (reconciled after human review, same T-015 / PR #17)
Task: T-015 (engineering design; non-normative)  
Normative baseline: `main @ b3c42d070db1a9d9ac000b8f2b9491ffbc351796` (T-014 / D-009, D-010, C-008–C-010)

This report evaluates an implementation architecture against **observed Hermeneus code and schema**. It does not ratify policy. Canon remains authoritative for semantics.

**Human review status:** Implementation directions below are **settled** for Closed Alpha entry into T-016.
**Human Decision Required: None for entry into T-016.**

---

## 0. Human-approved product and operations context (Closed Alpha)

These are **engineering directions** approved by the human owner; they do not amend Canon.

### 0.1 Migration availability

- Closed Alpha may use a **short maintenance window**.
- Prefer **one controlled transactional migration**, not zero-downtime dual-read / dual-write.
- Migration must **preflight** existing data and **fail safely** on malformed or ambiguous legacy state (abort whole migration transaction).

### 0.2 User-visible lifecycle operations (M12 UI)

Expose **three distinct** Creator-facing operations (do not collapse into one generic Delete):

| Operation | User label (conceptual) | Effect scope |
|-----------|-------------------------|--------------|
| Source Erasure | **Erase Source** | Provenance/source removed; canonical meaning may remain |
| Whole-Handoff Erasure | **Delete Handoff** | Draft + all Published versions + all share access + Handoff root |
| Creator Account Erasure | **Delete Account** | Full Creator-owned lifecycle (D-009 / C-009 / D-010) |

### 0.3 Destructive confirmation UX

| Operation | Confirmation strength |
|-----------|------------------------|
| **Erase Source** | Ordinary confirmation dialog; explain irreversible provenance/source loss while canonical meaning may remain |
| **Delete Handoff** | Strong destructive confirmation; explain Draft + all Published versions + all share access removed |
| **Delete Account** | Strongest confirmation; require typed confirmation string **`DELETE`** |

### 0.4 Account Erasure failure policy (fail-safe lifecycle)

- Once the account has **durably entered `erasing`** (Phase 1 committed), a later destructive-phase failure **must not** restore the account to **`active`**.
- Destructive **Phase 2** is **atomic** (single transaction).
- If Phase 2 fails: destructive mutations **ROLLBACK**; Creator remains **`erasing`**; new Creator-owned mutations stay **blocked**; retry/recovery allowed; **automatic reactivation forbidden**.

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
| Creator | `creators` | Minimal row (no lifecycle column yet) |
| External identity | `creator_external_identities` | `(provider, subject)` → `creator_id`; **UPDATE/DELETE blocked by trigger** |

Immutability triggers: published snapshots cannot UPDATE; share rows immutable except `revoked_at`; handoff `owner_creator_id` immutable.

**There is no erasure API, no DELETE path for handoffs/creators, and no provenance side table today.**

### 1.2 Canonical vs provenance coupling (current)

- Zod schemas (`src/handoff/schema.ts`) require every `HandoffItem` to include `sources: SourceReference[]` (messageId + optional excerpt).
- `PostgresPublishedHandoffRepository.publish` copies `draft.items` verbatim into `published_handoff_versions.snapshot_json` (`structuredClone`).
- **Receiver published view** strips `sources` at read time via `toReceiverItems` — but provenance reads **`item.sources` from the stored published JSON**, then joins `source_messages` for role/content validation (`PostgresReceiverReadRepository.getProvenance`).
- If a message row is missing, references are **silently dropped** (`filter(Boolean)`), not distinguished as “erased” vs corrupt.

### 1.3 Import and source sharing

- `importAndCreateHandoff` allocates a **new opaque** `conversationId` per import (`generateOpaqueId("conv")`); no cross-Handoff deduplication product feature.
- Schema **allows** multiple `handoffs` rows to reference the **same** `source_conversation_id`. Production import does not intentionally share; tests may.
- Deleting a conversation is blocked while any handoff references it (RESTRICT). No orphan-GC exists.

### 1.4 Authorization (current)

- Creator routes: `requireOwnedHandoff` checks session principal + `handoffs.owner_creator_id` match.
- **External auth:** `AuthJsCreatorSessionProvider` validates `creators.exists(creatorId)` on each request (not lifecycle).
- **Dev auth:** signed cookie only; **does not** verify Creator row exists or lifecycle (**implementation must align with §0 / §6**).
- Share: bearer token hash lookup; invalid/revoked/missing → `"This share link is unavailable."`

### 1.5 Publication / draft concurrency (current)

- Publish: transaction with `SELECT handoffs FOR UPDATE`, draft `FOR UPDATE`, `validatePublicationProvenance`, insert published row.
- Draft save: optimistic revision increment; no validation that source was erased.
- Extraction: loads conversation via `handoffs.source_conversation_id`; fails if conversation missing.

### 1.6 Share vs erasure (current)

- Revocation sets `revoked_at` only; published snapshot and source data untouched.
- Whole-Handoff deletion impossible without new orchestration (RESTRICT FKs).

---

## 2. Target architecture (evaluation)

### 2.1 Physical separation: canonical meaning vs provenance

**Recommendation: adopt** physical split for **Published** storage; keep Draft provenance in JSON through T-016 (§8).

| Store | Contents after T-016 foundation |
|-------|-----------------------------------|
| `published_handoff_versions.snapshot_json` | **Published canonical items only** — no `sources` |
| `published_handoff_provenance` (name TBD) | Provenance rows keyed by `(handoff_id, version, item_id, …)` with `message_id`, `excerpt` |
| `handoff_drafts.snapshot_json` | Draft items **with** `sources[]` until T-017 Source Erasure strips them |

**TypeScript type boundary (T-016):** Do not rely on optional `sources?` on one universal item type for serialization safety. Prefer distinct concepts, e.g.:

- `DraftHandoffItem` — canonical fields + `sources`
- `PublishedCanonicalItem` — canonical fields only
- `PublishedProvenance` — `handoffId`, `version`, `itemId`, source reference data

Exact naming may vary; invariant: **published canonical storage types must not allow provenance to leak back into snapshot JSON serialization.**

**Receiver / provenance contract:**

- **Internal** provenance reads distinguish **`retained`** (data available) vs **`unavailable_erased`** (source provenance deliberately erased for this Handoff).
- Do **not** fabricate source references after erasure.
- **`unavailable_missing`** is **not** a normal product state: if provenance is missing without a recorded erasure, treat primarily as an **integrity error** (log/ops), not a third user-facing lifecycle label.
- **Shared Receiver** (`SharedProvenanceBundle`): no `messageId`; no reconstructed evidence; avoid unnecessary erased-vs-never-existed leakage — generic unavailability where C-009 requires.

### 2.2 Maintenance-window migration (approved)

**Do not** use online dual-read/dual-write or per-version `provenance_migrated_at` markers as the default design.

**Approved flow:**

1. Enter **maintenance window** (Closed Alpha).
2. **Preflight** (read-only): validate every legacy published snapshot; validate referenced source-message integrity; compute expected provenance counts; report malformed/ambiguous rows **before** migration SQL runs.
3. **One transactional migration** (leverage existing migration runner wrapping unapplied SQL in a PostgreSQL transaction):
   - create provenance storage;
   - backfill provenance from `items[*].sources`;
   - rewrite published snapshots to canonical-only representation;
   - validate counts/invariants inside the same transaction;
   - if published immutability trigger blocks historical rewrite, **narrowly** drop/disable and recreate trigger **inside this transaction**;
   - **COMMIT** or full **ROLLBACK** on any validation failure (no partial quarantine while continuing).
4. Run regression verification.
5. Leave maintenance window.

**Hazards:** see §7 (preflight informs go/no-go; failures abort entire migration).

### 2.3 Handoff source lifecycle columns

```text
handoffs.source_conversation_id  NULL after Source Erasure (approved)
handoffs.source_erased_at         TIMESTAMPTZ NULL
creators.lifecycle_status        active | erasing   (T-018; durable in-row states only)
```

**Creator Account Erasure lifecycle (Canon-aligned):** `active` → `erasing` → **Creator row deleted**. There is **no** normal in-row `erased` state. Completed account erasure **removes** the Creator record (C-009 ordering). The durable **`erasing`** state exists so Phase 2 failure remains fail-safe and retryable without auto-restore to `active`.

Semantics (Handoff source):

- Retained source: `source_conversation_id IS NOT NULL` && `source_erased_at IS NULL`.
- Source Erasure complete: `source_erased_at IS NOT NULL` && **`source_conversation_id IS NULL`** (do not retain erased opaque ID for audit).
- `source_conversation_id IS NULL` && `source_erased_at IS NULL` → **integrity error** (except in-flight transaction).

### 2.4 Physical source deletion (in-transaction, not post-commit)

For **Source Erasure** and **Whole-Handoff Erasure**, physical `source_conversations` deletion (when no remaining Handoff retains that conversation) must occur **inside the same erasure transaction** as association removal — not as a best-effort post-commit GC.

Steps (conceptual, within one transaction):

1. Capture `source_conversation_id` while locked.
2. Detach Handoff / delete provenance / update draft / set erasure flags / delete handoff rows as applicable.
3. **`SELECT … FOR UPDATE`** or equivalent on conversation or handoff set so concurrent references cannot disappear unnoticed.
4. If **no** Handoff row still references that conversation ID, `DELETE` conversation (messages CASCADE).
5. **COMMIT** only when erasure is complete **including** removable physical source cleanup.

Cross-owner retained references must prevent physical delete. No product-level source deduplication required.

---

## 3. Erasure operations (transactional design)

All erasure entrypoints: **authenticated owner** (C-006) + ownership re-verification inside the transaction.

**Creator-scoped serialization:** All Creator-owned **mutations** (§4) must acquire the Creator-scoped lock protocol before proceeding. Handoff-level `FOR UPDATE` complements but does not replace Creator-scoped serialization for account-level invariants.

### 3.1 Source Erasure (Erase Source)

**Single transaction:**

1. Acquire **Creator-scoped shared** transaction lock; verify Creator **`active`**.
2. Lock handoff (+ draft) `FOR UPDATE`; re-verify owner.
3. Delete published provenance rows for this handoff (all versions); strip draft `sources` (T-017 behavior; storage ready from T-016).
4. Set `source_erased_at`, `source_conversation_id = NULL`.
5. If no other Handoff references the former conversation ID, delete physical source conversation.
6. **COMMIT**.

**Post-conditions:** canonical published meaning unchanged; provenance reads → `unavailable_erased`; extraction rejected; draft saves rejecting reintroduced message IDs when `source_erased_at` set.

### 3.2 Whole-Handoff Erasure (Delete Handoff)

**Single transaction:**

1. Creator-scoped shared lock; Creator **`active`**; handoff `FOR UPDATE`; verify owner.
2. **Hard DELETE** all `share_capabilities` for handoff (approved — do not leave revoked rows after lifecycle termination).
3. Delete provenance; delete all published versions; delete draft; delete handoff root.
4. Physical source GC inside same transaction if unreferenced.
5. **COMMIT**.

Bearer tokens: generic unavailable (same as invalid/revoked).

T-016 may adjust FK/CASCADE order via migration as needed.

### 3.3 Creator Account Erasure (Delete Account)

Uses **two-phase fail-safe lifecycle** (§4) + Phase 2 destructive atomic transaction.

Phase 2 (when `lifecycle_status = erasing`):

1. Creator-scoped **exclusive** lock; verify **`erasing`**.
2. One atomic transaction (C-009 order, unambiguous success post-condition):
   - erase all owned Handoffs and Creator-specific provenance (Whole-Handoff Erasure per Handoff);
   - garbage-collect orphaned source data as required;
   - **DELETE** all external identity mappings for this Creator (§5);
   - **DELETE** the Creator row;
3. **COMMIT**.

On Phase 2 failure: **ROLLBACK** all Phase 2 destructive work; the existing Creator row remains **`erasing`**; no automatic transition to **`active`**; retry/recovery remains possible.

Successful completion leaves **no Creator row** (not `lifecycle_status = erased`). Re-login creates a **new** Creator lifecycle (D-010).

---

## 4. Creator-scoped serialization and account-erasure lifecycle gate

Prior recommendation (lifecycle `erasing` only inside a long destructive transaction + optional erasure-side advisory lock) is **insufficient**: under MVCC, uncommitted `erasing` is invisible; other sessions can still observe **`active`** and mutate.

### 4.1 Approved model: durable two-phase gate + Creator-scoped transaction locks

Use a **stable Creator-scoped PostgreSQL advisory transaction lock** (or equivalent Unit-of-Work serialization) with **shared** vs **exclusive** modes. Exact key derivation is an implementation detail; all paths must use the **same** key family.

**Ordinary Creator mutation** (import, draft save, publication, share issuance, extraction initiation, Source Erasure, Whole-Handoff Erasure):

```
BEGIN
→ pg_advisory_xact_lock_shared(CreatorKey)   -- conceptual
→ verify Creator exists AND lifecycle_status = 'active'
→ … handoff locks / work …
→ COMMIT
```

**Account Erasure Phase 1** (short, durable gate):

```
BEGIN
→ pg_advisory_xact_lock_exclusive(CreatorKey)
→ wait for in-flight shared holders to finish
→ verify lifecycle_status = 'active'
→ SET lifecycle_status = 'erasing'
→ COMMIT
```

After Phase 1 commits, **all** new Creator mutations reject (lifecycle ≠ `active`).

**Account Erasure Phase 2** (destructive, atomic):

```
BEGIN
→ pg_advisory_xact_lock_exclusive(CreatorKey)
→ verify lifecycle_status = 'erasing'
→ … complete destructive erasure (all handoffs, mappings, creator) …
→ COMMIT
```

**Phase 2 failure:** ROLLBACK destructive work; Creator remains **`erasing`**; mutations remain blocked; retry/recovery allowed; **never** auto-restore **`active`**.

Read-only operations need not take the lock unless a specific invariant requires it.

**T-016 note:** Specify this protocol in the report; **implement** Creator lifecycle column + lock participation in **T-018** (Account Erasure). T-016 must not prematurely build Account Erasure orchestration.

### 4.2 Why not options A/C alone

| Approach | Verdict |
|----------|---------|
| Row locks only during erasure | Insufficient across transactions |
| Lifecycle without committed Phase 1 | Insufficient under MVCC |
| Advisory lock only on erasure side | Insufficient — mutations must participate |

---

## 5. External identity trigger (defense-in-depth)

**Do not** treat `SET LOCAL hermeneus.erasure_orchestration = 'account_erasure'` as an independent **security boundary** — same DB role can set it; that is not authorization.

**Approved trigger logic:**

- **Normal lifecycle:** UPDATE and DELETE on `creator_external_identities` **forbidden**.
- **Account erasure:** DELETE **allowed only if** referenced `creators.lifecycle_status = 'erasing'` (JOIN on `creator_id`).
- UPDATE remains **forbidden**.
- Mappings are deleted **before** the Creator row (Phase 2 ordering). After successful Phase 2 the Creator row is gone — there is no remaining row to authorize further mapping DELETE on that identity.

**Primary security control:** application-layer authenticated Account Erasure authorization (C-006, owner session).

**Trigger role:** correctness / **defense-in-depth**, not standalone authn/authz. A privileged dedicated DB role may strengthen this later; not required for Closed Alpha.

---

## 6. Stale sessions and dev auth parity (approved)

**Decision:** Dev and external modes must both validate Creator **exists** and **`lifecycle_status = active`** before Creator-owned mutations. Dev may differ in **credential mechanism**, not lifecycle semantics.

A session whose `CreatorId` no longer has a Creator row (account erasure completed) must resolve as **unavailable/unauthenticated** for Creator-owned operations — same for external and dev auth.

Implement via centralized `requireActiveCreator` after session resolution (§4 mutation template): row missing or lifecycle ≠ `active` → reject.

External session: extend beyond `exists` to lifecycle. Dev session: add existence + lifecycle check (currently missing).

---

## 7. Migration preconditions & hazard matrix

Preflight runs **before** maintenance migration transaction. Any blocking finding **aborts** migration start; transaction migration **rolls back entirely** on validation failure.

| Case | Observed in repo? | Disposition |
|------|-------------------|-------------|
| Same `source_conversation_id`, different owners | Schema allows | **Safe** if preflight counts refs; GC stays reference-based |
| Orphan `source_conversations` | Possible in tests | Preflight report; optional cleanup outside migration or ignore |
| Published refs missing `source_messages` | Legacy risk | **Abort migration**; fix data or manual intervention |
| Malformed `snapshot_json` | Unlikely | **Abort migration** |
| Empty `sources: []` | Valid | Migrate; no provenance rows |
| Interrupted migration | Maintenance + single txn | Re-run from snapshot restore / no partial commit by design |

Per-row migration markers are **not** the default architecture.

---

## 8. Resolved implementation decisions (formerly open)

All items below are **settled** (human-approved); not open for T-016 re-debate:

| Topic | Decision |
|-------|----------|
| `source_conversation_id` after Source Erasure | **`NULL`**; `source_erased_at` records deliberate erasure |
| Share rows after Whole-Handoff Erasure | **Hard DELETE** with handoff erasure |
| Draft provenance in T-016 | **Keep in Draft JSON**; published split only; T-017 strips draft sources on Source Erasure |
| Account Erasure failure | **Two-phase fail-safe** (§0.4, §4); never auto-**active** |
| Dev auth parity | **Yes** — same lifecycle gate as external |

**Human Decision Required: None for entry into T-016.**

If T-016 engineering discovers a **new product-semantic** choice not covered by Canon or the above, **stop and escalate** — do not invent policy in implementation.

---

## 9. Threat model

Legend: **Inv**, **Mech**, **Obs**, **Tests**.

### 9.1 Source Erasure vs Draft save

| **Inv** | Erased source cannot reappear; meaning unchanged |
| **Mech** | Creator shared lock + handoff `FOR UPDATE`; reject sources when `source_erased_at` set |
| **Obs** | Validation/conflict error |
| **Tests** | Application + integration |

### 9.2 Source Erasure vs AI extraction

| **Inv** | No extraction after source erased |
| **Mech** | `source_erased_at` / lifecycle + shared lock |
| **Obs** | User-safe error |
| **Tests** | Application |

### 9.3 Source Erasure vs publication

| **Inv** | No publish from erased/missing source |
| **Mech** | Shared lock + provenance validation + source state |
| **Obs** | Rejected publish |
| **Tests** | Integration |

### 9.4 Source Erasure vs provenance read

| **Inv** | No reconstruction (C-008, D-009) |
| **Mech** | Empty provenance store + `source_erased_at` → `unavailable_erased` |
| **Obs** | Internal explicit unavailable; share generic |
| **Tests** | Integration + share |

### 9.5 Whole-Handoff Erasure vs share issuance

| **Inv** | No capability for deleted handoff |
| **Mech** | Handoff existence + locks |
| **Obs** | Unavailable |
| **Tests** | Share + auth |

### 9.6 Whole-Handoff Erasure vs share Q&A/provenance

| **Inv** | Bearer fail closed |
| **Mech** | Hard DELETE capabilities + handoff delete (same txn) |
| **Obs** | `SHARE_UNAVAILABLE_MESSAGE` |
| **Tests** | Share + E2E |

### 9.7 Account Erasure vs import / draft / publish / share / extraction

| **Inv** | No mutations after erasure begins (C-009) |
| **Mech** | Creator **shared/exclusive** serialization; Phase 1 committed **`erasing`**; mutations verify **`active`** inside txn |
| **Obs** | Rejected / unavailable |
| **Tests** | Auth/security + application + integration (concurrent) |

### 9.8 Account Erasure vs draft save/publication (during erasing)

| **Inv** | Same as 9.7 |
| **Mech** | Lifecycle ≠ `active` after Phase 1 |
| **Obs** | Blocked |
| **Tests** | Auth/security + integration |

### 9.9 Account Erasure vs external-auth callback / re-login

| **Inv** | New lifecycle; no relink to erased IDs |
| **Mech** | Mapping deleted in Phase 2; `resolveOrCreate` new Creator |
| **Obs** | Fresh account |
| **Tests** | Auth/security |

### 9.10 Partial Account Erasure failure (Phase 2)

| **Inv** | Fail-safe lifecycle (§0.4) |
| **Mech** | Phase 2 single txn ROLLBACK; **`erasing` persists** |
| **Obs** | Data at pre-Phase-2 state; mutations blocked; retry allowed; **no auto-active** |
| **Tests** | Integration + fault injection |

### 9.11 Partial SQL failure (Source / Whole-Handoff erasure)

| **Inv** | No ghost access (C-009) |
| **Mech** | Single txn ROLLBACK including in-txn source delete |
| **Obs** | Prior state unchanged |
| **Tests** | Integration faults |

### 9.12 Cross-owner source reference

| **Inv** | A’s erasure must not delete B’s retained source |
| **Mech** | Reference check + locking before physical DELETE |
| **Obs** | B intact |
| **Tests** | Adversarial integration |

### 9.13 Repeated/idempotent erasure

| **Inv** | Safe retry |
| **Mech** | Idempotent flags / no-op success |
| **Obs** | Success without leak |
| **Tests** | Application |

### 9.14 Stale bearer token

| **Inv** | Fail closed |
| **Mech** | Hash lookup / rows deleted |
| **Obs** | Unavailable |
| **Tests** | Share |

### 9.15 Stale Creator session

| **Inv** | Erasing/deleted Creator cannot mutate |
| **Mech** | Lifecycle + exists (dev + external) |
| **Obs** | Unauthenticated/unavailable |
| **Tests** | Auth/security |

### 9.16 Migration / legacy data

| **Inv** | No partial provenance split committed |
| **Mech** | Maintenance window + **one migration transaction**; preflight abort |
| **Obs** | All-or-nothing migrate |
| **Tests** | Migration integration harness |

### 9.17 Source GC “failure window” (removed)

Post-commit GC failure is **out of scope** — physical delete is **in-transaction** (§2.4). Threat is subsumed by 9.11.

---

## 10. Test matrix (implement after T-015)

| Layer | Config | M12 focus |
|-------|--------|-----------|
| Unit / application | `vitest.application.config.ts` | Lifecycle gates; lock protocol wrappers; draft source rejection |
| PostgreSQL integration | `vitest.integration.config.ts` | Maintenance migration; in-txn erasure + source delete; Phase 1/2 account erasure |
| Auth / security | `vitest.auth.config.ts` | Dev/external parity; erasing blocks mutations; re-login |
| Share | `vitest.share.config.ts` | Post-erasure unavailable |
| E2E | Playwright | Three UX flows + confirmation tiers (T-017/T-018) |

---

## 11. Recommended implementation slices

| Task | Scope |
|------|--------|
| **T-016** | Published provenance table; canonical-only published snapshots; **maintenance-window transactional migration**; TypeScript published/draft/provenance type split; read-path split. **Does not** implement Account Erasure locking/orchestration. |
| **T-017** | **Erase Source** + **Delete Handoff** use cases/API; in-txn source delete; hard DELETE share rows; destructive UX for source vs handoff (§0.3). Participates in Creator **shared** lock once T-018 introduces lifecycle column — or handoff-only locks until T-018 if lifecycle column absent (T-018 adds full protocol). |
| **T-018** | `lifecycle_status` (`active` \| `erasing` only); two-phase Account Erasure ending in **Creator row DELETE**; Creator shared/exclusive lock on **all** mutation paths; identity trigger per §5; dev/external parity; **Delete Account** UX (typed `DELETE`). |

Slice boundaries unchanged unless T-016 evidence forces safer split.

Each Task receives its own execution authority when authorized.

---

## 12. Key invariants (implementation checklist)

1. Published meaning stable across Source Erasure (after T-016 split).
2. Provenance erasure never mutates canonical item fields (C-008).
3. Three distinct user operations and code paths (§0.2).
4. Bearer vs Creator credentials orthogonal (D-008, C-006).
5. Physical source delete only when no retained Handoff reference — **inside erasure transaction**.
6. Share/receiver generic unavailable on erased targets (C-009).
7. Identity DELETE only when Creator **`erasing`** (trigger + app auth).
8. Account Erasure: committed **`erasing`** before destructive work; Phase 2 atomic; success **deletes Creator row**; failure leaves row **`erasing`**; no auto-**active**; no in-row **`erased`** state.
9. No Canon edits in implementation Tasks unless human-ratified.

---

## 13. References inspected

- Migrations: `001`–`006`
- Persistence and application modules listed in prior revision (unchanged factual baseline in §1)
- Migration runner: single-transaction SQL migration property (repository `scripts/migrate.mjs` pattern — verify at T-016)

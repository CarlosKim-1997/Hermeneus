---
schema: report/v1
title: Production Readiness / Internal Alpha Exit Audit
task: T-019
baseline_main_sha: edf7c6baf566fd55baf40ea650bc64273cffee3e
audit_date: 2026-10-07
status: non-normative
---
# Production Readiness / Internal Alpha Exit Audit

Non-normative engineering and operations assessment for Hermeneus at T-018 integration (`edf7c6b`). This document does not ratify Canon or product policy.

## Executive gate verdicts

| Gate | Verdict | Summary |
|------|---------|---------|
| **Controlled Internal Alpha** | **CONDITIONAL GO** | Application-layer auth, ownership, share semantics, and M12 erasure are strong and heavily tested. Responsible Alpha with real data requires **operator compensating controls**: external (not dev) auth, HTTPS, controlled invite list, documented share-URL log policy, verified DB backups/PITR, manual pre-deploy verification (full test matrix + migrate), and acceptance that infrastructure may retain share tokens in access logs until Slice B is implemented. |
| **Limited Beta** | **NO-GO** | Missing hosted CI, unverified branch protection, no health/readiness surface, no rate/cost guards on share and LLM paths, default DB pool/migration concurrency hazards for multi-instance deploys, and unresolved C-005 infrastructure log redaction block unattended internet-facing operation. |

## Existing controls worth preserving

Independently verified strengths (do not weaken during hardening):

- **Published immutability** (C-001): DB triggers + tests on published snapshots/provenance split (T-016).
- **Provenance separation** and Receiver canonical-only views; provenance fetched explicitly.
- **Layered erasure** (T-017/T-018): transactional Source/Handoff/Account erasure with adversarial concurrency tests.
- **Creator ownership** (C-006): server-side `requireOwnedHandoff` on privileged paths; extensive IDOR tests (`tests/auth/server-action-idor.test.ts`, E2E IDOR).
- **Share bearer**: 256-bit entropy (`randomBytes(32)`), SHA-256 at rest, one-time issuance, revocation, lifecycle fail-closed after Account Erasure Phase 1 (T-018).
- **External identity**: `(provider, subject)` mapping; no email authority (C-007/C-010); immutability triggers.
- **Dev auth refused in production** (`isDevCreatorAuthAllowedInRuntime()`).
- **LLM `store: false`** on OpenAI extraction/Receiver paths (code evidence).
- **Deterministic test depth**: 97 integration + 72 auth + 13 E2E + share/receiver suites; governance checker.
- **README** explicitly warns controlled deployment before public exposure.

## Operator evidence required

| Topic | Why |
|-------|-----|
| Hosting platform & process model | No `vercel.json`, Dockerfile, or deploy scripts in repo |
| Production `DATABASE_URL` provider & TLS | Pool uses connection string only; SSL not configured in code |
| Backup / PITR / restore test | Not represented in repository |
| Access / CDN / reverse-proxy log policy | C-005 deferred; especially `/share/[token]` path logging |
| Google OAuth redirect URIs & `AUTH_SECRET` rotation | External auth deployment not live-verified in this audit |
| Branch protection & required reviews | GitHub API returned 403 for integration token |
| Secret scanning / Dependabot enabled | Not visible via API used |
| Error monitoring (Sentry etc.) | None in codebase |
| Cost / quota limits on OpenAI | Env-only; no app-level ceiling |

## Findings catalog

Each finding uses the required fields. **Confidence**: High = direct repo evidence; Medium = inferred from stack; Low = needs operator confirmation.

---

### PR-RC-001 — No hosted CI workflows

| Field | Value |
|-------|-------|
| **Area** | Repository / CI |
| **Evidence** | `gh api .../actions/workflows` → `total_count: 0`; no `.github/workflows` in tree (glob 2026-10-07). |
| **Failure / threat scenario** | Deploy from unverified commit; regressions reach Alpha/Beta without automated gate. |
| **Current control** | Local/agent `npm run test:*` documented in README; 248+ deterministic tests pass on audit baseline. |
| **Severity** | HIGH |
| **Likelihood** | HIGH (without manual discipline) |
| **Gate affected** | Alpha (compensated manually), Beta (blocker) |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice A: GitHub Actions running governance, typecheck, build, test matrix (no live LLM). |
| **Verification required** | Required checks green on PR; branch protection enforces. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-RC-002 — Branch protection not verified (API 403)

| Field | Value |
|-------|-------|
| **Area** | Change control |
| **Evidence** | `GET /repos/.../branches/main/protection` → HTTP 403 for integration principal; Current State states main unprotected (still consistent). |
| **Failure / threat scenario** | Direct push to `main` bypassing review/tests. |
| **Current control** | Public repo visibility; human merge discipline. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM |
| **Gate affected** | Alpha (acceptable with single operator), Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Enable branch protection + required status checks after Slice A. |
| **Verification required** | GitHub UI/API shows protection enabled. |
| **Confidence** | Medium (protection state UNKNOWN_EXTERNAL for token) |
| **Human Decision Required?** | No |

---

### PR-RC-003 — No release/tag or deploy provenance

| Field | Value |
|-------|-------|
| **Area** | Change control |
| **Evidence** | No release workflow, changelog, or deployment manifest in repo. |
| **Failure / threat scenario** | Operators cannot tie running artifact to git SHA; rollback ambiguous. |
| **Current control** | Git history only. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM |
| **Gate affected** | Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Tag releases; record SHA in deployment env; optional SBOM later. |
| **Verification required** | Deployed env exposes non-secret build SHA. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-SC-001 — npm audit: production dependency advisories

| Field | Value |
|-------|-------|
| **Area** | Supply chain |
| **Evidence** | `npm audit --omit=dev` (2026-10-07): 4 vulnerabilities (1 moderate, 3 high), including `source-map-js` DoS advisory; fixes available via `npm audit fix` (not applied in T-019). |
| **Failure / threat scenario** | DoS or supply-chain issue in transitive deps during build/runtime. |
| **Current control** | Lockfile present; `npm ci` reproducible. |
| **Severity** | MEDIUM |
| **Likelihood** | LOW–MEDIUM |
| **Gate affected** | Beta |
| **Classification** | HARDEN_BEFORE_PUBLIC |
| **Recommended remediation** | Scheduled dependency review; CI `npm audit --omit=dev` with policy. |
| **Verification required** | Audit clean or documented exceptions. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-SC-002 — npm audit: critical dev-only (tinypool/vitest)

| Field | Value |
|-------|-------|
| **Area** | Supply chain |
| **Evidence** | `npm audit` (2026-10-07): 2 critical in `tinypool` via vitest; not in production bundle. |
| **Failure / threat scenario** | Compromised dev/CI runner if untrusted code executed in tests. |
| **Current control** | Tests run in controlled CI (when added) / agent environments. |
| **Severity** | LOW (prod), MEDIUM (CI) |
| **Likelihood** | LOW |
| **Gate affected** | Beta (CI hygiene) |
| **Classification** | DEFERRED |
| **Recommended remediation** | Upgrade vitest when convenient; isolate CI runners. |
| **Verification required** | Post-upgrade audit. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-SC-003 — Auth.js 5 beta + semver ranges

| Field | Value |
|-------|-------|
| **Area** | Supply chain / auth |
| **Evidence** | `package.json`: `next-auth@5.0.0-beta.32`; caret ranges on `next`, `openai`, etc.; `npm outdated` shows drift. |
| **Failure / threat scenario** | Beta dependency behavior change; unexpected auth/session breakage on deploy. |
| **Current control** | Lockfile pins resolved versions; auth tests (72). |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM over time |
| **Gate affected** | Alpha (external auth), Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Pin critical deps; plan Auth.js stable upgrade path; smoke-test OAuth on staging. |
| **Verification required** | Staging OAuth round-trip; lockfile-only deploys. |
| **Confidence** | High |
| **Human Decision Required?** | **Yes** — target Auth.js major/stable timeline for Beta. |

---

### PR-SC-004 — No Node.js engine pin

| Field | Value |
|-------|-------|
| **Area** | Runtime |
| **Evidence** | `package.json` lacks `engines`; no `.nvmrc`. |
| **Failure / threat scenario** | Local/CI/prod Node mismatch → subtle runtime failures. |
| **Current control** | Next 15 documented requirements. |
| **Severity** | LOW |
| **Likelihood** | MEDIUM |
| **Gate affected** | Alpha, Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Document and enforce Node LTS in CI and hosting. |
| **Verification required** | CI uses pinned Node. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-DEP-001 — Deployment target not recorded in repository

| Field | Value |
|-------|-------|
| **Area** | Deployment |
| **Evidence** | No Vercel/Docker/K8s manifests; Next.js 15 App Router assumed from code only. |
| **Failure / threat scenario** | Operators guess platform behavior (serverless vs long-lived Node). |
| **Current control** | `next build` / `next start` succeed on audit run. |
| **Severity** | INFO |
| **Likelihood** | N/A |
| **Gate affected** | Alpha, Beta |
| **Classification** | UNKNOWN_EXTERNAL |
| **Recommended remediation** | Record platform in operator docs; align migration job vs web process. |
| **Verification required** | Written deploy runbook with platform name. |
| **Confidence** | High |
| **Human Decision Required?** | **Yes** — choose hosting platform and migration execution model. |

---

### PR-DEP-002 — AUTH_TRUST_HOST / proxy trust

| Field | Value |
|-------|-------|
| **Area** | Deployment / auth |
| **Evidence** | `.env.example` documents `AUTH_TRUST_HOST`; `docs/ARCHITECTURE.md` warns about Host header sanitization; not set in repo. |
| **Failure / threat scenario** | Host header injection on misconfigured proxy breaks OAuth callbacks or session cookies. |
| **Current control** | Documentation; Auth.js defaults when unset. |
| **Severity** | HIGH |
| **Likelihood** | LOW if platform-managed; HIGH if self-hosted without proxy hardening |
| **Gate affected** | Alpha (external auth), Beta |
| **Classification** | BLOCKER_ALPHA (if external auth without verified proxy) |
| **Recommended remediation** | Platform-specific trust config; staging OAuth test; document reverse proxy rules. |
| **Verification required** | Successful Google login on staging/production URL. |
| **Confidence** | Medium |
| **Human Decision Required?** | No (configuration task) |

---

### PR-SEC-001 — No explicit security headers in Next config

| Field | Value |
|-------|-------|
| **Area** | Browser / HTTP |
| **Evidence** | `next.config.ts` only `typedRoutes` + webpack alias; no `headers()`; no middleware. |
| **Failure / threat scenario** | Missing HSTS, CSP, X-Frame-Options at app layer; reliance on platform defaults only. |
| **Current control** | Platform may add headers; share page sets `referrer: no-referrer` in metadata only. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM |
| **Gate affected** | Beta |
| **Classification** | HARDEN_BEFORE_PUBLIC |
| **Recommended remediation** | Define minimal header set at Next or reverse proxy; test clickjacking on Creator pages. |
| **Verification required** | Response header scan on staging. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-SH-001 — C-005: share token in URL path / infrastructure logs (known gap)

| Field | Value |
|-------|-------|
| **Area** | Share bearer (C-005) |
| **Evidence** | Route `/share/[token]`; C-005 ACTIVE text defers access-log redaction; share metadata uses `referrer: no-referrer` (`src/app/share/[token]/page.tsx`) — mitigates Referer leakage to third parties, not proxy logs. |
| **Failure / threat scenario** | Raw bearer in CDN/proxy/app access logs → forwarded link compromise even after revocation intent. |
| **Current control** | App does not persist raw token after issuance; hash-only DB; tests for model payload exclusion. |
| **Severity** | HIGH |
| **Likelihood** | HIGH if default access logging enabled |
| **Gate affected** | Alpha (share links leave invite group), Beta |
| **Classification** | BLOCKER_ALPHA (for share-heavy Alpha) / REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice B: log redaction/filter at proxy; avoid logging full request URI; structured log scrubbing; optional post-Alpha token-in-header redesign (Human Decision). |
| **Verification required** | Sample access log proves token not stored; penetration check Referer on subresources. |
| **Confidence** | High |
| **Human Decision Required?** | **Yes** — acceptable Alpha log retention vs must-fix-before-any-share. |

---

### PR-SH-002 — Share page browser history / URL bar exposure

| Field | Value |
|-------|-------|
| **Area** | Share UX |
| **Evidence** | Bearer remains in browser location bar and history by design (`/share/[token]`). |
| **Failure / threat scenario** | Device sharing, screenshots, support tickets expose bearer. |
| **Current control** | User education; revocation; high entropy. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM |
| **Gate affected** | Alpha, Beta |
| **Classification** | ACCEPTABLE_CURRENTLY (semantics ratified) |
| **Recommended remediation** | Operational guidance for invitees; optional future fragment/post pattern (product change — not T-019). |
| **Verification required** | Support/runbook mentions handling. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-AUTH-001 — External Google OAuth not live-verified in audit environment

| Field | Value |
|-------|-------|
| **Area** | Authentication |
| **Evidence** | Tests mock/stub Auth.js paths; README notes live Google round-trip unverified historically; T-018 added lifecycle/session tests. |
| **Failure / threat scenario** | Misconfigured redirect URI or cookie `Secure` flags block real users silently. |
| **Current control** | Application invariants tested; `CREATOR_AUTH_MODE=external` config validation. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM on first deploy |
| **Gate affected** | Alpha (external auth) |
| **Classification** | BLOCKER_ALPHA (until staging OAuth pass) |
| **Recommended remediation** | Staging checklist: login, logout, erasure, re-login new lifecycle. |
| **Verification required** | Manual OAuth E2E on target URL. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-AUTH-002 — Creator auth disabled by default

| Field | Value |
|-------|-------|
| **Area** | Authentication |
| **Evidence** | `CREATOR_AUTH_MODE` defaults `disabled` (`auth-config.ts`). |
| **Failure / threat scenario** | Misconfiguration leaves Creator surfaces open if deployed without env review. |
| **Current control** | Page guards redirect; README documents modes. |
| **Severity** | HIGH |
| **Likelihood** | LOW if checklist used |
| **Gate affected** | Alpha |
| **Classification** | BLOCKER_ALPHA (must set external or controlled dev-not-prod) |
| **Recommended remediation** | Deploy checklist; fail-fast if disabled in production env. |
| **Verification required** | `/handoffs` requires login on Alpha env. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-AUTHZ-001 — Privileged path separation (strength)

| Field | Value |
|-------|-------|
| **Area** | Authorization |
| **Evidence** | IDOR tests SA11–SA14; share vs owner tests; M12 erasure auth; T-018 lifecycle-blocked reads return `undefined`. |
| **Failure / threat scenario** | N/A — control strength. |
| **Current control** | As designed + tested. |
| **Severity** | INFO |
| **Likelihood** | N/A |
| **Gate affected** | Alpha, Beta |
| **Classification** | ACCEPTABLE_CURRENTLY |
| **Recommended remediation** | Preserve; extend CI coverage only. |
| **Verification required** | Keep auth/integration suites mandatory. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-DB-001 — Default `pg.Pool` configuration

| Field | Value |
|-------|-------|
| **Area** | Database runtime |
| **Evidence** | `createPool()` → `new Pool({ connectionString })` only (`pool.ts`). |
| **Failure / threat scenario** | Connection exhaustion under concurrent serverless instances or slow queries; no statement timeout. |
| **Current control** | Single-instance Alpha plausible; PostgreSQL server limits. |
| **Severity** | MEDIUM |
| **Likelihood** | LOW Alpha; MEDIUM–HIGH Beta horizontal |
| **Gate affected** | Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice D: max pool size, idle timeout, SSL options, optional statement_timeout. |
| **Verification required** | Load test; RDS/Neon connection metrics. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-MIG-001 — Concurrent migrators race

| Field | Value |
|-------|-------|
| **Area** | Migrations |
| **Evidence** | `migrate.mjs`: read `schema_migrations`, apply in per-file transaction; no advisory lock; two processes can attempt same migration. |
| **Failure / threat scenario** | Dual deploy runs migrate → duplicate DDL errors or partial state. |
| **Current control** | Single-operator manual migrate before deploy. |
| **Severity** | HIGH |
| **Likelihood** | MEDIUM Beta |
| **Gate affected** | Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice C: migration leader lock; run migrate as one-off job before traffic. |
| **Verification required** | Test concurrent migrate; document forward-only policy. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-MIG-002 — No schema version gate in application startup

| Field | Value |
|-------|-------|
| **Area** | Migrations |
| **Evidence** | App starts without checking expected migration level vs code. |
| **Failure / threat scenario** | Code N+1 against schema N → runtime SQL errors mid-request. |
| **Current control** | Operator runs migrate before deploy. |
| **Severity** | HIGH |
| **Likelihood** | MEDIUM |
| **Gate affected** | Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Readiness check compares required migration filenames; refuse traffic if behind. |
| **Verification required** | Deploy test with skipped migrate fails closed. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-DR-001 — Backup / restore not defined in repository

| Field | Value |
|-------|-------|
| **Area** | DR |
| **Evidence** | No backup scripts or restore docs; operator/provider settings UNKNOWN_EXTERNAL. |
| **Failure / threat scenario** | Data loss; Account Erasure stuck in `erasing` unrecoverable. |
| **Current control** | Provider defaults (unknown). |
| **Severity** | CRITICAL (if no provider backups) |
| **Likelihood** | UNKNOWN |
| **Gate affected** | Alpha, Beta |
| **Classification** | BLOCKER_ALPHA (until provider backup verified) / UNKNOWN_EXTERNAL |
| **Recommended remediation** | Slice C: enable PITR; quarterly restore drill; runbook for `erasing` recovery. |
| **Verification required** | Documented restore test date. |
| **Confidence** | Low without operator input |
| **Human Decision Required?** | **Yes** — backup retention and RPO/RTO for Alpha. |

---

### PR-OBS-001 — No structured logging, metrics, or health endpoints

| Field | Value |
|-------|-------|
| **Area** | Observability |
| **Evidence** | No logger usage in `src/`; no `/health` route; no metrics middleware (grep 2026-10-07). |
| **Failure / threat scenario** | Incidents undiagnosable; 5xx surge unnoticed. |
| **Current control** | Platform default logs (stdout). |
| **Severity** | HIGH |
| **Likelihood** | HIGH Beta |
| **Gate affected** | Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice E: readiness/liveness, correlation IDs, redaction-safe error pipeline. |
| **Verification required** | Alert on error rate; health check wired to load balancer. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-LLM-001 — No app-level timeouts / cost ceilings on OpenAI calls

| Field | Value |
|-------|-------|
| **Area** | LLM operations |
| **Evidence** | OpenAI SDK used in extract/Receiver paths; optional modes via env; no central rate limiter in repo. |
| **Failure / threat scenario** | Runaway spend or hung requests under abuse or model outage. |
| **Current control** | Deterministic fallbacks for Receiver; extraction optional; `store: false`. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM Beta |
| **Gate affected** | Alpha (if live extraction enabled), Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice D: timeouts, concurrency caps, provider billing alerts; Alpha policy for enabling extraction. |
| **Verification required** | Chaos test model failure → graceful degradation. |
| **Confidence** | Medium |
| **Human Decision Required?** | **Yes** — enable live extraction during Alpha? |

---

### PR-ABU-001 — No rate limits on shared Receiver Q&A

| Field | Value |
|-------|-------|
| **Area** | Abuse |
| **Evidence** | Share Q&A server actions accept questions without per-token throttle (code review). |
| **Failure / threat scenario** | Anonymous share link → LLM/DB cost exhaustion. |
| **Current control** | Share link secrecy; optional deterministic Receiver mode. |
| **Severity** | HIGH |
| **Likelihood** | MEDIUM |
| **Gate affected** | Beta; Alpha if semantic/openai Receiver enabled |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice D: per-token/IP rate limits; captcha optional later. |
| **Verification required** | Load test share Q&A. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-ABU-002 — No transcript / import size limits

| Field | Value |
|-------|-------|
| **Area** | Abuse |
| **Evidence** | `importConversationAction` passes full transcript string to parser without documented max length. |
| **Failure / threat scenario** | Large paste → memory/DB bloat; slow imports. |
| **Current control** | Authenticated Creator only; Alpha small invite list. |
| **Severity** | MEDIUM |
| **Likelihood** | LOW–MEDIUM |
| **Gate affected** | Alpha, Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Enforce max bytes/messages at import; user-visible error. |
| **Verification required** | Test oversized import rejected. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-INP-001 — SQL parameterization & React escaping (strength)

| Field | Value |
|-------|-------|
| **Area** | Input safety |
| **Evidence** | Postgres repositories use parameterized queries; React default escaping for UI text. |
| **Failure / threat scenario** | N/A — strength. |
| **Current control** | Tests + code patterns. |
| **Severity** | INFO |
| **Likelihood** | N/A |
| **Gate affected** | Alpha, Beta |
| **Classification** | ACCEPTABLE_CURRENTLY |
| **Recommended remediation** | Maintain; review any future HTML/markdown rendering. |
| **Verification required** | Security review on new UI surfaces. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-PRV-001 — Operational data lifecycle beyond application DB

| Field | Value |
|-------|-------|
| **Area** | Privacy / erasure |
| **Evidence** | M12 erasure deletes application rows (T-018 tested); backups/logs/model provider retention not controlled in app. |
| **Failure / threat scenario** | Account Erasure succeeds but PII remains in logs/backups/model vendor retention. |
| **Current control** | Canon distinguishes application erasure; Current State excludes legal hold scope. |
| **Severity** | MEDIUM |
| **Likelihood** | HIGH without operator policy |
| **Gate affected** | Alpha, Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Document operator boundaries; log redaction (PR-SH-001); backup retention policy; OpenAI DPA/retention settings. |
| **Verification required** | Privacy appendix for Alpha invitees. |
| **Confidence** | High |
| **Human Decision Required?** | **Yes** — Alpha data sensitivity disclosure text. |

---

### PR-OPS-001 — Minimal operator runbooks absent

| Field | Value |
|-------|-------|
| **Area** | Operations |
| **Evidence** | No `docs/runbooks/`; README has dev commands only. |
| **Failure / threat scenario** | Slow/incorrect response to migration failure, OAuth outage, stuck `erasing`. |
| **Current control** | Skilled operator manual intervention (Alpha assumption). |
| **Severity** | MEDIUM |
| **Likelihood** | HIGH Beta |
| **Gate affected** | Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice E: short runbooks tied to findings (migrate, erasing retry, revoke share, key rotation). |
| **Verification required** | Tabletop exercise. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-HLT-001 — No readiness distinction (DB / schema / auth)

| Field | Value |
|-------|-------|
| **Area** | Health |
| **Evidence** | No health route; pool created lazily via `getRepositories()`. |
| **Failure / threat scenario** | Traffic routed to broken instances; deploy marks success before DB reachable. |
| **Current control** | Manual smoke test. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM Beta |
| **Gate affected** | Beta |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | `/ready` checks DB ping + migration version; no secrets in response. |
| **Verification required** | LB removes unhealthy instance in test. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-CAP-001 — Unbounded growth paths (moderate)

| Field | Value |
|-------|-------|
| **Area** | Capacity |
| **Evidence** | Schema stores full source messages, published versions, provenance, shares; library index migration 006; no archival. |
| **Failure / threat scenario** | Alpha OK; Beta creators generate large transcripts → storage/query cost growth. |
| **Current control** | Small Alpha cohort; indexes on library. |
| **Severity** | LOW |
| **Likelihood** | LOW Alpha; MEDIUM Beta |
| **Gate affected** | Beta |
| **Classification** | DEFERRED |
| **Recommended remediation** | Monitor table sizes; plan quotas per Creator later. |
| **Verification required** | DB size metrics. |
| **Confidence** | Medium |
| **Human Decision Required?** | No |

---

### PR-QLT-001 — AI quality not an operational blocker for Alpha

| Field | Value |
|-------|-------|
| **Area** | Product quality |
| **Evidence** | Extraction proposal-only; Creator publish authority; Receiver UNKNOWN/OPEN; live-eval suites opt-in. |
| **Failure / threat scenario** | Poor suggestions or answers annoy users but do not bypass authority boundaries. |
| **Current control** | Human review; deterministic fallbacks. |
| **Severity** | INFO |
| **Likelihood** | N/A |
| **Gate affected** | Alpha |
| **Classification** | ACCEPTABLE_CURRENTLY |
| **Recommended remediation** | Phase 3/4 evaluation workstream (out of T-019). |
| **Verification required** | N/A |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-UTIL-001 — Import provider limited to generic-text

| Field | Value |
|-------|-------|
| **Area** | Product utility |
| **Evidence** | README / `src/import` — generic-text only. |
| **Failure / threat scenario** | Invitees must paste transcripts manually. |
| **Current control** | Generic adapter works for Alpha workflows. |
| **Severity** | INFO |
| **Likelihood** | N/A |
| **Gate affected** | Alpha |
| **Classification** | ACCEPTABLE_CURRENTLY |
| **Recommended remediation** | Separate provider integration milestone. |
| **Verification required** | N/A |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

## Finding counts

| Classification | Count |
|----------------|------:|
| BLOCKER_ALPHA | 4 |
| REQUIRED_BEFORE_BETA | 14 |
| HARDEN_BEFORE_PUBLIC | 2 |
| DEFERRED | 3 |
| ACCEPTABLE_CURRENTLY | 5 |
| UNKNOWN_EXTERNAL | 1 |

| Severity | Count |
|----------|------:|
| CRITICAL | 1 |
| HIGH | 9 |
| MEDIUM | 14 |
| LOW | 2 |
| INFO | 5 |

| Area (primary) | Count |
|----------------|------:|
| Repository / CI | 3 |
| Share / C-005 | 2 |
| Deployment / auth | 3 |
| Database / migrations | 3 |
| Observability / health / ops | 3 |
| Abuse / LLM | 3 |
| Supply chain | 4 |
| Privacy | 1 |
| Strengths (ACCEPTABLE) | 4 |

## Exit-gate matrix

| Area | Current status | Alpha gate | Beta gate | Evidence | Next action |
|------|----------------|------------|-----------|----------|-------------|
| Hosted CI | Missing | Manual test matrix acceptable with checklist | Required | workflows=0 | Slice A |
| Branch protection | Unknown (API 403) | Single-operator discipline | Required | API + State | Slice A |
| Application authZ | Strong | GO | GO | 72 auth + 97 integration tests | Maintain CI |
| External OAuth deploy | Not audit-verified | Staging OAuth required | Required | Tests mock OAuth | Staging checklist |
| Share URL log redaction (C-005) | Not implemented | **Conditional** — proxy policy required | Required | Canon C-005; `/share/[token]` | Slice B |
| DB backups / PITR | Unknown | Operator must verify | Required | No repo evidence | Slice C + human RPO |
| Migration concurrency | Unlocked script | Single migrator OK | Required | `migrate.mjs` | Slice C |
| DB pool defaults | pg defaults | Single instance OK | Tune required | `pool.ts` | Slice D |
| Rate / cost limits | Absent | Limit LLM modes / invites | Required | code review | Slice D |
| Security headers | App not configured | HTTPS + platform headers | Explicit policy | `next.config.ts` | Slice B |
| Observability | Stdout only | Manual monitoring | Required | no logger | Slice E |
| npm audit (prod) | 4 advisories | Monitor | Remediate | 2026-10-07 audit | Slice A |
| M12 erasure | Implemented | GO | GO | T-017/T-018 tests | Preserve |

## Recommended remediation slices (proposed, not created as Tasks)

### Slice A — Hosted verification & repository protection

- **Closes:** PR-RC-001, PR-RC-002, PR-RC-003, PR-SC-001 (CI audit gate), PR-SC-004  
- **Dependencies:** None  
- **Verification:** PR checks mandatory; `npm run build` + test matrix green  
- **Human/deploy input:** GitHub admin to enable protection  

### Slice B — Deployment boundary: TLS, headers, share log redaction

- **Closes:** PR-SH-001, PR-SEC-001, PR-DEP-002 (in staging)  
- **Dependencies:** Slice A (staging env)  
- **Verification:** Header scan; access log sampling; OAuth on staging URL  
- **Human/deploy input:** Platform choice, log pipeline access  

### Slice C — Database operations: migrate lock, readiness, backups

- **Closes:** PR-MIG-001, PR-MIG-002, PR-DR-001  
- **Dependencies:** Deployment target known  
- **Verification:** Concurrent migrate test; restore drill; readiness fails if schema behind  
- **Human/deploy input:** Provider backup settings  

### Slice D — Abuse, cost, and runtime resilience

- **Closes:** PR-DB-001, PR-ABU-001, PR-ABU-002, PR-LLM-001  
- **Dependencies:** Slices A–C baseline  
- **Verification:** Rate limit tests; pool metrics under load  
- **Human/deploy input:** OpenAI billing alerts  

### Slice E — Observability & runbooks

- **Closes:** PR-OBS-001, PR-OPS-001, PR-HLT-001, PR-PRV-001 (documentation half)  
- **Dependencies:** Slice B redaction rules  
- **Verification:** Alert fires on synthetic failure; runbook tabletop  
- **Human/deploy input:** On-call owner for Beta  

## Human decisions (genuine unresolved choices)

1. **Deployment platform and migration job model** (PR-DEP-001) — required before Slice C/D tuning.  
2. **Alpha share-link policy under C-005** — accept infrastructure logging risk with compensating log policy vs delay external shares until Slice B (PR-SH-001).  
3. **Enable live OpenAI extraction during Alpha?** (PR-LLM-001) — data leaves boundary to model provider; disclosure to invitees (PR-PRV-001).  
4. **Backup retention / RPO for Alpha** (PR-DR-001) — provider settings and acceptable recovery point.  
5. **Auth.js beta → stable timing for Beta** (PR-SC-003).  

If Alpha uses **external auth only**, **verified backups**, **manual CI gate**, and **documented share log handling**, no further product-policy decisions block the first remediation slice.

## Verification log (T-019 execution)

| Command | Result (2026-10-07 UTC) |
|---------|-------------------------|
| `node tooling/governance/check.mjs` | PASS |
| `git diff --check` | PASS (pre-commit) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm test` | 14 PASS |
| `npm run test:application` | 37 PASS |
| `npm run test:auth` | 72 PASS |
| `npm run test:integration` | 97 PASS |
| `npm run test:share` | 17 PASS |
| `npm run test:receiver` | 11 PASS |
| `npm run test:e2e` | 13 PASS |
| `npm audit` | 7 vulns (2 critical dev-only) |
| `npm audit --omit=dev` | 4 vulns |
| `npm outdated` | next, openai, pg minor drift; vitest major available |

No production database access. No dependency changes. No runtime code changes.

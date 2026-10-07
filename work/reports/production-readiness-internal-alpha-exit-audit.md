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
| **Controlled Internal Alpha** | **CONDITIONAL GO** | Application-layer auth, ownership, share semantics, and M12 erasure are strong and heavily tested. Alpha is allowed only when: (1) deployment uses **external auth over HTTPS** with `CREATOR_AUTH_MODE=external`; (2) **target deployment** Google OAuth / host / cookie / proxy behavior has passed smoke (historical T-010 evidence does not replace this); (3) **DB backup/PITR** capability is operator-verified; (4) every deploy uses the documented **full deterministic test + migration** gate; (5) Share links are either operated under a verified **no-token-log** infrastructure policy or explicitly restricted under a **human-approved Alpha risk policy** (C-005). Disabled auth is fail-closed (not a security defect). |
| **Limited Beta** | **NO-GO** | Missing hosted CI, `main` unprotected, no health/readiness surface, no rate/cost guards on share and LLM paths, default DB pool/migration concurrency hazards for multi-instance deploys, and unresolved C-005 infrastructure log redaction block unattended internet-facing operation. |

## Top blockers (Alpha-critical)

Grouped by nature after catalog reconciliation (see findings for full fields):

**Product / repository gaps**

- **PR-SH-001** — C-005 share bearer may appear in infrastructure access logs (`/share/[token]`); blocks confident external share operation until proxy/log policy or accepted Alpha risk decision.

**Target deployment verification prerequisites**

- **PR-AUTH-001** — Target Alpha/staging OAuth smoke not yet evidenced (redirect URI, HTTPS, cookies, proxy trust, post–T-018 account deletion/re-login); implementation was live-verified in T-010.
- **PR-DEP-002** — Proxy/`AUTH_TRUST_HOST` alignment must be verified on the chosen host before external auth is relied upon.

**Operator evidence requirements**

- **PR-DR-001** — Backup/PITR/restore capability is not defined in-repo; Alpha with real data requires provider evidence (confidence Low until supplied).

**Not Alpha security blockers (Beta or compensating controls)**

- **PR-RC-001** — No hosted CI; Alpha may compensate with manual pre-deploy test matrix.
- **PR-RC-002** — `main` is currently unprotected; Alpha may rely on single-operator merge discipline until Slice A + GitHub admin action.

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

Legend: **KNOWN (repo)** = established from repository or standard GitHub branch API; **KNOWN (historical)** = recorded task evidence; **TARGET-ENV** = must be verified on the eventual Alpha deployment; **UNKNOWN (deployment/provider)** = not visible to this audit.

| Topic | State | Why |
|-------|-------|-----|
| Google OAuth implementation & historical smoke | **KNOWN (historical)** | T-010 records live Google OAuth smoke PASS (first login, `/new`, mapping cardinality 1, Handoff ownership, sign-out, relogin/CreatorId reuse, M8 share smoke). |
| Target Alpha deployment OAuth / TLS / cookies / proxy | **TARGET-ENV** | Redirect URIs, HTTPS, cookie behavior, host/proxy trust, and post–T-018 deletion/re-login lifecycle must be re-verified after deploy configuration is chosen (PR-AUTH-001, PR-DEP-002). |
| Hosting platform & process model | **UNKNOWN (deployment/provider)** | No `vercel.json`, Dockerfile, or deploy scripts in repo (PR-DEP-001). |
| Production `DATABASE_URL` provider & TLS | **UNKNOWN (deployment/provider)** | Pool uses connection string only; SSL not configured in code. |
| Backup / PITR / restore test | **UNKNOWN (deployment/provider)** | Not represented in repository (PR-DR-001). |
| Access / CDN / reverse-proxy log policy | **TARGET-ENV** | C-005 deferred; especially `/share/[token]` path logging (PR-SH-001). |
| `main` branch protection (basic) | **KNOWN (repo/API)** | `GET .../branches/main` → `protected: false`, `protection.enabled: false`, required status checks off (PR-RC-002). |
| Full GitHub admin protection / security settings | **UNKNOWN (deployment/provider)** | Dedicated protection admin endpoint returned HTTP 403 to audit credential; Dependabot/secret scanning not confirmed via API used. |
| Error monitoring (Sentry etc.) | **KNOWN (repo)** | None in codebase. |
| Cost / quota limits on OpenAI | **KNOWN (repo)** | Env-only; no app-level ceiling. |

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

### PR-RC-002 — `main` branch is currently unprotected

| Field | Value |
|-------|-------|
| **Area** | Repository / CI |
| **Evidence** | `GET /repos/CarlosKim-1997/Hermeneus/branches/main` (2026-10-07): `protected: false`, `protection.enabled: false`, `required_status_checks.enforcement_level: off`. Dedicated `GET .../branches/main/protection` → HTTP 403 for audit integration (admin-only view of full rule payload). |
| **Failure / threat scenario** | Direct push to `main` bypassing review/tests. |
| **Current control** | Public repo visibility; human merge discipline. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM |
| **Gate affected** | Alpha (acceptable with single operator), Beta (always) |
| **Classification** | REQUIRED_BEFORE_BETA |
| **Recommended remediation** | Slice A hosted CI first; then protect `main`; require new status checks (GitHub admin). |
| **Verification required** | Branch API or UI shows protection enabled and required checks attached. |
| **Confidence** | High (basic protected/unprotected state); Medium for full admin-only protection configuration |
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
| **Severity** | MEDIUM |
| **Likelihood** | LOW |
| **Gate affected** | Beta (CI hygiene only; not in production bundle) |
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
| **Gate affected** | Alpha when external auth is used; Beta always |
| **Classification** | BLOCKER_ALPHA |
| **Recommended remediation** | Platform-specific trust config; target-environment OAuth test; document reverse proxy rules. |
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
| **Gate affected** | Alpha when external Share links are used; Beta always |
| **Classification** | BLOCKER_ALPHA |
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
| **Classification** | ACCEPTABLE_CURRENTLY |
| **Recommended remediation** | Operational guidance for invitees; optional future fragment/post pattern (product change — not T-019). |
| **Verification required** | Support/runbook mentions handling. |
| **Confidence** | High |
| **Human Decision Required?** | No |

---

### PR-AUTH-001 — Target Alpha deployment OAuth smoke not yet evidenced

| Field | Value |
|-------|-------|
| **Area** | Authentication |
| **Evidence** | **Historical (T-010):** live Google OAuth smoke PASS — first login, `/new`, mapping cardinality 1, real UI Handoff ownership, sign-out, same-account relogin with CreatorId reuse, no duplicate mapping/Creator, M8 bearer share/revoke smoke (`work/tasks/T-010-external-identity-bridge.md`). **Gap:** the eventual/current Alpha deployment environment has not been target-environment-verified after production/staging redirect URI, HTTPS, cookie behavior, host/proxy trust, and post–T-018 account deletion/re-login lifecycle configuration is chosen. Automated tests mock/stub Auth.js; T-018 adds lifecycle/session tests. |
| **Failure / threat scenario** | Deployment-specific misconfiguration (redirect URI, `Secure` cookies, proxy trust) blocks real Creators or breaks session/erasure flows on the Alpha URL. |
| **Current control** | Application invariants and external-identity mapping tested in CI; T-010 proves implementation can pass live smoke in a configured environment. |
| **Severity** | MEDIUM |
| **Likelihood** | MEDIUM on first target deploy |
| **Gate affected** | Alpha (external auth on target URL) |
| **Classification** | BLOCKER_ALPHA |
| **Recommended remediation** | Target-environment checklist: Google login/logout, Handoff create, share smoke, account erasure, re-login new lifecycle — on the Alpha/staging URL with final env vars. |
| **Verification required** | Recorded target-environment OAuth E2E (operator sign-off). |
| **Confidence** | High (repo + T-010 historical); Medium until target URL evidence exists |
| **Human Decision Required?** | No |

---

### PR-AUTH-002 — Creator auth disabled by default (fail-closed)

| Field | Value |
|-------|-------|
| **Area** | Authentication |
| **Evidence** | `CREATOR_AUTH_MODE` unset → `disabled` (`auth-config.ts`). `disabled` → disabled `CreatorSessionProvider`; `getCurrentPrincipal()` → `undefined` (`src/application/creator-session-factory.ts`). Creator page/action guards therefore do not grant Creator authority when auth is disabled. |
| **Failure / threat scenario** | If operators forget to set `CREATOR_AUTH_MODE=external` on Alpha, **invited Creators cannot use the product** (workflow unavailable) — not public exposure of privileged surfaces. |
| **Current control** | Fail-closed security posture; dev auth refused in production; README documents modes. |
| **Severity** | LOW |
| **Likelihood** | MEDIUM (operational misconfiguration) |
| **Gate affected** | Alpha (operational prerequisite to set external auth) |
| **Classification** | ACCEPTABLE_CURRENTLY |
| **Recommended remediation** | Alpha deploy checklist: set and verify `CREATOR_AUTH_MODE=external`; optional future fail-fast if disabled on production-labeled env (remediation, not T-019). |
| **Verification required** | Target Alpha env shows login-gated Creator flows after external auth configured. |
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
| **Severity** | CRITICAL |
| **Likelihood** | UNKNOWN until operator confirms provider backups |
| **Gate affected** | Alpha, Beta |
| **Classification** | BLOCKER_ALPHA |
| **Recommended remediation** | Slice C: enable PITR; quarterly restore drill; runbook for `erasing` recovery. |
| **Verification required** | Documented restore test date and retention settings. |
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
| **Human Decision Required?** | No (disclosure tied to live extraction decision PR-LLM-001) |

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

**Total findings:** 30 (`### PR-...` headings in this catalog).

Reconciliation note: counts are derived from **one primary Classification** and **one primary Severity** per finding; gate inheritance (e.g. Beta inheriting Alpha blockers) belongs in **Gate affected**, not in Classification.

| Classification | Count |
|----------------|------:|
| BLOCKER_ALPHA | 4 |
| REQUIRED_BEFORE_BETA | 15 |
| HARDEN_BEFORE_PUBLIC | 2 |
| DEFERRED | 2 |
| ACCEPTABLE_CURRENTLY | 6 |
| UNKNOWN_EXTERNAL | 1 |

| Severity | Count |
|----------|------:|
| CRITICAL | 1 |
| HIGH | 7 |
| MEDIUM | 14 |
| LOW | 3 |
| INFO | 5 |

| Area (primary, normalized) | Count |
|----------------------------|------:|
| Repository / CI | 3 |
| Supply chain | 4 |
| Deployment | 2 |
| HTTP / browser security | 1 |
| Share bearer | 2 |
| Authentication | 2 |
| Authorization | 1 |
| Database / migrations / DR | 4 |
| Observability | 1 |
| LLM operations | 1 |
| Abuse | 2 |
| Input safety | 1 |
| Privacy | 1 |
| Operations | 1 |
| Health / readiness | 1 |
| Capacity | 1 |
| Product (quality / utility) | 2 |

## Exit-gate matrix

| Area | Current status | Alpha gate | Beta gate | Evidence | Next action |
|------|----------------|------------|-----------|----------|-------------|
| Hosted CI | Missing | Manual test matrix acceptable with checklist | Required | workflows=0 | Slice A |
| Branch protection | **Known unprotected** | Single-operator discipline | Required | branch API `protected: false` | Slice A |
| Application authZ | Strong | GO | GO | 72 auth + 97 integration tests | Maintain CI |
| Auth default (`disabled`) | Fail-closed | GO (set `external` for usability) | GO | `creator-session-factory.ts` | Deploy checklist |
| External OAuth (implementation) | T-010 historical PASS | — | — | T-010 task record | Preserve |
| Target deployment OAuth | Not target-evidenced | Required on Alpha URL | Required | PR-AUTH-001 | Slice B checklist |
| Share URL log redaction (C-005) | Not implemented | **Conditional** — proxy policy or accepted risk | Required | Canon C-005; `/share/[token]` | Slice B |
| DB backups / PITR | Operator unknown | Operator must verify | Required | PR-DR-001 | Slice C + human RPO |
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

### Slice B — Deployment boundary: TLS, headers, share log redaction, target OAuth

- **Closes:** PR-SH-001, PR-SEC-001, PR-DEP-002, PR-AUTH-001 (target-environment smoke)
- **Dependencies:** Deployment platform selection (PR-DEP-001); Slice A optional for CI on staging PRs
- **Verification:** Header scan; access log sampling; Google OAuth + erasure/re-login on target Alpha/staging URL
- **Human/deploy input:** Platform choice, log pipeline access, OAuth redirect URIs

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

Only choices that cannot be settled by implementation or deployment evidence alone:

1. **Deployment platform and migration job model** (PR-DEP-001) — required before Slice C/D tuning and target OAuth/DB evidence.
2. **Alpha share-link policy under C-005** (PR-SH-001) — accept infrastructure logging risk with compensating log policy vs restrict external shares until Slice B log redaction is proven.
3. **Enable live OpenAI extraction during Alpha?** (PR-LLM-001) — includes invitee disclosure for data sent to the model provider (related privacy scope PR-PRV-001).
4. **Backup retention / RPO–RTO for Alpha** (PR-DR-001) — provider settings and acceptable recovery point.
5. **Auth.js beta → stable timing for Beta** (PR-SC-003).

**Slice A blocked by Human Decision?** **No** — Slice A (hosted CI + eventual branch protection after checks exist) can begin independently; it does not require hosting-provider selection for its core workflow work. Branch protection enablement may still need a GitHub admin after checks are green.

Facts **not** requiring Human Decisions (evidence or configuration): T-010 historical Google OAuth smoke; fail-closed disabled auth (PR-AUTH-002); `main` currently unprotected (PR-RC-002); target-environment OAuth re-verification checklist (PR-AUTH-001).

## Verification log (T-019 execution)

| Command | Result (2026-10-07 UTC) |
|---------|-------------------------|
| `node tooling/governance/check.mjs` | PASS |
| `git diff --check` | PASS (pre-commit; reconciliation pass) |
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

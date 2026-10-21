# T-032 scoped Handoff/widget local verification

2026-10-21 (Asia/Seoul). **Local flow verified; live activation pending authority/OAuth gates.**

## Artifact and scope

- Base/current branch HEAD: 4e17be8c5d1e41be462022f51c148eae854584b1.
- Branch: codex/scoped-mcp-local, reused managed worktree
  C:/Users/김성하/.codex/worktrees/ui-reference-release/hermeneus.
- Local source additions and package delta only; no commit, push, merge or hosted
  CI/deployment is claimed. Exact final source hashes: t032-scoped-mcp-artifacts.sha256.
- The older dirty primary checkout, its UI and T-028 prototype remain preserved.
  New src/mcp and tests are mirrored there for continuity. The integration-ready
  package/lock and current main UI remain in the managed worktree; do not replace
  them with the older primary checkout's package/lock/UI.

## Implemented boundary

The non-mounted, default-disabled MCP handler exposes only get_handoff_packet,
review_handoff_answer and app-routed inspect_handoff_review. Models cannot mint
web delegation/approval or administer Shares. Cookie/Creator identity is not MCP
authorization. Disclosure is bound to a verified connection, the selected parent
Share and its exact Published version. Configured web origin is independent of
the MCP audience and never taken from an untrusted request header.

JWT verification uses the installed jose 6.2.12, pinned issuer/single audience,
RS256/ES256 access-token signature/type, required claims, expiry and a required
live-session callback. OAuth authorization/code/session issuance and live JWKS
configuration are not implemented by the test double. The separate resource
server adapter is not a claim that the complete OAuth flow already works.

PostgreSQL adapters read actual existing application tables and Published
snapshots. Local candidate metadata SQL is outside migrations/ and is applied
only by the disposable test. It stores approval nonce hashes, connection hashes,
parent/version references, expiry/revocation and consumed nonce state. It has no
answer/question/confirmation/submission-digest columns. Canonical packet digest
is metadata; submission digest exists only in a signed transient widget ticket.
Parent deletion cascades to its approvals, grants and tickets. Client-role grants
are explicitly revoked, even with permissive default grants in the test.

Original text uses textContent, not HTML. Answers/tickets are not in URLs,
storage, widget state, queues or data tables. The single-use ticket is bound to
the exact original and connection; it is no native user-consent attestation.
UI-only routing is not an authentication boundary. A directly authenticated SDK
client can request structural inspection with its valid ticket, but cannot make
it paid verification or an ALIGNED verdict. Missing semantic analysis stays
INDETERMINATE and is labeled unexecuted. ChatGPT retention remains separate.

## Verification

Node 22.23.3, MCP SDK 1.32.1; scoped and normal TypeScript checks and Governance
pass. Final unit result and source hashes are recorded alongside this report.
The complete unit suite passes **176 tests / 22 files**: baseline 131 plus 45 new scoped/JWT/transport cases.

Disposable PostgreSQL 17: **9 PASS**. Existing migrations 001–011 plus the
explicit local candidate were applied to a fresh tmpfs cluster, guarded by exact
test host/name/user and a disposable-run flag. It tests actual repository reads,
version pinning, source erasure survival, separate capabilities on one version,
eight competing service-instance ticket consumers (one winner), revocation
between service check and consumption, revocation in the final grant read,
Handoff/Creator erasure/cascades, missing body persistence, expiry cleanup and
Data API role denial. No target DB/environment credentials were loaded.

Isolated browser: **5 PASS**. Actual MCP SDK requests through the in-process
resource transport connect the selected-answer widget to scoped service
inspection. Tests cover manual confirmation, identical metadata replay,
parent revocation before click, late result/new input, expiry clearing,
literal HTML/script display, empty browser storage and failed-host no retry.
This is an owned fixture, not a new live ChatGPT run of this scoped library.

Evidence in the managed worktree:
- dist/t032-verified.log
- dist/scoped-mcp-34bc05e12b6f4a65863122afeaf4bdee/test-results/mcp-local
- dist/t032-unit-final.log
- dist/t032-audit.log

## Internal adversarial review and fixes

1. Bound web approval to the selected Share as well as connection/cookie/CSRF,
   preventing an approval for A being used to delegate B. Added negative test.
2. Bound connection lifetime claims to grant identity so reissued/extended
   credentials cannot silently inherit the old grant. Added negative test.
3. Final PostgreSQL grant lookup checks current parent/Creator in one snapshot;
   ticket consumption is an atomic live-parent UPDATE. Added a final-read race
   and competing-instance checks. No in-process mutex is called distributed proof.
4. Kept provider spend unreachable and structural failures conservative; did not
   treat a model-supplied consent flag or app visibility as human authorization.
5. Initial browser fixture used insecure HTTP without an explicit UTF-8 host
   document; it could not hydrate the cryptographic original check. Corrected
   the fixture to fully intercepted HTTPS and explicit UTF-8, then all five
   browser cases passed. No host protection was weakened.

This is Codex internal review, not independent third-party assurance.

## Tool recovery and dependency audit

Docker initially had no engine. Launching it from the agent reproduced its
sailor-ingest.sock startup failure. After graceful stop failed, only the failed
helper processes started by this execution were stopped. Launch through normal
Windows shell restored the engine. No runtime directory rename/reset or volume
deletion was used. The observed behavior is consistent with the published
MSIX launch report, not an independent diagnosis of the Windows kernel:
https://github.com/openai/codex/issues/52698

Fixture containers use the pinned official Playwright 1.63 image and a fresh
PostgreSQL 17 cluster; dependency preparation precedes network isolation.
Owned containers and network were verified removed after the run. Docker
Desktop is left running rather than interrupting unrelated user workloads.

Production dependency audit at the repository's critical threshold exits zero:
0 critical, 3 high, 1 moderate. The reported Next/PostCSS/Sharp/source-map-js
versions and integrity are identical to base main (15.5.26, 8.4.31, 0.35.4,
1.2.1). This is not a zero-vulnerability claim or an independent exploitability
assessment; preserve the audit for maintenance triage before a public release.
No dependency upgrade outside the scoped SDK/jose addition was performed.

## Remaining activation boundary

The live fixed synthetic plugin still serves its previously accepted widget.
The protected web Alpha does not use src/mcp yet. Existing installed D-008 has
not been rewritten, and the local candidate SQL is not a target migration.
No new OAuth registration, DB role/target mutation, secret provisioning, public
endpoint, external paid call or deployment was made.

Concrete Canon successor text, issuer options, least-privilege target plan and
user path: work/proposals/scoped-mcp-activation.md. The already-approved policy
is preserved; formal Canon activation permission and the new issuer/security
boundary need the human decision required by AGENTS.md. Finish actual OAuth
browser/code/session integration after that decision; only then request its
reviewable external application steps and exact hosted release gates.

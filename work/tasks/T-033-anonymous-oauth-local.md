---
schema: task/v1
id: T-033
status: COMPLETE
areas:
  - handoff
depends_on:
  - T-032
implements:
  - D-015
  - C-005
  - C-006
  - C-009
  - C-012
---
# Dedicated anonymous OAuth issuer: local implementation

## Objective

Finish a real local authorization-code/PKCE issuer and per-share browser approval
for the previously verified scoped MCP resource server; formalize approved policy.

## Authority

The owner approved the recommended dedicated anonymous OAuth issuer and Canon
formalization by requesting the next stage after the T-032 activation proposal.
Local source, candidate SQL, tests, documentation and narrow Canon recording are
authorized. Commit, push, integration, target DB/role/secret mutation, public deploy,
new plugin permission grants, paid calls and real-data use remain separate.

## Scope

Create D-015 as the successor to D-008, preserving the old body and other Canon.
Implement pinned discovery/JWKS, exact predefined clients, code + PKCE S256,
one-use browser approval/code, no-refresh signed access tokens and durable session
revocation. Connect the locally approved Share to one authenticated connection.
Exercise real crypto, HTTP, browser and disposable PostgreSQL lifecycle regressions.
Prepare concrete external activation steps without applying them.

## Constraints

No Creator Google token/key reuse, account signup, raw Share/code/token persistence,
answer/question/consent persistence or automatic semantic call. Preserve original
web Share access. Candidate SQL stays outside automatic migrations. Disabled by
default; do not mount this code in existing live Alpha or the fixed synthetic host.
Use the existing isolated current-main worktree, preserving its T-032 delta and
the primary checkout's unrelated UI work.

## Verification

Reject wrong client, redirect, resource, scopes, missing/invalid PKCE, duplicate
parameters, CSRF, session/code replay/expiry/revocation and parent lifecycle races.
Check RFC 9207 issuer responses, no refresh, concurrent code redemption, metadata
privacy, cleanup and unchanged original Share authority. Internally review the
security diff adversarially; record exact artifacts and local/hosted distinctions.

## Stop Conditions

Escalate new normative choices, material Canon conflict, unapproved external
activation, real-data use, paid calls or destructive target work. Continue safe
local development independently.

## Completion Criteria

The local signed-token OAuth → pinned Canon → confirmed-widget structure inspection
path passes with focused negative tests, and external application needs are
reviewable. Local tests do not establish live ChatGPT callback/host compatibility.

## Completion evidence — 2026-10-21

Base and observed remote main: 4e17be8c5d1e41be462022f51c148eae854584b1.
The owner's explicit dedicated-issuer/Canon approval reply was also received
during this episode. D-015 supersedes D-008 locally, with the old semantic body
unchanged. Unit 201 / PostgreSQL 16 / browser 8 pass; normal and scoped typechecks
and installed Governance pass. The local OAuth → pinned Canon → confirmed inline
structure inspection path uses real ES256 tokens and SDK authorization/token/MCP
HTTP processing. Internal challenge fixed final-read session-revocation races,
form Origin/referrer behavior and cancellation CSP navigation. Report and exact
artifact manifest: work/reports/t033-anonymous-oauth-local.md and
work/reports/t033-oauth-artifacts.sha256. No commit, push, target DB/role/key,
plugin grant, paid call or deployment was performed in this episode.

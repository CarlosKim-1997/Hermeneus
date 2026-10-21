# Scoped MCP activation preparation

2026-10-21. Work proposal, not installed Canon or permission to deploy.

## Update after the owner's dedicated-issuer approval

The owner selected the recommended dedicated anonymous OAuth 2.1 issuer and
authorized formal Canon recording. D-015 now supersedes D-008 in the local
review artifact, preserving the latter's body and the other active Constraints.
The design and local verification are recorded in
`work/reports/t033-anonymous-oauth-local.md`. The draft/choice sections below
preserve the earlier proposal basis; those choices are no longer undecided.
The local source remains unmounted; remote main and live environments are unchanged.

The combined candidate serves issuer and MCP on one separate HTTPS origin;
the existing web Alpha is a distinct allowed Share-link origin. Its local first
connection screen explicitly accepts the original fragment Share link, parses
it in-browser and POSTs the raw bearer once. It does not yet automatically carry
the existing web page's in-memory bearer across origins. A fixed explicit Share
page handover and live plugin callback acceptance remain activation/UI work.
Neither an OAuth code nor a bearer may be smuggled into a new-Chat prompt.

## Preserved human decisions

The owner already ratified the per-share delegation, 30-minute grant, 60-minute
connection without refresh, one-use 60-second ticket, ephemeral answer/consent and
security-metadata cleanup policy in t028-scoped-mcp-and-return-proposal.md.
The owner then selected inline Chat widget review instead of the blocked popup
POST UX and accepted the synthetic widget roundtrip on 2026-10-21. These choices
do not need to be presented as undecided again. Paid semantic verification and
real-data readiness remain separate.

## Implemented local artifact

Base main 4e17be8c5d1e41be462022f51c148eae854584b1, branch
codex/scoped-mcp-local in the reused managed worktree. src/mcp contains a
non-mounted resource-server library, JWT access-token verifier, original-bearer
web approval/delegation boundary, PostgreSQL parent/security-metadata adapters,
MCP tools and ephemeral widget. The handler is disabled by default. No Next API
route or public synthetic-host import activates it. postgres-schema.sql is a
local candidate outside migrations/, so normal deploy/migrate cannot apply it.

The local verifier accepts pinned issuer/resource, RS256/ES256 signed RFC 9068
access tokens (typ at+jwt), exact single audience, client_id, subject, jti,
iat/exp and scopes, plus a required current-session callback. It rejects ID
tokens and does not infer access from a Creator cookie. Expiry changes cannot
inherit an older grant. An upstream authorization server/session registry is
still required; fake test sessions do not prove an OAuth code flow.

Before delegation, a signed-in MCP connection alone has no Handoff access.
A web-only one-use approval is bound to that connection, browser cookie/CSRF
pair and the specifically selected Share capability. Models cannot mint it.
The raw Share bearer is accepted only at that web boundary. Every read/review
reauthorizes the connection and live parent; final PostgreSQL grant reads and
atomic ticket consumption check current Share/Creator lifecycle too.

## Canon activation draft: successor to D-008

The installed D-008 still requires the original Share bearer for protected
shared operations. The already-approved dependent credential must be formally
recorded before enabling a live delegated route. This draft preserves D-008's
other semantics and adds that narrow path; it does not rewrite D-013 or C-012.
After authority to canonicalize is explicit, allocate the still-unused Decision
ID, preserve the existing human-ratification provenance, supersede D-008 and
run the installed checker/semantic review. This file itself has no Canon effect.

### Decision text for review

Published versions and Share Capabilities remain separate lifecycle objects.
Each capability targets one immutable Published Handoff version. Multiple
capabilities may target the same version. Revoking one capability does not
change the Published meaning or other capabilities.

Web Receivers present the original high-entropy Share bearer for each protected
web operation. A valid Share does not require Creator login or Receiver signup.
Creator authentication does not substitute for Share possession. Creator
capability administration and internal Handoff routes retain existing owner
authorization.

A valid bearer holder may explicitly delegate only that capability's exact
Published Canon read and selected-answer review to one authenticated AI-client
connection. A non-secret contextRef is a selector, never a standalone credential.
The original bearer is not disclosed to the AI or retained by the delegation.
OAuth authentication alone and model arguments do not grant a delegation.
No delegated Draft, provenance, search/list, Creator mutation or automatic paid
verification privilege is created.

Delegations expire absolutely within 30 minutes and no later than their
60-minute non-refreshing connection. Every operation checks current parent
capability, Handoff and Creator lifecycle. Parent revocation/erasure prevents
future operations; it cannot recall copies already delivered to an AI.
Delegation revocation does not revoke its parent Share. Erasing source provenance
alone preserves surviving Published Canon and must not reconstruct its source.

Answer/question/confirmation bodies stay request/UI ephemeral within Hermeneus.
One-use widget inspection tickets expire within 60 seconds and bind their exact
submission, parent and connection; their bodies/digests are not persisted in
metadata. Only authorization/security metadata is stored, with cleanup within
24 hours after expiry and parent-deletion cascade. ChatGPT retention is separate.
Missing semantic analysis remains INDETERMINATE under D-013/C-012. Widget
confirmation is neither native-host consent evidence nor proof of comprehension.

## Security architecture decision needed before OAuth implementation/activation

Recommended candidate: a dedicated Hermeneus OAuth 2.1 issuer for anonymous
connections, using the installed MCP SDK authorization components plus a durable
session/code adapter, separated from Creator Google login. No email/profile or
Receiver account is requested. This makes Hermeneus responsible for token/key
and authorization-code lifecycle; it is a material new authentication boundary,
so AGENTS.md requires the owner's choice rather than an inferred approval.

Alternative: evaluate a managed authorization server against anonymous linking,
short non-refreshing sessions, existing billing and data conditions before
selecting a provider. No provider has been provisioned or silently selected.

For the dedicated-issuer candidate, prepare:

- Authorization code + PKCE S256; exact pre-registered ChatGPT client and callback
  from the actual connection management page. Do not guess callback IDs, allow
  redirect prefixes, or implement unrestricted dynamic registration.
- Pinned issuer/resource discovery, resource in both authorization/token requests,
  RFC 9207 issuer response, one-use code bound to client/redirect/PKCE/resource,
  same-browser OAuth state/Share approval and strict CSRF checks.
- No refresh tokens; anonymous session registry with monotonic revocation and
  expiry. The JWT verifier's current-session dependency must use that registry.
- Separate OAuth signing/JWKS and inspection-ticket keys in a secure secret
  mechanism; no Creator session key reuse. No keys in prompts, reports or URLs.

Official basis: https://developers.openai.com/plugins/build/auth

## Concrete external application boundary (not executed)

Once issuer design and formal Canon activation are authorized, finish/test the
OAuth browser/code path before requesting these external actions:

1. Apply the reviewed metadata schema as a new numbered migration only to the
   existing synthetic Free Alpha target. Create a least-privilege MCP DB role:
   read needed Share/Handoff/Creator-lifecycle/Published columns, read/write only
   MCP metadata; no source/provenance/identity lookup or Creator mutations.
2. Use a separate CarlosLab Hobby authenticated MCP Alpha project in icn1, with
   a protected application-level OAuth transport. The public fixed synthetic
   plugin and all-deployment protection on the existing web Alpha retain their
   current roles. New endpoint, DB credentials and secret provisioning need
   explicit external-application permission.
3. Create/connect a separate private ChatGPT Alpha plugin using its displayed
   exact client/callback and the chosen issuer. Any browser action granting new
   access requires action-time human confirmation. Keep synthetic data only.
4. Configure/observe metadata cleanup at least within the approved 24-hour bound;
   test cold starts/multiple workers, live revocation/deletion and no secret/body
   logging. The local database uses atomic UPDATE and cascading FKs, not RAM-only
   production authorization.
5. Commit/push/integrate/release the reviewed artifact only under explicit scope
   for this MCP change. Exact required CI and fresh protected-live tests remain
   distinct from local evidence. Paid semantic calls are a later separate gate.

## User path after activation

Share fragment consumed by existing page -> explicit transfer disclosure ->
authenticated anonymous client connection -> same-browser Share approval ->
grant/contextRef -> new Chat/MCP packet -> selected-answer widget -> original
confirmation -> one-use reauthorized structure inspection. Preserve the original
web Share path and fail closed when OAuth, scope, parent or expiry cannot be
verified. The preview card explicitly distinguishes its preparation-time Chat
message from the latest result inside the widget.

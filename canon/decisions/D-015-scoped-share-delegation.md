---
schema: decision/v1
id: D-015
status: ACTIVE
areas:
  - handoff
supersedes:
  - D-008
depends_on:
  - D-006
  - D-009
  - D-013
  - C-005
  - C-006
  - C-008
  - C-009
  - C-012
---
# Share Capability access and dependent AI-client delegation

## Decision

Published Handoff versions and Share Capabilities remain separate lifecycle objects.
Each capability targets exactly one immutable Published `(handoffId, version)`.
Multiple independent capabilities may target the same version. Revoking one does
not change Published meaning or other capabilities. Internal Handoff identifiers
are not shared-surface access credentials.

Web Receivers present the original high-entropy opaque Share bearer for every
protected web operation; the server resolves it to the exact pinned version.
A valid Share requires neither Creator login nor Receiver signup. Creator
authentication never substitutes for Share possession. Creation, inspection and
revocation of Share Capabilities and internal Handoff routes retain server-side
Creator-owner authorization under D-006 / C-006. External authentication provider
choice does not enlarge these permissions.

A valid bearer holder may explicitly delegate that capability's exact Published
Canon read and selected-answer review to one authenticated AI-client connection.
OAuth authentication alone, Creator login and model arguments cannot create a
delegation. Same-browser one-use nonce/CSRF checks bind the selected Share and
connection. A non-secret `contextRef` selects a delegation and is never sufficient
authorization. The original bearer is not disclosed to the AI, placed in OAuth
URLs/state or retained as a reversible copy. No delegated Draft, provenance,
Handoff list/search, Creator mutation or automatic paid verification is granted.

The initial OAuth connection is an anonymous Hermeneus OAuth 2.1 connection,
separate from Creator Google login, requiring no email/profile or Receiver account.
It lasts at most 60 minutes without refresh. Authorization uses code + PKCE S256,
exact registered client/redirect, state, pinned issuer/resource and current-session
verification. A delegation expires absolutely within 30 minutes and never later
than its connection or parent authority. Expiry requires explicit reconnection
and delegation; reissued tokens cannot silently inherit old grants.

Every operation rechecks the current connection, parent Share, Handoff and Creator
lifecycle, including before disclosure or by a short atomic authorization decision.
Parent revocation or erasure prevents future operations; already disclosed AI
copies cannot be recalled. Delegation revocation leaves its parent Share intact.
Source erasure alone preserves surviving Published Canon without reconstruction
of erased provenance. Handoff/account erasure removes related delegation, ticket
and parent-mapping metadata without deleting unrelated connections or Shares.

Answer, question and confirmation bodies remain request/UI ephemeral in Hermeneus.
One-use inspection tickets last at most 60 seconds and bind the exact submission,
parent and connection. Their bodies and submission digests are not persisted in
security metadata. Persist only authorization/security metadata, remove expired
metadata within 24 hours and cascade parent deletion. Third-party AI retention is
separate. Widget confirmation is neither native-host consent attestation nor proof
of comprehension. Missing semantic analysis remains INDETERMINATE under D-013 /
C-012; no new semantic verifier privilege is created.

## Context

The owner explicitly approved the scoped delegation/lifetime/security-record policy
in the T-028 proposal and subsequently selected inline Chat widget review. After
accepting the fixed synthetic widget roundtrip, the owner authorized the recommended
dedicated anonymous issuer and formalization of the already approved policy on
2026-10-21. T-032 isolated local resource-server evidence and the activation proposal
preserve the review basis. This successor records that narrow extension to D-008;
the old Decision's semantic body is preserved. It does not authorize external DB,
provider/plugin provisioning, release, paid calls or real-data use.

## Rationale

Dependent, short-lived per-share authorization lets a Receiver's AI retrieve an
explicitly selected Published version without receiving the original Share secret
or gaining Creator powers. Separating identities, immutable meaning, revocable
access and ephemeral answer review preserves the existing trust boundaries.

## Consequences

- Original anonymous web Share access remains supported independently of OAuth.
- The issuer and resource server must enforce current session and parent lifecycle,
  strict client/redirect/resource/PKCE checks and bounded cleanup across workers.
- Keys, authorization codes and access tokens require secure handling; Creator
  credentials cannot be reused as OAuth or inspection-ticket signing material.
- D-008 is historical SUPERSEDED authority; D-009, D-013 and active Constraints
  retain their meaning. External activation remains a separate execution permission.

# T-035 — Returning Receiver repair draft

Status: recovery design proposal and isolated UI prototype; no live integration.
Owner subsequently approved the proposed next step: a local UI prototype of these
states. `receiver-recovery-preview.html` implements that isolated synthetic preview;
it is not connected to product routes, OAuth, target data or ChatGPT.
Prepared 2026-10-23 against application artifact
5532cef32947dae379cb133cee9cd2a44319b761 (main Work closure
5825a889875a96645ac447de86debb924a350de1).

## Authority correction

Installed D-015 says: "Expiry requires explicit reconnection and delegation".
The earlier report's suggestion to renew only a grant while retaining its
connection is therefore not an approved implementation direction. Preserve explicit
reconnection after expiry; changing that rule would require a human decision and
the appropriate Canon process. No change to either 30/60-minute ceiling is proposed.

## Screen states and actions

| State | Receiver sees | Permitted next action |
| --- | --- | --- |
| Share loaded | Exact Published version and short summary; no AI access yet | Confirm this Share, then open the connection entry |
| Waiting for connection | Connection has not completed; opening the plugin alone is not success | Explain the actual verified host linking steps; allow cancellation |
| Multiple offers | Distinct summaries, versions and fingerprint hints | Explicitly select one; never auto-select the latest window |
| Delegated | This Share is authorized for one connection until its stated expiry | Open a new Chat with the non-secret contextRef |
| Grant or connection expired | AI access has expired; the original web Share may still work | Reopen the original Share and explicitly reconnect and delegate |
| Parent unavailable | This Share cannot currently be used | Request a valid Share from the Sender; do not claim a specific deletion cause |
| Answer returned | Selected original, Canon and confirmation control | Confirm the displayed original, then inspect once |

Retain answer non-persistence and structure-only INDETERMINATE when no semantic
provider runs. Do not present a new Chat launch or a tool call as successful review.

## Work that can proceed without ChatGPT UI

1. Refine expired/unavailable/waiting copy and action specifications against D-015.
2. Define local fixtures for two distinct v1 Shares, cancelled linking, expired
   authority and simultaneous windows; keep host simulation explicitly labeled.
3. Specify negative regressions: cross-connection/context misuse, replay, stale
   nonce, forged receipt, revoked parent, late responses and silent inheritance.
4. Review exact product diffs before authorizing implementation. The existing
   T-035 tests are baseline evidence; no new test execution is claimed here.

## Still requires actual-host observation or a decision

- A deterministic, supported way to start fresh linking for a connected ChatGPT
  plugin. Opening its detail page alone is not a verified trigger.
- The visible connection/account selection behavior with two anonymous connections.
- Adding a new Share to an existing connection is not an implemented browser
  authorization endpoint. Its binding and threat model need explicit review;
  do not infer this capability from the existing disconnect cookie.
- A recovery link must not contain a bearer, answer, token or an invented OAuth
  request. Unknown/revoked context references must not become an authorization
  oracle or automatically initiate broad access.

## Gates

The owner authorized committing, pushing and merging these review artifacts after
approving the local prototype. Product integration and deployment are separate
scopes; the prototype must not serve simulated results as real ones. Fresh live access
grants require the applicable action-time confirmation. Real data and paid semantic
calls remain outside this work.

## Local UI verification — 2026-10-23

`check-receiver-recovery-preview.mjs` passed under Node 22.23.3 with the installed
Playwright Chromium (PLAYWRIGHT_BROWSERS_PATH set to the host installation).
Observed explicit Share selection, no enabled inspection before original
confirmation, confirmation reset for another answer, and expiry returning to an
unchecked initial approval. All eight states fit both 1280px and 390px viewports
without horizontal overflow; no script errors, HTTP requests or storage entries
were observed. A checkbox click handler initially cancelled its default action;
the handler was corrected and the complete smoke check passed.

Desktop original-review and mobile expiry screenshots were visually inspected:
`dist/receiver-recovery-preview/desktop-review.png` and `mobile-expired.png`.
These results verify prototype interaction/layout only. Actual connection and
review outcomes are explicitly simulated, including the INDETERMINATE result.

# T-035 integration preparation — 2026-10-23

The owner explicitly requested merge/application of the local recovery UI work.
PR #62 initially contained only the isolated prototype, returning-flow tests and
Work records at 9935739dfab4bd1e5e04986dacaa3ff22b2d7678.

CI 39926919617 passed verify, postgres and e2e, but dependency-audit failed on the
existing Next.js 15.5.26 dependency. The production audit reported one critical
issue. GitHub advisory GHSA-2464-fhr4-w9xw lists Next.js 15.5.28 and sharp >=0.35.5
as fixed versions; GHSA-p3m5-59mp-jv5r also requires the Next.js patch for affected
App Router applications. This does not establish exploitation of this deployment.

The minimal maintenance fix raises the declared Next.js floor to ^15.5.28 and
locks Next.js/@next/env/SWC to 15.5.28, with sharp 0.35.5 and its platform packages.
This is routine remediation of a required integration gate under the owner's
development delegation. No force audit fix, major Next.js upgrade, CI exemption,
branch protection change or authorization-policy change is used.

Local production audit after the patch exits 0 at the configured critical
threshold. It still reports 1 moderate and 2 high findings (including nested
PostCSS/source-map-js dependencies); this is not a claim of a clean full audit.
Development dependencies have separate audit findings outside that production gate.

Internal adversarial review: the prototype is under Work, never imported by an
application route, and forbids connections through CSP. Its fabricated outcomes
are visibly labeled. The dependency patch changes framework/image processing
packages but no access checks, secrets, scopes or lifecycle code. Full required
hosted CI must run on the patched PR head before merge. Existing authorized main
release automation may build the patched web application; it must pass its normal
readiness/promotion gate. The scoped MCP deployment is independently managed.

Deferred: actual returning-host linking/account selection and grant-expiry replay
await owner browser setup. See t035-browser-resume.md. The recovery HTML remains
a review artifact, not a claim that the live Receiver recovery gaps are fixed.

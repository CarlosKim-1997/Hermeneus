# T-040 — Human-centered UI, research and local verification

## Artifact

2026-10-27. Worktree `codex/mcp-receiver-recovery-ui`, base HEAD
`4f1088680dd0d46004099daa7378db5d6a0d945a`.
This is an uncommitted local UI episode on top of the existing T-036–T-039 work.
The primary checkout was not used for application edits. UI source hashes are
recorded in `dist/t040-ui/artifact-hashes.json` in the active worktree.
No push, integration, deployment, production DB operation or paid model call
was performed. No Canon or pending connection-lifetime policy was changed.

## Research and decisions

“AI smell” is subjective; this task treats it as repetitive slogans, redundant
eyebrows, decorative arrows, nested tinted cards, tiny helper text and internal
protocol vocabulary on ordinary work screens. The aim is a usable working tool,
not to obscure actual AI processing. This is design judgment, not user-study
evidence or a measured conversion improvement.

Public reference material was read. Authenticated use of the reference products
was not performed; no third-party assets or branding were imported.

| Reference | Useful principle | Hermeneus application |
| --- | --- | --- |
| [Linear: UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui) | Reduce visual noise and establish hierarchy | Slim page headings, quiet navigation, one restrained action color, fewer decorative surfaces |
| [Basecamp: Message Board](https://5.basecamp-help.com/article/1075-message-board) | Let the document and its relevant actions lead | Published statements precede the supplementary explanation routes; review becomes a document editor |
| [GOV.UK: Button](https://design-system.service.gov.uk/components/button/) | State the action clearly | Direct titles and buttons; avoid promotional language inside work screens |
| [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Defer secondary details | Keep IDs, hashes and technical reference material in expandable sections; keep consent and verification limits visible |

Rejected: flashy AI animations, gradients, decorative icon containers, artificial
chat bubbles and claims of intelligent understanding. External AI disclosure,
the unavailable semantic-verification notice and irreversible deletion warnings
remain visible when the decision is made.

## Changes

- Creator workspace: removed repeated slogans and sidebar marketing copy; kept
  current navigation and login state. Library emphasizes actual records and
  actions, with one empty-state creation action. An unnamed private record gets
  a readable fallback; its real ID remains in management details and search.
- Creation: practical headings, compact numbered tasks, no enclosing decorative
  cards; retained prompt copy/manual fallback, JSON preview, optional private
  title and review-note confirmation. Prompt content itself was not changed.
- Review: plain empty state and save status; classification and priority share
  a row where space permits. At narrow widths they stack. Published statements,
  source references and actual form actions are unchanged.
- Sharing/receiver: document content and explanation actions align at the top.
  Removed repeated introductory banners. The own-AI route and limited on-site
  questions remain distinct. Hash details are expandable. The disabled meaning
  verifier is described before answer entry without implying successful review.
- Login, account and failure states: direct headings, restrained surfaces,
  readable labels; permanent deletion warnings and exact DELETE gate remain.
- MCP connection/answer widget: same visual treatment and plain Korean in place
  of RECEIVER, Published Canon and implementation-heavy phrasing. The digest is
  available with the reference document. Consent, access durations, token
  exchange, host calls, expiry and exact-text matching are unchanged by T-040.
- Preview mirrors the changed production components. It remains explicitly
  synthetic; buttons simulate storage/sharing/deletion without external calls.

## Review and corrections

Codex reviewed the local diff and rendered screens. This is internal review,
not independent third-party assurance. The React and verification checklists
were applied: no new effects, fetches, dependencies or server-side access paths;
controlled fields, labels, keyboard focus and state invalidation retained.

1. Screenshot review found an older, more-specific CSS rule placing the shared
   document below its side actions. Removed that obsolete rule and added a
   geometry assertion for desktop alignment and mobile reading order.
2. Two application tests still looked for removed promotional/404 headings.
   Updated only those visible labels; ownership-denial and non-persistence
   assertions remain intact. The unnamed-record test now checks both its
   readable heading and the actual expandable management ID.
3. Checked that removing repeated banners did not remove per-send consent,
   unavailable-verifier disclosure, exact published text or deletion scope.
4. The T-039 reusable-connection prototype remains a pending proposal; its
   unapproved security lifetimes were not adopted as part of this visual work.

## Verification

- `playwright.ux.config.ts`: **14 PASS**, including 15 screen/state routes at
  390/820/1280px, keyboard navigation, copy failure, non-persistent notes, private
  title, consent reset, stale results, failures and deletion gates. Final
  screenshot/layout assertions passed after the CSS correction.
- `playwright.mcp-local.config.ts`: **21 PASS**; local synthetic SDK/host fixtures,
  explicit approval, separate shares, expiry, revocation, exact text, stale
  results and narrow/wide widget frames. No real ChatGPT host was controlled.
- `vitest run tests/mcp`: **99 PASS**. An initial command selected the DB-only
  config and correctly failed before execution without a disposable database;
  corrected to the ordinary unit/HTTP configuration. No DB was accessed by that
  failed invocation.
- Web TypeScript and `tsconfig.mcp-local.json`: **PASS**.
- Application E2E initial run: **12 PASS, 2 outdated-title failures, 1 SKIP**.
  Focused correction run: **3 PASS** (bootstrap, creator flow, ownership IDOR),
  giving **14 unique application scenarios passed** across both runs.
  Readiness is the pre-existing localhost-only
  destructive schema-history probe; it skips the isolated Docker DB hostname.
- Governance and final whitespace check: **PASS** after adding the required
  task headings and removing whitespace left by deleted decoration.

Application logs: `dist/t040-application.log`,
`dist/t040-application-recheck.log`. The test runner uses a disposable Postgres
container, an internal network and a source-only snapshot; containers/networks
are removed by its finally block. It does not load the target deployment's DB
credentials or contact an external model.

## Preview and evidence

Local synthetic preview: `http://127.0.0.1:3412/new`; use the preview navigation
to view the library, review, publication, receiver, account and failure states.
The app-panel open request was queued, so actual display in the user's panel is
not claimed. The server is available while its local process remains running.

Before: `dist/t040-before-new.png`, `dist/t040-before-shared.png`.
After: `dist/t040-ui/` (9 screen/state routes at 390 and 1280px), plus
`test-results/ux/` (new/shared/library at all three tested widths).
No live deployment, real ChatGPT roundtrip, real user study or hosted CI result
is claimed by this local verification.

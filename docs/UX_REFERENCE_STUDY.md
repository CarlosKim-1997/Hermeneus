# Hermeneus UI reference study

2026-10-20 · T-030 · Local design experiment, not Project Canon

## Investigation and limits

Question: how can a Sender prepare an intentional handoff with little procedural overhead, and a Receiver read the approved meaning before asking their own AI?

Inspected official public product/help pages in a browser and read their documentation. Linear, Notion and Typeform provide product screenshots/examples on those pages. Loom's chapter behavior was documented; an authenticated Loom player was **not** exercised. No account onboarding, participant study, conversion measurement or actual Chat roundtrip occurred. Public screens and vendor descriptions are design references, not evidence that a pattern improves Hermeneus usability. Observation screenshots are in ignored `dist/t030-references/`.

## References → adaptations

| Reference and observed/documented pattern | Hermeneus adaptation | What we deliberately leave out |
| --- | --- | --- |
| [Linear Projects](https://linear.app/docs/projects): project overview with properties/resources, multiple project views and a details sidebar. Official product screenshot visually inspected. | Stable workspace sidebar; a compact library list with status, draft revision, pinned publication version and local search/status filters. Primary actions stay attached to each record. | Team/assignee/health dashboards; status must not imply an active share or successful verification. |
| [Notion headings and contents](https://www.notion.com/help/columns-headings-and-dividers): heading-derived navigation and a document outline. Official example and help-page navigation visually inspected. | Published document with a generated **index**, exact existing classifications and literal excerpts; keyboard-accessible anchors to every item. Full statements remain visible and in snapshot order. | Rewriting or auto-summarizing Canon, arbitrary recipient titles, live collaborative changes to a published version. |
| [Typeform Welcome Screen](https://help.typeform.com/hc/en-us/articles/360052366812-Welcome-Screen): a short purpose statement, description and clear start action in the editor example. Official product screenshot visually inspected. | Creation starts with a purpose, then two numbered work areas: get the prompt for my existing AI; bring back JSON and preview it. Less-used source import stays secondary. | Extra welcome click/wizard gate, one field per full screen, timed completion claims, respondent tracking or URL-carried personal fields. |
| [Loom summaries and chapters](https://support.atlassian.com/loom/docs/add-a-summary-and-chapters-to-your-video/): documented chapter jumps support selective asynchronous viewing. | Receiver reads the fixed document beside a follow-up rail: use my AI, jump to selected-answer checking, or use the optional on-site question path. Transfer and verification are separate work areas. | Generated summary as authority, mandatory video, comments, view receipts or new answer persistence. The sidebar arrangement is our design hypothesis, not an observed Loom replica. |

Sources accessed 2026-10-20. No vendor logo, illustration, screenshot or proprietary text is shipped in the product. Icons are small local SVG paths. System fonts avoid a new asset/provider dependency.

## Design direction

**Workspace + readable handoff.** Indigo controls and restrained neutral surfaces separate actions from content; amber distinguishes unresolved/disabled states. Desktop navigation is a compact sidebar. Mobile keeps the same destinations in a horizontal navigation area. Reading uses a document, not a collection of editable cards. Creation uses numbered work areas with the next action near the relevant input. Sharing controls remain distinct from immutable published text.

The library's filters mean `no published version` and `at least one published version`; they do not say that a published record has no later draft or that a share is active. Search runs only on the already-authorized library summaries in browser memory. It adds no API request, URL parameter, browser storage or analytics.

The document index is derived solely from the supplied snapshot. It does not infer a request, produce a new summary, prioritize selected claims or hide the rest. The snapshot's original order, identity, type, priority and statement are untouched. Titles remain opt-in private library metadata. Both owner and share readers use the same presentation component.

The current share page still uses packet copying. Its rail states that ordinary ChatGPT automatic connection is not integrated there. The separately authorized synthetic MCP/widget prototype remains separate, and is still the intended usability direction; this redesign does not ratify copying as the final experience.

## Self-review and future human test

Before calling this better, observe at least these tasks with synthetic content:

1. Find an unfinished handoff among both draft-only and published records; recover from a no-match filter/search.
2. Get the Sender prompt, return JSON, identify temporary review notes, create a draft and publish intentionally.
3. As Receiver, find an unresolved condition by the outline without mistaking it for a confirmed request.
4. Distinguish reading the original, explaining with personal AI and checking one answer; recognize provider-off mode and the scope of a verdict.
5. Find link revocation and distinguish it from deleting content or an external AI copy.

Record task completion, wrong-route starts, ability to explain the current version/uncertainty, and points where help is needed. Do not collect answer bodies or recordings by default. Small participant tests are qualitative; no conversion or efficiency improvement is claimed. The owner's actual use/Chat tests remain paused until they resume them.

Implementation and verification evidence: `work/reports/t030-reference-led-ui.md`.

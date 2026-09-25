# state/v1

Exactly one authoritative file under `canon/state/`, selected by `manifest.current_state`. Required frontmatter: `schema: state/v1`, `status`, nonempty `areas`; no ID or formal relations. Status: NOT_READY, READY, IN_PROGRESS, BLOCKED, VERIFYING, COMPLETE, CANCELLED. Required headings: Current Position, Active Work, Blockers, Material Risks, Verification Basis. This mutable file summarizes current position, not history or evidence. See [SPEC](../SPEC.md).

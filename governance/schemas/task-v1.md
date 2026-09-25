# task/v1

Work path: `work/tasks/*.md`. Required frontmatter: `schema: task/v1`, `id: T-<digits>`, `status`, nonempty `areas`. Status: NOT_READY, READY, IN_PROGRESS, BLOCKED, VERIFYING, COMPLETE, CANCELLED. Required headings: Objective, Scope, Authority, Constraints, Verification, Stop Conditions, Completion Criteria. Allowed list relations: `depends_on`, `blocked_by`, `implements`, `related_to`; see [SPEC](../SPEC.md) for targets. A Task consumes existing authority and never creates it. COMPLETE and CANCELLED close an episode.

# open-question/v1

Canonical path: `canon/open-questions/*.md`. Required frontmatter: `schema: open-question/v1`, `id: OQ-<digits>`, `status`, nonempty `areas`. Status: OPEN, BLOCKING, RESOLVED, DROPPED. Required headings: Question, Why It Matters. Allowed list relations: `depends_on`, `related_to`. `resolved_by` is one scalar Decision ID, required for RESOLVED, forbidden for OPEN and BLOCKING, optional for DROPPED. `E-*` is unsupported. Terminal questions remain terminal; new uncertainty gets a new ID. See [SPEC](../SPEC.md).

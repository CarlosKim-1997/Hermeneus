---
schema: constraint/v1
id: C-005
kind: HARD_CONSTRAINT
status: ACTIVE
areas:
  - handoff
overridable: false
implements:
  - D-005
related_to:
  - C-001
---
# Share capability token security and integrity

## Constraint

Share bearer secrets must be high-entropy opaque values generated outside PostgreSQL. Only a cryptographic hash of the raw token may be persisted.

Raw bearer tokens must not be deliberately written to Hermeneus application-controlled logs, error messages, persisted capability metadata, or durable application records outside the one-time issuance response. Infrastructure or access logging of URL paths is not yet guaranteed to redact share tokens and remains a production-hardening requirement.

After creation, capability target fields and token hash are immutable. Only `revoked_at` may transition from null to a timestamp, and revocation is idempotent.

## Rationale

Bearer tokens are credentials. Persisting reversible secrets or leaking them through application observability would undermine revocation and confidentiality goals.

## Operational Effect

- Issuance returns the raw token once; loss requires creating a new capability.
- Invalid and revoked tokens are indistinguishable to Receivers on the share surface.
- Share tokens must not enter M6/M7 model payloads.
- Deployment-level log redaction and access-log policy for share URLs remain deferred hardening work.

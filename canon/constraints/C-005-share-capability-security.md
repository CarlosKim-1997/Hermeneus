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

Share bearer secrets must be high-entropy opaque values generated outside PostgreSQL. Only a cryptographic hash of the raw token may be persisted. Raw tokens must not appear in logs, error messages, or capability metadata returned to clients after issuance.

After creation, capability target fields and token hash are immutable. Only `revoked_at` may transition from null to a timestamp, and revocation is idempotent.

## Rationale

Bearer tokens are credentials. Persisting reversible secrets or leaking them through observability would undermine revocation and confidentiality goals.

## Operational Effect

- Issuance returns the raw token once; loss requires creating a new capability.
- Invalid and revoked tokens are indistinguishable to Receivers on the share surface.
- Share tokens must not enter M6/M7 model payloads.

export class PersistenceConflictError extends Error {
  readonly code = "PERSISTENCE_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "PersistenceConflictError";
  }
}

export class ProvenanceValidationError extends Error {
  readonly code = "PROVENANCE_VALIDATION";

  constructor(message: string) {
    super(message);
    this.name = "ProvenanceValidationError";
  }
}

/** Retained-state provenance rows that reference missing or impossible source data. Does not detect arbitrary direct-SQL provenance deletion without an expected row count. */
export class ProvenanceIntegrityError extends Error {
  readonly code = "PROVENANCE_INTEGRITY";

  constructor(message: string) {
    super(message);
    this.name = "ProvenanceIntegrityError";
  }
}

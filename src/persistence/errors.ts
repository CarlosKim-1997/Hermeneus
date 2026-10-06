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

export class SourceUnavailableError extends Error {
  readonly code = "SOURCE_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "SourceUnavailableError";
  }
}

export class SourceBackedDraftRejectedError extends Error {
  readonly code = "SOURCE_BACKED_DRAFT_REJECTED";

  constructor(message: string) {
    super(message);
    this.name = "SourceBackedDraftRejectedError";
  }
}

export class HandoffLifecycleUnavailableError extends Error {
  readonly code = "HANDOFF_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "HandoffLifecycleUnavailableError";
  }
}

export class CreatorLifecycleUnavailableError extends Error {
  readonly code = "CREATOR_LIFECYCLE_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "CreatorLifecycleUnavailableError";
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

export class PersistenceConflictError extends Error {
  readonly code = "PERSISTENCE_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "PersistenceConflictError";
  }
}

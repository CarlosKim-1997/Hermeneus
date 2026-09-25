import { PersistenceConflictError, ProvenanceValidationError } from "../persistence/errors.js";

export type CreatorFacingError = {
  code: "CONFLICT" | "PROVENANCE" | "UNKNOWN";
  message: string;
};

export function toCreatorFacingError(error: unknown): CreatorFacingError {
  if (error instanceof PersistenceConflictError) {
    return {
      code: "CONFLICT",
      message: error.message.includes("revision")
        ? "This draft changed elsewhere. Reload and try again."
        : error.message,
    };
  }
  if (error instanceof ProvenanceValidationError) {
    return {
      code: "PROVENANCE",
      message: error.message,
    };
  }
  return {
    code: "UNKNOWN",
    message: "Something went wrong while saving or publishing. Try again.",
  };
}

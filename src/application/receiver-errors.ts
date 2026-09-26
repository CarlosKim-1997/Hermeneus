export class ReceiverIntegrityError extends Error {
  readonly code = "RECEIVER_INTEGRITY" as const;

  constructor(message: string) {
    super(message);
    this.name = "ReceiverIntegrityError";
  }
}

export type ReceiverFacingError = {
  code: "NOT_FOUND" | "RECEIVER_INTEGRITY" | "INVALID_INPUT" | "UNKNOWN";
  message: string;
};

export function toReceiverFacingError(error: unknown): ReceiverFacingError {
  if (error instanceof ReceiverIntegrityError) {
    return {
      code: "RECEIVER_INTEGRITY",
      message: "This answer could not be shown safely. Try another question or reload the Handoff.",
    };
  }
  return {
    code: "UNKNOWN",
    message: "Something went wrong while answering. Try again.",
  };
}

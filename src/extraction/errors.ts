export type ExtractionErrorCode =
  | "MODEL_NOT_CONFIGURED"
  | "MODEL_PROVIDER_ERROR"
  | "MODEL_REFUSAL"
  | "MODEL_OUTPUT_INVALID"
  | "PROVENANCE_INVALID";

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
  }
}

export type ReceiverSemanticErrorCode = "MODEL_REFUSAL" | "MODEL_OUTPUT_INVALID" | "MODEL_PROVIDER_ERROR";

export class ReceiverSemanticError extends Error {
  readonly code: ReceiverSemanticErrorCode;

  constructor(code: ReceiverSemanticErrorCode, message: string) {
    super(message);
    this.name = "ReceiverSemanticError";
    this.code = code;
  }
}

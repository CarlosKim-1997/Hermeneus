export type ReceiverAnswerLayerErrorCode = "MODEL_REFUSAL" | "MODEL_OUTPUT_INVALID" | "MODEL_PROVIDER_ERROR";

export class ReceiverAnswerLayerError extends Error {
  readonly code: ReceiverAnswerLayerErrorCode;

  constructor(code: ReceiverAnswerLayerErrorCode, message: string) {
    super(message);
    this.name = "ReceiverAnswerLayerError";
    this.code = code;
  }
}

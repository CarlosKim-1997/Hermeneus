import { ExtractionError } from "../extraction/errors.js";
import { SourceUnavailableError } from "../persistence/errors.js";

export type ExtractionFacingError = {
  code: ExtractionError["code"];
  message: string;
};

export function toExtractionFacingError(error: unknown): ExtractionFacingError {
  if (error instanceof SourceUnavailableError) {
    return {
      code: "MODEL_OUTPUT_INVALID",
      message: error.message,
    };
  }
  if (error instanceof ExtractionError) {
    return {
      code: error.code,
      message: creatorMessageForCode(error),
    };
  }
  return {
    code: "MODEL_PROVIDER_ERROR",
    message: "Extraction failed. Try again or continue editing manually.",
  };
}

function creatorMessageForCode(error: ExtractionError): string {
  switch (error.code) {
    case "MODEL_NOT_CONFIGURED":
      return "AI extraction is not configured on this server. Set OPENAI_API_KEY and OPENAI_MODEL, or continue manually.";
    case "MODEL_REFUSAL":
      return "The AI provider declined to extract from this conversation. Continue manually.";
    case "PROVENANCE_INVALID":
    case "MODEL_OUTPUT_INVALID":
      return "AI suggestions failed validation and were not shown. Nothing was saved to your draft.";
    case "MODEL_PROVIDER_ERROR":
      return "The AI provider returned an error. Nothing was saved to your draft.";
    default:
      return error.message;
  }
}

import type { ParsedResponse } from "openai/resources/responses/responses";
import { ExtractionError } from "../../extraction/errors.js";
import { modelExtractionOutputSchema } from "../../extraction/proposal-schema.js";
import type { ExtractionProposal } from "../../extraction/proposal-schema.js";

export function assertNoModelRefusal(response: ParsedResponse<unknown>): void {
  for (const output of response.output) {
    if (output.type !== "message") continue;
    for (const content of output.content) {
      if (content.type === "refusal") {
        throw new ExtractionError("MODEL_REFUSAL", "The model refused the extraction request.");
      }
    }
  }
}

export function parseStructuredExtractionResponse(response: ParsedResponse<unknown>): ExtractionProposal {
  assertNoModelRefusal(response);

  if (response.status === "incomplete") {
    throw new ExtractionError("MODEL_OUTPUT_INVALID", "Model response was incomplete.");
  }

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new ExtractionError("MODEL_OUTPUT_INVALID", "Model returned no structured extraction output.");
  }

  const result = modelExtractionOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExtractionError(
      "MODEL_OUTPUT_INVALID",
      "Model structured output did not satisfy the Hermeneus extraction schema.",
    );
  }
  return result.data;
}

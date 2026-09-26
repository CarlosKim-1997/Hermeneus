import type { ParsedResponse } from "openai/resources/responses/responses";
import { ReceiverSemanticError } from "../../receiver/semantic/errors.js";
import { receiverInterpretationProposalSchema } from "../../receiver/semantic/proposal-schema.js";
import type { ReceiverInterpretationProposal } from "../../receiver/semantic/proposal-schema.js";

export function assertNoReceiverModelRefusal(response: ParsedResponse<unknown>): void {
  for (const output of response.output) {
    if (output.type !== "message") continue;
    for (const content of output.content) {
      if (content.type === "refusal") {
        throw new ReceiverSemanticError("MODEL_REFUSAL", "The model refused the Receiver interpretation request.");
      }
    }
  }
}

export function parseStructuredReceiverSemanticResponse(
  response: ParsedResponse<unknown>,
): ReceiverInterpretationProposal {
  assertNoReceiverModelRefusal(response);

  if (response.status === "incomplete") {
    throw new ReceiverSemanticError("MODEL_OUTPUT_INVALID", "Model response was incomplete.");
  }

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new ReceiverSemanticError("MODEL_OUTPUT_INVALID", "Model returned no structured Receiver output.");
  }

  const result = receiverInterpretationProposalSchema.safeParse(parsed);
  if (!result.success) {
    throw new ReceiverSemanticError(
      "MODEL_OUTPUT_INVALID",
      "Model structured output did not satisfy the Hermeneus Receiver schema.",
    );
  }
  return result.data;
}

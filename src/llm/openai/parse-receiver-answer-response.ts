import type { ParsedResponse } from "openai/resources/responses/responses";
import { ReceiverAnswerLayerError } from "../../receiver/answer/errors.js";
import {
  generatedAnswerProposalSchema,
  groundingVerificationSchema,
  type GeneratedAnswerProposal,
  type GroundingVerification,
} from "../../receiver/answer/proposal-schema.js";

function assertNoRefusal(response: ParsedResponse<unknown>, context: string): void {
  for (const output of response.output) {
    if (output.type !== "message") continue;
    for (const content of output.content) {
      if (content.type === "refusal") {
        throw new ReceiverAnswerLayerError("MODEL_REFUSAL", `The model refused the Receiver ${context} request.`);
      }
    }
  }
}

export function parseGeneratedAnswerResponse(response: ParsedResponse<unknown>): GeneratedAnswerProposal {
  assertNoRefusal(response, "answer generation");
  if (response.status === "incomplete") {
    throw new ReceiverAnswerLayerError("MODEL_OUTPUT_INVALID", "Generator response was incomplete.");
  }
  const parsed = response.output_parsed;
  if (!parsed) {
    throw new ReceiverAnswerLayerError("MODEL_OUTPUT_INVALID", "Generator returned no structured output.");
  }
  const result = generatedAnswerProposalSchema.safeParse(parsed);
  if (!result.success) {
    throw new ReceiverAnswerLayerError("MODEL_OUTPUT_INVALID", "Generator structured output failed schema validation.");
  }
  return result.data;
}

export function parseGroundingVerificationResponse(response: ParsedResponse<unknown>): GroundingVerification {
  assertNoRefusal(response, "grounding verification");
  if (response.status === "incomplete") {
    throw new ReceiverAnswerLayerError("MODEL_OUTPUT_INVALID", "Verifier response was incomplete.");
  }
  const parsed = response.output_parsed;
  if (!parsed) {
    throw new ReceiverAnswerLayerError("MODEL_OUTPUT_INVALID", "Verifier returned no structured output.");
  }
  const result = groundingVerificationSchema.safeParse(parsed);
  if (!result.success) {
    throw new ReceiverAnswerLayerError("MODEL_OUTPUT_INVALID", "Verifier structured output failed schema validation.");
  }
  return result.data;
}

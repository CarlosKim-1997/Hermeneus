import { zodTextFormat } from "openai/helpers/zod";
import type OpenAI from "openai";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { createOpenAiClient } from "../../llm/openai/client.js";
import type { OpenAiExtractionConfig } from "../../llm/openai/config.js";
import { parseGroundingVerificationResponse } from "../../llm/openai/parse-receiver-answer-response.js";
import { ReceiverAnswerLayerError } from "./errors.js";
import { buildVerifierPayload } from "./payload.js";
import { groundingVerificationSchema } from "./proposal-schema.js";
import type { ReceiverGroundingVerifier } from "./verifier.js";
import { RECEIVER_GROUNDING_VERIFIER_PROMPT } from "./verifier-prompt.js";

export type OpenAiResponsesClient = {
  responses: {
    parse: (
      body: Parameters<OpenAI["responses"]["parse"]>[0],
      options?: Parameters<OpenAI["responses"]["parse"]>[1],
    ) => PromiseLike<ParsedResponse<unknown>>;
  };
};

export function createOpenAiReceiverGroundingVerifier(
  config: OpenAiExtractionConfig,
  options?: { client?: OpenAiResponsesClient },
): ReceiverGroundingVerifier {
  const client = options?.client ?? createOpenAiClient(config);
  return {
    async verify({ question, selectedItems, proposal }) {
      const payload = buildVerifierPayload(question, selectedItems, proposal);
      try {
        const response = await client.responses.parse({
          model: config.model,
          store: false,
          input: [
            { role: "system", content: RECEIVER_GROUNDING_VERIFIER_PROMPT },
            {
              role: "user",
              content: [
                { type: "input_text", text: "Verify grounding for these proposed sentences against the canonical items JSON." },
                { type: "input_text", text: JSON.stringify(payload) },
              ],
            },
          ],
          text: { format: zodTextFormat(groundingVerificationSchema, "receiver_grounding_verification") },
        });
        return parseGroundingVerificationResponse(response);
      } catch (error) {
        if (error instanceof ReceiverAnswerLayerError) throw error;
        throw new ReceiverAnswerLayerError(
          "MODEL_PROVIDER_ERROR",
          error instanceof Error ? error.message : "Verifier provider request failed.",
        );
      }
    },
  };
}

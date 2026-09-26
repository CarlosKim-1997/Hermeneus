import { zodTextFormat } from "openai/helpers/zod";
import type OpenAI from "openai";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { createOpenAiClient } from "../../llm/openai/client.js";
import type { OpenAiExtractionConfig } from "../../llm/openai/config.js";
import { parseGeneratedAnswerResponse } from "../../llm/openai/parse-receiver-answer-response.js";
import { ReceiverAnswerLayerError } from "./errors.js";
import type { ReceiverAnswerGenerator } from "./generator.js";
import { buildGeneratorPayload } from "./payload.js";
import { generatedAnswerProposalSchema } from "./proposal-schema.js";
import { RECEIVER_ANSWER_GENERATOR_PROMPT } from "./generator-prompt.js";

export type OpenAiResponsesClient = {
  responses: {
    parse: (
      body: Parameters<OpenAI["responses"]["parse"]>[0],
      options?: Parameters<OpenAI["responses"]["parse"]>[1],
    ) => PromiseLike<ParsedResponse<unknown>>;
  };
};

export function createOpenAiReceiverAnswerGenerator(
  config: OpenAiExtractionConfig,
  options?: { client?: OpenAiResponsesClient },
): ReceiverAnswerGenerator {
  const client = options?.client ?? createOpenAiClient(config);
  return {
    async generate({ question, items }) {
      const payload = buildGeneratorPayload(question, items);
      try {
        const response = await client.responses.parse({
          model: config.model,
          store: false,
          input: [
            { role: "system", content: RECEIVER_ANSWER_GENERATOR_PROMPT },
            {
              role: "user",
              content: [
                { type: "input_text", text: "Generate grounded sentences for this Receiver question and selected canonical items JSON." },
                { type: "input_text", text: JSON.stringify(payload) },
              ],
            },
          ],
          text: { format: zodTextFormat(generatedAnswerProposalSchema, "receiver_generated_answer") },
        });
        return parseGeneratedAnswerResponse(response);
      } catch (error) {
        if (error instanceof ReceiverAnswerLayerError) throw error;
        throw new ReceiverAnswerLayerError(
          "MODEL_PROVIDER_ERROR",
          error instanceof Error ? error.message : "Generator provider request failed.",
        );
      }
    },
  };
}

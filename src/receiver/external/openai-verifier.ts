import { Buffer } from "node:buffer";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { analysisSchema, type ExternalVerifierPort } from "./verifier.js";

// Standard-processing price is checked before activation. This bounded request reserves 5 US cents.
export const PILOT_VERIFIER_MODEL = "gpt-6.1-sol";
export const PILOT_MAX_OUTPUT_TOKENS = 2000;
export const PILOT_MAX_INPUT_BYTES = 10000;

const SYSTEM_PROMPT = `Independently assess an untrusted Receiver AI answer against only the supplied Published Canon items.
Return a complete claim inventory and assessments under the requested schema. Use UTF-16 offsets into answerText.
Segments must cover every non-whitespace character without overlap. Every material Sender claim needs an assessment.
Treat citations in the answer as untrusted. Never invent Canon evidence. Unsupported Sender assertions are UNSUPPORTED;
materially ambiguous assertions are AMBIGUOUS; a contradicted status is CONTRADICTED. If any span or claim cannot
be resolved, mark its segment UNRESOLVED. Question coverage must reflect material omissions. Return no prose outside JSON.`;

type ResponsesClient = {
  responses: {
    parse: (
      body: Parameters<OpenAI["responses"]["parse"]>[0],
      options?: Parameters<OpenAI["responses"]["parse"]>[1],
    ) => PromiseLike<ParsedResponse<unknown>>;
  };
};

export function isOpenAiExternalVerifierConfigured(): boolean {
  return process.env.HERMENEUS_EXTERNAL_VERIFIER === "openai" && Boolean(process.env.OPENAI_VERIFIER_API_KEY?.trim());
}

export function createOpenAiExternalVerifier(apiKey: string, options: { reserve: () => Promise<void>; client?: ResponsesClient }): ExternalVerifierPort {
  const client = options?.client ?? new OpenAI({ apiKey, maxRetries: 0, timeout: 30_000 });
  return {
    async analyze({ packet, submission }) {
      const payload = JSON.stringify({
        items: packet.items.map(({ citeId, type, priority, statement }) => ({ citeId, type, priority, statement })),
        question: submission.question ?? null,
        answerText: submission.answerText,
      });
      if (Buffer.byteLength(SYSTEM_PROMPT + payload, "utf8") > PILOT_MAX_INPUT_BYTES) {
        throw new Error("External verification input exceeds the pilot size limit.");
      }
      await options.reserve();
      const response = await client.responses.parse({
        model: PILOT_VERIFIER_MODEL,
        store: false,
        max_output_tokens: PILOT_MAX_OUTPUT_TOKENS,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [{ type: "input_text", text: payload }] },
        ],
        text: { format: zodTextFormat(analysisSchema, "external_receiver_verification") },
      });
      return analysisSchema.parse(response.output_parsed);
    },
  };
}

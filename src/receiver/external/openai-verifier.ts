import { Buffer } from "node:buffer";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { analysisSchema, type ExternalVerifierPort } from "./verifier.js";

// Standard-processing price is checked before activation. This bounded request reserves 5 US cents.
export const PILOT_VERIFIER_MODEL = "gpt-6.1-sol";
export const PILOT_MAX_OUTPUT_TOKENS = 2000;
export const PILOT_MAX_INPUT_BYTES = 10000;
export const COMPARISON_MODELS = ["gpt-6-luna", "gpt-6.1-sol"] as const;
export type ComparisonModel = typeof COMPARISON_MODELS[number];
export type VerifierUsage = { inputTokens: number; outputTokens: number; cachedTokens: number; serviceTier: string | null; model: string };

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

export function createOpenAiExternalVerifier(apiKey: string, options: {
  reserve: () => Promise<void>; client?: ResponsesClient;
  model?: ComparisonModel;
  observeUsage?: (usage: VerifierUsage) => void;
}): ExternalVerifierPort {
  const model = options.model ?? PILOT_VERIFIER_MODEL;
  if (!(COMPARISON_MODELS as readonly string[]).includes(model)) throw new Error("Unsupported verifier model.");
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
      const request = {
        model,
        service_tier: "default" as const,
        store: false,
        max_output_tokens: PILOT_MAX_OUTPUT_TOKENS,
        reasoning: { effort: "low" as const },
        input: [
          { role: "system" as const, content: SYSTEM_PROMPT },
          { role: "user" as const, content: [{ type: "input_text" as const, text: payload }] },
        ],
        text: { format: zodTextFormat(analysisSchema, "external_receiver_verification") },
      };
      // Conservative byte-based token bound, including schema and request framing.
      // Oct 15 Standard rates: worst input cache write $2.50/M; output $10/M.
      // This also bounds the cheaper Luna requests. No tools, Fast or retries.
      if (Buffer.byteLength(JSON.stringify(request), "utf8") * 2.5 / 1_000_000 +
          PILOT_MAX_OUTPUT_TOKENS * 10 / 1_000_000 > 0.05) {
        throw new Error("External verification request exceeds the pilot cost bound.");
      }
      await options.reserve();
      const response = await client.responses.parse(request);
      if (options.observeUsage) {
        const usage = response.usage;
        if (!usage || !Number.isSafeInteger(usage.input_tokens) || !Number.isSafeInteger(usage.output_tokens) ||
            usage.input_tokens < 0 || usage.output_tokens < 0 ||
            !Number.isSafeInteger(usage.input_tokens_details?.cached_tokens ?? 0) ||
            (usage.input_tokens_details?.cached_tokens ?? 0) < 0 ||
            (usage.input_tokens_details?.cached_tokens ?? 0) > usage.input_tokens) {
          throw new Error("Verifier usage is unavailable; stop comparison.");
        }
        options.observeUsage({ inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
          cachedTokens: usage.input_tokens_details?.cached_tokens ?? 0,
          serviceTier: response.service_tier ?? null, model: response.model });
      }
      return analysisSchema.parse(response.output_parsed);
    },
  };
}

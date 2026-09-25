import { createOpenAiHandoffExtractor } from "../extraction/model-backed-extractor.js";
import type { HandoffExtractor } from "../extraction/extractor.js";
import { e2eFixtureExtractor } from "../extraction/fixture-extractor.js";
import { ExtractionError } from "../extraction/errors.js";
import { readOpenAiExtractionConfig } from "../llm/openai/config.js";

let overrideExtractor: HandoffExtractor | undefined;

/** Test hook: inject a deterministic extractor without touching OpenAI. */
export function setHandoffExtractorForTests(extractor: HandoffExtractor | undefined) {
  overrideExtractor = extractor;
}

export function getHandoffExtractor(): HandoffExtractor {
  if (overrideExtractor) return overrideExtractor;

  if (process.env.HERMENEUS_EXTRACTION_FIXTURE === "e2e") {
    return e2eFixtureExtractor();
  }

  const openAi = readOpenAiExtractionConfig();
  if (openAi) {
    return createOpenAiHandoffExtractor(openAi);
  }

  throw new ExtractionError(
    "MODEL_NOT_CONFIGURED",
    "Live extraction is not configured. Set OPENAI_API_KEY and OPENAI_MODEL, or use the manual workflow.",
  );
}

export function isLiveExtractionConfigured(): boolean {
  return readOpenAiExtractionConfig() !== undefined || process.env.HERMENEUS_EXTRACTION_FIXTURE === "e2e";
}

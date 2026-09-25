import OpenAI from "openai";
import type { OpenAiExtractionConfig } from "./config.js";

export function createOpenAiClient(config: OpenAiExtractionConfig): OpenAI {
  return new OpenAI({ apiKey: config.apiKey });
}

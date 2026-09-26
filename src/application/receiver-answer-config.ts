import { readOpenAiExtractionConfig } from "../llm/openai/config.js";

export type ReceiverAnswerMode = "deterministic" | "openai-grounded";

export function readReceiverAnswerMode(): ReceiverAnswerMode {
  const raw = process.env.RECEIVER_ANSWER_MODE?.trim().toLowerCase();
  if (raw === "openai-grounded") return "openai-grounded";
  return "deterministic";
}

export function isGroundedReceiverAnswerConfigured(): boolean {
  return readReceiverAnswerMode() === "openai-grounded" && readOpenAiExtractionConfig() !== undefined;
}

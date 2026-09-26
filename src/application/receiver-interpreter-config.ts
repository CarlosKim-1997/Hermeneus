import { readOpenAiExtractionConfig } from "../llm/openai/config.js";

export type ReceiverInterpreterMode = "deterministic" | "openai";

export function readReceiverInterpreterMode(): ReceiverInterpreterMode {
  const raw = process.env.RECEIVER_INTERPRETER?.trim().toLowerCase();
  if (raw === "openai") return "openai";
  return "deterministic";
}

export function isReceiverSemanticModeRequested(): boolean {
  return readReceiverInterpreterMode() === "openai";
}

export function isReceiverSemanticModeConfigured(): boolean {
  return isReceiverSemanticModeRequested() && readOpenAiExtractionConfig() !== undefined;
}

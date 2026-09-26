import { readOpenAiExtractionConfig } from "../llm/openai/config.js";
import { createOpenAiReceiverAnswerGenerator } from "../receiver/answer/openai-answer-generator.js";
import { createOpenAiReceiverGroundingVerifier } from "../receiver/answer/openai-grounding-verifier.js";
import type { ReceiverAnswerGenerator } from "../receiver/answer/generator.js";
import type { ReceiverGroundingVerifier } from "../receiver/answer/verifier.js";
import { isGroundedReceiverAnswerConfigured, readReceiverAnswerMode } from "./receiver-answer-config.js";

let testGenerator: ReceiverAnswerGenerator | null | undefined;
let testVerifier: ReceiverGroundingVerifier | null | undefined;

export function setReceiverAnswerGeneratorForTests(generator: ReceiverAnswerGenerator | null | undefined) {
  testGenerator = generator;
}

export function setReceiverGroundingVerifierForTests(verifier: ReceiverGroundingVerifier | null | undefined) {
  testVerifier = verifier;
}

export function getReceiverAnswerGenerator(): ReceiverAnswerGenerator | null {
  if (testGenerator !== undefined) return testGenerator;
  if (readReceiverAnswerMode() !== "openai-grounded") return null;
  const config = readOpenAiExtractionConfig();
  if (!config) return null;
  return createOpenAiReceiverAnswerGenerator(config);
}

export function getReceiverGroundingVerifier(): ReceiverGroundingVerifier | null {
  if (testVerifier !== undefined) return testVerifier;
  if (readReceiverAnswerMode() !== "openai-grounded") return null;
  const config = readOpenAiExtractionConfig();
  if (!config) return null;
  return createOpenAiReceiverGroundingVerifier(config);
}

export function isGroundedAnswerModeActive(): boolean {
  return getReceiverAnswerGenerator() !== null && getReceiverGroundingVerifier() !== null;
}

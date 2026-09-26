import { readOpenAiExtractionConfig } from "../llm/openai/config.js";
import { createOpenAiReceiverSemanticInterpreter } from "../receiver/semantic/openai-semantic-interpreter.js";
import type { ReceiverSemanticInterpreter } from "../receiver/semantic/interpreter.js";
import { isReceiverSemanticModeRequested } from "./receiver-interpreter-config.js";

let testOverride: ReceiverSemanticInterpreter | null | undefined;

/** Test hook: `null` forces off; `undefined` resets to env-driven default. */
export function setReceiverSemanticInterpreterForTests(interpreter: ReceiverSemanticInterpreter | null | undefined) {
  testOverride = interpreter;
}

export function getReceiverSemanticInterpreter(): ReceiverSemanticInterpreter | null {
  if (testOverride !== undefined) {
    return testOverride;
  }

  if (!isReceiverSemanticModeRequested()) {
    return null;
  }

  const config = readOpenAiExtractionConfig();
  if (!config) {
    return null;
  }

  return createOpenAiReceiverSemanticInterpreter(config);
}

export function getActiveReceiverInterpreterMode(): "deterministic" | "semantic" {
  return getReceiverSemanticInterpreter() ? "semantic" : "deterministic";
}

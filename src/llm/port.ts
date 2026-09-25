/**
 * Narrow boundary for future model-backed operations.
 * Milestone 1 does not call a provider. Tests supply deterministic doubles.
 */
export interface TextModel {
  complete(input: { operation: ModelOperation; prompt: string }): Promise<string>;
}

export type ModelOperation =
  | "handoff-extraction"
  | "receiver-classification"
  | "receiver-answer"
  | "grounding-verification"
  | "understanding-check";

export function unavailableModel(): TextModel {
  return {
    async complete() {
      throw new Error("No live model is configured for milestone 1");
    },
  };
}

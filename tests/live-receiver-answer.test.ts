import { describe, expect, it } from "vitest";
import { applyGroundedNaturalAnswer } from "../src/application/grounded-receiver-answer.js";
import { interpretReceiverQuestion } from "../src/application/receiver-interpretation.js";
import { readOpenAiExtractionConfig } from "../src/llm/openai/config.js";
import { authorityFromReceiverView } from "../src/receiver/interpretation-authority.js";
import { createOpenAiReceiverAnswerGenerator } from "../src/receiver/answer/openai-answer-generator.js";
import { createOpenAiReceiverGroundingVerifier } from "../src/receiver/answer/openai-grounding-verifier.js";
import { createOpenAiReceiverSemanticInterpreter } from "../src/receiver/semantic/openai-semantic-interpreter.js";

const configured = readOpenAiExtractionConfig();

if (!configured) {
  describe.skip("live Receiver grounded answer smoke", () => {});
} else {
  describe("live Receiver grounded answer smoke", () => {
    it("M6 selection plus M7 generator/verifier yields generated-grounded answer", async () => {
      const items = [
        {
          id: "web-mvp",
          type: "CONFIRMED" as const,
          statement: "The MVP will launch as a browser-based product first.",
          priority: "CORE" as const,
        },
      ];
      const authority = authorityFromReceiverView({
        handoffId: "live-answer",
        version: 1,
        publishedAt: "2026-09-26T00:00:00.000Z",
        items,
      });
      const semantic = createOpenAiReceiverSemanticInterpreter(configured);
      const interpretation = await interpretReceiverQuestion(
        "Where are we launching first?",
        authority,
        semantic,
      );
      expect(interpretation.classification).toBe("SUPPORTED");

      const outcome = await applyGroundedNaturalAnswer({
        question: "Where are we launching first?",
        interpretation,
        selectedItems: items.filter((item) => interpretation.citations.includes(item.id)),
        deterministicAnswer: interpretation.answer,
        generator: createOpenAiReceiverAnswerGenerator(configured),
        verifier: createOpenAiReceiverGroundingVerifier(configured),
      });

      expect(outcome.answerMode).toBe("generated-grounded");
      expect(outcome.answer.toLowerCase()).toMatch(/browser|web/);
      expect(outcome.answer).not.toMatch(/React|Next\.js/);
    }, 180_000);
  });
}

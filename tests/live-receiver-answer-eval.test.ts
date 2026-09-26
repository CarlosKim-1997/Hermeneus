import { describe, expect, it, vi } from "vitest";
import { applyGroundedNaturalAnswer } from "../src/application/grounded-receiver-answer.js";
import { readOpenAiExtractionConfig } from "../src/llm/openai/config.js";
import { createOpenAiReceiverAnswerGenerator } from "../src/receiver/answer/openai-answer-generator.js";
import { createOpenAiReceiverGroundingVerifier } from "../src/receiver/answer/openai-grounding-verifier.js";
import { answerEvalCases } from "./receiver/answer-eval-fixtures.js";

const configured = readOpenAiExtractionConfig();

if (!configured) {
  describe.skip("Hybrid Receiver live answer evaluation", () => {});
} else {
  describe("Hybrid Receiver live answer evaluation", () => {
    const generator = createOpenAiReceiverAnswerGenerator(configured);
    const verifier = createOpenAiReceiverGroundingVerifier(configured);
    let generatedGrounded = 0;
    let fallbacks = 0;
    let verifierRejections = 0;
    let bypassCount = 0;
    let unsupportedDisplayed = 0;

    for (const testCase of answerEvalCases) {
      it(`${testCase.id}`, async () => {
        const interpretation = {
          classification: testCase.forceClassification,
          answer: testCase.deterministicAnswer,
          citations: testCase.forceCitations,
          interpretationMode: "semantic" as const,
        };
        const selected = testCase.items.filter((item) => testCase.forceCitations.includes(item.id));
        const genSpy = vi.spyOn(generator, "generate");
        const outcome = await applyGroundedNaturalAnswer({
          question: testCase.question,
          interpretation,
          selectedItems: selected,
          deterministicAnswer: testCase.deterministicAnswer,
          generator: testCase.expectGenerated ? generator : null,
          verifier: testCase.expectGenerated ? verifier : null,
        });

        if (!testCase.expectGenerated) {
          bypassCount += 1;
          expect(genSpy).not.toHaveBeenCalled();
          expect(outcome.answerMode).toBe("deterministic");
        } else if (testCase.id === "A4") {
          expect(outcome.answer.toLowerCase()).toMatch(/tentative/);
          if (outcome.answerMode === "generated-grounded") generatedGrounded += 1;
          else fallbacks += 1;
        } else {
          expect(outcome.answerMode).toBe("generated-grounded");
          generatedGrounded += 1;
        }

        if (outcome.answerMode === "deterministic" && testCase.expectGenerated) {
          fallbacks += 1;
          if (outcome.answerNotice) verifierRejections += 1;
        }

        for (const pattern of testCase.forbiddenPatterns ?? []) {
          if (outcome.answerMode === "generated-grounded") {
            if (pattern.test(outcome.answer)) unsupportedDisplayed += 1;
            expect(outcome.answer).not.toMatch(pattern);
          }
        }
        for (const pattern of testCase.requiredPatterns ?? []) {
          expect(outcome.answer).toMatch(pattern);
        }

        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            id: testCase.id,
            m6Classification: testCase.forceClassification,
            selectedCitations: testCase.forceCitations,
            finalAnswerMode: outcome.answerMode,
            deterministicAnswer: testCase.deterministicAnswer,
            finalAnswer: outcome.answer,
          }),
        );
      }, 180_000);
    }

    it("reports live answer metrics", () => {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          generatedGroundedSuccess: generatedGrounded,
          deterministicFallbackCount: fallbacks,
          verifierRejectionCount: verifierRejections,
          generatorBypassCount: bypassCount,
          unsupportedClaimsDisplayed: unsupportedDisplayed,
        }),
      );
      expect(unsupportedDisplayed).toBe(0);
    });
  });
}

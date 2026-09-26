import { describe, expect, it } from "vitest";
import { readOpenAiExtractionConfig } from "../src/llm/openai/config.js";
import { createOpenAiReceiverSemanticInterpreter } from "../src/receiver/semantic/openai-semantic-interpreter.js";
import { validateInterpretationProposal } from "../src/receiver/semantic/validate-proposal.js";
import { renderInterpretationAnswer } from "../src/receiver/semantic/render-answer.js";

const configured = readOpenAiExtractionConfig();

if (!configured) {
  describe.skip("live Receiver smoke", () => {});
} else {
  describe("live Receiver smoke", () => {
    it("returns validated Hermeneus-rendered answer without raw source in model path", async () => {
      const interpreter = createOpenAiReceiverSemanticInterpreter(configured);
      const items = [
        {
          id: "web",
          type: "CONFIRMED" as const,
          statement: "Web-first is confirmed.",
          priority: "CORE" as const,
        },
      ];
      const proposal = await interpreter.interpret({ question: "Are we building web first?", items });
      const validated = validateInterpretationProposal(proposal, items);
      expect(validated.ok).toBe(true);
      const rendered = renderInterpretationAnswer(
        proposal.classification,
        proposal.citationIds,
        items,
        "Are we building web first?",
      );
      expect(rendered.answer.length).toBeGreaterThan(0);
      expect(rendered.answer).not.toMatch(/conversation|transcript|message/i);
      expect(JSON.stringify(proposal)).not.toContain("SECRET");
    }, 120_000);
  });
}

import { describe, expect, it } from "vitest";
import { interpretReceiverQuestion } from "../src/application/receiver-interpretation.js";
import { readOpenAiExtractionConfig } from "../src/llm/openai/config.js";
import { authorityFromReceiverView } from "../src/receiver/interpretation-authority.js";
import { createOpenAiReceiverSemanticInterpreter } from "../src/receiver/semantic/openai-semantic-interpreter.js";

const configured = readOpenAiExtractionConfig();

if (!configured) {
  describe.skip("live Receiver smoke", () => {});
} else {
  describe("live Receiver smoke", () => {
    it("hybrid interpretReceiverQuestion returns semantic mode with Hermeneus-rendered answer", async () => {
      const interpreter = createOpenAiReceiverSemanticInterpreter(configured);
      const items = [
        {
          id: "web",
          type: "CONFIRMED" as const,
          statement: "Web-first is confirmed.",
          priority: "CORE" as const,
        },
      ];
      const authority = authorityFromReceiverView({
        handoffId: "live-smoke",
        version: 1,
        publishedAt: "2026-09-26T00:00:00.000Z",
        items,
      });
      const result = await interpretReceiverQuestion("Are we building web first?", authority, interpreter);
      expect(result.interpretationMode).toBe("semantic");
      expect(result.classification).toBe("SUPPORTED");
      expect(result.citations).toContain("web");
      expect(result.answer).toMatch(/Web-first is confirmed/);
      expect(result.answer).not.toMatch(/conversation|transcript|message/i);
      expect(JSON.stringify(result)).not.toContain("SECRET");
    }, 120_000);
  });
}

import { describe, expect, it } from "vitest";
import { createOpenAiHandoffExtractor } from "../src/extraction/model-backed-extractor.js";
import { validateExtractionProposal } from "../src/extraction/validation.js";
import type { NormalizedConversation } from "../src/import/types.js";

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MODEL?.trim();

const fixtureConversation: NormalizedConversation = {
  id: "conv-live-smoke",
  source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
  messages: [
    {
      id: "conv-live-smoke:c1",
      role: "creator",
      content: "We will ship a web MVP first; mobile can wait.",
      source: { provider: "generic-text" },
    },
    {
      id: "conv-live-smoke:a1",
      role: "assistant",
      content: "Mobile-first might be faster to demo.",
      source: { provider: "generic-text" },
    },
    {
      id: "conv-live-smoke:c2",
      role: "creator",
      content: "Web-first is confirmed for the MVP.",
      source: { provider: "generic-text" },
    },
  ],
};

if (!apiKey || !model) {
  describe.skip("live OpenAI extraction smoke", () => {
    it("requires OPENAI_API_KEY and OPENAI_MODEL", () => undefined);
  });
} else {
  describe("live OpenAI extraction smoke", () => {
    it("returns a proposal that passes deterministic provenance validation", async () => {
      const extractor = createOpenAiHandoffExtractor({ apiKey, model });
      const proposal = await extractor.extract(fixtureConversation);
      const validated = validateExtractionProposal(fixtureConversation, proposal);
      expect(validated.candidates.length).toBeGreaterThan(0);
      expect(validated.candidates.length).toBeLessThanOrEqual(20);
      for (const candidate of validated.candidates) {
        expect(candidate.sources.some((source) => source.messageId.startsWith("conv-live-smoke:c"))).toBe(true);
      }
    }, 120_000);
  });
}

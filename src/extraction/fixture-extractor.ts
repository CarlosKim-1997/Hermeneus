import type { NormalizedConversation } from "../import/types.js";
import type { HandoffExtractor } from "./extractor.js";
import type { ExtractionCandidate } from "./proposal-schema.js";

/** Deterministic test double. Returns a proposal, never a persisted draft. */
export function fixtureExtractor(candidates: ExtractionCandidate[]): HandoffExtractor {
  return {
    async extract(_conversation: NormalizedConversation) {
      return { candidates: structuredClone(candidates) };
    },
  };
}

/** E2E / dev deterministic suggestions without a live model key. */
export function e2eFixtureExtractor(): HandoffExtractor {
  return {
    async extract(conversation: NormalizedConversation) {
      const creatorMessage = conversation.messages.find((message) => message.role === "creator");
      if (!creatorMessage) {
        return { candidates: [] };
      }
      const excerpt = creatorMessage.content.includes("web-first is confirmed")
        ? "web-first is confirmed"
        : creatorMessage.content.slice(0, 40);
      return {
        candidates: [
          {
            type: "CONFIRMED",
            statement: "Web-first is confirmed for now.",
            priority: "CORE",
            sources: [{ messageId: creatorMessage.id, excerpt }],
          },
        ],
      };
    },
  };
}

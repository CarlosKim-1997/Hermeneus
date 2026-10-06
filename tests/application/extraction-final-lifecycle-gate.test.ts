import { describe, expect, it } from "vitest";
import type { HandoffItem } from "../../src/handoff/schema.js";
import type { HandoffExtractor } from "../../src/extraction/extractor.js";
import { SourceUnavailableError } from "../../src/persistence/errors.js";
import { generateHandoffExtractionProposal } from "../../src/application/use-cases/generate-extraction-proposal.js";
import type { getRepositories } from "../../src/application/runtime.js";

type Repos = ReturnType<typeof getRepositories>;

const HANDOFF_ID = "hd-ext-gate";
const CREATOR_ID = "creator_ext_gate";

const conversation = {
  id: "conv-ext-gate",
  source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
  messages: [
    {
      id: "conv-ext-gate:m1",
      role: "creator" as const,
      content: "Web-first is confirmed.",
      source: { provider: "generic-text" },
    },
  ],
};

function buildRepos(lifecycleSequence: Array<"active" | "erasing">): Repos {
  let lifecycleCall = 0;
  const extractor: HandoffExtractor = {
    extract: async () => ({
      candidates: [
        {
          type: "CONFIRMED" as const,
          statement: "Web-first is confirmed.",
          priority: "CORE" as const,
          sources: [{ messageId: "conv-ext-gate:m1", excerpt: "Web-first is confirmed." }],
        },
      ],
    }),
  };

  const repos = {
    handoffs: {
      getOwnerCreatorId: async () => CREATOR_ID,
      getHandoffSourceState: async () => ({ kind: "retained" as const, conversationId: conversation.id }),
    },
    creators: {
      getLifecycleStatus: async () => {
        const status = lifecycleSequence[lifecycleCall] ?? "erasing";
        lifecycleCall += 1;
        return status;
      },
    },
    conversations: {
      get: async () => conversation,
    },
  } as unknown as Repos;

  return Object.assign(repos, { __extractor: extractor });
}

describe("Extraction final lifecycle gate", () => {
  it("discards suggestions when lifecycle becomes non-active before return", async () => {
    const repos = buildRepos(["active", "active", "erasing"]);
    const extractor = (repos as Repos & { __extractor: HandoffExtractor }).__extractor;
    await expect(generateHandoffExtractionProposal(repos, extractor, HANDOFF_ID)).rejects.toBeInstanceOf(
      SourceUnavailableError,
    );
  });

  it("returns suggestions when final lifecycle check is still active", async () => {
    const repos = buildRepos(["active", "active", "active"]);
    const extractor = (repos as Repos & { __extractor: HandoffExtractor }).__extractor;
    const result = await generateHandoffExtractionProposal(repos, extractor, HANDOFF_ID);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]?.createdBy).toBe("EXTRACTION");
    expect((result.suggestions[0] as HandoffItem).statement).toContain("Web-first");
  });
});

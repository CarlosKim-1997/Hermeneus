import { describe, expect, it, vi } from "vitest";
import { issueShareCapabilityAction } from "../../src/application/share-actions.js";
import { setCreatorSessionProviderForTests } from "../../src/application/creator-session-factory.js";

describe("Share actions — erasing lifecycle blocked", () => {
  it("maps erasing Creator to generic Handoff unavailable", async () => {
    setCreatorSessionProviderForTests({
      getCurrentPrincipal: async () => ({ creatorId: "creator_erasing", lifecycleStatus: "erasing" }),
    });
    const result = await issueShareCapabilityAction({ handoffId: "hd-any", version: 1 });
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "This Handoff is unavailable." },
    });
    vi.restoreAllMocks();
    setCreatorSessionProviderForTests(undefined);
  });
});

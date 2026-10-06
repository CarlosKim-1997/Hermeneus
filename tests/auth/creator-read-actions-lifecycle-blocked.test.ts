import { describe, expect, it } from "vitest";
import { fetchCreatorReview, fetchPublishedHandoff } from "../../src/application/actions.js";
import { setCreatorSessionProviderForTests } from "../../src/application/creator-session-factory.js";

describe("Creator read actions — erasing lifecycle blocked", () => {
  it("fetchCreatorReview returns undefined for erasing Creator", async () => {
    setCreatorSessionProviderForTests({
      getCurrentPrincipal: async () => ({ creatorId: "creator_erasing_read", lifecycleStatus: "erasing" }),
    });
    const review = await fetchCreatorReview("hd-any");
    expect(review).toBeUndefined();
    setCreatorSessionProviderForTests(undefined);
  });

  it("fetchPublishedHandoff returns undefined for erasing Creator", async () => {
    setCreatorSessionProviderForTests({
      getCurrentPrincipal: async () => ({ creatorId: "creator_erasing_read", lifecycleStatus: "erasing" }),
    });
    const published = await fetchPublishedHandoff("hd-any", 1);
    expect(published).toBeUndefined();
    setCreatorSessionProviderForTests(undefined);
  });
});

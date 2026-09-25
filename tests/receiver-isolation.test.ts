import { describe, expect, it } from "vitest";
import { PublicationLedger } from "../src/handoff/publication.js";
import { createDraft } from "../src/handoff/draft.js";
import type { HandoffItem } from "../src/handoff/schema.js";
import { MemoryStore } from "../src/persistence/memory-store.js";

describe("receiver isolation", () => {
  it("omits source excerpts from the default receiver view", () => {
    const item: HandoffItem = {
      id: "web",
      type: "CONFIRMED",
      statement: "Web-first is confirmed.",
      priority: "CORE",
      createdBy: "CREATOR",
      sources: [{ messageId: "m1", excerpt: "SECRET transcript excerpt" }],
    };
    const ledger = new PublicationLedger();
    const published = ledger.publish(createDraft("handoff", [item]), "2026-09-25T00:00:00.000Z");
    const store = new MemoryStore();
    store.savePublished(published);

    const view = store.receiverView("handoff", 1);
    expect(view?.items).toEqual([
      {
        id: "web",
        type: "CONFIRMED",
        statement: "Web-first is confirmed.",
        priority: "CORE",
      },
    ]);
    expect(JSON.stringify(view)).not.toMatch(/SECRET transcript excerpt/);
  });
});

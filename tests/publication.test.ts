import { describe, expect, it } from "vitest";
import { createDraft, updateItem } from "../src/handoff/draft.js";
import { PublicationLedger } from "../src/handoff/publication.js";
import type { HandoffItem } from "../src/handoff/schema.js";

const webFirst: HandoffItem = {
  id: "web",
  type: "CONFIRMED",
  statement: "Web-first is confirmed.",
  priority: "CORE",
  createdBy: "CREATOR",
  sources: [{ messageId: "m2" }],
};

describe("publication snapshots", () => {
  it("keeps published v1 unchanged when the draft changes and publishes v2", () => {
    const ledger = new PublicationLedger();
    let draft = createDraft("handoff-1", [webFirst]);
    const v1 = ledger.publish(draft, "2026-09-25T00:00:00.000Z");

    draft = updateItem(draft, "web", { statement: "Web-first remains confirmed for v2." });
    const v2 = ledger.publish(draft, "2026-09-25T01:00:00.000Z");

    expect(v1.version).toBe(1);
    expect(v1.items[0]?.statement).toBe("Web-first is confirmed.");
    expect(v2.version).toBe(2);
    expect(v2.items[0]?.statement).toBe("Web-first remains confirmed for v2.");
    expect(ledger.get("handoff-1", 1)?.items[0]?.statement).toBe("Web-first is confirmed.");
    expect(() => {
      (v1.items as unknown as HandoffItem[]).push(webFirst);
    }).toThrow();
  });
});

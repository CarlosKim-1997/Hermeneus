import { describe, expect, it } from "vitest";
import { fixtureExtractor } from "../src/extraction/fixture-extractor.js";
import { materializeExtractionProposal } from "../src/extraction/materialize.js";
import { createDraft, updateItem } from "../src/handoff/draft.js";
import { PublicationLedger } from "../src/handoff/publication.js";
import type { HandoffItem } from "../src/handoff/schema.js";
import type { NormalizedConversation } from "../src/import/types.js";
import { interpretWithModel } from "../src/receiver/grounding.js";
import { authorityFromPublished } from "../src/receiver/interpretation-authority.js";
import { interpretPublished, UNKNOWN_ANSWER } from "../src/receiver/interpret.js";

function item(partial: Pick<HandoffItem, "id" | "type" | "statement"> & Partial<HandoffItem>): HandoffItem {
  return {
    priority: "CORE",
    createdBy: "CREATOR",
    sources: [{ messageId: "m1" }],
    ...partial,
  };
}

function publish(items: HandoffItem[], id = "handoff") {
  return new PublicationLedger().publish(createDraft(id, items), "2026-09-25T00:00:00.000Z");
}

describe("epistemic fixtures", () => {
  it("A — superseded exploration answers web-first and does not recommend mobile", () => {
    const published = publish([
      item({
        id: "rejected-mobile",
        type: "REJECTED",
        statement: "Mobile-first was explored and rejected.",
      }),
      item({
        id: "confirmed-web",
        type: "CONFIRMED",
        statement: "Web-first is confirmed.",
      }),
    ]);

    const result = interpretPublished("Are we building mobile first?", authorityFromPublished(published));
    expect(result.classification).toBe("SUPPORTED");
    expect(result.answer).toMatch(/Web-first is confirmed/);
    expect(result.answer).toMatch(/Mobile-first was explored and rejected/);
    expect(result.answer.toLowerCase()).not.toMatch(/recommend|objectively|should build mobile/);
    expect(result.citations).toEqual(expect.arrayContaining(["rejected-mobile", "confirmed-web"]));
  });

  it("B — missing pricing stays UNKNOWN and does not invent a price", () => {
    const published = publish([
      item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
    ]);
    const result = interpretPublished("What will this cost users?", authorityFromPublished(published));
    expect(result.classification).toBe("UNKNOWN");
    expect(result.answer).toBe(UNKNOWN_ANSWER);
    expect(result.answer.toLowerCase()).not.toMatch(/freemium|pricing|\$|per month/);
  });

  it("C — explicit open authentication stays OPEN", () => {
    const published = publish([
      item({
        id: "auth",
        type: "OPEN",
        statement: "The authentication provider, including Google login, is unresolved.",
      }),
    ]);
    const result = interpretPublished("Are we using Google login?", authorityFromPublished(published));
    expect(result.classification).toBe("OPEN");
    expect(result.answer).toMatch(/has not decided/i);
    expect(result.answer).toMatch(/unresolved/);
    expect(result.answer.toLowerCase()).not.toMatch(/yes,|we are using google/);
  });

  it("D — web client first does not imply staffing", () => {
    const published = publish([
      item({ id: "web", type: "CONFIRMED", statement: "Web client first." }),
    ]);
    const result = interpretPublished("Then we don't need a mobile engineer, right?", authorityFromPublished(published));
    expect(result.classification).toBe("UNKNOWN");
    expect(result.answer).toBe(UNKNOWN_ANSWER);
    expect(result.answer.toLowerCase()).not.toMatch(/engineer/);
  });

  it("E — approved handoff wins over a conflicting raw transcript", () => {
    const published = publish([
      item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
    ]);
    const rawTranscript = "Mobile-first is the decision. Do not build web first.";
    const result = interpretPublished("Is web-first confirmed despite other notes?", authorityFromPublished(published));
    expect(result.classification).toBe("SUPPORTED");
    expect(result.answer).toBe("Web-first is confirmed.");
    expect(result.answer).not.toContain("Mobile-first is the decision");
    expect(rawTranscript).toContain("Mobile-first is the decision");
    expect(JSON.stringify(result)).not.toContain("Mobile-first is the decision");
  });

  it("F — creator edit replaces extraction before publication", async () => {
    const conversation: NormalizedConversation = {
      id: "conv-f",
      source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
      messages: [
        {
          id: "conv-f:m1",
          role: "creator",
          content: "Maybe mobile first would be good.",
          source: { provider: "generic-text" },
        },
      ],
    };
    const extractor = fixtureExtractor([
      {
        type: "CONFIRMED",
        statement: "Mobile-first is confirmed.",
        priority: "CORE",
        sources: [{ messageId: "conv-f:m1", excerpt: "Maybe mobile first would be good." }],
      },
    ]);
    const proposal = await extractor.extract(conversation);
    const extracted = materializeExtractionProposal("handoff-f", proposal, { itemIds: ["mobile"] });
    expect(extracted.items[0]?.createdBy).toBe("EXTRACTION");
    expect(extracted.items[0]?.type).toBe("CONFIRMED");

    const edited = updateItem(extracted, "mobile", {
      type: "REJECTED",
      statement: "Mobile-first is rejected.",
    });
    const published = new PublicationLedger().publish(edited, "2026-09-25T00:00:00.000Z");
    const result = interpretPublished("Are we building mobile first?", authorityFromPublished(published));
    expect(result.classification).toBe("SUPPORTED");
    expect(result.answer).toMatch(/Mobile-first is rejected/);
    expect(result.answer).not.toMatch(/Mobile-first is confirmed/);
    expect(published.items[0]?.createdBy).toBe("CREATOR");
  });

  it("G — draft mutation does not mutate published v1", () => {
    const ledger = new PublicationLedger();
    let draft = createDraft("handoff-g", [
      item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
    ]);
    const v1 = ledger.publish(draft, "2026-09-25T00:00:00.000Z");
    draft = updateItem(draft, "web", { statement: "Native mobile is confirmed." });
    const v2 = ledger.publish(draft, "2026-09-25T02:00:00.000Z");

    expect(v1.items[0]?.statement).toBe("Web-first is confirmed.");
    expect(ledger.get("handoff-g", 1)?.items[0]?.statement).toBe("Web-first is confirmed.");
    expect(v2.version).toBe(2);
    expect(v2.items[0]?.statement).toBe("Native mobile is confirmed.");
  });

  it("derives a disabled capability and still refuses staffing", () => {
    const published = publish([
      item({
        id: "search",
        type: "CONSTRAINT",
        statement: "External web search is disabled in MVP.",
      }),
    ]);
    const derived = interpretPublished("Will the receiver agent browse the web?", authorityFromPublished(published));
    expect(derived.classification).toBe("DERIVED");
    expect(derived.answer).toMatch(/disabled in MVP/);
    expect(derived.citations).toEqual(["search"]);

    const staffingPublished = publish([
      item({ id: "web", type: "CONFIRMED", statement: "Web is the first client." }),
    ]);
    const staffing = interpretPublished(
      "So we don't need a mobile developer, right?",
      authorityFromPublished(staffingPublished),
    );
    expect(staffing.classification).toBe("UNKNOWN");
  });

  it("drops an ungrounded model answer that tries to fill UNKNOWN", () => {
    const published = publish([
      item({ id: "web", type: "CONFIRMED", statement: "Web-first is confirmed." }),
    ]);
    const result = interpretWithModel("What will this cost users?", published, {
      propose: () => ({
        classification: "SUPPORTED",
        answer: "A freemium plan at $9 per month is reasonable.",
        citations: ["web"],
      }),
    });
    expect(result.classification).toBe("UNKNOWN");
    expect(result.answer).toBe(UNKNOWN_ANSWER);
    expect(result.answer).not.toMatch(/freemium|\$9/);
  });
});

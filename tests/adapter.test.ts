import { describe, expect, it } from "vitest";
import { importConversation, registeredAdapterIds } from "../src/import/registry.js";

const transcript = `creator: Maybe mobile first would be good.
assistant: We could start there.
creator: Actually, web first.
  The first client is the web app.
`;

describe("GenericTextAdapter", () => {
  it("normalizes role-prefixed text without keeping a provider-specific envelope", async () => {
    const conversation = await importConversation({
      text: transcript,
      importedAt: "2026-09-25T00:00:00.000Z",
      conversationId: "conv-a",
    });

    expect(conversation.source.provider).toBe("generic-text");
    expect(conversation.messages.map((message) => [message.role, message.content])).toEqual([
      ["creator", "Maybe mobile first would be good."],
      ["assistant", "We could start there."],
      ["creator", "Actually, web first.\nThe first client is the web app."],
    ]);
    expect(conversation.messages.every((message) => message.source.provider === "generic-text")).toBe(true);
    expect(registeredAdapterIds()).toEqual(["generic-text"]);
  });

  it("rejects text that has no role prefixes", async () => {
    await expect(
      importConversation({ text: "just a paragraph", importedAt: "2026-09-25T00:00:00.000Z" }),
    ).rejects.toThrow(/No conversation adapter/);
  });
});

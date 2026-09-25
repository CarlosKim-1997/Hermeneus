import { describe, expect, it } from "vitest";
import { handoffItemSchema } from "../src/handoff/schema.js";

describe("handoff schema", () => {
  it("accepts a traceable item and rejects provider fields", () => {
    const item = handoffItemSchema.parse({
      id: "item-1",
      type: "CONFIRMED",
      statement: "Web-first is confirmed.",
      priority: "CORE",
      createdBy: "CREATOR",
      sources: [{ messageId: "conv-a:m3", excerpt: "Actually, web first." }],
    });
    expect(item.sources[0]?.messageId).toBe("conv-a:m3");

    expect(() =>
      handoffItemSchema.parse({
        ...item,
        provider: "chatgpt",
      }),
    ).toThrow();
  });
});

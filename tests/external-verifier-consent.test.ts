import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyExternalAnswerAction } from "../src/application/share-actions.js";

afterEach(() => vi.unstubAllEnvs());

describe("external verification consent boundary", () => {
  it("rejects a request before database or provider access when consent is absent", async () => {
    vi.stubEnv("HERMENEUS_EXTERNAL_VERIFIER", "openai");
    vi.stubEnv("OPENAI_VERIFIER_API_KEY", "test-only-key");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("TEST_DATABASE_URL", "");
    const result = await verifyExternalAnswerAction({ token: "untrusted-token", submission: {} });
    expect(result).toEqual({ ok: false, error: "Confirm external processing for this verification request." });
  });
});

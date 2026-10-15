import { afterEach, describe, expect, it, vi } from "vitest";
import { readOpenAiExtractionConfig } from "../src/llm/openai/config.js";
import { isOpenAiExternalVerifierConfigured } from "../src/receiver/external/openai-verifier.js";
import { getHandoffExtractor, isLiveExtractionConfigured } from "../src/application/extraction-factory.js";

afterEach(() => vi.unstubAllEnvs());

describe("OpenAI credential routing", () => {
  function baseline() {
    vi.stubEnv("OPENAI_API_KEY", " verifier-test-key ");
    vi.stubEnv("OPENAI_EXTRACTION_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "legacy-test-model");
    vi.stubEnv("HERMENEUS_EXTRACTION_FIXTURE", "");
    vi.stubEnv("HERMENEUS_EXTERNAL_VERIFIER", "off");
  }

  it("does not enable server generation or verification just by registering the verifier key", () => {
    baseline();
    expect(readOpenAiExtractionConfig()).toBeUndefined();
    expect(isLiveExtractionConfigured()).toBe(false);
    expect(() => getHandoffExtractor()).toThrow("Live extraction is not configured");
    expect(isOpenAiExternalVerifierConfigured()).toBe(false);
  });

  it("enables only the verifier with its explicit mode and registered default key", () => {
    baseline();
    vi.stubEnv("HERMENEUS_EXTERNAL_VERIFIER", "openai");
    expect(isOpenAiExternalVerifierConfigured()).toBe(true);
    expect(readOpenAiExtractionConfig()).toBeUndefined();
    vi.stubEnv("OPENAI_API_KEY", "   ");
    expect(isOpenAiExternalVerifierConfigured()).toBe(false);
  });

  it("never falls back to a legacy generation credential for verification", () => {
    baseline();
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_EXTRACTION_API_KEY", "legacy-test-key");
    vi.stubEnv("HERMENEUS_EXTERNAL_VERIFIER", "openai");
    expect(readOpenAiExtractionConfig()).toEqual({ apiKey: "legacy-test-key", model: "legacy-test-model" });
    expect(isOpenAiExternalVerifierConfigured()).toBe(false);
  });
});

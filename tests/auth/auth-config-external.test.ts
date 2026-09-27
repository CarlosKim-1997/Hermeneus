import { describe, expect, it, vi } from "vitest";
import { buildExternalAuthOptions } from "../../src/auth/external-auth-options.js";
import { readCreatorAuthConfig } from "../../src/creator/auth-config.js";

describe("External auth configuration", () => {
  it("disabled mode does not require Google secrets", () => {
    vi.stubEnv("CREATOR_AUTH_MODE", "disabled");
    expect(readCreatorAuthConfig()).toEqual({ mode: "disabled" });
    expect(buildExternalAuthOptions()).toBeNull();
    vi.unstubAllEnvs();
  });

  it("external mode requires AUTH_SECRET and Google credentials", () => {
    vi.stubEnv("CREATOR_AUTH_MODE", "external");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(() => readCreatorAuthConfig()).toThrow(/AUTH_SECRET/);
    vi.unstubAllEnvs();
  });

  it("external mode exposes Google credential config when credentials present", () => {
    vi.stubEnv("CREATOR_AUTH_MODE", "external");
    vi.stubEnv("AUTH_SECRET", "test-session-secret-minimum-32-characters-long");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
    const config = readCreatorAuthConfig();
    expect(config.mode).toBe("external");
    if (config.mode === "external") {
      expect(config.googleClientId).toBe("google-client-id");
      expect(config.googleClientSecret).toBe("google-client-secret");
    }
    vi.unstubAllEnvs();
  });

  it("does not force trustHost when AUTH_TRUST_HOST is unset", () => {
    vi.stubEnv("CREATOR_AUTH_MODE", "external");
    vi.stubEnv("AUTH_SECRET", "test-session-secret-minimum-32-characters-long");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
    vi.stubEnv("AUTH_TRUST_HOST", "");
    const options = buildExternalAuthOptions();
    expect(options).toBeTruthy();
    expect(options).not.toHaveProperty("trustHost");
    vi.unstubAllEnvs();
  });

  it("sets trustHost explicitly when AUTH_TRUST_HOST=true", () => {
    vi.stubEnv("CREATOR_AUTH_MODE", "external");
    vi.stubEnv("AUTH_SECRET", "test-session-secret-minimum-32-characters-long");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
    vi.stubEnv("AUTH_TRUST_HOST", "true");
    const options = buildExternalAuthOptions();
    expect(options?.trustHost).toBe(true);
    vi.unstubAllEnvs();
  });

  it("sets trustHost false when AUTH_TRUST_HOST=false", () => {
    vi.stubEnv("CREATOR_AUTH_MODE", "external");
    vi.stubEnv("AUTH_SECRET", "test-session-secret-minimum-32-characters-long");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
    vi.stubEnv("AUTH_TRUST_HOST", "false");
    const options = buildExternalAuthOptions();
    expect(options?.trustHost).toBe(false);
    vi.unstubAllEnvs();
  });
});

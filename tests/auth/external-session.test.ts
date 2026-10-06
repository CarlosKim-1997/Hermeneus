import { describe, expect, it, vi } from "vitest";
import { resolveCreatorPrincipalFromExternalSession } from "../../src/application/external-session-resolver.js";
import { readCreatorIdFromExternalAuthToken } from "../../src/application/external-auth-callback.js";
import { readCreatorAuthConfig } from "../../src/creator/auth-config.js";
import { createSignedSessionToken } from "../../src/creator/dev-session.js";
import { resolveDevSessionCredential } from "../../src/creator/resolve-dev-session-principal.js";
import { getCreatorSessionProvider, setCreatorSessionProviderForTests } from "../../src/application/creator-session-factory.js";

describe("External session adapter (ES)", () => {
  it("ES1 — valid external session creatorId → CreatorPrincipal", async () => {
    const principal = await resolveCreatorPrincipalFromExternalSession(
      { creatorId: "creator_es1" },
      async () => "active",
    );
    expect(principal).toEqual({ creatorId: "creator_es1", lifecycleStatus: "active" });
  });

  it("ES2 — missing creatorId → unauthenticated", async () => {
    expect(await resolveCreatorPrincipalFromExternalSession({}, async () => "active")).toBeUndefined();
    expect(readCreatorIdFromExternalAuthToken({})).toBeUndefined();
  });

  it("ES3 — unknown creatorId → unauthenticated", async () => {
    expect(
      await resolveCreatorPrincipalFromExternalSession({ creatorId: "creator_missing" }, async () => undefined),
    ).toBeUndefined();
  });

  it("ES4 — email-only session → unauthenticated", async () => {
    expect(
      readCreatorIdFromExternalAuthToken({ email: "user@example.com" } as { creatorId?: string; email?: string }),
    ).toBeUndefined();
  });

  it("ES5 — dev session remains unavailable in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CREATOR_AUTH_MODE", "dev");
    vi.stubEnv("DEV_CREATOR_ID", "creator_dev");
    vi.stubEnv("CREATOR_SESSION_SECRET", "test-session-secret-minimum-32-characters");
    const now = Date.now();
    const token = createSignedSessionToken({
      creatorId: "creator_dev",
      issuedAt: now,
      expiresAt: now + 60_000,
      secret: "test-session-secret-minimum-32-characters",
    });
    expect(resolveDevSessionCredential({ sessionToken: token, config: readCreatorAuthConfig(), nowMs: now })).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("ES6b — erasing lifecycle still resolves credential (account-only paths gate separately)", async () => {
    const principal = await resolveCreatorPrincipalFromExternalSession(
      { creatorId: "creator_es_erasing" },
      async () => "erasing",
    );
    expect(principal).toEqual({ creatorId: "creator_es_erasing", lifecycleStatus: "erasing" });
  });

  it("ES6 — disabled mode remains unavailable", async () => {
    vi.stubEnv("CREATOR_AUTH_MODE", "disabled");
    setCreatorSessionProviderForTests(undefined);
    expect(await (await getCreatorSessionProvider()).getCurrentPrincipal()).toBeUndefined();
    vi.unstubAllEnvs();
  });
});

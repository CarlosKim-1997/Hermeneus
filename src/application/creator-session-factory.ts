import type { CreatorSessionProvider } from "../creator/session-provider.js";
import { readCreatorAuthConfig } from "../creator/auth-config.js";
import { CookieCreatorSessionProvider } from "./creator-session-cookie-provider.js";

let testOverride: CreatorSessionProvider | null | undefined;
let cachedExternalProvider: CreatorSessionProvider | undefined;
let externalProviderPromise: Promise<CreatorSessionProvider> | undefined;

async function loadExternalProvider(): Promise<CreatorSessionProvider> {
  if (cachedExternalProvider) return cachedExternalProvider;
  if (!externalProviderPromise) {
    externalProviderPromise = import("./creator-session-external-provider.js").then(({ AuthJsCreatorSessionProvider }) => {
      cachedExternalProvider = new AuthJsCreatorSessionProvider();
      return cachedExternalProvider;
    });
  }
  return externalProviderPromise;
}

export function setCreatorSessionProviderForTests(provider: CreatorSessionProvider | null | undefined) {
  testOverride = provider;
}

const disabledProvider: CreatorSessionProvider = {
  getCurrentPrincipal: async () => undefined,
};

export async function getCreatorSessionProvider(): Promise<CreatorSessionProvider> {
  if (testOverride !== undefined) {
    return testOverride ?? disabledProvider;
  }
  const config = readCreatorAuthConfig();
  if (config.mode === "dev") {
    return new CookieCreatorSessionProvider();
  }
  if (config.mode === "external") {
    return loadExternalProvider();
  }
  return disabledProvider;
}

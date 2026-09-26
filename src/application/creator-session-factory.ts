import { createRequire } from "node:module";
import type { CreatorSessionProvider } from "../creator/session-provider.js";
import { readCreatorAuthConfig } from "../creator/auth-config.js";
import { CookieCreatorSessionProvider } from "./creator-session-cookie-provider.js";

const require = createRequire(import.meta.url);

let testOverride: CreatorSessionProvider | null | undefined;
let cachedExternalProvider: CreatorSessionProvider | undefined;

function loadExternalProvider(): CreatorSessionProvider {
  if (!cachedExternalProvider) {
    const { AuthJsCreatorSessionProvider } = require("./creator-session-external-provider.js") as {
      AuthJsCreatorSessionProvider: new () => CreatorSessionProvider;
    };
    cachedExternalProvider = new AuthJsCreatorSessionProvider();
  }
  return cachedExternalProvider;
}

export function setCreatorSessionProviderForTests(provider: CreatorSessionProvider | null | undefined) {
  testOverride = provider;
}

const disabledProvider: CreatorSessionProvider = {
  getCurrentPrincipal: async () => undefined,
};

export function getCreatorSessionProvider(): CreatorSessionProvider {
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

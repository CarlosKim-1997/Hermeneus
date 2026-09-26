import type { CreatorSessionProvider } from "../creator/session-provider.js";
import { CookieCreatorSessionProvider } from "./creator-session-cookie-provider.js";

let testOverride: CreatorSessionProvider | null | undefined;

export function setCreatorSessionProviderForTests(provider: CreatorSessionProvider | null | undefined) {
  testOverride = provider;
}

export function getCreatorSessionProvider(): CreatorSessionProvider {
  if (testOverride !== undefined) {
    return testOverride ?? { getCurrentPrincipal: async () => undefined };
  }
  return new CookieCreatorSessionProvider();
}

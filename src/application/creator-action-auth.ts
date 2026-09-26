import type { CreatorPrincipal } from "../creator/types.js";
import { getCreatorSessionProvider } from "./creator-session-factory.js";
import { CreatorUnauthenticatedError } from "./creator-auth-errors.js";

export async function requireCreatorPrincipalFromSession(): Promise<CreatorPrincipal> {
  const principal = await getCreatorSessionProvider().getCurrentPrincipal();
  if (!principal) {
    throw new CreatorUnauthenticatedError();
  }
  return principal;
}

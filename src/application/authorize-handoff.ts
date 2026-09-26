import type { CreatorPrincipal } from "../creator/types.js";
import type { getRepositories } from "./runtime.js";
import { CreatorUnauthenticatedError, HandoffAccessUnavailableError } from "./creator-auth-errors.js";

type Repos = ReturnType<typeof getRepositories>;

export async function requireOwnedHandoff(
  repos: Repos,
  principal: CreatorPrincipal | undefined,
  handoffId: string,
): Promise<CreatorPrincipal> {
  if (!principal) {
    throw new CreatorUnauthenticatedError();
  }
  const owner = await repos.handoffs.getOwnerCreatorId(handoffId);
  if (!owner || owner !== principal.creatorId) {
    throw new HandoffAccessUnavailableError();
  }
  return principal;
}

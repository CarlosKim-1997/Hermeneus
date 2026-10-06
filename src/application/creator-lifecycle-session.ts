import type { CreatorId, CreatorLifecycleStatus, CreatorPrincipal } from "../creator/types.js";
import type { getRepositories } from "./runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export async function resolveCreatorPrincipalWithLifecycle(
  repos: Repos,
  creatorId: CreatorId,
): Promise<CreatorPrincipal | undefined> {
  const lifecycleStatus = await repos.creators.getLifecycleStatus(creatorId);
  if (!lifecycleStatus) return undefined;
  return { creatorId, lifecycleStatus };
}

export function isActiveCreatorLifecycle(status: CreatorLifecycleStatus): boolean {
  return status === "active";
}

export function isAccountLifecycleSession(status: CreatorLifecycleStatus): boolean {
  return status === "active" || status === "erasing";
}

import type { CreatorId, CreatorPrincipal } from "../creator/types.js";
import { readCreatorIdFromExternalAuthToken } from "./external-auth-callback.js";

export async function resolveCreatorPrincipalFromExternalSession(
  session: { creatorId?: string } | null | undefined,
  getLifecycleStatus: (creatorId: CreatorId) => Promise<CreatorPrincipal["lifecycleStatus"] | undefined>,
): Promise<CreatorPrincipal | undefined> {
  const creatorId = readCreatorIdFromExternalAuthToken(session);
  if (!creatorId) return undefined;
  const lifecycleStatus = await getLifecycleStatus(creatorId);
  if (!lifecycleStatus) return undefined;
  return { creatorId, lifecycleStatus };
}

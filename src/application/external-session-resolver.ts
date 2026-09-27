import type { CreatorPrincipal } from "../creator/types.js";
import { readCreatorIdFromExternalAuthToken } from "./external-auth-callback.js";

export async function resolveCreatorPrincipalFromExternalSession(
  session: { creatorId?: string } | null | undefined,
  exists: (creatorId: string) => Promise<boolean>,
): Promise<CreatorPrincipal | undefined> {
  const creatorId = readCreatorIdFromExternalAuthToken(session);
  if (!creatorId) return undefined;
  if (!(await exists(creatorId))) return undefined;
  return { creatorId };
}

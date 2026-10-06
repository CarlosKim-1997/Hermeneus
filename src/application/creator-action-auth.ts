import type { CreatorPrincipal } from "../creator/types.js";
import { getCreatorSessionProvider } from "./creator-session-factory.js";
import {
  CreatorLifecycleBlockedError,
  CreatorUnauthenticatedError,
} from "./creator-auth-errors.js";
import { isAccountLifecycleSession, isActiveCreatorLifecycle } from "./creator-lifecycle-session.js";

export async function requireCreatorPrincipalFromSession(): Promise<CreatorPrincipal> {
  const principal = await (await getCreatorSessionProvider()).getCurrentPrincipal();
  if (!principal) {
    throw new CreatorUnauthenticatedError();
  }
  return principal;
}

/** Ordinary Creator workspace and mutation actions require an active lifecycle. */
export async function requireActiveCreatorPrincipal(): Promise<CreatorPrincipal> {
  const principal = await requireCreatorPrincipalFromSession();
  if (!isActiveCreatorLifecycle(principal.lifecycleStatus)) {
    throw new CreatorLifecycleBlockedError();
  }
  return principal;
}

/** Account Erasure initiation/retry allows active or erasing lifecycle. */
export async function requireAccountLifecyclePrincipal(): Promise<CreatorPrincipal> {
  const principal = await requireCreatorPrincipalFromSession();
  if (!isAccountLifecycleSession(principal.lifecycleStatus)) {
    throw new CreatorLifecycleBlockedError();
  }
  return principal;
}

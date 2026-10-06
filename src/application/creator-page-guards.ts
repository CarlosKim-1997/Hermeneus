import { notFound, redirect } from "next/navigation";
import { getCreatorSessionProvider } from "./creator-session-factory.js";
import { getRepositories } from "./runtime.js";
import { requireOwnedHandoff } from "./authorize-handoff.js";
import {
  CreatorUnauthenticatedError,
  HandoffAccessUnavailableError,
} from "./creator-auth-errors.js";
import type { CreatorPrincipal } from "../creator/types.js";
import { isAccountLifecycleSession, isActiveCreatorLifecycle } from "./creator-lifecycle-session.js";

export async function requireCreatorSessionPage(): Promise<CreatorPrincipal> {
  const principal = await (await getCreatorSessionProvider()).getCurrentPrincipal();
  if (!principal) redirect("/login");
  if (!isActiveCreatorLifecycle(principal.lifecycleStatus)) {
    if (principal.lifecycleStatus === "erasing") redirect("/account" as "/handoffs");
    redirect("/login");
  }
  return principal;
}

export async function requireAccountLifecycleSessionPage(): Promise<CreatorPrincipal> {
  const principal = await (await getCreatorSessionProvider()).getCurrentPrincipal();
  if (!principal) redirect("/login");
  if (!isAccountLifecycleSession(principal.lifecycleStatus)) redirect("/login");
  return principal;
}

export async function requireOwnedHandoffPage(handoffId: string): Promise<CreatorPrincipal> {
  const principal = await requireCreatorSessionPage();
  const repos = getRepositories();
  try {
    await requireOwnedHandoff(repos, principal, handoffId);
  } catch (error) {
    if (error instanceof HandoffAccessUnavailableError) notFound();
    throw error;
  }
  return principal;
}

export async function getOptionalCreatorSessionPage(): Promise<CreatorPrincipal | undefined> {
  return (await getCreatorSessionProvider()).getCurrentPrincipal();
}

export { CreatorUnauthenticatedError, HandoffAccessUnavailableError };

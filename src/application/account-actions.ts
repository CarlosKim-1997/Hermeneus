"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAccountLifecyclePrincipal } from "./creator-action-auth.js";
import { getRepositories } from "./runtime.js";
import {
  CreatorLifecycleBlockedError,
  CreatorUnauthenticatedError,
} from "./creator-auth-errors.js";
import { terminateCreatorSessionAfterAccountDeletion } from "./terminate-creator-session-after-deletion.js";

function mapAuthFailure(error: unknown) {
  if (error instanceof CreatorUnauthenticatedError) {
    return { ok: false as const, error: { code: "UNAUTHENTICATED" as const, message: "Sign in to continue." } };
  }
  if (error instanceof CreatorLifecycleBlockedError) {
    return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "This account is unavailable." } };
  }
  return null;
}

export async function deleteAccountAction(confirmation: string) {
  try {
    if (confirmation !== "DELETE") {
      return { ok: false as const, error: { code: "INVALID_INPUT" as const, message: 'Type DELETE exactly to confirm.' } };
    }
    const principal = await requireAccountLifecyclePrincipal();
    if (principal.lifecycleStatus === "erasing") {
      return { ok: false as const, error: { code: "INVALID_STATE" as const, message: "Account deletion is already in progress." } };
    }
    const repos = getRepositories();
    await repos.accountErasure.enterErasingPhase(principal.creatorId);
    try {
      await repos.accountErasure.completeAccountErasure(principal.creatorId);
    } catch (phase2Error) {
      const lifecycle = await repos.creators.getLifecycleStatus(principal.creatorId);
      if (lifecycle === "erasing") {
        return {
          ok: false as const,
          error: {
            code: "ERASURE_INCOMPLETE" as const,
            message: "Account deletion did not finish. You can retry from this page.",
          },
        };
      }
      throw phase2Error;
    }
    await terminateCreatorSessionAfterAccountDeletion();
    redirect("/login?accountDeleted=1");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    throw error;
  }
}

export async function retryAccountErasureAction() {
  try {
    const principal = await requireAccountLifecyclePrincipal();
    if (principal.lifecycleStatus !== "erasing") {
      return { ok: false as const, error: { code: "INVALID_STATE" as const, message: "Account deletion is not in progress." } };
    }
    const repos = getRepositories();
    try {
      await repos.accountErasure.completeAccountErasure(principal.creatorId);
    } catch (phase2Error) {
      const lifecycle = await repos.creators.getLifecycleStatus(principal.creatorId);
      if (lifecycle === "erasing") {
        return {
          ok: false as const,
          error: {
            code: "ERASURE_INCOMPLETE" as const,
            message: "Account deletion did not finish. Try again.",
          },
        };
      }
      throw phase2Error;
    }
    await terminateCreatorSessionAfterAccountDeletion();
    redirect("/login?accountDeleted=1");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    throw error;
  }
}

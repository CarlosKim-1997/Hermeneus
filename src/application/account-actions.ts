"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAccountLifecyclePrincipal } from "./creator-action-auth.js";
import { getRepositories } from "./runtime.js";
import { initiateAccountErasure, retryAccountErasure } from "./use-cases/account-erasure.js";
import {
  CreatorLifecycleBlockedError,
  CreatorUnauthenticatedError,
} from "./creator-auth-errors.js";
import { clearCreatorSessionCookie } from "./creator-session-cookie.js";

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
    await initiateAccountErasure(repos, principal.creatorId);
    await clearCreatorSessionCookie();
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
    await retryAccountErasure(repos, principal.creatorId);
    await clearCreatorSessionCookie();
    redirect("/login?accountDeleted=1");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    throw error;
  }
}

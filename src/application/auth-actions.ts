"use server";

import { cookies } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import {
  isDevCreatorAuthAllowedInRuntime,
  readCreatorAuthConfig,
  resolveDevCreatorId,
} from "../creator/auth-config.js";
import { CREATOR_SESSION_COOKIE_NAME, createSignedSessionToken } from "../creator/dev-session.js";
import { getRepositories } from "./runtime.js";

export async function devSignInAction(formData?: FormData) {
  if (!isDevCreatorAuthAllowedInRuntime()) {
    return { ok: false as const, error: "Development Creator sign-in is not available in production." };
  }
  const config = readCreatorAuthConfig();
  if (config.mode !== "dev") {
    return { ok: false as const, error: "Creator authentication is disabled." };
  }
  const slot = formData?.get("slot") === "secondary" ? "secondary" : "primary";
  const creatorId = resolveDevCreatorId(config, slot);
  if (!creatorId) {
    return { ok: false as const, error: "That development Creator slot is not configured." };
  }
  try {
    const repos = getRepositories();
    const createdAt = new Date().toISOString();
    await repos.creators.ensure({ id: creatorId, createdAt });
    const issuedAt = Date.now();
    const token = createSignedSessionToken({
      creatorId,
      issuedAt,
      expiresAt: issuedAt + config.sessionTtlMs,
      secret: config.sessionSecret,
    });
    const cookieStore = await cookies();
    cookieStore.set(CREATOR_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: Math.floor(config.sessionTtlMs / 1000),
    });
    redirect("/new");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    throw error;
  }
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.set(CREATOR_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  redirect("/login");
}

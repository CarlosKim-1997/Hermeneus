"use server";

import { cookies } from "next/headers";
import { CREATOR_SESSION_COOKIE_NAME } from "../creator/dev-session.js";

export async function clearCreatorSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(CREATOR_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

import type { NextRequest } from "next/server";
import { getHermeneusAuth } from "../../../../auth/hermeneus-auth.js";

export const runtime = "nodejs";

function notConfigured() {
  return new Response("Authentication is not configured.", { status: 404 });
}

export async function GET(request: NextRequest) {
  const auth = getHermeneusAuth();
  if (!auth) return notConfigured();
  return auth.handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const auth = getHermeneusAuth();
  if (!auth) return notConfigured();
  return auth.handlers.POST(request);
}

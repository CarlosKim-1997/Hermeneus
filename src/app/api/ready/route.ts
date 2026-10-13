import { isApplicationReady } from "../../../application/readiness.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const ready = await isApplicationReady();
  return Response.json({ status: ready ? "ready" : "unavailable" }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "private, no-store", ...(ready ? {} : { "Retry-After": "5" }) },
  });
}

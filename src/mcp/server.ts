import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { receiverSubmissionSchema } from "../portable/receiver-packet.js";
import { scopes } from "./contracts.js";
import type { ScopedService } from "./scoped-handoff.js";
import { REVIEW_URI, scopedWidgetHtml } from "./widget.js";

const ref = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const fail = () => ({ isError: true, content: [{ type: "text" as const, text: "HANDOFF_ACCESS_UNAVAILABLE" }] });
const schemes = (required: string[]) => ({ securitySchemes: [{ type: "oauth2", scopes: required }] });

export function createScopedMcpServer(service: ScopedService, accessToken: string) {
  const server = new McpServer({ name: "hermeneus-scoped-handoff-local", version: "0.1.0" }, {
    instructions: "Use only an explicitly delegated contextRef. Preserve exact Published statements and OPEN/UNKNOWN. Return only the user's explicitly selected answer, never history or credentials. Inspection is structural only, not semantic verification. The widget result is authoritative for its inspection; do not describe its earlier AWAITING state as the current result.", maxToolInputElements: 100,
  });
  server.registerResource("scoped-handoff-review", REVIEW_URI, { mimeType: "text/html;profile=mcp-app" }, async () => ({ contents: [{
    uri: REVIEW_URI, mimeType: "text/html;profile=mcp-app", text: scopedWidgetHtml(),
    _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } } },
  }] }));
  server.registerTool("get_handoff_packet", {
    title: "Read this delegated Handoff", description: "Read only the exact delegated Published version. contextRef alone grants no access. No drafts, source or other shares.",
    inputSchema: z.object({ contextRef: ref }).strict(), annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: schemes([scopes.read]),
  }, async ({ contextRef }) => {
    try { const packet = await service.getPacket(accessToken, contextRef); return { structuredContent: { packet }, content: [{ type: "text" as const, text: JSON.stringify(packet) }] }; }
    catch { return fail(); }
  });
  server.registerTool("review_handoff_answer", {
    title: "Review the exact selected answer", description: "Display only the explicitly selected answer for this delegation in a widget. This prepares inspection and is not a verification result or evidence of user consent.",
    inputSchema: z.object({ contextRef: ref, submission: receiverSubmissionSchema }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: { ...schemes([scopes.review]), ui: { resourceUri: REVIEW_URI }, "openai/outputTemplate": REVIEW_URI },
  }, async ({ contextRef, submission }) => {
    try { const review = await service.prepareReview(accessToken, contextRef, submission); return {
      structuredContent: { status: "AWAITING_ORIGINAL_REVIEW", version: review.packet.version },
      content: [{ type: "text" as const, text: "위젯에서 원문을 확인하고 검사하세요. 이 메시지는 준비 시점의 상태이며, 이후 검사 결과는 위젯 안에 표시됩니다." }],
      _meta: { hermeneusScopedReview: review },
    }; } catch { return fail(); }
  });
  server.registerTool("inspect_handoff_review", {
    title: "Inspect the confirmed widget original", description: "Widget-only one-use structure/version inspection. Rechecks OAuth connection and original Share. No paid provider and no ALIGNED result.",
    inputSchema: z.object({ contextRef: ref, submission: receiverSubmissionSchema, reviewTicket: z.string().max(4096) }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: { ...schemes([scopes.review]), ui: { visibility: ["app"] }, "openai/widgetAccessible": true },
  }, async ({ contextRef, submission, reviewTicket }) => {
    try { const r = await service.inspectReview(accessToken, contextRef, submission, reviewTicket); return {
      structuredContent: r, content: [{ type: "text" as const, text: "구조·고정 버전 확인 완료. INDETERMINATE · 의미 검증 미실행." }],
    }; } catch { return fail(); }
  });
  return server;
}

/** Not registered in Next or the public synthetic host. Disabled unless an explicit composition enables it. */
export function createScopedMcpHandler(options: { service: ScopedService; resource: string; issuer: string; enabled?: boolean }) {
  if (options.service.identity.resource !== options.resource || options.service.identity.issuer !== options.issuer) throw new Error("MCP_CONFIGURATION_INVALID");
  const resource = new URL(options.resource), headers = { "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" };
  const reply = (status: number, message: string) => Response.json({ error: message }, { status, headers });
  return async (request: Request) => {
    if (!options.enabled) return reply(404, "NOT_FOUND");
    const url = new URL(request.url);
    if (url.origin !== resource.origin || url.search) return reply(404, "NOT_FOUND");
    if (url.pathname === "/.well-known/oauth-protected-resource" && request.method === "GET") return Response.json({
      resource: options.resource, authorization_servers: [options.issuer], scopes_supported: [scopes.read, scopes.review],
    }, { headers });
    if (url.pathname !== resource.pathname) return reply(404, "NOT_FOUND");
    const auth = request.headers.get("authorization"), token = auth?.match(/^Bearer ([^\s]+)$/)?.[1];
    try { if (!token) throw Error(); await options.service.authenticate(token); } catch {
      const r = reply(401, "AUTHENTICATION_REQUIRED");
      r.headers.set("www-authenticate", 'Bearer resource_metadata="' + resource.origin + '/.well-known/oauth-protected-resource", scope="handoff:read handoff:review"'); return r;
    }
    if (request.method !== "POST") return reply(405, "POST_ONLY_STATELESS_MCP");
    const origin = request.headers.get("origin");
    if (origin && origin !== resource.origin && origin !== "https://chatgpt.com") return reply(403, "ORIGIN_REJECTED");
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 90_000 });
    const server = createScopedMcpServer(options.service, token!);
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      if (response.status >= 400) return reply(response.status, "MCP_REQUEST_REJECTED");
      for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      return response;
    } catch { return reply(500, "MCP_UNAVAILABLE"); } finally { await server.close(); }
  };
}

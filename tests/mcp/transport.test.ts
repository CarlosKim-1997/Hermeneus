import { describe,it,expect } from "vitest";
import { createScopedMcpHandler } from "../../src/mcp/server.js";
import { fixture,grant,submission,fixtureIssuer,fixtureResource } from "./helpers.js";
import { connected } from "./client.js";
describe("protected MCP SDK transport (test OAuth verifier, not an OAuth rollout)",()=>{
  it("is disabled by default and rejects mismatched discovery configuration",async()=>{
    const f=fixture();expect((await createScopedMcpHandler({service:f.service,issuer:fixtureIssuer,resource:fixtureResource})(new Request(fixtureResource))).status).toBe(404);
    expect(()=>createScopedMcpHandler({service:f.service,issuer:"https://other.invalid",resource:fixtureResource})).toThrow();
  });
  it("advertises pinned resource metadata and issues a credential-free 401 challenge",async()=>{
    const f=fixture(),handler=createScopedMcpHandler({service:f.service,issuer:fixtureIssuer,resource:fixtureResource,enabled:true});
    const metadata=await handler(new Request(new URL("/.well-known/oauth-protected-resource",fixtureResource)));expect((await metadata.json()).resource).toBe(fixtureResource);
    const denied=await handler(new Request(fixtureResource,{method:"POST",body:"{}"}));expect(denied.status).toBe(401);expect(denied.headers.get("www-authenticate")).toContain("resource_metadata");
    expect(denied.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects query credentials, unexpected origins and a Creator cookie in place of OAuth",async()=>{
    const f=fixture(),handler=createScopedMcpHandler({service:f.service,issuer:fixtureIssuer,resource:fixtureResource,enabled:true});
    expect((await handler(new Request(fixtureResource+"?answer=bad"))).status).toBe(404);
    expect((await handler(new Request(fixtureResource,{method:"POST",headers:{authorization:"Bearer "+f.token,origin:"https://attacker.invalid"},body:"{}"}))).status).toBe(403);
    expect((await handler(new Request(fixtureResource,{method:"POST",headers:{cookie:"creator_session=some-cookie"},body:"{}"}))).status).toBe(401);
  });
  it("performs actual SDK open, selected review and one-use widget inspection",async()=>{
    const {f,client}=await connected();try{
      const g=await grant(f),tools=await client.listTools();expect(tools.tools.map(t=>t.name)).toEqual(["get_handoff_packet","review_handoff_answer","inspect_handoff_review"]);
      const opened=await client.callTool({name:"get_handoff_packet",arguments:g});expect(opened.isError).toBe(true); // extra version argument is rejected
      const packet=await client.callTool({name:"get_handoff_packet",arguments:{contextRef:g.contextRef}});expect((packet.structuredContent as any).packet.version).toBe(1);
      const review=await client.callTool({name:"review_handoff_answer",arguments:{contextRef:g.contextRef,submission:submission()}});
      expect(JSON.stringify(review.structuredContent)).not.toContain("answerText");expect(JSON.stringify(review.content)).not.toContain("reviewTicket");
      const data=(review._meta as any).hermeneusScopedReview;
      const result=await client.callTool({name:"inspect_handoff_review",arguments:{contextRef:g.contextRef,submission:data.submission,reviewTicket:data.reviewTicket}});
      expect((result.structuredContent as any).result.verdict).toBe("INDETERMINATE");
      expect((await client.callTool({name:"inspect_handoff_review",arguments:{contextRef:g.contextRef,submission:data.submission,reviewTicket:data.reviewTicket}})).isError).toBe(true);
    }finally{await client.close();}
  });
  it("requires fresh connection and parent authorization for follow-up calls on an existing client",async()=>{
    const {f,client}=await connected();try{
      const g=await grant(f);f.packets.delete("cap-a");
      const denied=await client.callTool({name:"get_handoff_packet",arguments:{contextRef:g.contextRef}});expect(denied.isError).toBe(true);expect(JSON.stringify(denied)).not.toContain("금요일");
      f.connections.delete(f.token);await expect(client.callTool({name:"get_handoff_packet",arguments:{contextRef:g.contextRef}})).rejects.toThrow();
    }finally{await client.close();}
  });
});

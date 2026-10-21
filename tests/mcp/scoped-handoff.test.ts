import { describe,it,expect } from "vitest";
import { fixture,grant,submission,fixtureResource } from "./helpers.js";
import { createScopedHandoff } from "../../src/mcp/scoped-handoff.js";
import { randomBytes } from "node:crypto";

describe("scoped Handoff / ephemeral widget contract",()=>{
  it("requires a verified connection plus same-browser Share approval; references alone are useless",async()=>{
    const f=fixture(),g=await grant(f);expect(await f.service.getPacket(f.token,g.contextRef)).toEqual(f.packets.get("cap-a"));
    await expect(f.service.getPacket("",g.contextRef)).rejects.toThrow();await expect(f.service.getPacket("fixture-token-b",g.contextRef)).rejects.toThrow();
    await expect(f.service.getPacket(f.token,"internal-handoff-id")).rejects.toThrow();
  });
  it.each(["issuer","resource","subject","clientId","sessionId","issuedAt","expiresAt","scopes"])("rejects invalid verified-connection %s",async field=>{
    const f=fixture(),c=f.connections.get(f.token)!;(c as any)[field]=field==="issuedAt"?f.time()+1:field==="expiresAt"?NaN:field==="scopes"?[]:"";
    await expect(f.service.createBrowserBinding(f.token,"fixture-share-a")).rejects.toThrow("HANDOFF_ACCESS_UNAVAILABLE");
  });
  it("rejects tokens exceeding the absolute one-hour limit and exact expiry",async()=>{
    const f=fixture();f.connections.get(f.token)!.expiresAt++;await expect(grant(f)).rejects.toThrow();
    f.connections.get(f.token)!.expiresAt--;f.advance(3_600_000);await expect(grant(f)).rejects.toThrow();
  });
  it.each(["origin","cookieSecret","csrfToken","confirmed"])("rejects invalid web approval %s",async field=>{
    const f=fixture(),b=await f.service.createBrowserBinding(f.token,"fixture-share-a"),proof={...b,origin:new URL(fixtureResource).origin,confirmed:true};
    (proof as any)[field]=field==="confirmed"?false:"attacker";
    await expect(f.service.delegate(f.token,"fixture-share-a",proof)).rejects.toThrow();
  });
  it("burns browser approval once, binds it to its connection and expires it after 60s",async()=>{
    const f=fixture(),b=await f.service.createBrowserBinding(f.token,"fixture-share-a"),p={...b,origin:new URL(fixtureResource).origin,confirmed:true};
    await expect(f.service.delegate("fixture-token-b","fixture-share-a",p)).rejects.toThrow();
    await f.service.delegate(f.token,"fixture-share-a",p);await expect(f.service.delegate(f.token,"fixture-share-a",p)).rejects.toThrow();
    const q=await f.service.createBrowserBinding(f.token,"fixture-share-a");f.advance(60_000);await expect(f.service.delegate(f.token,"fixture-share-a",{...p,...q})).rejects.toThrow();
  });
  it("binds the browser's approval to the specifically selected parent Share",async()=>{
    const f=fixture(),b=await f.service.createBrowserBinding(f.token,"fixture-share-a"),p={...b,origin:new URL(fixtureResource).origin,confirmed:true};
    await expect(f.service.delegate(f.token,"fixture-share-b",p)).rejects.toThrow();
    const g=await f.service.delegate(f.token,"fixture-share-a",p);expect((await f.service.getPacket(f.token,g.contextRef)).version).toBe(1);
  });
  it("separates the configured web origin from the MCP audience without trusting request origins",async()=>{
    const f=fixture(),webOrigin="https://web.fixture.invalid";
    const service=createScopedHandoff({...f.service.identity,webOrigin,signingKey:randomBytes(32),verifier:f.verifier,parents:f.parents,store:f.store,now:f.time});
    const b=await service.createBrowserBinding(f.token,"fixture-share-a"),p={...b,origin:new URL(fixtureResource).origin,confirmed:true};
    await expect(service.delegate(f.token,"fixture-share-a",p)).rejects.toThrow();
    expect(await service.delegate(f.token,"fixture-share-a",{...p,origin:webOrigin})).toHaveProperty("contextRef");
  });
  it("does not inherit an older grant when a connection's token lifetime is reissued",async()=>{
    const f=fixture(),g=await grant(f);f.advance(2);const c=f.connections.get(f.token)!;c.issuedAt++;c.expiresAt++;
    await expect(f.service.getPacket(f.token,g.contextRef)).rejects.toThrow();
  });
  it("pins independent shares/versions and refuses cross-submission, raw bearer credentials and extra fields",async()=>{
    const f=fixture(),a=await grant(f),b=await grant(f,"fixture-share-b");const pa=await f.service.getPacket(f.token,a.contextRef),pb=await f.service.getPacket(f.token,b.contextRef);
    expect(pa.version).toBe(1);expect(pb.version).toBe(2);expect(pa.publicationRef).not.toBe(pb.publicationRef);
    await expect(f.service.prepareReview(f.token,a.contextRef,submission(pb))).rejects.toThrow();
    await expect(f.service.prepareReview(f.token,a.contextRef,{...submission(pa),consent:true})).rejects.toThrow();
    await expect(f.service.prepareReview(f.token,a.contextRef,{...submission(pa),shareBearer:"fixture-share-a"})).rejects.toThrow();
  });
  it("inspects exact original once, never returns ALIGNED or retains body/digest/consent metadata",async()=>{
    const f=fixture(),g=await grant(f),input=submission(),review=await f.service.prepareReview(f.token,g.contextRef,input);
    const output=await f.service.inspectReview(f.token,g.contextRef,input,review.reviewTicket);
    expect(output.result.verdict).toBe("INDETERMINATE");expect(output.semanticProvider).toBe("NOT_CONNECTED");
    await expect(f.service.inspectReview(f.token,g.contextRef,input,review.reviewTicket)).rejects.toThrow();
    const metadata=JSON.stringify({a:[...f.store.approvals],g:[...f.store.grants],t:[...f.store.tickets]});
    for(const forbidden of [input.answerText,review.submissionDigest,review.reviewTicket,f.token,"fixture-share-a","answerText","question","consent"])expect(metadata).not.toContain(forbidden);
  });
  it("rejects changed original, changed signed ticket and a ticket from another connection",async()=>{
    const f=fixture(),g=await grant(f),r=await f.service.prepareReview(f.token,g.contextRef,submission());
    await expect(f.service.inspectReview(f.token,g.contextRef,submission(undefined,"changed"),r.reviewTicket)).rejects.toThrow();
    await expect(f.service.inspectReview(f.token,g.contextRef,submission(),r.reviewTicket+"a")).rejects.toThrow();
    await expect(f.service.inspectReview("fixture-token-b",g.contextRef,submission(),r.reviewTicket)).rejects.toThrow();
  });
  it("has one winner for concurrent inspection and does not recover/replay a consumed ticket",async()=>{
    const f=fixture(),g=await grant(f),r=await f.service.prepareReview(f.token,g.contextRef,submission());
    const results=await Promise.allSettled([1,2,3].map(()=>f.service.inspectReview(f.token,g.contextRef,submission(),r.reviewTicket)));
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  });
  it("expires tickets at 60s and grants at 30m; reissuing a fresh ticket cannot extend the grant",async()=>{
    const f=fixture(),g=await grant(f),r=await f.service.prepareReview(f.token,g.contextRef,submission());f.advance(60_000);
    await expect(f.service.inspectReview(f.token,g.contextRef,submission(),r.reviewTicket)).rejects.toThrow();
    f.advance(1_739_999);const last=await f.service.prepareReview(f.token,g.contextRef,submission());expect(last.expiresAt).toBe(f.time()+1);
    f.advance(1);await expect(f.service.getPacket(f.token,g.contextRef)).rejects.toThrow();await expect(f.service.inspectReview(f.token,g.contextRef,submission(),last.reviewTicket)).rejects.toThrow();
  });
  it.each(["parent","connection","grant"])("rejects %s revocation while parent lookup is in flight",async kind=>{
    const f=fixture(),g=await grant(f),r=await f.service.prepareReview(f.token,g.contextRef,submission()),original=f.parents.byId;
    f.parents.byId=async id=>{const p=await original(id);if(kind==="parent")return undefined;if(kind==="connection")f.connections.delete(f.token);else f.store.grants.get(g.contextRef)!.revoked=true;return p;};
    await expect(f.service.inspectReview(f.token,g.contextRef,submission(),r.reviewTicket)).rejects.toThrow();
  });
  it("revoking one delegation preserves the original Share and unrelated contexts",async()=>{
    const f=fixture(),a=await grant(f),b=await grant(f,"fixture-share-b");await f.service.revoke(f.token,a.contextRef);
    await expect(f.service.getPacket(f.token,a.contextRef)).rejects.toThrow();expect(await f.parents.byBearer("fixture-share-a")).toBeDefined();
    expect((await f.service.getPacket(f.token,b.contextRef)).version).toBe(2);
  });
  it("cleans missing-parent metadata and expires metadata without bodies",async()=>{
    const f=fixture(),a=await grant(f),b=await grant(f,"fixture-share-b");await f.service.prepareReview(f.token,a.contextRef,submission());f.packets.delete("cap-a");
    await expect(f.service.getPacket(f.token,a.contextRef)).rejects.toThrow();expect(f.store.grants.has(a.contextRef)).toBe(false);
    expect(f.store.grants.has(b.contextRef)).toBe(true);f.advance(3_600_000);await f.store.cleanup(f.time());
    expect(f.store.grants.size+f.store.tickets.size+f.store.approvals.size).toBe(0);
  });
});

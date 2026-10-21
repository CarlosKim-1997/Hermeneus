import { randomBytes } from "node:crypto";
import type { Approval, Grant, MetadataStore, ParentPort, Ticket, VerifiedConnection } from "../../src/mcp/contracts.js";
import { createScopedHandoff } from "../../src/mcp/scoped-handoff.js";
import { buildReceiverPacket, type ReceiverPacket } from "../../src/portable/receiver-packet.js";

/** Disposable test double, never a production server/store or OAuth issuer. */
export class TestMetadata implements MetadataStore {
  approvals = new Map<string, Approval & { used?: boolean }>(); grants = new Map<string, Grant>(); tickets = new Map<string, Ticket & { used?: boolean }>();
  async insertApproval(a: Approval) { this.approvals.set(a.hash,structuredClone(a)); }
  async consumeApproval(hash: string, connectionHash: string, now: number) {
    const a = this.approvals.get(hash); if(!a || a.used || a.expiresAt<=now || a.connectionHash!==connectionHash)return false;
    a.used=true;return true;
  }
  async insertGrant(g: Grant) { this.grants.set(g.ref,structuredClone(g)); }
  async getGrant(ref: string) { const g=this.grants.get(ref);return g?structuredClone(g):undefined; }
  async revokeGrant(ref: string, hash: string) { const g=this.grants.get(ref);if(g?.connectionHash===hash)g.revoked=true; }
  async insertTicket(t: Ticket) { this.tickets.set(t.hash,structuredClone(t)); }
  async consumeTicket(hash: string, ref: string, now: number) {
    const t=this.tickets.get(hash);if(!t||t.used||t.grantRef!==ref||t.expiresAt<=now)return false;
    t.used=true;return true;
  }
  async deleteParent(id: string) { for(const [h,a] of this.approvals)if(a.capabilityId===id)this.approvals.delete(h);for(const [ref,g] of this.grants)if(g.capabilityId===id){this.grants.delete(ref);for(const [h,t] of this.tickets)if(t.grantRef===ref)this.tickets.delete(h);} }
  async cleanup(now: number) {
    for(const [h,a] of this.approvals)if(a.expiresAt<=now)this.approvals.delete(h);
    for(const [h,t] of this.tickets)if(t.expiresAt<=now)this.tickets.delete(h);
    for(const [r,g] of this.grants)if(g.expiresAt<=now||g.revoked){this.grants.delete(r);for(const [h,t] of this.tickets)if(t.grantRef===r)this.tickets.delete(h);}
  }
}
export const fixtureResource="https://hermeneus.fixture.invalid/mcp",fixtureIssuer="https://issuer.fixture.invalid";
export function makePacket(id="synthetic-a",version=1) {
  return buildReceiverPacket({handoffId:id,version,publishedAt:"2026-10-21T00:00:00.000Z",items:[
    {id:"item-a",type:"CONFIRMED",priority:"CORE",statement:"금요일까지 웹 초안을 준비합니다."},
    {id:"item-b",type:"OPEN",priority:"IMPORTANT",statement:"모바일 담당자는 미정입니다."},
  ]});
}
export const submission=(packet:ReceiverPacket=makePacket(),answerText="웹 초안입니다. [HI-001]\n모바일은 미정입니다. [HI-002]")=>({
  protocol:"hermeneus.receiver-submission/v0" as const,publicationRef:packet.publicationRef,packetDigest:packet.canonicalDigest,answerText,
});
export function fixture() {
  let time=Date.now();const issued=time,store=new TestMetadata(),packets=new Map([["cap-a",makePacket()],["cap-b",makePacket("synthetic-b",2)]]);
  const connection=(id:string):VerifiedConnection=>({issuer:fixtureIssuer,resource:fixtureResource,clientId:"fixture-client",subject:id,sessionId:id,
    issuedAt:issued,expiresAt:issued+3_600_000,scopes:["handoff:read","handoff:review"]});
  const connections=new Map([["fixture-token-a",connection("a")],["fixture-token-b",connection("b")]]);
  const verifier={async verify(token:string){const c=connections.get(token);if(!c)throw Error("denied");return structuredClone(c);}};
  const parents:ParentPort={byBearer:async raw=>{const id=raw==="fixture-share-a"?"cap-a":raw==="fixture-share-b"?"cap-b":"";const packet=packets.get(id);return packet?{capabilityId:id,packet}:undefined;},
    byId:async id=>{const packet=packets.get(id);return packet?{capabilityId:id,packet}:undefined;}};
  const service=createScopedHandoff({issuer:fixtureIssuer,resource:fixtureResource,signingKey:randomBytes(32),verifier,parents,store,now:()=>time});
  return {service,store,parents,verifier,connections,packets,token:"fixture-token-a",advance:(ms:number)=>{time+=ms;},time:()=>time};
}
export async function grant(f:ReturnType<typeof fixture>,raw="fixture-share-a",token=f.token) {
  const b=await f.service.createBrowserBinding(token,raw);
  return f.service.delegate(token,raw,{origin:new URL(fixtureResource).origin,cookieSecret:b.cookieSecret,csrfToken:b.csrfToken,confirmed:true});
}

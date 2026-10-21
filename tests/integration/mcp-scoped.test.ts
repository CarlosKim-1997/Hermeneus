import { beforeAll,afterAll,beforeEach,describe,it,expect } from "vitest";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { PostgresShareParents,PostgresMcpMetadata } from "../../src/mcp/postgres.js";
import { createScopedHandoff } from "../../src/mcp/scoped-handoff.js";
import { issueShareCapability } from "../../src/application/use-cases/share-capability.js";
import { fixture,submission,fixtureIssuer,fixtureResource } from "../mcp/helpers.js";

// Fail closed, including when this test is accidentally included in a general target-DB run.
const url=process.env.TEST_DATABASE_URL;
if(!url||process.env.HERMENEUS_MCP_DISPOSABLE!=="1")throw Error("Disposable MCP database required");
const parsed=new URL(url);
if(!/^mcp-db-[a-f0-9]{32}$/.test(parsed.hostname)||parsed.pathname!=="/hermeneus_mcp_local_test"||parsed.username!=="mcp_fixture")throw Error("Target database forbidden");
const pool=new pg.Pool({connectionString:url,max:12}),repos=createPostgresRepositories(pool);
beforeAll(async()=>{
  await pool.query("CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated");
  await pool.query(await readFile("src/mcp/postgres-schema.sql","utf8"));
});
afterAll(async()=>{await pool.end();});
beforeEach(async()=>{await pool.query("TRUNCATE creators CASCADE; TRUNCATE mcp_web_approvals");});
async function seeded(imported=false) {
  const f=fixture(),now=new Date(f.time()).toISOString();
  await repos.creators.ensure({id:"creator_mcp_a",createdAt:now});
  await repos.creators.ensure({id:"creator_mcp_b",createdAt:now});
  const items=[{id:"item-a",type:"CONFIRMED" as const,priority:"CORE" as const,createdBy:"CREATOR" as const,sources:[],statement:"금요일까지 웹 초안을 준비합니다."}];
  if(imported)await repos.importHandoff.importHandoffAtomic({ownerCreatorId:"creator_mcp_a",handoffId:"hd_mcp_a",draft:{id:"hd_mcp_a",items},conversation:{id:"conv_mcp",source:{provider:"generic-text",importedAt:now},messages:[{id:"m1",role:"creator",content:"PRIVATE SYNTHETIC SOURCE",source:{provider:"generic-text"}}]}});
  else await repos.bootstrapHandoff.createAtomic({ownerCreatorId:"creator_mcp_a",handoffId:"hd_mcp_a",requestKey:"mcp-synthetic-key-a",displayTitle:"PRIVATE TITLE",draft:{id:"hd_mcp_a",items}});
  await repos.bootstrapHandoff.createAtomic({ownerCreatorId:"creator_mcp_b",handoffId:"hd_mcp_b",requestKey:"mcp-synthetic-key-b",draft:{id:"hd_mcp_b",items}});
  await repos.published.publish("hd_mcp_a",now,1);await repos.published.publish("hd_mcp_b",now,1);
  const a=await issueShareCapability(repos,{handoffId:"hd_mcp_a",version:1}),b=await issueShareCapability(repos,{handoffId:"hd_mcp_b",version:1});
  const parents=new PostgresShareParents(pool),store=new PostgresMcpMetadata(pool),key=randomBytes(32);
  const makeService=()=>createScopedHandoff({issuer:fixtureIssuer,resource:fixtureResource,signingKey:key,verifier:f.verifier,parents,store,now:f.time});
  const service=makeService();
  const delegate=async(raw:string)=>{const binding=await service.createBrowserBinding(f.token,raw);return service.delegate(f.token,raw,{...binding,origin:new URL(fixtureResource).origin,confirmed:true});};
  const g=await delegate(a.rawToken),gb=await delegate(b.rawToken),packet=await service.getPacket(f.token,g.contextRef);
  return {...f,service,parents,store,makeService,delegate,a,b,g,gb,packet};
}
describe("real repository / scoped MCP security metadata on disposable PostgreSQL",()=>{
  it("reads the actual pinned Published version without private title, root ID, source or bearer",async()=>{
    const f=await seeded(),p=await f.service.getPacket(f.token,f.g.contextRef);
    expect(p.items[0]!.statement).toBe("금요일까지 웹 초안을 준비합니다.");
    const exposed=JSON.stringify(p);for(const secret of ["PRIVATE TITLE","hd_mcp_a",f.a.rawToken,"creator_mcp_a","sources"])expect(exposed).not.toContain(secret);
    const draft=(await repos.drafts.get("hd_mcp_a"))!;draft.items[0]!.statement="다음 주로 변경합니다.";
    await repos.drafts.save(draft,1);await repos.published.publish("hd_mcp_a",new Date(f.time()).toISOString(),2);
    expect(await f.service.getPacket(f.token,f.g.contextRef)).toEqual(p);
  });
  it("retains Canon after source erasure and never reconstructs provenance",async()=>{
    const f=await seeded(true),before=await f.service.getPacket(f.token,f.g.contextRef);
    await repos.erasure.eraseSource("hd_mcp_a","creator_mcp_a",new Date(f.time()).toISOString());
    expect(await f.service.getPacket(f.token,f.g.contextRef)).toEqual(before);
    expect(JSON.stringify(before)).not.toContain("PRIVATE SYNTHETIC SOURCE");
  });
  it("separates two capabilities on the same version and two unrelated Handoffs",async()=>{
    const f=await seeded(),same=await issueShareCapability(repos,{handoffId:"hd_mcp_a",version:1}),g2=await f.delegate(same.rawToken);
    await repos.shareCapabilities.revoke(f.a.metadata.id,new Date(f.time()).toISOString());
    await expect(f.service.getPacket(f.token,f.g.contextRef)).rejects.toThrow();
    expect(await f.service.getPacket(f.token,g2.contextRef)).toEqual(f.packet);
    expect((await f.service.getPacket(f.token,f.gb.contextRef)).publicationRef).not.toBe(f.packet.publicationRef);
  });
  it("has one inspection winner across separate service instances/workers",async()=>{
    const f=await seeded(),s=submission(f.packet),r=await f.service.prepareReview(f.token,f.g.contextRef,s);
    const results=await Promise.allSettled(Array.from({length:8},()=>f.makeService().inspectReview(f.token,f.g.contextRef,s,r.reviewTicket)));
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  });
  it("atomically blocks a parent revoked between the service check and ticket consumption",async()=>{
    const f=await seeded(),s=submission(f.packet),r=await f.service.prepareReview(f.token,f.g.contextRef,s),consume=f.store.consumeTicket.bind(f.store);
    f.store.consumeTicket=async(...args)=>{await repos.shareCapabilities.revoke(f.a.metadata.id,new Date(f.time()).toISOString());return consume(...args);};
    await expect(f.service.inspectReview(f.token,f.g.contextRef,s,r.reviewTicket)).rejects.toThrow();
  });
  it("blocks revocation during the final grant read, after the packet has already been read",async()=>{
    const f=await seeded(),read=f.store.getGrant.bind(f.store);let reads=0;
    f.store.getGrant=async ref=>{if(++reads===2)await repos.shareCapabilities.revoke(f.a.metadata.id,new Date(f.time()).toISOString());return read(ref);};
    await expect(f.service.getPacket(f.token,f.g.contextRef)).rejects.toThrow();
  });
  it("cascades Handoff erasure to only its grants/tickets",async()=>{
    const f=await seeded(),s=submission(f.packet),r=await f.service.prepareReview(f.token,f.g.contextRef,s);
    await f.service.createBrowserBinding(f.token,f.a.rawToken);
    await repos.erasure.deleteHandoff("hd_mcp_a","creator_mcp_a");
    expect((await pool.query("SELECT 1 FROM mcp_delegations WHERE context_ref=$1",[f.g.contextRef])).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM mcp_widget_tickets")).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM mcp_web_approvals WHERE capability_id=$1",[f.a.metadata.id])).rowCount).toBe(0);
    await expect(f.service.inspectReview(f.token,f.g.contextRef,s,r.reviewTicket)).rejects.toThrow();
    expect(await f.service.getPacket(f.token,f.gb.contextRef)).toBeDefined();
  });
  it("denies a Creator entering erasure before physical deletion and cleans mappings on completion",async()=>{
    const f=await seeded(),s=submission(f.packet),r=await f.service.prepareReview(f.token,f.g.contextRef,s);
    await repos.accountErasure.enterErasingPhase("creator_mcp_a");
    await expect(f.service.inspectReview(f.token,f.g.contextRef,s,r.reviewTicket)).rejects.toThrow();
    await repos.accountErasure.completeAccountErasure("creator_mcp_a");
    expect((await pool.query("SELECT 1 FROM mcp_delegations WHERE context_ref=$1",[f.g.contextRef])).rowCount).toBe(0);
    expect(await f.service.getPacket(f.token,f.gb.contextRef)).toBeDefined();
  });
  it("stores no body, submission digest or raw credentials, and revokes Data API grants despite permissive defaults",async()=>{
    const f=await seeded(),s=submission(f.packet,"UNIQUE EPHEMERAL ANSWER [HI-001]"),r=await f.service.prepareReview(f.token,f.g.contextRef,s);
    const rows=await pool.query("SELECT row_to_json(t)::text AS data FROM mcp_widget_tickets t UNION ALL SELECT row_to_json(d)::text FROM mcp_delegations d UNION ALL SELECT row_to_json(a)::text FROM mcp_web_approvals a");
    const stored=JSON.stringify(rows.rows);for(const secret of [s.answerText,r.submissionDigest,r.reviewTicket,f.a.rawToken,f.token,"answerText","question","consent"])expect(stored).not.toContain(secret);
    for(const role of ["anon","authenticated"])for(const table of ["mcp_widget_tickets","mcp_delegations","mcp_web_approvals"])
      expect((await pool.query("SELECT has_table_privilege($1,$2,'SELECT') AS allowed",[role,table])).rows[0].allowed).toBe(false);
    f.advance(3_600_000);await f.store.cleanup(f.time());
    expect((await pool.query("SELECT 1 FROM mcp_delegations UNION ALL SELECT 1 FROM mcp_widget_tickets UNION ALL SELECT 1 FROM mcp_web_approvals")).rowCount).toBe(0);
  });
});

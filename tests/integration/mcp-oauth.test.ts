import { beforeAll,afterAll,beforeEach,describe,it,expect } from "vitest";
import { readFile } from "node:fs/promises";
import { randomBytes,createHash } from "node:crypto";
import { exportJWK,generateKeyPair } from "jose";
import pg from "pg";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { issueShareCapability } from "../../src/application/use-cases/share-capability.js";
import { PostgresShareParents } from "../../src/mcp/postgres.js";
import { PostgresOAuthStore,PostgresOAuthMcpMetadata } from "../../src/mcp/oauth-postgres.js";
import { createAnonymousOAuth,opaque } from "../../src/mcp/oauth.js";
import { oauthClient,oauthResource,serveOAuth } from "../mcp/oauth-helpers.js";
import { fixtureIssuer,submission } from "../mcp/helpers.js";

const url=process.env.TEST_DATABASE_URL;
if(!url||process.env.HERMENEUS_MCP_DISPOSABLE!=="1")throw Error("Disposable OAuth database required");
const parsed=new URL(url);
if(!/^mcp-db-[a-f0-9]{32}$/.test(parsed.hostname)||parsed.pathname!=="/hermeneus_mcp_local_test"||parsed.username!=="mcp_fixture")throw Error("Target database forbidden");
const pool=new pg.Pool({connectionString:url,max:16}),rolePool=new pg.Pool({connectionString:url,max:16,options:"-c role=hermeneus_mcp_alpha"}),repos=createPostgresRepositories(pool),servers:Array<Awaited<ReturnType<typeof serveOAuth>>>=[];
beforeAll(async()=>{expect((await rolePool.query("SELECT current_user AS role")).rows[0].role).toBe("hermeneus_mcp_alpha");});
beforeEach(async()=>{await pool.query("TRUNCATE creators CASCADE; TRUNCATE mcp_oauth_transactions; TRUNCATE mcp_oauth_sessions CASCADE; TRUNCATE mcp_web_approvals");});
afterAll(async()=>{for(const s of servers)await s.close();await rolePool.end();await pool.end();});
async function seeded(){
  let time=Date.now();const now=()=>time;
  await repos.creators.ensure({id:"creator_oauth_a",createdAt:new Date(time).toISOString()});
  await repos.bootstrapHandoff.createAtomic({ownerCreatorId:"creator_oauth_a",handoffId:"hd_oauth_a",requestKey:"oauth-synthetic-key-a",displayTitle:"PRIVATE NAVIGATION",draft:{id:"hd_oauth_a",items:[{id:"a",type:"CONFIRMED",priority:"CORE",createdBy:"CREATOR",sources:[],statement:"금요일까지 웹 초안을 준비합니다."}]}});
  await repos.published.publish("hd_oauth_a",new Date(time).toISOString(),1);
  const share=await issueShareCapability(repos,{handoffId:"hd_oauth_a",version:1}),pair=await generateKeyPair("ES256"),jwk={...await exportJWK(pair.publicKey),kid:"oauth-pg-local"},inspectionKey=randomBytes(32);
  const store=new PostgresOAuthStore(rolePool),metadata=new PostgresOAuthMcpMetadata(rolePool,now),parents=new PostgresShareParents(rolePool);
  const make=()=>createAnonymousOAuth({issuer:fixtureIssuer,resource:oauthResource,clients:[oauthClient],signingKey:pair.privateKey,keyId:jwk.kid,publicJwk:jwk,inspectionKey,store,metadata,parents,now});
  const auth=await make(),http=await serveOAuth(auth);servers.push(http);
  async function issue(){
    const verifier=opaque(),b=await auth.begin(oauthClient.id,{redirectUri:oauthClient.redirectUris[0]!,state:opaque(),codeChallenge:createHash("sha256").update(verifier).digest("base64url"),resource:new URL(oauthResource),scopes:["handoff:read","handoff:review"]});
    const g=await auth.approve({...b,confirmed:true,shareBearer:share.rawToken});if(!g.sessionId)throw Error("No fixture approval");
    const code=new URL(g.redirect).searchParams.get("code")!,body=new URLSearchParams({client_id:oauthClient.id,grant_type:"authorization_code",code,code_verifier:verifier,redirect_uri:oauthClient.redirectUris[0]!,resource:oauthResource});
    const exchange=()=>http.request("/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
    return {...g,code,body,exchange};
  }
  return {auth,make,http,store,metadata,parents,share,issue,now,advance:(ms:number)=>{time+=ms;}};
}
describe("OAuth security metadata on disposable PostgreSQL",()=>{
  it("uses the migration-created restricted role and denies private source, identities, titles, drafts and Creator writes",async()=>{
    await seeded();
    for(const sql of ["SELECT * FROM source_messages","SELECT * FROM creator_external_identities","SELECT display_title FROM handoffs","SELECT * FROM handoff_drafts","SELECT * FROM published_handoff_provenance","SELECT * FROM schema_migrations","UPDATE handoffs SET id=id","DELETE FROM creators","CREATE TABLE public.mcp_forbidden(id text)"])
      await expect(rolePool.query(sql)).rejects.toMatchObject({code:"42501"});
    const flags=(await rolePool.query("SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=current_user")).rows[0];expect(Object.values(flags).every(v=>v===false)).toBe(true);
    const tables=await pool.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('mcp_web_approvals','mcp_delegations','mcp_widget_tickets','mcp_oauth_transactions','mcp_oauth_sessions','mcp_oauth_codes')");expect(tables.rowCount).toBe(6);expect(tables.rows.every(r=>r.relrowsecurity)).toBe(true);
  });
  it("runs code/PKCE -> real HTTP MCP packet/review/inspection with current registry and exact Canon",async()=>{
    const f=await seeded(),g=await f.issue(),r=await g.exchange();expect(r.status).toBe(200);const t=await r.json();
    const client=new Client({name:"oauth-pg-local",version:"1"}),transport=new StreamableHTTPClientTransport(new URL(oauthResource),{
      requestInit:{headers:{authorization:"Bearer "+t.access_token}},fetch:async(input,init)=>f.http.request(new URL(input instanceof Request?input.url:String(input)).pathname,init)});
    try{await client.connect(transport);const packet=await f.auth.service.getPacket(t.access_token,g.contextRef!);
      const read=await client.callTool({name:"get_handoff_packet",arguments:{contextRef:g.contextRef}});expect(read.isError).not.toBe(true);expect(JSON.stringify(read)).not.toContain("PRIVATE NAVIGATION");
      const answer=submission(packet),review=await client.callTool({name:"review_handoff_answer",arguments:{contextRef:g.contextRef,submission:answer}}),meta=review._meta!.hermeneusScopedReview as {reviewTicket:string};
      const checked=await client.callTool({name:"inspect_handoff_review",arguments:{contextRef:g.contextRef,submission:answer,reviewTicket:meta.reviewTicket}});
      expect(JSON.stringify(checked)).toContain("INDETERMINATE");expect(checked.isError).not.toBe(true);
    }finally{await client.close();}
  });
  it("has one code winner across eight independent AS HTTP workers",async()=>{
    const f=await seeded(),g=await f.issue(),workers=await Promise.all(Array.from({length:8},async()=>{const h=await serveOAuth(await f.make());servers.push(h);return h;}));
    const responses=await Promise.all(workers.map(h=>h.request("/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:g.body})));
    expect(responses.filter(r=>r.status===200)).toHaveLength(1);
  });
  it("blocks a session revoked inside the final grant snapshot",async()=>{
    const f=await seeded(),g=await f.issue(),t=await(await g.exchange()).json(),read=f.metadata.getGrant.bind(f.metadata);let reads=0;
    f.metadata.getGrant=async ref=>{if(++reads===2)await f.store.revokeSession(g.sessionId!);return read(ref);};
    await expect(f.auth.service.getPacket(t.access_token,g.contextRef!)).rejects.toThrow();expect(await f.parents.byBearer(f.share.rawToken)).toBeTruthy();
  });
  it("blocks parent revocation during atomic code consumption",async()=>{
    const f=await seeded(),g=await f.issue(),consume=f.store.consumeCode.bind(f.store);
    f.store.consumeCode=async(...args)=>{await repos.shareCapabilities.revoke(f.share.metadata.id,new Date(f.now()).toISOString());return consume(...args);};
    expect((await g.exchange()).status).not.toBe(200);
  });
  it("blocks connection revocation during atomic widget ticket consumption",async()=>{
    const f=await seeded(),g=await f.issue(),t=await(await g.exchange()).json(),packet=await f.auth.service.getPacket(t.access_token,g.contextRef!),answer=submission(packet),review=await f.auth.service.prepareReview(t.access_token,g.contextRef!,answer),consume=f.metadata.consumeTicket.bind(f.metadata);
    f.metadata.consumeTicket=async(...args)=>{await f.store.revokeSession(g.sessionId!);return consume(...args);};
    await expect(f.auth.service.inspectReview(t.access_token,g.contextRef!,answer,review.reviewTicket)).rejects.toThrow();
  });
  it("cascades Handoff/account deletion to grant/code mappings while unrelated anonymous sessions survive",async()=>{
    const f=await seeded(),a=await f.issue(),b=await f.issue();await repos.accountErasure.enterErasingPhase("creator_oauth_a");expect((await a.exchange()).status).not.toBe(200);
    await repos.accountErasure.completeAccountErasure("creator_oauth_a");
    expect((await pool.query("SELECT 1 FROM mcp_delegations UNION ALL SELECT 1 FROM mcp_oauth_codes")).rowCount).toBe(0);
    expect(await f.store.getSession(b.sessionId!)).toBeDefined();expect((await b.exchange()).status).not.toBe(200);
  });
  it("stores only security metadata and removes expired rows without Data API access",async()=>{
    const f=await seeded(),g=await f.issue(),t=await(await g.exchange()).json();
    const rows=await pool.query("SELECT row_to_json(t)::text data FROM mcp_oauth_transactions t UNION ALL SELECT row_to_json(s)::text FROM mcp_oauth_sessions s UNION ALL SELECT row_to_json(c)::text FROM mcp_oauth_codes c");
    for(const secret of [f.share.rawToken,g.code,t.access_token,g.browser!,g.csrf!,"answerText","confirmation"])expect(JSON.stringify(rows.rows)).not.toContain(secret);
    for(const role of ["anon","authenticated"])for(const table of ["mcp_oauth_transactions","mcp_oauth_sessions","mcp_oauth_codes"])expect((await pool.query("SELECT has_table_privilege($1,$2,'SELECT') allowed",[role,table])).rows[0].allowed).toBe(false);
    f.advance(3_600_000);await f.store.cleanup(f.now());await f.metadata.cleanup(f.now());
    expect((await pool.query("SELECT 1 FROM mcp_oauth_sessions UNION ALL SELECT 1 FROM mcp_oauth_codes UNION ALL SELECT 1 FROM mcp_oauth_transactions UNION ALL SELECT 1 FROM mcp_delegations")).rowCount).toBe(0);
  });
});

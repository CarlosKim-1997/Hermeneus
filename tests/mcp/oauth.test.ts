import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { jwtVerify, createLocalJWKSet } from "jose";
import { authQuery, oauthFixture, oauthClient, oauthClientB, serveOAuth, TestOAuthStore, oauthResource as fixtureResource } from "./oauth-helpers.js";
import { opaque, transactionCookie, connectionCookie } from "../../src/mcp/oauth.js";
import { fixtureIssuer, submission } from "./helpers.js";
import { hash } from "../../src/mcp/scoped-handoff.js";
const challenge=(v:string)=>createHash("sha256").update(v).digest("base64url");
const form=(data:Record<string,string>)=>({method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(data)});
const servers:Array<Awaited<ReturnType<typeof serveOAuth>>>=[];
afterEach(async()=>{for(const s of servers.splice(0))await s.close();});
async function running(){const f=await oauthFixture(),http=await serveOAuth(f.auth);servers.push(http);return {...f,...http};}
async function authorized(f:Awaited<ReturnType<typeof running>>,overrides:Record<string,string>={}){
  const verifier=opaque(),q=authQuery(challenge(verifier),overrides),r=await f.request("/authorize?"+q);
  expect(r.status).toBe(200);const page=await r.text(),ref=/name="ref" value="([^"]+)"/.exec(page)![1]!,csrf=/name="csrf" value="([^"]+)"/.exec(page)![1]!;
  const cookie=r.headers.get("set-cookie")!.split(";")[0]!;
  return {verifier,q,ref,csrf,cookie,page};
}
async function approved(f:Awaited<ReturnType<typeof running>>){
  const a=await authorized(f),r=await f.request("/approve",{...form({ref:a.ref,csrf:a.csrf,confirmed:"yes",shareBearer:f.rawShare}),headers:{...form({}).headers,origin:fixtureIssuer,cookie:a.cookie}});
  expect(r.status).toBe(200);const page=await r.text(),redirect=new URL(/id="continue" href="([^"]+)"/.exec(page)![1]!.replaceAll("&amp;","&")),contextRef=/id="context-ref">([^<]+)</.exec(page)![1]!;
  const code=redirect.searchParams.get("code")!,body={client_id:oauthClient.id,grant_type:"authorization_code",code,code_verifier:a.verifier,redirect_uri:oauthClient.redirectUris[0]!,resource:fixtureResource};
  return {...a,redirect,contextRef,code,body,receipt:page,response:r};
}
describe("dedicated anonymous OAuth, real SDK HTTP handlers and signed tokens",()=>{
  it("advertises exact discovery / JWKS without refresh or DCR and is disabled by default",async()=>{
    const f=await running(),m=await (await f.request("/.well-known/oauth-authorization-server")).json();
    expect(m.grant_types_supported).toEqual(["authorization_code"]);expect(m.token_endpoint_auth_methods_supported).toEqual(["none"]);expect(m.registration_endpoint).toBeUndefined();expect(m.authorization_response_iss_parameter_supported).toBe(true);
    expect(JSON.stringify(await(await f.request("/jwks")).json())).not.toContain('"d":');
    expect((await f.request("/register",form({}))).status).toBe(404);
    const disabled=await serveOAuth(f.auth,false);servers.push(disabled);expect((await disabled.request("/jwks")).status).toBe(404);
  });
  it("approves one Share with same-browser CSRF then exchanges PKCE for a bounded signed token and inspects an exact answer",async()=>{
    const f=await running(),a=await approved(f);expect(a.redirect.searchParams.get("iss")).toBe(fixtureIssuer);expect(a.redirect.searchParams.get("state")).toBe(a.q.get("state"));
    expect(a.response.headers.get("set-cookie")).toContain("HttpOnly");expect(a.response.headers.get("set-cookie")).toContain("Secure");expect(a.response.headers.get("referrer-policy")).toBe("strict-origin");expect(a.response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");expect(a.receipt).not.toContain(f.rawShare);
    const r=await f.request("/token",form(a.body));expect(r.status).toBe(200);const t=await r.json();expect(t.refresh_token).toBeUndefined();expect(t.expires_in).toBeLessThanOrEqual(3600);
    const {payload,protectedHeader}=await jwtVerify(t.access_token,createLocalJWKSet(f.auth.jwks),{issuer:fixtureIssuer,audience:fixtureResource});expect(protectedHeader.typ).toBe("at+jwt");expect(payload.aud).toBe(fixtureResource);
    const packet=await f.auth.service.getPacket(t.access_token,a.contextRef),s=submission(packet),review=await f.auth.service.prepareReview(t.access_token,a.contextRef,s);
    expect((await f.auth.service.inspectReview(t.access_token,a.contextRef,s,review.reviewTicket)).result.verdict).toBe("INDETERMINATE");
    expect((await f.request("/token",form(a.body))).status).toBe(400);
    const stored=f.oauthStore as TestOAuthStore,persisted=JSON.stringify({transactions:[...stored.transactions.values()],sessions:[...stored.sessions.values()],codes:[...stored.codes.values()]});for(const secret of [f.rawShare,a.code,t.access_token,s.answerText])expect(persisted).not.toContain(secret);
  });
  it.each([
    {client_id:"unregistered"},{redirect_uri:oauthClient.redirectUris[0]+"/other"},{redirect_uri:oauthClient.redirectUris[0]+"?evil=1"},
    {resource:"https://evil.fixture.invalid/mcp"},{scope:"handoff:read creator:write"},{scope:"handoff:read handoff:read"},
    {code_challenge_method:"plain"},{state:""},{code_challenge:"short"},
  ])("rejects invalid authorization boundary %j without issuing a session",async change=>{
    const cleaned=Object.fromEntries(Object.entries(change).filter((entry):entry is [string,string]=>typeof entry[1]==="string"));
    const f=await running(),r=await f.request("/authorize?"+authQuery(challenge(opaque()),cleaned));expect([400,302]).toContain(r.status);
    if(r.status===302){const u=new URL(r.headers.get("location")!);expect(u.searchParams.get("iss")).toBe(fixtureIssuer);expect(u.searchParams.get("error")).toBeTruthy();}
    expect((f.oauthStore as TestOAuthStore).sessions.size).toBe(0);
  });
  it("rejects duplicated/unknown inputs, forged Origin/CSRF and an absent browser cookie",async()=>{
    const f=await running();expect((await f.request("/authorize?"+authQuery(challenge(opaque()))+"&client_id=evil")).status).toBe(400);
    const a=await authorized(f),body=form({ref:a.ref,csrf:a.csrf,confirmed:"yes",shareBearer:f.rawShare});
    for(const headers of [{origin:"https://evil.fixture.invalid",cookie:a.cookie},{origin:"null",cookie:a.cookie},{origin:fixtureIssuer},{origin:fixtureIssuer,cookie:a.cookie.replace(/=.*/,"="+opaque())}] as Record<string,string>[])expect((await f.request("/approve",{...body,headers:{...body.headers,...headers}})).status).toBe(400);
    const wrong=form({...Object.fromEntries(new URLSearchParams(body.body)),csrf:opaque()});expect((await f.request("/approve",{...wrong,headers:{...wrong.headers,origin:fixtureIssuer,cookie:a.cookie}})).status).toBe(400);
    expect((f.oauthStore as TestOAuthStore).sessions.size).toBe(0);
  });
  it("accepts the actual ChatGPT locale hint without storing or reflecting it",async()=>{
    const f=await running(),a=await authorized(f,{ui_locales:"ko-KR en-US"});
    expect(a.page).not.toContain("ko-KR");
    expect(JSON.stringify([...(f.oauthStore as TestOAuthStore).transactions.values()])).not.toContain("ko-KR");
    for(const suffix of ["&ui_locales=ko-KR&ui_locales=en-US","&ui_locales=https%3A%2F%2Fevil.invalid","&ui_locales=", "&ui_locales="+"en-US ".repeat(30),"&unknown_hint=en-US"]){
      expect((await f.request("/authorize?"+authQuery(challenge(opaque()))+suffix)).status).toBe(400);
    }
    // Presentation hints cannot turn a bad security boundary into an approval.
    const bad=await f.request("/authorize?"+authQuery(challenge(opaque()),{ui_locales:"ko-KR",resource:"https://evil.fixture.invalid/mcp"}));
    expect([400,302]).toContain(bad.status);expect((f.oauthStore as TestOAuthStore).sessions.size).toBe(0);
  });
  it("keeps SDK endpoint limits with spoofed proxy headers in a shared instance bucket",async()=>{
    const f=await running();
    const proxy=(n:number)=>({"x-forwarded-for":"192.0.2."+n,"forwarded":"for=198.51.100."+n});
    for(let n=0;n<100;n++)expect((await f.request("/authorize?"+authQuery(challenge(opaque())),{headers:proxy(n)})).status).toBe(200);
    expect((await f.request("/authorize?"+authQuery(challenge(opaque())),{headers:proxy(101)})).status).toBe(429);
    const token=form({client_id:oauthClient.id,grant_type:"authorization_code",code:opaque(),code_verifier:opaque(),redirect_uri:oauthClient.redirectUris[0]!,resource:fixtureResource});
    const revoke=form({client_id:oauthClient.id,token:"unissued-token"});
    for(let n=0;n<50;n++){
      expect((await f.request("/token",{...token,headers:{...token.headers,...proxy(n)}})).status).toBe(400);
      expect((await f.request("/revoke",{...revoke,headers:{...revoke.headers,...proxy(n)}})).status).toBe(200);
    }
    expect((await f.request("/token",{...token,headers:{...token.headers,...proxy(51)}})).status).toBe(429);
    expect((await f.request("/revoke",{...revoke,headers:{...revoke.headers,...proxy(51)}})).status).toBe(429);
    expect((f.oauthStore as TestOAuthStore).sessions.size).toBe(0);
  });
  it("declines explicitly with state and issuer and creates no delegation",async()=>{
    const f=await running(),a=await authorized(f),r=await f.request("/approve",{...form({ref:a.ref,csrf:a.csrf,deny:"yes"}),headers:{...form({}).headers,origin:fixtureIssuer,cookie:a.cookie}});
    expect(r.status).toBe(200);const body=await r.text(),u=new URL(/id="return-to-ai" href="([^"]+)"/.exec(body)![1]!.replaceAll("&amp;","&"));expect(u.searchParams.get("error")).toBe("access_denied");expect(u.searchParams.get("iss")).toBe(fixtureIssuer);expect(u.searchParams.get("state")).toBe(a.q.get("state"));expect(f.store.grants.size).toBe(0);
  });
  it.each(["verifier","client","redirect","resource","missing-resource","duplicate","refresh"])("rejects bad token exchange: %s",async field=>{
    const f=await running(),a=await approved(f),body={...a.body};
    if(field==="verifier")body.code_verifier=opaque();if(field==="client")body.client_id=oauthClientB.id;if(field==="redirect")body.redirect_uri+="/other";
    if(field==="resource")body.resource="https://evil.fixture.invalid/mcp";if(field==="missing-resource")delete (body as Partial<typeof body>).resource;if(field==="refresh")body.grant_type="refresh_token";
    const request=form(body);if(field==="duplicate")request.body.append("code",opaque());
    const r=await f.request("/token",request);expect([400,500]).toContain(r.status);expect(await r.text()).not.toContain(a.code);
  });
  it("only one parallel code redemption wins; refreshing never extends the connection",async()=>{
    const f=await running(),a=await approved(f),results=await Promise.all(Array.from({length:8},()=>f.request("/token",form(a.body))));expect(results.filter(r=>r.status===200)).toHaveLength(1);
    const t=await results.find(r=>r.status===200)!.json();f.advance(3_600_000);await expect(f.auth.service.getPacket(t.access_token,a.contextRef)).rejects.toThrow();
  });
  it("binds separate connections even on the same Share and revokes one without revoking its parent",async()=>{
    const f=await running(),a=await approved(f),b=await approved(f),ta=await(await f.request("/token",form(a.body))).json(),tb=await(await f.request("/token",form(b.body))).json();
    await expect(f.auth.service.getPacket(tb.access_token,a.contextRef)).rejects.toThrow();
    expect((await f.request("/revoke",form({client_id:oauthClientB.id,token:ta.access_token}))).status).toBe(200);expect(await f.auth.verifier.verify(ta.access_token)).toBeTruthy();
    expect((await f.request("/revoke",form({client_id:oauthClient.id,token:ta.access_token}))).status).toBe(200);await expect(f.auth.service.getPacket(ta.access_token,a.contextRef)).rejects.toThrow();expect(await f.auth.service.getPacket(tb.access_token,b.contextRef)).toBeTruthy();expect(await f.parents.byBearer(f.rawShare)).toBeTruthy();
  });
  it("enforces transaction/code expiry and parent revocation before exchange",async()=>{
    const f=await running(),a=await authorized(f);f.advance(60_000);expect((await f.request("/approve",{...form({ref:a.ref,csrf:a.csrf,confirmed:"yes",shareBearer:f.rawShare}),headers:{...form({}).headers,origin:fixtureIssuer,cookie:a.cookie}})).status).toBe(400);
    const b=await approved(f);f.advance(60_000);expect((await f.request("/token",form(b.body))).status).toBe(400);
    const c=await approved(f);f.packets.delete("cap-a");expect((await f.request("/token",form(c.body))).status).not.toBe(200);
  });
  it("browser disconnect requires its exact connection cookie and CSRF",async()=>{
    const f=await running(),a=await approved(f),t=await(await f.request("/token",form(a.body))).json(),id=(await f.auth.verifier.verify(t.access_token)).sessionId;
    const csrf=/name="csrf" value="([^"]+)"/.exec(a.receipt)![1]!,set=a.response.headers.getSetCookie().find(c=>c.startsWith(connectionCookie(id)+"="))!.split(";")[0]!;
    const body=form({session:id,csrf});expect((await f.request("/disconnect",{...body,headers:{...body.headers,origin:fixtureIssuer}})).status).toBe(400);
    expect((await f.request("/disconnect",{...body,headers:{...body.headers,origin:fixtureIssuer,cookie:set}})).status).toBe(200);await expect(f.auth.verifier.verify(t.access_token)).rejects.toThrow();
  });
  it("rejects form-encoded MCP requests without waiting on an already consumed body; Creator cookies are not OAuth",async()=>{
    const f=await running();expect((await f.request("/mcp",form({answerText:"synthetic rejection fixture"}))).status).toBe(415);
    const r=await f.request("/mcp",{method:"POST",headers:{"content-type":"application/json",cookie:"authjs.session-token=synthetic-creator-cookie"},body:'{"jsonrpc":"2.0","id":1,"method":"tools/list"}'});
    expect(r.status).toBe(401);expect(r.headers.get("referrer-policy")).toBe("no-referrer");expect(r.headers.get("www-authenticate")).toContain("oauth-protected-resource");
  });
});

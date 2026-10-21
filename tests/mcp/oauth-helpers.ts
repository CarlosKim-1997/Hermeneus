import { createServer, request as httpRequest } from "node:http";
import { randomBytes } from "node:crypto";
import { exportJWK, generateKeyPair } from "jose";
import type { OAuthCode, OAuthSession, OAuthStore, OAuthTransaction } from "../../src/mcp/oauth.js";
import { createAnonymousOAuth, opaque } from "../../src/mcp/oauth.js";
import { createAnonymousOAuthApp } from "../../src/mcp/oauth-http.js";
import { fixture, fixtureIssuer, fixtureResource } from "./helpers.js";

/** Only test fixtures use an in-memory authorization server store. */
export class TestOAuthStore implements OAuthStore {
  transactions=new Map<string,OAuthTransaction>();sessions=new Map<string,OAuthSession>();codes=new Map<string,OAuthCode>();used=new Set<string>();
  async insertTransaction(t:OAuthTransaction){this.transactions.set(t.ref,structuredClone(t));}
  async consumeTransaction(ref:string,cookie:string,csrf:string,now:number){const t=this.transactions.get(ref);if(!t||t.expiresAt<=now||t.cookieHash!==cookie||t.csrfHash!==csrf)return undefined;this.transactions.delete(ref);return structuredClone(t);}
  async insertSession(s:OAuthSession){this.sessions.set(s.id,structuredClone(s));}
  async getSession(id:string){const s=this.sessions.get(id);return s?structuredClone(s):undefined;}
  async revokeSession(id:string){const s=this.sessions.get(id);if(s)s.revoked=true;}
  async insertCode(c:OAuthCode){this.codes.set(c.hash,structuredClone(c));}
  async getCode(hash:string,now:number){const c=this.codes.get(hash);return c&&!this.used.has(hash)&&c.expiresAt>now?structuredClone(c):undefined;}
  async consumeCode(hash:string,client:string,redirect:string,resource:string,now:number){const c=await this.getCode(hash,now);if(!c||this.used.has(hash)||c.clientId!==client||c.redirectUri!==redirect||c.resource!==resource)return undefined;this.used.add(hash);return c;}
  async cleanup(now:number){for(const [id,t]of this.transactions)if(t.expiresAt<=now)this.transactions.delete(id);for(const [h,c]of this.codes)if(c.expiresAt<=now||this.used.has(h)||!this.sessions.has(c.sessionId))this.codes.delete(h);for(const [id,s]of this.sessions)if(s.expiresAt<=now||s.revoked)this.sessions.delete(id);}
}
export const oauthClient={id:"synthetic-chatgpt-client",name:"Synthetic ChatGPT fixture",redirectUris:["https://client.fixture.invalid/callback"]};
export const oauthClientB={id:"synthetic-other-client",name:"Other synthetic connection",redirectUris:["https://other.fixture.invalid/callback"]};
export const oauthResource=fixtureIssuer+"/mcp";
export async function oauthFixture(store?:OAuthStore){
  const f=fixture(),pair=await generateKeyPair("ES256"),jwk={...await exportJWK(pair.publicKey),kid:"local-fixture-es256"};
  const rawShare=opaque(),original=f.parents.byBearer;f.parents.byBearer=raw=>original(raw===rawShare?"fixture-share-a":raw);
  const metadata=store??new TestOAuthStore();
  const auth=await createAnonymousOAuth({issuer:fixtureIssuer,resource:oauthResource,clients:[oauthClient,oauthClientB],signingKey:pair.privateKey,
    keyId:jwk.kid,publicJwk:jwk,inspectionKey:randomBytes(32),store:metadata,metadata:f.store,parents:f.parents,now:f.time});
  return {...f,auth,oauthStore:metadata,rawShare};
}
export async function serveOAuth(auth:Awaited<ReturnType<typeof oauthFixture>>["auth"],enabled=true,pluginUrl?:string){
  const app=createAnonymousOAuthApp(auth,{enabled,shareOrigin:new URL(fixtureResource).origin,pluginUrl}),server=createServer(app);
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();if(!address||typeof address==="string")throw Error("Missing fixture port");
  const base=`http://127.0.0.1:${address.port}`;
  // Native loopback HTTP preserves the fixture's pinned Host; fetch rewrites Host.
  const request=(path:string,init:RequestInit={})=>new Promise<Response>((resolve,reject)=>{
    const headers=Object.fromEntries(new Headers(init.headers));
    const r=httpRequest(base+path,{method:init.method??"GET",headers:{...headers,host:new URL(auth.issuer).host}},res=>{
      const chunks:Buffer[]=[];res.on("data",c=>chunks.push(c));res.on("end",()=>{
        const h=new Headers();for(const [k,v]of Object.entries(res.headers))if(v)for(const value of Array.isArray(v)?v:[v])h.append(k,value);
        resolve(new Response([204,304].includes(res.statusCode!)?null:Buffer.concat(chunks),{status:res.statusCode,headers:h}));
      });res.on("error",reject);
    });r.on("error",reject);if(init.body)r.write(String(init.body));r.end();
  });
  return {server,base,request,close:()=>new Promise<void>((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();})};
}
export function authQuery(challenge:string,overrides:Record<string,string>={}){
  return new URLSearchParams({client_id:oauthClient.id,redirect_uri:oauthClient.redirectUris[0]!,response_type:"code",code_challenge:challenge,
    code_challenge_method:"S256",scope:"handoff:read handoff:review",state:opaque(),resource:oauthResource,...overrides});
}

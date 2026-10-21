import type { IncomingMessage,ServerResponse } from "node:http";
import { importJWK, type JWK } from "jose";
import pg from "pg";
import { z } from "zod";
import { createAnonymousOAuth } from "./oauth.js";
import { createAnonymousOAuthApp } from "./oauth-http.js";
import { PostgresOAuthStore,PostgresOAuthMcpMetadata } from "./oauth-postgres.js";
import { PostgresShareParents } from "./postgres.js";

const target="dzaibwrrylxlrxbgnyaw",role="hermeneus_mcp_alpha";
const clientsSchema=z.array(z.object({id:z.string().min(1).max(256),name:z.string().min(1).max(100),redirectUris:z.array(z.string().url()).min(1)}).strict()).max(3);
/** Whitelist operational categories only; never log an error message, SQL, URL or key. */
export function classifyMcpStartupError(error:unknown){
  const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
  if(code==='28P01')return 'DB_AUTHENTICATION';
  if(code==='42501')return 'DB_PRIVILEGE';
  if(['DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID'].includes(String(code)))return 'TLS_CERTIFICATE';
  if(['ENOTFOUND','ECONNREFUSED','ETIMEDOUT','EHOSTUNREACH','ENETUNREACH'].includes(String(code)))return 'NETWORK';
  return 'UNCLASSIFIED';
}
export function readMcpRuntimeConfig(env:Record<string,string|undefined>){
  if(env.MCP_ALPHA_ENABLED!=="1"||env.MCP_DATA_MODE!=="SYNTHETIC_ONLY")throw Error("MCP runtime unavailable");
  const issuer=env.MCP_OAUTH_ISSUER,shareOrigin=env.MCP_SHARE_ORIGIN;
  if(issuer!=="https://hermeneus-mcp-alpha.vercel.app"||shareOrigin!=="https://hermeneus-alpha-synthetic.vercel.app")throw Error("MCP origin unavailable");
  const url=new URL(env.MCP_DATABASE_URL??"");
  if(url.protocol!=="postgresql:"||!url.hostname.endsWith(".pooler.supabase.com")||decodeURIComponent(url.username)!==role+"."+target||url.pathname!=="/postgres"||!url.password||url.hash)throw Error("MCP database unavailable");
  // pg connection-string sslmode must not override certificate verification.
  for(const key of [...url.searchParams.keys()])url.searchParams.delete(key);
  const jwk=JSON.parse(env.MCP_OAUTH_PRIVATE_JWK??"null") as JWK|null;
  if(!jwk||jwk.kty!=="EC"||jwk.crv!=="P-256"||typeof jwk.d!=="string"||typeof jwk.kid!=="string"||!jwk.kid)throw Error("MCP signing key unavailable");
  const inspectionKey=Buffer.from(env.MCP_INSPECTION_KEY??"","base64url");if(inspectionKey.length!==32)throw Error("MCP ticket key unavailable");
  const clients=clientsSchema.parse(JSON.parse(env.MCP_OAUTH_CLIENTS??"[]"));
  return {issuer,resource:issuer+"/mcp",shareOrigin,databaseUrl:url.href,jwk,inspectionKey,clients,pluginUrl:env.MCP_CHATGPT_PLUGIN_URL};
}
export async function createMcpAlphaRuntime(env:Record<string,string|undefined>){
  let stage:'CONFIG'|'SIGNING_KEY'|'DB_CONNECT'|'DB_ROLE'|'DB_CLEANUP'|'AUTH_SETUP'='CONFIG',activePool:pg.Pool|undefined;
  try{
  const config=readMcpRuntimeConfig(env);stage='SIGNING_KEY';const key=await importJWK(config.jwk,"ES256");if(key instanceof Uint8Array)throw Error("MCP key unavailable");
  const pool=new pg.Pool({connectionString:config.databaseUrl,ssl:{rejectUnauthorized:true},max:2,idleTimeoutMillis:10_000,connectionTimeoutMillis:8_000,application_name:"hermeneus-mcp-alpha"});
  activePool=pool;stage='DB_CONNECT';
  pool.on("error",()=>{/* Do not log connection strings, queries, tokens or bodies. */});
  const identity=await pool.query("SELECT current_user AS role");stage='DB_ROLE';if(identity.rows[0]?.role!==role)throw Error("MCP role unavailable");
  const store=new PostgresOAuthStore(pool),metadata=new PostgresOAuthMcpMetadata(pool),parents=new PostgresShareParents(pool);
  stage='DB_CLEANUP';await store.cleanup(Date.now());await metadata.cleanup(Date.now());stage='AUTH_SETUP';
  const {d:_private,...publicJwk}=config.jwk;
  const auth=await createAnonymousOAuth({issuer:config.issuer,resource:config.resource,clients:config.clients,signingKey:key,keyId:config.jwk.kid!,publicJwk,inspectionKey:config.inspectionKey,store,metadata,parents});
  const app=createAnonymousOAuthApp(auth,{enabled:true,shareOrigin:config.shareOrigin,pluginUrl:config.pluginUrl});
  return {app,pool,auth,async ready(){await pool.query("SELECT 1 FROM mcp_oauth_sessions LIMIT 0");return {status:"ready",dataMode:"SYNTHETIC_ONLY",semanticProvider:"NOT_CONNECTED",issuer:config.issuer,resource:config.resource,clients:config.clients.length,commit:env.VERCEL_GIT_COMMIT_SHA??env.HERMENEUS_COMMIT_SHA??"unknown"};}};
  }catch(error){
    console.error('HERMENEUS_MCP_STARTUP',stage,classifyMcpStartupError(error));
    if(activePool)await activePool.end().catch(()=>{});
    throw Error('MCP runtime unavailable');
  }
}
let runtime:ReturnType<typeof createMcpAlphaRuntime>|undefined;
export async function mcpAlphaHandler(req:IncomingMessage,res:ServerResponse){
  try{
    runtime??=createMcpAlphaRuntime(process.env).catch(e=>{runtime=undefined;throw e;});const r=await runtime;
    if(req.url==="/api/ready"&&req.method==="GET"){
      const data=await r.ready();res.writeHead(200,{"content-type":"application/json","cache-control":"no-store","referrer-policy":"no-referrer"});res.end(JSON.stringify(data));return;
    }
    r.app(req,res);
  }catch{res.writeHead(503,{"content-type":"application/json","cache-control":"no-store","referrer-policy":"no-referrer"});res.end('{"error":"MCP_UNAVAILABLE"}');}
}

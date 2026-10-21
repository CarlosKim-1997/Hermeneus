import { describe,expect,it,vi } from "vitest";
import { generateKeyPair,exportJWK } from "jose";
import { randomBytes } from "node:crypto";
import { readMcpRuntimeConfig,classifyMcpStartupError,createMcpAlphaRuntime } from "../../src/mcp/runtime.js";
async function config(){const pair=await generateKeyPair('ES256',{extractable:true});return {MCP_ALPHA_ENABLED:'1',MCP_DATA_MODE:'SYNTHETIC_ONLY',MCP_OAUTH_ISSUER:'https://hermeneus-mcp-alpha.vercel.app',MCP_SHARE_ORIGIN:'https://hermeneus-alpha-synthetic.vercel.app',MCP_DATABASE_URL:'postgresql://hermeneus_mcp_alpha.dzaibwrrylxlrxbgnyaw:fixture-only@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=no-verify',MCP_OAUTH_PRIVATE_JWK:JSON.stringify({...await exportJWK(pair.privateKey),kid:'fixture'}),MCP_INSPECTION_KEY:randomBytes(32).toString('base64url')};}
describe('synthetic-only runtime target and credential boundary',()=>{
  it('never reflects arbitrary startup error details into operational categories',()=>{
    const secret='fixture-password-url-token';
    for(const error of [{code:secret,message:secret,stack:secret},{code:'42501',message:secret},{code:'28P01',detail:secret},{code:'SELF_SIGNED_CERT_IN_CHAIN',stack:secret}])expect(classifyMcpStartupError(error)).not.toContain(secret);
    expect(classifyMcpStartupError({code:'28P01'})).toBe('DB_AUTHENTICATION');
  });
  it('logs only a fixed startup stage/category and returns a generic error on invalid configuration',async()=>{
    const logged=vi.spyOn(console,'error').mockImplementation(()=>{});
    try{await expect(createMcpAlphaRuntime({MCP_DATABASE_URL:'fixture-secret'})).rejects.toThrow('MCP runtime unavailable');expect(logged.mock.calls).toEqual([['HERMENEUS_MCP_STARTUP','CONFIG','UNCLASSIFIED']]);}finally{logged.mockRestore();}
  });
  it('requires an explicit dedicated target and strips URL options that could disable TLS validation',async()=>{const c=readMcpRuntimeConfig(await config());expect(new URL(c.databaseUrl).search).toBe('');expect(c.clients).toEqual([]);});
  it.each(['disabled','real-data','owner-role','other-project','wrong-origin','missing-key'])('fails closed for %s',async name=>{
    const env=await config();if(name==='disabled')env.MCP_ALPHA_ENABLED='0';if(name==='real-data')env.MCP_DATA_MODE='REAL';if(name==='owner-role')env.MCP_DATABASE_URL=env.MCP_DATABASE_URL.replace('hermeneus_mcp_alpha.','postgres.');if(name==='other-project')env.MCP_DATABASE_URL=env.MCP_DATABASE_URL.replace('dzaibwrrylxlrxbgnyaw','ttophuhddiyelfmwrvch');if(name==='wrong-origin')env.MCP_OAUTH_ISSUER='https://evil.invalid';if(name==='missing-key')env.MCP_OAUTH_PRIVATE_JWK='null';expect(()=>readMcpRuntimeConfig(env)).toThrow();
  });
});

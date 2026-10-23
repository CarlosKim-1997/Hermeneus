import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { oauthFixture, serveOAuth, authQuery, oauthClient, oauthResource } from './oauth-helpers.js';
import { fixtureIssuer, submission } from './helpers.js';
import { opaque } from '../../src/mcp/oauth.js';
import { generateShareToken } from '../../src/share/token.js';
import { buildReceiverPacket } from '../../src/portable/receiver-packet.js';

const servers: Awaited<ReturnType<typeof serveOAuth>>[]=[];
afterEach(async()=>{for(const h of servers.splice(0))await h.close();});
async function setup(){
  const f=await oauthFixture(),http=await serveOAuth(f.auth);servers.push(http);
  const rawB=generateShareToken(),original=f.parents.byBearer;
  f.parents.byBearer=raw=>original(raw===rawB?'fixture-share-b':raw);
  f.packets.set('cap-b',buildReceiverPacket({handoffId:'distinct-handoff-b',version:1,publishedAt:'2026-10-23T00:00:00.000Z',items:[{id:'b-only',type:'CONFIRMED',priority:'CORE',statement:'화요일까지 보라색 인쇄 시안을 준비합니다.'}]}));
  async function issue(raw:string){
    const verifier=opaque(),q=authQuery(createHash('sha256').update(verifier).digest('base64url'));
    const r=await http.request('/authorize?'+q);expect(r.status).toBe(200);
    const page=await r.text(),ref=/name="ref" value="([^"]+)"/.exec(page)![1]!,csrf=/name="csrf" value="([^"]+)"/.exec(page)![1]!;
    const a=await http.request('/approve',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:fixtureIssuer,cookie:r.headers.get('set-cookie')!.split(';')[0]!},body:new URLSearchParams({ref,csrf,confirmed:'yes',shareBearer:raw})});
    expect(a.status).toBe(200);const receipt=await a.text(),contextRef=/id="context-ref">([^<]+)</.exec(receipt)![1]!;
    const callback=new URL(/id="continue" href="([^"]+)"/.exec(receipt)![1]!.replaceAll('&amp;','&'));
    const t=await http.request('/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:oauthClient.id,grant_type:'authorization_code',code:callback.searchParams.get('code')!,code_verifier:verifier,redirect_uri:oauthClient.redirectUris[0]!,resource:oauthResource})});
    expect(t.status).toBe(200);return {contextRef,token:(await t.json()).access_token as string};
  }
  return {...f,http,rawB,issue};
}

describe('returning Receiver / two distinct Published v1 handoffs',()=>{
  it('separates OAuth connections, answer packets and one-use review tickets',async()=>{
    const f=await setup(),a=await f.issue(f.rawShare),b=await f.issue(f.rawB);
    const pa=await f.auth.service.getPacket(a.token,a.contextRef),pb=await f.auth.service.getPacket(b.token,b.contextRef);
    expect(pa.version).toBe(1);expect(pb.version).toBe(1);expect(pa.publicationRef).not.toBe(pb.publicationRef);
    expect(pa.items[0]!.statement).toContain('금요일');expect(pb.items[0]!.statement).toContain('보라색');
    await expect(f.auth.service.getPacket(a.token,b.contextRef)).rejects.toThrow();
    await expect(f.auth.service.getPacket(b.token,a.contextRef)).rejects.toThrow();
    const sa=submission(pa),sb=submission(pb,'화요일까지 보라색 인쇄 시안을 준비합니다. [HI-001]');
    await expect(f.auth.service.prepareReview(a.token,a.contextRef,sb)).rejects.toThrow();
    const ra=await f.auth.service.prepareReview(a.token,a.contextRef,sa),rb=await f.auth.service.prepareReview(b.token,b.contextRef,sb);
    await expect(f.auth.service.inspectReview(b.token,b.contextRef,sb,ra.reviewTicket)).rejects.toThrow();
    expect((await f.auth.service.inspectReview(a.token,a.contextRef,sa,ra.reviewTicket)).result.verdict).toBe('INDETERMINATE');
    expect((await f.auth.service.inspectReview(b.token,b.contextRef,sb,rb.reviewTicket)).result.verdict).toBe('INDETERMINATE');
    await expect(f.auth.service.inspectReview(a.token,a.contextRef,sa,ra.reviewTicket)).rejects.toThrow();
  });
  it('at grant expiry keeps authentication valid but returns a tool error without an OAuth challenge',async()=>{
    const f=await setup(),a=await f.issue(f.rawShare),responses:{status:number;challenge:string|null}[]=[];
    const client=new Client({name:'returning-flow-local',version:'1'});
    try{
      await client.connect(new StreamableHTTPClientTransport(new URL(oauthResource),{requestInit:{headers:{authorization:'Bearer '+a.token}},fetch:async(input,init)=>{const r=await f.http.request(new URL(input instanceof Request?input.url:String(input)).pathname,init);responses.push({status:r.status,challenge:r.headers.get('www-authenticate')});return r;}}));
      f.advance(1_800_000);expect(await f.auth.verifier.verify(a.token)).toBeTruthy();
      const result=await client.callTool({name:'get_handoff_packet',arguments:{contextRef:a.contextRef}});
      expect(result.isError).toBe(true);expect(JSON.stringify(result.content)).toContain('HANDOFF_ACCESS_UNAVAILABLE');
      expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();expect(responses.at(-1)).toEqual({status:200,challenge:null});
      const fresh=await f.issue(f.rawShare);expect(await f.auth.service.getPacket(fresh.token,fresh.contextRef)).toBeTruthy();
      await expect(f.auth.service.getPacket(fresh.token,a.contextRef)).rejects.toThrow();
      await expect(f.auth.service.getPacket(a.token,fresh.contextRef)).rejects.toThrow();
      f.advance(1_800_000);await expect(f.auth.verifier.verify(a.token)).rejects.toThrow();
      expect(await f.parents.byBearer(f.rawShare)).toBeTruthy();
    }finally{await client.close();}
  });
});

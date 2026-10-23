import { test,expect,type BrowserContext,type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { oauthFixture,serveOAuth,authQuery,oauthClient,oauthResource } from '../tests/mcp/oauth-helpers.js';
import { opaque } from '../src/mcp/oauth.js';
import { fixtureIssuer } from '../tests/mcp/helpers.js';
import { generateShareToken } from '../src/share/token.js';
import { buildReceiverPacket } from '../src/portable/receiver-packet.js';
const pluginUrl='https://chatgpt.com/plugins/returning_local_fixture';
async function harness(context:BrowserContext){
  const f=await oauthFixture(),http=await serveOAuth(f.auth,true,pluginUrl),urls:string[]=[];
  const rawB=generateShareToken(),original=f.parents.byBearer;f.parents.byBearer=raw=>original(raw===rawB?'fixture-share-b':raw);
  f.packets.set('cap-b',buildReceiverPacket({handoffId:'different-b',version:1,publishedAt:'2026-10-23T00:00:00.000Z',items:[{id:'b',type:'CONFIRMED',priority:'CORE',statement:'화요일까지 보라색 인쇄 시안을 준비합니다.'}]}));
  await context.route('**/*',async route=>{
    const r=route.request(),u=new URL(r.url());urls.push(u.href);
    if(u.origin===fixtureIssuer){const response=await http.request(u.pathname+u.search,{method:r.method(),headers:await r.allHeaders(),body:r.postData()??undefined}),headers=Object.fromEntries(response.headers);if(response.headers.getSetCookie().length)headers['set-cookie']=response.headers.getSetCookie().join('\n');await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});return;}
    // Deliberately a local host model, not observed current ChatGPT behavior.
    if(u.origin==='https://chatgpt.com'){await route.fulfill({contentType:'text/html; charset=utf-8',body:'<h1>로컬 호스트 모형 · 이미 연결됨</h1><p>OAuth를 다시 시작하지 않는 호스트 조건</p><button>채팅에서 사용해 보기</button>'});return;}
    await route.abort();
  });
  async function approve(statement:RegExp){
    const approval=await context.newPage(),verifier=opaque(),q=authQuery(createHash('sha256').update(verifier).digest('base64url'));
    // Explicitly supplied by the fixture: the host did not initiate this request.
    await approval.goto(fixtureIssuer+'/authorize?'+q);await approval.getByLabel(statement).check();await approval.getByRole('checkbox').check();await approval.locator('#approve-button').click();
    await expect(approval.locator('#context-ref')).toBeVisible();const ref=(await approval.locator('#context-ref').textContent())!;
    const callback=new URL((await approval.locator('#continue').getAttribute('href'))!);
    const r=await http.request('/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:oauthClient.id,grant_type:'authorization_code',code:callback.searchParams.get('code')!,code_verifier:verifier,redirect_uri:oauthClient.redirectUris[0]!,resource:oauthResource})});
    expect(r.status).toBe(200);return {ref,token:(await r.json()).access_token as string,approval};
  }
  async function landing(page:Page,raw:string){await page.goto(fixtureIssuer+'/handoff#'+raw);await expect(page.locator('#version')).toHaveText('공유받은 버전 1');expect(page.url()).toBe(fixtureIssuer+'/handoff');await page.locator('#transfer').check();}
  return {...f,http,urls,rawB,approve,landing,close:()=>http.close()};
}
test('two different Handoffs both at v1 remain separate across explicit OAuth approvals',async({context,page})=>{
  const h=await harness(context);try{
    await h.landing(page,h.rawShare);const second=await context.newPage();await h.landing(second,h.rawB);
    const b=await h.approve(/열어 둔 공유 건.*보라색/);await expect(second.locator('#open-chat')).toBeEnabled();await expect(page.locator('#open-chat')).toBeDisabled();
    const a=await h.approve(/열어 둔 공유 건.*금요일/);await expect(page.locator('#open-chat')).toBeEnabled();
    expect(a.ref).not.toBe(b.ref);expect(h.store.grants.size).toBe(2);
    expect((await h.auth.service.getPacket(a.token,a.ref)).items[0]!.statement).toContain('금요일');
    expect((await h.auth.service.getPacket(b.token,b.ref)).items[0]!.statement).toContain('보라색');
    await expect(h.auth.service.getPacket(a.token,b.ref)).rejects.toThrow();await expect(h.auth.service.getPacket(b.token,a.ref)).rejects.toThrow();
    for(const url of h.urls){expect(url).not.toContain(h.rawShare);expect(url).not.toContain(h.rawB);expect(url).not.toContain(a.token);expect(url).not.toContain(b.token);}
    for(const tab of [page,second])expect(await tab.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
    await second.screenshot({path:'test-results/mcp-local/t035-two-v1-handoffs.png',fullPage:true});
  }finally{await h.close();}
});
test('characterizes the missing returning-host trigger without manually injecting another authorization',async({context,page})=>{
  const h=await harness(context);try{
    await h.landing(page,h.rawShare);await h.approve(/열어 둔 공유 건.*금요일/);
    const second=await context.newPage();await h.landing(second,h.rawB);const before=h.urls.length;
    const opened=context.waitForEvent('page');await second.locator('#open-plugin').click();const plugin=await opened;
    await expect(plugin.getByRole('heading')).toHaveText('로컬 호스트 모형 · 이미 연결됨');
    await expect(second.locator('#open-chat')).toBeDisabled();expect(await second.locator('#context-ref').textContent()).toBe('');expect(h.store.grants.size).toBe(1);
    expect(h.urls.slice(before).some(url=>new URL(url).pathname==='/authorize')).toBe(false);
    // This is a reproduced limitation, not a claim that returning-user UX passed.
    await second.screenshot({path:'test-results/mcp-local/t035-returning-host-no-trigger.png',fullPage:true});
  }finally{await h.close();}
});

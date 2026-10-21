import { test,expect,type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { oauthFixture,serveOAuth,authQuery,oauthClient,oauthResource } from "../tests/mcp/oauth-helpers.js";
import { opaque } from "../src/mcp/oauth.js";
import { fixtureIssuer } from "../tests/mcp/helpers.js";
const pluginUrl="https://chatgpt.com/plugins/synthetic_fixture";
async function harness(context:BrowserContext){
  const f=await oauthFixture(),http=await serveOAuth(f.auth,true,pluginUrl),urls:string[]=[];
  await context.route("**/*",async route=>{const r=route.request(),u=new URL(r.url());urls.push(u.href);
    if(u.origin===fixtureIssuer){const response=await http.request(u.pathname+u.search,{method:r.method(),headers:await r.allHeaders(),body:r.postData()??undefined}),headers=Object.fromEntries(response.headers);if(response.headers.getSetCookie().length)headers['set-cookie']=response.headers.getSetCookie().join('\n');await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});return;}
    if(u.origin==='https://chatgpt.com'){await route.fulfill({contentType:'text/html; charset=utf-8',body:'<h1>Synthetic ChatGPT fixture</h1>'});return;}await route.abort();});
  return {...f,http,urls,close:()=>http.close()};
}
test("Share fragment -> ephemeral same-browser selection -> PKCE -> context-only new Chat",async({context,page})=>{
  const h=await harness(context);try{
    await page.goto(fixtureIssuer+'/handoff#'+h.rawShare);await expect(page.locator('#version')).toContainText('버전 1');expect(page.url()).toBe(fixtureIssuer+'/handoff');await page.locator('#transfer').check();
    const opened=context.waitForEvent('page');await page.locator('#open-plugin').click();const plugin=await opened;await expect(plugin.getByRole('heading')).toHaveText('Synthetic ChatGPT fixture');expect(plugin.url()).toBe(pluginUrl);
    const approval=await context.newPage(),verifier=opaque(),q=authQuery(createHash('sha256').update(verifier).digest('base64url'));await approval.goto(fixtureIssuer+'/authorize?'+q);
    const offer=approval.locator('#handoff-offers input[type=radio]');await expect(offer).toHaveCount(1);expect(await offer.isChecked()).toBe(false);await offer.check();await approval.getByRole('checkbox').check();await approval.locator('#approve-button').click();
    await expect(approval.locator('#context-ref')).toBeVisible();await expect(page.locator('#open-chat')).toBeEnabled();const ref=(await page.locator('#context-ref').textContent())!;expect(ref).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const callback=new URL((await approval.locator('#continue').getAttribute('href'))!);expect(callback.searchParams.get('state')).toBe(q.get('state'));expect(callback.searchParams.get('iss')).toBe(fixtureIssuer);
    const r=await h.http.request('/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:oauthClient.id,grant_type:'authorization_code',code:callback.searchParams.get('code')!,code_verifier:verifier,redirect_uri:oauthClient.redirectUris[0]!,resource:oauthResource})});expect(r.status).toBe(200);const token=(await r.json()).access_token;
    expect((await h.auth.service.getPacket(token,ref)).version).toBe(1);
    const newChat=context.waitForEvent('page');await page.locator('#open-chat').click();const chat=await newChat;await chat.waitForLoadState();expect(new URL(chat.url()).searchParams.get('q')).toContain(ref);
    for(const url of h.urls){expect(url).not.toContain(h.rawShare);expect(url).not.toContain(token);expect(url).not.toContain('answerText');}
    for(const tab of [page,approval])expect(await tab.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
    h.packets.delete('cap-a');await expect(h.auth.service.getPacket(token,ref)).rejects.toThrow();
    await page.screenshot({path:'test-results/mcp-local/share-handover-complete.png',fullPage:true});
  }finally{await h.close();}
});
test("two simultaneous Share windows offer explicit separate choices and clear only the selected handover",async({context,page})=>{
  const h=await harness(context);try{
    const rawB=opaque(),original=h.parents.byBearer;h.parents.byBearer=raw=>original(raw===rawB?'fixture-share-b':raw);
    await page.goto(fixtureIssuer+'/handoff#'+h.rawShare);await expect(page.locator('#version')).toContainText('버전 1');await page.locator('#transfer').check();
    const second=await context.newPage();await second.goto(fixtureIssuer+'/handoff#'+rawB);await expect(second.locator('#version')).toContainText('버전 2');await second.locator('#transfer').check();
    const approval=await context.newPage(),q=authQuery(createHash('sha256').update(opaque()).digest('base64url'));await approval.goto(fixtureIssuer+'/authorize?'+q);await expect(approval.locator('#handoff-offers input')).toHaveCount(2);
    await approval.getByLabel(/열어 둔 공유 건 · 버전 2/).check();await approval.getByRole('checkbox').check();await approval.locator('#approve-button').click();await expect(approval.getByRole('heading')).toContainText('버전 2');
    await expect(second.locator('#open-chat')).toBeEnabled();await expect(page.locator('#open-chat')).toBeDisabled();expect(h.store.grants.size).toBe(1);expect([...h.store.grants.values()][0]!.capabilityId).toBe('cap-b');
    expect(await page.locator('#context-ref').textContent()).toBe('');
  }finally{await h.close();}
});

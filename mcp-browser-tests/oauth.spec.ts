import { test,expect,type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { oauthFixture,serveOAuth,authQuery,oauthResource,oauthClient } from "../tests/mcp/oauth-helpers.js";
import { opaque } from "../src/mcp/oauth.js";
import { fixtureIssuer,fixtureResource,submission } from "../tests/mcp/helpers.js";
import { scopedWidgetHtml } from "../src/mcp/widget.js";

// Fully intercepted HTTPS surfaces + loopback server. Never loads ChatGPT or a target DB.
async function harness(page:Page){
  const f=await oauthFixture(),http=await serveOAuth(f.auth),verifier=opaque(),q=authQuery(createHash("sha256").update(verifier).digest("base64url"));
  const client=new Client({name:"local-browser-oauth-host",version:"1"});let token="",contextRef="",toolCalls=0;
  await page.route("**/*",async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.origin===fixtureIssuer){
      const requestHeaders=await req.allHeaders();
      const response=await http.request(u.pathname+u.search,{method:req.method(),headers:requestHeaders,body:req.postData()??undefined});
      if(u.pathname==="/approve"){expect(requestHeaders.origin).toBe(fixtureIssuer);expect(requestHeaders.referer).toBe(fixtureIssuer+"/");}
      const headers=Object.fromEntries(response.headers);if(response.headers.getSetCookie().length)headers["set-cookie"]=response.headers.getSetCookie().join("\n");
      await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});return;
    }
    if(u.origin===new URL(oauthClient.redirectUris[0]!).origin&&u.pathname==="/callback"){
      expect(u.searchParams.get("state")).toBe(q.get("state"));expect(u.searchParams.get("iss")).toBe(fixtureIssuer);
      if(u.searchParams.has("error")){await route.fulfill({contentType:"text/html; charset=utf-8",body:"<h1>연결을 취소했습니다</h1>"});return;}
      const response=await http.request("/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:oauthClient.id,grant_type:"authorization_code",code:u.searchParams.get("code")!,code_verifier:verifier,redirect_uri:oauthClient.redirectUris[0]!,resource:oauthResource})});
      expect(response.status).toBe(200);token=(await response.json()).access_token;
      await client.connect(new StreamableHTTPClientTransport(new URL(oauthResource),{requestInit:{headers:{authorization:"Bearer "+token}},fetch:async(input,init)=>http.request(new URL(input instanceof Request?input.url:String(input)).pathname,init)}));
      const packet=await f.auth.service.getPacket(token,contextRef),review=await client.callTool({name:"review_handoff_answer",arguments:{contextRef,submission:submission(packet)}}),fixture=JSON.stringify({html:scopedWidgetHtml(),metadata:review._meta!.hermeneusScopedReview}).replace(/</g,"\\u003c");
      await route.fulfill({contentType:"text/html; charset=utf-8",body:`<!doctype html><meta charset="utf-8"><h1>Local OAuth Chat host</h1><iframe id="widget" title="Hermeneus"></iframe><script>
        const fixture=${fixture},frame=document.getElementById('widget');frame.srcdoc=fixture.html;
        const send=()=>frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{_meta:{hermeneusScopedReview:fixture.metadata}}},'*');
        window.addEventListener('message',async e=>{if(e.source!==frame.contentWindow)return;const m=e.data;if(m.method==='ui/initialize'){e.source.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');send();}if(m.method==='tools/call'){const r=await fetch('/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(m.params)}).then(r=>r.json());e.source.postMessage({jsonrpc:'2.0',id:m.id,result:r},'*');}});</script>`});return;
    }
    if(u.origin===new URL(oauthClient.redirectUris[0]!).origin&&u.pathname==="/call"){
      toolCalls++;const response=await client.callTool(req.postDataJSON());await route.fulfill({json:response});return;
    }
    await route.abort();
  });
  const requests:string[]=[];page.on("request",r=>requests.push(r.url()));
  await page.goto(fixtureIssuer+"/authorize?"+q);
  return {...f,http,client,requests,token:()=>token,contextRef:()=>contextRef,calls:()=>toolCalls,
    async approve(){await page.locator("#share-link").fill(fixtureResource.replace(/\/mcp$/,"/share")+"#"+f.rawShare);await page.getByRole("checkbox").check();await page.getByRole("button",{name:"선택한 공유 건 연결"}).click();await expect(page.locator("#context-ref")).toBeVisible();contextRef=(await page.locator("#context-ref").textContent())!;},
    async close(){await client.close();await http.close();}};
}
test("same-browser Share consent -> PKCE callback -> signed-token MCP -> confirmed widget inspection",async({page})=>{
  const h=await harness(page);try{
    await expect(page.getByRole("heading",{name:"이 공유 건을 내 AI에 연결"})).toBeVisible();await h.approve();
    expect((await page.context().cookies()).some(c=>c.httpOnly&&c.secure&&c.name.startsWith("__Host-hermeneus-mcp-"))).toBe(true);
    await page.screenshot({path:"test-results/mcp-local/oauth-share-approved.png",fullPage:true});
    await page.getByRole("link",{name:"AI 연결 완료하기"}).click();const frame=page.frameLocator("#widget");
    await expect(frame.locator("#confirm")).toBeEnabled();await expect(frame.locator("#answer")).toContainText("웹 초안입니다.");await frame.locator("#confirm").check();await frame.locator("#check").click();
    await expect(frame.locator("#result")).toContainText("INDETERMINATE · 의미 검증 미실행");expect(h.calls()).toBe(1);await expect(frame.locator("#check")).toBeDisabled();
    for(const u of h.requests){expect(u).not.toContain(h.rawShare);expect(u).not.toContain("answerText");expect(u).not.toContain(h.token());}
    expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
    await page.screenshot({path:"test-results/mcp-local/oauth-widget-checked.png",fullPage:true});
  }finally{await h.close();}
});
test("browser denial creates no Share grant and returns the exact OAuth issuer/state",async({page})=>{
  const h=await harness(page);try{await page.getByRole("button",{name:"취소",exact:true}).click();await page.waitForURL("https://client.fixture.invalid/callback?**");await expect(page.getByRole("heading",{name:"연결을 취소했습니다"})).toBeVisible();expect(h.store.grants.size).toBe(0);}finally{await h.close();}
});
test("disconnect after approval blocks the code while original Share remains usable",async({page})=>{
  const h=await harness(page);try{await h.approve();const callback=(await page.locator("#continue").getAttribute("href"))!;await page.getByRole("button",{name:"이 연결 해제"}).click();await expect(page.getByRole("heading",{name:"연결을 해제했습니다"})).toBeVisible();
    const code=new URL(callback).searchParams.get("code")!;expect((await h.http.request("/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:oauthClient.id,grant_type:"authorization_code",code,code_verifier:opaque(),redirect_uri:oauthClient.redirectUris[0]!,resource:oauthResource})})).status).not.toBe(200);
    expect(await h.parents.byBearer(h.rawShare)).toBeTruthy();
  }finally{await h.close();}
});

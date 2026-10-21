import { test,expect } from "@playwright/test";
import { scopedWidgetHtml } from "../src/mcp/widget.js";
import { connected } from "../tests/mcp/client.js";
import { fixture,grant,submission } from "../tests/mcp/helpers.js";

// Fulfilled in-process, with no external network. Match the real host's secure UTF-8 context.
const origin="https://fixture.local";
async function harness(page:any,options:{answer?:string;fail?:boolean;delay?:boolean;expires?:boolean}={}) {
  const {f,client}=await connected(fixture()),g=await grant(f);
  const review=await client.callTool({name:"review_handoff_answer",arguments:{contextRef:g.contextRef,submission:submission(undefined,options.answer)}});
  const metadata=(review._meta as any).hermeneusScopedReview;
  if(options.expires)metadata.expiresAt=Date.now()+1200;
  const script=JSON.stringify({html:scopedWidgetHtml(),metadata}).replace(/</g,"\\u003c");
  let calls=0,release:()=>void=()=>{};
  await page.route(origin+"/**",async(route:any)=>{
    if(route.request().url().endsWith("/call")){
      calls++;if(options.delay)await new Promise<void>(resolve=>release=resolve);
      if(options.fail){await route.fulfill({json:{isError:true}});return;}
      const response=await client.callTool(route.request().postDataJSON());await route.fulfill({json:response});return;
    }
    await route.fulfill({contentType:"text/html; charset=utf-8",body:`<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Local synthetic MCP host</h1><iframe id="widget" title="Hermeneus"></iframe><button id="repeat">Repeat same metadata</button><button id="invalidate">New input</button><script>
    const fixture=${script},frame=document.getElementById('widget');frame.srcdoc=fixture.html;
    const send=()=>frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{_meta:{hermeneusScopedReview:fixture.metadata}}},'*');
    window.addEventListener('message',async e=>{if(e.source!==frame.contentWindow)return;const m=e.data;
      if(m.method==='ui/initialize'){e.source.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');send();}
      if(m.method==='tools/call'){const r=await fetch('/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(m.params)}).then(r=>r.json());e.source.postMessage({jsonrpc:'2.0',id:m.id,result:r},'*');}
    });document.getElementById('repeat').onclick=send;
    document.getElementById('invalidate').onclick=()=>frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{submission:{answerText:'new'}}}},'*');
    </script></body></html>`});
  });
  await page.goto(origin);const frame=page.frameLocator("#widget");await expect(frame.locator("#confirm")).toBeEnabled();
  return {f,frame,client,calls:()=>calls,release:()=>release()};
}
test("user original review -> actual MCP SDK inspection -> conservative exact result",async({page})=>{
  const h=await harness(page);try{
    await expect(h.frame.locator("#answer")).toHaveText(submission().answerText);
    await expect(h.frame.locator("#check")).toBeDisabled();await h.frame.locator("#confirm").check();
    await page.getByRole("button",{name:"Repeat same metadata"}).click();await expect(h.frame.locator("#confirm")).toBeChecked();
    await h.frame.locator("#check").click();await expect(h.frame.locator("#result")).toContainText("INDETERMINATE · 의미 검증 미실행");
    await expect(h.frame.locator("#confirm")).not.toBeChecked();await expect(h.frame.locator("#check")).toBeDisabled();expect(h.calls()).toBe(1);
    expect(await h.frame.locator("body").evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
    await page.screenshot({path:"test-results/mcp-local/widget-checked.png",fullPage:true});
  }finally{await h.client.close();}
});
test("revocation between display and click exposes no success and does not retry",async({page})=>{
  const h=await harness(page);try{h.f.packets.delete("cap-a");await h.frame.locator("#confirm").check();await h.frame.locator("#check").click();
    await expect(h.frame.locator("#status")).toContainText("검사 결과를 확인하지 못했습니다");await expect(h.frame.locator("#result")).toBeHidden();expect(h.calls()).toBe(1);
  }finally{await h.client.close();}
});
test("new input invalidates confirmation and discards a late old result",async({page})=>{
  const h=await harness(page,{delay:true});try{await h.frame.locator("#confirm").check();await h.frame.locator("#check").click();await expect.poll(h.calls).toBe(1);
    await page.getByRole("button",{name:"New input"}).click();await expect(h.frame.locator("#answer")).toHaveText("");h.release();
    await expect(h.frame.locator("#result")).toBeHidden();await expect(h.frame.locator("#check")).toBeDisabled();
  }finally{h.release();await h.client.close();}
});
test("expiry clears original, confirmation and result",async({page})=>{
  const h=await harness(page,{expires:true});try{await expect(h.frame.locator("#status")).toContainText("검토 시간이 만료됐습니다");
    await expect(h.frame.locator("#answer")).toHaveText("");await expect(h.frame.locator("#check")).toBeDisabled();
  }finally{await h.client.close();}
});
test("answer HTML stays literal and host failure stays unverified",async({page})=>{
  const answer='<img src=x onerror="window.injected=true">\n<script>window.injected=true</script> [HI-001]';
  const h=await harness(page,{answer,fail:true});try{await expect(h.frame.locator("#answer")).toHaveText(answer);await expect(h.frame.locator("#answer img, #answer script")).toHaveCount(0);
    await h.frame.locator("#confirm").check();await h.frame.locator("#check").click();await expect(h.frame.locator("#result")).toBeHidden();
    await expect(h.frame.locator("#status")).toContainText("자동 재시도하지 않습니다");expect(h.calls()).toBe(1);
  }finally{await h.client.close();}
});

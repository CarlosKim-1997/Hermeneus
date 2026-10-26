import {test,expect} from "@playwright/test";
import {items} from "../scripts/ux-preview/data";
const proposal={protocol:"hermeneus.portable-proposal/v0",title:"비공개 시험 이름",items:[{proposalId:"P-001",type:"OPEN",priority:"CORE",statement:"모바일 일정은 미정입니다."}],reviewNotes:["삭제하지 말고 발신자에게 확인할 내용입니다."]};
test("library search and status filters combine locally and recover from no matches",async({page})=>{
  let posts=0;page.on('request',request=>{if(request.method()==='POST')posts++;});
  await page.goto('/library');const records=page.locator('.handoff-library-item');await expect(records).toHaveCount(2);
  await page.getByRole('button',{name:/확정본 있음/}).press('Enter');await expect(records).toHaveCount(1);await expect(records).toContainText('전달본 확정');
  await page.getByLabel('전달 이름 또는 관리 번호 검색').fill('동료');await expect(records).toHaveCount(0);await expect(page.getByRole('heading',{name:'조건에 맞는 전달이 없어요.'})).toBeVisible();
  await page.getByRole('button',{name:'검색·필터 초기화'}).click();await expect(records).toHaveCount(2);
  await page.getByLabel('전달 이름 또는 관리 번호 검색').fill('HD_UX_DRAFT');await expect(records).toHaveCount(1);await expect(records).toContainText('동료 검토 전에 정리할 배경');expect(posts).toBe(0);
});
test("reader outline preserves every exact statement in order and supports keyboard jumps",async({page})=>{
  await page.goto('/shared');await expect(page.locator('.canon-entry > p')).toHaveText(items.map(item=>item.statement));
  const outline=page.getByRole('navigation',{name:'전달본 목차'});await expect(outline.getByRole('link')).toHaveCount(items.length);
  await outline.getByRole('link').last().press('Enter');await expect(page).toHaveURL(new RegExp('#canon-item-'+(items.length-1)+'$'));
  await expect(page.locator('#canon-item-'+(items.length-1))).toBeFocused();await expect(page.locator('.document-stamp')).toContainText('버전 1');
  await page.getByRole('button',{name:/가져온 답변 검사로 이동/}).click();await expect(page.locator('.panel-verification')).toBeFocused();await expect(page.getByLabel('확인할 AI 답변 원문',{exact:true})).toBeInViewport();
  await expect(page.getByText('현재 의미 검증이 꺼져 있습니다.',{exact:true})).toBeVisible();
});
test("creation keeps notes local, title opt-in and source import secondary",async({page})=>{
  await page.goto("/new");await expect(page.locator('li[aria-current="step"]')).toContainText("내 AI");
  await expect(page.getByLabel("대화 원문",{exact:true})).toBeHidden();
  await page.getByLabel("AI가 만든 전달 초안(JSON)",{exact:true}).fill("```json\n{}\n```");await page.getByRole('button',{name:'초안 미리보기',exact:true}).click();
  await expect(page.getByRole('alert')).toBeInViewport();
  await page.getByLabel("AI가 만든 전달 초안(JSON)",{exact:true}).fill(JSON.stringify(proposal));await page.getByRole('button',{name:'초안 미리보기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'가져온 초안 확인'})).toBeInViewport();
  await expect(page.getByLabel(/비공개 시험 이름/)).not.toBeChecked();await expect(page.getByRole('button',{name:'초안 만들고 검토하기'})).toBeDisabled();
  let sent:any;await page.route('**/__preview/action',async route=>{sent=route.request().postDataJSON();await route.fulfill({json:{ok:true,handoffId:'hd_ux_synthetic'}});});
  await page.getByLabel(/검토 메모를 확인했고/).check();await page.getByRole('button',{name:'초안 만들고 검토하기'}).click();await expect(page).toHaveURL(/\/review$/);
  expect(sent.action).toBe('bootstrap');expect(sent.args[0]).not.toHaveProperty('reviewNotes');expect(sent.args[0]).not.toHaveProperty('title');expect(sent.args[0].saveTitle).toBe(false);
});
test("draft save status, readable enum labels and empty recovery remain usable",async({page})=>{
  await page.goto('/review?state=empty');await expect(page.getByRole('heading',{name:'아직 작성한 항목이 없습니다'})).toBeVisible();await page.getByRole('button',{name:'첫 항목 추가'}).click();
  await page.getByLabel('전달할 내용',{exact:true}).fill('합성 요청입니다.');await page.getByLabel('내용 분류').selectOption('OPEN');await expect(page.getByLabel('내용 분류')).toHaveValue('OPEN');
  await expect(page.getByRole('status')).toContainText('저장하지 않은 변경');await page.getByRole('button',{name:'초안 저장',exact:true}).click();await expect(page.getByText('초안 수정 3을 저장했습니다.')).toBeVisible();
});
test("shared route distinguishes primary AI, unavailable verifier and exact checked text",async({page})=>{
  await page.goto('/shared');await expect(page.getByRole('heading',{name:'보낸 사람이 확정한 내용'})).toBeVisible();
  await expect(page.getByText('현재 의미 검증이 꺼져 있습니다.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'이 답변 검사',exact:true})).toBeDisabled();
  await page.getByLabel(/전달본을 외부 AI로 옮길 때/).check();await page.getByRole('button',{name:'설명 자료 준비',exact:true}).click();
  await expect(page.getByLabel('직접 복사할 설명 자료')).toContainText('');
  const text='금요일까지 웹 초안입니다. [HI-001]\n<script>not executed</script>';
  await page.getByLabel('확인할 AI 답변 원문',{exact:true}).fill(text);await page.getByRole('button',{name:'이 답변 검사',exact:true}).click();
  await expect(page.locator('.verification-result')).toContainText('INDETERMINATE');await expect(page.locator('.checked-answer')).toHaveText(text);await expect(page.locator('.checked-answer script')).toHaveCount(0);
  await page.getByLabel('확인할 AI 답변 원문',{exact:true}).fill('새 답변');await expect(page.locator('.verification-result')).toHaveCount(0);
});
test("a late verifier result cannot attach to edited answer",async({page})=>{
  await page.goto('/shared');await page.getByLabel(/전달본을 외부 AI로 옮길 때/).check();await page.getByRole('button',{name:'설명 자료 준비',exact:true}).click();await expect(page.getByLabel('직접 복사할 설명 자료')).toBeVisible();
  let release:()=>void=()=>{},started=false;
  await page.route('**/__preview/action',async route=>{if(route.request().postDataJSON().action==='verify'){started=true;await new Promise<void>(resolve=>release=resolve);}await route.continue();});
  await page.getByLabel('확인할 AI 답변 원문',{exact:true}).fill('이전 답변');await page.getByRole('button',{name:'이 답변 검사',exact:true}).click();await expect.poll(()=>started).toBe(true);
  await page.getByLabel('확인할 AI 답변 원문',{exact:true}).fill('새로 선택한 답변');release();await expect(page.getByRole('button',{name:'이 답변 검사',exact:true})).toBeEnabled();await expect(page.locator('.verification-result')).toHaveCount(0);
});
test("provider consent resets on changed text and after every check",async({page})=>{
  await page.goto('/shared?state=consent');await page.getByLabel(/전달본을 외부 AI로 옮길 때/).check();await page.getByRole('button',{name:'설명 자료 준비',exact:true}).click();await expect(page.getByLabel('직접 복사할 설명 자료')).toBeVisible();
  const consent=page.getByLabel(/이번 검사에 한해/);await page.getByLabel('확인할 AI 답변 원문',{exact:true}).fill('합성 답변');await consent.check();
  await page.getByLabel('그때 물어본 질문').fill('새 질문');await expect(consent).not.toBeChecked();await expect(page.getByRole('button',{name:'이 답변 검사',exact:true})).toBeDisabled();
  await consent.check();await page.getByRole('button',{name:'이 답변 검사',exact:true}).click();await expect(page.locator('.verification-result')).toContainText('INDETERMINATE');await expect(consent).not.toBeChecked();
});
test("deletion scopes and exact DELETE confirmation remain separate",async({page})=>{
  await page.goto('/review?state=retained');await page.getByRole('button',{name:'원문 삭제 범위 확인'}).click();await expect(page.getByText('대화 원문과 원문 근거를 영구 삭제합니다. 확정된 전달 내용은 유지됩니다.')).toBeVisible();
  await page.getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('button',{name:'전달 삭제 범위 확인'}).click();await expect(page.getByRole('button',{name:'전달 전체 영구 삭제'})).toBeVisible();
  await page.goto('/account');const button=page.getByRole('button',{name:'계정 영구 삭제',exact:true});await expect(button).toBeDisabled();await page.getByLabel(/DELETE를 정확히 입력/).fill('delete');await expect(button).toBeDisabled();await page.getByLabel(/DELETE를 정확히 입력/).fill('DELETE');await expect(button).toBeEnabled();
});
test("copy failure opens an actionable manual prompt and supports keyboard",async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('fixture denied'))}}));
  await page.goto('/new');await page.getByRole('button',{name:'AI에 줄 안내문 복사',exact:true}).press('Enter');
  await expect(page.getByLabel('AI에 줄 안내문',{exact:true})).toBeVisible();await expect(page.getByRole('status')).toContainText('직접 선택해 복사');
  await page.getByRole('button',{name:'안내문 접기',exact:true}).press('Enter');await expect(page.getByLabel('AI에 줄 안내문',{exact:true})).toBeHidden();
});
test("failed question and uncertain share creation preserve recovery without automatic retry",async({page})=>{
  let calls=0;await page.route('**/__preview/action',async route=>{calls++;await route.abort('failed');});
  await page.goto('/shared');await page.getByLabel('궁금한 점',{exact:true}).fill('합성 질문');await page.getByRole('button',{name:'질문하기',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('질문을 처리하지 못했습니다');await expect(page.getByRole('button',{name:'질문하기',exact:true})).toBeEnabled();expect(calls).toBe(1);
  await page.goto('/published');await page.getByRole('button',{name:'이 버전의 공유 링크 만들기',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('생성 결과를 확인하지 못했습니다');await expect(page.getByRole('button',{name:'이 버전의 공유 링크 만들기',exact:true})).toBeEnabled();expect(calls).toBe(2);
});
for(const width of [390,820,1280])test(`all screens at ${width}px have readable labels, no overflow or hydration errors`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const route of ['/library','/library?state=empty','/new','/review','/review?state=retained','/review?state=erased','/published','/shared','/receiver','/account','/account?state=erasing','/login','/error','/loading','/missing']){
    await page.goto(route);await expect(page.locator('main')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','ko');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),route).toBe(true);
    expect(await page.locator('input:not([type="hidden"]),select,textarea').evaluateAll(elements=>elements.every(element=>(element as HTMLElement).offsetParent===null||Boolean(element.id&&document.querySelector(`label[for="${element.id}"]`))||Boolean(element.closest('label')))),route).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.goto('/shared');
  const documentBox=await page.locator('.canon-document').boundingBox(),choicesBox=await page.locator('.receiver-route-choice').boundingBox();
  expect(documentBox).not.toBeNull();expect(choicesBox).not.toBeNull();
  if(width>=1100)expect(Math.abs(documentBox!.y-choicesBox!.y),'reading and actions share the top row').toBeLessThan(2);
  else expect(documentBox!.y,'read the document before supplementary routes').toBeLessThan(choicesBox!.y);
  await page.goto('/new');await page.screenshot({path:`test-results/ux/new-${width}.png`,fullPage:true});await page.goto('/shared');await page.screenshot({path:`test-results/ux/shared-${width}.png`,fullPage:true});await page.goto('/library');await page.screenshot({path:`test-results/ux/library-${width}.png`,fullPage:true});
});

test("UTC metadata hydrates without errors in a Korean browser across the date boundary",async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,locale:"ko-KR",timezoneId:"Asia/Seoul"});
  const page=await context.newPage(),errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
  try{
    for(const route of ["/published?state=with-links","/shared","/receiver","/review?state=erased","/library"]){
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("data-preview-hydrated","true");
      expect(errors,route).toEqual([]);
      if(route.startsWith("/published")){
        await expect(page.locator(".panel-share")).toContainText("2026-10-19 23:30:05 UTC");
        await expect(page.locator(".panel-share")).toContainText("2026-10-20 01:02:03 UTC");
      }
      if(route==="/shared"||route==="/receiver"||route.startsWith("/published")){
        await expect(page.locator(".canon-document")).toContainText("2026-10-20 00:00:00 UTC");
      }
      if(route.startsWith("/review"))await expect(page.locator(".panel-source")).toContainText("2026-10-19 23:30:05 UTC");
      if(route==="/library")await expect(page.locator("time").first()).toHaveText("2026-10-19");
      expect(errors,route).toEqual([]);
    }
  }finally{await context.close();}
});

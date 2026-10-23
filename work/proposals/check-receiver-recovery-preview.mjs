import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:1000}});
const errors=[]; const outgoing=[];
page.on('pageerror', e=>errors.push(e.message));
await page.route('https://**/*',route=>{outgoing.push(route.request().url());return route.abort();});
await page.route('http://**/*',route=>{outgoing.push(route.request().url());return route.abort();});
try {
  await page.goto(pathToFileURL(resolve('work/proposals/receiver-recovery-preview.html')).href);
  assert.equal(await page.locator('#start').isDisabled(),true);
  await page.locator('#consent').check(); await page.locator('#start').click();
  await page.locator('#simulate').click();
  assert.equal(await page.locator('#approve').isDisabled(),true);
  await page.locator('[name=share][value=b]').check(); await page.locator('#approve').click();
  assert.match(await page.locator('.document').innerText(),/인쇄 시안/);
  await page.locator('#answer').click();
  assert.equal(await page.locator('#inspect').isDisabled(),true);
  assert.match(await page.locator('blockquote').innerText(),/보라색/);
  await page.locator('#original').check(); await page.locator('#inspect').click();
  assert.match(await page.locator('#content').innerText(),/INDETERMINATE/);
  await page.locator('#again').click();
  assert.equal(await page.locator('#original').isChecked(),false);
  assert.equal(await page.locator('#inspect').isDisabled(),true);
  await mkdir('dist/receiver-recovery-preview',{recursive:true});
  await page.screenshot({path:'dist/receiver-recovery-preview/desktop-review.png',fullPage:true});
  for (const viewport of [{width:1280,height:1000},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    for(const state of ['ready','waiting','choose','connected','expired','unavailable','review','result']) {
      await page.locator(`[data-state=${state}]`).click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`${viewport.width}: ${state} overflow`);
    }
  }
  await page.locator('[data-state=expired]').click();
  await page.screenshot({path:'dist/receiver-recovery-preview/mobile-expired.png',fullPage:true});
  await page.locator('#restart').click();
  assert.equal(await page.locator('#consent').isChecked(),false);
  assert.equal(await page.locator('#start').isDisabled(),true);
  assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  assert.deepEqual(errors,[]);assert.deepEqual(outgoing,[]);
  console.log('PASS: explicit selection, confirmation reset, expiry restart, 16 viewport/state layouts, no network or storage; prototype only.');
} finally {await browser.close();}

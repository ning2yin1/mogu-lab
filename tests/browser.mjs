import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {today,shift} from '../src/model.js';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,acceptDownloads:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base='http://localhost:4173/mogu-lab/';
const payload=(date=shift(today(),-1),count=1)=>({schemaVersion:1,date,meals:Array.from({length:count},(_,i)=>({category:i?'snack':'breakfast',name:i?'チョコレート':'オートミール',time:i?'15:00':'08:00',foods:[{name:'テスト食品',amount:'40g'}],nutrients:{carbohydrateG:30,sugarsAvailableG:25,proteinG:8,fatG:null,omega3G:2,omega6G:8},estimated:true}))});
async function tab(name){await page.getByRole('navigation').getByRole('link',{name,exact:true}).click()}
async function importJSON(data){await page.locator('#json').fill(JSON.stringify(data));await page.locator('#preview').click();await page.locator('#commit-import').click();await page.locator('#preview-content').waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('#preview-content')?.innerHTML==='')}
try{
await page.goto(base);await page.getByRole('heading',{name:'今日のもぐラボ'}).waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await tab('記録');await importJSON(payload());assert.equal(await page.locator('.meal').count(),1);

await importJSON(payload());assert.equal(await page.locator('.meal').count(),1);
await importJSON(payload(undefined,2));assert.equal(await page.locator('.meal').count(),2);
// A replacement must be explicitly confirmed; malformed JSON never writes.
await page.locator('#json').fill('{bad');await page.locator('#preview').click();assert.equal(await page.locator('#import-error').isVisible(),true);assert.equal(await page.locator('.meal').count(),2);
await page.locator('#json').fill(JSON.stringify(payload()));await page.locator('#preview').click();await page.locator('#import-mode').selectOption('replace');page.once('dialog',d=>d.dismiss());await page.locator('#commit-import').click();assert.equal(await page.locator('.meal').count(),2);await page.locator('#import-mode').selectOption('append');await page.locator('#commit-import').click();await page.waitForFunction(()=>document.querySelector('#preview-content')?.innerHTML==='');
await page.locator('#has-appetite').check();await page.locator('#appetite').fill('8');await page.locator('#has-sleep').check();await page.locator('#sleep').fill('7.5');await page.locator('#exercise').selectOption('yes');await page.locator('#minutes').fill('20');await page.getByRole('button',{name:'この日の状態を保存'}).click();await page.getByRole('button',{name:/月経記録/}).click();
await page.locator('[data-edit]').first().click();const edited=payload();edited.meals[0].nutrients.sugarsAvailableG=40;await importJSON(edited);assert.match(await page.locator('#app').innerText(),/65 g/);
page.once('dialog',d=>d.accept());await page.locator('[data-delete]').last().click();await page.waitForFunction(()=>document.querySelectorAll('.meal').length===1);assert.match(await page.locator('#app').innerText(),/40 g/);assert.match(await page.locator('#app').innerText(),/未記録 \/ 不明/);
await page.reload();await page.locator('#record-date').fill(shift(today(),-1));await page.locator('#record-date').dispatchEvent('change');await page.locator('.meal').waitFor();assert.equal(await page.locator('.meal').count(),1);assert.equal(await page.locator('#appetite').inputValue(),'8');
await tab('履歴');await page.locator(`[data-date="${shift(today(),-1)}"]`).click();assert.equal(await page.locator('[data-heart]').getAttribute('aria-pressed'),'true');
await tab('分析');assert.equal(await page.locator('svg.chart').count(),3);assert.match(await page.locator('#app').innerText(),/1：4/);await page.locator('#period').selectOption('30');await page.locator('#metric').selectOption('sleep');
await tab('設定');const download=page.waitForEvent('download');await page.locator('#export').click();const file=await download;const path=await file.path();
page.on('dialog',d=>d.accept());await page.locator('#clear').click();await page.waitForFunction(()=>document.querySelector('#app').innerText.includes('食事 0件'));
await page.locator('#restore-file').setInputFiles(path);await page.locator('#restore-confirm').click();await page.waitForFunction(()=>document.querySelector('#app').innerText.includes('食事 1件'));
await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'設定',exact:true}).waitFor();await tab('履歴');await page.locator(`[data-date="${shift(today(),-1)}"]`).click();assert.equal(await page.locator('.meal').count(),1);await tab('分析');assert.equal(await page.locator('svg.chart').count(),3);
await tab('記録');await importJSON(payload(today()));assert.equal(await page.locator('.meal').count(),1);await page.reload();await page.locator('.meal').waitFor();assert.equal(await page.locator('.meal').count(),1);
await tab('ホーム');await page.screenshot({path:'/tmp/mogu-home.png',fullPage:true});for(const width of [320,375,390,430]){await page.setViewportSize({width,height:844});for(const name of ['ホーム','記録','履歴','分析','設定']){await tab(name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow at ${width}`)}}
assert.deepEqual(errors,[]);console.log('PASS: subpath, mobile widths, import/append/duplicate/edit/delete, day state, hearts, charts, reload persistence, backup/restore, offline navigation.');
}finally{await browser.close()}

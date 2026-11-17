import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {today} from '../src/model.js';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const tab=async name=>page.getByRole('navigation').getByRole('link',{name,exact:true}).click();
const meal=(name='昼食',omega3G=2,omega6G=8)=>({category:'lunch',name,foods:[{name:'オートミール',amount:'40g'},{name:'卵',amount:'1個'}],nutrients:{proteinG:12,carbohydrateG:30,sugarsAvailableG:25,dietaryFiberG:5,fatG:10,omega3G,omega6G,alaG:0.5,totalSugarsG:2}});
async function add(m){await tab('記録');await page.locator('#json').fill(JSON.stringify({schemaVersion:1,date:today(),meals:[m]}));await page.locator('#preview').click();await page.locator('#commit-import').click();await page.waitForFunction(()=>document.querySelector('#preview-content')?.innerHTML==='')}
try{
 await page.goto('http://localhost:4173/mogu-lab/');await page.getByRole('heading',{name:'今日のもぐラボ'}).waitFor();
 assert.equal(await page.locator('.omega-share').count(),0);
 const notes='オートミール40g・卵1個\n補足の全文 <確認>';await add({...meal(),notes});
 assert.equal(await page.locator('.meal-notes').getAttribute('open'),null);
 assert.equal(await page.locator('.meal-notes p').isVisible(),false);
 await page.getByText('補足を見る',{exact:true}).click();assert.equal(await page.locator('.meal-notes p').innerText(),notes);
 await page.getByText('補足を見る',{exact:true}).click();
 await page.reload();await page.locator('.meal').waitFor();assert.equal(await page.locator('.meal-notes p').isVisible(),false);
 assert.equal(await page.locator('.meal>h3').innerText(),'オートミール・卵');
 for(const sel of ['.meal details','.card:has(> h2:text("この日の栄養ノート"))']){
  assert.deepEqual(await page.locator(sel).first().locator('.macro-heading h3').allTextContents(),['たんぱく質','炭水化物','脂質']);
  assert.deepEqual(await page.locator(sel).first().locator('.carbohydrate .nutrient>span').allTextContents(),['糖質','食物繊維']);
 }
 assert.equal(await page.getByText('脂肪酸をさらに詳しく',{exact:true}).count(),0);
 await tab('ホーム');assert.match(await page.locator('.omega-labels').innerText(),/20%/);assert.match(await page.locator('.omega-labels').innerText(),/80%/);
 assert.equal(await page.locator('nav svg').count(),5);
 await add(meal('サバの定食',8,2));assert.equal(await page.locator('.meal').filter({has:page.getByRole('heading',{name:'サバの定食',exact:true})}).locator('.meal-notes').count(),0);assert.equal(await page.locator('.meal>h3').filter({hasText:'サバの定食'}).count(),1);await tab('ホーム');assert.match(await page.locator('.omega-labels').innerText(),/50%/);
 await tab('記録');await page.locator('.meal').filter({has:page.getByRole('heading',{name:'サバの定食',exact:true})}).locator('[data-edit]').click();const m=meal('サバの定食',3,2);await page.locator('#json').fill(JSON.stringify({schemaVersion:1,date:today(),meals:[m]}));await page.locator('#preview').click();await page.locator('#commit-import').click();await page.waitForFunction(()=>document.querySelector('#preview-content')?.innerHTML==='');await tab('ホーム');assert.match(await page.locator('.omega-labels').innerText(),/33.33%/);
 await tab('記録');page.once('dialog',d=>d.accept());await page.locator('.meal').filter({has:page.getByRole('heading',{name:'サバの定食',exact:true})}).locator('[data-delete]').click();await page.waitForFunction(()=>document.querySelectorAll('.meal').length===1);await tab('ホーム');assert.match(await page.locator('.omega-labels').innerText(),/20%/);
 await add(meal('不明な食事',null,1));await tab('ホーム');assert.equal(await page.locator('.omega-share').count(),0);assert.match(await page.locator('.omega-status').innerText(),/データ不完全/);
 await tab('設定');const dl=page.waitForEvent('download');await page.locator('#export').click();const download=await dl;const fs=await import('node:fs/promises');const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(backup.meals.find(m=>m.name==='昼食').name,'昼食');assert.equal(backup.meals.find(m=>m.name==='昼食').notes,notes);assert.equal(backup.meals.find(m=>m.name==='昼食').nutrients.alaG,0.5);assert.equal(backup.meals.find(m=>m.name==='昼食').nutrients.totalSugarsG,2);
 await tab('記録');assert.equal(await page.locator('#json').evaluate(e=>getComputedStyle(e).fontSize),'16px');assert.match(await page.locator('meta[name=viewport]').getAttribute('content'),/user-scalable=no/);
 await tab('設定');page.on('dialog',d=>d.accept());await page.locator('#clear').click();await page.waitForFunction(()=>document.querySelector('#app').innerText.includes('食事 0件'));await add(meal('ゼロ',0,0));await tab('ホーム');assert.equal(await page.locator('.omega-share').count(),0);assert.match(await page.locator('.omega-status').innerText(),/算出不可/);
 await tab('ホーム');await page.screenshot({path:'/tmp/mogu-revision.png',fullPage:true});
 console.log('PASS: omega daily totals/add/edit/delete/missing, food titles, macro order/details, retained hidden data, SVG nav, input font and viewport.');
}finally{await browser.close()}

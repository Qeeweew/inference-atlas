import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {topics,views} from '../src/curriculum.ts';
const base=(process.env.ATLAS_TEST_URL||'http://127.0.0.1:4174').replace(/\/$/,'');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
fs.mkdirSync('tests/screenshots',{recursive:true});
try{
 async function check(engine){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'page overflow '+page.url());
  assert.equal(await page.locator(`.study-main .source-link.${engine==='sglang'?'vllm':'sglang'}`).count(),0,'mixed framework evidence');
 }
 for(const engine of ['sglang','vllm'])for(const topic of topics){
  await page.goto(`${base}/#/${engine}/${topic.id}?view=map`);await page.getByRole('heading',{name:topic.title,exact:true,level:1}).waitFor();
  for(const view of views.filter(v=>v.id!=='lab'||topic.lab)){
   await page.getByRole('tab',{name:view.id==='lab'&&topic.id==='sources'?'文件索引':view.title,exact:true}).click();await check(engine);
  }
 }
 await page.goto(`${base}/#/sglang/scheduler`);await page.getByRole('heading',{level:1,name:'调度与连续批处理'}).waitFor();
 await page.locator('.mechanism-node').nth(1).click();assert.match(await page.locator('.mechanism-detail').innerText(),/ScheduleBatch/);
 await page.screenshot({path:'tests/screenshots/study-sglang-scheduler.png'});
 await page.getByRole('navigation',{name:'切换框架'}).getByRole('button',{name:/vLLM/}).click();assert.match(page.url(),/vllm\/scheduler/);
 await page.screenshot({path:'tests/screenshots/study-vllm-scheduler.png'});
 await page.getByRole('tab',{name:'对象与接口'}).click();await page.locator('summary').filter({hasText:'SchedulerOutput'}).click();
 await page.screenshot({path:'tests/screenshots/study-vllm-objects.png'});
 await page.locator('.source-link').filter({hasText:'SchedulerOutput'}).first().click();await page.locator('.code-row.highlight').first().waitFor();
 assert.match(await page.locator('.code-row.highlight').first().innerText(),/class SchedulerOutput/);
 const options=await page.locator('#file-select option').allTextContents();assert.ok(options.every(o=>!o.startsWith('SGLang')));
 await check('vllm');await page.screenshot({path:'tests/screenshots/study-code-desktop.png'});await page.getByRole('button',{name:'关闭源码',exact:true}).click();
 await page.getByRole('button',{name:/搜索 vLLM 与源码/}).click();await page.getByLabel('全站搜索').fill('MambaSpec');await page.locator('.search-result').first().waitFor();assert.doesNotMatch(await page.locator('.search-results').innerText(),/SGLang/);await page.getByRole('button',{name:'关闭搜索'}).click();
 await page.goto(`${base}/#/vllm/sparse`);await page.getByRole('heading',{name:'压缩与稀疏注意力',exact:true,level:1}).waitFor();assert.equal(await page.locator('.nav-group').filter({has:page.getByRole('heading',{name:/模型实现/})}).count(),1);
 await page.getByRole('navigation',{name:'DeepSeek V4 内容'}).getByRole('button',{name:'架构总览'}).click();assert.match(page.url(),/vllm\/deepseek/);
 await page.getByRole('tab',{name:'互动实验'}).click();await page.getByLabel('Checkpoint').selectOption('pro');assert.equal(await page.locator('.layer-tile').count(),61);
 await page.goto(`${base}/#/cache?code=sg.radix%23TreeNode`);await page.locator('.code-row.highlight').first().waitFor();assert.match(await page.locator('.code-row.highlight').first().innerText(),/class TreeNode/);await page.getByRole('button',{name:'关闭源码',exact:true}).click();
 await page.getByRole('button',{name:'04 发布 B 后缀'}).click();assert.equal(await page.locator('.radix-node.protected').count(),2);
 await page.getByRole('navigation',{name:'切换框架'}).getByRole('button',{name:/vLLM/}).click();await page.getByRole('button',{name:'05 B 释放引用'}).click();assert.equal(await page.locator('.free-queue button').count(),4);
 await page.getByLabel('前缀实验场景').selectOption('salt');assert.match(await page.getByTestId('prefix-hit').innerText(),/^0/);
 for(const width of [1024,736,360]){
  await page.setViewportSize({width,height:1000});
  for(const engine of ['sglang','vllm'])for(const topic of topics){
   await page.goto(`${base}/#/${engine}/${topic.id}?view=map`);await page.getByRole('heading',{name:topic.title,exact:true,level:1}).waitFor();await check(engine);
   if(width===360)for(const view of ['objects','design',...(topic.lab?['lab']:[])]){await page.getByRole('tab',{name:views.find(v=>v.id===view).title==='互动实验'&&topic.id==='sources'?'文件索引':views.find(v=>v.id===view).title,exact:true}).click();await check(engine);}
  }
 }
 await page.goto(`${base}/#/vllm/scheduler`);await page.getByRole('heading',{level:1,name:'调度与连续批处理'}).waitFor();await page.screenshot({path:'tests/screenshots/study-mobile.png'});
 await page.getByRole('button',{name:'切换深色主题'}).click();await page.locator('.mechanism-map').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screenshots/study-mobile-dark.png'});
 await page.getByRole('button',{name:'打开目录'}).click();await page.locator('.nav-item').filter({hasText:'Kimi K3'}).click();await page.getByRole('navigation',{name:'Kimi K3 内容'}).getByRole('button',{name:'KDA 与状态缓存'}).click();assert.match(page.url(),/vllm\/kda/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pages:topics.length*2,viewports:[1440,1024,736,360],checks:['framework isolation','all reading tabs','real object fields','source jumps','scoped source search','legacy URLs','model nesting','cache interactions','mobile navigation'],errors}));
}finally{await browser.close()}

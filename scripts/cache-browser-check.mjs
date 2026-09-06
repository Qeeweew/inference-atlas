import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
const base=process.env.ATLAS_TEST_URL||'http://127.0.0.1:4174';
async function noOverflow(){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 const overflow=await page.locator('.cache-lab').evaluateAll(labs=>labs.flatMap(l=>Array.from(l.querySelectorAll('*')).filter(el=>{if(el.closest('details:not([open])')&&!el.matches('summary'))return false;const r=el.getBoundingClientRect(),b=l.getBoundingClientRect();return r.width>0&&(r.right>b.right+2||r.left<b.left-2)}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,80)}))));
 assert.deepEqual(overflow,[],'Diagram overflow hidden inside lab');
}
await page.goto(`${base}/#/cache`);
await page.getByRole('heading',{name:'KV cache：SGLang 的 Radix Tree',exact:true}).waitFor();
await page.getByRole('button',{name:'02 B 查找 / 分裂'}).click();
await page.getByRole('button',{name:'查看树节点 P',exact:true}).click();
assert.equal(await page.locator('.radix-node:not(.ghost)').count(),3);
await noOverflow();
await page.locator('.cache-step-nav').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screenshots/cache-radix-desktop.png'});
await page.getByRole('button',{name:'04 发布 B 后缀'}).click();
assert.equal(await page.locator('.radix-node.protected').count(),2);
await page.getByRole('button',{name:'查看树节点 B',exact:true}).click();
await page.getByRole('button',{name:'06 淘汰 A 尾叶'}).click();
assert.equal(await page.getByRole('button',{name:'查看树节点 A',exact:true}).count(),0);
await page.locator('.source-link').filter({hasText:'TreeNode'}).first().click();
await page.locator('.code-row.highlight').first().waitFor();assert.match(await page.locator('.code-row.highlight').first().innerText(),/class TreeNode/);
await noOverflow();await page.getByRole('button',{name:'关闭源码',exact:true}).click();
await page.getByRole('navigation',{name:'KV cache 内容'}).getByRole('button',{name:'vLLM · 块哈希链',exact:true}).click();
await page.getByRole('button',{name:'03 引用 / 分配'}).click();assert.equal(await page.locator('.free-queue button').count(),1);
await page.getByRole('button',{name:'05 B 释放引用'}).click();assert.equal(await page.locator('.free-queue button').count(),4);
await page.getByRole('button',{name:'查看物理块 2',exact:true}).click();
await page.locator('.cache-step-nav').scrollIntoViewIfNeeded();await noOverflow();await page.screenshot({path:'tests/screenshots/cache-vllm-desktop.png'});
await page.locator('.cache-block-map').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screenshots/cache-vllm-queue.png'});
await page.getByRole('button',{name:'06 C 重用旧块'}).click();
await page.getByLabel('前缀实验场景').selectOption('salt');assert.match(await page.getByTestId('prefix-hit').innerText(),/^0/);
await page.getByLabel('前缀实验场景').selectOption('identical');assert.match(await page.getByTestId('prefix-hit').innerText(),/^4/);
await page.getByLabel('淘汰 A 的第二块索引', {exact:false}).check();assert.match(await page.getByTestId('prefix-hit').innerText(),/^2/);
await page.locator('.prefix-experiment').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screenshots/cache-prefix-experiment.png'});
await page.locator('.source-link').filter({hasText:'KVCacheBlock'}).first().click();await page.locator('.code-row.highlight').first().waitFor();assert.match(await page.locator('.code-row.highlight').first().innerText(),/class KVCacheBlock/);await noOverflow();await page.getByRole('button',{name:'关闭源码',exact:true}).click();
for(const width of [736,360]){
 await page.setViewportSize({width,height:1000});
 for(const route of ['cache','cache-vllm']){
  await page.goto(`${base}/#/${route}`);await page.locator('.cache-lab').first().waitFor();
  for(let i=0;i<6;i++){await page.locator('.cache-steps button').nth(i).click();await noOverflow();}
  await page.locator('.cache-steps button').nth(3).click();await page.locator(route==='cache'?'.radix-tree':'.hash-lanes').first().scrollIntoViewIfNeeded();await page.screenshot({path:`tests/screenshots/${route}-${width}.png`});
 }
}
await page.getByRole('button',{name:'切换深色主题'}).click();await page.locator('.cache-block-map').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screenshots/cache-vllm-mobile-dark.png'});
assert.deepEqual(errors,[]);console.log('Cache diagrams: lifecycle, field inspection, source jumps, prefix constraints, responsive layouts passed.');
await browser.close();

import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const prefix='/inference-atlas/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
let server;
let base=process.env.ATLAS_PAGES_URL;
if(!base){
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
  const relative=decodeURIComponent(pathname.slice(prefix.length))||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base=`http://127.0.0.1:${server.address().port}${prefix}`;
}
base=base.replace(/\/?$/,'/');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 await page.goto(`${base}#/cache?code=sg.radix%23TreeNode`);
 await page.locator('.code-row.highlight').first().waitFor();
 assert.match(await page.locator('.code-row.highlight').first().innerText(),/class TreeNode/);
 await page.getByRole('button',{name:'复制仓库代码位置',exact:true}).click();
 assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/^sglang\/python\/.+:\d+$/);
 assert.match(await page.getByRole('link',{name:'打开远程源码',exact:true}).getAttribute('href'),/^https:\/\/github.com\/sgl-project\/sglang\/blob\/[a-f0-9]{40}\//);
 await page.reload();await page.locator('.code-row.highlight').first().waitFor();
 await page.getByRole('button',{name:'关闭源码',exact:true}).click();
 await page.getByRole('navigation',{name:'切换框架'}).getByRole('button',{name:/vLLM/}).click();
 await page.getByRole('button',{name:'03 引用 / 分配'}).click();
 await page.locator('.source-link').filter({hasText:'KVCacheBlock'}).first().click();
 await page.locator('.code-row.highlight').first().waitFor();assert.match(await page.locator('.code-row.highlight').first().innerText(),/class KVCacheBlock/);
 const sourceURL=new URL('source-index.json',base).href;
 const manifest=await (await page.request.get(sourceURL)).json();
 for(const file of Object.values(manifest.files))assert.equal(path.isAbsolute(file.localPath),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({base,checks:['project subpath','lazy source loading','deep link refresh','portable copy location','pinned upstream link','KV interactions'],errors}));
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve))}

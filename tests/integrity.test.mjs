import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {topics} from '../src/curriculum.ts';
import {scheduleDemo,cacheDemo,k3Memory,sparseDemo,speculativeEstimate} from '../src/simulations.mjs';
const index=JSON.parse(fs.readFileSync(new URL('../src/source-index.json',import.meta.url)));
const files=index.files;
test('all authored evidence resolves to actual file and exact symbol',()=>{
 const app=new URL('../src/',import.meta.url);
 let checked=0;
 for(const filename of fs.readdirSync(app).filter(f=>/\.tsx?$/.test(f))){
  const text=fs.readFileSync(new URL(filename,app),'utf8');
  for(const m of text.matchAll(/['"]((?:sg|vl|config|test)\.[A-Za-z0-9_.-]+(?:#[A-Za-z0-9_.]+)?)['"]/g)){
   const [id,anchor]=m[1].split('#');assert.ok(files[id],`${filename}: ${id}`);
   if(anchor&&!/^L\d+$/.test(anchor))assert.ok(files[id].symbols.some(s=>s.name===anchor),m[1]);
   checked++;
  }
 }
 assert.ok(checked>200);
});
test('bundled source snapshots match recorded hashes and have valid line numbers',()=>{
 for(const file of Object.values(files)){
  const snapshot=JSON.parse(fs.readFileSync(new URL('../public/'+file.url,import.meta.url))).text;
  assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'),file.sha256,file.id);
  for(const symbol of file.symbols)assert.ok(symbol.line>=1&&symbol.end<=file.lineCount,symbol.name);
 }
});
test('available upstream checkouts are byte-equivalent to bundled evidence',t=>{
 const app=fileURLToPath(new URL('..',import.meta.url));
 let checked=0;
 for(const file of Object.values(files)){
  if(file.repo==='config')continue;
  const local=path.resolve(app,file.localPath);
  if(!fs.existsSync(local))continue;
  const snapshot=JSON.parse(fs.readFileSync(new URL('../public/'+file.url,import.meta.url))).text;
  assert.equal(snapshot,fs.readFileSync(local,'utf8'),file.id);checked++;
 }
 if(!checked)t.skip('Upstream checkouts are optional; bundled content hashes are checked separately.');
});
test('source indexes are portable and synchronized',()=>{
 const publicIndex=JSON.parse(fs.readFileSync(new URL('../public/source-index.json',import.meta.url)));
 assert.deepEqual(index,publicIndex);
 for(const file of Object.values(files))assert.equal(path.isAbsolute(file.localPath),false,file.id);
});
test('all topics form a valid hierarchy',()=>{
 const ids=topics.map(t=>t.id);assert.equal(new Set(ids).size,ids.length);
 for(const t of topics)if(t.parent)assert.ok(ids.includes(t.parent));
});
test('scheduler conserves work, respects arrivals and all token budgets',()=>{
 for(const budget of [4,8,16,32])for(const chunk of [4,8,16,32])for(const decodeFirst of [true,false]){
  const rounds=scheduleDemo({budget,chunk,decodeFirst});const consumed={A:0,B:0,C:0};
  for(const r of rounds){assert.ok(r.used<=budget);assert.equal(r.used,r.slots.reduce((n,s)=>n+s.tokens,0));for(const s of r.slots){consumed[s.id]+=s.tokens;if(s.id==='C')assert.ok(r.round>=3);if(s.phase==='prefill')assert.ok(s.tokens<=chunk)}}
  assert.deepEqual(consumed,{A:4,B:28,C:11});assert.ok(rounds.at(-1).remaining.every(r=>r.outputLeft===0&&r.promptLeft===0));
 }
});
test('prefix cache shares only causal full-block prefixes, not matching suffixes',()=>{
 const hit=cacheDemo('a b c d e','a b c d f',4);assert.equal(hit.fullBlocks,1);assert.equal(hit.physicalBlocks,3);
 assert.equal(cacheDemo('x b c d','y b c d',2).fullBlocks,0);
 assert.equal(cacheDemo('a b c','a b c d',4).reusableTokens,0);
 assert.equal(cacheDemo('','',4).physicalBlocks,0);
});
test('memory axes distinguish TP recurrent sharding from DCP latent-history sharding',()=>{
 const one=k3Memory({context:1024,requests:1,tp:1,dcp:1,kvBytes:2}),eight=k3Memory({context:1024,requests:1,tp:8,dcp:1,kvBytes:2}),cp=k3Memory({context:1024,requests:1,tp:8,dcp:8,kvBytes:2});
 assert.equal(one.recurrent/eight.recurrent,8);assert.equal(one.mla,eight.mla);assert.equal(eight.mla/cp.mla,8);assert.equal(eight.conv,cp.conv);
 assert.equal(one.mla,24*576*2*1024);
});
test('sparse boundaries do not expose incomplete groups',()=>{
 for(const ratio of [4,128]){assert.equal(sparseDemo({length:ratio-1,ratio}).completed,0);assert.equal(sparseDemo({length:ratio,ratio}).completed,1);assert.equal(sparseDemo({length:ratio+1,ratio}).pending,1);}
 assert.equal(sparseDemo({length:8192,ratio:4,topk:512}).selected,512);
 assert.equal(sparseDemo({length:131072,ratio:128,topk:512}).selected,1024);
});
test('speculation model includes correction token and can predict slowdown',()=>{
 assert.equal(speculativeEstimate({tokens:4,acceptance:0,draft:.2,verify:2}).expected,1);
 assert.equal(speculativeEstimate({tokens:4,acceptance:1,draft:.2,verify:2}).expected,5);
 assert.ok(speculativeEstimate({tokens:4,acceptance:.1,draft:.2,verify:2}).speedup<1);
});
test('model layer maps exclude MTP entries and agree with official configuration',()=>{
 const k=JSON.parse(fs.readFileSync(new URL('../src/kimi-config.json',import.meta.url))).text_config;
 assert.equal(k.linear_attn_config.kda_layers.length,69);assert.equal(k.linear_attn_config.full_attn_layers.length,24);assert.equal(k.num_shared_experts,2);
 for(const [model,n] of [['flash',43],['pro',61]]){const c=JSON.parse(fs.readFileSync(new URL(`../src/${model}-config.json`,import.meta.url)));assert.equal(c.num_hidden_layers,n);assert.equal(c.compress_ratios.length,n+1);assert.equal(c.compress_ratios.at(-1),0)}
});

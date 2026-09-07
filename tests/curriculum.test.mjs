import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {topics,guideFor,parseRoute,routeURL,views} from '../src/curriculum.ts';
import {objectContracts} from '../src/objectContracts.ts';
const files=JSON.parse(fs.readFileSync(new URL('../src/source-index.json',import.meta.url))).files;
test('every topic has independently authored framework content and local evidence',()=>{
 for(const topic of topics){
  const sg=guideFor('sglang',topic.id),vl=guideFor('vllm',topic.id);
  assert.ok(sg&&vl);assert.notEqual(sg.answer,vl.answer);assert.notDeepEqual(sg.nodes,vl.nodes);
  for(const engine of ['sglang','vllm']){
   const g=guideFor(engine,topic.id);assert.ok(g.question&&g.answer&&g.nodes.length>=3&&g.decisions.length>=2);
   for(const n of g.nodes){const [id,anchor]=n.ref.split('#');assert.ok(files[id]);assert.ok(files[id].repo===engine||files[id].repo==='config',`${engine} ${topic.id} ${n.ref}`);if(anchor)assert.ok(files[id].symbols.some(s=>s.name===anchor));assert.ok(n.input&&n.output&&n.detail)}
   assert.doesNotMatch(JSON.stringify(g),engine==='sglang'?/vLLM|vl\./:/SGLang|sg\./);
  }
 }
});
test('model hierarchy and framework-aware routes round-trip with deep links',()=>{
 assert.deepEqual(topics.filter(t=>t.group==='模型实现'&&!t.parent).map(t=>t.id),['kimi','deepseek']);
 assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
 for(const engine of ['sglang','vllm'])for(const topic of topics)for(const view of views.filter(v=>v.id!=='lab'||topic.lab)){
  const route=parseRoute(routeURL(engine,topic.id,view.id,'config.kimi-k3'));
  assert.deepEqual(route,{engine,topic:topic.id,view:view.id,code:'config.kimi-k3'});
 }
 assert.equal(parseRoute('#/cache-vllm').engine,'vllm');assert.equal(parseRoute('#/cache-vllm').topic,'cache');
 assert.equal(parseRoute('#/cache?code=sg.radix%23TreeNode').code,'sg.radix#TreeNode');
 assert.equal(parseRoute('#/kimi').topic,'kimi');
});
test('documented fields occur inside their actual source class',()=>{
 for(const [key,objects] of Object.entries(objectContracts))for(const object of objects){
  const [id,anchor]=object.ref.split('#');const file=files[id];assert.equal(file.repo,key.split(':')[0]);
  const symbol=file.symbols.find(s=>s.name===anchor);assert.ok(symbol,object.ref);
  const source=JSON.parse(fs.readFileSync(new URL('../public/'+file.url,import.meta.url))).text.split('\n').slice(symbol.line-1,symbol.end).join('\n');
  for(const [fields] of object.fields)for(const field of fields.split(/\s*\/\s*/))assert.match(source,new RegExp(`\\b${field}\\b`),`${object.ref}: ${field}`);
 }
});

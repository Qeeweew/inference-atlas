import test from 'node:test';
import assert from 'node:assert/strict';
import {prefixScenario,radixStage,vllmStage} from '../src/cacheScenarios.ts';
import {parseRoute,topics} from '../src/curriculum.ts';
test('prefix identity includes causal ancestry and first-block salt',()=>{
 for(const kind of ['suffix','salt']){
  const x=prefixScenario(kind);assert.equal(x.hitTokens,0);
  for(let i=0;i<x.second.length;i++)assert.notEqual(x.first[i].hash,x.second[i].hash);
 }
 assert.equal(prefixScenario('branch').hitTokens,4);
 assert.equal(prefixScenario('unaligned').hitTokens,2);
 assert.equal(prefixScenario('unaligned',4).hitTokens,0);
});
test('residency is independent from logical hashes; full-attention hit cannot cross a hole',()=>{
 const resident=prefixScenario('identical'),evicted=prefixScenario('identical',2,true);
 assert.deepEqual(resident.first,evicted.first);assert.deepEqual(resident.second,evicted.second);
 assert.ok(evicted.resident.has(evicted.first[2].hash));assert.equal(evicted.hitTokens,2);
 assert.equal(resident.hitTokens,4);assert.ok(resident.hitTokens<resident.b.length);
});
test('radix split preserves payload locations and locks protect every ancestor',()=>{
 const original=radixStage(0).nodes.flatMap(n=>n.value).sort((a,b)=>a-b);
 assert.deepEqual(radixStage(1).nodes.flatMap(n=>n.value).sort((a,b)=>a-b),original);
 for(let step=0;step<6;step++){
  const state=radixStage(step),byId=new Map(state.nodes.map(n=>[n.id,n]));
  for(const node of state.nodes){
   assert.equal(node.key.length,node.value.length);
   if(node.parent){const parent=byId.get(node.parent);assert.ok(parent.children.includes(node.id));if(node.lock)assert.ok(parent.lock);}
  }
  const slots=state.nodes.flatMap(n=>n.value);assert.equal(new Set(slots).size,slots.length);
  assert.equal(state.protectedTokens+state.evictableTokens,slots.length);
  if(state.lastNode){let n=byId.get(state.lastNode);while(n.parent){assert.ok(n.lock);n=byId.get(n.parent)}}
 }
 const final=radixStage(5);assert.deepEqual(final.nodes.flatMap(n=>n.value).sort((a,b)=>a-b),[40,41,70,71,100,101]);
});
test('block lifecycle separates active ownership, free queue, and cached identity',()=>{
 for(let step=0;step<6;step++){
  const s=vllmStage(step);assert.equal(new Set(s.queue).size,s.queue.length);
  for(const b of s.blocks){assert.equal(s.queue.includes(b.id),b.ref===0);assert.equal(s.request.includes(b.id),b.ref>0)}
 }
 const allocated=vllmStage(2).blocks.find(b=>b.id===12);assert.equal(allocated.ref,1);assert.equal(allocated.hash,null);
 assert.equal(vllmStage(3).blocks.find(b=>b.id===12).hash,'HB3');
 assert.ok(vllmStage(4).blocks.every(b=>b.ref===0&&b.hash));
 const reused=vllmStage(5).blocks.find(b=>b.id===9);assert.equal(reused.hash,null);assert.equal(reused.ref,1);
 assert.equal(vllmStage(5).blocks.find(b=>b.id===7).hash,'H1');
});
test('legacy cache routes keep their framework and model hierarchy stays distinct',()=>{
 assert.equal(parseRoute('#/cache').engine,'sglang');assert.equal(parseRoute('#/cache-vllm').engine,'vllm');
 assert.equal(topics.filter(t=>t.group==='模型实现'&&!t.parent).length,2);
});

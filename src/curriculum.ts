import {sglangGuide} from './sglangGuide.ts';
import {vllmGuide} from './vllmGuide.ts';
import {cacheChapters} from './cacheContent.ts';
import type {Framework} from './curriculumTypes.ts';
export type Topic={id:string;title:string;group:string;parent?:string;lab?:string};
export const topics:Topic[]=[
 {id:'overview',title:'架构导航',group:'引擎主线'},
 {id:'lifecycle',title:'请求生命周期',group:'引擎主线',lab:'trace'},
 {id:'scheduler',title:'调度与连续批处理',group:'引擎主线',lab:'scheduler'},
 {id:'execution',title:'执行与 CUDA Graph',group:'引擎主线'},
 {id:'cache',title:'KV cache 与前缀复用',group:'状态与计算',lab:'cache'},
 {id:'hybrid',title:'混合状态与恢复边界',group:'状态与计算'},
 {id:'attention',title:'Attention 与后端',group:'状态与计算'},
 {id:'moe',title:'专家路由与 MoE',group:'状态与计算'},
 {id:'kimi',title:'Kimi K3',group:'模型实现',lab:'layers-k3'},
 {id:'kda',title:'KDA 与状态缓存',group:'模型实现',parent:'kimi',lab:'memory'},
 {id:'kimi-depth',title:'AttnRes 与 LatentMoE',group:'模型实现',parent:'kimi'},
 {id:'deepseek',title:'DeepSeek V4',group:'模型实现',lab:'layers-v4'},
 {id:'sparse',title:'压缩与稀疏注意力',group:'模型实现',parent:'deepseek',lab:'sparse'},
 {id:'parallel',title:'并行与通信',group:'运行与工程',lab:'parallel'},
 {id:'disaggregation',title:'PD 分离与分层存储',group:'运行与工程'},
 {id:'speculation',title:'投机解码与回滚',group:'运行与工程',lab:'speculation'},
 {id:'quantization',title:'量化与硬件选择',group:'运行与工程'},
 {id:'serving',title:'多模态与输出协议',group:'运行与工程'},
 {id:'operations',title:'性能诊断',group:'运行与工程',lab:'diagnosis'},
 {id:'testing',title:'扩展与测试',group:'运行与工程'},
 {id:'sources',title:'源码与证据',group:'运行与工程',lab:'sources'},
];
export const topicGroups=[...new Set(topics.map(t=>t.group))];
export const guideFor=(engine:Framework,topic:string)=>(engine==='sglang'?sglangGuide:vllmGuide)[topic];
export const detailsFor=(engine:Framework,topic:string)=>topic==='cache'?cacheChapters[engine==='sglang'?0:1].sections:[];
export const views=[{id:'map',title:'结构总览'},{id:'flow',title:'执行过程'},{id:'objects',title:'对象与接口'},{id:'design',title:'设计取舍'},{id:'lab',title:'互动实验'}] as const;
export type View=typeof views[number]['id'];
export function parseRoute(hash:string){
 const [path,query]=hash.replace(/^#\/?/,'').split('?');const parts=path.split('/');
 const engine:Framework=parts[0]==='vllm'||path==='cache-vllm'?'vllm':'sglang';
 const id=parts.length>1?parts[1]:path==='cache-vllm'?'cache':path;
 const topic=topics.find(t=>t.id===id)?.id??'overview';const params=new URLSearchParams(query);
 const requested=params.get('view');const view:View=views.some(v=>v.id===requested)?requested as View:topic==='cache'?'lab':'map';
 return {engine,topic,view:view==='lab'&&!topics.find(t=>t.id===topic)?.lab?'map' as View:view,code:params.get('code')};
}
export function routeURL(engine:Framework,topic:string,view:View,code:string|null=null){const params=new URLSearchParams();params.set('view',view);if(code)params.set('code',code);return `#/${engine}/${topic}?${params}`;}

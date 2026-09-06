import {useMemo,useState,useEffect,useRef} from 'react';
import {ReactFlow,Background,Controls,MarkerType,Position,Handle,type NodeProps} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {ArrowRight,Layers3} from 'lucide-react';
import type {Engine,OpenCode} from './data';
import {References} from './References';
const stages=[
 {name:'请求入口',sg:'HTTP · TokenizerManager',vl:'API · AsyncLLM',sgRef:'sg.tokenizer',vlRef:'vl.async',chapter:'lifecycle',detail:'验证与编码输入，把请求送入服务引擎；字符串/媒体处理与关键调度路径分离。'},
 {name:'调度与批次',sg:'Scheduler · ScheduleBatch',vl:'EngineCore · Scheduler',sgRef:'sg.scheduler#Scheduler.get_next_batch_to_run',vlRef:'vl.scheduler#Scheduler.schedule',chapter:'scheduler',detail:'决定本轮 token 工作量、请求优先级和资源分配；批次随请求到达与结束持续变化。'},
 {name:'状态与存储',sg:'Radix · UnifiedCache · Pool',vl:'KVCacheManager · BlockPool',sgRef:'sg.unified',vlRef:'vl.kv#KVCacheManager',chapter:'cache',detail:'查找共同可复用前缀，分配物理 KV/状态槽，维护活动引用与可回收边界。此节点表示调度/执行共享的状态职责，不是独立串行计算阶段。'},
 {name:'执行与元数据',sg:'TpModelWorker · ModelRunner',vl:'Worker · GPUModelRunner',sgRef:'sg.runner',vlRef:'vl.runner',chapter:'execution',detail:'把调度结果物化成 GPU 输入、页表与位置索引，选择 eager/graph 路径并调用模型。'},
 {name:'模型与算子',sg:'KDA / MLA · MoE · kernels',vl:'KDA / sparse MLA · MoE',sgRef:'sg.k3#KimiK3DecoderLayer',vlRef:'vl.v4#DeepseekV4DecoderLayer',chapter:'kimi',detail:'模型决定 attention、残差与专家的数学；backend 按硬件、dtype、shape 选择实际 kernel。'},
 {name:'采样与反馈',sg:'Sampler · Detokenizer',vl:'Sampler · OutputProcessor',sgRef:'sg.sampler',vlRef:'vl.sampler',chapter:'serving',detail:'生成 token、更新完成状态并流式返回；采样结果影响下一轮调度，结束请求则释放活动引用。'}
];
function AtlasNode({data}:NodeProps){return <><Handle type="target" position={Position.Top}/><div className={`atlas-node ${data.repo}`}><div className="node-kicker">{String(data.index)} / {String(data.stage)}</div><strong>{String(data.label)}</strong><div className="node-hint">{data.repo==='sglang'?'SGLang':'vLLM'} <ArrowRight size={12}/></div></div><Handle type="source" position={Position.Bottom}/></>}
const nodeTypes={atlas:AtlasNode};
export function Architecture({engine,open,go,theme}:{engine:Engine;open:OpenCode;go:(id:string)=>void;theme:'light'|'dark'}){
 const [selection,setSelection]=useState(1);
 const holder=useRef<HTMLDivElement>(null);const [narrow,setNarrow]=useState(window.innerWidth<600);
 useEffect(()=>{const el=holder.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setNarrow(entry.contentRect.width<560));observer.observe(el);return()=>observer.disconnect()},[]);
 const {nodes,edges}=useMemo(()=>{
 const repos=engine==='both'?['sglang','vllm']:[engine];
 const nodes=repos.flatMap((repo,col)=>stages.map((st,i)=>({id:`${repo}-${i}`,type:'atlas',position:{x:col*306,y:i*108},data:{label:repo==='sglang'?st.sg:st.vl,stage:st.name,index:`0${i+1}`,repo},selected:selection===i,draggable:false,ariaLabel:`${repo} ${st.name}`})));
 const edges=repos.flatMap(repo=>stages.slice(1).map((_,i)=>({id:`${repo}-e${i}`,source:`${repo}-${i}`,target:`${repo}-${i+1}`,markerEnd:{type:MarkerType.ArrowClosed},type:'smoothstep'})));
 return {nodes,edges};},[engine,selection]);
 const st=stages[selection];
 return <div className="lab architecture" ref={holder}><div className="lab-heading"><div><span className="eyebrow">SYSTEM MAP</span><h3>点击一个层次，沿职责进入代码</h3></div><span className="subtle-tag">精选架构关系 · 非完整调用图</span></div>{narrow?<div className="mobile-map">{stages.map((stage,i)=><button key={stage.name} className={selection===i?'selected':''} onClick={()=>setSelection(i)} aria-pressed={selection===i}><span className="mobile-stage">0{i+1} / {stage.name}</span>{engine!=='vllm'&&<span><b>SGLang</b>{stage.sg}</span>}{engine!=='sglang'&&<span><b>vLLM</b>{stage.vl}</span>}</button>)}</div>:<div className="flow-surface"><ReactFlow key={engine} nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_,n)=>setSelection(Number(n.id.split('-').at(-1)))} fitView fitViewOptions={{padding:.1}} minZoom={.45} maxZoom={1.6} nodesConnectable={false} colorMode={theme} zoomOnScroll={false} preventScrolling={false}><Background gap={22} size={1}/><Controls showInteractive={false}/></ReactFlow></div>}<div className="map-detail" aria-live="polite"><Layers3 size={20}/><div><h4>{st.name}</h4><p>{st.detail}</p><References refs={[st.sgRef,st.vlRef]} open={open} engine={engine}/></div><button className="button" onClick={()=>go(st.chapter)}>深入阅读 <ArrowRight size={14}/></button></div></div>
}

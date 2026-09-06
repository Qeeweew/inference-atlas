import {useState, type ReactNode} from 'react';
import {ChevronLeft, ChevronRight, MousePointer2} from 'lucide-react';
import {References} from './References';
import type {OpenCode} from './data';
import {prefixScenario,radixStage,vllmStage,type PrefixScenario} from './cacheScenarios';
import './cache.css';
type Props={open:OpenCode};
const arr=(v:(number|string)[])=>`[${v.join(', ')}]`;
function Fields({rows}:{rows:[string,ReactNode][]}){return <dl className="cache-fields">{rows.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
function Steps({steps,step,setStep}:{steps:string[];step:number;setStep:(s:number)=>void}){return <><div className="cache-step-nav"><span className="eyebrow">生命周期 · {step+1} / {steps.length}</span><div><button className="icon-button" aria-label="缓存上一步" disabled={step===0} onClick={()=>setStep(step-1)}><ChevronLeft size={17}/></button><button className="button small-button" disabled={step===steps.length-1} onClick={()=>setStep(step+1)}>下一步<ChevronRight size={15}/></button></div></div><div className="cache-steps" aria-label="缓存生命周期">{steps.map((s,i)=><button key={s} aria-pressed={step===i} onClick={()=>setStep(i)}><small>0{i+1}</small>{s}</button>)}</div></>}
const radixSteps=['A 已缓存','B 查找 / 分裂','B 锁定 / 扩展','发布 B 后缀','B 结束 / 解锁','淘汰 A 尾叶'];
const radixNotes=[
 ['一段六 token，只需要一个压缩节点','A 已完成并释放活动引用。六个 KV 位置留在树中，lock_ref=0，可以继续命中，也可被淘汰。','sg.radix#RadixCache.insert'],
 ['公共四 token 成为新父节点 P','B=[11,12,13,14,21,22] 命中到 14。match_prefix 分裂原节点：P 保存公共段，A 保留 [15,16]。位置索引被切片，KV 数据留在原槽。','sg.radix#RadixCache._split_node'],
 ['锁定 P；B 私有后缀尚未进入树','inc_lock_ref(P) 保护四个公共位置。B 的请求行接上新分配的 [100,101]；这两个位置属于在途计算，并未登记成树节点。','sg.radix#RadixCache.inc_lock_ref'],
 ['后缀完成后插入，并把 last_node 移到 B','cache_unfinished_req 发布 B 的已完成位置，重新匹配规范索引并切换锁：P 与 B 各 lock_ref=1。A 的旧尾叶仍可驱逐。','sg.radix#RadixCache.cache_unfinished_req'],
 ['释放请求行，树继续保存八个位置','B 完成后沿 B→P 解锁。两个前缀都保留在缓存中；公共四个位置只保存一份。图省略生成 token，仅追踪这六个输入位置的生命周期。','sg.radix#RadixCache.cache_finished_req'],
 ['回收 [90,91]，公共祖先保持可达','示例选择 A 尾叶淘汰，allocator 收回两个 KV 槽。P 仍有子节点 B，不能把它当作叶子直接删除；B 的整段前缀仍可复用。','sg.radix#RadixCache.evict']
];
export function RadixLab({open}:Props){
 const [step,setStep]=useState(0),[selected,setSelected]=useState('A');
 const state=radixStage(step),current=state.nodes.find(n=>n.id===selected)??state.nodes[1];
 const note=radixNotes[step];
 const node=(id:string)=>{const n=state.nodes.find(n=>n.id===id);return n?<button className={`radix-node ${n.lock&&n.id!=='root'?'protected':''} ${current.id===id?'selected':''}`} aria-label={`查看树节点 ${id}`} aria-pressed={current.id===id} onClick={()=>setSelected(id)}><span className="node-caption"><b>{id==='root'?'root · 哨兵':`TreeNode ${id}`}</b><em>lock_ref {n.lock}</em></span><code>key {arr(n.key)}</code><code>value {arr(n.value)}</code><small>{id==='root'?'空路径 · 不存 KV':n.lock?'路径受保护':n.children.length?'未锁定内部节点':'可驱逐叶子'}</small></button>:<div className="radix-node ghost"><b>{id==='B'?'B 后缀':'A 尾叶'}</b><span>{id==='B'?(step===2?'私有位置 [100,101] · 尚未入树':'尚未插入树'):'已删除 · 槽 [90,91] 已回收'}</span></div>};
 return <div className="lab cache-lab radix-lab"><div className="lab-heading"><div><span className="eyebrow">SGLANG · COMPRESSED PREFIX TREE</span><h3>让公共前缀长成一棵树</h3></div><span className="subtle-tag">位置级教学示例</span></div><p className="cache-assumption">A = [11,12,13,14,15,16] · B = [11,12,13,14,21,22]。page_size=2；同一命名空间。槽号为示意，按经典 RadixCache 展示。</p>
 <Steps steps={radixSteps} step={step} setStep={setStep}/>
 <div className="cache-stage-note" aria-live="polite"><h4>{note[0]}</h4><p>{note[1]}</p><References refs={[note[2]]} open={open} engine="sglang"/></div>
 <div className="cache-diagram-heading"><span>内容索引 · children 向下 / parent 向上</span><small><MousePointer2 size={12}/>点击节点查看字段</small></div>
 <div className={`radix-tree ${step===0?'unsplit':''}`} data-testid="radix-tree">
 <div className="radix-root">{node('root')}</div><div className="tree-stem"><span>{'children[(11,12)]'}</span></div>
 <div className="radix-prefix">{node(step===0?'A':'P')}</div>
 {step>0&&<><div className="tree-fork" aria-hidden="true"/><div className="radix-branches"><div><span className="tree-key">children[(15,16)]</span>{node('A')}</div><div className={step<3?'pending-branch':''}><span className="tree-key">{step>=3?'children[(21,22)]':'待插入分支'}</span>{node('B')}</div></div></>}
 </div>
 <div className="cache-inspection"><div className="cache-inspector"><span className="eyebrow">SELECTED · {current.id}</span><Fields rows={[
 ['key.token_ids',arr(current.key)],['value · KV 槽索引',arr(current.value)],['parent',current.parent??'None'],['children',current.children.length?'{ '+current.children.map(id=>{const child=state.nodes.find(n=>n.id===id)!;return `(${child.key.slice(0,2).join(',')}) → ${id}`}).join('; ')+' }':'{}'],['lock_ref',current.lock],['位置状态',current.id==='root'?'根哨兵':current.lock?'protected':current.children.length?'等待子叶先回收':'evictable leaf']
 ]}/><References refs={['sg.radix#TreeNode','sg.radix#RadixKey']} open={open} engine="sglang"/></div>
 <div className="cache-inspector"><span className="eyebrow">REQUEST → POOL</span><Fields rows={[
 ['Req B.last_node',state.lastNode??(step<2?'尚未持锁':'已释放')],['req_to_token[B 行]',state.requestSlots.length?arr(state.requestSlots):'尚未分配 / 已释放'],['protected_size_',`${state.protectedTokens} token 位置`],['evictable_size_',`${state.evictableTokens} token 位置`]
 ]}/><p className="small muted">步骤 3 的私有后缀不计入树容量。根不计入统计。请求表里的整数继续索引每层 KV pool。</p><References refs={['sg.pool#ReqToTokenPool','sg.batch#Req']} open={open} engine="sglang"/></div></div>
 <div className="cache-address"><span>TreeNode.value</span><b>→</b><span>req_to_token[请求槽, token位置]</span><b>→</b><span>各层 KV pool[物理槽]</span></div>
 <details><summary>命中粒度与模型边界</summary><p>RadixKey 可表示 token 段，但 match_prefix 会按 page size 对齐。例如公共三 token、page_size=2，只匹配两个。上图聚焦索引原语；实际调度还受尾 token 重算与混合状态恢复约束。</p><p>K3 的 KDA 状态、V4 的压缩与窗口状态需要各自 cache 组件；它们不能只靠这张经典 token 树恢复。详见下方最后一节与「混合状态」。</p><References refs={['sg.radix#RadixKey.match_at','sg.mamba','sg.unified']} open={open} engine="sglang"/></details>
 </div>
}
const vllmSteps=['A 已缓存','B 查询前缀','引用 / 分配','KV 完成 / 登记','B 释放引用','C 重用旧块'];
const vllmNotes=[
 ['缓存块也在空闲队列里','A 的哈希已登记到块 [7,2,9]，活动请求 A 已结束。这些块 ref_cnt=0，仍可命中。块 12 没有缓存内容，位于队首。','vl.block#BlockPool'],
 ['H1、H2 命中；HB3 缺失','只读取哈希映射，还没有 touch。B 可以复用四 token；计算出的 HB3 指纹尚无对应 KV 条目。','vl.single#FullAttentionManager.find_longest_cache_hit'],
 ['touch(7,2)，再分配 12','命中块从空闲链表摘除，ref_cnt 变为 1；get_new_blocks 取出块 12。B 的逻辑块表为 [7,2,12]，块 12 尚无缓存哈希。','vl.block#BlockPool.touch'],
 ['块 12 的 KV 完成，登记 (HB3,g0)','cache_full_blocks 把已完成的后缀发布到内容索引。公共前缀继续使用原来的块 7、2，没有复制。','vl.block#BlockPool.cache_full_blocks'],
 ['B 的引用归零，哈希保留','按请求块的逆序 [12,2,7] 释放，已缓存块追加到队尾。现在空闲队列 [9,12,2,7] 的四个块全都仍可被缓存查询命中。','vl.block#BlockPool.free_blocks'],
 ['队首块 9 给 C，删除 HA3 的旧映射','新分配清理块 9 的旧哈希，ref_cnt 变为 1。逻辑哈希 HA3 仍能由 A 的 tokens 算出，但映射已缺失；哈希存在不等于 KV 驻留。','vl.block#BlockPool.get_new_blocks']
];
function HashChain({units,title,hits,missing}:{units:{tokens:number[];hash:string;parent:string}[];title:string;hits?:string[];missing?:Set<string>}){return <div className="hash-lane"><span className="hash-lane-title">{title}</span><div className="hash-chain"><span className="hash-seed">seed</span>{units.map((u,i)=><div className={`hash-unit ${hits?.includes(u.hash)?'hit':''}`} key={i}><span className="hash-arrow" aria-hidden="true">→</span><span className="hash-parent">parent = {u.parent}</span><strong>{u.hash}</strong><code>{arr(u.tokens)}</code>{hits&&<small>{hits.includes(u.hash)?'前缀可复用':missing?.has(u.hash)?'索引缺失':'未纳入本次命中'}</small>}</div>)}</div></div>}
export function VllmCacheLab({open}:Props){
 const [step,setStep]=useState(0),[selected,setSelected]=useState(7),state=vllmStage(step),note=vllmNotes[step];
 const block=state.blocks.find(b=>b.id===selected)!;const q=state.queue.indexOf(block.id);
 const first=[{tokens:[11,12],hash:'H1',parent:'seed'},{tokens:[13,14],hash:'H2',parent:'H1'},{tokens:[15,16],hash:'HA3',parent:'H2'}];
 const second=[...first.slice(0,2),{tokens:[21,22],hash:'HB3',parent:'H2'}];
 return <><div className="lab cache-lab vllm-lab"><div className="lab-heading"><div><span className="eyebrow">VLLM V1 · HASH → BLOCK → QUEUE</span><h3>一条内容链，三套管理结构</h3></div><span className="subtle-tag">固定完整块示例</span></div><p className="cache-assumption">与左页相同 A/B tokens；hash_block_size = 物理 block_size = 对齐粒度 = 2，单个 full-attention 组 g0。H1 等是指纹标签，物理块号为教学数据。</p><Steps steps={vllmSteps} step={step} setStep={setStep}/><div className="cache-stage-note" aria-live="polite"><h4>{note[0]}</h4><p>{note[1]}</p><References refs={[note[2]]} open={open} engine="vllm"/></div>
 <div className="cache-diagram-heading"><span>01 · Request.block_hashes</span><small>箭头是摘要依赖，非物理指针</small></div><div className="hash-lanes"><HashChain title="A" units={first}/><HashChain title="B" units={second}/></div><div className="hash-formula"><code>Hᵢ = H(Hᵢ₋₁, token_idsᵢ, extra_keysᵢ)</code><span>相同父指纹 + 相同 token + 相同额外键 → 相同内容身份</span></div><References refs={['vl.kvutils#hash_block_tokens','vl.request#Request']} open={open} engine="vllm"/>
 <div className="cache-diagram-heading"><span>02 · cached_block_hash_to_block</span><small><MousePointer2 size={12}/>点击物理块查看元数据</small></div>
 <div className="cache-block-map" data-testid="block-map">{state.blocks.map(b=><button key={b.id} onClick={()=>setSelected(b.id)} aria-label={`查看物理块 ${b.id}`} aria-pressed={b.id===selected} className={`block-map-row ${b.id===selected?'selected':''}`}><code>{b.hash?`(${b.hash}, g0)`:'无已登记键'}</code><span className="map-arrow">{b.hash?'→':'·'}</span><strong>block_id {b.id}</strong><span className={b.ref?'block-active':'block-idle'}>ref_cnt {b.ref}</span><small>{b.ref?'请求持有':b.hash?'空闲 · 有缓存':'空闲 · 无缓存'}</small></button>)}</div>
 <div className="cache-diagram-heading"><span>03 · 请求持有的物理块</span><small>SingleTypeKVCacheManager</small></div><div className="cache-request-table"><code>req_to_blocks[{state.requestName}]</code><strong>{state.request.length?arr(state.request):'无活动块表'}</strong><span>{step>=2&&step<=3?'逻辑顺序 0 → 1 → 2；前两块共享':'A 已结束；只显示当前活动请求'}</span></div>
 <div className="cache-diagram-heading"><span>04 · FreeKVCacheBlockQueue</span><small>队首优先分配 · 以下省略无关块</small></div><div className="free-queue" data-testid="free-queue"><span className="queue-sentinel">head</span>{state.queue.map(id=><div key={id} className="queue-link"><span aria-hidden="true">⇄</span><button aria-label={`查看空闲块 ${id}`} onClick={()=>setSelected(id)} className={id===selected?'selected':''}><b>{id}</b><small>{state.blocks.find(b=>b.id===id)!.hash??'无 hash'}</small></button></div>)}<div className="queue-link"><span aria-hidden="true">⇄</span><span className="queue-sentinel">tail</span></div></div><p className="small muted">⇄ 对应 prev_free_block / next_free_block。队列内普通块均 ref_cnt=0；带哈希的块依然是有效 prefix cache。</p>
 <div className="cache-inspector"><span className="eyebrow">KVCACHEBLOCK · {block.id}</span><Fields rows={[
 ['block_id',block.id],['ref_cnt',block.ref],['_block_hash',block.hash?`(${block.hash}, g0)`:'None'],['_block_hash_num_tokens',block.hash?`${block.id===7?2:block.id===2?4:6} · 该哈希覆盖的累计前缀 token 数`:'None'],['prev_free_block',q<0?'None · 已出队':q===0?'fake_free_list_head':state.queue[q-1]],['next_free_block',q<0?'None · 已出队':q===state.queue.length-1?'fake_free_list_tail':state.queue[q+1]],['is_null','False']
 ]}/><References refs={['vl.kvutils#KVCacheBlock','vl.kvutils#FreeKVCacheBlockQueue','vl.block#BlockHashToBlockMap']} open={open} engine="vllm"/></div>
 <details><summary>为什么索引在真实实现里不止一对一？</summary><p>BlockHashToBlockMap 的值允许一键对应多个等价物理块。细粒度前缀又可能让同一物理块拥有多个键，用 cached_block_hashes_by_block 反向追踪，供重用时清理。上图刻意固定为单组、无重复副本的完整块案例。</p><References refs={['vl.block#BlockHashToBlockMap','vl.block#BlockPool.cache_partial_block']} open={open} engine="vllm"/></details>
 </div><PrefixExperiment open={open}/></>
}
function PrefixExperiment({open}:Props){
 const [kind,setKind]=useState<PrefixScenario>('branch'),[hole,setHole]=useState(false),[size,setSize]=useState(2);const d=prefixScenario(kind,size,hole);
 const cases:[PrefixScenario,string][]=[['branch','共享前缀 / 后缀分叉'],['suffix','不同前文 / 相同后缀'],['salt','相同 tokens / 不同盐'],['identical','完全相同 prompt'],['unaligned','公共前缀未对齐']];
 const missing=new Set([...d.first,...d.second].filter(u=>!d.resident.has(u.hash)).map(u=>u.hash));
 return <div className="lab cache-lab prefix-experiment"><div className="lab-heading"><div><span className="eyebrow">PREFIX CACHE · CAUSALITY EXPERIMENT</span><h3>有相同文本，为什么仍然不能全命中？</h3></div></div><div className="cache-experiment-controls"><label>输入情况<select aria-label="前缀实验场景" value={kind} onChange={e=>setKind(e.target.value as PrefixScenario)}>{cases.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label><label>统一块粒度<select aria-label="前缀实验块大小" value={size} onChange={e=>setSize(+e.target.value)}><option value={2}>2 tokens</option><option value={4}>4 tokens</option></select></label></div><label className="check cache-hole"><input type="checkbox" checked={hole} disabled={size!==2} onChange={e=>setHole(e.target.checked)}/>淘汰 A 的第二块索引（只影响驻留，不改变哈希）</label>
 <p className="cache-assumption">假定 A 的 KV 已算好并登记，B 尚未执行。A 盐为 tenant-A；B {kind==='salt'?'使用 tenant-B':'同样使用 tenant-A'}。只展示完整 hash 单位；不满块尾部仍需处理。</p>
 <div className="hash-lanes"><HashChain title="A" units={d.first}/><HashChain title="B" units={d.second} hits={d.hits} missing={missing}/></div><div className="cache-token-inputs"><code>A tokens = {arr(d.a)}</code><code>B tokens = {arr(d.b)}</code></div>
 <div className="metric-row" aria-live="polite"><div><span>token 公共前缀</span><strong>{d.common}<small> tokens</small></strong></div><div><span>vLLM 本次可复用</span><strong data-testid="prefix-hit">{d.hitTokens}<small> tokens</small></strong></div><div><span>仍需计算</span><strong>{d.b.length-d.hitTokens}<small> tokens</small></strong></div></div>
 <p className="cache-experiment-result" aria-live="polite">{kind==='salt'?'盐在首块进入 extra_keys，差异沿哈希链传播。文本公共前缀为六 token，计算身份仍全部不同。':kind==='suffix'?'B 的 [13,14] 与 [15,16] 虽然和 A 相同，但父哈希不同，两块的 KV 不能共享。':kind==='identical'?'全部逻辑哈希相同，但 get_computed_blocks 还保留最后 logits 的重算：max_length=5，再按完整块边界取整。':kind==='unaligned'?'三个 token 相同，完整块只能覆盖对齐部分。内容公共前缀与可恢复边界不是同一个数。':'分叉前的块可复用；分叉后的新指纹没有对应 KV，需要 prefill。'}{hole&&size===2?' 第二块条目已淘汰：即使第三块的哈希还在，也不能跳过 full-attention 历史缺口。':''}</p>
 <p className="small muted">此处把 hash、物理块、对齐粒度设为同一值；未模拟混合组、EAGLE、部分块入口。上面的 H 标签由完整输入身份分配，避免把演示摘要误认成生产哈希函数。</p><References refs={['vl.kvutils#generate_block_hash_extra_keys','vl.single#FullAttentionManager.find_longest_cache_hit','vl.kv#KVCacheManager.get_computed_blocks']} open={open} engine="vllm"/>
 </div>
}

export type ObjectContract={name:string;ref:string;role:string;fields:[string,string][]};
const o=(name:string,ref:string,role:string,fields:[string,string][]):ObjectContract=>({name,ref,role,fields});
const reqSG=o('Req','sg.batch#Req','一个请求的逻辑进度与缓存锚点',[
 ['origin_input_ids','原始输入 token IDs'],['output_ids','已输出 token IDs'],['prefix_indices','复用的物理 KV 位置；可能含私有尾部'],['last_node','活动路径保护的树节点锚点'],['finished_reason','引擎记录的完成原因']]);
const batchSG=o('ScheduleBatch','sg.batch#ScheduleBatch','调度侧组织本轮可执行请求',[
 ['reqs','本批请求对象'],['forward_mode','extend / decode / verify 等模式'],['seq_lens','各请求当前序列长度'],['out_cache_loc','本轮计算结果的 KV 写入位置'],['tree_cache','前缀缓存管理对象']]);
const forwardSG=o('ForwardBatch','sg.forward#ForwardBatch','模型执行侧的批量张量与位置契约',[
 ['input_ids','本轮实际输入 token'],['positions','对应位置编码索引'],['req_pool_indices','请求在请求池中的行号'],['out_cache_loc','新状态的物理写入位置'],['extend_prefix_lens','extend 中已有前缀的长度']]);
const reqVL=o('Request','vl.request#Request','V1 调度进度和逻辑内容身份',[
 ['num_computed_tokens','已经完成计算的位置'],['spec_token_ids','尚未确认的投机候选'],['num_output_placeholders','异步执行的输出占位'],['block_hashes','由 token 和上下文生成的逻辑指纹'],['status','请求的调度状态']]);
const outputVL=o('SchedulerOutput','vl.output#SchedulerOutput','传向执行侧的增量调度计划',[
 ['scheduled_new_reqs','新进入 runner 的请求'],['scheduled_cached_reqs','已在执行侧缓存的请求更新'],['num_scheduled_tokens','本轮每请求安排的 token 数'],['finished_req_ids','已经完成、需要清理的请求'],['kv_connector_metadata','跨节点状态传输元数据']]);
const specVL=o('MambaSpec','vl.specs#MambaSpec','有限状态缓存规格；KDA 也使用该接口',[
 ['shapes / dtypes','各份状态的形状与精度'],['num_speculative_blocks','投机相关状态块规格'],['num_prefill_checkpoint_blocks','prefill checkpoint 块规格'],['prefill_checkpoint_alignment','checkpoint 的对齐约束'],['tokens_per_state','一份状态对应的 token 粒度']]);
const radix=o('TreeNode','sg.radix#TreeNode','压缩前缀树的一个 token 段',[
 ['key','RadixKey，保存本段内容'],['value','KV 位置索引 tensor，并非 K/V 向量'],['parent / children','压缩路径的父节点与下一段索引'],['lock_ref','经过本段的活动保护路径数'],['host_value','相应 host 存储位置元数据']]);
const block=o('KVCacheBlock','vl.kvutils#KVCacheBlock','物理缓存块的 CPU 元数据',[
 ['block_id','稳定物理块号'],['ref_cnt','活动引用计数'],['_block_hash','包含 group 的缓存键'],['_block_hash_num_tokens','主哈希覆盖的累计前缀长度'],['prev_free_block / next_free_block','空闲队列链接，不是哈希祖先']]);
export const objectContracts:Record<string,ObjectContract[]>={
 'sglang:overview':[reqSG,batchSG,forwardSG], 'sglang:lifecycle':[reqSG], 'sglang:scheduler':[reqSG,batchSG], 'sglang:execution':[forwardSG,batchSG],
 'sglang:attention':[forwardSG], 'sglang:cache':[radix,reqSG,o('ReqToTokenPool','sg.pool#ReqToTokenPool','逻辑 token 到物理位置的请求表',[['req_to_token','GPU int32 表：请求行 × token 位置 → KV 槽号'],['free_slots','可分配的请求行号']])],
 'sglang:hybrid':[o('UnifiedRadixCache','sg.unified#UnifiedRadixCache','异构组件在同一前缀树上的协调层',[['components','实际启用的状态组件'],['tree_core','底层树结构实现'],['is_swa_enabled / is_mamba_enabled','窗口与有限状态能力'],['ongoing_load_back','在途恢复记录']])],
 'sglang:speculation':[batchSG], 'sglang:kda':[forwardSG], 'sglang:sparse':[forwardSG],
 'vllm:overview':[reqVL,outputVL], 'vllm:lifecycle':[reqVL], 'vllm:scheduler':[reqVL,outputVL], 'vllm:execution':[outputVL],
 'vllm:cache':[block,reqVL], 'vllm:hybrid':[specVL], 'vllm:kda':[specVL], 'vllm:kimi':[specVL], 'vllm:speculation':[reqVL,specVL], 'vllm:disaggregation':[outputVL],
 'vllm:sparse':[o('CompressorStateCache','vl.compressor#CompressorStateCache','未完成压缩计算需要的状态存储',[['state_dim','状态向量维度'],['dtype','状态精度'],['kv_cache','实际状态存储'],['sliding_window / block_size','窗口与块规格']])]
};

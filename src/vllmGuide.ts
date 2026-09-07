import {p,n,d,type Guide} from './curriculumTypes.ts';
export const vllmGuide:Record<string,Guide>={
overview:p('vLLM V1 怎样把异步请求转成一轮可执行的 GPU 工作？','AsyncLLM 连接前端，EngineCore 驱动循环，Scheduler 输出增量计划，GPUModelRunner 物化执行输入。',[
n('前端与引擎连接','vl.async#AsyncLLM','接受异步请求并管理输出通道，将 HTTP/字符串处理与核心执行循环分开。','输入与生成参数','引擎请求 / 输出流'),
n('计划本轮 token','vl.scheduler#Scheduler.schedule','让请求的已计算 token 追上目标 token，联合 KV、encoder、预算等约束安排工作。','Request 状态与资源预算','SchedulerOutput'),
n('物化与执行','vl.runner','GPUModelRunner 根据增量计划维护执行输入、块表和 metadata，再调用模型。','SchedulerOutput + 本地执行状态','模型输出与采样结果')
],[d('为什么 SchedulerOutput 是核心边界？','调度发送本轮哪些请求、多少 token、哪些新块，执行侧可以复用持久化输入状态。','增量协议意味着两侧状态必须同步，取消与抢占不能只改一侧。'),d('缓存为什么由规格和组协调？','不同层可能有不同 KV 或有限状态布局，KVCacheSpec 与 coordinator 共同约束可恢复边界。','不能把一个全局 block_size 当作每个 kernel 和状态池的全部规格。')]),
lifecycle:p('AsyncLLM 收到请求后，哪些状态驱动它走到完成？','Request 描述进度，EngineCore 持续调度和执行，输出处理器将引擎结果变回调用方的增量输出。',[
n('加入引擎','vl.async#AsyncLLM','验证与输入处理后的请求发送给 engine core，前端保留请求到输出流的关系。','prompt / sampling / media','EngineCore 请求'),
n('推进执行循环','vl.core#EngineCore.step','每轮获取调度计划、执行模型并提交结果；一条请求会跨越多个 step。','等待 / 运行请求','本轮输出和新进度'),
n('处理结果','vl.scheduler#Scheduler.update_from_output','根据输出修正已计算位置、停止原因和资源状态，再决定后续可运行工作。','采样 / 接受 token 与执行结果','更新的 Request 与完成请求')
],[d('为什么全部 prompt 命中还要 forward？','get_computed_blocks 通常保留至少最后一个位置以重算生成 logits；块对齐可能让整个尾块重算。','缓存节约的是可复用历史计算，不是保证零次模型执行。'),d('为什么流式输出与引擎完成是两层状态？','前端消费速度、字符串缓冲和引擎执行独立，连接断开也必须向引擎传播取消。','在途 token 与延期释放需要精确跟踪，否则可能重用仍被读取的块。')]),
scheduler:p('V1 为什么说调度不显式区分 prefill 和 decode？','Request 的已计算进度追赶包含投机候选的目标进度；差额被预算和容量限制，执行侧再解释实际模式。',[
n('计算需求差额','vl.request#Request','num_computed_tokens 记录已算位置，spec_token_ids 与异步 placeholders 影响目标工作量。','已计算 / 目标 / 在途进度','待执行 token 数'),
n('约束并分配','vl.scheduler#Scheduler.schedule','综合最大 token 预算、KV 块、encoder 与请求限制；容量不足时可能抢占或延迟。','需求差额 + 资源约束','每请求执行量与新块'),
n('交付增量计划','vl.output#SchedulerOutput','分别记录新请求、已缓存请求、本轮 token 数及完成/抢占信息，交给 runner。','本轮调度决定','可物化的执行计划')
],[d('为什么统一成 token 进度？','prefill、decode 和投机验证都可以描述为推进不同长度的计算，避免调度顶层到处分支。','统一进度并未消除 backend 的模式差异，metadata 仍需要识别真实 workload。'),d('为什么异步调度要记 placeholders？','下一轮准备可能先于上一轮输出到达，必须区分可预测工作和最终确认 token。','取消、拒绝和抢占要撤销或延迟释放相应状态，不能把占位当真实输出。')]),
cache:p('为什么 KVCacheBlock 的双向指针不是前缀哈希链？','Request.block_hashes 表达逻辑身份；哈希表映射到物理块，prev/next_free_block 只管理空闲回收顺序。',[
n('生成因果指纹','vl.kvutils#hash_block_tokens','用父哈希、当前 token 和额外键生成新哈希；相同后缀在不同前文后不共享。','父 hash / tokens / extra keys','逻辑 BlockHash'),
n('查询并引用物理块','vl.block#BlockPool.touch','按 hash 与 group 找到 KVCacheBlock，命中后增加 ref_cnt，并从空闲队列摘除零引用块。','内容索引与请求','受保护物理块列表'),
n('释放或重用','vl.block#BlockPool.get_new_blocks','释放引用可保留哈希；真正把空闲块给新请求时，才清理旧键及其别名。','空闲队列','已分配的新块')
],[d('为什么 ref_cnt=0 仍然可以命中？','没有活动请求使用只表示可回收；在被重用前，已完成 KV 仍有复用价值。','空闲队列长度不等于没有内容的块数。'),d('为什么同一个 hash 可以有多个块？','并发请求可能已独立算出相同内容，保留副本可维持稳定、追加式的请求块表。','不能假定哈希表永远一对一；细粒度别名还需要反向索引清理。')]),
hybrid:p('多种 KVCacheSpec 的命中与分配，怎样合成一个请求的可恢复位置？','规格描述布局，单类型 manager 处理该类状态，coordinator 选择所有必要组都成立的边界。',[
n('声明缓存规格','vl.specs#MambaSpec','有限状态用 shapes、dtypes、checkpoint 与对齐参数表达，和逐 token attention 历史区别开。','模型状态布局','每类 KVCacheSpec'),
n('各组独立管理','vl.single','FullAttention、SlidingWindow、Mamba 等 manager 保留各自命中约束与请求块表。','组规格与请求 hash','各组命中 / 分配结果'),
n('协调共同边界','vl.coordinator#KVCacheCoordinator','跨组协调复用与分配，使模型所有必要状态能从同一位置继续。','多个组的有效状态','可恢复的请求状态集合')
],[d('为什么 K3 需要 MambaSpec？','名称代表有限状态缓存接口，KDA 的 conv/recurrent 状态符合这类需求，不表示模型变成 Mamba。','MLA 命中更长不能补出缺失的递归摘要，要使用共同 checkpoint 或重算。'),d('为什么物理块和 hash 单位可不同？','混合组可能要求较细的恢复边界，当前实现支持在条件满足时登记物理块内部的前缀入口。','细粒度命中还依赖有效 token 数、对齐、可写性和各组策略。')],'components'),
execution:p('GPUModelRunner 怎样理解只包含本轮变化的 SchedulerOutput？','runner 维护持久输入状态，把新增/恢复/完成请求和新块应用到缓冲，再准备本轮模型输入。',[
n('管理设备与执行环境','vl.worker','worker 负责设备初始化、缓存与执行环境，把调度计划交给模型 runner。','设备配置 / 工作请求','可执行 runner 环境'),
n('更新输入与 metadata','vl.runner','处理增量请求计划，整理 token、位置与缓存映射，并为 attention 构造 metadata。','SchedulerOutput / 持久请求状态','GPU 输入与块表'),
n('选择图执行模式','vl.graph','根据兼容性和工作形状选择 CUDA Graph 或其他执行路径，避免每步重复 CPU 启动。','形状 / backend / buffer 约束','执行输出')
],[d('为什么要区分 SchedulerOutput 与模型输入？','前者是资源计划，后者是设备布局；把转换集中在 runner 便于复用缓冲和图捕获。','调度正确不保证 slot mapping 正确，两层都需要边界测试。'),d('两个 runner 路径为什么不能混讲？','快照中同时有 gpu_model_runner.py 与 gpu/model_runner.py，运行配置决定使用哪条。','本页主线采用前者；追实际部署要核对选择开关，再读对应实现。')]),
attention:p('attention 模型语义怎样经过 backend 变为设备操作？','模型提供 query 与状态规格，backend 生成可见集合与布局，kernel 执行具体计算。',[
n('定义 latent attention','vl.mla#MultiHeadLatentAttention','MLA 以压缩历史参与计算；decode 可使用吸收后的投影，避免展开全部多头历史。','query / latent 历史','attention 表示'),
n('构造稀疏与窗口路径','vl.v4attn#DeepseekV4Attention','V4 组合压缩、窗口与模型特定状态，并按平台选择实际实现。','V4 层配置 / cache metadata','后端计算请求'),
n('实现设备算法','vl.flashmla','具体 backend/kernel 接收布局和可见索引，返回带正确归一化的结果。','物理块 / 稀疏索引 / query','attention 输出')
],[d('PagedAttention、FlashAttention、MLA 为什么不能互相替代？','它们分别处理内存分页、计算 IO 与模型状态表示；可以在同一执行链共同存在。','仅看特性名无法判断真实存储量、读取量和 backend 兼容性。'),d('为什么分区输出需要带归一化信息？','softmax 的全局分母跨分区，合并局部输出需要 LSE 等尺度信息。','直接平均会改变结果；SWA、压缩 source 和 sink 要遵守一致的合并语义。')],'components'),
moe:p('vLLM 如何让不同硬件复用同一套专家计算流程？','把路由、prepare/finalize 与专家计算接口分开；各后端按量化、并行和布局约定组合执行。',[
n('模型定义路由语义','vl.v4#DeepseekV4MoE','V4 前 num_hash_layers=3 层可使用 token-ID hash routing，后续 learned routing 按模型规则选择专家。','hidden / token IDs / 路由参数','专家 IDs 与权重'),
n('组织模块化专家执行','vl.modularmoe','prepare/finalize 和专家算子分担 token 重排、通信与计算职责，减少硬件组合对模型的侵入。','路由 token 与并行布局','各专家计算结果'),
n('组合 latent 与 shared 路径','vl.latentmoe','K3 的 latent routed path 与 shared path 有特定投影和组合规则，不能当标准等宽 FFN。','专家输出与共享分支','模型 hidden 输出')
],[d('为什么模块化而不是只有一个 fused kernel？','不同量化、通信和硬件组合需要可替换边界；接口保持模型语义和布局一致。','抽象不消除重排/通信成本，实际 fast path 仍要满足 shape 和 dtype。'),d('为什么看平均负载还不够？','同步计算常受最忙专家或 rank 限制，即使平均 token 数很低也可能等待热点。','EP 改善权重容量，但可能增加网络与跨设备不均衡。')]),
parallel:p('vLLM 的每个并行组为哪一类张量付出通信？','TP 切层内矩阵，PP 切深度，DP 切请求，EP 切专家，DCP 切 decode 历史；模型决定具体交界。',[
n('构造并行组','vl.parallel','配置决定 rank 组及 collective 范围，组关系和模型布局必须对应。','拓扑与 parallel_config','各轴通信组'),
n('历史上下文分片','vl.mla','MLA 的 DCP 分摊历史访问并合并分区输出；不能默认把 latent cache 简单按 TP 除。','分片历史 / query','合并的 attention 输出'),
n('按层协调通信','vl.k3','K3 的 attention、专家与 residual 可能采用不同分片方式，层间需要正确重排。','局部 hidden 与子层分片','下一子层输入')
],[d('为什么 K3 的内存实验分 TP 与 DCP？','KDA heads 可以按 TP 分摊；MLA 历史可能在 TP 中复制，由 DCP 进一步切历史。','这些轴的兼容性、PP 层分布和恢复缓冲仍需核对实际配置。'),d('为什么重叠不能按耗时直接相减？','只有独立工作、资源余量和正确 event 依赖同时存在，才可能缩短关键路径。','带宽竞争、小消息延迟和最慢 rank 都可能抵消扩卡收益。')]),
disaggregation:p('KVConnector 怎样跨越调度侧与执行侧完成一次状态迁移？','scheduler 侧安排传输与可运行状态，worker 侧实际访问数据，connector metadata 将两边连接起来。',[
n('规划迁移','vl.connector','KVConnector 在 scheduler 与 worker 侧有不同职责，不能只视为一个网络拷贝函数。','请求状态与迁移需求','connector metadata'),
n('执行传输','vl.nixl','NIXL connector 提供具体传输路径，接收方需知道目标物理位置与完成状态。','源 / 目标位置与传输元数据','在途传输 / 完成通知'),
n('继续调度','vl.kv#KVCacheManager','本地缓存管理与外部状态可用性对齐，完整状态可用后才能继续请求。','已确认接收状态','可复用块与后继计算')
],[d('为什么 PD 需要完成协议？','发起 DMA 不代表数据已能读取，调度必须以真实完成状态控制请求准入。','取消、网络失败和重试可能产生半完成状态，不能直接重连后继续。'),d('为什么混合模型传输更难？','K3 的有限状态与 V4 压缩中间状态需要与 attention 历史处于同一恢复位置。','connector 必须明确支持布局、精度与并行变换；不能泛化某个成功组合。')]),
speculation:p('草拟、拒绝采样与状态恢复分别在哪一层发生？','proposer 给候选，target 验证，RejectionSampler 决定接受输出；请求和所有状态组件一起提交到接受边界。',[
n('提出候选','vl.spec','proposer 生成 spec token，目标进度可以包含这些候选，但它们尚未成为确认输出。','已确认前缀','spec_token_ids'),
n('验证并接受','vl.reject','RejectionSampler 处理接受、拒绝与修正；贪心一致性和随机分布校正是不同条件。','draft / target 分布或候选','接受长度与输出 token'),
n('恢复混合状态','vl.kdametadata','KDA metadata 与恢复路径需要定位被接受的 recurrent/conv 状态，不能只缩短普通 KV 表。','验证结果 / 状态记录','下一轮有效状态')
],[d('为什么 KDA 恢复策略要看当前实现？','快照包含 use_kda_recoverssm 等分支，状态大小和恢复操作随策略改变。','不能沿用旧版本“一候选一份完整状态”的唯一解释。'),d('MTP 文件存在为什么不代表默认启用？','K3 配置 num_nextn_predict_layers=0，V4 Flash/Pro 为 1；还需匹配草拟权重和运行开关。','加速取决于草拟、验证、恢复总成本及真实接受长度，非只看接受率。')]),
kimi:p('K3 在 vLLM 中如何接入混合 attention 和有限状态接口？','KimiLinearForCausalLM 的配置脚手架承载 K3 文本模型；decoder 分派 KDA/MLA，同时声明状态布局供缓存管理。',[
n('实例化混合层','vl.k3','按官方 93 层配置构建 69 个 KDA 与 24 个 MLA；名称复用不表示等同早期 Kimi Linear。','K3 text_config','K3 decoder 层集合'),
n('声明 KDA 状态形状','vl.k3#KimiLinearForCausalLM.get_mamba_state_shape_from_config','模型给出 conv/recurrent 状态形状，交给有限状态缓存接口组织容量。','heads / dims / 并行与恢复设置','状态 shape'),
n('执行 latent 历史','vl.mla#MultiHeadLatentAttention','24 层 MLA 保存 512+64 维历史表示，NoPE 不移除后 64 维。','MLA query / 历史','序列交互输出')
],[d('为什么先看配置再看类名？','官方给定 hidden=7168、896 routed experts、top-16、2 shared experts，层表决定实际模块。','派生量化或裁剪 checkpoint 可能改变形状，不能用家族名替代参数。'),d('为什么 K3 不是固定缓存容量？','有限状态、增长中的 MLA 历史、前缀 checkpoint 和图缓冲是不同内存项。','DCP、TP 和 PP 影响不同部分；交互估算不能作为设备数量承诺。')]),
kda:p('vLLM 把 KDA 的两种状态如何放进缓存体系？','模型声明 shape/dtype，MambaSpec 表达有限状态缓存，KDA backend 负责在不同计算模式下读写和恢复。',[
n('计算状态规格','vl.mambashape#MambaStateShapeCalculator.kda_state_shape','卷积状态与 recurrent 矩阵具有不同 shape、精度与分片方式，恢复策略也会影响额外空间。','KDA heads / dim / TP / 恢复策略','conv 与 recurrent shape'),
n('执行 KDA','vl.kda','backend 区分 prefill 与 decode 的计算组织，部分 fused decode fast path 有严格能力条件。','当前表示和旧状态','输出与新状态'),
n('协调恢复','vl.kdametadata','metadata 让实际 token 边界与所用状态槽一致，投机接受长度变化后也要恢复对应状态。','checkpoint / 接受边界','正确的状态索引')
],[d('为什么 recurrent 状态用 FP32 需要单独计量？','长序列递推对累积误差敏感，不能把它套进普通 BF16 KV 的每 token 字节公式。','TP=1 单请求基础状态量可达数百 MiB，还未计所有 checkpoint 和恢复缓冲。'),d('为什么 prefill 的分块算法也要看 checkpoint？','块内并行提高吞吐，但未来 prefix hit 和恢复需要在规定位置留下可续算状态。','分块计算边界、缓存保留边界与 token page 不一定相同。')]),
'kimi-depth':p('K3 decoder 中，AttnRes 与 latent 专家怎样配合？','深度聚合决定子层输入，序列 attention 处理历史，专家路径再处理通道；三者各自有状态与布局边界。',[
n('组织子层顺序','vl.k3','decoder 衔接深度 residual、attention 与 FFN，block 边界决定哪些深度表征被保留。','当前 hidden / depth state','子层输入与新 depth state'),
n('执行深度聚合','vl.attnres','kernel 实现 prefix 更新、block 写入、打分与归一化等操作，减少中间内存流量。','深度分组表征','AttnRes 聚合结果'),
n('执行专家分支','vl.latentmoe','routed latent path 与 shared experts 分别计算，再按模型门控与投影规则组合。','latent / shared 输入','FFN 输出')
],[d('为什么深度状态不是 prefix KV？','它记录同一 token 在网络层间的信息来源，而序列缓存描述跨 token 的历史。','把两者混为一类会误算生命周期和显存增长方式。'),d('为什么快路径要看工作形状？','小 token decode、prefill 与不同量化布局的最佳 kernel 可能不同。','类里有实现不等于当前运行命中，需查看 capability 和分派条件。')]),
deepseek:p('V4 的模型共享逻辑和平台实现，在 vLLM 如何分层？','模型构造选择 attention 类；DeepseekV4Attention 组织窗口与压缩；mHC 与 MoE 构成 decoder 的其他子层。',[
n('按平台选类','vl.v4#_select_dsv4_attn_cls','根据平台选择实际 attention 实现，不能将 NVIDIA 专用路径泛化到所有设备。','平台 / 模型设置','具体 attention 类'),
n('执行模型语义','vl.v4attn#DeepseekV4Attention','统一组织 V4 attention 所需的压缩、窗口与历史对象，再交给实际 backend。','本层 compress_ratio 与状态','attention 输出'),
n('衔接多流 residual','vl.v4#DeepseekV4DecoderLayer','decoder 将 mHC pre/post、attention 与 MoE 组合起来；hc_mult=4 产生四条残差流。','residual streams 与子层结果','下一层多流状态')
],[d('为什么 Flash 与 Pro 需要各自的层图？','Flash 43 层、64 query heads、top-k index 512；Pro 61 层、128 heads、index 1024，压缩层表也不同。','compress_ratios 多出的末项属于 MTP，不能计入主干。'),d('为什么 mHC 要独立看 kernel？','pre、post、fused post-pre 与 head 操作影响中间量读写，函数组合必须保持混合与归一化语义。','多残差流和约束带来额外容量与计算，不能只看 attention 成本。')]),
sparse:p('V4 的压缩索引怎样成为因果正确的 sparse attention 输入？','compressor 生成历史候选，indexer 对 C4 选择候选，SWA 保留近期细节；metadata 将逻辑位置映射到物理页。',[
n('生产压缩候选','vl.compressor#DeepseekCompressor','压缩包含模型学到的投影/聚合与位置处理，不是简单每四个 token 求平均。','历史输入 / partial state','已完成压缩组'),
n('选择 C4 候选','vl.v4attn#DeepseekV4Indexer','候选少于 top-k 时可直接全选；长历史才需要选取子集。C128 不能原样套用 C4 top-k。','query / 压缩候选','逻辑稀疏索引'),
n('落实到物理可见集合','vl.indexer','将候选位置结合页映射与有效边界整理成 kernel 可访问的输入，处理无效和 padding。','逻辑候选 / 每 query 边界','物理索引与 mask')
],[d('为什么不能用整条 prompt 长度统一建 mask？','prefill 内每个 query 的位置不同，靠后的已完成组对靠前 query 仍可能是未来信息。','测试必须覆盖空候选、3→4、127→128、chunk 和 prefix extend。'),d('为什么分开算存储与读取？','top-k 限制本轮访问量，不保证其余历史不再保存，indexer 和 compressor 也有状态。','用 top-k×head_dim 估容量会漏掉大量长期和中间存储。')]),
quantization:p('vLLM 怎样保证低位宽权重最终被正确的 kernel 解码？','加载器处理权重命名、分片与布局，quant 模块提供计算规则，平台检查决定组合是否可执行。',[
n('加载与映射权重','vl.loader','读取 checkpoint 并完成模型需要的命名映射、分片和加载后处理。','权重 shards / scales','模型参数布局'),
n('选择量化路径','vl.v4quant','V4 的专家与其他模块可使用不同格式，打包表示必须与实际计算方法一致。','量化配置 / 原始权重','kernel 可用格式'),
n('核对平台与 KV 格式','vl.v4attn#_resolve_dsv4_kv_cache_dtype','V4 fp8_ds_mla 有专用 packed layout 和尺度要求，不能只把 dtype 名换成 FP8。','KV 配置与后端条件','相容的 cache dtype')
],[d('为什么加载成功不代表能高效执行？','权重可被解码不等于设备有对应最优 kernel，回退、repack 与转换可能很昂贵。','A100、Hopper、Blackwell 的能力条件要跟随 platform 与 kernel 分派核对。'),d('怎么验收量化？','先看参考算子与 logits/任务质量，再对齐流量测试端到端收益。','路由、norm、softmax 和 recurrent state 的敏感性不同，不应统一降精度。')]),
serving:p('vLLM 的输入渲染、生成约束与工具解析各自改变什么？','renderer 组织模型输入，sampler/grammar 约束分布，parser 解释流式结果；协议兼容不替代模型适配。',[
n('渲染 K3 输入','vl.k3render','媒体输入与文本占位需要按模板和模型规则对齐，影响 encoder 工作与 prompt 长度。','文本 / 图像 / 视频','模型输入表示'),
n('采样与结构约束','vl.sampler','采样按 penalties、temperature、top-k/top-p 等规则处理 logits；structured output 约束影响合法候选。','logits 与生成状态','合法采样输出'),
n('解析模型协议','vl.k3parser','K3 parser 处理模型特定工具格式；V4 使用其自己的协议实现，不能复用字符串猜测。','流式生成片段','工具调用 / 文本事件')
],[d('为什么 API compatible 不是模型行为等价？','模板、reasoning、stop token、工具语义与 pooling/生成任务都有不同契约。','合法响应格式或 HTTP 200 不能作为服务正确性的充分条件。'),d('为什么 LoRA 和媒体信息会进入 cache key？','相同 token 可能在不同 adapter 或媒体 embedding 下产生不同隐藏状态。','能声明 SupportsLoRA 不代表所有量化、并行与模型组合均已验证。')]),
operations:p('吞吐正常但用户仍觉得慢，vLLM 哪些状态能解释？','分别看 scheduler 的队列、runner 的每轮关键路径和缓存/有限状态容量，再用同一流量验证变化。',[
n('观察排队与进度','vl.scheduler#Scheduler','请求到达、抢占、token 预算和 prefix 热度共同决定等待时间。','到达率 / running / waiting','TTFT 与排队归因'),
n('检查执行关键路径','vl.runner','ITL 受 batch 组成、输入准备、attention 读取、MoE 通信和 graph 模式共同影响。','profiler / 每轮工作量','计算、带宽或同步瓶颈'),
n('按规格计算容量','vl.specs','attention、Mamba 和其他状态有不同容量模型，需同时看权重、cache、图与临时峰值。','各类规格 / 并发 / 长度','内存构成')
],[d('为什么冷/热缓存必须分开报告？','prefix reuse 改变实际计算量，热缓存吞吐不能直接代表冷请求服务能力。','同时固定 tokenizer、采样、长度和并行布局，避免不公平结论。'),d('偶发错误先查什么？','模板、slot mapping、prefix key、投机接受边界与状态恢复都是具体可验证假设。','通过 eager、非投机、固定输入逐步缩小范围，不能把所有漂移都当采样随机性。')]),
testing:p('vLLM 新增模型要满足哪些执行和状态接口？','registry 只是入口；权重加载、状态规格、metadata、输出协议与恢复边界都要闭环。',[
n('注册并构造','vl.registry','让 architecture 可发现后，还需满足模型构造、并行权重加载与相应任务接口。','config / architecture','可实例化模型'),
n('验证可见集合','test.vllm.test_deepseek_v4_swa_visible','测试 SWA 的可见位置，避免仅比较输出形状而漏掉因果边界错误。','query 位置 / 窗口边界','合法历史范围'),
n('验证物理映射','test.vllm.test_indexer_deepseek_v4_slot_mapping','检查稀疏逻辑索引与缓存物理位置的对应，覆盖 padding 和边界等特殊情况。','稀疏索引 / block table','正确 slot mapping')
],[d('为什么需要状态生命周期测试？','prefix hit→extend、抢占→恢复、投机拒绝跨压缩边界会走不同于普通 forward 的路径。','通过一组 kernel 测试不能保证服务组合正确。'),d('阅读顺序如何安排？','先理解 Request / SchedulerOutput / KVCacheSpec，再读 runner、模型及特定 backend，最后用测试核对不变量。','不要从成千上万行 kernel 一路顺读，先确定所追踪的状态和触发条件。')]),
sources:p('怎样确认这页读到的就是可复核的 vLLM 实现？','所有源码指向同一固定提交；类与函数可在站内定位，也可跳到对应 GitHub 行。',[
n('确认 V1 路径','vl.core#EngineCore','本阅读线聚焦 V1 GPU 主干，runner 和 backend 的替代路径仍按实际配置区分。','固定提交与文件路径','明确的实现范围'),
n('核对正式模型值','config.deepseek-v4-flash','模型参数来自保存的官方配置，不以默认 config 类的兜底数值替代 checkpoint。','配置快照','可核对的层数与维度'),
n('追到回归证据','test.vllm.test_indexer_deepseek_v4_slot_mapping','实现解释与边界测试相互印证；快照哈希用于验证站内全文没有被改写。','分析结论与对应场景','源码和测试证据')
],[d('为什么本页不提供速度排名？','网页没有运行 GPU 模型，模拟只说明机制、工作量和组成关系。','端到端结论需要固定硬件、精度、负载分布与延迟目标的实测。'),d('为什么源码更新不能只刷新行号？','实现与状态契约会变化，旧解释即使链接能打开也可能失效。','更新提交之后要重核设计、模型配置和边界测试。')])
};
for(const topic of ['moe','parallel','kimi','kda','deepseek','operations','sources'])vllmGuide[topic].kind='components';

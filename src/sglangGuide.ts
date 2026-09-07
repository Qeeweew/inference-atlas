import {p,n,d,type Guide} from './curriculumTypes.ts';
export const sglangGuide:Record<string,Guide>={
overview:p('SGLang 怎样把一个请求送进 GPU，再安全地交回结果？','沿 TokenizerManager → Scheduler → ModelRunner 读控制链，再单独追踪贯穿全程的缓存所有权。',[
n('接收与编码','sg.tokenizer#TokenizerManager','前端管理输入编码、请求路由与调用方的流式结果；调度器无需直接处理 HTTP 文本。','文本 / 媒体 / 采样参数','编码后的请求'),
n('决定本轮工作','sg.scheduler#Scheduler','组织运行中的 decode 与新的 extend，联合 token 预算和缓存容量决定可执行批次。','等待请求 + 活动请求 + 可用状态','ScheduleBatch'),
n('物化并执行','sg.runner#ModelRunner','将批次变为模型需要的张量与 backend metadata，调用模型后把结果交回调度侧。','ForwardBatch + 物理缓存位置','logits / 隐藏状态 / 新 token')
],[d('为什么前端、调度、执行要分层？','编码与字符串处理的 CPU 成本不应占住 GPU 调度路径；模型也无需知道队列优先级。','进程间通信和输入整理仍有成本。短 prompt、高 QPS 时要独立看前端吞吐。'),d('缓存为什么贯穿整条链？','调度需要容量，执行需要物理地址，完成处理需要释放引用；它们共享同一份状态约定。','不要把架构图里的缓存节点当作一次独立、串行的模型计算。')]),
lifecycle:p('一个请求什么时候真正完成，什么时候才能释放它的状态？','接收、调度、执行、输出属于不同所有者；HTTP 结束不能替代对在途 GPU 工作的确认。',[
n('建立请求','sg.tokenizer#TokenizerManager','编码输入并发送给 scheduler，记录请求与调用方的对应关系。','输入文本和参数','请求 ID 与 token IDs'),
n('反复推进','sg.batch#Req','Req 保存输入、输出、前缀索引和完成原因；每轮执行只推进当前允许的部分。','origin_input_ids / output_ids','新的 output_ids 与 finished_reason'),
n('输出与结束','sg.detokenizer#DetokenizerManager','detokenizer 批量把 token 转为文本；完成处理解除请求的活动缓存引用，驻留前缀仍可复用。','采样 token 与完成状态','流式增量 / 资源归还')
],[d('为什么首 token 和后续 token 要分开测？','TTFT 包含排队、编码、恢复和 prefill；decode 则不断读取历史并等待下一轮调度。','只测 forward 会漏掉用户实际等待。前缀全命中也可能仍要算尾部 logits。'),d('取消为什么要进入引擎状态机？','必须阻止后续调度并处理已发出的工作，之后才能让槽位供其他请求使用。','异常、取消与 overlap 叠加时，要检查延迟释放，而不能只清空 HTTP 连接。')]),
scheduler:p('长 prompt 到来时，已有 decode 请求怎样继续得到服务？','SGLang 显式组织 extend 与 decode 批次；chunk 和 overlap 分别解决 GPU 占用时长与 CPU 准备空洞。',[
n('选择候选','sg.scheduler#Scheduler.get_next_batch_to_run','考察运行批次、新 prefill、缓存可用性和预算，形成下一次执行计划。','waiting / running 与缓存容量','本轮 batch plan'),
n('准备模式数据','sg.batch#ScheduleBatch','不同模式准备不同长度、输入和写入位置。长 prompt 可以分块进入多轮 extend。','Req 集合与已命中前缀','input_ids / seq_lens / out_cache_loc'),
n('交叠并回收结果','sg.scheduler#Scheduler.event_loop_overlap','CPU 准备与 GPU 执行交叠，在正确依赖点处理之前的输出。部分批次不能使用相同 overlap 路径。','本轮 batch 与上一轮在途输出','可提交结果与后继批次')
],[d('为什么用 chunk 切长 prefill？','给长任务分时，减少它让交互式 decode 连续等待的时间。','chunk 小会增加轮次、启动和对齐开销；不能只优化 ITL 而忽略吞吐。'),d('overlap 为什么不是消除自回归依赖？','可以提前做不依赖最终 token 的准备；真正依赖仍要在结果确认后满足。','取消、抢占、投机拒绝与槽位重用是主要竞态边界。')]),
cache:p('一段共同前缀怎样变成共享的 KV 槽位？','RadixKey 描述内容，TreeNode.value 保存位置索引；请求锁住匹配路径，再扩展私有后缀。',[
n('匹配压缩路径','sg.radix#RadixCache.match_prefix','沿 children 匹配，分叉点会触发压缩节点分裂；按 page size 对齐。','RadixKey','device_indices 与 last_device_node'),
n('引用公共位置','sg.radix#RadixCache.inc_lock_ref','从末节点向根增加路径锁。请求映射复用已有槽位，不复制公共 KV。','last_node 与新后缀位置','受保护路径与请求行'),
n('发布与回收','sg.radix#RadixCache.evict','完成的位置进入树；请求结束解锁；回收从未锁定叶子开始。','已完成位置 / 冷叶子','可复用前缀 / allocator 空间')
],[d('为什么压缩无分叉路径？','连续很多 token 可以共用一个节点，减少对象和遍历；有分叉时再拆段。','TreeNode 不是物理 page，一个节点可覆盖多个 page。'),d('为什么 lock_ref 沿祖先传播？','叶子的状态依赖整段前文，共享祖先必须保护到最后一个使用者释放。','可驱逐缓存仍占显存；evictable_size_ 不等于设备当前空闲容量。')]),
hybrid:p('MLA 命中了更长前缀，为什么 K3 仍可能从更早位置继续？','Unified cache 协调多种组件；可恢复位置由完整状态集合决定，而不只取最长的一份 token 历史。',[
n('选择缓存组合','sg.cachebuilder','按模型与功能配置选择 radix、Mamba 或 Unified 等实现，不能只由框架名推断实际池。','模型、窗口、状态与功能配置','cache 实现与组件组合'),
n('统一树上协调','sg.unified#UnifiedRadixCache','统一树组织 FULL、MAMBA、SWA 等组件，组件保留各自的资源与有效区间。','前缀 key 与组件命中结果','共同可恢复前缀'),
n('恢复模型状态','sg.v4pool','V4 分别管理 SWA、压缩历史及中间状态；K3 的递归状态由相应 Mamba 组件恢复。','公共边界与各池位置','可继续 forward 的状态集合')
],[d('为什么不能取各组件命中长度的最大值？','MLA 到 4096、KDA 只到 2048 时，4096 的递归摘要缺失；要回退到共同 checkpoint 或重算。','保留更多 checkpoint 改善粒度，同时增加状态槽与元数据。'),d('为什么 V4 要保存 partial state？','尚未凑成完整压缩组的输入仍影响未来压缩结果，已输出 compressed KV 不能替代它。','chunk、page、压缩组是三个不同边界，投机回滚时必须同步。')],'components'),
execution:p('ScheduleBatch 中的 Python 状态怎样变成 kernel 的输入？','TpModelWorker 桥接调度与 ModelRunner；ForwardBatch 是执行侧的批量索引和模式契约。',[
n('交接执行请求','sg.worker','worker 接收本轮模型工作，组织设备侧执行调用，不负责决定用户排队优先级。','调度选出的批次','ModelRunner 调用'),
n('建立执行视图','sg.forward#ForwardBatch','携带 input_ids、positions、req_pool_indices、seq_lens、out_cache_loc；模型据此找到输入与历史。','批次逻辑状态','稳定的张量与位置元数据'),
n('执行或重放','sg.graph','满足形状与模式条件时重放 CUDA Graph；不兼容路径需要其他执行方式。','当前形状 / buffers / backend','模型输出')
],[d('为什么集中整理 metadata？','将动态请求管理转换成批量张量索引，模型层只处理计算与布局约定。','输入准备也可能成为瓶颈；优化单 kernel 不一定减少整轮时间。'),d('为什么 CUDA Graph 仍有多个 bucket？','重放依赖相容的形状、地址与执行路径；真实 batch 的变化需要 padding 或不同捕获。','更多 bucket 占用内存和预热时间，padding 也有额外计算。')]),
attention:p('模型层、attention backend 与 KV pool 分别负责什么？','模型决定数学与投影；backend 决定 metadata 和执行算法；pool 决定实际历史状态的存储。',[
n('模型发起 attention','sg.k3#KimiK3MLAAttention','K3 MLA 生成 query 与 latent 分支，NoPE 保留历史命名的 64 维分支；不能按字段名删掉它。','hidden states','query 与 latent 表示'),
n('backend 解释批次','sg.attention','backend 以 ForwardBatch 为依据组织不同模式的 attention；选择还受平台与布局约束。','query / cache / batch metadata','attention 输出'),
n('位置落到存储','sg.pool#MLATokenToKVPool','latent 历史按实际 pool 布局持有。逻辑 token 通过请求映射定位物理槽。','逻辑历史位置','缓存数据地址')
],[d('FlashAttention 与分页各解决什么？','前者优化计算 IO，后者改善物理内存管理；MLA 则改变保存的信息表示，三者处在不同层。','不能从一个 kernel 名推断模型结构、缓存容量或可用 page size。'),d('分区 attention 为什么要合并 LSE？','各分区输出带有自己的归一化尺度；合并要恢复共同 softmax 分母。','直接平均分区结果会改变函数；sink、掩码和空分区也要参与验证。')],'components'),
moe:p('稀疏激活为什么仍可能在通信上花掉大量时间？','路由只减少被激活的专家计算；token 仍要按专家重新分布，完成两段矩阵运算，再还原顺序。',[
n('选择专家','sg.topk','由路由分数产生专家索引和权重；负载分布决定后续设备是否均衡。','router logits','top-k IDs / 权重'),
n('分发并计算','sg.moe','Fused MoE 层组织专家计算及相应后端；EP 时 token 要到持有专家的 rank。','token 与专家路由','专家输出'),
n('回到模型表示','sg.k3','K3 routed path 可在较低维空间计算，再与 shared path 按模型定义组合。','routed / shared 输出','下一子层 hidden states')
],[d('为什么 top-k 不能直接代表 MoE 成本？','权重读取、dispatch、combine 和最忙专家会影响临界路径；专家更多不等于单 token 激活更多。','低 token batch 的消息和 GEMM 太小，常难以充分利用设备。'),d('K3 与 V4 的路由为什么分别读？','K3 的 896/top-16 与 latent/shared 路径，和 V4 的 hash/learned routing 不是同一结构。','共享一个框架 MoE 后端，不代表可以套用相同张量形状和通信预算。')]),
parallel:p('TP、PP、DP、EP 和上下文分片，到底切的是什么？','先选要分摊的对象，再定位通信组；SGLang 的模型代码与 distributed 层共同定义并行契约。',[
n('建立通信组','sg.parallel','按照配置组织 rank 的协作范围。不同并行轴对应不同 group，不是简单乘出一个数字。','设备拓扑与并行配置','进程组 / rank 关系'),
n('切分模型工作','sg.k3sp','K3 的 sequence-parallel 相关路径安排 token 与子层之间的重分布。','局部 token / hidden 分片','子层所需布局'),
n('匹配模型执行','sg.v4#DeepseekV4Model','V4 的执行拆分与通信顺序要保持层间依赖，不能只观察孤立 collective。','各 rank 子层结果','可进入下一层的表示')
],[d('为什么更多 GPU 有时更慢？','容量和计算分摊的收益可能小于新增 collective、小 GEMM 与同步等待。','需看消息大小、跨节点带宽和最忙 rank，不能只看总 FLOPs。'),d('通信 overlap 何时有收益？','有独立计算可重叠且资源仍有余量，才可能缩短关键路径。','两个任务都饱和同一带宽时，重叠会变成资源争用。')]),
disaggregation:p('把 prefill 和 decode 分到不同机器后，需要交接什么？','交接的是可恢复执行状态：接收方先准备位置，发送方传输，完成确认之后才允许 decode。',[
n('Prefill 生产状态','sg.prefill','组织 prefill 队列与发送准备；prompt 算完并不等于接收方已经可用。','prompt 工作与目的地','待传状态与元数据'),
n('Decode 接收并准入','sg.decode','准备接收位置并等待传输完成，之后才将请求送入可运行队列。','传输结果 / 本地位置','可调度 decode 请求'),
n('扩展驻留层级','sg.hicache','HiCache 让前缀在 GPU 与更大层级之间流动，恢复成本进入首 token 的关键路径。','冷热前缀 / 预取线索','GPU 可用缓存')
],[d('为什么 PD 不是白送的吞吐？','独立资源减少两类工作相互干扰，但引入网络搬运和协议等待。','短 prompt 的节省可能小于传输成本，应量化 saved compute 与 restore time。'),d('为什么不能只传可见 KV？','K3 要有 conv/recurrent state；V4 还需要 partial compressor state 和窗口相关状态。','异构 TP/CP、精度和布局需要明确转换支持，不能只因两端都能运行模型就迁移。')]),
speculation:p('验证只接受一部分候选时，哪些状态必须撤回？','EAGLE worker 协调 draft 与 verify；最终接受前缀同时决定 token、KV 与模型特定状态的有效边界。',[
n('草拟候选','sg.spec','draft 路径生成候选及验证所需信息。候选本身不等于用户可见输出。','当前已确认前缀','候选 token / 验证计划'),
n('目标模型验证','sg.spec','target 验证候选并确定接受长度，之后才能推进真实请求。','候选路径与 target 状态','接受前缀 / 修正输出'),
n('恢复与提交','sg.v4state','V4 未被接受的候选可能污染未完成压缩组，必须回到接受边界对应的状态。','接受长度与在途状态','下一轮一致的缓存')
],[d('为什么递归状态不能只截断长度？','KDA 更新把历史折叠进矩阵；删除 token 计数并不能逆转这次更新。','必须使用实现支持的状态保存与恢复方式，也会消耗内存和时间。'),d('为什么接受率高也可能不加速？','draft、verify、恢复与通信的总成本要小于普通 decode 推进同样长度的成本。','K3 正式配置 nextn 层数为 0，不能把仓库有草拟代码理解为 checkpoint 默认启用。')]),
kimi:p('K3 的一层在 SGLang 里怎样选择 KDA、MLA 和 MoE？','先用官方层表构建 decoder，再看序列、深度和通道三种信息混合。93 层中 69 层 KDA、24 层 MLA。',[
n('配置选择层类型','sg.kdaconfig','配置使用 1-based 层表：第 4、8、…、92 与 93 层为 MLA，其余 KDA。第一层 dense，后续 MoE。','Kimi K3 text_config','每层模块类型'),
n('执行序列与深度混合','sg.k3#KimiK3DecoderLayer','decoder 把 attention、AttnRes 与 FFN 路径组合起来；序列历史与跨深度表征分别管理。','hidden / residual 与序列状态','层内 attention 和 FFN 输出'),
n('衔接服务与视觉输入','sg.k3#KimiK3ForConditionalGeneration','完整条件生成封装还要处理视觉特征接入，不能只把文本 decoder 当完整服务。','文本 / 媒体 embedding','生成所需模型输出')
],[d('为什么 K3 总缓存不是 O(1)？','69 层 KDA 的单份状态不随长度线性增长，但 24 层 MLA 历史仍增长，还可能保留多个状态 checkpoint。','单请求固定状态本身也很大；容量要分别核算历史、状态槽、图与临时激活。'),d('为什么 NoPE 仍保留 576 个 latent 元素？','512 维 latent 加上历史命名为 rope 的 64 维分支仍参与计算，NoPE 只是没有位置旋转。','不能由 qk_rope_head_dim 的名字推断这段 cache 可以删除。')]),
kda:p('不存逐 token K/V，KDA 如何恢复前缀并继续计算？','先保留 short-conv 历史，再更新 recurrent 状态；恢复需要匹配边界处的两份状态。',[
n('准备局部历史','sg.k3','投影与短卷积先构造当前序列交互所需的表示，卷积历史本身也是跨步状态。','当前 hidden 与 conv history','Q/K/V 等表示与新卷积历史'),
n('执行递归更新','sg.kda','KDA backend 为 prefill 和 decode 组织不同的计算与状态访问；递归矩阵是前缀摘要。','门控 / 交互表示 / recurrent state','输出与下一份 recurrent state'),
n('保存恢复边界','sg.mamba','Mamba cache 组件管理这类有限状态的前缀复用。这里的 Mamba 是缓存抽象，不是改了 K3 模型。','checkpoint 位置与状态槽','可继续计算的状态')
],[d('为什么 prefill 不必逐 token 串行执行？','分块算法可以利用块内并行，再正确衔接块间状态；decode 则偏向单步低延迟。','二者必须满足同一递推语义，状态布局和数值累加仍需验证。'),d('为什么“固定大小”不等于小？','每层的 heads×128² 递归矩阵与短卷积缓冲都要存；更多活跃请求和 checkpoint 继续放大容量。','交互实验是 payload 估算，未包含本部署的全部 checkpoint、对齐和恢复缓冲。')]),
'kimi-depth':p('AttnRes 和 LatentMoE 分别改变了哪一条信息路径？','AttnRes 沿网络深度聚合表征，LatentMoE 改变专家通道空间；两者都不能当成序列 KV cache。',[
n('在子层前聚合深度','sg.k3#KimiK3DecoderLayer._forward_attn_residual','保留已完成 block 表征与当前 prefix sum，用子层参数选择进入 attention/FFN 的输入。','深度 block 表征与当前和','子层输入'),
n('融合深度状态操作','sg.attnres','实现打分、归一化、累积及 block 边界写入等操作，减少中间张量往返。','深度聚合数据','更新后的深度状态'),
n('专家通道计算','sg.k3','routed 专家可走 hidden 3584 的 latent 路径；shared path 按模型定义组合回输出。','路由结果 / latent 表示','FFN 输出')
],[d('为什么 AttnRes 按 block 分组？','配置 block size=12，以少量分组表征保留深度可选择性，控制逐层保存与扫描成本。','打分、归一化和额外表征仍比简单 residual 更贵。'),d('为什么 latent 专家不直接等价于缩小模型 hidden？','routed 与 shared 路径承担不同角色，latent 投影只是专家计算中的一段。','要核对权重映射、门控和组合顺序，不能只改一个维度参数。')]),
deepseek:p('V4 的 attention、残差流和 MoE 怎样在 SGLang 接起来？','DeepseekV4DecoderLayer 组合 MQALayer、mHC 和 MoE，专用 attention backend 与 pool 承接多种历史。',[
n('构建每层路径','sg.v4#DeepseekV4DecoderLayer','按 checkpoint 的 compress_ratios 选择本层压缩分支；Flash 43 层、Pro 61 层，MTP 不计入主干。','Flash / Pro 层配置','decoder 子模块'),
n('组织窗口与压缩','sg.v4#MQALayer','负责投影、位置处理、压缩/indexer 协作和 backend 调用；每层不一定同时使用 C4、C128。','query 与多种历史','attention 输出'),
n('组合残差与专家','sg.v4#MhcOps','mHC 在 hc_mult=4 的残差流上做受约束混合，再衔接 MoE 子层。','四条 residual streams 与子层输出','更新的多流表示')
],[d('为什么模型层与专用 pool 分开？','模型声明计算语义，pool/backend 管理 SWA、压缩页与中间状态，避免硬件布局侵入所有模型逻辑。','实际可用路径仍由 overrides、硬件和量化格式共同决定。'),d('mHC 为什么要约束混合？','Sinkhorn 等归一化约束 residual mixing，控制深层多流传递的尺度。','多流表示、混合与归一化带来额外带宽和临时内存。')]),
sparse:p('V4 当前这个 query 到底可以读哪些历史？','先确定 SWA 与已完成压缩组的因果集合，再经 metadata 把逻辑候选变成实际物理位置。',[
n('维护窗口与压缩状态','sg.v4pool','SWA、C4、C128 和未完成压缩状态分别组织；尚未完成的组不能提前当作历史候选。','token 位置与写入数据','窗口槽 / 压缩页 / partial state'),
n('准备可见集合','sg.v4attn','backend 结合每个 query 的位置、模式与缓存布局准备 metadata，不能统一使用 prompt 最终长度。','每 query 因果位置','合法候选及物理索引'),
n('跨边界恢复','sg.v4state','chunk 或投机接受边界变化时，恢复压缩中间状态，再继续后续写入。','接受位置 / checkpoint','一致的后继压缩状态')
],[d('为什么 C4 与 C128 要分开？','C4 提供较细的可检索候选，C128 保存更粗的历史摘要；它们的选择和读取规则不同。','不能给所有压缩层统一套一个 top-k 公式。'),d('为什么容量不等于 top-k×向量维度？','每步只读一部分候选，但未选中的已完成历史仍可能为之后的 query 保留。','还要计 indexer、partial state、量化尺度、窗口和页对齐。')]),
quantization:p('checkpoint 的 FP4 格式怎样变成这台 GPU 能执行的路径？','先确认模型 overrides，再追权重解码和 kernel；权重、KV、递归状态的精度要分别核对。',[
n('约束模型运行组合','sg.v4override','V4 的模型特定调整影响后端和可用组合；启动路径必须核对当前参数。','模型名 / 平台 / 启动参数','生效运行配置'),
n('构造并加载模块','sg.k3','K3 的 Linear、attention 与专家有不同权重和精度要求，checkpoint 排除项必须落实到模块。','权重张量 / scales / TP 分片','可执行权重布局'),
n('确认实际执行','sg.v4recipe','官方 recipe 是具体运行组合的入口线索，仍需结合日志与当前硬件验证。','硬件和模型配置','可复现启动组合')
],[d('为什么 FP4 模型不是全链路 4 bit？','norm、路由、激活、KV 与 recurrent state 有独立数值要求。','repack 可能增加加载峰值；低位宽权重不保证所有中间量都小。'),d('A100 适配结论怎样归属？','本地 deepseek-v4-a100-sglang 是另一个定制项目，上游 SGLang 的默认能力要以当前源码为据。','不能把定制 BF16 sparse 路径直接宣称为上游任意配置支持。')]),
serving:p('forward 正确以后，还缺哪些用户可见的服务语义？','输入媒体对齐、采样约束与结果解析属于不同环节，各自都要匹配 tokenizer 和模型协议。',[
n('处理媒体与占位','sg.k3process','媒体 processor 组织 K3 patch 与文本占位关系，让输入 embedding 落在正确位置。','图片 / 视频 / 文本占位','模型媒体输入'),
n('决定下一个合法 token','sg.sampler','采样使用 logits 与参数；grammar 路径可限制合法候选，直接影响生成分布。','logits / penalties / 约束','采样 token'),
n('还原工具协议','sg.k3parser','parser 解释 K3 的模型输出格式，组装面向调用方的工具调用增量。','流式 token / 特殊标记','文本或工具事件')
],[d('为什么 grammar 与 parser 不同？','grammar 限制接下来能生成什么；parser 解释已经生成的内容。','合法 JSON 不保证参数含义正确，流式标记跨 chunk 也要测试。'),d('多模态 prefix cache 为什么不能只看占位 token？','相同占位可对应不同媒体，隐藏状态身份依赖真实输入内容。','模板、媒体输入与缓存键必须对齐，不能只验证返回 HTTP 200。')]),
operations:p('出现 TTFT、ITL 或 OOM 问题时，应该先读哪一层？','沿现象找到等待或资源所有者，再改变一个变量验证；性能排名必须有同一服务目标和流量口径。',[
n('排队与 prefill','sg.scheduler','TTFT 先拆排队、前缀恢复和 prefill，结合 chunk、运行 batch 与缓存热度解释。','请求到达与调度事件','等待 / 工作量归因'),
n('GPU 与输入整理','sg.runner','ITL 要看每轮输入准备、attention、专家通信与 graph 命中，不只测一个矩阵乘。','执行时间线 / batch 组成','关键路径'),
n('状态与容量','sg.v4pool','OOM 分开核算权重、长期缓存、混合状态、图池与临时峰值。','池容量 / 请求分布','可解释的内存账本')
],[d('为什么高 token/s 可能仍体验很差？','到达率超过容量会持续积队列，吞吐接近峰值但尾延迟不断变差。','同时报告 TTFT、ITL 分布、错误和超时，注明冷/热缓存。'),d('正确性漂移为什么要看状态边界？','prefix hit、chunk、取消和投机拒绝都可能触发映射或恢复错误。','先用固定输入、eager 与非投机路径缩小范围，再判断数值问题。')]),
testing:p('新增模型或优化，怎样证明它仍符合整条服务链？','按注册、状态、数值和服务四层验收，重点验证跨边界恢复，而不只是 forward 输出形状。',[
n('接入模型','sg.registry','注册只是让加载器找到模型；还需构造层、加载权重、接入 attention 与状态规格。','config / architecture','可实例化模型'),
n('守住状态边界','test.sglang.test_unified_radix_cache_kl_dsv4','用真实回归测试追 Unified cache 的模型状态约束，检查共享、恢复与释放。','prefix / hybrid state 场景','缓存不变量'),
n('检验写入和边界','test.sglang.test_dsv4_compress_write_pad','压缩写入与 padding 的测试专门覆盖普通 shape 检查难发现的位置错误。','写入位置 / padding','因果与布局正确性')
],[d('为什么单 kernel 通过还不够？','请求可能在命中后 extend、被抢占后恢复、跨压缩组验证，这些组合改变状态生命周期。','E2E 偶然生成相同文本也不能证明所有映射边界正确。'),d('怎么读测试才有效？','先找测试保护的不变量，再回到被调用实现；从失败条件理解字段的真实用途。','测试覆盖的是具体形状和配置，不能外推所有模型、后端与并行组合。')]),
sources:p('这份分析的每个结论可以复核到哪里？','站内保存固定提交的真实文件、AST 行号与哈希；模型数值来自保存的官方配置。',[
n('确认代码版本','sg.registry','源码链接固定到提交；同一个函数在未来版本可能移动或改变职责。','仓库 commit','稳定的文件与符号地址'),
n('核对模型配置','config.kimi-k3','K3 参数来自配置快照，类名与 cookbook 只作为上下文，不替代正式值。','官方配置快照','层表、维度、专家与预测层'),
n('复核特殊边界','test.sglang.test_unified_radix_cache_kl_dsv4','解释与实验最终回到实现和回归测试；教学数字不会冒充真实运行 trace。','分析命题','代码与测试证据')
],[d('为什么保存完整源码而不是摘录？','读者能查看上下文、搜索字段并跳转符号，避免只看支持某结论的几行。','索引绑定特定快照；更新源码后需要人工重核分析。'),d('实验数字能说明什么？','说明工作量、依赖或内存组成的关系；所有模拟均未运行 GPU 模型。','不能据此给出速度排名、精确容量承诺或生产支持矩阵。')])
};
// These pages describe cooperating subsystems, not one serial invocation.
for(const topic of ['parallel','disaggregation','kimi','deepseek','sparse','quantization','operations','sources'])sglangGuide[topic].kind='components';

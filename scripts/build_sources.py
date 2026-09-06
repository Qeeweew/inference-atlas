"""Export commit-pinned, unmodified source files and AST symbol locations."""
import ast
import hashlib
import json
import os
import pathlib
import subprocess

APP = pathlib.Path(__file__).resolve().parents[1]
ROOT = APP.parent
CATALOG = {
'sg.http': 'sglang/python/sglang/srt/entrypoints/http_server.py',
'sg.tokenizer': 'sglang/python/sglang/srt/managers/tokenizer_manager.py',
'sg.detokenizer': 'sglang/python/sglang/srt/managers/detokenizer_manager.py',
'sg.scheduler': 'sglang/python/sglang/srt/managers/scheduler.py',
'sg.batch': 'sglang/python/sglang/srt/managers/schedule_batch.py',
'sg.policy': 'sglang/python/sglang/srt/managers/schedule_policy.py',
'sg.worker': 'sglang/python/sglang/srt/managers/tp_worker.py',
'sg.runner': 'sglang/python/sglang/srt/model_executor/model_runner.py',
'sg.forward': 'sglang/python/sglang/srt/model_executor/forward_batch_info.py',
'sg.graph': 'sglang/python/sglang/srt/model_executor/runner/decode_cuda_graph_runner.py',
'sg.graphbase': 'sglang/python/sglang/srt/model_executor/runner/base_cuda_graph_runner.py',
'sg.radix': 'sglang/python/sglang/srt/mem_cache/radix_cache.py',
'sg.unified': 'sglang/python/sglang/srt/mem_cache/unified_radix_cache.py',
'sg.tree': 'sglang/python/sglang/srt/mem_cache/unified_cache/unified_tree_core.py',
'sg.pool': 'sglang/python/sglang/srt/mem_cache/memory_pool.py',
'sg.mamba': 'sglang/python/sglang/srt/mem_cache/mamba_radix_cache.py',
'sg.hicache': 'sglang/python/sglang/srt/mem_cache/hiradix_cache.py',
'sg.cachebuilder': 'sglang/python/sglang/srt/mem_cache/kv_cache_builder.py',
'sg.attention': 'sglang/python/sglang/srt/layers/attention/base_attn_backend.py',
'sg.attnregistry': 'sglang/python/sglang/srt/layers/attention/attention_registry.py',
'sg.moe': 'sglang/python/sglang/srt/layers/moe/fused_moe_triton/layer.py',
'sg.topk': 'sglang/python/sglang/srt/layers/moe/topk.py',
'sg.parallel': 'sglang/python/sglang/srt/distributed/parallel_state.py',
'sg.prefill': 'sglang/python/sglang/srt/disaggregation/prefill.py',
'sg.decode': 'sglang/python/sglang/srt/disaggregation/decode.py',
'sg.spec': 'sglang/python/sglang/srt/speculative/eagle_worker_v2.py',
'sg.sampler': 'sglang/python/sglang/srt/layers/sampler.py',
'sg.grammar': 'sglang/python/sglang/srt/constrained/grammar_manager.py',
'sg.registry': 'sglang/python/sglang/srt/models/registry.py',
'sg.args': 'sglang/python/sglang/srt/server_args.py',
'sg.k3': 'sglang/python/sglang/srt/models/kimi_k3.py',
'sg.kdaconfig': 'sglang/python/sglang/srt/configs/kimi_linear.py',
'sg.k3config': 'sglang/python/sglang/srt/configs/kimi_k3.py',
'sg.kda': 'sglang/python/sglang/srt/layers/attention/linear/kda_backend.py',
'sg.attnres': 'sglang/python/sglang/srt/layers/attn_residual.py',
'sg.k3sp': 'sglang/python/sglang/srt/layers/k3_sp_collective.py',
'sg.k3vl': 'sglang/python/sglang/srt/models/kimi_k3_vl.py',
'sg.k3process': 'sglang/python/sglang/srt/multimodal/processors/kimi_k3.py',
'sg.k3parser': 'sglang/python/sglang/srt/function_call/kimik3_detector.py',
'sg.v4': 'sglang/python/sglang/srt/models/deepseek_v4.py',
'sg.v4config': 'sglang/python/sglang/srt/configs/deepseek_v4.py',
'sg.v4attn': 'sglang/python/sglang/srt/layers/attention/deepseek_v4_backend.py',
'sg.v4pool': 'sglang/python/sglang/srt/mem_cache/deepseek_v4_memory_pool.py',
'sg.v4state': 'sglang/python/sglang/srt/mem_cache/deepseek_v4_compress_state.py',
'sg.v4mtp': 'sglang/python/sglang/srt/models/deepseek_v4_nextn.py',
'sg.v4override': 'sglang/python/sglang/srt/arg_groups/model_overrides/deepseek_v4.py',
'sg.k3override': 'sglang/python/sglang/srt/arg_groups/model_overrides/kimi_k3.py',
'sg.v4recipe': 'sglang/docs/src/snippets/configs/deepseek-ai/deepseek-v4.jsx',
'sg.k3recipe': 'sglang/docs/src/snippets/configs/moonshotai/kimi-k3.jsx',
'vl.http': 'vllm/vllm/entrypoints/openai/api_server.py',
'vl.async': 'vllm/vllm/v1/engine/async_llm.py',
'vl.core': 'vllm/vllm/v1/engine/core.py',
'vl.scheduler': 'vllm/vllm/v1/core/sched/scheduler.py',
'vl.asyncscheduler': 'vllm/vllm/v1/core/sched/async_scheduler.py',
'vl.output': 'vllm/vllm/v1/core/sched/output.py',
'vl.request': 'vllm/vllm/v1/request.py',
'vl.kv': 'vllm/vllm/v1/core/kv_cache_manager.py',
'vl.coordinator': 'vllm/vllm/v1/core/kv_cache_coordinator.py',
'vl.block': 'vllm/vllm/v1/core/block_pool.py',
'vl.single': 'vllm/vllm/v1/core/single_type_kv_cache_manager.py',
'vl.kvutils': 'vllm/vllm/v1/core/kv_cache_utils.py',
'vl.specs': 'vllm/vllm/v1/kv_cache_interface.py',
'vl.worker': 'vllm/vllm/v1/worker/gpu_worker.py',
'vl.runner': 'vllm/vllm/v1/worker/gpu_model_runner.py',
'vl.runner2': 'vllm/vllm/v1/worker/gpu/model_runner.py',
'vl.compile': 'vllm/vllm/compilation/backends.py',
'vl.graph': 'vllm/vllm/v1/cudagraph_dispatcher.py',
'vl.attention': 'vllm/vllm/v1/attention/backend.py',
'vl.attnregistry': 'vllm/vllm/v1/attention/backends/registry.py',
'vl.moe': 'vllm/vllm/model_executor/layers/fused_moe/layer.py',
'vl.modularmoe': 'vllm/vllm/model_executor/layers/fused_moe/modular_kernel.py',
'vl.parallel': 'vllm/vllm/distributed/parallel_state.py',
'vl.connector': 'vllm/vllm/distributed/kv_transfer/kv_connector/v1/base.py',
'vl.nixl': 'vllm/vllm/distributed/kv_transfer/kv_connector/v1/nixl/connector.py',
'vl.spec': 'vllm/vllm/v1/spec_decode/eagle.py',
'vl.reject': 'vllm/vllm/v1/sample/rejection_sampler.py',
'vl.sampler': 'vllm/vllm/v1/sample/sampler.py',
'vl.grammar': 'vllm/vllm/v1/structured_output/__init__.py',
'vl.lora': 'vllm/vllm/lora/worker_manager.py',
'vl.registry': 'vllm/vllm/model_executor/models/registry.py',
'vl.loader': 'vllm/vllm/model_executor/model_loader/default_loader.py',
'vl.platform': 'vllm/vllm/platforms/interface.py',
'vl.k3': 'vllm/vllm/models/kimi_k3/nvidia/model.py',
'vl.kda': 'vllm/vllm/models/kimi_k3/nvidia/kda.py',
'vl.kdametadata': 'vllm/vllm/models/kimi_k3/nvidia/kda_metadata.py',
'vl.mla': 'vllm/vllm/models/kimi_k3/nvidia/mla.py',
'vl.latentmoe': 'vllm/vllm/models/kimi_k3/nvidia/latent_moe_runner.py',
'vl.attnres': 'vllm/vllm/models/kimi_k3/nvidia/ops/attn_res.py',
'vl.mambashape': 'vllm/vllm/model_executor/layers/mamba/mamba_utils.py',
'vl.k3mtp': 'vllm/vllm/models/kimi_k3/nvidia/mtp.py',
'vl.k3render': 'vllm/vllm/renderers/kimi_k3.py',
'vl.k3parser': 'vllm/vllm/tool_parsers/kimi_k3_tool_parser.py',
'vl.k3config': 'vllm/vllm/transformers_utils/configs/kimi_k3.py',
'vl.v4': 'vllm/vllm/models/deepseek_v4/nvidia/model.py',
'vl.v4attn': 'vllm/vllm/models/deepseek_v4/attention.py',
'vl.compressor': 'vllm/vllm/models/deepseek_v4/compressor.py',
'vl.sparse': 'vllm/vllm/models/deepseek_v4/sparse_mla.py',
'vl.flashmla': 'vllm/vllm/models/deepseek_v4/nvidia/flashmla.py',
'vl.swa': 'vllm/vllm/v1/attention/backends/mla/sparse_swa.py',
'vl.indexer': 'vllm/vllm/v1/attention/backends/mla/indexer.py',
'vl.mhc': 'vllm/vllm/model_executor/kernels/mhc/tilelang.py',
'vl.v4mtp': 'vllm/vllm/models/deepseek_v4/nvidia/mtp.py',
'vl.v4quant': 'vllm/vllm/models/deepseek_v4/quant_config.py',
'vl.v4parser': 'vllm/vllm/parser/deepseek_v4.py',
'vl.v4config': 'vllm/vllm/transformers_utils/configs/deepseek_v4.py',
}
# Include focused correctness tests, not just implementation files.
patterns = {
 'sglang': ['test/registered/unit/models/test_kimi_k3*.py','test/registered/unit/models/test_deepseek_v4*.py','test/registered/unit/mem_cache/test_dsv4*.py','test/registered/unit/parser/test_kimik3*.py','test/registered/radix_cache/unified_radix_tree/test_unified_radix_cache_kl_dsv4.py'],
 'vllm': ['tests/v1/attention/test_deepseek_v4*.py','tests/v1/attention/test_indexer_deepseek_v4*.py','tests/models/test_deepseek_v4*.py','tests/kernels/test_kimi_k3*.py','tests/reasoning/test_kimi_k3*.py','tests/v1/worker/test_dsv4*.py']
}
for repo, pats in patterns.items():
 for pat in pats:
  for path in sorted((ROOT/repo).glob(pat)):
   CATALOG[f'test.{repo}.{path.stem}'] = str(path.relative_to(ROOT))
for model in ['kimi-k3','deepseek-v4-flash','deepseek-v4-pro']:
 CATALOG[f'config.{model}'] = f'inference-atlas/research/{model}-config.json'
repos = {}
for name, origin in [('sglang','sgl-project/sglang'),('vllm','vllm-project/vllm')]:
 sha = subprocess.check_output(['git','-C',str(ROOT/name),'rev-parse','HEAD'],text=True).strip()
 repos[name] = {'sha':sha,'origin':origin,'date':subprocess.check_output(['git','-C',str(ROOT/name),'show','-s','--format=%cs','HEAD'],text=True).strip()}
files = {}
for ident, relative in CATALOG.items():
 path = ROOT/relative
 if not path.is_file():
  raise SystemExit(f'Missing evidence file: {ident}: {relative}')
 text = path.read_text()
 symbols = []
 if path.suffix == '.py':
  try:
   tree = ast.parse(text)
   def visit(nodes, scope=''):
    for node in nodes:
     if isinstance(node,(ast.ClassDef,ast.FunctionDef,ast.AsyncFunctionDef)):
      name = scope + node.name
      symbols.append({'name':name,'line':node.lineno,'end':node.end_lineno,'kind':'class' if isinstance(node,ast.ClassDef) else 'function'})
      visit(node.body,name+'.')
     elif hasattr(node,'body') and isinstance(node.body,list): visit(node.body,scope)
   visit(tree.body)
  except SyntaxError as e: raise SystemExit(f'AST failed: {path}: {e}')
 repo = relative.split('/')[0]
 remote = f'https://github.com/{repos[repo]["origin"]}/blob/{repos[repo]["sha"]}/'+relative.split('/',1)[1] if repo in repos else {'config.kimi-k3':'https://huggingface.co/moonshotai/Kimi-K3/blob/main/config.json','config.deepseek-v4-flash':'https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/blob/main/config.json','config.deepseek-v4-pro':'https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/config.json'}.get(ident,'')
 content = {'text':text}
 out = APP/'public'/'sources'/f'{ident}.json'
 out.write_text(json.dumps(content,ensure_ascii=False))
 files[ident] = {'id':ident,'repo':repo if repo in repos else 'config','path':relative.split('/',1)[1] if repo in repos else path.name,'localPath':os.path.relpath(path, APP),'lineCount':len(text.splitlines()),'symbols':symbols,'remote':remote,'sha256':hashlib.sha256(text.encode()).hexdigest(),'url':f'sources/{ident}.json'}
manifest = {'checkedAt':'2026-09-06','repos':repos,'files':files}
(APP/'src'/'source-index.json').write_text(json.dumps(manifest,ensure_ascii=False))
(APP/'public'/'source-index.json').write_text(json.dumps(manifest,ensure_ascii=False))
print(f'Exported {len(files)} verified files, {sum(len(x["symbols"]) for x in files.values())} symbols')

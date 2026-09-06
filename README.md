# 推理架构图谱 · SGLang × vLLM

一个中文交互式源码学习网站，结合 Kimi K3 与 DeepSeek V4 Flash / Pro，解释引擎的职责、设计原理、代价与实现边界。

## 打开网站

本机构建产物可直接预览。首次从 GitHub 克隆时，先运行 `npm ci` 和 `npm run build`；构建后运行时不需要联网。

- macOS：双击 `启动网页.command`。
- 或在此目录执行 `node scripts/serve.mjs`，访问 http://127.0.0.1:4174/ 。
- 服务仅监听本机。关闭该终端或按 Ctrl-C 即停止。可用 `ATLAS_PORT=另一端口` 自定义端口。
- 不能直接以 `file://` 打开 `dist/index.html`，源码阅读器需要本地 HTTP 加载快照。

## 内容和交互

22 个专题，包含入口/IPC、调度与 overlap、分页/前缀/混合缓存、runner/metadata/CUDA Graph、attention、MoE、TP/PP/DP/EP/CP、PD 与分层存储、投机、K3 的 KDA/NoPE-MLA/AttnRes/LatentMoE、V4 的 SWA/C4/C128/indexer/mHC、量化硬件、多模态/采样/工具、运维和扩展验证。

- 模型深潜目录只保留 Kimi K3 / DeepSeek V4，模型内部切换架构、KDA/AttnRes 或稀疏注意力；旧的专题链接和源码定位仍有效。
- 架构关系图：缩放、拖动画布、点击节点；窄屏自动使用可读的分层视图。
- 实验：请求逐步推进、调度预算、公共前缀与分页、K3 内存、V4 因果压缩边界、并行轴、投机成本、故障诊断。
- 源码：126 个完整文件、5,113 个 AST 定位符号；行号高亮、函数选择、文件内查找、双击标识符查找定义、复制仓库内位置、固定提交 GitHub 链接。
- 全站搜索：Ctrl/Cmd-K；支持概念、文件与符号。
- 主题、阅读进度、收藏保存在浏览器本机；无账号、无跟踪。
- URL 支持专题和代码定位，例如 `#/kimi?code=sg.k3%23KimiK3DecoderLayer`。

## 证据基线

- SGLang / vLLM 的精确 SHA 记录于 `public/source-index.json`。
- 所有源码快照与本地原文件逐字节一致，保留原有版权/许可证头；两仓库根许可证另附在 `public/licenses/`。
- 官方模型配置保存于 `research/`，来源：
  - https://huggingface.co/moonshotai/Kimi-K3/raw/main/config.json
  - https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/raw/main/config.json
  - https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/raw/main/config.json
- 配置读取时间为 2026-09-06；远程 main 会变动，快照及 SHA-256 是本分析的配置依据。
- 当前 K3 MLA 已有 vLLM DCP 路径，仍限制 PCP；没有复用旧报告的过期限制。
- K3 shared experts 采用官方配置的 2，不采用 cookbook 的旧注释。
- V4 层图排除了数组中属于 MTP 的最后一项。

本网站分析 GPU 生成服务主干，未声称穷尽每个模型/平台插件；diffusion、训练系统及逐指令硬件分析不属于本版主线。图中关系为人工核对的职责/依赖，不是自动生成的完整调用图。模拟器均为教学模型，不是两框架运行结果；没有运行 GPU 模型、没有性能排名。

## 技术选择

检索并阅读官方文档后选择 React + Vite + React Flow，使用 Prism 语法高亮与 Lucide 图标。与 Docusaurus 的文档发布工作流相比，本任务更需要图、状态实验和源码阅读器联动，因此使用定制 React 页面。参考：

- https://vite.dev/guide/
- https://reactflow.dev/
- https://docusaurus.io/docs

`dist/` 是静态产物，所有资源本地打包，无 CDN 运行依赖。附带 Node 静态服务器不依赖 npm 包，只读提供 dist 中的文件。

## 维护与验证

需要 Node.js 24 LTS（测试使用原生 TypeScript 支持），开发版本依赖已锁定于 package-lock.json。

```sh
npm ci
npm run dev
npm test
npm run build
node scripts/browser-check.mjs
```

浏览器检查使用已安装的 Google Chrome 和独立临时配置，默认访问 http://127.0.0.1:4173/ ，可用 `ATLAS_TEST_URL=http://127.0.0.1:4174` 验证生产预览；截图写入 `tests/screenshots/`。校验覆盖所有专题路由、真实源码目标、站内/文件内搜索、调度推进、模型切换、暗/亮主题以及 1440 / 1024 / 736 / 360 屏宽。

源码刷新：在当前目录运行 `npm run sources`，从相邻 `sglang/`、`vllm/` 重建按文件快照和 AST 行号。更新后必须人工复核分析结论，不能只刷新行号。配置数据和两套 src/public 索引由脚本维护；模型配置变动时重新同步 src 下的配置副本并核对层图与公式。

分析正文在 `src/content.ts`；交互的纯计算逻辑在 `src/simulations.mjs`；浏览器验证与源码完整性测试分别在 scripts/ 与 tests/。上游仓库未被修改。

KV cache 分为 SGLang Radix Tree 与 vLLM V1 块哈希两页，含节点/块字段检查器、六步生命周期、前缀/盐/缺块实验。图内编号为教学示意；细粒度前缀与 K3/V4 混合状态边界在正文单独说明。


## 发布到 GitHub Pages

网站使用相对资源路径与 hash 路由，可部署到 `https://账号.github.io/仓库名/`，源码快照也随网站发布。无需运行后端，也无需将完整 SGLang/vLLM 仓库推到 GitHub。

已经配置 `.github/workflows/pages.yml`：向 `main` 推送后，自动安装依赖、运行测试、构建静态页面并发布。构建使用 Node.js 24；`dist/` 不提交，由 Actions 生成。

首次发布：

1. 在本机终端执行 `gh auth login`，选择 GitHub.com，按提示在浏览器授权。
2. 将本目录作为独立 Git 仓库推到你的 GitHub 仓库，例如 `inference-atlas`。只推送本网站目录。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 **Actions → Deploy GitHub Pages** 查看运行；若首次推送早于第 3 步，请点击 **Run workflow** 再运行一次。
5. 打开部署任务给出的网址；KV 页面可直接访问 `https://账号.github.io/仓库名/#/cache`。

已有代码仓库和 `origin` 后，后续只需提交改动并推送 `main`，无需手动上传 `dist/`。

完整源码快照会公开，保留上游版权与许可证。索引仅保存相对源码路径，不依赖作者的本机目录。CI 校验快照哈希和所有引用；在本机存在上游 checkout 时还会逐字节对照原文件。阅读进度和收藏仍只保存在访问者自己的浏览器中。

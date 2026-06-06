# 解释：开发进度看板

本页是“知识彻底掌握演进方案”的实现侧进度看板。
它用于回答三件事：哪些能力已落地、哪些关键缺口仍在、如何用代码与运行时证据验证推进结果。

## 2026-06-06 知识工作区 scope 切换器与证据聚焦命中 UI

本切片关闭的是知识工作区前端可用性缺口：旧实现依赖全局文件夹选择器和请求载荷状态，用户在知识工作区内提问时，无法在同一任务窗口中直接确认当前 RAG 检索边界。
同时，旧命中卡片会把摘要、引用、命中 section 与动作按钮全部铺在首层，导致结果返回后提问 / 回复区域容易被挤出视野，也让用户在第一层面对过多选择。

本切片的代码 / 方案对齐结果：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 在知识工作区窗口内默认显示并可切换 scope | `src/frontend/index.html` 现在在工作区内加入 `agent-workspace-scope-select`；`src/frontend/agent_workspace.js` 会镜像全局 `folder-select`，发布同一 active-target 事件，更新 `localStorage.nc_last_target`，并在 conversation 请求中发送 `activeTarget` 与 `scope`。 | 已实现 |
| 命中返回后仍保持提问 / 回复区域可见 | `src/frontend/styles.css` 为聊天消息区设置稳定 flex 下限，并限制知识命中列表最大高度，使对话流和输入框不会被结果卡片挤出当前工作区。 | 已实现 |
| 首层命中内容只显示可交互的知识点文件名 | `src/frontend/workspace_panes.js` 现在将每个知识点渲染为文件按钮，文件名来自 `sourcePath`、`citation.sourcePath` 或 `matchedSpans[0].sourcePath`；摘要、得分、引用与命中片段不再作为首层卡片内容。 | 已实现 |
| 其他动作进入长按 / 右键菜单 | typed capability 按钮继续保持向前兼容，但默认隐藏在 `agent-knowledge-actions-menu` 中，只在长按、右键或键盘 context-menu 操作时展开。 | 已实现 |
| 点击知识点后在右侧高亮命中段落 | 点击文件名会打开 graph-focus 面板，展示知识点标题与 `matchedSpans`，每个命中段落作为高亮证据渲染。 | 已实现 |
| 双语文案与契约兼容 | `agentWorkspace.scope.*` 与新增知识点操作文案已经同步到中英 locale bundle，并由 locale contract 测试校验 key 覆盖与占位符一致性。 | 已保留 |

本切片验证：

- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts -t "scope selector|knowledge hits as file entries" --runInBand`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts --runInBand`
- `npm.cmd exec -- jest src/agent_workspace.locale.contract.test.ts --runInBand`
- `node --check src/frontend/agent_workspace.js`
- `node --check src/frontend/workspace_panes.js`
- `npm.cmd run build`

## 2026-06-06 active scope miss recovery 与 document-augmented RAG 修复

本次补丁修复了 WebView 已在 `npm run tauri:dev:mini:gpu` 中运行时复现的 “what is water glass?” 失败。

运行时探针显示：当前 sidecar 如果显式使用 `waterglass` scope 调用，会正确返回 1 个按知识点合并后的结果、8 条引用以及 `matchedSpans`。
但 WebView 当前状态是 `folder-select=financial`、`localStorage.nc_last_target=financial`，并且 `window.__NC_ACTIVE_SOURCE_TARGET.scope.sourcePathPrefixes=["Knowledge_Base/financial"]`。
因此用户问题实际上被发送成了 financial 限定范围内的 scoped query。旧 planner 虽然能在全局找到 `water glass` 的 title-like 文档命中，但随后把该 document id 与显式 financial workspace/corpus/prefix scope 做交集，最终把候选集压成 0 个 indexed atoms。

本补丁的代码 / 方案对齐结果：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 当前 scope 未命中但问题明确指向另一个知识点时仍能正面回答 | `buildQueryBackendContext()` 现在会区分 title hit 是否落在请求 scope 内。如果显式 scope 内没有兼容 title hit，但其他位置存在明确文档标题 / 别名命中，检索会切换到 document-only 的 `planner_scope_recovery` scope，而不是继续相交不兼容的 corpus 约束。 | 已实现 |
| 按知识点返回，而不是重复返回 section | 之前的 document-level conversation grouping 继续保留。recovery query 内部仍保留 segment-level evidence，然后由 `mergeAgentConversationKnowledgePoints()` 按 `documentId` 合并，并把命中的 section 作为单一知识点卡片内的 `matchedSpans` 展示。 | 已实现 |
| RSE + document augmentation 推进方向 | 当前实现把 Relevant Segment Extraction 留在检索阶段，同时在 planning 阶段加入 document augmentation：title-like query 可以恢复目标文档，文档内 section 命中会成为标注证据片段，而不是重复卡片。 | Operational baseline |
| 用户可见 scope 诊断 | Knowledge Workspace API 状态条现在会显示 active scope；如果触发 recovery，还会显示恢复到的 source path。用户可以直接看到类似 “Scope: financial” 与 “Recovered: Knowledge_Base/waterglass/water glass.md” 的状态。 | 已实现 |
| 向前兼容 | 公共响应字段只做加法。既有 `assistantMessage`、`answer`、`assistantBlocks`、citations、legacy sync/SSE 流程都继续保留。`scopeSource` 仅新增可选值 `planner_scope_recovery`，不删除旧值。 | 已保留 |

本补丁验证：

- Red/green 后端回归：`KnowledgeLearningPlatform.test.ts` 现在覆盖 active scope 为 `financial`、title-like query 为 `water glass` 时恢复到 `waterglass` 文档，并返回 1 个包含多个 matched spans 的合并知识点。
- Red/green 前端回归：`agent_workspace.frontend.test.ts` 现在覆盖状态条中的 active scope 与 recovered source 可见性。
- 运行时根因证据：CDP 显示当前 WebView scope 是 `financial`；直接用 `waterglass` scope 探针调用 sidecar 时，后端已能正确返回分组证据。

## 2026-06-06 知识工作区 RAG 回答与 API 可观测性切片

本次更新修复的是 `npm run tauri:dev:mini:gpu` 已经运行时暴露出的实际知识工作区问题：运行中的 sidecar 在完成 hydration 后已经可以召回 `waterglass` 作用域证据，但用户可见回答仍使用旧的 “strongest scoped match” 模板，并且会把同一知识点文档内的多个 section 命中渲染成重复知识点卡片。

本切片的代码 / 方案对齐结果：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 用户可见 API 调用状态 | 知识工作区新增 `/api/knowledge/conversation` 紧凑状态条，显示 idle/pending/ok/error、传输方式（`SSE` 或 sync fallback）、延迟、知识点数、引用数与记忆数（`src/frontend/index.html`、`src/frontend/agent_workspace.js`、`src/frontend/styles.css`）。 | 已实现 |
| 正面 grounded answer | `agentConversation()` 现在优先用最强证据句生成顶层 `answer` 和 `Scoped Answer` 块，再追加 grounding 计数与引用；成功解释型回合不再强制以 “The strongest scoped match is...” 开头（`src/learning/KnowledgeLearningPlatform.ts`）。 | 已实现 |
| 按知识点合并返回 | 底层 `queryKnowledge()` 仍保留 atom/section 级召回粒度，但面向用户的 conversation `knowledgePoints` 已按 `documentId` 分组，并向前兼容地新增可选 `atomIds`、`documentId`、`sourcePath`、`matchedSpans`、`citations`、`matchCount` 字段（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`）。 | 已实现 |
| RSE / document augmentation 推进 | 响应结构现在把“检索证据片段”和“知识点卡片身份”分开：同一文档内重复命中会作为同一卡片内的 matched spans 展示，而不是重复卡片。这是当前轻量 RSE 边界：召回保持 segment-level，回答与 UI 呈现升级为 evidence-grouped + document-augmented。 | Operational baseline |
| 运行态注意事项 | 已运行的 `server.exe` sidecar 不会热替换 TypeScript/backend 变更。`npm run build` 与 `npm run ensure:sidecar:dev` 已准备好修复后的 dev sidecar，但当前打开的 `tauri:dev:mini:gpu` 窗口需要重启才能加载新的后端二进制。 | 运维说明 |

本切片验证：

- Red/green 回归覆盖：`KnowledgeLearningPlatform.test.ts` 现在验证 `water glass` 的直接回答与 matched spans 分组；`agent_workspace.frontend.test.ts` 验证同一卡片命中渲染和 API 状态面板。
- 本地已复核：`npm.cmd exec -- jest src/learning/KnowledgeLearningPlatform.test.ts --runInBand`、`npm.cmd exec -- jest src/agent_workspace.frontend.test.ts --runInBand`、`npm.cmd exec -- jest src/server.migration.test.ts -t "conversation route auto-hydrates|knowledge/conversation" --runInBand`、`npm.cmd exec -- jest src/agent_workspace.contract.parity.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand`、`node --check src/frontend/agent_workspace.js`、`node --check src/frontend/workspace_panes.js`、`npm.cmd run build`、`npm.cmd run ensure:sidecar:dev`。

## 2026-06-06 主线架构推进与代码 / 方案对齐

本次更新将当前 `main` 代码与 5 月架构方案重新对齐，并明确覆盖旧口径中的一个关键误差：Program F 交付不等于底座已经达到 release-grade production closure。

当前权威参考：

- 双语详细方案：[架构推进对齐与主线推进方案（2026-06-06）](../../../solutions/architecture-progress-alignment-2026-06-06.md)
- 先前 RAG / agent 方案：[多平台轻量级 RAG 与 Agent 架构推进计划](../../../brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md)
- 先前 substrate 方案：[Deep Student Comparison Next-Phase Plan](../../../brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md)

代码 / 方案对齐结果：

| 方案要求 | 当前 `main` 代码证据 | 进度判断 |
|---|---|---|
| Scoped retrieval 与 workspace/corpus 边界 | `src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/workspace/`、`src/export/` 中已经存在 `KnowledgeQueryRequest.scope`、`KnowledgeCorpusScope`、workspace readiness、miss diagnostics、active-target hydration 与 workspace/export 底座。 | 已有实现基线 |
| Lightweight RAG 与 grounded conversation | `AgentConversationResponse` 已包含 `answer`、citation、memory action、trace 和向前兼容的 `assistantBlocks`；Tauri workspace 在结构化块存在时渲染 typed blocks，并继续支持 legacy `assistantMessage`。 | Operational baseline |
| Resource/index/workspace/session/memory/export 持久化底座 | Program A-F 已在 `src/resources/`、`src/indexing/`、`src/workspace/`、`src/session/`、`src/workflows/`、`src/memory/`、`src/export/` 中落地。 | 已实现 |
| 平台壳层分离 | `PlatformCapabilities`、`RenderMaterializer`、render routes、workspace export bundle 已显式化桌面/Godot/mobile materialization 决策。Godot 仍保持 PNG-first，因为直接 SVG 导入不可靠。 | 已实现 |
| graphdb/ANN 运行时生产闭环 | graphdb/sqlite、external graphdb HTTP、local-vector rollout controls、external HTTP vector acceleration、runtime capability checks 与 rollout profile payloads 已存在。 | Operational，但未 production-closed |
| 唯一路由 / 运行时所有权 | modular route registration 已存在，但 conversation、runbook、turn-cache、rollout、fallback 编排仍大量留在 `src/server.ts`。 | 部分完成 |
| 架构缩减 | 当前行数扫描显示 `src/server.ts` 约 15,920 行、`src/learning/KnowledgeLearningPlatform.ts` 约 10,351 行；主要前端宿主文件仍偏大。 | 落后于目标 |

架构推进图：

| 层级 | 当前成熟度 | 下一步 |
|---|---|---|
| 图谱 / Path 核心 | 成熟 operational baseline | 保持兼容，避免无关重构。 |
| 运行时存储 / 检索 | Operational baseline | 当前 Windows 宿主的严格 release-evidence 历史审计已经在 sqlite 与 ANN 两侧都达到 3/3 并通过，readiness 已通过 `foundation_release_evidence_history` 暴露该门禁，且 opt-in 多宿主审计脚本已经存在；下一步是真实多宿主证据与阈值校准。 |
| Scoped RAG / conversation | Operational baseline | 在不删除 legacy 响应字段的前提下，从 `server.ts` 切出所有权。 |
| Memory / session / workflow | 已实现底座 | 先加固 policy、audit 与 workflow artifact 质量，不堆 UI-only 状态。 |
| Export / platform shell | 已实现基线 | 继续显式维护 Godot/mobile materialization 与 export profile 规则。 |
| Governance / CI | 强，但依赖部分宿主证据 | 将 FR-009、Linux strict Tauri 证据、graphdb/ANN 校准和文档真相作为分开的门禁。 |

即时推进方向：

1. 让本看板、task、implementation plan、TODO、README、接口文档与新增 solution note 保持同一套文档真相。
2. 完成 graphdb 与 ANN 发布级闭环：使用新的 opt-in 多宿主证据门禁，把严格 release-evidence 历史证据扩展到当前 Windows 宿主之外，收紧 graphdb connector budget，校准 ANN release-gate matrix 的 recall/latency 阈值，并收集 strict rollout 证据。
3. 从 `server.ts` 切出 turn-cache、alert trend、runbook bridge、rollout helper 等所有权压力。
4. 继续拆分 `KnowledgeLearningPlatform.ts`，但只在新 owner 能隐藏状态或强制不变量时提取。
5. 通过 typed optional payload 扩展 assistant block 覆盖面，同时保留 `assistantMessage` 与 stream/sync/replay 兼容。
6. 将 Godot/mobile 约束留在平台 adapter 边界，尤其保持“不直接依赖 SVG 导入”的规则。

2026-06-06 对齐与 P1 证据切片的验证位置：

- 初始对齐更新仅修改文档；当前 P1 evidence-history/readiness 切片会修改 verifier tooling、package scripts、测试与 readiness mandatory checks，不改变公开运行时 API。
- 当前切片需要执行：foundation release-evidence 契约测试、foundation readiness 回归测试、默认/严格 release-evidence 校验、migration tests、docs map 校验、docs site build、Mermaid fence 护栏、diff review，以及提交后 clean worktree。
- 后续代码切片仍必须继续执行活跃 task 文档中的运行时门禁，尤其是 `verify:foundation:sqlite-runtime:soak`、`verify:foundation:ann-runtime:matrix`、`verify:foundation:release-evidence`、`verify:foundation:release-evidence:strict`、`test:agent-workspace:contracts` 与 `verify:core-real-machine:clean`；当 release window 需要宿主多样性时，发布负责人应额外加入 `verify:foundation:release-evidence:multi-host`。
- ANN 发布级校准切片应使用 `verify:foundation:ann-runtime:release`；完整 matrix release-gate 路径已有 Windows 宿主新鲜证据，`verify:foundation:release-evidence` 会在这些报告被作为发布上下文前确认最新 sqlite/ANN release 报告仍然新鲜，readiness 也已通过 `foundation_release_evidence_history` 暴露严格历史审计，`verify:foundation:release-evidence:multi-host` 现在可以强制每个组件覆盖 2 个不同 host key。`verify:foundation:release-evidence:strict` 当前已在 Windows 宿主上以 sqlite `3/3` 与 ANN `3/3` 通过，因此剩余证据缺口是真实多宿主 release evidence 与校准，而不是本地报告数量。

## 2026-05-27 工作流门禁重对齐与进度真相同步

- 当前分支其实早已把仓库自有 workflow 迁移到 `actions/setup-node@v4` + `node-version: "24"`。
- `main` 上真正的故障比旧文档描述得更窄：
  - `scripts/verify-fixrisk-issues.js` 仍在强制要求已经移除的 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 过渡覆盖变量，
  - 因而 `FR-010` 会在“workflow YAML 已经迁移完成”的前提下继续失败。
- 本轮把三层真相一起对齐：
  - verifier 现在校验的是当前 Node 24 / 无覆盖变量基线，
  - fixrisk 实时状态文档现在准确描述该基线，
  - 活跃进度 / task / implementation 文档不再把“某次曾经绿过”写成静态事实。

这次修正的代码 / 方案现实矩阵：

| 区域 | 先前期望 | 当前 HEAD 现实 | 状态 |
|---|---|---|---|
| FR-010 workflow 闭环 | 继续保留旧的 Node24 兼容覆盖变量 | 仓库自有 workflow 已经稳定在 `setup-node@v4` + `node-version: "24"`，且应继续保持“不依赖已删除覆盖变量” | Corrected |
| Fixrisk code-level gate | workflow 迁移早已“算完成” | verifier 逻辑落后于 workflow 真相，需要同步升级到新基线 | Corrected |
| 剩余 Node 20 预警 | 只要 `setup-node` 升到 24 就应完全消失 | 一部分注解仍来自 `upload-artifact`、release helper 等 marketplace action 运行时，属于外部非阻塞债务 | Tracked |
| 进度文档口径 | 之前可以一直沿用“remote CI 已恢复为绿” | 现在必须区分仓库自有闭环、外部运行时债务与 live-run 状态 | Corrected |

从这里出发的即时推进方向：

- 持续保持 live `main` 上的 `Fixrisk Operational Readiness` 与 `Migration Gates` 为绿，
- 在不破坏共享 Reader-derived render substrate 的前提下，继续扩展 Tauri-first rich reply，
- 保持 Program F substrate 稳定，同时承认真正的工程前线仍是 Phase-1 / Phase-2 的发布级校准，
- 持续推动架构缩减，因为 `server.ts`、`KnowledgeLearningPlatform.ts` 与前端宿主文件仍然过大。

## 2026-05-27 Tauri-first 对话渲染现实同步

- 当前分支已经明显超出了上一次只强调 Program F 收口的状态快照。
- 目前代码真相至少覆盖了五个此前文档低估的切片：
  - scoped knowledge workspace grounding 已经真实落地，而不再只是“图已加载”的乐观假设，
  - Tauri Reader 的 markdown / math / mermaid 渲染链已经显著加固，
  - provider settings 与 TOML template 管理已经产品化进入前端，
  - conversation turn / resume 头的 CORS 兼容性已修复，
  - 桌面运行时调试与证据采集工具已成为仓库内正式能力，而不是一次性手工流程。

当前 HEAD 已真实落地：

- Knowledge workspace 闭环：
  - `src/frontend/source_manager.js` 现已发布 active source target，
  - `src/frontend/agent_workspace.js` 现已随 conversation 请求发送 `activeTarget` 与 scoped prefixes，
  - `src/server.ts` 现已执行 active-target-aware workspace hydration 与 selective title-like hydration，
  - `src/routes/data.ts` 不再用 stub 行为遮蔽真实 build / restore-cache 链路，
  - `src/learning/KnowledgeLearningPlatform.ts` 现已暴露 `workspaceReadiness`、`missDiagnostics`、title-hit planner 与 request inspection 辅助能力。
- Reader / runtime 渲染加固：
  - `src/frontend/reader.js` 现已在一条统一 runtime 路径中处理 raw markdown、KaTeX 与 Mermaid，并保留 frontend render first + backend PNG fallback，
  - `src/frontend/app.js` 现已抑制泄漏出的 Mermaid 错误工件，避免长时间错误块占据 Tauri 前台视窗，
  - `src/notemd/MermaidProcessor.ts`、`src/reader_renderer.ts` 与 `src/routes/render.ts` 已强化 Mermaid / Math 的 parity 与 render-service 行为。
- Provider / settings 交付：
  - `src/frontend/index.html`、`src/frontend/settings.js`、`src/notemd/AppConfigToml.ts`、`src/notemd/providerTemplates.ts` 与 locale bundles 现已提供独立的 agent/provider 设置页、预设模板与 TOML 模板落盘能力，
  - `API version` 字段也已经在产品层有解释，不再只是暴露一个没有说明的原始配置项。
- Runtime transport 兼容性：
  - `src/middleware/cors.ts` 现已显式允许 `x-agent-conversation-turn-id` 与 `x-agent-conversation-resume-turn-id`，从而关闭之前破坏 browser/Tauri conversation retry 的 preflight 故障。
- 调试与取证链路：
  - 仓库现在正式提供 page / webview / window 抓取工具与 Mermaid 分阶段导出脚本，Tauri 运行时故障可通过一等调试命令取证，而不再依赖一次性人工排查。

Tauri-first reply rendering 基线已交付：

- `src/learning/types.ts` 与 `src/learning/KnowledgeLearningPlatform.ts` 现已在保留 legacy `assistantMessage` 的同时返回向前兼容的 `assistantBlocks`，
- `src/frontend/markdown_runtime.js` 现已承载一套从 Reader 侧逻辑抽取出来的共享 markdown / math / mermaid runtime，
- `src/frontend/workspace_panes.js` 现已在结构化载荷存在时通过 typed blocks 挂载 assistant reply，而不再只走纯文本，
- `src/frontend/agent_workspace.js` 继续保留 legacy fallback，因此旧的 `assistantMessage`-only 路径仍然可显示。

在这条基线之上，当前代码又前进了一步：

- `src/learning/KnowledgeLearningPlatform.ts` 不再把 `assistantBlocks` 当成“同一段旧 answer 的运输包装层”，
- scoped conversation reply 现在会先组织成明确的 overview / explanation / evidence summary / memory notice / action guidance，再追加 citations 与 knowledge-action affordance，
- 这些 section 现在也会吃进真实 scoped 数据，而不再只是模板填充：explanation 会锚定最强 scoped point，evidence summary 反映真实 citation，action guidance 还会带上 memory follow-through hint，
- reply policy 现在也具备 intent awareness，因此 comparison-style 与 how-to-style prompt 可以把 explanation 和 next-action section 引导成不同语气与用途，
- 这意味着即便底层知识命中集合没变，Tauri 中的 agent 输出也已经可以在结构上明显不同。

当前剩余缺口已经收窄为：

- 当更多端点开始返回 richer assistant payload 时，继续扩充 block 覆盖面，
- 让新的共享 render substrate 在真实 browser/Tauri 运行时下持续经受验证，
- 为后续 Godot 降级 / 物化保留干净边界，而不是重新把 Godot 约束塞回当前 Tauri UX。

## 2026-05-27 Phase-1 SQLite Soak Gate 基线

- embedded `graphdb/sqlite` 基线现在不再只停留在“重启连续性 + workload envelope”证明。
- 当前 HEAD 还新增了一条专用的主机级 soak/performance verifier：
  - `npm run verify:foundation:sqlite-runtime:soak`
  - 会把结构化 JSON 报告写入 `output/verification/foundation-sqlite-runtime/`，
  - 并把发布级证据与较轻量的 `smoke` / `medium` / `heavy` 矩阵验证分开。

这条新门禁当前能够证明：

- `dist` runtime 与 packaged sidecar 两条路径上的重复重启周期，
- startup / ingest / readiness / diagnostics / query 五类时延统计摘要，
- 面向 sqlite 基线的 p95 / max latency 阈值门禁。

这条门禁当前仍不能单独证明：

- 跨多宿主、长时间窗口的稳定证据，
- 面向异构机器的最终发布阈值校准，
- A8 已经完全达到 production-closed。

这条切片的代码 / 方案现实矩阵：

| 区域 | 先前期望 | 当前 HEAD 现实 | 状态 |
|---|---|---|---|
| Knowledge workspace grounding | scoped query 应命中当前选中的 corpus，而不是只依赖已加载图数据 | active target、scope prefixes、title-like hydration、workspace readiness 与 miss diagnostics 已贯通前端、server 与 KLP | Operational |
| Tauri markdown reader parity | markdown、公式与 Mermaid 应能在真实运行时稳定显示且不留下持久错误遮罩 | Reader / runtime 现已支持 Mermaid frontend-first + backend-PNG fallback，并抑制泄漏错误工件 | Operational |
| Provider settings | provider / model / API key 控件应独立成页并可写入 durable TOML 配置 | 专用 agent/provider 设置页与 preset/TOML template helpers 已落地 | Operational |
| Conversation retry transport | turn / replay 头应能通过 browser/Tauri preflight | CORS 已允许两类 conversation turn 头 | Closed |
| Tauri agent reply rendering | assistant reply 应能显示 rich markdown，而非纯文本 | backward-compatible `assistantBlocks` 与共享 markdown runtime 已驱动 rich assistant reply，legacy `assistantMessage` 仍然保留 | Operational |

## 2026-05-26 Program F 收口状态

- 基于 deep-student 对照得出的下一阶段计划，当前 HEAD 已经实现到 Program F。
- 这套 durable substrate 不再只是规划项，而已经真实落入代码：
  - canonical resource 与 projection：`src/resources/`，
  - unit / segment indexing lifecycle：`src/indexing/`，
  - durable workspace / corpus entity：`src/workspace/`，
  - session / workflow durability：`src/session/`、`src/workflows/`，
  - typed memory governance 与 audit：`src/memory/MemoryGovernance.ts`，
  - deterministic workspace export bundle：`src/export/WorkspaceExportBundle.ts`。
- `KnowledgeLearningPlatform.ts` 现在会把这些 substrate 层与 graph、mastery、conversation、telemetry 状态一起持久化与恢复。
- `POST /api/knowledge/export/workspace` 现已作为 Program F 的 bundle 导出入口暴露出来。
- 平台导出语义也已经显式化，而不再依赖隐式推断：
  - `src/platform/PlatformCapabilities.ts` 已描述 bundle packaging mode（`full` / `slim`）与 indexed-readiness 要求，
  - `src/platform/RenderMaterializer.ts` 继续负责在 SVG 不安全的平台上强制 PNG-first materialization。

这次收口的最新验证证据：

- `npm.cmd run build:mini`
- `npm.cmd test -- --runInBand src/resources/ResourceRegistry.test.ts src/workspace/WorkspaceRegistry.test.ts src/indexing/IndexLifecycle.test.ts src/session/SessionStateStore.test.ts src/workflows/WorkflowArtifactStore.test.ts src/memory/MemoryGovernance.test.ts src/export/WorkspaceExportBundle.test.ts src/platform/PlatformCapabilities.test.ts src/platform/RenderMaterializer.test.ts src/routes/registry.contract.test.ts src/learning/store.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts`

工程含义：

- mobile slim export 与 desktop export 现在已经收敛到同一套 workspace / resource / index / session / memory substrate，
- lightweight local RAG 与多平台导出现在共享同一份 durable scope model，而不是各自维护一套 ad hoc 状态路径。

## 2026-05-12 HEAD 现实校准

- 先前“Phase-1 已收口”的表述对当前 HEAD 过于乐观，现以本节为准。
- 当前已经真实落地的部分：
  - `src/learning/store.ts` 已具备 file-backed ops、embedded SQLite graphdb persistence/query 路径，以及 HTTP adapter 语义路径，
  - embedded sqlite 基线现在还具备了重启耐久性证明：shutdown 会干净关闭 store，adapter 可安全重开，server integration 已覆盖 ingest -> shutdown -> fresh module reload -> diagnostics/query/readiness 连续性，
  - 现在已有一条主机级验证器，会在当前 Windows 宿主上分别走 `dist` runtime 与 packaged sidecar 两条路径，证明同一条 embedded sqlite 基线可以完成 ingest -> store diagnostics/foundation readiness -> restart -> query 连续性（`scripts/verify-foundation-sqlite-runtime.js`），
  - 现在还有一条主机级 workload matrix 验证器，把同样的证明扩展到 `smoke` / `medium` / `heavy` 三档语料规模：在同样两条 runtime 路径上验证 snapshot metadata 计数、restart 连续性与多点 query 连续性（`scripts/verify-foundation-sqlite-runtime.js --matrix`），
  - foundation readiness mandatory checks 现在已包含面向发布的 sqlite soak 别名（`verify:foundation:sqlite-runtime:release`）、ANN matrix release gate（`verify:foundation:ann-runtime:release`）、release-evidence 新鲜度校验器（`verify:foundation:release-evidence`）与严格 release-evidence 历史校验器（`verify:foundation:release-evidence:strict`），因此运维侧 readiness 输出与发布证据使用的 package scripts 保持一致，
  - 现在也已有一条主机级 ANN 验证器，会在当前 Windows 宿主上分别走 `dist` runtime 与 packaged sidecar 两条路径，证明同一条 `external_http` connector baseline 可以完成 ingest -> live query-backend diagnostics -> restart -> query 连续性（`scripts/verify-foundation-ann-runtime.js`），
  - 现在还有一条主机级 ANN workload matrix 验证器，把同样的证明扩展到 `smoke` / `medium` / `heavy` 三档语料规模：在同样两条 runtime 路径上验证 sync/select telemetry、aligned representation metadata 与 restart 连续性（`scripts/verify-foundation-ann-runtime.js --matrix`），
  - ANN verifier 现在也新增了 release-gate 模式与结构化报告输出：`scripts/verify-foundation-ann-runtime.js --release-gates` 会把 startup / ingest / diagnostics / query duration summary 与 targeted-query recall 写入 `output/verification/foundation-ann-runtime/`，`npm run verify:foundation:ann-runtime:release` 则接入完整 matrix 发布路径，
  - `scripts/verify-foundation-release-evidence.js` 现在会读取最新 sqlite soak 与 ANN release-gate 报告，校验有界新鲜度、必需 profile、两条 runtime mode、sqlite soak gates、ANN release gates 与 expected recall，扫描带时间戳的历史报告，报告 host-key 覆盖度，并把聚合 release-evidence 摘要写入 `output/verification/foundation-release-evidence/`；默认审计每个组件要求 1 份有效新鲜报告，`verify:foundation:release-evidence:strict` 要求 3 份且当前 Windows 宿主已通过，`verify:foundation:release-evidence:multi-host` 还要求 2 个 host key，
  - `src/learning/queryBackend.ts` / `src/learning/vectorAccelerationAdapter.ts` 现已具备 ANN 风格 prefilter、representation telemetry、circuit health、远端索引同步，以及 live `external_http` connector 证明，
  - runtime capability / runbook 治理也已新增显式的 ANN 远端索引同步健康度检查（`query_vector_acceleration_index_sync_health`），与 prefilter、health、traceability、circuit 并列，
  - runtime capability 治理现在也新增了显式门禁 `query_vector_acceleration_calibration_readiness`，用来正式回答当前 ANN 路径是否已经具备进入发布级阈值校准的前提条件，
  - `server.ts` 现已补齐对应的 operator 闭环：该 sync-health 门禁已经进入 verification escalation、remediation action queue、以及 per-check runbook history summary，
  - agent workspace 的 runtime-runbook 前端面现已把面向运维的 ANN 治理直接前推到壳层：verify/checks 不仅能看到 sync-health，还能看到熔断预算、可追踪性、预筛选摘要，并进一步看到用于校准的阈值/信号钻取、校准就绪态以及显式校准门禁；action-queue 则继续承载 index-sync 事故钻取，
  - modular `src/routes/knowledge.ts` 的 runtime-runbook 路由面现在也会委托到真实 server 侧 runbook ops，并完整透传 query 参数，因此浏览器/运行时消费者不再命中旧的 KLP placeholder verify/history/checks/action-queue/remediation/schedule 响应，
  - 浏览器 strict smoke 现在也会用真实浏览器证据证明这批 ANN runbook 面：verify 卡的 ANN sync/熔断/可追踪性/预筛选内容及阈值/信号/校准就绪标签、checks 卡的首个检查 ANN sync 加熔断/可追踪性/预筛选快照，以及 action-queue 的 index-sync 钻取都已纳入端到端断言，而不再只停留在组件测试层，
  - agent workspace 的 locale 治理现在也更严了：双语 locale bundle 已补齐 strict browser smoke 实际触达的 query/quality/runbook 卡片文案，`src/agent_workspace.locale.contract.test.ts` 会阻断源码引用的 `agentWorkspace.*` key 漂移，而启动期 `translate()` 也不再在 locale 初始化完成前发出误报式 missing-key warning，
  - `src/learning/KnowledgeLearningPlatform.ts` 中的 Phase-2 运行时诊断面已接通真实实现，包括 query-backend comparison/history/trend、knowledge staleness diagnostics/rebuild planning、learning-quality history/trend、session-plan quality evaluate/history/trend/runtime-threshold diagnostics、query-backend config、query-backend diagnostics，
  - Phase-3 的导师/记忆诊断仍为真实实现，且 `src/server.ts` 现已注入默认激活态 tutor adapter，正常 server 路径可直接产出 adapter telemetry。
- 当前仍未闭环的部分：
  - Phase-1 A8 已经超出 file-only 默认态：`src/server.ts` 现在默认走 `graphdb/sqlite` 并保留显式 file fallback，重启耐久性已证明，主机级 dist/runtime + packaged sidecar 证明也已具备，而且 `smoke` / `medium` / `heavy` 主机端 workload matrix 也已具备；但在宣布本地图后端达到生产闭环之前，仍需补齐 soak、长时段与性能级加固；
  - Phase-1 A9 现已进入 operational baseline，而不再只是 scaffolding：主机级 runtime 证明、主机级 workload matrix 与 matrix release-gate 证据也已具备；但在宣布 ANN 层达到生产闭环前，仍需补齐多轮多宿主校准与阈值收敛；
  - Phase-2 的 quality/session/query 可观测性已不再是空占位，但它们仍需要建立在当前 graph/ANN operational baseline 之上的发布级校准，因此还不能宣称发布级闭环；新的 ANN calibration-readiness gate 只是把前提条件正式化，并不等于校准完成；
  - 默认 tutor routing 已不再只是 catalog-only，但当前 runtime 仍是 `local`-first，并保留显式 rule-engine fallback，而不是已验证的生产级多 provider 路由策略。
- 因此当前活跃重心不是“默认认为 Phase-1 已完成然后推进上层”，而是：
  1. 在保持新的 dist/runtime + packaged sidecar 证明以及 workload matrix 持续为绿的前提下，先补完 embedded graph backend 基线剩余的 soak / 长时段 / 性能闭环，
  2. 补完当前 live ANN connector baseline 的工作负载与阈值闭环，
  3. 把当前已前推到 runbook 卡片中的 ANN 指标可见性，继续推进为带工作负载校准的发布级门禁，
  4. 让这批新诊断面始终与同一份运行时真相保持一致，
  5. 只有在 graph/ANN 基线达到发布级后，才把 Phase-2 / Phase-3 门禁升级为发布级结论。

## 2026-05-12 当前架构体量

| 文件 | 当前行数 | 含义 |
|---|---:|---|
| `src/server.ts` | 15,920 | 路由虽已模块化，但主服务单体仍然偏大，而且承载了更多运行时编排 |
| `src/learning/KnowledgeLearningPlatform.ts` | 10,043 | KLP 仍是最主要的实现重心，并继续吸纳 workspace-readiness / planner 逻辑 |
| `src/frontend/path_app.js` | 4,943 | path workbench / controller 仍未拆完，且额外承载了 reader-parity 责任 |
| `src/frontend/app.js` | 5,953 | graph host 侧控制面仍较厚，并新增 Mermaid error-guard 行为 |
| `src/frontend/reader.js` | 1,334 | Reader / runtime render 已从轻量辅助逻辑演化为一等子系统 |
| `src/frontend/agent_workspace.js` | 3,214 | agent orchestration 已存在，但 reply rendering 仍未从 text shell 升级到 rich message surface |
| `src/routes/knowledge.ts` | 690 | knowledge route 还需要进一步拆分 |

> 本节数字是当前 HEAD 的权威口径。下方较早的重构缩减表仍可保留作历史追溯，但不再等同于当前分支真实状态。

## 2026-05-12 阶段快照

| Phase | 目标 | 当前状态 | 代码证据 |
|---|---|---|---|
| Phase 1 | 知识解析 + 图谱底座 + staleness 治理 | `Operational baseline` | `src/learning/store.ts`、`src/learning/queryBackend.ts`、`src/learning/vectorAccelerationAdapter.ts`、`src/server.ts` |
| Phase 2 | 掌握闭环 + 发散引擎 | `Partial` | `src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/path_app.js` |
| Phase 3 | 可插拔导师 + 记忆操作层 | `Early operational` | `src/learning/KnowledgeLearningPlatform.ts`、`src/learning/tutorAdapter.ts`、`src/server.ts`、`src/routes/knowledge.ts` |

## 2026-05-10 未完成目标同步

- 本页已与全仓文档审计 [Open Goal Audit (2026-05-10)](../../../open_goal_audit_2026-05-10.md) 对齐。
- 当前未完成目标的裁定口径以以下活跃看板为准：
  - `docs/zh/TODO.md`
  - `docs/zh/task.md`
  - `docs/zh/tauri_tasks.md`
  - `docs/zh/TEST_REPORT.md`
- 归档或历史清单仅用于追溯，不作为当前发布闸门的权威来源。

## 2026-05-10 Phase-1 收口更新（历史记录，已被 2026-05-12 HEAD 现实校准覆盖）

- 下列记录仅表示当时已经完成的实现增量，不再代表当前 HEAD 的发布级门禁结论：
  - 图后端适配器路径已具备 HTTP 操作级语义（`getNode/queryNodes/queryEdges/findPath`）并接入运行时诊断可追溯。
  - ANN 连接器加固已落地候选归一化、表示一致性遥测传递与 prefilter 有效性信号。
- 当前权威口径请回到本页顶部的“2026-05-12 HEAD 现实校准”，不要把本段历史记录解读为 A8/A9 已经发布级闭环。

## 范围

- 聚焦对象：本地优先学习平台（摄入、检索、学习路径、导师、记忆、治理）。
- 时间窗口：`v1.7.0` 到当前分支基线。
- 证据原则：每条进展结论都必须可映射到：
  - 契约层（`src/learning/api.ts`、`src/learning/types.ts`）
  - 路由层（`src/server.ts`）
  - 测试层（`src/knowledge.api.contract.test.ts` 及领域测试）

## 当前交付重心

当前 L4 的第一优先级不再是泛化交互扩展，而是以下端到端链路：

- 前端 agent chat，
- 本地知识点列表，
- 停靠式 Tauri 图界面 `focus mode` pane，
- 可与 graph focus 并排存在并支持全屏提升的 learning-path pane，
- 以及能够复用 Reader markdown / math / mermaid 管线的 Tauri-first assistant reply rendering。

执行参考：

- [Agent 对话与 Focus Mode 主线交付方案](./agent-conversation-focus-mode-plan.md)

本分支当前切片状态：

- 主前端已经落入 agent workspace shell（`src/frontend/index.html`、`src/frontend/styles.css`），
- conversation 路由现在已返回带 typed capability descriptor 的本地知识点，当前已覆盖 `focus`、`learning path`、tutor 侧 `generate_quiz` / `recap` / `generate_transfer` / `generate_counterexample` / `follow_up`、query 侧 `compare_query_backends` / `inspect_query_backend_diagnostics` / `inspect_query_backend_comparison_history` / `inspect_query_backend_comparison_trend`、导师诊断侧 `inspect_tutor_adapter_telemetry` / `inspect_tutor_trace_diagnostics`、质量/会话诊断侧 `inspect_learning_quality_trend` / `inspect_learning_quality_history` / `inspect_session_plan_quality_trend` / `inspect_session_plan_quality_history`、session 侧 `inspect_session_history` / `build_study_session`，以及对话记忆召回 `inspect_conversation_memory`，并补齐 execution / failure / UI hint 语义（`src/server.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/learning/types.ts`），
- conversation 知识点动作链路现已收敛为 typed-only（`capabilities` 为唯一动作来源），后端响应与前端 pane 渲染均已移除 legacy `availableActions` fallback/统计路径（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/workspace_panes.js`、`src/agent_workspace.frontend.test.ts`、`src/knowledge.api.contract.test.ts`），
- agent workspace 的 capability 执行分发已收敛为显式 execution-kind handlers（不再执行 legacy action fallback）；knowledge operation 已拆分为独立的 transport registry 与 request-builder registry，result presentation 也已拆分为 custom presenter、card-presentation descriptor 与 payload-builder 三层，并对 `unsupported_result_presentation*` 漂移统一走 fail-fast；parity 与前端 diagnostics 现已覆盖 transport / request-builder / custom-presentation / card-presentation / payload-builder / execution-kind 六类注册表完整性（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.contract.parity.test.ts`），
- 点击 `Learning Path` 不再停在文本预览，而是会把现有 path workspace（`path-container` + sidebars）挂入停靠式 learning-path pane（`src/frontend/workspace_panes.js`、`src/frontend/agent_workspace.js`），
- 主图谱区域已经为 workspace 预留真实宽度，使 conversation + graph focus + learning path 可以在同一 host-owned 布局中并存（`src/frontend/styles.css`），
- graph focus 的 fullscreen 已升级为真实 graph workspace promotion，而不是只把右侧元信息卡片放大（`src/frontend/workspace_panes.js`、`src/frontend/styles.css`），
- scoped-knowledge conversation 流现在也更诚实了：active folder target 会进入 request contract，server 会 selective hydrate 可能 title-match 的文档进入 workspace，conversation trace 也会返回 readiness + miss diagnostics，而不再只是给出一个空 top-k（`src/frontend/source_manager.js`、`src/frontend/agent_workspace.js`、`src/server.ts`、`src/routes/data.ts`、`src/learning/KnowledgeLearningPlatform.ts`），
- 新增 agent workspace 已补齐静态壳层与运行时按钮/空态提示的双语覆盖，且已有知识卡片动作按钮与带参数系统消息会在语言切换时重渲，而不是停留在旧语言；conversation card 的重渲也已集中到 card-kind 渲染注册表，并新增源码级一致性门禁测试校验 append-kind 与注册表键集合对齐，降低后续新增卡片的漏改风险（`src/frontend/index.html`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/frontend/workspace_panes.js`、`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- provider / model / API-key 设置现在已独立成 agent settings 页面，并支持 preset-template / TOML-template 流程；同一 agent workspace 现在也已具备 typed rich-reply 基线，而不再停留在 plain-text-only（`src/frontend/index.html`、`src/frontend/settings.js`、`src/notemd/AppConfigToml.ts`、`src/notemd/providerTemplates.ts`、`src/frontend/markdown_runtime.js`、`src/frontend/workspace_panes.js`、`src/frontend/agent_workspace.js`），
- Reader / runtime 渲染栈已对 Tauri markdown 使用场景显著加固：raw markdown、KaTeX、Mermaid frontend render、Mermaid backend PNG fallback、leaked Mermaid error suppression，以及面向 agent reply 的共享 markdown runtime 都已到位（`src/frontend/reader.js`、`src/frontend/app.js`、`src/frontend/markdown_runtime.js`、`src/reader_renderer.ts`、`src/routes/render.ts`、`src/notemd/MermaidProcessor.ts`），
- locale 治理已新增后端到前端的能力标签键一致性门禁：conversation capability 发出的 `labelKey` 必须映射到非空的双语 `agentWorkspace.actions.*` 文案（`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.locale.contract.test.ts`），
- modular knowledge route 闭环现在已经具备真实浏览器 strict 证据，而不再依赖 snapshot 式恢复通过：conversation 返回结构、capability 触发请求路由、卡片标题本地化、graph-focus 兼容 API 已在真实浏览器/网络 trace 下通过 `STRICT`、`UI_STRICT`、`UI_DYNAMIC_STRICT`（`src/routes/knowledge.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/app.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`scripts/verify-agent-workspace-browser.js`），
- locale 治理现已同时阻断能力失败文案漂移：conversation capability 发出的 `failure.messageKey` 必须映射到双语 `agentWorkspace.messages.*` 文案，且中英占位符集合与 fallback 占位符集合必须一致（`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.locale.contract.test.ts`），
- 后端 capability 描述子合同现已对 `knowledge_operation` 执行完整性做硬门禁：必须同时携带 `operationId` 与 `resultPresentation`，并要求失败元数据包含 `messageKey` 与 `fallbackMessage`（`src/learning/KnowledgeLearningPlatform.ts`、`src/agent_workspace.contract.parity.test.ts`），
- 前端 capability 执行链路现已新增按 operation 维度的结果呈现 allowlist 门禁（默认值 + 显式覆盖，例如 `execute_tutor_action -> tutor_action_card`）；不在允许集合内的组合会在后端请求发起前与渲染分发前 fail-fast（`src/frontend/agent_workspace.js`、`src/agent_workspace.contract.parity.test.ts`、`src/agent_workspace.frontend.test.ts`），
- 合同治理现已阻断 allowlist override 漂移：override 的 operation 键必须是 `AgentConversationCapabilityOperationId` 子集，override 的结果呈现值必须是 `AgentConversationCapabilityResultPresentation` 子集（`src/agent_workspace.contract.parity.test.ts`），
- parity 治理现已约束 allowlist 结构：每个 operation 的 allowlist 必须包含 transport 默认结果呈现；后端若使用非默认呈现，前端必须通过显式 override 声明（`src/agent_workspace.contract.parity.test.ts`），
- override 卫生约束现已落地非默认语义：operation override 条目不得重复 transport 默认结果呈现（`src/agent_workspace.contract.parity.test.ts`、`src/frontend/agent_workspace.js`），
- override 治理现已阻断陈旧条目：前端 override 的每个结果呈现都必须在同 operation 的后端 capability 发射中被观测到（`src/agent_workspace.contract.parity.test.ts`），
- 前端注册表诊断现已导出按 operation 的 override/默认/allowlist 结果呈现映射（`operationResultPresentationOverrideMap`、`operationDefaultResultPresentations`、`operationAllowedResultPresentations`），用于合同漂移排障（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- 前端注册表诊断现已额外导出 `operationInvalidResultPresentationOverrideMap`，用于运行时暴露 default 重复项/未知 override token 的配置漂移（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- 前端注册表诊断现已额外导出 `operationUnknownResultPresentationOverrideMap`，用于运行时暴露未知 override operation ID 的配置漂移（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- 前端注册表诊断现已额外导出 override 漂移摘要信号（`operationResultPresentationOverrideDriftDetected` 及 invalid/unknown token 计数），用于快速运行时健康检查（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- 前端消息 locale 治理现已阻断未解析运行时消息键：`agent_workspace.js` 引用的每个 `agentWorkspace.messages.*` 键都必须在中英 locale 中可解析，且占位符集合一致（`src/frontend/agent_workspace.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.locale.contract.test.ts`），
- app 层 tauri 生命周期可观测性已补齐：前端会将 `pathmode-window-toggled` 事件写入有界 trace 缓冲，并转发为 `noteconnection:pathmode-window-toggled` DOM 事件，便于本地诊断与证据采集（`src/frontend/app.js`），
- 桌面生命周期验证链路现已新增首条真实 app/window handle 证据路径（`verify:agent-workspace:tauri:window-evidence`）：通过 Rust 专项用例覆盖 mock-app 的窗口句柄生命周期，并将结构化证据落盘到 `output/tauri/agent-workspace-window-evidence`；当宿主缺少系统依赖时会按显式 `degraded` 语义降级（`scripts/verify-agent-workspace-tauri-window-evidence.js`、`src-tauri/src/lib.rs`、`src/agent_workspace.tauri.contract.test.ts`），
- CI 已在 `.github/workflows/migration-gates.yml` 接入常态化 strict 桌面证据作业（`agent-workspace-tauri-strict-evidence`），会在 Linux 宿主安装 `javascriptcoregtk-4.1` / `libsoup-3.0` 依赖后执行 `verify:agent-workspace:tauri:rust:strict` 与 `verify:agent-workspace:tauri:window-evidence:strict`；release 流程 `.github/workflows/release-desktop-multi-os.yml` 也已在 Linux 桌面构建路径接入同等 strict 证据门禁（在 bundle 产物构建前执行）；两条流程会额外生成 strict 证据索引（`verify:agent-workspace:tauri:evidence:index:strict`）、执行 strict 证据清单门禁（`verify:agent-workspace:tauri:evidence:manifest:strict`），并上传 tauri 证据工件用于审计追溯（保留期固定 30 天），同时 Linux release 链路会将 `release-fragment-latest.md` 通过 marker 幂等 upsert 写入 GitHub Release notes，
- `migration-gates` 现已新增常态化 `agent-workspace-contract-gates` 作业：执行 `test:agent-workspace:contracts`（parity/frontend/tauri 三类契约套件）与 `test:conversation-turn-cache:durability`（turn-cache trend index/export 跨重启一致性检查），用于补齐 agent-workspace 合同演进的 CI 漂移阻断能力，
- 协议治理已新增许可证一致性门禁：`test:license:contract` 会校验 `LICENSE`、`README`、`package.json`、`src-tauri/Cargo.toml` 在主线持续保持 `GPL-3.0-only`，并已接入 `migration-gates` CI 作业，
- browser smoke 已覆盖真实 `conversation/path/query-compare/quality/session/runbook` 后端切片（含 trend + history 诊断，以及 runbook verify/checks/action-queue）、真实 graph runtime、真实 path runtime，并会在输出 screenshot / console / network-summary 证据前，先断言 verify/checks 中的 ANN sync-health + 熔断/可追踪性/预筛选内容及阈值/信号/校准就绪标签，以及 action-queue 的 index-sync 钻取都已经真实渲染（`scripts/verify-agent-workspace-browser.js`、`src/agent_workspace.browser.contract.test.ts`），
- scoped conversation-memory 基线已完成端到端接线（typed contract、后端 normalizer/route、前端 operation registry、双语键、生命周期测试、runtime/browser 验证），端点为 `/api/knowledge/conversation-memory/{list,add,search,delete,feedback}`（`src/learning/api.ts`、`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/server.ts`、`src/frontend/agent_workspace.js`、`src/knowledge.api.contract.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`、`src/agent_workspace.frontend.test.ts`），
- unified turn streaming 最小基线已落地：在 `/api/knowledge/conversation` 上通过 `Accept: text/event-stream` 协商输出事件流（`turn_started`/`capability_planned`/`capability_progress`/`capability_result`/`turn_completed`/`turn_failed`），前端采用 stream-first 并保留同步 JSON fallback（`src/server.ts`、`src/frontend/agent_workspace.js`、`src/knowledge.api.contract.test.ts`、`src/agent_workspace.frontend.test.ts`），
- M8.2 恢复语义已落地：前端在 stream-first 与 sync fallback 间透传统一 `turnId`，`/api/knowledge/conversation` 已新增 turn 级重放窗口与去重/冲突保护（`turn_id_conflict`），中断后重试可回放缓存事件而不重复执行回合（`src/server.ts`、`src/frontend/agent_workspace.js`、`src/knowledge.api.contract.test.ts`、`src/agent_workspace.frontend.test.ts`），
- M8.3 的 operator 基线已落地：新增 `GET /api/knowledge/conversation/turn-cache/diagnostics` 输出 turn 缓存生命周期诊断（TTL/容量配置、实时状态、命中率、冲突计数、回放计数、淘汰计数），并支持通过 `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_TTL_MS` / `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES` 进行运行时调参（`src/server.ts`、`src/knowledge.api.contract.test.ts`），
- M8.4 的 operator 产品化基线已落地：turn-cache 诊断已并入 agent workspace 执行契约链路 `inspect_conversation_turn_cache_diagnostics` -> `fetch_conversation_turn_cache_diagnostics` -> `conversation_turn_cache_diagnostics_card`，并补齐双语卡片渲染与语言切换重渲覆盖（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.contract.parity.test.ts`、`src/knowledge.api.contract.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`），
- M8.5 的阈值治理基线已落地：turn-cache 诊断新增 env 可调阈值与策略检查（`utilization_pct`、`execution_failure_ratio_pct`、`conflict_count`、`stale_eligible_entries`），并输出告警汇总状态（`summaryStatus`）与 fail/warn 计数；agent workspace 诊断卡片已补齐告警摘要/最高级别检查/阈值画像三类指标及双语渲染覆盖（`src/server.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.frontend.test.ts`、`src/knowledge.api.contract.test.ts`），
- M8.6 的趋势治理基线已落地：`GET /api/knowledge/conversation/turn-cache/diagnostics/trend` 已输出有界告警历史快照、趋势状态（`insufficient_data` / `stable` / `improving` / `regressing`）、升级级别（`normal` / `watch` / `high` / `critical`）与活动 streak 上下文；并支持通过 `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_LIMIT`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_SAMPLE_MIN_INTERVAL_MS`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_WINDOW_SIZE`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_MIN_SAMPLES`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_WARN_STREAK`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_FAIL_STREAK` 进行策略调参（`src/server.ts`、`src/knowledge.api.contract.test.ts`），
- M8.6 的 operator 产品化收口已落地：trend 能力已并入 agent workspace 执行契约链路 `inspect_conversation_turn_cache_alert_trend` -> `fetch_conversation_turn_cache_alert_trend` -> `conversation_turn_cache_alert_trend_card`，并补齐双语卡片渲染与语言切换重渲覆盖（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.contract.parity.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`），
- M8.7 的持久化与 runbook 门禁联动基线已落地：turn-cache 告警趋势历史已支持跨重启持久化（`runtime_data/agent_conversation_turn_cache_alert_history.v1.json`，带有界压缩与异步写入队列），并新增 `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/index` 与 `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/export`；升级状态已通过 synthetic check `conversation_turn_cache_alert_trend` 接入 runtime runbook，并关联整改动作 `inspect_conversation_turn_cache_alert_trend_index`、`stabilize_conversation_turn_cache_alert_pressure`、`verify_conversation_turn_cache_alert_trend_recovery`（`src/server.ts`、`src/knowledge.api.contract.test.ts`、`src/notemd.server.integration.test.ts`），
- M8.8 的 operator 钻取与调度护栏基线已落地：agent workspace 已新增显式趋势 index/export 能力动作（`inspect_conversation_turn_cache_alert_trend_index` / `inspect_conversation_turn_cache_alert_trend_export`）及对应操作链路（`fetch_conversation_turn_cache_alert_trend_index` / `fetch_conversation_turn_cache_alert_trend_export`），trend/action-queue 卡片已补齐 storage/index/export/endpoint-hint 钻取上下文；replay schedule 配置已加入跨字段护栏（`maxReplayChecksPerWindow >= replayLimit`），并在 telemetry 与工作台状态文案中显式回传 `config_guardrail_applied` + `schedule_config_guardrail:*` 原因（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/frontend/path_app.js`、`src/server.ts`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.contract.parity.test.ts`、`src/knowledge.api.contract.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`、`src/notemd.server.integration.test.ts`），
- M8.9 的 replay-schedule 主动建议 + 策略模板基线已落地：replay schedule 快照新增结构化建议载荷（`telemetry.recommendations`）与策略模板候选（`telemetry.policyTemplates`），覆盖 guardrail / budget / trigger / cooldown / skip-streak 等场景；schedule 配置更新已支持 `policyTemplate` 一等输入；workbench 的 refresh/update/tick 状态文案会回传首条建议与模板，支持运维下一步动作决策（`src/server.ts`、`src/frontend/path_app.js`、`src/notemd.server.integration.test.ts`、`src/path_app.runtime_trace_filter.behavior.test.ts`），
- M9 的 replay-schedule 安全自动执行基线已落地：schedule 配置新增显式 `autoExecution` 策略（`enabled`、`mode`、`requireDryRunParity`、`minConsecutiveSkips`），快照 telemetry 新增门禁诊断块（`eligible`、`blockedReasons[]`、`decision`、`lastAttemptedAt`、`lastExecutedAt`），schedule tick 在既有 trigger/cooldown/budget 守卫之上收敛为 gate-first 决策语义（`auto_execution_blocked`、`auto_execution_dry_run_required`、`auto_execution_executed`）（`src/server.ts`、`src/notemd.server.integration.test.ts`、`src/knowledge.api.contract.test.ts`），
- M9.1 的 workbench 运维可解释性已落地：replay-schedule 的 refresh/update/tick 状态文案与 remediation history 文本已补齐 `autoExecution(...)` 诊断片段，配置更新路径也支持从前端偏好透传 `autoExecution` 字段到后端 payload（`src/frontend/path_app.js`、`src/path_app.runtime_trace_filter.behavior.test.ts`），
- M10 的底座收敛引导开关已落地：graphdb 存储新增 provider 选择与 fallback 策略控制（`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_ID`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED`），`local_vector` 加速链路新增显式 failure 语义与表示一致性 strict 开关（`NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE=fail_open|fail_closed`、`NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT=true|false`），并已贯通到 query trace/runtime diagnostics（`src/learning/store.ts`、`src/learning/queryBackend.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/server.ts`、`src/learning/store.test.ts`、`src/learning/queryBackend.test.ts`、`src/knowledge.api.contract.test.ts`），
- `local_vector` 的 strict 语义现进一步收敛：当 `external_http` endpoint 缺失时会触发显式适配器故障（`external_http_endpoint_missing`），`fail_closed` 不再静默降级为 full-scan，而会在 trace/diagnostics 中暴露 `vector_acceleration_adapter_failure:*`（`src/learning/vectorAccelerationAdapter.ts`、`src/notemd.server.rollout-boundary.integration.test.ts`），
- query-backend 诊断/配置端点现回传向量加速 rollout 上下文（`configuredVectorAccelerationProvider`、`configuredVectorAccelerationFailureMode`、`configuredVectorAccelerationRepresentationStrict`、`queryVectorAnnPrefilterEnabled`、`rolloutProfile`），便于 workbench/operator 直接判断 strictness，无需额外依赖 `/api/knowledge/state`（`src/server.ts`、`src/notemd.server.integration.test.ts`、`src/notemd.server.rollout-boundary.integration.test.ts`），
- M10.2 的 graphdb 适配器基线已新增 `external_http` provider 路径（`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS`），并补齐连接器诊断与严格模式下端点缺失的 fail-closed 行为（`graphdb_http_endpoint_missing`）（`src/learning/store.ts`、`src/server.ts`、`src/learning/store.test.ts`、`src/notemd.server.rollout-boundary.integration.test.ts`），
- M10.3 的 graphdb `external_http` 连接器治理已升级为 runtime 一等信号：store diagnostics 现新增结构化连接器遥测（`healthStatus`、`circuitState`、`requestCount`、`retryCount`、`shortCircuitCount`、`lastRequestId`、`lastErrorCode`、`lastStatusCode`、`lastRetryAfterMs`），runtime capability matrix 新增 `store_graphdb_connector_health` 检查并接入 runbook/debug-trace 链路；同时在 strict rollout 集成与 store 单测中补齐健康路径与 circuit-open 退化语义验证（`src/learning/store.ts`、`src/learning/runtimeCapability.ts`、`src/learning/store.test.ts`、`src/learning/runtimeCapability.test.ts`、`src/notemd.server.rollout-boundary.integration.test.ts`），
- M10 的 rollout 边界集成覆盖已扩展：新增隔离式服务启动测试，向量加速 `fail_closed` 现同时覆盖“适配器故障可观测”与 `external_http` 正向健康路径（无后端回退、`healthStatus=ready`、请求关联字段回传），并验证 graphdb `provider=none` + `fallback=false` 的 store API fail-closed 行为，以及 graphdb `provider=external_http` + `fallback=false` 在 `/api/knowledge/store/reload` 与 `/api/knowledge/store-diagnostics` 的正向成功路径（含 rollout 上下文字段 `configuredGraphDbAdapterProvider` / `configuredGraphDbAdapterId` / `graphDbFallbackEnabled`）（`src/notemd.server.rollout-boundary.integration.test.ts`、`src/server.ts`），
- M10 的 rollout profile 运维可观测性已打通：运行时 payload 新增 `rolloutProfile`（store/vector 严格度 + 聚合模式），`runtime-capability-matrix` 与 runbook/verify/history/history-checks/action-queue/remediation-history/replay-schedule 端点（含 remediation POST：`event`/`replay`/`schedule`/`tick`）同步回传该 profile；learning workbench runtime 摘要新增 `rollout=<mode>(...)` 提示，并已补齐集成/契约/前端行为测试覆盖（`src/server.ts`、`src/notemd.server.integration.test.ts`、`src/knowledge.api.contract.test.ts`、`src/frontend/path_app.js`、`src/path_app.runtime_trace_filter.behavior.test.ts`），
- 旧的全局 Path Mode 入口在切入整屏路径工作区前会先释放停靠 pane，避免两条入口互相踩状态（`src/frontend/app.js`）。

## 最新验证快照（2026-05-18）

- 本轮已在当前 Windows 宿主重新确认通过：`node node_modules/jest/bin/jest.js src/learning/runtimeCapability.test.ts src/knowledge.api.contract.test.ts --runInBand --no-cache`、`node node_modules/jest/bin/jest.js src/agent_workspace.frontend.test.ts --runInBand --no-cache`、`npm run test:agent-workspace:contracts`、`npm run build:with-vite`、`npm run docs:diataxis:check`、`npm run docs:site:build`、`NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT=1 node scripts/verify-agent-workspace-browser.js`。
- 本轮已在当前 Windows 宿主重新确认通过：`npm run build:sidecar`、`npm run verify:foundation:sqlite-runtime`、`npm run verify:foundation:sqlite-runtime:matrix`、`npm run verify:foundation:ann-runtime`、`npm run verify:foundation:ann-runtime:matrix`。
- 严格浏览器证据现在已显式校验本轮新增的双语 runtime-runbook verify/checks ANN 治理标签：不仅验证 sync-health，也验证熔断、可追踪性、预筛选摘要，以及支撑校准工作的阈值/信号钻取和校准就绪态。
- embedded sqlite 图基线现在也具备了 Jest 集成测试之外、可重复执行的主机级运行时证明：轻载验证会让 `dist` runtime 与 packaged sidecar 两条路径持续保持 ingest -> diagnostics/readiness -> restart -> query 连续性，而 workload matrix 验证则会在同样两条路径上证明 `smoke` / `medium` / `heavy` 三档 workload 的 snapshot metadata / restart / 多点 query 连续性。
- `external_http` ANN connector baseline 现在也具备了 Jest 集成测试之外、可重复执行的主机级运行时证明：轻载验证会让 `dist` runtime 与 packaged sidecar 两条路径持续保持 ingest -> query-backend diagnostics -> restart -> query 连续性，而 workload matrix 验证则会在同样两条路径上证明 `smoke` / `medium` / `heavy` 三档 workload 的 sync/select telemetry 与 aligned representation metadata。
- Tauri strict 证据链在实现层面已经闭环，但仍受宿主依赖约束：
  - 当前 Windows 宿主已经证明 non-strict tauri/runtime 行为与 load-flow parity，
  - Linux strict 证据命令（`verify:agent-workspace:tauri:rust:strict`、`verify:agent-workspace:tauri:window-evidence:strict` 及 strict evidence index/manifest）仍要求宿主预装 `webkit2gtk-4.1`、`javascriptcoregtk-4.1`、`libsoup-3.0`。
- 当前 Windows 宿主的 sidecar/bootstrap 就绪度已达到 `offline-ready`；剩余 bootstrap 工作属于 strict no-LFS 前的策略加固，而不是当前主机可用性阻塞。
- 对 Phase 边界的实际含义：Phase 2 的实现门禁已足以允许 Phase 3 并行启动；剩余 Phase 2 项主要是运维/发布前置条件。

运行约束：

- 实时服务页面来自 `dist/src/frontend`，因此 `src/frontend/*` 的修改只有在执行一次新的 `npm run build` 之后才会进入真实运行时验证。
- 现在已有专用 smoke 命令 `npm run verify:agent-workspace:runtime`，它会把当前前端复制到临时运行目录，启动真实 sidecar/server，并校验服务端实际提供的根页面与 locale 资源是否包含 agent workspace 壳层。
- 现在也已有浏览器驱动的 smoke 命令 `npm run verify:agent-workspace:browser`，它会先通过真实 ingest API 预热最小知识文档，并写入最小 `data.js` 以启动真实 graph/path runtime，再在真实 Chromium 会话中打开页面，驱动 agent workspace 的对话与动作流，命中真实 `conversation/path/query-compare/quality/session/runbook` 后端切片，验证本地化动作/消息重渲（含 runbook checks/action-queue 卡片），检查 graph focus promotion 的进入/退出状态，并输出 screenshot / console / network-summary 证据路径以便排查失败。
- 现在新增 Rust 侧 tauri 契约命令 `npm run verify:agent-workspace:tauri:rust`：在系统具备依赖时执行 `pathmode_window_toggle_plan` / `pathmode_window_toggled_event_payload` cargo 用例；本地非严格模式若缺 `webkit2gtk-4.1`、`javascriptcoregtk-4.1` 或 `libsoup-3.0` 会输出 `SKIP`，CI/严格模式会直接失败。
- 现在新增真实 app/window 证据命令 `npm run verify:agent-workspace:tauri:window-evidence`：尝试执行窗口生命周期证据用例并输出结构化报告/日志；若宿主缺依赖则在非严格模式下输出 `degraded` 与原因，严格模式会硬失败。
- 现在新增 strict 证据索引命令 `npm run verify:agent-workspace:tauri:evidence:index`：会对 rust/window/smoke 证据报告生成统一 latest index，并按 `schemas/agent-workspace-tauri-evidence-index.schema.json` 做结构校验；strict 模式下若关键证据缺失或未通过会直接失败。
- 现在新增 tauri 证据摘要命令 `npm run verify:agent-workspace:tauri:evidence:summary`：会输出 `output/tauri/agent-workspace-evidence-index/evidence-summary-latest.md` 供运维查阅，并可在 CI 工作流中写入 `GITHUB_STEP_SUMMARY`。
- 现在新增 tauri 证据发布片段命令 `npm run verify:agent-workspace:tauri:evidence:release-fragment`：会输出 `output/tauri/agent-workspace-evidence-index/release-fragment-latest.md`，并可附加到 `GITHUB_STEP_SUMMARY` 作为 release-gate 审计上下文。
- 现在新增 tauri 证据清单命令 `npm run verify:agent-workspace:tauri:evidence:manifest`：会输出 `output/tauri/agent-workspace-evidence-index/evidence-manifest-latest.json`，并按 `schemas/agent-workspace-tauri-evidence-manifest.schema.json` 做结构校验，同时产出 required artifact 的 strict-validation 诊断信息。
- 现在新增发布说明同步命令 `npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag <release_tag>`：会把最新 tauri 证据片段通过固定 begin/end marker 幂等写入目标 GitHub Release 正文。

## 阶段快照（2026-04-11）

| 阶段 | 目标 | 当前状态 | 证据 |
|---|---|---|---|
| Phase 1 | 知识解析 + 图谱底座 + staleness 治理 | 已完成 | `src/learning/KnowledgeLearningPlatform.ts`、`src/learning/store.ts`、`src/learning/queryBackend.ts` |
| Phase 2 | 掌握闭环 + 发散引擎 | 进行中 | `src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/path_app.js` |
| Phase 3 | 可插拔导师 + 记忆操作层 | 进行中 | `src/learning/tutorAdapter.ts`、`src/learning/runtimeCapability.ts`、`src/server.ts` |

## 分层实现矩阵

| 层级 | 目标 | 已落地基线 | 剩余工作 |
|---|---|---|---|
| L0 表示层 | 将文档解析为原子与证据 | 原子、证据、source hash 与 staleness 重建链路已实现（`ingestKnowledge`、staleness APIs） | 增强公式/代码归一化与解析遥测粒度 |
| L1 结构层 | 构建关系 + 时序图 | `RelationEdge` 的 `provenance` 与 `TemporalEdge` 有效期机制已实现 | 提升关系质量评分与跨文档冲突处理 |
| L2 检索层 | 证据优先、可解释检索 | `local_hybrid` / `keyword_only` / `local_vector` 已实现，并回传检索模式权重；`local_vector` 已落地 ANN 风格预筛选基线（`ann_prefilter`）且可自动回退全量扫描，并具备 live sync-backed `external_http` 加速路径；默认 graph store 基线现已是 embedded `graphdb/sqlite` 且具备重启耐久性证明 | 继续把剩余底座缺口写实：graphdb 仍需 packaged/runtime + 更重工作负载级加固，ANN 仍需补齐 rollout 阈值与更大工作负载验证 |
| L3 学习层 | 掌握诊断 + 动作编排 | 掌握诊断、误区汇总、双路径推荐、会话执行流水线，以及 live 的 quality/session-plan trend 运行面均已实现 | 在发布级 graphdb/ANN 基线上校准这些已接通的学习效果指标，再谈 Phase-2 硬门禁 |
| L4 交互层 | 工作台统一操作与诊断 | Learning Workbench 已接入会话、质量、runbook、trace 诊断，已支持可配置整改回放控制（`replayMode`、`replayLimit`、`dryRun`、`replaySelectionPolicy`、`replayMinRiskRatioPct`）与调度编排控制（`enabled`、`intervalMinutes`、`triggerPolicy`、阈值）并持久化工作台偏好。当前分支还已落入第一版 host-owned agent workspace shell、停靠式 conversation action、现有 path runtime 的 learning-path-pane 嵌入挂载、graph workspace 级 focus fullscreen promotion、双语壳层覆盖、真实 backend + 真实 graph/path runtime 的 browser smoke 与证据产物、首条真实 app/window handle 生命周期证据路径、`migration-gates` 中的 CI strict 桌面证据常态化作业、`release-desktop-multi-os` 中 Linux 路径 strict 证据门禁、`/api/knowledge/conversation` 上 accept 协商的 SSE 回合流基线、可重放的 turnId 幂等恢复语义、可观测的 turn 缓存诊断与可调参数（`/api/knowledge/conversation/turn-cache/diagnostics` + TTL/容量 env 调参）、阈值化告警治理（汇总状态 + 策略检查 + 阈值画像）、以及告警趋势/历史与升级治理（`/api/knowledge/conversation/turn-cache/diagnostics/trend` + 采样/窗口/streak 策略可调），并已补齐显式 index/export operator 能力动作（`inspect_conversation_turn_cache_alert_trend_index` / `inspect_conversation_turn_cache_alert_trend_export`）、replay-schedule 建议遥测（`telemetry.recommendations`）、策略模板遥测（`telemetry.policyTemplates`）、配置期模板套用（`policyTemplate`）、自动执行安全门禁与诊断（`config.autoExecution`、`telemetry.autoExecution`、parity/blocker 决策语义）以及建议/模板驱动状态文案；并已具备可执行 conversation contract：覆盖 `focus`、`learning path`、tutor 侧 `generate_quiz` / `recap` / `generate_transfer` / `generate_counterexample` / `follow_up`、query 侧 `compare_query_backends` / `inspect_query_backend_diagnostics` / `inspect_query_backend_comparison_history` / `inspect_query_backend_comparison_trend`、导师诊断侧 `inspect_tutor_adapter_telemetry` / `inspect_tutor_trace_diagnostics`、质量/会话诊断侧 `inspect_learning_quality_trend` / `inspect_learning_quality_history` / `inspect_session_plan_quality_trend` / `inspect_session_plan_quality_history`、session 侧 `inspect_session_history` / `build_study_session`、对话记忆召回 `inspect_conversation_memory`、以及 turn-cache operator 诊断 `inspect_conversation_turn_cache_diagnostics` / `inspect_conversation_turn_cache_alert_trend`，同时已具备结构化 `conversation_turn_cache_diagnostics_card` / `conversation_turn_cache_alert_trend_card` / `query_backend_comparison_card` / `query_backend_diagnostics_card` / `query_backend_comparison_history_card` / `query_backend_comparison_trend_card` / `tutor_adapter_telemetry_card` / `tutor_trace_diagnostics_card` / `learning_quality_trend_card` / `learning_quality_history_card` / `session_plan_quality_trend_card` / `session_plan_quality_history_card` / `session_history_card` / `study_session_card` / `tutor_action_card` / `assistant_message` 结果呈现。该交互契约已完成 typed-only 收敛（统一使用 `capabilities`），legacy `availableActions` fallback 已从后端与前端主路径移除。 | 持续维持 strict 证据工件治理健康度，但不要把这批 observability/card 能力误写成“发布级闭环”，只因为它们的后端已不再是 placeholder |
| L5 治理层 | 运行时检查、趋势门禁、整改闭环 | runtime capability matrix + runbook + remediation event 已实现，包含 `query_backend_runtime_health`、`query_vector_index_*`、`store_graphdb_connector_health` 与 `query_vector_acceleration_mode`/`query_vector_acceleration_index_sync_health`/`query_vector_acceleration_health`/`query_vector_acceleration_prefilter_effectiveness`/`query_vector_acceleration_traceability`/`query_vector_acceleration_circuit_state` 检查；其中 circuit-state 已升级为阈值驱动（短路计数/比例、连续失败、半开探测成功率），prefilter-effectiveness 则用于识别代表性流量下 ANN 长期回退 `full_scan` 的失效场景，且前端 verify/checks 卡片现已直接暴露 sync/circuit/traceability/prefilter 摘要 | 强化阈值校准与故障回放自动化，并把治理升级严格绑定到发布级 graph/ANN 基线之上 |

## 架构重构状态（2026-05-05，最终）

基于基线的 12 阶段重构（A→L）已完成。以下模块已交付：

### 新增模块清单

| 模块 | 文件数 | 用途 |
|---|---|---|
| `src/routes/` | 10 | 模块化 API 路由处理器（65 条路由） |
| `src/middleware/` | 5 | HTTP 中间件（cors, auth, body-parser, request-trace） |
| `src/learning/domains/` | 8 | 领域类（7 类 + 7 Platform 接口） |
| `src/frontend/*.mjs` | 4 | ES module 版 i18n, runtime_bridge, main, worker bridge |
| `src/utils/platform.ts` | 1 | 跨平台检测（Linux XDG / macOS Library / Windows LOCALAPPDATA） |
| `src-tauri/tauri.{linux,macos,windows}.conf.json` | 3 | 平台专属 Tauri 配置 |
| `vite.config.ts` | 1 | Vite 5 入口多页面构建（4 chunks） |
| `docs/solutions/` | 2 | 跨平台优化方案 + 实施差距分析 |
| `docs/archive/` | 3 | 已归档 TODO.md（448KB） |

### 重构指标

| 指标 | 之前 | 之后 |
|---|---|---|
| 路由模块 | 0（内联 if/else 链） | 10 模块, 65 路由 |
| 中间件 | 0（内联函数） | 5 独立模块 |
| 领域类 | 1（13,370 行单体） | 7 类 + 7 Platform 接口 |
| 前端模块系统 | `<script>` 标签链 | ES modules + Vite 4-chunk |
| 平台配置 | 1 通用 + 1 Android | 5 配置 |
| Godot 渲染器 | GL Compatibility | Forward+ (Vulkan) + Wayland fallback |
| 移动端 | Capacitor + Tauri | Tauri Android（Capacitor 废弃） |
| 双语文档对 | 21 | 24 |
| CI jobs | 16 | 18 |
| 路由合约测试 | 0 | 8/8 通过 |

### 领域类实现状态

| 领域类 | 自有逻辑 | 生产使用 |
|---|---|---|
| `KnowledgeIngestor` | 4 领域门禁、延迟追踪、过期缓存、护栏通过率、8 诊断 | ✅ `POST /api/knowledge/ingest` |
| `KnowledgeQuerier` | 查询验证（空值/长度/上限）、_domain 遥测、缓存(TTL+修剪)、延迟P95、10 诊断 | ✅ `POST /api/knowledge/query` |
| `ConversationManager` | 查询+记忆验证、Turn 计数、响应延迟、记忆操作、6 诊断 | ✅ (已实例化) |
| `MasteryEngine` | 路径验证、_domain 增强(pathLength/duration)、会话指标、6 诊断 | ✅ (已实例化) |
| `QualityEvaluator` | 用户验证、通过率追踪(200窗口)、快照指标、5 诊断 | ✅ (已实例化) |
| `TutorRouter` | 用户ID+动作种类验证、动作分布、执行元数据、4 诊断 | ✅ (已实例化) |
| `MemoryPolicyManager` | 用户ID+层级验证、策略层级分布、_domain 增强、5 诊断 | ✅ (已实例化) |

**全部 7/7 领域类完成方法体迁移。**

### 重构指标

| 指标 | 之前 | 之后 |
|---|---|---|
| 路由模块 | 0（内联 if/else 链） | 10 模块, 73 路由 |
| 中间件 | 0（内联函数） | 5 独立模块 |
| 领域类 | 1（3,894 行单体） | 7 类 + 7 Platform 接口 (7/7 方法体迁移) |
| 前端模块系统 | `<script>` 标签链 | 7 ES modules + Vite 6-chunk (430ms) |
| 平台配置 | 1 通用 + 1 Android | 5 配置 |
| Godot 渲染器 | GL Compatibility | Forward+ (Vulkan) + Wayland fallback |
| 移动端 | Capacitor + Tauri | Tauri Android（Capacitor 废弃） |
| 双语文档对 | 21 | 24 |
| CI jobs | 16 | 19 |
| 路由合约测试 | 0 | 10/10 通过 |
| 运行时可观测性 | 无路由迁移指标 | registryHitRate + migrationProgress + 7 领域面板 |
| 路由迁移覆盖率 | 0% | 91.3% (73 modular + 7 terminal inline) |
| 内联链复杂度 | 单体 if/else 链 | 清晰分段 + [REGISTRY_COVERED] 标注 |
| 领域类方法体 | 0（全在单体中） | 7/7 完成 (validate → delegate → augment → diagnostics) |
| Vite 构建时间 | N/A | 430ms |
| Path-mode chunk 大小 | N/A | 93KB |

## 核心 API 与运行时基线

## 契约层

- API 接口：`src/learning/api.ts`
- 核心类型：`src/learning/types.ts`
- 对外导出边界：`src/learning/index.ts`
- 契约覆盖：`src/knowledge.api.contract.test.ts`

## 服务端层

- `/api/knowledge/*` 在 `src/server.ts` 中已完成 alias 兼容与统一归一化。
- 运行时诊断入口：`GET /api/runtime-request-trace`。
- Runbook 端点：
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook/verify`
  - `GET /api/knowledge/runtime-capability-runbook/history*`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event/replay`

## 存储与状态层

- `src/learning/store.ts` 已支持：
  - `file`
  - `memory`
  - `graphdb`（现已支持 embedded SQLite、file、HTTP adapter 路径）
- 当前结构上限：新的默认 graphdb 路径已经是 embedded SQLite 并保留显式 fallback，但在宣布其达到生产闭环之前，仍需补齐 packaged/runtime 证明与工作负载级加固。

## 检索层

- `src/learning/queryBackend.ts` 已实现：
  - `local_hybrid`：关键词 + 语义 token 相似度 + 关系度 + 时序过滤
  - `keyword_only`：关键词主导 + 时序过滤
  - `local_vector`：本地向量相似度（TF-IDF 近似）+ 语义重叠 + 图关系加权，已支持本地索引快照（`knowledge_query_vector_index.v1.json`）、ingest 触发失效、按原子签名惰性刷新，并落地 token/signature 的 ANN 风格预筛选（`ann_prefilter`）+ 自动全量回退，且支持加速适配器边界（默认 local，可切 `external_stub` / `external_http`）
- 当前结构上限：
  - 当前外部适配器实现仍为边界与治理链路脚手架（含 `external_http` 超时/重试/熔断基线），尚非生产级外部 ANN 引擎接入，
  - 大规模语料仍需接入真实外部向量/ANN 引擎并完成阈值化压测校准。
- 治理覆盖：
  - 运行时检查已区分后端可用性、向量索引就绪状态与持久化模式。
  - 向量加速 circuit 治理已按 warn/fail 阈值评估短路计数/比例、连续失败次数与半开探测成功率。
  - ANN 预筛选有效性治理已接入 `lastSelectionMode` + `lastCandidateCount` 指标，并在连接器稳定且流量具代表性时，对长期 `full_scan` 回退触发 fail。
  - ANN 预筛选有效性门禁已支持运行时阈值调参（最小样本 + 候选比例 warn/fail 预算），可按语料规模分阶段校准 rollout。
  - runbook action queue 已在同一优先级档位内加入 prefilter 风险并列打破规则：当 `query_vector_acceleration_prefilter_effectiveness` 为 `warn|fail` 时，相关整改动作会被提前上浮。
  - 已新增整改事件回放自动化端点 `POST /api/knowledge/runtime-capability-runbook/remediation-event/replay`，可从 remediation history 抽取风险检查并触发新一轮 verify 回放。
  - 服务端集成测试已覆盖 external_http 熔断开路场景在 `/api/knowledge/query-backend-diagnostics`、`/api/knowledge/runtime-capability-matrix` 与 runbook verify 端点的贯通回传。

## 工作台层

- 前端编排与诊断入口：`src/frontend/path_app.js`。
- 关键可观测能力已接入：
  - runtime runbook 看板
  - request trace 过滤
  - query backend 诊断与配置
  - 工作台整改回放控制（`risk_only|all` + 1-24 回放上限）及本地偏好持久化
  - 工作台新增整改回放调度编排控制（启用/间隔/触发策略/阈值），并接入后端调度快照与手动 tick
  - runtime summary 中向量加速治理可观测（`queryVectorAcceleration(...)` 同时展示实时计数、circuit 的 warn/fail 阈值元组，以及基于 matrix 信号的 prefilter 预算快照）
  - runbook `history/checks` 已在 summary 与 per-check 两级补充 `queryVectorAccelerationPrefilter` 结构化快照，便于按阈值预算做 ANN 预筛选故障分诊
  - runbook 区域新增向量加速治理钻取面板（`query_vector_acceleration_circuit_state` 的状态/阈值/预算标志/动作清单结构化展示，`query_vector_acceleration_index_sync_health` 的远端 ANN sync-health 视图，`query_vector_acceleration_prefilter_effectiveness` 的预筛选选择模式/候选规模/阈值预算/整改动作展示，并补充 `query_vector_acceleration_traceability` 的关联字段覆盖率与整改动作视图）；同时 server 侧 history/action-queue 也已将该 sync-health gate 视为一等事故对象
  - path strategy 遥测与 session history 分析

## 实践 Runbook（工程流程）

## 1）先做契约校验

```bash
npm test -- src/knowledge.api.contract.test.ts --runInBand
```

## 2）文档治理与页面稳定校验

```bash
npm run docs:diataxis:check
npm run docs:site:build
npm run docs:site:serve
```

## 3）运行时路由与诊断链路自检

- Runbook 读取检查：
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook/verify?limit=20`
- Trace 关联检查：
  - `GET /api/runtime-request-trace`
  - `GET /api/runtime-request-trace?requestId=<exact_request_id>`
- turn-cache operator 诊断与趋势治理检查：
  - `GET /api/knowledge/conversation/turn-cache/diagnostics`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend?limit=20&windowSize=6&minSamples=3`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/index?limit=20`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/export?limit=50`
- 拷贝后前端 runtime shell 检查：

```bash
npm run verify:agent-workspace:runtime
```

- 浏览器渲染 shell 与交互闭环检查：

```bash
npm run verify:agent-workspace:browser
```

- 桌面生命周期代理烟测（runtime + tauri 配置 + source lifecycle 契约 + promotion 生命周期用例）：

```bash
npm run verify:agent-workspace:tauri
```

- Rust 侧 tauri 生命周期契约校验（`pathmode_window_toggle_plan*`，CI 建议 strict）：

```bash
npm run verify:agent-workspace:tauri:rust
npm run verify:agent-workspace:tauri:rust:strict
```

- app/window 生命周期证据链校验（本地可降级 + 严格模式）：

```bash
npm run verify:agent-workspace:tauri:window-evidence
npm run verify:agent-workspace:tauri:window-evidence:strict
```

- strict 证据索引（本地 + CI 严格模式）：

```bash
npm run verify:agent-workspace:tauri:evidence:index
npm run verify:agent-workspace:tauri:evidence:index:strict
npm run verify:agent-workspace:tauri:evidence:summary
npm run verify:agent-workspace:tauri:evidence:release-fragment
npm run verify:agent-workspace:tauri:evidence:manifest
npm run verify:agent-workspace:tauri:evidence:manifest:strict
npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag <release_tag>
```

## 4）检索策略自检

- 同查询对比后端并检查可解释性差距：
  - `POST /api/knowledge/query/compare-backends`
- 查看近期对比历史：
  - `GET /api/knowledge/query/compare-backends/history?limit=8`
- 查看趋势窗口：
  - `GET /api/knowledge/query/compare-backends/trend`

## 5）会话策略质量自检

- 检查策略来源与学习结果一致性：
  - `GET /api/knowledge/session/history?pathStrategySelectionSource=strategy_trend&sinceMinutes=10080`
  - `GET /api/knowledge/quality/trend`
  - `GET /api/knowledge/session/plan/quality/trend`

## 后续推进优先级

1. 先补齐 agent-workspace 合同套件的 CI 常态覆盖缺口：在保留 tauri strict 证据作业的同时，把 `src/agent_workspace.contract.parity.test.ts`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.tauri.contract.test.ts` 作为主线阻断门禁。
2. 把 embedded `graphdb/sqlite` 基线从“已证明重启耐久性”推进到 packaged/runtime + 更重工作负载闭环，同时保持 fail-open/fail-closed rollout 语义不破坏；release 报告生成后使用 `verify:foundation:release-evidence` 确认主机证据仍然新鲜。
3. 完成 ANN 的发布级闭环：让新的 sync-backed `external_http` 路径在真实流量下持续稳定，并收紧工作负载/阈值校准。
4. 下一阶段再把当前已接通的 Phase-2 诊断面升级为发布级门禁，但前提是 graphdb/ANN 基线已经达到发布级。
5. 增补跨重启场景下 turn-cache 趋势持久化 index/export 一致性的 CI 验证。
6. 持续加强 strict 证据工件治理（归档、可索引、可导出）以支持运维审计；i18n 长尾结构化卡片重渲继续保留为次优先级，除非其直接解除合同/底座风险。

## 跨平台架构优化（2026-05-02）

已完成跨平台兼容性全面审计与代码架构健康度评估。核心发现与统一修复方案见：

- [跨平台架构优化方案](../../../solutions/cross-platform-architecture-refinement-2026-05-02.md)

方案识别出 6 个阻塞级跨平台问题（Linux asset://localhost 403、Windows sidecar 缺失、macOS arm64 强制签名、Wayland + Godot GL 崩溃、WebKitGTK 依赖文档缺失、CI 矩阵缺 macOS）和 3 个巨型单体文件（server.ts 16,848 行、path_app.js 15,140 行、KnowledgeLearningPlatform.ts 13,370 行），共同构成当前最高优先级的技术债务。修复工作分为三个阶段，与 M10 底座强化流对齐。

**核心洞察**：代码单体与平台脆弱性存在因果关联——拆分 server.ts 可使平台相关路由独立维护；抽取 platform.ts 可消除当前“所有 Unix 系统共用一条 `process.platform === 'win32'` 判断”的隐患。

## 关联文档

- [知识彻底掌握演进路线图](./knowledge-mastery-evolution-roadmap.md)
- [Agent 对话与 Focus Mode 主线交付方案](./agent-conversation-focus-mode-plan.md)
- [接口与运行时契约](../reference/interfaces-and-runtime.md)
- [学习平台契约与工作台基线](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Agent Workspace 合同收敛与下一阶段方向要求（2026-04-14）](../../../brainstorms/2026-04-14-agent-workspace-contract-closure-next-direction-requirements.md)
- [演进进度对齐需求](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

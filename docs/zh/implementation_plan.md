
# 2026-05-12 v1.7.0 - HEAD 现实对齐实施计划

## 中文文档

### 2026-06-17 Agent Knowledge DAG 实施计划

#### 目标

将已澄清的 DAG 要求转成可执行顺序：使用现有 learning graph 作为 answer-planning substrate，同时保持公开回答聚焦与运行时兼容。

#### 当前代码真相

- 当前图底座是项目内部已有结构：`KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、evidence spans、store ops 与 `findPath`。
- 当前切片已经有一等 graph-conditioned context assembler：`src/learning/graphContextAssembler.ts` 会在回答合成前选择 anchor、重排 support node、保留显式 `connectionPaths`，并补有界 predecessor/successor window 与 graph diagnostics。
- 当前持久化会在自动保存重建 snapshot 时保留仍然有效的 store 侧 relation/temporal edges，避免 read-side query/conversation 流程在装配 `connectionPaths` 前丢掉外部增强 DAG 结构。
- 当前 retrieval 路径已经使用有界 graph-aware ranking signal，而不再主要依赖 relation degree；剩余工作转为更广的真实回归校准。
- retrieval 侧的 graph intent detection 现在已经补齐中文 compare/how-to/explain 标记，并对 direct compare branch 相对 reference-only note 做了显式结构性加权。
- `graph_comparison_branch` 质量门禁现在已经对假阳性做了校准：compare intent 不会再仅凭 reference-only support 就通过，而必须出现 contrast/analogy 或多分支结构。
- 当前运维可见诊断已经有三个具体面：右侧 graph-focus 的路径回退诊断、durable `knowledge_run` 卡片中的 graph context / graph diagnostics 检查面，以及 knowledge-run history/compare 流程中的紧凑 graph telemetry。
- prompt-framework 研究应指导 contract 与 evaluation，不应把 Python framework 拉入 app runtime。

#### 下一步执行顺序

1. 保持新的 assembler surface additive，并继续保证向前兼容。
2. 保持 graph-aware ranking 有界，并用回归用例持续校准，避免回到 degree-driven hub 排序。
3. 在 `knowledge_run` history/compare telemetry 已通过 `runtime.knowledgeRunReports` 进入 export 之后，继续决定 graph-focus render diagnostics 是否也要提升到 replay/export-oriented surface。
4. 将 graph/debug/evidence 细节留在 evidence/export surface，而不是公开回答区。
5. 继续校准新的图专项回答质量门禁，并补更多回归证据与运维证据。
6. 只有当新模块拥有真实决策或不变量时，才继续做 owner reduction。

#### 验收标准

1. `assistantMessage` 与现有 conversation client 仍然有效。
2. graph ops 失败时能带 diagnostics 回退到当前 retrieval-grounded behavior。
3. 右侧文件命中继续保留 source markdown 与 matched-span highlight 行为。
4. 不向 Tauri/Node runtime 引入新的宽 prompt-framework 依赖。

### 2026-06-10 知识工作区与 DAG 实施计划

#### 目标

在现有主线对齐计划基础上，补充一层专门面向知识工作区与现有 DAG 学习底座的代码现实判断。

#### 当前代码真相

- 当前分支已经具备结构化 grounded conversation、按文档聚合的 knowledge point、durable `flashcard_batch` / `knowledge_run` artifact，以及 workflow-artifact review follow-up。
- 当前 DAG 学习底座已经在代码中落地：`KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、path query 与 prerequisite 驱动学习流都已存在。
- 先前最主要缺层 retrieval 与 answer synthesis 之间的 graph-conditioned context assembly，现已落地为 `src/learning/graphContextAssembler.ts`。
- 主回答区收缩切片已经在 composer/frontend 边界落地；剩余产品面缺口主要是 right-pane-first 知识阅读与 durable evidence review。

#### 下一步执行顺序

1. 让新的 2026-06-10 知识工作区 / DAG 对齐文档持续同步到所有活跃入口文档。
2. 保持已收缩的用户可见回答契约，同时把 supporting graph/evidence data 路由到次级表面。
3. 让左侧 knowledge hit 收敛为 right-pane-first 阅读模型。
4. 把 `knowledge_run` 与 `flashcard_batch` 视为第一批 durable evidence surface。
5. 在新的 assembler + graph-aware ranking 边界之上继续扩展右侧 / 运维诊断，并校准图专项质量门禁。
6. 继续缩减主要 server 与 frontend host 文件的所有权压力。

### 2026-06-06 主线架构对齐实施计划

#### 目标

将当前代码 / 方案评估落入活跃实施计划，同时保持仓库位于 `main` 并保持向前兼容。初始对齐切片仅更新文档；后续 P1 证据切片可以调整 release verifier tooling，但不得改变公开运行时 API。

#### 当前代码真相

- Scoped retrieval 已有代码支撑：`KnowledgeQueryRequest.scope`、`KnowledgeCorpusScope`、workspace readiness、miss diagnostics、active-target hydration 与 workspace/export substrate 已存在。
- Grounded conversation 已进入 operational 状态：`AgentConversationResponse` 携带 `answer`、citation、memory action、trace 和可选 `assistantBlocks`；legacy `assistantMessage` 仍有效。
- Program A-F 底座已在 `src/resources/`、`src/indexing/`、`src/workspace/`、`src/session/`、`src/workflows/`、`src/memory/`、`src/export/` 中实现。
- 平台 / 导出边界已通过 `PlatformCapabilities`、`RenderMaterializer`、render routes 与 deterministic workspace export bundle 显式化。
- graphdb/sqlite 与 ANN/external connector 目前是 operational baseline；生产闭环仍需要 soak、多轮主机证据、工作负载阈值、recall/latency 校准与 strict rollout 证明。
- 架构缩减仍落后于目标：`src/server.ts` 与 `src/learning/KnowledgeLearningPlatform.ts` 仍是最主要的实现重心。

#### 从当前 `main` 出发的执行顺序

1. **P0：文档真相同步**
   - 保持 2026-06-06 solution note、development progress dashboard、task、TODO、README、interface docs 使用同一口径。
   - 没有发布级证据时，不把 operational-baseline 表述改写为 production-closed。
2. **P1：release-grade graphdb/ANN 闭环**
   - 将 sqlite soak verifier 推进为多轮证据。
   - 收紧 graphdb connector health/budget 阈值。
   - 完成 ANN recall/latency 校准后，再把 Phase-2 diagnostics 升级为发布门禁。
3. **P2：`server.ts` 所有权缩减**
   - 将 turn-cache、alert-trend、runbook bridge、rollout-profile、connector helper 等逻辑迁入明确模块。
   - 在迁移所有权时保留 endpoint 名称与响应兼容性。
   - `src/routes/runtimeRunbookRouteOps.ts` 现在负责 runtime runbook 的 modular-route operation assembly；后续 P2 应继续把 route-layer composition 从 `server.ts` 中剥离出来，但不要给有状态逻辑加只转发的 facade。
   - 对于体量过大的学习运行时 helper，同样适用这一规则：纯数据组装逻辑不应永久内联在 KLP 中，agent conversation reply composition 已经进入可独立模块化的边界。
4. **P3：学习平台领域拆分**
   - 只有当新 owner 能隐藏状态或强制不变量时，才继续拆分 ingest/query/conversation/mastery/quality/tutor/memory 所有权。
   - 避免给 `KnowledgeLearningPlatform.ts` 包一层只转发的 facade。
5. **P4：Agent Workspace 合同加固**
   - 保持 stream-first + sync fallback + replay 兼容。
   - 只通过可选 payload 与 parity-tested capability 扩展 typed `assistantBlocks` 覆盖面。
   - 将 evidence rendering 与 evidence persistence 分开推进：当前 graph-focus pane 已经能在原文中高亮命中段落，但后续仍需要 durable evidence / claim surface，而不是只停留在单轮 snippet 载荷里。
6. **P5：平台 / 导出兼容性**
   - 保持 Godot/mobile PNG-first materialization 与 export profile 语义显式化。
   - 保持核心 retrieval/synthesis 不包含 shell-specific 分支。

#### 验收标准

1. 活跃规划文档都指向同一份 2026-06-06 状态与后续顺序。
2. 当前对齐与 release-evidence 切片不修改任何公开运行时 API。
3. 后续代码工作可以按明确优先级启动：先发布级底座闭环，再所有权缩减，再 richer agent output。
4. 文档提交后工作区保持 clean。

### 2026-06-06 P1 Foundation Release Evidence 新鲜度与历史证据切片

#### 目标

把 sqlite 与 ANN 的 release evidence 路径从“各自产出报告”推进为一个统一的发布侧新鲜度校验入口，并提供更严格的 repeated evidence 审计；该审计命令本身不重新执行重型 runtime 验证，也不把当前 baseline 宣称为 production closure。

#### 已落地代码路径

- 新增 `scripts/verify-foundation-release-evidence.js`。
- 新增 `npm run verify:foundation:release-evidence`。
- 新增 `npm run verify:foundation:release-evidence:strict`，它会用 `--min-report-count 3` 执行同一个校验器。
- 新增 `npm run verify:foundation:release-evidence:multi-host`，它会用 `--min-report-count 3 --min-host-count 2` 执行同一个校验器。
- 新增 `src/foundation.release.evidence.contract.test.ts`，并纳入 `test:migration`。
- 在 `getFoundationReadiness().mandatoryChecks` 中新增 `foundation_release_evidence_freshness`。
- 在 `getFoundationReadiness().mandatoryChecks` 中新增 `foundation_release_evidence_history`，指向 `npm run verify:foundation:release-evidence:strict`，同时保留既有 freshness 门禁。
- 通过 `--min-report-count` 与 `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_REPORT_COUNT` 新增 repeated evidence 的 CLI/env 控制。
- 通过 `--min-host-count` 与 `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_HOST_COUNT` 新增 host-diversity evidence 的 CLI/env 控制。
- 新增对 `foundation-sqlite-runtime-report-*.json` 与 `foundation-ann-runtime-report-*.json` 时间戳历史报告的扫描。

#### 证据契约

默认新鲜度校验器读取：

- `output/verification/foundation-sqlite-runtime/foundation-sqlite-runtime-report-latest.json`
- `output/verification/foundation-ann-runtime/foundation-ann-runtime-report-latest.json`

它会验证：

- 通过 `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MAX_AGE_HOURS` 执行有界新鲜度校验；
- sqlite 必须是 `suiteKind: soak`，包含 heavy profile、`dist_node_runtime`、`packaged_sidecar`、正数 soak cycles、通过的 soak gates 与 query samples；
- ANN 必须是 `suiteKind: matrix`，`releaseGatesEnabled: true`，包含 `smoke` / `medium` / `heavy`、两条 runtime mode、通过的 release gates、query samples，并且 expected recall 不低于报告阈值。

默认命令保持向前兼容：每个组件至少需要 1 份有效且新鲜的 release-contract 报告和 1 个 host key；旧的过期或非 release 历史文件只作为 warning 忽略。严格命令要求每个组件至少有 3 份有效新鲜报告后才会通过。opt-in 多宿主命令还要求每个组件至少覆盖 2 个不同 host key；host key 优先来自报告中的显式宿主标识，缺省时退回 `platform/arch`。

#### 当前证据位置

当前 Windows 宿主已经具备通过的严格 repeated-evidence 审计：

- sqlite release 报告刷新于 `2026-06-06T03:17:45.083Z`；
- ANN release-gate 报告刷新于 `2026-06-06T03:19:22.368Z`；
- `verify:foundation:release-evidence:strict` 于 `2026-06-06T03:21:04.144Z` 校验通过，sqlite 为 `3/3`，ANN 为 `3/3`。

这只关闭当前宿主的 repeated-evidence 门禁。多宿主审计工具现在已经可执行，但当前 Windows 证据仍是单宿主证据。这不关闭多宿主证据、ANN 阈值收敛、connector budget 校准或 production closure。

#### 剩余 P1 推进方向

本切片让 release evidence 更容易审计，也给发布 runbook 增加了严格 repeated evidence 与 opt-in 多宿主门禁。Foundation readiness 现在同时把默认 freshness 审计与严格 history 审计暴露为 mandatory checks。当前 Windows 宿主已满足严格 repeated-evidence 门禁，因此下一步 P1 转向真实多宿主证据收集、ANN 阈值收敛、connector budget 校准，并且只有在 graphdb/ANN baseline 达到发布级之后，才推进 Phase-2 gate promotion。

### 2026-05-27 工作流真相同步与后续主线重对齐

#### 目标

让实施计划重新与 `main` 上的真实状态对齐，重点覆盖三层真相：

- 仓库自有 GitHub workflow 基线其实已经是 `actions/setup-node@v4` + `node-version: "24"`，
- 旧的 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 过渡覆盖变量其实已经从 workflow 中移除，
- 但 `scripts/verify-fixrisk-issues.js` 仍在校验这个已移除的过渡变量，而不是当前基线，因此 `FR-010` 会在“工作流已迁移”的前提下依旧失败。

#### 根因与修正

- 先前期望：
  - FR-010 的闭环仍绑定在过渡期兼容覆盖变量上。
- 当前代码真相：
  - workflow YAML 已经迁移到“不依赖覆盖变量”的 Node 24 基线，
  - 剩余的 Node 20 弃用注解来自 artifact/release helper 这类 marketplace action 运行时，而不是仓库自有 `setup-node` 配置。
- 本轮修正：
  - `scripts/verify-fixrisk-issues.js` 现在显式校验 `actions/setup-node@v4`，
  - 在使用 `setup-node` 的 workflow 中强制 `node-version: "24"`，
  - 同时把“必须存在 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`”改成“必须移除该过时过渡变量”。

#### 从当前 HEAD 出发的下一步执行顺序

1. **P0：持续保持 workflow 真相、verifier 真相、docs 真相一致**
   - 不再让过渡期假设重新进入 CI 门禁，
   - fixrisk 的闭环标准始终绑定仓库可控现实。
2. **P1：release-grade graph/store 加固**
   - 把当前 `graphdb/sqlite` operational baseline 从重启/工作负载证明继续推进到 soak 与性能闭环，
   - 保留独立的主机级 soak 门禁（`verify:foundation:sqlite-runtime:soak`），避免把发布级证据稀释到较轻量的矩阵验证里。
3. **P2：release-grade ANN 校准**
   - 保持 `external_http` connector 在 workload proof 下稳定，再收口 recall/latency 阈值校准。
4. **P3：Tauri-first reply/render surface 扩展**
   - 继续以共享的 Reader-derived runtime 作为 Tauri 基线，
   - 把 `assistantBlocks` 从“legacy answer 的薄包装层”推进为真正的回复组织层，
   - 在不破坏兼容性的前提下继续扩展 typed block 使用面。
5. **P4：tutor routing 与 orchestration 加固**
   - 从已激活的 local-first 路由推进到生产级多 provider 策略。
6. **P5：架构压力缩减**
   - 在保持向前兼容性的前提下，继续压缩 `server.ts`、`KnowledgeLearningPlatform.ts` 和大型前端宿主文件。

### 2026-05-27 Tauri-first Agent Reply Rendering 现实对齐

#### 目标

让当前活跃实施计划重新与代码现实对齐：

- scoped knowledge-workspace grounding 已是真实能力，
- provider / TOML settings 交付已是真实能力，
- Reader 的 markdown / math / mermaid 加固已是真实能力，
- 但 Tauri agent reply area 仍停留在纯文本，因此它已成为当前最直观的未完成交互缺口。

#### 代码 / 方案现实

- 代码中已完成：
  - active-target-aware workspace hydration 与 title-like selective document hydration，
  - conversation trace 中的 workspace readiness 与 miss diagnostics，
  - 面向 `app_config.toml` 的 provider preset / template 流程，
  - conversation turn / resume 头的 CORS 闭环，
  - Reader 侧 Mermaid / KaTeX 加固与 leaked-error suppression，
  - 一等的 Tauri runtime / webview / window debug capture 脚本，
  - 仓库自有 workflow 已迁移到“不依赖过渡覆盖变量”的 Node 24 基线，FR-010 现按 `setup-node@v4` + `node-version: "24"` 的当前真相进行门禁校验。
- 本轮已新落地：
  - Tauri agent workspace 中的 typed reply-rendering model，
  - Reader render substrate 在 agent reply surface 中的共享复用，
  - 面向大型 HTML assistant output 的 artifact-style 隔离路径（sandboxed preview）。
  - assistant 输出现在按 overview / explanation / evidence summary / memory notice / action guidance 分块组织，而不再只是单个 markdown answer 的包装。
  - 这些 section 现在也具备更实在的语义内容：explanation 会锚定最强 scoped knowledge point，evidence summary 会反映真实 scoped citation，next-action guidance 也会吸收 scoped node 与 memory action 的 follow-through 建议。
  - reply composition 现在也具备 query intent awareness：comparison-style 与 how-to-style prompt 不再复用与普通 explanatory prompt 完全相同的 explanation / action phrasing。
  - reply composition 的所有权现在也已明确进入可抽取架构面：`conversationComposer` 模块边界用于降低 `KnowledgeLearningPlatform.ts` 重力井，同时不改变公开响应契约。
  - grouped knowledge point 与 scoped reply section 的组装路径现在已有显式代码 owner：`src/learning/conversationComposer.ts`，因此 `KnowledgeLearningPlatform.ts` 不再需要在同一文件里同时承载 session/runtime state 与 reply-composition 细节。

#### 下一步执行顺序

1. **P0：文档真相同步**
   - 保持 `development-progress-dashboard`、`agent-conversation-focus-mode-plan`、`implementation_plan`、`tauri_tasks` 与当前代码一致，而不再停留在 Program F-only 视角。
2. **P1-P4：当前代码已交付**
   - 在保留 `assistantMessage` 的同时，引入了向前兼容的 `assistantBlocks`，
   - 已从 Reader / runtime 路径抽取可复用的 markdown / math / mermaid 渲染逻辑，
   - 在 agent workspace 中，结构化载荷已由 typed block renderer 替换纯文本挂载，
   - 完整 HTML 输出已进入 sandboxed artifact preview，而不是直接进入主聊天 DOM。
3. **P5：兼容性 + 验证**
   - 保留 legacy fallback，
   - 保持现有 knowledge-point / capability orchestration 稳定，
   - 在渲染升级后补齐 docs / frontend contract / build-runtime 证明。
4. **P6：CI 加固跟进**
   - 持续保持 `Migration Gates` 与 `Fixrisk Operational Readiness` 在 `main` 上为绿，
   - 把未来 workflow / runtime 漂移当作实现面的一部分处理，而不是事后补锅。

#### 验收标准

1. Tauri agent reply area 可以通过共享的 Reader-aligned 渲染链显示 markdown、KaTeX 与 Mermaid。
2. 仅有 `assistantMessage` 的旧路径在迁移期间仍可工作。
3. 现有 `knowledgePoints`、capability execution 与 conversation card 保持向前兼容。
4. 新渲染路径为后续 Godot 降级 / 物化保留明确边界，而不是在当前阶段让 Godot 约束反向主导 Tauri-first UX。

在当前分支已经出现真实 Phase-3 切片、但 Phase-1 / Phase-2 仍存在关键缺口的背景下，把代码真相、活跃进度文档、以及后续执行顺序重新对齐。

### 2026-05-12 到 2026-05-13 本轮实现增量

- 本轮代码已完成：
  - `store.ts` 已新增 embedded SQLite graphdb adapter/provider，`server.ts` 默认 runtime 也已从 `local-file-graphdb` 切到 `graphdb/sqlite`，同时保留显式 file fallback。
  - `KnowledgeLearningPlatform.ts` 已补齐 query-backend comparison/history/trend、staleness diagnostics/rebuild planning、learning-quality history/trend、session-plan quality evaluate/history/trend/runtime-threshold diagnostics、query-backend config、query-backend diagnostics 的真实实现。
  - `queryKnowledge()` 已改为遵循当前配置的 backend，并保留显式 runtime fallback 语义。
  - foundation readiness 与 backend baseline sufficiency 已改为根据真实 store/query/vector 信号判定，而不再是静态占位返回。
  - `server.ts` 现已注入默认激活态本地 `tutorAdapter`，同时保留 `local` + `cloud` adapter catalog。
  - embedded sqlite 生命周期已补齐：server shutdown 会显式关闭 graph store，sqlite adapter 也能在同进程后续运行中安全重开。
  - `src/notemd.server.integration.test.ts` 现已证明 A8 的重启耐久性：覆盖 ingest -> shutdown -> fresh module reload -> store diagnostics/query/readiness 连续性。
  - `scripts/verify-foundation-sqlite-runtime.js` 现已在当前 Windows 宿主上通过 `dist` runtime + packaged sidecar 双路径证明同一条 embedded sqlite 基线：覆盖 ingest -> store diagnostics/foundation readiness -> restart -> query 连续性。
  - `scripts/verify-foundation-sqlite-runtime.js --matrix` 现在也会在同样两条 runtime 路径上把主机级证明扩成 `smoke` / `medium` / `heavy` workload matrix：snapshot metadata、restart 连续性与多点 query 连续性都会持续为绿。
  - `verify:foundation:sqlite-runtime:release` 现在为既有 sqlite soak 门禁提供稳定的 release 命名别名；foundation readiness mandatory checks 也已把 sqlite release proof 与 ANN matrix release proof 同较轻量的 baseline / matrix 命令一起暴露。
  - `local_vector` 的 external HTTP 加速已不再只是查询侧脚手架：适配器现已支持远端索引同步，在 diagnostics 中暴露 sync telemetry，并保留严格的 `fail_closed` 与 representation-alignment 语义。
  - `src/query_backend.external_http.integration.test.ts` 现已证明一条真实的 `external_http` connector 路径：覆盖 ingest -> 远端索引同步 -> query -> diagnostics。
  - `scripts/verify-foundation-ann-runtime.js` 现已在当前 Windows 宿主上通过 `dist` runtime + packaged sidecar 双路径证明同一条 `external_http` connector baseline：覆盖 ingest -> live query-backend diagnostics -> restart -> query 连续性。
  - `scripts/verify-foundation-ann-runtime.js --matrix` 现在也会在同样两条 runtime 路径上把 ANN 主机级证明扩成 `smoke` / `medium` / `heavy` workload matrix：sync/select telemetry、aligned representation metadata 与 restart 连续性都会持续为绿。
  - `scripts/verify-foundation-ann-runtime.js --release-gates` 现在会把结构化 JSON 证据写入 `output/verification/foundation-ann-runtime/`，并对 startup、ingest、diagnostics、query latency 与 targeted-query recall 执行门禁。`npm run verify:foundation:ann-runtime:release` 已在当前 Windows 宿主上通过完整 matrix 发布级门禁路径。
  - runtime capability 治理现在也把 ANN 远端索引同步当成一等检查：matrix/runbook 已新增 `query_vector_acceleration_index_sync_health`，与 health、traceability、prefilter、circuit 同级。
  - `server.ts` 现已把这条新门禁接入完整 runbook 闭环：ANN index-sync health 已进入 verification escalation、remediation action queue、以及 per-check history summary。
  - runtime capability 治理现在也有了显式的 ANN 校准前提门禁：`query_vector_acceleration_calibration_readiness` 会在同一运行时窗口内缺少 sync telemetry、稳定 connector、prefilter 样本就绪、可评估 candidate ratio、或外部 traceability 信号时阻断发布级阈值校准。
  - agent workspace 的 runtime runbook 界面现已在 verify/checks/action-queue 三条链路中展示 ANN sync-health 指标，而且 verify/checks 卡片还进一步前推了 ANN 熔断预算、可追踪性、预筛选摘要以及阈值/信号钻取、校准就绪态和显式门禁 `query_vector_acceleration_calibration_readiness`，运维侧的 ANN 治理视图已不再停留在 `index_sync_health`。
  - `runtime-capability-runbook/*` 这组 modular knowledge route 现已改为接入真实 server 侧 runbook ops，而不再返回 KLP placeholder payload；route 层现在也会保留 `checkId` / `sinceMinutes` / queue-filter 这类 query 参数，不再静默丢弃。
  - 真实浏览器 smoke 门禁现在也会端到端证明这三条链路：严格浏览器证据必须能看到 ANN sync-health verify 卡、新增的 verify/checks ANN 熔断/可追踪性/预筛选钻取、首个检查的 ANN sync 指标，以及 index-sync action-queue 钻取，而不再只是证明卡片“能打开”。
  - agent-workspace 的 locale 加固现在也覆盖了当前真实暴露出来的诊断卡片/消息空间：源码里引用到的 `agentWorkspace.*` key 已由 `src/agent_workspace.locale.contract.test.ts` 做门禁，双语 locale bundle 现已补齐 strict browser smoke 实际触达的 query/quality/runbook 卡片标签，并且启动期 `translate()` 会等 locale 完成初始化后再调用 `window.i18n.t()`，避免在 locale hydrate 前产生误报式 missing-key warning。
- 这会改变执行重心：
  - P3 的“placeholder 替换”在当前 runtime 面上已经完成实现；
  - P4 的“默认 tutor-routing 激活”在本地优先基线上已经完成实现；
  - A8 剩余缺口已经收窄为：主机级 dist/runtime + packaged sidecar 证明已具备，而且 `smoke` / `medium` / `heavy` workload matrix 也已具备，剩下的是 soak、长时段与性能级加固；
  - A9 剩余缺口现在也已收窄：主机级 dist/runtime + packaged sidecar 证明已具备，`smoke` / `medium` / `heavy` workload matrix 也已具备，并且已有 matrix release-gate 证据；剩下的是多轮阈值收敛与多宿主校准；
  - 这个工作之后的下一阶段仍然是发布级 Phase-2 门禁加固，但本轮完成的是“可观测性闭环”而不是“校准闭环”：首个 ANN 门禁族群已经具备 server 侧 runbook/action-queue/history 闭环，`prefilter` 也已进入 ANN 快速升级路径，并在前端 verify/checks 中显式暴露 index-sync、熔断、可追踪性、预筛选治理摘要及阈值/信号上下文和校准就绪态；同时并行继续 A8 的 soak / 长时段 / 性能闭环和 A9 的阈值收敛。

### 代码 vs 方案现状矩阵

| 区域 | 方案期望 | 当前 HEAD 现实 | 状态 |
|---|---|---|---|
| Phase-1 A8 graph backend | 生产级本地图后端 | ops 语义已存在，默认 runtime 已切到 embedded `graphdb/sqlite` 并保留显式 file fallback，重启耐久性已有集成证明，主机级 `dist` runtime + packaged sidecar 证明已自动化，而且 `smoke` / `medium` / `heavy` 主机端 workload matrix 已存在；但 soak、长时段与性能级加固仍未完成 | Operational baseline |
| Phase-1 A9 ANN connector | 生产级 ANN connector | `external_http` 现已支持远端索引同步，并在严格 failure/representation 语义下通过真实端到端 query 证明；主机级 `dist` runtime + packaged sidecar 证明和 `smoke` / `medium` / `heavy` workload matrix 也已具备，但 recall/latency 阈值收敛与发布级校准仍未完成 | Operational baseline |
| Phase-2 quality gates | 真实掌握闭环 / 发散质量门禁 | query-backend comparison、staleness、learning-quality、session-plan-quality 运行面已在 `KnowledgeLearningPlatform.ts` 中接通真实实现；面向运维的 ANN 治理也已通过 runbook verify/checks 显式暴露 index-sync、熔断、可追踪性、预筛选摘要以及阈值/信号钻取和校准就绪态，且 runtime 已具备显式门禁 `query_vector_acceleration_calibration_readiness`；但整套门禁仍需要建立在当前 graph/ANN operational baseline 之上的发布级校准 | Operational baseline |
| Phase-3 tutor + memory | 导师与记忆操作层真实落地 | tutor telemetry / trace-provider trend / conversation memory / memory-policy diagnostics 已真实，且默认 runtime 已注入本地 tutor adapter；生产级多 provider 路由仍待闭环 | Operational baseline |
| 架构缩减 | 主单体下降到可持续体量 | `server.ts` 14,992、`KnowledgeLearningPlatform.ts` 7,706、`path_app.js` 4,649、`app.js` 4,713、`routes/knowledge.ts` 690 | Open |

### 执行顺序

1. P0：真相校正与门禁重分级
   - 先让进度文档与代码现状一致，
   - 不再把 placeholder 返回或 catalog-only wiring 视为“已完成”。
2. P1：真实 graph backend 闭环
   - 保持新的 embedded `graphdb/sqlite` 主机级 `dist` runtime + packaged sidecar 验证持续为绿，
   - 保持新的主机级 workload matrix 验证持续为绿，
   - 保留 fallback，
   - 在已证明的重启生命周期与 workload matrix 之外，继续补齐 soak、长时段耐久性/性能与 adapter / fallback 一致性验证。
3. P2：基于新 live connector baseline 的 ANN 工作负载与 rollout 闭环
   - 让新的 sync-backed `external_http` connector 在真实流量下持续稳定，
   - 保持新的主机级 ANN runtime + workload matrix 验证持续为绿，
   - 校准 recall / latency 阈值并收敛发布级校准，再谈 ANN 层生产闭环。
4. P3：这个工作之后的下一阶段 - Phase-2 quality gate 加固
   - 让新接通的 query/staleness/learning-quality/session-plan-quality 诊断面始终与同一份 runtime 真相对齐，
   - 把当前已前推到 verify/checks 的 ANN index-sync、熔断、可追踪性、预筛选预算从“可见”推进到“可校准”，完成工作负载与阈值闭环，
   - 让 ANN 治理持续覆盖远端 index-sync、health、prefilter、traceability、circuit 这些显式检查面，
   - 只有在 graph/ANN 基线达到发布级而不只是 operational baseline 后，才把它们升级为发布级门禁。
5. P4：Phase-3 tutor routing 加固
   - 保持当前已激活的默认 `tutorAdapter` 可观测，
   - 从 local-first 继续推进到生产级多 provider 路由策略。
6. P5：继续降低架构压力
   - 继续拆 `routes/knowledge.ts`，
   - 持续压缩 `server.ts`、`KnowledgeLearningPlatform.ts`、`path_app.js`、`app.js`。

### 验收标准

1. 默认 graph backend 不再是 `local-file-graphdb`，且 embedded `graphdb/sqlite` 基线已能在 shutdown/restart 后保持 query/store diagnostics 连续性。
2. 至少一条 ANN connector 路径超出脚手架阶段，并在真实 sync/query 流量下得到证明，同时把剩余工作负载/阈值校准显式保留在计划中。
3. `KnowledgeLearningPlatform.ts` 不再对 query compare、staleness、learning-quality、session-plan-quality 返回 placeholder。
4. 默认 runtime tutor 执行在真实 server 路径下能产生非零 adapter telemetry。
5. 每个里程碑后都能通过 `docs:diataxis:check`、`docs:site:build`、`build:with-vite`、严格 `verify:agent-workspace:browser` 证明、以及 targeted agent-workspace / KLP tests。

---

# 2026-03-10 v1.5.38 - 多终端 WASM 等价实施计划（移动端固有瓶颈收口）

### 目标
通过统一的 WASM 计算策略，缓解移动端固有瓶颈，并在桌面 Web、Tauri 桌面、Capacitor 移动端、Tauri Android 多终端之间保持可预测的一致行为。

### 当前移动端固有问题

1. 重图计算/布局计算容易占用主线程，导致交互卡顿。
2. 在稀疏图场景下，Worker 启动与 JS 序列化开销可能高于实际计算收益。
3. 受限设备上内存压力与 GC 抖动更明显，稳定性风险更高。
4. 不同 WebView 运行时能力差异较大，若缺少显式探测会造成行为不确定。

### 多终端统一策略

1. 统一能力契约：
   - 运行时暴露 `supports_mobile_wasm_compute` 与 `mobile_wasm_reason`。
   - 计算路由保留明确的回退原因，保证可诊断性。
2. 统一计算路由模型：
   - 首选：`wasm-adapter`
   - 回退：`worker`
   - 最终回退：`single-thread`
3. 统一工件治理链路：
   - 标准 WASM 工件探针 + 严格门禁脚本 + CI 回归屏障。

### 分阶段执行计划

1. 阶段 A（能力探测与诊断）[基线已完成]：
   - 增加移动端 WASM 就绪探测。
   - 在 runtime caps 中暴露能力与原因。
   - 能力不可用时保持既有行为不变。
2. 阶段 B（路由集成）[进行中]：
   - 将移动端 WASM 能力信号接入本地构建统计。
   - 增加移动构建模式细分标签（`worker-wasm-ready`、`worker-wasm-not-ready`、回退原因）。
   - 保持确定性回退链路。
3. 阶段 C（内核扩展）：
   - 将更多重计算内核迁移到 WASM，并以契约验证正确性。
   - 优先处理当前移动端 CPU 占用最高的图构建热点。
4. 阶段 D（多终端工件落地）：
   - 分别验证以下终端的工件打包与加载路径：
     - 桌面 Web 资源包
     - Tauri 桌面 sidecar/运行时路径
     - Capacitor 移动端资源/运行时路径
     - Tauri Android 运行时路径
5. 阶段 E（性能与稳定性硬门禁）：
   - 对移动端典型负载执行 p95/p99 门禁约束。
   - 强制 worker 与 WASM 输出一致性无回归。

### 验收标准

1. 移动端必须能明确解释 WASM 启用/禁用原因（`mobile_wasm_reason`）。
2. WASM 不可用时移动端构建链路仍可工作（确定性回退已验证）。
3. 每一轮路由调整后，迁移门禁套件保持全绿。
4. 所有计划/TODO/测试报告的中英文文档保持同步更新。

---

### 范围对齐

本次更新将实施计划与当前 Electron 到 Tauri 的迁移策略对齐：

- 以 Tauri 作为桌面主壳层。
- 以 Godot 作为 Path Mode 交互界面。
- 以 Node Sidecar 作为图构建与运行时服务。
- 默认采用 Bridge-first 消息链路（`Godot <-> PathBridge <-> Backend`）。

### 当前迁移周期已完成项

- 已完成 Sidecar 运行路径与前端资源路径的统一，提升桌面运行一致性。
- 已稳定 Worker 路径解析，避免打包 Sidecar 下线程出现 `MODULE_NOT_FOUND`。
- Knowledge Base 文件夹加载已锚定到配置的项目根路径，不再依赖 Electron 专属假设。
- `Path Mode` 关键配置已迁移到 Godot 侧 UI，同时保留浏览器模式下 Web 工具栏行为。

### 仍需收敛的缺口与风险

- 在 Tauri mini GPU 运行中，缓存存在时“复用或重建”提示流程仍需严格回归验证。
- 需要持续防止单次点击触发重复加载（重复 build/restore）。
- WebSocket 客户端生命周期仍需加固，避免启动阶段时序竞争导致早期重复连接/断开。
- Godot 中心节点切换的 History 记录仍需最终行为验收。

### 下一步执行

1. 通过专用回归测试锁定缓存提示与单次执行语义。
2. 完成 websocket 生命周期防护与启动时序收敛。
3. 完成 Electron IPC 替代项的逐任务一致性核验，并移除残余隐式 Electron 依赖。
4. 保持移动端双输出策略：继续保留 Capacitor，同时并行支持 Tauri Android 产物链路。

---

# Implementation Plan - Implementing Lazy Loading for Prerequisites

The goal is to allow users to investigate incomplete In-Degree information by explicitly expanding the context of a specific node, without overloading the view with the entire graph.

## Proposed Changes

### 1. Backend Logic ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

- **Unrestricted Context Expansion**:
  - In [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422), iterate through `forcedExpansionSet`.
  - For each node in the set, retrieve **all** incoming edges ([getIncomingEdges](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#120-128)), regardless of their completion status or relevance to the original path.
  - Add the source nodes of these edges to the `finalPathNodes` list.
  - **Constraint**: Do not recursively fetch parents of these new nodes (Level -1 only).
  - **Flagging**: Mark the expanded target node with `isExpanded: true` in the output.

### 2. Data Bridge ([src/frontend/path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))

- **Pass State Flags**:
  - Ensure the `isExpanded` flag matches the `forcedExpansionSet` state.
  - Pass this flag to the Godot client in the `treeLayout` payload.

### 3. Visualization State Machine ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

### 3. Visualization State Machine ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

- **Smart Toggle Logic (Left Side)**:
  - **Pre-calculation**: At the start of `_draw_layout_mode`, iterate `_layout_edges` to build a `visible_in_counts` dictionary (NodeID -> Count).
  - **Decision Logic (in Node Loop)**:
    - Let `global_in` = `node.inDegree` (from backend).
    - Let `visible_in` = `visible_in_counts[node.id]`.
    - Let `is_expanded` = `node.isExpanded` (flag from backend).
  - **States**:
    1.  **Expanded State**: If `is_expanded` is true:
        - Draw [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) button.
        - Click Action: Emit `node_collapse_prereqs_requested`.
    2.  **Expandable State**: Else if `visible_in < global_in`:
        - Draw [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) button.
        - Click Action: Emit `node_expand_prereqs_requested`.
    3.  **Complete State**: Else (Visible == Global):
        - Draw nothing (or disabled indicator).

### 4. Interaction Logic ([tree_view_panel.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_view_panel.gd) & [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))

- **Collapse Handling**:
  - Implement [collapsePrereqs(nodeId)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254) in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js): Remove ID from `forcedExpansionSet` and trigger update.
  - Wire up the new Godot signal to this backend method.

## UI Inconsistency Fixes

### 1. Statistics Panel Resizing

- **Problem**: The "Incoming" and "Outgoing" lists in the Node Statistics Popup do not resize proportionally when the popup is resized using the drag handle.
- **Fix**: Modify [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css).
  - Change `.stat-lists` from fixed `height: 150px` to `flex: 1; min-height: 150px`.
  - Ensure parent containers (`.popup-content`) allow expansion.

### 2. Edge Visibility

- **Problem**: Edges are visible by default on load, creating clutter.
- **Fix**:
  - in [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css): Set `.link` default `stroke-opacity` to `0`.
  - in [src/frontend/app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js): Ensure [updateVisibility()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1717-1747) is called immediately after graph initialization to enforce the visibility logic (hiding edges unless focused/hovered).

### 3. In-Degree Number Mismatch

- **Problem**: The number displayed next to "In-Degree" (Red) in the popup often differs from the count of items in the "Incoming" list.
- **Verification**: Locate [showNodePopup](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1083-1154) in [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) to see if it uses `node.inDegree` (metadata) vs `node.incoming` (actual edges).
- **Fix**:
  - If the metadata is correct (global truth), keep it.
  - If the list is incomplete (due to filtering/culling), add a label "(Visible: X)" or ensure the list matches filters.
  - _Current hypothesis_: The metadata `inDegree` is the ground truth from the backend, while the client-side `links` array might be filtered or optimized (limit 20000 edges), causing a mismatch. functionality to show "Total" vs "Visible".

### 4. In-Degree Display Setting (Electron)

- **Goal**: Allow user to toggle between showing "Visible Inbound Nodes" (calculated from current graph) or "Total Statistical Inbound" (from backend metadata).
- **Default**: Visible Inbound Nodes.
- **Changes**:
  - **[src/frontend/index.html](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/index.html)**: Add a toggle/select in the Settings Modal (e.g., "Degree Count: Visible | Total").
  - **[src/frontend/app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js)**:
    - Update [showNodePopup](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1083-1154) to check `settingsManager.get('visuals', 'degreeMode')`.
    - If 'visible': Show `inNeighbors.length`.
    - If 'total': Show `node.inDegree` (with [(visible)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) suffix if different? Or just strict switch?). User asked for "whether the inbound count should be shown as the number of nodes or the statistical number". I will implement a strict switch but maybe keep the tooltip or subtle indicator if they differ significantly.
    - Wire up the new setting in [initSettingsUI](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#2644-2880).

- [ ] **Simplify Lazy Loading UI (Godot)**
  - [ ] Update [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd):
    - [ ] Remove separate [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) buttons.
    - [ ] Implement unified `[ Count ]` button (e.g., circle with number).
    - [ ] Button toggles `forcedExpansion` state.
    - [ ] Default state is collapsed (colored/styled to indicate expandable).
  - [ ] Ensure [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) handles the toggle correctly (clear vs add to `forcedExpansionNodes`).

- [ ] **Tree View Visual & Interaction Overhaul**
  - [ ] **Visual Cleanup (Godot)**
    - [ ] Remove [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) and `[Count]` buttons from [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
    - [ ] Remove separate click areas for these buttons.
  - [ ] **Interaction Update (Godot)**
    - [ ] **Double Click**: Change to Toggle Expansion (Emit [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261)).
    - [ ] **Right Click**: Toggle Expansion (Same as Dbl Click).
    - [ ] **Middle Click**: Collapse All (Emit new signal `collapse_all_requested`).
    - [ ] **Long Press**: Implement Navigation (Switch Central).
      - [ ] Add `_process` check for hold duration.
      - [ ] Draw Progress Ring during hold.
      - [ ] Trigger navigation on completion.
  - [ ] **Focus Mode (Godot)**
    - [ ] Add "Focus on this node" checkbox to [settings_panel.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/settings_panel.tscn).
    - [ ] Implement `focus_node_id` state in [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
    - [ ] Update `_draw` to dim nodes/edges not connected to `focus_node_id` when enabled.
  - [x] **Backend Updates**
    - [x] Add [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) handler in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js).

## Data Validation

- [x] **Disable Path Mode if No Data**:
  - [x] Update [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) to check `graphDataExists` or `nodes.length` before entering Path Mode.
  - [x] Show alert if data missing.

## Bug Fixes

- [ ] **Fix Missing Edges in Tree Layout**:
  - [ ] **Cause**: `d3.forceSimulation` in [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) mutates `graphData.links`, replacing ID strings with Node Objects.
  - [ ] **Effect**: `Graph.js` in [path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js) uses these Objects as keys/IDs, breaking adjacency map lookups (which expect strings).
  - [ ] **Fix**: In [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js), sanitize links before sending to worker: `l.source.id || l.source`.

## Verification Plan

1. **Initial State Check**:
   - Navigate to a node with high In-Degree (e.g., "Beta", In-Degree 18).
   - Verify the unified `[ Count ]` button appears on the left if < 18 lines are visible.
2. **Expansion Test**:
   - Click the `[ Count ]` button.
   - Verify the tree rebuilds.
   - Verify previously hidden nodes (e.g., "Fair Value") appear as prerequisites.
   - Verify the `[ Count ]` button changes its state/appearance to indicate expansion.
3. **Collapse Test**:
   - [x] Click [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53).
   - [x] Verify the extra nodes disappear and view returns to original state.

## Bug Fixes

- [x] **Fix Missing Edges in Tree Layout**:
  - [x] **Fix**: In [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js), sanitize links before sending to worker.
- [ ] **Fix Tree View Interactions**:
  - [ ] **Right-Click Toggle**: Ensure `isExpanded` is passed from [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) to visual node.
  - [x] **Collapse All**: Update [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) to relay [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) message. Add UI button.

# Phase 2: Spine & Tributaries Layout (v1.4.2)

## Goal

Implement a stable, tree-like layout where the "Main Learning Path" (Spine) remains linear and stationary, while prerequisites (Tributaries) expand laterally without disrupting the spine.

## Proposed Changes

### 1. Core Algorithm ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

#### [getTreeLayout(centralId, learningPath)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884)

- **Step 1: Identify Spine**:
  - Determine the "Critical Path" from `learningPath.nodes` (using `isCritical` flag or [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) result).
  - Assign `Level` (X-coordinate) to Spine nodes based on distance from Start.
  - Fix Spine `Y` coordinates to `0`.

#### `assignTributaryPositions(spineNodes, allNodes)`

- **Step 2: Slot Management**:
  - Create a `SlotManager` to track occupied [(X, Y)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) positions.
  - Mark key Spine positions as occupied.
- **Step 3: Lateral Expansion**:
  - Iterate through nodes in **Topological Order** (or Spine Order).
  - For each node `N`, identify its unplaced prerequisites `P`.
  - **Placement Logic**:
    - `Target X`: `N.Level - 1` (Standard dependency inflow).
    - `Target Y`: Find nearest available vertical slot relative to `N.Y`.
    - Preference: Alternating Up/Down (`+1, -1, +2, -2...`) \* `Y_SPACING`.
    - **Stability**: Once placed, a node's position is locked (`isPlaced = true`) and will not be moved by subsequent expansions.

### 2. Frontend Integration

- Ensure [switchCentral](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#893-900) triggers a re-layout using the new algorithm.
- Pass the stable layout to `Graph.js` / Godot via [PathBridge](file:///e:/Knowledge_project/NoteConnection_app/dist/src/core/PathBridge.js#5-134).

## Verification Plan

1. **Spine Stability**:
   - Load a path. Center on a Spine node.
   - Expand a prerequisite.
   - Verify the Spine node DOES NOT move.
2. **Lateral Unfolding**:
   - Verify prerequisites appear above/below the spine, not inline.
3. **Complex Chain**:
   - Expand a prerequisite's prerequisite.
   - Verify it flows backwards (Left) and finds a clear slot.

---

# 实施计划 - 实现前置节点懒加载 (Implementation Plan - Implementing Lazy Loading for Prerequisites)

目标是允许用户通过显式扩展特定节点的上下文来调查不完整的入度信息，而无需加载整个图表。

## 建议更改 (Proposed Changes)

### 1. 后端逻辑 ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

- **无限制上下文扩展**:
  - 在 [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) 中，迭代 `forcedExpansionSet`。
  - 对于集合中的每个节点，检索 **所有** 入边 ([getIncomingEdges](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#120-128))，无论其完成状态或与原始路径的相关性如何。
  - 将这些边缘的源节点添加到 `finalPathNodes` 列表中。
  - **约束**: 不要递归获取这些新节点的父节点（仅限 Level -1）。
  - **标记**: 在输出中用 `isExpanded: true` 标记已扩展的目标节点。

### 2. 数据桥接 ([src/frontend/path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))

- **传递状态标志**:
  - 确保 `isExpanded` 标志与 `forcedExpansionSet` 状态匹配。
  - 在 `treeLayout`以此传递此标志给 Godot 客户端。

### 3. 可视化状态机 ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

- **智能切换逻辑 (左侧)**:
  - **预计算**: 在 `_draw_layout_mode` 开始时，迭代 `_layout_edges` 以构建 `visible_in_counts` 字典。
  - **决策逻辑**:
    - `global_in` = `node.inDegree` (来自后端)。
    - `visible_in` = `visible_in_counts[node.id]`.
    - `is_expanded` = `node.isExpanded`.
  - **状态**:
    1.  **已展开**: 如果 `is_expanded` 为真：绘制 [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。点击发射 `node_collapse_prereqs_requested`。
    2.  **可展开**: 否则如果 `visible_in < global_in`：绘制 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。点击发射 `node_expand_prereqs_requested`。
    3.  **完整**: 否则（可见 == 全局）：绘制无（或禁用）。

### 4. 交互逻辑 ([tree_view_panel.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_view_panel.gd) & [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))

- **折叠处理**:
  - 在 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 中实现 [collapsePrereqs(nodeId)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254)：从 `forcedExpansionSet` 中移除 ID 并触发更新。
  - 将新的 Godot 信号连接到此后端方法。

## UI 不一致修复 (UI Inconsistency Fixes)

### 1. 统计面板调整大小

- **修复**: 修改 [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css)，使用 `flex: 1` 确保列表按比例调整大小。

### 2. 边缘可见性

- **修复**: 默认隐藏边缘，仅在悬停/聚焦时显示。

### 3. 入度数字不匹配

- **修复**: 添加设置以切换“可见”与“总计”入度显示。

## 第二阶段：主干与支流布局 (Phase 2: Spine & Tributaries Layout) (v1.4.2)

### 目标

实现稳定的树状布局，其中“主要学习路径”（主干）保持线性和静止，而前置节点（支流）在不破坏主干的情况下横向扩展。

### 建议更改

#### 1. 核心算法 ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

##### [getTreeLayout(centralId, learningPath)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884)

- **步骤 1: 识别主干**:
  - 从 `learningPath.nodes` 确定“关键路径”。
  - 根据与起点的距离为主干节点分配 `Level` (X坐标)。
  - 将主干 `Y` 坐标固定为 `0`。

##### `assignTributaryPositions(spineNodes, allNodes)`

- **步骤 2: 插槽管理**:
  - 创建 `SlotManager` 以跟踪占用的 [(X, Y)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 位置。
  - 标记关键主干位置为已占用。
- **步骤 3: 横向扩展**:
  - 按 **拓扑顺序** 迭代节点。
  - 对于每个节点 `N`，识别其未放置的前置节点 `P`。
  - **放置逻辑**:
    - `Target X`: `N.Level - 1`。
    - `Target Y`: 相对于 `N.Y` 找到最近的可用垂直插槽。
    - 偏好: 交替上/下 (`+1, -1, +2, -2...`) \* `Y_SPACING`。
    - **稳定性**: 节点一旦放置，其位置即被锁定 (`isPlaced = true`)。

### 2. 前端集成

- 确保 [switchCenter](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#893-900) 使用新算法触发重新布局。
- 通过 [PathBridge](file:///e:/Knowledge_project/NoteConnection_app/dist/src/core/PathBridge.js#5-134) 将稳定布局传递给 Godot。

### 验证计划

1. **主干稳定性**: 加载路径，居中主干节点，展开前置节点。验证主干节点 **不移动**。
2. **横向展开**: 验证前置节点出现在主干的上方/下方，而不是内联。
3. **复杂链**: 展开前置的前置，验证其向后（左）流动并找到清晰的插槽。

---

# Phase 3: 9-Rule Tree Layout Engine (v1.4.3)

**Date**: 2026-02-26

## Goal

Port the 9-rule expansion/claiming/visibility engine from `tree_path_mockup.html` into production code (`path_core.js`, `tree_renderer.gd`, `path_app.js`). This replaces the simple contour-based layout with a full ownership/claiming system for intelligent node management.

## Gap Analysis: Mockup vs Production

### Missing Rules

| #   | Rule                                          | Mockup Function                            | Production Status            |
| --- | --------------------------------------------- | ------------------------------------------ | ---------------------------- |
| 1   | **Expansion Order** (FIFO claiming)           | `processExpansions()` + `expansionOrder[]` | ❌ Missing                   |
| 2   | **Preceding Immunity** (effective index)      | `tryClaim()` + `getEffectiveSpineIndex()`  | ❌ Missing                   |
| 3   | **Following Migration** (spine+followers)     | `claimSpineChain()`                        | ❌ Missing                   |
| 4   | **Single Appearance** (owner-based)           | `currentOwner` priority check              | ⚠️ Partial (`placedNodeIds`) |
| 5   | **Cross-Tributary Isolation** (edge filter)   | `drawEdges()` owner check                  | ❌ Missing                   |
| 6   | **Spine Always Visible** (return on collapse) | `determineVisibility()` spine pass         | ❌ Missing                   |
| 7   | **Sticky Claim** (configurable)               | `stickyClaimEnabled` toggle                | ❌ Missing                   |
| 8   | **Unit Migration** (recursive claim)          | `claim()` recursive tributaries            | ❌ Missing                   |
| 9   | **Tributary Hierarchy Immunity**              | `getTributaryRootSpineIndex()`             | ❌ Missing                   |

### Missing Concepts

| Concept                   | Mockup                            | Production                             |
| ------------------------- | --------------------------------- | -------------------------------------- |
| **Node Ownership**        | `currentOwner`, `ownerPriority`   | None                                   |
| **Expansion Order**       | `expansionOrder[]` (ordered)      | `forcedExpansionNodes` (unordered Set) |
| **Effective Spine Index** | `getEffectiveSpineIndex()`        | Fixed `spineIndex` only                |
| **Visibility Chain**      | `isOwnerChainVisible()` recursive | Binary collapsed/expanded              |
| **Hull-Node Avoidance**   | Convex hull with padding          | Basic hull, no collision check         |

### Existing Features to Preserve

- ✅ Spine identification via `isCritical` flag
- ✅ Contour-based collision avoidance for spine spacing
- ✅ Recursive tributary placement
- ✅ Hull/bubble drawing around tributary groups
- ✅ Collapsed/expanded state per node
- ✅ Godot WebSocket bridge communication
- ✅ Tree renderer with bezier edges, styled nodes, pan/zoom

## Proposed Changes (13 Steps)

### Component 1: Core Algorithm

#### [MODIFY] [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js)

**Step 1**: Add expansion order tracking to `getTreeLayout()` (L742-1133)

- Add `expansionOrder` parameter (ordered array of expanded node IDs)
- Replace unordered `collapsedSet` with ordered `expansionOrder` for FIFO claiming

**Step 2**: Implement node ownership system

- Add `currentOwner`, `ownerPriority`, `_isOnSpine` to each layout node
- Track claims during `processExpansions()` matching mockup logic

**Step 3**: Implement `tryClaim()` with all 9 rules

- Rule 1: Owner priority check
- Rule 2: `getEffectiveSpineIndex()` comparison (inherits owner index)
- Rule 3+8: `claimSpineChain()` for following migration
- Rule 4: Single appearance via owner check
- Rule 5: Cross-tributary edge filtering
- Rule 6: Spine always visible on collapse
- Rule 7: Sticky claim toggle
- Rule 9: `getTributaryRootSpineIndex()` for hierarchy immunity

**Step 4**: Implement `determineVisibility()` + `isOwnerChainVisible()`

- Two-pass: spine always visible, non-spine follows recursive owner chain

**Step 5**: Update edge generation — filter edges between different owners (Rule 5)

**Step 6**: Update hull generation to group by owner

### Component 2: Frontend Bridge

#### [MODIFY] [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js)

**Step 7**: Track expansion ORDER (not just Set)

- `forcedExpansionNodes: new Set()` → `expansionOrder: []`
- Update `expandPrereqs()`, `collapsePrereqs()`, `collapseAll()`
- Pass `expansionOrder` to worker

**Step 8**: Add sticky claim setting + pass to worker

### Component 3: Godot Tree Renderer

#### [MODIFY] [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd)

**Step 9**: Edge rendering — skip edges where `src.currentOwner != tgt.currentOwner`

**Step 10**: Hull collision avoidance with rounded padding

**Step 11**: Node type coloring (spine=green, tributary=blue, shared=purple, migrated=orange)

**Step 12**: Expansion indicator badge (in-degree count circle)

### Component 4: Worker Communication

#### [MODIFY] [path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js)

**Step 13**: Pass `expansionOrder` and `stickyClaimEnabled` to `getTreeLayout()`

## Verification Plan

1. Expand Calculus → verify Optimization migrates (Rule 3)
2. Expand Optimization → verify Diff Eq cannot claim Calculus (Rule 2+9)
3. Collapse Calculus → verify spine nodes return (Rule 6)
4. Toggle sticky claim → verify non-spine revert/persist (Rule 7)
5. Check hull boundaries don't overlap nodes

---

# 第三阶段：9 规则树形布局引擎 (v1.4.3)

**日期**: 2026-02-26

## 目标

将 `tree_path_mockup.html` 中的 9 规则展开/认领/可见性引擎移植到生产代码（`path_core.js`、`tree_renderer.gd`、`path_app.js`）中。用完整的所有权/认领系统替换简单的基于轮廓的布局。

## 差距分析：原型 vs 生产代码

### 缺失规则

| #   | 规则                           | 原型函数                                  | 生产代码状态 |
| --- | ------------------------------ | ----------------------------------------- | ------------ |
| 1   | **展开顺序**（FIFO 认领）      | `processExpansions()`                     | ❌ 缺失      |
| 2   | **前置免疫**（有效索引）       | `tryClaim()` + `getEffectiveSpineIndex()` | ❌ 缺失      |
| 3   | **后续迁移**（脊柱+后续）      | `claimSpineChain()`                       | ❌ 缺失      |
| 4   | **单次出现**（基于所有者）     | `currentOwner` 优先级检查                 | ⚠️ 部分存在  |
| 5   | **跨支流隔离**（边过滤）       | `drawEdges()` 所有者检查                  | ❌ 缺失      |
| 6   | **脊柱始终可见**（折叠时返回） | `determineVisibility()`                   | ❌ 缺失      |
| 7   | **粘性认领**（可配置）         | `stickyClaimEnabled` 开关                 | ❌ 缺失      |
| 8   | **单元迁移**（递归认领）       | `claim()` 递归支流                        | ❌ 缺失      |
| 9   | **支流层级免疫**               | `getTributaryRootSpineIndex()`            | ❌ 缺失      |

### 缺失概念

| 概念              | 原型                            | 生产代码                           |
| ----------------- | ------------------------------- | ---------------------------------- |
| **节点所有权**    | `currentOwner`, `ownerPriority` | 无                                 |
| **展开顺序**      | `expansionOrder[]`（有序）      | `forcedExpansionNodes`（无序 Set） |
| **有效脊柱索引**  | `getEffectiveSpineIndex()`      | 固定 `spineIndex`                  |
| **可见性链**      | `isOwnerChainVisible()` 递归    | 二元折叠/展开                      |
| **Hull-节点避让** | 凸包 + 填充                     | 基础 hull，无碰撞检查              |

## 建议更改（13 个步骤）

### 组件 1: 核心算法 — `path_core.js`（步骤 1-6）

- **步骤 1**: 添加展开顺序追踪
- **步骤 2**: 实现节点所有权系统
- **步骤 3**: 实现 `tryClaim()` 包含所有 9 条规则
- **步骤 4**: 实现 `determineVisibility()` + `isOwnerChainVisible()`
- **步骤 5**: 更新边生成 — 基于所有者过滤
- **步骤 6**: 更新 hull 生成 — 按所有者分组

### 组件 2: 前端桥接 — `path_app.js`（步骤 7-8）

- **步骤 7**: 有序展开追踪
- **步骤 8**: 添加粘性认领设置

### 组件 3: Godot 树渲染器 — `tree_renderer.gd`（步骤 9-12）

- **步骤 9**: 跨所有者边过滤
- **步骤 10**: Hull 碰撞避让
- **步骤 11**: 节点类型着色
- **步骤 12**: 展开指示器徽章

### 组件 4: Worker 通信 — `path_worker.js`（步骤 13）

- **步骤 13**: 传递 `expansionOrder` 和 `stickyClaimEnabled`

## 验证计划

1. 展开"微积分" → 验证"优化"迁移（规则3）
2. 展开"优化" → 验证"微分方程"不能认领"微积分"（规则2+9）
3. 折叠"微积分" → 验证脊柱节点返回（规则6）
4. 切换粘性认领 → 验证非脊柱节点还原/保持（规则7）
5. 检查 Hull 边界不与节点重叠

# 解释：开发进度看板

本页是“知识彻底掌握演进方案”的实现侧进度看板。
它用于回答三件事：哪些能力已落地、哪些关键缺口仍在、如何用代码与运行时证据验证推进结果。

## 2026-05-12 HEAD 现实校准

- 先前“Phase-1 已收口”的表述对当前 HEAD 过于乐观，现以本节为准。
- 当前已经真实落地的部分：
  - `src/learning/store.ts` 已具备 file-backed ops、embedded SQLite graphdb persistence/query 路径，以及 HTTP adapter 语义路径，
  - embedded sqlite 基线现在还具备了重启耐久性证明：shutdown 会干净关闭 store，adapter 可安全重开，server integration 已覆盖 ingest -> shutdown -> fresh module reload -> diagnostics/query/readiness 连续性，
  - `src/learning/queryBackend.ts` / `src/learning/vectorAccelerationAdapter.ts` 现已具备 ANN 风格 prefilter、representation telemetry、circuit health、远端索引同步，以及 live `external_http` connector 证明，
  - runtime capability / runbook 治理也已新增显式的 ANN 远端索引同步健康度检查（`query_vector_acceleration_index_sync_health`），与 prefilter、health、traceability、circuit 并列，
  - `server.ts` 现已补齐对应的 operator 闭环：该 sync-health 门禁已经进入 verification escalation、remediation action queue、以及 per-check runbook history summary，
  - agent workspace 的 runtime-runbook verify 卡片现在也会渲染 ANN sync-health 指标，运维侧不必再翻 raw JSON 才能看到这条门禁，
  - `src/learning/KnowledgeLearningPlatform.ts` 中的 Phase-2 运行时诊断面已接通真实实现，包括 query-backend comparison/history/trend、knowledge staleness diagnostics/rebuild planning、learning-quality history/trend、session-plan quality evaluate/history/trend/runtime-threshold diagnostics、query-backend config、query-backend diagnostics，
  - Phase-3 的导师/记忆诊断仍为真实实现，且 `src/server.ts` 现已注入默认激活态 tutor adapter，正常 server 路径可直接产出 adapter telemetry。
- 当前仍未闭环的部分：
  - Phase-1 A8 已经超出 file-only 默认态：`src/server.ts` 现在默认走 `graphdb/sqlite` 并保留显式 file fallback，且重启耐久性已证明；但在宣布本地图后端达到生产闭环之前，packaged/runtime 证明与更重工作负载级加固仍未完成；
  - Phase-1 A9 现已进入 operational baseline，而不再只是 scaffolding：但在宣布 ANN 层达到生产闭环前，仍需补齐 recall/latency 校准与更大工作负载验证；
  - Phase-2 的 quality/session/query 可观测性已不再是空占位，但它们仍需要建立在当前 graph/ANN operational baseline 之上的发布级校准，因此还不能宣称发布级闭环；
  - 默认 tutor routing 已不再只是 catalog-only，但当前 runtime 仍是 `local`-first，并保留显式 rule-engine fallback，而不是已验证的生产级多 provider 路由策略。
- 因此当前活跃重心不是“默认认为 Phase-1 已完成然后推进上层”，而是：
  1. 先补完 embedded graph backend 基线剩余的 packaged/runtime + 更重工作负载闭环，
  2. 补完当前 live ANN connector baseline 的工作负载与阈值闭环，
  3. 让这批新诊断面始终与同一份运行时真相保持一致，
  4. 只有在 graph/ANN 基线达到发布级后，才把 Phase-2 / Phase-3 门禁升级为发布级结论。

## 2026-05-12 当前架构体量

| 文件 | 当前行数 | 含义 |
|---|---:|---|
| `src/server.ts` | 14,992 | 路由虽已模块化，但主服务单体仍然偏大 |
| `src/learning/KnowledgeLearningPlatform.ts` | 7,706 | KLP 仍然承载了大量实现重心 |
| `src/frontend/path_app.js` | 4,649 | path workbench / controller 仍未拆完 |
| `src/frontend/app.js` | 4,713 | graph host 侧控制面仍较厚 |
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

## 2026-05-10 Phase-1 收口更新

- Phase-1 的 A8/A9 底座加固已完成实现收口：
  - 图后端适配器路径已具备 HTTP 操作级语义（`getNode/queryNodes/queryEdges/findPath`）并接入运行时诊断可追溯。
  - ANN 连接器加固已落地候选归一化、表示一致性遥测传递与 prefilter 有效性信号。
- 当前活跃执行重心切换到 Phase 2 的质量门禁推进（掌握闭环 + 发散回路效果）。

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
- 可与 graph focus 并排存在并支持全屏提升的 learning-path pane。

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
- 新增 agent workspace 已补齐静态壳层与运行时按钮/空态提示的双语覆盖，且已有知识卡片动作按钮与带参数系统消息会在语言切换时重渲，而不是停留在旧语言；conversation card 的重渲也已集中到 card-kind 渲染注册表，并新增源码级一致性门禁测试校验 append-kind 与注册表键集合对齐，降低后续新增卡片的漏改风险（`src/frontend/index.html`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/frontend/workspace_panes.js`、`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
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
- browser smoke 已覆盖真实 `conversation/path/query-compare/quality/session/runbook` 后端切片（含 trend + history 诊断与 runbook checks/action-queue）、真实 graph runtime、真实 path runtime，并会输出 screenshot / console / network-summary 证据路径（`scripts/verify-agent-workspace-browser.js`、`src/agent_workspace.browser.contract.test.ts`），
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

## 最新验证快照（2026-05-12）

- 当前 Windows 宿主已通过：`npm run test:agent-workspace:contracts`、`npm run verify:agent-workspace:runtime`、`npm run verify:agent-workspace:browser`、`NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT=1 node scripts/verify-agent-workspace-browser.js`、`NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 node scripts/verify-agent-workspace-browser.js`、`NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT=1 node scripts/verify-agent-workspace-browser.js`、`npm run verify:agent-workspace:tauri`、`node node_modules/jest/bin/jest.js src/source_manager.loadflow.test.ts src/welcome.loadflow.test.ts src/pathmode.history.contract.test.ts --runInBand --no-cache`、`npm run verify:sidecar:supply`、`npm test -- src/knowledge.api.contract.test.ts --runInBand`、`npm run docs:diataxis:check`、`npm run docs:site:build`。
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
| L5 治理层 | 运行时检查、趋势门禁、整改闭环 | runtime capability matrix + runbook + remediation event 已实现，包含 `query_backend_runtime_health`、`query_vector_index_*`、`store_graphdb_connector_health` 与 `query_vector_acceleration_mode`/`query_vector_acceleration_index_sync_health`/`query_vector_acceleration_health`/`query_vector_acceleration_prefilter_effectiveness`/`query_vector_acceleration_traceability`/`query_vector_acceleration_circuit_state` 检查；其中 circuit-state 已升级为阈值驱动（短路计数/比例、连续失败、半开探测成功率），prefilter-effectiveness 则用于识别代表性流量下 ANN 长期回退 `full_scan` 的失效场景 | 强化阈值校准与故障回放自动化，并把治理升级严格绑定到发布级 graph/ANN 基线之上 |

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
2. 把 embedded `graphdb/sqlite` 基线从“已证明重启耐久性”推进到 packaged/runtime + 更重工作负载闭环，同时保持 fail-open/fail-closed rollout 语义不破坏。
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

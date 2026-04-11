# 参考：接口与运行时契约

本页用于集中查看权威 API/运行时契约。

## 主要契约文档

- [docs/zh/Interface Document.md](../../../zh/Interface%20Document.md)
- [docs/zh/User_Manual.md](../../../zh/User_Manual.md)

## 集成专题参考

- [Godot + NoteMD + Markdown 接口](./godot-notemd-markdown-interfaces.md)
- [Godot + NoteMD + Markdown 工作流](../how-to/godot-notemd-markdown-workflows.md)

## 开发基线快速入口（v1.7.0+）

- [知识彻底掌握演进路线图](../explanation/knowledge-mastery-evolution-roadmap.md)
- [开发进度看板](../explanation/development-progress-dashboard.md)
- [学习平台契约与工作台基线](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [演进进度对齐需求](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

## 学习平台契约面

- 接口契约层：
  - `src/learning/api.ts`
  - `src/learning/types.ts`
- 运行时实现层：
  - `src/learning/KnowledgeLearningPlatform.ts`
  - `src/learning/store.ts`
  - `src/learning/queryBackend.ts`
  - `src/learning/runtimeCapability.ts`
- API 路由与 alias 归一化：
  - `src/server.ts`
- 前端操作与调试集成：
  - `src/frontend/path_app.js`
- 契约回归护栏：
  - `src/knowledge.api.contract.test.ts`

## v1.6.0 关键运行时契约点

- 前端运行时能力水合 invoke 契约：
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Rust sidecar 运行时配置命令：
  - `get_sidecar_runtime_config`
- Rust 应用运行时配置命令：
  - `get_app_runtime_config`
- Runtime bridge 通过 `whenReady()` 保障调用时序。

## 启动性能观测与试点 Profile（v1.7.0+ 试点）

- 前端启动关键点采用单次日志输出：
  - `T0 app_boot`
  - `T1 graph_preprocessed`
  - `T2 worker_init_sent`
  - `T3 first_tick_received`
  - `T4 first_interactive_render`
  - `T5 stable_layout`
- Worker 通过 `simulationWorker` 初始化载荷接收启动 profile：
  - `startupProfile.id`
  - `startupProfile.tickMaxFps`
  - `startupProfile.lowAlphaTickMaxFps`
  - `startupProfile.lowAlphaThreshold`
  - `startupProfile.stableAlphaThreshold`
  - `startupProfile.stableHoldTicks`
  - `startupProfile.stableTimeoutMs`
  - `startupProfile.deltaEnabled`
  - `startupProfile.deltaEpsilonPx`
  - `startupProfile.fullSyncEveryTicks`
  - `startupProfile.lowAlphaDeltaEpsilonMultiplier`
  - `startupProfile.lowAlphaFullSyncEveryTicks`
- Worker -> 主线程 tick 传输契约（Phase 2）：
  - `tickMode: 'full' | 'delta'`
  - `isDelta: boolean`
  - `nodes: [{ id, i, x, y }]`（`i` 为 Worker 节点索引快速路径；delta 模式仅包含变化节点）
  - 主线程对启动期 tick 采用帧级合并应用，降低重复重绘压力。
  - `T5 stable_layout` 附带 `tickSummary`（`fullTicks`、`deltaTicks`、`deltaRatio` 与载荷统计）。
- 多平台启动试点 profile：
  - `desktop_windows_pilot`：`26 FPS`、`400ms` 边延迟、`1500ms` SVG 窗口（`18000` 条边）。
  - `desktop_macos_pilot`：`24 FPS`、`430ms` 边延迟、`1700ms` SVG 窗口（`15000` 条边）。
  - `desktop_linux_pilot`：`24 FPS`、`420ms` 边延迟、`1600ms` SVG 窗口（`16000` 条边）。
  - `mobile_android_pilot`：`18 FPS`、`560ms` 边延迟、`2200ms` SVG 窗口（`7000` 条边），并降低启动星空密度。
  - `mobile_ios_pilot`：`17 FPS`、`600ms` 边延迟、`2300ms` SVG 窗口（`6200` 条边），并降低启动星空密度。
- 启动视觉遮罩契约：
  - 在 `T5 stable_layout` 前显示虚化启动层（若超时则安全关闭）。
  - 核心文案：`等待世界构建`。
  - 星空可交互：星星自然闪烁，用户点击可点暗附近星星。
  - 在移动端和 reduced-motion 环境自动降载（星点密度/动画强度）。
- 运行时覆盖开关（用于回滚与 A/B 验证）：
  - `localStorage['nc.startupPerfProfile'] = 'off'` 可关闭试点行为。
  - `localStorage['nc.startupPerfProfile'] = 'desktop_windows_pilot'` 可强制开启试点行为。
  - `localStorage['nc.startupPerfProfile'] = 'desktop_macos_pilot' | 'desktop_linux_pilot' | 'mobile_android_pilot' | 'mobile_ios_pilot'` 可强制选择对应 profile。
- 自动化基线/试点汇总脚本：
  - `npm run perf:startup:compare -- --baseline <baseline-log-path> --pilot <pilot-log-path>`
  - 支持文件或目录输入，自动按 `[Startup Perf]` 检查点切分会话并输出 P50/P95 KPI 报告。
- 自动化多平台矩阵汇总脚本：
  - `npm run perf:startup:matrix -- --root <startup-logs-root> [--out <report-path>]`
  - 推荐目录结构：`<root>/<platform>/baseline|pilot`（例如 `windows`、`macos`、`android`）。
  - 兼容单平台目录：`<root>/baseline|pilot`，可配合 `--single-platform-label <label>` 指定平台标签。
- 准实时矩阵门禁（日志变更自动重算）：
  - `npm run perf:startup:matrix:watch -- --root <startup-logs-root> --out <report-path> --strict`
  - 推荐目录（同设备双阶段）：
    - `<root>/macos/baseline/*.log`
    - `<root>/macos/pilot/*.log`
    - `<root>/android/baseline/*.log`
    - `<root>/android/pilot/*.log`
    - `<root>/ios/baseline/*.log`
    - `<root>/ios/pilot/*.log`
- 无多端设备条件下的替代链路（仅链路验证）：
  - `npm run perf:startup:matrix:simulate -- --seed-root tmp/startup-logs --out-root tmp/startup-logs-simulated`
  - `npm run perf:startup:matrix -- --root tmp/startup-logs-simulated --out tmp/startup-logs-simulated/report-platform-matrix.md`
  - 注意：`tmp/startup-logs-simulated` 为模拟数据，禁止用于 release-go 性能结论，仅用于脚本/门禁流程演练。
- 无硬件一键签收（工程签收 + 发布签收待办提示）：
  - `npm run perf:startup:signoff:nohw`
  - 该命令会自动执行：Windows 真实日志门禁 + 模拟多端三规模门禁，并输出分层签收报告。
  - 若缺少真实多端 cohort 数据，发布签收会标记为 `TODO` 并进入未来待办测试清单。
- 三规模自动回归与灰度门禁（Phase 4）：
  - `npm run perf:startup:cohorts:verify -- --root <cohorts-root> --cohorts small,medium,large --out <report-path> --strict`
  - 目录约定：`<cohorts-root>/<cohort>/<platform>/baseline|pilot`
- 支持样本量门禁：`--min-sessions-per-platform <N>`

## 学习运行时治理 Runbook（v1.7.0+）

- 运行时能力矩阵端点：
  - `GET /api/knowledge/runtime-capability-matrix`
- 运行时能力 Runbook 端点：
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook?checkId=<check_id>`
  - `GET /api/knowledge/runtime-capability-runbook/verify?checkId=<check_id>&limit=<N>`
  - `GET /api/knowledge/runtime-capability-runbook/history`
  - `GET /api/knowledge/runtime-capability-runbook/history/checks`
  - `GET /api/knowledge/runtime-capability-runbook/history/action-queue`
  - `GET /api/knowledge/runtime-capability-runbook/history/remediation-events`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event`
- Learning Workbench 对 Runbook GET 端点的前端重试策略键：
  - `runtime_runbook_get` -> `GET /api/knowledge/runtime-capability-runbook`
  - `runtime_runbook_verify_get` -> `GET /api/knowledge/runtime-capability-runbook/verify`
  - `runtime_runbook_history_get` -> `GET /api/knowledge/runtime-capability-runbook/history`
  - `runtime_runbook_history_checks_get` -> `GET /api/knowledge/runtime-capability-runbook/history/checks`
  - `runtime_runbook_action_queue_get` -> `GET /api/knowledge/runtime-capability-runbook/history/action-queue`
  - `runtime_runbook_remediation_history_get` -> `GET /api/knowledge/runtime-capability-runbook/history/remediation-events`
  - 当前 runbook GET 家族默认策略：
    - `timeoutMs=12000`
    - `maxRetries=2`
    - `retryable=true`
  - 调试入口：
    - `learningWorkbench.apiRequestTraces[].policyKey`
    - `GET /api/runtime-request-trace`（服务端关联请求诊断）
    - `GET /api/runtime-request-trace` 还支持 `requestId=<exact_id>` 精确过滤，并在 `summary.requestId` 回显当前过滤值。
- Tutor 路由动态对齐治理检查：
  - `checkId = tutor_routing_dynamic_mode_alignment`
  - 用于检测固定 `preferredMode` 与自适应动态推荐模式之间的冲突。
  - 基于冲突强度与路由退化预算输出 `pass | warn | fail`。
- 编排路径策略对齐治理检查：
  - `checkId = orchestration_path_strategy_alignment`
  - 用于评估基于趋势自动选路（`strategy_trend`）是否仍与掌握度提升结果对齐。
  - 基于样本量、平均掌握增量、负向结果占比输出 `pass | warn | fail`。
- 动态路由信号契约：
  - Tutor Trace 字段：
    - `adapterRoutingDynamicPreferredMode`
    - `adapterRoutingDynamicModeReason`
  - Tutor Telemetry 汇总字段：
    - `lastRoutingDynamicPreferredMode`
    - `lastRoutingDynamicModeReason`
  - Runtime Matrix 信号字段：
    - `tutorRoutingDynamicPreferredMode`
    - `tutorRoutingDynamicModeReason`
    - `tutorRoutingDynamicModeSuggestionActive`
- `tutor_routing_dynamic_mode_alignment` 的 runbook 验证目标应包含：
  - `/api/knowledge/session/orchestration/config`（校准 preferred mode 策略）
  - `/api/knowledge/tutor/trace-diagnostics/providers/history?source=llm-adapter`（确认模式冲突趋势收敛）
- `orchestration_path_strategy_alignment` 的 runbook 验证目标应包含：
  - `/api/knowledge/session/history?userId=<userId>&pathStrategySelectionSource=strategy_trend&sinceMinutes=10080`（核对策略来源与学习结果遥测是否收敛）
  - `/api/knowledge/quality/trend`（交叉验证 `strategyBreakdown` 趋势一致性）
  - `/api/knowledge/session/orchestration/config`（当 trend-auto 持续负向时上调 `strategyMinConfidence`）
- Runbook 历史诊断新增 streak 可观测性：
  - `GET /api/knowledge/runtime-capability-runbook/history` 的 summary 包含 `activeRiskStreak` 与 `activeFailStreak`。
  - `GET /api/knowledge/runtime-capability-runbook/history/checks` 的 summary 包含：
    - `dynamicModeAlignmentRecords`
    - `dynamicModeAlignmentLatestStatus`
    - `dynamicModeAlignmentConflictStreak`
    - `dynamicModeAlignmentFailStreak`
    - `pathStrategyAlignmentRecords`
    - `pathStrategyAlignmentLatestStatus`
    - `pathStrategyAlignmentConflictStreak`
    - `pathStrategyAlignmentFailStreak`
    - `recommendedFocusEscalation`
    - `recommendedFocusTopAction`
    - `actionQueueTotal`
    - `actionQueueP0`
    - `actionQueueP1`
    - `actionQueueP2`
    - remediation 聚合指标：
      - `remediationRecords`
      - `remediationChecksWithEvents`
      - `remediationChecksRegressing`
      - `remediationChecksImproving`
      - `remediationChecksStable`
      - `remediationChecksInsufficientData`
      - `remediationAppliedRatioPct`
      - `remediationCooldownRatioPct`
      - `remediationErrorRatioPct`
      - `remediationRiskRatioPct`
      - `remediationLatestRecordedAt`
      - `recommendedFocusRemediationStatus`
      - `recommendedFocusRemediationTrendStatus`
  - `history/checks` 的每个 check 项新增：
    - `activeRiskStreak`
    - `activeFailStreak`
    - `latestEscalation`
    - `escalationActionItems`
    - `escalationActions`
    - `remediation`（单 check 维度的整改趋势摘要、状态计数与连续风险诊断）
  - `history/checks` 顶层新增：
    - `actionQueue`（跨 check 聚合后的优先级整改队列，含升级上下文元数据）
  - `history/action-queue` 提供 queue-first 视图：
    - 查询过滤参数：
      - `priority=p0|p1|p2`
      - `category=stabilize|governance|trend|routing|evidence|verify|monitor`
      - `checkId=<精确_check_id_token>`
      - `remediationStatus=applied|not_applied|cooldown|error|ignored`
      - `remediationTrend=improving|stable|regressing|insufficient_data`
    - `summary`（队列总量、过滤后队列总量、P0/P1/P2 分布、推荐焦点快照、整改风险队列快照：`remediationRiskQueueItems` / `remediationRegressingQueueItems` / `remediationAverageRiskRatioPct` / `remediationTopRiskCheckId`，以及 `priorityFilter` / `categoryFilter` / `checkIdFilter` / `remediationStatusFilter` / `remediationTrendFilter` 回显）
    - `actionQueue`（按优先级排序的动作项，含 `queueId`、check 上下文与整改风险字段：`remediationLatestStatus` / `remediationTrendStatus` / `remediationActiveRiskStreak` / `remediationRiskRatioPct`）
  - 焦点推荐覆盖规则：
    - 当 `dynamicModeAlignmentConflictStreak >= 2` 且最新状态为 `warn|fail` 时，
      `recommendedFocusCheckId` 会固定为 `tutor_routing_dynamic_mode_alignment`，
      同时 `recommendedFocusReason=dynamic_mode_alignment_conflict_streak`。
    - 当 `pathStrategyAlignmentConflictStreak >= 2` 且最新状态为 `warn|fail` 时，
      `recommendedFocusCheckId` 可能固定为 `orchestration_path_strategy_alignment`，
      且 `recommendedFocusReason=path_strategy_alignment_conflict_streak`。
- `GET /api/knowledge/runtime-capability-runbook/verify` 扩展诊断字段：
  - `selectedCheckHistory`（返回记录数、risk/fail 连续计数、趋势、最新时间）
  - `selectedCheckRemediation`（整改事件返回记录、标准化状态计数、整改连续风险、比例诊断、趋势、最新整改时间）
  - `selectedCheckEscalation`（`normal|watch|high|critical`）
  - `selectedCheckEscalationActionItems`（结构化整改动作项，含 `actionId`、`priority`、`category`、`instruction` 及 endpoint/automation 提示）
  - `selectedCheckEscalationActions`（按当前升级等级排序的可执行整改动作清单）
  - `dynamicModeAlignment`（`records`、`latestStatus`、`conflictStreak`、`failStreak`、`conflictPersistent` 与焦点建议提示）
  - `pathStrategyAlignment`（`records`、`latestStatus`、`conflictStreak`、`failStreak`、`conflictPersistent` 与焦点建议提示）
- 学习工作台刷新退化治理遥测契约：
  - 前端状态遥测字段包括：
    - `workbenchRefreshDegraded`
    - `workbenchRefreshFailureSources`
    - `workbenchRefreshFailureCount`
    - `workbenchRefreshLastFailureSummary`
    - `workbenchRefreshRecoveredSources`
    - `workbenchRefreshRecoveredCount`
    - `workbenchRefreshConsecutiveDegradedCount`
    - `workbenchRefreshLastDurationMs`
    - `workbenchRefreshAutoRemediationAt`
    - `workbenchRefreshAutoRemediationApplied`
    - `workbenchRefreshAutoRemediationReason`
    - `workbenchRefreshAutoRemediationCheckId`
    - `workbenchRefreshAutoRemediationCount`
  - Runtime summary 的 `workbenchRefresh(...)` 包含退化门禁与补救诊断：
    - `gate=ok|warn`（当退化连续计数 `>= 3` 时为 `warn`）
    - `autoRemediate=idle|attempted|applied`
    - `autoReason`
    - `autoCheck`
    - `autoCount`
    - `autoAt`
  - 自动补救触发策略：
    - 当 `workbenchRefreshConsecutiveDegradedCount >= 3` 时触发
    - 执行 runbook 焦点自动聚焦（`_maybeAutoFocusLearningRuntimeRunbookVerification`）
    - 焦点聚焦成功后执行 trace 建议链路（`_applyLearningApiTraceSuggestionFromTopRegressingRuntimeCheck`）
  - 自动补救冷却策略：
    - 若上次补救尝试在 `120s` 内，则当前刷新周期跳过补救动作。
    - 跳过原因记录为 `cooldown_active:<remaining_seconds>s`。
  - 偏好持久化契约（`localStorage['nc_learning_workbench_prefs']`）包含补救遥测字段：
    - `workbenchRefreshAutoRemediationCount`
    - `workbenchRefreshAutoRemediationAt`
    - `workbenchRefreshAutoRemediationApplied`
    - `workbenchRefreshAutoRemediationReason`
    - `workbenchRefreshAutoRemediationCheckId`
  - 工作台 runbook 过滤器偏好同样持久化：
    - action-queue 整改过滤字段：
      - `runtimeRunbookActionQueueRemediationStatusFilter`
      - `runtimeRunbookActionQueueRemediationTrendFilter`
    - remediation-event 历史过滤字段：
      - `runtimeRunbookRemediationHistorySinceMinutes`
      - `runtimeRunbookRemediationHistoryStatusFilter`
      - `runtimeRunbookRemediationHistorySourceFilter`
      - `runtimeRunbookRemediationHistoryCheckFilter`
      - `runtimeRunbookRemediationHistoryLimit`

## 学习路径策略契约（v1.7.0+）

- `POST /api/knowledge/path` 请求支持：
  - `strategy=balanced|mastery_recovery|exploration_boost`
  - `recommendedActionLimit`（兼容别名：`recommended_action_limit`、`maxActions`、`limit`）
- `POST /api/knowledge/session/plan` 支持路径策略透传：
  - `pathStrategy` / `path_strategy` / `learningPathStrategy`
  - `pathRecommendedActionLimit` / `path_recommended_action_limit`
- `POST /api/knowledge/session/execute` 在按需构建计划（未传 `sessionPlan`）时同样支持路径策略透传：
  - `pathStrategy` / `path_strategy` / `learningPathStrategy` / `strategy`
  - `pathRecommendedActionLimit` / `path_recommended_action_limit` / `recommendedActionLimit` / `recommended_action_limit`
- `StudySessionResponse.summary` 新增路径遥测字段：
  - `pathStrategy`
  - `pathRecommendedActionLimit`
  - `pathRecommendedActionCount`
  - `pathRecommendedMasteryActionCount`
  - `pathRecommendedDivergenceActionCount`
  - `pathRecommendedEvidenceCoverageRatioPct`
- `StudySessionExecutionRecord` 与 `/api/knowledge/session/history` 记录会持久化同一组路径遥测字段，用于策略-效果追踪。
- `StudySessionExecutionRecord` 额外持久化策略决策遥测：
  - `pathStrategySelectionSource`
  - `pathStrategySelectionReason`
  - 可选趋势证据：`pathStrategyTrendStatus`、`pathStrategyTrendScore`、`pathStrategyTrendConfidence`
- `/api/knowledge/session/history` 的 `summary` 新增策略来源-结果分析字段：
  - `pathStrategySelectionSourceCounts`
  - `pathStrategySelectionSourceAverageMasteryDeltaPct`
  - `pathStrategySelectionSourcePositiveRatioPct`
  - `pathStrategyOutcomeByStrategy[]`（含每种策略执行数、平均增量、正/负向占比及来源分布）
- `/api/knowledge/session/history` 现支持 `POST` 与 `GET` 共用过滤语义：
  - 策略过滤别名：`pathStrategy` / `path_strategy` / `learningPathStrategy` / `strategy`
  - 策略来源过滤别名：`pathStrategySelectionSource` / `path_strategy_selection_source` / `selectionSource` / `strategy_source`
  - 时间窗口过滤别名：`sinceMinutes` / `since_minutes` / `windowMinutes` / `window_minutes`
  - `summary` 新增 `matchedRecordsBeforeLimit` 与 `appliedFilters`（`limit`、`sinceMinutes`、`pathStrategy`、`pathStrategySelectionSource`）用于调试回显
- `KnowledgeSystemState` 新增 `sessionStrategyTelemetry` 运行时治理信号：
  - trend-auto 占比与结果信号（`trendAutoSelectionSharePct`、`trendAutoAverageMasteryDeltaPct`、`trendAutoNegativeRatioPct`）
  - 来源分布与分策略聚合结果
- `POST /api/knowledge/quality/snapshot` 新增策略质量遥测：
  - `snapshot.pathStrategyExecutionCoveragePct`
  - `snapshot.pathStrategyAverageMasteryDeltaPct`
  - `diagnostics.totalSessionExecutions`
  - `diagnostics.pathStrategyExecutionRecords`
- `GET /api/knowledge/quality/trend` 的 `deltas` 新增：
  - `pathStrategyExecutionCoverageDeltaPct`
  - `pathStrategyAverageMasteryDeltaDeltaPct`
- `GET /api/knowledge/quality/trend` 新增 `strategyBreakdown[]`，用于策略分层趋势诊断：
  - 核心字段：`strategy`、`status`、`score`、`confidence`、`reason`
  - 窗口快照：`windows.recent` 与 `windows.previous`，包含 `sampleCount`、`executionCoveragePct`、`averageMasteryDeltaPct`
  - 策略增量：`deltas.executionCoverageDeltaPct`、`deltas.averageMasteryDeltaDeltaPct`
- `StudySessionResponse.signals.orchestration` 新增路径策略决策遥测：
  - `recommendedPathStrategy`
  - `pathStrategySelectionSource=explicit_request|strategy_trend|mode_fallback`
  - `pathStrategySelectionReason`
  - 可选趋势证据：`pathStrategyTrendStatus`、`pathStrategyTrendScore`、`pathStrategyTrendConfidence`
- `StudySessionOrchestrationTrendRuntimeConfig` 新增：
  - `strategyAutoPathEnabled`
  - `strategyMinConfidence`
  - `POST /api/knowledge/session/orchestration/config` 支持别名：
    - `strategyAutoPathEnabled` / `strategy_auto_path_enabled` / `autoPathEnabled`
    - `strategyMinConfidence` / `strategy_min_confidence` / `autoPathMinConfidence`
- 策略字段别名兼容：
  - `pathStrategy`
  - `path_strategy`
  - `learningStrategy`
- `LearningPathResponse.summary` 新增：
  - `strategy`
  - `recommendedActionLimit`
  - `recommendedMasteryActionCount`
  - `recommendedDivergenceActionCount`
  - `recommendedEvidenceCoverageRatioPct`

## Mermaid 标准兼容基线（Obsidian）

- 标准兼容格式：fenced code block，起始行为 ` ```mermaid`，结束行为 ` ``` `。
- Godot 运行时渲染保持 PNG-first；Mermaid 渲染偏好需允许回退（`auto`），避免仅 bridge 可用时才成功。
- 字段级路由与契约细节：
  - [Godot + NoteMD + Markdown 接口](./godot-notemd-markdown-interfaces.md)

## app_config 运行时契约挂载点

- 前端配置水合命令：
  - `invoke('get_app_runtime_config')`
- 水合后的投影：
  - `window.__NC_APP_CONFIG.language`
  - `window.__NC_APP_CONFIG.multiWindow.*`
- 详细结构请见：
  - [app_config.toml 结构](./app-config-schema.md)

## 策略门禁族

- PathBridge 严格 schema
- Storage provider 合约
- 移动端运行时边界合约
- SBOM + attestation 策略合约
- Sidecar 签名与隐私清单合约

---
date: 2026-04-13
topic: agent-workspace-architecture-progress-and-next-direction
---

# Agent Workspace 架构推进对齐与后续方向（执行版 v4，2026-04-13）

## 目标与边界

本次目标：基于当前代码事实，修正已过时路线判断，落盘下一阶段可直接执行的推进方案。

范围限定：

- 聚焦 L4 交互与 operator 治理主线（agent chat + focus pane + learning-path pane + replay schedule）。
- 继续复用 typed capability 合同，不回退 endpoint-aware 分支模型。
- 仅吸收 DeepTutor/MemOS 的模式价值，不迁移外部 runtime。

非目标：

- 不引入新前端框架栈。
- 不引入 Python side runtime 作为主链路依赖。
- 不把当前学习平台重构为 memory-first 全量架构。

## 对齐输入（本次核对）

- `docs/brainstorms/2026-04-11-evolution-progress-alignment-requirements.md`
- `docs/brainstorms/2026-04-12-agent-workspace-next-direction-requirements.md`
- `docs/diataxis/zh/explanation/development-progress-dashboard.md`
- `docs/diataxis/zh/explanation/knowledge-mastery-evolution-roadmap.md`
- `src/server.ts`
- `src/frontend/path_app.js`
- `src/notemd.server.integration.test.ts`
- `src/path_app.runtime_trace_filter.behavior.test.ts`

## 深度对比：方案要求 vs 当前代码证据（v4）

| Axis | 方案要求 | 当前代码证据 | 判定 | 当前风险/缺口 |
|---|---|---|---|---|
| A1 对话主面 + 侧边工作区 | 对话保持主面，focus/path 作为侧边 pane | `src/frontend/index.html`、`src/frontend/workspace_panes.js`、`src/frontend/styles.css` | Done | 新 pane 类型继续扩展时，布局状态机复杂度上升 |
| A2 Focus + LearningPath 并排/全屏 | focus 与 learning-path 可并排且独立全屏 | `src/frontend/workspace_panes.js`、`src/agent_workspace.frontend.test.ts` | Done | Tauri 真窗口场景仍需持续回归 |
| A3 typed capability 唯一真相源 | 禁止依赖 legacy `availableActions` | `src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/workspace_panes.js` | Done | 历史回放旧数据兼容仍需守卫策略 |
| A4 capability 执行注册表化 | transport/request/presenter/execution-kind 注册表化 | `src/frontend/agent_workspace.js`、`src/agent_workspace.contract.parity.test.ts` | Done | 新增 action 时仍可能发生 registry/emitter 漂移 |
| A5 desktop strict evidence 治理 | rust/window/index/manifest strict gate + release 注入 | `.github/workflows/migration-gates.yml`、`.github/workflows/release-desktop-multi-os.yml`、`schemas/agent-workspace-tauri-evidence-manifest.schema.json` | Done | 非 CI 宿主依赖缺失易误读 degraded/strict 边界 |
| A6 conversation scoped memory | conversation 记忆域接入产品侧能力 | `src/server.ts`（`/api/knowledge/conversation-memory/*`）、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js` | Done | 记忆污染学习治理域的隔离纪律需持续守护 |
| A7 unified turn streaming | conversation 支持 turn 级流式协议 + fallback | `src/server.ts`（`Accept: text/event-stream`）、`src/frontend/agent_workspace.js` | Done | 流式与同步路径双轨一致性要持续回归 |
| A8 replay-schedule 建议能力 | schedule 具备结构化建议输出 | `src/server.ts`（`telemetry.recommendations`） | Done | 建议排序策略需继续校准，避免噪声建议 |
| A9 replay-schedule 策略模板 | schedule 支持模板候选 + 配置模板输入 | `src/server.ts`（`telemetry.policyTemplates`、`policyTemplate` normalizer）、`src/frontend/path_app.js` | Done | 模板选择缺少自动执行安全门禁 |
| A10 replay 自动执行安全门禁 | 建议/模板可受控自动执行（opt-in） | 当前无 `autoExecution` 配置与 telemetry 结构 | Gap | 继续手工执行会带来 operator 负担；直接自动执行会有误触发风险 |
| A11 auto-execution 可解释诊断 | 前端可见 eligibility 与 blocker 细节 | `src/frontend/path_app.js` 当前仅展示 recommendation/template 摘要 | Gap | 运维无法快速判断“为何没自动执行” |
| A12 Phase 1 底座缺口 | 真实 graphdb + 生产级 ANN 连接器 | `src/learning/store.ts`、`src/learning/queryBackend.ts` 仍为现阶段过渡基线 | Gap（并行主线） | 中长期上限受底座能力约束 |

结论：

- 2026-04-12 文档里 A8/A9 的 gap 判断已经过时，当前分支已完成 scoped memory 与 unified streaming 基线。
- 当前主矛盾已切换为：`replay-schedule 的安全自动执行闭环缺失（门禁 + 可解释诊断）`。
- 这不否定 Phase 1 底座缺口（graphdb/ANN）的战略优先级，但在当前切片应分轨推进，避免目标混线。

## 架构推进度评分（L4 当前切片）

| 子域 | 成熟度 | 说明 |
|---|---|---|
| Contract 定义/发射/渲染 | High | typed capability + parity + registry 已成型 |
| Conversation continuity | High | scoped memory + turn stream + turnId 恢复窗口已落地 |
| Operator trend governance | High | turn-cache diagnostics/trend/index/export + runbook synthetic check 已贯通 |
| Replay scheduling intelligence | Medium-High | recommendation + template 基线已完成 |
| Replay safe automation | Low | 缺少 auto-execution gate、blocked reason、front-end诊断闭环 |
| Program foundation (graphdb/ANN) | Medium-Low | 仍有结构缺口，需并行主线推进 |

## 批判性纠偏（避免错误推进）

1. 误判：下一步仍应优先扩 action 数量。  
事实：action 面已足够，短板在自动执行可控性与可解释性。

2. 误判：建议/模板落地后即可默认自动执行。  
事实：缺少门禁会放大误触发风险，尤其在 cooldown/budget/skip-streak 波动区间。

3. 误判：只要 schedule tick 有结果，运维就能定位问题。  
事实：没有 blocker 级诊断时，失败仅表现为“没执行”，不可运维。

4. 误判：先修 graphdb/ANN 再做 replay 自动化更稳。  
事实：两者耦合度低；当前 operator 压力来自 replay 调度侧，推迟会持续吞噬迭代效率。

## 路径选项与取舍

### Option A：继续手动调度（不推荐）

- 优点：实现风险最低。
- 缺点：operator 负担持续增加，建议/模板价值无法闭环。
- 适用：仅适合短期应急，不适合常态化演进。

### Option B：直接默认自动执行（不推荐）

- 优点：表面自动化速度快。
- 缺点：没有门禁会放大误执行，回滚与排障成本高。
- 适用：不适用当前基线。

### Option C：门禁驱动的 opt-in 自动执行（推荐）

- 核心：在现有 recommendation/template 上增设 `autoExecution` 安全门禁与可解释诊断。
- 优点：风险可控，可逐步扩大自动化覆盖。
- 成本：需要补齐 server/前端/测试/文档的一致性改造。

## 落盘执行方案（v4：M9-M10）

## M9（当前主线）：Replay Auto-Execution Safety Gate Baseline

目标：把 replay 调度从“可建议”升级为“可安全自动执行（opt-in）”。

必交付：

1. 在 schedule config 增加 `autoExecution` 结构（默认关闭）：
   - `enabled`
   - `mode`（`recommendation` / `policy_template`）
   - `requireDryRunParity`
   - `minConsecutiveSkips`
2. 在 schedule snapshot telemetry 增加 `autoExecution` 诊断块：
   - `eligible`
   - `blockedReasons[]`
   - `decision`（`auto_execution_blocked` / `auto_execution_dry_run_required` / `auto_execution_executed`）
   - `lastAttemptedAt` / `lastExecutedAt`
3. schedule tick 执行规则收敛：
   - 优先复用现有 cooldown/budget/trigger 守卫；
   - `requireDryRunParity=true` 时，未观察到同策略 dry-run 一致结论则禁止非 dry-run 自动执行；
   - 保持单 tick 单执行，禁止并发自动重放。
4. `lastDecision` / `lastReason` 与 runbook 事件语义对齐，支持后续审计。

建议触达文件：

- `src/server.ts`
- `src/notemd.server.integration.test.ts`
- `src/knowledge.api.contract.test.ts`

Gate：

```bash
npm test -- src/notemd.server.integration.test.ts --runInBand -t "replay schedule"
npm test -- src/knowledge.api.contract.test.ts --runInBand
```

## M9.1（并行收口）：Workbench Operator 可解释性

目标：前端可直接看到 auto-execution readiness 与 blocker。

必交付：

1. `path_app` refresh/update/tick 状态文案展示 gate 摘要：
   - `autoExecution=eligible|blocked`
   - `blockedBy=<top_reason>`
2. runtime history 文本增加 `autoExecution(...)` 片段，避免仅有 recommendation/template 信息。
3. config 更新 API 支持透传 `autoExecution` 配置字段。

建议触达文件：

- `src/frontend/path_app.js`
- `src/path_app.runtime_trace_filter.behavior.test.ts`

Gate：

```bash
npm test -- src/path_app.runtime_trace_filter.behavior.test.ts --runInBand -t "replay schedule"
```

## M10（并行主线，不阻塞 M9）：Phase 1 底座缺口预研收敛

目标：不在当前切片直接换底座，但把 graphdb/ANN 的实施前置条件落盘，避免反复摇摆。

必交付：

1. graphdb 替换边界与回退策略文档化（adapter 契约不破坏上层 API）。
2. ANN 连接器从脚手架到生产级连接的最小切换计划（索引刷新/超时/熔断/回退口径）。
3. 明确与 L4 主线的接口稳定点，避免交叉迭代冲突。

Gate：

- 文档评审通过并进入下一轮 `/ce:plan`。

## 风险清单与防护策略（更新）

| 风险 | 触发条件 | 防护策略 |
|---|---|---|
| 自动执行误触发 | 无门禁直接开启 auto run | 默认 `enabled=false` + dry-run parity 守卫 |
| 自动执行“黑盒化” | 无 blocker 级可解释诊断 | telemetry 返回 `blockedReasons[]` 并前端显式展示 |
| 决策漂移 | 模板 patch 与显式字段优先级不清 | 固化优先级：baseline -> template -> explicit，并写入契约测试 |
| 并发重放风险 | 同时触发多次 auto replay | 单 tick 单执行 + turn/replay 幂等守卫 |
| 主线目标混线 | M9 与 graphdb/ANN 同迭代硬绑定 | 明确双轨推进，M9 优先交付 |

## 明确不做（本周期）

- 不做 MemOS/DeepTutor 整体 runtime 迁移。
- 不把 replay 自动执行做成默认开启策略。
- 不在 M9 周期内并行替换 graphdb 实现。

## 可直接开工的任务序列（当前建议）

1. 先落 M9：server auto-execution gate + telemetry 诊断 + replay 决策语义。
2. 再落 M9.1：path_app 的 gate readiness/blocker 可视化与配置透传。
3. 并行维护 M10 文档预研：收敛 graphdb/ANN 的下一阶段实施边界。

## 最终判断（v4）

- 当前代码已跨过“memory/stream 基线缺失”阶段，旧路线判断需更新。
- 下一阶段最高杠杆不是继续扩 capability，而是补齐 replay-schedule 的安全自动执行闭环（门禁 + 可解释性 + 可审计）。
- 最优路径仍是“在现有 typed contract 体系内受控增强”，而非外部 runtime 迁移。

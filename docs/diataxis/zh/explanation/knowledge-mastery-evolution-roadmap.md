# 解释：知识彻底掌握演进路线图

本页用于说明 NoteConnection 如何从“知识可视化系统”演进为“本地优先、可验证学习成效”的学习平台。

## 2026-05-12 HEAD 重新定级

- 当前分支已经落入真实的 Phase-3 tutor/memory 切片，但不能继续沿用“Phase-1 已闭环”的说法。
- 当前更准确的口径是：
  - Phase-1 A8 已推进到 embedded 本地图后端基线：graph/store ops 语义、embedded SQLite graphdb persistence/query 路径与 HTTP adapter 路径已经存在，且默认 runtime 现在走 `graphdb/sqlite` 并保留显式 file fallback；但 packaged/runtime 证明与工作负载级加固仍未完成；
  - Phase-1 A9 为 `Partial+`：ANN 风格 prefilter、representation telemetry 与 `external_http` 脚手架已经存在，但默认交付路径仍没有接上已验证的生产级 ANN 后端；
  - Phase-2 现已具备运行级诊断基线：`learning quality`、`session plan quality`、query compare、staleness、query-backend config、query-backend diagnostics 都已接通真实实现，但由于仍建立在同一个 `Partial+` 的 Phase-1 graph/ANN 交付路径之上，因此还不能宣称发布级闭环；
  - Phase-3 现已进入 operational baseline：导师遥测、导师 trace/provider trend、conversation memory、memory-policy diagnostics，以及默认 runtime tutor-adapter 注入都是真实实现，但生产级多适配器路由策略仍未闭环。
- 因此下一轮推进不应再以“假定底座完成”为前提，而应先补齐真实 backend 闭环，再升级质量与导师门禁。

## 战略总目标

路线图只围绕一个核心目标展开：

- 在保持结果可解释、可审计的前提下，持续提高可测量的掌握度提升。

为达到这个目标，系统必须同时满足：

1. 知识表示稳定且证据可追溯，
2. 检索可解释且编排有策略约束，
3. 掌握状态更新闭环可被质量门禁验证。

## 为什么必须转型

- 可视化提升理解路径，但不能证明学习效果。
- 若 LLM 输出缺少证据对齐，会出现“看似流畅但不可信”的学习反馈。
- 长期学习依赖时序有效性和记忆治理，不能只做单次问答。

## 三阶段路线骨架

## Phase 1：表示层与底座加固

- 统一摄入与 staleness 重建链路。
- 关系边 + 时序边契约化。
- 存储后端抽象（`file` / `memory` / `graphdb`）与 fallback 安全路径。
- 检索后端可比较（`local_hybrid` vs `keyword_only`）并沉淀趋势遥测。

## Phase 2：掌握闭环与发散引擎

- 掌握诊断与误区统计。
- 会话规划支持双路径输出（`MasteryPath` + `DivergencePath`）。
- 会话历史支持策略来源与结果遥测分析。
- 质量趋势与阈值门禁与路径策略联动。

## Phase 3：导师与记忆操作层

- 在证据优先约束下接入可插拔导师动作。
- 对 `session` / `unit` / `long_term` 记忆策略建立诊断与趋势治理。
- 运行时能力 runbook 落地整改队列与事件验证闭环。

## 当前实施基线（2026-04-11）

- 核心接口位于 `src/learning/api.ts`，由 `src/learning/index.ts` 对外导出。
- 原子/证据/关系/时序/掌握/动作/导师轨迹类型位于 `src/learning/types.ts`。
- 服务端 API 面在 `src/server.ts`，由 `src/knowledge.api.contract.test.ts` 持续做契约覆盖。
- Learning Workbench 在 `src/frontend/path_app.js` 集成会话、治理与调试能力。

## 2026-05-12 HEAD 真实状态重分级

- 当前准确状态是：
  - Phase-1 A8 已推进到 embedded 本地图后端基线：graph/store ops 语义、embedded SQLite graphdb persistence/query 路径与 HTTP adapter 路径已经存在，且默认 runtime 现在走 `graphdb/sqlite` 并保留显式 file fallback；但 packaged/runtime 证明与工作负载级加固仍未完成。
  - Phase-1 A9 仍是 `Partial+`：ANN 风格 prefilter、representation telemetry 与 `external_http` 脚手架已经存在，但默认交付路径上仍没有已验证的生产级 ANN 后端。
  - Phase-2 现已具备运行级诊断基线：`learning quality`、`session plan quality`、query comparison、staleness、query-backend config、query-backend diagnostics 都已接通真实实现，但由于它们仍建立在同一个 `Partial+` 的 Phase-1 graph/ANN 交付路径之上，因此还不能宣称发布级闭环。
  - Phase-3 现已从 catalog-only 前进到 operational baseline：tutor telemetry、tutor trace/provider trends、conversation memory、memory-policy diagnostics，以及默认 runtime tutor-adapter 注入都是真实的，但生产级多 provider 路由策略仍未闭环。

## 当前仍需优先补齐的结构缺口

1. 真实 graph backend 闭环：
   - 让新的 embedded `graphdb/sqlite` 默认基线在 packaged/runtime 路径中持续成立，
   - 针对这一真实本地图引擎验证 ops-preferred 查询语义、fallback 一致性、持久化行为与工作负载级耐久性。
2. 真实 ANN connector 闭环：
   - 把 `external_stub` / `external_http` 从“脚手架状态”推进到至少一条生产级 connector 路径，
   - 在宣称向量层可用于生产前完成 recall / latency 阈值校准。
3. Phase-2 质量门禁：
   - 让新接通的 `learning quality`、`session plan quality`、query comparison、staleness 诊断与同一份运行时真相持续对齐，
   - 只有在 Phase-1 backend 不再是 `Partial+` 之后，才把这些趋势输出升级为发布阻断门禁。
4. tutor routing 加固：
   - 保持当前已激活的默认 `tutorAdapter` 可观测，
   - 在保留显式 fallback 行为的前提下，从 local-first 继续推进到生产级多 provider 路由策略。
5. 架构压力：
   - 持续压缩 `server.ts`、`KnowledgeLearningPlatform.ts`、`path_app.js`、`app.js`、`routes/knowledge.ts`，避免“文档说已收口、代码仍在回涨”的结构漂移。

## 后续迭代决策规则

1. 真相先于“完成”：
   - 只要仍有 placeholder 返回或 catalog-only wiring，就不能用“已闭环”描述该能力。
2. 先补真实底座，再做 rollout 结论：
   - 先完成 graphdb / ANN 的真实交付，再讨论底座已经生产级。
3. 证据优先：
   - 新能力必须同时给出契约接线、运行时可观测信号、以及新鲜测试证据。
4. 门禁先于演示：
   - 趋势输出可用于观察，但发布决策必须绑定非 placeholder 的阈值门禁结果。
5. tutor routing 必须是“已激活”，不能只做到“可枚举”：
   - 只有默认 server runtime 在真实执行中出现 adapter telemetry，才算多适配器导师路径闭环。

## 进度跟踪入口

- [开发进度看板](./development-progress-dashboard.md)

该页面提供执行视角：分层矩阵、调试 Runbook、优先级待办。

## 权威计划与基线来源

- [docs/zh/knowledge_mastery_evolution_plan.md](../../../zh/knowledge_mastery_evolution_plan.md)
- [学习平台契约与工作台基线（v1.7.0 到 HEAD）](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [演进进度对齐需求（2026-04-11）](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

## 关联解释文档

- [架构与迁移](./architecture-and-migration.md)
- [启动节点更新提速方案](./startup-node-update-acceleration-plan.md)

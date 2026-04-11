# 解释：知识彻底掌握演进路线图

本页用于说明 NoteConnection 如何从“知识可视化系统”演进为“本地优先、可验证学习成效”的学习平台。

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

## 当前仍需优先补齐的结构缺口

1. 图存储深度不足：
   - `src/learning/store.ts` 的 `graphdb` 当前仍依赖 `FileGraphDbSnapshotAdapter`。
   - 具备 fallback 稳定性，但尚未达到“真实本地图数据库后端”目标。
2. 向量检索独立性不足：
   - `src/learning/queryBackend.ts` 目前是 `local_hybrid` 与 `keyword_only` 两路。
   - 尚未接入独立向量索引后端。

## 后续迭代决策规则

1. 先补底座再扩功能：
   - 优先完成 graph backend 与 vector backend 缺口，再扩大高层功能面。
2. 证据优先：
   - 新能力必须同时给出契约接线、运行时可观测信号、测试证据。
3. 门禁先于演示：
   - 趋势图可用于观察，但发布决策必须绑定阈值门禁结果。

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

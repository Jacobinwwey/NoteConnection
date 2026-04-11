# 解释：开发进度看板

本页是“知识彻底掌握演进方案”的实现侧进度看板。
它用于回答三件事：哪些能力已落地、哪些关键缺口仍在、如何用代码与运行时证据验证推进结果。

## 范围

- 聚焦对象：本地优先学习平台（摄入、检索、学习路径、导师、记忆、治理）。
- 时间窗口：`v1.7.0` 到当前分支基线。
- 证据原则：每条进展结论都必须可映射到：
  - 契约层（`src/learning/api.ts`、`src/learning/types.ts`）
  - 路由层（`src/server.ts`）
  - 测试层（`src/knowledge.api.contract.test.ts` 及领域测试）

## 阶段快照（2026-04-11）

| 阶段 | 目标 | 当前状态 | 证据 |
|---|---|---|---|
| Phase 1 | 知识解析 + 图谱底座 + staleness 治理 | 部分完成 | `src/learning/KnowledgeLearningPlatform.ts`、`src/learning/store.ts`、`src/learning/queryBackend.ts` |
| Phase 2 | 掌握闭环 + 发散引擎 | 进行中 | `src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/path_app.js` |
| Phase 3 | 可插拔导师 + 记忆操作层 | 进行中 | `src/learning/tutorAdapter.ts`、`src/learning/runtimeCapability.ts`、`src/server.ts` |

## 分层实现矩阵

| 层级 | 目标 | 已落地基线 | 剩余工作 |
|---|---|---|---|
| L0 表示层 | 将文档解析为原子与证据 | 原子、证据、source hash 与 staleness 重建链路已实现（`ingestKnowledge`、staleness APIs） | 增强公式/代码归一化与解析遥测粒度 |
| L1 结构层 | 构建关系 + 时序图 | `RelationEdge` 的 `provenance` 与 `TemporalEdge` 有效期机制已实现 | 提升关系质量评分与跨文档冲突处理 |
| L2 检索层 | 证据优先、可解释检索 | `local_hybrid` / `keyword_only` 已实现，并回传检索模式权重 | 引入独立向量检索后端与更清晰插件边界 |
| L3 学习层 | 掌握诊断 + 动作编排 | 掌握诊断、误区汇总、双路径推荐、会话执行流水线已实现 | 将学习效果提升指标升级为硬门禁 |
| L4 交互层 | 工作台统一操作与诊断 | Learning Workbench 已接入会话、质量、runbook、trace 诊断 | 改进长历史窗口筛选与整改批处理操作体验 |
| L5 治理层 | 运行时检查、趋势门禁、整改闭环 | runtime capability matrix + runbook + remediation event 已实现 | 强化阈值校准与故障回放自动化 |

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

## 存储与状态层

- `src/learning/store.ts` 已支持：
  - `file`
  - `memory`
  - `graphdb`（当前为 file-adapter + fallback）
- 当前结构上限：`graphdb` 仍基于 `FileGraphDbSnapshotAdapter`（`local-file-graphdb`），尚非真实本地图数据库引擎。

## 检索层

- `src/learning/queryBackend.ts` 已实现：
  - `local_hybrid`：关键词 + 语义 token 相似度 + 关系度 + 时序过滤
  - `keyword_only`：关键词主导 + 时序过滤
- 当前结构上限：尚未接入独立向量检索索引后端。

## 工作台层

- 前端编排与诊断入口：`src/frontend/path_app.js`。
- 关键可观测能力已接入：
  - runtime runbook 看板
  - request trace 过滤
  - query backend 诊断与配置
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

## 4）检索策略自检

- 同查询对比后端并检查可解释性差距：
  - `POST /api/knowledge/query/compare-backends`
- 查看趋势窗口：
  - `GET /api/knowledge/query/compare-backends/trend`

## 5）会话策略质量自检

- 检查策略来源与学习结果一致性：
  - `GET /api/knowledge/session/history?pathStrategySelectionSource=strategy_trend&sinceMinutes=10080`
  - `GET /api/knowledge/quality/trend`
  - `GET /api/knowledge/session/plan/quality/trend`

## 后续推进优先级

1. 将 file-backed graphdb adapter 升级为真实本地图数据库适配器，并保留 fallback。
2. 引入独立向量检索后端，接入 compare-backends 与 trend 治理链路。
3. 将学习效果指标从“趋势展示”升级为“强门禁”。
4. 增加 runbook 整改事件回放自动化，降低人工故障处理成本。

## 关联文档

- [知识彻底掌握演进路线图](./knowledge-mastery-evolution-roadmap.md)
- [接口与运行时契约](../reference/interfaces-and-runtime.md)
- [学习平台契约与工作台基线](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [演进进度对齐需求](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

---
module: architecture
tags: [implementation-plan, roadmap, next-steps]
problem_type: planning
created: 2026-05-08
status: active
---

# Implementation Plan — Phase 4 (2026-05-08)

## 元信息

三份超级方案（跨平台架构优化、Agent Workspace v6、Notemd CLI 对齐）已 100% 交付（66/66 items）。
本文档定义 Phase 4 的推进方向：从"方案对齐"转向"工程硬化"。

---

## 一、已完成基线

| 方案 | 要求 | 完成 | 终态 |
|---|---|---|---|
| 跨平台架构优化 (A+B+C) | 24 | 24 | ✅ 100% |
| Agent Workspace v6 (A1-A12 + M10.4-M10.6) | 15 | 15 | ✅ 100% |
| Notemd CLI 对齐 (obsidian v1.8.4) | 27 ops | 27 | ✅ 100% |
| **总计** | **66** | **66** | **100%** |

### 关键交付物

| 模块 | 状态 | 关键指标 |
|---|---|---|
| Notemd CLI Operations | 27 ops, 38 files, 8,307 lines | CLI parser + diagram pipeline + workflow pipeline |
| GraphDB Ops Adapter | M10.5 Done | getCapabilities, getNode, queryNodes, queryEdges, findPath BFS |
| ANN Production Connector | M10.6 Done | AnnRunbookHealthGate, prefilter metrics, representation validation |
| Shared Types | v2.3.0 | 3-domain contracts (learning + notemd + agent-workspace) |
| CI | @v4 actions | 9 workflows, 10 matrix gates |

---

## 二、当前架构健康度

### 单体缩减进度

| 文件 | 方案前 | 当前 | 缩减 | 目标 | 剩余 |
|---|---|---|---|---|---|
| `server.ts` | ~16,900 | 15,727 | -7% | <3,000 | 12,727 |
| `path_app.js` | ~15,100 | 4,245 | **-72%** | <2,000 | 2,245 |
| `app.js` | ~15,000 | 5,175 | **-65%** | <3,000 | 2,175 |
| `KLP.ts` | ~13,400 | 3,968 | **-70%** | <2,000 | 1,968 |

### server.ts 内联状态

| 内联块 | 行数 | Registry 覆盖 | 状态 |
|---|---|---|---|
| knowledge GET handlers | — | 100% | ✅ 已删除 (-1,272 lines) |
| notemd GET+POST handlers | ~1,147 | 100% | ⏳ 死代码，待安全删除 |
| knowledge POST + data/render | ~8,000+ | 部分 | ⏳ 待 registry 覆盖率达标后处理 |
| Terminal routes (meta/diag/static) | ~7 | — | ✅ 有意保留 |

---

## 三、Phase 4 推进方案

### P0: server.ts 内联死代码删除

**目标**: 删除 notemd inline block (~1,147 lines)，建立内联删除模式

**步骤**:
1. `NOTE_CONNECTION_STRICT_REGISTRY=1` 环境下验证 registry 100% 覆盖
2. 将 inline block 替换为 registry-fallback 日志桩（保留请求追踪）
3. 集成测试通过后删除 inline block

**触点**: `src/server.ts` (lines 13210-13355, 14357-15352)
**验证**: `npm run test:notemd:integration` (server runtime required)

### P1: path_app.js → import extracted modules

**目标**: 将已提取的 `path_mermaid_utils.mjs` (11 函数, ~130 lines) 导入回 path_app.js，消除重复代码

**步骤**:
1. path_app.js 顶部添加 `import { ... } from './path_mermaid_utils.mjs'`
2. 替换 `this._funcName(...)` 为直接函数调用
3. 保留原始 `this._funcName` 定义但标记 `@deprecated`

**触点**: `src/frontend/path_app.js`, `src/frontend/path_mermaid_utils.mjs`
**验证**: `npm run test:frontend` (browser required)

### P2: path_state.mjs — 状态对象提取

**目标**: 从 path_app.js 提取 `learningWorkbench`, `runtimeConfig`, 动画状态为独立模块

**步骤**:
1. 创建 `src/frontend/path_state.mjs` 导出状态工厂函数
2. path_app.js 导入并使用工厂函数初始化状态
3. 保持事件监听器不变（仅提取数据定义）

**触点**: `src/frontend/path_app.js`, `src/frontend/path_state.mjs`
**预计节省**: ~200 lines

### P3: Notemd → Agent Workspace 前端集成

**目标**: Agent Workspace 对话面板可展示并调用 notemd CLI 操作

**步骤**:
1. `workspace_panes.js` 新增 "Notemd Tools" pane
2. 调用 `GET /api/notemd/capability-manifest` 获取操作列表
3. 操作卡片渲染（automationLevel + sideEffectClass + description）
4. 用户点击操作 → 弹出参数表单 → `POST /api/notemd/workflow`

**触点**: `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/shared/types.ts`

### P4: store.test.ts mock 对齐

**目标**: 修复 15/15 预存失败的 store.test.ts 测试

**步骤**:
1. 更新 mock adapter 对象匹配 `GraphDbSnapshotAdapter` 新接口
2. 补充 `provider`, `opsCapable`, `getDiagnostics` 字段
3. 验证全部 15 test cases 通过

**触点**: `src/learning/store.test.ts`

---

## 四、长期方向 (Phase 5+)

| # | 方向 | 描述 | 优先级 |
|---|---|---|---|
| D1 | Unified Backend Layer | GitNexus 模式: auto-negotiation, health-aware routing | 中 |
| D2 | Pipeline DAG | 工作流从线性升级为 DAG, 并行执行 + 重试/回滚 | 中 |
| D3 | Agent-Driven Pipeline | Agent Workspace 自主解析 invocation contract 并执行管道 | 中-长 |
| D4 | Production Hardening | 结构化日志 + metrics dashboard + alerting thresholds | 中-长 |
| D5 | app.js graph 控制器提取 | graph_renderer.mjs + graph_interaction.mjs | 长 |

---

## 五、风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| server.ts 内联删除破坏边缘路径 | 中 | 高 | 渐进删除 + registry fallback 桩 |
| path_app.js 事件耦合在提取时断裂 | 中 | 中 | 先提取纯函数, 后提取状态, 最后事件 |
| store.test.ts 长期无测试覆盖 | 高 | 中 | P4 专项修复 pass |
| Notemd 前端集成 scope creep | 低 | 中 | 先 read-only capability listing |

---

## 六、关联文档

- [跨平台架构优化方案](cross-platform-architecture-refinement-2026-05-02.md)
- [实施方案差距分析 v2.5](implementation-gap-analysis-2026-05-04.md)
- [Agent Workspace 合同收敛 v6](../brainstorms/2026-04-14-agent-workspace-contract-closure-next-direction-requirements.md)

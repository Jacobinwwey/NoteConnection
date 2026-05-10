---
title: v1.7.0-to-head learning platform contract and workbench baseline
date: 2026-04-02
category: documentation-gaps
module: knowledge-mastery-platform
problem_type: documentation_gap
component: documentation
severity: high
applies_when:
  - adding or changing /api/knowledge endpoint contracts
  - extending KnowledgeLearningPlatform ingest, session, tutor, or memory-policy flows
  - wiring path-mode learning workbench features to backend learning APIs
symptoms:
  - learning capabilities were distributed across platform logic, server routes, and workbench UI without one implementation baseline
  - contributors needed to infer sequencing from tests and handlers instead of a single solution narrative
root_cause: inadequate_documentation
resolution_type: documentation_update
related_components:
  - development_workflow
  - tooling
  - frontend_stimulus
tags:
  - knowledge-mastery
  - learning-platform
  - tutor-adapter
  - ingest-telemetry
  - learning-workbench
  - quality-gates
---

# v1.7.0-to-head learning platform contract and workbench baseline

## Context

在 `v1.7.0`（2026-03-31）到 `HEAD`（2026-04-01）这段提交中，项目从“演进路线图”进入了“可执行学习闭环”阶段，累计引入 20+ 次连续增量，核心变化集中在学习域主干能力：

- 后端从基础能力扩展为完整学习 API 面，包括 ingest/query/mastery/path/session/tutor/memory/quality/governance。
- 学习图谱由内存态升级为本地可持久化存储，并支持重载与诊断。
- Path Mode 新增 Learning Workbench，支持执行学习计划、导师动作、复测流程和执行历史追踪。

这类改动不是单一 bug 修复，而是“跨后端契约 + 前端编排 + 治理可观测”的复合型迭代。若没有一份统一解法文档，团队后续会在接口一致性、证据可信性、回归验证范围上产生认知漂移。

## Guidance

1. 先固化契约，再扩展能力。

- 新能力优先进入统一接口与类型层，再接 UI。
- 以 [src/learning/api.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/learning/api.ts) 与 [src/learning/types.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/learning/types.ts) 为主契约，不在 UI 中定义“私有协议”。

2. 统一通过标准学习 API 面暴露能力，避免旁路。

- 服务器入口以 [src/server.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/server.ts) 下 `/api/knowledge/*` 为边界。
- 合同测试 [src/knowledge.api.contract.test.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/knowledge.api.contract.test.ts) 需要同步扩展，确保新增能力在契约层可见。

3. 导师与答案分析必须维持 evidence-first 降级策略。

- `TutorAction` 输出需要绑定证据与验证状态，不满足条件时降级为 `pending_verification`。
- 不将原始 LLM 输出直接作为学习真值写回掌握状态。

4. 会话执行走统一流水线，避免 session/retest/custom 分叉实现。

- 单动作、批量执行、答案分析、掌握更新、即时复测和历史记录保持同一执行模型。
- 复测计划应由执行结果自动生成，不由前端拼装业务规则。

5. 治理指标是“一等接口”，不是后补指标。

- 质量快照、趋势、阈值、runtime capability 与 query backend diagnostics 要与主流程并行输出。
- 仅看单次执行结果而忽略 trend/history，会导致策略调优失真。

## Why This Matters

- 可信性：证据链和验证状态把“能回答”与“可采信”区分开，减少学习建议幻觉。
- 稳定性：fallback、阈值门禁和趋势信号让系统在回退、降级、异常时可见可控。
- 可演进性：统一契约和执行流水线降低新增动作/模型/策略时的分叉成本。
- 协作效率：前后端共享类型和契约测试，减少“后端变了但工作台没跟上”的交付摩擦。

## When to Apply

- 新增或重构任意学习域接口（尤其是 session、tutor、memory、quality、governance）。
- 新接入 tutor provider/adapter 或调整 provider routing 逻辑。
- 引入 ingest diff、关系重算、批量执行与即时复测等跨模块能力。
- 需要把执行结果、质量趋势、运行时健康同时汇总到同一工作台。
- 出现“功能能跑，但不可解释/不可观测/不可审计”的信号时。

## Examples

### Example 1: 增量摄入 + 门禁评估

```http
POST /api/knowledge/ingest-diff
{
  "incremental": true,
  "relationRecomputeMode": "full",
  "operations": [
    {
      "op": "upsert",
      "document": {
        "documentId": "doc_a",
        "sourcePath": "Knowledge_Base/doc_a.md",
        "content": "# Topic A ..."
      }
    },
    {
      "op": "delete",
      "document": {
        "documentId": "doc_b"
      }
    }
  ]
}

POST /api/knowledge/ingest/guardrails/evaluate
{
  "thresholds": {
    "maxChangedDocuments": 2000,
    "maxIngestP95Ms": 5000
  }
}
```

### Example 2: 学习计划执行到即时复测

```http
POST /api/knowledge/session/plan
{
  "userId": "path_user_default",
  "focusAtomIds": ["atom_x"],
  "maxActions": 14,
  "includeDivergence": true,
  "includeRetrain": true
}

POST /api/knowledge/session/execute
{
  "userId": "path_user_default",
  "executionKind": "session",
  "sessionPlan": "...",
  "answersByActionId": {
    "action_1": "..."
  },
  "autoAnalyzeAnswer": true,
  "autoUpdateMasteryFromAnswer": true,
  "includeRetestPlan": true
}

POST /api/knowledge/session/history
{
  "userId": "path_user_default",
  "limit": 8
}
```

### Example 2b: Query backend runtime override (without mutating global config)

```http
POST /api/knowledge/query
{
  "query": "evidence-first retrieval",
  "topK": 5,
  "queryBackend": "keyword_only"
}
```

说明：
- `queryBackend` 支持请求级覆盖，仅影响当前查询。
- 全局配置仍通过 `/api/knowledge/query-backend-config` 管理。

### Example 3: Workbench 并行刷新编排

```text
/api/knowledge/session/plan
/api/knowledge/quality/snapshot
/api/knowledge/quality/history
/api/knowledge/quality/trend
/api/knowledge/mastery/misconceptions
/api/knowledge/state
/api/knowledge/session/history
/api/knowledge/tutor/catalog
/api/knowledge/query-backend-config
/api/knowledge/runtime-capability-matrix
```

## Related

- 关键实现与契约
  - [src/learning/KnowledgeLearningPlatform.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/learning/KnowledgeLearningPlatform.ts)
  - [src/learning/api.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/learning/api.ts)
  - [src/learning/types.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/learning/types.ts)
  - [src/learning/store.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/learning/store.ts)
  - [src/server.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/server.ts)
  - [src/frontend/path_app.js](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/frontend/path_app.js)
  - [src/frontend/path.html](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/frontend/path.html)
  - [src/knowledge.api.contract.test.ts](https://github.com/Jacobinwwey/NoteConnection/blob/main/src/knowledge.api.contract.test.ts)

- 路线与规划文档
  - [`en/knowledge_mastery_evolution_plan.md`](../../en/knowledge_mastery_evolution_plan.md)
  - [`zh/knowledge_mastery_evolution_plan.md`](../../zh/knowledge_mastery_evolution_plan.md)
  - [`diataxis/en/explanation/knowledge-mastery-evolution-roadmap.md`](../../diataxis/en/explanation/knowledge-mastery-evolution-roadmap.md)
  - [`diataxis/zh/explanation/knowledge-mastery-evolution-roadmap.md`](../../diataxis/zh/explanation/knowledge-mastery-evolution-roadmap.md)
  - [`brainstorms/2026-04-11-evolution-progress-alignment-requirements.md`](../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

- 发布基线
  - [`release_notes_v1.7.0.md`](../../release_notes_v1.7.0.md)

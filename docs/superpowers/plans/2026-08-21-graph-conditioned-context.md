# Graph-Conditioned Context Assembly Implementation Plan

> **Goal:** Make the existing graph answer plan an explicit, bounded input to evidence selection before answer synthesis, without breaking legacy response contracts or mobile packaging.

**Architecture:** Build a focused adapter that maps graph claims, supporting atoms, and relation edges to a deterministic RAG fragment order. Keep the generic RAG budgeter independent; it receives an internal selection order and emits an additive conditioning trace. The platform creates a pre-RAG plan for retrieval conditioning and continues to create the final evidence-backed plan for the public answer.

**Tech Stack:** TypeScript 5.9, Jest 30 with ts-jest, existing learning types and RAG assembler.

## Global Constraints

- Preserve legacy `assistantMessage`, public IDs, route paths, and existing `RagContextPack` fields.
- Graph conditioning is additive and deterministic; no LLM or new runtime dependency is introduced.
- Scope and source boundaries remain authoritative; conditioning may reorder evidence but may not add out-of-scope documents.
- Mobile uses the same bounded exact path and does not ship a second implementation.
- Every plan/progress document changed here contains separated English and Chinese sections.

## English

### Task 1: Conditioning contract and deterministic ordering

**Files:** Create `src/learning/graphConditionedContext.ts` and `src/learning/graphConditionedContext.test.ts`; modify `src/learning/types.ts` and `src/learning/ragContextPack.ts`.

- Add an additive `RagGraphConditioningTrace` with strategy, matched claim/fragment counts, selected atom IDs, selected edge IDs, and an explicit fallback reason.
- Add an internal fragment-order input to the RAG budgeter; it must only break ties after role and score priority.
- Add tests for required claim matches, relation-edge matches, deterministic tie ordering, and no-plan fallback.

### Task 2: Pre-RAG graph plan wiring

**Files:** Modify `src/learning/evidenceContextAssembler.ts`, `src/learning/conversationComposer.ts` only if types require it, and `src/learning/KnowledgeLearningPlatform.ts`; extend `src/learning/evidenceContextAssembler.test.ts`.

- Accept an optional graph plan/context in evidence assembly.
- Build a pre-RAG plan from the already scope-filtered knowledge points and graph context.
- Pass the plan through normal and recovery RAG assembly; keep the final composer plan evidence-backed.
- Assert that graph-neighbor fragments matching a planned atom/edge are preferred and the trace is exposed.

### Task 3: Regression and documentation

- Run focused learning tests, TypeScript no-emit, full Jest, build, and Diataxis checks.
- Update the bilingual progress documents with shipped behavior, limits, and the next pending migration gates.

## 中文

### 任务 1：图条件上下文契约与确定性排序

**文件：** 创建 `src/learning/graphConditionedContext.ts`、`src/learning/graphConditionedContext.test.ts`；修改 `src/learning/types.ts`、`src/learning/ragContextPack.ts`。

- 新增 additive `RagGraphConditioningTrace`，记录策略、命中 claim/fragment 数、选中的 atom/edge，以及明确的 fallback 原因。
- 为 RAG budgeter 增加内部 fragment 顺序输入；它只能在 role 与 score 相同的情况下打破平局。
- 覆盖 required claim、relation edge、确定性 tie 顺序和无 plan fallback。

### 任务 2：RAG 前图回答计划接入

**文件：** 修改 `src/learning/evidenceContextAssembler.ts`、必要时修改 `src/learning/conversationComposer.ts` 与 `src/learning/KnowledgeLearningPlatform.ts`；扩展 `src/learning/evidenceContextAssembler.test.ts`。

- 证据装配接受可选 graph plan/context。
- 使用已完成 scope 过滤的知识点和图上下文生成 pre-RAG plan。
- 普通与恢复 RAG 都传递该 plan；最终 composer 仍使用带证据的最终 plan。
- 验证匹配计划 atom/edge 的 graph-neighbor fragment 优先，并在 trace 中可见。

### 任务 3：回归与文档

- 运行 learning 定向测试、TypeScript no-emit、完整 Jest、build 与 Diataxis 检查。
- 在双语进度文档中记录已交付行为、边界和后续迁移门禁。

---
module: architecture
tags: [knowledge-workspace, dag, rag, agent, progress, compatibility, robustness]
problem_type: tracking
created: 2026-06-10
updated: 2026-06-10
status: active
version: 2026.06.10
---

# 2026-06-10 v1.7.0 - Knowledge Workspace and DAG Alignment Plan

## English Document

### Objective

This note records the current code-backed state of the Knowledge Workspace and the existing DAG-backed learning substrate, then reconciles that state against the earlier lightweight RAG, agent-workspace, and architecture-progress plans.

The purpose is to make three things explicit:

1. what is already implemented in the current codebase,
2. what still does not satisfy the intended Knowledge Workspace product behavior,
3. what the next robust, forward-compatible implementation order should be.

### Evidence Base

Primary code evidence reread for this alignment:

- `src/frontend/agent_workspace.js`
- `src/frontend/workspace_panes.js`
- `src/frontend/styles.css`
- `src/learning/conversationComposer.ts`
- `src/learning/KnowledgeLearningPlatform.ts`
- `src/learning/requestNormalization.ts`
- `src/learning/types.ts`
- `src/routes/knowledge.ts`
- `src/workflows/WorkflowArtifactStore.ts`
- `src/core/PathBridge.ts`

Planning and progress context reread for comparison:

- `docs/solutions/architecture-progress-alignment-2026-06-06.md`
- `docs/brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md`
- `docs/brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md`
- `docs/diataxis/en/explanation/development-progress-dashboard.md`
- `docs/diataxis/zh/explanation/development-progress-dashboard.md`

Current implementation pressure points measured from the workspace:

- `src/server.ts`: 15,850 lines
- `src/learning/KnowledgeLearningPlatform.ts`: 10,657 lines
- `src/frontend/agent_workspace.js`: 3,943 lines
- `src/frontend/workspace_panes.js`: 4,140 lines
- `src/learning/conversationComposer.ts`: 753 lines

### Current Code-Backed State

#### 1. Grounded conversation now has a real structured runtime surface

Current code no longer treats conversation output as one flat string only.

Implemented evidence:

- `AgentConversationResponse` carries:
  - `assistantMessage`
  - `answer`
  - `assistantBlocks`
  - `knowledgeRun`
  - `knowledgePoints`
  - `citations`
  - `recalledMemories`
  - `memoryActions`
  - `summary`
  - `trace`
- `conversationComposer.ts` owns grouped-knowledge-point composition and scoped reply synthesis instead of keeping all reply assembly permanently inline inside `KnowledgeLearningPlatform.ts`.
- `workspace_panes.js` can render:
  - `structured_answer`
  - `citations`
  - `knowledge_actions`
  - `knowledge_run_summary`
  - HTML artifacts

Progress call:

- This is no longer a plan-only surface.
- It is a code-backed additive compatibility surface.
- Legacy `assistantMessage` is still valid.

#### 2. Workflow artifacts are now a durable part of the learning loop

Current code has progressed beyond one-shot answer generation.

Implemented evidence:

- `WorkflowArtifactStore.ts` persists durable artifacts with:
  - `flashcard_batch`
  - `knowledge_run`
  - other workflow artifact kinds
- `KnowledgeLearningPlatform.ts` exposes `queryWorkflowArtifacts()`
- `routes/knowledge.ts` exposes:
  - `GET /api/knowledge/workflow-artifacts`
  - `POST /api/knowledge/workflow-artifacts/review-follow-up`
- `agent_workspace.js` now supports:
  - workflow artifact fetch
  - workflow artifact review follow-up
  - knowledge-run card/history/compare rendering paths

Progress call:

- Durable answer-adjacent artifacts are implemented.
- This is the strongest current substrate for future evidence-ledger and review-loop work.

#### 3. Knowledge-hit rendering is now file-first, but still not at the final target UX

Implemented evidence:

- `workspace_panes.js` renders grouped knowledge points as file-first cards.
- It can open source markdown previews through the shared markdown runtime.
- Graph-focus can render original markdown and highlight matched evidence.

But current code still behaves like this:

- left-side knowledge hits still support inline preview expansion,
- `autoExpandFirstPreview` is still wired from `agent_workspace.js`,
- typed capability actions are still visibly rendered on the left-side card,
- the answer area still renders developer/supporting blocks such as citations and knowledge-run summaries.

Progress call:

- The interaction has moved significantly toward the intended design.
- It is not yet aligned with the stricter target behavior of:
  - one targeted answer in the visible answer area,
  - left-side hit list as file-only entry points,
  - right-side pane as the canonical rendered-reading surface,
  - hidden supporting evidence/actions outside the primary answer area.

#### 4. The codebase already contains DAG-capable data, but the answer layer still underuses it

This is the most important architectural reconciliation point.

The current system already has:

- `KnowledgeAtom`
- `RelationEdge`
- `TemporalEdge`
- `KnowledgeQueryItem.relationPath`
- `KnowledgeQueryItem.temporalValidity`
- store-level path operations (`findPath`)
- mastery/path/session logic that already depends on prerequisite-style graph structure

But the current conversation path still mainly behaves like:

- retrieve ranked knowledge items,
- group them by document,
- summarize them into citations and sections,
- synthesize answer text from the strongest evidence snippet.

What is still missing:

- a graph-conditioned context assembly layer between retrieval and answer synthesis,
- explicit use of predecessor/successor chains in explanation policy,
- answer-time use of temporal replacement / supersession beyond diagnostics,
- a first-class graph explanation object that survives into the frontend.

Progress call:

- The DAG substrate is real.
- The answer surface is still mostly evidence-grouped text RAG, not DAG-native answer planning.

### Code-vs-Plan Reconciliation

| Requirement from prior plans | Current code reality | Status | Main gap |
|---|---|---|---|
| Rich grounded conversation with compatibility fallback | Implemented through `assistantMessage` + `answer` + `assistantBlocks` + `knowledgeRun` | Implemented baseline | Primary answer area still too crowded |
| Durable learning/review loop | Implemented through workflow artifacts, knowledge runs, review follow-up, flashcard batch persistence | Implemented baseline | Needs better frontend information architecture |
| File-first scoped knowledge hits | Implemented | Implemented baseline | Still not fully right-pane-first |
| Hide developer-heavy evidence from the main user-facing answer | Not fully implemented | Partial | Visible answer area still renders support blocks |
| Use current DAG as a first-class answer-planning substrate | Not fully implemented | Partial | Missing graph-conditioned context assembly layer |
| Ownership reduction in runtime and frontend hosts | Not complete | Behind target | `server.ts`, `KnowledgeLearningPlatform.ts`, `agent_workspace.js`, and `workspace_panes.js` still own too much |

### Current Risks

#### 1. Product-surface mismatch risk

The biggest current risk is not missing infrastructure.
It is mismatch between implemented surfaces and intended product behavior.

Examples:

- the backend can produce durable learning artifacts,
- but the frontend still exposes too much support detail in the same answer flow,
- which makes the product feel like a developer tool instead of a guided knowledge agent.

#### 2. False “graph-native” confidence risk

The project already has DAG-shaped data and learning-path logic.
That can create the false impression that the conversation system is already graph-native.

It is not yet graph-native in the answer-planning sense.
Today the graph mostly improves retrieval scoring and downstream learning workflows.
It does not yet control answer organization strongly enough.

#### 3. Ownership concentration risk

The new capabilities are real, but they are still concentrated in large owners:

- `KnowledgeLearningPlatform.ts`
- `agent_workspace.js`
- `workspace_panes.js`

Without a tighter owner split, every next improvement in answer policy, artifact rendering, or graph reasoning will keep increasing local complexity.

### Next Direction

#### P1: Answer-surface contraction

Make the primary visible answer area strictly user-facing.

Requirements:

- render only the targeted answer by default,
- keep `assistantBlocks` additive for compatibility,
- stop treating citations, knowledge-run summaries, and action hints as mandatory visible answer content.

This is a product-architecture step, not a transport step.

#### P2: Right-pane-first knowledge-hit interaction

Make left-side knowledge hits act as navigation entries, not mini readers.

Requirements:

- click hit -> open right-side pane,
- render original markdown there,
- highlight matched spans there,
- keep inline preview only as fallback or remove it after parity confirmation.

#### P3: Durable evidence/claim inspector

Use the existing workflow-artifact substrate instead of inventing a second evidence system.

Requirements:

- treat `knowledge_run` and `flashcard_batch` as the first durable evidence surfaces,
- give them a separate inspection path from the primary answer area,
- prepare the frontend for future evidence-ledger and challenge-loop work.

#### P4: DAG-aware context assembly

Add a dedicated layer between retrieval and answer synthesis.

Requirements:

- consume `relationPath`, `TemporalEdge`, and prerequisite structure explicitly,
- build anchor/support/path context before final answer synthesis,
- preserve additive response compatibility while introducing a richer internal context object.

This is the correct layer for “make the current DAG truly help the LLM.”

#### P5: Ownership reduction

Once P1-P4 semantics are stable, split owners further:

- conversation result policy,
- workflow artifact projection,
- knowledge-hit pane routing,
- graph-conditioned context assembly.

This should reduce future pressure on `KnowledgeLearningPlatform.ts` and frontend host files without introducing pass-through facades.

### Verification Position

Verified locally against the current code-backed slice:

- `npm.cmd exec -- tsc --noEmit`
- `node --check src/frontend/agent_workspace.js`
- `node --check src/frontend/workspace_panes.js`
- `npm.cmd exec -- jest src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts src/agent_workspace.frontend.test.ts src/knowledge.api.contract.test.ts src/routes/registry.contract.test.ts src/pathbridge.handshake.contract.test.ts src/server.port.fallback.contract.test.ts src/workflows/WorkflowArtifactStore.test.ts --runInBand --no-cache`

These checks validate that the current uncommitted implementation slice is internally consistent before it is promoted to `main`.

## 中文文档

### 目标

本文档记录当前知识工作区与现有 DAG 学习底座的真实代码状态，并将其与此前轻量 RAG、agent workspace、主线架构推进方案重新对齐。

目的是把三件事说清楚：

1. 当前代码里到底已经实现了什么，
2. 哪些点仍然没有达到预期中的知识工作区产品行为，
3. 后续应按什么顺序继续推进，才能保持向前兼容性与鲁棒性。

### 证据基线

本次重新核对的主要代码文件：

- `src/frontend/agent_workspace.js`
- `src/frontend/workspace_panes.js`
- `src/frontend/styles.css`
- `src/learning/conversationComposer.ts`
- `src/learning/KnowledgeLearningPlatform.ts`
- `src/learning/requestNormalization.ts`
- `src/learning/types.ts`
- `src/routes/knowledge.ts`
- `src/workflows/WorkflowArtifactStore.ts`
- `src/core/PathBridge.ts`

本次重新核对的规划与进度文档：

- `docs/solutions/architecture-progress-alignment-2026-06-06.md`
- `docs/brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md`
- `docs/brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md`
- `docs/diataxis/en/explanation/development-progress-dashboard.md`
- `docs/diataxis/zh/explanation/development-progress-dashboard.md`

当前工作区测得的实现压力点：

- `src/server.ts`: 15,850 行
- `src/learning/KnowledgeLearningPlatform.ts`: 10,657 行
- `src/frontend/agent_workspace.js`: 3,943 行
- `src/frontend/workspace_panes.js`: 4,140 行
- `src/learning/conversationComposer.ts`: 753 行

### 当前已落地的真实代码状态

#### 1. grounded conversation 已不再只是单一字符串输出

当前代码已经不再把 conversation output 只当成一段 answer 文本。

已实现证据：

- `AgentConversationResponse` 现在同时包含：
  - `assistantMessage`
  - `answer`
  - `assistantBlocks`
  - `knowledgeRun`
  - `knowledgePoints`
  - `citations`
  - `recalledMemories`
  - `memoryActions`
  - `summary`
  - `trace`
- `conversationComposer.ts` 已经接管 grouped knowledge point 与 scoped reply 的组装，不再把所有回复拼装逻辑都永久内联在 `KnowledgeLearningPlatform.ts` 中。
- `workspace_panes.js` 已经具备渲染：
  - `structured_answer`
  - `citations`
  - `knowledge_actions`
  - `knowledge_run_summary`
  - HTML artifact

进度判断：

- 这已经不是“计划中的接口面”。
- 它已经是代码支撑的、向前兼容的 conversation surface。
- legacy `assistantMessage` 仍然有效。

#### 2. workflow artifact 已经成为持久学习闭环的一部分

当前代码已经不再停留在“一次回答就结束”。

已实现证据：

- `WorkflowArtifactStore.ts` 已可持久化：
  - `flashcard_batch`
  - `knowledge_run`
  - 其他 workflow artifact 类型
- `KnowledgeLearningPlatform.ts` 已暴露 `queryWorkflowArtifacts()`
- `routes/knowledge.ts` 已暴露：
  - `GET /api/knowledge/workflow-artifacts`
  - `POST /api/knowledge/workflow-artifacts/review-follow-up`
- `agent_workspace.js` 已支持：
  - workflow artifact 拉取
  - workflow artifact review follow-up
  - knowledge-run card/history/compare 的结果呈现路径

进度判断：

- durable answer-adjacent artifact 已实现。
- 这是后续 evidence ledger 与 review-loop 最重要的当前基础设施。

#### 3. 知识命中已经是 file-first，但仍未达到最终目标交互

已实现证据：

- `workspace_panes.js` 已按文件优先方式渲染 grouped knowledge points。
- 它已能通过共享 markdown runtime 打开 source markdown 预览。
- graph-focus 已能渲染原始 markdown 并高亮命中段落。

但当前代码仍保留以下行为：

- 左侧知识命中仍支持 inline preview 展开，
- `agent_workspace.js` 仍通过 `autoExpandFirstPreview` 驱动首个预览自动展开，
- typed capability action 仍直接显示在左侧 knowledge card 上，
- 回答区仍会把 citation、knowledge run summary 等支持性块一起渲染出来。

进度判断：

- 交互已经明显朝目标方向推进。
- 但它还没有收敛到更严格的目标行为：
  - 用户可见回答区只保留一个 targeted answer，
  - 左侧命中列表仅作为文件入口，
  - 右侧 pane 才是权威阅读面，
  - supporting evidence / actions 默认不继续堆在主回答区。

#### 4. 现有代码已经有 DAG 结构数据，但回答层仍未充分利用

这是当前最关键的架构对齐点。

当前系统已经有：

- `KnowledgeAtom`
- `RelationEdge`
- `TemporalEdge`
- `KnowledgeQueryItem.relationPath`
- `KnowledgeQueryItem.temporalValidity`
- store 层 path 查询能力（`findPath`）
- 已经依赖 prerequisite 结构的 mastery/path/session 逻辑

但当前 conversation 主链路仍然主要是：

- 检索排序后的知识项，
- 按文档做 grouped knowledge points，
- 转成 citation 与 section 证据，
- 再从最强 evidence snippet 里合成回答文本。

仍缺少的层：

- retrieval 与 answer synthesis 之间的 graph-conditioned context assembly，
- explanation policy 对 predecessor / successor 链路的显式消费，
- 回答阶段对 temporal replacement / supersession 的更强利用，
- 可持续流入前端的 graph explanation object。

进度判断：

- DAG 底座是真的。
- 当前回答面仍主要是 evidence-grouped text RAG，而不是 DAG-native answer planning。

### 代码 / 方案对账结论

| 先前方案要求 | 当前代码现实 | 状态 | 主要缺口 |
|---|---|---|---|
| richer grounded conversation 且保留兼容 fallback | 已通过 `assistantMessage` + `answer` + `assistantBlocks` + `knowledgeRun` 落地 | 已实现基线 | 主回答区仍过于拥挤 |
| durable learning / review loop | 已通过 workflow artifact、knowledge run、review follow-up、flashcard batch 落地 | 已实现基线 | 前端信息架构仍需收敛 |
| file-first scoped knowledge hits | 已实现 | 已实现基线 | 仍未完全收敛为 right-pane-first |
| 主回答区不暴露开发者导向 evidence 细节 | 尚未完全实现 | 部分完成 | citations / knowledge run / actions 仍在主对话面可见 |
| 让现有 DAG 成为真正的一等回答规划底座 | 尚未完全实现 | 部分完成 | 缺 graph-conditioned context assembly 层 |
| 缩减运行时与前端宿主文件所有权压力 | 尚未完成 | 落后于目标 | `server.ts`、`KnowledgeLearningPlatform.ts`、`agent_workspace.js`、`workspace_panes.js` 仍过重 |

### 当前风险

#### 1. 产品面对齐风险

当前最大的风险已经不是“没有基础设施”，而是“已实现能力与预期产品行为不一致”。

例如：

- 后端已经能产出 durable learning artifact，
- 但前端仍把过多 supporting detail 暴露在同一主回答流里，
- 这会让产品更像开发者工具，而不是 guided knowledge agent。

#### 2. 假性 graph-native 信心风险

项目里已经存在 DAG 结构和 learning-path 逻辑，这很容易让人误以为 conversation 已经 graph-native。

其实还没有。

当前图结构更多是在：

- 改善 retrieval scoring，
- 支撑后续学习路径与 session workflow，

而不是强力控制 answer organization。

#### 3. 所有权集中风险

新能力是真实存在的，但它们仍集中在大 owner 中：

- `KnowledgeLearningPlatform.ts`
- `agent_workspace.js`
- `workspace_panes.js`

如果不继续做 owner 切分，后续任何关于 answer policy、artifact rendering、graph reasoning 的增强，都会继续把本地复杂度堆高。

### 后续推进方向

#### P1：收缩回答主表面

让主回答区严格回归用户面。

要求：

- 默认只显示 targeted answer，
- `assistantBlocks` 继续保持 additive compatibility，
- citation、knowledge run summary、action hint 不再视为必须出现在主回答面。

这是产品架构动作，不是传输层动作。

#### P2：命中交互改成 right-pane-first

让左侧知识命中只承担“导航入口”，而不是“迷你阅读器”。

要求：

- 点击命中 -> 打开右侧 pane，
- 在右侧渲染原始 markdown，
- 在右侧高亮 matched span，
- inline preview 在完成 parity 验证后降级为 fallback 或彻底退出主交互。

#### P3：建设 durable evidence / claim inspector

优先复用现有 workflow-artifact 底座，而不是再造一套第二证据系统。

要求：

- 把 `knowledge_run` 和 `flashcard_batch` 视为当前第一批 durable evidence surface，
- 让它们走与主回答区分离的 inspection path，
- 为后续 evidence ledger / challenge loop 做准备。

#### P4：补图结构上下文装配层

在 retrieval 与 answer synthesis 之间加入 dedicated layer。

要求：

- 显式消费 `relationPath`、`TemporalEdge` 和 prerequisite 结构，
- 在最终 answer synthesis 前先构建 anchor/support/path context，
- 在保持 additive response compatibility 的前提下引入更丰富的内部 context object。

这才是“让当前 DAG 真正帮助 LLM”的正确落点。

#### P5：继续缩减所有权压力

在 P1-P4 语义稳定后，继续做 owner 切分：

- conversation result policy，
- workflow artifact projection，
- knowledge-hit pane routing，
- graph-conditioned context assembly。

这能继续降低 `KnowledgeLearningPlatform.ts` 和大型前端宿主的长期维护压力，同时避免引入只转发调用的 facade。

### 当前验证位置

已在当前代码切片上完成本地核验：

- `npm.cmd exec -- tsc --noEmit`
- `node --check src/frontend/agent_workspace.js`
- `node --check src/frontend/workspace_panes.js`
- `npm.cmd exec -- jest src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts src/agent_workspace.frontend.test.ts src/knowledge.api.contract.test.ts src/routes/registry.contract.test.ts src/pathbridge.handshake.contract.test.ts src/server.port.fallback.contract.test.ts src/workflows/WorkflowArtifactStore.test.ts --runInBand --no-cache`

这些检查确认：当前未提交实现切片在推进到 `main` 前已经达到内部自洽状态。

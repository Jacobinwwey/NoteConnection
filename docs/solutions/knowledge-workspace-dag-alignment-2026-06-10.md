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
- `src/frontend/agent_workspace.js`: 3,961 lines
- `src/frontend/workspace_panes.js`: 4,084 lines
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

#### 3. Knowledge-hit rendering is now file-first and right-pane-first at the primary interaction layer

Implemented evidence:

- `workspace_panes.js` renders grouped knowledge points as file-first cards.
- clicking a file button now routes directly into graph focus through `openGraphFocusPane(buildKnowledgePointFocusPayload(item))`.
- inline previews and visible typed capability buttons no longer render in the primary hit list.
- Graph-focus can render original markdown and highlight matched evidence.
- `agent_workspace.js` no longer auto-expands the first knowledge preview and keeps the full conversation result plus grounding summary in runtime getters for follow-up flows.

Progress call:

- The primary interaction now matches the stricter target behavior:
  - one targeted answer in the visible answer area,
  - left-side hit list as file-only entry points,
  - right-side pane as the canonical rendered-reading surface,
  - supporting evidence/actions removed from the primary answer and hit-list surfaces.
- The remaining gap is not the primary interaction anymore.
- The remaining gap is the lack of a first-class secondary evidence/claim inspector for durable artifacts and reply grounding.

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
| Rich grounded conversation with compatibility fallback | Implemented through `assistantMessage` + `answer` + `assistantBlocks` + `knowledgeRun`, with the primary assistant area now limited to user-facing blocks (`structured_answer`, `main_markdown`, `html_artifact`) | Implemented current slice | Supporting artifacts still need a dedicated inspection surface |
| Durable learning/review loop | Implemented through workflow artifacts, knowledge runs, review follow-up, flashcard batch persistence | Implemented baseline | Needs better frontend information architecture |
| File-first scoped knowledge hits | Implemented and now routed directly into graph focus from file-only entries | Implemented current slice | Secondary evidence inspection still depends on separate follow-up surfaces |
| Hide developer-heavy evidence from the main user-facing answer | Implemented in the primary chat and hit-list surfaces | Implemented current slice | Supporting evidence currently lives behind explicit capability execution and runtime getters instead of a dedicated inspector UI |
| Use current DAG as a first-class answer-planning substrate | Not fully implemented | Partial | Missing graph-conditioned context assembly layer |
| Ownership reduction in runtime and frontend hosts | Not complete | Behind target | `server.ts`, `KnowledgeLearningPlatform.ts`, `agent_workspace.js`, and `workspace_panes.js` still own too much |

### Current Risks

#### 1. Secondary-surface drift risk

The biggest current product risk has shifted.
The primary answer surface is now much closer to the intended behavior, but the secondary inspection surfaces are not yet productized enough.

Examples:

- the backend can produce durable learning artifacts,
- the primary frontend no longer dumps support detail into the main answer flow,
- but durable evidence and grounding are still surfaced mainly through explicit capability execution and runtime state,
- which risks splitting the product into a clean user surface plus a developer-only inspection path.

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

Completed in the current slice.

Shipped characteristics:

- render only the targeted answer by default,
- keep `assistantBlocks` additive for compatibility,
- stop treating citations, knowledge-run summaries, and action hints as mandatory visible answer content,
- keep the full conversation payload available for explicit follow-up flows without re-expanding the primary answer area.

Follow-on requirement:

- keep this contract stable while the durable evidence inspector is introduced.

#### P2: Right-pane-first knowledge-hit interaction

Completed in the current slice.

Shipped characteristics:

- click hit -> open right-side pane,
- render original markdown there,
- highlight matched spans there,
- remove inline preview and visible capability clutter from the primary hit list.

Follow-on requirement:

- keep graph-focus as the canonical reading surface while adding durable evidence/claim inspection beside it rather than back inside the hit list.

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
- `npm.cmd run test:agent-workspace:contracts`

These checks validate that the current implementation slice is internally consistent before it is promoted to `main`.

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
- `src/frontend/agent_workspace.js`: 3,961 行
- `src/frontend/workspace_panes.js`: 4,084 行
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

#### 3. 知识命中在主交互层已经收敛为 file-first + right-pane-first

已实现证据：

- `workspace_panes.js` 已按文件优先方式渲染 grouped knowledge points。
- 点击文件按钮现在会通过 `openGraphFocusPane(buildKnowledgePointFocusPayload(item))` 直接路由到 graph focus。
- inline preview 与可见 typed capability 按钮已不再出现在主命中列表中。
- graph-focus 已能渲染原始 markdown 并高亮命中段落。
- `agent_workspace.js` 已不再自动展开首个 knowledge preview，并把完整 conversation result 与 grounding summary 保留在 runtime getter 中供 follow-up flow 使用。

进度判断：

- 当前主交互已经收敛到更严格的目标行为：
  - 用户可见回答区只保留一个 targeted answer，
  - 左侧命中列表仅作为文件入口，
  - 右侧 pane 才是权威阅读面，
  - supporting evidence / actions 已退出主回答区与主命中列表。
- 当前剩余缺口已不再是主交互本身。
- 当前剩余缺口是 durable artifact 与 reply grounding 还没有一等的次级 evidence / claim inspector。

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
| richer grounded conversation 且保留兼容 fallback | 已通过 `assistantMessage` + `answer` + `assistantBlocks` + `knowledgeRun` 落地，且主回答区已收缩为用户面块（`structured_answer`、`main_markdown`、`html_artifact`） | 当前切片已实现 | supporting artifact 仍需专门 inspection surface |
| durable learning / review loop | 已通过 workflow artifact、knowledge run、review follow-up、flashcard batch 落地 | 已实现基线 | 前端信息架构仍需收敛 |
| file-first scoped knowledge hits | 已实现，且现已通过文件入口直接路由到 graph focus | 当前切片已实现 | 次级 evidence inspection 仍依赖独立 follow-up surface |
| 主回答区不暴露开发者导向 evidence 细节 | 已在主对话面与主命中列表中实现 | 当前切片已实现 | supporting evidence 目前仍主要依赖显式 capability 执行与 runtime getter，而不是专用 inspector UI |
| 让现有 DAG 成为真正的一等回答规划底座 | 尚未完全实现 | 部分完成 | 缺 graph-conditioned context assembly 层 |
| 缩减运行时与前端宿主文件所有权压力 | 尚未完成 | 落后于目标 | `server.ts`、`KnowledgeLearningPlatform.ts`、`agent_workspace.js`、`workspace_panes.js` 仍过重 |

### 当前风险

#### 1. 次级表面漂移风险

当前最大的产品风险已经发生转移。
主回答面已经更接近预期，但次级 inspection surface 还不够产品化。

例如：

- 后端已经能产出 durable learning artifact，
- 主前端已经不再把 supporting detail 堆到同一主回答流里，
- 但 durable evidence 与 grounding 目前仍主要通过显式 capability 执行与 runtime state 暴露，
- 这会带来“用户面很干净，但 inspectability 更像开发者路径”的分裂风险。

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

当前切片已完成。

已交付特征：

- 默认只显示 targeted answer，
- `assistantBlocks` 继续保持 additive compatibility，
- citation、knowledge run summary、action hint 不再视为必须出现在主回答面，
- 完整 conversation payload 仍可用于显式 follow-up flow，而不会重新把主回答面撑开。

后续要求：

- 在引入 durable evidence inspector 时继续保持这个主回答面契约稳定。

#### P2：命中交互改成 right-pane-first

当前切片已完成。

已交付特征：

- 点击命中 -> 打开右侧 pane，
- 在右侧渲染原始 markdown，
- 在右侧高亮 matched span，
- inline preview 与可见 capability clutter 已退出主命中列表。

后续要求：

- 在后续加入 durable evidence / claim inspection 时，继续保持 graph-focus 是权威阅读面，而不是把复杂度重新塞回命中列表。

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
- `npm.cmd run test:agent-workspace:contracts`

这些检查确认：当前实现切片在推进到 `main` 前已经达到内部自洽状态。

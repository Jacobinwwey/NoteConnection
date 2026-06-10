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
- `src/frontend/agent_workspace.js`: 3,995 lines
- `src/frontend/workspace_panes.js`: 4,182 lines
- `src/learning/conversationComposer.ts`: 851 lines

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
  - workflow artifact result routing into the secondary evidence pane
- `workspace_panes.js` now exposes a dedicated `evidence` pane owner for:
  - grounding inspection
  - `flashcard_batch`
  - `knowledge_run`
  - `knowledge_run_history`
  - `knowledge_run_compare`

Progress call:

- Durable answer-adjacent artifacts are implemented.
- They now have a productized secondary inspection surface instead of depending only on visible chat cards or runtime getters.
- This is the strongest current substrate for future evidence-ledger and review-loop work.

#### 3. Knowledge-hit rendering is now file-first and right-pane-first at the primary interaction layer, and secondary evidence now has a pane-backed owner

Implemented evidence:

- `workspace_panes.js` renders grouped knowledge points as file-first cards.
- clicking a file button now routes directly into graph focus through `openGraphFocusPane(buildKnowledgePointFocusPayload(item))`.
- inline previews and visible typed capability buttons no longer render in the primary hit list.
- Graph-focus can render original markdown and highlight matched evidence.
- `agent_workspace.js` no longer auto-expands the first knowledge preview and keeps the full conversation result plus grounding summary in runtime getters for follow-up flows.
- the conversation API status strip now opens a grounding inspector in the evidence pane.
- `knowledge_run`, `knowledge_run_history`, `knowledge_run_compare`, and `flashcard_batch` inspections now open in the evidence pane instead of appending new primary chat cards.

Progress call:

- The primary interaction now matches the stricter target behavior:
  - one targeted answer in the visible answer area,
  - left-side hit list as file-only entry points,
  - right-side pane as the canonical rendered-reading surface,
  - supporting evidence/actions removed from the primary answer and hit-list surfaces.
- The secondary evidence/claim inspector is now real and pane-backed.
- The remaining gap is no longer the absence of a secondary owner.
- The remaining gap is extending this pane-backed inspection model into a broader durable evidence ledger and DAG-aware answer-planning flow.

#### 4. The codebase already contains DAG-capable data, and the answer layer has now started to consume it

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

What the current slice now adds:

- `AgentConversationKnowledgePoint` can now carry:
  - `relationPath`
  - `relationKinds`
  - `relationPathAtomIds`
  - `temporalValidity`
- `mergeAgentConversationKnowledgePoints()` now preserves grouped DAG evidence instead of dropping it at the conversation boundary.
- `buildScopedConversationReply()` now uses that grouped DAG evidence to:
  - summarize graph-supported relation kinds in `overviewMarkdown`,
  - surface graph-support sentences in `explanationMarkdown`,
  - add graph-aware next-action guidance when prerequisite chains or temporal validity warnings are present.

What is still missing:

- a dedicated graph-conditioned context assembly layer between retrieval and answer synthesis,
- richer use of predecessor/successor chains beyond top-level grouped relation hints,
- answer-time use of temporal replacement / supersession beyond warning text,
- a first-class graph explanation object that survives into the frontend as a durable inspection surface.

Progress call:

- The DAG substrate is real.
- The answer surface is no longer purely evidence-grouped text RAG.
- It now has a minimal DAG-aware planning slice.
- It is still not yet fully DAG-native answer planning.

### Code-vs-Plan Reconciliation

| Requirement from prior plans | Current code reality | Status | Main gap |
|---|---|---|---|
| Rich grounded conversation with compatibility fallback | Implemented through `assistantMessage` + `answer` + `assistantBlocks` + `knowledgeRun`, with the primary assistant area now limited to user-facing blocks (`structured_answer`, `main_markdown`, `html_artifact`) | Implemented current slice | Answer planning still underuses the DAG |
| Durable learning/review loop | Implemented through workflow artifacts, knowledge runs, review follow-up, flashcard batch persistence, and a pane-backed evidence inspector for durable artifact inspection | Implemented current slice | Still lacks a broader durable evidence ledger and challenge-loop product surface |
| File-first scoped knowledge hits | Implemented and now routed directly into graph focus from file-only entries | Implemented current slice | Graph-focus and evidence-pane cohesion now matters more than entry-point cleanup |
| Hide developer-heavy evidence from the main user-facing answer | Implemented in the primary chat and hit-list surfaces, with grounding and durable artifact inspection moved into a dedicated evidence pane | Implemented current slice | Secondary surfaces still share large frontend owners |
| Use current DAG as a first-class answer-planning substrate | `AgentConversationKnowledgePoint` now carries grouped `relationPath` / `relationKinds` / `relationPathAtomIds` / `temporalValidity`, and `conversationComposer.ts` now uses those signals in overview, explanation, and next-action guidance | Implemented partial slice | Missing a dedicated graph-conditioned context assembly layer and richer graph explanation object |
| Ownership reduction in runtime and frontend hosts | Not complete | Behind target | `server.ts`, `KnowledgeLearningPlatform.ts`, `agent_workspace.js`, and `workspace_panes.js` still own too much |

### Current Risks

#### 1. Secondary-surface cohesion risk

The biggest current product risk has shifted again.
The primary answer surface is now much closer to the intended behavior, and the secondary inspection surface is now real, but the split between graph focus and evidence inspection must stay coherent as the system grows.

Examples:

- the backend can produce durable learning artifacts,
- the primary frontend no longer dumps support detail into the main answer flow,
- durable evidence and grounding now have a pane-backed inspection surface,
- but graph focus, evidence inspection, and future DAG-aware answer-planning can still drift into overlapping owners if the next slice is not explicit.

#### 2. Halfway graph-native risk

The project already has DAG-shaped data and learning-path logic.
That can create the false impression that the conversation system is already graph-native.

It is no longer completely absent from answer planning, but it is still not graph-native in the full intended sense.
Today the graph now influences grouped explanation and next-step guidance.
It still does not control answer organization strongly enough to be treated as complete.

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

Completed in the current slice.

Shipped characteristics:

- treat `knowledge_run` and `flashcard_batch` as the first durable evidence surfaces,
- give them a separate inspection path from the primary answer area,
- expose grounding metadata through the same pane-backed inspection model,
- keep workflow-artifact review follow-up updating the evidence surface in place.

Follow-on requirement:

- grow this pane-backed owner into a broader durable evidence ledger without collapsing the primary answer surface back into a developer-heavy chat transcript.

#### P4: DAG-aware context assembly

Partially implemented in the current slice.

Shipped characteristics:

- grouped conversation knowledge points now retain `relationPath`, `relationKinds`, `relationPathAtomIds`, and `temporalValidity`,
- structured answer overview/explanation/next-actions now use those grouped DAG signals additively.

Remaining requirements:

- consume `relationPath`, `TemporalEdge`, and prerequisite structure explicitly,
- build anchor/support/path context before final answer synthesis,
- preserve additive response compatibility while introducing a richer internal context object.

This remains the correct layer for “make the current DAG truly help the LLM.”

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
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/agent_workspace.contract.parity.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/export/WorkspaceExportBundle.test.ts --runInBand --no-cache`
- `npm.cmd run build`

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
- `src/frontend/agent_workspace.js`: 3,995 行
- `src/frontend/workspace_panes.js`: 4,182 行
- `src/learning/conversationComposer.ts`: 851 行

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
  - workflow artifact 结果路由到次级 evidence pane
- `workspace_panes.js` 现已提供专门的 `evidence` pane owner，用于承接：
  - grounding inspection
  - `flashcard_batch`
  - `knowledge_run`
  - `knowledge_run_history`
  - `knowledge_run_compare`

进度判断：

- durable answer-adjacent artifact 已实现。
- 它们现在已经有了产品化的次级 inspection surface，而不再只依赖可见聊天卡片或 runtime getter。
- 这是后续 evidence ledger 与 review-loop 最重要的当前基础设施。

#### 3. 知识命中在主交互层已经收敛为 file-first + right-pane-first，次级 evidence 也已经有 pane-backed owner

已实现证据：

- `workspace_panes.js` 已按文件优先方式渲染 grouped knowledge points。
- 点击文件按钮现在会通过 `openGraphFocusPane(buildKnowledgePointFocusPayload(item))` 直接路由到 graph focus。
- inline preview 与可见 typed capability 按钮已不再出现在主命中列表中。
- graph-focus 已能渲染原始 markdown 并高亮命中段落。
- `agent_workspace.js` 已不再自动展开首个 knowledge preview，并把完整 conversation result 与 grounding summary 保留在 runtime getter 中供 follow-up flow 使用。
- conversation API 状态条现在可以打开 grounding inspector。
- `knowledge_run`、`knowledge_run_history`、`knowledge_run_compare` 与 `flashcard_batch` 检查现在都会打开 evidence pane，而不是继续向主聊天区附加新卡片。

进度判断：

- 当前主交互已经收敛到更严格的目标行为：
  - 用户可见回答区只保留一个 targeted answer，
  - 左侧命中列表仅作为文件入口，
  - 右侧 pane 才是权威阅读面，
  - supporting evidence / actions 已退出主回答区与主命中列表。
- 次级 evidence / claim inspector 已经真实存在，并且以 pane owner 形式落地。
- 当前剩余缺口不再是“没有二级 owner”，而是要把该 pane-backed inspection 模型继续扩展成更广义的 durable evidence ledger，以及 DAG-aware 的回答规划链路。

#### 4. 现有代码已经有 DAG 结构数据，而且回答层现在已经开始消费这些信号

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

当前切片新增的内容是：

- `AgentConversationKnowledgePoint` 现在可以携带：
  - `relationPath`
  - `relationKinds`
  - `relationPathAtomIds`
  - `temporalValidity`
- `mergeAgentConversationKnowledgePoints()` 现在不会在对话边界把这些 DAG 信号丢掉。
- `buildScopedConversationReply()` 现在会用这些 DAG 信号去：
  - 在 `overviewMarkdown` 中总结图关系类型，
  - 在 `explanationMarkdown` 中补充图支持句子，
  - 在存在 prerequisite 链或 temporal warning 时追加 graph-aware 的 next actions。

仍缺少的层：

- retrieval 与 answer synthesis 之间的专门 graph-conditioned context assembly，
- 对 predecessor / successor 链路更丰富的 explanation policy，
- 回答阶段对 temporal replacement / supersession 的更强利用，
- 能稳定流入前端的 graph explanation object。

进度判断：

- DAG 底座是真的。
- 当前回答面已经不再是纯 evidence-grouped text RAG。
- 它已经具备最小的 DAG-aware planning 切片。
- 但它仍不是完全意义上的 DAG-native answer planning。

### 代码 / 方案对账结论

| 先前方案要求 | 当前代码现实 | 状态 | 主要缺口 |
|---|---|---|---|
| richer grounded conversation 且保留兼容 fallback | 已通过 `assistantMessage` + `answer` + `assistantBlocks` + `knowledgeRun` 落地，且主回答区已收缩为用户面块（`structured_answer`、`main_markdown`、`html_artifact`） | 当前切片已实现 | 回答规划仍未充分利用 DAG |
| durable learning / review loop | 已通过 workflow artifact、knowledge run、review-follow-up、flashcard batch 与 pane-backed evidence inspector 落地 | 当前切片已实现 | 仍缺更广义的 durable evidence ledger 与 challenge-loop 产品面 |
| file-first scoped knowledge hits | 已实现，且现已通过文件入口直接路由到 graph focus | 当前切片已实现 | graph focus 与 evidence pane 的职责边界仍需持续保持清晰 |
| 主回答区不暴露开发者导向 evidence 细节 | 已在主对话面与主命中列表中实现，grounding 与 durable artifact 检查也已迁入专门的 evidence pane | 当前切片已实现 | 次级 surface 仍与大型前端宿主共享较多所有权 |
| 让现有 DAG 成为真正的一等回答规划底座 | `AgentConversationKnowledgePoint` 现已保留 grouped `relationPath` / `relationKinds` / `relationPathAtomIds` / `temporalValidity`，`conversationComposer.ts` 也已在 overview / explanation / next-actions 中消费这些信号 | 当前切片已部分实现 | 仍缺专门的 graph-conditioned context assembly 层与更丰富的 graph explanation object |
| 缩减运行时与前端宿主文件所有权压力 | 尚未完成 | 落后于目标 | `server.ts`、`KnowledgeLearningPlatform.ts`、`agent_workspace.js`、`workspace_panes.js` 仍过重 |

### 当前风险

#### 1. 次级表面协同风险

当前最大的产品风险又发生了转移。
主回答面已经更接近预期，次级 inspection surface 也已经真实存在，但 graph focus 与 evidence inspection 的协同边界必须在后续推进中持续保持清晰。

例如：

- 后端已经能产出 durable learning artifact，
- 主前端已经不再把 supporting detail 堆到同一主回答流里，
- durable evidence 与 grounding 现在已经有 pane-backed inspection surface，
- 但如果下一步不显式约束 owner，graph focus、evidence inspection 与未来 DAG-aware answer planning 仍可能重新出现职责重叠。

#### 2. 半程 graph-native 风险

项目里已经存在 DAG 结构和 learning-path 逻辑，这很容易让人误以为 conversation 已经 graph-native。

现在它已经不再完全缺席于回答规划，但仍没有达到最终目标。

当前图结构现在已经会影响：

- grouped explanation，
- graph-aware 的 next-step guidance，
- temporal warning 的显式暴露，

但它仍没有强力控制 answer organization 到可以视为“完成”的程度。

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

当前切片已完成。

已交付特征：

- 把 `knowledge_run` 和 `flashcard_batch` 视为当前第一批 durable evidence surface，
- 让它们走与主回答区分离的 inspection path，
- 让 grounding metadata 也走同一套 pane-backed inspection 模型，
- 让 workflow-artifact review follow-up 可以原位更新 evidence surface。

后续要求：

- 在不破坏主回答区契约的前提下，把这个 pane-backed owner 继续扩展成更广义的 durable evidence ledger。

#### P4：补图结构上下文装配层

当前切片已部分实现。

已交付特征：

- grouped conversation knowledge point 现在保留了 `relationPath`、`relationKinds`、`relationPathAtomIds` 与 `temporalValidity`，
- 结构化回答的 overview / explanation / next-actions 现在会加法式使用这些 DAG 信号。

剩余要求：

- 显式消费 `relationPath`、`TemporalEdge` 和 prerequisite 结构，
- 在最终 answer synthesis 前先构建 anchor/support/path context，
- 在保持 additive response compatibility 的前提下引入更丰富的内部 context object。

这仍然是“让当前 DAG 真正帮助 LLM”的正确落点。

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
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/agent_workspace.contract.parity.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/export/WorkspaceExportBundle.test.ts --runInBand --no-cache`
- `npm.cmd run build`

这些检查确认：当前实现切片在推进到 `main` 前已经达到内部自洽状态。

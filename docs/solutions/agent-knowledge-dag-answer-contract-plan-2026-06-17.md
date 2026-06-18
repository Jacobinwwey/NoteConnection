---
module: architecture
tags: [agent-workspace, dag, rag, graph-context, answer-contract, compatibility, robustness]
problem_type: implementation-plan
created: 2026-06-17
updated: 2026-06-17
status: active
version: 2026.06.17
---

# 2026-06-17 v1.7.0 - Agent Knowledge DAG Answer Contract Plan

## English Document

### Objective

This note updates the 2026-06-10 Knowledge Workspace / DAG alignment with the user's clarified requirement: the graph structure is this project's existing DAG-shaped structured knowledge data, not a generic graph database product.

The goal is to define the correct implementation direction for agent knowledge answers:

1. keep the public answer area focused on the user's question,
2. keep supporting evidence, graph traces, and developer/debug material in secondary panes and exportable traces,
3. make file hits reliably open the right-side focus pane with source markdown and matched-span highlighting,
4. stop treating the DAG as a shallow relation bonus and start using it as an answer-planning substrate,
5. preserve additive response compatibility and robustness while the architecture is tightened.

### First Principles

#### Term Definitions

- **DAG**: a directed acyclic graph. In this project it is a directed knowledge structure where nodes are concepts, notes, atoms, or indexed units, and edges encode ordered relationships such as prerequisite, reference, next step, supersession, or temporal replacement. The "acyclic" part matters because topological order and prerequisite chains only stay meaningful when cycles are either absent or explicitly handled.
- **KnowledgeAtom**: the learning-layer unit used by `src/learning/KnowledgeLearningPlatform.ts` and `src/learning/types.ts`. It is smaller and more queryable than a whole Markdown file.
- **RelationEdge**: a directed semantic edge between atoms. It carries relation kind, confidence, provenance, and evidence linkage.
- **TemporalEdge**: an edge describing validity over time, supersession, replacement, or expiry. It prevents the answer planner from treating stale knowledge as equally current.
- **EvidenceSpan**: a source-grounded text span that connects an atom or answer claim back to markdown content.
- **Anchor**: the primary atom or document selected as the center of the user's current question.
- **Support node**: an atom that is not the anchor but is needed to explain, justify, contrast, sequence, or qualify the answer.
- **Path**: an ordered sequence of atom IDs connected by directed edges. A path is not just "related content"; it is a claim about how concepts connect.
- **Predecessor**: a transitive upstream dependency of an anchor.
- **Successor**: a transitive downstream consequence or next-step node from an anchor.
- **Topological order**: an order of DAG nodes where prerequisites appear before dependent nodes.
- **GraphContextPack**: the bounded, deterministic graph-derived context passed to answer synthesis. It should contain anchor identity, selected support nodes, relation summaries, explicit paths, temporal warnings, and evidence spans. It must not be the whole graph.
- **Public answer**: the concise user-facing response.
- **Evidence pane**: the secondary UI surface where citations, graph context, durable artifacts, and developer-facing trace material can be inspected.
- **Developer trace**: the structured runtime/export payload used by developers and operators. It should remain available without crowding the public answer.

#### Layered Architecture

The project already has multiple graph-bearing layers. The implementation must respect the different responsibilities instead of collapsing them into one "RAG" box.

1. **Markdown source layer**
   - Owner: `Knowledge_Base`, `src/backend/FileLoader.ts`, markdown reader/runtime.
   - Responsibility: durable source text, frontmatter, links, headings, and evidence spans.
   - Boundary: file paths and source content must be canonical enough for right-pane rendering and highlighting.

2. **Graph build layer**
   - Owner: `src/backend/GraphBuilder.ts`, `src/core/Graph.ts`, `src/core/PathEngine.ts`, path workers.
   - Responsibility: build graph nodes/edges, dependency edges, inferred edges, layout ranks, predecessor/successor/path operations.
   - Boundary: this layer gives the project its structural DAG. It is not the same thing as an LLM prompt.

3. **Learning atom/relation layer**
   - Owner: `src/learning/KnowledgeLearningPlatform.ts`, `src/learning/types.ts`, `src/learning/store.ts`.
   - Responsibility: `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, `EvidenceSpan`, snapshots, graphdb/sqlite/file-backed ops, path queries through `findPath`.
   - Boundary: this is the correct layer for answer-time graph context because it has atom IDs, relation metadata, temporal state, and source evidence.

4. **Retrieval layer**
   - Owner: `src/learning/queryBackend.ts`.
   - Responsibility: produce candidate atoms using keyword/vector/hybrid scoring under scope constraints.
   - Current reality: the DAG mostly enters as connection-degree bonus (`0.08` in local hybrid, `0.06` in local vector) and relation-path hints after retrieval. That is useful, but it is not graph-native answer planning.

5. **Graph-conditioned context assembly layer**
   - Proposed owner: a new learning-domain owner, not `server.ts` and not the frontend.
   - Responsibility: turn retrieved candidates into a bounded `GraphContextPack` by selecting anchor, expanding predecessor/successor/path windows, applying temporal validity, attaching evidence spans, and enforcing a token/size budget.
   - Current 2026-06-17 slice: now advanced into a first-class owner by `src/learning/graphContextAssembler.ts`, which selects the anchor, reorders support nodes, carries explicit `connectionPaths`, adds bounded predecessor/successor windows, and records evidence refs plus graph diagnostics before answer synthesis.
   - The same slice protects the current graph substrate during read-side auto-save by merging still-valid store-side relation/temporal edges into rebuilt snapshots before persisting.
   - The same slice contracts the public `answer` / `directAnswer` string so it no longer embeds citation lists, connection paths, memory notices, or knowledge-run diagnostics.
   - Remaining gap: retrieval ranking still relies too heavily on shallow degree-style signals, and the right-pane source-focus path still needs explicit diagnostics for path/highlight mismatches.

6. **Answer synthesis layer**
   - Owner: `src/learning/conversationComposer.ts` plus future composer/assembler modules.
   - Responsibility: produce a targeted answer using the graph-conditioned context while keeping the public answer concise.
   - Boundary: answer synthesis may carry graph paths in typed structured sections and traces, but it must not dump evidence, relation summaries, and diagnostics into the public answer.

7. **UI and export layer**
   - Owner: `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/export/WorkspaceExportBundle.ts`.
   - Responsibility: public answer rendering, right-pane focus, evidence pane, durable artifacts, workspace export.
   - Boundary: the frontend should project structured payloads; it should not infer graph semantics from display strings.

### How the Layers Connect

The intended runtime flow should be:

1. User question arrives at `/api/knowledge/conversation`.
2. Scope is normalized once at the API/runtime edge.
3. Retrieval returns a limited set of atom/document candidates.
4. Graph-conditioned context assembly chooses the anchor and asks the learning graph for:
   - direct relations among candidates,
   - explicit paths between candidate atoms and anchor,
   - prerequisite predecessors,
   - successor/next-step nodes,
   - temporal validity and supersession details,
   - source evidence spans.
5. The assembler budgets and ranks the graph context.
6. The composer generates:
   - a concise public answer,
   - optional typed `assistantBlocks`,
   - `trace.graphContext`,
   - durable artifacts when needed.
7. The UI renders the public answer first.
8. File hits open the right pane with source markdown and matched highlights.
9. Evidence/graph/debug material stays in the evidence pane and export bundle.

This order matters. If graph expansion happens before scope normalization, it can leak out of the user's intended corpus. If graph expansion happens only after answer synthesis, the LLM cannot use the DAG to plan the answer. If graph expansion is unbounded, prompt size and latency will grow faster than answer quality.

### Current Code vs Requirements

| Requirement | Current code reality | 2026-06-17 status | Gap / risk |
|---|---|---|---|
| Public answer should answer the user's question, not list every internal artifact | `buildScopedConversationAnswer()` now returns a single targeted answer string; citation lists, graph paths, memory notices, and knowledge-run diagnostics stay in typed blocks, traces, panes, or exports. | Implemented current slice | Keep future DAG context from re-inflating the answer area. |
| Hide developer-heavy evidence and purple-box-style support material for now | Evidence pane and runtime/export traces carry supporting context. | Direction is correct | Any new graph details must default to secondary surfaces unless explicitly requested. |
| Clicking a file hit should open right-side content and highlight matched text | `workspace_panes.js` routes file entries through graph focus, reads markdown via storage, renders through shared markdown runtime, and highlights matched spans. | Implemented baseline | Failures usually come from path canonicalization, missing storage provider, stale runtime path, or snippet/highlight mismatch. Add diagnostics before rewriting the UI. |
| Use this project's existing DAG, not a generic graph database abstraction | `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, store ops, `findPath`, path/session logic, and `Graph.ts` DAG helpers already exist. | Confirmed | The prior "graph database + prompt framework" framing was too generic. |
| Let LLM inspect high-quality graph structure | 2026-06-17 code now uses `graphContextAssembler.ts` to choose the anchor, reorder support nodes, preserve explicit store path chains, add predecessor/successor windows, and expose graph diagnostics through trace/export/evidence pane. | Implemented P1 foundation | Graph-aware ranking features and graph-specific quality gates still need to build on this boundary. |
| Preserve compatibility | `assistantMessage` remains valid; new `graphContext.connectionPaths` is optional and additive; snapshot merging keeps existing relation/temporal edges only when both endpoints remain active. | Preserved | Keep optional fields optional in all clients and exports. Add edge ownership metadata before treating missing persisted edges as intentional deletes. |

### Open-Source Library Review Result

The referenced repositories were cloned under `ref/` and reviewed as design inputs:

| Project | Local ref | Useful pattern | What not to copy |
|---|---:|---|---|
| DSPy | `ref/dspy` `4987601` | Typed signatures, evaluable programs, optimizer mindset. Useful for defining `GraphContextPack -> Answer` as a measurable program. | Do not add a Python optimizer/runtime into the TypeScript/Tauri path just to rewrite prompts. |
| Guidance | `ref/guidance` `21b1d90` | Constrained generation and structured output discipline. Useful for strict JSON/section contracts. | Do not make prompt templating the graph reasoning layer. |
| Semantic Kernel | `ref/semantic-kernel` `13f812b` | Named prompt functions, execution settings, telemetry boundaries. | Do not import a broad orchestration framework when local owners already exist. |
| LangChain Core | `ref/langchain` `847312e` | Explicit runnable/pipeline composition and parser boundaries. | Avoid framework-wide abstractions that duplicate the existing platform/lifecycle code. |
| LiteLLM | `ref/litellm` `cf2db41` | Provider routing, fallback, and model-call boundary normalization. | Do not let provider routing decide graph semantics. |

Best conclusion: use these projects as architectural references, not runtime dependencies. The implementation should stay native to this codebase: TypeScript types, local graph store operations, optional JSON/schema-constrained model calls, and existing export/diagnostic surfaces.

### Concrete Implementation Plan

#### P0: Stabilize the current 2026-06-17 slice

Already advanced in the working tree:

- `AgentConversationGraphContext` now accepts optional `connectionPaths`.
- `KnowledgeLearningPlatform` can ask an ops-capable store for explicit paths between returned knowledge points and the anchor through `findPath`.
- `KnowledgeLearningPlatform` now preserves still-valid store-side relation/temporal edges while auto-saving rebuilt snapshots, so path enrichment can use externally improved DAG structure instead of being starved by a read-side persist.
- `conversationComposer` can mention explicit graph paths in structured answer sections while keeping the public `directAnswer` free of evidence/debug lists.
- `workspace_panes.js` renders connection paths in the evidence pane.
- `WorkspaceExportBundle` preserves connection paths in exported conversation graph context.
- Regression tests cover composer output, KLP path enrichment, evidence-pane rendering, locale keys, and export serialization.

This is a compatibility-safe improvement because all new fields are optional and additive.

#### P1: Extract a graph-conditioned context assembler

Landed in the current working tree as `src/learning/graphContextAssembler.ts`.

Inputs:

- normalized user question,
- resolved scope,
- retrieved `AgentConversationKnowledgePoint[]` or lower-level query candidates,
- atom/relation/temporal stores,
- budget options.

Outputs:

- `GraphContextPack` / existing `AgentConversationGraphContext` extension,
- selected anchor,
- reordered support nodes,
- explicit paths,
- predecessor/successor windows,
- temporal warnings,
- source evidence span references,
- diagnostics for missing graph data.

Implemented rules in the current slice:

- path depth is capped by default (`6`),
- support-node count is bounded by answer intent,
- explicit edge direction is preserved in every rendered path,
- graph ops failure falls open to retrieval-shaped graph context with diagnostics,
- predecessor/successor windows are bounded and stay in secondary evidence surfaces.

#### P2: Make retrieval graph-aware without overfitting to degree

Implemented foundation in the current working tree. `queryBackend.ts` no longer leans on raw relation-degree bonus as the main graph signal. The active bounded feature set now includes:

- candidate distance to title/document anchor,
- prerequisite depth relative to anchor,
- path existence and path confidence,
- temporal validity score,
- relation-kind intent match.

Current behavior:

- `local_hybrid` and `local_vector` infer title/document anchors from the query,
- graph bonuses are only applied when an anchor can be inferred,
- directed path confidence and prerequisite depth now reward structurally relevant support nodes,
- temporal invalidity now acts as a penalty instead of a blind positive freshness reward,
- unrelated high-degree hubs are no longer allowed to win just because they have many edges.

Remaining gap: the feature mix still needs calibration through graph-specific quality gates and more real-world ranking regressions.

#### P3: Keep answer-surface contraction strict

The public answer area should render:

- direct answer,
- minimal rationale if needed,
- one or two graph-derived ordering/path statements only when they change the answer.

Current baseline: the public `answer` / `directAnswer` string is intentionally narrow. Evidence lists, graph connection paths, temporal details, memory notices, and `knowledge_run` diagnostics are retained in `assistantBlocks`, `trace.graphContext`, evidence panes, durable artifacts, and workspace export rather than being concatenated into the visible answer.

The evidence pane should render:

- connection paths,
- relation summaries,
- temporal details,
- citations,
- workflow artifacts,
- developer trace diagnostics.

This separation solves the user's first and third concerns better than trying to tune one monolithic answer template.

#### P4: Harden right-pane source focus

First-pass diagnostics are now present in `workspace_panes.js` through graph-focus render diagnostics. The current controller records:

- requested `sourcePath`,
- markdown runtime availability,
- storage-provider availability,
- source read success,
- markdown render success or fallback,
- highlight-term count,
- highlighted node count,
- failure reason classification.

Expected failure classes remain:

- Windows path separator or KB-root prefix mismatch,
- `sourcePath` absent but citation/matchedSpan path present,
- snippet text normalized differently from rendered markdown,
- old runtime file path still used by a legacy entrypoint,
- markdown rendering succeeds but highlight terms are too narrow.

The best fix remains payload/path normalization plus highlight diagnostics, not a second rendering stack. Remaining gap: diagnostics are still mainly local to the graph-focus pane/controller path and should later feed broader operator-facing inspection surfaces.

#### P5: Add graph answer quality gates

The next test layer should not only assert that fields exist. It should test graph reasoning behavior:

- prerequisite questions include upstream path order,
- comparison questions preserve branch differences,
- stale/superseded nodes trigger temporal warnings,
- graph ops failure falls back to retrieval-only answer,
- oversized graphs are budgeted deterministically.

### Tradeoffs

- **Do not dump the DAG into prompts**: full graph context increases latency, cost, and hallucination surface. A bounded context pack is more reliable.
- **Do not replace retrieval with graph traversal**: lexical/semantic retrieval still finds the question target. DAG traversal should refine and explain, not blindly roam.
- **Do not depend on Python prompt frameworks in the app runtime**: they are useful research references, but the deployment target is TypeScript/Node/Tauri/Godot.
- **Do not overtrust inferred edges**: inferred links need provenance and confidence, especially when used to order learning explanations.
- **Do not hide graph context completely**: users do not need developer traces in the answer, but developers need them in evidence/export surfaces to debug behavior.

### Mental Model

Think of the answer pipeline as three separate decisions:

1. **Find the likely subject**: retrieval and scope resolution identify candidate atoms/documents.
2. **Place the subject inside the DAG**: graph context assembly decides what upstream, downstream, path, temporal, and evidence facts matter.
3. **Speak to the user**: answer synthesis uses the selected context but only shows what the user's question requires.

The model is not "RAG plus graph decorations." It is "retrieval finds candidates; DAG determines structural relevance; composition decides visible communication."

### Real Applications

- A "what is X?" question should answer X directly, then optionally state its immediate prerequisite if that prerequisite changes understanding.
- A "how do I learn X?" question should use topological order and prerequisites more heavily than citations.
- A "compare X and Y" question should find the nearest common ancestors, divergent successors, and relation kinds between the branches.
- A "is this still valid?" question should prioritize `TemporalEdge` and supersession over similarity score.
- A file hit click should open the source markdown because the user's inspection task is document reading, not graph debugging.

### Common Pitfalls

- Treating "we have graphdb/sqlite" as equivalent to "the answer is graph-native." Storage is not reasoning.
- Treating relation degree as knowledge quality. Degree is often a hub signal, not an answer signal.
- Losing directionality when formatting paths. `A -> prerequisite -> B` and `B -> prerequisite -> A` are different claims.
- Letting graph diagnostics leak into the public answer because the data is available.
- Creating a new facade that only forwards calls from `KnowledgeLearningPlatform` without owning invariants.
- Adding prompt frameworks before defining the local graph context contract.
- Ignoring temporal edges, which can make the system confidently explain obsolete knowledge.

### Five-Point Summary

1. The project already has a real DAG substrate; the missing piece has now moved from “extract the assembler” to “make ranking and quality gates graph-native.”
2. The public answer must stay targeted; this slice now keeps `answer` / `directAnswer` free of evidence/debug lists while preserving those details in evidence panes, traces, and exports.
3. The 2026-06-17 code slice now has a first-class assembler boundary with anchor/support/path/window decisions before answer synthesis, but ranking and quality gates are still partial.
4. The referenced open-source projects are best used as design patterns, not new runtime dependencies.
5. The next robust direction is graph-specific quality gates plus wider operator-facing diagnostics on top of the new assembler and graph-aware ranking boundaries.

## 中文文档

### 目标

本文档在 2026-06-10 知识工作区 / DAG 对齐基础上，按用户最新澄清更新方案：这里的图结构是本项目现有的 DAG 结构化知识数据，不是泛泛的图数据库产品。

本方案要解决的目标是：

1. 前端公开回答区只针对用户问题给出回答；
2. supporting evidence、graph trace、开发者/调试材料进入次级 pane 与可导出的 trace；
3. 文件命中项单击后稳定打开右侧 focus pane，并显示原始 markdown 与命中高亮；
4. 不再只把 DAG 当作浅层关系加分项，而是把它提升为 answer planning substrate；
5. 在演进过程中保持向前兼容与鲁棒性。

### 第一性原理

#### 术语定义

- **DAG**：有向无环图。在本项目中，它是由概念、笔记、atom、indexed unit 组成的有向知识结构，边表达 prerequisite、reference、next step、supersession、temporal replacement 等关系。无环约束很重要，因为拓扑顺序与先修链只有在环不存在或被显式处理时才可靠。
- **KnowledgeAtom**：`src/learning/KnowledgeLearningPlatform.ts` 与 `src/learning/types.ts` 使用的学习层知识单元，比整篇 Markdown 更小、更适合查询。
- **RelationEdge**：atom 之间的有向语义边，携带关系类型、置信度、provenance 与证据关联。
- **TemporalEdge**：描述有效期、替换、过期、supersession 的边，防止回答层把旧知识当成当前有效事实。
- **EvidenceSpan**：能把 atom 或回答 claim 连接回 markdown 原文的文本证据片段。
- **Anchor**：当前用户问题的主要 atom 或文档中心。
- **Support node**：不是 anchor，但用于解释、证明、对比、排序或限定回答的 atom。
- **Path**：由有向边连接起来的一组有序 atom ID。path 不是普通“相关内容”，而是关于概念如何连接的结构性声明。
- **Predecessor**：anchor 的传递上游依赖。
- **Successor**：anchor 的传递下游结果或下一步节点。
- **Topological order**：一种 DAG 节点顺序，保证先修节点出现在依赖它的节点之前。
- **GraphContextPack**：传给 answer synthesis 的有界、确定性图上下文。它应包含 anchor 身份、support nodes、relation summaries、explicit paths、temporal warnings、evidence spans。它绝不应该是整张图。
- **Public answer**：用户直接看到的简洁回答。
- **Evidence pane**：次级 UI 表面，用于查看 citation、graph context、durable artifact 与开发者 trace。
- **Developer trace**：给开发者和运维查看的结构化运行时/导出 payload。它应保留，但不应挤占公开回答区。

#### 分层架构

当前项目已经有多层携带图信息的结构。实现方案必须尊重这些层的职责，而不是全部塞进一个“RAG”概念里。

1. **Markdown 源层**
   - Owner：`Knowledge_Base`、`src/backend/FileLoader.ts`、markdown reader/runtime。
   - 职责：保存源文本、frontmatter、links、headings、evidence spans。
   - 边界：文件路径与源内容必须足够 canonical，右侧 pane 才能读取原文并高亮命中。

2. **图构建层**
   - Owner：`src/backend/GraphBuilder.ts`、`src/core/Graph.ts`、`src/core/PathEngine.ts`、path workers。
   - 职责：构建节点/边、dependency edge、inferred edge、layout rank、predecessor/successor/path 操作。
   - 边界：这一层给项目提供结构化 DAG，但它本身不是 LLM prompt。

3. **学习 atom / relation 层**
   - Owner：`src/learning/KnowledgeLearningPlatform.ts`、`src/learning/types.ts`、`src/learning/store.ts`。
   - 职责：维护 `KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、`EvidenceSpan`、snapshot、graphdb/sqlite/file-backed ops，以及 `findPath` 路径查询。
   - 边界：这是回答阶段图上下文的正确来源，因为这里有 atom ID、关系元数据、时序状态和源证据。

4. **检索层**
   - Owner：`src/learning/queryBackend.ts`。
   - 职责：在 scope 约束下，用 keyword/vector/hybrid scoring 产出候选 atom。
   - 当前现实：DAG 主要以 connection-degree bonus 进入排序（local hybrid 为 `0.08`，local vector 为 `0.06`），并在检索后提供 relation-path hints。这有价值，但还不是 graph-native answer planning。

5. **Graph-conditioned context assembly 层**
   - 建议 owner：新的 learning domain owner，不应放在 `server.ts` 或前端里。
   - 职责：把检索候选转成有界 `GraphContextPack`：选择 anchor，展开 predecessor/successor/path 窗口，应用 temporal validity，附加 evidence spans，并控制 token/size budget。
   - 当前 2026-06-17 切片：已经通过 `src/learning/graphContextAssembler.ts` 进入一等 owner 阶段，会在回答合成前选择 anchor、重排 support node、挂接显式 `connectionPaths`、补有界 predecessor/successor window，并记录 evidence ref 与 graph diagnostics。
   - 同一切片也保护了 read-side 自动保存路径：持久化重建 snapshot 前会合并仍然有效的 store 侧 relation/temporal edges，避免当前图底座被查询/对话读流程误删。
   - 同一切片还收缩了公开 `answer` / `directAnswer` 字符串，不再把 citation list、connection path、memory notice 或 knowledge-run diagnostics 拼进用户回答。
   - 剩余缺口：当前 retrieval ranking 仍过度依赖浅层信号，右侧 source focus 也还需要补路径 / 高亮诊断。

6. **回答合成层**
   - Owner：`src/learning/conversationComposer.ts` 以及后续 composer/assembler 模块。
   - 职责：用 graph-conditioned context 生成 targeted answer，同时保持公开回答简洁。
   - 边界：回答可以在 typed structured section 与 trace 中携带图路径，但不能把 evidence、relation summary 和 diagnostics 倒进公开回答区。

7. **UI 与导出层**
   - Owner：`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/export/WorkspaceExportBundle.ts`。
   - 职责：公开回答渲染、右侧 focus、evidence pane、durable artifact、workspace export。
   - 边界：前端应该投影结构化 payload，而不是从展示字符串里反推图语义。

### 各层如何连接

理想运行流程应是：

1. 用户问题进入 `/api/knowledge/conversation`。
2. API/runtime 边界一次性归一化 scope。
3. 检索返回有限 atom/document 候选。
4. Graph-conditioned context assembly 选择 anchor，并向 learning graph 查询：
   - 候选之间的直接关系；
   - 候选 atom 与 anchor 之间的显式路径；
   - prerequisite predecessors；
   - successor / next-step nodes；
   - temporal validity 与 supersession details；
   - source evidence spans。
5. assembler 对图上下文做预算控制与排序。
6. composer 生成：
   - 简洁 public answer；
   - 可选 typed `assistantBlocks`；
   - `trace.graphContext`；
   - 必要时的 durable artifacts。
7. UI 首先渲染 public answer。
8. 文件命中项打开右侧 pane，展示原始 markdown 与命中高亮。
9. evidence / graph / debug material 留在 evidence pane 与 export bundle。

这个顺序很关键。如果图扩展发生在 scope 归一化之前，就可能越过用户指定语料边界。如果图扩展只发生在回答合成之后，LLM 就无法用 DAG 规划回答。如果图扩展不设边界，prompt 体积与延迟会比答案质量涨得更快。

### 当前代码与要求对比

| 要求 | 当前代码现实 | 2026-06-17 状态 | 缺口 / 风险 |
|---|---|---|---|
| 公开回答区只回答用户问题，不罗列内部产物 | `buildScopedConversationAnswer()` 现在只返回单一 targeted answer 字符串；citation list、graph path、memory notice 与 knowledge-run diagnostics 保留在 typed blocks、trace、pane 或 export 中。 | 当前切片已实现 | 后续 DAG context 不能把回答区重新撑大。 |
| 暂时隐藏开发者导向 evidence 与紫框类 support material | evidence pane 与 runtime/export trace 已承接支持上下文。 | 方向正确 | 新增图细节默认应进次级 surface，除非用户显式要求。 |
| 文件命中单击后打开右侧内容并高亮命中 | `workspace_panes.js` 已通过 graph focus 路由文件项，读取 markdown，经共享 markdown runtime 渲染，并用 matched spans 高亮。 | 已实现基线 | 失败通常来自路径 canonicalization、storage provider 缺失、旧 runtime 路径、snippet/highlight 不匹配。应先加诊断而不是重写 UI。 |
| 使用项目现有 DAG，而不是泛图数据库抽象 | `KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、store ops、`findPath`、path/session logic、`Graph.ts` DAG helper 都已存在。 | 已确认 | 先前“图数据库 + prompt framework”的表述过泛。 |
| 让 LLM 查阅高质量图结构 | 2026-06-17 代码现在通过 `graphContextAssembler.ts` 在回答合成前选择 anchor、重排 support node、保留显式 store path chain、补 predecessor/successor window，并通过 trace/export/evidence pane 暴露 graph diagnostics。 | P1 基础已实现 | 仍需在这个边界之上补 graph-aware ranking feature 与图专项质量门禁。 |
| 保持兼容 | `assistantMessage` 仍有效；新增 `graphContext.connectionPaths` 是 optional additive field；snapshot merge 只在两端 atom 仍 active 时保留既有 relation/temporal edges。 | 已保持 | 所有客户端和导出路径都要继续把新增字段视为可选。后续需要 edge ownership metadata，才能区分“用户有意删除的边”和“外部增强但内存快照未携带的边”。 |

### 开源库研究结论

已将参考仓库 clone 到 `ref/` 并作为设计输入分析：

| 项目 | 本地 ref | 可借鉴模式 | 不应照搬的部分 |
|---|---:|---|---|
| DSPy | `ref/dspy` `4987601` | typed signature、可评测 program、optimizer 思维。适合把 `GraphContextPack -> Answer` 定义成可评测程序。 | 不应为了 prompt rewrite 把 Python optimizer/runtime 引入 TS/Tauri 主路径。 |
| Guidance | `ref/guidance` `21b1d90` | constrained generation 与结构化输出纪律。适合严格 JSON/section contract。 | prompt templating 不能替代图推理层。 |
| Semantic Kernel | `ref/semantic-kernel` `13f812b` | 命名 prompt function、execution settings、telemetry boundary。 | 本项目已有 local owner，不应引入宽框架编排。 |
| LangChain Core | `ref/langchain` `847312e` | 显式 runnable/pipeline composition 与 parser boundary。 | 避免引入会复制现有 platform/lifecycle 代码的框架级抽象。 |
| LiteLLM | `ref/litellm` `cf2db41` | provider routing、fallback、model-call boundary normalization。 | provider routing 不应决定图语义。 |

最佳结论：把这些项目当架构参考，而不是运行时依赖。实现应保持本项目原生：TypeScript 类型、本地图 store ops、可选 JSON/schema-constrained 模型调用、现有 export/diagnostics surfaces。

### 具体实施计划

#### P0：稳定当前 2026-06-17 切片

当前工作区已推进：

- `AgentConversationGraphContext` 现在支持可选 `connectionPaths`。
- `KnowledgeLearningPlatform` 可以通过 ops-capable store 的 `findPath` 查询返回 knowledge points 与 anchor 之间的显式路径。
- `KnowledgeLearningPlatform` 在自动保存重建 snapshot 时保留仍然有效的 store 侧 relation/temporal edges，让 path enrichment 能使用外部增强后的 DAG 结构，而不是被读路径持久化饿死。
- `conversationComposer` 可以在结构化回答 section 中引用 explicit graph path，同时保持公开 `directAnswer` 不包含 evidence/debug 列表。
- `workspace_panes.js` 会在 evidence pane 中渲染 connection paths。
- `WorkspaceExportBundle` 会在导出的 conversation graph context 中保留 connection paths。
- 回归测试覆盖 composer output、KLP path enrichment、evidence-pane rendering、locale keys 与 export serialization。

这是兼容安全的改进，因为所有新增字段都是 optional/additive。

#### P1：抽出 graph-conditioned context assembler

当前工作区已落地为 `src/learning/graphContextAssembler.ts`。

输入：

- 归一化后的用户问题；
- resolved scope；
- retrieved `AgentConversationKnowledgePoint[]` 或更底层 query candidates；
- atom/relation/temporal store；
- budget options。

输出：

- `GraphContextPack` / 现有 `AgentConversationGraphContext` 的扩展；
- selected anchor；
- 重排后的 support nodes；
- explicit paths；
- predecessor/successor windows；
- temporal warnings；
- source evidence span references；
- graph data 缺失诊断。

当前切片已实现的规则：

- 默认限制 path depth（当前为 `6`）；
- 按 answer intent 限制 support nodes；
- 每条渲染路径保留边方向；
- graph ops 不可用时 fail open 回到 retrieval-shaped graph context，并附带 diagnostics；
- predecessor/successor window 有界，并默认停留在次级 evidence surface。

#### P2：让 retrieval 真正 graph-aware，但不要过拟合 degree

当前工作区已经落下 P2 基础实现。`queryBackend.ts` 不再把原始 relation-degree bonus 当作主要图信号，而是改为有界图特征组合：

- candidate 到 title/document anchor 的距离；
- 相对 anchor 的 prerequisite depth；
- path existence 与 path confidence；
- temporal validity score；
- relation-kind intent match。

当前行为：

- `local_hybrid` 与 `local_vector` 会先从 query 中推断 title/document anchor；
- 只有当 anchor 可推断时，图加分才会介入；
- directed path confidence 与 prerequisite depth 会提升结构上真正相关的 support node；
- temporal invalidity 现在是惩罚项，而不是盲目的“新鲜度正奖励”；
- 与 anchor 无关的高出入度 hub 不会再仅靠边多而取胜。

剩余缺口：这套特征还需要通过图专项质量门禁和更多真实 ranking regression 继续校准。

#### P3：严格保持回答主表面收缩

公开回答区应渲染：

- direct answer；
- 必要时的最小 rationale；
- 只有当图路径会改变答案时，才显示一两句 graph-derived ordering/path statement。

当前基线：公开 `answer` / `directAnswer` 字符串刻意保持窄口径。evidence list、graph connection path、temporal detail、memory notice 与 `knowledge_run` diagnostics 会保留在 `assistantBlocks`、`trace.graphContext`、evidence pane、durable artifact 与 workspace export 中，而不是拼接进用户可见回答。

Evidence pane 应渲染：

- connection paths；
- relation summaries；
- temporal details；
- citations；
- workflow artifacts；
- developer trace diagnostics。

这种分离比继续调一个超大回答模板更能解决用户提出的第 1 点和第 3 点。

#### P4：加固右侧 source focus

第一层诊断已经落到 `workspace_panes.js` 的 graph-focus 渲染链路。当前 controller 会记录：

- requested `sourcePath`；
- markdown runtime availability；
- storage-provider availability；
- source read success；
- markdown render success / fallback；
- highlight-term count；
- highlighted node count；
- failure reason classification。

预期失败类型：

- Windows 路径分隔符或 KB-root 前缀不一致；
- `sourcePath` 缺失但 citation/matchedSpan path 存在；
- snippet 文本归一化方式与渲染后的 markdown 不一致；
- legacy entrypoint 仍在使用旧 runtime 文件；
- markdown 渲染成功，但 highlight terms 太窄。

最佳修复仍然更可能是 payload/path normalization + highlight diagnostics，而不是再造一套渲染栈。剩余缺口是这些诊断还主要停留在 graph-focus pane/controller 层，后续应继续接到更广的运维检查面。

#### P5：增加图回答质量门禁

下一层测试不应只断言字段存在，还要测图推理行为：

- prerequisite 问题应包含上游路径顺序；
- comparison 问题应保留分支差异；
- stale/superseded 节点应触发 temporal warnings；
- graph ops 失败时能回退 retrieval-only answer；
- oversized graph 经过确定性预算裁剪。

### 权衡

- **不要把整张 DAG 塞进 prompt**：全量图上下文会增加延迟、成本和幻觉面。有界 context pack 更可靠。
- **不要用图遍历替代检索**：lexical/semantic retrieval 仍负责找到问题目标。DAG traversal 应用于 refinement 和 explanation，而不是盲游图谱。
- **不要把 Python prompt framework 引入 app runtime**：它们适合作为研究参考，但部署目标是 TypeScript/Node/Tauri/Godot。
- **不要过度信任 inferred edges**：推断边必须带 provenance 与 confidence，尤其当它们用于排序学习解释时。
- **不要完全隐藏 graph context**：用户不需要在回答区看开发者 trace，但开发者需要在 evidence/export surface 中调试行为。

### 思维模型

把回答流水线拆成三个决策：

1. **找到可能的主体**：retrieval 与 scope resolution 识别 candidate atoms/documents。
2. **把主体放回 DAG**：graph context assembly 决定哪些 upstream、downstream、path、temporal、evidence facts 与当前问题有关。
3. **对用户表达**：answer synthesis 使用已选上下文，但只展示用户问题需要的内容。

这不是“RAG 加图装饰”。更准确地说，是“检索找候选；DAG 决定结构相关性；合成层决定可见表达”。

### 真实应用

- “what is X?” 应直接回答 X，只有当前置概念会改变理解时才补充一个直接 prerequisite。
- “how do I learn X?” 应更重地使用拓扑顺序与 prerequisites，而不是只堆 citation。
- “compare X and Y” 应找 nearest common ancestors、分叉 successors 和分支之间的 relation kinds。
- “is this still valid?” 应优先使用 `TemporalEdge` 与 supersession，而不是相似度分数。
- 文件命中项点击后应打开源 markdown，因为用户此时要做的是文档阅读，不是图调试。

### 常见误区

- 把“已经有 graphdb/sqlite”误认为“回答已经 graph-native”。存储不是推理。
- 把 relation degree 当成知识质量。degree 经常只是 hub 信号，不是答案信号。
- 格式化路径时丢掉方向。`A -> prerequisite -> B` 和 `B -> prerequisite -> A` 是不同声明。
- 因为图诊断数据已经存在，就把它泄漏到公开回答区。
- 新增只转发 `KnowledgeLearningPlatform` 调用、但不拥有不变量的 facade。
- 在定义本地图上下文契约前就引入 prompt framework。
- 忽略 temporal edges，导致系统自信解释过期知识。

### 五点总结

1. 项目已经有真实 DAG 底座；当前缺口已经从“抽出 assembler”转成“让 ranking 与质量门禁 graph-native”。
2. 公开回答必须保持 targeted；本切片已让 `answer` / `directAnswer` 不再携带 evidence/debug 列表，同时把这些细节保留在 evidence pane、trace 与 export。
3. 2026-06-17 代码切片已经有回答前的一等 assembler 边界，会做 anchor/support/path/window 决策，但 ranking 与质量门禁仍是部分实现。
4. 参考开源库更适合作为设计模式，不适合作为新的运行时依赖。
5. 下一步应把重心转到图专项质量门禁，以及更广的 operator-facing diagnostics，而不是继续停留在“有没有 assembler / 有没有 graph-aware ranking”这个层级。

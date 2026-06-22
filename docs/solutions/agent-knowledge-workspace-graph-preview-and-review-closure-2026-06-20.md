---
module: architecture
tags: [agent-workspace, knowledge-workspace, dag, graph-preview, answer-release-review, frontend, robustness, compatibility]
problem_type: implementation-plan
created: 2026-06-20
updated: 2026-06-22
status: completed
version: 2026.06.22
---

# 2026-06-20 v1.7.0 - Agent Knowledge Workspace Graph Preview and Review Closure

## English Document

### Objective

This note closes the latest Agent Knowledge Workspace alignment slice on `main`.
It reconciles the user's latest UI expectations with the already-landed DAG answer contract and final-answer review work:

1. the public answer stays targeted to the user's question instead of dumping retrieval evidence,
2. matched files are explicitly discoverable as clickable source entries without adding permanent instructional text to the workspace,
3. source clicks open the right focus pane and highlight the matched basis,
4. `Related Focus` hosts an isolated Knowledge Focus pane through the main graph's `getFocusModeProjection()` contract without reparenting the main `#graph-container`; pane-local double-clicks switch anchors or open Markdown inside the pane, high-density context nodes stay visible, and backend relation detail stays hidden unless Developer Mode is enabled,
5. `Learning Path` hosts the Godot Future Path contract in the Guided Learning pane by using the existing `Graph` / `PathEngine` `diffusion/core` and `treeLayout` flow for the resolved DAG node, then rendering it through a modular TreeRenderer-compatible `godot_future_path_renderer.js` surface; it keeps human graph labels visible and does not show the native Godot window by default,
6. the final public answer is reviewed before release by the local deterministic reviewer,
7. all added fields and UI surfaces remain optional, additive, and backward-compatible.

This is not a recommendation to introduce another RAG framework. The right owner is already inside this codebase: the existing DAG, the learning runtime, the answer composer/reviewer, the main graph Focus-mode semantics, and the Godot Future Path `treeLayout` contract.

### Completion Boundary

Current implementation status is code-backed:

- `src/learning/graphContextAssembler.ts` owns graph-conditioned context assembly before answer synthesis.
- `src/learning/conversationComposer.ts` calls `reviewAnswerRelease()` and releases `answerReleaseReview.publicAnswer`.
- `src/learning/answerReleaseReview.ts` owns deterministic public-answer gates, including graph-causal, graph-order, graph-comparison, temporal-validity, and query-intent gates.
- `src/frontend/workspace_panes.js` owns the Knowledge Workspace source focus pane, help affordance, matched-file action controls, hosted Focus projection pane, hosted Godot Future Path renderer surface, close controls, and provenance diagnostics.
- `src/frontend/godot_future_path_renderer.js` owns the modular TreeRenderer-compatible Future Path surface: 140x50 capsule nodes, Bezier skip-level edge filtering, active subtree hulls, spine expansion badges, hover subtree focus, word-preserving labels, and target-centered pane-local pan/zoom auto-fit hooks.
- `scripts/verify-agent-workspace-browser.js` owns the strict browser regression for the latest UI defects, including the `water glass.md` display case, hosted Focus anchor/context-density assertions for `water glass`, refusal to dock the main `#graph-container`, TreeRenderer marker/hull/viewport assertions, and refusal to show the native Godot window by default.
- `src/agent_workspace.frontend.test.ts` pins help-popover behavior, stable ARIA/control IDs, source highlight behavior, hosted Focus projection behavior, and Godot Future Path renderer semantics.

The remaining work is calibration and coverage expansion. It is not a blocker for this slice:

- older payloads without source offsets still need conservative fallback,
- the reviewer should keep expanding contradiction families only when false-positive boundaries are explicit,
- the Focus pane reuses the Focus-mode behavior contract without taking ownership of the main graph DOM; it renders a pane-local Focus surface backed by existing graph snapshot/resolve APIs and a pane-local Markdown reader,
- CI should keep the strict browser UI gate fresh if this surface continues changing.

### First Principles

#### Term Definitions

- **Public answer**: the final text displayed in the main answer area. It should answer the user's question directly and should not list citations, debug counters, graph traces, or planner state.
- **Secondary evidence surface**: any pane, card, export, trace, or diagnostic area that helps developers or advanced users inspect why an answer was produced.
- **Existing DAG**: this project's directed acyclic knowledge structure built from notes, atoms, relations, prerequisites, next-step edges, references, and temporal edges. It is not a generic graph database product.
- **Knowledge hit**: a matched document, concept, atom, or grouped source returned by the agent workspace query path.
- **Source provenance**: the path, line window, snippet, and optional source offsets that let the UI open the original Markdown and highlight the exact support fragment.
- **Graph context pack**: the bounded graph-derived structure assembled for answer synthesis. It contains anchor identity, support nodes, relation/path windows, temporal warnings, evidence refs, and diagnostics. It must not be the whole graph.
- **Answer release review**: the post-synthesis decision layer that can `release`, `revise`, or `abstain` before a draft becomes the public answer.
- **Hosted Focus pane**: rendering an isolated Focus-mode surface from the existing graph snapshot and node-resolution APIs. It preserves Focus-mode semantics while keeping the main graph lifecycle untouched; pane-local double-clicks either switch the focus anchor or open Markdown inside the pane-local reader.
- **Hosted Godot Future Path projection**: running the resolved DAG node through the existing frontend `Graph` / `PathEngine` `diffusion/core` path and projecting the resulting `treeLayout` into the Guided Learning pane. The pane deliberately does not mount browser `#path-container`, does not call bridge/Tauri `showGodot=true`, and does not require native window reparenting.
- **Resolved graph label**: the human-facing node name selected for display. In the reported failure this must be `water glass`, not an internal atom ID such as `atom_h`.

#### Layer Connections

The runtime should be read as a chain of owners:

1. **Markdown source layer**
   - Owns durable source text, filenames, headings, and raw snippets.
   - Required invariant: a knowledge hit must be traceable back to a canonical source path or a controlled fallback path.

2. **Graph build and DAG layer**
   - Owns graph nodes, edges, topological structure, predecessor/successor semantics, and graph-view data.
   - Required invariant: edge direction must remain meaningful. A prerequisite edge cannot be rendered as a symmetric "related" edge when it is used for learning guidance.

3. **Learning atom/relation layer**
   - Owns `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, evidence spans, scoped store operations, and graph-path lookup.
   - Required invariant: answer-time graph structure should come from typed runtime data, not from display strings scraped in the frontend.

4. **Graph context assembly layer**
   - Owns bounded graph-context selection for the LLM/composer.
   - Required invariant: the graph pack is scoped, budgeted, and explainable. It should include enough high-quality DAG structure for the answer, not the entire corpus.

5. **Answer synthesis layer**
   - Owns draft answer creation from scoped retrieval plus graph context.
   - Required invariant: draft generation can use evidence and graph paths, but the public answer should stay narrow unless the user asks to inspect supporting material.

6. **Answer release review layer**
   - Owns final release policy.
   - Required invariant: unsupported, contradictory, temporally stale, or diagnostic-leaking drafts must be revised or abstained before they hit the main answer surface.

7. **Frontend Knowledge Workspace layer**
   - Owns discoverability, source reading, source highlighting, right-pane lifecycle, and graph previews.
   - Required invariant: the UI projects structured state. It should not invent graph semantics from arbitrary text labels.

8. **Verification layer**
   - Owns regression evidence.
   - Required invariant: the exact failure class should be executable. Screenshots alone are not enough once the failure is understood.

### Current Code vs Prior Requirements

| Requirement | Current implementation evidence | Progress call | Remaining risk |
|---|---|---|---|
| Public answer should be targeted, not a list of every retrieved item | `conversationComposer.ts` releases `answerReleaseReview.publicAnswer`; graph/evidence detail stays in blocks, traces, panes, artifacts, and exports. | Implemented | Future prompt or composer changes can accidentally re-inflate the main answer. |
| Developer-heavy evidence and previously purple-box-style content should not pollute the main area | The runtime keeps graph context, citations, `knowledgeRun`, and reviewer state in secondary surfaces. | Implemented | Useful evidence can become invisible if there is no clear affordance to inspect it. |
| Matched files need a clear affordance that left-click opens source and highlights support | `workspace_panes.js` now uses a compact question-mark help control instead of permanent instructional text. | Implemented | Tooltip text must stay keyboard-accessible and must not reappear as static clutter. |
| Left matched-file area must be scrollable and show long names such as `water glass.md` | The strict browser verifier checks visible `water glass.md`, no horizontal overflow, and interactive action targets. | Implemented | Very long filenames still need truncation plus tooltip discipline, not layout expansion. |
| Clicking a hit should open right-side source and highlight matched evidence | Source pane logic uses source-line provenance, line windows, snippets, and offset-backed inline highlight where available. | Implemented baseline | Old payloads without offsets can only fall back conservatively. |
| Right-side source window needs a close control | The strict browser verifier asserts three close buttons across the affected right-pane surfaces. | Implemented | Future pane additions must not bypass the shared close-control pattern. |
| `Related Focus` should match Tauri Focus mode semantics | `workspace_panes.js` hosts a pane-local Focus-mode surface from `NoteConnectionGraphView.getFocusModeProjection()`, keeps the main `#graph-container` in its original parent, renders active Focus nodes plus high-density context dots/labels, switches the pane-local anchor on related-node double-click, and opens Markdown inside the pane-local reader on anchor double-click; relation diagnostics are Developer Mode only. | Implemented | This is projection/behavior-contract reuse, not DOM reuse. Any future attempt to reuse the live graph instance must first solve reader ownership and main-graph lifecycle isolation. |
| `Learning Path` should match Godot/Path mode semantics and use the real node name | `workspace_panes.js` resolves the selected DAG node, uses existing frontend `Graph` / `PathEngine` `diffusion/core` plus `getTreeLayout(..., focusMode=true)`, and renders the resulting tree through `godot_future_path_renderer.js`; the strict verifier checks `water glass` labels, TreeRenderer marker/hull/viewport state, and rejects browser `#path-container` docking and bridge/Tauri `showGodot=true`. | Implemented | This does not embed the native Godot window. Native window reparenting remains a separate platform spike, not a pane feature. |
| Existing DAG should be visible to the LLM and reviewer | `graphContextAssembler.ts` assembles `connectionPaths`, predecessor/successor windows, temporal validity, evidence refs, and diagnostics; reviewer graph gates consume DAG context. | Implemented baseline | Ranking and reviewer calibration still need broader corpora. |
| Final public answer needs robust review and correction | `answerReleaseReview.ts` owns deterministic release gates and is called before response release. | Implemented | Gate expansion must remain conservative to avoid false positives. |
| Compatibility must be preserved | New fields are optional/additive; legacy `assistantMessage` and existing answer fields remain valid. | Implemented | Contract drift can reappear if new clients treat optional fields as mandatory. |

### Why the Earlier Framework Options Are Not the Runtime Answer

The reference projects under `ref/` are useful, but they solve different layers:

| Reference | Useful pattern | Why it should not own this slice |
|---|---|---|
| DSPy | Typed LM programs, evaluation harnesses, optimizer loops. | It can help offline prompt/reviewer evaluation, but it should not become the source of truth for local DAG invariants in a TypeScript/Tauri runtime. |
| Guidance | Constrained generation and structured output control. | It shapes generated text, but it does not guarantee source-pane provenance, graph-mode projection, or release-worthiness. |
| Semantic Kernel | Prompt function boundaries, orchestration, telemetry concepts. | Importing a broad orchestration framework would duplicate local owners and increase integration surface. |
| LangChain Core | Runnable composition, parser boundaries, observability patterns. | Useful as a design reference, but it should not replace this project's existing learning runtime and graph context pack. |
| LiteLLM | Provider routing and model-call normalization. | Provider routing is orthogonal to DAG correctness, source highlighting, and final public-answer review. |

The better direction is local ownership with optional external evaluation:

- keep graph semantics in TypeScript types and store operations,
- keep release policy in the deterministic backend reviewer,
- keep model frameworks outside the hot path unless there is a measured reason,
- use reference libraries for evaluation, not as a substitute for invariants.

### Implementation Phases and Current Progress

#### P0: Public Answer Surface Contraction

Status: completed.

The main answer area now receives the release-reviewed public answer. Citation lists, graph paths, temporal warnings, reviewer details, and developer traces stay in structured surfaces. This is the right boundary: the user asked a question, not for a dump of every retrieved artifact.

Pitfall to avoid: do not "fix" sparse answers by appending evidence blocks to the public answer. That recreates the original defect under a different shape.

#### P1: DAG Context Assembly

Status: completed baseline.

`graphContextAssembler.ts` is the correct owner because it sits between retrieval and synthesis. It can see scoped candidates and graph operations before the answer is drafted. This is where predecessor windows, successor windows, connection paths, temporal validity, and evidence refs belong.

Tradeoff: the pack is bounded. Sending the whole graph would increase latency and confusion faster than it improves answer quality.

#### P2: Final Answer Release Review

Status: completed baseline.

`answerReleaseReview.ts` now owns the final release decision. Its value is not that it catches every semantic error. Its value is that public-answer correctness is no longer an accidental property of a prompt string.

Tradeoff: deterministic gates are narrower than a model verifier, but they are testable, low-latency, and auditable. A model verifier can be added later as a shadow signal only after the local gate contract is stable.

#### P3: Source Focus and Highlight Provenance

Status: completed baseline.

The right pane resolves candidate source paths, renders Markdown, selects the best evidence block, and projects inline highlights. Offset-backed provenance is preferred when available; line/snippet fallback keeps legacy payloads working.

Pitfall to avoid: do not relax the evidence gate because old payloads lack offsets. Missing provenance should be observable, not silently treated as correct.

#### P4: Matched-File Discoverability and Workspace Hygiene

Status: completed.

The matched-file area now has an explicit compact help affordance. The instructional copy is not permanently printed into the workspace. This matches the product requirement: discoverability without visual pollution.

Best practice: the help control must work on hover and focus, must close on blur/outside interaction, and must keep stable ARIA relationships so rerenders do not orphan the tooltip.

#### P5: Focus Runtime and Godot Future Path Reuse

Status: completed.

`Related Focus` hosts the selected node inside a Knowledge Focus pane without moving the main graph DOM. The pane uses the main graph's pure `getFocusModeProjection()` contract, renders the resolved node name, preserves Focus-mode density through active nodes plus background context dots/labels, supports double-click-to-switch on related nodes, and opens Markdown in a pane-local reader when the anchor is double-clicked. Relation-edge lists, relation kinds, and backend diagnostics are available only when Developer Mode is enabled.

`Learning Path` does not show Tauri/browser Learning Path and does not mount browser `path-container`. It resolves the selected hit to a DAG node, then uses existing frontend `Graph` / `PathEngine` with `diffusionLearning(target, 'core', ...)` and `getTreeLayout(..., focusMode=true, { verticalGap: 240 })`. The resulting tree is rendered by `godot_future_path_renderer.js`, a modular TreeRenderer-compatible surface that keeps Godot's capsule nodes, Bezier edge filtering, active subtree hulls, spine expansion badges, hover subtree focus, word-preserving labels, and pane-local pan/zoom auto-fit.

Tradeoff: a hosted Focus pane avoids stealing lifecycle ownership from the main Tauri graph, but it must explicitly preserve the interaction semantics and density the user expects from Focus mode. A hosted Future Path projection avoids native window reparenting and now reuses both the Godot-facing `treeLayout` contract and TreeRenderer semantics; pixel-perfect native Godot parity or true native window docking remains a dedicated renderer extraction or embedding project.

#### P6: Regression and Release Hygiene

Status: completed for this slice.

The current regression surface includes Jest contracts and a strict browser verifier that exercises the exact `water glass.md` UI failure. This matters because the most recent defects were not theoretical architecture issues; they were product-level mismatches in labels, scrollability, affordances, and pane lifecycle.

### Testing and Verification Snapshot

Fresh validation evidence for the current mainline includes:

- `npm run build`
- `npm test -- --runInBand`
- `npm run test:agent-workspace:contracts`
- `npm exec -- tsc --noEmit`
- `npm run build:vite`
- `node --check scripts/verify-agent-workspace-browser.js`
- strict browser verification through `scripts/verify-agent-workspace-browser.js`
- frontend law audit evidence under `output/agent-workspace-frontend-audit.*`

The strict browser case specifically verifies:

- `water glass.md` is visible as a matched file,
- the help text is hidden behind the question-mark affordance until hover/focus,
- `Learning Path` and `Related Focus` are interactive,
- action targets meet minimum hit-area expectations,
- there is no horizontal overflow,
- hosted Focus uses projection data, toolbar/control metadata, and a high-density background context-dot layer for target `water glass`,
- hosted Godot Future Path uses `diffusion/core`, `treeLayout`, and the modular TreeRenderer-compatible renderer for target `water glass`,
- Future Path preserves `water glass` as a word-preserving node label and exposes TreeRenderer hulls, expansion badges, and viewport auto-fit state,
- the browser `path-container` is not docked into the learning pane,
- bridge/Tauri `showGodot=true` is not called by the pane action,
- the real `#graph-container` stays in its original parent,
- default Related Focus does not display relation diagnostics unless Developer Mode is enabled,
- right-pane windows have close controls.

### Tradeoffs

- **Reuse contracts, not ownership by accident**: Focus reuses projection semantics without moving the main graph DOM; Future Path reuses the `Graph` / `PathEngine` / Godot `treeLayout` contract plus TreeRenderer-compatible rendering semantics instead of opening or embedding the native window by default.
- **Deterministic reviewer before model verifier**: less broad semantic coverage, but stable, testable release policy.
- **Bounded DAG pack over whole-graph prompt**: less complete context, but lower latency and lower hallucination risk.
- **Optional additive fields over mandatory schema break**: slower cleanup of legacy branches, but preserves existing clients.
- **Tooltip affordance over static instruction copy**: less always-visible guidance, but cleaner workspace and better scan density.

### Pitfalls

1. Rendering internal atom IDs when a human graph label is available.
2. Treating a graph database or prompt framework as a substitute for the existing DAG contract.
3. Putting instructional copy directly in the workspace because the click affordance is weak.
4. Reintroducing a handcrafted Path preview, browser Path mount, or native-window show side effect after the requirement has been clarified as hosted Godot Future Path contract and TreeRenderer-semantics reuse.
5. Expanding reviewer gates faster than the false-positive corpus.
6. Hiding missing provenance by broadening highlight heuristics until the UI "looks right".
7. Adding a facade that only forwards calls and owns no invariant.

### Next Direction

1. Broaden the answer-release contradiction corpus around real user failures: alias drift, cross-scope leakage, same-subject relation swaps, temporal drift, and graph-direction reversals.
2. Increase source-offset coverage for legacy payloads so repeated snippets can be disambiguated more often without heavier AST provenance.
3. Calibrate graph-aware ranking with real corpora before increasing relation-weight bonuses.
4. Extract frontend owners only when the new module owns a real invariant, for example graph-projection normalization or source-provenance selection.
5. Keep strict browser UI verification in CI for this surface if matched-file interactions continue evolving.

### Thought Model

Use three questions when changing this area:

1. **What is the public answer allowed to say?**
   - Owned by answer synthesis plus release review.
2. **What evidence and graph structure produced that answer?**
   - Owned by graph context assembly, traces, artifacts, panes, and exports.
3. **How does the user inspect the supporting source or graph context?**
   - Owned by source focus, matched-file controls, hosted Focus behavior, and hosted Godot Future Path projection.

Do not collapse these questions into one prompt or one frontend component. Each question has a different invariant and a different failure mode.

### Real Applications

- A user asks `什么是waterglass?`: the public answer should define the concept directly; the matched file should show `water glass.md`; source click should open the Markdown and highlight the support.
- A user wants to learn the selected node: `Learning Path` should host the Godot Future Path `diffusion/core/treeLayout` projection for the selected DAG node and keep visible node labels such as `water glass`.
- A user wants relation context: `Related Focus` should provide the same Focus-mode interaction model in the Knowledge Focus pane without stealing the main graph DOM or opening Markdown in the global reader.
- A developer audits a questionable answer: the reviewer result, graph context, citations, and provenance diagnostics should be available in secondary surfaces without polluting the public answer.

### Common Misreads

- "The UI shows graph buttons, so the LLM is graph-native."
  - Wrong. Graph-native answer planning requires graph context before synthesis and graph gates before release.
- "The answer is concise, so it is correct."
  - Wrong. Concision and correctness are separate invariants.
- "A prompt framework can solve final answer review."
  - Incomplete. It can shape drafts, but release policy still needs a local owner.
- "Side-pane Path/Focus must embed the real Godot/Tauri windows."
  - Too broad. Focus must preserve Focus-mode behavior in the pane, but moving the main graph DOM breaks ownership. Future Path currently reuses the Godot data contract through `treeLayout`; DOM/native embedding needs separate renderer extraction or native window reparenting work.
- "If the highlight is roughly near the right paragraph, provenance is good enough."
  - Not for repeated snippets. Offset or AST provenance is the durable fix.

### Five-Point Summary

1. The correct architecture is local DAG -> bounded graph context -> answer synthesis -> deterministic release review -> secondary evidence surfaces.
2. The latest UI slice now reuses real contracts: matched files are discoverable and clickable, source highlights work, Focus is hosted with pane-local interactions plus high-density context projection, Learning Path hosts the Godot Future Path `treeLayout` through the modular TreeRenderer-compatible renderer, labels stay human-readable, and right panes can close.
3. The earlier DSPy/Guidance/Semantic Kernel/LangChain/LiteLLM ideas remain useful references, but none should own DAG semantics, source provenance, or final release policy in this runtime.
4. The main remaining risk is calibration, not missing ownership: broader reviewer corpora, more offset coverage, and ranking evaluation are the next hard work.
5. Keep changes backward-compatible and invariant-owned; avoid pass-through layers, unbounded graph dumps, and UI-only correctness fixes.

## 中文文档

### 目标

本文收口 `main` 上最新一轮 Agent Knowledge Workspace 对齐工作。
它把用户最新 UI 期望与已经落地的 DAG 回答契约、最终回答审核机制对齐：

1. 公开回答只针对用户问题，不把检索证据堆进主回答区；
2. 命中文件必须有明确但克制的可点击提示；
3. 单击命中文件后打开右侧聚焦 pane，并高亮命中依据；
4. `关联聚焦` 在右侧知识聚焦 pane 内托管隔离的 Focus-mode 行为，不重挂载主 `#graph-container`；pane 内双击关联节点切换锚点，双击中心节点在 pane 内打开 Markdown，Developer Mode 关闭时隐藏后端 relation 细节；
5. `学习路径` 在引导式学习 pane 内托管 Godot Future Path 数据契约：复用现有 `Graph` / `PathEngine` 的 `diffusion/core` 与 `treeLayout` 流程解析目标 DAG 节点，保持人类可读图节点名可见，且默认不显示 Godot 原生窗口；
6. 最终公开回答必须先经过本地确定性 reviewer 再发布；
7. 新增字段与 UI surface 保持 optional、additive、向前兼容。

这不是引入另一套 RAG 框架的理由。正确 owner 已经在本项目内部：现有 DAG、learning runtime、answer composer/reviewer、主图 Focus-mode 语义，以及 Godot Future Path 的 `treeLayout` 契约。

### 完成边界

当前实现已经有代码证据：

- `src/learning/graphContextAssembler.ts` 在回答合成前持有 graph-conditioned context assembly。
- `src/learning/conversationComposer.ts` 调用 `reviewAnswerRelease()`，并发布 `answerReleaseReview.publicAnswer`。
- `src/learning/answerReleaseReview.ts` 持有确定性公开回答门禁，包括 graph-causal、graph-order、graph-comparison、temporal-validity 与 query-intent 门禁。
- `src/frontend/workspace_panes.js` 持有 Knowledge Workspace 的 source focus pane、帮助提示、命中文件 action、托管 Focus pane、托管 Godot Future Path 投影、关闭控件与 provenance 诊断。
- `scripts/verify-agent-workspace-browser.js` 固定了最新 UI 缺陷的严格浏览器回归，包括 `water glass.md` 展示案例、托管 Focus anchor 必须为 `water glass`、拒绝停靠主 `#graph-container`、以及默认拒绝显示 Godot 原生窗口。
- `src/agent_workspace.frontend.test.ts` 固定 help popover、稳定 ARIA/control ID、source highlight 与 path role 渲染。

剩余工作属于校准和覆盖扩展，不是本切片阻塞项：

- 旧 payload 缺少 source offset 时仍只能保守回退；
- reviewer 只能在 false-positive 边界清晰时继续扩展矛盾族群；
- Focus pane 复用 Focus-mode 行为契约，而不接管主图 DOM 生命周期；它通过现有 graph snapshot/resolve API 与 pane-local Markdown reader 渲染局部 Focus surface；
- 如果该 surface 后续持续变化，应继续把 strict browser UI gate 固化到 CI。

### 第一性原理

#### 术语定义

- **公开回答**：主回答区最终展示给用户的文本。它应直接回答问题，不应列出 citation、debug counter、graph trace 或 planner state。
- **次级证据 surface**：pane、card、export、trace、diagnostic 等用于开发者或高级用户检查回答来源的区域。
- **现有 DAG**：本项目由 note、atom、relation、prerequisite、next-step、reference、temporal edge 组成的有向无环知识结构。它不是泛化图数据库产品。
- **知识命中**：agent workspace 查询返回的命中文档、概念、atom 或聚合 source。
- **源 provenance**：让 UI 能打开原始 Markdown 并高亮支持片段的 path、line window、snippet 与可选 source offset。
- **Graph context pack**：回答合成前装配出的有界图上下文，包含 anchor、support node、relation/path window、temporal warning、evidence ref 与 diagnostics。它不应该是整张图。
- **回答发布审核**：draft answer 进入公开回答前的后置决策层，可以 `release`、`revise` 或 `abstain`。
- **托管 Focus pane**：从现有 graph snapshot 与 node-resolution API 渲染隔离的 Focus-mode surface。它保留 Focus-mode 语义，同时不接管主图生命周期；pane 内双击要么切换 focus anchor，要么在 pane-local reader 中打开 Markdown。
- **托管 Godot Future Path 投影**：将解析后的 DAG 节点送入现有前端 `Graph` / `PathEngine` 的 `diffusion/core` 路径，并把生成的 `treeLayout` 投影到引导式学习 pane。该 pane 刻意不挂载浏览器 `#path-container`，不调用 bridge/Tauri `showGodot=true`，也不要求 native window reparenting。
- **解析后的图标签**：用于展示的人类可读节点名。报告中的失败点要求显示 `water glass`，而不是 `atom_h` 这类内部 atom ID。

#### 各层连接

运行时应被理解为一串 owner：

1. **Markdown source 层**
   - 持有持久源文本、文件名、标题与原始 snippet。
   - 必要不变量：knowledge hit 必须能追溯到 canonical source path 或受控 fallback path。

2. **Graph build 与 DAG 层**
   - 持有图节点、边、拓扑结构、predecessor/successor 语义与 graph-view 数据。
   - 必要不变量：边方向必须有意义。用于学习引导的 prerequisite edge 不能被渲染成对称的 related edge。

3. **Learning atom/relation 层**
   - 持有 `KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、evidence span、scoped store operation 与 graph-path lookup。
   - 必要不变量：answer-time graph structure 应来自 typed runtime data，而不是前端从展示字符串里反推。

4. **Graph context assembly 层**
   - 持有给 LLM/composer 使用的有界图上下文选择。
   - 必要不变量：graph pack 必须受 scope 约束、有预算、可解释。它应该提供高质量 DAG 结构，而不是整库倾倒。

5. **Answer synthesis 层**
   - 持有基于 scoped retrieval 与 graph context 的 draft answer。
   - 必要不变量：draft 可以使用 evidence 与 graph path，但公开回答只展示用户当前问题需要的内容。

6. **Answer release review 层**
   - 持有最终发布策略。
   - 必要不变量：unsupported、contradictory、temporally stale 或 diagnostic-leaking 的 draft 必须在进入主回答区前被改写或拒答。

7. **前端 Knowledge Workspace 层**
   - 持有 discoverability、source reading、source highlighting、右侧 pane 生命周期与 graph preview。
   - 必要不变量：UI 投影结构化状态，不从任意文本标签发明图语义。

8. **验证层**
   - 持有回归证据。
   - 必要不变量：理解后的失败类别必须可执行验证。单独截图不足以作为长期验收。

### 当前代码与先前要求对比

| 要求 | 当前实现证据 | 进度判断 | 剩余风险 |
|---|---|---|---|
| 公开回答应针对问题，不罗列所有命中项 | `conversationComposer.ts` 发布 `answerReleaseReview.publicAnswer`；graph/evidence 细节留在 block、trace、pane、artifact 与 export 中。 | 已实现 | 后续 prompt 或 composer 变更可能重新撑大主回答。 |
| 开发者导向 evidence 与紫框类内容不应污染主区域 | runtime 将 graph context、citation、`knowledgeRun`、reviewer state 放在次级 surface。 | 已实现 | 如果没有明确查看入口，有用证据可能变得不可发现。 |
| 命中文件需要明确提示左键可打开源文档并高亮依据 | `workspace_panes.js` 使用紧凑问号帮助控件，而不是永久显示说明文字。 | 已实现 | tooltip 必须保持键盘可访问，且不能回退成静态污染文案。 |
| 左侧命中文件区域要可滚动，并完整处理 `water glass.md` 这类长名称 | strict browser verifier 检查 `water glass.md` 可见、无水平溢出、action target 可交互。 | 已实现 | 极长文件名仍要靠截断与 tooltip，而不是撑开布局。 |
| 单击命中项应打开右侧源文档并高亮命中依据 | source pane 使用 source-line provenance、line window、snippet，并在可用时使用 offset-backed inline highlight。 | 已实现基线 | 旧 payload 没有 offset 时只能保守回退。 |
| 右侧打开窗口需要关闭按钮 | strict browser verifier 检查相关右侧 pane surface 上有 3 个 close button。 | 已实现 | 后续新增 pane 不能绕开共享关闭控件模式。 |
| `关联聚焦` 应对应 Tauri Focus mode 语义 | `workspace_panes.js` 为解析后的节点托管 pane-local Focus-mode surface，保持主 `#graph-container` 留在原父节点，双击关联节点只切换 pane-local anchor，双击中心节点在 pane-local reader 内打开 Markdown；relation 诊断仅 Developer Mode 可见。 | 已实现 | 这是行为契约复用，不是 DOM 复用。未来如果要复用 live graph instance，必须先解决 reader 归属和主图生命周期隔离。 |
| `学习路径` 应对应 Godot/Path mode 语义，并显示真实节点名称 | `workspace_panes.js` 解析选中 DAG 节点后，复用现有前端 `Graph` / `PathEngine` 的 `diffusion/core` 与 `getTreeLayout(..., focusMode=true)` 托管 Godot Future Path 投影；strict verifier 检查 `water glass` label，并拒绝浏览器 `#path-container` 停靠和 bridge/Tauri `showGodot=true`。 | 已实现 | 这不嵌入 Godot 原生窗口。native window reparenting 是单独的平台 spike，不是 pane 功能。 |
| 现有 DAG 应进入 LLM 与 reviewer | `graphContextAssembler.ts` 装配 `connectionPaths`、predecessor/successor window、temporal validity、evidence ref 与 diagnostics；reviewer 图门禁消费 DAG context。 | 已实现基线 | ranking 与 reviewer 校准仍需更广语料。 |
| 最终公开回答需要鲁棒审核与纠错 | `answerReleaseReview.ts` 持有确定性 release gate，并在 response release 前执行。 | 已实现 | gate 扩展必须保守，避免误报。 |
| 必须保持向前兼容 | 新字段 optional/additive；legacy `assistantMessage` 与既有 answer 字段继续有效。 | 已实现 | 如果新客户端把 optional 字段当 mandatory，contract drift 会复发。 |

### 为什么先前框架方案不是运行时答案

`ref/` 下的参考项目有价值，但它们解决的是不同层：

| 参考 | 可借鉴模式 | 为什么不应持有本切片 |
|---|---|---|
| DSPy | typed LM program、evaluation harness、optimizer loop。 | 可用于离线 prompt/reviewer 评估，但不应成为 TypeScript/Tauri runtime 中本地 DAG 不变量的事实源。 |
| Guidance | constrained generation 与结构化输出控制。 | 它能约束生成文本，但不保证 source-pane provenance、graph-mode projection 或 release-worthiness。 |
| Semantic Kernel | prompt function boundary、orchestration、telemetry 概念。 | 引入宽编排框架会复制本地 owner，并扩大集成面。 |
| LangChain Core | runnable composition、parser boundary、observability 模式。 | 可作为设计参考，但不应替换本项目已有 learning runtime 与 graph context pack。 |
| LiteLLM | provider routing 与 model-call normalization。 | provider routing 与 DAG 正确性、source highlighting、最终回答审核是正交问题。 |

更好的方向是本地 owner 加可选外部评估：

- 图语义保留在 TypeScript 类型与 store operation 中；
- release policy 保留在后端确定性 reviewer 中；
- model framework 只有在有量化理由时才进入热路径；
- 参考库用于 evaluation，而不是替代不变量。

### 实施阶段与当前进度

#### P0：公开回答面收缩

状态：已完成。

主回答区现在接收经过 release review 的公开回答。citation list、graph path、temporal warning、reviewer detail 与 developer trace 保留在结构化 surface。这个边界是正确的：用户问的是问题，不是要看所有检索产物。

要避免的坑：不要用“把 evidence block 拼回公开回答”来修复答案稀疏。这会用另一种形状复现原始缺陷。

#### P1：DAG context assembly

状态：已完成基线。

`graphContextAssembler.ts` 是正确 owner，因为它位于 retrieval 与 synthesis 之间。它能在回答起草前看到 scoped candidates 与 graph operations。predecessor window、successor window、connection path、temporal validity 与 evidence ref 都应该在这里形成。

权衡：graph pack 是有界的。把整张图塞进 prompt 只会让延迟和混乱增长得比答案质量更快。

#### P2：最终回答发布审核

状态：已完成基线。

`answerReleaseReview.ts` 现在持有最终发布决策。它的价值不是“捕获所有语义错误”，而是公开回答正确性不再是 prompt 文本的偶然结果。

权衡：确定性 gate 比模型 verifier 窄，但可测试、低延迟、可审计。模型 verifier 未来可以作为 shadow signal，但前提是本地 gate contract 稳定。

#### P3：Source focus 与高亮 provenance

状态：已完成基线。

右侧 pane 会解析候选 source path、渲染 Markdown、选择最佳 evidence block，并投影 inline highlight。可用时优先使用 offset-backed provenance；line/snippet fallback 保持 legacy payload 可用。

要避免的坑：不要因为旧 payload 缺少 offset 就放宽 evidence gate。缺失 provenance 应可观测，而不是被静默当作正确。

#### P4：命中文件可发现性与工作区克制

状态：已完成。

命中文件区域现在有明确但紧凑的帮助入口。说明文案不会永久打印到 workspace 中。这符合产品要求：可发现，但不污染。

最佳实践：help control 必须支持 hover 与 focus，blur/outside interaction 后关闭，并保持稳定 ARIA 关系，避免 rerender 后 tooltip 变成孤儿节点。

#### P5：Focus runtime 与 Godot Future Path 复用

状态：已完成。

`关联聚焦` 在不移动主图 DOM 的前提下，将选中节点托管到 Knowledge Focus pane。该 pane 复用现有 graph snapshot 与 node-resolution 行为，渲染解析后的节点名，支持双击关联节点切换 anchor，并在双击中心节点时把 Markdown 打开到 pane-local reader。relation edge 列表、relation kind 与后端诊断只有 Developer Mode 开启时才显示。

`学习路径` 不显示 Tauri/browser Learning Path，也不挂载浏览器 `path-container`。它把选中命中解析为 DAG 节点后，复用现有前端 `Graph` / `PathEngine`，执行 `diffusionLearning(target, 'core', ...)` 与 `getTreeLayout(..., focusMode=true, { verticalGap: 240 })`，让 pane 托管同一套 Godot Future Path 数据契约，而不是默认打开 Godot 原生窗口。

权衡：托管 Focus pane 避免右侧 pane 抢走 Tauri 主图生命周期，但必须显式保留用户期待的 Focus-mode 交互语义。托管 Future Path 投影避免 native window reparenting，同时继续复用面向 Godot 的 `treeLayout` 契约；如果后续要求像素级 Godot renderer 一致性，应独立做 renderer extraction 或 native embedding。

#### P6：回归与发布卫生

状态：本切片已完成。

当前回归面包括 Jest contract 与 strict browser verifier，后者覆盖了 `water glass.md` 的真实 UI 失败。这个点重要，因为最新问题不是抽象架构争论，而是 label、scrollability、affordance 与 pane lifecycle 的产品级错位。

### 测试与验证快照

当前主线已有新鲜验证证据：

- `npm run build`
- `npm test -- --runInBand`
- `npm run test:agent-workspace:contracts`
- `npm exec -- tsc --noEmit`
- `npm run build:vite`
- `node --check scripts/verify-agent-workspace-browser.js`
- 通过 `scripts/verify-agent-workspace-browser.js` 执行的 strict browser verification
- `output/agent-workspace-frontend-audit.*` 下的 frontend law audit 证据

strict browser case 明确验证：

- `water glass.md` 作为命中文件可见；
- help text 隐藏在问号控件后，只有 hover/focus 时显示；
- `学习路径` 与 `关联聚焦` 可交互；
- action target 满足最小点击区域要求；
- 不存在水平溢出；
- 托管 Godot Future Path 对目标 `water glass` 使用 `diffusion/core` 与 `treeLayout`；
- 浏览器 `path-container` 没有被停靠到 learning pane；
- pane action 不调用 bridge/Tauri `showGodot=true`；
- 真实 `#graph-container` 保持在原父节点；
- 默认 `关联聚焦` 不展示 relation 诊断；只有 Developer Mode 才显示诊断；
- 右侧窗口具备关闭控件。

### 权衡

- **复用契约，而不是意外转移 ownership**：Focus 复用 mode 行为但不移动主图 DOM；Future Path 复用 `Graph` / `PathEngine` / Godot `treeLayout` 契约，而不是默认打开或嵌入原生窗口。
- **先确定性 reviewer，后模型 verifier**：语义覆盖更窄，但 release policy 稳定、可测试。
- **有界 DAG pack 优先于整图 prompt**：上下文不完整，但延迟更低、幻觉面更小。
- **optional/additive 字段优先于强制 schema break**：legacy 分支清理更慢，但保留现有客户端。
- **tooltip affordance 优先于静态说明文案**：说明不是永远可见，但 workspace 更干净、信息密度更合理。

### 坑点

1. 有人类可读图标签时仍渲染内部 atom ID。
2. 把图数据库或 prompt framework 当作现有 DAG contract 的替代品。
3. 因为 click affordance 弱，就把说明文案直接堆进 workspace。
4. 在需求已明确为托管 Godot Future Path 契约复用后，又重新引入手写 Path preview、浏览器 Path 挂载或原生窗口显示副作用。
5. reviewer gate 扩展快于 false-positive 语料。
6. 通过放宽高亮启发式来掩盖 provenance 缺失，让 UI 看起来正确。
7. 新增只转发调用、不持有不变量的 facade。

### 后续推进方向

1. 围绕真实用户失败扩展 answer-release contradiction corpus：alias drift、cross-scope leakage、same-subject relation swap、temporal drift 与 graph-direction reversal。
2. 提高 legacy payload 的 source-offset 覆盖，让重复 snippet 更常能在不引入重 AST provenance 的情况下去歧义。
3. 在提高 relation-weight bonus 前，用真实语料校准 graph-aware ranking。
4. 只有当新模块持有真实不变量时才继续拆前端 owner，例如 graph-projection normalization 或 source-provenance selection。
5. 如果 matched-file interaction 后续还会演进，应把 strict browser UI verification 持续保留在 CI。

### 思维模型

改动这个区域时先问三个问题：

1. **公开回答允许说什么？**
   - 由 answer synthesis 与 release review 持有。
2. **哪些 evidence 与 graph structure 产生了这个回答？**
   - 由 graph context assembly、trace、artifact、pane 与 export 持有。
3. **用户如何检查支撑源文档或图上下文？**
   - 由 source focus、matched-file control、托管 Focus 行为与托管 Godot Future Path 投影持有。

不要把这三个问题压进一个 prompt 或一个前端组件。它们的不变量不同，失败模式也不同。

### 真实应用

- 用户问 `什么是waterglass?`：公开回答应直接定义概念；命中文件应显示 `water glass.md`；单击后打开 Markdown 并高亮依据。
- 用户想学习选中节点：`学习路径` 应为选中 DAG 节点托管 Godot Future Path 的 `diffusion/core/treeLayout` 投影，并保持 `water glass` 这类可见节点 label。
- 用户想理解关系上下文：`关联聚焦` 应在 Knowledge Focus pane 内提供同一套 Focus-mode 交互模型，而不是抢走主图 DOM 或把 Markdown 打开到全局 reader。
- 开发者审计可疑回答：reviewer result、graph context、citation 与 provenance diagnostics 应在次级 surface 可见，而不污染公开回答。

### 常见误区

- “UI 有图按钮，所以 LLM 已经 graph-native。”
  - 错。graph-native answer planning 要求 synthesis 前有 graph context，release 前有 graph gate。
- “回答简洁，所以回答正确。”
  - 错。简洁与正确是两个不变量。
- “prompt framework 能解决最终回答审核。”
  - 不完整。它能改善 draft，但 release policy 仍需要本地 owner。
- “右侧 Path/Focus 必须嵌入真实 Godot/Tauri 窗口。”
  - 这个说法过宽。Focus 必须在 pane 内保留 Focus-mode 行为，但移动主图 DOM 会破坏 ownership。Future Path 当前通过 `treeLayout` 复用 Godot 数据契约；DOM/native 嵌入需要单独做 renderer extraction 或 native window reparenting。
- “高亮大致落在正确段落附近就够了。”
  - 对重复 snippet 不够。offset 或 AST provenance 才是耐久修复。

### 五点总结

1. 正确架构是本地 DAG -> 有界 graph context -> answer synthesis -> 确定性 release review -> 次级 evidence surface。
2. 最新 UI 切片已复用真实契约：命中文件可发现、可点击，source highlight 生效，Focus 以 pane-local 交互托管，Learning Path 托管 Godot Future Path `treeLayout` 投影，标签保持人类可读，右侧 pane 可关闭。
3. 先前 DSPy/Guidance/Semantic Kernel/LangChain/LiteLLM 方案仍有参考价值，但不应在本 runtime 中持有 DAG 语义、source provenance 或最终 release policy。
4. 主要剩余风险是校准，不是 owner 缺失：更广 reviewer 语料、更多 offset 覆盖与 ranking evaluation 是下一步硬工作。
5. 后续变更必须保持向前兼容，并由真实不变量驱动；避免 pass-through layer、无界图倾倒和 UI-only correctness fix。

# Multiplatform Lightweight RAG and Agent Architecture Plan

## Scope

This document defines a concrete architecture and repair plan for `NoteConnection_app`
across four coupled concerns:

- desktop export for Windows, Linux, and macOS,
- mobile-capable slim export,
- lightweight local RAG,
- real agent/runtime closure over local knowledge.

It is grounded in the current NoteConnection codebase and local reference projects under `ref/`:

- `ref/anything-llm`
- `ref/cherry-studio`
- `ref/DeepTutor`
- `ref/obsidian-NotEMD`

This is a planning document, not an implementation diff.

## Evidence Base

Current NoteConnection facts:

- `src/learning/types.ts` already defines strong knowledge primitives such as `KnowledgeAtom`, `EvidenceSpan`, `RelationEdge`, and `TemporalEdge`.
- `src/learning/types.ts` currently defines `KnowledgeQueryRequest` with `query`, `topK`, `asOf`, and `queryBackend`, but no first-class workspace or corpus scope.
- `src/learning/KnowledgeLearningPlatform.ts` implements `agentConversation()` as a thin wrapper over `queryKnowledge()`, then returns a fixed templated assistant message plus retrieved points.
- `src/learning/queryBackend.ts` normalizes semantic tokens using `[a-z0-9]`-only cleanup and tokenization, which makes the `local_vector` path fundamentally weak for Chinese and mixed-language retrieval.
- `src/routes/knowledge.ts` exposes modular knowledge routes, while `src/server.ts` still carries an inline `/api/knowledge/conversation` execution path. That split increases contract drift risk.
- `src/frontend/agent_workspace.js` is primarily a UI shell; it does not prove the existence of a complete scoped agent runtime underneath.

Reference project facts:

- `ref/anything-llm/server/models/workspace.js` shows `workspace` as a first-class boundary for retrieval, chat, and agent configuration.
- `ref/anything-llm/server/models/memory.js` shows explicit scoped memory (`workspace` vs `global`) with limits and lifecycle operations.
- `ref/anything-llm/server/models/workspaceAgentInvocation.js` shows agent invocation persistence as a first-class runtime record.
- `ref/anything-llm/server/models/vectors.js` shows that document-to-vector linkage is persisted explicitly instead of being an implicit side effect.
- `ref/cherry-studio/package.json` and `ref/cherry-studio/electron-builder.yml` show a strong packaging matrix discipline for Windows, Linux, and macOS, with artifact-specific boundaries and packaging exclusions.
- `ref/cherry-studio/packages/ai-sdk-provider/src/cherryin-provider.ts` shows a provider-registry approach that normalizes OpenAI-compatible, Anthropic-compatible, and Gemini-compatible behaviors behind one typed factory layer.
- `ref/DeepTutor/deeptutor/agents/chat/agentic_pipeline.py` shows a real multi-stage agent runtime: thinking, acting, observing, and responding.
- `ref/DeepTutor/deeptutor/agents/chat/session_manager.py` shows persistent session state as a first-class runtime concept rather than a UI-only transcript.

## English

### 1. Definitions

`Source`
: A user-owned artifact that can be ingested. In this project that primarily means Markdown notes, attachments, graph metadata, and derived learning state.

`Canonical unit`
: The smallest persisted retrieval object used by runtime logic. In NoteConnection this should remain graph-aware and evidence-backed, not devolve into anonymous text blobs.

`Corpus scope`
: A hard execution boundary that says which sources are searchable for a request. This is not a UI filter. It must exist in storage, retrieval, memory, and conversation contracts.

`Representation`
: The retrieval-ready projection of a canonical unit, such as lexical tokens, embedding vectors, structural graph signals, language metadata, and evidence spans.

`Retrieval`
: The process that maps a user request to ranked knowledge candidates. It must be scoped, multilingual, explainable, and stable across platforms.

`Answer synthesis`
: The runtime stage that turns retrieved candidates into a grounded answer with citations and explicit uncertainty. Retrieval alone is not a conversation system.

`Conversation state`
: The persisted turn-level runtime envelope: message, scope, retrieved evidence, memory inputs, tool calls, outputs, and trace metadata.

`Memory`
: Persisted user- or session-specific information promoted by policy, not by UI convenience. Memory is distinct from retrieval corpus, but the two interact.

`Agent runtime`
: The orchestration loop that decides whether to answer directly, retrieve, invoke tools, update memory, and emit a traceable final response.

`Shell`
: A platform-specific packaging and rendering layer such as Tauri desktop, Godot path mode, browser reader, or mobile runtime.

### 2. First-Principles Diagnosis

The current project already has a strong knowledge model, but it does not yet form a closed runtime loop.

The problem is not missing nouns. The problem is missing boundaries and missing closure.

Specifically:

- knowledge units exist,
- retrieval APIs exist,
- memory-related surfaces exist,
- platform shells exist,
- but the runtime that connects scope -> retrieval -> synthesis -> memory -> trace is incomplete.

Today, NoteConnection is closer to a graph-backed search and learning UI than to a complete lightweight RAG and agent system.

### 3. What the Reference Projects Get Right

#### AnythingLLM

What is worth reusing conceptually:

- `workspace` as the main boundary for retrieval and agent behavior,
- explicit vector linkage between document and representation,
- explicit scoped memory,
- explicit agent invocation persistence.

What should not be copied blindly:

- its product shape is workspace-first and chat-first,
- NoteConnection must remain graph-first and evidence-first,
- the retrieval unit in NoteConnection must remain richer than generic chunks.

#### Cherry Studio

What is worth reusing conceptually:

- packaging discipline per target platform,
- strong provider normalization layer,
- clear separation between provider configuration, runtime wiring, and packaging artifacts.

What should not be copied blindly:

- Electron-first assumptions,
- heavyweight desktop-only dependency surface,
- UI-driven abstraction without NoteConnection’s graph/runtime constraints.

#### DeepTutor

What is worth reusing conceptually:

- turn envelope,
- staged agent runtime,
- persistent session model,
- capability/tool registry mindset.

What should not be copied blindly:

- Python runtime shape,
- its KB stack as a direct RAG donor,
- in-process long-running orchestration patterns that do not map cleanly onto current TypeScript + Tauri + Godot constraints.

### 4. Current Architectural Gaps in NoteConnection

#### Gap A: No first-class corpus scope

`KnowledgeQueryRequest` has no workspace/corpus boundary in `src/learning/types.ts`.

Consequence:

- retrieval implicitly targets the global atom pool,
- agent answers are not reproducibly scoped,
- memory cannot be tied cleanly to corpus context,
- mobile and desktop exports cannot rely on the same deterministic retrieval contract.

#### Gap B: Multilingual retrieval is structurally weak

`src/learning/queryBackend.ts` uses ASCII-only normalization for the `local_vector` path.

Consequence:

- Chinese retrieval quality is structurally degraded,
- mixed Chinese/English notes are penalized,
- "local semantic search" is overstated compared with actual runtime behavior.

#### Gap C: Conversation is retrieval formatting, not answer synthesis

`agentConversation()` in `src/learning/KnowledgeLearningPlatform.ts` calls `queryKnowledge()`, formats the hits, and returns a fixed sentence.

Consequence:

- no real answer composition,
- no citation-grounded explanation contract,
- no tool arbitration,
- no durable turn trace model comparable to a real agent runtime.

#### Gap D: Memory is not inside the main turn loop

The codebase has memory-related capabilities, but the main conversation path does not meaningfully:

- read scoped memory as input,
- produce explicit memory candidates,
- apply promotion policy after the answer,
- persist turn-level reasoning trace tied to memory decisions.

#### Gap E: Ingestion is not yet a continuous scoped pipeline

There is ingestion machinery in `src/learning/KnowledgeLearningPlatform.ts`, but the product-facing runtime still behaves more like point-triggered ingestion than a durable source -> unit -> representation -> index pipeline.

Consequence:

- retrieval freshness is harder to reason about,
- export targets cannot rely on a compact precomputed retrieval package,
- mobile optimization has no stable ingestion artifact boundary.

#### Gap F: API semantics are too split

`src/routes/knowledge.ts` and `src/server.ts` both participate in knowledge API behavior, including `/api/knowledge/conversation`.

Consequence:

- contract drift risk,
- repeated CORS/header/validation behavior bugs,
- platform shells become sensitive to route-path implementation detail.

#### Gap G: Platform shell and retrieval/runtime core are not separated enough

Current renderer, reader, bridge, and sidecar issues show that content rendering and knowledge runtime concerns still bleed into one another.

Consequence:

- desktop regressions leak into Godot/mobile flows,
- shell-specific bugs can distort system-level architecture choices,
- export complexity remains coupled to business logic.

### 5. Target Architecture

The target architecture should be seven layers:

1. `Source layer`
   - Markdown notes, attachments, graph data, learning state.
2. `Canonicalization layer`
   - Parse sources into `KnowledgeDocument`, `KnowledgeAtom`, `EvidenceSpan`, relation edges, temporal edges.
3. `Representation layer`
   - Build lexical index, multilingual embedding index, graph adjacency signals, freshness/version metadata.
4. `Scoped retrieval layer`
   - Execute retrieval inside an explicit corpus/workspace boundary.
5. `Conversation runtime layer`
   - Turn envelope, retrieval plan, answer synthesis, citation contract, tool execution, trace emission.
6. `Memory and invocation layer`
   - Session memory, promoted memory, invocation records, turn history, replayability.
7. `Platform shell layer`
   - Tauri desktop, browser reader, Godot reader/path mode, mobile slim runtime.

The shell layer must never be the system of record for retrieval or memory.

### 6. Concrete Repair and Delivery Plan

## Phase 0: Stop architectural drift

Goal:

- establish one runtime contract before adding more features.

Implementation units:

- Unify `/api/knowledge/conversation` ownership under modular routes.
- Reduce `src/server.ts` knowledge-route duplication.
- Introduce one canonical request/response contract for conversation turns.
- Add a typed `ConversationTurnRequest` and `ConversationTurnResult` surface in `src/learning/types.ts` or `src/learning/api.ts`.

Primary files:

- `src/routes/knowledge.ts`
- `src/server.ts`
- `src/learning/api.ts`
- `src/learning/types.ts`

Tests:

- `src/server.migration.test.ts`
- add `src/routes/knowledge.conversation.test.ts`
- add `src/learning/conversation.contract.test.ts`

Exit criteria:

- one POST conversation path,
- one SSE or streaming path,
- one validation and header policy,
- no shell-specific branches inside the conversation contract.

## Phase 1: Make retrieval correct before making it smarter

Goal:

- replace the current pseudo-semantic local path with a real multilingual lightweight retrieval stack.

Decision:

- do not jump directly to an external heavyweight vector database.
- keep a local persistent retrieval index suitable for desktop and mobile exports.

Implementation units:

- Introduce explicit corpus/workspace scope into `KnowledgeQueryRequest`.
- Replace ASCII-only semantic tokenization with multilingual-safe lexical handling.
- Add embedding-based retrieval as a first-class representation, not as an implied future backend.
- Keep lexical fallback and graph reranking.

Primary files:

- `src/learning/types.ts`
- `src/learning/api.ts`
- `src/learning/queryBackend.ts`
- `src/learning/KnowledgeLearningPlatform.ts`
- add `src/learning/indexing/`

Suggested new modules:

- `src/learning/indexing/CorpusScope.ts`
- `src/learning/indexing/LexicalIndex.ts`
- `src/learning/indexing/EmbeddingIndex.ts`
- `src/learning/indexing/GraphReranker.ts`

Tests:

- `src/learning/KnowledgeLearningPlatform.test.ts`
- add `src/learning/queryBackend.multilingual.test.ts`
- add `src/learning/queryBackend.scope.test.ts`
- add `src/learning/indexing/EmbeddingIndex.test.ts`

Exit criteria:

- Chinese and mixed-language queries pass retrieval regression tests,
- every query is scope-bound,
- trace output states which retrieval modes contributed,
- graph rerank remains explainable.

## Phase 2: Build a real lightweight RAG runtime

Goal:

- turn retrieval hits into grounded answers with citations.

Decision:

- answer synthesis is a distinct runtime stage, not a side effect of retrieval.

Implementation units:

- Add a turn executor that does:
  - normalize request,
  - resolve scope,
  - read session memory,
  - retrieve candidates,
  - synthesize answer,
  - emit citations,
  - produce memory candidates,
  - persist turn trace.

- Define a strict answer contract:
  - `answer`
  - `citations`
  - `retrievalTrace`
  - `memoryActions`
  - `followUpCapabilities`

Primary files:

- `src/learning/KnowledgeLearningPlatform.ts`
- add `src/learning/conversation/TurnExecutor.ts`
- add `src/learning/conversation/AnswerSynthesizer.ts`
- add `src/learning/conversation/CitationBuilder.ts`

Tests:

- add `src/learning/conversation/TurnExecutor.test.ts`
- add `src/learning/conversation/CitationBuilder.test.ts`
- add `src/learning/conversation/AnswerSynthesizer.test.ts`

Exit criteria:

- assistant responses are grounded answers instead of fixed template strings,
- citations are evidence-backed,
- no answer is emitted without an explicit trace object.

## Phase 3: Close the memory and invocation loop

Goal:

- make turns durable and replayable.

Decision:

- memory is policy-governed state, not a free-form transcript dump.

Implementation units:

- Add first-class session memory and long-term promoted memory scoped by corpus/workspace.
- Add invocation/turn persistence modeled after the useful parts of `AnythingLLM` and `DeepTutor`.
- Persist:
  - turn id,
  - session id,
  - workspace/corpus id,
  - request,
  - retrieval summary,
  - citations,
  - memory actions,
  - final answer,
  - failure status.

Primary files:

- `src/learning/KnowledgeLearningPlatform.ts`
- `src/learning/types.ts`
- add `src/learning/conversation/ConversationStore.ts`
- add `src/learning/memory/MemoryStore.ts`
- add `src/learning/memory/MemoryPolicyEngine.ts`

Tests:

- add `src/learning/conversation/ConversationStore.test.ts`
- add `src/learning/memory/MemoryStore.test.ts`
- add `src/learning/memory/MemoryPolicyEngine.test.ts`

Exit criteria:

- every turn can be replayed or inspected,
- memory promotion is explicit and testable,
- workspace/corpus scope is preserved across memory operations.

## Phase 4: Separate platform shell from runtime core

Goal:

- make export stability possible across Windows, Linux, macOS, and mobile.

Decision:

- the retrieval/runtime core stays pure TypeScript and portable.
- shell adapters own rendering, filesystem, IPC, and packaging differences.

Implementation units:

- Define a `platform adapter` boundary for:
  - filesystem access,
  - background indexing triggers,
  - asset/materialization strategy,
  - renderer-specific markdown/mermaid/math output handling.

- Keep Godot-specific constraints out of core logic.
- Because Godot cannot reliably consume SVG, mermaid/math outputs for Godot must be materialized in a non-SVG target format at the shell adapter layer.

Primary files:

- `src/utils/RuntimePaths.ts`
- `src/core/PathBridge.ts`
- `src/routes/render.ts`
- `path_mode/scripts/reader_render_client.gd`
- `path_mode/scripts/path_mode_ui.gd`
- add `src/platform/`

Suggested new modules:

- `src/platform/PlatformCapabilities.ts`
- `src/platform/RenderMaterializer.ts`
- `src/platform/ExportProfile.ts`

Tests:

- add `src/platform/PlatformCapabilities.test.ts`
- add `src/platform/RenderMaterializer.test.ts`
- extend `src/pathbridge.handshake.contract.test.ts`

Exit criteria:

- shell adapters consume stable runtime outputs,
- Godot rendering no longer dictates retrieval design,
- desktop and mobile export profiles are explicit.

## Phase 5: Define the packaging matrix

Goal:

- ship intentionally, not incidentally.

Decision:

- use one core, multiple export profiles.

Required export profiles:

- `desktop-full`
  - Tauri desktop for Windows, Linux, macOS
  - local sidecar allowed
  - full retrieval + agent runtime

- `desktop-reader`
  - Tauri desktop read-only / lighter mode
  - prebuilt or deferred index loading

- `godot-path-mode`
  - visualization and reader shell
  - no SVG dependence
  - consumes materialized render artifacts

- `mobile-slim`
  - corpus-scoped lightweight retrieval only
  - compact local index
  - bounded memory footprint
  - reduced background orchestration

Primary files:

- `src-tauri/tauri.windows.conf.json`
- `src-tauri/tauri.linux.conf.json`
- `src-tauri/tauri.macos.conf.json`
- `src-tauri/tauri.android.conf.json`
- `scripts/`
- add `docs/solutions/export-profile-matrix.md` in implementation phase

Tests:

- add packaging smoke scripts under `scripts/`
- add export profile verification notes in `docs/`

Exit criteria:

- each build target has an explicit capability matrix,
- no platform implicitly inherits desktop-only assumptions,
- mobile slim mode has its own constraints and validation path.

## Phase 6: Simplify agent product semantics

Goal:

- stop calling a retrieval wrapper an agent.

Decision:

- product labels must match runtime truth.

Implementation units:

- Split product concepts into:
  - `Knowledge Search`
  - `Grounded Conversation`
  - `Guided Learning`
  - `Autonomous Agent Actions` only when tool/action loops actually exist

- Do not expose agent-facing UI affordances that the runtime cannot honor deterministically.

Primary files:

- `src/frontend/agent_workspace.js`
- `src/frontend/main.mjs`
- `src/frontend/i18n.mjs`
- relevant locale files under `src/frontend/locales/`

Tests:

- add `src/frontend/agent_workspace.contract.test.js`
- add runtime capability integration tests where feasible

Exit criteria:

- UI vocabulary matches backend truth,
- capability cards reflect actual supported runtime actions,
- agent traces are inspectable.

### 7. Layer Connections

The intended data flow is:

`source` -> `canonical unit` -> `representation` -> `scoped retrieval` -> `answer synthesis` -> `memory policy` -> `turn trace` -> `shell materialization`

Each transition needs a stable contract:

- source to canonical unit:
  - versioned ingestion metadata
- canonical unit to representation:
  - lexical + embedding + graph signals
- representation to retrieval:
  - scope id + retrieval policy
- retrieval to synthesis:
  - ranked candidates + evidence spans
- synthesis to memory:
  - explicit proposed memory actions
- turn trace to shell:
  - platform-neutral payload, platform-specific rendering

### 8. Tradeoffs

#### Graph-first vs chunk-first

Keep graph-first.

Reason:

- NoteConnection’s advantage is evidence graph structure and learning semantics.
- Chunks should support retrieval, not replace the core model.

#### Lightweight local index vs external vector database

Prefer local persistent index first.

Reason:

- desktop export works offline,
- mobile slim mode remains possible,
- lower operational complexity,
- easier deterministic packaging.

Use an external vector database only when:

- corpus size or concurrency actually exceeds the local design,
- and after scope/version contracts are already stable.

#### One runtime vs per-shell logic

Prefer one core runtime.

Reason:

- correctness belongs in one place,
- shell-specific forks create drift,
- earlier mermaid/math issues already showed the cost of mixed concerns.

#### Persistent memory vs deterministic replay

Keep both, but separate them.

- persistent memory is promoted state,
- deterministic replay is turn history plus trace.

Do not use memory as a substitute for replayable turn records.

### 9. Common Mistakes to Avoid

- Adding more provider settings before the retrieval/runtime contract is stable.
- Treating UI capability cards as proof of agent capability.
- Using ASCII tokenization and calling it multilingual semantic retrieval.
- Letting Godot rendering constraints leak back into knowledge/runtime design.
- Mixing ingestion freshness, conversation memory, and answer citations into one implicit state blob.
- Shipping mobile builds that silently depend on desktop-sidecar assumptions.
- Keeping duplicated conversation route logic in more than one server surface.

### 10. Best Practices

- Make `corpus/workspace scope` mandatory in every retrieval and conversation contract.
- Keep one canonical turn executor.
- Emit citations and retrieval trace together.
- Separate canonical knowledge units from retrieval representations.
- Keep the runtime core portable and deterministic.
- Materialize shell-specific render artifacts only at adapter boundaries.
- Add multilingual regression tests before changing ranking heuristics.
- Persist invocation records for every agent-like operation.

### 11. Mental Model

The right mental model is:

`corpus` -> `unit` -> `index` -> `scope` -> `turn runtime` -> `trace` -> `shell`

If any layer is implicit, the system will drift.

If scope is implicit, retrieval drifts.
If trace is implicit, agent claims drift.
If shell behavior is implicit, cross-platform exports drift.

### 12. Real Application in This Project

For a note like `Knowledge_Base/.../Absorption.md`, the correct final behavior is:

- ingestion converts it into canonical atoms, evidence spans, and graph relations,
- scope binding decides which corpus or workspace owns it,
- multilingual lexical and embedding representations are built once and versioned,
- a conversation turn queries only that scope,
- retrieval returns ranked evidence-backed candidates,
- answer synthesis emits a grounded explanation with citations,
- memory policy decides what to retain for the user and that scope,
- Tauri desktop, browser reader, and Godot reader all consume the same turn result,
- Godot receives a shell-safe render materialization, not a raw SVG dependency.

### 13. Recommended Execution Order

1. Phase 0: unify conversation contract ownership.
2. Phase 1: add scope and multilingual retrieval correctness.
3. Phase 2: build grounded answer synthesis.
4. Phase 3: integrate memory and invocation persistence.
5. Phase 4: split runtime core from shell adapters.
6. Phase 5: formalize export profiles.
7. Phase 6: simplify product semantics so the UI matches runtime truth.

### 14. Five-Point Summary

1. NoteConnection already has a stronger knowledge model than the reference chat products, but it lacks runtime closure.
2. The most urgent gap is not more agent UI. It is scoped multilingual retrieval correctness.
3. `AnythingLLM` contributes the right ideas for workspace, memory, and invocation persistence; `Cherry Studio` contributes provider and packaging discipline; `DeepTutor` contributes staged turn runtime design.
4. The correct architecture is one portable TypeScript core with platform-specific shell adapters, not separate runtimes per shell.
5. Mobile support becomes realistic only after scope, indexing, conversation, and rendering contracts are explicit and portable.

## 中文

### 1. 术语定义

`Source`
: 用户拥有、可被摄取的原始对象。在本项目中主要是 Markdown 笔记、附件、图谱元数据以及派生出的学习状态。

`Canonical unit`
: 运行时真正持久化的最小检索单元。对 NoteConnection 而言，它不能退化成匿名文本块，而应继续保持图谱关系和证据约束。

`Corpus scope`
: 检索与对话执行时的硬边界，用来声明“这次请求到底可以搜索哪些源”。这不是 UI 过滤器，而必须贯穿存储、检索、记忆和会话契约。

`Representation`
: 供检索运行时使用的表示层，包括词法索引、向量表示、图结构信号、语言元数据和证据片段。

`Retrieval`
: 将用户请求映射为排序后的知识候选集合的过程。它必须是有 scope 的、支持多语言的、可解释的，并能跨平台保持稳定行为。

`Answer synthesis`
: 将检索候选组织成最终回答并附带引用的运行时阶段。只有检索，没有综合，不构成真正的对话系统。

`Conversation state`
: 按 turn 持久化的运行时信封，至少包括消息、scope、检索证据、记忆输入、工具调用、输出和 trace 元数据。

`Memory`
: 经由策略提升后保留下来的用户/会话状态，不是为了交互方便而堆积的 transcript。Memory 与 retrieval corpus 不同，但两者会发生耦合。

`Agent runtime`
: 决定是否直接回答、是否检索、是否调用工具、是否写回记忆、以及如何输出 trace 的编排闭环。

`Shell`
: 平台相关的打包与渲染层，例如 Tauri 桌面端、Godot path mode、浏览器 reader 或移动端运行时。

### 2. 第一性原理诊断

当前项目的问题不是“缺少概念”，而是“缺少边界”和“缺少闭环”。

现在已经有：

- 知识单元，
- 检索接口，
- 记忆相关接口，
- 多个平台壳层，

但还没有真正把：

`scope -> retrieval -> synthesis -> memory -> trace`

闭合成一个统一运行时。

因此，当前 NoteConnection 更像是“图谱增强的搜索/学习界面”，而不是“完整的轻量级 RAG + memory + agent runtime 系统”。

### 3. 对照项目中真正值得借鉴的部分

#### AnythingLLM

值得借鉴：

- `workspace` 作为一等边界，
- 文档到向量表示的显式持久化关系，
- 显式分层的 memory，
- 显式的 agent invocation 持久化。

不应直接照搬：

- 它是 workspace-first、chat-first 的产品，
- NoteConnection 仍然应该保持 graph-first、evidence-first。

#### Cherry Studio

值得借鉴：

- 多平台打包矩阵纪律，
- provider 归一化层，
- 配置、运行时和打包产物的清晰边界。

不应直接照搬：

- Electron-first 假设，
- 偏桌面端的重量级依赖面。

#### DeepTutor

值得借鉴：

- turn envelope，
- 分阶段 agent runtime，
- 持久化 session，
- capability/tool registry 思维。

不应直接照搬：

- Python 运行时形态，
- 其知识库/RAG 实现本体，
- 进程内长生命周期 orchestration 方式。

### 4. 当前 NoteConnection 的核心缺口

#### 缺口 A：没有一等公民的 corpus/workspace scope

`src/learning/types.ts` 中的 `KnowledgeQueryRequest` 还没有 workspace 或 corpus 边界。

后果：

- 检索默认落在全局 atom 池，
- agent 回答不可复现地漂移，
- memory 无法稳定绑定到语料边界，
- 桌面端与移动端无法共享同一个确定性检索契约。

#### 缺口 B：多语言检索在结构上就偏弱

`src/learning/queryBackend.ts` 的 `local_vector` 路径仍然使用 `[a-z0-9]` 级别的归一化与切词。

后果：

- 中文检索质量会被结构性压制，
- 中英混合笔记会显著退化，
- “本地语义检索”这个说法高于实际能力。

#### 缺口 C：当前 conversation 只是检索结果格式化，不是回答综合

`src/learning/KnowledgeLearningPlatform.ts` 中的 `agentConversation()` 只是调用 `queryKnowledge()`，再输出固定模板句。

后果：

- 没有真实回答生成，
- 没有证据引用契约，
- 没有工具仲裁，
- 没有可审计的 turn trace 模型。

#### 缺口 D：memory 没有进入主 turn 闭环

虽然代码中有 memory 相关能力，但主对话路径并没有系统性地：

- 读取 scoped memory 作为输入，
- 生成 memory 候选，
- 在回答后执行策略提升，
- 将 memory 决策写入 turn trace。

#### 缺口 E：ingestion 还不是持续、分 scope 的正式流水线

`src/learning/KnowledgeLearningPlatform.ts` 已有 ingestion 能力，但产品层行为仍更像“点触发式导入”，而不是：

`source -> unit -> representation -> index`

的正式管线。

#### 缺口 F：API 语义分裂

`src/routes/knowledge.ts` 与 `src/server.ts` 都在参与知识 API 行为，包括 `/api/knowledge/conversation`。

后果：

- 契约漂移风险高，
- 容易重复出现 CORS、header、validation 侧的偏差，
- 平台壳层会被路由实现细节牵着走。

#### 缺口 G：平台壳层与运行时核心分离不够

此前 reader、bridge、render 链路的问题已经说明：渲染问题和知识运行时问题仍在互相污染。

后果：

- 桌面端回归会波及 Godot/移动端，
- 壳层 bug 会反向扭曲系统架构决策，
- 导出复杂度长期无法收敛。

### 5. 目标架构

推荐目标架构分为七层：

1. `Source layer`
   - Markdown、附件、图谱数据、学习状态。
2. `Canonicalization layer`
   - 解析为 `KnowledgeDocument`、`KnowledgeAtom`、`EvidenceSpan`、关系边和时间边。
3. `Representation layer`
   - 构建词法索引、多语言向量索引、图邻接信号和 freshness/version 元数据。
4. `Scoped retrieval layer`
   - 在显式 corpus/workspace 边界内执行检索。
5. `Conversation runtime layer`
   - turn envelope、检索计划、回答综合、引用契约、工具执行、trace 输出。
6. `Memory and invocation layer`
   - session memory、提升后的长期 memory、invocation 记录、turn history、可回放性。
7. `Platform shell layer`
   - Tauri 桌面端、浏览器 reader、Godot reader/path mode、移动端 slim runtime。

系统记录层必须在 runtime core，而不是在 shell。

### 6. 分阶段推进与修复方案

#### Phase 0：先止住架构漂移

目标：

- 在继续堆功能之前，先建立唯一的 conversation contract。

实施要点：

- 将 `/api/knowledge/conversation` 的所有权统一到模块化 route。
- 减少 `src/server.ts` 中的知识路由内联逻辑。
- 定义唯一的 `ConversationTurnRequest` / `ConversationTurnResult` 契约。

主文件：

- `src/routes/knowledge.ts`
- `src/server.ts`
- `src/learning/api.ts`
- `src/learning/types.ts`

测试：

- `src/server.migration.test.ts`
- 新增 `src/routes/knowledge.conversation.test.ts`
- 新增 `src/learning/conversation.contract.test.ts`

退出条件：

- 一个 POST 会话入口，
- 一个流式入口，
- 一套 header/validation 规则，
- conversation contract 内无壳层特判。

#### Phase 1：先把检索做对，再谈更聪明

目标：

- 用真正可跨语言、可离线、可跨平台的轻量检索栈，替换现在伪语义化的本地路径。

关键决策：

- 不要立刻引入重型外部向量数据库。
- 优先构建本地持久化索引，以便支撑桌面端与移动端 slim mode。

实施要点：

- 在 `KnowledgeQueryRequest` 中加入强制的 corpus/workspace scope。
- 将 ASCII-only 的 token 处理替换为多语言安全的词法层。
- 将 embedding retrieval 变成一等表示层能力。
- 保留 lexical fallback 和 graph rerank。

主文件：

- `src/learning/types.ts`
- `src/learning/api.ts`
- `src/learning/queryBackend.ts`
- `src/learning/KnowledgeLearningPlatform.ts`
- 新增 `src/learning/indexing/`

建议新模块：

- `src/learning/indexing/CorpusScope.ts`
- `src/learning/indexing/LexicalIndex.ts`
- `src/learning/indexing/EmbeddingIndex.ts`
- `src/learning/indexing/GraphReranker.ts`

测试：

- `src/learning/KnowledgeLearningPlatform.test.ts`
- 新增 `src/learning/queryBackend.multilingual.test.ts`
- 新增 `src/learning/queryBackend.scope.test.ts`
- 新增 `src/learning/indexing/EmbeddingIndex.test.ts`

退出条件：

- 中文与中英混合查询有回归用例保护，
- 所有查询都在 scope 内执行，
- trace 能解释各检索模式贡献，
- graph rerank 保持可解释性。

#### Phase 2：建立真正的 lightweight RAG runtime

目标：

- 把检索候选组织成带引用的 grounded answer。

关键决策：

- 回答综合必须是独立阶段，而不是检索副作用。

实施要点：

- 新建 turn executor，负责：
  - 归一化请求，
  - 解析 scope，
  - 读取 session memory，
  - 执行 retrieval，
  - 综合回答，
  - 输出 citations，
  - 生成 memory candidates，
  - 持久化 turn trace。

- 定义严格回答契约：
  - `answer`
  - `citations`
  - `retrievalTrace`
  - `memoryActions`
  - `followUpCapabilities`

主文件：

- `src/learning/KnowledgeLearningPlatform.ts`
- 新增 `src/learning/conversation/TurnExecutor.ts`
- 新增 `src/learning/conversation/AnswerSynthesizer.ts`
- 新增 `src/learning/conversation/CitationBuilder.ts`

测试：

- 新增 `src/learning/conversation/TurnExecutor.test.ts`
- 新增 `src/learning/conversation/CitationBuilder.test.ts`
- 新增 `src/learning/conversation/AnswerSynthesizer.test.ts`

退出条件：

- assistant 输出变成 grounded answer，而不是固定模板句，
- 所有回答都带 evidence-backed citation，
- 无 trace 不出答案。

#### Phase 3：补上 memory 与 invocation 闭环

目标：

- 让每个 turn 可追踪、可回放、可审计。

关键决策：

- memory 是策略治理后的状态，而不是 transcript 堆积。

实施要点：

- 引入按 corpus/workspace scope 分层的 session memory 与 promoted memory。
- 建立参考 AnythingLLM 与 DeepTutor 的 invocation/turn 持久化模型。
- 持久化：
  - turn id，
  - session id，
  - workspace/corpus id，
  - request，
  - retrieval summary，
  - citations，
  - memory actions，
  - final answer，
  - failure status。

主文件：

- `src/learning/KnowledgeLearningPlatform.ts`
- `src/learning/types.ts`
- 新增 `src/learning/conversation/ConversationStore.ts`
- 新增 `src/learning/memory/MemoryStore.ts`
- 新增 `src/learning/memory/MemoryPolicyEngine.ts`

测试：

- 新增 `src/learning/conversation/ConversationStore.test.ts`
- 新增 `src/learning/memory/MemoryStore.test.ts`
- 新增 `src/learning/memory/MemoryPolicyEngine.test.ts`

退出条件：

- 每个 turn 都可重放或审计，
- memory 提升动作显式、可测试，
- memory 与 scope 始终绑定。

#### Phase 4：将平台壳层从运行时核心中剥离

目标：

- 为 Windows、Linux、macOS 与移动端导出建立稳定基础。

关键决策：

- retrieval/runtime core 保持纯 TypeScript、可移植。
- shell adapter 只负责渲染、文件系统、IPC 与打包差异。

实施要点：

- 定义平台适配边界：
  - 文件系统访问，
  - 后台索引触发，
  - 产物 materialization，
  - reader 中 markdown/mermaid/math 的壳层输出处理。

- Godot 特有约束不能反向污染核心逻辑。
- 由于 Godot 对 SVG 支持存在缺陷，Godot 侧 mermaid/math 输出必须在 shell adapter 层 materialize 为非 SVG 目标格式。

主文件：

- `src/utils/RuntimePaths.ts`
- `src/core/PathBridge.ts`
- `src/routes/render.ts`
- `path_mode/scripts/reader_render_client.gd`
- `path_mode/scripts/path_mode_ui.gd`
- 新增 `src/platform/`

建议新模块：

- `src/platform/PlatformCapabilities.ts`
- `src/platform/RenderMaterializer.ts`
- `src/platform/ExportProfile.ts`

测试：

- 新增 `src/platform/PlatformCapabilities.test.ts`
- 新增 `src/platform/RenderMaterializer.test.ts`
- 扩展 `src/pathbridge.handshake.contract.test.ts`

退出条件：

- 壳层消费统一运行时输出，
- Godot 渲染约束不再主导知识架构设计，
- 桌面端与移动端 profile 明确分离。

#### Phase 5：正式建立导出矩阵

目标：

- 让“支持哪些平台、每个平台支持哪些能力”成为明文能力矩阵，而不是隐式结果。

关键决策：

- 一套 core，多个 export profile。

建议 profile：

- `desktop-full`
  - Windows / Linux / macOS 的 Tauri 桌面端
  - 允许本地 sidecar
  - 完整 retrieval + agent runtime

- `desktop-reader`
  - 轻量只读或偏 reader 的桌面形态
  - 支持预构建或延迟加载索引

- `godot-path-mode`
  - 可视化与 reader 壳层
  - 不依赖 SVG
  - 消费 materialized render artifact

- `mobile-slim`
  - 仅保留 scoped lightweight retrieval
  - 使用紧凑本地索引
  - 严格限制内存占用
  - 降低后台 orchestration 复杂度

主文件：

- `src-tauri/tauri.windows.conf.json`
- `src-tauri/tauri.linux.conf.json`
- `src-tauri/tauri.macos.conf.json`
- `src-tauri/tauri.android.conf.json`
- `scripts/`

测试：

- 在 `scripts/` 下增加 profile smoke check
- 在后续实施阶段补 `docs/solutions/export-profile-matrix.md`

退出条件：

- 每个导出目标都有明确 capability matrix，
- 移动端不再隐式依赖桌面 sidecar 假设，
- mobile slim mode 有独立验证路径。

#### Phase 6：纠正 agent 产品语义

目标：

- 停止把 retrieval wrapper 叫做 agent。

关键决策：

- 产品命名必须与运行时真相一致。

实施要点：

- 将产品概念拆分为：
  - `Knowledge Search`
  - `Grounded Conversation`
  - `Guided Learning`
  - 只有在真实工具闭环存在时才叫 `Autonomous Agent Actions`

- 不要暴露后端无法确定性兑现的 agent UI affordance。

主文件：

- `src/frontend/agent_workspace.js`
- `src/frontend/main.mjs`
- `src/frontend/i18n.mjs`
- `src/frontend/locales/` 下相关文案

测试：

- 新增 `src/frontend/agent_workspace.contract.test.js`
- 适度补 runtime capability 集成测试

退出条件：

- UI 文案与后端能力一致，
- capability card 反映真实可执行动作，
- agent trace 可被检查。

### 7. 各层之间如何连接

理想的数据流应为：

`source -> canonical unit -> representation -> scoped retrieval -> answer synthesis -> memory policy -> turn trace -> shell materialization`

每一段转换都必须有稳定契约：

- source -> canonical unit
  - 需要 versioned ingestion metadata
- canonical unit -> representation
  - 需要 lexical + embedding + graph signals
- representation -> retrieval
  - 需要 scope id + retrieval policy
- retrieval -> synthesis
  - 需要 ranked candidate + evidence span
- synthesis -> memory
  - 需要显式 memory action 提案
- turn trace -> shell
  - 需要平台无关 payload + 平台相关渲染

### 8. 关键权衡

#### Graph-first 还是 chunk-first

保持 graph-first。

原因：

- NoteConnection 的真正优势在图谱关系、证据与学习语义，
- chunk 只能服务检索，不能取代核心模型。

#### 本地轻量索引还是外部向量数据库

优先本地持久化索引。

原因：

- 支持离线桌面端，
- 支撑移动端 slim mode，
- 运维复杂度更低，
- 更容易做确定性打包。

只有当 corpus 规模或并发真实超出本地设计时，再考虑外部向量数据库。

#### 单一 runtime 还是每个壳层单独逻辑

优先单一 runtime core。

原因：

- 正确性只能有一个归属点，
- 每个壳层各写一套逻辑只会持续漂移，
- 先前 mermaid/math 链路问题已经证明混合关注点的代价。

#### 持久 memory 与 deterministic replay

两者都要，但必须分开。

- persistent memory 是提升后的长期状态，
- deterministic replay 是 turn history + trace。

不能拿 memory 替代 replay。

### 9. 常见误区

- 在 retrieval/runtime contract 未稳定前继续增加 provider 设置页复杂度。
- 把 UI capability card 当成 agent 能力存在的证据。
- 用 ASCII tokenization 却自称支持多语言语义检索。
- 让 Godot 渲染约束反向主导知识运行时设计。
- 把 ingestion freshness、conversation memory 与 answer citations 混成一个隐式状态团。
- 发布移动端时默认它能复用桌面 sidecar 假设。
- 在多个 server surface 中保留重复 conversation 实现。

### 10. 最佳实践

- 所有 retrieval 与 conversation contract 强制带 scope。
- 只保留一个 canonical turn executor。
- citation 与 retrieval trace 一起输出。
- 将 canonical knowledge unit 与 retrieval representation 分层。
- runtime core 保持可移植、可确定复现。
- shell-specific render artifact 只在 adapter 边界 materialize。
- 在改 ranking heuristic 前先补多语言回归测试。
- 对所有 agent-like 操作持久化 invocation record。

### 11. 心智模型

正确的心智模型是：

`corpus -> unit -> index -> scope -> turn runtime -> trace -> shell`

任何一层是隐式的，系统就会漂移：

- scope 隐式，检索就会漂移；
- trace 隐式，agent 声称就会漂移；
- shell 行为隐式，多平台导出就会漂移。

### 12. 在本项目中的真实落地形态

以 `Knowledge_Base/.../Absorption.md` 为例，正确终态应是：

- ingestion 先解析出 canonical atoms、evidence spans 和 graph relations；
- scope binding 明确它属于哪个 corpus/workspace；
- 多语言 lexical 与 embedding representation 一次构建并版本化；
- conversation turn 只在该 scope 内检索；
- retrieval 返回排序后的 evidence-backed candidates；
- synthesis 输出 grounded explanation 与 citations；
- memory policy 决定哪些信息对该用户、该 scope 应保留；
- Tauri desktop、browser reader、Godot reader 消费的是同一份 turn result；
- Godot 接收的是 shell-safe materialized render output，而不是直接依赖原始 SVG。

### 13. 推荐执行顺序

1. Phase 0：统一 conversation contract 所有权。
2. Phase 1：补 scope 与多语言检索正确性。
3. Phase 2：建立 grounded answer synthesis。
4. Phase 3：接入 memory 与 invocation 持久化。
5. Phase 4：拆分 runtime core 与 shell adapter。
6. Phase 5：固化 export profile。
7. Phase 6：收敛产品语义，让 UI 与运行时真相一致。

### 14. 五点总结

1. NoteConnection 已有比参考聊天产品更强的知识模型，但缺的是运行时闭环。
2. 最高优先级不是继续堆 agent UI，而是先把 scoped multilingual retrieval 做正确。
3. `AnythingLLM` 贡献的是 workspace/memory/invocation 思路，`Cherry Studio` 贡献的是 provider 与 packaging discipline，`DeepTutor` 贡献的是 staged turn runtime。
4. 正确方向是一套可移植的 TypeScript core，加若干平台壳层 adapter，而不是每个平台各跑一套 runtime。
5. 只有在 scope、index、conversation、render contract 都显式化之后，移动端 slim mode 才真正可交付。

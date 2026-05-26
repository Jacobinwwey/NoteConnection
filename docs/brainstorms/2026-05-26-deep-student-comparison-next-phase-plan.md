# Deep Student Comparison Next-Phase Plan

## Scope

This document refines the existing NoteConnection multiplatform and lightweight-RAG roadmap
after comparing the current implementation against `ref/deep-student`.

The purpose is not to copy `deep-student`.
The purpose is to identify which substrate layers NoteConnection still lacks after Phase 0-6,
and to define the next robust implementation program for:

- Windows / Linux / macOS desktop export,
- mobile slim export,
- lightweight local RAG,
- learning-system durability,
- memory and workflow governance.

Reference projects considered in this planning pass:

- `ref/deep-student`
- `ref/anything-llm`
- `ref/cherry-studio`
- `ref/DeepTutor`
- existing NoteConnection implementation under `src/`, `src-tauri/`, and `path_mode/`

## Evidence Base

Current NoteConnection strengths:

- `src/learning/types.ts` now has explicit `KnowledgeCorpusScope`, `KnowledgeCitation`, `AgentConversationRequest`, `AgentConversationResponse`, and typed conversation/memory contracts.
- `src/learning/KnowledgeLearningPlatform.ts` now supports:
  - scope-aware retrieval,
  - grounded conversation responses,
  - citations,
  - recalled conversation memory,
  - persisted conversation session/turn/invocation state.
- `src/learning/queryBackend.ts` now supports Unicode-aware semantic tokenization and CJK n-grams for the local-vector path.
- `src/routes/render.ts` plus `src/platform/RenderMaterializer.ts` now expose explicit PNG-first platform render materialization for Godot and mobile.
- `src/frontend/agent_workspace.js` and `src/frontend/index.html` now use product semantics aligned with runtime truth: grounded conversation, knowledge focus, and guided learning.

Deep Student signals with direct architectural value:

- `ref/deep-student/src-tauri/migrations/vfs/V20260130__init.sql` defines `resources` as the content SSOT and builds projections such as notes, files, exams, translations, essays, and retrieval artifacts around it.
- `ref/deep-student/src-tauri/src/vfs/types.rs` formalizes resource type, storage mode, and metadata as stable domain objects.
- `ref/deep-student/src-tauri/src/vfs/index_service.rs` models explicit `unit` and `segment` indexing lifecycle with pending/indexing/indexed/failed states and dimension statistics.
- `ref/deep-student/src/stores/unifiedIndexStore.ts` exposes index lifecycle directly to the frontend as a first-class product surface.
- `ref/deep-student/src-tauri/migrations/chat_v2/V20260130__init.sql` persists session, message, block, attachment, session-state, workspace index, todo list, and sub-agent task structures.
- `ref/deep-student/src-tauri/src/memory/service.rs` uses typed memory, purpose weighting, auto extraction, query rewriting, reranking, and auditing instead of a plain recall cache.
- `ref/deep-student/src/stores/researchStore.ts` shows durable research-agent event/state handling rather than ephemeral UI-only traces.

## English

### 1. Definitions

`Canonical resource`
: The authoritative content object stored by the system. It is the source of truth for content lifecycle, deduplication, versioning, and downstream projections.

`Projection`
: A product-facing object derived from the canonical resource. Examples include note, file, translation, exam artifact, research artifact, or flashcard task.

`Unit`
: A structured intermediate object produced from a resource before fine-grained retrieval segmentation. Units are usually page-, section-, or logical-block-level.

`Segment`
: The smallest retrieval-indexed slice. Segments are what lexical, vector, or multimodal retrieval typically operate on.

`Scope entity`
: A durable boundary object such as workspace, corpus, library, or folder-root that survives requests and can be stored, shared, audited, and exported.

`Session state`
: Persisted runtime configuration for a conversation or learning workflow: retrieval toggles, attached resources, drafts, active skills, memory flags, and workspace binding.

`Workflow artifact`
: A durable record produced by a learning workflow, such as a generated question set, review plan, flashcard batch, translation task, or research report.

`Lightweight RAG`
: A retrieval-and-grounding system optimized for local-first execution, bounded memory, explicit indexing lifecycle, and cross-platform portability.

### 2. First-Principles Diagnosis

After Phase 0-6, NoteConnection no longer lacks retrieval closure.

It now has:

- scope-aware retrieval,
- grounded conversation,
- citation-bearing answers,
- conversation memory,
- persisted conversation turns,
- explicit platform render profiles.

That means the next bottleneck is no longer the query loop.
The next bottleneck is the missing substrate under the query loop.

The missing substrate is:

- canonical resource lifecycle,
- projection model,
- unit/segment indexing lifecycle,
- durable workspace entity,
- durable session-state entity,
- typed memory governance,
- workflow artifact persistence.

In short:

- current NoteConnection is strong in graph-aware reasoning and scoped answer generation,
- but still relatively weak in local-first learning-workbench substrate design.

### 3. What Deep Student Actually Adds

#### A. A canonical resource layer

`deep-student` does not treat notes, files, OCR, exams, and retrieval outputs as unrelated silos.
It treats content as a unified VFS resource space and builds product objects around it.

That gives it:

- resource-level deduplication,
- content versioning hooks,
- projection consistency,
- lifecycle visibility,
- export and sync readiness.

NoteConnection currently lacks this formal middle layer.

#### B. A real indexing lifecycle

`deep-student` has explicit units, segments, per-dimension stats, indexing states, and repair migration history.

That gives it:

- index observability,
- partial rebuild semantics,
- multimodal extensibility,
- failure isolation,
- frontend-visible progress and repair states.

NoteConnection currently has retrieval behavior and diagnostics, but not a full unit/segment lifecycle substrate.

#### C. Persistent session state, not only conversation turns

`deep-student` stores session mode, RAG toggles, memory toggles, attachments, panel state, and workspace binding as structured session state.

NoteConnection now persists conversation sessions and turns, but not yet the broader session state envelope for learning workflows.

#### D. Typed memory governance

`deep-student` distinguishes memory type and purpose, supports extraction, rewriting, reranking, and auditing.

NoteConnection memory is already useful, but still lightweight.
It is not yet a governed memory subsystem.

#### E. Workflow artifact durability

`deep-student` treats research, todo, indexing, and learning products as persisted artifacts.

NoteConnection still treats several learning workflows as runtime outputs rather than first-class durable products.

### 4. What NoteConnection Should Not Copy

- Do not replace `KnowledgeAtom` and graph relations with plain chunk-first storage.
- Do not flatten the system into a generic note app with AI plugins.
- Do not force a heavyweight VFS abstraction that ignores graph-native semantics.
- Do not adopt every deep-student module. Its product breadth is wider than NoteConnection’s core mission.

The right move is selective integration:

- keep graph-first retrieval semantics,
- add a better substrate below them.

### 5. Current Missing Layers in NoteConnection

#### Missing Layer 1: Canonical resource substrate

Current issue:

- ingestion goes from document input toward graph units too early,
- but there is no stable resource SSOT between raw content and graph knowledge structures.

Needed:

- one canonical resource model,
- one content hash,
- one projection registry,
- one version and soft-delete story.

#### Missing Layer 2: Projection model

Current issue:

- notes, imports, rendered outputs, learning outputs, and future research outputs do not sit on top of a formal shared projection layer.

Needed:

- note projection,
- attachment/file projection,
- question-bank projection,
- review-plan projection,
- research-report projection,
- flashcard-batch projection.

#### Missing Layer 3: Unit and segment lifecycle

Current issue:

- retrieval works,
- but indexing lifecycle is still mostly implicit.

Needed:

- explicit `unit`,
- explicit `segment`,
- explicit `pending/indexing/indexed/failed/disabled`,
- explicit rebuild and orphan cleanup behavior,
- explicit progress and diagnostics surfaces.

#### Missing Layer 4: Durable workspace entity

Current issue:

- current `scope` is a request contract and runtime filter,
- not yet a durable entity with identity, metadata, export rules, or ownership.

Needed:

- `workspace` / `corpus` persisted as entities,
- clear mapping from resources to workspace,
- export and access rules on those entities,
- mobile slim package generation based on workspace.

#### Missing Layer 5: Persistent learning session state

Current issue:

- turns are persisted,
- but session configuration is still not a complete domain object.

Needed:

- retrieval flags,
- active resource set,
- chosen learning mode,
- memory mode,
- active export profile,
- view/pane state where useful.

#### Missing Layer 6: Typed memory governance

Current issue:

- memory exists,
- recall exists,
- but type/purpose/promotion/audit semantics remain thin.

Needed:

- memory classification,
- purpose weighting,
- structured extraction,
- search-time weighting,
- audit trail,
- privacy/system separation.

#### Missing Layer 7: Workflow artifact persistence

Current issue:

- learning path and study session exist,
- but several downstream learning artifacts are still not durable first-class records.

Needed:

- persisted review plans,
- persisted question-set generations,
- persisted flashcard generation jobs,
- persisted research/report artifacts,
- stable linking between artifacts and source scope.

### 6. Target Next Architecture

The next target architecture should be:

1. `Raw source layer`
   - imported notes, files, OCR text, generated outputs.
2. `Canonical resource layer`
   - deduplicated content SSOT with version and lifecycle metadata.
3. `Projection layer`
   - notes, files, exams, translations, research outputs, review outputs.
4. `Unit layer`
   - page/section/logical-block intermediate units.
5. `Segment layer`
   - retrieval-indexed slices with lexical/vector/multimodal metadata.
6. `Graph knowledge layer`
   - atoms, evidence spans, relation edges, temporal edges.
7. `Scoped retrieval/runtime layer`
   - existing NoteConnection strengths.
8. `Session/memory/workflow layer`
   - durable state and artifact orchestration.
9. `Platform shell layer`
   - desktop, Godot, mobile slim.

This preserves NoteConnection’s graph-native strengths while fixing the missing substrate.

### 7. Recommended Program

## Program A: Resource substrate and projections

Goal:

- introduce a resource SSOT below graph ingestion.

Implementation units:

- Add a canonical resource model.
- Add projection records for note/file/import/retrieval-artifact.
- Add content hash and version metadata.
- Add soft-delete and lifecycle status.

Primary files:

- add `src/resources/`
- add `src/resources/types.ts`
- add `src/resources/ResourceRegistry.ts`
- extend `src/learning/store.ts`
- extend `src/learning/KnowledgeLearningPlatform.ts`

Tests:

- add `src/resources/ResourceRegistry.test.ts`
- add `src/resources/resourceProjection.test.ts`
- extend `src/learning/KnowledgeLearningPlatform.persistence.test.ts`

## Program B: Unit and segment indexing lifecycle

Goal:

- make indexing explicit and observable.

Implementation units:

- Add unit-building from resource projections.
- Add segment-building from units.
- Add segment metadata for retrieval backends.
- Add indexing state machine and rebuild APIs.

Primary files:

- add `src/indexing/`
- add `src/indexing/UnitBuilder.ts`
- add `src/indexing/SegmentBuilder.ts`
- add `src/indexing/IndexLifecycle.ts`
- integrate with `src/learning/queryBackend.ts`

Tests:

- add `src/indexing/UnitBuilder.test.ts`
- add `src/indexing/SegmentBuilder.test.ts`
- add `src/indexing/IndexLifecycle.test.ts`

## Program C: Durable workspace/corpus entities

Goal:

- upgrade scope from request filter to durable system entity.

Implementation units:

- Define `workspace` and `corpus` records.
- Map resources to corpora.
- Let query scope resolve through durable ids instead of only source-path derivation.
- Add export-profile binding at workspace level.

Primary files:

- add `src/workspace/`
- add `src/workspace/types.ts`
- add `src/workspace/WorkspaceRegistry.ts`
- update `src/learning/types.ts`
- update `src/learning/KnowledgeLearningPlatform.ts`

Tests:

- add `src/workspace/WorkspaceRegistry.test.ts`
- add `src/learning/query.scope.entity.test.ts`

## Program D: Session state and workflow durability

Goal:

- persist learning workflow configuration as structured state.

Implementation units:

- Add session state object beyond turns.
- Persist active retrieval settings, scope bindings, and mode flags.
- Introduce workflow artifacts for:
  - review plan,
  - question generation,
  - flashcard batch,
  - research report.

Primary files:

- add `src/session/`
- add `src/workflows/`
- extend `src/learning/store.ts`
- extend `src/learning/KnowledgeLearningPlatform.ts`

Tests:

- add `src/session/SessionStateStore.test.ts`
- add `src/workflows/WorkflowArtifactStore.test.ts`

## Program E: Memory governance 2.0

Goal:

- turn memory into a governed subsystem.

Implementation units:

- Add memory type and purpose.
- Add weighted recall and promotion policy.
- Add extraction and audit hooks.
- Separate user-visible memory from system memory.

Primary files:

- extend `src/learning/types.ts`
- extend `src/learning/KnowledgeLearningPlatform.ts`
- add `src/memory/`

Tests:

- add `src/memory/MemoryClassification.test.ts`
- add `src/memory/MemoryAudit.test.ts`
- extend `src/learning/KnowledgeLearningPlatform.test.ts`

## Program F: Multimodal and export convergence

Goal:

- make desktop and mobile export use the same durable substrate.

Implementation units:

- resource -> unit -> segment packaging for mobile slim
- PNG-first artifact generation where required
- workspace-scoped export bundles
- index-state-aware export readiness checks

Primary files:

- extend `src/platform/`
- extend `src/routes/render.ts`
- add `src/export/`

Tests:

- add `src/export/WorkspaceExportBundle.test.ts`
- extend `src/platform/PlatformCapabilities.test.ts`
- extend `src/platform/RenderMaterializer.test.ts`

### Program A-F Implementation Status (2026-05-26)

Current HEAD now includes the planned substrate and export closure through Program F.

Implemented at HEAD:

- Program A: canonical resource substrate via `src/resources/` with stable resource/projection persistence,
- Program B: unit/segment indexing lifecycle via `src/indexing/` and indexed-scope-aware retrieval filtering,
- Program C: durable workspace/corpus entities via `src/workspace/` and projection bindings,
- Program D: persistent session/workflow state via `src/session/`, `src/workflows/`, and `KnowledgeLearningPlatform.ts`,
- Program E: typed memory governance via `src/memory/MemoryGovernance.ts`, scoped memory metadata, promotion, weighting, and audit records,
- Program F: deterministic workspace-scoped export bundles via `src/export/WorkspaceExportBundle.ts` and `POST /api/knowledge/export/workspace`.

Fresh verification evidence:

- `npm.cmd run build:mini`
- `npm.cmd test -- --runInBand src/resources/ResourceRegistry.test.ts src/workspace/WorkspaceRegistry.test.ts src/indexing/IndexLifecycle.test.ts src/session/SessionStateStore.test.ts src/workflows/WorkflowArtifactStore.test.ts src/memory/MemoryGovernance.test.ts src/export/WorkspaceExportBundle.test.ts src/platform/PlatformCapabilities.test.ts src/platform/RenderMaterializer.test.ts src/routes/registry.contract.test.ts src/learning/store.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts`

Result:

- the Program F export path now uses the same durable substrate as retrieval, learning sessions, workflow artifacts, and governed memory,
- mobile slim and desktop export decisions now derive from the same workspace/resource/index state rather than ad hoc runtime-only assumptions.

### 8. Sequence

The correct order is:

1. Program A
2. Program B
3. Program C
4. Program D
5. Program E
6. Program F

Reason:

- resource SSOT must exist before projections are stable,
- projections must exist before unit/segment indexing is stable,
- durable workspace entity must exist before export bundles are real,
- session and memory governance should sit on top of stable resource and scope layers,
- multimodal/export convergence depends on all previous layers.

### 9. Tradeoffs

#### Graph-first vs VFS-first

Do not choose one over the other.

Use:

- VFS/resource substrate for lifecycle and portability,
- graph layer for reasoning and learning semantics.

#### Thin resource layer vs full workbench substrate

Choose a thin but formal substrate first.

Do not implement every deep-student product module.
Implement the minimum substrate that lets new modules become durable later.

#### Fast feature delivery vs data governance

At this stage, governance wins.

Without resource, workspace, session, and memory durability, new AI features will increase state entropy.

### 10. Common Mistakes

- Treating `scope` as equivalent to `workspace`.
- Treating `KnowledgeAtom` as equivalent to `resource`.
- Adding workflow UIs before artifact persistence exists.
- Adding multimodal retrieval before unit and segment lifecycle exists.
- Mixing system memory and user-visible memory into one bucket.
- Shipping mobile exports that depend on implicit desktop assumptions.

### 11. Best Practices

- Keep one canonical resource hash per source payload.
- Make all workflow outputs link back to resource and workspace ids.
- Keep graph reasoning above, not inside, the resource substrate.
- Add explicit indexing lifecycle states before adding more retrieval backends.
- Keep export bundles deterministic and workspace-scoped.
- Audit all memory promotion events.

### 12. Real Application to NoteConnection

For a note, PDF, or future review artifact in NoteConnection, the ideal flow becomes:

`source import -> canonical resource -> projection -> unit -> segment -> graph atom/evidence -> scoped retrieval -> grounded answer -> workflow artifact -> export bundle`

That gives the project:

- stronger local-first behavior,
- better mobile export readiness,
- reproducible retrieval,
- durable learning artifacts,
- safer future agent autonomy.

### 13. Five-Point Summary

1. After Phase 0-6, NoteConnection’s next bottleneck is no longer retrieval correctness. It is substrate design.
2. `deep-student` is strongest where NoteConnection is currently weaker: canonical resources, indexing lifecycle, session state, memory governance, and workflow artifacts.
3. NoteConnection should not copy the full product. It should selectively import the substrate ideas while keeping graph-first reasoning.
4. The next implementation program should start with resource SSOT, then projection, then unit/segment lifecycle, then workspace/session/memory/workflow durability.
5. Multiplatform export and lightweight RAG become much more robust once those substrate layers exist as durable system entities.

## 中文

### 1. 术语定义

`Canonical resource`
: 系统内部真正的内容 SSOT。它不是 UI 视图，也不是索引副本，而是负责内容生命周期、去重、版本和下游投影的权威对象。

`Projection`
: 基于 canonical resource 派生出来的业务对象，例如 note、file、translation、exam artifact、research artifact 等。

`Unit`
: 进入精细检索切分之前的中间对象，通常是页级、节级或逻辑块级。

`Segment`
: 最终进入检索层的最小索引切片，是 lexical / vector / multimodal retrieval 的直接输入。

`Scope entity`
: 可持久化、可共享、可审计的作用域边界实体，例如 workspace、corpus、library，而不是一次请求里的字符串过滤条件。

`Session state`
: 一次会话或学习流程的持久化运行时配置，包括 RAG 开关、附件、草稿、技能、memory flag、workspace 绑定等。

`Workflow artifact`
: 某个学习流程产出的持久化对象，例如复习计划、题集生成结果、闪卡批任务、研究报告。

`Lightweight RAG`
: 以本地优先、内存受控、索引生命周期显式化、跨平台可移植为目标的检索与 grounding 系统。

### 2. 第一性原理诊断

完成 Phase 0-6 之后，NoteConnection 的主要短板已经不再是 retrieval loop 本身。

现在已经有：

- scoped retrieval，
- grounded conversation，
- citation-bearing answers，
- conversation memory，
- persisted turns，
- explicit platform render profiles。

所以下一个瓶颈不再是“如何查得更像 RAG”，而是“RAG 下面的数据底座还不够正式”。

真正缺的是：

- canonical resource lifecycle，
- projection model，
- unit/segment indexing lifecycle，
- durable workspace entity，
- durable session-state entity，
- typed memory governance，
- workflow artifact persistence。

也就是说：

- 当前 NoteConnection 强在 graph-aware reasoning 和 scoped answer generation，
- 但还弱在 local-first learning workbench 的 substrate 设计。

### 3. Deep Student 真正补上的是什么

#### A. Canonical resource layer

`deep-student` 没有把 note、file、OCR、exam、retrieval output 当成互不相关的孤岛。
它用统一 VFS resource 层承载内容 SSOT，再在其上建业务投影。

这带来的能力是：

- resource 级去重，
- 内容版本钩子，
- projection 一致性，
- 生命周期可见性，
- export / sync 就绪。

这是 NoteConnection 目前正式缺失的中间层。

#### B. 真正的 indexing lifecycle

`deep-student` 有显式的 unit、segment、按维度统计、索引状态和 repair migration 历史。

这意味着它具备：

- index observability，
- partial rebuild semantics，
- multimodal extensibility，
- failure isolation，
- frontend-visible progress and repair states。

NoteConnection 现在有 retrieval 行为和 diagnostics，但还没有完整的 unit/segment substrate。

#### C. Persistent session state

`deep-student` 把 session mode、RAG 开关、memory 开关、attachments、panel state、workspace binding 存成结构化 session state。

NoteConnection 虽然已经有 turn/session persistence，但还没有更宽的 session-state envelope。

#### D. Typed memory governance

`deep-student` 的 memory 有 type、purpose、extraction、query rewrite、rerank、audit。

NoteConnection 的 memory 已经从早期状态前进很多，但还不是完整治理子系统。

#### E. Workflow artifact durability

`deep-student` 把 research、todo、indexing、learning 结果视为 durable artifact。

NoteConnection 目前仍有不少学习流程结果停留在 runtime output，而不是一等持久化对象。

### 4. NoteConnection 不该照搬的部分

- 不要把 `KnowledgeAtom` 和图关系替换成普通 chunk-first 存储。
- 不要把系统压平为通用 note app + AI plugin。
- 不要为了补 substrate 而让 graph-native semantics 退化。
- 不要整套搬运 deep-student 的产品面，它的宽度大于 NoteConnection 当前主线。

正确方向是选择性集成：

- 保持 graph-first retrieval semantics，
- 在其下方补 formal substrate。

### 5. 当前 NoteConnection 还缺的层

#### 缺失层 1：Canonical resource substrate

当前问题：

- ingestion 过早从 document 直接进入 graph unit，
- raw content 与 graph knowledge 之间没有稳定 resource SSOT。

需要：

- 一个 canonical resource model，
- 一个 content hash，
- 一个 projection registry，
- 一个 version 与 soft-delete 语义。

#### 缺失层 2：Projection model

当前问题：

- note、import、rendered output、learning output、未来 research output 还没有正式共用的 projection 层。

需要：

- note projection，
- attachment/file projection，
- question-bank projection，
- review-plan projection，
- research-report projection，
- flashcard-batch projection。

#### 缺失层 3：Unit / segment lifecycle

当前问题：

- retrieval 已经能工作，
- 但 indexing lifecycle 仍然偏隐式。

需要：

- 显式 `unit`，
- 显式 `segment`，
- 显式 `pending/indexing/indexed/failed/disabled`，
- 显式 rebuild / orphan cleanup 行为，
- 显式 progress / diagnostics 面。

#### 缺失层 4：Durable workspace entity

当前问题：

- 当前 `scope` 是请求契约和运行时过滤器，
- 还不是带 identity、metadata、export 规则和 ownership 的持久化实体。

需要：

- `workspace` / `corpus` 实体化，
- resource 到 corpus 的稳定映射，
- 这些实体上的 export / access 规则，
- 基于 workspace 的 mobile slim package 生成。

#### 缺失层 5：Persistent learning session state

当前问题：

- turns 已经持久化，
- 但 session configuration 还不是完整的领域对象。

需要：

- retrieval flags，
- active resource set，
- chosen learning mode，
- memory mode，
- active export profile，
- 必要的 pane/view state。

#### 缺失层 6：Typed memory governance

当前问题：

- memory 有了，
- recall 有了，
- 但 type/purpose/promotion/audit 语义仍偏薄。

需要：

- memory classification，
- purpose weighting，
- structured extraction，
- search-time weighting，
- audit trail，
- user-visible memory 与 system memory 的分层。

#### 缺失层 7：Workflow artifact persistence

当前问题：

- learning path 和 study session 已存在，
- 但下游学习产物还没有全面成为 durable first-class record。

需要：

- persisted review plan，
- persisted question-set generation，
- persisted flashcard generation jobs，
- persisted research/report artifacts，
- artifact 与 source scope 的稳定链接。

### 6. 目标下一阶段架构

推荐的目标架构是：

1. `Raw source layer`
   - imported notes, files, OCR text, generated outputs
2. `Canonical resource layer`
   - deduplicated content SSOT with version and lifecycle metadata
3. `Projection layer`
   - notes, files, exams, translations, research outputs, review outputs
4. `Unit layer`
   - page/section/logical-block intermediate units
5. `Segment layer`
   - retrieval-indexed slices with lexical/vector/multimodal metadata
6. `Graph knowledge layer`
   - atoms, evidence spans, relation edges, temporal edges
7. `Scoped retrieval/runtime layer`
   - 当前 NoteConnection 已较强
8. `Session/memory/workflow layer`
   - durable state and artifact orchestration
9. `Platform shell layer`
   - desktop, Godot, mobile slim

这条路线保留 NoteConnection 的 graph-native 优势，同时补上缺失的数据底座。

### 7. 推荐推进程序

#### Program A：Resource substrate 与 projections

目标：

- 在 graph ingestion 之下引入 resource SSOT。

实施单元：

- 增加 canonical resource model
- 增加 note/file/import/retrieval-artifact projection
- 增加 content hash 与 version metadata
- 增加 soft-delete 与 lifecycle status

主文件：

- 新增 `src/resources/`
- 新增 `src/resources/types.ts`
- 新增 `src/resources/ResourceRegistry.ts`
- 扩展 `src/learning/store.ts`
- 扩展 `src/learning/KnowledgeLearningPlatform.ts`

测试：

- 新增 `src/resources/ResourceRegistry.test.ts`
- 新增 `src/resources/resourceProjection.test.ts`
- 扩展 `src/learning/KnowledgeLearningPlatform.persistence.test.ts`

#### Program B：Unit 与 segment indexing lifecycle

目标：

- 让 indexing 变成显式、可观测、可修复的系统层。

实施单元：

- 从 resource projection 构建 unit
- 从 unit 构建 segment
- 给 segment 增加 retrieval metadata
- 增加 indexing state machine 与 rebuild API

主文件：

- 新增 `src/indexing/`
- 新增 `src/indexing/UnitBuilder.ts`
- 新增 `src/indexing/SegmentBuilder.ts`
- 新增 `src/indexing/IndexLifecycle.ts`
- 与 `src/learning/queryBackend.ts` 集成

测试：

- 新增 `src/indexing/UnitBuilder.test.ts`
- 新增 `src/indexing/SegmentBuilder.test.ts`
- 新增 `src/indexing/IndexLifecycle.test.ts`

#### Program C：Durable workspace/corpus entities

目标：

- 把 scope 从 request filter 升级为 durable system entity。

实施单元：

- 定义 `workspace` / `corpus` 实体
- 建立 resource -> corpus 映射
- query scope 通过 durable id 解析，而不是只靠 sourcePath 推导
- 在 workspace 上绑定 export profile

主文件：

- 新增 `src/workspace/`
- 新增 `src/workspace/types.ts`
- 新增 `src/workspace/WorkspaceRegistry.ts`
- 更新 `src/learning/types.ts`
- 更新 `src/learning/KnowledgeLearningPlatform.ts`

测试：

- 新增 `src/workspace/WorkspaceRegistry.test.ts`
- 新增 `src/learning/query.scope.entity.test.ts`

#### Program D：Session state 与 workflow durability

目标：

- 将学习工作流配置持久化为结构化 state。

实施单元：

- 增加 turn 之外的 session state
- 持久化 retrieval settings、scope binding、mode flags
- 为以下对象增加 workflow artifact：
  - review plan
  - question generation
  - flashcard batch
  - research report

主文件：

- 新增 `src/session/`
- 新增 `src/workflows/`
- 扩展 `src/learning/store.ts`
- 扩展 `src/learning/KnowledgeLearningPlatform.ts`

测试：

- 新增 `src/session/SessionStateStore.test.ts`
- 新增 `src/workflows/WorkflowArtifactStore.test.ts`

#### Program E：Memory governance 2.0

目标：

- 把 memory 从 recall cache 升级为 governed subsystem。

实施单元：

- 增加 memory type 与 purpose
- 增加 weighted recall 与 promotion policy
- 增加 extraction 与 audit hooks
- 分离 user-visible memory 与 system memory

主文件：

- 扩展 `src/learning/types.ts`
- 扩展 `src/learning/KnowledgeLearningPlatform.ts`
- 新增 `src/memory/`

测试：

- 新增 `src/memory/MemoryClassification.test.ts`
- 新增 `src/memory/MemoryAudit.test.ts`
- 扩展 `src/learning/KnowledgeLearningPlatform.test.ts`

#### Program F：Multimodal 与 export convergence

目标：

- 让桌面与移动导出使用同一套 durable substrate。

实施单元：

- resource -> unit -> segment packaging for mobile slim
- PNG-first artifact generation where required
- workspace-scoped export bundles
- index-state-aware export readiness checks

主文件：

- 扩展 `src/platform/`
- 扩展 `src/routes/render.ts`
- 新增 `src/export/`

测试：

- 新增 `src/export/WorkspaceExportBundle.test.ts`
- 扩展 `src/platform/PlatformCapabilities.test.ts`
- 扩展 `src/platform/RenderMaterializer.test.ts`

### Program A-F 实施状态（2026-05-26）

当前 HEAD 已按计划完成到 Program F 的 substrate 与导出闭环。

当前 HEAD 已落地：

- Program A：通过 `src/resources/` 建立 canonical resource substrate，并支持稳定的 resource / projection 持久化，
- Program B：通过 `src/indexing/` 建立 unit / segment indexing lifecycle，并让检索显式受 indexed scope 约束，
- Program C：通过 `src/workspace/` 与 projection binding 建立 durable workspace / corpus entity，
- Program D：通过 `src/session/`、`src/workflows/` 与 `KnowledgeLearningPlatform.ts` 建立持久化 session / workflow state，
- Program E：通过 `src/memory/MemoryGovernance.ts` 建立 typed memory governance，并补齐 scoped memory metadata、promotion、weighting 与 audit，
- Program F：通过 `src/export/WorkspaceExportBundle.ts` 与 `POST /api/knowledge/export/workspace` 建立 deterministic、workspace-scoped export bundle。

最新验证证据：

- `npm.cmd run build:mini`
- `npm.cmd test -- --runInBand src/resources/ResourceRegistry.test.ts src/workspace/WorkspaceRegistry.test.ts src/indexing/IndexLifecycle.test.ts src/session/SessionStateStore.test.ts src/workflows/WorkflowArtifactStore.test.ts src/memory/MemoryGovernance.test.ts src/export/WorkspaceExportBundle.test.ts src/platform/PlatformCapabilities.test.ts src/platform/RenderMaterializer.test.ts src/routes/registry.contract.test.ts src/learning/store.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts`

结论：

- Program F 的 export path 现在与 retrieval、learning session、workflow artifact、governed memory 共享同一套 durable substrate，
- mobile slim 与 desktop 的导出决策现在都建立在同一份 workspace / resource / index 状态之上，而不再依赖临时 runtime-only 假设。

### 8. 顺序

正确顺序是：

1. Program A
2. Program B
3. Program C
4. Program D
5. Program E
6. Program F

原因：

- resource SSOT 必须先存在，projection 才稳定；
- projection 稳定后，unit/segment indexing lifecycle 才有正式落点；
- workspace entity 稳定后，export bundle 才真实存在；
- session / memory governance 应建立在稳定的 resource 与 scope 层之上；
- multimodal / export convergence 依赖前面所有层。

### 9. 权衡

#### Graph-first 还是 VFS-first

不要二选一。

应该用：

- VFS/resource substrate 解决生命周期与可移植性；
- graph layer 解决推理与学习语义。

#### Thin resource layer 还是 full workbench substrate

先做 thin but formal substrate。

不要先复制 deep-student 的全部产品模块。
先补最小底座，让后续模块自然成为 durable product。

#### 快速堆功能 还是 先补 data governance

当前阶段，governance 优先。

如果没有 resource、workspace、session、memory 的 durability，再加新 AI 功能只会制造更高状态熵。

### 10. 常见误区

- 把 `scope` 当成 `workspace`
- 把 `KnowledgeAtom` 当成 `resource`
- 在 workflow artifact 持久化前先堆 workflow UI
- 在 unit/segment lifecycle 存在前先堆 multimodal retrieval
- 把 system memory 和 user-visible memory 混成一个桶
- 发布 mobile export 时继续默认继承桌面端假设

### 11. 最佳实践

- 每份 source payload 只保留一个 canonical resource hash
- 所有 workflow output 都回链到 resource id 与 workspace id
- graph reasoning 层在 resource substrate 之上，而不是替代 resource substrate
- 在继续加 retrieval backend 前，先把 indexing lifecycle 状态显式化
- export bundle 必须 deterministic 且 workspace-scoped
- 所有 memory promotion 事件都应有 audit

### 12. 在 NoteConnection 中的真实落地形态

对于一份 note、PDF 或未来的 review artifact，理想流转应为：

`source import -> canonical resource -> projection -> unit -> segment -> graph atom/evidence -> scoped retrieval -> grounded answer -> workflow artifact -> export bundle`

这样才能获得：

- 更强的 local-first 行为
- 更好的 mobile export readiness
- 更可复现的 retrieval
- 更 durable 的学习产物
- 更安全的未来 autonomy

### 13. 五点总结

1. 在 Phase 0-6 之后，NoteConnection 的主要短板已经不是 retrieval correctness，而是 substrate design。
2. `deep-student` 最值得借鉴的是 canonical resources、indexing lifecycle、session state、memory governance、workflow artifacts。
3. NoteConnection 不该照搬整个产品，而应保持 graph-first 内核，只吸收 substrate 层思路。
4. 下一阶段应该优先补 `resource SSOT -> projection -> unit/segment lifecycle -> workspace/session/memory/workflow durability`。
5. 一旦这些层落地，多平台导出与 lightweight RAG 会比现在更 elegant、也更 robust。

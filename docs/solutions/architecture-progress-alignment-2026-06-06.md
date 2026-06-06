---
module: architecture
tags: [implementation, progress, roadmap, compatibility, robustness]
problem_type: tracking
created: 2026-06-06
updated: 2026-06-06
status: active
version: 2026.06.06
---

# 2026-06-06 v1.7.0 - Architecture Progress Alignment and Mainline Plan

## English Document

### Objective

This document records the concrete mainline plan after re-reading the current code, the active progress dashboards, and the prior architecture plans. The initial 2026-06-06 slice was documentation and governance only; subsequent P1 updates in this same note record release-evidence tooling progress without changing public runtime APIs.

The goal is to make the current `main` truth explicit:

- which parts of the previous RAG / agent / export plans are already code-backed,
- which claims are still only operational baselines and not production closure,
- where architecture pressure is now concentrated,
- what the next forward-compatible and robust implementation sequence should be.

### Evidence Base

Current branch and workspace state used for this alignment:

- branch: `main`
- upstream sync: the initial alignment started from a synced baseline; later local P1 continuation commits may leave `main` ahead of `origin/main` until an explicit push
- initial worktree state: clean
- source files and route registries were re-read from the current workspace, not inferred from older plans

Primary code evidence:

| Area | Code evidence | Current reading |
|---|---|---|
| Route registry | `src/routes/index.ts`, `src/server.ts`, `src/routes/registry.contract.test.ts` | Modular route registration exists across knowledge, NoteMD, markdown, render, settings, diagnostics, data, and agent-workspace diagnostics. `server.ts` still owns substantial inline orchestration and fallback behavior. |
| Learning API contract | `src/learning/api.ts`, `src/learning/types.ts` | Knowledge ingest/query/conversation, tutor, memory, quality, guardrail, runtime-state, and workspace-export contracts are typed and exposed through `KnowledgeLearningPlatformAPI`. |
| Scope and retrieval | `src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts` | `KnowledgeQueryRequest.scope`, `KnowledgeCorpusScope`, workspace readiness, miss diagnostics, planner fields, and scoped conversation traces exist in code. |
| Conversation runtime | `src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/server.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js` | `AgentConversationRequest`, `AgentConversationResponse`, citations, memory actions, `assistantBlocks`, turn events, stream/replay/turn-cache diagnostics, and operator cards are present. |
| Durable substrate | `src/resources/`, `src/indexing/`, `src/workspace/`, `src/session/`, `src/workflows/`, `src/memory/`, `src/export/` | Program A-F substrate exists: resources, units/segments, workspace bindings, session/workflow state, governed memory, and deterministic workspace export bundles. |
| Platform/export profile | `src/platform/PlatformCapabilities.ts`, `src/platform/RenderMaterializer.ts`, `src/routes/render.ts`, `src/export/WorkspaceExportBundle.ts` | Export profiles and PNG-first Godot/mobile materialization are first-class, preserving the Godot SVG limitation boundary. |
| Rollout governance | `src/learning/store.ts`, `src/learning/queryBackend.ts`, `src/learning/vectorAccelerationAdapter.ts`, `src/learning/runtimeCapability.ts`, `src/server.ts` | Graphdb adapter selection, external HTTP connector telemetry, vector `fail_open` / `fail_closed`, rollout profile payloads, and runbook checks exist. |
| Architecture pressure | line-count scan on current `main` | `src/server.ts` is about 15,920 lines, `KnowledgeLearningPlatform.ts` about 10,351 lines, `path_app.js` about 4,943 lines, `app.js` about 5,953 lines, and `agent_workspace.js` about 3,237 lines. |

Primary plan evidence:

- `docs/brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md`
- `docs/brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md`
- `docs/solutions/implementation-plan-2026-05-08.md`
- `docs/solutions/implementation-gap-analysis-2026-05-04.md`
- `docs/diataxis/en/explanation/development-progress-dashboard.md`
- `docs/diataxis/zh/explanation/development-progress-dashboard.md`

### Plan Requirements vs Current Code

| Prior requirement | Current code reality | Status | Main risk |
|---|---|---|---|
| One canonical conversation contract and reduced API drift | Typed request/response, stream events, replay semantics, turn-cache diagnostics, and frontend contract parity exist. However, the conversation runtime still has major ownership inside `src/server.ts`, so route ownership is not fully converged. | Operational, not fully simplified | Contract growth continues inside the server monolith. |
| Scope-bound retrieval | `KnowledgeCorpusScope`, workspace/corpus fields, active-target hydration, workspace readiness, and miss diagnostics exist. Program F also supplies resource/index/workspace substrate. | Largely implemented | Release claims still depend on graphdb/ANN calibration, not just scope fields. |
| Multilingual and lightweight local RAG direction | Local vector and external connector governance exist, with rollout context and ANN runbook gates. | Operational baseline | Recall/latency thresholds and release-grade calibration remain open. |
| Grounded answer synthesis | `AgentConversationResponse` now includes `answer`, citations, knowledge points, memory actions, trace, and optional `assistantBlocks`. Tauri reply rendering consumes typed blocks when present and falls back to `assistantMessage`. | Operational baseline | More endpoints need to emit richer block payloads without breaking legacy clients. |
| Memory and invocation loop | Conversation sessions, turns, invocation records, conversation-memory APIs, memory governance, and export inclusion exist. | Implemented baseline | Memory policy is useful but still lighter than a full production memory subsystem with deeper extraction/reranking/audits. |
| Resource / projection / unit / segment substrate | Program A-F directories and tests exist. Workspace export bundles are deterministic and workspace-scoped. | Implemented | Future work must avoid bypassing this substrate with ad hoc runtime outputs. |
| Platform shell separation | Export profiles, materialization decisions, PNG-first Godot/mobile behavior, and sidecar/build contracts are explicit. | Implemented | New render/runtime features must keep Godot constraints at adapter boundaries, not in core RAG logic. |
| Packaging matrix discipline | Tauri desktop, Tauri Android, sidecar readiness, LFS policy, SBOM, and release workflow gates exist. | Strong governance baseline | Some proof is host-dependent; Linux strict Tauri evidence and FR-009 real-device evidence remain release gates. |
| Architecture reduction | Modular routes and extracted domain modules exist, but `server.ts`, `KnowledgeLearningPlatform.ts`, and frontend host files remain oversized. | Behind target | Adding more orchestration without ownership cuts will worsen maintainability. |

### Architecture Progress Map

| Layer | Current maturity | Evidence | Next movement |
|---|---|---|---|
| Graph/path core | Mature operational baseline | `src/core/`, `src/backend/`, path bridge tests | Keep compatibility and focus only on targeted defects. |
| Runtime storage/retrieval | Operational baseline | `graphdb/sqlite`, external graphdb HTTP, vector acceleration rollout controls | Close soak, latency, recall, and strict rollout calibration before calling production closure. |
| Scoped RAG/conversation | Operational baseline | scoped query, citations, answer, `assistantBlocks`, turn stream/replay | Move ownership toward a smaller conversation module while preserving response compatibility. |
| Memory/session/workflow | Implemented substrate | `src/memory/`, `src/session/`, `src/workflows/`, conversation records | Harden policy quality and auditability rather than adding UI-only state. |
| Export/platform shell | Implemented baseline | export profiles, render materializer, workspace export bundle | Keep mobile/Godot export constraints explicit and test-backed. |
| Governance and CI | Strong but not complete | docs gates, route/agent contracts, runtime verifiers, SBOM/sidecar gates | Keep evidence freshness and host-specific release gates separate from implementation-complete claims. |

### Concrete Mainline Plan

#### P0: Keep documentation truth synchronized

- Treat this document and the development-progress dashboard as the active architecture truth.
- Keep `docs/en|zh/task.md`, `docs/en|zh/implementation_plan.md`, `docs/en|zh/TODO.md`, README, and interface docs aligned whenever code or release gates change.
- Do not mark a capability production-closed unless runtime evidence and release-grade thresholds both exist.

#### P1: Finish release-grade graphdb and ANN closure

- Promote the sqlite soak verifier into repeated release evidence, not a one-off host proof.
- Keep `verify:foundation:sqlite-runtime:release` as the release-facing alias for sqlite soak evidence, and keep foundation readiness mandatory checks aligned with both sqlite and ANN release gates.
- Add and keep `verify:foundation:release-evidence` as the lightweight release-evidence freshness check that reads the latest sqlite soak and ANN release-gate reports before operators treat host evidence as current.
- Keep `verify:foundation:release-evidence` backward-compatible with a minimum of 1 fresh release-contract report per component, and use `verify:foundation:release-evidence:strict` / `--min-report-count` when a release runbook needs repeated evidence; foundation readiness exposes that strict audit as `foundation_release_evidence_history`.
- Treat old stale or non-release historical reports as warnings in the default audit, while counting only fresh reports that still satisfy the current sqlite soak or ANN release-gate contract.
- Current Windows-host strict evidence now passes with sqlite `3/3` and ANN `3/3`; this closes local repeated evidence, not multi-host calibration or production closure.
- Tighten graphdb connector health/budget thresholds with representative workloads.
- Use the new ANN release-gate verifier path (`verify:foundation:ann-runtime:release`) as the structured evidence entry point for startup, ingest, diagnostics, query latency, and targeted-query recall.
- Calibrate ANN recall/latency and external connector behavior under full workload matrices before promoting Phase-2 diagnostics to release gates.

#### P2: Cut ownership pressure out of `server.ts`

- Move conversation turn cache, alert trend, runbook bridge, and graphdb rollout helper logic behind explicit modules.
- Keep HTTP request validation at route edges and keep internal invariants trusted after validation.
- Preserve old response fields such as `assistantMessage` while making typed block output the preferred path.

#### P3: Split the learning platform implementation by domain ownership

- Continue the existing domain extraction direction around ingest, query, conversation, mastery, quality, tutor, and memory.
- Extract only when the new owner hides real state or enforces a real invariant.
- Avoid pass-through facades that only rename `KnowledgeLearningPlatform` methods.

#### P4: Harden the agent workspace contract without widening scope blindly

- Keep capability registry parity tests as the main drift gate.
- Add richer assistant block coverage only when a backend endpoint can produce structured payloads deterministically.
- Keep stream-first plus sync fallback behavior and turn replay compatibility intact.

#### P5: Keep platform and export compatibility explicit

- Preserve PNG-first Godot/mobile materialization.
- Keep desktop-full, desktop-reader, godot-path-mode, and mobile-slim semantics in one export-profile model.
- Do not let mobile or Godot constraints leak into the core retrieval/synthesis contract.

### Forward-Compatibility and Robustness Guardrails

- Keep additive response evolution: new fields are optional, old fields remain valid.
- Validate at HTTP/runtime boundaries once, then let internal code rely on normalized contracts.
- Keep fallback semantics explicit: graphdb fallback, vector `fail_open` / `fail_closed`, reader frontend-first plus backend PNG fallback, and Tauri/browser sync fallback must remain observable.
- Keep operational evidence separate from production closure. A passing host verifier proves a baseline, not a release threshold.
- Avoid changing public endpoint names unless a compatibility shim and tests land in the same slice.
- Avoid direct SVG dependence in Godot paths.

### Current Verification Position

The initial 2026-06-06 alignment slice was documentation-only. The current P1 continuation changes verifier tooling, package scripts, tests, readiness mandatory checks, and documentation while preserving public runtime API compatibility.

The appropriate verification gate for this continuation is:

- foundation release-evidence contract test,
- default foundation release-evidence audit,
- migration test suite,
- docs map validation,
- docs site build,
- markdown/Mermaid fence guard,
- git diff review,
- final clean worktree after commit.

`verify:foundation:release-evidence:strict` is intentionally a strict repeated-evidence gate, and `getFoundationReadiness().mandatoryChecks` exposes it as `foundation_release_evidence_history`. It now passes on the current Windows host after refreshed sqlite and ANN reports, with sqlite `3/3` and ANN `3/3`. Other hosts or future release windows must regenerate their own report history before relying on the strict gate.

Runtime and test gates for future code slices remain:

- `npm run verify:foundation:sqlite-runtime:soak`
- `npm run verify:foundation:sqlite-runtime:matrix`
- `npm run verify:foundation:ann-runtime:matrix`
- `npm run verify:foundation:ann-runtime:release`
- `npm run verify:foundation:release-evidence`
- `npm run verify:foundation:release-evidence:strict`
- `npm run test:agent-workspace:contracts`
- `npm run test:migration`
- `npm run verify:core-real-machine:clean`

## 中文文档

### 目标

本文档在重新阅读当前代码、活跃进度看板和先前架构方案之后，落盘当前 `main` 主线的具体推进方案。2026-06-06 首个切片是文档与治理切片；同一文档中的后续 P1 更新会记录 release-evidence 工具推进，但不改变公开运行时 API。

目标是明确当前真实状态：

- 先前 RAG / agent / export 方案中哪些已经有代码支撑；
- 哪些只能算 operational baseline，还不能称为 production closure；
- 当前架构压力集中在哪里；
- 后续应按什么顺序推进，才能保持向前兼容和鲁棒性。

### 证据基线

本次对齐所依据的分支与工作区状态：

- 分支：`main`
- 远端同步：初始对齐从已同步基线开始；后续本地 P1 延续提交可能会让 `main` 暂时领先 `origin/main`，直到显式 push
- 初始工作区：clean
- 本次从当前工作区重新读取源码与路由注册表，不沿用旧方案中的推断

主要代码证据：

| 区域 | 代码证据 | 当前判断 |
|---|---|---|
| 路由注册 | `src/routes/index.ts`、`src/server.ts`、`src/routes/registry.contract.test.ts` | knowledge、NoteMD、markdown、render、settings、diagnostics、data、agent-workspace diagnostics 已模块化注册；但 `server.ts` 仍承载大量内联编排与 fallback 行为。 |
| 学习 API 契约 | `src/learning/api.ts`、`src/learning/types.ts` | ingest/query/conversation、tutor、memory、quality、guardrail、runtime-state、workspace-export 均有 typed API 契约。 |
| Scope 与检索 | `src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts` | `KnowledgeQueryRequest.scope`、`KnowledgeCorpusScope`、workspace readiness、miss diagnostics、planner 字段与 scoped conversation trace 已落地。 |
| 会话运行时 | `src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/server.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js` | `AgentConversationRequest/Response`、citation、memory action、`assistantBlocks`、turn events、stream/replay/turn-cache diagnostics 和 operator card 均已存在。 |
| 持久化底座 | `src/resources/`、`src/indexing/`、`src/workspace/`、`src/session/`、`src/workflows/`、`src/memory/`、`src/export/` | Program A-F 已形成资源、unit/segment、workspace binding、session/workflow state、memory governance、workspace export bundle 底座。 |
| 平台/导出 profile | `src/platform/PlatformCapabilities.ts`、`src/platform/RenderMaterializer.ts`、`src/routes/render.ts`、`src/export/WorkspaceExportBundle.ts` | export profile 与 Godot/mobile PNG-first materialization 已是一等契约，保留 Godot SVG 限制边界。 |
| Rollout 治理 | `src/learning/store.ts`、`src/learning/queryBackend.ts`、`src/learning/vectorAccelerationAdapter.ts`、`src/learning/runtimeCapability.ts`、`src/server.ts` | graphdb adapter selection、external HTTP connector telemetry、vector `fail_open` / `fail_closed`、rollout profile payload 与 runbook checks 已落地。 |
| 架构压力 | 当前 `main` 行数扫描 | `src/server.ts` 约 15,920 行，`KnowledgeLearningPlatform.ts` 约 10,351 行，`path_app.js` 约 4,943 行，`app.js` 约 5,953 行，`agent_workspace.js` 约 3,237 行。 |

主要方案证据：

- `docs/brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md`
- `docs/brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md`
- `docs/solutions/implementation-plan-2026-05-08.md`
- `docs/solutions/implementation-gap-analysis-2026-05-04.md`
- `docs/diataxis/en/explanation/development-progress-dashboard.md`
- `docs/diataxis/zh/explanation/development-progress-dashboard.md`

### 方案要求与当前代码对比

| 先前要求 | 当前代码现实 | 状态 | 主要风险 |
|---|---|---|---|
| 建立唯一 conversation contract 并降低 API 漂移 | typed request/response、stream event、replay 语义、turn-cache diagnostics、前端 parity 已存在；但 conversation runtime 的主要所有权仍在 `src/server.ts`。 | Operational，但尚未完全简化 | 合同增长继续堆在 server 单体内。 |
| Scope-bound retrieval | `KnowledgeCorpusScope`、workspace/corpus 字段、active-target hydration、workspace readiness、miss diagnostics 已存在，Program F 也提供 resource/index/workspace 底座。 | 大体已实现 | 发布级结论仍取决于 graphdb/ANN 校准，而不是只有 scope 字段。 |
| 多语言与轻量 local RAG 方向 | local vector 与 external connector 治理已存在，包含 rollout context 与 ANN runbook gates。 | Operational baseline | recall/latency 阈值与发布级校准仍未闭环。 |
| Grounded answer synthesis | `AgentConversationResponse` 已包含 `answer`、citation、knowledge point、memory action、trace 和可选 `assistantBlocks`；Tauri 有结构化块渲染与 `assistantMessage` fallback。 | Operational baseline | 未来更多端点需要产出 richer block payload，同时不能破坏旧客户端。 |
| Memory 与 invocation 闭环 | conversation session/turn/invocation、conversation-memory API、memory governance 与 export inclusion 已存在。 | 已有基线 | memory policy 仍比完整生产级 memory subsystem 更轻。 |
| Resource / projection / unit / segment 底座 | Program A-F 目录与测试已存在；workspace export bundle 是 deterministic 且 workspace-scoped。 | 已实现 | 后续功能不能绕开该底座重新写临时 runtime output。 |
| 平台壳层分离 | export profile、materialization decision、Godot/mobile PNG-first 行为、sidecar/build 契约已显式化。 | 已实现 | 新 render/runtime 功能必须把 Godot 约束留在 adapter 边界。 |
| 打包矩阵纪律 | Tauri desktop、Tauri Android、sidecar readiness、LFS policy、SBOM、release workflow gate 已存在。 | 强治理基线 | 部分证据仍依赖宿主；Linux strict Tauri 与 FR-009 真机证据仍是发布门禁。 |
| 架构缩减 | 模块化路由与领域模块已存在，但 `server.ts`、KLP 和前端宿主文件仍过大。 | 落后于目标 | 继续堆编排会恶化可维护性。 |

### 架构推进图

| 层级 | 当前成熟度 | 证据 | 下一步 |
|---|---|---|---|
| 图谱 / Path 核心 | 成熟 operational baseline | `src/core/`、`src/backend/`、PathBridge 测试 | 保持兼容，只处理明确缺陷。 |
| 运行时存储 / 检索 | Operational baseline | `graphdb/sqlite`、external graphdb HTTP、vector acceleration rollout controls | 完成 soak、latency、recall 与 strict rollout 校准后再称 production closure。 |
| Scoped RAG / conversation | Operational baseline | scoped query、citation、answer、`assistantBlocks`、turn stream/replay | 在保持响应兼容的前提下，把所有权迁入更小的 conversation 模块。 |
| Memory / session / workflow | 已实现底座 | `src/memory/`、`src/session/`、`src/workflows/`、conversation records | 强化 policy 质量与 auditability，而不是增加 UI-only 状态。 |
| Export / platform shell | 已实现基线 | export profile、render materializer、workspace export bundle | 保持 mobile/Godot 导出约束显式且有测试。 |
| Governance / CI | 强，但未完全闭环 | docs gate、route/agent contract、runtime verifier、SBOM/sidecar gate | 把证据新鲜度、宿主相关 release gate 与实现完成度分开描述。 |

### 主线具体方案

#### P0：持续同步文档真相

- 以本文档和 development progress dashboard 作为当前架构真相。
- 只要代码或发布门禁改变，就同步 `docs/en|zh/task.md`、`docs/en|zh/implementation_plan.md`、`docs/en|zh/TODO.md`、README 与接口文档。
- 没有运行时证据与发布级阈值时，不把 capability 标记为 production-closed。

#### P1：完成 graphdb 与 ANN 的发布级闭环

- 把 sqlite soak verifier 推进为多轮 release evidence，而不是单次主机证明。
- 将 `verify:foundation:sqlite-runtime:release` 保持为 sqlite soak 证据的发布侧别名，并让 foundation readiness mandatory checks 持续对齐 sqlite 与 ANN 两条 release gate。
- 新增并持续保留 `verify:foundation:release-evidence`，作为轻量 release-evidence 新鲜度校验：在运维把主机证据视为当前有效证据前，先读取最新 sqlite soak 与 ANN release-gate 报告并验证其仍然新鲜且通过。
- 保持 `verify:foundation:release-evidence` 向前兼容：默认每个组件只要求 1 份新鲜且满足 release contract 的报告；当发布 runbook 需要 repeated evidence 时，使用 `verify:foundation:release-evidence:strict` / `--min-report-count`，且 foundation readiness 会通过 `foundation_release_evidence_history` 暴露这条严格审计。
- 默认审计把旧的过期或非 release 历史报告作为 warning 处理；只有仍然新鲜、且满足当前 sqlite soak 或 ANN release-gate contract 的报告才计入有效数量。
- 当前 Windows 宿主的 strict evidence 已经以 sqlite `3/3` 与 ANN `3/3` 通过；这只关闭本地 repeated evidence，不关闭多宿主校准或 production closure。
- 用代表性 workload 收紧 graphdb connector health/budget 阈值。
- 将新的 ANN release-gate verifier 路径（`verify:foundation:ann-runtime:release`）作为 startup、ingest、diagnostics、query latency 与 targeted-query recall 的结构化证据入口。
- 在把 Phase-2 diagnostics 升级为发布门禁之前，基于完整 workload matrix 完成 ANN recall/latency 与 external connector 行为校准。

#### P2：从 `server.ts` 切出所有权压力

- 将 conversation turn cache、alert trend、runbook bridge、graphdb rollout helper 等逻辑迁入明确模块。
- HTTP 层只做边界校验，内部依赖归一化后的合同。
- 保留 `assistantMessage` 等旧响应字段，同时把 typed block 输出作为推荐路径。

#### P3：按领域所有权拆分学习平台实现

- 沿当前 ingest、query、conversation、mastery、quality、tutor、memory 的领域提取方向继续推进。
- 只有当新 owner 能隐藏真实状态或强制真实不变量时才提取。
- 不新增只转发 `KnowledgeLearningPlatform` 方法的空 facade。

#### P4：加固 Agent Workspace 合同，不盲目扩面

- 继续以 capability registry parity tests 作为漂移门禁。
- 只有当后端端点能确定性地产生结构化 payload 时，才扩展 richer assistant block 覆盖面。
- 保持 stream-first + sync fallback 与 turn replay 兼容。

#### P5：保持平台与导出兼容性显式化

- 保留 Godot/mobile 的 PNG-first materialization。
- 把 desktop-full、desktop-reader、godot-path-mode、mobile-slim 放在同一 export-profile 模型中维护。
- 不让 mobile 或 Godot 约束渗入核心 retrieval/synthesis contract。

### 向前兼容与鲁棒性护栏

- 响应演进保持 additive：新增字段可选，旧字段继续有效。
- 在 HTTP/runtime 边界完成一次校验，内部只消费归一化合同。
- fallback 语义必须显式可观测：graphdb fallback、vector `fail_open` / `fail_closed`、Reader frontend-first + backend PNG fallback、Tauri/browser sync fallback 都要可追踪。
- operational evidence 与 production closure 分开写：通过主机 verifier 只能证明 baseline，不等于发布阈值。
- 除非同一切片落地兼容 shim 与测试，不修改公开 endpoint 名称。
- Godot 路径继续禁止依赖直接 SVG 导入。

### 当前验证位置

2026-06-06 初始对齐切片仅修改文档。当前 P1 延续切片会修改 verifier tooling、package scripts、测试、readiness mandatory checks 与文档，但保持公开运行时 API 向前兼容。

当前延续切片的合适验证门禁是：

- foundation release-evidence 契约测试；
- 默认 foundation release-evidence 审计；
- migration test suite；
- Diataxis 映射校验；
- 文档站点构建；
- Markdown/Mermaid fence 护栏；
- git diff review；
- 提交后工作区 clean。

`verify:foundation:release-evidence:strict` 是有意严格的 repeated-evidence 门禁，`getFoundationReadiness().mandatoryChecks` 已通过 `foundation_release_evidence_history` 暴露它。当前 Windows 宿主在刷新 sqlite 与 ANN 报告后已经以 sqlite `3/3` 与 ANN `3/3` 通过。其他宿主或未来 release window 仍必须重新生成自己的历史报告后才能依赖该严格门禁。

后续代码切片仍应执行：

- `npm run verify:foundation:sqlite-runtime:soak`
- `npm run verify:foundation:sqlite-runtime:matrix`
- `npm run verify:foundation:ann-runtime:matrix`
- `npm run verify:foundation:ann-runtime:release`
- `npm run verify:foundation:release-evidence`
- `npm run verify:foundation:release-evidence:strict`
- `npm run test:agent-workspace:contracts`
- `npm run test:migration`
- `npm run verify:core-real-machine:clean`

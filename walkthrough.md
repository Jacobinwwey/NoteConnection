# 2026-06-10 v1.7.0 - Knowledge Workspace and DAG Walkthrough Addendum

## English Document

### Knowledge Workspace Runtime Walkthrough (Current)

1. The user selects or inherits a scoped workspace/corpus target.
2. `agent_workspace.js` sends the conversation request with `activeTarget` and `scope`.
3. `KnowledgeLearningPlatform.agentConversation()` resolves scoped retrieval, grouped knowledge points, citations, memory actions, and a durable `knowledgeRun`.
4. `conversationComposer.ts` organizes the grounded reply into structured blocks while preserving legacy `assistantMessage`.
5. The frontend renders the reply and presents grouped file-first knowledge hits.
6. Clicking a grouped knowledge hit can open source markdown in the graph-focus pane, where matched spans are highlighted in-place.
7. Workflow artifacts such as `flashcard_batch` and `knowledge_run` can be queried and followed up through dedicated runtime endpoints.

### What Is Working

- Structured grounded conversation is operational with additive compatibility.
- Graph focus can render original markdown knowledge sources with matched-span highlighting.
- Durable workflow artifacts now exist for review loops and knowledge-run inspection.
- The current DAG-backed learning substrate already exists underneath retrieval and learning-path/session flows.

### What Still Needs Convergence

- The visible answer area is still richer than the final intended product surface and should contract toward a single targeted answer.
- Left-side knowledge hits still need to converge on a right-pane-first reading model.
- The current DAG still needs a dedicated graph-conditioned context-assembly layer before answer synthesis can be called graph-native.

## 中文文档

### 当前知识工作区运行链路

1. 用户选择或继承一个 scoped workspace/corpus target。
2. `agent_workspace.js` 会把 `activeTarget` 与 `scope` 一起发送到会话请求中。
3. `KnowledgeLearningPlatform.agentConversation()` 解析 scoped retrieval、grouped knowledge point、citation、memory action 与 durable `knowledgeRun`。
4. `conversationComposer.ts` 会把 grounded reply 组织为结构化 block，同时继续保留 legacy `assistantMessage`。
5. 前端渲染回答，并展示按文件优先的 grouped knowledge hit。
6. 点击 grouped knowledge hit 后，可在 graph-focus pane 中打开原始 markdown，并在原文内高亮 matched span。
7. `flashcard_batch` 与 `knowledge_run` 这类 workflow artifact 现在也可以通过独立运行时端点进行查询与 follow-up。

### 已可用能力

- 结构化 grounded conversation 已进入可运行状态，并保持 additive compatibility。
- graph focus 已能渲染原始知识 markdown，并在原文中高亮 matched span。
- 用于 review loop 与 knowledge-run inspection 的 durable workflow artifact 已经存在。
- 当前 DAG 学习底座已经在 retrieval 与 learning-path/session 流水线下方真实存在。

### 仍需继续收敛的点

- 用户可见回答区仍比最终目标产品面更重，仍需继续收缩为“一个 targeted answer 优先”。
- 左侧 knowledge hit 仍需进一步收敛为 right-pane-first 阅读模型。
- 现有 DAG 仍需 dedicated graph-conditioned context-assembly layer，才能让 answer synthesis 进入真正 graph-native 状态。

---

# 2026-03-04 v1.5.13 - Tauri/Godot Migration Walkthrough Addendum

## English Document

### Runtime Walkthrough (Current)

This addendum documents the current Bridge-first runtime flow after migration progress:

1. Tauri launches the Rust host process.
2. Rust spawns the Node sidecar and Godot executable.
3. Godot connects to PathBridge (`ws://127.0.0.1:9876`).
4. Backend receives configuration/path actions through bridge messages.
5. Graph data is restored from cache or rebuilt and then synchronized to frontend/Godot consumers.

### What Is Working

- Sidecar startup and graph build pipeline execute successfully in Tauri mini GPU runs.
- Worker-thread graph stages (keyword/statistical/layout workers) resolve from runtime paths correctly in sidecar execution.
- Path Mode control migration is operational with Godot-driven settings and actions.

### What Still Needs Verification

- Existing-data prompt behavior must consistently ask users to reuse cache or rebuild before load.
- Startup should avoid duplicate load execution after a single load action.
- WebSocket startup sequencing should avoid redundant early disconnect/reconnect cycles.
- History recording should capture center-node switching triggered by double-click navigation in Godot.

### Validation Checklist

1. Run `npm run tauri:dev:mini:gpu`.
2. Select a source that already has cached data.
3. Confirm exactly one prompt appears and exactly one load path executes.
4. Confirm no duplicate build/restore in sidecar logs.
5. Confirm History list updates when switching central nodes in Godot.

## 中文文档

### 当前运行链路说明

本补充说明记录了迁移后 Bridge-first 的当前运行流程：

1. Tauri 启动 Rust 宿主进程。
2. Rust 拉起 Node Sidecar 与 Godot 可执行文件。
3. Godot 连接 PathBridge（`ws://127.0.0.1:9876`）。
4. 后端通过桥接消息接收配置与路径动作。
5. 图数据从缓存恢复或重新构建后，同步给前端/Godot 使用方。

### 已可用能力

- 在 Tauri mini GPU 运行下，Sidecar 启动与图构建流水线可正常执行。
- 图构建的 worker 阶段（关键词/统计/布局）在 Sidecar 运行时路径解析正确。
- Path Mode 控制迁移已可用，由 Godot 侧设置与动作驱动。

### 仍需验证项

- 缓存已存在时，应稳定提示用户选择复用缓存或重建。
- 单次加载动作不应触发重复执行。
- WebSocket 启动时序应避免早期重复断开/重连。
- Godot 双击切换中心节点时，History 记录应同步更新。

### 验证清单

1. 运行 `npm run tauri:dev:mini:gpu`。
2. 选择一个已有缓存数据的源。
3. 确认只出现一次提示，且只执行一次加载路径。
4. 确认 Sidecar 日志中无重复 build/restore。
5. 确认 Godot 切换中心节点后 History 列表有记录。

---

# Path Mode Improvements Walkthrough

## 1. Critical Fix: Navigation Failure

**Issue**: When double-clicking a node or switching the center, the Tree View would crash and revert to a linear list because the `treeLayout` data was missing from the update payload.
**Fix**: Updated [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js)'s [switchCentral](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#1004-1014) function to explicitly call [triggerUpdate()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#539-566). This forces the Web Worker to re-calculate the full `treeLayout` (including correct levels and connections) for the new central node before sending it to Godot.

## 2. Visual Enhancements (Godot)

- [x] **In-Degree Display Setting**: Added option to toggle between "Visible" (default) and "Total" In-Degree counts in Node Popup.
- [x] **Godot Lazy Loading**: Implemented "Expand (+)" and "Collapse (-)" buttons in Godot Tree View to manage prerequisite visibility.
- [x] **i18n Fixes**: Added missing keys `focus_inbound`/`focus_outbound` to English and Chinese locales.

### Godot Tree View Features

- **Visuals ("Zen Mode")**: Simplified view removing all extra buttons. Only nodes and connections are visible.
- **Interactions**:
  - **Double Click / Right Click**: Toggle Context (Expand/Collapse prerequisites).
  - **Long Press (Left)**: Navigate to Node (Switch Central). Visualized by a progress ring overlay.
  - **Middle Click**: Collapse All nodes (Reset view).
- **Focus Mode**:
  - Toggle via Settings ("Focus on this node").
  - Highlights the Central Node and its direct incoming prerequisites.
  - Dims all other nodes to reduce clutter and focus on immediate dependencies.
- This creates a cleaner, less cluttered tree where lines only connect direct neighbors (Level 1 → Level 2), as requested.

**Last Node Cleanup**:

- The "Expand" button logic relies on data validation. With the `treeLayout` now correctly re-computing, the "Target" node (which corresponds to the end of the chain) correctly reports `0` children in the layout, so the expand button will automatically be hidden.

## Verification

- **Navigation**: Double-clicking nodes in Tree View now correctly keeps the Tree View active and re-centers the graph.
- **Aesthetics**: Long, confusing Bezier curves skipping levels are gone.
- **Data**: In-degree numbers are visible.

## 3. Bug Fixes (Interaction & Data)

- **Missing Edges**: Fixed `treeLayout` having 0 edges by sanitizing data in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) (converting Object references back to ID strings for the worker).
- **Right-Click Toggle**: Fixed "Cannot Collapse" bug by:
  - Patching [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) to correctly pass `isExpanded` state.
  - Updating [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) to relay [collapsePrereqs](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254) messages (which were previously dropped).
- **Collapse All**:
  - Added a visible `[-]` button to the Godot UI.
  - Updated [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) to relay the [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) message.

---

# 路径模式改进演练 (Path Mode Improvements Walkthrough)

## 1. 关键修复：导航失败 (Critical Fix: Navigation Failure)

**问题 (Issue)**: 双击节点或切换中心时，由于更新负载中缺少 `treeLayout` 数据，树状视图会崩溃并恢复为线性列表。
**修复 (Fix)**: 更新了 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 的 [switchCentral](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#1004-1014) 函数，显式调用 [triggerUpdate()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#539-566)。这强制 Web Worker 在将新的中心节点发送到 Godot 之前重新计算完整的 `treeLayout`（包括正确的层级和连接）。

## 2. 视觉增强 (Visual Enhancements) (Godot)

- [x] **入度显示设置**: 在节点弹窗中添加了选项，用于在“可见” (默认) 和“总计”入度计数之间切换。
- [x] **Godot 懒加载**: 在 Godot 树状视图中实现了“展开 (+)”和“折叠 (-)”按钮，以管理前置节点的可见性。
- [x] **国际化修复**: 为英语和中文语言环境添加了缺失的键 `focus_inbound`/`focus_outbound`。

### Godot 树状视图功能 (Godot Tree View Features)

- **视觉效果 ("禅模式")**: 简化视图，移除所有额外按钮。仅节点和连接可见。
- **交互**:
  - **双击 / 右键单击**: 切换上下文（展开/折叠前置节点）。
  - **长按 (左键)**: 导航到节点（切换中心）。通过进度环叠加层可视化。
  - **中键单击**: 折叠所有节点（重置视图）。
- **专注模式**:
  - 通过设置切换（“聚焦于此节点”）。
  - 高亮显示中心节点及其直接传入的前置节点。
  - 调暗所有其他节点以减少混乱并专注于直接依赖关系。
- 这创造了一个更清晰、更少混乱的树，其中线条仅连接直接邻居（Level 1 → Level 2），按要求。

**末端节点清理**:

- “展开”按钮逻辑依赖于数据验证。由于 `treeLayout` 现在可以正确重新计算，对应于链末端的“目标”节点正确报告布局中的 `0` 个子节点，因此展开按钮将自动隐藏。

## 验证 (Verification)

- **导航**: 树状视图中的双击节点现在可以正确保持树状视图处于活动状态并重新居中图表。
- **美学**: 移除了跳层级的长而混乱的贝塞尔曲线。
- **数据**: 入度数字可见。

## 3. Bug 修复 (Bug Fixes) (交互与数据)

- **缺失边**: 通过在 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 中清理数据（将对象引用转回 Workers 的 ID 字符串），修复了 `treeLayout` 只有 0 条边的问题。
- **右键切换**: 修复了“无法折叠”的 Bug：
  - 修补 [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) 以正确传递 `isExpanded` 状态。
  - 更新 [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) 以转发 [collapsePrereqs](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254) 消息（以前被丢弃）。
- **全部折叠**:
  - 在 Godot UI 中添加了一个可见的 `[-]` 按钮。
  - 更新 [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) 以转发 [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) 消息。

---

# v1.4.3 - 9-Rule Tree Layout Engine Walkthrough (2026-02-26)

## Analysis Summary

Performed comprehensive gap analysis between `tree_path_mockup.html` (702 lines, 9 rules) and production code.

### Files Analyzed

| File                    | Lines | Purpose                                                 |
| ----------------------- | ----- | ------------------------------------------------------- |
| `tree_path_mockup.html` | 702   | Reference implementation with all 9 rules               |
| `path_core.js`          | 1375  | Production core algorithm (`getTreeLayout()` L742-1133) |
| `tree_renderer.gd`      | 531   | Godot tree visualization                                |
| `tree_view_panel.gd`    | 159   | Godot panel controller                                  |
| `path_app.js`           | 1166  | Frontend bridge and interaction handler                 |

### Key Findings

- **8 of 9 rules** are completely missing from production
- **5 core concepts** absent: ownership, expansion order, effective index, visibility chain, hull collision avoidance
- **7 existing features** preserved: spine ID, contour collision, tributary placement, hull drawing, collapse state, WebSocket bridge, tree renderer
- **Production code is geometrically correct** but lacks the semantic claiming/ownership layer

### Documents Updated

- [implementation_plan.md](file:///e:/Knowledge_project/NoteConnection_app/implementation_plan.md) — Phase 3 with 13 steps
- [brainstorming.md](file:///e:/Knowledge_project/NoteConnection_app/brainstorming.md) — Session 6: Ownership Engine design
- [task.md](file:///e:/Knowledge_project/NoteConnection_app/task.md) — v1.4.3 checklist (EN + ZH)
- [TODO.md](file:///e:/Knowledge_project/NoteConnection_app/TODO.md) — v1.4.3 implementation checklist

### Next Steps

Implementation of 13 steps across 4 components (Core Algorithm, Frontend Bridge, Godot Renderer, Worker Communication).

---

# v1.4.3 - 9 规则树形布局引擎演练 (2026-02-26)

## 分析摘要

对 `tree_path_mockup.html`（702 行，9 条规则）和生产代码进行了全面的差距分析。

### 分析的文件

| 文件                    | 行数 | 用途                        |
| ----------------------- | ---- | --------------------------- |
| `tree_path_mockup.html` | 702  | 包含所有 9 条规则的参考实现 |
| `path_core.js`          | 1375 | 生产核心算法                |
| `tree_renderer.gd`      | 531  | Godot 树可视化              |
| `tree_view_panel.gd`    | 159  | Godot 面板控制器            |
| `path_app.js`           | 1166 | 前端桥接和交互处理          |

### 关键发现

- **9 条规则中有 8 条**在生产代码中完全缺失
- **5 个核心概念**缺失：所有权、展开顺序、有效索引、可见性链、hull 碰撞避让
- **7 个现有特性**保留：脊柱识别、轮廓碰撞、支流放置、hull 绘制、折叠状态、WebSocket 桥、树渲染器
- 生产代码**几何上正确**但缺乏语义认领/所有权层

### 更新的文档

- `implementation_plan.md` — 第三阶段，13 个步骤
- `brainstorming.md` — 会话 6：所有权引擎设计
- `task.md` — v1.4.3 清单（中英双语）
- `TODO.md` — v1.4.3 实施清单

### 后续步骤

跨 4 个组件（核心算法、前端桥接、Godot 渲染器、Worker 通信）实施 13 个步骤。
# 2026-08-16 Architecture Hardening Walkthrough Addendum

## English Document

### Current boundary flow

1. `FileLoader` resolves every source under a workspace root and records a normalized relative path.
2. `GraphBuilder` rejects ambiguous legacy basenames before adding any node; existing basename IDs remain the compatibility key for non-ambiguous workspaces.
3. Protected HTTP/sidecar requests pass through the same token decision, with both existing credential header forms accepted.
4. File-backed snapshots write a unique sibling temp file, atomically rename it, then update the in-process cache.
5. Desktop continues to use the sidecar/full profile; mobile consumes deterministic `mobile-slim` bundles and now has a callable bounded local exact-analysis projection. Device/RSS evidence remains a separate gate.

### Mobile target flow

```text
scoped source package
-> streaming parser
-> stable resource/revision validation
-> compact exact graph/index projection
-> bounded Worker/WASM query
-> evidence/result projection
-> Tauri/Capacitor UI
-> optional cancellable remote synthesis
```

# 2026-08-17 Phase 8 Replay and Cross-Platform Contract Walkthrough

## English

The new replay path is deliberately additive. A graph snapshot is parsed into a temporary `Graph`, validated for duplicate IDs, alias collisions, and undeclared edge endpoints, then swapped into the target instance. Learning move events update the existing document and its evidence paths, append old identities to the alias set, and persist a bounded journal; a restart can therefore delete the pre-move path without guessing from content hashes.

The modular ingest endpoint now rejects malformed JSON, oversized bodies/documents, invalid alias arrays, and unsupported operation names at the HTTP boundary. Legacy field spellings still normalize to the same domain contract. Keyword matching builds a token anchor index once, while `checkMatch` remains the final predicate, so exact phrase behavior is unchanged.

On mobile, the exact analyzer projects only identity, labels, tags, degrees, and bounded adjacency. URI/alias lookup uses NFC normalization. Edge provenance is classified for filtering and diagnostics, but no full document body, Node sidecar, Godot runtime, or model weight is introduced into `mobile-slim`. PathBridge `2.0` envelopes let hosts advertise the same analysis/cancellation contract; the host, not the client, owns policy and persistence.

Verification for this increment: TypeScript build passed; the migration matrix passed 57 suites / 307 tests, focused projection/Bridge suites passed, Diataxis passed, and Rust graph-runtime tests passed. The latest slim staging measures 120 files, 4,251,345 uncompressed bytes, and 1,545,813 estimated compressed bytes. Signed APK/RSS and registry response parity are not inferred from these tests.

## 中文

本次 replay 路径保持 additive：graph snapshot 先解析到临时 `Graph`，校验重复 ID、alias 冲突和未声明 edge endpoint 后，再原子替换目标实例。learning move 事件更新原文档及其 evidence 路径，把旧身份加入 alias 集合并持久化有界 journal；重启后可以按重命名前路径删除，而不是从内容 hash 猜测身份。

模块化 ingest endpoint 现在在 HTTP 边界拒绝非法 JSON、超大 body/document、错误 alias 数组和未知 operation；旧字段拼写仍归一化到相同 domain 契约。keyword matching 只建立一次 token 锚点索引，最终仍由 `checkMatch` 判定，因此 exact phrase 语义不变。

移动端 exact analyzer 只投影身份、标签、tags、度数和有界邻接，URI/alias 查询使用 NFC 归一化。边 provenance 可用于过滤和诊断，但 `mobile-slim` 不增加正文、Node sidecar、Godot runtime 或模型权重。PathBridge `2.0` envelope 让各 host 声明统一分析/取消契约；策略与持久化仍由 host 掌握。

本增量验证：TypeScript build 通过；migration matrix 57 suite / 307 个测试、projection/Bridge 定向 suite、Diataxis 与 Rust graph-runtime 测试通过。最新 slim staging 为 119 个文件、未压缩 4,242,970 字节、估算压缩 1,543,913 字节。不能从这些测试推断签名 APK/RSS 或 registry response parity 已完成。

The mobile flow must never require the desktop Node sidecar or Godot process. Large source text is paged by reference, inferred edges are Top-K bounded, and signed APK/AAB + RSS evidence determines release readiness.

## 中文文档

### 当前边界链路

1. `FileLoader` 在 workspace root 下解析每个 source，并记录规范化相对路径。
2. `GraphBuilder` 在加入任何 node 前拒绝歧义 legacy basename；无冲突 workspace 继续用 basename ID 兼容旧布局。
3. 受保护 HTTP/sidecar 请求使用同一 token 判定，并兼容已有两种凭证头。
4. 文件快照先写唯一同目录临时文件，原子 rename 后再刷新进程内缓存。
5. Desktop 继续使用 sidecar/full profile；mobile 消费 deterministic `mobile-slim` bundle，并已具备可调用的有界本地 exact-analysis projection；设备/RSS 证据仍是独立门禁。

### 移动端目标链路

```text
scoped source package
-> streaming parser
-> stable resource/revision validation
-> compact exact graph/index projection
-> bounded Worker/WASM query
-> evidence/result projection
-> Tauri/Capacitor UI
-> optional cancellable remote synthesis
```

移动链路不得依赖桌面 Node sidecar 或 Godot 进程；大文本按 reference 分页，inferred edge 必须 Top-K 有界，签名 APK/AAB 与 RSS 证据决定 release readiness。

# 2026-08-17 Phase 9 Verification Walkthrough

## English

The route shadow harness now separates legacy-equivalent URLs from registry-only URLs. The equivalent set starts isolated `legacy` and `registry` servers against the same knowledge-base fixture, compares normalized status/body/headers, and checks that read-only or invalid probes do not mutate runtime files. Valid ingest is the only declared write boundary. The registry-only set expects a legacy miss and a registry success, so newly extracted routes are visible without being misreported as regressions.

The parity run passed with 14 equivalent probes and 6 registry-only probes. During implementation it exposed and fixed response-shape drift (`operationSummary`, ingest/query payloads, query-backend diagnostics) and several error-status mismatches. The default dispatch remains registry, while `NOTE_CONNECTION_ROUTE_DISPATCH_MODE=legacy` is available for rollback diagnosis.

`verify-mobile-artifact.js` parses APK/AAB ZIP central-directory entries without requiring Android tooling. It requires an `arm64-v8a` payload in release mode, rejects desktop sidecars, Godot/model payloads, SVG/binary leakage, and profile budget overruns. A release invocation must pass `--require-rss --require-arm64` with a device-generated JSON file; staging measurements alone remain non-release evidence.

The SQLite fixture now closes an adapter, creates a fresh adapter for the same file, replays the committed snapshot, and verifies node/metadata reads. Graph restore tests also prove that a rejected snapshot leaves the previous graph intact. Cross-host replay, signed arm64 artifacts, and device RSS are still open gates.

## 中文

route shadow harness 现在把 legacy-equivalent URL 与 registry-only URL 分开。等价集合会针对同一知识库 fixture 启动隔离的 `legacy` 与 `registry` server，对比归一化后的 status/body/headers，并确认只读或非法 probe 不会修改 runtime 文件；只有显式标记的 ingest 是写边界。registry-only 集合要求 legacy miss、registry success，因此新抽取路由可见但不会被误报为回归。

本次 parity 通过 14 条 equivalent probe 与 6 条 registry-only probe。实现过程中真实暴露并修复了 response shape 漂移（`operationSummary`、ingest/query payload、query-backend diagnostics）和多个错误状态码差异。默认 dispatch 仍是 registry，同时保留 `NOTE_CONNECTION_ROUTE_DISPATCH_MODE=legacy` 作为回滚诊断入口。

`verify-mobile-artifact.js` 不依赖 Android tooling，直接解析 APK/AAB ZIP central-directory entry；release 模式要求 `arm64-v8a` payload，并拒绝 desktop sidecar、Godot/model payload、SVG/二进制泄漏和 profile 超预算。release 调用必须带 `--require-rss --require-arm64` 与真机生成的 JSON；staging 测量本身仍不是 release evidence。

SQLite fixture 会关闭 adapter，再用同一文件创建新 adapter，回放已提交 snapshot 并校验 node/metadata 读取。Graph restore 测试也证明被拒绝的 snapshot 不会破坏旧 graph。跨 host replay、签名 arm64 产物和真机 RSS 仍是开放门禁。

# 2026-08-17 Stable sourceUri Dual-Read Walkthrough

## English

### Runtime flow

`FileLoader` reads a note, normalizes its workspace-relative path once, and creates `sourceUri`, `revision`, and aliases. `GraphBuilder` copies those fields into the node and metadata. `Graph` registers the current ID, source URI, relative path, and legacy aliases in one collision-checked index. Existing algorithms continue to consume the legacy ID; URI/relative frontmatter and saved layouts are resolved at the boundary and serialized output remains backward-readable.

### Compatibility checkpoints

- Exact layout lookup checks source URI, relative path, explicit aliases, then the legacy basename; old layouts remain readable, but basename is not an implicit priority when aliases collide.
- Old nodes without identity fields remain valid because all new fields are optional.
- Alias collisions fail before graph mutation, and case-folding makes the policy deterministic across Windows/POSIX.
- Mobile slim packaging gains no Node/Godot/LLM dependency; this is backend metadata consumed only when present.

### Evidence and next checkpoint

The identity suites and URI/layout compatibility tests pass (15 tests total), and `npx tsc --noEmit` passes. The next checkpoint is move/rename replay plus old-snapshot corpus verification; public ID migration remains blocked until that evidence exists.

# 2026-08-17 Phase 10 Projection and Host Adapter Walkthrough

## English

The mobile write path now follows one bounded sequence: collect Markdown -> build a body-free graph -> normalize through `knowledge_projection_contract.js` -> persist versioned nodes/edges/adjacency -> replay with the exact analyzer. Capacitor and Tauri Rust both emit `schemaVersion=1`, identity metadata, and edge provenance. Unknown future schemas fail closed instead of being silently treated as legacy data.

The Bridge path is additive. With no host adapter, existing clients still receive the old broadcast behavior. With an adapter, the host executes the use case and the Bridge returns an `operationResult` carrying request/correlation IDs; timeout, disconnect, and explicit cancel all abort the host signal. This prevents mobile clients from selecting graph or persistence policy.

Fresh verification: `npm run build:mini`, `npm run mobile:prepare:slim`, `npm run test:migration` (57 suites / 307 passing tests), focused projection/Bridge tests, `cargo check`, and targeted Rust graph-runtime tests. `cargo fmt --check` could not run because `rustfmt` is not installed. No signed arm64 APK/AAB or device RSS evidence exists yet.

## 中文

移动写入路径现在遵循同一条有界链路：收集 Markdown -> 构建无正文 graph -> 经过 `knowledge_projection_contract.js` 归一化 -> 持久化版本化 node/edge/adjacency -> 用 exact analyzer replay。Capacitor 与 Tauri Rust 都输出 `schemaVersion=1`、身份元数据和边 provenance；未知未来 schema 会 fail closed，不会静默按 legacy 数据处理。

Bridge 采用 additive 方式。未配置 host adapter 时，现有客户端仍收到旧广播行为；配置 adapter 后，由 host 执行 use case，Bridge 返回带 request/correlation ID 的 `operationResult`，超时、断连和显式 cancel 都会中止 host signal，移动客户端不能选择 graph 或 persistence policy。

最新验证：`npm run build:mini`、`npm run mobile:prepare:slim`、`npm run test:migration`（57 suite / 307 个测试通过）、projection/Bridge 定向测试、`cargo check` 与 Rust graph-runtime 定向测试通过。由于本机未安装 `rustfmt`，`cargo fmt --check` 无法执行；目前仍没有签名 arm64 APK/AAB 或真机 RSS 证据。

## 中文

### 运行链路

`FileLoader` 读取笔记后只在边界做一次 workspace-relative path 规范化，并生成 `sourceUri`、`revision` 与 alias。`GraphBuilder` 将字段复制到节点和 metadata。`Graph` 在一个经过冲突检查的索引中登记当前 ID、source URI、relative path 与 legacy alias。现有算法继续使用 legacy ID；URI/relative frontmatter 和保存布局在边界解析，序列化输出保持向后可读。

### 兼容性检查点

- exact layout lookup 依次检查 source URI、relative path、显式 alias 和 legacy basename；旧布局仍可读，但 alias 冲突时不再假定 basename 优先。
- 没有身份字段的旧节点仍然有效，因为新增字段均为可选。
- alias 冲突在图变更前 fail-fast，大小写折叠策略保证 Windows/POSIX 一致。
- mobile slim 不增加 Node/Godot/LLM 依赖；这些后端元数据只在存在时被消费。

### 证据与下一检查点

身份 suite 与 URI/layout 兼容测试共 15 个通过，`npx tsc --noEmit` 通过。下一检查点是文件移动/重命名 replay 与旧 snapshot 语料验证；在获得证据前不切换公开 ID。

# 2026-08-17 Mobile Slim Walkthrough Update

## English

The executable flow is now:

```text
runtime-first build
-> mobile-slim staging/filter
-> compressed-byte + forbidden-artifact gate
-> Capacitor or Tauri Android frontend
-> local Rust/Capacitor graph build
-> mobile_exact_analyzer exact query/path projection
-> optional remote inference
```

The staged frontend intentionally excludes Mermaid/GPU desktop payloads, generated graph caches, SVG files, binaries, and model paths. The default Android runner also removes stale generated Godot bridge/assets; `NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE=1` is the only extended-profile opt-in. RSS is measured only from supplied device evidence.

# 2026-08-17 Identity and Mobile Guardrail Walkthrough

## English

The build boundary now passes `kbRoot` into `FileLoader` when a target subdirectory is scanned. A note loaded through `Knowledge_Base/` and the same note loaded through `Knowledge_Base/algebra/` therefore share `relativePath` and `sourceUri`; the old basename `documentId` is unchanged.

The learning ingest payload keeps `sourceUri`, `revision`, and `identityAliases` optional. A URI/alias delete resolves the persisted document before the legacy path normalizer is consulted. This is an additive bridge for replay and migration, not a claim that a path-derived URI survives rename.

On Android, corpus admission checks metadata sizes before reading bodies and bounds documents, total input bytes, and edges. This prevents the low-memory projection from turning an oversized import into an unbounded allocation; it does not replace device RSS evidence.

## 中文

现在 target 子目录扫描会把 `kbRoot` 传入 `FileLoader`。同一笔记从 `Knowledge_Base/` 或 `Knowledge_Base/algebra/` 加载时会得到一致的 `relativePath` 与 `sourceUri`；旧 basename `documentId` 保持不变。

学习摄入 payload 以可选字段保留 `sourceUri`、`revision` 与 `identityAliases`。按 URI/alias 删除时先查持久化文档，再回退到旧 path normalizer。这是用于 replay 与迁移的 additive bridge，并不声称路径派生 URI 能抵抗重命名。

Android 在读取正文前检查文件元数据大小，并限制文档数、总输入字节数与边数；读取时直接提取 link candidate，中间 projection 不保留语料正文，避免超大导入在低内存 projection 中形成无界分配；它不能替代真机 RSS 证据。

## 中文

当前可执行链路为：

```text
runtime-first build
-> mobile-slim staging/filter
-> 压缩字节 + 禁入物门禁
-> Capacitor 或 Tauri Android frontend
-> 本地 Rust/Capacitor 建图
-> mobile_exact_analyzer exact query/path projection
-> 可选远程推理
```

staging 前端会主动排除 Mermaid/GPU 桌面 payload、生成图缓存、SVG、二进制和模型路径。默认 Android runner 还会移除旧生成工程中的 Godot bridge/asset；只有 `NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE=1` 才能启用扩展档。RSS 只有在提供真机 evidence 后才会测量。

# 2026-08-18 Projection Store and SAF Walkthrough

## English

The persistence path is now explicit: `graph_data.json` -> `knowledge_projection_store.js` -> versioned projection contract -> `mobile_exact_analyzer`. A host can provide a persistent `read/write` adapter, or fall back to an in-memory projection. The fallback is deliberately narrow: it preserves the last successful projection during transient adapter failure; it does not accept an unknown future schema.

The Android path is asynchronous by design. Rust requests `ACTION_OPEN_DOCUMENT_TREE`; the generated Kotlin bridge copies Markdown streams into the app-local workspace under bounded document/total byte budgets, then writes a short result marker. Rust polls and persists only the app-local path. The selected external URI is provenance, not a permanent graph identity. This keeps the mobile package free of Node, Godot, models, SVG, and desktop binaries while still allowing user-selected knowledge bases.

Verification for this increment: 24 focused Jest tests, TypeScript no-emit, and 26 Rust tests pass. Generated Android patching is idempotent; a fresh arm64 slim build produced an unsigned APK (9,555,787 bytes) and AAB (7,179,228 bytes), and static artifact verification passed with no forbidden entries. No signed artifact, physical-device import run, or RSS JSON exists yet.

## 中文验证追记

本轮新鲜 arm64 slim 构建生成未签名 APK（9,555,787 字节）与 AAB（7,179,228 字节），静态 artifact 检查通过且没有禁入条目。当前仍缺少签名发布产物、真机导入运行和 RSS JSON；这些证据不能由静态打包结果推断。

## 中文

持久化链路现在明确为：`graph_data.json` -> `knowledge_projection_store.js` -> 版本化 projection contract -> `mobile_exact_analyzer`。Host 可以提供 persistent `read/write` adapter，也可以回退到内存 projection。这个 fallback 只保留最近一次成功 projection 用于短暂 adapter 故障，不接受未知未来 schema。

Android 链路刻意采用异步状态机：Rust 请求 `ACTION_OPEN_DOCUMENT_TREE`，生成的 Kotlin bridge 在单文档/总字节预算内把 Markdown 流式复制到 app-local workspace，再写入短结果 marker；Rust 轮询并只持久化 app-local path。外部 URI 只是 provenance，不是永久 graph identity。这样移动包仍不包含 Node、Godot、模型、SVG 或桌面二进制，同时允许用户选择知识库。

本轮验证：24 项 Jest 聚焦测试、TypeScript no-emit 与 Rust 26 项测试通过。Android 生成工程 patch 已幂等；新鲜 arm64 slim 构建生成未签名 APK（9,555,787 字节）与 AAB（7,179,228 字节），静态 artifact 检查通过且没有禁入条目。尚无签名 arm64 产物、真机导入运行或 RSS JSON。
## 2026-08-18 Phase 13 Native Import Recovery Walkthrough

### English

The Android path is now `ACTION_OPEN_DOCUMENT_TREE -> bounded staging -> v1 import journal -> backup/activate -> atomic result marker`. Startup recovery is idempotent: an active target wins cleanup, a missing target with a backup restores the previous knowledge base, and abandoned staging is removed. Journal schema/path violations fail closed. This is an internal durability change; it does not change projection schema, Rust request/poll fields, or public IDs.

Verification passed: Android picker/mobile contract suites, TypeScript no-emit, and `app:compileArm64ReleaseKotlin`. Device signing, SAF workload, process-death replay, and RSS evidence are not available on the current host and remain release gates.

### 中文

Android 链路现在是 `ACTION_OPEN_DOCUMENT_TREE -> 有界 staging -> v1 import journal -> backup/activate -> 原子 result marker`。启动恢复具有幂等性：已有 active target 时清理，target 缺失但有 backup 时恢复旧知识库，abandoned staging 被删除；journal schema/路径违规直接 fail closed。它是内部耐久性变更，不改变 projection schema、Rust request/poll 字段或公共 ID。

本轮已通过 Android picker/mobile 契约测试、TypeScript no-emit 与 `app:compileArm64ReleaseKotlin`。当前宿主无法取得设备签名、SAF workload、进程死亡 replay 与 RSS 证据，这些仍是 release 门禁。

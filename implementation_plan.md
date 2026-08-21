# 2026-03-10 v1.5.38 - Multi-Terminal WASM Parity Implementation Plan (Mobile Bottleneck Closure)

## English Document

### 2026-06-10 Knowledge Workspace and DAG Implementation Direction

#### Objective

Record the current code-backed state of the Knowledge Workspace and the existing DAG-backed learning substrate, then make the next implementation order explicit without overstating unfinished product-surface work.

#### Current code truth

- Structured grounded conversation is implemented through `answer`, `assistantBlocks`, grouped `knowledgePoints`, `knowledgeRun`, citations, memory actions, and backward-compatible `assistantMessage`.
- Durable workflow artifacts are implemented for `flashcard_batch` and `knowledge_run`, including query and review-follow-up runtime paths.
- The current codebase already contains a real DAG-backed learning substrate: `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, path queries, and prerequisite-driven learning flows are all present.
- The primary gap is no longer “add graph data.” The primary gap is “add graph-conditioned context assembly between retrieval and answer synthesis.”
- The current architecture pressure remains concentrated in `src/server.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, and `src/frontend/workspace_panes.js`.

#### Next execution order

1. P0: Keep the 2026-06-10 Knowledge Workspace and DAG alignment note synchronized across all active progress docs.
2. P1: Contract the primary answer surface so the visible answer area prioritizes the targeted answer over supporting blocks.
3. P2: Converge left-side knowledge hits on a right-pane-first reading model.
4. P3: Treat `knowledge_run` and `flashcard_batch` as the first durable evidence/claim surfaces rather than inventing a second review substrate.
5. P4: Add a graph-conditioned context-assembly layer between retrieval and answer synthesis.
6. P5: Continue ownership reduction across the major server and frontend host files.

#### Acceptance criteria

1. Active planning docs reflect the same 2026-06-10 current-state reading.
2. Code-backed capabilities and product-surface gaps are clearly separated.
3. Backward compatibility remains explicit for legacy response fields and existing runtime APIs.

---

## 中文文档

### 2026-06-10 知识工作区与 DAG 实施方向

#### 目标

记录当前知识工作区与现有 DAG 学习底座的真实代码状态，并在不夸大未完成产品面的前提下，明确下一阶段实施顺序。

#### 当前代码真相

- 结构化 grounded conversation 已通过 `answer`、`assistantBlocks`、按文档聚合的 `knowledgePoints`、`knowledgeRun`、citations、memory actions 与向前兼容的 `assistantMessage` 落地。
- `flashcard_batch` 与 `knowledge_run` 的 durable workflow artifact 已实现，且已具备查询与 review-follow-up 的运行时路径。
- 当前代码已经具备真实的 DAG 学习底座：`KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、path query 与 prerequisite 驱动学习流都已存在。
- 主要缺口已经不再是“补图数据”，而是“在 retrieval 与 answer synthesis 之间补 graph-conditioned context assembly”。
- 当前架构压力仍集中在 `src/server.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js` 与 `src/frontend/workspace_panes.js`。

#### 下一步执行顺序

1. P0：保持 2026-06-10 的知识工作区 / DAG 对齐结论在所有活跃进度文档中同步。
2. P1：收缩主回答面，让用户可见回答区优先显示 targeted answer，而不是 supporting block。
3. P2：让左侧 knowledge hit 收敛为 right-pane-first 阅读模型。
4. P3：把 `knowledge_run` 与 `flashcard_batch` 当作第一批 durable evidence / claim surface，而不是再造第二套 review substrate。
5. P4：在 retrieval 与 answer synthesis 之间补 graph-conditioned context-assembly layer。
6. P5：继续缩减主要 server 与 frontend host 文件中的所有权压力。

#### 验收标准

1. 活跃规划文档都反映同一份 2026-06-10 当前状态判断。
2. “已经代码落地的能力”和“仍未满足的产品面要求”被明确区分。
3. 向前兼容性对 legacy 响应字段与既有运行时 API 继续保持明确。

---

### Goal
Use a single WASM compute strategy to reduce mobile-inherent bottlenecks while preserving deterministic behavior across desktop web, Tauri desktop, Capacitor mobile, and Tauri Android runtimes.

### Mobile Inherent Problems (Current)

1. Main-thread contention during heavy graph/layout compute can freeze interaction.
2. Worker startup + JS serialization overhead can dominate on mobile CPUs for sparse graphs.
3. Memory pressure and GC spikes increase crash/jank probability on constrained devices.
4. Capability variance across WebView runtimes creates nondeterministic behavior without explicit probes.

### Multi-Terminal Strategy

1. One capability contract:
   - Runtime exposes `supports_mobile_wasm_compute` and `mobile_wasm_reason`.
   - Routing remains deterministic with explicit fallback reason tracking.
2. One compute routing model:
   - Preferred: `wasm-adapter`
   - Fallback: `worker`
   - Final fallback: `single-thread`
3. One artifact governance path:
   - Canonical WASM artifact probe + strict gate scripts + CI regression barriers.

### Phased Execution Plan

1. Phase A (Capability and Diagnostics) [Completed baseline]:
   - Add runtime probe for mobile WASM readiness.
   - Expose capability and reason in runtime caps.
   - Keep existing behavior unchanged if capability is unavailable.
2. Phase B (Routing Integration) [Active]:
   - Thread mobile capability signal into on-device build stats.
   - Add build-mode detail tags for mobile telemetry (`worker-wasm-ready`, `worker-wasm-not-ready`, fallback reasons).
   - Keep deterministic fallback behavior.
3. Phase C (Kernel Expansion):
   - Move additional heavy kernels to WASM where correctness is contract-proven.
   - Prioritize graph build hot spots that currently consume most mobile CPU time.
4. Phase D (Artifact Provisioning per Terminal):
   - Validate artifact packaging for:
     - desktop web bundle
     - Tauri desktop sidecar/runtime paths
     - Capacitor mobile asset/runtime paths
     - Tauri Android runtime paths
5. Phase E (Performance and Stability Hard Gates):
   - Enforce p95/p99 guardrails for mobile-oriented workloads.
   - Enforce no-regression equivalence contracts between worker and WASM output.

### Acceptance Criteria

1. Runtime can always explain why WASM is enabled/disabled on mobile (`mobile_wasm_reason`).
2. Mobile build path remains functional when WASM is unavailable (deterministic fallback verified).
3. Migration gate suite remains fully green after each routing change.
4. Bilingual docs remain synchronized for all plan/TODO/test-report updates.

---

## 中文文档

### 目标
通过统一的 WASM 计算策略，缓解移动端固有瓶颈，并在桌面 Web、Tauri 桌面、Capacitor 移动端、Tauri Android 多终端之间保持可预测的一致行为。

### 当前移动端固有问题

1. 重图计算/布局计算容易占用主线程，导致交互卡顿。
2. 在稀疏图场景下，Worker 启动与 JS 序列化开销可能高于实际计算收益。
3. 受限设备上内存压力与 GC 抖动更明显，稳定性风险更高。
4. 不同 WebView 运行时能力差异较大，若缺少显式探测会造成行为不确定。

### 多终端统一策略

1. 统一能力契约：
   - 运行时暴露 `supports_mobile_wasm_compute` 与 `mobile_wasm_reason`。
   - 计算路由保留明确的回退原因，保证可诊断性。
2. 统一计算路由模型：
   - 首选：`wasm-adapter`
   - 回退：`worker`
   - 最终回退：`single-thread`
3. 统一工件治理链路：
   - 标准 WASM 工件探针 + 严格门禁脚本 + CI 回归屏障。

### 分阶段执行计划

1. 阶段 A（能力探测与诊断）[基线已完成]：
   - 增加移动端 WASM 就绪探测。
   - 在 runtime caps 中暴露能力与原因。
   - 能力不可用时保持既有行为不变。
2. 阶段 B（路由集成）[进行中]：
   - 将移动端 WASM 能力信号接入本地构建统计。
   - 增加移动构建模式细分标签（`worker-wasm-ready`、`worker-wasm-not-ready`、回退原因）。
   - 保持确定性回退链路。
3. 阶段 C（内核扩展）：
   - 将更多重计算内核迁移到 WASM，并以契约验证正确性。
   - 优先处理当前移动端 CPU 占用最高的图构建热点。
4. 阶段 D（多终端工件落地）：
   - 分别验证以下终端的工件打包与加载路径：
     - 桌面 Web 资源包
     - Tauri 桌面 sidecar/运行时路径
     - Capacitor 移动端资源/运行时路径
     - Tauri Android 运行时路径
5. 阶段 E（性能与稳定性硬门禁）：
   - 对移动端典型负载执行 p95/p99 门禁约束。
   - 强制 worker 与 WASM 输出一致性无回归。

### 验收标准

1. 移动端必须能明确解释 WASM 启用/禁用原因（`mobile_wasm_reason`）。
2. WASM 不可用时移动端构建链路仍可工作（确定性回退已验证）。
3. 每一轮路由调整后，迁移门禁套件保持全绿。
4. 所有计划/TODO/测试报告的中英文文档保持同步更新。

---

# 2026-03-04 v1.5.13 - Tauri Bridge-First Implementation Plan Update

## English Document

### Scope Alignment

This update aligns the implementation plan with the current Electron-to-Tauri migration strategy:

- Tauri as the primary desktop shell.
- Godot as the Path Mode interactive surface.
- Node sidecar as the graph build and runtime service.
- Bridge-first message flow (`Godot <-> PathBridge <-> Backend`) as the default path.

### Completed in Current Migration Cycle

- Runtime path unification for sidecar execution and frontend asset resolution has been integrated across desktop runtime paths.
- Worker path resolution has been stabilized for packaged sidecar execution to avoid `MODULE_NOT_FOUND` in worker threads.
- Knowledge Base folder loading is now anchored to the configured project root path and no longer depends on Electron-only assumptions.
- The `Path Mode` configuration migration has moved core controls into Godot-side UI while preserving browser toolbar behavior for browser mode.

### Open Gaps and Risk Items

- Cache-exists decision flow still requires strict regression verification in Tauri mini GPU runs to ensure users are prompted to reuse or rebuild.
- Duplicate load cycles must remain guarded to prevent repeated build/restore actions after a single user click.
- WebSocket client lifecycle still needs hardening to avoid redundant early connect/disconnect churn under startup timing races.
- History tracking for center-node switches in Godot requires final behavioral verification.

### Next Execution Steps

1. Lock cache prompt + single-execution semantics with dedicated regression tests.
2. Finalize websocket lifecycle guard rails and startup sequencing.
3. Complete task-level parity checks for Electron IPC replacements and remove remaining implicit Electron dependencies.
4. Keep dual-output mobile strategy: maintain Capacitor output while also enabling Tauri Android build path.

## 中文文档

### 范围对齐

本次更新将实施计划与当前 Electron 到 Tauri 的迁移策略对齐：

- 以 Tauri 作为桌面主壳层。
- 以 Godot 作为 Path Mode 交互界面。
- 以 Node Sidecar 作为图构建与运行时服务。
- 默认采用 Bridge-first 消息链路（`Godot <-> PathBridge <-> Backend`）。

### 当前迁移周期已完成项

- 已完成 Sidecar 运行路径与前端资源路径的统一，提升桌面运行一致性。
- 已稳定 Worker 路径解析，避免打包 Sidecar 下线程出现 `MODULE_NOT_FOUND`。
- Knowledge Base 文件夹加载已锚定到配置的项目根路径，不再依赖 Electron 专属假设。
- `Path Mode` 关键配置已迁移到 Godot 侧 UI，同时保留浏览器模式下 Web 工具栏行为。

### 仍需收敛的缺口与风险

- 在 Tauri mini GPU 运行中，缓存存在时“复用或重建”提示流程仍需严格回归验证。
- 需要持续防止单次点击触发重复加载（重复 build/restore）。
- WebSocket 客户端生命周期仍需加固，避免启动阶段时序竞争导致早期重复连接/断开。
- Godot 中心节点切换的 History 记录仍需最终行为验收。

### 下一步执行

1. 通过专用回归测试锁定缓存提示与单次执行语义。
2. 完成 websocket 生命周期防护与启动时序收敛。
3. 完成 Electron IPC 替代项的逐任务一致性核验，并移除残余隐式 Electron 依赖。
4. 保持移动端双输出策略：继续保留 Capacitor，同时并行支持 Tauri Android 产物链路。

---

# Implementation Plan - Implementing Lazy Loading for Prerequisites

The goal is to allow users to investigate incomplete In-Degree information by explicitly expanding the context of a specific node, without overloading the view with the entire graph.

## Proposed Changes

### 1. Backend Logic ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

- **Unrestricted Context Expansion**:
  - In [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422), iterate through `forcedExpansionSet`.
  - For each node in the set, retrieve **all** incoming edges ([getIncomingEdges](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#120-128)), regardless of their completion status or relevance to the original path.
  - Add the source nodes of these edges to the `finalPathNodes` list.
  - **Constraint**: Do not recursively fetch parents of these new nodes (Level -1 only).
  - **Flagging**: Mark the expanded target node with `isExpanded: true` in the output.

### 2. Data Bridge ([src/frontend/path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))

- **Pass State Flags**:
  - Ensure the `isExpanded` flag matches the `forcedExpansionSet` state.
  - Pass this flag to the Godot client in the `treeLayout` payload.

### 3. Visualization State Machine ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

### 3. Visualization State Machine ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

- **Smart Toggle Logic (Left Side)**:
  - **Pre-calculation**: At the start of `_draw_layout_mode`, iterate `_layout_edges` to build a `visible_in_counts` dictionary (NodeID -> Count).
  - **Decision Logic (in Node Loop)**:
    - Let `global_in` = `node.inDegree` (from backend).
    - Let `visible_in` = `visible_in_counts[node.id]`.
    - Let `is_expanded` = `node.isExpanded` (flag from backend).
  - **States**:
    1.  **Expanded State**: If `is_expanded` is true:
        - Draw [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) button.
        - Click Action: Emit `node_collapse_prereqs_requested`.
    2.  **Expandable State**: Else if `visible_in < global_in`:
        - Draw [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) button.
        - Click Action: Emit `node_expand_prereqs_requested`.
    3.  **Complete State**: Else (Visible == Global):
        - Draw nothing (or disabled indicator).

### 4. Interaction Logic ([tree_view_panel.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_view_panel.gd) & [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))

- **Collapse Handling**:
  - Implement [collapsePrereqs(nodeId)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254) in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js): Remove ID from `forcedExpansionSet` and trigger update.
  - Wire up the new Godot signal to this backend method.

## UI Inconsistency Fixes

### 1. Statistics Panel Resizing

- **Problem**: The "Incoming" and "Outgoing" lists in the Node Statistics Popup do not resize proportionally when the popup is resized using the drag handle.
- **Fix**: Modify [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css).
  - Change `.stat-lists` from fixed `height: 150px` to `flex: 1; min-height: 150px`.
  - Ensure parent containers (`.popup-content`) allow expansion.

### 2. Edge Visibility

- **Problem**: Edges are visible by default on load, creating clutter.
- **Fix**:
  - in [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css): Set `.link` default `stroke-opacity` to `0`.
  - in [src/frontend/app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js): Ensure [updateVisibility()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1717-1747) is called immediately after graph initialization to enforce the visibility logic (hiding edges unless focused/hovered).

### 3. In-Degree Number Mismatch

- **Problem**: The number displayed next to "In-Degree" (Red) in the popup often differs from the count of items in the "Incoming" list.
- **Verification**: Locate [showNodePopup](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1083-1154) in [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) to see if it uses `node.inDegree` (metadata) vs `node.incoming` (actual edges).
- **Fix**:
  - If the metadata is correct (global truth), keep it.
  - If the list is incomplete (due to filtering/culling), add a label "(Visible: X)" or ensure the list matches filters.
  - _Current hypothesis_: The metadata `inDegree` is the ground truth from the backend, while the client-side `links` array might be filtered or optimized (limit 20000 edges), causing a mismatch. functionality to show "Total" vs "Visible".

### 4. In-Degree Display Setting (Electron)

- **Goal**: Allow user to toggle between showing "Visible Inbound Nodes" (calculated from current graph) or "Total Statistical Inbound" (from backend metadata).
- **Default**: Visible Inbound Nodes.
- **Changes**:
  - **[src/frontend/index.html](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/index.html)**: Add a toggle/select in the Settings Modal (e.g., "Degree Count: Visible | Total").
  - **[src/frontend/app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js)**:
    - Update [showNodePopup](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1083-1154) to check `settingsManager.get('visuals', 'degreeMode')`.
    - If 'visible': Show `inNeighbors.length`.
    - If 'total': Show `node.inDegree` (with [(visible)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) suffix if different? Or just strict switch?). User asked for "whether the inbound count should be shown as the number of nodes or the statistical number". I will implement a strict switch but maybe keep the tooltip or subtle indicator if they differ significantly.
    - Wire up the new setting in [initSettingsUI](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#2644-2880).

- [ ] **Simplify Lazy Loading UI (Godot)**
  - [ ] Update [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd):
    - [ ] Remove separate [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) buttons.
    - [ ] Implement unified `[ Count ]` button (e.g., circle with number).
    - [ ] Button toggles `forcedExpansion` state.
    - [ ] Default state is collapsed (colored/styled to indicate expandable).
  - [ ] Ensure [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) handles the toggle correctly (clear vs add to `forcedExpansionNodes`).

- [ ] **Tree View Visual & Interaction Overhaul**
  - [ ] **Visual Cleanup (Godot)**
    - [ ] Remove [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) and `[Count]` buttons from [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
    - [ ] Remove separate click areas for these buttons.
  - [ ] **Interaction Update (Godot)**
    - [ ] **Double Click**: Change to Toggle Expansion (Emit [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261)).
    - [ ] **Right Click**: Toggle Expansion (Same as Dbl Click).
    - [ ] **Middle Click**: Collapse All (Emit new signal `collapse_all_requested`).
    - [ ] **Long Press**: Implement Navigation (Switch Central).
      - [ ] Add `_process` check for hold duration.
      - [ ] Draw Progress Ring during hold.
      - [ ] Trigger navigation on completion.
  - [ ] **Focus Mode (Godot)**
    - [ ] Add "Focus on this node" checkbox to [settings_panel.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/settings_panel.tscn).
    - [ ] Implement `focus_node_id` state in [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
    - [ ] Update `_draw` to dim nodes/edges not connected to `focus_node_id` when enabled.
  - [x] **Backend Updates**
    - [x] Add [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) handler in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js).

## Data Validation

- [x] **Disable Path Mode if No Data**:
  - [x] Update [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) to check `graphDataExists` or `nodes.length` before entering Path Mode.
  - [x] Show alert if data missing.

## Bug Fixes

- [ ] **Fix Missing Edges in Tree Layout**:
  - [ ] **Cause**: `d3.forceSimulation` in [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) mutates `graphData.links`, replacing ID strings with Node Objects.
  - [ ] **Effect**: `Graph.js` in [path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js) uses these Objects as keys/IDs, breaking adjacency map lookups (which expect strings).
  - [ ] **Fix**: In [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js), sanitize links before sending to worker: `l.source.id || l.source`.

## Verification Plan

1. **Initial State Check**:
   - Navigate to a node with high In-Degree (e.g., "Beta", In-Degree 18).
   - Verify the unified `[ Count ]` button appears on the left if < 18 lines are visible.
2. **Expansion Test**:
   - Click the `[ Count ]` button.
   - Verify the tree rebuilds.
   - Verify previously hidden nodes (e.g., "Fair Value") appear as prerequisites.
   - Verify the `[ Count ]` button changes its state/appearance to indicate expansion.
3. **Collapse Test**:
   - [x] Click [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53).
   - [x] Verify the extra nodes disappear and view returns to original state.

## Bug Fixes

- [x] **Fix Missing Edges in Tree Layout**:
  - [x] **Fix**: In [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js), sanitize links before sending to worker.
- [ ] **Fix Tree View Interactions**:
  - [ ] **Right-Click Toggle**: Ensure `isExpanded` is passed from [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) to visual node.
  - [x] **Collapse All**: Update [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) to relay [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) message. Add UI button.

# Phase 2: Spine & Tributaries Layout (v1.4.2)

## Goal

Implement a stable, tree-like layout where the "Main Learning Path" (Spine) remains linear and stationary, while prerequisites (Tributaries) expand laterally without disrupting the spine.

## Proposed Changes

### 1. Core Algorithm ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

#### [getTreeLayout(centralId, learningPath)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884)

- **Step 1: Identify Spine**:
  - Determine the "Critical Path" from `learningPath.nodes` (using `isCritical` flag or [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) result).
  - Assign `Level` (X-coordinate) to Spine nodes based on distance from Start.
  - Fix Spine `Y` coordinates to `0`.

#### `assignTributaryPositions(spineNodes, allNodes)`

- **Step 2: Slot Management**:
  - Create a `SlotManager` to track occupied [(X, Y)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) positions.
  - Mark key Spine positions as occupied.
- **Step 3: Lateral Expansion**:
  - Iterate through nodes in **Topological Order** (or Spine Order).
  - For each node `N`, identify its unplaced prerequisites `P`.
  - **Placement Logic**:
    - `Target X`: `N.Level - 1` (Standard dependency inflow).
    - `Target Y`: Find nearest available vertical slot relative to `N.Y`.
    - Preference: Alternating Up/Down (`+1, -1, +2, -2...`) \* `Y_SPACING`.
    - **Stability**: Once placed, a node's position is locked (`isPlaced = true`) and will not be moved by subsequent expansions.

### 2. Frontend Integration

- Ensure [switchCentral](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#893-900) triggers a re-layout using the new algorithm.
- Pass the stable layout to `Graph.js` / Godot via [PathBridge](file:///e:/Knowledge_project/NoteConnection_app/dist/src/core/PathBridge.js#5-134).

## Verification Plan

1. **Spine Stability**:
   - Load a path. Center on a Spine node.
   - Expand a prerequisite.
   - Verify the Spine node DOES NOT move.
2. **Lateral Unfolding**:
   - Verify prerequisites appear above/below the spine, not inline.
3. **Complex Chain**:
   - Expand a prerequisite's prerequisite.
   - Verify it flows backwards (Left) and finds a clear slot.

---

# 实施计划 - 实现前置节点懒加载 (Implementation Plan - Implementing Lazy Loading for Prerequisites)

目标是允许用户通过显式扩展特定节点的上下文来调查不完整的入度信息，而无需加载整个图表。

## 建议更改 (Proposed Changes)

### 1. 后端逻辑 ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

- **无限制上下文扩展**:
  - 在 [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) 中，迭代 `forcedExpansionSet`。
  - 对于集合中的每个节点，检索 **所有** 入边 ([getIncomingEdges](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#120-128))，无论其完成状态或与原始路径的相关性如何。
  - 将这些边缘的源节点添加到 `finalPathNodes` 列表中。
  - **约束**: 不要递归获取这些新节点的父节点（仅限 Level -1）。
  - **标记**: 在输出中用 `isExpanded: true` 标记已扩展的目标节点。

### 2. 数据桥接 ([src/frontend/path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))

- **传递状态标志**:
  - 确保 `isExpanded` 标志与 `forcedExpansionSet` 状态匹配。
  - 在 `treeLayout`以此传递此标志给 Godot 客户端。

### 3. 可视化状态机 ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

- **智能切换逻辑 (左侧)**:
  - **预计算**: 在 `_draw_layout_mode` 开始时，迭代 `_layout_edges` 以构建 `visible_in_counts` 字典。
  - **决策逻辑**:
    - `global_in` = `node.inDegree` (来自后端)。
    - `visible_in` = `visible_in_counts[node.id]`.
    - `is_expanded` = `node.isExpanded`.
  - **状态**:
    1.  **已展开**: 如果 `is_expanded` 为真：绘制 [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。点击发射 `node_collapse_prereqs_requested`。
    2.  **可展开**: 否则如果 `visible_in < global_in`：绘制 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。点击发射 `node_expand_prereqs_requested`。
    3.  **完整**: 否则（可见 == 全局）：绘制无（或禁用）。

### 4. 交互逻辑 ([tree_view_panel.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_view_panel.gd) & [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))

- **折叠处理**:
  - 在 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 中实现 [collapsePrereqs(nodeId)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254)：从 `forcedExpansionSet` 中移除 ID 并触发更新。
  - 将新的 Godot 信号连接到此后端方法。

## UI 不一致修复 (UI Inconsistency Fixes)

### 1. 统计面板调整大小

- **修复**: 修改 [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css)，使用 `flex: 1` 确保列表按比例调整大小。

### 2. 边缘可见性

- **修复**: 默认隐藏边缘，仅在悬停/聚焦时显示。

### 3. 入度数字不匹配

- **修复**: 添加设置以切换“可见”与“总计”入度显示。

## 第二阶段：主干与支流布局 (Phase 2: Spine & Tributaries Layout) (v1.4.2)

### 目标

实现稳定的树状布局，其中“主要学习路径”（主干）保持线性和静止，而前置节点（支流）在不破坏主干的情况下横向扩展。

### 建议更改

#### 1. 核心算法 ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

##### [getTreeLayout(centralId, learningPath)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884)

- **步骤 1: 识别主干**:
  - 从 `learningPath.nodes` 确定“关键路径”。
  - 根据与起点的距离为主干节点分配 `Level` (X坐标)。
  - 将主干 `Y` 坐标固定为 `0`。

##### `assignTributaryPositions(spineNodes, allNodes)`

- **步骤 2: 插槽管理**:
  - 创建 `SlotManager` 以跟踪占用的 [(X, Y)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 位置。
  - 标记关键主干位置为已占用。
- **步骤 3: 横向扩展**:
  - 按 **拓扑顺序** 迭代节点。
  - 对于每个节点 `N`，识别其未放置的前置节点 `P`。
  - **放置逻辑**:
    - `Target X`: `N.Level - 1`。
    - `Target Y`: 相对于 `N.Y` 找到最近的可用垂直插槽。
    - 偏好: 交替上/下 (`+1, -1, +2, -2...`) \* `Y_SPACING`。
    - **稳定性**: 节点一旦放置，其位置即被锁定 (`isPlaced = true`)。

### 2. 前端集成

- 确保 [switchCenter](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#893-900) 使用新算法触发重新布局。
- 通过 [PathBridge](file:///e:/Knowledge_project/NoteConnection_app/dist/src/core/PathBridge.js#5-134) 将稳定布局传递给 Godot。

### 验证计划

1. **主干稳定性**: 加载路径，居中主干节点，展开前置节点。验证主干节点 **不移动**。
2. **横向展开**: 验证前置节点出现在主干的上方/下方，而不是内联。
3. **复杂链**: 展开前置的前置，验证其向后（左）流动并找到清晰的插槽。

---

# Phase 3: 9-Rule Tree Layout Engine (v1.4.3)

**Date**: 2026-02-26

## Goal

Port the 9-rule expansion/claiming/visibility engine from `tree_path_mockup.html` into production code (`path_core.js`, `tree_renderer.gd`, `path_app.js`). This replaces the simple contour-based layout with a full ownership/claiming system for intelligent node management.

## Gap Analysis: Mockup vs Production

### Missing Rules

| #   | Rule                                          | Mockup Function                            | Production Status            |
| --- | --------------------------------------------- | ------------------------------------------ | ---------------------------- |
| 1   | **Expansion Order** (FIFO claiming)           | `processExpansions()` + `expansionOrder[]` | ❌ Missing                   |
| 2   | **Preceding Immunity** (effective index)      | `tryClaim()` + `getEffectiveSpineIndex()`  | ❌ Missing                   |
| 3   | **Following Migration** (spine+followers)     | `claimSpineChain()`                        | ❌ Missing                   |
| 4   | **Single Appearance** (owner-based)           | `currentOwner` priority check              | ⚠️ Partial (`placedNodeIds`) |
| 5   | **Cross-Tributary Isolation** (edge filter)   | `drawEdges()` owner check                  | ❌ Missing                   |
| 6   | **Spine Always Visible** (return on collapse) | `determineVisibility()` spine pass         | ❌ Missing                   |
| 7   | **Sticky Claim** (configurable)               | `stickyClaimEnabled` toggle                | ❌ Missing                   |
| 8   | **Unit Migration** (recursive claim)          | `claim()` recursive tributaries            | ❌ Missing                   |
| 9   | **Tributary Hierarchy Immunity**              | `getTributaryRootSpineIndex()`             | ❌ Missing                   |

### Missing Concepts

| Concept                   | Mockup                            | Production                             |
| ------------------------- | --------------------------------- | -------------------------------------- |
| **Node Ownership**        | `currentOwner`, `ownerPriority`   | None                                   |
| **Expansion Order**       | `expansionOrder[]` (ordered)      | `forcedExpansionNodes` (unordered Set) |
| **Effective Spine Index** | `getEffectiveSpineIndex()`        | Fixed `spineIndex` only                |
| **Visibility Chain**      | `isOwnerChainVisible()` recursive | Binary collapsed/expanded              |
| **Hull-Node Avoidance**   | Convex hull with padding          | Basic hull, no collision check         |

### Existing Features to Preserve

- ✅ Spine identification via `isCritical` flag
- ✅ Contour-based collision avoidance for spine spacing
- ✅ Recursive tributary placement
- ✅ Hull/bubble drawing around tributary groups
- ✅ Collapsed/expanded state per node
- ✅ Godot WebSocket bridge communication
- ✅ Tree renderer with bezier edges, styled nodes, pan/zoom

## Proposed Changes (13 Steps)

### Component 1: Core Algorithm

#### [MODIFY] [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js)

**Step 1**: Add expansion order tracking to `getTreeLayout()` (L742-1133)

- Add `expansionOrder` parameter (ordered array of expanded node IDs)
- Replace unordered `collapsedSet` with ordered `expansionOrder` for FIFO claiming

**Step 2**: Implement node ownership system

- Add `currentOwner`, `ownerPriority`, `_isOnSpine` to each layout node
- Track claims during `processExpansions()` matching mockup logic

**Step 3**: Implement `tryClaim()` with all 9 rules

- Rule 1: Owner priority check
- Rule 2: `getEffectiveSpineIndex()` comparison (inherits owner index)
- Rule 3+8: `claimSpineChain()` for following migration
- Rule 4: Single appearance via owner check
- Rule 5: Cross-tributary edge filtering
- Rule 6: Spine always visible on collapse
- Rule 7: Sticky claim toggle
- Rule 9: `getTributaryRootSpineIndex()` for hierarchy immunity

**Step 4**: Implement `determineVisibility()` + `isOwnerChainVisible()`

- Two-pass: spine always visible, non-spine follows recursive owner chain

**Step 5**: Update edge generation — filter edges between different owners (Rule 5)

**Step 6**: Update hull generation to group by owner

### Component 2: Frontend Bridge

#### [MODIFY] [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js)

**Step 7**: Track expansion ORDER (not just Set)

- `forcedExpansionNodes: new Set()` → `expansionOrder: []`
- Update `expandPrereqs()`, `collapsePrereqs()`, `collapseAll()`
- Pass `expansionOrder` to worker

**Step 8**: Add sticky claim setting + pass to worker

### Component 3: Godot Tree Renderer

#### [MODIFY] [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd)

**Step 9**: Edge rendering — skip edges where `src.currentOwner != tgt.currentOwner`

**Step 10**: Hull collision avoidance with rounded padding

**Step 11**: Node type coloring (spine=green, tributary=blue, shared=purple, migrated=orange)

**Step 12**: Expansion indicator badge (in-degree count circle)

### Component 4: Worker Communication

#### [MODIFY] [path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js)

**Step 13**: Pass `expansionOrder` and `stickyClaimEnabled` to `getTreeLayout()`

## Verification Plan

1. Expand Calculus → verify Optimization migrates (Rule 3)
2. Expand Optimization → verify Diff Eq cannot claim Calculus (Rule 2+9)
3. Collapse Calculus → verify spine nodes return (Rule 6)
4. Toggle sticky claim → verify non-spine revert/persist (Rule 7)
5. Check hull boundaries don't overlap nodes

---

# 第三阶段：9 规则树形布局引擎 (v1.4.3)

**日期**: 2026-02-26

## 目标

将 `tree_path_mockup.html` 中的 9 规则展开/认领/可见性引擎移植到生产代码（`path_core.js`、`tree_renderer.gd`、`path_app.js`）中。用完整的所有权/认领系统替换简单的基于轮廓的布局。

## 差距分析：原型 vs 生产代码

### 缺失规则

| #   | 规则                           | 原型函数                                  | 生产代码状态 |
| --- | ------------------------------ | ----------------------------------------- | ------------ |
| 1   | **展开顺序**（FIFO 认领）      | `processExpansions()`                     | ❌ 缺失      |
| 2   | **前置免疫**（有效索引）       | `tryClaim()` + `getEffectiveSpineIndex()` | ❌ 缺失      |
| 3   | **后续迁移**（脊柱+后续）      | `claimSpineChain()`                       | ❌ 缺失      |
| 4   | **单次出现**（基于所有者）     | `currentOwner` 优先级检查                 | ⚠️ 部分存在  |
| 5   | **跨支流隔离**（边过滤）       | `drawEdges()` 所有者检查                  | ❌ 缺失      |
| 6   | **脊柱始终可见**（折叠时返回） | `determineVisibility()`                   | ❌ 缺失      |
| 7   | **粘性认领**（可配置）         | `stickyClaimEnabled` 开关                 | ❌ 缺失      |
| 8   | **单元迁移**（递归认领）       | `claim()` 递归支流                        | ❌ 缺失      |
| 9   | **支流层级免疫**               | `getTributaryRootSpineIndex()`            | ❌ 缺失      |

### 缺失概念

| 概念              | 原型                            | 生产代码                           |
| ----------------- | ------------------------------- | ---------------------------------- |
| **节点所有权**    | `currentOwner`, `ownerPriority` | 无                                 |
| **展开顺序**      | `expansionOrder[]`（有序）      | `forcedExpansionNodes`（无序 Set） |
| **有效脊柱索引**  | `getEffectiveSpineIndex()`      | 固定 `spineIndex`                  |
| **可见性链**      | `isOwnerChainVisible()` 递归    | 二元折叠/展开                      |
| **Hull-节点避让** | 凸包 + 填充                     | 基础 hull，无碰撞检查              |

## 建议更改（13 个步骤）

### 组件 1: 核心算法 — `path_core.js`（步骤 1-6）

- **步骤 1**: 添加展开顺序追踪
- **步骤 2**: 实现节点所有权系统
- **步骤 3**: 实现 `tryClaim()` 包含所有 9 条规则
- **步骤 4**: 实现 `determineVisibility()` + `isOwnerChainVisible()`
- **步骤 5**: 更新边生成 — 基于所有者过滤
- **步骤 6**: 更新 hull 生成 — 按所有者分组

### 组件 2: 前端桥接 — `path_app.js`（步骤 7-8）

- **步骤 7**: 有序展开追踪
- **步骤 8**: 添加粘性认领设置

### 组件 3: Godot 树渲染器 — `tree_renderer.gd`（步骤 9-12）

- **步骤 9**: 跨所有者边过滤
- **步骤 10**: Hull 碰撞避让
- **步骤 11**: 节点类型着色
- **步骤 12**: 展开指示器徽章

### 组件 4: Worker 通信 — `path_worker.js`（步骤 13）

- **步骤 13**: 传递 `expansionOrder` 和 `stickyClaimEnabled`

## 验证计划

1. 展开"微积分" → 验证"优化"迁移（规则3）
2. 展开"优化" → 验证"微分方程"不能认领"微积分"（规则2+9）
3. 折叠"微积分" → 验证脊柱节点返回（规则6）
4. 切换粘性认领 → 验证非脊柱节点还原/保持（规则7）
5. 检查 Hull 边界不与节点重叠
# 2026-08-16 Architecture Hardening and Forward-Compatible Mobile Plan

## English Document

### Executed slice

1. Resource identity boundary: normalize workspace-relative paths and fail-fast on duplicate legacy basenames (`src/backend/ResourceIdentity.ts`, `FileLoader.ts`, `GraphBuilder.ts`).
2. Authentication boundary: one strict shared token decision for middleware and server; missing credentials no longer pass when a token is configured.
3. Persistence boundary: unique atomic snapshot temp paths and post-commit cache refresh (`src/learning/store.ts`).

### Multi-platform direction

- Keep `mobile-slim` as a sidecar-free export profile with callable bounded local exact analysis; do not call device RSS/APK acceptance complete without evidence.
- Build the next mobile slice around a host-neutral SQLite/WASM exact-analysis core and versioned bridge operations (`analyze`, `query`, `readEvidence`, `exportBundle`).
- Enforce signed artifact budgets: mobile-low <= 25 MiB app-owned compressed payload / <= 256 MiB RSS for 5k documents and 50k atoms; mobile-standard <= 35 MiB / <= 384 MiB for 20k documents and 200k atoms.
- Never ship Godot, desktop server binaries, full desktop renderer bundles, or local model weights in mobile artifacts. Remote ANN/LLM is optional and cancellable.

### Next gates

1. Add mobile staging + byte/RSS verifier and capability fields.
2. Prove on-device local ingest/query continuity across Tauri Android and Capacitor.
3. Keep stable `sourceUri` dual-read additive: only callers with an explicit canonical workspace root are migration evidence; legacy basename IDs remain unchanged.
4. Shadow route-registry parity, then switch default only after legacy URL coverage is complete.
5. Replace pairwise inferred matching with explicit/indexed projections before increasing worker/GPU budgets; the current inverted anchor index is an intermediate optimization, not the final projection.

## 中文文档

### 已执行切片

1. 资源身份边界：规范化 workspace-relative path，并在 legacy basename 重复时 fail-fast（`src/backend/ResourceIdentity.ts`、`FileLoader.ts`、`GraphBuilder.ts`）。
2. 认证边界：middleware 与 server 共用严格 token 判定，配置 token 时不再放行缺失凭证。
3. 持久化边界：唯一原子快照临时文件与提交后 cache refresh（`src/learning/store.ts`）。

### 多端方向

- 保留 `mobile-slim` sidecar-free export profile，并具备可调用的有界本地 exact analysis；没有设备 RSS/APK evidence 时不能宣称移动端验收闭环。
- 下一切片以 host-neutral SQLite/WASM exact-analysis core 为中心，通过版本化 bridge 提供 `analyze`、`query`、`readEvidence`、`exportBundle`。
- signed artifact 门禁：mobile-low <= 25 MiB 应用自有压缩 payload / 5k documents、50k atoms 下 <= 256 MiB RSS；mobile-standard <= 35 MiB / 20k documents、200k atoms 下 <= 384 MiB。
- 移动包绝不携带 Godot、桌面 server、完整桌面 renderer 或本地模型权重；远端 ANN/LLM 只能是可选、可取消能力。

### 后续门禁

1. 增加 mobile staging + byte/RSS verifier 与 capability 字段。
2. 在 Tauri Android 与 Capacitor 上证明本地 ingest/query 连续性。
3. stable `sourceUri` 继续 additive；只有传入显式 canonical workspace root 的调用才计入迁移证据，graph ID 继续保持兼容。
4. 先做 route-registry shadow parity，旧 URL 覆盖完整后再切默认。
5. 在增加 worker/GPU 预算前，先用 explicit/indexed projection 替代 pairwise inferred matching；当前倒排锚点索引只是中间优化，不是最终 projection。

# 2026-08-17 Phase 8: Replay-Safe Boundaries and Mobile Analysis Contract

## English

### Delivered

1. Graph snapshots have an atomic, fail-closed replay entry (`Graph.fromJSON`/`restore`). Legacy nodes remain valid; undeclared edge endpoints are rejected instead of creating implicit nodes.
2. Identity transitions are explicit. Learning ingest accepts `move`/`rename`, persists a bounded journal, keeps historical aliases, and updates atom/evidence source paths without changing legacy document IDs.
3. The modular ingest route is now an edge contract. It caps request/document/alias sizes, accepts legacy field spellings, preserves identity metadata, and returns a 400 contract error before domain execution.
4. The normal keyword path uses an inverted anchor index. This is a bounded optimization with a semantic fallback for punctuation-only titles; worker/GPU budgets are not raised by this change.
5. Mobile exact projection carries identity aliases and edge provenance (`explicit`, `inferred`, `runtime`), resolves URI references, and exposes projection statistics. It remains body-free and sidecar/Godot/model-free; Android Rust extracts link candidates while reading and does not retain document bodies in the intermediate draft.
6. PathBridge protocol `2.0` adds optional version/correlation fields, capability advertisement, `analyze/query/readEvidence/exportBundle`, and `cancel`. The bridge relays transport envelopes; host adapters retain graph, memory, and authorization policy.

### Next execution gates

- **G1 registry parity:** execute legacy and registry handlers in a shadow harness and compare status, error code/body, headers, and side effects before changing the default dispatch switch.
- **G2 mobile evidence:** fresh arm64 slim APK/AAB extraction must prove no Godot/sidecar/model artifacts; device runs must record RSS under 256 MiB for mobile-low. `not-measured` is not a pass.
- **G3 persistent projection:** introduce a versioned SQLite/WASM adapter only behind the existing export contract; keep the in-memory projection as the fallback until restart/replay fixtures pass on Web, Tauri, Capacitor, and Android.
- **G4 canonical ID:** switch public IDs only after move journal replay, old snapshot/collision/rollback corpora, and cross-root identity fixtures have been recorded. Until then `NoteNode.id` and old layouts remain canonical compatibility keys.

### Trade-offs and rejected shortcuts

- A path-derived URI is a locator, not a permanent file identity. The journal is intentionally explicit; content hashes alone cannot disambiguate same-content notes.
- Protocol capability advertisement is additive and transport-only. Letting a mobile client choose graph or memory policy would create cross-host divergence.
- The inverted index reduces the normal keyword path but cannot make arbitrary fuzzy inference sublinear without a token/ANN policy. That policy is a separate projection milestone, not hidden behind a larger worker pool.

## 中文

### 已交付

1. graph snapshot 增加原子、fail-closed replay 入口（`Graph.fromJSON`/`restore`）。旧节点继续有效；未声明的 edge endpoint 会被拒绝，不会隐式造节点。
2. 身份迁移变为显式语义。learning ingest 接受 `move`/`rename`，持久化有界 journal，保留历史 alias，并更新 atom/evidence 路径而不改旧 document ID。
3. 模块化 ingest 路由成为真正的边界契约：限制 request/document/alias 大小，兼容旧字段拼写，保留身份元数据，并在进入 domain 前以 400 返回契约错误。
4. 正常 keyword 路径使用倒排锚点索引；标点标题保留语义 fallback，且不借此提高 worker/GPU 预算。
5. mobile exact projection 携带身份 alias 与边 provenance（`explicit`、`inferred`、`runtime`），可解析 URI 并暴露 projection 统计；仍不保留正文，也不依赖 sidecar/Godot/本地模型；Android Rust 在读取时提取 link candidate，中间 draft 不保留文档正文。
6. PathBridge protocol `2.0` 增加可选 version/correlation 字段、能力声明、`analyze/query/readEvidence/exportBundle` 与 `cancel`；Bridge 只转发 transport，graph、memory 和授权策略仍由 host adapter 持有。

### 后续门禁

- **G1 registry parity：** 用 shadow harness 同时执行 legacy 与 registry handler，对比状态码、error code/body、headers 和副作用后才能切默认 dispatch。
- **G2 移动证据：** 新鲜 arm64 slim APK/AAB 解包必须证明无 Godot/sidecar/model；真机需记录 mobile-low 峰值 RSS <=256 MiB。`not-measured` 不是通过。
- **G3 持久化 projection：** 仅在既有 export 契约后增加版本化 SQLite/WASM adapter；Web、Tauri、Capacitor、Android 的重启/replay fixture 通过前，保留内存 projection fallback。
- **G4 canonical ID：** 完成 move journal replay、旧 snapshot/collision/rollback corpus 与跨 root identity fixture 后才切公共 ID；此前 `NoteNode.id` 与旧布局继续作为兼容 canonical key。

### 权衡与拒绝的捷径

- 路径派生 URI 是 locator，不是永久文件身份；只靠内容 hash 无法区分同内容笔记，所以 journal 必须显式记录。
- capability advertisement 只增加 transport 能力，不允许移动端决定 graph/memory policy，避免多 host 漂移。
- 倒排索引只优化常见 keyword 路径；任意 fuzzy inference 要做到次线性仍需独立 token/ANN projection，不能用扩大 worker 池掩盖。

# 2026-08-17 Task 7: Stable sourceUri Dual-Read Foundation

## English

### Scope and invariants

- `FileLoader` is the only filesystem identity boundary: it emits POSIX `relativePath`, versioned percent-encoded `sourceUri`, `sha256` `revision`, and explicit aliases.
- Canonical path keys use NFC plus locale-independent lowercasing. NUL, absolute, traversal, and empty-segment inputs are rejected; legacy basename collisions are case-folded and fail-fast.
- `NoteNode.id` remains the legacy public/storage key. `sourceUri`, `revision`, and `identityAliases` are additive and optional for old callers/snapshots.
- `Graph` owns alias resolution for reads and edges. It returns canonical legacy IDs to existing algorithms and rejects alias collisions before mutating indexes.
- `GraphBuilder` accepts old layout keys and new URI/relative aliases, and frontmatter references can use the same forms. No frontend, Godot, or mobile business-rule copy is introduced.

### Verification and rollback

- [x] Focused replay/identity suites now cover 35 tests; core/route, learning, and mobile contract partitions also pass.
- [x] TypeScript build, mobile slim staging/budget, PathBridge strict, Diataxis, and Rust (26 tests) passed on 2026-08-17.
- [ ] Signed arm64 artifact extraction, device RSS, registry shadow parity, and restart-backed SQLite remain release gates.
- Rollback is additive-field removal; old IDs, layouts, route paths, and snapshot JSON remain the compatibility surface.

### Next gates

1. Add old-snapshot, collision, rollback, and cross-root replay corpora before any canonical ID cutover.
2. Validate HTTP payload schemas at route edges, then run route-registry shadow parity.
3. Split explicit/inferred graph projections and bound indexed matching before raising worker/GPU budgets.
4. Replay the additive Bridge 2.0 capability/cancellation envelope across Web, Tauri, Capacitor, and Android; the optional host adapter is now wired on the Node boundary, while concrete mobile host adapters remain evidence-gated.

## 中文

### 范围与不变量

- `FileLoader` 是唯一文件系统身份边界：生成 POSIX `relativePath`、版本化逐段 percent-encoded `sourceUri`、`sha256` `revision` 和显式 alias。
- canonical path key 使用 NFC 与 locale-independent 小写；拒绝 NUL、绝对路径、路径穿越和空段；legacy basename 冲突按大小写折叠并 fail-fast。
- `NoteNode.id` 仍是 legacy 公开/存储 key；`sourceUri`、`revision`、`identityAliases` 为兼容旧调用方和快照的 additive 可选字段。
- `Graph` 统一拥有 alias 读解析与边解析，向现有算法返回 canonical legacy ID，并在修改索引前拒绝 alias 冲突。
- `GraphBuilder` 同时接受旧布局 key 与 URI/relative alias，frontmatter 也支持相同引用形式；不新增 frontend、Godot 或移动端业务规则副本。

### 验证与回滚

- [x] replay/identity 聚焦验证现覆盖 35 个测试；core/route、learning 与 mobile contract 分片也已通过。
- [x] 2026-08-17 TypeScript build、mobile slim staging/budget、PathBridge strict、Diataxis 与 Rust（26 tests）通过。
- [ ] 签名 arm64 产物解包、真机 RSS、registry shadow parity 与重启 SQLite 仍是 release 门禁。
- 回滚只需移除 additive 字段；旧 ID、布局、route path 和 snapshot JSON 继续作为兼容面。

### 后续门禁

1. 在切换 canonical ID 前增加旧 snapshot、collision、rollback 与跨 root replay 语料测试。
2. 在 HTTP 边界完成 schema 校验，再执行 route-registry shadow parity。
3. 拆分 explicit/inferred graph projection，并在提高 worker/GPU 预算前完成索引化匹配。
4. 先在 Web、Tauri、Capacitor、Android replay additive Bridge 2.0 capability/cancellation envelope；Node 边界的可选 host adapter 已接入，具体移动 host adapter 仍受证据门禁约束。

# 2026-08-17 Mobile Slim Implementation Reconciliation

## English

The mobile slice is implemented as a compact exact graph projection, not as a claimed SQLite runtime. The existing Rust Tauri and Capacitor local builders remain platform adapters; the browser-compatible analyzer is the shared query projection. This preserves the multi-platform advantage without duplicating graph policy in each UI.

Completed gates: capability fields, local exact query/path calls, deterministic staging and manifest, forbidden-artifact/estimated-compressed-byte verifier, Capacitor web-dir override, Tauri Android slim frontend override, sidecar removal from default Android build, and explicit Godot opt-in. Open gates: device RSS/APK evidence, SQLite-backed persistence, remote cancellation integration, and the broader identity/registry/graph/Bridge migrations.

# 2026-08-17 Identity Boundary and Mobile Budget Plan

## English

### Decision record

1. `FileLoader` owns workspace identity. Subdirectory scans pass the same workspace root used by full-corpus builds; the optional parameter preserves legacy callers.
2. Learning documents carry identity metadata as optional fields. Persistence is additive, and delete resolution checks explicit `documentId`, then URI/aliases, then the legacy normalized path.
3. Android low-memory graph construction is admission-controlled before file bodies are read. The current `mobile-low` contract is 5,000 documents, 16 MiB per document, 64 MiB total input, and 250,000 edges.

### Forward-compatible sequence

- **Now:** stabilize root propagation, identity metadata propagation, and mobile admission control.
- **Next:** add move/rename journal events and replay fixtures; define the workspace namespace so URI identity is not confused with permanent file identity.
- **Then:** add HTTP schema validation and registry shadow parity; only after parity is measured may registry-first routing become the default.
- **Later:** split explicit/inferred projections, replace pairwise matching with bounded indexes, and negotiate Bridge capabilities/cancellation across Web, Tauri, Capacitor, and Android.

### Trade-offs

- Keeping legacy IDs and optional metadata costs a small amount of payload/storage space but avoids invalidating layouts, caches, and old snapshots.
- Rejecting oversized Android corpora is preferable to partial indexing or silent OOM; the UI must expose the limit and offer a smaller target/export.
- URI aliases are not a rename journal. Treating them as permanent identity would merge same-content files or resurrect stale documents.

# 2026-08-17 Phase 9 Execution Status and Forward Plan

## English

### Gate status

| Gate | Current state | Evidence | Decision |
| --- | --- | --- | --- |
| G1 route parity | pass | 14 equivalent + 6 registry-only probes; status/body/header/side-effect comparison | keep registry default, preserve legacy switch for rollback |
| G2 mobile artifact/RSS | static pass, device pending | ZIP/APK/AAB verifier, arm64 check, and `--require-rss --require-arm64` contract | no release claim until fresh arm64 artifact + device JSON |
| G3 persistent projection | local SQLite replay pass | close -> reopen -> load/query/metadata fixture | keep in-memory fallback; add cross-host fixtures before promotion |
| G4 canonical ID | guarded | alias collision, atomic restore, move journal foundations | do not change public IDs |

### Forward-compatible execution order

1. **Route promotion:** keep `legacy` as an emergency rollback mode; add CI matrix runs for both modes, then delete inline handlers only after the registry-only inventory reaches zero for intended public URLs.
2. **Projection ownership:** define a versioned `ProjectionStore` contract (`schemaVersion`, `sourceUri`, `revision`, bounded adjacency, evidence references). SQLite/WASM is an adapter, not a second domain model; the memory projection remains the fallback.
3. **Host adapters:** implement Web/Tauri/Capacitor/Android adapters behind PathBridge 2.0. The bridge transports correlation/cancellation only; authorization, graph policy, and memory policy stay host-owned.
4. **Mobile release:** stage once, package twice. APK/AAB checks must reject Godot, sidecar, model, SVG, and unbounded binary payloads; release jobs require arm64 artifact metadata plus device RSS evidence. Remote ANN/LLM remains optional and cancellable.
5. **Identity cutover:** replay old snapshots, move journals, collisions, rollback failures, and cross-root fixtures on every host before introducing a new public ID. Keep `NoteNode.id` and old layouts as compatibility keys until then.

### Explicit trade-offs

- Exact parity is stricter than additive response evolution here because legacy clients may deserialize fixed shapes; new telemetry belongs in diagnostics or versioned routes.
- A static payload budget catches accidental desktop/runtime leakage but cannot predict WebView/native RSS; the release gate therefore requires both static and device evidence.
- A shared projection schema avoids per-host algorithm drift, while host adapters still allow platform-specific I/O and cancellation without duplicating graph semantics.

## 中文

### 门禁状态

| 门禁 | 当前状态 | 证据 | 决策 |
| --- | --- | --- | --- |
| G1 route parity | 通过 | 14 条等价 + 6 条 registry-only probe；对比 status/body/header/side-effect | 保持 registry 默认，保留 legacy 回滚开关 |
| G2 移动产物/RSS | 静态通过，真机待补 | ZIP/APK/AAB verifier、arm64 检查与 `--require-rss --require-arm64` 契约 | 没有新鲜 arm64 产物和真机 JSON 不得宣称发布通过 |
| G3 持久化 projection | 本机 SQLite replay 通过 | close -> reopen -> load/query/metadata fixture | 保留内存 fallback；补齐跨 host fixture 后再提升 |
| G4 canonical ID | 保护中 | alias collision、原子 restore、move journal 基础 | 不改变公开 ID |

### 向前兼容推进顺序

1. **路由提升：** 保留 `legacy` 作为紧急回滚模式；先在 CI 对两种模式执行矩阵，再在目标 public URL 的 registry-only inventory 清零后删除内联 handler。
2. **Projection 所有权：** 定义版本化 `ProjectionStore` 契约（`schemaVersion`、`sourceUri`、`revision`、有界邻接、evidence reference）。SQLite/WASM 是 adapter，不是第二套 domain model；内存 projection 继续作为 fallback。
3. **Host adapter：** 在 PathBridge 2.0 后实现 Web/Tauri/Capacitor/Android adapter。Bridge 只负责 correlation/cancellation transport；授权、graph policy、memory policy 仍由 host 持有。
4. **移动发布：** 一次 staging、两条 packaging。APK/AAB 必须拒绝 Godot、sidecar、model、SVG 和无界二进制 payload；release job 必须同时具备 arm64 产物 metadata 与真机 RSS 证据。远端 ANN/LLM 保持可选、可取消。
5. **身份切换：** 在每个 host 上回放旧 snapshot、move journal、collision、rollback failure 与 cross-root fixture 后，才能引入新的 public ID；此前 `NoteNode.id` 与旧布局继续作为兼容 key。

### 明确权衡

- 这里的 exact parity 比 additive response evolution 更严格，因为旧客户端可能按固定 shape 反序列化；新 telemetry 应进入 diagnostics 或版本化 route。
- 静态 payload 预算能拦截桌面运行时泄漏，但不能预测 WebView/native RSS；发布门禁必须同时要求静态和真机证据。
- 共享 projection schema 避免各 host 算法漂移，host adapter 仍可承载平台 I/O 与 cancellation，而不复制 graph 语义。

# 2026-08-17 Phase 10 Implementation Update

## English

### Architecture delta

1. **Projection contract:** `knowledge_projection_contract.js` is the browser-compatible canonical wire shape for mobile projections. Writers emit schema/projection version `1`; readers accept only known versions, ignore additive extensions, omit document bodies, and enforce 50,000 nodes, 250,000 edges, 64 neighbors per direction, and bounded evidence references.
2. **Host parity:** Capacitor normalizes its generated graph through the contract. Tauri Rust emits the same identity and projection fields, including deterministic URI encoding, revision, aliases, edge provenance, and bounded adjacency. This is a shared serialization contract, not a second graph domain model.
3. **Bridge ownership:** `PathBridgeHostAdapter` is an optional execution port. The host controls authorization, graph policy, memory policy, and persistence; the bridge controls correlation, timeout, abort propagation, disconnect cleanup, and legacy-compatible transport fallback.
4. **Mobile constraints:** the Rust Android path remains body-free after link extraction, and the JS path keeps worker/single-thread fallback plus serialization budgets. No Godot, sidecar, local model, SVG, or GPU runtime is introduced into `mobile-slim`.

### Next gates and rationale

- **G2:** produce a fresh signed arm64 APK/AAB, inspect its central directory, run a representative local-KB workload on a physical device, and record peak RSS. Static staging is necessary but cannot establish native/WebView memory safety.
- **G3:** replay the same projection fixture through Web, Tauri, Capacitor, and Android storage boundaries; keep SQLite/WASM adapter-specific and preserve the memory fallback until all hosts agree on schema and query results.
- **G4:** add old snapshots, same-content multi-document collisions, move/rename, rollback, and cross-root identity corpora. Do not promote URI-derived IDs to public canonical IDs.
- **Android import:** implement a Storage Access Framework adapter that copies/streams selected trees into the app-local workspace; do not persist arbitrary external absolute paths as identity.

## 中文

### 架构增量

1. **Projection 契约：** `knowledge_projection_contract.js` 是浏览器兼容的移动 projection canonical wire shape。写端输出 schema/projection 版本 `1`；读端只接受已知版本、忽略 additive extension、不保存正文，并执行 50,000 节点、250,000 边、每方向 64 邻接和有界 evidence reference 限制。
2. **Host parity：** Capacitor 生成图先经过契约归一化；Tauri Rust 输出相同的身份与 projection 字段，包括确定性 URI 编码、revision、alias、边 provenance 与有界 adjacency。这是共享序列化契约，不是第二套 graph domain model。
3. **Bridge 所有权：** `PathBridgeHostAdapter` 是可选执行端口。授权、graph policy、memory policy、persistence 由 host 持有；correlation、timeout、abort 传播、断连清理和 legacy transport fallback 由 Bridge 持有。
4. **移动约束：** Rust Android 路径在提取 link 后仍不保留正文，JS 路径继续使用 worker/single-thread fallback 与序列化预算；`mobile-slim` 不引入 Godot、sidecar、本地模型、SVG 或 GPU runtime。

### 后续门禁与理由

- **G2：** 生成新鲜签名 arm64 APK/AAB，解包中央目录，在真机上运行代表性本地知识库 workload 并记录峰值 RSS。静态 staging 必须通过，但不能证明 native/WebView 内存安全。
- **G3：** 让同一 projection fixture 经过 Web、Tauri、Capacitor、Android storage boundary replay；SQLite/WASM 继续是 adapter 实现，所有 host schema/query 结果一致前保留 memory fallback。
- **G4：** 增加旧 snapshot、同内容多文档 collision、move/rename、rollback 与跨 root identity 语料；不得把 URI 派生值直接升级为公共 canonical ID。
- **Android 导入：** 实现 Storage Access Framework adapter，将用户选择的 tree 复制/流式导入 app-local workspace；不得把外部绝对路径作为永久 identity。

## 中文

### 决策记录

1. `FileLoader` 拥有 workspace identity。子目录扫描必须传入与全库构建相同的 workspace root；可选参数保证旧调用方继续工作。
2. 学习文档以可选字段携带身份元数据。持久化保持 additive，删除按显式 `documentId`、URI/alias、旧 normalized path 的顺序解析。
3. Android 低内存建图在读取正文前执行 admission control；当前 `mobile-low` 契约为 5,000 文档、单文档 16 MiB、总输入 64 MiB、250,000 条边。

### 向前兼容顺序

- **当前：** 稳定 root 传播、身份元数据传播和移动端 admission control。
- **下一步：** 增加 move/rename journal 事件与 replay fixture，并定义 workspace namespace，避免把 URI 身份误当成永久文件身份。
- **随后：** 增加 HTTP schema 校验与 registry shadow parity；只有完成 parity 度量后才能将 registry-first 设为默认。
- **后续：** 拆分 explicit/inferred projection，用有界索引替代 pairwise matching，并在 Web、Tauri、Capacitor、Android 间协商 Bridge capability/cancellation。

### 权衡

- 保留旧 ID 并增加可选元数据会增加少量 payload/storage 成本，但不会破坏布局、缓存和旧快照。
- Android 超限时拒绝构建优于部分索引或静默 OOM；UI 必须显示限制并引导用户缩小 target/export。
- URI alias 不是 rename journal；把它当永久身份会合并同内容文件，或复活过期文档。

## 中文

本轮移动切片落地的是紧凑 exact graph projection，并没有冒充 SQLite runtime 已经存在。复用现有 Tauri Rust 与 Capacitor 本地构建器作为平台 adapter，由浏览器兼容 analyzer 提供共同 query projection，在保持多端优势的同时避免各 UI 各自复制图规则。

已完成门禁：capability 字段、本地 exact query/path 调用、deterministic staging 与 manifest、禁入物/估算压缩字节 verifier、Capacitor web-dir override、Tauri Android slim frontend override、默认 Android 构建移除 sidecar、Godot 显式 opt-in。待完成门禁：真机 RSS/APK 证据、SQLite 持久化、远程取消接线，以及更大范围的 identity/registry/graph/Bridge 迁移。

# 2026-08-18 Phase 11 Projection Store and Android SAF Execution

## English

### Delivered in this increment

1. `knowledge_projection_store.js` now owns the host-neutral persistence boundary. It normalizes through the existing projection contract, supports persistent/read-through and memory adapters, exposes bounded metadata, and retains a last-known projection when a previously successful adapter read becomes temporarily unavailable.
2. `storage_provider.js` consumes the store instead of parsing `graph_data.json` directly. Web, Tauri, Capacitor, and Android fixture adapters replay the same schema, metadata, exact lookup, neighbor, and path results; the store still fails closed on unknown future schemas.
3. Tauri graph assets use sibling temporary files plus rename, so readers never observe a partially serialized projection. Windows replacement is handled explicitly without changing the public graph schema.
4. Android slim builds now have an additive Storage Access Framework bridge. `ACTION_OPEN_DOCUMENT_TREE` grants persisted URI access, streams only Markdown files into a staging tree under app-local `filesDir`, enforces 5,000 documents / depth 64 / 16 MiB per document / 64 MiB total budgets, and atomically activates the imported tree without deleting the previous corpus on failure. Completion is reported through `request_kb_path_change` / `poll_kb_path_change`; external absolute paths never become identity keys.
5. Identity corpus coverage now includes same-content multi-document separation, move/rename alias transitions, and NFC collision rejection. Public `NoteNode.id` remains unchanged.

### Gate status and rationale

- **G1 route parity:** pass; no new work is hidden here.
- **G2 mobile release evidence:** partially evidenced. A fresh arm64 slim build produced an unsigned APK (9,555,787 bytes) and AAB (7,179,228 bytes); central-directory verification measured 9,433,678 and 6,978,122 compressed payload bytes and found only the arm64 native library, with no Godot/sidecar/model/SVG entries. Signed artifacts, device workload, and RSS JSON remain open. Kotlin compilation now succeeds with the available Android toolchain.
- **G3 projection persistence/replay:** fixture-level cross-host replay passes and memory fallback is implemented. This does not yet prove a real Android storage replay or promote SQLite/WASM as the default adapter.
- **G4 canonical IDs:** still guarded. The new corpus strengthens the pre-cutover evidence, but move journal replay, old snapshot rollback, and cross-root restart fixtures remain required.

### Next execution order

1. Sign the fresh arm64 artifacts, install on a representative Android device/emulator, import a bounded external tree through SAF, execute local exact query/path, and capture peak RSS plus import metadata.
2. Add restart/reopen replay around the projection store at the Android app-local boundary; compare it with the existing Node SQLite snapshot adapter without copying graph-domain rules.
3. Finish the old-snapshot/rollback/move journal corpus, then make any public-ID migration decision from evidence rather than URI aesthetics.

## 2026-08-18 Verification Follow-up

The size gate is now reproducible: `mobile:prepare:slim` stages 120 files (4,251,345 uncompressed; 1,545,813 estimated compressed), and the fresh arm64 APK/AAB pass the static artifact verifier under the 25 MiB payload budget. This closes the stale-output and static packaging gap only; unsigned artifacts, real SAF replay, and device RSS remain explicit release gates.

### 中文验证追记

本次验证已闭合可复现的体积门禁：`mobile:prepare:slim` staging 为 120 个文件（未压缩 4,251,345；估算压缩 1,545,813），新鲜 arm64 APK/AAB 通过 25 MiB payload budget 下的静态 artifact verifier。这里只关闭 stale output 与静态打包缺口；未签名产物、真实 SAF replay 和真机 RSS 仍是明确的 release 门禁。

## 中文

### 本轮已落地

1. `knowledge_projection_store.js` 现在拥有 host-neutral 持久化边界：复用现有 projection contract，提供 persistent/read-through 与 memory adapter、有限 metadata，并在 adapter 临时不可用时保留最近一次成功 projection。
2. `storage_provider.js` 不再直接解析 `graph_data.json`，而是经 store 读取。Web、Tauri、Capacitor、Android fixture 对同一 schema、metadata、exact lookup、neighbor、path 结果进行 replay；未知未来 schema 继续 fail closed。
3. Tauri 图资产改为同目录临时文件 + rename，读取者不会看到半个 projection；Windows 覆盖替换单独处理，公共 graph schema 不变。
4. Android slim 增加 additive Storage Access Framework bridge：`ACTION_OPEN_DOCUMENT_TREE` 持久化 URI 权限，在 app-local staging tree 中流式复制 Markdown，执行 5,000 文档、深度 64、单文档 16 MiB、总输入 64 MiB 门禁，成功后原子切换并在失败时保留旧知识库；通过 `request_kb_path_change` / `poll_kb_path_change` 回报异步完成，外部绝对路径不参与 identity。
5. identity corpus 增加同内容多文档区分、move/rename alias 过渡与 NFC collision 拒绝；公开 `NoteNode.id` 保持不变。

### 门禁状态与理由

- **G1 route parity：** 已通过，本轮没有把新工作伪装成 route 未完成。
- **G2 移动发布证据：** 部分已闭合。新鲜未签名 arm64 APK/AAB 已通过中央目录检查与 25 MiB payload budget（APK 9,433,678；AAB 6,978,122 压缩字节），仅含 arm64 native library 且无 Godot/sidecar/model/SVG。签名产物、在线设备和 RSS JSON 仍缺失；当前 Android 工具链 Kotlin 编译已通过，这些静态证据不能替代发布验收。
- **G3 projection 持久化/replay：** fixture 级跨 host replay 已通过，memory fallback 已实现；尚不能证明真实 Android storage replay，也不把 SQLite/WASM 提升为默认 adapter。
- **G4 canonical ID：** 继续保护中。新增 corpus 加强了切换前证据，但仍需 move journal replay、旧 snapshot rollback 与跨 root 重启 fixture。

### 后续执行顺序

1. 为新鲜 arm64 产物签名，安装到代表性 Android 真机/模拟器，经 SAF 导入有界外部目录，执行本地 exact query/path，采集峰值 RSS 与导入 metadata。
2. 在 Android app-local boundary 增加 projection store 重启/reopen replay，与现有 Node SQLite snapshot adapter 对比，但不复制 graph domain rule。
3. 补齐旧 snapshot/rollback/move journal corpus，再基于证据决定是否迁移 public ID，不按 URI 外观做切换。
## 2026-08-18 Phase 13 Native Import Recovery and Cross-Host Closure

### English

The mobile forward-compatibility plan keeps schema-1 body-free projection JSON and host-owned storage adapters. Android now records an atomic import journal with `staging`, `target-backed-up`, and `target-activated` phases; startup recovery restores the previous tree when activation was interrupted and fails closed for corrupt/path-escaping journals. The result marker contract and legacy public IDs remain unchanged.

Current gates are deliberately split. Static slim evidence is 120 files, 4,253,837 uncompressed bytes, 1,546,201 estimated compressed bytes, and 9,436,196 / 6,983,880 APK/AAB compressed payload bytes. G2 still lacks signing, device SAF import/query/path, process-death replay, and RSS <= 256 MiB. G3 has code-level journal/replay evidence but no native device proof. G4 remains frozen until identity namespace/NFC/SHA-256/edge orientation/alias corpora pass.

Execution order: (1) CI-secret-only signing plus a device RSS recorder; (2) native Tauri/Capacitor/Android replay matrix; (3) prove Android body-free drafts and measure transient reads/RSS; (4) identity and registry shadow parity; (5) only then evaluate SQLite/WASM or public-ID cutover. This increment's migration matrix remains 57 suites with 307 passed and 13 skipped.

### 中文

移动端向前兼容计划继续使用 schema-1 无正文 projection JSON 与 host-owned storage adapter。Android 现在记录带 `staging`、`target-backed-up`、`target-activated` 阶段的原子 import journal；启动恢复会在激活中断时恢复旧目录，对损坏/路径逃逸 journal fail closed。result marker 契约与旧 public ID 不变。

当前门禁分层记录：静态 slim 证据为 120 个文件、未压缩 4,253,837、估算压缩 1,546,201 字节，APK/AAB 压缩 payload 为 9,436,196 / 6,983,880。G2 仍缺签名、设备 SAF import/query/path、进程死亡 replay 与 RSS <= 256 MiB。G3 只有代码级 journal/replay 证据，没有原生设备证明。G4 在 identity namespace/NFC/SHA-256/边方向/alias 语料通过前继续冻结。

## 2026-08-18 Phase 15 Native Boundary and Identity Corpus Hardening

1. Replay verifier now uses four explicit host boundary implementations and reports `host-boundary-contract`; it no longer treats one Node adapter as Web/Tauri/Capacitor/Android parity.
2. `canonicalId` is additive and URI-derived; legacy `id` remains public and duplicate canonical IDs fail closed. Exact lookup accepts either key.
3. Route shadow now has 17 equivalent probes, including malformed JSON and invalid build defaults. Inline `/api/build` rejects unsupported recompute modes before graph mutation and matches the registry invalid-JSON status/body/header contract.
4. G4 corpus covers same-content isolation, NFC/case collisions, cross-root identity, legacy snapshots, and graph rollback. Android Rust caps file reads before UTF-8 materialization.

5. Signed-device SAF/query/path, process-death continuity, and RSS remain explicit release gates; no host simulation upgrades their status.

## 2026-08-18 第 15 阶段 原生边界与身份语料加固

1. Replay verifier 现在使用四种明确的 host boundary 实现，并标记 `host-boundary-contract`；不再把同一个 Node adapter 当作 Web/Tauri/Capacitor/Android parity。
2. `canonicalId` 为 additive 且由 URI 派生；legacy `id` 继续作为公开 key，重复 canonical ID fail closed，exact lookup 支持两类 key。
3. Route shadow 现在包含 17 条等价 probe，覆盖 malformed JSON 与非法 build default。Inline `/api/build` 在图变更前拒绝不支持的 recompute mode，并与 registry invalid-JSON 的 status/body/header 契约一致。
4. G4 corpus 覆盖同内容隔离、NFC/大小写 collision、跨 root identity、legacy snapshot 与 graph rollback；Android Rust 在 UTF-8 materialize 前限制文件读取。
5. 签名真机 SAF/query/path、进程死亡 continuity 与 RSS 继续作为显式 release gate；host simulation 不提升其状态。

当前源码变更后的 mobile-slim staging 为 121 个文件、未压缩 4,263,740、估算压缩 1,548,695 字节。现有 APK/AAB 是更早构建的未签名产物，必须重建后才能与本轮源码关联，不能直接作为 release 证据。

执行顺序： (1) 只从 CI secret 注入签名并增加设备 RSS 记录器；(2) Tauri/Capacitor/Android 原生 replay matrix；(3) 证明 Android draft 无正文并测量瞬时读取/RSS；(4) identity 与 registry shadow parity；(5) 之后再评估 SQLite/WASM 或公共 ID 切换。本轮 migration matrix 为 57 suite，307 passed、13 skipped。
## 2026-08-18 Phase 14 Signed Device Evidence and Native Replay

The release boundary is now split into artifact integrity, device execution, and projection semantics. `verify-mobile-artifact.js` owns ZIP/arm64/budget/signature checks; `capture-tauri-android-rss-evidence.js` owns install, explicit workload steps, process-death observation, restart, and VmRSS sampling; the workload itself must prove SAF import, graph build, exact query, path, and continuity. This avoids treating static slim size or a Node fixture replay as Android acceptance.

The harness intentionally accepts only ordered schema-1 `adbArgs` and fails closed for missing signatures, devices, steps, process death, or RSS. This is less ergonomic than arbitrary scripts but prevents host-side command ambiguity and makes evidence reviewable. Next order: CI-secret signing, low-memory arm64 execution, native Tauri/Capacitor/Android replay, then G4 identity/edge corpora and registry shadow parity.

## 2026-08-18 Phase 16 Portable Identity Propagation

- `canonicalId` is now additive across `ResourceIdentity`, `FileLoader`, desktop `GraphBuilder`, browser identity, Capacitor projection, and Android Rust projection.
- `id` remains the compatibility key; schema-1 snapshots/layouts and old exact lookup aliases are unchanged.
- The next parity oracle must match canonical nodes and directed/provenance-aware edges, because Rust and Capacitor still have different legacy key and link-resolution policies.
- Fresh `mobile-slim` staging after this source change is 121 files / 4,265,579 uncompressed bytes / 1,549,039 estimated compressed bytes, SHA-256 `7a62a376e05228e326732db0e1d76e9eedb84d7d344f862df8ee259a42d7bb72`; keep signed-device, RSS, public-ID, and SQLite/WASM gates closed.

## 2026-08-18 第 16 阶段 Portable Identity 传播

- `canonicalId` 现在以 additive 方式贯穿 `ResourceIdentity`、`FileLoader`、桌面 `GraphBuilder`、浏览器 identity、Capacitor projection 与 Android Rust projection。
- `id` 继续是兼容 key；schema-1 snapshot/layout 与旧 exact lookup alias 不变。
- 下一 parity oracle 必须按 canonical node 以及带方向/provenance 的边比较，因为 Rust 与 Capacitor 的 legacy key 和 link resolution 策略仍不同。
- 本轮源码变更后的 fresh `mobile-slim` staging 为 121 个文件 / 未压缩 4,265,579 字节 / 估算压缩 1,549,039 字节，SHA-256 为 `7a62a376e05228e326732db0e1d76e9eedb84d7d344f862df8ee259a42d7bb72`；签名真机、RSS、public-ID 与 SQLite/WASM 门禁继续关闭。

## 2026-08-18 Phase 17 Cross-Host Semantic Parity Closure

1. Use `mobile_semantic_comparator.js` only in verification. Match canonical nodes, normalized source URI, directed endpoints, edge type/kind/provenance; reject duplicate semantic identities.
2. Keep Capacitor and Rust resolution order identical: direct canonical path, source-relative path, unique stem. Keep the worker source aligned with the single-thread resolver, including sourceUri-only inputs.
3. Run one shared corpus through Capacitor and an ignored Rust Cargo probe. Required cases are nested paths, relative and Markdown links, duplicate content, percent-encoded NFC paths, and ambiguous legacy basenames.
4. Keep `id`, schema-1 snapshots, and layout compatibility unchanged. Exclude the comparator from mobile-slim; retain provenance when edge endpoints coincide.
5. Treat the resulting 6-node/4-edge semantic pass as host-boundary evidence only. The next gates are signed arm64 SAF import/query/path, force-stop continuity, RSS `<= 256 MiB`, rollback/move-journal replay, and only then any public-ID or SQLite/WASM decision.

## 2026-08-18 第 17 阶段：跨 Host 语义 Parity 闭环

1. `mobile_semantic_comparator.js` 只用于验证：按 canonical node、归一化 source URI、有向 endpoint 以及 edge type/kind/provenance 比较，重复语义 identity 直接拒绝。
2. Capacitor 与 Rust 保持相同 resolution 顺序：direct canonical path、source-relative path、unique stem；worker 与 single-thread resolver 对 sourceUri-only 输入也必须一致。
3. 用同一 corpus 执行 Capacitor 与 ignored Rust Cargo probe，覆盖 nested path、relative/Markdown link、同内容、percent-encoded NFC path 与含糊 legacy basename。
4. 保持 `id`、schema-1 snapshot 与 layout 兼容；comparator 不进入 mobile-slim，endpoint 相同的 edge 仍保留 provenance。
5. 6 节点/4 条边通过只属于 host-boundary 证据；下一门禁是签名 arm64 SAF import/query/path、force-stop continuity、RSS `<= 256 MiB`、rollback/move-journal replay，之后才评估 public-ID 或 SQLite/WASM。

## 2026-08-18 Phase 18 Native Recovery State-Machine Evidence

### English

1. Add `scripts/verify-mobile-native-recovery.js` as a dependency-free host verifier for the production Kotlin import journal. The verifier mirrors the three journal phases and the same precedence rules: an active target wins, otherwise a valid backup restores the previous corpus, and unresolved state fails closed.
2. Cover six deterministic scenarios: staging with an active target, target-backed-up restoration, target-activated target precedence, orphan backup recovery, unsafe journal paths, and unknown journal schema. Emit schema-1 report metadata with `evidenceLevel: host-recovery-state-machine` and `nativeDeviceEvidence: false`.
3. Keep the verifier out of `mobile-slim`; it is a CI oracle, not a second runtime implementation. The Kotlin bridge remains the production owner, while the contract test makes drift visible when journal names, phases, or recovery precedence change.
4. Treat the current result as code-level recovery evidence only. It does not close Android process-death, SAF UI, storage/permission failure, signed-artifact, or RSS gates.

### Verification and next gates

- Recovery verifier: 6 scenarios passed; focused recovery contract: 1 test passed.
- Full Jest: 146 suites / 1,271 passed / 26 skipped. TypeScript no-emit passes. Rust host suite: 28 passed / 1 ignored probe.
- Projection replay: 4 host boundaries, 6 nodes, 4 edges, no semantic mismatch. Fresh mobile-slim: 121 files / 4,275,083 uncompressed bytes / 1,550,638 estimated compressed bytes, SHA-256 `5d5bafa20770bf42531b2e39ec62364537e0eade83b29a9aa2209f4f03bf7c38`; RSS remains `not measured`.
- Next native gate: signed arm64 APK/AAB, SAF import/query/path, force-stop/reopen continuity, storage and permission failure replay, and measured RSS `<= 256 MiB` on representative low-memory hardware.
- Keep public-ID migration, default SQLite/WASM, and mobile budget increases frozen until native replay plus old-snapshot, move-journal, collision, and rollback corpora are archived.

### 中文

1. 新增 `scripts/verify-mobile-native-recovery.js`，作为生产 Kotlin import journal 的无依赖 host verifier。verifier 镜像三个 journal phase 与相同的优先级：active target 优先；否则有效 backup 恢复旧知识库；无法判定时 fail closed。
2. 覆盖六个确定性场景：staging 且 target 已存在、target-backed-up 恢复、target-activated 的 target 优先、孤儿 backup 恢复、unsafe journal path 与未知 journal schema。报告使用 schema-1 元数据，标记 `evidenceLevel: host-recovery-state-machine` 与 `nativeDeviceEvidence: false`。
3. verifier 不进入 `mobile-slim`，它是 CI oracle，不是第二套运行时实现。生产 owner 仍是 Kotlin bridge；契约测试负责在 journal 名称、phase 或恢复优先级漂移时暴露问题。
4. 当前结果只属于代码级恢复证据，不能关闭 Android 进程死亡、SAF UI、存储/权限失败、签名产物或 RSS 门禁。

### 验证与下一道门禁

- Recovery verifier：6 个场景通过；恢复契约定向测试：1 个测试通过。
- 全量 Jest：146 suites / 1,271 passed / 26 skipped。TypeScript no-emit 通过。Rust host suite：28 passed / 1 ignored probe。
- Projection replay：4 个 host boundary、6 个节点、4 条边且无语义 mismatch。fresh mobile-slim：121 个文件 / 未压缩 4,275,083 字节 / 估算压缩 1,550,638 字节，SHA-256 为 `5d5bafa20770bf42531b2e39ec62364537e0eade83b29a9aa2209f4f03bf7c38`；RSS 仍为 `not measured`。
- 下一道原生门禁：签名 arm64 APK/AAB、SAF import/query/path、force-stop/reopen continuity、存储与权限失败 replay，以及代表性低内存硬件上的 RSS `<= 256 MiB`。
- 在原生 replay 与 old-snapshot、move-journal、collision、rollback corpus 归档前，继续冻结 public-ID 迁移、默认 SQLite/WASM 与移动端预算上调。

## 2026-08-18 Phase 19 Native Import Failure-Path Retention

### Implementation

1. Keep `KnowledgeBasePickerBridge` as the sole production owner of Android import transaction state. In the outer failure boundary, delete only `stagingRoot`; clear `journalFile` only when `backupRoot` is absent. When a backup remains, retain both backup and journal for the next `bindActivity()` recovery pass and persist the existing failed result marker.
2. Keep the public Rust request/poll commands, result JSON shape, journal schema-1 fields, and `mobile-slim` export profile unchanged. This is an additive durability correction, not a new mode flag or adapter layer.
3. Scope the source contract to the exact failure catch. A repository-wide negative regex is invalid because successful replacement and startup recovery legitimately delete backup directories after the active target is known.

### Rationale and trade-offs

- Retaining one backup/journal pair consumes bounded app-local disk until the next activity bind, but eager deletion can destroy the only known-good corpus after a rename/rollback failure.
- The failed result remains visible immediately, so callers do not receive a false success. Recovery may later emit the existing `recovered_previous` completion detail without changing the Rust polling contract.
- No JavaScript verifier enters the mobile runtime; the host mirror remains a CI drift detector. This preserves low package size and low hardware requirements while keeping the native boundary explicit.

### Verification and gates

- Focused Android picker contract: 4 tests passed; TypeScript no-emit passed.
- Full baseline remains 146 Jest suites / 1,271 passed / 26 skipped, Rust 28 passed / 1 ignored, projection replay 4 hosts / 6 nodes / 4 edges, and mobile-slim 121 files / 4,275,083 uncompressed / 1,550,638 estimated compressed bytes with SHA-256 `5d5bafa20770bf42531b2e39ec62364537e0eade83b29a9aa2209f4f03bf7c38`.
- Native gates remain open: signed arm64 artifact, SAF import/query/path, rollback-failure and next-bind recovery, force-stop/reopen continuity, storage/permission failures, and measured RSS `<= 256 MiB`. Do not promote public IDs, default SQLite/WASM, or mobile budgets before those artifacts are archived.

## 2026-08-18 第 19 阶段：原生导入失败路径保留

### 实施

1. `KnowledgeBasePickerBridge` 继续作为 Android import transaction 的唯一生产 owner。外层失败边界只删除 `stagingRoot`；仅当 `backupRoot` 不存在时清理 `journalFile`。backup 仍存在时保留 backup 与 journal，等待下一次 `bindActivity()` recovery，并继续写入既有 failed result marker。
2. 保持 Rust request/poll 命令、result JSON 形状、journal schema-1 字段与 `mobile-slim` export profile 不变。这是 additive durability 修正，不是新增 mode flag 或 adapter 层。
3. 契约测试收窄到准确的失败 catch。全仓负向正则是不正确的，因为成功替换与启动 recovery 在确认 active target 后本来就允许删除 backup。

### 理由与权衡

- 保留一组 backup/journal 会在下次 activity bind 前占用有界 app-local 磁盘，但急于删除可能在 rename/rollback 失败后摧毁唯一可用知识库。
- 失败结果仍立即可见，因此调用方不会得到假成功；后续恢复可以复用既有 `recovered_previous` completion detail，不改变 Rust polling 契约。
- JavaScript verifier 不进入移动运行时；host mirror 仍只是 CI 漂移探测器。这样保持低包体与低硬件需求，同时明确 native boundary。

### 验证与门禁

- Android picker 定向契约：4 个测试通过；TypeScript no-emit 通过。
- 全量基线仍为 146 个 Jest suite / 1,271 passed / 26 skipped，Rust 28 passed / 1 ignored，projection replay 为 4 hosts / 6 nodes / 4 edges，mobile-slim 为 121 个文件 / 未压缩 4,275,083 / 估算压缩 1,550,638 字节，SHA-256 为 `5d5bafa20770bf42531b2e39ec62364537e0eade83b29a9aa2209f4f03bf7c38`。
- 原生门禁仍开放：签名 arm64 产物、SAF import/query/path、rollback failure 与下次 bind recovery、force-stop/reopen continuity、存储/权限失败，以及 RSS `<= 256 MiB` 实测。在这些 artifact 归档前，不提升 public ID、默认 SQLite/WASM 或移动端预算。

## 2026-08-18 Phase 20 Recovery Retry and Fresh Arm64 Artifact Evidence

### Implementation

1. Make startup recovery monotonic. If a journaled backup exists but `renameTo(targetRoot)` fails, delete only staging, retain backup and journal, log the retry condition, and emit `import_recovery_pending`. Do not convert a recoverable backup into `recovered_empty`.
2. Apply the same explicit failure semantics to orphan backups: preserve the orphan and emit `orphan_recovery_pending` when activation cannot be completed. A later activity bind can retry without changing public APIs.
3. Extend `verify-mobile-native-recovery.js` with an injected rename-failure oracle. The eight-scenario report now checks target precedence, restoration, orphan recovery, unsafe/schema rejection, and journaled/orphan backup retention on retry. The verifier remains test-only and outside `mobile-slim`.
4. Build a fresh Android release through `tauri:android:build` with `aarch64`, `opt-level=z`, one codegen unit, thin LTO, panic abort, symbol stripping, and Godot Path Mode excluded. Static artifact verification requires arm64 payload and rejects forbidden entries.

### Evidence and trade-offs

- Fresh unsigned universal APK: `9,696,699` file bytes, compressed payload `9,576,838`, SHA-256 `eb5f63697c6a3e33f3c54659a530f9ed014c600181067ee95684e2377610fbc6`.
- Fresh unsigned universal AAB: `7,256,685` file bytes, compressed payload `7,055,579`, SHA-256 `ee3e9b9451e2afeeb861a4a81311d9caccf9cd64d7871e206453bac3d42f2934`.
- Both artifacts pass the 25 MiB `mobile-low` payload budget, arm64 payload check, and forbidden-entry scan. They are unsigned and have no RSS evidence; artifact integrity is not device acceptance.
- Retaining failed backups costs bounded app-local disk and may require repeated startup retries, but it is strictly safer than deleting the only known-good corpus. Retry markers make the state observable without adding a runtime dependency.

### Remaining gates

Run signed arm64 APK/AAB on representative low-memory hardware through SAF import -> graph build -> exact query -> neighbors/path -> force-stop -> reopen. Capture storage/permission failure retries and peak RSS. Keep public-ID cutover, default SQLite/WASM, and budget increases frozen until those native artifacts are archived.

## 2026-08-18 第 20 阶段：恢复重试与新鲜 arm64 产物证据

### 实施

1. 让启动恢复相对于已知数据单调：journaled backup 存在但 `renameTo(targetRoot)` 失败时，只删除 staging，保留 backup 与 journal，记录重试条件并写入 `import_recovery_pending`。不能把可恢复 backup 转成 `recovered_empty`。
2. 对孤儿 backup 使用同样的显式失败语义：激活失败时保留孤儿并写入 `orphan_recovery_pending`，下次 activity bind 可重试，不改变公开 API。
3. 为 `verify-mobile-native-recovery.js` 增加可注入 rename-failure oracle。七场景报告覆盖 target 优先、旧库恢复、孤儿恢复、unsafe/schema 拒绝，以及 retry 时 backup/journal 保留。verifier 仍仅用于测试且排除出 `mobile-slim`。
4. 通过 `tauri:android:build` 生成新鲜 Android release，使用 `aarch64`、`opt-level=z`、单 codegen unit、thin LTO、panic abort、符号剥离并排除 Godot Path Mode。静态产物验证要求 arm64 payload 并拒绝禁入项。

### 证据与权衡

- 新鲜未签名 universal APK：文件大小 `9,696,699`，压缩 payload `9,576,838`，SHA-256 为 `eb5f63697c6a3e33f3c54659a530f9ed014c600181067ee95684e2377610fbc6`。
- 新鲜未签名 universal AAB：文件大小 `7,256,685`，压缩 payload `7,055,579`，SHA-256 为 `ee3e9b9451e2afeeb861a4a81311d9caccf9cd64d7871e206453bac3d42f2934`。
- 两份产物均通过 `mobile-low` 25 MiB payload、arm64 payload 与禁入项扫描；仍未签名且没有 RSS 证据，产物完整性不等于真机验收。
- 失败 backup 保留会占用有界 app-local 磁盘并可能需要多次启动重试，但严格优于删除唯一可用知识库；retry marker 让状态可观测且不增加运行时依赖。

### 剩余门禁

在代表性低内存硬件上运行签名 arm64 APK/AAB，执行 SAF import -> graph build -> exact query -> neighbors/path -> force-stop -> reopen，并记录存储/权限失败重试与 peak RSS。原生 artifact 归档前，继续冻结 public-ID 切换、默认 SQLite/WASM 与预算上调。

## 2026-08-18 Phase 21 Host Gate Reconciliation

### Current evidence

1. Host verification remains green: Android prerequisites, TypeScript no-emit, the 8-scenario recovery mirror, and the 4-host projection replay pass. Their reports are generated under ignored verification output and do not alter the repository.
2. The only configured AVD is `Medium_Phone_API_36.1` at `E:\Android\avd\Medium_Phone.avd`. Its image is Android `36.1` / Play Store / `x86_64` with 2 GiB RAM; `adb devices -l` reports no online target. This is useful for tooling smoke tests only, not arm64 release evidence.
3. No approved signing material is present in the repository or host search (`.jks`, `.keystore`, `.p12`). The fresh APK/AAB therefore remain unsigned static artifacts. The release verifier must continue requiring `--require-signed --require-arm64 --require-rss`.

### Forward-compatible execution plan

1. CI injects signing material ephemerally, builds the existing slim `aarch64` profile, and publishes only the signed APK/AAB plus provenance; no keystore enters git or the mobile bundle.
2. A device-lab run selects arm64 low-memory hardware. An arm64 emulator may be used for harness debugging with explicit opt-in, but cannot satisfy production acceptance by itself.
3. The lab supplies a schema-1 workload spec with explicit `adbArgs` for `saf-import -> graph-build -> exact-query -> path -> continuity`, including a bounded corpus and assertions for import status, exact results, edge/path shape, and post-restart continuity.
4. The recorder archives artifact SHA-256, signature metadata, masked device identity, force-stop observation, step results, logcat tail, and `/proc/<pid>/status:VmRSS` samples. Any missing sample, unobserved process death, failed retry, or peak RSS above 256 MiB fails closed.
5. Only after this evidence is archived should the team reassess canonical public IDs, default SQLite/WASM, or mobile budget changes. Until then, the memory projection and existing compatibility aliases remain the least-risk default.

### Trade-offs and rejected shortcuts

- Rebuilding for x86_64 would make the local AVD installable but would weaken the requested arm64/mobile target and provide no evidence about the release artifact.
- Generating a local debug keystore would prove only test signing, not release provenance; it is intentionally not treated as an approved signing path.
- Allowing unsigned or emulator-only evidence would make the gate non-monotonic and hide the exact failure modes this plan is intended to expose.

## 2026-08-18 第 21 阶段：宿主门禁对账

### 当前证据

1. 宿主验证继续全绿：Android prerequisite、TypeScript no-emit、8 场景 recovery mirror 与 4-host projection replay 均通过。报告写入被忽略的 verification output，不改变仓库内容。
2. 唯一已配置 AVD 为 `Medium_Phone_API_36.1`，路径是 `E:\Android\avd\Medium_Phone.avd`；镜像为 Android `36.1` / Play Store / `x86_64`，内存 2 GiB；`adb devices -l` 没有 online target。它只适用于工具链 smoke test，不能作为 arm64 release 证据。
3. 仓库与宿主搜索均没有获批签名材料（`.jks`、`.keystore`、`.p12`）。因此新鲜 APK/AAB 仍是未签名静态产物；release verifier 继续要求 `--require-signed --require-arm64 --require-rss`。

### 向前兼容执行计划

1. CI 临时注入签名材料，沿用 slim `aarch64` profile 构建，只发布签名 APK/AAB 与 provenance；keystore 不进入 git 或移动 bundle。
2. 设备实验室选择 arm64 低内存硬件。arm64 emulator 可以显式 opt-in 用于 harness 调试，但不能单独满足生产验收。
3. 实验室提供 schema-1 workload spec，通过显式 `adbArgs` 按 `saf-import -> graph-build -> exact-query -> path -> continuity` 执行，携带有界 corpus，并断言 import status、exact result、edge/path 形状和重启后 continuity。
4. recorder 归档 artifact SHA-256、签名元数据、脱敏设备身份、force-stop 观察、步骤结果、logcat 尾部与 `/proc/<pid>/status:VmRSS` 样本。缺样本、进程死亡不可观测、重试失败或 peak RSS 超过 256 MiB 均 fail closed。
5. 只有这些证据归档后，才重新评估 canonical public ID、默认 SQLite/WASM 或移动预算变化。在此之前，memory projection 与既有兼容 alias 仍是风险最低的默认方案。

### 权衡与拒绝的捷径

- 为了让本地 AVD 可安装而重建 x86_64，会削弱目标 arm64/mobile 路径，且不能证明 release artifact。
- 生成本地 debug keystore 只能证明测试签名，不代表 release provenance，因此不作为获批签名路径。
- 接受未签名或仅 emulator 证据会使门禁失去单调性，并掩盖本计划要暴露的真实失败模式。

## 2026-08-18 Phase 22 CI Signing Gate and Mobile Budget Reconciliation

### Implementation status

1. `scripts/configure-tauri-android-signing.js` owns the signing boundary: stale generated markers are removed, local builds remain unsigned by default, and release signing is injected only when all four environment values and a real keystore are present. `NOTE_CONNECTION_ANDROID_REQUIRE_SIGNING=1` turns missing configuration into a hard failure.
2. The Android release workflow materializes the keystore ephemerally, builds the existing slim `aarch64` profile, verifies signed arm64 APK/AAB artifacts, copies only verified outputs, and removes the keystore. No signing material enters source or mobile-slim.
3. `verify-mobile-artifact.js` accepts AAB `jarsigner` status `4` only for a signed archive with an untrusted/self-signed chain. Unsigned and malformed archives remain rejected.
4. Contract coverage now includes workflow, Gradle injection, local unsigned default, and verifier semantics. An ephemeral local JKS smoke passed APK/AAB arm64 and signature checks; it is not approved release provenance.

### Architecture risks and forward plan

- `universal` is currently a label stronger than the artifact evidence: inspection found only `arm64-v8a/libnpm_lib.so`. Keep arm64 as the runtime target and either rename outputs to `arm64` or add an explicit per-ABI manifest and install check before claiming universal.
- The 64 MiB input admission, 48 MiB frontend projection ceiling, Rust node/edge limits, and `VmRSS <= 256 MiB` gate are different budgets. Full-string reads, duplicate JSON parsing, maps, and SAF staging/backup can still exceed RSS or disk peaks after admission succeeds.
- The arm64 Rust library is roughly 7 MiB of compressed APK payload. Bypassing `run-tauri-android.js` can revert Cargo to `opt-level=0`, `codegen-units=256`, and no LTO, so the runner remains part of the Android build contract.
- `read_node_content` still needs a bounded streaming/size-rejection policy. Do not add SQLite/WASM, Godot, or a larger corpus budget until transient reads and native RSS are measured.

Next execution is deliberately ordered: (1) CI-signed arm64 artifact plus approved low-memory device workload `saf-import -> graph-build -> exact-query -> path -> continuity`; (2) storage/permission retry and force-stop/reopen evidence with artifact hash, manifest, logcat, and `rss.json`; (3) one versioned mobile budget manifest; (4) only then identity migration, database promotion, or budget changes. Missing evidence or RSS above 256 MiB fails closed.

Observed local evidence: slim profile 121 files / `4,275,083` uncompressed / `1,550,638` estimated compressed bytes; signed smoke APK `9,576,838` and AAB `7,140,668` compressed payload bytes. These are integration facts, not release acceptance.

## 2026-08-18 第 22 阶段：CI 签名门禁与移动预算对账

### 实施状态

1. `scripts/configure-tauri-android-signing.js` 拥有签名边界：清理 generated marker，本地默认 unsigned，只有四项环境变量与真实 keystore 齐全时才注入 release signing；`NOTE_CONNECTION_ANDROID_REQUIRE_SIGNING=1` 会把缺失配置变成硬失败。
2. Android release workflow 临时落盘 keystore，沿用 slim `aarch64` 构建，验证签名 arm64 APK/AAB，只复制已验证产物并删除 keystore。签名材料不进入源码或 mobile-slim。
3. `verify-mobile-artifact.js` 仅在 AAB 确实已签名但证书链不受信任/自签时接受 `jarsigner` 返回码 `4`；unsigned 或损坏归档仍拒绝。
4. Contract 已覆盖 workflow、Gradle 注入、本地 unsigned default 与 verifier 语义。临时 JKS smoke 已通过 APK/AAB arm64 与签名检查，但不是获批 release provenance。

### 架构风险与向前计划

- `universal` 目前强于产物证据：检查只发现 `arm64-v8a/libnpm_lib.so`。继续以 arm64 为运行时目标，并在声明 universal 前改名为 `arm64` 或增加逐 ABI manifest 与安装校验。
- 64 MiB input admission、前端 48 MiB projection ceiling、Rust node/edge 上限与 `VmRSS <= 256 MiB` 属于不同预算。完整 String 读取、JSON 重复解析、Map 以及 SAF staging/backup 峰值仍可能在 admission 通过后超 RSS 或磁盘峰值。
- arm64 Rust library 约占 APK 压缩 payload 的 7 MiB；绕过 `run-tauri-android.js` 会回退到 Cargo `opt-level=0`、`codegen-units=256`、无 LTO，因此 runner 是 Android build contract 的一部分。
- `read_node_content` 仍需有界 streaming/大小拒绝策略。在测量瞬时读取与 native RSS 前，不增加 SQLite/WASM、Godot 或语料预算。

后续顺序固定为：(1) CI 签名 arm64 产物 + 获批低内存设备执行 `saf-import -> graph-build -> exact-query -> path -> continuity`；(2) 存储/权限重试与 force-stop/reopen，归档 artifact hash、manifest、logcat、`rss.json`；(3) 版本化 mobile budget manifest；(4) 之后才评估身份迁移、数据库提升或预算变化。缺证据或 RSS 超过 256 MiB 必须 fail closed。

当前本地事实：slim profile 121 个文件 / 未压缩 `4,275,083` / 估算压缩 `1,550,638` 字节；签名 smoke 的 APK `9,576,838`、AAB `7,140,668` 压缩 payload 字节。它们是集成事实，不构成 release acceptance。

## 2026-08-18 Phase 23 Versioned Mobile Budget Contract and Arm64 Truthfulness

### Implementation

1. Added `config/mobile-budget.v1.json` plus `scripts/mobile-budget-contract.js`. The loader validates schema `1`, positive integer fields, and both `mobile-low` and `mobile-standard` profiles. `verify-mobile-slim-budget.js`, `verify-mobile-artifact.js`, and `prepare-mobile-slim.js` now consume the same profile values; the generated manifest records the runtime limits and contract version.
2. Added Rust-side `MOBILE_MAX_PROJECTION_BYTES` at 48 MiB. Android/test builds validate pretty `graph_data.json`, compact `data.js`, and target cache variants before atomic writes. This aligns the native writer with the existing frontend projection store ceiling without changing the projection schema.
3. Reused `read_mobile_markdown_content` for Android `read_node_content` and test builds. The bounded reader reads at most 16 MiB plus one sentinel byte, rejects over-limit content, and preserves UTF-8/path-jail checks. Non-mobile desktop builds retain the existing unbounded API behavior.
4. Changed the release workflow target and label to `aarch64`/arm64. The verifier now exposes native ABI directories and supports an exact `arm64-v8a`-only gate; verified outputs are copied as `noteconnection-arm64-release.apk/.aab`. The explicit `tauri:android:*:universal` scripts remain available for local experiments, but release evidence cannot imply unverified ABI coverage.

### Contract and compatibility rules

- The JSON contract is build/evidence metadata, not a runtime schema migration. Existing projection `schemaVersion`, public IDs, Rust request/poll commands, and host adapters remain backward-compatible.
- Limits are intentionally duplicated into Rust constants because Android native code cannot depend on a Node loader at runtime. The Rust unit test parses the checked-in contract and fails on drift; JS contract tests cover the packaging/verifier consumers.
- Projection size is checked before `write_atomic`, preserving the previous known-good projection when a new graph is too large. This is a monotonic failure boundary and avoids replacing a valid cache with a partial or over-budget artifact.
- Bounded content reads may reject a single oversized note even when the rest of the corpus is valid. That trade-off is required for the low-memory profile; desktop behavior and public content APIs are unchanged.

### Verification and next gates

- Versioned manifest generated with 121 files / `4,275,083` uncompressed / `1,550,638` estimated compressed bytes and runtime budget fields.
- Focused JS contracts: 28 tests passed. Rust: 30 passed / 1 ignored. TypeScript no-emit, slim budget and Diataxis checks pass.
- Remaining external gates are unchanged: approved CI signing key, online arm64 device, SAF/import/query/path workload, force-stop/reopen, storage/permission retries, and native RSS `<= 256 MiB`.
- Do not promote SQLite/WASM, Godot inclusion, public-ID migration, or larger budgets until the native evidence archive is complete.

## 2026-08-18 第 23 阶段：版本化移动预算契约与 arm64 语义对齐

### 实施

1. 增加 `config/mobile-budget.v1.json` 与 `scripts/mobile-budget-contract.js`。loader 校验 schema `1`、正整数以及 `mobile-low`/`mobile-standard` 两个 profile；`verify-mobile-slim-budget.js`、`verify-mobile-artifact.js` 与 `prepare-mobile-slim.js` 共用同一组 profile 值，生成 manifest 同时记录 runtime limits 与 contract version。
2. Rust 增加 48 MiB 的 `MOBILE_MAX_PROJECTION_BYTES`。Android/test 构建在 atomic write 前检查 pretty `graph_data.json`、compact `data.js` 与 target cache，和现有前端 projection store ceiling 对齐，不改变 projection schema。
3. Android `read_node_content` 与 tests 复用 `read_mobile_markdown_content`。bounded reader 最多读取 16 MiB 加一个 sentinel byte，超限即拒绝，并保留 UTF-8/path-jail 校验；桌面非 mobile 构建继续使用原有 API 行为。
4. release workflow 的 target 与命名改为 `aarch64`/arm64。verifier 暴露 native ABI 目录并支持精确 `arm64-v8a`-only 门禁；已验证产物复制为 `noteconnection-arm64-release.apk/.aab`。显式 `tauri:android:*:universal` 命令仍可用于本地实验，但 release 证据不再暗示未验证的 ABI 覆盖。

### 契约与兼容规则

- JSON contract 是构建/证据 metadata，不是 runtime schema migration。现有 projection `schemaVersion`、public ID、Rust request/poll command 与 host adapter 保持向前兼容。
- Rust 常量仍需本地保留，因为 Android native 运行时不能依赖 Node loader；Rust unit test 解析仓库 contract 防止漂移，JS contract 覆盖 packaging/verifier consumer。
- projection 在 `write_atomic` 前检查大小，过大的新图谱不会替换上一份已知可用 projection。这是单调失败边界，避免用不完整或超预算产物覆盖有效缓存。
- bounded content read 可能拒绝单个超大笔记，即使其余语料合法；这是低内存 profile 的必要权衡，桌面行为与 public content API 不变。

### 验证与下一道门禁

- 生成 manifest：121 个文件 / 未压缩 `4,275,083` / 估算压缩 `1,550,638` 字节，并包含 runtime budget fields。
- 定向 JS contract：28 tests passed；Rust：30 passed / 1 ignored；TypeScript no-emit、slim budget 与 Diataxis 通过。
- 外部门禁不变：获批 CI signing key、在线 arm64 设备、SAF/import/query/path workload、force-stop/reopen、存储/权限重试与原生 RSS `<= 256 MiB`。
- 在原生证据归档完成前，不提升 SQLite/WASM、Godot inclusion、public-ID 迁移或移动预算。

## 2026-08-21 Phase 24 Cross-Host Runtime Budget Projection and Native Evidence Separation

### Implementation

1. Added `src/frontend/mobile_budget_runtime.js` as the browser-sized projection of `config/mobile-budget.v1.json`; it loads before `storage_provider.js`. The Node loader remains the source of truth and `src/mobile.budget.contract.test.ts` rejects drift in schema, profiles, runtime limits, and SHA-backed staging metadata.
2. Changed Capacitor graph admission to measure UTF-8 bytes rather than JavaScript UTF-16 code units. The same runtime budget now bounds documents (5,000), a document (16 MiB), total input (64 MiB), depth (64), edges (250,000), and serialized projection (48 MiB) for worker and single-thread fallback paths.
3. Closed two preflight gaps found during review: `capacitorReadText` uses filesystem `stat` when available before `readFile` and retains a decoded UTF-8 guard for SAF implementations without stat; all enumerated entries, including Markdown files, are checked against depth before traversal/read. This is intentionally conservative for low-memory devices.
4. Added Tauri generated-asset checks before bootstrap copy and IPC reads. The known-good projection remains intact when a new projection exceeds the ceiling. Android evidence now records exact native ABI and measurable RAM, rejects devices above the selected profile ceiling, and keeps serials masked.
5. Split CI packaging from release acceptance. The Ubuntu Android job signs/builds/verifies arm64 artifacts and exposes workflow artifacts only. An explicit self-hosted `[self-hosted, android-arm64]` job runs the schema-1 SAF/import/query/path/continuity workload and RSS capture; only its success unlocks GitHub Release upload.

### Position against the preceding architecture

- Phase 23 unified build/evidence metadata but still had duplicated browser limits and post-read Capacitor accounting. Phase 24 makes the browser runtime consume one additive projection and moves the memory-sensitive rejection to the read boundary.
- The cross-host contract is unchanged: projection schema, public IDs, request/poll commands, and host adapters remain backward-compatible. No mobile database, embedded model, or Godot runtime is added to the payload.
- Packaging remains runtime-first. The latest mobile-low staging is 122 files / `4,283,033` uncompressed / `1,552,689` estimated compressed bytes, well below the 25 MiB artifact ceiling; this is not an RSS result.

### Verification and forward gates

- Latest focused contracts after the boundary fix: 16 tests passed; TypeScript no-emit, slim staging/budget, and Diataxis checks pass. Full Jest is 148 suites / 1,280 passed / 26 skipped; Rust host tests are 30 passed / 1 ignored.
- The native G2/G3 gate remains open because this host has no approved signing key or online approved arm64 device. The next executable step is CI-signed artifact -> approved low-RAM arm64 device -> ordered workload -> force-stop/reopen -> `rss.json` and provenance archive.
- Keep SQLite/WASM promotion, public-ID migration, Godot inclusion, and budget increases frozen until native evidence is reproducible and archived.

## 2026-08-21 第 24 阶段：跨 host runtime budget 投影与原生证据隔离

### 实施

1. 增加 `src/frontend/mobile_budget_runtime.js`，作为 `config/mobile-budget.v1.json` 的 browser-sized projection，并在 `storage_provider.js` 之前加载。Node loader 仍是 source of truth，`src/mobile.budget.contract.test.ts` 校验 schema、profile、runtime limits 与 staging metadata 不漂移。
2. Capacitor graph admission 改用 UTF-8 字节而非 JavaScript UTF-16 code unit 计量。worker 与 single-thread fallback 共用文档数 5,000、单文档 16 MiB、总输入 64 MiB、深度 64、边 250,000、serialized projection 48 MiB 上限。
3. 关闭 review 发现的两个预检缺口：`capacitorReadText` 在可用时先调用 filesystem `stat` 再 `readFile`，对不提供 stat 的 SAF 实现保留 decoded UTF-8 兜底；所有枚举 entry（包括 Markdown 文件）在遍历/读取前检查深度。该策略对低内存设备有意偏保守。
4. Tauri 在 bootstrap copy 与 IPC read 前增加 generated-asset 检查；新 projection 超限时保留上一份 known-good projection。Android evidence 记录精确 native ABI 与可测 RAM，拒绝超过 profile ceiling 的设备，并继续脱敏 serial。
5. CI 分离打包与发布验收。Ubuntu Android job 签名/构建/验证 arm64 产物但只暴露 workflow artifact；显式 self-hosted `[self-hosted, android-arm64]` job 执行 schema-1 SAF/import/query/path/continuity workload 与 RSS capture，只有成功后才允许上传 GitHub Release。

### 相对前序架构的位置

- 第 23 阶段统一了 build/evidence metadata，但 browser limits 仍有重复，Capacitor 仍是读后计量。第 24 阶段让 browser runtime 消费同一份 additive projection，并把内存敏感拒绝前移到 read boundary。
- 跨 host contract 不变：projection schema、public ID、request/poll command 与 host adapter 保持向前兼容；没有向移动 payload 加入数据库、内置模型或 Godot runtime。
- 打包继续采用 runtime-first。当前 mobile-low staging 为 122 文件 / 未压缩 `4,283,033` / 估算压缩 `1,552,689` bytes，明显低于 25 MiB artifact ceiling；这不是 RSS 结果。

### 验证与前向门禁

- 边界修复后的定向 contract 为 16 tests passed；TypeScript no-emit、slim staging/budget 与 Diataxis 通过。全量 Jest 为 148 suites / 1,280 passed / 26 skipped；Rust host tests 为 30 passed / 1 ignored。
- 原生 G2/G3 仍开放：当前宿主没有获批 signing key 或在线获批 arm64 设备。下一步必须是 CI 签名产物 -> 获批低 RAM arm64 设备 -> 有序 workload -> force-stop/reopen -> `rss.json` 与 provenance archive。
- 在原生证据可重复并归档前，继续冻结 SQLite/WASM、public-ID 迁移、Godot inclusion 与预算上调。

## 2026-08-21 Phase 25 Collision-Safe Identity Transition and Owner Convergence

### English

#### Implementation

1. `KnowledgeLearningPlatform` now preflights the complete target alias set for `move`/`rename` before changing document, atom, or evidence records. Historical aliases are part of the collision domain; a target URI, path, or basename owned by another document fails closed.
2. A successful identity transition mirrors the committed path/URI/revision/alias state into `ResourceRegistry`, the workspace binding, and `IndexLifecycle` in place. Resource/projection IDs, legacy `documentId`, index units, content hashes, and segments remain stable.
3. Regression coverage now records the G4 move/collision corpus: rejected collision leaves the persisted document, resource projection, and index path unchanged; successful move keeps all four owners aligned after persistence.

#### Position against earlier plans

- The earlier additive `sourceUri` work protected graph and learning snapshots but left secondary owners stale after a path-only move. This phase closes that owner gap without changing snapshot schema, projection schema, public IDs, or mobile runtime assets.
- LearnGraph's typed boundary lesson is applied as an explicit identity transition contract; textbooks' package/compiler direction remains a future source-ingestion boundary. Neither reference justifies putting a database, Node sidecar, Godot runtime, or model into `mobile-slim`.
- The mobile consequence is favorable but intentionally small: no new dependency or payload, and fewer stale path lookups when a desktop or mobile host replays an imported corpus. This is not native-device RSS evidence.

#### Remaining risk and next execution order

1. Add whole-request preflight or journaled rollback for batches containing multiple `upsert`/`move`/`delete` operations. The single-move collision boundary is fail-closed, but a later operation in the same request can still expose the broader ingest transaction to partial mutation.
2. Record old-snapshot, cross-root, collision, rollback, and move-journal manifests as versioned G4 evidence; keep public canonical-ID cutover frozen until replay is archived across host adapters.
3. Keep the memory projection as the mobile default. Evaluate SQLite/WASM only as an opt-in adapter after native restart/RSS evidence and projection query parity are reproducible.
4. Only after those gates, continue route-registry strict-default and complete-use-case extraction; do not add wrappers that merely rename `KnowledgeLearningPlatform` responsibilities.

#### Verification

- Focused suites: 3 suites / 11 tests passed (`ResourceRegistry`, `IndexLifecycle`, `KnowledgeLearningPlatform.persistence`).
- Full regression after this phase: 148 Jest suites / 1,284 passed / 26 skipped; Rust 30 passed / 1 ignored; four-host projection replay passed; fresh mobile-low staging remains 122 files / 4,283,033 uncompressed / 1,552,689 estimated compressed bytes with SHA-256 `c60fe683957faf8fcf88a34b1c766740340c2cdd005bc526cc4efe13befbf77c`.
- TypeScript no-emit passed; `git diff --check` passed.
- Native G2/G3 remains pending: no approved signing key, online approved arm64 device, SAF workload, force-stop/reopen continuity, retry evidence, or measured `VmRSS <= 256 MiB`.

## 2026-08-21 第 25 阶段：冲突安全的身份迁移与 owner 收敛

### 中文

#### 已落地

1. `KnowledgeLearningPlatform` 在执行 `move`/`rename` 前，先对完整目标 alias 集合做预检，再修改 document、atom 与 evidence。历史 alias 也属于 collision 域；若目标 URI、路径或 basename 已被其他文档占用，则 fail-closed。
2. 成功的身份迁移会原地同步 `ResourceRegistry`、workspace binding 与 `IndexLifecycle` 的 path/URI/revision/alias。resource/projection ID、旧 `documentId`、index unit、content hash 与 segment 保持稳定。
3. 回归测试补齐 G4 的 move/collision 语料：拒绝 collision 后持久化 document、resource projection 与 index 路径不变；成功 move 持久化后四个 owner 保持一致。

#### 相对既有方案的位置

- 之前的 additive `sourceUri` 只保护了 graph 与 learning snapshot，path-only move 后的 secondary owner 仍可能指向旧路径。本阶段在不改变 snapshot schema、projection schema、公开 ID 或移动运行时资产的前提下补齐该缺口。
- LearnGraph 的类型化边界经验被落实为明确的 identity transition contract；textbooks 的 package/compiler 方向仍作为后续 source-ingestion 边界。两者都不能证明应把数据库、Node sidecar、Godot runtime 或模型带入 `mobile-slim`。
- 对移动端的收益是低成本且有限的：不增加依赖或包体，并减少导入语料在 move replay 后出现陈旧路径查询的概率；这不等于真机 RSS 证据。

#### 剩余风险与执行顺序

1. 为包含多个 `upsert`/`move`/`delete` 的单个请求增加 whole-request preflight 或 journaled rollback。当前单 move collision 已 fail-closed，但同一请求后续操作仍可能产生部分 mutation。
2. 将 old-snapshot、跨 root、collision、rollback 与 move-journal manifests 作为有版本的 G4 证据归档；在跨 host replay 归档前继续冻结 public canonical-ID 切换。
3. 保持 memory projection 为移动端默认；只有在原生重启/RSS 证据和 projection query parity 可复现后，才评估 SQLite/WASM opt-in adapter。
4. 上述门禁完成后再推进 route-registry strict default 与完整 use-case 抽取；不增加只改名、不承载 invariant 的 wrapper。

#### 验证

- 定向 suite：3 suites / 11 tests passed（`ResourceRegistry`、`IndexLifecycle`、`KnowledgeLearningPlatform.persistence`）。
- 本阶段全量回归：148 个 Jest suite / 1,284 passed / 26 skipped；Rust 30 passed / 1 ignored；四 host projection replay 通过；fresh mobile-low staging 仍为 122 文件 / 未压缩 4,283,033 / 估算压缩 1,552,689 bytes，SHA-256 为 `c60fe683957faf8fcf88a34b1c766740340c2cdd005bc526cc4efe13befbf77c`。
- TypeScript no-emit 与 `git diff --check` 通过。
- 原生 G2/G3 仍 pending：缺少获批 signing key、在线获批 arm64 设备、SAF workload、force-stop/reopen continuity、失败重试证据与实测 `VmRSS <= 256 MiB`。

## 2026-08-21 Phase 26 Request-Level Ingest Atomicity and Single-Writer Serialization

### English

#### Implementation

1. `ingestKnowledge` is now a per-platform single-writer queue. Web, Tauri, and future mobile adapters therefore share one ordering invariant without a new runtime or IPC dependency.
2. Each request captures a deep pre-image of the existing versioned `KnowledgeGraphSnapshot` before mutation. Operation, relation-recompute, owner-mirror, or atomic-persistence failures restore document/atom/evidence maps, secondary registries, index state, identity journal, telemetry, and `idCounter` together.
3. Identity ownership is validated once at the boundary. `upsert` and `move` reject path/URI/alias collisions; an explicit move ID must agree with supplied `from*` aliases; ambiguous alias resolution and missing owner mirrors fail closed.
4. A G4 mixed-batch fixture proves that a successful first move is invisible after a later collision and that the original alias remains available for a subsequent move.

#### Position against earlier plans and mobile trade-off

- This closes the Phase 25 limitation without changing public IDs, snapshot/projection schemas, Bridge fields, or the runtime-first mobile package. LearnGraph remains a typed-boundary reference; textbooks remains a future content-package/compiler input boundary. Neither reference justifies a database, Node sidecar, Godot runtime, or model in `mobile-slim`.
- Full snapshot rollback reuses the existing replay contract and keeps host adapters forward-compatible. The cost is transient memory proportional to the current graph and JSON clone/restore latency, so low-memory acceptance must measure it and callers should use bounded batches.
- The single-writer queue prevents a second import from observing a half-restored graph, but storage providers remain responsible for their atomic save contract.

#### Remaining gates

1. Archive versioned old-snapshot, cross-root, move-journal, collision, and rollback manifests and replay them on Web, Tauri, Capacitor compatibility, and Android journaled storage.
2. Run signed arm64 native workload, force-stop/reopen continuity, permission/retry paths, and real `VmRSS <= 256 MiB` evidence with representative batch sizes. Keep SQLite/WASM, public-ID cutover, Godot inclusion, and budget increases frozen until those artifacts exist.
3. Only after replay and native evidence are reproducible should route-registry strict-default and complete-use-case extraction proceed; do not add pass-through wrappers.

#### Verification

- Added mixed-batch rollback, explicit source alias validation, and upsert alias ownership regression coverage; prior collision and four-owner convergence fixtures remain.
- Current verification: TypeScript no-emit passed; 148 Jest suites passed with 1,287 passed and 26 skipped; Rust passed with 30 passed and 1 ignored; mobile-low staging passed with 122 files / 4,283,033 uncompressed / 1,552,689 estimated compressed bytes; projection replay passed for 4 hosts; native recovery passed 8 scenarios; Diataxis passed with 18 entries / 36 paths / 64 canonical references; `git diff --check` passed.

## 2026-08-21 第 26 阶段：请求级 ingest 原子性与单写者串行化

### 中文

#### 实施

1. `ingestKnowledge` 现在按 platform instance 使用单写者队列，Web、Tauri 与后续移动端 adapter 共享同一 ordering invariant，不增加 runtime 或 IPC 依赖。
2. 每个请求在 mutation 前保存现有 versioned `KnowledgeGraphSnapshot` 的深拷贝。operation、relation recompute、owner mirror 或 atomic persistence 失败时恢复 document/atom/evidence、secondary registry、index、identity journal、telemetry 与 `idCounter`。
3. 在边界一次性验证 identity ownership。`upsert` 与 `move` 拒绝 path/URI/alias collision；显式 move ID 必须与 `from*` alias 一致；alias 歧义与 owner mirror 缺失均 fail-closed。
4. G4 mixed-batch fixture 证明第一步成功后若后续 collision，第一步状态不可见，原始 alias 仍可继续执行后续 move。

#### 相对前序方案与移动端权衡

- 本阶段关闭 Phase 25 限制，不改变 public ID、snapshot/projection schema、Bridge 字段或 runtime-first 移动包。LearnGraph 仍是 typed-boundary 参考；textbooks 仍只作为未来 content-package/compiler ingestion 边界。二者都不足以证明应把数据库、Node sidecar、Godot runtime 或模型加入 `mobile-slim`。
- 全量 snapshot rollback 复用现有 replay contract，保持 host adapter 向前兼容；代价是瞬时内存与 JSON clone/restore 延迟随 graph 增长，低内存验收必须实测，调用方应采用有界 batch。
- 单写者队列防止第二个 import 观察到半恢复 graph，但 storage provider 仍必须履行 atomic save contract。

#### 剩余门禁

1. 归档有版本的 old-snapshot、cross-root、move-journal、collision 与 rollback manifest，并在 Web、Tauri、Capacitor 兼容存储及 Android journaled storage 上回放。
2. 使用代表性 batch size 执行签名 arm64 原生 workload、force-stop/reopen continuity、权限/重试路径与真实 `VmRSS <= 256 MiB` 证据。在 artifact 产生前继续冻结 SQLite/WASM、public-ID 切换、Godot inclusion 与预算上调。
3. 只有 replay 与原生证据可复现后才推进 route-registry strict-default 与 complete-use-case extraction；不增加 pass-through wrapper。

#### 验证

- 新增 mixed-batch rollback、显式 source alias 校验与 upsert alias ownership 回归，并保留既有 collision 与四 owner convergence fixture。
- 发布前必须重新执行 TypeScript no-emit、全量 Jest、Rust、mobile-low staging、projection replay 与 Diataxis 检查，并记录当前精确计数。

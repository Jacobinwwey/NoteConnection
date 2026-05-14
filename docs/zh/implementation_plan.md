
# 2026-05-12 v1.7.0 - HEAD 现实对齐实施计划

### 目标

在当前分支已经出现真实 Phase-3 切片、但 Phase-1 / Phase-2 仍存在关键缺口的背景下，把代码真相、活跃进度文档、以及后续执行顺序重新对齐。

### 2026-05-12 到 2026-05-13 本轮实现增量

- 本轮代码已完成：
  - `store.ts` 已新增 embedded SQLite graphdb adapter/provider，`server.ts` 默认 runtime 也已从 `local-file-graphdb` 切到 `graphdb/sqlite`，同时保留显式 file fallback。
  - `KnowledgeLearningPlatform.ts` 已补齐 query-backend comparison/history/trend、staleness diagnostics/rebuild planning、learning-quality history/trend、session-plan quality evaluate/history/trend/runtime-threshold diagnostics、query-backend config、query-backend diagnostics 的真实实现。
  - `queryKnowledge()` 已改为遵循当前配置的 backend，并保留显式 runtime fallback 语义。
  - foundation readiness 与 backend baseline sufficiency 已改为根据真实 store/query/vector 信号判定，而不再是静态占位返回。
  - `server.ts` 现已注入默认激活态本地 `tutorAdapter`，同时保留 `local` + `cloud` adapter catalog。
  - embedded sqlite 生命周期已补齐：server shutdown 会显式关闭 graph store，sqlite adapter 也能在同进程后续运行中安全重开。
  - `src/notemd.server.integration.test.ts` 现已证明 A8 的重启耐久性：覆盖 ingest -> shutdown -> fresh module reload -> store diagnostics/query/readiness 连续性。
  - `local_vector` 的 external HTTP 加速已不再只是查询侧脚手架：适配器现已支持远端索引同步，在 diagnostics 中暴露 sync telemetry，并保留严格的 `fail_closed` 与 representation-alignment 语义。
  - `src/query_backend.external_http.integration.test.ts` 现已证明一条真实的 `external_http` connector 路径：覆盖 ingest -> 远端索引同步 -> query -> diagnostics。
  - runtime capability 治理现在也把 ANN 远端索引同步当成一等检查：matrix/runbook 已新增 `query_vector_acceleration_index_sync_health`，与 health、traceability、prefilter、circuit 同级。
  - `server.ts` 现已把这条新门禁接入完整 runbook 闭环：ANN index-sync health 已进入 verification escalation、remediation action queue、以及 per-check history summary。
  - agent workspace 的 runtime runbook 界面现已在 verify/checks/action-queue 三条链路中展示 ANN sync-health 指标，而且 verify/checks 卡片还进一步前推了 ANN 熔断预算、可追踪性、预筛选摘要，运维侧的 ANN 治理视图已不再停留在 `index_sync_health`。
  - `runtime-capability-runbook/*` 这组 modular knowledge route 现已改为接入真实 server 侧 runbook ops，而不再返回 KLP placeholder payload；route 层现在也会保留 `checkId` / `sinceMinutes` / queue-filter 这类 query 参数，不再静默丢弃。
  - 真实浏览器 smoke 门禁现在也会端到端证明这三条链路：严格浏览器证据必须能看到 ANN sync-health verify 卡、新增的 verify/checks ANN 熔断/可追踪性/预筛选钻取、首个检查的 ANN sync 指标，以及 index-sync action-queue 钻取，而不再只是证明卡片“能打开”。
  - agent-workspace 的 locale 加固现在也覆盖了当前真实暴露出来的诊断卡片/消息空间：源码里引用到的 `agentWorkspace.*` key 已由 `src/agent_workspace.locale.contract.test.ts` 做门禁，双语 locale bundle 现已补齐 strict browser smoke 实际触达的 query/quality/runbook 卡片标签，并且启动期 `translate()` 会等 locale 完成初始化后再调用 `window.i18n.t()`，避免在 locale hydrate 前产生误报式 missing-key warning。
- 这会改变执行重心：
  - P3 的“placeholder 替换”在当前 runtime 面上已经完成实现；
  - P4 的“默认 tutor-routing 激活”在本地优先基线上已经完成实现；
  - A8 剩余缺口已经收窄为 packaged/runtime 证明与更重工作负载级加固；
  - P2 现在已经具备 A9 的真实 live connector baseline，而不再只是纯脚手架；
  - 这个工作之后的下一阶段仍然是发布级 Phase-2 门禁加固，但本轮完成的是“可观测性闭环”而不是“校准闭环”：首个 ANN 门禁族群已经具备 server 侧 runbook/action-queue/history 闭环，并在前端 verify/checks 中显式暴露 index-sync、熔断、可追踪性、预筛选治理摘要；同时并行继续 A8 的 packaged/runtime 闭环和 A9 的工作负载/阈值校准。

### 代码 vs 方案现状矩阵

| 区域 | 方案期望 | 当前 HEAD 现实 | 状态 |
|---|---|---|---|
| Phase-1 A8 graph backend | 生产级本地图后端 | ops 语义已存在，默认 runtime 已切到 embedded `graphdb/sqlite` 并保留显式 file fallback，且重启耐久性已有集成证明；但 packaged/runtime 证明与更重工作负载级加固仍未完成 | Operational baseline |
| Phase-1 A9 ANN connector | 生产级 ANN connector | `external_http` 现已支持远端索引同步，并在严格 failure/representation 语义下通过真实端到端 query 证明；但 recall/latency 校准与更大工作负载验证仍未完成 | Operational baseline |
| Phase-2 quality gates | 真实掌握闭环 / 发散质量门禁 | query-backend comparison、staleness、learning-quality、session-plan-quality 运行面已在 `KnowledgeLearningPlatform.ts` 中接通真实实现；面向运维的 ANN 治理也已通过 runbook verify/checks 显式暴露 index-sync、熔断、可追踪性、预筛选摘要；但整套门禁仍需要建立在当前 graph/ANN operational baseline 之上的发布级校准 | Operational baseline |
| Phase-3 tutor + memory | 导师与记忆操作层真实落地 | tutor telemetry / trace-provider trend / conversation memory / memory-policy diagnostics 已真实，且默认 runtime 已注入本地 tutor adapter；生产级多 provider 路由仍待闭环 | Operational baseline |
| 架构缩减 | 主单体下降到可持续体量 | `server.ts` 14,992、`KnowledgeLearningPlatform.ts` 7,706、`path_app.js` 4,649、`app.js` 4,713、`routes/knowledge.ts` 690 | Open |

### 执行顺序

1. P0：真相校正与门禁重分级
   - 先让进度文档与代码现状一致，
   - 不再把 placeholder 返回或 catalog-only wiring 视为“已完成”。
2. P1：真实 graph backend 闭环
   - 对新的 embedded `graphdb/sqlite` 默认基线补齐 packaged/runtime 级验证，
   - 保留 fallback，
   - 在已证明的重启生命周期之外，继续补齐更重耐久性/性能与 adapter / fallback 一致性验证。
3. P2：基于新 live connector baseline 的 ANN 工作负载与 rollout 闭环
   - 让新的 sync-backed `external_http` connector 在真实流量下持续稳定，
   - 校准 recall / latency 阈值，
   - 扩大工作负载验证后再谈 ANN 层生产闭环。
4. P3：这个工作之后的下一阶段 - Phase-2 quality gate 加固
   - 让新接通的 query/staleness/learning-quality/session-plan-quality 诊断面始终与同一份 runtime 真相对齐，
   - 把当前已前推到 verify/checks 的 ANN index-sync、熔断、可追踪性、预筛选预算从“可见”推进到“可校准”，完成工作负载与阈值闭环，
   - 让 ANN 治理持续覆盖远端 index-sync、health、prefilter、traceability、circuit 这些显式检查面，
   - 只有在 graph/ANN 基线达到发布级而不只是 operational baseline 后，才把它们升级为发布级门禁。
5. P4：Phase-3 tutor routing 加固
   - 保持当前已激活的默认 `tutorAdapter` 可观测，
   - 从 local-first 继续推进到生产级多 provider 路由策略。
6. P5：继续降低架构压力
   - 继续拆 `routes/knowledge.ts`，
   - 持续压缩 `server.ts`、`KnowledgeLearningPlatform.ts`、`path_app.js`、`app.js`。

### 验收标准

1. 默认 graph backend 不再是 `local-file-graphdb`，且 embedded `graphdb/sqlite` 基线已能在 shutdown/restart 后保持 query/store diagnostics 连续性。
2. 至少一条 ANN connector 路径超出脚手架阶段，并在真实 sync/query 流量下得到证明，同时把剩余工作负载/阈值校准显式保留在计划中。
3. `KnowledgeLearningPlatform.ts` 不再对 query compare、staleness、learning-quality、session-plan-quality 返回 placeholder。
4. 默认 runtime tutor 执行在真实 server 路径下能产生非零 adapter telemetry。
5. 每个里程碑后都能通过 `docs:diataxis:check`、`docs:site:build`、`build:with-vite`、严格 `verify:agent-workspace:browser` 证明、以及 targeted agent-workspace / KLP tests。

---

# 2026-03-10 v1.5.38 - 多终端 WASM 等价实施计划（移动端固有瓶颈收口）

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

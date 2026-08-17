# 2026-06-10 v1.7.0 - Knowledge Workspace and DAG Task Sync

## English Document

### Active Task Snapshot

- [x] Current code has been re-audited against the earlier lightweight-RAG, agent-workspace, and mainline architecture plans.
- [x] The reconciliation now has a dedicated source-of-truth note at `docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md`.
- [x] Structured grounded conversation, grouped knowledge points, durable `flashcard_batch` / `knowledge_run` artifacts, workflow-artifact review follow-up, and graph-focus source rendering are all code-backed in the current branch.
- [x] The current DAG-backed learning substrate is confirmed in code: `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, path queries, and prerequisite-driven learning flows already exist.
- [~] The visible answer area still needs contraction so users see the targeted answer first and supporting blocks move to secondary surfaces.
- [~] Left-side knowledge hits are file-first, but still need to converge on a right-pane-first reading model.
- [ ] Add a graph-conditioned context-assembly layer between retrieval and answer synthesis so the current DAG becomes a first-class answer-planning substrate.
- [ ] Continue ownership reduction in `src/server.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, and `src/frontend/workspace_panes.js`.

### Current Acceptance Targets

1. All active tracker docs point to the same 2026-06-10 Knowledge Workspace and DAG alignment note.
2. The documented current state distinguishes implemented code-backed baselines from unfinished product-surface behavior.
3. The current branch is verified, promoted to `main`, pushed, and the worktree is clean afterward.
4. Backward compatibility remains explicit: legacy `assistantMessage` and current public runtime APIs are unchanged.

## 中文文档

### 当前任务快照

- [x] 已重新按源码审计当前代码与此前 lightweight-RAG、agent-workspace 和主线架构方案的对应关系。
- [x] 本轮对账结果已沉淀为独立主线文档：`docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md`。
- [x] 结构化 grounded conversation、按文档聚合的 knowledge point、durable `flashcard_batch` / `knowledge_run` artifact、workflow-artifact review follow-up，以及 graph-focus 原文渲染都已经有代码支撑。
- [x] 当前 DAG 学习底座已在代码中确认存在：`KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、path query 与 prerequisite 驱动的学习流都已落地。
- [~] 用户可见回答区仍需继续收缩为“targeted answer 优先，supporting block 退居次级表面”。
- [~] 左侧 knowledge hit 虽已是 file-first，但仍需继续收敛为 right-pane-first 阅读模型。
- [ ] 需要在 retrieval 与 answer synthesis 之间补一个 graph-conditioned context-assembly layer，让当前 DAG 成为一等 answer-planning substrate。
- [ ] 继续缩减 `src/server.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js` 的所有权压力。

### 当前验收目标

1. 所有活跃看板文档都指向同一份 2026-06-10 知识工作区 / DAG 对齐说明。
2. 文档能明确区分“已经代码落地的基线”和“仍未满足的产品行为”。
3. 当前分支完成验证、推进到 `main`、推送并在结束后保持工作区 clean。
4. 向前兼容性保持明确：legacy `assistantMessage` 与当前公开运行时 API 不发生破坏性变化。

---

# 2026-03-04 v1.5.13 - Tauri Migration Task Consolidation

## English Document

### Priority Task Snapshot

- [x] Bridge-first migration baseline is active (`Tauri + Node sidecar + Godot Path Mode`).
- [x] Runtime path adaptation has been integrated for sidecar and frontend data roots.
- [x] Worker runtime resolution has been stabilized for packaged sidecar scenarios.
- [ ] Existing-cache prompt parity in Tauri load flow needs final strict regression confirmation.
- [ ] Duplicate load execution guard needs final verification across startup/reconnect scenarios.
- [ ] Godot history tracking for center-switch actions needs final acceptance checks.
- [ ] Final Electron decommission readiness checklist remains pending.

### Current Acceptance Targets

1. Exactly one prompt for cache decision when cache exists.
2. Exactly one load/build/restore execution per user-triggered load.
3. Stable websocket lifecycle without startup churn side effects.
4. History panel records central-node switches from Godot interactions.
5. Tauri desktop + Android path documented with Capacitor coexistence strategy.

## 中文文档

### 当前任务快照

- [x] Bridge-first 迁移基线已启用（`Tauri + Node sidecar + Godot Path Mode`）。
- [x] Sidecar 与前端数据根路径的运行时适配已集成。
- [x] 打包 Sidecar 场景下的 Worker 路径解析已稳定。
- [ ] Tauri 加载流程中“缓存已存在提示”一致性仍需最终严格回归确认。
- [ ] 重复加载执行防护仍需在启动/重连场景下完成最终验证。
- [ ] Godot 中心切换动作的 History 记录仍需最终验收。
- [ ] Electron 下线前最终就绪清单仍待完成。

### 当前验收目标

1. 缓存存在时只出现一次选择提示。
2. 每次用户触发加载仅执行一次 load/build/restore。
3. WebSocket 生命周期稳定，无启动抖动副作用。
4. Godot 交互触发的中心节点切换可写入 History 面板。
5. Tauri 桌面与 Android 路径具备文档化说明，并与 Capacitor 共存策略一致。

---

# Task: Refining Path Mode Visualization

- [x] **Critical Bug Fix** <!-- id: 100 -->
  - [x] **Fix Navigation Failure**: Tree View defaulting to linear mode on switch center. Ensure `treeLayout` is generated during `switchCenter`. <!-- id: 101 -->
- [ ] **Data Consistency (Frontend)** <!-- id: 0 -->
  - [x] Ensure `inDegree` is correctly calculated and passed in payload. <!-- id: 1 -->
    - [x] Ensure `inDegree` is correctly calculated and passed in payload. <!-- id: 1 -->
    - [x] **Godot: Implement Lazy Loading Visualization** <!-- id: 2 -->
    - [x] **Backend**: Update [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) to allow unrestricted context expansion for `forcedExpansionSet`. <!-- id: 3 -->
    - [x] **Frontend Bridge**: Update [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) to handle `forcedExpansionNodes` and pass to worker. <!-- id: 4 -->
    - [x] **Simplify Lazy Loading UI (Godot)**
    - [x] Update [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd):
      - [x] Remove separate [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) buttons.
      - [x] Implement unified `[ Count ]` button (circle with number).
      - [x] Button toggles `forcedExpansion` state.
      - [x] Default state is collapsed.
    - [x] Ensure [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) handles the toggle correctly (reusing existing logic).
    - [x] **Godot Renderer**: Update [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) to calculate visible In-Degree and show [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) buttons. <!-- id: 5 -->
    - [x] **Godot Signals**: Wire up [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) signals through `tree_view_panel`, `path_mode_ui` to `ws_client`. <!-- id: 6 -->
      - [ ] (**Godot**) Implement logic to verify `Visible < Global In-Degree` to show [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53). <!-- id: 105 -->
- [x] **Tree View Visual & Interaction Overhaul**
  - [x] **Visual Cleanup (Godot)**
    - [x] Remove [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) and `[Count]` buttons from [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
    - [x] Remove separate click areas for these buttons.
  - [x] **Interaction Update (Godot)**
    - [x] **Double Click**: Change to Toggle Expansion (Emit [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261)).
    - [x] **Right Click**: Toggle Expansion (Same as Dbl Click).
    - [x] **Middle Click**: Collapse All (Emit new signal `collapse_all_requested`).
    - [x] **Long Press**: Implement Navigation (Switch Central).
      - [x] Add `_process` check for hold duration.
      - [x] Draw Progress Ring during hold.
      - [x] Trigger navigation on completion.
  - [x] **Focus Mode (Godot)**
    - [x] Add "Focus on this node" checkbox to [settings_panel.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/settings_panel.tscn).
    - [x] Implement `focus_node_id` state in [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) (visual only for now).
    - [x] Update `_draw` to dim nodes/edges not connected to `focus_node_id` when enabled.
  - [x] **Backend Updates**
    - [x] Add [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) handler in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js).
- [x] **Tree Renderer Update (Godot)** <!-- id: 4 -->
  - [x] **In-Degree Display**: Add visualization for in-degree (e.g., small badge/number). <!-- id: 5 -->
  - [x] **Last Node Button**: Hide expand button for the last node in the chain (target node). <!-- id: 6 -->
  - [x] **Bezier Aesthetics**: <!-- id: 7 -->
    - [x] Implement edge filtering to avoid skip-level connections. <!-- id: 8 -->
- [ ] **Frontend UI Fixes (Electron)** <!-- id: 106 -->
  - [x] **Fix In-Degree Mismatch**: Investigate and correct the data source for In-Degree numbers in the details panel. <!-- id: 107 -->
  - [x] **Fix Resizing Layout**: Ensure Incoming/Outgoing columns resize proportionally with the window. <!-- id: 108 -->
  - [x] **Edge Visibility**: Modify renderer to hide edges by default and only show on hover/click. <!-- id: 109 -->
  - [x] **In-Degree Display Setting**: Add setting to toggle between Visible/Total count (Default: Visible). <!-- id: 110 -->
- [x] **Data Validation**
  - [x] **Disable Path Mode if No Data**: Prevent clicking "Path Mode" button if `graphData` is empty/undefined.
  - [x] **Fix False Negative**: Ensure `graphData` check correctly detects dynamically loaded data in Mini Build mode.
  - [x] **Inline Feedback**: Replace `alert()` with a text message next to the button.
- [x] **Fix Godot Script Errors**
  - [x] **TreeRenderer Parse Error**: Add `class_name TreeRenderer` to [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) or fix syntax error causing parse failure.
- [x] **Fix Tree View Interactions**
  - [x] **Fix Right-Click Toggle**: Ensure right-click (and double-click) correctly toggles between Expand and Collapse based on current state.
  - [x] **Fix Collapse All**:
    - [x] Debug Middle Click binding.
    - [x] Add visible "Collapse All" button to UI.
- [x] **Fix Regression Errors**:
  - [x] Restore `_is_pressed` and `collapse_all_requested` in [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
- [ ] **Verification** <!-- id: 10 -->
  - [x] Verify "Expand" button appears for nodes with hidden parents. <!-- id: 16 -->
  - [x] Verify clicking "Expand" reveals "Fair Value" or similar missing nodes. <!-- id: 17 -->

## v1.4.2 - Spine & Tributaries Layout

- [ ] **Core Algorithm Implementation ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))**
  - [ ] **Data Structure**: Implement `Spine` identification (Main Path).
  - [ ] **Slot Manager**: Create `Y-Axis Allocator` to manage vertical slots per X-column.
  - [ ] **Layout Logic**:
    - [ ] Place Spine nodes at `Y=0`.
    - [ ] Place Tributaries (Prerequisites) laterally using "Preceding Parent" priority.
    - [ ] Ensure `Stationary Expansion` (Expanding a node does not shift the Spine).
- [ ] **Frontend Integration**
  - [ ] Verify `switchCenter` triggers correct layout recalculation.
  - [ ] Test with complex graphs to ensure no overlapping nodes.

---

# 任务：完善路径模式可视化 (Task: Refining Path Mode Visualization)

- [x] **关键 Bug 修复 (Critical Bug Fix)** <!-- id: 100 -->
  - [x] **修复导航失败**: 树状视图在切换中心时默认为线性模式。确保在 `switchCenter` 期间生成 `treeLayout`。 <!-- id: 101 -->
- [ ] **数据一致性 (前端)** <!-- id: 0 -->
  - [x] 确保在有效负载中正确计算并传递 `inDegree`。 <!-- id: 1 -->
    - [x] 确保在有效负载中正确计算并传递 `inDegree`。 <!-- id: 1 -->
    - [x] **Godot: 实现懒加载可视化** <!-- id: 2 -->
    - [x] **后端**: 更新 [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) 以允许 `forcedExpansionSet` 的无限制上下文扩展。 <!-- id: 3 -->
    - [x] **前端桥接**: 更新 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 以处理 `forcedExpansionNodes` 并传递给 Worker。 <!-- id: 4 -->
    - [x] **简化懒加载 UI (Godot)**
    - [x] 更新 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd):
      - [x] 移除单独的 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。
      - [x] 实现统一的 `[ 计数 ]` 按钮（带数字的圆圈）。
      - [x] 按钮切换 `forcedExpansion` 状态。
      - [x] 默认状态为折叠。
    - [x] 确保 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 正确处理切换（重用现有逻辑）。
    - [x] **Godot 渲染器**: 更新 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 以计算可见入度并显示 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。 <!-- id: 5 -->
    - [x] **Godot 信号**: 通过 `tree_view_panel`、`path_mode_ui` 将 [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) 信号连接到 `ws_client`。 <!-- id: 6 -->
      - [ ] (**Godot**) 实现逻辑以验证 `可见 < 全局入度` 以显示 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)。 <!-- id: 105 -->
- [x] **树状视图视觉与交互重修**
  - [x] **视觉清理 (Godot)**
    - [x] 从 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 中移除 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 和 `[Count]` 按钮。
    - [x] 移除这些按钮的单独点击区域。
  - [x] **交互更新 (Godot)**
    - [x] **双击**: 更改为切换扩展（发射 [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261)）。
    - [x] **右键单击**: 切换扩展（与双击相同）。
    - [x] **中键单击**: 全部折叠（发射新信号 `collapse_all_requested`）。
    - [x] **长按**: 实现导航（切换中心）。
      - [x] 添加 `_process` 检查保持持续时间。
      - [x] 在保持期间绘制进度环。
      - [x] 完成时触发导航。
  - [x] **专注模式 (Godot)**
    - [x] 向 [settings_panel.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/settings_panel.tscn) 添加“聚焦于此节点”复选框。
    - [x] 在 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 中实现 `focus_node_id` 状态（目前仅视觉）。
    - [x] 更新 `_draw` 以在启用时调暗未连接到 `focus_node_id` 的节点/边缘。
  - [x] **后端更新**
    - [x] 在 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 中添加 [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) 处理程序。
- [x] **树渲染器更新 (Godot)** <!-- id: 4 -->
  - [x] **入度显示**: 添加入度可视化（例如，小徽章/数字）。 <!-- id: 5 -->
  - [x] **最后一个节点按钮**: 隐藏链中最后一个节点（目标节点）的展开按钮。 <!-- id: 6 -->
  - [x] **贝塞尔美学**: <!-- id: 7 -->
    - [x] 实现边缘过滤以避免跳级连接。 <!-- id: 8 -->
- [ ] **前端 UI 修复 (Electron)** <!-- id: 106 -->
  - [x] **修复入度不匹配**: 调查并更正详细信息面板中入度数字的数据源。 <!-- id: 107 -->
  - [x] **修复布局调整大小**: 确保传入/传出列随窗口按比例调整大小。 <!-- id: 108 -->
  - [x] **边缘可见性**: 修改渲染器以默认隐藏边缘，仅在悬停/点击时显示。 <!-- id: 109 -->
  - [x] **入度显示设置**: 添加设置以在可见/总数之间切换（默认：可见）。 <!-- id: 110 -->
- [x] **数据验证**
  - [x] **这也是如果无数据则禁用路径模式**: 如果 `graphData` 为空/未定义，防止点击“路径模式”按钮。
  - [x] **修复误报**: 确保 `graphData` 检查正确检测 Mini Build 模式下的动态加载数据。
  - [x] **内联反馈**: 用按钮旁边的文本消息替换 `alert()`。
- [x] **修复 Godot 脚本错误**
  - [x] **TreeRenderer 解析错误**: 向 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 添加 `class_name TreeRenderer` 或修复导致解析失败的语法错误。
- [x] **修复树状视图交互**
  - [x] **修复右键切换**: 确保右键单击（和双击）根据当前状态正确在展开和折叠之间切换。
  - [x] **修复全部折叠**:
    - [x] 调试中键绑定。
    - [x] 向 UI 添加可见的“全部折叠”按钮。
- [x] **修复回归错误**:
  - [x] 恢复 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 中的 `_is_pressed` 和 `collapse_all_requested`。
- [ ] **验证** <!-- id: 10 -->
  - [x] 验证“展开”按钮是否出现在具有隐藏父节点的节点上。 <!-- id: 16 -->
  - [x] 验证点击“展开”是否显示“公允价值”或类似的缺失节点。 <!-- id: 17 -->

## v1.4.2 - 主干与支流布局 (Spine & Tributaries Layout)

- [ ] **核心算法实施 ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))**
  - [ ] **数据结构**: 实现 `Spine` 识别（主路径）。
  - [ ] **插槽管理器**: 创建 `Y轴分配器` 以管理每个 X 列的垂直插槽。
  - [ ] **布局逻辑**:
    - [ ] 将主干节点放置在 `Y=0`。
    - [ ] 使用“先前父节点”优先级横向放置支流（前置节点）。
    - [ ] 确保 `静态展开` (展开节点不移动主干)。
- [ ] **前端集成**
  - [ ] 验证 `switchCenter` 触发正确的重新布局计算。
  - [ ] 使用复杂图表测试以确保没有节点重叠。

## v1.4.3 - 9-Rule Tree Layout Engine (2026-02-26)

- [ ] **Core Algorithm: Ownership System ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))**
  - [ ] Step 1: Add `expansionOrder` parameter to `getTreeLayout()`
  - [ ] Step 2: Add `currentOwner`, `ownerPriority`, `_isOnSpine` to layout nodes
  - [ ] Step 3: Implement `tryClaim()` with 9 rules
  - [ ] Step 4: Implement `determineVisibility()` + `isOwnerChainVisible()`
  - [ ] Step 5: Filter edges by ownership (Rule 5)
  - [ ] Step 6: Group hulls by ownership
- [ ] **Frontend Bridge ([path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))**
  - [ ] Step 7: Convert `forcedExpansionNodes` Set → `expansionOrder` Array
  - [ ] Step 8: Add `stickyClaimEnabled` setting
- [ ] **Godot Renderer ([tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))**
  - [ ] Step 9: Edge filtering by `currentOwner`
  - [ ] Step 10: Hull collision avoidance
  - [ ] Step 11: Node type coloring (spine/tributary/shared/migrated)
  - [ ] Step 12: Expansion indicator badge
- [ ] **Worker ([path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))**
  - [ ] Step 13: Pass `expansionOrder` + `stickyClaimEnabled` to `getTreeLayout()`
- [ ] **Verification**
  - [ ] Test Rule 2 (Preceding Immunity)
  - [ ] Test Rule 3 (Following Migration)
  - [ ] Test Rule 6 (Spine Always Visible)
  - [ ] Test Rule 7 (Sticky Claim toggle)
  - [ ] Test hull-node collision avoidance

---

## v1.4.3 - 9 规则树形布局引擎 (2026-02-26)

- [ ] **核心算法：所有权系统 ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))**
  - [ ] 步骤 1: 向 `getTreeLayout()` 添加 `expansionOrder` 参数
  - [ ] 步骤 2: 向布局节点添加 `currentOwner`, `ownerPriority`, `_isOnSpine`
  - [ ] 步骤 3: 实现包含 9 条规则的 `tryClaim()`
  - [ ] 步骤 4: 实现 `determineVisibility()` + `isOwnerChainVisible()`
  - [ ] 步骤 5: 按所有权过滤边（规则 5）
  - [ ] 步骤 6: 按所有权分组 hull
- [ ] **前端桥接 ([path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))**
  - [ ] 步骤 7: 将 `forcedExpansionNodes` Set 转为 `expansionOrder` Array
  - [ ] 步骤 8: 添加 `stickyClaimEnabled` 设置
- [ ] **Godot 渲染器 ([tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))**
  - [ ] 步骤 9: 按 `currentOwner` 过滤边
  - [ ] 步骤 10: Hull 碰撞避让
  - [ ] 步骤 11: 节点类型着色（脊柱/支流/共享/迁移）
  - [ ] 步骤 12: 展开指示器徽章
- [ ] **Worker ([path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))**
  - [ ] 步骤 13: 传递 `expansionOrder` + `stickyClaimEnabled`
- [ ] **验证**
  - [ ] 测试规则 2（前置免疫）
  - [ ] 测试规则 3（后续迁移）
  - [ ] 测试规则 6（脊柱始终可见）
  - [ ] 测试规则 7（粘性认领开关）
  - [ ] 测试 hull-节点碰撞避让
# 2026-08-16 Architecture Hardening and Mobile Compatibility Addendum

## English Document

### Current progress

- [x] Duplicate legacy basename identities now fail before graph construction; `RawFile.relativePath` is recorded with POSIX separators for future stable `sourceUri` migration.
- [x] Sidecar and HTTP authorization now share one strict token decision while preserving `Authorization: Bearer` and `X-NoteConnection-Token`.
- [x] File-backed graph snapshots use unique sibling temp files and refresh the in-process cache only after atomic rename.
- [x] The full code-vs-plan and reference comparison is recorded in `docs/solutions/architecture-hardening-forward-compatibility-2026-08-16.md`.
- [x] `mobile-slim` now provides deterministic slim staging, PNG-first materialization, and callable bounded local exact ingest/query projection without a sidecar.
- [~] Signed APK/AAB extraction and real-device RSS gates remain open; SQLite/WASM persistence is intentionally not claimed by this slice.
- [ ] Complete `sourceUri` migration beyond the shipped additive dual-read foundation, then finish route-registry shadow parity, indexed exact/inferred projections, and Bridge capability negotiation before changing public IDs or default routing.

### Acceptance targets

1. Existing `NoteNode.id`, layouts, route paths, `assistantMessage`, and snapshot schemas remain readable.
2. Mobile-low (4-core ARM64, 5,000 docs / 50,000 atoms) stays within 25 MiB app-owned compressed assets and 256 MiB peak RSS; standard mobile uses 35 MiB / 384 MiB for 20,000 docs / 200,000 atoms.
3. Local mobile analysis works without Node/Godot/model dependencies; remote inference is optional, cancellable, timeout-bounded, and explainably unavailable offline.
4. Every future identity, registry, graph, and Bridge migration has replay/rollback evidence before a default switch.

## 中文文档

### 当前进度

- [x] 重复 legacy basename 会在建图前失败；`RawFile.relativePath` 使用 `/` 记录，为后续稳定 `sourceUri` 迁移提供输入。
- [x] Sidecar 与 HTTP 共用严格 token 判定，同时兼容 `Authorization: Bearer` 与 `X-NoteConnection-Token`。
- [x] 文件图快照使用唯一同目录临时文件，并仅在原子 rename 成功后刷新进程内缓存。
- [x] 完整代码/方案/参考仓库对账已落盘于 `docs/solutions/architecture-hardening-forward-compatibility-2026-08-16.md`。
- [x] `mobile-slim` 现在具备 deterministic slim staging、PNG-first materialization，以及不依赖 sidecar 的可调用有界本地 exact ingest/query projection。
- [~] 签名 APK/AAB 解包与真机 RSS 门禁仍未完成；本切片有意不宣称 SQLite/WASM 持久化。
- [ ] 在改变公开 ID 或默认路由前，完成稳定 `sourceUri` 双读迁移、route-registry shadow parity、indexed exact/inferred projection 与 Bridge capability negotiation。

### 验收目标

1. 既有 `NoteNode.id`、布局、route path、`assistantMessage` 与 snapshot schema 继续可读。
2. mobile-low（4 核 ARM64、5,000 docs / 50,000 atoms）应用自有压缩资产不超过 25 MiB、峰值 RSS 不超过 256 MiB；standard mobile 对应 35 MiB / 384 MiB、20,000 docs / 200,000 atoms。
3. 移动端无需 Node/Godot/模型依赖即可完成本地分析；远端推理仅作为可取消、带 timeout、离线可解释降级的可选能力。
4. 后续 identity、registry、graph、Bridge 迁移必须先有 replay/rollback 证据再切默认。

# 2026-08-17 Stable sourceUri Dual-Read Task Update

## English

### Completed in this increment

- [x] Generate versioned portable `sourceUri`, deterministic `sha256` revision, and legacy/relative aliases at the `FileLoader` boundary.
- [x] Reject NUL/traversal paths and case-folded basename collisions before graph construction.
- [x] Add `NoteNode` identity metadata as optional fields so old graph snapshots remain valid.
- [x] Resolve current IDs, source URIs, relative paths, and legacy aliases through one `Graph` registry; reject alias collisions before mutation.
- [x] Preserve old layouts and add URI/relative-path layout and frontmatter dual-read in `GraphBuilder`.
- [x] Verify with four focused suites (15 tests) and strict TypeScript compilation.

### Explicitly pending

- [ ] Do not switch public `NoteNode.id` until move/rename replay and cross-platform corpus evidence exist.
- [ ] Complete route-registry shadow parity, indexed explicit/inferred projections, Bridge capability negotiation, and signed device RSS/APK gates.

## 中文

### 本次增量已完成

- [x] 在 `FileLoader` 边界生成版本化可移植 `sourceUri`、确定性 `sha256` revision 以及 legacy/relative alias。
- [x] 在建图前拒绝 NUL/路径穿越和大小写折叠后的 basename 冲突。
- [x] 为 `NoteNode` 增加可选身份字段，保持旧 graph snapshot 可读。
- [x] 通过单一 `Graph` registry 解析当前 ID、source URI、relative path 和 legacy alias；写入前拒绝 alias 冲突。
- [x] 保留旧布局，并在 `GraphBuilder` 增加 URI/relative-path 布局与 frontmatter 双读。
- [x] 四个聚焦 suite 共 15 个测试及严格 TypeScript 编译通过。

### 明确待办

- [ ] 在获得文件移动/重命名 replay 和跨平台语料证据前，不切换公开 `NoteNode.id`。
- [ ] 完成 route-registry shadow parity、indexed explicit/inferred projection、Bridge capability negotiation 以及真机签名 RSS/APK 门禁。

# 2026-08-17 Mobile Slim Execution Update

## English

### Implemented in code

- [x] `mobile-slim` now exposes local ingest, local exact query, optional remote inference, SVG suppression, and explicit asset/RSS budgets through `PlatformCapabilities`.
- [x] `mobile_exact_analyzer.js` provides bounded exact lookup, bidirectional neighbor inspection, and directed shortest-path queries without retaining document bodies; `storage_provider.js` exposes `queryKnowledgeBaseExact()` and `findKnowledgePath()`.
- [x] `prepare-mobile-slim.js` stages one deterministic frontend directory and emits a manifest; `verify-mobile-slim-budget.js` rejects forbidden artifacts and compressed payload/RSS overages.
- [x] Capacitor and Tauri Android consume the same staged directory. Tauri Android no longer builds a sidecar by default, and Godot Pathmode is explicit opt-in.

### Evidence boundary

- [x] Focused mobile/platform matrix: 51 tests passed; current staged build measured 119 files, 4,242,970 uncompressed bytes, and 1,543,913 estimated compressed bytes.
- [ ] Real-device RSS evidence and signed APK/AAB extraction evidence remain open. `not-measured` is a deliberate state, not a pass.
- [ ] SQLite persistence, full agent conversation parity, complete `sourceUri` migration beyond additive dual-read, strict route-registry default, and domain extraction remain pending; versioned mobile projection and optional Bridge host adapter execution are delivered, while real cross-host replay remains open.

## 中文

### 已落地代码

- [x] `mobile-slim` 现在通过 `PlatformCapabilities` 暴露本地 ingest、本地 exact query、可选远程推理、SVG 抑制以及明确的资源/RSS 预算。
- [x] `mobile_exact_analyzer.js` 提供有界 exact lookup、双向邻居查询和有向最短路径，不保留文档正文；`storage_provider.js` 暴露 `queryKnowledgeBaseExact()` 与 `findKnowledgePath()`。
- [x] `prepare-mobile-slim.js` 生成唯一 deterministic frontend staging 目录和 manifest；`verify-mobile-slim-budget.js` 会拒绝禁入物及压缩 payload/RSS 超预算。
- [x] Capacitor 与 Tauri Android 消费同一 staging 目录。Tauri Android 默认不再构建 sidecar，Godot Pathmode 改为显式 opt-in。

### 证据边界

- [x] 移动/平台定向矩阵通过 51 个测试；本机 staging 测得 119 个文件、未压缩 4,242,970 字节、估算压缩 1,543,913 字节。
- [ ] 真机 RSS 证据和签名 APK/AAB 解包证据仍未完成。`not-measured` 是诚实的未测状态，不是通过状态。
- [ ] SQLite 持久化、完整 agent conversation parity、strict route-registry 默认切换、indexed explicit/inferred projection 与 domain 抽取仍待后续阶段；Bridge 2.0 transport contract 已交付。

# 2026-08-17 Workspace Identity and Mobile Memory Guardrails

## English

### Implemented in this increment

- [x] `FileLoader.loadFiles()` accepts an explicit workspace root; the target/data sync and `NoteConnection` pass the configured root so full-workspace and subdirectory builds emit the same relative path and `sourceUri`. Legacy callers that omit the root remain compatibility-only and are not migration evidence.
- [x] Learning ingest accepts additive `sourceUri`, `revision`, and `identityAliases`; snapshots retain them and deletes can resolve by URI/alias without changing legacy `documentId` behavior.
- [x] Server and modular data sync propagate identity metadata from the filesystem boundary instead of rebuilding IDs from lossy basename/path normalization.
- [x] Android graph builds reject corpora above 5,000 documents, 16 MiB per document, 64 MiB total input, or 250,000 edges before low-memory projection is persisted; link candidates are extracted at read time so the intermediate projection does not retain document bodies.

### Explicit non-goals and gates

- [x] URI-derived identity remains workspace-scoped, while explicit move/rename journal replay now preserves the legacy ID and historical aliases. Old-snapshot, collision, rollback, and cross-root corpus fixtures are still required before canonical-ID cutover.
- [ ] Android folder picking, signed APK/AAB extraction, and device RSS remain unverified; `not-measured` must remain visible until evidence exists.
- [ ] SQLite persistence, route-registry shadow parity, complete `sourceUri` migration and domain extraction remain separate milestones；版本化 mobile projection 与可选 Bridge host adapter 执行已交付，但真实跨 host replay 仍待完成。

# 2026-08-17 Phase 9 Route Shadow and Mobile Artifact Evidence Update

## English

### Completed in this increment

- [x] Added `NOTE_CONNECTION_ROUTE_DISPATCH_MODE=legacy|registry`; registry remains the default and diagnostics expose the active mode.
- [x] Added `verify:route:shadow`: 14 legacy-equivalent probes compare status, body, headers, and persistence side effects; 6 registry-only probes verify expected legacy misses and registry hits.
- [x] Restored compatibility fields for modular settings/config routes and legacy error contracts for knowledge, Markdown, render, and clipboard boundaries.
- [x] Added `verify-mobile-artifact.js` for APK/AAB central-directory inspection, arm64 payload detection, forbidden runtime detection, profile budgets, and release RSS evidence. `--require-rss --require-arm64` rejects incomplete release evidence.
- [x] Added SQLite close/reopen replay coverage and atomic graph rollback coverage.

### Evidence boundary

- [x] G1 passes locally: `npm run verify:route:shadow` reports `equivalent=14 registryOnly=6`.
- [x] G3 local adapter replay passes; this does not prove Web/Tauri/Capacitor/Android cross-host replay.
- [~] G2 still needs a fresh arm64 APK/AAB and device RSS JSON; static staging size is not an artifact or device-memory measurement.
- [ ] G4 still requires a recorded old-snapshot/collision/rollback/cross-root corpus before any public canonical-ID cutover.

## 中文

### 本次增量已完成

- [x] 增加 `NOTE_CONNECTION_ROUTE_DISPATCH_MODE=legacy|registry`；默认仍为 registry，diagnostics 暴露实际模式。
- [x] 增加 `verify:route:shadow`：14 条 legacy-equivalent probe 对比状态、body、headers 与持久化副作用；6 条 registry-only probe 验证 legacy miss 与 registry hit 预期。
- [x] 为模块化 settings/config 路由恢复兼容字段，并统一 knowledge、Markdown、render、clipboard 边界的旧错误契约。
- [x] 增加 `verify-mobile-artifact.js`，执行 APK/AAB 中央目录检查、arm64 payload 检测、禁入运行时检测、profile 预算和 release RSS 证据校验；`--require-rss --require-arm64` 会拒绝不完整的 release evidence。
- [x] 增加 SQLite close/reopen replay 覆盖和 graph 原子回滚覆盖。

### 证据边界

- [x] G1 已在本机通过：`npm run verify:route:shadow` 输出 `equivalent=14 registryOnly=6`。
- [x] G3 本机 adapter replay 已通过；这不等于 Web/Tauri/Capacitor/Android 跨 host replay 已证明。
- [~] G2 仍需要新鲜 arm64 APK/AAB 与真机 RSS JSON；静态 staging 大小不是真实产物或设备内存测量。
- [ ] G4 仍需记录 old-snapshot/collision/rollback/cross-root corpus，之后才能切换公开 canonical ID。

# 2026-08-17 Phase 8 Replay, Projection, and Bridge Contract Update

## English

- [x] `Graph.fromJSON()` and `Graph.restore()` now validate nodes/edges before atomic replay; legacy snapshots without identity fields remain readable.
- [x] Learning ingest accepts an explicit `move`/`rename` operation, persists a bounded identity journal, preserves old aliases, and keeps the legacy `documentId` stable.
- [x] Modular `/api/knowledge/ingest` now applies a bounded edge normalizer (JSON, document/alias/content limits, legacy field aliases, and move operations) instead of passing arbitrary JSON into the domain.
- [x] Sequential keyword matching uses an inverted anchor index; exact matching semantics remain unchanged while the normal path avoids the previous O(V^2) pair scan.
- [x] Mobile exact projection now carries `sourceUri`/revision/aliases, resolves URI references, uses NFC normalization, and reports explicit/inferred/runtime edge counts without retaining document bodies.
- [x] PathBridge advertises protocol `2.0`, capabilities, request/correlation IDs, analysis request types, and cancellation as additive envelopes; existing clients remain valid.
- [ ] Registry response/status shadow parity, real Android APK/RSS evidence, SQLite persistence, and canonical public-ID cutover remain blocked by evidence gates.

## 中文

- [x] `Graph.fromJSON()` 与 `Graph.restore()` 在原子回放前校验 nodes/edges；不含身份字段的旧快照继续可读。
- [x] learning ingest 支持显式 `move`/`rename` 操作，持久化有界 identity journal，保留旧 alias，并保持旧 `documentId` 不变。
- [x] 模块化 `/api/knowledge/ingest` 现在经过有界边界规范化（JSON、文档/alias/正文上限、旧字段别名与 move），不再把任意 JSON 直接交给 domain。
- [x] 顺序 keyword matching 使用倒排锚点索引；exact 语义不变，正常路径避免原先 O(V^2) 全对扫描。
- [x] mobile exact projection 携带 `sourceUri`/revision/alias，可解析 URI，统一 NFC，并报告 explicit/inferred/runtime 边统计，不保留文档正文。
- [x] PathBridge 以 additive envelope 宣布 protocol `2.0`、capability、request/correlation ID、分析请求类型与取消语义；旧客户端仍可用。
- [ ] registry response/status shadow parity、真机 APK/RSS 证据、SQLite 持久化和 canonical 公共 ID 切换仍受证据门禁约束。

## 中文

### 本次增量已落地

- [x] `FileLoader.loadFiles()` 接受显式 workspace root；全库与子目录构建现在生成一致的 relative path 与 `sourceUri`。
- [x] 学习摄入契约接受 additive `sourceUri`、`revision`、`identityAliases`；快照保留这些字段，删除操作可按 URI/alias 解析，同时不改变旧 `documentId` 行为。
- [x] Server 与 modular data sync 从文件系统边界直接传播身份元数据，不再依赖有损 basename/path 归一化重新推导 ID。
- [x] Android 建图在低内存 projection 持久化前拒绝超过 5,000 文档、单文档 16 MiB、总输入 64 MiB 或 250,000 条边的语料；读取时先提取 link candidate，中间 projection 不保留正文。

### 明确非目标与门禁

- [x] URI 派生身份仍是 workspace-scoped；显式 move/rename journal replay 已保留旧 document ID 与历史 alias。切换 canonical ID 前仍必须完成旧 snapshot、collision、rollback 与跨 root 语料测试。
- [ ] Android 文件夹选择、签名 APK/AAB 解包和真机 RSS 仍未验证；在获得证据前必须保留 `not-measured` 状态。
- [ ] SQLite 持久化、route-registry shadow parity、完整 `sourceUri` 迁移与 domain 抽取仍是独立里程碑；版本化 mobile projection 与可选 Bridge host adapter 执行已交付，真实跨 host replay 仍待完成。

# 2026-08-17 Phase 10 Versioned Projection and Host Execution

## English

### Delivered

- [x] Added `src/frontend/knowledge_projection_contract.js`: schema `1`, body-free nodes, `sourceUri`, `revision`, aliases, edge kind/provenance, bounded evidence references, and bounded adjacency (64 neighbors per direction).
- [x] Capacitor graph writes normalize through the contract before `graph_data.json`/`data.js`; the exact analyzer rejects unknown projection versions and preserves local exact query/path limits.
- [x] Tauri Rust graph output now emits the same versioned projection metadata and identity fields without retaining Android document bodies; Rust runtime tests cover replayable identity fields and adjacency.
- [x] Added `PathBridgeHostAdapter`: host-owned execution for `analyze`, `query`, `readEvidence`, and `exportBundle`; correlation IDs, timeout, disconnect cleanup, `AbortSignal`, and explicit cancel propagation are covered by WebSocket tests. Without an adapter, legacy broadcast behavior remains unchanged.
- [x] Fresh slim staging: 120 files, 4,251,345 uncompressed bytes, 1,545,813 estimated compressed bytes; no Godot, desktop sidecar, model, SVG, or forbidden binary payloads.

### Open evidence gates

- [ ] A signed arm64 APK/AAB extracted from a fresh build and a physical-device RSS JSON under 256 MiB are still required. `not-measured` is not release evidence.
- [x] Android folder selection/import is implemented through an additive Storage Access Framework adapter; device replay evidence is still pending.
- [ ] Cross-host projection replay (Web/Tauri/Capacitor/Android), old-snapshot corpus, move/rename corpus, and canonical public-ID migration remain blocked until identity and persistence evidence is complete.

# 2026-08-18 Phase 11 Projection Store and Android SAF

## English

- [x] Added `knowledge_projection_store.js` with persistent/read-through and memory adapters; mobile exact analysis now reads through the store rather than parsing a host asset directly.
- [x] Added fixture replay for Web/Tauri/Capacitor/Android covering schema, metadata, exact search, neighbors, and directed paths; unknown schemas fail closed.
- [x] Made Tauri projection writes atomic with sibling temp files and rename, including Windows replacement handling.
- [x] Added Android SAF tree selection, persisted URI permission, bounded streaming copy into app-local `Knowledge_Base`, and additive request/poll IPC commands.
- [x] Added identity corpus cases for same-content documents, move/rename aliases, and NFC collisions; public IDs remain compatibility keys.
- [~] G2 is partially evidenced: a fresh arm64 slim build produced an unsigned APK (9,555,787 bytes) and AAB (7,179,228 bytes); artifact verification measured 9,433,678 and 6,978,122 compressed payload bytes, with only `arm64-v8a/libnpm_lib.so` and no Godot/sidecar/model/SVG entries. Signed artifacts, device import/query workload, and RSS JSON remain open. Kotlin compilation now succeeds with the available Android toolchain.
- [~] G3 fixture replay passes, but Android storage replay and SQLite/WASM promotion remain pending.
- [ ] G4 canonical-ID cutover remains blocked by old-snapshot rollback and move-journal restart evidence.

### 2026-08-18 verification follow-up

- [x] `mobile:prepare:slim` now stages 120 files (4,251,345 uncompressed bytes; 1,545,813 estimated compressed bytes) under the 25 MiB asset budget.
- [x] `tauri:android:build` completes for arm64 after clearing stale generated outputs; ZIP inspection and the mobile artifact verifier both pass.
- [ ] Do not promote this to release acceptance until the unsigned artifacts are signed, installed on a representative device, exercised through SAF import plus exact query/path, and accompanied by peak RSS evidence under 256 MiB.

## 中文

- [x] 新增 `knowledge_projection_store.js`，提供 persistent/read-through 与 memory adapter；移动 exact analysis 经 store 读取，不再直接解析 host asset。
- [x] 新增 Web/Tauri/Capacitor/Android fixture replay，覆盖 schema、metadata、exact search、neighbor 与 directed path；未知 schema fail closed。
- [x] Tauri projection 写入改为同目录临时文件 + rename，并处理 Windows 替换语义。
- [x] 增加 Android SAF tree 选择、持久化 URI 权限、有界流式复制到 app-local `Knowledge_Base`，以及 additive request/poll IPC。
- [x] 增加同内容文档、move/rename alias、NFC collision identity corpus；public ID 仍是兼容 key。
- [~] G2 已有部分证据：新鲜未签名 arm64 APK/AAB 已通过 ZIP 检查与 25 MiB payload budget（APK 9,433,678；AAB 6,978,122 压缩字节），仅含 `arm64-v8a/libnpm_lib.so` 且无 Godot/sidecar/model/SVG。签名产物、真机导入/query workload 与 RSS JSON 仍缺失；当前 Android 工具链 Kotlin 编译已通过。
- [~] G3 fixture replay 已通过，但 Android storage replay 与 SQLite/WASM 提升仍待完成。
- [ ] G4 canonical-ID 切换仍被旧 snapshot rollback 与 move-journal 重启证据阻塞。

## 中文

### 本次交付

- [x] 新增 `src/frontend/knowledge_projection_contract.js`：schema `1`、无正文节点、`sourceUri`、`revision`、alias、边 kind/provenance、有界 evidence reference，以及每个方向最多 64 个邻接。
- [x] Capacitor 在写入 `graph_data.json`/`data.js` 前统一归一化；exact analyzer 拒绝未知 projection 版本，并继续执行本地 exact query/path 上限。
- [x] Tauri Rust 图输出改为同一版本化 projection 元数据与身份字段；Android 仍不保留正文，Rust 测试覆盖可 replay 的身份字段和 adjacency。
- [x] 新增 `PathBridgeHostAdapter`：`analyze`、`query`、`readEvidence`、`exportBundle` 由 host 执行；correlation ID、超时、断连清理、`AbortSignal` 与显式 cancel 传播均有 WebSocket 测试。未配置 adapter 时保持旧广播行为。
- [x] 最新 slim staging：120 个文件、未压缩 4,251,345 字节、估算压缩 1,545,813 字节；不含 Godot、桌面 sidecar、模型、SVG 或禁用二进制。

### 尚未闭合的证据门禁

- [ ] 仍需新鲜构建的签名 arm64 APK/AAB 解包结果和低于 256 MiB 的真机 RSS JSON；`not-measured` 不是 release 证据。
- [x] Tauri Android 已实现 Storage Access Framework 文件夹选择/导入：Markdown 在单文档 16 MiB、总输入 64 MiB、5,000 文档和深度 64 限制内流式复制到 app-local `Knowledge_Base`，失败时保留旧知识库。
- [ ] Web/Tauri/Capacitor/Android 跨 host projection replay、旧 snapshot、move/rename 语料与 canonical 公共 ID 迁移，在身份和持久化证据完成前继续冻结。
## 2026-08-18 Phase 13 Native Import Recovery and Cross-Host Closure

### English

- [x] Android SAF import now persists an internal v1 journal, recovers interrupted staging/backup activation on activity startup, and atomically writes result markers.
- [x] Contract suites, TypeScript no-emit, and arm64 Kotlin compilation pass.
- [~] G2 remains static-only: unsigned slim payload passes, but no signing keystore, online device, AVD, or RSS JSON is available.
- [~] G3 has code-level recovery and fixture replay; real Android process death, storage failure, and permission failure evidence remain open.
- [ ] G4 public-ID migration remains frozen until identity/edge parity and old snapshot, move/rename, collision, rollback, and alias-continuity corpora pass.

### 中文

- [x] Android SAF 导入现在持久化内部 v1 journal，在 activity 启动时恢复中断的 staging/backup 激活，并原子写入 result marker。
- [x] 契约测试、TypeScript no-emit 与 arm64 Kotlin 编译已通过。
- [~] G2 仍为静态证据：未签名 slim payload 通过，但当前没有签名 keystore、在线设备、AVD 或 RSS JSON。
- [~] G3 已有代码级恢复与 fixture replay；真实 Android 进程死亡、存储失败与权限失败证据仍未完成。
- [ ] G4 公共 ID 迁移继续冻结，直到 identity/edge parity 与旧 snapshot、move/rename、collision、rollback、alias continuity 语料全部通过。

### Next / 后续

1. Signed arm64 device workload and peak RSS evidence / 签名 arm64 真机 workload 与 peak RSS 证据。
2. Native Tauri/Capacitor/Android adapter replay / 原生 Tauri/Capacitor/Android adapter replay。
3. Android body-free draft proof and transient RSS measurement before any budget increase / 提高预算前证明 Android draft 无正文并测量瞬时 RSS。
## 2026-08-18 Phase 14 Signed Device Evidence Harness

- [x] Add APK/AAB signature verification to the release artifact gate; unsigned output is no longer release evidence.
- [x] Add a fail-closed Tauri Android recorder for signed arm64 install, SAF/import/query/path workload, force-stop/reopen continuity, and `/proc/<pid>/status:VmRSS` capture.
- [x] Keep the workload declarative (`adbArgs`) and record artifact hash, masked device, step results, peak RSS, standalone RSS JSON, and logcat.
- [~] No signing keystore, online device/AVD, or workload execution is available on this host; G2/G3 remain open.
- [ ] Run the harness on low-memory arm64 hardware, then complete native adapter and identity-corpus replay before public-ID or SQLite/WASM promotion.

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

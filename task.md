# Path Mode Architecture & Development Documentation

## Task Overview

Document and expand the Path Mode architecture for the NoteConnection project, enabling hybrid visualization with Godot desktop rendering and web fallback.

---

## Phase 1-3: Complete (Architecture & Basic Godot)

## Phase 1: Research & Context Gathering

- [x] Review existing [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) (Graph, PathEngine classes)
- [x] Review existing [ws_client.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/ws_client.gd) WebSocket client
- [x] Review existing [path_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/path_renderer.gd) renderer
- [x] Review brainstorming and godot-gdscript-patterns skills
- [x] Analyze TODO.md for Path Mode v2 requirements

## Phase 2: Architecture Documentation

- [x] Create comprehensive Path Mode Architecture Document
- [x] Document Hybrid Visualization Architecture
- [x] Document Domain Learning & Diffusion Learning algorithms
- [x] Document Godot 3D/Pseudo-3D visualization requirements
- [x] Document WebSocket protocol specification

## Phase 3: Godot Implementation (Complete)

- [x] Enhance [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) with [getPeripheralNodes()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#424-510) and [OrbitalState](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#556-680)
- [x] Create [bubble_material.gdshader](file:///e:/Knowledge_project/NoteConnection_app/path_mode/shaders/bubble_material.gdshader) (iridescent bubble effect)
- [x] Create [learning_state_machine.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/learning_state_machine.gd) (state machine)
- [x] Create [path_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/path_renderer.gd) (3D orbital renderer)
- [x] Create [main.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/main.tscn) (Godot main scene)
- [x] Update [ws_client.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/ws_client.gd) (new message handlers)
- [x] Fix dark background and floor
- [x] Add collision detection for bubble interactivity

## Phase 3.5: Godot Interactivity Fixes (In Progress)

- [x] Add camera zoom/pan/rotate controls (`orbital_camera.gd`)
- [x] Fix orbital transition animation (central bubble position reset)
- [x] Implement openReader IPC (PathBridge → Electron renderer)
- [x] Enforce node limit (1 Central + Max 4 Peripherals)
- [x] Fix double-click open editor (Threshold + Window Focus)
- [x] Fix Reader content loading (Metadata lookup)
- [x] Improve Camera controls (Left-Drag Orbit + Initial Zoom)
- [x] Fix "Below Base Plate" camera issue (Pitch constraints)
- [x] Fix Central Node Overlap (Strict state reset)
- [x] Fix Color Update on Switch (Force material refresh)
- [x] Refactor Node Switch to "Clear-then-Rebuild" architecture (prevents overlap/color bugs)
- [x] Implement realistic iridescent bubble shader (thin-film interference, Fresnel, specular highlights)
- [x] Connect UI buttons (Mark Complete, Sidebar toggle, completed nodes list)
- [x] Fix ambient lighting (reduced wash-out, iridescent colors visible)
- [x] Fix "X of 0" progress display (send totalNodes from frontend)
- [x] Add navigation history + Return button (single return + dropdown)
- [x] Add Edit mode for unmark completion
- [x] Add bidirectional Electron sync (completionSync WebSocket)
- [x] Add tree-view learning path panel (dependency tree with ★●○ states)
- [x] Add settings button and panel

## Phase 4: Enhanced Graphical Tree View (Planned)

- [x] **Tree View Architecture**
  - [x] Architecture: Refactor `tree_view_panel` to support Pan/Zoom (SubViewport + Camera2D).
  - [x] Rendering: Update `tree_renderer.gd` to use coordinates from backend.
  - [x] Integration: Pass `treeLayout` data from `path_renderer` to `tree_view`.
  - [x] Interaction: Implement Click/Double-click handling in new renderer.gd`

- [x] **Visual Themes** (4 selectable, colorful as default)
  - [x] **Colorful Status** (default): Gold=complete, Cyan=current, Gray=pending
  - [x] **Dark**: Dark background, gradient fills, soft blue/purple curves
  - [x] **Glass/Frosted**: Semi-transparent nodes, glowing bezier curves
  - [x] **Minimal Monochrome**: White/gray nodes, thin gray curves

- [/] **Tree View Modes**
  - [ ] Tab buttons: `[Subtree] [Full Path]` (Future)
  - [x] Dropdown style selector in header
  - [x] Collapsible drawer panel (Existing Sidebar)

- [x] **Node Interactions**
  - [x] Single-click: Expand/collapse + show context menu
  - [x] Double-click: Navigate to node (make central)
  - [x] Context menu: Navigate / Mark Complete / Unmark

- [x] **Bezier Curve Rendering**
  - [x] Draw parent-child connections with bezier curves
  - [x] Curves inherit parent color (colorful mode)
  - [x] Anti-aliased polyline rendering

- [x] **Settings Panel (Phase 3.5 Carryover)**
  - [x] Create `settings_panel.tscn` (PopupPanel)
  - [x] Implement `settings.cfg` persistence (Godot)
  - [x] Settings: "Auto-reconstruct Path" (Toggle), "Tree Theme" (Dropdown)
  - [x] Connect Settings to `OrbitalState` logic

## Phase 4.1: Tree View 2.0 & Settings Refinement

### 4.1.1 Settings & History

- [x] Backend: Implement `retainHistory` flag in `OrbitalState` (path_core.js).
- [x] Backend: Implement `getTreeLayout` (Layered DAG method) in `PathEngine`.
- [x] Godot: Add "Retain Learning History" checkbox to `settings_panel.tscn`.
- [x] Integration: Pipe `retainHistory` setting from UI -> WebSocket -> JS.

### 4.1.2 Tree Data & Layout (Backend)

- [x] **Algorithm**: Implement `getTreeLayout` in `path_core.js` (Layered Graph Layout).
  - [ ] Group nodes by dependency depth (Levels).
  - [ ] Calculate X,Y coordinates to minimize crossing.
  - [ ] Include In-Degree metadata.

### 4.1.3 Tree View 2.0 (Godot)

- [x] **Architecture**: Refactor `tree_view_panel` to support Pan/Zoom.
  - [x] Add `Camera2D` to `SubViewport`.

###- [x] **Tree View Enhancements (v2.1)** <!-- id: 7 --> - [x] **Independent Interactions** <!-- id: 8 --> - [x] Refactor existing global input handling locally to `TreeRenderer`. <!-- id: 9 --> - [x] Implement `_gui_input` in `SubViewportContainer` to capture mouse events. <!-- id: 10 --> - [x] Configure `mouse_filter` to Stop propagation. <!-- id: 11 --> - [x] **Collapsible Nodes** <!-- id: 12 --> - [x] Add `collapsed` state in `OrbitalState` / `PathEngine`. <!-- id: 13 --> - [x] Pass collapse state to `getTreeLayout`. <!-- id: 14 --> - [x] Implement recursive layout logic to hide children of collapsed nodes. <!-- id: 15 --> - [x] Add visual indicator `[+/-]` in `TreeRenderer`. <!-- id: 16 --> - [x] **Mind Map Layout (Horizontal)** <!-- id: 17 --> - [x] Modify `getTreeLayout` to swap X/Y logic (Levels on X, Spread on Y). <!-- id: 18 --> - [x] Sort sibling nodes by In-Degree (Descending). <!-- id: 19 --> - [x] Update `TreeRenderer` to draw Horizontal Bezier curves. <!-- id: 20 -->and Wheel (Zoom).

- [ ] **Rendering**: Update `tree_renderer.gd`.
  - [ ] Use coordinate data from backend.
  - [ ] Draw directional edges (arrows) for dependencies.
  - [ ] Visualize "In-Degree" (maybe node size or label).
- [ ] **Windowing**: Ensure Panel is resizable/detachable (or simulates it).

---

# 路径模式架构与开发文档 (中文版)

## 任务概览

文档化并扩展 NoteConnection 项目的路径模式架构，实现带有 Godot 桌面渲染和 Web 回退机制的混合可视化。

---

## 阶段 1-3: 已完成 (架构与基础 Godot)

## 阶段 1: 研究与背景收集

- [x] 审查现有的 [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) (Graph, PathEngine 类)
- [x] 审查现有的 [ws_client.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/ws_client.gd) WebSocket 客户端
- [x] 审查现有的 [path_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/path_renderer.gd) 渲染器
- [x] 审查头脑风暴和 godot-gdscript-patterns 技能
- [x] 分析 TODO.md 中路径模式 v2 的需求

## 阶段 2: 架构文档

- [x] 创建综合路径模式架构文档
- [x] 文档化混合可视化架构
- [x] 文档化领域学习与扩散学习算法
- [x] 文档化 Godot 3D/伪3D 可视化需求
- [x] 文档化 WebSocket 协议规范

## 阶段 3: Godot 实现 (完成)

- [x] 增强 [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) 包含 [getPeripheralNodes()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#424-510) 和 [OrbitalState](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#556-680)
- [x] 创建 [bubble_material.gdshader](file:///e:/Knowledge_project/NoteConnection_app/path_mode/shaders/bubble_material.gdshader) (彩虹气泡效果)
- [x] 创建 [learning_state_machine.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/learning_state_machine.gd) (状态机)
- [x] 创建 [path_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/path_renderer.gd) (3D 轨道渲染器)
- [x] 创建 [main.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/main.tscn) (Godot 主场景)
- [x] 更新 [ws_client.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/ws_client.gd) (新消息处理器)
- [x] 修复暗色背景和地面
- [x] 添加气泡交互的碰撞检测

## 阶段 3.5: Godot 交互性修复 (进行中)

- [x] 添加相机 缩放/平移/旋转 控制 (`orbital_camera.gd`)
- [x] 修复轨道过渡动画 (中心气泡位置重置)
- [x] 实现 openReader IPC (PathBridge → Electron 渲染器)
- [x] 强制节点限制 (1 中心 + 最多 4 周边)
- [x] 修复双击打开编辑器 (阈值 + 窗口焦点)
- [x] 修复阅读器内容加载 (元数据查找)
- [x] 改进相机控制 (左键拖动轨道 + 初始缩放)
- [x] 修复 "低于底板" 相机问题 (俯仰限制)
- [x] 修复中心节点重叠 (严格状态重置)
- [x] 修复切换时的颜色更新 (强制材质刷新)
- [x] 重构节点切换为 "清除后重建" 架构 (防止重叠/颜色 bug)
- [x] 实现逼真的彩虹气泡 shader (薄膜干涉, 菲涅尔, 高光)
- [x] 连接 UI 按钮 (标记完成, 侧边栏切换, 已完成节点列表)
- [x] 修复环境光照 (减少过曝, 彩虹色可见)
- [x] 修复 "X / 0" 进度显示 (从前端发送 totalNodes)
- [x] 添加导航历史 + 返回按钮 (单次返回 + 下拉菜单)
- [x] 添加编辑模式用于取消标记完成
- [x] 添加双向 Electron 同步 (completionSync WebSocket)
- [x] 添加树形视图学习路径面板 (依赖树，带有 ★●○ 状态)
- [ ] 添加设置按钮和面板

## 阶段 4: 增强型图形树视图 (计划中)

- [x] **树视图架构**
  - [x] 创建 `tree_view_panel.tscn` (SubViewport 覆盖面板)
  - [x] 创建 `tree_renderer.gd` (2D 画布中的贝塞尔曲线绘制)
  - [x] 创建 `tree_styles.gd` (4 种可选视觉主题)
  - [x] 集成 `path_renderer.gd`

- [x] **视觉主题** (4 种可选, 默认为多彩)
  - [x] **多彩状态** (默认): 金色=已完成, 青色=当前, 灰色=待定
  - [x] **深色**: 深色背景, 渐变填充, 柔和蓝/紫曲线
  - [x] **玻璃/磨砂**: 半透明节点, 发光贝塞尔曲线
  - [x] **极简单色**: 白/灰节点, 细灰曲线

- [/] **树视图模式**
  - [ ] 标签按钮: `[子树] [完整路径]` (未来)
  - [x] 头部下拉样式选择器
  - [x] 可折叠抽屉面板 (现有侧边栏)

- [x] **节点交互**
  - [x] 单击: 展开/折叠 + 显示上下文菜单
  - [x] 双击: 导航至节点 (设为中心)
  - [x] 上下文菜单: 导航 / 标记完成 / 取消标记

- [x] **贝塞尔曲线渲染**
  - [x] 用贝塞尔曲线绘制父子连接
  - [x] 曲线继承父级颜色 (多彩模式)
  - [x] 抗锯齿折线渲染

- [x] **设置面板 (阶段 3.5 遗留)**
  - [x] 创建 `settings_panel.tscn` (PopupPanel)
  - [x] 实现 `settings.cfg` 持久化 (Godot)
  - [x] 设置: "自动重构路径" (开关), "树主题" (下拉)
  - [x] 连接设置到 `OrbitalState` 逻辑

## 阶段 4.1: 树视图 2.0 与设置优化

### 4.1.1 设置与历史

- [ ] **后端**: 更新 `OrbitalState` 以支持 `retainHistory` 标志 (条件保存/清除)。
- [ ] **Godot**: 向 `settings_panel.tscn` 添加 "保留学习历史" 复选框。
- [ ] **集成**: 将 `retainHistory` 设置从 UI -> WebSocket -> JS 传输。

### 4.1.2 树数据与布局 (后端)

- [ ] **算法**: 在 `path_core.js` 中实现 `getTreeLayout` (分层图布局)。
  - [ ] 按依赖深度 (Levels) 分组节点。
  - [ ] 计算 X,Y 坐标以最小化交叉。
  - [ ] 包含入度 (In-Degree) 元数据。

### 4.1.3 树视图 2.0 (Godot)

- [ ] **架构**: 重构 `tree_view_panel` 以支持平移/缩放。
  - [ ] `SubViewport` 中加入 `Camera2D`。
  - [ ] 实现鼠标拖动 (平移) 和滚轮 (缩放) 的 `_unhandled_input`。
- [ ] **渲染**: 更新 `tree_renderer.gd`。
  - [ ] 使用来自后端的坐标数据。
  - [ ] 绘制表示依赖关系的定向边 (箭头)。
  - [ ] 可视化 "入度" (可能是节点大小或标签)。
- [ ] **窗口化**: 确保面板可调整大小/可分离 (或模拟此效果)。

- [ ] 配置支持 GPU 的 Godot HTML5 导出
- [ ] 在 Electron 前端创建嵌入容器
- [ ] 在 Electron 内部集成 WebSocket 通信
- [ ] 测试单窗口工作流

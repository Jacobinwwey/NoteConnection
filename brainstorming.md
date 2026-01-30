# Path Mode: Orbital Learning Design (Finalized)

> All design questions answered. Document locked for implementation.

---

## Visual Reference

![Reference Bubble Style](3c4755ca040447b516d3864b2ff9e8b.png)

**Key Visual Properties to Replicate:**

- Soap bubble translucency with internal light scattering
- Rainbow iridescent edge (thin-film interference)
- Dual highlight spots (simulating light sources)
- Soft shadow/ambient environment
- Depth perception through refraction

---

## Confirmed Requirements

| Aspect                      | Final Decision                           |
| --------------------------- | ---------------------------------------- |
| **Display Limit**           | 1 Central + 1-4 Peripheral (max 5 total) |
| **Zero In-Degree Fallback** | Select by highest relevance score        |
| **Completed Nodes UI**      | Collapsible sidebar: `★ × {count}`       |
| **Bubble Style**            | Iridescent soap bubble (reference image) |
| **Layer Separation**        | Peripheral cannot overlap central text   |

---

## Confirmed Design Decisions

### 1. Peripheral Node Selection ✅

**Domain Learning:**

- In-degree nodes (prerequisites) first
- Fill remaining slots with highest-association nodes

**Diffusion Learning:**

- High-association nodes to current central
- Must NOT be out-degree of ultimate target

---

### 2. Central Bubble Content ✅

**Display:** Node title + Progress indicator

```
┌─────────────────────────────────────────────┐
│                                             │
│           [Iridescent Bubble]               │
│                                             │
│              "Chain Rule"                   │
│         3 of 12 prerequisites               │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 3. Peripheral Bubble Labels ✅

**Display:** Title only, max 15 chars + ellipsis

| Original                          | Displayed            |
| --------------------------------- | -------------------- |
| "Derivatives"                     | "Derivatives"        |
| "Fundamental Theorem of Calculus" | "Fundamental The..." |
| "Introduction to Limits"          | "Introduction to..." |

---

### 4. Transition Animation ✅

**Style:** Orbital Rotation (~500ms)

```
Animation Sequence:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Clicked peripheral begins arc toward center
2. Current central shrinks, moves to vacated slot
3. Other peripherals redistribute on orbital ring
4. New central inflates to full size
5. Progress indicator updates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Component Specifications

### Central Bubble

| Property  | Value                                     |
| --------- | ----------------------------------------- |
| Radius    | 80-100px (screen space)                   |
| Opacity   | 90%                                       |
| Effect    | Fresnel rim + rainbow iridescent          |
| Highlight | Dual light spots                          |
| Content   | Title (max 24 chars) + Progress indicator |
| Z-Index   | Foreground layer                          |

### Peripheral Bubble

| Property   | Value                                      |
| ---------- | ------------------------------------------ |
| Radius     | 30-40px (screen space)                     |
| Opacity    | 60%                                        |
| Effect     | Iridescent (less intense than central)     |
| Position   | Orbital ring around central                |
| Label      | Title only (max 15 chars + ellipsis)       |
| Z-Index    | Background layer                           |
| Constraint | Cannot intersect central text bounding box |

### Gold Star Sidebar

```
Expanded:
┌─────────────────────────────────────────────┐
│  [▼] Completed Nodes  ★ × 7                 │
│  ├── Introduction to Calculus               │
│  ├── Limits and Continuity                  │
│  ├── Derivatives Basics                     │
│  └── ... (scrollable list)                  │
└─────────────────────────────────────────────┘

Collapsed:
┌─────────────────────────────────────────────┐
│  [▶] Completed Nodes  ★ × 7                 │
└─────────────────────────────────────────────┘
```

---

## Godot Shader Implementation

```gdscript
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform vec4 base_color : source_color = vec4(0.8, 0.8, 1.0, 0.15);
uniform float fresnel_power : hint_range(1.0, 8.0) = 4.0;
uniform float iridescence_amount : hint_range(0.0, 1.0) = 0.6;
uniform float rim_intensity : hint_range(0.0, 2.0) = 1.2;

vec3 iridescent_color(float angle) {
    return vec3(
        sin(angle * 2.0) * 0.5 + 0.5,
        sin(angle * 2.0 + 2.094) * 0.5 + 0.5,
        sin(angle * 2.0 + 4.189) * 0.5 + 0.5
    );
}

void fragment() {
    float fresnel = pow(1.0 - dot(NORMAL, VIEW), fresnel_power);
    vec3 rainbow = iridescent_color(fresnel * 6.28) * iridescence_amount;

    ALBEDO = base_color.rgb + rainbow * fresnel;
    ALPHA = base_color.a + fresnel * rim_intensity;
    EMISSION = rainbow * fresnel * 0.3;
    ROUGHNESS = 0.1;
    METALLIC = 0.0;
}
```

---

## Decision Log

| Decision             | Choice                        | Alternatives Rejected                 | Rationale                              |
| -------------------- | ----------------------------- | ------------------------------------- | -------------------------------------- |
| Peripheral selection | In-degree first + association | Strict in-degree only, Mixed priority | Balances learning order with discovery |
| Central content      | Title + Progress              | Title only, Title + excerpt           | Progress tracking is core UX           |
| Peripheral labels    | 15 char truncation            | No labels, External labels            | Clean yet informative                  |
| Transition           | Orbital rotation              | Instant, Fade, Pop/Inflate            | Best fits "Orbital Learning" metaphor  |
| Node count           | 1 + 1-4                       | Fixed count                           | Adapts to node connectivity            |

---

## Ready for Implementation

All design decisions confirmed. Next step: Update `implementation_plan.md` with final specifications and begin EXECUTION phase.

---

---

# User Feedback Iteration: Tree View 2.0 & Settings

> **Status**: Brainstorming phase initiated by user feedback.

## 1. Missing Setting: Retain Learning History

- **Requirement**: "Retain Learning History" (default ON).
- **Function**: When enabled, `OrbitalState` in JS should persist `completedIds` to localStorage or file. When disabled, history is cleared on session end (or not saved).
- **Implementation**:
  - Godot: Checkbox in `settings_panel.tscn`.
  - Protocol: `switchCenter` payload includes `retainHistory` flag, OR a global config message `updateSettings`.
  - JS: Update `OrbitalState` to check this flag before saving to `config.js` or `localStorage`.

## 2. Tree View 2.0: Independent Window & Graph Structure

**Problem**:

- Current overlay is fixed, no pan/zoom.
- "Linear" list view doesn't show in-degree/dependencies properly.
- User wants an "Independent Window" feel (or detachable).

**Solution 1: Independent Window (SubViewport w/ Camera2D)**

- **Architecture**:
  - `Window` node (Godot 4.x supports multi-window) OR a maximized `Panel` with its own `SubViewport`.
  - **Pan/Zoom**: `SubViewport` contains a `Camera2D` controlled by mouse drag/scroll.
  - **Input Handling**: `_unhandled_input` inside the viewport logic to move camera.

**Solution 2: True Tree Graph Layout (Reingold-Tilford)**

- **Visualization**: instead of a list, render a proper tree/DAG.
- **Algorithm**:
  - **Levels**: X-axis = Depth/Sequence, Y-axis = Distribution.
  - **In-Degree**: Show multiple parents merging into a child.
  - **Layout**: Since JS `path_core.js` already has graph logic, maybe calculating layout positions in JS is better?
    - _Option A_: JS sends `x,y` coordinates for the tree nodes.
    - _Option B_: Godot receives raw graph and calculates layout (GDScript implementation of simple tree layout).
    - _Decision_: **Option A (JS Layout)** is safer. `d3-hierarchy` or simple JS logic can stream `treeLayout` to Godot.

**Revised Component Structure**:

```
TreeWindow (Window or Resizable Panel)
 └── MarginContainer
      └── SubViewportContainer
           └── SubViewport
                └── Node2D (TreeWorld)
                     ├── Camera2D (Pan/Zoom script)
                     └── TreeRenderer (Draws nodes at x,y)
```

**Interaction Implementation**:

- **Right-Click Drag**: Pan Camera.
- **Scroll**: Zoom Camera.
- **Left-Click Node**: Navigate.
- **Hover**: Show details (in-degree count).

---

## 3. Ambiguity Resolution (Verified)

**Conflict**: `TODO.md` lists "Enhanced Graphical Tree View (v2)" (simple overlay) separately from "Future Path Tree View" (D3 layout).
**User Feedback**: "Dissatisfied with structure... not independent... cannot observe in-degree".
**Resolution**:

- **Merge**: We will combine these into a single **Tree View 2.0** feature.
- **Technology**:
  - **Layout**: D3-dag or custom JS algorithm (in `path_core.js`) to calculate X/Y coordinates for a proper DAG style.
  - **Rendering**: Godot (`tree_renderer.gd`) using `draw_line`/`draw_circle` at those coordinates.
  - **Interaction**: Independent Pan/Zoom via `Camera2D` in `SubViewport`.

## Phase 4.1: Revised Implementation Plan

1.  **Backend (JS)**:
    - **History**: Add `retainHistory` logic to `OrbitalState` (localStorage persistence).
    - **Layout**: Implement `getTreeLayout(centralId)` in `path_core.js`.
      - Use **Sugiyama-style** or **Layered Graph** approach.
      - Calculate levels (depth from start/current).
      - X = Depth \* Spacing, Y = Centered based on siblings.
      - Return: `{ nodes: [{id, x, y, status, inDegree}], edges: [{from, to}] }`.

2.  **Godot - Settings**:
    - Add "Retain History" checkbox to `settings_panel.tscn`.
    - Sync setting to JS via `updateSettings` message.

3.  **Godot - Tree View 2.0**:
    - **Container**: `tree_view_panel.tscn`.
      - Root: `PanelContainer` (resizable/dockable logic if possible, or just Pan/Zoom).
      - Viewport: `SubViewportContainer` > `SubViewport` > `Node2D` (World) > `Camera2D`.
    - **Renderer**: `tree_renderer.gd`.
      - Draw Mode: `_draw()` using backend coordinates.
      - Visuals: Arrows for edges, Size for In-Degree.
    - **Input**:
      - Right-Click Drag: Pan Camera.
      - Wheel: Zoom Camera.
      - Left-Click: Navigate.

> **Status**: In Analysis

## 1. Tree View Challenges & Solutions

**Challenge**: How to efficiently render 50+ nodes with bezier connections in Godot without performance loss?
**Solution**:

- **Rendering**: Use `SubViewport` to isolate 2D rendering from 3D scene.
- **Optimization**: Use `draw_polyline` for curves (fast). Only redraw when path data changes, not every frame.
- **Structure**: `getTreePath` in `path_core.js` is confirmed (returns linear tree).

**Component Hierarchy**:

```
Control (PanelContainer)
 ├── HBox (Header: Tabs + Theme Select)
 └── SubViewportContainer
      └── SubViewport
           └── Node2D (TreeRenderer)
                └── Scripts: _draw() utilizing draw_polyline
```

## 2. Visual Themes (Confirmed)

We need 4 distinct visual flavors to match user preference:

1. **Colorful (Default)**: Matches the 3D bubbles. Gold/Cyan/Gray states.
2. **Dark**: High contrast, suitable for "Pro" feel.
3. **Glass**: Translucent backgrounds, glowing lines (requires `WorldEnvironment` glow).
4. **Minimal**: Clean lines, high legibility, no bloom.

## 3. Settings Panel Integration

**Requirement**: "Settings button and panel" (Phase 3.5 pending).

**Location**: Top-right corner (cog icon), same as `Return` button row.
**Content**:

- **Learning**: "Retain History" (Toggle), "Auto-reconstruct Path" (Toggle).
- **Visual**: "Tree Theme" (Dropdown).
- **Audio**: "Sound Effects" (Future).

**Architecture**:

- Settings stored in `user://settings.cfg` (Godot-side persistence).
- "Auto-reconstruct" logic needs to be passed to `path_core.js` or handled in `OrbitalState`. Since `OrbitalState` is in JS, we should send a `updateConfig` message or handle it client-side.
- _Decision_: Keep `OrbitalState` as the single source of truth for logic. Godot settings UI sends `configure` message to JS.

---

## Next Steps (Proposal)

1. **Implement Tree View**:
   - Create `tree_view_panel.tscn`.
   - Implement `tree_renderer.gd` with 4 themes.
   - Connect `switchCenter` signals.

---

# 路径模式: 轨道学习设计 (已定稿) (中文版)

> 所有设计问题已解答。文档锁定，准备实施。

---

## 视觉参考

![参考气泡样式](3c4755ca040447b516d3864b2ff9e8b.png)

**需要复制的关键视觉属性:**

- 肥皂泡的半透明感与内部光散射
- 彩虹色的虹彩边缘 (薄膜干涉)
- 双高光点 (模拟光源)
- 柔和的阴影/环境光
- 通过折射产生的深度感知

---

## 确认的需求

| 方面              | 最终决定                      |
| :---------------- | :---------------------------- |
| **显示限制**      | 1 中心 + 1-4 周边 (最多 5 个) |
| **零入度回退**    | 按最高相关性分数选择          |
| **已完成节点 UI** | 可折叠侧边栏: `★ × {计数}`    |
| **气泡样式**      | 彩虹肥皂泡 (参考图片)         |
| **层级分离**      | 周边节点不能遮挡中心文本      |

---

## 确认的设计决策

### 1. 周边节点选择 ✅

**领域学习:**

- 入度节点 (先决条件) 优先
- 用最高关联度的节点填充剩余槽位

**扩散学习:**

- 与当前中心高关联的节点
- 绝不能是最终目标的出度节点

---

### 2. 中心气泡内容 ✅

**显示:** 节点标题 + 进度指示

```
┌─────────────────────────────────────────────┐
│                                             │
│           [彩虹气泡]                        │
│                                             │
│              "链式法则"                      │
│         3 / 12 先决条件                     │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 3. 周边气泡标签 ✅

**显示:** 仅标题，最多 15 字符 + 省略号

| 原始                              | 显示为               |
| :-------------------------------- | :------------------- |
| "Derivatives"                     | "Derivatives"        |
| "Fundamental Theorem of Calculus" | "Fundamental The..." |
| "Introduction to Limits"          | "Introduction to..." |

---

### 4. 过渡动画 ✅

**样式:** 轨道旋转 (~500ms)

```
动画序列:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 被点击的周边节点开始向中心沿弧线运动
2. 当前中心缩小，移动到腾出的槽位
3. 其他周边节点在轨道环上重新分布
4. 新中心膨胀至全尺寸
5. 进度指示器更新
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 组件规范

### 中心气泡

| 属性     | 值                             |
| :------- | :----------------------------- |
| 半径     | 80-100px (屏幕空间)            |
| 不透明度 | 90%                            |
| 效果     | 菲涅尔边缘 + 彩虹虹彩          |
| 高光     | 双光源点                       |
| 内容     | 标题 (最多 24 字符) + 进度指示 |
| Z-Index  | 前景层                         |

### 周边气泡

| 属性     | 值                             |
| :------- | :----------------------------- |
| 半径     | 30-40px (屏幕空间)             |
| 不透明度 | 60%                            |
| 效果     | 虹彩 (比中心弱)                |
| 位置     | 环绕中心的轨道环               |
| 标签     | 仅标题 (最多 15 字符 + 省略号) |
| Z-Index  | 背景层                         |
| 约束     | 不能与中心文本边界框相交       |

### 金星侧边栏

```
展开:
┌─────────────────────────────────────────────┐
│  [▼] 已完成节点  ★ × 7                      │
│  ├── 微积分导论                             │
│  ├── 极限与连续性                           │
│  ├── 导数基础                               │
│  └── ... (可滚动列表)                       │
└─────────────────────────────────────────────┘

折叠:
┌─────────────────────────────────────────────┐
│  [▶] 已完成节点  ★ × 7                      │
└─────────────────────────────────────────────┘
```

---

## Godot Shader 实现

```gdscript
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform vec4 base_color : source_color = vec4(0.8, 0.8, 1.0, 0.15);
uniform float fresnel_power : hint_range(1.0, 8.0) = 4.0;
uniform float iridescence_amount : hint_range(0.0, 1.0) = 0.6;
uniform float rim_intensity : hint_range(0.0, 2.0) = 1.2;

vec3 iridescent_color(float angle) {
    return vec3(
        sin(angle * 2.0) * 0.5 + 0.5,
        sin(angle * 2.0 + 2.094) * 0.5 + 0.5,
        sin(angle * 2.0 + 4.189) * 0.5 + 0.5
    );
}

void fragment() {
    float fresnel = pow(1.0 - dot(NORMAL, VIEW), fresnel_power);
    vec3 rainbow = iridescent_color(fresnel * 6.28) * iridescence_amount;

    ALBEDO = base_color.rgb + rainbow * fresnel;
    ALPHA = base_color.a + fresnel * rim_intensity;
    EMISSION = rainbow * fresnel * 0.3;
    ROUGHNESS = 0.1;
    METALLIC = 0.0;
}
```

---

## 决策日志

| 决策     | 选择              | 拒绝的替代方案            | 理由                   |
| :------- | :---------------- | :------------------------ | :--------------------- |
| 周边选择 | 入度优先 + 关联度 | 仅严格入度, 混合优先级    | 平衡学习顺序与发现     |
| 中心内容 | 标题 + 进度       | 仅标题, 标题 + 摘录       | 进度追踪是核心 UX      |
| 周边标签 | 15 字符截断       | 无标签, 外部标签          | 简洁而信息丰富         |
| 过渡     | 轨道旋转          | 瞬间, 淡入淡出, 弹出/膨胀 | 最符合 "轨道学习" 隐喻 |
| 节点数量 | 1 + 1-4           | 固定数量                  | 适应节点连接性         |

---

## 准备实施

所有设计决策已确认。下一步：用最终规范更新 `implementation_plan.md` 并开始执行阶段。

---

---

# 用户反馈迭代: 树视图 2.0 与设置

> **状态**: 由用户反馈启动的头脑风暴阶段。

## 1. 缺失设置: 保留学习历史

- **需求**: "保留学习历史" (默认开启)。
- **功能**:启用时，JS 中的 `OrbitalState` 应将 `completedIds` 持久化到 localStorage 或文件。禁用时，会话结束时清除历史 (或不保存)。
- **实现**:
  - Godot: `settings_panel.tscn` 中的复选框。
  - 协议: `switchCenter` 载荷包含 `retainHistory` 标志，或全局配置消息 `updateSettings`。
  - JS: 更新 `OrbitalState` 以在保存到 `config.js` 或 `localStorage` 前检查此标志。

## 2. 树视图 2.0: 独立窗口与图结构

**问题**:

- 当前覆盖层是固定的，无法平移/缩放。
- "线性" 列表视图无法正确显示入度/依赖关系。
- 用户想要 "独立窗口" 的感觉 (或可分离)。

**解决方案 1: 独立窗口 (带 Camera2D 的 SubViewport)**

- **架构**:
  - `Window` 节点 (Godot 4.x 支持多窗口) 或带有自己 `SubViewport` 的最大化 `Panel`。
  - **平移/缩放**: `SubViewport` 包含由鼠标拖动/滚动控制的 `Camera2D`。
  - **输入处理**: 视口逻辑内部的 `_unhandled_input` 用于移动相机。

**解决方案 2: 真实树形图布局 (Reingold-Tilford)**

- **可视化**: 渲染真正的树/DAG 而非列表。
- **算法**:
  - **层级**: X轴 = 深度/序列, Y轴 = 分布。
  - **入度**: 显示多个父节点合并到一个子节点。
  - **布局**: 既然 JS `path_core.js` 已有图逻辑，也许在 JS 中计算布局位置更好？
    - _选项 A_: JS 发送树节点的 `x,y` 坐标。
    - _选项 B_: Godot 接收原始图并计算布局 (简单树布局的 GDScript 实现)。
    - _决策_: **选项 A (JS 布局)** 更安全。`d3-hierarchy` 或简单 JS 逻辑可以将 `treeLayout` 流式传输到 Godot。

**修订后的组件结构**:

```
TreeWindow (Window or Resizable Panel)
 └── MarginContainer
      └── SubViewportContainer
           └── SubViewport
                └── Node2D (TreeWorld)
                     ├── Camera2D (平移/缩放脚本)
                     └── TreeRenderer (在 x,y 处绘制节点)
```

**交互实现**:

- **右键拖动**: 平移相机。
- **滚动**: 缩放相机。
- **左键点击**: 导航。
- **悬停**: 显示详情 (入度计数)。

---

## 3. 歧义消除 (已验证)

**冲突**: `TODO.md` 列出 "增强型图形树视图 (v2)" (简单覆盖) 与 "未来路径树视图" (D3 布局) 分开。
**用户反馈**: "对结构不满意... 不独立... 无法观察入度"。
**解决方案**:

- **合并**: 我们将这些合并为一个单一的 **树视图 2.0** 特性。
- **技术**:
  - **布局**: D3-dag 或自定义 JS 算法 (在 `path_core.js` 中) 计算正确 DAG 风格的 X/Y 坐标。
  - **渲染**: Godot (`tree_renderer.gd`) 使用这些坐标进行 `draw_line`/`draw_circle`。
  - **交互**: 通过 `SubViewport` 中的 `Camera2D` 实现独立平移/缩放。

## 阶段 4.1: 修订后的实施计划

1.  **后端 (JS)**:
    - **历史**: 向 `OrbitalState` 添加 `retainHistory` 逻辑 (localStorage 持久化)。
    - **布局**: 在 `path_core.js` 中实现 `getTreeLayout(centralId)`。
      - 使用 **Sugiyama 风格** 或 **分层图** 方法。
      - 计算层级 (距起点/当前的深度)。
      - X = 深度 \* 间距, Y = 基于兄弟节点居中。
      - 返回: `{ nodes: [{id, x, y, status, inDegree}], edges: [{from, to}] }`。

2.  **Godot - 设置**:
    - 向 `settings_panel.tscn` 添加 "保留历史" 复选框。
    - 通过 `updateSettings` 消息同步设置到 JS。

3.  **Godot - 树视图 2.0**:
    - **容器**: `tree_view_panel.tscn`。
      - 根: `PanelContainer` (如可能则为可调整大小/可停靠逻辑，或仅平移/缩放)。
      - 视口: `SubViewportContainer` > `SubViewport` > `Node2D` (世界) > `Camera2D`。
    - **渲染器**: `tree_renderer.gd`。
      - 绘制模式: 使用后端坐标的 `_draw()`。
      - 视觉: 边的箭头, 入度的大小。
    - **输入**:
      - 右键拖动: 平移相机。
      - 滚轮: 缩放相机。
      - 左键点击: 导航。

> **状态**: 分析中

## 1. 树视图挑战与解决方案

**挑战**: 如何在 Godot 中高效渲染 50+ 个带贝塞尔连接的节点而不损失性能？
**解决方案**:

- **渲染**: 使用 `SubViewport` 将 2D 渲染与 3D 场景隔离。
- **优化**: 使用 `draw_polyline` 绘制曲线 (快速)。仅在路径数据变化时重绘，而非每帧。
- **结构**: `path_core.js` 中的 `getTreePath` 已确认 (返回线性树)。

**组件层级**:

```
Control (PanelContainer)
 ├── HBox (Header: Tabs + Theme Select)
 └── SubViewportContainer
      └── SubViewport
           └── Node2D (TreeRenderer)
                └── Scripts: _draw() utilizing draw_polyline
```

## 2. 视觉主题 (已确认)

我们需要 4 种独特的视觉风格以匹配用户偏好:

1. **多彩 (默认)**: 匹配 3D 气泡。金/青/灰状态。
2. **深色**: 高对比度，适合 "专业" 感觉。
3. **玻璃**: 半透明背景，发光线条 (需要 `WorldEnvironment` 辉光)。
4. **极简**: 线条干净，高易读性，无辉光。

## 3. 设置面板集成

**需求**: "设置按钮和面板" (阶段 3.5 待定)。

**位置**: 右上角 (齿轮图标), 与 `Return` 按钮同行。
**内容**:

- **学习**: "保留历史" (开关), "自动重构路径" (开关)。
- **视觉**: "树主题" (下拉)。
- **音频**: "音效" (未来)。

**架构**:

- 设置存储在 `user://settings.cfg` (Godot 端持久化)。
- "自动重构" 逻辑需要传递给 `path_core.js` 或在 `OrbitalState` 中处理。由于 `OrbitalState` 在 JS 中，我们应该发送 `updateConfig` 消息或在客户端处理。
- _决策_: 保持 `OrbitalState` 为逻辑的单一事实来源。Godot 设置 UI 发送 `configure` 消息给 JS。

---

## 下一步 (建议)

1. **实现树视图**:
   - 创建 `tree_view_panel.tscn`。
   - 实现带 4 种主题的 `tree_renderer.gd`。
   - 连接 `switchCenter` 信号。
2. **实现设置**:
   - 简单弹窗对话框。
   - 持久化主题选择。

## 6. Tree View 2.0: Adaptive Shortest Path & Mind Map (2026-01-30 v1.3.1)

### English Version

#### Concept: "The Path of Least Resistance"

To reduce cognitive load, the Tree View in Diffusion Mode (Target-Based) should not overwhelm the user with the entire dependency graph. Instead, it should intelligently calculate and display the **Adaptive Shortest Path** to the target, considering what the user has already learned.

#### Core Logic

1.  **Backward Traversal**: Trace all ancestors (prerequisites) of the Target Node.
2.  **Filter Completed**: Remove nodes that are already marked as "Completed" in the user's history.
3.  **Identify Frontier**: From the remaining unlearned ancestors, identify "Frontier Nodes" - those whose prerequisites are ALL completed (or have none). These are the valid "Next Steps".
4.  **Shortest Path Calculation**: Find the shortest path (fewest hops) from any Frontier Node to the Target Node within the unlearned subgraph.
5.  **Auto-Reconstruct**:
    - When a node is marked "Complete", the system re-runs this logic.
    - The path dynamically updates, potentially shifting to a new branch if the current one is finished, or advancing the frontier.

#### Visualization Strategy

- **Default View (Collapsed)**:
  - Show _only_ the calculated Shortest Path (Trunk).
  - Nodes appear as a linear or simple branching sequence.
  - This provides a clear, linear "To-Do List" towards the goal.
- **Expanded View (Discovery)**:
  - Nodes with hidden/collapsed unlearned prerequisites show a `+` indicator.
  - User can click `+` to reveal these "Side Quests" (alternative necessary branches).
  - "Expand All" button to view the full dependency tree for deep planning.

#### Technical Implementation

- **Backend (`path_core.js`)**:
  - New `diffusionLearning` logic to implement the "Frontier -> Target" shortest path search.
  - `getTreeLayout` returns the simplified trunk by default, with flags for `hasHiddenPrereqs`.
- **Frontend**:
  - Listen for `completionSync` and trigger path re-calculation if `Auto-Reconstruct` is enabled.
- **Godot**:
  - Render the simplified tree.
  - Handle `+` button clicks to request expanded data (or client-side expansion if data is sent but hidden).

#### Benefits

- **Minimal Cognitive Load**: Users see exactly what to do next, not a massive graph.
- **Goal-Oriented**: Every step typically moves closer to the target.
- **Adaptive**: The path evolves as the user learns, correcting itself if the user jumps around.

### Chinese Version

#### 概念：“最小阻力路径” (The Path of Least Resistance)

为了减少认知负担，扩散模式（基于目标）下的树形视图不应向用户展示整个依赖图谱。相反，它应根据用户已学习的内容，智能计算并显示通往目标的**自适应极简路径 (Adaptive Shortest Path)**。

#### 核心逻辑 (Core Logic)

1.  **反向遍历 (Backward Traversal)**: 追踪目标节点的所有祖先（先决条件）。
2.  **过滤已完成 (Filter Completed)**: 移除用户历史记录中已标记为“完成”的节点。
3.  **识别前沿 (Identify Frontier)**: 从剩余的未学习祖先中，识别“前沿节点”——即其先决条件已全部完成（或没有先决条件）的节点。这些是有效的“下一步”。
4.  **最短路径计算 (Shortest Path Calculation)**: 在未学习的子图中，寻找从任何前沿节点到目标节点的最短路径（跳数最少）。
5.  **自动重构 (Auto-Reconstruct)**:
    - 当一个节点被标记为“完成”时，系统重新运行此逻辑。
    - 路径动态更新，如果当前分支已完成，可能会转移到一个新分支，或者推进前沿。

#### 可视化策略 (Visualization Strategy)

- **默认视图（折叠状态）**:
  - 仅显示计算出的最短路径（主干）。
  - 节点显示为线性或简单的分支序列。
  - 这提供了一个清晰、线性的通往目标的“待办事项列表”。
- **展开视图（探索状态）**:
  - 具有隐藏/折叠的未学习先决条件的节点显示 `+` 指示器。
  - 用户可以点击 `+` 揭示这些“支线任务”（其他必要的先决分支）。
  - “全部展开”按钮可查看完整的依赖树以进行深度规划。

#### 技术实现 (Technical Implementation)

- **后端 (`path_core.js`)**:
  - 新的 `diffusionLearning` 逻辑，实现“前沿 -> 目标”的最短路径搜索。
  - `getTreeLayout` 默认返回简化的主干，并带有 `hasHiddenPrereqs` 标志。
- **前端**:
  - 监听 `completionSync`，如果启用了 `Auto-Reconstruct`，则触发路径重新计算。
- **Godot**:
  - 渲染简化的树。
  - 处理 `+` 按钮点击以请求展开数据（或者如果数据已发送但隐藏，则进行客户端展开）。

#### 收益 (Benefits)

- **极简认知负担**: 用户确切知道下一步该做什么，而不是面对庞大的图表。
- **目标导向**: 每一步通常都离目标更近。
- **自适应**: 路径随用户学习而演变，如果用户跳跃学习，路径会自动修正。

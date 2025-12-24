# 2025-12-24 v0.9.17 - English Document

## Test Report: SVG Visual Completeness

### 1. Colored Arrow Markers
*   **Test**: In SVG Mode, click on a node with both incoming and outgoing edges.
*   **Result**: 
    *   Incoming edges are Red with **Red arrowheads**.
    *   Outgoing edges are Blue with **Blue arrowheads**.
    *   Previously, arrowheads remained gray.
*   **Test**: Click the background to clear highlight.
*   **Result**: All edges (if visible) revert to Gray lines with **Gray arrowheads**.
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.17 - Chinese Document

## 测试报告：SVG 视觉完整性

### 1. 彩色箭头标记
*   **测试**: 在 SVG 模式下，点击一个同时具有入度和出度边的节点。
*   **结果**: 
    *   入度边为红色，且带有**红色箭头**。
    *   出度边为蓝色，且带有**蓝色箭头**。
    *   （此前箭头保持灰色）。
*   **测试**: 点击背景清除高亮。
*   **结果**: 所有边（如果可见）恢复为灰色线条和**灰色箭头**。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.16 - English Document

## Test Report: Interaction Completeness

### 1. Highlight Logic Override
*   **Test**: Set filter mode to "Incoming Only". Single click a node that has both incoming and outgoing edges.
*   **Result**: The graph highlights **both** incoming (Red) and outgoing (Blue) edges, overriding the filter for the inspected node.
*   **Status**: **Pass**

### 2. Canvas Renderer Styling
*   **Test**: Switch to Canvas Mode. Click a node.
*   **Result**: Highlighted edges are drawn with increased thickness (2.5px), matching the visual weight of the SVG renderer.
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.16 - Chinese Document

## 测试报告：交互完整性

### 1. 高亮逻辑覆盖
*   **测试**: 将过滤器模式设置为 "仅入度" (Incoming Only)。单击一个同时具有入度和出度边的节点。
*   **结果**: 图表高亮显示**所有**入度 (红) 和出度 (蓝) 边，覆盖了被检查节点的过滤器设置。
*   **状态**: **通过**

### 2. Canvas 渲染器样式
*   **测试**: 切换到 Canvas 模式。点击一个节点。
*   **结果**: 高亮边的绘制宽度增加 (2.5px)，与 SVG 渲染器的视觉权重相匹配。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.14 - English Document

## Test Report: Visual & Data Fixes

### 1. Edge Highlighting (SVG & Canvas)
*   **Test**: Single click a node in the graph (SVG Mode).
*   **Result**: 
    *   Incoming edges are colored **Red** (#ff6b6b) and bolded (2px).
    *   Outgoing edges are colored **Blue** (#4488ff) and bolded (2px).
*   **Test**: Switch to Canvas Mode and repeat.
*   **Result**: Visuals are identical to SVG mode.
*   **Status**: **Pass**

### 2. Data Deduplication
*   **Test**: Click a node with multiple connections to the same neighbor (if any exist in data). Check popup lists.
*   **Result**: Neighbor nodes appear only once in the "Incoming" and "Outgoing" lists.
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.14 - Chinese Document

## 测试报告：视觉与数据修复

### 1. 边高亮 (SVG & Canvas)
*   **测试**: 在图表中单击一个节点 (SVG 模式)。
*   **结果**: 
    *   入度边显示为**红色** (#ff6b6b) 并加粗 (2px)。
    *   出度边显示为**蓝色** (#4488ff) 并加粗 (2px)。
*   **测试**: 切换到 Canvas 模式并重复。
*   **结果**: 视觉效果与 SVG 模式一致。
*   **状态**: **通过**

### 2. 数据去重
*   **测试**: 点击一个与同一邻居有多个连接的节点（如果数据中存在）。检查弹窗列表。
*   **结果**: 邻居节点在“入度”和“出度”列表中仅出现一次。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.13 - English Document

## Test Report: Focus Mode Isolation

### 1. Focus Mode Interaction
*   **Test**: Enter Focus Mode (Double Click). Single click another node.
*   **Result**: Floating statistics popup does NOT appear. Layout does NOT freeze (unless globally frozen). Node is NOT highlighted with Red/Blue edges (Focus Mode context preserved).
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.13 - Chinese Document

## 测试报告：专注模式隔离

### 1. 专注模式交互
*   **测试**: 进入专注模式 (双击)。单击另一个节点。
*   **结果**: 浮动统计弹窗**未**出现。布局**未**冻结 (除非全局已冻结)。节点**未**被红/蓝边高亮 (保留了专注模式上下文)。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.11 - English Document

## Test Report: Node Statistics & Localization

### 1. Focus Mode Localization
*   **Test**: Switch language to Chinese ('zh') and enter Focus Mode.
*   **Result**: Semantic labels appear as "帮助理解" and "进一步探索".
*   **Test**: Switch language to English ('en') and enter Focus Mode.
*   **Result**: Semantic labels appear as "Helping to understand" and "Further exploration".
*   **Status**: **Pass**

### 2. Node Statistics Panel
*   **Test**: Single click on a node.
*   **Result**: 
    *   Analysis Panel opens (or switches content) to show "Node Details".
    *   Node Name and Cluster are displayed correctly.
    *   Inbound/Outbound lists are populated.
    *   In-degree edges turn Red.
    *   Out-degree edges turn Blue (#4488ff).
*   **Test**: Click a node in the Inbound/Outbound list.
*   **Result**: The graph highlights the new node, and the panel updates to show details for the new node.
*   **Test**: Click "Back" button in the panel.
*   **Result**: Panel reverts to "Degree Analysis" (Global View).
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.11 - Chinese Document

## 测试报告：节点统计与本地化

### 1. 专注模式本地化
*   **测试**: 切换语言至中文 ('zh') 并进入专注模式。
*   **结果**: 语义标签显示为 "帮助理解" 和 "进一步探索"。
*   **测试**: 切换语言至英文 ('en') 并进入专注模式。
*   **结果**: 语义标签显示为 "Helping to understand" 和 "Further exploration"。
*   **状态**: **通过**

### 2. 节点统计面板
*   **测试**: 单击某个节点。
*   **结果**: 
    *   分析面板打开（或切换内容）以显示“节点详情”。
    *   正确显示节点名称和聚类。
    *   入度/出度列表已填充。
    *   入度边变为红色。
    *   出度边变为蓝色 (#4488ff)。
*   **测试**: 点击入度/出度列表中的节点。
*   **结果**: 图表高亮显示新节点，面板更新为显示新节点的详情。
*   **测试**: 点击面板中的“返回”按钮。
*   **结果**: 面板恢复为“度数分析”（全局视图）。
*   **状态**: **通过**

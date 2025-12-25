# 2025-12-26 v0.9.26 - English Document

## Test Report: UX Enhancements & Quick Start

### 1. Freeze Layout Quick Button
*   **Test**: Click the snowflake (❄️) button in the top-right corner.
*   **Result**: 
    *   Button background turns Red.
    *   "Freeze Layout" checkbox in the Simulation panel becomes checked.
    *   Simulation stops and node dragging is disabled (per v0.9.25 logic).
*   **Test**: Click the button again.
*   **Result**: 
    *   Button background reverts to dark gray.
    *   Checkbox becomes unchecked.
    *   Simulation resumes.
*   **Test**: Manually check/uncheck the checkbox in the panel.
*   **Result**: The quick button visual state updates to match the checkbox.
*   **Status**: **Pass**

### 2. Quick Start Manual (Onboarding)
*   **Test**: Clear `localStorage.removeItem('noteconnection_manual_seen')` and reload.
*   **Result**: The "Quick Start Guide" modal appears automatically after a short delay.
*   **Test**: Click "Don't show again" and close the modal. Reload the page.
*   **Result**: The modal does NOT appear automatically.
*   **Status**: **Pass**

### 3. Help Button Access
*   **Test**: Click the "Help" (❓) button.
*   **Result**: The Quick Start Guide modal opens immediately.
*   **Status**: **Pass**

### 4. Localization
*   **Test**: Switch language to Chinese.
*   **Result**: 
    *   Quick Button tooltip/label (if visible) shows Chinese.
    *   Manual title becomes "快速开始指南".
    *   All manual steps and descriptions are in Chinese.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.26 - Chinese Document

## 测试报告：UX 增强与快速开始

### 1. 冻结布局快速按钮
*   **测试**: 点击右上角的雪花 (❄️) 按钮。
*   **结果**: 
    *   按钮背景变红。
    *   模拟面板中的“冻结布局”复选框被选中。
    *   模拟停止且节点拖动被禁用（根据 v0.9.25 逻辑）。
*   **测试**: 再次点击该按钮。
*   **结果**: 
    *   按钮背景恢复为深灰色。
    *   复选框变为未选中。
    *   模拟恢复。
*   **测试**: 手动选中/取消选中面板中的复选框。
*   **结果**: 快速按钮的视觉状态更新以匹配复选框。
*   **状态**: **通过**

### 2. 快速开始指南 (引导)
*   **测试**: 清除 `localStorage.removeItem('noteconnection_manual_seen')` 并重新加载。
*   **结果**: “快速开始指南”模态框在短暂延迟后自动出现。
*   **测试**: 点击“不再显示”并关闭模态框。重新加载页面。
*   **结果**: 模态框**不**会自动出现。
*   **状态**: **通过**

### 3. 帮助按钮访问
*   **测试**: 点击“帮助” (❓) 按钮。
*   **结果**: 快速开始指南模态框立即打开。
*   **状态**: **通过**

### 4. 本地化
*   **测试**: 切换语言至中文。
*   **结果**: 
    *   快速按钮提示/标签（如果可见）显示中文。
    *   指南标题变为“快速开始指南”。
    *   所有指南步骤和描述均为中文。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.25 - English Document

## Test Report: Freeze Layout Optimization

### 1. Main Interface Frozen State
*   **Test**: Enable "Freeze Layout" checkbox in the Simulation panel.
*   **Action**: Attempt to drag any node in the main graph (SVG Mode).
*   **Result**: 
    *   Node does NOT move.
    *   Simulation does NOT restart (no CPU spike).
    *   Drag cursor interaction is effectively suppressed.
*   **Status**: **Pass**

### 2. Focus Mode Interaction (Exemption)
*   **Test**: While "Freeze Layout" is enabled, enter Focus Mode (Double Click).
*   **Action**: Attempt to drag the focused node or its neighbors.
*   **Result**: 
    *   Node moves with the mouse (Drag works).
    *   Layout settles after drag (Simulation works for the active subset).
    *   This confirms the global freeze does not hinder focused exploration.
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.25 - Chinese Document

## 测试报告：冻结布局优化

### 1. 主界面冻结状态
*   **测试**: 在模拟面板中启用“冻结布局”复选框。
*   **操作**: 尝试拖动主图（SVG 模式）中的任何节点。
*   **结果**: 
    *   节点**不**移动。
    *   模拟**不**重启（无 CPU 峰值）。
    *   拖动光标交互被有效抑制。
*   **状态**: **通过**

### 2. 专注模式交互（豁免）
*   **测试**: 在启用“冻结布局”时，进入专注模式（双击）。
*   **操作**: 尝试拖动焦点节点或其邻居。
*   **结果**: 
    *   节点跟随鼠标移动（拖动有效）。
    *   拖动后布局稳定（模拟对活动子集有效）。
    *   这证实了全局冻结不会阻碍专注探索。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.24 - English Document

## Test Report: Focus Mode Memory Optimization

### 1. Simulation Subsetting (Optimization)
*   **Test**: Enter Focus Mode (Double Click).
*   **Observation**: 
    *   Focused nodes rearrange smoothly.
    *   Background nodes (if visible/dimmed) do NOT move or drift, even if simulation is running.
    *   CPU usage (observable via browser dev tools) should be lower compared to previous versions during Focus Mode interaction.
*   **Result**: 
    *   `simulation.nodes()` length equals the number of focused+neighbor nodes.
    *   Original state preserved.
*   **Status**: **Pass**

### 2. State Restoration
*   **Test**: Exit Focus Mode.
*   **Observation**: 
    *   Background nodes instantly reappear/reactivate in their EXACT original positions.
    *   Simulation resumes for the entire graph.
    *   No "explosion" or resetting of the entire graph layout occurs.
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.24 - Chinese Document

## 测试报告：专注模式内存优化

### 1. 模拟子集化（优化）
*   **测试**: 进入专注模式（双击）。
*   **观察**: 
    *   焦点节点平滑地重新排列。
    *   背景节点（如果可见/变暗）**不**移动或漂移，即使模拟正在运行。
    *   与以前的版本相比，专注模式交互期间的 CPU 使用率（可通过浏览器开发工具观察）应较低。
*   **结果**: 
    *   `simulation.nodes()` 的长度等于焦点节点+邻居节点的数量。
    *   原始状态得以保留。
*   **状态**: **通过**

### 2. 状态恢复
*   **测试**: 退出专注模式。
*   **观察**: 
    *   背景节点立即在它们的确切原始位置重新出现/重新激活。
    *   整个图表的模拟恢复。
    *   没有发生整个图表布局的“爆炸”或重置。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.23 - English Document

## Test Report: Default Settings Adjustment

### 1. Reading Window Font Size
*   **Test**: Open the Reading Window by clicking a node (after double-clicking to focus, or if focusing opens reader).
*   **Result**: 
    *   The font size of the content is small (0.5rem).
    *   Zoom controls work to increase size.
*   **Status**: **Pass**

### 2. Simulation Damping
*   **Test**: Reload the page. Check the "Speed (Damping)" slider value.
*   **Result**: Slider shows "0.6" and handle is at 0.6 position.
*   **Test**: Observe graph movement.
*   **Result**: Nodes settle slightly faster than before (higher damping/friction).
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.23 - Chinese Document

## 测试报告：默认设置调整

### 1. 阅读窗口字体大小
*   **测试**: 点击节点打开阅读窗口（双击专注后，或如果专注模式打开阅读器）。
*   **结果**: 
    *   内容字体大小较小 (0.5rem)。
    *   缩放控件可以增加大小。
*   **状态**: **通过**

### 2. 模拟阻尼 (Damping)
*   **测试**: 重新加载页面。检查“速度（阻尼）”滑块值。
*   **结果**: 滑块显示 "0.6"，手柄位于 0.6 位置。
*   **测试**: 观察图表移动。
*   **结果**: 节点稳定速度比以前稍快（更高的阻尼/摩擦力）。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.22 - English Document

## Test Report: Mobile Popup Adaptation

### 1. Touch Drag Interaction
*   **Test**: Open the application in mobile view (or device simulation). Click a node to open the popup.
*   **Action**: Touch and hold the popup header (title bar) with one finger and move.
*   **Result**: 
    *   The popup follows the finger movement smoothly.
    *   The page background does NOT scroll while dragging the popup.
    *   `dragging` class is added during interaction.
*   **Status**: **Pass**

### 2. Pinch-to-Zoom Interaction
*   **Test**: Open the popup on a touch device.
*   **Action**: Place two fingers on the popup content and spread them apart (pinch out).
*   **Result**: 
    *   The text size inside the popup increases.
    *   The scale is clamped at maximum 2.0x.
*   **Action**: Pinch two fingers together (pinch in).
*   **Result**: 
    *   The text size decreases.
    *   The scale is clamped at minimum 0.5x.
*   **Status**: **Pass**

### 3. Interaction Conflict Prevention
*   **Test**: Try to drag the popup by touching the content area (not the header).
*   **Result**: The popup does NOT move (Drag is restricted to header).
*   **Test**: Try to pinch zoom while dragging the header.
*   **Result**: Pinch logic requires 2 fingers on the popup; drag logic requires 1 finger on the header. Logic separation holds.
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.22 - Chinese Document

## 测试报告：移动端弹窗适配

### 1. 触摸拖动交互
*   **测试**: 在移动视图（或设备模拟）中打开应用。点击节点打开弹窗。
*   **操作**: 单指按住弹窗头部（标题栏）并移动。
*   **结果**: 
    *   弹窗平滑地跟随手指移动。
    *   拖动弹窗时页面背景**不会**滚动。
    *   交互期间添加了 `dragging` 类。
*   **状态**: **通过**

### 2. 捏合缩放交互
*   **测试**: 在触摸设备上打开弹窗。
*   **操作**: 双指放在弹窗内容上并张开（捏合放大）。
*   **结果**: 
    *   弹窗内的文字大小增加。
    *   缩放比例被限制在最大 2.0x。
*   **操作**: 双指捏合（缩小）。
*   **结果**: 
    *   文字大小减小。
    *   缩放比例被限制在最小 0.5x。
*   **状态**: **通过**

### 3. 交互冲突预防
*   **测试**: 尝试通过触摸内容区域（非头部）来拖动弹窗。
*   **结果**: 弹窗**不**移动（拖动仅限于头部）。
*   **测试**: 尝试在拖动头部时进行捏合缩放。
*   **结果**: 捏合逻辑需要双指作用于弹窗；拖动逻辑需要单指作用于头部。逻辑分离有效。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.21 - English Document

## Test Report: Strict Edge Visibility & Optimization

### 1. Default Edge Visibility (SVG)
*   **Test**: Load the graph in SVG Mode.
*   **Result**: 
    *   No edges are visible by default (Opacity: 0).
    *   Graph appears cleaner with only nodes visible.
*   **Status**: **Pass**

### 2. Interaction Visibility (SVG)
*   **Test**: Hover over a node (PC) or click a node (Mobile/PC).
*   **Result**: 
    *   Edges connected to the target node immediately become visible.
    *   Incoming edges are Red, Outgoing are Blue.
*   **Test**: Move mouse away or click background.
*   **Result**: Edges revert to invisible (Opacity: 0).
*   **Status**: **Pass**

### 3. Canvas Consistency
*   **Test**: Switch to Canvas Mode.
*   **Result**: Edges remain hidden by default, matching SVG behavior.
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.21 - Chinese Document

## 测试报告：严格的边可见性与优化

### 1. 默认边可见性 (SVG)
*   **测试**: 在 SVG 模式下加载图表。
*   **结果**: 
    *   默认情况下无边可见 (透明度: 0)。
    *   图表看起来更整洁，仅显示节点。
*   **状态**: **通过**

### 2. 交互可见性 (SVG)
*   **测试**: 悬停在节点上 (PC) 或点击节点 (移动端/PC)。
*   **结果**: 
    *   连接到目标节点的边立即变得可见。
    *   入度边为红色，出度边为蓝色。
*   **测试**: 移开鼠标或点击背景。
*   **结果**: 边恢复为不可见 (透明度: 0)。
*   **状态**: **通过**

### 3. Canvas 一致性
*   **测试**: 切换到 Canvas 模式。
*   **结果**: 边保持默认隐藏，与 SVG 行为匹配。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.18 - English Document

## Test Report: Node Highlighting System Refactor

### 1. NodeHighlightManager Module Loading
*   **Test**: Open browser developer console and check for JavaScript errors during page load.
*   **Result**: No errors. `window.NodeHighlightManager` and `window.createNodeHighlightManager` are defined.
*   **Status**: **Pass**

### 2. PC Hover Interaction (Non-Frozen)
*   **Test**: Hover mouse over a node without clicking.
*   **Result**: 
    *   Node and connected nodes remain at full opacity (1.0).
    *   Unconnected nodes dim to 0.05 opacity.
    *   Outgoing edges turn Blue (#4488ff) with 2.5px width.
    *   Incoming edges turn Red (#ff6b6b) with 2.5px width.
    *   Tooltip appears with node statistics.
*   **Test**: Move mouse away from node.
*   **Result**: Highlighting clears, all nodes and edges return to default visibility.
*   **Status**: **Pass**

### 3. Mobile Click Interaction (Frozen)
*   **Test**: Single click on a node.
*   **Result**: 
    *   Simulation stops (all nodes freeze).
    *   Node highlighting applied (same visual as hover).
    *   Statistics popup appears showing In/Out degree counts and neighbor lists.
*   **Test**: Click background (SVG area).
*   **Result**: 
    *   Highlight clears.
    *   Statistics popup closes.
    *   Simulation resumes (nodes start moving).
*   **Status**: **Pass**

### 4. Double Click Focus Mode Entry
*   **Test**: Double click on a node.
*   **Result**: 
    *   Focus Mode activates.
    *   Node arranges with inbound/outbound neighbors.
    *   Semantic labels appear ("Helping to understand", "Further exploration").
    *   highlightManager properly disables during focus mode.
*   **Status**: **Pass**

### 5. Focus Mode State Awareness
*   **Test**: While in Focus Mode, hover over a neighbor node.
*   **Result**: No hover highlighting occurs (Focus Mode handles its own visualization).
*   **Test**: Exit Focus Mode, then hover over the same node.
*   **Result**: Normal hover highlighting resumes.
*   **Status**: **Pass**

### 6. Canvas Mode Rendering
*   **Test**: Switch to Canvas renderer, hover over a node.
*   **Result**: 
    *   Visual effects match SVG mode (Blue/Red edges, dimmed unconnected nodes).
    *   Performance remains smooth even with highlighting active.
*   **Test**: Click a node in Canvas mode.
*   **Result**: Same freeze behavior as SVG mode.
*   **Status**: **Pass**

### 7. Analysis Panel Integration
*   **Test**: Open Analysis Panel, click a node row in the table.
*   **Result**: 
    *   Graph highlights the node using highlightManager.
    *   Tooltip appears at node position.
    *   No simulation freeze (freeze=false parameter used).
*   **Status**: **Pass**

### 8. Background Click Clearing
*   **Test**: Click a node to freeze highlight, then click SVG background.
*   **Result**: 
    *   Highlight clears completely.
    *   Statistics popup closes.
    *   Simulation resumes.
*   **Status**: **Pass**

### 9. State Management Robustness
*   **Test**: Rapidly click multiple nodes in succession.
*   **Result**: 
    *   Each click properly updates the frozen state.
    *   No stale highlights remain.
    *   Statistics popup updates for each new node.
*   **Status**: **Pass**

### 10. Bilingual Comments Verification
*   **Test**: Review `nodeHighlight.js` source code.
*   **Result**: All functions and logic blocks have Chinese and English comments.
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.18 - Chinese Document

## 测试报告：节点高亮系统重构

### 1. NodeHighlightManager 模块加载
*   **测试**: 打开浏览器开发者控制台，检查页面加载期间是否有 JavaScript 错误。
*   **结果**: 无错误。`window.NodeHighlightManager` 和 `window.createNodeHighlightManager` 已定义。
*   **状态**: **通过**

### 2. PC 悬停交互（非冻结）
*   **测试**: 将鼠标悬停在节点上但不点击。
*   **结果**: 
    *   节点和连接的节点保持完全不透明 (1.0)。
    *   未连接的节点变暗至 0.05 不透明度。
    *   出度边变为蓝色 (#4488ff)，宽度 2.5px。
    *   入度边变为红色 (#ff6b6b)，宽度 2.5px。
    *   显示带有节点统计信息的提示框。
*   **测试**: 将鼠标移开节点。
*   **结果**: 高亮清除，所有节点和边恢复到默认可见性。
*   **状态**: **通过**

### 3. 移动端点击交互（冻结）
*   **测试**: 单击某个节点。
*   **结果**: 
    *   模拟停止（所有节点冻结）。
    *   应用节点高亮（与悬停相同的视觉效果）。
    *   出现统计弹窗，显示入/出度计数和邻居列表。
*   **测试**: 点击背景（SVG 区域）。
*   **结果**: 
    *   高亮清除。
    *   统计弹窗关闭。
    *   模拟恢复（节点开始移动）。
*   **状态**: **通过**

### 4. 双击进入专注模式
*   **测试**: 双击某个节点。
*   **结果**: 
    *   激活专注模式。
    *   节点与入度/出度邻居一起排列。
    *   出现语义标签（"帮助理解"、"进一步探索"）。
    *   highlightManager 在专注模式期间正确禁用。
*   **状态**: **通过**

### 5. 专注模式状态感知
*   **测试**: 在专注模式下，悬停在邻居节点上。
*   **结果**: 不发生悬停高亮（专注模式处理自己的可视化）。
*   **测试**: 退出专注模式，然后悬停在同一节点上。
*   **结果**: 正常的悬停高亮恢复。
*   **状态**: **通过**

### 6. Canvas 模式渲染
*   **测试**: 切换到 Canvas 渲染器，悬停在节点上。
*   **结果**: 
    *   视觉效果与 SVG 模式匹配（蓝/红边，变暗的未连接节点）。
    *   即使在高亮激活时性能仍然流畅。
*   **测试**: 在 Canvas 模式下点击节点。
*   **结果**: 与 SVG 模式相同的冻结行为。
*   **状态**: **通过**

### 7. 分析面板集成
*   **测试**: 打开分析面板，点击表格中的节点行。
*   **结果**: 
    *   图表使用 highlightManager 高亮显示节点。
    *   提示框出现在节点位置。
    *   不冻结模拟（使用了 freeze=false 参数）。
*   **状态**: **通过**

### 8. 背景点击清除
*   **测试**: 点击节点以冻结高亮，然后点击 SVG 背景。
*   **结果**: 
    *   高亮完全清除。
    *   统计弹窗关闭。
    *   模拟恢复。
*   **状态**: **通过**

### 9. 状态管理稳健性
*   **测试**: 快速连续点击多个节点。
*   **结果**: 
    *   每次点击都正确更新冻结状态。
    *   没有残留的陈旧高亮。
    *   统计弹窗为每个新节点更新。
*   **状态**: **通过**

### 10. 双语注释验证
*   **测试**: 查看 `nodeHighlight.js` 源代码。
*   **结果**: 所有函数和逻辑块都有中文和英文注释。
*   **状态**: **通过**

---

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
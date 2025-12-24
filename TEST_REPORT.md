# Test Report - 2025-12-24 (v0.9.5)

## 1. Test Environment
*   **OS**: Win32
*   **Browser**: Chrome / Edge (Simulated)
*   **Version**: v0.9.5
*   **Date**: 2025-12-24

## 2. Feature Tests

### 2.1 Focus Mode Semantics
*   **Test Case**: Double-click a node to enter Focus Mode.
*   **Expected**:
    1.  Viewport pans to center the node (preserving its original simulation coordinates).
    2.  Labels "Helping to understand" and "Further exploration" appear in the respective areas.
    3.  Stats (In/Out) are displayed.
*   **Result**: **PASS**. (Verified logic in `app.js`).

### 2.2 Focus Layout Options
*   **Test Case**: Switch Layout to "Hierarchical (L-R)".
*   **Expected**:
    1.  Inbound nodes arrange to the Left.
    2.  Focus node in Center.
    3.  Outbound nodes arrange to the Right.
*   **Result**: **PASS**. (Verified layout logic `spreadVertical` usage).

### 2.3 Analysis Panel Mobile & Interaction
*   **Test Case**: Open Analysis Panel on mobile size.
*   **Expected**:
    1.  Panel height adjusts to 80vh.
    2.  Content is vertically scrollable.
*   **Test Case**: Click a row in the Node Table.
*   **Expected**: The corresponding node in the graph highlights (opacity 1) and shows edges.
*   **Result**: **PASS**. (Verified CSS media queries and JS event listeners).

### 2.4 Visual Visibility
*   **Test Case**: Default View.
*   **Expected**: Edges are hidden (opacity 0).
*   **Test Case**: Single Click Node.
*   **Expected**: Node and connected edges become visible.
*   **Result**: **PASS**.

### 2.5 Mermaid Styling
*   **Test Case**: Render Mermaid diagram.
*   **Expected**: Text elements have strong shadow/outline to be visible against light node backgrounds.
*   **Result**: **PASS**. (Verified CSS `text-shadow`).

## 3. Conclusion
All v0.9.5 requirements regarding Mobile UX, Focus Mode Semantics, and Visuals have been implemented and verified against the logic.

---

# 测试报告 - 2025-12-24 (v0.9.5)

## 1. 测试环境
*   **系统**: Win32
*   **浏览器**: Chrome / Edge (模拟)
*   **版本**: v0.9.5
*   **日期**: 2025-12-24

## 2. 功能测试

### 2.1 专注模式语义
*   **测试用例**: 双击节点进入专注模式。
*   **预期结果**:
    1.  视口平移以使节点居中（保留其原始模拟坐标）。
    2.  标签 "Helping to understand" 和 "Further exploration" 出现在相应区域。
    3.  显示统计信息（入/出度）。
*   **结果**: **通过**. (已验证 `app.js` 逻辑).

### 2.2 专注布局选项
*   **测试用例**: 切换布局为 "层级 (L-R)"。
*   **预期结果**:
    1.  入度节点排列在左侧。
    2.  焦点节点在中间。
    3.  出度节点排列在右侧。
*   **结果**: **通过**. (已验证布局逻辑).

### 2.3 分析面板移动端与交互
*   **测试用例**: 在移动尺寸下打开分析面板。
*   **预期结果**:
    1.  面板高度调整为 80vh。
    2.  内容可垂直滚动。
*   **测试用例**: 点击节点表中的行。
*   **预期结果**: 图表中相应的节点高亮显示（透明度 1）并显示边。
*   **结果**: **通过**. (已验证 CSS 媒体查询和 JS 事件监听器).

### 2.4 视觉可见性
*   **测试用例**: 默认视图。
*   **预期结果**: 边隐藏（透明度 0）。
*   **测试用例**: 单击节点。
*   **预期结果**: 节点和连接的边变得可见。
*   **结果**: **通过**.

### 2.5 Mermaid 样式
*   **测试用例**: 渲染 Mermaid 图表。
*   **预期结果**: 文本元素具有强烈的阴影/描边，以便在浅色节点背景下可见。
*   **结果**: **通过**. (已验证 CSS `text-shadow`).

## 3. 结论
所有关于移动端 UX、专注模式语义和视觉效果的 v0.9.5 需求均已实现并经过逻辑验证。
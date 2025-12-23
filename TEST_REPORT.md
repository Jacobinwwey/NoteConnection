# Test Report (2025-12-23 v0.8.9)

## English Document

### 1. UX Improvement: Freeze on Select
*   **Component**: `Frontend` (Interaction Logic).
*   **Objective**: Ensure nodes remain stationary when selected/dragged in Focus Mode.
*   **Test Data**: Core Unit Tests.
*   **Method**:
    *   Executed `npx jest` to verify core graph logic stability.
    *   Verified `dragended` logic:
        *   Standard Mode: Node released (`fx=null`).
        *   Focus Mode: Node position retained (`fx` kept).
*   **Results**:
    *   **Unit Tests**: All 3 tests passed.
    *   **Behavior**: Nodes in Focus Mode now stay exactly where placed after dragging, improving inspection stability.
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. 用户体验改进：选中冻结
*   **组件**: `Frontend` (交互逻辑)。
*   **目标**: 确保在专注模式下选中/拖动节点时，节点保持静止。
*   **测试数据**: 核心单元测试。
*   **方法**:
    *   执行 `npx jest` 验证核心图逻辑的稳定性。
    *   验证 `dragended` 逻辑:
        *   标准模式: 节点释放 (`fx=null`)。
        *   专注模式: 节点位置保留 (`fx` 保持)。
*   **结果**:
    *   **单元测试**: 所有 3 个测试通过。
    *   **行为**: 专注模式下的节点在拖动后现在完全停留在放置的位置，提高了检查的稳定性。
*   **结果**: 通过 (PASS)。

---

# Test Report (2025-12-23 v0.8.8)

## English Document

### 1. Scalability Defaults & Focus Mode
*   **Component**: `Frontend` (UI Logic).
*   **Objective**: Verify default settings for large graphs and new layout controls.
*   **Test Data**: Core Unit Tests.
*   **Method**:
    *   Executed `npx jest` to verify core graph logic stability.
    *   Verified default state of "Show Orphans" is unchecked.
    *   Verified default Node Size is "Degree".
    *   Verified Edges are hidden by default (opacity 0) and visible on hover/focus.
    *   Verified Horizontal Spacing slider logic in `enterFocusMode`.
*   **Results**:
    *   **Unit Tests**: All 3 tests passed.
    *   **Defaults**: Correctly applied in `index.html` and `app.js`.
    *   **Focus Mode**: Horizontal spacing slider correctly adjusts `spreadNodes` calculation.
    *   **Visibility**: Edges are hidden to reduce clutter, appearing only when contextually relevant.
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. 可扩展性默认值与专注模式
*   **组件**: `Frontend` (UI 逻辑)。
*   **目标**: 验证大图的默认设置和新的布局控制。
*   **测试数据**: 核心单元测试。
*   **方法**:
    *   执行 `npx jest` 验证核心图逻辑的稳定性。
    *   验证“显示孤立节点”的默认状态为未选中。
    *   验证节点大小默认为“度数”。
    *   验证边默认隐藏（透明度 0），仅在悬停/专注时可见。
    *   验证 `enterFocusMode` 中的水平间距滑块逻辑。
*   **结果**:
    *   **单元测试**: 所有 3 个测试通过。
    *   **默认值**: 在 `index.html` 和 `app.js` 中正确应用。
    *   **专注模式**: 水平间距滑块正确调整了 `spreadNodes` 计算。
    *   **可见性**: 边被隐藏以减少杂乱，仅在上下文相关时显示。
*   **结果**: 通过 (PASS)。
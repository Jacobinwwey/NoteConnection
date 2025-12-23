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

---

# Test Report (2025-12-23 v0.8.7)

## English Document

### 1. Performance Optimization & Rendering
*   **Component**: `GraphBuilder` (Backend) & `Renderer` (Frontend).
*   **Objective**: Verify scalability improvements for large datasets (>10k nodes) and Focus Mode usability.
*   **Test Data**: Core Unit Tests.
*   **Method**:
    *   Executed `npx jest` to verify core graph logic stability.
    *   Verified code changes for Worker limit increase (cap 4 -> 12).
    *   Verified implementation of Canvas rendering toggle.
    *   Verified addition of Focus Mode spacing slider.
*   **Results**:
    *   **Unit Tests**: All 3 tests passed.
    *   **Workers**: Config updated to support high-performance machines (up to 12 threads).
    *   **Rendering**: Canvas renderer logic integrated for handle high-density graphs.
    *   **UX**: Focus Mode now supports dynamic spacing adjustment via UI slider.
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. 性能优化与渲染
*   **组件**: `GraphBuilder` (后端) & `Renderer` (前端)。
*   **目标**: 验证针对大数据集 (>10k 节点) 的可扩展性改进和专注模式的可用性。
*   **测试数据**: 核心单元测试。
*   **方法**:
    *   执行 `npx jest` 验证核心图逻辑的稳定性。
    *   验证 Worker 限制增加的代码更改 (上限 4 -> 12)。
    *   验证 Canvas 渲染切换的实现。
    *   验证专注模式间距滑块的添加。
*   **结果**:
    *   **单元测试**: 所有 3 个测试通过。
    *   **Workers**: 配置已更新以支持高性能机器 (最多 12 个线程)。
    *   **渲染**: 集成 Canvas 渲染逻辑以处理高密度图。
    *   **用户体验**: 专注模式现在支持通过 UI 滑块动态调整间距。
*   **结果**: 通过 (PASS)。

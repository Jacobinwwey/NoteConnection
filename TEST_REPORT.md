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

---

# Test Report (2025-12-23 v0.8.6)

## English Document

### 1. Parallel Processing & Performance
*   **Component**: `GraphBuilder` (Backend) + `Worker Threads`.
*   **Objective**: Verify performance improvement and stability of parallel keyword matching.
*   **Test Data**: `handbook_con_complete` (2229 nodes).
*   **Method**:
    *   Executed `npx ts-node src/index.ts handbook_con_complete`.
    *   Verified worker spawning logic and error handling.
    *   Verified sequential fallback (tested by forcing error, observed safe degradation).
*   **Results**:
    *   **Workers**: Successfully spawned 4 workers.
    *   **Stability**: Handled `EMFILE` limits via batch processing in `FileLoader`.
    *   **Output**: Graph built with 36818 edges (including Statistical/Hybrid inference).
    *   **Speed**: Significant reduction in matching time compared to single-threaded approach on similar datasets (qualitative observation).
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. 并行处理与性能
*   **组件**: `GraphBuilder` (后端) + `Worker Threads`。
*   **目标**: 验证并行关键词匹配的性能提升和稳定性。
*   **测试数据**: `handbook_con_complete` (2229 个节点)。
*   **方法**:
    *   执行 `npx ts-node src/index.ts handbook_con_complete`。
    *   验证 Worker 生成逻辑和错误处理。
    *   验证顺序回退（通过强制错误测试，观察到安全降级）。
*   **结果**:
    *   **Workers**: 成功生成 4 个 Worker。
    *   **稳定性**: 通过 `FileLoader` 中的批量处理解决了 `EMFILE` 限制。
    *   **输出**: 构建了包含 36818 条边的图（包括统计/混合推断）。
    *   **速度**: 与类似数据集上的单线程方法相比，匹配时间显著减少（定性观察）。
*   **结果**: 通过 (PASS)。
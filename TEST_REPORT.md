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

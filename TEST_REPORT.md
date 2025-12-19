# Test Report (测试报告)

## 2026-01-15 v0.1.6 - Data Persistence & Clustering

### English Report

**Objective**: Implement layout persistence and community detection.

**1. Data Persistence (Save Layout)**
- **Feature**: "Save Layout (JSON)" button in UI.
- **Function**: Downloads `layout.json` containing `id`, `x`, `y` coordinates.
- **Integration**:
    - Place `layout.json` in project root.
    - Run build script.
    - Result: Graph initializes with saved positions (Warm Start).
- **Verification**: Verified that nodes retain positions after reload if layout is provided.

**2. Community Detection (Clustering)**
- **Algorithm**: Label Propagation Algorithm (LPA) implemented in `src/backend/CommunityDetection.ts`.
- **Process**: Runs automatically during graph build. Assigns `clusterId` to every node.
- **Visualization**:
    - Added "Color By: Degree / Cluster" toggle in UI.
    - **Cluster Mode**: Nodes colored by community (Categorical colors).
    - **Degree Mode**: Original heat map (Blue scale).
- **Result**: Distinct communities are visible (e.g., highly interconnected groups share the same color).

**Conclusion**: The graph now supports both structural analysis (Degree) and community analysis (Clustering), with the ability to save custom layouts.

---

### 中文报告

**目标**: 实现布局持久化和社区检测。

**1. 数据持久化 (保存布局)**
- **功能**: UI 中的 "保存布局 (JSON)" 按钮。
- **功能**: 下载包含 `id`、`x`、`y` 坐标的 `layout.json`。
- **集成**:
    - 将 `layout.json` 放置在项目根目录。
    - 运行构建脚本。
    - 结果: 图表使用保存的位置初始化（热启动）。
- **验证**: 验证了如果提供布局，节点在重新加载后保留位置。

**2. 社区检测 (聚类)**
- **算法**: 在 `src/backend/CommunityDetection.ts` 中实现的标签传播算法 (LPA)。
- **过程**: 在图构建期间自动运行。为每个节点分配 `clusterId`。
- **可视化**:
    - 在 UI 中添加了 "按度数 / 按聚类着色" 切换。
    - **聚类模式**: 节点按社区着色（分类颜色）。
    - **度数模式**: 原始热力图（蓝色刻度）。
- **结果**: 可见不同的社区（例如，高度互连的组共享相同的颜色）。

**结论**: 图表现在支持结构分析（度数）和社区分析（聚类），并能够保存自定义布局。

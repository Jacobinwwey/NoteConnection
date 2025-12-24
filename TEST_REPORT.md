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

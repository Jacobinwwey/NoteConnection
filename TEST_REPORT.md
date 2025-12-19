# Test Report (测试报告)

## 2025-12-19 v0.1.3 - DAG Construction & Visualization

### English Report

**Objective**: Verify the implementation of the DAG construction backend and the HTML/D3.js frontend visualization.

**Test Environment**:
- OS: Win32
- Runtime: Node.js (ts-node)
- Browser Target: Modern Browsers (Chrome/Edge/Firefox)

**1. Backend Data Construction**
- **Input**: 214 Markdown files in `testconcept/`.
- **Process**:
    - `FileLoader` successfully read all files.
    - `GraphBuilder` applied "Keyword Matching" strategy (scanning content for other note titles).
- **Output**:
    - Nodes: 214
    - Edges: 419
    - File: `src/frontend/graph_data.json` generated valid JSON.
    - File: `src/frontend/data.js` generated for easy frontend import.
- **Verification**: `inDegree` and `outDegree` calculated correctly (e.g., Absorption: In=2, Out=22).

**2. Frontend Visualization**
- **Files Created**: `index.html`, `app.js`, `styles.css`.
- **Features Implemented**:
    - **Force-Directed Layout**: Nodes repel, edges connect.
    - **Visual Distinction**:
        - Nodes colored by total degree (Blue heatmap).
        - Highlight: Hovering a node highlights neighbors.
        - **In-Degree Edges**: Red (`#ff6b6b`).
        - **Out-Degree Edges**: Cyan (`#4ecdc4`).
    - **Filtering**: Radio buttons to show "All", "Incoming Only", or "Outgoing Only".
    - **Search**: Real-time filtering by node name.
    - **Tooltip**: Shows ID, In-Degree, and Out-Degree on hover.

**Conclusion**: The system successfully transforms raw markdown files into an interactive knowledge graph without external platform dependencies.

---

### 中文报告

**目标**: 验证 DAG 构建后端和 HTML/D3.js 前端可视化的实现。

**测试环境**:
- 操作系统: Win32
- 运行环境: Node.js (ts-node)
- 目标浏览器: 现代浏览器 (Chrome/Edge/Firefox)

**1. 后端数据构建**
- **输入**: `testconcept/` 目录下的 214 个 Markdown 文件。
- **过程**:
    - `FileLoader` 成功读取所有文件。
    - `GraphBuilder` 应用了“关键词匹配”策略（扫描内容以查找其他笔记标题）。
- **输出**:
    - 节点数: 214
    - 边数: 419
    - 文件: `src/frontend/graph_data.json` 生成了有效的 JSON。
    - 文件: `src/frontend/data.js` 生成用于前端导入的文件。
- **验证**: `inDegree`（入度）和 `outDegree`（出度）计算正确（例如，Absorption: In=2, Out=22）。

**2. 前端可视化**
- **创建的文件**: `index.html`, `app.js`, `styles.css`.
- **实现的功能**:
    - **力导向布局**: 节点排斥，边连接。
    - **视觉区分**:
        - 节点根据总度数着色（蓝色热力图）。
        - 高亮: 悬停节点时高亮邻居。
        - **入度边**: 红色 (`#ff6b6b`)。
        - **出度边**: 青色 (`#4ecdc4`)。
    - **过滤**: 单选按钮显示“全部”、“仅入度”或“仅出度”。
    - **搜索**: 按节点名称实时过滤。
    - **提示框**: 悬停时显示 ID、入度和出度。

**结论**: 系统成功地将原始 Markdown 文件转换为交互式知识图谱，无需依赖外部平台。
# 2026-02-01 v0.1.7

## English Document

# NoteConnection

A standalone system for visualizing knowledge graphs from Markdown notes using hierarchical Directed Acyclic Graph (DAG) structures.

### Features

#### Core
*   **Independent**: No Obsidian/Joplin dependency required to run.
*   **Keyword Matching**: Automatically links notes if one mentions another's title.
*   **Fuzzy Matching (v0.1.7)**: Intelligent linking using Levenshtein distance.
*   **Tag Linking (v0.1.7)**: Extracts tags from Frontmatter and `[[WikiLinks]]`, creating concept clusters.

#### Visualization
*   **Force-Directed Graph**: Interactive D3.js visualization.
*   **Degree Analysis**: Visualizes In-Degree and Out-Degree heatmaps.
*   **Centrality Analysis (v0.1.7)**: Highlights "Bridge" nodes (High Betweenness) with larger size and bold labels.
*   **Community Detection**: Auto-colors nodes by structural communities (Label Propagation).

#### Tools
*   **Analysis Panel**: Histogram of degree distribution, Sortable Node Table.
*   **Flexible Export**: Export selected nodes as **JSON**, **ZIP (Markdown)**, or **SVG Image**.
*   **Layout Persistence**: Save and Restore your graph layout (`layout.json`).

### Usage

#### 1. Build the Graph

Run the backend script to scan `testconcept` and generate `graph_data.json`.

```bash
# Install dependencies (if first time)
npm install

# Build the graph
npx ts-node src/index.ts
```

#### 2. Visualize

Open `src/frontend/index.html` in your web browser.

### 3. Controls

*   **Mode**: Filter edges (All / Incoming / Outgoing).
*   **Color By**:
    *   **Degree**: Blue heatmap (Connectivity).
    *   **Cluster**: Categorical colors (Communities).
*   **Size By**:
    *   **Uniform**: Standard size.
    *   **Centrality**: Size proportional to importance.
*   **Opacity**: Adjust label transparency to reduce clutter.

### Documentation

*   `Interface Document.md`: Technical API details.
*   `TEST_REPORT.md`: Functional verification reports.

---

## Chinese Document (中文文档)

# NoteConnection (笔记连接)

一个独立的系统，用于从 Markdown 笔记中提取知识图谱，并使用分层有向无环图 (DAG) 结构进行可视化。

### 功能 (Features)

#### 核心功能 (Core)
*   **独立运行**: 无需依赖 Obsidian 或 Joplin 即可运行。
*   **关键词匹配**: 如果一个笔记提到另一个笔记的标题，自动建立连接。
*   **模糊匹配 (v0.1.7)**: 使用 Levenshtein 距离进行智能连接。
*   **标签连接 (v0.1.7)**: 从 Frontmatter 和 `[[WikiLinks]]` 中提取标签，创建概念聚类。

#### 可视化 (Visualization)
*   **力导向图**: 交互式 D3.js 可视化。
*   **度数分析**: 可视化入度和出度热力图。
*   **中心性分析 (v0.1.7)**: 高亮显示“桥梁”节点（高介数中心性），使用更大尺寸和粗体标签。
*   **社区检测**: 根据结构社区自动为节点着色（标签传播）。

#### 工具 (Tools)
*   **分析面板**: 度数分布直方图，可排序节点表。
*   **灵活导出**: 将选定节点导出为 **JSON**、**ZIP (Markdown)** 或 **SVG 图片**。
*   **布局持久化**: 保存和恢复图表布局 (`layout.json`)。

### 使用方法 (Usage)

#### 1. 构建图谱

运行后端脚本以扫描 `testconcept` 并生成 `graph_data.json`。

```bash
# 安装依赖 (如果是第一次)
npm install

# 构建图谱
npx ts-node src/index.ts
```

#### 2. 可视化

在浏览器中打开 `src/frontend/index.html`。

### 3. 控件 (Controls)

*   **模式 (Mode)**: 过滤边（全部 / 入度 / 出度）。
*   **着色 (Color By)**:
    *   **度数 (Degree)**: 蓝色热力图 (连接度)。
    *   **聚类 (Cluster)**: 分类颜色 (社区)。
*   **大小 (Size By)**:
    *   **统一 (Uniform)**: 标准大小。
    *   **中心性 (Centrality)**: 大小与重要性成正比。
*   **不透明度 (Opacity)**: 调整标签透明度以减少混乱。

### 文档 (Documentation)

*   `Interface Document.md`: 技术 API 详情。
*   `TEST_REPORT.md`: 功能验证报告。

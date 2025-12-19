# NoteConnection

A standalone system for visualizing knowledge graphs from Markdown notes using hierarchical Directed Acyclic Graph (DAG) structures.
独立系统，用于从 Markdown 笔记中提取知识图谱，并使用分层有向无环图 (DAG) 结构进行可视化。

## Project Structure (项目结构)

*   `src/backend`: Node.js logic for file loading, parsing, and graph construction.
    *   `src/backend`: 用于文件加载、解析和图构建的 Node.js 逻辑。
*   `src/frontend`: HTML/JS/CSS for visualizing the graph.
    *   `src/frontend`: 用于可视化图表的 HTML/JS/CSS。
*   `testconcept`: Sample data (Markdown files).
    *   `testconcept`: 示例数据（Markdown 文件）。

## Usage (使用方法)

### 1. Build the Graph (构建图谱)

Run the backend script to scan `testconcept` and generate `graph_data.json`.
运行后端脚本以扫描 `testconcept` 并生成 `graph_data.json`。

```bash
# Install dependencies (if first time)
npm install

# Build the graph
npx ts-node src/index.ts
```

### 2. Visualize (可视化)

Open `src/frontend/index.html` in your web browser.
在浏览器中打开 `src/frontend/index.html`。

*   **Blue Nodes**: Knowledge points. Darker blue = higher connectivity.
    *   **蓝色节点**: 知识点。深蓝色 = 连接度更高。
*   **Red Links**: Incoming connections (Prerequisites).
    *   **红色连线**: 入度连接（先决条件）。
*   **Cyan Links**: Outgoing connections (Derived concepts).
    *   **青色连线**: 出度连接（派生概念）。

## Features (功能)

*   **Independent**: No Obsidian/Joplin dependency required to run.
*   **Keyword Matching**: Automatically links notes if one mentions another's title.
*   **Degree Analysis**: Visualizes In-Degree and Out-Degree.
*   **Community Detection**: Auto-detects clusters (Label Propagation) and colors nodes by community.
*   **Distribution & Export**:
    *   View Degree Distribution Histogram.
    *   Export Top X% nodes or High-Degree nodes to **JSON** or **ZIP**.
*   **Persistence**: Save and restore graph layout (`layout.json`).
*   **Search**: Filter nodes by name.

## Documentation (文档)

*   `Interface Document.md`: Technical API details.
*   `TEST_REPORT.md`: Functional verification reports.

# 2025-12-17 v0.1.0

# NoteConnection

A system to visualize knowledge points as a Directed Acyclic Graph (DAG) by analyzing markdown notes.

## Project Structure

```
NoteConnection/
├── src/
│   ├── backend/        # Node.js processing logic
│   │   ├── main.ts     # Entry point
│   │   ├── parser.ts   # File parsing
│   │   ├── graph.ts    # Graph construction
│   │   └── types.ts    # Type definitions
│   └── frontend/       # Visualization
│       ├── index.html  # D3.js Graph View
│       └── graph_data.json # Generated Data
├── Interface Document.md # API Documentation
├── TODO.md             # Development Plan
├── tsconfig.json
└── package.json
```

## Setup & Usage

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Build Graph Data**:
    This parses the notes in `testconcept/` and generates `graph_data.json`.
    ```bash
    npx ts-node src/backend/main.ts
    ```

3.  **View Graph**:
    Start a local server to avoid CORS issues.
    ```bash
    npx http-server src/frontend
    ```
    Then open the URL shown (e.g., `http://127.0.0.1:8080`).

## Current Features

*   **Ingestion**: Scans Markdown files.
*   **Edge Detection**: Links concepts if Title A appears in Content B.
*   **Visualization**: Interactive D3 Force Directed Graph.

---
---

# 笔记连接 (NoteConnection)

通过分析 markdown 笔记，将知识点可视化为有向无环图 (DAG) 的系统。

## 项目结构 (Project Structure)

```
NoteConnection/
├── src/
│   ├── backend/        # Node.js 处理逻辑
│   │   ├── main.ts     # 入口点
│   │   ├── parser.ts   # 文件解析
│   │   ├── graph.ts    # 图构建
│   │   └── types.ts    # 类型定义
│   └── frontend/       # 可视化
│       ├── index.html  # D3.js 图表视图
│       └── graph_data.json # 生成的数据
├── Interface Document.md # 接口文档
├── TODO.md             # 开发计划
├── tsconfig.json
└── package.json
```

## 安装与使用 (Setup & Usage)

1.  **安装依赖 (Install Dependencies)**:
    ```bash
    npm install
    ```

2.  **构建图数据 (Build Graph Data)**:
    此步骤解析 `testconcept/` 中的笔记并生成 `graph_data.json`。
    ```bash
    npx ts-node src/backend/main.ts
    ```

3.  **查看图表 (View Graph)**:
    启动本地服务器以避免 CORS 问题。
    ```bash
    npx http-server src/frontend
    ```
    然后打开显示的 URL (例如 `http://127.0.0.1:8080`)。

## 当前功能 (Current Features)

*   **摄取**: 扫描 Markdown 文件。
*   **边检测**: 如果在内容 B 中出现标题 A，则链接概念。
*   **可视化**: 交互式 D3 力导向图。
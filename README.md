# 2025-12-22 v0.8.5

# NoteConnection: Hierarchical Knowledge Graph Visualization System
> **Unlock the Structure of Your Knowledge.**

**NoteConnection** is a high-performance, standalone visualization system engineered to transform unstructured Markdown knowledge bases into **Directed Acyclic Graphs (DAGs)**.

Unlike traditional "network" views that show a messy web of links, NoteConnection reveals the **hierarchy**, **learning paths**, and **dependency structures** hidden within your notes. It is built for scalability, capable of handling tens of thousands of nodes with ease, and operates completely independently of any specific note-taking app.
<img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/fa55676d-f58d-414e-943c-7a10567f88a5" />

---

## 🌟 Core Features (v0.8.5)

### 1. Dynamic Knowledge Base & Server (New v0.8.5)
*   **Dynamic Source Selection**: Switch between different knowledge base folders (e.g., `Knowledge_Base/ProjectA`, `Knowledge_Base/testconcept`) instantly via the UI.
*   **Integrated Server**: A built-in HTTP server (`npm start`) handles API requests and serves the frontend, making it easy to deploy locally or on a private network.
*   **Promotional Readiness**: Zero-config startup. Just run `npm start` and explore.

### 2. Structure Over Chaos (DAG vs. Force)
*   **Directed Dependencies**: Identifies "Prerequisites" and "Next Steps" to arrange concepts in logical layers.
*   **Sugiyama Layout**: Renders a clear top-down hierarchy instead of a hairball.
<img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/52785445-20bf-4ecc-847a-23863f291b6a" />

### 3. Scalable Semantic Zoom
*   **Cluster View**: Aggregates thousands of nodes into high-level "Concept Bubbles" based on folder structure or tags.
*   **Drill-Down**: Click on a cluster to zoom in and explore detailed connections within that specific domain.

### 4. Intelligent Inference Engine
*   **Hybrid Analysis**: Combines **Statistical Probability** ($P(A|B)$) and **Vector Similarity** (TF-IDF) to infer hidden dependencies (e.g., "Fluorescence" implies "Photon") without external AI.
*   **No AI Required**: Runs locally and offline.
*   **Bilingual Support**: Intelligent processing for both English and Chinese content.
<img width="3723" height="1992" alt="image" src="https://github.com/user-attachments/assets/9e56e567-1742-48cf-b720-cf65a47fd317" />

### 5. Interactive Focus Mode
*   **Deep Dive**: Click any node to isolate it and its immediate context.
*   **Smart Layout**: Auto-arranges **Superiors** (Out-degree) and **Subordinates** (In-degree) with relative height positioning based on relevance.
*   **Clean Visualization**: Prevents label overlap using staggered positioning and highlights high-value paths.
<img width="2012" height="2024" alt="image" src="https://github.com/user-attachments/assets/e5e4c42d-54a7-463c-bc43-0feb42469a12" />

---

## Quick Start

### 1. Installation
```bash
npm install
```

### 2. Run the Server
Launch the integrated server. This allows you to browse and build graphs from your browser.
```bash
npm start
```
*   Server runs at: `http://localhost:3000`

### 3. Usage
1.  Open `http://localhost:3000`.
2.  **Select Source**: Use the dropdown in the top-left to choose a folder from `Knowledge_Base`.
3.  **Load**: Click "Load" to build the graph dynamically.
4.  **Explore**:
    *   **View Mode**: Toggle between **Nodes** (Detailed) and **Clusters** (Overview).
    *   **Layout**: Switch between **Force** (Physics) and **DAG** (Hierarchy).
    *   **Filter**: Use the Analysis Panel to find "Hub" nodes.

---
---

# 2025-12-22 v0.8.5

# NoteConnection: 层级知识图谱可视化系统
> **解锁你知识库的深层结构。**

**NoteConnection** 是一个高性能的独立可视化系统，旨在将非结构化的 Markdown 知识库转化为**有向无环图 (DAG)**。

与展示杂乱链接网的传统“网络”视图不同，NoteConnection 揭示了隐藏在笔记中的**层级关系**、**学习路径**和**依赖结构**。它专为可扩展性而设计，能够轻松处理数万个节点，并且完全独立于任何特定的笔记应用程序运行。
<img width="2784" height="2034" alt="image" src="https://github.com/user-attachments/assets/0ea42609-4296-42ea-978d-c6cb7d448068" />
<img width="3543" height="2159" alt="image" src="https://github.com/user-attachments/assets/0b2d80f5-ec8c-4ac1-9607-b925d4ab5f82" />

---

## 🌟 核心特性 (v0.8.5)

### 1. 动态知识库与服务器 (v0.8.5 新增)
*   **动态数据源选择**: 通过 UI 即时切换不同的知识库文件夹（例如 `Knowledge_Base/ProjectA`, `Knowledge_Base/testconcept`）。
*   **集成服务器**: 内置 HTTP 服务器 (`npm start`) 处理 API 请求并服务前端，使其易于在本地或专用网络上部署。
*   **便于推广**: 零配置启动。只需运行 `npm start` 即可探索。

### 2. 结构优于混沌 (DAG vs. 力导向)
*   **有向依赖**: 识别“先决条件”和“后续步骤”，将概念按逻辑分层排列。
*   **Sugiyama 布局**: 渲染清晰的自上而下的层级结构，而非混乱的毛线球。

### 3. 可扩展的语义缩放 (Semantic Zoom)
*   **聚类视图**: 基于文件夹结构或标签，将数千个节点聚合为高级“概念气泡”。
*   **向下钻取**: 点击聚类即可放大并探索该特定领域内的详细连接。
<img width="3404" height="2028" alt="image" src="https://github.com/user-attachments/assets/39ea71da-be14-4fdc-9fec-9f33cab92e1b" />

### 4. 智能推断引擎
*   **混合分析**: 结合**统计概率** ($P(A|B)$) 和 **向量相似度** (TF-IDF) 推断隐藏的依赖关系（例如，“荧光”隐含“光子”），无需外部 AI。
*   **无需 AI**: 本地离线运行。
*   **双语支持**: 支持英文和中文内容的智能处理。
<img width="3723" height="2007" alt="image" src="https://github.com/user-attachments/assets/10978984-3e2d-4ab6-8b44-342d4f3c3800" />

### 5. 交互式专注模式
*   **深度探索**: 点击任意节点以隔离它及其直接上下文。
*   **智能布局**: 自动排列**上级**（出度）和**下级**（入度），并基于相关性进行相对高度定位。
*   **清晰可视化**: 使用交错定位防止标签重叠，并高亮显示高价值路径。
<img width="2012" height="2024" alt="image" src="https://github.com/user-attachments/assets/bf6e7508-7e42-46cb-9a3e-b92be063ad3d" />

---

## 快速开始

### 1. 安装
```bash
npm install
```

### 2. 运行服务器
启动集成服务器。这允许您从浏览器浏览和构建图谱。
```bash
npm start
```
*   服务器运行于: `http://localhost:3000`

### 3. 使用方法
1.  打开 `http://localhost:3000`。
2.  **选择数据源**: 使用左上角的下拉菜单从 `Knowledge_Base` 中选择文件夹。
3.  **加载**: 点击 "Load" 动态构建图谱。
4.  **探索**:
    *   **视图模式**: 在**节点** (详细) 和 **聚类** (概览) 之间切换。
    *   **布局**: 在 **Force** (力导向) 和 **DAG** (层级) 之间切换。
    *   **过滤**: 使用分析面板查找“枢纽”节点。
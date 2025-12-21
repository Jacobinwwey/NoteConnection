# 2025-12-21 v0.6.5

# NoteConnection: Hierarchical Knowledge Graph Visualization System
> **Unlock the Structure of Your Knowledge.**

**NoteConnection** is a high-performance, standalone visualization system engineered to transform unstructured Markdown knowledge bases into **Directed Acyclic Graphs (DAGs)**.

Unlike traditional "network" views that show a messy web of links, NoteConnection reveals the **hierarchy**, **learning paths**, and **dependency structures** hidden within your notes. It is built for scalability, capable of handling tens of thousands of nodes with ease, and operates completely independently of any specific note-taking app.
<img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/fa55676d-f58d-414e-943c-7a10567f88a5" />

---

## 🌟 Core Features (v0.6.5)

### 1. Structure Over Chaos (DAG vs. Force)
*   **Directed Dependencies**: Identifies "Prerequisites" and "Next Steps" to arrange concepts in logical layers.
*   **Sugiyama Layout**: Renders a clear top-down hierarchy instead of a hairball.
<img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/52785445-20bf-4ecc-847a-23863f291b6a" />

### 2. Scalable Semantic Zoom
*   **Cluster View**: Aggregates thousands of nodes into high-level "Concept Bubbles" based on folder structure or tags.
*   **Drill-Down**: Click on a cluster to zoom in and explore detailed connections within that specific domain.

### 3. Intelligent Inference Engine (No AI Required)
*   **Statistical Association**: Uses conditional probability ($P(A|B)$) to infer hidden dependencies (e.g., "Fluorescence" implies "Photon") without external LLM APIs.
*   **Vector Similarity**: Uses TF-IDF and Cosine Similarity to find related concepts even without explicit links.
*   **Hybrid Analysis**: Combines explicit links (`[[WikiLink]]`), YAML frontmatter (`prerequisites:`), and statistical/vector patterns.
<img width="3723" height="1992" alt="image" src="https://github.com/user-attachments/assets/9e56e567-1742-48cf-b720-cf65a47fd317" />

### 4. Interactive Focus Mode (v0.6.5)
*   **Deep Dive**: Click any node to isolate it and its immediate context.
*   **Smart Layout**: Auto-arranges **Superiors** (Out-degree) and **Subordinates** (In-degree) with relative height positioning based on relevance.
*   **Clean Visualization**: Prevents label overlap using staggered positioning and highlights high-value paths.

### 5. Platform Agnostic & Future-Proof
*   **Pure TypeScript**: Runs directly on your file system.
*   **Data Sovereignty**: Export your graph as JSON, SVG, or ZIP.
*   **Bilingual**: Native support for **English** and **Chinese**.

---

## Quick Start

### 1. Build the Graph
Run the backend to scan your notes (default: `testconcept`) and generate the graph structure.

```bash
# Install dependencies
npm install

# Build the graph (Enable inference in src/backend/config.ts)
npx ts-node src/index.ts
```

### 2. Visualize
Open `src/frontend/index.html` in your modern web browser (Chrome/Edge/Firefox).

*   **View Mode**: Toggle between **Nodes** (Detailed) and **Clusters** (Overview).
*   **Layout**: Switch between **Force** (Physics) and **DAG** (Hierarchy).
*   **Filter**: Use the Analysis Panel to find "Hub" nodes.

---
---

# 2025-12-21 v0.6.5

# NoteConnection: 层级知识图谱可视化系统
> **解锁你知识库的深层结构。**

**NoteConnection** 是一个高性能的独立可视化系统，旨在将非结构化的 Markdown 知识库转化为**有向无环图 (DAG)**。

与展示杂乱链接网的传统“网络”视图不同，NoteConnection 揭示了隐藏在笔记中的**层级关系**、**学习路径**和**依赖结构**。它专为可扩展性而设计，能够轻松处理数万个节点，并且完全独立于任何特定的笔记应用程序运行。
<img width="2784" height="2034" alt="image" src="https://github.com/user-attachments/assets/0ea42609-4296-42ea-978d-c6cb7d448068" />

---

## 🌟 核心特性 (v0.6.5)

### 1. 结构优于混沌 (DAG vs. 力导向)
*   **有向依赖**: 识别“先决条件”和“后续步骤”，将概念按逻辑分层排列。
*   **Sugiyama 布局**: 渲染清晰的自上而下的层级结构，而非混乱的毛线球。

### 2. 可扩展的语义缩放 (Semantic Zoom)
*   **聚类视图**: 基于文件夹结构或标签，将数千个节点聚合为高级“概念气泡”。
*   **向下钻取**: 点击聚类即可放大并探索该特定领域内的详细连接。
<img width="3404" height="2028" alt="image" src="https://github.com/user-attachments/assets/39ea71da-be14-4fdc-9fec-9f33cab92e1b" />

### 3. 智能推断引擎 (无需 AI)
*   **统计关联**: 使用条件概率 ($P(A|B)$) 推断隐藏的依赖关系（例如，“荧光”隐含“光子”），无需外部 LLM API。
*   **向量相似度**: 使用 TF-IDF 和余弦相似度发现相关概念，即使没有显式链接。
*   **混合分析**: 结合显式链接 (`[[WikiLink]]`)、YAML 元数据 (`prerequisites:`) 和统计/向量模式。
<img width="3723" height="2007" alt="image" src="https://github.com/user-attachments/assets/10978984-3e2d-4ab6-8b44-342d4f3c3800" />

### 4. 交互式专注模式 (Focus Mode - v0.6.5)
*   **深度探索**: 点击任意节点以隔离它及其直接上下文。
*   **智能布局**: 自动排列**上级**（出度）和**下级**（入度），并基于相关性进行相对高度定位。
*   **清晰可视化**: 使用交错定位防止标签重叠，并高亮显示高价值路径。

### 5. 跨平台与面向未来
*   **纯 TypeScript**: 直接在文件系统上运行。
*   **数据主权**: 将图谱导出为 JSON, SVG 或 ZIP。
*   **双语支持**: 原生支持**英文**和**中文**。

---

## 快速开始

### 1. 构建图谱
运行后端以扫描您的笔记（默认：`testconcept`）并生成图结构。

```bash
# 安装依赖
npm install

# 构建图谱 (可在 src/backend/config.ts 中启用推断)
npx ts-node src/index.ts
```

### 2. 可视化
在现代浏览器 (Chrome/Edge/Firefox) 中打开 `src/frontend/index.html`。

*   **视图模式**: 在**节点** (详细) 和 **聚类** (概览) 之间切换。
*   **布局**: 在 **Force** (力导向) 和 **DAG** (层级) 之间切换。
*   **过滤**: 使用分析面板查找“枢纽”节点。

# 2025-12-19 v0.4.1

# NoteConnection: Hierarchical Knowledge Graph Visualization System
> **Unlock the Structure of Your Knowledge.**

**NoteConnection** is a high-performance, standalone visualization system engineered to transform unstructured Markdown knowledge bases into **Directed Acyclic Graphs (DAGs)**.

Unlike traditional "network" views that show a messy web of links, NoteConnection reveals the **hierarchy**, **learning paths**, and **dependency structures** hidden within your notes. It is built for scalability, capable of handling tens of thousands of nodes with ease, and operates completely independently of any specific note-taking app (Obsidian, Joplin, Logseq, etc.).

---

## 🌟 Why NoteConnection?

### 1. Structure Over Chaos (DAG vs. Force)
Most tools generate "spaghetti graphs" where links are undirected wires. NoteConnection treats knowledge as a **Directed Acyclic Graph (DAG)**. It identifies "Prerequisites" and "Next Steps" to arrange your concepts in logical, hierarchical layers—turning a web of confusion into a clear roadmap.

### 2. Platform Agnostic & Future-Proof
Your knowledge shouldn't be locked into a plugin ecosystem. NoteConnection is a **pure TypeScript/Node.js** application. It works with *any* folder of text files. If you switch from Obsidian to VS Code or Notion (exported), your graph visualization remains consistent and powerful.

### 3. Scalability First
Designed for "Knowledge Heavyweights". While other plugins lag with 1,000 notes, NoteConnection is optimized for **10,000+ nodes**, featuring advanced clustering, semantic zooming (roadmap v0.5.0), and WebGL/Canvas hybrid rendering support.

---

## Key Features

*   **🚀 Standalone Powerhouse**: No dependencies on Obsidian/Joplin APIs. Runs directly on your file system.
*   **🌐 Bilingual Native**: Built from the ground up for **English** and **Chinese (Simplified)** users.
*   **⚙️ Algorithmic Intelligence (v0.3.0)**:
    *   **Cycle Detection**: Auto-detects logical loops (A->B->A) to maintain graph integrity.
    *   **Topological Ranking**: Automatically calculates the "Learning Level" of every concept.
*   **🎨 Visualization Engine (v0.4.0)**:
    *   **DAG Layout**: Sugiyama-style layered view to visualize top-down dependencies.
    *   **Bezier Flow**: Smooth S-curves clearly indicate the direction of knowledge flow.
    *   **Dual Modes**: Instantly switch between "Force-Directed" (Clustering) and "DAG" (Hierarchy).
*   **🔗 Smart Parsing**:
    *   **Frontmatter**: Reads `prerequisites`, `next`, and `tags` from YAML.
    *   **WikiLinks**: Supports standard `[[Link]]` syntax.
*   **📊 Deep Analysis**:
    *   **Degree Histograms**: Identify your knowledge "Hubs" and "Leafs".
    *   **Interactive Filtering**: Filter by Degree, Cluster, or Search terms.
*   **💾 Data Sovereignty**:
    *   **Export**: Save filtered sub-graphs as JSON or ZIP archives.
    *   **Snapshot**: Export high-res SVG images for presentations.

---

## Project Structure

*   `src/backend`: **The Brain**. Handles file I/O, parsing, graph construction, cycle detection, and topological sorting.
*   `src/frontend`: **The Face**. A high-performance D3.js interactive visualization engine.
*   `testconcept`: A built-in dataset of scientific concepts for testing and demonstration.

---

## Quick Start

### 1. Build the Graph
Run the backend to scan your notes (default: `testconcept`) and generate the graph structure.

```bash
# Install dependencies
npm install

# Build the graph
npx ts-node src/index.ts
```

### 2. Visualize
Open `src/frontend/index.html` in your modern web browser (Chrome/Edge/Firefox).

*   **Drag**: Rearrange nodes.
*   **Click**: Highlight connections and see details.
*   **Panel**: Use the floating panel to switch Layouts (Force/DAG), filter nodes, or analyze statistics.

---
---

# NoteConnection: 层级知识图谱可视化系统
> **解锁你知识库的深层结构。**

**NoteConnection** 是一个高性能的独立可视化系统，旨在将非结构化的 Markdown 知识库转化为**有向无环图 (DAG)**。

与展示杂乱链接网的传统“网络”视图不同，NoteConnection 揭示了隐藏在笔记中的**层级关系**、**学习路径**和**依赖结构**。它专为可扩展性而设计，能够轻松处理数万个节点，并且完全独立于任何特定的笔记应用程序（如 Obsidian, Joplin, Logseq 等）运行。

---

## 🌟 为什么选择 NoteConnection?

### 1. 结构优于混沌 (DAG vs. 力导向)
大多数工具生成的都是“意大利面条式”的图表，链接没有方向。NoteConnection 将知识视为**有向无环图 (DAG)**。它识别“先决条件”和“后续步骤”，将您的概念按逻辑分层排列——将混乱的网络转化为清晰的学习路线图。

### 2. 跨平台与面向未来
您的知识不应被锁定在插件生态系统中。NoteConnection 是一个**纯 TypeScript/Node.js** 应用程序。它适用于*任何*文本文件夹。如果您从 Obsidian 切换到 VS Code 或 Notion（导出），您的图谱可视化依然保持一致且强大。

### 3. 扩展性优先
专为“重度知识用户”设计。当其他插件在处理 1,000 个笔记时卡顿时，NoteConnection 已针对 **10,000+ 节点**进行了优化，支持高级聚类、语义缩放（路线图 v0.5.0）和 WebGL/Canvas 混合渲染支持。

---

## 核心特性

*   **🚀 独立运行**: 不依赖 Obsidian/Joplin API。直接在文件系统上运行。
*   **🌐 原生双语**: 从底层支持**英文**和**中文（简体）**用户。
*   **⚙️ 算法智能 (v0.3.0)**:
    *   **循环检测**: 自动检测逻辑循环 (A->B->A) 以维护图的完整性。
    *   **拓扑分级**: 自动计算每个概念的“学习层级”。
*   **🎨 可视化引擎 (v0.4.0)**:
    *   **DAG 布局**: Sugiyama 风格的分层视图，可视化自上而下的依赖关系。
    *   **贝塞尔流**: 平滑的 S 形曲线清晰地指示知识流动的方向。
    *   **双模式**: 在“力导向”（聚类）和“DAG”（层级）模式之间即时切换。
*   **🔗 智能解析**:
    *   **Frontmatter**: 从 YAML 读取 `prerequisites` (先决条件), `next` (后续), 和 `tags`。
    *   **WikiLinks**: 支持标准 `[[Link]]` 语法。
*   **📊 深度分析**:
    *   **度数直方图**: 识别您的知识“枢纽”和“叶子”。
    *   **交互式过滤**: 按度数、聚类或搜索词过滤。
*   **💾 数据主权**:
    *   **导出**: 将过滤后的子图保存为 JSON 或 ZIP 归档。
    *   **快照**: 导出用于演示的高分辨率 SVG 图像。

---

## 项目结构

*   `src/backend`: **大脑**。处理文件 I/O、解析、图构建、循环检测和拓扑排序。
*   `src/frontend`: **面孔**。高性能 D3.js 交互式可视化引擎。
*   `testconcept`: 内置的科学概念数据集，用于测试和演示。

---

## 快速开始

### 1. 构建图谱
运行后端以扫描您的笔记（默认：`testconcept`）并生成图结构。

```bash
# 安装依赖
npm install

# 构建图谱
npx ts-node src/index.ts
```

### 2. 可视化
在现代浏览器 (Chrome/Edge/Firefox) 中打开 `src/frontend/index.html`。

*   **拖动**: 重新排列节点。
*   **点击**: 高亮连接并查看详情。
*   **面板**: 使用浮动面板切换布局 (Force/DAG)、过滤节点或分析统计数据。
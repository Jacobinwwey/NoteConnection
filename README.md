# 2025-12-19 v0.2.0

# NoteConnection: Hierarchical Knowledge Graph Visualization System

**NoteConnection** is a robust, standalone system designed to visualize tens of thousands of knowledge points as a Directed Acyclic Graph (DAG). Unlike simple link visualizers, it emphasizes **hierarchical relationships**, **learning paths**, and **structural analysis** of your knowledge base. It operates independently of any specific note-taking application (like Obsidian or Joplin), providing a pure, data-driven visualization solution.

## Key Features

*   **🚀 Platform Independent**: Pure TypeScript/Node.js implementation. Works with any folder of Markdown files. No plugin dependencies required.
*   **🌐 Bilingual UI & Documentation**: Full support for **English** and **Chinese (Simplified)** in both the user interface and all documentation.
*   **🔗 Directional Parsing (New v0.2.0)**:
    *   **Explicit Dependencies**: Parses `prerequisites` and `next` fields from YAML Frontmatter to create directed edges.
    *   **Metadata Extraction**: Robustly extracts tags and WikiLinks for structured graph building.
*   **📊 Advanced Degree Analysis**:
    *   **In-Degree/Out-Degree Visualization**: Distinguish between "Prerequisite" (In) and "Derived" (Out) connections.
    *   **Degree Distribution**: View histograms of node connectivity to identify hubs.
*   **🧠 Intelligent Graph Construction**:
    *   **Keyword Matching**: Configurable exact or fuzzy matching to discover implicit connections.
    *   **Community Detection**: Automatic clustering (Label Propagation) to color-code related concepts.
    *   **Centrality Metrics**: Size nodes based on Betweenness Centrality to highlight critical bridges.
*   **💾 Flexible Export & Persistence**:
    *   **Interactive Export**: Export filtered subsets (e.g., Top 10%) to **JSON** (with full edge context) or **ZIP** (Markdown files).
    *   **SVG Snapshot**: High-quality vector export for presentations.
    *   **Layout Saving**: Persist your manual node arrangements.

## Project Structure

*   `src/backend`: Core logic for file loading, parsing, graph construction, and metric calculation.
*   `src/frontend`: Interactive Web Visualization using D3.js.
*   `testconcept`: Sample knowledge base for testing and demonstration.

## Quick Start

### 1. Build the Graph

Run the backend script to scan the `testconcept` directory (or configure your own) and generate the graph data.

```bash
# Install dependencies
npm install

# Build the graph
npx ts-node src/index.ts
```

### 2. Visualize

Open `src/frontend/index.html` in your web browser.

*   **Nodes**: Drag to rearrange. Click to highlight connections.
*   **Controls**: Use the panel to filter by degree, switch coloring modes (Degree/Cluster), or change the language.
*   **Analysis**: Click "Analysis & Export" to open the detailed statistical panel.

---

# NoteConnection: 层级知识图谱可视化系统

**NoteConnection** 是一个健壮的独立系统，旨在将数万个知识点可视化为有向无环图 (DAG)。与简单的链接可视化工具不同，它强调知识库的**层级关系**、**学习路径**和**结构分析**。它独立于任何特定的笔记应用程序（如 Obsidian 或 Joplin）运行，提供纯粹的数据驱动可视化解决方案。

## 核心特性

*   **🚀 平台独立**: 纯 TypeScript/Node.js 实现。适用于任何 Markdown 文件夹。无需依赖特定插件。
*   **🌐 双语 UI 与文档**: 用户界面和所有文档均完全支持**英文**和**中文（简体）**。
*   **🔗 定向解析 (v0.2.0 新增)**:
    *   **显式依赖**: 解析 YAML Frontmatter 中的 `prerequisites` (先决条件) 和 `next` (后续) 字段以创建有向边。
    *   **元数据提取**: 稳健地提取标签和 WikiLinks 以用于结构化图构建。
*   **📊 高级度数分析**:
    *   **入度/出度可视化**: 区分“先决条件”（入度）和“派生概念”（出度）连接。
    *   **度数分布**: 查看节点连接性的直方图以识别核心枢纽。
*   **🧠 智能图构建**:
    *   **关键词匹配**: 可配置的精确或模糊匹配以发现隐式连接。
    *   **社区检测**: 自动聚类（标签传播）以对相关概念进行颜色编码。
    *   **中心性指标**: 基于介数中心性调整节点大小，以突出关键桥梁。
*   **💾 灵活导出与持久化**:
    *   **交互式导出**: 将过滤后的子集（例如 Top 10%）导出为 **JSON**（包含完整边上下文）或 **ZIP**（Markdown 文件）。
    *   **SVG 快照**: 用于演示的高质量矢量导出。
    *   **布局保存**: 持久化您的手动节点排列。

## 项目结构

*   `src/backend`: 文件加载、解析、图构建和指标计算的核心逻辑。
*   `src/frontend`: 使用 D3.js 的交互式 Web 可视化。
*   `testconcept`: 用于测试和演示的示例知识库。

## 快速开始

### 1. 构建图谱

运行后端脚本以扫描 `testconcept` 目录（或配置您自己的目录）并生成图数据。

```bash
# 安装依赖
npm install

# 构建图谱
npx ts-node src/index.ts
```

### 2. 可视化

在浏览器中打开 `src/frontend/index.html`。

*   **节点**: 拖动以重新排列。点击以高亮显示连接。
*   **控件**: 使用面板按度数过滤、切换着色模式（度数/聚类）或更改语言。
*   **分析**: 点击“分析与导出” (Analysis & Export) 以打开详细的统计面板。
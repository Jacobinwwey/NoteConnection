# 2025-12-19 v0.4.0

# Project Build Plan: Progressive Hierarchical Knowledge Graph

This document outlines the roadmap for building `NoteConnection`, a system capable of visualizing tens of thousands of knowledge points as a Directed Acyclic Graph (DAG), highlighting hierarchical relationships and learning paths.

---

### 2025-12-17 v0.1.0 - Foundation & Data Structures

**Goal**: Establish the standalone project environment and core data structures for a Directed Graph, independent of specific note-taking app APIs initially.

- [x] **Project Initialization**
    - [x] Initialize a new TypeScript/Node.js project in `NoteConnection`.
    - [x] Configure ESLint, Prettier, and Jest for testing.

- [x] **Graph Core Implementation**
    - [x] Implement `Node` and `Edge` interfaces supporting metadata (e.g., `rank`, `clusterId`).
    - [x] Implement a `Graph` class with methods: `addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`.

### 2026-01-15 v0.2.0 - Data Ingestion & Directional Parsing

**Goal**: Ingest data from Markdown files, specifically parsing frontmatter for directional dependencies.

- [x] **Markdown Parser Service**
    - [x] Implement a file system reader to scan directories recursively.
    - [x] Create a regex or AST-based parser to extract YAML frontmatter.

- [x] **Dependency Extraction**
    - [x] Define the schema: `prerequisites: [[Note A]]`, `next: [[Note B]]`.
    - [x] Logic to convert these metadata fields into directed edges in the `Graph` object.

### 2026-02-01 v0.3.0 - Algorithmic Core (DAG Logic)

**Goal**: Ensure the graph is a valid DAG and calculate hierarchical layout positions.

- [x] **Cycle Detection & Resolution**
    - [x] Implement DFS-based cycle detection.
    - [x] Strategy: Report cycles to the user (Console Warning).

- [x] **Topological Sorting & Ranking**
    - [x] Implement algorithms to assign a `rank` (0, 1, 2...) to every node.
    - [x] Ensure nodes with no dependencies are Rank 0.
    - [x] Integrated Kahn's Algorithm variant for Longest Path layering.

### 2026-03-01 v0.4.0 - Visualization Engine

**Goal**: Render the processed graph in a web view using a layered layout engine (Sugiyama-style).

- [x] **Layout Engine Integration**
    - [x] Implement "Layout Mode" switch in UI (Force vs DAG).
    - [x] Map `rank` to Y-coordinates in the visualization.

- [x] **Canvas/SVG Rendering**
    - [x] Optimize rendering for hierarchical structures.
    - [x] Draw curved bezier lines for dependencies to indicate flow direction clearly.

### 2026-04-01 v0.5.0 - Scalability (Clustering)

**Goal**: Handle 10,000+ nodes by grouping them into high-level clusters.

- [ ] **Clustering Algorithm**
    - Implement grouping logic based on Folder paths (e.g., "Physics/Mechanics" -> Cluster "Mechanics").
    - Optional: Louvain community detection for tag-based clusters.

- [ ] **Semantic Zoom / Drill-down**
    - Render "Super Nodes" (Clusters) at low zoom levels.
    - Expand to show detailed dependency graphs when a cluster is clicked.

### 2026-05-01 v0.6.0 - Hybrid Inference Strategy (AI & Stats)

**Goal**: Combine statistical and vectorized methods to infer dependencies and associations where explicit metadata is missing.

- [ ] **Vector-based Association (Similarity)**
    - Implement embedding generation (using local models or APIs similar to `obsidian-smart-connections`).
    - Use Cosine Similarity to determine the strength of **association** (undirected relationship) between concepts.

- [ ] **Statistical Dependency Inference**
    - Calculate **Co-occurrence Frequency** and **Conditional Probability** ($P(B|A)$) across the note corpus.
    - Hypothesis: If A frequently appears before B or in the context of defining B, A might be a dependency.

- [ ] **Hybrid Judgment Engine**
    - Combine Vector Similarity (for relevance) + Statistical Probability (for direction) + LLM Verification (for final check).
    - Rule: If `Similarity(A, B) > Threshold` AND `P(B|A) >> P(A|B)`, suggest edge `A -> B`.

- [ ] **AI Inference Service (LLM Verification)**
    - Use LLMs to verify high-confidence candidates from the hybrid engine.
    - Task: "Given statistical evidence, confirm if A is a prerequisite for B."

### 2026-06-01 v1.0.0 - Production Release

**Goal**: Complete integration with Joplin/Obsidian plugins and polish UX.

- [ ] **Plugin Wrapper**
    - Wrap the `NoteConnection` core logic into a Joplin Plugin and an Obsidian Plugin.

- [ ] **User Settings & Documentation**
    - Finalize configuration options (colors, exclusion rules).
    - Publish user manual.

---

# 项目构建计划：渐进式层级知识图谱

本文档概述了构建 `NoteConnection` 的路线图，该系统能够将数万个知识点可视化为有向无环图 (DAG)，重点突出层级关系和学习路径。

---

### 2025-12-17 v0.1.0 - 基础与数据结构 (Foundation & Data Structures)

**目标**: 建立独立的项目环境和有向图的核心数据结构，初期独立于特定的笔记应用 API。

- [x] **项目初始化**
    - [x] 在 `NoteConnection` 中初始化一个新的 TypeScript/Node.js 项目。
    - [x] 配置 ESLint, Prettier 和 Jest 用于测试。

- [x] **图核心实现**
    - [x] 实现支持元数据（如 `rank`, `clusterId`）的 `Node` 和 `Edge` 接口。
    - [x] 实现 `Graph` 类，包含方法：`addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`。

### 2026-01-15 v0.2.0 - 数据摄取与定向解析 (Data Ingestion & Directional Parsing)

**目标**: 从 Markdown 文件中摄取数据，专门解析 Frontmatter 中的定向依赖关系。

- [x] **Markdown 解析服务**
    - [x] 实现文件系统读取器以递归扫描目录。
    - [x] 创建基于正则或 AST 的解析器以提取 YAML Frontmatter。

- [x] **依赖提取**
    - [x] 定义模式：`prerequisites: [[Note A]]`, `next: [[Note B]]`。
    - [x] 将这些元数据字段转换为 `Graph` 对象中的有向边的逻辑。

### 2026-02-01 v0.3.0 - 算法核心 (DAG 逻辑) (Algorithmic Core)

**目标**: 确保图是有效的 DAG 并计算层级布局位置。

- [x] **循环检测与解决**
    - [x] 实现基于 DFS 的循环检测。
    - [x] 策略：向用户报告循环或自动打破循环（控制台警告）。

- [x] **拓扑排序与排名**
    - [x] 实现算法为每个节点分配 `rank` (0, 1, 2...)。
    - [x] 确保没有依赖关系的节点为 Rank 0。
    - [x] 集成 Kahn 算法变体（最长路径分层）。

### 2026-03-01 v0.4.0 - 可视化引擎 (Visualization Engine)

**目标**: 使用分层布局引擎（Sugiyama 风格）在 Web 视图中渲染处理后的图。

- [x] **布局引擎集成**
    - [x] 在 UI 中实现“布局模式”切换（力导向 vs DAG 分层）。
    - [x] 将 `rank` 映射到可视化中的 Y 坐标。

- [x] **Canvas/SVG 渲染**
    - [x] 优化层级结构的渲染。
    - [x] 为依赖关系绘制弯曲的贝塞尔线，以清晰指示流向。

### 2026-04-01 v0.5.0 - 可扩展性 (聚类) (Scalability)

**目标**: 通过将节点分组为高级聚类来处理 10,000+ 节点。

- [ ] **聚类算法**
    - 实现基于文件夹路径的分组逻辑（例如 "Physics/Mechanics" -> 聚类 "Mechanics"）。
    - 可选：用于基于标签的聚类的 Louvain 社区检测。

- [ ] **语义缩放/向下钻取**
    - 在低缩放级别渲染“超级节点”（聚类）。
    - 点击聚类时展开显示详细的依赖图。

### 2026-05-01 v0.6.0 - 混合推断策略 (AI 与统计) (Hybrid Inference Strategy)

**目标**: 结合统计和向量化方法，在缺乏显式元数据的情况下推断依赖关系和关联。

- [ ] **基于向量的关联 (Similarity)**
    - 实现嵌入生成（使用类似于 `obsidian-smart-connections` 的本地模型或 API）。
    - 使用余弦相似度确定概念之间**关联**（无向关系）的强度。

- [ ] **统计依赖推断**
    - 计算笔记语料库中的**共现频率**和**条件概率** ($P(B|A)$)。
    - 假设：如果 A 经常出现在 B 之前或在定义 B 的上下文中，则 A 可能是依赖项。

- [ ] **混合判断引擎**
    - 结合向量相似度（用于相关性）+ 统计概率（用于方向）+ LLM 验证（用于最终检查）。
    - 规则：如果 `Similarity(A, B) > Threshold` 且 `P(B|A) >> P(A|B)`，则建议边 `A -> B`。

- [ ] **AI 推断服务 (LLM 验证)**
    - 使用 LLM 验证来自混合引擎的高置信度候选项。
    - 任务：“给定统计证据，确认 A 是否为 B 的先决条件。”

### 2026-06-01 v1.0.0 - 正式发布 (Production Release)

**目标**: 完成与 Joplin/Obsidian 插件的集成并打磨用户体验。

- [ ] **插件封装**
    - 将 `NoteConnection` 核心逻辑封装为 Joplin 插件和 Obsidian 插件。

- [ ] **用户设置与文档**
    - 确定配置选项（颜色、排除规则）。
    - 发布用户手册。
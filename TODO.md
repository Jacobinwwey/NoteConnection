# 2025-12-23 v0.8.6

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

- [x] **Focus Mode (v0.6.2)**
    - [x] **Interactive Focus**: Click node to center and isolate context.
    - [x] **Hierarchical Layout**: Auto-arrange Superiors (Out-degree) and Subordinates (In-degree) in layers.
    - [x] **Intra-layer Sorting**: Sort neighbors by importance (Degree Ratio).
    - [x] **Context Filtering**: Show only direct neighbors and high-correlation nodes.
    - [x] **Layout Optimization**: 
        - [x] Relative Height Positioning based on criteria (Score).
        - [x] Staggered Label Placement to prevent overlap.
        - [x] Fix: Prevents node accumulation when switching context within Focus Mode.

### 2026-04-01 v0.5.0 - Scalability (Clustering)

**Goal**: Handle 10,000+ nodes by grouping them into high-level clusters based on File Structure or Semantic Tags.

- [x] **Clustering Logic**
    - [x] Implement **Folder-based Clustering**: Parse directory structure (e.g., `Physics/Mechanics` -> Cluster `Mechanics`).
    - [x] Add Configuration Strategy: Switch between `Label Propagation` (current) and `Folder Path` for `clusterId` assignment.

- [x] **Semantic Zoom / Drill-down**
    - [x] Render "Super Nodes" (Clusters) at low zoom levels (Implemented as "Cluster View" toggle).
    - [x] Expand to show detailed dependency graphs when a cluster is clicked (Drill-down via Filter).

### 2026-05-01 v0.6.0 - Hybrid Inference Strategy (AI & Stats)

**Goal**: Combine statistical and vectorized methods to infer dependencies and associations where explicit metadata is missing.

- [x] **Vector-based Association (Similarity)**
    - [x] Implement embedding generation (using local TF-IDF VectorSpace).
    - [x] Use Cosine Similarity to determine the strength of **association** (undirected relationship) between concepts.

- [x] **Statistical Dependency Inference**
    - [x] Calculate **Co-occurrence Frequency** and **Conditional Probability** ($P(B|A)$) across the note corpus.
    - [x] Hypothesis: If A frequently appears before B or in the context of defining B, A might be a dependency.

- [x] **Hybrid Judgment Engine (v0.6.5)**
    - [x] Combine Vector Similarity (for relevance) + Statistical Probability (for direction).
    - [x] Rule: If `Similarity(A, B) > Threshold` AND `P(B|A) >> P(A|B)`, suggest edge `A -> B`.

- [ ] **AI Inference Service (LLM Verification)**
    - Use LLMs to verify high-confidence candidates from the hybrid engine.
    - Task: "Given statistical evidence, confirm if A is a prerequisite for B."

### 2025-12-22 v0.8.5 - Dynamic Data Source & Server

**Goal**: Support dynamic selection of knowledge base folders and independent server deployment.

- [x] **Dynamic Path Selection**
    - [x] Backend: Support variable input paths under `Knowledge_Base`.
    - [x] Server: Implement `http` server for API (`/api/folders`, `/api/build`) and static serving.
    - [x] Frontend: Add UI to list and select knowledge base folders.

### 2025-12-23 v0.8.6 - Performance Optimization (Parallel Processing)

**Goal**: Optimize graph construction for large datasets (>10,000 nodes) to reduce build time.

- [x] **Parallel Graph Building**
    - [x] **Worker Threads**: Offload intensive keyword matching to multiple CPU cores.
    - [x] **Async I/O**: Refactor `FileLoader` to use asynchronous batch processing to prevent `EMFILE` errors.
    - [x] **Robustness**: Implement fallback to sequential processing if workers fail.

### 2025-12-23 v0.8.7 - Scalability & UX Polish

**Goal**: Address rendering bottlenecks and improve layout control for large graphs.

- [x] **High-Capacity Processing**
    - [x] **Worker Scaling**: Increased thread limit to 12.
- [x] **Canvas Rendering**
    - [x] **Dual Engine**: implemented Canvas renderer for high-performance drawing of 10k+ nodes.
- [x] **Focus Mode UX**
    - [x] **Spacing Control**: Added UI slider to adjust node layer spacing.

### 2025-12-23 v0.8.8 - Scalability Defaults & Advanced Layout

**Goal**: Optimize default view for massive graphs and refine Focus Mode layout.

- [x] **Scalability Defaults**
    - [x] **Clutter Reduction**: Edges hidden by default; Orphans hidden by default.
    - [x] **On-Demand Context**: Relationships revealed on Hover or Focus.
- [x] **Focus Mode Enhancements**
    - [x] **Horizontal Spacing**: Added control for horizontal node separation to prevent overlap.

### 2025-12-23 v0.8.9 - Stability Improvements

**Goal**: Enhance observation stability.

- [x] **Interaction Stability**
    - [x] **Freeze**: Prevent node drift when selecting or dragging in Focus Mode.

### 2026-06-01 v1.0.0 - Production Release

**Goal**: Complete integration with Joplin/Obsidian plugins and polish UX.

- [ ] **Plugin Wrapper**
    - Wrap the `NoteConnection` core logic into a Joplin Plugin and an Obsidian Plugin.

- [x] **User Settings & Documentation (v0.7.0)**
    - [x] **Settings Manager**: Centralized management of application state (Physics, Visuals) with `localStorage` persistence.
    - [x] **Configuration UI**: Settings Modal for tuning Graph Physics (Gravity, Repulsion) and Visual preferences.
    - [x] **Reading Window (v0.8.0)**
        - [x] **Trigger**: Click focused node to open.
        - [x] **Content**: Renders Markdown, KaTeX (Math), Mermaid (Diagrams).
        - [x] **Interaction**: Zoom text and Resize images (Unlocked mode).
        - [x] **Config**: Window/Fullscreen toggle.
    - [ ] **Finalize Documentation**: Complete User Manual and Developer Guide.
    - [ ] **Final Polish & Demo Packaging**: Ensure zero-config startup (`npm start`) works seamlessly for promotion.
    - [ ] **Release**: Package for v1.0.0.

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

- [x] **专注模式 (Focus Mode - v0.6.2)**
    - [x] **交互式专注**: 点击节点以居中并隔离上下文。
    - [x] **层级布局**: 自动将上级（出度）和下级（入度）排列在分层中。
    - [x] **层内排序**: 按重要性（度数比）对邻居进行排序。
    - [x] **上下文过滤**: 仅显示直接邻居和高相关性节点。
    - [x] **布局优化**:
        - [x] 基于标准（分数）的相对高度定位。
        - [x] 交错标签放置以防止重叠。
        - [x] 修复: 防止在专注模式内切换上下文时节点累积。

### 2026-04-01 v0.5.0 - 可扩展性 (聚类) (Scalability)

**目标**: 通过基于文件结构或语义标签将节点分组为高级聚类，以处理 10,000+ 节点。

- [x] **聚类逻辑**
    - [x] 实现**基于文件夹的聚类**: 解析目录结构（例如 `Physics/Mechanics` -> 聚类 `Mechanics`）。
    - [x] 添加配置策略: 在 `clusterId` 分配的 `标签传播` (当前) 和 `文件夹路径` 之间切换。

- [x] **语义缩放/向下钻取**
    - [x] 在低缩放级别渲染“超级节点”（聚类）（实现为“聚类视图”切换）。
    - [x] 点击聚类时展开显示详细的依赖图（通过过滤器向下钻取）。

### 2026-05-01 v0.6.0 - 混合推断策略 (AI 与统计) (Hybrid Inference Strategy)

**目标**: 结合统计和向量化方法，在缺乏显式元数据的情况下推断依赖关系和关联。

- [x] **基于向量的关联 (Similarity)**
    - [x] 实现嵌入生成（使用本地 TF-IDF VectorSpace）。
    - [x] 使用余弦相似度确定概念之间**关联**（无向关系）的强度。

- [x] **统计依赖推断**
    - [x] 计算笔记语料库中的**共现频率**和**条件概率** ($P(B|A)$)。
    - [x] 假设：如果 A 经常出现在 B 之前或在定义 B 的上下文中，则 A 可能是依赖项。

- [x] **混合判断引擎 (Hybrid Judgment Engine - v0.6.5)**
    - [x] 结合向量相似度（用于相关性）+ 统计概率（用于方向）。
    - [x] 规则：如果 `Similarity(A, B) > Threshold` 且 `P(B|A) >> P(A|B)`，则建议边 `A -> B`。

- [ ] **AI 推断服务 (LLM 验证)**
    - 使用 LLM 验证来自混合引擎的高置信度候选项。
    - 任务：“给定统计证据，确认 A 是否为 B 的先决条件。”

### 2025-12-22 v0.8.5 - 动态数据源与服务器 (Dynamic Data Source & Server)

**目标**: 支持动态选择知识库文件夹和独立服务器部署。

- [x] **动态路径选择**
    - [x] 后端: 支持 `Knowledge_Base` 下的可变输入路径。
    - [x] 服务器: 实现用于 API (`/api/folders`, `/api/build`) 和静态服务的 `http` 服务器。
    - [x] 前端: 添加 UI 以列出和选择知识库文件夹。

### 2025-12-23 v0.8.6 - 性能优化 (并行处理) (Performance Optimization)

**目标**: 优化大数据集 (>10,000 节点) 的图构建过程，以缩短构建时间。

- [x] **并行图构建**
    - [x] **Worker 线程**: 将密集的关键词匹配任务分流到多个 CPU 核心。
    - [x] **异步 I/O**: 重构 `FileLoader` 使用异步批量处理以防止 `EMFILE` 错误。
    - [x] **稳健性**: 实现 Worker 失败时的顺序处理回退机制。

### 2025-12-23 v0.8.7 - 可扩展性与用户体验打磨 (Scalability & UX Polish)

**目标**: 解决渲染瓶颈并改进大图的布局控制。

- [x] **高容量处理**
    - [x] **Worker 扩展**: 将线程限制增加到 12。
- [x] **Canvas 渲染**
    - [x] **双引擎**: 实现了 Canvas 渲染器，用于 10k+ 节点的高性能绘制。
- [x] **专注模式 UX**
    - [x] **间距控制**: 添加了 UI 滑块以调整节点层间距。

### 2025-12-23 v0.8.8 - 可扩展性默认值与高级布局 (Scalability Defaults & Advanced Layout)

**目标**: 优化大规模图谱的默认视图并完善专注模式布局。

- [x] **可扩展性默认值**
    - [x] **减少杂乱**: 默认隐藏边和孤立节点。
    - [x] **按需上下文**: 仅在悬停或专注时显示关系。
- [x] **专注模式增强**
    - [x] **水平间距**: 添加了水平节点分隔控制以防止重叠。

### 2025-12-23 v0.8.9 - 稳定性改进 (Stability Improvements)

**目标**: 增强观察稳定性。

- [x] **交互稳定性**
    - [x] **冻结**: 防止在专注模式下选择或拖动时节点漂移。

### 2026-06-01 v1.0.0 - 正式发布 (Production Release)

**目标**: 完成与 Joplin/Obsidian 插件的集成并打磨用户体验。

- [ ] **插件封装**
    - 将 `NoteConnection` 核心逻辑封装为 Joplin 插件和 Obsidian 插件。

- [ ] **用户设置与文档 (User Settings & Documentation - v0.7.0)**
    - [x] **设置管理器**: 集中管理应用状态（物理、视觉），支持 `localStorage` 持久化。
    - [x] **配置 UI**: 用于调整图谱物理（重力、排斥力）和视觉偏好的设置模态框。
    - [x] **阅读窗口 (Reading Window - v0.8.0)**
        - [x] **触发**: 点击焦点节点以打开。
        - [x] **内容**: 渲染 Markdown, KaTeX (数学), Mermaid (图表)。
        - [x] **交互**: 缩放文本和调整图片大小（解锁模式）。
        - [x] **配置**: 窗口/全屏切换。
    - [ ] **完善文档**: 完成用户手册和开发人员指南。
    - [ ] **最终打磨与演示打包**: 确保零配置启动 (`npm start`) 无缝工作以用于推广。
    - [ ] **发布**: 打包 v1.0.0。
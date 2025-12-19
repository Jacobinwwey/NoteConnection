# 2025-12-19 v0.1.4

# Project Build Plan: Progressive Hierarchical Knowledge Graph

This document outlines the roadmap for building `NoteConnection`, a system capable of visualizing tens of thousands of knowledge points as a Directed Acyclic Graph (DAG), highlighting hierarchical relationships and learning paths.

---

### 2025-12-17 v0.1.0 - Foundation & Data Structures

**Goal**: Establish the standalone project environment and core data structures for a Directed Graph, independent of specific note-taking app APIs initially.

- [x] **Project Initialization**
    - Initialize a new TypeScript/Node.js project in `NoteConnection`.
    - Configure ESLint, Prettier, and Jest for testing.

- [x] **Graph Core Implementation**
    - Implement `Node` and `Edge` interfaces supporting metadata (e.g., `rank`, `clusterId`).
    - Implement a `Graph` class with methods: `addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`.

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

- [ ] **Cycle Detection & Resolution**
    - Implement DFS-based cycle detection.
    - Strategy: Report cycles to the user or automatically break them (e.g., remove the edge pointing to the deepest node).

- [ ] **Topological Sorting & Ranking**
    - Implement algorithms to assign a `rank` (0, 1, 2...) to every node.
    - Ensure nodes with no dependencies are Rank 0.

### 2026-03-01 v0.4.0 - Visualization Engine

**Goal**: Render the processed graph in a web view using a layered layout engine.

- [ ] **Layout Engine Integration**
    - Evaluate and integrate `d3-dag` or `dagre` for coordinate calculation (x, y).
    - Map `Graph` nodes/edges to the layout engine's input format.

- [ ] **Canvas/SVG Rendering**
    - Develop a frontend component (React/Vue/Vanilla) to draw the calculated graph.
    - Draw curved bezier lines for dependencies to indicate flow direction clearly.

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

### 2025-12-18 v0.1.1 - Directive: DAG Construction for Test Concepts

**Reference**: Analysis of `E:\Knowledge_project\ref` in `analysis.md`.

**Objective**: Continue developing `NoteConnection` by building the DAG for the concepts in `E:\Knowledge_project\NoteConnection\testconcept`.

**Requirements**:
1.  **Independent Project**: No specific software platform dependency.
2.  **Architecture**: HTML visualization; separated backend and frontend.
3.  **Code Quality**: Robust, interpretable, **Bilingual Comments (Chinese/English)**.
4.  **No LLM**: Prioritize systems engineering over LLM APIs.
5.  **Interface Documentation**: Maintain `Interface Document.md` with clear input/output.
6.  **Documentation Format**: Markdown. Structure: "Time and Version Number - English - Chinese".
7.  **Consistency**: Update `Interface Document.md`, `README.md`, `TODO.md` after changes.
8.  **Testing**: Functional testing after each stage, updated to `TEST_REPORT.md` (Bilingual).
9.  **Git**: Backup before modifications. No new branches.

### 2025-12-18 v0.1.2 - In-Degree/Out-Degree Visualization

**Objective**: Enhance the UI to clearly distinguish and filter between in-degree (prerequisites) and out-degree (derived concepts).

**Requirements**:
1.  **Backend**: Calculate `inDegree` and `outDegree` for each node during the build process and include it in `graph_data.json`.
2.  **Frontend Visualization**:
    *   **Visual Distinction**: Use distinct colors or styles for incoming vs. outgoing edges when a node is highlighted.
    *   **Tooltip**: Display degree counts (e.g., "In: 2, Out: 5").
    *   **Controls**: Add UI controls to filter view (e.g., "Show Incoming Only", "Show Outgoing Only", "Show All").
3.  **Documentation**: Update `Interface Document.md` to reflect the new data structure fields.
4.  **Node Distance**: The distance between nodes in the UI should be jointly determined by the in-degree/out-degree and the hybrid judgment engine.

### 2025-12-19 v0.1.3 - Directive: DAG Construction Implementation

**Objective**: Based on `v0.1.1` and `v0.1.2`, proceed with the implementation of the DAG for concepts in `testconcept`.

**Requirements**:
- [x] **Independent Implementation**: Do not rely on specific software platforms; use independent project code.
- [x] **Architecture**: Visual solution uses HTML; separate backend processing and frontend display.
- [x] **Robustness & Interpretability**: Code must be robust and interpretable. **Bilingual Comments (Chinese/English)** are required.
- [x] **No LLM Dependency**: Prioritize systems engineering design over LLM API calls.
- [x] **Interface Documentation**: Clearly state interface code info for each function. Maintain `Interface Document.md` for input/output interfaces.
- [x] **Documentation Format**: Markdown (.md). Structure: "Time and Version Number - English - Chinese".
- [x] **Consistency**: Update `Interface Document.md`, `README.md`, and `TODO.md` after code updates.
- [x] **Functional Testing**: Conduct functional testing after each stage and update `TEST_REPORT.md` (Bilingual: "Time and Version - English - Chinese").
- [x] **Git Usage**: Backup before modification. Avoid opening new branches.

### 2025-12-25 v0.1.4 - Refinement & Advanced Filtering

**Objective**: Improve the accuracy of connection discovery and enhance frontend filtering capabilities.

- [x] **Refine Keyword Matching**:
    - [x] Implement exclusion list (ignore common words).
    - [x] Support "Exact Phrase" vs "Fuzzy Match" options.
- [x] **Advanced Frontend Controls**:
    - [x] Filter by Degree range (slider).
    - [x] Toggle "Orphan Nodes" visibility.
- [x] **Data Export**:
    - [x] Allow user to export the visible graph as SVG/PNG.
    - [x] **JSON/ZIP Export**: Updated to include complete edge context (v0.1.4 update).

### 2025-12-25 v0.1.5 - Analysis & Flexible Export

**Objective**: Implement degree distribution visualization and flexible export options (Top %, Min Degree, ZIP/JSON).

- [x] **Degree Distribution Graph**:
    - [x] Histogram of Node Degrees.
- [x] **Flexible Export**:
    - [x] Filter by "Top %" or "Min Degree".
    - [x] Export to JSON (with content).
    - [x] Export to ZIP (Markdown files).
    - [x] **Node Table**: Sortable list of filtered nodes.
- [x] **Localization**:
    - [x] Full Bilingual Support (English/Chinese) for UI and Analysis Panel.

### 2026-01-15 v0.1.6 - Data Persistence & Layout Optimization

**Objective**: Allow saving of layout positions and improve large graph rendering.

- [x] **Persist Layout**:
    - [x] Save `x, y` coordinates to `graph_data.json` via `layout.json` injection.
    - [x] Frontend: Button to "Save Layout".
    - [x] Backend: Load `layout.json` during build.
- [x] **Cluster Visualization**:
    - [x] Implemented Label Propagation Algorithm (LPA).
    - [x] Group nodes visually by detected clusters (colors).
- [ ] **Performance**:
    - Optimize for 1000+ nodes (Canvas rendering option?). (Deferred to future optimization phase if needed).

### 2026-02-01 v0.1.7 - Intelligent Association Analysis

**Objective**: Introduce basic semantic analysis to suggest connections beyond simple keyword matching.

- [x] **Fuzzy String Matching**:
    - [x] Implemented Levenshtein distance utils.
    - [x] Configurable matching strategy in `config.ts`.
- [x] **Tag-based Linking**:
    - [x] Extract tags from Frontmatter and `[[WikiLinks]]`.
    - [x] Create Tag Nodes to cluster related concepts.
- [x] **Graph Metrics**:
    - [x] Calculate Betweenness Centrality (Brandes Algorithm).
    - [x] Visualize Centrality via Node Size and Label Weight.

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
    - 在 `NoteConnection` 中初始化一个新的 TypeScript/Node.js 项目。
    - 配置 ESLint, Prettier 和 Jest 用于测试。

- [x] **图核心实现**
    - 实现支持元数据（如 `rank`, `clusterId`）的 `Node` 和 `Edge` 接口。
    - 实现 `Graph` 类，包含方法：`addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`。

### 2026-01-15 v0.2.0 - 数据摄取与定向解析 (Data Ingestion & Directional Parsing)

**目标**: 从 Markdown 文件中摄取数据，专门解析 Frontmatter 中的定向依赖关系。

- [ ] **Markdown 解析服务**
    - [x] 实现文件系统读取器以递归扫描目录。
    - [ ] 创建基于正则或 AST 的解析器以提取 YAML Frontmatter。

- [ ] **依赖提取**
    - 定义模式：`prerequisites: [[Note A]]`, `next: [[Note B]]`。
    - 将这些元数据字段转换为 `Graph` 对象中的有向边的逻辑。

### 2026-02-01 v0.3.0 - 算法核心 (DAG 逻辑) (Algorithmic Core)

**目标**: 确保图是有效的 DAG 并计算层级布局位置。

- [ ] **循环检测与解决**
    - 实现基于 DFS 的循环检测。
    - 策略：向用户报告循环或自动打破循环（例如，删除指向最深节点的边）。

- [ ] **拓扑排序与排名**
    - 实现算法为每个节点分配 `rank` (0, 1, 2...)。
    - 确保没有依赖关系的节点为 Rank 0。

### 2026-03-01 v0.4.0 - 可视化引擎 (Visualization Engine)

**目标**: 使用分层布局引擎在 Web 视图中渲染处理后的图。

- [ ] **布局引擎集成**
    - 评估并集成 `d3-dag` or `dagre` 用于坐标计算 (x, y)。
    - 将 `Graph` 节点/边映射到布局引擎的输入格式。

- [ ] **Canvas/SVG 渲染**
    - 开发前端组件 (React/Vue/Vanilla) 来绘制计算出的图。
    - 为依赖关系绘制弯曲的贝塞尔线，以清晰指示流向。

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

### 2025-12-18 v0.1.1 - 指令：测试概念的 DAG 构建

**参考**: `analysis.md` 中对 `E:\Knowledge_project\ref` 的分析。

**目标**: 继续开发 `NoteConnection`，为 `E:\Knowledge_project\NoteConnection\testconcept` 中的概念构建 DAG。

**要求**:
1.  **独立项目**: 不依赖特定的软件平台。
2.  **架构**: HTML 可视化；后端处理与前端显示分离。
3.  **代码质量**: 健壮、可解释，**双语注释（中/英）**。
4.  **无 LLM**: 优先考虑系统工程设计，而非 LLM API。
5.  **接口文档**: 维护 `Interface Document.md`，清晰说明输入/output。
6.  **文档格式**: Markdown。结构：“时间 和 版本号 - 英文 - 中文”。
7.  **一致性**: 更改后更新 `Interface Document.md`、`README.md`、`TODO.md`。
8.  **测试**: 每个阶段后进行功能测试，更新至 `TEST_REPORT.md`（双语）。
9.  **Git**: 修改前备份。不创建新分支。

### 2025-12-18 v0.1.2 - 入度/出度可视化

**目标**: 增强用户界面，以清晰区分和过滤入度（先决条件）和出度（派生概念）。

**要求**:
1.  **后端**: 在构建过程中计算每个节点的 `inDegree` 和 `outDegree`，并将其包含在 `graph_data.json` 中。
2.  **前端可视化**:
    *   **视觉区分**: 节点高亮时，使用不同的颜色或样式区分传入与传出的边。
    *   **Tooltip**: 显示度数计数（例如“入: 2, 出: 5”）。
    *   **控件**: 添加 UI 控件以过滤视图（例如“仅显示传入”、“仅显示传出”、“显示全部”）。
3.  **文档**: 更新 `Interface Document.md` 以反映新的数据结构字段。
4.  **节点距离**: UI 中节点之间的距离应由入度/出度和混合判断引擎共同决定。

### 2025-12-19 v0.1.3 - 指令：DAG 构建实现

**目标**: 基于 `v0.1.1` 和 `v0.1.2`，推进 `testconcept` 中概念的 DAG 实现。

**要求**:
- [x] **独立实现**: 不依赖特定软件平台，通过独立项目代码实现。
- [x] **架构**: 可视化方案使用 HTML；后端处理与前端显示分离。
- [x] **健壮性与可解释性**: 代码应具有良好的健壮性和可解释性，注释需支持**中英双语**阅读。
- [x] **非 LLM 依赖**: 优先通过系统工程设计实现功能，而非依赖 LLM API 调用。
- [x] **接口文档**: 明确说明每个功能的接口代码信息，并维护专用的 `Interface Document.md` 文件用于输入输出接口。
- [x] **文档格式**: 推荐 md 格式。支持中英双语阅读。文档结构应为“时间 和 版本号 - 英文 - 中文”。
- [x] **一致性**: 代码更新后，需更新 `Interface Document.md`, `README.md` 和 `TODO.md`。
- [x] **功能测试**: 每个开发阶段完成后，需进行功能测试并更新至 `TEST_REPORT.md`（双语文档结构：“时间 和 版本号 - 英文文档 - 中文文档”）。
- [x] **Git 使用**: 修改前备份版本。使用 git 时尽量不开新分支。

### 2025-12-25 v0.1.4 - 改进与高级过滤

**目标**: 提高连接发现的准确性并增强前端过滤功能。

- [x] **优化关键词匹配**:
    - [x] 实现排除列表（忽略常见词）。
    - [x] 支持“精确短语”与“模糊匹配”选项。
- [x] **高级前端控件**:
    - [x] 按度数范围过滤（滑块）。
    - [x] 切换“孤立节点”可见性。
- [x] **数据导出**:
    - [x] 允许用户将可见图导出为 SVG/PNG。
    - [x] **JSON/ZIP 导出**: 已更新为包含完整的边上下文（v0.1.4 更新）。

### 2025-12-25 v0.1.5 - 分析与灵活导出

**目标**: 实现度数分布可视化和灵活的导出选项（Top %，最小度数，ZIP/JSON）。

- [x] **度数分布图**:
    - [x] 节点度数的直方图。
- [x] **灵活导出**:
    - [x] 按“Top %”或“最小度数”过滤。
    - [x] 导出为 JSON（包含内容）。
    - [x] 导出为 ZIP（Markdown 文件）。
    - [x] **节点表**: 过滤后节点的可排序列表。
- [x] **本地化**:
    - [x] UI 和分析面板的完整双语支持（英语/中文）。

### 2026-01-15 v0.1.6 - 数据持久化与布局优化

**目标**: 允许保存布局位置并改善大图渲染。

- [x] **持久化布局**:
    - [x] 将 `x, y` 坐标保存到 `graph_data.json`（通过 `layout.json` 注入）。
    - [x] 前端：按钮“保存布局”。
    - [x] 后端：在构建期间加载 `layout.json`。
- [x] **聚类可视化**:
    - [x] 实现了标签传播算法 (LPA)。
    - [x] 根据检测到的聚类对节点进行分组（颜色）。
- [ ] **性能**:
    - 针对 1000+ 节点进行优化（Canvas 渲染选项？）。（如果需要，推迟到未来的优化阶段）。

### 2026-02-01 v0.1.7 - 智能关联分析

**目标**: 引入基本的语义分析，以提出超越简单关键词匹配的连接建议。

- [x] **模糊字符串匹配**:
    - [x] 实现了 Levenshtein 距离工具。
    - [x] 在 `config.ts` 中可配置的匹配策略。
- [x] **基于标签的链接**:
    - [x] 从 Frontmatter 和 `[[WikiLinks]]` 中提取标签。
    - [x] 创建标签节点以聚类相关概念。
- [x] **图指标**:
    - [x] 计算介数中心性 (Brandes 算法)。
    - [x] 通过节点大小和标签粗细可视化中心性。
### 2026-06-01 v1.0.0 - 正式发布

**Goal**: Complete integration with Joplin/Obsidian plugins and polish UX.

- [ ] **Plugin Wrapper**
    - Wrap the `NoteConnection` core logic into a Joplin Plugin and an Obsidian Plugin.

- [ ] **User Settings & Documentation**
    - Finalize configuration options (colors, exclusion rules).
    - Publish user manual.

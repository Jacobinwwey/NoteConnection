<img width="606" height="309" alt="banner" src="https://github.com/user-attachments/assets/92e90de5-2b1a-4398-8e8b-6e142c92b6a2" />

# NoteConnection: Hierarchical Knowledge Graph Visualization System

> **Unlock the Structure of Your Knowledge.**

[![npm version](https://badge.fury.io/js/noteconnection.svg)](https://badge.fury.io/js/noteconnection)

**NoteConnection** is a high-performance, standalone visualization system engineered to transform unstructured Markdown knowledge bases into **Directed Acyclic Graphs (DAGs)**.

Unlike traditional "network" views that show a messy web of links, NoteConnection reveals the **hierarchy**, **learning paths**, and **dependency structures** hidden within your notes. It is built for scalability, capable of handling tens of thousands of nodes with ease, and operates completely independently of any specific note-taking app.

<img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/fa55676d-f58d-414e-943c-7a10567f88a5" />

---

## 🚀 Key Features

### 1. Visualization & Layout
*   **Structure Over Chaos**: Switch between **Force-Directed** (Physics) and **DAG** (Hierarchical) layouts. The DAG layout automatically identifies "Prerequisites" and "Next Steps" to arrange concepts in logical layers.
*   **Dual Rendering Engine (v0.8.7)**: Seamlessly toggle between **SVG** (for interactivity) and **Canvas** (for high-performance rendering of 10,000+ nodes).
*   **Interactive Focus Mode**: Click any node to isolate it and its context. Features **Freeze on Select** (v0.8.9) to prevent drift and adjustable **Vertical/Horizontal Spacing** (v0.8.8) to prevent overlap.
<img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/52785445-20bf-4ecc-847a-23863f291b6a" />

### 2. Intelligence & Inference
*   **Hybrid Inference Engine**: Combines **Statistical Probability** ($P(A|B)$) and **Vector Similarity** (TF-IDF) to infer hidden dependencies (e.g., "Fluorescence" implies "Photon") without external AI APIs.
*   **Scalable Clustering**: Aggregates thousands of nodes into high-level "Concept Bubbles" based on folder structure or tags for a cleaner overview.

<img width="3723" height="1992" alt="image" src="https://github.com/user-attachments/assets/9e56e567-1742-48cf-b720-cf65a47fd317" />

### 3. Performance & Control
*   **High-Capacity Parallel Processing**: Utilizes Node.js `worker_threads` (up to 12 cores) to distribute computationally intensive keyword matching.
*   **Simulation Controls (v0.9.0)**: Fine-tune the physics with a **Speed/Damping Slider** or use the **Freeze Layout** switch to stop the simulation for stable manual arrangement.
*   **Hover Lock**: Hovering over a node temporarily locks its position, allowing for stable inspection of connections.

<img width="2012" height="2024" alt="image" src="https://github.com/user-attachments/assets/e5e4c42d-54a7-463c-bc43-0feb42469a12" />

---

## 🏗️ System Architecture

NoteConnection is built on a modular architecture designed for performance and extensibility.

### Backend (`src/backend`)
*   **GraphBuilder**: The core orchestrator. It manages the pipeline from file reading to graph construction.
*   **Worker Threads**: Heavy lifting (keyword matching, text analysis) is offloaded to a pool of worker threads (`src/backend/workers`), ensuring the main thread remains responsive.
*   **Inference Engines**:
    *   `StatisticalAnalyzer`: Calculates co-occurrence matrices.
    *   `VectorSpace`: Handles TF-IDF embedding and cosine similarity.
    *   `HybridEngine`: Combines signals to suggest directed edges.

### Frontend (`src/frontend`)
*   **Dual-Engine Renderer**:
    *   **D3.js (SVG)**: Used for high-fidelity, interactive graphs with detailed tooltips and CSS styling.
    *   **HTML5 Canvas**: Optimized for rendering massive datasets where DOM manipulation overhead is too high.
*   **State Management**: `SettingsManager` persists user preferences (Physics, Visuals) to `localStorage`.
*   **Layout Logic**: Custom algorithms for Sugiyama-style layering and Force-directed physics.

---

## 📦 Quick Start

### Option 1: Run with npx (Recommended)
No installation required.
```bash
npx noteconnection
```

### Option 2: Global Installation
```bash
npm install -g noteconnection
noteconnection
```

### Option 3: Local Development
```bash
git clone https://github.com/your-repo/NoteConnection.git
cd NoteConnection
npm install
npm start
```

*   Server runs at: `http://localhost:3000`

### Option 4: Mobile Support (Android)
NoteConnection uses **Capacitor** to build native mobile apps.

#### Prerequisites
*   Android Studio (latest version)
*   Android SDK (configured in `ANDROID_HOME` or `local.properties`)

#### Build Steps
1.  **Build Web Assets**:
    ```bash
    npm run build
    ```
2.  **Sync to Android Platform**:
    ```bash
    npx cap sync
    ```
3.  **Build APK**:
    Open the `android` directory in Android Studio and build, or use the command line:
    ```bash
    cd android
    ./gradlew assembleDebug
    ```
    The APK will be located at: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Usage Guide
1.  **Select Source**: Use the dropdown in the top-left to choose a folder from `Knowledge_Base`.
2.  **Load**: Click "Load". For large datasets (>200 files), parallel processing engages automatically.
3.  **Explore**:
    *   **Layout**: Toggle **DAG** for hierarchy or **Force** for clusters.
    *   **Renderer**: Switch to **Canvas** if the graph feels sluggish.
    *   **Focus**: Click a node to enter Focus Mode. Use the sliders to adjust spacing.
    *   **Control**: Use the **Simulation** panel to freeze the layout or adjust speed.

---

## 📅 Changelog

### v0.9.23 - Default Settings Adjustment (2025-12-25)
- [x] **Reading Window**: Set default font size (zoom level) to minimum (0.5x) for compact reading.
- [x] **Simulation Physics**: Increased default Damping (velocityDecay) from 0.4 to 0.6 for more stable graph movement.

### v0.9.22 - Mobile Popup Adaptation (2025-12-25)
- [x] **Touch Interaction**: Added support for dragging the statistics popup on mobile devices by holding the title bar.
- [x] **Pinch-to-Zoom**: Implemented two-finger pinch gesture to resize/scale the popup content on touch screens.
- [x] **UX Polish**: Prevented page scrolling during popup interactions for a smoother experience.

### v0.9.21 - Strict Edge Visibility & Optimization (2025-12-25)
- [x] **Strict Edge Visibility**: Enforced rule where edges are completely hidden (opacity 0) by default in SVG mode, matching Canvas mode behavior.
- [x] **Performance Optimization**: Reduced rendering overhead by ensuring relationship lines are calculated and drawn *only* during interaction (Hover/Click/Focus), complying with strict visibility requirements.

### v0.9.20 - Selection State Auto-Clear on Focus Entry (2025-12-24)
- [x] **Clean Focus Transition**: When double-clicking a node to enter Focus Mode, any existing selection or highlight state is now automatically cleared, providing a clean and uncluttered focused view.
- [x] **Auto-Hide Popup**: The statistics popup is automatically hidden when entering Focus Mode, preventing visual conflicts.
- [x] **Enhanced UX**: Ensures users always start with a pristine focused context without residual artifacts from previous node selections.

### v0.9.19 - Focus Mode & Popup Enhancements (2025-12-24)
- [x] **Focus Mode Re-entry**: Fixed issue where double-clicking a related node while in focus mode wouldn't refresh properly. Now seamlessly switches focus between connected nodes.
- [x] **Draggable Popup**: Node statistics popup can now be dragged by its header to any screen position for better workspace organization.
- [x] **Zoomable Popup**: Added zoom controls (+/−/⟲) to scale popup content from 0.5x to 2.0x for improved readability.
- [x] **Resizable Popup**: Enabled browser-native resize handle for manual popup size adjustment.
- [x] **State Management**: Improved node visibility flag reset to prevent accumulation issues when switching focus contexts.

### v0.9.18 - Node Highlighting Refactor (2025-12-24)
- [x] **Modular Architecture**: Created dedicated `NodeHighlightManager` class for clean separation of highlighting logic.
- [x] **Unified Interface**: Single API for both PC (hover) and mobile (click) interactions.
- [x] **State Management**: Proper tracking of highlight/frozen states with focus mode awareness.
- [x] **Enhanced Rendering**: Consistent visual behavior across SVG and Canvas modes.
- [x] **Bilingual Documentation**: Comprehensive Chinese/English comments throughout the codebase.
- [x] **Robust Integration**: Full compatibility with existing focus mode, analysis panel, and statistics popup features.

### v0.9.17 - SVG Visual Completeness
- [x] **Colored Arrows**: SVG edges now use Red and Blue arrowheads when highlighted, ensuring the entire connection is color-coded.

### v0.9.16 - Interaction Completeness
- [x] **Full Context**: Clicking or hovering a node now reveals **all** connections (In & Out) regardless of the active filter mode.
- [x] **Canvas Polish**: Added bold styling for highlighted edges in the Canvas renderer.

### v0.9.14 - Visual & Data Fixes
- [x] **Edge Highlighting**: Fixed an issue where edge colors (Red/Blue) and bold styling were not applying correctly in SVG mode.
- [x] **Data Deduplication**: Ensured neighbor lists in the Statistics Popup do not contain duplicate entries.

### v0.9.13 - Focus Mode Isolation
- [x] **Interaction Constraint**: Ensured that the floating statistics popup and associated highlighting are strictly disabled when Focus Mode is active, preventing context conflict.

### v0.9.12 - Independent Statistics Popup
- [x] **Node Statistics**: Implemented a separate floating window for node details (In/Out Degree) to decouple it from the main Degree Analysis panel.
- [x] **Visualization**: In-degree and Out-degree relationships are clearly distinguished with Red/Blue indicators in the popup.

### v0.9.10 - Interaction Refinement (Click-to-Freeze)
- [x] **Inspection**: Clicking a node now freezes the entire simulation for stable inspection of connections.
- [x] **Resume**: Clicking the background resumes the simulation (if not manually frozen).

### v0.9.9 - Mobile Analysis Panel Polish
- [x] **Mobile Adaptation**: Implemented slide gestures (up/down) to resize the analysis panel, full-screen drag snap, and drag handle.
- [x] **Interaction**: Verified node click sync between analysis panel and graph.

### v0.9.8 - Analysis Interaction Refinement
- [x] **Graph Sync**: Clicking table rows now highlights nodes in the graph.
- [x] **Mobile UX**: Fixed mobile scrolling in Analysis Panel.

### v0.9.7 - Focus Mode Interaction Fix
- [x] **Focus Mode**: Fixed a bug where changing the layout type did not trigger an immediate refresh.

### v0.9.6 - Analysis & Visuals Polish
- [x] **Analysis Panel**: Added "Full Screen" toggle and "Pinch-to-Zoom" for better mobile readability.
- [x] **Visuals**: Fixed Mermaid Zoom text styling; Added background click to clear highlights.

### v0.9.5 - Refined Mobile Experience & Focus Semantics
- [x] **Focus Mode**: Added "Hierarchical (Left-Right)" layout and semantic labels ("Helping to understand" / "Further exploration").
- [x] **Analysis Panel**: Optimized for mobile (scrollable) and added click-to-highlight interaction with the main graph.
- [x] **Visuals**: Enhanced Mermaid diagram text visibility for light backgrounds; Fixed Focus Mode centering.

### v0.9.2 - Mobile UI Optimization
- [x] **Responsive Controls**: Main panel collapses on mobile; Focus UI moved to bottom.
- [x] **Touch Zoom**: Added pinch-to-zoom support in the Reading Window.

### v0.9.0 - Precise Control & Stability (2025-12-23)
- [x] **Hover Lock**: Hovering over a node locks its position to prevent inspection drift.
- [x] **Simulation Controls**: Added **Freeze Layout** checkbox and **Speed/Damping** slider.

### v0.8.9 - Stability Improvements
- [x] **Freeze on Select**: Nodes in Focus Mode retain their position after interaction.

### v0.8.8 - Scalability Defaults
- [x] **Clutter Reduction**: Edges and orphans hidden by default.
- [x] **Horizontal Spacing**: New slider for horizontal node separation in Focus Mode.

### v0.8.7 - Rendering Engine
- [x] **Canvas Renderer**: Added HTML5 Canvas support for high performance.
- [x] **Worker Scaling**: Increased thread limit to 12.

---
---

<img width="606" height="309" alt="banner" src="https://github.com/user-attachments/assets/92e90de5-2b1a-4398-8e8b-6e142c92b6a2" />

# NoteConnection: 层级知识图谱可视化系统
> **解锁你知识库的深层结构。**

**NoteConnection** 是一个高性能的独立可视化系统，旨在将非结构化的 Markdown 知识库转化为**有向无环图 (DAG)**。

与展示杂乱链接网的传统“网络”视图不同，NoteConnection 揭示了隐藏在笔记中的**层级关系**、**学习路径**和**依赖结构**。它专为可扩展性而设计，能够轻松处理数万个节点，并且完全独立于任何特定的笔记应用程序运行。

<img width="2784" height="2034" alt="image" src="https://github.com/user-attachments/assets/0ea42609-4296-42ea-978d-c6cb7d448068" />
<img width="3543" height="2159" alt="image" src="https://github.com/user-attachments/assets/0b2d80f5-ec8c-4ac1-9607-b925d4ab5f82" />

---

## 🚀 核心特性

### 1. 可视化与布局
*   **结构优于混沌**: 在 **力导向 (Force-Directed)** 和 **DAG (层级)** 布局之间切换。DAG 布局自动识别“先决条件”和“后续步骤”，将概念按逻辑分层排列。
*   **双渲染引擎 (v0.8.7)**: 无缝切换 **SVG** (用于交互) 和 **Canvas** (用于 10,000+ 节点的高性能渲染)。
*   **交互式专注模式**: 点击任意节点以隔离它及其上下文。包含 **选中冻结** (v0.8.9) 以防止漂移，以及可调节的 **垂直/水平间距** (v0.8.8) 以防止重叠。

<img width="3404" height="2028" alt="image" src="https://github.com/user-attachments/assets/39ea71da-be14-4fdc-9fec-9f33cab92e1b" />

### 2. 智能与推断
*   **混合推断引擎**: 结合 **统计概率** ($P(A|B)$) 和 **向量相似度** (TF-IDF) 推断隐藏的依赖关系（例如，“荧光”隐含“光子”），无需外部 AI API。
*   **可扩展聚类**: 基于文件夹结构或标签，将数千个节点聚合为高级“概念气泡”，提供清晰的概览。

<img width="3723" height="2007" alt="image" src="https://github.com/user-attachments/assets/10978984-3e2d-4ab6-8b44-342d4f3c3800" />

### 3. 性能与控制
*   **高容量并行处理**: 利用 Node.js `worker_threads` (最多 12 核) 分发计算密集的关键词匹配任务。
*   **模拟控制 (v0.9.0)**: 通过 **速度/阻尼滑块** 微调物理效果，或使用 **冻结布局** 开关停止模拟以进行稳定的手动排列。
*   **悬停锁定**: 悬停在节点上时暂时锁定其位置，以便稳定地检查连接。

<img width="2012" height="2024" alt="image" src="https://github.com/user-attachments/assets/bf6e7508-7e42-46cb-9a3e-b92be063ad3d" />


---

## 🏗️ 系统架构

NoteConnection 基于模块化架构构建，旨在实现高性能和可扩展性。

### 后端 (`src/backend`)
*   **GraphBuilder**: 核心协调器。管理从文件读取到图构建的整个流程。
*   **Worker Threads**: 繁重的任务（关键词匹配、文本分析）被卸载到工作线程池 (`src/backend/workers`)，确保主线程保持响应。
*   **推断引擎**:
    *   `StatisticalAnalyzer`: 计算共现矩阵。
    *   `VectorSpace`: 处理 TF-IDF 嵌入和余弦相似度。
    *   `HybridEngine`: 结合信号建议有向边。

### 前端 (`src/frontend`)
*   **双引擎渲染器**:
    *   **D3.js (SVG)**: 用于高保真、交互式图表，具有详细的工具提示和 CSS 样式。
    *   **HTML5 Canvas**: 针对海量数据集进行了优化，消除了 DOM 操作的开销。
*   **状态管理**: `SettingsManager` 将用户偏好（物理、视觉）持久化到 `localStorage`。
*   **布局逻辑**: 自定义的 Sugiyama 风格分层算法和力导向物理算法。

---

## 📦 快速开始

### 选项 1: 使用 npx 运行 (推荐)
无需安装。
```bash
npx noteconnection
```

### 选项 2: 全局安装
```bash
npm install -g noteconnection
noteconnection
```

### 选项 3: 本地开发
```bash
git clone https://github.com/your-repo/NoteConnection.git
cd NoteConnection
npm install
npm start
```

*   服务器运行于: `http://localhost:3000`

### 选项 4: 移动端支持 (Android)
NoteConnection 使用 **Capacitor** 构建原生移动应用。

#### 先决条件
*   Android Studio (最新版)
*   Android SDK (配置在 `ANDROID_HOME` 或 `local.properties` 中)

#### 构建步骤
1.  **构建 Web 资源**:
    ```bash
    npm run build
    ```
2.  **同步到 Android 平台**:
    ```bash
    npx cap sync
    ```
3.  **构建 APK**:
    在 Android Studio 中打开 `android` 目录并构建，或使用命令行:
    ```bash
    cd android
    ./gradlew assembleDebug
    ```
    APK 将位于: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. 使用指南
1.  **选择数据源**: 使用左上角的下拉菜单从 `Knowledge_Base` 中选择文件夹。
2.  **加载**: 点击 "Load"。对于大数据集 (>200 文件)，并行处理将自动启用。
3.  **探索**:
    *   **布局**: 切换 **DAG** 查看层级或 **Force** 查看聚类。
    *   **渲染器**: 如果图表感觉迟缓，请切换到 **Canvas**。
    *   **专注**: 点击节点进入专注模式。使用滑块调整间距。
    *   **控制**: 使用 **Simulation** 面板冻结布局或调整速度。

---

---

## 📅 更新日志 (Changelog)

### v0.9.19 - 专注模式与弹窗增强 (Focus Mode & Popup Enhancements) (2025-12-24)
- [x] **专注模式重新进入**: 修复了在专注模式下双击相关节点时无法正确刷新的问题。现在可以在连接的节点之间无缝切换专注。
- [x] **可拖动弹窗**: 节点统计弹窗现在可以通过标题栏拖动到屏幕上的任何位置，以便更好地组织工作区。
- [x] **可缩放弹窗**: 添加了缩放控制 (+/−/⟲)，可将弹窗内容从 0.5x 缩放到 2.0x，以提高可读性。
- [x] **可调整大小弹窗**: 启用了浏览器原生调整大小手柄，用于手动调整弹窗大小。
- [x] **状态管理**: 改进了节点可见性标志重置，以防止切换专注上下文时出现累积问题。

### v0.9.18 - 节点高亮重构 (Node Highlighting Refactor) (2025-12-24)
- [x] **模块化架构**: 创建了专用的 `NodeHighlightManager` 类，实现高亮逻辑的清晰分离。
- [x] **统一接口**: 为 PC（悬停）和移动端（点击）交互提供单一 API。
- [x] **状态管理**: 正确跟踪高亮/冻结状态，并具备专注模式感知能力。
- [x] **增强渲染**: SVG 和 Canvas 模式之间的一致视觉行为。
- [x] **双语文档**: 整个代码库中全面的中英文注释。
- [x] **稳健集成**: 与现有的专注模式、分析面板和统计弹窗功能完全兼容。

### v0.9.17 - SVG 视觉完整性 (SVG Visual Completeness)
- [x] **彩色箭头**: SVG 边现在在高亮时使用红色和蓝色箭头，确保整个连接颜色编码一致。

### v0.9.16 - 交互完整性 (Interaction Completeness)
- [x] **完整上下文**: 点击或悬停节点现在会显示**所有**连接 (入度和出度)，无论当前过滤器模式如何。
- [x] **Canvas 打磨**: 为 Canvas 渲染器中的高亮边添加了加粗样式。

### v0.9.14 - 视觉与数据修复 (Visual & Data Fixes)
- [x] **边高亮**: 修复了 SVG 模式下边颜色（红/蓝）和加粗样式未正确应用的问题。
- [x] **数据去重**: 确保统计弹窗中的邻居列表不包含重复条目。

### v0.9.13 - 专注模式隔离 (Focus Mode Isolation)
- [x] **交互约束**: 确保在专注模式处于激活状态时，严格禁用浮动统计弹窗和相关高亮显示，以防止上下文冲突。

### v0.9.12 - 独立统计弹窗 (Independent Statistics Popup)

### v0.9.10 - 交互完善 (点击冻结)
- [x] **检查**: 点击节点现在会冻结整个模拟，以便稳定地检查连接。
- [x] **恢复**: 点击背景会恢复模拟（如果未手动冻结）。

### v0.9.9 - 移动端分析面板打磨
- [x] **移动端适配**: 实现了滑动（上/下）手势以调整分析面板大小、全屏拖动吸附以及移动端拖动手柄。
- [x] **交互**: 验证了分析面板与图表之间的节点点击同步。

### v0.9.8 - 分析交互完善
- [x] **图表同步**: 点击表格行现在会高亮显示图表中的节点。
- [x] **移动端 UX**: 修复了分析面板中的移动端滚动问题。

### v0.9.7 - 专注模式交互修复
- [x] **专注模式**: 修复了切换布局类型不会触发立即刷新的 Bug。

### v0.9.6 - 分析与视觉打磨
- [x] **分析面板**: 添加了 "全屏" 切换和 "捏合缩放" 以提高移动端可读性。
- [x] **视觉效果**: 修复了 Mermaid 缩放文本样式；添加了背景点击以清除高亮。

### v0.9.5 - 移动体验优化与专注语义
- [x] **专注模式**: 添加了 "层级 (从左到右)" 布局和语义标签 ("Helping to understand" / "Further exploration")。
- [x] **分析面板**: 针对移动端优化（可滚动），并添加了与主图的点击高亮交互。
- [x] **视觉效果**: 增强了 Mermaid 图表在浅色背景下的文本可见性；修复了专注模式居中问题。

### v0.9.2 - 移动端 UI 优化
- [x] **响应式控件**: 主面板在移动端折叠；专注 UI 移至底部。
- [x] **触摸缩放**: 阅读窗口添加了捏合缩放支持。

### v0.9.0 - 精确控制与稳定性 (2025-12-23)
- [x] **悬停锁定**: 悬停节点时锁定其位置，防止检查时漂移。
- [x] **模拟控制**: 添加了 **冻结布局** 复选框和 **速度/阻尼** 滑块。

### v0.8.9 - 稳定性改进
- [x] **选中冻结**: 专注模式下的节点在交互后保留其位置。

### v0.8.8 - 可扩展性默认值
- [x] **减少杂乱**: 默认隐藏边和孤立节点。
- [x] **水平间距**: 专注模式下新增水平节点分隔滑块。

### v0.8.7 - 渲染引擎
- [x] **Canvas 渲染器**: 添加 HTML5 Canvas 支持以实现高性能。
- [x] **Worker 扩展**: 将线程限制增加到 12。

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

### v1.0.0 - Production Release (2026-06-01)
- [x] **Milestone**: Official production release of NoteConnection.
- [x] **Stability**: Fully optimized for large datasets (50k+ nodes) with Hybrid Inference and Worker threading.
- [x] **Experience**: Polished UI with Quick Start Guide, Welcome experience, and Bilingual support (En/Zh).
- [x] **API**: Decoupled Core API ready for plugin integrations.

### v0.9.58 - Hybrid Inference Resource Reuse (Optimization) (2026-01-07)
- [x] **Memory Optimization**: Implemented resource reuse logic for "Statistical Matrix" and "Vector Space" in `GraphBuilder`.
- [x] **Efficiency**: Prevents redundant recalculation of heavy data structures during Hybrid Inference, eliminating memory spikes and resolving OOM crashes on large datasets.
- [x] **Cleanup**: Added strict memory cleanup steps after inference tasks complete.

### v0.9.57 - Worker Memory Optimization (2026-01-07)
- [x] **Stability Fix**: Resolved "Heap out of memory" crashes when processing large datasets (>13k files) by optimizing the data transfer strategy for Worker Threads.
- [x] **Efficiency**: Workers now receive file paths and read content on-demand, eliminating the memory overhead of cloning large file content strings across threads.

### v0.9.56 - Hybrid Inference Memory Optimization (2026-01-05)
- [x] **Memory Analysis**: Added granular performance logging to the Hybrid Inference engine, tracking heap usage every 1000 nodes to identify memory spikes on Windows.
- [x] **Optimization**: Implemented aggressive memory cleanup (clearing matrices and nullifying vector space) immediately after inference completion to prevent Heap OOM.

### v0.9.55 - Heap OOM Fix & Iterative DFS (2026-01-05)
- [x] **Stability Fix**: Resolved "Heap out of memory" crashes on Windows 10/11 by implementing explicit memory clearing for file content before the algorithmic phase.
- [x] **Robustness**: Refactored `CycleDetector` to use an **Iterative DFS** (stack-based) approach, eliminating stack overflow risks on deep graphs.
- [x] **Observability**: Split performance logging for "Algorithmic Core" into distinct "Cycle Detection" and "Topological Sort" phases for precise debugging.

### v0.9.54 - Welcome Experience (2026-01-05)
- [x] **Onboarding**: Added a "Welcome" modal that appears when the graph is empty, guiding new users to select a source and load data.
- [x] **UX**: Highlights the "Source Select" controls during the welcome state.

### v0.9.53 - Core API Decoupling (2026-01-05)
- [x] **Architecture Refactor**: Extracted the core graph building logic into a standalone `NoteConnection` class (`src/core/NoteConnection.ts`).
- [x] **Plugin Prep**: Decoupled the core API from CLI/Server-specific file operations, enabling direct integration with future Joplin/Obsidian plugins.
- [x] **Documentation**: Updated User Manual with missing "Max Workers" performance setting.

### v0.9.52 - Cycle Detection Memory Optimization (2026-01-05)
- [x] **Stability Fix**: Resolved a critical "Heap out of memory" crash on Windows 10/11 when building large graphs with many cycles.
- [x] **Algorithm Optimization**: Updated `CycleDetector` to limit the number of detected cycles, preventing excessive memory consumption during recursion.

### v0.9.51 - Performance Logging & Crash Reporting (2026-01-03)
- [x] **System Monitoring**: Implemented comprehensive performance logging for backend processes (CPU, Memory, Time).
- [x] **GPU Diagnostics**: Added execution timing and memory tracking for GPU acceleration steps.
- [x] **Crash Reporting**: Implemented `CrashLogger` to automatically record unhandled exceptions and worker failures to `crash.log` for debugging stability issues on Windows 11.
- [x] **Optimization**: Integrated `PerformanceLogger` across the entire Graph Construction pipeline (Node Init, Edge Matching, Inference).

### v0.9.50 - GPU Acceleration (2026-01-02)
- [x] **Verification**: Confirmed feasibility of using **AMD Radeon 7900XT** for graph construction acceleration via `gpu.js`.
- [x] **Strategy**: Validated that Mathematical Inference (Vector Similarity) can be offloaded to GPU, while Text Processing remains optimized on CPU.
- [x] **Implementation**: Added `amdgpu` module with `VectorSpaceGPU` class. Integrated into `GraphBuilder` to automatically use GPU for Cosine Similarity matrix calculations when enabled.

### v0.9.49 - Statistical Analysis Memory Optimization (2026-01-02)
- [x] **Performance**: Fixed a critical "Heap out of memory" crash when processing large datasets (>10,000 files) by optimizing the Statistical Analyzer algorithm.
- [x] **Efficiency**: Reduced the complexity of co-occurrence matrix calculation by ~30x using a sparse, file-centric approach.

### v0.9.49 - UI Controls for Parallel Processing (2026-01-02)
- [x] **Settings UI**: Added a "Performance" section to the Settings Modal with a slider and number input to control "Max Workers".
- [x] **API Integration**: The "Load" button now sends the user-defined worker limit to the backend build process.
- [x] **Persistence**: The worker setting is saved in `localStorage` alongside other preferences.

### v0.9.48 - Parallel Processing Optimization (2026-01-02)
- [x] **Configurable Workers**: Added 'maxWorkers' configuration to allow utilizing more CPU cores for graph building and statistical inference. Removed the hardcoded limit of 12 workers.

### v0.9.47 - Focus Mode Interaction & Layout Fixes (2026-01-02)
- [x] **Interaction Logic**: Fixed an issue where double-clicking a node to enter Focus Mode would accidentally trigger a zoom-in event. Added event propagation control to prevent this (SVG & Canvas).
- [x] **Vertical Layout Spacing**: Increased the horizontal offset of node labels in Vertical Focus Mode to prevent text from overlapping with nodes, improving readability (SVG & Canvas).

### v0.9.46 - Focus Mode UI Cleanup & Canvas Edge Fix (2025-12-26)
- [x] **Immersive Focus**: The main control panel and source selection bar are now completely hidden during Focus Mode for a distraction-free experience.
- [x] **Canvas Polish**: Removed edge rendering in Canvas Focus Mode to reduce visual noise.

### v0.9.45 - Canvas Interactivity & Cleanup (2025-12-26)
- [x] **Canvas Interactive**: Canvas mode now supports Hover (Highlight), Single Click (Stats), and Double Click (Focus Mode) interactions, bringing it to feature parity with SVG.
- [x] **Visual Fixes**: Fixed an issue where nodes in Canvas mode were rendered too large; they now respect "Size By" settings.
- [x] **Cleanup**: Removed the deprecated "View Mode" (Clusters) feature.

### v0.9.44 - Independent Focus Mode Spacing (2025-12-26)
- [x] **Smart Spacing**: "Layer-Space" and "Node-Space" settings are now saved independently for "Horizontal" and "Vertical" focus layouts.
- [x] **Optimized Defaults**: Reduced default Horizontal Layer-Space by 50% and Vertical Node-Space by 75% for tighter, more readable layouts.

### v0.9.43 - Context-Aware Settings UI (2025-12-26)
- [x] **Dynamic Labels**: The "Repulsion Strength" label in the settings now dynamically changes between "Repulsion (Force)" and "Repulsion (DAG)" to clearly indicate which layout configuration is being modified.

### v0.9.42 - Distinct Repulsion Settings (2025-12-26)
- [x] **Mode-Specific Physics**: "Repulsion Strength" is now configured independently for "Force" and "DAG" modes.
- [x] **Smart Defaults**: Set default repulsion to **-550** for Force layout (clusters) and **-850** for DAG layout (hierarchy) to optimize initial visual separation.
- [x] **Context-Aware Settings**: The Settings Modal automatically shows the repulsion value for the current layout.

### v0.9.41 - Settings Modal Simulation Freeze (2025-12-26)
- [x] **Resource Saving**: The simulation now automatically pauses when the "Visualization Settings" modal is opened, reducing CPU usage during configuration. It resumes upon closing unless "Freeze Layout" is globally enabled.

### v0.9.40 - Freeze Layout Priority Fix (Settings Modal) (2025-12-26)
- [x] **Settings Isolation**: Adjusting parameters in the "Visualization Settings" modal (e.g., Repulsion, Opacity) no longer triggers a simulation restart if the layout is frozen. Visual changes apply immediately, while physics updates await unfreezing.

### v0.9.39 - Layout Switch Relaxation & Freeze Logic (2025-12-26)
- [x] **Consistent Transition**: Switching layouts now triggers the same "Rapid Relaxation" (0.2 damping for 2s) as the initial load, ensuring nodes arrange themselves quickly.
- [x] **Smart Freeze**: If "Freeze Layout" is active during a switch, the simulation runs for the 2-second relaxation period to establish the new structure before automatically freezing.

### v0.9.38 - Quick Start Guide HTML Rendering Fix (2025-12-26)
- [x] **Rich Text Support**: Fixed an issue where HTML tags (e.g., bold text, line breaks) in the localized UI were displayed as raw text. The system now correctly renders HTML formatting in translations.

### v0.9.37 - Rapid Relaxation Strategy (2025-12-26)
- [x] **Smart Damping**: The simulation now starts with low friction (0.2) for 2 seconds to allow rapid untangling of nodes ("relaxation"), then automatically increases to high friction (0.95) for stability.

### v0.9.36 - Freeze Layout Priority Fix (2025-12-26)
- [x] **Strict Freeze**: Changing "Degree Basis" or "Size By" settings no longer wakes up the simulation if "Freeze Layout" is active. Visuals update (node sizes change) while positions remain strictly locked.

### v0.9.35 - Viewport Culling Relaxation (2025-12-26)
- [x] **Smoother Culling**: Increased the off-screen "active" buffer to 800px (visual), preventing nodes near the edge from freezing abruptly during panning.
- [x] **Extended Zoom**: Lowered the global simulation freeze threshold from 0.4x to 0.1x, allowing physics to continue running even when significantly zoomed out.

### v0.9.34 - Global Layout Update Fix (2025-12-26)
- [x] **Layout Transition Logic**: Implemented a global unfreeze mechanism during layout switching.
- [x] **Override Culling**: Switching layouts (e.g., Force to DAG) now forcefully clears viewport culling locks (`isCulled`, `fx`, `fy`), ensuring all nodes, including off-screen ones, correctly participate in the new layout arrangement.

### v0.9.33 - Layout State Caching (Instant Switch) (2025-12-26)
- [x] **Template States**: Implemented independent state caching for "Force" and "DAG" layouts.
- [x] **Instant Switch**: Switching layouts now saves the current state and restores the target state instantly without recalculation or visual movement, preserving the exact arrangement of each view.

### v0.9.32 - High Damping & Render Optimization (2025-12-26)
- [x] **Damping**: Increased default friction to 0.92 for faster settling.
- [x] **Render Culling**: DOM updates are skipped for off-screen frozen nodes.

### v0.9.31 - Simulation Optimization (Viewport Culling) (2025-12-26)
- [x] **Performance**: Implemented smart viewport culling to reduce simulation load.
- [x] **Full View Freeze**: Automatically freezes the simulation when zoomed out (< 0.4x) to view the entire graph.
- [x] **Off-screen Freezing**: When zoomed in, only nodes within the visible viewport (plus a buffer) are simulated; off-screen nodes are frozen.

### v0.9.30 - Focus Mode Layout Isolation (2025-12-26)
- [x] **Position Consistency**: Implemented coordinate backup/restore logic (`x`, `y`, `fx`, `fy`) for Focus Mode.
- [x] **Behavior**: Exiting Focus Mode now reverts the graph layout to its *exact* state prior to entry, discarding any temporary arrangements or drags made during the focused session.
- [x] **UX**: Fulfills the requirement that Focus Mode should have zero impact on the main interface's layout structure.

### v0.9.29 - Freeze Layout Persistence (2025-12-26)
- [x] **Bug Fix**: Resolved an issue where opening the Analysis Panel or resizing the window would override the "Freeze Layout" state, causing unwanted node movement.
- [x] **Robustness**: The physics simulation now strictly respects the frozen state during layout changes, ensuring nodes remain stationary as expected.

### v0.9.27 - Freeze Layout Priority Fix (2025-12-26)
- [x] **Logic Correction**: Resolved a conflict where "Exit Focus Mode" would unconditionally restart the physics simulation, overriding the "Freeze Layout" state.
- [x] **Priority Enforcement**: If "Freeze Layout" is checked, exiting Focus Mode now stops the simulation and forces a static render update, ensuring nodes remain strictly inactive as requested.

### v0.9.26 - UX Enhancements & Quick Start (2025-12-26)
- [x] **Freeze Layout Quick Button**: Added a dedicated freeze button (❄️) to the main interface for instant access, improving mobile usability.
    - [x] **Sync**: State is synchronized with the simulation panel checkbox.
    - [x] **Visuals**: Button turns red when frozen.
- [x] **Quick Start Manual**: Implemented a "Quick Start Guide" modal for new users.
    - [x] **Content**: Covers Loading, Navigation, Focus Mode, and Controls.
    - [x] **Onboarding**: Automatically shows on first visit (unless "Don't show again" is checked).
    - [x] **Access**: Accessible anytime via the new "Help" (❓) button.
- [x] **Localization**: Fully localized new UI elements in English and Chinese.

### v0.9.25 - Freeze Layout Optimization (2025-12-25)
- [x] **Resource Optimization**: In the main interface (SVG Mode), enabling "Freeze Layout" now completely disables node dragging in addition to stopping the simulation.
- [x] **Logic**: Prevents the physics simulation from restarting (waking up) due to drag events, ensuring maximum CPU/Memory savings.
- [x] **Focus Mode Preservation**: Dragging and manual positioning capabilities remain fully active in Focus Mode, unaffected by the global freeze setting.

### v0.9.24 - Focus Mode Memory Optimization (2025-12-25)
- [x] **Simulation Optimization**: Restricted physics simulation during Focus Mode to only active nodes (focus center + neighbors).
- [x] **Resource Saving**: Background nodes are frozen (removed from simulation loop), significantly reducing CPU/Memory usage while maintaining their exact visual state.
- [x] **Seamless Restoration**: Background nodes are instantly restored to their original positions upon exiting Focus Mode.

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

### v1.0.0 - 正式发布 (Production Release) (2026-06-01)
- [x] **里程碑**: NoteConnection 正式生产版本发布。
- [x] **稳定性**: 通过混合推断和 Worker 线程，针对大数据集（50k+ 节点）进行了全面优化。
- [x] **体验**: 抛光的用户界面，包含快速开始指南、欢迎体验和双语支持（中/英）。
- [x] **API**: 解耦的核心 API，已准备好进行插件集成。

### v0.9.58 - 混合推断资源重用 (优化) (Hybrid Inference Resource Reuse) (2026-01-07)
- [x] **内存优化**: 在 `GraphBuilder` 中为“统计矩阵”和“向量空间”实现了资源重用逻辑。
- [x] **效率**: 防止在混合推断期间重复计算繁重的数据结构，消除了内存峰值并解决了大数据集上的 OOM 崩溃问题。
- [x] **清理**: 在推断任务完成后添加了严格的内存清理步骤。

### v0.9.57 - Worker 内存优化 (Worker Memory Optimization) (2026-01-07)
- [x] **稳定性修复**: 通过优化 Worker 线程的数据传输策略，解决了处理大数据集 (>13k 文件) 时的“堆内存溢出”崩溃问题。
- [x] **效率**: Worker 现在接收文件路径并按需读取内容，消除了跨线程克隆大型文件内容字符串的内存开销。

### v0.9.56 - 混合推断内存优化 (Hybrid Inference Memory Optimization) (2026-01-05)
- [x] **内存分析**: 为混合推断引擎添加了细粒度的性能日志，每 1000 个节点跟踪一次堆内存使用情况，以识别 Windows 上的内存峰值。
- [x] **优化**: 在推断完成后立即实施激进的内存清理（清除矩阵和置空向量空间），以防止堆内存溢出。

### v0.9.55 - 堆内存溢出修复与迭代 DFS (Heap OOM Fix & Iterative DFS) (2026-01-05)
- [x] **稳定性修复**: 通过在算法阶段之前显式清除文件内容内存，解决了 Windows 10/11 上的“堆内存溢出”崩溃问题。
- [x] **稳健性**: 重构 `CycleDetector` 使用 **迭代 DFS**（基于栈）方法，消除了深度图上的堆栈溢出风险。
- [x] **可观测性**: 将“算法核心”的性能日志拆分为“循环检测”和“拓扑排序”两个独立阶段，以便进行精确调试。

### v0.9.54 - 欢迎体验 (Welcome Experience) (2026-01-05)
- [x] **引导 (Onboarding)**: 添加了一个“欢迎”模态框，当图谱为空时出现，引导新用户选择数据源并加载数据。
- [x] **用户体验 (UX)**: 在欢迎状态下高亮显示“源选择”控件。

### v0.9.53 - 核心 API 解耦 (Core API Decoupling) (2026-01-05)
- [x] **架构重构**: 将核心图构建逻辑提取到独立的 `NoteConnection` 类 (`src/core/NoteConnection.ts`) 中。
- [x] **插件准备**: 将核心 API 与 CLI/服务器特定的文件操作解耦，从而支持与未来的 Joplin/Obsidian 插件直接集成。
- [x] **文档**: 更新了用户手册，补充了缺失的“最大 Worker”性能设置。

### v0.9.52 - 循环检测内存优化 (Cycle Detection Memory Optimization) (2026-01-05)
- [x] **稳定性修复**: 解决了在构建具有大量循环的大型图谱时，Windows 10/11 上发生的关键“堆内存溢出”崩溃问题。
- [x] **算法优化**: 更新了 `CycleDetector` 以限制检测到的循环数量，防止递归期间过度的内存消耗。

### v0.9.51 - 性能日志与崩溃报告 (Performance Logging & Crash Reporting) (2026-01-03)
- [x] **系统监控**: 为后端流程（CPU、内存、时间）实现了全面的性能日志记录。
- [x] **GPU 诊断**: 为 GPU 加速步骤添加了执行计时和内存跟踪。
- [x] **崩溃报告**: 实现了 `CrashLogger`，自动将未处理的异常和 Worker 故障记录到 `crash.log`，以便调试 Windows 11 上的稳定性问题。
- [x] **优化**: 将 `PerformanceLogger` 集成到整个图构建管道（节点初始化、边匹配、推断）中。

### v0.9.50 - GPU 加速 (GPU Acceleration) (2026-01-02)
- [x] **验证**: 确认了使用 **AMD Radeon 7900XT** 通过 `gpu.js` 加速图构建的可行性。
- [x] **策略**: 验证了数学推断（向量相似度）可以卸载到 GPU，而文本处理仍保留在 CPU 上进行优化。
- [x] **实现**: 添加了 `amdgpu` 模块和 `VectorSpaceGPU` 类。集成到 `GraphBuilder` 中，在启用时自动使用 GPU 进行余弦相似度矩阵计算。

### v0.9.49 - 统计分析内存优化 (Statistical Analysis Memory Optimization) (2026-01-02)
- [x] **性能**: 通过优化统计分析器算法，修复了处理大数据集 (>10,000 文件) 时关键的“堆内存溢出”崩溃问题。
- [x] **效率**: 使用稀疏的、以文件为中心的方法，将共现矩阵计算的复杂度降低了约 30 倍。

### v0.9.49 - 并行处理 UI 控制 (UI Controls for Parallel Processing) (2026-01-02)
- [x] **设置界面**: 在设置模态框中添加了“性能” (Performance) 部分，包含用于控制“最大 Worker”的滑块和数字输入框。
- [x] **API 集成**: “加载”按钮现在会将用户定义的 Worker 限制发送到后端构建流程。
- [x] **持久化**: Worker 设置与其他偏好一起保存在 `localStorage` 中。

### v0.9.48 - 并行处理优化 (Parallel Processing Optimization) (2026-01-02)
- [x] **可配置 Worker**: 添加了 'maxWorkers' 配置，允许利用更多 CPU 核心进行图构建和统计推断。移除了 12 个 Worker 的硬编码限制。

### v0.9.46 - 专注模式 UI 清理与 Canvas 边修复 (Focus Mode UI Cleanup & Canvas Edge Fix) (2025-12-26)
- [x] **沉浸式专注**: 专注模式期间，主控制面板和源选择栏现在完全隐藏，以提供无干扰的体验。
- [x] **Canvas 打磨**: 移除了 Canvas 专注模式下的边渲染，以减少视觉噪音。

### v0.9.45 - Canvas 交互与清理 (Canvas Interactivity & Cleanup) (2025-12-26)
- [x] **Canvas 交互**: Canvas 模式现在支持悬停 (高亮)、单击 (统计) 和双击 (专注模式) 交互，与 SVG 功能对齐。
- [x] **视觉修复**: 修复了 Canvas 模式下节点渲染过大的问题；现在它们遵循“大小依据”设置。
- [x] **清理**: 移除了已弃用的“视图模式” (聚类) 功能。

### v0.9.44 - 独立专注模式间距 (Independent Focus Mode Spacing) (2025-12-26)
- [x] **智能间距**: “层间距”和“节点间距”设置现在针对“水平”和“垂直”专注布局独立保存。
- [x] **优化默认值**: 将默认水平层间距减少 50%，垂直节点间距减少 75%，以获得更紧凑、更易读的布局。

### v0.9.43 - 上下文感知设置 UI (Context-Aware Settings UI) (2025-12-26)
- [x] **动态标签**: 设置中的“排斥力强度”标签现在会在“排斥力 (力导向)”和“排斥力 (DAG)”之间动态变化，以清晰指示正在修改哪种布局配置。

### v0.9.42 - 独立排斥力设置 (Distinct Repulsion Settings) (2025-12-26)
- [x] **特定模式物理**: “排斥力强度”现在可以针对“力导向”和“DAG”模式独立配置。
- [x] **智能默认值**: 将力导向布局（聚类）的默认排斥力设置为 **-550**，DAG 布局（层级）设置为 **-850**，以优化初始视觉分离。
- [x] **上下文感知设置**: 设置模态框会自动显示当前布局的排斥力数值。

### v0.9.41 - 设置模态框模拟冻结 (Settings Modal Simulation Freeze) (2025-12-26)
- [x] **资源节省**: 打开“可视化设置”模态框时，模拟现在会自动暂停，从而减少配置期间的 CPU 使用率。关闭时会自动恢复，除非全局启用了“冻结布局”。

### v0.9.40 - 冻结布局优先级修复 (设置模态框) (2025-12-26)
- [x] **设置隔离**: 如果布局已冻结，在“可视化设置”模态框中调整参数（例如排斥力、透明度）不再触发模拟重启。视觉更改立即生效，而物理更新等待解冻。

### v0.9.39 - 布局切换松弛与冻结逻辑 (Layout Switch Relaxation & Freeze Logic) (2025-12-26)
- [x] **一致过渡**: 切换布局现在会触发与初始加载相同的“快速松弛”（0.2 阻尼持续 2 秒），确保节点快速排列。
- [x] **智能冻结**: 如果在切换期间激活了“冻结布局”，模拟将运行 2 秒的松弛期以建立新结构，然后自动冻结。

### v0.9.38 - 快速开始指南 HTML 渲染修复 (Quick Start Guide HTML Rendering Fix) (2025-12-26)
- [x] **富文本支持**: 修复了本地化 UI 中的 HTML 标签（例如粗体文本、换行符）显示为原始文本的问题。系统现在可以正确渲染翻译中的 HTML 格式。

### v0.9.37 - 快速松弛策略 (Rapid Relaxation Strategy) (2025-12-26)
- [x] **智能阻尼**: 模拟现在以低摩擦 (0.2) 启动 2 秒，以允许节点快速解开（“松弛”），然后自动增加到高摩擦 (0.95) 以保持稳定。

### v0.9.36 - 冻结布局优先级修复 (Freeze Layout Priority Fix) (2025-12-26)
- [x] **严格冻结**: 如果“冻结布局”处于激活状态，更改“度数基准”或“大小依据”设置不再唤醒模拟。视觉效果更新（节点大小改变），而位置严格锁定。

### v0.9.35 - 视口剔除放宽 (Viewport Culling Relaxation) (2025-12-26)
- [x] **平滑剔除**: 将屏幕外“活动”缓冲区增加到 800px (视觉)，防止边缘附近的节点在平移期间突然冻结。
- [x] **扩展缩放**: 将全局模拟冻结阈值从 0.4x 降低到 0.1x，允许物理模拟在大幅缩小时继续运行。

### v0.9.34 - 全局布局更新修复 (Global Layout Update Fix) (2025-12-26)
- [x] **布局转换逻辑**: 实现了布局切换期间的全局解冻机制。
- [x] **覆盖剔除**: 切换布局（例如从 Force 到 DAG）现在会强制清除视口剔除锁定（`isCulled`，`fx`，`fy`），确保所有节点（包括屏幕外的节点）都能正确参与新的布局排列。

### v0.9.33 - 布局状态缓存 (即时切换) (2025-12-26)
- [x] **模板状态**: 为“Force”和“DAG”布局实现了独立的状态缓存。
- [x] **即时切换**: 切换布局现在会保存当前状态并立即恢复目标状态，无需重新计算或视觉移动，从而保留每个视图的精确排列。

### v0.9.32 - 高阻尼与渲染优化 (2025-12-26)
- [x] **阻尼**: 将默认摩擦力增加到 0.92 以加快稳定速度。
- [x] **渲染剔除**: 跳过屏幕外冻结节点的 DOM 更新。

### v0.9.31 - 模拟优化 (视口剔除) (2025-12-26)
- [x] **性能**: 实现了智能视口剔除以减少模拟负载。
- [x] **全景冻结**: 当缩小到查看整个图表 (< 0.4x) 时自动冻结模拟。
- [x] **屏幕外冻结**: 放大时，仅模拟可见视口（加上缓冲区）内的节点；屏幕外的节点被冻结。

### v0.9.30 - 专注模式布局隔离 (Focus Mode Layout Isolation) (2025-12-26)
- [x] **位置一致性**: 为专注模式实现了坐标备份/恢复逻辑 (`x`, `y`, `fx`, `fy`)。
- [x] **行为**: 退出专注模式现在会将图表布局恢复到进入前的*精确*状态，丢弃专注会话期间所做的任何临时排列或拖动。
- [x] **UX**: 满足了专注模式应对主界面布局结构零影响的要求。

### v0.9.29 - 冻结布局持久化 (Freeze Layout Persistence) (2025-12-26)
- [x] **Bug 修复**: 解决了打开分析面板或调整窗口大小时会覆盖“冻结布局”状态，导致节点意外移动的问题。
- [x] **稳健性**: 物理模拟现在在布局变更期间严格遵守冻结状态，确保节点按预期保持静止。

### v0.9.27 - 条件重启 (Conditional Restart) (2025-12-26)
- [x] **逻辑修正**: 解决了“退出专注模式”会无条件重启物理模拟，覆盖“冻结布局”状态的冲突。
- [x] **优先级执行**: 如果选中了“冻结布局”，退出专注模式现在会停止模拟并强制进行静态渲染更新，确保节点按请求保持严格静止。

### v0.9.26 - UX 增强与快速开始 (UX Enhancements & Quick Start) (2025-12-26)
- [x] **冻结布局快速按钮**: 在主界面添加了专用的冻结按钮 (❄️) 以便即时访问，提高了移动端可用性。
    - [x] **同步**: 状态与模拟面板复选框同步。
    - [x] **视觉**: 冻结时按钮变红。
- [x] **快速开始指南**: 为新用户实现了“快速开始指南”模态框。
    - [x] **内容**: 涵盖加载、导航、专注模式和控制。
    - [x] **引导**: 首次访问时自动显示（除非选中“不再显示”）。
    - [x] **访问**: 可通过新的“帮助” (❓) 按钮随时访问。
- [x] **本地化**: 全面本地化了新的 UI 元素（中/英）。

### v0.9.25 - 冻结布局优化 (Freeze Layout Optimization) (2025-12-25)
- [x] **资源优化**: 在主界面（SVG 模式）中，启用“冻结布局”现在除了停止模拟外，还会完全禁用节点拖动。
- [x] **逻辑**: 防止因拖动事件而重启（唤醒）物理模拟，从而确保最大限度地节省 CPU/内存。
- [x] **专注模式保留**: 专注模式下的拖动和手动定位功能保持完全激活，不受全局冻结设置的影响。

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

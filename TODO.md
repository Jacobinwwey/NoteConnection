# 2025-12-26 v0.9.28

# Project Build Plan: Progressive Hierarchical Knowledge Graph

This document outlines the roadmap for building `NoteConnection`, a system capable of visualizing tens of thousands of knowledge points as a Directed Acyclic Graph (DAG), highlighting hierarchical relationships and learning paths.

---

# 2026-01-12 v0.9.74 - Layout Switching & GPU Robustness

**Goal**: Finalize stable layout switching with state preservation and resolve GPU resource management issues (WebGL Context Leaks).

- [x] **Layout Switching Fix**

  - [x] **State Preservation**: Implemented `layoutCache` to independently store and restore node positions (`x, y, fx, fy`) for 'Force' and 'DAG' layouts.
  - [x] **Crash Resolution**: Fixed a critical crash in `updateLayout` where `simulation.force` was accessed before initialization by refactoring usage of `applyPhysics`.
  - [x] **Logic**: Switching layouts now seamlessly transitions without visual "teleportation" glitches or simulation resets.

- [x] **GPU Robustness**
  - [x] **Singleton Pattern**: Refactored `layout_gpu.js` to use a Singleton instance for `GPUManyBodyForce`, preventing WebGL context leaks (limit 16 contexts) when toggling settings.
  - [x] **Constructor Safety**: Enhanced `GPU.GPU` detection to handle variable library packing (Webpack/Rollup).

---

# 2026-01-12 v0.9.73 - GPU Rendering Fix (Chaining Bug)

**Goal**: Fix the "Silent Failure" of GPU Force caused by a method chaining bug in `layout_gpu.js`, which prevented v0.9.72 from actually activating the GPU physics despite UI settings.

- [x] **Bug Fix**
  - [x] **Method Chaining**: Fixed `strength()` method in `layout_gpu.js` to return the `impl` function wrapper instead of `this`.
  - [x] **Verification**: Confirmed `d3.force` now correctly receives the callable function.

# 2026-01-12 v0.9.72 - GPU Optimized Rendering (Geek Edition)

**Goal**: Fulfill the "Geek" requirement to leverage AMDGPU (RX 7900XT) for smoother frontend rendering and parallel backend processing.

- [x] **Frontend GPU Rendering**

  - [x] **GPU Force Engine**: Implemented `GPUManyBodyForce` in `layout_gpu.js` using `gpu.js`.
  - [x] **Integration**: Added `libs/gpu-browser.min.js` and integrated into `app.js`.
  - [x] **UI Control**: Verified "GPU Optimised Rendering" checkbox in Settings. Default: Enabled.
  - [x] **Logic**: Dynamic switching between CPU (`d3.forceManyBody`) and GPU (`gpuManyBody`) physics engines.

- [x] **Backend Optimization Confirmation**
  - [x] **Parallelism**: Confirmed `GraphBuilder` uses `LayoutEngine` with Worker threads.
  - [x] **GPU Backend**: Confirmed `LayoutEngine` uses `amdgpu/LayoutGPU.ts` if enabled.

---

# 2026-01-10 v0.9.71 - Backend Layout & Static Mode

**Goal**: Optimize performance for massive graphs (50k+ nodes) by offloading layout calculations to backend workers and implementing a static rendering mode.

- [x] **Backend Parallel Layout**

  - [x] **Layout Engine**: Created `LayoutEngine.ts` and `layoutWorker.ts` to run `d3-force` simulation on backend threads.
  - [x] **Integration**: `GraphBuilder` now automatically triggers backend layout calculation for graphs > 100 nodes.
  - [x] **GPU Acceleration**: Implemented `LayoutGPU.ts` using `gpu.js` to accelerate layout on AMDGPU.
  - [x] **Performance**: Reduces frontend initialization time by providing pre-calculated coordinates.

- [x] **Frontend Optimizations**

  - [x] **Static Mode**: Introduced a "Static Mode" toggle.
    - [x] **Auto-Enable**: Automatically enabled for >5000 nodes or >200,000 edges.
    - [x] **Behavior**: Simulation runs for 2 seconds (warm-up) then stops to save CPU.
    - [x] **Layout Switch**: Respects static mode during layout transitions (Force <-> DAG).
  - [x] **GPU Settings**: Added "GPU Optimised Rendering" checkbox to settings to control acceleration flags.
  - [x] **Extreme Scale**: Strictly disabled edge rendering for graphs >10,000 nodes to prevent rendering bottlenecks.

- [x] **CLI & File Management**
  - [x] **CLI Arguments**: Added `--path` and `--gpu` support to `npm start`.
  - [x] **File Isolation**: CLI runs generate unique `data_cli_*.js` files to protect the original `data.js`.
  - [x] **Server Logic**: `server.ts` automatically serves the correct CLI data file based on build parameters.

---

# 2026-01-09 v0.9.70 - Frontend Initialization Fix (Race Condition)

**Goal**: Resolve the "No nodes displayed" and "Unresponsive Buttons" issue caused by a race condition in the initialization sequence for large datasets.

- [x] **Bug Fix**
  - [x] **Race Condition**: Identified that `renderCanvas` was being called by `ResizeObserver` or `setTimeout` _before_ the `controls` object was defined, causing a fatal error that halted script execution.
  - [x] **Refactor**: Moved `controls` definition to the top of `app.js`.
  - [x] **Robustness**: Added safety checks in `isNodeVisible` and `renderCanvas` to prevent crashes during initialization.
  - [x] **Result**: UI buttons (Freeze, Settings) should now initialize correctly, and the canvas should render immediately.

# 2026-01-09 v0.9.69 - Frontend Crash Fix (10k+ Nodes)

**Goal**: Fix the critical "Nodes: 0" bug caused by a stack overflow when processing 1.2 million edges in the frontend.

- [x] **Bug Fix**
  - [x] **Stack Overflow**: Identified `RangeError: Maximum call stack size exceeded` in `app.js` due to `links.push(...validLinks)` with 1.2M arguments.
  - [x] **Refactor**: Changed `links` declaration from `const` to `let` and replaced the spread operation with direct assignment (`links = validLinks`).
  - [x] **Result**: The application now successfully loads and renders graphs with >10,000 nodes and >1 million edges without crashing.

# 2026-01-09 v0.9.68 - Content-on-Demand Architecture (10k+ Fix)

**Goal**: Definitively solve the "Nodes: 0" display issue for 10k+ nodes caused by massive `data.js` file size (~500MB) crashing the browser.

- [x] **Architecture Refactor**

  - [x] **Data Splitting**: Separated graph structure (`data.js`) from content (`graph_data.json`).
  - [x] **Optimization**: `data.js` now excludes node content, reducing file size by ~95% (e.g., 500MB -> 35MB for 13k nodes).
  - [x] **Backend**: Updated `src/index.ts` to generate "Lite" `data.js`.

- [x] **Content-on-Demand**
  - [x] **API Endpoint**: Added `GET /api/content` to `server.ts` to serve raw node content securely.
  - [x] **Frontend**: Updated `Reader` in `reader.js` to fetch content asynchronously when opening a node.
  - [x] **UX**: Added loading state indicator in Reader window.

# 2026-01-08 v0.9.67 - Compact Mode & Canvas Fix

**Goal**: Solve the display issue for 10k+ nodes and implement a performance mode that hides edges by default.

- [x] **Compact Mode**
  - [x] **Auto-Enable**: Automatically activates for >5000 nodes or >100,000 edges.
  - [x] **Edge Culling**: Rendering loop skips edge iteration entirely in Compact Mode unless highlighting is active.
  - [x] **Settings UI**: Added "Compact Mode (Hide Edges)" checkbox to Performance settings.
- [x] **Canvas Fix**
  - [x] **Initial Render**: Forced explicit `resizeCanvas()` and `ticked()` calls after initialization to prevent blank screen.

# 2026-01-08 v0.9.63 - 10k Node Optimization & Memory Strategy

**Goal**: Solve the "stuck" rendering issue for 10k+ nodes/1.2M edges and implement configurable memory strategies for backend processing.

- [x] **Frontend Optimization**

  - [x] **Physics Culling**: Implemented edge limit (20k) for the D3 Force Simulation. If total edges exceed this, only a subset drives the physics to prevent Main Thread freeze, while all edges remain available for rendering/traversal.
  - [x] **Link Resolution**: Pre-resolved link source/target to objects to support robust rendering even when physics uses a subset.
  - [x] **UI Unblocking**: Fixed "Quick Start Guide" not appearing by freeing up the main thread.

- [x] **Backend Memory Strategy**

  - [x] **Configuration**: Added `memorySavingMode` and `deepDebug` to `AppConfig`.
  - [x] **Worker Optimization**: Refactored `keywordMatchWorker` and `statisticalWorker` to support both `filePaths` (Low Memory) and `filesChunk` (High Performance/Precision) modes.
  - [x] **Graph Metrics**: Added check to force Single-Core execution for `Betweenness Centrality` when `memorySavingMode` is active.
  - [x] **Cycle Detection**: Adjusted limit (100 vs 10000) based on memory mode.

- [x] **System Monitoring**
  - [x] **Peak Memory**: Updated `PerformanceLogger` to track and log Peak Heap/RSS memory usage.
  - [x] **Deep Debug**: Implemented conditional detailed logging based on `deepDebug` flag.

# 2026-01-07 v0.9.62 - Documentation Update (AMDGPU Guide)

**Goal**: Provide detailed hardware and software guidance for AMDGPU users, specifically for `gpu.js` acceleration and future AI integration.

- [x] **Documentation**
  - [x] **README.md**: Add "Hardware & Driver Requirements" section detailing RDNA architectures, driver selection (Adrenalin vs Mesa/ROCm), and build dependencies for `headless-gl`.

# 2026-01-07 v0.9.61 - Frontend Memory Optimization (Auto-Canvas)

**Goal**: Reduce frontend memory consumption and improve rendering performance for large graphs by automatically defaulting to "Canvas" mode when the node count exceeds a threshold.

- [x] **Smart Defaults**
  - [x] **Threshold Check**: In `app.js`, check if `nodes.length > 3000`.
  - [x] **Auto-Switch**: If threshold exceeded, programmatically select "Canvas" renderer and update DOM visibility (hide SVG, show Canvas) during initialization.
  - [x] **User Override**: Users can still manually switch back to SVG if desired.

# 2026-01-07 v0.9.60 - Parallel Graph Metrics

**Goal**: Optimize graph construction performance by parallelizing the "Graph Metrics" calculation (Betweenness Centrality), which was previously single-threaded.

- [x] **Parallelization**
  - [x] **Worker Implementation**: Created `betweennessWorker.ts` to calculate partial centrality scores for a subset of nodes using Brandes Algorithm.
  - [x] **Async Logic**: Updated `GraphMetrics` to `calculateBetweennessAsync` using a pool of workers (Default: `numCPUs - 1`).
  - [x] **Integration**: Integrated async metrics calculation into `GraphBuilder` pipeline.
  - [x] **Verification**: Validated functionality with `test_metrics_parallel.ts` on 500+ nodes.

# 2026-01-07 v0.9.59 - Vector Space Memory Fix (Sparse Matrix)

**Goal**: Resolve the "Heap out of memory" crash on Windows 10/11 (128GB RAM) when processing 13k+ files by replacing the dense TF-IDF matrix with a Sparse Vector implementation.

- [x] **Memory Optimization**
  - [x] **Sparse Vectors**: Refactored `VectorSpace` to use `Uint32Array` (indices) and `Float32Array` (values) instead of standard Javascript Arrays.
  - [x] **Efficiency**: Reduced memory footprint for 13k files from ~10GB+ (dense) to <500MB (sparse).
  - [x] **Algorithm**: Optimized Cosine Similarity calculation to use sparse dot product ($O(min(N, M))$).
  - [x] **Config**: Increased default Node.js heap limit to 12GB (`--max-old-space-size=12288`) in `package.json` to utilize available system RAM.

# 2026-01-07 v0.9.58 - Hybrid Inference Resource Reuse (Optimization)

**Goal**: Fix "Heap out of memory" crash during Hybrid Inference by preventing redundant calculation of Statistical Matrix and Vector Space.

- [x] **Resource Optimization**
  - [x] **Shared State**: Implemented `sharedStatsMatrix` and `sharedVectorSpace` in `GraphBuilder`.
  - [x] **Logic**: Pre-calculates these heavy resources if `HybridInference` is enabled, reusing them across Statistical and Vector steps.
  - [x] **Cleanup**: Explicitly clears shared resources after inference is complete.
  - [x] **Result**: Eliminates the 2x memory spike when running Hybrid Inference, preventing OOM on 13k+ files.

# 2026-01-07 v0.9.57 - Worker Memory Optimization

**Goal**: Resolve "Heap out of memory" errors on Windows 10/11 when processing large datasets (13k+ files) by optimizing data transfer between main thread and workers.

- [x] **Worker Data Transfer**
  - [x] **Optimization**: Refactored `keywordMatchWorker` and `statisticalWorker` to accept `filePaths: string[]` instead of `filesChunk: RawFile[]` (which contained full content).
  - [x] **Implementation**: Workers now read file content on-demand from disk using `fs`, avoiding the massive memory overhead of cloning content strings during serialization.
  - [x] **Result**: Significantly reduced heap usage during parallel processing steps.

# 2026-01-05 v0.9.56 - Hybrid Inference Memory Analysis

**Goal**: Analyze and optimize the memory usage of the "Hybrid Inference" engine to resolve "Heap out of memory" errors on Windows 10, preventing large object retention during graph construction.

- [x] **Granular Logging**
  - [x] **Implementation**: Added detailed `PerformanceLogger` steps within `HybridEngine.infer` and `GraphBuilder` (Stats Matrix, Vector Space, Inference Engine).
  - [x] **Progress Tracking**: Logs memory usage every 1000 nodes processed during inference to pinpoint spikes.
  - [x] **Optimization**: Explicitly clears the large `matrix` and nullifies `vectorSpace` immediately after inference to release heap memory before subsequent steps.

# 2026-01-05 v0.9.55 - Heap OOM Fix & Iterative DFS

**Goal**: Resolve "Heap out of memory" crash on Windows 10/11 by optimizing memory usage during graph construction and refactoring recursion to iteration.

- [x] **Memory Optimization**

  - [x] **Scope Management**: Explicitly clear `fileMap` (holding file contents) before entering the memory-intensive `Algorithmic Core` phase in `GraphBuilder`.
  - [x] **Granular Logging**: Split `Algorithmic Core` logging into `Cycle Detection` and `Topological Sort` for precise error tracking.

- [x] **Algorithm Robustness**
  - [x] **Iterative DFS**: Refactored `CycleDetector.detectCycles` to use an iterative stack-based approach instead of recursion to prevent stack overflow on deep graphs.
  - [x] **Verification**: Validated logic with existing unit tests.

# 2026-01-05 v0.9.54 - Welcome & Empty State Experience

**Goal**: Improve the new user onboarding experience by providing clear guidance when the graph is empty.

- [x] **Empty State Handling**
  - [x] **Detection**: Logic in `welcome.js` detects if `graphData` is empty or missing.
  - [x] **Welcome Modal**: Implemented a "Welcome to NoteConnection" modal that guides users to:
    1. Select a Source Folder.
    2. Click Load.
  - [x] **Visual Cues**: Highlights the Source Control area when the modal is active.

# 2026-01-05 v0.9.53 - Core API Decoupling

**Goal**: Prepare the codebase for Plugin integration (Joplin/Obsidian) by decoupling the core logic from the CLI environment.

- [x] **Core Refactoring**
  - [x] **NoteConnection Class**: Created `src/core/NoteConnection.ts` as the main facade.
  - [x] **Decoupling**: Moved `buildGraph` logic out of `src/index.ts` to allow library-style usage.
  - [x] **CLI Update**: Refactored `src/index.ts` to consume the new Core API.

# 2026-01-05 v0.9.52 - Cycle Detection Memory Optimization

**Goal**: Solve the "Heap out of memory" crash on Windows 10/11 when processing large graphs with many cycles (100k+ edges).

- [x] **Cycle Detection Optimization**
  - [x] **Limit Logic**: Updated `CycleDetector` to accept a `limit` parameter.
  - [x] **Termination**: Stops recursion/search immediately after finding the specified number of cycles (100) instead of collecting all of them.
  - [x] **Verification**: Added unit tests to ensure limit is respected.

# 2026-01-03 v0.9.51 - Performance Logging & Crash Reporting

**Goal**: Enhance system observability by implementing detailed performance metrics and automatic crash reporting to facilitate debugging.

- [x] **Performance Logger**
  - [x] **Utility**: Created `PerformanceLogger` class to track Time, CPU (User/Sys), and Memory (Heap/RSS).
  - [x] **Integration**: Wrapped all `GraphBuilder` stages (Node Init, Edge Matching, Inference) with logging.
  - [x] **GPU Tracking**: Integrated logging into `VectorSpaceGPU` to monitor kernel execution time.
- [x] **Crash Reporting**
  - [x] **Utility**: Created `CrashLogger` to write unhandled errors to `crash.log`.
  - [x] **Integration**: Attached global handlers (`uncaughtException`, `unhandledRejection`) in `server.ts`.
  - [x] **Workers**: Added try-catch blocks and logger integration to `keywordMatchWorker` and `statisticalWorker`.

# 2026-01-02 v0.9.50 - GPU Acceleration Feasibility

**Goal**: Verify and implement GPU acceleration for mathematical operations (Matrix Multiplication) to further speed up Graph Construction on supported hardware (verified on AMD 7900XT).

- [x] **Feasibility Verification**
  - [x] **Library**: Installed `gpu.js` to bridge Node.js with GPU via WebGL/OpenCL.
  - [x] **Hardware Check**: Verified successful kernel compilation and execution on AMD Radeon 7900XT (Windows 10).
  - [x] **Benchmark**: Matrix Multiplication (512x512) completed successfully in GPU mode.
- [x] **Implementation Plan**
  - [x] **Vector Space**: Offload the $N \times N$ Cosine Similarity matrix calculation to GPU (`amdgpu/VectorSpaceGPU.ts`).
  - [x] **Constraint**: Keep string processing (Keyword Matching) on CPU (Workers) as data transfer overhead to GPU outweighs benefits for text.

---

# 2026-01-02 v0.9.49 - Statistical Analysis Memory Optimization

**Goal**: Fix "Heap out of memory" errors when processing large datasets (10k+ files) by optimizing the Co-occurrence Matrix calculation.

- [x] **Algorithm Optimization**
  - [x] **Sparse Matrix Calculation**: Refactored `calculateMatrixOptimized` to use a file-centric iteration approach ($O(Files \times TermsPerFile^2)$) instead of the dense term-pair iteration ($O(TotalTerms^2)$).
  - [x] **Reduction of Complexity**: Reduced complexity from ~170 million iterations (for 13k nodes) to ~5 million iterations.
  - [x] **Data Structure Efficiency**: Removed unnecessary intermediate object conversions (`Set` <-> `Array`) during worker result aggregation.
  - [x] **Worker Result Merging**: Optimized `runParallelTermExtraction` to merge chunks iteratively instead of using `reduce` to prevent memory spikes.

---

# 2026-01-02 v0.9.48 - Parallel Processing Optimization

**Goal**: Optimize graph building performance by allowing configurable worker thread limits, utilizing more CPU cores for large datasets.

- [x] **Worker Configuration**
  - [x] **Configurable Limit**: Added `maxWorkers` to `AppConfig` to override the default worker limit.
  - [x] **Removal of Cap**: Removed the hardcoded 12-worker limit in `GraphBuilder` and `StatisticalAnalyzer`. Defaults to `numCPUs - 1` if not specified.
  - [x] **Verification**: Validated with 50 workers on test dataset.

---

# 2026-01-02 v0.9.47 - Focus Mode Interaction & Layout Fixes

**Goal**: Improve Focus Mode usability by preventing accidental zooming and fixing label overlap in Vertical layouts.

- [x] **Interaction Logic**

  - [x] **Double Click Zoom Prevention**: Added `stopPropagation` to the node double-click handler to prevent `d3.zoom` from triggering a zoom-in event when entering Focus Mode.

- [x] **Focus Mode Layout**
  - [x] **Vertical Spacing**: In "Vertical" (L-R) layout, increased the horizontal offset (`dx`) of node labels to **35px** (from default ~12px) to prevent overlap between text and nodes.
  - [x] **Focus Node**: Applied the same horizontal offset to the central Focus Node in vertical layout for consistency.

---

# 2025-12-26 v0.9.46 - Focus Mode UI Cleanup & Canvas Edge Fix

**Goal**: Clean up the UI during Focus Mode to reduce clutter and fix visual rendering in Canvas mode.

- [x] **UI Hiding**

  - [x] **Main Controls**: "Select Knowledge Base", "Load", and the main "NoteConnection" dropdown are now completely hidden (`display: none`) when entering Focus Mode.
  - [x] **Restoration**: Elements are restored to their default state (`display: ''`) upon exiting Focus Mode, respecting CSS rules (e.g., mobile visibility).

- [x] **Canvas Visualization**
  - [x] **Edge Hiding**: In Canvas Focus Mode, _all_ edges are now hidden to provide a cleaner look, matching the "do not display any edges" requirement.

---

# 2025-12-26 v0.9.45 - Canvas Interactivity & cleanup

**Goal**: Enable full interactivity (Hover, Click, Focus) in Canvas mode and remove the deprecated "View Mode" (Clusters) feature.

- [x] **Canvas Interactivity**

  - [x] **Hit Testing**: Implemented `findNodeAt(x, y)` to detect nodes under the mouse cursor in Canvas mode, accounting for zoom/pan transforms.
  - [x] **Event Listeners**: Added `mousemove` (highlighting) and `click` (inspection/focus) handlers to the canvas element.
  - [x] **Consistency**: Canvas interaction now matches SVG behavior (Single click -> Stats, Double click -> Focus).

- [x] **Visual Fixes**

  - [x] **Node Sizing**: Updated `renderCanvas` to respect the "Size By" setting (Degree/Centrality/Uniform), fixing the issue where nodes were rendered too large.

- [x] **Cleanup**
  - [x] **View Mode Removal**: Removed "View Mode" (Nodes/Clusters) controls and associated logic from the codebase as it was deprecated.

---

# 2025-12-26 v0.9.44 - Independent Focus Mode Spacing

**Goal**: Allow users to configure "Layer-Space" and "Node-Space" independently for "Horizontal" and "Vertical" layouts in Focus Mode, preventing settings from one layout affecting the other.

- [x] **Spacing Logic**
  - [x] **State Management**: Created `focusSpacingSettings` to store separate `layer` and `node` values for `horizontal` and `vertical` modes.
  - [x] **Defaults**:
    - **Horizontal**: Layer-Space defaulted to **125** (was 250).
    - **Vertical**: Node-Space defaulted to **20** (was 80).
  - [x] **UI Sync**: Switching the Focus Layout dropdown now automatically updates the sliders to reflect the stored values for that specific mode.
  - [x] **Persistence**: Adjusting sliders updates the setting for the _current_ mode only.

---

# 2025-12-26 v0.9.43 - Context-Aware Settings UI

**Goal**: Improve user clarity by dynamically updating the labels in the Settings Modal to reflect the currently active layout mode.

- [x] **UI Enhancement**
  - [x] **Label Switching**: The label for the repulsion slider now updates to "Repulsion (Force)" or "Repulsion (DAG)" based on the active layout when the settings modal is opened.
  - [x] **Localization**: Supports dynamic label switching for both English and Chinese locales.

---

# 2025-12-26 v0.9.42 - Distinct Repulsion Settings

**Goal**: Allow users to configure distinct "Repulsion Strength" values for "Force" and "DAG" layout modes, with layout-specific defaults.

- [x] **Settings Logic**
  - [x] **Data Structure**: Updated `defaultSettings` in `settings.js` to store separate keys: `repulsionForce` (Default: -550) and `repulsionDAG` (Default: -850).
  - [x] **Context-Aware UI**: The "Visualization Settings" modal now automatically displays and updates the repulsion value corresponding to the currently active layout mode.
  - [x] **Dynamic Application**: Switching layouts (`updateLayout`) or changing settings (`settingsManager.subscribe`) dynamically applies the correct force strength.

---

# 2025-12-26 v0.9.41 - Settings Modal Simulation Freeze

**Goal**: Automatically freeze the simulation when the "Visualization Settings" modal is opened to conserve memory/CPU and prevent background activity during configuration.

- [x] **Modal State Logic**
  - [x] **Auto-Freeze**: Opening the Settings Modal (`initSettingsUI`) now triggers `simulation.stop()` and sets an internal `isSettingsModalOpen` flag.
  - [x] **Conditional Resume**: Closing the modal resumes the simulation _only_ if the global "Freeze Layout" checkbox is not checked.
  - [x] **Update Suppression**: Updates triggered by `settingsManager` while the modal is open (e.g. slider drags) apply values but do _not_ restart the simulation loop.

---

# 2025-12-26 v0.9.40 - Freeze Layout Priority Fix (Settings Modal)

**Goal**: Ensure that changing Physics or Visual settings in the "Visualization Settings" modal does not restart the simulation if "Freeze Layout" is currently enabled.

- [x] **Settings Application Logic**
  - [x] **Conditional Restart**: Modified `settingsManager.subscribe` callback in `app.js` to check the "Freeze Layout" checkbox state.
  - [x] **Behavior**:
    - **Frozen**: Forces (charge, distance, collision) are updated in the background, but `simulation.restart()` is skipped. Visual changes (opacity) apply immediately.
    - **Unfrozen**: Forces are updated and simulation restarts (alpha 0.3).

---

# 2025-12-26 v0.9.39 - Layout Switch Relaxation & Freeze Logic

**Goal**: Apply the "Rapid Relaxation" strategy (0.2 damping -> 0.95 damping) when switching layouts, ensuring consistent behavior with initial load. Additionally, ensure "Freeze Layout" is respected after the relaxation period.

- [x] **Layout Transition Logic**
  - [x] **Relaxation**: Switching to a new layout (Force/DAG) resets `velocityDecay` to **0.2** for 2 seconds to allow nodes to find their new positions quickly.
  - [x] **Stabilization**: Automatically transitions to **0.95** damping after 2 seconds.
  - [x] **Delayed Freeze**: If "Freeze Layout" is enabled during the switch, the simulation runs for the 2-second relaxation phase and then automatically **stops**, freezing the new layout in its stabilized state.

---

# 2025-12-26 v0.9.38 - Quick Start Guide HTML Rendering Fix

**Goal**: Fix the issue where HTML tags (like `<br>` and `<strong>`) in the localized Quick Start Guide content were being displayed as raw text instead of being rendered.

- [x] **Rendering Logic**
  - [x] **HTML Support**: Updated `window.updateLanguage` in `app.js` to use `.innerHTML` instead of `.innerText` when injecting translated content. This ensures rich text elements in the guide are displayed correctly.

---

# 2025-12-26 v0.9.37 - Rapid Relaxation Strategy

**Goal**: Implement a two-stage damping process to allow the graph to "unfold" quickly upon load before stabilizing.

- [x] **Damping Logic**
  - [x] **Initial Phase**: Set `velocityDecay` to **0.2** for the first 2 seconds. This low friction allows nodes to rapidly move away from the center and untangle.
  - [x] **Stable Phase**: Automatically transition to **0.95** (high friction) after 2 seconds to stabilize the layout (Updated from 0.92).
  - [x] **Interaction Safety**: Ensures the auto-transition does not override manual slider adjustments made during the initial phase.

---

# 2025-12-26 v0.9.36 - Freeze Layout Priority Fix (Visual Settings)

**Goal**: Ensure that changing visual settings (Degree Basis, Size By) does not trigger a simulation restart if "Freeze Layout" is enabled, respecting the user's command to keep nodes stationary.

- [x] **Visual Update Logic**
  - [x] **Conditional Restart**: Modified `updateSize()` in `app.js` to check the "Freeze Layout" checkbox state.
  - [x] **Behavior**: If frozen, visual attributes (radius, font size) update immediately, but `simulation.restart()` is skipped. The collision force is updated in the background, ready for when the user unfreezes.

---

# 2025-12-26 v0.9.35 - Viewport Culling Relaxation

**Goal**: Relax the viewport culling restrictions to provide a smoother user experience, preventing premature freezing of nodes just outside the viewport and allowing for deeper zooms before global freeze.

- [x] **Culling Optimization**
  - [x] **Full Freeze Threshold**: Lowered from `scale < 0.4` to `scale < 0.1` to allow simulation at broader zoom levels.
  - [x] **Dynamic Buffer**: Increased off-screen buffer from fixed `100` units to `800 / scale` (approx 800 visual pixels), ensuring "fixed range extending outward" behavior.

---

# 2025-12-26 v0.9.34 - Global Layout Update Fix

**Goal**: Ensure that layout switching applies to all nodes in the graph, overriding any optimization constraints (like viewport culling) that might have frozen off-screen nodes.

- [x] **Layout Transition Logic**
  - [x] **Global Unfreeze**: In `updateLayout()`, explicitly clear `fx` and `fy` properties for all nodes when initiating a new simulation.
  - [x] **Culling Reset**: Reset the `isCulled` flag to ensure off-screen nodes are included in the new layout calculation and rendering.
  - [x] **Result**: Switching from 'Force' to 'DAG' (or vice versa) correctly rearranges the entire graph, even if the user is zoomed in and many nodes were previously frozen.

---

# 2025-12-26 v0.9.33 - Layout State Caching (Instant Switch)

**Goal**: Implement state caching to allow switching between layouts ("Force" vs "DAG") without recalculating positions or animating the transition, fulfilling the "template state" requirement.

- [x] **State Management**
  - [x] **Cache**: Create `layoutCache` to store `x, y, fx, fy` for each mode.
  - [x] **Save/Restore**: Implement logic to save current positions before switching and restore target positions after switching.
- [x] **Transition Logic**
  - [x] **Instant Switch**: If a layout state is cached, restore positions and skip the simulation warm-up (`alpha(1)`), effectively teleporting nodes to their previous state.
  - [x] **First Run**: If no cache exists, perform standard simulation.

---

# 2025-12-26 v0.9.32 - High Damping & Render Optimization

**Goal**: Further reduce memory/CPU consumption by increasing simulation friction and skipping DOM updates for frozen off-screen nodes.

- [x] **Damping Adjustment**

  - [x] **Default**: Increased `velocityDecay` to **0.92**.
  - [x] **Effect**: Graph settles much faster; movement is "heavier" and less jittery.

- [x] **Render Culling (DOM)**
  - [x] **Logic**: In `ticked()`, filter the D3 selection to only update nodes that are NOT flagged as `isCulled`.
  - [x] **Mechanism**: `checkSimulationState` sets `isCulled = true` for off-screen nodes.
  - [x] **Benefit**: Avoids thousands of expensive DOM attribute updates per frame for nodes the user cannot see.

---

# 2025-12-26 v0.9.31 - Simulation Optimization (Viewport Culling)

**Goal**: Reduce memory and CPU consumption by minimizing particle movement calculations based on zoom level and viewport visibility.

- [x] **Viewport Culling Logic**
  - [x] **Full View Freeze**: If the user zooms out enough to see the entire graph (or a large portion), automatically stop the simulation to save resources, assuming the layout is stable.
  - [x] **Off-screen Freezing**: When zoomed in, only simulate nodes within the visible viewport. Freeze nodes outside the viewport.
  - [x] **Implementation**:
    - [x] Add `checkSimulationState()` triggered by zoom events.
    - [x] Calculate visible bounds based on `event.transform`.
    - [x] Update `simulation.nodes()` to only include visible nodes (plus a buffer) or use `fx`/`fy` to lock off-screen nodes.

---

# 2025-12-26 v0.9.30 - Focus Mode Layout Isolation

**Goal**: Ensure that layout changes occurring within Focus Mode (automatic arrangement or manual dragging) do not affect the node positions in the main interface upon exiting.

- [x] **Position Backup & Restoration**
  - [x] **Backup**: In `enterFocusMode`, save the current `x`, `y`, `fx`, and `fy` coordinates of all nodes.
  - [x] **Restoration**: In `exitFocusMode`, restore these coordinates to their pre-focus state.
  - [x] **Consistency**: Ensure the graph visual state reverts exactly to how it was before entering Focus Mode.

---

# 2025-12-26 v0.9.29 - Freeze Layout Persistence

**Goal**: Fix bug where "Analysis & Export" (and other layout resizes) would override the "Freeze Layout" state, causing unwanted node movement.

- [x] **Layout Resize Logic**
  - [x] **Behavior**: Modified `ResizeObserver` in `app.js` to strictly check the "Freeze Layout" checkbox state before calling `simulation.restart()`.
  - [x] **Canvas Sync**: Ensured `resizeCanvas()` is called during layout changes to keep the canvas resolution correct even if the simulation is frozen.
  - [x] **Result**: Opening the Analysis Panel or resizing the window now respects the frozen state, keeping nodes stationary.

---

# 2025-12-26 v0.9.28 - Focus Mode Specific Content Access

**Goal**: Optimize user experience by providing a direct way to open specific node content within Focus Mode, avoiding the need for double-clicking.

- [x] **Specific Content Button**

  - [x] **UI**: Added a "Specific Content" button (`#btn-open-content`) to the Focus Mode control panel (`#focus-exit-btn`).
  - [x] **Logic**: Clicking the button triggers `window.reader.open(focusNode)`, mimicking the double-click behavior on a focused node.
  - [x] **Localization**: Added support for English ("Open Specific Content") and Chinese ("打开具体内容").

- [x] **Documentation**
  - [x] **User Manual**: Updated Focus Mode section.
  - [x] **Interface Document**: Updated Focus Mode capabilities.
  - [x] **TEST_REPORT**: Added test case for the new button.

---

# 2025-12-26 v0.9.27 - Conditional Restart

**Goal**: Ensure "Freeze Layout" state is respected when exiting Focus Mode.

- [x] **Conflict Resolution**
  - [x] **Logic**: In `exitFocusMode`, check if "Freeze Layout" is checked.
  - [x] **Behavior**: If checked, call `simulation.stop()` instead of `restart()`, preventing unwanted movement.
  - [x] **Visual**: Manually trigger `ticked()` to ensure the graph renders the restored nodes in their current positions.

# 2025-12-26 v0.9.26 - UX Enhancements

**Goal**: Improve mobile usability and onboard new users effectively.

- [x] **Freeze Layout Button**

  - [x] **UI**: Add a dedicated "Freeze Layout" button to the main interface (top-right or near controls) for quick access, especially on mobile.
  - [x] **Logic**: Link button to the existing simulation freeze functionality. Sync state with the checkbox in controls.
  - [x] **Visual**: Use an icon (e.g., Lock/Unlock) to indicate state.

- [x] **Quick Start Manual**

  - [x] **Content**: Create a concise "How to Use" guide covering:
    - Loading Data
    - Navigation (Pan/Zoom)
    - Focus Mode (Double Click)
    - Inspection (Click/Hover)
    - Analysis Panel
  - [x] **UI**: Implement as a Modal that opens on first load (localStorage check) or via a "Help" button.
  - [x] **Localization**: Support English and Chinese.

- [x] **Documentation**
  - [x] **Interface Document**: Update with new UI elements.
  - [x] **README**: Add changelog.
  - [x] **Test Report**: Verify new features.

---

# 2025-12-25 v0.9.25 - Freeze Layout Optimization

**Goal**: Minimize resource usage by strictly freezing the main graph when requested, preventing user interactions that would wake the simulation.

- [x] **Freeze Layout Enhancement**

  - [x] **Behavior**: Checking "Freeze Layout" now disables node dragging in the main interface (SVG Mode).
  - [x] **Constraint**: This restriction does _not_ apply to Focus Mode, where manual adjustment is still permitted.
  - [x] **Performance**: Prevents `simulation.restart()` triggers from drag events, ensuring the simulation stays effectively stopped (0% CPU usage).

- [x] **Documentation**
  - [x] **Interface Document**: Updated Simulation Controls section.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified behavior.

---

# 2025-12-25 v0.9.24 - Focus Mode Memory Optimization

**Goal**: Reduce memory/CPU expenditure in SVG mode by freezing background nodes during Focus Mode.

- [x] **Simulation Optimization**

  - [x] **Subsetting**: Modified `enterFocusMode` to filter `simulation.nodes()` and `simulation.force("link").links()` to only include the focused subset.
  - [x] **Freezing**: Background nodes are effectively frozen as they are no longer processed by D3 forces.
  - [x] **Restoration**: Modified `exitFocusMode` to restore the full set of nodes and links to the simulation.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with optimization details.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified optimization behavior.

---

# 2025-12-25 v0.9.23 - Default Settings Adjustment

**Goal**: Adjust default settings for Reading Window font size and Simulation Damping based on user feedback.

- [x] **Reading Window Font Size**

  - [x] **Implementation**: Modified `Reader` class in `reader.js` to set `currentZoom` to 0.5 by default.
  - [x] **Logic**: Affects initialization and reset on open.

- [x] **Simulation Damping**
  - [x] **Implementation**: Updated `app.js` to initialize `d3.forceSimulation` with `.velocityDecay(0.6)`.
  - [x] **UI**: Updated `index.html` slider default value and display text to 0.6.

---

# 2025-12-25 v0.9.22 - Mobile Popup Adaptation

**Goal**: Adapt the node statistics popup for mobile devices with touch-based drag and pinch-to-zoom capabilities.

- [x] **Touch Drag Support**

  - [x] **Implementation**: Added `touchstart`, `touchmove`, `touchend` listeners to `popupDragHandle`.
  - [x] **Logic**: Mirrors mouse drag logic using `touches[0]` coordinates.
  - [x] **Constraint**: Requires single-finger touch on the header.

- [x] **Pinch-to-Zoom Support**

  - [x] **Implementation**: Added `touchstart`, `touchmove`, `touchend` listeners to `statsPopup`.
  - [x] **Logic**: Calculates distance between two fingers (`Math.hypot`) to determine scale ratio.
  - [x] **Scaling**: Updates `popupDragState.currentScale` and applies to `fontSize`.
  - [x] **Clamping**: Restricted scale between 0.5x and 2.0x.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with mobile interaction specs.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified mobile interactions.

---

# 2025-12-25 v0.9.21 - Strict Edge Visibility & Optimization

**Goal**: Enforce strict edge visibility rules (hidden by default) and optimize rendering for large graphs.

- [x] **Strict Edge Visibility**

  - [x] **SVG Mode**: Modified `updateVisibility` in `app.js` to set default edge opacity to 0 (was 0.15).
  - [x] **Consistency**: Ensured SVG behavior matches Canvas mode (hidden by default).
  - [x] **Performance**: Reduced visual clutter and rendering cost for initial view.

- [x] **Documentation**
  - [x] **Interface Document**: Updated to reflect strict edge visibility in v0.9.21.
  - [x] **README**: Added v0.9.21 changelog.
  - [x] **Test Report**: Verified behavior for v0.9.21.

---

# 2025-12-24 v0.9.20 - Selection State Auto-Clear on Focus Entry

**Goal**: Automatically clear any existing selection or highlight state when entering Focus Mode via double-click for a clean transition.

- [x] **Auto-Clear Implementation**

  - [x] **Highlight Clearing**: Modified `handleDoubleClick()` to call `highlightManager.unhighlight({ force: true })` before entering focus mode.
  - [x] **Popup Hiding**: Automatically hide the statistics popup (`#node-stats-popup`) when entering focus mode.
  - [x] **State Management**: Ensures clean state transition without residual visual artifacts.

- [x] **User Experience Enhancement**

  - [x] **Clean Transition**: Users always start with a pristine focused context.
  - [x] **Visual Clarity**: Prevents confusion from overlapping highlights between normal and focus modes.
  - [x] **Consistent Behavior**: Standardized focus mode entry behavior across all scenarios.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with v0.9.20 selection auto-clear specifications.
  - [x] **README**: Added v0.9.20 changelog entries in both English and Chinese.
  - [x] **Code Comments**: Bilingual comments explaining the auto-clear logic.
  - [x] **TODO**: Documented completed feature implementation.

---

# 2025-12-24 v0.9.19 - Focus Mode & Popup Enhancements

**Goal**: Fix focus mode refresh issues and add drag/zoom functionality to the statistics popup for better user experience.

- [x] **Focus Mode Re-entry Fix**

  - [x] **Double-Click Behavior**: Modified `handleDoubleClick()` to allow re-entering focus mode on related nodes while already in focus mode.
  - [x] **State Reset**: Ensured all node visibility flags (`isFocusVisible`, `fx`, `fy`, `_labelDy`) are properly reset before entering new focus context.
  - [x] **Prevention**: Removed the restriction that blocked switching focus between related nodes in `enterFocusMode()`.

- [x] **Statistics Popup Enhancements**
  - [x] **Drag Functionality**: Implemented mouse-based dragging by clicking and dragging the popup header.
    - [x] **State Tracking**: Created `popupDragState` to track drag position and scale.
    - [x] **Event Handlers**: Added `mousedown`, `mousemove`, and `mouseup` listeners for drag control.
    - [x] **Visual Feedback**: Added `.dragging` class for cursor feedback during drag.
  - [x] **Zoom Controls**: Added three zoom buttons (+, −, ⟲) to scale popup content.
    - [x] **Scale Range**: 0.5x to 2.0x with 0.1 increments.
    - [x] **Implementation**: Applied scaling via `fontSize` CSS property on `.popup-content`.
    - [x] **Reset Function**: Reset button restores default size and scale.
  - [x] **Resizable**: Enabled CSS `resize: both` for browser-native resize functionality.
    - [x] **Constraints**: Set min/max width and height constraints.
    - [x] **Scrolling**: Ensured content scrolls properly when resized.
  - [x] **Position Reset**: On close, popup position resets to default (top-right).
- [x] **Documentation**
  - [x] **Interface Document**: Updated with v0.9.19 drag/zoom interface specifications.
  - [x] **README**: Added v0.9.19 changelog entries in both English and Chinese.
  - [x] **Bilingual Comments**: Code comments in both languages for all new functionality.
  - [x] **CSS**: Documented new styles for draggable, zoomable, and resizable popup.

---

# 2025-12-24 v0.9.18 - Node Highlighting System Refactor

**Goal**: Reconstruct node highlighting logic with modular architecture for better maintainability and robustness.

- [x] **Modular Architecture**

  - [x] **NodeHighlightManager Class**: Created dedicated module (`nodeHighlight.js`) with complete state management.
  - [x] **API Design**: Implemented clean public API with `highlight()`, `unhighlight()`, `getState()`, and helper methods.
  - [x] **Integration**: Fully integrated into app.js replacing old highlighting functions.

- [x] **Unified Interaction Model**

  - [x] **PC Support**: Hover-based highlighting without freezing simulation.
  - [x] **Mobile Support**: Click-based highlighting with simulation freeze for stable inspection.
  - [x] **State Consistency**: Proper tracking of frozen vs temporary highlight states.

- [x] **Rendering Enhancements**

  - [x] **SVG Mode**: Directional edge coloring (Blue=#4488ff outgoing, Red=#ff6b6b incoming) with matching arrow markers.
  - [x] **Canvas Mode**: Updated to use highlightManager state for consistent visual behavior.
  - [x] **Dimming Effect**: Unconnected nodes dim to 0.05 opacity during highlight for clearer focus.

- [x] **Focus Mode Integration**

  - [x] **State Awareness**: highlightManager respects focus mode and doesn't interfere.
  - [x] **Coordination**: Focus mode entry/exit properly updates highlightManager state.

- [x] **Documentation**
  - [x] **Bilingual Comments**: Comprehensive Chinese/English comments throughout code.
  - [x] **Interface Document**: Updated with complete NodeHighlightManager API reference.
  - [x] **README**: Added v0.9.18 changelog entry in both languages.
  - [x] **Integration Guide**: Created detailed integration instructions.

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

# 2025-12-24 v0.9.17 - SVG Visual Completeness

**Goal**: Complete the visual feedback loop for SVG mode interactions.

- [x] **SVG Renderer**
  - [x] **Colored Markers**: Implemented dynamic marker switching (Red/Blue arrows) to match the edge color during highlight.
  - [x] **Visual Consistency**: Ensured arrows revert to gray when highlighting is cleared.

# 2025-12-24 v0.9.16 - Interaction Completeness

**Goal**: Ensure complete visualization of node relationships during inspection.

- [x] **Interaction Logic**
  - [x] **Always-On Context**: Clicking a node now forces the display of _all_ In-degree and Out-degree relationships, overriding any active "Incoming Only" or "Outgoing Only" filters to ensure complete context is visible.
- [x] **Canvas Renderer**
  - [x] **Visual Parity**: Implemented bold line rendering (2.5px width) for highlighted edges in the Canvas engine to match SVG styling.

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

### 2025-12-23 v0.9.0 - Precise Control & Stability

**Goal**: Provide tools for manual layout control and stable inspection.

- [x] **Hover Logic**
  - [x] **Auto-Freeze**: Lock node position on hover to facilitate inspection.
- [x] **Simulation UX**
  - [x] **Controls**: Add Speed slider and Freeze Layout toggle.
  - [x] **Manual Placement**: Allow manual node positioning when layout is frozen without auto-revert.

### 2025-12-23 v0.9.1 - Mobile Transformation

**Goal**: Transform the current web project into an Android APK application.

- [x] **Capacitor Integration**
  - [x] **Initialization**: Configured `capacitor.config.ts`.
  - [x] **Platform Support**: Added Android platform via `@capacitor/android`.
  - [x] **Asset Management**: Implemented `copy-assets` script and `npx cap sync`.
  - [x] **Build Pipeline**: Verified Gradle build configuration (`assembleDebug`).

### 2025-12-23 v0.9.2 - Mobile UI Optimization

**Goal**: Optimize UI/UX for small touch screens.

- [x] **Responsive Controls**
  - [x] **Collapsible Menu**: Main controls collapse to a button on mobile to save screen space.
  - [x] **Focus Mode UI**: Relocated "Exit Focus" button to bottom-center for accessibility.
  - [x] **Settings Consolidation**: Moved Language Selector into Settings Modal to declutter the interface.
- [x] **Touch Interactions**
  - [x] **Pinch-to-Zoom**: Added multi-touch support in Reading Window for text scaling.
  - [x] **Touch Targets**: Enlarged buttons and inputs for touch accuracy.

### 2025-12-23 v0.9.3 - Mobile Interaction Iteration

**Goal**: Refine interaction logic for mobile usability.

- [x] **Interaction Logic Update**
  - [x] **Single Click**: Triggers node highlight and tooltip (In/Out Degree display).
  - [x] **Double Click**: Triggers Focus Mode entry.
  - [x] **Desktop Compatibility**: Preserved `mouseover` for desktop hover while unifying click logic.

### 2025-12-23 v0.9.4 - Mermaid Image Optimization

**Goal**: Enhance reading experience for diagrams on mobile devices.

- [x] **Mermaid Zoom Mode**
  - [x] **Interaction**: Clicking a Mermaid diagram opens a full-screen overlay.
  - [x] **Gestures**: Implemented Pan (drag) and Zoom (pinch/wheel) logic within the overlay.
  - [x] **UX**: Added a prominent Exit button to close the zoom mode.

### 2025-12-24 v0.9.5 - Refined Mobile Experience & Focus Semantics

**Goal**: Polish interaction details and visual clarity for mobile and complex graphs.

- [x] **Focus Mode Enhancements**
  - [x] **Centering**: Viewport automatically centers on the focused node's original position.
  - [x] **Semantics**: Added clear area labels ("Helping to understand", "Further exploration").
  - [x] **Layout**: Implemented "Hierarchical (Left-Right)" layout option.
- [x] **Analysis Panel**
  - [x] **Mobile**: Panel is now scrollable and adapted for touch screens.
  - [x] **Interaction**: Clicking rows highlights the node and its connections in the graph.
- [x] **Visual Polish**
  - [x] **Mermaid**: Enhanced text visibility (shadow/outline) for light-colored diagrams.
  - [x] **Lines**: Ensured edges are hidden by default and only visible on interaction.

### 2025-12-24 v0.9.6 - Analysis & Visuals Polish

**Goal**: Further refine Analysis Panel mobile usability and fix visual inconsistencies.

- [x] **Mermaid Zoom Styling**
  - [x] **Fix**: Ensured Mermaid text shadow/grayscale persists in Full-screen Zoom mode.
- [x] **Degree Analysis Mobile**
  - [x] **Full Screen**: Added toggle to switch panel between half-height and full-screen.
  - [x] **Zoom**: Implemented pinch-to-zoom for the panel content.
  - [x] **Interaction**: Verified click-to-highlight logic works across views.
- [x] **Graph Interaction**
  - [x] **Robustness**: Added background click handler to clear highlights.

### 2025-12-24 v0.9.7 - Focus Mode Interaction Fix

**Goal**: Fix usability bugs in Focus Mode.

- [x] **Layout Switching**
  - [x] **Fix**: Switching between "Horizontal" and "Vertical" layouts now immediately refreshes the graph without requiring slider adjustment.

### 2025-12-24 v0.9.8 - Analysis Interaction Refinement

**Goal**: Ensure seamless interaction between Analysis Panel and Graph.

- [x] **Graph Sync**
  - [x] **Tooltip**: Clicking a node in the Analysis Panel now displays the tooltip (stats) on the graph at the node's position.
- [x] **Mobile UX**
  - [x] **Scrolling**: Fixed scroll behavior in Analysis Panel to prevent conflicts.

### 2025-12-24 v0.9.9 - Mobile Analysis Panel Polish

**Goal**: Enhance "Degree Analysis" page for mobile usability with gesture controls.

- [x] **Mobile Adaptation**
  - [x] **Slide Gesture**: Implemented "slide up and down" via touch drag on panel header.
  - [x] **Full Screen**: Supported toggling between floating window and full-screen page, with auto-snap on drag.
  - [x] **Zoom**: Verified two-finger pinch-to-zoom support for the interface.
- [x] **Interaction Verification**
  - [x] **Node Click**: Verified that clicking a node in the panel displays in-degree and out-degree relationships on the graph.

### 2025-12-24 v0.9.10 - Interaction Refinement (Click-to-Freeze)

**Goal**: Improve graph inspection stability by freezing the simulation on node click.

- [x] **Click Interaction**
  - [x] **Freeze on Click**: Clicking a node now immediately stops the force simulation (freezes all nodes) to prevent movement during inspection.
  - [x] **Resume on Cancel**: Clicking the background (blank area) unhighlights the node and resumes the simulation (unless manually frozen).
  - [x] **Visualization**: Ensured in-degree and out-degree lines are displayed clearly when frozen.

### 2025-12-24 v0.9.11 - Node Statistics & Localization

**Goal**: Enhance detailed inspection of nodes and complete internationalization.

- [x] **Focus Mode Localization**
  - [x] **Multi-language**: Implemented `t()` calls for semantic labels ("Helping to understand" / "Further exploration").
- [x] **Node Statistics Panel**
  - [x] **Interaction**: Clicking a node opens a dedicated panel showing relationships.
  - [x] **Visuals**: In-degree lines are Red, Out-degree lines are Blue (#4488ff).
  - [x] **Content**: Panel lists all incoming and outgoing neighbors with navigation support.

### 2025-12-24 v0.9.12 - Independent Statistics Popup

**Goal**: Separate node inspection from global analysis for better UX.

- [x] **Floating Statistics Window**
  - [x] **Interaction**: Clicking a node opens a floating popup showing In/Out degrees.
  - [x] **Visuals**: Distinct Red (In) and Blue (Out) indicators.
  - [x] **Independence**: Does not interfere with the main Degree Analysis panel.

### 2025-12-24 v0.9.13 - Focus Mode Isolation

**Goal**: Ensure specific interaction effects do not bleed into Focus Mode.

- [x] **Interaction Refinement**
  - [x] **Constraint**: Verified that clicking a node while in Focus Mode does _not_ trigger the floating statistics popup or change the highlight style, preserving the specific Focus Mode context.

### 2025-12-24 v0.9.14 - Visual & Data Fixes

**Goal**: Fix visualization of edge directions and data duplication.

- [x] **Edge Highlighting**
  - [x] **Canvas Support**: Implemented Red (In) and Blue (Out) edge coloring in the Canvas renderer (`renderCanvas`), previously generic gray.
- [x] **Data Integrity**
  - [x] **Deduplication**: Used `Set` to prevent duplicate node entries in the Statistics Popup neighbor lists.

### 2025-12-24 v0.9.15 - Enhanced Isolation

**Goal**: Optimize visual focus by effectively hiding unrelated context during inspection.

- [x] **Visual Optimization**
  - [x] **Deep Dimming**: Reduced opacity of unrelated nodes from 0.1 to 0.05 to better satisfy the "temporarily hidden" requirement while maintaining minimal context.
  - [x] **Edge Emphasis**: Increased highlighted edge width to 2.5px for clearer Red/Blue distinction.

### 2026-06-01 v1.0.0 - Production Release

**Goal**: Complete integration with Joplin/Obsidian plugins and polish UX.

- [x] **Plugin Wrapper**

  - Wrap the `NoteConnection` core logic into a Joplin Plugin and an Obsidian Plugin. (API Ready in v0.9.53)

- [x] **User Settings & Documentation (v0.7.0)**
  - [x] **Settings Manager**: Centralized management of application state (Physics, Visuals) with `localStorage` persistence.
  - [x] **Configuration UI**: Settings Modal for tuning Graph Physics (Gravity, Repulsion) and Visual preferences.
  - [x] **Reading Window (v0.8.0)**
    - [x] **Trigger**: Click focused node to open.
    - [x] **Content**: Renders Markdown, KaTeX (Math), Mermaid (Diagrams).
    - [x] **Interaction**: Zoom text and Resize images (Unlocked mode).
    - [x] **Config**: Window/Fullscreen toggle.
  - [x] **Finalize Documentation**: Complete User Manual and Developer Guide.
  - [x] **Final Polish & Demo Packaging**: Ensure zero-config startup (`npm start`) works seamlessly for promotion.
  - [x] **Release**: Package for v1.0.0.

---

# 项目构建计划：渐进式层级知识图谱

本文档概述了构建 `NoteConnection` 的路线图，该系统能够将数万个知识点可视化为有向无环图 (DAG)，重点突出层级关系和学习路径。

---

# 2026-01-12 v0.9.74 - 布局切换与 GPU 稳健性

**目标**: 完成稳定的布局切换状态保存，并解决 GPU 资源管理问题（WebGL 上下文泄漏）。

- [x] **布局切换修复**

  - [x] **状态保存**: 实现了 `layoutCache`，独立存储和恢复 'Force' 和 'DAG' 布局的节点位置 (`x, y, fx, fy`)。
  - [x] **崩溃解决**: 通过重构 `applyPhysics` 的使用，修复了 `updateLayout` 中在初始化前访问 `simulation.force` 导致的关键崩溃。
  - [x] **逻辑**: 布局切换现在可以平滑过渡，没有视觉上的“瞬移”闪烁或模拟重置。

- [x] **GPU 稳健性**
  - [x] **单例模式**: 重构 `layout_gpu.js`，为 `GPUManyBodyForce` 使用单例实例，防止在切换设置时发生 WebGL 上下文溢出（限制 16 个上下文）。
  - [x] **构造安全**: 增强了对 `GPU.GPU` 的检测，以处理不同的库打包方式 (Webpack/Rollup)。

# 2026-01-12 v0.9.73 - GPU 渲染修复 (链式调用 Bug)

**目标**: 修复由于 `layout_gpu.js` 中的链式调用 Bug 导致的 GPU 力“静默失败”，该 Bug 导致 v0.9.72 尽管 UI 设置已开启但未能实际激活 GPU 物理引擎。

- [x] **Bug 修复**
  - [x] **链式调用**: 修复了 `layout_gpu.js` 中的 `strength()` 方法，使其返回 `impl` 函数包装器而不是 `this`。
  - [x] **验证**: 确认 `d3.force` 现在可以正确接收可调用的函数。

# 2026-01-12 v0.9.72 - GPU 优化渲染 (极客版)

**目标**: 满足“极客”需求，利用 AMDGPU (RX 7900XT) 实现更流畅的前端渲染和并行后端处理。

- [x] **前端 GPU 渲染**

  - [x] **GPU 力引擎**: 使用 `gpu.js` 在 `layout_gpu.js` 中实现了 `GPUManyBodyForce`。
  - [x] **集成**: 添加了 `libs/gpu-browser.min.js` 并集成到 `app.js`。
  - [x] **UI 控制**: 验证了设置中的“GPU 优化渲染”复选框。默认值：启用。
  - [x] **逻辑**: 实现 CPU (`d3.forceManyBody`) 和 GPU (`gpuManyBody`) 物理引擎之间的动态切换。

- [x] **后端优化确认**
  - [x] **并行化**: 确认 `GraphBuilder` 使用带有 Worker 线程的 `LayoutEngine`。
  - [x] **GPU 后端**: 确认如果启用了 GPU，`LayoutEngine` 会使用 `amdgpu/LayoutGPU.ts`。

# 2026-01-10 v0.9.71 - 后端布局与静态模式

**目标**: 通过将布局计算卸载到后端 Worker 线程并实施静态渲染模式，优化大规模图谱 (50k+ 节点) 的性能。

- [x] **后端并行布局**

  - [x] **布局引擎**: 创建了 `LayoutEngine.ts` 和 `layoutWorker.ts` 以在后端线程运行 `d3-force` 模拟。
  - [x] **集成**: `GraphBuilder` 现在自动为超过 100 个节点的图谱触发后端布局计算。
  - [x] **GPU 加速**: 使用 `gpu.js` 实现了 `LayoutGPU.ts` 以在 AMDGPU 上加速布局。
  - [x] **性能**: 通过提供预计算的坐标减少前端初始化时间。

- [x] **前端优化**

  - [x] **静态模式**: 引入了“静态模式”切换。
    - [x] **自动启用**: 节点数 >5000 或 边数 >200,000 时自动启用。
    - [x] **行为**: 模拟运行 2 秒 (预热) 后停止以节省 CPU。
    - [x] **布局切换**: 布局转换 (Force <-> DAG) 期间尊重静态模式。
  - [x] **GPU 设置**: 在设置中添加了“GPU 优化渲染”复选框以控制加速标志。
  - [x] **极端规模**: 对于 >10,000 个节点的图谱，严格禁用边渲染以防止渲染瓶颈。

- [x] **CLI 与文件管理**
  - [x] **CLI 参数**: 为 `npm start` 添加了 `--path` 和 `--gpu` 支持。
  - [x] **文件隔离**: CLI 运行生成唯一的 `data_cli_*.js` 文件以保护原始 `data.js`。
  - [x] **服务器逻辑**: `server.ts` 根据构建参数自动提供正确的 CLI 数据文件。

# 2026-01-09 v0.9.70 - 前端初始化修复 (竞态条件)

**目标**: 解决由于大规模数据集初始化序列中的竞态条件导致的“不显示节点”和“按钮无响应”问题。

- [x] **Bug 修复**
  - [x] **竞态条件**: 确定 `renderCanvas` 在 `controls` 对象定义之前被 `ResizeObserver` 或 `setTimeout` 调用，导致脚本执行中断的致命错误。
  - [x] **重构**: 将 `controls` 的定义移至 `app.js` 顶部。
  - [x] **稳健性**: 在 `isNodeVisible` 和 `renderCanvas` 中添加了安全检查，以防止初始化期间崩溃。
  - [x] **结果**: UI 按钮 (冻结、设置) 现在应正确初始化，画布应立即渲染。

# 2026-01-09 v0.9.69 - 前端崩溃修复 (10k+ 节点)

**目标**: 修复由于前端处理 120 万条边时的栈溢出导致的“节点：0”关键 Bug。

- [x] **Bug 修复**
  - [x] **栈溢出**: 确定了 `app.js` 中由于 `links.push(...validLinks)` 带有 120 万个参数导致的 `RangeError: Maximum call stack size exceeded`。
  - [x] **重构**: 将 `links` 声明从 `const` 更改为 `let`，并用直接赋值 (`links = validLinks`) 替换了展开操作。
  - [x] **结果**: 应用程序现在成功加载并渲染超过 10,000 个节点和 100 万条边的图谱，而不会崩溃。

# 2026-01-09 v0.9.68 - 按需内容架构 (10k+ 修复)

**目标**: 彻底解决由于巨大的 `data.js` 文件大小 (~500MB) 导致浏览器崩溃而造成的 10k+ 节点“节点：0”显示问题。

- [x] **架构重构**

  - [x] **数据拆分**: 将图结构 (`data.js`) 与内容 (`graph_data.json`) 分离开来。
  - [x] **优化**: `data.js` 现在不包含节点内容，文件大小减少了 ~95% (例如，13k 节点的 500MB 降至 35MB)。
  - [x] **后端**: 更新了 `src/index.ts` 以生成“轻量版” `data.js`。

- [x] **按需内容**
  - [x] **API 端点**: 在 `server.ts` 中添加了 `GET /api/content` 以安全地提供原始节点内容。
  - [x] **前端**: 更新了 `reader.js` 中的 `Reader`，使其在打开节点时异步获取内容。
  - [x] **UX**: 在阅读器窗口添加了加载状态指示器。

# 2026-01-08 v0.9.67 - 紧凑模式与 Canvas 修复

**目标**: 解决 10k+ 节点的显示问题，并实现默认隐藏边的性能模式。

- [x] **紧凑模式**
  - [x] **自动启用**: 对于 >5000 节点或 >100,000 边自动激活。
  - [x] **边剔除**: 渲染循环在紧凑模式下完全跳过边迭代，除非高亮处于活动状态。
  - [x] **设置 UI**: 向性能设置添加了“紧凑模式 (隐藏边)”复选框。
- [x] **Canvas 修复**
  - [x] **初始渲染**: 初始化后强制显式调用 `resizeCanvas()` 和 `ticked()` 以防止白屏。

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

### 2025-12-23 v0.9.0 - 精确控制与稳定性 (Precise Control & Stability)

**目标**: 提供用于手动布局控制和稳定检查的工具。

- [x] **悬停逻辑**
  - [x] **自动冻结**: 悬停时锁定节点位置以便于检查。
- [x] **模拟 UX**
  - [x] **控制**: 添加速度滑块和冻结布局切换。
  - [x] **手动放置**: 允许在布局冻结时手动定位节点而不自动恢复。

### 2025-12-23 v0.9.1 - 移动端转换 (Mobile Transformation)

**目标**: 将当前的 Web 项目转换为 Android APK 应用程序。

- [x] **Capacitor 集成**
  - [x] **初始化**: 配置了 `capacitor.config.ts`。
  - [x] **平台支持**: 通过 `@capacitor/android` 添加了 Android 平台。
  - [x] **资源管理**: 实现了 `copy-assets` 脚本和 `npx cap sync`。
  - [x] **构建流水线**: 验证了 Gradle 构建配置 (`assembleDebug`)。

### 2025-12-23 v0.9.2 - 移动端 UI 优化 (Mobile UI Optimization)

**目标**: 针对小触摸屏优化 UI/UX。

- [x] **响应式控件**
  - [x] **折叠菜单**: 主控件在移动端折叠为按钮以节省空间。
  - [x] **专注模式 UI**: 将“退出专注”按钮移至底部中央以便操作。
  - [x] **设置合并**: 将语言选择器移入设置模态框以净化界面。
- [x] **触摸交互**
  - [x] **捏合缩放**: 阅读窗口添加了多点触控支持以缩放文本。
  - [x] **触摸目标**: 增大了按钮和输入框以提高触摸精度。

### 2025-12-23 v0.9.3 - 移动端交互迭代 (Mobile Interaction Iteration)

**目标**: 改进移动端可用性的交互逻辑。

- [x] **交互逻辑更新**
  - [x] **单击**: 触发节点高亮和提示框（显示入/出度）。
  - [x] **双击**: 触发进入专注模式。
  - [x] **桌面兼容性**: 保留了桌面的 `mouseover` 悬停，同时统一了点击逻辑。

### 2025-12-23 v0.9.4 - Mermaid 图片优化 (Mermaid Image Optimization)

**目标**: 增强移动设备上的图表阅读体验。

- [x] **Mermaid 缩放模式**
  - [x] **交互**: 点击 Mermaid 图表打开全屏覆盖层。
  - [x] **手势**: 在覆盖层内实现了平移 (拖动) 和缩放 (捏合/滚轮) 逻辑。
  - [x] **UX**: 添加了显眼的退出按钮以关闭缩放模式。

### 2025-12-24 v0.9.5 - 移动体验优化与专注语义 (Refined Mobile Experience & Focus Semantics)

**目标**: 打磨移动端和复杂图谱的交互细节与视觉清晰度。

- [x] **专注模式增强**
  - [x] **居中**: 视口自动以焦点节点的原始位置为中心。
  - [x] **语义**: 添加了清晰的区域标签 ("Helping to understand", "Further exploration")。
  - [x] **布局**: 实现了 "层级 (从左到右)" 布局选项。
- [x] **分析面板**
  - [x] **移动端**: 面板现在可滚动并适配触摸屏。
  - [x] **交互**: 点击行会在图表中高亮显示节点及其连接。
- [x] **视觉打磨**
  - [x] **Mermaid**: 增强了浅色图表的文本可见性（阴影/描边）。
  - [x] **连线**: 确保边默认隐藏，仅在交互时可见。

### 2025-12-24 v0.9.6 - 分析与视觉打磨 (Analysis & Visuals Polish)

**目标**: 进一步完善分析面板的移动端可用性并修复视觉不一致。

- [x] **Mermaid 缩放样式**
  - [x] **修复**: 确保 Mermaid 文本阴影/灰度在全屏缩放模式下持久保留。
- [x] **度数分析移动端**
  - [x] **全屏**: 添加了在半高和全屏之间切换面板的开关。
  - [x] **缩放**: 为面板内容实现了捏合缩放。
  - [x] **交互**: 验证了点击高亮逻辑在各视图中均有效。
- [x] **图表交互**
  - [x] **稳健性**: 添加了背景点击处理程序以清除高亮。

### 2025-12-24 v0.9.7 - 专注模式交互修复 (Focus Mode Interaction Fix)

**目标**: 修复专注模式下的可用性 Bug。

- [x] **布局切换**
  - [x] **修复**: 在 "水平" 和 "垂直" 布局之间切换现在会立即刷新图表，无需调整滑块。

### 2025-12-24 v0.9.8 - 分析交互完善 (Analysis Interaction Refinement)

**目标**: 确保分析面板与图表之间的无缝交互。

- [x] **图表同步**
  - [x] **提示框**: 点击分析面板中的节点现在会在图表上节点的位置显示提示框（统计数据）。
- [x] **移动端 UX**
  - [x] **滚动**: 修复了分析面板中的滚动行为以防止冲突。

### 2025-12-24 v0.9.9 - 移动端分析面板打磨 (Mobile Analysis Panel Polish)

**目标**: 增强“度数分析”页面的移动端可用性，增加手势控制。

- [x] **移动端适配**
  - [x] **滑动操作**: 实现了通过触摸拖动面板头部的“上下滑动”功能。
  - [x] **全屏**: 支持在浮动窗口和全屏页面之间切换，并具有拖动自动吸附功能。
  - [x] **缩放**: 验证了界面的双指捏合缩放支持。
- [x] **交互验证**
  - [x] **节点点击**: 验证了点击面板中的节点会在图表中显示入度和出度关系。

### 2025-12-24 v0.9.10 - 交互完善 (点击冻结) (Interaction Refinement)

**目标**: 通过在点击节点时冻结模拟来提高图表检查的稳定性。

- [x] **点击交互**
  - [x] **点击冻结**: 点击节点现在会立即停止力导向模拟（冻结所有节点），以防止检查期间的移动。
  - [x] **取消恢复**: 点击背景（空白区域）会取消高亮并恢复模拟（除非手动冻结）。
  - [x] **可视化**: 确保在冻结时清晰显示入度和出度连线。

### 2025-12-24 v0.9.11 - 节点统计与本地化 (Node Statistics & Localization)

**目标**: 增强节点的详细检查功能并完成国际化。

- [x] **专注模式本地化**
  - [x] **多语言**: 实现了 `t()` 调用以支持语义标签 ("帮助理解" / "进一步探索")。
- [x] **节点统计面板**
  - [x] **交互**: 点击节点打开一个专用面板显示关系。
  - [x] **视觉**: 入度连线为红色，出度连线为蓝色 (#4488ff)。
  - [x] **内容**: 面板列出所有入度和出度邻居，并支持导航。

### 2025-12-24 v0.9.12 - 独立统计弹窗 (Independent Statistics Popup)

**目标**: 将节点检查与全局分析分离，以获得更好的用户体验。

- [x] **浮动统计窗口**
  - [x] **交互**: 点击节点打开一个浮动弹窗，显示入/出度。
  - [x] **视觉**: 明显的红色 (入) 和蓝色 (出) 指示器。
  - [x] **独立性**: 不干扰主度数分析面板。

### 2025-12-24 v0.9.13 - 专注模式隔离 (Focus Mode Isolation)

**目标**: 确保特定的交互效果不会渗入专注模式。

- [x] **交互完善**
  - [x] **约束**: 验证在专注模式下点击节点*不*会触发浮动统计弹窗或更改高亮样式，从而保留特定的专注模式上下文。

### 2025-12-24 v0.9.14 - 视觉与数据修复 (Visual & Data Fixes)

**目标**: 修复边方向的可视化和数据重复问题。

- [x] **边高亮**
  - [x] **Canvas 支持**: 在 Canvas 渲染器 (`renderCanvas`) 中实现了红色 (入) 和蓝色 (出) 边着色，此前为通用的灰色。
- [x] **数据完整性**
  - [x] **去重**: 使用 `Set` 防止统计弹窗邻居列表中出现重复的节点条目。

### 2025-12-24 v0.9.15 - 增强隔离 (Enhanced Isolation)

**目标**: 通过有效隐藏检查期间的不相关上下文来优化视觉焦点。

- [x] **视觉优化**
  - [x] **深度变暗**: 将不相关节点的不透明度从 0.1 降低到 0.05，以更好地满足“暂时隐藏”的要求，同时保持最小的上下文。
  - [x] **边强调**: 将高亮边的宽度增加到 2.5px，以便更清晰地区分红色/蓝色。

### 2025-12-24 v0.9.16 - 交互完整性 (Interaction Completeness)

**目标**: 确保检查期间节点关系的完整可视化。

- [x] **交互逻辑**
  - [x] **始终开启的上下文**: 点击节点现在强制显示*所有*入度和出度关系，覆盖任何活动的“仅入度”或“仅出度”过滤器，以确保可见完整的上下文。
- [x] **Canvas 渲染器**
  - [x] **视觉对等**: 在 Canvas 引擎中为高亮边实现了加粗线条渲染 (2.5px 宽度)，以匹配 SVG 样式。

### 2025-12-24 v0.9.17 - SVG 视觉完整性 (SVG Visual Completeness)

**目标**: 完成 SVG 模式交互的视觉反馈循环。

- [x] **SVG 渲染器**
  - [x] **彩色标记**: 实现了动态标记切换（红/蓝箭头），以匹配高亮期间的边颜色。
  - [x] **视觉一致性**: 确保清除高亮时箭头恢复为灰色。

### 2025-12-24 v0.9.18 - 节点高亮系统重构 (Node Highlighting System Refactor)

**目标**: 以模块化架构重构节点高亮逻辑，以提高可维护性和稳健性。

- [x] **模块化架构**

  - [x] **NodeHighlightManager 类**: 创建了具有完整状态管理的专用模块 (`nodeHighlight.js`)。
  - [x] **API 设计**: 实现了清晰的公共 API，包括 `highlight()`, `unhighlight()`, `getState()` 和辅助方法。
  - [x] **集成**: 完全集成到 app.js 中，替换旧的高亮功能。

- [x] **统一交互模型**

  - [x] **PC 支持**: 基于悬停的高亮显示，无需冻结模拟。
  - [x] **移动端支持**: 基于点击的高亮显示，具有模拟冻结功能，以便进行稳定检查。
  - [x] **状态一致性**: 正确跟踪冻结与临时高亮状态。

- [x] **渲染增强**

  - [x] **SVG 模式**: 定向边着色（蓝色=#4488ff 出度，红色=#ff6b6b 入度）与匹配的箭头标记。
  - [x] **Canvas 模式**: 更新为使用 highlightManager 状态以获得一致的视觉行为。
  - [x] **变暗效果**: 未连接的节点在高亮期间变暗至 0.05 不透明度，以获得更清晰的焦点。

- [x] **专注模式集成**

  - [x] **状态感知**: highlightManager 尊重专注模式并且不干扰。
  - [x] **协调**: 专注模式进入/退出正确更新 highlightManager 状态。

- [x] **文档**
  - [x] **双语注释**: 代码中全面的中英文注释。
  - [x] **接口文档**: 更新了完整的 NodeHighlightManager API 参考。
  - [x] **README**: 在两种语言中添加了 v0.9.18 更新日志条目。
  - [x] **集成指南**: 创建了详细的集成说明。

### 2025-12-24 v0.9.19 - 专注模式与弹窗增强 (Focus Mode & Popup Enhancements)

**目标**: 修复专注模式刷新问题，并为统计弹窗添加拖动/缩放功能，以获得更好的用户体验。

- [x] **专注模式重新进入修复**

  - [x] **双击行为**: 修改了 `handleDoubleClick()`，允许在已处于专注模式时重新进入相关节点的专注模式。
  - [x] **状态重置**: 确保在进入新的专注上下文之前正确重置所有节点可见性标志 (`isFocusVisible`, `fx`, `fy`, `_labelDy`)。
  - [x] **预防**: 移除了阻止在 `enterFocusMode()` 中切换相关节点专注的限制。

- [x] **统计弹窗增强**
  - [x] **拖动功能**: 实现了通过点击和拖动弹窗头部来进行基于鼠标的拖动。
    - [x] **状态跟踪**: 创建 `popupDragState` 来跟踪拖动位置和比例。
    - [x] **事件处理程序**: 添加了 `mousedown`, `mousemove` 和 `mouseup` 监听器用于拖动控制。
    - [x] **视觉反馈**: 为拖动期间的光标反馈添加了 `.dragging` 类。
  - [x] **缩放控制**: 添加了三个缩放按钮 (+, −, ⟲) 来缩放弹窗内容。
    - [x] **缩放范围**: 0.5x 到 2.0x，增量为 0.1。
    - [x] **实现**: 通过 `.popup-content` 上的 `fontSize` CSS 属性应用缩放。
    - [x] **重置功能**: 重置按钮恢复默认大小和比例。
  - [x] **可调整大小**: 启用了 CSS `resize: both` 以支持浏览器原生调整大小功能。
    - [x] **约束**: 设置最小/最大宽度和高度约束。
    - [x] **滚动**: 确保调整大小时内容正确滚动。
  - [x] **位置重置**: 关闭时，弹窗位置重置为默认值（右上角）。
- [x] **文档**
  - [x] **接口文档**: 更新了 v0.9.19 拖动/缩放接口规范。
  - [x] **README**: 在中英文中添加了 v0.9.19 更新日志条目。
  - [x] **双语注释**: 所有新功能的双语代码注释。
  - [x] **CSS**: 记录了可拖动、可缩放和可调整大小弹窗的新样式。

### 2025-12-24 v0.9.20 - 专注进入时自动清除选择状态 (Selection State Auto-Clear on Focus Entry)

**目标**: 通过双击进入专注模式时自动清除任何现有的选择或高亮状态，以实现干净的过渡。

- [x] **自动清除实现**

  - [x] **高亮清除**: 修改 `handleDoubleClick()`，在进入专注模式之前调用 `highlightManager.unhighlight({ force: true })`。
  - [x] **弹窗隐藏**: 进入专注模式时自动隐藏统计弹窗 (`#node-stats-popup`)。
  - [x] **状态管理**: 确保干净的状态转换，没有残留的视觉伪影。

- [x] **用户体验增强**

  - [x] **干净过渡**: 用户始终以原始的专注上下文开始。
  - [x] **视觉清晰度**: 防止正常模式和专注模式之间重叠高亮引起的混淆。
  - [x] **一致行为**: 标准化所有场景下的专注模式进入行为。

- [x] **文档**
  - [x] **接口文档**: 更新了 v0.9.20 选择自动清除规范。
  - [x] **README**: 在中英文中添加了 v0.9.20 更新日志条目。
  - [x] **代码注释**: 解释自动清除逻辑的双语注释。
  - [x] **TODO**: 记录已完成的功能实现。

### 2025-12-25 v0.9.21 - 严格的边可见性与优化 (Strict Edge Visibility & Optimization)

**目标**: 执行严格的边可见性规则（默认隐藏）并优化大图渲染。

- [x] **严格的边可见性**

  - [x] **SVG 模式**: 修改 `app.js` 中的 `updateVisibility`，将默认边不透明度设置为 0（原为 0.15）。
  - [x] **一致性**: 确保 SVG 行为与 Canvas 模式匹配（默认隐藏）。
  - [x] **性能**: 减少初始视图的视觉混乱和渲染成本。

- [x] **文档**
  - [x] **接口文档**: 更新以反映 v0.9.21 中的严格边可见性。
  - [x] **README**: 添加 v0.9.21 更新日志。
  - [x] **测试报告**: 验证 v0.9.21 的行为。

### 2025-12-25 v0.9.22 - 移动端弹窗适配 (Mobile Popup Adaptation)

**目标**: 适配节点统计弹窗以支持移动设备的触摸拖动和捏合缩放功能。

- [x] **触摸拖动支持**

  - [x] **实现**: 向 `popupDragHandle` 添加了 `touchstart`, `touchmove`, `touchend` 监听器。
  - [x] **逻辑**: 使用 `touches[0]` 坐标镜像鼠标拖动逻辑。
  - [x] **约束**: 需要单指触摸头部。

- [x] **捏合缩放支持**

  - [x] **实现**: 向 `statsPopup` 添加了 `touchstart`, `touchmove`, `touchend` 监听器。
  - [x] **逻辑**: 计算双指之间的距离 (`Math.hypot`) 以确定缩放比例。
  - [x] **缩放**: 更新 `popupDragState.currentScale` 并应用于 `fontSize`。
  - [x] **限制**: 缩放限制在 0.5x 到 2.0x 之间。

- [x] **文档**
  - [x] **接口文档**: 更新了移动端交互规范。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证移动端交互。

### 2025-12-25 v0.9.23 - 默认设置调整 (Default Settings Adjustment)

**目标**: 根据用户反馈调整阅读窗口字体大小和模拟阻尼的默认设置。

- [x] **阅读窗口字体大小**

  - [x] **实现**: 修改 `reader.js` 中的 `Reader` 类，默认将 `currentZoom` 设置为 0.5。
  - [x] **逻辑**: 影响打开时的初始化和重置。

- [x] **模拟阻尼**
  - [x] **实现**: 更新 `app.js` 以使用 `.velocityDecay(0.6)` 初始化 `d3.forceSimulation`。
  - [x] **UI**: 更新 `index.html` 滑块默认值并显示文本为 0.6。

### 2025-12-25 v0.9.24 - 专注模式内存优化 (Focus Mode Memory Optimization)

**目标**: 通过在专注模式期间冻结背景节点来减少 SVG 模式下的内存/CPU 开销。

- [x] **模拟优化**

  - [x] **子集化**: 修改 `enterFocusMode` 以过滤 `simulation.nodes()` 和 `simulation.force("link").links()`，仅包含专注子集。
  - [x] **冻结**: 背景节点实际上被冻结，因为它们不再由 D3 力处理。
  - [x] **恢复**: 修改 `exitFocusMode` 以将完整的节点和链接集恢复到模拟中。

- [x] **文档**
  - [x] **接口文档**: 更新优化细节。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证优化行为。

### 2025-12-25 v0.9.25 - 冻结布局优化 (Freeze Layout Optimization)

**目标**: 通过在请求时严格冻结主图，防止唤醒模拟的用户交互，从而最小化资源使用。

- [x] **冻结布局增强**

  - [x] **行为**: 选中“冻结布局”现在会禁用主界面（SVG 模式）中的节点拖动。
  - [x] **约束**: 此限制*不*适用于专注模式，在该模式下仍允许手动调整。
  - [x] **性能**: 防止拖动事件触发 `simulation.restart()`，确保模拟保持有效停止（0% CPU 使用率）。

- [x] **文档**
  - [x] **接口文档**: 更新模拟控制部分。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证行为。

### 2025-12-26 v0.9.26 - UX 增强 (UX Enhancements)

**目标**: 提高移动端可用性并有效引导新用户。

- [x] **冻结布局按钮**

  - [x] **UI**: 在主界面（右上角或控件附近）添加专用的“冻结布局”按钮，以便快速访问，尤其是在移动设备上。
  - [x] **逻辑**: 将按钮链接到现有的模拟冻结功能。与控件中的复选框同步状态。
  - [x] **视觉**: 使用图标（例如 锁定/解锁）指示状态。

- [x] **快速开始手册**

  - [x] **内容**: 创建简明的“如何使用”指南，涵盖：
    - 加载数据
    - 导航（平移/缩放）
    - 专注模式（双击）
    - 检查（点击/悬停）
    - 分析面板
  - [x] **UI**: 实现为模态框，在首次加载时打开（localStorage 检查）或通过“帮助”按钮打开。
  - [x] **本地化**: 支持英语和中文。

- [x] **文档**
  - [x] **接口文档**: 使用新的 UI 元素更新。
  - [x] **README**: 添加更新日志。
  - [x] **测试报告**: 验证新功能。

### 2025-12-26 v0.9.27 - 条件重启 (Conditional Restart)

**目标**: 确保退出专注模式时尊重“冻结布局”状态。

- [x] **冲突解决**
  - [x] **逻辑**: 在 `exitFocusMode` 中，检查是否选中了“冻结布局”。
  - [x] **行为**: 如果选中，调用 `simulation.stop()` 而不是 `restart()`，防止不必要的移动。
  - [x] **视觉**: 手动触发 `ticked()` 以确保图表在其当前位置渲染恢复的节点。

### 2025-12-26 v0.9.28 - 专注模式具体内容 (Focus Mode Specific Content Access)

**目标**: 优化用户体验，提供在专注模式下打开特定节点内容的直接方式，避免需要双击。

- [x] **特定内容按钮**

  - [x] **UI**: 在专注模式控制面板 (`#focus-exit-btn`) 中添加了 "打开具体内容" 按钮。
  - [x] **逻辑**: 点击按钮触发 `window.reader.open(focusNode)`，模仿双击专注节点的行为。
  - [x] **本地化**: 添加了英语 ("Open Specific Content") 和中文 ("打开具体内容") 支持。

- [x] **文档**
  - [x] **用户手册**: 更新了专注模式章节。
  - [x] **接口文档**: 更新了专注模式功能。
  - [x] **测试报告**: 添加了新按钮的测试用例。

### 2025-12-26 v0.9.29 - 冻结布局持久化 (Freeze Layout Persistence)

**目标**: 修复 "分析与导出"（及其他布局调整）会覆盖 "冻结布局" 状态，导致意外节点移动的 Bug。

- [x] **布局调整逻辑**
  - [x] **行为**: 修改了 `app.js` 中的 `ResizeObserver`，在调用 `simulation.restart()` 之前严格检查 "冻结布局" 复选框状态。
  - [x] **Canvas 同步**: 确保在布局更改期间调用 `resizeCanvas()`，以保持 Canvas 分辨率正确，即使模拟已冻结。
  - [x] **结果**: 打开分析面板或调整窗口大小现在尊重冻结状态，保持节点静止。

### 2025-12-26 v0.9.30 - 专注模式布局隔离 (Focus Mode Layout Isolation)

**目标**: 确保专注模式内发生的布局更改（自动排列或手动拖动）不会影响退出时主界面的节点位置。

- [x] **位置备份与恢复**
  - [x] **备份**: 在 `enterFocusMode` 中，保存所有节点当前的 `x`, `y`, `fx`, 和 `fy` 坐标。
  - [x] **恢复**: 在 `exitFocusMode` 中，将这些坐标恢复到专注前的状态。
  - [x] **一致性**: 确保图表视觉状态完全恢复到进入专注模式之前的样子。

### 2025-12-26 v0.9.31 - 模拟优化 (视口剔除) (Simulation Optimization - Viewport Culling)

**目标**: 通过基于缩放级别和视口可见性最小化粒子运动计算，减少内存和 CPU 消耗。

- [x] **视口剔除逻辑**
  - [x] **全景冻结**: 如果用户缩小到足以看到整个图表（或大部分），自动停止模拟以节省资源，假设布局是稳定的。
  - [x] **屏幕外冻结**: 放大时，仅模拟可见视口内的节点。冻结视口外的节点。
  - [x] **实现**:
    - [x] 添加由缩放事件触发的 `checkSimulationState()`。
    - [x] 基于 `event.transform` 计算可见边界。
    - [x] 更新 `simulation.nodes()` 仅包含可见节点（加上缓冲区）或使用 `fx`/`fy` 锁定屏幕外节点。

### 2025-12-26 v0.9.32 - 高阻尼与渲染优化 (High Damping & Render Optimization)

**目标**: 通过增加模拟摩擦力和跳过冻结的屏幕外节点的 DOM 更新，进一步减少内存/CPU 消耗。

- [x] **阻尼调整**

  - [x] **默认值**: 将 `velocityDecay` 增加到 **0.92**。
  - [x] **效果**: 图表稳定得更快；移动更“重”，抖动更少。

- [x] **渲染剔除 (DOM)**
  - [x] **逻辑**: 在 `ticked()` 中，过滤 D3 选择集以仅更新未标记为 `isCulled` 的节点。
  - [x] **机制**: `checkSimulationState` 将屏幕外节点设置为 `isCulled = true`。
  - [x] **好处**: 每帧避免为用户看不到的节点进行数千次昂贵的 DOM 属性更新。

### 2025-12-26 v0.9.33 - 布局状态缓存 (Layout State Caching - Instant Switch)

**目标**: 实现状态缓存，允许在布局（"力导向" vs "DAG"）之间切换而无需重新计算位置或动画过渡，满足 "模板状态" 需求。

- [x] **状态管理**
  - [x] **缓存**: 创建 `layoutCache` 以存储每种模式的 `x, y, fx, fy`。
  - [x] **保存/恢复**: 实现切换前保存当前位置和切换后恢复目标位置的逻辑。
- [x] **转换逻辑**
  - [x] **即时切换**: 如果存在布局缓存，恢复位置并跳过模拟预热 (`alpha(1)`)，有效地将节点传送到其先前的状态。
  - [x] **首次运行**: 如果不存在缓存，执行标准模拟。

### 2025-12-26 v0.9.34 - 全局布局更新修复 (Global Layout Update Fix)

**目标**: 确保布局切换应用于图表中的所有节点，覆盖可能已冻结屏幕外节点的任何优化约束（如视口剔除）。

- [x] **布局转换逻辑**
  - [x] **全局解冻**: 在 `updateLayout()` 中，启动新模拟时显式清除所有节点的 `fx` 和 `fy` 属性。
  - [x] **剔除重置**: 重置 `isCulled` 标志，以确保屏幕外节点包含在新布局计算和渲染中。
  - [x] **结果**: 从 'Force' 切换到 'DAG'（反之亦然）可以正确重新排列整个图表，即使用户放大了视图且许多节点以前被冻结。

### 2025-12-26 v0.9.35 - 视口剔除放宽 (Viewport Culling Relaxation)

**目标**: 放宽视口剔除限制以提供更流畅的用户体验，防止视口外的节点过早冻结，并允许在全局冻结之前进行更深度的缩小。

- [x] **剔除优化**
  - [x] **全景冻结阈值**: 从 `scale < 0.4` 降低到 `scale < 0.1`，允许在更广泛的缩放级别下模拟。
  - [x] **动态缓冲区**: 将屏幕外缓冲区从固定的 `100` 单位增加到 `800 / scale`（约 800 视觉像素），确保“向外扩展的固定范围”行为。

### 2025-12-26 v0.9.36 - 冻结布局优先级修复 (Freeze Layout Priority Fix - Visual Settings)

**目标**: 确保如果启用了 "冻结布局"，更改视觉设置（度数基准、大小依据）不会触发模拟重启，尊重用户保持节点静止的指令。

- [x] **视觉更新逻辑**
  - [x] **条件重启**: 修改了 `app.js` 中的 `updateSize()` 以检查 "冻结布局" 复选框状态。
  - [x] **行为**: 如果冻结，视觉属性（半径、字体大小）立即更新，但跳过 `simulation.restart()`。碰撞力在后台更新，为用户解冻时做好准备。

### 2025-12-26 v0.9.37 - 快速松弛策略 (Rapid Relaxation Strategy)

**目标**: 实现两阶段阻尼过程，允许图表在加载时快速“展开”，然后稳定下来。

- [x] **阻尼逻辑**
  - [x] **初始阶段**: 在前 2 秒将 `velocityDecay` 设置为 **0.2**。这种低摩擦力允许节点迅速移离中心并解开。
  - [x] **稳定阶段**: 2 秒后自动过渡到 **0.95**（高摩擦力）以稳定布局（从 0.92 更新）。
  - [x] **交互安全**: 确保自动过渡不会覆盖初始阶段的手动滑块调整。

### 2025-12-26 v0.9.38 - 快速开始指南 HTML 渲染修复 (Quick Start Guide HTML Rendering Fix)

**目标**: 修复本地化快速开始指南内容中的 HTML 标签（如 `<br>` 和 `<strong>`）显示为原始文本而不是被渲染的问题。

- [x] **渲染逻辑**
  - [x] **HTML 支持**: 更新了 `app.js` 中的 `window.updateLanguage`，在注入翻译内容时使用 `.innerHTML` 而不是 `.innerText`。这确保了指南中的富文本元素正确显示。

### 2025-12-26 v0.9.39 - 布局切换松弛与冻结逻辑 (Layout Switch Relaxation & Freeze Logic)

**目标**: 在切换布局时应用 "快速松弛" 策略（0.2 阻尼 -> 0.95 阻尼），确保与初始加载行为一致。此外，确保在松弛期后尊重 "冻结布局"。

- [x] **布局转换逻辑**
  - [x] **松弛**: 切换到新布局 (Force/DAG) 会将 `velocityDecay` 重置为 **0.2** 并持续 2 秒，以允许节点快速找到新位置。
  - [x] **稳定**: 2 秒后自动过渡到 **0.95** 阻尼。
  - [x] **延迟冻结**: 如果在切换期间启用了 "冻结布局"，模拟将在 2 秒的松弛阶段运行，然后自动**停止**，将新布局冻结在其稳定状态。

### 2025-12-26 v0.9.40 - 冻结布局优先级修复 (Freeze Layout Priority Fix - Settings Modal)

**目标**: 确保在 "可视化设置" 模态框中更改物理或视觉设置不会在 "冻结布局" 启用时重启模拟。

- [x] **设置应用逻辑**
  - [x] **条件重启**: 修改了 `app.js` 中的 `settingsManager.subscribe` 回调以检查 "冻结布局" 复选框状态。
  - [x] **行为**:
    - **冻结**: 力（电荷、距离、碰撞）在后台更新，但跳过 `simulation.restart()`。视觉更改（不透明度）立即应用。
    - **解冻**: 力更新且模拟重启 (alpha 0.3)。

### 2025-12-26 v0.9.41 - 设置模态框模拟冻结 (Settings Modal Simulation Freeze)

**目标**: 打开 "可视化设置" 模态框时自动冻结模拟，以节省内存/CPU 并防止配置期间的后台活动。

- [x] **模态框状态逻辑**
  - [x] **自动冻结**: 打开设置模态框 (`initSettingsUI`) 现在触发 `simulation.stop()` 并设置内部 `isSettingsModalOpen` 标志。
  - [x] **条件恢复**: 关闭模态框*仅*在全局 "冻结布局" 复选框未选中时恢复模拟。
  - [x] **更新抑制**: 模态框打开时由 `settingsManager` 触发的更新（例如滑块拖动）应用值但*不*重启模拟循环。

### 2025-12-26 v0.9.42 - 独立排斥力设置 (Distinct Repulsion Settings)

**目标**: 允许用户为 "力导向" 和 "DAG" 布局模式配置不同的 "排斥力强度" 值，并具有特定于布局的默认值。

- [x] **设置逻辑**
  - [x] **数据结构**: 更新了 `settings.js` 中的 `defaultSettings` 以存储单独的键：`repulsionForce` (默认: -550) 和 `repulsionDAG` (默认: -850)。
  - [x] **上下文感知 UI**: "可视化设置" 模态框现在自动显示并更新对应于当前活动布局模式的排斥力值。
  - [x] **动态应用**: 切换布局 (`updateLayout`) 或更改设置 (`settingsManager.subscribe`) 动态应用正确的力强度。

### 2025-12-26 v0.9.43 - 上下文感知设置 UI (Context-Aware Settings UI)

**目标**: 通过动态更新设置模态框中的标签以反映当前活动的布局模式，提高用户清晰度。

- [x] **UI 增强**
  - [x] **标签切换**: 排斥力滑块的标签现在根据设置模态框打开时的活动布局更新为 "排斥力 (力导向)" 或 "排斥力 (DAG)"。
  - [x] **本地化**: 支持英语和中文语言环境的动态标签切换。

### 2025-12-26 v0.9.44 - 独立专注模式间距 (Independent Focus Mode Spacing)

**目标**: 允许用户为专注模式下的 "水平" 和 "垂直" 布局独立配置 "层间距" 和 "节点间距"，防止一种布局的设置影响另一种。

- [x] **间距逻辑**
  - [x] **状态管理**: 创建 `focusSpacingSettings` 为 `horizontal` 和 `vertical` 模式存储单独的 `layer` 和 `node` 值。
  - [x] **默认值**:
    - **水平**: 层间距默认为 **125** (原为 250)。
    - **垂直**: 节点间距默认为 **20** (原为 80)。
  - [x] **UI 同步**: 切换专注布局下拉菜单现在会自动更新滑块以反映该特定模式的存储值。
  - [x] **持久化**: 调整滑块仅更新*当前*模式的设置。

### 2025-12-26 v0.9.45 - Canvas 交互与清理 (Canvas Interactivity & cleanup)

**目标**: 在 Canvas 模式下启用完全交互性（悬停、点击、专注）并移除已弃用的 "视图模式"（聚类）功能。

- [x] **Canvas 交互**
  - [x] **命中测试**: 实现了 `findNodeAt(x, y)` 以检测 Canvas 模式下鼠标光标下的节点，考虑了缩放/平移变换。
  - [x] **事件监听器**: 向 canvas 元素添加了 `mousemove` (高亮) 和 `click` (检查/专注) 处理程序。
  - [x] **一致性**: Canvas 交互现在匹配 SVG 行为（单击 -> 统计，双击 -> 专注）。
- [x] **视觉修复**
  - [x] **节点大小**: 更新 `renderCanvas` 以尊重 "大小依据" 设置（度数/中心性/统一），修复了节点渲染过大的问题。
- [x] **清理**
  - [x] **移除视图模式**: 从代码库中移除了 "视图模式"（节点/聚类）控件和相关逻辑，因为它已被弃用。

### 2025-12-26 v0.9.46 - 专注模式 UI 清理与 Canvas 边修复 (Focus Mode UI Cleanup & Canvas Edge Fix)

**目标**: 清理专注模式期间的 UI 以减少混乱，并修复 Canvas 模式下的视觉渲染。

- [x] **UI 隐藏**
  - [x] **主控件**: 进入专注模式时，"选择知识库"、"加载" 和主 "NoteConnection" 下拉菜单现在完全隐藏 (`display: none`)。
  - [x] **恢复**: 退出专注模式时，元素恢复到默认状态 (`display: ''`)，尊重 CSS 规则（例如移动端可见性）。
- [x] **Canvas 可视化**
  - [x] **边隐藏**: 在 Canvas 专注模式下，*所有*边现在都被隐藏以提供更干净的外观，符合“不显示任何边”的要求。

### 2026-01-02 v0.9.47 - 专注模式交互与布局修复 (Focus Mode Interaction & Layout Fixes)

**目标**: 通过防止意外缩放和修复垂直布局中的标签重叠，提高专注模式的可用性。

- [x] **交互逻辑**
  - [x] **双击缩放预防**: 在节点双击处理程序中添加了 `stopPropagation`，以防止 `d3.zoom` 在进入专注模式时触发放大事件。
- [x] **专注模式布局**
  - [x] **垂直间距**: 在 "垂直" (L-R) 布局中，将节点标签的水平偏移 (`dx`) 增加到 **35px**（原默认约 12px），以防止文本与节点重叠。
  - [x] **焦点节点**: 对垂直布局中的中央焦点节点应用相同的水平偏移，以保持一致性。

### 2026-01-02 v0.9.48 - 并行处理优化 (Parallel Processing Optimization)

**目标**: 通过允许可配置的 Worker 线程限制，利用更多 CPU 核心处理大数据集，优化图构建性能。

- [x] **Worker 配置**:
  - [x] **可配置限制**: 向 `AppConfig` 添加了 `maxWorkers` 以覆盖默认 Worker 限制。
  - [x] **移除上限**: 移除了 `GraphBuilder` 和 `StatisticalAnalyzer` 中硬编码的 12 个 Worker 限制。如果未指定，默认为 `numCPUs - 1`。
  - [x] **验证**: 在测试数据集上使用 50 个 Worker 进行了验证。

### 2026-01-02 v0.9.49 - 统计分析内存优化 (Statistical Analysis Memory Optimization)

**目标**: 通过优化共现矩阵计算，修复处理大数据集（10k+ 文件）时的 "堆内存溢出" 错误。

- [x] **算法优化**:
  - [x] **稀疏矩阵计算**: 重构 `calculateMatrixOptimized` 使用以文件为中心的迭代方法 ($O(Files \times TermsPerFile^2)$)，而不是密集的术语对迭代 ($O(TotalTerms^2)$)。
  - [x] **复杂度降低**: 将复杂度从约 1.7 亿次迭代（针对 13k 节点）降低到约 500 万次迭代。
  - [x] **数据结构效率**: 移除了 Worker 结果聚合期间不必要的中间对象转换 (`Set` <-> `Array`)。
  - [x] **Worker 结果合并**: 优化 `runParallelTermExtraction` 以迭代方式合并块，而不是使用 `reduce`，以防止内存峰值。

### 2026-01-02 v0.9.50 - GPU 加速可行性 (GPU Acceleration Feasibility)

**目标**: 验证并实现用于数学运算（矩阵乘法）的 GPU 加速，以便在支持的硬件上（在 AMD 7900XT 上验证）进一步加快图构建。

- [x] **可行性验证**:
  - [x] **库**: 安装 `gpu.js` 以通过 WebGL/OpenCL 将 Node.js 与 GPU 连接。
  - [x] **硬件检查**: 验证了 AMD Radeon 7900XT (Windows 10) 上的内核编译和执行成功。
  - [x] **基准测试**: 矩阵乘法 (512x512) 在 GPU 模式下成功完成。
- [x] **实施计划**:
  - [x] **向量空间**: 将 $N \times N$ 余弦相似度矩阵计算卸载到 GPU (`amdgpu/VectorSpaceGPU.ts`)。
  - [x] **约束**: 将字符串处理（关键词匹配）保留在 CPU (Worker) 上，因为文本传输到 GPU 的开销超过了收益。

### 2026-01-03 v0.9.51 - 性能日志与崩溃报告 (Performance Logging & Crash Reporting)

**目标**: 通过实施详细的性能指标和自动崩溃报告来增强系统可观测性，以促进调试。

- [x] **性能日志记录器**:
  - [x] **工具**: 创建 `PerformanceLogger` 类来跟踪时间、CPU (用户/系统) 和内存 (堆/RSS)。
  - [x] **集成**: 用日志记录包裹所有 `GraphBuilder` 阶段（节点初始化、边匹配、推断）。
  - [x] **GPU 跟踪**: 将日志记录集成到 `VectorSpaceGPU` 以监控内核执行时间。
- [x] **崩溃报告**:
  - [x] **工具**: 创建 `CrashLogger` 将未处理的错误写入 `crash.log`。
  - [x] **集成**: 在 `server.ts` 中附加全局处理程序 (`uncaughtException`, `unhandledRejection`)。
  - [x] **Worker**: 向 `keywordMatchWorker` 和 `statisticalWorker` 添加了 try-catch 块和日志记录器集成。

### 2026-01-05 v0.9.52 - 循环检测内存优化 (Cycle Detection Memory Optimization)

**目标**: 解决处理具有许多循环的大图（100k+ 边）时 Windows 10/11 上的 "堆内存溢出" 崩溃。

- [x] **循环检测优化**:
  - [x] **限制逻辑**: 更新 `CycleDetector` 以接受 `limit` 参数。
  - [x] **终止**: 在找到指定数量的循环 (100) 后立即停止递归/搜索，而不是收集所有循环。
  - [x] **验证**: 添加了单元测试以确限制被遵守。

### 2026-01-05 v0.9.53 - 核心 API 解耦 (Core API Decoupling)

**目标**: 通过将核心逻辑与 CLI 环境解耦，为插件集成 (Joplin/Obsidian) 准备代码库。

- [x] **核心重构**:
  - [x] **NoteConnection 类**: 创建 `src/core/NoteConnection.ts` 作为主外观模式。
  - [x] **解耦**: 将 `buildGraph` 逻辑移出 `src/index.ts` 以允许库式使用。
  - [x] **CLI 更新**: 重构 `src/index.ts` 以使用新的核心 API。

### 2026-01-05 v0.9.54 - 欢迎体验 (Welcome & Empty State Experience)

**目标**: 通过在图表为空时提供清晰的指导，改善新用户引导体验。

- [x] **空状态处理**:
  - [x] **检测**: `welcome.js` 中的逻辑检测 `graphData` 是否为空或缺失。
  - [x] **欢迎模态框**: 实现了 "Welcome to NoteConnection" 模态框，引导用户：
    1. 选择源文件夹。
    2. 点击加载。
  - [x] **视觉提示**: 模态框激活时高亮显示源控制区域。

### 2026-01-05 v0.9.55 - 堆内存溢出修复与迭代 DFS (Heap OOM Fix & Iterative DFS)

**目标**: 通过优化图构建期间的内存使用并将递归重构为迭代，解决 Windows 10/11 上的 "堆内存溢出" 崩溃。

- [x] **内存优化**:
  - [x] **作用域管理**: 在进入 `GraphBuilder` 中内存密集的 `Algorithmic Core` 阶段之前，显式清除 `fileMap`（保存文件内容）。
  - [x] **细粒度日志**: 将 `Algorithmic Core` 日志拆分为 `Cycle Detection` 和 `Topological Sort` 以进行精确的错误跟踪。
- [x] **算法稳健性**:
  - [x] **迭代 DFS**: 重构 `CycleDetector.detectCycles` 使用基于栈的迭代方法代替递归，以防止深度图上的堆栈溢出。
  - [x] **验证**: 使用现有单元测试验证逻辑。

### 2026-01-05 v0.9.56 - 混合推断内存分析 (Hybrid Inference Memory Analysis)

**目标**: 分析并优化 "混合推断" 引擎的内存使用，以解决 Windows 10 上的 "堆内存溢出" 错误，防止图构建期间的大对象保留。

- [x] **细粒度日志**:
  - [x] **实现**: 在 `HybridEngine.infer` 和 `GraphBuilder`（统计矩阵、向量空间、推断引擎）中添加了详细的 `PerformanceLogger` 步骤。
  - [x] **进度跟踪**: 在推断期间每处理 1000 个节点记录一次内存使用情况，以查明峰值。
  - [x] **优化**: 在推断后立即显式清除大型 `matrix` 并置空 `vectorSpace`，以在后续步骤之前释放堆内存。

### 2026-01-07 v0.9.57 - Worker 内存优化 (Worker Memory Optimization)

**目标**: 通过优化主线程和 Worker 之间的数据传输，解决处理大数据集（13k+ 文件）时 Windows 10/11 上的 "堆内存溢出" 错误。

- [x] **Worker 数据传输**:
  - [x] **优化**: 重构 `keywordMatchWorker` 和 `statisticalWorker` 以接受 `filePaths: string[]` 而不是 `filesChunk: RawFile[]`（包含完整内容）。
  - [x] **实现**: Worker 现在使用 `fs` 按需从磁盘读取文件内容，避免了序列化期间克隆内容字符串的巨大内存开销。
  - [x] **结果**: 显著减少了并行处理步骤期间的堆使用量。

### 2026-01-07 v0.9.58 - 混合推断资源重用 (优化) (Hybrid Inference Resource Reuse)

**目标**: 通过防止重复计算统计矩阵和向量空间，修复混合推断期间的 "堆内存溢出" 崩溃。

- [x] **资源优化**:
  - [x] **共享状态**: 在 `GraphBuilder` 中实现了 `sharedStatsMatrix` 和 `sharedVectorSpace`。
  - [x] **逻辑**: 如果启用了 `HybridInference`，则预先计算这些重资源，并在统计和向量步骤中重用它们。
  - [x] **清理**: 推断完成后显式清除共享资源。
  - [x] **结果**: 消除了运行混合推断时的 2 倍内存峰值，防止了 13k+ 文件上的 OOM。

### 2026-01-07 v0.9.59 - 向量空间内存修复 (稀疏矩阵) (Vector Space Memory Fix - Sparse Matrix)

**目标**: 通过用稀疏向量实现替换密集的 TF-IDF 矩阵，解决处理 13k+ 文件时 Windows 10/11 (128GB RAM) 上的 "堆内存溢出" 崩溃。

- [x] **内存优化**:
  - [x] **稀疏向量**: 重构 `VectorSpace` 使用 `Uint32Array` (索引) 和 `Float32Array` (值) 代替标准 Javascript 数组。
  - [x] **效率**: 将 13k 文件的内存占用从约 10GB+ (密集) 减少到 <500MB (稀疏)。
  - [x] **算法**: 优化余弦相似度计算使用稀疏点积 ($O(min(N, M))$)。
  - [x] **配置**: 在 `package.json` 中将默认 Node.js 堆限制增加到 12GB (`--max-old-space-size=12288`) 以利用可用的系统 RAM。

### 2026-01-07 v0.9.60 - 并行图指标计算 (Parallel Graph Metrics)

**目标**: 通过并行化 "图指标" 计算（介数中心性），优化图构建性能，该计算以前是单线程的。

- [x] **并行化**:
  - [x] **Worker 实现**: 创建 `betweennessWorker.ts` 以使用 Brandes 算法计算节点子集的部分中心性分数。
  - [x] **异步逻辑**: 更新 `GraphMetrics` 为 `calculateBetweennessAsync`，使用 Worker 池（默认：`numCPUs - 1`）。
  - [x] **集成**: 将异步指标计算集成到 `GraphBuilder` 管道中。
  - [x] **验证**: 使用 `test_metrics_parallel.ts` 在 500+ 节点上验证功能。

### 2026-01-07 v0.9.61 - 前端内存优化 (自动 Canvas) (Frontend Memory Optimization - Auto-Canvas)

**目标**: 通过在节点数超过阈值时自动默认使用 "Canvas" 模式，减少前端内存消耗并提高大图的渲染性能。

- [x] **智能默认值**:
  - [x] **阈值检查**: 在 `app.js` 中，检查 `nodes.length > 3000`。
  - [x] **自动切换**: 如果超过阈值，初始化期间以编程方式选择 "Canvas" 渲染器并更新 DOM 可见性（隐藏 SVG，显示 Canvas）。
  - [x] **用户覆盖**: 如果需要，用户仍可以手动切换回 SVG。

### 2026-01-07 v0.9.62 - 文档更新 (AMDGPU 指南) (Documentation Update - AMDGPU Guide)

**目标**: 为 AMDGPU 用户提供详细的硬件和软件指南，特别是针对 `gpu.js` 加速和未来的 AI 集成。

- [x] **文档**:
  - [x] **README.md**: 添加 "硬件与驱动要求" 部分，详述 RDNA 架构、驱动选择 (Adrenalin vs Mesa/ROCm) 和 `headless-gl` 的构建依赖。

### 2026-01-08 v0.9.63 - 10k 节点优化与内存策略 (10k Node Optimization & Memory Strategy)

**目标**: 解决 10k+ 节点/1.2M 边时的 "卡死" 渲染问题，并实现后端处理的可配置内存策略。

- [x] **前端优化**:
  - [x] **物理剔除**: 为 D3 力导向模拟实施边限制 (20k)。如果总边数超过此值，仅子集驱动物理以防止主线程冻结，同时所有边仍可用于渲染/遍历。
  - [x] **链接解析**: 将链接源/目标预解析为对象，以支持稳健的渲染，即使物理使用子集。
  - [x] **UI 解锁**: 通过释放主线程修复了 "快速开始指南" 不出现的问题。
- [x] **后端内存策略**:
  - [x] **配置**: 向 `AppConfig` 添加了 `memorySavingMode` 和 `deepDebug`。
  - [x] **Worker 优化**: 重构 `keywordMatchWorker` 和 `statisticalWorker` 以支持 `filePaths` (低内存) 和 `filesChunk` (高性能/精度) 模式。
  - [x] **图指标**: 添加检查以在激活 `memorySavingMode` 时强制单核执行 `Betweenness Centrality`。
  - [x] **循环检测**: 根据内存模式调整限制 (100 vs 10000)。
- [x] **系统监控**:
  - [x] **峰值内存**: 更新 `PerformanceLogger` 以跟踪并记录峰值堆/RSS 内存使用情况。
  - [x] **深度调试**: 基于 `deepDebug` 标志实现了条件详细日志记录。

### 2026-01-08 v0.9.67 - 紧凑模式与 Canvas 修复 (Compact Mode & Canvas Fix)

**目标**: 解决 10k+ 节点的显示问题，并实现默认隐藏边的性能模式。

- [x] **紧凑模式**:
  - [x] **自动启用**: 对于 >5000 节点或 >100,000 边自动激活。
  - [x] **边剔除**: 渲染循环在紧凑模式下完全跳过边迭代，除非高亮处于活动状态。
  - [x] **设置 UI**: 向性能设置添加了 "紧凑模式 (隐藏边)" 复选框。
- [x] **Canvas 修复**:
  - [x] **初始渲染**: 初始化后强制显式调用 `resizeCanvas()` 和 `ticked()` 以防止白屏。

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

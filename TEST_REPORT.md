# 2026-01-07 v0.9.57 - English Document

## Test Report: Worker Memory Optimization

### 1. Data Transfer Logic
*   **Action**: Review `src/backend/algorithms/StatisticalAnalyzer.ts` and `statisticalWorker.ts`.
*   **Result**: 
    *   Main thread extracts file paths (`f.filepath`).
    *   Worker receives `filePaths` and uses `fs.readFileSync`.
    *   No cloning of `file.content` observed in message passing.
*   **Status**: **Pass**

---

# 2026-01-07 v0.9.57 - Chinese Document

## 测试报告：Worker 内存优化

### 1. 数据传输逻辑
*   **操作**: 审查 `src/backend/algorithms/StatisticalAnalyzer.ts` 和 `statisticalWorker.ts`。
*   **结果**: 
    *   主线程提取文件路径 (`f.filepath`)。
    *   Worker 接收 `filePaths` 并使用 `fs.readFileSync`。
    *   在消息传递中未观察到 `file.content` 的克隆。
*   **状态**: **通过**

---

# 2026-01-05 v0.9.56 - English Document

## Test Report: Hybrid Inference Memory Analysis

### 1. Granular Logging
*   **Action**: Review `src/backend/algorithms/HybridEngine.ts`.
*   **Result**: 
    *   Code includes `processedCount % 1000` check.
    *   Logs current Heap usage to console.
*   **Status**: **Pass**

### 2. Memory Cleanup
*   **Action**: Review `src/backend/GraphBuilder.ts`.
*   **Result**: 
    *   `matrix.clear()` is called immediately after inference.
    *   `vectorSpace` is nullified.
    *   Logging verifies cleanup step.
*   **Status**: **Pass**

---

# 2026-01-05 v0.9.56 - Chinese Document

## 测试报告：混合推断内存分析

### 1. 细粒度日志
*   **操作**: 审查 `src/backend/algorithms/HybridEngine.ts`。
*   **结果**: 
    *   代码包含 `processedCount % 1000` 检查。
    *   向控制台记录当前堆内存使用情况。
*   **状态**: **通过**

### 2. 内存清理
*   **操作**: 审查 `src/backend/GraphBuilder.ts`。
*   **结果**: 
    *   `matrix.clear()` 在推断后立即被调用。
    *   `vectorSpace` 被置空。
    *   日志验证了清理步骤。
*   **状态**: **通过**

---

# 2026-01-05 v0.9.55 - English Document

## Test Report: Heap OOM Fix & Iterative DFS

### 1. Iterative Cycle Detection
*   **Test**: Run `npm test src/backend/algorithms/CycleDetection.test.ts`.
*   **Result**: 
    *   Iterative implementation passes all existing logic tests.
    *   No stack overflow risk for deep graphs.
*   **Status**: **Pass**

### 2. Memory Optimization
*   **Action**: Review `GraphBuilder.ts`.
*   **Observation**: 
    *   `fileMap.clear()` is called before `Algorithmic Core` to release file content memory.
    *   Logging is granular to track execution steps.
*   **Status**: **Pass**

---

# 2026-01-05 v0.9.55 - Chinese Document

## 测试报告：堆内存溢出修复与迭代 DFS

### 1. 迭代循环检测
*   **测试**: 运行 `npm test src/backend/algorithms/CycleDetection.test.ts`。
*   **结果**: 
    *   迭代实现通过了所有现有的逻辑测试。
    *   消除了深度图的堆栈溢出风险。
*   **状态**: **通过**

### 2. 内存优化
*   **操作**: 审查 `GraphBuilder.ts`。
*   **观察**: 
    *   在 `Algorithmic Core` 之前调用 `fileMap.clear()` 以释放文件内容内存。
    *   日志记录细粒度化，以便跟踪执行步骤。
*   **状态**: **通过**

---

# 2026-01-05 v0.9.52 - English Document

## Test Report: Cycle Detection Memory Optimization

### 1. Cycle Limit Enforcement
*   **Test**: Run `npm test src/backend/algorithms/CycleDetection.test.ts`.
*   **Result**: 
    *   `detectCycles(graph, 1)` correctly returns 1 cycle even if more exist.
    *   `detectCycles(graph, 100)` correctly limits the output.
    *   `detectCycles(graph)` (no limit) finds all cycles.
*   **Status**: **Pass**

### 2. Graph Build Integration
*   **Action**: Review `GraphBuilder.ts`.
*   **Observation**: 
    *   `CycleDetector.detectCycles` is called with a limit of 100.
    *   Double invocation (`hasCycle` + `detectCycles`) is removed.
    *   Warning message logic handles the limited count correctly ("100+").
*   **Status**: **Pass**

---

# 2026-01-05 v0.9.52 - Chinese Document

## 测试报告：循环检测内存优化

### 1. 循环限制执行
*   **测试**: 运行 `npm test src/backend/algorithms/CycleDetection.test.ts`。
*   **结果**: 
    *   `detectCycles(graph, 1)` 正确返回 1 个循环，即使存在更多。
    *   `detectCycles(graph, 100)` 正确限制输出。
    *   `detectCycles(graph)` (无限制) 找到所有循环。
*   **状态**: **通过**

### 2. 图构建集成
*   **操作**: 审查 `GraphBuilder.ts`。
*   **观察**: 
    *   调用 `CycleDetector.detectCycles` 时使用了 100 的限制。
    *   移除了双重调用 (`hasCycle` + `detectCycles`)。
    *   警告消息逻辑正确处理了受限计数 ("100+")。
*   **状态**: **通过**

---

# 2026-01-03 v0.9.51 - English Document

## Test Report: Performance Logging

### 1. System Info Logging
*   **Action**: Run `npm run build`.
*   **Result**: 
    *   Code compiles.
    *   `PerformanceLogger` is integrated.
*   **Status**: **Pass**

### 2. Step Timing & Resource Tracking
*   **Test**: Code Review of `GraphBuilder.ts`.
*   **Observation**: 
    *   `PerformanceLogger.start/end` wraps all major steps: "Node Initialization", "Edge Identification", "Keyword Matching", "Inference", etc.
    *   Output format includes Time, CPU, and Memory usage as requested.
*   **Status**: **Pass**

### 3. GPU Tracking
*   **Test**: Code Review of `VectorSpaceGPU.ts`.
*   **Observation**: 
    *   `PerformanceLogger` wraps the GPU kernel execution.
    *   Logs matrix size and execution time.
*   **Status**: **Pass**

## Test Report: Crash Reporting

### 1. Global Handler Initialization
*   **Action**: Start server.
*   **Observation**: `CrashLogger.initGlobalHandlers()` is called in `server.ts`.
*   **Status**: **Pass**

### 2. Worker Error Capture
*   **Test**: Code Review of Workers (`keywordMatchWorker.ts`, `statisticalWorker.ts`).
*   **Observation**: 
    *   Main logic is wrapped in `try...catch`.
    *   `CrashLogger.log()` writes to `crash.log` on error.
    *   `process.exit(1)` ensures worker terminates properly after logging.
*   **Status**: **Pass**

---

# 2026-01-03 v0.9.51 - Chinese Document

## 测试报告：性能日志

### 1. 系统信息日志
*   **操作**: 运行 `npm run build`。
*   **结果**: 
    *   代码编译通过。
    *   `PerformanceLogger` 已集成。
*   **状态**: **通过**

### 2. 步骤计时与资源跟踪
*   **测试**: 代码审查 `GraphBuilder.ts`。
*   **观察**: 
    *   `PerformanceLogger.start/end` 包裹了所有主要步骤：“节点初始化”、“边识别”、“关键词匹配”、“推断”等。
    *   输出格式包含请求的时间、CPU 和内存使用情况。
*   **状态**: **通过**

### 3. GPU 跟踪
*   **测试**: 代码审查 `VectorSpaceGPU.ts`。
*   **观察**: 
    *   `PerformanceLogger` 包裹了 GPU 内核执行。
    *   记录了矩阵大小和执行时间。
*   **状态**: **通过**

## 测试报告：崩溃报告

### 1. 全局处理程序初始化
*   **操作**: 启动服务器。
*   **观察**: `server.ts` 中调用了 `CrashLogger.initGlobalHandlers()`。
*   **状态**: **通过**

### 2. Worker 错误捕获
*   **测试**: 代码审查 Worker (`keywordMatchWorker.ts`, `statisticalWorker.ts`)。
*   **观察**: 
    *   主逻辑包裹在 `try...catch` 中。
    *   出错时 `CrashLogger.log()` 写入 `crash.log`。
    *   `process.exit(1)` 确保 Worker 在日志记录后正确终止。
*   **状态**: **通过**

---

# 2026-01-02 v0.9.50 - English Document

## Test Report: GPU Acceleration

### 1. Module Integration
*   **Action**: Run `npm run build`.
*   **Result**: 
    *   Build succeeds without errors.
    *   `amdgpu` folder is compiled to `dist/amdgpu`.
    *   `VectorSpaceGPU` is correctly instantiated in `GraphBuilder`.
*   **Status**: **Pass**

### 2. Fallback Mechanism
*   **Test**: (Simulated) GPU initialization fails.
*   **Result**: 
    *   `VectorSpaceGPU` catches the error.
    *   `similarityMatrix` remains null.
    *   `getSimilar` calls fall back to `super.getSimilar` (CPU).
    *   Application continues without crashing.
*   **Status**: **Pass**

---

# 2026-01-02 v0.9.50 - Chinese Document

## 测试报告：GPU 加速

### 1. 模块集成
*   **操作**: 运行 `npm run build`。
*   **结果**: 
    *   构建成功，无错误。
    *   `amdgpu` 文件夹被编译到 `dist/amdgpu`。
    *   `VectorSpaceGPU` 在 `GraphBuilder` 中被正确实例化。
*   **状态**: **通过**

### 2. 回退机制
*   **测试**: (模拟) GPU 初始化失败。
*   **结果**: 
    *   `VectorSpaceGPU` 捕获错误。
    *   `similarityMatrix` 保持为 null。
    *   `getSimilar` 调用回退到 `super.getSimilar` (CPU)。
    *   应用程序继续运行，未崩溃。
*   **状态**: **通过**

---

# 2026-01-02 v0.9.49 - English Document

## Test Report: UI Controls for Parallel Processing

### 1. Settings UI
*   **Action**: Open Settings Modal.
*   **Observation**: 
    *   New "Performance" group is visible.
    *   "Max Workers" slider and input are present.
    *   Default value is 4.
*   **Status**: **Pass**

### 2. Synchronization & Persistence
*   **Action**: 
    1.  Slide "Max Workers" to 8. Input updates to 8.
    2.  Type 12 into Input. Slider updates to 12.
    3.  Reload page. Open Settings.
    4.  Value remains 12.
*   **Status**: **Pass**

### 3. API Integration
*   **Action**: Open Network tab. Click "Load" on a folder.
*   **Observation**: 
    *   POST request to `/api/build` includes `maxWorkers: 12` in the payload.
*   **Status**: **Pass**

---

# 2026-01-02 v0.9.49 - Chinese Document

## 测试报告：并行处理 UI 控制

### 1. 设置界面
*   **操作**: 打开设置模态框。
*   **观察**: 
    *   可见新的“性能” (Performance) 组。
    *   存在“最大 Worker” (Max Workers) 滑块和输入框。
    *   默认值为 4。
*   **状态**: **通过**

### 2. 同步与持久化
*   **操作**: 
    1.  将“最大 Worker”滑块滑动到 8。输入框更新为 8。
    2.  在输入框中输入 12。滑块更新为 12。
    3.  重新加载页面。打开设置。
    4.  值保持为 12。
*   **状态**: **通过**

### 3. API 集成
*   **操作**: 打开网络 (Network) 标签页。点击文件夹上的“加载” (Load)。
*   **观察**: 
    *   发送到 `/api/build` 的 POST 请求在负载中包含 `maxWorkers: 12`。
*   **状态**: **通过**

---

# 2026-01-02 v0.9.48 - English Document

## Test Report: Parallel Workers Configuration

### 1. Max Workers Configuration
*   **Action**: Set `config.maxWorkers` to 50 in a test script and trigger graph build.
*   **Observation**: 
    *   Console log shows `[GraphBuilder] Spawning 50 workers...`.
    *   Parallel matching proceeds with 50 worker threads.
*   **Status**: **Pass**

---

# 2026-01-02 v0.9.48 - Chinese Document

## 测试报告：并行 Worker 配置

### 1. 最大 Worker 配置
*   **操作**: 在测试脚本中将 `config.maxWorkers` 设置为 50 并触发图构建。
*   **观察**: 
    *   控制台日志显示 `[GraphBuilder] Spawning 50 workers...`。
    *   并行匹配使用 50 个 Worker 线程进行。
*   **状态**: **通过**

---

# 2026-01-02 v0.9.47 - English Document

## Test Report: Focus Mode Interaction & Layout

### 1. Double Click Zoom Prevention
*   **Action**: Double click a node to enter Focus Mode.
*   **Result**: 
    *   Focus Mode activates.
    *   The window (viewport) zoom level remains unchanged.
    *   The view centers on the node, but does not zoom in/out (unless centering animation implies scale, but double-click zoom event is suppressed).
*   **Status**: **Pass**

### 2. Vertical Layout Label Spacing
*   **Action**: Enter Focus Mode. Select "Vertical" layout.
*   **Result**: 
    *   Nodes arrange in a vertical column.
    *   Text labels are positioned to the right of the nodes with increased spacing (dx=35).
    *   Text does not overlap with the node body or adjacent nodes.
*   **Status**: **Pass**

### 3. Canvas Mode Verification
*   **Pre-condition**: Switch renderer to "Canvas".
*   **Action**: Double click a node.
*   **Result**: Enters Focus Mode without zooming.
*   **Action**: Select "Vertical" layout.
*   **Result**: Labels are offset by 35px, avoiding overlap.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.46 - English Document

## Test Report: Focus Mode UI & Visuals

### 1. UI Hiding
*   **Action**: Enter Focus Mode (Double Click).
*   **Observation**: 
    *   Top-left "Source Select" and "Load" button disappear.
    *   Left-side "NoteConnection" control panel disappears.
    *   Only the Focus Mode exit bar is visible at the bottom.
*   **Action**: Exit Focus Mode.
*   **Result**: 
    *   All controls reappear.
    *   (On Mobile): Verify source select does NOT appear if it wasn't visible before (respected via CSS).
*   **Status**: **Pass**

### 2. Canvas Edge Suppression
*   **Pre-condition**: Switch to "Canvas" Renderer.
*   **Action**: Enter Focus Mode.
*   **Observation**: 
    *   Nodes arrange in hierarchy.
    *   **No lines (edges)** are visible connecting the nodes.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.45 - English Document

## Test Report: Canvas Interactivity & Cleanup

### 1. Canvas Hover & Click
*   **Pre-condition**: Switch to "Canvas" Renderer.
*   **Action**: Hover over a node.
*   **Result**: Node highlights, connections appear (Red/Blue), cursor changes to pointer.
*   **Action**: Single Click a node.
*   **Result**: Simulation freezes, Statistics Popup opens.
*   **Action**: Double Click a node.
*   **Result**: Enters Focus Mode.
*   **Status**: **Pass**

### 2. Node Sizing
*   **Action**: Switch "Size By" to "Degree".
*   **Result**: High-degree nodes appear larger in Canvas mode, matching SVG proportions.
*   **Action**: Switch "Size By" to "Uniform".
*   **Result**: All nodes appear small (r=5).
*   **Status**: **Pass**

### 3. Cleanup
*   **Observation**: "View Mode" (Nodes/Clusters) radio buttons are gone from the UI.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.44 - English Document

## Test Report: Independent Focus Mode Spacing

### 1. Default Values
*   **Action**: Enter Focus Mode. Select "Horizontal" layout.
*   **Result**: "Layer-Space" slider is at 125 (or approx 1/2 of max).
*   **Action**: Select "Vertical" layout.
*   **Result**: "Node-Space" slider is at 20 (or approx 1/4 of max). "Layer-Space" is at 250.
*   **Status**: **Pass**

### 2. Independent Persistence
*   **Action**: 
    1.  In "Horizontal" mode, set Layer-Space to 200.
    2.  Switch to "Vertical". Slider updates to 250 (default).
    3.  Set Vertical Layer-Space to 300.
    4.  Switch back to "Horizontal". Slider reverts to 200.
*   **Result**: Settings are preserved independently for each layout type.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.43 - English Document

## Test Report: Context-Aware Settings UI

### 1. Label Switching
*   **Action**: Select "Force" Layout. Open Settings.
*   **Result**: Label shows "Repulsion (Force)".
*   **Action**: Close Settings. Select "DAG" Layout. Open Settings.
*   **Result**: Label shows "Repulsion (DAG)".
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.42 - English Document

## Test Report: Distinct Repulsion Settings

### 1. Default Values
*   **Action**: Clear `localStorage` and reload. Check Settings in "Force" mode.
*   **Result**: Repulsion shows -550.
*   **Action**: Switch to "DAG" mode. Open Settings.
*   **Result**: Repulsion shows -850.
*   **Status**: **Pass**

### 2. Independent Configuration
*   **Action**: 
    1.  In "Force" mode, set Repulsion to -200.
    2.  Switch to "DAG" mode. Check Settings -> Should be -850 (default).
    3.  Set DAG Repulsion to -900.
    4.  Switch back to "Force". Check Settings -> Should be -200.
*   **Result**: Values persist independently.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.41 - English Document

## Test Report: Settings Modal Simulation Freeze

### 1. Auto-Freeze on Open
*   **Action**: Ensure "Freeze Layout" is unchecked and simulation is running (nodes moving). Click "Settings" button.
*   **Observation**: 
    *   Settings modal opens.
    *   Background nodes stop moving immediately (`simulation.stop()` triggered).
    *   CPU usage drops.
*   **Status**: **Pass**

### 2. Resume on Close
*   **Action**: Close the Settings modal (via X or background click).
*   **Result**: 
    *   Simulation restarts automatically.
    *   Nodes resume movement.
*   **Status**: **Pass**

### 3. Interaction with Global Freeze
*   **Pre-condition**: Check "Freeze Layout". Open Settings.
*   **Action**: Close Settings.
*   **Result**: 
    *   Simulation remains stopped (respects global freeze).
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.40 - English Document

## Test Report: Freeze Layout Priority (Settings Modal)

### 1. Settings Change with Freeze
*   **Pre-condition**: Enable "Freeze Layout". Ensure nodes are stationary. Open "Settings" modal.
*   **Action**: Change "Repulsion" slider value significantly.
*   **Observation**: 
    *   Nodes do **NOT** move or jitter.
    *   Simulation remains stopped.
*   **Action**: Change "Edge Opacity" slider.
*   **Observation**: 
    *   Edges fade in/out immediately (Visual update works).
    *   Nodes remain stationary.
*   **Status**: **Pass**

### 2. Unfreeze Physics Application
*   **Action**: Close modal. Uncheck "Freeze Layout".
*   **Result**: 
    *   Simulation restarts.
    *   Nodes move to new positions reflecting the updated Repulsion strength (e.g., spreading out more if repulsion increased).
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.39 - English Document

## Test Report: Layout Switch Relaxation & Freeze

### 1. Layout Switch Relaxation
*   **Action**: Switch from "Force" to "DAG" layout (ensure DAG wasn't cached/visited recently).
*   **Observation**: 
    *   Nodes move rapidly (low friction) to form the DAG structure.
    *   After ~2 seconds, movement slows down as friction increases to 0.95.
*   **Status**: **Pass**

### 2. Delayed Freeze on Switch
*   **Pre-condition**: Enable "Freeze Layout".
*   **Action**: Switch Layout Mode (e.g., Force -> DAG).
*   **Result**: 
    *   Simulation starts and runs visibly for 2 seconds (Relaxation Phase).
    *   Nodes arrange into the new layout.
    *   After 2 seconds, simulation stops completely (Nodes freeze).
    *   "Freeze Layout" checkbox remains checked.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.38 - English Document

## Test Report: Quick Start Guide HTML Rendering

### 1. HTML Tag Rendering
*   **Pre-condition**: Switch language to Chinese (where `<br>` tags are present).
*   **Action**: Open "Quick Start Guide" (Help button).
*   **Observation**: 
    *   Line breaks `<br>` are rendered as actual new lines, not text.
    *   Bold tags `<strong>` are rendered as bold text.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.37 - English Document

## Test Report: Rapid Relaxation Strategy

### 1. Initialization Behavior
*   **Action**: Reload the page.
*   **Observation**: 
    *   Nodes move rapidly initially (expanding outward).
    *   Check console `simulation.velocityDecay()` within first 2s -> Should be roughly 0.2.
*   **Status**: **Pass**

### 2. Stabilization Transition
*   **Action**: Wait 2 seconds after reload.
*   **Observation**: 
    *   Movement slows down noticeably as friction increases.
    *   "Speed" Slider UI snaps to 0.95 position.
    *   Check console `simulation.velocityDecay()` -> Should be 0.95.
*   **Status**: **Pass**

### 3. Manual Override
*   **Action**: Reload page, immediately drag Speed Slider to 0.5 (within 1s).
*   **Observation**: 
    *   Wait 3 seconds.
    *   Slider remains at 0.5.
    *   Simulation friction stays at 0.5 (does not force 0.95).
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.36 - English Document

## Test Report: Freeze Layout Priority Fix

### 1. Visual Settings Change with Freeze
*   **Pre-condition**: Enable "Freeze Layout". Ensure nodes are stationary.
*   **Action**: Change "Size By" from "Uniform" to "Degree".
*   **Observation**: 
    *   Node circles visibly change size (larger for high degree).
    *   Nodes do **NOT** move or jitter.
    *   Simulation remains stopped (0 CPU usage).
*   **Status**: **Pass**

### 2. Unfreeze Behavior
*   **Action**: Uncheck "Freeze Layout".
*   **Result**: 
    *   Simulation restarts.
    *   Nodes adjust position based on new sizes (collision radius updated in background).
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.35 - English Document

## Test Report: Viewport Culling Relaxation

### 1. Extended Zoom Threshold
*   **Action**: Zoom out slowly from 1.0x.
*   **Observation**: 
    *   At 0.4x (previous limit), simulation CONTINUES running.
    *   Continue zooming out.
    *   Simulation stops only when scale drops below 0.1x.
*   **Status**: **Pass**

### 2. Smooth Panning Buffer
*   **Action**: Zoom in (scale ~2.0). Pan rapidly to the side.
*   **Observation**: 
    *   Nodes entering the viewport are already in motion or settled correctly (not frozen in "mid-air").
    *   No "pop-in" effect where nodes suddenly wake up after entering the screen.
    *   The 800px buffer ensures seamless transition.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.34 - English Document

## Test Report: Global Layout Update Fix

### 1. Layout Switching with Culling
*   **Pre-condition**: 
    1.  Zoom in significantly (Scale > 2) so that >50% of nodes are off-screen.
    2.  Verify off-screen nodes are culled (check via console `isCulled=true` or simulation CPU drop).
*   **Action**: Switch Layout Mode (e.g., Force -> DAG).
*   **Result**: 
    *   All nodes (including previously off-screen ones) immediately start moving to their new positions.
    *   Zooming out reveals the graph has fully rearranged according to the new layout (DAG layers).
    *   Nodes are NOT stuck in their previous positions.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.33 - English Document

## Test Report: Layout State Caching

### 1. State Preservation
*   **Action**: 
    1.  Start in Force Layout. Drag a node (Node A) to a specific spot.
    2.  Switch to DAG Layout. Wait for it to arrange.
    3.  Switch back to Force Layout.
*   **Result**: 
    *   Node A reappears exactly where it was left in step 1.
    *   No animation/movement occurs (Instant Switch).
    *   Simulation is stopped (or minimal alpha) to preserve state.
*   **Status**: **Pass**

### 2. Independent States
*   **Action**:
    1.  In DAG mode, drag Node B.
    2.  Switch to Force.
    3.  Switch back to DAG.
*   **Result**: Node B is at the new dragged position in DAG mode.
*   **Status**: **Pass**

---

# 2026-01-02 v0.9.47 - Chinese Document

## 测试报告：专注模式交互与布局

### 1. 双击缩放预防
*   **操作**: 双击节点进入专注模式。
*   **结果**: 
    *   专注模式激活。
    *   窗口（视口）缩放级别保持不变。
    *   视图以节点为中心，但不会放大/缩小（双击缩放事件被抑制）。
*   **状态**: **通过**

### 2. 垂直布局标签间距
*   **操作**: 进入专注模式。选择“垂直”布局。
*   **结果**: 
    *   节点排列成垂直列。
    *   文本标签位于节点右侧，间距增加 (dx=35)。
    *   文本不与节点主体或相邻节点重叠。
*   **状态**: **通过**

### 3. Canvas 模式验证
*   **前置条件**: 将渲染器切换为 "Canvas"。
*   **操作**: 双击节点。
*   **结果**: 进入专注模式且不缩放。
*   **操作**: 选择“垂直”布局。
*   **结果**: 标签偏移 35px，避免重叠。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.46 - Chinese Document

## 测试报告：专注模式 UI 与视觉

### 1. UI 隐藏
*   **操作**: 进入专注模式（双击）。
*   **观察**: 
    *   左上角“源选择”和“加载”按钮消失。
    *   左侧“NoteConnection”控制面板消失。
    *   仅底部可见专注模式退出栏。
*   **操作**: 退出专注模式。
*   **结果**: 
    *   所有控件重新出现。
    *   （移动端）：验证如果源选择之前不可见，则不会出现（尊重 CSS）。
*   **状态**: **通过**

### 2. Canvas 边抑制
*   **前置条件**: 切换到 "Canvas" 渲染器。
*   **操作**: 进入专注模式。
*   **观察**: 
    *   节点按层级排列。
    *   **没有线条 (边)** 连接节点。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.45 - Chinese Document

## 测试报告：Canvas 交互与清理

### 1. Canvas 悬停与点击
*   **前置条件**: 切换到 "Canvas" 渲染器。
*   **操作**: 悬停在节点上。
*   **结果**: 节点高亮，连接显示 (红/蓝)，光标变为指针。
*   **操作**: 单击节点。
*   **结果**: 模拟冻结，统计弹窗打开。
*   **操作**: 双击节点。
*   **结果**: 进入专注模式。
*   **状态**: **通过**

### 2. 节点大小
*   **操作**: 将“大小依据”切换为“度数”。
*   **结果**: 高度数节点在 Canvas 模式下显示得更大，与 SVG 比例匹配。
*   **操作**: 将“大小依据”切换为“统一”。
*   **结果**: 所有节点显示为小尺寸 (r=5)。
*   **状态**: **通过**

### 3. 清理
*   **观察**: “视图模式” (节点/聚类) 单选按钮已从 UI 中消失。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.44 - Chinese Document

## 测试报告：独立专注模式间距

### 1. 默认值
*   **操作**: 进入专注模式。选择“水平”布局。
*   **结果**: “层间距”滑块位于 125（或最大值的约 1/2）。
*   **操作**: 选择“垂直”布局。
*   **结果**: “节点间距”滑块位于 20（或最大值的约 1/4）。“层间距”位于 250。
*   **状态**: **通过**

### 2. 独立持久化
*   **操作**: 
    1.  在“水平”模式下，将层间距设置为 200。
    2.  切换到“垂直”。滑块更新为 250（默认）。
    3.  将垂直层间距设置为 300。
    4.  切换回“水平”。滑块恢复为 200。
*   **结果**: 设置为每种布局类型独立保存。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.43 - Chinese Document

## 测试报告：上下文感知设置 UI

### 1. 标签切换
*   **操作**: 选择“力导向”布局。打开设置。
*   **结果**: 标签显示“排斥力 (力导向)”。
*   **操作**: 关闭设置。选择“DAG”布局。打开设置。
*   **结果**: 标签显示“排斥力 (DAG)”。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.42 - Chinese Document

## 测试报告：独立排斥力设置

### 1. 默认值
*   **操作**: 清除 `localStorage` 并重新加载。在“力导向”模式下检查设置。
*   **结果**: 排斥力显示 -550。
*   **操作**: 切换到“DAG”模式。打开设置。
*   **结果**: 排斥力显示 -850。
*   **状态**: **通过**

### 2. 独立配置
*   **操作**: 
    1.  在“力导向”模式下，将排斥力设置为 -200。
    2.  切换到“DAG”模式。检查设置 -> 应为 -850 (默认)。
    3.  将 DAG 排斥力设置为 -900。
    4.  切换回“力导向”。检查设置 -> 应为 -200。
*   **结果**: 数值独立持久化。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.41 - Chinese Document

## 测试报告：设置模态框模拟冻结

### 1. 打开时自动冻结
*   **操作**: 确保“冻结布局”未选中且模拟正在运行（节点移动）。点击“设置”按钮。
*   **观察**: 
    *   设置模态框打开。
    *   背景节点立即停止移动（触发了 `simulation.stop()`）。
    *   CPU 使用率下降。
*   **状态**: **通过**

### 2. 关闭时恢复
*   **操作**: 关闭设置模态框（通过 X 或点击背景）。
*   **结果**: 
    *   模拟自动重启。
    *   节点恢复移动。
*   **状态**: **通过**

### 3. 与全局冻结的交互
*   **前置条件**: 选中“冻结布局”。打开设置。
*   **操作**: 关闭设置。
*   **结果**: 
    *   模拟保持停止状态（尊重全局冻结）。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.40 - Chinese Document

## 测试报告：冻结布局优先级 (设置模态框)

### 1. 冻结时更改设置
*   **前置条件**: 启用“冻结布局”。确保节点静止。打开“设置”模态框。
*   **操作**: 大幅更改“排斥力”滑块值。
*   **观察**: 
    *   节点**不**移动或抖动。
    *   模拟保持停止。
*   **操作**: 更改“边透明度”滑块。
*   **观察**: 
    *   边立即淡入/淡出（视觉更新有效）。
    *   节点保持静止。
*   **状态**: **通过**

### 2. 解冻物理应用
*   **操作**: 关闭模态框。取消选中“冻结布局”。
*   **结果**: 
    *   模拟重启。
    *   节点移动到反映更新后排斥力强度的新位置（例如，如果排斥力增加，则扩散得更开）。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.39 - Chinese Document

## 测试报告：布局切换松弛与冻结

### 1. 布局切换松弛
*   **操作**: 从“力导向”切换到“DAG”布局（确保 DAG 最近未缓存/访问）。
*   **观察**: 
    *   节点快速移动（低摩擦）以形成 DAG 结构。
    *   约 2 秒后，随着摩擦力增加到 0.95，移动减慢。
*   **状态**: **通过**

### 2. 切换时的延迟冻结
*   **前置条件**: 启用“冻结布局”。
*   **操作**: 切换布局模式（例如 Force -> DAG）。
*   **结果**: 
    *   模拟开始并明显运行 2 秒（松弛阶段）。
    *   节点排列成新的布局。
    *   2 秒后，模拟完全停止（节点冻结）。
    *   “冻结布局”复选框保持选中状态。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.38 - Chinese Document

## 测试报告：快速开始指南 HTML 渲染

### 1. HTML 标签渲染
*   **前置条件**: 切换语言至中文（包含 `<br>` 标签）。
*   **操作**: 打开“快速开始指南”（帮助按钮）。
*   **观察**: 
    *   换行符 `<br>` 被渲染为实际换行，而非文本。
    *   粗体标签 `<strong>` 被渲染为粗体文本。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.37 - Chinese Document

## 测试报告：快速松弛策略

### 1. 初始化行为
*   **操作**: 重新加载页面。
*   **观察**: 
    *   节点最初快速移动（向外扩展）。
    *   在最初 2 秒内检查控制台 `simulation.velocityDecay()` -> 应约为 0.2。
*   **状态**: **通过**

### 2. 稳定过渡
*   **操作**: 重新加载后等待 2 秒。
*   **观察**: 
    *   随着摩擦力增加，移动明显减慢。
    *   “速度”滑块 UI 弹跳到 0.95 位置。
    *   检查控制台 `simulation.velocityDecay()` -> 应为 0.95。
*   **状态**: **通过**

### 3. 手动覆盖
*   **操作**: 重新加载页面，立即将速度滑块拖动到 0.5（在 1 秒内）。
*   **观察**: 
    *   等待 3 秒。
    *   滑块保持在 0.5。
    *   模拟摩擦力保持在 0.5（不强制为 0.95）。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.36 - Chinese Document

## 测试报告：冻结布局优先级修复

### 1. 冻结时更改视觉设置
*   **前置条件**: 启用“冻结布局”。确保节点静止。
*   **操作**: 将“大小依据”从“统一”更改为“度数”。
*   **观察**: 
    *   节点圆圈大小明显改变（高度数节点变大）。
    *   节点**不**移动或抖动。
    *   模拟保持停止 (0 CPU 使用率)。
*   **状态**: **通过**

### 2. 解冻行为
*   **操作**: 取消选中“冻结布局”。
*   **结果**: 
    *   模拟重启。
    *   节点根据新大小调整位置（碰撞半径已在后台更新）。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.35 - Chinese Document

## 测试报告：视口剔除放宽

### 1. 扩展缩放阈值
*   **操作**: 从 1.0x 缓慢缩小。
*   **观察**: 
    *   在 0.4x (之前的限制) 时，模拟**继续**运行。
    *   继续缩小。
    *   仅当比例降至 0.1x 以下时，模拟才停止。
*   **状态**: **通过**

### 2. 平滑平移缓冲
*   **操作**: 放大 (比例 ~2.0)。快速向侧面平移。
*   **观察**: 
    *   进入视口的节点已经在移动或正确稳定（未冻结在“半空中”）。
    *   没有节点进入屏幕后突然唤醒的“弹出”效应。
    *   800px 缓冲区确保了无缝过渡。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.34 - Chinese Document

## 测试报告：全局布局更新修复

### 1. 带剔除的布局切换
*   **前置条件**: 
    1.  大幅放大 (比例 > 2)，使得超过 50% 的节点在屏幕外。
    2.  验证屏幕外节点被剔除（通过控制台检查 `isCulled=true` 或观察模拟 CPU 下降）。
*   **操作**: 切换布局模式（例如 Force -> DAG）。
*   **结果**: 
    *   所有节点（包括之前在屏幕外的）立即开始移动到新位置。
    *   缩小视图显示图表已完全按照新布局（DAG 层）重新排列。
    *   节点**没有**卡在以前的位置。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.33 - Chinese Document

## 测试报告：布局状态缓存

### 1. 状态保留
*   **操作**: 
    1.  在力导向布局中开始。将节点 (Node A) 拖动到特定位置。
    2.  切换到 DAG 布局。等待排列完成。
    3.  切换回力导向布局。
*   **结果**: 
    *   Node A 准确地重新出现在步骤 1 中留下的位置。
    *   没有发生动画/移动（即时切换）。
    *   模拟停止（或最小 alpha）以保留状态。
*   **状态**: **通过**

### 2. 独立状态
*   **操作**:
    1.  在 DAG 模式下，拖动 Node B。
    2.  切换到 Force。
    3.  切换回 DAG。
*   **结果**: Node B 位于 DAG 模式下新的拖动位置。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.32 - English Document

## Test Report: High Damping & Render Optimization

### 1. Damping Behavior
*   **Test**: Reload the page.
*   **Observation**: 
    *   Nodes settle into position significantly faster than before.
    *   Movement stops almost immediately after drag release.
    *   Slider shows "0.92".
*   **Status**: **Pass**

### 2. Render Culling
*   **Test**: Zoom in to a small area (scale > 2).
*   **Action**: Pan the view.
*   **Result**: 
    *   Performance (FPS) feels smooth.
    *   Nodes entering the view snap to correct positions (logic works).
    *   Verify code: `ticked` uses `.filter(d => !d.isCulled)` - Confirmed.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.32 - Chinese Document

## 测试报告：高阻尼与渲染优化

### 1. 阻尼行为
*   **测试**: 重新加载页面。
*   **观察**: 
    *   节点比以前明显更快地稳定到位。
    *   释放拖动后移动几乎立即停止。
    *   滑块显示 "0.92"。
*   **状态**: **通过**

### 2. 渲染剔除
*   **测试**: 放大到小区域 (比例 > 2)。
*   **操作**: 平移视图。
*   **结果**: 
    *   性能 (FPS) 感觉流畅。
    *   进入视图的节点弹跳到正确位置（逻辑有效）。
    *   验证代码: `ticked` 使用了 `.filter(d => !d.isCulled)` - 已确认。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.31 - English Document

## Test Report: Simulation Optimization (Viewport Culling)

### 1. Full View Freeze
*   **Action**: Zoom out until the graph is small (scale < 0.4).
*   **Result**: 
    *   Simulation stops automatically (CPU usage drops).
    *   Nodes freeze in place.
*   **Status**: **Pass**

### 2. Off-screen Freezing
*   **Action**: Zoom in to a specific area.
*   **Result**: 
    *   Nodes within the visible area (and immediate buffer) continue to move/settle.
    *   Nodes far outside the viewport are frozen (fixed position).
    *   Pan to a new area -> Previously frozen nodes wake up and start moving.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.31 - Chinese Document

## 测试报告：模拟优化 (视口剔除)

### 1. 全景冻结
*   **操作**: 缩小直到图表变小 (比例 < 0.4)。
*   **结果**: 
    *   模拟自动停止 (CPU 使用率下降)。
    *   节点冻结在原地。
*   **状态**: **通过**

### 2. 屏幕外冻结
*   **操作**: 放大到特定区域。
*   **结果**: 
    *   可见区域（及即时缓冲区）内的节点继续移动/稳定。
    *   远离视口的节点被冻结（固定位置）。
    *   平移到新区域 -> 之前冻结的节点唤醒并开始移动。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.30 - English Document

## Test Report: Focus Mode Layout Isolation

### 1. Position Restoration
*   **Pre-condition**: Identify the position of a specific node (Node A).
*   **Action**: 
    1.  Double click Node A to enter Focus Mode.
    2.  Observe Node A moves to the center.
    3.  Drag Node A to a new position.
    4.  Click "Exit Focus Mode".
*   **Result**: 
    *   Node A snaps back to its original position (before step 1).
    *   The graph layout is identical to the pre-focus state.
*   **Status**: **Pass**

### 2. Layout Consistency with Simulation
*   **Action**: 
    1.  Wait for simulation to settle (or freeze layout).
    2.  Enter Focus Mode.
    3.  Exit Focus Mode.
*   **Result**: No significant movement or "explosion" of nodes occurs upon exit. The visual state is preserved.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.30 - Chinese Document

## 测试报告：专注模式布局隔离

### 1. 位置恢复
*   **前置条件**: 确定特定节点 (节点 A) 的位置。
*   **操作**: 
    1.  双击节点 A 进入专注模式。
    2.  观察节点 A 移动到中心。
    3.  将节点 A 拖动到新位置。
    4.  点击“退出专注模式”。
*   **结果**: 
    *   节点 A 弹回其原始位置（步骤 1 之前）。
    *   图表布局与专注前状态完全相同。
*   **状态**: **通过**

### 2. 模拟布局一致性
*   **操作**: 
    1.  等待模拟稳定（或冻结布局）。
    2.  进入专注模式。
    3.  退出专注模式。
*   **结果**: 退出时没有发生节点的明显移动或“爆炸”。视觉状态得以保留。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.29 - English Document

## Test Report: Freeze Layout Persistence (Analysis & Resize)

### 1. Analysis Panel Interaction
*   **Pre-condition**: Enable "Freeze Layout". Ensure nodes are stationary.
*   **Action**: Click "Analysis & Export" button.
*   **Observation**: 
    *   Analysis Panel opens (changing the graph container size).
    *   Nodes do **NOT** move or jitter.
    *   Simulation remains stopped.
*   **Status**: **Pass**

### 2. Window Resize Interaction
*   **Pre-condition**: Enable "Freeze Layout".
*   **Action**: Resize the browser window.
*   **Observation**: 
    *   Graph container resizes.
    *   Nodes maintain their relative positions (Simulation does not restart).
    *   Canvas (if active) redraws correctly at new resolution.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.29 - Chinese Document

## 测试报告：冻结布局持久化 (分析与调整大小)

### 1. 分析面板交互
*   **前置条件**: 启用“冻结布局”。确保节点静止。
*   **操作**: 点击“分析与导出”按钮。
*   **观察**: 
    *   分析面板打开（改变了图表容器大小）。
    *   节点**不**移动或抖动。
    *   模拟保持停止。
*   **状态**: **通过**

### 2. 窗口调整大小交互
*   **前置条件**: 启用“冻结布局”。
*   **操作**: 调整浏览器窗口大小。
*   **观察**: 
    *   图表容器调整大小。
    *   节点保持其相对位置（模拟不重启）。
    *   Canvas（如果激活）在分辨率下正确重绘。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.28 - English Document

## Test Report: Focus Mode Specific Content Button

### 1. Button Visibility
*   **Pre-condition**: Double click a node to enter Focus Mode.
*   **Observation**: A new button "Specific Content" is visible in the bottom control panel (`#focus-exit-btn`), placed before the "Exit" button.
*   **Status**: **Pass**

### 2. Functional Interaction
*   **Action**: Click the "Specific Content" button.
*   **Result**: 
    *   The Reading Window opens displaying the content of the currently focused node.
    *   The behavior matches exactly that of double-clicking the focused node.
*   **Status**: **Pass**

### 3. Localization
*   **Test**: Switch language to Chinese. Enter Focus Mode.
*   **Result**: Button label shows "打开具体内容".
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.28 - Chinese Document

## 测试报告：专注模式具体内容按钮

### 1. 按钮可见性
*   **前置条件**: 双击节点进入专注模式。
*   **观察**: 底部控制面板 (`#focus-exit-btn`) 中出现一个新的按钮“打开具体内容”，位于“退出”按钮之前。
*   **状态**: **通过**

### 2. 功能交互
*   **操作**: 点击“打开具体内容”按钮。
*   **结果**: 
    *   阅读窗口打开，显示当前聚焦节点的内容。
    *   该行为与双击聚焦节点的行为完全一致。
*   **状态**: **通过**

### 3. 本地化
*   **测试**: 切换语言至中文。进入专注模式。
*   **结果**: 按钮标签显示“打开具体内容”。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.27 - English Document

## Test Report: Conditional Restart (Freeze vs Focus)

### 1. Exit Focus with Freeze Enabled
*   **Pre-condition**: Enable "Freeze Layout". Double click a node to enter Focus Mode.
*   **Action**: Click "Exit Focus Mode".
*   **Result**: 
    *   The graph returns to the global view.
    *   Nodes do **NOT** move (Simulation remains stopped).
    *   The visual layout is static (might look like the focus grid or a mix, but it is frozen as requested).
*   **Status**: **Pass**

### 2. Resume after Exit
*   **Action**: Uncheck "Freeze Layout".
*   **Result**: The simulation restarts, and nodes move back to their force-directed positions.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.27 - Chinese Document

## 测试报告：条件重启 (冻结 vs 专注)

### 1. 启用冻结时退出专注模式
*   **前置条件**: 启用“冻结布局”。双击节点进入专注模式。
*   **操作**: 点击“退出专注模式”。
*   **结果**: 
    *   图表返回全局视图。
    *   节点**不**移动 (模拟保持停止)。
    *   视觉布局是静态的（可能看起来像专注网格或混合体，但按要求已冻结）。
*   **状态**: **通过**

### 2. 退出后恢复
*   **操作**: 取消选中“冻结布局”。
*   **结果**: 模拟重启，节点移动回其力导向位置。
*   **状态**: **通过**

---

# 2025-12-26 v0.9.26 - English Document

## Test Report: UX Enhancements & Quick Start

### 1. Freeze Layout Quick Button
*   **Test**: Click the snowflake (❄️) button in the top-right corner.
*   **Result**: 
    *   Button background turns Red.
    *   "Freeze Layout" checkbox in the Simulation panel becomes checked.
    *   Simulation stops and node dragging is disabled (per v0.9.25 logic).
*   **Test**: Click the button again.
*   **Result**: 
    *   Button background reverts to dark gray.
    *   Checkbox becomes unchecked.
    *   Simulation resumes.
*   **Test**: Manually check/uncheck the checkbox in the panel.
*   **Result**: The quick button visual state updates to match the checkbox.
*   **Status**: **Pass**

### 2. Quick Start Manual (Onboarding)
*   **Test**: Clear `localStorage.removeItem('noteconnection_manual_seen')` and reload.
*   **Result**: The "Quick Start Guide" modal appears automatically after a short delay.
*   **Test**: Click "Don't show again" and close the modal. Reload the page.
*   **Result**: The modal does NOT appear automatically.
*   **Status**: **Pass**

### 3. Help Button Access
*   **Test**: Click the "Help" (❓) button.
*   **Result**: The Quick Start Guide modal opens immediately.
*   **Status**: **Pass**

### 4. Localization
*   **Test**: Switch language to Chinese.
*   **Result**: 
    *   Quick Button tooltip/label (if visible) shows Chinese.
    *   Manual title becomes "快速开始指南".
    *   All manual steps and descriptions are in Chinese.
*   **Status**: **Pass**

---

# 2025-12-26 v0.9.26 - Chinese Document

## 测试报告：UX 增强与快速开始

### 1. 冻结布局快速按钮
*   **测试**: 点击右上角的雪花 (❄️) 按钮。
*   **结果**: 
    *   按钮背景变红。
    *   模拟面板中的“冻结布局”复选框被选中。
    *   模拟停止且节点拖动被禁用（根据 v0.9.25 逻辑）。
*   **测试**: 再次点击该按钮。
*   **结果**: 
    *   按钮背景恢复为深灰色。
    *   复选框变为未选中。
    *   模拟恢复。
*   **测试**: 手动选中/取消选中面板中的复选框。
*   **结果**: 快速按钮的视觉状态更新以匹配复选框。
*   **状态**: **通过**

### 2. 快速开始指南 (引导)
*   **测试**: 清除 `localStorage.removeItem('noteconnection_manual_seen')` 并重新加载。
*   **结果**: “快速开始指南”模态框在短暂延迟后自动出现。
*   **测试**: 点击“不再显示”并关闭模态框。重新加载页面。
*   **结果**: 模态框**不**会自动出现。
*   **状态**: **通过**

### 3. 帮助按钮访问
*   **测试**: 点击“帮助” (❓) 按钮。
*   **结果**: 快速开始指南模态框立即打开。
*   **状态**: **通过**

### 4. 本地化
*   **测试**: 切换语言至中文。
*   **结果**: 
    *   快速按钮提示/标签（如果可见）显示中文。
    *   指南标题变为“快速开始指南”。
    *   所有指南步骤和描述均为中文。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.25 - English Document

## Test Report: Freeze Layout Optimization

### 1. Main Interface Frozen State
*   **Test**: Enable "Freeze Layout" checkbox in the Simulation panel.
*   **Action**: Attempt to drag any node in the main graph (SVG Mode).
*   **Result**: 
    *   Node does NOT move.
    *   Simulation does NOT restart (no CPU spike).
    *   Drag cursor interaction is effectively suppressed.
*   **Status**: **Pass**

### 2. Focus Mode Interaction (Exemption)
*   **Test**: While "Freeze Layout" is enabled, enter Focus Mode (Double Click).
*   **Action**: Attempt to drag the focused node or its neighbors.
*   **Result**: 
    *   Node moves with the mouse (Drag works).
    *   Layout settles after drag (Simulation works for the active subset).
    *   This confirms the global freeze does not hinder focused exploration.
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.25 - Chinese Document

## 测试报告：冻结布局优化

### 1. 主界面冻结状态
*   **测试**: 在模拟面板中启用“冻结布局”复选框。
*   **操作**: 尝试拖动主图（SVG 模式）中的任何节点。
*   **结果**: 
    *   节点**不**移动。
    *   模拟**不**重启（无 CPU 峰值）。
    *   拖动光标交互被有效抑制。
*   **状态**: **通过**

### 2. 专注模式交互（豁免）
*   **测试**: 在启用“冻结布局”时，进入专注模式（双击）。
*   **操作**: 尝试拖动焦点节点或其邻居。
*   **结果**: 
    *   节点跟随鼠标移动（拖动有效）。
    *   拖动后布局稳定（模拟对活动子集有效）。
    *   这证实了全局冻结不会阻碍专注探索。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.24 - English Document

## Test Report: Focus Mode Memory Optimization

### 1. Simulation Subsetting (Optimization)
*   **Test**: Enter Focus Mode (Double Click).
*   **Observation**: 
    *   Focused nodes rearrange smoothly.
    *   Background nodes (if visible/dimmed) do NOT move or drift, even if simulation is running.
    *   CPU usage (observable via browser dev tools) should be lower compared to previous versions during Focus Mode interaction.
*   **Result**: 
    *   `simulation.nodes()` length equals the number of focused+neighbor nodes.
    *   Original state preserved.
*   **Status**: **Pass**

### 2. State Restoration
*   **Test**: Exit Focus Mode.
*   **Observation**: 
    *   Background nodes instantly reappear/reactivate in their EXACT original positions.
    *   Simulation resumes for the entire graph.
    *   No "explosion" or resetting of the entire graph layout occurs.
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.24 - Chinese Document

## 测试报告：专注模式内存优化

### 1. 模拟子集化（优化）
*   **测试**: 进入专注模式（双击）。
*   **观察**: 
    *   焦点节点平滑地重新排列。
    *   背景节点（如果可见/变暗）**不**移动或漂移，即使模拟正在运行。
    *   与以前的版本相比，专注模式交互期间的 CPU 使用率（可通过浏览器开发工具观察）应较低。
*   **结果**: 
    *   `simulation.nodes()` 的长度等于焦点节点+邻居节点的数量。
    *   原始状态得以保留。
*   **状态**: **通过**

### 2. 状态恢复
*   **测试**: 退出专注模式。
*   **观察**: 
    *   背景节点立即在它们的确切原始位置重新出现/重新激活。
    *   整个图表的模拟恢复。
    *   没有发生整个图表布局的“爆炸”或重置。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.23 - English Document

## Test Report: Default Settings Adjustment

### 1. Reading Window Font Size
*   **Test**: Open the Reading Window by clicking a node (after double-clicking to focus, or if focusing opens reader).
*   **Result**: 
    *   The font size of the content is small (0.5rem).
    *   Zoom controls work to increase size.
*   **Status**: **Pass**

### 2. Simulation Damping
*   **Test**: Reload the page. Check the "Speed (Damping)" slider value.
*   **Result**: Slider shows "0.6" and handle is at 0.6 position.
*   **Test**: Observe graph movement.
*   **Result**: Nodes settle slightly faster than before (higher damping/friction).
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.23 - Chinese Document

## 测试报告：默认设置调整

### 1. 阅读窗口字体大小
*   **测试**: 点击节点打开阅读窗口（双击专注后，或如果专注模式打开阅读器）。
*   **结果**: 
    *   内容字体大小较小 (0.5rem)。
    *   缩放控件可以增加大小。
*   **状态**: **通过**

### 2. 模拟阻尼 (Damping)
*   **测试**: 重新加载页面。检查“速度（阻尼）”滑块值。
*   **结果**: 滑块显示 "0.6"，手柄位于 0.6 位置。
*   **测试**: 观察图表移动。
*   **结果**: 节点稳定速度比以前稍快（更高的阻尼/摩擦力）。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.22 - English Document

## Test Report: Mobile Popup Adaptation

### 1. Touch Drag Interaction
*   **Test**: Open the application in mobile view (or device simulation). Click a node to open the popup.
*   **Action**: Touch and hold the popup header (title bar) with one finger and move.
*   **Result**: 
    *   The popup follows the finger movement smoothly.
    *   The page background does NOT scroll while dragging the popup.
    *   `dragging` class is added during interaction.
*   **Status**: **Pass**

### 2. Pinch-to-Zoom Interaction
*   **Test**: Open the popup on a touch device.
*   **Action**: Place two fingers on the popup content and spread them apart (pinch out).
*   **Result**: 
    *   The text size inside the popup increases.
    *   The scale is clamped at maximum 2.0x.
*   **Action**: Pinch two fingers together (pinch in).
*   **Result**: 
    *   The text size decreases.
    *   The scale is clamped at minimum 0.5x.
*   **Status**: **Pass**

### 3. Interaction Conflict Prevention
*   **Test**: Try to drag the popup by touching the content area (not the header).
*   **Result**: The popup does NOT move (Drag is restricted to header).
*   **Test**: Try to pinch zoom while dragging the header.
*   **Result**: Pinch logic requires 2 fingers on the popup; drag logic requires 1 finger on the header. Logic separation holds.
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.22 - Chinese Document

## 测试报告：移动端弹窗适配

### 1. 触摸拖动交互
*   **测试**: 在移动视图（或设备模拟）中打开应用。点击节点打开弹窗。
*   **操作**: 单指按住弹窗头部（标题栏）并移动。
*   **结果**: 
    *   弹窗平滑地跟随手指移动。
    *   拖动弹窗时页面背景**不会**滚动。
    *   交互期间添加了 `dragging` 类。
*   **状态**: **通过**

### 2. 捏合缩放交互
*   **测试**: 在触摸设备上打开弹窗。
*   **操作**: 双指放在弹窗内容上并张开（捏合放大）。
*   **结果**: 
    *   弹窗内的文字大小增加。
    *   缩放比例被限制在最大 2.0x。
*   **操作**: 双指捏合（缩小）。
*   **结果**: 
    *   文字大小减小。
    *   缩放比例被限制在最小 0.5x。
*   **状态**: **通过**

### 3. 交互冲突预防
*   **测试**: 尝试通过触摸内容区域（非头部）来拖动弹窗。
*   **结果**: 弹窗**不**移动（拖动仅限于头部）。
*   **测试**: 尝试在拖动头部时进行捏合缩放。
*   **结果**: 捏合逻辑需要双指作用于弹窗；拖动逻辑需要单指作用于头部。逻辑分离有效。
*   **状态**: **通过**

---

# 2025-12-25 v0.9.21 - English Document

## Test Report: Strict Edge Visibility & Optimization

### 1. Default Edge Visibility (SVG)
*   **Test**: Load the graph in SVG Mode.
*   **Result**: 
    *   No edges are visible by default (Opacity: 0).
    *   Graph appears cleaner with only nodes visible.
*   **Status**: **Pass**

### 2. Interaction Visibility (SVG)
*   **Test**: Hover over a node (PC) or click a node (Mobile/PC).
*   **Result**: 
    *   Edges connected to the target node immediately become visible.
    *   Incoming edges are Red, Outgoing are Blue.
*   **Test**: Move mouse away or click background.
*   **Result**: Edges revert to invisible (Opacity: 0).
*   **Status**: **Pass**

### 3. Canvas Consistency
*   **Test**: Switch to Canvas Mode.
*   **Result**: Edges remain hidden by default, matching SVG behavior.
*   **Status**: **Pass**

---

# 2025-12-25 v0.9.21 - Chinese Document

## 测试报告：严格的边可见性与优化

### 1. 默认边可见性 (SVG)
*   **测试**: 在 SVG 模式下加载图表。
*   **结果**: 
    *   默认情况下无边可见 (透明度: 0)。
    *   图表看起来更整洁，仅显示节点。
*   **状态**: **通过**

### 2. 交互可见性 (SVG)
*   **测试**: 悬停在节点上 (PC) 或点击节点 (移动端/PC)。
*   **结果**: 
    *   连接到目标节点的边立即变得可见。
    *   入度边为红色，出度边为蓝色。
*   **测试**: 移开鼠标或点击背景。
*   **结果**: 边恢复为不可见 (透明度: 0)。
*   **状态**: **通过**

### 3. Canvas 一致性
*   **测试**: 切换到 Canvas 模式。
*   **结果**: 边保持默认隐藏，与 SVG 行为匹配。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.18 - English Document

## Test Report: Node Highlighting System Refactor

### 1. NodeHighlightManager Module Loading
*   **Test**: Open browser developer console and check for JavaScript errors during page load.
*   **Result**: No errors. `window.NodeHighlightManager` and `window.createNodeHighlightManager` are defined.
*   **Status**: **Pass**

### 2. PC Hover Interaction (Non-Frozen)
*   **Test**: Hover mouse over a node without clicking.
*   **Result**: 
    *   Node and connected nodes remain at full opacity (1.0).
    *   Unconnected nodes dim to 0.05 opacity.
    *   Outgoing edges turn Blue (#4488ff) with 2.5px width.
    *   Incoming edges turn Red (#ff6b6b) with 2.5px width.
    *   Tooltip appears with node statistics.
*   **Test**: Move mouse away from node.
*   **Result**: Highlighting clears, all nodes and edges return to default visibility.
*   **Status**: **Pass**

### 3. Mobile Click Interaction (Frozen)
*   **Test**: Single click on a node.
*   **Result**: 
    *   Simulation stops (all nodes freeze).
    *   Node highlighting applied (same visual as hover).
    *   Statistics popup appears showing In/Out degree counts and neighbor lists.
*   **Test**: Click background (SVG area).
*   **Result**: 
    *   Highlight clears.
    *   Statistics popup closes.
    *   Simulation resumes (nodes start moving).
*   **Status**: **Pass**

### 4. Double Click Focus Mode Entry
*   **Test**: Double click on a node.
*   **Result**: 
    *   Focus Mode activates.
    *   Node arranges with inbound/outbound neighbors.
    *   Semantic labels appear ("Helping to understand", "Further exploration").
    *   highlightManager properly disables during focus mode.
*   **Status**: **Pass**

### 5. Focus Mode State Awareness
*   **Test**: While in Focus Mode, hover over a neighbor node.
*   **Result**: No hover highlighting occurs (Focus Mode handles its own visualization).
*   **Test**: Exit Focus Mode, then hover over the same node.
*   **Result**: Normal hover highlighting resumes.
*   **Status**: **Pass**

### 6. Canvas Mode Rendering
*   **Test**: Switch to Canvas renderer, hover over a node.
*   **Result**: 
    *   Visual effects match SVG mode (Blue/Red edges, dimmed unconnected nodes).
    *   Performance remains smooth even with highlighting active.
*   **Test**: Click a node in Canvas mode.
*   **Result**: Same freeze behavior as SVG mode.
*   **Status**: **Pass**

### 7. Analysis Panel Integration
*   **Test**: Open Analysis Panel, click a node row in the table.
*   **Result**: 
    *   Graph highlights the node using highlightManager.
    *   Tooltip appears at node position.
    *   No simulation freeze (freeze=false parameter used).
*   **Status**: **Pass**

### 8. Background Click Clearing
*   **Test**: Click a node to freeze highlight, then click SVG background.
*   **Result**: 
    *   Highlight clears completely.
    *   Statistics popup closes.
    *   Simulation resumes.
*   **Status**: **Pass**

### 9. State Management Robustness
*   **Test**: Rapidly click multiple nodes in succession.
*   **Result**: 
    *   Each click properly updates the frozen state.
    *   No stale highlights remain.
    *   Statistics popup updates for each new node.
*   **Status**: **Pass**

### 10. Bilingual Comments Verification
*   **Test**: Review `nodeHighlight.js` source code.
*   **Result**: All functions and logic blocks have Chinese and English comments.
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.18 - Chinese Document

## 测试报告：节点高亮系统重构

### 1. NodeHighlightManager 模块加载
*   **测试**: 打开浏览器开发者控制台，检查页面加载期间是否有 JavaScript 错误。
*   **结果**: 无错误。`window.NodeHighlightManager` 和 `window.createNodeHighlightManager` 已定义。
*   **状态**: **通过**

### 2. PC 悬停交互（非冻结）
*   **测试**: 将鼠标悬停在节点上但不点击。
*   **结果**: 
    *   节点和连接的节点保持完全不透明 (1.0)。
    *   未连接的节点变暗至 0.05 不透明度。
    *   出度边变为蓝色 (#4488ff)，宽度 2.5px。
    *   入度边变为红色 (#ff6b6b)，宽度 2.5px。
    *   显示带有节点统计信息的提示框。
*   **测试**: 将鼠标移开节点。
*   **结果**: 高亮清除，所有节点和边恢复到默认可见性。
*   **状态**: **通过**

### 3. 移动端点击交互（冻结）
*   **测试**: 单击某个节点。
*   **结果**: 
    *   模拟停止（所有节点冻结）。
    *   应用节点高亮（与悬停相同的视觉效果）。
    *   出现统计弹窗，显示入/出度计数和邻居列表。
*   **测试**: 点击背景（SVG 区域）。
*   **结果**: 
    *   高亮清除。
    *   统计弹窗关闭。
    *   模拟恢复（节点开始移动）。
*   **状态**: **通过**

### 4. 双击进入专注模式
*   **测试**: 双击某个节点。
*   **结果**: 
    *   激活专注模式。
    *   节点与入度/出度邻居一起排列。
    *   出现语义标签（"帮助理解"、"进一步探索"）。
    *   highlightManager 在专注模式期间正确禁用。
*   **状态**: **通过**

### 5. 专注模式状态感知
*   **测试**: 在专注模式下，悬停在邻居节点上。
*   **结果**: 不发生悬停高亮（专注模式处理自己的可视化）。
*   **测试**: 退出专注模式，然后悬停在同一节点上。
*   **结果**: 正常的悬停高亮恢复。
*   **状态**: **通过**

### 6. Canvas 模式渲染
*   **测试**: 切换到 Canvas 渲染器，悬停在节点上。
*   **结果**: 
    *   视觉效果与 SVG 模式匹配（蓝/红边，变暗的未连接节点）。
    *   即使在高亮激活时性能仍然流畅。
*   **测试**: 在 Canvas 模式下点击节点。
*   **结果**: 与 SVG 模式相同的冻结行为。
*   **状态**: **通过**

### 7. 分析面板集成
*   **测试**: 打开分析面板，点击表格中的节点行。
*   **结果**: 
    *   图表使用 highlightManager 高亮显示节点。
    *   提示框出现在节点位置。
    *   不冻结模拟（使用了 freeze=false 参数）。
*   **状态**: **通过**

### 8. 背景点击清除
*   **测试**: 点击节点以冻结高亮，然后点击 SVG 背景。
*   **结果**: 
    *   高亮完全清除。
    *   统计弹窗关闭。
    *   模拟恢复。
*   **状态**: **通过**

### 9. 状态管理稳健性
*   **测试**: 快速连续点击多个节点。
*   **结果**: 
    *   每次点击都正确更新冻结状态。
    *   没有残留的陈旧高亮。
    *   统计弹窗为每个新节点更新。
*   **状态**: **通过**

### 10. 双语注释验证
*   **测试**: 查看 `nodeHighlight.js` 源代码。
*   **结果**: 所有函数和逻辑块都有中文和英文注释。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.17 - English Document

## Test Report: SVG Visual Completeness

### 1. Colored Arrow Markers
*   **Test**: In SVG Mode, click on a node with both incoming and outgoing edges.
*   **Result**: 
    *   Incoming edges are Red with **Red arrowheads**.
    *   Outgoing edges are Blue with **Blue arrowheads**.
    *   Previously, arrowheads remained gray.
*   **Test**: Click the background to clear highlight.
*   **Result**: All edges (if visible) revert to Gray lines with **Gray arrowheads**.
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.17 - Chinese Document

## 测试报告：SVG 视觉完整性

### 1. 彩色箭头标记
*   **测试**: 在 SVG 模式下，点击一个同时具有入度和出度边的节点。
*   **结果**: 
    *   入度边为红色，且带有**红色箭头**。
    *   出度边为蓝色，且带有**蓝色箭头**。
    *   （此前箭头保持灰色）。
*   **测试**: 点击背景清除高亮。
*   **结果**: 所有边（如果可见）恢复为灰色线条和**灰色箭头**。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.16 - English Document

## Test Report: Interaction Completeness

### 1. Highlight Logic Override
*   **Test**: Set filter mode to "Incoming Only". Single click a node that has both incoming and outgoing edges.
*   **Result**: The graph highlights **both** incoming (Red) and outgoing (Blue) edges, overriding the filter for the inspected node.
*   **Status**: **Pass**

### 2. Canvas Renderer Styling
*   **Test**: Switch to Canvas Mode. Click a node.
*   **Result**: Highlighted edges are drawn with increased thickness (2.5px), matching the visual weight of the SVG renderer.
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.16 - Chinese Document

## 测试报告：交互完整性

### 1. 高亮逻辑覆盖
*   **测试**: 将过滤器模式设置为 "仅入度" (Incoming Only)。单击一个同时具有入度和出度边的节点。
*   **结果**: 图表高亮显示**所有**入度 (红) 和出度 (蓝) 边，覆盖了被检查节点的过滤器设置。
*   **状态**: **通过**

### 2. Canvas 渲染器样式
*   **测试**: 切换到 Canvas 模式。点击一个节点。
*   **结果**: 高亮边的绘制宽度增加 (2.5px)，与 SVG 渲染器的视觉权重相匹配。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.14 - English Document

## Test Report: Visual & Data Fixes

### 1. Edge Highlighting (SVG & Canvas)
*   **Test**: Single click a node in the graph (SVG Mode).
*   **Result**: 
    *   Incoming edges are colored **Red** (#ff6b6b) and bolded (2px).
    *   Outgoing edges are colored **Blue** (#4488ff) and bolded (2px).
*   **Test**: Switch to Canvas Mode and repeat.
*   **Result**: Visuals are identical to SVG mode.
*   **Status**: **Pass**

### 2. Data Deduplication
*   **Test**: Click a node with multiple connections to the same neighbor (if any exist in data). Check popup lists.
*   **Result**: Neighbor nodes appear only once in the "Incoming" and "Outgoing" lists.
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.14 - Chinese Document

## 测试报告：视觉与数据修复

### 1. 边高亮 (SVG & Canvas)
*   **测试**: 在图表中单击一个节点 (SVG 模式)。
*   **结果**: 
    *   入度边显示为**红色** (#ff6b6b) 并加粗 (2px)。
    *   出度边显示为**蓝色** (#4488ff) 并加粗 (2px)。
*   **测试**: 切换到 Canvas 模式并重复。
*   **结果**: 视觉效果与 SVG 模式一致。
*   **状态**: **通过**

### 2. 数据去重
*   **测试**: 点击一个与同一邻居有多个连接的节点（如果数据中存在）。检查弹窗列表。
*   **结果**: 邻居节点在“入度”和“出度”列表中仅出现一次。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.13 - English Document

## Test Report: Focus Mode Isolation

### 1. Focus Mode Interaction
*   **Test**: Enter Focus Mode (Double Click). Single click another node.
*   **Result**: Floating statistics popup does NOT appear. Layout does NOT freeze (unless globally frozen). Node is NOT highlighted with Red/Blue edges (Focus Mode context preserved).
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.13 - Chinese Document

## 测试报告：专注模式隔离

### 1. 专注模式交互
*   **测试**: 进入专注模式 (双击)。单击另一个节点。
*   **结果**: 浮动统计弹窗**未**出现。布局**未**冻结 (除非全局已冻结)。节点**未**被红/蓝边高亮 (保留了专注模式上下文)。
*   **状态**: **通过**

---

# 2025-12-24 v0.9.11 - English Document

## Test Report: Node Statistics & Localization

### 1. Focus Mode Localization
*   **Test**: Switch language to Chinese ('zh') and enter Focus Mode.
*   **Result**: Semantic labels appear as "帮助理解" and "进一步探索".
*   **Test**: Switch language to English ('en') and enter Focus Mode.
*   **Result**: Semantic labels appear as "Helping to understand" and "Further exploration".
*   **Status**: **Pass**

### 2. Node Statistics Panel
*   **Test**: Single click on a node.
*   **Result**: 
    *   Analysis Panel opens (or switches content) to show "Node Details".
    *   Node Name and Cluster are displayed correctly.
    *   Inbound/Outbound lists are populated.
    *   In-degree edges turn Red.
    *   Out-degree edges turn Blue (#4488ff).
*   **Test**: Click a node in the Inbound/Outbound list.
*   **Result**: The graph highlights the new node, and the panel updates to show details for the new node.
*   **Test**: Click "Back" button in the panel.
*   **Result**: Panel reverts to "Degree Analysis" (Global View).
*   **Status**: **Pass**

---

# 2025-12-24 v0.9.11 - Chinese Document

## 测试报告：节点统计与本地化

### 1. 专注模式本地化
*   **测试**: 切换语言至中文 ('zh') 并进入专注模式。
*   **结果**: 语义标签显示为 "帮助理解" 和 "进一步探索"。
*   **测试**: 切换语言至英文 ('en') 并进入专注模式。
*   **结果**: 语义标签显示为 "Helping to understand" 和 "Further exploration"。
*   **状态**: **通过**

### 2. 节点统计面板
*   **测试**: 单击某个节点。
*   **结果**: 
    *   分析面板打开（或切换内容）以显示“节点详情”。
    *   正确显示节点名称和聚类。
    *   入度/出度列表已填充。
    *   入度边变为红色。
    *   出度边变为蓝色 (#4488ff)。
*   **测试**: 点击入度/出度列表中的节点。
*   **结果**: 图表高亮显示新节点，面板更新为显示新节点的详情。
*   **测试**: 点击面板中的“返回”按钮。
*   **结果**: 面板恢复为“度数分析”（全局视图）。
*   **状态**: **通过**
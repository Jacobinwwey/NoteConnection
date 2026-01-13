# 2026-01-14 v1.0.0

# Interface Document

This document defines the core interfaces for the NoteConnection system, separating backend processing from frontend visualization.

---

## 1. Backend Interfaces

### 1.1 Data Ingestion

#### `IFileLoader` (Updated v0.8.6)

Responsible for reading raw files from the file system asynchronously.

- **Function**: `loadFiles(directory: string, extensions?: string[]): Promise<RawFile[]>`
- **Input**:
  - `directory` (string): Absolute path to the concept directory.
  - `extensions` (string[]): Optional file extensions to filter (default: `['.md']`).
- **Output**:
  - `Promise<RawFile[]>`: Array of loaded file objects.
- **Concurrency**: Implements batch processing to handle large file counts without exhausting file handles.
- **Type Definitions**:
  ```typescript
  interface RawFile {
    filepath: string; // Full path
    filename: string; // Name with extension
    content: string; // File body
    modifiedTime?: Date; // Last modification time (optional)
  }
  ```

### 1.2 Parsing & Extraction

#### `FrontmatterParser` (Updated v0.2.0)

Parses YAML frontmatter to extract structured metadata.

- **Function**: `parse(content: string): ParsedMetadata`
- **Input**:
  - `content` (string): The full content of the Markdown file.
- **Output**:
  - `ParsedMetadata`: Object containing extracted fields.
- **Type Definitions**:
  ```typescript
  interface ParsedMetadata {
    tags: string[]; // Extracted from 'tags' (list or inline)
    prerequisites: string[]; // Extracted from 'prerequisites'
    next: string[]; // Extracted from 'next'
    [key: string]: any;
  }
  ```
- **Supported Formats**:
  - Inline Array: `field: [Item A, Item B]`
  - List:
    ```yaml
    field:
      - Item A
      - [[Item B]]
    ```
  - Single Value: `field: [[Item A]]`

#### `INoteParser`

Parses raw content into structured Concept objects.

- **Function**: `parse(files: RawFile[]): Concept[]`
- **Input**:
  - `files` (RawFile[]): Raw files loaded from disk.
- **Output**:
  - `Concept[]`: Structured data objects.
- **Type Definitions**:
  ```typescript
  interface Concept {
    id: string; // Unique ID (usually filename without ext)
    title: string; // Concept title
    content: string; // Cleaned content
    metadata: {
      tags: string[];
      prerequisites: string[]; // Explicit dependencies
    }; // Extracted or Default Metadata
  }
  ```

### 1.3 Graph Construction (Updated 2025-12-19 v0.1.3)

#### `Graph` Class

Core data structure for managing notes and dependencies.

- **Class**: `Graph`
- **Methods**:
  - `addNode(node: NoteNode): void`
  - `addEdge(source: string, target: string, type?: string): void`
  - `getOutgoingEdges(id: string): NoteEdge[]`
  - `getIncomingEdges(id: string): NoteEdge[]`
  - `toJSON(): GraphData`

#### `GraphBuilder` Service

- **Strategy**: Configurable Keyword Matching.
- **Configuration**:
  - `matchingStrategy`: 'exact-phrase' (Regex `\bterm\b`) or 'fuzzy' (`includes`). Default: 'exact-phrase'.
  - `exclusionList`: Array of strings to ignore.
- **Logic**:

  - Iterates through all file pairs (Source, Target).
  - Checks if `Target.id` is in `exclusionList`.
  - Checks if `Source.content` matches `Target.id` using the selected strategy.
  - If matched: Creates Edge `Target -> Source`.

- **Type Definitions**:

  ```typescript
  interface AppConfig {
    matchingStrategy: "exact-phrase" | "fuzzy";
    clusteringStrategy: "label-propagation" | "folder";
    enableStatisticalInference: boolean; // Toggle statistical analysis
    maxWorkers?: number; // Max concurrent workers (Default: CPU count - 1)
    exclusionList: string[];
    enableGPU: boolean; // Vector Space GPU
    enableGPULayout?: boolean; // Layout GPU
    memorySavingMode: boolean; // v0.9.63: Optimize for low memory (default: true)
    deepDebug: boolean; // v0.9.63: Detailed logging (default: false)
  }

  interface NoteNode {
    id: string; // Unique identifier (usually the note title)
    label: string; // Display label
    inDegree: number; // Number of incoming edges
    outDegree: number; // Number of outgoing edges
    content?: string; // Full text content (v0.1.5)
    rank?: number; // Topological rank or hierarchy level
    clusterId?: string; // ID of the cluster this node belongs to
    metadata?: Record<string, any>; // Additional metadata
  }

  interface NoteEdge {
    source: string; // Source node ID
    target: string; // Target node ID
    type?: string; // Type of relationship (e.g., "dependency")
    weight?: number; // Weight of the edge
  }

  interface GraphData {
    nodes: NoteNode[];
    edges: NoteEdge[];
  }
  ```

### 1.4 Export

#### `IExporter`

Saves the graph for frontend consumption.

- **Function**: `exportToJSON(graph: DirectedGraph, outputPath: string): Promise<void>`
- **Filtered Export (Frontend)**:
  - Export now includes both filtered nodes and the edges connecting them.
  - Structure: `{ nodes: NoteNode[], edges: NoteEdge[] }`.

### 1.5 Utilities (v0.9.51)

#### `PerformanceLogger` Class

Static utility for tracking and logging system performance metrics (CPU, Memory, Time) during graph construction.

- **Location**: `src/backend/utils/PerformanceLogger.ts`
- **Methods**:
  - `logSystemInfo()`: Logs OS, CPU model/cores, and Total Memory.
  - `start(stepName: string)`: Marks the start of a named step, recording time and resource usage.
  - `end(stepName: string)`: Marks the end of a step, calculating and logging the duration, CPU time (User/Sys), and Memory delta.
- **Output Format**:
  ```text
  [Perf] Starting: Step Name
  [Perf] Initial Memory: 50.00 MB / 100.00 MB (Heap/RSS)
  ...
  [Perf] Finished: Step Name
  [Perf] Time: 123.45ms
  [Perf] CPU (User/Sys): 10.00ms / 5.00ms
  [Perf] Memory (Heap/RSS): 55.00 MB / 105.00 MB
  ```

#### `CrashLogger` Class

Static utility for capturing and logging unhandled exceptions, rejections, and critical errors to a persistent file.

- **Location**: `src/backend/utils/CrashLogger.ts`
- **Log File**: `crash.log` (Project Root)
- **Methods**:
  - `initGlobalHandlers()`: Attaches listeners to `uncaughtException` and `unhandledRejection` events.
  - `log(error: any, context: string)`: Writes a formatted error entry with timestamp, system info (OS, Memory), and stack trace.
- **Output Format**:
  ```text
  [ISO-Timestamp] [Context] [PID:12345] Error: Error Message...
  System: win32 10.0.22631 | Mem: 4096.00MB / 16384.00MB
  --------------------------------------------------------------------------------
  ```

---

### 1.6 Algorithms (v0.9.52)

#### `CycleDetector` Class

Service to detect cycles in the graph structure to ensure DAG validity.

- **Location**: `src/backend/algorithms/CycleDetection.ts`
- **Methods**:
  - `detectCycles(graph: Graph, limit?: number): string[][]`
    - **Description**: Detects simple cycles using Iterative DFS (Stack-based) to prevent stack overflow on deep graphs.
    - **Input**:
      - `graph`: The graph to analyze.
      - `limit` (optional): Maximum number of cycles to return. Defaults to 0 (unlimited). **Added in v0.9.52** to prevent OOM on large cyclic graphs.
    - **Output**: Array of cycles (each cycle is an array of node IDs).
  - `hasCycle(graph: Graph): boolean`
    - **Description**: Checks if at least one cycle exists. Optimized to stop early.

#### `TopologicalSort` Class

Assigns hierarchical ranks to nodes.

- **Location**: `src/backend/algorithms/TopologicalSort.ts`
- **Methods**:
  - `assignRanks(graph: Graph): Map<string, number>`

### 1.7 Core API (v0.9.53)

#### `NoteConnection` Class

The main entry point for the core logic, decoupled from CLI/Server environment. Ideal for plugin integration.

- **Location**: `src/core/NoteConnection.ts`
- **Method**: `static async build(options: BuildOptions): Promise<GraphBuildResult>`
- **Input**:
  ```typescript
  interface BuildOptions {
    targetPath?: string; // Relative or absolute path to source
    maxWorkers?: number; // Parallelism limit
    enableGPU?: boolean; // GPU acceleration toggle (Vector)
    enableGPULayout?: boolean; // GPU acceleration toggle (Layout)
    projectRoot?: string; // Override project root (default: ../..)
  }
  ```
- **Output**:
  ```typescript
  interface GraphBuildResult {
    graph: Graph; // The internal Graph object
    data: any; // Serialized JSON data ready for frontend
    stats: {
      nodeCount: number;
      edgeCount: number;
      fileCount: number;
    };
  }
  ```

### 1.8 Graph Metrics (v0.9.60)

#### `GraphMetrics` Class

Static utility for calculating graph topology metrics (Centrality).

- **Location**: `src/backend/GraphMetrics.ts`
- **Methods**:
  - `calculateBetweennessAsync(graph: Graph): Promise<Map<string, number>>`
    - **Description**: Calculates Betweenness Centrality (Brandes Algorithm) in parallel using Worker threads.
    - **Optimization**:
      - Distributes source nodes across available CPU cores.
      - Aggregates partial centrality scores from workers.
      - Falls back to sequential if node count < 500.
  - `calculateBetweenness(graph: Graph): Map<string, number>`
    - **Description**: Sequential fallback implementation.

## 2. Frontend Interfaces

### 2.1 Visualization

#### `GraphRenderer` (JavaScript Module)

Renders the JSON data into an interactive DAG.

- **Input**: `graph.json` (Structure matches `DirectedGraph`)
- **Key Feature**: **Web Worker Offloading (v0.9.72)**
  - **Module**: `src/frontend/simulationWorker.js`
  - **Purpose**: Runs D3 Force Simulation in a background thread to prevent Main Thread blocking (UI freeze) during heavy computation.
  - **Interface**: Message Passing via `postMessage`.
    - `init`: Sends nodes/links and settings (including `gpuRendering`).
    - `tick`: Receives updated positions `({id, x, y})` for rendering.
    - `updateParams`: Updates physics parameters (Gravity, Repulsion) without restart.
    - `updateLayout`: Switches between Force and DAG modes.
    - `setNodes`: Updates the active subset of nodes (e.g., for Focus Mode).
    - `drag`: Syncs manual node movement.
- **Features**:

  - **Layout Modes (v0.4.0)**:
    - **Force Directed**: Standard physics-based layout.
    - **DAG (Hierarchical)**: Sugiyama-style layered layout using `rank` for Y-coordinates and curved Bezier lines for edges.
  - **Zoom/Pan**: D3-zoom behavior.
  - **Tooltip**: Show node details on hover.
  - **Focus Mode (v0.6.2)**:
    - **Function**: `enterFocusMode(node)` / `exitFocusMode()`
    - **UI Behavior (v0.9.46)**: Main controls (Source Select, Settings) are hidden (`display: none`) to provide a focused view.
    - **Canvas Rendering (v0.9.46)**: Edges are suppressed in Canvas Focus Mode for clarity.
    - **Description**: Isolates a node and its direct context.
    - **Layout**:
      - **Focus Node**: Center.
      - **Superiors**: Out-degree neighbors, placed in top layer. Relative height based on Score.
      - **Subordinates**: In-degree neighbors, placed in bottom layer. Relative height based on Score.
    - **Sorting**: Intra-layer nodes sorted by Focus Score (Edge Weight + Degree Ratio).
    - **Labeling**: Staggered (Above/Below) based on vertical offset to prevent overlap.
  - **Settings (v0.7.0)**:
    - **Interface**: `SettingsManager` (Frontend)
    - **Persistence**: `localStorage('nc_settings')`
    - **Configurable**:
      - **Physics**:
        - **Repulsion**: Split into `repulsionForce` (Default: -550) and `repulsionDAG` (Default: -850).
        - **UI Context**: The settings modal dynamically updates the input label to "Repulsion (Force)" or "Repulsion (DAG)" to clearly indicate which mode is being configured.
        - **Others**: Link Distance (Default: 250), Collision Radius (Default: 25).
      - **Performance**:
        - **Max Workers**: Slider/Input to control concurrent worker threads (Default: 4).
        - **Compact Mode (v0.9.67)**: Checkbox to hide edges by default for performance (Default: Off, Auto-On for >5k nodes).
        - **GPU Optimised Rendering (v0.9.72)**: Checkbox to enable GPU-accelerated force simulation (Default: On). Switches between `d3.forceManyBody` (CPU) and `gpuManyBody` (GPU).
      - **Visuals**: Edge Opacity.
  - **Rendering Modes (v0.8.7 & v0.9.45)**:
    - **SVG**: Default D3 implementation for interactivity and styling.
    - **Canvas**: High-performance raster rendering for large datasets.
      - **Interactivity (v0.9.45)**: Supports Hover (Highlight), Click (Stats), and Double Click (Focus) via manual hit-testing (`findNodeAt`).
      - **Visuals**: Matches SVG styling (Size By, Color By, Highlight Colors).
      - **Auto-Switch (v0.9.61)**: Automatically enabled by default if `nodes.length > 3000` to prevent DOM-based memory issues.
      - **Physics Culling (v0.9.63)**: If `edges.length > 20000`, the physics simulation operates on a subset (20k edges) to prevent Main Thread freeze, while rendering still displays all edges on interaction.
  - **Focus Mode Enhancements (v0.8.7, v0.8.8 & v0.9.44)**:
    - **Dynamic Spacing**: User adjustable `layerGap` via UI slider.
    - **Horizontal Spacing**: User adjustable `hSpacing` via UI slider.
    - **Independent Settings (v0.9.44)**: Spacing values are stored separately for "Horizontal" and "Vertical" layouts. Defaults are optimized for each (Horizontal: 125/80, Vertical: 250/20).
  - **Focus Mode Enhancements (v0.8.9)**:
    - **Position Lock**: Nodes in Focus Mode retain their position after dragging (Freeze on Select) to prevent layout drift.
  - **Focus Mode Controls (v0.9.47)**:
    - **Interaction**: Double-clicking a node no longer triggers window zoom behavior (d3-zoom propagation stopped).
    - **Vertical Layout**: Increased horizontal label offset (`dx`) to 35px (from default ~12px) in Vertical mode to prevent text overlap.
      _ **Simulation Controls (v0.9.0, v0.9.25, v0.9.29 & v0.9.37)**:
      _ **Rapid Relaxation (v0.9.37)**: Upon initialization, `velocityDecay` is set to **0.2** for 2 seconds to facilitate rapid layout expansion. It then automatically transitions to **0.95** for stability.
      _ **Freeze Layout**: Checkbox to completely stop the physics simulation. _ **Main Interface**: Stops simulation and **disables node dragging** to minimize memory/CPU usage and prevent accidental layout changes.
      - **Focus Mode**: Does not affect Focus Mode; dragging and manual positioning remain enabled for context exploration.
      - **Robustness (v0.9.29)**: Prevents simulation restart during layout events (e.g., resizing window, opening Analysis Panel), ensuring nodes remain strictly stationary.
      - **Visual Settings Priority (v0.9.36)**: Changing visual parameters (Degree Basis, Size By) updates the node appearance (radius, color) but does **not** restart the simulation if Freeze Layout is enabled.
      - **Modal Settings Priority (v0.9.40)**: Changing physics or visual parameters within the "Visualization Settings" modal (Repulsion, Opacity, etc.) updates the underlying force configuration and visual styles immediately, but does **not** restart the simulation if Freeze Layout is enabled.
      - **Settings Modal Freeze (v0.9.41)**: Opening the Settings Modal automatically forces a temporary simulation freeze (`simulation.stop()`) to conserve resources. The simulation resumes upon closing only if it wasn't globally frozen.
    - **Viewport Culling (v0.9.31 & v0.9.35)**:
      - **Full View Freeze**: Automatically stops simulation when zoomed out excessively (< 0.1x, previously 0.4x) to save resources.
      - **Off-screen Freezing**: When zoomed in, nodes outside the visible viewport are frozen (`fx`/`fy` locked).
      - **Buffer Zone**: Active area extends `800 / scale` pixels beyond the viewport edges to ensure smooth panning and continuity.
    - **Layout State Caching (v0.9.33 & v0.9.74)**:
      - **Persistence**: Caches node positions (`x, y, fx, fy`) independently for each layout mode ('Force', 'DAG').
      - **Instant Switch**: Restores exact positions when switching back to a previously visited layout, bypassing recalculation and movement animation.
      - **Robustness (v0.9.74)**: Implemented null-safe restoration and `applyPhysics` logic to prevent crashes during rapid switching or initialization.
    - **Global Layout Transition (v0.9.34 & v0.9.39)**:
      - **Unfreeze Override**: When switching to a new layout (where no cache exists), the system explicitly clears all culling locks (`isCulled`, `fx`, `fy`) on all nodes.
      - **Rapid Relaxation (v0.9.39)**: The new layout simulation starts with **0.2** damping for 2 seconds (matching initial load) before stabilizing at **0.95**.
      - **Delayed Freeze**: If "Freeze Layout" is checked, the simulation will run for the 2-second relaxation phase to form the layout and then automatically stop.
      - **Goal**: Ensures that off-screen nodes are released and the new structure forms quickly and correctly before stabilizing or freezing.
  - **Mobile Optimizations (v0.9.2)**:
    - **Responsive Layout**: CSS Media Queries (`max-width: 768px`) adapt the UI.
      - **Collapsed Controls**: Main panel becomes a toggleable icon.
      - **Focus Bar**: Relocated to viewport bottom for thumb access.
      - **Settings Integration**: Language selector moved to Settings modal to save screen space.
    - **Touch Gestures**:
      - **Reader**: Implements `touchstart`/`touchmove` for 2-finger pinch-to-zoom (scales `fontSize`).
  - **Interaction Logic (v0.9.3)**:
    - **Highlight/Tooltip**: Triggered by **MouseOver** (Desktop) or **Single Click** (Mobile/Desktop).
    - **Focus Mode**: Triggered by **Double Click**.
  - **Interaction Logic (v0.9.16)**:
    - **Context Reveal**: Highlighting a node (Hover or Click) now explicitly displays **all** incoming and outgoing edges, disregarding the global "Incoming/Outgoing Only" filter, to provide a complete inspection view.
  - **SVG Markers (v0.9.17)**:
    - **Dynamic Arrows**: The system now supports and utilizes colored arrow markers (`#arrow-in` [Red], `#arrow-out` [Blue]) which are dynamically applied to edges during highlight events to ensure visual consistency with the colored lines.
  - **Mermaid Zoom (v0.9.4)**:
    - **Trigger**: Click on any rendered Mermaid diagram in the Reader.
    - **Interface**: Full-screen modal with independent Pan/Zoom (unlimited scaling).
    - **Exit**: dedicated '×' button.
  - **Focus Mode Semantics (v0.9.5)**:
    - **Centering**: Viewport automatically pans to center the focused node without displacing its simulation coordinates.
    - **Semantic Labels**:
      - **Inbound Area**: Labeled "Helping to understand" (Left/Bottom).
      - **Outbound Area**: Labeled "Further exploration" (Right/Top).
    - **Layouts**:
      - **Horizontal**: Standard Top-Bottom flow.
      - **Hierarchical (L-R)**: Left-to-Right flow (Inbound -> Selected -> Outbound).
  - **Analysis Interaction (v0.9.5)**:
    - **Mobile View**: Scrollable full-width panel on small screens.
    - **Graph Sync**: Clicking a row in the analysis table highlights the corresponding node and its edges in the main graph.
  - **Analysis Panel Enhancements (v0.9.6)**:
    - **Full Screen Toggle**: Button to expand panel to 100% height.
    - **Pinch Zoom**: Touch gestures to scale the panel content for better readability.
  - **Analysis Mobile Interactions (v0.9.9)**:
    - **Slide Gesture**: Drag the panel header (or handle) up/down to resize the panel on touch devices.
    - **Auto-Snap**: Dragging near the top automatically snaps to Full Screen mode.
    - **Drag Handle**: Visual indicator for the draggable area on mobile.
  - **Analysis Mobile Interactions (v0.9.9)**:
    - **Slide Gesture**: Drag the panel header (or handle) up/down to resize the panel on touch devices.
    - **Auto-Snap**: Dragging near the top automatically snaps to Full Screen mode.
    - **Drag Handle**: Visual indicator for the draggable area on mobile.
  - **Graph Inspection (v0.9.10)**:
    - **Click-to-Freeze**: Clicking a node pauses the physics simulation (`simulation.stop()`) to allow stable inspection of connections.
    - **Resume**: Clicking the background resumes the simulation (`simulation.restart()`) unless "Freeze Layout" is globally enabled.
  - **Node Statistics Popup (v0.9.12)**:

    - **Type**: Independent Floating Window (`#node-stats-popup`).
    - **Trigger**: Single Click on a node (Disabled in Focus Mode v0.9.13).
    - **Content**: Displays In-degree (Red) and Out-degree (Blue) counts, plus separate scrollable lists of incoming and outgoing neighbors.
    - **Visual Feedback (v0.9.14)**: Connected edges are now explicitly colored (Red/Blue) and bolded (2px) in both SVG and Canvas renderers.
    - **Interaction**: Clicking a neighbor in the list navigates to that node (highlights and updates popup).
    - **Independence**: Separate from the main Degree Analysis panel to allow focused inspection without losing global context.
    - **Draggable (v0.9.19)**: Users can drag the popup by clicking on the header to reposition it anywhere on the screen.
    - **Zoomable (v0.9.19)**: Three zoom control buttons (+/−/⟲) allow users to scale content from 0.5x to 2.0x for better readability.
    - **Resizable (v0.9.19)**: CSS `resize: both` enables manual resize using browser's native resize handle.

  - **Focus Mode Re-entry (v0.9.19)**:

    - **Behavior**: Double-clicking a related node while already in focus mode now properly refreshes the view to show the new node's context.
    - **Fix**: Removes restriction that prevented switching focus between related nodes, enabling seamless exploration of connected concepts.
    - **State Reset**: All node visibility flags are reset before entering new focus mode to prevent accumulation issues.

  - **Selection State Auto-Clear (v0.9.20)**:

    - **Behavior**: When double-clicking a node to enter Focus Mode, any existing selection/highlight state is automatically cleared before entering the focused view.
    - **Implementation**:
      - Calls `highlightManager.unhighlight({ force: true })` to clear highlight state.
      - Hides the statistics popup if visible (`#node-stats-popup`).
    - **User Experience**: Provides a clean transition into Focus Mode without residual visual artifacts from previous selections, ensuring the focused view is always clear and uncluttered.

  - **Strict Edge Visibility (v0.9.21)**:

    - **Behavior**: Edges are now strictly hidden (Opacity 0) by default in both SVG and Canvas modes to reduce visual clutter and improve rendering performance.
    - **Interaction**: Edges become visible only when a connected node is highlighted (Hover/Click) or focused.
    - **Optimization**: Ensures consistent "clean slate" initial view for large graphs (10k+ nodes).

  - **Mobile Statistics Popup (v0.9.22)**:

    - **Touch Drag**: Mobile users can hold and drag the popup header (`touchstart`/`touchmove`) to reposition it.
    - **Pinch-to-Zoom**: Two-finger pinch gesture on the popup body scales the content size (`fontSize`) from 0.5x to 2.0x.
    - **Event Handling**: Uses `passive: false` to prevent default page scrolling while interacting with the popup.

  - **Focus Mode Restoration (v0.9.24)**:

    - **Restoration**: Upon exiting Focus Mode, all background nodes are restored to the simulation in their original positions.
    - **Conditional Restart (v0.9.27)**:
      - **Logic**: If "Freeze Layout" is enabled when exiting Focus Mode, the simulation remains stopped (`simulation.stop()`) to maintain the visual state.
      - **Behavior**: Prevents the graph from "exploding" or moving if the user expects it to stay frozen.
      - **Restoration**: Reverts nodes to these exact coordinates upon exit, discarding any layout changes made within Focus Mode.
      - **Goal**: Ensures main interface layout remains absolutely consistent before and after Focus Mode sessions.
    - **Strict Isolation (v0.9.75)**:

      - **Static Layout**: Focus Mode now strictly enforces a static layout using `fx`/`fy` locks and explicitly stops the physics simulation (`restart: false`), complying with "cease simulating" requirements.
      - **Dimension Independence**: Node sizes and typography in the main interface are protected. Upon exiting Focus Mode, dimensions (radius and font-size) are explicitly restored from pre-focus backups before calling the central `updateSize()` logic, ensuring absolute visual consistency with custom configurations (e.g., Size by Centrality).
      - **Event Protection**: `ResizeObserver` is now aware of Focus Mode and ignores window resize events that would otherwise trigger a simulation restart.

    - **Correct Restoration Order (v0.9.76)**:

      - **Fix**: Resolved a race condition where the worker was re-initialized with Focus Mode positions effectively overwriting the backup. Now, positions are restored locally _before_ syncing with the worker.

    - **Query History (v0.9.77)**:

      - **UI**: Added a "History ▼" dropdown in the Focus Mode toolbar.
      - **Functionality**: Tracks the last 10 visited central nodes. Clicking an item effectively "backtracks" or jumps to that node's Focus View.

    - **Analysis Layout Stability (v0.9.77)**:
      - **Auto-Freeze**: Opening the "Degree Analysis" panel automatically engages "Freeze Layout" to strictly maintain node positions during analysis.
      - **Scrolling**: Enhanced valid CSS flexbox structures to guarantee the "Filtered Nodes" table scrolls vertically without overflowing the panel.

  - **Focus Mode Specific Content (v0.9.28)**:

    - **UI**: "Specific Content" button added to the Focus Mode control panel.
    - **Function**: Opens the reading window for the currently focused node (`window.reader.open(focusNode)`).
    - **UX**: Provides a clear, discoverable alternative to double-clicking for accessing node content.

  - **Quick Actions (v0.9.26)**:

    - **Freeze Layout Button**:
      - **UI**: Dedicated button (❄️) in the top-right toolbar.
      - **Function**: Toggles the global "Freeze Layout" state. Synced with the main control panel checkbox.
      - **Visual**: Button turns Red (.active) when layout is frozen.
    - **Quick Start Manual**:
      - **UI**: Modal window showing a 4-step guide.
      - **Trigger**: Auto-shows on first load (if not dismissed forever) or via the Help (❓) button.
      - **Persistence**: "Don't show again" checkbox writes `nc_manual_seen = true` to localStorage.

  - **Freeze Layout Quick Button (v0.9.26)**:

    - **UI**: Dedicated button (❄️) in the top-right toolbar for quick access.
    - **Function**: Toggles the global "Freeze Layout" state (synced with the checkbox in controls).
    - **Visual Feedback**: Button turns Red when active (Frozen).

  - **Quick Start Manual (v0.9.26)**:

    - **UI**: Modal window displaying a 4-step guide.
    - **Trigger**: Automatically on first visit (localStorage check) or via the "Help" (❓) button.
    - **Persistence**: "Don't show again" checkbox sets a flag in localStorage to suppress auto-opening.

  - **Scalability Defaults (v0.8.8)**:
    - **Orphans**: Hidden by default.
    - **Edges**: Hidden by default (opacity 0), visible on Hover/Select.
    - **Node Size**: Defaults to 'Degree'.
  - **Degree Analysis (v0.1.2)**:
    - **In-degree**: Show incoming degree count.
  - **Localization (v0.9.38)**:
    - **Support**: English ('en') and Chinese ('zh').
    - **Rendering**: Supports HTML tags (e.g., `<br>`, `<strong>`) within translation strings via `.innerHTML` injection.

### 3. Inference Engines (v0.6.5)

#### `StatisticalAnalyzer`

Infers dependencies based on co-occurrence and probability asymmetry.

- **Function**: `analyze(files: RawFile[], terms: string[]): Matrix`
- **Logic**: Calculates $P(A|B)$ and $P(B|A)$.
- **Metric**: Asymmetry = $P(Parent|Child) - P(Child|Parent)$.

#### `VectorSpace`

Calculates semantic similarity using TF-IDF and Cosine Similarity.

- **Tokenizer**: Bilingual (English words + Chinese characters).
- **Function**: `getSimilar(fileId, topK)`
- **Output**: List of similar files with score.

#### `HybridEngine`

Combines statistical and vector methods to infer directed edges.

- **Rule**: Suggest Edge $A \rightarrow B$ if:
  1.  $Similarity(A, B) > VectorThreshold$ (Content Relevance)
  2.  $P(A|B) - P(B|A) > AsymmetryThreshold$ (Directionality: B implies A context)
- **Performance Monitoring (v0.9.56)**:
  - Logs execution progress every 1000 nodes.
  - Tracks Heap usage during inference loop.

### 3.4 Parallel Processing (v0.9.57)

#### `GraphBuilder.runParallelMatching` & `StatisticalAnalyzer.runParallelTermExtraction`

Utilizes Node.js `worker_threads` to parallelize computationally expensive tasks (Keyword Matching, Term Extraction).

- **Optimization (v0.9.57)**:

  - **Strategy**: Instead of passing the full `RawFile[]` (containing file content) to workers, the system now passes `filePaths: string[]`.
  - **Implementation**: Workers use `fs` to read file content on demand from the disk.
  - **Benefit**: Drastically reduces memory consumption by avoiding the structural cloning of massive file content strings when spawning workers, resolving Heap OOM issues on large datasets (10k+ files).

- **Worker Interface**:
  ```typescript
  interface WorkerData {
    filePaths: string[]; // Updated from filesChunk: RawFile[]
    targetIds: string[]; // or terms: string[]
    strategy: "exact-phrase" | "fuzzy";
    exclusionList: string[];
  }
  ```
- **Logic**:
  - Detects available CPU cores.
  - Spawns workers (Configurable via `maxWorkers`).
  - Splits the file list into chunks of _paths_.
  - Workers perform processing and return lightweight results.
  - Results are aggregated in the main thread.
- **Fallback**: Automatically degrades to sequential processing if worker spawning fails.

### 3.5 Resource Optimization (v0.9.58)

#### `GraphBuilder` Shared State

Implements resource reuse to prevent OOM errors during Hybrid Inference.

- **Mechanism**: Pre-calculates and reuses `sharedStatsMatrix` and `sharedVectorSpace` across `StatisticalInference` (Step 2c) and `HybridInference` (Step 2e).
- **Cleanup**: Explicitly clears these resources (`matrix.clear()`, `vectorSpace.destroy()`) after the inference pipeline concludes.

#### `CooccurrenceMetrics` Interface

Exported from `StatisticalAnalyzer` for type safety in shared state.

```typescript
interface CooccurrenceMetrics {
  count: number;
  jaccard: number; // |A ∩ B| / |A ∪ B|
  conditionalProb: number; // P(B|A)
}
```

## 4. Server API (v0.8.5)

### 4.1 Endpoints

#### `GET /api/folders`

Lists available knowledge base directories.

- **Response**: `{ "folders": ["testconcept", "folder2"] }`

#### `GET /api/content`

Retrieves the raw content of a specific file on demand.

- **Query Param**: `path` (URL-encoded absolute path, must be within Knowledge Base).
- **Response**: `{ "content": "Markdown text..." }` or `{ "error": "..." }`
- **Security**: Validates that `path` is within the project root or Knowledge Base directory.

#### `POST /api/build`

Triggers a graph build for the specified target.

- **Body**: `{ "target": "testconcept", "maxWorkers": 12 }` or `{ "target": "" }` (for all).
- **Response**: `{ "success": true }` or `{ "success": false, "error": "..." }`

### 5. Mobile Build (v0.9.1)

#### `Capacitor Pipeline`

Transforms the web project into a standalone Android APK.

- **Component**: Capacitor Build System / Gradle.
- **Input**:
  - `dist/frontend`: Static web assets (HTML, CSS, JS).
  - `src/frontend/data.js`: Pre-generated graph data (Lite version, no content).
- **Output**: `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Process**:
  1.  **Data Generation**: `ts-node src/index.ts [target]` -> Generates `data.js` (Lite) and `graph_data.json` (Full).
  2.  **Asset Compilation**: `npm run build` -> Populates `dist/frontend`.
  3.  **Sync**: `npx cap sync android` -> Copies `dist/frontend` to `android/app/src/main/assets/public`.
  4.  **Native Build**: `gradlew assembleDebug` -> Compiles the APK.

### 6. Architecture: Content-on-Demand (v0.9.68)

To support massive graphs (10k+ nodes), the system now decouples graph structure from node content.

- **`data.js`**: Contains only metadata (ID, Label, Stats, Cluster) and Edges. Size reduced by ~95%.
- **`graph_data.json`**: Contains full data including content (for debugging/export).
- **`Reader`**: Fetches content asynchronously via `/api/content` when a node is opened.

### 8. GPU Acceleration (v0.9.50)

#### `VectorSpaceGPU` Class

GPU-accelerated implementation of the Vector Space Model, utilizing the AMD 7900XT (or compatible GPUs) for matrix operations.

- **Location**: `amdgpu/VectorSpaceGPU.ts`
- **Extends**: `VectorSpace`
- **Key Features**:
  - **Matrix Multiplication**: Offloads the $N \times N$ cosine similarity calculation to the GPU using WebGL (headless-gl).
  - **Performance**: Reduces complexity from $O(N^2 \times D)$ on CPU to massively parallel execution.
  - **Fallback**: Automatically falls back to CPU if GPU initialization fails.
- **Methods**:
  - `constructor(files: RawFile[])`: Builds vectors (CPU) and precomputes similarity matrix (GPU).
  - `getSimilar(fileId: string, topK: number)`: Retrieval is $O(1)$ (row lookup) + sorting, reading from the precomputed matrix.
  - `destroy()`: Releases GPU resources (WebGL context).

#### `Layout Forces (v0.9.74)`

GPU-accelerated physics engine for frontend layout, implementing D3-compatible forces.

- **Location**: `src/frontend/layout_gpu.js`
- **Architecture**:
  - **Shared Context**: Uses a singleton `SharedGPU` to manage a single WebGL context for all forces, preventing browser context limits (16 max contexts per browser).
- **Classes**:
  - **`GPUManyBodyForce`**: N-body repulsion. Replaces `d3.forceManyBody`.
  - **`GPULinkForce`**: Spring force. Replaces `d3.forceLink`.
    - **Algorithm**: "Gather" kernel where each node calculates forces from all connected neighbors by iterating through a flattened adjacency list.
    - **Property Naming**: Internal data uses `this._links` to avoid shadowing the `links()` shim method.
    - **Robustness & Safety**:
      - **Velocity Clamping**: Caps `vx`/`vy` at `100` to prevent "explosive" movements where nodes disappear from the viewport.
      - **NaN Mitigation**: Kernel uses safe division (distance offset `+0.0001`) and `isFinite()` checks before applying results to node objects.
      - **Type Safety**: Explicit `Number()` casting for kernel parameters (`alpha`, `strength`, `distance`).
- **Integration (`app.js`)**:
  - **Dynamic Switching**: `applyPhysics` toggles between `d3.forceManyBody`/`d3.forceLink` and `window.gpuManyBody`/`window.gpuLink` based on hardware settings.
  - **Focus Mode Support**: `enterFocusMode` and `exitFocusMode` detect the active Force type (CPU or GPU) to update link references correctly.
  - **Layout Caching**: Safe restoration of cached coordinates (`layoutCache`) with null-checks to prevent crashes during rapid switching.
  - **Atomic Layout Switching (v0.9.74)**:
    - **Problem**: Previously, switching layouts (DAG -> Force) caused a race condition where the worker auto-restarted the simulation before the frontend could restore cached positions, leading to "leaking" positions.
    - **Solution**:
      - `updateLayout` in `simulationWorker.js` now accepts a `restart` flag.
      - The frontend passes `restart: false` when a valid cache exists.
      - Restored positions are synchronized via `setNodes` while the simulation remains stopped.
    - **Result**: Switching back to a visited layout is now instantaneous and purely static, with zero node movement.

#### Drag and Zoom Functionality

Enhances the node statistics popup with user-friendly positioning and scaling controls.

- **Drag Interface**:

  - **Trigger**: `mousedown` on `#popup-drag-handle` (header element).
  - **Behavior**:
    - Tracks mouse movement and updates popup `left` and `top` CSS properties.
    - Prevents dragging when clicking on buttons within the header.
    - Adds `.dragging` class for visual feedback.
  - **State**:
    ```typescript
    interface PopupDragState {
      isDragging: boolean;
      startX: number; // Initial mouse X
      startY: number; // Initial mouse Y
      startLeft: number; // Initial popup left position
      startTop: number; // Initial popup top position
      currentScale: number; // Current zoom scale (0.5-2.0)
    }
    ```

  ```

  ```

- **Zoom Interface**:

  - **Controls**:
    - `#popup-zoom-in`: Increases scale by 0.1 (max 2.0).
    - `#popup-zoom-out`: Decreases scale by 0.1 (min 0.5).
    - `#popup-reset-size`: Resets scale to 1.0 and dimensions to default (280px width, auto height).
  - **Application**: Scales `.popup-content` using `fontSize` CSS property.
  - **Formula**: `fontSize = ${scale}rem`

- **Reset Behavior**:

  - On popup close (`#popup-close-btn`), position is reset to default:
    - `left: auto`
    - `right: 20px`
    - `top: 80px`

- **CSS Properties**:
  - **Draggable**: `cursor: move` on header, `cursor: grabbing` when active.
  - **Resizable**: `resize: both` enables browser-native resize handle.
  - **Constraints**: `min-width: 200px`, `min-height: 250px`, `max-width: 90vw`, `max-height: 90vh`.

### 7. Node Highlighting System (v0.9.18)

#### `NodeHighlightManager` Class

Manages node highlighting interactions for both PC and mobile interfaces.

- **Module**: `nodeHighlight.js`
- **Constructor**: `new NodeHighlightManager(config: HighlightConfig)`
- **Configuration**:

  ```typescript
  interface HighlightConfig {
    nodes: NoteNode[]; // Array of all graph nodes
    links: NoteEdge[]; // Array of all graph edges
    nodeSelection: D3Selection; // D3 selection of node elements
    linkSelection: D3Selection; // D3 selection of link elements
    tooltip: D3Selection; // Tooltip element
    simulation: D3Simulation; // Force simulation instance
    onTick: () => void; // Callback to trigger re-render
    onHighlight?: (node, connections) => void; // Optional callback
    onUnhighlight?: (node) => void; // Optional callback
  }
  ```

- **Public Methods**:

  - `highlight(node: NoteNode, options: HighlightOptions): void`

    - **Description**: Highlights a node and its connections.
    - **Input**:
      - `node`: The node to highlight.
      - `options`: Optional configuration.
        ```typescript
        interface HighlightOptions {
          event?: Event; // Mouse/touch event for tooltip positioning
          freeze?: boolean; // Whether to freeze simulation
          mode?: "all" | "in" | "out"; // Filter mode
        }
        ```
    - **Visual Effects**:
      - Main node: Full opacity (1.0)
      - Connected nodes: Full opacity (1.0)
      - Unconnected nodes: Dimmed (0.05 opacity)
      - Outgoing edges: Blue (#4488ff), 2.5px width
      - Incoming edges: Red (#ff6b6b), 2.5px width

  - `unhighlight(options: UnhighlightOptions): void`

    - **Description**: Removes highlighting from current node.
    - **Input**:
      ```typescript
      interface UnhighlightOptions {
        force?: boolean; // Force unhighlight even if frozen
      }
      ```

  - `setFocusMode(focusState: FocusState): void`

    - **Description**: Updates focus mode reference.
    - **Input**:
      ```typescript
      interface FocusState {
        active: boolean;
        node?: NoteNode;
      }
      ```

  - `getState(): HighlightState`

    - **Description**: Returns current highlight state.
    - **Output**:
      ```typescript
      interface HighlightState {
        currentNode: NoteNode | null;
        isFrozen: boolean;
        frozenNode: NoteNode | null;
      }
      ```

  - `isHighlighted(nodeId: string): boolean`

    - **Description**: Checks if a node is currently highlighted.

  - `getCurrentConnections(): ConnectionData | null`
    - **Description**: Gets connections for the currently highlighted node.
    - **Output**:
      ```typescript
      interface ConnectionData {
        links: NoteEdge[];
        nodeIds: Set<string>;
        incomingLinks: NoteEdge[];
        outgoingLinks: NoteEdge[];
      }
      ```

- **Integration Pattern**:

  1.  Initialize after graph elements are created.
  2.  Attach event handlers (hover, click).
  3.  Update focus mode state when entering/exiting focus mode.
  4.  Use in canvas renderer for visual consistency.

- **Mobile Optimization**:

  - **Single Click**: Highlights node and freezes simulation for stable inspection.
  - **Double Click**: Enters focus mode.
  - **Hover (PC)**: Highlights without freezing.
  - **Background Click**: Clears highlight and resumes simulation.

- **Interaction States**:
  - **Normal**: No highlighting.
  - **Hover (PC)**: Temporary highlight, removable by mouseout.
  - **Frozen (Mobile/PC)**: Persistent highlight after click, requires background click or force clear.
  - **Focus Mode**: Highlighting disabled, focus mode handles visualization.

## 9. CLI Interfaces (v0.9.71)

### Build Command

**Input:**

- `--path`: String. Path to knowledge base.
- `--gpu`: Boolean (Flag). Enable GPU.
- `--static`: Boolean (Flag). Enable Static Mode.

**Output:**

- `src/frontend/data_cli_{kb}_{time}.js`: Lite data for frontend (CLI run specific).
- `src/frontend/graph_data_cli_{kb}_{time}.json`: Full data (CLI run specific).

## 10. Frontend Settings Interfaces (v0.9.71)

### Performance Settings

- **GPU Optimised Rendering**:
  - Type: Checkbox
  - Default: `true` (Hardware supported)
  - Effect: Enables `gpu.js` acceleration for backend layout updates and vector similarity.
- **Static Mode**:
  - Type: Checkbox
  - Logic: Auto-enabled if Nodes > 5000.
  - Effect: Stops simulation completely after 2 seconds of relaxation.
- **Extreme Scale**:
  - Logic: Implicit constraint.
  - Condition: Nodes > 10,000 or Edges > 1,000,000.
  - Effect: Edges are never rendered.

## 11. Task Synchronization & Robustness (v0.9.82)

### 11.1 Worker Handshake Protocol

Resolves display race conditions caused by asynchronous Web Worker messages during layout switching.

- **State Flag**: `isLayoutSwitching` (Boolean). Set to `true` at the start of `updateLayout`, and `false` after receiving a `layoutSwitchDone` response.
- **Message Exchange**:
  1.  **Main -> Worker**: Sends `setNodes` to sync latest coordinates, followed by `{ type: 'layoutSwitchDone' }`.
  2.  **Worker -> Main**: Upon receiving `layoutSwitchDone`, the worker echoes the message back immediately.
- **Filtering Logic**: While `isLayoutSwitching === true`, the main thread ignores all `tick` messages from the worker.
- **Benefit**: Ensures that only frames processed after the worker has synchronized with the new layout are rendered, preventing "layout bounce" or teleportation to stale coordinates.

### 11.2 Focus Mode Dragging Isolation

Optimizes manual interaction in Focus Mode by decoupling it from background physics simulation.

- **Interaction Logic**:
  - **Manual Drive**: Nodes in Focus Mode are updated directly by the main thread (`x, y` and `fx, fy`).
  - **Simulation Bypass**: Drag events no longer trigger Worker `drag` messages, preventing delayed `tick` messages from overwriting precise manual positioning.
  - **State Persistence**: After dragging ends, nodes remain `fx, fy` locked until exiting Focus Mode.

### 11.3 Layout Cache Validation

Enhances the security of layout restoration.

- **Threshold**: 50%.
- **Logic**: `restoreLayoutState` calculates the percentage of nodes successfully restored. If less than 50% (e.g., due to significant graph data changes), the cache is deemed invalid, and a simulation relaxation is forced (`restart: true`).
- **Fallback**: Ensures users always see a stable layout after data updates, rather than a broken cached state.

---

### 12. GPU Worker Integration (v0.9.83)

#### `simulationWorker.js` & `layout_gpu.js`

Fully offloads force calculations to the GPU within the Web Worker context.

- **Initialization**:
  - Automatically imports `gpu-browser.min.js` and `layout_gpu.js` via `importScripts`.
  - Determines the layout engine (GPU vs CPU) based on the `gpuRendering` settings flag and `gpuManyBody` availability.
- **Dynamic Parameter Updates**:
  - `updateParams` message now modifies existing force instances (including GPU forces) using `.strength()`, ensuring settings changes do not fallback to CPU physics accidentally.
- **Environment Compatibility**:
  - `layout_gpu.js` utilizes `globalScope` (resolving to `self` in workers) to allow instance-sharing across both main thread and worker thread environments.

---

## 13. Focus Mode Performance (v1.0.0)

### 13.1 Adjacency Cache

To ensure O(1) performance when identifying neighbors in Focus Mode:

- **`window._adjacencyCache`**: A transient Map storing `outgoing` and `incoming` connections for all nodes.
- **`window._adjacencyCacheStale`**: A boolean flag set to `true` when graph data changes, triggering a cache rebuild upon entering Focus Mode.

### 13.2 Batched Rendering

UI updates in Focus Mode are batched using `requestAnimationFrame`:

- **Implementation**: The final `updateVisibility()` and `ticked()` calls are wrapped in an animation frame to prevent layout thrashing and ensure visual consistency.

### 13.3 Random Focus

- **Feature**: A dice icon next to the search bar allows for a random node to be selected and immediately entered into Focus Mode.
- **Implementation**: The `handleRandomFocus` function selects a random visible node index and calls `enterFocusMode`.

### 13.4 Visual State Restoration

- **Logic**: Upon exiting Focus Mode, the system explicitly restores the backed-up `_origRadius` and `_origFontSize` to the respective D3 elements _before_ calling `updateSize()`.
- **Purpose**: Ensures that nodes return to their exact pre-focus dimensions immediately, eliminating any visual discrepancies in radius or typography.

---

## 14. GPU Diagnostics (v1.0.0)

The `SharedGPU` instance provides enhanced logging:

- **`Instance mode`**: Reports whether the system is using `gpu` or `cpu` fallback.
- **`Hardware Info`**: Reports GPU `Vendor` (e.g., AMD, NVIDIA) and `Renderer` when available via the WebGL context.

## 15. Deployment & Build System (v1.0.0)

### 15.1 Build Modes

NoteConnection supports dual build configurations to optimize installer size.

- **FULL Mode** (Default):

  - **Command**: `npm run build` / `npm run electron:build`
  - **Inclusions**: Bundles `data.js` (~170MB) and `graph_data.json` (~470MB) for instant demo capability.
  - **Use Case**: Demos, Pre-packaged knowledge bases.

- **MINI Mode**:
  - **Command**: `npm run build:mini` / `npm run electron:build:mini`
  - **Exclusions**: `copy-assets.js` filters out large runtime-generated data files unless they are required.
  - **Logic**: Checks for `process.argv.includes('--mini')`.
  - **Size Savings**: ~70MB reduction in compressed installer.

## 16. User-Defined KB Configuration (v1.0.0)

### 16.1 Persistent Storage

- **File**: `kb_config.json`
- **Location**: `app.getPath('userData')` (e.g., `%APPDATA%/NoteConnection/`)
- **Structure**:
  ```json
  {
    "knowledgeBasePath": "E:\\path\\to\\custom\\folder"
  }
  ```

### 16.2 IPC API

- **Channel**: `getKbPath`
- **Direction**: Renderer -> Main
- **Response**: `Promise<string>` (The absolute path to the currently active Knowledge Base root).
- **Usage**: Used by Frontend to display current path in UI or request relative content.

### 16.3 Menu Integration

- **File Menu**:
  - **Change Knowledge Base...**: Triggers `dialog.showOpenDialog` -> Updates config -> Reloads.
  - **Reset to Default**: Reverts to bundled `./Knowledge_Base` -> Updates config -> Reloads.

## 17. Physics Algorithm Defaults (v1.0.0)

To provide a clearer initial layout, v1.0.0 adjusts the default values and adjustable ranges for physics parameters:

- **Link Distance**: Default increased to **250** (from 100). Max range expanded to **600**.
- **Collision Radius**: Default increased to **25** (from 20). Max range expanded to **100**.

---

# 接口文档

本文档定义了 NoteConnection 系统核心接口，分离了后端处理与前端可视化。

---

## 1. 后端接口 (Backend Interfaces)

### 1.1 数据摄取 (Data Ingestion)

#### `IFileLoader` (更新于 v0.8.6)

负责从文件系统异步读取原始文件。

- **函数**: `loadFiles(directory: string, extensions?: string[]): Promise<RawFile[]>`
- **输入**:
  - `directory` (string): 概念目录的绝对路径。
  - `extensions` (string[]): 可选的文件扩展名过滤 (默认: `['.md']`)。
- **输出**:
  - `Promise<RawFile[]>`: 加载的文件对象数组。
- **并发性**: 实现批量处理以在不耗尽文件句柄的情况下处理大量文件。
- **类型定义**:
  ```typescript
  interface RawFile {
    filepath: string; // 完整路径
    filename: string; // 带后缀的文件名
    content: string; // 文件内容
    modifiedTime?: Date; // 最后修改时间 (可选)
  }
  ```

### 1.2 解析与提取 (Parsing & Extraction)

#### `FrontmatterParser` (更新于 v0.2.0)

解析 YAML Frontmatter 以提取结构化元数据。

- **函数**: `parse(content: string): ParsedMetadata`
- **输入**:
  - `content` (string): Markdown 文件的完整内容。
- **输出**:
  - `ParsedMetadata`: 包含提取字段的对象。
- **类型定义**:
  ```typescript
  interface ParsedMetadata {
    tags: string[]; // 从 'tags' 提取 (列表或内联)
    prerequisites: string[]; // 从 'prerequisites' 提取
    next: string[]; // 从 'next' 提取
    [key: string]: any;
  }
  ```
- **支持格式**:
  - 内联数组: `field: [Item A, Item B]`
  - 列表:
    ```yaml
    field:
      - Item A
      - [[Item B]]
    ```
  - 单个值: `field: [[Item A]]`

#### `INoteParser`

将原始内容解析为结构化的 Concept 对象。

- **函数**: `parse(files: RawFile[]): Concept[]`
- **输入**:
  - `files` (RawFile[]): 从磁盘加载的原始文件。
- **输出**:
  - `Concept[]`: 结构化数据对象。
- **类型定义**:
  ```typescript
  interface Concept {
    id: string; // 唯一ID (通常是不带后缀的文件名)
    title: string; // 概念标题
    content: string; // 清洗后的内容
    metadata: {
      tags: string[];
      prerequisites: string[]; // 显式依赖
    }; // 提取或默认元数据
  }
  ```

### 1.3 图构建 (Graph Construction) (更新于 2025-12-19 v0.1.3)

#### `Graph` 类

用于管理笔记和依赖关系的核心数据结构。

- **类**: `Graph`
- **方法**:
  - `addNode(node: NoteNode): void`
  - `addEdge(source: string, target: string, type?: string): void`
  - `getOutgoingEdges(id: string): NoteEdge[]`
  - `getIncomingEdges(id: string): NoteEdge[]`
  - `toJSON(): GraphData`

#### `GraphBuilder` 服务

- **策略**: 可配置的关键词匹配。
- **配置**:
  - `matchingStrategy`: 'exact-phrase' (正则 `\bterm\b`) 或 'fuzzy' (`includes`)。默认: 'exact-phrase'。
  - `exclusionList`: 要忽略的字符串数组。
- **逻辑**:

  - 遍历所有文件对 (Source, Target)。
  - 检查 `Target.id` 是否在 `exclusionList` 中。
  - 使用选定的策略检查 `Source.content` 是否匹配 `Target.id`。
  - 如果匹配: 创建边 `Target -> Source`。

- **类型定义**:

  ```typescript
  interface AppConfig {
    matchingStrategy: "exact-phrase" | "fuzzy";
    clusteringStrategy: "label-propagation" | "folder";
    enableStatisticalInference: boolean; // 切换统计分析
    maxWorkers?: number; // 最大并发 Worker 数 (默认: CPU 核心数 - 1)
    exclusionList: string[];
    memorySavingMode: boolean; // v0.9.63: 针对低内存进行优化 (默认: true)
    deepDebug: boolean; // v0.9.63: 详细日志 (默认: false)
  }

  interface NoteNode {
    id: string; // 唯一标识符（通常是笔记标题）
    label: string; // 显示标签
    inDegree: number; // 入度数量
    outDegree: number; // 出度数量
    content?: string; // 全文内容 (v0.1.5)
    rank?: number; // 拓扑排名或层级
    clusterId?: string; // 该节点所属的聚类 ID
    metadata?: Record<string, any>; // 额外元数据
  }

  interface NoteEdge {
    source: string; // 源节点 ID
    target: string; // 目标节点 ID
    type?: string; // 关系类型（例如“依赖”）
    weight?: number; // 边的权重
  }

  interface GraphData {
    nodes: NoteNode[];
    edges: NoteEdge[];
  }
  ```

### 1.4 导出 (Export)

#### `IExporter`

保存图数据以供前端使用。

- **函数**: `exportToJSON(graph: DirectedGraph, outputPath: string): Promise<void>`
- **过滤导出 (前端)**:
  - 导出现在的 JSON 包含过滤后的节点以及连接它们的边。
  - 结构: `{ nodes: NoteNode[], edges: NoteEdge[] }`。

### 1.5 工具类 (v0.9.51)

#### `PerformanceLogger` 类

用于跟踪和记录图构建过程中的系统性能指标（CPU、内存、时间）的静态工具类。

- **位置**: `src/backend/utils/PerformanceLogger.ts`
- **方法**:
  - `logSystemInfo()`: 记录操作系统、CPU 型号/核心数和总内存。
  - `start(stepName: string)`: 标记步骤的开始，记录时间和资源使用情况。
  - `end(stepName: string)`: 标记步骤的结束，计算并记录持续时间、CPU 时间（用户/系统）和内存变化。
- **输出格式**:
  ```text
  [Perf] Starting: Step Name
  [Perf] Initial Memory: 50.00 MB / 100.00 MB (Heap/RSS)
  ...
  [Perf] Finished: Step Name
  [Perf] Time: 123.45ms
  [Perf] CPU (User/Sys): 10.00ms / 5.00ms
  [Perf] Memory (Heap/RSS): 55.00 MB / 105.00 MB
  ```

#### `CrashLogger` 类

用于将未处理的异常、拒绝和关键错误捕获并记录到持久化文件的静态工具类。

- **位置**: `src/backend/utils/CrashLogger.ts`
- **日志文件**: `crash.log` (项目根目录)
- **方法**:
  - `initGlobalHandlers()`: 将监听器附加到 `uncaughtException` 和 `unhandledRejection` 事件。
  - `log(error: any, context: string)`: 写入带时间戳、系统信息（操作系统、内存）和堆栈跟踪的格式化错误条目。
- **输出格式**:
  ```text
  [ISO-Timestamp] [Context] [PID:12345] Error: Error Message...
  System: win32 10.0.22631 | Mem: 4096.00MB / 16384.00MB
  --------------------------------------------------------------------------------
  ```

---

### 1.6 算法 (Algorithms) (v0.9.52)

#### `CycleDetector` 类

用于检测图结构中的循环以确保 DAG 有效性的服务。

- **位置**: `src/backend/algorithms/CycleDetection.ts`
- **方法**:
  - `detectCycles(graph: Graph, limit?: number): string[][]`
    - **描述**: 使用迭代 DFS（基于栈）检测简单循环，以防止深度图上的堆栈溢出。
    - **输入**:
      - `graph`: 要分析的图。
      - `limit` (可选): 返回循环的最大数量。默认为 0（无限制）。**v0.9.52 新增**，以防止在大型循环图上发生 OOM。
    - **输出**: 循环数组（每个循环是一个节点 ID 数组）。
  - `hasCycle(graph: Graph): boolean`
    - **描述**: 检查是否存在至少一个循环。已优化为提前停止。

#### `TopologicalSort` 类

为节点分配层级排名。

- **位置**: `src/backend/algorithms/TopologicalSort.ts`
- **方法**:
  - `assignRanks(graph: Graph): Map<string, number>`

### 1.7 核心 API (Core API) (v0.9.53)

#### `NoteConnection` 类

核心逻辑的主要入口点，与 CLI/服务器环境解耦。非常适合插件集成。

- **位置**: `src/core/NoteConnection.ts`
- **方法**: `static async build(options: BuildOptions): Promise<GraphBuildResult>`
- **输入**:
  ```typescript
  interface BuildOptions {
    targetPath?: string; // 源的相对或绝对路径
    maxWorkers?: number; // 并行限制
    enableGPU?: boolean; // GPU 加速开关
    projectRoot?: string; // 覆盖项目根目录 (默认: ../..)
  }
  ```
- **输出**:
  ```typescript
  interface GraphBuildResult {
    graph: Graph; // 内部 Graph 对象
    data: any; // 准备好用于前端的序列化 JSON 数据
    stats: {
      nodeCount: number; // 节点数
      edgeCount: number; // 边数
      fileCount: number; // 文件数
    };
  }
  ```

### 1.8 图指标 (Graph Metrics) (v0.9.60)

#### `GraphMetrics` 类

用于计算图拓扑指标（中心性）的静态工具类。

- **位置**: `src/backend/GraphMetrics.ts`
- **方法**:
  - `calculateBetweennessAsync(graph: Graph): Promise<Map<string, number>>`
    - **描述**: 使用 Worker 线程并行计算介数中心性（Brandes 算法）。
    - **优化**:
      - 将源节点分发到可用的 CPU 核心。
      - 聚合来自 Workers 的部分中心性分数。
      - 如果节点数 < 500，则回退到顺序计算。
  - `calculateBetweenness(graph: Graph): Map<string, number>`
    - **描述**: 顺序回退实现。

## 2. 前端接口 (Frontend Interfaces)

### 2.1 可视化 (Visualization)

#### `GraphRenderer` (JavaScript Module)

将 JSON 数据渲染为交互式 DAG。

- **输入**: `graph.json` (结构匹配 `DirectedGraph`)
- **功能**:

  - **Web Worker 卸载 (v0.9.72 & v0.9.83)**:

    - **模块**: `src/frontend/simulationWorker.js`
    - **目的**: 在后台线程运行 D3 力导向模拟，防止重计算期间主线程阻塞（UI 冻结）。
    - **接口**: 通过 `postMessage` 进行消息传递。
      - `init`: 发送节点/链接和设置 (包括 `gpuRendering`)。
      - `tick`: 接收用于渲染的更新位置 `({id, x, y})`。
      - `updateParams`: 在不重启的情况下更新物理参数（重力、排斥力）。
      - `updateLayout`: 在力导向和 DAG 模式之间切换。
      - `setNodes`: 更新活动的节点子集（例如用于专注模式）。
      - `drag`: 同步手动节点移动。

  - **布局模式 (v0.4.0)**:
    - **力导向 (Force Directed)**: 标准的基于物理的布局。
    - **DAG (层级)**: Sugiyama 风格的分层布局，使用 `rank` 作为 Y 坐标，并使用弯曲的贝塞尔线绘制边。
  - **Zoom/Pan**: D3 缩放行为。
  - **Tooltip**: 悬停时显示节点详情。
  - **专注模式 (Focus Mode - v0.6.2)**:
    - **函数**: `enterFocusMode(node)` / `exitFocusMode()`
    - **UI 行为 (v0.9.46)**: 主控件（源选择、设置）被隐藏 (`display: none`) 以提供专注视图。
    - **Canvas 渲染 (v0.9.46)**: Canvas 专注模式下隐藏边以保持清晰。
    - **描述**: 隔离一个节点及其直接上下文。
    - **布局**:
      - **焦点节点**: 居中。
      - **上级**: 出度邻居，置于上层。相对高度基于分数。
      - **下级**: 入度邻居，置于下层。相对高度基于分数。
    - **排序**: 层内节点按专注分数（边权重 + 度数比）排序。
    - **标签**: 基于垂直偏移交错（上方/下方）以防止重叠。
  - **设置 (Settings - v0.7.0)**:
    - **接口**: `SettingsManager` (前端)
    - **持久化**: `localStorage('nc_settings')`
    - **可配置项**:
      - **物理**:
        - **排斥力**: 拆分为 `repulsionForce` (默认: -550) 和 `repulsionDAG` (默认: -850)。
        - **UI 上下文**: 设置模态框会动态将输入标签更新为“排斥力 (力导向)”或“排斥力 (DAG)”，以清晰指示正在配置的模式。
        - **其他**: 连接距离、碰撞半径。
      - **视觉**: 边透明度。
  - **渲染模式 (v0.8.7 & v0.9.45)**:
    - **SVG**: 默认 D3 实现，用于交互和样式。
    - **Canvas**: 高性能光栅渲染，适用于大数据集。
      - **交互性 (v0.9.45)**: 通过手动命中测试 (`findNodeAt`) 支持悬停 (高亮)、点击 (统计) 和双击 (专注)。
      - **视觉**: 匹配 SVG 样式（大小依据、颜色依据、高亮颜色）。
      - **自动切换 (v0.9.61)**: 如果 `nodes.length > 3000`，默认自动启用以防止基于 DOM 的内存问题。
  - **专注模式增强 (v0.8.7, v0.8.8 & v0.9.44)**:
    - **动态间距**: 用户可通过 UI 滑块调整 `layerGap`。
    - **水平间距**: 用户可通过 UI 滑块调整 `hSpacing`。
    - **独立设置 (v0.9.44)**: 间距值分别为“水平”和“垂直”布局独立存储。默认值针对每种布局进行了优化（水平：125/80，垂直：250/20）。
  - **专注模式增强 (v0.8.9)**:
    - **位置锁定**: 专注模式下的节点在拖动后保留其位置（选中冻结），以防止布局漂移。
  - **专注模式控制 (Focus Mode Controls - v0.9.47)**:
    - **交互**: 双击节点不再触发缩放行为（停止了 d3-zoom 传播），防止不必要的窗口调整。
    - **垂直布局**: 将垂直模式下的节点标签水平偏移量 (`dx`) 增加到 35px（默认约 12px），以防止文本与节点重叠。
      _ **模拟控制 (v0.9.0, v0.9.25, v0.9.29 & v0.9.37)**:
      _ **快速松弛 (Rapid Relaxation - v0.9.37)**: 初始化时，`velocityDecay` 设置为 **0.2** 并持续 2 秒，以促进布局快速展开。随后自动过渡到 **0.95** 以保持稳定。
      _ **冻结布局**: 用于完全停止物理模拟的复选框。 _ **主界面**: 停止模拟并**禁用节点拖动**，以最小化内存/CPU 使用并防止意外的布局更改。
      - **专注模式**: 不影响专注模式；拖动和手动定位仍然启用以进行上下文探索。
      - **稳健性 (v0.9.29)**: 防止在布局事件（如调整窗口大小、打开分析面板）期间重启模拟，确保节点严格保持静止。
      - **视觉设置优先级 (v0.9.36)**: 如果启用了冻结布局，更改视觉参数（度数基准、大小依据）会更新节点外观（半径、颜色），但**不**会重启模拟。
      - **模态框设置优先级 (v0.9.40)**: 在“可视化设置”模态框中更改物理或视觉参数（排斥力、透明度等）会立即更新底层力配置和视觉样式，但如果启用了冻结布局，则**不**会重启模拟。
      - **设置模态框冻结 (v0.9.41)**: 打开设置模态框会自动强制进行临时模拟冻结 (`simulation.stop()`) 以节省资源。仅当模拟未被全局冻结时，关闭时才会恢复。
    - **视口剔除 (Viewport Culling - v0.9.31 & v0.9.35)**:
      - **全景冻结**: 当过度缩小 (< 0.1x，此前为 0.4x) 时自动停止模拟以节省资源。
      - **屏幕外冻结**: 放大时，可见视口外的节点被冻结（`fx`/`fy` 锁定）。
      - **缓冲区**: 活动区域在视口边缘之外扩展 `800 / scale` 像素，以确保平滑的平移和连续性。
    - **布局状态缓存 (Layout State Caching - v0.9.33 & v0.9.74)**:
      - **持久化**: 为每个布局模式（'Force', 'DAG'）独立缓存节点位置（`x, y, fx, fy`）。
      - **即时切换**: 切换回先前访问的布局时恢复精确位置，绕过重新计算和移动动画。
      - **稳健性 (v0.9.74)**: 实现了空值安全恢复和 `applyPhysics` 逻辑，防止在快速切换或初始化期间发生崩溃。
    - **全局布局转换 (Global Layout Transition - v0.9.34 & v0.9.39)**:
      - **解冻覆盖**: 当切换到新布局（无缓存）时，系统显式清除所有节点上的所有剔除锁定（`isCulled`，`fx`，`fy`）。
      - **快速松弛 (Rapid Relaxation - v0.9.39)**: 新的布局模拟以 **0.2** 的阻尼开始并持续 2 秒（与初始加载匹配），然后稳定在 **0.95**。
      - **延迟冻结**: 如果选中了“冻结布局”，模拟将运行 2 秒的松弛阶段以形成布局，然后自动停止。
      - **目标**: 确保释放屏幕外节点，并在稳定或冻结之前快速正确地形成新结构。
  - **移动端优化 (v0.9.2)**:
    - **响应式布局**: CSS 媒体查询 (`max-width: 768px`) 适配 UI。
      - **折叠控件**: 主面板变为可切换图标。
      - **专注栏**: 重新定位到视口底部以便拇指操作。
      - **设置集成**: 语言选择器移至设置模态框以节省屏幕空间。
    - **触摸手势**:
      - **阅读器**: 实现 `touchstart`/`touchmove` 以支持双指捏合缩放 (调整 `fontSize`)。
  - **交互逻辑 (v0.9.3)**:
    - **高亮/提示框**: 由 **鼠标悬停 (MouseOver)** (桌面端) 或 **单击 (Single Click)** (移动/桌面端) 触发。
    - **专注模式**: 由 **双击 (Double Click)** 触发。
  - **Mermaid 缩放 (v0.9.4)**:
    - **触发**: 点击阅读器中任何已渲染的 Mermaid 图表。
    - **界面**: 全屏模态框，具有独立的平移/缩放功能（无限制缩放）。
    - **退出**: 专用的 '×' 按钮。
  - **专注模式语义 (v0.9.5)**:
    - **居中**: 视口自动平移以使焦点节点居中，而不改变其模拟坐标。
    - **语义标签**:
      - **入度区域**: 标记为 "Helping to understand" (左/下)。
      - **出度区域**: 标记为 "Further exploration" (右/上)。
    - **布局**:
      - **水平**: 标准的上下流向。
      - **层级 (L-R)**: 从左到右流向 (入度 -> 选中 -> 出度)。
  - **分析交互 (v0.9.5)**:
    - **移动视图**: 小屏幕上可滚动的全宽面板。
    - **图表同步**: 点击分析表中的行会在主图中高亮显示相应的节点及其边。
  - **分析面板增强 (v0.9.6)**:
    - **全屏切换**: 按钮将面板扩展到 100% 高度。
    - **捏合缩放**: 触摸手势缩放面板内容以提高可读性。
  - **分析面板移动端交互 (v0.9.9)**:
    - **滑动操作**: 在触摸设备上上下拖动面板头部（或手柄）以调整面板大小。
    - **自动吸附**: 拖动至顶部附近时自动吸附至全屏模式。
    - **拖动手柄**: 移动端可拖动区域的视觉指示器。
  - **图表检查 (v0.9.10)**:
    - **点击冻结**: 点击节点会暂停物理模拟 (`simulation.stop()`)，以便稳定地检查连接。
    - **恢复**: 点击背景会恢复模拟 (`simulation.restart()`)，除非全局启用了“冻结布局”。
  - **节点统计弹窗 (Node Statistics Popup - v0.9.12)**:

    - **类型**: 独立浮动窗口 (`#node-stats-popup`)。
    - **触发**: 单击节点 (专注模式下禁用 v0.9.13)。
    - **内容**: 显示入度 (红色) 和出度 (蓝色) 计数，以及单独的可滚动入度和出度邻居列表。
    - **视觉反馈 (v0.9.14)**: 连接的边现在在 SVG 和 Canvas 渲染器中均显式着色 (红/蓝) 并加粗 (2px)。
    - **交互**: 点击列表中的邻居会导航到该节点 (高亮并更新弹窗)。
    - **独立性**: 独立于主度数分析面板，允许在不丢失全局上下文的情况下进行重点检查。
    - **可拖动 (v0.9.19)**: 用户可以通过点击标题栏拖动弹窗以重新定位到屏幕上的任何位置。
    - **可缩放 (v0.9.19)**: 三个缩放控制按钮 (+/−/⟲) 允许用户将内容从 0.5x 缩放到 2.0x 以提高可读性。
    - **可调整大小 (v0.9.19)**: CSS `resize: both` 启用使用浏览器原生调整大小手柄进行手动调整大小。

  - **专注模式重新进入 (Focus Mode Re-entry - v0.9.19)**:

    - **行为**: 在已处于专注模式时双击相关节点现在会正确刷新视图以显示新节点的上下文。
    - **修复**: 移除了阻止在相关节点之间切换专注的限制，使连接概念的无缝探索成为可能。
    - **状态重置**: 在进入新的专注模式之前重置所有节点可见性标志，以防止累积问题。

  - **专注进入时自动清除选择状态 (Selection State Auto-Clear - v0.9.20)**:

    - **行为**: 当双击节点进入专注模式时，任何现有的选择/高亮状态都会在进入专注视图之前自动清除。
    - **实现**:
      - 调用 `highlightManager.unhighlight({ force: true })` 以清除高亮状态。
      - 如果统计弹窗可见 (`#node-stats-popup`)，则将其隐藏。
    - **用户体验**: 提供了进入专注模式的干净过渡，没有先前选择残留的视觉伪影，确保专注视图始终清晰且整洁。

  - **严格的边可见性 (Strict Edge Visibility - v0.9.21)**:

    - **行为**: 为了减少视觉混乱并提高渲染性能，在 SVG 和 Canvas 模式下，边现在默认严格隐藏（不透明度 0）。
    - **交互**: 仅当连接的节点被高亮显示（悬停/点击）或处于专注模式时，边才变得可见。
    - **优化**: 确保大图（10k+ 节点）具有一致的“干净”初始视图。

  - **移动端统计弹窗 (Mobile Statistics Popup - v0.9.22)**:

    - **触摸拖动**: 移动用户可以按住并拖动弹窗头部 (`touchstart`/`touchmove`) 进行重新定位。
    - **捏合缩放**: 弹窗主体上的双指捏合手势可将内容大小 (`fontSize`) 从 0.5x 缩放到 2.0x。
    - **事件处理**: 使用 `passive: false` 防止在与弹窗交互时默认页面滚动。

  - **专注模式恢复 (Focus Mode Restoration - v0.9.24)**:

    - **恢复**: 退出专注模式时，所有背景节点将恢复到模拟中的原始位置。
    - **条件重启 (Conditional Restart - v0.9.27)**:
      - **逻辑**: 如果在退出专注模式时启用了“冻结布局”，模拟将保持停止状态 (`simulation.stop()`) 以维持视觉状态。
      - **行为**: 如果用户期望图表保持冻结，则防止图表“爆炸”或移动。

  - **专注模式具体内容 (v0.9.28)**:

    - **UI**: 专注模式控制面板中添加了“打开具体内容”按钮。
    - **功能**: 为当前聚焦的节点打开阅读窗口 (`window.reader.open(focusNode)`)。
    - **UX**: 提供了一个清晰、易于发现的替代方案，用于通过双击访问节点内容。

  - **冻结布局快速按钮 (v0.9.26)**:

    - **UI**: 右上角工具栏中的专用按钮 (❄️)，用于快速访问。
    - **功能**: 切换全局“冻结布局”状态（与控件中的复选框同步）。
    - **视觉反馈**: 激活（冻结）时按钮变红。

  - **快速开始指南 (v0.9.26)**:

    - **UI**: 显示 4 步指南的模态窗口。
    - **触发**: 首次访问时自动触发（localStorage 检查）或通过“帮助” (❓) 按钮触发。
    - **持久化**: “不再显示”复选框在 localStorage 中设置标志以抑制自动打开。

  - **可扩展性默认值 (v0.8.8)**:
    - **孤立节点**: 默认隐藏。
    - **边**: 默认隐藏 (透明度 0)，悬停/选择时可见。
    - **节点大小**: 默认为“度数”。
  - **Degree Analysis (v0.1.2)**:
    - **In-degree**: 显示入度（作为先决条件被引用的次数）。
    - **Out-degree**: 显示出度（引用的先决条件数量）。
    - **Visual Filters**: 支持单独查看入度或出度连接。
  - **本地化 (v0.9.38)**:
    - **支持**: 英文 ('en') 和中文 ('zh')。
    - **渲染**: 支持翻译字符串中的 HTML 标签（例如 `<br>`, `<strong>`），通过 `.innerHTML` 注入。

---

## 3. 独立 DAG 构建器 (Independent DAG Builder - v0.1.1)

本节定义了 v0.1.1 版本中用于独立构建 DAG 的特定接口，不依赖于外部 API。

### 3.1 本地文件加载 (Local File Loading)

#### `ILocalFileLoader`

负责从本地文件系统读取 Markdown 文件。

- **函数**: `load(dirPath: string): Promise<RawNote[]>`
- **输入**:
  - `dirPath` (string): 目标目录路径 (例如 `testconcept/`)。
- **输出**:
  - `Promise<RawNote[]>`: 包含文件名和内容的对象数组。
- **类型定义**:
  ```typescript
  interface RawNote {
    id: string; // 文件名 (无后缀)
    content: string; // 完整文本内容
  }
  ```

### 3.2 关键词匹配 (Keyword Matching)

#### `IKeywordMatcher`

基于文件名在内容中的出现频率建立连接。

- **函数**: `findMatches(notes: RawNote[]): DiscoveredEdge[]`
- **输入**:
  - `notes` (RawNote[]): 所有加载的笔记。
- **输出**:
  - `DiscoveredEdge[]`: 推断出的边列表。
- **逻辑**:
  - 构建所有 `Note.id` 的字典。
  - 对于每个 `Note A`，扫描其内容以查找其他 `Note B` 的 `id`。
  - 如果找到，创建边 `B -> A` (假设 B 是 A 的基础概念/被提及者)。
- **类型定义**:
  ```typescript
  interface DiscoveredEdge {
    source: string; // 被提及的概念 (Prerequisite)
    target: string; // 当前文件 (Context)
    weight: number; // 匹配次数或相关性分数
  }
  ```

### 3.3 结构生成 (Structure Generation)

#### `IStructureGenerator`

将节点和边转换为前端可视化的 JSON 格式。

- **函数**: `generateJSON(nodes: RawNote[], edges: DiscoveredEdge[]): GraphData`
- **输入**:
  - `nodes`: 原始节点列表。
  - `edges`: 发现的边列表。
- **输出**:
  - `GraphData`: D3 可视化所需的最终对象。
- **类型定义**:

  ```typescript
  interface D3Node {
    id: string;
    group: number; // 基于聚类或目录
    inDegree: number; // 入度
    outDegree: number; // 出度
  }

  interface D3Link {
    source: string;
    target: string;
    value: number;
  }

  interface GraphData {
    nodes: D3Node[];
    links: D3Link[];
  }
  ```

## 5. Inference Engines (Inference Engines - v0.6.5)

本节定义了用于推断隐式连接的算法接口。

### 4.1 统计分析器 (`StatisticalAnalyzer`)

基于共现和概率不对称性推断依赖关系。

- **函数**: `analyze(files: RawFile[], terms: string[]): Matrix`
- **逻辑**: 计算 $P(A|B)$ 和 $P(B|A)$。
- **指标**: 不对称性 = $P(Parent|Child) - P(Child|Parent)$。

### 4.2 向量空间 (`VectorSpace`)

使用 TF-IDF 和余弦相似度计算语义相似度。

- **分词器**: 双语支持（英文单词 + 中文字符）。
- **函数**: `getSimilar(fileId, topK)`
- **输出**: 带有分数的相似文件列表。
- **优化 (v0.9.59)**:
  - **稀疏向量**: 内部使用 `Uint32Array` (索引) 和 `Float32Array` (值) 存储 TF-IDF 向量。
  - **内存**: 仅存储非零元素，将内存占用减少 95% 以上（对于稀疏文本）。
  - **计算**: 点积计算优化为 $O(\min(|A|, |B|))$。

### 4.3 混合引擎 (`HybridEngine`)

结合统计和向量方法推断有向边。

- **规则**: 如果满足以下条件，建议边 $A \rightarrow B$：
  1.  $Similarity(A, B) > VectorThreshold$ (内容相关性)
  2.  $P(A|B) - P(B|A) > AsymmetryThreshold$ (方向性：B 暗示 A 语境)
- **性能监控 (v0.9.56)**:
  - 每处理 1000 个节点记录一次执行进度。
  - 在推断循环期间跟踪堆内存使用情况。

### 3.4 并行处理 (Parallel Processing - v0.9.57)

#### `GraphBuilder.runParallelMatching` & `StatisticalAnalyzer.runParallelTermExtraction`

利用 Node.js `worker_threads` 并行化计算密集型任务（关键词匹配、术语提取）。

- **优化 (v0.9.57)**:

  - **策略**: 系统不再向 Worker 传递包含文件内容的完整 `RawFile[]`，而是传递 `filePaths: string[]`。
  - **实现**: Worker 使用 `fs` 按需从磁盘读取文件内容。
  - **优势**: 大幅减少了在生成 Worker 时克隆大量文件内容字符串的结构性内存开销，解决了大数据集（10k+ 文件）上的堆内存溢出 (Heap OOM) 问题。

- **Worker 接口**:
  ```typescript
  interface WorkerData {
    filePaths: string[]; // 更新自 filesChunk: RawFile[]
    targetIds: string[]; // 或 terms: string[]
    strategy: "exact-phrase" | "fuzzy";
    exclusionList: string[];
  }
  ```
  - `destroy()`: 释放 GPU 资源 (WebGL 上下文)。

#### `Layout Forces (v0.9.74)`

用于前端布局的 GPU 加速物理引擎，实现了与 D3 兼容的力。

- **位置**: `src/frontend/layout_gpu.js`
- **架构**:
  - **共享上下文**: 使用单例 `SharedGPU` 管理所有力的单个 WebGL 上下文，防止达到浏览器上下文限制（每个浏览器最大 16 个上下文）。
- **类**:
  - **`GPUManyBodyForce`**: N 体排斥力。替换 `d3.forceManyBody`。
  - **`GPULinkForce`**: 弹簧力。替换 `d3.forceLink`。
    - **算法**: "Gather" 核函数，每个节点通过遍历扁平化的邻接列表来计算所有连接邻居的力。
    - **属性命名**: 内部数据使用 `this._links` 以避免遮蔽 `links()` Shim 方法。
    - **稳健性与安全**:
      - **速度钳位**: 将 `vx`/`vy` 限制在 `100` 以防止节点从视口中消失的“爆炸性”运动。
      - **NaN 缓解**: 核函数使用安全除法（距离偏移 `+0.0001`），并在将结果应用于节点对象之前进行 `isFinite()` 检查。
      - **类型安全**: 对核函数参数 (`alpha`, `strength`, `distance`) 进行显式 `Number()` 转换。
- **集成 (`app.js`)**:
  - **动态切换**: `applyPhysics` 根据硬件设置在 `d3.forceManyBody`/`d3.forceLink` 和 `window.gpuManyBody`/`window.gpuLink` 之间切换。
  - **专注模式支持**: `enterFocusMode` 和 `exitFocusMode` 检测活动力类型（CPU 或 GPU）以正确更新连接引用。
  - **布局缓存**: 安全恢复缓存坐标 (`layoutCache`)，并带有空值检查以防止在快速切换期间发生崩溃。
- 检测可用的 CPU 核心。
- 生成 Worker（可通过 `maxWorkers` 配置）。
- 将文件列表拆分为*路径*块。
- Worker 执行处理并返回轻量级结果。
- 结果在主线程中聚合。
- **回退**: 如果 Worker 生成失败，自动降级为顺序处理。

### 3.5 资源优化 (Resource Optimization - v0.9.58)

#### `GraphBuilder` 共享状态

实现资源重用以防止混合推断期间的 OOM 错误。

- **机制**: 在 `StatisticalInference` (步骤 2c) 和 `HybridInference` (步骤 2e) 之间预计算并重用 `sharedStatsMatrix` 和 `sharedVectorSpace`。
- **清理**: 在推断管道结束后显式清除这些资源 (`matrix.clear()`, `vectorSpace.destroy()`)。

#### `CooccurrenceMetrics` 接口

从 `StatisticalAnalyzer` 导出，用于共享状态的类型安全。

```typescript
interface CooccurrenceMetrics {
  count: number;
  jaccard: number; // |A ∩ B| / |A ∪ B|
  conditionalProb: number; // P(B|A)
}
```

### 5. 移动端构建 (Mobile Build - v0.9.1)

#### `Capacitor Pipeline`

将 Web 项目转换为独立的 Android APK。

- **组件**: Capacitor 构建系统 / Gradle。
- **输入**:
  - `dist/frontend`: 静态 Web 资源 (HTML, CSS, JS)。
  - `src/frontend/data.js`: 预生成的图数据 (必须在同步前构建)。
- **输出**: `android/app/build/outputs/apk/debug/app-debug.apk`。
- **流程**:
  1.  **数据生成**: `ts-node src/index.ts [target]` -> 生成 `data.js`。
  2.  **资源编译**: `npm run build` -> 填充 `dist/frontend`。
  3.  **同步**: `npx cap sync android` -> 将 `dist/frontend` 复制到 `android/app/src/main/assets/public`。
  4.  **原生构建**: `gradlew assembleDebug` -> 编译 APK。

### 6. 节点高亮系统 (Node Highlighting System - v0.9.18)

#### `NodeHighlightManager` 类

管理 PC 和移动端界面的节点高亮交互。

- **模块**: `nodeHighlight.js`
- **构造函数**: `new NodeHighlightManager(config: HighlightConfig)`
- **配置**:

  ```typescript
  interface HighlightConfig {
    nodes: NoteNode[]; // 所有图节点数组
    links: NoteEdge[]; // 所有图边数组
    nodeSelection: D3Selection; // 节点元素的 D3 选择集
    linkSelection: D3Selection; // 边元素的 D3 选择集
    tooltip: D3Selection; // 提示框元素
    simulation: D3Simulation; // 力导向模拟实例
    onTick: () => void; // 触发重绘的回调
    onHighlight?: (node, connections) => void; // 可选回调
    onUnhighlight?: (node) => void; // 可选回调
  }
  ```

- **公共方法**:

  - `highlight(node: NoteNode, options: HighlightOptions): void`

    - **描述**: 高亮显示节点及其连接。
    - **输入**:
      - `node`: 要高亮的节点。
      - `options`: 可选配置。
        ```typescript
        interface HighlightOptions {
          event?: Event; // 用于提示框定位的鼠标/触摸事件
          freeze?: boolean; // 是否冻结模拟
          mode?: "all" | "in" | "out"; // 过滤模式
        }
        ```
    - **视觉效果**:
      - 主节点: 完全不透明 (1.0)
      - 连接节点: 完全不透明 (1.0)
      - 未连接节点: 变暗 (0.05 不透明度)
      - 出度边: 蓝色 (#4488ff), 2.5px 宽度
      - 入度边: 红色 (#ff6b6b), 2.5px 宽度

  - `unhighlight(options: UnhighlightOptions): void`

    - **描述**: 移除当前节点的高亮。
    - **输入**:
      ```typescript
      interface UnhighlightOptions {
        force?: boolean; // 即使冻结也强制取消高亮
      }
      ```

  - `setFocusMode(focusState: FocusState): void`

    - **描述**: 更新专注模式引用。
    - **输入**:
      ```typescript
      interface FocusState {
        active: boolean;
        node?: NoteNode;
      }
      ```

  - `getState(): HighlightState`

    - **描述**: 返回当前高亮状态。
    - **输出**:
      ```typescript
      interface HighlightState {
        currentNode: NoteNode | null;
        isFrozen: boolean;
        frozenNode: NoteNode | null;
      }
      ```

  - `isHighlighted(nodeId: string): boolean`

    - **描述**: 检查节点当前是否被高亮。

  - `getCurrentConnections(): ConnectionData | null`
    - **描述**: 获取当前高亮节点的连接。
    - **输出**:
      ```typescript
      interface ConnectionData {
        links: NoteEdge[];
        nodeIds: Set<string>;
        incomingLinks: NoteEdge[];
        outgoingLinks: NoteEdge[];
      }
      ```

- **集成模式**:

  1.  在创建图元素后初始化。
  2.  附加事件处理程序（悬停、点击）。
  3.  进入/退出专注模式时更新专注模式状态。
  4.  在 Canvas 渲染器中使用以保持视觉一致性。

- **移动端优化**:

  - **单击**: 高亮节点并冻结模拟以便稳定检查。
  - **双击**: 进入专注模式。
  - **悬停 (PC)**: 高亮但不冻结。
  - **背景点击**: 清除高亮并恢复模拟。

- **交互状态**:
  - **正常**: 无高亮。
  - **悬停 (PC)**: 临时高亮，鼠标移出时移除。
  - **冻结 (移动端/PC)**: 点击后持续高亮，需要背景点击或强制清除。
  - **专注模式**: 高亮禁用，专注模式处理可视化。

### 7. GPU 加速 (GPU Acceleration - v0.9.50)

#### `VectorSpaceGPU` 类

向量空间模型的 GPU 加速实现，利用 AMD 7900XT（或兼容 GPU）进行矩阵运算。

- **位置**: `amdgpu/VectorSpaceGPU.ts`
- **继承**: `VectorSpace`
- **核心特性**:
  - **矩阵乘法**: 使用 WebGL (headless-gl) 将 $N \times N$ 余弦相似度计算卸载到 GPU。
  - **性能**: 将 CPU 上的 $O(N^2 \times D)$ 复杂度降低为大规模并行执行。
  - **回退**: 如果 GPU 初始化失败，自动回退到 CPU。
- **方法**:
  - `constructor(files: RawFile[])`: 构建向量 (CPU) 并预计算相似度矩阵 (GPU)。
  - `getSimilar(fileId: string, topK: number)`: 检索为 $O(1)$ (行查找) + 排序，从预计算矩阵中读取。
  - `destroy()`: 释放 GPU 资源 (WebGL 上下文)。

### 8. 拖动与缩放功能 (Drag and Zoom Functionality)

增强节点统计弹窗，提供用户友好的定位和缩放控制。

- **拖动接口**:

  - **触发**: `#popup-drag-handle` (头部元素) 上的 `mousedown`。
  - **行为**:
    - 跟踪鼠标移动并更新弹窗的 `left` 和 `top` CSS 属性。
    - 在点击头部内的按钮时防止拖动。
    - 添加 `.dragging` 类以提供视觉反馈。
  - **状态**:
    ```typescript
    interface PopupDragState {
      isDragging: boolean;
      startX: number; // 初始鼠标 X
      startY: number; // 初始鼠标 Y
      startLeft: number; // 初始弹窗左侧位置
      startTop: number; // 初始弹窗顶部位置
      currentScale: number; // 当前缩放比例 (0.5-2.0)
    }
    ```

- **缩放接口**:

  - **控制**:
    - `#popup-zoom-in`: 增加比例 0.1 (最大 2.0)。
    - `#popup-zoom-out`: 减少比例 0.1 (最小 0.5)。
    - `#popup-reset-size`: 重置比例为 1.0，尺寸为默认 (280px 宽，自动高度)。
  - **应用**: 使用 `fontSize` CSS 属性缩放 `.popup-content`。
  - **公式**: `fontSize = ${scale}rem`

- **重置行为**:

  - 关闭弹窗 (`#popup-close-btn`) 时，位置重置为默认值：
    - `left: auto`
    - `right: 20px`
    - `top: 80px`

- **CSS 属性**:
  - **可拖动**: 头部显示 `cursor: move`，激活时显示 `cursor: grabbing`。
  - **可调整大小**: `resize: both` 启用浏览器原生调整大小手柄。
  - **约束**: `min-width: 200px`, `min-height: 250px`, `max-width: 90vw`, `max-height: 90vh`。

## 9. CLI 接口 (CLI Interfaces - v0.9.71)

### 构建命令

**输入:**

- `--path`: 字符串。知识库路径。
- `--gpu`: 布尔值 (Flag)。启用 GPU。
- `--static`: 布尔值 (Flag)。启用静态模式。

**输出:**

- `src/frontend/data_cli_{kb}_{time}.js`: 前端轻量数据 (CLI 运行专用)。
- `src/frontend/graph_data_cli_{kb}_{time}.json`: 完整数据 (CLI 运行专用)。

## 10. 前端设置接口 (Frontend Settings Interfaces - v0.9.71)

### 性能设置

- **GPU 优化渲染**:
  - 类型: 复选框
  - 默认值: `true` (硬件支持时)
  - 效果: 为后端布局更新和向量相似度启用 `gpu.js` 加速。
- **静态模式**:
  - 类型: 复选框
  - 逻辑: 节点数 > 5000 时自动启用。
  - 效果: 在 2 秒松弛后完全停止模拟。
- **极端规模**:
  - 逻辑: 隐式约束。
  - 条件: 节点数 > 10,000 或 边数 > 1,000,000。
  - 效果: 永远不渲染边。

## 11. 任务同步与稳健性 (Worker Sync & Robustness - v0.9.82)

### 11.1 Worker 握手协议 (Worker Handshake Protocol)

解决布局切换期间由于 Web Worker 异步消息导致的显示竞态条件。

- **状态标志**: `isLayoutSwitching` (Boolean)。在 `updateLayout` 开始时设为 `true`，在收到 `layoutSwitchDone` 响应后设为 `false`。
- **消息交换**:
  1.  **Main -> Worker**: 发送 `setNodes` 同步最新坐标，紧接着发送 `{ type: 'layoutSwitchDone' }`。
  2.  **Worker -> Main**: 收到 `layoutSwitchDone` 后立即原样返回该消息。
- **过滤逻辑**: 当 `isLayoutSwitching === true` 时，主线程忽略所有来自 Worker 的 `tick` 消息。
- **优势**: 确保只有在 Worker 完成新布局同步后的帧才会被渲染，防止布局“回弹”或瞬移到旧坐标。

### 11.2 专注模式拖动隔离 (Focus Mode Dragging Isolation)

优化专注模式下的手动交互，使其完全独立于背景物理模拟。

- **交互逻辑**:
  - **手动驱动**: 专注模式下的节点通过主线程直接更新 `x, y` 和 `fx, fy`。
  - **模拟绕过**: 拖动事件不再触发 Worker 的 `drag` 消息，从而防止延迟的 `tick` 消息覆盖手动的精确定位。
  - **状态持久化**: 在拖动结束后，节点保持 `fx, fy` 锁定，直到退出专注模式。

### 11.3 布局缓存验证 (Layout Cache Validation)

增强布局恢复的安全性。

- **阈值**: 50%。
- **逻辑**: `restoreLayoutState` 计算成功恢复位置的节点百分比。如果小于 50%（例如由于图谱数据大幅变动），则判定缓存无效，强制执行模拟松弛 (`restart: true`)。
- **回退**: 确保用户在数据更新后始终能看到稳定的布局，而不是破碎的缓存状态。

---

## 12. GPU 工作线程集成 (GPU Worker Integration - v0.9.83)

#### `simulationWorker.js` & `layout_gpu.js`

在 Web Worker 上下文中将力计算完全卸载到 GPU。

- **初始化**:
  - 通过 `importScripts` 自动导入 `gpu-browser.min.js` 和 `layout_gpu.js`。
  - 根据 `gpuRendering` 设置标志和 `gpuManyBody` 的可用性确定布局引擎（GPU vs CPU）。
- **动态参数更新**:
  - `updateParams` 消息现在使用 `.strength()` 修改现有的力实例（包括 GPU 力），确保设置更改不会意外回退到 CPU 物理。
- **环境兼容性**:
  - `layout_gpu.js` 利用 `globalScope`（在 Worker 中解析为 `self`）以允许在主线程和工作线程环境中共享实例。

## 13. 专注模式性能优化 (v1.0.0)

### 13.1 邻接缓存 (Adjacency Cache)

为了确保在进入专注模式时识别邻居节点的效率达到 O(1)：

- **`window._adjacencyCache`**: 一个临时的 Map，存储所有节点的“出度”和“入度”连接。
- **`window._adjacencyCacheStale`**: 一个布尔标志，每当图谱数据发生变化时设置为 `true`，从而在下次进入专注模式时触发缓存重建。

### 13.2 批量渲染 (Batched Rendering)

专注模式下的 UI 更新使用 `requestAnimationFrame` 进行批量处理：

- **实现**: 最后的 `updateVisibility()` 和 `ticked()` 调用被包装在一个动画帧中，以防止页面布局抖动 (Layout Thrashing) 并确保视觉上的一致性。

### 13.3 随机专注 (Random Focus)

- **功能**: 搜索栏旁的骰子图标允许随机选择一个可见节点并立即进入其专注模式。
- **实现**: `handleRandomFocus` 函数选择一个随机的可见节点索引并调用 `enterFocusMode`。

### 13.4 视觉状态还原 (Visual State Restoration)

- **逻辑**: 在退出专注模式时，系统会在调用 `updateSize()` 之前，先将备份的 `_origRadius` 和 `_origFontSize` 显式还原给对应的 D3 元素。
- **目的**: 确保节点在退出后能立即恢复到进入前的精确视觉状态，消除半径或字体大小的残留偏差。

---

## 14. GPU 诊断 (v1.0.0)

`SharedGPU` 实例提供了增强的日志记录：

- **`Instance mode` (实例模式)**: 报告系统是使用 `gpu` 还是 `cpu` 回退模式。
- **`Hardware Info` (硬件信息)**: 在 WebGL 上下文可用时，报告 GPU 的 `Vendor` (供应商，如 AMD、NVIDIA) 和 `Renderer` (渲染器)。

## 15. 部署与构建系统 (Deployment & Build System - v1.0.0)

### 15.1 构建模式 (Build Modes)

NoteConnection 支持双重构建配置以优化安装包大小。

- **完整模式 (FULL Mode)** (默认):

  - **命令**: `npm run build` / `npm run electron:build`
  - **包含内容**: 捆绑 `data.js` (~170MB) 和 `graph_data.json` (~470MB) 以具备即时演示能力。
  - **用例**: 演示、预打包知识库。

- **精简模式 (MINI Mode)**:
  - **命令**: `npm run build:mini` / `npm run electron:build:mini`
  - **排除内容**: `copy-assets.js` 过滤掉大型运行时生成的数据文件 (`data.js`, `graph_data.json`)。
  - **稳定性改进**: 增加了对 `graphData` 的类型检查，防止在首次启动无数据时崩溃。
  - **路径修正**: 修复了生产环境下工作线程 (Worker) 的双层 `dist` 路径解析错误。
  - **逻辑**: 检查 `process.argv.includes('--mini')`。
  - **大小节省**: 压缩后的安装包减少约 70MB。

## 16. 用户定义知识库配置 (v1.0.0)

### 16.1 持久化存储

- **文件**: `kb_config.json`
- **位置**: `app.getPath('userData')` (例如 `%APPDATA%/NoteConnection/`)
- **结构**:
  ```json
  {
    "knowledgeBasePath": "E:\\path\\to\\custom\\folder"
  }
  ```

### 16.2 IPC API

- **通道**: `getKbPath`
- **方向**: 渲染进程 -> 主进程
- **响应**: `Promise<string>` (当前活动的知识库根目录的绝对路径)。
- **用途**: 前端用于在 UI 中显示当前路径或请求相对内容。

### 16.3 菜单集成

- **文件菜单**:
  - **更改知识库... (Change Knowledge Base)**: 触发 `dialog.showOpenDialog` -> 更新配置 -> 重载应用。
  - **重置为默认 (Reset to Default)**: 恢复为捆绑的 `./Knowledge_Base` -> 更新配置 -> 重载应用。

## 17. 物理算法默认参数 (v1.0.0)

为了提供更清晰的初始布局，v1.0.0 调整了以下物理参数的默认值及范围：

- **链接距离 (Link Distance)**: 默认值提升至 **250** (原 100)，最大可调至 **600**。
- **碰撞半径 (Collision Radius)**: 默认值提升至 **25** (原 20)，最大可调至 **100**。

---

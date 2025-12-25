# 2025-12-24 v0.9.20

# Project Build Plan: Progressive Hierarchical Knowledge Graph

This document outlines the roadmap for building `NoteConnection`, a system capable of visualizing tens of thousands of knowledge points as a Directed Acyclic Graph (DAG), highlighting hierarchical relationships and learning paths.

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
    - [x] **Constraint**: This restriction does *not* apply to Focus Mode, where manual adjustment is still permitted.
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
    - [x] **Always-On Context**: Clicking a node now forces the display of *all* In-degree and Out-degree relationships, overriding any active "Incoming Only" or "Outgoing Only" filters to ensure complete context is visible.
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
    - [x] **Constraint**: Verified that clicking a node while in Focus Mode does *not* trigger the floating statistics popup or change the highlight style, preserving the specific Focus Mode context.

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

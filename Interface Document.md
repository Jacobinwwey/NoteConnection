# 2025-12-19 v0.1.3

# Interface Document

This document defines the core interfaces for the NoteConnection system, separating backend processing from frontend visualization.

---

## 1. Backend Interfaces

### 1.1 Data Ingestion

#### `IFileLoader` (Updated v0.8.6)
Responsible for reading raw files from the file system asynchronously.

*   **Function**: `loadFiles(directory: string, extensions?: string[]): Promise<RawFile[]>`
*   **Input**:
    *   `directory` (string): Absolute path to the concept directory.
    *   `extensions` (string[]): Optional file extensions to filter (default: `['.md']`).
*   **Output**:
    *   `Promise<RawFile[]>`: Array of loaded file objects.
*   **Concurrency**: Implements batch processing to handle large file counts without exhausting file handles.
*   **Type Definitions**:
    ```typescript
    interface RawFile {
        filepath: string;  // Full path
        filename: string;  // Name with extension
        content: string;   // File body
        modifiedTime?: Date; // Last modification time (optional)
    }
    ```

### 1.2 Parsing & Extraction

#### `FrontmatterParser` (Updated v0.2.0)
Parses YAML frontmatter to extract structured metadata.

*   **Function**: `parse(content: string): ParsedMetadata`
*   **Input**:
    *   `content` (string): The full content of the Markdown file.
*   **Output**:
    *   `ParsedMetadata`: Object containing extracted fields.
*   **Type Definitions**:
    ```typescript
    interface ParsedMetadata {
        tags: string[];         // Extracted from 'tags' (list or inline)
        prerequisites: string[];// Extracted from 'prerequisites'
        next: string[];         // Extracted from 'next'
        [key: string]: any;
    }
    ```
*   **Supported Formats**:
    *   Inline Array: `field: [Item A, Item B]`
    *   List: 
        ```yaml
        field:
          - Item A
          - [[Item B]]
        ```
    *   Single Value: `field: [[Item A]]`

#### `INoteParser`
Parses raw content into structured Concept objects.

*   **Function**: `parse(files: RawFile[]): Concept[]`
*   **Input**:
    *   `files` (RawFile[]): Raw files loaded from disk.
*   **Output**:
    *   `Concept[]`: Structured data objects.
*   **Type Definitions**:
    ```typescript
    interface Concept {
        id: string;        // Unique ID (usually filename without ext)
        title: string;     // Concept title
        content: string;   // Cleaned content
        metadata: {
            tags: string[];
            prerequisites: string[]; // Explicit dependencies
        }; // Extracted or Default Metadata
    }
    ```

### 1.3 Graph Construction (Updated 2025-12-19 v0.1.3)

#### `Graph` Class
Core data structure for managing notes and dependencies.

*   **Class**: `Graph`
*   **Methods**:
    *   `addNode(node: NoteNode): void`
    *   `addEdge(source: string, target: string, type?: string): void`
    *   `getOutgoingEdges(id: string): NoteEdge[]`
    *   `getIncomingEdges(id: string): NoteEdge[]`
    *   `toJSON(): GraphData`

#### `GraphBuilder` Service
*   **Strategy**: Configurable Keyword Matching.
*   **Configuration**:
    *   `matchingStrategy`: 'exact-phrase' (Regex `\bterm\b`) or 'fuzzy' (`includes`). Default: 'exact-phrase'.
    *   `exclusionList`: Array of strings to ignore.
*   **Logic**:
    *   Iterates through all file pairs (Source, Target).
    *   Checks if `Target.id` is in `exclusionList`.
    *   Checks if `Source.content` matches `Target.id` using the selected strategy.
    *   If matched: Creates Edge `Target -> Source`.

*   **Type Definitions**:
    ```typescript
    interface AppConfig {
        matchingStrategy: 'exact-phrase' | 'fuzzy';
        clusteringStrategy: 'label-propagation' | 'folder';
        enableStatisticalInference: boolean; // Toggle statistical analysis
        exclusionList: string[];
    }
    
    interface NoteNode {
        id: string;        // Unique identifier (usually the note title)
        label: string;     // Display label
        inDegree: number;  // Number of incoming edges
        outDegree: number; // Number of outgoing edges
        content?: string;  // Full text content (v0.1.5)
        rank?: number;     // Topological rank or hierarchy level
        clusterId?: string;// ID of the cluster this node belongs to
        metadata?: Record<string, any>; // Additional metadata
    }

    interface NoteEdge {
        source: string; // Source node ID
        target: string; // Target node ID
        type?: string;  // Type of relationship (e.g., "dependency")
        weight?: number;// Weight of the edge
    }

    interface GraphData {
        nodes: NoteNode[];
        edges: NoteEdge[];
    }
    ```

### 1.4 Export

#### `IExporter`
Saves the graph for frontend consumption.

*   **Function**: `exportToJSON(graph: DirectedGraph, outputPath: string): Promise<void>`
*   **Filtered Export (Frontend)**: 
    *   Export now includes both filtered nodes and the edges connecting them.
    *   Structure: `{ nodes: NoteNode[], edges: NoteEdge[] }`.

---

## 2. Frontend Interfaces

### 2.1 Visualization

#### `GraphRenderer` (JavaScript Module)
Renders the JSON data into an interactive DAG.

*   **Input**: `graph.json` (Structure matches `DirectedGraph`)
*   **Features**:
    *   **Layout Modes (v0.4.0)**:
        *   **Force Directed**: Standard physics-based layout.
        *   **DAG (Hierarchical)**: Sugiyama-style layered layout using `rank` for Y-coordinates and curved Bezier lines for edges.
    *   **Zoom/Pan**: D3-zoom behavior.
    *   **Tooltip**: Show node details on hover.
    *   **Focus Mode (v0.6.2)**:
        *   **Function**: `enterFocusMode(node)` / `exitFocusMode()`
        *   **Description**: Isolates a node and its direct context.
        *   **Layout**:
            *   **Focus Node**: Center.
            *   **Superiors**: Out-degree neighbors, placed in top layer. Relative height based on Score.
            *   **Subordinates**: In-degree neighbors, placed in bottom layer. Relative height based on Score.
        *   **Sorting**: Intra-layer nodes sorted by Focus Score (Edge Weight + Degree Ratio).
        *   **Labeling**: Staggered (Above/Below) based on vertical offset to prevent overlap.
    *   **Settings (v0.7.0)**:
        *   **Interface**: `SettingsManager` (Frontend)
        *   **Persistence**: `localStorage('nc_settings')`
        *   **Configurable**:
            *   **Physics**: Repulsion, Link Distance, Collision Radius.
            *   **Visuals**: Edge Opacity.
    *   **Rendering Modes (v0.8.7)**:
        *   **SVG**: Default D3 implementation for interactivity and styling.
        *   **Canvas**: High-performance raster rendering for large datasets (>2000 nodes). Supports Zoom/Pan.
    *   **Focus Mode Enhancements (v0.8.7)**:
        *   **Dynamic Spacing**: User adjustable `layerGap` via UI slider (50px - 500px).
    *   **Focus Mode Enhancements (v0.8.8)**:
        *   **Horizontal Spacing**: User adjustable `hSpacing` via UI slider (20px - 300px).
    *   **Focus Mode Enhancements (v0.8.9)**:
        *   **Position Lock**: Nodes in Focus Mode retain their position after dragging (Freeze on Select) to prevent layout drift.
    *   **Simulation Controls (v0.9.0)**:
        *   **Freeze Layout**: Checkbox to stop the physics simulation completely. Allows manual positioning without snap-back.
        *   **Speed (Damping)**: Slider (0-1) to control `velocityDecay`. Higher values = more friction (slower movement).
        *   **Hover Lock**: Hovering a node temporarily locks its position to prevent drift during inspection.
    *   **Mobile Optimizations (v0.9.2)**:
        *   **Responsive Layout**: CSS Media Queries (`max-width: 768px`) adapt the UI.
            *   **Collapsed Controls**: Main panel becomes a toggleable icon.
            *   **Focus Bar**: Relocated to viewport bottom for thumb access.
            *   **Settings Integration**: Language selector moved to Settings modal to save screen space.
        *   **Touch Gestures**:
            *   **Reader**: Implements `touchstart`/`touchmove` for 2-finger pinch-to-zoom (scales `fontSize`).
    *   **Interaction Logic (v0.9.3)**:
        *   **Highlight/Tooltip**: Triggered by **MouseOver** (Desktop) or **Single Click** (Mobile/Desktop).
        *   **Focus Mode**: Triggered by **Double Click**.
    *   **Interaction Logic (v0.9.16)**:
        *   **Context Reveal**: Highlighting a node (Hover or Click) now explicitly displays **all** incoming and outgoing edges, disregarding the global "Incoming/Outgoing Only" filter, to provide a complete inspection view.
    *   **SVG Markers (v0.9.17)**:
        *   **Dynamic Arrows**: The system now supports and utilizes colored arrow markers (`#arrow-in` [Red], `#arrow-out` [Blue]) which are dynamically applied to edges during highlight events to ensure visual consistency with the colored lines.
    *   **Mermaid Zoom (v0.9.4)**:
        *   **Trigger**: Click on any rendered Mermaid diagram in the Reader.
        *   **Interface**: Full-screen modal with independent Pan/Zoom (unlimited scaling).
        *   **Exit**: dedicated '×' button.
    *   **Focus Mode Semantics (v0.9.5)**:
        *   **Centering**: Viewport automatically pans to center the focused node without displacing its simulation coordinates.
        *   **Semantic Labels**:
            *   **Inbound Area**: Labeled "Helping to understand" (Left/Bottom).
            *   **Outbound Area**: Labeled "Further exploration" (Right/Top).
        *   **Layouts**:
            *   **Horizontal**: Standard Top-Bottom flow.
            *   **Hierarchical (L-R)**: Left-to-Right flow (Inbound -> Selected -> Outbound).
    *   **Analysis Interaction (v0.9.5)**:
        *   **Mobile View**: Scrollable full-width panel on small screens.
        *   **Graph Sync**: Clicking a row in the analysis table highlights the corresponding node and its edges in the main graph.
    *   **Analysis Panel Enhancements (v0.9.6)**:
        *   **Full Screen Toggle**: Button to expand panel to 100% height.
        *   **Pinch Zoom**: Touch gestures to scale the panel content for better readability.
    *   **Analysis Mobile Interactions (v0.9.9)**:
        *   **Slide Gesture**: Drag the panel header (or handle) up/down to resize the panel on touch devices.
        *   **Auto-Snap**: Dragging near the top automatically snaps to Full Screen mode.
        *   **Drag Handle**: Visual indicator for the draggable area on mobile.
    *   **Analysis Mobile Interactions (v0.9.9)**:
        *   **Slide Gesture**: Drag the panel header (or handle) up/down to resize the panel on touch devices.
        *   **Auto-Snap**: Dragging near the top automatically snaps to Full Screen mode.
        *   **Drag Handle**: Visual indicator for the draggable area on mobile.
    *   **Graph Inspection (v0.9.10)**:
        *   **Click-to-Freeze**: Clicking a node pauses the physics simulation (`simulation.stop()`) to allow stable inspection of connections.
        *   **Resume**: Clicking the background resumes the simulation (`simulation.restart()`) unless "Freeze Layout" is globally enabled.
    *   **Node Statistics Popup (v0.9.12)**:
        *   **Type**: Independent Floating Window (`#node-stats-popup`).
        *   **Trigger**: Single Click on a node (Disabled in Focus Mode v0.9.13).
        *   **Content**: Displays In-degree (Red) and Out-degree (Blue) counts, plus separate scrollable lists of incoming and outgoing neighbors.
        *   **Visual Feedback (v0.9.14)**: Connected edges are now explicitly colored (Red/Blue) and bolded (2px) in both SVG and Canvas renderers.
        *   **Interaction**: Clicking a neighbor in the list navigates to that node (highlights and updates popup).
        *   **Independence**: Separate from the main Degree Analysis panel to allow focused inspection without losing global context.

    *   **Scalability Defaults (v0.8.8)**:
        *   **Orphans**: Hidden by default.
        *   **Edges**: Hidden by default (opacity 0), visible on Hover/Select.
        *   **Node Size**: Defaults to 'Degree'.
    *   **Degree Analysis (v0.1.2)**:
        *   **In-degree**: Show incoming degree count.
    *   **Localization (v0.1.9)**: Supports English ('en') and Chinese ('zh').

### 3. Inference Engines (v0.6.5)

#### `StatisticalAnalyzer`
Infers dependencies based on co-occurrence and probability asymmetry.

*   **Function**: `analyze(files: RawFile[], terms: string[]): Matrix`
*   **Logic**: Calculates $P(A|B)$ and $P(B|A)$.
*   **Metric**: Asymmetry = $P(Parent|Child) - P(Child|Parent)$.

#### `VectorSpace`
Calculates semantic similarity using TF-IDF and Cosine Similarity.

*   **Tokenizer**: Bilingual (English words + Chinese characters).
*   **Function**: `getSimilar(fileId, topK)`
*   **Output**: List of similar files with score.

#### `HybridEngine`
Combines statistical and vector methods to infer directed edges.

*   **Rule**: Suggest Edge $A \rightarrow B$ if:
    1.  $Similarity(A, B) > VectorThreshold$ (Content Relevance)
    2.  $P(A|B) - P(B|A) > AsymmetryThreshold$ (Directionality: B implies A context)

### 3.4 Parallel Processing (v0.8.6)

#### `GraphBuilder.runParallelMatching`
Utilizes Node.js `worker_threads` to parallelize the computationally expensive keyword matching process.

*   **Logic**:
    *   Detects available CPU cores.
    *   Spawns workers (capped at 4 for stability).
    *   Splits the file list into chunks.
    *   Workers perform `checkMatch` (shared logic) against the full list of target IDs.
    *   Results are aggregated in the main thread.
*   **Worker Interface**:
    ```typescript
    interface WorkerData {
        filesChunk: RawFile[];
        targetIds: string[];
        strategy: 'exact-phrase' | 'fuzzy';
        exclusionList: string[];
    }
    
    interface MatchResult {
        source: string;
        target: string;
    }
    ```
*   **Fallback**: Automatically degrades to sequential processing if worker spawning fails.

## 4. Server API (v0.8.5)

### 4.1 Endpoints

#### `GET /api/folders`
Lists available knowledge base directories.
*   **Response**: `{ "folders": ["testconcept", "folder2"] }`

#### `POST /api/build`
Triggers a graph build for the specified target.
*   **Body**: `{ "target": "testconcept" }` or `{ "target": "" }` (for all).
*   **Response**: `{ "success": true }` or `{ "success": false, "error": "..." }`

### 5. Mobile Build (v0.9.1)

#### `Capacitor Pipeline`
Transforms the web project into a standalone Android APK.

*   **Component**: Capacitor Build System / Gradle.
*   **Input**: 
    *   `dist/frontend`: Static web assets (HTML, CSS, JS).
    *   `src/frontend/data.js`: Pre-generated graph data (must be built before sync).
*   **Output**: `android/app/build/outputs/apk/debug/app-debug.apk`.
*   **Process**:
    1.  **Data Generation**: `ts-node src/index.ts [target]` -> Generates `data.js`.
    2.  **Asset Compilation**: `npm run build` -> Populates `dist/frontend`.
    3.  **Sync**: `npx cap sync android` -> Copies `dist/frontend` to `android/app/src/main/assets/public`.
    4.  **Native Build**: `gradlew assembleDebug` -> Compiles the APK.


---
---

# 接口文档

本文档定义了 NoteConnection 系统核心接口，分离了后端处理与前端可视化。

---

## 1. 后端接口 (Backend Interfaces)

### 1.1 数据摄取 (Data Ingestion)

#### `IFileLoader` (更新于 v0.8.6)
负责从文件系统异步读取原始文件。

*   **函数**: `loadFiles(directory: string, extensions?: string[]): Promise<RawFile[]>`
*   **输入**:
    *   `directory` (string): 概念目录的绝对路径。
    *   `extensions` (string[]): 可选的文件扩展名过滤 (默认: `['.md']`)。
*   **输出**:
    *   `Promise<RawFile[]>`: 加载的文件对象数组。
*   **并发性**: 实现批量处理以在不耗尽文件句柄的情况下处理大量文件。
*   **类型定义**:
    ```typescript
    interface RawFile {
        filepath: string;  // 完整路径
        filename: string;  // 带后缀的文件名
        content: string;   // 文件内容
        modifiedTime?: Date; // 最后修改时间 (可选)
    }
    ```

### 1.2 解析与提取 (Parsing & Extraction)

#### `INoteParser`
将原始内容解析为结构化的 Concept 对象。

*   **函数**: `parse(files: RawFile[]): Concept[]`
*   **输入**:
    *   `files` (RawFile[]): 从磁盘加载的原始文件。
*   **输出**:
    *   `Concept[]`: 结构化数据对象。
*   **类型定义**:
    ```typescript
    interface Concept {
        id: string;        // 唯一ID (通常是不带后缀的文件名)
        title: string;     // 概念标题
        content: string;   // 清洗后的内容
        metadata: {
            tags: string[];
            prerequisites: string[]; // 显式依赖
        }; // 提取或默认元数据
    }
    ```

### 1.3 图构建 (Graph Construction) (更新于 2025-12-19 v0.1.3)

#### `Graph` 类
用于管理笔记和依赖关系的核心数据结构。

*   **类**: `Graph`
*   **方法**:
    *   `addNode(node: NoteNode): void`
    *   `addEdge(source: string, target: string, type?: string): void`
    *   `getOutgoingEdges(id: string): NoteEdge[]`
    *   `getIncomingEdges(id: string): NoteEdge[]`
    *   `toJSON(): GraphData`

#### `GraphBuilder` 服务
*   **策略**: 可配置的关键词匹配。
*   **配置**:
    *   `matchingStrategy`: 'exact-phrase' (正则 `\bterm\b`) 或 'fuzzy' (`includes`)。默认: 'exact-phrase'。
    *   `exclusionList`: 要忽略的字符串数组。
*   **逻辑**:
    *   遍历所有文件对 (Source, Target)。
    *   检查 `Target.id` 是否在 `exclusionList` 中。
    *   使用选定的策略检查 `Source.content` 是否匹配 `Target.id`。
    *   如果匹配: 创建边 `Target -> Source`。

*   **类型定义**:
    ```typescript
    interface AppConfig {
        matchingStrategy: 'exact-phrase' | 'fuzzy';
        exclusionList: string[];
    }

    interface NoteNode {
        id: string;        // 唯一标识符（通常是笔记标题）
        label: string;     // 显示标签
        inDegree: number;  // 入度数量
        outDegree: number; // 出度数量
        content?: string;  // 全文内容 (v0.1.5)
        rank?: number;     // 拓扑排名或层级
        clusterId?: string;// 该节点所属的聚类 ID
        metadata?: Record<string, any>; // 额外元数据
    }

    interface NoteEdge {
        source: string; // 源节点 ID
        target: string; // 目标节点 ID
        type?: string;  // 关系类型（例如“依赖”）
        weight?: number;// 边的权重
    }

    interface GraphData {
        nodes: NoteNode[];
        edges: NoteEdge[];
    }
    ```

### 1.4 导出 (Export)

#### `IExporter`
保存图数据以供前端使用。

*   **函数**: `exportToJSON(graph: DirectedGraph, outputPath: string): Promise<void>`
*   **过滤导出 (前端)**:
    *   导出现在的 JSON 包含过滤后的节点以及连接它们的边。
    *   结构: `{ nodes: NoteNode[], edges: NoteEdge[] }`。

---

## 2. 前端接口 (Frontend Interfaces)

### 2.1 可视化 (Visualization)

#### `GraphRenderer` (JavaScript Module)
将 JSON 数据渲染为交互式 DAG。

*   **输入**: `graph.json` (结构匹配 `DirectedGraph`)
*   **功能**:
    *   **布局模式 (v0.4.0)**:
        *   **力导向 (Force Directed)**: 标准的基于物理的布局。
        *   **DAG (层级)**: Sugiyama 风格的分层布局，使用 `rank` 作为 Y 坐标，并使用弯曲的贝塞尔线绘制边。
    *   **Zoom/Pan**: D3 缩放行为。
    *   **Tooltip**: 悬停时显示节点详情。
    *   **专注模式 (Focus Mode - v0.6.2)**:
        *   **函数**: `enterFocusMode(node)` / `exitFocusMode()`
        *   **描述**: 隔离一个节点及其直接上下文。
        *   **布局**:
            *   **焦点节点**: 居中。
            *   **上级**: 出度邻居，置于上层。相对高度基于分数。
            *   **下级**: 入度邻居，置于下层。相对高度基于分数。
        *   **排序**: 层内节点按专注分数（边权重 + 度数比）排序。
        *   **标签**: 基于垂直偏移交错（上方/下方）以防止重叠。
    *   **设置 (Settings - v0.7.0)**:
        *   **接口**: `SettingsManager` (前端)
        *   **持久化**: `localStorage('nc_settings')`
        *   **可配置项**:
            *   **物理**: 排斥力、连接距离、碰撞半径。
            *   **视觉**: 边透明度。
    *   **渲染模式 (v0.8.7)**:
        *   **SVG**: 默认 D3 实现，用于交互和样式。
        *   **Canvas**: 高性能光栅渲染，适用于大数据集 (>2000 节点)。支持缩放/平移。
    *   **专注模式增强 (v0.8.7)**:
        *   **动态间距**: 用户可通过 UI 滑块调整 `layerGap` (50px - 500px)。
    *   **专注模式增强 (v0.8.8)**:
        *   **水平间距**: 用户可通过 UI 滑块调整 `hSpacing` (20px - 300px)。
    *   **专注模式增强 (v0.8.9)**:
        *   **位置锁定**: 专注模式下的节点在拖动后保留其位置（选中冻结），以防止布局漂移。
    *   **模拟控制 (v0.9.0)**:
        *   **冻结布局**: 用于完全停止物理模拟的复选框。允许手动定位而不回弹。
        *   **速度 (阻尼)**: 滑块 (0-1) 用于控制 `velocityDecay`。较高值 = 更多摩擦（移动更慢）。
        *   **悬停锁定**: 悬停节点时暂时锁定其位置，以防止检查期间的漂移。
    *   **移动端优化 (v0.9.2)**:
        *   **响应式布局**: CSS 媒体查询 (`max-width: 768px`) 适配 UI。
            *   **折叠控件**: 主面板变为可切换图标。
            *   **专注栏**: 重新定位到视口底部以便拇指操作。
            *   **设置集成**: 语言选择器移至设置模态框以节省屏幕空间。
        *   **触摸手势**:
            *   **阅读器**: 实现 `touchstart`/`touchmove` 以支持双指捏合缩放 (调整 `fontSize`)。
    *   **交互逻辑 (v0.9.3)**:
        *   **高亮/提示框**: 由 **鼠标悬停 (MouseOver)** (桌面端) 或 **单击 (Single Click)** (移动/桌面端) 触发。
        *   **专注模式**: 由 **双击 (Double Click)** 触发。
    *   **Mermaid 缩放 (v0.9.4)**:
        *   **触发**: 点击阅读器中任何已渲染的 Mermaid 图表。
        *   **界面**: 全屏模态框，具有独立的平移/缩放功能（无限制缩放）。
        *   **退出**: 专用的 '×' 按钮。
    *   **专注模式语义 (v0.9.5)**:
        *   **居中**: 视口自动平移以使焦点节点居中，而不改变其模拟坐标。
        *   **语义标签**:
            *   **入度区域**: 标记为 "Helping to understand" (左/下)。
            *   **出度区域**: 标记为 "Further exploration" (右/上)。
        *   **布局**:
            *   **水平**: 标准的上下流向。
            *   **层级 (L-R)**: 从左到右流向 (入度 -> 选中 -> 出度)。
    *   **分析交互 (v0.9.5)**:
        *   **移动视图**: 小屏幕上可滚动的全宽面板。
        *   **图表同步**: 点击分析表中的行会在主图中高亮显示相应的节点及其边。
    *   **分析面板增强 (v0.9.6)**:
        *   **全屏切换**: 按钮将面板扩展到 100% 高度。
        *   **捏合缩放**: 触摸手势缩放面板内容以提高可读性。
    *   **分析面板移动端交互 (v0.9.9)**:
        *   **滑动操作**: 在触摸设备上上下拖动面板头部（或手柄）以调整面板大小。
        *   **自动吸附**: 拖动至顶部附近时自动吸附至全屏模式。
        *   **拖动手柄**: 移动端可拖动区域的视觉指示器。
    *   **图表检查 (v0.9.10)**:
        *   **点击冻结**: 点击节点会暂停物理模拟 (`simulation.stop()`)，以便稳定地检查连接。
        *   **恢复**: 点击背景会恢复模拟 (`simulation.restart()`)，除非全局启用了“冻结布局”。
    *   **节点统计弹窗 (Node Statistics Popup - v0.9.12)**:
        *   **类型**: 独立浮动窗口 (`#node-stats-popup`)。
        *   **触发**: 单击节点 (专注模式下禁用 v0.9.13)。
        *   **内容**: 显示入度 (红色) 和出度 (蓝色) 计数，以及单独的可滚动入度和出度邻居列表。
        *   **视觉反馈 (v0.9.14)**: 连接的边现在在 SVG 和 Canvas 渲染器中均显式着色 (红/蓝) 并加粗 (2px)。
        *   **交互**: 点击列表中的邻居会导航到该节点 (高亮并更新弹窗)。
        *   **独立性**: 独立于主度数分析面板，允许在不丢失全局上下文的情况下进行重点检查。

    *   **可扩展性默认值 (v0.8.8)**:
        *   **孤立节点**: 默认隐藏。
        *   **边**: 默认隐藏 (透明度 0)，悬停/选择时可见。
        *   **节点大小**: 默认为“度数”。
    *   **Degree Analysis (v0.1.2)**:
        *   **In-degree**: 显示入度（作为先决条件被引用的次数）。
        *   **Out-degree**: 显示出度（引用的先决条件数量）。
        *   **Visual Filters**: 支持单独查看入度或出度连接。
    *   **本地化 (v0.1.9)**: 支持英文 ('en') 和中文 ('zh')。

---

## 3. 独立 DAG 构建器 (Independent DAG Builder - v0.1.1)

本节定义了 v0.1.1 版本中用于独立构建 DAG 的特定接口，不依赖于外部 API。

### 3.1 本地文件加载 (Local File Loading)

#### `ILocalFileLoader`
负责从本地文件系统读取 Markdown 文件。

*   **函数**: `load(dirPath: string): Promise<RawNote[]>`
*   **输入**:
    *   `dirPath` (string): 目标目录路径 (例如 `testconcept/`)。
*   **输出**:
    *   `Promise<RawNote[]>`: 包含文件名和内容的对象数组。
*   **类型定义**:
    ```typescript
    interface RawNote {
        id: string;      // 文件名 (无后缀)
        content: string; // 完整文本内容
    }
    ```

### 3.2 关键词匹配 (Keyword Matching)

#### `IKeywordMatcher`
基于文件名在内容中的出现频率建立连接。

*   **函数**: `findMatches(notes: RawNote[]): DiscoveredEdge[]`
*   **输入**:
    *   `notes` (RawNote[]): 所有加载的笔记。
*   **输出**:
    *   `DiscoveredEdge[]`: 推断出的边列表。
*   **逻辑**:
    *   构建所有 `Note.id` 的字典。
    *   对于每个 `Note A`，扫描其内容以查找其他 `Note B` 的 `id`。
    *   如果找到，创建边 `B -> A` (假设 B 是 A 的基础概念/被提及者)。
*   **类型定义**:
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

*   **函数**: `generateJSON(nodes: RawNote[], edges: DiscoveredEdge[]): GraphData`
*   **输入**:
    *   `nodes`: 原始节点列表。
    *   `edges`: 发现的边列表。
*   **输出**:
    *   `GraphData`: D3 可视化所需的最终对象。
*   **类型定义**:
    ```typescript
    interface D3Node {
        id: string;
        group: number; // 基于聚类或目录
        inDegree: number;  // 入度
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

*   **函数**: `analyze(files: RawFile[], terms: string[]): Matrix`
*   **逻辑**: 计算 $P(A|B)$ 和 $P(B|A)$。
*   **指标**: 不对称性 = $P(Parent|Child) - P(Child|Parent)$。

### 4.2 向量空间 (`VectorSpace`)
使用 TF-IDF 和余弦相似度计算语义相似度。

*   **分词器**: 双语支持（英文单词 + 中文字符）。
*   **函数**: `getSimilar(fileId, topK)`
*   **输出**: 带有分数的相似文件列表。

### 4.3 混合引擎 (`HybridEngine`)
结合统计和向量方法推断有向边。

*   **规则**: 如果满足以下条件，建议边 $A \rightarrow B$：
    1.  $Similarity(A, B) > VectorThreshold$ (内容相关性)
    2.  $P(A|B) - P(B|A) > AsymmetryThreshold$ (方向性：B 暗示 A 语境)

### 5. 移动端构建 (Mobile Build - v0.9.1)

#### `Capacitor Pipeline`
将 Web 项目转换为独立的 Android APK。

*   **组件**: Capacitor 构建系统 / Gradle。
*   **输入**:
    *   `dist/frontend`: 静态 Web 资源 (HTML, CSS, JS)。
    *   `src/frontend/data.js`: 预生成的图数据 (必须在同步前构建)。
*   **输出**: `android/app/build/outputs/apk/debug/app-debug.apk`。
*   **流程**:
    1.  **数据生成**: `ts-node src/index.ts [target]` -> 生成 `data.js`。
    2.  **资源编译**: `npm run build` -> 填充 `dist/frontend`。
    3.  **同步**: `npx cap sync android` -> 将 `dist/frontend` 复制到 `android/app/src/main/assets/public`。
    4.  **原生构建**: `gradlew assembleDebug` -> 编译 APK。


```
# 2025-12-17 v0.1.0

# Interface Document

This document defines the core interfaces for the NoteConnection system, separating backend processing from frontend visualization.

---

## 1. Backend Interfaces

### 1.1 Data Ingestion

#### `IFileLoader`
Responsible for reading raw files from the file system.

*   **Function**: `loadFiles(directory: string): Promise<RawFile[]>`
*   **Input**:
    *   `directory` (string): Absolute path to the concept directory.
*   **Output**:
    *   `Promise<RawFile[]>`: Array of loaded file objects.
*   **Type Definitions**:
    ```typescript
    interface RawFile {
        filepath: string;  // Full path
        filename: string;  // Name with extension
        content: string;   // File body
        modifiedTime: Date; // Last modification time
    }
    ```

### 1.2 Parsing & Extraction

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

### 1.3 Graph Construction

#### `IGraphBuilder`
Constructs the initial graph and infers edges based on strategies.

*   **Function**: `buildGraph(concepts: Concept[]): DirectedGraph`
*   **Input**:
    *   `concepts` (Concept[]): Parsed concepts.
*   **Output**:
    *   `DirectedGraph`: The constructed graph.
*   **Logic**:
    *   **Keyword Matching**: If `Concept A.content` contains `Concept B.title`, create potential edge $B \rightarrow A$ (B is prerequisite for A).
*   **Type Definitions**:
    ```typescript
    interface GraphNode {
        id: string;
        label: string;
        rank?: number; // Topological rank
    }

    interface GraphEdge {
        source: string; // Source Node ID (Prerequisite)
        target: string; // Target Node ID (Derived Concept)
        type: 'explicit' | 'keyword' | 'statistical'; // Edge origin
        weight: number; // Confidence score
    }

    interface DirectedGraph {
        nodes: GraphNode[];
        edges: GraphEdge[];
    }
    ```

### 1.4 Export

#### `IExporter`
Saves the graph for frontend consumption.

*   **Function**: `exportToJSON(graph: DirectedGraph, outputPath: string): Promise<void>`

---

## 2. Frontend Interfaces

### 2.1 Visualization

#### `GraphRenderer` (JavaScript Module)
Renders the JSON data into an interactive DAG.

*   **Input**: `graph.json` (Structure matches `DirectedGraph`)
*   **Features**:
    *   **Sugiyama Layout**: Layered visualization.
    *   **Zoom/Pan**: D3-zoom behavior.
    *   **Tooltip**: Show node details on hover.

---
---

# 接口文档

本文档定义了 NoteConnection 系统核心接口，分离了后端处理与前端可视化。

---

## 1. 后端接口 (Backend Interfaces)

### 1.1 数据摄取 (Data Ingestion)

#### `IFileLoader`
负责从文件系统读取原始文件。

*   **函数**: `loadFiles(directory: string): Promise<RawFile[]>`
*   **输入**:
    *   `directory` (string): 概念目录的绝对路径。
*   **输出**:
    *   `Promise<RawFile[]>`: 加载的文件对象数组。
*   **类型定义**:
    ```typescript
    interface RawFile {
        filepath: string;  // 完整路径
        filename: string;  // 带后缀的文件名
        content: string;   // 文件内容
        modifiedTime: Date; // 最后修改时间
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

### 1.3 图构建 (Graph Construction)

#### `IGraphBuilder`
构建初始图并根据策略推断边。

*   **函数**: `buildGraph(concepts: Concept[]): DirectedGraph`
*   **输入**:
    *   `concepts` (Concept[]): 解析后的概念。
*   **输出**:
    *   `DirectedGraph`: 构建的图。
*   **逻辑**:
    *   **关键词匹配**: 如果 `Concept A.content` 包含 `Concept B.title`，创建潜在边 $B \rightarrow A$ (B 是 A 的先决条件)。
*   **类型定义**:
    ```typescript
    interface GraphNode {
        id: string;
        label: string;
        rank?: number; // 拓扑排名
    }

    interface GraphEdge {
        source: string; // 源节点 ID (先决条件)
        target: string; // 目标节点 ID (派生概念)
        type: 'explicit' | 'keyword' | 'statistical'; // 边来源
        weight: number; // 置信度
    }

    interface DirectedGraph {
        nodes: GraphNode[];
        edges: GraphEdge[];
    }
    ```

### 1.4 导出 (Export)

#### `IExporter`
保存图数据以供前端使用。

*   **函数**: `exportToJSON(graph: DirectedGraph, outputPath: string): Promise<void>`

---

## 2. 前端接口 (Frontend Interfaces)

### 2.1 可视化 (Visualization)

#### `GraphRenderer` (JavaScript Module)
将 JSON 数据渲染为交互式 DAG。

*   **输入**: `graph.json` (结构匹配 `DirectedGraph`)
*   **功能**:
    *   **Sugiyama Layout**: 分层可视化。
    *   **Zoom/Pan**: D3 缩放行为。
    *   **Tooltip**: 悬停时显示节点详情。
    *   **Degree Analysis (v0.1.2)**:
        *   **In-degree**: 显示入度（作为先决条件被引用的次数）。
        *   **Out-degree**: 显示出度（引用的先决条件数量）。
        *   **Visual Filters**: 支持单独查看入度或出度连接。

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


```
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

```
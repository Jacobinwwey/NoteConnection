// src/backend/types.ts

// Interface for Raw File loaded from disk
// 从磁盘加载的原始文件接口
export interface RawFile {
    filepath: string;
    filename: string;
    content: string;
    modifiedTime: Date;
}

// Interface for Parsed Concept
// 解析后的概念接口
export interface Concept {
    id: string;        // ID (filename without ext)
    title: string;     // Title (from filename or header)
    content: string;   // Content
    metadata: {
        tags: string[];
        prerequisites: string[]; // Explicit dependencies
    };
}

// Graph Node
// 图节点
export interface GraphNode {
    id: string;
    label: string;
    rank?: number;
    inDegree?: number;
    outDegree?: number;
    centrality?: number;
    clusterId?: string;
    content?: string;
}

// Graph Edge
// 图边
export interface GraphEdge {
    source: string;
    target: string;
    type: 'explicit' | 'keyword' | 'statistical';
    weight: number;
}

// Directed Graph Structure
// 有向图结构
export interface DirectedGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

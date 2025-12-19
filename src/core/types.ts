/**
 * Node definition in the graph.
 * 图中的节点定义。
 */
export interface NoteNode {
  id: string; // Unique identifier (usually the note title) | 唯一标识符（通常是笔记标题）
  label: string; // Display label | 显示标签
  inDegree: number; // Number of incoming edges | 入度数量
  outDegree: number; // Number of outgoing edges | 出度数量
  content?: string;  // Full text content (v0.1.5)
  x?: number;        // Saved X position | 保存的 X 坐标
  y?: number;        // Saved Y position | 保存的 Y 坐标
  rank?: number;     // Topological rank or hierarchy level | 拓扑排名或层级
  clusterId?: string;// ID of the cluster this node belongs to | 该节点所属的聚类 ID
  metadata?: Record<string, any>; // Additional metadata from frontmatter | 来自 frontmatter 的额外元数据
}

/**
 * Edge definition in the graph.
 * 图中的边定义。
 */
export interface NoteEdge {
  source: string; // Source node ID | 源节点 ID
  target: string; // Target node ID | 目标节点 ID
  type?: string; // Type of relationship (e.g., "prerequisite", "related") | 关系类型（例如“先决条件”，“相关”）
  weight?: number; // Weight of the edge (default 1) | 边的权重（默认为 1）
}

/**
 * Graph data structure interface.
 * 图数据结构接口。
 */
export interface GraphData {
  nodes: NoteNode[];
  edges: NoteEdge[];
}

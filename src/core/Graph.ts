import { NoteNode, NoteEdge, GraphData } from './types';

/**
 * Directed Graph implementation for managing notes and dependencies.
 * 用于管理笔记和依赖关系的有向图实现。
 */
export class Graph {
  private nodes: Map<string, NoteNode>;
  private adjacencyList: Map<string, NoteEdge[]>;
  private reverseAdjacencyList: Map<string, NoteEdge[]>; // For efficient incoming edge lookups | 用于高效的入边查找

  constructor() {
    this.nodes = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
  }

  /**
   * Adds a node to the graph.
   * 向图中添加一个节点。
   * @param node The node to add | 要添加的节点
   */
  addNode(node: NoteNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, { ...node, inDegree: 0, outDegree: 0 });
      this.adjacencyList.set(node.id, []);
      this.reverseAdjacencyList.set(node.id, []);
    }
  }

  /**
   * Retrieves a node by its ID.
   * 通过 ID 获取节点。
   * @param id The node ID | 节点 ID
   * @returns The node or undefined if not found | 节点，如果未找到则返回 undefined
   */
  getNode(id: string): NoteNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Checks if a node exists in the graph.
   * 检查图中是否存在该节点。
   * @param id The node ID | 节点 ID
   */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Adds a directed edge between two nodes.
   * 在两个节点之间添加有向边。
   * @param source Source node ID | 源节点 ID
   * @param target Target node ID | 目标节点 ID
   * @param type Relationship type | 关系类型
   * @param weight Edge weight (confidence) | 边权重 (置信度)
   */
  addEdge(source: string, target: string, type: string = 'dependency', weight: number = 1): void {
    if (!this.nodes.has(source)) {
      this.addNode({ id: source, label: source, inDegree: 0, outDegree: 0 });
    }
    if (!this.nodes.has(target)) {
      this.addNode({ id: target, label: target, inDegree: 0, outDegree: 0 });
    }

    const edge: NoteEdge = { source, target, type, weight };
    
    // Add to adjacency list (outgoing)
    const outgoing = this.adjacencyList.get(source) || [];
    // Prevent duplicate edges
    if (!outgoing.some(e => e.target === target && e.type === type)) {
      outgoing.push(edge);
      this.adjacencyList.set(source, outgoing);
      
      // Update out-degree
      const sourceNode = this.nodes.get(source)!;
      sourceNode.outDegree++;
    }

    // Add to reverse adjacency list (incoming)
    const incoming = this.reverseAdjacencyList.get(target) || [];
    if (!incoming.some(e => e.source === source && e.type === type)) {
      incoming.push(edge);
      this.reverseAdjacencyList.set(target, incoming);

      // Update in-degree
      const targetNode = this.nodes.get(target)!;
      targetNode.inDegree++;
    }
  }

  /**
   * Gets all outgoing edges from a node.
   * 获取节点的所有出边。
   * @param id Node ID | 节点 ID
   */
  getOutgoingEdges(id: string): NoteEdge[] {
    return this.adjacencyList.get(id) || [];
  }

  /**
   * Gets all outgoing neighbor IDs for a node.
   * 获取节点的所有出度邻居 ID。
   * @param id Node ID | 节点 ID
   */
  getNeighbors(id: string): string[] {
      return (this.adjacencyList.get(id) || []).map(edge => edge.target);
  }

  /**
   * Gets all nodes in the graph.
   * 获取图中的所有节点。
   */
  getNodes(): NoteNode[] {
      return Array.from(this.nodes.values());
  }

  /**
   * Gets all edges in the graph.
   * 获取图中的所有边。
   */
  getEdges(): NoteEdge[] {
      return Array.from(this.adjacencyList.values()).flat();
  }

  /**
   * Gets all incoming edges to a node.
   * 获取节点的所有入边。
   * @param id Node ID | 节点 ID
   */
  getIncomingEdges(id: string): NoteEdge[] {
    return this.reverseAdjacencyList.get(id) || [];
  }

  /**
   * Returns the graph data in a serializable format.
   * 以可序列化的格式返回图数据。
   */
  toJSON(): GraphData {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.adjacencyList.values()).flat()
    };
  }

  /**
   * Gets all predecessor nodes (transitive closure of incoming edges).
   * 获取所有前驱节点（入边的传递闭包）。
   * @param id Target node ID
   */
  getPredecessors(id: string): Set<string> {
    const predecessors = new Set<string>();
    const queue = [id];
    const visited = new Set<string>();
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const incoming = this.getIncomingEdges(current);
      
      for (const edge of incoming) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          predecessors.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    return predecessors;
  }

  /**
   * Gets all successor nodes (transitive closure of outgoing edges).
   * 获取所有后继节点（出边的传递闭包）。
   * @param id Source node ID
   */
  getSuccessors(id: string): Set<string> {
    const successors = new Set<string>();
    const queue = [id];
    const visited = new Set<string>();
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const outgoing = this.getOutgoingEdges(current);
      
      for (const edge of outgoing) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          successors.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    return successors;
  }

  /**
   * Calculates the shortest path between two nodes (unweighted BFS).
   * 计算两个节点之间的最短路径 (无权 BFS)。
   * @param source Source node ID
   * @param target Target node ID
   * @returns Array of node IDs representing the path, or empty if no path found
   */
  getShortestPath(source: string, target: string): string[] {
    if (source === target) return [source];
    
    const queue = [source];
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    visited.add(source);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === target) break;

      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    if (!visited.has(target)) return [];

    // Reconstruct path
    const path = [target];
    let curr = target;
    while (curr !== source) {
      curr = parent.get(curr)!;
      path.unshift(curr);
    }
    return path;
  }
}

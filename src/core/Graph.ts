import { NoteNode, NoteEdge, GraphData } from './types';
import { normalizeResourceReference } from './ResourceReference';

/**
 * Directed Graph implementation for managing notes and dependencies.
 * 用于管理笔记和依赖关系的有向图实现。
 */
export class Graph {
  private nodes: Map<string, NoteNode>;
  private adjacencyList: Map<string, NoteEdge[]>;
  private aliases: Map<string, string>;
  private reverseAdjacencyList: Map<string, NoteEdge[]>; // For efficient incoming edge lookups | 用于高效的入边查找

  constructor() {
    this.nodes = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.aliases = new Map();
  }

  /**
   * Adds a node to the graph.
   * 向图中添加一个节点。
   * @param node The node to add | 要添加的节点
   */
  addNode(node: NoteNode): void {
    if (this.nodes.has(node.id)) {
      return;
    }

    const aliases = [node.id, node.sourceUri, ...(node.identityAliases ?? [])]
      .filter((alias): alias is string => typeof alias === 'string' && alias.length > 0);
    const normalizedAliases = new Set(aliases.map(alias => normalizeResourceReference(alias)));
    normalizedAliases.forEach(alias => {
      const existingNodeId = this.aliases.get(alias);
      if (existingNodeId && existingNodeId !== node.id) {
        throw new Error(
          `Resource identity alias collision: "${alias}" is claimed by both "${existingNodeId}" and "${node.id}"`,
        );
      }
    });

    this.nodes.set(node.id, { ...node, inDegree: 0, outDegree: 0 });
    this.adjacencyList.set(node.id, []);
    this.reverseAdjacencyList.set(node.id, []);
    normalizedAliases.forEach(alias => {
      this.aliases.set(alias, node.id);
    });
  }

  private resolveNodeId(reference: string): string | undefined {
    if (this.nodes.has(reference)) {
      return reference;
    }
    return this.aliases.get(normalizeResourceReference(reference));
  }

  /**
   * Retrieves a node by its ID.
   * 通过 ID 获取节点。
   * @param id The node ID | 节点 ID
   * @returns The node or undefined if not found | 节点，如果未找到则返回 undefined
   */
  getNode(reference: string): NoteNode | undefined {
    const nodeId = this.resolveNodeId(reference);
    return nodeId ? this.nodes.get(nodeId) : undefined;
  }

  /**
   * Checks if a node exists in the graph.
   * 检查图中是否存在该节点。
   * @param id The node ID | 节点 ID
   */
  hasNode(reference: string): boolean {
    return this.resolveNodeId(reference) !== undefined;
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
    const sourceId = this.resolveNodeId(source) ?? source;
    const targetId = this.resolveNodeId(target) ?? target;

    if (!this.nodes.has(sourceId)) {
      this.addNode({ id: sourceId, label: sourceId, inDegree: 0, outDegree: 0 });
    }
    if (!this.nodes.has(targetId)) {
      this.addNode({ id: targetId, label: targetId, inDegree: 0, outDegree: 0 });
    }

    const edge: NoteEdge = { source: sourceId, target: targetId, type, weight };
    
    // Add to adjacency list (outgoing)
    const outgoing = this.adjacencyList.get(sourceId) || [];
    // Prevent duplicate edges
    if (!outgoing.some(e => e.target === targetId && e.type === type)) {
      outgoing.push(edge);
      this.adjacencyList.set(sourceId, outgoing);
      
      // Update out-degree
      const sourceNode = this.nodes.get(sourceId)!;
      sourceNode.outDegree++;
    }

    // Add to reverse adjacency list (incoming)
    const incoming = this.reverseAdjacencyList.get(targetId) || [];
    if (!incoming.some(e => e.source === sourceId && e.type === type)) {
      incoming.push(edge);
      this.reverseAdjacencyList.set(targetId, incoming);

      // Update in-degree
      const targetNode = this.nodes.get(targetId)!;
      targetNode.inDegree++;
    }
  }

  /**
   * Gets all outgoing edges from a node.
   * 获取节点的所有出边。
   * @param id Node ID | 节点 ID
   */
  getOutgoingEdges(reference: string): NoteEdge[] {
    const nodeId = this.resolveNodeId(reference);
    return nodeId ? (this.adjacencyList.get(nodeId) || []) : [];
  }

  /**
   * Gets all outgoing neighbor IDs for a node.
   * 获取节点的所有出度邻居 ID。
   * @param id Node ID | 节点 ID
   */
  getNeighbors(reference: string): string[] {
      return this.getOutgoingEdges(reference).map(edge => edge.target);
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
  getIncomingEdges(reference: string): NoteEdge[] {
    const nodeId = this.resolveNodeId(reference);
    return nodeId ? (this.reverseAdjacencyList.get(nodeId) || []) : [];
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
  getPredecessors(reference: string): Set<string> {
    const predecessors = new Set<string>();
    const nodeId = this.resolveNodeId(reference);
    if (!nodeId) return predecessors;
    const queue = [nodeId];
    const visited = new Set<string>();
    visited.add(nodeId);

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
  getSuccessors(reference: string): Set<string> {
    const successors = new Set<string>();
    const nodeId = this.resolveNodeId(reference);
    if (!nodeId) return successors;
    const queue = [nodeId];
    const visited = new Set<string>();
    visited.add(nodeId);

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
    const sourceId = this.resolveNodeId(source);
    const targetId = this.resolveNodeId(target);
    if (!sourceId || !targetId) return [];
    if (sourceId === targetId) return [sourceId];
    
    const queue = [sourceId];
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    visited.add(sourceId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) break;

      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    if (!visited.has(targetId)) return [];

    // Reconstruct path
    const path = [targetId];
    let curr = targetId;
    while (curr !== sourceId) {
      curr = parent.get(curr)!;
      path.unshift(curr);
    }
    return path;
  }
}

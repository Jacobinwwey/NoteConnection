import { Graph } from './Graph';
import { NoteNode, NoteEdge } from './types';

export interface LearningNode extends NoteNode {
  stepOrder: number;
  isCompleted: boolean;
  unlocks: string[];
}

export interface PathResult {
  nodes: LearningNode[];
  edges: NoteEdge[];
  strategy: 'foundational' | 'core';
  coverage: number; // Percentage of requested nodes covered
}

export type LearningStrategy = 'foundational' | 'core';

export class PathEngine {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  /**
   * Domain Learning: Extracts an efficient learning path for a set of nodes (or all nodes).
   * 领域学习：为一组节点（或所有节点）提取高效的学习路径。
   * @param nodeIds Specific nodes to learn (optional, defaults to all)
   * @param strategy prioritization strategy
   */
  domainLearning(nodeIds: string[] | null, strategy: LearningStrategy): PathResult {
    const targetNodes = nodeIds ? new Set(nodeIds) : new Set(this.graph.getNodes().map(n => n.id));
    
    // For Domain Learning, we want to learn *everything* in the set.
    // We strictly respect dependencies within the graph.
    // If a node in the set depends on a node OUTSIDE the set, we assume the outside node is already known 
    // OR we must add it. Requirement implies "user-defined domain", so usually we strictly stay inside or include prereqs.
    // Let's assume we need to be strictly self-contained or include necessary prerequisites.
    // Safe bet: Extract subgraph of targetNodes + all their ancestors to ensure validity.
    
    const relevantNodes = this.expandToIncludePrerequisites(targetNodes);
    return this.generateLearningPath(relevantNodes, strategy);
  }

  /**
   * Diffusion Learning: Extracts shortest learning path to a specific target node.
   * 扩散学习：提取通往特定目标节点的最短学习路径。
   * @param targetId Target node ID
   * @param strategy prioritization strategy for tie-breaking
   */
  diffusionLearning(targetId: string, strategy: LearningStrategy): PathResult {
    if (!this.graph.hasNode(targetId)) {
      throw new Error(`Node ${targetId} not found in graph`);
    }

    // 1. Identify all ancestors (prerequisites)
    const ancestors = this.graph.getPredecessors(targetId);
    ancestors.add(targetId);

    // 2. Generate path for this subset
    return this.generateLearningPath(ancestors, strategy);
  }

  /**
   * Core generation logic using Priority-Queue Topological Sort.
   */
  private generateLearningPath(nodesOfInterest: Set<string>, strategy: LearningStrategy): PathResult {
    const nodes = Array.from(nodesOfInterest).map(id => this.graph.getNode(id)!);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Build local in-degrees for the subgraph
    const localInDegree = new Map<string, number>();
    const localAdjacency = new Map<string, string[]>();

    nodes.forEach(node => {
        localInDegree.set(node.id, 0);
        localAdjacency.set(node.id, []);
    });

    // Populate edges restricted to the subgraph
    const relevantEdges: NoteEdge[] = [];
    nodes.forEach(node => {
        const outgoing = this.graph.getOutgoingEdges(node.id);
        outgoing.forEach(edge => {
            if (nodesOfInterest.has(edge.target)) {
                localAdjacency.get(node.id)!.push(edge.target);
                localInDegree.set(edge.target, (localInDegree.get(edge.target) || 0) + 1);
                relevantEdges.push(edge);
            }
        });
    });

    // Initialize queue with nodes having 0 in-degree (within subgraph)
    let available: string[] = [];
    nodes.forEach(node => {
        if (localInDegree.get(node.id) === 0) {
            available.push(node.id);
        }
    });

    const learnedPath: LearningNode[] = [];
    const visited = new Set<string>();
    let step = 1;

    // Helper to process a node and unlock neighbors
    const processNode = (currentId: string) => {
        visited.add(currentId);
        const currentNode = nodeMap.get(currentId)!;

        // Add to path
        learnedPath.push({
            ...currentNode,
            stepOrder: step++,
            isCompleted: false,
            unlocks: localAdjacency.get(currentId)!
        });

        // "Unlock" neighbors
        const neighbors = localAdjacency.get(currentId)!;
        neighbors.forEach(neighborId => {
            // Only decrement if neighbor not visited (avoid double counting in cycles)
            if (!visited.has(neighborId)) {
                const newDegree = (localInDegree.get(neighborId) || 0) - 1;
                localInDegree.set(neighborId, newDegree);
                if (newDegree === 0) {
                    available.push(neighborId);
                }
            }
        });
    };

    while (learnedPath.length < nodes.length) {
        if (available.length > 0) {
            // Normal Topological Sort Step
            available.sort((a, b) => this.compareNodes(a, b, strategy));
            const currentId = available.shift()!;
            processNode(currentId);
        } else {
            // Cycle Detected: No 0-in-degree nodes available
            // Strategy: Break cycle by picking the "best" remaining node (lowest in-degree, then strategy score)
            
            // Find remaining nodes
            const remainingIds: string[] = [];
            nodes.forEach(n => {
                if (!visited.has(n.id)) remainingIds.push(n.id);
            });
            
            if (remainingIds.length === 0) break; // Should not happen given outer loop condition
            
            // Sort by In-Degree (Ascending) -> Strategy (Desc)
            remainingIds.sort((a, b) => {
                const degA = localInDegree.get(a) || 0;
                const degB = localInDegree.get(b) || 0;
                if (degA !== degB) return degA - degB;
                return this.compareNodes(a, b, strategy);
            });
            
            const forceId = remainingIds[0];
            // console.warn(`PathEngine: Breaking cycle at ${forceId} (In-Degree: ${localInDegree.get(forceId)})`);
            processNode(forceId);
        }
    }

    return {
        nodes: learnedPath,
        edges: relevantEdges,
        strategy,
        coverage: learnedPath.length / nodes.length
    };
  }

  /**
   * Helper to ensure valid learning set (closure of predecessors).
   */
  private expandToIncludePrerequisites(initialNodes: Set<string>): Set<string> {
      const result = new Set(initialNodes);
      let changed = true;
      
      // Iteratively add parents until stable
      // Optimally we just merge getPredecessors for all nodes
      // But getPredecessors returns full closure, so we only need to do it once per node.
      for (const nodeId of initialNodes) {
          const preds = this.graph.getPredecessors(nodeId);
          preds.forEach(p => result.add(p));
      }
      return result;
  }

  /**
   * Strategy Comparator
   * Returns negative if A is better than B (for sorting A before B).
   */
  private compareNodes(idA: string, idB: string, strategy: LearningStrategy): number {
      const nodeA = this.graph.getNode(idA)!;
      const nodeB = this.graph.getNode(idB)!;

      // Primary Metric: Strategy Score
      const scoreA = this.calculateScore(nodeA, strategy);
      const scoreB = this.calculateScore(nodeB, strategy);

      if (scoreA !== scoreB) {
          return scoreB - scoreA; // Higher score first
      }

      // Tie-breaker: ID (stable sort)
      return idA.localeCompare(idB); 
  }

  private calculateScore(node: NoteNode, strategy: LearningStrategy): number {
      // Avoid division by zero
      const safeInDegree = node.inDegree + 1;

      if (strategy === 'foundational') {
          // Foundational: Low In-Degree (Global), High Out-Degree (Global)
          // "Low in-degree yet highly correlated with other required nodes (out-degree)"
          // Score = OutDegree / InDegree
          return (node.outDegree + 0.1) / safeInDegree;
      } else {
          // Core: High Centrality, Low In-Degree (in learning set context)
          // Note: In-degree in context is already 0 (since they are in 'available' list).
          // So we use Global Centrality as the main differentiator.
          // "Highly correlated (Centrality) ... low in-degree (Global)"
          return (node.centrality || 0) * 10 - node.inDegree; 
      }
  }
}

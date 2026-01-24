
/* Auto-bundled Path Core */
(function() {
    
var exports = {};
var module = { exports: exports };
// Global scope exposure
// var Graph, PathEngine; // Removed to avoid syntax error with class declaration

    
    /* Graph.js */
    "use strict";


/**
 * Directed Graph implementation for managing notes and dependencies.
 * 用于管理笔记和依赖关系的有向图实现。
 */
class Graph {
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
    addNode(node) {
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
    getNode(id) {
        return this.nodes.get(id);
    }
    /**
     * Checks if a node exists in the graph.
     * 检查图中是否存在该节点。
     * @param id The node ID | 节点 ID
     */
    hasNode(id) {
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
    addEdge(source, target, type = 'dependency', weight = 1) {
        if (!this.nodes.has(source)) {
            this.addNode({ id: source, label: source, inDegree: 0, outDegree: 0 });
        }
        if (!this.nodes.has(target)) {
            this.addNode({ id: target, label: target, inDegree: 0, outDegree: 0 });
        }
        const edge = { source, target, type, weight };
        // Add to adjacency list (outgoing)
        const outgoing = this.adjacencyList.get(source) || [];
        // Prevent duplicate edges
        if (!outgoing.some(e => e.target === target && e.type === type)) {
            outgoing.push(edge);
            this.adjacencyList.set(source, outgoing);
            // Update out-degree
            const sourceNode = this.nodes.get(source);
            sourceNode.outDegree++;
        }
        // Add to reverse adjacency list (incoming)
        const incoming = this.reverseAdjacencyList.get(target) || [];
        if (!incoming.some(e => e.source === source && e.type === type)) {
            incoming.push(edge);
            this.reverseAdjacencyList.set(target, incoming);
            // Update in-degree
            const targetNode = this.nodes.get(target);
            targetNode.inDegree++;
        }
    }
    /**
     * Gets all outgoing edges from a node.
     * 获取节点的所有出边。
     * @param id Node ID | 节点 ID
     */
    getOutgoingEdges(id) {
        return this.adjacencyList.get(id) || [];
    }
    /**
     * Gets all outgoing neighbor IDs for a node.
     * 获取节点的所有出度邻居 ID。
     * @param id Node ID | 节点 ID
     */
    getNeighbors(id) {
        return (this.adjacencyList.get(id) || []).map(edge => edge.target);
    }
    /**
     * Gets all nodes in the graph.
     * 获取图中的所有节点。
     */
    getNodes() {
        return Array.from(this.nodes.values());
    }
    /**
     * Gets all edges in the graph.
     * 获取图中的所有边。
     */
    getEdges() {
        return Array.from(this.adjacencyList.values()).flat();
    }
    /**
     * Gets all incoming edges to a node.
     * 获取节点的所有入边。
     * @param id Node ID | 节点 ID
     */
    getIncomingEdges(id) {
        return this.reverseAdjacencyList.get(id) || [];
    }
    /**
     * Returns the graph data in a serializable format.
     * 以可序列化的格式返回图数据。
     */
    toJSON() {
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
    getPredecessors(id) {
        const predecessors = new Set();
        const queue = [id];
        const visited = new Set();
        visited.add(id);
        while (queue.length > 0) {
            const current = queue.shift();
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
    getSuccessors(id) {
        const successors = new Set();
        const queue = [id];
        const visited = new Set();
        visited.add(id);
        while (queue.length > 0) {
            const current = queue.shift();
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
    getShortestPath(source, target) {
        if (source === target)
            return [source];
        const queue = [source];
        const visited = new Set();
        const parent = new Map();
        visited.add(source);
        while (queue.length > 0) {
            const current = queue.shift();
            if (current === target)
                break;
            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    parent.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        }
        if (!visited.has(target))
            return [];
        // Reconstruct path
        const path = [target];
        let curr = target;
        while (curr !== source) {
            curr = parent.get(curr);
            path.unshift(curr);
        }
        return path;
    }
}
Graph = Graph;

    // Explicitly expose
    self.Graph = Graph;
    
    /* PathEngine.js */
    "use strict";


class PathEngine {
    constructor(graph) {
        this.graph = graph;
    }
    /**
     * Domain Learning: Extracts an efficient learning path for a set of nodes (or all nodes).
     * 领域学习：为一组节点（或所有节点）提取高效的学习路径。
     * @param nodeIds Specific nodes to learn (optional, defaults to all)
     * @param strategy prioritization strategy
     */
    domainLearning(nodeIds, strategy) {
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
    diffusionLearning(targetId, strategy) {
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
    generateLearningPath(nodesOfInterest, strategy) {
        const nodes = Array.from(nodesOfInterest).map(id => this.graph.getNode(id));
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        
        // Build local in-degrees for the subgraph
        const localInDegree = new Map();
        const localAdjacency = new Map();
        nodes.forEach(node => {
            localInDegree.set(node.id, 0);
            localAdjacency.set(node.id, []);
        });

        // Populate edges restricted to the subgraph
        const relevantEdges = [];
        nodes.forEach(node => {
            const outgoing = this.graph.getOutgoingEdges(node.id);
            outgoing.forEach(edge => {
                if (nodesOfInterest.has(edge.target)) {
                    localAdjacency.get(node.id).push(edge.target);
                    localInDegree.set(edge.target, (localInDegree.get(edge.target) || 0) + 1);
                    relevantEdges.push(edge);
                }
            });
        });

        // Initialize queue with nodes having 0 in-degree (within subgraph)
        let available = [];
        nodes.forEach(node => {
            if (localInDegree.get(node.id) === 0) {
                available.push(node.id);
            }
        });

        const learnedPath = [];
        const visited = new Set();
        let step = 1;

        // Helper to process a node and unlock neighbors
        const processNode = (currentId) => {
            visited.add(currentId);
            const currentNode = nodeMap.get(currentId);

            // Add to path
            learnedPath.push({
                ...currentNode,
                stepOrder: step++,
                isCompleted: false,
                unlocks: localAdjacency.get(currentId)
            });

            // "Unlock" neighbors
            const neighbors = localAdjacency.get(currentId);
            neighbors.forEach(neighborId => {
                // Only decrement if neighbor not visited
                if (!visited.has(neighborId)) {
                    const newDegree = (localInDegree.get(neighborId) || 0) - 1;
                    localInDegree.set(neighborId, newDegree);
                    if (newDegree <= 0) {
                        if (!available.includes(neighborId)) {
                            available.push(neighborId);
                        }
                    }
                }
            });
        };

        while (learnedPath.length < nodes.length) {
            if (available.length > 0) {
                // Normal Topological Sort Step
                available.sort((a, b) => this.compareNodes(a, b, strategy));
                const currentId = available.shift();
                if (!visited.has(currentId)) {
                    processNode(currentId);
                }
            } else {
                // Cycle Detected: Find best remaining node to break cycle
                const remainingIds = [];
                nodes.forEach(n => {
                    if (!visited.has(n.id)) remainingIds.push(n.id);
                });
                
                if (remainingIds.length === 0) break; 
                
                // Sort by In-Degree (Ascending) -> Strategy (Desc)
                remainingIds.sort((a, b) => {
                    const degA = localInDegree.get(a) || 0;
                    const degB = localInDegree.get(b) || 0;
                    if (degA !== degB) return degA - degB;
                    return this.compareNodes(a, b, strategy);
                });
                
                const forceId = remainingIds[0];
                localInDegree.set(forceId, 0); // Force unlock
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
    expandToIncludePrerequisites(initialNodes) {
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
    compareNodes(idA, idB, strategy) {
        const nodeA = this.graph.getNode(idA);
        const nodeB = this.graph.getNode(idB);
        // Primary Metric: Strategy Score
        const scoreA = this.calculateScore(nodeA, strategy);
        const scoreB = this.calculateScore(nodeB, strategy);
        if (scoreA !== scoreB) {
            return scoreB - scoreA; // Higher score first
        }
        // Tie-breaker: ID (stable sort)
        return idA.localeCompare(idB);
    }
    calculateScore(node, strategy) {
        // Avoid division by zero
        const safeInDegree = node.inDegree + 1;
        if (strategy === 'foundational') {
            // Foundational: Low In-Degree (Global), High Out-Degree (Global)
            // "Low in-degree yet highly correlated with other required nodes (out-degree)"
            // Score = OutDegree / InDegree
            return (node.outDegree + 0.1) / safeInDegree;
        }
        else {
            // Core: High Centrality, Low In-Degree (in learning set context)
            // Note: In-degree in context is already 0 (since they are in 'available' list).
            // So we use Global Centrality as the main differentiator.
            // "Highly correlated (Centrality) ... low in-degree (Global)"
            return (node.centrality || 0) * 10 - node.inDegree;
        }
    }
}
PathEngine = PathEngine;

    // Explicitly expose
    self.PathEngine = PathEngine;
    
})();

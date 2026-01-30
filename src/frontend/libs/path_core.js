
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
     * Adaptive Diffusion Learning: Shortest Path from Frontier to Target
     * 自适应扩散学习：从前沿到目标的最短路径
     * @param targetId Final goal node
     * @param strategy 'foundational' or 'core'
     * @param completedSet Set of completed node IDs
     * @param forcedExpansionSet Set of node IDs to expand prerequisites for
     */
    diffusionLearning(targetId, strategy, completedSet = new Set(), forcedExpansionSet = new Set()) {
        const targetNode = this.graph.getNode(targetId);
        if (!targetNode) return { nodes: [], edges: [], coverage: 0 };

        // 1. Backward Traversal: Get true ancestors (dependencies)
        // 1. 反向遍历：获取真正的祖先（依赖项）
        const ancestors = this.getAncestors(targetId);
        
        // 2. Identify Unlearned Subgraph
        // 2. 识别未学习子图
        // Note: Target itself is part of unlearned if not complete
        const unlearned = ancestors.filter(id => !completedSet.has(id));
        if (!completedSet.has(targetId) && !unlearned.includes(targetId)) {
            unlearned.push(targetId);
        }

        if (unlearned.length === 0) {
            // Already mastered everything! Return empty or just target
            return { nodes: [targetNode], edges: [], coverage: 1.0 };
        }

        // 3. Identify Frontier Nodes (Roots of unlearned subgraph)
        // 3. 识别前沿节点（未学习子图的根）
        // Frontier = nodes in unlearned set where ALL prerequisites are either completed or non-existent
        const frontier = unlearned.filter(id => {
            const incoming = this.graph.getIncomingEdges(id);
            // Check if all prerequisites are satisfied (completed)
            return incoming.every(edge => completedSet.has(edge.source));
        });

        // 4. Shortest Path Calculation (BFS)
        // 4. 最短路径计算 (BFS)
        // Find shortest path from ANY frontier node to the target
        let bestPath = null;

        // Optimization: Run one BFS from Target BACKWARDS to find nearest frontier?
        // Actually BFS from filtered graph (unlearned only) is safer.
        
        // Build adjacency for unlearned subgraph (reverse edges for backward search from target)
        const reverseAdj = new Map();
        unlearned.forEach(id => reverseAdj.set(id, []));
        
        unlearned.forEach(id => {
            const incoming = this.graph.getIncomingEdges(id);
            incoming.forEach(edge => {
                if (unlearned.includes(edge.source)) {
                    // Edge source -> id. In reverse: id -> source
                    if (!reverseAdj.has(id)) reverseAdj.set(id, []);
                    reverseAdj.get(id).push(edge.source);
                }
            });
        });

        // BFS from Target to find nearest Frontier
        const queue = [[targetId]];
        const visited = new Set([targetId]);
        
        while (queue.length > 0) {
            const currentPath = queue.shift();
            const head = currentPath[currentPath.length - 1];
            
            if (frontier.includes(head)) {
                // Found a path to a frontier!
                // Reverse it to get Frontier -> Target
                bestPath = currentPath.reverse();
                break;
            }
            
            const neighbors = reverseAdj.get(head) || [];
            neighbors.sort((a, b) => this.compareNodes(a, b, strategy));

            for (const next of neighbors) {
                if (!visited.has(next)) {
                    visited.add(next);
                    queue.push([...currentPath, next]);
                }
            }
        }

        // Fallback: If disconnected (shouldn't happen in valid DAG), just show unlearned
        let finalPathNodes = bestPath ? bestPath.map(id => this.graph.getNode(id)) : unlearned.map(id => this.graph.getNode(id));

        // --- Forced Expansion Logic ---
        // If a node in the path is in forcedExpansionSet, we must include its IMMEDIATE unlearned prerequisites
        // and link them up to the frontier if possible? 
        // Or simply just add them to the view.
        // Let's iterate and add immediate unlearned predecessors.
        
        const nodesToAdd = new Set();
        const currentPathIds = new Set(finalPathNodes.map(n => n.id));
        
        currentPathIds.forEach(id => {
            if (forcedExpansionSet.has(id)) {
                // Get all unlearned prerequisites
                const incoming = this.graph.getIncomingEdges(id);
                incoming.forEach(edge => {
                    const prereqId = edge.source;
                    if (!completedSet.has(prereqId) && !currentPathIds.has(prereqId)) {
                        nodesToAdd.add(prereqId);
                    }
                });
            }
        });

        // Add the forced nodes to the result
        if (nodesToAdd.size > 0) {
            nodesToAdd.forEach(id => {
                const node = this.graph.getNode(id);
                if (node) finalPathNodes.push(node);
            });
        }
        
        // Update PathSet for Hidden Prereq Check
        const pathSet = new Set(finalPathNodes.map(n => n.id));

        // Mark critical path (original shortest path) and check for hidden prerequisites
        finalPathNodes = finalPathNodes.map(n => {
            const isOriginalPath = bestPath ? bestPath.includes(n.id) : true;
            const newNode = { ...n, isCritical: isOriginalPath };
            
            // Check for hidden unlearned prerequisites
            const incoming = this.graph.getIncomingEdges(n.id);
            const hasHidden = incoming.some(edge => 
                !completedSet.has(edge.source) && // It is unlearned
                !pathSet.has(edge.source)         // It is NOT in our current visible path
            );
            
            if (hasHidden) {
                newNode.hasHiddenPrereqs = true;
            }
            // If it was forced expanded, maybe mark as expanded?
            if (forcedExpansionSet.has(n.id)) {
                newNode.isExpanded = true;
            }
            
            return newNode;
        });

        return {
            nodes: finalPathNodes,
            edges: this.getRelevantEdges(finalPathNodes),
            strategy: strategy,
            coverage: finalPathNodes.length / unlearned.length
        };
    }

    /**
     * Get all ancestors (transitive prerequisites) of a node
     */
    getAncestors(startId, visited = new Set()) {
        if (visited.has(startId)) return [];
        visited.add(startId);
        
        const ancestors = [];
        const queue = [startId];
        const result = new Set();
        
        while (queue.length > 0) {
            const current = queue.shift();
            const incoming = this.graph.getIncomingEdges(current);
            incoming.forEach(edge => {
                if (!result.has(edge.source)) {
                    result.add(edge.source);
                    ancestors.push(edge.source);
                    queue.push(edge.source);
                }
            });
        }
        return ancestors;
    }

    /**
     * Get edges strictly between nodes in the set
     */
    getRelevantEdges(nodes) {
        const nodeSet = new Set(nodes.map(n => n.id));
        const edges = [];
        nodes.forEach(n => {
            const outgoing = this.graph.getOutgoingEdges(n.id);
            outgoing.forEach(e => {
                if (nodeSet.has(e.target)) {
                    edges.push(e);
                }
            });
        });
        return edges;
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
                // Only decrement if neighbor not visited (avoid double counting in cycles)
                if (!visited.has(neighborId)) {
                    const newDegree = (localInDegree.get(neighborId) || 0) - 1;
                    localInDegree.set(neighborId, newDegree);
                    if (newDegree <= 0) { // Changed to <= 0 to be robust against negative logic errors
                        // Check if already in available to prevent duplicates
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
            }
            else {
                // Cycle Detected or Disconnected Components with strict dependencies
                // Strategy: Break cycle by picking the "best" remaining node 
                // Prioritize nodes with HIGHEST Out-Degree (unlocks the most)
                // or lowest remaining in-degree?
                // "Lowest In-Degree" is usually the best heuristic for Feedback Arc Set.
                // Find remaining nodes
                const remainingIds = [];
                nodes.forEach(n => {
                    if (!visited.has(n.id))
                        remainingIds.push(n.id);
                });
                if (remainingIds.length === 0)
                    break; // Done
                // Sort by In-Degree (Ascending) -> Strategy Score (Desc)
                remainingIds.sort((a, b) => {
                    const degA = localInDegree.get(a) || 0;
                    const degB = localInDegree.get(b) || 0;
                    if (degA !== degB)
                        return degA - degB;
                    return this.compareNodes(a, b, strategy);
                });
                const forceId = remainingIds[0];
                // Force process strict dependency validation
                localInDegree.set(forceId, 0); // Pretend it's free
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

    /**
     * Get peripheral nodes for orbital view (1-4 nodes).
     * 获取轨道视图的周边节点（1-4个节点）。
     * @param centralId Current central node ID
     * @param mode 'domain' or 'diffusion'
     * @param ultimateTargetId Target node for diffusion mode (optional)
     * @param maxCount Maximum peripheral count (default 4)
     * @returns Array of peripheral node objects
     */
    getPeripheralNodes(centralId, mode = 'domain', ultimateTargetId = null, maxCount = 4) {
        const centralNode = this.graph.getNode(centralId);
        if (!centralNode) return [];

        const peripherals = [];
        const addedIds = new Set([centralId]);

        // Step 1: Collect in-degree nodes (prerequisites)
        const incomingEdges = this.graph.getIncomingEdges(centralId);
        for (const edge of incomingEdges) {
            if (peripherals.length >= maxCount) break;
            if (!addedIds.has(edge.source)) {
                const node = this.graph.getNode(edge.source);
                if (node) {
                    peripherals.push({ ...node, relation: 'prerequisite' });
                    addedIds.add(edge.source);
                }
            }
        }

        // Step 2: Fill remaining with high-association nodes
        if (peripherals.length < maxCount) {
            const outgoingEdges = this.graph.getOutgoingEdges(centralId);
            const candidates = [];

            for (const edge of outgoingEdges) {
                if (addedIds.has(edge.target)) continue;
                
                // Diffusion mode: exclude out-degree of ultimate target
                if (mode === 'diffusion' && ultimateTargetId) {
                    const targetOutgoing = this.graph.getOutgoingEdges(ultimateTargetId);
                    const isOutDegreeOfTarget = targetOutgoing.some(e => e.target === edge.target);
                    if (isOutDegreeOfTarget) continue;
                }

                const node = this.graph.getNode(edge.target);
                if (node) {
                    candidates.push({ 
                        ...node, 
                        relation: 'association',
                        weight: edge.weight || 1
                    });
                }
            }

            // Sort by weight (association strength)
            candidates.sort((a, b) => b.weight - a.weight);

            for (const candidate of candidates) {
                if (peripherals.length >= maxCount) break;
                if (!addedIds.has(candidate.id)) {
                    peripherals.push(candidate);
                    addedIds.add(candidate.id);
                }
            }
        }

        // Step 3: Zero in-degree fallback - use highest relevance
        if (peripherals.length === 0) {
            const allNodes = this.graph.getNodes();
            const candidates = allNodes
                .filter(n => n.id !== centralId)
                .map(n => ({
                    ...n,
                    relation: 'relevance',
                    score: (n.centrality || 0) + (n.outDegree || 0) * 0.1
                }))
                .sort((a, b) => b.score - a.score);

            for (const candidate of candidates) {
                if (peripherals.length >= maxCount) break;
                peripherals.push(candidate);
            }
        }

        return peripherals;
    }

    /**
     * Get tree layout Structure (Layered DAG) for visualization.
     * 获取用于可视化的树形布局结构（分层 DAG）。
     * @param centralId Current center node ID
     * @param learningPath The active learning path object
     */
    /**
     * Get tree layout Structure (Horizontal Mind Map) for visualization.
     * @param centralId Current center node ID
     * @param learningPath The active learning path object
     * @param collapsedSet Optional Set of collapsed node IDs
     */
    getTreeLayout(centralId, learningPath, collapsedSet = new Set()) {
        if (!learningPath || !learningPath.nodes || learningPath.nodes.length === 0) return null;

        const nodes = learningPath.nodes;
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        
        // --- 1. Build Adjacency & Compute Local In-Degrees ---
        const adj = new Map();
        const inDegree = new Map(); // Local in-degree for sorting
        nodes.forEach(n => {
            adj.set(n.id, []);
            inDegree.set(n.id, 0);
        });

        nodes.forEach(source => {
            const outgoing = this.graph.getOutgoingEdges(source.id);
            outgoing.forEach(edge => {
                if (nodeMap.has(edge.target)) {
                    adj.get(source.id).push(edge.target);
                    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
                }
            });
        });

        // --- 2. Sort Children by In-Degree (Descending) ---
        // Prioritize nodes with higher dependency count (likely more foundational or central) based on user request
        nodes.forEach(n => {
            const children = adj.get(n.id);
            children.sort((a, b) => {
                const degA = inDegree.get(a) || 0;
                const degB = inDegree.get(b) || 0;
                if (degA !== degB) return degB - degA; // Descending In-Degree
                return a.localeCompare(b); // Stable tie-break
            });
        });

        // --- 3. Build Layout Levels (BFS) & Filter Collapsed ---
        // Determine Roots (In-Degree 0 or Cycle Breaker)
        const roots = nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
        if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0].id);

        const nodeLevels = new Map();
        const layoutNodes = [];
        const layoutEdges = [];
        const visited = new Set();
        
        // Helper: Recursive Traversal for Layout
        // Assigns X based on depth
        // Returns Y-range or similar for positioning
        
        const X_SPACING = 250; // Horizontal spacing
        const Y_SPACING = 60;  // Vertical spacing
        let nextY = 0;

        const layoutRecursive = (nodeId, level) => {
            if (visited.has(nodeId)) return null;
            visited.add(nodeId);

            const node = nodeMap.get(nodeId);
            const isCollapsed = collapsedSet.has(nodeId);
            const children = adj.get(nodeId) || [];
            
            const layoutNode = {
                id: node.id,
                label: node.label,
                status: this._getNodeStatus(node, centralId),
                inDegree: (node.inDegree || 0), // Global InDegree
                x: level * X_SPACING,
                y: 0, // Placeholder
                collapsed: isCollapsed,
                hasChildren: children.length > 0
            };

            let childrenYSum = 0;
            let childrenCount = 0;
            let minChildY = Infinity;
            let maxChildY = -Infinity;

            if (!isCollapsed && children.length > 0) {
                // Traverse children
                children.forEach(childId => {
                    // Prevent cycles in tree traversal (if DAG has separate paths to same node, only first visits)
                    // For tree layout, we want full tree? DAG usually means we should link to existing.
                    // Implementation choice: Treat as Tree (replicate or just link?). 
                    // Let's assume DAG Layout: if child visited, we define edge but not position (it's already placed).
                    // BUT for horizontal alignment, we usually want specific tree branch.
                    // For now: Only recurse if not visited. If visited, draw edge but don't move it.
                    
                    if (!visited.has(childId)) {
                        layoutEdges.push({ from: nodeId, to: childId });
                        const childResult = layoutRecursive(childId, level + 1);
                        if (childResult) {
                            childrenYSum += childResult.y;
                            childrenCount++;
                            minChildY = Math.min(minChildY, childResult.y);
                            maxChildY = Math.max(maxChildY, childResult.y);
                        }
                    } else {
                        // Already placed, just add edge
                         layoutEdges.push({ from: nodeId, to: childId });
                    }
                });
            }

            // Calculate Y
            if (childrenCount > 0) {
                // Center parent relative to children
                layoutNode.y = (minChildY + maxChildY) / 2;
            } else {
                // Leaf (or collapsed) -> take next Y slot
                layoutNode.y = nextY;
                nextY += Y_SPACING;
            }
            
            layoutNodes.push(layoutNode);
            return layoutNode;
        };

        // Run Layout for each root
        // Reset valid roots order
        roots.sort((a, b) => b.localeCompare(a)); // Consistent order
        let rootYOffset = 0;

        roots.forEach(rootId => {
             const rootNode = layoutRecursive(rootId, 0);
             // If we have disconnected forests, stack them vertically?
             // Since nextY increments globaly, they stack automatically.
        });

        // Add nodes that weren't visited (disconnected components not reachable from detected roots)
        // Usually shouldn't happen in well-formed Domain Learning, but purely defensive
        nodes.forEach(n => {
            if (!visited.has(n.id)) {
                layoutRecursive(n.id, 0);
            }
        });

        return {
            nodes: layoutNodes,
            edges: layoutEdges
        };
    }

    _getNodeStatus(node, centralId) {
        if (node.isCompleted) return 'completed';
        if (node.id === centralId) return 'current';
        return 'pending';
    }
}
PathEngine = PathEngine;

    // Explicitly expose
    self.PathEngine = PathEngine;

/**
 * OrbitalState - Progress tracking for Orbital Learning.
 * 轨道状态 - 轨道学习的进度追踪。
 */
class OrbitalState {
    constructor(storageKey = 'noteconnection_orbital_progress') {
        this.storageKey = storageKey;
        this.completedIds = new Set();
        this.currentCentralId = null;
        this.learningPath = null;
        this.mode = 'domain'; // 'domain' or 'diffusion'
        this.retainHistory = true; // Default to true
        this._load();
    }

    _load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                // Respect retainHistory from saved state if present, or default
                if (data.retainHistory !== undefined) this.retainHistory = data.retainHistory;
                
                if (this.retainHistory) {
                    this.completedIds = new Set(data.completedIds || []);
                    this.currentCentralId = data.currentCentralId || null;
                    this.mode = data.mode || 'domain';
                }
            }
        } catch (e) {
            console.warn('OrbitalState: Failed to load progress', e);
        }
    }

    _save() {
        if (!this.retainHistory) {
            localStorage.removeItem(this.storageKey);
            return;
        }
        try {
            const data = {
                completedIds: Array.from(this.completedIds),
                currentCentralId: this.currentCentralId,
                mode: this.mode,
                retainHistory: this.retainHistory
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('OrbitalState: Failed to save progress', e);
        }
    }

    /**
     * Update settings.
     * @param config { retainHistory: boolean }
     */
    updateSettings(config) {
        if (config && typeof config.retainHistory === 'boolean') {
            this.retainHistory = config.retainHistory;
            if (this.retainHistory) {
                this._save(); // Persist current state immediately
            } else {
                localStorage.removeItem(this.storageKey); // Clear immediately
            }
        }
    }

    /**
     * Mark a node as completed and advance to next.
     * @param nodeId Node to mark complete
     * @returns Next central node ID or null if path complete
     */
    markComplete(nodeId) {
        this.completedIds.add(nodeId);
        
        // Find next uncompleted node in path
        if (this.learningPath && this.learningPath.nodes) {
            const currentIdx = this.learningPath.nodes.findIndex(n => n.id === nodeId);
            for (let i = currentIdx + 1; i < this.learningPath.nodes.length; i++) {
                const next = this.learningPath.nodes[i];
                if (!this.completedIds.has(next.id)) {
                    this.currentCentralId = next.id;
                    this._save();
                    return next.id;
                }
            }
        }

        this._save();
        return null; // Path complete
    }

    /**
     * Set the current learning path.
     * @param path Learning path from PathEngine
     */
    setLearningPath(path) {
        this.learningPath = path;
        if (path && path.nodes && path.nodes.length > 0) {
            // Find first uncompleted node
            const first = path.nodes.find(n => !this.completedIds.has(n.id));
            if (!this.currentCentralId) {
                 this.currentCentralId = first ? first.id : path.nodes[0].id;
            }
        }
        this._save();
    }

    /**
     * Switch central node manually.
     * @param nodeId New central node
     * @param autoReconstruct If true, caller should reconstruct path
     */
    switchCentral(nodeId, autoReconstruct = false) {
        this.currentCentralId = nodeId;
        this._save();
        return autoReconstruct;
    }

    /**
     * Get completion count for display.
     * @returns {completed, total}
     */
    getProgress() {
        const total = this.learningPath?.nodes?.length || 0;
        const completed = this.completedIds.size;
        return { completed, total };
    }

    /**
     * Get completed node IDs as array.
     */
    getCompletedIds() {
        return Array.from(this.completedIds);
    }

    /**
     * Reset all progress.
     */
    reset() {
        this.completedIds.clear();
        this.currentCentralId = null;
        this.learningPath = null;
        localStorage.removeItem(this.storageKey);
    }

    /**
     * Truncate label for peripheral display (max 15 chars).
     * @param label Original label
     * @returns Truncated label
     */
    static truncateLabel(label, maxLen = 15) {
        if (!label || label.length <= maxLen) return label || '';
        return label.substring(0, maxLen) + '...';
    }

    /**
     * Toggle collapsed state of a node.
     * @returns {boolean} New collapsed state
     */
    toggleCollapse(nodeId) {
        if (this.collapsedIds.has(nodeId)) {
            this.collapsedIds.delete(nodeId);
            this._save();
            return false;
        } else {
            this.collapsedIds.add(nodeId);
            this._save();
            return true;
        }
    }

    isCollapsed(nodeId) {
        return this.collapsedIds.has(nodeId);
    }
}

// Update constructor and _load/_save methods
const _originalCons = OrbitalState.prototype.constructor;
OrbitalState.prototype.constructor = function(storageKey = 'noteconnection_orbital_progress') {
    this.storageKey = storageKey;
    this.completedIds = new Set();
    this.collapsedIds = new Set(); // New
    this.currentCentralId = null;
    this.learningPath = null;
    this.mode = 'domain';
    this.retainHistory = true;
    this._load();
};

OrbitalState.prototype._load = function() {
    try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.retainHistory !== undefined) this.retainHistory = data.retainHistory;
            
            if (this.retainHistory) {
                this.completedIds = new Set(data.completedIds || []);
                this.collapsedIds = new Set(data.collapsedIds || []); // New
                this.currentCentralId = data.currentCentralId || null;
                this.mode = data.mode || 'domain';
            }
        }
    } catch (e) { console.warn('OrbitalState Load Error', e); }
};

OrbitalState.prototype._save = function() {
    if (!this.retainHistory) {
        localStorage.removeItem(this.storageKey);
        return;
    }
    try {
        const data = {
            completedIds: Array.from(this.completedIds),
            collapsedIds: Array.from(this.collapsedIds), // New
            currentCentralId: this.currentCentralId,
            mode: this.mode,
            retainHistory: this.retainHistory
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) { console.warn('OrbitalState Save Error', e); }
};
OrbitalState = OrbitalState;

    // Explicitly expose
    self.OrbitalState = OrbitalState;
    
})();

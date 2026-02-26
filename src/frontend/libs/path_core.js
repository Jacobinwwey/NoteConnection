
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
        // If unlearned is too large, fallback to just immediate unlearned parents of target to avoid graph explosion
        let finalPathNodes;
        if (bestPath) {
             finalPathNodes = bestPath.map(id => this.graph.getNode(id));
        } else {
             // Heuristic: If unlearned is small (< 50), show all. Else show target + immediate unlearned parents.
             if (unlearned.length < 50) {
                 finalPathNodes = unlearned.map(id => this.graph.getNode(id));
             } else {
                 const immediate = this.graph.getIncomingEdges(targetId)
                    .map(e => e.source)
                    .filter(id => !completedSet.has(id));
                 finalPathNodes = [targetId, ...immediate].map(id => this.graph.getNode(id)).filter(n => n);
                 // console.warn('Pathfinding failed and unlearned set is large. Showing immediate parents only.');
             }
        }

        // Capture original path nodes for Critical Path identification
        // If bestPath exists, it's the critical path.
        // If bestPath is null, we used a fallback (all unlearned or immediate).
        // The fallback set (before forced expansion) is our "Spine".
        const spineSet = new Set(finalPathNodes.map(n => n.id));

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
                    // Allow showing ALL prerequisites (even completed ones) if expanded
                    if (!currentPathIds.has(prereqId)) {
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

        // Mark critical path (original shortest path or fallback) and check for hidden prerequisites
        finalPathNodes = finalPathNodes.map(n => {
            // Updated Logic: Use spineSet or bestPath
            let isOriginalPath = false;
            
            if (bestPath) {
                isOriginalPath = bestPath.includes(n.id);
            } else {
                // Determine if it was in the original set before forced expansion
                // Fallback scenario: Initial nodes are critical/spine
                isOriginalPath = spineSet.has(n.id);
            }

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
    /**
     * Get tree layout Structure (Spine & Tributaries) for visualization.
     * 获取用于可视化的树形布局结构（主干与支流）。
     * @param centralId Current center node ID
     * @param learningPath The active learning path object
     * @param collapsedSet Optional Set of collapsed node IDs
     */
    getTreeLayout(centralId, learningPath, collapsedSet = new Set()) {
        const nodes = learningPath.nodes;
        if (!nodes || nodes.length === 0) return null;

        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const layoutNodes = [];
        const placedNodeIds = new Set();

        // --- Config using Visual Dimensions (Synced with Mockup v3) ---
        const VISUAL_WIDTH = 140; 
        const VISUAL_HEIGHT = 50; // Reference only
        const H_GAP = 50;
        const V_GAP = 120; // Level Height
        
        const SIBLING_STRIDE = VISUAL_WIDTH + H_GAP; // 190
        const NODE_HALF_W = VISUAL_WIDTH / 2;
        const SPINE_PADDING = 100;
        const MIN_SPINE_INTERVAL = VISUAL_WIDTH + 150; // 290

        // --- Helpers ---

        // 1. Dependency Accessor
        // Check for specific edges provided in learningPath to restrict traversal (Constraint Subgraph)
        const usePathEdges = learningPath.edges && learningPath.edges.length > 0;
        const pathReverseAdj = new Map();
        if (usePathEdges) {
            learningPath.edges.forEach(e => {
                if (!pathReverseAdj.has(e.target)) pathReverseAdj.set(e.target, []);
                pathReverseAdj.get(e.target).push(e.source);
            });
        }

        const getPrerequisites = (nodeId) => {
            if (usePathEdges) {
                return (pathReverseAdj.get(nodeId) || []).filter(src => nodeMap.has(src));
            } else {
                return this.graph.getIncomingEdges(nodeId)
                    .map(e => e.source)
                    .filter(src => nodeMap.has(src));
            }
        };

        // 2. Contour Calculation (Recursive)
        // Returns { left: {lvl: min}, right: {lvl: max}, fullWidth: w }
        const calculateContour = (node, dir, visited = new Set()) => {
            if (visited.has(node.id)) {
                 // Cycle detected, treat as leaf
                 return { left: {}, right: {}, fullWidth: VISUAL_WIDTH };
            }
            visited.add(node.id);

            const isCollapsed = collapsedSet.has(node.id);
            // Treat explicit expansion flag from backend? Usually backend flag overrides.
            // But collapsedSet is UI state. 
            // In Mockup: "if (!node.expanded)". In Prod: "if (collapsedSet.has(id))".
            // WAIT! The worker receives `collapsedSet`.
            // Also need to handle "Forced Expansion" flag which might imply expanded by default.
            // Let's assume `collapsedSet` is the authority. 
            // If node.isExpanded is true (from diffusion algo) it might still be collapsed by user?
            // Usually, 'isExpanded' logic means "Data is available", 'collapsedSet' means "User hid it".
            
            // Logic: If collapsed, it's a leaf.
            if (isCollapsed) {
                return { left: {}, right: {}, fullWidth: VISUAL_WIDTH };
            }

            const childrenIds = getPrerequisites(node.id).filter(id => !placedNodeIds.has(id)); 
            // Note: placedNodeIds check here is tricky. 
            // Contours are calculated *before* placement for Spines, but *during* for Tributaries?
            // Actually, for Spines, we calculate contour of the tributary tree.
            // The tributary tree nodes are NOT placed yet.
            // BUT: We must exclude *other* Spines from being counted as children (if cyclic/diamond).
            // Mockup: `filter(id => !mainPathIds.includes(id))`
            // We need to identify Main Path (Spine) first.
            const spineIds = spineCandidates.map(n => n.id);
            const validChildren = childrenIds.filter(id => !spineIds.includes(id));

            if (validChildren.length === 0) {
                 return { left: {}, right: {}, fullWidth: VISUAL_WIDTH };
            }

            // Create a new branch visited set to allow shared nodes in parallel branches? 
            // No, contour is absolute width. If shared, we count it twice?
            // If node A has children B and C, and B->D, C->D.
            // D contributes to B's contour AND C's contour?
            // Yes, visual duplication or just width reservation.
            // If we share `visited` across siblings, the second sibling sees D as visited and returns leaf.
            // This effectively "hides" D from the second sibling's contour.
            // This is probably DESIRED to avoid double counting width if they will overlap visually?
            // BUT if they are placed separately, we need width for both!
            // In `placeTributaries`, we place duplicates or skip?
            // We decided "Assign to first parent".
            // So logic: Count D for B. When C comes, D is "handled".
            // So sharing `visited` across the sibling mapping is correct?
            // `childContours.map` runs sequentially.
            // We should pass the SAME `visited` set to all children?
            // BUT `calculateContour` signature `(node, dir, visited = new Set())` creates new set if not passed.
            // Here we want to fork visited for independent branches? Or shared?
            // If we want accurate "Subtree Width", we should avoid double counting.
            // So we should pass a shared visited set.
            // But `calculateContour` is called on `node` which is the root of sub-calculation.
            // Let's create a local visited set for this contour calculation instance if we want strict tree?
            // Actually, simply protecting against LOOPS is key.
            // The recursion `calculateContour(nodeMap.get(cid), dir, new Set(visited))` would protect looping path.
            // Using `new Set(visited)` (Branch Copy) protects against A->B->A, but allows A->B->D, A->C->D.
            // This seems safer for width calculation (count D twice = more space reserved = safer).
            
            const branchVisited = new Set(visited);
            const childContours = validChildren.map(cid => calculateContour(nodeMap.get(cid), dir, branchVisited));
            
            const spacings = childContours.map(c => Math.max(c.fullWidth, SIBLING_STRIDE));
            const totalWidth = spacings.reduce((a,b) => a+b, 0);
            
            const mergedLeft = {};
            const mergedRight = {};
            
            let currentX = -(totalWidth / 2);
            
            childContours.forEach((cc, i) => {
                const spacing = spacings[i];
                const childCenterX = currentX + (spacing / 2);
                
                // 1. Add Child's own width at Relative Level 1
                const targetLvl = 1 * dir; 
                updateMinMax(mergedLeft, mergedRight, targetLvl, childCenterX - NODE_HALF_W, childCenterX + NODE_HALF_W);

                // 2. Merge Child's internal contour
                for (const [lvlRelStr, minVal] of Object.entries(cc.left)) {
                    const lvlRel = parseInt(lvlRelStr); 
                    const finalLvl = (1 * dir) + lvlRel; 
                    updateMinMax(mergedLeft, mergedRight, finalLvl, childCenterX + minVal, childCenterX + cc.right[lvlRelStr]);
                }
                
                currentX += spacing;
            });
            
            return { left: mergedLeft, right: mergedRight, fullWidth: Math.max(totalWidth, VISUAL_WIDTH) };
        };

        const updateMinMax = (lMap, rMap, lvl, min, max) => {
            if (lMap[lvl] === undefined || min < lMap[lvl]) lMap[lvl] = min;
            if (rMap[lvl] === undefined || max > rMap[lvl]) rMap[lvl] = max;
        };

        // --- 1. Identify Spine ---
        let spineCandidates = nodes.filter(n => n.isCritical);
        if (spineCandidates.length === 0) {
            spineCandidates = [...nodes];
            spineCandidates.sort((a,b) => (a.stepOrder || 0) - (b.stepOrder || 0));
        } else {
             spineCandidates.sort((a,b) => (a.stepOrder || 0) - (b.stepOrder || 0));
        }
        
        // --- 2. Calculate Layout (Spine Position & Contours) ---
        const spineMap = new Map();
        
        // Global Accumulators
        const globalContours = { 1: {}, [-1]: {} };
        let lastSpineX = 0;

        spineCandidates.forEach((node, index) => {
             placedNodeIds.add(node.id);
             
             const lNode = {
                id: node.id,
                label: node.label,
                status: this._getNodeStatus(node, centralId),
                inDegree: (node.inDegree || 0),
                y: 0,
                collapsed: collapsedSet.has(node.id),
                isExpanded: node.isExpanded, // Data flag
                isSpine: true,
                spineIndex: index,
                _contour: null
            };
            
            // Calculate Contour for Tributaries
            // Direction: Even -> 1 (Down), Odd -> -1 (Up)
            const dir = (index % 2 === 0) ? 1 : -1;
            const contour = calculateContour(node, dir);
            lNode._contour = contour;

            // Determine X
            let minSafeX = (index === 0) ? 0 : (lastSpineX + MIN_SPINE_INTERVAL);

            // Collision Check against Global
            for (const [lvlStr, minVal] of Object.entries(contour.left)) {
                const lvl = parseInt(lvlStr);
                const relevantSide = (lvl > 0) ? 1 : (lvl < 0) ? -1 : 0;
                if (relevantSide === 0 || relevantSide !== dir) continue;

                const globalMax = globalContours[relevantSide][lvl];
                if (globalMax !== undefined) {
                    const requiredX = globalMax + SPINE_PADDING - minVal;
                    if (requiredX > minSafeX) {
                        minSafeX = requiredX;
                    }
                }
            }

            lNode.x = minSafeX;
            lastSpineX = minSafeX;
            
            // Update Global Accumulator
            for (const [lvlStr, maxVal] of Object.entries(contour.right)) {
                const lvl = parseInt(lvlStr);
                const relevantSide = (lvl > 0) ? 1 : (lvl < 0) ? -1 : 0;
                if (relevantSide === 0) continue;

                const absRight = lNode.x + maxVal;
                const currentGlobal = globalContours[relevantSide][lvl];
                if (currentGlobal === undefined || absRight > currentGlobal) {
                    globalContours[relevantSide][lvl] = absRight;
                }
            }

            layoutNodes.push(lNode);
            spineMap.set(node.id, lNode);
        });

        // --- 3. recursive Place Tributaries ---
        const placeTributaries = (parentNode, currentContour, originX, originY, dir) => {
             // Re-finding children to place them exactly as counted
             // Note: We used `calculateContour` which filters by !placedNodeIds.
             // But placedNodeIds only contains Spine at start. 
             // We need to fetch valid children again.
             // IMPORTANT: `calculateContour` used RECURSION. Here we recursively place.
             
             const childrenIds = getPrerequisites(parentNode.id).filter(id => !spineMap.has(id)); 
             // Wait, `placedNodeIds` is updated as we go? 
             // The contour calc assumed "Valid Children".
             // We should filter against Spine AND ensure we process them in same order.
             // To ensure distinctness in graph (if DAG has multi-parents), we need to track placed.
             
             // Problem: `calculateContour` is stateless regarding placement.
             // If a node is shared by multiple parents, `calculateContour` counts it for BOTH.
             // But in `placeTributaries`, we only place it once?
             // If we place it once, the second parent will have an "empty hole" in its contour?
             // Actually, `Tree Layout` often duplicates nodes or we assume Strict Tree.
             // The visualizer usually duplicates shared nodes in Tree View to avoid crossing lines.
             // "NoteConnection" usually treats graph as DAG.
             // IF we want Strict Tree Layout, we duplicate. 
             // IF we want DAG, we place once.
             // Logic in Mockup: `children = ... filter(id => !mainPathIds.includes(id))`
             // Mockup implies simple tree.
             // Let's implement strict Tree (Visual Duplication) OR check `placedNodeIds`.
             // If we check `placedNodeIds`, the second parent finds no children, so width is small.
             // But `calculateContour` might have predicted large width. Mismatch!
             // FIX: `calculateContour` also needs to filter by `placedNodeIds`? 
             // But `calculateContour` runs AHEAD of placement.
             // SOLUTION: For "Tree Layout" mode, we allow VISUAL DUPLICATES (or Phantom Nodes) 
             // OR we strictly assign a node to its FIRST valid parent (Topological).
             // Given the complexity, let's stick to: "Assign to first parent".
             // But then `calculateContour` must simulate this assignment.
             // Given `path_core.js` structure, `layoutNodes` is a flat list. 
             // Using `placedNodeIds` during `calculateContour`? No, because parallel branches might race.
             // Let's rely on `placedNodeIds` during PLACEMENT.
             // And accepts that if a child is already placed, the parent just has an empty branch there.
             // This might look weird if the space was reserved.
             // However, `getPrerequisites` returns incoming edges.
             // Layout logic usually implies strict hierarchy.
             
             const unplacedChildren = childrenIds.filter(id => !placedNodeIds.has(id));
             if (unplacedChildren.length === 0) return;

             // Re-calculate contour locally to determine spacing? 
             // We can just call `calculateContour` again? It's cheap enough for typical graphs (hundreds of nodes).
             // But we need consistency.
             // Let's recalculate child widths on the fly.
             const childWidths = unplacedChildren.map(cid => {
                  const node = nodeMap.get(cid);
                  const c = calculateContour(node, dir); 
                  return Math.max(c.fullWidth, SIBLING_STRIDE);
             });
             
             const totalW = childWidths.reduce((a,b) => a+b, 0);
             let startX = originX - (totalW / 2);
             
             unplacedChildren.forEach((cid, i) => {
                 const node = nodeMap.get(cid);
                 const w = childWidths[i];
                 const centerX = startX + (w/2);
                 const childY = originY + (dir * V_GAP);
                 
                 const lNode = {
                    id: node.id,
                    label: node.label,
                    status: this._getNodeStatus(node, centralId),
                    inDegree: (node.inDegree || 0),
                    x: centerX,
                    y: childY,
                    collapsed: collapsedSet.has(node.id),
                    isExpanded: node.isExpanded,
                    isSpine: false,
                    hasChildren: false 
                };
                
                layoutNodes.push(lNode);
                placedNodeIds.add(node.id); // Mark placed
                
                // Recurse
                // Only if Expanded
                 if (!collapsedSet.has(node.id)) {
                     placeTributaries(lNode, null, centerX, childY, dir);
                 }
                 
                 startX += w;
             });
        };

        // Execute Placement
        spineCandidates.forEach(node => {
            const lNode = spineMap.get(node.id);
            const dir = (lNode.spineIndex % 2 === 0) ? 1 : -1;
            // Only place if expanded (spine usually expanded, but check collapsedSet)
             if (!collapsedSet.has(node.id)) {
                 placeTributaries(lNode, lNode._contour, lNode.x, lNode.y, dir);
             }
        });

        // --- 4. Edges & Hulls ---
        const layoutEdges = [];
        const placedSet = new Set(layoutNodes.map(n => n.id));
        
        if (usePathEdges) {
            learningPath.edges.forEach(e => {
                if (placedSet.has(e.source) && placedSet.has(e.target)) {
                    layoutEdges.push({ from: e.source, to: e.target });
                }
            });
        } else {
             layoutNodes.forEach(node => {
                 const outgoing = this.graph.getOutgoingEdges(node.id);
                 outgoing.forEach(e => {
                     if (placedSet.has(e.target)) {
                         layoutEdges.push({ from: node.id, to: e.target });
                     }
                 });
             });
        }
        
        // --- 5. Hulls (Visual Bubbles) ---
        // "Optimization" node hull logic (Generalize to: Any Expanded on Spine)
        const hulls = [];
        
        // Helper to collect subtree (in-degree group)
        const collectSubtree = (rootId, list = [], visited = new Set()) => {
            if (visited.has(rootId)) return list;
            visited.add(rootId);
            list.push(rootId);
            
            const children = getPrerequisites(rootId).filter(id => placedSet.has(id) && !spineMap.has(id)); 
            // Only follow placed non-spine nodes to avoid jumping back to main path
            children.forEach(cid => {
                // Determine if we should follow? 
                // Only if the link exists in the visual graph.
                collectSubtree(cid, list, visited);
            });
            return list;
        };

        spineCandidates.forEach(node => {
            // If expanded and has children, draw hull?
            // Mockup only did it for "Optimization".
            // Let's do it for any Spine node that is expanded and has offspring.
            // Requirement from User: "boundary of the in-degree node range".
            if (!collapsedSet.has(node.id)) {
                 // Collect descendants (Tributaries only)
                const descendants = [];
                const firstGen = getPrerequisites(node.id).filter(id => placedSet.has(id) && !spineMap.has(id));
                
                if (firstGen.length > 0) {
                     firstGen.forEach(cid => collectSubtree(cid, descendants));
                     // Make unique
                     const uniqueGroup = Array.from(new Set(descendants));
                     
                     if (uniqueGroup.length > 0) {
                         hulls.push({
                             groupNodeId: node.id,
                             memberIds: uniqueGroup
                         });
                     }
                }
            }
        });

        return {
            nodes: layoutNodes,
            edges: layoutEdges,
            hulls: hulls
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


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
        // console.log('[PathCore] getTreeLayout called. Nodes:', learningPath?.nodes?.length);
        if (!learningPath || !learningPath.nodes || learningPath.nodes.length === 0) {
            console.warn('[PathCore] getTreeLayout: No nodes in learningPath');
            return null;
        }

        const nodes = learningPath.nodes;
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const layoutNodes = [];
        const placedNodeIds = new Set();
        
        // Check for specific edges provided in learningPath to restrict traversal (Constraint Subgraph)
        // If not provided, fallback to global graph
        const usePathEdges = learningPath.edges && learningPath.edges.length > 0;
        const pathEdgesMap = new Map(); // Source -> [Targets] (Forward) 
        // We need Reverse map for dependencies (Target -> Sources)
        const pathReverseAdj = new Map();

        if (usePathEdges) {
            learningPath.edges.forEach(e => {
                if (!pathReverseAdj.has(e.target)) pathReverseAdj.set(e.target, []);
                pathReverseAdj.get(e.target).push(e.source);
            });
        }

        // Helper: Get Prerequisites (Incoming Edges) for a node
        // Respects the constrained subgraph if 'learningPath.edges' exists
        const getPrerequisites = (nodeId) => {
            if (usePathEdges) {
                return (pathReverseAdj.get(nodeId) || []).filter(src => nodeMap.has(src));
            } else {
                return this.graph.getIncomingEdges(nodeId)
                    .map(e => e.source)
                    .filter(src => nodeMap.has(src));
            }
        };

        // --- 1. Identify and Place Spine (Main Learning Path) ---
        // Spine = Logic Critical Path. In diffusionLearning, nodes have 'isCritical' flag.
        // Fallback: If no isCritical, use the sequential order of nodes as they appear (assuming sorted).
        let spineCandidates = nodes.filter(n => n.isCritical);
        if (spineCandidates.length === 0) {
            // Fallback: Try to trace from central/start? Or just take all nodes?
            // Assuming the list is topologically sorted or step-ordered.
            spineCandidates = [...nodes]; 
            // Attempt to sort by stepOrder if available
            spineCandidates.sort((a,b) => (a.stepOrder || 0) - (b.stepOrder || 0));
        } else {
             spineCandidates.sort((a,b) => (a.stepOrder || 0) - (b.stepOrder || 0));
        }

        const SPACING_X = 350; // Increased for wider nodes
        const LEVEL_HEIGHT = 120; // Reduced vertical gap slightly as requested "spacing between nodes is larger" might mean horizontal primarily, but user said "nodes should not overlap". Let's keep vertical reasonable. Actually user said "arrangement... too dense".
        // Let's make LEVEL_HEIGHT ample too.
        // Re-reading user: "spacing between nodes is larger". I will set LEVEL_HEIGHT to 150.
        // SIBLING_GAP must be > node width (180).
        const SIBLING_GAP = 220;

        // Place Spine
        const spineMap = new Map(); // Id -> LayoutNode
        
        spineCandidates.forEach((node, index) => {
            const lNode = {
                id: node.id,
                label: node.label,
                status: this._getNodeStatus(node, centralId),
                inDegree: (node.inDegree || 0),
                x: index * SPACING_X,
                y: 0,
                collapsed: collapsedSet.has(node.id),
                isExpanded: node.isExpanded,
                hasChildren: false, // Will calculate later
                isSpine: true,
                spineIndex: index
            };
            
            // If strictly enforced that "Any node may appear only once",
            // and "Priority given to node appearing before"...
            // Since we iterate spine first, spine takes precedence.
            if (!placedNodeIds.has(node.id)) {
                layoutNodes.push(lNode);
                placedNodeIds.add(node.id);
                spineMap.set(node.id, lNode);
            }
        });

        // --- 2. Recursively Place Tributaries ---
        
        // Helper: Calculate Subtree Width (BFS/DFS) to center children
        // Returns total width required for the subtree
        // visited: Set of nodes already counted in this measurement session to avoid double-counting shared descendants
        const measureSubtree = (rootId, visited = new Set()) => {
            if (visited.has(rootId)) return 0;
            visited.add(rootId);

            const children = getPrerequisites(rootId).filter(id => !placedNodeIds.has(id));
            if (children.length === 0) return SIBLING_GAP;
            
            const childNode = nodeMap.get(rootId);
            const isExpanded = childNode?.isExpanded;
            
            if (!isExpanded) return SIBLING_GAP;

            let totalWidth = 0;
            children.forEach(childId => {
                totalWidth += measureSubtree(childId, visited);
            });
            return totalWidth;
        };

        // Recursive Placement Function
        const placeTributaries = (parentId, originX, originY, direction) => {
             const parentNode = nodeMap.get(parentId);
             // Check expansion state (from backend flag)
             if (!parentNode.isExpanded) return;

             // Find unplaced prerequisites (Tributaries)
             let tributaries = getPrerequisites(parentId).filter(id => !placedNodeIds.has(id));
             
             if (tributaries.length === 0) return;

             // Sort tributaries (?) - maybe alphabetical or by in-degree
             tributaries.sort((a,b) => a.localeCompare(b));

             // Update parent's hasChildren status in layout
             const layoutParent = layoutNodes.find(n => n.id === parentId);
             if (layoutParent) layoutParent.hasChildren = true;

             // Measure widths with a shared visited set for this group of siblings
             // This ensures shared dependencies (diamonds) don't blow up width
             const measurementVisited = new Set();
             const widths = tributaries.map(id => measureSubtree(id, measurementVisited));
             const totalW = widths.reduce((sum, w) => sum + w, 0);

             // Start X: Center around parent
             let currentX = originX - (totalW / 2);
             const childY = originY + (direction * LEVEL_HEIGHT);

             tributaries.forEach((childId, idx) => {
                 const w = widths[idx];
                 const childNode = nodeMap.get(childId);
                 const centerX = currentX + (w / 2);

                 const lNode = {
                    id: childNode.id,
                    label: childNode.label,
                    status: this._getNodeStatus(childNode, centralId),
                    inDegree: (childNode.inDegree || 0),
                    x: centerX, // Still uses X-axis spread
                    y: childY,   // Lateral expansion (Vertical per requirement)
                    collapsed: collapsedSet.has(childId),
                    isExpanded: childNode.isExpanded,
                    hasChildren: false, // Will update if recursed
                    isSpine: false
                };

                layoutNodes.push(lNode);
                placedNodeIds.add(childId);

                // Recurse (Expand further out in same direction)
                placeTributaries(childId, centerX, childY, direction);

                currentX += w;
             });
        };

        // Iterate Spine nodes in order (Precedence Rule)
        spineCandidates.forEach((node) => {
            const lNode = spineMap.get(node.id);
            if (lNode) {
                // Determine direction: Odd/Even logic
                // Even -> Down (+1), Odd -> Up (-1)
                const dir = (lNode.spineIndex % 2 === 0) ? 1 : -1;
                placeTributaries(node.id, lNode.x, lNode.y, dir);
            }
        });

        // --- 3. Build Edges ---
        // Construct edges only between placed nodes
        const layoutEdges = [];
        const placedSet = new Set(layoutNodes.map(n => n.id));
        
        // Iterate all potential edges
        if (usePathEdges) {
            learningPath.edges.forEach(e => {
                if (placedSet.has(e.source) && placedSet.has(e.target)) {
                    layoutEdges.push({ from: e.source, to: e.target });
                }
            });
        } else {
             // Fallback global edges
             layoutNodes.forEach(node => {
                 const outgoing = this.graph.getOutgoingEdges(node.id);
                 outgoing.forEach(e => {
                     if (placedSet.has(e.target)) {
                         layoutEdges.push({ from: node.id, to: e.target });
                     }
                 });
             });
        }

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

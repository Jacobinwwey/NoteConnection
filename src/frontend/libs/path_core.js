
/* Auto-bundled Path Core */
(function() {
    
var exports = {};
var module = { exports: exports };
// Global scope exposure
// var Graph, PathEngine;


    /* ResourceReference.js */
    "use strict";

normalizeResourceReference = normalizeResourceReference;
/**
 * Shared, host-neutral reference normalization used by Graph and backend
 * identity generation. It intentionally has no Node or platform dependency so
 * the path-core bundle can execute in a browser VM and in Godot WebView.
 */
function normalizeResourceReference(reference) {
    if (typeof reference !== 'string') {
        throw new Error('Resource reference must be a string');
    }
    if (reference.includes('\0')) {
        throw new Error('Resource reference must not contain NUL characters');
    }
    return reference.normalize('NFC').replace(/\\/g, '/').toLowerCase();
}


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
        this.aliases = new Map();
    }
    /**
     * Adds a node to the graph.
     * 向图中添加一个节点。
     * @param node The node to add | 要添加的节点
     */
    addNode(node) {
        if (this.nodes.has(node.id)) {
            return;
        }
        const aliases = [node.id, node.sourceUri, ...(node.identityAliases ?? [])]
            .filter((alias) => typeof alias === 'string' && alias.length > 0);
        const normalizedAliases = new Set(aliases.map(alias => (0, normalizeResourceReference)(alias)));
        normalizedAliases.forEach(alias => {
            const existingNodeId = this.aliases.get(alias);
            if (existingNodeId && existingNodeId !== node.id) {
                throw new Error(`Resource identity alias collision: "${alias}" is claimed by both "${existingNodeId}" and "${node.id}"`);
            }
        });
        this.nodes.set(node.id, { ...node, inDegree: 0, outDegree: 0 });
        this.adjacencyList.set(node.id, []);
        this.reverseAdjacencyList.set(node.id, []);
        normalizedAliases.forEach(alias => {
            this.aliases.set(alias, node.id);
        });
    }
    resolveNodeId(reference) {
        if (this.nodes.has(reference)) {
            return reference;
        }
        return this.aliases.get((0, normalizeResourceReference)(reference));
    }
    /**
     * Retrieves a node by its ID.
     * 通过 ID 获取节点。
     * @param id The node ID | 节点 ID
     * @returns The node or undefined if not found | 节点，如果未找到则返回 undefined
     */
    getNode(reference) {
        const nodeId = this.resolveNodeId(reference);
        return nodeId ? this.nodes.get(nodeId) : undefined;
    }
    /**
     * Checks if a node exists in the graph.
     * 检查图中是否存在该节点。
     * @param id The node ID | 节点 ID
     */
    hasNode(reference) {
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
    addEdge(source, target, type = 'dependency', weight = 1) {
        const sourceId = this.resolveNodeId(source) ?? source;
        const targetId = this.resolveNodeId(target) ?? target;
        if (!this.nodes.has(sourceId)) {
            this.addNode({ id: sourceId, label: sourceId, inDegree: 0, outDegree: 0 });
        }
        if (!this.nodes.has(targetId)) {
            this.addNode({ id: targetId, label: targetId, inDegree: 0, outDegree: 0 });
        }
        const edge = { source: sourceId, target: targetId, type, weight };
        // Add to adjacency list (outgoing)
        const outgoing = this.adjacencyList.get(sourceId) || [];
        // Prevent duplicate edges
        if (!outgoing.some(e => e.target === targetId && e.type === type)) {
            outgoing.push(edge);
            this.adjacencyList.set(sourceId, outgoing);
            // Update out-degree
            const sourceNode = this.nodes.get(sourceId);
            sourceNode.outDegree++;
        }
        // Add to reverse adjacency list (incoming)
        const incoming = this.reverseAdjacencyList.get(targetId) || [];
        if (!incoming.some(e => e.source === sourceId && e.type === type)) {
            incoming.push(edge);
            this.reverseAdjacencyList.set(targetId, incoming);
            // Update in-degree
            const targetNode = this.nodes.get(targetId);
            targetNode.inDegree++;
        }
    }
    /**
     * Gets all outgoing edges from a node.
     * 获取节点的所有出边。
     * @param id Node ID | 节点 ID
     */
    getOutgoingEdges(reference) {
        const nodeId = this.resolveNodeId(reference);
        return nodeId ? (this.adjacencyList.get(nodeId) || []) : [];
    }
    /**
     * Gets all outgoing neighbor IDs for a node.
     * 获取节点的所有出度邻居 ID。
     * @param id Node ID | 节点 ID
     */
    getNeighbors(reference) {
        return this.getOutgoingEdges(reference).map(edge => edge.target);
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
    getIncomingEdges(reference) {
        const nodeId = this.resolveNodeId(reference);
        return nodeId ? (this.reverseAdjacencyList.get(nodeId) || []) : [];
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
    getPredecessors(reference) {
        const predecessors = new Set();
        const nodeId = this.resolveNodeId(reference);
        if (!nodeId)
            return predecessors;
        const queue = [nodeId];
        const visited = new Set();
        visited.add(nodeId);
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
    getSuccessors(reference) {
        const successors = new Set();
        const nodeId = this.resolveNodeId(reference);
        if (!nodeId)
            return successors;
        const queue = [nodeId];
        const visited = new Set();
        visited.add(nodeId);
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
        const sourceId = this.resolveNodeId(source);
        const targetId = this.resolveNodeId(target);
        if (!sourceId || !targetId)
            return [];
        if (sourceId === targetId)
            return [sourceId];
        const queue = [sourceId];
        const visited = new Set();
        const parent = new Map();
        visited.add(sourceId);
        while (queue.length > 0) {
            const current = queue.shift();
            if (current === targetId)
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
        if (!visited.has(targetId))
            return [];
        // Reconstruct path
        const path = [targetId];
        let curr = targetId;
        while (curr !== sourceId) {
            curr = parent.get(curr);
            path.unshift(curr);
        }
        return path;
    }
}
Graph = Graph;

    self.Graph = Graph;

    /* PathEngine.js */
    "use strict";


class PathEngine {
    constructor(graph) {
        this.graph = graph;
    }
    domainLearning(nodeIds, strategy) {
        const targetNodes = nodeIds ? new Set(nodeIds) : new Set(this.graph.getNodes().map((node) => node.id));
        const relevantNodes = this.expandToIncludePrerequisites(targetNodes);
        return this.generateLearningPath(relevantNodes, strategy);
    }
    diffusionLearning(targetId, strategy, completedSet = new Set(), forcedExpansionSet = new Set()) {
        if (!this.graph.hasNode(targetId)) {
            throw new Error(`Node ${targetId} not found in graph`);
        }
        const targetNode = this.graph.getNode(targetId);
        const ancestors = this.getAncestors(targetId);
        const unlearned = ancestors.filter((id) => !completedSet.has(id));
        if (!completedSet.has(targetId) && !unlearned.includes(targetId)) {
            unlearned.push(targetId);
        }
        if (unlearned.length === 0) {
            return {
                nodes: [targetNode],
                edges: [],
                strategy,
                coverage: 1,
            };
        }
        const frontier = unlearned.filter((id) => {
            const incoming = this.graph.getIncomingEdges(id);
            return incoming.every((edge) => completedSet.has(edge.source));
        });
        let bestPath = null;
        const reverseAdj = new Map();
        unlearned.forEach((id) => reverseAdj.set(id, []));
        unlearned.forEach((id) => {
            const incoming = this.graph.getIncomingEdges(id);
            incoming.forEach((edge) => {
                if (unlearned.includes(edge.source)) {
                    if (!reverseAdj.has(id)) {
                        reverseAdj.set(id, []);
                    }
                    reverseAdj.get(id).push(edge.source);
                }
            });
        });
        const queue = [[targetId]];
        const visited = new Set([targetId]);
        while (queue.length > 0) {
            const currentPath = queue.shift();
            const head = currentPath[currentPath.length - 1];
            if (frontier.includes(head)) {
                bestPath = [...currentPath].reverse();
                break;
            }
            const neighbors = reverseAdj.get(head) || [];
            neighbors.sort((left, right) => this.compareNodes(left, right, strategy));
            for (const next of neighbors) {
                if (!visited.has(next)) {
                    visited.add(next);
                    queue.push([...currentPath, next]);
                }
            }
        }
        let finalPathNodes;
        if (bestPath) {
            finalPathNodes = bestPath.map((id) => this.graph.getNode(id)).filter((node) => Boolean(node));
        }
        else if (unlearned.length < 50) {
            finalPathNodes = unlearned.map((id) => this.graph.getNode(id)).filter((node) => Boolean(node));
        }
        else {
            const immediate = this.graph.getIncomingEdges(targetId)
                .map((edge) => edge.source)
                .filter((id) => !completedSet.has(id));
            finalPathNodes = [targetId, ...immediate]
                .map((id) => this.graph.getNode(id))
                .filter((node) => Boolean(node));
        }
        const spineSet = new Set(finalPathNodes.map((node) => node.id));
        const nodesToAdd = new Set();
        const currentPathIds = new Set(finalPathNodes.map((node) => node.id));
        currentPathIds.forEach((id) => {
            if (!forcedExpansionSet.has(id)) {
                return;
            }
            const incoming = this.graph.getIncomingEdges(id);
            incoming.forEach((edge) => {
                const prereqId = edge.source;
                if (!currentPathIds.has(prereqId)) {
                    nodesToAdd.add(prereqId);
                }
            });
        });
        nodesToAdd.forEach((id) => {
            const node = this.graph.getNode(id);
            if (node) {
                finalPathNodes.push(node);
            }
        });
        const pathSet = new Set(finalPathNodes.map((node) => node.id));
        const enrichedNodes = finalPathNodes.map((node) => {
            const isOriginalPath = bestPath ? bestPath.includes(node.id) : spineSet.has(node.id);
            const nextNode = {
                ...node,
                isCritical: isOriginalPath,
            };
            const incoming = this.graph.getIncomingEdges(node.id);
            const hasHidden = incoming.some((edge) => !completedSet.has(edge.source) && !pathSet.has(edge.source));
            if (hasHidden) {
                nextNode.hasHiddenPrereqs = true;
            }
            if (forcedExpansionSet.has(node.id)) {
                nextNode.isExpanded = true;
            }
            return nextNode;
        });
        return {
            nodes: enrichedNodes,
            edges: this.getRelevantEdges(enrichedNodes),
            strategy,
            coverage: unlearned.length > 0 ? enrichedNodes.length / unlearned.length : 1,
        };
    }
    getPeripheralNodes(centralId, mode = 'domain', ultimateTargetId = null, maxCount = 4) {
        const centralNode = this.graph.getNode(centralId);
        if (!centralNode) {
            return [];
        }
        const peripherals = [];
        const addedIds = new Set([centralId]);
        const incomingEdges = this.graph.getIncomingEdges(centralId);
        for (const edge of incomingEdges) {
            if (peripherals.length >= maxCount) {
                break;
            }
            if (!addedIds.has(edge.source)) {
                const node = this.graph.getNode(edge.source);
                if (node) {
                    peripherals.push({ ...node, relation: 'prerequisite' });
                    addedIds.add(edge.source);
                }
            }
        }
        if (peripherals.length < maxCount) {
            const outgoingEdges = this.graph.getOutgoingEdges(centralId);
            const candidates = [];
            for (const edge of outgoingEdges) {
                if (addedIds.has(edge.target)) {
                    continue;
                }
                if (mode === 'diffusion' && ultimateTargetId) {
                    const targetOutgoing = this.graph.getOutgoingEdges(ultimateTargetId);
                    const isOutDegreeOfTarget = targetOutgoing.some((candidateEdge) => candidateEdge.target === edge.target);
                    if (isOutDegreeOfTarget) {
                        continue;
                    }
                }
                const node = this.graph.getNode(edge.target);
                if (node) {
                    candidates.push({
                        ...node,
                        relation: 'association',
                        weight: edge.weight || 1,
                    });
                }
            }
            candidates.sort((left, right) => (right.weight || 0) - (left.weight || 0));
            for (const candidate of candidates) {
                if (peripherals.length >= maxCount) {
                    break;
                }
                if (!addedIds.has(candidate.id)) {
                    peripherals.push(candidate);
                    addedIds.add(candidate.id);
                }
            }
        }
        if (peripherals.length === 0) {
            const candidates = this.graph.getNodes()
                .filter((node) => node.id !== centralId)
                .map((node) => ({
                ...node,
                relation: 'relevance',
                score: (node.centrality || 0) + (node.outDegree || 0) * 0.1,
            }))
                .sort((left, right) => (right.score || 0) - (left.score || 0));
            for (const candidate of candidates) {
                if (peripherals.length >= maxCount) {
                    break;
                }
                peripherals.push(candidate);
            }
        }
        return peripherals;
    }
    getTreeLayout(centralId, learningPath, collapsedSet = new Set(), expansionOrder = [], stickyClaimEnabled = true, spacing = {}) {
        const rawNodesRaw = Array.isArray(learningPath.nodes) ? learningPath.nodes : [];
        if (rawNodesRaw.length === 0) {
            return null;
        }
        const seenIds = new Set();
        const rawNodes = [];
        for (const node of rawNodesRaw) {
            if (!node || !node.id || seenIds.has(node.id)) {
                continue;
            }
            seenIds.add(node.id);
            rawNodes.push(node);
        }
        if (rawNodes.length === 0) {
            return null;
        }
        let spineCandidates = rawNodes.filter((node) => Boolean(node.isCritical));
        if (spineCandidates.length === 0) {
            spineCandidates = [...rawNodes];
        }
        spineCandidates.sort((left, right) => (left.stepOrder || 0) - (right.stepOrder || 0));
        const spineIndexMap = new Map();
        spineCandidates.forEach((node, index) => spineIndexMap.set(node.id, index));
        const visualWidth = 140;
        const horizontalGap = spacing.horizontalGap ?? 50;
        const verticalGap = spacing.verticalGap ?? 240;
        const spineSpacing = spacing.spineSpacing ?? 290;
        const nodes = rawNodes.map((node) => {
            const isSpine = spineIndexMap.has(node.id);
            return {
                id: node.id,
                label: node.label,
                status: this.getNodeStatus(node, centralId),
                inDegree: node.inDegree || 0,
                collapsed: collapsedSet.has(node.id),
                isExpanded: !collapsedSet.has(node.id),
                isSpine,
                spineIndex: isSpine ? spineIndexMap.get(node.id) : -1,
                visible: true,
                x: 0,
                y: 0,
                currentOwner: null,
                ownerPriority: -1,
                hasPrereqs: false,
                _tributaries: [],
                _isOnSpine: isSpine,
            };
        });
        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        const expandedOrder = expansionOrder.filter((nodeId) => nodeMap.has(nodeId) && !collapsedSet.has(nodeId));
        const expandedSet = new Set(expandedOrder);
        const usePathEdges = Array.isArray(learningPath.edges) && learningPath.edges.length > 0;
        const pathReverseAdj = new Map();
        if (usePathEdges) {
            learningPath.edges.forEach((edge) => {
                const targetId = this.resolveEdgeNodeId(edge.target);
                const sourceId = this.resolveEdgeNodeId(edge.source);
                if (!targetId || !sourceId) {
                    return;
                }
                if (!pathReverseAdj.has(targetId)) {
                    pathReverseAdj.set(targetId, []);
                }
                pathReverseAdj.get(targetId).push(sourceId);
            });
        }
        const getNode = (nodeId) => {
            if (!nodeId) {
                return undefined;
            }
            return nodeMap.get(nodeId);
        };
        const getPrereqs = (nodeId) => {
            const sources = usePathEdges
                ? (pathReverseAdj.get(nodeId) || [])
                : this.graph.getIncomingEdges(nodeId).map((edge) => edge.source);
            return [...new Set(sources)]
                .filter((sourceId) => nodeMap.has(sourceId))
                .map((sourceId) => getNode(sourceId))
                .filter((node) => Boolean(node));
        };
        nodes.forEach((node) => {
            node.hasPrereqs = getPrereqs(node.id).length > 0;
        });
        const getTributaryRootSpineIndex = (node) => {
            if (node._isOnSpine && node.isSpine) {
                return node.spineIndex;
            }
            let current = node;
            const visited = new Set();
            while (current && !visited.has(current.id)) {
                visited.add(current.id);
                if (current.isSpine) {
                    return current.spineIndex;
                }
                current = current.currentOwner ? getNode(current.currentOwner) : undefined;
            }
            return -1;
        };
        const getEffectiveSpineIndex = (node, visited = new Set()) => {
            if (!node.isSpine) {
                return -1;
            }
            if (node._isOnSpine || node.currentOwner === null) {
                return node.spineIndex ?? -1;
            }
            if (visited.has(node.id)) {
                return node.spineIndex ?? -1;
            }
            visited.add(node.id);
            const owner = node.currentOwner ? getNode(node.currentOwner) : undefined;
            if (owner && owner.isSpine) {
                return getEffectiveSpineIndex(owner, visited);
            }
            return getTributaryRootSpineIndex(node);
        };
        const claim = (target, owner, priority, claimVisited = new Set()) => {
            if (claimVisited.has(target.id)) {
                return;
            }
            claimVisited.add(target.id);
            target.currentOwner = owner.id;
            target.ownerPriority = priority;
            target._isOnSpine = false;
            if (!owner._tributaries.includes(target)) {
                owner._tributaries.push(target);
            }
            if (expandedSet.has(target.id)) {
                const targetEffectiveIdx = getEffectiveSpineIndex(target);
                const targetTributaries = getPrereqs(target.id).filter((node) => node.currentOwner === null);
                targetTributaries.forEach((node) => {
                    if (node.isSpine && target.isSpine) {
                        const nodeIndex = node.spineIndex ?? -1;
                        if (nodeIndex !== -1 && targetEffectiveIdx !== -1 && nodeIndex <= targetEffectiveIdx) {
                            return;
                        }
                    }
                    claim(node, target, priority, claimVisited);
                });
            }
        };
        const claimSpineChain = (startNode, owner, priority) => {
            const chain = nodes
                .filter((node) => node.isSpine && node.spineIndex >= startNode.spineIndex)
                .sort((left, right) => left.spineIndex - right.spineIndex);
            chain.forEach((node) => claim(node, owner, priority));
        };
        const tryClaim = (expander, target, priority) => {
            if (target.currentOwner !== null && target.ownerPriority < priority) {
                return { success: false };
            }
            const expanderEffectiveIdx = getEffectiveSpineIndex(expander);
            const targetEffectiveIdx = target.spineIndex ?? -1;
            if (target.isSpine && expander.isSpine) {
                if (targetEffectiveIdx !== -1 && expanderEffectiveIdx !== -1 && targetEffectiveIdx <= expanderEffectiveIdx) {
                    return { success: false };
                }
            }
            if (target.isSpine && !expander.isSpine) {
                const rootSpineIndex = getTributaryRootSpineIndex(expander);
                if (rootSpineIndex !== -1 && targetEffectiveIdx <= rootSpineIndex) {
                    return { success: false };
                }
            }
            if (target.isSpine && expander.isSpine && expander._isOnSpine) {
                claimSpineChain(target, expander, priority);
                return { success: true };
            }
            claim(target, expander, priority);
            return { success: true };
        };
        const isOwnerChainVisible = (node, visited = new Set()) => {
            if (node.currentOwner === null) {
                return false;
            }
            if (visited.has(node.id)) {
                return false;
            }
            visited.add(node.id);
            if (!expandedSet.has(node.currentOwner)) {
                return false;
            }
            const owner = getNode(node.currentOwner);
            if (!owner) {
                return false;
            }
            if (owner.isSpine && owner._isOnSpine) {
                return true;
            }
            if (owner.isSpine && !owner._isOnSpine) {
                return owner.visible;
            }
            return isOwnerChainVisible(owner, visited);
        };
        expandedOrder.forEach((expanderId, priority) => {
            const expander = getNode(expanderId);
            if (!expander || !expandedSet.has(expanderId)) {
                return;
            }
            const prereqs = getPrereqs(expanderId);
            prereqs.forEach((prereq) => tryClaim(expander, prereq, priority));
        });
        nodes.forEach((node) => {
            if (node.isSpine) {
                node.visible = true;
                if (node.currentOwner && !expandedSet.has(node.currentOwner)) {
                    node._isOnSpine = true;
                    node.currentOwner = null;
                }
            }
        });
        nodes.forEach((node) => {
            if (!node.isSpine) {
                node.visible = isOwnerChainVisible(node);
                if (!node.visible && !stickyClaimEnabled) {
                    node.currentOwner = null;
                }
            }
        });
        const calculateContourWidth = (node, visited = new Set()) => {
            if (visited.has(node.id)) {
                return 0;
            }
            visited.add(node.id);
            if (!expandedSet.has(node.id)) {
                return visualWidth + horizontalGap;
            }
            const tributaries = node._tributaries.filter((candidate) => candidate.visible && !candidate._isOnSpine);
            if (tributaries.length === 0) {
                return visualWidth + horizontalGap;
            }
            let total = 0;
            tributaries.forEach((candidate) => {
                total += calculateContourWidth(candidate, visited);
            });
            return Math.max(visualWidth + horizontalGap, total);
        };
        const renderPlaced = new Set();
        const placeSubTributaries = (parent, direction) => {
            if (renderPlaced.has(parent.id)) {
                return;
            }
            renderPlaced.add(parent.id);
            const tributaries = parent._tributaries.filter((node) => node.visible && !node._isOnSpine);
            if (tributaries.length === 0) {
                return;
            }
            const widths = tributaries.map((node) => calculateContourWidth(node));
            const totalWidth = widths.reduce((sum, width) => sum + width, 0);
            let startX = parent.x - totalWidth / 2;
            tributaries.forEach((node, index) => {
                const width = widths[index];
                node.x = startX + width / 2;
                node.y = parent.y + direction * verticalGap;
                startX += width;
            });
            tributaries.forEach((node) => {
                if (expandedSet.has(node.id)) {
                    placeSubTributaries(node, direction);
                }
            });
        };
        const visibleSpineNodes = nodes.filter((node) => node._isOnSpine).sort((left, right) => left.spineIndex - right.spineIndex);
        let lastUpSpine = null;
        let lastDownSpine = null;
        visibleSpineNodes.forEach((node, index) => {
            const effectiveIdx = getEffectiveSpineIndex(node);
            const direction = ((effectiveIdx === -1 ? node.spineIndex : effectiveIdx) % 2 === 0) ? 1 : -1;
            const tributaryWidth = calculateContourWidth(node);
            node._tribWidth = tributaryWidth;
            node._dir = direction;
            let minX = index === 0 ? 0 : visibleSpineNodes[index - 1].x + spineSpacing;
            const previousSameSide = direction === 1 ? lastDownSpine : lastUpSpine;
            if (previousSameSide) {
                const safeX = previousSameSide.x + (previousSameSide._tribWidth || 0) / 2 + tributaryWidth / 2 + horizontalGap * 2;
                minX = Math.max(minX, safeX);
            }
            node.x = minX;
            node.y = 0;
            if (direction === 1) {
                lastDownSpine = node;
            }
            else {
                lastUpSpine = node;
            }
        });
        visibleSpineNodes.forEach((node) => {
            if (expandedSet.has(node.id)) {
                placeSubTributaries(node, node._dir || 1);
            }
        });
        const visibleNodes = nodes.filter((node) => node.visible);
        const visibleIds = new Set(visibleNodes.map((node) => node.id));
        const edgeSet = new Set();
        const layoutEdges = [];
        const allEdges = usePathEdges ? learningPath.edges : this.graph.getEdges();
        allEdges.forEach((edge) => {
            const sourceId = this.resolveEdgeNodeId(edge.source);
            const targetId = this.resolveEdgeNodeId(edge.target);
            if (!sourceId || !targetId) {
                return;
            }
            const source = getNode(sourceId);
            const target = getNode(targetId);
            if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id)) {
                return;
            }
            if (source.currentOwner && target.currentOwner && source.currentOwner !== target.currentOwner) {
                return;
            }
            const edgeKey = `${sourceId}->${targetId}`;
            if (edgeSet.has(edgeKey)) {
                return;
            }
            edgeSet.add(edgeKey);
            layoutEdges.push({ from: sourceId, to: targetId });
        });
        const hulls = [];
        expandedOrder.forEach((nodeId) => {
            const expander = getNode(nodeId);
            if (!expander || !expandedSet.has(nodeId)) {
                return;
            }
            const tributaries = expander._tributaries.filter((node) => node.visible);
            if (tributaries.length === 0) {
                return;
            }
            hulls.push({
                groupNodeId: nodeId,
                memberIds: tributaries.map((node) => node.id),
            });
        });
        const outAdj = new Map();
        const allEdgesForDegree = usePathEdges ? learningPath.edges : this.graph.getEdges();
        allEdgesForDegree.forEach((edge) => {
            const sourceId = this.resolveEdgeNodeId(edge.source);
            const targetId = this.resolveEdgeNodeId(edge.target);
            if (!sourceId || !targetId) {
                return;
            }
            if (!outAdj.has(sourceId)) {
                outAdj.set(sourceId, new Set());
            }
            outAdj.get(sourceId).add(targetId);
        });
        const cleanNodes = visibleNodes.map((node) => {
            const inSources = getPrereqs(node.id);
            const inDegreeNames = inSources.map((source) => source.label || source.id);
            const inDegreeIds = inSources.map((source) => source.id);
            const outTargets = outAdj.get(node.id) || new Set();
            const outDegreeNames = [...outTargets].map((targetId) => {
                const target = getNode(targetId);
                return target ? (target.label || target.id) : targetId;
            });
            const outDegreeIds = [...outTargets];
            return {
                id: node.id,
                label: node.label,
                status: node.status,
                x: node.x,
                y: node.y,
                isSpine: node.isSpine,
                spineIndex: node.spineIndex,
                isExpanded: node.isExpanded,
                collapsed: node.collapsed,
                hasPrereqs: node.hasPrereqs,
                currentOwner: node.currentOwner,
                visible: node.visible,
                inDegree: node.inDegree,
                outDegree: outTargets.size,
                inDegreeNames,
                outDegreeNames,
                inDegreeIds,
                outDegreeIds,
            };
        });
        return {
            nodes: cleanNodes,
            edges: layoutEdges,
            hulls,
        };
    }
    getAncestors(startId) {
        const queue = [startId];
        const ancestors = [];
        const visited = new Set();
        while (queue.length > 0) {
            const current = queue.shift();
            const incoming = this.graph.getIncomingEdges(current);
            incoming.forEach((edge) => {
                if (!visited.has(edge.source)) {
                    visited.add(edge.source);
                    ancestors.push(edge.source);
                    queue.push(edge.source);
                }
            });
        }
        return ancestors;
    }
    getRelevantEdges(nodes) {
        const nodeSet = new Set(nodes.map((node) => node.id));
        const edges = [];
        const edgeSet = new Set();
        nodes.forEach((node) => {
            const outgoing = this.graph.getOutgoingEdges(node.id);
            outgoing.forEach((edge) => {
                if (!nodeSet.has(edge.target)) {
                    return;
                }
                const edgeKey = `${edge.source}->${edge.target}:${edge.type || 'dependency'}`;
                if (edgeSet.has(edgeKey)) {
                    return;
                }
                edgeSet.add(edgeKey);
                edges.push(edge);
            });
        });
        return edges;
    }
    generateLearningPath(nodesOfInterest, strategy) {
        const nodes = Array.from(nodesOfInterest)
            .map((id) => this.graph.getNode(id))
            .filter((node) => Boolean(node));
        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        const localInDegree = new Map();
        const localAdjacency = new Map();
        nodes.forEach((node) => {
            localInDegree.set(node.id, 0);
            localAdjacency.set(node.id, []);
        });
        const relevantEdges = [];
        nodes.forEach((node) => {
            const outgoing = this.graph.getOutgoingEdges(node.id);
            outgoing.forEach((edge) => {
                if (nodesOfInterest.has(edge.target)) {
                    localAdjacency.get(node.id).push(edge.target);
                    localInDegree.set(edge.target, (localInDegree.get(edge.target) || 0) + 1);
                    relevantEdges.push(edge);
                }
            });
        });
        const available = [];
        nodes.forEach((node) => {
            if (localInDegree.get(node.id) === 0) {
                available.push(node.id);
            }
        });
        const learnedPath = [];
        const visited = new Set();
        let step = 1;
        const processNode = (currentId) => {
            visited.add(currentId);
            const currentNode = nodeMap.get(currentId);
            learnedPath.push({
                ...currentNode,
                stepOrder: step++,
                isCompleted: false,
                unlocks: localAdjacency.get(currentId),
            });
            const neighbors = localAdjacency.get(currentId);
            neighbors.forEach((neighborId) => {
                if (!visited.has(neighborId)) {
                    const newDegree = (localInDegree.get(neighborId) || 0) - 1;
                    localInDegree.set(neighborId, newDegree);
                    if (newDegree <= 0 && !available.includes(neighborId)) {
                        available.push(neighborId);
                    }
                }
            });
        };
        while (learnedPath.length < nodes.length) {
            if (available.length > 0) {
                available.sort((left, right) => this.compareNodes(left, right, strategy));
                const currentId = available.shift();
                if (!visited.has(currentId)) {
                    processNode(currentId);
                }
                continue;
            }
            const remainingIds = nodes.filter((node) => !visited.has(node.id)).map((node) => node.id);
            if (remainingIds.length === 0) {
                break;
            }
            remainingIds.sort((left, right) => {
                const leftDegree = localInDegree.get(left) || 0;
                const rightDegree = localInDegree.get(right) || 0;
                if (leftDegree !== rightDegree) {
                    return leftDegree - rightDegree;
                }
                return this.compareNodes(left, right, strategy);
            });
            const forcedId = remainingIds[0];
            localInDegree.set(forcedId, 0);
            processNode(forcedId);
        }
        return {
            nodes: learnedPath,
            edges: relevantEdges,
            strategy,
            coverage: nodes.length > 0 ? learnedPath.length / nodes.length : 0,
        };
    }
    expandToIncludePrerequisites(initialNodes) {
        const result = new Set(initialNodes);
        for (const nodeId of initialNodes) {
            const predecessors = this.graph.getPredecessors(nodeId);
            predecessors.forEach((predecessorId) => result.add(predecessorId));
        }
        return result;
    }
    compareNodes(idA, idB, strategy) {
        const nodeA = this.graph.getNode(idA);
        const nodeB = this.graph.getNode(idB);
        const scoreA = this.calculateScore(nodeA, strategy);
        const scoreB = this.calculateScore(nodeB, strategy);
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }
        return idA.localeCompare(idB);
    }
    calculateScore(node, strategy) {
        const safeInDegree = node.inDegree + 1;
        if (strategy === 'foundational') {
            return (node.outDegree + 0.1) / safeInDegree;
        }
        return (node.centrality || 0) * 10 - node.inDegree;
    }
    getNodeStatus(node, centralId) {
        if (node.isCompleted) {
            return 'completed';
        }
        if (centralId && node.id === centralId) {
            return 'current';
        }
        return 'pending';
    }
    resolveEdgeNodeId(endpoint) {
        if (typeof endpoint === 'string') {
            return endpoint;
        }
        if (endpoint && typeof endpoint === 'object' && 'id' in endpoint) {
            const candidate = endpoint.id;
            return typeof candidate === 'string' ? candidate : '';
        }
        return '';
    }
}
PathEngine = PathEngine;

    self.PathEngine = PathEngine;

    /* OrbitalState.js */
    "use strict";


class OrbitalState {
    constructor(storageKey = 'noteconnection_orbital_progress') {
        this.storageKey = storageKey;
        this.completedIds = new Set();
        this.collapsedIds = new Set();
        this.expansionOrder = [];
        this.stickyClaimEnabled = true;
        this.currentCentralId = null;
        this.learningPath = null;
        this.mode = 'domain';
        this.retainHistory = true;
        this.load();
    }
    load() {
        if (typeof localStorage === 'undefined') {
            return;
        }
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) {
                return;
            }
            const data = JSON.parse(saved);
            if (data.retainHistory !== undefined) {
                this.retainHistory = data.retainHistory;
            }
            if (!this.retainHistory) {
                return;
            }
            this.completedIds = new Set(data.completedIds || []);
            this.collapsedIds = new Set(data.collapsedIds || []);
            this.expansionOrder = data.expansionOrder || [];
            if (data.stickyClaimEnabled !== undefined) {
                this.stickyClaimEnabled = data.stickyClaimEnabled;
            }
            this.currentCentralId = data.currentCentralId || null;
            this.mode = data.mode || 'domain';
        }
        catch (error) {
            console.warn('OrbitalState Load Error', error);
        }
    }
    save() {
        if (typeof localStorage === 'undefined') {
            return;
        }
        if (!this.retainHistory) {
            localStorage.removeItem(this.storageKey);
            return;
        }
        try {
            const data = {
                completedIds: Array.from(this.completedIds),
                collapsedIds: Array.from(this.collapsedIds),
                expansionOrder: this.expansionOrder,
                stickyClaimEnabled: this.stickyClaimEnabled,
                currentCentralId: this.currentCentralId,
                mode: this.mode,
                retainHistory: this.retainHistory,
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        }
        catch (error) {
            console.warn('OrbitalState Save Error', error);
        }
    }
    updateSettings(config) {
        if (!config || typeof config.retainHistory !== 'boolean') {
            return;
        }
        this.retainHistory = config.retainHistory;
        if (!this.retainHistory) {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(this.storageKey);
            }
            return;
        }
        this.save();
    }
    markComplete(nodeId) {
        this.completedIds.add(nodeId);
        if (this.learningPath && Array.isArray(this.learningPath.nodes)) {
            const currentIndex = this.learningPath.nodes.findIndex((node) => node.id === nodeId);
            for (let index = currentIndex + 1; index < this.learningPath.nodes.length; index += 1) {
                const next = this.learningPath.nodes[index];
                if (!this.completedIds.has(next.id)) {
                    this.currentCentralId = next.id;
                    this.save();
                    return next.id;
                }
            }
        }
        this.save();
        return null;
    }
    setLearningPath(path) {
        this.learningPath = path;
        if (path && Array.isArray(path.nodes) && path.nodes.length > 0 && !this.currentCentralId) {
            const first = path.nodes.find((node) => !this.completedIds.has(node.id));
            this.currentCentralId = first ? first.id : path.nodes[0].id;
        }
        this.save();
    }
    switchCentral(nodeId, autoReconstruct = false) {
        this.currentCentralId = nodeId;
        this.save();
        return autoReconstruct;
    }
    getProgress() {
        const total = this.learningPath && Array.isArray(this.learningPath.nodes) ? this.learningPath.nodes.length : 0;
        return { completed: this.completedIds.size, total };
    }
    getCompletedIds() {
        return Array.from(this.completedIds);
    }
    reset() {
        this.completedIds.clear();
        this.collapsedIds.clear();
        this.expansionOrder = [];
        this.currentCentralId = null;
        this.learningPath = null;
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.storageKey);
        }
    }
    static truncateLabel(label, maxLen = 15) {
        if (!label || label.length <= maxLen) {
            return label || '';
        }
        return label.substring(0, maxLen) + '...';
    }
    toggleCollapse(nodeId) {
        if (this.collapsedIds.has(nodeId)) {
            this.collapsedIds.delete(nodeId);
            if (!this.expansionOrder.includes(nodeId)) {
                this.expansionOrder.push(nodeId);
            }
            this.save();
            return false;
        }
        this.collapsedIds.add(nodeId);
        this.expansionOrder = this.expansionOrder.filter((id) => id !== nodeId);
        this.save();
        return true;
    }
    isCollapsed(nodeId) {
        return this.collapsedIds.has(nodeId);
    }
    collapseAll() {
        this.expansionOrder = [];
        this.save();
    }
    setStickyClaim(enabled) {
        this.stickyClaimEnabled = enabled;
        this.save();
    }
}
OrbitalState = OrbitalState;

    self.OrbitalState = OrbitalState;
})();

(function attachMobileExactAnalyzer(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.NoteConnectionMobileExactAnalyzer = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAnalyzerApi() {
    'use strict';

    const MAX_NODES = 50000;
    const MAX_EDGES = 250000;
    const MAX_QUERY_LENGTH = 256;
    const MAX_MATCHES = 50;
    const MAX_NEIGHBORS = 64;
    const MAX_PATH_DEPTH = 8;
    const MAX_VISITED_NODES = 10000;

    function normalizeLookupKey(value) {
        const text = String(value || '').trim();
        const normalizedText = typeof text.normalize === 'function'
            ? text.normalize('NFKC')
            : text;
        return normalizedText.toLowerCase();
    }

    function boundedPositiveInteger(value, fallback, ceiling) {
        const parsed = Number.parseInt(String(value || ''), 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return Math.min(parsed, ceiling);
    }

    function readEndpointId(value) {
        if (typeof value === 'string') {
            return value.trim();
        }
        if (value && typeof value === 'object' && typeof value.id === 'string') {
            return value.id.trim();
        }
        return '';
    }

    function projectNode(rawNode) {
        if (!rawNode || typeof rawNode !== 'object') {
            throw new Error('Mobile exact index requires every node to be an object.');
        }
        const id = typeof rawNode.id === 'string' ? rawNode.id.trim() : '';
        if (!id) {
            throw new Error('Mobile exact index requires every node to have a non-empty id.');
        }
        const metadata = rawNode.metadata && typeof rawNode.metadata === 'object'
            ? rawNode.metadata
            : {};
        const tags = Array.isArray(metadata.tags)
            ? metadata.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
            : [];

        return Object.freeze({
            id,
            label: typeof rawNode.label === 'string' && rawNode.label.trim()
                ? rawNode.label.trim()
                : id,
            clusterId: typeof rawNode.clusterId === 'string' ? rawNode.clusterId : '',
            inDegree: Number.isFinite(rawNode.inDegree) ? Number(rawNode.inDegree) : 0,
            outDegree: Number.isFinite(rawNode.outDegree) ? Number(rawNode.outDegree) : 0,
            tags: Object.freeze(tags),
        });
    }

    function addLookupReference(lookup, rawKey, nodeId) {
        const key = normalizeLookupKey(rawKey);
        if (!key) {
            return;
        }
        if (!lookup.has(key)) {
            lookup.set(key, new Set());
        }
        lookup.get(key).add(nodeId);
    }

    function createMobileExactIndex(graph) {
        if (!graph || typeof graph !== 'object') {
            throw new Error('Mobile exact index requires a graph payload.');
        }
        const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
        const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];
        if (rawNodes.length > MAX_NODES) {
            throw new Error(`Mobile exact index node limit exceeded: ${rawNodes.length}/${MAX_NODES}.`);
        }
        if (rawEdges.length > MAX_EDGES) {
            throw new Error(`Mobile exact index edge limit exceeded: ${rawEdges.length}/${MAX_EDGES}.`);
        }

        const nodeById = new Map();
        const normalizedNodeIds = new Set();
        const lookup = new Map();
        const outgoing = new Map();
        const incoming = new Map();

        rawNodes.forEach((rawNode) => {
            const node = projectNode(rawNode);
            const normalizedId = normalizeLookupKey(node.id);
            if (normalizedNodeIds.has(normalizedId)) {
                throw new Error(`Mobile exact index contains a duplicate node id: ${node.id}.`);
            }
            normalizedNodeIds.add(normalizedId);
            nodeById.set(node.id, node);
            outgoing.set(node.id, new Map());
            incoming.set(node.id, new Map());
            addLookupReference(lookup, node.id, node.id);
            addLookupReference(lookup, node.label, node.id);
            node.tags.forEach((tag) => addLookupReference(lookup, tag, node.id));
        });

        let edgeCount = 0;
        rawEdges.forEach((rawEdge) => {
            if (!rawEdge || typeof rawEdge !== 'object') {
                throw new Error('Mobile exact index requires every edge to be an object.');
            }
            const source = readEndpointId(rawEdge.source);
            const target = readEndpointId(rawEdge.target);
            if (!source || !target || !nodeById.has(source) || !nodeById.has(target)) {
                throw new Error(`Mobile exact index edge references an unknown node: ${source || '?'} -> ${target || '?'}.`);
            }
            if (source === target) {
                return;
            }
            const sourceEdges = outgoing.get(source);
            if (sourceEdges.has(target)) {
                return;
            }
            const edgeType = typeof rawEdge.type === 'string' && rawEdge.type.trim()
                ? rawEdge.type.trim()
                : 'association';
            sourceEdges.set(target, edgeType);
            incoming.get(target).set(source, edgeType);
            edgeCount += 1;
        });

        function searchExact(term, requestedLimit) {
            const normalizedTerm = normalizeLookupKey(term);
            if (!normalizedTerm || normalizedTerm.length > MAX_QUERY_LENGTH) {
                return [];
            }
            const limit = boundedPositiveInteger(requestedLimit, 25, MAX_MATCHES);
            const matchedIds = lookup.get(normalizedTerm) || new Set();
            return Array.from(matchedIds)
                .sort((left, right) => left.localeCompare(right))
                .slice(0, limit)
                .map((id) => nodeById.get(id));
        }

        function neighbors(nodeId, requestedLimit) {
            if (!nodeById.has(nodeId)) {
                return [];
            }
            const limit = boundedPositiveInteger(requestedLimit, 16, MAX_NEIGHBORS);
            const adjacent = [];
            outgoing.get(nodeId).forEach((edgeType, id) => {
                adjacent.push({ ...nodeById.get(id), direction: 'outgoing', edgeType });
            });
            incoming.get(nodeId).forEach((edgeType, id) => {
                adjacent.push({ ...nodeById.get(id), direction: 'incoming', edgeType });
            });
            return adjacent
                .sort((left, right) => {
                    if (left.direction !== right.direction) {
                        return left.direction === 'outgoing' ? -1 : 1;
                    }
                    return left.id.localeCompare(right.id);
                })
                .slice(0, limit);
        }

        function shortestPath(sourceNodeId, targetNodeId, requestedMaxDepth, requestedMaxVisitedNodes) {
            if (!nodeById.has(sourceNodeId) || !nodeById.has(targetNodeId)) {
                return null;
            }
            if (sourceNodeId === targetNodeId) {
                return [sourceNodeId];
            }
            const maxDepth = boundedPositiveInteger(requestedMaxDepth, 4, MAX_PATH_DEPTH);
            const maxVisitedNodes = boundedPositiveInteger(
                requestedMaxVisitedNodes,
                2000,
                MAX_VISITED_NODES
            );
            const queue = [{ id: sourceNodeId, depth: 0 }];
            const parentById = new Map([[sourceNodeId, null]]);

            for (let cursor = 0; cursor < queue.length; cursor += 1) {
                const current = queue[cursor];
                if (current.depth >= maxDepth) {
                    continue;
                }
                for (const nextId of outgoing.get(current.id).keys()) {
                    if (parentById.has(nextId)) {
                        continue;
                    }
                    if (parentById.size >= maxVisitedNodes) {
                        return null;
                    }
                    parentById.set(nextId, current.id);
                    if (nextId === targetNodeId) {
                        const path = [targetNodeId];
                        let parentId = current.id;
                        while (parentId) {
                            path.push(parentId);
                            parentId = parentById.get(parentId);
                        }
                        return path.reverse();
                    }
                    queue.push({ id: nextId, depth: current.depth + 1 });
                }
            }
            return null;
        }

        function statistics() {
                return {
                    nodeCount: nodeById.size,
                    edgeCount,
                };
        }

        return Object.freeze({
            searchExact,
            neighbors,
            shortestPath,
            statistics,
        });
    }

    return Object.freeze({
        createMobileExactIndex,
        limits: Object.freeze({
            maxNodes: MAX_NODES,
            maxEdges: MAX_EDGES,
            maxQueryLength: MAX_QUERY_LENGTH,
            maxMatches: MAX_MATCHES,
            maxNeighbors: MAX_NEIGHBORS,
            maxPathDepth: MAX_PATH_DEPTH,
            maxVisitedNodes: MAX_VISITED_NODES,
        }),
    });
}));

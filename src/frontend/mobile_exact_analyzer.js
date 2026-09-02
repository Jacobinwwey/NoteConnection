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
    const PROJECTION_VERSION = 1;

    function normalizeLookupKey(value) {
        const text = String(value || '').trim();
        const normalizedText = typeof text.normalize === 'function'
            ? text.normalize('NFC')
            : text;
        return normalizedText.toLowerCase();
    }

    function classifyEdgeType(edgeType) {
        const normalized = String(edgeType || '').trim().toLowerCase();
        if (normalized.startsWith('explicit-') || normalized === 'tagged' || normalized === 'sequence') {
            return 'explicit';
        }
        if (
            normalized.includes('inferred')
            || normalized.includes('keyword')
            || normalized.includes('vector')
            || normalized.includes('statistical')
            || normalized.includes('similarity')
        ) {
            return 'inferred';
        }
        return 'runtime';
    }

    function normalizeEdgeKinds(value) {
        if (!Array.isArray(value)) {
            return null;
        }
        const allowed = new Set(['explicit', 'inferred', 'runtime']);
        const kinds = value.map((kind) => String(kind || '').trim().toLowerCase()).filter((kind) => allowed.has(kind));
        return kinds.length > 0 ? new Set(kinds) : null;
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
        const identityAliases = Array.isArray(rawNode.identityAliases)
            ? rawNode.identityAliases.map((alias) => String(alias || '').trim()).filter(Boolean)
            : [];

        return Object.freeze({
            id,
            canonicalId: typeof rawNode.canonicalId === 'string' ? rawNode.canonicalId.trim() : '',
            label: typeof rawNode.label === 'string' && rawNode.label.trim()
                ? rawNode.label.trim()
                : id,
            clusterId: typeof rawNode.clusterId === 'string' ? rawNode.clusterId : '',
            inDegree: Number.isFinite(rawNode.inDegree) ? Number(rawNode.inDegree) : 0,
            outDegree: Number.isFinite(rawNode.outDegree) ? Number(rawNode.outDegree) : 0,
            tags: Object.freeze(tags),
            sourceUri: typeof rawNode.sourceUri === 'string' ? rawNode.sourceUri.trim() : '',
            revision: typeof rawNode.revision === 'string' ? rawNode.revision.trim() : '',
            identityAliases: Object.freeze(identityAliases),
            evidenceRefs: Object.freeze(Array.isArray(rawNode.evidenceRefs)
                ? rawNode.evidenceRefs.map((reference) => String(reference || '').trim()).filter(Boolean).slice(0, 8)
                : []),
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
        const declaredSchemaVersion = graph.schemaVersion ?? graph.projectionVersion;
        if (declaredSchemaVersion !== undefined && Number(declaredSchemaVersion) !== PROJECTION_VERSION) {
            throw new Error(`Unsupported mobile projection schema version: ${String(declaredSchemaVersion)}.`);
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
            addLookupReference(lookup, node.canonicalId, node.id);
            addLookupReference(lookup, node.label, node.id);
            addLookupReference(lookup, node.sourceUri, node.id);
            addLookupReference(lookup, node.revision, node.id);
            node.identityAliases.forEach((alias) => addLookupReference(lookup, alias, node.id));
            node.tags.forEach((tag) => addLookupReference(lookup, tag, node.id));
        });

        let edgeCount = 0;
        let explicitEdgeCount = 0;
        let inferredEdgeCount = 0;
        let runtimeEdgeCount = 0;
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
            const edgeKind = classifyEdgeType(edgeType);
            sourceEdges.set(target, edgeType);
            incoming.get(target).set(source, edgeType);
            edgeCount += 1;
            if (edgeKind === 'explicit') explicitEdgeCount += 1;
            else if (edgeKind === 'inferred') inferredEdgeCount += 1;
            else runtimeEdgeCount += 1;
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

        function resolveNodeReference(reference) {
            const direct = typeof reference === 'string' ? reference.trim() : '';
            if (direct && nodeById.has(direct)) {
                return direct;
            }
            const matches = lookup.get(normalizeLookupKey(reference));
            return matches && matches.size === 1 ? Array.from(matches)[0] : '';
        }

        function neighbors(nodeId, requestedLimit, requestedKinds) {
            const resolvedNodeId = resolveNodeReference(nodeId);
            if (!resolvedNodeId) {
                return [];
            }
            const limit = boundedPositiveInteger(requestedLimit, 16, MAX_NEIGHBORS);
            const edgeKinds = normalizeEdgeKinds(requestedKinds);
            const adjacent = [];
            outgoing.get(resolvedNodeId).forEach((edgeType, id) => {
                if (!edgeKinds || edgeKinds.has(classifyEdgeType(edgeType))) {
                    adjacent.push({ ...nodeById.get(id), direction: 'outgoing', edgeType, edgeKind: classifyEdgeType(edgeType) });
                }
            });
            incoming.get(resolvedNodeId).forEach((edgeType, id) => {
                if (!edgeKinds || edgeKinds.has(classifyEdgeType(edgeType))) {
                    adjacent.push({ ...nodeById.get(id), direction: 'incoming', edgeType, edgeKind: classifyEdgeType(edgeType) });
                }
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

        function isPrerequisiteRouteNeighbor(neighbor) {
            return neighbor
                && neighbor.direction === 'incoming'
                && /prerequisite|precondition|foundation|先修|前置|基础|sequence/iu.test(
                    String(neighbor.edgeType || '')
                );
        }

        function isApplicationRouteNeighbor(neighbor) {
            return neighbor
                && neighbor.direction === 'outgoing'
                && /application|use|performance|应用|用例|性能/iu.test(
                    String(neighbor.edgeType || '')
                );
        }

        function learningRoute(anchorReference, requestedLimit) {
            const anchorId = resolveNodeReference(anchorReference);
            if (!anchorId) {
                return [];
            }
            const limit = boundedPositiveInteger(requestedLimit, 6, 8);
            const anchor = nodeById.get(anchorId);
            const adjacent = neighbors(anchorId, Math.min(MAX_NEIGHBORS, limit * 3), ['explicit', 'runtime']);
            const entries = [];
            const seen = new Set();
            const append = (neighbor, role, orderingBasis) => {
                const nodeId = String(neighbor && neighbor.id || '').trim();
                if (!nodeId || seen.has(nodeId)) {
                    return;
                }
                seen.add(nodeId);
                entries.push({
                    nodeId,
                    title: String(neighbor && (neighbor.label || neighbor.id) || '').trim(),
                    role,
                    orderingBasis,
                });
            };
            adjacent
                .filter(isPrerequisiteRouteNeighbor)
                .sort((left, right) => String(left.label || left.id || '').localeCompare(String(right.label || right.id || '')))
                .forEach((neighbor) => append(neighbor, 'prerequisite', 'explicit_prerequisite'));
            append(anchor, 'core', 'semantic_grouping');
            adjacent
                .filter((neighbor) => !isPrerequisiteRouteNeighbor(neighbor))
                .sort((left, right) => {
                    const leftApplication = isApplicationRouteNeighbor(left) ? 1 : 0;
                    const rightApplication = isApplicationRouteNeighbor(right) ? 1 : 0;
                    return leftApplication - rightApplication
                        || String(left.label || left.id || '').localeCompare(String(right.label || right.id || ''));
                })
                .forEach((neighbor) => append(
                    neighbor,
                    isApplicationRouteNeighbor(neighbor) ? 'application' : 'mechanism',
                    isApplicationRouteNeighbor(neighbor) ? 'explicit_sequence' : 'semantic_grouping'
                ));
            return entries.slice(0, limit).map((entry, index) => ({
                ...entry,
                order: index + 1,
            }));
        }

        function shortestPath(sourceNodeId, targetNodeId, requestedMaxDepth, requestedMaxVisitedNodes) {
            const resolvedSourceId = resolveNodeReference(sourceNodeId);
            const resolvedTargetId = resolveNodeReference(targetNodeId);
            if (!resolvedSourceId || !resolvedTargetId) {
                return null;
            }
            if (resolvedSourceId === resolvedTargetId) {
                return [resolvedSourceId];
            }
            const maxDepth = boundedPositiveInteger(requestedMaxDepth, 4, MAX_PATH_DEPTH);
            const maxVisitedNodes = boundedPositiveInteger(
                requestedMaxVisitedNodes,
                2000,
                MAX_VISITED_NODES
            );
            const queue = [{ id: resolvedSourceId, depth: 0 }];
            const parentById = new Map([[resolvedSourceId, null]]);

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
                    if (nextId === resolvedTargetId) {
                        const path = [resolvedTargetId];
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

        function statistics(options) {
            const base = {
                nodeCount: nodeById.size,
                edgeCount,
            };
            if (!options || options.includeProvenance !== true) {
                return base;
            }
            return {
                ...base,
                projectionVersion: PROJECTION_VERSION,
                explicitEdgeCount,
                inferredEdgeCount,
                runtimeEdgeCount,
            };
        }

        return Object.freeze({
            projectionVersion: PROJECTION_VERSION,
            searchExact,
            neighbors,
            learningRoute,
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

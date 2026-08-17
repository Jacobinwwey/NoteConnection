(function attachKnowledgeProjectionContract(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.NoteConnectionKnowledgeProjection = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createKnowledgeProjectionContract() {
    'use strict';

    const SCHEMA_VERSION = 1;
    const MAX_NODES = 50000;
    const MAX_EDGES = 250000;
    const MAX_NEIGHBORS = 64;
    const MAX_EVIDENCE_REFS = 8;

    function isRecord(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function cleanString(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function cleanStringList(value, fieldName, limit) {
        if (value === undefined || value === null) {
            return [];
        }
        if (!Array.isArray(value)) {
            throw new Error(`${fieldName} must be an array when provided.`);
        }
        const values = Array.from(new Set(value.map(cleanString).filter(Boolean)));
        if (values.length > limit) {
            throw new Error(`${fieldName} exceeds the bounded limit of ${limit}.`);
        }
        return values;
    }

    function classifyEdgeKind(rawType, rawKind) {
        const kind = cleanString(rawKind).toLowerCase();
        if (kind === 'explicit' || kind === 'inferred' || kind === 'runtime') {
            return kind;
        }
        const type = cleanString(rawType).toLowerCase();
        if (type.includes('inferred') || type.includes('keyword') || type.includes('vector') || type.includes('statistical')) {
            return 'inferred';
        }
        if (type === 'runtime' || type.includes('runtime')) {
            return 'runtime';
        }
        return 'explicit';
    }

    function assertSupportedVersion(value) {
        const version = value === undefined || value === null ? SCHEMA_VERSION : Number(value);
        if (!Number.isInteger(version) || version < 1 || version > SCHEMA_VERSION) {
            throw new Error(`Unsupported knowledge projection schema version: ${String(value)}.`);
        }
        return version;
    }

    function normalizeNode(rawNode, maxEvidenceRefs) {
        if (!isRecord(rawNode)) {
            throw new Error('Knowledge projection nodes must be objects.');
        }
        const id = cleanString(rawNode.id);
        if (!id) {
            throw new Error('Knowledge projection node id must be non-empty.');
        }
        return {
            id,
            label: cleanString(rawNode.label) || id,
            sourceUri: cleanString(rawNode.sourceUri),
            revision: cleanString(rawNode.revision),
            identityAliases: cleanStringList(rawNode.identityAliases, `node ${id}.identityAliases`, 16),
            evidenceRefs: cleanStringList(rawNode.evidenceRefs, `node ${id}.evidenceRefs`, maxEvidenceRefs),
            tags: cleanStringList(rawNode.tags || (rawNode.metadata && rawNode.metadata.tags), `node ${id}.tags`, 32),
        };
    }

    function normalizeEdge(rawEdge, nodeById, maxEvidenceRefs) {
        if (!isRecord(rawEdge)) {
            throw new Error('Knowledge projection edges must be objects.');
        }
        const source = cleanString(rawEdge.source || rawEdge.from);
        const target = cleanString(rawEdge.target || rawEdge.to);
        if (!source || !target || source === target || !nodeById.has(source) || !nodeById.has(target)) {
            throw new Error(`Knowledge projection edge references an invalid node: ${source || '?'} -> ${target || '?'}.`);
        }
        const type = cleanString(rawEdge.type) || 'association';
        const confidence = Number(rawEdge.confidence ?? rawEdge.weight);
        const sourceNode = nodeById.get(source);
        const targetNode = nodeById.get(target);
        return {
            source,
            target,
            sourceUri: cleanString(rawEdge.sourceUri) || sourceNode.sourceUri,
            targetUri: cleanString(rawEdge.targetUri) || targetNode.sourceUri,
            type,
            kind: classifyEdgeKind(type, rawEdge.kind),
            provenance: cleanString(rawEdge.provenance) || type,
            confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 1,
            evidenceRefs: cleanStringList(rawEdge.evidenceRefs, `edge ${source}->${target}.evidenceRefs`, maxEvidenceRefs),
        };
    }

    function buildAdjacency(nodes, edges, maxNeighbors) {
        const adjacency = new Map(nodes.map((node) => [node.id, { outgoing: [], incoming: [] }]));
        edges.forEach((edge) => {
            const source = adjacency.get(edge.source);
            const target = adjacency.get(edge.target);
            if (source.outgoing.length < maxNeighbors && !source.outgoing.includes(edge.target)) {
                source.outgoing.push(edge.target);
            }
            if (target.incoming.length < maxNeighbors && !target.incoming.includes(edge.source)) {
                target.incoming.push(edge.source);
            }
        });
        return Array.from(adjacency, ([nodeId, value]) => ({ nodeId, ...value }));
    }

    function normalizeProjection(rawProjection, options) {
        if (!isRecord(rawProjection)) {
            throw new Error('Knowledge projection must be an object.');
        }
        const maxNodes = Math.min(MAX_NODES, Math.max(1, Number(options && options.maxNodes) || MAX_NODES));
        const maxEdges = Math.min(MAX_EDGES, Math.max(1, Number(options && options.maxEdges) || MAX_EDGES));
        const maxNeighbors = Math.min(MAX_NEIGHBORS, Math.max(1, Number(options && options.maxNeighbors) || MAX_NEIGHBORS));
        const maxEvidenceRefs = MAX_EVIDENCE_REFS;
        const declaredSchemaVersion = rawProjection.schemaVersion !== undefined
            ? rawProjection.schemaVersion
            : rawProjection.projectionVersion;
        const schemaVersion = assertSupportedVersion(declaredSchemaVersion);
        const rawNodes = Array.isArray(rawProjection.nodes) ? rawProjection.nodes : [];
        const rawEdges = Array.isArray(rawProjection.edges) ? rawProjection.edges : [];
        if (rawNodes.length > maxNodes || rawEdges.length > maxEdges) {
            throw new Error(`Knowledge projection exceeds bounded size: ${rawNodes.length} nodes / ${rawEdges.length} edges.`);
        }

        const nodes = rawNodes.map((node) => normalizeNode(node, maxEvidenceRefs));
        const nodeIds = new Set();
        const normalizedIds = new Set();
        nodes.forEach((node) => {
            const normalizedId = node.id.normalize ? node.id.normalize('NFC').toLowerCase() : node.id.toLowerCase();
            if (nodeIds.has(node.id) || normalizedIds.has(normalizedId)) {
                throw new Error(`Knowledge projection contains a duplicate node id: ${node.id}.`);
            }
            nodeIds.add(node.id);
            normalizedIds.add(normalizedId);
        });

        const edgeKeys = new Set();
        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        const edges = rawEdges.map((edge) => normalizeEdge(edge, nodeById, maxEvidenceRefs))
            .filter((edge) => {
                const key = `${edge.source}->${edge.target}:${edge.kind}`;
                if (edgeKeys.has(key)) {
                    return false;
                }
                edgeKeys.add(key);
                return true;
            });

        return {
            schemaVersion,
            projectionVersion: schemaVersion,
            workspaceId: cleanString(rawProjection.workspaceId) || 'workspace',
            revision: cleanString(rawProjection.revision),
            nodes,
            edges,
            adjacency: buildAdjacency(nodes, edges, maxNeighbors),
            extensions: isRecord(rawProjection.extensions) ? rawProjection.extensions : {},
        };
    }

    function createKnowledgeProjection(graph, options) {
        if (!isRecord(graph)) {
            throw new Error('Knowledge graph payload must be an object.');
        }
        const projectionOptions = isRecord(options) ? options : {};
        return normalizeProjection({
            ...graph,
            schemaVersion: graph.schemaVersion !== undefined
                ? graph.schemaVersion
                : (graph.projectionVersion !== undefined ? graph.projectionVersion : SCHEMA_VERSION),
            workspaceId: projectionOptions.workspaceId !== undefined
                ? projectionOptions.workspaceId
                : graph.workspaceId,
            revision: projectionOptions.revision !== undefined
                ? projectionOptions.revision
                : graph.revision,
        }, projectionOptions);
    }

    function replayKnowledgeProjection(serialized, options) {
        let payload = serialized;
        if (typeof serialized === 'string') {
            try {
                payload = JSON.parse(serialized);
            } catch (error) {
                throw new Error(`Knowledge projection JSON is invalid: ${String(error && error.message || error)}.`);
            }
        }
        return normalizeProjection(payload, options);
    }

    return Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        limits: Object.freeze({ maxNodes: MAX_NODES, maxEdges: MAX_EDGES, maxNeighbors: MAX_NEIGHBORS, maxEvidenceRefs: MAX_EVIDENCE_REFS }),
        classifyEdgeKind,
        normalizeProjection,
        createKnowledgeProjection,
        replayKnowledgeProjection,
    });
}));

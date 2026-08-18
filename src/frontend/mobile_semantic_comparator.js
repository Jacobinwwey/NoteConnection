(function attachMobileSemanticComparator(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.NoteConnectionMobileSemanticComparator = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileSemanticComparator() {
    'use strict';

    const SOURCE_URI_PREFIX = 'note://workspace/v1/';
    const MAX_DIAGNOSTICS = 64;

    function normalizeText(value) {
        const text = String(value || '').trim();
        return typeof text.normalize === 'function' ? text.normalize('NFC') : text;
    }

    function normalizePath(value) {
        const text = normalizeText(value)
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/^knowledge_base\//i, '');
        const segments = [];
        for (const segment of text.split('/')) {
            if (!segment || segment === '.') {
                continue;
            }
            if (segment === '..') {
                if (segments.length === 0) {
                    return '';
                }
                segments.pop();
                continue;
            }
            segments.push(segment);
        }
        return segments.join('/').replace(/\.(?:md|markdown)$/i, '').toLowerCase();
    }

    function canonicalIdFromSourceUri(sourceUri) {
        const normalized = normalizeText(sourceUri);
        if (!normalized.startsWith(SOURCE_URI_PREFIX)) {
            return '';
        }
        try {
            const decoded = normalized.slice(SOURCE_URI_PREFIX.length)
                .split('/')
                .map((segment) => decodeURIComponent(segment))
                .join('/');
            return normalizePath(decoded);
        } catch (_error) {
            return '';
        }
    }

    function normalizeSourceUri(sourceUri) {
        const normalized = normalizeText(sourceUri);
        if (!normalized) {
            return '';
        }
        const canonicalId = canonicalIdFromSourceUri(normalized);
        return canonicalId ? `${SOURCE_URI_PREFIX}${canonicalId.split('/').map(encodeURIComponent).join('/')}.md` : normalized;
    }

    function nodeCanonicalId(node) {
        return normalizePath(node && node.canonicalId)
            || canonicalIdFromSourceUri(node && node.sourceUri)
            || normalizePath(node && node.id);
    }

    function nodeIdentity(node) {
        const canonicalId = nodeCanonicalId(node);
        if (canonicalId) {
            return `canonical:${canonicalId}`;
        }
        const sourceUri = normalizeSourceUri(node && node.sourceUri);
        if (sourceUri) {
            return `uri:${sourceUri}`;
        }
        const legacyId = normalizeText(node && node.id).toLowerCase();
        if (legacyId) {
            return `legacy:${legacyId}`;
        }
        throw new Error('Semantic parity requires every node to expose an identity.');
    }

    function nodeSignature(node) {
        return {
            canonicalId: nodeCanonicalId(node),
            sourceUri: normalizeSourceUri(node && node.sourceUri),
        };
    }

    function endpointIdentity(rawEndpoint, rawUri, nodeById) {
        const endpointId = rawEndpoint && typeof rawEndpoint === 'object'
            ? normalizeText(rawEndpoint.id)
            : normalizeText(rawEndpoint);
        const node = nodeById.get(endpointId) || nodeById.get(endpointId.toLowerCase());
        const endpointUri = normalizeSourceUri(rawUri) || normalizeSourceUri(node && node.sourceUri);
        const canonicalId = nodeCanonicalId(node) || canonicalIdFromSourceUri(rawUri);
        if (canonicalId) {
            return {
                identity: `canonical:${canonicalId}`,
                sourceUri: endpointUri,
            };
        }
        if (endpointUri) {
            return {
                identity: `uri:${endpointUri}`,
                sourceUri: endpointUri,
            };
        }
        if (endpointId) {
            return {
                identity: `legacy:${endpointId.toLowerCase()}`,
                sourceUri: '',
            };
        }
        throw new Error('Semantic parity requires every edge endpoint to resolve.');
    }

    function semanticEdge(rawEdge, nodeById) {
        if (!rawEdge || typeof rawEdge !== 'object') {
            throw new Error('Semantic parity requires every edge to be an object.');
        }
        const source = endpointIdentity(rawEdge.source || rawEdge.from, rawEdge.sourceUri, nodeById);
        const target = endpointIdentity(rawEdge.target || rawEdge.to, rawEdge.targetUri, nodeById);
        const type = normalizeText(rawEdge.type) || 'association';
        const kind = normalizeText(rawEdge.kind).toLowerCase() || 'explicit';
        const provenance = normalizeText(rawEdge.provenance) || type;
        return {
            source: source.identity,
            target: target.identity,
            sourceUri: source.sourceUri,
            targetUri: target.sourceUri,
            type,
            kind,
            provenance,
        };
    }

    function edgeKey(edge) {
        return [
            edge.source,
            edge.target,
            edge.sourceUri,
            edge.targetUri,
            edge.type,
            edge.kind,
            edge.provenance,
        ].join('|');
    }

    function buildIndex(projection, side) {
        if (!projection || typeof projection !== 'object') {
            throw new Error(`${side} projection must be an object.`);
        }
        const nodes = Array.isArray(projection.nodes) ? projection.nodes : [];
        const edges = Array.isArray(projection.edges) ? projection.edges : [];
        const nodeByIdentity = new Map();
        const nodeById = new Map();
        nodes.forEach((node) => {
            const identity = nodeIdentity(node);
            if (nodeByIdentity.has(identity)) {
                throw new Error(`${side} projection contains duplicate semantic node identity: ${identity}.`);
            }
            const id = normalizeText(node && node.id);
            if (!id) {
                throw new Error(`${side} projection contains a node without an id.`);
            }
            nodeByIdentity.set(identity, {
                identity,
                signature: nodeSignature(node),
            });
            nodeById.set(id, node);
            nodeById.set(id.toLowerCase(), node);
        });

        const edgeByKey = new Map();
        edges.forEach((edge) => {
            const semantic = semanticEdge(edge, nodeById);
            const key = edgeKey(semantic);
            if (edgeByKey.has(key)) {
                throw new Error(`${side} projection contains duplicate semantic edge: ${key}.`);
            }
            edgeByKey.set(key, semantic);
        });
        return { nodeByIdentity, edgeByKey };
    }

    function boundedDiagnostics(values) {
        return values.sort().slice(0, MAX_DIAGNOSTICS);
    }

    function compareSemanticProjections(leftProjection, rightProjection) {
        const left = buildIndex(leftProjection, 'left');
        const right = buildIndex(rightProjection, 'right');
        const missingNodes = [];
        const extraNodes = [];
        const nodeMismatches = [];
        left.nodeByIdentity.forEach((leftNode, identity) => {
            const rightNode = right.nodeByIdentity.get(identity);
            if (!rightNode) {
                missingNodes.push(identity);
                return;
            }
            if (JSON.stringify(leftNode.signature) !== JSON.stringify(rightNode.signature)) {
                nodeMismatches.push({ identity, left: leftNode.signature, right: rightNode.signature });
            }
        });
        right.nodeByIdentity.forEach((_rightNode, identity) => {
            if (!left.nodeByIdentity.has(identity)) {
                extraNodes.push(identity);
            }
        });

        const missingEdges = [];
        const extraEdges = [];
        left.edgeByKey.forEach((_edge, key) => {
            if (!right.edgeByKey.has(key)) {
                missingEdges.push(key);
            }
        });
        right.edgeByKey.forEach((_edge, key) => {
            if (!left.edgeByKey.has(key)) {
                extraEdges.push(key);
            }
        });

        return {
            equal: missingNodes.length === 0
                && extraNodes.length === 0
                && nodeMismatches.length === 0
                && missingEdges.length === 0
                && extraEdges.length === 0,
            left: { nodeCount: left.nodeByIdentity.size, edgeCount: left.edgeByKey.size },
            right: { nodeCount: right.nodeByIdentity.size, edgeCount: right.edgeByKey.size },
            missingNodes: boundedDiagnostics(missingNodes),
            extraNodes: boundedDiagnostics(extraNodes),
            nodeMismatches: nodeMismatches.slice(0, MAX_DIAGNOSTICS),
            missingEdges: boundedDiagnostics(missingEdges),
            extraEdges: boundedDiagnostics(extraEdges),
        };
    }

    function assertSemanticParity(leftProjection, rightProjection, label) {
        const comparison = compareSemanticProjections(leftProjection, rightProjection);
        if (!comparison.equal) {
            const prefix = label ? `${label}: ` : '';
            const error = new Error(`${prefix}semantic projection parity failed: ${JSON.stringify(comparison)}`);
            error.comparison = comparison;
            throw error;
        }
        return comparison;
    }

    return Object.freeze({
        canonicalIdFromSourceUri,
        compareSemanticProjections,
        assertSemanticParity,
    });
}));

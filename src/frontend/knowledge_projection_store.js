(function attachKnowledgeProjectionStore(root, factory) {
    const api = factory(root && root.NoteConnectionKnowledgeProjection);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.NoteConnectionKnowledgeProjectionStore = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createProjectionStoreApi(projectionContract) {
    'use strict';

    const STORE_VERSION = 1;
    const DEFAULT_MAX_BYTES = 48 * 1024 * 1024;

    function requireProjectionContract() {
        if (!projectionContract || typeof projectionContract.replayKnowledgeProjection !== 'function') {
            throw new Error('Knowledge projection contract is unavailable.');
        }
        return projectionContract;
    }

    function normalizeProjection(value, options) {
        return requireProjectionContract().replayKnowledgeProjection(value, options);
    }

    function measureBytes(value) {
        const text = String(value || '');
        if (typeof TextEncoder === 'function') {
            return new TextEncoder().encode(text).length;
        }
        if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
            return Buffer.byteLength(text, 'utf8');
        }
        return text.length;
    }

    function metadataFor(projection) {
        return Object.freeze({
            schemaVersion: projection.schemaVersion,
            projectionVersion: projection.projectionVersion,
            workspaceId: projection.workspaceId,
            revision: projection.revision,
            nodeCount: projection.nodes.length,
            edgeCount: projection.edges.length,
        });
    }

    function createMemoryProjectionStore(initialProjection, options) {
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        let current = initialProjection === undefined || initialProjection === null
            ? null
            : normalizeProjection(initialProjection, normalizedOptions);

        return Object.freeze({
            kind: 'memory',
            async load() {
                return current;
            },
            async save(projection) {
                current = normalizeProjection(projection, normalizedOptions);
                return current;
            },
            async metadata() {
                return current ? metadataFor(current) : null;
            },
        });
    }

    function createPersistentProjectionStore(options) {
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        const read = normalizedOptions.read;
        const write = normalizedOptions.write;
        if (typeof read !== 'function') {
            return createMemoryProjectionStore(normalizedOptions.initialProjection, normalizedOptions);
        }

        const maxBytes = Math.max(1024, Math.floor(Number(normalizedOptions.maxBytes) || DEFAULT_MAX_BYTES));
        let cached = normalizedOptions.initialProjection === undefined || normalizedOptions.initialProjection === null
            ? null
            : normalizeProjection(normalizedOptions.initialProjection, normalizedOptions);
        let loadPromise = null;

        const load = async () => {
            if (cached) {
                return cached;
            }
            if (loadPromise) {
                return await loadPromise;
            }
            loadPromise = (async () => {
                try {
                    const payload = await read();
                    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
                    if (measureBytes(serialized) > maxBytes) {
                        throw new Error(`Knowledge projection payload exceeds ${maxBytes} bytes.`);
                    }
                    cached = normalizeProjection(payload, normalizedOptions);
                    return cached;
                } catch (error) {
                    // A prior successful write remains a valid local fallback when a host
                    // storage adapter is temporarily unavailable after a restart.
                    if (cached) {
                        return cached;
                    }
                    throw error;
                } finally {
                    loadPromise = null;
                }
            })();
            return await loadPromise;
        };

        return Object.freeze({
            kind: typeof write === 'function' ? 'persistent' : 'read-through',
            load,
            async save(projection) {
                const next = normalizeProjection(projection, normalizedOptions);
                const serialized = JSON.stringify(next);
                if (measureBytes(serialized) > maxBytes) {
                    throw new Error(`Knowledge projection payload exceeds ${maxBytes} bytes.`);
                }
                if (typeof write !== 'function') {
                    throw new Error('Knowledge projection store is read-only in this runtime.');
                }
                await write(serialized, next);
                cached = next;
                return next;
            },
            async metadata() {
                const projection = await load();
                return projection ? metadataFor(projection) : null;
            },
        });
    }

    function createProjectionStore(options) {
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        if (typeof normalizedOptions.read === 'function') {
            return createPersistentProjectionStore(normalizedOptions);
        }
        return createMemoryProjectionStore(normalizedOptions.initialProjection, normalizedOptions);
    }

    return Object.freeze({
        storeVersion: STORE_VERSION,
        defaultMaxBytes: DEFAULT_MAX_BYTES,
        createProjectionStore,
        createMemoryProjectionStore,
        createPersistentProjectionStore,
        metadataFor,
    });
}));

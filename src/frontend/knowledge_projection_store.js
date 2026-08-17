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
        let hasLoaded = false;
        let loadPromise = null;

        const load = async () => {
            if (hasLoaded && cached) {
                return cached;
            }
            if (loadPromise) {
                return await loadPromise;
            }
            loadPromise = (async () => {
                let payload;
                try {
                    payload = await read();
                } catch (error) {
                    if (cached) {
                        return cached;
                    }
                    throw error;
                }
                const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
                if (typeof serialized !== 'string') {
                    throw new Error('Knowledge projection payload is not serializable.');
                }
                if (measureBytes(serialized) > maxBytes) {
                    throw new Error(`Knowledge projection payload exceeds ${maxBytes} bytes.`);
                }
                // Validation errors must not be hidden by a stale in-memory value.
                cached = normalizeProjection(payload, normalizedOptions);
                hasLoaded = true;
                return cached;
            })();
            try {
                return await loadPromise;
            } finally {
                loadPromise = null;
            }
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
                hasLoaded = true;
                return next;
            },
            async metadata() {
                const projection = await load();
                return projection ? metadataFor(projection) : null;
            },
        });
    }

    function createFileProjectionStore(options) {
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        const fileName = typeof normalizedOptions.fileName === 'string'
            ? normalizedOptions.fileName.trim()
            : '';
        const readFile = normalizedOptions.readFile;
        const writeAtomic = normalizedOptions.writeAtomic;

        if (!fileName) {
            throw new Error('App-local projection file name is required.');
        }
        if (typeof readFile !== 'function') {
            throw new Error('App-local projection readFile adapter is required.');
        }
        if (writeAtomic !== undefined && typeof writeAtomic !== 'function') {
            throw new Error('App-local projection writeAtomic adapter must be callable.');
        }
        if (normalizedOptions.write !== undefined) {
            throw new Error('App-local projection writes must use the writeAtomic adapter.');
        }

        const persistentOptions = {
            ...Object.fromEntries(Object.entries(normalizedOptions).filter(([key]) => (
                key !== 'fileName'
                && key !== 'readFile'
                && key !== 'writeAtomic'
                && key !== 'read'
                && key !== 'write'
            ))),
            read: async () => await readFile(fileName),
        };
        if (typeof writeAtomic === 'function') {
            persistentOptions.write = async (serialized, projection) => {
                await writeAtomic(fileName, serialized, projection);
            };
        }

        const store = createPersistentProjectionStore(persistentOptions);
        return Object.freeze({
            ...store,
            kind: typeof writeAtomic === 'function' ? 'file-persistent' : 'file-read-through',
            fileName,
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
        createFileProjectionStore,
        metadataFor,
    });
}));

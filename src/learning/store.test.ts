import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import {
    createGraphDbSnapshotAdapter,
    createFileGraphDbSnapshotAdapter,
    createKnowledgeGraphStore,
    normalizeGraphDbSnapshotAdapterProvider,
    normalizeGraphDbStoreOperationMode,
    normalizeKnowledgeGraphStoreBackend,
    type GraphDbSnapshotAdapter,
    type KnowledgeGraphSnapshot,
} from './store';

function createSnapshot(seed: string): KnowledgeGraphSnapshot {
    return {
        schemaVersion: 1,
        savedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        idCounter: 1,
        atoms: [],
        evidenceSpans: [],
        relationEdges: [],
        temporalEdges: [],
        documents: [],
        activeStableKeyToAtomId: [],
        activeAtomIds: [],
        learnerStates: [],
        tutorTraces: [],
        ingestLatencyHistoryMs: [],
        recomputeLatencyHistoryMs: [],
        queryLatencyHistoryMs: [],
        latestIngestSummary: null,
        sessionActionTelemetry: {
            executionCount: 0,
            analyzedAnswerCount: 0,
            inferredMasteryUpdateCount: 0,
            explicitMasteryUpdateCount: 0,
            memoryPersistedCount: 0,
            memoryPromotionAppliedCount: 0,
            memoryPromotionCount: 0,
            verifiedTutorCount: 0,
            pendingVerificationCount: 0,
            outcomeCounts: {
                correct: 0,
                partial: 0,
                incorrect: 0,
                skipped: 0,
            },
        },
        sessionExecutionHistory: [],
        userMemory: {
            [seed]: {
                session: [],
                unit: [],
                long_term: [],
            },
        },
        relationEdgeSignatures: [],
    };
}

function buildProbeMetadataFromSnapshot(snapshot: KnowledgeGraphSnapshot | null): {
    schemaVersion?: number;
    savedAt?: string;
    atomCount?: number;
    relationEdgeCount?: number;
    temporalEdgeCount?: number;
    documentCount?: number;
} | null {
    if (!snapshot) {
        return null;
    }
    return {
        schemaVersion: snapshot.schemaVersion,
        savedAt: snapshot.savedAt,
        atomCount: snapshot.atoms.length,
        relationEdgeCount: snapshot.relationEdges.length,
        temporalEdgeCount: snapshot.temporalEdges.length,
        documentCount: snapshot.documents.length,
    };
}

async function startMockGraphDbSnapshotServer(): Promise<{
    endpoint: string;
    requests: Array<{ method: string; path: string; body: unknown }>;
    close: () => Promise<void>;
}> {
    let persistedSnapshot: KnowledgeGraphSnapshot | null = null;
    const requests: Array<{ method: string; path: string; body: unknown }> = [];
    const server = http.createServer((req, res) => {
        const method = String(req.method || 'GET').toUpperCase();
        const requestPath = String(req.url || '');
        let rawBody = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            rawBody += chunk;
        });
        req.on('end', () => {
            let parsedBody: unknown = null;
            if (rawBody.trim().length > 0) {
                try {
                    parsedBody = JSON.parse(rawBody);
                } catch {
                    parsedBody = rawBody;
                }
            }
            requests.push({
                method,
                path: requestPath,
                body: parsedBody,
            });
            if (requestPath !== '/graphdb/snapshot') {
                res.statusCode = 404;
                res.setHeader('X-Request-Id', `graphdb-mock-${requests.length}`);
                res.setHeader('X-Error-Code', 'not_found');
                res.end(JSON.stringify({ error: 'not_found' }));
                return;
            }
            if (method === 'GET') {
                if (!persistedSnapshot) {
                    res.statusCode = 404;
                    res.setHeader('X-Request-Id', `graphdb-mock-${requests.length}`);
                    res.setHeader('X-Error-Code', 'snapshot_not_found');
                    res.end(JSON.stringify({ error: 'snapshot_not_found' }));
                    return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('X-Request-Id', `graphdb-mock-${requests.length}`);
                res.end(JSON.stringify({ success: true, snapshot: persistedSnapshot }));
                return;
            }
            if (method === 'POST') {
                const nextSnapshot = (
                    parsedBody
                    && typeof parsedBody === 'object'
                    && !Array.isArray(parsedBody)
                    && Object.prototype.hasOwnProperty.call(parsedBody, 'snapshot')
                )
                    ? (parsedBody as { snapshot: KnowledgeGraphSnapshot }).snapshot
                    : null;
                if (!nextSnapshot) {
                    res.statusCode = 400;
                    res.setHeader('X-Request-Id', `graphdb-mock-${requests.length}`);
                    res.setHeader('X-Error-Code', 'snapshot_required');
                    res.end(JSON.stringify({ error: 'snapshot_required' }));
                    return;
                }
                persistedSnapshot = nextSnapshot;
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('X-Request-Id', `graphdb-mock-${requests.length}`);
                res.end(JSON.stringify({ success: true }));
                return;
            }
            res.statusCode = 405;
            res.setHeader('X-Request-Id', `graphdb-mock-${requests.length}`);
            res.setHeader('X-Error-Code', 'method_not_allowed');
            res.end(JSON.stringify({ error: 'method_not_allowed' }));
        });
    });

    const port = await new Promise<number>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address !== 'object') {
                reject(new Error('Failed to allocate mock graphdb port.'));
                return;
            }
            resolve(address.port);
        });
    });

    return {
        endpoint: `http://127.0.0.1:${port}/graphdb`,
        requests,
        close: () => new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        }),
    };
}

describe('Knowledge graph store backend factory', () => {
    test('memory backend stores and restores snapshots in-process', async () => {
        const store = createKnowledgeGraphStore({
            backend: 'memory',
            filePath: '/tmp/unused.v1.json',
        });

        expect(store.getDiagnostics().storeType).toBe('memory');
        expect(await store.loadSnapshot()).toBeNull();

        const snapshot = createSnapshot('memory_user');
        await store.saveSnapshot(snapshot);
        const restored = await store.loadSnapshot();

        expect(restored).toEqual(snapshot);
        expect(store.getDiagnostics().exists).toBe(true);
        expect(store.getDiagnostics().loaded).toBe(true);
    });

    test('unknown backend value is normalized to file backend', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-test-'));
        const filePath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');

        try {
            expect(normalizeKnowledgeGraphStoreBackend('unknown-backend')).toBe('file');

            const store = createKnowledgeGraphStore({
                backend: 'unknown-backend',
                filePath,
            });
            const snapshot = createSnapshot('file_user');

            await store.saveSnapshot(snapshot);
            const restored = await store.loadSnapshot();

            expect(restored).toEqual(snapshot);
            const diagnostics = store.getDiagnostics();
            expect(diagnostics.storeType).toBe('file');
            expect(diagnostics.exists).toBe(true);
            expect(fs.existsSync(filePath)).toBe(true);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('normalizes graphdb adapter provider aliases', () => {
        expect(normalizeGraphDbSnapshotAdapterProvider('file')).toBe('file');
        expect(normalizeGraphDbSnapshotAdapterProvider('local-file')).toBe('file');
        expect(normalizeGraphDbSnapshotAdapterProvider('external_http')).toBe('http');
        expect(normalizeGraphDbSnapshotAdapterProvider('remote-http')).toBe('http');
        expect(normalizeGraphDbSnapshotAdapterProvider('service')).toBe('http');
        expect(normalizeGraphDbSnapshotAdapterProvider('none')).toBe('none');
        expect(normalizeGraphDbSnapshotAdapterProvider('disabled')).toBe('none');
        expect(normalizeGraphDbSnapshotAdapterProvider('fallback_only')).toBe('none');
        expect(normalizeGraphDbSnapshotAdapterProvider('unknown')).toBe('file');
    });

    test('normalizes graphdb operation mode aliases', () => {
        expect(normalizeGraphDbStoreOperationMode('snapshot')).toBe('snapshot_only');
        expect(normalizeGraphDbStoreOperationMode('snapshot_only')).toBe('snapshot_only');
        expect(normalizeGraphDbStoreOperationMode('ops')).toBe('ops_preferred');
        expect(normalizeGraphDbStoreOperationMode('ops_preferred')).toBe('ops_preferred');
        expect(normalizeGraphDbStoreOperationMode('operations')).toBe('ops_preferred');
        expect(normalizeGraphDbStoreOperationMode('unknown')).toBe('snapshot_only');
    });

    test('graphdb adapter factory supports provider-based rollout selection', async () => {
        const disabledAdapter = createGraphDbSnapshotAdapter({
            provider: 'none',
            filePath: '/tmp/unused.graphdb.v1.json',
        });
        expect(disabledAdapter).toBeNull();

        const fileAdapter = createGraphDbSnapshotAdapter({
            provider: 'file',
            filePath: '/tmp/knowledge_graph_store.graphdb.v1.json',
            fileAdapterId: 'file-adapter-from-factory',
        });
        expect(fileAdapter?.id).toBe('file-adapter-from-factory');

        const mockServer = await startMockGraphDbSnapshotServer();
        try {
            const httpAdapter = createGraphDbSnapshotAdapter({
                provider: 'external_http',
                filePath: '/tmp/unused.graphdb.v1.json',
                adapterId: 'http-adapter-from-factory',
                httpEndpoint: mockServer.endpoint,
                httpTimeoutMs: 800,
                httpMaxRetries: 0,
            });
            expect(httpAdapter?.id).toBe('http-adapter-from-factory');
        } finally {
            await mockServer.close();
        }
    });

    test('graphdb backend falls back to file store when adapter is not configured', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-graphdb-fallback-'));
        const filePath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');

        try {
            expect(normalizeKnowledgeGraphStoreBackend('graphdb')).toBe('graphdb');

            const store = createKnowledgeGraphStore({
                backend: 'graphdb',
                filePath,
            });
            const snapshot = createSnapshot('graphdb_fallback_user');
            await store.saveSnapshot(snapshot);
            const restored = await store.loadSnapshot();

            expect(restored).toEqual(snapshot);
            expect(fs.existsSync(filePath)).toBe(true);
            const diagnostics = store.getDiagnostics();
            expect(diagnostics.storeType).toBe('graphdb');
            expect(diagnostics.backendReady).toBe(false);
            expect(diagnostics.usingFallback).toBe(true);
            expect(diagnostics.fallbackStoreType).toBe('file');
            expect(diagnostics.graphDbOperationMode).toBe('snapshot_only');
            expect(diagnostics.graphDbAdapterCapabilityMode).toBe('unknown');
            expect(diagnostics.graphDbReadPath).toBe('fallback');
            expect(diagnostics.graphDbWritePath).toBe('fallback');
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('graphdb backend uses configured adapter and bypasses file fallback', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-graphdb-adapter-'));
        const filePath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');
        let persisted: KnowledgeGraphSnapshot | null = null;
        const adapter: GraphDbSnapshotAdapter = {
            id: 'mock-graphdb',
            async loadSnapshot() {
                return persisted;
            },
            async saveSnapshot(snapshot) {
                persisted = snapshot;
            },
            getDiagnostics() {
                return {
                    location: 'graphdb://mock',
                    exists: persisted !== null,
                    loaded: true,
                };
            },
        };

        try {
            const store = createKnowledgeGraphStore({
                backend: 'graphdb',
                filePath,
                graphDbAdapter: adapter,
            });
            const snapshot = createSnapshot('graphdb_adapter_user');
            await store.saveSnapshot(snapshot);
            const restored = await store.loadSnapshot();

            expect(restored).toEqual(snapshot);
            expect(fs.existsSync(filePath)).toBe(false);
            const diagnostics = store.getDiagnostics();
            expect(diagnostics.storeType).toBe('graphdb');
            expect(diagnostics.location).toBe('graphdb://mock');
            expect(diagnostics.backendReady).toBe(true);
            expect(diagnostics.usingFallback).toBe(false);
            expect(diagnostics.adapterId).toBe('mock-graphdb');
            expect(diagnostics.graphDbOperationMode).toBe('snapshot_only');
            expect(diagnostics.graphDbAdapterCapabilityMode).toBe('snapshot_only');
            expect(diagnostics.graphDbReadPath).toBe('snapshot');
            expect(diagnostics.graphDbWritePath).toBe('snapshot');
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('graphdb backend negotiates ops-capable adapter path when operation mode is ops_preferred', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-graphdb-ops-capable-'));
        const filePath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');
        let persisted: KnowledgeGraphSnapshot | null = null;
        let probeCount = 0;
        let loadOpsCount = 0;
        let saveOpsCount = 0;
        const adapter: GraphDbSnapshotAdapter = {
            id: 'mock-graphdb-ops-capable',
            getCapabilities() {
                return {
                    mode: 'ops_capable',
                    supportedReadOperations: ['load_snapshot', 'load_snapshot_by_ops', 'probe_snapshot_metadata'],
                    supportedWriteOperations: ['save_snapshot', 'save_snapshot_by_ops'],
                };
            },
            async loadSnapshot() {
                throw new Error('snapshot_path_should_not_be_used_when_ops_is_available');
            },
            async saveSnapshot() {
                throw new Error('snapshot_path_should_not_be_used_when_ops_is_available');
            },
            async probeSnapshotMetadata() {
                probeCount += 1;
                if (!persisted) {
                    return null;
                }
                return {
                    schemaVersion: persisted.schemaVersion,
                    savedAt: persisted.savedAt,
                    atomCount: persisted.atoms.length,
                    relationEdgeCount: persisted.relationEdges.length,
                    temporalEdgeCount: persisted.temporalEdges.length,
                    documentCount: persisted.documents.length,
                };
            },
            async loadSnapshotByOps() {
                loadOpsCount += 1;
                return persisted;
            },
            async saveSnapshotByOps(snapshot) {
                saveOpsCount += 1;
                persisted = snapshot;
            },
            getDiagnostics() {
                return {
                    location: 'graphdb://mock-ops-capable',
                    exists: persisted !== null,
                    loaded: true,
                    capabilityMode: 'ops_capable',
                    supportedReadOperations: ['load_snapshot', 'load_snapshot_by_ops', 'probe_snapshot_metadata'],
                    supportedWriteOperations: ['save_snapshot', 'save_snapshot_by_ops'],
                    lastReadPath: 'ops',
                    lastWritePath: 'ops',
                };
            },
        };

        try {
            const store = createKnowledgeGraphStore({
                backend: 'graphdb',
                filePath,
                graphDbAdapter: adapter,
                graphDbOperationMode: 'ops_preferred',
            });
            const snapshot = createSnapshot('graphdb_ops_capable_user');
            await store.saveSnapshot(snapshot);
            const restored = await store.loadSnapshot();

            expect(restored).toEqual(snapshot);
            expect(probeCount).toBeGreaterThanOrEqual(1);
            expect(loadOpsCount).toBeGreaterThanOrEqual(1);
            expect(saveOpsCount).toBeGreaterThanOrEqual(1);
            const diagnostics = store.getDiagnostics();
            expect(diagnostics.storeType).toBe('graphdb');
            expect(diagnostics.graphDbOperationMode).toBe('ops_preferred');
            expect(diagnostics.graphDbAdapterCapabilityMode).toBe('ops_capable');
            expect(diagnostics.graphDbReadPath).toBe('ops');
            expect(diagnostics.graphDbWritePath).toBe('ops');
            expect(diagnostics.graphDbSupportedReadOperations).toEqual(
                expect.arrayContaining(['load_snapshot_by_ops', 'probe_snapshot_metadata'])
            );
            expect(diagnostics.graphDbSupportedWriteOperations).toEqual(
                expect.arrayContaining(['save_snapshot_by_ops'])
            );
            expect(diagnostics.graphDbLastSnapshotMetadata?.schemaVersion).toBe(1);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('graphdb backend requires loadSnapshotByOps before classifying read path as ops', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-graphdb-probe-only-'));
        const filePath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');
        let persisted: KnowledgeGraphSnapshot | null = null;
        let probeCount = 0;
        let loadCount = 0;
        let saveCount = 0;
        const adapter: GraphDbSnapshotAdapter = {
            id: 'mock-graphdb-probe-only',
            getCapabilities() {
                return {
                    mode: 'ops_capable',
                    supportedReadOperations: ['load_snapshot', 'load_snapshot_by_ops', 'probe_snapshot_metadata'],
                    supportedWriteOperations: ['save_snapshot', 'save_snapshot_by_ops'],
                };
            },
            async loadSnapshot() {
                loadCount += 1;
                return persisted;
            },
            async saveSnapshot(snapshot) {
                saveCount += 1;
                persisted = snapshot;
            },
            async probeSnapshotMetadata() {
                probeCount += 1;
                return buildProbeMetadataFromSnapshot(persisted);
            },
        };

        try {
            const store = createKnowledgeGraphStore({
                backend: 'graphdb',
                filePath,
                graphDbAdapter: adapter,
                graphDbFallbackEnabled: false,
                graphDbOperationMode: 'ops_preferred',
            });
            const snapshot = createSnapshot('graphdb_probe_only_user');
            await store.saveSnapshot(snapshot);
            const restored = await store.loadSnapshot();

            expect(restored).toEqual(snapshot);
            expect(probeCount).toBe(0);
            expect(loadCount).toBeGreaterThanOrEqual(1);
            expect(saveCount).toBeGreaterThanOrEqual(1);
            const diagnostics = store.getDiagnostics();
            expect(diagnostics.graphDbOperationMode).toBe('ops_preferred');
            expect(diagnostics.graphDbAdapterCapabilityMode).toBe('ops_capable');
            expect(diagnostics.graphDbReadPath).toBe('snapshot');
            expect(diagnostics.graphDbWritePath).toBe('snapshot');
            expect(diagnostics.usingFallback).toBe(false);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('graphdb backend downgrades ops_preferred path to snapshot within adapter before fallback store', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-graphdb-ops-downgrade-'));
        const filePath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');
        let persisted: KnowledgeGraphSnapshot | null = null;
        let loadOpsCount = 0;
        let saveOpsCount = 0;
        let loadSnapshotCount = 0;
        let saveSnapshotCount = 0;
        const adapter: GraphDbSnapshotAdapter = {
            id: 'mock-graphdb-ops-downgrade',
            getCapabilities() {
                return {
                    mode: 'ops_capable',
                    supportedReadOperations: ['load_snapshot', 'load_snapshot_by_ops'],
                    supportedWriteOperations: ['save_snapshot', 'save_snapshot_by_ops'],
                };
            },
            async loadSnapshotByOps() {
                loadOpsCount += 1;
                throw new Error('ops_read_path_unavailable');
            },
            async saveSnapshotByOps() {
                saveOpsCount += 1;
                throw new Error('ops_write_path_unavailable');
            },
            async loadSnapshot() {
                loadSnapshotCount += 1;
                return persisted;
            },
            async saveSnapshot(snapshot) {
                saveSnapshotCount += 1;
                persisted = snapshot;
            },
        };

        try {
            const store = createKnowledgeGraphStore({
                backend: 'graphdb',
                filePath,
                graphDbAdapter: adapter,
                graphDbFallbackEnabled: false,
                graphDbOperationMode: 'ops_preferred',
            });
            const snapshot = createSnapshot('graphdb_ops_downgrade_user');
            await store.saveSnapshot(snapshot);
            const restored = await store.loadSnapshot();

            expect(restored).toEqual(snapshot);
            expect(saveOpsCount).toBeGreaterThanOrEqual(1);
            expect(loadOpsCount).toBeGreaterThanOrEqual(1);
            expect(saveSnapshotCount).toBeGreaterThanOrEqual(1);
            expect(loadSnapshotCount).toBeGreaterThanOrEqual(1);
            const diagnostics = store.getDiagnostics();
            expect(diagnostics.graphDbOperationMode).toBe('ops_preferred');
            expect(diagnostics.graphDbAdapterCapabilityMode).toBe('ops_capable');
            expect(diagnostics.graphDbReadPath).toBe('snapshot');
            expect(diagnostics.graphDbWritePath).toBe('snapshot');
            expect(diagnostics.usingFallback).toBe(false);
            expect(diagnostics.lastError).toBeUndefined();
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('graphdb backend keeps snapshot path when adapter is snapshot-only even if operation mode requests ops', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-graphdb-ops-fallback-'));
        const filePath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');
        let persisted: KnowledgeGraphSnapshot | null = null;
        let loadCount = 0;
        let saveCount = 0;
        const adapter: GraphDbSnapshotAdapter = {
            id: 'mock-graphdb-snapshot-only',
            getCapabilities() {
                return {
                    mode: 'snapshot_only',
                    supportedReadOperations: ['load_snapshot'],
                    supportedWriteOperations: ['save_snapshot'],
                };
            },
            async loadSnapshot() {
                loadCount += 1;
                return persisted;
            },
            async saveSnapshot(snapshot) {
                saveCount += 1;
                persisted = snapshot;
            },
            getDiagnostics() {
                return {
                    location: 'graphdb://mock-snapshot-only',
                    exists: persisted !== null,
                    loaded: true,
                    capabilityMode: 'snapshot_only',
                    supportedReadOperations: ['load_snapshot'],
                    supportedWriteOperations: ['save_snapshot'],
                    lastReadPath: 'snapshot',
                    lastWritePath: 'snapshot',
                };
            },
        };

        try {
            const store = createKnowledgeGraphStore({
                backend: 'graphdb',
                filePath,
                graphDbAdapter: adapter,
                graphDbOperationMode: 'ops_preferred',
            });
            const snapshot = createSnapshot('graphdb_snapshot_only_user');
            await store.saveSnapshot(snapshot);
            const restored = await store.loadSnapshot();

            expect(restored).toEqual(snapshot);
            expect(loadCount).toBeGreaterThanOrEqual(1);
            expect(saveCount).toBeGreaterThanOrEqual(1);
            const diagnostics = store.getDiagnostics();
            expect(diagnostics.graphDbOperationMode).toBe('ops_preferred');
            expect(diagnostics.graphDbAdapterCapabilityMode).toBe('snapshot_only');
            expect(diagnostics.graphDbReadPath).toBe('snapshot');
            expect(diagnostics.graphDbWritePath).toBe('snapshot');
            expect(diagnostics.graphDbSupportedReadOperations).toEqual(['load_snapshot']);
            expect(diagnostics.graphDbSupportedWriteOperations).toEqual(['save_snapshot']);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('graphdb backend fails closed when fallback is disabled and adapter is unavailable', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-graphdb-strict-no-adapter-'));
        const filePath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');

        try {
            const store = createKnowledgeGraphStore({
                backend: 'graphdb',
                filePath,
                graphDbAdapter: null,
                graphDbFallbackEnabled: false,
            });
            const snapshot = createSnapshot('graphdb_strict_user');

            await expect(store.saveSnapshot(snapshot)).rejects.toThrow('graphdb_adapter_unavailable_no_fallback');
            await expect(store.loadSnapshot()).rejects.toThrow('graphdb_adapter_unavailable_no_fallback');
            const diagnostics = store.getDiagnostics();
            expect(diagnostics.storeType).toBe('graphdb');
            expect(diagnostics.fallbackEnabled).toBe(false);
            expect(diagnostics.usingFallback).toBe(false);
            expect(diagnostics.graphDbOperationMode).toBe('snapshot_only');
            expect(diagnostics.graphDbAdapterCapabilityMode).toBe('unknown');
            expect(String(diagnostics.lastError || '')).toContain('graphdb_adapter_unavailable_no_fallback');
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('built-in file graphdb adapter persists snapshots to dedicated path', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-file-graphdb-'));
        const graphDbPath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.graphdb.v1.json');

        try {
            const adapter = createFileGraphDbSnapshotAdapter({
                filePath: graphDbPath,
                adapterId: 'file-graphdb-test',
            });
            const snapshot = createSnapshot('file_graphdb_user');
            await adapter.saveSnapshot(snapshot);
            const restored = await adapter.loadSnapshot();

            expect(restored).toEqual(snapshot);
            expect(fs.existsSync(graphDbPath)).toBe(true);
            const diagnostics = adapter.getDiagnostics ? adapter.getDiagnostics() : {};
            expect(diagnostics.location).toContain('knowledge_graph_store.graphdb.v1.json');
            expect(diagnostics.exists).toBe(true);
            expect(diagnostics.capabilityMode).toBe('ops_capable');
            expect(diagnostics.supportedReadOperations).toEqual(
                expect.arrayContaining(['load_snapshot', 'load_snapshot_by_ops', 'probe_snapshot_metadata'])
            );
            expect(diagnostics.supportedWriteOperations).toEqual(
                expect.arrayContaining(['save_snapshot', 'save_snapshot_by_ops'])
            );
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('built-in http graphdb adapter persists snapshots through remote endpoint', async () => {
        const mockServer = await startMockGraphDbSnapshotServer();
        try {
            const adapter = createGraphDbSnapshotAdapter({
                provider: 'http',
                filePath: '/tmp/unused.graphdb.v1.json',
                adapterId: 'http-graphdb-test',
                httpEndpoint: mockServer.endpoint,
                httpTimeoutMs: 1200,
                httpMaxRetries: 0,
            });
            expect(adapter).not.toBeNull();
            expect(adapter?.id).toBe('http-graphdb-test');

            const snapshot = createSnapshot('http_graphdb_user');
            await adapter!.saveSnapshot(snapshot);
            const restored = await adapter!.loadSnapshot();

            expect(restored).toEqual(snapshot);
            const diagnostics = adapter!.getDiagnostics ? adapter!.getDiagnostics() : {};
            expect(String(diagnostics.location || '')).toContain('/graphdb/snapshot');
            expect(diagnostics.exists).toBe(true);
            expect(diagnostics.capabilityMode).toBe('snapshot_only');
            expect(diagnostics.supportedReadOperations).toEqual(['load_snapshot']);
            expect(diagnostics.supportedWriteOperations).toEqual(['save_snapshot']);
            expect(String(diagnostics.connector?.healthStatus || '')).toBe('ready');
            expect(String(diagnostics.connector?.circuitState || '')).toBe('closed');
            expect(Number(diagnostics.connector?.requestCount || 0)).toBeGreaterThanOrEqual(2);
            expect(Number(diagnostics.connector?.successCount || 0)).toBeGreaterThanOrEqual(2);
            expect(Number(diagnostics.connector?.failureCount || 0)).toBe(0);
            expect(String(diagnostics.connector?.lastRequestId || '')).toContain('graphdb-mock-');
            expect(mockServer.requests.some((item) => item.method === 'POST' && item.path === '/graphdb/snapshot')).toBe(true);
            expect(mockServer.requests.some((item) => item.method === 'GET' && item.path === '/graphdb/snapshot')).toBe(true);
        } finally {
            await mockServer.close();
        }
    });

    test('built-in http graphdb adapter surfaces circuit-open telemetry after repeated transient failures', async () => {
        const server = http.createServer((req, res) => {
            const method = String(req.method || 'GET').toUpperCase();
            const requestPath = String(req.url || '');
            if (requestPath !== '/graphdb/snapshot' || method !== 'GET') {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('X-Request-Id', 'graphdb-flaky-nf');
                res.setHeader('X-Error-Code', 'not_found');
                res.end(JSON.stringify({ error: 'not_found' }));
                return;
            }
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Request-Id', 'graphdb-flaky-503');
            res.setHeader('X-Error-Code', 'overloaded');
            res.end(JSON.stringify({ error: 'overloaded' }));
        });

        const port = await new Promise<number>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                if (!address || typeof address !== 'object') {
                    reject(new Error('Failed to allocate graphdb flaky mock port.'));
                    return;
                }
                resolve(address.port);
            });
        });

        try {
            const adapter = createGraphDbSnapshotAdapter({
                provider: 'http',
                filePath: '/tmp/unused.graphdb.v1.json',
                adapterId: 'http-graphdb-circuit',
                httpEndpoint: `http://127.0.0.1:${port}/graphdb`,
                httpTimeoutMs: 1200,
                httpMaxRetries: 0,
                httpRetryDelayMs: 0,
                httpCircuitFailureThreshold: 2,
                httpCircuitCooldownMs: 60000,
            });
            expect(adapter).not.toBeNull();

            await expect(adapter!.loadSnapshot()).rejects.toThrow('graphdb_http_request_failed:503');
            await expect(adapter!.loadSnapshot()).rejects.toThrow('graphdb_http_request_failed:503');
            await expect(adapter!.loadSnapshot()).rejects.toThrow('graphdb_http_circuit_open');

            const diagnostics = adapter!.getDiagnostics ? adapter!.getDiagnostics() : {};
            expect(String(diagnostics.connector?.healthStatus || '')).toBe('unavailable');
            expect(String(diagnostics.connector?.circuitState || '')).toBe('open');
            expect(Number(diagnostics.connector?.shortCircuitCount || 0)).toBeGreaterThanOrEqual(1);
            expect(Number(diagnostics.connector?.failureCount || 0)).toBeGreaterThanOrEqual(2);
            expect(String(diagnostics.connector?.lastErrorCode || '')).toBe('circuit_open');
        } finally {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        }
    });
});

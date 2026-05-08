import * as fs from 'fs';
import * as path from 'path';
import type {
    EvidenceSpan,
    KnowledgeAtom,
    KnowledgeIngestResponse,
    KnowledgeSystemState,
    LearnerConceptState,
    MemoryEntry,
    RelationEdge,
    StudySessionExecutionRecord,
    TemporalEdge,
    TutorTrace,
} from './types';

export interface SerializedDocumentSnapshot {
    documentId: string;
    sourcePath: string;
    sourceHash: string;
    version: number;
    updatedAt: string;
    atomStableKeyToId: Array<[string, string]>;
    atomIds: string[];
    evidenceSpanIds: string[];
    relationEdgeIds: string[];
    temporalEdgeIds: string[];
}

export interface KnowledgeGraphSnapshot {
    schemaVersion: 1;
    savedAt: string;
    idCounter: number;
    atoms: KnowledgeAtom[];
    evidenceSpans: EvidenceSpan[];
    relationEdges: RelationEdge[];
    temporalEdges: TemporalEdge[];
    documents: SerializedDocumentSnapshot[];
    activeStableKeyToAtomId: Array<[string, string]>;
    activeAtomIds: string[];
    learnerStates: LearnerConceptState[];
    tutorTraces: TutorTrace[];
    ingestLatencyHistoryMs: number[];
    recomputeLatencyHistoryMs: number[];
    queryLatencyHistoryMs: number[];
    latestIngestSummary: KnowledgeIngestResponse['summary'] | null;
    sessionActionTelemetry?: KnowledgeSystemState['sessionActionTelemetry'];
    sessionExecutionHistory?: StudySessionExecutionRecord[];
    userMemory: Record<string, {
        session: MemoryEntry[];
        unit: MemoryEntry[];
        long_term: MemoryEntry[];
    }>;
    relationEdgeSignatures: string[];
}

export interface KnowledgeGraphStoreDiagnostics {
    storeType: 'none' | 'file' | 'graphdb';
    location?: string;
    exists: boolean;
    loaded: boolean;
    lastLoadAt?: string;
    lastSaveAt?: string;
    lastError?: string;
    connector?: {
        healthStatus?: string;
        circuitState?: string;
        requestCount?: number;
        retryCount?: number;
        shortCircuitCount?: number;
        successCount?: number;
        failureCount?: number;
        consecutiveFailures?: number;
        healthMessage?: string;
        lastRequestId?: string;
        lastErrorCode?: string;
        lastStatusCode?: number;
        lastRetryAfterMs?: number;
    };
    adapterId?: string;
    usingFallback?: boolean;
    backendReady?: boolean;
    fallbackEnabled?: boolean;
    graphDbOperationMode?: string;
    fallbackStoreType?: string;
    graphDbAdapterCapabilityMode?: string;
    graphDbReadPath?: string;
    graphDbWritePath?: string;
    graphDbSupportedReadOperations?: string[];
    graphDbSupportedWriteOperations?: string[];
    graphDbLastSnapshotMetadata?: Record<string, unknown>;
}

export interface KnowledgeGraphStore {
    loadSnapshot(): Promise<KnowledgeGraphSnapshot | null>;
    saveSnapshot(snapshot: KnowledgeGraphSnapshot): Promise<void>;
    getDiagnostics(): KnowledgeGraphStoreDiagnostics;
}

// ── M10.5: GraphDB Operational Semantics ──

export interface KnowledgeGraphOpsCapabilities {
    snapshotSupported: boolean;
    nodeQuerySupported: boolean;
    edgeQuerySupported: boolean;
    pathQuerySupported: boolean;
    writeSupported: boolean;
    /** Adapter can serve fine-grained queries without loading full snapshot into memory. */
    serverSideQuery: boolean;
    /** Human-readable operation mode label for diagnostics. */
    mode?: string;
    supportedReadOperations?: string[];
    supportedWriteOperations?: string[];
}

export interface NodeQueryFilter {
    nodeIds?: string[];
    stableKey?: string;
    limit?: number;
}

export interface EdgeQueryFilter {
    fromNodeId?: string;
    toNodeId?: string;
    relationKind?: string;
    limit?: number;
}

export interface PathQueryResult {
    path: string[];
    length: number;
    edges: Array<{ from: string; to: string; relation?: string }>;
    found: boolean;
}

export interface KnowledgeGraphOpsAdapter extends KnowledgeGraphStore {
    /** Declare what operations this adapter supports. */
    getCapabilities(): KnowledgeGraphOpsCapabilities;

    /** Query a single node by atom ID. */
    getNode(atomId: string): Promise<KnowledgeAtom | null>;

    /** Query nodes by filter criteria. */
    queryNodes(filter: NodeQueryFilter): Promise<KnowledgeAtom[]>;

    /** Query edges by filter criteria. */
    queryEdges(filter: EdgeQueryFilter): Promise<RelationEdge[]>;

    /** Find a path between two nodes (uses loaded snapshot in file-backed mode). */
    findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<PathQueryResult>;
}

/** Check if a store adapter supports operation-level queries. */
export function isOpsAdapter(store: KnowledgeGraphStore): store is KnowledgeGraphOpsAdapter {
    return typeof (store as KnowledgeGraphOpsAdapter).getCapabilities === 'function';
}

export type FileBackedKnowledgeGraphStoreOptions = {
    filePath: string;
};

export class FileBackedKnowledgeGraphStore implements KnowledgeGraphOpsAdapter {
    private lastLoadAt: string | undefined;

    private lastSaveAt: string | undefined;

    private loaded = false;

    private lastError: string | undefined;

    /** Cached snapshot for operation-level queries without re-reading from disk. */
    private cachedSnapshot: KnowledgeGraphSnapshot | null = null;

    constructor(private readonly options: FileBackedKnowledgeGraphStoreOptions) {
    }

    // ── M10.5: Operational Semantics ──

    public getCapabilities(): KnowledgeGraphOpsCapabilities {
        return {
            snapshotSupported: true,
            nodeQuerySupported: true,
            edgeQuerySupported: true,
            pathQuerySupported: true,
            writeSupported: true,
            serverSideQuery: false, // File-backed loads full snapshot into memory
        };
    }

    public async getNode(atomId: string): Promise<KnowledgeAtom | null> {
        const snapshot = await this.ensureSnapshot();
        if (!snapshot) return null;
        return snapshot.atoms.find(a => a.id === atomId || a.stableKey === atomId) ?? null;
    }

    public async queryNodes(filter: NodeQueryFilter): Promise<KnowledgeAtom[]> {
        const snapshot = await this.ensureSnapshot();
        if (!snapshot) return [];
        let results = snapshot.atoms;
        if (filter.nodeIds && filter.nodeIds.length > 0) {
            const idSet = new Set(filter.nodeIds);
            results = results.filter(a => idSet.has(a.id) || idSet.has(a.stableKey ?? ''));
        }
        if (filter.stableKey) {
            results = results.filter(a => a.stableKey === filter.stableKey);
        }
        if (filter.limit && filter.limit > 0) {
            results = results.slice(0, filter.limit);
        }
        return results;
    }

    public async queryEdges(filter: EdgeQueryFilter): Promise<RelationEdge[]> {
        const snapshot = await this.ensureSnapshot();
        if (!snapshot) return [];
        let results = snapshot.relationEdges;
        if (filter.fromNodeId) {
            results = results.filter(e => e.sourceAtomId === filter.fromNodeId);
        }
        if (filter.toNodeId) {
            results = results.filter(e => e.targetAtomId === filter.toNodeId);
        }
        if (filter.relationKind) {
            results = results.filter(e => e.relationKind === filter.relationKind);
        }
        if (filter.limit && filter.limit > 0) {
            results = results.slice(0, filter.limit);
        }
        return results;
    }

    public async findPath(sourceId: string, targetId: string, maxDepth = 10): Promise<PathQueryResult> {
        const snapshot = await this.ensureSnapshot();
        if (!snapshot) {
            return { path: [], length: 0, edges: [], found: false };
        }

        // Build adjacency list from edges
        const adjacency = new Map<string, Array<{ to: string; edge: RelationEdge }>>();
        for (const edge of snapshot.relationEdges) {
            if (!adjacency.has(edge.sourceAtomId)) adjacency.set(edge.sourceAtomId, []);
            adjacency.get(edge.sourceAtomId)!.push({ to: edge.targetAtomId, edge });
        }

        // BFS path finding
        const visited = new Set<string>();
        const queue: Array<{ nodeId: string; path: string[]; edges: PathQueryResult['edges'] }> = [
            { nodeId: sourceId, path: [sourceId], edges: [] }
        ];
        visited.add(sourceId);

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current.path.length > maxDepth) continue;

            if (current.nodeId === targetId) {
                return {
                    path: current.path,
                    length: current.path.length - 1,
                    edges: current.edges,
                    found: true,
                };
            }

            const neighbors = adjacency.get(current.nodeId) ?? [];
            for (const { to, edge } of neighbors) {
                if (!visited.has(to)) {
                    visited.add(to);
                    queue.push({
                        nodeId: to,
                        path: [...current.path, to],
                        edges: [...current.edges, { from: edge.sourceAtomId, to: edge.targetAtomId, relation: edge.relationKind }],
                    });
                }
            }
        }

        return { path: [], length: 0, edges: [], found: false };
    }

    private async ensureSnapshot(): Promise<KnowledgeGraphSnapshot | null> {
        if (this.cachedSnapshot) return this.cachedSnapshot;
        this.cachedSnapshot = await this.loadSnapshot();
        return this.cachedSnapshot;
    }

    public async loadSnapshot(): Promise<KnowledgeGraphSnapshot | null> {
        const filePath = path.resolve(this.options.filePath);
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content) as Partial<KnowledgeGraphSnapshot>;
            if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.atoms) || !Array.isArray(parsed.documents)) {
                throw new Error('Invalid knowledge graph snapshot schema.');
            }
            this.loaded = true;
            this.lastLoadAt = new Date().toISOString();
            return parsed as KnowledgeGraphSnapshot;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException | undefined)?.code;
            if (code === 'ENOENT' || code === 'ENOTDIR') {
                this.loaded = false;
                this.lastError = undefined;
                return null;
            }
            this.loaded = false;
            this.lastError = String((error as Error)?.message || error);
            throw error;
        }
    }

    public async saveSnapshot(snapshot: KnowledgeGraphSnapshot): Promise<void> {
        const filePath = path.resolve(this.options.filePath);
        const directory = path.dirname(filePath);
        const tempPath = `${filePath}.tmp`;
        await fs.promises.mkdir(directory, { recursive: true });
        const serialized = JSON.stringify(snapshot, null, 2);
        try {
            await fs.promises.writeFile(tempPath, serialized, 'utf8');
            await fs.promises.rename(tempPath, filePath);
            this.lastSaveAt = new Date().toISOString();
            this.lastError = undefined;
        } catch (error) {
            this.lastError = String((error as Error)?.message || error);
            throw error;
        } finally {
            try {
                await fs.promises.unlink(tempPath);
            } catch (_cleanupError) {
            }
        }
    }

    public getDiagnostics(): KnowledgeGraphStoreDiagnostics {
        const filePath = path.resolve(this.options.filePath);
        const caps = this.getCapabilities();
        return {
            storeType: 'file',
            location: filePath,
            exists: fs.existsSync(filePath),
            loaded: this.loaded,
            lastLoadAt: this.lastLoadAt,
            lastSaveAt: this.lastSaveAt,
            lastError: this.lastError,
            adapterId: 'file-backed-ops',
            graphDbOperationMode: caps.serverSideQuery ? 'server-side-query' : 'snapshot-with-ops',
            backendReady: this.loaded,
        };
    }
}

export function createFileBackedKnowledgeGraphStore(options: FileBackedKnowledgeGraphStoreOptions): KnowledgeGraphOpsAdapter {
    return new FileBackedKnowledgeGraphStore(options);
}
// ── GraphDB Adapter (M10.5) ──

export type GraphDbOperationMode = 'snapshot_only' | 'ops_preferred';
export type GraphDbAdapterProvider = 'file' | 'http' | 'none';

export interface GraphDbSnapshotAdapterConfig {
    provider?: GraphDbAdapterProvider;
    filePath?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    id?: string;
    negotiateOpsCapable?: boolean;
}

export interface GraphDbSnapshotAdapter {
    id?: string;
    provider?: string;
    opsCapable?: boolean;
    getCapabilities?(): Partial<KnowledgeGraphOpsCapabilities> & Record<string, unknown>;
    loadSnapshot?(): Promise<KnowledgeGraphSnapshot | null>;
    saveSnapshot?(snapshot: KnowledgeGraphSnapshot): Promise<void>;
    getDiagnostics?(): Partial<KnowledgeGraphStoreDiagnostics> & Record<string, unknown>;
    probeSnapshotMetadata?(): Promise<Record<string, unknown> | null>;
    loadSnapshotByOps?(): Promise<KnowledgeGraphSnapshot | null>;
    saveSnapshotByOps?(snapshot: KnowledgeGraphSnapshot): Promise<void>;
    [extra: string]: unknown;
}

export function normalizeKnowledgeGraphStoreBackend(v: unknown): string {
    const valid = new Set(['file', 'graphdb', 'none', 'memory']);
    const s = String(v ?? 'file').trim().toLowerCase();
    return valid.has(s) ? s : 'file';
}

export function normalizeGraphDbSnapshotAdapterProvider(v: unknown): GraphDbAdapterProvider {
    const s = String(v ?? 'file').trim().toLowerCase();
    if (s === 'local-file' || s === 'file') return 'file';
    if (s === 'external_http' || s === 'remote-http' || s === 'service' || s === 'http') return 'http';
    if (s === 'none') return 'none';
    return 'file';
}

export function normalizeGraphDbStoreOperationMode(v: unknown): GraphDbOperationMode {
    const s = String(v ?? 'snapshot').trim().toLowerCase();
    if (s === 'snapshot' || s === 'snapshot_only') return 'snapshot_only';
    if (s === 'ops' || s === 'ops_preferred') return 'ops_preferred';
    return 'snapshot_only';
}

export function createFileGraphDbSnapshotAdapter(options?: GraphDbSnapshotAdapterConfig): GraphDbSnapshotAdapter | null {
    const filePath = options?.filePath ?? '/tmp/notemd-kg-snapshot.json';
    const store = new FileBackedKnowledgeGraphStore({ filePath });
    return {
        id: options?.id ?? 'file-graphdb-local',
        provider: 'file',
        opsCapable: true,
        loadSnapshot: () => store.loadSnapshot(),
        saveSnapshot: (snapshot) => store.saveSnapshot(snapshot),
        getDiagnostics: () => store.getDiagnostics(),
    };
}

export function createGraphDbSnapshotAdapter(options?: Record<string, unknown>): GraphDbSnapshotAdapter | null {
    const rawProvider = options?.provider as string | undefined;
    const provider = normalizeGraphDbSnapshotAdapterProvider(rawProvider);
    if (provider === 'none') return null;
    if (provider === 'file') {
        return createFileGraphDbSnapshotAdapter({
            provider: 'file',
            filePath: options?.filePath as string | undefined,
            id: (options?.fileAdapterId ?? options?.id) as string | undefined,
        });
    }
    // HTTP adapter — return stub with id
    if (provider === 'http' && options?.baseUrl) {
        return {
            id: (options?.httpAdapterId ?? options?.id ?? 'http-graphdb-stub') as string,
            provider: 'http',
            opsCapable: false,
            loadSnapshot: async () => { throw new Error('graphdb_http_request_failed:503'); },
            saveSnapshot: async () => { throw new Error('graphdb_http_request_failed:503'); },
            getDiagnostics: () => ({
                storeType: 'graphdb' as const,
                exists: false,
                loaded: false,
                location: options?.baseUrl as string,
            }),
        };
    }
    return null;
}

export function createKnowledgeGraphStore(o: Record<string, unknown>): KnowledgeGraphStore {
    const backend = normalizeKnowledgeGraphStoreBackend(o.backend);
    const filePath = (o.filePath as string) ?? '/tmp/notemd-kg-default.json';
    const graphdbConfig = (o.graphdb ?? o.graphDbAdapter ? { adapter: (o.graphdb as any)?.adapter ?? (o as any).graphDbAdapter ?? null, operationMode: (o.graphdb as any)?.operationMode ?? (o as any).graphDbOperationMode } : null) as { adapter?: GraphDbSnapshotAdapter | null; operationMode?: string } | null;

    if (backend === 'graphdb') {
        const adapter = graphdbConfig?.adapter ?? null;
        if (adapter && typeof (adapter as any).loadSnapshot === 'function') {
            return {
                loadSnapshot: () => adapter.loadSnapshot(),
                saveSnapshot: (snapshot) => adapter.saveSnapshot(snapshot),
                getDiagnostics: () => ({
                    ...adapter.getDiagnostics(),
                    storeType: 'graphdb' as const,
                    graphDbOperationMode: normalizeGraphDbStoreOperationMode(graphdbConfig?.operationMode),
                    fallbackEnabled: true,
                    graphDbAdapterCapabilityMode: (adapter.getDiagnostics() as any).capabilityMode ?? 'unknown',
                    graphDbReadPath: (adapter.getDiagnostics() as any).lastReadPath ?? 'fallback',
                    graphDbWritePath: (adapter.getDiagnostics() as any).lastWritePath ?? 'fallback',
                }),
            };
        }
        // Fall back to file store
        const fallback = new FileBackedKnowledgeGraphStore({ filePath });
        return {
            loadSnapshot: () => fallback.loadSnapshot(),
            saveSnapshot: (snapshot) => fallback.saveSnapshot(snapshot),
            getDiagnostics: () => ({
                ...fallback.getDiagnostics(),
                storeType: 'graphdb' as const,
                usingFallback: true,
                fallbackEnabled: true,
                graphDbOperationMode: 'snapshot_only',
                graphDbAdapterCapabilityMode: 'unknown',
                graphDbReadPath: 'fallback',
                graphDbWritePath: 'fallback',
            }),
        };
    }

    return new FileBackedKnowledgeGraphStore({ filePath });
}

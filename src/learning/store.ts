import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type {
    AgentConversationInvocationRecord,
    AgentConversationSessionRecord,
    AgentConversationTurnRecord,
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
import type { IndexLifecycleSnapshot } from '../indexing/types';
import type { ResourceRegistrySnapshot } from '../resources/types';
import type { SessionStateSnapshot } from '../session/types';
import type { MemoryAuditRecord } from '../memory/types';
import type { WorkflowArtifactSnapshot } from '../workflows/types';
import type { WorkspaceRegistrySnapshot } from '../workspace/types';

export interface SerializedDocumentSnapshot {
    documentId: string;
    sourcePath: string;
    sourceHash: string;
    content?: string;
    version: number;
    updatedAt: string;
    atomStableKeyToId: Array<[string, string]>;
    atomIds: string[];
    evidenceSpanIds: string[];
    relationEdgeIds: string[];
    temporalEdgeIds: string[];
}

export interface KnowledgeGraphSnapshot {
    schemaVersion: 1 | 2;
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
    learningQualityHistoryRecords?: Array<Record<string, unknown>>;
    queryBackendComparisonHistoryRecords?: Array<Record<string, unknown>>;
    studySessionPlanQualityHistoryRecords?: Array<Record<string, unknown>>;
    memoryPolicyDiagnosticsHistoryRecords?: Array<Record<string, unknown>>;
    queryBackendFallbackCount?: number;
    queryBackendLastError?: string;
    conversationSessions?: AgentConversationSessionRecord[];
    conversationTurns?: AgentConversationTurnRecord[];
    conversationInvocations?: AgentConversationInvocationRecord[];
    resourceRegistry?: ResourceRegistrySnapshot;
    workspaceRegistry?: WorkspaceRegistrySnapshot;
    indexLifecycle?: IndexLifecycleSnapshot;
    sessionStateSnapshot?: SessionStateSnapshot;
    workflowArtifacts?: WorkflowArtifactSnapshot;
    memoryAuditRecords?: MemoryAuditRecord[];
    userMemory: Record<string, {
        session: MemoryEntry[];
        unit: MemoryEntry[];
        long_term: MemoryEntry[];
    }>;
    relationEdgeSignatures: string[];
}

export interface KnowledgeGraphStoreDiagnostics {
    storeType: 'none' | 'file' | 'graphdb' | 'memory';
    location?: string;
    exists: boolean;
    loaded: boolean;
    [key: string]: unknown;
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
    storageEngine?: string;
    /** Staleness tracking (GitNexus pattern): ISO timestamp when file became newer than last save. */
    staleSince?: string;
    /** File mtime for staleness comparison. */
    fileMtime?: string;
}

export interface KnowledgeGraphStore {
    loadSnapshot(): Promise<KnowledgeGraphSnapshot | null>;
    saveSnapshot(snapshot: KnowledgeGraphSnapshot): Promise<void>;
    getDiagnostics(): KnowledgeGraphStoreDiagnostics;
    close?(): void;
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

function filterNodesFromSnapshot(snapshot: KnowledgeGraphSnapshot, filter: NodeQueryFilter): KnowledgeAtom[] {
    let results = snapshot.atoms;
    if (filter.nodeIds && filter.nodeIds.length > 0) {
        const idSet = new Set(filter.nodeIds);
        results = results.filter((atom) => idSet.has(atom.id) || idSet.has(atom.stableKey ?? ''));
    }
    if (filter.stableKey) {
        results = results.filter((atom) => atom.stableKey === filter.stableKey);
    }
    if (filter.limit && filter.limit > 0) {
        results = results.slice(0, filter.limit);
    }
    return results;
}

function filterEdgesFromSnapshot(snapshot: KnowledgeGraphSnapshot, filter: EdgeQueryFilter): RelationEdge[] {
    let results = snapshot.relationEdges;
    if (filter.fromNodeId) {
        results = results.filter((edge) => edge.sourceAtomId === filter.fromNodeId);
    }
    if (filter.toNodeId) {
        results = results.filter((edge) => edge.targetAtomId === filter.toNodeId);
    }
    if (filter.relationKind) {
        results = results.filter((edge) => edge.relationKind === filter.relationKind);
    }
    if (filter.limit && filter.limit > 0) {
        results = results.slice(0, filter.limit);
    }
    return results;
}

function findPathInSnapshot(
    snapshot: KnowledgeGraphSnapshot,
    sourceId: string,
    targetId: string,
    maxDepth = 10
): PathQueryResult {
    const adjacency = new Map<string, Array<{ to: string; edge: RelationEdge }>>();
    for (const edge of snapshot.relationEdges) {
        if (!adjacency.has(edge.sourceAtomId)) adjacency.set(edge.sourceAtomId, []);
        adjacency.get(edge.sourceAtomId)!.push({ to: edge.targetAtomId, edge });
    }

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
        return filterNodesFromSnapshot(snapshot, filter);
    }

    public async queryEdges(filter: EdgeQueryFilter): Promise<RelationEdge[]> {
        const snapshot = await this.ensureSnapshot();
        if (!snapshot) return [];
        return filterEdgesFromSnapshot(snapshot, filter);
    }

    public async findPath(sourceId: string, targetId: string, maxDepth = 10): Promise<PathQueryResult> {
        const snapshot = await this.ensureSnapshot();
        if (!snapshot) return { path: [], length: 0, edges: [], found: false };
        return findPathInSnapshot(snapshot, sourceId, targetId, maxDepth);
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
            if ((parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) || !Array.isArray(parsed.atoms) || !Array.isArray(parsed.documents)) {
                throw new Error('Invalid knowledge graph snapshot schema.');
            }
            const snapshot = parsed as KnowledgeGraphSnapshot;
            this.cachedSnapshot = snapshot;
            this.loaded = true;
            this.lastLoadAt = new Date().toISOString();
            return snapshot;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException | undefined)?.code;
            if (code === 'ENOENT' || code === 'ENOTDIR') {
                this.loaded = false;
                this.cachedSnapshot = null;
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
        const tempPath = `${filePath}.${process.pid}.${Date.now().toString(36)}.${randomUUID()}.tmp`;
        await fs.promises.mkdir(directory, { recursive: true });
        const serialized = JSON.stringify(snapshot, null, 2);
        try {
            await fs.promises.writeFile(tempPath, serialized, 'utf8');
            await fs.promises.rename(tempPath, filePath);
            this.cachedSnapshot = snapshot;
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
        // Staleness tracking (GitNexus pattern): compare snapshot save time to file mtime
        let staleSince: string | undefined;
        let fileMtime: string | undefined;
        try {
            const stat = fs.statSync(filePath);
            fileMtime = stat.mtime.toISOString();
            if (this.lastSaveAt && stat.mtime > new Date(this.lastSaveAt)) {
                staleSince = stat.mtime.toISOString();
            }
        } catch { /* file may not exist yet */ }

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
            staleSince,
            fileMtime,
        };
    }
}

export function createFileBackedKnowledgeGraphStore(options: FileBackedKnowledgeGraphStoreOptions): KnowledgeGraphOpsAdapter {
    return new FileBackedKnowledgeGraphStore(options);
}
// ── GraphDB Adapter (M10.5) ──

export type GraphDbOperationMode = 'snapshot_only' | 'ops_preferred';
export type GraphDbAdapterProvider = 'file' | 'http' | 'sqlite' | 'none';

export interface GraphDbSnapshotAdapterConfig {
    provider?: GraphDbAdapterProvider;
    filePath?: string;
    sqlitePath?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    id?: string;
    negotiateOpsCapable?: boolean;
}

export interface GraphDbSnapshotAdapter {
    id?: string;
    provider?: string;
    opsCapable?: boolean;
    close?(): void;
    getCapabilities?(): Partial<KnowledgeGraphOpsCapabilities> & Record<string, unknown>;
    loadSnapshot?(): Promise<KnowledgeGraphSnapshot | null>;
    saveSnapshot?(snapshot: KnowledgeGraphSnapshot): Promise<void>;
    getDiagnostics?(): Partial<KnowledgeGraphStoreDiagnostics> & Record<string, unknown>;
    probeSnapshotMetadata?(): Promise<Record<string, unknown> | null>;
    loadSnapshotByOps?(): Promise<KnowledgeGraphSnapshot | null>;
    saveSnapshotByOps?(snapshot: KnowledgeGraphSnapshot): Promise<void>;
    getNodeByOps?(atomId: string): Promise<KnowledgeAtom | null>;
    queryNodesByOps?(filter: NodeQueryFilter): Promise<KnowledgeAtom[]>;
    queryEdgesByOps?(filter: EdgeQueryFilter): Promise<RelationEdge[]>;
    findPathByOps?(sourceId: string, targetId: string, maxDepth?: number): Promise<PathQueryResult>;
    [extra: string]: unknown;
}

function hasGraphQueryOpsPath(adapter: GraphDbSnapshotAdapter): boolean {
    return typeof adapter.getNodeByOps === 'function'
        || typeof adapter.queryNodesByOps === 'function'
        || typeof adapter.queryEdgesByOps === 'function'
        || typeof adapter.findPathByOps === 'function';
}

// Why ops-capable detection: Some graphdb adapters support fine-grained operations
// (getNode, queryEdges, findPath) in addition to full-snapshot load/save. We detect
// this via capability negotiation: check for *ByOps methods + explicit opsCapable flag
// or getCapabilities().mode. This allows the same store interface to serve both
// simple file-backed stores and advanced graphdb backends without changing callers.
function hasOpsCapablePath(adapter: GraphDbSnapshotAdapter): boolean {
    const hasSnapshotOpsMethods = typeof adapter.loadSnapshotByOps === 'function'
        && typeof adapter.saveSnapshotByOps === 'function';
    const hasQueryOpsMethods = hasGraphQueryOpsPath(adapter);
    if (!hasSnapshotOpsMethods && !hasQueryOpsMethods) return false;

    if (adapter.opsCapable === true) return true;
    const caps = adapter.getCapabilities?.();
    if ((caps as any)?.mode === 'ops_capable') return true;

    if (hasQueryOpsMethods) {
        const nodeQuerySupported = (caps as any)?.nodeQuerySupported === true;
        const edgeQuerySupported = (caps as any)?.edgeQuerySupported === true;
        const pathQuerySupported = (caps as any)?.pathQuerySupported === true;
        return nodeQuerySupported || edgeQuerySupported || pathQuerySupported;
    }

    return false;
}

export function normalizeKnowledgeGraphStoreBackend(v: unknown): string {
    const valid = new Set(['file', 'graphdb', 'none', 'memory']);
    const s = String(v ?? 'file').trim().toLowerCase();
    if (s === 'memory') return 'memory';
    return valid.has(s) ? s : 'file';
}

export function normalizeGraphDbSnapshotAdapterProvider(v: unknown): GraphDbAdapterProvider {
    const s = String(v ?? 'file').trim().toLowerCase();
    if (s === 'local-file' || s === 'file') return 'file';
    if (s === 'external_http' || s === 'remote-http' || s === 'service' || s === 'http') return 'http';
    if (s === 'sqlite' || s === 'embedded_sqlite' || s === 'embedded-sqlite' || s === 'embedded') return 'sqlite';
    if (s === 'none' || s === 'disabled' || s === 'fallback_only') return 'none';
    if (s === 'unknown') return 'file';
    return 'file';
}

export function normalizeGraphDbStoreOperationMode(v: unknown): GraphDbOperationMode {
    const s = String(v ?? 'snapshot').trim().toLowerCase();
    if (s === 'snapshot' || s === 'snapshot_only') return 'snapshot_only';
    if (s === 'ops' || s === 'ops_preferred' || s === 'operations') return 'ops_preferred';
    return 'snapshot_only';
}

export function createFileGraphDbSnapshotAdapter(options?: GraphDbSnapshotAdapterConfig): GraphDbSnapshotAdapter | null {
    const filePath = options?.filePath ?? '/tmp/notemd-kg-snapshot.json';
    const store = new FileBackedKnowledgeGraphStore({ filePath });
    return {
        id: options?.id ?? 'file-graphdb-local',
        provider: 'file',
        opsCapable: true,
        getCapabilities: () => ({
            snapshotSupported: true, nodeQuerySupported: true,
            edgeQuerySupported: true, pathQuerySupported: true,
            writeSupported: true, serverSideQuery: false,
            mode: 'ops_capable',
            supportedReadOperations: ['load_snapshot', 'load_snapshot_by_ops', 'probe_snapshot_metadata'],
            supportedWriteOperations: ['save_snapshot', 'save_snapshot_by_ops'],
        }),
        loadSnapshot: () => store.loadSnapshot(),
        saveSnapshot: (snapshot) => store.saveSnapshot(snapshot),
        loadSnapshotByOps: () => store.loadSnapshot(),
        saveSnapshotByOps: (snapshot) => store.saveSnapshot(snapshot),
        probeSnapshotMetadata: async () => {
            const s = await store.loadSnapshot();
            return s ? { schemaVersion: s.schemaVersion, savedAt: s.savedAt, atomCount: s.atoms.length, relationEdgeCount: s.relationEdges.length, temporalEdgeCount: s.temporalEdges.length, documentCount: s.documents.length } : null;
        },
        getDiagnostics: () => ({
            ...store.getDiagnostics(),
            capabilityMode: 'ops_capable',
            supportedReadOperations: ['load_snapshot', 'load_snapshot_by_ops', 'probe_snapshot_metadata'],
            supportedWriteOperations: ['save_snapshot', 'save_snapshot_by_ops'],
            lastReadPath: 'ops',
            lastWritePath: 'ops',
        }),
    };
}

type NodeSqliteModuleLike = {
    DatabaseSync: new (location: string) => {
        exec(sql: string): void;
        close(): void;
        prepare(sql: string): {
            run(...params: unknown[]): unknown;
            get(...params: unknown[]): Record<string, unknown> | undefined;
            all(...params: unknown[]): Array<Record<string, unknown>>;
        };
    };
};

function tryLoadNodeSqlite(): NodeSqliteModuleLike | null {
    try {
        return require('node:sqlite') as NodeSqliteModuleLike;
    } catch {
        return null;
    }
}

function createSqliteGraphDbSnapshotAdapter(options?: GraphDbSnapshotAdapterConfig): GraphDbSnapshotAdapter | null {
    const sqliteModule = tryLoadNodeSqlite();
    if (!sqliteModule || typeof sqliteModule.DatabaseSync !== 'function') {
        return null;
    }

    const sqlitePath = path.resolve(
        String(options?.sqlitePath || options?.filePath || '/tmp/notemd-kg-snapshot.sqlite')
    );
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    let db: InstanceType<NodeSqliteModuleLike['DatabaseSync']> | null = null;
    let closed = false;
    const adapterId = options?.id ?? 'embedded-sqlite-graphdb';
    let loaded = false;
    let lastLoadAt = '';
    let lastSaveAt = '';
    let lastError = '';
    let lastReadPath = 'ops';
    let lastWritePath = 'ops';

    const ensureDb = (): InstanceType<NodeSqliteModuleLike['DatabaseSync']> => {
        if (!db || closed) {
            db = new sqliteModule.DatabaseSync(sqlitePath);
            closed = false;
        }
        return db;
    };

    const ensureSchema = (): void => {
        ensureDb().exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 2000;
            CREATE TABLE IF NOT EXISTS snapshot_store (
                snapshot_id INTEGER PRIMARY KEY CHECK (snapshot_id = 1),
                schema_version INTEGER NOT NULL,
                saved_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS atoms (
                atom_id TEXT PRIMARY KEY,
                stable_key TEXT,
                title TEXT NOT NULL,
                source_path TEXT,
                updated_at TEXT,
                raw_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_atoms_stable_key ON atoms(stable_key);
            CREATE TABLE IF NOT EXISTS relation_edges (
                edge_id TEXT PRIMARY KEY,
                source_atom_id TEXT NOT NULL,
                target_atom_id TEXT NOT NULL,
                relation_kind TEXT NOT NULL,
                confidence REAL NOT NULL,
                raw_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_relation_edges_source ON relation_edges(source_atom_id);
            CREATE INDEX IF NOT EXISTS idx_relation_edges_target ON relation_edges(target_atom_id);
            CREATE INDEX IF NOT EXISTS idx_relation_edges_kind ON relation_edges(relation_kind);
        `);
    };

    const loadSnapshotRow = (): Record<string, unknown> | undefined => {
        ensureSchema();
        return ensureDb().prepare(`
            SELECT schema_version, saved_at, payload_json
            FROM snapshot_store
            WHERE snapshot_id = 1
        `).get();
    };

    const loadSnapshotPayload = (): KnowledgeGraphSnapshot | null => {
        const row = loadSnapshotRow();
        if (!row || !row.payload_json) {
            loaded = false;
            return null;
        }
        const parsed = JSON.parse(String(row.payload_json)) as Partial<KnowledgeGraphSnapshot>;
        if ((parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) || !Array.isArray(parsed.atoms) || !Array.isArray(parsed.documents)) {
            throw new Error('Invalid sqlite knowledge graph snapshot schema.');
        }
        loaded = true;
        lastLoadAt = new Date().toISOString();
        lastError = '';
        return parsed as KnowledgeGraphSnapshot;
    };

    const replaceSnapshotData = (snapshot: KnowledgeGraphSnapshot): void => {
        ensureSchema();
        const activeDb = ensureDb();
        activeDb.exec('BEGIN IMMEDIATE TRANSACTION');
        try {
            activeDb.exec('DELETE FROM snapshot_store');
            activeDb.exec('DELETE FROM atoms');
            activeDb.exec('DELETE FROM relation_edges');
            activeDb.prepare(`
                INSERT INTO snapshot_store (snapshot_id, schema_version, saved_at, payload_json)
                VALUES (1, ?, ?, ?)
            `).run(
                snapshot.schemaVersion,
                snapshot.savedAt,
                JSON.stringify(snapshot)
            );
            const insertAtom = activeDb.prepare(`
                INSERT INTO atoms (atom_id, stable_key, title, source_path, updated_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            snapshot.atoms.forEach((atom) => {
                insertAtom.run(
                    atom.id,
                    atom.stableKey || '',
                    atom.title,
                    atom.sourcePath || '',
                    atom.updatedAt || '',
                    JSON.stringify(atom)
                );
            });
            const insertRelationEdge = activeDb.prepare(`
                INSERT INTO relation_edges (edge_id, source_atom_id, target_atom_id, relation_kind, confidence, raw_json)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            snapshot.relationEdges.forEach((edge) => {
                insertRelationEdge.run(
                    edge.id,
                    edge.sourceAtomId,
                    edge.targetAtomId,
                    edge.relationKind,
                    Number(edge.confidence || 0),
                    JSON.stringify(edge)
                );
            });
            activeDb.exec('COMMIT');
            loaded = true;
            lastSaveAt = new Date().toISOString();
            lastError = '';
        } catch (error) {
            try {
                activeDb.exec('ROLLBACK');
            } catch {
            }
            lastError = String((error as Error)?.message || error);
            throw error;
        }
    };

    const mapNodeRows = (rows: Array<Record<string, unknown>>): KnowledgeAtom[] => rows
        .map((row) => {
            try {
                return JSON.parse(String(row.raw_json || 'null')) as KnowledgeAtom;
            } catch {
                return null;
            }
        })
        .filter((atom): atom is KnowledgeAtom => Boolean(atom && typeof atom === 'object'));

    const mapEdgeRows = (rows: Array<Record<string, unknown>>): RelationEdge[] => rows
        .map((row) => {
            try {
                return JSON.parse(String(row.raw_json || 'null')) as RelationEdge;
            } catch {
                return null;
            }
        })
        .filter((edge): edge is RelationEdge => Boolean(edge && typeof edge === 'object'));

    const buildInClause = (values: string[]): { placeholders: string; params: string[] } => ({
        placeholders: values.map(() => '?').join(', '),
        params: values,
    });

    return {
        id: adapterId,
        provider: 'sqlite',
        opsCapable: true,
        getCapabilities: () => ({
            snapshotSupported: true,
            nodeQuerySupported: true,
            edgeQuerySupported: true,
            pathQuerySupported: true,
            writeSupported: true,
            serverSideQuery: true,
            mode: 'ops_capable',
            supportedReadOperations: ['load_snapshot', 'get_node', 'query_nodes', 'query_edges', 'find_path', 'probe_snapshot_metadata'],
            supportedWriteOperations: ['save_snapshot'],
        }),
        loadSnapshot: async () => {
            lastReadPath = 'ops';
            try {
                return loadSnapshotPayload();
            } catch (error) {
                loaded = false;
                lastError = String((error as Error)?.message || error);
                throw error;
            }
        },
        saveSnapshot: async (snapshot: KnowledgeGraphSnapshot) => {
            lastWritePath = 'ops';
            replaceSnapshotData(snapshot);
        },
        probeSnapshotMetadata: async () => {
            ensureSchema();
            const snapshotRow = loadSnapshotRow();
            if (!snapshotRow) {
                return null;
            }
            const activeDb = ensureDb();
            const atomCountRow = activeDb.prepare('SELECT COUNT(*) AS count FROM atoms').get();
            const relationCountRow = activeDb.prepare('SELECT COUNT(*) AS count FROM relation_edges').get();
            const snapshot = loadSnapshotPayload();
            return {
                schemaVersion: Number(snapshotRow.schema_version || snapshot?.schemaVersion || 1),
                savedAt: String(snapshotRow.saved_at || snapshot?.savedAt || ''),
                atomCount: Number(atomCountRow?.count || 0),
                relationEdgeCount: Number(relationCountRow?.count || 0),
                temporalEdgeCount: snapshot?.temporalEdges.length || 0,
                documentCount: snapshot?.documents.length || 0,
            };
        },
        loadSnapshotByOps: async () => {
            lastReadPath = 'ops';
            return loadSnapshotPayload();
        },
        saveSnapshotByOps: async (snapshot: KnowledgeGraphSnapshot) => {
            lastWritePath = 'ops';
            replaceSnapshotData(snapshot);
        },
        getNodeByOps: async (atomId: string) => {
            ensureSchema();
            lastReadPath = 'ops';
            const normalizedId = String(atomId || '').trim();
            if (!normalizedId) {
                return null;
            }
            const row = ensureDb().prepare(`
                SELECT raw_json
                FROM atoms
                WHERE atom_id = ? OR stable_key = ?
                LIMIT 1
            `).get(normalizedId, normalizedId);
            return mapNodeRows(row ? [row] : [])[0] || null;
        },
        queryNodesByOps: async (filter: NodeQueryFilter) => {
            ensureSchema();
            lastReadPath = 'ops';
            const clauses: string[] = [];
            const params: string[] = [];
            if (Array.isArray(filter.nodeIds) && filter.nodeIds.length > 0) {
                const normalizedIds = Array.from(new Set(
                    filter.nodeIds.map((item) => String(item || '').trim()).filter(Boolean)
                ));
                if (normalizedIds.length > 0) {
                    const inClause = buildInClause(normalizedIds);
                    clauses.push(`(atom_id IN (${inClause.placeholders}) OR stable_key IN (${inClause.placeholders}))`);
                    params.push(...inClause.params, ...inClause.params);
                }
            }
            if (String(filter.stableKey || '').trim()) {
                clauses.push('stable_key = ?');
                params.push(String(filter.stableKey).trim());
            }
            let sql = 'SELECT raw_json FROM atoms';
            if (clauses.length > 0) {
                sql += ` WHERE ${clauses.join(' AND ')}`;
            }
            sql += ' ORDER BY atom_id ASC';
            if (filter.limit && filter.limit > 0) {
                sql += ` LIMIT ${Math.max(1, Math.floor(filter.limit))}`;
            }
            return mapNodeRows(ensureDb().prepare(sql).all(...params));
        },
        queryEdgesByOps: async (filter: EdgeQueryFilter) => {
            ensureSchema();
            lastReadPath = 'ops';
            const clauses: string[] = [];
            const params: string[] = [];
            if (String(filter.fromNodeId || '').trim()) {
                clauses.push('source_atom_id = ?');
                params.push(String(filter.fromNodeId).trim());
            }
            if (String(filter.toNodeId || '').trim()) {
                clauses.push('target_atom_id = ?');
                params.push(String(filter.toNodeId).trim());
            }
            if (String(filter.relationKind || '').trim()) {
                clauses.push('relation_kind = ?');
                params.push(String(filter.relationKind).trim());
            }
            let sql = 'SELECT raw_json FROM relation_edges';
            if (clauses.length > 0) {
                sql += ` WHERE ${clauses.join(' AND ')}`;
            }
            sql += ' ORDER BY edge_id ASC';
            if (filter.limit && filter.limit > 0) {
                sql += ` LIMIT ${Math.max(1, Math.floor(filter.limit))}`;
            }
            return mapEdgeRows(ensureDb().prepare(sql).all(...params));
        },
        findPathByOps: async (sourceId: string, targetId: string, maxDepth = 10) => {
            ensureSchema();
            lastReadPath = 'ops';
            const source = String(sourceId || '').trim();
            const target = String(targetId || '').trim();
            if (!source || !target) {
                return { path: [], length: 0, edges: [], found: false };
            }
            const rows = ensureDb().prepare(`
                SELECT source_atom_id, target_atom_id, relation_kind
                FROM relation_edges
            `).all();
            const adjacency = new Map<string, Array<{ to: string; relation?: string }>>();
            rows.forEach((row) => {
                const from = String(row.source_atom_id || '').trim();
                const to = String(row.target_atom_id || '').trim();
                if (!from || !to) {
                    return;
                }
                if (!adjacency.has(from)) {
                    adjacency.set(from, []);
                }
                adjacency.get(from)?.push({
                    to,
                    relation: String(row.relation_kind || '').trim() || undefined,
                });
            });
            const visited = new Set<string>([source]);
            const queue: Array<{ nodeId: string; path: string[]; edges: Array<{ from: string; to: string; relation?: string }> }> = [
                { nodeId: source, path: [source], edges: [] },
            ];
            while (queue.length > 0) {
                const current = queue.shift() as {
                    nodeId: string;
                    path: string[];
                    edges: Array<{ from: string; to: string; relation?: string }>;
                };
                if (current.path.length > maxDepth) {
                    continue;
                }
                if (current.nodeId === target) {
                    return {
                        path: current.path,
                        length: current.path.length - 1,
                        edges: current.edges,
                        found: true,
                    };
                }
                const neighbors = adjacency.get(current.nodeId) || [];
                for (const neighbor of neighbors) {
                    if (visited.has(neighbor.to)) {
                        continue;
                    }
                    visited.add(neighbor.to);
                    queue.push({
                        nodeId: neighbor.to,
                        path: [...current.path, neighbor.to],
                        edges: [...current.edges, { from: current.nodeId, to: neighbor.to, relation: neighbor.relation }],
                    });
                }
            }
            return { path: [], length: 0, edges: [], found: false };
        },
        getDiagnostics: () => ({
            storeType: 'graphdb' as const,
            location: sqlitePath,
            exists: fs.existsSync(sqlitePath),
            loaded,
            lastLoadAt: lastLoadAt || undefined,
            lastSaveAt: lastSaveAt || undefined,
            lastError: lastError || undefined,
            capabilityMode: 'ops_capable',
            supportedReadOperations: ['load_snapshot', 'get_node', 'query_nodes', 'query_edges', 'find_path', 'probe_snapshot_metadata'],
            supportedWriteOperations: ['save_snapshot'],
            lastReadPath,
            lastWritePath,
            storageEngine: 'sqlite',
        }),
        close: () => {
            try {
                db?.close?.();
            } catch {
            } finally {
                db = null;
                closed = true;
            }
        },
    };
}

export function createGraphDbSnapshotAdapter(options?: Record<string, unknown>): GraphDbSnapshotAdapter | null {
    const rawProvider = options?.provider as string | undefined;
    const provider = normalizeGraphDbSnapshotAdapterProvider(rawProvider);
    if (provider === 'none') return null;
    if (provider === 'file') {
        const fileAdapter = createFileGraphDbSnapshotAdapter({
            provider: 'file',
            filePath: options?.filePath as string | undefined,
            id: (options?.id ?? options?.fileAdapterId ?? options?.adapterId) as string | undefined,
        });
        if (!fileAdapter) return null;
        return fileAdapter;
    }
    if (provider === 'sqlite') {
        const sqliteAdapter = createSqliteGraphDbSnapshotAdapter({
            provider: 'sqlite',
            filePath: options?.filePath as string | undefined,
            sqlitePath: options?.sqlitePath as string | undefined,
            id: (options?.id ?? options?.sqliteAdapterId ?? options?.adapterId) as string | undefined,
        });
        if (!sqliteAdapter) return null;
        return sqliteAdapter;
    }
    // HTTP adapter — real HTTP communication with graphdb endpoint
    const httpEndpoint = (options?.httpEndpoint ?? options?.baseUrl) as string | undefined;
    if (provider === 'http' && httpEndpoint) {
        const endpoint = httpEndpoint.replace(/\/$/, '');
        const snapUrl = `${endpoint}/snapshot`;
        const nodeUrl = `${endpoint}/ops/node`;
        const nodesUrl = `${endpoint}/ops/nodes`;
        const edgesUrl = `${endpoint}/ops/edges`;
        const pathUrl = `${endpoint}/ops/path`;
        let reqCount = 0;
        let okCount = 0;
        let failCount = 0;
        let lastReqId = '';
        let lastErrCode = '';
        let lastStatusCode = 0;

        const doFetch = async (requestUrl: string, method: string, body?: unknown) => {
            reqCount++;
            const headers: Record<string, string> = body ? { 'Content-Type': 'application/json' } : {};
            const res = await fetch(requestUrl, { method, headers, body: body ? JSON.stringify(body) : undefined });
            lastReqId = res.headers.get('X-Request-Id') || 'http-graphdb-' + reqCount;
            lastStatusCode = Math.max(0, Math.floor(Number(res.status || 0)));
            if (res.ok) okCount++;
            else { failCount++; lastErrCode = res.headers.get('X-Error-Code') || String(res.status); }
            return res;
        };

        // Why circuit breaker: The HTTP graphdb adapter can fail transiently (network
        // blips, backend restarts). Without a circuit breaker, every request would
        // attempt the failing backend, causing latency spikes and cascading failures.
        // After `circuitThreshold` consecutive failures, the circuit opens: subsequent
        // requests fail immediately (fail-fast) instead of waiting for timeouts.
        // This is the standard "fail-fast under proven failure" pattern (Netflix Hystrix).
        const circuitThreshold = (options?.httpCircuitFailureThreshold as number) ?? (options as any).httpCircuitFailureThreshold ?? 3;
        const circuitCooldown = (options?.httpCircuitCooldownMs as number) ?? 8000;
        const adapterId = (options?.id ?? options?.adapterId ?? options?.httpAdapterId ?? 'http-graphdb') as string;
        let consecutiveFailures = 0;
        let circuitState: 'closed' | 'open' = 'closed';
        let shortCircuitCount = 0;
        let circuitOpenedAt = '';

        const checkCircuit = () => {
            if (circuitState === 'open') {
                shortCircuitCount++;
                throw new Error('graphdb_http_circuit_open');
            }
        };

        return {
            id: adapterId,
            provider: 'http',
            opsCapable: true,
            getCapabilities: () => ({
                snapshotSupported: true, nodeQuerySupported: true,
                edgeQuerySupported: true, pathQuerySupported: true,
                writeSupported: true, serverSideQuery: true,
                mode: 'ops_capable',
                supportedReadOperations: ['load_snapshot', 'get_node', 'query_nodes', 'query_edges', 'find_path'],
                supportedWriteOperations: ['save_snapshot'],
            }),
            loadSnapshot: async () => {
                checkCircuit();
                const res = await doFetch(snapUrl, 'GET');
                if (!res.ok) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= circuitThreshold) {
                        circuitState = 'open';
                        circuitOpenedAt = new Date().toISOString();
                    }
                    throw new Error('graphdb_http_request_failed:' + res.status);
                }
                consecutiveFailures = 0;
                const data = await res.json() as any;
                return (data?.snapshot ?? data) as KnowledgeGraphSnapshot | null;
            },
            saveSnapshot: async (snapshot: KnowledgeGraphSnapshot) => {
                checkCircuit();
                const res = await doFetch(snapUrl, 'POST', { snapshot });
                if (!res.ok) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= circuitThreshold) {
                        circuitState = 'open';
                        circuitOpenedAt = new Date().toISOString();
                    }
                    throw new Error('graphdb_http_request_failed:' + res.status);
                }
                consecutiveFailures = 0;
            },
            getNodeByOps: async (atomId: string) => {
                checkCircuit();
                const safeId = encodeURIComponent(String(atomId || '').trim());
                if (!safeId) {
                    return null;
                }
                const res = await doFetch(`${nodeUrl}/${safeId}`, 'GET');
                if (res.status === 404) {
                    return null;
                }
                if (!res.ok) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= circuitThreshold) {
                        circuitState = 'open';
                        circuitOpenedAt = new Date().toISOString();
                    }
                    throw new Error('graphdb_http_request_failed:' + res.status);
                }
                consecutiveFailures = 0;
                const payload = await res.json() as any;
                const node = payload?.node ?? payload?.atom ?? payload?.item ?? payload ?? null;
                if (!node || typeof node !== 'object') {
                    return null;
                }
                return node as KnowledgeAtom;
            },
            queryNodesByOps: async (filter: NodeQueryFilter) => {
                checkCircuit();
                const res = await doFetch(nodesUrl, 'POST', { filter: filter || {} });
                if (!res.ok) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= circuitThreshold) {
                        circuitState = 'open';
                        circuitOpenedAt = new Date().toISOString();
                    }
                    throw new Error('graphdb_http_request_failed:' + res.status);
                }
                consecutiveFailures = 0;
                const payload = await res.json() as any;
                const nodes = payload?.nodes ?? payload?.atoms ?? payload?.items ?? [];
                return Array.isArray(nodes) ? nodes.filter((item) => Boolean(item && typeof item === 'object')) as KnowledgeAtom[] : [];
            },
            queryEdgesByOps: async (filter: EdgeQueryFilter) => {
                checkCircuit();
                const res = await doFetch(edgesUrl, 'POST', { filter: filter || {} });
                if (!res.ok) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= circuitThreshold) {
                        circuitState = 'open';
                        circuitOpenedAt = new Date().toISOString();
                    }
                    throw new Error('graphdb_http_request_failed:' + res.status);
                }
                consecutiveFailures = 0;
                const payload = await res.json() as any;
                const edges = payload?.edges ?? payload?.relationEdges ?? payload?.items ?? [];
                return Array.isArray(edges) ? edges.filter((item) => Boolean(item && typeof item === 'object')) as RelationEdge[] : [];
            },
            findPathByOps: async (sourceId: string, targetId: string, maxDepth?: number) => {
                checkCircuit();
                const res = await doFetch(pathUrl, 'POST', {
                    sourceId: String(sourceId || ''),
                    targetId: String(targetId || ''),
                    maxDepth: typeof maxDepth === 'number' ? Math.max(1, Math.floor(maxDepth)) : undefined,
                });
                if (!res.ok) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= circuitThreshold) {
                        circuitState = 'open';
                        circuitOpenedAt = new Date().toISOString();
                    }
                    throw new Error('graphdb_http_request_failed:' + res.status);
                }
                consecutiveFailures = 0;
                const payload = await res.json() as any;
                const pathResult = payload?.pathResult ?? payload?.result ?? payload;
                if (!pathResult || typeof pathResult !== 'object') {
                    return { path: [], length: 0, edges: [], found: false } as PathQueryResult;
                }
                return {
                    path: Array.isArray(pathResult.path) ? pathResult.path.map((item: unknown) => String(item || '')) : [],
                    length: Math.max(0, Math.floor(Number(pathResult.length || 0))),
                    edges: Array.isArray(pathResult.edges)
                        ? pathResult.edges.map((item: any) => ({
                            from: String(item?.from || ''),
                            to: String(item?.to || ''),
                            relation: item?.relation ? String(item.relation) : undefined,
                        }))
                        : [],
                    found: pathResult.found === true,
                } as PathQueryResult;
            },
            getDiagnostics: () => ({
                storeType: 'graphdb' as const,
                exists: okCount > 0,
                loaded: okCount > 0,
                location: snapUrl,
                capabilityMode: 'ops_capable',
                supportedReadOperations: ['load_snapshot', 'get_node', 'query_nodes', 'query_edges', 'find_path'],
                supportedWriteOperations: ['save_snapshot'],
                connector: {
                    healthStatus: circuitState === 'open' ? 'unavailable' : failCount > 0 ? 'degraded' : 'ready',
                    circuitState,
                    requestCount: reqCount,
                    successCount: okCount,
                    failureCount: failCount,
                    consecutiveFailures,
                    shortCircuitCount,
                    circuitOpenedAt: circuitOpenedAt || undefined,
                    lastRequestId: lastReqId,
                    lastErrorCode: circuitState === 'open' ? 'circuit_open' : (lastErrCode || undefined),
                    lastStatusCode: lastStatusCode > 0 ? lastStatusCode : undefined,
                },
            }),
        };
    }
    return null;
}

export function createKnowledgeGraphStore(o: Record<string, unknown>): KnowledgeGraphStore {
    const backend = normalizeKnowledgeGraphStoreBackend(o.backend);
    const filePath = (o.filePath as string) ?? '/tmp/notemd-kg-default.json';
    // Support both old (flat) and new (nested) parameter styles
    const graphdbAdapter = (o.graphdb as any)?.adapter ?? (o as any).graphDbAdapter ?? null;
    const graphdbOperationMode = ((o.graphdb as any)?.operationMode ?? (o as any).graphDbOperationMode ?? 'snapshot') as string;
    const graphdbFallbackEnabled = ((o.graphdb as any)?.fallbackEnabled ?? (o as any).graphDbFallbackEnabled ?? true) as boolean;

    if (backend === 'memory') {
        // In-memory store for testing
        let memorySnapshot: KnowledgeGraphSnapshot | null = null;
        return {
            loadSnapshot: async () => memorySnapshot,
            saveSnapshot: async (snapshot) => { memorySnapshot = snapshot; },
            getDiagnostics: () => ({
                storeType: 'memory' as const,
                exists: memorySnapshot !== null,
                loaded: memorySnapshot !== null,
            }),
            close: () => {
                memorySnapshot = null;
            },
        };
    }

    if (backend === 'graphdb') {
        if (graphdbAdapter && typeof (graphdbAdapter as any).loadSnapshot === 'function') {
            const a = graphdbAdapter as GraphDbSnapshotAdapter;
            const opsCapable = hasOpsCapablePath(a);
            const requestMode = normalizeGraphDbStoreOperationMode(graphdbOperationMode);
            const opsState = { probed: false, opsReadUsed: false, opsWriteUsed: false, lastProbeResult: null as Record<string, unknown> | null };
            const queryOpsState = {
                nodeOpsReadCount: 0,
                nodeFallbackCount: 0,
                nodesOpsReadCount: 0,
                nodesFallbackCount: 0,
                edgesOpsReadCount: 0,
                edgesFallbackCount: 0,
                pathOpsReadCount: 0,
                pathFallbackCount: 0,
            };

            const resolveOpsPath = async (): Promise<boolean> => {
                if (!opsCapable || requestMode !== 'ops_preferred') return false;
                if (opsState.probed) return true;
                if (typeof a.probeSnapshotMetadata === 'function') {
                    try {
                        opsState.lastProbeResult = await a.probeSnapshotMetadata();
                        opsState.probed = true;
                        return true;
                    } catch { /* probe failed, fall through to snapshot */ }
                }
                // No probe method: try ops path anyway, let it fail gracefully
                return true; // allow ops attempt — downgrade on failure
            };

            const loadSnapshotThroughAdapter = async (): Promise<KnowledgeGraphSnapshot | null> => {
                if (opsCapable && requestMode === 'ops_preferred') {
                    if (typeof a.probeSnapshotMetadata === 'function' && !opsState.probed) {
                        try {
                            opsState.lastProbeResult = await a.probeSnapshotMetadata();
                            opsState.probed = true;
                        } catch { /* fall through */ }
                    }
                    if ((opsState.probed || typeof a.probeSnapshotMetadata !== 'function') && typeof a.loadSnapshotByOps === 'function') {
                        try {
                            const result = await a.loadSnapshotByOps();
                            opsState.probed = true;
                            opsState.opsReadUsed = true;
                            return result;
                        } catch {
                            // Downgrade: ops read failed, fall back to snapshot read
                        }
                    }
                }
                return a.loadSnapshot!();
            };

            const saveSnapshotThroughAdapter = async (snapshot: KnowledgeGraphSnapshot): Promise<void> => {
                if (await resolveOpsPath() && typeof a.saveSnapshotByOps === 'function') {
                    try {
                        await a.saveSnapshotByOps(snapshot);
                        opsState.opsWriteUsed = true;
                        if (typeof a.probeSnapshotMetadata === 'function') {
                            try { opsState.lastProbeResult = await a.probeSnapshotMetadata(); } catch { /* ignore */ }
                        }
                        return;
                    } catch {
                        // Downgrade: ops write failed, fall back to snapshot write
                    }
                }
                await a.saveSnapshot!(snapshot);
                if (typeof a.probeSnapshotMetadata === 'function') {
                    try {
                        opsState.lastProbeResult = await a.probeSnapshotMetadata();
                        opsState.probed = true;
                    } catch {
                        /* ignore */
                    }
                }
            };

            const resolveOpsCapabilities = (): KnowledgeGraphOpsCapabilities => {
                const caps = a.getCapabilities?.() ?? {};
                const supportedReadOperations = Array.isArray((caps as any).supportedReadOperations)
                    ? (caps as any).supportedReadOperations as string[]
                    : [];
                const supportedWriteOperations = Array.isArray((caps as any).supportedWriteOperations)
                    ? (caps as any).supportedWriteOperations as string[]
                    : [];

                const nodeQuerySupported = (caps as any).nodeQuerySupported === true || typeof a.getNodeByOps === 'function';
                const edgeQuerySupported = (caps as any).edgeQuerySupported === true || typeof a.queryEdgesByOps === 'function';
                const pathQuerySupported = (caps as any).pathQuerySupported === true || typeof a.findPathByOps === 'function';
                const snapshotSupported = (caps as any).snapshotSupported !== false;
                const writeSupported = (caps as any).writeSupported !== false;
                const serverSideQuery = (caps as any).serverSideQuery === true
                    || nodeQuerySupported
                    || edgeQuerySupported
                    || pathQuerySupported;

                return {
                    snapshotSupported,
                    nodeQuerySupported,
                    edgeQuerySupported,
                    pathQuerySupported,
                    writeSupported,
                    serverSideQuery,
                    mode: String((caps as any).mode || (opsCapable ? 'ops_capable' : 'snapshot_only')),
                    supportedReadOperations,
                    supportedWriteOperations,
                };
            };

            const querySnapshotForNode = async (atomId: string): Promise<KnowledgeAtom | null> => {
                const snapshot = await loadSnapshotThroughAdapter();
                if (!snapshot) return null;
                return snapshot.atoms.find((atom) => atom.id === atomId || atom.stableKey === atomId) ?? null;
            };

            const querySnapshotForNodes = async (filter: NodeQueryFilter): Promise<KnowledgeAtom[]> => {
                const snapshot = await loadSnapshotThroughAdapter();
                if (!snapshot) return [];
                return filterNodesFromSnapshot(snapshot, filter);
            };

            const querySnapshotForEdges = async (filter: EdgeQueryFilter): Promise<RelationEdge[]> => {
                const snapshot = await loadSnapshotThroughAdapter();
                if (!snapshot) return [];
                return filterEdgesFromSnapshot(snapshot, filter);
            };

            const querySnapshotForPath = async (sourceId: string, targetId: string, maxDepth = 10): Promise<PathQueryResult> => {
                const snapshot = await loadSnapshotThroughAdapter();
                if (!snapshot) return { path: [], length: 0, edges: [], found: false };
                return findPathInSnapshot(snapshot, sourceId, targetId, maxDepth);
            };

            return {
                loadSnapshot: async () => loadSnapshotThroughAdapter(),
                saveSnapshot: async (snapshot: KnowledgeGraphSnapshot) => saveSnapshotThroughAdapter(snapshot),
                close: () => {
                    try {
                        a.close?.();
                    } catch {
                    }
                },
                getDiagnostics: () => {
                    const diag = a.getDiagnostics?.() ?? ({} as KnowledgeGraphStoreDiagnostics);
                    const caps = resolveOpsCapabilities();
                    const totalQueryOpsReadCount = queryOpsState.nodeOpsReadCount
                        + queryOpsState.nodesOpsReadCount
                        + queryOpsState.edgesOpsReadCount
                        + queryOpsState.pathOpsReadCount;
                    const totalQueryFallbackCount = queryOpsState.nodeFallbackCount
                        + queryOpsState.nodesFallbackCount
                        + queryOpsState.edgesFallbackCount
                        + queryOpsState.pathFallbackCount;
                    return {
                        exists: diag.exists ?? false,
                        loaded: diag.loaded ?? false,
                        backendReady: true,
                        usingFallback: false,
                        adapterId: a.id,
                        ...diag,
                        storeType: 'graphdb' as const,
                        graphDbOperationMode: normalizeGraphDbStoreOperationMode(graphdbOperationMode),
                        fallbackEnabled: graphdbFallbackEnabled,
                        graphDbAdapterCapabilityMode: (diag as any).capabilityMode ?? caps.mode ?? (opsCapable ? 'ops_capable' : 'snapshot_only'),
                        graphDbReadPath: opsState.opsReadUsed ? 'ops' : (diag as any).lastReadPath ?? 'snapshot',
                        graphDbWritePath: opsState.opsWriteUsed ? 'ops' : (diag as any).lastWritePath ?? 'snapshot',
                        graphDbSupportedReadOperations: (diag as any).supportedReadOperations ?? caps.supportedReadOperations,
                        graphDbSupportedWriteOperations: (diag as any).supportedWriteOperations ?? caps.supportedWriteOperations,
                        graphDbLastSnapshotMetadata: opsState.lastProbeResult ?? (diag as any).lastSnapshotMetadata,
                        graphDbQueryPath: totalQueryOpsReadCount > 0 ? 'ops' : 'snapshot',
                        graphDbQueryOpsReadCount: totalQueryOpsReadCount,
                        graphDbQueryFallbackCount: totalQueryFallbackCount,
                        graphDbNodeQuerySupported: caps.nodeQuerySupported,
                        graphDbEdgeQuerySupported: caps.edgeQuerySupported,
                        graphDbPathQuerySupported: caps.pathQuerySupported,
                    };
                },
                getCapabilities: () => resolveOpsCapabilities(),
                getNode: async (atomId: string) => {
                    if (requestMode === 'ops_preferred' && typeof a.getNodeByOps === 'function') {
                        try {
                            queryOpsState.nodeOpsReadCount += 1;
                            return await a.getNodeByOps(atomId);
                        } catch {
                            queryOpsState.nodeFallbackCount += 1;
                        }
                    }
                    return querySnapshotForNode(atomId);
                },
                queryNodes: async (filter: NodeQueryFilter) => {
                    if (requestMode === 'ops_preferred' && typeof a.queryNodesByOps === 'function') {
                        try {
                            queryOpsState.nodesOpsReadCount += 1;
                            return await a.queryNodesByOps(filter);
                        } catch {
                            queryOpsState.nodesFallbackCount += 1;
                        }
                    }
                    return querySnapshotForNodes(filter);
                },
                queryEdges: async (filter: EdgeQueryFilter) => {
                    if (requestMode === 'ops_preferred' && typeof a.queryEdgesByOps === 'function') {
                        try {
                            queryOpsState.edgesOpsReadCount += 1;
                            return await a.queryEdgesByOps(filter);
                        } catch {
                            queryOpsState.edgesFallbackCount += 1;
                        }
                    }
                    return querySnapshotForEdges(filter);
                },
                findPath: async (sourceId: string, targetId: string, maxDepth = 10) => {
                    if (requestMode === 'ops_preferred' && typeof a.findPathByOps === 'function') {
                        try {
                            queryOpsState.pathOpsReadCount += 1;
                            return await a.findPathByOps(sourceId, targetId, maxDepth);
                        } catch {
                            queryOpsState.pathFallbackCount += 1;
                        }
                    }
                    return querySnapshotForPath(sourceId, targetId, maxDepth);
                },
            } as KnowledgeGraphStore;
        }
        // Fail closed when fallback is disabled and adapter is unavailable
        if (!graphdbFallbackEnabled) {
            return {
                loadSnapshot: async () => { throw new Error('graphdb_adapter_unavailable_no_fallback'); },
                saveSnapshot: async () => { throw new Error('graphdb_adapter_unavailable_no_fallback'); },
                close: () => {},
                getDiagnostics: () => ({
                    storeType: 'graphdb' as const,
                    exists: false, loaded: false,
                    backendReady: false,
                    usingFallback: false,
                    fallbackEnabled: false,
                    lastError: 'graphdb_adapter_unavailable_no_fallback',
                    graphDbOperationMode: normalizeGraphDbStoreOperationMode(graphdbOperationMode),
                    graphDbAdapterCapabilityMode: 'unknown',
                    graphDbReadPath: 'fallback',
                    graphDbWritePath: 'fallback',
                }),
            };
        }

        // Fall back to file store
        const fallback = new FileBackedKnowledgeGraphStore({ filePath });
        return {
            loadSnapshot: () => fallback.loadSnapshot(),
            saveSnapshot: (snapshot) => fallback.saveSnapshot(snapshot),
            close: () => {
                try {
                    graphdbAdapter?.close?.();
                } catch {
                }
            },
            getDiagnostics: () => ({
                ...fallback.getDiagnostics(),
                storeType: 'graphdb' as const,
                backendReady: false,
                usingFallback: true,
                fallbackEnabled: true,
                fallbackStoreType: 'file',
                graphDbOperationMode: 'snapshot_only',
                graphDbAdapterCapabilityMode: 'unknown',
                graphDbReadPath: 'fallback',
                graphDbWritePath: 'fallback',
            }),
        };
    }

    return new FileBackedKnowledgeGraphStore({ filePath });
}

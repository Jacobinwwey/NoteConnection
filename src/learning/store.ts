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
    };
    adapterId?: string;
    usingFallback?: boolean;
    backendReady?: boolean;
    fallbackEnabled?: boolean;
}

export interface KnowledgeGraphStore {
    loadSnapshot(): Promise<KnowledgeGraphSnapshot | null>;
    saveSnapshot(snapshot: KnowledgeGraphSnapshot): Promise<void>;
    getDiagnostics(): KnowledgeGraphStoreDiagnostics;
}

export type FileBackedKnowledgeGraphStoreOptions = {
    filePath: string;
};

export class FileBackedKnowledgeGraphStore implements KnowledgeGraphStore {
    private lastLoadAt: string | undefined;

    private lastSaveAt: string | undefined;

    private loaded = false;

    private lastError: string | undefined;

    constructor(private readonly options: FileBackedKnowledgeGraphStoreOptions) {
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
        return {
            storeType: 'file',
            location: filePath,
            exists: fs.existsSync(filePath),
            loaded: this.loaded,
            lastLoadAt: this.lastLoadAt,
            lastSaveAt: this.lastSaveAt,
            lastError: this.lastError,
        };
    }
}

export function createFileBackedKnowledgeGraphStore(options: FileBackedKnowledgeGraphStoreOptions): KnowledgeGraphStore {
    return new FileBackedKnowledgeGraphStore(options);
}

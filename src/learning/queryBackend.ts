import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
    KnowledgeAtom,
    KnowledgeQueryModeWeights,
    KnowledgeQueryRequest,
    RelationEdge,
} from './types';

export interface GraphQueryBackendContext {
    request: KnowledgeQueryRequest;
    query: string;
    queryTokens: string[];
    asOf: string;
    topK: number;
    atoms: KnowledgeAtom[];
    activeEdges: RelationEdge[];
}

export interface GraphQueryCandidate {
    atomId: string;
    score: number;
}

export interface GraphQueryBackendVectorAccelerationTrace {
    mode: 'ann_prefilter' | 'full_scan';
    selectionMode?: 'full_scan' | 'token_prefilter' | 'token_signature_prefilter';
    failureMode?: LocalVectorAccelerationFailureMode;
    candidateCount?: number;
    adapterId?: string;
    adapterError?: string;
    healthStatus?: 'ready' | 'degraded' | 'unavailable' | 'unknown';
    circuitState?: 'closed' | 'open' | 'half_open' | 'unknown';
    lastRequestId?: string;
    lastErrorCode?: string;
    lastRetryAfterMs?: number;
    representationVersion?: string;
    embeddingModelId?: string;
    embeddingDimension?: number;
    indexSignature?: string;
    representationStatus?: 'aligned' | 'mismatch' | 'unknown';
    representationStatusReason?: string;
    representationStrictMode?: boolean;
}

export interface GraphQueryBackendTrace {
    retrievalModes?: string[];
    modeWeights?: Partial<KnowledgeQueryModeWeights>;
    vectorAcceleration?: GraphQueryBackendVectorAccelerationTrace;
}

export interface GraphQueryBackendResult {
    candidates: GraphQueryCandidate[];
    trace?: GraphQueryBackendTrace;
}

export interface GraphQueryBackendDiagnostics {
    backendId: string;
    ready: boolean;
    lastError?: string;
    vectorIndex?: {
        enabled: boolean;
        status: 'ready' | 'stale' | 'unavailable';
        location?: string;
        signature?: string;
        builtAt?: string;
        atomCount?: number;
        loadedFromDisk?: boolean;
        persisted?: boolean;
        acceleration?: {
            enabled: boolean;
            mode: 'ann_prefilter' | 'full_scan';
            failureMode?: LocalVectorAccelerationFailureMode;
            indexSyncStatus?: 'ready' | 'degraded' | 'unavailable' | 'unknown';
            indexSyncMessage?: string;
            lastSyncAt?: string;
            syncRequestCount?: number;
            syncSuccessCount?: number;
            syncFailureCount?: number;
            syncedIndexSignature?: string;
            syncedAtomCount?: number;
            lastSelectionMode?: 'full_scan' | 'token_prefilter' | 'token_signature_prefilter';
            lastCandidateCount?: number;
            adapterId?: string;
            adapterError?: string;
            healthStatus?: 'ready' | 'degraded' | 'unavailable' | 'unknown';
            healthMessage?: string;
            healthCheckedAt?: string;
            circuitState?: 'closed' | 'open' | 'half_open' | 'unknown';
            consecutiveFailures?: number;
            requestCount?: number;
            retryCount?: number;
            shortCircuitCount?: number;
            successCount?: number;
            failureCount?: number;
            halfOpenProbeSuccessCount?: number;
            halfOpenProbeFailureCount?: number;
            lastSuccessAt?: string;
            lastFailureAt?: string;
            circuitOpenedAt?: string;
            lastRequestId?: string;
            lastErrorCode?: string;
            lastRetryAfterMs?: number;
            representationVersion?: string;
            embeddingModelId?: string;
            embeddingDimension?: number;
            indexSignature?: string;
            representationStatus?: 'aligned' | 'mismatch' | 'unknown';
            representationStatusReason?: string;
            representationStrictMode?: boolean;
            /** M10.6: Prefilter effectiveness ratio (candidates / total atoms in scope). */
            prefilterEffectivenessRatio?: number;
            /** M10.6: Last prefilter total atoms in scope. */
            lastTotalAtomsInScope?: number;
        };
    };
}

// ── M10.6: ANN Runbook Health Gate ──

export interface AnnRunbookHealthGate {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: AnnRunbookCheck[];
    summary: string;
    checkedAt: string;
}

export interface AnnRunbookCheck {
    name: string;
    passed: boolean;
    value: number | string;
    threshold: number | string;
    operator: 'lt' | 'gt' | 'eq' | 'lte' | 'gte' | 'contains';
    message: string;
}

export function evaluateAnnRunbookHealth(params: {
    healthStatus?: string;
    circuitState?: string;
    consecutiveFailures?: number;
    failureThreshold?: number;
    prefilterEffectivenessRatio?: number;
    minPrefilterEffectivenessRatio?: number;
    representationStatus?: string;
    representationStrictMode?: boolean;
}): AnnRunbookHealthGate {
    const checks: AnnRunbookCheck[] = [];
    const threshold = params.failureThreshold ?? 3;
    const minEffectiveness = params.minPrefilterEffectivenessRatio ?? 0.01;

    // Check 1: Circuit state
    const circuitHealthy = params.circuitState !== 'open';
    checks.push({
        name: 'circuit_state',
        passed: circuitHealthy,
        value: params.circuitState ?? 'unknown',
        threshold: 'closed',
        operator: 'eq',
        message: circuitHealthy ? 'Circuit closed' : 'Circuit open — requests blocked',
    });

    // Check 2: Consecutive failures
    const failuresHealthy = (params.consecutiveFailures ?? 0) < threshold;
    checks.push({
        name: 'consecutive_failures',
        passed: failuresHealthy,
        value: params.consecutiveFailures ?? 0,
        threshold,
        operator: 'lt',
        message: failuresHealthy ? 'Within threshold' : `Exceeded threshold (${params.consecutiveFailures} >= ${threshold})`,
    });

    // Check 3: Prefilter effectiveness
    const effectiveness = params.prefilterEffectivenessRatio ?? 1;
    const prefilterHealthy = effectiveness >= minEffectiveness;
    checks.push({
        name: 'prefilter_effectiveness',
        passed: prefilterHealthy,
        value: effectiveness,
        threshold: minEffectiveness,
        operator: 'gte',
        message: prefilterHealthy ? 'Effective prefilter' : 'Prefilter too narrow — may miss relevant atoms',
    });

    // Check 4: Representation consistency
    const repHealthy = params.representationStatus !== 'mismatch';
    checks.push({
        name: 'representation_consistency',
        passed: repHealthy || !params.representationStrictMode,
        value: params.representationStatus ?? 'unknown',
        threshold: 'aligned',
        operator: 'eq',
        message: repHealthy ? 'Aligned' : `Mismatch: ${params.representationStatus}`,
    });

    const failed = checks.filter(c => !c.passed);
    const status = failed.length === 0 ? 'healthy'
        : failed.length <= 1 && checks[0].passed ? 'degraded'
        : 'unhealthy';

    return {
        status,
        checks,
        summary: failed.length === 0
            ? 'All ANN health checks passed.'
            : `${failed.length}/${checks.length} checks failed: ${failed.map(c => c.name).join(', ')}.`,
        checkedAt: new Date().toISOString(),
    };
}

export interface GraphQueryBackend {
    id: string;
    query(context: GraphQueryBackendContext): Promise<GraphQueryBackendResult>;
    getDiagnostics?(): GraphQueryBackendDiagnostics;
    invalidate?(reason?: string): void;
}

export type GraphQueryBackendType = 'local_hybrid' | 'keyword_only' | 'local_vector';

export type LocalVectorAccelerationSelectionMode = 'full_scan' | 'token_prefilter' | 'token_signature_prefilter';
export type LocalVectorAccelerationFailureMode = 'fail_open' | 'fail_closed';

export type LocalVectorAccelerationAdapterHealth = {
    status: 'ready' | 'degraded' | 'unavailable' | 'unknown';
    message?: string;
    checkedAt?: string;
    indexSyncStatus?: 'ready' | 'degraded' | 'unavailable' | 'unknown';
    indexSyncMessage?: string;
    lastSyncAt?: string;
    syncRequestCount?: number;
    syncSuccessCount?: number;
    syncFailureCount?: number;
    syncedIndexSignature?: string;
    syncedAtomCount?: number;
    circuitState?: 'closed' | 'open' | 'half_open' | 'unknown';
    consecutiveFailures?: number;
    requestCount?: number;
    retryCount?: number;
    shortCircuitCount?: number;
    successCount?: number;
    failureCount?: number;
    halfOpenProbeSuccessCount?: number;
    halfOpenProbeFailureCount?: number;
    lastSuccessAt?: string;
    lastFailureAt?: string;
    circuitOpenedAt?: string;
    lastRequestId?: string;
    lastErrorCode?: string;
    lastRetryAfterMs?: number;
    representationVersion?: string;
    embeddingModelId?: string;
    embeddingDimension?: number;
    indexSignature?: string;
    representationStatus?: 'aligned' | 'mismatch' | 'unknown';
    representationStatusReason?: string;
    /** M10.6: Prefilter effectiveness ratio for runbook health gate. */
    prefilterEffectivenessRatio?: number;
    /** M10.6: Total atoms in scope of last prefilter selection. */
    lastTotalAtomsInScope?: number;
};

export type LocalVectorAccelerationSelectionInput = {
    atomCount: number;
    queryTokens: string[];
    queryWeights: ReadonlyMap<string, number>;
    topK: number;
    tokenToAtomIds: ReadonlyMap<string, string[]>;
    signatureBuckets: ReadonlyMap<string, string[]>;
    annPrefilterEnabled: boolean;
    representationVersion?: string;
    embeddingModelId?: string;
    embeddingDimension?: number;
    indexSignature?: string;
};

export type LocalVectorAccelerationSelectionOutput = {
    used: boolean;
    candidateAtomIds: string[];
    mode: LocalVectorAccelerationSelectionMode;
    /** M10.6: Validated representation contract from the prefilter output. */
    representation?: {
        version?: string;
        embeddingModelId?: string;
        embeddingDimension?: number;
        indexSignature?: string;
        validated: boolean;
    };
    /** M10.6: Prefilter effectiveness metrics for runbook health gate. */
    prefilterMetrics?: {
        candidatesReturned: number;
        totalAtomsInScope: number;
        prefilterRatio: number;
        signatureMatch: boolean;
    };
};

export type LocalVectorAccelerationIndexSyncInput = {
    atomCount: number;
    tokenToAtomIds: ReadonlyMap<string, string[]>;
    signatureBuckets: ReadonlyMap<string, string[]>;
    representationVersion?: string;
    embeddingModelId?: string;
    embeddingDimension?: number;
    indexSignature?: string;
};

export type LocalVectorAccelerationIndexSyncOutput = {
    synced: boolean;
    atomCount?: number;
    indexSignature?: string;
    representation?: {
        version?: string;
        embeddingModelId?: string;
        embeddingDimension?: number;
        indexSignature?: string;
        validated: boolean;
    };
};

export interface LocalVectorAccelerationAdapter {
    id: string;
    syncIndex?(
        input: LocalVectorAccelerationIndexSyncInput
    ): LocalVectorAccelerationIndexSyncOutput | Promise<LocalVectorAccelerationIndexSyncOutput>;
    selectCandidates(
        input: LocalVectorAccelerationSelectionInput
    ): LocalVectorAccelerationSelectionOutput | Promise<LocalVectorAccelerationSelectionOutput>;
    getHealth?(): LocalVectorAccelerationAdapterHealth;
}

export type GraphQueryBackendFactoryOptions = {
    backend?: GraphQueryBackendType | string;
    localVectorIndexPath?: string;
    localVectorAnnPrefilterEnabled?: boolean;
    localVectorAccelerationAdapter?: LocalVectorAccelerationAdapter;
    localVectorAccelerationFailureMode?: LocalVectorAccelerationFailureMode | string;
    localVectorAccelerationRepresentationStrict?: boolean;
};

export type GraphQueryBackendCatalogItem = {
    backend: GraphQueryBackendType;
    backendId: string;
    label: string;
    aliases: string[];
};

const GRAPH_QUERY_BACKEND_CATALOG: GraphQueryBackendCatalogItem[] = [
    {
        backend: 'local_hybrid',
        backendId: 'local-hybrid-v1',
        label: 'Local Hybrid',
        aliases: ['local_hybrid', 'local-hybrid', 'hybrid'],
    },
    {
        backend: 'keyword_only',
        backendId: 'keyword-only-v1',
        label: 'Keyword Only',
        aliases: ['keyword_only', 'keyword-only', 'keyword'],
    },
    {
        backend: 'local_vector',
        backendId: 'local-vector-v1',
        label: 'Local Vector',
        aliases: ['local_vector', 'local-vector', 'vector', 'semantic_vector', 'semantic-vector'],
    },
];

const SEMANTIC_CONTENT_TOKEN_LIMIT = 180;
const SEMANTIC_TITLE_TOKEN_LIMIT = 24;
const SEMANTIC_KEYWORD_TOKEN_LIMIT = 40;
const SEMANTIC_QUERY_TOKEN_LIMIT = 48;
const SEMANTIC_CJK_NGRAM_LIMIT = 96;
const LOCAL_VECTOR_INDEX_SCHEMA_VERSION = 2;
const LOCAL_VECTOR_INDEX_BACKEND_ID = 'local-vector-v1';
const LOCAL_VECTOR_INDEX_SIGNATURE_VERSION = 'local-vector-index-signature-v2';
const LOCAL_VECTOR_ACCELERATION_ADAPTER_ID = 'local-vector-acceleration-ann-v1';
const LOCAL_VECTOR_REPRESENTATION_VERSION = 'local-vector-representation-v2';
const LOCAL_VECTOR_EMBEDDING_MODEL_ID = 'local-semantic-tfidf-unicode-v2';
const LOCAL_VECTOR_ANN_MIN_ATOMS = 96;
const LOCAL_VECTOR_ANN_TOP_QUERY_TOKENS = 8;
const LOCAL_VECTOR_ANN_CANDIDATE_MULTIPLIER = 28;
const LOCAL_VECTOR_ANN_CANDIDATE_MIN_FLOOR = 48;
const LOCAL_VECTOR_ANN_SIGNATURE_PREFIX_BITS = 14;
const LOCAL_VECTOR_ANN_SIGNATURE_SCORE_BONUS = 0.08;
const LOCAL_VECTOR_ANN_HASH_CACHE_SOFT_LIMIT = 50000;

type LocalVectorIndexSnapshotEntry = {
    atomId: string;
    tokens: string[];
    weights: Array<[string, number]>;
};

type LocalVectorIndexSnapshot = {
    schemaVersion: number;
    backendId: string;
    signature: string;
    builtAt: string;
    atomCount: number;
    documentFrequency: Array<[string, number]>;
    entries: LocalVectorIndexSnapshotEntry[];
};

type LocalVectorIndexEntry = {
    atomId: string;
    tokens: string[];
    weights: Map<string, number>;
    signaturePrefix: string;
};

type LocalVectorIndexState = {
    signature: string;
    builtAt: string;
    atomCount: number;
    documentFrequency: Map<string, number>;
    entriesByAtomId: Map<string, LocalVectorIndexEntry>;
    tokenToAtomIds: Map<string, string[]>;
    signatureBuckets: Map<string, string[]>;
    loadedFromDisk: boolean;
    persisted: boolean;
};

type LocalVectorAnnCandidateSelection = {
    used: boolean;
    candidateAtomIds: Set<string>;
    mode: LocalVectorAccelerationSelectionMode;
    adapterId: string;
    adapterError?: string;
};

const LOCAL_VECTOR_TOKEN_HASH_CACHE = new Map<string, bigint>();

function clamp(value: number, minValue: number, maxValue: number): number {
    return Math.min(maxValue, Math.max(minValue, value));
}

function normalizeSemanticToken(rawValue: unknown): string {
    return String(rawValue || '')
        .trim()
        .toLowerCase()
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}

function stemSemanticToken(rawValue: unknown): string {
    const token = normalizeSemanticToken(rawValue);
    if (!token) {
        return '';
    }

    if (!/^[a-z0-9]+$/.test(token)) {
        return token;
    }

    if (token.endsWith('ies') && token.length > 4) {
        return `${token.slice(0, -3)}y`;
    }
    if (token.endsWith('ing') && token.length > 5) {
        return token.slice(0, -3);
    }
    if (token.endsWith('ed') && token.length > 4) {
        return token.slice(0, -2);
    }
    if (token.endsWith('es') && token.length > 4 && !token.endsWith('ses')) {
        return token.slice(0, -2);
    }
    if (
        token.endsWith('s')
        && token.length > 3
        && !token.endsWith('ss')
        && !token.endsWith('is')
        && !token.endsWith('us')
    ) {
        return token.slice(0, -1);
    }
    return token;
}

function buildCjkSemanticNgrams(rawText: unknown, limit: number): string[] {
    if (limit <= 0) {
        return [];
    }
    const segments = String(rawText || '')
        .normalize('NFKC')
        .match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu) || [];
    const tokens: string[] = [];
    const seen = new Set<string>();
    for (const segment of segments) {
        const chars = Array.from(segment);
        if (chars.length === 1) {
            const token = chars[0];
            if (!seen.has(token)) {
                seen.add(token);
                tokens.push(token);
            }
            continue;
        }
        for (const gramSize of [2, 3]) {
            if (chars.length < gramSize) {
                continue;
            }
            for (let index = 0; index <= chars.length - gramSize; index += 1) {
                const token = chars.slice(index, index + gramSize).join('');
                if (!token || seen.has(token)) {
                    continue;
                }
                seen.add(token);
                tokens.push(token);
                if (tokens.length >= limit) {
                    return tokens;
                }
            }
        }
    }
    return tokens;
}

function extractSemanticTokens(rawText: unknown, limit: number): string[] {
    if (limit <= 0) {
        return [];
    }
    const tokens = String(rawText || '')
        .normalize('NFKC')
        .toLowerCase()
        .match(/[\p{L}\p{N}]+(?:[_-][\p{L}\p{N}]+)*/gu) || [];
    const collected: string[] = [];
    const seen = new Set<string>();
    for (const token of tokens) {
        const normalized = stemSemanticToken(token);
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        collected.push(normalized);
        if (collected.length >= limit) {
            break;
        }
    }
    if (collected.length >= limit) {
        return collected;
    }
    const cjkTokens = buildCjkSemanticNgrams(rawText, Math.min(limit - collected.length, SEMANTIC_CJK_NGRAM_LIMIT));
    for (const token of cjkTokens) {
        if (!token || seen.has(token)) {
            continue;
        }
        seen.add(token);
        collected.push(token);
        if (collected.length >= limit) {
            break;
        }
    }
    return collected;
}

function uniqueTokens(tokens: string[]): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();
    tokens.forEach((token) => {
        if (!token || seen.has(token)) {
            return;
        }
        seen.add(token);
        unique.push(token);
    });
    return unique;
}

function buildAtomSemanticTokens(atom: KnowledgeAtom): string[] {
    const keywordTokens = uniqueTokens(
        (atom.keywords || [])
            .map((keyword) => stemSemanticToken(keyword))
            .filter((token) => token.length > 0)
            .slice(0, SEMANTIC_KEYWORD_TOKEN_LIMIT)
    );
    const titleTokens = extractSemanticTokens(atom.title, SEMANTIC_TITLE_TOKEN_LIMIT);
    const contentTokens = extractSemanticTokens(atom.content, SEMANTIC_CONTENT_TOKEN_LIMIT);
    return uniqueTokens([...keywordTokens, ...titleTokens, ...contentTokens]);
}

function buildQuerySemanticTokens(context: GraphQueryBackendContext): string[] {
    const directTokens = uniqueTokens(
        (context.queryTokens || [])
            .map((token) => stemSemanticToken(token))
            .filter((token) => token.length > 0)
    );
    const fallbackTokens = extractSemanticTokens(context.query, SEMANTIC_QUERY_TOKEN_LIMIT);
    return uniqueTokens([...directTokens, ...fallbackTokens]).slice(0, SEMANTIC_QUERY_TOKEN_LIMIT);
}

function computeJaccard(left: string[], right: string[]): number {
    if (!left.length || !right.length) {
        return 0;
    }

    const leftSet = new Set(left);
    const rightSet = new Set(right);
    let intersection = 0;
    leftSet.forEach((token) => {
        if (rightSet.has(token)) {
            intersection += 1;
        }
    });

    const union = leftSet.size + rightSet.size - intersection;
    if (union <= 0) {
        return 0;
    }
    return intersection / union;
}

function buildTokenFrequency(tokens: string[]): Map<string, number> {
    const frequency = new Map<string, number>();
    tokens.forEach((token) => {
        if (!token) {
            return;
        }
        frequency.set(token, (frequency.get(token) || 0) + 1);
    });
    return frequency;
}

function buildTfIdfWeights(
    frequency: Map<string, number>,
    docFrequency: Map<string, number>,
    totalDocs: number
): Map<string, number> {
    const weights = new Map<string, number>();
    const maxTermCount = Math.max(
        1,
        ...Array.from(frequency.values()).map((value) => Math.max(0, Math.floor(Number(value) || 0)))
    );
    frequency.forEach((count, token) => {
        const tf = Math.max(0, Math.floor(Number(count) || 0)) / maxTermCount;
        const df = Math.max(1, Math.floor(Number(docFrequency.get(token) || 0)));
        const idf = Math.log((1 + totalDocs) / (1 + df)) + 1;
        weights.set(token, Number((tf * idf).toFixed(8)));
    });
    return weights;
}

function computeCosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
    if (left.size <= 0 || right.size <= 0) {
        return 0;
    }

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    left.forEach((weight, token) => {
        const rightWeight = right.get(token) || 0;
        dot += weight * rightWeight;
        leftNorm += weight * weight;
    });
    right.forEach((weight) => {
        rightNorm += weight * weight;
    });
    const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
    if (!Number.isFinite(denominator) || denominator <= 0) {
        return 0;
    }
    return dot / denominator;
}

function normalizeVectorIndexPath(rawValue: unknown): string | undefined {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed) {
        return undefined;
    }
    return path.resolve(trimmed);
}

function toSerializableWeightEntries(weights: Map<string, number>): Array<[string, number]> {
    const entries: Array<[string, number]> = [];
    weights.forEach((weight, token) => {
        if (!token) {
            return;
        }
        const numericWeight = Number(weight);
        if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
            return;
        }
        entries.push([token, Number(numericWeight.toFixed(8))]);
    });
    entries.sort((left, right) => left[0].localeCompare(right[0]));
    return entries;
}

function toWeightMap(entries: unknown): Map<string, number> {
    const weightMap = new Map<string, number>();
    if (!Array.isArray(entries)) {
        return weightMap;
    }
    entries.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length < 2) {
            return;
        }
        const token = String(entry[0] || '').trim().toLowerCase();
        const weight = Number(entry[1]);
        if (!token || !Number.isFinite(weight) || weight <= 0) {
            return;
        }
        weightMap.set(token, Number(weight.toFixed(8)));
    });
    return weightMap;
}

function computeLocalVectorSignature(atoms: KnowledgeAtom[]): string {
    const hash = createHash('sha256');
    hash.update(LOCAL_VECTOR_INDEX_SIGNATURE_VERSION);
    const sortedAtoms = [...atoms].sort((left, right) => left.id.localeCompare(right.id));
    sortedAtoms.forEach((atom) => {
        const sourceHash = String(atom.metadata?.sourceHash || '').trim();
        const version = Number(atom.metadata?.version || 0);
        hash.update(atom.id);
        hash.update('\u0000');
        hash.update(String(atom.updatedAt || ''));
        hash.update('\u0000');
        hash.update(sourceHash);
        hash.update('\u0000');
        hash.update(String(Number.isFinite(version) ? version : 0));
        hash.update('\u0000');
        if (!sourceHash) {
            hash.update(String(atom.title || ''));
            hash.update('\u0000');
            hash.update(String(atom.content || ''));
            hash.update('\u0000');
            hash.update((atom.keywords || []).join('|'));
        }
        hash.update('\u0001');
    });
    return hash.digest('hex');
}

function getLocalVectorTokenHash64(token: string): bigint {
    const normalizedToken = String(token || '').trim().toLowerCase();
    if (!normalizedToken) {
        return 0n;
    }
    const cached = LOCAL_VECTOR_TOKEN_HASH_CACHE.get(normalizedToken);
    if (typeof cached !== 'undefined') {
        return cached;
    }
    const tokenHashHex = createHash('sha1')
        .update(`local_vector_ann:${normalizedToken}`)
        .digest('hex')
        .slice(0, 16);
    const tokenHash = BigInt(`0x${tokenHashHex}`);
    if (LOCAL_VECTOR_TOKEN_HASH_CACHE.size >= LOCAL_VECTOR_ANN_HASH_CACHE_SOFT_LIMIT) {
        const firstKey = LOCAL_VECTOR_TOKEN_HASH_CACHE.keys().next().value;
        if (typeof firstKey === 'string') {
            LOCAL_VECTOR_TOKEN_HASH_CACHE.delete(firstKey);
        }
    }
    LOCAL_VECTOR_TOKEN_HASH_CACHE.set(normalizedToken, tokenHash);
    return tokenHash;
}

function computeWeightedSimHash(weights: Map<string, number>): bigint {
    if (weights.size <= 0) {
        return 0n;
    }
    const accumulator = new Array<number>(64).fill(0);
    weights.forEach((weight, token) => {
        const numericWeight = Number(weight);
        if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
            return;
        }
        const tokenHash = getLocalVectorTokenHash64(token);
        for (let bitIndex = 0; bitIndex < 64; bitIndex += 1) {
            const bitMask = (tokenHash >> BigInt(bitIndex)) & 1n;
            accumulator[bitIndex] += bitMask === 1n ? numericWeight : -numericWeight;
        }
    });
    let signature = 0n;
    for (let bitIndex = 0; bitIndex < 64; bitIndex += 1) {
        if (accumulator[bitIndex] >= 0) {
            signature |= (1n << BigInt(bitIndex));
        }
    }
    return signature;
}

function computeSimHashPrefix(signature: bigint, prefixBits: number): string {
    const normalizedBits = Math.max(1, Math.min(64, Math.floor(Number(prefixBits) || 0)));
    const shiftBits = Math.max(0, 64 - normalizedBits);
    const prefixValue = shiftBits > 0
        ? (signature >> BigInt(shiftBits))
        : signature;
    const width = Math.max(1, Math.ceil(normalizedBits / 4));
    return prefixValue.toString(16).padStart(width, '0');
}

function buildLocalVectorAnnStructures(
    entriesByAtomId: Map<string, LocalVectorIndexEntry>
): {
    tokenToAtomIds: Map<string, string[]>;
    signatureBuckets: Map<string, string[]>;
} {
    const tokenToAtomIds = new Map<string, string[]>();
    const signatureBuckets = new Map<string, string[]>();
    entriesByAtomId.forEach((entry, atomId) => {
        entry.tokens.forEach((token) => {
            if (!token) {
                return;
            }
            const postingList = tokenToAtomIds.get(token) || [];
            postingList.push(atomId);
            tokenToAtomIds.set(token, postingList);
        });
        const prefix = entry.signaturePrefix;
        if (!prefix) {
            return;
        }
        const bucket = signatureBuckets.get(prefix) || [];
        bucket.push(atomId);
        signatureBuckets.set(prefix, bucket);
    });
    return {
        tokenToAtomIds,
        signatureBuckets,
    };
}

function selectLocalVectorAnnCandidatesByDefaultStrategy(
    input: LocalVectorAccelerationSelectionInput
): LocalVectorAccelerationSelectionOutput {
    if (!input.annPrefilterEnabled) {
        return {
            used: false,
            candidateAtomIds: [],
            mode: 'full_scan',
        };
    }
    if (input.atomCount < LOCAL_VECTOR_ANN_MIN_ATOMS) {
        return {
            used: false,
            candidateAtomIds: [],
            mode: 'full_scan',
        };
    }

    const prioritizedTokens = uniqueTokens([
        ...Array.from(input.queryWeights.entries())
            .filter((entry) => entry[1] > 0)
            .sort((left, right) => right[1] - left[1])
            .map((entry) => entry[0]),
        ...input.queryTokens,
    ]).slice(0, LOCAL_VECTOR_ANN_TOP_QUERY_TOKENS);

    if (prioritizedTokens.length <= 0) {
        return {
            used: false,
            candidateAtomIds: [],
            mode: 'full_scan',
        };
    }

    const targetCandidateCount = Math.min(
        input.atomCount,
        Math.max(
            LOCAL_VECTOR_ANN_CANDIDATE_MIN_FLOOR,
            Math.max(1, input.topK) * LOCAL_VECTOR_ANN_CANDIDATE_MULTIPLIER
        )
    );
    const minimumCandidateCount = Math.min(
        input.atomCount,
        Math.max(Math.max(1, input.topK) * 2, Math.floor(LOCAL_VECTOR_ANN_CANDIDATE_MIN_FLOOR / 2))
    );

    const candidateAtomIds = new Set<string>();
    let tokenPrefilterUsed = false;
    prioritizedTokens.forEach((token) => {
        if (candidateAtomIds.size >= targetCandidateCount) {
            return;
        }
        const postingList = input.tokenToAtomIds.get(token);
        if (!postingList || postingList.length <= 0) {
            return;
        }
        tokenPrefilterUsed = true;
        postingList.forEach((atomId) => {
            if (candidateAtomIds.size >= targetCandidateCount) {
                return;
            }
            const normalizedAtomId = String(atomId || '').trim();
            if (normalizedAtomId) {
                candidateAtomIds.add(normalizedAtomId);
            }
        });
    });

    let signaturePrefilterUsed = false;
    if (candidateAtomIds.size < targetCandidateCount && input.queryWeights.size > 0) {
        const querySignature = computeWeightedSimHash(new Map<string, number>(input.queryWeights));
        const queryPrefix = computeSimHashPrefix(querySignature, LOCAL_VECTOR_ANN_SIGNATURE_PREFIX_BITS);
        const signatureBucket = input.signatureBuckets.get(queryPrefix);
        if (signatureBucket && signatureBucket.length > 0) {
            signaturePrefilterUsed = true;
            signatureBucket.forEach((atomId) => {
                if (candidateAtomIds.size >= targetCandidateCount) {
                    return;
                }
                const normalizedAtomId = String(atomId || '').trim();
                if (normalizedAtomId) {
                    candidateAtomIds.add(normalizedAtomId);
                }
            });
        }
    }

    if (!tokenPrefilterUsed || candidateAtomIds.size < minimumCandidateCount) {
        return {
            used: false,
            candidateAtomIds: [],
            mode: 'full_scan',
        };
    }

    return {
        used: true,
        candidateAtomIds: Array.from(candidateAtomIds),
        mode: signaturePrefilterUsed ? 'token_signature_prefilter' : 'token_prefilter',
    };
}

const DEFAULT_LOCAL_VECTOR_ACCELERATION_ADAPTER: LocalVectorAccelerationAdapter = {
    id: LOCAL_VECTOR_ACCELERATION_ADAPTER_ID,
    syncIndex: () => ({
        synced: true,
    }),
    selectCandidates: selectLocalVectorAnnCandidatesByDefaultStrategy,
    getHealth: () => ({
        status: 'ready',
        message: 'local_ann_prefilter_active',
        checkedAt: new Date().toISOString(),
        indexSyncStatus: 'ready',
        indexSyncMessage: 'local_adapter_index_sync_not_required',
        representationVersion: LOCAL_VECTOR_REPRESENTATION_VERSION,
        embeddingModelId: LOCAL_VECTOR_EMBEDDING_MODEL_ID,
        representationStatus: 'aligned',
        representationStatusReason: 'local_adapter_representation_aligned',
    }),
};

async function selectLocalVectorAnnCandidates(params: {
    index: LocalVectorIndexState;
    queryTokens: string[];
    queryWeights: Map<string, number>;
    topK: number;
    annPrefilterEnabled: boolean;
    accelerationAdapter: LocalVectorAccelerationAdapter;
    failureMode: LocalVectorAccelerationFailureMode;
}): Promise<LocalVectorAnnCandidateSelection> {
    const adapterId = String(params.accelerationAdapter?.id || '').trim() || LOCAL_VECTOR_ACCELERATION_ADAPTER_ID;
    try {
        if (typeof params.accelerationAdapter.syncIndex === 'function') {
            await params.accelerationAdapter.syncIndex({
                atomCount: params.index.atomCount,
                tokenToAtomIds: params.index.tokenToAtomIds,
                signatureBuckets: params.index.signatureBuckets,
                representationVersion: LOCAL_VECTOR_REPRESENTATION_VERSION,
                embeddingModelId: LOCAL_VECTOR_EMBEDDING_MODEL_ID,
                embeddingDimension: params.index.documentFrequency.size,
                indexSignature: params.index.signature,
            });
        }
        const rawSelection = await params.accelerationAdapter.selectCandidates({
            atomCount: params.index.atomCount,
            queryTokens: [...params.queryTokens],
            queryWeights: params.queryWeights,
            topK: params.topK,
            tokenToAtomIds: params.index.tokenToAtomIds,
            signatureBuckets: params.index.signatureBuckets,
            annPrefilterEnabled: params.annPrefilterEnabled,
            representationVersion: LOCAL_VECTOR_REPRESENTATION_VERSION,
            embeddingModelId: LOCAL_VECTOR_EMBEDDING_MODEL_ID,
            embeddingDimension: params.index.documentFrequency.size,
            indexSignature: params.index.signature,
        });
        const mode: LocalVectorAccelerationSelectionMode = (
            rawSelection?.mode === 'token_prefilter'
            || rawSelection?.mode === 'token_signature_prefilter'
            || rawSelection?.mode === 'full_scan'
        ) ? rawSelection.mode : 'full_scan';
        const candidateAtomIds = new Set<string>(
            Array.isArray(rawSelection?.candidateAtomIds)
                ? rawSelection.candidateAtomIds
                    .map((atomId) => String(atomId || '').trim())
                    .filter((atomId) => atomId.length > 0)
                : []
        );
        const used = rawSelection?.used === true
            && mode !== 'full_scan'
            && candidateAtomIds.size > 0;
        return {
            used,
            candidateAtomIds: used ? candidateAtomIds : new Set<string>(),
            mode: used ? mode : 'full_scan',
            adapterId,
        };
    } catch (error) {
        const normalizedError = String((error as Error)?.message || error || 'unknown_error')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 240);
        if (params.failureMode === 'fail_closed') {
            throw new Error(`vector_acceleration_adapter_failure:${adapterId}:${normalizedError || 'unknown_error'}`);
        }
        return {
            used: false,
            candidateAtomIds: new Set<string>(),
            mode: 'full_scan',
            adapterId,
            adapterError: normalizedError,
        };
    }
}

export class LocalHybridGraphQueryBackend implements GraphQueryBackend {
    public readonly id = 'local-hybrid-v1';

    public async query(context: GraphQueryBackendContext): Promise<GraphQueryBackendResult> {
        const queryLower = context.query.toLowerCase();
        const querySemanticTokens = buildQuerySemanticTokens(context);
        const connectionDegreeByAtomId = new Map<string, number>();
        context.activeEdges.forEach((edge) => {
            connectionDegreeByAtomId.set(edge.sourceAtomId, (connectionDegreeByAtomId.get(edge.sourceAtomId) || 0) + 1);
            connectionDegreeByAtomId.set(edge.targetAtomId, (connectionDegreeByAtomId.get(edge.targetAtomId) || 0) + 1);
        });

        const candidates: GraphQueryCandidate[] = [];
        context.atoms.forEach((atom) => {
            const titleLower = atom.title.toLowerCase();
            const contentLower = atom.content.toLowerCase();
            const keywordMatches = context.queryTokens.filter((token) => atom.keywords.includes(token)).length;
            const titleMatchBonus = queryLower && titleLower.includes(queryLower) ? 2 : 0;
            const contentMatchBonus = context.queryTokens.filter((token) => contentLower.includes(token)).length * 0.25;
            const relationBonus = (connectionDegreeByAtomId.get(atom.id) || 0) * 0.08;
            const atomSemanticTokens = buildAtomSemanticTokens(atom);
            const semanticSimilarity = computeJaccard(querySemanticTokens, atomSemanticTokens);
            const semanticBonus = semanticSimilarity * 1.6;
            const score = keywordMatches + titleMatchBonus + contentMatchBonus + relationBonus + semanticBonus;
            if (score > 0) {
                candidates.push({
                    atomId: atom.id,
                    score: Number(clamp(score, 0, 100).toFixed(4)),
                });
            }
        });

        candidates.sort((left, right) => right.score - left.score);
        const maxCandidates = Math.max(context.topK, Math.min(context.atoms.length, context.topK * 4));

        return {
            candidates: candidates.slice(0, maxCandidates),
            trace: {
                retrievalModes: ['keyword', 'semantic_similarity', 'graph_traversal', 'temporal_filter'],
                modeWeights: {
                    keyword: 0.32,
                    semantic: 0.2,
                    graph: 0.3,
                    temporal: 0.18,
                },
            },
        };
    }

    public getDiagnostics(): GraphQueryBackendDiagnostics {
        return {
            backendId: this.id,
            ready: true,
        };
    }
}

export class KeywordOnlyGraphQueryBackend implements GraphQueryBackend {
    public readonly id = 'keyword-only-v1';

    public async query(context: GraphQueryBackendContext): Promise<GraphQueryBackendResult> {
        const queryLower = context.query.toLowerCase();
        const candidates: GraphQueryCandidate[] = [];
        context.atoms.forEach((atom) => {
            const titleLower = atom.title.toLowerCase();
            const contentLower = atom.content.toLowerCase();
            const keywordMatches = context.queryTokens.filter((token) => atom.keywords.includes(token)).length;
            const titleMatchBonus = queryLower && titleLower.includes(queryLower) ? 2 : 0;
            const contentMatchBonus = context.queryTokens.filter((token) => contentLower.includes(token)).length * 0.22;
            const score = keywordMatches + titleMatchBonus + contentMatchBonus;
            if (score > 0) {
                candidates.push({
                    atomId: atom.id,
                    score: Number(clamp(score, 0, 100).toFixed(4)),
                });
            }
        });
        candidates.sort((left, right) => right.score - left.score);
        const maxCandidates = Math.max(context.topK, Math.min(context.atoms.length, context.topK * 4));
        return {
            candidates: candidates.slice(0, maxCandidates),
            trace: {
                retrievalModes: ['keyword', 'temporal_filter'],
                modeWeights: {
                    keyword: 0.72,
                    graph: 0.1,
                    temporal: 0.18,
                },
            },
        };
    }

    public getDiagnostics(): GraphQueryBackendDiagnostics {
        return {
            backendId: this.id,
            ready: true,
        };
    }
}

export class LocalVectorGraphQueryBackend implements GraphQueryBackend {
    public readonly id = LOCAL_VECTOR_INDEX_BACKEND_ID;

    private readonly localVectorIndexPath?: string;

    private readonly localVectorAnnPrefilterEnabled: boolean;

    private readonly localVectorAccelerationAdapter: LocalVectorAccelerationAdapter;

    private readonly localVectorAccelerationFailureMode: LocalVectorAccelerationFailureMode;

    private readonly localVectorAccelerationRepresentationStrict: boolean;

    private activeIndex: LocalVectorIndexState | null = null;

    private pendingIndexSignature: string | null = null;

    private pendingIndexBuild: Promise<LocalVectorIndexState> | null = null;

    private lastError: string | undefined;

    private invalidated = false;

    private invalidationReason: string | undefined;

    private lastAnnSelectionMode: LocalVectorAnnCandidateSelection['mode'] = 'full_scan';

    private lastAnnCandidateCount = 0;

    private lastAnnAdapterId = LOCAL_VECTOR_ACCELERATION_ADAPTER_ID;

    private lastAnnAdapterError: string | undefined;

    private lastAnnAdapterHealthStatus: 'ready' | 'degraded' | 'unavailable' | 'unknown' = 'unknown';

    private lastAnnAdapterHealthMessage: string | undefined;

    private lastAnnAdapterHealthCheckedAt: string | undefined;

    private lastAnnIndexSyncStatus: 'ready' | 'degraded' | 'unavailable' | 'unknown' = 'unknown';

    private lastAnnIndexSyncMessage: string | undefined;

    private lastAnnIndexLastSyncAt: string | undefined;

    private lastAnnIndexSyncRequestCount = 0;

    private lastAnnIndexSyncSuccessCount = 0;

    private lastAnnIndexSyncFailureCount = 0;

    private lastAnnIndexSyncedSignature: string | undefined;

    private lastAnnIndexSyncedAtomCount: number | undefined;

    private lastAnnAdapterCircuitState: 'closed' | 'open' | 'half_open' | 'unknown' = 'unknown';

    private lastAnnAdapterConsecutiveFailures = 0;

    private lastAnnAdapterRequestCount = 0;

    private lastAnnAdapterRetryCount = 0;

    private lastAnnAdapterShortCircuitCount = 0;

    private lastAnnAdapterSuccessCount = 0;

    private lastAnnAdapterFailureCount = 0;

    private lastAnnAdapterHalfOpenProbeSuccessCount = 0;

    private lastAnnAdapterHalfOpenProbeFailureCount = 0;

    private lastAnnAdapterLastSuccessAt: string | undefined;

    private lastAnnAdapterLastFailureAt: string | undefined;

    private lastAnnAdapterCircuitOpenedAt: string | undefined;

    private lastAnnAdapterLastRequestId: string | undefined;

    private lastAnnAdapterLastErrorCode: string | undefined;

    private lastAnnAdapterLastRetryAfterMs = 0;

    private lastAnnRepresentationVersion: string | undefined;

    private lastAnnEmbeddingModelId: string | undefined;

    private lastAnnEmbeddingDimension: number | undefined;

    private lastAnnIndexSignature: string | undefined;

    private lastAnnRepresentationStatus: 'aligned' | 'mismatch' | 'unknown' = 'unknown';

    private lastAnnRepresentationStatusReason: string | undefined;

    constructor(options: {
        localVectorIndexPath?: string;
        localVectorAnnPrefilterEnabled?: boolean;
        localVectorAccelerationAdapter?: LocalVectorAccelerationAdapter;
        localVectorAccelerationFailureMode?: LocalVectorAccelerationFailureMode | string;
        localVectorAccelerationRepresentationStrict?: boolean;
    } = {}) {
        this.localVectorIndexPath = normalizeVectorIndexPath(options.localVectorIndexPath);
        this.localVectorAnnPrefilterEnabled = options.localVectorAnnPrefilterEnabled !== false;
        const providedAdapter = options.localVectorAccelerationAdapter;
        const normalizedAdapterId = String(providedAdapter?.id || '').trim();
        this.localVectorAccelerationAdapter = (
            providedAdapter
            && normalizedAdapterId
            && typeof providedAdapter.selectCandidates === 'function'
        )
            ? providedAdapter
            : DEFAULT_LOCAL_VECTOR_ACCELERATION_ADAPTER;
        this.localVectorAccelerationFailureMode = normalizeLocalVectorAccelerationFailureMode(
            options.localVectorAccelerationFailureMode
        );
        this.localVectorAccelerationRepresentationStrict =
            options.localVectorAccelerationRepresentationStrict === true;
        this.refreshAccelerationAdapterHealth();
    }

    public async query(context: GraphQueryBackendContext): Promise<GraphQueryBackendResult> {
        const index = await this.ensureIndex(context.atoms);
        const querySemanticTokens = buildQuerySemanticTokens(context);
        const queryFrequency = buildTokenFrequency(querySemanticTokens);
        const connectionDegreeByAtomId = new Map<string, number>();
        context.activeEdges.forEach((edge) => {
            connectionDegreeByAtomId.set(edge.sourceAtomId, (connectionDegreeByAtomId.get(edge.sourceAtomId) || 0) + 1);
            connectionDegreeByAtomId.set(edge.targetAtomId, (connectionDegreeByAtomId.get(edge.targetAtomId) || 0) + 1);
        });

        const totalDocs = Math.max(1, index.atomCount);
        const queryWeights = buildTfIdfWeights(queryFrequency, index.documentFrequency, totalDocs);
        const querySignaturePrefix = computeSimHashPrefix(
            computeWeightedSimHash(queryWeights),
            LOCAL_VECTOR_ANN_SIGNATURE_PREFIX_BITS
        );
        let annCandidateSelection: LocalVectorAnnCandidateSelection;
        try {
            annCandidateSelection = await selectLocalVectorAnnCandidates({
                index,
                queryTokens: querySemanticTokens,
                queryWeights,
                topK: context.topK,
                annPrefilterEnabled: this.localVectorAnnPrefilterEnabled,
                accelerationAdapter: this.localVectorAccelerationAdapter,
                failureMode: this.localVectorAccelerationFailureMode,
            });
        } catch (error) {
            this.refreshAccelerationAdapterHealth();
            this.lastAnnSelectionMode = 'full_scan';
            this.lastAnnCandidateCount = index.atomCount;
            this.lastAnnAdapterId = String(this.localVectorAccelerationAdapter?.id || '').trim()
                || LOCAL_VECTOR_ACCELERATION_ADAPTER_ID;
            this.lastAnnAdapterError = String((error as Error)?.message || error || 'unknown_error')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 240);
            this.lastError = this.lastAnnAdapterError;
            throw error;
        }
        this.refreshAccelerationAdapterHealth();
        this.lastAnnSelectionMode = annCandidateSelection.mode;
        this.lastAnnCandidateCount = annCandidateSelection.used
            ? annCandidateSelection.candidateAtomIds.size
            : index.atomCount;
        this.lastAnnAdapterId = annCandidateSelection.adapterId;
        this.lastAnnAdapterError = annCandidateSelection.adapterError;
        const representationTelemetry = this.resolveAccelerationRepresentationTelemetry(index);
        if (
            this.localVectorAccelerationRepresentationStrict
            && representationTelemetry.representationStatus === 'mismatch'
        ) {
            const mismatchReason = String(
                representationTelemetry.representationStatusReason || 'representation_mismatch'
            ).trim().replace(/\s+/g, '_').slice(0, 200) || 'representation_mismatch';
            const strictMismatchError = (
                `vector_acceleration_representation_mismatch:${this.lastAnnAdapterId || 'unknown'}:${mismatchReason}`
            );
            this.lastAnnAdapterError = strictMismatchError;
            this.lastError = strictMismatchError;
            throw new Error(strictMismatchError);
        }
        const accelerationMode: GraphQueryBackendVectorAccelerationTrace['mode'] = (
            this.localVectorAnnPrefilterEnabled
            && annCandidateSelection.mode !== 'full_scan'
        ) ? 'ann_prefilter' : 'full_scan';
        const vectorAccelerationTrace: GraphQueryBackendVectorAccelerationTrace = {
            mode: accelerationMode,
            selectionMode: annCandidateSelection.mode,
            failureMode: this.localVectorAccelerationFailureMode,
            candidateCount: this.lastAnnCandidateCount,
            adapterId: this.lastAnnAdapterId,
            adapterError: this.lastAnnAdapterError,
            healthStatus: this.lastAnnAdapterHealthStatus,
            circuitState: this.lastAnnAdapterCircuitState,
            lastRequestId: this.lastAnnAdapterLastRequestId,
            lastErrorCode: this.lastAnnAdapterLastErrorCode,
            lastRetryAfterMs: this.lastAnnAdapterLastRetryAfterMs > 0
                ? this.lastAnnAdapterLastRetryAfterMs
                : undefined,
            representationVersion: representationTelemetry.representationVersion,
            embeddingModelId: representationTelemetry.embeddingModelId,
            embeddingDimension: representationTelemetry.embeddingDimension,
            indexSignature: representationTelemetry.indexSignature,
            representationStatus: representationTelemetry.representationStatus,
            representationStatusReason: representationTelemetry.representationStatusReason,
            representationStrictMode: this.localVectorAccelerationRepresentationStrict,
        };
        const atomIdsToScore = annCandidateSelection.used
            ? Array.from(annCandidateSelection.candidateAtomIds.values())
            : context.atoms.map((atom) => atom.id);
        const candidates: GraphQueryCandidate[] = [];

        atomIdsToScore.forEach((atomId) => {
            const entry = index.entriesByAtomId.get(atomId);
            if (!entry) {
                return;
            }
            const cosineSimilarity = computeCosineSimilarity(queryWeights, entry.weights);
            const semanticOverlap = computeJaccard(querySemanticTokens, entry.tokens);
            const relationBonus = (connectionDegreeByAtomId.get(atomId) || 0) * 0.06;
            const signatureBonus = entry.signaturePrefix === querySignaturePrefix
                ? LOCAL_VECTOR_ANN_SIGNATURE_SCORE_BONUS
                : 0;
            const score = (cosineSimilarity * 4.2) + (semanticOverlap * 1.1) + relationBonus + signatureBonus;
            if (score <= 0) {
                return;
            }
            candidates.push({
                atomId,
                score: Number(clamp(score, 0, 100).toFixed(4)),
            });
        });

        candidates.sort((left, right) => right.score - left.score);
        const maxCandidates = Math.max(context.topK, Math.min(context.atoms.length, context.topK * 4));

        return {
            candidates: candidates.slice(0, maxCandidates),
            trace: {
                retrievalModes: [
                    'vector_similarity',
                    'semantic_similarity',
                    'graph_traversal',
                    'temporal_filter',
                    ...(annCandidateSelection.used ? ['ann_prefilter'] : []),
                ],
                modeWeights: {
                    vector: 0.58,
                    semantic: 0.14,
                    graph: 0.1,
                    temporal: 0.18,
                },
                vectorAcceleration: vectorAccelerationTrace,
            },
        };
    }

    public getDiagnostics(): GraphQueryBackendDiagnostics {
        const index = this.activeIndex;
        const ready = (Boolean(index) && !this.invalidated) || !this.lastError;
        const status: NonNullable<GraphQueryBackendDiagnostics['vectorIndex']>['status'] = (index && !this.invalidated)
            ? 'ready'
            : (this.lastError ? 'unavailable' : 'stale');
        const accelerationMode: NonNullable<NonNullable<GraphQueryBackendDiagnostics['vectorIndex']>['acceleration']>['mode']
            = (
                this.localVectorAnnPrefilterEnabled
                && this.lastAnnSelectionMode !== 'full_scan'
            ) ? 'ann_prefilter' : 'full_scan';
        const representationTelemetry = index
            ? this.resolveAccelerationRepresentationTelemetry(index)
            : {
                representationVersion: this.lastAnnRepresentationVersion,
                embeddingModelId: this.lastAnnEmbeddingModelId,
                embeddingDimension: this.lastAnnEmbeddingDimension,
                indexSignature: this.lastAnnIndexSignature,
                representationStatus: this.lastAnnRepresentationStatus,
                representationStatusReason: this.lastAnnRepresentationStatusReason,
            };
        return {
            backendId: this.id,
            ready,
            lastError: this.lastError,
            vectorIndex: {
                enabled: true,
                status,
                location: this.localVectorIndexPath,
                signature: index?.signature,
                builtAt: index?.builtAt,
                atomCount: index?.atomCount,
                loadedFromDisk: index?.loadedFromDisk,
                persisted: index?.persisted,
                acceleration: {
                    enabled: this.localVectorAnnPrefilterEnabled,
                    mode: accelerationMode,
                    failureMode: this.localVectorAccelerationFailureMode,
                    indexSyncStatus: this.lastAnnIndexSyncStatus,
                    indexSyncMessage: this.lastAnnIndexSyncMessage,
                    lastSyncAt: this.lastAnnIndexLastSyncAt,
                    syncRequestCount: this.lastAnnIndexSyncRequestCount,
                    syncSuccessCount: this.lastAnnIndexSyncSuccessCount,
                    syncFailureCount: this.lastAnnIndexSyncFailureCount,
                    syncedIndexSignature: this.lastAnnIndexSyncedSignature,
                    syncedAtomCount: this.lastAnnIndexSyncedAtomCount,
                    lastSelectionMode: this.lastAnnSelectionMode,
                    lastCandidateCount: this.lastAnnCandidateCount,
                    adapterId: this.lastAnnAdapterId,
                    adapterError: this.lastAnnAdapterError,
                    healthStatus: this.lastAnnAdapterHealthStatus,
                    healthMessage: this.lastAnnAdapterHealthMessage,
                    healthCheckedAt: this.lastAnnAdapterHealthCheckedAt,
                    circuitState: this.lastAnnAdapterCircuitState,
                    consecutiveFailures: this.lastAnnAdapterConsecutiveFailures,
                    requestCount: this.lastAnnAdapterRequestCount,
                    retryCount: this.lastAnnAdapterRetryCount,
                    shortCircuitCount: this.lastAnnAdapterShortCircuitCount,
                    successCount: this.lastAnnAdapterSuccessCount,
                    failureCount: this.lastAnnAdapterFailureCount,
                    halfOpenProbeSuccessCount: this.lastAnnAdapterHalfOpenProbeSuccessCount,
                    halfOpenProbeFailureCount: this.lastAnnAdapterHalfOpenProbeFailureCount,
                    lastSuccessAt: this.lastAnnAdapterLastSuccessAt,
                    lastFailureAt: this.lastAnnAdapterLastFailureAt,
                    circuitOpenedAt: this.lastAnnAdapterCircuitOpenedAt,
                    lastRequestId: this.lastAnnAdapterLastRequestId,
                    lastErrorCode: this.lastAnnAdapterLastErrorCode,
                    lastRetryAfterMs: this.lastAnnAdapterLastRetryAfterMs > 0
                        ? this.lastAnnAdapterLastRetryAfterMs
                        : undefined,
                    representationVersion: representationTelemetry.representationVersion,
                    embeddingModelId: representationTelemetry.embeddingModelId,
                    embeddingDimension: representationTelemetry.embeddingDimension,
                    indexSignature: representationTelemetry.indexSignature,
                    representationStatus: representationTelemetry.representationStatus,
                    representationStatusReason: representationTelemetry.representationStatusReason,
                    representationStrictMode: this.localVectorAccelerationRepresentationStrict,
                },
            },
        };
    }

    public invalidate(reason?: string): void {
        this.invalidated = true;
        this.invalidationReason = String(reason || '').trim().slice(0, 160) || undefined;
    }

    private refreshAccelerationAdapterHealth(): void {
        if (!this.localVectorAccelerationAdapter || typeof this.localVectorAccelerationAdapter.getHealth !== 'function') {
            this.lastAnnAdapterHealthStatus = 'unknown';
            this.lastAnnAdapterHealthMessage = 'adapter_health_not_reported';
            this.lastAnnAdapterHealthCheckedAt = new Date().toISOString();
            this.lastAnnIndexSyncStatus = 'unknown';
            this.lastAnnIndexSyncMessage = 'adapter_health_not_reported';
            this.lastAnnIndexLastSyncAt = undefined;
            this.lastAnnIndexSyncRequestCount = 0;
            this.lastAnnIndexSyncSuccessCount = 0;
            this.lastAnnIndexSyncFailureCount = 0;
            this.lastAnnIndexSyncedSignature = undefined;
            this.lastAnnIndexSyncedAtomCount = undefined;
            this.lastAnnAdapterCircuitState = 'unknown';
            this.lastAnnAdapterConsecutiveFailures = 0;
            this.lastAnnAdapterRequestCount = 0;
            this.lastAnnAdapterRetryCount = 0;
            this.lastAnnAdapterShortCircuitCount = 0;
            this.lastAnnAdapterSuccessCount = 0;
            this.lastAnnAdapterFailureCount = 0;
            this.lastAnnAdapterHalfOpenProbeSuccessCount = 0;
            this.lastAnnAdapterHalfOpenProbeFailureCount = 0;
            this.lastAnnAdapterLastSuccessAt = undefined;
            this.lastAnnAdapterLastFailureAt = undefined;
            this.lastAnnAdapterCircuitOpenedAt = undefined;
            this.lastAnnAdapterLastRequestId = undefined;
            this.lastAnnAdapterLastErrorCode = undefined;
            this.lastAnnAdapterLastRetryAfterMs = 0;
            this.lastAnnRepresentationVersion = undefined;
            this.lastAnnEmbeddingModelId = undefined;
            this.lastAnnEmbeddingDimension = undefined;
            this.lastAnnIndexSignature = undefined;
            this.lastAnnRepresentationStatus = 'unknown';
            this.lastAnnRepresentationStatusReason = 'adapter_health_not_reported';
            return;
        }
        try {
            const health = this.localVectorAccelerationAdapter.getHealth();
            const normalizedStatus = String(health?.status || '').trim().toLowerCase();
            this.lastAnnAdapterHealthStatus = (
                normalizedStatus === 'ready'
                || normalizedStatus === 'degraded'
                || normalizedStatus === 'unavailable'
                || normalizedStatus === 'unknown'
            ) ? normalizedStatus : 'unknown';
            this.lastAnnAdapterHealthMessage = String(health?.message || '').trim().slice(0, 240) || undefined;
            this.lastAnnAdapterHealthCheckedAt = String(health?.checkedAt || '').trim() || new Date().toISOString();
            const normalizedIndexSyncStatus = String(health?.indexSyncStatus || '').trim().toLowerCase();
            this.lastAnnIndexSyncStatus = (
                normalizedIndexSyncStatus === 'ready'
                || normalizedIndexSyncStatus === 'degraded'
                || normalizedIndexSyncStatus === 'unavailable'
                || normalizedIndexSyncStatus === 'unknown'
            ) ? normalizedIndexSyncStatus : 'unknown';
            this.lastAnnIndexSyncMessage = String(health?.indexSyncMessage || '').trim().slice(0, 240) || undefined;
            this.lastAnnIndexLastSyncAt = String(health?.lastSyncAt || '').trim() || undefined;
            this.lastAnnIndexSyncRequestCount = Math.max(
                0,
                Math.floor(Number(health?.syncRequestCount || 0))
            );
            this.lastAnnIndexSyncSuccessCount = Math.max(
                0,
                Math.floor(Number(health?.syncSuccessCount || 0))
            );
            this.lastAnnIndexSyncFailureCount = Math.max(
                0,
                Math.floor(Number(health?.syncFailureCount || 0))
            );
            this.lastAnnIndexSyncedSignature = String(health?.syncedIndexSignature || '').trim().slice(0, 200) || undefined;
            this.lastAnnIndexSyncedAtomCount = Number.isFinite(Number(health?.syncedAtomCount))
                ? Math.max(0, Math.floor(Number(health?.syncedAtomCount || 0)))
                : undefined;
            const normalizedCircuitState = String(health?.circuitState || '').trim().toLowerCase();
            this.lastAnnAdapterCircuitState = (
                normalizedCircuitState === 'closed'
                || normalizedCircuitState === 'open'
                || normalizedCircuitState === 'half_open'
                || normalizedCircuitState === 'unknown'
            ) ? normalizedCircuitState : 'unknown';
            this.lastAnnAdapterConsecutiveFailures = Math.max(
                0,
                Math.floor(Number(health?.consecutiveFailures || 0))
            );
            this.lastAnnAdapterRequestCount = Math.max(
                0,
                Math.floor(Number(health?.requestCount || 0))
            );
            this.lastAnnAdapterRetryCount = Math.max(
                0,
                Math.floor(Number(health?.retryCount || 0))
            );
            this.lastAnnAdapterShortCircuitCount = Math.max(
                0,
                Math.floor(Number(health?.shortCircuitCount || 0))
            );
            this.lastAnnAdapterSuccessCount = Math.max(
                0,
                Math.floor(Number(health?.successCount || 0))
            );
            this.lastAnnAdapterFailureCount = Math.max(
                0,
                Math.floor(Number(health?.failureCount || 0))
            );
            this.lastAnnAdapterHalfOpenProbeSuccessCount = Math.max(
                0,
                Math.floor(Number(health?.halfOpenProbeSuccessCount || 0))
            );
            this.lastAnnAdapterHalfOpenProbeFailureCount = Math.max(
                0,
                Math.floor(Number(health?.halfOpenProbeFailureCount || 0))
            );
            this.lastAnnAdapterLastSuccessAt = String(health?.lastSuccessAt || '').trim() || undefined;
            this.lastAnnAdapterLastFailureAt = String(health?.lastFailureAt || '').trim() || undefined;
            this.lastAnnAdapterCircuitOpenedAt = String(health?.circuitOpenedAt || '').trim() || undefined;
            this.lastAnnAdapterLastRequestId = String(health?.lastRequestId || '').trim() || undefined;
            this.lastAnnAdapterLastErrorCode = String(health?.lastErrorCode || '').trim() || undefined;
            this.lastAnnAdapterLastRetryAfterMs = Math.max(
                0,
                Math.floor(Number(health?.lastRetryAfterMs || 0))
            );
            this.lastAnnRepresentationVersion = String(health?.representationVersion || '').trim().slice(0, 160) || undefined;
            this.lastAnnEmbeddingModelId = String(health?.embeddingModelId || '').trim().slice(0, 160) || undefined;
            this.lastAnnEmbeddingDimension = Number.isFinite(Number(health?.embeddingDimension))
                ? Math.max(0, Math.floor(Number(health?.embeddingDimension || 0)))
                : undefined;
            this.lastAnnIndexSignature = String(health?.indexSignature || '')
                .trim()
                .replace(/[^a-zA-Z0-9:_-]+/g, '')
                .slice(0, 200) || undefined;
            const rawRepresentationStatus = String(health?.representationStatus || '').trim().toLowerCase();
            this.lastAnnRepresentationStatus = (
                rawRepresentationStatus === 'aligned'
                || rawRepresentationStatus === 'mismatch'
                || rawRepresentationStatus === 'unknown'
            ) ? rawRepresentationStatus : 'unknown';
            this.lastAnnRepresentationStatusReason = String(health?.representationStatusReason || '')
                .trim()
                .replace(/\s+/g, ' ')
                .slice(0, 240) || undefined;
        } catch (error) {
            this.lastAnnAdapterHealthStatus = 'unavailable';
            this.lastAnnAdapterHealthMessage = String((error as Error)?.message || error).slice(0, 240);
            this.lastAnnAdapterHealthCheckedAt = new Date().toISOString();
            this.lastAnnIndexSyncStatus = 'unknown';
            this.lastAnnIndexSyncMessage = 'adapter_health_probe_failed';
            this.lastAnnIndexLastSyncAt = undefined;
            this.lastAnnIndexSyncRequestCount = 0;
            this.lastAnnIndexSyncSuccessCount = 0;
            this.lastAnnIndexSyncFailureCount = 0;
            this.lastAnnIndexSyncedSignature = undefined;
            this.lastAnnIndexSyncedAtomCount = undefined;
            this.lastAnnAdapterCircuitState = 'unknown';
            this.lastAnnAdapterConsecutiveFailures = 0;
            this.lastAnnAdapterRequestCount = 0;
            this.lastAnnAdapterRetryCount = 0;
            this.lastAnnAdapterShortCircuitCount = 0;
            this.lastAnnAdapterSuccessCount = 0;
            this.lastAnnAdapterFailureCount = 0;
            this.lastAnnAdapterHalfOpenProbeSuccessCount = 0;
            this.lastAnnAdapterHalfOpenProbeFailureCount = 0;
            this.lastAnnAdapterLastSuccessAt = undefined;
            this.lastAnnAdapterLastFailureAt = undefined;
            this.lastAnnAdapterCircuitOpenedAt = undefined;
            this.lastAnnAdapterLastRequestId = undefined;
            this.lastAnnAdapterLastErrorCode = undefined;
            this.lastAnnAdapterLastRetryAfterMs = 0;
            this.lastAnnRepresentationVersion = undefined;
            this.lastAnnEmbeddingModelId = undefined;
            this.lastAnnEmbeddingDimension = undefined;
            this.lastAnnIndexSignature = undefined;
            this.lastAnnRepresentationStatus = 'unknown';
            this.lastAnnRepresentationStatusReason = 'adapter_health_probe_failed';
        }
    }

    private resolveAccelerationRepresentationTelemetry(index: LocalVectorIndexState): {
        representationVersion?: string;
        embeddingModelId?: string;
        embeddingDimension?: number;
        indexSignature?: string;
        representationStatus: 'aligned' | 'mismatch' | 'unknown';
        representationStatusReason?: string;
    } {
        const expectedRepresentationVersion = LOCAL_VECTOR_REPRESENTATION_VERSION;
        const expectedEmbeddingModelId = LOCAL_VECTOR_EMBEDDING_MODEL_ID;
        const expectedEmbeddingDimension = Math.max(0, Math.floor(Number(index.documentFrequency.size || 0)));
        const expectedIndexSignature = String(index.signature || '').trim().slice(0, 200);
        const adapterId = String(this.lastAnnAdapterId || '').trim().toLowerCase();
        const localAdapterPath = (
            !adapterId
            || adapterId === LOCAL_VECTOR_ACCELERATION_ADAPTER_ID
            || adapterId.includes('local-vector-acceleration')
        );

        let representationVersion = this.lastAnnRepresentationVersion;
        let embeddingModelId = this.lastAnnEmbeddingModelId;
        let embeddingDimension = this.lastAnnEmbeddingDimension;
        let indexSignature = this.lastAnnIndexSignature;
        let representationStatus = this.lastAnnRepresentationStatus;
        let representationStatusReason = this.lastAnnRepresentationStatusReason;

        const mismatchReasons: string[] = [];
        let comparableFields = 0;

        if (representationVersion) {
            comparableFields += 1;
            if (representationVersion !== expectedRepresentationVersion) {
                mismatchReasons.push('representation_version');
            }
        }
        if (embeddingModelId) {
            comparableFields += 1;
            if (embeddingModelId !== expectedEmbeddingModelId) {
                mismatchReasons.push('embedding_model_id');
            }
        }
        if (typeof embeddingDimension === 'number' && embeddingDimension > 0) {
            comparableFields += 1;
            if (embeddingDimension !== expectedEmbeddingDimension) {
                mismatchReasons.push('embedding_dimension');
            }
        }
        if (indexSignature) {
            comparableFields += 1;
            if (indexSignature !== expectedIndexSignature) {
                mismatchReasons.push('index_signature');
            }
        }

        if (localAdapterPath) {
            representationVersion = expectedRepresentationVersion;
            embeddingModelId = expectedEmbeddingModelId;
            embeddingDimension = expectedEmbeddingDimension;
            indexSignature = expectedIndexSignature;
            representationStatus = 'aligned';
            representationStatusReason = 'local_adapter_representation_aligned';
        } else if (representationStatus === 'unknown') {
            if (mismatchReasons.length > 0) {
                representationStatus = 'mismatch';
                representationStatusReason = `mismatch:${mismatchReasons.join(',')}`;
            } else if (comparableFields > 0) {
                representationStatus = 'aligned';
                representationStatusReason = representationStatusReason || 'adapter_representation_metadata_aligned';
            } else {
                representationStatus = 'unknown';
                representationStatusReason = representationStatusReason || 'adapter_representation_metadata_missing';
            }
        } else if (representationStatus === 'mismatch' && !representationStatusReason) {
            representationStatusReason = mismatchReasons.length > 0
                ? `mismatch:${mismatchReasons.join(',')}`
                : 'adapter_reported_mismatch';
        } else if (representationStatus === 'aligned' && !representationStatusReason) {
            representationStatusReason = 'adapter_representation_metadata_aligned';
        }

        this.lastAnnRepresentationVersion = representationVersion || undefined;
        this.lastAnnEmbeddingModelId = embeddingModelId || undefined;
        this.lastAnnEmbeddingDimension = (
            typeof embeddingDimension === 'number'
            && Number.isFinite(embeddingDimension)
            && embeddingDimension > 0
        )
            ? Math.floor(embeddingDimension)
            : undefined;
        this.lastAnnIndexSignature = indexSignature || undefined;
        this.lastAnnRepresentationStatus = representationStatus;
        this.lastAnnRepresentationStatusReason = representationStatusReason || undefined;

        return {
            representationVersion: this.lastAnnRepresentationVersion,
            embeddingModelId: this.lastAnnEmbeddingModelId,
            embeddingDimension: this.lastAnnEmbeddingDimension,
            indexSignature: this.lastAnnIndexSignature,
            representationStatus: this.lastAnnRepresentationStatus,
            representationStatusReason: this.lastAnnRepresentationStatusReason,
        };
    }

    private async ensureIndex(atoms: KnowledgeAtom[]): Promise<LocalVectorIndexState> {
        const signature = computeLocalVectorSignature(atoms);
        if (!this.invalidated && this.activeIndex && this.activeIndex.signature === signature) {
            return this.activeIndex;
        }
        if (this.pendingIndexBuild && this.pendingIndexSignature === signature) {
            return this.pendingIndexBuild;
        }

        this.pendingIndexSignature = signature;
        this.pendingIndexBuild = this.loadOrBuildIndex(signature, atoms)
            .finally(() => {
                this.pendingIndexBuild = null;
                this.pendingIndexSignature = null;
            });
        return this.pendingIndexBuild;
    }

    private async loadOrBuildIndex(signature: string, atoms: KnowledgeAtom[]): Promise<LocalVectorIndexState> {
        const fromDisk = await this.tryLoadIndexFromDisk(signature);
        if (fromDisk) {
            this.activeIndex = fromDisk;
            this.invalidated = false;
            this.invalidationReason = undefined;
            this.lastError = undefined;
            return fromDisk;
        }

        const builtAt = new Date().toISOString();
        const memoryIndex = this.buildIndexFromAtoms({
            signature,
            builtAt,
            atoms,
            loadedFromDisk: false,
            persisted: false,
        });

        if (this.localVectorIndexPath) {
            const persisted = await this.tryPersistIndexToDisk(memoryIndex);
            memoryIndex.persisted = persisted;
        }

        this.activeIndex = memoryIndex;
        this.invalidated = false;
        this.invalidationReason = undefined;
        if (memoryIndex.persisted || !this.localVectorIndexPath) {
            this.lastError = undefined;
        }
        return memoryIndex;
    }

    private buildIndexFromAtoms(params: {
        signature: string;
        builtAt: string;
        atoms: KnowledgeAtom[];
        loadedFromDisk: boolean;
        persisted: boolean;
    }): LocalVectorIndexState {
        const atomTokensById = new Map<string, string[]>();
        const documentFrequency = new Map<string, number>();
        params.atoms.forEach((atom) => {
            const tokens = buildAtomSemanticTokens(atom);
            atomTokensById.set(atom.id, tokens);
            new Set(tokens).forEach((token) => {
                documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
            });
        });

        const totalDocs = Math.max(1, params.atoms.length);
        const entriesByAtomId = new Map<string, LocalVectorIndexEntry>();
        atomTokensById.forEach((tokens, atomId) => {
            const frequency = buildTokenFrequency(tokens);
            const weights = buildTfIdfWeights(frequency, documentFrequency, totalDocs);
            const signaturePrefix = computeSimHashPrefix(
                computeWeightedSimHash(weights),
                LOCAL_VECTOR_ANN_SIGNATURE_PREFIX_BITS
            );
            entriesByAtomId.set(atomId, {
                atomId,
                tokens,
                weights,
                signaturePrefix,
            });
        });
        const annStructures = buildLocalVectorAnnStructures(entriesByAtomId);

        return {
            signature: params.signature,
            builtAt: params.builtAt,
            atomCount: params.atoms.length,
            documentFrequency,
            entriesByAtomId,
            tokenToAtomIds: annStructures.tokenToAtomIds,
            signatureBuckets: annStructures.signatureBuckets,
            loadedFromDisk: params.loadedFromDisk,
            persisted: params.persisted,
        };
    }

    private buildSnapshot(index: LocalVectorIndexState): LocalVectorIndexSnapshot {
        const entries: LocalVectorIndexSnapshotEntry[] = Array.from(index.entriesByAtomId.values())
            .map((entry) => ({
                atomId: entry.atomId,
                tokens: [...entry.tokens],
                weights: toSerializableWeightEntries(entry.weights),
            }))
            .sort((left, right) => left.atomId.localeCompare(right.atomId));

        const documentFrequency: Array<[string, number]> = Array.from(index.documentFrequency.entries())
            .map(([token, count]) => [token, Math.max(0, Math.floor(Number(count) || 0))] as [string, number])
            .filter(([token, count]) => Boolean(token) && count > 0)
            .sort((left, right) => left[0].localeCompare(right[0]));

        return {
            schemaVersion: LOCAL_VECTOR_INDEX_SCHEMA_VERSION,
            backendId: this.id,
            signature: index.signature,
            builtAt: index.builtAt,
            atomCount: index.atomCount,
            documentFrequency,
            entries,
        };
    }

    private parseSnapshot(rawSnapshot: unknown): LocalVectorIndexSnapshot | null {
        if (!rawSnapshot || typeof rawSnapshot !== 'object') {
            return null;
        }
        const snapshot = rawSnapshot as Partial<LocalVectorIndexSnapshot>;
        if (
            Number(snapshot.schemaVersion) !== LOCAL_VECTOR_INDEX_SCHEMA_VERSION
            || String(snapshot.backendId || '') !== this.id
            || !Array.isArray(snapshot.entries)
            || !Array.isArray(snapshot.documentFrequency)
        ) {
            return null;
        }
        return {
            schemaVersion: LOCAL_VECTOR_INDEX_SCHEMA_VERSION,
            backendId: this.id,
            signature: String(snapshot.signature || '').trim(),
            builtAt: String(snapshot.builtAt || '').trim(),
            atomCount: Math.max(0, Math.floor(Number(snapshot.atomCount || 0))),
            documentFrequency: snapshot.documentFrequency,
            entries: snapshot.entries,
        };
    }

    private snapshotToIndex(snapshot: LocalVectorIndexSnapshot): LocalVectorIndexState {
        const documentFrequency = new Map<string, number>();
        snapshot.documentFrequency.forEach((entry) => {
            if (!Array.isArray(entry) || entry.length < 2) {
                return;
            }
            const token = String(entry[0] || '').trim().toLowerCase();
            const count = Math.max(0, Math.floor(Number(entry[1]) || 0));
            if (!token || count <= 0) {
                return;
            }
            documentFrequency.set(token, count);
        });

        const entriesByAtomId = new Map<string, LocalVectorIndexEntry>();
        snapshot.entries.forEach((entry) => {
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const atomId = String(entry.atomId || '').trim();
            if (!atomId) {
                return;
            }
            const tokens = Array.isArray(entry.tokens)
                ? uniqueTokens(entry.tokens.map((token) => stemSemanticToken(token)).filter((token) => token.length > 0))
                : [];
            const weights = toWeightMap(entry.weights);
            const signaturePrefix = computeSimHashPrefix(
                computeWeightedSimHash(weights),
                LOCAL_VECTOR_ANN_SIGNATURE_PREFIX_BITS
            );
            entriesByAtomId.set(atomId, {
                atomId,
                tokens,
                weights,
                signaturePrefix,
            });
        });
        const annStructures = buildLocalVectorAnnStructures(entriesByAtomId);

        return {
            signature: snapshot.signature,
            builtAt: snapshot.builtAt || new Date().toISOString(),
            atomCount: Math.max(snapshot.atomCount, entriesByAtomId.size),
            documentFrequency,
            entriesByAtomId,
            tokenToAtomIds: annStructures.tokenToAtomIds,
            signatureBuckets: annStructures.signatureBuckets,
            loadedFromDisk: true,
            persisted: true,
        };
    }

    private async tryLoadIndexFromDisk(signature: string): Promise<LocalVectorIndexState | null> {
        if (!this.localVectorIndexPath) {
            return null;
        }
        try {
            const content = await fs.promises.readFile(this.localVectorIndexPath, 'utf8');
            const parsedSnapshot = this.parseSnapshot(JSON.parse(content));
            if (!parsedSnapshot || parsedSnapshot.signature !== signature) {
                return null;
            }
            const index = this.snapshotToIndex(parsedSnapshot);
            return index;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException | undefined)?.code;
            if (code === 'ENOENT' || code === 'ENOTDIR') {
                return null;
            }
            this.lastError = String((error as Error)?.message || error);
            return null;
        }
    }

    private async tryPersistIndexToDisk(index: LocalVectorIndexState): Promise<boolean> {
        if (!this.localVectorIndexPath) {
            return false;
        }
        const resolvedPath = path.resolve(this.localVectorIndexPath);
        const directory = path.dirname(resolvedPath);
        const tempPath = `${resolvedPath}.tmp`;
        try {
            await fs.promises.mkdir(directory, { recursive: true });
            await fs.promises.writeFile(tempPath, JSON.stringify(this.buildSnapshot(index), null, 2), 'utf8');
            await fs.promises.rename(tempPath, resolvedPath);
            return true;
        } catch (error) {
            this.lastError = String((error as Error)?.message || error);
            return false;
        } finally {
            try {
                await fs.promises.unlink(tempPath);
            } catch (_cleanupError) {
            }
        }
    }
}

export function normalizeGraphQueryBackendType(rawValue: unknown): GraphQueryBackendType {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'keyword_only' || normalized === 'keyword-only' || normalized === 'keyword') {
        return 'keyword_only';
    }
    if (
        normalized === 'local_vector'
        || normalized === 'local-vector'
        || normalized === 'vector'
        || normalized === 'semantic_vector'
        || normalized === 'semantic-vector'
    ) {
        return 'local_vector';
    }
    return 'local_hybrid';
}

export function normalizeLocalVectorAccelerationFailureMode(
    rawValue: unknown
): LocalVectorAccelerationFailureMode {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'fail_closed'
        || normalized === 'fail-closed'
        || normalized === 'strict'
        || normalized === 'closed'
    ) {
        return 'fail_closed';
    }
    return 'fail_open';
}

export function createGraphQueryBackend(options: GraphQueryBackendFactoryOptions = {}): GraphQueryBackend {
    const backend = normalizeGraphQueryBackendType(options.backend);
    if (backend === 'keyword_only') {
        return new KeywordOnlyGraphQueryBackend();
    }
    if (backend === 'local_vector') {
        return new LocalVectorGraphQueryBackend({
            localVectorIndexPath: options.localVectorIndexPath,
            localVectorAnnPrefilterEnabled: options.localVectorAnnPrefilterEnabled,
            localVectorAccelerationAdapter: options.localVectorAccelerationAdapter,
            localVectorAccelerationFailureMode: normalizeLocalVectorAccelerationFailureMode(
                options.localVectorAccelerationFailureMode
            ),
            localVectorAccelerationRepresentationStrict: options.localVectorAccelerationRepresentationStrict === true,
        });
    }
    return new LocalHybridGraphQueryBackend();
}

export function listGraphQueryBackendCatalog(): GraphQueryBackendCatalogItem[] {
    return GRAPH_QUERY_BACKEND_CATALOG.map((item) => ({
        ...item,
        aliases: [...item.aliases],
    }));
}

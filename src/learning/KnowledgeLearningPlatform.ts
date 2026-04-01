import { createHash } from 'crypto';
import * as path from 'path';
import type { KnowledgeLearningPlatformAPI } from './api';
import type {
    DivergencePath,
    EvidenceSpan,
    IngestGuardrailEvaluationRequest,
    IngestGuardrailEvaluationResponse,
    IngestGuardrailGateResult,
    IngestGuardrailThresholds,
    KnowledgeAtom,
    KnowledgeDocumentDeleteInput,
    KnowledgeDocumentInput,
    KnowledgeIngestRequest,
    KnowledgeIngestOperation,
    KnowledgeIngestResponse,
    LearningQualityEvaluationRequest,
    LearningQualityEvaluationResponse,
    LearningQualityGateResult,
    LearningQualitySnapshot,
    LearningQualityThresholds,
    KnowledgeQueryItem,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    KnowledgeRepresentationType,
    KnowledgeSystemState,
    LearnerConceptState,
    LearningAction,
    LearningActionKind,
    LearningPathRequest,
    LearningPathResponse,
    MasteryDiagnosticsRequest,
    MasteryDiagnosticsResponse,
    MasteryObservation,
    MemoryEntry,
    MemoryLayer,
    MemoryPolicyRequest,
    MemoryPolicyResponse,
    RelationRecomputeMode,
    RelationEdge,
    RelationKind,
    StalenessRecord,
    TemporalEdge,
    TutorActionRequest,
    TutorActionResponse,
    TutorTrace,
} from './types';
import type {
    KnowledgeGraphSnapshot,
    KnowledgeGraphStore,
    KnowledgeGraphStoreDiagnostics,
    SerializedDocumentSnapshot,
} from './store';
import type { TutorAdapter } from './tutorAdapter';

type ParsedAtomDraft = {
    stableKey: string;
    title: string;
    content: string;
    representationType: KnowledgeRepresentationType;
    sectionPath: string[];
    startLine: number;
    endLine: number;
    startOffset: number;
    endOffset: number;
    keywords: string[];
};

type ParsedDocument = {
    atoms: ParsedAtomDraft[];
    wikiLinksByStableKey: Map<string, string[]>;
};

type DocumentSnapshot = {
    documentId: string;
    sourcePath: string;
    sourceHash: string;
    version: number;
    updatedAt: string;
    atomStableKeyToId: Map<string, string>;
    atomIds: string[];
    evidenceSpanIds: string[];
    relationEdgeIds: string[];
    temporalEdgeIds: string[];
};

type UserMemoryBank = {
    session: MemoryEntry[];
    unit: MemoryEntry[];
    long_term: MemoryEntry[];
};

type MemoryStats = {
    session: number;
    unit: number;
    longTerm: number;
};

export type KnowledgeLearningPlatformOptions = {
    nowProvider?: () => Date;
    store?: KnowledgeGraphStore;
    autoPersist?: boolean;
    tutorAdapter?: TutorAdapter;
};

const STOPWORDS = new Set<string>([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being',
    'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its', 'of',
    'on', 'or', 'that', 'the', 'their', 'this', 'to', 'was',
    'were', 'with', 'without', 'your', 'you', 'we', 'our', 'can',
    'will', 'shall', 'not', 'do', 'does', 'did', 'if', 'then',
]);

const MEMORY_LAYER_CAPACITY: Record<MemoryLayer, number> = {
    session: 80,
    unit: 320,
    long_term: 1200,
};

const DEFAULT_LEARNING_QUALITY_THRESHOLDS: LearningQualityThresholds = {
    retestPassRateUpliftPct: 20,
    misconceptionRecurrenceReductionPct: 25,
    evidenceBackedSuggestionRatioPct: 90,
    pathEffectivenessLiftPct: 5,
    queryP95Ms: 800,
};

const DEFAULT_INGEST_GUARDRAIL_THRESHOLDS: IngestGuardrailThresholds = {
    maxChangedDocuments: 2000,
    maxDeletedDocuments: 500,
    maxActiveAtoms: 200000,
    maxIngestP95Ms: 5000,
    maxRecomputeP95Ms: 5000,
};

const QUERY_LATENCY_HISTORY_LIMIT = 2000;
const INGEST_LATENCY_HISTORY_LIMIT = 2000;

function clamp(value: number, minValue: number, maxValue: number): number {
    return Math.min(maxValue, Math.max(minValue, value));
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeIdentifier(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
        .replace(/\s+/g, '_');
}

function tokenize(text: string): string[] {
    const normalized = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
    return Array.from(new Set(normalized));
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

function plusDays(isoDate: string, days: number): string {
    const date = new Date(isoDate);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function computePercentile(values: number[], percentile: number): number {
    if (!values.length) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const clampedPercentile = clamp(percentile, 0, 100);
    const rank = Math.ceil((clampedPercentile / 100) * sorted.length) - 1;
    const index = clamp(rank, 0, sorted.length - 1);
    return Number(sorted[index].toFixed(4));
}

export class KnowledgeLearningPlatform implements KnowledgeLearningPlatformAPI {
    private idCounter = 0;

    private readonly atoms = new Map<string, KnowledgeAtom>();

    private readonly evidenceSpans = new Map<string, EvidenceSpan>();

    private readonly relationEdges = new Map<string, RelationEdge>();

    private readonly temporalEdges = new Map<string, TemporalEdge>();

    private readonly documents = new Map<string, DocumentSnapshot>();

    private readonly activeStableKeyToAtomId = new Map<string, string>();

    private readonly activeAtomIds = new Set<string>();

    private readonly learnerStates = new Map<string, LearnerConceptState>();

    private readonly tutorTraces: TutorTrace[] = [];

    private readonly userMemory = new Map<string, UserMemoryBank>();

    private readonly titleToAtomIds = new Map<string, Set<string>>();

    private readonly relationEdgeSignatures = new Set<string>();

    private readonly ingestLatencyHistoryMs: number[] = [];

    private readonly recomputeLatencyHistoryMs: number[] = [];

    private readonly queryLatencyHistoryMs: number[] = [];

    private readonly nowProvider: () => Date;

    private readonly store: KnowledgeGraphStore | null;

    private readonly autoPersist: boolean;

    private readonly tutorAdapter: TutorAdapter | null;

    private latestIngestSummary: KnowledgeIngestResponse['summary'] | null = null;

    private hydrated = false;

    private hydrationPromise: Promise<void> | null = null;

    constructor(nowProviderOrOptions: (() => Date) | KnowledgeLearningPlatformOptions = {}) {
        if (typeof nowProviderOrOptions === 'function') {
            this.nowProvider = nowProviderOrOptions;
            this.store = null;
            this.autoPersist = true;
            this.tutorAdapter = null;
            return;
        }

        this.nowProvider = nowProviderOrOptions.nowProvider || (() => new Date());
        this.store = nowProviderOrOptions.store || null;
        this.autoPersist = nowProviderOrOptions.autoPersist !== false;
        this.tutorAdapter = nowProviderOrOptions.tutorAdapter || null;
    }

    public async ingestKnowledge(request: KnowledgeIngestRequest): Promise<KnowledgeIngestResponse> {
        await this.ensureHydrated();
        const ingestStartAtMs = Date.now();
        const ingestedAt = this.resolveTimestamp(request.ingestedAt);
        const incremental = request.incremental !== false;
        const changedDocIds = new Set<string>();
        const deletedDocIds = new Set<string>();
        const responseAtoms: KnowledgeAtom[] = [];
        const responseEvidence: EvidenceSpan[] = [];
        const responseRelations: RelationEdge[] = [];
        const responseTemporals: TemporalEdge[] = [];
        const staleness: StalenessRecord[] = [];
        const newAtomIds: string[] = [];
        const wikiLinksByAtomId = new Map<string, string[]>();
        let ingestedDocumentCount = 0;
        let invalidatedRelationEdges = 0;
        let regeneratedRelationEdges = 0;
        let recomputeLatencyMs: number | null = null;

        const processUpsert = (documentInput: KnowledgeDocumentInput): void => {
            const normalizedInput = this.normalizeDocumentInput(documentInput);
            ingestedDocumentCount += 1;
            const sourceHash = this.computeHash(normalizedInput.content);
            const previousSnapshot = this.documents.get(normalizedInput.documentId);
            const previousVersion = previousSnapshot?.version ?? 0;
            const currentVersion = previousVersion + 1;

            if (incremental && previousSnapshot && previousSnapshot.sourceHash === sourceHash) {
                staleness.push({
                    documentId: normalizedInput.documentId,
                    sourcePath: normalizedInput.sourcePath,
                    status: 'unchanged',
                    previousHash: previousSnapshot.sourceHash,
                    currentHash: sourceHash,
                    previousVersion: previousSnapshot.version,
                    currentVersion: previousSnapshot.version,
                });
                return;
            }

            const status: StalenessRecord['status'] = previousSnapshot ? 'updated' : 'new';
            staleness.push({
                documentId: normalizedInput.documentId,
                sourcePath: normalizedInput.sourcePath,
                status,
                previousHash: previousSnapshot?.sourceHash,
                currentHash: sourceHash,
                previousVersion: previousSnapshot?.version,
                currentVersion,
            });
            changedDocIds.add(normalizedInput.documentId);

            const parsedDocument = this.parseDocument(normalizedInput);
            const snapshot: DocumentSnapshot = {
                documentId: normalizedInput.documentId,
                sourcePath: normalizedInput.sourcePath,
                sourceHash,
                version: currentVersion,
                updatedAt: ingestedAt,
                atomStableKeyToId: new Map<string, string>(),
                atomIds: [],
                evidenceSpanIds: [],
                relationEdgeIds: [],
                temporalEdgeIds: [],
            };

            if (previousSnapshot) {
                invalidatedRelationEdges += this.retireRemovedStableKeys({
                    previousSnapshot,
                    parsedDocument,
                    retiredAt: ingestedAt,
                    responseTemporals,
                });
            }

            for (const draft of parsedDocument.atoms) {
                const evidenceId = this.nextId('evidence');
                const atomId = this.nextId('atom');
                const evidenceSpan: EvidenceSpan = {
                    id: evidenceId,
                    documentId: normalizedInput.documentId,
                    sourcePath: normalizedInput.sourcePath,
                    language: normalizedInput.language,
                    startOffset: draft.startOffset,
                    endOffset: draft.endOffset,
                    startLine: draft.startLine,
                    endLine: draft.endLine,
                    snippet: draft.content.slice(0, 320),
                    sourceHash,
                    createdAt: ingestedAt,
                };
                const atom: KnowledgeAtom = {
                    id: atomId,
                    stableKey: draft.stableKey,
                    documentId: normalizedInput.documentId,
                    sourcePath: normalizedInput.sourcePath,
                    title: draft.title,
                    content: draft.content,
                    representationType: draft.representationType,
                    keywords: draft.keywords,
                    evidenceSpanIds: [evidenceId],
                    createdAt: ingestedAt,
                    updatedAt: ingestedAt,
                    metadata: {
                        sectionPath: draft.sectionPath,
                        version: currentVersion,
                        sourceHash,
                        language: normalizedInput.language,
                    },
                };
                this.atoms.set(atomId, atom);
                this.evidenceSpans.set(evidenceId, evidenceSpan);
                this.activeAtomIds.add(atomId);
                this.activeStableKeyToAtomId.set(draft.stableKey, atomId);
                snapshot.atomStableKeyToId.set(draft.stableKey, atomId);
                snapshot.atomIds.push(atomId);
                snapshot.evidenceSpanIds.push(evidenceId);
                responseAtoms.push(atom);
                responseEvidence.push(evidenceSpan);
                newAtomIds.push(atomId);

                const outgoingWikiLinks = parsedDocument.wikiLinksByStableKey.get(draft.stableKey) || [];
                wikiLinksByAtomId.set(atomId, outgoingWikiLinks);

                const previousAtomId = previousSnapshot?.atomStableKeyToId.get(draft.stableKey);
                if (previousAtomId && previousAtomId !== atomId) {
                    this.activeAtomIds.delete(previousAtomId);
                    const supersedesEdge = this.createTemporalEdge({
                        sourceAtomId: previousAtomId,
                        targetAtomId: atomId,
                        edgeKind: 'supersedes',
                        validFrom: ingestedAt,
                        sourceDocumentHash: sourceHash,
                        isActive: true,
                    });
                    this.temporalEdges.set(supersedesEdge.id, supersedesEdge);
                    snapshot.temporalEdgeIds.push(supersedesEdge.id);
                    responseTemporals.push(supersedesEdge);
                    invalidatedRelationEdges += this.expireRelationsForAtom(previousAtomId, ingestedAt);
                }
            }

            for (let index = 1; index < snapshot.atomIds.length; index += 1) {
                const relation = this.createRelationEdge({
                    sourceAtomId: snapshot.atomIds[index - 1],
                    targetAtomId: snapshot.atomIds[index],
                    relationKind: 'sequence',
                    provenance: 'fact',
                    confidence: 0.98,
                    evidenceSpanIds: [
                        this.atoms.get(snapshot.atomIds[index - 1])?.evidenceSpanIds[0] || '',
                        this.atoms.get(snapshot.atomIds[index])?.evidenceSpanIds[0] || '',
                    ].filter((id) => id.length > 0),
                    validFrom: ingestedAt,
                });
                if (relation) {
                    snapshot.relationEdgeIds.push(relation.id);
                    responseRelations.push(relation);
                }
            }

            this.documents.set(normalizedInput.documentId, snapshot);
        };

        const processDelete = (deleteInput: KnowledgeDocumentDeleteInput): void => {
            const deleted = this.deleteDocumentSnapshot(deleteInput, ingestedAt, responseTemporals);
            if (!deleted.deleted || !deleted.documentId || !deleted.sourcePath) {
                return;
            }
            deletedDocIds.add(deleted.documentId);
            invalidatedRelationEdges += deleted.invalidatedRelationEdges;
            staleness.push({
                documentId: deleted.documentId,
                sourcePath: deleted.sourcePath,
                status: 'deleted',
                previousHash: deleted.previousHash,
                currentHash: `deleted:${ingestedAt}`,
                previousVersion: deleted.previousVersion,
                currentVersion: deleted.previousVersion || 0,
            });
        };

        const hasOperations = Array.isArray(request.operations) && request.operations.length > 0;
        if (hasOperations) {
            const operations = request.operations as KnowledgeIngestOperation[];
            operations.forEach((operation) => {
                if (operation.op === 'upsert') {
                    processUpsert(operation.document);
                } else if (operation.op === 'delete') {
                    processDelete(operation.document);
                }
            });
        } else {
            const documents = Array.isArray(request.documents) ? request.documents : [];
            documents.forEach((documentInput) => processUpsert(documentInput));
            const deletedDocuments = Array.isArray(request.deletedDocuments) ? request.deletedDocuments : [];
            deletedDocuments.forEach((deletedDocument) => processDelete(deletedDocument));
        }

        const resolvedRelationRecomputeMode = this.resolveRelationRecomputeMode({
            request,
            changedDocuments: changedDocIds.size,
            deletedDocuments: deletedDocIds.size,
            hasNewAtoms: newAtomIds.length > 0,
        });
        let recomputedDynamicRelations = false;

        this.rebuildTitleIndex();
        if (resolvedRelationRecomputeMode === 'full') {
            recomputedDynamicRelations = true;
            const recomputeStartAtMs = Date.now();
            const recomputeResult = this.recomputeDynamicRelations(ingestedAt);
            invalidatedRelationEdges += recomputeResult.invalidatedRelationEdges;
            regeneratedRelationEdges += recomputeResult.createdEdges.length;
            recomputeResult.createdEdges.forEach((edge) => responseRelations.push(edge));
            recomputeLatencyMs = Date.now() - recomputeStartAtMs;
        } else if (resolvedRelationRecomputeMode === 'incremental' && newAtomIds.length > 0) {
            const referenceEdges = this.createReferenceEdges(newAtomIds, wikiLinksByAtomId, ingestedAt);
            const inferredEdges = this.createInferredEdges(newAtomIds, ingestedAt);
            regeneratedRelationEdges += referenceEdges.length + inferredEdges.length;
            referenceEdges.forEach((edge) => responseRelations.push(edge));
            inferredEdges.forEach((edge) => responseRelations.push(edge));
        }

        const relationRecomputeLatencyMs = Number((recomputeLatencyMs ?? 0).toFixed(4));
        const response: KnowledgeIngestResponse = {
            atoms: responseAtoms,
            evidenceSpans: responseEvidence,
            relationEdges: responseRelations,
            temporalEdges: responseTemporals,
            staleness,
            summary: {
                ingestedDocuments: ingestedDocumentCount,
                changedDocuments: changedDocIds.size,
                deletedDocuments: deletedDocIds.size,
                activeAtoms: this.activeAtomIds.size,
                activeRelationEdges: this.collectActiveRelationEdges(ingestedAt).length,
                recomputedDynamicRelations,
                invalidatedRelationEdges,
                regeneratedRelationEdges,
                resolvedRelationRecomputeMode,
                relationRecomputeLatencyMs,
            },
        };
        this.latestIngestSummary = {
            ...response.summary,
        };
        const ingestLatencyMs = Date.now() - ingestStartAtMs;
        this.recordIngestLatency(ingestLatencyMs);
        if (recomputeLatencyMs !== null) {
            this.recordRecomputeLatency(recomputeLatencyMs);
        }
        await this.persistIfNeeded();
        return response;
    }

    public async queryKnowledge(request: KnowledgeQueryRequest): Promise<KnowledgeQueryResponse> {
        await this.ensureHydrated();
        const queryStartAtMs = Date.now();
        const query = normalizeWhitespace(String(request.query || ''));
        const asOf = this.resolveTimestamp(request.asOf);
        const topK = clamp(Math.floor(Number(request.topK) || 5), 1, 20);
        const tokens = tokenize(query);
        const activeEdges = this.collectActiveRelationEdges(asOf);

        const scoredItems: Array<{ atom: KnowledgeAtom; score: number }> = [];
        this.activeAtomIds.forEach((atomId) => {
            const atom = this.atoms.get(atomId);
            if (!atom) {
                return;
            }
            const titleLower = atom.title.toLowerCase();
            const contentLower = atom.content.toLowerCase();
            const keywordMatches = tokens.filter((token) => atom.keywords.includes(token)).length;
            const titleMatchBonus = query && titleLower.includes(query.toLowerCase()) ? 2 : 0;
            const contentMatchBonus = tokens.filter((token) => contentLower.includes(token)).length * 0.25;
            const relationBonus = activeEdges.filter((edge) =>
                edge.sourceAtomId === atom.id || edge.targetAtomId === atom.id
            ).length * 0.08;
            const score = keywordMatches + titleMatchBonus + contentMatchBonus + relationBonus;
            if (score > 0) {
                scoredItems.push({ atom, score });
            }
        });

        scoredItems.sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }
            return right.atom.updatedAt.localeCompare(left.atom.updatedAt);
        });

        const items: KnowledgeQueryItem[] = scoredItems
            .slice(0, topK)
            .map(({ atom, score }) => {
                const evidenceSpans = atom.evidenceSpanIds
                    .map((evidenceId) => this.evidenceSpans.get(evidenceId))
                    .filter((span): span is EvidenceSpan => Boolean(span));
                const relationPath = this.selectRelationPath(atom.id, activeEdges, 3);
                const temporalValidity = this.evaluateTemporalValidity(atom.id, asOf);
                return {
                    atom,
                    score: Number(score.toFixed(4)),
                    evidenceSpans,
                    relationPath,
                    temporalValidity,
                };
            });

        const latencyMs = Date.now() - queryStartAtMs;
        this.recordQueryLatency(latencyMs);
        const evidenceCoverageRatio = items.length > 0
            ? Number((items.filter((item) => item.evidenceSpans.length > 0).length / items.length).toFixed(4))
            : 1;
        const dynamicGraphWeight = items.length > 0
            ? Number((items.reduce((sum, item) => sum + item.relationPath.length, 0) / (items.length * 3)).toFixed(4))
            : 0;
        const graphWeight = clamp(0.25 + dynamicGraphWeight * 0.45, 0.25, 0.65);
        const temporalWeight = query.length > 0 ? 0.15 : 0.2;
        const keywordWeight = Number((1 - graphWeight - temporalWeight).toFixed(4));

        const response: KnowledgeQueryResponse = {
            items,
            trace: {
                retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                asOf,
                totalActiveAtoms: this.activeAtomIds.size,
                modeWeights: {
                    keyword: Number(clamp(keywordWeight, 0.1, 0.6).toFixed(4)),
                    graph: Number(graphWeight.toFixed(4)),
                    temporal: Number(temporalWeight.toFixed(4)),
                },
                latencyMs,
                evidenceCoverageRatio,
            },
        };
        await this.persistIfNeeded();
        return response;
    }

    public async diagnoseMastery(request: MasteryDiagnosticsRequest): Promise<MasteryDiagnosticsResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('MasteryDiagnosticsAPI requires a non-empty userId.');
        }
        const observedAt = this.resolveTimestamp(request.observedAt);
        const observations = Array.isArray(request.observations) ? request.observations : [];
        const updatedStates: LearnerConceptState[] = [];
        let masteryBefore = 0;
        let masteryAfter = 0;

        for (const observation of observations) {
            if (!isNonEmptyString(observation.atomId)) {
                continue;
            }
            const stateKey = this.makeLearnerStateKey(userId, observation.atomId);
            const previousState = this.learnerStates.get(stateKey) || this.createDefaultLearnerState(userId, observation.atomId, observedAt);
            masteryBefore += previousState.masteryProbability;
            const updatedState = this.applyMasteryObservation(previousState, observation, observedAt);
            masteryAfter += updatedState.masteryProbability;
            this.learnerStates.set(stateKey, updatedState);
            updatedStates.push(updatedState);
        }

        const updatedCount = updatedStates.length;
        const response: MasteryDiagnosticsResponse = {
            updatedStates,
            summary: {
                updatedCount,
                averageMasteryBefore: updatedCount > 0 ? Number((masteryBefore / updatedCount).toFixed(6)) : 0,
                averageMasteryAfter: updatedCount > 0 ? Number((masteryAfter / updatedCount).toFixed(6)) : 0,
            },
        };
        await this.persistIfNeeded();
        return response;
    }

    public async buildLearningPath(request: LearningPathRequest): Promise<LearningPathResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('LearningPathAPI requires a non-empty userId.');
        }
        const generatedAt = this.resolveTimestamp(request.generatedAt);
        const maxMasteryPaths = clamp(Math.floor(Number(request.maxMasteryPaths) || 3), 1, 12);
        const maxDivergencePaths = clamp(Math.floor(Number(request.maxDivergencePaths) || 3), 1, 12);
        const focusAtomIds = Array.isArray(request.focusAtomIds)
            ? request.focusAtomIds.filter((atomId): atomId is string => isNonEmptyString(atomId) && this.activeAtomIds.has(atomId))
            : [];

        const candidateAtomIds = focusAtomIds.length > 0 ? focusAtomIds : Array.from(this.activeAtomIds);
        const masteryPaths = this.buildMasteryPaths(userId, candidateAtomIds, maxMasteryPaths, generatedAt);
        const divergencePaths = this.buildDivergencePaths(userId, candidateAtomIds, maxDivergencePaths, generatedAt);
        const recommendedActions = [...masteryPaths, ...divergencePaths]
            .flatMap((pathItem) => pathItem.actions)
            .sort((left, right) => right.priority - left.priority)
            .slice(0, 24);

        return {
            masteryPaths,
            divergencePaths,
            recommendedActions,
        };
    }

    public async executeTutorAction(request: TutorActionRequest): Promise<TutorActionResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('TutorActionAPI requires a non-empty userId.');
        }
        const nowIso = this.resolveTimestamp(undefined);
        let targetAtom: KnowledgeAtom | undefined;

        if (isNonEmptyString(request.atomId)) {
            targetAtom = this.atoms.get(request.atomId);
        }

        if (!targetAtom && isNonEmptyString(request.prompt)) {
            const queryResult = await this.queryKnowledge({
                query: request.prompt,
                topK: 1,
                asOf: nowIso,
            });
            targetAtom = queryResult.items[0]?.atom;
        }

        if (!targetAtom) {
            throw new Error('TutorActionAPI could not resolve target atom.');
        }

        const evidenceSpans = targetAtom.evidenceSpanIds
            .map((evidenceId) => this.evidenceSpans.get(evidenceId))
            .filter((span): span is EvidenceSpan => Boolean(span));
        const neighbors = this.collectNeighborAtomIds(targetAtom.id, 3);
        const suggestedActions = this.buildTutorSuggestedActions(targetAtom.id, evidenceSpans, neighbors);
        let message = this.renderTutorMessage({
            actionKind: request.actionKind,
            atom: targetAtom,
            answer: request.answer,
            prompt: request.prompt,
            neighbors,
            evidenceSpans,
        });
        let traceSource: TutorTrace['source'] = 'rule-engine';
        let traceConfidence = this.estimateTutorConfidence(request.actionKind, request.answer, targetAtom);
        let traceNotes = 'Evidence-first response generated by local rule engine.';
        let traceEvidenceSpanIds = evidenceSpans.map((span) => span.id);

        if (this.tutorAdapter) {
            try {
                const adapterResult = await this.tutorAdapter.execute({
                    userId,
                    actionKind: request.actionKind,
                    atom: targetAtom,
                    prompt: request.prompt,
                    answer: request.answer,
                    evidenceSpans,
                    relatedAtomIds: neighbors,
                });
                const adapterConfidence = clamp(Number(adapterResult.confidence ?? 0), 0, 1);
                const adapterEvidenceSpanIds = (adapterResult.evidenceSpanIds || [])
                    .filter((spanId) => traceEvidenceSpanIds.includes(spanId));
                const adapterMessage = normalizeWhitespace(String(adapterResult.message || ''));
                const hasEvidenceBinding = adapterEvidenceSpanIds.length > 0;
                traceSource = 'llm-adapter';
                traceConfidence = Number(adapterConfidence.toFixed(4));
                if (adapterMessage && adapterConfidence >= 0.65 && hasEvidenceBinding) {
                    message = adapterMessage;
                    traceNotes = `Adapter response accepted from ${this.tutorAdapter.id} with evidence binding.`;
                    traceEvidenceSpanIds = adapterEvidenceSpanIds;
                } else {
                    const evidenceHint = evidenceSpans[0]?.snippet || targetAtom.content.slice(0, 220);
                    message = [
                        'Low-confidence tutor output detected. Treat this as unverified guidance.',
                        `Evidence-first fallback: ${evidenceHint}`,
                        'Please verify the answer against cited source fragments before accepting it.',
                    ].join('\n');
                    traceNotes = `Adapter response downgraded (confidence=${adapterConfidence.toFixed(4)}, evidenceBindings=${adapterEvidenceSpanIds.length}).`;
                }
            } catch (error) {
                traceSource = 'llm-adapter';
                traceConfidence = 0.2;
                traceNotes = `Adapter execution failed and fallback was used: ${String((error as Error)?.message || error)}`;
            }
        }
        const trace: TutorTrace = {
            traceId: this.nextId('trace'),
            userId,
            actionKind: request.actionKind,
            atomId: targetAtom.id,
            createdAt: nowIso,
            confidence: traceConfidence,
            evidenceSpanIds: traceEvidenceSpanIds,
            relationPathAtomIds: neighbors,
            source: traceSource,
            notes: traceNotes,
        };
        this.tutorTraces.push(trace);

        const response: TutorActionResponse = {
            message,
            suggestedActions,
            evidenceSpans,
            trace,
        };
        await this.persistIfNeeded();
        return response;
    }

    public async applyMemoryPolicy(request: MemoryPolicyRequest): Promise<MemoryPolicyResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('MemoryPolicyAPI requires a non-empty userId.');
        }
        const layer = request.layer;
        const operation = request.operation;
        const nowIso = this.resolveTimestamp(request.now);
        const bank = this.ensureUserMemoryBank(userId);
        const entries = bank[layer];
        let evictedCount = 0;

        if (operation === 'write') {
            const incomingEntries = Array.isArray(request.entries) ? request.entries : [];
            for (const incomingEntry of incomingEntries) {
                if (!isNonEmptyString(incomingEntry.key) || !isNonEmptyString(incomingEntry.value)) {
                    continue;
                }
                const index = entries.findIndex((entry) => entry.key === incomingEntry.key);
                if (index >= 0) {
                    const current = entries[index];
                    entries[index] = {
                        ...current,
                        value: incomingEntry.value,
                        tags: Array.from(new Set(incomingEntry.tags || current.tags || [])),
                        confidence: clamp(Number(incomingEntry.confidence ?? current.confidence ?? 0.5), 0, 1),
                        references: Array.from(new Set(incomingEntry.references || current.references || [])),
                        updatedAt: nowIso,
                        expiresAt: incomingEntry.expiresAt || current.expiresAt,
                    };
                } else {
                    entries.push({
                        key: incomingEntry.key,
                        value: incomingEntry.value,
                        tags: Array.from(new Set(incomingEntry.tags || [])),
                        confidence: clamp(Number(incomingEntry.confidence ?? 0.5), 0, 1),
                        references: Array.from(new Set(incomingEntry.references || [])),
                        createdAt: incomingEntry.createdAt || nowIso,
                        updatedAt: nowIso,
                        expiresAt: incomingEntry.expiresAt,
                    });
                }
            }
            evictedCount = this.evictMemoryLayer(bank, layer, nowIso);
            const response: MemoryPolicyResponse = {
                layer,
                operation,
                entries: [...bank[layer]],
                evictedCount,
                stats: this.collectMemoryStats(),
            };
            await this.persistIfNeeded();
            return response;
        }

        if (operation === 'evict') {
            evictedCount = this.evictMemoryLayer(bank, layer, nowIso);
            const response: MemoryPolicyResponse = {
                layer,
                operation,
                entries: [...bank[layer]],
                evictedCount,
                stats: this.collectMemoryStats(),
            };
            await this.persistIfNeeded();
            return response;
        }

        if (operation === 'read') {
            const limit = clamp(Math.floor(Number(request.limit) || 20), 1, 100);
            const queryTokens = tokenize(String(request.query || ''));
            const selectedEntries = bank[layer]
                .filter((entry) => {
                    if (!queryTokens.length) {
                        return true;
                    }
                    const haystack = `${entry.key} ${entry.value} ${entry.tags.join(' ')}`.toLowerCase();
                    return queryTokens.every((token) => haystack.includes(token));
                })
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .slice(0, limit);
            return {
                layer,
                operation,
                entries: selectedEntries,
                evictedCount: 0,
                stats: this.collectMemoryStats(),
            };
        }

        return {
            layer,
            operation: 'snapshot',
            entries: [...bank[layer]],
            evictedCount: 0,
            stats: this.collectMemoryStats(),
        };
    }

    public async evaluateLearningQuality(
        request: LearningQualityEvaluationRequest
    ): Promise<LearningQualityEvaluationResponse> {
        await this.ensureHydrated();
        const evaluatedAt = this.resolveTimestamp(request.evaluatedAt);
        const runtimeP95 = this.buildRetrievalTelemetry().queryP95Ms;
        const baseline = this.normalizeLearningQualitySnapshot(request.baseline, runtimeP95);
        const current = this.normalizeLearningQualitySnapshot(request.current, runtimeP95);
        const currentQueryP95Ms = Number(current.queryP95Ms ?? runtimeP95);
        const thresholds = this.resolveLearningQualityThresholds(request.thresholds);

        const retestPassRateUpliftPct = Number((current.retestPassRatePct - baseline.retestPassRatePct).toFixed(4));
        const misconceptionRecurrenceReductionPct = Number(
            (baseline.misconceptionRecurrenceRatePct - current.misconceptionRecurrenceRatePct).toFixed(4)
        );
        const pathEffectivenessLiftPct = Number(
            (current.averagePathMasteryGainPct - current.randomPathMasteryGainPct).toFixed(4)
        );

        const gates: LearningQualityGateResult[] = [
            {
                gateId: 'retest_pass_rate_uplift',
                passed: retestPassRateUpliftPct >= thresholds.retestPassRateUpliftPct,
                comparator: '>=',
                observedValue: retestPassRateUpliftPct,
                threshold: thresholds.retestPassRateUpliftPct,
                unit: 'pct',
                message: 'Retest pass-rate uplift should satisfy the v1.5 threshold.',
            },
            {
                gateId: 'misconception_reduction',
                passed: misconceptionRecurrenceReductionPct >= thresholds.misconceptionRecurrenceReductionPct,
                comparator: '>=',
                observedValue: misconceptionRecurrenceReductionPct,
                threshold: thresholds.misconceptionRecurrenceReductionPct,
                unit: 'pct',
                message: 'Misconception recurrence should decline after intervention.',
            },
            {
                gateId: 'evidence_ratio',
                passed: current.evidenceBackedSuggestionRatioPct >= thresholds.evidenceBackedSuggestionRatioPct,
                comparator: '>=',
                observedValue: current.evidenceBackedSuggestionRatioPct,
                threshold: thresholds.evidenceBackedSuggestionRatioPct,
                unit: 'pct',
                message: 'Evidence-backed recommendation ratio should remain high.',
            },
            {
                gateId: 'path_effectiveness',
                passed: pathEffectivenessLiftPct >= thresholds.pathEffectivenessLiftPct,
                comparator: '>=',
                observedValue: pathEffectivenessLiftPct,
                threshold: thresholds.pathEffectivenessLiftPct,
                unit: 'pct',
                message: 'Mastery-oriented paths should outperform random paths.',
            },
            {
                gateId: 'query_p95',
                passed: currentQueryP95Ms <= thresholds.queryP95Ms,
                comparator: '<=',
                observedValue: currentQueryP95Ms,
                threshold: thresholds.queryP95Ms,
                unit: 'ms',
                message: 'Knowledge query p95 latency should stay within interactive budget.',
            },
        ];

        return {
            evaluatedAt,
            thresholds,
            baseline,
            current: {
                ...current,
                queryP95Ms: currentQueryP95Ms,
            },
            deltas: {
                retestPassRateUpliftPct,
                misconceptionRecurrenceReductionPct,
                pathEffectivenessLiftPct,
            },
            gates,
            overallPassed: gates.every((gate) => gate.passed),
        };
    }

    public async evaluateIngestGuardrails(
        request: IngestGuardrailEvaluationRequest
    ): Promise<IngestGuardrailEvaluationResponse> {
        await this.ensureHydrated();
        const evaluatedAt = this.resolveTimestamp(request.evaluatedAt);
        const thresholds = this.resolveIngestGuardrailThresholds(request.thresholds);
        const telemetry = this.buildIngestTelemetry();
        const latestSummary = this.latestIngestSummary ? { ...this.latestIngestSummary } : null;
        const changedDocuments = latestSummary?.changedDocuments ?? 0;
        const deletedDocuments = latestSummary?.deletedDocuments ?? 0;
        const activeAtoms = latestSummary?.activeAtoms ?? this.activeAtomIds.size;

        const gates: IngestGuardrailGateResult[] = [
            {
                gateId: 'changed_documents',
                passed: changedDocuments <= thresholds.maxChangedDocuments,
                comparator: '<=',
                observedValue: changedDocuments,
                threshold: thresholds.maxChangedDocuments,
                unit: 'count',
                message: 'Changed document volume should stay inside ingest risk budget.',
            },
            {
                gateId: 'deleted_documents',
                passed: deletedDocuments <= thresholds.maxDeletedDocuments,
                comparator: '<=',
                observedValue: deletedDocuments,
                threshold: thresholds.maxDeletedDocuments,
                unit: 'count',
                message: 'Deleted document volume should stay inside rollback-safe budget.',
            },
            {
                gateId: 'active_atoms',
                passed: activeAtoms <= thresholds.maxActiveAtoms,
                comparator: '<=',
                observedValue: activeAtoms,
                threshold: thresholds.maxActiveAtoms,
                unit: 'count',
                message: 'Active atom cardinality should remain within local capacity limits.',
            },
            {
                gateId: 'ingest_p95',
                passed: telemetry.ingestP95Ms <= thresholds.maxIngestP95Ms,
                comparator: '<=',
                observedValue: telemetry.ingestP95Ms,
                threshold: thresholds.maxIngestP95Ms,
                unit: 'ms',
                message: 'Ingest p95 latency should satisfy local interaction budget.',
            },
            {
                gateId: 'recompute_p95',
                passed: telemetry.recomputeP95Ms <= thresholds.maxRecomputeP95Ms,
                comparator: '<=',
                observedValue: telemetry.recomputeP95Ms,
                threshold: thresholds.maxRecomputeP95Ms,
                unit: 'ms',
                message: 'Relation recompute p95 latency should satisfy governance budget.',
            },
        ];

        return {
            evaluatedAt,
            thresholds,
            latestSummary,
            gates,
            overallPassed: gates.every((gate) => gate.passed),
        };
    }

    public async ensureReady(): Promise<void> {
        await this.ensureHydrated();
    }

    public async getStoreDiagnostics(): Promise<KnowledgeGraphStoreDiagnostics> {
        await this.ensureHydrated();
        if (!this.store) {
            return {
                storeType: 'none',
                exists: false,
                loaded: this.hydrated,
            };
        }
        return this.store.getDiagnostics();
    }

    public async reloadFromStore(): Promise<boolean> {
        if (!this.store) {
            this.hydrated = true;
            return false;
        }
        const snapshot = await this.store.loadSnapshot();
        if (!snapshot) {
            this.hydrated = true;
            return false;
        }
        this.restoreFromSnapshot(snapshot);
        this.hydrated = true;
        return true;
    }

    public getKnowledgeState(): KnowledgeSystemState {
        const ingestTelemetry = this.buildIngestTelemetry();
        const retrievalTelemetry = this.buildRetrievalTelemetry();
        const memoryStats = this.collectMemoryStats();
        return {
            documents: this.documents.size,
            activeAtoms: this.activeAtomIds.size,
            activeRelationEdges: this.collectActiveRelationEdges(this.resolveTimestamp(undefined)).length,
            temporalEdges: this.temporalEdges.size,
            masteryStates: this.learnerStates.size,
            tutorTraces: this.tutorTraces.length,
            ingestTelemetry,
            retrievalTelemetry,
            memoryEntries: memoryStats,
        };
    }

    private recordIngestLatency(latencyMs: number): void {
        const normalized = Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : 0;
        this.ingestLatencyHistoryMs.push(Number(normalized.toFixed(4)));
        if (this.ingestLatencyHistoryMs.length > INGEST_LATENCY_HISTORY_LIMIT) {
            this.ingestLatencyHistoryMs.splice(0, this.ingestLatencyHistoryMs.length - INGEST_LATENCY_HISTORY_LIMIT);
        }
    }

    private recordRecomputeLatency(latencyMs: number): void {
        const normalized = Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : 0;
        this.recomputeLatencyHistoryMs.push(Number(normalized.toFixed(4)));
        if (this.recomputeLatencyHistoryMs.length > INGEST_LATENCY_HISTORY_LIMIT) {
            this.recomputeLatencyHistoryMs.splice(0, this.recomputeLatencyHistoryMs.length - INGEST_LATENCY_HISTORY_LIMIT);
        }
    }

    private buildIngestTelemetry(): KnowledgeSystemState['ingestTelemetry'] {
        const ingestCount = this.ingestLatencyHistoryMs.length;
        const ingestP95Ms = ingestCount > 0 ? computePercentile(this.ingestLatencyHistoryMs, 95) : 0;
        const ingestAverageMs = ingestCount > 0
            ? Number((this.ingestLatencyHistoryMs.reduce((sum, value) => sum + value, 0) / ingestCount).toFixed(4))
            : 0;
        const ingestMaxMs = ingestCount > 0 ? Number(Math.max(...this.ingestLatencyHistoryMs).toFixed(4)) : 0;

        const recomputeCount = this.recomputeLatencyHistoryMs.length;
        const recomputeP95Ms = recomputeCount > 0 ? computePercentile(this.recomputeLatencyHistoryMs, 95) : 0;
        const recomputeAverageMs = recomputeCount > 0
            ? Number((this.recomputeLatencyHistoryMs.reduce((sum, value) => sum + value, 0) / recomputeCount).toFixed(4))
            : 0;
        const recomputeMaxMs = recomputeCount > 0 ? Number(Math.max(...this.recomputeLatencyHistoryMs).toFixed(4)) : 0;

        return {
            ingestCount,
            ingestP95Ms,
            ingestAverageMs,
            ingestMaxMs,
            recomputeCount,
            recomputeP95Ms,
            recomputeAverageMs,
            recomputeMaxMs,
        };
    }

    private recordQueryLatency(latencyMs: number): void {
        const normalized = Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : 0;
        this.queryLatencyHistoryMs.push(Number(normalized.toFixed(4)));
        if (this.queryLatencyHistoryMs.length > QUERY_LATENCY_HISTORY_LIMIT) {
            this.queryLatencyHistoryMs.splice(0, this.queryLatencyHistoryMs.length - QUERY_LATENCY_HISTORY_LIMIT);
        }
    }

    private buildRetrievalTelemetry(): KnowledgeSystemState['retrievalTelemetry'] {
        const queryCount = this.queryLatencyHistoryMs.length;
        const queryP95Ms = queryCount > 0 ? computePercentile(this.queryLatencyHistoryMs, 95) : 0;
        const queryAverageMs = queryCount > 0
            ? Number((this.queryLatencyHistoryMs.reduce((sum, value) => sum + value, 0) / queryCount).toFixed(4))
            : 0;
        const queryMaxMs = queryCount > 0 ? Number(Math.max(...this.queryLatencyHistoryMs).toFixed(4)) : 0;
        return {
            queryCount,
            queryP95Ms,
            queryAverageMs,
            queryMaxMs,
        };
    }

    private normalizeLearningQualitySnapshot(
        snapshot: LearningQualitySnapshot,
        fallbackQueryP95Ms: number
    ): LearningQualitySnapshot {
        const clampPct = (value: number): number => Number(clamp(Number(value || 0), 0, 100).toFixed(4));
        const resolvedQueryP95Ms = Number(
            clamp(
                Number(snapshot.queryP95Ms ?? fallbackQueryP95Ms ?? 0),
                0,
                60000
            ).toFixed(4)
        );
        return {
            retestPassRatePct: clampPct(snapshot.retestPassRatePct),
            misconceptionRecurrenceRatePct: clampPct(snapshot.misconceptionRecurrenceRatePct),
            evidenceBackedSuggestionRatioPct: clampPct(snapshot.evidenceBackedSuggestionRatioPct),
            averagePathMasteryGainPct: clampPct(snapshot.averagePathMasteryGainPct),
            randomPathMasteryGainPct: clampPct(snapshot.randomPathMasteryGainPct),
            queryP95Ms: resolvedQueryP95Ms,
        };
    }

    private resolveLearningQualityThresholds(
        overrides: Partial<LearningQualityThresholds> | undefined
    ): LearningQualityThresholds {
        const merged: LearningQualityThresholds = {
            ...DEFAULT_LEARNING_QUALITY_THRESHOLDS,
            ...(overrides || {}),
        };
        return {
            retestPassRateUpliftPct: Number(clamp(merged.retestPassRateUpliftPct, 0, 100).toFixed(4)),
            misconceptionRecurrenceReductionPct: Number(clamp(merged.misconceptionRecurrenceReductionPct, 0, 100).toFixed(4)),
            evidenceBackedSuggestionRatioPct: Number(clamp(merged.evidenceBackedSuggestionRatioPct, 0, 100).toFixed(4)),
            pathEffectivenessLiftPct: Number(clamp(merged.pathEffectivenessLiftPct, 0, 100).toFixed(4)),
            queryP95Ms: Number(clamp(merged.queryP95Ms, 10, 60000).toFixed(4)),
        };
    }

    private resolveIngestGuardrailThresholds(
        overrides: Partial<IngestGuardrailThresholds> | undefined
    ): IngestGuardrailThresholds {
        const merged: IngestGuardrailThresholds = {
            ...DEFAULT_INGEST_GUARDRAIL_THRESHOLDS,
            ...(overrides || {}),
        };
        return {
            maxChangedDocuments: Math.floor(clamp(Number(merged.maxChangedDocuments || 0), 0, 1000000)),
            maxDeletedDocuments: Math.floor(clamp(Number(merged.maxDeletedDocuments || 0), 0, 1000000)),
            maxActiveAtoms: Math.floor(clamp(Number(merged.maxActiveAtoms || 0), 1, 5000000)),
            maxIngestP95Ms: Number(clamp(Number(merged.maxIngestP95Ms || 0), 1, 120000).toFixed(4)),
            maxRecomputeP95Ms: Number(clamp(Number(merged.maxRecomputeP95Ms || 0), 1, 120000).toFixed(4)),
        };
    }

    private resolveRelationRecomputeMode(params: {
        request: KnowledgeIngestRequest;
        changedDocuments: number;
        deletedDocuments: number;
        hasNewAtoms: boolean;
    }): Exclude<RelationRecomputeMode, 'auto'> {
        const requestedMode = params.request.relationRecomputeMode || 'auto';
        if (requestedMode !== 'auto') {
            return requestedMode;
        }
        if (params.request.recomputeRelations === true) {
            return 'full';
        }
        if (params.request.recomputeRelations === false) {
            return params.hasNewAtoms ? 'incremental' : 'none';
        }
        if (params.changedDocuments > 0 || params.deletedDocuments > 0) {
            return 'full';
        }
        return params.hasNewAtoms ? 'incremental' : 'none';
    }

    private async ensureHydrated(): Promise<void> {
        if (this.hydrated) {
            return;
        }
        if (!this.store) {
            this.hydrated = true;
            return;
        }
        if (!this.hydrationPromise) {
            this.hydrationPromise = (async () => {
                const snapshot = await this.store?.loadSnapshot();
                if (snapshot) {
                    this.restoreFromSnapshot(snapshot);
                }
                this.hydrated = true;
            })().finally(() => {
                this.hydrationPromise = null;
            });
        }
        await this.hydrationPromise;
    }

    private async persistIfNeeded(): Promise<void> {
        if (!this.store || !this.autoPersist) {
            return;
        }
        const snapshot = this.buildSnapshot();
        await this.store.saveSnapshot(snapshot);
    }

    private buildSnapshot(): KnowledgeGraphSnapshot {
        const savedAt = this.resolveTimestamp(undefined);
        const userMemory: Record<string, {
            session: MemoryEntry[];
            unit: MemoryEntry[];
            long_term: MemoryEntry[];
        }> = {};
        this.userMemory.forEach((bank, userId) => {
            userMemory[userId] = {
                session: [...bank.session],
                unit: [...bank.unit],
                long_term: [...bank.long_term],
            };
        });

        const documents: SerializedDocumentSnapshot[] = Array.from(this.documents.values()).map((snapshot) => ({
            documentId: snapshot.documentId,
            sourcePath: snapshot.sourcePath,
            sourceHash: snapshot.sourceHash,
            version: snapshot.version,
            updatedAt: snapshot.updatedAt,
            atomStableKeyToId: Array.from(snapshot.atomStableKeyToId.entries()),
            atomIds: [...snapshot.atomIds],
            evidenceSpanIds: [...snapshot.evidenceSpanIds],
            relationEdgeIds: [...snapshot.relationEdgeIds],
            temporalEdgeIds: [...snapshot.temporalEdgeIds],
        }));

        return {
            schemaVersion: 1,
            savedAt,
            idCounter: this.idCounter,
            atoms: Array.from(this.atoms.values()),
            evidenceSpans: Array.from(this.evidenceSpans.values()),
            relationEdges: Array.from(this.relationEdges.values()),
            temporalEdges: Array.from(this.temporalEdges.values()),
            documents,
            activeStableKeyToAtomId: Array.from(this.activeStableKeyToAtomId.entries()),
            activeAtomIds: Array.from(this.activeAtomIds.values()),
            learnerStates: Array.from(this.learnerStates.values()),
            tutorTraces: [...this.tutorTraces],
            ingestLatencyHistoryMs: [...this.ingestLatencyHistoryMs],
            recomputeLatencyHistoryMs: [...this.recomputeLatencyHistoryMs],
            queryLatencyHistoryMs: [...this.queryLatencyHistoryMs],
            latestIngestSummary: this.latestIngestSummary ? { ...this.latestIngestSummary } : null,
            userMemory,
            relationEdgeSignatures: Array.from(this.relationEdgeSignatures.values()),
        };
    }

    private restoreFromSnapshot(snapshot: KnowledgeGraphSnapshot): void {
        this.idCounter = Number(snapshot.idCounter || 0);
        this.latestIngestSummary = snapshot.latestIngestSummary
            ? {
                ...snapshot.latestIngestSummary,
                ingestedDocuments: Math.floor(clamp(Number(snapshot.latestIngestSummary.ingestedDocuments || 0), 0, 1000000)),
                changedDocuments: Math.floor(clamp(Number(snapshot.latestIngestSummary.changedDocuments || 0), 0, 1000000)),
                deletedDocuments: Math.floor(clamp(Number(snapshot.latestIngestSummary.deletedDocuments || 0), 0, 1000000)),
                activeAtoms: Math.floor(clamp(Number(snapshot.latestIngestSummary.activeAtoms || 0), 0, 5000000)),
                activeRelationEdges: Math.floor(clamp(Number(snapshot.latestIngestSummary.activeRelationEdges || 0), 0, 5000000)),
                recomputedDynamicRelations: snapshot.latestIngestSummary.recomputedDynamicRelations === true,
                invalidatedRelationEdges: Math.floor(
                    clamp(Number(snapshot.latestIngestSummary.invalidatedRelationEdges || 0), 0, 5000000)
                ),
                regeneratedRelationEdges: Math.floor(
                    clamp(Number(snapshot.latestIngestSummary.regeneratedRelationEdges || 0), 0, 5000000)
                ),
                resolvedRelationRecomputeMode: ((): Exclude<RelationRecomputeMode, 'auto'> => {
                    const candidate = snapshot.latestIngestSummary?.resolvedRelationRecomputeMode;
                    if (candidate === 'full' || candidate === 'incremental' || candidate === 'none') {
                        return candidate;
                    }
                    return 'none';
                })(),
                relationRecomputeLatencyMs: Number(
                    clamp(Number(snapshot.latestIngestSummary.relationRecomputeLatencyMs || 0), 0, 120000).toFixed(4)
                ),
            }
            : null;

        this.atoms.clear();
        (snapshot.atoms || []).forEach((atom) => {
            this.atoms.set(atom.id, atom);
        });

        this.evidenceSpans.clear();
        (snapshot.evidenceSpans || []).forEach((evidenceSpan) => {
            this.evidenceSpans.set(evidenceSpan.id, evidenceSpan);
        });

        this.relationEdges.clear();
        (snapshot.relationEdges || []).forEach((relationEdge) => {
            this.relationEdges.set(relationEdge.id, relationEdge);
        });

        this.temporalEdges.clear();
        (snapshot.temporalEdges || []).forEach((temporalEdge) => {
            this.temporalEdges.set(temporalEdge.id, temporalEdge);
        });

        this.documents.clear();
        (snapshot.documents || []).forEach((documentSnapshot) => {
            this.documents.set(documentSnapshot.documentId, {
                documentId: documentSnapshot.documentId,
                sourcePath: documentSnapshot.sourcePath,
                sourceHash: documentSnapshot.sourceHash,
                version: documentSnapshot.version,
                updatedAt: documentSnapshot.updatedAt,
                atomStableKeyToId: new Map(documentSnapshot.atomStableKeyToId || []),
                atomIds: [...(documentSnapshot.atomIds || [])],
                evidenceSpanIds: [...(documentSnapshot.evidenceSpanIds || [])],
                relationEdgeIds: [...(documentSnapshot.relationEdgeIds || [])],
                temporalEdgeIds: [...(documentSnapshot.temporalEdgeIds || [])],
            });
        });

        this.activeStableKeyToAtomId.clear();
        (snapshot.activeStableKeyToAtomId || []).forEach(([stableKey, atomId]) => {
            this.activeStableKeyToAtomId.set(stableKey, atomId);
        });

        this.activeAtomIds.clear();
        (snapshot.activeAtomIds || []).forEach((atomId) => {
            this.activeAtomIds.add(atomId);
        });

        this.learnerStates.clear();
        (snapshot.learnerStates || []).forEach((learnerState) => {
            const key = this.makeLearnerStateKey(learnerState.userId, learnerState.atomId);
            this.learnerStates.set(key, learnerState);
        });

        this.tutorTraces.length = 0;
        (snapshot.tutorTraces || []).forEach((trace) => {
            this.tutorTraces.push(trace);
        });

        this.ingestLatencyHistoryMs.length = 0;
        (snapshot.ingestLatencyHistoryMs || []).forEach((latency) => {
            const normalized = Number(latency);
            if (Number.isFinite(normalized) && normalized >= 0) {
                this.ingestLatencyHistoryMs.push(Number(normalized.toFixed(4)));
            }
        });
        if (this.ingestLatencyHistoryMs.length > INGEST_LATENCY_HISTORY_LIMIT) {
            this.ingestLatencyHistoryMs.splice(0, this.ingestLatencyHistoryMs.length - INGEST_LATENCY_HISTORY_LIMIT);
        }

        this.recomputeLatencyHistoryMs.length = 0;
        (snapshot.recomputeLatencyHistoryMs || []).forEach((latency) => {
            const normalized = Number(latency);
            if (Number.isFinite(normalized) && normalized >= 0) {
                this.recomputeLatencyHistoryMs.push(Number(normalized.toFixed(4)));
            }
        });
        if (this.recomputeLatencyHistoryMs.length > INGEST_LATENCY_HISTORY_LIMIT) {
            this.recomputeLatencyHistoryMs.splice(0, this.recomputeLatencyHistoryMs.length - INGEST_LATENCY_HISTORY_LIMIT);
        }

        this.queryLatencyHistoryMs.length = 0;
        (snapshot.queryLatencyHistoryMs || []).forEach((latency) => {
            const normalized = Number(latency);
            if (Number.isFinite(normalized) && normalized >= 0) {
                this.queryLatencyHistoryMs.push(Number(normalized.toFixed(4)));
            }
        });
        if (this.queryLatencyHistoryMs.length > QUERY_LATENCY_HISTORY_LIMIT) {
            this.queryLatencyHistoryMs.splice(0, this.queryLatencyHistoryMs.length - QUERY_LATENCY_HISTORY_LIMIT);
        }

        this.userMemory.clear();
        const memoryObject = snapshot.userMemory || {};
        Object.keys(memoryObject).forEach((userId) => {
            const bank = memoryObject[userId];
            this.userMemory.set(userId, {
                session: [...(bank?.session || [])],
                unit: [...(bank?.unit || [])],
                long_term: [...(bank?.long_term || [])],
            });
        });

        this.relationEdgeSignatures.clear();
        (snapshot.relationEdgeSignatures || []).forEach((signature) => {
            this.relationEdgeSignatures.add(signature);
        });

        if (this.relationEdgeSignatures.size === 0) {
            this.relationEdges.forEach((edge) => {
                const signature = this.buildRelationSignature({
                    sourceAtomId: edge.sourceAtomId,
                    targetAtomId: edge.targetAtomId,
                    relationKind: edge.relationKind,
                    provenance: edge.provenance,
                });
                this.relationEdgeSignatures.add(signature);
            });
        }
        this.rebuildTitleIndex();
    }

    private normalizeDocumentInput(input: KnowledgeDocumentInput): Required<KnowledgeDocumentInput> {
        const sourcePath = isNonEmptyString(input.sourcePath) ? input.sourcePath : `untitled_${this.nextId('doc')}.md`;
        const documentId = isNonEmptyString(input.documentId)
            ? input.documentId
            : normalizeIdentifier(sourcePath);
        const language = isNonEmptyString(input.language) ? input.language.trim() : 'unknown';
        return {
            documentId,
            sourcePath: sourcePath.replace(/\\/g, '/'),
            content: String(input.content || ''),
            language,
            updatedAt: this.resolveTimestamp(input.updatedAt),
        };
    }

    private parseDocument(documentInput: Required<KnowledgeDocumentInput>): ParsedDocument {
        const content = documentInput.content || '';
        const rawLines = content.length > 0 ? content.split('\n') : [''];
        const lineStartOffsets: number[] = [];
        let runningOffset = 0;
        for (const rawLine of rawLines) {
            lineStartOffsets.push(runningOffset);
            runningOffset += rawLine.length + 1;
        }

        const atoms: ParsedAtomDraft[] = [];
        const wikiLinksByStableKey = new Map<string, string[]>();
        const sectionStack: string[] = [];
        const headingAnchors: Array<{ lineIndex: number; sectionPath: string[]; title: string }> = [];
        let currentStartLineIndex = 0;
        let currentTitle = `${path.basename(documentInput.sourcePath)} preamble`;
        let currentSectionPath: string[] = [];

        const resolveContextForLine = (lineIndex: number): { sectionPath: string[]; title: string } => {
            for (let index = headingAnchors.length - 1; index >= 0; index -= 1) {
                if (headingAnchors[index].lineIndex <= lineIndex) {
                    return {
                        sectionPath: [...headingAnchors[index].sectionPath],
                        title: headingAnchors[index].title,
                    };
                }
            }
            return {
                sectionPath: ['preamble'],
                title: `${path.basename(documentInput.sourcePath)} preamble`,
            };
        };

        const pushAtomDraft = (params: {
            title: string;
            sectionPath: string[];
            representationType: KnowledgeRepresentationType;
            startLine: number;
            endLine: number;
            startOffset: number;
            endOffset: number;
            rawContent: string;
        }): void => {
            const normalizedContent = normalizeWhitespace(params.rawContent);
            if (!normalizedContent || !/[A-Za-z0-9\u4e00-\u9fff]/.test(normalizedContent)) {
                return;
            }

            const canonicalSectionPath = params.sectionPath.length > 0 ? [...params.sectionPath] : ['preamble'];
            const stableKey = params.representationType === 'text'
                ? `${documentInput.documentId}::${canonicalSectionPath.join('>').toLowerCase()}`
                : `${documentInput.documentId}::${canonicalSectionPath.join('>').toLowerCase()}::${params.representationType}_${params.startLine}`;
            const keywords = tokenize(`${params.title} ${normalizedContent}`).slice(0, 48);
            const atomDraft: ParsedAtomDraft = {
                stableKey,
                title: params.title,
                content: normalizedContent,
                representationType: params.representationType,
                sectionPath: canonicalSectionPath,
                startLine: params.startLine,
                endLine: params.endLine,
                startOffset: params.startOffset,
                endOffset: params.endOffset,
                keywords,
            };
            atoms.push(atomDraft);

            const wikiLinks = Array.from(normalizedContent.matchAll(/\[\[([^\]]+)\]\]/g))
                .map((match) => normalizeIdentifier(String(match[1] || '')))
                .filter((target) => target.length > 0);
            if (wikiLinks.length > 0) {
                wikiLinksByStableKey.set(stableKey, wikiLinks);
            }
        };

        const flushSegment = (endLineExclusive: number): void => {
            if (endLineExclusive <= currentStartLineIndex) {
                return;
            }
            const startOffset = lineStartOffsets[currentStartLineIndex] || 0;
            const endOffset = endLineExclusive >= rawLines.length
                ? content.length
                : (lineStartOffsets[endLineExclusive] || content.length);
            pushAtomDraft({
                title: currentTitle,
                sectionPath: currentSectionPath.length > 0 ? [...currentSectionPath] : ['preamble'],
                representationType: 'text',
                startLine: currentStartLineIndex + 1,
                endLine: endLineExclusive,
                startOffset,
                endOffset,
                rawContent: content.slice(startOffset, endOffset),
            });
        };

        for (let index = 0; index < rawLines.length; index += 1) {
            const rawLine = rawLines[index];
            const normalizedLine = rawLine.replace(/\r$/, '');
            const headingMatch = normalizedLine.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
            if (!headingMatch) {
                continue;
            }

            flushSegment(index);
            const level = headingMatch[1].length;
            const headingTitle = normalizeWhitespace(headingMatch[2]);
            while (sectionStack.length >= level) {
                sectionStack.pop();
            }
            sectionStack.push(headingTitle);
            currentSectionPath = [...sectionStack];
            currentTitle = headingTitle;
            currentStartLineIndex = index;
            headingAnchors.push({
                lineIndex: index,
                sectionPath: [...currentSectionPath],
                title: headingTitle,
            });
        }

        flushSegment(rawLines.length);

        let lineIndex = 0;
        while (lineIndex < rawLines.length) {
            const normalizedLine = rawLines[lineIndex].replace(/\r$/, '');
            const codeFenceMatch = normalizedLine.match(/^\s*```([A-Za-z0-9_-]+)?\s*$/);
            if (codeFenceMatch) {
                const languageHint = String(codeFenceMatch[1] || '').trim().toLowerCase();
                const representationType: KnowledgeRepresentationType = languageHint === 'mermaid' ? 'mermaid' : 'code';
                let blockEndLineIndex = lineIndex + 1;
                while (blockEndLineIndex < rawLines.length) {
                    const candidate = rawLines[blockEndLineIndex].replace(/\r$/, '');
                    if (/^\s*```\s*$/.test(candidate)) {
                        blockEndLineIndex += 1;
                        break;
                    }
                    blockEndLineIndex += 1;
                }
                const endLineExclusive = Math.min(blockEndLineIndex, rawLines.length);
                const startOffset = lineStartOffsets[lineIndex] || 0;
                const endOffset = endLineExclusive >= rawLines.length
                    ? content.length
                    : (lineStartOffsets[endLineExclusive] || content.length);
                const context = resolveContextForLine(lineIndex);
                const titleSuffix = representationType === 'mermaid' ? 'mermaid block' : 'code block';
                pushAtomDraft({
                    title: `${context.title} (${titleSuffix})`,
                    sectionPath: [...context.sectionPath, representationType],
                    representationType,
                    startLine: lineIndex + 1,
                    endLine: endLineExclusive,
                    startOffset,
                    endOffset,
                    rawContent: content.slice(startOffset, endOffset),
                });
                lineIndex = endLineExclusive;
                continue;
            }

            if (/^\s*\$\$\s*$/.test(normalizedLine)) {
                let formulaEndLineIndex = lineIndex + 1;
                while (formulaEndLineIndex < rawLines.length) {
                    const candidate = rawLines[formulaEndLineIndex].replace(/\r$/, '');
                    if (/^\s*\$\$\s*$/.test(candidate)) {
                        formulaEndLineIndex += 1;
                        break;
                    }
                    formulaEndLineIndex += 1;
                }
                const endLineExclusive = Math.min(formulaEndLineIndex, rawLines.length);
                const startOffset = lineStartOffsets[lineIndex] || 0;
                const endOffset = endLineExclusive >= rawLines.length
                    ? content.length
                    : (lineStartOffsets[endLineExclusive] || content.length);
                const context = resolveContextForLine(lineIndex);
                pushAtomDraft({
                    title: `${context.title} (formula block)`,
                    sectionPath: [...context.sectionPath, 'formula'],
                    representationType: 'formula',
                    startLine: lineIndex + 1,
                    endLine: endLineExclusive,
                    startOffset,
                    endOffset,
                    rawContent: content.slice(startOffset, endOffset),
                });
                lineIndex = endLineExclusive;
                continue;
            }

            lineIndex += 1;
        }

        return {
            atoms,
            wikiLinksByStableKey,
        };
    }

    private resolveDeleteDocumentId(input: KnowledgeDocumentDeleteInput): string | null {
        if (isNonEmptyString(input.documentId)) {
            return input.documentId.trim();
        }
        if (isNonEmptyString(input.sourcePath)) {
            return normalizeIdentifier(input.sourcePath.replace(/\\/g, '/'));
        }
        return null;
    }

    private deleteDocumentSnapshot(
        deleteInput: KnowledgeDocumentDeleteInput,
        deletedAt: string,
        responseTemporals: TemporalEdge[]
    ): {
        deleted: boolean;
        documentId?: string;
        sourcePath?: string;
        previousHash?: string;
        previousVersion?: number;
        invalidatedRelationEdges: number;
    } {
        const documentId = this.resolveDeleteDocumentId(deleteInput);
        if (!documentId) {
            return { deleted: false, invalidatedRelationEdges: 0 };
        }
        const snapshot = this.documents.get(documentId);
        if (!snapshot) {
            return { deleted: false, documentId, invalidatedRelationEdges: 0 };
        }

        this.documents.delete(documentId);
        let invalidatedRelationEdges = 0;
        snapshot.atomStableKeyToId.forEach((atomId, stableKey) => {
            this.activeStableKeyToAtomId.delete(stableKey);
            this.activeAtomIds.delete(atomId);
            invalidatedRelationEdges += this.expireRelationsForAtom(atomId, deletedAt);
            const temporalEdge = this.createTemporalEdge({
                sourceAtomId: atomId,
                targetAtomId: atomId,
                edgeKind: 'validity_window',
                validFrom: deletedAt,
                validTo: deletedAt,
                sourceDocumentHash: snapshot.sourceHash,
                isActive: false,
            });
            this.temporalEdges.set(temporalEdge.id, temporalEdge);
            responseTemporals.push(temporalEdge);
        });

        return {
            deleted: true,
            documentId: snapshot.documentId,
            sourcePath: snapshot.sourcePath,
            previousHash: snapshot.sourceHash,
            previousVersion: snapshot.version,
            invalidatedRelationEdges,
        };
    }

    private collectWikiLinksByAtomId(atomIds: string[]): Map<string, string[]> {
        const wikiLinksByAtomId = new Map<string, string[]>();
        atomIds.forEach((atomId) => {
            const atom = this.atoms.get(atomId);
            if (!atom) {
                return;
            }
            const links = Array.from(atom.content.matchAll(/\[\[([^\]]+)\]\]/g))
                .map((match) => normalizeIdentifier(String(match[1] || '')))
                .filter((target) => target.length > 0);
            if (links.length > 0) {
                wikiLinksByAtomId.set(atomId, links);
            }
        });
        return wikiLinksByAtomId;
    }

    private recomputeDynamicRelations(nowIso: string): {
        invalidatedRelationEdges: number;
        createdEdges: RelationEdge[];
    } {
        let invalidatedRelationEdges = 0;
        this.relationEdges.forEach((edge) => {
            const isDynamicEdge = edge.provenance === 'inferred' || edge.relationKind === 'reference';
            if (!isDynamicEdge || edge.temporal.validTo) {
                return;
            }
            edge.temporal.validTo = nowIso;
            invalidatedRelationEdges += 1;
            this.relationEdgeSignatures.delete(this.buildRelationSignature({
                sourceAtomId: edge.sourceAtomId,
                targetAtomId: edge.targetAtomId,
                relationKind: edge.relationKind,
                provenance: edge.provenance,
            }));
        });

        const activeAtomIds = Array.from(this.activeAtomIds.values());
        const wikiLinksByAtomId = this.collectWikiLinksByAtomId(activeAtomIds);
        const referenceEdges = this.createReferenceEdges(activeAtomIds, wikiLinksByAtomId, nowIso);
        const inferredEdges = this.createInferredEdges(activeAtomIds, nowIso);
        return {
            invalidatedRelationEdges,
            createdEdges: [...referenceEdges, ...inferredEdges],
        };
    }

    private retireRemovedStableKeys(params: {
        previousSnapshot: DocumentSnapshot;
        parsedDocument: ParsedDocument;
        retiredAt: string;
        responseTemporals: TemporalEdge[];
    }): number {
        let invalidatedRelationEdges = 0;
        const nextStableKeys = new Set(params.parsedDocument.atoms.map((atom) => atom.stableKey));
        params.previousSnapshot.atomStableKeyToId.forEach((atomId, stableKey) => {
            if (nextStableKeys.has(stableKey)) {
                return;
            }
            this.activeAtomIds.delete(atomId);
            this.activeStableKeyToAtomId.delete(stableKey);
            const temporalEdge = this.createTemporalEdge({
                sourceAtomId: atomId,
                targetAtomId: atomId,
                edgeKind: 'validity_window',
                validFrom: params.retiredAt,
                validTo: params.retiredAt,
                sourceDocumentHash: params.previousSnapshot.sourceHash,
                isActive: false,
            });
            this.temporalEdges.set(temporalEdge.id, temporalEdge);
            params.responseTemporals.push(temporalEdge);
            invalidatedRelationEdges += this.expireRelationsForAtom(atomId, params.retiredAt);
        });
        return invalidatedRelationEdges;
    }

    private createReferenceEdges(
        newAtomIds: string[],
        wikiLinksByAtomId: Map<string, string[]>,
        nowIso: string
    ): RelationEdge[] {
        const created: RelationEdge[] = [];
        for (const sourceAtomId of newAtomIds) {
            const links = wikiLinksByAtomId.get(sourceAtomId) || [];
            for (const linkTitle of links) {
                const targets = this.titleToAtomIds.get(linkTitle);
                if (!targets || targets.size === 0) {
                    continue;
                }
                for (const targetAtomId of targets) {
                    if (targetAtomId === sourceAtomId) {
                        continue;
                    }
                    const sourceAtom = this.atoms.get(sourceAtomId);
                    if (!sourceAtom) {
                        continue;
                    }
                    const relation = this.createRelationEdge({
                        sourceAtomId,
                        targetAtomId,
                        relationKind: 'reference',
                        provenance: 'fact',
                        confidence: 0.85,
                        evidenceSpanIds: [...sourceAtom.evidenceSpanIds],
                        validFrom: nowIso,
                    });
                    if (relation) {
                        created.push(relation);
                    }
                }
            }
        }
        return created;
    }

    private createInferredEdges(newAtomIds: string[], nowIso: string): RelationEdge[] {
        const created: RelationEdge[] = [];
        const candidateTargetIds = Array.from(this.activeAtomIds);
        for (const sourceAtomId of newAtomIds) {
            const sourceAtom = this.atoms.get(sourceAtomId);
            if (!sourceAtom || sourceAtom.keywords.length === 0) {
                continue;
            }
            for (const targetAtomId of candidateTargetIds) {
                if (targetAtomId === sourceAtomId) {
                    continue;
                }
                const targetAtom = this.atoms.get(targetAtomId);
                if (!targetAtom || targetAtom.keywords.length === 0) {
                    continue;
                }
                const jaccard = computeJaccard(sourceAtom.keywords, targetAtom.keywords);
                if (jaccard < 0.32) {
                    continue;
                }
                const relationKind: RelationKind = jaccard >= 0.5 ? 'application' : 'analogy';
                const relation = this.createRelationEdge({
                    sourceAtomId,
                    targetAtomId,
                    relationKind,
                    provenance: 'inferred',
                    confidence: Number(clamp(jaccard, 0.32, 0.95).toFixed(4)),
                    evidenceSpanIds: [...sourceAtom.evidenceSpanIds, ...targetAtom.evidenceSpanIds].slice(0, 4),
                    validFrom: nowIso,
                });
                if (relation) {
                    created.push(relation);
                }
            }
        }
        return created;
    }

    private createRelationEdge(params: {
        sourceAtomId: string;
        targetAtomId: string;
        relationKind: RelationKind;
        provenance: 'fact' | 'inferred';
        confidence: number;
        evidenceSpanIds: string[];
        validFrom: string;
    }): RelationEdge | null {
        const signature = this.buildRelationSignature(params);
        if (this.relationEdgeSignatures.has(signature)) {
            return null;
        }
        this.relationEdgeSignatures.add(signature);
        const relationEdge: RelationEdge = {
            id: this.nextId('relation'),
            sourceAtomId: params.sourceAtomId,
            targetAtomId: params.targetAtomId,
            relationKind: params.relationKind,
            provenance: params.provenance,
            confidence: clamp(params.confidence, 0, 1),
            evidenceSpanIds: Array.from(new Set(params.evidenceSpanIds)),
            temporal: {
                validFrom: params.validFrom,
            },
        };
        this.relationEdges.set(relationEdge.id, relationEdge);
        return relationEdge;
    }

    private buildRelationSignature(params: {
        sourceAtomId: string;
        targetAtomId: string;
        relationKind: RelationKind;
        provenance: 'fact' | 'inferred';
    }): string {
        return `${params.sourceAtomId}::${params.targetAtomId}::${params.relationKind}::${params.provenance}`;
    }

    private createTemporalEdge(params: {
        sourceAtomId: string;
        targetAtomId: string;
        edgeKind: TemporalEdge['edgeKind'];
        validFrom: string;
        validTo?: string;
        sourceDocumentHash: string;
        isActive: boolean;
    }): TemporalEdge {
        return {
            id: this.nextId('temporal'),
            sourceAtomId: params.sourceAtomId,
            targetAtomId: params.targetAtomId,
            edgeKind: params.edgeKind,
            validFrom: params.validFrom,
            validTo: params.validTo,
            sourceDocumentHash: params.sourceDocumentHash,
            isActive: params.isActive,
        };
    }

    private expireRelationsForAtom(atomId: string, expiredAt: string): number {
        let invalidated = 0;
        this.relationEdges.forEach((relation) => {
            if (relation.sourceAtomId !== atomId && relation.targetAtomId !== atomId) {
                return;
            }
            if (!relation.temporal.validTo) {
                relation.temporal.validTo = expiredAt;
                invalidated += 1;
            }
        });
        return invalidated;
    }

    private rebuildTitleIndex(): void {
        this.titleToAtomIds.clear();
        this.activeAtomIds.forEach((atomId) => {
            const atom = this.atoms.get(atomId);
            if (!atom) {
                return;
            }
            const primaryKey = normalizeIdentifier(atom.title);
            if (primaryKey) {
                if (!this.titleToAtomIds.has(primaryKey)) {
                    this.titleToAtomIds.set(primaryKey, new Set<string>());
                }
                this.titleToAtomIds.get(primaryKey)?.add(atomId);
            }
        });
    }

    private collectActiveRelationEdges(asOfIso: string): RelationEdge[] {
        const asOfTime = Date.parse(asOfIso);
        const activeEdges: RelationEdge[] = [];
        this.relationEdges.forEach((edge) => {
            if (!this.activeAtomIds.has(edge.sourceAtomId) || !this.activeAtomIds.has(edge.targetAtomId)) {
                return;
            }
            const validFromTime = Date.parse(edge.temporal.validFrom);
            if (Number.isFinite(validFromTime) && validFromTime > asOfTime) {
                return;
            }
            if (edge.temporal.validTo) {
                const validToTime = Date.parse(edge.temporal.validTo);
                if (Number.isFinite(validToTime) && validToTime < asOfTime) {
                    return;
                }
            }
            activeEdges.push(edge);
        });
        return activeEdges;
    }

    private selectRelationPath(atomId: string, activeEdges: RelationEdge[], limit: number): RelationEdge[] {
        return activeEdges
            .filter((edge) => edge.sourceAtomId === atomId || edge.targetAtomId === atomId)
            .sort((left, right) => right.confidence - left.confidence)
            .slice(0, limit);
    }

    private evaluateTemporalValidity(atomId: string, asOfIso: string): KnowledgeQueryItem['temporalValidity'] {
        const reasons: string[] = [];
        if (!this.activeAtomIds.has(atomId)) {
            reasons.push('atom_not_active');
        } else {
            reasons.push('atom_active');
        }

        const asOfTime = Date.parse(asOfIso);
        this.temporalEdges.forEach((edge) => {
            if (edge.targetAtomId !== atomId) {
                return;
            }
            const validFromTime = Date.parse(edge.validFrom);
            if (Number.isFinite(validFromTime) && validFromTime > asOfTime) {
                reasons.push('temporal_edge_not_started');
            }
            if (edge.validTo) {
                const validToTime = Date.parse(edge.validTo);
                if (Number.isFinite(validToTime) && validToTime < asOfTime) {
                    reasons.push('temporal_edge_expired');
                }
            }
        });

        return {
            isValid: reasons.every((reason) => !reason.endsWith('expired') && reason !== 'atom_not_active'),
            checkedAt: asOfIso,
            reasons,
        };
    }

    private makeLearnerStateKey(userId: string, atomId: string): string {
        return `${userId}::${atomId}`;
    }

    private createDefaultLearnerState(userId: string, atomId: string, nowIso: string): LearnerConceptState {
        return {
            userId,
            atomId,
            masteryProbability: 0.5,
            reviewCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            partialCount: 0,
            skippedCount: 0,
            lastOutcome: null,
            lastUpdatedAt: nowIso,
            nextReviewAt: plusDays(nowIso, 3),
            errorTags: [],
        };
    }

    private applyMasteryObservation(
        state: LearnerConceptState,
        observation: MasteryObservation,
        observedAt: string
    ): LearnerConceptState {
        const nextState: LearnerConceptState = {
            ...state,
            reviewCount: state.reviewCount + 1,
            lastOutcome: observation.outcome,
            lastUpdatedAt: observedAt,
            errorTags: [...state.errorTags],
        };
        const confidence = clamp(Number(observation.confidence ?? 0.7), 0, 1);
        const previousMastery = state.masteryProbability;
        let mastery = previousMastery;

        if (observation.outcome === 'correct') {
            nextState.correctCount += 1;
            mastery += (1 - mastery) * (0.16 + confidence * 0.08);
        } else if (observation.outcome === 'partial') {
            nextState.partialCount += 1;
            mastery += (1 - mastery) * (0.06 + confidence * 0.04);
            if (observation.errorTag) {
                nextState.errorTags.push(observation.errorTag);
            }
        } else if (observation.outcome === 'incorrect') {
            nextState.incorrectCount += 1;
            mastery -= mastery * (0.22 + (1 - confidence) * 0.08);
            if (observation.errorTag) {
                nextState.errorTags.push(observation.errorTag);
            } else {
                nextState.errorTags.push('incorrect_answer');
            }
        } else {
            nextState.skippedCount += 1;
            mastery -= mastery * 0.12;
            nextState.errorTags.push('skipped');
        }

        nextState.masteryProbability = Number(clamp(mastery, 0.01, 0.99).toFixed(6));
        nextState.errorTags = Array.from(new Set(nextState.errorTags)).slice(0, 12);
        nextState.nextReviewAt = this.calculateNextReviewAt(observedAt, nextState.masteryProbability);
        return nextState;
    }

    private calculateNextReviewAt(baseIso: string, masteryProbability: number): string {
        if (masteryProbability < 0.35) {
            return plusDays(baseIso, 1);
        }
        if (masteryProbability < 0.6) {
            return plusDays(baseIso, 3);
        }
        if (masteryProbability < 0.8) {
            return plusDays(baseIso, 7);
        }
        return plusDays(baseIso, 14);
    }

    private buildMasteryPaths(
        userId: string,
        candidateAtomIds: string[],
        maxPaths: number,
        generatedAt: string
    ): Array<{
        id: string;
        targetAtomId: string;
        priority: number;
        expectedMasteryGain: number;
        actions: LearningAction[];
    }> {
        const scored = candidateAtomIds
            .map((atomId) => {
                const state = this.learnerStates.get(this.makeLearnerStateKey(userId, atomId))
                    || this.createDefaultLearnerState(userId, atomId, generatedAt);
                return { atomId, mastery: state.masteryProbability };
            })
            .sort((left, right) => left.mastery - right.mastery)
            .slice(0, maxPaths);

        return scored.map((item, index) => {
            const expectedGain = Number((0.75 - item.mastery).toFixed(4));
            const actions = this.buildMasteryActions(item.atomId, expectedGain, index + 1);
            return {
                id: this.nextId('mastery_path'),
                targetAtomId: item.atomId,
                priority: 100 - index * 5,
                expectedMasteryGain: expectedGain,
                actions,
            };
        });
    }

    private buildMasteryActions(atomId: string, expectedGain: number, rank: number): LearningAction[] {
        const atom = this.atoms.get(atomId);
        const evidenceSpanIds = atom?.evidenceSpanIds || [];
        return [
            this.createLearningAction({
                kind: 'review',
                atomId,
                priority: 100 - rank * 2,
                expectedGain: expectedGain * 0.5,
                rationale: 'Review source evidence first to rebuild grounded understanding.',
                evidenceSpanIds,
                relationPathAtomIds: [atomId],
                estimatedMinutes: 8,
            }),
            this.createLearningAction({
                kind: 'quiz',
                atomId,
                priority: 95 - rank * 2,
                expectedGain: expectedGain * 0.3,
                rationale: 'Run retrieval practice to validate stable recall.',
                evidenceSpanIds,
                relationPathAtomIds: [atomId],
                estimatedMinutes: 6,
            }),
            this.createLearningAction({
                kind: 'explain',
                atomId,
                priority: 90 - rank * 2,
                expectedGain: expectedGain * 0.2,
                rationale: 'Self-explanation consolidates concept boundaries and misconceptions.',
                evidenceSpanIds,
                relationPathAtomIds: [atomId],
                estimatedMinutes: 6,
            }),
        ];
    }

    private buildDivergencePaths(
        userId: string,
        candidateAtomIds: string[],
        maxPaths: number,
        generatedAt: string
    ): DivergencePath[] {
        const focusSet = new Set(candidateAtomIds);
        const activeEdges = this.collectActiveRelationEdges(generatedAt)
            .filter((edge) =>
                focusSet.has(edge.sourceAtomId)
                && (edge.relationKind === 'analogy' || edge.relationKind === 'application' || edge.relationKind === 'contrast' || edge.relationKind === 'causal')
            );
        const scored = activeEdges
            .map((edge) => {
                const targetState = this.learnerStates.get(this.makeLearnerStateKey(userId, edge.targetAtomId))
                    || this.createDefaultLearnerState(userId, edge.targetAtomId, generatedAt);
                const novelty = 1 - targetState.masteryProbability;
                const score = edge.confidence * 0.6 + novelty * 0.4;
                return { edge, score, novelty };
            })
            .sort((left, right) => right.score - left.score)
            .slice(0, maxPaths);

        return scored.map((item, index) => ({
            id: this.nextId('divergence_path'),
            sourceAtomId: item.edge.sourceAtomId,
            targetAtomId: item.edge.targetAtomId,
            priority: 80 - index * 3,
            expectedExplorationGain: Number(item.novelty.toFixed(4)),
            actions: [
                this.createLearningAction({
                    kind: 'transfer',
                    atomId: item.edge.targetAtomId,
                    priority: 78 - index * 3,
                    expectedGain: Number((item.novelty * 0.55).toFixed(4)),
                    rationale: 'Apply the concept in a new context to build transfer strength.',
                    evidenceSpanIds: item.edge.evidenceSpanIds,
                    relationPathAtomIds: [item.edge.sourceAtomId, item.edge.targetAtomId],
                    estimatedMinutes: 10,
                }),
                this.createLearningAction({
                    kind: 'counterexample',
                    atomId: item.edge.targetAtomId,
                    priority: 74 - index * 3,
                    expectedGain: Number((item.novelty * 0.45).toFixed(4)),
                    rationale: 'Generate counterexamples to sharpen concept boundaries.',
                    evidenceSpanIds: item.edge.evidenceSpanIds,
                    relationPathAtomIds: [item.edge.sourceAtomId, item.edge.targetAtomId],
                    estimatedMinutes: 8,
                }),
            ],
        }));
    }

    private createLearningAction(params: {
        kind: LearningActionKind;
        atomId: string;
        priority: number;
        expectedGain: number;
        rationale: string;
        evidenceSpanIds: string[];
        relationPathAtomIds: string[];
        estimatedMinutes: number;
    }): LearningAction {
        return {
            id: this.nextId('action'),
            kind: params.kind,
            atomId: params.atomId,
            priority: params.priority,
            expectedGain: Number(params.expectedGain.toFixed(4)),
            rationale: params.rationale,
            evidenceSpanIds: Array.from(new Set(params.evidenceSpanIds)),
            relationPathAtomIds: Array.from(new Set(params.relationPathAtomIds)),
            estimatedMinutes: params.estimatedMinutes,
        };
    }

    private collectNeighborAtomIds(atomId: string, limit: number): string[] {
        const edges = this.collectActiveRelationEdges(this.resolveTimestamp(undefined))
            .filter((edge) => edge.sourceAtomId === atomId || edge.targetAtomId === atomId)
            .sort((left, right) => right.confidence - left.confidence);
        const neighborIds: string[] = [];
        for (const edge of edges) {
            const neighbor = edge.sourceAtomId === atomId ? edge.targetAtomId : edge.sourceAtomId;
            if (!neighborIds.includes(neighbor)) {
                neighborIds.push(neighbor);
            }
            if (neighborIds.length >= limit) {
                break;
            }
        }
        return neighborIds;
    }

    private buildTutorSuggestedActions(atomId: string, evidenceSpans: EvidenceSpan[], neighbors: string[]): LearningAction[] {
        return [
            this.createLearningAction({
                kind: 'quiz',
                atomId,
                priority: 88,
                expectedGain: 0.24,
                rationale: 'Immediate retrieval practice to test current mastery.',
                evidenceSpanIds: evidenceSpans.map((span) => span.id),
                relationPathAtomIds: [atomId, ...neighbors],
                estimatedMinutes: 7,
            }),
            this.createLearningAction({
                kind: 'reflection',
                atomId,
                priority: 82,
                expectedGain: 0.17,
                rationale: 'Reflect on misunderstandings and bind corrections to evidence.',
                evidenceSpanIds: evidenceSpans.map((span) => span.id),
                relationPathAtomIds: [atomId],
                estimatedMinutes: 5,
            }),
        ];
    }

    private renderTutorMessage(params: {
        actionKind: TutorActionRequest['actionKind'];
        atom: KnowledgeAtom;
        prompt?: string;
        answer?: string;
        neighbors: string[];
        evidenceSpans: EvidenceSpan[];
    }): string {
        const firstEvidence = params.evidenceSpans[0]?.snippet || params.atom.content.slice(0, 220);
        if (params.actionKind === 'generate_quiz') {
            return [
                `Question: Explain the core idea of "${params.atom.title}" in your own words.`,
                'Constraint: include one evidence-backed statement from the source.',
                `Evidence hint: ${firstEvidence}`,
            ].join('\n');
        }
        if (params.actionKind === 'analyze_answer') {
            const answerTokens = tokenize(String(params.answer || ''));
            const keywordOverlap = answerTokens.filter((token) => params.atom.keywords.includes(token)).length;
            const quality = keywordOverlap >= 3 ? 'strong' : (keywordOverlap >= 1 ? 'partial' : 'weak');
            return [
                `Answer quality: ${quality}.`,
                `Matched keywords: ${keywordOverlap}/${params.atom.keywords.length}.`,
                `Repair focus: align your reasoning with this evidence: ${firstEvidence}`,
            ].join('\n');
        }
        if (params.actionKind === 'follow_up') {
            const neighborTitle = params.neighbors
                .map((atomId) => this.atoms.get(atomId)?.title)
                .find((title): title is string => Boolean(title))
                || 'a related concept';
            return [
                `Follow-up: compare "${params.atom.title}" with "${neighborTitle}".`,
                'Prompt: identify one shared mechanism and one critical difference.',
                `Evidence anchor: ${firstEvidence}`,
            ].join('\n');
        }
        return [
            `Recap for "${params.atom.title}":`,
            `- Key evidence: ${firstEvidence}`,
            '- Suggested next move: apply the concept to a transfer task and verify against source.',
        ].join('\n');
    }

    private estimateTutorConfidence(
        actionKind: TutorActionRequest['actionKind'],
        answer: string | undefined,
        atom: KnowledgeAtom
    ): number {
        if (actionKind === 'analyze_answer') {
            const overlap = tokenize(String(answer || '')).filter((token) => atom.keywords.includes(token)).length;
            return Number(clamp(0.42 + overlap * 0.08, 0.42, 0.92).toFixed(4));
        }
        if (actionKind === 'follow_up') {
            return 0.74;
        }
        if (actionKind === 'recap') {
            return 0.87;
        }
        return 0.81;
    }

    private ensureUserMemoryBank(userId: string): UserMemoryBank {
        if (!this.userMemory.has(userId)) {
            this.userMemory.set(userId, {
                session: [],
                unit: [],
                long_term: [],
            });
        }
        return this.userMemory.get(userId) as UserMemoryBank;
    }

    private evictMemoryLayer(bank: UserMemoryBank, layer: MemoryLayer, nowIso: string): number {
        const entries = bank[layer];
        const beforeCount = entries.length;
        const nowTime = Date.parse(nowIso);
        const surviving = entries.filter((entry) => {
            if (!entry.expiresAt) {
                return true;
            }
            const expiresAt = Date.parse(entry.expiresAt);
            if (!Number.isFinite(expiresAt)) {
                return true;
            }
            return expiresAt > nowTime;
        });

        surviving.sort((left, right) => {
            if (left.confidence !== right.confidence) {
                return left.confidence - right.confidence;
            }
            return left.updatedAt.localeCompare(right.updatedAt);
        });

        const capacity = MEMORY_LAYER_CAPACITY[layer];
        while (surviving.length > capacity) {
            surviving.shift();
        }

        bank[layer] = surviving;
        return beforeCount - surviving.length;
    }

    private collectMemoryStats(): MemoryStats {
        const stats: MemoryStats = {
            session: 0,
            unit: 0,
            longTerm: 0,
        };
        this.userMemory.forEach((bank) => {
            stats.session += bank.session.length;
            stats.unit += bank.unit.length;
            stats.longTerm += bank.long_term.length;
        });
        return stats;
    }

    private resolveTimestamp(preferred: string | undefined): string {
        if (isNonEmptyString(preferred)) {
            const parsed = new Date(preferred);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString();
            }
        }
        return this.nowProvider().toISOString();
    }

    private computeHash(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    private nextId(prefix: string): string {
        this.idCounter += 1;
        return `${prefix}_${this.idCounter.toString(36)}`;
    }
}

export function createKnowledgeLearningPlatform(options: KnowledgeLearningPlatformOptions = {}): KnowledgeLearningPlatform {
    return new KnowledgeLearningPlatform(options);
}

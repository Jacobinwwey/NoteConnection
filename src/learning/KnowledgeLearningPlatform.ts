import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { KnowledgeLearningPlatformAPI } from './api';
import type {
    AgentConversationAnswerClaimCitation,
    AgentConversationAssistantBlock,
    AgentConversationInvocationRecord,
    AgentConversationKnowledgePoint,
    AgentConversationMemoryAction,
    AgentConversationMemoryRecord,
    AgentConversationRequest,
    AgentConversationResponse,
    AgentConversationSessionRecord,
    AgentConversationTurnRecord,
    DivergencePath,
    ErrorTagStat,
    EvidenceSpan,
    IngestGuardrailEvaluationRequest,
    IngestGuardrailEvaluationResponse,
    IngestGuardrailGateResult,
    IngestGuardrailThresholds,
    KnowledgeAtom,
    KnowledgeDocumentDeleteInput,
    KnowledgeDocumentInput,
    KnowledgeDocumentMoveInput,
    KnowledgeIngestRequest,
    KnowledgeIngestOperation,
    KnowledgeIngestResponse,
    LearningQualityEvaluationRequest,
    LearningQualityEvaluationResponse,
    LearningQualityBaselineClearRequest,
    LearningQualityBaselineEvaluateRequest,
    LearningQualityBaselineEvaluateResponse,
    LearningQualityBaselineGetRequest,
    LearningQualityBaselineResponse,
    LearningQualityBaselineSetRequest,
    LearningQualityGateResult,
    LearningQualitySnapshot,
    LearningQualitySnapshotRequest,
    LearningQualitySnapshotResponse,
    LearningQualityThresholds,
    KnowledgeCitation,
    KnowledgeQueryItem,
    KnowledgeQueryResolvedScope,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    KnowledgeRepresentationType,
    KnowledgeRun,
    KnowledgeRunReviewCard,
    KnowledgeRunReviewState,
    KnowledgeSystemState,
    LearnerConceptState,
    LearningAction,
    LearningActionKind,
    LearningPathRequest,
    LearningPathResponse,
    MasteryDiagnosticsRequest,
    MasteryDiagnosticsResponse,
    MasteryErrorTag,
    MasteryOutcome,
    MasteryMisconceptionItem,
    MasteryMisconceptionRequest,
    MasteryMisconceptionResponse,
    MasteryObservation,
    MemoryEntry,
    MemoryLayer,
    MemoryPolicyRequest,
    MemoryPolicyResponse,
    RagContextBudget,
    RagContextPack,
    RagEvidenceRecoveryTrace,
    RagEvidenceRole,
    RagFailureClassification,
    RagSourceDecision,
    RagSufficiencyReview,
    RelationRecomputeMode,
    RelationEdge,
    RelationKind,
    StalenessRecord,
    StudySessionAction,
    StudySessionActionExecutionRequest,
    StudySessionActionExecutionResponse,
    StudySessionExecutionRecord,
    StudySessionHistoryRequest,
    StudySessionHistoryResponse,
    StudySessionMasteryDeltaItem,
    StudySessionPlanExecutionRequest,
    StudySessionPlanExecutionResponse,
    StudySessionRequest,
    StudySessionResponse,
    TemporalEdge,
    TutorActionRequest,
    TutorActionKind,
    TutorActionResponse,
    TutorTrace,
    WorkflowArtifactReviewFollowUpRequest,
    WorkflowArtifactReviewFollowUpResponse,
} from './types';
import type { WorkflowArtifactQueryRequest, WorkflowArtifactQueryResponse } from './api';
import type {
    KnowledgeGraphSnapshot,
    KnowledgeGraphStore,
    KnowledgeGraphStoreDiagnostics,
    SerializedDocumentSnapshot,
    IdentityTransitionRecord,
} from './store';
import type { TutorAdapter } from './tutorAdapter';
import {
    createGraphQueryBackend,
    normalizeGraphQueryBackendType,
} from './queryBackend';
import type {
    GraphQueryBackend,
    GraphQueryBackendFactoryOptions,
    GraphQueryBackendResult,
    GraphQueryBackendType,
} from './queryBackend';
import { isOpsAdapter } from './store';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import type { CanonicalResourceRecord, ResourceProjectionRecord } from '../resources/types';
import { normalizeResourceReference } from '../core/ResourceReference';
import { WorkspaceRegistry } from '../workspace/WorkspaceRegistry';
import type { WorkspaceBindingRecord, WorkspaceRecord } from '../workspace/types';
import { IndexLifecycle } from '../indexing/IndexLifecycle';
import type { IndexLifecycleSummary, IndexSegmentRecord, IndexUnitRecord } from '../indexing/types';
import { SessionStateStore } from '../session/SessionStateStore';
import type { LearningSessionStateRecord } from '../session/types';
import { WorkflowArtifactStore } from '../workflows/WorkflowArtifactStore';
import type { WorkflowArtifactRecord, WorkflowArtifactKind } from '../workflows/types';
import { buildMemoryAuditRecord, classifyMemoryEntry, computeGovernedMemoryWeight } from '../memory/MemoryGovernance';
import type { MemoryAuditRecord } from '../memory/types';
import { buildWorkspaceExportBundle as assembleWorkspaceExportBundle } from '../export/WorkspaceExportBundle';
import type {
    WorkspaceExportBundle,
    WorkspaceExportBundleRequest,
    WorkspaceScopedMemoryExportRecord,
} from '../export/types';
import {
    buildScopedConversationReply,
    collectAgentConversationAtomIds,
    mergeAgentConversationKnowledgePoints,
} from './conversationComposer';
import { assembleAgentConversationGraphContext } from './graphContextAssembler';
import { buildGraphAnswerPlan } from './graphAnswerPlan';
import { resolveGraphExpansionPolicy, type GraphExpansionPolicy } from './graphExpansionPolicy';
import {
    assembleRagEvidenceContext,
    type RagEvidenceSourceDocument,
    type RagEvidenceSourceLookup,
} from './evidenceContextAssembler';
import { reviewRagContextSufficiency, type RagSufficiencyLlmJudge } from './ragSufficiencyJudge';

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
    sourceUri?: string;
    revision?: string;
    identityAliases: string[];
    sourceHash: string;
    content?: string;
    version: number;
    updatedAt: string;
    atomStableKeyToId: Map<string, string>;
    atomIds: string[];
    evidenceSpanIds: string[];
    relationEdgeIds: string[];
    temporalEdgeIds: string[];
};

type NormalizedKnowledgeDocumentInput = {
    documentId: string;
    sourcePath: string;
    sourceUri?: string;
    revision?: string;
    identityAliases: string[];
    content: string;
    language: string;
    updatedAt: string;
    workspaceId: string | null;
    corpusId: string | null;
    exportProfileId: string | null;
    metadata: Record<string, unknown>;
};

type KnowledgeWorkspaceReadiness = {
    status: 'ready' | 'empty_store' | 'workspace_not_found' | 'workspace_unbound' | 'workspace_unindexed';
    message: string;
    workspaceId: string | null;
    corpusId: string | null;
    activeResourceCount: number;
    activeProjectionCount: number;
    indexedUnitCount: number;
    indexedSegmentCount: number;
    matchedDocumentCount: number;
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

type LearningQualityHistoryRecord = {
    recordId: string;
    userId: string | null;
    sampledAt: string;
    source: 'session_execution' | 'manual_snapshot';
    executionRecordId: string | null;
    executionKind: StudySessionExecutionRecord['executionKind'] | null;
    snapshot: LearningQualitySnapshot;
    diagnostics: Record<string, unknown>;
};

type QueryBackendExecutionResult = {
    backend: GraphQueryBackendType;
    backendId: string;
    items: KnowledgeQueryItem[];
    trace: KnowledgeQueryResponse['trace'] & Record<string, unknown>;
    latencyMs: number;
    evidenceCoverageRatio: number;
    relationPathCoverageRatio: number;
    temporalValidityPassRatio: number;
    usedFallback: boolean;
    fallbackBackend: GraphQueryBackendType | null;
    error: string | null;
};

type QueryScopeRecoveryPlan = NonNullable<KnowledgeQueryResponse['trace']['scopeRecovery']> & {
    recoveryScope: KnowledgeQueryRequest['scope'];
};

type QueryBackendComparisonSide = {
    backend: GraphQueryBackendType;
    backendId: string;
    latencyMs: number;
    itemCount: number;
    evidenceCoverageRatio: number;
    relationPathCoverageRatio: number;
    temporalValidityPassRatio: number;
    usedFallback: boolean;
    fallbackBackend: GraphQueryBackendType | null;
    error: string | null;
    retrievalModes: string[];
    modeWeights: Record<string, number>;
    items: Array<{
        atomId: string;
        score: number;
    }>;
};

type QueryBackendComparisonRecord = {
    comparedAt: string;
    query: string;
    topK: number;
    left: QueryBackendComparisonSide;
    right: QueryBackendComparisonSide;
    summary: {
        preferredBackend: 'left' | 'right' | 'tie';
        reason: string;
        overlapRatioPct: number;
        latencyDeltaMs: number;
        leftEvidenceCoverageRatio: number;
        rightEvidenceCoverageRatio: number;
        leftRelationPathCoverageRatio: number;
        rightRelationPathCoverageRatio: number;
        leftTemporalValidityPassRatio: number;
        rightTemporalValidityPassRatio: number;
        leftPreferenceScore: number;
        rightPreferenceScore: number;
    };
};

type StudySessionPlanQualityThresholdSet = {
    minTotalActions: number;
    minEvidenceCoverageRatioPct: number;
    maxBudgetDeviationActions: number;
    minRecoverySharePctWhenRegressing: number;
    maxDivergenceSharePctWhenRegressing: number;
    minDivergenceSharePctWhenImproving: number;
};

type StudySessionPlanQualityGate = {
    gateId: string;
    passed: boolean;
    comparator: '>=' | '<=';
    observedValue: number;
    threshold: number;
    unit: 'count' | 'pct';
    message: string;
};

type StudySessionPlanQualityHistoryRecord = {
    recordId: string;
    userId: string | null;
    source: 'session_execution' | 'manual_evaluation';
    evaluatedAt: string;
    planGeneratedAt: string | null;
    executionRecordId: string | null;
    executionKind: StudySessionExecutionRecord['executionKind'] | null;
    trendContextStatus: 'improving' | 'stable' | 'regressing' | 'insufficient_data';
    totalActions: number;
    evidenceCoverageRatioPct: number;
    budgetDeviationActions: number;
    recoverySharePct: number;
    divergenceSharePct: number;
    overallPassed: boolean;
    status: 'healthy' | 'watch' | 'risk';
    score: number;
    confidence: number;
    summaryReason: string;
    thresholds: StudySessionPlanQualityThresholdSet;
    gates: StudySessionPlanQualityGate[];
    failedGateIds: string[];
};

type GraphFocusRenderDiagnosticsRequest = {
    sessionId: string;
    userId: string;
    workspaceId?: string | null;
    corpusId?: string | null;
    title?: string;
    requestedSourcePath?: string;
    resolvedSourcePath?: string;
    candidateSourcePaths?: string[];
    attemptedSourcePaths?: string[];
    fallbackSourcePathUsed?: boolean;
    matchedSpanCount?: number;
    highlightTermCount?: number;
    highlightedNodeCount?: number;
    markdownRuntimeAvailable?: boolean;
    storageProviderAvailable?: boolean;
    readSucceeded?: boolean;
    renderSucceeded?: boolean;
    usedFallback?: boolean;
    failureReason?: string;
    recordedAt?: string;
};

type GraphFocusRenderDiagnosticsRecord = {
    recordedAt: string;
    title: string;
    requestedSourcePath: string;
    resolvedSourcePath: string;
    candidateSourcePaths: string[];
    attemptedSourcePaths: string[];
    fallbackSourcePathUsed: boolean;
    matchedSpanCount: number;
    highlightTermCount: number;
    highlightedNodeCount: number;
    markdownRuntimeAvailable: boolean;
    storageProviderAvailable: boolean;
    readSucceeded: boolean;
    renderSucceeded: boolean;
    usedFallback: boolean;
    failureReason: string;
};

type ReviewedRagEvidenceContext = {
    ragContextPack: RagContextPack;
    ragSufficiencyReview: RagSufficiencyReview;
};

export type KnowledgeLearningPlatformOptions = {
    nowProvider?: () => Date;
    store?: KnowledgeGraphStore;
    autoPersist?: boolean;
    tutorAdapter?: TutorAdapter;
    learningQualityThresholds?: Partial<import('./types').LearningQualityThresholds>;
    studySessionPlanQualityAdaptiveThresholdsEnabled?: boolean;
    studySessionPlanQualityAdaptiveThresholdRuntimeConfig?: Record<string, number>;
    graphQueryBackendFactoryOptions?: GraphQueryBackendFactoryOptions;
    graphQueryBackend?: GraphQueryBackend;
    tutorAdapters?: any[];
    localVectorIndexPath?: string;
    localVectorAnnPrefilterEnabled?: boolean;
    localVectorAccelerationAdapter?: string;
    localVectorAccelerationFailureMode?: string;
    localVectorAccelerationRepresentationStrict?: boolean;
    studySessionOrchestrationTrendRuntimeConfig?: Record<string, unknown>;
    studySessionOrchestrationMemorySignalConfig?: Record<string, number>;
    studySessionOrchestrationTutorRoutingConfig?: Record<string, unknown>;
    ragSufficiencyLlmJudge?: RagSufficiencyLlmJudge;
}

const STOPWORDS = new Set<string>([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being',
    'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its', 'of',
    'on', 'or', 'that', 'the', 'their', 'this', 'to', 'was',
    'were', 'with', 'without', 'your', 'you', 'we', 'our', 'can',
    'will', 'shall', 'not', 'do', 'does', 'did', 'if', 'then',
]);

const AGENT_RAG_BASE_CONTEXT_BUDGET: RagContextBudget = {
    maxFragments: 14,
    maxCharsPerFragment: 1400,
    maxTotalChars: 5600,
};

const AGENT_RAG_RECOVERY_CONTEXT_BUDGET: RagContextBudget = {
    maxFragments: 32,
    maxCharsPerFragment: 1800,
    maxTotalChars: 12000,
};

const AGENT_RAG_DEEP_CONTEXT_BUDGET: RagContextBudget = {
    maxFragments: 24,
    maxCharsPerFragment: 1600,
    maxTotalChars: 9000,
};

const AGENT_RAG_CAUSAL_CONTEXT_BUDGET: RagContextBudget = {
    maxFragments: 20,
    maxCharsPerFragment: 1500,
    maxTotalChars: 7600,
};

const AGENT_RAG_BASE_GRAPH_NEIGHBOR_LIMIT = 6;
const AGENT_RAG_CAUSAL_GRAPH_NEIGHBOR_LIMIT = 8;
const AGENT_RAG_DEEP_GRAPH_NEIGHBOR_LIMIT = 8;
const AGENT_RAG_RECOVERY_GRAPH_NEIGHBOR_LIMIT = 8;
const AGENT_RAG_CAUSAL_PARAGRAPH_WINDOW = 7;
const AGENT_RAG_DEEP_PARAGRAPH_WINDOW = 8;
const AGENT_RAG_RECOVERY_PARAGRAPH_WINDOW = 8;

type AgentRagEvidenceProfile = {
    budget: RagContextBudget;
    graphNeighborLimit: number;
    paragraphWindow?: number;
};

const MEMORY_LAYER_CAPACITY: Record<MemoryLayer, number> = {
    session: 80,
    unit: 320,
    long_term: 1200,
};

const NORMALIZED_MASTERY_ERROR_TAGS = new Set<string>([
    'concept_boundary',
    'causal_confusion',
    'prerequisite_gap',
    'evidence_mismatch',
    'retrieval_failure',
    'transfer_failure',
    'reasoning_jump',
    'incorrect_answer',
    'skipped',
    'other',
]);

const ERROR_TAG_TO_ACTION_KINDS: Record<MasteryErrorTag, LearningActionKind[]> = {
    concept_boundary: ['review', 'explain', 'counterexample'],
    causal_confusion: ['review', 'explain', 'quiz'],
    prerequisite_gap: ['review', 'quiz', 'transfer'],
    evidence_mismatch: ['review', 'reflection', 'quiz'],
    retrieval_failure: ['quiz', 'review', 'reflection'],
    transfer_failure: ['transfer', 'counterexample', 'review'],
    reasoning_jump: ['explain', 'reflection', 'counterexample'],
    incorrect_answer: ['quiz', 'review', 'explain'],
    skipped: ['review', 'quiz', 'reflection'],
    other: ['review', 'explain', 'quiz'],
};

const DEFAULT_LEARNING_QUALITY_THRESHOLDS: LearningQualityThresholds = {
    retestPassRateUpliftPct: 20,
    misconceptionRecurrenceReductionPct: 25,
    evidenceBackedSuggestionRatioPct: 90,
    minQueryEvidenceCoverageRatioPct: 80,
    minQueryRelationPathCoverageRatioPct: 60,
    minQueryTemporalValidityPassRatioPct: 90,
    maxPendingVerificationRatioPct: 20,
    maxQueryBackendFallbackRatioPct: 10,
    minSessionMemoryPromotionCoveragePct: 25,
    pathEffectivenessLiftPct: 5,
    historyWindowAverageMasteryDeltaUplift: 0,
    queryP95Ms: 800,
};

const DEFAULT_STUDY_SESSION_PLAN_QUALITY_THRESHOLDS: StudySessionPlanQualityThresholdSet = {
    minTotalActions: 2,
    minEvidenceCoverageRatioPct: 70,
    maxBudgetDeviationActions: 2,
    minRecoverySharePctWhenRegressing: 50,
    maxDivergenceSharePctWhenRegressing: 35,
    minDivergenceSharePctWhenImproving: 15,
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
const SESSION_EXECUTION_HISTORY_LIMIT = 400;
const CONVERSATION_TURN_HISTORY_LIMIT = 400;
const CONVERSATION_INVOCATION_HISTORY_LIMIT = 400;
const GRAPH_FOCUS_REPORT_HISTORY_LIMIT = 8;

function createEmptySessionActionTelemetry(): KnowledgeSystemState['sessionActionTelemetry'] {
    return {
        executionCount: 0,
        analyzedAnswerCount: 0,
        inferredMasteryUpdateCount: 0,
        explicitMasteryUpdateCount: 0,
        memoryPersistedCount: 0,
        outcomeCounts: {
            correct: 0,
            partial: 0,
            incorrect: 0,
            skipped: 0,
        },
    };
}

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

function resolveAgentRagEvidenceProfile(message: string, expansionPolicy: GraphExpansionPolicy): AgentRagEvidenceProfile {
    const normalizedMessage = normalizeWhitespace(String(message || '')).toLowerCase();
    const causalExplanationSignal = Boolean(
        /\b(?:why|cause|causes|caused|causal|because|reason|mechanism|mechanisms)\b/i.test(normalizedMessage)
        || /为什么|為什麼|为何|為何|原因|因果|机制|機制|导致|導致/u.test(normalizedMessage)
    );
    if (causalExplanationSignal && !expansionPolicy.enabled) {
        return {
            budget: { ...AGENT_RAG_CAUSAL_CONTEXT_BUDGET },
            graphNeighborLimit: AGENT_RAG_CAUSAL_GRAPH_NEIGHBOR_LIMIT,
            paragraphWindow: AGENT_RAG_CAUSAL_PARAGRAPH_WINDOW,
        };
    }
    if (!expansionPolicy.enabled) {
        return {
            budget: { ...AGENT_RAG_BASE_CONTEXT_BUDGET },
            graphNeighborLimit: AGENT_RAG_BASE_GRAPH_NEIGHBOR_LIMIT,
        };
    }
    return {
        budget: { ...AGENT_RAG_DEEP_CONTEXT_BUDGET },
        graphNeighborLimit: AGENT_RAG_DEEP_GRAPH_NEIGHBOR_LIMIT,
        paragraphWindow: AGENT_RAG_DEEP_PARAGRAPH_WINDOW,
    };
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

    private readonly identityJournal: IdentityTransitionRecord[] = [];

    private readonly activeStableKeyToAtomId = new Map<string, string>();

    private readonly activeAtomIds = new Set<string>();

    private readonly learnerStates = new Map<string, LearnerConceptState>();

    private readonly tutorTraces: TutorTrace[] = [];

    private readonly userMemory = new Map<string, UserMemoryBank>();

    private readonly conversationSessions = new Map<string, AgentConversationSessionRecord>();

    private readonly conversationTurns = new Map<string, AgentConversationTurnRecord>();

    private readonly conversationInvocations: AgentConversationInvocationRecord[] = [];

    private readonly resourceRegistry = new ResourceRegistry((prefix?: string) => this.nextId(prefix || 'resource'));

    private readonly workspaceRegistry = new WorkspaceRegistry((prefix?: string) => this.nextId(prefix || 'workspace'));

    private readonly indexLifecycle = new IndexLifecycle(
        (prefix?: string) => this.nextId(prefix || 'index'),
        (value: string) => this.computeHash(value)
    );

    private readonly sessionStateStore = new SessionStateStore((prefix?: string) => this.nextId(prefix || 'session_state'));

    private readonly workflowArtifactStore = new WorkflowArtifactStore((prefix?: string) => this.nextId(prefix || 'workflow_artifact'));

    private readonly memoryAuditRecords: MemoryAuditRecord[] = [];

    private readonly titleToAtomIds = new Map<string, Set<string>>();

    private readonly relationEdgeSignatures = new Set<string>();

    private readonly learningQualityBaselines = new Map<string, {
        snapshot: LearningQualitySnapshot;
        storedAt: string;
    }>();

    private readonly ingestLatencyHistoryMs: number[] = [];

    private readonly recomputeLatencyHistoryMs: number[] = [];

    private readonly queryLatencyHistoryMs: number[] = [];

    private readonly nowProvider: () => Date;

    private readonly store: KnowledgeGraphStore | null;

    private readonly autoPersist: boolean;

    private readonly tutorAdapter: TutorAdapter | null;

    private readonly configuredTutorAdapters: TutorAdapter[];

    private readonly learningQualityThresholds: LearningQualityThresholds;

    private readonly studySessionPlanQualityAdaptiveThresholdsEnabled: boolean;

    private readonly studySessionPlanQualityAdaptiveThresholdRuntimeConfig: Record<string, number>;

    private readonly studySessionOrchestrationTrendRuntimeConfig: Record<string, unknown>;

    private readonly studySessionOrchestrationMemorySignalConfig: Record<string, unknown>;

    private readonly studySessionOrchestrationTutorRoutingConfig: Record<string, unknown>;

    private readonly ragSufficiencyLlmJudge: RagSufficiencyLlmJudge | null;

    private currentGraphQueryBackendType: GraphQueryBackendType;

    private graphQueryBackend: GraphQueryBackend;

    private graphQueryBackendFactoryOptions: GraphQueryBackendFactoryOptions;

    private latestIngestSummary: KnowledgeIngestResponse['summary'] | null = null;

    private sessionActionTelemetry: KnowledgeSystemState['sessionActionTelemetry'] = createEmptySessionActionTelemetry();

    private readonly sessionExecutionHistory: StudySessionExecutionRecord[] = [];

    private readonly learningQualityHistoryRecords: LearningQualityHistoryRecord[] = [];

    private readonly queryBackendComparisonHistoryRecords: QueryBackendComparisonRecord[] = [];

    private readonly studySessionPlanQualityHistoryRecords: StudySessionPlanQualityHistoryRecord[] = [];

    private readonly memoryPolicyDiagnosticsHistoryRecords: Array<Record<string, unknown>> = [];

    private queryBackendFallbackCount = 0;

    private queryBackendLastError = '';

    private hydrated = false;

    private hydrationPromise: Promise<void> | null = null;

    /** Serializes ingest mutations so a rollback cannot race a concurrent writer. */
    private ingestQueue: Promise<void> = Promise.resolve();

    constructor(nowProviderOrOptions: (() => Date) | KnowledgeLearningPlatformOptions = {}) {
        if (typeof nowProviderOrOptions === 'function') {
            this.nowProvider = nowProviderOrOptions;
            this.store = null;
            this.autoPersist = true;
            this.tutorAdapter = null;
            this.configuredTutorAdapters = [];
            this.learningQualityThresholds = this.resolveLearningQualityThresholds(undefined);
            this.studySessionPlanQualityAdaptiveThresholdsEnabled = false;
            this.studySessionPlanQualityAdaptiveThresholdRuntimeConfig = {};
            this.studySessionOrchestrationTrendRuntimeConfig = {};
            this.studySessionOrchestrationMemorySignalConfig = {};
            this.studySessionOrchestrationTutorRoutingConfig = {};
            this.ragSufficiencyLlmJudge = null;
            this.currentGraphQueryBackendType = 'local_hybrid';
            this.graphQueryBackendFactoryOptions = {
                backend: this.currentGraphQueryBackendType,
            };
            this.graphQueryBackend = createGraphQueryBackend(this.graphQueryBackendFactoryOptions);
            return;
        }

        this.nowProvider = nowProviderOrOptions.nowProvider || (() => new Date());
        this.store = nowProviderOrOptions.store || null;
        this.autoPersist = nowProviderOrOptions.autoPersist !== false;
        this.tutorAdapter = nowProviderOrOptions.tutorAdapter || null;
        this.configuredTutorAdapters = Array.from(new Map(
            [
                ...(Array.isArray(nowProviderOrOptions.tutorAdapters) ? nowProviderOrOptions.tutorAdapters : []),
                ...(this.tutorAdapter ? [this.tutorAdapter] : []),
            ]
                .filter((adapter): adapter is TutorAdapter => Boolean(adapter && isNonEmptyString(adapter.id)))
                .map((adapter) => [adapter.id, adapter])
        ).values());
        this.learningQualityThresholds = this.resolveLearningQualityThresholds(
            nowProviderOrOptions.learningQualityThresholds
        );
        this.studySessionPlanQualityAdaptiveThresholdsEnabled =
            nowProviderOrOptions.studySessionPlanQualityAdaptiveThresholdsEnabled === true;
        this.studySessionPlanQualityAdaptiveThresholdRuntimeConfig = {
            ...(nowProviderOrOptions.studySessionPlanQualityAdaptiveThresholdRuntimeConfig || {}),
        };
        this.studySessionOrchestrationTrendRuntimeConfig = {
            ...(nowProviderOrOptions.studySessionOrchestrationTrendRuntimeConfig || {}),
        };
        this.studySessionOrchestrationMemorySignalConfig = {
            ...(nowProviderOrOptions.studySessionOrchestrationMemorySignalConfig || {}),
        };
        this.studySessionOrchestrationTutorRoutingConfig = {
            ...(nowProviderOrOptions.studySessionOrchestrationTutorRoutingConfig || {}),
        };
        this.ragSufficiencyLlmJudge = typeof nowProviderOrOptions.ragSufficiencyLlmJudge === 'function'
            ? nowProviderOrOptions.ragSufficiencyLlmJudge
            : null;
        const inferredBackendType = normalizeGraphQueryBackendType(
            nowProviderOrOptions.graphQueryBackendFactoryOptions?.backend
            || this.inferGraphQueryBackendTypeFromId(nowProviderOrOptions.graphQueryBackend?.id)
            || 'local_hybrid'
        );
        this.currentGraphQueryBackendType = inferredBackendType;
        this.graphQueryBackendFactoryOptions = {
            ...(nowProviderOrOptions.graphQueryBackendFactoryOptions || {}),
            backend: inferredBackendType,
        };
        this.graphQueryBackend = nowProviderOrOptions.graphQueryBackend
            || createGraphQueryBackend(this.graphQueryBackendFactoryOptions);
    }

    public ingestKnowledge(request: KnowledgeIngestRequest): Promise<KnowledgeIngestResponse> {
        const run = this.ingestQueue.then(() => this.ingestKnowledgeExclusive(request));
        this.ingestQueue = run.then(() => undefined, () => undefined);
        return run;
    }

    private async ingestKnowledgeExclusive(request: KnowledgeIngestRequest): Promise<KnowledgeIngestResponse> {
        await this.ensureHydrated();
        const rollbackSnapshot = this.cloneKnowledgeGraphSnapshotForTransaction(await this.buildSnapshotForPersist());
        try {
            return await this.performKnowledgeIngest(request);
        } catch (error) {
            this.restoreFromSnapshot(rollbackSnapshot);
            if (this.store && this.autoPersist) {
                try {
                    await this.store.saveSnapshot(rollbackSnapshot);
                } catch (rollbackError) {
                    const originalMessage = error instanceof Error ? error.message : String(error);
                    const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
                    throw new Error(
                        `Ingest transaction failed and rollback persistence failed: ${originalMessage}; rollback: ${rollbackMessage}`,
                    );
                }
            }
            throw error;
        }
    }

    private async performKnowledgeIngest(request: KnowledgeIngestRequest): Promise<KnowledgeIngestResponse> {
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
            this.assertIdentityAliasesAvailable(normalizedInput.documentId, [
                normalizedInput.sourcePath,
                normalizedInput.sourceUri,
                ...normalizedInput.identityAliases,
            ]);
            ingestedDocumentCount += 1;
            const sourceHash = this.computeHash(normalizedInput.content);
            const previousSnapshot = this.documents.get(normalizedInput.documentId);
            const previousVersion = previousSnapshot?.version ?? 0;
            const currentVersion = previousVersion + 1;

            if (incremental && previousSnapshot && previousSnapshot.sourceHash === sourceHash) {
                if (this.hasIdentityChanged(previousSnapshot, normalizedInput)) {
                    this.applyDocumentIdentityTransition(
                        previousSnapshot.documentId,
                        {
                            toSourcePath: normalizedInput.sourcePath,
                            toSourceUri: normalizedInput.sourceUri,
                            toIdentityAliases: normalizedInput.identityAliases,
                            revision: normalizedInput.revision,
                            updatedAt: ingestedAt,
                        },
                        ingestedAt,
                        'upsert_identity_change',
                    );
                }
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

            if (previousSnapshot) {
                this.indexLifecycle.retireDocumentIndex(normalizedInput.documentId);
            }

            const parsedDocument = this.parseDocument(normalizedInput);
            const snapshot: DocumentSnapshot = {
                documentId: normalizedInput.documentId,
                sourcePath: normalizedInput.sourcePath,
                sourceUri: normalizedInput.sourceUri,
                revision: normalizedInput.revision,
                identityAliases: [...normalizedInput.identityAliases],
                sourceHash,
                content: normalizedInput.content,
                version: currentVersion,
                updatedAt: ingestedAt,
                atomStableKeyToId: new Map<string, string>(),
                atomIds: [],
                evidenceSpanIds: [],
                relationEdgeIds: [],
                temporalEdgeIds: [],
            };
            const createdAtomsForIndex: KnowledgeAtom[] = [];

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
                createdAtomsForIndex.push(atom);

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

            const resourceWorkspaceBinding = this.syncResourceAndWorkspaceForDocument({
                document: normalizedInput,
                sourceHash,
                version: currentVersion,
                updatedAt: ingestedAt,
            });
            this.syncIndexLifecycleForDocument({
                document: normalizedInput,
                sourceHash,
                snapshot,
                atoms: createdAtomsForIndex,
                resource: resourceWorkspaceBinding.resource,
                projection: resourceWorkspaceBinding.projection,
                workspace: resourceWorkspaceBinding.workspace,
                indexedAt: ingestedAt,
            });
            this.documents.set(normalizedInput.documentId, snapshot);
        };

        const processMove = (moveInput: KnowledgeDocumentMoveInput): void => {
            const documentId = this.resolveDocumentIdForMove(moveInput);
            if (!documentId) {
                throw new Error('Move operation could not resolve its source document.');
            }
            const previousSnapshot = this.documents.get(documentId);
            if (!previousSnapshot) {
                throw new Error(`Move operation references an unknown document: ${documentId}.`);
            }
            this.applyDocumentIdentityTransition(documentId, moveInput, ingestedAt, 'move');
            staleness.push({
                documentId,
                sourcePath: this.documents.get(documentId)?.sourcePath || moveInput.toSourcePath,
                status: 'updated',
                previousHash: previousSnapshot.sourceHash,
                currentHash: previousSnapshot.sourceHash,
                previousVersion: previousSnapshot.version,
                currentVersion: previousSnapshot.version,
            });
        };

        const processDelete = (deleteInput: KnowledgeDocumentDeleteInput): void => {
            const deleted = this.deleteDocumentSnapshot(deleteInput, ingestedAt, responseTemporals);
            if (!deleted.deleted || !deleted.documentId || !deleted.sourcePath) {
                return;
            }
            this.resourceRegistry.markDocumentProjectionDeleted(deleted.documentId, ingestedAt);
            this.indexLifecycle.retireDocumentIndex(deleted.documentId);
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
                } else if (operation.op === 'move') {
                    processMove(operation.document);
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
        const backend = normalizeGraphQueryBackendType(request.queryBackend || this.currentGraphQueryBackendType);
        const execution = await this.executeQueryBackend(
            request,
            backend,
            {
                allowRuntimeFallback: true,
                recordFallback: true,
            }
        );
        this.recordQueryLatency(execution.latencyMs);
        const response: KnowledgeQueryResponse = {
            items: execution.items,
            trace: execution.trace,
        };
        return response;
    }

    public async warmQueryBackend(request: Partial<KnowledgeQueryRequest> = {}): Promise<{
        warmed: boolean;
        backendId: string;
        latencyMs: number;
        candidateCount: number;
        totalAtomsInScope: number;
    }> {
        await this.ensureHydrated();
        const backend = normalizeGraphQueryBackendType(request.queryBackend || this.currentGraphQueryBackendType);
        const contextBundle = this.buildQueryBackendContext({
            ...request,
            query: normalizeWhitespace(String(request.query || 'knowledge workspace warmup')),
            topK: clamp(Math.floor(Number(request.topK) || 1), 1, 20),
        }, backend);
        const backendInstance = backend === this.currentGraphQueryBackendType
            ? this.graphQueryBackend
            : createGraphQueryBackend({
                ...this.graphQueryBackendFactoryOptions,
                backend,
            });
        const startedAtMs = Date.now();
        const result = await backendInstance.query(contextBundle.context);
        return {
            warmed: true,
            backendId: backendInstance.id,
            latencyMs: Date.now() - startedAtMs,
            candidateCount: Array.isArray(result.candidates) ? result.candidates.length : 0,
            totalAtomsInScope: contextBundle.atoms.length,
        };
    }

    public async inspectKnowledgeWorkspaceRequest(request: {
        query?: string;
        scope?: KnowledgeQueryRequest['scope'];
        queryBackend?: KnowledgeQueryRequest['queryBackend'];
    } = {}): Promise<{
        readiness: KnowledgeWorkspaceReadiness;
        resolvedScope: KnowledgeQueryResolvedScope;
        planner: {
            plannerQuery: string | null;
            titleLikeQueries: string[];
            titleHitDocumentIds: string[];
        };
        totalAtomsInScope: number;
        totalActiveAtoms: number;
    }> {
        await this.ensureHydrated();
        const backend = normalizeGraphQueryBackendType(request.queryBackend || this.currentGraphQueryBackendType);
        const contextBundle = this.buildQueryBackendContext({
            query: String(request.query || '').trim(),
            scope: request.scope,
            queryBackend: backend,
        }, backend);
        return {
            readiness: contextBundle.readiness,
            resolvedScope: contextBundle.resolvedScope,
            planner: {
                plannerQuery: contextBundle.titleLikeQueries[0] || null,
                titleLikeQueries: contextBundle.titleLikeQueries,
                titleHitDocumentIds: contextBundle.titleHitDocumentIds,
            },
            totalAtomsInScope: contextBundle.atoms.length,
            totalActiveAtoms: this.activeAtomIds.size,
        };
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
            const previousState = this.normalizeLearnerState(
                this.learnerStates.get(stateKey) || this.createDefaultLearnerState(userId, observation.atomId, observedAt),
                observedAt
            );
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

    public async queryMasteryMisconceptions(
        request: MasteryMisconceptionRequest
    ): Promise<MasteryMisconceptionResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('MasteryMisconceptionAPI requires a non-empty userId.');
        }
        const generatedAt = this.resolveTimestamp(request.generatedAt);
        const topK = clamp(Math.floor(Number(request.topK) || 10), 1, 100);
        const atomScope = Array.isArray(request.atomIds) && request.atomIds.length > 0
            ? new Set(request.atomIds.filter((atomId): atomId is string => isNonEmptyString(atomId)))
            : null;

        const aggregated = new Map<string, {
            errorTag: string;
            count: number;
            lastSeenAt: string;
            affectedAtomIds: Set<string>;
            masteryWeightedSum: number;
        }>();

        this.learnerStates.forEach((state) => {
            if (state.userId !== userId) {
                return;
            }
            if (atomScope && !atomScope.has(state.atomId)) {
                return;
            }
            const normalizedState = this.normalizeLearnerState(state, generatedAt);
            normalizedState.errorTagStats.forEach((stat) => {
                const normalizedTag = this.normalizeMasteryErrorTag(String(stat.tag));
                if (!normalizedTag) {
                    return;
                }
                const current = aggregated.get(normalizedTag) || {
                    errorTag: normalizedTag,
                    count: 0,
                    lastSeenAt: generatedAt,
                    affectedAtomIds: new Set<string>(),
                    masteryWeightedSum: 0,
                };
                current.count += Math.max(0, Math.floor(Number(stat.count || 0)));
                if (isNonEmptyString(stat.lastSeenAt) && stat.lastSeenAt > current.lastSeenAt) {
                    current.lastSeenAt = stat.lastSeenAt;
                }
                current.affectedAtomIds.add(normalizedState.atomId);
                current.masteryWeightedSum += normalizedState.masteryProbability * Math.max(1, Number(stat.count || 1));
                aggregated.set(normalizedTag, current);
            });
        });

        const items: MasteryMisconceptionItem[] = Array.from(aggregated.values())
            .filter((item) => item.count > 0)
            .map((item) => {
                const averageMasteryProbability = Number(
                    clamp(item.masteryWeightedSum / Math.max(1, item.count), 0, 1).toFixed(6)
                );
                const frequencyFactor = clamp(item.count / Math.max(1, item.count + 5), 0, 1);
                const severityScore = Number(
                    clamp(
                        frequencyFactor * 0.65 + (1 - averageMasteryProbability) * 0.35,
                        0,
                        1
                    ).toFixed(6)
                );
                return {
                    errorTag: item.errorTag,
                    count: item.count,
                    affectedAtomIds: Array.from(item.affectedAtomIds.values()),
                    averageMasteryProbability,
                    severityScore,
                    lastSeenAt: item.lastSeenAt,
                    recommendedActionKinds: this.resolveActionKindsForErrorTag(item.errorTag),
                };
            })
            .sort((left, right) => {
                if (right.severityScore !== left.severityScore) {
                    return right.severityScore - left.severityScore;
                }
                if (right.count !== left.count) {
                    return right.count - left.count;
                }
                return right.lastSeenAt.localeCompare(left.lastSeenAt);
            })
            .slice(0, topK);

        return {
            userId,
            generatedAt,
            items,
            summary: {
                trackedTags: items.length,
                totalObservations: items.reduce((sum, item) => sum + item.count, 0),
            },
        };
    }

    private async composeLearningPathResponse(request: LearningPathRequest): Promise<{
        response: LearningPathResponse;
        userId: string;
        generatedAt: string;
        focusAtomIds: string[];
    }> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('LearningPathAPI requires a non-empty userId.');
        }
        const generatedAt = this.resolveTimestamp(request.generatedAt);
        const resolvedMaxMasteryPaths = Number.isFinite(Number(request.maxMasteryPaths))
            ? Number(request.maxMasteryPaths)
            : 3;
        const resolvedMaxDivergencePaths = Number.isFinite(Number(request.maxDivergencePaths))
            ? Number(request.maxDivergencePaths)
            : 3;
        const maxMasteryPaths = clamp(Math.floor(resolvedMaxMasteryPaths), 0, 12);
        const maxDivergencePaths = clamp(Math.floor(resolvedMaxDivergencePaths), 0, 12);
        const focusAtomIds = Array.isArray(request.focusAtomIds)
            ? request.focusAtomIds.filter((atomId): atomId is string => isNonEmptyString(atomId) && this.activeAtomIds.has(atomId))
            : [];

        const candidateAtomIds = focusAtomIds.length > 0 ? focusAtomIds : Array.from(this.activeAtomIds);
        const masteryPaths = maxMasteryPaths > 0
            ? this.buildMasteryPaths(userId, candidateAtomIds, maxMasteryPaths, generatedAt)
            : [];
        const divergencePaths = maxDivergencePaths > 0
            ? this.buildDivergencePaths(userId, candidateAtomIds, maxDivergencePaths, generatedAt)
            : [];
        const recommendedActions = [...masteryPaths, ...divergencePaths]
            .flatMap((pathItem) => pathItem.actions)
            .sort((left, right) => right.priority - left.priority)
            .slice(0, 24);

        const response: LearningPathResponse = {
            masteryPaths,
            divergencePaths,
            recommendedActions,
        };
        return {
            response,
            userId,
            generatedAt,
            focusAtomIds,
        };
    }

    public async previewLearningPath(request: LearningPathRequest): Promise<LearningPathResponse> {
        const { response } = await this.composeLearningPathResponse(request);
        return response;
    }

    public async buildLearningPath(request: LearningPathRequest): Promise<LearningPathResponse> {
        const {
            response,
            userId,
            generatedAt,
            focusAtomIds,
        } = await this.composeLearningPathResponse(request);
        const scopedWorkspace = this.resolveWorkspaceContextForAtomIds(focusAtomIds);
        this.recordWorkflowArtifact({
            kind: 'learning_path',
            sessionId: null,
            userId,
            workspaceId: scopedWorkspace.workspaceId,
            corpusId: scopedWorkspace.corpusId,
            title: `Learning path for ${focusAtomIds[0] || 'global scope'}`,
            sourceAtomIds: focusAtomIds,
            summary: `Generated ${response.masteryPaths.length} mastery path(s), ${response.divergencePaths.length} divergence path(s), and ${response.recommendedActions.length} recommended action(s).`,
            payload: response as unknown as Record<string, unknown>,
            recordedAt: generatedAt,
        });
        await this.persistIfNeeded();
        return response;
    }

    public async buildStudySession(request: StudySessionRequest): Promise<StudySessionResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('StudySessionAPI requires a non-empty userId.');
        }
        const sessionId = isNonEmptyString(request.sessionId) ? request.sessionId.trim() : undefined;
        const generatedAt = this.resolveTimestamp(request.generatedAt);
        const maxActions = clamp(Math.floor(Number(request.maxActions) || 12), 1, 80);
        const includeDivergence = request.includeDivergence !== false;
        const includeRetrain = request.includeRetrain !== false;
        const focusAtomIds = Array.isArray(request.focusAtomIds)
            ? request.focusAtomIds.filter((atomId): atomId is string => isNonEmptyString(atomId) && this.activeAtomIds.has(atomId))
            : [];
        const candidateAtomIds = focusAtomIds.length > 0 ? focusAtomIds : Array.from(this.activeAtomIds);
        const misconceptionResult = await this.queryMasteryMisconceptions({
            userId,
            atomIds: candidateAtomIds,
            topK: 8,
            generatedAt,
        });
        const pathResult = await this.buildLearningPath({
            userId,
            focusAtomIds: candidateAtomIds,
            maxMasteryPaths: 4,
            maxDivergencePaths: includeDivergence ? 3 : 0,
            generatedAt,
        });

        const retrainResponse = includeRetrain
            ? await this.applyMemoryPolicy({
                userId,
                layer: 'session',
                operation: 'retrain_plan',
                limit: maxActions,
                now: generatedAt,
            })
            : null;

        const masteryActions: StudySessionAction[] = pathResult.masteryPaths
            .flatMap((pathItem) =>
                pathItem.actions.map((action) => ({
                    ...action,
                    source: 'mastery_path' as const,
                }))
            );
        const divergenceActions: StudySessionAction[] = includeDivergence
            ? pathResult.divergencePaths.flatMap((pathItem) =>
                pathItem.actions.map((action) => ({
                    ...action,
                    source: 'divergence_path' as const,
                }))
            )
            : [];
        const retrainActions: StudySessionAction[] = (retrainResponse?.recommendedActions || [])
            .map((action) => ({
                ...action,
                source: 'retrain_plan' as const,
            }));
        const misconceptionActions = misconceptionResult.items
            .slice(0, 4)
            .reduce<StudySessionAction[]>((actions, item, index) => {
                const atomId = item.affectedAtomIds.find((candidateAtomId) => this.activeAtomIds.has(candidateAtomId));
                if (!atomId) {
                    return actions;
                }
                const atom = this.atoms.get(atomId);
                const kind = item.recommendedActionKinds[0] || 'review';
                const expectedGain = Number(
                    clamp(item.severityScore * 0.6 + (1 - item.averageMasteryProbability) * 0.4, 0.05, 0.9).toFixed(4)
                );
                actions.push({
                    ...this.createLearningAction({
                        kind,
                        atomId,
                        priority: 112 - index * 3,
                        expectedGain,
                        rationale: `Target misconception "${item.errorTag}" before next expansion.`,
                        evidenceSpanIds: atom?.evidenceSpanIds || [],
                        relationPathAtomIds: [atomId],
                        estimatedMinutes: 7,
                    }),
                    source: 'misconception_remediation',
                    errorTag: item.errorTag,
                });
                return actions;
            }, []);

        const dedupedBySignature = new Map<string, StudySessionAction>();
        [...misconceptionActions, ...retrainActions, ...masteryActions, ...divergenceActions].forEach((action) => {
            const signature = `${action.source}::${action.kind}::${action.atomId}`;
            const existing = dedupedBySignature.get(signature);
            if (!existing) {
                dedupedBySignature.set(signature, action);
                return;
            }
            if (action.priority > existing.priority) {
                dedupedBySignature.set(signature, action);
            }
        });

        const actions = Array.from(dedupedBySignature.values())
            .sort((left, right) => {
                if (right.priority !== left.priority) {
                    return right.priority - left.priority;
                }
                return right.expectedGain - left.expectedGain;
            })
            .slice(0, maxActions);
        const evidenceCoverageRatio = actions.length > 0
            ? Number((actions.filter((action) => action.evidenceSpanIds.length > 0).length / actions.length).toFixed(4))
            : 1;
        const dueRetrainAtoms = Array.from(new Set(retrainActions.map((action) => action.atomId)));

        const response: StudySessionResponse = {
            userId,
            sessionId,
            generatedAt,
            actions,
            signals: {
                misconceptions: misconceptionResult.items,
                dueRetrainAtoms,
                masteryPathTargets: pathResult.masteryPaths.map((pathItem) => pathItem.targetAtomId),
                divergenceTargets: pathResult.divergencePaths.map((pathItem) => pathItem.targetAtomId),
            },
            summary: {
                totalActions: actions.length,
                totalEstimatedMinutes: actions.reduce((sum, action) => sum + action.estimatedMinutes, 0),
                evidenceCoverageRatio,
            },
        };
        const scopedWorkspace = this.resolveWorkspaceContextForAtomIds(candidateAtomIds);
        if (sessionId) {
            this.upsertConversationSessionState({
                sessionId,
                userId,
                mode: 'study_session',
                workspaceId: scopedWorkspace.workspaceId,
                corpusId: scopedWorkspace.corpusId,
                activeResourceIds: this.resolveSourceResourceIdsForAtomIds(candidateAtomIds),
                activeProjectionIds: this.resolveSourceProjectionIdsForAtomIds(candidateAtomIds),
                topK: maxActions,
                queryBackend: null,
                persistMemory: includeRetrain,
                memoryNamespace: null,
                exportProfileId: scopedWorkspace.exportProfileId,
                panelState: {
                    lastStudyPlanGeneratedAt: generatedAt,
                    totalActions: actions.length,
                    evidenceCoverageRatio,
                },
                recordedAt: generatedAt,
            });
        }
        this.recordWorkflowArtifact({
            kind: 'study_session',
            sessionId: sessionId || null,
            userId,
            workspaceId: scopedWorkspace.workspaceId,
            corpusId: scopedWorkspace.corpusId,
            title: `Study session for ${candidateAtomIds[0] || 'global scope'}`,
            sourceAtomIds: candidateAtomIds,
            summary: `Built ${actions.length} study action(s) with evidence coverage ${Number((evidenceCoverageRatio * 100).toFixed(2))} pct.`,
            payload: response as unknown as Record<string, unknown>,
            recordedAt: generatedAt,
        });
        await this.persistIfNeeded();
        return response;
    }

    public async queryStudySessionHistory(request: StudySessionHistoryRequest): Promise<StudySessionHistoryResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('StudySessionHistoryAPI requires a non-empty userId.');
        }
        const generatedAt = this.resolveTimestamp(undefined);
        const limit = clamp(Math.floor(Number(request.limit) || 10), 1, 100);
        const offset = Math.max(0, Math.floor(Number(request.offset) || 0));
        const requestedKinds = Array.isArray(request.executionKinds)
            ? request.executionKinds
                .map((kind) => String(kind || '').trim().toLowerCase())
                .filter((kind): kind is StudySessionExecutionRecord['executionKind'] =>
                    kind === 'session' || kind === 'retest' || kind === 'custom'
                )
            : [];
        const activeKindFilter = requestedKinds.length > 0
            ? new Set(requestedKinds)
            : null;
        const fromExecutedAtIso = this.resolveOptionalTimestamp(request.fromExecutedAt);
        const toExecutedAtIso = this.resolveOptionalTimestamp(request.toExecutedAt);
        const fromExecutedAtMs = fromExecutedAtIso ? Date.parse(fromExecutedAtIso) : Number.NEGATIVE_INFINITY;
        const toExecutedAtMs = toExecutedAtIso ? Date.parse(toExecutedAtIso) : Number.POSITIVE_INFINITY;
        const rangeStartMs = Math.min(fromExecutedAtMs, toExecutedAtMs);
        const rangeEndMs = Math.max(fromExecutedAtMs, toExecutedAtMs);
        const filteredRecords = this.sessionExecutionHistory
            .filter((record) => record.userId === userId)
            .filter((record) => activeKindFilter ? activeKindFilter.has(record.executionKind) : true)
            .filter((record) => {
                const executedAtMs = Date.parse(record.executedAt);
                if (!Number.isFinite(executedAtMs)) {
                    return false;
                }
                return executedAtMs >= rangeStartMs && executedAtMs <= rangeEndMs;
            });
        const records = filteredRecords
            .slice(offset, offset + limit)
            .map((record) => ({ ...record }));
        const totalExecutedActions = filteredRecords.reduce(
            (sum, record) => sum + Math.max(0, Math.floor(Number(record.executedCount || 0))),
            0
        );
        const totalUpdatedMasteryCount = filteredRecords.reduce(
            (sum, record) => sum + Math.max(0, Math.floor(Number(record.updatedMasteryCount || 0))),
            0
        );
        const averageMasteryDelta = filteredRecords.length > 0
            ? Number((filteredRecords.reduce((sum, record) => sum + Number(record.averageMasteryDelta || 0), 0) / filteredRecords.length).toFixed(6))
            : 0;
        const averageTutorConfidence = filteredRecords.length > 0
            ? Number((filteredRecords.reduce((sum, record) => sum + Number(record.averageTutorConfidence || 0), 0) / filteredRecords.length).toFixed(6))
            : 0;
        const executionKindBreakdown = (['session', 'retest', 'custom'] as const).map((executionKind) => {
            const kindRecords = filteredRecords.filter((record) => record.executionKind === executionKind);
            const kindExecutedActions = kindRecords.reduce(
                (sum, record) => sum + Math.max(0, Math.floor(Number(record.executedCount || 0))),
                0
            );
            const kindAverageMasteryDelta = kindRecords.length > 0
                ? Number((kindRecords.reduce((sum, record) => sum + Number(record.averageMasteryDelta || 0), 0) / kindRecords.length).toFixed(6))
                : 0;
            return {
                executionKind,
                recordCount: kindRecords.length,
                totalExecutedActions: kindExecutedActions,
                averageMasteryDelta: kindAverageMasteryDelta,
            };
        });
        const hasMore = offset + records.length < filteredRecords.length;
        return {
            userId,
            generatedAt,
            records,
            page: {
                limit,
                offset,
                returnedRecords: records.length,
                totalFilteredRecords: filteredRecords.length,
                hasMore,
                nextOffset: hasMore ? offset + records.length : null,
            },
            summary: {
                totalRecords: filteredRecords.length,
                totalExecutedActions,
                totalUpdatedMasteryCount,
                averageMasteryDelta,
                averageTutorConfidence,
                executionKindBreakdown,
            },
        };
    }

    public async executeStudySessionAction(
        request: StudySessionActionExecutionRequest
    ): Promise<StudySessionActionExecutionResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('StudySessionActionAPI requires a non-empty userId.');
        }
        const action = request.action || {} as StudySessionActionExecutionRequest['action'];
        const atomId = String(action.atomId || '').trim();
        if (!atomId || !this.activeAtomIds.has(atomId)) {
            throw new Error('StudySessionActionAPI requires a valid active atomId.');
        }
        const sessionId = isNonEmptyString(request.sessionId) ? request.sessionId.trim() : undefined;
        const learningActionKind = action.kind;
        const tutorActionKind = this.resolveTutorActionKindFromLearningKind(learningActionKind);
        const executedAt = this.resolveTimestamp(request.executedAt);
        const atomWorkspace = this.resolveWorkspaceContextForAtomIds([atomId]);
        const hasAnswer = isNonEmptyString(action.answer);
        const tutor = await this.executeTutorAction({
            userId,
            actionKind: tutorActionKind,
            atomId,
            prompt: action.prompt,
            answer: action.answer,
        });
        const shouldAnalyzeAnswer = hasAnswer && request.autoAnalyzeAnswer !== false;
        const answerAnalysis = shouldAnalyzeAnswer
            ? await this.executeTutorAction({
                userId,
                actionKind: 'analyze_answer',
                atomId,
                prompt: action.prompt,
                answer: action.answer,
            })
            : null;
        const inferredOutcome = request.autoUpdateMasteryFromAnswer === false
            ? null
            : this.inferMasteryOutcomeFromTutorAnalysis(answerAnalysis);
        const effectiveOutcome = request.outcome || inferredOutcome;
        const explicitErrorTag = isNonEmptyString(request.errorTag)
            ? this.normalizeMasteryErrorTag(request.errorTag)
            : null;
        const inferredErrorTag = this.inferMasteryErrorTagFromTutorAnalysis(answerAnalysis, effectiveOutcome);
        const effectiveErrorTag = explicitErrorTag || inferredErrorTag;
        const masterySource = request.outcome
            ? 'explicit'
            : (effectiveOutcome ? 'inferred' : 'none');

        const persistMemory = request.persistMemory !== false;
        let memory: MemoryPolicyResponse | null = null;
        let promotedMemory: MemoryPolicyResponse | null = null;
        let persistedMemoryEntry: MemoryEntry | null = null;
        if (persistMemory) {
            const memoryLayer: MemoryLayer = request.memoryLayer || 'session';
            const memoryKey = `session_action:${atomId}:${this.nextId('session')}`;
            const sourceTag = isNonEmptyString(action.source) ? action.source : 'session_plan';
            const memoryMessage = [
                tutor.message,
                answerAnalysis ? `Answer analysis:\n${answerAnalysis.message}` : '',
                effectiveOutcome ? `Outcome: ${effectiveOutcome}` : '',
                effectiveErrorTag ? `ErrorTag: ${effectiveErrorTag}` : '',
            ]
                .filter((line) => line.length > 0)
                .join('\n\n')
                .slice(0, 1200);
            const memoryConfidenceBase = answerAnalysis
                ? Math.max(tutor.trace.confidence, answerAnalysis.trace.confidence)
                : tutor.trace.confidence;
            const memoryEntry: MemoryEntry = {
                key: memoryKey,
                value: memoryMessage,
                tags: [
                    'session_action',
                    `action_kind:${learningActionKind}`,
                    `action_source:${sourceTag}`,
                    `tutor_action:${tutorActionKind}`,
                    ...(effectiveOutcome ? [`mastery_outcome:${effectiveOutcome}`] : []),
                    ...(effectiveErrorTag ? [`error_tag:${effectiveErrorTag}`] : []),
                ],
                confidence: Number(clamp(memoryConfidenceBase, 0.1, 1).toFixed(4)),
                references: Array.from(new Set([
                    atomId,
                    ...tutor.trace.evidenceSpanIds,
                    tutor.trace.traceId,
                    ...(answerAnalysis ? answerAnalysis.trace.evidenceSpanIds : []),
                    ...(answerAnalysis ? [answerAnalysis.trace.traceId] : []),
                ])),
                createdAt: executedAt,
                updatedAt: executedAt,
                scopeWorkspaceId: atomWorkspace.workspaceId || undefined,
                scopeCorpusId: atomWorkspace.corpusId || undefined,
            };
            persistedMemoryEntry = memoryEntry;
            memory = await this.applyMemoryPolicy({
                userId,
                operation: 'write',
                layer: memoryLayer,
                entries: [memoryEntry],
                now: executedAt,
            });
            if (
                request.autoPromoteMemory === true
                && Number(memoryEntry.confidence || 0) >= clamp(Number(request.promoteMemoryMinConfidence ?? 0.8), 0, 1)
            ) {
                promotedMemory = await this.applyMemoryPolicy({
                    userId,
                    operation: 'promote',
                    layer: memoryLayer,
                    targetLayer: request.promoteMemoryTargetLayer || 'long_term',
                    entries: [memoryEntry],
                    minConfidence: request.promoteMemoryMinConfidence,
                    removeFromSource: request.promoteMemoryRemoveFromSource,
                    now: executedAt,
                });
            }
        }

        let mastery: MasteryDiagnosticsResponse | null = null;
        if (effectiveOutcome) {
            const observationConfidence = answerAnalysis
                ? Number(clamp(answerAnalysis.trace.confidence, 0, 1).toFixed(4))
                : Number(clamp(tutor.trace.confidence, 0, 1).toFixed(4));
            mastery = await this.diagnoseMastery({
                userId,
                observedAt: executedAt,
                observations: [
                    {
                        atomId,
                        outcome: effectiveOutcome,
                        errorTag: effectiveErrorTag || undefined,
                        confidence: observationConfidence,
                    },
                ],
            });
        }
        if (sessionId) {
            this.upsertConversationSessionState({
                sessionId,
                userId,
                mode: 'study_session',
                workspaceId: atomWorkspace.workspaceId,
                corpusId: atomWorkspace.corpusId,
                activeResourceIds: this.resolveSourceResourceIdsForAtomIds([atomId]),
                activeProjectionIds: this.resolveSourceProjectionIdsForAtomIds([atomId]),
                topK: 0,
                queryBackend: null,
                persistMemory,
                memoryNamespace: null,
                exportProfileId: atomWorkspace.exportProfileId,
                panelState: {
                    lastActionAtomId: atomId,
                    lastActionKind: learningActionKind,
                    lastExecutedAt: executedAt,
                    persistedMemoryKey: persistedMemoryEntry?.key || null,
                },
                recordedAt: executedAt,
            });
        }

        this.recordSessionActionTelemetry({
            analyzedAnswer: answerAnalysis !== null,
            persistedMemory: persistMemory,
            masterySource,
            effectiveOutcome,
        });
        await this.persistIfNeeded();

        return {
            sessionId,
            executedAt,
            tutor,
            answerAnalysis,
            memory,
            promotedMemory,
            mastery,
            trace: {
                tutorActionKind,
                persistedMemory: persistMemory,
                updatedMastery: mastery !== null,
                analyzedAnswer: answerAnalysis !== null,
                masterySource,
                effectiveOutcome,
                effectiveErrorTag,
            },
        };
    }

    public async executeStudySessionPlan(
        request: StudySessionPlanExecutionRequest
    ): Promise<StudySessionPlanExecutionResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('StudySessionPlanExecutionAPI requires a non-empty userId.');
        }
        const executionKind = this.normalizeStudySessionExecutionKind(request.executionKind);
        const executedAt = this.resolveTimestamp(request.executedAt);
        const explicitSessionId = isNonEmptyString(request.sessionId) ? request.sessionId.trim() : undefined;
        const maxActions = clamp(Math.floor(Number(request.maxActions) || 12), 1, 80);
        const actionLimitRequest = Number(request.actionLimit);
        const actionLimit = Number.isFinite(actionLimitRequest)
            ? clamp(Math.floor(actionLimitRequest), 1, 40)
            : clamp(Math.min(maxActions, 6), 1, 40);
        const sourceFallback = 'mastery_path';
        const providedPlan = request.sessionPlan;
        const hasValidProvidedPlan = Boolean(
            providedPlan
            && providedPlan.userId === userId
            && Array.isArray(providedPlan.actions)
        );
        const sessionPlan: StudySessionResponse = hasValidProvidedPlan
            ? (() => {
                const plan = providedPlan as StudySessionResponse;
                const safeActions = plan.actions
                    .filter((action): action is StudySessionAction => Boolean(action && typeof action === 'object'))
                    .map((action) => {
                        const sourceRaw = String(action.source || '').trim();
                        const source: StudySessionAction['source'] = (
                            sourceRaw === 'mastery_path'
                            || sourceRaw === 'divergence_path'
                            || sourceRaw === 'retrain_plan'
                            || sourceRaw === 'misconception_remediation'
                            || sourceRaw === 'flashcard_batch'
                        )
                            ? sourceRaw as StudySessionAction['source']
                            : sourceFallback;
                        return {
                            ...action,
                            source,
                        };
                    });
                const totalEstimatedMinutes = safeActions.reduce(
                    (sum, action) => sum + Math.max(0, Math.floor(Number(action.estimatedMinutes || 0))),
                    0
                );
                const evidenceCoverageRatio = safeActions.length > 0
                    ? Number((safeActions.filter((action) => Array.isArray(action.evidenceSpanIds) && action.evidenceSpanIds.length > 0).length / safeActions.length).toFixed(4))
                    : 1;
                return {
                    userId,
                    sessionId: isNonEmptyString(plan.sessionId) ? plan.sessionId : explicitSessionId,
                    generatedAt: isNonEmptyString(plan.generatedAt) ? plan.generatedAt : executedAt,
                    actions: safeActions,
                    signals: {
                        misconceptions: Array.isArray(plan.signals?.misconceptions)
                            ? plan.signals.misconceptions
                            : [],
                        dueRetrainAtoms: Array.isArray(plan.signals?.dueRetrainAtoms)
                            ? plan.signals.dueRetrainAtoms
                            : [],
                        masteryPathTargets: Array.isArray(plan.signals?.masteryPathTargets)
                            ? plan.signals.masteryPathTargets
                            : [],
                        divergenceTargets: Array.isArray(plan.signals?.divergenceTargets)
                            ? plan.signals.divergenceTargets
                            : [],
                    },
                    summary: {
                        totalActions: safeActions.length,
                        totalEstimatedMinutes,
                        evidenceCoverageRatio,
                    },
                };
            })()
            : await this.buildStudySession({
                userId,
                sessionId: explicitSessionId,
                focusAtomIds: request.focusAtomIds,
                maxActions,
                includeDivergence: request.includeDivergence,
                includeRetrain: request.includeRetrain,
                generatedAt: executedAt,
            });
        const sessionId = isNonEmptyString(sessionPlan.sessionId) ? sessionPlan.sessionId : explicitSessionId;
        const selectedActions = sessionPlan.actions.slice(0, actionLimit);
        const comparedAtomIds = Array.from(new Set(
            selectedActions
                .map((action) => String(action.atomId || '').trim())
                .filter((atomId) => atomId.length > 0 && this.activeAtomIds.has(atomId))
        ));
        const baselineMasteryByAtom = new Map<string, number>();
        comparedAtomIds.forEach((atomId) => {
            const stateKey = this.makeLearnerStateKey(userId, atomId);
            const baselineState = this.learnerStates.has(stateKey)
                ? this.normalizeLearnerState(
                    this.learnerStates.get(stateKey) as LearnerConceptState,
                    executedAt
                )
                : this.createDefaultLearnerState(userId, atomId, executedAt);
            baselineMasteryByAtom.set(atomId, baselineState.masteryProbability);
        });
        const stopOnError = request.stopOnError === true;
        const answersByActionId = request.answersByActionId && typeof request.answersByActionId === 'object'
            ? request.answersByActionId
            : {};
        const answersByAtomId = request.answersByAtomId && typeof request.answersByAtomId === 'object'
            ? request.answersByAtomId
            : {};
        const items: StudySessionPlanExecutionResponse['items'] = [];
        let stoppedEarly = false;

        for (const action of selectedActions) {
            const atomId = String(action.atomId || '').trim();
            if (!atomId || !this.activeAtomIds.has(atomId)) {
                items.push({
                    action,
                    status: 'skipped',
                    reason: 'inactive_atom',
                    result: null,
                });
                continue;
            }
            const answerByActionId = isNonEmptyString(answersByActionId[action.id])
                ? String(answersByActionId[action.id]).trim()
                : '';
            const answerByAtomId = isNonEmptyString(answersByAtomId[atomId])
                ? String(answersByAtomId[atomId]).trim()
                : '';
            const answer = answerByActionId || answerByAtomId || undefined;
            try {
                const result = await this.executeStudySessionAction({
                    userId,
                    sessionId,
                    action: {
                        atomId,
                        kind: action.kind,
                        source: action.source,
                        prompt: `Session plan execution: ${action.kind} from ${action.source}`,
                        answer,
                    },
                    autoAnalyzeAnswer: request.autoAnalyzeAnswer,
                    autoUpdateMasteryFromAnswer: request.autoUpdateMasteryFromAnswer,
                    persistMemory: request.persistMemory,
                    memoryLayer: request.memoryLayer,
                    executedAt,
                    autoPromoteMemory: request.autoPromoteMemory,
                    promoteMemoryTargetLayer: request.promoteMemoryTargetLayer,
                    promoteMemoryMinConfidence: request.promoteMemoryMinConfidence,
                    promoteMemoryRemoveFromSource: request.promoteMemoryRemoveFromSource,
                });
                items.push({
                    action,
                    status: 'executed',
                    result,
                });
            } catch (error) {
                const message = String((error as Error)?.message || error || 'Unknown session plan execution error');
                items.push({
                    action,
                    status: 'failed',
                    error: message,
                    result: null,
                });
                if (stopOnError) {
                    stoppedEarly = true;
                    break;
                }
            }
        }

        const executedItems = items.filter(
            (item): item is StudySessionPlanExecutionResponse['items'][number] & { result: StudySessionActionExecutionResponse } =>
                item.status === 'executed' && !!item.result
        );
        const skippedCount = items.filter((item) => item.status === 'skipped').length;
        const failedCount = items.filter((item) => item.status === 'failed').length;
        const updatedMasteryCount = executedItems.filter((item) => item.result.trace.updatedMastery === true).length;
        const inferredMasteryCount = executedItems.filter((item) => item.result.trace.masterySource === 'inferred').length;
        const explicitMasteryCount = executedItems.filter((item) => item.result.trace.masterySource === 'explicit').length;
        const analyzedAnswerCount = executedItems.filter((item) => item.result.trace.analyzedAnswer === true).length;
        const memoryPersistedCount = executedItems.filter((item) => item.result.trace.persistedMemory === true).length;
        const averageTutorConfidence = executedItems.length > 0
            ? Number((
                executedItems.reduce((sum, item) => sum + Number(item.result.tutor.trace.confidence || 0), 0) / executedItems.length
            ).toFixed(4))
            : 0;
        const lastExecutionByAtom = new Map<string, StudySessionActionExecutionResponse>();
        executedItems.forEach((item) => {
            const atomId = String(item.action.atomId || '').trim();
            if (!atomId) {
                return;
            }
            lastExecutionByAtom.set(atomId, item.result);
        });
        const masteryDeltaItems: StudySessionMasteryDeltaItem[] = comparedAtomIds
            .map((atomId) => {
                const stateKey = this.makeLearnerStateKey(userId, atomId);
                const currentState = this.learnerStates.has(stateKey)
                    ? this.normalizeLearnerState(
                        this.learnerStates.get(stateKey) as LearnerConceptState,
                        executedAt
                    )
                    : this.createDefaultLearnerState(userId, atomId, executedAt);
                const beforeMastery = Number((baselineMasteryByAtom.get(atomId) || 0.5).toFixed(6));
                const afterMastery = Number(currentState.masteryProbability.toFixed(6));
                const deltaMastery = Number((afterMastery - beforeMastery).toFixed(6));
                const executionResult = lastExecutionByAtom.get(atomId);
                return {
                    atomId,
                    title: this.atoms.get(atomId)?.title || atomId,
                    beforeMastery,
                    afterMastery,
                    deltaMastery,
                    updatedByExecution: executionResult?.trace.updatedMastery === true,
                    lastOutcome: executionResult?.trace.effectiveOutcome || null,
                };
            })
            .sort((left, right) => Math.abs(right.deltaMastery) - Math.abs(left.deltaMastery));
        const improvedAtomCount = masteryDeltaItems.filter((item) => item.deltaMastery > 0.000001).length;
        const regressedAtomCount = masteryDeltaItems.filter((item) => item.deltaMastery < -0.000001).length;
        const unchangedAtomCount = masteryDeltaItems.length - improvedAtomCount - regressedAtomCount;
        const averageMasteryBefore = masteryDeltaItems.length > 0
            ? Number((
                masteryDeltaItems.reduce((sum, item) => sum + item.beforeMastery, 0) / masteryDeltaItems.length
            ).toFixed(6))
            : 0;
        const averageMasteryAfter = masteryDeltaItems.length > 0
            ? Number((
                masteryDeltaItems.reduce((sum, item) => sum + item.afterMastery, 0) / masteryDeltaItems.length
            ).toFixed(6))
            : 0;
        const averageMasteryDelta = Number((averageMasteryAfter - averageMasteryBefore).toFixed(6));
        const includeRetestPlan = request.includeRetestPlan !== false;
        const retestActionLimit = clamp(Math.floor(Number(request.retestActionLimit) || 6), 1, 24);
        const retestPlanActions: StudySessionAction[] = includeRetestPlan
            ? (() => {
                const retestCandidates = executedItems
                    .map<StudySessionAction | null>((item) => {
                        const atomId = String(item.action.atomId || '').trim();
                        if (!atomId || !this.activeAtomIds.has(atomId)) {
                            return null;
                        }
                        const outcome = item.result.trace.effectiveOutcome;
                        if (outcome !== 'incorrect' && outcome !== 'partial' && outcome !== 'skipped') {
                            return null;
                        }
                        const atom = this.atoms.get(atomId);
                        const kind: LearningActionKind = outcome === 'partial' ? 'quiz' : 'review';
                        const priority = outcome === 'incorrect'
                            ? 108
                            : (outcome === 'partial' ? 96 : 92);
                        const expectedGain = outcome === 'incorrect'
                            ? 0.24
                            : (outcome === 'partial' ? 0.16 : 0.12);
                        const effectiveErrorTag = item.result.trace.effectiveErrorTag || item.action.errorTag;
                        const errorHint = effectiveErrorTag
                            ? ` (focus: ${effectiveErrorTag})`
                            : '';
                        const generatedAction = this.createLearningAction({
                            kind,
                            atomId,
                            priority,
                            expectedGain,
                            rationale: `Immediate retest after ${outcome} outcome${errorHint}.`,
                            evidenceSpanIds: Array.isArray(item.action.evidenceSpanIds) && item.action.evidenceSpanIds.length > 0
                                ? item.action.evidenceSpanIds
                                : (atom?.evidenceSpanIds || []),
                            relationPathAtomIds: [atomId],
                            estimatedMinutes: outcome === 'incorrect' ? 7 : 5,
                        });
                        const retestAction: StudySessionAction = {
                            ...generatedAction,
                            source: 'retrain_plan',
                            ...(effectiveErrorTag ? { errorTag: effectiveErrorTag } : {}),
                        };
                        return retestAction;
                    })
                    .filter((action): action is StudySessionAction => Boolean(action))
                    .sort((left, right) => {
                        if (right.priority !== left.priority) {
                            return right.priority - left.priority;
                        }
                        return right.expectedGain - left.expectedGain;
                    });
                const deduped = new Map<string, StudySessionAction>();
                retestCandidates.forEach((action) => {
                    const signature = `${action.atomId}::${action.kind}`;
                    if (!deduped.has(signature)) {
                        deduped.set(signature, action);
                    }
                });
                return Array.from(deduped.values()).slice(0, retestActionLimit);
            })()
            : [];
        const record: StudySessionExecutionRecord = {
            id: this.nextId('session_exec'),
            userId,
            executionKind,
            executedAt,
            focusAtomIds: comparedAtomIds,
            plannedActions: sessionPlan.actions.length,
            attemptedActions: selectedActions.length,
            executedCount: executedItems.length,
            updatedMasteryCount,
            inferredMasteryCount,
            explicitMasteryCount,
            analyzedAnswerCount,
            memoryPersistedCount,
            averageTutorConfidence,
            averageMasteryDelta,
            improvedAtomCount,
            regressedAtomCount,
            unchangedAtomCount,
            retestActions: retestPlanActions.length,
            stoppedEarly,
        };
        this.sessionExecutionHistory.unshift(record);
        if (this.sessionExecutionHistory.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.sessionExecutionHistory.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
        const sessionPlanQualityRecord = this.evaluateStudySessionPlanQualityInternal({
            request: {
                actionLimit,
                maxActions,
            },
            sessionPlan,
            userId,
            evaluatedAt: executedAt,
            source: 'session_execution',
            executionRecordId: record.id,
            executionKind,
        });
        this.recordStudySessionPlanQualityHistory(sessionPlanQualityRecord);
        const learningQualitySnapshot = await this.captureLearningQualitySnapshot({
            userId,
            sampledAt: executedAt,
        });
        this.recordLearningQualityHistory({
            recordId: this.nextId('learning_quality'),
            userId,
            sampledAt: learningQualitySnapshot.sampledAt,
            source: 'session_execution',
            executionRecordId: record.id,
            executionKind,
            snapshot: this.cloneLearningQualitySnapshot(learningQualitySnapshot.snapshot),
            diagnostics: {
                ...learningQualitySnapshot.diagnostics,
            },
        });
        const scopedWorkspace = this.resolveWorkspaceContextForAtomIds(comparedAtomIds);
        if (sessionId) {
            this.upsertConversationSessionState({
                sessionId,
                userId,
                mode: executionKind === 'custom' ? 'review_plan' : 'study_session',
                workspaceId: scopedWorkspace.workspaceId,
                corpusId: scopedWorkspace.corpusId,
                activeResourceIds: this.resolveSourceResourceIdsForAtomIds(comparedAtomIds),
                activeProjectionIds: this.resolveSourceProjectionIdsForAtomIds(comparedAtomIds),
                topK: actionLimit,
                queryBackend: null,
                persistMemory: request.persistMemory !== false,
                memoryNamespace: null,
                exportProfileId: scopedWorkspace.exportProfileId,
                panelState: {
                    lastExecutionAt: executedAt,
                    lastExecutionKind: executionKind,
                    executedCount: executedItems.length,
                    failedCount,
                    retestActions: retestPlanActions.length,
                },
                recordedAt: executedAt,
            });
        }
        this.recordWorkflowArtifact({
            kind: 'review_plan',
            sessionId: sessionId || null,
            userId,
            workspaceId: scopedWorkspace.workspaceId,
            corpusId: scopedWorkspace.corpusId,
            title: `Session execution ${executionKind} for ${comparedAtomIds[0] || 'global scope'}`,
            sourceAtomIds: comparedAtomIds,
            summary: `Executed ${executedItems.length}/${selectedActions.length} actions with average mastery delta ${averageMasteryDelta}.`,
            payload: {
                summary: {
                    plannedActions: sessionPlan.actions.length,
                    attemptedActions: selectedActions.length,
                    executedCount: executedItems.length,
                    skippedCount,
                    failedCount,
                    averageMasteryDelta,
                    retestActions: retestPlanActions.length,
                },
                masteryDelta: masteryDeltaItems,
            } as Record<string, unknown>,
            recordedAt: executedAt,
        });
        await this.persistIfNeeded();

        return {
            userId,
            sessionId,
            executedAt,
            sessionPlan,
            items,
            summary: {
                plannedActions: sessionPlan.actions.length,
                attemptedActions: selectedActions.length,
                executedCount: executedItems.length,
                skippedCount,
                failedCount,
                updatedMasteryCount,
                inferredMasteryCount,
                explicitMasteryCount,
                analyzedAnswerCount,
                memoryPersistedCount,
                totalEstimatedMinutes: selectedActions.reduce(
                    (sum, action) => sum + Math.max(0, Math.floor(Number(action.estimatedMinutes || 0))),
                    0
                ),
                averageTutorConfidence,
                averageMasteryBefore,
                averageMasteryAfter,
                averageMasteryDelta,
                improvedAtomCount,
                regressedAtomCount,
                unchangedAtomCount,
                stoppedEarly,
            },
            masteryDelta: {
                comparedAtoms: masteryDeltaItems.length,
                averageBefore: averageMasteryBefore,
                averageAfter: averageMasteryAfter,
                averageDelta: averageMasteryDelta,
                improvedCount: improvedAtomCount,
                regressedCount: regressedAtomCount,
                unchangedCount: unchangedAtomCount,
                items: masteryDeltaItems,
            },
            retestPlan: {
                generatedAt: executedAt,
                actions: retestPlanActions,
                summary: {
                    totalActions: retestPlanActions.length,
                    targetAtoms: Array.from(new Set(retestPlanActions.map((action) => action.atomId))),
                },
            },
            record,
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
        const learnerState = this.learnerStates.has(this.makeLearnerStateKey(userId, targetAtom.id))
            ? this.normalizeLearnerState(
                this.learnerStates.get(this.makeLearnerStateKey(userId, targetAtom.id)) as LearnerConceptState,
                nowIso
            )
            : null;
        const dominantErrorTag = learnerState ? this.getDominantErrorTag(learnerState) : null;
        const suggestedActions = this.buildTutorSuggestedActions(targetAtom.id, evidenceSpans, neighbors, dominantErrorTag);
        let message = this.renderTutorMessage({
            actionKind: request.actionKind,
            atom: targetAtom,
            answer: request.answer,
            prompt: request.prompt,
            neighbors,
            evidenceSpans,
            dominantErrorTag,
        });
        let traceSource: TutorTrace['source'] = 'rule-engine';
        let traceConfidence = this.estimateTutorConfidence(request.actionKind, request.answer, targetAtom);
        let traceNotes = dominantErrorTag
            ? `Evidence-first response generated by local rule engine with misconception focus: ${dominantErrorTag}.`
            : 'Evidence-first response generated by local rule engine.';
        let traceEvidenceSpanIds = evidenceSpans.map((span) => span.id);
        let traceAdapterId = 'rule-engine-local';
        let traceProviderName = 'rule-engine';
        let traceProviderMode: TutorTrace['providerMode'] = 'local';
        let traceVerificationStatus: TutorTrace['verificationStatus'] = 'verified';
        let traceProviderAttemptCount = 1;
        let traceFallbackUsed = false;
        let traceFailed = false;
        let traceErrorMessage = '';

        if (this.tutorAdapter) {
            try {
                traceAdapterId = String(request.adapterId || this.tutorAdapter.id || '').trim() || 'configured-tutor-adapter';
                traceProviderName = String(request.providerName || this.tutorAdapter.id || '').trim() || traceAdapterId;
                traceProviderMode = String(request.providerMode || this.tutorAdapter.mode || '').trim() || 'local';
                const adapterResult = await this.tutorAdapter.execute({
                    userId,
                    actionKind: request.actionKind,
                    atom: targetAtom,
                    prompt: request.prompt,
                    answer: request.answer,
                    evidenceSpans,
                    relatedAtomIds: neighbors,
                });
                const adapterMetadata = (
                    adapterResult.metadata && typeof adapterResult.metadata === 'object'
                        ? adapterResult.metadata
                        : {}
                ) as Record<string, unknown>;
                const attemptedProviders = Array.isArray(adapterMetadata.attemptedProviders)
                    ? adapterMetadata.attemptedProviders
                        .map((candidate) => String(candidate || '').trim())
                        .filter(Boolean)
                    : [];
                traceAdapterId = String(
                    adapterResult.adapterId
                    || adapterMetadata.adapterIdHint
                    || request.adapterId
                    || this.tutorAdapter.id
                    || ''
                ).trim() || traceAdapterId;
                traceProviderName = String(
                    adapterResult.providerName
                    || adapterMetadata.selectedProvider
                    || request.providerName
                    || this.tutorAdapter.id
                    || ''
                ).trim() || traceProviderName;
                traceProviderMode = String(
                    adapterResult.providerMode
                    || request.providerMode
                    || this.tutorAdapter.mode
                    || ''
                ).trim() || traceProviderMode;
                traceProviderAttemptCount = Math.max(1, attemptedProviders.length || traceProviderAttemptCount);
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
                    traceVerificationStatus = 'verified';
                } else {
                    const evidenceHint = evidenceSpans[0]?.snippet || targetAtom.content.slice(0, 220);
                    message = [
                        'Low-confidence tutor output detected. Treat this as unverified guidance.',
                        `Evidence-first fallback: ${evidenceHint}`,
                        'Please verify the answer against cited source fragments before accepting it.',
                    ].join('\n');
                    traceNotes = `Adapter response downgraded from ${traceProviderName} (confidence=${adapterConfidence.toFixed(4)}, evidenceBindings=${adapterEvidenceSpanIds.length}).`;
                    traceVerificationStatus = 'pending';
                    traceFallbackUsed = true;
                }
            } catch (error) {
                traceSource = 'llm-adapter';
                traceConfidence = 0.2;
                traceVerificationStatus = 'failed';
                traceFallbackUsed = true;
                traceFailed = true;
                traceErrorMessage = String((error as Error)?.message || error || 'unknown_error');
                traceNotes = `Adapter execution failed and fallback was used: ${traceErrorMessage}`;
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
            adapterId: traceAdapterId,
            providerName: traceProviderName,
            providerMode: traceProviderMode,
            verificationStatus: traceVerificationStatus,
            providerAttemptCount: traceProviderAttemptCount,
            fallbackUsed: traceFallbackUsed,
            failed: traceFailed,
            errorMessage: traceErrorMessage || undefined,
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
                    entries[index] = this.buildGovernedMemoryEntry({
                        entry: {
                            ...incomingEntry,
                            updatedAt: nowIso,
                        },
                        previous: entries[index],
                    });
                    this.appendMemoryAuditRecord({
                        userId,
                        operation: 'write',
                        layer,
                        entry: entries[index],
                        reason: 'memory_policy_write:update',
                        recordedAt: nowIso,
                    });
                } else {
                    const governedEntry = this.buildGovernedMemoryEntry({
                        entry: {
                            ...incomingEntry,
                            createdAt: incomingEntry.createdAt || nowIso,
                            updatedAt: nowIso,
                        },
                    });
                    entries.push(governedEntry);
                    this.appendMemoryAuditRecord({
                        userId,
                        operation: 'write',
                        layer,
                        entry: governedEntry,
                        reason: 'memory_policy_write:create',
                        recordedAt: nowIso,
                    });
                }
            }
            const eviction = this.evictMemoryLayerDetailed(bank, layer, nowIso);
            evictedCount = eviction.evictedCount;
            eviction.evictedEntries.forEach((entry) => {
                this.appendMemoryAuditRecord({
                    userId,
                    operation: 'evict',
                    layer,
                    entry,
                    reason: 'memory_policy_write:capacity_or_expiry',
                    recordedAt: nowIso,
                });
            });
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
            const eviction = this.evictMemoryLayerDetailed(bank, layer, nowIso);
            evictedCount = eviction.evictedCount;
            eviction.evictedEntries.forEach((entry) => {
                this.appendMemoryAuditRecord({
                    userId,
                    operation: 'evict',
                    layer,
                    entry,
                    reason: 'memory_policy_evict:manual',
                    recordedAt: nowIso,
                });
            });
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
            const minConfidence = clamp(Number(request.minConfidence ?? 0), 0, 1);
            const includeExpired = request.includeExpired === true;
            const queryTokens = tokenize(String(request.query || ''));
            const requiredTokenHits = queryTokens.length <= 1
                ? queryTokens.length
                : Math.max(1, Math.ceil(queryTokens.length * 0.5));
            const selectedEntries = bank[layer]
                .filter((entry) => {
                    if (!includeExpired) {
                        const expiresAt = this.resolveOptionalTimestamp(entry.expiresAt);
                        if (expiresAt && Date.parse(expiresAt) <= Date.parse(nowIso)) {
                            return false;
                        }
                    }
                    if (Number(entry.confidence || 0) < minConfidence) {
                        return false;
                    }
                    if (!queryTokens.length) {
                        return true;
                    }
                    const haystack = normalizeWhitespace([
                        entry.key,
                        entry.value,
                        ...(entry.tags || []),
                        ...(entry.references || []),
                    ].join(' ')).toLowerCase();
                    const tokenHits = queryTokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
                    return tokenHits >= requiredTokenHits;
                })
                .sort((left, right) => {
                    const leftHaystack = normalizeWhitespace([
                        left.key,
                        left.value,
                        ...(left.tags || []),
                        ...(left.references || []),
                    ].join(' ')).toLowerCase();
                    const rightHaystack = normalizeWhitespace([
                        right.key,
                        right.value,
                        ...(right.tags || []),
                        ...(right.references || []),
                    ].join(' ')).toLowerCase();
                    const leftTokenHits = queryTokens.reduce((count, token) => count + (leftHaystack.includes(token) ? 1 : 0), 0);
                    const rightTokenHits = queryTokens.reduce((count, token) => count + (rightHaystack.includes(token) ? 1 : 0), 0);
                    const leftScore = leftTokenHits + Number(left.confidence || 0) + computeGovernedMemoryWeight(left);
                    const rightScore = rightTokenHits + Number(right.confidence || 0) + computeGovernedMemoryWeight(right);
                    if (rightScore !== leftScore) {
                        return rightScore - leftScore;
                    }
                    return right.updatedAt.localeCompare(left.updatedAt);
                })
                .slice(0, limit);
            selectedEntries.forEach((entry) => {
                this.appendMemoryAuditRecord({
                    userId,
                    operation: 'read',
                    layer,
                    entry,
                    reason: queryTokens.length > 0 ? `memory_policy_read:${queryTokens.join('|')}` : 'memory_policy_read:snapshot',
                    recordedAt: nowIso,
                });
            });
            return {
                layer,
                operation,
                entries: selectedEntries,
                evictedCount: 0,
                stats: this.collectMemoryStats(),
            };
        }

        if (operation === 'promote') {
            const targetLayer = request.targetLayer || (layer === 'session' ? 'unit' : 'long_term');
            const minConfidence = clamp(Number(request.minConfidence ?? 0.75), 0, 1);
            const removeFromSource = request.removeFromSource === true && targetLayer !== layer;
            const queryTokens = tokenize(String(request.query || ''));
            const requestedKeys = new Set(
                (Array.isArray(request.entries) ? request.entries : [])
                    .map((entry) => String(entry?.key || '').trim())
                    .filter(Boolean)
            );
            const sourceEntries = bank[layer]
                .filter((entry) => Number(entry.confidence || 0) >= minConfidence)
                .filter((entry) => {
                    if (requestedKeys.size > 0) {
                        return requestedKeys.has(entry.key);
                    }
                    if (queryTokens.length <= 0) {
                        return true;
                    }
                    const haystack = normalizeWhitespace([
                        entry.key,
                        entry.value,
                        ...(entry.tags || []),
                        ...(entry.references || []),
                    ].join(' ')).toLowerCase();
                    return queryTokens.some((token) => haystack.includes(token));
                });
            const targetEntries = bank[targetLayer];
            sourceEntries.forEach((entry) => {
                const index = targetEntries.findIndex((candidate) => candidate.key === entry.key);
                const promotedEntry = this.buildGovernedMemoryEntry({
                    entry: {
                        ...entry,
                        tags: Array.from(new Set([...(entry.tags || []), `promoted_from:${layer}`])),
                        updatedAt: nowIso,
                    },
                    previous: index >= 0 ? targetEntries[index] : null,
                    fallbackScopeWorkspaceId: entry.scopeWorkspaceId,
                    fallbackScopeCorpusId: entry.scopeCorpusId,
                });
                if (index >= 0) {
                    targetEntries[index] = promotedEntry;
                } else {
                    targetEntries.push(promotedEntry);
                }
                this.appendMemoryAuditRecord({
                    userId,
                    operation: 'promote',
                    layer: targetLayer,
                    entry: promotedEntry,
                    reason: `memory_policy_promote:${layer}_to_${targetLayer}`,
                    recordedAt: nowIso,
                });
            });
            if (removeFromSource && sourceEntries.length > 0) {
                const promotedKeys = new Set(sourceEntries.map((entry) => entry.key));
                bank[layer] = bank[layer].filter((entry) => !promotedKeys.has(entry.key));
            }
            const targetEviction = this.evictMemoryLayerDetailed(bank, targetLayer, nowIso);
            targetEviction.evictedEntries.forEach((entry) => {
                this.appendMemoryAuditRecord({
                    userId,
                    operation: 'evict',
                    layer: targetLayer,
                    entry,
                    reason: 'memory_policy_promote:capacity_or_expiry',
                    recordedAt: nowIso,
                });
            });
            const sourceEviction = removeFromSource ? this.evictMemoryLayerDetailed(bank, layer, nowIso) : { evictedCount: 0, evictedEntries: [] as MemoryEntry[] };
            sourceEviction.evictedEntries.forEach((entry) => {
                this.appendMemoryAuditRecord({
                    userId,
                    operation: 'evict',
                    layer,
                    entry,
                    reason: 'memory_policy_promote:source_cleanup',
                    recordedAt: nowIso,
                });
            });
            evictedCount = targetEviction.evictedCount + sourceEviction.evictedCount;
            const response: MemoryPolicyResponse = {
                layer: targetLayer,
                operation,
                entries: [...bank[targetLayer]],
                evictedCount,
                stats: this.collectMemoryStats(),
            };
            await this.persistIfNeeded();
            return response;
        }

        if (operation === 'retrain_plan') {
            const limit = clamp(Math.floor(Number(request.limit) || 8), 1, 40);
            const nowTime = Date.parse(nowIso);
            const dueStates = Array.from(this.learnerStates.values())
                .filter((state) => state.userId === userId)
                .map((state) => this.normalizeLearnerState(state, nowIso))
                .filter((state) => {
                    const nextReviewAtTime = Date.parse(state.nextReviewAt);
                    if (!Number.isFinite(nextReviewAtTime)) {
                        return true;
                    }
                    return nextReviewAtTime <= nowTime;
                })
                .sort((left, right) => {
                    const leftGap = 1 - left.masteryProbability;
                    const rightGap = 1 - right.masteryProbability;
                    if (rightGap !== leftGap) {
                        return rightGap - leftGap;
                    }
                    return left.nextReviewAt.localeCompare(right.nextReviewAt);
                })
                .slice(0, limit);

            const recommendedActions = dueStates.flatMap((state, index) => {
                const expectedGain = Number(clamp((1 - state.masteryProbability) * 0.65, 0.05, 0.85).toFixed(4));
                return this.buildMasteryActions(
                    state.atomId,
                    expectedGain,
                    index + 1,
                    this.getDominantErrorTag(state)
                ).slice(0, 2);
            });

            return {
                layer,
                operation,
                entries: [],
                evictedCount: 0,
                recommendedActions,
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
        const historyWindowAverageMasteryDeltaUplift = Number(
            (
                Number(current.historyWindowAverageMasteryDelta || 0)
                - Number(baseline.historyWindowAverageMasteryDelta || 0)
            ).toFixed(6)
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
                gateId: 'history_mastery_delta_uplift',
                passed: historyWindowAverageMasteryDeltaUplift >= thresholds.historyWindowAverageMasteryDeltaUplift,
                comparator: '>=',
                observedValue: historyWindowAverageMasteryDeltaUplift,
                threshold: thresholds.historyWindowAverageMasteryDeltaUplift,
                unit: 'pct',
                message: 'Recent session-history mastery delta should show positive uplift.',
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
                historyWindowAverageMasteryDeltaUplift,
            },
            gates,
            overallPassed: gates.every((gate) => gate.passed),
        };
    }

    public async captureLearningQualitySnapshot(
        request: LearningQualitySnapshotRequest
    ): Promise<LearningQualitySnapshotResponse> {
        await this.ensureHydrated();
        const sampledAt = this.resolveTimestamp(request.sampledAt);
        const userId = isNonEmptyString(request.userId) ? request.userId.trim() : null;
        const historyWindowDays = Math.floor(clamp(Number(request.historyWindowDays || 14), 1, 180));
        const sampledAtMs = Date.parse(sampledAt);
        const historyWindowStartMs = sampledAtMs - historyWindowDays * 24 * 60 * 60 * 1000;
        const scopedStates = Array.from(this.learnerStates.values())
            .filter((state) => !userId || state.userId === userId)
            .map((state) => this.normalizeLearnerState(state, sampledAt));
        const totalReviews = scopedStates.reduce((sum, state) => sum + state.reviewCount, 0);
        const totalCorrect = scopedStates.reduce((sum, state) => sum + state.correctCount, 0);
        const retestPassRatePct = Number(
            clamp((totalCorrect / Math.max(1, totalReviews)) * 100, 0, 100).toFixed(4)
        );

        const misconceptionEvents = scopedStates.reduce((sum, state) =>
            sum + state.errorTagStats.reduce((subSum, item) => subSum + Math.max(0, Math.floor(Number(item.count || 0))), 0),
        0);
        const recurrentMisconceptionEvents = scopedStates.reduce((sum, state) =>
            sum + state.errorTagStats.reduce((subSum, item) => {
                const count = Math.max(0, Math.floor(Number(item.count || 0)));
                return subSum + Math.max(0, count - 1);
            }, 0),
        0);
        const misconceptionRecurrenceRatePct = Number(
            clamp((recurrentMisconceptionEvents / Math.max(1, misconceptionEvents)) * 100, 0, 100).toFixed(4)
        );

        const scopedTraces = this.tutorTraces.filter((trace) => !userId || trace.userId === userId);
        const evidenceBackedTutorTraces = scopedTraces.filter((trace) => trace.evidenceSpanIds.length > 0).length;
        const evidenceBackedSuggestionRatioPct = Number(
            clamp((evidenceBackedTutorTraces / Math.max(1, scopedTraces.length)) * 100, 0, 100).toFixed(4)
        );

        const masteryGaps = scopedStates.length > 0
            ? scopedStates.map((state) => 1 - state.masteryProbability)
            : [0.5];
        const averageGap = masteryGaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, masteryGaps.length);
        const averagePathMasteryGainPct = Number(clamp(averageGap * 36, 0, 100).toFixed(4));
        const randomPathMasteryGainPct = Number(clamp(averageGap * 22, 0, 100).toFixed(4));
        const scopedHistoryRecords = this.sessionExecutionHistory.filter((record) => {
            if (userId && record.userId !== userId) {
                return false;
            }
            const executedAtMs = Date.parse(record.executedAt);
            if (!Number.isFinite(executedAtMs)) {
                return false;
            }
            return executedAtMs >= historyWindowStartMs && executedAtMs <= sampledAtMs;
        });
        const historyWindowRecords = scopedHistoryRecords.length;
        const historyWindowAverageMasteryDelta = historyWindowRecords > 0
            ? Number(
                (
                    scopedHistoryRecords.reduce((sum, record) => sum + Number(record.averageMasteryDelta || 0), 0)
                    / historyWindowRecords
                ).toFixed(6)
            )
            : 0;
        const scopedRetestHistoryRecords = scopedHistoryRecords.filter((record) => record.executionKind === 'retest');
        const historyWindowRetestPositiveDeltaRatePct = Number(
            clamp(
                (
                    scopedRetestHistoryRecords.filter((record) => Number(record.averageMasteryDelta || 0) > 0).length
                    / Math.max(1, scopedRetestHistoryRecords.length)
                ) * 100,
                0,
                100
            ).toFixed(4)
        );
        const pendingVerificationRatioPct = Number(
            clamp(
                (
                    scopedTraces.filter((trace) => String(trace.verificationStatus || '').trim() === 'pending').length
                    / Math.max(1, scopedTraces.length)
                ) * 100,
                0,
                100
            ).toFixed(4)
        );
        const queryTelemetry = this.buildRetrievalTelemetry();
        const queryP95Ms = this.buildRetrievalTelemetry().queryP95Ms;
        const queryBackendFallbackRatioPct = Number(
            clamp(
                (this.queryBackendFallbackCount / Math.max(1, queryTelemetry.queryCount)) * 100,
                0,
                100
            ).toFixed(4)
        );
        const sessionMemoryPromotionCoveragePct = Number(
            clamp(
                (
                    Number(this.sessionActionTelemetry.memoryPersistedCount || 0)
                    / Math.max(1, Number(this.sessionActionTelemetry.executionCount || 0))
                ) * 100,
                0,
                100
            ).toFixed(4)
        );

        return {
            sampledAt,
            snapshot: {
                retestPassRatePct,
                misconceptionRecurrenceRatePct,
                evidenceBackedSuggestionRatioPct,
                averagePathMasteryGainPct,
                randomPathMasteryGainPct,
                historyWindowDays,
                historyWindowRecords,
                historyWindowAverageMasteryDelta,
                historyWindowRetestPositiveDeltaRatePct,
                queryP95Ms,
                pendingVerificationRatioPct,
                queryBackendFallbackRatioPct,
                sessionMemoryPromotionCoveragePct,
            },
            diagnostics: {
                learnerStates: scopedStates.length,
                totalReviews,
                misconceptionEvents,
                evidenceBackedTutorTraces,
                totalTutorTraces: scopedTraces.length,
                historyWindowRecords,
                historyWindowRetestRecords: scopedRetestHistoryRecords.length,
            },
        };
    }

    public async getLearningQualityBaseline(
        request: LearningQualityBaselineGetRequest
    ): Promise<LearningQualityBaselineResponse> {
        await this.ensureHydrated();
        const userId = String(request?.userId || '').trim();
        if (!userId) {
            throw new Error('learning_quality_baseline_user_id_required');
        }
        const baseline = this.learningQualityBaselines.get(userId);
        return {
            userId,
            found: Boolean(baseline),
            storedAt: baseline?.storedAt || null,
            snapshot: baseline ? this.cloneLearningQualitySnapshot(baseline.snapshot) : null,
        };
    }

    public async setLearningQualityBaseline(
        request: LearningQualityBaselineSetRequest
    ): Promise<LearningQualityBaselineResponse> {
        await this.ensureHydrated();
        const userId = String(request?.userId || '').trim();
        if (!userId) {
            throw new Error('learning_quality_baseline_user_id_required');
        }
        if (!request?.snapshot || typeof request.snapshot !== 'object') {
            throw new Error('learning_quality_baseline_snapshot_required');
        }
        const fallbackQueryP95Ms = this.buildRetrievalTelemetry().queryP95Ms;
        const normalizedSnapshot = this.normalizeLearningQualitySnapshot(
            request.snapshot,
            fallbackQueryP95Ms
        );
        const storedAt = this.resolveTimestamp(request.storedAt);
        this.learningQualityBaselines.set(userId, {
            snapshot: this.cloneLearningQualitySnapshot(normalizedSnapshot),
            storedAt,
        });
        return {
            userId,
            found: true,
            storedAt,
            snapshot: this.cloneLearningQualitySnapshot(normalizedSnapshot),
        };
    }

    public async clearLearningQualityBaseline(
        request: LearningQualityBaselineClearRequest
    ): Promise<LearningQualityBaselineResponse> {
        await this.ensureHydrated();
        const userId = String(request?.userId || '').trim();
        if (!userId) {
            throw new Error('learning_quality_baseline_user_id_required');
        }
        this.learningQualityBaselines.delete(userId);
        return {
            userId,
            found: false,
            storedAt: null,
            snapshot: null,
        };
    }

    public async evaluateLearningQualityAgainstBaseline(
        request: LearningQualityBaselineEvaluateRequest
    ): Promise<LearningQualityBaselineEvaluateResponse> {
        await this.ensureHydrated();
        const userId = String(request?.userId || '').trim();
        if (!userId) {
            throw new Error('learning_quality_baseline_user_id_required');
        }

        const baseline = await this.getLearningQualityBaseline({ userId });
        if (!baseline.found || !baseline.snapshot) {
            throw new Error('learning_quality_baseline_not_found');
        }

        const currentSnapshot = request.current && typeof request.current === 'object'
            ? {
                sampledAt: this.resolveTimestamp(request.sampledAt),
                snapshot: this.normalizeLearningQualitySnapshot(
                    request.current,
                    this.buildRetrievalTelemetry().queryP95Ms
                ),
                diagnostics: {
                    learnerStates: 0,
                    totalReviews: 0,
                    misconceptionEvents: 0,
                    evidenceBackedTutorTraces: 0,
                    totalTutorTraces: 0,
                    historyWindowRecords: 0,
                    historyWindowRetestRecords: 0,
                },
            } as LearningQualitySnapshotResponse
            : await this.captureLearningQualitySnapshot({
                userId,
                sampledAt: request.sampledAt,
                historyWindowDays: request.historyWindowDays,
            });

        const evaluation = await this.evaluateLearningQuality({
            baseline: baseline.snapshot,
            current: currentSnapshot.snapshot,
            thresholds: request.thresholds,
            evaluatedAt: request.sampledAt,
        });

        return {
            userId,
            baseline,
            currentSnapshot,
            evaluation,
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
            sessionActionTelemetry: this.buildSessionActionTelemetry(),
            sessionExecutionHistoryRecords: this.sessionExecutionHistory.length,
            memoryEntries: memoryStats,
        };
    }

    private recordSessionActionTelemetry(params: {
        analyzedAnswer: boolean;
        persistedMemory: boolean;
        masterySource: 'explicit' | 'inferred' | 'none';
        effectiveOutcome: MasteryOutcome | null;
    }): void {
        this.sessionActionTelemetry.executionCount += 1;
        if (params.analyzedAnswer) {
            this.sessionActionTelemetry.analyzedAnswerCount += 1;
        }
        if (params.persistedMemory) {
            this.sessionActionTelemetry.memoryPersistedCount += 1;
        }
        if (params.masterySource === 'explicit') {
            this.sessionActionTelemetry.explicitMasteryUpdateCount += 1;
        } else if (params.masterySource === 'inferred') {
            this.sessionActionTelemetry.inferredMasteryUpdateCount += 1;
        }
        if (params.effectiveOutcome) {
            const outcomeKey = params.effectiveOutcome;
            this.sessionActionTelemetry.outcomeCounts[outcomeKey] += 1;
        }
    }

    private buildSessionActionTelemetry(): KnowledgeSystemState['sessionActionTelemetry'] {
        return {
            executionCount: Math.max(0, Math.floor(Number(this.sessionActionTelemetry.executionCount || 0))),
            analyzedAnswerCount: Math.max(0, Math.floor(Number(this.sessionActionTelemetry.analyzedAnswerCount || 0))),
            inferredMasteryUpdateCount: Math.max(
                0,
                Math.floor(Number(this.sessionActionTelemetry.inferredMasteryUpdateCount || 0))
            ),
            explicitMasteryUpdateCount: Math.max(
                0,
                Math.floor(Number(this.sessionActionTelemetry.explicitMasteryUpdateCount || 0))
            ),
            memoryPersistedCount: Math.max(0, Math.floor(Number(this.sessionActionTelemetry.memoryPersistedCount || 0))),
            outcomeCounts: {
                correct: Math.max(0, Math.floor(Number(this.sessionActionTelemetry.outcomeCounts.correct || 0))),
                partial: Math.max(0, Math.floor(Number(this.sessionActionTelemetry.outcomeCounts.partial || 0))),
                incorrect: Math.max(0, Math.floor(Number(this.sessionActionTelemetry.outcomeCounts.incorrect || 0))),
                skipped: Math.max(0, Math.floor(Number(this.sessionActionTelemetry.outcomeCounts.skipped || 0))),
            },
        };
    }

    private normalizeSessionActionTelemetry(
        value: Partial<KnowledgeSystemState['sessionActionTelemetry']> | undefined
    ): KnowledgeSystemState['sessionActionTelemetry'] {
        const fallback = createEmptySessionActionTelemetry();
        const source = value || {};
        return {
            executionCount: Math.max(0, Math.floor(Number(source.executionCount || 0))),
            analyzedAnswerCount: Math.max(0, Math.floor(Number(source.analyzedAnswerCount || 0))),
            inferredMasteryUpdateCount: Math.max(0, Math.floor(Number(source.inferredMasteryUpdateCount || 0))),
            explicitMasteryUpdateCount: Math.max(0, Math.floor(Number(source.explicitMasteryUpdateCount || 0))),
            memoryPersistedCount: Math.max(0, Math.floor(Number(source.memoryPersistedCount || 0))),
            outcomeCounts: {
                correct: Math.max(0, Math.floor(Number(source.outcomeCounts?.correct ?? fallback.outcomeCounts.correct))),
                partial: Math.max(0, Math.floor(Number(source.outcomeCounts?.partial ?? fallback.outcomeCounts.partial))),
                incorrect: Math.max(0, Math.floor(Number(source.outcomeCounts?.incorrect ?? fallback.outcomeCounts.incorrect))),
                skipped: Math.max(0, Math.floor(Number(source.outcomeCounts?.skipped ?? fallback.outcomeCounts.skipped))),
            },
        };
    }

    private normalizeStudySessionExecutionKind(value: unknown): StudySessionExecutionRecord['executionKind'] {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'retest') {
            return 'retest';
        }
        if (normalized === 'custom') {
            return 'custom';
        }
        return 'session';
    }

    private normalizeSessionExecutionRecord(
        value: Partial<StudySessionExecutionRecord> | undefined,
        fallbackExecutedAt: string
    ): StudySessionExecutionRecord | null {
        if (!value || typeof value !== 'object') {
            return null;
        }
        const userId = String(value.userId || '').trim();
        if (!userId) {
            return null;
        }
        const executedAt = isNonEmptyString(value.executedAt) ? value.executedAt : fallbackExecutedAt;
        const focusAtomIds = Array.isArray(value.focusAtomIds)
            ? Array.from(
                new Set(
                    value.focusAtomIds
                        .map((atomId) => String(atomId || '').trim())
                        .filter((atomId) => atomId.length > 0)
                )
            ).slice(0, 120)
            : [];
        const fallbackIdSeed = `${userId}:${executedAt}:${Math.floor(Number(value.executedCount || 0))}`;
        const fallbackId = `session_exec_restored_${createHash('sha1').update(fallbackIdSeed).digest('hex').slice(0, 12)}`;
        return {
            id: isNonEmptyString(value.id) ? value.id : fallbackId,
            userId,
            executionKind: this.normalizeStudySessionExecutionKind(value.executionKind),
            executedAt,
            focusAtomIds,
            plannedActions: Math.max(0, Math.floor(Number(value.plannedActions || 0))),
            attemptedActions: Math.max(0, Math.floor(Number(value.attemptedActions || 0))),
            executedCount: Math.max(0, Math.floor(Number(value.executedCount || 0))),
            updatedMasteryCount: Math.max(0, Math.floor(Number(value.updatedMasteryCount || 0))),
            inferredMasteryCount: Math.max(0, Math.floor(Number(value.inferredMasteryCount || 0))),
            explicitMasteryCount: Math.max(0, Math.floor(Number(value.explicitMasteryCount || 0))),
            analyzedAnswerCount: Math.max(0, Math.floor(Number(value.analyzedAnswerCount || 0))),
            memoryPersistedCount: Math.max(0, Math.floor(Number(value.memoryPersistedCount || 0))),
            averageTutorConfidence: Number(clamp(Number(value.averageTutorConfidence || 0), 0, 1).toFixed(6)),
            averageMasteryDelta: Number(clamp(Number(value.averageMasteryDelta || 0), -1, 1).toFixed(6)),
            improvedAtomCount: Math.max(0, Math.floor(Number(value.improvedAtomCount || 0))),
            regressedAtomCount: Math.max(0, Math.floor(Number(value.regressedAtomCount || 0))),
            unchangedAtomCount: Math.max(0, Math.floor(Number(value.unchangedAtomCount || 0))),
            retestActions: Math.max(0, Math.floor(Number(value.retestActions || 0))),
            stoppedEarly: value.stoppedEarly === true,
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
        const clampRatio = (value: number): number => Number(clamp(Number(value || 0), -1, 1).toFixed(6));
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
            historyWindowDays: Math.floor(clamp(Number(snapshot.historyWindowDays || 14), 1, 180)),
            historyWindowRecords: Math.max(0, Math.floor(Number(snapshot.historyWindowRecords || 0))),
            historyWindowAverageMasteryDelta: clampRatio(Number(snapshot.historyWindowAverageMasteryDelta || 0)),
            historyWindowRetestPositiveDeltaRatePct: clampPct(Number(snapshot.historyWindowRetestPositiveDeltaRatePct || 0)),
            queryP95Ms: resolvedQueryP95Ms,
        };
    }

    private cloneLearningQualitySnapshot(snapshot: LearningQualitySnapshot): LearningQualitySnapshot {
        const clone: LearningQualitySnapshot = {
            retestPassRatePct: Number(snapshot.retestPassRatePct),
            misconceptionRecurrenceRatePct: Number(snapshot.misconceptionRecurrenceRatePct),
            evidenceBackedSuggestionRatioPct: Number(snapshot.evidenceBackedSuggestionRatioPct),
            averagePathMasteryGainPct: Number(snapshot.averagePathMasteryGainPct),
            randomPathMasteryGainPct: Number(snapshot.randomPathMasteryGainPct),
        };
        const copyOptional = <K extends keyof LearningQualitySnapshot>(key: K) => {
            const value = snapshot[key];
            if (value === undefined || value === null) {
                return;
            }
            (clone as any)[key] = Number(value);
        };
        copyOptional('historyWindowDays');
        copyOptional('historyWindowRecords');
        copyOptional('historyWindowAverageMasteryDelta');
        copyOptional('historyWindowRetestPositiveDeltaRatePct');
        copyOptional('queryP95Ms');
        copyOptional('pathStrategyExecutionCoveragePct');
        copyOptional('pathStrategyAverageMasteryDeltaPct');
        copyOptional('queryEvidenceCoverageRatioPct');
        copyOptional('queryRelationPathCoverageRatioPct');
        copyOptional('queryTemporalValidityPassRatioPct');
        copyOptional('pendingVerificationRatioPct');
        copyOptional('queryBackendFallbackRatioPct');
        copyOptional('sessionMemoryPromotionCoveragePct');
        return clone;
    }

    private cloneAgentConversationAssistantBlocks(
        blocks: AgentConversationAssistantBlock[] | undefined
    ): AgentConversationAssistantBlock[] {
        if (!Array.isArray(blocks) || blocks.length <= 0) {
            return [];
        }
        return blocks.map((block) => {
            if (!block || typeof block !== 'object') {
                return {
                    blockId: 'assistant_block_unknown',
                    type: 'system_notice',
                    text: '',
                } satisfies AgentConversationAssistantBlock;
            }
            switch (block.type) {
                case 'structured_answer':
                    return {
                        blockId: String(block.blockId || 'assistant_block_structured_answer'),
                        type: 'structured_answer',
                        title: typeof block.title === 'string' ? block.title : undefined,
                        directAnswer: String(block.directAnswer || ''),
                        overviewMarkdown: typeof block.overviewMarkdown === 'string' ? block.overviewMarkdown : undefined,
                        explanationMarkdown: typeof block.explanationMarkdown === 'string' ? block.explanationMarkdown : undefined,
                        evidenceMarkdown: typeof block.evidenceMarkdown === 'string' ? block.evidenceMarkdown : undefined,
                        nextActionsMarkdown: typeof block.nextActionsMarkdown === 'string' ? block.nextActionsMarkdown : undefined,
                        knowledgePointCount: Number.isFinite(Number(block.knowledgePointCount)) ? Number(block.knowledgePointCount) : 0,
                        citationCount: Number.isFinite(Number(block.citationCount)) ? Number(block.citationCount) : 0,
                        recalledMemoryCount: Number.isFinite(Number(block.recalledMemoryCount)) ? Number(block.recalledMemoryCount) : 0,
                    } satisfies AgentConversationAssistantBlock;
                case 'main_markdown':
                    return {
                        blockId: String(block.blockId || 'assistant_block_markdown'),
                        type: 'main_markdown',
                        markdown: String(block.markdown || ''),
                    } satisfies AgentConversationAssistantBlock;
                case 'system_notice':
                    return {
                        blockId: String(block.blockId || 'assistant_block_notice'),
                        type: 'system_notice',
                        text: String(block.text || ''),
                    } satisfies AgentConversationAssistantBlock;
                case 'html_artifact':
                    return {
                        blockId: String(block.blockId || 'assistant_block_html'),
                        type: 'html_artifact',
                        title: typeof block.title === 'string' ? block.title : undefined,
                        summary: typeof block.summary === 'string' ? block.summary : undefined,
                        html: String(block.html || ''),
                    } satisfies AgentConversationAssistantBlock;
                case 'citations':
                    return {
                        blockId: String(block.blockId || 'assistant_block_citations'),
                        type: 'citations',
                        title: typeof block.title === 'string' ? block.title : undefined,
                        citations: Array.isArray(block.citations)
                            ? block.citations.map((citation) => ({ ...citation }))
                            : [],
                    } satisfies AgentConversationAssistantBlock;
                case 'knowledge_actions':
                    return {
                        blockId: String(block.blockId || 'assistant_block_actions'),
                        type: 'knowledge_actions',
                        title: typeof block.title === 'string' ? block.title : undefined,
                        atomIds: Array.isArray(block.atomIds)
                            ? block.atomIds.map((atomId) => String(atomId || '')).filter(Boolean)
                            : [],
                    } satisfies AgentConversationAssistantBlock;
                case 'knowledge_run_summary':
                    return {
                        blockId: String(block.blockId || 'assistant_block_knowledge_run'),
                        type: 'knowledge_run_summary',
                        title: typeof block.title === 'string' ? block.title : undefined,
                        artifactId: typeof block.artifactId === 'string' ? block.artifactId : undefined,
                        knowledgeRun: this.cloneKnowledgeRun(block.knowledgeRun),
                    } satisfies AgentConversationAssistantBlock;
                default:
                    return {
                        blockId: String((block as AgentConversationAssistantBlock).blockId || 'assistant_block_unknown'),
                        type: 'system_notice',
                        text: '',
                    } satisfies AgentConversationAssistantBlock;
            }
        });
    }

    private cloneKnowledgeRun(run: KnowledgeRun | undefined): KnowledgeRun {
        const safeRun = run || {
            runId: 'knowledge_run_unknown',
            generatedAt: new Date(0).toISOString(),
            status: 'fail',
            scope: {
                source: 'global',
                workspaceId: null,
                corpusId: null,
                documentIds: [],
                atomIds: [],
                sourcePathPrefixes: [],
                languages: [],
                matchedAtomCount: 0,
            },
            evidenceClaims: [],
            quality: {
                score: 0,
                status: 'fail',
                gates: [],
            },
            reviewCards: [],
            reviewState: {
                consumedCardIds: [],
                completedReviewCardCount: 0,
                remainingReviewCardCount: 0,
                completedAt: null,
            },
            summary: {
                claimCount: 0,
                verifiedClaimCount: 0,
                weakClaimCount: 0,
                notProvenClaimCount: 0,
                rejectedClaimCount: 0,
                reviewCardCount: 0,
                completedReviewCardCount: 0,
                remainingReviewCardCount: 0,
            },
        } satisfies KnowledgeRun;
        const reviewCards = safeRun.reviewCards.map((card) => ({
            ...card,
            evidenceRefs: [...card.evidenceRefs],
        }));
        const reviewState = this.buildKnowledgeRunReviewState(
            reviewCards,
            safeRun.reviewState && typeof safeRun.reviewState === 'object'
                ? safeRun.reviewState.consumedCardIds
                : [],
            safeRun.reviewState && typeof safeRun.reviewState === 'object'
                ? safeRun.reviewState.completedAt
                : null
        );
        return {
            ...safeRun,
            scope: {
                ...safeRun.scope,
                documentIds: [...safeRun.scope.documentIds],
                atomIds: [...safeRun.scope.atomIds],
                sourcePathPrefixes: [...safeRun.scope.sourcePathPrefixes],
                languages: [...safeRun.scope.languages],
            },
            evidenceClaims: safeRun.evidenceClaims.map((claim) => ({ ...claim })),
            quality: {
                ...safeRun.quality,
                gates: safeRun.quality.gates.map((gate) => ({ ...gate })),
            },
            reviewCards,
            reviewState,
            summary: {
                ...safeRun.summary,
                reviewCardCount: reviewCards.length,
                completedReviewCardCount: reviewState.completedReviewCardCount,
                remainingReviewCardCount: reviewState.remainingReviewCardCount,
            },
        };
    }

    private cloneAgentConversationGraphContext(
        value: AgentConversationResponse['trace']['graphContext']
    ): AgentConversationResponse['trace']['graphContext'] {
        if (!value || typeof value !== 'object') {
            return undefined;
        }
        return {
            anchorAtomId: String(value.anchorAtomId || '').trim(),
            anchorTitle: String(value.anchorTitle || '').trim(),
            anchorDocumentId: typeof value.anchorDocumentId === 'string' ? value.anchorDocumentId : undefined,
            anchorGraphProfile: (value as any).anchorGraphProfile && typeof (value as any).anchorGraphProfile === 'object'
                ? {
                    atomId: String((value as any).anchorGraphProfile.atomId || '').trim(),
                    title: String((value as any).anchorGraphProfile.title || '').trim(),
                    inDegree: Number.isFinite(Number((value as any).anchorGraphProfile.inDegree))
                        ? Number((value as any).anchorGraphProfile.inDegree)
                        : undefined,
                    outDegree: Number.isFinite(Number((value as any).anchorGraphProfile.outDegree))
                        ? Number((value as any).anchorGraphProfile.outDegree)
                        : undefined,
                    centrality: Number.isFinite(Number((value as any).anchorGraphProfile.centrality))
                        ? Number((value as any).anchorGraphProfile.centrality)
                        : undefined,
                }
                : undefined,
            supportingAtomIds: Array.isArray(value.supportingAtomIds)
                ? value.supportingAtomIds.map((atomId) => String(atomId || '').trim()).filter(Boolean)
                : [],
            supportingTitles: Array.isArray(value.supportingTitles)
                ? value.supportingTitles.map((title) => String(title || '').trim()).filter(Boolean)
                : [],
            relationKinds: Array.isArray(value.relationKinds)
                ? value.relationKinds.slice()
                : [],
            relationSummaries: Array.isArray(value.relationSummaries)
                ? value.relationSummaries.map((summary) => ({
                    relationKind: summary.relationKind,
                    edgeIds: Array.isArray(summary.edgeIds) ? summary.edgeIds.map((edgeId) => String(edgeId || '').trim()).filter(Boolean) : [],
                    sourceAtomIds: Array.isArray(summary.sourceAtomIds) ? summary.sourceAtomIds.map((atomId) => String(atomId || '').trim()).filter(Boolean) : [],
                    targetAtomIds: Array.isArray(summary.targetAtomIds) ? summary.targetAtomIds.map((atomId) => String(atomId || '').trim()).filter(Boolean) : [],
                    averageConfidence: Number.isFinite(Number(summary.averageConfidence)) ? Number(summary.averageConfidence) : 0,
                }))
                : [],
            knowledgePointRelations: Array.isArray(value.knowledgePointRelations)
                ? value.knowledgePointRelations.map((relation) => ({
                    edgeId: String(relation.edgeId || '').trim(),
                    relationKind: relation.relationKind,
                    sourceAtomId: String(relation.sourceAtomId || '').trim(),
                    sourceTitle: String(relation.sourceTitle || '').trim(),
                    targetAtomId: String(relation.targetAtomId || '').trim(),
                    targetTitle: String(relation.targetTitle || '').trim(),
                    confidence: Number.isFinite(Number(relation.confidence)) ? Number(relation.confidence) : 0,
                }))
                : [],
            connectionPaths: Array.isArray((value as any).connectionPaths)
                ? (value as any).connectionPaths.map((connectionPath: any) => ({
                    sourceAtomId: String(connectionPath.sourceAtomId || '').trim(),
                    sourceTitle: String(connectionPath.sourceTitle || '').trim(),
                    targetAtomId: String(connectionPath.targetAtomId || '').trim(),
                    targetTitle: String(connectionPath.targetTitle || '').trim(),
                    pathAtomIds: Array.isArray(connectionPath.pathAtomIds)
                        ? connectionPath.pathAtomIds.map((atomId: unknown) => String(atomId || '').trim()).filter(Boolean)
                        : [],
                    pathTitles: Array.isArray(connectionPath.pathTitles)
                        ? connectionPath.pathTitles.map((title: unknown) => String(title || '').trim()).filter(Boolean)
                        : [],
                    pathEdges: Array.isArray(connectionPath.pathEdges)
                        ? connectionPath.pathEdges.map((edge: any) => ({
                            fromAtomId: String(edge.fromAtomId || '').trim(),
                            toAtomId: String(edge.toAtomId || '').trim(),
                            relationKind: edge.relationKind,
                        }))
                        : [],
                    length: Math.max(0, Math.floor(Number(connectionPath.length || 0))),
                }))
                : [],
            predecessorWindow: Array.isArray((value as any).predecessorWindow)
                ? (value as any).predecessorWindow.map((node: any) => ({
                    atomId: String(node.atomId || '').trim(),
                    title: String(node.title || '').trim(),
                    relationKind: node.relationKind,
                    confidence: Number.isFinite(Number(node.confidence)) ? Number(node.confidence) : undefined,
                    inDegree: Number.isFinite(Number(node.inDegree)) ? Number(node.inDegree) : undefined,
                    outDegree: Number.isFinite(Number(node.outDegree)) ? Number(node.outDegree) : undefined,
                    centrality: Number.isFinite(Number(node.centrality)) ? Number(node.centrality) : undefined,
                }))
                : [],
            successorWindow: Array.isArray((value as any).successorWindow)
                ? (value as any).successorWindow.map((node: any) => ({
                    atomId: String(node.atomId || '').trim(),
                    title: String(node.title || '').trim(),
                    relationKind: node.relationKind,
                    confidence: Number.isFinite(Number(node.confidence)) ? Number(node.confidence) : undefined,
                    inDegree: Number.isFinite(Number(node.inDegree)) ? Number(node.inDegree) : undefined,
                    outDegree: Number.isFinite(Number(node.outDegree)) ? Number(node.outDegree) : undefined,
                    centrality: Number.isFinite(Number(node.centrality)) ? Number(node.centrality) : undefined,
                }))
                : [],
            evidenceSourceRefs: Array.isArray((value as any).evidenceSourceRefs)
                ? (value as any).evidenceSourceRefs.map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
                : [],
            diagnostics: (value as any).diagnostics && typeof (value as any).diagnostics === 'object'
                ? {
                    graphOpsAvailable: (value as any).diagnostics.graphOpsAvailable === true,
                    usedFallback: (value as any).diagnostics.usedFallback === true,
                    selectedAnchorReason: String((value as any).diagnostics.selectedAnchorReason || '').trim(),
                    candidateCount: Math.max(0, Math.floor(Number((value as any).diagnostics.candidateCount || 0))),
                    supportNodeCount: Math.max(0, Math.floor(Number((value as any).diagnostics.supportNodeCount || 0))),
                    supportNodeLimit: Math.max(0, Math.floor(Number((value as any).diagnostics.supportNodeLimit || 0))),
                    pathDepthLimit: Math.max(0, Math.floor(Number((value as any).diagnostics.pathDepthLimit || 0))),
                    intentAlignedPredecessorCandidateCount: Math.max(0, Math.floor(Number((value as any).diagnostics.intentAlignedPredecessorCandidateCount || 0))),
                    intentAlignedSuccessorCandidateCount: Math.max(0, Math.floor(Number((value as any).diagnostics.intentAlignedSuccessorCandidateCount || 0))),
                    intentMisalignedPredecessorCandidateCount: Math.max(0, Math.floor(Number((value as any).diagnostics.intentMisalignedPredecessorCandidateCount || 0))),
                    intentMisalignedSuccessorCandidateCount: Math.max(0, Math.floor(Number((value as any).diagnostics.intentMisalignedSuccessorCandidateCount || 0))),
                    usedIntentMisalignedPredecessorFallback: (value as any).diagnostics.usedIntentMisalignedPredecessorFallback === true,
                    usedIntentMisalignedSuccessorFallback: (value as any).diagnostics.usedIntentMisalignedSuccessorFallback === true,
                    missingConnectionPathSourceAtomIds: Array.isArray((value as any).diagnostics.missingConnectionPathSourceAtomIds)
                        ? (value as any).diagnostics.missingConnectionPathSourceAtomIds.map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
                        : [],
                    missingPredecessorAtomIds: Array.isArray((value as any).diagnostics.missingPredecessorAtomIds)
                        ? (value as any).diagnostics.missingPredecessorAtomIds.map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
                        : [],
                    missingSuccessorAtomIds: Array.isArray((value as any).diagnostics.missingSuccessorAtomIds)
                        ? (value as any).diagnostics.missingSuccessorAtomIds.map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
                        : [],
                }
                : undefined,
            temporalValidity: value.temporalValidity && typeof value.temporalValidity === 'object'
                ? {
                    checkedAt: String(value.temporalValidity.checkedAt || '').trim(),
                    allPointsValid: value.temporalValidity.allPointsValid !== false,
                    warningReasons: Array.isArray(value.temporalValidity.warningReasons)
                        ? value.temporalValidity.warningReasons.map((reason) => String(reason || '').trim()).filter(Boolean)
                        : [],
                    invalidKnowledgePointTitles: Array.isArray(value.temporalValidity.invalidKnowledgePointTitles)
                        ? value.temporalValidity.invalidKnowledgePointTitles.map((title) => String(title || '').trim()).filter(Boolean)
                        : [],
                    edgeKinds: Array.isArray(value.temporalValidity.edgeKinds)
                        ? value.temporalValidity.edgeKinds.slice()
                        : [],
                    details: Array.isArray(value.temporalValidity.details)
                        ? value.temporalValidity.details.map((detail) => ({
                            edgeId: String(detail.edgeId || '').trim(),
                            edgeKind: detail.edgeKind,
                            sourceAtomId: String(detail.sourceAtomId || '').trim(),
                            targetAtomId: String(detail.targetAtomId || '').trim(),
                            validFrom: String(detail.validFrom || '').trim(),
                            validTo: detail.validTo ? String(detail.validTo).trim() : undefined,
                            isActive: detail.isActive !== false,
                        }))
                        : [],
                }
                : {
                    checkedAt: '',
                    allPointsValid: true,
                    warningReasons: [],
                    invalidKnowledgePointTitles: [],
                    edgeKinds: [],
                    details: [],
                },
        };
    }

    private cloneAgentConversationKnowledgePoint(point: AgentConversationKnowledgePoint): AgentConversationKnowledgePoint {
        return {
            ...point,
            atomIds: Array.isArray(point.atomIds) ? [...point.atomIds] : point.atomIds,
            capabilities: Array.isArray(point.capabilities) ? [...point.capabilities] : [],
            citation: point.citation ? { ...point.citation } : null,
            citations: Array.isArray(point.citations)
                ? point.citations.map((citation) => ({ ...citation }))
                : point.citations,
            matchedSpans: Array.isArray(point.matchedSpans)
                ? point.matchedSpans.map((span) => ({
                    ...span,
                    citation: span.citation ? { ...span.citation } : null,
                }))
                : point.matchedSpans,
            relationPath: Array.isArray(point.relationPath)
                ? point.relationPath.map((edge) => ({ ...edge }))
                : point.relationPath,
            relationPathAtomIds: Array.isArray(point.relationPathAtomIds)
                ? [...point.relationPathAtomIds]
                : point.relationPathAtomIds,
            relationKinds: Array.isArray(point.relationKinds)
                ? point.relationKinds.slice()
                : point.relationKinds,
            temporalValidity: point.temporalValidity
                ? {
                    ...point.temporalValidity,
                    reasons: Array.isArray(point.temporalValidity.reasons) ? [...point.temporalValidity.reasons] : [],
                    details: Array.isArray(point.temporalValidity.details)
                        ? point.temporalValidity.details.map((detail) => ({ ...detail }))
                        : [],
                }
                : point.temporalValidity,
        };
    }

    private attachKnowledgeRunArtifactIdToBlocks(
        blocks: AgentConversationAssistantBlock[] | undefined,
        artifactId: string
    ): AgentConversationAssistantBlock[] | undefined {
        if (!Array.isArray(blocks) || !isNonEmptyString(artifactId)) {
            return blocks;
        }
        return blocks.map((block) => {
            if (!block || typeof block !== 'object' || block.type !== 'knowledge_run_summary') {
                return block;
            }
            return {
                ...block,
                artifactId,
            } satisfies AgentConversationAssistantBlock;
        });
    }

    private resolveWorkflowArtifactRunId(artifact: WorkflowArtifactRecord): string {
        const payload = artifact.payload && typeof artifact.payload === 'object'
            ? artifact.payload as Record<string, unknown>
            : {};
        const directRunId = String(payload.runId || '').trim();
        if (directRunId) {
            return directRunId;
        }
        const knowledgeRun = payload.knowledgeRun && typeof payload.knowledgeRun === 'object'
            ? payload.knowledgeRun as Record<string, unknown>
            : null;
        return knowledgeRun ? String(knowledgeRun.runId || '').trim() : '';
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
            historyWindowAverageMasteryDeltaUplift: Number(
                clamp(Number(merged.historyWindowAverageMasteryDeltaUplift || 0), -1, 1).toFixed(6)
            ),
            queryP95Ms: Number(clamp(merged.queryP95Ms, 10, 60000).toFixed(4)),
            maxQueryBackendFallbackRatioPct: Number(
                clamp(Number(merged.maxQueryBackendFallbackRatioPct ?? 10), 0, 100).toFixed(4)
            ),
            minQueryEvidenceCoverageRatioPct: Number(
                clamp(Number(merged.minQueryEvidenceCoverageRatioPct ?? 80), 0, 100).toFixed(4)
            ),
            minQueryRelationPathCoverageRatioPct: Number(
                clamp(Number(merged.minQueryRelationPathCoverageRatioPct ?? 60), 0, 100).toFixed(4)
            ),
            minQueryTemporalValidityPassRatioPct: Number(
                clamp(Number(merged.minQueryTemporalValidityPassRatioPct ?? 90), 0, 100).toFixed(4)
            ),
            minSessionMemoryPromotionCoveragePct: Number(
                clamp(Number(merged.minSessionMemoryPromotionCoveragePct ?? 25), 0, 100).toFixed(4)
            ),
            maxPendingVerificationRatioPct: Number(
                clamp(Number(merged.maxPendingVerificationRatioPct ?? 20), 0, 100).toFixed(4)
            ),
        };
    }

    private resolveStudySessionPlanQualityThresholds(
        overrides: Partial<StudySessionPlanQualityThresholdSet> | undefined
    ): StudySessionPlanQualityThresholdSet {
        const merged: StudySessionPlanQualityThresholdSet = {
            ...DEFAULT_STUDY_SESSION_PLAN_QUALITY_THRESHOLDS,
            ...(overrides || {}),
        };
        return {
            minTotalActions: Math.max(1, Math.floor(Number(merged.minTotalActions || 0))),
            minEvidenceCoverageRatioPct: Number(
                clamp(Number(merged.minEvidenceCoverageRatioPct || 0), 0, 100).toFixed(4)
            ),
            maxBudgetDeviationActions: Math.max(0, Math.floor(Number(merged.maxBudgetDeviationActions || 0))),
            minRecoverySharePctWhenRegressing: Number(
                clamp(Number(merged.minRecoverySharePctWhenRegressing || 0), 0, 100).toFixed(4)
            ),
            maxDivergenceSharePctWhenRegressing: Number(
                clamp(Number(merged.maxDivergenceSharePctWhenRegressing || 0), 0, 100).toFixed(4)
            ),
            minDivergenceSharePctWhenImproving: Number(
                clamp(Number(merged.minDivergenceSharePctWhenImproving || 0), 0, 100).toFixed(4)
            ),
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

    private inferGraphQueryBackendTypeFromId(value: unknown): GraphQueryBackendType {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized.includes('keyword')) {
            return 'keyword_only';
        }
        if (normalized.includes('vector')) {
            return 'local_vector';
        }
        return 'local_hybrid';
    }

    private normalizeScopePathPrefix(value: unknown): string {
        return String(value || '')
            .trim()
            .replace(/\\/g, '/')
            .replace(/\/{2,}/g, '/')
            .replace(/\/+$/g, '')
            .toLowerCase();
    }

    private normalizeQueryForPlanning(value: unknown): string {
        return String(value || '')
            .normalize('NFKC')
            .replace(/[？?！!。.,;:]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    private normalizePlannerTitleCandidate(value: unknown): string {
        return this.normalizeQueryForPlanning(value)
            .replace(/^(?:the|a|an)\s+/i, '')
            .replace(/\s+(?:please|pls)$/i, '')
            .trim();
    }

    private deriveComparisonOperandTitleQueries(normalizedQuery: string): string[] {
        const candidates = new Set<string>();
        const addOperand = (value: string | undefined): void => {
            const candidate = this.normalizePlannerTitleCandidate(value);
            if (!candidate || tokenize(candidate).length <= 0) {
                return;
            }
            candidates.add(candidate);
        };
        const prefixedComparison = normalizedQuery.match(/^(?:compare|contrast)\s+(.+?)\s+(?:and|with|to|vs|versus)\s+(.+)$/i);
        if (prefixedComparison) {
            addOperand(prefixedComparison[1]);
            addOperand(prefixedComparison[2]);
        }
        const directVersus = /^(?:compare|contrast)\s+/i.test(normalizedQuery)
            ? null
            : normalizedQuery.match(/^(.+?)\s+(?:vs|versus)\s+(.+)$/i);
        if (directVersus) {
            addOperand(directVersus[1]);
            addOperand(directVersus[2]);
        }
        const differenceBetween = normalizedQuery.match(/^(?:(?:what|which)\s+(?:is|are)\s+(?:the\s+)?|tell me\s+(?:the\s+)?|explain\s+(?:the\s+)?)?(?:difference|differences)\s+between\s+(.+?)\s+and\s+(.+)$/i);
        if (differenceBetween) {
            addOperand(differenceBetween[1]);
            addOperand(differenceBetween[2]);
        }
        const differentFrom = normalizedQuery.match(/^(?:how\s+(?:does|do|is|are)\s+)?(.+?)\s+(?:differ|differs|different)\s+from\s+(.+)$/i);
        if (differentFrom) {
            addOperand(differentFrom[1]);
            addOperand(differentFrom[2]);
        }
        return Array.from(candidates.values());
    }

    private isComparisonPlanningQuery(value: string): boolean {
        const normalized = this.normalizeQueryForPlanning(value);
        if (!normalized) {
            return false;
        }
        return /(?:^|\s)(?:compare|contrast|vs|versus|difference|differences|differ|differs|different)(?:\s|$)/i.test(normalized)
            || normalized.includes('区别')
            || normalized.includes('对比');
    }

    private derivePlannerTitleLikeQueries(query: string): string[] {
        const normalized = this.normalizeQueryForPlanning(query);
        if (!normalized) {
            return [];
        }
        const baseCandidates = new Set<string>([normalized]);
        this.deriveComparisonOperandTitleQueries(normalized).forEach((candidate) => {
            baseCandidates.add(candidate);
        });
        const stripped = normalized
            .replace(/^(what is|what are|define|explain(?:\s+(?:in\s+detail|deeply|thoroughly|fully|comprehensively))?|tell me about|what's)\s+/i, '')
            .replace(/^(什么是|解释一下|详细解释|詳盡解釋|深入解释|深度解释|介绍一下|请解释|请详细解释|请介绍|深度分析|深入分析)\s*/i, '')
            .trim();
        if (stripped) {
            baseCandidates.add(stripped);
        }
        const compact = stripped.replace(/\s+/g, '');
        if (compact) {
            baseCandidates.add(compact);
        }
        const spaced = compact.replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
        if (spaced) {
            baseCandidates.add(spaced);
        }
        if (compact === 'waterglass' || stripped === 'water glass' || normalized.includes('water glass')) {
            baseCandidates.add('water glass');
            baseCandidates.add('waterglass');
            baseCandidates.add('水玻璃');
            baseCandidates.add('水杯');
        }
        return Array.from(baseCandidates.values()).filter(Boolean);
    }

    private findDocumentIdsByTitleLikeQueries(titleLikeQueries: string[]): string[] {
        if (titleLikeQueries.length <= 0) {
            return [];
        }
        const loweredQueries = titleLikeQueries.map((entry) => this.normalizeQueryForPlanning(entry)).filter(Boolean);
        if (loweredQueries.length <= 0) {
            return [];
        }
        const exactMatches = new Set<string>();
        const fuzzyMatches = new Set<string>();
        this.documents.forEach((snapshot) => {
            const normalizedPath = String(snapshot.sourcePath || '').replace(/\\/g, '/');
            const fileName = path.basename(normalizedPath).replace(/\.[^.]+$/g, '');
            const normalizedDocumentId = this.normalizeQueryForPlanning(snapshot.documentId);
            const normalizedFileName = this.normalizeQueryForPlanning(fileName);
            const normalizedPathValue = this.normalizeQueryForPlanning(normalizedPath);
            const candidateHaystacks = [normalizedDocumentId, normalizedFileName, normalizedPathValue].filter(Boolean);
            if (candidateHaystacks.some((haystack) => loweredQueries.some((query) => haystack === query))) {
                exactMatches.add(snapshot.documentId);
                return;
            }
            if (candidateHaystacks.some((haystack) => loweredQueries.some((query) => haystack.includes(query)))) {
                fuzzyMatches.add(snapshot.documentId);
            }
        });
        if (exactMatches.size > 0) {
            return Array.from(exactMatches.values());
        }
        return Array.from(fuzzyMatches.values());
    }

    private buildWorkspaceReadiness(scope: {
        workspaceId?: string | null;
        corpusId?: string | null;
    }): KnowledgeWorkspaceReadiness {
        const totalResources = this.resourceRegistry.listActiveResources().length;
        if (totalResources <= 0 || this.documents.size <= 0 || this.activeAtomIds.size <= 0) {
            return {
                status: 'empty_store',
                message: 'The learning workspace store is empty. Sync or ingest the active knowledge target first.',
                workspaceId: null,
                corpusId: null,
                activeResourceCount: 0,
                activeProjectionCount: 0,
                indexedUnitCount: 0,
                indexedSegmentCount: 0,
                matchedDocumentCount: 0,
            };
        }
        const workspaceId = isNonEmptyString(scope.workspaceId) ? scope.workspaceId.trim().toLowerCase() : null;
        const corpusId = isNonEmptyString(scope.corpusId) ? scope.corpusId.trim().toLowerCase() : null;
        if (!workspaceId && !corpusId) {
            const summary = this.indexLifecycle.buildSummary();
            return {
                status: 'ready',
                message: 'Global learning workspace query path is ready.',
                workspaceId: null,
                corpusId: null,
                activeResourceCount: totalResources,
                activeProjectionCount: this.resourceRegistry.listActiveProjections().length,
                indexedUnitCount: summary.totalUnits,
                indexedSegmentCount: summary.totalSegments,
                matchedDocumentCount: this.documents.size,
            };
        }
        const resolvedWorkspace = workspaceId
            ? this.workspaceRegistry.getWorkspaceById(workspaceId)
            : (
                corpusId
                    ? this.workspaceRegistry.listActiveWorkspaces().find((workspace) => workspace.corpusId === corpusId) || null
                    : null
            );
        if (workspaceId && !resolvedWorkspace) {
            return {
                status: 'workspace_not_found',
                message: `Workspace "${workspaceId}" is not hydrated in the learning workspace store.`,
                workspaceId,
                corpusId,
                activeResourceCount: totalResources,
                activeProjectionCount: this.resourceRegistry.listActiveProjections().length,
                indexedUnitCount: 0,
                indexedSegmentCount: 0,
                matchedDocumentCount: 0,
            };
        }
        const effectiveWorkspaceId = resolvedWorkspace?.workspaceId || workspaceId || null;
        const effectiveCorpusId = resolvedWorkspace?.corpusId || corpusId || null;
        const bindings = effectiveWorkspaceId
            ? this.workspaceRegistry.listBindingsByWorkspace(effectiveWorkspaceId)
            : [];
        if (bindings.length <= 0) {
            return {
                status: 'workspace_unbound',
                message: `Workspace "${effectiveWorkspaceId || effectiveCorpusId || 'unknown'}" has no bound knowledge projections.`,
                workspaceId: effectiveWorkspaceId,
                corpusId: effectiveCorpusId,
                activeResourceCount: totalResources,
                activeProjectionCount: 0,
                indexedUnitCount: 0,
                indexedSegmentCount: 0,
                matchedDocumentCount: 0,
            };
        }
        const projectionIds = bindings.map((binding) => binding.projectionId);
        const units = this.indexLifecycle.listUnitsByProjectionIds(projectionIds);
        const segments = this.indexLifecycle.listSegmentsByUnitIds(units.map((unit) => unit.unitId));
        const matchedDocumentIds = new Set(bindings.map((binding) => binding.documentId).filter(Boolean));
        if (segments.length <= 0 || units.length <= 0) {
            return {
                status: 'workspace_unindexed',
                message: `Workspace "${effectiveWorkspaceId || effectiveCorpusId || 'unknown'}" is bound but has no indexed learning units yet.`,
                workspaceId: effectiveWorkspaceId,
                corpusId: effectiveCorpusId,
                activeResourceCount: new Set(bindings.map((binding) => binding.resourceId)).size,
                activeProjectionCount: projectionIds.length,
                indexedUnitCount: units.length,
                indexedSegmentCount: segments.length,
                matchedDocumentCount: matchedDocumentIds.size,
            };
        }
        return {
            status: 'ready',
            message: `Workspace "${effectiveWorkspaceId || effectiveCorpusId || 'global'}" is ready for scoped learning queries.`,
            workspaceId: effectiveWorkspaceId,
            corpusId: effectiveCorpusId,
            activeResourceCount: new Set(bindings.map((binding) => binding.resourceId)).size,
            activeProjectionCount: projectionIds.length,
            indexedUnitCount: units.length,
            indexedSegmentCount: segments.length,
            matchedDocumentCount: matchedDocumentIds.size,
        };
    }

    private buildMissDiagnostics(params: {
        query: string;
        resolvedScope: KnowledgeQueryResolvedScope;
        readiness: KnowledgeWorkspaceReadiness;
        plannerQuery?: string;
        titleLikeQueries?: string[];
        titleHitDocumentIds?: string[];
        indexedScopeAtomCount?: number;
    }): NonNullable<KnowledgeQueryResolvedScope['missDiagnostics']> {
        const normalizedQuery = this.normalizeQueryForPlanning(params.query);
        let reason: NonNullable<KnowledgeQueryResolvedScope['missDiagnostics']>['reason'] = 'none';
        let message = 'Scoped retrieval produced no matching knowledge points.';
        if (params.readiness.status === 'empty_store') {
            reason = 'empty_store';
            message = params.readiness.message;
        } else if (params.readiness.status === 'workspace_not_found') {
            reason = 'workspace_not_found';
            message = params.readiness.message;
        } else if (params.readiness.status === 'workspace_unbound') {
            reason = 'workspace_unbound';
            message = params.readiness.message;
        } else if ((params.indexedScopeAtomCount || 0) <= 0) {
            reason = 'scope_has_no_indexed_segments';
            message = 'The active scope resolved to zero indexed atoms.';
        } else if ((params.titleHitDocumentIds || []).length <= 0) {
            reason = 'query_no_title_or_alias_hit';
            message = 'The query planner could not find a title or alias hit in the active scope.';
        } else {
            reason = 'retrieval_candidates_below_threshold';
            message = 'The planner found likely documents, but retrieval did not return evidence-bearing candidates.';
        }
        return {
            reason,
            message,
            query: params.query,
            normalizedQuery,
            plannerQuery: params.plannerQuery,
            titleLikeQueries: params.titleLikeQueries || [],
            titleHitDocumentIds: params.titleHitDocumentIds || [],
            indexedScopeAtomCount: params.indexedScopeAtomCount || 0,
        };
    }

    private extractCorpusIdFromSourcePath(sourcePath: string): string {
        const normalized = String(sourcePath || '').replace(/\\/g, '/');
        const segments = normalized.split('/').filter(Boolean);
        const kbIndex = segments.findIndex((segment) => segment.toLowerCase() === 'knowledge_base');
        if (kbIndex >= 0 && segments[kbIndex + 1]) {
            return String(segments[kbIndex + 1]).trim().toLowerCase();
        }
        return segments[0] ? String(segments[0]).trim().toLowerCase() : '';
    }

    private normalizeKnowledgeCorpusScope(
        scope: KnowledgeQueryRequest['scope'] | AgentConversationRequest['scope']
    ): {
        workspaceId: string | null;
        corpusId: string | null;
        documentIds: Set<string>;
        atomIds: Set<string>;
        sourcePathPrefixes: string[];
        languages: Set<string>;
        scoped: boolean;
    } {
        const documentIds = new Set<string>(
            Array.isArray(scope?.documentIds)
                ? scope.documentIds.map((value) => String(value || '').trim()).filter(Boolean)
                : []
        );
        const atomIds = new Set<string>(
            Array.isArray(scope?.atomIds)
                ? scope.atomIds.map((value) => String(value || '').trim()).filter(Boolean)
                : []
        );
        const sourcePathPrefixes = Array.from(new Set(
            Array.isArray(scope?.sourcePathPrefixes)
                ? scope.sourcePathPrefixes
                    .map((value) => this.normalizeScopePathPrefix(value))
                    .filter(Boolean)
                : []
        ));
        const languages = new Set<string>(
            Array.isArray(scope?.languages)
                ? scope.languages.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
                : []
        );
        const workspaceId = isNonEmptyString(scope?.workspaceId) ? scope.workspaceId.trim().toLowerCase() : null;
        const corpusId = isNonEmptyString(scope?.corpusId) ? scope.corpusId.trim().toLowerCase() : null;
        return {
            workspaceId,
            corpusId,
            documentIds,
            atomIds,
            sourcePathPrefixes,
            languages,
            scoped: Boolean(
                workspaceId
                || corpusId
                || documentIds.size > 0
                || atomIds.size > 0
                || sourcePathPrefixes.length > 0
                || languages.size > 0
            ),
        };
    }

    private mergeKnowledgeScopeDocumentIds(
        scope: KnowledgeQueryRequest['scope'] | AgentConversationRequest['scope'],
        documentIds: string[]
    ): KnowledgeQueryRequest['scope'] {
        const existingDocumentIds = Array.isArray(scope?.documentIds)
            ? scope.documentIds.map((documentId) => String(documentId || '').trim()).filter(Boolean)
            : [];
        const mergedDocumentIds = Array.from(new Set([
            ...existingDocumentIds,
            ...documentIds.map((documentId) => String(documentId || '').trim()).filter(Boolean),
        ]));
        return {
            ...(scope || {}),
            documentIds: mergedDocumentIds,
        };
    }

    private filterAtomsByKnowledgeScope(
        atoms: KnowledgeAtom[],
        scope: KnowledgeQueryRequest['scope'] | AgentConversationRequest['scope']
    ): {
        atoms: KnowledgeAtom[];
        resolvedScope: KnowledgeQueryResolvedScope;
    } {
        const normalizedScope = this.normalizeKnowledgeCorpusScope(scope);
        const enforceIndexedCoverage = this.indexLifecycle.buildSummary().totalSegments > 0;
        if (!normalizedScope.scoped) {
            const indexedAtoms = enforceIndexedCoverage
                ? atoms.filter((atom) => this.indexLifecycle.hasIndexedSegmentsForAtom(atom.id))
                : atoms;
            return {
                atoms: indexedAtoms,
                resolvedScope: {
                    source: 'global',
                    workspaceId: null,
                    corpusId: null,
                    documentIds: [],
                    atomIds: [],
                    sourcePathPrefixes: [],
                    languages: [],
                    matchedAtomCount: indexedAtoms.length,
                },
            };
        }

        const scopedAtoms = atoms.filter((atom) => {
            if (normalizedScope.documentIds.size > 0 && !normalizedScope.documentIds.has(atom.documentId)) {
                return false;
            }
            if (normalizedScope.atomIds.size > 0 && !normalizedScope.atomIds.has(atom.id) && !normalizedScope.atomIds.has(atom.stableKey)) {
                return false;
            }
            const atomSourcePath = this.normalizeScopePathPrefix(atom.sourcePath);
            if (
                normalizedScope.sourcePathPrefixes.length > 0
                && !normalizedScope.sourcePathPrefixes.some((prefix) => atomSourcePath.startsWith(prefix))
            ) {
                return false;
            }
            const atomLanguage = String(atom.metadata?.language || 'unknown').trim().toLowerCase();
            if (normalizedScope.languages.size > 0 && !normalizedScope.languages.has(atomLanguage)) {
                return false;
            }
            const binding = this.workspaceRegistry.resolveBindingByDocumentId(atom.documentId);
            const scopedWorkspaceId = binding?.workspaceId || this.extractCorpusIdFromSourcePath(atom.sourcePath);
            const scopedCorpusId = binding?.corpusId || this.extractCorpusIdFromSourcePath(atom.sourcePath);
            if (normalizedScope.corpusId && scopedCorpusId !== normalizedScope.corpusId) {
                return false;
            }
            if (normalizedScope.workspaceId && scopedWorkspaceId !== normalizedScope.workspaceId) {
                return false;
            }
            if (enforceIndexedCoverage && !this.indexLifecycle.hasIndexedSegmentsForAtom(atom.id)) {
                return false;
            }
            return true;
        });

        return {
            atoms: scopedAtoms,
            resolvedScope: {
                source: 'scoped',
                workspaceId: normalizedScope.workspaceId,
                corpusId: normalizedScope.corpusId,
                documentIds: Array.from(normalizedScope.documentIds.values()),
                atomIds: Array.from(normalizedScope.atomIds.values()),
                sourcePathPrefixes: [...normalizedScope.sourcePathPrefixes],
                languages: Array.from(normalizedScope.languages.values()),
                matchedAtomCount: scopedAtoms.length,
            },
        };
    }

    private filterRelationEdgesByScopedAtomIds(activeEdges: RelationEdge[], atoms: KnowledgeAtom[]): RelationEdge[] {
        const scopedAtomIds = new Set(atoms.map((atom) => atom.id));
        return activeEdges.filter((edge) => scopedAtomIds.has(edge.sourceAtomId) && scopedAtomIds.has(edge.targetAtomId));
    }

    private buildQueryBackendTemporalSignals(
        atoms: KnowledgeAtom[],
        asOf: string
    ): Record<string, {
        isValid: boolean;
        reasonCount: number;
        supersedesCount: number;
    }> {
        const temporalSignals: Record<string, {
            isValid: boolean;
            reasonCount: number;
            supersedesCount: number;
        }> = {};
        atoms.forEach((atom) => {
            const temporalValidity = this.evaluateTemporalValidity(atom.id, asOf);
            temporalSignals[atom.id] = {
                isValid: temporalValidity.isValid !== false,
                reasonCount: Array.isArray(temporalValidity.reasons) ? temporalValidity.reasons.length : 0,
                supersedesCount: Array.isArray(temporalValidity.details)
                    ? temporalValidity.details.filter((detail) => detail.edgeKind === 'supersedes').length
                    : 0,
            };
        });
        return temporalSignals;
    }

    private buildQueryBackendContext(
        request: KnowledgeQueryRequest,
        backend: GraphQueryBackendType
    ): {
        query: string;
        asOf: string;
        topK: number;
        activeEdges: RelationEdge[];
        atoms: KnowledgeAtom[];
        resolvedScope: KnowledgeQueryResolvedScope;
        context: {
            request: KnowledgeQueryRequest;
            query: string;
            queryTokens: string[];
            queryVariants: string[];
            asOf: string;
            topK: number;
            indexAtoms: KnowledgeAtom[];
            atoms: KnowledgeAtom[];
            activeEdges: RelationEdge[];
            atomTemporalValidity: Record<string, {
                isValid: boolean;
                reasonCount: number;
                supersedesCount: number;
            }>;
        };
        titleLikeQueries: string[];
        titleHitDocumentIds: string[];
        readiness: KnowledgeWorkspaceReadiness;
        scopeRecovery?: QueryScopeRecoveryPlan;
    } {
        const query = normalizeWhitespace(String(request.query || ''));
        const asOf = this.resolveTimestamp(request.asOf);
        const topK = clamp(Math.floor(Number(request.topK) || 5), 1, 20);
        const normalizedRequestScope = request.scope || {};
        const readiness = this.buildWorkspaceReadiness({
            workspaceId: normalizedRequestScope.workspaceId || null,
            corpusId: normalizedRequestScope.corpusId || null,
        });
        const titleLikeQueries = this.derivePlannerTitleLikeQueries(query);
        const titleHitDocumentIds = this.findDocumentIdsByTitleLikeQueries(titleLikeQueries);
        const queryTokens = Array.from(new Set(
            [query, ...titleLikeQueries].flatMap((entry) => tokenize(entry))
        ));
        const unscopedAtoms = Array.from(this.activeAtomIds.values())
            .map((atomId) => this.atoms.get(atomId))
            .filter((atom): atom is KnowledgeAtom => Boolean(atom));
        const requestedScopeAtomsResult = this.filterAtomsByKnowledgeScope(unscopedAtoms, request.scope);
        let effectiveScope = request.scope;
        let effectiveScopeSource: NonNullable<KnowledgeQueryResolvedScope['scopeSource']> = effectiveScope
            ? 'explicit_request'
            : 'global_default';
        let scopeRecovery: QueryScopeRecoveryPlan | undefined;
        const shouldConstrainExplicitScopeToTitleHits = !this.isComparisonPlanningQuery(query);
        if (titleHitDocumentIds.length > 0) {
            if (request.scope) {
                const titleHitDocumentIdSet = new Set(titleHitDocumentIds);
                const scopedTitleHitDocumentIds = Array.from(new Set(
                    requestedScopeAtomsResult.atoms
                        .map((atom) => atom.documentId)
                        .filter((documentId) => titleHitDocumentIdSet.has(documentId))
                ));
                if (scopedTitleHitDocumentIds.length > 0) {
                    if (shouldConstrainExplicitScopeToTitleHits) {
                        effectiveScope = this.mergeKnowledgeScopeDocumentIds(request.scope, scopedTitleHitDocumentIds);
                    }
                } else {
                    const recoveryScope: KnowledgeQueryRequest['scope'] = {
                        documentIds: titleHitDocumentIds,
                    };
                    if (Array.isArray(request.scope.languages) && request.scope.languages.length > 0) {
                        recoveryScope.languages = request.scope.languages
                            .map((language) => String(language || '').trim())
                            .filter(Boolean);
                    }
                    const recoveryAtomsResult = this.filterAtomsByKnowledgeScope(unscopedAtoms, recoveryScope);
                    if (recoveryAtomsResult.atoms.length > 0) {
                        const recoveredDocumentIds = Array.from(new Set(recoveryAtomsResult.atoms.map((atom) => atom.documentId)));
                        const recoveredSourcePaths = Array.from(new Set(recoveryAtomsResult.atoms.map((atom) => atom.sourcePath)));
                        scopeRecovery = {
                            reason: 'title_like_document_hit_outside_requested_scope',
                            requestedScope: requestedScopeAtomsResult.resolvedScope,
                            recoveredDocumentIds,
                            recoveredSourcePaths,
                            recoveryScope,
                        };
                    }
                }
            } else {
                effectiveScope = {
                    documentIds: titleHitDocumentIds,
                };
                effectiveScopeSource = 'planner_fallback';
            }
        }
        const scopedAtomsResult = this.filterAtomsByKnowledgeScope(unscopedAtoms, effectiveScope);
        scopedAtomsResult.resolvedScope.scopeSource = effectiveScopeSource;
        scopedAtomsResult.resolvedScope.readiness = readiness;
        const activeEdges = this.filterRelationEdgesByScopedAtomIds(
            this.collectActiveRelationEdges(asOf),
            scopedAtomsResult.atoms
        );
        const atomTemporalValidity = this.buildQueryBackendTemporalSignals(scopedAtomsResult.atoms, asOf);
        return {
            query,
            asOf,
            topK,
            activeEdges,
            atoms: scopedAtomsResult.atoms,
            resolvedScope: scopedAtomsResult.resolvedScope,
            titleLikeQueries,
            titleHitDocumentIds,
            readiness,
            scopeRecovery,
            context: {
                request: {
                    ...request,
                    query,
                    asOf,
                    topK,
                    queryBackend: backend,
                    scope: effectiveScope,
                },
                query,
                queryTokens,
                queryVariants: [...titleLikeQueries],
                asOf,
                topK,
                indexAtoms: unscopedAtoms,
                atoms: scopedAtomsResult.atoms,
                activeEdges,
                atomTemporalValidity,
            },
        };
    }

    private materializeQueryBackendItems(
        result: GraphQueryBackendResult,
        asOf: string,
        activeEdges: RelationEdge[],
        topK: number,
        candidateLimit?: number
    ): KnowledgeQueryItem[] {
        return result.candidates
            .filter((candidate) => this.activeAtomIds.has(candidate.atomId))
            .slice(0, Math.max(topK, candidateLimit || topK))
            .map((candidate) => {
                const atom = this.atoms.get(candidate.atomId);
                if (!atom) {
                    return null;
                }
                const evidenceSpans = atom.evidenceSpanIds
                    .map((evidenceId) => this.evidenceSpans.get(evidenceId))
                    .filter((span): span is EvidenceSpan => Boolean(span));
                return {
                    atom,
                    score: Number(Number(candidate.score || 0).toFixed(4)),
                    evidenceSpans,
                    relationPath: this.selectRelationPath(atom.id, activeEdges, 3),
                    temporalValidity: this.evaluateTemporalValidity(atom.id, asOf),
                };
            })
            .filter((item): item is KnowledgeQueryItem => Boolean(item));
    }

    private summarizeQueryItems(items: KnowledgeQueryItem[]): {
        evidenceCoverageRatio: number;
        relationPathCoverageRatio: number;
        temporalValidityPassRatio: number;
    } {
        if (items.length <= 0) {
            return {
                evidenceCoverageRatio: 1,
                relationPathCoverageRatio: 0,
                temporalValidityPassRatio: 1,
            };
        }
        return {
            evidenceCoverageRatio: Number(
                (items.filter((item) => item.evidenceSpans.length > 0).length / items.length).toFixed(4)
            ),
            relationPathCoverageRatio: Number(
                (items.filter((item) => item.relationPath.length > 0).length / items.length).toFixed(4)
            ),
            temporalValidityPassRatio: Number(
                (items.filter((item) => item.temporalValidity.isValid).length / items.length).toFixed(4)
            ),
        };
    }

    private rerankQueryItemsForPlanner(
        items: KnowledgeQueryItem[],
        planner: {
            titleLikeQueries: string[];
            titleHitDocumentIds: string[];
        }
    ): KnowledgeQueryItem[] {
        const normalizedTitleQueries = planner.titleLikeQueries
            .map((entry) => this.normalizeQueryForPlanning(entry))
            .filter(Boolean);
        const titleHitDocumentIds = new Set(planner.titleHitDocumentIds);
        if (normalizedTitleQueries.length <= 0 || titleHitDocumentIds.size <= 0) {
            return items;
        }
        const ranked = items
            .map((item) => {
                const normalizedTitle = this.normalizeQueryForPlanning(item.atom.title);
                const titleExactHit = normalizedTitleQueries.some((query) => normalizedTitle === query);
                const titleContainsHit = titleExactHit
                    ? false
                    : normalizedTitleQueries.some((query) => normalizedTitle.includes(query));
                const plannerDocumentBoost = titleHitDocumentIds.has(item.atom.documentId) ? 1.2 : 0;
                const plannerTitleBoost = titleExactHit
                    ? 2.4
                    : (titleContainsHit ? 1.1 : 0);
                const representationBoost = item.atom.representationType === 'text' ? 0.08 : 0;
                return {
                    item,
                    adjustedScore: Number((item.score + plannerDocumentBoost + plannerTitleBoost + representationBoost).toFixed(4)),
                };
            })
            .sort((left, right) => {
                if (right.adjustedScore !== left.adjustedScore) {
                    return right.adjustedScore - left.adjustedScore;
                }
                return right.item.score - left.item.score;
            })
            .map((entry) => ({
                ...entry.item,
                score: entry.adjustedScore,
            }));
        return ranked;
    }

    private shouldApplyPlannerScopeRecovery(
        items: KnowledgeQueryItem[],
        scopeRecovery: QueryScopeRecoveryPlan | undefined,
        titleHitDocumentIds: string[]
    ): boolean {
        if (!scopeRecovery) {
            return false;
        }
        if (items.length <= 0) {
            return true;
        }
        const plannerDocumentIds = new Set(
            titleHitDocumentIds
                .map((documentId) => String(documentId || '').trim())
                .filter(Boolean)
        );
        if (plannerDocumentIds.size <= 0) {
            return false;
        }
        return !items.some((item) => plannerDocumentIds.has(String(item.atom.documentId || '').trim()));
    }

    private async executeQueryBackend(
        request: KnowledgeQueryRequest,
        backend: GraphQueryBackendType,
        options: {
            allowRuntimeFallback: boolean;
            recordFallback: boolean;
            overrideBackend?: GraphQueryBackend;
        }
    ): Promise<QueryBackendExecutionResult> {
        const contextBundle = this.buildQueryBackendContext(request, backend);
        const backendInstance = options.overrideBackend
            || (
                backend === this.currentGraphQueryBackendType
                    ? this.graphQueryBackend
                    : createGraphQueryBackend({
                        ...this.graphQueryBackendFactoryOptions,
                        backend,
                    })
        );
        const startedAtMs = Date.now();
        try {
            let effectiveContextBundle = contextBundle;
            let effectiveBackendResult = await backendInstance.query(contextBundle.context);
            let materializedItems = this.materializeQueryBackendItems(
                effectiveBackendResult,
                effectiveContextBundle.asOf,
                effectiveContextBundle.activeEdges,
                effectiveContextBundle.topK,
                effectiveContextBundle.titleHitDocumentIds.length > 0
                    ? Math.max(effectiveContextBundle.topK * 6, 24)
                    : effectiveContextBundle.topK
            );
            let rerankedItems = this.rerankQueryItemsForPlanner(materializedItems, {
                titleLikeQueries: effectiveContextBundle.titleLikeQueries,
                titleHitDocumentIds: effectiveContextBundle.titleHitDocumentIds,
            }).slice(0, effectiveContextBundle.topK);
            let appliedScopeRecovery: QueryScopeRecoveryPlan | undefined;
            const plannerScopeRecovery = contextBundle.scopeRecovery;
            if (this.shouldApplyPlannerScopeRecovery(
                rerankedItems,
                plannerScopeRecovery,
                contextBundle.titleHitDocumentIds
            )) {
                const recoveryContextBundle = this.buildQueryBackendContext({
                    ...request,
                    scope: plannerScopeRecovery!.recoveryScope,
                }, backend);
                const recoveryBackendResult = await backendInstance.query(recoveryContextBundle.context);
                const recoveryItems = this.materializeQueryBackendItems(
                    recoveryBackendResult,
                    recoveryContextBundle.asOf,
                    recoveryContextBundle.activeEdges,
                    recoveryContextBundle.topK,
                    recoveryContextBundle.titleHitDocumentIds.length > 0
                        ? Math.max(recoveryContextBundle.topK * 6, 24)
                        : recoveryContextBundle.topK
                );
                const recoveryRerankedItems = this.rerankQueryItemsForPlanner(recoveryItems, {
                    titleLikeQueries: recoveryContextBundle.titleLikeQueries,
                    titleHitDocumentIds: recoveryContextBundle.titleHitDocumentIds,
                }).slice(0, recoveryContextBundle.topK);
                if (recoveryRerankedItems.length > 0) {
                    effectiveContextBundle = {
                        ...recoveryContextBundle,
                        scopeRecovery: plannerScopeRecovery,
                    };
                    effectiveBackendResult = recoveryBackendResult;
                    materializedItems = recoveryItems;
                    rerankedItems = recoveryRerankedItems;
                    appliedScopeRecovery = plannerScopeRecovery;
                }
            }
            const metrics = this.summarizeQueryItems(rerankedItems);
            const latencyMs = Date.now() - startedAtMs;
            const rawModeWeights = effectiveBackendResult.trace?.modeWeights || {};
            const retrievalModes = Array.isArray(effectiveBackendResult.trace?.retrievalModes)
                ? [...effectiveBackendResult.trace.retrievalModes]
                : ['keyword', 'graph_traversal', 'temporal_filter'];
            const resolvedScope: KnowledgeQueryResolvedScope = {
                ...effectiveContextBundle.resolvedScope,
                scopeSource: appliedScopeRecovery
                    ? 'planner_scope_recovery'
                    : effectiveContextBundle.resolvedScope.scopeSource,
                missDiagnostics: rerankedItems.length <= 0
                    ? this.buildMissDiagnostics({
                        query: effectiveContextBundle.query,
                        resolvedScope: effectiveContextBundle.resolvedScope,
                        readiness: effectiveContextBundle.readiness,
                        plannerQuery: effectiveContextBundle.titleLikeQueries[0] || effectiveContextBundle.resolvedScope.workspaceId || effectiveContextBundle.resolvedScope.corpusId || '',
                        titleLikeQueries: effectiveContextBundle.titleLikeQueries,
                        titleHitDocumentIds: effectiveContextBundle.titleHitDocumentIds,
                        indexedScopeAtomCount: effectiveContextBundle.atoms.length,
                    })
                    : undefined,
            };
            const trace = {
                retrievalModes: appliedScopeRecovery
                    ? Array.from(new Set([...retrievalModes, 'planner_scope_recovery']))
                    : retrievalModes,
                asOf: effectiveContextBundle.asOf,
                totalActiveAtoms: this.activeAtomIds.size,
                totalAtomsInScope: effectiveContextBundle.atoms.length,
                scope: resolvedScope,
                modeWeights: {
                    keyword: Number(
                        clamp(Number((rawModeWeights as Record<string, unknown>).keyword ?? (backend === 'keyword_only' ? 0.72 : 0.32)), 0, 1)
                            .toFixed(4)
                    ),
                    graph: Number(
                        clamp(Number((rawModeWeights as Record<string, unknown>).graph ?? (backend === 'local_vector' ? 0.1 : 0.3)), 0, 1)
                            .toFixed(4)
                    ),
                    temporal: Number(
                        clamp(Number((rawModeWeights as Record<string, unknown>).temporal ?? 0.18), 0, 1)
                            .toFixed(4)
                    ),
                },
                latencyMs,
                evidenceCoverageRatio: metrics.evidenceCoverageRatio,
                planner: {
                    plannerQuery: effectiveContextBundle.titleLikeQueries[0] || null,
                    titleLikeQueries: [...effectiveContextBundle.titleLikeQueries],
                    titleHitDocumentIds: [...effectiveContextBundle.titleHitDocumentIds],
                },
                ...(appliedScopeRecovery
                    ? {
                        scopeRecovery: {
                            reason: appliedScopeRecovery.reason,
                            requestedScope: {
                                ...appliedScopeRecovery.requestedScope,
                                documentIds: [...appliedScopeRecovery.requestedScope.documentIds],
                                atomIds: [...appliedScopeRecovery.requestedScope.atomIds],
                                sourcePathPrefixes: [...appliedScopeRecovery.requestedScope.sourcePathPrefixes],
                                languages: [...appliedScopeRecovery.requestedScope.languages],
                            },
                            recoveredDocumentIds: [...appliedScopeRecovery.recoveredDocumentIds],
                            recoveredSourcePaths: [...appliedScopeRecovery.recoveredSourcePaths],
                        },
                    }
                    : {}),
                ...(effectiveBackendResult.trace?.vectorAcceleration
                    ? { vectorAcceleration: effectiveBackendResult.trace.vectorAcceleration }
                    : {}),
            } as KnowledgeQueryResponse['trace'] & Record<string, unknown>;
            this.queryBackendLastError = '';
            return {
                backend,
                backendId: String(backendInstance.id || backend).trim() || backend,
                items: rerankedItems,
                trace,
                latencyMs,
                evidenceCoverageRatio: metrics.evidenceCoverageRatio,
                relationPathCoverageRatio: metrics.relationPathCoverageRatio,
                temporalValidityPassRatio: metrics.temporalValidityPassRatio,
                usedFallback: false,
                fallbackBackend: null,
                error: null,
            };
        } catch (error) {
            const errorMessage = String((error as Error)?.message || error || 'query_backend_error')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 280);
            this.queryBackendLastError = errorMessage;
            if (options.allowRuntimeFallback && backend !== 'local_hybrid') {
                const fallbackExecution = await this.executeQueryBackend(
                    request,
                    'local_hybrid',
                    {
                        allowRuntimeFallback: false,
                        recordFallback: false,
                    }
                );
                if (options.recordFallback) {
                    this.queryBackendFallbackCount += 1;
                }
                return {
                    ...fallbackExecution,
                    backend,
                    backendId: String(backendInstance.id || backend).trim() || backend,
                    usedFallback: true,
                    fallbackBackend: 'local_hybrid',
                    error: errorMessage,
                    trace: {
                        ...fallbackExecution.trace,
                        retrievalModes: Array.from(new Set([
                            ...fallbackExecution.trace.retrievalModes,
                            'backend_fallback',
                        ])),
                        backendFallback: {
                            fromBackend: backend,
                            toBackend: 'local_hybrid',
                            reason: errorMessage,
                        },
                    } as KnowledgeQueryResponse['trace'] & Record<string, unknown>,
                };
            }
            throw error;
        }
    }

    private calculateQueryBackendPreferenceScore(side: QueryBackendComparisonSide): number {
        const latencyScore = clamp(1 - Math.min(Math.max(0, side.latencyMs), 1500) / 1500, 0, 1);
        const reliabilityPenalty = side.error ? 0.2 : 0;
        return Number(clamp(
            side.evidenceCoverageRatio * 0.42
            + side.relationPathCoverageRatio * 0.23
            + side.temporalValidityPassRatio * 0.25
            + latencyScore * 0.1
            - reliabilityPenalty,
            0,
            1
        ).toFixed(4));
    }

    private buildQueryBackendComparisonRecord(params: {
        comparedAt: string;
        query: string;
        topK: number;
        left: QueryBackendExecutionResult;
        right: QueryBackendExecutionResult;
    }): QueryBackendComparisonRecord {
        const leftAtomIds = params.left.items.map((item) => item.atom.id);
        const rightAtomIds = params.right.items.map((item) => item.atom.id);
        const overlapRatioPct = Number((computeJaccard(leftAtomIds, rightAtomIds) * 100).toFixed(4));
        const leftSide: QueryBackendComparisonSide = {
            backend: params.left.backend,
            backendId: params.left.backendId,
            latencyMs: params.left.latencyMs,
            itemCount: params.left.items.length,
            evidenceCoverageRatio: params.left.evidenceCoverageRatio,
            relationPathCoverageRatio: params.left.relationPathCoverageRatio,
            temporalValidityPassRatio: params.left.temporalValidityPassRatio,
            usedFallback: params.left.usedFallback,
            fallbackBackend: params.left.fallbackBackend,
            error: params.left.error,
            retrievalModes: [...params.left.trace.retrievalModes],
            modeWeights: {
                ...params.left.trace.modeWeights,
            },
            items: params.left.items.map((item) => ({
                atomId: item.atom.id,
                score: Number(item.score.toFixed(4)),
            })),
        };
        const rightSide: QueryBackendComparisonSide = {
            backend: params.right.backend,
            backendId: params.right.backendId,
            latencyMs: params.right.latencyMs,
            itemCount: params.right.items.length,
            evidenceCoverageRatio: params.right.evidenceCoverageRatio,
            relationPathCoverageRatio: params.right.relationPathCoverageRatio,
            temporalValidityPassRatio: params.right.temporalValidityPassRatio,
            usedFallback: params.right.usedFallback,
            fallbackBackend: params.right.fallbackBackend,
            error: params.right.error,
            retrievalModes: [...params.right.trace.retrievalModes],
            modeWeights: {
                ...params.right.trace.modeWeights,
            },
            items: params.right.items.map((item) => ({
                atomId: item.atom.id,
                score: Number(item.score.toFixed(4)),
            })),
        };
        const leftPreferenceScore = this.calculateQueryBackendPreferenceScore(leftSide);
        const rightPreferenceScore = this.calculateQueryBackendPreferenceScore(rightSide);
        const scoreDelta = Number((leftPreferenceScore - rightPreferenceScore).toFixed(4));
        let preferredBackend: 'left' | 'right' | 'tie' = 'tie';
        if (params.left.error && !params.right.error) {
            preferredBackend = 'right';
        } else if (!params.left.error && params.right.error) {
            preferredBackend = 'left';
        } else if (scoreDelta >= 0.035) {
            preferredBackend = 'left';
        } else if (scoreDelta <= -0.035) {
            preferredBackend = 'right';
        }
        const preferredLabel = preferredBackend === 'left'
            ? leftSide.backend
            : preferredBackend === 'right'
                ? rightSide.backend
                : 'tie';
        const reason = params.left.error || params.right.error
            ? (
                preferredBackend === 'tie'
                    ? `Both backends surfaced execution issues. left=${params.left.error || 'ok'}, right=${params.right.error || 'ok'}.`
                    : `${preferredLabel} was preferred because the counterpart returned an execution issue.`
            )
            : preferredBackend === 'tie'
                ? `Quality scores were near-parity (${leftPreferenceScore.toFixed(4)} vs ${rightPreferenceScore.toFixed(4)}).`
                : `${preferredLabel} delivered the stronger explainability-latency balance (${leftPreferenceScore.toFixed(4)} vs ${rightPreferenceScore.toFixed(4)}).`;
        return {
            comparedAt: params.comparedAt,
            query: params.query,
            topK: params.topK,
            left: leftSide,
            right: rightSide,
            summary: {
                preferredBackend,
                reason,
                overlapRatioPct,
                latencyDeltaMs: Number((leftSide.latencyMs - rightSide.latencyMs).toFixed(4)),
                leftEvidenceCoverageRatio: leftSide.evidenceCoverageRatio,
                rightEvidenceCoverageRatio: rightSide.evidenceCoverageRatio,
                leftRelationPathCoverageRatio: leftSide.relationPathCoverageRatio,
                rightRelationPathCoverageRatio: rightSide.relationPathCoverageRatio,
                leftTemporalValidityPassRatio: leftSide.temporalValidityPassRatio,
                rightTemporalValidityPassRatio: rightSide.temporalValidityPassRatio,
                leftPreferenceScore,
                rightPreferenceScore,
            },
        };
    }

    private recordLearningQualityHistory(record: LearningQualityHistoryRecord): void {
        this.learningQualityHistoryRecords.unshift(record);
        if (this.learningQualityHistoryRecords.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.learningQualityHistoryRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
    }

    private recordQueryBackendComparisonHistory(record: QueryBackendComparisonRecord): void {
        this.queryBackendComparisonHistoryRecords.unshift(record);
        if (this.queryBackendComparisonHistoryRecords.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.queryBackendComparisonHistoryRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
    }

    private resolveStudySessionPlanTrendContextStatus(
        userId: string | null
    ): 'improving' | 'stable' | 'regressing' | 'insufficient_data' {
        const scopedRecords = this.sessionExecutionHistory.filter((record) => !userId || record.userId === userId);
        if (scopedRecords.length <= 0) {
            return 'insufficient_data';
        }
        const recentRecords = scopedRecords.slice(0, 4);
        const averageDelta = recentRecords.reduce((sum, record) => sum + Number(record.averageMasteryDelta || 0), 0)
            / Math.max(1, recentRecords.length);
        if (averageDelta >= 0.02) {
            return 'improving';
        }
        if (averageDelta <= -0.02) {
            return 'regressing';
        }
        return 'stable';
    }

    private evaluateStudySessionPlanQualityInternal(params: {
        request?: Record<string, unknown>;
        sessionPlan: StudySessionResponse;
        userId: string | null;
        evaluatedAt: string;
        source: 'session_execution' | 'manual_evaluation';
        executionRecordId?: string | null;
        executionKind?: StudySessionExecutionRecord['executionKind'] | null;
    }): StudySessionPlanQualityHistoryRecord {
        const request = params.request || {};
        const thresholds = this.resolveStudySessionPlanQualityThresholds(
            (request.thresholds && typeof request.thresholds === 'object'
                ? request.thresholds
                : undefined) as Partial<StudySessionPlanQualityThresholdSet> | undefined
        );
        const actions = Array.isArray(params.sessionPlan.actions) ? params.sessionPlan.actions : [];
        const totalActions = actions.length;
        const evidenceCoverageRatioPct = Number(
            clamp(
                (
                    actions.filter((action) => Array.isArray(action.evidenceSpanIds) && action.evidenceSpanIds.length > 0).length
                    / Math.max(1, totalActions)
                ) * 100,
                0,
                100
            ).toFixed(4)
        );
        const requestedBudget = Number(
            request.expectedActionBudget
            ?? request.actionLimit
            ?? request.maxActions
            ?? params.sessionPlan.summary?.totalActions
            ?? totalActions
        );
        const budgetTarget = Number.isFinite(requestedBudget) && requestedBudget > 0
            ? Math.max(1, Math.floor(requestedBudget))
            : totalActions;
        const budgetDeviationActions = Math.abs(totalActions - budgetTarget);
        const recoveryCount = actions.filter((action) => (
            action.source === 'mastery_path'
            || action.source === 'retrain_plan'
            || action.source === 'misconception_remediation'
        )).length;
        const divergenceCount = actions.filter((action) => action.source === 'divergence_path').length;
        const recoverySharePct = Number(
            clamp((recoveryCount / Math.max(1, totalActions)) * 100, 0, 100).toFixed(4)
        );
        const divergenceSharePct = Number(
            clamp((divergenceCount / Math.max(1, totalActions)) * 100, 0, 100).toFixed(4)
        );
        const trendContextStatus = (
            request.trendContextStatus === 'improving'
            || request.trendContextStatus === 'stable'
            || request.trendContextStatus === 'regressing'
            || request.trendContextStatus === 'insufficient_data'
        )
            ? request.trendContextStatus
            : this.resolveStudySessionPlanTrendContextStatus(params.userId);
        const gates: StudySessionPlanQualityGate[] = [
            {
                gateId: 'total_actions',
                passed: totalActions >= thresholds.minTotalActions,
                comparator: '>=',
                observedValue: totalActions,
                threshold: thresholds.minTotalActions,
                unit: 'count',
                message: 'Session plans should include enough actions to represent a meaningful learning arc.',
            },
            {
                gateId: 'evidence_coverage',
                passed: evidenceCoverageRatioPct >= thresholds.minEvidenceCoverageRatioPct,
                comparator: '>=',
                observedValue: evidenceCoverageRatioPct,
                threshold: thresholds.minEvidenceCoverageRatioPct,
                unit: 'pct',
                message: 'Most session actions should stay evidence-bound.',
            },
            {
                gateId: 'budget_deviation',
                passed: budgetDeviationActions <= thresholds.maxBudgetDeviationActions,
                comparator: '<=',
                observedValue: budgetDeviationActions,
                threshold: thresholds.maxBudgetDeviationActions,
                unit: 'count',
                message: 'Planned action volume should stay near the requested execution budget.',
            },
        ];
        if (trendContextStatus === 'regressing') {
            gates.push({
                gateId: 'recovery_share_regressing',
                passed: recoverySharePct >= thresholds.minRecoverySharePctWhenRegressing,
                comparator: '>=',
                observedValue: recoverySharePct,
                threshold: thresholds.minRecoverySharePctWhenRegressing,
                unit: 'pct',
                message: 'Regressing learners should receive a recovery-heavy action mix.',
            });
            gates.push({
                gateId: 'divergence_share_regressing',
                passed: divergenceSharePct <= thresholds.maxDivergenceSharePctWhenRegressing,
                comparator: '<=',
                observedValue: divergenceSharePct,
                threshold: thresholds.maxDivergenceSharePctWhenRegressing,
                unit: 'pct',
                message: 'Regressing learners should not be overloaded with divergence-first actions.',
            });
        } else if (trendContextStatus === 'improving') {
            gates.push({
                gateId: 'divergence_share_improving',
                passed: divergenceSharePct >= thresholds.minDivergenceSharePctWhenImproving,
                comparator: '>=',
                observedValue: divergenceSharePct,
                threshold: thresholds.minDivergenceSharePctWhenImproving,
                unit: 'pct',
                message: 'Improving learners should preserve some divergence pressure.',
            });
        }
        const failedGateIds = gates.filter((gate) => gate.passed === false).map((gate) => gate.gateId);
        const gatePassRatio = gates.filter((gate) => gate.passed === true).length / Math.max(1, gates.length);
        const budgetScore = 1 - clamp(
            budgetDeviationActions / Math.max(1, thresholds.maxBudgetDeviationActions + 2),
            0,
            1
        );
        const score = Number(clamp(
            gatePassRatio * 0.58
            + (evidenceCoverageRatioPct / 100) * 0.2
            + budgetScore * 0.12
            + (recoverySharePct / 100) * 0.06
            + (1 - divergenceSharePct / 100) * 0.04,
            0,
            1
        ).toFixed(4));
        const confidence = Number(clamp(
            totalActions / Math.max(2, thresholds.minTotalActions * 2),
            totalActions > 0 ? 0.35 : 0,
            1
        ).toFixed(4));
        const overallPassed = failedGateIds.length <= 0;
        const status: StudySessionPlanQualityHistoryRecord['status'] = overallPassed
            ? 'healthy'
            : failedGateIds.length >= 2
                ? 'risk'
                : 'watch';
        const summaryReason = overallPassed
            ? `Plan satisfied ${gates.length}/${gates.length} quality gates with evidence coverage ${evidenceCoverageRatioPct.toFixed(2)} pct.`
            : `Failed gates: ${failedGateIds.join(', ')}. Evidence coverage ${evidenceCoverageRatioPct.toFixed(2)} pct, budget deviation ${budgetDeviationActions}.`;
        return {
            recordId: this.nextId('session_plan_quality'),
            userId: params.userId,
            source: params.source,
            evaluatedAt: params.evaluatedAt,
            planGeneratedAt: isNonEmptyString(params.sessionPlan.generatedAt) ? params.sessionPlan.generatedAt : null,
            executionRecordId: params.executionRecordId || null,
            executionKind: params.executionKind || null,
            trendContextStatus,
            totalActions,
            evidenceCoverageRatioPct,
            budgetDeviationActions,
            recoverySharePct,
            divergenceSharePct,
            overallPassed,
            status,
            score,
            confidence,
            summaryReason,
            thresholds,
            gates,
            failedGateIds,
        };
    }

    private recordStudySessionPlanQualityHistory(record: StudySessionPlanQualityHistoryRecord): void {
        this.studySessionPlanQualityHistoryRecords.unshift(record);
        if (this.studySessionPlanQualityHistoryRecords.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.studySessionPlanQualityHistoryRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
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
        const snapshot = await this.buildSnapshotForPersist();
        await this.store.saveSnapshot(snapshot);
    }

    private async buildSnapshotForPersist(): Promise<KnowledgeGraphSnapshot> {
        const snapshot = this.buildSnapshot();
        if (!this.store || !isOpsAdapter(this.store)) {
            return snapshot;
        }
        try {
            const existingSnapshot = await this.store.loadSnapshot();
            return this.mergeStoreGraphEdgesIntoSnapshot(snapshot, existingSnapshot);
        } catch (_error) {
            return snapshot;
        }
    }

    private mergeStoreGraphEdgesIntoSnapshot(
        snapshot: KnowledgeGraphSnapshot,
        existingSnapshot: KnowledgeGraphSnapshot | null
    ): KnowledgeGraphSnapshot {
        if (!existingSnapshot) {
            return snapshot;
        }
        const activeAtomIds = new Set(snapshot.atoms.map((atom) => atom.id));
        const relationEdgeIds = new Set(snapshot.relationEdges.map((edge) => edge.id));
        const relationEdgeSignatures = new Set(snapshot.relationEdgeSignatures || []);
        const preservedRelationEdges = (existingSnapshot.relationEdges || []).filter((edge) => {
            if (
                !edge
                || !isNonEmptyString(edge.id)
                || relationEdgeIds.has(edge.id)
                || !activeAtomIds.has(edge.sourceAtomId)
                || !activeAtomIds.has(edge.targetAtomId)
            ) {
                return false;
            }
            const signature = this.buildRelationSignature({
                sourceAtomId: edge.sourceAtomId,
                targetAtomId: edge.targetAtomId,
                relationKind: edge.relationKind,
                provenance: edge.provenance,
            });
            if (relationEdgeSignatures.has(signature)) {
                return false;
            }
            relationEdgeSignatures.add(signature);
            return true;
        });

        const temporalEdgeIds = new Set(snapshot.temporalEdges.map((edge) => edge.id));
        const preservedTemporalEdges = (existingSnapshot.temporalEdges || []).filter((edge) => (
            edge
            && isNonEmptyString(edge.id)
            && !temporalEdgeIds.has(edge.id)
            && activeAtomIds.has(edge.sourceAtomId)
            && activeAtomIds.has(edge.targetAtomId)
        ));

        if (preservedRelationEdges.length <= 0 && preservedTemporalEdges.length <= 0) {
            return snapshot;
        }
        return {
            ...snapshot,
            relationEdges: [
                ...snapshot.relationEdges,
                ...preservedRelationEdges.map((edge) => ({ ...edge })),
            ],
            temporalEdges: [
                ...snapshot.temporalEdges,
                ...preservedTemporalEdges.map((edge) => ({ ...edge })),
            ],
            relationEdgeSignatures: Array.from(relationEdgeSignatures.values()),
        };
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
            sourceUri: snapshot.sourceUri,
            revision: snapshot.revision,
            identityAliases: [...snapshot.identityAliases],
            sourceHash: snapshot.sourceHash,
            content: snapshot.content,
            version: snapshot.version,
            updatedAt: snapshot.updatedAt,
            atomStableKeyToId: Array.from(snapshot.atomStableKeyToId.entries()),
            atomIds: [...snapshot.atomIds],
            evidenceSpanIds: [...snapshot.evidenceSpanIds],
            relationEdgeIds: [...snapshot.relationEdgeIds],
            temporalEdgeIds: [...snapshot.temporalEdgeIds],
        }));

        return {
            schemaVersion: 2,
            savedAt,
            idCounter: this.idCounter,
            atoms: Array.from(this.atoms.values()),
            evidenceSpans: Array.from(this.evidenceSpans.values()),
            relationEdges: Array.from(this.relationEdges.values()),
            temporalEdges: Array.from(this.temporalEdges.values()),
            documents,
            identityJournal: this.identityJournal.map((record) => ({ ...record })),
            activeStableKeyToAtomId: Array.from(this.activeStableKeyToAtomId.entries()),
            activeAtomIds: Array.from(this.activeAtomIds.values()),
            learnerStates: Array.from(this.learnerStates.values()),
            tutorTraces: [...this.tutorTraces],
            ingestLatencyHistoryMs: [...this.ingestLatencyHistoryMs],
            recomputeLatencyHistoryMs: [...this.recomputeLatencyHistoryMs],
            queryLatencyHistoryMs: [...this.queryLatencyHistoryMs],
            latestIngestSummary: this.latestIngestSummary ? { ...this.latestIngestSummary } : null,
            sessionActionTelemetry: this.buildSessionActionTelemetry(),
            sessionExecutionHistory: this.sessionExecutionHistory.map((record) => ({ ...record })),
            learningQualityHistoryRecords: this.learningQualityHistoryRecords.map((record) => ({
                ...record,
                snapshot: this.cloneLearningQualitySnapshot(record.snapshot),
                diagnostics: { ...record.diagnostics },
            })),
            queryBackendComparisonHistoryRecords: this.queryBackendComparisonHistoryRecords.map((record) => ({
                ...record,
                left: {
                    ...record.left,
                    retrievalModes: [...record.left.retrievalModes],
                    modeWeights: { ...record.left.modeWeights },
                    items: record.left.items.map((item) => ({ ...item })),
                },
                right: {
                    ...record.right,
                    retrievalModes: [...record.right.retrievalModes],
                    modeWeights: { ...record.right.modeWeights },
                    items: record.right.items.map((item) => ({ ...item })),
                },
                summary: { ...record.summary },
            })),
            studySessionPlanQualityHistoryRecords: this.studySessionPlanQualityHistoryRecords.map((record) => ({
                ...record,
                thresholds: { ...record.thresholds },
                gates: record.gates.map((gate) => ({ ...gate })),
                failedGateIds: [...record.failedGateIds],
            })),
            memoryPolicyDiagnosticsHistoryRecords: this.memoryPolicyDiagnosticsHistoryRecords.map((record) => ({ ...record })),
            queryBackendFallbackCount: this.queryBackendFallbackCount,
            queryBackendLastError: this.queryBackendLastError,
            conversationSessions: Array.from(this.conversationSessions.values()).map((record) => ({
                ...record,
                turnIds: [...record.turnIds],
            })),
            conversationTurns: Array.from(this.conversationTurns.values()).map((record) => ({
                ...record,
                request: { ...record.request },
                response: {
                    ...record.response,
                    assistantBlocks: this.cloneAgentConversationAssistantBlocks(record.response.assistantBlocks),
                    knowledgeRun: record.response.knowledgeRun
                        ? this.cloneKnowledgeRun(record.response.knowledgeRun)
                        : undefined,
                    knowledgePoints: record.response.knowledgePoints.map((point) => this.cloneAgentConversationKnowledgePoint(point)),
                    citations: record.response.citations.map((citation) => ({ ...citation })),
                    recalledMemories: record.response.recalledMemories.map((memory) => ({
                        ...memory,
                        tags: [...memory.tags],
                        references: [...memory.references],
                    })),
                    memoryActions: record.response.memoryActions.map((action) => ({ ...action })),
                    summary: { ...record.response.summary },
                    trace: {
                        ...record.response.trace,
                        retrieval: {
                            ...record.response.trace.retrieval,
                            retrievalModes: [...record.response.trace.retrieval.retrievalModes],
                            modeWeights: { ...record.response.trace.retrieval.modeWeights },
                            planner: record.response.trace.retrieval.planner
                                ? {
                                    ...record.response.trace.retrieval.planner,
                                    titleLikeQueries: [...(record.response.trace.retrieval.planner.titleLikeQueries || [])],
                                    titleHitDocumentIds: [...(record.response.trace.retrieval.planner.titleHitDocumentIds || [])],
                                }
                                : undefined,
                            scope: record.response.trace.retrieval.scope ? {
                                ...record.response.trace.retrieval.scope,
                                documentIds: [...record.response.trace.retrieval.scope.documentIds],
                                atomIds: [...record.response.trace.retrieval.scope.atomIds],
                                sourcePathPrefixes: [...record.response.trace.retrieval.scope.sourcePathPrefixes],
                                languages: [...record.response.trace.retrieval.scope.languages],
                            } : undefined,
                        },
                        usedScope: {
                            ...record.response.trace.usedScope,
                            documentIds: [...record.response.trace.usedScope.documentIds],
                            atomIds: [...record.response.trace.usedScope.atomIds],
                            sourcePathPrefixes: [...record.response.trace.usedScope.sourcePathPrefixes],
                            languages: [...record.response.trace.usedScope.languages],
                            readiness: record.response.trace.usedScope.readiness
                                ? { ...record.response.trace.usedScope.readiness }
                                : undefined,
                            missDiagnostics: record.response.trace.usedScope.missDiagnostics
                                ? {
                                    ...record.response.trace.usedScope.missDiagnostics,
                                    titleLikeQueries: [...(record.response.trace.usedScope.missDiagnostics.titleLikeQueries || [])],
                                    titleHitDocumentIds: [...(record.response.trace.usedScope.missDiagnostics.titleHitDocumentIds || [])],
                                }
                                : undefined,
                        },
                        workspaceReadiness: record.response.trace.workspaceReadiness
                            ? { ...record.response.trace.workspaceReadiness }
                            : undefined,
                        missDiagnostics: record.response.trace.missDiagnostics
                            ? {
                                ...record.response.trace.missDiagnostics,
                                titleLikeQueries: [...(record.response.trace.missDiagnostics.titleLikeQueries || [])],
                                titleHitDocumentIds: [...(record.response.trace.missDiagnostics.titleHitDocumentIds || [])],
                            }
                            : undefined,
                        planner: record.response.trace.planner
                            ? {
                                ...record.response.trace.planner,
                                titleLikeQueries: [...(record.response.trace.planner.titleLikeQueries || [])],
                                titleHitDocumentIds: [...(record.response.trace.planner.titleHitDocumentIds || [])],
                            }
                            : undefined,
                        graphContext: this.cloneAgentConversationGraphContext(record.response.trace.graphContext),
                    },
                },
            })),
            conversationInvocations: this.conversationInvocations.map((record) => ({ ...record })),
            resourceRegistry: this.resourceRegistry.buildSnapshot(),
            workspaceRegistry: this.workspaceRegistry.buildSnapshot(),
            indexLifecycle: this.indexLifecycle.buildSnapshot(),
            sessionStateSnapshot: this.sessionStateStore.buildSnapshot(),
            workflowArtifacts: this.workflowArtifactStore.buildSnapshot(),
            memoryAuditRecords: this.memoryAuditRecords.map((record) => ({ ...record })),
            userMemory,
            relationEdgeSignatures: Array.from(this.relationEdgeSignatures.values()),
        };
    }

    /**
     * The mutation path updates records in place. A JSON clone gives rollback
     * an immutable pre-image while retaining the existing versioned snapshot
     * contract used by every host adapter.
     */
    private cloneKnowledgeGraphSnapshotForTransaction(snapshot: KnowledgeGraphSnapshot): KnowledgeGraphSnapshot {
        return JSON.parse(JSON.stringify(snapshot)) as KnowledgeGraphSnapshot;
    }

    private restoreFromSnapshot(snapshot: KnowledgeGraphSnapshot): void {
        this.idCounter = Number(snapshot.idCounter || 0);
        this.identityJournal.length = 0;
        (snapshot.identityJournal || []).forEach((record) => {
            if (!record || typeof record !== 'object' || !isNonEmptyString(record.documentId)) {
                return;
            }
            const toSourcePath = String(record.toSourcePath || '').replace(/\\/g, '/').trim();
            if (!toSourcePath) {
                return;
            }
            this.identityJournal.push({
                documentId: record.documentId.trim(),
                fromSourcePath: isNonEmptyString(record.fromSourcePath) ? record.fromSourcePath.replace(/\\/g, '/') : undefined,
                toSourcePath,
                fromSourceUri: isNonEmptyString(record.fromSourceUri) ? record.fromSourceUri.trim() : undefined,
                toSourceUri: isNonEmptyString(record.toSourceUri) ? record.toSourceUri.trim() : undefined,
                revision: isNonEmptyString(record.revision) ? record.revision.trim() : undefined,
                recordedAt: this.resolveOptionalTimestamp(record.recordedAt) || this.resolveTimestamp(undefined),
                reason: record.reason === 'move' ? 'move' : 'upsert_identity_change',
            });
        });
        if (this.identityJournal.length > 2048) {
            this.identityJournal.splice(0, this.identityJournal.length - 2048);
        }
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
        this.sessionActionTelemetry = this.normalizeSessionActionTelemetry(snapshot.sessionActionTelemetry);
        this.sessionExecutionHistory.length = 0;
        (snapshot.sessionExecutionHistory || []).forEach((record) => {
            const normalized = this.normalizeSessionExecutionRecord(record, this.resolveTimestamp(undefined));
            if (normalized) {
                this.sessionExecutionHistory.push(normalized);
            }
        });
        this.sessionExecutionHistory.sort((left, right) => right.executedAt.localeCompare(left.executedAt));
        if (this.sessionExecutionHistory.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.sessionExecutionHistory.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
        this.learningQualityHistoryRecords.length = 0;
        (snapshot.learningQualityHistoryRecords || []).forEach((record) => {
            if (!record || typeof record !== 'object') {
                return;
            }
            const raw = record as Partial<LearningQualityHistoryRecord>;
            const sampledAt = this.resolveOptionalTimestamp(raw.sampledAt) || this.resolveTimestamp(undefined);
            this.learningQualityHistoryRecords.push({
                recordId: isNonEmptyString(raw.recordId) ? raw.recordId : this.nextId('learning_quality_restored'),
                userId: isNonEmptyString(raw.userId) ? raw.userId : null,
                sampledAt,
                source: raw.source === 'manual_snapshot' ? 'manual_snapshot' : 'session_execution',
                executionRecordId: isNonEmptyString(raw.executionRecordId) ? raw.executionRecordId : null,
                executionKind: raw.executionKind === 'retest' || raw.executionKind === 'custom' || raw.executionKind === 'session'
                    ? raw.executionKind
                    : null,
                snapshot: this.normalizeLearningQualitySnapshot(
                    (raw.snapshot || {}) as LearningQualitySnapshot,
                    this.buildRetrievalTelemetry().queryP95Ms
                ),
                diagnostics: raw.diagnostics && typeof raw.diagnostics === 'object'
                    ? { ...(raw.diagnostics as Record<string, unknown>) }
                    : {},
            });
        });
        this.learningQualityHistoryRecords.sort((left, right) => right.sampledAt.localeCompare(left.sampledAt));
        if (this.learningQualityHistoryRecords.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.learningQualityHistoryRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
        this.queryBackendComparisonHistoryRecords.length = 0;
        (snapshot.queryBackendComparisonHistoryRecords || []).forEach((record) => {
            if (!record || typeof record !== 'object') {
                return;
            }
            this.queryBackendComparisonHistoryRecords.push(record as QueryBackendComparisonRecord);
        });
        this.queryBackendComparisonHistoryRecords.sort((left, right) => right.comparedAt.localeCompare(left.comparedAt));
        if (this.queryBackendComparisonHistoryRecords.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.queryBackendComparisonHistoryRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
        this.studySessionPlanQualityHistoryRecords.length = 0;
        (snapshot.studySessionPlanQualityHistoryRecords || []).forEach((record) => {
            if (!record || typeof record !== 'object') {
                return;
            }
            const raw = record as Partial<StudySessionPlanQualityHistoryRecord>;
            this.studySessionPlanQualityHistoryRecords.push({
                recordId: isNonEmptyString(raw.recordId) ? raw.recordId : this.nextId('session_plan_quality_restored'),
                userId: isNonEmptyString(raw.userId) ? raw.userId : null,
                source: raw.source === 'manual_evaluation' ? 'manual_evaluation' : 'session_execution',
                evaluatedAt: this.resolveOptionalTimestamp(raw.evaluatedAt) || this.resolveTimestamp(undefined),
                planGeneratedAt: this.resolveOptionalTimestamp(raw.planGeneratedAt) || null,
                executionRecordId: isNonEmptyString(raw.executionRecordId) ? raw.executionRecordId : null,
                executionKind: raw.executionKind === 'retest' || raw.executionKind === 'custom' || raw.executionKind === 'session'
                    ? raw.executionKind
                    : null,
                trendContextStatus: raw.trendContextStatus === 'improving'
                    || raw.trendContextStatus === 'stable'
                    || raw.trendContextStatus === 'regressing'
                    || raw.trendContextStatus === 'insufficient_data'
                    ? raw.trendContextStatus
                    : 'stable',
                totalActions: Math.max(0, Math.floor(Number(raw.totalActions || 0))),
                evidenceCoverageRatioPct: Number(clamp(Number(raw.evidenceCoverageRatioPct || 0), 0, 100).toFixed(4)),
                budgetDeviationActions: Math.max(0, Math.floor(Number(raw.budgetDeviationActions || 0))),
                recoverySharePct: Number(clamp(Number(raw.recoverySharePct || 0), 0, 100).toFixed(4)),
                divergenceSharePct: Number(clamp(Number(raw.divergenceSharePct || 0), 0, 100).toFixed(4)),
                overallPassed: raw.overallPassed === true,
                status: raw.status === 'healthy' || raw.status === 'watch' || raw.status === 'risk'
                    ? raw.status
                    : 'watch',
                score: Number(clamp(Number(raw.score || 0), 0, 1).toFixed(4)),
                confidence: Number(clamp(Number(raw.confidence || 0), 0, 1).toFixed(4)),
                summaryReason: String(raw.summaryReason || '').trim(),
                thresholds: this.resolveStudySessionPlanQualityThresholds(
                    (raw.thresholds || {}) as Partial<StudySessionPlanQualityThresholdSet>
                ),
                gates: Array.isArray(raw.gates)
                    ? raw.gates
                        .filter((gate): gate is StudySessionPlanQualityGate => Boolean(gate && typeof gate === 'object'))
                        .map((gate) => ({
                            gateId: String(gate.gateId || '').trim(),
                            passed: gate.passed === true,
                            comparator: gate.comparator === '>=' ? '>=' : '<=',
                            observedValue: Number(gate.observedValue || 0),
                            threshold: Number(gate.threshold || 0),
                            unit: gate.unit === 'count' ? 'count' : 'pct',
                            message: String(gate.message || '').trim(),
                        }))
                    : [],
                failedGateIds: Array.isArray(raw.failedGateIds)
                    ? raw.failedGateIds.map((gateId) => String(gateId || '').trim()).filter(Boolean)
                    : [],
            });
        });
        this.studySessionPlanQualityHistoryRecords.sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt));
        if (this.studySessionPlanQualityHistoryRecords.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.studySessionPlanQualityHistoryRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
        this.memoryPolicyDiagnosticsHistoryRecords.length = 0;
        (snapshot.memoryPolicyDiagnosticsHistoryRecords || []).forEach((record) => {
            if (record && typeof record === 'object') {
                this.memoryPolicyDiagnosticsHistoryRecords.push({ ...record });
            }
        });
        this.memoryPolicyDiagnosticsHistoryRecords.sort((left, right) =>
            String(right.recordedAt || '').localeCompare(String(left.recordedAt || ''))
        );
        if (this.memoryPolicyDiagnosticsHistoryRecords.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.memoryPolicyDiagnosticsHistoryRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
        this.queryBackendFallbackCount = Math.max(0, Math.floor(Number(snapshot.queryBackendFallbackCount || 0)));
        this.queryBackendLastError = String(snapshot.queryBackendLastError || '').trim();

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
                sourceUri: documentSnapshot.sourceUri,
                revision: documentSnapshot.revision,
                identityAliases: Array.isArray(documentSnapshot.identityAliases)
                    ? [...documentSnapshot.identityAliases]
                    : [],
                sourceHash: documentSnapshot.sourceHash,
                content: typeof documentSnapshot.content === 'string' ? documentSnapshot.content : undefined,
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
            const normalizedLearnerState = this.normalizeLearnerState(learnerState, this.resolveTimestamp(undefined));
            const key = this.makeLearnerStateKey(normalizedLearnerState.userId, normalizedLearnerState.atomId);
            this.learnerStates.set(key, normalizedLearnerState);
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

        this.conversationSessions.clear();
        (snapshot.conversationSessions || []).forEach((record) => {
            if (!isNonEmptyString(record?.sessionId) || !isNonEmptyString(record?.userId)) {
                return;
            }
            this.conversationSessions.set(record.sessionId, {
                ...record,
                turnIds: Array.isArray(record.turnIds) ? [...record.turnIds] : [],
            });
        });

        this.conversationTurns.clear();
        (snapshot.conversationTurns || []).forEach((record) => {
            if (!isNonEmptyString(record?.turnId) || !isNonEmptyString(record?.sessionId) || !record?.response) {
                return;
            }
            this.conversationTurns.set(record.turnId, {
                ...record,
                request: { ...(record.request || {}) },
                response: {
                    ...record.response,
                    assistantBlocks: this.cloneAgentConversationAssistantBlocks(record.response.assistantBlocks),
                    knowledgeRun: record.response.knowledgeRun
                        ? this.cloneKnowledgeRun(record.response.knowledgeRun)
                        : undefined,
                    knowledgePoints: Array.isArray(record.response.knowledgePoints)
                        ? record.response.knowledgePoints.map((point) => this.cloneAgentConversationKnowledgePoint(point))
                        : [],
                    citations: Array.isArray(record.response.citations)
                        ? record.response.citations.map((citation) => ({ ...citation }))
                        : [],
                    recalledMemories: Array.isArray(record.response.recalledMemories)
                        ? record.response.recalledMemories.map((memory) => ({
                            ...memory,
                            tags: Array.isArray(memory.tags) ? [...memory.tags] : [],
                            references: Array.isArray(memory.references) ? [...memory.references] : [],
                        }))
                        : [],
                    memoryActions: Array.isArray(record.response.memoryActions)
                        ? record.response.memoryActions.map((action) => ({ ...action }))
                        : [],
                    summary: { ...(record.response.summary || {}) },
                    trace: {
                        ...(record.response.trace || {}),
                        retrieval: {
                            ...(record.response.trace?.retrieval || {}),
                            retrievalModes: Array.isArray(record.response.trace?.retrieval?.retrievalModes)
                                ? [...record.response.trace.retrieval.retrievalModes]
                                : [],
                            modeWeights: { ...(record.response.trace?.retrieval?.modeWeights || {}) },
                            planner: record.response.trace?.retrieval?.planner
                                ? {
                                    ...record.response.trace.retrieval.planner,
                                    titleLikeQueries: [...(record.response.trace.retrieval.planner.titleLikeQueries || [])],
                                    titleHitDocumentIds: [...(record.response.trace.retrieval.planner.titleHitDocumentIds || [])],
                                }
                                : undefined,
                            scope: record.response.trace?.retrieval?.scope ? {
                                ...record.response.trace.retrieval.scope,
                                documentIds: [...(record.response.trace.retrieval.scope.documentIds || [])],
                                atomIds: [...(record.response.trace.retrieval.scope.atomIds || [])],
                                sourcePathPrefixes: [...(record.response.trace.retrieval.scope.sourcePathPrefixes || [])],
                                languages: [...(record.response.trace.retrieval.scope.languages || [])],
                            } : undefined,
                        },
                        usedScope: record.response.trace?.usedScope ? {
                            ...record.response.trace.usedScope,
                            documentIds: [...(record.response.trace.usedScope.documentIds || [])],
                            atomIds: [...(record.response.trace.usedScope.atomIds || [])],
                            sourcePathPrefixes: [...(record.response.trace.usedScope.sourcePathPrefixes || [])],
                            languages: [...(record.response.trace.usedScope.languages || [])],
                            readiness: record.response.trace.usedScope.readiness
                                ? { ...record.response.trace.usedScope.readiness }
                                : undefined,
                            missDiagnostics: record.response.trace.usedScope.missDiagnostics
                                ? {
                                    ...record.response.trace.usedScope.missDiagnostics,
                                    titleLikeQueries: [...(record.response.trace.usedScope.missDiagnostics.titleLikeQueries || [])],
                                    titleHitDocumentIds: [...(record.response.trace.usedScope.missDiagnostics.titleHitDocumentIds || [])],
                                }
                                : undefined,
                        } : {
                            source: 'global',
                            workspaceId: null,
                            corpusId: null,
                            documentIds: [],
                            atomIds: [],
                            sourcePathPrefixes: [],
                            languages: [],
                            matchedAtomCount: 0,
                        },
                        workspaceReadiness: record.response.trace?.workspaceReadiness
                            ? { ...record.response.trace.workspaceReadiness }
                            : undefined,
                        missDiagnostics: record.response.trace?.missDiagnostics
                            ? {
                                ...record.response.trace.missDiagnostics,
                                titleLikeQueries: [...(record.response.trace.missDiagnostics.titleLikeQueries || [])],
                                titleHitDocumentIds: [...(record.response.trace.missDiagnostics.titleHitDocumentIds || [])],
                            }
                            : undefined,
                        planner: record.response.trace?.planner
                            ? {
                                ...record.response.trace.planner,
                                titleLikeQueries: [...(record.response.trace.planner.titleLikeQueries || [])],
                                titleHitDocumentIds: [...(record.response.trace.planner.titleHitDocumentIds || [])],
                            }
                            : undefined,
                        graphContext: this.cloneAgentConversationGraphContext(record.response.trace?.graphContext),
                    },
                },
            });
        });

        this.conversationInvocations.splice(0, this.conversationInvocations.length, ...(
            Array.isArray(snapshot.conversationInvocations)
                ? snapshot.conversationInvocations
                    .filter((record) => isNonEmptyString(record?.invocationId) && isNonEmptyString(record?.sessionId))
                    .map((record) => ({ ...record }))
                : []
        ));
        this.resourceRegistry.restoreFromSnapshot(snapshot.resourceRegistry);
        this.workspaceRegistry.restoreFromSnapshot(snapshot.workspaceRegistry);
        this.indexLifecycle.restoreFromSnapshot(snapshot.indexLifecycle);
        this.sessionStateStore.restoreFromSnapshot(snapshot.sessionStateSnapshot);
        this.workflowArtifactStore.restoreFromSnapshot(snapshot.workflowArtifacts);
        this.memoryAuditRecords.splice(
            0,
            this.memoryAuditRecords.length,
            ...(
                Array.isArray(snapshot.memoryAuditRecords)
                    ? snapshot.memoryAuditRecords
                        .filter((record) => isNonEmptyString(record?.auditId) && isNonEmptyString(record?.memoryKey))
                        .map((record) => ({ ...record }))
                    : []
            )
        );

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

    private deriveDocumentDisplayTitle(documentInput: NormalizedKnowledgeDocumentInput): string {
        const normalizedPath = String(documentInput.sourcePath || '').replace(/\\/g, '/');
        const pathSegments = normalizedPath.split('/').filter(Boolean);
        const fileName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : documentInput.documentId;
        return fileName.replace(/\.[^.]+$/g, '') || documentInput.documentId;
    }

    private syncResourceAndWorkspaceForDocument(params: {
        document: NormalizedKnowledgeDocumentInput;
        sourceHash: string;
        version: number;
        updatedAt: string;
    }): {
        workspace: WorkspaceRecord;
        resource: CanonicalResourceRecord;
        projection: ResourceProjectionRecord;
        binding: WorkspaceBindingRecord;
    } {
        const workspace = this.workspaceRegistry.ensureWorkspace({
            workspaceId: params.document.workspaceId,
            corpusId: params.document.corpusId,
            sourcePath: params.document.sourcePath,
            language: params.document.language,
            exportProfileId: params.document.exportProfileId,
            createdAt: params.updatedAt,
        });
        const { resource, projection } = this.resourceRegistry.upsertKnowledgeDocument({
            documentId: params.document.documentId,
            sourcePath: params.document.sourcePath,
            content: params.document.content,
            sourceHash: params.sourceHash,
            title: this.deriveDocumentDisplayTitle(params.document),
            language: params.document.language,
            version: params.version,
            workspaceId: workspace.workspaceId,
            corpusId: workspace.corpusId,
            updatedAt: params.updatedAt,
            metadata: {
                ...params.document.metadata,
                sourceUri: params.document.sourceUri,
                revision: params.document.revision,
                identityAliases: [...params.document.identityAliases],
                exportProfileId: workspace.exportProfileId,
            },
        });
        const binding = this.workspaceRegistry.bindProjection({
            workspaceId: workspace.workspaceId,
            corpusId: workspace.corpusId,
            resourceId: resource.resourceId,
            projectionId: projection.projectionId,
            documentId: params.document.documentId,
            sourcePath: params.document.sourcePath,
            boundAt: params.updatedAt,
        });
        return {
            workspace,
            resource,
            projection,
            binding,
        };
    }

    private syncIndexLifecycleForDocument(params: {
        document: NormalizedKnowledgeDocumentInput;
        sourceHash: string;
        snapshot: DocumentSnapshot;
        atoms: KnowledgeAtom[];
        resource: CanonicalResourceRecord;
        projection: ResourceProjectionRecord;
        workspace: WorkspaceRecord;
        indexedAt: string;
    }): {
        units: IndexUnitRecord[];
        segments: IndexSegmentRecord[];
    } {
        return this.indexLifecycle.syncDocumentIndex({
            resourceId: params.resource.resourceId,
            projectionId: params.projection.projectionId,
            documentId: params.document.documentId,
            sourcePath: params.document.sourcePath,
            language: params.document.language,
            workspaceId: params.workspace.workspaceId,
            corpusId: params.workspace.corpusId,
            title: this.deriveDocumentDisplayTitle(params.document),
            content: params.document.content,
            atoms: params.atoms,
            indexedAt: params.indexedAt,
        });
    }

    private resolveResourceAndProjectionByDocumentId(documentId: string): {
        resource: CanonicalResourceRecord | null;
        projection: ResourceProjectionRecord | null;
        binding: WorkspaceBindingRecord | null;
    } {
        const projection = this.resourceRegistry.getProjectionByDocumentId(documentId);
        const resource = projection ? this.resourceRegistry.getResourceById(projection.resourceId) : null;
        const binding = this.workspaceRegistry.resolveBindingByDocumentId(documentId);
        return { resource, projection, binding };
    }

    private resolveSourceResourceIdsForAtomIds(atomIds: string[]): string[] {
        const resourceIds = new Set<string>();
        atomIds.forEach((atomId) => {
            const atom = this.atoms.get(atomId);
            if (!atom) {
                return;
            }
            const projection = this.resourceRegistry.getProjectionByDocumentId(atom.documentId);
            if (projection) {
                resourceIds.add(projection.resourceId);
            }
        });
        return Array.from(resourceIds.values());
    }

    private resolveSourceProjectionIdsForAtomIds(atomIds: string[]): string[] {
        const projectionIds = new Set<string>();
        atomIds.forEach((atomId) => {
            const atom = this.atoms.get(atomId);
            if (!atom) {
                return;
            }
            const projection = this.resourceRegistry.getProjectionByDocumentId(atom.documentId);
            if (projection) {
                projectionIds.add(projection.projectionId);
            }
        });
        return Array.from(projectionIds.values());
    }

    private resolveWorkspaceContextForAtomIds(atomIds: string[]): {
        workspaceId: string | null;
        corpusId: string | null;
        exportProfileId: string | null;
    } {
        for (const atomId of atomIds) {
            const atom = this.atoms.get(atomId);
            if (!atom) {
                continue;
            }
            const binding = this.workspaceRegistry.resolveBindingByDocumentId(atom.documentId);
            if (!binding) {
                continue;
            }
            const workspace = this.workspaceRegistry.listActiveWorkspaces().find((item) => item.workspaceId === binding.workspaceId);
            return {
                workspaceId: binding.workspaceId,
                corpusId: binding.corpusId,
                exportProfileId: workspace?.exportProfileId || null,
            };
        }
        return {
            workspaceId: null,
            corpusId: null,
            exportProfileId: null,
        };
    }

    private getWorkspaceById(workspaceId: string | null | undefined): WorkspaceRecord | null {
        return isNonEmptyString(workspaceId)
            ? this.workspaceRegistry.getWorkspaceById(workspaceId)
            : null;
    }

    private resolveWorkspaceContextForReferences(references: string[]): {
        workspaceId: string | null;
        corpusId: string | null;
        exportProfileId: string | null;
    } {
        const atomIds = references.filter((reference) => this.activeAtomIds.has(String(reference || '').trim()));
        if (atomIds.length > 0) {
            return this.resolveWorkspaceContextForAtomIds(atomIds);
        }
        for (const reference of references) {
            const evidenceSpan = this.evidenceSpans.get(String(reference || '').trim());
            if (!evidenceSpan) {
                continue;
            }
            const binding = this.workspaceRegistry.resolveBindingByDocumentId(evidenceSpan.documentId);
            if (!binding) {
                continue;
            }
            const workspace = this.getWorkspaceById(binding.workspaceId);
            return {
                workspaceId: binding.workspaceId,
                corpusId: binding.corpusId,
                exportProfileId: workspace?.exportProfileId || null,
            };
        }
        return {
            workspaceId: null,
            corpusId: null,
            exportProfileId: null,
        };
    }

    private normalizeDocumentInput(input: KnowledgeDocumentInput): NormalizedKnowledgeDocumentInput {
        const sourcePath = isNonEmptyString(input.sourcePath) ? input.sourcePath : `untitled_${this.nextId('doc')}.md`;
        const documentId = isNonEmptyString(input.documentId)
            ? input.documentId
            : normalizeIdentifier(sourcePath);
        const language = isNonEmptyString(input.language) ? input.language.trim() : 'unknown';
        return {
            documentId,
            sourcePath: sourcePath.replace(/\\/g, '/'),
            sourceUri: isNonEmptyString(input.sourceUri) ? input.sourceUri.trim() : undefined,
            revision: isNonEmptyString(input.revision) ? input.revision.trim() : undefined,
            identityAliases: Array.isArray(input.identityAliases)
                ? Array.from(new Set(input.identityAliases.filter(isNonEmptyString).map((alias) => alias.trim())))
                : [],
            content: String(input.content || ''),
            language,
            updatedAt: this.resolveTimestamp(input.updatedAt),
            workspaceId: isNonEmptyString(input.workspaceId) ? input.workspaceId.trim().toLowerCase() : null,
            corpusId: isNonEmptyString(input.corpusId) ? input.corpusId.trim().toLowerCase() : null,
            exportProfileId: isNonEmptyString(input.exportProfileId) ? input.exportProfileId.trim() : null,
            metadata: input.metadata && typeof input.metadata === 'object'
                ? { ...(input.metadata as Record<string, unknown>) }
                : {},
        };
    }

    private hasIdentityChanged(
        previous: DocumentSnapshot,
        next: NormalizedKnowledgeDocumentInput,
    ): boolean {
        return previous.sourcePath !== next.sourcePath
            || (next.sourceUri !== undefined && previous.sourceUri !== next.sourceUri)
            || (next.revision !== undefined && previous.revision !== next.revision)
            || (next.identityAliases.length > 0
                && next.identityAliases.some((alias) => !previous.identityAliases.includes(alias)));
    }

    /** Rejects aliases already owned by another document before any mutation. */
    private assertIdentityAliasesAvailable(documentId: string, candidateAliases: Array<string | undefined>): void {
        const normalizedCandidateAliases = candidateAliases
            .filter(isNonEmptyString)
            .map((alias) => normalizeResourceReference(alias.trim()));
        const conflicts: string[] = [];
        this.documents.forEach((snapshot) => {
            if (snapshot.documentId === documentId) {
                return;
            }
            const ownedAliases = [
                snapshot.sourcePath,
                snapshot.sourceUri,
                ...snapshot.identityAliases,
            ]
                .filter(isNonEmptyString)
                .map((alias) => normalizeResourceReference(alias));
            const collision = normalizedCandidateAliases.find((alias) => ownedAliases.includes(alias));
            if (collision) {
                conflicts.push(`${snapshot.documentId}:${collision}`);
            }
        });
        if (conflicts.length > 0) {
            throw new Error(
                `Identity transition alias collision for ${documentId}; candidate aliases are already owned: ${conflicts.join(', ')}`,
            );
        }
    }

    /**
     * A move must not claim an alias already owned by another document. The
     * legacy path and every historical alias remain searchable, so this check
     * covers the complete compatibility alias set before mutation.
     */
    private assertIdentityTransitionIsAvailable(
        documentId: string,
        input: Pick<KnowledgeDocumentMoveInput, 'toSourcePath' | 'toSourceUri' | 'toIdentityAliases'>,
    ): void {
        const current = this.documents.get(documentId);
        if (!current) {
            throw new Error(`Identity transition references an unknown document: ${documentId}.`);
        }
        this.assertIdentityAliasesAvailable(documentId, [
            current.sourcePath,
            current.sourceUri,
            input.toSourcePath,
            input.toSourceUri,
            ...(input.toIdentityAliases || []),
        ]);
    }

    private resolveDocumentIdForMove(input: KnowledgeDocumentMoveInput): string | null {
        if (isNonEmptyString(input.documentId)) {
            const documentId = input.documentId.trim();
            const current = this.documents.get(documentId);
            if (!current) {
                return documentId;
            }
            const sourceAliases = [input.fromSourcePath, input.fromSourceUri, ...(input.fromIdentityAliases || [])]
                .filter(isNonEmptyString)
                .map((alias) => normalizeResourceReference(alias.trim()));
            if (sourceAliases.length > 0) {
                const ownedAliases = [current.sourcePath, current.sourceUri, ...current.identityAliases]
                    .filter(isNonEmptyString)
                    .map((alias) => normalizeResourceReference(alias));
                if (!sourceAliases.some((alias) => ownedAliases.includes(alias))) {
                    throw new Error(`Move source aliases do not belong to document: ${documentId}.`);
                }
            }
            return documentId;
        }
        const aliases = [input.fromSourcePath, input.fromSourceUri, ...(input.fromIdentityAliases || [])]
            .filter(isNonEmptyString)
            .map((alias) => normalizeResourceReference(alias.trim()));
        const matches = Array.from(this.documents.values()).filter((snapshot) => {
            const snapshotAliases = [snapshot.sourcePath, snapshot.sourceUri, ...snapshot.identityAliases]
                .filter(isNonEmptyString);
            const normalizedSnapshotAliases = snapshotAliases.map((alias) => normalizeResourceReference(alias));
            return aliases.some((alias) => normalizedSnapshotAliases.includes(alias));
        });
        if (matches.length > 1) {
            throw new Error(
                `Move source alias is ambiguous; it is owned by multiple documents: ${matches
                    .map((snapshot) => snapshot.documentId)
                    .join(', ')}`,
            );
        }
        return matches[0]?.documentId || null;
    }

    private applyDocumentIdentityTransition(
        documentId: string,
        input: Pick<KnowledgeDocumentMoveInput, 'toSourcePath' | 'toSourceUri' | 'toIdentityAliases' | 'revision' | 'updatedAt'>,
        recordedAt: string,
        reason: IdentityTransitionRecord['reason'],
    ): void {
        const snapshot = this.documents.get(documentId);
        if (!snapshot) {
            throw new Error(`Identity transition references an unknown document: ${documentId}.`);
        }
        const toSourcePath = String(input.toSourcePath || '').replace(/\\/g, '/').trim();
        if (!toSourcePath) {
            throw new Error('Identity transition requires a non-empty toSourcePath.');
        }
        this.assertIdentityTransitionIsAvailable(documentId, input);
        const previousSourcePath = snapshot.sourcePath;
        const previousSourceUri = snapshot.sourceUri;
        const historicalAliases = [
            ...snapshot.identityAliases,
            previousSourcePath,
            previousSourceUri,
        ].filter(isNonEmptyString);
        const nextAliases = Array.from(new Set([
            ...historicalAliases,
            ...(input.toIdentityAliases || []).filter(isNonEmptyString),
        ]));
        snapshot.sourcePath = toSourcePath;
        snapshot.sourceUri = isNonEmptyString(input.toSourceUri)
            ? input.toSourceUri.trim()
            : snapshot.sourceUri;
        snapshot.revision = isNonEmptyString(input.revision) ? input.revision.trim() : snapshot.revision;
        snapshot.identityAliases = nextAliases;
        snapshot.updatedAt = isNonEmptyString(input.updatedAt) ? input.updatedAt : recordedAt;

        snapshot.atomIds.forEach((atomId) => {
            const atom = this.atoms.get(atomId);
            if (atom) {
                atom.sourcePath = toSourcePath;
            }
        });
        snapshot.evidenceSpanIds.forEach((evidenceId) => {
            const evidence = this.evidenceSpans.get(evidenceId);
            if (evidence) {
                evidence.sourcePath = toSourcePath;
            }
        });

        const resourceUpdated = this.resourceRegistry.updateKnowledgeDocumentIdentity({
            documentId,
            sourcePath: toSourcePath,
            sourceUri: snapshot.sourceUri,
            revision: snapshot.revision,
            identityAliases: [...snapshot.identityAliases],
            updatedAt: snapshot.updatedAt,
        });
        if (!resourceUpdated) {
            throw new Error(`Identity transition has no resource projection owner: ${documentId}.`);
        }
        const workspaceUpdated = this.workspaceRegistry.updateDocumentSourcePath(
            documentId,
            toSourcePath,
            snapshot.updatedAt,
        );
        if (!workspaceUpdated) {
            throw new Error(`Identity transition has no workspace binding owner: ${documentId}.`);
        }
        const updatedIndexUnits = this.indexLifecycle.updateDocumentSourcePath(documentId, toSourcePath, snapshot.updatedAt);
        if (updatedIndexUnits <= 0) {
            throw new Error(`Identity transition has no index owner: ${documentId}.`);
        }

        this.identityJournal.push({
            documentId,
            fromSourcePath: previousSourcePath,
            toSourcePath,
            fromSourceUri: previousSourceUri,
            toSourceUri: snapshot.sourceUri,
            revision: snapshot.revision,
            recordedAt,
            reason,
        });
        if (this.identityJournal.length > 2048) {
            this.identityJournal.splice(0, this.identityJournal.length - 2048);
        }
    }

    private parseDocument(documentInput: NormalizedKnowledgeDocumentInput): ParsedDocument {
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
        const aliases = [input.sourcePath, input.sourceUri, ...(input.identityAliases || [])]
            .filter(isNonEmptyString)
            .map((alias) => normalizeResourceReference(alias.trim()));
        if (aliases.length > 0) {
            const aliasMatch = Array.from(this.documents.values()).find((snapshot) => {
                const snapshotAliases = [snapshot.sourcePath, snapshot.sourceUri, ...snapshot.identityAliases]
                    .filter(isNonEmptyString);
                const normalizedSnapshotAliases = snapshotAliases.map((alias) => normalizeResourceReference(alias));
                return aliases.some((alias) => normalizedSnapshotAliases.includes(alias));
            });
            if (aliasMatch) {
                return aliasMatch.documentId;
            }
        }
        if (isNonEmptyString(input.sourcePath)) {
            const normalizedSourcePath = input.sourcePath.replace(/\\/g, '/').trim();
            const pathMatch = Array.from(this.documents.values()).find((snapshot) => (
                normalizeResourceReference(snapshot.sourcePath) === normalizeResourceReference(normalizedSourcePath)
                || snapshot.identityAliases.some((alias) => normalizeResourceReference(alias) === normalizeResourceReference(normalizedSourcePath))
            ));
            return pathMatch?.documentId || normalizeIdentifier(normalizedSourcePath);
        }
        return null;
    }

    private async resolveRagEvidenceSourceDocument(
        lookup: RagEvidenceSourceLookup
    ): Promise<RagEvidenceSourceDocument | null> {
        const requestedDocumentId = String(lookup.documentId || '').trim();
        const requestedSourcePath = String(lookup.sourcePath || '').trim();
        const requestedSourcePathKey = requestedSourcePath
            ? normalizeIdentifier(requestedSourcePath.replace(/\\/g, '/'))
            : '';
        const snapshot = (
            requestedDocumentId ? this.documents.get(requestedDocumentId) : undefined
        ) || Array.from(this.documents.values()).find((candidate) => (
            requestedSourcePathKey
            && normalizeIdentifier(candidate.sourcePath.replace(/\\/g, '/')) === requestedSourcePathKey
        ));
        if (this.isRuntimeFaultedRagSourcePath(requestedSourcePath, snapshot?.sourcePath)) {
            return null;
        }
        if (snapshot && typeof snapshot.content === 'string' && snapshot.content.trim()) {
            return {
                documentId: snapshot.documentId,
                sourcePath: snapshot.sourcePath,
                content: snapshot.content,
                sourceHash: snapshot.sourceHash,
                updatedAt: snapshot.updatedAt,
            };
        }
        const sourcePath = snapshot?.sourcePath || requestedSourcePath;
        if (!sourcePath) {
            return null;
        }
        const absolutePath = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(sourcePath);
        try {
            const stat = await fs.promises.stat(absolutePath);
            if (!stat.isFile()) {
                return null;
            }
            const content = await fs.promises.readFile(absolutePath, 'utf8');
            if (!content.trim()) {
                return null;
            }
            return {
                documentId: snapshot?.documentId || requestedDocumentId || normalizeIdentifier(sourcePath),
                sourcePath,
                content,
                sourceHash: snapshot?.sourceHash || this.computeHash(content),
                updatedAt: snapshot?.updatedAt,
            };
        } catch (_error) {
            return null;
        }
    }

    private isRuntimeFaultedRagSourcePath(
        requestedSourcePath: string,
        snapshotSourcePath?: string
    ): boolean {
        const configuredPaths = String(process.env.NOTE_CONNECTION_RAG_UNAVAILABLE_SOURCE_PATHS || '').trim();
        if (!configuredPaths) {
            return false;
        }
        const projectRoot = process.env.NOTE_CONNECTION_PROJECT_ROOT || process.cwd();
        const normalizePathKey = (value: string): string => {
            const trimmedValue = String(value || '').trim();
            if (!trimmedValue) {
                return '';
            }
            const absolutePath = path.isAbsolute(trimmedValue)
                ? path.resolve(trimmedValue)
                : path.resolve(projectRoot, trimmedValue);
            return absolutePath.replace(/\\/g, '/').toLowerCase();
        };
        const candidateKeys = [
            normalizePathKey(requestedSourcePath),
            normalizePathKey(snapshotSourcePath || ''),
        ].filter(Boolean);
        if (candidateKeys.length <= 0) {
            return false;
        }
        return configuredPaths
            .split(';')
            .map((entry) => normalizePathKey(entry))
            .filter(Boolean)
            .some((configuredPath) => candidateKeys.includes(configuredPath));
    }

    private async assembleReviewedRagEvidenceContext(params: {
        query: string;
        items: KnowledgeQueryItem[];
        graphNeighborItems: KnowledgeQueryItem[];
        graphContext: AgentConversationResponse['trace']['graphContext'] | null;
        graphAnswerPlan?: NonNullable<AgentConversationResponse['graphAnswerPlan']>;
        generatedAt: string;
        budget: RagContextBudget;
        paragraphWindow?: number;
    }): Promise<ReviewedRagEvidenceContext> {
        const ragContextPack = await assembleRagEvidenceContext({
            query: params.query,
            items: params.items,
            graphNeighborItems: params.graphNeighborItems,
            generatedAt: params.generatedAt,
            sourceResolver: (lookup) => this.resolveRagEvidenceSourceDocument(lookup),
            budget: params.budget,
            paragraphWindow: params.paragraphWindow,
            graphAnswerPlan: params.graphAnswerPlan,
        });
        const ragSufficiencyReview = await reviewRagContextSufficiency({
            query: params.query,
            contextPack: ragContextPack,
            graphContext: params.graphNeighborItems.length > 0 ? params.graphContext : null,
            reviewedAt: params.generatedAt,
            allowLlmJudge: Boolean(this.ragSufficiencyLlmJudge),
            llmJudge: this.ragSufficiencyLlmJudge || undefined,
        });
        return {
            ragContextPack,
            ragSufficiencyReview,
        };
    }

    private canRecoverRagEvidenceContext(
        pack: RagContextPack,
        review: RagSufficiencyReview,
        graphContext: AgentConversationResponse['trace']['graphContext'] | null
    ): boolean {
        if (review.status === 'sufficient' || pack.fragments.length <= 0) {
            return false;
        }
        if (review.reasons.includes('missing_direct_support')) {
            return false;
        }
        const budgetLimited = pack.sourceDecisions.some((decision) => (
            decision.status === 'fragment_dropped'
            || decision.status === 'fragment_truncated'
        ));
        if (budgetLimited) {
            return true;
        }
        const hasReadableFullDocument = pack.sourceDecisions.some((decision) => (
            decision.status === 'read'
            && decision.sourceBoundary === 'full_document'
            && Number(decision.charsRead || 0) > 0
        ));
        if (hasReadableFullDocument && review.reasons.includes('document_augmentation_missing')) {
            return true;
        }
        const graphHasMoreCandidateContext = Boolean(graphContext && (
            (graphContext.predecessorWindow?.length || 0) > 0
            || (graphContext.successorWindow?.length || 0) > 0
            || (graphContext.supportingAtomIds?.length || 0) > 0
        ));
        return graphHasMoreCandidateContext && review.reasons.includes('graph_neighbor_evidence_missing');
    }

    private ragReviewStatusRank(status: RagSufficiencyReview['status']): number {
        if (status === 'sufficient') {
            return 3;
        }
        if (status === 'borderline') {
            return 2;
        }
        return 1;
    }

    private shouldUseRecoveredRagEvidenceContext(
        beforeReview: RagSufficiencyReview,
        afterReview: RagSufficiencyReview
    ): boolean {
        const rankDelta = this.ragReviewStatusRank(afterReview.status) - this.ragReviewStatusRank(beforeReview.status);
        if (rankDelta > 0) {
            return true;
        }
        if (rankDelta < 0) {
            return false;
        }
        return Number(afterReview.score || 0) >= Number(beforeReview.score || 0);
    }

    private buildRagEvidenceRecoveryTrace(params: {
        beforePack: RagContextPack;
        beforeReview: RagSufficiencyReview;
        afterPack: RagContextPack;
        afterReview: RagSufficiencyReview;
    }): RagEvidenceRecoveryTrace {
        const countSourceDecisionStatuses = (
            decisions: RagSourceDecision[]
        ): Partial<Record<RagSourceDecision['status'], number>> => (
            (Array.isArray(decisions) ? decisions : []).reduce<Partial<Record<RagSourceDecision['status'], number>>>(
                (counts, decision) => {
                    counts[decision.status] = (counts[decision.status] || 0) + 1;
                    return counts;
                },
                {}
            )
        );
        const beforeFragmentIds = new Set(
            params.beforePack.fragments.map((fragment) => String(fragment.fragmentId || '').trim()).filter(Boolean)
        );
        const addedRoleCounts: Partial<Record<RagEvidenceRole, number>> = {};
        let addedFragmentCount = 0;
        params.afterPack.fragments.forEach((fragment) => {
            const fragmentId = String(fragment.fragmentId || '').trim();
            if (fragmentId && beforeFragmentIds.has(fragmentId)) {
                return;
            }
            addedFragmentCount += 1;
            addedRoleCounts[fragment.role] = (addedRoleCounts[fragment.role] || 0) + 1;
        });
        return {
            attempted: true,
            strategy: 'expanded_context_pack',
            reason: params.beforeReview.status === 'insufficient' ? 'insufficient' : 'borderline',
            beforeStatus: params.beforeReview.status,
            afterStatus: params.afterReview.status,
            beforeScore: Number(Number(params.beforeReview.score || 0).toFixed(4)),
            afterScore: Number(Number(params.afterReview.score || 0).toFixed(4)),
            beforeReasons: Array.isArray(params.beforeReview.reasons)
                ? params.beforeReview.reasons.slice()
                : [],
            afterReasons: Array.isArray(params.afterReview.reasons)
                ? params.afterReview.reasons.slice()
                : [],
            beforeFragmentCount: params.beforePack.fragments.length,
            afterFragmentCount: params.afterPack.fragments.length,
            addedFragmentCount,
            addedRoleCounts,
            beforeSourceDecisionStatusCounts: countSourceDecisionStatuses(params.beforePack.sourceDecisions),
            afterSourceDecisionStatusCounts: countSourceDecisionStatuses(params.afterPack.sourceDecisions),
        };
    }

    private markRagReviewWithRecovery(
        review: RagSufficiencyReview,
        recovery: RagEvidenceRecoveryTrace,
        usedRecoveredPack: boolean
    ): RagSufficiencyReview {
        const recoveryReason = recovery.afterStatus === 'sufficient'
            ? 'evidence_recovery_succeeded'
            : usedRecoveredPack
                ? 'evidence_recovery_attempted'
                : 'evidence_recovery_no_improvement';
        return {
            ...review,
            recoveryAttempted: true,
            reasons: Array.from(new Set([
                ...review.reasons,
                recoveryReason,
            ])),
        };
    }

    private buildRagFailureClassifications(params: {
        pack: RagContextPack;
        review: RagSufficiencyReview;
        recovery?: RagEvidenceRecoveryTrace;
        graphContext: AgentConversationResponse['trace']['graphContext'] | null;
        answerReleaseReview?: AgentConversationResponse['answerReleaseReview'];
    }): RagFailureClassification[] {
        const classifications = new Map<string, RagFailureClassification>();
        const addClassification = (classification: RagFailureClassification): void => {
            const key = `${classification.stage}:${classification.code}`;
            const current = classifications.get(key);
            if (!current) {
                classifications.set(key, {
                    ...classification,
                    evidence: Array.from(new Set(classification.evidence.map((item) => String(item || '').trim()).filter(Boolean))),
                });
                return;
            }
            current.evidence = Array.from(new Set([
                ...current.evidence,
                ...classification.evidence.map((item) => String(item || '').trim()).filter(Boolean),
            ]));
            if (classification.severity === 'error' || current.severity === 'error') {
                current.severity = 'error';
            } else if (classification.severity === 'warning' || current.severity === 'warning') {
                current.severity = 'warning';
            }
        };
        const sourceDecisions = Array.isArray(params.pack.sourceDecisions) ? params.pack.sourceDecisions : [];
        const hasSourceDecisionStatus = (status: RagSourceDecision['status']): boolean => (
            sourceDecisions.some((decision) => decision.status === status)
            || Number(params.recovery?.beforeSourceDecisionStatusCounts?.[status] || 0) > 0
            || Number(params.recovery?.afterSourceDecisionStatusCounts?.[status] || 0) > 0
        );
        const reviewReasons = Array.isArray(params.review.reasons)
            ? params.review.reasons.map((reason) => String(reason || '').trim()).filter(Boolean)
            : [];
        const recoveryReasons = [
            ...(Array.isArray(params.recovery?.beforeReasons) ? params.recovery.beforeReasons : []),
            ...(Array.isArray(params.recovery?.afterReasons) ? params.recovery.afterReasons : []),
        ].map((reason) => String(reason || '').trim()).filter(Boolean);
        const allReviewReasons = Array.from(new Set([...reviewReasons, ...recoveryReasons]));

        if (hasSourceDecisionStatus('source_window_unavailable')) {
            addClassification({
                stage: 'parsing_source',
                code: 'source_window_unavailable',
                severity: 'warning',
                message: 'One or more selected source windows could not be recovered from the source document.',
                evidence: ['source_window_unavailable'],
            });
        }
        if (hasSourceDecisionStatus('fragment_truncated') || hasSourceDecisionStatus('fragment_dropped')) {
            addClassification({
                stage: 'context_assembly',
                code: 'context_budget_limited',
                severity: 'warning',
                message: 'The model-visible RAG context pack was limited by fragment or character budget.',
                evidence: [
                    hasSourceDecisionStatus('fragment_truncated') ? 'fragment_truncated' : '',
                    hasSourceDecisionStatus('fragment_dropped') ? 'fragment_dropped' : '',
                ],
            });
        }
        if (
            allReviewReasons.includes('conflict_evidence_present')
            || params.review.degradationState === 'conflict'
        ) {
            addClassification({
                stage: 'context_assembly',
                code: 'conflict_evidence_present',
                severity: 'warning',
                message: 'The assembled RAG context contains conflicting evidence facts.',
                evidence: [
                    allReviewReasons.includes('conflict_evidence_present') ? 'conflict_evidence_present' : '',
                    params.review.degradationState === 'conflict' ? 'degradation_state:conflict' : '',
                ],
            });
        }
        if (reviewReasons.includes('missing_direct_support')) {
            addClassification({
                stage: 'retrieval',
                code: 'missing_direct_support',
                severity: 'error',
                message: 'Retrieval did not produce enough direct cited support for the user request.',
                evidence: ['missing_direct_support'],
            });
        }
        if (
            reviewReasons.includes('graph_neighbor_evidence_missing')
            || (
                params.graphContext
                && (params.graphContext.predecessorWindow?.length || 0) + (params.graphContext.successorWindow?.length || 0) > 0
                && !params.pack.fragments.some((fragment) => fragment.role === 'graph_neighbor_support')
            )
        ) {
            addClassification({
                stage: 'graph_evidence',
                code: 'graph_neighbor_evidence_missing',
                severity: 'warning',
                message: 'Graph context existed but did not produce enough grounded neighbor evidence.',
                evidence: ['graph_neighbor_evidence_missing'],
            });
        }
        allReviewReasons
            .filter((reason) => reason.startsWith('llm_judge_failed'))
            .forEach((reason) => {
                addClassification({
                    stage: 'generation',
                    code: 'llm_judge_failed',
                    severity: 'warning',
                    message: 'The optional LLM sufficiency judge failed and the deterministic review path was used.',
                    evidence: [reason],
                });
            });
        if (params.review.status === 'insufficient' || params.review.degradationState === 'insufficient_evidence') {
            addClassification({
                stage: 'retrieval',
                code: 'insufficient_evidence',
                severity: 'error',
                message: 'The available retrieved and augmented evidence was insufficient for a complete grounded answer.',
                evidence: [
                    params.review.status,
                    params.review.degradationState || '',
                ],
            });
        }
        const failedGateIds = Array.isArray(params.answerReleaseReview?.failedGateIds)
            ? params.answerReleaseReview.failedGateIds.map((gateId) => String(gateId || '').trim()).filter(Boolean)
            : [];
        if (failedGateIds.some((gateId) => (
            gateId === 'claim_grounding_alignment'
            || gateId === 'claim_structured_consistency'
            || gateId === 'rag_answer_completeness'
        ))) {
            addClassification({
                stage: 'citation_verification',
                code: 'release_grounding_gate_failed',
                severity: 'warning',
                message: 'The release review found a grounding or RAG completeness gate issue.',
                evidence: failedGateIds,
            });
        }
        if (failedGateIds.some((gateId) => (
            gateId === 'public_surface_contraction'
            || gateId === 'internal_diagnostic_leakage'
            || gateId === 'abstention_hygiene'
            || gateId === 'query_intent_alignment'
        ))) {
            addClassification({
                stage: 'generation',
                code: 'release_generation_gate_failed',
                severity: 'warning',
                message: 'The release review revised or constrained generated answer text.',
                evidence: failedGateIds,
            });
        }
        return Array.from(classifications.values());
    }

    private tokenizeAnswerClaimText(value: string): string[] {
        const stopwords = new Set([
            'about',
            'after',
            'also',
            'and',
            'are',
            'because',
            'been',
            'before',
            'being',
            'between',
            'from',
            'have',
            'into',
            'only',
            'that',
            'the',
            'their',
            'then',
            'there',
            'this',
            'through',
            'under',
            'when',
            'with',
        ]);
        return Array.from(new Set(
            String(value || '')
                .toLowerCase()
                .match(/[a-z0-9_]{3,}|[\u4e00-\u9fff]{2,}/g) || []
        )).filter((token) => !stopwords.has(token));
    }

    private splitPublicAnswerClaims(answer: string): string[] {
        const normalizedAnswer = normalizeWhitespace(answer);
        if (!normalizedAnswer) {
            return [];
        }
        return (normalizedAnswer.match(/[^.!?。！？]+[.!?。！？]?/g) || [normalizedAnswer])
            .map((claim) => normalizeWhitespace(claim))
            .filter((claim) => claim.length >= 16)
            .slice(0, 12);
    }

    private buildAnswerClaimCitations(params: {
        answer: string;
        pack?: RagContextPack;
        invocationId: string;
    }): AgentConversationAnswerClaimCitation[] {
        const fragments = Array.isArray(params.pack?.fragments) ? params.pack.fragments : [];
        const indexedFragments = fragments.map((fragment, index) => ({
            fragment,
            index,
            tokens: new Set(this.tokenizeAnswerClaimText([
                fragment.title || '',
                fragment.text || '',
            ].join(' '))),
        }));
        return this.splitPublicAnswerClaims(params.answer).map((claim, index) => {
            const claimTokens = this.tokenizeAnswerClaimText(claim);
            const rankedFragments = indexedFragments
                .map((entry) => {
                    const overlapCount = claimTokens.filter((token) => entry.tokens.has(token)).length;
                    const roleBoost = entry.fragment.role === 'direct_support'
                        ? 0.6
                        : entry.fragment.role === 'parent_context'
                            ? 0.35
                            : entry.fragment.role === 'graph_neighbor_support'
                                ? 0.2
                                : 0;
                    const citationBoost = entry.fragment.citationIds.length > 0 ? 0.25 : 0;
                    return {
                        ...entry,
                        score: overlapCount + roleBoost + citationBoost,
                    };
                })
                .filter((entry) => entry.score > 0)
                .sort((left, right) => {
                    const scoreDelta = right.score - left.score;
                    if (Math.abs(scoreDelta) > 0.0001) {
                        return scoreDelta;
                    }
                    return left.index - right.index;
                })
                .slice(0, 3);
            const citationIds = Array.from(new Set(
                rankedFragments.flatMap((entry) => entry.fragment.citationIds)
                    .map((citationId) => String(citationId || '').trim())
                    .filter(Boolean)
            ));
            const fragmentIds = Array.from(new Set(
                rankedFragments
                    .map((entry) => String(entry.fragment.fragmentId || '').trim())
                    .filter(Boolean)
            ));
            const sourcePaths = Array.from(new Set(
                rankedFragments
                    .map((entry) => String(entry.fragment.sourcePath || '').trim())
                    .filter(Boolean)
            ));
            const supportStatus: AgentConversationAnswerClaimCitation['supportStatus'] = citationIds.length > 0
                ? (rankedFragments.some((entry) => entry.score >= 2) ? 'supported' : 'weak')
                : 'unsupported';
            return {
                claimId: `${params.invocationId}_answer_claim_${index + 1}`,
                text: claim,
                citationIds,
                fragmentIds,
                sourcePaths,
                supportStatus,
            };
        });
    }

    private buildRagGraphNeighborQueryItems(
        graphContext: AgentConversationResponse['trace']['graphContext'] | null,
        knowledgePoints: AgentConversationKnowledgePoint[],
        checkedAt: string,
        message = '',
        maxNeighbors = AGENT_RAG_BASE_GRAPH_NEIGHBOR_LIMIT,
        scope?: KnowledgeQueryResolvedScope
    ): KnowledgeQueryItem[] {
        if (!graphContext) {
            return [];
        }
        const graphNeighborScope: KnowledgeQueryRequest['scope'] | undefined = scope
            ? {
                workspaceId: scope.workspaceId || undefined,
                corpusId: scope.corpusId || undefined,
                documentIds: [...(scope.documentIds || [])],
                atomIds: [...(scope.atomIds || [])],
                sourcePathPrefixes: [...(scope.sourcePathPrefixes || [])],
                languages: [...(scope.languages || [])],
            }
            : undefined;
        const neighborScores = new Map<string, number>();
        const addNeighbor = (atomId: unknown, confidence: unknown): void => {
            const normalizedAtomId = String(atomId || '').trim();
            if (!normalizedAtomId || normalizedAtomId === graphContext.anchorAtomId) {
                return;
            }
            const score = Number.isFinite(Number(confidence)) ? Number(confidence) : 0.7;
            neighborScores.set(normalizedAtomId, Math.max(neighborScores.get(normalizedAtomId) || 0, score));
        };
        const graphWindowNodes = [
            ...(graphContext.predecessorWindow || []),
            ...(graphContext.successorWindow || []),
        ];
        const compareIntentHasComparativeWindow = this.isComparisonPlanningQuery(message)
            && graphWindowNodes.some((node) => node.relationKind === 'contrast' || node.relationKind === 'analogy');
        const shouldUseGraphWindowNode = (node: typeof graphWindowNodes[number]): boolean => {
            if (!compareIntentHasComparativeWindow) {
                return true;
            }
            return node.relationKind !== 'application'
                && node.relationKind !== 'sequence'
                && node.relationKind !== 'prerequisite';
        };
        graphWindowNodes
            .filter((node) => shouldUseGraphWindowNode(node))
            .forEach((node) => addNeighbor(node.atomId, node.confidence));
        const hasIntentRankedGraphWindow = Boolean(
            graphContext.diagnostics?.graphOpsAvailable === true
            && ((graphContext.predecessorWindow?.length || 0) + (graphContext.successorWindow?.length || 0)) > 0
        );
        if (!hasIntentRankedGraphWindow) {
            (graphContext.supportingAtomIds || []).forEach((atomId) => addNeighbor(atomId, 0.72));
            (graphContext.knowledgePointRelations || []).forEach((relation) => {
                addNeighbor(relation.sourceAtomId, relation.confidence);
                addNeighbor(relation.targetAtomId, relation.confidence);
            });
            knowledgePoints.forEach((point) => {
                (point.relationPathAtomIds || []).forEach((atomId) => addNeighbor(atomId, point.score));
            });
        }
        const activeRelations = this.collectActiveRelationEdges(checkedAt);
        const neighborItems: KnowledgeQueryItem[] = [];
        const limit = Math.max(0, Math.min(24, Math.floor(Number(maxNeighbors) || 0)));
        Array.from(neighborScores.entries())
            .sort((left, right) => right[1] - left[1])
            .slice(0, limit)
            .forEach(([atomId, score]) => {
                const atom = this.atoms.get(atomId);
                if (!atom) {
                    return;
                }
                if (
                    scope?.source === 'scoped'
                    && this.filterAtomsByKnowledgeScope([atom], graphNeighborScope).atoms.length <= 0
                ) {
                    return;
                }
                const evidenceSpans = atom.evidenceSpanIds
                    .map((evidenceSpanId) => this.evidenceSpans.get(evidenceSpanId))
                    .filter((span): span is EvidenceSpan => Boolean(span));
                if (evidenceSpans.length <= 0) {
                    return;
                }
                const relationPath = activeRelations.filter((edge) => (
                    edge.sourceAtomId === atomId
                    || edge.targetAtomId === atomId
                    || edge.sourceAtomId === graphContext.anchorAtomId
                    || edge.targetAtomId === graphContext.anchorAtomId
                )).slice(0, 6);
                neighborItems.push({
                    atom,
                    score,
                    evidenceSpans,
                    relationPath,
                    temporalValidity: {
                        isValid: true,
                        checkedAt,
                        reasons: [],
                        details: [],
                    },
                });
            });
        return neighborItems;
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
        const candidateAtomIdsByKeyword = new Map<string, Set<string>>();
        this.activeAtomIds.forEach((candidateAtomId) => {
            const candidateAtom = this.atoms.get(candidateAtomId);
            if (!candidateAtom) {
                return;
            }
            new Set(candidateAtom.keywords).forEach((keyword) => {
                const candidateAtomIds = candidateAtomIdsByKeyword.get(keyword) || new Set<string>();
                candidateAtomIds.add(candidateAtomId);
                candidateAtomIdsByKeyword.set(keyword, candidateAtomIds);
            });
        });
        for (const sourceAtomId of newAtomIds) {
            const sourceAtom = this.atoms.get(sourceAtomId);
            if (!sourceAtom || sourceAtom.keywords.length === 0) {
                continue;
            }
            const overlappingCandidateAtomIds = new Set<string>();
            new Set(sourceAtom.keywords).forEach((keyword) => {
                candidateAtomIdsByKeyword.get(keyword)?.forEach((candidateAtomId) => {
                    overlappingCandidateAtomIds.add(candidateAtomId);
                });
            });
            for (const targetAtomId of overlappingCandidateAtomIds) {
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
        const details: KnowledgeQueryItem['temporalValidity']['details'] = [];
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
            details.push({
                edgeId: edge.id,
                edgeKind: edge.edgeKind,
                sourceAtomId: edge.sourceAtomId,
                targetAtomId: edge.targetAtomId,
                validFrom: edge.validFrom,
                validTo: edge.validTo,
                isActive: edge.isActive !== false,
            });
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
            details,
        };
    }

    private makeLearnerStateKey(userId: string, atomId: string): string {
        return `${userId}::${atomId}`;
    }

    private normalizeLearnerState(state: LearnerConceptState, fallbackIso: string): LearnerConceptState {
        const normalizedErrorTags = Array.isArray(state.errorTags)
            ? state.errorTags
                .map((tag) => this.normalizeMasteryErrorTag(String(tag)))
                .filter((tag): tag is string => Boolean(tag))
                .slice(0, 12)
            : [];
        const normalizedRecentErrorTags = Array.isArray(state.recentErrorTags)
            ? state.recentErrorTags
                .map((tag) => this.normalizeMasteryErrorTag(String(tag)))
                .filter((tag): tag is string => Boolean(tag))
                .slice(-24)
            : [];
        const normalizedErrorTagStats = Array.isArray(state.errorTagStats)
            ? state.errorTagStats
                .map((item) => {
                    const normalizedTag = this.normalizeMasteryErrorTag(String(item.tag || ''));
                    if (!normalizedTag) {
                        return null;
                    }
                    return {
                        tag: normalizedTag,
                        count: Math.max(0, Math.floor(Number(item.count || 0))),
                        lastSeenAt: isNonEmptyString(item.lastSeenAt) ? item.lastSeenAt : fallbackIso,
                    } as ErrorTagStat;
                })
                .filter((item): item is ErrorTagStat => Boolean(item))
            : [];
        const mergedStatsMap = new Map<string, ErrorTagStat>();
        normalizedErrorTagStats.forEach((item) => {
            const current = mergedStatsMap.get(String(item.tag));
            if (!current) {
                mergedStatsMap.set(String(item.tag), { ...item });
                return;
            }
            current.count += item.count;
            if (item.lastSeenAt > current.lastSeenAt) {
                current.lastSeenAt = item.lastSeenAt;
            }
        });
        const mergedStats = Array.from(mergedStatsMap.values())
            .sort((left, right) => {
                if (right.count !== left.count) {
                    return right.count - left.count;
                }
                return right.lastSeenAt.localeCompare(left.lastSeenAt);
            })
            .slice(0, 24);
        if (mergedStats.length === 0) {
            const fallbackStatsMap = new Map<string, ErrorTagStat>();
            const fallbackSource = normalizedRecentErrorTags.length > 0 ? normalizedRecentErrorTags : normalizedErrorTags;
            fallbackSource.forEach((tag) => {
                const current = fallbackStatsMap.get(tag) || {
                    tag,
                    count: 0,
                    lastSeenAt: isNonEmptyString(state.lastUpdatedAt) ? state.lastUpdatedAt : fallbackIso,
                };
                current.count += 1;
                fallbackStatsMap.set(tag, current);
            });
            Array.from(fallbackStatsMap.values()).forEach((item) => {
                mergedStats.push(item);
            });
        }
        const fallbackErrorTags = Array.from(new Set([
            ...normalizedErrorTags,
            ...mergedStats.map((item) => item.tag),
        ])).slice(0, 12);

        return {
            ...state,
            masteryProbability: Number(clamp(Number(state.masteryProbability || 0.5), 0.01, 0.99).toFixed(6)),
            reviewCount: Math.max(0, Math.floor(Number(state.reviewCount || 0))),
            correctCount: Math.max(0, Math.floor(Number(state.correctCount || 0))),
            incorrectCount: Math.max(0, Math.floor(Number(state.incorrectCount || 0))),
            partialCount: Math.max(0, Math.floor(Number(state.partialCount || 0))),
            skippedCount: Math.max(0, Math.floor(Number(state.skippedCount || 0))),
            lastOutcome: state.lastOutcome || null,
            lastUpdatedAt: isNonEmptyString(state.lastUpdatedAt) ? state.lastUpdatedAt : fallbackIso,
            nextReviewAt: isNonEmptyString(state.nextReviewAt) ? state.nextReviewAt : plusDays(fallbackIso, 3),
            errorTags: fallbackErrorTags,
            recentErrorTags: normalizedRecentErrorTags,
            errorTagStats: mergedStats,
        };
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
            recentErrorTags: [],
            errorTagStats: [],
        };
    }

    private applyMasteryObservation(
        state: LearnerConceptState,
        observation: MasteryObservation,
        observedAt: string
    ): LearnerConceptState {
        const baseTagStats = Array.isArray(state.errorTagStats) ? state.errorTagStats : [];
        const baseRecentTags = Array.isArray(state.recentErrorTags) ? state.recentErrorTags : [];
        const nextState: LearnerConceptState = {
            ...state,
            reviewCount: state.reviewCount + 1,
            lastOutcome: observation.outcome,
            lastUpdatedAt: observedAt,
            errorTags: [...state.errorTags],
            recentErrorTags: [...baseRecentTags],
            errorTagStats: baseTagStats.map((item) => ({ ...item })),
        };
        const confidence = clamp(Number(observation.confidence ?? 0.7), 0, 1);
        const previousMastery = state.masteryProbability;
        let mastery = previousMastery;
        const collectedTags: string[] = [];
        const addCollectedTag = (candidate: string | undefined): void => {
            if (!isNonEmptyString(candidate)) {
                return;
            }
            const normalized = this.normalizeMasteryErrorTag(candidate);
            if (!normalized) {
                return;
            }
            collectedTags.push(normalized);
        };
        addCollectedTag(observation.errorTag);
        if (Array.isArray(observation.errorTags)) {
            observation.errorTags.forEach((tag) => addCollectedTag(tag));
        }

        if (observation.outcome === 'correct') {
            nextState.correctCount += 1;
            mastery += (1 - mastery) * (0.16 + confidence * 0.08);
        } else if (observation.outcome === 'partial') {
            nextState.partialCount += 1;
            mastery += (1 - mastery) * (0.06 + confidence * 0.04);
            if (!collectedTags.length) {
                addCollectedTag('concept_boundary');
            }
        } else if (observation.outcome === 'incorrect') {
            nextState.incorrectCount += 1;
            mastery -= mastery * (0.22 + (1 - confidence) * 0.08);
            if (!collectedTags.length) {
                addCollectedTag('incorrect_answer');
            }
        } else {
            nextState.skippedCount += 1;
            mastery -= mastery * 0.12;
            addCollectedTag('skipped');
        }

        if (collectedTags.length > 0) {
            this.mergeErrorTagsIntoState(nextState, collectedTags, observedAt);
        }
        nextState.masteryProbability = Number(clamp(mastery, 0.01, 0.99).toFixed(6));
        nextState.nextReviewAt = this.calculateNextReviewAt(observedAt, nextState.masteryProbability);
        return nextState;
    }

    private normalizeMasteryErrorTag(rawTag: string): MasteryErrorTag | string | null {
        if (!isNonEmptyString(rawTag)) {
            return null;
        }
        const normalized = String(rawTag)
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
            .replace(/\s+/g, '_');
        if (!normalized) {
            return null;
        }
        if (NORMALIZED_MASTERY_ERROR_TAGS.has(normalized)) {
            return normalized as MasteryErrorTag;
        }
        return normalized;
    }

    private mergeErrorTagsIntoState(state: LearnerConceptState, tags: string[], observedAt: string): void {
        if (!Array.isArray(state.errorTagStats)) {
            state.errorTagStats = [];
        }
        if (!Array.isArray(state.recentErrorTags)) {
            state.recentErrorTags = [];
        }

        const statsByTag = new Map<string, ErrorTagStat>();
        state.errorTagStats.forEach((item) => {
            if (!isNonEmptyString(item.tag)) {
                return;
            }
            const normalizedTag = this.normalizeMasteryErrorTag(String(item.tag));
            if (!normalizedTag) {
                return;
            }
            const existing = statsByTag.get(normalizedTag);
            if (existing) {
                existing.count += Math.max(0, Math.floor(Number(item.count || 0)));
                if (isNonEmptyString(item.lastSeenAt) && item.lastSeenAt > existing.lastSeenAt) {
                    existing.lastSeenAt = item.lastSeenAt;
                }
                return;
            }
            statsByTag.set(normalizedTag, {
                tag: normalizedTag,
                count: Math.max(0, Math.floor(Number(item.count || 0))),
                lastSeenAt: isNonEmptyString(item.lastSeenAt) ? item.lastSeenAt : observedAt,
            });
        });

        tags.forEach((tag) => {
            const normalizedTag = this.normalizeMasteryErrorTag(tag);
            if (!normalizedTag) {
                return;
            }
            const current = statsByTag.get(normalizedTag) || {
                tag: normalizedTag,
                count: 0,
                lastSeenAt: observedAt,
            };
            current.count += 1;
            current.lastSeenAt = observedAt;
            statsByTag.set(normalizedTag, current);
            state.recentErrorTags.push(normalizedTag);
        });

        const orderedStats = Array.from(statsByTag.values())
            .filter((item) => item.count > 0)
            .sort((left, right) => {
                if (right.count !== left.count) {
                    return right.count - left.count;
                }
                return right.lastSeenAt.localeCompare(left.lastSeenAt);
            })
            .slice(0, 24);
        state.errorTagStats = orderedStats;
        state.errorTags = orderedStats.map((item) => item.tag).slice(0, 12);
        state.recentErrorTags = state.recentErrorTags.slice(-24);
    }

    private getDominantErrorTag(state: LearnerConceptState): string | null {
        if (Array.isArray(state.errorTagStats) && state.errorTagStats.length > 0) {
            return String(state.errorTagStats[0].tag);
        }
        if (Array.isArray(state.errorTags) && state.errorTags.length > 0) {
            return String(state.errorTags[0]);
        }
        return null;
    }

    private estimateMisconceptionIntensity(state: LearnerConceptState): number {
        const reviewCount = Math.max(1, Math.floor(Number(state.reviewCount || 0)));
        const topCounts = (Array.isArray(state.errorTagStats) ? state.errorTagStats : [])
            .slice(0, 3)
            .reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.count || 0))), 0);
        return Number(clamp(topCounts / reviewCount, 0, 1).toFixed(4));
    }

    private resolveActionKindsForErrorTag(errorTag: string | null): LearningActionKind[] {
        if (!errorTag) {
            return ['review', 'quiz', 'explain'];
        }
        const normalized = this.normalizeMasteryErrorTag(errorTag);
        if (!normalized) {
            return ['review', 'quiz', 'explain'];
        }
        if (!Object.prototype.hasOwnProperty.call(ERROR_TAG_TO_ACTION_KINDS, normalized)) {
            return ERROR_TAG_TO_ACTION_KINDS.other;
        }
        return ERROR_TAG_TO_ACTION_KINDS[normalized as MasteryErrorTag];
    }

    private resolveTutorActionKindFromLearningKind(kind: LearningActionKind): TutorActionKind {
        if (kind === 'quiz') {
            return 'generate_quiz';
        }
        if (kind === 'transfer' || kind === 'counterexample') {
            return 'follow_up';
        }
        if (kind === 'review' || kind === 'reflection' || kind === 'explain') {
            return 'recap';
        }
        return 'follow_up';
    }

    private inferMasteryOutcomeFromTutorAnalysis(analysis: TutorActionResponse | null): MasteryOutcome | null {
        if (!analysis) {
            return null;
        }
        const message = String(analysis.message || '');
        const qualityMatch = message.match(/answer\s+quality:\s*(strong|partial|weak)/i);
        if (qualityMatch) {
            const quality = qualityMatch[1].toLowerCase();
            if (quality === 'strong') {
                return 'correct';
            }
            if (quality === 'partial') {
                return 'partial';
            }
            if (quality === 'weak') {
                return 'incorrect';
            }
        }
        const confidence = Number(clamp(analysis.trace.confidence, 0, 1));
        if (confidence >= 0.85) {
            return 'correct';
        }
        if (confidence >= 0.58) {
            return 'partial';
        }
        return 'incorrect';
    }

    private inferMasteryErrorTagFromTutorAnalysis(
        analysis: TutorActionResponse | null,
        outcome: MasteryOutcome | null
    ): MasteryErrorTag | string | null {
        if (!analysis || !outcome || outcome === 'correct') {
            return null;
        }
        if (outcome === 'skipped') {
            return 'skipped';
        }
        const message = String(analysis.message || '');
        const keywordMatch = message.match(/matched\s+keywords:\s*(\d+)\s*\/\s*(\d+)/i);
        if (keywordMatch) {
            const matched = Number(keywordMatch[1]);
            const total = Math.max(1, Number(keywordMatch[2]));
            const ratio = matched / total;
            if (outcome === 'incorrect') {
                if (matched === 0) {
                    return 'retrieval_failure';
                }
                if (ratio < 0.3) {
                    return 'evidence_mismatch';
                }
                return 'incorrect_answer';
            }
            if (ratio < 0.4) {
                return 'evidence_mismatch';
            }
            return 'reasoning_jump';
        }
        if (outcome === 'incorrect') {
            return 'incorrect_answer';
        }
        return 'reasoning_jump';
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
                const state = this.normalizeLearnerState(
                    this.learnerStates.get(this.makeLearnerStateKey(userId, atomId))
                    || this.createDefaultLearnerState(userId, atomId, generatedAt),
                    generatedAt
                );
                const misconceptionIntensity = this.estimateMisconceptionIntensity(state);
                const priorityScore = Number(
                    (
                        (1 - state.masteryProbability) * 0.75
                        + misconceptionIntensity * 0.25
                    ).toFixed(6)
                );
                return {
                    atomId,
                    state,
                    misconceptionIntensity,
                    priorityScore,
                };
            })
            .sort((left, right) => right.priorityScore - left.priorityScore)
            .slice(0, maxPaths);

        return scored.map((item, index) => {
            const expectedGain = Number(
                clamp(
                    (1 - item.state.masteryProbability) * 0.7 + item.misconceptionIntensity * 0.3,
                    0.01,
                    0.95
                ).toFixed(4)
            );
            const dominantErrorTag = this.getDominantErrorTag(item.state);
            const actions = this.buildMasteryActions(item.atomId, expectedGain, index + 1, dominantErrorTag);
            return {
                id: this.nextId('mastery_path'),
                targetAtomId: item.atomId,
                priority: 100 - index * 5,
                expectedMasteryGain: expectedGain,
                actions,
            };
        });
    }

    private buildMasteryActions(
        atomId: string,
        expectedGain: number,
        rank: number,
        dominantErrorTag: string | null
    ): LearningAction[] {
        const atom = this.atoms.get(atomId);
        const evidenceSpanIds = atom?.evidenceSpanIds || [];
        const recommendedKinds = this.resolveActionKindsForErrorTag(dominantErrorTag);
        const primaryKind = recommendedKinds[0] || 'review';
        const secondaryKind = recommendedKinds[1] || 'quiz';
        const tertiaryKind = recommendedKinds[2] || 'explain';
        const tagHint = dominantErrorTag
            ? ` Focus remediation on "${dominantErrorTag}".`
            : '';
        return [
            this.createLearningAction({
                kind: primaryKind,
                atomId,
                priority: 100 - rank * 2,
                expectedGain: expectedGain * 0.5,
                rationale: `Review source evidence first to rebuild grounded understanding.${tagHint}`,
                evidenceSpanIds,
                relationPathAtomIds: [atomId],
                estimatedMinutes: 8,
            }),
            this.createLearningAction({
                kind: secondaryKind,
                atomId,
                priority: 95 - rank * 2,
                expectedGain: expectedGain * 0.3,
                rationale: dominantErrorTag
                    ? `Targeted practice for "${dominantErrorTag}" to validate correction quality.`
                    : 'Run retrieval practice to validate stable recall.',
                evidenceSpanIds,
                relationPathAtomIds: [atomId],
                estimatedMinutes: 6,
            }),
            this.createLearningAction({
                kind: tertiaryKind,
                atomId,
                priority: 90 - rank * 2,
                expectedGain: expectedGain * 0.2,
                rationale: 'Self-explanation consolidates concept boundaries and misconception repair.',
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

    private buildTutorSuggestedActions(
        atomId: string,
        evidenceSpans: EvidenceSpan[],
        neighbors: string[],
        dominantErrorTag: string | null
    ): LearningAction[] {
        const actionKinds = this.resolveActionKindsForErrorTag(dominantErrorTag);
        const primaryKind = actionKinds[0] || 'quiz';
        const secondaryKind = actionKinds[1] || 'reflection';
        const tagHint = dominantErrorTag
            ? ` Targets misconception "${dominantErrorTag}".`
            : '';
        return [
            this.createLearningAction({
                kind: primaryKind,
                atomId,
                priority: 88,
                expectedGain: 0.24,
                rationale: `Immediate retrieval practice to test current mastery.${tagHint}`,
                evidenceSpanIds: evidenceSpans.map((span) => span.id),
                relationPathAtomIds: [atomId, ...neighbors],
                estimatedMinutes: 7,
            }),
            this.createLearningAction({
                kind: secondaryKind,
                atomId,
                priority: 82,
                expectedGain: 0.17,
                rationale: dominantErrorTag
                    ? `Reflect on why "${dominantErrorTag}" happened and bind correction to evidence.`
                    : 'Reflect on misunderstandings and bind corrections to evidence.',
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
        dominantErrorTag: string | null;
    }): string {
        const firstEvidence = params.evidenceSpans[0]?.snippet || params.atom.content.slice(0, 220);
        const misconceptionHint = params.dominantErrorTag
            ? `Known misconception to repair: ${params.dominantErrorTag}.`
            : '';
        if (params.actionKind === 'generate_quiz') {
            return [
                `Question: Explain the core idea of "${params.atom.title}" in your own words.`,
                'Constraint: include one evidence-backed statement from the source.',
                misconceptionHint,
                `Evidence hint: ${firstEvidence}`,
            ].filter((line) => line.length > 0).join('\n');
        }
        if (params.actionKind === 'analyze_answer') {
            const answerTokens = tokenize(String(params.answer || ''));
            const keywordOverlap = answerTokens.filter((token) => params.atom.keywords.includes(token)).length;
            const quality = keywordOverlap >= 3 ? 'strong' : (keywordOverlap >= 1 ? 'partial' : 'weak');
            return [
                `Answer quality: ${quality}.`,
                `Matched keywords: ${keywordOverlap}/${params.atom.keywords.length}.`,
                misconceptionHint,
                `Repair focus: align your reasoning with this evidence: ${firstEvidence}`,
            ].filter((line) => line.length > 0).join('\n');
        }
        if (params.actionKind === 'follow_up') {
            const neighborTitle = params.neighbors
                .map((atomId) => this.atoms.get(atomId)?.title)
                .find((title): title is string => Boolean(title))
                || 'a related concept';
            return [
                `Follow-up: compare "${params.atom.title}" with "${neighborTitle}".`,
                'Prompt: identify one shared mechanism and one critical difference.',
                misconceptionHint,
                `Evidence anchor: ${firstEvidence}`,
            ].filter((line) => line.length > 0).join('\n');
        }
        return [
            `Recap for "${params.atom.title}":`,
            misconceptionHint,
            `- Key evidence: ${firstEvidence}`,
            '- Suggested next move: apply the concept to a transfer task and verify against source.',
        ].filter((line) => line.length > 0).join('\n');
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

    private normalizeMemoryScopeValue(value: unknown): string | undefined {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized || undefined;
    }

    private buildGovernedMemoryEntry(params: {
        entry: MemoryEntry;
        previous?: MemoryEntry | null;
        fallbackScopeWorkspaceId?: string | null;
        fallbackScopeCorpusId?: string | null;
    }): MemoryEntry {
        const previous = params.previous || null;
        const merged: MemoryEntry = {
            ...previous,
            ...params.entry,
            tags: Array.from(new Set(params.entry.tags || previous?.tags || [])),
            references: Array.from(new Set(params.entry.references || previous?.references || [])),
            confidence: clamp(Number(params.entry.confidence ?? previous?.confidence ?? 0.5), 0, 1),
            createdAt: params.entry.createdAt || previous?.createdAt || this.resolveTimestamp(undefined),
            updatedAt: params.entry.updatedAt || this.resolveTimestamp(undefined),
            expiresAt: params.entry.expiresAt || previous?.expiresAt,
        };
        const derivedScope = this.resolveWorkspaceContextForReferences(merged.references);
        const classification = classifyMemoryEntry(merged);
        return {
            ...merged,
            memoryType: classification.memoryType,
            memoryPurpose: classification.memoryPurpose,
            classificationConfidence: classification.classificationConfidence,
            scopeWorkspaceId: this.normalizeMemoryScopeValue(
                merged.scopeWorkspaceId
                || params.fallbackScopeWorkspaceId
                || previous?.scopeWorkspaceId
                || derivedScope.workspaceId
            ),
            scopeCorpusId: this.normalizeMemoryScopeValue(
                merged.scopeCorpusId
                || params.fallbackScopeCorpusId
                || previous?.scopeCorpusId
                || derivedScope.corpusId
            ),
        };
    }

    private appendMemoryAuditRecord(params: {
        userId: string;
        operation: MemoryAuditRecord['operation'];
        layer: MemoryLayer;
        entry: MemoryEntry;
        reason: string;
        recordedAt: string;
    }): void {
        this.memoryAuditRecords.unshift(buildMemoryAuditRecord(
            (prefix?: string) => this.nextId(prefix || 'memory_audit'),
            {
                userId: params.userId,
                operation: params.operation,
                layer: params.layer,
                entry: params.entry,
                reason: params.reason,
                scopeWorkspaceId: params.entry.scopeWorkspaceId || null,
                scopeCorpusId: params.entry.scopeCorpusId || null,
                recordedAt: params.recordedAt,
            }
        ));
        if (this.memoryAuditRecords.length > SESSION_EXECUTION_HISTORY_LIMIT * 3) {
            this.memoryAuditRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT * 3);
        }
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

    private evictMemoryLayerDetailed(
        bank: UserMemoryBank,
        layer: MemoryLayer,
        nowIso: string
    ): {
        evictedCount: number;
        evictedEntries: MemoryEntry[];
    } {
        const entries = bank[layer];
        const beforeEntries = [...entries];
        const beforeCount = beforeEntries.length;
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
            const leftWeight = computeGovernedMemoryWeight(left);
            const rightWeight = computeGovernedMemoryWeight(right);
            if (leftWeight !== rightWeight) {
                return leftWeight - rightWeight;
            }
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
        const survivingSet = new Set(surviving);
        const evictedEntries = beforeEntries.filter((entry) => !survivingSet.has(entry));
        return {
            evictedCount: beforeCount - surviving.length,
            evictedEntries,
        };
    }

    private evictMemoryLayer(bank: UserMemoryBank, layer: MemoryLayer, nowIso: string): number {
        return this.evictMemoryLayerDetailed(bank, layer, nowIso).evictedCount;
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

    private resolveOptionalTimestamp(preferred: unknown): string | null {
        if (!isNonEmptyString(preferred)) {
            return null;
        }
        const parsed = new Date(preferred);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }
        return null;
    }

    private listConfiguredTutorAdapters(): TutorAdapter[] {
        return Array.from(new Map(
            [
                ...this.configuredTutorAdapters,
                ...(this.tutorAdapter ? [this.tutorAdapter] : []),
            ]
                .filter((adapter): adapter is TutorAdapter => Boolean(adapter && isNonEmptyString(adapter.id)))
                .map((adapter) => [adapter.id, adapter])
        ).values());
    }

    private normalizeConversationMemoryNamespace(
        value: unknown
    ): 'conversation' | 'learner_profile' | 'study_session' | 'project' {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'learner_profile' || normalized === 'learner-profile' || normalized === 'profile') {
            return 'learner_profile';
        }
        if (normalized === 'study_session' || normalized === 'study-session' || normalized === 'session') {
            return 'study_session';
        }
        if (normalized === 'project') {
            return 'project';
        }
        return 'conversation';
    }

    private resolveConversationMemoryLayer(namespace: string): MemoryLayer {
        if (namespace === 'learner_profile') {
            return 'unit';
        }
        if (namespace === 'study_session') {
            return 'unit';
        }
        if (namespace === 'project') {
            return 'long_term';
        }
        return 'session';
    }

    private defaultConversationMemoryNamespaceForLayer(
        layer: MemoryLayer
    ): 'conversation' | 'learner_profile' | 'study_session' | 'project' {
        if (layer === 'long_term') {
            return 'project';
        }
        if (layer === 'unit') {
            return 'study_session';
        }
        return 'conversation';
    }

    private upsertConversationMemoryInternalTag(tags: string[], prefix: string, value: string): string[] {
        const normalizedValue = String(value || '').trim();
        const nextTags = tags.filter((tag) => !tag.startsWith(prefix));
        if (normalizedValue) {
            nextTags.push(`${prefix}${normalizedValue}`);
        }
        return Array.from(new Set(nextTags));
    }

    private appendConversationMemoryFeedbackTag(tags: string[], feedback: string, recordedAt: string): string[] {
        const nextTags = this.upsertConversationMemoryInternalTag(tags, 'feedback:last:', feedback);
        nextTags.push(`feedback:${feedback}:${recordedAt}`);
        return Array.from(new Set(nextTags));
    }

    private hasConversationMemoryDomainTag(entry: MemoryEntry): boolean {
        return Array.isArray(entry.tags) && entry.tags.includes('memory_domain:conversation');
    }

    private extractConversationMemoryTagValue(entry: MemoryEntry, prefix: string): string {
        const matchedTag = Array.isArray(entry.tags)
            ? entry.tags.find((tag) => typeof tag === 'string' && tag.startsWith(prefix))
            : undefined;
        return matchedTag ? matchedTag.slice(prefix.length).trim() : '';
    }

    private stripConversationMemoryInternalTags(tags: string[]): string[] {
        return tags.filter((tag) => (
            typeof tag === 'string'
            && !tag.startsWith('memory_domain:')
            && !tag.startsWith('namespace:')
            && !tag.startsWith('source:')
            && !tag.startsWith('feedback:')
        ));
    }

    private collectConversationMemoryEntries(
        userId: string,
        namespace?: 'conversation' | 'learner_profile' | 'study_session' | 'project'
    ): Array<{ layer: MemoryLayer; entry: MemoryEntry }> {
        const bank = this.ensureUserMemoryBank(userId);
        const candidateLayers: MemoryLayer[] = namespace
            ? [this.resolveConversationMemoryLayer(namespace)]
            : ['session', 'unit', 'long_term'];
        const entries: Array<{ layer: MemoryLayer; entry: MemoryEntry }> = [];
        candidateLayers.forEach((layer) => {
            bank[layer].forEach((entry) => {
                if (!this.hasConversationMemoryDomainTag(entry)) {
                    return;
                }
                const entryNamespace = this.extractConversationMemoryTagValue(entry, 'namespace:')
                    || this.defaultConversationMemoryNamespaceForLayer(layer);
                if (namespace && entryNamespace !== namespace) {
                    return;
                }
                entries.push({ layer, entry });
            });
        });
        return entries.sort((left, right) => right.entry.updatedAt.localeCompare(left.entry.updatedAt));
    }

    private buildConversationMemoryRecord(
        entry: MemoryEntry,
        layer: MemoryLayer
    ): Record<string, unknown> {
        const namespace = this.extractConversationMemoryTagValue(entry, 'namespace:')
            || this.defaultConversationMemoryNamespaceForLayer(layer);
        const source = this.extractConversationMemoryTagValue(entry, 'source:') || 'manual';
        const lastFeedback = this.extractConversationMemoryTagValue(entry, 'feedback:last:') || null;
        const tags = this.stripConversationMemoryInternalTags(Array.isArray(entry.tags) ? entry.tags : []);
        return {
            memoryId: entry.key,
            namespace,
            layer,
            content: entry.value,
            tags,
            source,
            confidence: Number(clamp(Number(entry.confidence || 0), 0, 1).toFixed(4)),
            memoryType: entry.memoryType || undefined,
            memoryPurpose: entry.memoryPurpose || undefined,
            classificationConfidence: entry.classificationConfidence !== undefined
                ? Number(clamp(Number(entry.classificationConfidence || 0), 0, 1).toFixed(4))
                : undefined,
            scopeWorkspaceId: entry.scopeWorkspaceId || null,
            scopeCorpusId: entry.scopeCorpusId || null,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            expiresAt: entry.expiresAt || null,
            references: Array.isArray(entry.references) ? [...entry.references] : [],
            feedbackSummary: {
                upvote: Array.isArray(entry.tags)
                    ? entry.tags.filter((tag) => typeof tag === 'string' && tag.startsWith('feedback:upvote:')).length
                    : 0,
                downvote: Array.isArray(entry.tags)
                    ? entry.tags.filter((tag) => typeof tag === 'string' && tag.startsWith('feedback:downvote:')).length
                    : 0,
                correct: Array.isArray(entry.tags)
                    ? entry.tags.filter((tag) => typeof tag === 'string' && tag.startsWith('feedback:correct:')).length
                    : 0,
                lastFeedback,
            },
        };
    }

    private filterTutorTraces(request: Record<string, unknown> = {}): TutorTrace[] {
        const userId = String(request.userId || '').trim();
        const source = String(request.source || '').trim().toLowerCase();
        const actionKind = String(request.actionKind || '').trim();
        const providerName = String(request.providerName || '').trim().toLowerCase();
        const providerMode = String(request.providerMode || '').trim().toLowerCase();
        const adapterId = String(request.adapterId || '').trim().toLowerCase();
        const fallbackUsed = typeof request.fallbackUsed === 'boolean'
            ? request.fallbackUsed
            : null;
        return this.tutorTraces
            .filter((trace) => {
                if (userId && trace.userId !== userId) {
                    return false;
                }
                if (source && String(trace.source || '').trim().toLowerCase() !== source) {
                    return false;
                }
                if (actionKind && String(trace.actionKind || '').trim() !== actionKind) {
                    return false;
                }
                if (providerName && String(trace.providerName || '').trim().toLowerCase() !== providerName) {
                    return false;
                }
                if (providerMode && String(trace.providerMode || '').trim().toLowerCase() !== providerMode) {
                    return false;
                }
                if (adapterId && String(trace.adapterId || '').trim().toLowerCase() !== adapterId) {
                    return false;
                }
                if (fallbackUsed !== null && Boolean(trace.fallbackUsed) !== fallbackUsed) {
                    return false;
                }
                return true;
            })
            .slice()
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    private summarizeTutorTraceMetrics(traces: TutorTrace[]): {
        sampleCount: number;
        fallbackTraces: number;
        failedTraces: number;
        verifiedTraces: number;
        pendingTraces: number;
        fallbackRatioPct: number;
        failedRatioPct: number;
        averageConfidence: number;
        averageProviderAttemptCount: number;
        latestSeenAt: string;
        oldestSeenAt: string;
    } {
        const sampleCount = traces.length;
        const fallbackTraces = traces.filter((trace) => trace.fallbackUsed === true).length;
        const failedTraces = traces.filter((trace) => trace.failed === true || trace.verificationStatus === 'failed').length;
        const verifiedTraces = traces.filter((trace) => trace.verificationStatus === 'verified').length;
        const pendingTraces = traces.filter((trace) => trace.verificationStatus === 'pending').length;
        const averageConfidence = sampleCount > 0
            ? Number(
                (
                    traces.reduce((sum, trace) => sum + clamp(Number(trace.confidence || 0), 0, 1), 0)
                    / sampleCount
                ).toFixed(4)
            )
            : 0;
        const averageProviderAttemptCount = sampleCount > 0
            ? Number(
                (
                    traces.reduce((sum, trace) => sum + Math.max(1, Math.floor(Number(trace.providerAttemptCount || 1))), 0)
                    / sampleCount
                ).toFixed(4)
            )
            : 0;
        return {
            sampleCount,
            fallbackTraces,
            failedTraces,
            verifiedTraces,
            pendingTraces,
            fallbackRatioPct: Number(clamp((fallbackTraces / Math.max(1, sampleCount)) * 100, 0, 100).toFixed(4)),
            failedRatioPct: Number(clamp((failedTraces / Math.max(1, sampleCount)) * 100, 0, 100).toFixed(4)),
            averageConfidence,
            averageProviderAttemptCount,
            latestSeenAt: traces[0]?.createdAt || '',
            oldestSeenAt: traces[sampleCount - 1]?.createdAt || '',
        };
    }

    private assessTutorProviderTrend(
        currentMetrics: ReturnType<KnowledgeLearningPlatform['summarizeTutorTraceMetrics']>,
        previousMetrics: ReturnType<KnowledgeLearningPlatform['summarizeTutorTraceMetrics']> | null,
        minSamples: number
    ): {
        trendStatus: 'improving' | 'stable' | 'regressing' | 'insufficient_data';
        trendScore: number;
        trendConfidence: number;
        deltas: {
            fallbackRatioDeltaPct: number;
            failedRatioDeltaPct: number;
            averageConfidenceDelta: number;
        };
        reason: string;
    } {
        const currentScore = Number(clamp(
            currentMetrics.averageConfidence * 0.65
            + (1 - currentMetrics.fallbackRatioPct / 100) * 0.2
            + (1 - currentMetrics.failedRatioPct / 100) * 0.15,
            0,
            1
        ).toFixed(4));
        const deltas = {
            fallbackRatioDeltaPct: previousMetrics
                ? Number((currentMetrics.fallbackRatioPct - previousMetrics.fallbackRatioPct).toFixed(4))
                : 0,
            failedRatioDeltaPct: previousMetrics
                ? Number((currentMetrics.failedRatioPct - previousMetrics.failedRatioPct).toFixed(4))
                : 0,
            averageConfidenceDelta: previousMetrics
                ? Number((currentMetrics.averageConfidence - previousMetrics.averageConfidence).toFixed(4))
                : 0,
        };

        if (currentMetrics.sampleCount < minSamples) {
            return {
                trendStatus: 'insufficient_data',
                trendScore: currentScore,
                trendConfidence: Number(clamp(currentMetrics.sampleCount / Math.max(1, minSamples), 0, 1).toFixed(4)),
                deltas,
                reason: `Need at least ${minSamples} traces for provider trend evaluation.`,
            };
        }

        if (!previousMetrics || previousMetrics.sampleCount < minSamples) {
            const baselineStatus = (
                currentMetrics.failedRatioPct >= 35
                || currentMetrics.fallbackRatioPct >= 45
                || currentMetrics.averageConfidence < 0.55
            )
                ? 'regressing'
                : (
                    currentMetrics.averageConfidence >= 0.8
                    && currentMetrics.failedRatioPct <= 5
                    && currentMetrics.fallbackRatioPct <= 15
                )
                    ? 'improving'
                    : 'stable';
            return {
                trendStatus: baselineStatus,
                trendScore: currentScore,
                trendConfidence: Number(clamp(currentMetrics.sampleCount / Math.max(1, minSamples * 2), 0.35, 0.75).toFixed(4)),
                deltas,
                reason: 'Only one provider window is available; baseline status comes from the latest quality mix.',
            };
        }

        const previousScore = Number(clamp(
            previousMetrics.averageConfidence * 0.65
            + (1 - previousMetrics.fallbackRatioPct / 100) * 0.2
            + (1 - previousMetrics.failedRatioPct / 100) * 0.15,
            0,
            1
        ).toFixed(4));
        const scoreDelta = Number((currentScore - previousScore).toFixed(4));
        let trendStatus: 'improving' | 'stable' | 'regressing' | 'insufficient_data' = 'stable';
        if (
            scoreDelta >= 0.08
            || (
                deltas.fallbackRatioDeltaPct <= -10
                && deltas.failedRatioDeltaPct <= 0
                && deltas.averageConfidenceDelta >= 0.03
            )
        ) {
            trendStatus = 'improving';
        } else if (
            scoreDelta <= -0.08
            || deltas.fallbackRatioDeltaPct >= 10
            || deltas.failedRatioDeltaPct >= 10
            || deltas.averageConfidenceDelta <= -0.08
        ) {
            trendStatus = 'regressing';
        }

        return {
            trendStatus,
            trendScore: currentScore,
            trendConfidence: Number(clamp(
                Math.min(currentMetrics.sampleCount, previousMetrics.sampleCount) / Math.max(1, minSamples * 2),
                0,
                1
            ).toFixed(4)),
            deltas,
            reason: `Score delta ${scoreDelta.toFixed(4)} with fallback delta ${deltas.fallbackRatioDeltaPct.toFixed(2)} pct and failed delta ${deltas.failedRatioDeltaPct.toFixed(2)} pct.`,
        };
    }

    private recordMemoryPolicyDiagnosticsHistory(record: Record<string, unknown>): void {
        this.memoryPolicyDiagnosticsHistoryRecords.unshift(record);
        if (this.memoryPolicyDiagnosticsHistoryRecords.length > SESSION_EXECUTION_HISTORY_LIMIT) {
            this.memoryPolicyDiagnosticsHistoryRecords.splice(SESSION_EXECUTION_HISTORY_LIMIT);
        }
    }

    private buildMemoryPolicyDiagnosticsSnapshot(request: Record<string, unknown> = {}): Record<string, unknown> {
        const recordedAt = this.resolveTimestamp(
            isNonEmptyString(request.now) ? request.now : undefined
        );
        const staleAfterHours = clamp(Number(request.staleAfterHours ?? 48), 1, 24 * 90);
        const nearExpiryHours = clamp(Number(request.nearExpiryHours ?? 24), 1, 24 * 30);
        const lowConfidenceThreshold = clamp(Number(request.lowConfidenceThreshold ?? 0.45), 0, 1);
        const sampleLimit = clamp(Math.floor(Number(request.sampleLimit ?? request.limit ?? 8) || 8), 1, 100);
        const nowTime = Date.parse(recordedAt);
        const staleThresholdTime = nowTime - staleAfterHours * 60 * 60 * 1000;
        const nearExpiryThresholdTime = nowTime + nearExpiryHours * 60 * 60 * 1000;
        const flattenedEntries: Array<Record<string, unknown>> = [];
        const byLayer = {
            session: { totalEntries: 0, expiredEntries: 0, staleEntries: 0, nearExpiryEntries: 0, lowConfidenceEntries: 0 },
            unit: { totalEntries: 0, expiredEntries: 0, staleEntries: 0, nearExpiryEntries: 0, lowConfidenceEntries: 0 },
            long_term: { totalEntries: 0, expiredEntries: 0, staleEntries: 0, nearExpiryEntries: 0, lowConfidenceEntries: 0 },
        };
        const byUser = new Map<string, {
            userId: string;
            totalEntries: number;
            expiredEntries: number;
            staleEntries: number;
            lowConfidenceEntries: number;
        }>();

        this.userMemory.forEach((bank, userId) => {
            (['session', 'unit', 'long_term'] as MemoryLayer[]).forEach((layer) => {
                bank[layer].forEach((entry) => {
                    const expiresAt = this.resolveOptionalTimestamp(entry.expiresAt);
                    const updatedAt = this.resolveOptionalTimestamp(entry.updatedAt) || recordedAt;
                    const confidence = clamp(Number(entry.confidence || 0), 0, 1);
                    const expired = Boolean(expiresAt && Date.parse(expiresAt) <= nowTime);
                    const stale = Date.parse(updatedAt) <= staleThresholdTime;
                    const nearExpiry = Boolean(
                        !expired
                        && expiresAt
                        && Date.parse(expiresAt) <= nearExpiryThresholdTime
                    );
                    const lowConfidence = confidence < lowConfidenceThreshold;
                    const issues = [
                        ...(expired ? ['expired'] : []),
                        ...(stale ? ['stale'] : []),
                        ...(nearExpiry ? ['near_expiry'] : []),
                        ...(lowConfidence ? ['low_confidence'] : []),
                    ];
                    flattenedEntries.push({
                        userId,
                        layer,
                        key: entry.key,
                        confidence: Number(confidence.toFixed(4)),
                        updatedAt,
                        expiresAt,
                        namespace: this.hasConversationMemoryDomainTag(entry)
                            ? this.extractConversationMemoryTagValue(entry, 'namespace:') || null
                            : null,
                        issues,
                        issueScore: (
                            (expired ? 5 : 0)
                            + (stale ? 3 : 0)
                            + (nearExpiry ? 1 : 0)
                            + (lowConfidence ? 2 : 0)
                        ),
                    });
                    byLayer[layer].totalEntries += 1;
                    if (expired) {
                        byLayer[layer].expiredEntries += 1;
                    }
                    if (stale) {
                        byLayer[layer].staleEntries += 1;
                    }
                    if (nearExpiry) {
                        byLayer[layer].nearExpiryEntries += 1;
                    }
                    if (lowConfidence) {
                        byLayer[layer].lowConfidenceEntries += 1;
                    }
                    const userStats = byUser.get(userId) || {
                        userId,
                        totalEntries: 0,
                        expiredEntries: 0,
                        staleEntries: 0,
                        lowConfidenceEntries: 0,
                    };
                    userStats.totalEntries += 1;
                    if (expired) {
                        userStats.expiredEntries += 1;
                    }
                    if (stale) {
                        userStats.staleEntries += 1;
                    }
                    if (lowConfidence) {
                        userStats.lowConfidenceEntries += 1;
                    }
                    byUser.set(userId, userStats);
                });
            });
        });

        const totalEntries = flattenedEntries.length;
        const expiredEntries = flattenedEntries.filter((item) => Array.isArray(item.issues) && item.issues.includes('expired')).length;
        const staleEntries = flattenedEntries.filter((item) => Array.isArray(item.issues) && item.issues.includes('stale')).length;
        const nearExpiryEntries = flattenedEntries.filter((item) => Array.isArray(item.issues) && item.issues.includes('near_expiry')).length;
        const lowConfidenceEntries = flattenedEntries.filter((item) => Array.isArray(item.issues) && item.issues.includes('low_confidence')).length;
        const healthScore = totalEntries > 0
            ? Number(clamp(
                100
                - (expiredEntries / totalEntries) * 45
                - (staleEntries / totalEntries) * 25
                - (lowConfidenceEntries / totalEntries) * 20
                - (nearExpiryEntries / totalEntries) * 10,
                0,
                100
            ).toFixed(4))
            : 100;
        const status = totalEntries === 0
            ? 'insufficient_data'
            : healthScore >= 85 && expiredEntries === 0
                ? 'healthy'
                : healthScore >= 60
                    ? 'watch'
                    : 'risk';
        const reason = totalEntries === 0
            ? 'No memory entries are available for diagnostics yet.'
            : status === 'healthy'
                ? 'Memory layers are within expiry, freshness, and confidence bounds.'
                : status === 'watch'
                    ? 'Memory health is drifting due to stale, near-expiry, or low-confidence entries.'
                    : 'Memory health is at risk because expired or stale entries exceed safe bounds.';

        const sampleEntries = flattenedEntries
            .slice()
            .sort((left, right) => {
                const leftScore = Number(left.issueScore || 0);
                const rightScore = Number(right.issueScore || 0);
                if (rightScore !== leftScore) {
                    return rightScore - leftScore;
                }
                return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
            })
            .slice(0, sampleLimit)
            .map((item) => ({
                ...item,
                issueScore: undefined,
            }));

        return {
            recordedAt,
            summary: {
                totalEntries,
                expiredEntries,
                staleEntries,
                nearExpiryEntries,
                lowConfidenceEntries,
                healthScore,
                status,
                reason,
            },
            thresholds: {
                staleAfterHours,
                nearExpiryHours,
                lowConfidenceThreshold,
                sampleLimit,
            },
            byLayer,
            topUsers: Array.from(byUser.values())
                .sort((left, right) => {
                    const leftRisk = left.expiredEntries * 3 + left.staleEntries * 2 + left.lowConfidenceEntries;
                    const rightRisk = right.expiredEntries * 3 + right.staleEntries * 2 + right.lowConfidenceEntries;
                    if (rightRisk !== leftRisk) {
                        return rightRisk - leftRisk;
                    }
                    return right.totalEntries - left.totalEntries;
                })
                .slice(0, sampleLimit),
            samples: sampleEntries,
        };
    }

    private computeHash(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    private nextId(prefix: string): string {
        this.idCounter += 1;
        return `${prefix}_${this.idCounter.toString(36)}`;
    }

    private createAgentWorkspaceCapability(input: {
        capabilityId: string;
        actionId: string;
        targetAtomId: string;
        label: string;
        labelKey?: string;
        request?: Record<string, unknown>;
        execution: Record<string, unknown>;
    }): Record<string, unknown> {
        const capability: Record<string, unknown> = {
            capabilityId: input.capabilityId,
            actionId: input.actionId,
            targetAtomId: input.targetAtomId,
            label: input.label,
            execution: input.execution,
        };
        if (isNonEmptyString(input.labelKey)) {
            capability.labelKey = input.labelKey.trim();
        }
        if (input.request && typeof input.request === 'object' && Object.keys(input.request).length > 0) {
            capability.request = input.request;
        }
        return capability;
    }

    private buildAgentWorkspaceCapabilities(atomId: string): Record<string, unknown>[] {
        const buildTutorCapability = (actionId: string, label: string, actionKind: TutorActionKind) => (
            this.createAgentWorkspaceCapability({
                capabilityId: `cap_${actionId}_${atomId}`,
                actionId,
                targetAtomId: atomId,
                label,
                labelKey: `agentWorkspace.actions.${actionId}`,
                request: {
                    actionKind,
                },
                execution: {
                    kind: 'knowledge_operation',
                    operationId: 'execute_tutor_action',
                    resultPresentation: 'tutor_action_card',
                },
            })
        );
        const buildKnowledgeOperationCapability = (
            actionId: string,
            label: string,
            labelKey: string,
            operationId: string,
            resultPresentation: string,
            request = {}
        ) => this.createAgentWorkspaceCapability({
            capabilityId: `cap_${actionId}_${atomId}`,
            actionId,
            targetAtomId: atomId,
            label,
            labelKey,
            request,
            execution: {
                kind: 'knowledge_operation',
                operationId,
                resultPresentation,
            },
        });

        return [
            this.createAgentWorkspaceCapability({
                capabilityId: `cap_open_focus_mode_${atomId}`,
                actionId: 'open_focus_mode',
                targetAtomId: atomId,
                label: 'Focus',
                labelKey: 'agentWorkspace.actions.focus',
                execution: {
                    kind: 'local_focus_mode',
                },
            }),
            this.createAgentWorkspaceCapability({
                capabilityId: `cap_open_learning_path_${atomId}`,
                actionId: 'open_learning_path',
                targetAtomId: atomId,
                label: 'Learning Path',
                labelKey: 'agentWorkspace.actions.learningPath',
                execution: {
                    kind: 'knowledge_operation',
                    operationId: 'build_learning_path',
                    resultPresentation: 'learning_path_pane',
                },
            }),
            this.createAgentWorkspaceCapability({
                capabilityId: `cap_build_study_session_${atomId}`,
                actionId: 'build_study_session',
                targetAtomId: atomId,
                label: 'Study Session',
                labelKey: 'agentWorkspace.actions.studySession',
                execution: {
                    kind: 'knowledge_operation',
                    operationId: 'build_study_session',
                    resultPresentation: 'study_session_card',
                },
            }),
            buildTutorCapability('generate_quiz', 'Quiz', 'generate_quiz'),
            buildTutorCapability('recap', 'Recap', 'recap'),
            buildTutorCapability('generate_transfer', 'Transfer Challenge', 'generate_transfer'),
            buildTutorCapability('generate_counterexample', 'Counterexample Challenge', 'generate_counterexample'),
            buildTutorCapability('follow_up', 'Follow-Up', 'follow_up'),
            buildKnowledgeOperationCapability(
                'compare_query_backends',
                'Query Backend Comparison',
                'agentWorkspace.actions.compareQueryBackends',
                'compare_query_backends',
                'query_backend_comparison_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_query_backend_diagnostics',
                'Query Backend Diagnostics',
                'agentWorkspace.actions.queryBackendDiagnostics',
                'fetch_query_backend_diagnostics',
                'query_backend_diagnostics_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_query_backend_comparison_history',
                'Comparison History',
                'agentWorkspace.actions.queryBackendComparisonHistory',
                'fetch_query_backend_comparison_history',
                'query_backend_comparison_history_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_query_backend_comparison_trend',
                'Comparison Trend',
                'agentWorkspace.actions.queryBackendComparisonTrend',
                'fetch_query_backend_comparison_trend',
                'query_backend_comparison_trend_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_tutor_adapter_telemetry',
                'Tutor Adapter Telemetry',
                'agentWorkspace.actions.tutorAdapterTelemetry',
                'fetch_tutor_adapter_telemetry',
                'tutor_adapter_telemetry_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_tutor_trace_diagnostics',
                'Tutor Trace Diagnostics',
                'agentWorkspace.actions.tutorTraceDiagnostics',
                'fetch_tutor_trace_diagnostics',
                'tutor_trace_diagnostics_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_learning_quality_trend',
                'Learning Quality Trend',
                'agentWorkspace.actions.learningQualityTrend',
                'fetch_learning_quality_trend',
                'learning_quality_trend_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_learning_quality_history',
                'Learning Quality History',
                'agentWorkspace.actions.learningQualityHistory',
                'fetch_learning_quality_history',
                'learning_quality_history_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_session_plan_quality_trend',
                'Session Plan Quality Trend',
                'agentWorkspace.actions.sessionPlanQualityTrend',
                'fetch_session_plan_quality_trend',
                'session_plan_quality_trend_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_session_plan_quality_history',
                'Session Plan Quality History',
                'agentWorkspace.actions.sessionPlanQualityHistory',
                'fetch_session_plan_quality_history',
                'session_plan_quality_history_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_runtime_capability_runbook_verify',
                'Runtime Verify',
                'agentWorkspace.actions.runtimeRunbookVerify',
                'verify_runtime_capability_runbook',
                'runtime_capability_runbook_verify_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_runtime_capability_runbook_history',
                'Runtime History',
                'agentWorkspace.actions.runtimeRunbookHistory',
                'fetch_runtime_capability_runbook_history',
                'runtime_capability_runbook_history_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_runtime_capability_runbook_checks',
                'Runtime Checks',
                'agentWorkspace.actions.runtimeRunbookChecks',
                'fetch_runtime_capability_runbook_checks',
                'runtime_capability_runbook_checks_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_runtime_capability_runbook_action_queue',
                'Runtime Queue',
                'agentWorkspace.actions.runtimeRunbookActionQueue',
                'fetch_runtime_capability_runbook_action_queue',
                'runtime_capability_runbook_action_queue_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_session_history',
                'Session History',
                'agentWorkspace.actions.sessionHistory',
                'fetch_session_history',
                'session_history_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_conversation_memory',
                'Conversation Memory',
                'agentWorkspace.actions.conversationMemory',
                'search_conversation_memory',
                'assistant_message',
                {
                    memoryNamespace: 'conversation',
                    memoryQuery: 'focus evidence',
                    memoryLimit: 6,
                }
            ),
            buildKnowledgeOperationCapability(
                'inspect_conversation_turn_cache_diagnostics',
                'Turn Cache Diagnostics',
                'agentWorkspace.actions.conversationTurnCacheDiagnostics',
                'fetch_conversation_turn_cache_diagnostics',
                'conversation_turn_cache_diagnostics_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_conversation_turn_cache_alert_trend',
                'Turn Cache Trend',
                'agentWorkspace.actions.conversationTurnCacheAlertTrend',
                'fetch_conversation_turn_cache_alert_trend',
                'conversation_turn_cache_alert_trend_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_conversation_turn_cache_alert_trend_index',
                'Turn Cache Trend Index',
                'agentWorkspace.actions.conversationTurnCacheAlertTrendIndex',
                'fetch_conversation_turn_cache_alert_trend_index',
                'conversation_turn_cache_alert_trend_card'
            ),
            buildKnowledgeOperationCapability(
                'inspect_conversation_turn_cache_alert_trend_export',
                'Turn Cache Trend Export',
                'agentWorkspace.actions.conversationTurnCacheAlertTrendExport',
                'fetch_conversation_turn_cache_alert_trend_export',
                'conversation_turn_cache_alert_trend_card'
            ),
        ];
    }

    private filterConversationMemoryRecordsByScope(
        records: AgentConversationMemoryRecord[],
        scope: KnowledgeQueryResolvedScope
    ): AgentConversationMemoryRecord[] {
        if (scope.source === 'global') {
            return records;
        }
        return records.filter((record) => {
            const tags = Array.isArray(record.tags) ? record.tags : [];
            const scopedWorkspace = scope.workspaceId ? `scope_workspace:${scope.workspaceId}` : '';
            const scopedCorpus = scope.corpusId ? `scope_corpus:${scope.corpusId}` : '';
            const hasExplicitScopeTag = tags.some((tag) => tag.startsWith('scope_workspace:') || tag.startsWith('scope_corpus:'));
            const recordWorkspaceId = this.normalizeMemoryScopeValue(record.scopeWorkspaceId);
            const recordCorpusId = this.normalizeMemoryScopeValue(record.scopeCorpusId);
            if (recordWorkspaceId || recordCorpusId) {
                return Boolean(
                    (scope.workspaceId && recordWorkspaceId === scope.workspaceId)
                    || (scope.corpusId && recordCorpusId === scope.corpusId)
                );
            }
            if (!hasExplicitScopeTag) {
                return true;
            }
            return Boolean(
                (scopedWorkspace && tags.includes(scopedWorkspace))
                || (scopedCorpus && tags.includes(scopedCorpus))
            );
        });
    }

    private recordAgentConversationTurn(params: {
        sessionId: string;
        userId: string;
        request: AgentConversationRequest;
        response: AgentConversationResponse;
    }): void {
        const nowIso = this.nowProvider().toISOString();
        const turnId = this.nextId('agent_turn');
        const invocationId = params.response.trace.invocationId;
        const existingSession = this.conversationSessions.get(params.sessionId);
        const sessionRecord: AgentConversationSessionRecord = existingSession
            ? {
                ...existingSession,
                updatedAt: nowIso,
                turnIds: [...existingSession.turnIds, turnId].slice(-CONVERSATION_TURN_HISTORY_LIMIT),
            }
            : {
                sessionId: params.sessionId,
                userId: params.userId,
                workspaceId: params.response.trace.usedScope.workspaceId,
                corpusId: params.response.trace.usedScope.corpusId,
                namespace: params.request.memoryNamespace || 'conversation',
                createdAt: nowIso,
                updatedAt: nowIso,
                turnIds: [turnId],
            };
        this.conversationSessions.set(params.sessionId, sessionRecord);
        this.conversationTurns.set(turnId, {
            turnId,
            invocationId,
            sessionId: params.sessionId,
            userId: params.userId,
            createdAt: nowIso,
            updatedAt: nowIso,
            request: { ...params.request },
            response: params.response,
        });
        while (this.conversationTurns.size > CONVERSATION_TURN_HISTORY_LIMIT) {
            const oldestTurnId = this.conversationTurns.keys().next().value;
            if (typeof oldestTurnId !== 'string') {
                break;
            }
            this.conversationTurns.delete(oldestTurnId);
        }
        this.conversationInvocations.push({
            invocationId,
            sessionId: params.sessionId,
            userId: params.userId,
            createdAt: nowIso,
            status: 'completed',
            query: normalizeWhitespace(String(params.request.message || '')),
            returnedKnowledgePoints: params.response.summary.returnedKnowledgePoints,
            returnedCitations: params.response.summary.returnedCitations,
            recalledMemoryCount: params.response.summary.recalledMemoryCount,
            appliedMemoryCount: params.response.summary.appliedMemoryCount,
        });
        if (this.conversationInvocations.length > CONVERSATION_INVOCATION_HISTORY_LIMIT) {
            this.conversationInvocations.splice(0, this.conversationInvocations.length - CONVERSATION_INVOCATION_HISTORY_LIMIT);
        }
    }

    private upsertConversationSessionState(params: {
        sessionId: string;
        userId: string;
        mode: LearningSessionStateRecord['mode'];
        workspaceId: string | null;
        corpusId: string | null;
        activeResourceIds: string[];
        activeProjectionIds: string[];
        topK: number;
        queryBackend: string | null;
        persistMemory: boolean;
        memoryNamespace: string | null;
        exportProfileId?: string | null;
        panelState?: Record<string, unknown>;
        recordedAt: string;
    }): void {
        const existing = this.sessionStateStore.get(params.sessionId);
        this.sessionStateStore.upsert({
            sessionId: params.sessionId,
            userId: params.userId,
            workspaceId: params.workspaceId,
            corpusId: params.corpusId,
            mode: params.mode,
            activeResourceIds: params.activeResourceIds,
            activeProjectionIds: params.activeProjectionIds,
            retrievalSettings: {
                topK: params.topK,
                queryBackend: params.queryBackend,
                persistMemory: params.persistMemory,
            },
            memorySettings: {
                namespace: params.memoryNamespace,
                enabled: params.persistMemory,
            },
            exportProfileId: params.exportProfileId || null,
            panelState: {
                ...(existing?.panelState || {}),
                ...(params.panelState || {}),
            },
            recordedAt: params.recordedAt,
        });
    }

    private normalizeWorkspaceScopedSessionValue(value: unknown): string | null {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized || null;
    }

    private normalizeGraphFocusSourcePath(value: unknown): string {
        return String(value || '').trim().replace(/\\/g, '/');
    }

    private normalizeGraphFocusSourcePathList(value: unknown): string[] {
        return Array.from(new Set(
            (Array.isArray(value) ? value : [])
                .map((entry) => this.normalizeGraphFocusSourcePath(entry))
                .filter(Boolean)
        ));
    }

    private inferWorkspaceIdFromKnowledgeBaseSourcePath(sourcePath: string): string | null {
        const normalized = this.normalizeGraphFocusSourcePath(sourcePath);
        if (!normalized) {
            return null;
        }
        const segments = normalized.split('/').filter(Boolean);
        if (segments.length < 2 || String(segments[0] || '').toLowerCase() !== 'knowledge_base') {
            return null;
        }
        const workspaceId = String(segments[1] || '').trim().toLowerCase();
        return workspaceId || null;
    }

    private buildGraphFocusRenderDiagnosticsRecord(
        request: Partial<GraphFocusRenderDiagnosticsRequest>,
        recordedAt: string
    ): GraphFocusRenderDiagnosticsRecord {
        const requestedSourcePath = this.normalizeGraphFocusSourcePath(request.requestedSourcePath);
        const resolvedSourcePath = this.normalizeGraphFocusSourcePath(request.resolvedSourcePath);
        return {
            recordedAt,
            title: String(request.title || '').trim(),
            requestedSourcePath,
            resolvedSourcePath,
            candidateSourcePaths: this.normalizeGraphFocusSourcePathList(request.candidateSourcePaths),
            attemptedSourcePaths: this.normalizeGraphFocusSourcePathList(request.attemptedSourcePaths),
            fallbackSourcePathUsed: request.fallbackSourcePathUsed === true,
            matchedSpanCount: Number.isFinite(Number(request.matchedSpanCount)) ? Math.max(0, Math.floor(Number(request.matchedSpanCount))) : 0,
            highlightTermCount: Number.isFinite(Number(request.highlightTermCount)) ? Math.max(0, Math.floor(Number(request.highlightTermCount))) : 0,
            highlightedNodeCount: Number.isFinite(Number(request.highlightedNodeCount)) ? Math.max(0, Math.floor(Number(request.highlightedNodeCount))) : 0,
            markdownRuntimeAvailable: request.markdownRuntimeAvailable === true,
            storageProviderAvailable: request.storageProviderAvailable === true,
            readSucceeded: request.readSucceeded === true,
            renderSucceeded: request.renderSucceeded === true,
            usedFallback: request.usedFallback === true,
            failureReason: String(request.failureReason || '').trim(),
        };
    }

    private readGraphFocusRenderDiagnosticsRecords(panelState: Record<string, unknown>): GraphFocusRenderDiagnosticsRecord[] {
        const rawReports = Array.isArray(panelState.graphFocusReports) ? panelState.graphFocusReports : [];
        return rawReports
            .map((entry) => {
                if (!entry || typeof entry !== 'object') {
                    return null;
                }
                const record = entry as Record<string, unknown>;
                const recordedAt = this.resolveOptionalTimestamp(record.recordedAt) || this.resolveTimestamp(undefined);
                return this.buildGraphFocusRenderDiagnosticsRecord({
                    title: String(record.title || '').trim(),
                    requestedSourcePath: this.normalizeGraphFocusSourcePath(record.requestedSourcePath),
                    resolvedSourcePath: this.normalizeGraphFocusSourcePath(record.resolvedSourcePath),
                    candidateSourcePaths: this.normalizeGraphFocusSourcePathList(record.candidateSourcePaths),
                    attemptedSourcePaths: this.normalizeGraphFocusSourcePathList(record.attemptedSourcePaths),
                    fallbackSourcePathUsed: record.fallbackSourcePathUsed === true,
                    matchedSpanCount: Number(record.matchedSpanCount),
                    highlightTermCount: Number(record.highlightTermCount),
                    highlightedNodeCount: Number(record.highlightedNodeCount),
                    markdownRuntimeAvailable: record.markdownRuntimeAvailable === true,
                    storageProviderAvailable: record.storageProviderAvailable === true,
                    readSucceeded: record.readSucceeded === true,
                    renderSucceeded: record.renderSucceeded === true,
                    usedFallback: record.usedFallback === true,
                    failureReason: String(record.failureReason || '').trim(),
                }, recordedAt);
            })
            .filter((entry): entry is GraphFocusRenderDiagnosticsRecord => Boolean(entry));
    }

    public async recordGraphFocusRenderDiagnostics(request: GraphFocusRenderDiagnosticsRequest): Promise<{
        sessionStateId: string;
        sessionId: string;
        reportCount: number;
        stored: GraphFocusRenderDiagnosticsRecord;
    }> {
        await this.ensureHydrated();
        const sessionId = String(request.sessionId || '').trim();
        if (!sessionId) {
            throw new Error('Graph-focus diagnostics require a non-empty sessionId.');
        }
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('Graph-focus diagnostics require a non-empty userId.');
        }
        const recordedAt = this.resolveTimestamp(request.recordedAt);
        const storedReport = this.buildGraphFocusRenderDiagnosticsRecord(request, recordedAt);
        const existing = this.sessionStateStore.get(sessionId);
        if (existing && existing.userId !== userId) {
            throw new Error(`Graph-focus diagnostics session "${sessionId}" is already owned by another user.`);
        }
        const inferredWorkspaceId = this.inferWorkspaceIdFromKnowledgeBaseSourcePath(
            storedReport.resolvedSourcePath || storedReport.requestedSourcePath
        );
        const workspaceId = existing?.workspaceId
            || this.normalizeWorkspaceScopedSessionValue(request.workspaceId)
            || inferredWorkspaceId;
        const corpusId = existing?.corpusId
            || this.normalizeWorkspaceScopedSessionValue(request.corpusId)
            || workspaceId;
        const workspace = workspaceId ? this.workspaceRegistry.getWorkspaceById(workspaceId) : null;
        const existingPanelState = existing?.panelState && typeof existing.panelState === 'object'
            ? existing.panelState as Record<string, unknown>
            : {};
        const nextGraphFocusReports = [
            ...this.readGraphFocusRenderDiagnosticsRecords(existingPanelState),
            storedReport,
        ].slice(-GRAPH_FOCUS_REPORT_HISTORY_LIMIT);
        const nextPanelState = {
            ...existingPanelState,
            graphFocusReports: nextGraphFocusReports,
        };
        const nextSessionState = this.sessionStateStore.upsert({
            sessionId,
            userId,
            workspaceId,
            corpusId,
            mode: existing?.mode || 'grounded_conversation',
            activeResourceIds: existing?.activeResourceIds || [],
            activeProjectionIds: existing?.activeProjectionIds || [],
            retrievalSettings: existing?.retrievalSettings
                ? { ...existing.retrievalSettings }
                : {
                    topK: 0,
                    queryBackend: null,
                    persistMemory: false,
                },
            memorySettings: existing?.memorySettings
                ? { ...existing.memorySettings }
                : {
                    namespace: null,
                    enabled: false,
                },
            exportProfileId: existing?.exportProfileId || workspace?.exportProfileId || null,
            panelState: nextPanelState,
            recordedAt,
        });
        await this.persistIfNeeded();
        return {
            sessionStateId: nextSessionState.sessionStateId,
            sessionId: nextSessionState.sessionId,
            reportCount: nextGraphFocusReports.length,
            stored: storedReport,
        };
    }

    private recordWorkflowArtifact(params: {
        kind: WorkflowArtifactKind;
        sessionId?: string | null;
        userId?: string | null;
        workspaceId?: string | null;
        corpusId?: string | null;
        title: string;
        sourceAtomIds?: string[];
        summary: string;
        payload: Record<string, unknown>;
        recordedAt: string;
    }): WorkflowArtifactRecord {
        return this.workflowArtifactStore.recordArtifact({
            kind: params.kind,
            sessionId: params.sessionId || null,
            userId: params.userId || null,
            workspaceId: params.workspaceId || null,
            corpusId: params.corpusId || null,
            title: params.title,
            sourceResourceIds: this.resolveSourceResourceIdsForAtomIds(params.sourceAtomIds || []),
            sourceProjectionIds: this.resolveSourceProjectionIdsForAtomIds(params.sourceAtomIds || []),
            summary: params.summary,
            payload: params.payload,
            status: 'active',
            recordedAt: params.recordedAt,
        });
    }

    private cloneArtifactPayload<T extends Record<string, unknown>>(payload: T): T {
        return JSON.parse(JSON.stringify(payload || {})) as T;
    }

    private normalizeKnowledgeRunReviewCards(value: unknown): KnowledgeRunReviewCard[] {
        const cards = Array.isArray(value) ? value : [];
        return cards
            .filter((card): card is Record<string, unknown> => Boolean(card && typeof card === 'object'))
            .map((card) => ({
                cardId: String(card.cardId || '').trim(),
                sourceClaimId: String(card.sourceClaimId || '').trim(),
                atomId: isNonEmptyString(card.atomId) ? String(card.atomId).trim() : undefined,
                suggestedActionKind: isNonEmptyString(card.suggestedActionKind)
                    ? card.suggestedActionKind as LearningActionKind
                    : undefined,
                prompt: String(card.prompt || '').trim(),
                expectedAnswer: String(card.expectedAnswer || '').trim(),
                evidenceRefs: Array.isArray(card.evidenceRefs)
                    ? card.evidenceRefs.map((item) => String(item || '').trim()).filter(Boolean)
                    : [],
                nextReviewAt: String(card.nextReviewAt || '').trim(),
            }))
            .filter((card) => isNonEmptyString(card.cardId));
    }

    private buildKnowledgeRunReviewState(
        reviewCards: KnowledgeRunReviewCard[],
        consumedCardIdsRaw: unknown,
        completedAtRaw: unknown,
        fallbackCompletedAt: string | null = null
    ): KnowledgeRunReviewState {
        const validCardIds = new Set(reviewCards.map((card) => card.cardId));
        const consumedCardIds = Array.isArray(consumedCardIdsRaw)
            ? Array.from(new Set(
                consumedCardIdsRaw
                    .map((value) => String(value || '').trim())
                    .filter((value) => validCardIds.has(value))
            ))
            : [];
        const completedReviewCardCount = consumedCardIds.length;
        const remainingReviewCardCount = Math.max(0, reviewCards.length - completedReviewCardCount);
        const completedAt = remainingReviewCardCount <= 0
            ? (
                isNonEmptyString(completedAtRaw)
                    ? String(completedAtRaw).trim()
                    : (fallbackCompletedAt || null)
            )
            : null;
        return {
            consumedCardIds,
            completedReviewCardCount,
            remainingReviewCardCount,
            completedAt,
        };
    }

    private updateKnowledgeRunSummaryReviewProgress(
        knowledgeRun: KnowledgeRun,
        reviewState: KnowledgeRunReviewState
    ): KnowledgeRun {
        return {
            ...knowledgeRun,
            reviewState,
            summary: {
                ...knowledgeRun.summary,
                reviewCardCount: knowledgeRun.reviewCards.length,
                completedReviewCardCount: reviewState.completedReviewCardCount,
                remainingReviewCardCount: reviewState.remainingReviewCardCount,
            },
        };
    }

    private buildFlashcardBatchArtifactSummary(
        reviewCards: KnowledgeRunReviewCard[],
        reviewState: KnowledgeRunReviewState
    ): string {
        return `Prepared ${reviewCards.length} review card(s); ${reviewState.completedReviewCardCount} completed and ${reviewState.remainingReviewCardCount} remaining.`;
    }

    private resolveRelatedKnowledgeRunArtifact(
        flashcardArtifact: WorkflowArtifactRecord,
        runId: string
    ): WorkflowArtifactRecord | null {
        if (!isNonEmptyString(runId)) {
            return null;
        }
        const candidateArtifacts = flashcardArtifact.sessionId
            ? this.workflowArtifactStore.listBySession(flashcardArtifact.sessionId)
            : flashcardArtifact.workspaceId
                ? this.workflowArtifactStore.listByWorkspace(flashcardArtifact.workspaceId, flashcardArtifact.userId)
                : [];
        return candidateArtifacts.find((artifact) => {
            if (artifact.kind !== 'knowledge_run') {
                return false;
            }
            const payload = artifact.payload as Record<string, unknown>;
            const knowledgeRunRecord = payload.knowledgeRun && typeof payload.knowledgeRun === 'object'
                ? payload.knowledgeRun as Record<string, unknown>
                : null;
            return knowledgeRunRecord !== null && String(knowledgeRunRecord.runId || '').trim() === runId;
        }) || null;
    }

    public async executeWorkflowArtifactReviewFollowUp(
        request: WorkflowArtifactReviewFollowUpRequest
    ): Promise<WorkflowArtifactReviewFollowUpResponse> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('WorkflowArtifactReviewFollowUpAPI requires a non-empty userId.');
        }
        const artifactId = String(request.artifactId || '').trim();
        const cardId = String(request.cardId || '').trim();
        if (!artifactId || !cardId) {
            throw new Error('WorkflowArtifactReviewFollowUpAPI requires non-empty artifactId and cardId.');
        }
        const artifact = this.workflowArtifactStore.getArtifactById(artifactId);
        if (!artifact) {
            throw new Error(`Workflow artifact "${artifactId}" was not found.`);
        }
        if (artifact.kind !== 'flashcard_batch') {
            throw new Error(`Workflow artifact "${artifactId}" is not a flashcard batch.`);
        }
        if (artifact.userId && artifact.userId !== userId) {
            throw new Error(`Workflow artifact "${artifactId}" does not belong to user "${userId}".`);
        }
        const artifactPayload = this.cloneArtifactPayload(artifact.payload || {});
        const reviewCards = this.normalizeKnowledgeRunReviewCards(artifactPayload.reviewCards);
        const targetCard = reviewCards.find((card) => card.cardId === cardId);
        if (!targetCard) {
            throw new Error(`Workflow artifact "${artifactId}" does not contain review card "${cardId}".`);
        }
        const currentReviewState = this.buildKnowledgeRunReviewState(
            reviewCards,
            (artifactPayload.reviewState as Record<string, unknown> | undefined)?.consumedCardIds,
            (artifactPayload.reviewState as Record<string, unknown> | undefined)?.completedAt,
        );
        if (currentReviewState.consumedCardIds.includes(cardId)) {
            throw new Error(`Workflow artifact review card "${cardId}" has already been consumed.`);
        }

        const actionAtomId = isNonEmptyString(request.action?.atomId)
            ? String(request.action?.atomId).trim()
            : String(targetCard.atomId || '').trim();
        if (!actionAtomId || !this.activeAtomIds.has(actionAtomId)) {
            throw new Error(`Workflow artifact review card "${cardId}" does not resolve to an active atom.`);
        }
        const actionKind = request.action?.kind || targetCard.suggestedActionKind || 'review';
        const studySessionAction = await this.executeStudySessionAction({
            userId,
            sessionId: isNonEmptyString(request.sessionId)
                ? request.sessionId.trim()
                : (artifact.sessionId || undefined),
            action: {
                atomId: actionAtomId,
                kind: actionKind,
                source: request.action?.source || 'flashcard_batch',
                prompt: isNonEmptyString(request.action?.prompt) ? request.action?.prompt : targetCard.prompt,
                answer: isNonEmptyString(request.action?.answer) ? request.action?.answer : undefined,
            },
            outcome: request.outcome,
            errorTag: request.errorTag,
            autoAnalyzeAnswer: request.autoAnalyzeAnswer,
            autoUpdateMasteryFromAnswer: request.autoUpdateMasteryFromAnswer,
            executedAt: request.executedAt,
            persistMemory: request.persistMemory,
            memoryLayer: request.memoryLayer,
            tutorAdapterId: request.tutorAdapterId,
            tutorProviderName: request.tutorProviderName,
            tutorProviderMode: request.tutorProviderMode,
            autoPromoteMemory: request.autoPromoteMemory,
            promoteMemoryTargetLayer: request.promoteMemoryTargetLayer,
            promoteMemoryMinConfidence: request.promoteMemoryMinConfidence,
            promoteMemoryRemoveFromSource: request.promoteMemoryRemoveFromSource,
        });

        const updatedReviewState = this.buildKnowledgeRunReviewState(
            reviewCards,
            [...currentReviewState.consumedCardIds, cardId],
            currentReviewState.completedAt,
            studySessionAction.executedAt
        );
        const archivedArtifact = updatedReviewState.remainingReviewCardCount <= 0;
        const updatedArtifact = this.workflowArtifactStore.updateArtifact(artifactId, (current) => ({
            ...current,
            status: archivedArtifact ? 'archived' : current.status,
            updatedAt: studySessionAction.executedAt,
            summary: this.buildFlashcardBatchArtifactSummary(reviewCards, updatedReviewState),
            payload: {
                ...this.cloneArtifactPayload(current.payload || {}),
                runId: String(artifactPayload.runId || '').trim(),
                reviewCards,
                evidenceClaims: Array.isArray(artifactPayload.evidenceClaims)
                    ? artifactPayload.evidenceClaims
                    : [],
                reviewState: updatedReviewState,
            },
        }));
        if (!updatedArtifact) {
            throw new Error(`Workflow artifact "${artifactId}" could not be updated.`);
        }

        const runId = String(artifactPayload.runId || '').trim();
        const relatedKnowledgeRunArtifact = this.resolveRelatedKnowledgeRunArtifact(updatedArtifact, runId);
        const updatedKnowledgeRunArtifact = relatedKnowledgeRunArtifact
            ? this.workflowArtifactStore.updateArtifact(relatedKnowledgeRunArtifact.artifactId, (current) => {
                const payload = this.cloneArtifactPayload(current.payload || {});
                const rawKnowledgeRun = payload.knowledgeRun as KnowledgeRun | undefined;
                if (!rawKnowledgeRun) {
                    return current;
                }
                const normalizedKnowledgeRunCards = this.normalizeKnowledgeRunReviewCards(rawKnowledgeRun.reviewCards);
                const knowledgeRunReviewState = this.buildKnowledgeRunReviewState(
                    normalizedKnowledgeRunCards,
                    [...updatedReviewState.consumedCardIds],
                    updatedReviewState.completedAt,
                    studySessionAction.executedAt
                );
                const updatedKnowledgeRun = this.updateKnowledgeRunSummaryReviewProgress(
                    {
                        ...rawKnowledgeRun,
                        reviewCards: normalizedKnowledgeRunCards,
                    },
                    knowledgeRunReviewState
                );
                return {
                    ...current,
                    status: archivedArtifact ? 'archived' : current.status,
                    updatedAt: studySessionAction.executedAt,
                    summary: `Generated ${updatedKnowledgeRun.summary.claimCount} evidence claim(s); ${updatedKnowledgeRun.summary.completedReviewCardCount} review card(s) completed and ${updatedKnowledgeRun.summary.remainingReviewCardCount} remaining.`,
                    payload: {
                        ...payload,
                        knowledgeRun: updatedKnowledgeRun,
                    },
                };
            })
            : null;

        await this.persistIfNeeded();

        return {
            artifact: updatedArtifact,
            relatedKnowledgeRunArtifact: updatedKnowledgeRunArtifact,
            studySessionAction,
            consumedCardId: cardId,
            completedReviewCardCount: updatedReviewState.completedReviewCardCount,
            remainingReviewCardCount: updatedReviewState.remainingReviewCardCount,
            archivedArtifact,
        };
    }

    public async queryWorkflowArtifacts(request: WorkflowArtifactQueryRequest = {}): Promise<WorkflowArtifactQueryResponse> {
        await this.ensureHydrated();
        const generatedAt = this.resolveTimestamp(undefined);
        const workspaceId = isNonEmptyString(request.workspaceId) ? request.workspaceId.trim().toLowerCase() : null;
        const sessionId = isNonEmptyString(request.sessionId) ? request.sessionId.trim() : null;
        const userId = isNonEmptyString(request.userId) ? request.userId.trim() : null;
        const artifactId = isNonEmptyString(request.artifactId) ? request.artifactId.trim() : null;
        const runId = isNonEmptyString(request.runId) ? request.runId.trim() : null;
        const limit = clamp(Math.floor(Number(request.limit) || 12), 1, 100);
        const artifactKinds = Array.isArray(request.artifactKinds)
            ? request.artifactKinds
                .map((kind) => String(kind || '').trim())
                .filter(Boolean)
            : [];

        let artifacts = workspaceId
            ? this.workflowArtifactStore.listByWorkspace(workspaceId, userId)
            : sessionId
                ? this.workflowArtifactStore.listBySession(sessionId)
                : this.workflowArtifactStore.listAll();

        if (!workspaceId && sessionId && userId) {
            artifacts = artifacts.filter((artifact) => artifact.userId === userId);
        }
        if (!workspaceId && !sessionId && userId) {
            artifacts = artifacts.filter((artifact) => artifact.userId === userId);
        }
        if (artifactId) {
            artifacts = artifacts.filter((artifact) => artifact.artifactId === artifactId);
        }
        if (runId) {
            artifacts = artifacts.filter((artifact) => this.resolveWorkflowArtifactRunId(artifact) === runId);
        }
        if (artifactKinds.length > 0) {
            const allowedKinds = new Set(artifactKinds);
            artifacts = artifacts.filter((artifact) => allowedKinds.has(artifact.kind));
        }

        const normalizedArtifacts = artifacts
            .slice(0, limit)
            .map((artifact) => ({
                ...artifact,
                sourceResourceIds: [...artifact.sourceResourceIds],
                sourceProjectionIds: [...artifact.sourceProjectionIds],
                payload: this.cloneArtifactPayload(artifact.payload || {}),
            }));

        return {
            generatedAt,
            workspaceId,
            sessionId,
            userId,
            returnedArtifacts: normalizedArtifacts.length,
            artifacts: normalizedArtifacts,
        };
    }

    private buildWorkspaceIndexSummary(units: IndexUnitRecord[], segments: IndexSegmentRecord[]): IndexLifecycleSummary {
        const states: IndexLifecycleSummary['states'] = {
            pending: 0,
            indexing: 0,
            indexed: 0,
            failed: 0,
            disabled: 0,
        };
        units.forEach((unit) => {
            states[unit.state] += 1;
        });
        return {
            totalUnits: units.length,
            totalSegments: segments.length,
            states,
            activeDocuments: new Set(units.map((unit) => unit.documentId).filter(Boolean)).size,
            activeAtomUnits: units.filter((unit) => unit.atomId !== null).length,
        };
    }

    private doesMemoryEntryMatchWorkspace(
        entry: MemoryEntry,
        workspaceId: string,
        corpusId: string,
        workspaceAtomIds: Set<string>
    ): boolean {
        const entryWorkspaceId = this.normalizeMemoryScopeValue(entry.scopeWorkspaceId);
        const entryCorpusId = this.normalizeMemoryScopeValue(entry.scopeCorpusId);
        if (entryWorkspaceId) {
            return entryWorkspaceId === workspaceId;
        }
        if (entryCorpusId) {
            return entryCorpusId === corpusId;
        }
        return (entry.references || []).some((reference) => workspaceAtomIds.has(String(reference || '').trim()));
    }

    private collectWorkspaceMemoryExportRecords(params: {
        workspaceId: string;
        corpusId: string;
        userId?: string | null;
        workspaceAtomIds: Set<string>;
    }): WorkspaceScopedMemoryExportRecord[] {
        const normalizedUserId = String(params.userId || '').trim();
        const records: WorkspaceScopedMemoryExportRecord[] = [];
        this.userMemory.forEach((bank, userId) => {
            if (normalizedUserId && userId !== normalizedUserId) {
                return;
            }
            (['session', 'unit', 'long_term'] as MemoryLayer[]).forEach((layer) => {
                bank[layer]
                    .filter((entry) => this.doesMemoryEntryMatchWorkspace(entry, params.workspaceId, params.corpusId, params.workspaceAtomIds))
                    .forEach((entry) => {
                        records.push({
                            userId,
                            layer,
                            entry: {
                                ...entry,
                                tags: [...entry.tags],
                                references: [...entry.references],
                            },
                        });
                    });
            });
        });
        return records;
    }

    private collectWorkspaceMemoryAuditRecords(params: {
        workspaceId: string;
        corpusId: string;
        userId?: string | null;
    }): MemoryAuditRecord[] {
        const normalizedUserId = String(params.userId || '').trim();
        return this.memoryAuditRecords.filter((record) => {
            if (normalizedUserId && record.userId !== normalizedUserId) {
                return false;
            }
            if (this.normalizeMemoryScopeValue(record.scopeWorkspaceId) === params.workspaceId) {
                return true;
            }
            return this.normalizeMemoryScopeValue(record.scopeCorpusId) === params.corpusId;
        });
    }

    public async buildWorkspaceExportBundle(request: WorkspaceExportBundleRequest): Promise<WorkspaceExportBundle> {
        await this.ensureHydrated();
        const workspaceId = String(request.workspaceId || '').trim().toLowerCase();
        if (!workspaceId) {
            throw new Error('Workspace export requires a non-empty workspaceId.');
        }
        const workspace = this.workspaceRegistry.getWorkspaceById(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace export could not find workspace "${workspaceId}".`);
        }
        const includeDeleted = request.includeDeleted === true;
        const generatedAt = this.resolveTimestamp(request.generatedAt);
        const bindings = this.workspaceRegistry.listBindingsByWorkspace(workspace.workspaceId);
        const resourceIds = bindings.map((binding) => binding.resourceId);
        const bindingProjectionIds = bindings.map((binding) => binding.projectionId);
        const resources = this.resourceRegistry.listResourcesByIds(resourceIds, { includeDeleted });
        const projections = this.resourceRegistry.listProjectionsByIds(bindingProjectionIds, { includeDeleted });
        const projectionIds = projections.map((projection) => projection.projectionId);
        const units = this.indexLifecycle.listUnitsByProjectionIds(projectionIds);
        const segments = this.indexLifecycle.listSegmentsByUnitIds(units.map((unit) => unit.unitId));
        const documentIds = new Set(
            projections
                .map((projection) => projection.documentId)
                .filter((documentId): documentId is string => isNonEmptyString(documentId))
        );
        const atoms = Array.from(this.atoms.values()).filter((atom) => documentIds.has(atom.documentId));
        const workspaceAtomIds = new Set(atoms.map((atom) => atom.id));
        const evidenceSpanIds = new Set(atoms.flatMap((atom) => atom.evidenceSpanIds));
        const evidenceSpans = Array.from(this.evidenceSpans.values()).filter((span) => evidenceSpanIds.has(span.id));
        const relationEdges = this.collectActiveRelationEdges(generatedAt)
            .filter((edge) => workspaceAtomIds.has(edge.sourceAtomId) && workspaceAtomIds.has(edge.targetAtomId));
        const temporalEdges = Array.from(this.temporalEdges.values())
            .filter((edge) => workspaceAtomIds.has(edge.sourceAtomId) && workspaceAtomIds.has(edge.targetAtomId));
        const sessionStates = request.includeSessionState === false
            ? []
            : this.sessionStateStore.listByWorkspace(workspace.workspaceId, request.userId || null);
        const sessionIds = new Set(sessionStates.map((state) => state.sessionId));
        const conversationSessions = request.includeConversationHistory === false
            ? []
            : Array.from(this.conversationSessions.values()).filter((record) => sessionIds.has(record.sessionId));
        const turnIds = new Set(conversationSessions.flatMap((record) => record.turnIds));
        const conversationTurns = request.includeConversationHistory === false
            ? []
            : Array.from(this.conversationTurns.values()).filter((record) => turnIds.has(record.turnId));
        const conversationInvocations = request.includeConversationHistory === false
            ? []
            : this.conversationInvocations.filter((record) => sessionIds.has(record.sessionId));
        const workflowArtifacts = request.includeWorkflowArtifacts === false
            ? []
            : this.workflowArtifactStore.listByWorkspace(workspace.workspaceId, request.userId || null);
        const memoryEntries = request.includeMemory === false
            ? []
            : this.collectWorkspaceMemoryExportRecords({
                workspaceId: workspace.workspaceId,
                corpusId: workspace.corpusId,
                userId: request.userId || null,
                workspaceAtomIds,
            });
        const memoryAuditRecords = request.includeMemory === false
            ? []
            : this.collectWorkspaceMemoryAuditRecords({
                workspaceId: workspace.workspaceId,
                corpusId: workspace.corpusId,
                userId: request.userId || null,
            });
        return assembleWorkspaceExportBundle({
            request,
            workspace,
            bindings,
            resources,
            projections,
            indexSummary: this.buildWorkspaceIndexSummary(units, segments),
            units,
            segments,
            atoms,
            evidenceSpans,
            relationEdges,
            temporalEdges,
            sessionStates,
            conversationSessions,
            conversationTurns,
            conversationInvocations,
            workflowArtifacts,
            memoryEntries,
            memoryAuditRecords,
            generatedAt,
        });
    }

    public async agentConversation(request: AgentConversationRequest = {}): Promise<AgentConversationResponse> {
        await this.ensureHydrated();
        const userId = isNonEmptyString(request.userId)
            ? request.userId.trim()
            : 'path_user_default';
        const sessionId = isNonEmptyString(request.sessionId)
            ? request.sessionId.trim()
            : this.nextId('agent_session');
        const message = normalizeWhitespace(String(request.message || ''));
        const topK = clamp(Math.floor(Number(request.topK) || 6), 1, 18);
        const generatedAt = this.resolveTimestamp(request.asOf);
        const namespace = this.normalizeConversationMemoryNamespace(request.memoryNamespace);
        const queryResult = await this.queryKnowledge({
            query: message || 'local knowledge',
            topK,
            asOf: generatedAt,
            scope: request.scope,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints(
            queryResult.items,
            (atomId) => this.buildAgentWorkspaceCapabilities(atomId)
        );
        const citations = knowledgePoints
            .flatMap((point) => (
                Array.isArray(point.citations) && point.citations.length > 0
                    ? point.citations
                    : (point.citation ? [point.citation] : [])
            ))
            .filter((citation): citation is KnowledgeCitation => Boolean(citation));
        const recalledMemoryResult = await this.searchConversationMemory({
            userId,
            namespace,
            query: message || 'memory',
            limit: 6,
            now: generatedAt,
        });
        const recalledMemories = this.filterConversationMemoryRecordsByScope(
            Array.isArray(recalledMemoryResult.entries) ? recalledMemoryResult.entries as AgentConversationMemoryRecord[] : [],
            queryResult.trace.scope || {
                source: 'global',
                workspaceId: null,
                corpusId: null,
                documentIds: [],
                atomIds: [],
                sourcePathPrefixes: [],
                languages: [],
                matchedAtomCount: 0,
            }
        );

        const memoryActions: AgentConversationMemoryAction[] = [];
        if (request.persistMemory !== false && message) {
            const scopeTags: string[] = [];
            if (queryResult.trace.scope?.workspaceId) {
                scopeTags.push(`scope_workspace:${queryResult.trace.scope.workspaceId}`);
            }
            if (queryResult.trace.scope?.corpusId) {
                scopeTags.push(`scope_corpus:${queryResult.trace.scope.corpusId}`);
            }
            const persistedMemory = await this.addConversationMemory({
                userId,
                namespace,
                content: `User focus: ${message}`,
                tags: ['agent_turn', 'user_focus', ...scopeTags],
                source: 'agent_conversation',
                confidence: 0.82,
                scopeWorkspaceId: queryResult.trace.scope?.workspaceId || null,
                scopeCorpusId: queryResult.trace.scope?.corpusId || null,
                now: generatedAt,
            });
            memoryActions.push({
                kind: 'persist_session_memory',
                status: persistedMemory.added === true ? 'applied' : 'skipped',
                layer: persistedMemory.layer || this.resolveConversationMemoryLayer(namespace),
                namespace,
                memoryId: typeof persistedMemory.memory?.memoryId === 'string' ? persistedMemory.memory.memoryId : undefined,
                reason: 'Persist the latest user focus to scoped conversation memory.',
            });
        }
        if (citations.length > 0) {
            memoryActions.push({
                kind: 'propose_long_term_memory',
                status: 'proposed',
                layer: 'long_term',
                namespace: 'project',
                reason: `Promote ${citations[0].title} to long-term project memory if the same scope is recalled repeatedly.`,
            });
        }

        const invocationId = this.nextId('agent_invocation');
        const traceScope = queryResult.trace.scope || {
            source: 'global',
            workspaceId: null,
            corpusId: null,
            documentIds: [],
            atomIds: [],
            sourcePathPrefixes: [],
            languages: [],
            matchedAtomCount: queryResult.items.length,
        };
        const graphExpansionPolicy = resolveGraphExpansionPolicy(message);
        const assembledConversation = await assembleAgentConversationGraphContext({
            message,
            usedScope: traceScope,
            knowledgePoints,
            store: this.store,
            budget: graphExpansionPolicy.enabled
                ? {
                    maxSupportNodes: 4,
                    maxConnectionPaths: 4,
                    maxPathDepth: graphExpansionPolicy.maxPathDepth,
                    maxPredecessors: 4,
                    maxSuccessors: 4,
                }
                : undefined,
        });
        const conversationKnowledgePoints = assembledConversation.knowledgePoints;
        const graphContext = assembledConversation.graphContext;
        const ragEvidenceProfile = resolveAgentRagEvidenceProfile(message, graphExpansionPolicy);
        const graphNeighborItems = this.buildRagGraphNeighborQueryItems(
            graphContext,
            conversationKnowledgePoints,
            generatedAt,
            message,
            ragEvidenceProfile.graphNeighborLimit,
            traceScope
        );
        const preRagGraphAnswerPlan = buildGraphAnswerPlan({
            message,
            knowledgePoints: conversationKnowledgePoints,
            graphContext,
        });
        const graphExpansionTrace: AgentConversationResponse['trace']['graphExpansion'] = {
            ...graphExpansionPolicy,
            executedSteps: graphExpansionPolicy.enabled && graphNeighborItems.length > 0 ? 1 : 0,
            selectedNeighborCount: graphExpansionPolicy.enabled ? graphNeighborItems.length : 0,
        };
        const firstReviewedRag = await this.assembleReviewedRagEvidenceContext({
            query: message || 'local knowledge',
            items: queryResult.items,
            graphNeighborItems,
            graphContext,
            graphAnswerPlan: preRagGraphAnswerPlan,
            generatedAt,
            budget: ragEvidenceProfile.budget,
            paragraphWindow: ragEvidenceProfile.paragraphWindow,
        });
        let ragContextPack = firstReviewedRag.ragContextPack;
        let ragSufficiencyReview = firstReviewedRag.ragSufficiencyReview;
        let ragRecovery: RagEvidenceRecoveryTrace | undefined;
        if (this.canRecoverRagEvidenceContext(ragContextPack, ragSufficiencyReview, graphContext)) {
            const recoveryGraphNeighborItems = this.buildRagGraphNeighborQueryItems(
                graphContext,
                conversationKnowledgePoints,
                generatedAt,
                message,
                AGENT_RAG_RECOVERY_GRAPH_NEIGHBOR_LIMIT,
                traceScope
            );
            const recoveredReviewedRag = await this.assembleReviewedRagEvidenceContext({
                query: message || 'local knowledge',
                items: queryResult.items,
                graphNeighborItems: recoveryGraphNeighborItems,
                graphContext,
                graphAnswerPlan: preRagGraphAnswerPlan,
                generatedAt,
                budget: AGENT_RAG_RECOVERY_CONTEXT_BUDGET,
                paragraphWindow: AGENT_RAG_RECOVERY_PARAGRAPH_WINDOW,
            });
            ragRecovery = this.buildRagEvidenceRecoveryTrace({
                beforePack: ragContextPack,
                beforeReview: ragSufficiencyReview,
                afterPack: recoveredReviewedRag.ragContextPack,
                afterReview: recoveredReviewedRag.ragSufficiencyReview,
            });
            const useRecoveredPack = this.shouldUseRecoveredRagEvidenceContext(
                ragSufficiencyReview,
                recoveredReviewedRag.ragSufficiencyReview
            );
            if (useRecoveredPack) {
                ragContextPack = recoveredReviewedRag.ragContextPack;
                ragSufficiencyReview = this.markRagReviewWithRecovery(
                    recoveredReviewedRag.ragSufficiencyReview,
                    ragRecovery,
                    true
                );
            } else {
                ragSufficiencyReview = this.markRagReviewWithRecovery(
                    ragSufficiencyReview,
                    ragRecovery,
                    false
                );
            }
        }
        const activeConversationAtomIds = collectAgentConversationAtomIds(conversationKnowledgePoints);
        const scopedWorkspace = this.resolveWorkspaceContextForAtomIds(activeConversationAtomIds);
        const effectiveWorkspaceId = traceScope.workspaceId || scopedWorkspace.workspaceId;
        const effectiveCorpusId = traceScope.corpusId || scopedWorkspace.corpusId;
        const reply = buildScopedConversationReply({
            message,
            knowledgePoints: conversationKnowledgePoints,
            citations,
            recalledMemories,
            memoryActions,
            usedScope: traceScope,
            generatedAt,
            nextBlockId: () => this.nextId('assistant_block'),
            nextRunId: () => this.nextId('knowledge_run'),
            graphContext,
            ragContextPack,
            ragSufficiencyReview,
        });
        const ragFailureClassifications = this.buildRagFailureClassifications({
            pack: ragContextPack,
            review: ragSufficiencyReview,
            recovery: ragRecovery,
            graphContext,
            answerReleaseReview: reply.answerReleaseReview,
        });
        const answerClaimCitations = this.buildAnswerClaimCitations({
            answer: reply.answer,
            pack: ragContextPack,
            invocationId,
        });
        const response: AgentConversationResponse = {
            userId,
            sessionId,
            assistantMessage: reply.answer,
            answer: reply.answer,
            answerReleaseReview: reply.answerReleaseReview,
            graphAnswerPlan: reply.graphAnswerPlan,
            graphAnswerCoverage: reply.graphAnswerCoverage,
            assistantBlocks: reply.assistantBlocks,
            knowledgeRun: reply.knowledgeRun,
            knowledgePoints: conversationKnowledgePoints,
            citations,
            recalledMemories,
            memoryActions,
            summary: {
                generatedAt,
                topK,
                returnedKnowledgePoints: conversationKnowledgePoints.length,
                returnedCitations: citations.length,
                recalledMemoryCount: recalledMemories.length,
                appliedMemoryCount: memoryActions.filter((action) => action.status === 'applied').length,
                queryEvidenceCoverageRatioPct: Number(
                    (Number(queryResult.trace?.evidenceCoverageRatio || 0) * 100).toFixed(2)
                ),
            },
            trace: {
                sessionId,
                invocationId,
                retrieval: queryResult.trace,
                recalledMemoryCount: recalledMemories.length,
                appliedMemoryCount: memoryActions.filter((action) => action.status === 'applied').length,
                usedScope: traceScope,
                workspaceReadiness: traceScope.readiness,
                missDiagnostics: traceScope.missDiagnostics,
                planner: {
                    plannerQuery: queryResult.trace.planner?.plannerQuery || null,
                    titleLikeQueries: queryResult.trace.planner?.titleLikeQueries || [],
                    titleHitDocumentIds: queryResult.trace.planner?.titleHitDocumentIds || [],
                },
                graphContext: graphContext || reply.graphContext || undefined,
                ragContextPack,
                ragSufficiencyReview,
                ragRecovery,
                ragFailureClassifications,
                answerClaimCitations,
                answerReleaseReview: reply.answerReleaseReview,
                graphAnswerPlan: reply.graphAnswerPlan,
                graphAnswerCoverage: reply.graphAnswerCoverage,
                graphExpansion: graphExpansionTrace,
            },
        };
        const knowledgeRunArtifact = this.recordWorkflowArtifact({
            kind: 'knowledge_run',
            sessionId,
            userId,
            workspaceId: effectiveWorkspaceId,
            corpusId: effectiveCorpusId,
            title: `Knowledge run: ${String(message || 'local knowledge').slice(0, 64)}`,
            sourceAtomIds: activeConversationAtomIds,
            summary: `Generated ${reply.knowledgeRun.summary.claimCount} evidence claim(s) and ${reply.knowledgeRun.summary.reviewCardCount} review card(s) with status ${reply.knowledgeRun.status}.`,
            payload: {
                knowledgeRun: reply.knowledgeRun,
                graphContext: graphContext || reply.graphContext || undefined,
                ragContextPack,
                ragSufficiencyReview,
                ragRecovery,
                ragFailureClassifications,
                answerClaimCitations,
                answerReleaseReview: reply.answerReleaseReview,
                graphAnswerPlan: reply.graphAnswerPlan,
                graphAnswerCoverage: reply.graphAnswerCoverage,
                graphExpansion: graphExpansionTrace,
                citations,
                recalledMemories,
                memoryActions,
            },
            recordedAt: generatedAt,
        });
        response.assistantBlocks = this.attachKnowledgeRunArtifactIdToBlocks(
            response.assistantBlocks,
            knowledgeRunArtifact.artifactId
        );
        this.upsertConversationSessionState({
            sessionId,
            userId,
            mode: 'grounded_conversation',
            workspaceId: effectiveWorkspaceId,
            corpusId: effectiveCorpusId,
            activeResourceIds: this.resolveSourceResourceIdsForAtomIds(activeConversationAtomIds),
            activeProjectionIds: this.resolveSourceProjectionIdsForAtomIds(activeConversationAtomIds),
            topK,
            queryBackend: String(request.scope && queryResult.trace.modeWeights.vector ? 'local_vector' : '').trim() || null,
            persistMemory: request.persistMemory !== false,
            memoryNamespace: namespace,
            exportProfileId: effectiveWorkspaceId
                ? this.workspaceRegistry.listActiveWorkspaces().find((workspace) => workspace.workspaceId === effectiveWorkspaceId)?.exportProfileId || null
                : scopedWorkspace.exportProfileId,
            panelState: {
                lastGroundedAnswerAt: generatedAt,
                returnedKnowledgePoints: knowledgePoints.length,
                returnedCitations: citations.length,
            },
            recordedAt: generatedAt,
        });
        this.recordAgentConversationTurn({
            sessionId,
            userId,
            request: {
                ...request,
                userId,
                sessionId,
                message,
                topK,
                asOf: generatedAt,
                memoryNamespace: namespace,
            },
            response,
        });
        if (reply.knowledgeRun.reviewCards.length > 0) {
            this.recordWorkflowArtifact({
                kind: 'flashcard_batch',
                sessionId,
                userId,
                workspaceId: effectiveWorkspaceId,
                corpusId: effectiveCorpusId,
                title: `Knowledge run review cards: ${String(message || 'local knowledge').slice(0, 64)}`,
                sourceAtomIds: activeConversationAtomIds,
                summary: `Prepared ${reply.knowledgeRun.reviewCards.length} review card(s) from ${reply.knowledgeRun.summary.verifiedClaimCount + reply.knowledgeRun.summary.weakClaimCount} evidenced claim(s).`,
                payload: {
                    runId: reply.knowledgeRun.runId,
                    reviewCards: reply.knowledgeRun.reviewCards,
                    evidenceClaims: reply.knowledgeRun.evidenceClaims,
                    reviewState: reply.knowledgeRun.reviewState,
                },
                recordedAt: generatedAt,
            });
        }
        this.recordWorkflowArtifact({
            kind: 'research_report',
            sessionId,
            userId,
            workspaceId: effectiveWorkspaceId,
            corpusId: effectiveCorpusId,
            title: `Grounded conversation: ${String(message || 'local knowledge').slice(0, 64)}`,
            sourceAtomIds: knowledgePoints.map((point) => point.atomId),
            summary: reply.answer,
            payload: {
                citations,
                recalledMemories,
                memoryActions,
                knowledgeRun: reply.knowledgeRun,
            },
            recordedAt: generatedAt,
        });
        await this.persistIfNeeded();
        return response;
    }

    public async streamAgentConversation(request: AgentConversationRequest = {}): Promise<AsyncGenerator<any, void, void>> {
        const result = await this.agentConversation(request);
        const turnId = this.nextId('turn');
        const emittedAt = this.nowProvider().toISOString();
        return (async function* stream(): AsyncGenerator<any, void, void> {
            yield {
                type: 'turn_completed',
                turnId,
                emittedAt,
                result,
            };
        }());
    }

    public async queryMasteryDiagnostics(request: MasteryDiagnosticsRequest): Promise<MasteryDiagnosticsResponse> {
        return this.diagnoseMastery(request);
    }

    public async generateLearningPath(request: LearningPathRequest): Promise<LearningPathResponse> {
        return this.buildLearningPath(request);
    }

    public async evaluateIngestGuardrail(
        request: IngestGuardrailEvaluationRequest
    ): Promise<IngestGuardrailEvaluationResponse> {
        return this.evaluateIngestGuardrails(request);
    }

    public getAgentConversationTurnCacheDiagnostics(_request: { format?: string } = {}): any {
        return {
            generatedAt: this.nowProvider().toISOString(),
            config: {
                historyLimit: 24,
                sampleMinIntervalMs: 1000,
            },
            state: {
                cachedTurns: 0,
                runningTurns: 0,
            },
            counters: {
                conflictCount: 0,
                executionFailureCount: 0,
                staleEligibleEntries: 0,
                totalEntries: 0,
            },
            alerts: {
                summaryStatus: 'pass',
                checks: [],
            },
        };
    }

    public getAgentConversationTurnCacheTrend(_request: {
        limit?: number;
        windowSize?: number;
        minSamples?: number;
    } = {}): any {
        return {
            generatedAt: this.nowProvider().toISOString(),
            config: {
                historyLimit: Number(_request.limit || 24),
                sampleMinIntervalMs: 1000,
                windowSize: Number(_request.windowSize || 12),
                minSamples: Number(_request.minSamples || 6),
            },
            summary: {
                returnedRecords: 0,
                totalRecords: 0,
                statusPassCount: 0,
                statusWarnCount: 0,
                statusFailCount: 0,
                activeWarnStreak: 0,
                activeFailStreak: 0,
                trendStatus: 'insufficient_data',
                recommendedEscalation: 'normal',
                reason: 'insufficient_data',
                latestSampledAt: '',
            },
            latest: {
                summaryStatus: 'pass',
                topCheckSeverity: 'pass',
            },
            storage: {
                filePath: '',
                schemaVersion: 1,
                totalRecords: 0,
            },
        };
    }

    public async getRuntimeCapabilityMatrix(): Promise<any> {
        return {
            generatedAt: this.nowProvider().toISOString(),
            modules: (await this.getFoundationReadiness()).modules,
        };
    }

    public async getRuntimeCapabilityRunbook(): Promise<any> {
        return {
            generatedAt: this.nowProvider().toISOString(),
            checks: [],
            summary: {
                totalChecks: 0,
            },
        };
    }

    public async verifyRuntimeCapabilityRunbook(_request: { limit?: number } = {}): Promise<any> {
        return {
            generatedAt: this.nowProvider().toISOString(),
            selectedCheckId: '',
            selectedCheckStatus: 'unknown',
            selectedCheckEscalation: 'normal',
            selectedCheckPriorityScore: 0,
            selectedCheckMessage: 'No verification history available yet.',
            verificationTargets: [],
            selectedCheckEscalationActions: [],
            traceSummary: {
                returnedRecords: 0,
                errorRequests: 0,
                errorRatioPct: 0,
                p95DurationMs: 0,
            },
            selectedCheckHistory: {
                returnedRecords: 0,
                activeRiskStreak: 0,
                activeFailStreak: 0,
                trendStatus: 'insufficient_data',
            },
            selectedCheckRemediation: {
                riskRatioPct: 0,
            },
        };
    }

    public async getRuntimeCapabilityRunbookHistory(_request: {
        limit?: number;
        checkId?: string;
        sinceMinutes?: number;
        status?: string;
    } = {}): Promise<any> {
        return {
            summary: {
                totalRecords: 0,
                matchedRecords: 0,
                returnedRecords: 0,
                checkId: String(_request.checkId || ''),
                sinceMinutes: Number(_request.sinceMinutes || 0),
                status: String(_request.status || ''),
                statusCounts: {
                    pass: 0,
                    warn: 0,
                    fail: 0,
                    unknown: 0,
                },
                activeRiskStreak: 0,
                activeFailStreak: 0,
                averageErrorRatioPct: 0,
                averageP95DurationMs: 0,
                trendStatus: 'insufficient_data',
                trendWindowSize: 0,
                severityDelta: 0,
                errorRatioDeltaPct: 0,
                p95DurationDeltaMs: 0,
                latestVerifiedAt: '',
            },
            records: [],
        };
    }

    public async queryRuntimeCapabilityRunbookChecks(_request: {
        limit?: number;
        sinceMinutes?: number;
        status?: string;
        checkQuery?: string;
    } = {}): Promise<any> {
        return {
            summary: {
                totalRecords: 0,
                matchedRecords: 0,
                returnedChecks: 0,
                sinceMinutes: Number(_request.sinceMinutes || 0),
                status: String(_request.status || ''),
                checkQuery: String(_request.checkQuery || ''),
                regressingChecks: 0,
                improvingChecks: 0,
                stableChecks: 0,
                insufficientDataChecks: 0,
                recommendedFocusCheckId: '',
                recommendedFocusEscalation: '',
                recommendedFocusReason: '',
                recommendedFocusTopAction: '',
                actionQueueTotal: 0,
                actionQueueP0: 0,
                actionQueueP1: 0,
                actionQueueP2: 0,
                remediationRiskRatioPct: 0,
                remediationLatestRecordedAt: '',
            },
            checks: [],
        };
    }

    public async queryRuntimeCapabilityRunbookActionQueue(_request: {
        limit?: number;
        sinceMinutes?: number;
        status?: string;
        checkQuery?: string;
        queueLimit?: number;
        priority?: string;
        category?: string;
        checkId?: string;
        remediationStatus?: string;
        remediationTrend?: string;
    } = {}): Promise<any> {
        return {
            summary: {
                totalRecords: 0,
                matchedRecords: 0,
                returnedChecks: 0,
                sinceMinutes: Number(_request.sinceMinutes || 0),
                status: String(_request.status || ''),
                checkQuery: String(_request.checkQuery || ''),
                queueLimit: Number(_request.queueLimit || _request.limit || 0),
                priorityFilter: String(_request.priority || 'all'),
                categoryFilter: String(_request.category || 'all'),
                checkIdFilter: String(_request.checkId || ''),
                remediationStatusFilter: String(_request.remediationStatus || 'all'),
                remediationTrendFilter: String(_request.remediationTrend || 'all'),
                totalQueueItems: 0,
                filteredQueueItems: 0,
                returnedQueueItems: 0,
                queueP0: 0,
                queueP1: 0,
                queueP2: 0,
                remediationRiskQueueItems: 0,
                remediationRegressingQueueItems: 0,
                remediationAverageRiskRatioPct: 0,
                remediationTopRiskCheckId: '',
                recommendedFocusCheckId: '',
                recommendedFocusEscalation: '',
                generatedAt: this.nowProvider().toISOString(),
            },
            actionQueue: [],
        };
    }

    public async getRuntimeCapabilityRunbookRemediationHistory(_request: { limit?: number } = {}): Promise<any> {
        return {
            summary: {
                totalRecords: 0,
                returnedRecords: 0,
            },
            records: [],
        };
    }

    public async getRuntimeCapabilityRunbookReplaySchedule(): Promise<any> {
        return {
            updatedAt: this.nowProvider().toISOString(),
            enabled: false,
            intervalMinutes: 0,
        };
    }

    public async recordRuntimeCapabilityRemediationEvent(_request: Record<string, unknown> = {}): Promise<any> {
        return {
            recorded: true,
            recordedAt: this.nowProvider().toISOString(),
        };
    }

    public async replayRuntimeCapabilityRemediationEvent(_request: Record<string, unknown> = {}): Promise<any> {
        return {
            replayed: true,
            replayedAt: this.nowProvider().toISOString(),
        };
    }

    public async updateRuntimeCapabilityReplaySchedule(_request: Record<string, unknown> = {}): Promise<any> {
        return {
            updated: true,
            updatedAt: this.nowProvider().toISOString(),
        };
    }

    public async tickRuntimeCapabilityReplaySchedule(): Promise<any> {
        return {
            ticked: true,
            tickedAt: this.nowProvider().toISOString(),
        };
    }

    // ── M8-M10 stubs (pending full implementation) ──

    public async getTutorAdapterCatalog(): Promise<any> {
        await this.ensureHydrated();
        const adapters = this.listConfiguredTutorAdapters().map((adapter, index) => ({
            adapterId: adapter.id,
            mode: adapter.mode,
            configured: true,
            active: this.tutorAdapter ? adapter.id === this.tutorAdapter.id : index === 0,
            selectedByDefault: this.tutorAdapter ? adapter.id === this.tutorAdapter.id : index === 0,
        }));
        return {
            summary: {
                totalAdapters: adapters.length,
                activeAdapters: adapters.filter((adapter) => adapter.active).length,
                defaultAdapterId: adapters.find((adapter) => adapter.selectedByDefault)?.adapterId || null,
            },
            adapters,
        };
    }

    public async getTutorAdapterTelemetry(): Promise<any> {
        await this.ensureHydrated();
        const configuredAdapters = this.listConfiguredTutorAdapters();
        const llmTraces = this.filterTutorTraces({ source: 'llm-adapter' });
        const adapterStats = new Map<string, {
            adapterId: string;
            mode: string;
            totalRequests: number;
            successfulResponses: number;
            acceptedResponses: number;
            downgradedResponses: number;
            failedResponses: number;
            providerFallbackResponses: number;
            averageConfidenceAccumulator: number;
            averageProviderAttemptAccumulator: number;
            lastSeenAt: string;
            lastError: string;
        }>();

        configuredAdapters.forEach((adapter) => {
            adapterStats.set(adapter.id, {
                adapterId: adapter.id,
                mode: adapter.mode,
                totalRequests: 0,
                successfulResponses: 0,
                acceptedResponses: 0,
                downgradedResponses: 0,
                failedResponses: 0,
                providerFallbackResponses: 0,
                averageConfidenceAccumulator: 0,
                averageProviderAttemptAccumulator: 0,
                lastSeenAt: '',
                lastError: '',
            });
        });

        llmTraces.forEach((trace) => {
            const adapterId = String(trace.adapterId || trace.providerName || 'llm-adapter').trim() || 'llm-adapter';
            if (!adapterStats.has(adapterId)) {
                adapterStats.set(adapterId, {
                    adapterId,
                    mode: String(trace.providerMode || 'unknown').trim() || 'unknown',
                    totalRequests: 0,
                    successfulResponses: 0,
                    acceptedResponses: 0,
                    downgradedResponses: 0,
                    failedResponses: 0,
                    providerFallbackResponses: 0,
                    averageConfidenceAccumulator: 0,
                    averageProviderAttemptAccumulator: 0,
                    lastSeenAt: '',
                    lastError: '',
                });
            }
            const current = adapterStats.get(adapterId) as {
                adapterId: string;
                mode: string;
                totalRequests: number;
                successfulResponses: number;
                acceptedResponses: number;
                downgradedResponses: number;
                failedResponses: number;
                providerFallbackResponses: number;
                averageConfidenceAccumulator: number;
                averageProviderAttemptAccumulator: number;
                lastSeenAt: string;
                lastError: string;
            };
            current.totalRequests += 1;
            current.averageConfidenceAccumulator += clamp(Number(trace.confidence || 0), 0, 1);
            current.averageProviderAttemptAccumulator += Math.max(1, Math.floor(Number(trace.providerAttemptCount || 1)));
            if (trace.failed === true || trace.verificationStatus === 'failed') {
                current.failedResponses += 1;
                current.lastError = String(trace.errorMessage || current.lastError || '').trim();
            } else {
                current.successfulResponses += 1;
            }
            if (trace.verificationStatus === 'verified' && trace.fallbackUsed !== true) {
                current.acceptedResponses += 1;
            }
            if (trace.fallbackUsed === true && trace.verificationStatus !== 'failed') {
                current.downgradedResponses += 1;
            }
            if (trace.fallbackUsed === true) {
                current.providerFallbackResponses += 1;
            }
            if (!current.lastSeenAt || trace.createdAt > current.lastSeenAt) {
                current.lastSeenAt = trace.createdAt;
            }
        });

        const adapters = Array.from(adapterStats.values())
            .map((item) => ({
                adapterId: item.adapterId,
                mode: item.mode,
                totalRequests: item.totalRequests,
                successfulResponses: item.successfulResponses,
                acceptedResponses: item.acceptedResponses,
                downgradedResponses: item.downgradedResponses,
                failedResponses: item.failedResponses,
                providerFallbackResponses: item.providerFallbackResponses,
                providerFallbackRatioPct: Number(
                    clamp((item.providerFallbackResponses / Math.max(1, item.totalRequests)) * 100, 0, 100).toFixed(4)
                ),
                averageConfidence: item.totalRequests > 0
                    ? Number((item.averageConfidenceAccumulator / item.totalRequests).toFixed(4))
                    : 0,
                averageProviderAttemptCount: item.totalRequests > 0
                    ? Number((item.averageProviderAttemptAccumulator / item.totalRequests).toFixed(4))
                    : 0,
                lastSeenAt: item.lastSeenAt || null,
                lastError: item.lastError || '',
            }))
            .sort((left, right) => {
                if (right.totalRequests !== left.totalRequests) {
                    return right.totalRequests - left.totalRequests;
                }
                return String(left.adapterId || '').localeCompare(String(right.adapterId || ''));
            });
        const totalRequests = llmTraces.length;
        const providerFallbackResponses = llmTraces.filter((trace) => trace.fallbackUsed === true).length;
        const averageConfidence = totalRequests > 0
            ? Number((
                llmTraces.reduce((sum, trace) => sum + clamp(Number(trace.confidence || 0), 0, 1), 0)
                / totalRequests
            ).toFixed(4))
            : 0;
        const averageProviderAttemptCount = totalRequests > 0
            ? Number((
                llmTraces.reduce((sum, trace) => sum + Math.max(1, Math.floor(Number(trace.providerAttemptCount || 1))), 0)
                / totalRequests
            ).toFixed(4))
            : 0;
        const preferredMode = String(
            this.studySessionOrchestrationTutorRoutingConfig.preferredMode
            || configuredAdapters[0]?.mode
            || this.tutorAdapter?.mode
            || 'local'
        ).trim() || 'local';
        const lastTrace = llmTraces[0] || null;
        return {
            summary: {
                totalAdapters: adapters.length,
                activeAdapters: adapters.filter((adapter) => adapter.totalRequests > 0 || adapter.mode !== 'unknown').length,
                totalRequests,
                successfulResponses: llmTraces.filter((trace) => trace.failed !== true && trace.verificationStatus !== 'failed').length,
                acceptedResponses: llmTraces.filter((trace) => trace.verificationStatus === 'verified' && trace.fallbackUsed !== true).length,
                downgradedResponses: llmTraces.filter((trace) => trace.fallbackUsed === true && trace.verificationStatus !== 'failed').length,
                failedResponses: llmTraces.filter((trace) => trace.failed === true || trace.verificationStatus === 'failed').length,
                providerFallbackResponses,
                providerFallbackRatioPct: Number(clamp((providerFallbackResponses / Math.max(1, totalRequests)) * 100, 0, 100).toFixed(4)),
                averageProviderAttemptCount,
                averageConfidence,
                lastRoutingStrategy: configuredAdapters.length > 1 ? 'multi_adapter_catalog' : 'single_adapter_catalog',
                lastRoutingReason: lastTrace
                    ? String(lastTrace.notes || '').trim()
                    : (configuredAdapters.length > 0 ? 'Tutor adapter catalog is configured but no llm-adapter trace has run yet.' : 'No tutor adapter is configured.'),
                lastRoutingScore: lastTrace ? Number(clamp(Number(lastTrace.confidence || 0), 0, 1).toFixed(4)) : averageConfidence,
                lastRoutingDynamicPreferredMode: preferredMode,
                lastRoutingDynamicModeReason: String(
                    this.studySessionOrchestrationTutorRoutingConfig.enabled === true
                        ? 'runtime_tutor_routing_config_enabled'
                        : 'runtime_tutor_routing_config_default'
                ),
            },
            adapters,
        };
    }

    public async queryTutorTraceDiagnostics(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 20), 1, 200);
        const matchedTraces = this.filterTutorTraces(request);
        const records = matchedTraces.slice(0, limit).map((trace) => ({ ...trace }));
        const providerBreakdownMap = new Map<string, TutorTrace[]>();
        matchedTraces.forEach((trace) => {
            const providerKey = String(trace.providerName || trace.adapterId || trace.source || 'unknown').trim() || 'unknown';
            if (!providerBreakdownMap.has(providerKey)) {
                providerBreakdownMap.set(providerKey, []);
            }
            providerBreakdownMap.get(providerKey)?.push(trace);
        });
        const providerBreakdown = Array.from(providerBreakdownMap.entries())
            .map(([providerName, traces]) => {
                const metrics = this.summarizeTutorTraceMetrics(traces);
                return {
                    providerName,
                    traces: traces.length,
                    fallbackTraces: metrics.fallbackTraces,
                    failedTraces: metrics.failedTraces,
                    averageConfidence: metrics.averageConfidence,
                    averageProviderAttemptCount: metrics.averageProviderAttemptCount,
                    lastSeenAt: metrics.latestSeenAt || null,
                };
            })
            .sort((left, right) => {
                if (right.traces !== left.traces) {
                    return right.traces - left.traces;
                }
                return String(right.lastSeenAt || '').localeCompare(String(left.lastSeenAt || ''));
            });
        const aggregateMetrics = this.summarizeTutorTraceMetrics(matchedTraces);
        return {
            filters: {
                userId: String(request.userId || '').trim() || null,
                source: String(request.source || '').trim() || null,
                actionKind: String(request.actionKind || '').trim() || null,
                providerName: String(request.providerName || '').trim() || null,
                providerMode: String(request.providerMode || '').trim() || null,
                fallbackUsed: typeof request.fallbackUsed === 'boolean' ? request.fallbackUsed : null,
                limit,
            },
            summary: {
                matchedTraces: matchedTraces.length,
                returnedTraces: records.length,
                llmAdapterTraces: matchedTraces.filter((trace) => trace.source === 'llm-adapter').length,
                ruleEngineTraces: matchedTraces.filter((trace) => trace.source === 'rule-engine').length,
                verifiedTraces: aggregateMetrics.verifiedTraces,
                pendingVerificationTraces: aggregateMetrics.pendingTraces,
                fallbackTraces: aggregateMetrics.fallbackTraces,
                fallbackRatioPct: aggregateMetrics.fallbackRatioPct,
                averageProviderAttemptCount: aggregateMetrics.averageProviderAttemptCount,
                latestCreatedAt: aggregateMetrics.latestSeenAt || null,
            },
            providerBreakdown,
            records,
        };
    }

    public async queryTutorProviderTrendDiagnostics(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 12), 1, 100);
        const windowSize = clamp(Math.floor(Number(request.windowSize) || 6), 1, 50);
        const minSamples = clamp(Math.floor(Number(request.minSamples) || 3), 1, 50);
        const matchedTraces = this.filterTutorTraces(request);
        const providerMap = new Map<string, TutorTrace[]>();
        matchedTraces.forEach((trace) => {
            const providerKey = String(trace.providerName || trace.adapterId || trace.source || 'unknown').trim() || 'unknown';
            if (!providerMap.has(providerKey)) {
                providerMap.set(providerKey, []);
            }
            providerMap.get(providerKey)?.push(trace);
        });

        const providers = Array.from(providerMap.entries())
            .map(([providerName, traces]) => {
                const currentWindow = traces.slice(0, windowSize);
                const previousWindow = traces.slice(windowSize, windowSize * 2);
                const currentMetrics = this.summarizeTutorTraceMetrics(currentWindow);
                const previousMetrics = previousWindow.length > 0
                    ? this.summarizeTutorTraceMetrics(previousWindow)
                    : null;
                const assessment = this.assessTutorProviderTrend(currentMetrics, previousMetrics, minSamples);
                return {
                    providerName,
                    trendStatus: assessment.trendStatus,
                    trendScore: assessment.trendScore,
                    trendConfidence: assessment.trendConfidence,
                    fallbackRatioPct: currentMetrics.fallbackRatioPct,
                    failedRatioPct: currentMetrics.failedRatioPct,
                    averageConfidence: currentMetrics.averageConfidence,
                    deltas: assessment.deltas,
                    reason: assessment.reason,
                    latestSeenAt: currentMetrics.latestSeenAt || null,
                };
            })
            .sort((left, right) => {
                const statusOrder = {
                    regressing: 0,
                    insufficient_data: 1,
                    stable: 2,
                    improving: 3,
                } as Record<string, number>;
                const leftOrder = statusOrder[left.trendStatus] ?? 9;
                const rightOrder = statusOrder[right.trendStatus] ?? 9;
                if (leftOrder !== rightOrder) {
                    return leftOrder - rightOrder;
                }
                if (left.trendScore !== right.trendScore) {
                    return left.trendScore - right.trendScore;
                }
                return String(right.latestSeenAt || '').localeCompare(String(left.latestSeenAt || ''));
            });
        const selectedProviders = providers.slice(0, limit);
        const recommendedFocus = selectedProviders.find((provider) => provider.trendStatus === 'regressing')
            || selectedProviders.find((provider) => provider.trendStatus === 'insufficient_data')
            || selectedProviders[0]
            || null;
        return {
            filters: {
                userId: String(request.userId || '').trim() || null,
                source: String(request.source || '').trim() || null,
                limit,
                windowSize,
                minSamples,
            },
            summary: {
                totalProviders: providers.length,
                evaluatedProviders: providers.filter((provider) => provider.trendStatus !== 'insufficient_data').length,
                returnedProviders: selectedProviders.length,
                regressingProviders: selectedProviders.filter((provider) => provider.trendStatus === 'regressing').length,
                stableProviders: selectedProviders.filter((provider) => provider.trendStatus === 'stable').length,
                improvingProviders: selectedProviders.filter((provider) => provider.trendStatus === 'improving').length,
                insufficientDataProviders: selectedProviders.filter((provider) => provider.trendStatus === 'insufficient_data').length,
                recommendedFocusProviderName: recommendedFocus?.providerName || null,
                recommendedFocusReason: recommendedFocus?.reason || null,
            },
            providers: selectedProviders,
        };
    }

    public async queryTutorProviderTrendHistory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 24), 1, 200);
        const windowSize = clamp(Math.floor(Number(request.windowSize) || 6), 1, 50);
        const minSamples = clamp(Math.floor(Number(request.minSamples) || 3), 1, 50);
        const matchedTraces = this.filterTutorTraces(request);
        const providerMap = new Map<string, TutorTrace[]>();
        matchedTraces.forEach((trace) => {
            const providerKey = String(trace.providerName || trace.adapterId || trace.source || 'unknown').trim() || 'unknown';
            if (!providerMap.has(providerKey)) {
                providerMap.set(providerKey, []);
            }
            providerMap.get(providerKey)?.push(trace);
        });

        const records = Array.from(providerMap.entries()).flatMap(([providerName, traces]) => {
            const windows: Array<Record<string, unknown>> = [];
            for (let windowIndex = 0; windowIndex * windowSize < traces.length; windowIndex += 1) {
                const start = windowIndex * windowSize;
                const currentWindow = traces.slice(start, start + windowSize);
                if (currentWindow.length <= 0) {
                    continue;
                }
                const previousWindow = traces.slice(start + windowSize, start + windowSize * 2);
                const currentMetrics = this.summarizeTutorTraceMetrics(currentWindow);
                const previousMetrics = previousWindow.length > 0
                    ? this.summarizeTutorTraceMetrics(previousWindow)
                    : null;
                const assessment = this.assessTutorProviderTrend(currentMetrics, previousMetrics, minSamples);
                windows.push({
                    providerName,
                    windowIndex,
                    sampleCount: currentMetrics.sampleCount,
                    trendStatus: assessment.trendStatus,
                    trendScore: assessment.trendScore,
                    trendConfidence: assessment.trendConfidence,
                    windowStartAt: currentWindow[currentWindow.length - 1]?.createdAt || null,
                    windowEndAt: currentWindow[0]?.createdAt || null,
                    fallbackRatioPct: currentMetrics.fallbackRatioPct,
                    failedRatioPct: currentMetrics.failedRatioPct,
                    averageConfidence: currentMetrics.averageConfidence,
                    deltas: assessment.deltas,
                    reason: assessment.reason,
                });
            }
            return windows;
        }).sort((left, right) => {
            const byDate = String(right.windowEndAt || '').localeCompare(String(left.windowEndAt || ''));
            if (byDate !== 0) {
                return byDate;
            }
            const byWindow = Number(left.windowIndex || 0) - Number(right.windowIndex || 0);
            if (byWindow !== 0) {
                return byWindow;
            }
            return String(left.providerName || '').localeCompare(String(right.providerName || ''));
        });
        const selectedRecords = records.slice(0, limit);
        const recommendedFocus = selectedRecords.find((record) => record.trendStatus === 'regressing')
            || selectedRecords.find((record) => record.trendStatus === 'insufficient_data')
            || selectedRecords[0]
            || null;
        return {
            filters: {
                userId: String(request.userId || '').trim() || null,
                source: String(request.source || '').trim() || null,
                limit,
                windowSize,
                minSamples,
            },
            summary: {
                totalProviders: providerMap.size,
                evaluatedProviders: Array.from(providerMap.values()).filter((traces) => traces.length >= minSamples).length,
                totalRecords: records.length,
                returnedRecords: selectedRecords.length,
                regressingRecords: selectedRecords.filter((record) => record.trendStatus === 'regressing').length,
                stableRecords: selectedRecords.filter((record) => record.trendStatus === 'stable').length,
                improvingRecords: selectedRecords.filter((record) => record.trendStatus === 'improving').length,
                insufficientDataRecords: selectedRecords.filter((record) => record.trendStatus === 'insufficient_data').length,
                latestWindowEndAt: selectedRecords[0]?.windowEndAt || null,
                oldestWindowEndAt: selectedRecords[selectedRecords.length - 1]?.windowStartAt || null,
                recommendedFocusProviderName: recommendedFocus?.providerName || null,
            },
            records: selectedRecords,
        };
    }
    public async runAgentConversation(_r: any): Promise<any> { return this.agentConversation(_r); }
    public async addConversationMemory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('ConversationMemory add requires a non-empty userId.');
        }
        const content = String(request.content || '').trim();
        if (!content) {
            throw new Error('ConversationMemory add requires non-empty content.');
        }
        const namespace = this.normalizeConversationMemoryNamespace(request.namespace);
        const layer = this.resolveConversationMemoryLayer(namespace);
        const nowIso = this.resolveTimestamp(request.now);
        const bank = this.ensureUserMemoryBank(userId);
        const references = Array.isArray(request.references)
            ? request.references.map((reference: unknown) => String(reference || '').trim()).filter(Boolean)
            : [];
        let tags = Array.isArray(request.tags)
            ? request.tags.map((tag: unknown) => String(tag || '').trim()).filter(Boolean)
            : [];
        tags = this.upsertConversationMemoryInternalTag(tags, 'memory_domain:', 'conversation');
        tags = this.upsertConversationMemoryInternalTag(tags, 'namespace:', namespace);
        tags = this.upsertConversationMemoryInternalTag(
            tags,
            'source:',
            String(request.source || 'manual').trim() || 'manual'
        );
        const entry = this.buildGovernedMemoryEntry({
            entry: {
                key: String(request.memoryId || '').trim() || this.nextId('conv_memory'),
                value: content,
                tags,
                confidence: clamp(Number(request.confidence ?? 0.72), 0, 1),
                references,
                createdAt: nowIso,
                updatedAt: nowIso,
                expiresAt: this.resolveOptionalTimestamp(request.expiresAt) || undefined,
                scopeWorkspaceId: this.normalizeMemoryScopeValue(request.scopeWorkspaceId),
                scopeCorpusId: this.normalizeMemoryScopeValue(request.scopeCorpusId),
            },
        });
        bank[layer].push(entry);
        const eviction = this.evictMemoryLayerDetailed(bank, layer, nowIso);
        this.appendMemoryAuditRecord({
            userId,
            operation: 'write',
            layer,
            entry,
            reason: 'conversation_memory:add',
            recordedAt: nowIso,
        });
        eviction.evictedEntries.forEach((evictedEntry) => {
            this.appendMemoryAuditRecord({
                userId,
                operation: 'evict',
                layer,
                entry: evictedEntry,
                reason: 'conversation_memory:add:capacity_or_expiry',
                recordedAt: nowIso,
            });
        });
        await this.persistIfNeeded();
        return {
            added: true,
            namespace,
            layer,
            evictedCount: eviction.evictedCount,
            memory: this.buildConversationMemoryRecord(entry, layer),
            stats: this.collectMemoryStats(),
        };
    }

    public async listConversationMemory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('ConversationMemory list requires a non-empty userId.');
        }
        const namespace = request.namespace
            ? this.normalizeConversationMemoryNamespace(request.namespace)
            : undefined;
        const limit = clamp(Math.floor(Number(request.limit) || 20), 1, 200);
        const nowIso = this.resolveTimestamp(request.now);
        const nowTime = Date.parse(nowIso);
        const matchedEntries = this.collectConversationMemoryEntries(userId, namespace)
            .filter(({ entry }) => {
                const expiresAt = this.resolveOptionalTimestamp(entry.expiresAt);
                return !expiresAt || Date.parse(expiresAt) > nowTime;
            });
        const entries = matchedEntries
            .slice(0, limit)
            .map(({ layer, entry }) => this.buildConversationMemoryRecord(entry, layer));
        return {
            namespace: namespace || null,
            summary: {
                matchedEntries: matchedEntries.length,
                returnedEntries: entries.length,
            },
            entries,
        };
    }

    public async searchConversationMemory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('ConversationMemory search requires a non-empty userId.');
        }
        const namespace = request.namespace
            ? this.normalizeConversationMemoryNamespace(request.namespace)
            : undefined;
        const limit = clamp(Math.floor(Number(request.limit) || 6), 1, 100);
        const query = String(request.query || '').trim();
        const queryLabel = query || 'memory';
        const queryTokens = tokenize(queryLabel);
        const requiredTokenHits = queryTokens.length <= 1
            ? queryTokens.length
            : Math.max(1, Math.ceil(queryTokens.length * 0.5));
        const nowIso = this.resolveTimestamp(request.now);
        const nowTime = Date.parse(nowIso);
        const matchedEntries = this.collectConversationMemoryEntries(userId, namespace)
            .filter(({ entry }) => {
                const expiresAt = this.resolveOptionalTimestamp(entry.expiresAt);
                if (expiresAt && Date.parse(expiresAt) <= nowTime) {
                    return false;
                }
                if (queryTokens.length <= 0) {
                    return true;
                }
                const haystack = normalizeWhitespace([
                    entry.key,
                    entry.value,
                    ...(Array.isArray(entry.tags) ? entry.tags : []),
                    ...(Array.isArray(entry.references) ? entry.references : []),
                ].join(' ')).toLowerCase();
                const tokenHits = queryTokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
                return tokenHits >= requiredTokenHits;
            })
            .map(({ layer, entry }) => {
                const record = this.buildConversationMemoryRecord(entry, layer);
                const haystack = normalizeWhitespace([
                    String(record.content || ''),
                    ...(Array.isArray(record.tags) ? record.tags.map((tag) => String(tag || '')) : []),
                    String(record.source || ''),
                    String(record.namespace || ''),
                ].join(' ')).toLowerCase();
                const tokenHits = queryTokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
                return {
                    record,
                    score: Number((
                        tokenHits
                        + Number(record.confidence || 0)
                        + computeGovernedMemoryWeight(entry)
                    ).toFixed(4)),
                };
            })
            .sort((left, right) => {
                if (right.score !== left.score) {
                    return right.score - left.score;
                }
                return String(right.record.updatedAt || '').localeCompare(String(left.record.updatedAt || ''));
            });
        const results = matchedEntries.slice(0, limit).map((item) => item.record);
        matchedEntries.slice(0, limit).forEach((item) => {
            this.appendMemoryAuditRecord({
                userId,
                operation: 'recall',
                layer: item.record.layer as MemoryLayer,
                entry: this.buildGovernedMemoryEntry({
                    entry: {
                        key: String(item.record.memoryId || ''),
                        value: String(item.record.content || ''),
                        tags: Array.isArray(item.record.tags) ? item.record.tags.map((tag) => String(tag || '')) : [],
                        confidence: Number(item.record.confidence || 0),
                        references: Array.isArray(item.record.references)
                            ? item.record.references.map((reference) => String(reference || ''))
                            : [],
                        createdAt: String(item.record.createdAt || nowIso),
                        updatedAt: String(item.record.updatedAt || nowIso),
                        expiresAt: isNonEmptyString(item.record.expiresAt) ? String(item.record.expiresAt) : undefined,
                        memoryType: isNonEmptyString(item.record.memoryType) ? String(item.record.memoryType) : undefined,
                        memoryPurpose: isNonEmptyString(item.record.memoryPurpose) ? String(item.record.memoryPurpose) : undefined,
                        classificationConfidence: Number(item.record.classificationConfidence || 0),
                        scopeWorkspaceId: this.normalizeMemoryScopeValue(item.record.scopeWorkspaceId),
                        scopeCorpusId: this.normalizeMemoryScopeValue(item.record.scopeCorpusId),
                    },
                }),
                reason: query ? `conversation_memory:recall:${query}` : 'conversation_memory:recall',
                recordedAt: nowIso,
            });
        });
        const recallLines = results.map((record, index) => (
            `${index + 1}. [${String(record.namespace || 'conversation')}] ${String(record.content || '').trim()}`
        ));
        const message = results.length > 0
            ? `Conversation memory recall (${results.length}/${matchedEntries.length}) for "${queryLabel}":\n${recallLines.join('\n')}`
            : `Conversation memory recall (0/0) for "${queryLabel}":\nNo scoped memories matched the current query.`;
        return {
            namespace: namespace || null,
            query,
            summary: {
                matchedResults: matchedEntries.length,
                returnedResults: results.length,
            },
            results,
            entries: results,
            message,
        };
    }

    public async deleteConversationMemory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('ConversationMemory delete requires a non-empty userId.');
        }
        const memoryId = String(request.memoryId || '').trim();
        if (!memoryId) {
            throw new Error('ConversationMemory delete requires a non-empty memoryId.');
        }
        const namespace = this.normalizeConversationMemoryNamespace(request.namespace);
        const layer = this.resolveConversationMemoryLayer(namespace);
        const bank = this.ensureUserMemoryBank(userId);
        const beforeCount = bank[layer].length;
        const deletedEntries = bank[layer].filter((entry) => (
            entry.key === memoryId
            && this.hasConversationMemoryDomainTag(entry)
            && this.extractConversationMemoryTagValue(entry, 'namespace:') === namespace
        ));
        bank[layer] = bank[layer].filter((entry) => (
            entry.key !== memoryId
            || !this.hasConversationMemoryDomainTag(entry)
            || this.extractConversationMemoryTagValue(entry, 'namespace:') !== namespace
        ));
        const deletedCount = beforeCount - bank[layer].length;
        if (deletedCount > 0) {
            const recordedAt = this.resolveTimestamp(request.now);
            deletedEntries.forEach((entry) => {
                this.appendMemoryAuditRecord({
                    userId,
                    operation: 'evict',
                    layer,
                    entry,
                    reason: 'conversation_memory:delete',
                    recordedAt,
                });
            });
            await this.persistIfNeeded();
        }
        return {
            deleted: deletedCount > 0,
            deletedCount,
            namespace,
            memoryId,
            stats: this.collectMemoryStats(),
        };
    }

    public async feedbackConversationMemory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('ConversationMemory feedback requires a non-empty userId.');
        }
        const memoryId = String(request.memoryId || '').trim();
        if (!memoryId) {
            throw new Error('ConversationMemory feedback requires a non-empty memoryId.');
        }
        const namespace = this.normalizeConversationMemoryNamespace(request.namespace);
        const layer = this.resolveConversationMemoryLayer(namespace);
        const feedback = String(request.feedback || 'upvote').trim().toLowerCase();
        const nowIso = this.resolveTimestamp(request.now);
        const bank = this.ensureUserMemoryBank(userId);
        const targetIndex = bank[layer].findIndex((entry) => (
            entry.key === memoryId
            && this.hasConversationMemoryDomainTag(entry)
            && this.extractConversationMemoryTagValue(entry, 'namespace:') === namespace
        ));
        if (targetIndex < 0) {
            return {
                recorded: false,
                namespace,
                memoryId,
                feedback,
                stats: this.collectMemoryStats(),
            };
        }
        const current = bank[layer][targetIndex];
        let nextConfidence = clamp(Number(current.confidence || 0), 0, 1);
        if (feedback === 'downvote') {
            nextConfidence = clamp(nextConfidence - 0.18, 0.01, 1);
        } else if (feedback === 'correct') {
            nextConfidence = clamp(Math.max(nextConfidence, 0.92), 0, 1);
        } else {
            nextConfidence = clamp(nextConfidence + 0.08, 0, 1);
        }
        const updatedEntry = this.buildGovernedMemoryEntry({
            entry: {
                ...current,
                value: feedback === 'correct' && isNonEmptyString(request.correctedContent)
                    ? String(request.correctedContent).trim()
                    : current.value,
                tags: this.appendConversationMemoryFeedbackTag(
                    Array.isArray(current.tags) ? [...current.tags] : [],
                    feedback,
                    nowIso
                ),
                confidence: Number(nextConfidence.toFixed(4)),
                updatedAt: nowIso,
            },
            previous: current,
        });
        bank[layer][targetIndex] = updatedEntry;
        this.appendMemoryAuditRecord({
            userId,
            operation: 'feedback',
            layer,
            entry: updatedEntry,
            reason: `conversation_memory:feedback:${feedback}`,
            recordedAt: nowIso,
        });
        await this.persistIfNeeded();
        return {
            recorded: true,
            namespace,
            memoryId,
            feedback,
            memory: this.buildConversationMemoryRecord(updatedEntry, layer),
            stats: this.collectMemoryStats(),
        };
    }
    public async compareQueryBackends(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const comparedAt = this.resolveTimestamp(request.comparedAt);
        const query = normalizeWhitespace(String(request.query || ''));
        const topK = clamp(Math.floor(Number(request.topK) || 6), 1, 20);
        const leftBackend = normalizeGraphQueryBackendType(request.leftBackend || 'local_hybrid');
        const rightBackend = normalizeGraphQueryBackendType(
            request.rightBackend
            || (leftBackend === 'local_hybrid' ? 'keyword_only' : 'local_hybrid')
        );
        const left = await this.executeQueryBackend(
            {
                query,
                topK,
                asOf: request.asOf,
                queryBackend: leftBackend,
            },
            leftBackend,
            {
                allowRuntimeFallback: false,
                recordFallback: false,
            }
        );
        const right = await this.executeQueryBackend(
            {
                query,
                topK,
                asOf: request.asOf,
                queryBackend: rightBackend,
            },
            rightBackend,
            {
                allowRuntimeFallback: false,
                recordFallback: false,
            }
        );
        const record = this.buildQueryBackendComparisonRecord({
            comparedAt,
            query,
            topK,
            left,
            right,
        });
        this.recordQueryBackendComparisonHistory(record);
        await this.persistIfNeeded();
        return record;
    }

    public async queryKnowledgeQueryBackendComparisonHistory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 8), 1, 200);
        const records = this.queryBackendComparisonHistoryRecords
            .slice()
            .sort((left, right) => right.comparedAt.localeCompare(left.comparedAt))
            .slice(0, limit)
            .map((record) => ({
                ...record,
                left: {
                    ...record.left,
                    retrievalModes: [...record.left.retrievalModes],
                    modeWeights: { ...record.left.modeWeights },
                    items: record.left.items.map((item) => ({ ...item })),
                },
                right: {
                    ...record.right,
                    retrievalModes: [...record.right.retrievalModes],
                    modeWeights: { ...record.right.modeWeights },
                    items: record.right.items.map((item) => ({ ...item })),
                },
                summary: { ...record.summary },
            }));
        const averageMetric = (selector: (record: QueryBackendComparisonRecord) => number): number => (
            records.length > 0
                ? Number((records.reduce((sum, record) => sum + selector(record), 0) / records.length).toFixed(4))
                : 0
        );
        const preferredCounts = records.reduce((accumulator, record) => {
            accumulator[record.summary.preferredBackend] += 1;
            return accumulator;
        }, { left: 0, right: 0, tie: 0 });
        return {
            summary: {
                totalRecords: this.queryBackendComparisonHistoryRecords.length,
                returnedRecords: records.length,
                averageOverlapRatioPct: averageMetric((record) => record.summary.overlapRatioPct),
                averageLatencyDeltaMs: averageMetric((record) => record.summary.latencyDeltaMs),
                averageLeftEvidenceCoverageRatio: averageMetric((record) => record.summary.leftEvidenceCoverageRatio),
                averageRightEvidenceCoverageRatio: averageMetric((record) => record.summary.rightEvidenceCoverageRatio),
                preferredCounts,
                latestComparedAt: records[0]?.comparedAt || null,
            },
            records,
        };
    }

    public async queryKnowledgeQueryBackendComparisonTrend(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 12), 1, 200);
        const windowSize = clamp(Math.floor(Number(request.windowSize) || 2), 1, 50);
        const minSamples = clamp(Math.floor(Number(request.minSamples) || 1), 1, 50);
        const records = this.queryBackendComparisonHistoryRecords
            .slice()
            .sort((left, right) => right.comparedAt.localeCompare(left.comparedAt))
            .slice(0, limit);
        const currentWindow = records.slice(0, windowSize);
        const previousWindow = records.slice(windowSize, windowSize * 2);
        const summarizeWindow = (items: QueryBackendComparisonRecord[]) => {
            const count = items.length;
            const preferredLeft = items.filter((record) => record.summary.preferredBackend === 'left').length;
            const preferredRight = items.filter((record) => record.summary.preferredBackend === 'right').length;
            const overlap = count > 0
                ? items.reduce((sum, record) => sum + record.summary.overlapRatioPct, 0) / count
                : 0;
            const latencyImbalance = count > 0
                ? items.reduce((sum, record) => sum + Math.abs(Number(record.summary.latencyDeltaMs || 0)), 0) / count
                : 0;
            const explainabilityGap = count > 0
                ? items.reduce((sum, record) => {
                    const leftExplainability = (
                        record.summary.leftEvidenceCoverageRatio
                        + record.summary.leftRelationPathCoverageRatio
                        + record.summary.leftTemporalValidityPassRatio
                    ) / 3;
                    const rightExplainability = (
                        record.summary.rightEvidenceCoverageRatio
                        + record.summary.rightRelationPathCoverageRatio
                        + record.summary.rightTemporalValidityPassRatio
                    ) / 3;
                    return sum + Math.abs(leftExplainability - rightExplainability) * 100;
                }, 0) / count
                : 0;
            return {
                count,
                overlapRatioPct: Number(overlap.toFixed(4)),
                latencyImbalanceDeltaMs: Number(latencyImbalance.toFixed(4)),
                explainabilityGapDeltaPct: Number(explainabilityGap.toFixed(4)),
                leftPreferredSharePct: Number(((preferredLeft / Math.max(1, count)) * 100).toFixed(4)),
                rightPreferredSharePct: Number(((preferredRight / Math.max(1, count)) * 100).toFixed(4)),
            };
        };
        const current = summarizeWindow(currentWindow);
        const previous = summarizeWindow(previousWindow);
        const deltas = {
            overlapDeltaPct: Number((current.overlapRatioPct - previous.overlapRatioPct).toFixed(4)),
            latencyImbalanceDeltaMs: Number((current.latencyImbalanceDeltaMs - previous.latencyImbalanceDeltaMs).toFixed(4)),
            explainabilityGapDeltaPct: Number((current.explainabilityGapDeltaPct - previous.explainabilityGapDeltaPct).toFixed(4)),
            leftPreferredShareDeltaPct: Number((current.leftPreferredSharePct - previous.leftPreferredSharePct).toFixed(4)),
            rightPreferredShareDeltaPct: Number((current.rightPreferredSharePct - previous.rightPreferredSharePct).toFixed(4)),
        };
        const score = Number(clamp(
            (current.overlapRatioPct / 100) * 0.35
            + (1 - Math.min(current.latencyImbalanceDeltaMs, 1500) / 1500) * 0.25
            + (1 - current.explainabilityGapDeltaPct / 100) * 0.4,
            0,
            1
        ).toFixed(4));
        if (currentWindow.length < minSamples || previousWindow.length < minSamples) {
            return {
                status: 'insufficient_data',
                confidence: Number(clamp(records.length / Math.max(1, minSamples * 2), 0, 1).toFixed(4)),
                score,
                summary: {
                    totalRecords: records.length,
                    evaluatedRecords: currentWindow.length,
                    reason: `Need ${minSamples} backend comparisons in both windows before trend scoring is reliable.`,
                    latestComparedAt: records[0]?.comparedAt || null,
                },
                deltas,
            };
        }
        let status: 'improving' | 'stable' | 'regressing' | 'insufficient_data' = 'stable';
        if (
            deltas.overlapDeltaPct >= 5
            && deltas.latencyImbalanceDeltaMs <= 0
            && deltas.explainabilityGapDeltaPct <= 0
        ) {
            status = 'improving';
        } else if (
            deltas.overlapDeltaPct <= -5
            || deltas.latencyImbalanceDeltaMs >= 15
            || deltas.explainabilityGapDeltaPct >= 5
        ) {
            status = 'regressing';
        }
        return {
            status,
            confidence: Number(clamp(
                Math.min(currentWindow.length, previousWindow.length) / Math.max(1, minSamples * 2),
                0,
                1
            ).toFixed(4)),
            score,
            summary: {
                totalRecords: records.length,
                evaluatedRecords: currentWindow.length + previousWindow.length,
                reason: `Overlap delta ${deltas.overlapDeltaPct.toFixed(2)} pct, latency imbalance delta ${deltas.latencyImbalanceDeltaMs.toFixed(2)} ms, explainability gap delta ${deltas.explainabilityGapDeltaPct.toFixed(2)} pct.`,
                latestComparedAt: records[0]?.comparedAt || null,
            },
            deltas,
        };
    }

    public async queryKnowledgeStalenessDiagnostics(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 20), 1, 500);
        const onlyStale = request.onlyStale === true;
        const sourcePathPrefix = String(request.sourcePathPrefix || '').trim();
        const records = await Promise.all(
            Array.from(this.documents.values())
                .filter((snapshot) => !sourcePathPrefix || snapshot.sourcePath.startsWith(sourcePathPrefix))
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .map(async (snapshot) => {
                    const resolvedPath = path.resolve(snapshot.sourcePath);
                    try {
                        const stat = await fs.promises.stat(resolvedPath);
                        const content = await fs.promises.readFile(resolvedPath, 'utf8');
                        const currentHash = this.computeHash(content);
                        const status = currentHash === snapshot.sourceHash ? 'up_to_date' : 'hash_mismatch';
                        return {
                            documentId: snapshot.documentId,
                            sourcePath: snapshot.sourcePath,
                            resolvedSourcePath: resolvedPath,
                            status,
                            version: snapshot.version,
                            storedHash: snapshot.sourceHash,
                            currentHash,
                            updatedAt: snapshot.updatedAt,
                            fileMtime: stat.mtime.toISOString(),
                            stale: status !== 'up_to_date',
                        };
                    } catch (error) {
                        const code = (error as NodeJS.ErrnoException | undefined)?.code;
                        const status = code === 'ENOENT' || code === 'ENOTDIR'
                            ? 'missing_source'
                            : 'read_error';
                        return {
                            documentId: snapshot.documentId,
                            sourcePath: snapshot.sourcePath,
                            resolvedSourcePath: resolvedPath,
                            status,
                            version: snapshot.version,
                            storedHash: snapshot.sourceHash,
                            currentHash: null,
                            updatedAt: snapshot.updatedAt,
                            fileMtime: null,
                            stale: true,
                            error: String((error as Error)?.message || error || status).trim(),
                        };
                    }
                })
        );
        const filteredRecords = onlyStale ? records.filter((record) => record.stale) : records;
        const returnedRecords = filteredRecords.slice(0, limit);
        const upToDateDocuments = records.filter((record) => record.status === 'up_to_date').length;
        const hashMismatchDocuments = records.filter((record) => record.status === 'hash_mismatch').length;
        const missingSourceDocuments = records.filter((record) => record.status === 'missing_source').length;
        const readErrorDocuments = records.filter((record) => record.status === 'read_error').length;
        const staleDocuments = hashMismatchDocuments + missingSourceDocuments + readErrorDocuments;
        const evaluatedDocuments = records.length;
        return {
            summary: {
                totalDocuments: this.documents.size,
                evaluatedDocuments,
                returnedRecords: returnedRecords.length,
                upToDateDocuments,
                hashMismatchDocuments,
                missingSourceDocuments,
                readErrorDocuments,
                staleDocuments,
                freshnessRatioPct: Number(
                    clamp((upToDateDocuments / Math.max(1, evaluatedDocuments)) * 100, 0, 100).toFixed(4)
                ),
                staleRatioPct: Number(
                    clamp((staleDocuments / Math.max(1, evaluatedDocuments)) * 100, 0, 100).toFixed(4)
                ),
                reason: staleDocuments > 0
                    ? `Detected ${staleDocuments} stale source document(s) across ${evaluatedDocuments} evaluated snapshots.`
                    : 'All evaluated source documents match the stored knowledge snapshot.',
            },
            records: returnedRecords,
        };
    }

    public async rebuildKnowledgeFromStalenessDiagnostics(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        if (Array.isArray(request.documents) && request.documents.length > 0) {
            const ingestResult = await this.ingestKnowledge({
                incremental: true,
                documents: request.documents,
                relationRecomputeMode: 'full',
                ingestedAt: request.rebuiltAt,
            });
            return {
                rebuilt: ingestResult.summary.changedDocuments,
                mode: 'reingest_documents',
                rebuiltAt: this.resolveTimestamp(request.rebuiltAt),
                plannedDocuments: ingestResult.summary.changedDocuments,
                summary: ingestResult.summary,
            };
        }
        const diagnostics = await this.queryKnowledgeStalenessDiagnostics(request);
        const staleRecords = Array.isArray(diagnostics.records)
            ? diagnostics.records.filter((record: Record<string, unknown>) => record && record.stale === true)
            : [];
        return {
            rebuilt: 0,
            mode: 'plan_only',
            rebuiltAt: this.resolveTimestamp(request.rebuiltAt),
            plannedDocuments: staleRecords.length,
            staleDocuments: Number(diagnostics.summary?.staleDocuments || staleRecords.length),
            reason: 'Runtime snapshots retain hashes and evidence, not full source payloads. Rebuild requires caller-supplied document content for re-ingest.',
            records: staleRecords,
        };
    }

    public async queryLearningQualityHistory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 20), 1, 200);
        const userId = String(request.userId || '').trim();
        const records = this.learningQualityHistoryRecords
            .filter((record) => !userId || record.userId === userId)
            .slice()
            .sort((left, right) => right.sampledAt.localeCompare(left.sampledAt))
            .slice(0, limit)
            .map((record) => ({
                ...record,
                snapshot: this.cloneLearningQualitySnapshot(record.snapshot),
                diagnostics: { ...record.diagnostics },
            }));
        const averageMetric = (selector: (record: LearningQualityHistoryRecord) => number): number => (
            records.length > 0
                ? Number((records.reduce((sum, record) => sum + selector(record), 0) / records.length).toFixed(4))
                : 0
        );
        return {
            summary: {
                totalRecords: this.learningQualityHistoryRecords.filter((record) => !userId || record.userId === userId).length,
                returnedRecords: records.length,
                latestSampledAt: records[0]?.sampledAt || null,
                oldestSampledAt: records[records.length - 1]?.sampledAt || null,
                averageRetestPassRatePct: averageMetric((record) => Number(record.snapshot.retestPassRatePct || 0)),
                averageEvidenceBackedSuggestionRatioPct: averageMetric((record) => Number(record.snapshot.evidenceBackedSuggestionRatioPct || 0)),
                averageMisconceptionRecurrenceRatePct: averageMetric((record) => Number(record.snapshot.misconceptionRecurrenceRatePct || 0)),
                averageQueryBackendFallbackRatioPct: averageMetric((record) => Number(record.snapshot.queryBackendFallbackRatioPct || 0)),
            },
            records,
        };
    }

    public async queryLearningQualityTrend(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 10), 1, 200);
        const windowSize = clamp(Math.floor(Number(request.windowSize) || 2), 1, 50);
        const minSamples = clamp(Math.floor(Number(request.minSamples) || 1), 1, 50);
        const userId = String(request.userId || '').trim();
        const records = this.learningQualityHistoryRecords
            .filter((record) => !userId || record.userId === userId)
            .slice()
            .sort((left, right) => right.sampledAt.localeCompare(left.sampledAt))
            .slice(0, limit);
        const summarizeWindow = (items: LearningQualityHistoryRecord[]) => {
            const count = items.length;
            const average = (selector: (record: LearningQualityHistoryRecord) => number): number => (
                count > 0
                    ? items.reduce((sum, record) => sum + selector(record), 0) / count
                    : 0
            );
            return {
                count,
                retestPassRatePct: Number(average((record) => Number(record.snapshot.retestPassRatePct || 0)).toFixed(4)),
                evidenceBackedSuggestionRatioPct: Number(average((record) => Number(record.snapshot.evidenceBackedSuggestionRatioPct || 0)).toFixed(4)),
                misconceptionRecurrenceRatePct: Number(average((record) => Number(record.snapshot.misconceptionRecurrenceRatePct || 0)).toFixed(4)),
                queryBackendFallbackRatioPct: Number(average((record) => Number(record.snapshot.queryBackendFallbackRatioPct || 0)).toFixed(4)),
            };
        };
        const currentWindow = records.slice(0, windowSize);
        const previousWindow = records.slice(windowSize, windowSize * 2);
        const current = summarizeWindow(currentWindow);
        const previous = summarizeWindow(previousWindow);
        const deltas = {
            retestPassRateDeltaPct: Number((current.retestPassRatePct - previous.retestPassRatePct).toFixed(4)),
            evidenceBackedSuggestionDeltaPct: Number((current.evidenceBackedSuggestionRatioPct - previous.evidenceBackedSuggestionRatioPct).toFixed(4)),
            misconceptionRecurrenceDeltaPct: Number((current.misconceptionRecurrenceRatePct - previous.misconceptionRecurrenceRatePct).toFixed(4)),
            queryBackendFallbackDeltaPct: Number((current.queryBackendFallbackRatioPct - previous.queryBackendFallbackRatioPct).toFixed(4)),
        };
        const score = Number(clamp(
            (current.retestPassRatePct / 100) * 0.25
            + (current.evidenceBackedSuggestionRatioPct / 100) * 0.3
            + (1 - current.misconceptionRecurrenceRatePct / 100) * 0.25
            + (1 - current.queryBackendFallbackRatioPct / 100) * 0.2,
            0,
            1
        ).toFixed(4));
        if (currentWindow.length < minSamples || previousWindow.length < minSamples) {
            return {
                status: 'insufficient_data',
                confidence: Number(clamp(records.length / Math.max(1, minSamples * 2), 0, 1).toFixed(4)),
                score,
                summary: {
                    totalRecords: records.length,
                    evaluatedRecords: currentWindow.length,
                    reason: `Need ${minSamples} learning-quality records in both windows before trend scoring is reliable.`,
                    latestSampledAt: records[0]?.sampledAt || null,
                },
                deltas,
            };
        }
        let status: 'improving' | 'stable' | 'regressing' | 'insufficient_data' = 'stable';
        if (
            deltas.retestPassRateDeltaPct >= 3
            && deltas.evidenceBackedSuggestionDeltaPct >= 0
            && deltas.misconceptionRecurrenceDeltaPct <= 0
            && deltas.queryBackendFallbackDeltaPct <= 0
        ) {
            status = 'improving';
        } else if (
            deltas.retestPassRateDeltaPct <= -3
            || deltas.evidenceBackedSuggestionDeltaPct <= -5
            || deltas.misconceptionRecurrenceDeltaPct >= 5
            || deltas.queryBackendFallbackDeltaPct >= 5
        ) {
            status = 'regressing';
        }
        return {
            status,
            confidence: Number(clamp(
                Math.min(currentWindow.length, previousWindow.length) / Math.max(1, minSamples * 2),
                0,
                1
            ).toFixed(4)),
            score,
            summary: {
                totalRecords: records.length,
                evaluatedRecords: currentWindow.length + previousWindow.length,
                reason: `Retest delta ${deltas.retestPassRateDeltaPct.toFixed(2)} pct, evidence delta ${deltas.evidenceBackedSuggestionDeltaPct.toFixed(2)} pct, misconception delta ${deltas.misconceptionRecurrenceDeltaPct.toFixed(2)} pct, fallback delta ${deltas.queryBackendFallbackDeltaPct.toFixed(2)} pct.`,
                latestSampledAt: records[0]?.sampledAt || null,
            },
            deltas,
        };
    }

    public getLearningQualityThresholds(): any {
        return {
            ...this.learningQualityThresholds,
        };
    }

    public async evaluateStudySessionPlanQuality(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const sessionPlan = request.sessionPlan && typeof request.sessionPlan === 'object'
            ? request.sessionPlan as StudySessionResponse
            : null;
        if (!sessionPlan) {
            throw new Error('study_session_plan_quality_session_plan_required');
        }
        const evaluatedAt = this.resolveTimestamp(request.evaluatedAt);
        const userId = isNonEmptyString(request.userId)
            ? request.userId.trim()
            : (isNonEmptyString(sessionPlan.userId) ? sessionPlan.userId.trim() : null);
        const record = this.evaluateStudySessionPlanQualityInternal({
            request,
            sessionPlan,
            userId,
            evaluatedAt,
            source: 'manual_evaluation',
        });
        if (request.persistRecord !== false) {
            this.recordStudySessionPlanQualityHistory(record);
            await this.persistIfNeeded();
        }
        return {
            evaluated: true,
            evaluatedAt,
            userId,
            thresholds: { ...record.thresholds },
            metrics: {
                totalActions: record.totalActions,
                evidenceCoverageRatioPct: record.evidenceCoverageRatioPct,
                budgetDeviationActions: record.budgetDeviationActions,
                recoverySharePct: record.recoverySharePct,
                divergenceSharePct: record.divergenceSharePct,
            },
            summary: {
                overallPassed: record.overallPassed,
                status: record.status,
                score: record.score,
                confidence: record.confidence,
                reason: record.summaryReason,
                trendContextStatus: record.trendContextStatus,
            },
            gates: record.gates.map((gate) => ({ ...gate })),
            record: {
                ...record,
                thresholds: { ...record.thresholds },
                gates: record.gates.map((gate) => ({ ...gate })),
                failedGateIds: [...record.failedGateIds],
            },
        };
    }

    public async queryStudySessionPlanQualityHistory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 20), 1, 200);
        const userId = String(request.userId || '').trim();
        const scopedRecords = this.studySessionPlanQualityHistoryRecords
            .filter((record) => !userId || record.userId === userId)
            .slice()
            .sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt));
        const records = scopedRecords
            .slice(0, limit)
            .map((record) => ({
                ...record,
                thresholds: { ...record.thresholds },
                gates: record.gates.map((gate) => ({ ...gate })),
                failedGateIds: [...record.failedGateIds],
            }));
        const overallPassRatePct = Number(
            clamp(
                (scopedRecords.filter((record) => record.overallPassed).length / Math.max(1, scopedRecords.length)) * 100,
                0,
                100
            ).toFixed(4)
        );
        const returnedPassRatePct = Number(
            clamp(
                (records.filter((record) => record.overallPassed).length / Math.max(1, records.length)) * 100,
                0,
                100
            ).toFixed(4)
        );
        let consecutiveFailureCount = 0;
        for (const record of scopedRecords) {
            if (record.overallPassed) {
                break;
            }
            consecutiveFailureCount += 1;
        }
        const failedGateCounts = new Map<string, number>();
        scopedRecords.forEach((record) => {
            record.failedGateIds.forEach((gateId) => {
                failedGateCounts.set(gateId, (failedGateCounts.get(gateId) || 0) + 1);
            });
        });
        const commonFailedGates = Array.from(failedGateCounts.entries())
            .map(([gateId, count]) => ({ gateId, count }))
            .sort((left, right) => right.count - left.count);
        const averageBudgetDeviationActions = records.length > 0
            ? Number((records.reduce((sum, record) => sum + record.budgetDeviationActions, 0) / records.length).toFixed(4))
            : 0;
        return {
            summary: {
                totalRecords: scopedRecords.length,
                returnedRecords: records.length,
                overallPassRatePct,
                returnedPassRatePct,
                consecutiveFailureCount,
                averageBudgetDeviationActions,
                commonFailedGates,
                latestEvaluatedAt: records[0]?.evaluatedAt || null,
            },
            records,
        };
    }

    public async queryStudySessionPlanQualityTrend(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 10), 1, 200);
        const windowSize = clamp(Math.floor(Number(request.windowSize) || 2), 1, 50);
        const minSamples = clamp(Math.floor(Number(request.minSamples) || 1), 1, 50);
        const userId = String(request.userId || '').trim();
        const records = this.studySessionPlanQualityHistoryRecords
            .filter((record) => !userId || record.userId === userId)
            .slice()
            .sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt))
            .slice(0, limit);
        const summarizeWindow = (items: StudySessionPlanQualityHistoryRecord[]) => {
            const count = items.length;
            const average = (selector: (record: StudySessionPlanQualityHistoryRecord) => number): number => (
                count > 0
                    ? items.reduce((sum, record) => sum + selector(record), 0) / count
                    : 0
            );
            return {
                count,
                passRatePct: Number(
                    clamp((items.filter((record) => record.overallPassed).length / Math.max(1, count)) * 100, 0, 100).toFixed(4)
                ),
                evidenceCoverageRatioPct: Number(average((record) => record.evidenceCoverageRatioPct).toFixed(4)),
                budgetDeviationActions: Number(average((record) => record.budgetDeviationActions).toFixed(4)),
                recoverySharePct: Number(average((record) => record.recoverySharePct).toFixed(4)),
                divergenceSharePct: Number(average((record) => record.divergenceSharePct).toFixed(4)),
            };
        };
        const currentWindow = records.slice(0, windowSize);
        const previousWindow = records.slice(windowSize, windowSize * 2);
        const current = summarizeWindow(currentWindow);
        const previous = summarizeWindow(previousWindow);
        const deltas = {
            passRateDeltaPct: Number((current.passRatePct - previous.passRatePct).toFixed(4)),
            evidenceCoverageDeltaPct: Number((current.evidenceCoverageRatioPct - previous.evidenceCoverageRatioPct).toFixed(4)),
            budgetDeviationDeltaActions: Number((current.budgetDeviationActions - previous.budgetDeviationActions).toFixed(4)),
            recoveryShareDeltaPct: Number((current.recoverySharePct - previous.recoverySharePct).toFixed(4)),
            divergenceShareDeltaPct: Number((current.divergenceSharePct - previous.divergenceSharePct).toFixed(4)),
        };
        const score = Number(clamp(
            (current.passRatePct / 100) * 0.55
            + (current.evidenceCoverageRatioPct / 100) * 0.25
            + (1 - Math.min(current.budgetDeviationActions, 6) / 6) * 0.1
            + (current.recoverySharePct / 100) * 0.05
            + (1 - current.divergenceSharePct / 100) * 0.05,
            0,
            1
        ).toFixed(4));
        if (currentWindow.length < minSamples || previousWindow.length < minSamples) {
            return {
                status: 'insufficient_data',
                confidence: Number(clamp(records.length / Math.max(1, minSamples * 2), 0, 1).toFixed(4)),
                score,
                summary: {
                    totalRecords: records.length,
                    evaluatedRecords: currentWindow.length,
                    reason: `Need ${minSamples} study-session plan quality records in both windows before trend scoring is reliable.`,
                    latestEvaluatedAt: records[0]?.evaluatedAt || null,
                },
                deltas,
            };
        }
        let status: 'improving' | 'stable' | 'regressing' | 'insufficient_data' = 'stable';
        if (
            deltas.passRateDeltaPct >= 10
            && deltas.evidenceCoverageDeltaPct >= 0
            && deltas.budgetDeviationDeltaActions <= 0
        ) {
            status = 'improving';
        } else if (
            deltas.passRateDeltaPct <= -10
            || deltas.evidenceCoverageDeltaPct <= -10
            || deltas.budgetDeviationDeltaActions >= 1
        ) {
            status = 'regressing';
        }
        return {
            status,
            confidence: Number(clamp(
                Math.min(currentWindow.length, previousWindow.length) / Math.max(1, minSamples * 2),
                0,
                1
            ).toFixed(4)),
            score,
            summary: {
                totalRecords: records.length,
                evaluatedRecords: currentWindow.length + previousWindow.length,
                reason: `Pass-rate delta ${deltas.passRateDeltaPct.toFixed(2)} pct, evidence delta ${deltas.evidenceCoverageDeltaPct.toFixed(2)} pct, budget delta ${deltas.budgetDeviationDeltaActions.toFixed(2)} actions.`,
                latestEvaluatedAt: records[0]?.evaluatedAt || null,
            },
            deltas,
        };
    }

    public async queryStudySessionPlanQualityRuntimeThresholds(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const historyLimit = clamp(
            Math.floor(
                Number(
                    request.historyLimit
                    ?? this.studySessionPlanQualityAdaptiveThresholdRuntimeConfig.historyLimit
                    ?? 12
                ) || 12
            ),
            1,
            200
        );
        const trendLimit = clamp(
            Math.floor(
                Number(
                    request.trendLimit
                    ?? this.studySessionPlanQualityAdaptiveThresholdRuntimeConfig.trendLimit
                    ?? 12
                ) || 12
            ),
            1,
            200
        );
        const trendWindowSize = clamp(
            Math.floor(
                Number(
                    request.trendWindowSize
                    ?? this.studySessionPlanQualityAdaptiveThresholdRuntimeConfig.trendWindowSize
                    ?? 2
                ) || 2
            ),
            1,
            50
        );
        const trendMinSamples = clamp(
            Math.floor(
                Number(
                    request.trendMinSamples
                    ?? this.studySessionPlanQualityAdaptiveThresholdRuntimeConfig.trendMinSamples
                    ?? 1
                ) || 1
            ),
            1,
            50
        );
        const userId = String(request.userId || '').trim();
        const baseThresholds = this.resolveStudySessionPlanQualityThresholds(
            (request.thresholds && typeof request.thresholds === 'object'
                ? request.thresholds
                : undefined) as Partial<StudySessionPlanQualityThresholdSet> | undefined
        );
        const adaptiveThresholdsEnabled = request.adaptiveThresholdsEnabled === true
            || (
                request.adaptiveThresholdsEnabled !== false
                && this.studySessionPlanQualityAdaptiveThresholdsEnabled === true
            );
        const history = await this.queryStudySessionPlanQualityHistory({
            userId: userId || undefined,
            limit: historyLimit,
        });
        const trend = await this.queryStudySessionPlanQualityTrend({
            userId: userId || undefined,
            limit: trendLimit,
            windowSize: trendWindowSize,
            minSamples: trendMinSamples,
        });
        const records = this.studySessionPlanQualityHistoryRecords
            .filter((record) => !userId || record.userId === userId)
            .slice(0, historyLimit);
        const thresholds = {
            ...baseThresholds,
        };
        const adaptiveAdjustments: Record<string, number> = {};
        if (adaptiveThresholdsEnabled && records.length > 0) {
            const averageTotalActions = records.reduce((sum, record) => sum + record.totalActions, 0) / records.length;
            const averageEvidenceCoverageRatioPct = records.reduce((sum, record) => sum + record.evidenceCoverageRatioPct, 0) / records.length;
            const averageBudgetDeviationActions = records.reduce((sum, record) => sum + record.budgetDeviationActions, 0) / records.length;
            thresholds.minTotalActions = Math.max(1, Math.floor(Math.max(baseThresholds.minTotalActions, averageTotalActions * 0.6)));
            thresholds.minEvidenceCoverageRatioPct = Number(
                clamp(Math.max(baseThresholds.minEvidenceCoverageRatioPct, averageEvidenceCoverageRatioPct * 0.85), 0, 100).toFixed(4)
            );
            thresholds.maxBudgetDeviationActions = Math.max(
                baseThresholds.maxBudgetDeviationActions,
                Math.ceil(averageBudgetDeviationActions + 1)
            );
            adaptiveAdjustments.minTotalActions = Number((thresholds.minTotalActions - baseThresholds.minTotalActions).toFixed(4));
            adaptiveAdjustments.minEvidenceCoverageRatioPct = Number(
                (thresholds.minEvidenceCoverageRatioPct - baseThresholds.minEvidenceCoverageRatioPct).toFixed(4)
            );
            adaptiveAdjustments.maxBudgetDeviationActions = Number(
                (thresholds.maxBudgetDeviationActions - baseThresholds.maxBudgetDeviationActions).toFixed(4)
            );
        }
        return {
            adaptiveThresholdsEnabled,
            baseThresholds,
            thresholds,
            adaptiveAdjustments,
            runtimeConfig: {
                ...this.studySessionPlanQualityAdaptiveThresholdRuntimeConfig,
                historyLimit,
                trendLimit,
                trendWindowSize,
                trendMinSamples,
            },
            summary: {
                totalRecords: Number(history.summary?.totalRecords || records.length),
                latestEvaluatedAt: history.summary?.latestEvaluatedAt || null,
                trendStatus: String(trend.status || 'insufficient_data'),
                reason: adaptiveThresholdsEnabled
                    ? 'Adaptive session-plan quality thresholds were derived from recent execution history.'
                    : 'Static session-plan quality thresholds are active.',
            },
        };
    }
    public async queryMemoryPolicyDiagnostics(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const diagnostics = this.buildMemoryPolicyDiagnosticsSnapshot(request);
        if (request.persistRecord !== false) {
            this.recordMemoryPolicyDiagnosticsHistory({ ...diagnostics });
            await this.persistIfNeeded();
        }
        return diagnostics;
    }
    public async queryMemoryPolicyDiagnosticsHistory(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 20), 1, 200);
        const records: Array<Record<string, unknown>> = this.memoryPolicyDiagnosticsHistoryRecords
            .slice()
            .sort((left, right) => String(right.recordedAt || '').localeCompare(String(left.recordedAt || '')))
            .slice(0, limit)
            .map((record) => ({ ...record }));
        const getRecordStatus = (record: Record<string, unknown>): string => {
            const summary = record.summary && typeof record.summary === 'object'
                ? record.summary as Record<string, unknown>
                : {};
            return String(summary.status || '').trim();
        };
        return {
            summary: {
                totalRecords: this.memoryPolicyDiagnosticsHistoryRecords.length,
                returnedRecords: records.length,
                latestRecordedAt: records[0]?.recordedAt || null,
                oldestRecordedAt: records[records.length - 1]?.recordedAt || null,
                healthyRecords: records.filter((record) => getRecordStatus(record) === 'healthy').length,
                watchRecords: records.filter((record) => getRecordStatus(record) === 'watch').length,
                riskRecords: records.filter((record) => getRecordStatus(record) === 'risk').length,
                insufficientDataRecords: records.filter((record) => getRecordStatus(record) === 'insufficient_data').length,
            },
            records,
        };
    }
    public async queryMemoryPolicyDiagnosticsTrend(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const limit = clamp(Math.floor(Number(request.limit) || 12), 1, 200);
        const windowSize = clamp(Math.floor(Number(request.windowSize) || 2), 1, 50);
        const minSamples = clamp(Math.floor(Number(request.minSamples) || 2), 1, 50);
        const records: Array<Record<string, unknown>> = this.memoryPolicyDiagnosticsHistoryRecords
            .slice()
            .sort((left, right) => String(right.recordedAt || '').localeCompare(String(left.recordedAt || '')))
            .slice(0, limit);
        const latestWindow = records.slice(0, windowSize);
        const previousWindow = records.slice(windowSize, windowSize * 2);
        const averageHealthScore = (items: Array<Record<string, unknown>>): number => (
            items.length > 0
                ? Number((
                    items.reduce((sum, item) => {
                        const summary = item.summary && typeof item.summary === 'object'
                            ? item.summary as Record<string, unknown>
                            : {};
                        return sum + Number(summary.healthScore || 0);
                    }, 0)
                    / items.length
                ).toFixed(4))
                : 0
        );
        const sumMetric = (items: Array<Record<string, unknown>>, key: string): number => (
            items.reduce((sum, item) => {
                const summary = item.summary && typeof item.summary === 'object'
                    ? item.summary as Record<string, unknown>
                    : {};
                return sum + Math.max(0, Number(summary[key] || 0));
            }, 0)
        );
        const latestScore = averageHealthScore(latestWindow);
        const previousScore = averageHealthScore(previousWindow);
        const deltas = {
            healthScoreDelta: Number((latestScore - previousScore).toFixed(4)),
            expiredEntriesDelta: Number((sumMetric(latestWindow, 'expiredEntries') - sumMetric(previousWindow, 'expiredEntries')).toFixed(4)),
            staleEntriesDelta: Number((sumMetric(latestWindow, 'staleEntries') - sumMetric(previousWindow, 'staleEntries')).toFixed(4)),
            lowConfidenceEntriesDelta: Number((sumMetric(latestWindow, 'lowConfidenceEntries') - sumMetric(previousWindow, 'lowConfidenceEntries')).toFixed(4)),
        };
        if (latestWindow.length < minSamples || previousWindow.length < minSamples) {
            return {
                status: 'insufficient_data',
                score: Number((latestScore / 100).toFixed(4)),
                confidence: Number(clamp(records.length / Math.max(1, minSamples * 2), 0, 1).toFixed(4)),
                summary: {
                    reason: `Need ${minSamples} records in both windows before memory policy trend can be evaluated.`,
                    totalRecords: records.length,
                    evaluatedRecords: latestWindow.length,
                    latestRecordedAt: records[0]?.recordedAt || null,
                    oldestRecordedAt: records[records.length - 1]?.recordedAt || null,
                },
                deltas,
            };
        }
        let status: 'improving' | 'stable' | 'regressing' | 'insufficient_data' = 'stable';
        if (
            deltas.healthScoreDelta >= 3
            && deltas.expiredEntriesDelta <= 0
            && deltas.staleEntriesDelta <= 0
        ) {
            status = 'improving';
        } else if (
            deltas.healthScoreDelta <= -3
            || deltas.expiredEntriesDelta > 0
            || deltas.staleEntriesDelta > 0
        ) {
            status = 'regressing';
        }
        return {
            status,
            score: Number((latestScore / 100).toFixed(4)),
            confidence: Number(clamp(
                Math.min(latestWindow.length, previousWindow.length) / Math.max(1, minSamples * 2),
                0,
                1
            ).toFixed(4)),
            summary: {
                reason: `Health delta ${deltas.healthScoreDelta.toFixed(2)} with expired delta ${deltas.expiredEntriesDelta.toFixed(0)} and stale delta ${deltas.staleEntriesDelta.toFixed(0)}.`,
                totalRecords: records.length,
                evaluatedRecords: latestWindow.length + previousWindow.length,
                latestRecordedAt: records[0]?.recordedAt || null,
                oldestRecordedAt: records[records.length - 1]?.recordedAt || null,
            },
            deltas,
        };
    }
    public getQueryBackendConfig(): any {
        return {
            configuredBackend: this.currentGraphQueryBackendType,
            backendId: this.graphQueryBackend.id,
            queryVectorAnnPrefilterEnabled: this.graphQueryBackendFactoryOptions.localVectorAnnPrefilterEnabled !== false,
            localVectorIndexPath: isNonEmptyString(this.graphQueryBackendFactoryOptions.localVectorIndexPath)
                ? this.graphQueryBackendFactoryOptions.localVectorIndexPath
                : null,
            configuredVectorAccelerationProvider: (() => {
                const provider = this.graphQueryBackendFactoryOptions.localVectorAccelerationAdapter;
                if (typeof provider === 'string') {
                    return provider;
                }
                return String(provider && typeof provider === 'object' ? (provider as { id?: string }).id || '' : '').trim() || null;
            })(),
            configuredVectorAccelerationFailureMode: String(
                this.graphQueryBackendFactoryOptions.localVectorAccelerationFailureMode || 'fail_open'
            ).trim(),
            configuredVectorAccelerationRepresentationStrict:
                this.graphQueryBackendFactoryOptions.localVectorAccelerationRepresentationStrict === true,
        };
    }

    public async updateQueryBackendConfig(request: any = {}): Promise<any> {
        await this.ensureHydrated();
        const previousConfig = this.getQueryBackendConfig();
        const nextBackend = normalizeGraphQueryBackendType(
            request.configuredBackend || request.backend || this.currentGraphQueryBackendType
        );
        const nextFactoryOptions: GraphQueryBackendFactoryOptions = {
            ...this.graphQueryBackendFactoryOptions,
            backend: nextBackend,
        };
        if ('localVectorIndexPath' in request) {
            nextFactoryOptions.localVectorIndexPath = isNonEmptyString(request.localVectorIndexPath)
                ? String(request.localVectorIndexPath).trim()
                : undefined;
        }
        if ('queryVectorAnnPrefilterEnabled' in request || 'localVectorAnnPrefilterEnabled' in request) {
            nextFactoryOptions.localVectorAnnPrefilterEnabled = (
                request.queryVectorAnnPrefilterEnabled ?? request.localVectorAnnPrefilterEnabled
            ) !== false;
        }
        if ('localVectorAccelerationAdapter' in request && request.localVectorAccelerationAdapter) {
            nextFactoryOptions.localVectorAccelerationAdapter = request.localVectorAccelerationAdapter;
        }
        if ('configuredVectorAccelerationFailureMode' in request || 'localVectorAccelerationFailureMode' in request) {
            nextFactoryOptions.localVectorAccelerationFailureMode =
                request.configuredVectorAccelerationFailureMode ?? request.localVectorAccelerationFailureMode;
        }
        if (
            'configuredVectorAccelerationRepresentationStrict' in request
            || 'localVectorAccelerationRepresentationStrict' in request
        ) {
            nextFactoryOptions.localVectorAccelerationRepresentationStrict = (
                request.configuredVectorAccelerationRepresentationStrict
                ?? request.localVectorAccelerationRepresentationStrict
            ) === true;
        }
        this.currentGraphQueryBackendType = nextBackend;
        this.graphQueryBackendFactoryOptions = nextFactoryOptions;
        this.graphQueryBackend = createGraphQueryBackend(nextFactoryOptions);
        this.queryBackendLastError = '';
        return {
            updated: true,
            updatedAt: this.resolveTimestamp(undefined),
            previousConfig,
            queryBackendConfig: this.getQueryBackendConfig(),
        };
    }

    public getQueryBackendDiagnostics(): any {
        const runtime = this.graphQueryBackend.getDiagnostics
            ? this.graphQueryBackend.getDiagnostics()
            : {
                backendId: this.graphQueryBackend.id,
                ready: true,
            };
        const comparisonHistory = this.queryBackendComparisonHistoryRecords.slice(0, 20);
        const preferredCounts = comparisonHistory.reduce((accumulator, record) => {
            accumulator[record.summary.preferredBackend] += 1;
            return accumulator;
        }, { left: 0, right: 0, tie: 0 });
        const totalComparisons = comparisonHistory.length;
        const averageMetric = (selector: (record: QueryBackendComparisonRecord) => number): number => (
            totalComparisons > 0
                ? Number((comparisonHistory.reduce((sum, record) => sum + selector(record), 0) / totalComparisons).toFixed(4))
                : 0
        );
        const config = this.getQueryBackendConfig();
        return {
            backendId: runtime.backendId || this.graphQueryBackend.id,
            configuredBackend: config.configuredBackend,
            fallbackCount: this.queryBackendFallbackCount,
            fallbackBackendId: 'local-hybrid-v1',
            lastError: this.queryBackendLastError || runtime.lastError || '',
            runtime,
            comparisonTelemetry: {
                totalComparisons,
                averageOverlapRatioPct: averageMetric((record) => record.summary.overlapRatioPct),
                averageLatencyDeltaMs: averageMetric((record) => record.summary.latencyDeltaMs),
                averageLeftEvidenceCoverageRatio: averageMetric((record) => record.summary.leftEvidenceCoverageRatio),
                averageRightEvidenceCoverageRatio: averageMetric((record) => record.summary.rightEvidenceCoverageRatio),
                leftPreferredCount: preferredCounts.left,
                rightPreferredCount: preferredCounts.right,
                tieCount: preferredCounts.tie,
                latestComparedAt: comparisonHistory[0]?.comparedAt || null,
            },
            queryVectorAnnPrefilterEnabled: config.queryVectorAnnPrefilterEnabled,
            configuredVectorAccelerationProvider: config.configuredVectorAccelerationProvider,
            configuredVectorAccelerationFailureMode: config.configuredVectorAccelerationFailureMode,
            configuredVectorAccelerationRepresentationStrict: config.configuredVectorAccelerationRepresentationStrict,
            rolloutMode: this.currentGraphQueryBackendType,
        };
    }
    public getStudySessionOrchestrationTrendRuntimeConfig(): any {
        return {
            ...this.studySessionOrchestrationTrendRuntimeConfig,
        };
    }
    public getStudySessionOrchestrationMemorySignalConfig(): any {
        return {
            ...this.studySessionOrchestrationMemorySignalConfig,
        };
    }
    public getStudySessionOrchestrationTutorRoutingConfig(): any {
        return {
            ...this.studySessionOrchestrationTutorRoutingConfig,
        };
    }
    public async updateStudySessionOrchestrationConfig(_r: any): Promise<any> { return { updated: true }; }

    private readPackageScripts(): Record<string, unknown> {
        const packagePath = path.resolve(process.cwd(), 'package.json');
        try {
            const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, unknown> };
            return parsed.scripts && typeof parsed.scripts === 'object' ? parsed.scripts : {};
        } catch {
            return {};
        }
    }

    private buildFoundationQueryBackendScoreSignals(configuredBackend: string): string[] {
        if (configuredBackend === 'keyword_only') {
            return ['keyword_matches', 'title_match_bonus', 'content_match_bonus'];
        }
        if (configuredBackend === 'local_vector') {
            return ['vector_ann_similarity_bonus', 'semantic_similarity_bonus', 'relation_bonus'];
        }
        return ['keyword_matches', 'title_match_bonus', 'vector_ann_similarity_bonus', 'relation_bonus'];
    }

    private resolveFoundationVectorSignal(queryBackendDiagnostics: Record<string, unknown>): {
        status: string;
        signalKind: string;
        independent: boolean;
        linkedIntoQueryBackend: boolean;
        modulePresent: boolean;
    } {
        const configuredProvider = String(
            queryBackendDiagnostics.configuredVectorAccelerationProvider
            || this.graphQueryBackendFactoryOptions.localVectorAccelerationAdapter
            || 'local'
        ).trim().toLowerCase();
        const configuredBackend = String(queryBackendDiagnostics.configuredBackend || this.currentGraphQueryBackendType).trim();
        const runtime = (
            queryBackendDiagnostics.runtime
            && typeof queryBackendDiagnostics.runtime === 'object'
        ) ? queryBackendDiagnostics.runtime as Record<string, unknown> : {};
        const vectorIndex = (
            runtime.vectorIndex
            && typeof runtime.vectorIndex === 'object'
        ) ? runtime.vectorIndex as Record<string, unknown> : {};
        const acceleration = (
            vectorIndex.acceleration
            && typeof vectorIndex.acceleration === 'object'
        ) ? vectorIndex.acceleration as Record<string, unknown> : {};
        const linkedIntoQueryBackend = configuredBackend === 'local_hybrid' || configuredBackend === 'local_vector';
        if (configuredProvider === 'external_http' || configuredProvider === 'http') {
            return {
                status: String(acceleration.healthStatus || 'degraded').trim() || 'degraded',
                signalKind: 'service_ann',
                independent: String(acceleration.healthStatus || '').trim().toLowerCase() === 'ready',
                linkedIntoQueryBackend,
                modulePresent: true,
            };
        }
        if (configuredProvider === 'external_stub' || configuredProvider === 'stub') {
            return {
                status: 'scaffolded',
                signalKind: 'stub_ann',
                independent: false,
                linkedIntoQueryBackend,
                modulePresent: true,
            };
        }
        return {
            status: linkedIntoQueryBackend ? 'independent' : 'available',
            signalKind: 'embedding_ann',
            independent: linkedIntoQueryBackend,
            linkedIntoQueryBackend,
            modulePresent: true,
        };
    }

    private async buildFoundationReadinessPayload(): Promise<any> {
        await this.ensureHydrated();
        const evaluatedAt = this.resolveTimestamp(undefined);
        const storeDiagnostics = await this.getStoreDiagnostics();
        const queryBackendConfig = this.getQueryBackendConfig();
        const queryBackendDiagnostics = this.getQueryBackendDiagnostics();
        const packageScripts = this.readPackageScripts();
        const repoRoot = path.resolve(process.cwd());
        const docsPresence = {
            checklistPagesPresent: fs.existsSync(path.join(repoRoot, 'docs', 'en', 'TODO.md'))
                && fs.existsSync(path.join(repoRoot, 'docs', 'zh', 'TODO.md')),
            dashboardReferencesPresent: fs.existsSync(path.join(repoRoot, 'docs', 'diataxis', 'en', 'explanation', 'development-progress-dashboard.md'))
                && fs.existsSync(path.join(repoRoot, 'docs', 'diataxis', 'zh', 'explanation', 'development-progress-dashboard.md')),
        };
        const readinessVerifierPresent = Boolean(packageScripts['verify:agent-workspace:runtime']);
        const storageEngine = String(
            (storeDiagnostics as Record<string, unknown>).storageEngine
            || (
                String(storeDiagnostics.location || '').trim().toLowerCase().endsWith('.sqlite')
                    ? 'sqlite'
                    : ''
            )
        ).trim().toLowerCase();
        const fallbackStoreType = String((storeDiagnostics as Record<string, unknown>).fallbackStoreType || '').trim().toLowerCase();
        const usingFallback = storeDiagnostics.usingFallback === true;
        const configuredBackend = String(queryBackendConfig.configuredBackend || this.currentGraphQueryBackendType).trim();
        const vectorSignal = this.resolveFoundationVectorSignal(queryBackendDiagnostics);
        const baselineStoreType = storageEngine === 'sqlite'
            ? 'sqlite'
            : (usingFallback && fallbackStoreType ? fallbackStoreType : String(storeDiagnostics.storeType || 'none'));
        const graphBackendSignalKind = storageEngine === 'sqlite'
            ? 'embedded_graphdb'
            : String(storeDiagnostics.location || '').trim().toLowerCase().startsWith('http')
                ? 'service_graphdb'
                : 'file_snapshot';
        const graphBackendIndependent = (
            String(storeDiagnostics.storeType || '').trim() === 'graphdb'
            && !usingFallback
            && storageEngine === 'sqlite'
        ) || (
            String(storeDiagnostics.storeType || '').trim() === 'graphdb'
            && !usingFallback
            && graphBackendSignalKind === 'service_graphdb'
            && storeDiagnostics.backendReady !== false
        );
        const graphBackendStatus = graphBackendIndependent
            ? 'independent'
            : usingFallback
                ? 'fallback'
                : String(storeDiagnostics.storeType || '').trim() === 'graphdb'
                    ? 'provisioned'
                    : 'file_backed';
        const baseline = {
            storeType: baselineStoreType,
            exists: Boolean(storeDiagnostics.exists),
            loaded: Boolean(storeDiagnostics.loaded),
            fileBackedStore: baselineStoreType === 'file',
            graphBackendStatus,
            graphBackendSignalKind,
            graphBackendIndependent,
            graphAdapterModulePresent: String(storeDiagnostics.storeType || '').trim() === 'graphdb' || storageEngine === 'sqlite',
            queryBackendDefaultMode: configuredBackend,
            queryBackendScoreSignals: this.buildFoundationQueryBackendScoreSignals(configuredBackend),
            vectorAdapterModulePresent: vectorSignal.modulePresent,
            vectorAdapterStatus: vectorSignal.status,
            vectorAdapterSignalKind: vectorSignal.signalKind,
            vectorAdapterIndependent: vectorSignal.independent,
            vectorAdapterLinkedIntoQueryBackend: vectorSignal.linkedIntoQueryBackend,
        };
        const promotionCriteria = [
            {
                criterionId: 'store_backend_evidence_present',
                satisfied: baseline.exists || baseline.loaded,
                summary: baseline.exists || baseline.loaded
                    ? 'Store backend evidence is present in the repository baseline.'
                    : 'Store backend evidence is missing from the current runtime baseline.',
            },
            {
                criterionId: 'graph_backend_independent',
                satisfied: baseline.graphBackendIndependent,
                summary: baseline.graphBackendIndependent
                    ? 'Graph backend resolves to independent graph semantics.'
                    : 'Graph backend still falls back to file-backed semantics.',
            },
            {
                criterionId: 'query_backend_boundary_present',
                satisfied: configuredBackend.length > 0,
                summary: configuredBackend.length > 0
                    ? 'Dedicated query backend boundary is present.'
                    : 'Query backend boundary is not configured.',
            },
            {
                criterionId: 'vector_backend_present',
                satisfied: vectorSignal.modulePresent,
                summary: vectorSignal.modulePresent
                    ? 'Dedicated vector adapter boundary is present.'
                    : 'Vector adapter boundary is missing.',
            },
            {
                criterionId: 'vector_backend_independent',
                satisfied: vectorSignal.independent,
                summary: vectorSignal.independent
                    ? 'Vector backend resolves to independent ANN semantics.'
                    : 'Vector backend still resolves to scaffolded or fallback semantics.',
            },
            {
                criterionId: 'docs_aligned',
                satisfied: docsPresence.checklistPagesPresent && docsPresence.dashboardReferencesPresent,
                summary: docsPresence.checklistPagesPresent && docsPresence.dashboardReferencesPresent
                    ? 'EN/ZH checklist and dashboard references are aligned.'
                    : 'Bilingual checklist/dashboard references are incomplete.',
            },
            {
                criterionId: 'readiness_verifier_present',
                satisfied: readinessVerifierPresent,
                summary: readinessVerifierPresent
                    ? 'Readiness verifier command is present in package scripts.'
                    : 'Readiness verifier command is missing from package scripts.',
            },
        ];
        const promotionCriteriaSatisfiedIds = promotionCriteria
            .filter((entry) => entry.satisfied)
            .map((entry) => entry.criterionId);
        const promotionCriteriaUnsatisfiedIds = promotionCriteria
            .filter((entry) => !entry.satisfied)
            .map((entry) => entry.criterionId);
        const promotionBlockers = promotionCriteria
            .filter((entry) => !entry.satisfied)
            .map((entry) => ({
                blockerId: entry.criterionId,
                summary: entry.summary,
            }));
        const promotionCriteriaPassed = promotionCriteriaSatisfiedIds.length;
        const promotionCriteriaTotal = promotionCriteria.length;
        const status = promotionBlockers.length <= 0
            ? 'integrated'
            : graphBackendIndependent || vectorSignal.independent
                ? 'transitional'
                : 'partial';
        const decision = promotionBlockers.length <= 0 ? 'go' : 'hold';
        return {
            evaluatedAt,
            status,
            decision,
            baseline,
            documents: docsPresence,
            packageScripts: {
                readinessVerifierPresent,
            },
            provenance: {
                repoRootSource: 'cwd',
                runtimeProjectRootAligned: fs.existsSync(path.join(repoRoot, 'src')) && fs.existsSync(path.join(repoRoot, 'docs')),
            },
            promotionCriteriaPassed,
            promotionCriteriaTotal,
            promotionCriteriaSatisfiedIds,
            promotionCriteriaUnsatisfiedIds,
            promotionCriteria,
            mandatoryChecks: [
                {
                    gateId: 'contract',
                    command: 'node node_modules/jest/bin/jest.js src/knowledge.api.contract.test.ts --runInBand --no-cache',
                },
                {
                    gateId: 'core_behavior',
                    command: 'node node_modules/jest/bin/jest.js src/learning/KnowledgeLearningPlatform.test.ts --runInBand --no-cache',
                },
                {
                    gateId: 'persistence_safety',
                    command: 'node node_modules/jest/bin/jest.js src/learning/store.test.ts --runInBand --no-cache',
                },
                {
                    gateId: 'interaction_non_regression',
                    command: 'npm run test:agent-workspace:contracts',
                },
                {
                    gateId: 'foundation_runtime_proof',
                    command: 'npm run verify:foundation:sqlite-runtime',
                },
                {
                    gateId: 'foundation_runtime_heavy_proof',
                    command: 'npm run verify:foundation:sqlite-runtime:heavy',
                },
                {
                    gateId: 'foundation_runtime_matrix_proof',
                    command: 'npm run verify:foundation:sqlite-runtime:matrix',
                },
                {
                    gateId: 'foundation_runtime_release_proof',
                    command: 'npm run verify:foundation:sqlite-runtime:release',
                },
                {
                    gateId: 'vector_runtime_proof',
                    command: 'npm run verify:foundation:ann-runtime',
                },
                {
                    gateId: 'vector_runtime_matrix_proof',
                    command: 'npm run verify:foundation:ann-runtime:matrix',
                },
                {
                    gateId: 'vector_runtime_release_proof',
                    command: 'npm run verify:foundation:ann-runtime:release',
                },
                {
                    gateId: 'foundation_release_evidence_freshness',
                    command: 'npm run verify:foundation:release-evidence',
                },
                {
                    gateId: 'foundation_release_evidence_history',
                    command: 'npm run verify:foundation:release-evidence:strict',
                },
                {
                    gateId: 'documentation',
                    command: 'npm run docs:diataxis:check && npm run docs:site:build',
                },
            ],
            promotionBlockers,
            recommendations: promotionBlockers.length <= 0
                ? ['Keep mandatory foundation gates green and preserve anti-overclaim wording while adapter depth evolves.']
                : promotionBlockers.map((entry) => `Resolve ${entry.blockerId}: ${entry.summary}`),
            modules: {
                knowledgeGraph: {
                    status: graphBackendStatus,
                    backend: baseline.storeType,
                    signalKind: graphBackendSignalKind,
                },
                queryBackend: {
                    status: configuredBackend ? 'operational' : 'missing',
                    backend: configuredBackend || 'unknown',
                },
                vectorStore: {
                    status: vectorSignal.status,
                    index: vectorSignal.signalKind,
                },
                conversationMemory: { status: 'operational' },
                studySession: { status: 'operational' },
            },
            ready: promotionBlockers.length <= 0,
            checkedAt: evaluatedAt,
        };
    }

    public async getFoundationReadiness(): Promise<any> {
        return this.buildFoundationReadinessPayload();
    }
    public async getBackendBaselineSufficiency(): Promise<any> {
        const readiness = await this.buildFoundationReadinessPayload();
        const checks = {
            knowledgeGraph: {
                passed: Boolean(readiness.baseline?.graphBackendIndependent),
                reason: Boolean(readiness.baseline?.graphBackendIndependent)
                    ? String(readiness.baseline?.graphBackendSignalKind || 'embedded_graphdb')
                    : 'graph_backend_not_independent',
            },
            queryBackend: {
                passed: String(readiness.baseline?.queryBackendDefaultMode || '').trim().length > 0,
                reason: String(readiness.baseline?.queryBackendDefaultMode || '').trim().length > 0
                    ? 'local_query_backend_available'
                    : 'query_backend_missing',
            },
            vectorIndex: {
                passed: Boolean(readiness.baseline?.vectorAdapterIndependent),
                reason: Boolean(readiness.baseline?.vectorAdapterIndependent)
                    ? String(readiness.baseline?.vectorAdapterSignalKind || 'embedding_ann')
                    : 'vector_backend_not_independent',
            },
        };
        return {
            sufficient: checks.knowledgeGraph.passed && checks.queryBackend.passed && checks.vectorIndex.passed,
            checks,
            checkedAt: readiness.evaluatedAt,
        };
    }
}

export function createKnowledgeLearningPlatform(options: KnowledgeLearningPlatformOptions = {}): KnowledgeLearningPlatform {
    return new KnowledgeLearningPlatform(options);
}

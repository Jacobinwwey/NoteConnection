import type { WorkflowArtifactRecord } from '../workflows/types';

export type RelationKind =
    | 'prerequisite'
    | 'analogy'
    | 'contrast'
    | 'causal'
    | 'application'
    | 'reference'
    | 'sequence';

export type RelationProvenance = 'fact' | 'inferred';

export type TemporalEdgeKind = 'supersedes' | 'validity_window' | 'derived_from';

export type MasteryOutcome = 'correct' | 'incorrect' | 'partial' | 'skipped';

export type MasteryErrorTag =
    | 'concept_boundary'
    | 'causal_confusion'
    | 'prerequisite_gap'
    | 'evidence_mismatch'
    | 'retrieval_failure'
    | 'transfer_failure'
    | 'reasoning_jump'
    | 'incorrect_answer'
    | 'skipped'
    | 'other';

export type LearningActionKind =
    | 'quiz'
    | 'explain'
    | 'review'
    | 'transfer'
    | 'counterexample'
    | 'reflection';

export type TutorActionKind = 'generate_quiz' | 'analyze_answer' | 'follow_up' | 'recap' | 'generate_transfer' | 'generate_counterexample';

export type MemoryLayer = 'session' | 'unit' | 'long_term';

export type KnowledgeRepresentationType = 'text' | 'code' | 'formula' | 'mermaid';

export interface ErrorTagStat {
    tag: MasteryErrorTag | string;
    count: number;
    lastSeenAt: string;
}

export interface EvidenceSpan {
    id: string;
    documentId: string;
    sourcePath: string;
    language: string;
    startOffset: number;
    endOffset: number;
    startLine: number;
    endLine: number;
    snippet: string;
    sourceHash: string;
    createdAt: string;
}

export interface KnowledgeAtom {
    id: string;
    stableKey: string;
    documentId: string;
    sourcePath: string;
    title: string;
    content: string;
    representationType: KnowledgeRepresentationType;
    keywords: string[];
    evidenceSpanIds: string[];
    createdAt: string;
    updatedAt: string;
    metadata: {
        sectionPath: string[];
        version: number;
        sourceHash: string;
        language: string;
    };
}

export interface RelationEdge {
    id: string;
    sourceAtomId: string;
    targetAtomId: string;
    relationKind: RelationKind;
    provenance: RelationProvenance;
    confidence: number;
    evidenceSpanIds: string[];
    temporal: {
        validFrom: string;
        validTo?: string;
    };
}

export interface TemporalEdge {
    id: string;
    sourceAtomId: string;
    targetAtomId: string;
    edgeKind: TemporalEdgeKind;
    validFrom: string;
    validTo?: string;
    sourceDocumentHash: string;
    isActive: boolean;
}

export interface LearnerConceptState {
    userId: string;
    atomId: string;
    masteryProbability: number;
    reviewCount: number;
    correctCount: number;
    incorrectCount: number;
    partialCount: number;
    skippedCount: number;
    lastOutcome: MasteryOutcome | null;
    lastUpdatedAt: string;
    nextReviewAt: string;
    errorTags: string[];
    recentErrorTags: string[];
    errorTagStats: ErrorTagStat[];
}

export interface LearningAction {
    id: string;
    kind: LearningActionKind;
    atomId: string;
    priority: number;
    expectedGain: number;
    rationale: string;
    evidenceSpanIds: string[];
    relationPathAtomIds: string[];
    estimatedMinutes: number;
}

export interface TutorTrace {
    traceId: string;
    userId: string;
    actionKind: TutorActionKind;
    atomId?: string;
    createdAt: string;
    confidence: number;
    evidenceSpanIds: string[];
    relationPathAtomIds: string[];
    source: 'rule-engine' | 'llm-adapter';
    notes: string;
    adapterId?: string;
    providerName?: string;
    providerMode?: 'local' | 'cloud' | string;
    verificationStatus?: 'verified' | 'pending' | 'failed' | string;
    providerAttemptCount?: number;
    fallbackUsed?: boolean;
    failed?: boolean;
    errorMessage?: string;
}

export interface MasteryPath {
    id: string;
    targetAtomId: string;
    priority: number;
    expectedMasteryGain: number;
    actions: LearningAction[];
}

export interface DivergencePath {
    id: string;
    sourceAtomId: string;
    targetAtomId: string;
    priority: number;
    expectedExplorationGain: number;
    actions: LearningAction[];
}

export interface KnowledgeDocumentInput {
    documentId?: string;
    sourcePath: string;
    content: string;
    language?: string;
    updatedAt?: string;
    workspaceId?: string;
    corpusId?: string;
    exportProfileId?: string;
    metadata?: Record<string, unknown>;
}

export interface KnowledgeDocumentDeleteInput {
    documentId?: string;
    sourcePath?: string;
}

export type RelationRecomputeMode = 'auto' | 'none' | 'incremental' | 'full';

export type KnowledgeIngestOperation =
    | { op: 'upsert'; document: KnowledgeDocumentInput }
    | { op: 'delete'; document: KnowledgeDocumentDeleteInput };

export interface StalenessRecord {
    documentId: string;
    sourcePath: string;
    status: 'new' | 'unchanged' | 'updated' | 'deleted';
    previousHash?: string;
    currentHash: string;
    previousVersion?: number;
    currentVersion: number;
}

export interface KnowledgeIngestRequest {
    documents?: KnowledgeDocumentInput[];
    deletedDocuments?: KnowledgeDocumentDeleteInput[];
    operations?: KnowledgeIngestOperation[];
    incremental?: boolean;
    recomputeRelations?: boolean;
    relationRecomputeMode?: RelationRecomputeMode;
    ingestedAt?: string;
}

export interface KnowledgeIngestResponse {
    atoms: KnowledgeAtom[];
    evidenceSpans: EvidenceSpan[];
    relationEdges: RelationEdge[];
    temporalEdges: TemporalEdge[];
    staleness: StalenessRecord[];
    summary: {
        ingestedDocuments: number;
        changedDocuments: number;
        deletedDocuments: number;
        activeAtoms: number;
        activeRelationEdges: number;
        recomputedDynamicRelations: boolean;
        invalidatedRelationEdges: number;
        regeneratedRelationEdges: number;
        resolvedRelationRecomputeMode: Exclude<RelationRecomputeMode, 'auto'>;
        relationRecomputeLatencyMs: number;
    };
}

export interface KnowledgeQueryRequest {
    query: string;
    topK?: number;
    asOf?: string;
    queryBackend?: 'local_hybrid' | 'keyword_only' | 'local_vector' | string;
    scope?: KnowledgeCorpusScope;
}

export interface KnowledgeQueryItem {
    atom: KnowledgeAtom;
    score: number;
    evidenceSpans: EvidenceSpan[];
    relationPath: RelationEdge[];
    temporalValidity: {
        isValid: boolean;
        checkedAt: string;
        reasons: string[];
        details?: KnowledgeQueryTemporalDetail[];
    };
}

export interface KnowledgeQueryTemporalDetail {
    edgeId: string;
    edgeKind: TemporalEdgeKind;
    sourceAtomId: string;
    targetAtomId: string;
    validFrom: string;
    validTo?: string;
    isActive: boolean;
}

export interface KnowledgeCorpusScope {
    workspaceId?: string;
    corpusId?: string;
    documentIds?: string[];
    atomIds?: string[];
    sourcePathPrefixes?: string[];
    languages?: string[];
}

export interface KnowledgeQueryResolvedScope {
    source: 'global' | 'scoped';
    workspaceId: string | null;
    corpusId: string | null;
    documentIds: string[];
    atomIds: string[];
    sourcePathPrefixes: string[];
    languages: string[];
    matchedAtomCount: number;
    scopeSource?:
        | 'explicit_request'
        | 'active_workspace_target'
        | 'workspace_hydration'
        | 'planner_fallback'
        | 'planner_scope_recovery'
        | 'global_default';
    readiness?: {
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
    missDiagnostics?: {
        reason:
            | 'none'
            | 'empty_store'
            | 'workspace_not_found'
            | 'workspace_unbound'
            | 'scope_has_no_indexed_segments'
            | 'query_no_title_or_alias_hit'
            | 'retrieval_candidates_below_threshold';
        message: string;
        query: string;
        normalizedQuery: string;
        plannerQuery?: string;
        titleLikeQueries?: string[];
        titleHitDocumentIds?: string[];
        indexedScopeAtomCount?: number;
    };
}

export interface KnowledgeQueryModeWeights {
    keyword: number;
    graph: number;
    temporal: number;
    semantic?: number;
    vector?: number;
    memory?: number;
}

export interface KnowledgeCitation {
    citationId: string;
    atomId: string;
    documentId: string;
    sourcePath: string;
    title: string;
    snippet: string;
    startLine?: number;
    endLine?: number;
    score: number;
}

export interface KnowledgeQueryResponse {
    items: KnowledgeQueryItem[];
    trace: {
        retrievalModes: string[];
        asOf: string;
        totalActiveAtoms: number;
        totalAtomsInScope?: number;
        scope?: KnowledgeQueryResolvedScope;
        modeWeights: KnowledgeQueryModeWeights;
        latencyMs: number;
        evidenceCoverageRatio: number;
        planner?: {
            plannerQuery: string | null;
            titleLikeQueries: string[];
            titleHitDocumentIds: string[];
        };
        scopeRecovery?: {
            reason: 'title_like_document_hit_outside_requested_scope';
            requestedScope: KnowledgeQueryResolvedScope;
            recoveredDocumentIds: string[];
            recoveredSourcePaths: string[];
        };
    };
}

export interface MasteryObservation {
    atomId: string;
    outcome: MasteryOutcome;
    errorTag?: MasteryErrorTag | string;
    errorTags?: Array<MasteryErrorTag | string>;
    responseTimeMs?: number;
    confidence?: number;
}

export interface MasteryDiagnosticsRequest {
    userId: string;
    observations: MasteryObservation[];
    observedAt?: string;
}

export interface MasteryDiagnosticsResponse {
    updatedStates: LearnerConceptState[];
    summary: {
        updatedCount: number;
        averageMasteryBefore: number;
        averageMasteryAfter: number;
    };
}

export interface MasteryMisconceptionRequest {
    userId: string;
    atomIds?: string[];
    topK?: number;
    generatedAt?: string;
}

export interface MasteryMisconceptionItem {
    errorTag: MasteryErrorTag | string;
    count: number;
    affectedAtomIds: string[];
    averageMasteryProbability: number;
    severityScore: number;
    lastSeenAt: string;
    recommendedActionKinds: LearningActionKind[];
}

export interface MasteryMisconceptionResponse {
    userId: string;
    generatedAt: string;
    items: MasteryMisconceptionItem[];
    summary: {
        trackedTags: number;
        totalObservations: number;
    };
}

export interface LearningPathRequest {
    userId: string;
    focusAtomIds?: string[];
    maxMasteryPaths?: number;
    maxDivergencePaths?: number;
    generatedAt?: string;
    strategy?: 'foundational' | 'core' | string;
    recommendedActionLimit?: number;
}

export interface LearningPathResponse {
    masteryPaths: MasteryPath[];
    divergencePaths: DivergencePath[];
    recommendedActions: LearningAction[];
}

export type StudySessionActionSource =
    | 'mastery_path'
    | 'divergence_path'
    | 'retrain_plan'
    | 'misconception_remediation'
    | 'flashcard_batch';

export type StudySessionExecutionKind = 'session' | 'retest' | 'custom';

export interface StudySessionRequest {
    userId: string;
    sessionId?: string;
    focusAtomIds?: string[];
    maxActions?: number;
    includeDivergence?: boolean;
    includeRetrain?: boolean;
    generatedAt?: string;
    pathStrategy?: string;
    pathRecommendedActionLimit?: number;
}

export interface StudySessionAction extends LearningAction {
    source: StudySessionActionSource;
    errorTag?: MasteryErrorTag | string;
}

export interface StudySessionResponse {
    userId: string;
    sessionId?: string;
    generatedAt: string;
    actions: StudySessionAction[];
    signals: {
        misconceptions: MasteryMisconceptionItem[];
        dueRetrainAtoms: string[];
        masteryPathTargets: string[];
        divergenceTargets: string[];
    };
    summary: {
        totalActions: number;
        totalEstimatedMinutes: number;
        evidenceCoverageRatio: number;
    };
}

export interface StudySessionActionExecutionRequest {
    userId: string;
    sessionId?: string;
    action: {
        atomId: string;
        kind: LearningActionKind;
        source?: StudySessionActionSource;
        prompt?: string;
        answer?: string;
    };
    outcome?: MasteryOutcome;
    errorTag?: MasteryErrorTag | string;
    autoAnalyzeAnswer?: boolean;
    autoUpdateMasteryFromAnswer?: boolean;
    executedAt?: string;
    persistMemory?: boolean;
    memoryLayer?: MemoryLayer;
    tutorAdapterId?: string;
    tutorProviderName?: string;
    tutorProviderMode?: string;
    autoPromoteMemory?: boolean;
    promoteMemoryTargetLayer?: MemoryLayer;
    promoteMemoryMinConfidence?: number;
    promoteMemoryRemoveFromSource?: boolean;
}

export interface StudySessionActionExecutionResponse {
    sessionId?: string;
    executedAt: string;
    tutor: TutorActionResponse;
    answerAnalysis: TutorActionResponse | null;
    memory: MemoryPolicyResponse | null;
    promotedMemory: MemoryPolicyResponse | null;
    mastery: MasteryDiagnosticsResponse | null;
    trace: {
        tutorActionKind: TutorActionKind;
        persistedMemory: boolean;
        updatedMastery: boolean;
        analyzedAnswer: boolean;
        masterySource: 'explicit' | 'inferred' | 'none';
        effectiveOutcome: MasteryOutcome | null;
        effectiveErrorTag: MasteryErrorTag | string | null;
    };
}

export interface WorkflowArtifactReviewFollowUpRequest {
    userId: string;
    sessionId?: string;
    artifactId: string;
    cardId: string;
    action?: {
        atomId?: string;
        kind?: LearningActionKind;
        source?: StudySessionActionSource;
        prompt?: string;
        answer?: string;
    };
    outcome?: MasteryOutcome;
    errorTag?: MasteryErrorTag | string;
    autoAnalyzeAnswer?: boolean;
    autoUpdateMasteryFromAnswer?: boolean;
    executedAt?: string;
    persistMemory?: boolean;
    memoryLayer?: MemoryLayer;
    tutorAdapterId?: string;
    tutorProviderName?: string;
    tutorProviderMode?: string;
    autoPromoteMemory?: boolean;
    promoteMemoryTargetLayer?: MemoryLayer;
    promoteMemoryMinConfidence?: number;
    promoteMemoryRemoveFromSource?: boolean;
}

export interface WorkflowArtifactReviewFollowUpResponse {
    artifact: WorkflowArtifactRecord;
    relatedKnowledgeRunArtifact: WorkflowArtifactRecord | null;
    studySessionAction: StudySessionActionExecutionResponse;
    consumedCardId: string;
    completedReviewCardCount: number;
    remainingReviewCardCount: number;
    archivedArtifact: boolean;
}

export interface StudySessionPlanExecutionRequest {
    userId: string;
    sessionId?: string;
    executionKind?: StudySessionExecutionKind;
    focusAtomIds?: string[];
    maxActions?: number;
    includeDivergence?: boolean;
    includeRetrain?: boolean;
    sessionPlan?: StudySessionResponse;
    actionLimit?: number;
    answersByActionId?: Record<string, string>;
    answersByAtomId?: Record<string, string>;
    autoAnalyzeAnswer?: boolean;
    autoUpdateMasteryFromAnswer?: boolean;
    includeRetestPlan?: boolean;
    retestActionLimit?: number;
    persistMemory?: boolean;
    memoryLayer?: MemoryLayer;
    stopOnError?: boolean;
    executedAt?: string;
    tutorAdapterId?: string;
    tutorProviderName?: string;
    tutorProviderMode?: string;
    pathStrategy?: string;
    pathRecommendedActionLimit?: number;
    autoPromoteMemory?: boolean;
    promoteMemoryTargetLayer?: MemoryLayer;
    promoteMemoryMinConfidence?: number;
    promoteMemoryRemoveFromSource?: boolean;
}

export interface StudySessionPlanExecutionItem {
    action: StudySessionAction;
    status: 'executed' | 'skipped' | 'failed';
    reason?: string;
    result?: StudySessionActionExecutionResponse | null;
    error?: string;
}

export interface StudySessionMasteryDeltaItem {
    atomId: string;
    title: string;
    beforeMastery: number;
    afterMastery: number;
    deltaMastery: number;
    updatedByExecution: boolean;
    lastOutcome: MasteryOutcome | null;
}

export interface StudySessionExecutionRecord {
    id: string;
    userId: string;
    executionKind: StudySessionExecutionKind;
    executedAt: string;
    focusAtomIds: string[];
    plannedActions: number;
    attemptedActions: number;
    executedCount: number;
    updatedMasteryCount: number;
    inferredMasteryCount: number;
    explicitMasteryCount: number;
    analyzedAnswerCount: number;
    memoryPersistedCount: number;
    averageTutorConfidence: number;
    averageMasteryDelta: number;
    improvedAtomCount: number;
    regressedAtomCount: number;
    unchangedAtomCount: number;
    retestActions: number;
    stoppedEarly: boolean;
}

export interface StudySessionHistoryRequest {
    userId: string;
    limit?: number;
    offset?: number;
    executionKinds?: StudySessionExecutionKind[];
    fromExecutedAt?: string;
    toExecutedAt?: string;
    pathStrategySelectionSource?: string;
    refreshSource?: string;
    sinceMinutes?: number;
    pathStrategy?: string;
}

export interface StudySessionHistoryKindSummaryItem {
    executionKind: StudySessionExecutionKind;
    recordCount: number;
    totalExecutedActions: number;
    averageMasteryDelta: number;
}

export interface StudySessionHistoryResponse {
    userId: string;
    generatedAt: string;
    records: StudySessionExecutionRecord[];
    page: {
        limit: number;
        offset: number;
        returnedRecords: number;
        totalFilteredRecords: number;
        hasMore: boolean;
        nextOffset: number | null;
    };
    summary: {
        totalRecords: number;
        totalExecutedActions: number;
        totalUpdatedMasteryCount: number;
        averageMasteryDelta: number;
        averageTutorConfidence: number;
        executionKindBreakdown: StudySessionHistoryKindSummaryItem[];
    };
}

export interface StudySessionPlanExecutionResponse {
    userId: string;
    sessionId?: string;
    executedAt: string;
    sessionPlan: StudySessionResponse;
    items: StudySessionPlanExecutionItem[];
    summary: {
        plannedActions: number;
        attemptedActions: number;
        executedCount: number;
        skippedCount: number;
        failedCount: number;
        updatedMasteryCount: number;
        inferredMasteryCount: number;
        explicitMasteryCount: number;
        analyzedAnswerCount: number;
        memoryPersistedCount: number;
        totalEstimatedMinutes: number;
        averageTutorConfidence: number;
        averageMasteryBefore: number;
        averageMasteryAfter: number;
        averageMasteryDelta: number;
        improvedAtomCount: number;
        regressedAtomCount: number;
        unchangedAtomCount: number;
        stoppedEarly: boolean;
    };
    masteryDelta: {
        comparedAtoms: number;
        averageBefore: number;
        averageAfter: number;
        averageDelta: number;
        improvedCount: number;
        regressedCount: number;
        unchangedCount: number;
        items: StudySessionMasteryDeltaItem[];
    };
    retestPlan: {
        generatedAt: string;
        actions: StudySessionAction[];
        summary: {
            totalActions: number;
            targetAtoms: string[];
        };
    };
    record: StudySessionExecutionRecord;
}

export interface TutorActionRequest {
    userId: string;
    actionKind: TutorActionKind;
    atomId?: string;
    prompt?: string;
    answer?: string;
    adapterId?: string;
    providerName?: string;
    providerMode?: string;
}

export interface TutorActionResponse {
    message: string;
    suggestedActions: LearningAction[];
    evidenceSpans: EvidenceSpan[];
    trace: TutorTrace;
}

export interface MemoryEntry {
    key: string;
    value: string;
    tags: string[];
    confidence: number;
    references: string[];
    memoryType?: string;
    memoryPurpose?: string;
    classificationConfidence?: number;
    scopeWorkspaceId?: string;
    scopeCorpusId?: string;
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
}

export interface MemoryPolicyRequest {
    userId: string;
    operation: 'write' | 'read' | 'evict' | 'snapshot' | 'retrain_plan' | 'promote';
    layer: MemoryLayer;
    targetLayer?: MemoryLayer;
    entries?: MemoryEntry[];
    query?: string;
    limit?: number;
    now?: string;
    minConfidence?: number;
    includeExpired?: boolean;
    removeFromSource?: boolean;
}

export interface MemoryPolicyResponse {
    layer: MemoryLayer;
    operation: 'write' | 'read' | 'evict' | 'snapshot' | 'retrain_plan' | 'promote';
    entries: MemoryEntry[];
    evictedCount: number;
    recommendedActions?: LearningAction[];
    stats: {
        session: number;
        unit: number;
        longTerm: number;
    };
}

export interface KnowledgeSystemState {
    documents: number;
    activeAtoms: number;
    activeRelationEdges: number;
    temporalEdges: number;
    masteryStates: number;
    tutorTraces: number;
    ingestTelemetry: {
        ingestCount: number;
        ingestP95Ms: number;
        ingestAverageMs: number;
        ingestMaxMs: number;
        recomputeCount: number;
        recomputeP95Ms: number;
        recomputeAverageMs: number;
        recomputeMaxMs: number;
    };
    retrievalTelemetry: {
        queryCount: number;
        queryP95Ms: number;
        queryAverageMs: number;
        queryMaxMs: number;
        queryEvidenceCoverageRatioPct?: number;
        queryRelationPathCoverageRatioPct?: number;
        queryTemporalValidityPassRatioPct?: number;
        queryAverageEvidenceSpanCount?: number;
        queryAverageRelationPathLength?: number;
        queryExplainabilitySampleCount?: number;
    };
    sessionActionTelemetry: {
        executionCount: number;
        analyzedAnswerCount: number;
        inferredMasteryUpdateCount: number;
        explicitMasteryUpdateCount: number;
        memoryPersistedCount: number;
        memoryPromotionCount?: number;
        memoryPromotionAppliedCount?: number;
        verifiedTutorCount?: number;
        pendingVerificationCount?: number;
        outcomeCounts: {
            correct: number;
            partial: number;
            incorrect: number;
            skipped: number;
        };
    };
    sessionExecutionHistoryRecords: number;
    memoryEntries: {
        session: number;
        unit: number;
        longTerm: number;
    };
    sessionStrategyTelemetry?: {
        totalSessions: number;
        totalRecords?: number;
        strategyBreakdown?: Record<string, number>;
        strategyRecords?: number;
        selectionSourceCounts?: Record<string, number>;
        selectionSourcePositiveRatioPct?: Record<string, number>;
        selectionSourceAverageMasteryDeltaPct?: Record<string, number>;
        modeFallbackSelectionSharePct?: number;
        trendAutoSelectionSharePct?: number;
        trendAutoNegativeRatioPct?: number;
        trendAutoAverageMasteryDeltaPct?: number;
    };
    tutorAdapterTelemetry?: {
        activeAdapterCount: number;
        providerUsage?: Record<string, number>;
        lastRoutingStrategy?: string;
        lastRoutingReason?: string;
        lastRoutingScore?: number;
        lastRoutingDynamicPreferredMode?: string;
        lastRoutingDynamicModeReason?: string;
    };
}

export interface LearningQualitySnapshot {
    retestPassRatePct: number;
    misconceptionRecurrenceRatePct: number;
    evidenceBackedSuggestionRatioPct: number;
    averagePathMasteryGainPct: number;
    randomPathMasteryGainPct: number;
    historyWindowDays?: number;
    historyWindowRecords?: number;
    historyWindowAverageMasteryDelta?: number;
    historyWindowRetestPositiveDeltaRatePct?: number;
    queryP95Ms?: number;
    pathStrategyExecutionCoveragePct?: number;
    pathStrategyAverageMasteryDeltaPct?: number;
    queryEvidenceCoverageRatioPct?: number;
    queryRelationPathCoverageRatioPct?: number;
    queryTemporalValidityPassRatioPct?: number;
    pendingVerificationRatioPct?: number;
    queryBackendFallbackRatioPct?: number;
    sessionMemoryPromotionCoveragePct?: number;
}

export interface LearningQualitySnapshotRequest {
    userId?: string;
    sampledAt?: string;
    historyWindowDays?: number;
}

export interface LearningQualityBaselineGetRequest {
    userId: string;
}

export interface LearningQualityBaselineSetRequest {
    userId: string;
    snapshot: LearningQualitySnapshot;
    storedAt?: string;
}

export interface LearningQualityBaselineClearRequest {
    userId: string;
}

export interface LearningQualityBaselineResponse {
    userId: string;
    found: boolean;
    storedAt: string | null;
    snapshot: LearningQualitySnapshot | null;
}

export interface LearningQualityBaselineEvaluateRequest {
    userId: string;
    current?: LearningQualitySnapshot;
    sampledAt?: string;
    historyWindowDays?: number;
    thresholds?: Partial<LearningQualityThresholds>;
}

export interface LearningQualityBaselineEvaluateResponse {
    userId: string;
    baseline: LearningQualityBaselineResponse;
    currentSnapshot: LearningQualitySnapshotResponse;
    evaluation: LearningQualityEvaluationResponse;
}

export interface LearningQualitySnapshotResponse {
    sampledAt: string;
    snapshot: LearningQualitySnapshot;
    diagnostics: {
        learnerStates: number;
        totalReviews: number;
        misconceptionEvents: number;
        evidenceBackedTutorTraces: number;
        totalTutorTraces: number;
        historyWindowRecords: number;
        historyWindowRetestRecords: number;
    };
}

export interface LearningQualityThresholds {
    retestPassRateUpliftPct: number;
    misconceptionRecurrenceReductionPct: number;
    evidenceBackedSuggestionRatioPct: number;
    pathEffectivenessLiftPct: number;
    historyWindowAverageMasteryDeltaUplift: number;
    queryP95Ms: number;
    maxQueryBackendFallbackRatioPct?: number;
    minQueryEvidenceCoverageRatioPct?: number;
    minQueryRelationPathCoverageRatioPct?: number;
    minQueryTemporalValidityPassRatioPct?: number;
    minSessionMemoryPromotionCoveragePct?: number;
    maxPendingVerificationRatioPct?: number;
}

export interface LearningQualityEvaluationRequest {
    baseline: LearningQualitySnapshot;
    current: LearningQualitySnapshot;
    thresholds?: Partial<LearningQualityThresholds>;
    evaluatedAt?: string;
}

export interface LearningQualityGateResult {
    gateId:
    | 'retest_pass_rate_uplift'
    | 'misconception_reduction'
    | 'evidence_ratio'
    | 'path_effectiveness'
    | 'history_mastery_delta_uplift'
    | 'query_p95';
    passed: boolean;
    comparator: '>=' | '<=';
    observedValue: number;
    threshold: number;
    unit: 'pct' | 'ms';
    message: string;
}

export interface LearningQualityEvaluationResponse {
    evaluatedAt: string;
    thresholds: LearningQualityThresholds;
    baseline: LearningQualitySnapshot;
    current: LearningQualitySnapshot;
    deltas: {
        retestPassRateUpliftPct: number;
        misconceptionRecurrenceReductionPct: number;
        pathEffectivenessLiftPct: number;
        historyWindowAverageMasteryDeltaUplift: number;
    };
    gates: LearningQualityGateResult[];
    overallPassed: boolean;
}

export interface IngestGuardrailThresholds {
    maxChangedDocuments: number;
    maxDeletedDocuments: number;
    maxActiveAtoms: number;
    maxIngestP95Ms: number;
    maxRecomputeP95Ms: number;
}

export interface IngestGuardrailEvaluationRequest {
    thresholds?: Partial<IngestGuardrailThresholds>;
    evaluatedAt?: string;
}

export interface IngestGuardrailGateResult {
    gateId: 'changed_documents' | 'deleted_documents' | 'active_atoms' | 'ingest_p95' | 'recompute_p95';
    passed: boolean;
    comparator: '<=' | '>=';
    observedValue: number;
    threshold: number;
    unit: 'count' | 'ms';
    message: string;
}

export interface IngestGuardrailEvaluationResponse {
    evaluatedAt: string;
    thresholds: IngestGuardrailThresholds;
    latestSummary: KnowledgeIngestResponse['summary'] | null;
    gates: IngestGuardrailGateResult[];
    overallPassed: boolean;
}

// ── M8-M10 type aliases (pending full stabilization) ──

export type KnowledgeQueryBackendDiagnostics = any;
export type KnowledgeStalenessDiagnosticsRequest = any;
export type KnowledgeStalenessDiagnosticsResponse = any;
export type KnowledgeStalenessRebuildRequest = any;
export type KnowledgeQueryBackendComparisonRequest = any;
export type KnowledgeQueryBackendComparisonHistoryRequest = any;
export type KnowledgeQueryBackendComparisonTrendRequest = any;
export type KnowledgeQueryBackendConfigRequest = any;
export type TutorAdapterRoutingStrategy = any;
export type TutorTraceDiagnosticsRequest = any;
export type TutorProviderTrendDiagnosticsRequest = any;
export type TutorProviderTrendHistoryRequest = any;
export interface AgentConversationKnowledgePoint {
    atomId: string;
    atomIds?: string[];
    documentId?: string;
    sourcePath?: string;
    title: string;
    summary: string;
    evidenceSnippet: string;
    score: number;
    citation: KnowledgeCitation | null;
    citations?: KnowledgeCitation[];
    matchedSpans?: Array<{
        atomId: string;
        title: string;
        snippet: string;
        sourcePath: string;
        startLine?: number;
        endLine?: number;
        score: number;
        citation: KnowledgeCitation | null;
    }>;
    matchCount?: number;
    relationPath?: Array<{
        edgeId: string;
        sourceAtomId: string;
        targetAtomId: string;
        relationKind: RelationKind;
        confidence: number;
    }>;
    relationPathAtomIds?: string[];
    relationKinds?: RelationKind[];
    temporalValidity?: {
        isValid: boolean;
        checkedAt: string;
        reasons: string[];
        details?: KnowledgeQueryTemporalDetail[];
    };
    capabilities: unknown[];
}

export interface AgentConversationGraphRelationSummary {
    relationKind: RelationKind;
    edgeIds: string[];
    sourceAtomIds?: string[];
    targetAtomIds: string[];
    averageConfidence: number;
}

export interface AgentConversationGraphKnowledgePointRelation {
    edgeId: string;
    relationKind: RelationKind;
    sourceAtomId: string;
    sourceTitle: string;
    targetAtomId: string;
    targetTitle: string;
    confidence: number;
}

export interface AgentConversationGraphConnectionPathEdge {
    fromAtomId: string;
    toAtomId: string;
    relationKind?: RelationKind;
}

export interface AgentConversationGraphConnectionPath {
    sourceAtomId: string;
    sourceTitle: string;
    targetAtomId: string;
    targetTitle: string;
    pathAtomIds: string[];
    pathTitles: string[];
    pathEdges: AgentConversationGraphConnectionPathEdge[];
    length: number;
}

export interface AgentConversationGraphWindowNode {
    atomId: string;
    title: string;
    relationKind?: RelationKind;
    confidence?: number;
}

export interface AgentConversationGraphDiagnostics {
    graphOpsAvailable: boolean;
    usedFallback: boolean;
    selectedAnchorReason: string;
    candidateCount: number;
    supportNodeCount: number;
    supportNodeLimit: number;
    pathDepthLimit: number;
    missingConnectionPathSourceAtomIds?: string[];
    missingPredecessorAtomIds?: string[];
    missingSuccessorAtomIds?: string[];
}

export interface AgentConversationGraphTemporalContext {
    checkedAt: string;
    allPointsValid: boolean;
    warningReasons: string[];
    invalidKnowledgePointTitles: string[];
    edgeKinds?: TemporalEdgeKind[];
    details?: KnowledgeQueryTemporalDetail[];
}

export interface AgentConversationGraphContext {
    anchorAtomId: string;
    anchorTitle: string;
    anchorDocumentId?: string;
    supportingAtomIds: string[];
    supportingTitles: string[];
    relationKinds: RelationKind[];
    relationSummaries: AgentConversationGraphRelationSummary[];
    knowledgePointRelations?: AgentConversationGraphKnowledgePointRelation[];
    connectionPaths?: AgentConversationGraphConnectionPath[];
    predecessorWindow?: AgentConversationGraphWindowNode[];
    successorWindow?: AgentConversationGraphWindowNode[];
    evidenceSourceRefs?: string[];
    diagnostics?: AgentConversationGraphDiagnostics;
    temporalValidity: AgentConversationGraphTemporalContext;
}

export interface AgentConversationMemoryRecord {
    memoryId: string;
    namespace: string;
    layer: MemoryLayer;
    content: string;
    confidence: number;
    tags: string[];
    references: string[];
    source: string;
    memoryType?: string;
    memoryPurpose?: string;
    classificationConfidence?: number;
    scopeWorkspaceId?: string | null;
    scopeCorpusId?: string | null;
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
}

export interface AgentConversationMemoryAction {
    kind: 'persist_session_memory' | 'propose_long_term_memory' | 'persist_answer_summary';
    status: 'applied' | 'proposed' | 'skipped';
    layer: MemoryLayer;
    namespace: string;
    memoryId?: string;
    reason: string;
}

export interface AgentConversationTrace {
    sessionId: string;
    invocationId: string;
    retrieval: KnowledgeQueryResponse['trace'];
    recalledMemoryCount: number;
    appliedMemoryCount: number;
    usedScope: KnowledgeQueryResolvedScope;
    workspaceReadiness?: KnowledgeQueryResolvedScope['readiness'];
    missDiagnostics?: KnowledgeQueryResolvedScope['missDiagnostics'];
    planner?: {
        plannerQuery: string | null;
        titleLikeQueries: string[];
        titleHitDocumentIds: string[];
    };
    graphContext?: AgentConversationGraphContext;
}

export interface AgentConversationRequest {
    userId?: string;
    sessionId?: string;
    activeTarget?: string;
    message?: string;
    topK?: number;
    asOf?: string;
    scope?: KnowledgeCorpusScope;
    persistMemory?: boolean;
    memoryNamespace?: string;
}

export interface AgentConversationAssistantMarkdownBlock {
    blockId: string;
    type: 'main_markdown';
    markdown: string;
}

export interface AgentConversationAssistantStructuredAnswerBlock {
    blockId: string;
    type: 'structured_answer';
    title?: string;
    directAnswer: string;
    overviewMarkdown?: string;
    explanationMarkdown?: string;
    evidenceMarkdown?: string;
    nextActionsMarkdown?: string;
    knowledgePointCount: number;
    citationCount: number;
    recalledMemoryCount: number;
}

export interface AgentConversationAssistantSystemNoticeBlock {
    blockId: string;
    type: 'system_notice';
    text: string;
}

export interface AgentConversationAssistantHtmlArtifactBlock {
    blockId: string;
    type: 'html_artifact';
    title?: string;
    summary?: string;
    html: string;
}

export interface AgentConversationAssistantCitationsBlock {
    blockId: string;
    type: 'citations';
    title?: string;
    citations: KnowledgeCitation[];
}

export interface AgentConversationAssistantKnowledgeActionsBlock {
    blockId: string;
    type: 'knowledge_actions';
    title?: string;
    atomIds: string[];
}

export type KnowledgeRunClaimStatus = 'verified' | 'weak' | 'not_proven' | 'rejected';

export type KnowledgeRunQualityStatus = 'pass' | 'caution' | 'fail';

export type KnowledgeRunQualityGateId =
    | 'evidence_coverage'
    | 'scope_discipline'
    | 'recall_transfer'
    | 'memory_governance'
    | 'graph_prerequisite_order'
    | 'graph_comparison_branch'
    | 'graph_temporal_warning'
    | 'graph_op_fallback'
    | 'graph_budget';

export interface KnowledgeRunEvidenceClaim {
    claimId: string;
    status: KnowledgeRunClaimStatus;
    title: string;
    statement: string;
    citationId?: string;
    atomId?: string;
    documentId?: string;
    sourcePath?: string;
    startLine?: number;
    endLine?: number;
    snippet: string;
    confidence: number;
    reason: string;
}

export interface KnowledgeRunQualityGate {
    gateId: KnowledgeRunQualityGateId;
    passed: boolean;
    observedValue: number;
    threshold: number;
    message: string;
}

export interface KnowledgeRunQuality {
    score: number;
    status: KnowledgeRunQualityStatus;
    gates: KnowledgeRunQualityGate[];
}

export interface KnowledgeRunReviewCard {
    cardId: string;
    sourceClaimId: string;
    atomId?: string;
    suggestedActionKind?: LearningActionKind;
    prompt: string;
    expectedAnswer: string;
    evidenceRefs: string[];
    nextReviewAt: string;
}

export interface KnowledgeRunReviewState {
    consumedCardIds: string[];
    completedReviewCardCount: number;
    remainingReviewCardCount: number;
    completedAt?: string | null;
}

export interface KnowledgeRun {
    runId: string;
    generatedAt: string;
    status: KnowledgeRunQualityStatus;
    scope: Pick<
        KnowledgeQueryResolvedScope,
        | 'source'
        | 'workspaceId'
        | 'corpusId'
        | 'documentIds'
        | 'atomIds'
        | 'sourcePathPrefixes'
        | 'languages'
        | 'matchedAtomCount'
        | 'scopeSource'
    >;
    evidenceClaims: KnowledgeRunEvidenceClaim[];
    quality: KnowledgeRunQuality;
    reviewCards: KnowledgeRunReviewCard[];
    reviewState: KnowledgeRunReviewState;
    summary: {
        claimCount: number;
        verifiedClaimCount: number;
        weakClaimCount: number;
        notProvenClaimCount: number;
        rejectedClaimCount: number;
        reviewCardCount: number;
        completedReviewCardCount: number;
        remainingReviewCardCount: number;
    };
}

export interface AgentConversationAssistantKnowledgeRunSummaryBlock {
    blockId: string;
    type: 'knowledge_run_summary';
    title?: string;
    artifactId?: string;
    knowledgeRun: KnowledgeRun;
}

export type AgentConversationAssistantBlock =
    | AgentConversationAssistantStructuredAnswerBlock
    | AgentConversationAssistantMarkdownBlock
    | AgentConversationAssistantSystemNoticeBlock
    | AgentConversationAssistantHtmlArtifactBlock
    | AgentConversationAssistantCitationsBlock
    | AgentConversationAssistantKnowledgeActionsBlock
    | AgentConversationAssistantKnowledgeRunSummaryBlock;

export interface AgentConversationResponse {
    userId: string;
    sessionId: string;
    assistantMessage: string;
    answer: string;
    assistantBlocks?: AgentConversationAssistantBlock[];
    knowledgeRun?: KnowledgeRun;
    knowledgePoints: AgentConversationKnowledgePoint[];
    citations: KnowledgeCitation[];
    recalledMemories: AgentConversationMemoryRecord[];
    memoryActions: AgentConversationMemoryAction[];
    summary: {
        generatedAt: string;
        topK: number;
        returnedKnowledgePoints: number;
        returnedCitations: number;
        recalledMemoryCount: number;
        appliedMemoryCount: number;
        queryEvidenceCoverageRatioPct: number;
    };
    trace: AgentConversationTrace;
}

export interface AgentConversationTurnEvent {
    type: 'turn_started' | 'capability_planned' | 'capability_progress' | 'capability_result' | 'turn_completed' | 'turn_failed';
    turnId: string;
    emittedAt: string;
    request?: {
        userId?: string;
        sessionId?: string;
        topK?: number;
    };
    capabilities?: string[];
    stage?: string;
    progressPct?: number;
    summary?: Record<string, unknown>;
    result?: AgentConversationResponse;
    error?: string;
    errorCode?: string;
    failure?: {
        error: string;
        errorCode?: string;
        statusCode?: number;
    };
}

export interface ConversationMemoryAddRequest {
    userId: string;
    namespace?: string;
    content: string;
    tags?: string[];
    references?: string[];
    confidence?: number;
    source?: string;
    expiresAt?: string;
    now?: string;
    memoryId?: string;
}

export interface ConversationMemoryDeleteRequest {
    userId: string;
    namespace?: string;
    memoryId: string;
    now?: string;
}

export interface ConversationMemoryFeedbackRequest {
    userId: string;
    namespace?: string;
    memoryId: string;
    feedback?: 'upvote' | 'downvote' | 'correct' | string;
    reason?: string;
    correctedContent?: string;
    now?: string;
}

export interface ConversationMemoryListRequest {
    userId: string;
    namespace?: string;
    limit?: number;
    now?: string;
}

export interface ConversationMemorySearchRequest {
    userId: string;
    namespace?: string;
    query?: string;
    limit?: number;
    now?: string;
}

export interface AgentConversationSessionRecord {
    sessionId: string;
    userId: string;
    workspaceId?: string | null;
    corpusId?: string | null;
    namespace: string;
    createdAt: string;
    updatedAt: string;
    turnIds: string[];
}

export interface AgentConversationTurnRecord {
    turnId: string;
    invocationId: string;
    sessionId: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    request: AgentConversationRequest;
    response: AgentConversationResponse;
}

export interface AgentConversationInvocationRecord {
    invocationId: string;
    sessionId: string;
    userId: string;
    createdAt: string;
    status: 'completed' | 'failed';
    query: string;
    returnedKnowledgePoints: number;
    returnedCitations: number;
    recalledMemoryCount: number;
    appliedMemoryCount: number;
}
export type MemoryPolicyDiagnosticsHistoryRequest = any;
export type MemoryPolicyDiagnosticsTrendRequest = any;
export type StudySessionOrchestrationConfigUpdateRequest = any;
export type StudySessionPlanQualityTrendRequest = any;
export type StudySessionPlanQualityThresholds = any;
export type StudySessionPlanQualityRuntimeThresholdDiagnosticsRequest = any;
export type LearningQualityTrendResponse = any;
export type LearningQualityTrendRequest = any;
export type LearningQualityHistoryRequest = any;
export type MemoryPolicyDiagnosticsRequest = any;
export type StudySessionPlanQualityEvaluationRequest = any;
export type StudySessionPlanQualityHistoryRequest = any;

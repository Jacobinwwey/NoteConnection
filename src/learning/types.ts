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

export type TutorActionKind = 'generate_quiz' | 'analyze_answer' | 'follow_up' | 'recap';

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
    };
}

export interface KnowledgeQueryResponse {
    items: KnowledgeQueryItem[];
    trace: {
        retrievalModes: string[];
        asOf: string;
        totalActiveAtoms: number;
        modeWeights: {
            keyword: number;
            graph: number;
            temporal: number;
        };
        latencyMs: number;
        evidenceCoverageRatio: number;
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
    | 'misconception_remediation';

export interface StudySessionRequest {
    userId: string;
    focusAtomIds?: string[];
    maxActions?: number;
    includeDivergence?: boolean;
    includeRetrain?: boolean;
    generatedAt?: string;
}

export interface StudySessionAction extends LearningAction {
    source: StudySessionActionSource;
    errorTag?: MasteryErrorTag | string;
}

export interface StudySessionResponse {
    userId: string;
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
}

export interface StudySessionActionExecutionResponse {
    executedAt: string;
    tutor: TutorActionResponse;
    answerAnalysis: TutorActionResponse | null;
    memory: MemoryPolicyResponse | null;
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

export interface StudySessionPlanExecutionRequest {
    userId: string;
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
    persistMemory?: boolean;
    memoryLayer?: MemoryLayer;
    stopOnError?: boolean;
    executedAt?: string;
}

export interface StudySessionPlanExecutionItem {
    action: StudySessionAction;
    status: 'executed' | 'skipped' | 'failed';
    reason?: string;
    result?: StudySessionActionExecutionResponse | null;
    error?: string;
}

export interface StudySessionPlanExecutionResponse {
    userId: string;
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
        stoppedEarly: boolean;
    };
}

export interface TutorActionRequest {
    userId: string;
    actionKind: TutorActionKind;
    atomId?: string;
    prompt?: string;
    answer?: string;
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
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
}

export interface MemoryPolicyRequest {
    userId: string;
    operation: 'write' | 'read' | 'evict' | 'snapshot' | 'retrain_plan';
    layer: MemoryLayer;
    entries?: MemoryEntry[];
    query?: string;
    limit?: number;
    now?: string;
}

export interface MemoryPolicyResponse {
    layer: MemoryLayer;
    operation: 'write' | 'read' | 'evict' | 'snapshot' | 'retrain_plan';
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
    };
    sessionActionTelemetry: {
        executionCount: number;
        analyzedAnswerCount: number;
        inferredMasteryUpdateCount: number;
        explicitMasteryUpdateCount: number;
        memoryPersistedCount: number;
        outcomeCounts: {
            correct: number;
            partial: number;
            incorrect: number;
            skipped: number;
        };
    };
    memoryEntries: {
        session: number;
        unit: number;
        longTerm: number;
    };
}

export interface LearningQualitySnapshot {
    retestPassRatePct: number;
    misconceptionRecurrenceRatePct: number;
    evidenceBackedSuggestionRatioPct: number;
    averagePathMasteryGainPct: number;
    randomPathMasteryGainPct: number;
    queryP95Ms?: number;
}

export interface LearningQualitySnapshotRequest {
    userId?: string;
    sampledAt?: string;
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
    };
}

export interface LearningQualityThresholds {
    retestPassRateUpliftPct: number;
    misconceptionRecurrenceReductionPct: number;
    evidenceBackedSuggestionRatioPct: number;
    pathEffectivenessLiftPct: number;
    queryP95Ms: number;
}

export interface LearningQualityEvaluationRequest {
    baseline: LearningQualitySnapshot;
    current: LearningQualitySnapshot;
    thresholds?: Partial<LearningQualityThresholds>;
    evaluatedAt?: string;
}

export interface LearningQualityGateResult {
    gateId: 'retest_pass_rate_uplift' | 'misconception_reduction' | 'evidence_ratio' | 'path_effectiveness' | 'query_p95';
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

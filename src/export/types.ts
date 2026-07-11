import type {
    AgentConversationInvocationRecord,
    AgentConversationSessionRecord,
    AgentConversationTurnRecord,
    AnswerReleaseDecision,
    AnswerReleaseGateId,
    EvidenceSpan,
    KnowledgeAtom,
    MemoryEntry,
    MemoryLayer,
    RelationEdge,
    TemporalEdge,
} from '../learning/types';
import type { IndexLifecycleSummary, IndexSegmentRecord, IndexUnitRecord } from '../indexing/types';
import type { MemoryAuditRecord } from '../memory/types';
import type { ExportProfileId, PlatformRenderTarget } from '../platform/ExportProfile';
import type { RenderMaterializationDecision } from '../platform/RenderMaterializer';
import type { PlatformCapabilities } from '../platform/PlatformCapabilities';
import type { CanonicalResourceRecord, ResourceProjectionRecord } from '../resources/types';
import type { LearningSessionStateRecord } from '../session/types';
import type { WorkflowArtifactRecord } from '../workflows/types';
import type { WorkspaceBindingRecord, WorkspaceRecord } from '../workspace/types';

export interface WorkspaceExportBundleRequest {
    workspaceId: string;
    exportProfileId?: ExportProfileId | string;
    userId?: string;
    includeMemory?: boolean;
    includeWorkflowArtifacts?: boolean;
    includeSessionState?: boolean;
    includeConversationHistory?: boolean;
    includeDeleted?: boolean;
    generatedAt?: string;
}

export interface WorkspaceScopedMemoryExportRecord {
    userId: string;
    layer: MemoryLayer;
    entry: MemoryEntry;
}

export interface WorkspaceExportBundleManifest {
    bundleId: string;
    workspaceId: string;
    corpusId: string;
    exportProfileId: ExportProfileId;
    platformTarget: PlatformRenderTarget;
    packagingMode: 'full' | 'slim';
    generatedAt: string;
    deterministicHash: string;
    counts: {
        bindings: number;
        resources: number;
        projections: number;
        units: number;
        segments: number;
        atoms: number;
        evidenceSpans: number;
        relationEdges: number;
        temporalEdges: number;
        sessionStates: number;
        conversationSessions: number;
        conversationTurns: number;
        conversationInvocations: number;
        workflowArtifacts: number;
        memoryEntries: number;
        memoryAuditRecords: number;
    };
}

export interface WorkspaceExportBundleReadiness {
    ready: boolean;
    reasons: string[];
    activeProjectionCount: number;
    indexedProjectionCount: number;
    missingIndexedProjectionIds: string[];
    indexSummary: IndexLifecycleSummary;
    render: Pick<RenderMaterializationDecision, 'responseArtifact' | 'rendererPreference' | 'includeSvg' | 'vectorSuppressed'>;
}

export interface WorkspaceExportKnowledgeRunGraphSignal {
    graphOpsAvailable: boolean;
    usedFallback: boolean;
    selectedAnchorReason: string;
    connectionPathCount: number;
    temporalWarningCount: number;
    supportNodeCount: number;
    supportNodeLimit: number;
    pathDepthLimit: number | null;
    missingLookupCount: number;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseReviewReport {
    reviewedAt: string;
    decision: AnswerReleaseDecision | string;
    revised: boolean;
    failedGateIds: Array<AnswerReleaseGateId | string>;
    leakedInternalFragmentCount: number;
    reason: string;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditDecisionCounts {
    release: number;
    revise: number;
    abstain: number;
    other: number;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditFailedGateCount {
    gateId: AnswerReleaseGateId | string;
    count: number;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditWindow {
    reviewedRunCount: number;
    decisionCounts: WorkspaceExportKnowledgeRunAnswerReleaseAuditDecisionCounts;
    revisedRunCount: number;
    runsWithFailedGates: number;
    runsWithLeakedInternalFragments: number;
    latestReviewedAt: string;
    earliestReviewedAt: string;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditTrend {
    windowSize: number;
    recentWindow: WorkspaceExportKnowledgeRunAnswerReleaseAuditWindow;
    priorWindow: WorkspaceExportKnowledgeRunAnswerReleaseAuditWindow;
}

export type WorkspaceExportKnowledgeRunAnswerReleaseAuditMetricId =
    | 'reviewed_runs'
    | 'release_decisions'
    | 'revise_decisions'
    | 'abstain_decisions'
    | 'other_decisions'
    | 'revised_runs'
    | 'failed_gate_runs'
    | 'leaked_runs';

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditMetricShift {
    metricId: WorkspaceExportKnowledgeRunAnswerReleaseAuditMetricId | string;
    recentValue: number;
    priorValue: number;
    delta: number;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditGateAging {
    gateId: AnswerReleaseGateId | string;
    failureCount: number;
    latestReviewedAt: string;
    oldestReviewedAt: string;
    reviewedRunsSinceLastFailure: number;
    occurrencesInRecentWindow: number;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditGateShift {
    gateId: AnswerReleaseGateId | string;
    recentWindowCount: number;
    priorWindowCount: number;
    delta: number;
    failureCount: number;
    latestReviewedAt: string;
    reviewedRunsSinceLastFailure: number;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditLatestPair {
    latestRunId: string;
    previousRunId: string;
    latestReviewedAt: string;
    previousReviewedAt: string;
    latestDecision: AnswerReleaseDecision | string;
    previousDecision: AnswerReleaseDecision | string;
    decisionChanged: boolean;
    latestRevised: boolean;
    previousRevised: boolean;
    revisedChanged: boolean;
    latestLeakedInternalFragmentCount: number;
    previousLeakedInternalFragmentCount: number;
    leakedInternalFragmentDelta: number;
    newlyFailedGateIds: Array<AnswerReleaseGateId | string>;
    resolvedFailedGateIds: Array<AnswerReleaseGateId | string>;
    persistentFailedGateIds: Array<AnswerReleaseGateId | string>;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditComparison {
    metricShifts: WorkspaceExportKnowledgeRunAnswerReleaseAuditMetricShift[];
    gateShifts: WorkspaceExportKnowledgeRunAnswerReleaseAuditGateShift[];
    latestPair: WorkspaceExportKnowledgeRunAnswerReleaseAuditLatestPair | null;
}

export interface WorkspaceExportKnowledgeRunAnswerReleaseAuditSummary {
    totalRuns: number;
    reviewedRunCount: number;
    unreviewedRunCount: number;
    decisionCounts: WorkspaceExportKnowledgeRunAnswerReleaseAuditDecisionCounts;
    revisedRunCount: number;
    runsWithFailedGates: number;
    runsWithLeakedInternalFragments: number;
    leakedInternalFragmentTotalCount: number;
    failedGateCounts: WorkspaceExportKnowledgeRunAnswerReleaseAuditFailedGateCount[];
    latestReviewedAt: string;
    reviewTrend: WorkspaceExportKnowledgeRunAnswerReleaseAuditTrend;
    failedGateAging: WorkspaceExportKnowledgeRunAnswerReleaseAuditGateAging[];
    comparison: WorkspaceExportKnowledgeRunAnswerReleaseAuditComparison;
}

export interface WorkspaceExportKnowledgeRunReport {
    artifactId: string;
    runId: string;
    generatedAt: string;
    artifactTitle: string;
    artifactStatus: string;
    workspaceId: string | null;
    corpusId: string | null;
    qualityStatus: string;
    qualityScore: number | null;
    claimCount: number;
    weakClaimCount: number;
    reviewCardCount: number;
    completedReviewCardCount: number;
    remainingReviewCardCount: number;
    scopeSource: string;
    graphSignal: WorkspaceExportKnowledgeRunGraphSignal;
    graphAnswerPlan?: {
        intent: string;
        depth: string;
        anchorAtomId: string;
        claimCount: number;
        requiredClaimCount: number;
        requiredRoles: string[];
        coverageScore: number | null;
        missingRequiredClaimIds: string[];
    };
    answerReleaseReview?: WorkspaceExportKnowledgeRunAnswerReleaseReviewReport;
}

export interface WorkspaceExportGraphFocusSignal {
    usedFallback: boolean;
    fallbackSourcePathUsed: boolean;
    matchedSpanCount: number;
    highlightTermCount: number;
    highlightedNodeCount: number;
    candidateSourcePathCount: number;
    attemptedSourcePathCount: number;
    markdownRuntimeAvailable: boolean;
    storageProviderAvailable: boolean;
    readSucceeded: boolean;
    renderSucceeded: boolean;
    failureReason: string;
}

export interface WorkspaceExportGraphFocusReport {
    sessionStateId: string;
    sessionId: string;
    userId: string;
    workspaceId: string | null;
    corpusId: string | null;
    mode: string;
    recordedAt: string;
    title: string;
    requestedSourcePath: string;
    resolvedSourcePath: string;
    signal: WorkspaceExportGraphFocusSignal;
}

export interface WorkspaceExportBundle {
    manifest: WorkspaceExportBundleManifest;
    workspace: WorkspaceRecord;
    capabilities: PlatformCapabilities;
    readiness: WorkspaceExportBundleReadiness;
    bindings: WorkspaceBindingRecord[];
    resources: CanonicalResourceRecord[];
    projections: ResourceProjectionRecord[];
    index: {
        summary: IndexLifecycleSummary;
        units: IndexUnitRecord[];
        segments: IndexSegmentRecord[];
    };
    graph: {
        atoms: KnowledgeAtom[];
        evidenceSpans: EvidenceSpan[];
        relationEdges: RelationEdge[];
        temporalEdges: TemporalEdge[];
    };
    runtime: {
        sessionStates: LearningSessionStateRecord[];
        conversationSessions: AgentConversationSessionRecord[];
        conversationTurns: AgentConversationTurnRecord[];
        conversationInvocations: AgentConversationInvocationRecord[];
        workflowArtifacts: WorkflowArtifactRecord[];
        knowledgeRunReports: WorkspaceExportKnowledgeRunReport[];
        knowledgeRunAnswerReleaseAuditSummary: WorkspaceExportKnowledgeRunAnswerReleaseAuditSummary;
        graphFocusReports: WorkspaceExportGraphFocusReport[];
    };
    memory: {
        entries: WorkspaceScopedMemoryExportRecord[];
        auditRecords: MemoryAuditRecord[];
    };
}

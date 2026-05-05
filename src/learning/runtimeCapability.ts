import type { KnowledgeGraphStoreDiagnostics } from './store';
import type {
    KnowledgeQueryBackendDiagnostics,
    KnowledgeStalenessDiagnosticsResponse,
    LearningPathRequest,
    LearningQualityTrendResponse,
    TutorAdapterRoutingStrategy,
} from './types';

export type CapabilityCheckStatus = 'pass' | 'warn' | 'fail';

export type RuntimeCapabilityDebugTraceHint = {
    pathPrefix?: string;
    statusAtLeast?: number;
    method?: string;
    errorCode?: string;
};

export type RuntimeCapabilityCheck = {
    checkId: string;
    status: CapabilityCheckStatus;
    message: string;
    observed: string;
    expected?: string;
    debugTraceHint?: RuntimeCapabilityDebugTraceHint;
    priorityScore?: number;
    recommendedActions?: string[];
};

export type RuntimeCapabilityThresholds = {
    minQuerySampleSize: number;
    queryFallbackWarnRatioPct: number;
    queryFallbackFailRatioPct: number;
    queryEvidenceCoverageWarnRatioPct: number;
    queryEvidenceCoverageFailRatioPct: number;
    queryTemporalValidityWarnRatioPct: number;
    queryTemporalValidityFailRatioPct: number;
    queryBackendExplainabilityGapWarnRatioPct: number;
    queryBackendExplainabilityGapFailRatioPct: number;
    queryBackendTrendWarnConfidenceRatioPct: number;
    queryBackendTrendFailConfidenceRatioPct: number;
    sessionPlanQualityWarnFailureStreak: number;
    sessionPlanQualityFailFailureStreak: number;
    apiInvalidRequestMinErrorSample: number;
    apiInvalidRequestWarnRatioPct: number;
    apiInvalidRequestFailRatioPct: number;
    apiInvalidRequestHotspotWarnCount: number;
    apiInvalidRequestHotspotFailCount: number;
    apiServerErrorMinRequestSample: number;
    apiServerErrorWarnRatioPct: number;
    apiServerErrorFailRatioPct: number;
    apiServerErrorHotspotWarnCount: number;
    apiServerErrorHotspotFailCount: number;
    apiTransientErrorMinRequestSample: number;
    apiTransientErrorWarnRatioPct: number;
    apiTransientErrorFailRatioPct: number;
    apiTransientErrorHotspotWarnCount: number;
    apiTransientErrorHotspotFailCount: number;
    apiLatencyMinRequestSample: number;
    apiLatencyP95WarnMs: number;
    apiLatencyP95FailMs: number;
    apiLatencyHotspotWarnMs: number;
    apiLatencyHotspotFailMs: number;
    queryVectorAccelerationShortCircuitWarnCount: number;
    queryVectorAccelerationShortCircuitFailCount: number;
    queryVectorAccelerationShortCircuitWarnRatioPct: number;
    queryVectorAccelerationShortCircuitFailRatioPct: number;
    queryVectorAccelerationConsecutiveFailuresWarnCount: number;
    queryVectorAccelerationConsecutiveFailuresFailCount: number;
    queryVectorAccelerationHalfOpenSuccessWarnRatioPct: number;
    queryVectorAccelerationHalfOpenSuccessFailRatioPct: number;
    queryVectorAccelerationPrefilterMinRequestSample: number;
    queryVectorAccelerationPrefilterWarnCandidateRatioPct: number;
    queryVectorAccelerationPrefilterFailCandidateRatioPct: number;
    storeGraphDbConnectorMinRequestSample: number;
    storeGraphDbConnectorFailureWarnRatioPct: number;
    storeGraphDbConnectorFailureFailRatioPct: number;
    storeGraphDbConnectorShortCircuitWarnRatioPct: number;
    storeGraphDbConnectorShortCircuitFailRatioPct: number;
    storeGraphDbConnectorConsecutiveFailuresWarnCount: number;
    storeGraphDbConnectorConsecutiveFailuresFailCount: number;
};

export type RuntimeCapabilityThresholdOverrides = {
    minQuerySampleSize?: number | string;
    queryFallbackWarnRatioPct?: number | string;
    queryFallbackFailRatioPct?: number | string;
    queryEvidenceCoverageWarnRatioPct?: number | string;
    queryEvidenceCoverageFailRatioPct?: number | string;
    queryTemporalValidityWarnRatioPct?: number | string;
    queryTemporalValidityFailRatioPct?: number | string;
    queryBackendExplainabilityGapWarnRatioPct?: number | string;
    queryBackendExplainabilityGapFailRatioPct?: number | string;
    queryBackendTrendWarnConfidenceRatioPct?: number | string;
    queryBackendTrendFailConfidenceRatioPct?: number | string;
    sessionPlanQualityWarnFailureStreak?: number | string;
    sessionPlanQualityFailFailureStreak?: number | string;
    apiInvalidRequestMinErrorSample?: number | string;
    apiInvalidRequestWarnRatioPct?: number | string;
    apiInvalidRequestFailRatioPct?: number | string;
    apiInvalidRequestHotspotWarnCount?: number | string;
    apiInvalidRequestHotspotFailCount?: number | string;
    apiServerErrorMinRequestSample?: number | string;
    apiServerErrorWarnRatioPct?: number | string;
    apiServerErrorFailRatioPct?: number | string;
    apiServerErrorHotspotWarnCount?: number | string;
    apiServerErrorHotspotFailCount?: number | string;
    apiTransientErrorMinRequestSample?: number | string;
    apiTransientErrorWarnRatioPct?: number | string;
    apiTransientErrorFailRatioPct?: number | string;
    apiTransientErrorHotspotWarnCount?: number | string;
    apiTransientErrorHotspotFailCount?: number | string;
    apiLatencyMinRequestSample?: number | string;
    apiLatencyP95WarnMs?: number | string;
    apiLatencyP95FailMs?: number | string;
    apiLatencyHotspotWarnMs?: number | string;
    apiLatencyHotspotFailMs?: number | string;
    queryVectorAccelerationShortCircuitWarnCount?: number | string;
    queryVectorAccelerationShortCircuitFailCount?: number | string;
    queryVectorAccelerationShortCircuitWarnRatioPct?: number | string;
    queryVectorAccelerationShortCircuitFailRatioPct?: number | string;
    queryVectorAccelerationConsecutiveFailuresWarnCount?: number | string;
    queryVectorAccelerationConsecutiveFailuresFailCount?: number | string;
    queryVectorAccelerationHalfOpenSuccessWarnRatioPct?: number | string;
    queryVectorAccelerationHalfOpenSuccessFailRatioPct?: number | string;
    queryVectorAccelerationPrefilterMinRequestSample?: number | string;
    queryVectorAccelerationPrefilterWarnCandidateRatioPct?: number | string;
    queryVectorAccelerationPrefilterFailCandidateRatioPct?: number | string;
    storeGraphDbConnectorMinRequestSample?: number | string;
    storeGraphDbConnectorFailureWarnRatioPct?: number | string;
    storeGraphDbConnectorFailureFailRatioPct?: number | string;
    storeGraphDbConnectorShortCircuitWarnRatioPct?: number | string;
    storeGraphDbConnectorShortCircuitFailRatioPct?: number | string;
    storeGraphDbConnectorConsecutiveFailuresWarnCount?: number | string;
    storeGraphDbConnectorConsecutiveFailuresFailCount?: number | string;
};

export type RuntimeCapabilityLearningQualityTrend = {
    status: LearningQualityTrendResponse['status'];
    score: number;
    confidence: number;
    reason?: string;
};

export type RuntimeCapabilitySessionPlanQualityHistory = {
    summary?: {
        totalRecords?: number;
        overallPassRatePct?: number;
        consecutiveFailureCount?: number;
        commonFailedGates?: Array<{
            gateId?: string;
            count?: number;
        }>;
    };
};

export type RuntimeCapabilitySessionPlanQualityTrend = {
    status: 'improving' | 'stable' | 'regressing' | 'insufficient_data';
    score: number;
    confidence: number;
    reason?: string;
};

export type RuntimeCapabilityMemoryPolicyDiagnostics = {
    summary?: {
        totalEntries?: number;
        expiredEntries?: number;
        staleEntries?: number;
        lowConfidenceEntries?: number;
        healthScore?: number;
        status?: 'healthy' | 'watch' | 'risk' | 'insufficient_data';
        reason?: string;
    };
};

export type RuntimeCapabilityMemoryPolicyTrend = {
    status: 'improving' | 'stable' | 'regressing' | 'insufficient_data';
    score: number;
    confidence: number;
    reason?: string;
};

export type RuntimeCapabilityKnowledgeStalenessDiagnostics = {
    summary?: KnowledgeStalenessDiagnosticsResponse['summary'];
};

export type RuntimeCapabilityTutorAdapterTelemetry = {
    summary?: {
        totalAdapters?: number;
        activeAdapters?: number;
        totalRequests?: number;
        successfulResponses?: number;
        acceptedResponses?: number;
        downgradedResponses?: number;
        failedResponses?: number;
        providerFallbackResponses?: number;
        providerFallbackRatioPct?: number;
        averageProviderAttemptCount?: number;
        averageConfidence?: number;
        lastRoutingStrategy?: TutorAdapterRoutingStrategy | string;
        lastRoutingReason?: string;
        lastRoutingScore?: number;
        lastRoutingDynamicPreferredMode?: 'auto' | 'local' | 'cloud' | string;
        lastRoutingDynamicModeReason?: string;
    };
};

export type RuntimeCapabilityTutorRoutingConfig = {
    enabled?: boolean;
    minSamples?: number;
    maxFailedRatioPct?: number;
    maxDowngradedRatioPct?: number;
    minAverageConfidence?: number;
    preferredMode?: 'auto' | 'local' | 'cloud' | string;
    adapterTimeoutMs?: number;
};

export type RuntimeCapabilityTutorTraceDiagnostics = {
    summary?: {
        matchedTraces?: number;
        llmAdapterTraces?: number;
        fallbackTraces?: number;
        fallbackRatioPct?: number;
        averageProviderAttemptCount?: number;
    };
    providerBreakdown?: Array<{
        providerName?: string;
        traces?: number;
        fallbackTraces?: number;
        failedTraces?: number;
        averageConfidence?: number;
        averageProviderAttemptCount?: number;
        lastSeenAt?: string;
    }>;
};

export type RuntimeCapabilityTutorProviderTrendDiagnostics = {
    summary?: {
        totalProviders?: number;
        evaluatedProviders?: number;
        returnedProviders?: number;
        regressingProviders?: number;
        stableProviders?: number;
        improvingProviders?: number;
        insufficientDataProviders?: number;
        recommendedFocusProviderName?: string;
        recommendedFocusReason?: string;
    };
    providers?: Array<{
        providerName?: string;
        trendStatus?: 'improving' | 'stable' | 'regressing' | 'insufficient_data' | string;
        trendScore?: number;
        trendConfidence?: number;
        fallbackRatioPct?: number;
        failedRatioPct?: number;
        averageConfidence?: number;
        deltas?: {
            fallbackRatioDeltaPct?: number;
            failedRatioDeltaPct?: number;
            averageConfidenceDelta?: number;
        };
        reason?: string;
        latestSeenAt?: string;
    }>;
};

export type RuntimeCapabilityTutorProviderTrendHistory = {
    summary?: {
        totalProviders?: number;
        evaluatedProviders?: number;
        totalRecords?: number;
        returnedRecords?: number;
        regressingRecords?: number;
        stableRecords?: number;
        improvingRecords?: number;
        insufficientDataRecords?: number;
        latestWindowEndAt?: string;
        oldestWindowEndAt?: string;
        recommendedFocusProviderName?: string;
    };
    records?: Array<{
        providerName?: string;
        windowIndex?: number;
        sampleCount?: number;
        trendStatus?: 'improving' | 'stable' | 'regressing' | 'insufficient_data' | string;
        trendScore?: number;
        trendConfidence?: number;
        windowStartAt?: string;
        windowEndAt?: string;
    }>;
};

export type RuntimeCapabilitySessionActionTelemetry = {
    executionCount?: number;
    memoryPersistedCount?: number;
    memoryPromotionAppliedCount?: number;
    memoryPromotionCount?: number;
};

export type RuntimeCapabilitySessionStrategyTelemetry = {
    totalRecords?: number;
    strategyRecords?: number;
    trendAutoSelectionSharePct?: number;
    trendAutoAverageMasteryDeltaPct?: number;
    trendAutoNegativeRatioPct?: number;
    modeFallbackSelectionSharePct?: number;
    selectionSourceCounts?: {
        explicit_request?: number;
        strategy_trend?: number;
        mode_fallback?: number;
        unknown?: number;
    };
    selectionSourceAverageMasteryDeltaPct?: {
        explicit_request?: number;
        strategy_trend?: number;
        mode_fallback?: number;
        unknown?: number;
    };
    selectionSourcePositiveRatioPct?: {
        explicit_request?: number;
        strategy_trend?: number;
        mode_fallback?: number;
        unknown?: number;
    };
    strategyBreakdown?: Array<{
        strategy?: LearningPathRequest['strategy'] | string;
        executions?: number;
        averageMasteryDeltaPct?: number;
        positiveRatioPct?: number;
        negativeRatioPct?: number;
    }>;
};

export type RuntimeCapabilityApiRequestErrorTelemetry = {
    totalRequests?: number;
    errorRequests?: number;
    invalidRequestErrors?: number;
    serverErrorRequests?: number;
    transientErrorRequests?: number;
    averageDurationMs?: number;
    p95DurationMs?: number;
    scopePathPrefix?: string;
    scopeMethod?: string;
    invalidRequestTopPaths?: Array<{
        path?: string;
        count?: number;
    }>;
    serverErrorTopPaths?: Array<{
        path?: string;
        count?: number;
    }>;
    transientErrorTopPaths?: Array<{
        path?: string;
        count?: number;
    }>;
    slowTopPaths?: Array<{
        path?: string;
        count?: number;
        p95DurationMs?: number;
    }>;
};

export type RuntimeCapabilityQueryExplainabilityTelemetry = {
    sampleCount?: number;
    evidenceCoverageRatioPct?: number;
    relationPathCoverageRatioPct?: number;
    temporalValidityPassRatioPct?: number;
    averageEvidenceSpanCount?: number;
    averageRelationPathLength?: number;
};

export type RuntimeCapabilityQueryBackendComparisonTelemetry = {
    summary?: {
        returnedRecords?: number;
        averageLeftEvidenceCoverageRatio?: number;
        averageRightEvidenceCoverageRatio?: number;
        averageLeftRelationPathCoverageRatio?: number;
        averageRightRelationPathCoverageRatio?: number;
        averageLeftTemporalValidityPassRatio?: number;
        averageRightTemporalValidityPassRatio?: number;
    };
};

export type RuntimeCapabilityQueryBackendComparisonTrend = {
    status: 'improving' | 'stable' | 'regressing' | 'insufficient_data';
    score: number;
    confidence: number;
    summary?: {
        reason?: string;
    };
};

export type RuntimeCapabilityQueryBackendComparisonTrendConfig = {
    limit?: number;
    windowSize?: number;
    minSamples?: number;
};

export type RuntimeCapabilityMatrix = {
    generatedAt: string;
    overallStatus: 'ready' | 'degraded' | 'blocked';
    thresholds: RuntimeCapabilityThresholds;
    checks: RuntimeCapabilityCheck[];
    summary: {
        passCount: number;
        warnCount: number;
        failCount: number;
    };
    signals: {
        configuredStoreBackend: string;
        configuredQueryBackend: string;
        storeType: string;
        storeUsingFallback: boolean;
        graphDbConnectorHealthStatus: 'ready' | 'degraded' | 'unavailable' | 'unknown';
        graphDbConnectorHealthMessage: string;
        graphDbConnectorCircuitState: 'closed' | 'open' | 'half_open' | 'unknown';
        graphDbConnectorRequestCount: number;
        graphDbConnectorRetryCount: number;
        graphDbConnectorShortCircuitCount: number;
        graphDbConnectorSuccessCount: number;
        graphDbConnectorFailureCount: number;
        graphDbConnectorFailureRatioPct: number;
        graphDbConnectorConsecutiveFailures: number;
        graphDbConnectorShortCircuitRatioPct: number;
        graphDbConnectorWarnBudgetExceeded: boolean;
        graphDbConnectorFailBudgetExceeded: boolean;
        graphDbConnectorBudgetStatus: 'ok' | 'warn' | 'fail';
        graphDbConnectorLastRequestId: string;
        graphDbConnectorLastErrorCode: string;
        graphDbConnectorLastStatusCode: number;
        graphDbConnectorLastRetryAfterMs: number;
        queryBackendId: string;
        queryBackendRuntimeReady: boolean;
        queryBackendRuntimeId: string;
        queryVectorIndexEnabled: boolean;
        queryVectorIndexStatus: 'ready' | 'stale' | 'unavailable' | 'unknown';
        queryVectorIndexPersisted: boolean;
        queryVectorIndexLoadedFromDisk: boolean;
        queryVectorIndexAtomCount: number;
        queryVectorIndexLocation: string;
        queryVectorIndexAccelerationEnabled: boolean;
        queryVectorIndexAccelerationMode: 'ann_prefilter' | 'full_scan' | 'unknown';
        queryVectorIndexAccelerationLastSelectionMode:
            'full_scan' | 'token_prefilter' | 'token_signature_prefilter' | 'unknown';
        queryVectorIndexAccelerationLastCandidateCount: number;
        queryVectorIndexAccelerationAdapterId: string;
        queryVectorIndexAccelerationAdapterError: string;
        queryVectorIndexAccelerationHealthStatus: 'ready' | 'degraded' | 'unavailable' | 'unknown';
        queryVectorIndexAccelerationHealthMessage: string;
        queryVectorIndexAccelerationRepresentationVersion: string;
        queryVectorIndexAccelerationEmbeddingModelId: string;
        queryVectorIndexAccelerationEmbeddingDimension: number;
        queryVectorIndexAccelerationIndexSignature: string;
        queryVectorIndexAccelerationRepresentationStatus: 'aligned' | 'mismatch' | 'unknown';
        queryVectorIndexAccelerationRepresentationStatusReason: string;
        queryVectorIndexAccelerationRepresentationStrictMode: boolean;
        queryVectorIndexAccelerationLastRequestId: string;
        queryVectorIndexAccelerationLastErrorCode: string;
        queryVectorIndexAccelerationLastRetryAfterMs: number;
        queryVectorIndexAccelerationCircuitState: 'closed' | 'open' | 'half_open' | 'unknown';
        queryVectorIndexAccelerationConsecutiveFailures: number;
        queryVectorIndexAccelerationRequestCount: number;
        queryVectorIndexAccelerationRetryCount: number;
        queryVectorIndexAccelerationShortCircuitCount: number;
        queryVectorIndexAccelerationShortCircuitRatioPct: number;
        queryVectorIndexAccelerationSuccessCount: number;
        queryVectorIndexAccelerationFailureCount: number;
        queryVectorIndexAccelerationHalfOpenProbeCount: number;
        queryVectorIndexAccelerationHalfOpenSuccessRatePct: number;
        queryVectorIndexAccelerationCircuitWarnBudgetExceeded: boolean;
        queryVectorIndexAccelerationCircuitFailBudgetExceeded: boolean;
        queryVectorIndexAccelerationCircuitBudgetStatus: 'ok' | 'warn' | 'fail';
        queryFallbackCount: number;
        queryCount: number;
        queryFallbackRatioPct: number;
        queryExplainabilitySampleCount: number;
        queryEvidenceCoverageRatioPct: number;
        queryRelationPathCoverageRatioPct: number;
        queryTemporalValidityPassRatioPct: number;
        queryAverageEvidenceSpanCount: number;
        queryAverageRelationPathLength: number;
        queryBackendComparisonSampleCount: number;
        queryBackendComparisonEvidenceGapRatioPct: number;
        queryBackendComparisonRelationGapRatioPct: number;
        queryBackendComparisonTemporalGapRatioPct: number;
        queryBackendComparisonMaxExplainabilityGapRatioPct: number;
        queryBackendComparisonTrendStatus:
            RuntimeCapabilityQueryBackendComparisonTrend['status'] | 'unknown';
        queryBackendComparisonTrendScore: number;
        queryBackendComparisonTrendConfidence: number;
        queryBackendComparisonTrendLimit: number;
        queryBackendComparisonTrendWindowSize: number;
        queryBackendComparisonTrendMinSamples: number;
        queryBackendComparisonTrendRequiredRecords: number;
        apiTraceWindowRequests: number;
        apiTraceWindowErrors: number;
        apiTraceWindowInvalidRequests: number;
        apiTraceWindowInvalidRequestRatioPct: number;
        apiTraceWindowInvalidRequestToTotalRatioPct: number;
        apiTraceWindowServerErrors: number;
        apiTraceWindowServerErrorRatioPct: number;
        apiTraceWindowTransientErrors: number;
        apiTraceWindowTransientErrorRatioPct: number;
        apiTraceAverageDurationMs: number;
        apiTraceP95DurationMs: number;
        apiTraceScopePathPrefix: string;
        apiTraceScopeMethod: string;
        apiTraceWindowInvalidRequestTopPaths: Array<{
            path: string;
            count: number;
        }>;
        apiTraceWindowServerErrorTopPaths: Array<{
            path: string;
            count: number;
        }>;
        apiTraceWindowTransientErrorTopPaths: Array<{
            path: string;
            count: number;
        }>;
        apiTraceSlowTopPaths: Array<{
            path: string;
            count: number;
            p95DurationMs: number;
        }>;
        qualityTrendStatus: LearningQualityTrendResponse['status'] | 'unknown';
        qualityTrendScore: number;
        qualityTrendConfidence: number;
        sessionPlanQualityRecords: number;
        sessionPlanQualityPassRatePct: number;
        sessionPlanQualityFailureStreak: number;
        sessionPlanQualityTrendStatus: RuntimeCapabilitySessionPlanQualityTrend['status'] | 'unknown';
        sessionPlanQualityTrendScore: number;
        sessionPlanQualityTrendConfidence: number;
        memoryPolicyStatus: 'healthy' | 'watch' | 'risk' | 'insufficient_data' | 'unknown';
        memoryPolicyHealthScore: number;
        memoryPolicyTotalEntries: number;
        memoryPolicyExpiredEntries: number;
        memoryPolicyStaleEntries: number;
        memoryPolicyLowConfidenceEntries: number;
        memoryPolicyTrendStatus: RuntimeCapabilityMemoryPolicyTrend['status'] | 'unknown';
        memoryPolicyTrendScore: number;
        memoryPolicyTrendConfidence: number;
        knowledgeStalenessStaleDocuments: number;
        knowledgeStalenessFreshnessRatioPct: number;
        knowledgeStalenessHashMismatchDocuments: number;
        knowledgeStalenessMissingSourceDocuments: number;
        knowledgeStalenessReadErrorDocuments: number;
        sessionActionExecutionCount: number;
        sessionMemoryPersistedCount: number;
        sessionMemoryPromotionAppliedCount: number;
        sessionMemoryPromotionCount: number;
        sessionMemoryPromotionCoveragePct: number;
        sessionStrategyTotalRecords: number;
        sessionStrategyStrategyRecords: number;
        sessionStrategyTrendAutoSelectionSharePct: number;
        sessionStrategyTrendAutoAverageMasteryDeltaPct: number;
        sessionStrategyTrendAutoNegativeRatioPct: number;
        sessionStrategyModeFallbackSelectionSharePct: number;
        sessionStrategySelectionSourceExplicitCount: number;
        sessionStrategySelectionSourceTrendCount: number;
        sessionStrategySelectionSourceFallbackCount: number;
        sessionStrategySelectionSourceUnknownCount: number;
        sessionStrategyTopAverageStrategy: LearningPathRequest['strategy'] | 'unknown';
        sessionStrategyTopAverageMasteryDeltaPct: number;
        sessionStrategyTopAverageNegativeRatioPct: number;
        tutorAdaptersTotal: number;
        tutorAdaptersActive: number;
        tutorRequests: number;
        tutorAcceptedResponses: number;
        tutorDowngradedResponses: number;
        tutorFailedResponses: number;
        tutorProviderFallbackResponses: number;
        tutorProviderFallbackRatioPct: number;
        tutorAverageProviderAttemptCount: number;
        tutorProviderCount: number;
        tutorDominantProviderName: string;
        tutorDominantProviderSharePct: number;
        tutorDominantFallbackProviderName: string;
        tutorDominantFallbackProviderSharePct: number;
        tutorProviderTrendRegressingCount: number;
        tutorProviderTrendImprovingCount: number;
        tutorProviderTrendInsufficientDataCount: number;
        tutorProviderTrendTopRegressingProvider: string;
        tutorProviderTrendTopRegressingScore: number;
        tutorProviderTrendTopRegressingConfidence: number;
        tutorProviderTrendRecommendedFocusProviderName: string;
        tutorProviderTrendHistoryRecords: number;
        tutorProviderTrendHistoryRegressingRecords: number;
        tutorProviderTrendHistoryStableRecords: number;
        tutorProviderTrendHistoryImprovingRecords: number;
        tutorProviderTrendHistoryInsufficientDataRecords: number;
        tutorFailedRatioPct: number;
        tutorDowngradedRatioPct: number;
        tutorAverageConfidence: number;
        tutorRoutingEnabled: boolean;
        tutorRoutingPreferredMode: 'auto' | 'local' | 'cloud';
        tutorRoutingAdapterTimeoutMs: number;
        tutorLastRoutingStrategy: TutorAdapterRoutingStrategy | 'unknown';
        tutorLastRoutingReason: string;
        tutorLastRoutingScore: number;
        tutorRoutingDynamicPreferredMode: 'auto' | 'local' | 'cloud';
        tutorRoutingDynamicModeReason: string;
        tutorRoutingDynamicModeSuggestionActive: boolean;
        topRiskCheckId: string;
        topRiskStatus: CapabilityCheckStatus | 'none';
        topRiskPriorityScore: number;
        topRiskRecommendedActions: string[];
    };
};

export type RuntimeCapabilityRunbookCheck = {
    checkId: string;
    status: CapabilityCheckStatus;
    message: string;
    observed: string;
    expected?: string;
    debugTraceHint?: RuntimeCapabilityDebugTraceHint;
    priorityScore: number;
    recommendedActions: string[];
};

export type RuntimeCapabilityRunbook = {
    generatedAt: string;
    overallStatus: RuntimeCapabilityMatrix['overallStatus'];
    summary: RuntimeCapabilityMatrix['summary'];
    requestedCheckId: string;
    selectionSource: 'requested' | 'top_risk' | 'top_risk_fallback' | 'none';
    selectedCheck: RuntimeCapabilityRunbookCheck | null;
    topRiskCheck: RuntimeCapabilityRunbookCheck | null;
    traceFilter: RuntimeCapabilityDebugTraceHint;
    verificationTargets: string[];
};

export type RuntimeCapabilityMatrixInput = {
    generatedAt: string;
    configuredStoreBackend: string;
    configuredQueryBackend: string;
    store: KnowledgeGraphStoreDiagnostics;
    queryDiagnostics: KnowledgeQueryBackendDiagnostics;
    queryCount: number;
    queryExplainabilityTelemetry?: RuntimeCapabilityQueryExplainabilityTelemetry | null;
    queryBackendComparisonTelemetry?: RuntimeCapabilityQueryBackendComparisonTelemetry | null;
    queryBackendComparisonTrend?: RuntimeCapabilityQueryBackendComparisonTrend | null;
    queryBackendComparisonTrendConfig?: RuntimeCapabilityQueryBackendComparisonTrendConfig | null;
    learningQualityTrend?: RuntimeCapabilityLearningQualityTrend | null;
    sessionPlanQualityHistory?: RuntimeCapabilitySessionPlanQualityHistory | null;
    sessionPlanQualityTrend?: RuntimeCapabilitySessionPlanQualityTrend | null;
    memoryPolicyDiagnostics?: RuntimeCapabilityMemoryPolicyDiagnostics | null;
    memoryPolicyTrend?: RuntimeCapabilityMemoryPolicyTrend | null;
    knowledgeStalenessDiagnostics?: RuntimeCapabilityKnowledgeStalenessDiagnostics | null;
    sessionActionTelemetry?: RuntimeCapabilitySessionActionTelemetry | null;
    sessionStrategyTelemetry?: RuntimeCapabilitySessionStrategyTelemetry | null;
    apiRequestErrorTelemetry?: RuntimeCapabilityApiRequestErrorTelemetry | null;
    tutorAdapterTelemetry?: RuntimeCapabilityTutorAdapterTelemetry | null;
    tutorRoutingConfig?: RuntimeCapabilityTutorRoutingConfig | null;
    tutorTraceDiagnostics?: RuntimeCapabilityTutorTraceDiagnostics | null;
    tutorProviderTrendDiagnostics?: RuntimeCapabilityTutorProviderTrendDiagnostics | null;
    tutorProviderTrendHistory?: RuntimeCapabilityTutorProviderTrendHistory | null;
    thresholds?: RuntimeCapabilityThresholdOverrides;
};

export const DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS: RuntimeCapabilityThresholds = {
    minQuerySampleSize: 5,
    queryFallbackWarnRatioPct: 10,
    queryFallbackFailRatioPct: 20,
    queryEvidenceCoverageWarnRatioPct: 90,
    queryEvidenceCoverageFailRatioPct: 75,
    queryTemporalValidityWarnRatioPct: 90,
    queryTemporalValidityFailRatioPct: 75,
    queryBackendExplainabilityGapWarnRatioPct: 20,
    queryBackendExplainabilityGapFailRatioPct: 35,
    queryBackendTrendWarnConfidenceRatioPct: 40,
    queryBackendTrendFailConfidenceRatioPct: 70,
    sessionPlanQualityWarnFailureStreak: 1,
    sessionPlanQualityFailFailureStreak: 2,
    apiInvalidRequestMinErrorSample: 3,
    apiInvalidRequestWarnRatioPct: 30,
    apiInvalidRequestFailRatioPct: 60,
    apiInvalidRequestHotspotWarnCount: 3,
    apiInvalidRequestHotspotFailCount: 8,
    apiServerErrorMinRequestSample: 10,
    apiServerErrorWarnRatioPct: 5,
    apiServerErrorFailRatioPct: 15,
    apiServerErrorHotspotWarnCount: 2,
    apiServerErrorHotspotFailCount: 5,
    apiTransientErrorMinRequestSample: 10,
    apiTransientErrorWarnRatioPct: 8,
    apiTransientErrorFailRatioPct: 18,
    apiTransientErrorHotspotWarnCount: 2,
    apiTransientErrorHotspotFailCount: 6,
    apiLatencyMinRequestSample: 10,
    apiLatencyP95WarnMs: 1200,
    apiLatencyP95FailMs: 2500,
    apiLatencyHotspotWarnMs: 1800,
    apiLatencyHotspotFailMs: 3500,
    queryVectorAccelerationShortCircuitWarnCount: 1,
    queryVectorAccelerationShortCircuitFailCount: 4,
    queryVectorAccelerationShortCircuitWarnRatioPct: 5,
    queryVectorAccelerationShortCircuitFailRatioPct: 20,
    queryVectorAccelerationConsecutiveFailuresWarnCount: 1,
    queryVectorAccelerationConsecutiveFailuresFailCount: 3,
    queryVectorAccelerationHalfOpenSuccessWarnRatioPct: 80,
    queryVectorAccelerationHalfOpenSuccessFailRatioPct: 50,
    queryVectorAccelerationPrefilterMinRequestSample: 5,
    queryVectorAccelerationPrefilterWarnCandidateRatioPct: 95,
    queryVectorAccelerationPrefilterFailCandidateRatioPct: 99,
    storeGraphDbConnectorMinRequestSample: 5,
    storeGraphDbConnectorFailureWarnRatioPct: 20,
    storeGraphDbConnectorFailureFailRatioPct: 40,
    storeGraphDbConnectorShortCircuitWarnRatioPct: 5,
    storeGraphDbConnectorShortCircuitFailRatioPct: 20,
    storeGraphDbConnectorConsecutiveFailuresWarnCount: 1,
    storeGraphDbConnectorConsecutiveFailuresFailCount: 3,
};

function clamp(value: number, minValue: number, maxValue: number): number {
    return Math.max(minValue, Math.min(maxValue, value));
}

function normalizeInteger(value: unknown, fallback: number, minValue: number, maxValue: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.floor(clamp(numeric, minValue, maxValue));
}

function normalizeRatio(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return Number(clamp(fallback, 0, 100).toFixed(4));
    }
    return Number(clamp(numeric, 0, 100).toFixed(4));
}

function normalizeRuntimeCapabilityHttpMethod(value: unknown): string {
    const normalized = String(value || '').trim().toUpperCase();
    return (/^[A-Z]+$/).test(normalized) ? normalized : '';
}

function parseRuntimeCapabilityApiTraceRoute(
    value: unknown
): { method: string; pathPrefix: string } | null {
    const normalized = String(value || '').trim().slice(0, 256);
    if (!normalized) {
        return null;
    }
    const matched = normalized.match(/^([A-Z]+)\s+(.+)$/);
    if (matched) {
        const method = normalizeRuntimeCapabilityHttpMethod(matched[1]);
        const pathPrefix = String(matched[2] || '').trim().slice(0, 256);
        if (!pathPrefix) {
            return null;
        }
        return {
            method,
            pathPrefix,
        };
    }
    return {
        method: '',
        pathPrefix: normalized,
    };
}

function normalizeRuntimeCapabilityDebugTraceHint(
    hint: RuntimeCapabilityDebugTraceHint | null | undefined
): RuntimeCapabilityDebugTraceHint | undefined {
    if (!hint) {
        return undefined;
    }
    const pathPrefix = String(hint.pathPrefix || '').trim().slice(0, 256);
    const method = normalizeRuntimeCapabilityHttpMethod(hint.method || '');
    const errorCode = String(hint.errorCode || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.:-]+/g, '_')
        .slice(0, 64);
    const statusAtLeastRaw = Number(hint.statusAtLeast || 0);
    const statusAtLeast = Number.isFinite(statusAtLeastRaw)
        ? Math.max(0, Math.floor(statusAtLeastRaw))
        : 0;
    if (!pathPrefix && !method && !errorCode && statusAtLeast <= 0) {
        return undefined;
    }
    return {
        pathPrefix,
        statusAtLeast,
        method,
        errorCode,
    };
}

function normalizeRuntimeCapabilityRecommendedActions(
    actionsRaw: Array<string | null | undefined>
): string[] | undefined {
    const actions = actionsRaw
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim().slice(0, 220))
        .filter(Boolean)
        .slice(0, 5);
    return actions.length > 0 ? actions : undefined;
}

type RuntimeCapabilityRecommendedActionContext = {
    thresholds: RuntimeCapabilityThresholds;
    apiScopePathPrefix: string;
    apiScopeMethod: string;
    apiInvalidRequestTopRoute: { method: string; pathPrefix: string } | null;
    apiServerErrorTopRoute: { method: string; pathPrefix: string } | null;
    apiTransientErrorTopRoute: { method: string; pathPrefix: string } | null;
    apiLatencyTopRoute: { method: string; pathPrefix: string } | null;
    apiTraceP95DurationMs: number;
    apiLatencyHotspotPeakP95Ms: number;
    qualityTrendStatus: RuntimeCapabilityMatrix['signals']['qualityTrendStatus'];
    qualityTrendConfidence: number;
    sessionPlanQualityFailureStreak: number;
    sessionPlanQualityPassRatePct: number;
    sessionPlanTrendStatus: RuntimeCapabilityMatrix['signals']['sessionPlanQualityTrendStatus'];
    memoryPolicyStatus: RuntimeCapabilityMatrix['signals']['memoryPolicyStatus'];
    memoryPolicyHealthScore: number;
    memoryPolicyTrendStatus: RuntimeCapabilityMatrix['signals']['memoryPolicyTrendStatus'];
    knowledgeStalenessEvaluatedDocuments: number;
    knowledgeStalenessStaleDocuments: number;
    knowledgeStalenessHashMismatchDocuments: number;
    knowledgeStalenessMissingSourceDocuments: number;
    knowledgeStalenessReadErrorDocuments: number;
    knowledgeStalenessFreshnessRatioPct: number;
    sessionMemoryPromotionCoveragePct: number;
    sessionStrategyTotalRecords: number;
    sessionStrategyStrategyRecords: number;
    sessionStrategyTrendAutoSelectionSharePct: number;
    sessionStrategyTrendAutoAverageMasteryDeltaPct: number;
    sessionStrategyTrendAutoNegativeRatioPct: number;
    sessionStrategyModeFallbackSelectionSharePct: number;
    sessionStrategySelectionSourceExplicitCount: number;
    sessionStrategySelectionSourceTrendCount: number;
    sessionStrategySelectionSourceFallbackCount: number;
    sessionStrategySelectionSourceUnknownCount: number;
    sessionStrategyTopAverageStrategy: RuntimeCapabilityMatrix['signals']['sessionStrategyTopAverageStrategy'];
    sessionStrategyTopAverageMasteryDeltaPct: number;
    sessionStrategyTopAverageNegativeRatioPct: number;
    tutorAdaptersTotal: number;
    tutorAdaptersActive: number;
    tutorRequests: number;
    tutorProviderFallbackResponses: number;
    tutorProviderFallbackRatioPct: number;
    tutorAverageProviderAttemptCount: number;
    tutorProviderCount: number;
    tutorDominantProviderName: string;
    tutorDominantProviderSharePct: number;
    tutorDominantFallbackProviderName: string;
    tutorDominantFallbackProviderSharePct: number;
    tutorProviderTrendRegressingCount: number;
    tutorProviderTrendImprovingCount: number;
    tutorProviderTrendInsufficientDataCount: number;
    tutorProviderTrendTopRegressingProvider: string;
    tutorProviderTrendTopRegressingScore: number;
    tutorProviderTrendTopRegressingConfidence: number;
    tutorProviderTrendRecommendedFocusProviderName: string;
    tutorProviderTrendHistoryRecords: number;
    tutorProviderTrendHistoryRegressingRecords: number;
    tutorProviderTrendHistoryStableRecords: number;
    tutorProviderTrendHistoryImprovingRecords: number;
    tutorProviderTrendHistoryInsufficientDataRecords: number;
    tutorFailedRatioPct: number;
    tutorDowngradedRatioPct: number;
    tutorAverageConfidence: number;
    tutorRoutingEnabled: boolean;
    tutorRoutingPreferredMode: RuntimeCapabilityMatrix['signals']['tutorRoutingPreferredMode'];
    tutorRoutingMinSamples: number;
    tutorRoutingMaxFailedRatioPct: number;
    tutorRoutingMaxDowngradedRatioPct: number;
    tutorRoutingMinAverageConfidence: number;
    tutorRoutingAdapterTimeoutMs: number;
    tutorLastRoutingStrategy: string;
    tutorRoutingDynamicPreferredMode: RuntimeCapabilityMatrix['signals']['tutorRoutingDynamicPreferredMode'];
    tutorRoutingDynamicModeReason: string;
    tutorRoutingDynamicModeSuggestionActive: boolean;
    queryBackendRuntimeReady: boolean;
    queryBackendRuntimeId: string;
    queryVectorIndexEnabled: boolean;
    queryVectorIndexStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexStatus'];
    queryVectorIndexPersisted: boolean;
    queryVectorIndexLoadedFromDisk: boolean;
    queryVectorIndexAtomCount: number;
    queryVectorIndexLocation: string;
    queryVectorIndexAccelerationEnabled: boolean;
    queryVectorIndexAccelerationMode: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationMode'];
    queryVectorIndexAccelerationLastSelectionMode:
        RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationLastSelectionMode'];
    queryVectorIndexAccelerationLastCandidateCount: number;
    queryVectorIndexAccelerationAdapterId: string;
    queryVectorIndexAccelerationAdapterError: string;
    queryVectorIndexAccelerationHealthStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationHealthStatus'];
    queryVectorIndexAccelerationHealthMessage: string;
    queryVectorIndexAccelerationRepresentationVersion: string;
    queryVectorIndexAccelerationEmbeddingModelId: string;
    queryVectorIndexAccelerationEmbeddingDimension: number;
    queryVectorIndexAccelerationIndexSignature: string;
    queryVectorIndexAccelerationRepresentationStatus:
        RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationRepresentationStatus'];
    queryVectorIndexAccelerationRepresentationStatusReason: string;
    queryVectorIndexAccelerationRepresentationStrictMode: boolean;
    queryVectorIndexAccelerationCircuitState: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationCircuitState'];
    queryVectorIndexAccelerationConsecutiveFailures: number;
    queryVectorIndexAccelerationRequestCount: number;
    queryVectorIndexAccelerationRetryCount: number;
    queryVectorIndexAccelerationShortCircuitCount: number;
    queryVectorIndexAccelerationSuccessCount: number;
    queryVectorIndexAccelerationFailureCount: number;
    queryVectorIndexAccelerationHalfOpenProbeCount: number;
    queryVectorIndexAccelerationHalfOpenSuccessRatePct: number;
};

function formatRuntimeCapabilityRouteLabel(
    route: { method: string; pathPrefix: string } | null,
    fallbackPathPrefix: string,
    fallbackMethod: string
): string {
    const method = normalizeRuntimeCapabilityHttpMethod(route?.method || fallbackMethod || '');
    const pathPrefix = String(route?.pathPrefix || fallbackPathPrefix || '/api/knowledge').trim() || '/api/knowledge';
    return [method, pathPrefix].filter(Boolean).join(' ');
}

function normalizeTutorRoutingDynamicPreferredModeToken(
    rawValue: unknown
): RuntimeCapabilityMatrix['signals']['tutorRoutingDynamicPreferredMode'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'local' || normalized === 'cloud') {
        return normalized;
    }
    return 'auto';
}

function extractTutorRoutingDynamicSignalsFromReason(
    routingReasonRaw: unknown
): {
    preferredMode: RuntimeCapabilityMatrix['signals']['tutorRoutingDynamicPreferredMode'];
    modeReason: string;
} {
    const routingReason = String(routingReasonRaw || '').trim();
    if (!routingReason) {
        return {
            preferredMode: 'auto',
            modeReason: '',
        };
    }
    const tokens = routingReason
        .split(',')
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    const preferredModeToken = tokens.find((item) => item.startsWith('dynamicPreferredMode='));
    const modeReasonToken = tokens.find((item) => item.startsWith('dynamicModeReason='));
    const preferredMode = normalizeTutorRoutingDynamicPreferredModeToken(
        preferredModeToken?.slice('dynamicPreferredMode='.length)
    );
    const modeReason = modeReasonToken
        ? modeReasonToken.slice('dynamicModeReason='.length).trim().slice(0, 220)
        : '';
    return {
        preferredMode,
        modeReason,
    };
}

function buildRuntimeCapabilityRecommendedActions(
    check: RuntimeCapabilityCheck,
    context: RuntimeCapabilityRecommendedActionContext
): string[] | undefined {
    const checkId = String(check?.checkId || '').trim().toLowerCase();
    const status = String(check?.status || '').trim().toLowerCase();
    if (!checkId || status === 'pass') {
        return undefined;
    }

    const invalidRouteLabel = formatRuntimeCapabilityRouteLabel(
        context.apiInvalidRequestTopRoute,
        context.apiScopePathPrefix,
        context.apiScopeMethod
    );
    const serverRouteLabel = formatRuntimeCapabilityRouteLabel(
        context.apiServerErrorTopRoute,
        context.apiScopePathPrefix,
        context.apiScopeMethod
    );
    const transientRouteLabel = formatRuntimeCapabilityRouteLabel(
        context.apiTransientErrorTopRoute,
        context.apiScopePathPrefix,
        context.apiScopeMethod
    );
    const latencyRouteLabel = formatRuntimeCapabilityRouteLabel(
        context.apiLatencyTopRoute,
        context.apiScopePathPrefix,
        context.apiScopeMethod
    );
    const failOrWarnTargetSuffix = status === 'fail'
        ? 'before shipping the next release.'
        : 'in the next stabilization pass.';

    if (checkId === 'api_invalid_request_ratio' || checkId === 'api_invalid_request_hotspots') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Apply trace filter for ${invalidRouteLabel} with status>=400 and errorCode=invalid_request.`,
            'Verify request normalization + required-field validation before any downstream call.',
            `Backfill API contract tests for malformed payloads and boundary values ${failOrWarnTargetSuffix}`,
        ]);
    }

    if (checkId === 'api_server_error_ratio' || checkId === 'api_server_error_hotspots') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Apply trace filter for ${serverRouteLabel} with status>=500 and capture requestId-linked logs.`,
            'Classify each 5xx root cause (validation gap, dependency failure, timeout, unknown) and patch the dominant bucket first.',
            `Gate rollout on server/total <= ${context.thresholds.apiServerErrorWarnRatioPct}% with endpoint-level alerting.`,
        ]);
    }

    if (checkId === 'api_transient_error_ratio' || checkId === 'api_transient_error_hotspots') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Apply trace filter for ${transientRouteLabel} with status>=400 and focus on transient codes (408/425/429/502/503/504).`,
            'Tune retry/backoff behavior against Retry-After and cap retry storms on hotspot endpoints.',
            `Gate rollout on transient/total <= ${context.thresholds.apiTransientErrorWarnRatioPct}% and review provider timeout budgets.`,
        ]);
    }

    if (checkId === 'api_latency_p95' || checkId === 'api_latency_hotspots') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Apply trace filter for ${latencyRouteLabel} with status>=0 to keep successful slow requests visible.`,
            `Current p95=${context.apiTraceP95DurationMs}ms (hotspot p95=${context.apiLatencyHotspotPeakP95Ms}ms); split heavy handlers and defer non-critical work.`,
            `Gate rollout on p95 <= ${context.thresholds.apiLatencyP95WarnMs}ms and hotspot p95 <= ${context.thresholds.apiLatencyHotspotWarnMs}ms.`,
        ]);
    }

    if (checkId === 'query_backend_trend_config') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Align trend config so limit >= windowSize + minSamples and keep dual-window comparison valid.',
            'Add trend-window sample budget checks in CI to prevent stale regression signals.',
            'Refresh runtime capability matrix after updating trend config and compare confidence deltas.',
        ]);
    }

    if (checkId === 'query_backend_last_error') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Apply trace filter on /api/knowledge/query with status>=400 and capture requestId-linked payload diagnostics.',
            'Compare local_hybrid / local_vector vs keyword_only query responses to isolate backend-specific regression surface.',
            'Harden query fallback path and add regression tests around the latest backend error signature.',
        ]);
    }

    if (checkId === 'query_backend_runtime_health') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/query-backend-diagnostics and verify runtime.ready plus backend id alignment.',
            'If runtime backend is not ready, switch to local_hybrid via /api/knowledge/query-backend-config while investigating backend initialization failures.',
            'Re-run a controlled /api/knowledge/query sample and confirm runtime diagnostics recover before re-enabling strict rollout gates.',
        ]);
    }

    if (checkId === 'store_graphdb_connector_health') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/store-diagnostics and verify store.connector.healthStatus/healthMessage/circuitState.',
            'Validate graphdb HTTP endpoint availability, then tune NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS / NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES / NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS for current workload.',
            'Run /api/knowledge/store/reload and confirm connector telemetry converges to health=ready, circuit=closed with stable request/retry counters.',
        ]);
    }

    if (checkId === 'store_graphdb_connector_budget') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/store-diagnostics and verify requestCount/failureCount/shortCircuitCount/consecutiveFailures counters against rollout traffic.',
            'Tune NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_* budget thresholds to match current load profile and alert sensitivity.',
            'If failure/short-circuit budgets stay elevated, tune NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS / NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES / NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS and circuit thresholds (NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_CIRCUIT_FAILURE_THRESHOLD / NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_CIRCUIT_COOLDOWN_MS).',
            'Run /api/knowledge/store/reload and replay representative graphdb-backed query traffic before tightening strict rollout gates.',
        ]);
    }

    if (checkId === 'query_vector_index_status' || checkId === 'query_vector_index_persistence') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/query-backend-diagnostics and verify diagnostics.runtime.vectorIndex.status moves to ready.',
            'Trigger local_vector query traffic and confirm vector index atom count/signature update after ingest changes.',
            'If persistence remains disabled, enable NOTE_CONNECTION_QUERY_VECTOR_INDEX_PERSIST and re-check diagnostics runtime fields.',
        ]);
    }

    if (checkId === 'query_vector_acceleration_mode') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/query-backend-diagnostics and verify diagnostics.runtime.vectorIndex.acceleration fields are populated.',
            'Issue representative /api/knowledge/query traffic and confirm ann_prefilter appears in trace.retrievalModes when acceleration is enabled.',
            'If acceleration is intentionally disabled, set NOTE_CONNECTION_QUERY_VECTOR_ANN_PREFILTER=true before performance-sensitive validation runs.',
        ]);
    }

    if (checkId === 'query_vector_acceleration_representation_consistency') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/query-backend-diagnostics and verify diagnostics.runtime.vectorIndex.acceleration representation metadata fields are populated (representationVersion, embeddingModelId, embeddingDimension, indexSignature).',
            `Confirm diagnostics.runtime.vectorIndex.acceleration.representationStatus converges to aligned under representative query traffic (requestCount=${context.queryVectorIndexAccelerationRequestCount}).`,
            'If representationStatus remains mismatch, align vector acceleration adapter embedding/model/index semantics with local index generation and re-run controlled /api/knowledge/query verification.',
            'When rollout requires hard guarantees, enable NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT=true and monitor mismatch failures via diagnostics/runtime runbook.',
        ]);
    }

    if (checkId === 'query_vector_acceleration_prefilter_effectiveness') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/query-backend-diagnostics and confirm acceleration.lastSelectionMode plus acceleration.lastCandidateCount are populated under ANN prefilter traffic.',
            `Issue representative /api/knowledge/query traffic and verify lastSelectionMode converges to token_prefilter|token_signature_prefilter (requestCount=${context.queryVectorIndexAccelerationRequestCount}).`,
            `Compare lastCandidateCount against atomCount and keep candidateRatio below ${context.thresholds.queryVectorAccelerationPrefilterWarnCandidateRatioPct}% (hard fail at ${context.thresholds.queryVectorAccelerationPrefilterFailCandidateRatioPct}%) before tightening ANN rollout gates (atomCount=${context.queryVectorIndexAtomCount}, lastCandidateCount=${context.queryVectorIndexAccelerationLastCandidateCount}).`,
            'Tune NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_MIN_REQUEST_SAMPLE / NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_WARN_CANDIDATE_RATIO_PCT / NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_FAIL_CANDIDATE_RATIO_PCT to match corpus shape and rollout phase.',
        ]);
    }

    if (checkId === 'query_vector_acceleration_health') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/query-backend-diagnostics and verify diagnostics.runtime.vectorIndex.acceleration.healthStatus/healthMessage fields.',
            'For external_http provider, validate NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT reachability and timeout budget.',
            'Tune NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_MAX_RETRIES / NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_RETRY_DELAY_MS and circuit settings (NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_FAILURE_THRESHOLD / NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_COOLDOWN_MS).',
            'Issue representative /api/knowledge/query traffic and confirm acceleration health recovers to ready|unknown while fallback ratio remains controlled.',
        ]);
    }

    if (checkId === 'query_vector_acceleration_traceability') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/query-backend-diagnostics and verify diagnostics.runtime.vectorIndex.acceleration.lastRequestId/lastErrorCode/lastRetryAfterMs are populated for external connectors.',
            'Issue representative /api/knowledge/query traffic while connector is degraded/open and confirm correlation fields are emitted for incident drilldown.',
            'If correlation fields remain empty, verify connector response headers/body mapping and keep fallback/circuit telemetry enabled before stricter rollout gates.',
        ]);
    }

    if (checkId === 'query_vector_acceleration_circuit_state') {
        return normalizeRuntimeCapabilityRecommendedActions([
            'Inspect /api/knowledge/query-backend-diagnostics and verify diagnostics.runtime.vectorIndex.acceleration.circuitState plus retry/shortCircuit counters.',
            'If circuitState=open, verify connector availability first, then tune NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_FAILURE_THRESHOLD / NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_COOLDOWN_MS for workload volatility.',
            'Tune runtime governance thresholds with NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_* / NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_CONSECUTIVE_FAILURES_* / NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_HALF_OPEN_SUCCESS_* env keys.',
            'Track half-open probe outcomes and keep halfOpenSuccessRate above configured warn/fail floors before tightening retry thresholds.',
        ]);
    }

    if (checkId === 'quality_trend_direction') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Trend status=${context.qualityTrendStatus}, confidence=${context.qualityTrendConfidence}; run targeted retest sessions on low-mastery atoms first.`,
            'Review recent misconception tags and align next session plan toward top recurring error families.',
            'Gate release on stable/improving quality trend for at least one complete trend window.',
        ]);
    }

    if (checkId === 'session_plan_quality_gate') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Current failureStreak=${context.sessionPlanQualityFailureStreak}, passRate=${context.sessionPlanQualityPassRatePct}%; prioritize fixing the most frequent failed gates.`,
            'Re-run plan quality evaluation after threshold tuning and ensure evidence/coverage gates pass together.',
            `Keep failureStreak below ${context.thresholds.sessionPlanQualityWarnFailureStreak} before enabling aggressive orchestration modes.`,
        ]);
    }

    if (checkId === 'session_plan_quality_trend') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Session plan trend is ${context.sessionPlanTrendStatus}; compare last two windows for gate-level drift.`,
            'Promote stable plan templates from successful sessions and demote low-quality templates.',
            'Run controlled A/B on plan strategy (balanced vs mastery_recovery) and retain the higher pass-rate policy.',
        ]);
    }

    if (checkId === 'orchestration_path_strategy_alignment') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Strategy alignment telemetry: strategyRecords=${context.sessionStrategyStrategyRecords}, trendAutoShare=${context.sessionStrategyTrendAutoSelectionSharePct}%, trendAutoAvgDelta=${context.sessionStrategyTrendAutoAverageMasteryDeltaPct}%, trendAutoNegative=${context.sessionStrategyTrendAutoNegativeRatioPct}%, topAverage=${context.sessionStrategyTopAverageStrategy}@${context.sessionStrategyTopAverageMasteryDeltaPct}%.`,
            'Inspect /api/knowledge/session/history to compare strategy_trend decisions against explicit_request and mode_fallback outcomes.',
            'If trend-auto outcomes remain negative, tighten strategy auto-selection confidence gate and re-run quality/session-plan trends before rollout.',
        ]);
    }

    if (checkId === 'memory_policy_health' || checkId === 'memory_policy_trend') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Memory status=${context.memoryPolicyStatus}, healthScore=${context.memoryPolicyHealthScore}; prioritize cleanup of expired/stale/low-confidence entries.`,
            'Run memory diagnostics + retraining cycle, then verify trend status improves on the next window.',
            'Enforce memory write/read TTL and confidence floors to prevent degraded memories from re-entering active planning.',
        ]);
    }

    if (checkId === 'knowledge_staleness_data' || checkId === 'knowledge_staleness_health') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Staleness snapshot: evaluated=${context.knowledgeStalenessEvaluatedDocuments}, stale=${context.knowledgeStalenessStaleDocuments}, freshness=${context.knowledgeStalenessFreshnessRatioPct}%.`,
            `Run incremental rebuild for stale/hash-mismatch/missing docs (mismatch=${context.knowledgeStalenessHashMismatchDocuments}, missing=${context.knowledgeStalenessMissingSourceDocuments}, readError=${context.knowledgeStalenessReadErrorDocuments}).`,
            'Block learning-path updates when source read errors persist, and recover source availability first.',
        ]);
    }

    if (checkId === 'session_memory_promotion_coverage') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Session memory promotion coverage is ${context.sessionMemoryPromotionCoveragePct}%; raise promotion for high-value session outcomes.`,
            'Audit memory write policy so verified tutor actions and high-confidence mastery updates are persistable.',
            'Re-run one controlled session and verify promotedActions plus promotedEntries both increase.',
        ]);
    }

    if (checkId === 'tutor_adapter_inventory') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Adapter inventory=${context.tutorAdaptersActive}/${context.tutorAdaptersTotal}, requests=${context.tutorRequests}; ensure at least one healthy adapter remains active.`,
            'Validate adapter registry and provider bindings, then probe each adapter endpoint before rerouting traffic.',
            'Fallback to deterministic local tutor mode if adapter inventory remains unstable.',
        ]);
    }

    if (checkId === 'tutor_adapter_timeout_budget') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Current adapterTimeoutMs=${context.tutorRoutingAdapterTimeoutMs}; keep timeout within governance budget.`,
            'Tune adapter timeout against observed p95 adapter latency and provider-specific response behavior.',
            'Align timeout policy with retry limits to avoid cascading queue buildup under load.',
        ]);
    }

    if (checkId === 'tutor_routing_health_budget') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Routing enabled=${context.tutorRoutingEnabled}, requests=${context.tutorRequests}/${context.tutorRoutingMinSamples}, fail=${context.tutorFailedRatioPct}%, downgraded=${context.tutorDowngradedRatioPct}%, fallback=${context.tutorProviderFallbackRatioPct}%, avgAttempts=${context.tutorAverageProviderAttemptCount}, conf=${context.tutorAverageConfidence}, dynamicMode=${context.tutorRoutingDynamicPreferredMode}${context.tutorRoutingDynamicModeReason ? `(${context.tutorRoutingDynamicModeReason})` : ''}.`,
            `Keep fail<=${context.tutorRoutingMaxFailedRatioPct}% and downgraded<=${context.tutorRoutingMaxDowngradedRatioPct}% while fallback stays controlled and avgConfidence>=${context.tutorRoutingMinAverageConfidence}.`,
            'If budgets keep failing, temporarily pin preferred mode (local or cloud) and resume adaptive routing after stabilization.',
        ]);
    }

    if (checkId === 'tutor_routing_traceability') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Last routing strategy=${context.tutorLastRoutingStrategy || 'unknown'}, dynamicMode=${context.tutorRoutingDynamicPreferredMode}, dynamicSuggested=${context.tutorRoutingDynamicModeSuggestionActive}; require explicit reason + score on each routed tutor response.`,
            'Treat repeated fallback_default routing as degraded mode and trigger adapter inventory + health checks.',
            'Persist routing traces for postmortem comparison between accepted and downgraded tutor responses.',
        ]);
    }

    if (checkId === 'tutor_routing_dynamic_mode_alignment') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Routing preference=${context.tutorRoutingPreferredMode}, dynamicMode=${context.tutorRoutingDynamicPreferredMode}, dynamicSuggested=${context.tutorRoutingDynamicModeSuggestionActive}${context.tutorRoutingDynamicModeReason ? `, reason=${context.tutorRoutingDynamicModeReason}` : ''}.`,
            'When dynamic suggestion remains stable, switch preferredMode to auto (or to the suggested mode) and re-measure failure/fallback budgets.',
            'Re-run tutor trace diagnostics history to verify mode conflict and trend penalty signals converge.',
        ]);
    }

    if (checkId === 'tutor_provider_concentration') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Provider concentration: providers=${context.tutorProviderCount}, dominant=${context.tutorDominantProviderName || 'unknown'}(${context.tutorDominantProviderSharePct}%), fallbackDominant=${context.tutorDominantFallbackProviderName || 'none'}(${context.tutorDominantFallbackProviderSharePct}%).`,
            'Distribute fallback routing across at least two healthy providers and re-check concentration after stabilization.',
            'If a single provider dominates fallback traffic, probe alternate providers and lower their warmup threshold to avoid SPOF.',
        ]);
    }

    if (checkId === 'tutor_provider_trend_regression') {
        return normalizeRuntimeCapabilityRecommendedActions([
            `Provider trend: regressing=${context.tutorProviderTrendRegressingCount}, improving=${context.tutorProviderTrendImprovingCount}, insufficient=${context.tutorProviderTrendInsufficientDataCount}, history(regressing=${context.tutorProviderTrendHistoryRegressingRecords}/${context.tutorProviderTrendHistoryRecords},stable=${context.tutorProviderTrendHistoryStableRecords},improving=${context.tutorProviderTrendHistoryImprovingRecords},insufficient=${context.tutorProviderTrendHistoryInsufficientDataRecords}), topRegressing=${context.tutorProviderTrendTopRegressingProvider || 'none'}@${context.tutorProviderTrendTopRegressingScore.toFixed(2)}(${context.tutorProviderTrendTopRegressingConfidence.toFixed(2)}).`,
            `Focus provider=${context.tutorProviderTrendRecommendedFocusProviderName || context.tutorProviderTrendTopRegressingProvider || 'n/a'} and validate fallback/failure deltas against the previous window.`,
            'Pin degraded provider to reduced traffic, run targeted probe sessions, then reopen adaptive routing after trend recovers.',
        ]);
    }

    return undefined;
}

function extractRuntimeCapabilityHotspotPeakFromObserved(observedRaw: unknown): number {
    const observed = String(observedRaw || '');
    if (!observed) {
        return 0;
    }
    const tokens = observed.match(/:(\d+)(?=\||$)/g) || [];
    let maxCount = 0;
    tokens.forEach((token) => {
        const numeric = Number(String(token || '').replace(':', ''));
        if (Number.isFinite(numeric) && numeric > maxCount) {
            maxCount = numeric;
        }
    });
    return maxCount;
}

function computeRuntimeCapabilityPriorityScore(check: RuntimeCapabilityCheck): number {
    const status = String(check?.status || 'warn').trim().toLowerCase();
    const checkId = String(check?.checkId || '').trim().toLowerCase();
    const hotspotPeakCount = extractRuntimeCapabilityHotspotPeakFromObserved(check?.observed);
    let score = status === 'fail'
        ? 300
        : (status === 'warn' ? 200 : 100);
    if (checkId.includes('hotspots')) {
        score += 40;
    }
    if (checkId.includes('server_error')) {
        score += 20;
    }
    if (checkId.includes('invalid_request')) {
        score += 15;
    }
    if (checkId.includes('ratio')) {
        score += 5;
    }
    score += Math.min(20, Math.max(0, Math.floor(Number(hotspotPeakCount || 0))));
    return Math.max(1, Math.floor(score));
}

function sortRuntimeCapabilityChecksByPriority(checks: RuntimeCapabilityCheck[]): RuntimeCapabilityCheck[] {
    return checks.slice().sort((left, right) => {
        const leftScore = Number(left?.priorityScore || 0);
        const rightScore = Number(right?.priorityScore || 0);
        if (rightScore !== leftScore) {
            return rightScore - leftScore;
        }
        const leftId = String(left?.checkId || '').trim().toLowerCase();
        const rightId = String(right?.checkId || '').trim().toLowerCase();
        return leftId.localeCompare(rightId);
    });
}

export function normalizeRuntimeCapabilityThresholds(
    input: RuntimeCapabilityThresholdOverrides = {}
): RuntimeCapabilityThresholds {
    const minQuerySampleSize = normalizeInteger(
        input.minQuerySampleSize,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.minQuerySampleSize,
        1,
        100000
    );
    const queryFallbackWarnRatioPct = normalizeRatio(
        input.queryFallbackWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryFallbackWarnRatioPct
    );
    let queryFallbackFailRatioPct = normalizeRatio(
        input.queryFallbackFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryFallbackFailRatioPct
    );
    if (queryFallbackFailRatioPct < queryFallbackWarnRatioPct) {
        queryFallbackFailRatioPct = queryFallbackWarnRatioPct;
    }
    const queryEvidenceCoverageWarnRatioPct = normalizeRatio(
        input.queryEvidenceCoverageWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryEvidenceCoverageWarnRatioPct
    );
    let queryEvidenceCoverageFailRatioPct = normalizeRatio(
        input.queryEvidenceCoverageFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryEvidenceCoverageFailRatioPct
    );
    if (queryEvidenceCoverageFailRatioPct > queryEvidenceCoverageWarnRatioPct) {
        queryEvidenceCoverageFailRatioPct = queryEvidenceCoverageWarnRatioPct;
    }
    const queryTemporalValidityWarnRatioPct = normalizeRatio(
        input.queryTemporalValidityWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryTemporalValidityWarnRatioPct
    );
    let queryTemporalValidityFailRatioPct = normalizeRatio(
        input.queryTemporalValidityFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryTemporalValidityFailRatioPct
    );
    if (queryTemporalValidityFailRatioPct > queryTemporalValidityWarnRatioPct) {
        queryTemporalValidityFailRatioPct = queryTemporalValidityWarnRatioPct;
    }
    const queryBackendExplainabilityGapWarnRatioPct = normalizeRatio(
        input.queryBackendExplainabilityGapWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryBackendExplainabilityGapWarnRatioPct
    );
    let queryBackendExplainabilityGapFailRatioPct = normalizeRatio(
        input.queryBackendExplainabilityGapFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryBackendExplainabilityGapFailRatioPct
    );
    if (queryBackendExplainabilityGapFailRatioPct < queryBackendExplainabilityGapWarnRatioPct) {
        queryBackendExplainabilityGapFailRatioPct = queryBackendExplainabilityGapWarnRatioPct;
    }
    const queryBackendTrendWarnConfidenceRatioPct = normalizeRatio(
        input.queryBackendTrendWarnConfidenceRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryBackendTrendWarnConfidenceRatioPct
    );
    let queryBackendTrendFailConfidenceRatioPct = normalizeRatio(
        input.queryBackendTrendFailConfidenceRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryBackendTrendFailConfidenceRatioPct
    );
    if (queryBackendTrendFailConfidenceRatioPct < queryBackendTrendWarnConfidenceRatioPct) {
        queryBackendTrendFailConfidenceRatioPct = queryBackendTrendWarnConfidenceRatioPct;
    }
    const sessionPlanQualityWarnFailureStreak = normalizeInteger(
        input.sessionPlanQualityWarnFailureStreak,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.sessionPlanQualityWarnFailureStreak,
        1,
        100
    );
    let sessionPlanQualityFailFailureStreak = normalizeInteger(
        input.sessionPlanQualityFailFailureStreak,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.sessionPlanQualityFailFailureStreak,
        1,
        100
    );
    if (sessionPlanQualityFailFailureStreak < sessionPlanQualityWarnFailureStreak) {
        sessionPlanQualityFailFailureStreak = sessionPlanQualityWarnFailureStreak;
    }
    const apiInvalidRequestMinErrorSample = normalizeInteger(
        input.apiInvalidRequestMinErrorSample,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiInvalidRequestMinErrorSample,
        1,
        100000
    );
    const apiInvalidRequestWarnRatioPct = normalizeRatio(
        input.apiInvalidRequestWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiInvalidRequestWarnRatioPct
    );
    let apiInvalidRequestFailRatioPct = normalizeRatio(
        input.apiInvalidRequestFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiInvalidRequestFailRatioPct
    );
    if (apiInvalidRequestFailRatioPct < apiInvalidRequestWarnRatioPct) {
        apiInvalidRequestFailRatioPct = apiInvalidRequestWarnRatioPct;
    }
    const apiInvalidRequestHotspotWarnCount = normalizeInteger(
        input.apiInvalidRequestHotspotWarnCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiInvalidRequestHotspotWarnCount,
        1,
        100000
    );
    let apiInvalidRequestHotspotFailCount = normalizeInteger(
        input.apiInvalidRequestHotspotFailCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiInvalidRequestHotspotFailCount,
        1,
        100000
    );
    if (apiInvalidRequestHotspotFailCount < apiInvalidRequestHotspotWarnCount) {
        apiInvalidRequestHotspotFailCount = apiInvalidRequestHotspotWarnCount;
    }
    const apiServerErrorMinRequestSample = normalizeInteger(
        input.apiServerErrorMinRequestSample,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiServerErrorMinRequestSample,
        1,
        100000
    );
    const apiServerErrorWarnRatioPct = normalizeRatio(
        input.apiServerErrorWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiServerErrorWarnRatioPct
    );
    let apiServerErrorFailRatioPct = normalizeRatio(
        input.apiServerErrorFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiServerErrorFailRatioPct
    );
    if (apiServerErrorFailRatioPct < apiServerErrorWarnRatioPct) {
        apiServerErrorFailRatioPct = apiServerErrorWarnRatioPct;
    }
    const apiServerErrorHotspotWarnCount = normalizeInteger(
        input.apiServerErrorHotspotWarnCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiServerErrorHotspotWarnCount,
        1,
        100000
    );
    let apiServerErrorHotspotFailCount = normalizeInteger(
        input.apiServerErrorHotspotFailCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiServerErrorHotspotFailCount,
        1,
        100000
    );
    if (apiServerErrorHotspotFailCount < apiServerErrorHotspotWarnCount) {
        apiServerErrorHotspotFailCount = apiServerErrorHotspotWarnCount;
    }
    const apiTransientErrorMinRequestSample = normalizeInteger(
        input.apiTransientErrorMinRequestSample,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiTransientErrorMinRequestSample,
        1,
        100000
    );
    const apiTransientErrorWarnRatioPct = normalizeRatio(
        input.apiTransientErrorWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiTransientErrorWarnRatioPct
    );
    let apiTransientErrorFailRatioPct = normalizeRatio(
        input.apiTransientErrorFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiTransientErrorFailRatioPct
    );
    if (apiTransientErrorFailRatioPct < apiTransientErrorWarnRatioPct) {
        apiTransientErrorFailRatioPct = apiTransientErrorWarnRatioPct;
    }
    const apiTransientErrorHotspotWarnCount = normalizeInteger(
        input.apiTransientErrorHotspotWarnCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiTransientErrorHotspotWarnCount,
        1,
        100000
    );
    let apiTransientErrorHotspotFailCount = normalizeInteger(
        input.apiTransientErrorHotspotFailCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiTransientErrorHotspotFailCount,
        1,
        100000
    );
    if (apiTransientErrorHotspotFailCount < apiTransientErrorHotspotWarnCount) {
        apiTransientErrorHotspotFailCount = apiTransientErrorHotspotWarnCount;
    }
    const apiLatencyMinRequestSample = normalizeInteger(
        input.apiLatencyMinRequestSample,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiLatencyMinRequestSample,
        1,
        100000
    );
    const apiLatencyP95WarnMs = normalizeInteger(
        input.apiLatencyP95WarnMs,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiLatencyP95WarnMs,
        1,
        600000
    );
    let apiLatencyP95FailMs = normalizeInteger(
        input.apiLatencyP95FailMs,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiLatencyP95FailMs,
        1,
        600000
    );
    if (apiLatencyP95FailMs < apiLatencyP95WarnMs) {
        apiLatencyP95FailMs = apiLatencyP95WarnMs;
    }
    const apiLatencyHotspotWarnMs = normalizeInteger(
        input.apiLatencyHotspotWarnMs,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiLatencyHotspotWarnMs,
        1,
        600000
    );
    let apiLatencyHotspotFailMs = normalizeInteger(
        input.apiLatencyHotspotFailMs,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.apiLatencyHotspotFailMs,
        1,
        600000
    );
    if (apiLatencyHotspotFailMs < apiLatencyHotspotWarnMs) {
        apiLatencyHotspotFailMs = apiLatencyHotspotWarnMs;
    }
    const queryVectorAccelerationShortCircuitWarnCount = normalizeInteger(
        input.queryVectorAccelerationShortCircuitWarnCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationShortCircuitWarnCount,
        0,
        100000
    );
    let queryVectorAccelerationShortCircuitFailCount = normalizeInteger(
        input.queryVectorAccelerationShortCircuitFailCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationShortCircuitFailCount,
        0,
        100000
    );
    if (queryVectorAccelerationShortCircuitFailCount < queryVectorAccelerationShortCircuitWarnCount) {
        queryVectorAccelerationShortCircuitFailCount = queryVectorAccelerationShortCircuitWarnCount;
    }
    const queryVectorAccelerationShortCircuitWarnRatioPct = normalizeRatio(
        input.queryVectorAccelerationShortCircuitWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationShortCircuitWarnRatioPct
    );
    let queryVectorAccelerationShortCircuitFailRatioPct = normalizeRatio(
        input.queryVectorAccelerationShortCircuitFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationShortCircuitFailRatioPct
    );
    if (queryVectorAccelerationShortCircuitFailRatioPct < queryVectorAccelerationShortCircuitWarnRatioPct) {
        queryVectorAccelerationShortCircuitFailRatioPct = queryVectorAccelerationShortCircuitWarnRatioPct;
    }
    const queryVectorAccelerationConsecutiveFailuresWarnCount = normalizeInteger(
        input.queryVectorAccelerationConsecutiveFailuresWarnCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationConsecutiveFailuresWarnCount,
        0,
        100000
    );
    let queryVectorAccelerationConsecutiveFailuresFailCount = normalizeInteger(
        input.queryVectorAccelerationConsecutiveFailuresFailCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationConsecutiveFailuresFailCount,
        0,
        100000
    );
    if (queryVectorAccelerationConsecutiveFailuresFailCount < queryVectorAccelerationConsecutiveFailuresWarnCount) {
        queryVectorAccelerationConsecutiveFailuresFailCount = queryVectorAccelerationConsecutiveFailuresWarnCount;
    }
    const queryVectorAccelerationHalfOpenSuccessWarnRatioPct = normalizeRatio(
        input.queryVectorAccelerationHalfOpenSuccessWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationHalfOpenSuccessWarnRatioPct
    );
    let queryVectorAccelerationHalfOpenSuccessFailRatioPct = normalizeRatio(
        input.queryVectorAccelerationHalfOpenSuccessFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationHalfOpenSuccessFailRatioPct
    );
    if (queryVectorAccelerationHalfOpenSuccessFailRatioPct > queryVectorAccelerationHalfOpenSuccessWarnRatioPct) {
        queryVectorAccelerationHalfOpenSuccessFailRatioPct = queryVectorAccelerationHalfOpenSuccessWarnRatioPct;
    }
    const queryVectorAccelerationPrefilterMinRequestSample = normalizeInteger(
        input.queryVectorAccelerationPrefilterMinRequestSample,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterMinRequestSample,
        1,
        100000
    );
    const queryVectorAccelerationPrefilterWarnCandidateRatioPct = normalizeRatio(
        input.queryVectorAccelerationPrefilterWarnCandidateRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterWarnCandidateRatioPct
    );
    let queryVectorAccelerationPrefilterFailCandidateRatioPct = normalizeRatio(
        input.queryVectorAccelerationPrefilterFailCandidateRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterFailCandidateRatioPct
    );
    if (queryVectorAccelerationPrefilterFailCandidateRatioPct < queryVectorAccelerationPrefilterWarnCandidateRatioPct) {
        queryVectorAccelerationPrefilterFailCandidateRatioPct = queryVectorAccelerationPrefilterWarnCandidateRatioPct;
    }
    const storeGraphDbConnectorMinRequestSample = normalizeInteger(
        input.storeGraphDbConnectorMinRequestSample,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.storeGraphDbConnectorMinRequestSample,
        1,
        100000
    );
    const storeGraphDbConnectorFailureWarnRatioPct = normalizeRatio(
        input.storeGraphDbConnectorFailureWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.storeGraphDbConnectorFailureWarnRatioPct
    );
    let storeGraphDbConnectorFailureFailRatioPct = normalizeRatio(
        input.storeGraphDbConnectorFailureFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.storeGraphDbConnectorFailureFailRatioPct
    );
    if (storeGraphDbConnectorFailureFailRatioPct < storeGraphDbConnectorFailureWarnRatioPct) {
        storeGraphDbConnectorFailureFailRatioPct = storeGraphDbConnectorFailureWarnRatioPct;
    }
    const storeGraphDbConnectorShortCircuitWarnRatioPct = normalizeRatio(
        input.storeGraphDbConnectorShortCircuitWarnRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.storeGraphDbConnectorShortCircuitWarnRatioPct
    );
    let storeGraphDbConnectorShortCircuitFailRatioPct = normalizeRatio(
        input.storeGraphDbConnectorShortCircuitFailRatioPct,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.storeGraphDbConnectorShortCircuitFailRatioPct
    );
    if (storeGraphDbConnectorShortCircuitFailRatioPct < storeGraphDbConnectorShortCircuitWarnRatioPct) {
        storeGraphDbConnectorShortCircuitFailRatioPct = storeGraphDbConnectorShortCircuitWarnRatioPct;
    }
    const storeGraphDbConnectorConsecutiveFailuresWarnCount = normalizeInteger(
        input.storeGraphDbConnectorConsecutiveFailuresWarnCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.storeGraphDbConnectorConsecutiveFailuresWarnCount,
        0,
        100000
    );
    let storeGraphDbConnectorConsecutiveFailuresFailCount = normalizeInteger(
        input.storeGraphDbConnectorConsecutiveFailuresFailCount,
        DEFAULT_RUNTIME_CAPABILITY_THRESHOLDS.storeGraphDbConnectorConsecutiveFailuresFailCount,
        0,
        100000
    );
    if (storeGraphDbConnectorConsecutiveFailuresFailCount < storeGraphDbConnectorConsecutiveFailuresWarnCount) {
        storeGraphDbConnectorConsecutiveFailuresFailCount = storeGraphDbConnectorConsecutiveFailuresWarnCount;
    }
    return {
        minQuerySampleSize,
        queryFallbackWarnRatioPct,
        queryFallbackFailRatioPct,
        queryEvidenceCoverageWarnRatioPct,
        queryEvidenceCoverageFailRatioPct,
        queryTemporalValidityWarnRatioPct,
        queryTemporalValidityFailRatioPct,
        queryBackendExplainabilityGapWarnRatioPct,
        queryBackendExplainabilityGapFailRatioPct,
        queryBackendTrendWarnConfidenceRatioPct,
        queryBackendTrendFailConfidenceRatioPct,
        sessionPlanQualityWarnFailureStreak,
        sessionPlanQualityFailFailureStreak,
        apiInvalidRequestMinErrorSample,
        apiInvalidRequestWarnRatioPct,
        apiInvalidRequestFailRatioPct,
        apiInvalidRequestHotspotWarnCount,
        apiInvalidRequestHotspotFailCount,
        apiServerErrorMinRequestSample,
        apiServerErrorWarnRatioPct,
        apiServerErrorFailRatioPct,
        apiServerErrorHotspotWarnCount,
        apiServerErrorHotspotFailCount,
        apiTransientErrorMinRequestSample,
        apiTransientErrorWarnRatioPct,
        apiTransientErrorFailRatioPct,
        apiTransientErrorHotspotWarnCount,
        apiTransientErrorHotspotFailCount,
        apiLatencyMinRequestSample,
        apiLatencyP95WarnMs,
        apiLatencyP95FailMs,
        apiLatencyHotspotWarnMs,
        apiLatencyHotspotFailMs,
        queryVectorAccelerationShortCircuitWarnCount,
        queryVectorAccelerationShortCircuitFailCount,
        queryVectorAccelerationShortCircuitWarnRatioPct,
        queryVectorAccelerationShortCircuitFailRatioPct,
        queryVectorAccelerationConsecutiveFailuresWarnCount,
        queryVectorAccelerationConsecutiveFailuresFailCount,
        queryVectorAccelerationHalfOpenSuccessWarnRatioPct,
        queryVectorAccelerationHalfOpenSuccessFailRatioPct,
        queryVectorAccelerationPrefilterMinRequestSample,
        queryVectorAccelerationPrefilterWarnCandidateRatioPct,
        queryVectorAccelerationPrefilterFailCandidateRatioPct,
        storeGraphDbConnectorMinRequestSample,
        storeGraphDbConnectorFailureWarnRatioPct,
        storeGraphDbConnectorFailureFailRatioPct,
        storeGraphDbConnectorShortCircuitWarnRatioPct,
        storeGraphDbConnectorShortCircuitFailRatioPct,
        storeGraphDbConnectorConsecutiveFailuresWarnCount,
        storeGraphDbConnectorConsecutiveFailuresFailCount,
    };
}

export function resolveRuntimeCapabilityThresholdsFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeCapabilityThresholds {
    return normalizeRuntimeCapabilityThresholds({
        minQuerySampleSize: env.NOTE_CONNECTION_RUNTIME_QUERY_MIN_SAMPLE,
        queryFallbackWarnRatioPct: env.NOTE_CONNECTION_RUNTIME_QUERY_FALLBACK_WARN_RATIO_PCT,
        queryFallbackFailRatioPct: env.NOTE_CONNECTION_RUNTIME_QUERY_FALLBACK_FAIL_RATIO_PCT,
        queryEvidenceCoverageWarnRatioPct: env.NOTE_CONNECTION_RUNTIME_QUERY_EVIDENCE_COVERAGE_WARN_RATIO_PCT,
        queryEvidenceCoverageFailRatioPct: env.NOTE_CONNECTION_RUNTIME_QUERY_EVIDENCE_COVERAGE_FAIL_RATIO_PCT,
        queryTemporalValidityWarnRatioPct: env.NOTE_CONNECTION_RUNTIME_QUERY_TEMPORAL_VALIDITY_WARN_RATIO_PCT,
        queryTemporalValidityFailRatioPct: env.NOTE_CONNECTION_RUNTIME_QUERY_TEMPORAL_VALIDITY_FAIL_RATIO_PCT,
        queryBackendExplainabilityGapWarnRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_EXPLAINABILITY_GAP_WARN_RATIO_PCT,
        queryBackendExplainabilityGapFailRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_EXPLAINABILITY_GAP_FAIL_RATIO_PCT,
        queryBackendTrendWarnConfidenceRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_TREND_WARN_CONFIDENCE_PCT,
        queryBackendTrendFailConfidenceRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_TREND_FAIL_CONFIDENCE_PCT,
        sessionPlanQualityWarnFailureStreak: env.NOTE_CONNECTION_RUNTIME_SESSION_PLAN_QUALITY_WARN_FAILURE_STREAK,
        sessionPlanQualityFailFailureStreak: env.NOTE_CONNECTION_RUNTIME_SESSION_PLAN_QUALITY_FAIL_FAILURE_STREAK,
        apiInvalidRequestMinErrorSample: env.NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_MIN_ERROR_SAMPLE,
        apiInvalidRequestWarnRatioPct: env.NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_WARN_RATIO_PCT,
        apiInvalidRequestFailRatioPct: env.NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_FAIL_RATIO_PCT,
        apiInvalidRequestHotspotWarnCount: env.NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_HOTSPOT_WARN_COUNT,
        apiInvalidRequestHotspotFailCount: env.NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_HOTSPOT_FAIL_COUNT,
        apiServerErrorMinRequestSample: env.NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_MIN_REQUEST_SAMPLE,
        apiServerErrorWarnRatioPct: env.NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_WARN_RATIO_PCT,
        apiServerErrorFailRatioPct: env.NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_FAIL_RATIO_PCT,
        apiServerErrorHotspotWarnCount: env.NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_HOTSPOT_WARN_COUNT,
        apiServerErrorHotspotFailCount: env.NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_HOTSPOT_FAIL_COUNT,
        apiTransientErrorMinRequestSample: env.NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_MIN_REQUEST_SAMPLE,
        apiTransientErrorWarnRatioPct: env.NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_WARN_RATIO_PCT,
        apiTransientErrorFailRatioPct: env.NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_FAIL_RATIO_PCT,
        apiTransientErrorHotspotWarnCount: env.NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_HOTSPOT_WARN_COUNT,
        apiTransientErrorHotspotFailCount: env.NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_HOTSPOT_FAIL_COUNT,
        apiLatencyMinRequestSample: env.NOTE_CONNECTION_RUNTIME_API_LATENCY_MIN_REQUEST_SAMPLE,
        apiLatencyP95WarnMs: env.NOTE_CONNECTION_RUNTIME_API_LATENCY_P95_WARN_MS,
        apiLatencyP95FailMs: env.NOTE_CONNECTION_RUNTIME_API_LATENCY_P95_FAIL_MS,
        apiLatencyHotspotWarnMs: env.NOTE_CONNECTION_RUNTIME_API_LATENCY_HOTSPOT_WARN_MS,
        apiLatencyHotspotFailMs: env.NOTE_CONNECTION_RUNTIME_API_LATENCY_HOTSPOT_FAIL_MS,
        queryVectorAccelerationShortCircuitWarnCount:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_WARN_COUNT,
        queryVectorAccelerationShortCircuitFailCount:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_FAIL_COUNT,
        queryVectorAccelerationShortCircuitWarnRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_WARN_RATIO_PCT,
        queryVectorAccelerationShortCircuitFailRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_FAIL_RATIO_PCT,
        queryVectorAccelerationConsecutiveFailuresWarnCount:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_CONSECUTIVE_FAILURES_WARN_COUNT,
        queryVectorAccelerationConsecutiveFailuresFailCount:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_CONSECUTIVE_FAILURES_FAIL_COUNT,
        queryVectorAccelerationHalfOpenSuccessWarnRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_HALF_OPEN_SUCCESS_WARN_RATIO_PCT,
        queryVectorAccelerationHalfOpenSuccessFailRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_HALF_OPEN_SUCCESS_FAIL_RATIO_PCT,
        queryVectorAccelerationPrefilterMinRequestSample:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_MIN_REQUEST_SAMPLE,
        queryVectorAccelerationPrefilterWarnCandidateRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_WARN_CANDIDATE_RATIO_PCT,
        queryVectorAccelerationPrefilterFailCandidateRatioPct:
            env.NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_FAIL_CANDIDATE_RATIO_PCT,
        storeGraphDbConnectorMinRequestSample:
            env.NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_MIN_REQUEST_SAMPLE,
        storeGraphDbConnectorFailureWarnRatioPct:
            env.NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_FAILURE_WARN_RATIO_PCT,
        storeGraphDbConnectorFailureFailRatioPct:
            env.NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_FAILURE_FAIL_RATIO_PCT,
        storeGraphDbConnectorShortCircuitWarnRatioPct:
            env.NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_SHORT_CIRCUIT_WARN_RATIO_PCT,
        storeGraphDbConnectorShortCircuitFailRatioPct:
            env.NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_SHORT_CIRCUIT_FAIL_RATIO_PCT,
        storeGraphDbConnectorConsecutiveFailuresWarnCount:
            env.NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_CONSECUTIVE_FAILURES_WARN_COUNT,
        storeGraphDbConnectorConsecutiveFailuresFailCount:
            env.NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_CONSECUTIVE_FAILURES_FAIL_COUNT,
    });
}

export function buildRuntimeCapabilityMatrix(params: RuntimeCapabilityMatrixInput): RuntimeCapabilityMatrix {
    const thresholds = normalizeRuntimeCapabilityThresholds(params.thresholds || {});
    const checks: RuntimeCapabilityCheck[] = [];
    const safeQueryCount = Math.max(0, Math.floor(Number(params.queryCount || 0)));
    const safeFallbackCount = Math.max(0, Math.floor(Number(params.queryDiagnostics.fallbackCount || 0)));
    const queryFallbackRatioPct = Number(
        ((safeFallbackCount / Math.max(1, safeQueryCount)) * 100).toFixed(4)
    );
    const graphDbConnectorHealthStatusRaw = String(params.store.connector?.healthStatus || '')
        .trim()
        .toLowerCase();
    const graphDbConnectorHealthStatus: RuntimeCapabilityMatrix['signals']['graphDbConnectorHealthStatus'] = (
        graphDbConnectorHealthStatusRaw === 'ready'
        || graphDbConnectorHealthStatusRaw === 'degraded'
        || graphDbConnectorHealthStatusRaw === 'unavailable'
    ) ? graphDbConnectorHealthStatusRaw : 'unknown';
    const graphDbConnectorHealthMessage = String(params.store.connector?.healthMessage || '')
        .trim()
        .slice(0, 240);
    const graphDbConnectorCircuitStateRaw = String(params.store.connector?.circuitState || '')
        .trim()
        .toLowerCase();
    const graphDbConnectorCircuitState: RuntimeCapabilityMatrix['signals']['graphDbConnectorCircuitState'] = (
        graphDbConnectorCircuitStateRaw === 'closed'
        || graphDbConnectorCircuitStateRaw === 'open'
        || graphDbConnectorCircuitStateRaw === 'half_open'
    ) ? graphDbConnectorCircuitStateRaw : 'unknown';
    const graphDbConnectorRequestCount = Math.max(
        0,
        Math.floor(Number(params.store.connector?.requestCount || 0))
    );
    const graphDbConnectorRetryCount = Math.max(
        0,
        Math.floor(Number(params.store.connector?.retryCount || 0))
    );
    const graphDbConnectorShortCircuitCount = Math.max(
        0,
        Math.floor(Number(params.store.connector?.shortCircuitCount || 0))
    );
    const graphDbConnectorSuccessCount = Math.max(
        0,
        Math.floor(Number(params.store.connector?.successCount || 0))
    );
    const graphDbConnectorFailureCount = Math.max(
        0,
        Math.floor(Number(params.store.connector?.failureCount || 0))
    );
    const graphDbConnectorConsecutiveFailures = Math.max(
        0,
        Math.floor(Number(params.store.connector?.consecutiveFailures || 0))
    );
    const graphDbConnectorFailureRatioPct = Number((
        graphDbConnectorRequestCount > 0
            ? (
                graphDbConnectorFailureCount
                / graphDbConnectorRequestCount
            ) * 100
            : 0
    ).toFixed(4));
    const graphDbConnectorShortCircuitRatioPct = Number((
        graphDbConnectorRequestCount > 0
            ? (
                graphDbConnectorShortCircuitCount
                / graphDbConnectorRequestCount
            ) * 100
            : 0
    ).toFixed(4));
    const shouldEvaluateGraphDbConnectorBudget = (
        params.configuredStoreBackend === 'graphdb'
        && params.store.storeType === 'graphdb'
        && params.store.backendReady !== false
        && params.store.usingFallback !== true
    );
    const graphDbConnectorBudgetMeetsMinSample =
        graphDbConnectorRequestCount >= thresholds.storeGraphDbConnectorMinRequestSample;
    const graphDbConnectorFailureWarnBudgetExceeded = (
        graphDbConnectorBudgetMeetsMinSample
        && graphDbConnectorFailureRatioPct >= thresholds.storeGraphDbConnectorFailureWarnRatioPct
    );
    const graphDbConnectorFailureFailBudgetExceeded = (
        graphDbConnectorBudgetMeetsMinSample
        && graphDbConnectorFailureRatioPct >= thresholds.storeGraphDbConnectorFailureFailRatioPct
    );
    const graphDbConnectorShortCircuitWarnBudgetExceeded = (
        graphDbConnectorBudgetMeetsMinSample
        && graphDbConnectorShortCircuitRatioPct >= thresholds.storeGraphDbConnectorShortCircuitWarnRatioPct
    );
    const graphDbConnectorShortCircuitFailBudgetExceeded = (
        graphDbConnectorBudgetMeetsMinSample
        && graphDbConnectorShortCircuitRatioPct >= thresholds.storeGraphDbConnectorShortCircuitFailRatioPct
    );
    const graphDbConnectorConsecutiveFailuresWarnBudgetExceeded = (
        graphDbConnectorBudgetMeetsMinSample
        && graphDbConnectorConsecutiveFailures >= thresholds.storeGraphDbConnectorConsecutiveFailuresWarnCount
    );
    const graphDbConnectorConsecutiveFailuresFailBudgetExceeded = (
        graphDbConnectorBudgetMeetsMinSample
        && graphDbConnectorConsecutiveFailures >= thresholds.storeGraphDbConnectorConsecutiveFailuresFailCount
    );
    const graphDbConnectorFailBudgetExceeded = (
        shouldEvaluateGraphDbConnectorBudget
        && (
            graphDbConnectorCircuitState === 'open'
            || graphDbConnectorFailureFailBudgetExceeded
            || graphDbConnectorShortCircuitFailBudgetExceeded
            || graphDbConnectorConsecutiveFailuresFailBudgetExceeded
        )
    );
    const graphDbConnectorWarnBudgetExceeded = (
        shouldEvaluateGraphDbConnectorBudget
        && (
            graphDbConnectorFailBudgetExceeded
            || graphDbConnectorCircuitState === 'half_open'
            || graphDbConnectorFailureWarnBudgetExceeded
            || graphDbConnectorShortCircuitWarnBudgetExceeded
            || graphDbConnectorConsecutiveFailuresWarnBudgetExceeded
        )
    );
    const graphDbConnectorBudgetStatus: RuntimeCapabilityMatrix['signals']['graphDbConnectorBudgetStatus'] =
        graphDbConnectorFailBudgetExceeded
            ? 'fail'
            : (graphDbConnectorWarnBudgetExceeded ? 'warn' : 'ok');
    const graphDbConnectorLastRequestId = String(params.store.connector?.lastRequestId || '')
        .trim()
        .replace(/[^a-zA-Z0-9._:-]+/g, '')
        .slice(0, 96);
    const graphDbConnectorLastErrorCode = String(params.store.connector?.lastErrorCode || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, '_')
        .slice(0, 96);
    const graphDbConnectorLastStatusCode = Math.max(
        0,
        Math.floor(Number(params.store.connector?.lastStatusCode || 0))
    );
    const graphDbConnectorLastRetryAfterMs = Math.max(
        0,
        Math.floor(Number(params.store.connector?.lastRetryAfterMs || 0))
    );
    const queryBackendRuntimeId = String(params.queryDiagnostics.runtime?.backendId || '')
        .trim()
        .slice(0, 128);
    const queryBackendRuntimeReady = params.queryDiagnostics.runtime?.ready !== false;
    const queryVectorIndexEnabled = params.queryDiagnostics.runtime?.vectorIndex?.enabled === true;
    const queryVectorIndexStatusRaw = String(
        params.queryDiagnostics.runtime?.vectorIndex?.status || ''
    ).trim().toLowerCase();
    const queryVectorIndexStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexStatus'] = (
        queryVectorIndexStatusRaw === 'ready'
        || queryVectorIndexStatusRaw === 'stale'
        || queryVectorIndexStatusRaw === 'unavailable'
    ) ? queryVectorIndexStatusRaw : 'unknown';
    const queryVectorIndexPersisted = params.queryDiagnostics.runtime?.vectorIndex?.persisted === true;
    const queryVectorIndexLoadedFromDisk = params.queryDiagnostics.runtime?.vectorIndex?.loadedFromDisk === true;
    const queryVectorIndexAtomCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.atomCount || 0))
    );
    const queryVectorIndexLocation = String(params.queryDiagnostics.runtime?.vectorIndex?.location || '')
        .trim()
        .slice(0, 256);
    const queryVectorIndexAccelerationEnabled =
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.enabled === true;
    const queryVectorIndexAccelerationModeRaw = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.mode || ''
    ).trim().toLowerCase();
    const queryVectorIndexAccelerationMode: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationMode'] = (
        queryVectorIndexAccelerationModeRaw === 'ann_prefilter'
        || queryVectorIndexAccelerationModeRaw === 'full_scan'
    ) ? queryVectorIndexAccelerationModeRaw : 'unknown';
    const queryVectorIndexAccelerationLastSelectionModeRaw = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.lastSelectionMode || ''
    ).trim().toLowerCase();
    const queryVectorIndexAccelerationLastSelectionMode:
        RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationLastSelectionMode'] = (
        queryVectorIndexAccelerationLastSelectionModeRaw === 'full_scan'
        || queryVectorIndexAccelerationLastSelectionModeRaw === 'token_prefilter'
        || queryVectorIndexAccelerationLastSelectionModeRaw === 'token_signature_prefilter'
    ) ? queryVectorIndexAccelerationLastSelectionModeRaw : 'unknown';
    const queryVectorIndexAccelerationLastCandidateCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.lastCandidateCount || 0))
    );
    const queryVectorIndexAccelerationAdapterId = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.adapterId || ''
    ).trim().slice(0, 160);
    const queryVectorIndexAccelerationAdapterError = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.adapterError || ''
    ).trim().slice(0, 240);
    const queryVectorIndexAccelerationHealthStatusRaw = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.healthStatus || ''
    ).trim().toLowerCase();
    const queryVectorIndexAccelerationHealthStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationHealthStatus'] = (
        queryVectorIndexAccelerationHealthStatusRaw === 'ready'
        || queryVectorIndexAccelerationHealthStatusRaw === 'degraded'
        || queryVectorIndexAccelerationHealthStatusRaw === 'unavailable'
        || queryVectorIndexAccelerationHealthStatusRaw === 'unknown'
    ) ? queryVectorIndexAccelerationHealthStatusRaw : 'unknown';
    const queryVectorIndexAccelerationHealthMessage = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.healthMessage || ''
    ).trim().slice(0, 240);
    const queryVectorIndexAccelerationRepresentationVersion = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.representationVersion || ''
    ).trim().slice(0, 160);
    const queryVectorIndexAccelerationEmbeddingModelId = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.embeddingModelId || ''
    ).trim().slice(0, 160);
    const queryVectorIndexAccelerationEmbeddingDimension = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.embeddingDimension || 0))
    );
    const queryVectorIndexAccelerationIndexSignature = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.indexSignature || ''
    ).trim().replace(/[^a-zA-Z0-9:_-]+/g, '').slice(0, 200);
    const queryVectorIndexAccelerationRepresentationStatusRaw = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.representationStatus || ''
    ).trim().toLowerCase();
    const queryVectorIndexAccelerationRepresentationStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationRepresentationStatus'] = (
        queryVectorIndexAccelerationRepresentationStatusRaw === 'aligned'
        || queryVectorIndexAccelerationRepresentationStatusRaw === 'mismatch'
        || queryVectorIndexAccelerationRepresentationStatusRaw === 'unknown'
    ) ? queryVectorIndexAccelerationRepresentationStatusRaw : 'unknown';
    const queryVectorIndexAccelerationRepresentationStatusReason = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.representationStatusReason || ''
    ).trim().replace(/\s+/g, ' ').slice(0, 240);
    const queryVectorIndexAccelerationRepresentationStrictMode =
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.representationStrictMode === true;
    const queryVectorIndexAccelerationLastRequestId = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.lastRequestId || ''
    ).trim().replace(/[^a-zA-Z0-9._:-]+/g, '').slice(0, 96);
    const queryVectorIndexAccelerationLastErrorCode = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.lastErrorCode || ''
    ).trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').slice(0, 96);
    const queryVectorIndexAccelerationLastRetryAfterMs = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.lastRetryAfterMs || 0))
    );
    const queryVectorIndexAccelerationCircuitStateRaw = String(
        params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.circuitState || ''
    ).trim().toLowerCase();
    const queryVectorIndexAccelerationCircuitState: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationCircuitState'] = (
        queryVectorIndexAccelerationCircuitStateRaw === 'closed'
        || queryVectorIndexAccelerationCircuitStateRaw === 'open'
        || queryVectorIndexAccelerationCircuitStateRaw === 'half_open'
        || queryVectorIndexAccelerationCircuitStateRaw === 'unknown'
    ) ? queryVectorIndexAccelerationCircuitStateRaw : 'unknown';
    const queryVectorIndexAccelerationConsecutiveFailures = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.consecutiveFailures || 0))
    );
    const queryVectorIndexAccelerationRequestCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.requestCount || 0))
    );
    const queryVectorIndexAccelerationRetryCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.retryCount || 0))
    );
    const queryVectorIndexAccelerationShortCircuitCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.shortCircuitCount || 0))
    );
    const queryVectorIndexAccelerationSuccessCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.successCount || 0))
    );
    const queryVectorIndexAccelerationFailureCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.failureCount || 0))
    );
    const queryVectorIndexAccelerationHalfOpenProbeSuccessCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.halfOpenProbeSuccessCount || 0))
    );
    const queryVectorIndexAccelerationHalfOpenProbeFailureCount = Math.max(
        0,
        Math.floor(Number(params.queryDiagnostics.runtime?.vectorIndex?.acceleration?.halfOpenProbeFailureCount || 0))
    );
    const queryVectorIndexAccelerationHalfOpenProbeCount =
        queryVectorIndexAccelerationHalfOpenProbeSuccessCount
        + queryVectorIndexAccelerationHalfOpenProbeFailureCount;
    const queryVectorIndexAccelerationHalfOpenSuccessRatePct = Number((
        queryVectorIndexAccelerationHalfOpenProbeCount > 0
            ? (
                queryVectorIndexAccelerationHalfOpenProbeSuccessCount
                / queryVectorIndexAccelerationHalfOpenProbeCount
            ) * 100
            : 0
    ).toFixed(4));
    const queryVectorIndexAccelerationShortCircuitRatioPct = Number((
        queryVectorIndexAccelerationRequestCount > 0
            ? (
                queryVectorIndexAccelerationShortCircuitCount
                / queryVectorIndexAccelerationRequestCount
            ) * 100
            : 0
    ).toFixed(4));
    let queryVectorIndexAccelerationCircuitWarnBudgetExceeded = false;
    let queryVectorIndexAccelerationCircuitFailBudgetExceeded = false;
    let queryVectorIndexAccelerationCircuitBudgetStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationCircuitBudgetStatus'] = 'ok';
    const queryExplainabilitySampleCount = Math.max(
        0,
        Math.floor(Number(params.queryExplainabilityTelemetry?.sampleCount || 0))
    );
    const queryEvidenceCoverageRatioPct = Number(
        clamp(Number(params.queryExplainabilityTelemetry?.evidenceCoverageRatioPct || 0), 0, 100).toFixed(4)
    );
    const queryRelationPathCoverageRatioPct = Number(
        clamp(Number(params.queryExplainabilityTelemetry?.relationPathCoverageRatioPct || 0), 0, 100).toFixed(4)
    );
    const queryTemporalValidityPassRatioPct = Number(
        clamp(Number(params.queryExplainabilityTelemetry?.temporalValidityPassRatioPct || 0), 0, 100).toFixed(4)
    );
    const queryAverageEvidenceSpanCount = Number(
        clamp(Number(params.queryExplainabilityTelemetry?.averageEvidenceSpanCount || 0), 0, 1000).toFixed(4)
    );
    const queryAverageRelationPathLength = Number(
        clamp(Number(params.queryExplainabilityTelemetry?.averageRelationPathLength || 0), 0, 1000).toFixed(4)
    );
    const queryBackendComparisonSampleCount = Math.max(
        0,
        Math.floor(Number(params.queryBackendComparisonTelemetry?.summary?.returnedRecords || 0))
    );
    const queryBackendComparisonEvidenceGapRatioPct = Number((
        Math.abs(
            Number(params.queryBackendComparisonTelemetry?.summary?.averageLeftEvidenceCoverageRatio || 0)
            - Number(params.queryBackendComparisonTelemetry?.summary?.averageRightEvidenceCoverageRatio || 0)
        ) * 100
    ).toFixed(4));
    const queryBackendComparisonRelationGapRatioPct = Number((
        Math.abs(
            Number(params.queryBackendComparisonTelemetry?.summary?.averageLeftRelationPathCoverageRatio || 0)
            - Number(params.queryBackendComparisonTelemetry?.summary?.averageRightRelationPathCoverageRatio || 0)
        ) * 100
    ).toFixed(4));
    const queryBackendComparisonTemporalGapRatioPct = Number((
        Math.abs(
            Number(params.queryBackendComparisonTelemetry?.summary?.averageLeftTemporalValidityPassRatio || 0)
            - Number(params.queryBackendComparisonTelemetry?.summary?.averageRightTemporalValidityPassRatio || 0)
        ) * 100
    ).toFixed(4));
    const queryBackendComparisonMaxExplainabilityGapRatioPct = Number(Math.max(
        queryBackendComparisonEvidenceGapRatioPct,
        queryBackendComparisonRelationGapRatioPct,
        queryBackendComparisonTemporalGapRatioPct
    ).toFixed(4));
    const queryBackendTrendStatusRaw = String(
        params.queryBackendComparisonTrend?.status || ''
    ).trim().toLowerCase();
    const hasQueryBackendComparisonTrendSignal = Boolean(params.queryBackendComparisonTrend);
    const queryBackendComparisonTrendStatus: RuntimeCapabilityMatrix['signals']['queryBackendComparisonTrendStatus'] = (
        queryBackendTrendStatusRaw === 'improving'
        || queryBackendTrendStatusRaw === 'stable'
        || queryBackendTrendStatusRaw === 'regressing'
        || queryBackendTrendStatusRaw === 'insufficient_data'
    ) ? queryBackendTrendStatusRaw : 'unknown';
    const queryBackendComparisonTrendScore = Number(
        (
            Number.isFinite(Number(params.queryBackendComparisonTrend?.score))
                ? Number(params.queryBackendComparisonTrend?.score)
                : 0
        ).toFixed(4)
    );
    const queryBackendComparisonTrendConfidence = Number(
        (
            Number.isFinite(Number(params.queryBackendComparisonTrend?.confidence))
                ? clamp(Number(params.queryBackendComparisonTrend?.confidence), 0, 1)
                : 0
        ).toFixed(4)
    );
    const queryBackendComparisonTrendConfidenceRatioPct = Number(
        (queryBackendComparisonTrendConfidence * 100).toFixed(4)
    );
    const queryBackendComparisonTrendReason = String(
        params.queryBackendComparisonTrend?.summary?.reason || ''
    ).trim();
    const hasQueryBackendComparisonTrendConfig = Boolean(params.queryBackendComparisonTrendConfig);
    const queryBackendComparisonTrendLimit = hasQueryBackendComparisonTrendConfig
        ? Math.max(2, Math.floor(Number(params.queryBackendComparisonTrendConfig?.limit || 0)))
        : 0;
    const queryBackendComparisonTrendWindowSize = hasQueryBackendComparisonTrendConfig
        ? Math.max(1, Math.floor(Number(params.queryBackendComparisonTrendConfig?.windowSize || 0)))
        : 0;
    const queryBackendComparisonTrendMinSamples = hasQueryBackendComparisonTrendConfig
        ? clamp(
            Math.floor(Number(params.queryBackendComparisonTrendConfig?.minSamples || 0)),
            1,
            Math.max(1, queryBackendComparisonTrendWindowSize)
        )
        : 0;
    const queryBackendComparisonTrendRequiredRecords = hasQueryBackendComparisonTrendConfig
        ? queryBackendComparisonTrendWindowSize + queryBackendComparisonTrendMinSamples
        : 0;
    const queryBackendComparisonTrendObserved = [
        `status=${queryBackendComparisonTrendStatus}`,
        `score=${queryBackendComparisonTrendScore}`,
        `confidence=${queryBackendComparisonTrendConfidence}`,
        hasQueryBackendComparisonTrendConfig
            ? `config(limit=${queryBackendComparisonTrendLimit},windowSize=${queryBackendComparisonTrendWindowSize},minSamples=${queryBackendComparisonTrendMinSamples})`
            : '',
        queryBackendComparisonTrendReason
            ? `reason=${queryBackendComparisonTrendReason}`
            : '',
    ].filter(Boolean).join(', ');
    const hasApiRequestErrorTelemetry = Boolean(params.apiRequestErrorTelemetry);
    const apiTraceWindowRequests = Math.max(
        0,
        Math.floor(Number(params.apiRequestErrorTelemetry?.totalRequests || 0))
    );
    const apiTraceWindowErrors = Math.max(
        0,
        Math.floor(Number(params.apiRequestErrorTelemetry?.errorRequests || 0))
    );
    const apiTraceWindowInvalidRequests = Math.max(
        0,
        Math.floor(Number(params.apiRequestErrorTelemetry?.invalidRequestErrors || 0))
    );
    const apiTraceWindowServerErrors = Math.max(
        0,
        Math.floor(Number(params.apiRequestErrorTelemetry?.serverErrorRequests || 0))
    );
    const apiTraceWindowTransientErrors = Math.max(
        0,
        Math.floor(Number(params.apiRequestErrorTelemetry?.transientErrorRequests || 0))
    );
    const apiTraceAverageDurationMs = Number(
        clamp(Number(params.apiRequestErrorTelemetry?.averageDurationMs || 0), 0, 600000).toFixed(4)
    );
    const apiTraceP95DurationMs = Number(
        clamp(Number(params.apiRequestErrorTelemetry?.p95DurationMs || 0), 0, 600000).toFixed(4)
    );
    const apiTraceWindowInvalidRequestRatioPct = Number(
        (
            (apiTraceWindowInvalidRequests / Math.max(1, apiTraceWindowErrors)) * 100
        ).toFixed(4)
    );
    const apiTraceWindowInvalidRequestToTotalRatioPct = Number(
        (
            (apiTraceWindowInvalidRequests / Math.max(1, apiTraceWindowRequests)) * 100
        ).toFixed(4)
    );
    const apiTraceWindowServerErrorRatioPct = Number(
        (
            (apiTraceWindowServerErrors / Math.max(1, apiTraceWindowRequests)) * 100
        ).toFixed(4)
    );
    const apiTraceWindowTransientErrorRatioPct = Number(
        (
            (apiTraceWindowTransientErrors / Math.max(1, apiTraceWindowRequests)) * 100
        ).toFixed(4)
    );
    const apiTraceScopePathPrefix = String(
        params.apiRequestErrorTelemetry?.scopePathPrefix || ''
    ).trim().slice(0, 128);
    const apiTraceScopeMethod = normalizeRuntimeCapabilityHttpMethod(
        params.apiRequestErrorTelemetry?.scopeMethod || ''
    );
    const apiTraceWindowInvalidRequestTopPaths = Array.isArray(
        params.apiRequestErrorTelemetry?.invalidRequestTopPaths
    )
        ? params.apiRequestErrorTelemetry?.invalidRequestTopPaths
            .map((item) => {
                const path = String(item?.path || '').trim().slice(0, 256);
                const count = Math.max(0, Math.floor(Number(item?.count || 0)));
                if (!path || count <= 0) {
                    return null;
                }
                return { path, count };
            })
            .filter((item): item is { path: string; count: number } => Boolean(item))
            .slice(0, 5)
        : [];
    const apiTraceWindowServerErrorTopPaths = Array.isArray(
        params.apiRequestErrorTelemetry?.serverErrorTopPaths
    )
        ? params.apiRequestErrorTelemetry?.serverErrorTopPaths
            .map((item) => {
                const path = String(item?.path || '').trim().slice(0, 256);
                const count = Math.max(0, Math.floor(Number(item?.count || 0)));
                if (!path || count <= 0) {
                    return null;
                }
                return { path, count };
            })
            .filter((item): item is { path: string; count: number } => Boolean(item))
            .slice(0, 5)
        : [];
    const apiTraceWindowTransientErrorTopPaths = Array.isArray(
        params.apiRequestErrorTelemetry?.transientErrorTopPaths
    )
        ? params.apiRequestErrorTelemetry?.transientErrorTopPaths
            .map((item) => {
                const path = String(item?.path || '').trim().slice(0, 256);
                const count = Math.max(0, Math.floor(Number(item?.count || 0)));
                if (!path || count <= 0) {
                    return null;
                }
                return { path, count };
            })
            .filter((item): item is { path: string; count: number } => Boolean(item))
            .slice(0, 5)
        : [];
    const apiTraceSlowTopPaths = Array.isArray(
        params.apiRequestErrorTelemetry?.slowTopPaths
    )
        ? params.apiRequestErrorTelemetry?.slowTopPaths
            .map((item) => {
                const path = String(item?.path || '').trim().slice(0, 256);
                const count = Math.max(0, Math.floor(Number(item?.count || 0)));
                const p95DurationMs = Number(
                    clamp(Number(item?.p95DurationMs || 0), 0, 600000).toFixed(4)
                );
                if (!path || count <= 0) {
                    return null;
                }
                return { path, count, p95DurationMs };
            })
            .filter((item): item is { path: string; count: number; p95DurationMs: number } => Boolean(item))
            .slice(0, 5)
        : [];
    const apiServerErrorHotspotPeakCount = apiTraceWindowServerErrorTopPaths.length > 0
        ? Number(apiTraceWindowServerErrorTopPaths[0]?.count || 0)
        : 0;
    const apiTransientErrorHotspotPeakCount = apiTraceWindowTransientErrorTopPaths.length > 0
        ? Number(apiTraceWindowTransientErrorTopPaths[0]?.count || 0)
        : 0;
    const apiInvalidRequestHotspotPeakCount = apiTraceWindowInvalidRequestTopPaths.length > 0
        ? Number(apiTraceWindowInvalidRequestTopPaths[0]?.count || 0)
        : 0;
    const apiInvalidRequestTopRoute = parseRuntimeCapabilityApiTraceRoute(
        apiTraceWindowInvalidRequestTopPaths[0]?.path || ''
    );
    const apiServerErrorTopRoute = parseRuntimeCapabilityApiTraceRoute(
        apiTraceWindowServerErrorTopPaths[0]?.path || ''
    );
    const apiTransientErrorTopRoute = parseRuntimeCapabilityApiTraceRoute(
        apiTraceWindowTransientErrorTopPaths[0]?.path || ''
    );
    const apiLatencyTopRoute = parseRuntimeCapabilityApiTraceRoute(
        apiTraceSlowTopPaths[0]?.path || ''
    );
    const apiInvalidRequestHotspotsSummary = apiTraceWindowInvalidRequestTopPaths.length > 0
        ? apiTraceWindowInvalidRequestTopPaths
            .map((item) => `${item.path}:${item.count}`)
            .join('|')
        : 'none';
    const apiServerErrorTopPathsSummary = apiTraceWindowServerErrorTopPaths.length > 0
        ? apiTraceWindowServerErrorTopPaths
            .map((item) => `${item.path}:${item.count}`)
            .join('|')
        : 'none';
    const apiTransientErrorTopPathsSummary = apiTraceWindowTransientErrorTopPaths.length > 0
        ? apiTraceWindowTransientErrorTopPaths
            .map((item) => `${item.path}:${item.count}`)
            .join('|')
        : 'none';
    const apiLatencyTopPathsSummary = apiTraceSlowTopPaths.length > 0
        ? apiTraceSlowTopPaths
            .map((item) => `${item.path}:${item.count}@${Number(item.p95DurationMs || 0).toFixed(2)}ms`)
            .join('|')
        : 'none';
    const defaultApiTraceHintPathPrefix = apiTraceScopePathPrefix || '/api/knowledge';
    const defaultApiTraceHintMethod = apiTraceScopeMethod || '';
    const apiInvalidRequestRatioDebugTraceHint = normalizeRuntimeCapabilityDebugTraceHint({
        pathPrefix: defaultApiTraceHintPathPrefix,
        statusAtLeast: 400,
        method: defaultApiTraceHintMethod,
        errorCode: 'invalid_request',
    });
    const apiInvalidRequestHotspotsDebugTraceHint = normalizeRuntimeCapabilityDebugTraceHint({
        pathPrefix: apiInvalidRequestTopRoute?.pathPrefix || defaultApiTraceHintPathPrefix,
        statusAtLeast: 400,
        method: apiInvalidRequestTopRoute?.method || defaultApiTraceHintMethod,
        errorCode: 'invalid_request',
    });
    const apiServerErrorRatioDebugTraceHint = normalizeRuntimeCapabilityDebugTraceHint({
        pathPrefix: apiServerErrorTopRoute?.pathPrefix || defaultApiTraceHintPathPrefix,
        statusAtLeast: 500,
        method: apiServerErrorTopRoute?.method || defaultApiTraceHintMethod,
        errorCode: '',
    });
    const apiServerErrorHotspotsDebugTraceHint = normalizeRuntimeCapabilityDebugTraceHint({
        pathPrefix: apiServerErrorTopRoute?.pathPrefix || defaultApiTraceHintPathPrefix,
        statusAtLeast: 500,
        method: apiServerErrorTopRoute?.method || defaultApiTraceHintMethod,
        errorCode: '',
    });
    const apiTransientErrorRatioDebugTraceHint = normalizeRuntimeCapabilityDebugTraceHint({
        pathPrefix: apiTransientErrorTopRoute?.pathPrefix || defaultApiTraceHintPathPrefix,
        statusAtLeast: 400,
        method: apiTransientErrorTopRoute?.method || defaultApiTraceHintMethod,
        errorCode: '',
    });
    const apiTransientErrorHotspotsDebugTraceHint = normalizeRuntimeCapabilityDebugTraceHint({
        pathPrefix: apiTransientErrorTopRoute?.pathPrefix || defaultApiTraceHintPathPrefix,
        statusAtLeast: 400,
        method: apiTransientErrorTopRoute?.method || defaultApiTraceHintMethod,
        errorCode: '',
    });
    const apiLatencyRatioDebugTraceHint = normalizeRuntimeCapabilityDebugTraceHint({
        pathPrefix: apiLatencyTopRoute?.pathPrefix || defaultApiTraceHintPathPrefix,
        statusAtLeast: 0,
        method: apiLatencyTopRoute?.method || defaultApiTraceHintMethod,
        errorCode: '',
    });
    const apiLatencyHotspotsDebugTraceHint = normalizeRuntimeCapabilityDebugTraceHint({
        pathPrefix: apiLatencyTopRoute?.pathPrefix || defaultApiTraceHintPathPrefix,
        statusAtLeast: 0,
        method: apiLatencyTopRoute?.method || defaultApiTraceHintMethod,
        errorCode: '',
    });
    const apiInvalidRequestObserved = [
        `scopePathPrefix=${apiTraceScopePathPrefix || '<all>'}`,
        `scopeMethod=${apiTraceScopeMethod || '<all>'}`,
        `requests=${apiTraceWindowRequests}`,
        `errors=${apiTraceWindowErrors}`,
        `invalidRequest=${apiTraceWindowInvalidRequests}`,
        `invalid/error=${apiTraceWindowInvalidRequestRatioPct}%`,
        `invalid/total=${apiTraceWindowInvalidRequestToTotalRatioPct}%`,
        `invalidTopPaths=${apiInvalidRequestHotspotsSummary}`,
    ].join(', ');
    const apiServerErrorObserved = [
        `scopePathPrefix=${apiTraceScopePathPrefix || '<all>'}`,
        `scopeMethod=${apiTraceScopeMethod || '<all>'}`,
        `requests=${apiTraceWindowRequests}`,
        `serverErrors=${apiTraceWindowServerErrors}`,
        `server/total=${apiTraceWindowServerErrorRatioPct}%`,
        `serverTopPaths=${apiServerErrorTopPathsSummary}`,
    ].join(', ');
    const apiTransientErrorObserved = [
        `scopePathPrefix=${apiTraceScopePathPrefix || '<all>'}`,
        `scopeMethod=${apiTraceScopeMethod || '<all>'}`,
        `requests=${apiTraceWindowRequests}`,
        `transientErrors=${apiTraceWindowTransientErrors}`,
        `transient/total=${apiTraceWindowTransientErrorRatioPct}%`,
        `transientTopPaths=${apiTransientErrorTopPathsSummary}`,
    ].join(', ');
    const apiLatencyObserved = [
        `scopePathPrefix=${apiTraceScopePathPrefix || '<all>'}`,
        `scopeMethod=${apiTraceScopeMethod || '<all>'}`,
        `requests=${apiTraceWindowRequests}`,
        `avg=${apiTraceAverageDurationMs}ms`,
        `p95=${apiTraceP95DurationMs}ms`,
        `slowTopPaths=${apiLatencyTopPathsSummary}`,
    ].join(', ');
    const apiLatencyHotspotPeakP95Ms = apiTraceSlowTopPaths.length > 0
        ? Number(apiTraceSlowTopPaths[0]?.p95DurationMs || 0)
        : 0;
    const trendStatusRaw = String(params.learningQualityTrend?.status || '').trim().toLowerCase();
    const trendStatus: RuntimeCapabilityMatrix['signals']['qualityTrendStatus'] = (
        trendStatusRaw === 'improving'
        || trendStatusRaw === 'stable'
        || trendStatusRaw === 'regressing'
        || trendStatusRaw === 'insufficient_data'
    ) ? trendStatusRaw : 'unknown';
    const trendScoreRaw = Number(params.learningQualityTrend?.score || 0);
    const trendScore = Number(
        (Number.isFinite(trendScoreRaw) ? trendScoreRaw : 0).toFixed(4)
    );
    const trendConfidenceRaw = Number(params.learningQualityTrend?.confidence || 0);
    const trendConfidence = Number(
        (
            Number.isFinite(trendConfidenceRaw)
                ? clamp(trendConfidenceRaw, 0, 1)
                : 0
        ).toFixed(4)
    );
    const trendReason = String(params.learningQualityTrend?.reason || '').trim();
    const trendObserved = [
        `status=${trendStatus}`,
        `score=${trendScore}`,
        `confidence=${trendConfidence}`,
        trendReason ? `reason=${trendReason}` : '',
    ].filter(Boolean).join(', ');
    const sessionPlanQualityRecords = Math.max(
        0,
        Math.floor(Number(params.sessionPlanQualityHistory?.summary?.totalRecords || 0))
    );
    const sessionPlanQualityPassRatePct = Number(
        clamp(Number(params.sessionPlanQualityHistory?.summary?.overallPassRatePct || 0), 0, 100).toFixed(4)
    );
    const sessionPlanQualityFailureStreak = Math.max(
        0,
        Math.floor(Number(params.sessionPlanQualityHistory?.summary?.consecutiveFailureCount || 0))
    );
    const sessionPlanQualityCommonFailedGates = Array.isArray(
        params.sessionPlanQualityHistory?.summary?.commonFailedGates
    )
        ? params.sessionPlanQualityHistory?.summary?.commonFailedGates
            .map((item) => {
                const gateId = String(item?.gateId || '').trim();
                const count = Math.max(0, Math.floor(Number(item?.count || 0)));
                if (!gateId || count <= 0) {
                    return '';
                }
                return `${gateId}:${count}`;
            })
            .filter((item) => item.length > 0)
            .slice(0, 3)
            .join('|')
        : '';
    const sessionPlanTrendStatusRaw = String(params.sessionPlanQualityTrend?.status || '').trim().toLowerCase();
    const sessionPlanTrendStatus: RuntimeCapabilityMatrix['signals']['sessionPlanQualityTrendStatus'] = (
        sessionPlanTrendStatusRaw === 'improving'
        || sessionPlanTrendStatusRaw === 'stable'
        || sessionPlanTrendStatusRaw === 'regressing'
        || sessionPlanTrendStatusRaw === 'insufficient_data'
    ) ? sessionPlanTrendStatusRaw : 'unknown';
    const sessionPlanTrendScore = Number((
        Number.isFinite(Number(params.sessionPlanQualityTrend?.score))
            ? Number(params.sessionPlanQualityTrend?.score)
            : 0
    ).toFixed(4));
    const sessionPlanTrendConfidence = Number((
        Number.isFinite(Number(params.sessionPlanQualityTrend?.confidence))
            ? clamp(Number(params.sessionPlanQualityTrend?.confidence), 0, 1)
            : 0
    ).toFixed(4));
    const sessionPlanTrendReason = String(params.sessionPlanQualityTrend?.reason || '').trim();
    const sessionPlanTrendObserved = [
        `status=${sessionPlanTrendStatus}`,
        `score=${sessionPlanTrendScore}`,
        `confidence=${sessionPlanTrendConfidence}`,
        sessionPlanTrendReason ? `reason=${sessionPlanTrendReason}` : '',
    ].filter(Boolean).join(', ');
    const memoryPolicyStatusRaw = String(params.memoryPolicyDiagnostics?.summary?.status || '').trim().toLowerCase();
    const memoryPolicyStatus: RuntimeCapabilityMatrix['signals']['memoryPolicyStatus'] = (
        memoryPolicyStatusRaw === 'healthy'
        || memoryPolicyStatusRaw === 'watch'
        || memoryPolicyStatusRaw === 'risk'
        || memoryPolicyStatusRaw === 'insufficient_data'
    ) ? memoryPolicyStatusRaw : 'unknown';
    const memoryPolicyHealthScore = Number((
        Number.isFinite(Number(params.memoryPolicyDiagnostics?.summary?.healthScore))
            ? clamp(Number(params.memoryPolicyDiagnostics?.summary?.healthScore), 0, 100)
            : 0
    ).toFixed(4));
    const memoryPolicyTotalEntries = Math.max(
        0,
        Math.floor(Number(params.memoryPolicyDiagnostics?.summary?.totalEntries || 0))
    );
    const memoryPolicyExpiredEntries = Math.max(
        0,
        Math.floor(Number(params.memoryPolicyDiagnostics?.summary?.expiredEntries || 0))
    );
    const memoryPolicyStaleEntries = Math.max(
        0,
        Math.floor(Number(params.memoryPolicyDiagnostics?.summary?.staleEntries || 0))
    );
    const memoryPolicyLowConfidenceEntries = Math.max(
        0,
        Math.floor(Number(params.memoryPolicyDiagnostics?.summary?.lowConfidenceEntries || 0))
    );
    const memoryPolicyReason = String(params.memoryPolicyDiagnostics?.summary?.reason || '').trim();
    const memoryPolicyObserved = [
        `status=${memoryPolicyStatus}`,
        `score=${memoryPolicyHealthScore}`,
        `entries=${memoryPolicyTotalEntries}`,
        `expired=${memoryPolicyExpiredEntries}`,
        `stale=${memoryPolicyStaleEntries}`,
        `lowConfidence=${memoryPolicyLowConfidenceEntries}`,
        memoryPolicyReason ? `reason=${memoryPolicyReason}` : '',
    ].filter(Boolean).join(', ');
    const memoryPolicyTrendStatusRaw = String(params.memoryPolicyTrend?.status || '').trim().toLowerCase();
    const memoryPolicyTrendStatus: RuntimeCapabilityMatrix['signals']['memoryPolicyTrendStatus'] = (
        memoryPolicyTrendStatusRaw === 'improving'
        || memoryPolicyTrendStatusRaw === 'stable'
        || memoryPolicyTrendStatusRaw === 'regressing'
        || memoryPolicyTrendStatusRaw === 'insufficient_data'
    ) ? memoryPolicyTrendStatusRaw : 'unknown';
    const memoryPolicyTrendScore = Number((
        Number.isFinite(Number(params.memoryPolicyTrend?.score))
            ? Number(params.memoryPolicyTrend?.score)
            : 0
    ).toFixed(4));
    const memoryPolicyTrendConfidence = Number((
        Number.isFinite(Number(params.memoryPolicyTrend?.confidence))
            ? clamp(Number(params.memoryPolicyTrend?.confidence), 0, 1)
            : 0
    ).toFixed(4));
    const memoryPolicyTrendReason = String(params.memoryPolicyTrend?.reason || '').trim();
    const memoryPolicyTrendObserved = [
        `status=${memoryPolicyTrendStatus}`,
        `score=${memoryPolicyTrendScore}`,
        `confidence=${memoryPolicyTrendConfidence}`,
        memoryPolicyTrendReason ? `reason=${memoryPolicyTrendReason}` : '',
    ].filter(Boolean).join(', ');
    const knowledgeStalenessSummary = params.knowledgeStalenessDiagnostics?.summary || null;
    const knowledgeStalenessEvaluatedDocuments = Math.max(
        0,
        Math.floor(Number(knowledgeStalenessSummary?.evaluatedDocuments || 0))
    );
    const knowledgeStalenessStaleDocuments = Math.max(
        0,
        Math.floor(Number(knowledgeStalenessSummary?.staleDocuments || 0))
    );
    const knowledgeStalenessFreshnessRatioPct = Number(
        clamp(Number(knowledgeStalenessSummary?.freshnessRatioPct || 0), 0, 100).toFixed(4)
    );
    const knowledgeStalenessHashMismatchDocuments = Math.max(
        0,
        Math.floor(Number(knowledgeStalenessSummary?.hashMismatchDocuments || 0))
    );
    const knowledgeStalenessMissingSourceDocuments = Math.max(
        0,
        Math.floor(Number(knowledgeStalenessSummary?.missingSourceDocuments || 0))
    );
    const knowledgeStalenessReadErrorDocuments = Math.max(
        0,
        Math.floor(Number(knowledgeStalenessSummary?.readErrorDocuments || 0))
    );
    const knowledgeStalenessObserved = [
        `evaluated=${knowledgeStalenessEvaluatedDocuments}`,
        `stale=${knowledgeStalenessStaleDocuments}`,
        `freshness=${knowledgeStalenessFreshnessRatioPct}%`,
        `mismatch=${knowledgeStalenessHashMismatchDocuments}`,
        `missing=${knowledgeStalenessMissingSourceDocuments}`,
        `readError=${knowledgeStalenessReadErrorDocuments}`,
    ].join(', ');
    const sessionActionExecutionCount = Math.max(
        0,
        Math.floor(Number(params.sessionActionTelemetry?.executionCount || 0))
    );
    const sessionMemoryPersistedCount = Math.max(
        0,
        Math.floor(Number(params.sessionActionTelemetry?.memoryPersistedCount || 0))
    );
    const sessionMemoryPromotionAppliedCount = Math.max(
        0,
        Math.floor(Number(params.sessionActionTelemetry?.memoryPromotionAppliedCount || 0))
    );
    const sessionMemoryPromotionCount = Math.max(
        0,
        Math.floor(Number(params.sessionActionTelemetry?.memoryPromotionCount || 0))
    );
    const sessionMemoryPromotionCoveragePct = Number(
        (
            (sessionMemoryPromotionAppliedCount / Math.max(1, sessionMemoryPersistedCount)) * 100
        ).toFixed(4)
    );
    const sessionStrategyTotalRecords = Math.max(
        0,
        Math.floor(Number(params.sessionStrategyTelemetry?.totalRecords || 0))
    );
    const sessionStrategyStrategyRecords = Math.max(
        0,
        Math.floor(Number(params.sessionStrategyTelemetry?.strategyRecords || 0))
    );
    const sessionStrategyTrendAutoSelectionSharePct = Number(
        clamp(Number(params.sessionStrategyTelemetry?.trendAutoSelectionSharePct || 0), 0, 100).toFixed(4)
    );
    const sessionStrategyTrendAutoAverageMasteryDeltaPct = Number(
        clamp(Number(params.sessionStrategyTelemetry?.trendAutoAverageMasteryDeltaPct || 0), -100, 100).toFixed(4)
    );
    const sessionStrategyTrendAutoNegativeRatioPct = Number(
        clamp(Number(params.sessionStrategyTelemetry?.trendAutoNegativeRatioPct || 0), 0, 100).toFixed(4)
    );
    const sessionStrategyModeFallbackSelectionSharePct = Number(
        clamp(Number(params.sessionStrategyTelemetry?.modeFallbackSelectionSharePct || 0), 0, 100).toFixed(4)
    );
    const sessionStrategySelectionSourceExplicitCount = Math.max(
        0,
        Math.floor(Number(params.sessionStrategyTelemetry?.selectionSourceCounts?.explicit_request || 0))
    );
    const sessionStrategySelectionSourceTrendCount = Math.max(
        0,
        Math.floor(Number(params.sessionStrategyTelemetry?.selectionSourceCounts?.strategy_trend || 0))
    );
    const sessionStrategySelectionSourceFallbackCount = Math.max(
        0,
        Math.floor(Number(params.sessionStrategyTelemetry?.selectionSourceCounts?.mode_fallback || 0))
    );
    const sessionStrategySelectionSourceUnknownCount = Math.max(
        0,
        Math.floor(Number(params.sessionStrategyTelemetry?.selectionSourceCounts?.unknown || 0))
    );
    type SessionStrategyBreakdownEntry = {
        strategy: NonNullable<LearningPathRequest['strategy']>;
        executions: number;
        averageMasteryDeltaPct: number;
        positiveRatioPct: number;
        negativeRatioPct: number;
    };
    const sessionStrategyBreakdown: SessionStrategyBreakdownEntry[] = Array.isArray(
        params.sessionStrategyTelemetry?.strategyBreakdown
    )
        ? params.sessionStrategyTelemetry.strategyBreakdown.reduce<SessionStrategyBreakdownEntry[]>(
            (entries, item) => {
                const strategyRaw = String(item?.strategy || '').trim().toLowerCase();
                const strategy: NonNullable<LearningPathRequest['strategy']> | null = (
                    strategyRaw === 'balanced'
                    || strategyRaw === 'mastery_recovery'
                    || strategyRaw === 'exploration_boost'
                ) ? strategyRaw : null;
                if (!strategy) {
                    return entries;
                }
                entries.push({
                    strategy,
                    executions: Math.max(0, Math.floor(Number(item?.executions || 0))),
                    averageMasteryDeltaPct: Number(
                        clamp(Number(item?.averageMasteryDeltaPct || 0), -100, 100).toFixed(4)
                    ),
                    positiveRatioPct: Number(
                        clamp(Number(item?.positiveRatioPct || 0), 0, 100).toFixed(4)
                    ),
                    negativeRatioPct: Number(
                        clamp(Number(item?.negativeRatioPct || 0), 0, 100).toFixed(4)
                    ),
                });
                return entries;
            },
            []
        )
        : [];
    const sessionStrategyTopAverageEntry = sessionStrategyBreakdown
        .slice()
        .sort((left, right) => {
            if (right.averageMasteryDeltaPct !== left.averageMasteryDeltaPct) {
                return right.averageMasteryDeltaPct - left.averageMasteryDeltaPct;
            }
            if (right.executions !== left.executions) {
                return right.executions - left.executions;
            }
            return left.strategy.localeCompare(right.strategy);
        })[0] || null;
    const sessionStrategyTopAverageStrategy: RuntimeCapabilityMatrix['signals']['sessionStrategyTopAverageStrategy'] =
        sessionStrategyTopAverageEntry
            ? sessionStrategyTopAverageEntry.strategy
            : 'unknown';
    const sessionStrategyTopAverageMasteryDeltaPct = Number(
        clamp(Number(sessionStrategyTopAverageEntry?.averageMasteryDeltaPct || 0), -100, 100).toFixed(4)
    );
    const sessionStrategyTopAverageNegativeRatioPct = Number(
        clamp(Number(sessionStrategyTopAverageEntry?.negativeRatioPct || 0), 0, 100).toFixed(4)
    );
    const sessionStrategyObserved = [
        `records=${sessionStrategyTotalRecords}`,
        `strategyRecords=${sessionStrategyStrategyRecords}`,
        `source(explicit/trend/fallback/unknown)=`
            + `${sessionStrategySelectionSourceExplicitCount}/${sessionStrategySelectionSourceTrendCount}/`
            + `${sessionStrategySelectionSourceFallbackCount}/${sessionStrategySelectionSourceUnknownCount}`,
        `trendAutoShare=${sessionStrategyTrendAutoSelectionSharePct}%`,
        `trendAutoAvgDelta=${sessionStrategyTrendAutoAverageMasteryDeltaPct}%`,
        `trendAutoNegative=${sessionStrategyTrendAutoNegativeRatioPct}%`,
        `modeFallbackShare=${sessionStrategyModeFallbackSelectionSharePct}%`,
        `topAverage=${sessionStrategyTopAverageStrategy}@${sessionStrategyTopAverageMasteryDeltaPct}%`
            + ` (negative=${sessionStrategyTopAverageNegativeRatioPct}%)`,
    ].join(', ');
    const tutorAdaptersTotal = Math.max(
        0,
        Math.floor(Number(params.tutorAdapterTelemetry?.summary?.totalAdapters || 0))
    );
    const tutorAdaptersActive = Math.max(
        0,
        Math.floor(Number(params.tutorAdapterTelemetry?.summary?.activeAdapters || 0))
    );
    const tutorRequests = Math.max(
        0,
        Math.floor(Number(params.tutorAdapterTelemetry?.summary?.totalRequests || 0))
    );
    const tutorAcceptedResponses = Math.max(
        0,
        Math.floor(Number(params.tutorAdapterTelemetry?.summary?.acceptedResponses || 0))
    );
    const tutorDowngradedResponses = Math.max(
        0,
        Math.floor(Number(params.tutorAdapterTelemetry?.summary?.downgradedResponses || 0))
    );
    const tutorFailedResponses = Math.max(
        0,
        Math.floor(Number(params.tutorAdapterTelemetry?.summary?.failedResponses || 0))
    );
    const tutorProviderFallbackResponses = Math.max(
        0,
        Math.floor(Number(params.tutorAdapterTelemetry?.summary?.providerFallbackResponses || 0))
    );
    const tutorProviderFallbackRatioPct = Number(
        (
            Number.isFinite(Number(params.tutorAdapterTelemetry?.summary?.providerFallbackRatioPct))
                ? clamp(Number(params.tutorAdapterTelemetry?.summary?.providerFallbackRatioPct), 0, 100)
                : clamp((tutorProviderFallbackResponses / Math.max(1, tutorRequests)) * 100, 0, 100)
        ).toFixed(4)
    );
    const tutorAverageProviderAttemptCount = Number(
        (
            Number.isFinite(Number(params.tutorAdapterTelemetry?.summary?.averageProviderAttemptCount))
                ? clamp(Number(params.tutorAdapterTelemetry?.summary?.averageProviderAttemptCount), 1, 20)
                : clamp(1 + (tutorProviderFallbackResponses / Math.max(1, tutorRequests)), 1, 20)
        ).toFixed(4)
    );
    const tutorProviderBreakdown = Array.isArray(params.tutorTraceDiagnostics?.providerBreakdown)
        ? params.tutorTraceDiagnostics?.providerBreakdown
            .map((item) => ({
                providerName: String(item?.providerName || '').trim() || 'unknown',
                traces: Math.max(0, Math.floor(Number(item?.traces || 0))),
                fallbackTraces: Math.max(0, Math.floor(Number(item?.fallbackTraces || 0))),
            }))
            .filter((item) => item.traces > 0)
        : [];
    const tutorProviderCount = tutorProviderBreakdown.length;
    const tutorProviderTotalTraces = tutorProviderBreakdown.reduce((sum, item) => sum + item.traces, 0);
    const tutorFallbackTraceCountFromSummary = Math.max(
        0,
        Math.floor(Number(params.tutorTraceDiagnostics?.summary?.fallbackTraces || 0))
    );
    const tutorFallbackTraceCountFromBreakdown = tutorProviderBreakdown.reduce((sum, item) => sum + item.fallbackTraces, 0);
    const tutorFallbackTraceCount = Math.max(
        tutorFallbackTraceCountFromSummary,
        tutorFallbackTraceCountFromBreakdown
    );
    const tutorDominantProvider = tutorProviderBreakdown
        .slice()
        .sort((left, right) => {
            if (right.traces !== left.traces) {
                return right.traces - left.traces;
            }
            return left.providerName.localeCompare(right.providerName);
        })[0];
    const tutorDominantProviderName = tutorDominantProvider?.providerName || '';
    const tutorDominantProviderSharePct = Number(
        clamp(
            ((Number(tutorDominantProvider?.traces || 0) / Math.max(1, tutorProviderTotalTraces)) * 100),
            0,
            100
        ).toFixed(4)
    );
    const tutorDominantFallbackProvider = tutorProviderBreakdown
        .filter((item) => item.fallbackTraces > 0)
        .sort((left, right) => {
            if (right.fallbackTraces !== left.fallbackTraces) {
                return right.fallbackTraces - left.fallbackTraces;
            }
            return left.providerName.localeCompare(right.providerName);
        })[0];
    const tutorDominantFallbackProviderName = tutorDominantFallbackProvider?.providerName || '';
    const tutorDominantFallbackProviderSharePct = Number(
        clamp(
            ((Number(tutorDominantFallbackProvider?.fallbackTraces || 0) / Math.max(1, tutorFallbackTraceCount)) * 100),
            0,
            100
        ).toFixed(4)
    );
    const tutorProviderTrendProviders = Array.isArray(params.tutorProviderTrendDiagnostics?.providers)
        ? params.tutorProviderTrendDiagnostics?.providers
            .map((item) => {
                const providerName = String(item?.providerName || '').trim() || 'unknown';
                const trendStatusRaw = String(item?.trendStatus || '').trim().toLowerCase();
                const trendStatus: 'improving' | 'stable' | 'regressing' | 'insufficient_data' = (
                    trendStatusRaw === 'improving'
                    || trendStatusRaw === 'stable'
                    || trendStatusRaw === 'regressing'
                )
                    ? trendStatusRaw
                    : 'insufficient_data';
                return {
                    providerName,
                    trendStatus,
                    trendScore: Number(clamp(Number(item?.trendScore || 0), -100, 100).toFixed(4)),
                    trendConfidence: Number(clamp(Number(item?.trendConfidence || 0), 0, 100).toFixed(4)),
                    fallbackRatioPct: Number(clamp(Number(item?.fallbackRatioPct || 0), 0, 100).toFixed(4)),
                };
            })
            .filter((item) => item.providerName)
        : [];
    const tutorProviderTrendRegressingProviders = tutorProviderTrendProviders
        .filter((item) => item.trendStatus === 'regressing')
        .sort((left, right) => {
            if (right.trendScore !== left.trendScore) {
                return right.trendScore - left.trendScore;
            }
            if (right.trendConfidence !== left.trendConfidence) {
                return right.trendConfidence - left.trendConfidence;
            }
            return left.providerName.localeCompare(right.providerName);
        });
    const tutorProviderTrendRegressingCount = tutorProviderTrendRegressingProviders.length;
    const tutorProviderTrendImprovingCount = tutorProviderTrendProviders.filter((item) => item.trendStatus === 'improving').length;
    const tutorProviderTrendInsufficientDataCount = tutorProviderTrendProviders
        .filter((item) => item.trendStatus === 'insufficient_data')
        .length;
    const tutorProviderTrendTopRegressingProvider = tutorProviderTrendRegressingProviders[0] || null;
    const tutorProviderTrendTopRegressingProviderName = tutorProviderTrendTopRegressingProvider?.providerName || '';
    const tutorProviderTrendTopRegressingScore = Number(
        clamp(Number(tutorProviderTrendTopRegressingProvider?.trendScore || 0), -100, 100).toFixed(4)
    );
    const tutorProviderTrendTopRegressingConfidence = Number(
        clamp(Number(tutorProviderTrendTopRegressingProvider?.trendConfidence || 0), 0, 100).toFixed(4)
    );
    const tutorProviderTrendRecommendedFocusProviderName = String(
        params.tutorProviderTrendDiagnostics?.summary?.recommendedFocusProviderName
        || tutorProviderTrendTopRegressingProviderName
        || ''
    ).trim();
    const tutorProviderTrendHistoryRecords = Math.max(
        Math.floor(Number(params.tutorProviderTrendHistory?.summary?.totalRecords || 0)),
        Array.isArray(params.tutorProviderTrendHistory?.records)
            ? params.tutorProviderTrendHistory?.records.length
            : 0
    );
    const tutorProviderTrendHistoryRegressingRecords = Math.max(
        Math.floor(Number(params.tutorProviderTrendHistory?.summary?.regressingRecords || 0)),
        Array.isArray(params.tutorProviderTrendHistory?.records)
            ? params.tutorProviderTrendHistory.records
                .filter((item) => String(item?.trendStatus || '').trim().toLowerCase() === 'regressing')
                .length
            : 0
    );
    const tutorProviderTrendHistoryStableRecords = Math.max(
        Math.floor(Number(params.tutorProviderTrendHistory?.summary?.stableRecords || 0)),
        Array.isArray(params.tutorProviderTrendHistory?.records)
            ? params.tutorProviderTrendHistory.records
                .filter((item) => String(item?.trendStatus || '').trim().toLowerCase() === 'stable')
                .length
            : 0
    );
    const tutorProviderTrendHistoryImprovingRecords = Math.max(
        Math.floor(Number(params.tutorProviderTrendHistory?.summary?.improvingRecords || 0)),
        Array.isArray(params.tutorProviderTrendHistory?.records)
            ? params.tutorProviderTrendHistory.records
                .filter((item) => String(item?.trendStatus || '').trim().toLowerCase() === 'improving')
                .length
            : 0
    );
    const tutorProviderTrendHistoryInsufficientDataRecords = Math.max(
        Math.floor(Number(params.tutorProviderTrendHistory?.summary?.insufficientDataRecords || 0)),
        Array.isArray(params.tutorProviderTrendHistory?.records)
            ? params.tutorProviderTrendHistory.records
                .filter((item) => String(item?.trendStatus || '').trim().toLowerCase() === 'insufficient_data')
                .length
            : 0
    );
    const tutorFailedRatioPct = Number(((tutorFailedResponses / Math.max(1, tutorRequests)) * 100).toFixed(4));
    const tutorDowngradedRatioPct = Number(((tutorDowngradedResponses / Math.max(1, tutorRequests)) * 100).toFixed(4));
    const tutorAverageConfidence = Number(
        (
            Number.isFinite(Number(params.tutorAdapterTelemetry?.summary?.averageConfidence))
                ? clamp(Number(params.tutorAdapterTelemetry?.summary?.averageConfidence), 0, 1)
                : 0
        ).toFixed(4)
    );
    const tutorRoutingEnabled = params.tutorRoutingConfig?.enabled !== false;
    const tutorRoutingMinSamples = Math.max(
        1,
        Math.floor(Number(params.tutorRoutingConfig?.minSamples || 1))
    );
    const tutorRoutingMaxFailedRatioPct = Number(
        clamp(Number(params.tutorRoutingConfig?.maxFailedRatioPct || 100), 0, 100).toFixed(4)
    );
    const tutorRoutingMaxDowngradedRatioPct = Number(
        clamp(Number(params.tutorRoutingConfig?.maxDowngradedRatioPct || 100), 0, 100).toFixed(4)
    );
    const tutorRoutingMinAverageConfidence = Number(
        clamp(Number(params.tutorRoutingConfig?.minAverageConfidence || 0), 0, 1).toFixed(4)
    );
    const tutorRoutingPreferredModeRaw = String(params.tutorRoutingConfig?.preferredMode || '').trim().toLowerCase();
    const tutorRoutingPreferredMode: RuntimeCapabilityMatrix['signals']['tutorRoutingPreferredMode'] = (
        tutorRoutingPreferredModeRaw === 'local'
        || tutorRoutingPreferredModeRaw === 'cloud'
    ) ? tutorRoutingPreferredModeRaw : 'auto';
    const tutorRoutingAdapterTimeoutRaw = Number(params.tutorRoutingConfig?.adapterTimeoutMs);
    const tutorRoutingAdapterTimeoutMs = Math.max(
        100,
        Math.min(
            120000,
            Math.floor(Number.isFinite(tutorRoutingAdapterTimeoutRaw) ? tutorRoutingAdapterTimeoutRaw : 15000)
        )
    );
    const tutorLastRoutingStrategyRaw = String(
        params.tutorAdapterTelemetry?.summary?.lastRoutingStrategy || ''
    ).trim();
    const tutorLastRoutingStrategy: RuntimeCapabilityMatrix['signals']['tutorLastRoutingStrategy'] = (
        tutorLastRoutingStrategyRaw === 'explicit_adapter_id'
        || tutorLastRoutingStrategyRaw === 'explicit_provider_mode'
        || tutorLastRoutingStrategyRaw === 'adaptive_health_routing'
        || tutorLastRoutingStrategyRaw === 'fallback_default'
    ) ? tutorLastRoutingStrategyRaw : 'unknown';
    const tutorLastRoutingReason = String(
        params.tutorAdapterTelemetry?.summary?.lastRoutingReason || ''
    ).trim().slice(0, 160);
    const tutorLastRoutingScore = Number(
        (
            Number.isFinite(Number(params.tutorAdapterTelemetry?.summary?.lastRoutingScore))
                ? clamp(Number(params.tutorAdapterTelemetry?.summary?.lastRoutingScore), 0, 1)
                : 0
        ).toFixed(4)
    );
    const tutorRoutingDynamicPreferredModeRaw = String(
        params.tutorAdapterTelemetry?.summary?.lastRoutingDynamicPreferredMode || ''
    ).trim();
    const hasStructuredTutorRoutingDynamicPreferredMode = tutorRoutingDynamicPreferredModeRaw.length > 0;
    const tutorRoutingDynamicModeReasonRaw = String(
        params.tutorAdapterTelemetry?.summary?.lastRoutingDynamicModeReason || ''
    ).trim().slice(0, 220);
    const parsedTutorRoutingDynamicSignals = extractTutorRoutingDynamicSignalsFromReason(
        params.tutorAdapterTelemetry?.summary?.lastRoutingReason
    );
    const tutorRoutingDynamicPreferredMode: RuntimeCapabilityMatrix['signals']['tutorRoutingDynamicPreferredMode'] =
        hasStructuredTutorRoutingDynamicPreferredMode
            ? normalizeTutorRoutingDynamicPreferredModeToken(tutorRoutingDynamicPreferredModeRaw)
            : parsedTutorRoutingDynamicSignals.preferredMode;
    const tutorRoutingDynamicModeReason = tutorRoutingDynamicModeReasonRaw
        || parsedTutorRoutingDynamicSignals.modeReason;
    const tutorRoutingDynamicModeSuggestionActive = (
        tutorRoutingDynamicPreferredMode === 'local'
        || tutorRoutingDynamicPreferredMode === 'cloud'
    );

    if (params.configuredStoreBackend === 'graphdb') {
        if (params.store.storeType !== 'graphdb') {
            checks.push({
                checkId: 'store_backend_type',
                status: 'fail',
                message: 'Configured graphdb backend is not active at runtime.',
                observed: `storeType=${params.store.storeType}`,
                expected: 'storeType=graphdb',
            });
        } else if (params.store.usingFallback === true) {
            checks.push({
                checkId: 'store_graphdb_fallback',
                status: 'warn',
                message: 'Graphdb backend is running with fallback store.',
                observed: `usingFallback=true, fallbackStoreType=${String(params.store.fallbackStoreType || 'unknown')}`,
                expected: 'usingFallback=false',
            });
        } else if (params.store.backendReady === false) {
            checks.push({
                checkId: 'store_graphdb_readiness',
                status: 'warn',
                message: 'Graphdb backend is selected but adapter readiness is false.',
                observed: 'backendReady=false',
                expected: 'backendReady=true',
            });
        } else {
            checks.push({
                checkId: 'store_graphdb_readiness',
                status: 'pass',
                message: 'Graphdb backend is active and ready.',
                observed: `storeType=${params.store.storeType}, adapterId=${String(params.store.adapterId || 'n/a')}`,
            });
        }
        if (
            params.store.storeType === 'graphdb'
            && params.store.backendReady !== false
            && params.store.usingFallback !== true
        ) {
            if (graphDbConnectorHealthStatus === 'unavailable' || graphDbConnectorCircuitState === 'open') {
                checks.push({
                    checkId: 'store_graphdb_connector_health',
                    status: 'fail',
                    message: 'Graphdb connector health is unavailable or circuit-open in strict runtime path.',
                    observed: [
                        `health=${graphDbConnectorHealthStatus}`,
                        `circuit=${graphDbConnectorCircuitState}`,
                        `errorCode=${graphDbConnectorLastErrorCode || 'none'}`,
                        `requestCount=${graphDbConnectorRequestCount}`,
                    ].join(', '),
                    expected: 'health in {ready,unknown} and circuit!=open',
                });
            } else if (
                graphDbConnectorHealthStatus === 'degraded'
                || graphDbConnectorCircuitState === 'half_open'
                || graphDbConnectorConsecutiveFailures > 0
            ) {
                checks.push({
                    checkId: 'store_graphdb_connector_health',
                    status: 'warn',
                    message: 'Graphdb connector health is degraded; stabilize before widening strict rollout.',
                    observed: [
                        `health=${graphDbConnectorHealthStatus}`,
                        `circuit=${graphDbConnectorCircuitState}`,
                        `consecutiveFailures=${graphDbConnectorConsecutiveFailures}`,
                        `retryCount=${graphDbConnectorRetryCount}`,
                    ].join(', '),
                    expected: 'health=ready with circuit=closed under sustained traffic',
                });
            } else {
                checks.push({
                    checkId: 'store_graphdb_connector_health',
                    status: 'pass',
                    message: 'Graphdb connector health telemetry is stable.',
                    observed: [
                        `health=${graphDbConnectorHealthStatus}`,
                        `circuit=${graphDbConnectorCircuitState}`,
                        `requestCount=${graphDbConnectorRequestCount}`,
                        `retryCount=${graphDbConnectorRetryCount}`,
                    ].join(', '),
                    expected: 'health=ready with circuit=closed',
                });
            }

            if (!graphDbConnectorBudgetMeetsMinSample) {
                checks.push({
                    checkId: 'store_graphdb_connector_budget',
                    status: 'pass',
                    message: 'Graphdb connector budget governance is deferred until minimum request sample is reached.',
                    observed: [
                        `requestCount=${graphDbConnectorRequestCount}`,
                        `minSample=${thresholds.storeGraphDbConnectorMinRequestSample}`,
                        `failureRatio=${graphDbConnectorFailureRatioPct}%`,
                        `shortCircuitRatio=${graphDbConnectorShortCircuitRatioPct}%`,
                    ].join(', '),
                    expected: `requestCount>=${thresholds.storeGraphDbConnectorMinRequestSample}`,
                });
            } else if (graphDbConnectorFailBudgetExceeded) {
                checks.push({
                    checkId: 'store_graphdb_connector_budget',
                    status: 'fail',
                    message: 'Graphdb connector runtime budgets exceed fail thresholds.',
                    observed: [
                        `circuit=${graphDbConnectorCircuitState}`,
                        `requestCount=${graphDbConnectorRequestCount}`,
                        `failureRatio=${graphDbConnectorFailureRatioPct}%`,
                        `shortCircuitRatio=${graphDbConnectorShortCircuitRatioPct}%`,
                        `consecutiveFailures=${graphDbConnectorConsecutiveFailures}`,
                    ].join(', '),
                    expected: [
                        `failureRatio<${thresholds.storeGraphDbConnectorFailureFailRatioPct}%`,
                        `shortCircuitRatio<${thresholds.storeGraphDbConnectorShortCircuitFailRatioPct}%`,
                        `consecutiveFailures<${thresholds.storeGraphDbConnectorConsecutiveFailuresFailCount}`,
                        'circuit!=open',
                    ].join(', '),
                });
            } else if (graphDbConnectorWarnBudgetExceeded) {
                checks.push({
                    checkId: 'store_graphdb_connector_budget',
                    status: 'warn',
                    message: 'Graphdb connector runtime budgets are approaching warning thresholds.',
                    observed: [
                        `circuit=${graphDbConnectorCircuitState}`,
                        `requestCount=${graphDbConnectorRequestCount}`,
                        `failureRatio=${graphDbConnectorFailureRatioPct}%`,
                        `shortCircuitRatio=${graphDbConnectorShortCircuitRatioPct}%`,
                        `consecutiveFailures=${graphDbConnectorConsecutiveFailures}`,
                    ].join(', '),
                    expected: [
                        `failureRatio<${thresholds.storeGraphDbConnectorFailureWarnRatioPct}%`,
                        `shortCircuitRatio<${thresholds.storeGraphDbConnectorShortCircuitWarnRatioPct}%`,
                        `consecutiveFailures<${thresholds.storeGraphDbConnectorConsecutiveFailuresWarnCount}`,
                        'circuit=closed|unknown',
                    ].join(', '),
                });
            } else {
                checks.push({
                    checkId: 'store_graphdb_connector_budget',
                    status: 'pass',
                    message: 'Graphdb connector runtime budgets are within configured thresholds.',
                    observed: [
                        `circuit=${graphDbConnectorCircuitState}`,
                        `requestCount=${graphDbConnectorRequestCount}`,
                        `failureRatio=${graphDbConnectorFailureRatioPct}%`,
                        `shortCircuitRatio=${graphDbConnectorShortCircuitRatioPct}%`,
                        `consecutiveFailures=${graphDbConnectorConsecutiveFailures}`,
                    ].join(', '),
                    expected: [
                        `failureRatio<${thresholds.storeGraphDbConnectorFailureWarnRatioPct}%`,
                        `shortCircuitRatio<${thresholds.storeGraphDbConnectorShortCircuitWarnRatioPct}%`,
                        `consecutiveFailures<${thresholds.storeGraphDbConnectorConsecutiveFailuresWarnCount}`,
                    ].join(', '),
                });
            }
        }
    } else {
        const matched = params.store.storeType === params.configuredStoreBackend;
        checks.push({
            checkId: 'store_backend_type',
            status: matched ? 'pass' : 'warn',
            message: matched
                ? 'Store backend matches runtime configuration.'
                : 'Store backend differs from configured backend.',
            observed: `storeType=${params.store.storeType}`,
            expected: `storeType=${params.configuredStoreBackend}`,
        });
    }

    checks.push({
        checkId: 'query_backend_identity',
        status: String(params.queryDiagnostics.backendId || '').trim().length > 0 ? 'pass' : 'fail',
        message: String(params.queryDiagnostics.backendId || '').trim().length > 0
            ? 'Query backend is registered.'
            : 'Query backend id is missing.',
        observed: `backendId=${params.queryDiagnostics.backendId || 'unknown'}`,
    });

    if (!queryBackendRuntimeReady) {
        checks.push({
            checkId: 'query_backend_runtime_health',
            status: 'fail',
            message: 'Runtime diagnostics report query backend as not ready.',
            observed: `runtimeReady=false, backendId=${queryBackendRuntimeId || 'unknown'}`,
            expected: 'runtimeReady=true',
        });
    } else if (queryBackendRuntimeId && queryBackendRuntimeId !== String(params.queryDiagnostics.backendId || '').trim()) {
        checks.push({
            checkId: 'query_backend_runtime_health',
            status: 'warn',
            message: 'Query backend runtime id does not match diagnostics backend id.',
            observed: `runtimeBackendId=${queryBackendRuntimeId}, diagnosticsBackendId=${String(params.queryDiagnostics.backendId || '').trim() || 'unknown'}`,
            expected: 'runtimeBackendId==diagnosticsBackendId',
        });
    } else {
        checks.push({
            checkId: 'query_backend_runtime_health',
            status: 'pass',
            message: 'Query backend runtime diagnostics are healthy.',
            observed: `runtimeReady=${queryBackendRuntimeReady}, backendId=${queryBackendRuntimeId || params.queryDiagnostics.backendId || 'unknown'}`,
            expected: 'runtimeReady=true',
        });
    }

    const localVectorConfigured = params.configuredQueryBackend === 'local_vector';
    if (localVectorConfigured) {
        if (!queryVectorIndexEnabled) {
            checks.push({
                checkId: 'query_vector_index_status',
                status: 'fail',
                message: 'Local vector backend is active but vector index runtime is disabled.',
                observed: `configuredQueryBackend=${params.configuredQueryBackend}, vectorIndexEnabled=${queryVectorIndexEnabled}`,
                expected: 'vectorIndexEnabled=true',
            });
        } else if (queryVectorIndexStatus === 'unavailable') {
            checks.push({
                checkId: 'query_vector_index_status',
                status: 'fail',
                message: 'Local vector index runtime is unavailable.',
                observed: `vectorIndexStatus=${queryVectorIndexStatus}, runtimeReady=${queryBackendRuntimeReady}`,
                expected: 'vectorIndexStatus=ready',
            });
        } else if (queryVectorIndexStatus === 'stale' || queryVectorIndexStatus === 'unknown') {
            checks.push({
                checkId: 'query_vector_index_status',
                status: 'warn',
                message: 'Local vector index requires refresh before stable retrieval governance.',
                observed: `vectorIndexStatus=${queryVectorIndexStatus}, atomCount=${queryVectorIndexAtomCount}`,
                expected: 'vectorIndexStatus=ready',
            });
        } else {
            checks.push({
                checkId: 'query_vector_index_status',
                status: 'pass',
                message: 'Local vector index runtime is ready.',
                observed: `vectorIndexStatus=${queryVectorIndexStatus}, atomCount=${queryVectorIndexAtomCount}`,
                expected: 'vectorIndexStatus=ready',
            });
        }

        if (queryVectorIndexEnabled && queryVectorIndexStatus === 'ready' && queryVectorIndexPersisted) {
            checks.push({
                checkId: 'query_vector_index_persistence',
                status: 'pass',
                message: 'Local vector index persistence is active.',
                observed: `persisted=${queryVectorIndexPersisted}, loadedFromDisk=${queryVectorIndexLoadedFromDisk}, location=${queryVectorIndexLocation || 'memory-only'}`,
                expected: 'persisted=true',
            });
        } else if (queryVectorIndexEnabled && queryVectorIndexStatus === 'ready') {
            checks.push({
                checkId: 'query_vector_index_persistence',
                status: 'warn',
                message: 'Local vector index is running in memory-only mode; persistence safeguards are disabled.',
                observed: `persisted=${queryVectorIndexPersisted}, location=${queryVectorIndexLocation || 'memory-only'}`,
                expected: 'persisted=true',
            });
        } else if (queryVectorIndexEnabled) {
            checks.push({
                checkId: 'query_vector_index_persistence',
                status: 'warn',
                message: 'Local vector index persistence cannot be validated before index reaches ready state.',
                observed: `vectorIndexStatus=${queryVectorIndexStatus}, persisted=${queryVectorIndexPersisted}`,
                expected: 'vectorIndexStatus=ready and persisted=true',
            });
        } else {
            checks.push({
                checkId: 'query_vector_index_persistence',
                status: 'fail',
                message: 'Local vector backend is active but vector index persistence is unavailable because index runtime is disabled.',
                observed: `vectorIndexEnabled=${queryVectorIndexEnabled}, persisted=${queryVectorIndexPersisted}`,
                expected: 'vectorIndexEnabled=true and persisted=true',
            });
        }

        if (!queryVectorIndexEnabled || queryVectorIndexStatus !== 'ready') {
            checks.push({
                checkId: 'query_vector_acceleration_mode',
                status: 'warn',
                message: 'Vector acceleration mode cannot be validated before vector index reaches ready state.',
                observed: `vectorIndexEnabled=${queryVectorIndexEnabled}, vectorIndexStatus=${queryVectorIndexStatus}`,
                expected: 'vectorIndexEnabled=true and vectorIndexStatus=ready',
            });
        } else if (!queryVectorIndexAccelerationEnabled) {
            checks.push({
                checkId: 'query_vector_acceleration_mode',
                status: 'warn',
                message: 'Vector acceleration is disabled; retrieval falls back to full scan.',
                observed: `accelerationEnabled=${queryVectorIndexAccelerationEnabled}, mode=${queryVectorIndexAccelerationMode}`,
                expected: 'accelerationEnabled=true with mode=ann_prefilter',
            });
        } else if (queryVectorIndexAccelerationMode === 'ann_prefilter') {
            checks.push({
                checkId: 'query_vector_acceleration_mode',
                status: 'pass',
                message: 'Vector acceleration is active with ANN prefilter mode.',
                observed: `mode=${queryVectorIndexAccelerationMode}, adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'}`,
                expected: 'mode=ann_prefilter',
            });
        } else {
            checks.push({
                checkId: 'query_vector_acceleration_mode',
                status: 'warn',
                message: 'Vector acceleration is enabled but ANN prefilter is not active in the latest diagnostic cycle.',
                observed: `mode=${queryVectorIndexAccelerationMode}, adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'}, adapterError=${queryVectorIndexAccelerationAdapterError || 'none'}`,
                expected: 'mode=ann_prefilter',
            });
        }

        const queryVectorAccelerationRepresentationExternalConnector = (
            queryVectorIndexAccelerationAdapterId.length > 0
            && queryVectorIndexAccelerationAdapterId.toLowerCase().includes('external')
        );
        const queryVectorAccelerationRepresentationObserved = (
            `representationStatus=${queryVectorIndexAccelerationRepresentationStatus},`
            + ` strictMode=${queryVectorIndexAccelerationRepresentationStrictMode},`
            + ` representationVersion=${queryVectorIndexAccelerationRepresentationVersion || '<none>'},`
            + ` embeddingModelId=${queryVectorIndexAccelerationEmbeddingModelId || '<none>'},`
            + ` embeddingDimension=${queryVectorIndexAccelerationEmbeddingDimension},`
            + ` indexSignature=${queryVectorIndexAccelerationIndexSignature || '<none>'},`
            + ` reason=${queryVectorIndexAccelerationRepresentationStatusReason || '<none>'},`
            + ` adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'},`
            + ` requestCount=${queryVectorIndexAccelerationRequestCount}`
        );
        if (!queryVectorIndexEnabled || queryVectorIndexStatus !== 'ready') {
            checks.push({
                checkId: 'query_vector_acceleration_representation_consistency',
                status: 'warn',
                message: 'Vector acceleration representation consistency cannot be validated before vector index reaches ready state.',
                observed: `vectorIndexEnabled=${queryVectorIndexEnabled}, vectorIndexStatus=${queryVectorIndexStatus}`,
                expected: 'vectorIndexEnabled=true and vectorIndexStatus=ready',
            });
        } else if (!queryVectorIndexAccelerationEnabled) {
            checks.push({
                checkId: 'query_vector_acceleration_representation_consistency',
                status: 'pass',
                message: 'Vector acceleration representation consistency check skipped because acceleration is disabled.',
                observed: queryVectorAccelerationRepresentationObserved,
                expected: 'accelerationEnabled=true and representationStatus=aligned',
            });
        } else if (queryVectorIndexAccelerationRepresentationStatus === 'mismatch') {
            checks.push({
                checkId: 'query_vector_acceleration_representation_consistency',
                status: 'fail',
                message: queryVectorIndexAccelerationRepresentationStrictMode
                    ? 'Vector acceleration representation metadata mismatches index semantics while strict mode is enabled.'
                    : 'Vector acceleration representation metadata mismatches index semantics.',
                observed: queryVectorAccelerationRepresentationObserved,
                expected: 'representationStatus=aligned',
            });
        } else if (queryVectorIndexAccelerationRepresentationStatus === 'aligned') {
            checks.push({
                checkId: 'query_vector_acceleration_representation_consistency',
                status: 'pass',
                message: 'Vector acceleration representation metadata is aligned with local index semantics.',
                observed: queryVectorAccelerationRepresentationObserved,
                expected: 'representationStatus=aligned',
            });
        } else if (
            queryVectorAccelerationRepresentationExternalConnector
            && queryVectorIndexAccelerationRequestCount >= thresholds.minQuerySampleSize
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_representation_consistency',
                status: 'warn',
                message: 'External vector acceleration connector has representative traffic but representation metadata is still unknown.',
                observed: queryVectorAccelerationRepresentationObserved,
                expected: 'representationStatus=aligned with representationVersion/embeddingModelId/indexSignature',
            });
        } else if (queryVectorAccelerationRepresentationExternalConnector) {
            checks.push({
                checkId: 'query_vector_acceleration_representation_consistency',
                status: 'pass',
                message: 'External vector acceleration connector representation metadata is pending; insufficient traffic for strict consistency evaluation.',
                observed: queryVectorAccelerationRepresentationObserved,
                expected: 'representationStatus=aligned after representative traffic',
            });
        } else {
            checks.push({
                checkId: 'query_vector_acceleration_representation_consistency',
                status: 'pass',
                message: 'Vector acceleration representation metadata is operating in local-verified mode.',
                observed: queryVectorAccelerationRepresentationObserved,
                expected: 'representationStatus=aligned',
            });
        }

        const queryVectorAccelerationPrefilterSelectionActive = (
            queryVectorIndexAccelerationLastSelectionMode === 'token_prefilter'
            || queryVectorIndexAccelerationLastSelectionMode === 'token_signature_prefilter'
        );
        const queryVectorAccelerationPrefilterSampleReady = (
            queryVectorIndexAccelerationRequestCount >= thresholds.queryVectorAccelerationPrefilterMinRequestSample
        );
        const queryVectorAccelerationPrefilterCandidateRatioPct = (
            queryVectorIndexAtomCount > 0
            && queryVectorIndexAccelerationLastCandidateCount > 0
        )
            ? Number(
                (
                    (queryVectorIndexAccelerationLastCandidateCount / Math.max(1, queryVectorIndexAtomCount))
                    * 100
                ).toFixed(4)
            )
            : 0;
        const queryVectorAccelerationPrefilterObserved = (
            `mode=${queryVectorIndexAccelerationMode},`
            + ` lastSelectionMode=${queryVectorIndexAccelerationLastSelectionMode},`
            + ` lastCandidateCount=${queryVectorIndexAccelerationLastCandidateCount},`
            + ` atomCount=${queryVectorIndexAtomCount},`
            + ` candidateRatio=${queryVectorAccelerationPrefilterCandidateRatioPct}%,`
            + ` requestCount=${queryVectorIndexAccelerationRequestCount},`
            + ` healthStatus=${queryVectorIndexAccelerationHealthStatus},`
            + ` circuitState=${queryVectorIndexAccelerationCircuitState}`
        );
        const queryVectorAccelerationStableConnector = (
            queryVectorIndexAccelerationHealthStatus === 'ready'
            && (
                queryVectorIndexAccelerationCircuitState === 'closed'
                || queryVectorIndexAccelerationCircuitState === 'unknown'
            )
        );
        const queryVectorAccelerationCanEvaluatePrefilterReduction = (
            queryVectorIndexAtomCount > 0
            && queryVectorIndexAccelerationLastCandidateCount > 0
            && queryVectorIndexAccelerationLastCandidateCount <= queryVectorIndexAtomCount
        );
        const queryVectorAccelerationPrefilterReductionSevere = (
            queryVectorAccelerationCanEvaluatePrefilterReduction
            && queryVectorAccelerationPrefilterCandidateRatioPct
                >= thresholds.queryVectorAccelerationPrefilterFailCandidateRatioPct
        );
        const queryVectorAccelerationPrefilterReductionWeak = (
            queryVectorAccelerationCanEvaluatePrefilterReduction
            && queryVectorAccelerationPrefilterCandidateRatioPct
                >= thresholds.queryVectorAccelerationPrefilterWarnCandidateRatioPct
        );
        if (!queryVectorIndexEnabled || queryVectorIndexStatus !== 'ready') {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: 'warn',
                message: 'Vector acceleration prefilter effectiveness cannot be validated before vector index reaches ready state.',
                observed: `vectorIndexEnabled=${queryVectorIndexEnabled}, vectorIndexStatus=${queryVectorIndexStatus}`,
                expected: 'vectorIndexEnabled=true and vectorIndexStatus=ready',
            });
        } else if (!queryVectorIndexAccelerationEnabled) {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: 'pass',
                message: 'Vector acceleration prefilter effectiveness check skipped because acceleration is disabled.',
                observed: `accelerationEnabled=${queryVectorIndexAccelerationEnabled}, mode=${queryVectorIndexAccelerationMode}`,
                expected: 'accelerationEnabled=true and mode=ann_prefilter',
            });
        } else if (queryVectorIndexAccelerationMode !== 'ann_prefilter') {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: 'pass',
                message: 'Vector acceleration prefilter effectiveness check deferred because ANN prefilter mode is not active.',
                observed: queryVectorAccelerationPrefilterObserved,
                expected: 'mode=ann_prefilter',
            });
        } else if (
            queryVectorIndexAccelerationLastSelectionMode === 'full_scan'
            && queryVectorAccelerationPrefilterSampleReady
            && queryVectorAccelerationStableConnector
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: 'fail',
                message: 'ANN prefilter mode is enabled but selection repeatedly falls back to full scan under stable connector conditions.',
                observed: queryVectorAccelerationPrefilterObserved,
                expected: 'lastSelectionMode=token_prefilter|token_signature_prefilter under representative traffic',
            });
        } else if (!queryVectorAccelerationPrefilterSelectionActive) {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: queryVectorAccelerationPrefilterSampleReady ? 'warn' : 'pass',
                message: queryVectorAccelerationPrefilterSampleReady
                    ? 'ANN prefilter effectiveness is inconclusive because selection telemetry is not yet prefilter-driven.'
                    : 'ANN prefilter effectiveness check deferred until representative acceleration traffic is collected.',
                observed: queryVectorAccelerationPrefilterObserved,
                expected: 'lastSelectionMode=token_prefilter|token_signature_prefilter with candidate telemetry',
            });
        } else if (
            queryVectorAccelerationPrefilterSampleReady
            && queryVectorIndexAccelerationLastCandidateCount <= 0
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: 'warn',
                message: 'ANN prefilter selection is active but candidate count telemetry is missing.',
                observed: queryVectorAccelerationPrefilterObserved,
                expected: 'lastCandidateCount>0 when prefilter selection is active',
            });
        } else if (
            queryVectorAccelerationPrefilterSampleReady
            && queryVectorAccelerationPrefilterReductionSevere
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: 'fail',
                message: 'ANN prefilter is active but candidate reduction breaches the configured fail threshold.',
                observed: queryVectorAccelerationPrefilterObserved,
                expected: `candidateRatio<${thresholds.queryVectorAccelerationPrefilterFailCandidateRatioPct}% under representative ANN prefilter traffic`,
            });
        } else if (
            queryVectorAccelerationPrefilterSampleReady
            && queryVectorAccelerationPrefilterReductionWeak
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: 'warn',
                message: 'ANN prefilter is active but candidate reduction is weak in the latest diagnostic cycle.',
                observed: queryVectorAccelerationPrefilterObserved,
                expected: `candidateRatio<${thresholds.queryVectorAccelerationPrefilterWarnCandidateRatioPct}% under representative ANN prefilter traffic`,
            });
        } else {
            checks.push({
                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                status: 'pass',
                message: 'ANN prefilter effectiveness telemetry is healthy for the latest diagnostic cycle.',
                observed: queryVectorAccelerationPrefilterObserved,
                expected: 'prefilter selection active with representative candidate telemetry',
            });
        }

        if (!queryVectorIndexEnabled || queryVectorIndexStatus !== 'ready') {
            checks.push({
                checkId: 'query_vector_acceleration_health',
                status: 'warn',
                message: 'Vector acceleration health cannot be validated before vector index reaches ready state.',
                observed: `vectorIndexEnabled=${queryVectorIndexEnabled}, vectorIndexStatus=${queryVectorIndexStatus}`,
                expected: 'vectorIndexEnabled=true and vectorIndexStatus=ready',
            });
        } else if (!queryVectorIndexAccelerationEnabled) {
            checks.push({
                checkId: 'query_vector_acceleration_health',
                status: 'warn',
                message: 'Vector acceleration health check is running in fallback mode because acceleration is disabled.',
                observed: `accelerationEnabled=${queryVectorIndexAccelerationEnabled}, healthStatus=${queryVectorIndexAccelerationHealthStatus}`,
                expected: 'accelerationEnabled=true and healthStatus=ready|unknown',
            });
        } else if (queryVectorIndexAccelerationHealthStatus === 'unavailable') {
            checks.push({
                checkId: 'query_vector_acceleration_health',
                status: 'fail',
                message: 'Vector acceleration adapter health is unavailable and requires immediate connector recovery.',
                observed: `healthStatus=${queryVectorIndexAccelerationHealthStatus}, adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'}, message=${queryVectorIndexAccelerationHealthMessage || queryVectorIndexAccelerationAdapterError || 'none'}`,
                expected: 'healthStatus=ready|unknown',
            });
        } else if (queryVectorIndexAccelerationHealthStatus === 'degraded') {
            checks.push({
                checkId: 'query_vector_acceleration_health',
                status: 'warn',
                message: 'Vector acceleration adapter health is degraded; monitor connector stability and fallback ratio.',
                observed: `healthStatus=${queryVectorIndexAccelerationHealthStatus}, adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'}, message=${queryVectorIndexAccelerationHealthMessage || queryVectorIndexAccelerationAdapterError || 'none'}`,
                expected: 'healthStatus=ready|unknown',
            });
        } else if (queryVectorIndexAccelerationHealthStatus === 'ready') {
            checks.push({
                checkId: 'query_vector_acceleration_health',
                status: 'pass',
                message: 'Vector acceleration adapter reports ready health status.',
                observed: `healthStatus=${queryVectorIndexAccelerationHealthStatus}, adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'}`,
                expected: 'healthStatus=ready|unknown',
            });
        } else {
            checks.push({
                checkId: 'query_vector_acceleration_health',
                status: 'pass',
                message: 'Vector acceleration adapter health telemetry is not explicitly reported.',
                observed: `healthStatus=${queryVectorIndexAccelerationHealthStatus}, adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'}`,
                expected: 'healthStatus=ready|unknown',
            });
        }

        const queryVectorAccelerationExternalConnector = (
            queryVectorIndexAccelerationAdapterId.length > 0
            && queryVectorIndexAccelerationAdapterId.toLowerCase().includes('external')
        );
        const queryVectorAccelerationHasCorrelationFields = (
            queryVectorIndexAccelerationLastRequestId.length > 0
            || queryVectorIndexAccelerationLastErrorCode.length > 0
            || queryVectorIndexAccelerationLastRetryAfterMs > 0
        );
        const queryVectorAccelerationTraceabilityObserved = (
            `adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'},`
            + ` externalConnector=${queryVectorAccelerationExternalConnector},`
            + ` requestCount=${queryVectorIndexAccelerationRequestCount},`
            + ` healthStatus=${queryVectorIndexAccelerationHealthStatus},`
            + ` circuitState=${queryVectorIndexAccelerationCircuitState},`
            + ` lastRequestId=${queryVectorIndexAccelerationLastRequestId || '<none>'},`
            + ` lastErrorCode=${queryVectorIndexAccelerationLastErrorCode || '<none>'},`
            + ` lastRetryAfterMs=${queryVectorIndexAccelerationLastRetryAfterMs}`
        );
        if (!queryVectorIndexEnabled || queryVectorIndexStatus !== 'ready') {
            checks.push({
                checkId: 'query_vector_acceleration_traceability',
                status: 'warn',
                message: 'Vector acceleration traceability cannot be validated before vector index reaches ready state.',
                observed: `vectorIndexEnabled=${queryVectorIndexEnabled}, vectorIndexStatus=${queryVectorIndexStatus}`,
                expected: 'vectorIndexEnabled=true and vectorIndexStatus=ready',
            });
        } else if (!queryVectorIndexAccelerationEnabled) {
            checks.push({
                checkId: 'query_vector_acceleration_traceability',
                status: 'warn',
                message: 'Vector acceleration traceability check is running in fallback mode because acceleration is disabled.',
                observed: `accelerationEnabled=${queryVectorIndexAccelerationEnabled}, adapterId=${queryVectorIndexAccelerationAdapterId || 'unknown'}`,
                expected: 'accelerationEnabled=true for connector traceability validation',
            });
        } else if (!queryVectorAccelerationExternalConnector) {
            checks.push({
                checkId: 'query_vector_acceleration_traceability',
                status: 'pass',
                message: 'Vector acceleration is using local adapter path; external connector correlation fields are not required.',
                observed: queryVectorAccelerationTraceabilityObserved,
                expected: 'external connector adapters should emit request correlation fields',
            });
        } else if (
            !queryVectorAccelerationHasCorrelationFields
            && (
                queryVectorIndexAccelerationHealthStatus === 'unavailable'
                || queryVectorIndexAccelerationCircuitState === 'open'
            )
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_traceability',
                status: 'fail',
                message: 'External vector acceleration connector is unstable but correlation fields are missing.',
                observed: queryVectorAccelerationTraceabilityObserved,
                expected: 'lastRequestId|lastErrorCode|lastRetryAfterMs should be present during unstable connector states',
            });
        } else if (
            !queryVectorAccelerationHasCorrelationFields
            && (
                queryVectorIndexAccelerationHealthStatus === 'degraded'
                || queryVectorIndexAccelerationConsecutiveFailures > 0
                || queryVectorIndexAccelerationShortCircuitCount > 0
                || queryVectorIndexAccelerationRequestCount >= thresholds.minQuerySampleSize
            )
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_traceability',
                status: 'warn',
                message: 'External vector acceleration connector shows instability but correlation fields are still sparse.',
                observed: queryVectorAccelerationTraceabilityObserved,
                expected: 'lastRequestId|lastErrorCode|lastRetryAfterMs should be captured for external connector troubleshooting',
            });
        } else if (!queryVectorAccelerationHasCorrelationFields) {
            checks.push({
                checkId: 'query_vector_acceleration_traceability',
                status: 'warn',
                message: 'External vector acceleration connector has not emitted correlation fields yet.',
                observed: queryVectorAccelerationTraceabilityObserved,
                expected: 'lastRequestId|lastErrorCode|lastRetryAfterMs should appear after representative connector traffic',
            });
        } else {
            checks.push({
                checkId: 'query_vector_acceleration_traceability',
                status: 'pass',
                message: 'External vector acceleration connector correlation fields are available for incident drilldown.',
                observed: queryVectorAccelerationTraceabilityObserved,
                expected: 'lastRequestId|lastErrorCode|lastRetryAfterMs available',
            });
        }

        const queryVectorAccelerationShortCircuitFailBudgetExceeded = (
            queryVectorIndexAccelerationShortCircuitCount
                >= thresholds.queryVectorAccelerationShortCircuitFailCount
            || queryVectorIndexAccelerationShortCircuitRatioPct
                >= thresholds.queryVectorAccelerationShortCircuitFailRatioPct
        );
        const queryVectorAccelerationShortCircuitWarnBudgetExceeded = (
            queryVectorIndexAccelerationShortCircuitCount
                >= thresholds.queryVectorAccelerationShortCircuitWarnCount
            || queryVectorIndexAccelerationShortCircuitRatioPct
                >= thresholds.queryVectorAccelerationShortCircuitWarnRatioPct
        );
        const queryVectorAccelerationConsecutiveFailuresFailBudgetExceeded = (
            queryVectorIndexAccelerationConsecutiveFailures
                >= thresholds.queryVectorAccelerationConsecutiveFailuresFailCount
        );
        const queryVectorAccelerationConsecutiveFailuresWarnBudgetExceeded = (
            queryVectorIndexAccelerationConsecutiveFailures
                >= thresholds.queryVectorAccelerationConsecutiveFailuresWarnCount
        );
        const queryVectorAccelerationHalfOpenSuccessFailBudgetExceeded = (
            queryVectorIndexAccelerationHalfOpenProbeCount > 0
            && queryVectorIndexAccelerationHalfOpenSuccessRatePct
                < thresholds.queryVectorAccelerationHalfOpenSuccessFailRatioPct
        );
        const queryVectorAccelerationHalfOpenSuccessWarnBudgetExceeded = (
            queryVectorIndexAccelerationHalfOpenProbeCount > 0
            && queryVectorIndexAccelerationHalfOpenSuccessRatePct
                < thresholds.queryVectorAccelerationHalfOpenSuccessWarnRatioPct
        );
        const shouldEvaluateQueryVectorAccelerationCircuitBudget = (
            queryVectorIndexEnabled
            && queryVectorIndexStatus === 'ready'
            && queryVectorIndexAccelerationEnabled
        );
        const queryVectorAccelerationCircuitFailBudgetExceeded = (
            shouldEvaluateQueryVectorAccelerationCircuitBudget
            && (
                queryVectorIndexAccelerationCircuitState === 'open'
                || queryVectorAccelerationShortCircuitFailBudgetExceeded
                || queryVectorAccelerationConsecutiveFailuresFailBudgetExceeded
                || queryVectorAccelerationHalfOpenSuccessFailBudgetExceeded
            )
        );
        const queryVectorAccelerationCircuitWarnBudgetExceeded = (
            shouldEvaluateQueryVectorAccelerationCircuitBudget
            && (
                queryVectorAccelerationCircuitFailBudgetExceeded
                || queryVectorIndexAccelerationCircuitState === 'half_open'
                || queryVectorAccelerationShortCircuitWarnBudgetExceeded
                || queryVectorAccelerationConsecutiveFailuresWarnBudgetExceeded
                || queryVectorAccelerationHalfOpenSuccessWarnBudgetExceeded
            )
        );
        queryVectorIndexAccelerationCircuitWarnBudgetExceeded = queryVectorAccelerationCircuitWarnBudgetExceeded;
        queryVectorIndexAccelerationCircuitFailBudgetExceeded = queryVectorAccelerationCircuitFailBudgetExceeded;
        queryVectorIndexAccelerationCircuitBudgetStatus = queryVectorAccelerationCircuitFailBudgetExceeded
            ? 'fail'
            : (queryVectorAccelerationCircuitWarnBudgetExceeded ? 'warn' : 'ok');

        if (!queryVectorIndexEnabled || queryVectorIndexStatus !== 'ready') {
            checks.push({
                checkId: 'query_vector_acceleration_circuit_state',
                status: 'warn',
                message: 'Vector acceleration circuit state cannot be validated before vector index reaches ready state.',
                observed: `vectorIndexEnabled=${queryVectorIndexEnabled}, vectorIndexStatus=${queryVectorIndexStatus}`,
                expected: 'vectorIndexEnabled=true and vectorIndexStatus=ready',
            });
        } else if (!queryVectorIndexAccelerationEnabled) {
            checks.push({
                checkId: 'query_vector_acceleration_circuit_state',
                status: 'warn',
                message: 'Vector acceleration circuit governance is running in fallback mode because acceleration is disabled.',
                observed: `accelerationEnabled=${queryVectorIndexAccelerationEnabled}, circuitState=${queryVectorIndexAccelerationCircuitState}`,
                expected: 'accelerationEnabled=true and circuitState=closed|unknown',
            });
        } else if (queryVectorIndexAccelerationCircuitState === 'open') {
            checks.push({
                checkId: 'query_vector_acceleration_circuit_state',
                status: 'fail',
                message: 'Vector acceleration circuit is open; connector calls are currently short-circuited.',
                observed: (
                    `circuitState=${queryVectorIndexAccelerationCircuitState},`
                    + ` shortCircuitCount=${queryVectorIndexAccelerationShortCircuitCount},`
                    + ` shortCircuitRatio=${queryVectorIndexAccelerationShortCircuitRatioPct}%,`
                    + ` consecutiveFailures=${queryVectorIndexAccelerationConsecutiveFailures}`
                ),
                expected: 'circuitState=closed|unknown',
            });
        } else if (
            queryVectorIndexAccelerationCircuitState === 'half_open'
            && queryVectorAccelerationCircuitFailBudgetExceeded
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_circuit_state',
                status: 'fail',
                message: 'Vector acceleration circuit is half-open but recovery/instability metrics exceed fail budgets.',
                observed: (
                    `circuitState=${queryVectorIndexAccelerationCircuitState},`
                    + ` shortCircuitCount=${queryVectorIndexAccelerationShortCircuitCount},`
                    + ` shortCircuitRatio=${queryVectorIndexAccelerationShortCircuitRatioPct}%,`
                    + ` consecutiveFailures=${queryVectorIndexAccelerationConsecutiveFailures},`
                    + ` halfOpenProbeCount=${queryVectorIndexAccelerationHalfOpenProbeCount},`
                    + ` halfOpenSuccessRate=${queryVectorIndexAccelerationHalfOpenSuccessRatePct}%`
                ),
                expected: (
                    `shortCircuitCount<${thresholds.queryVectorAccelerationShortCircuitFailCount},`
                    + ` shortCircuitRatio<${thresholds.queryVectorAccelerationShortCircuitFailRatioPct}%,`
                    + ` consecutiveFailures<${thresholds.queryVectorAccelerationConsecutiveFailuresFailCount},`
                    + ` halfOpenSuccessRate>=${thresholds.queryVectorAccelerationHalfOpenSuccessFailRatioPct}% (if probes>0)`
                ),
            });
        } else if (queryVectorIndexAccelerationCircuitState === 'half_open') {
            checks.push({
                checkId: 'query_vector_acceleration_circuit_state',
                status: 'warn',
                message: 'Vector acceleration circuit is half-open and recovery probes are in progress.',
                observed: (
                    `circuitState=${queryVectorIndexAccelerationCircuitState},`
                    + ` shortCircuitRatio=${queryVectorIndexAccelerationShortCircuitRatioPct}%,`
                    + ` halfOpenProbeCount=${queryVectorIndexAccelerationHalfOpenProbeCount},`
                    + ` halfOpenSuccessRate=${queryVectorIndexAccelerationHalfOpenSuccessRatePct}%`
                ),
                expected: (
                    `circuitState=closed|unknown and halfOpenSuccessRate>=${thresholds.queryVectorAccelerationHalfOpenSuccessWarnRatioPct}%`
                    + ' (if probes>0)'
                ),
            });
        } else if (
            queryVectorAccelerationCircuitFailBudgetExceeded
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_circuit_state',
                status: 'fail',
                message: 'Vector acceleration circuit is closed but instability metrics exceed fail budgets.',
                observed: (
                    `circuitState=${queryVectorIndexAccelerationCircuitState},`
                    + ` shortCircuitCount=${queryVectorIndexAccelerationShortCircuitCount},`
                    + ` shortCircuitRatio=${queryVectorIndexAccelerationShortCircuitRatioPct}%,`
                    + ` consecutiveFailures=${queryVectorIndexAccelerationConsecutiveFailures},`
                    + ` halfOpenProbeCount=${queryVectorIndexAccelerationHalfOpenProbeCount},`
                    + ` halfOpenSuccessRate=${queryVectorIndexAccelerationHalfOpenSuccessRatePct}%`
                ),
                expected: (
                    `shortCircuitCount<${thresholds.queryVectorAccelerationShortCircuitFailCount},`
                    + ` shortCircuitRatio<${thresholds.queryVectorAccelerationShortCircuitFailRatioPct}%,`
                    + ` consecutiveFailures<${thresholds.queryVectorAccelerationConsecutiveFailuresFailCount},`
                    + ` halfOpenSuccessRate>=${thresholds.queryVectorAccelerationHalfOpenSuccessFailRatioPct}% (if probes>0)`
                ),
            });
        } else if (
            queryVectorAccelerationCircuitWarnBudgetExceeded
        ) {
            checks.push({
                checkId: 'query_vector_acceleration_circuit_state',
                status: 'warn',
                message: 'Vector acceleration circuit is closed but instability metrics exceed warn budgets.',
                observed: (
                    `circuitState=${queryVectorIndexAccelerationCircuitState},`
                    + ` shortCircuitCount=${queryVectorIndexAccelerationShortCircuitCount},`
                    + ` shortCircuitRatio=${queryVectorIndexAccelerationShortCircuitRatioPct}%,`
                    + ` consecutiveFailures=${queryVectorIndexAccelerationConsecutiveFailures},`
                    + ` halfOpenProbeCount=${queryVectorIndexAccelerationHalfOpenProbeCount},`
                    + ` halfOpenSuccessRate=${queryVectorIndexAccelerationHalfOpenSuccessRatePct}%`
                ),
                expected: (
                    `shortCircuitCount<${thresholds.queryVectorAccelerationShortCircuitWarnCount},`
                    + ` shortCircuitRatio<${thresholds.queryVectorAccelerationShortCircuitWarnRatioPct}%,`
                    + ` consecutiveFailures<${thresholds.queryVectorAccelerationConsecutiveFailuresWarnCount},`
                    + ` halfOpenSuccessRate>=${thresholds.queryVectorAccelerationHalfOpenSuccessWarnRatioPct}% (if probes>0)`
                ),
            });
        } else {
            checks.push({
                checkId: 'query_vector_acceleration_circuit_state',
                status: 'pass',
                message: 'Vector acceleration circuit is closed and stable.',
                observed: (
                    `circuitState=${queryVectorIndexAccelerationCircuitState},`
                    + ` requestCount=${queryVectorIndexAccelerationRequestCount},`
                    + ` retryCount=${queryVectorIndexAccelerationRetryCount},`
                    + ` shortCircuitRatio=${queryVectorIndexAccelerationShortCircuitRatioPct}%`
                ),
                expected: 'circuitState=closed|unknown',
            });
        }
    } else {
        checks.push({
            checkId: 'query_vector_index_status',
            status: 'pass',
            message: 'Local vector index status check skipped because local_vector backend is not active.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_vector',
        });
        checks.push({
            checkId: 'query_vector_index_persistence',
            status: 'pass',
            message: 'Local vector index persistence check skipped because local_vector backend is not active.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_vector',
        });
        checks.push({
            checkId: 'query_vector_acceleration_mode',
            status: 'pass',
            message: 'Local vector acceleration mode check skipped because local_vector backend is not active.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_vector',
        });
        checks.push({
            checkId: 'query_vector_acceleration_representation_consistency',
            status: 'pass',
            message: 'Local vector acceleration representation-consistency check skipped because local_vector backend is not active.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_vector',
        });
        checks.push({
            checkId: 'query_vector_acceleration_prefilter_effectiveness',
            status: 'pass',
            message: 'Local vector acceleration prefilter-effectiveness check skipped because local_vector backend is not active.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_vector',
        });
        checks.push({
            checkId: 'query_vector_acceleration_health',
            status: 'pass',
            message: 'Local vector acceleration health check skipped because local_vector backend is not active.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_vector',
        });
        checks.push({
            checkId: 'query_vector_acceleration_traceability',
            status: 'pass',
            message: 'Local vector acceleration traceability check skipped because local_vector backend is not active.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_vector',
        });
        checks.push({
            checkId: 'query_vector_acceleration_circuit_state',
            status: 'pass',
            message: 'Local vector acceleration circuit-state check skipped because local_vector backend is not active.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_vector',
        });
    }

    if (params.configuredQueryBackend === 'keyword_only') {
        checks.push({
            checkId: 'query_graph_retrieval_capability',
            status: 'warn',
            message: 'Keyword-only query backend limits graph/semantic retrieval depth.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
            expected: 'configuredQueryBackend=local_hybrid|local_vector',
        });
    } else {
        checks.push({
            checkId: 'query_graph_retrieval_capability',
            status: 'pass',
            message: 'Graph-aware query backend is enabled.',
            observed: `configuredQueryBackend=${params.configuredQueryBackend}`,
        });
    }

    if (safeQueryCount < thresholds.minQuerySampleSize) {
        checks.push({
            checkId: 'query_fallback_ratio',
            status: 'warn',
            message: 'Insufficient query sample size for stable fallback ratio assessment.',
            observed: `queryCount=${safeQueryCount}, fallbackCount=${safeFallbackCount}, fallbackRatio=${queryFallbackRatioPct}%`,
            expected: `queryCount>=${thresholds.minQuerySampleSize}`,
        });
    } else if (queryFallbackRatioPct > thresholds.queryFallbackFailRatioPct) {
        checks.push({
            checkId: 'query_fallback_ratio',
            status: 'fail',
            message: 'Query backend fallback ratio exceeds hard reliability ceiling.',
            observed: `fallbackRatio=${queryFallbackRatioPct}%`,
            expected: `fallbackRatio<=${thresholds.queryFallbackFailRatioPct}%`,
        });
    } else if (queryFallbackRatioPct > thresholds.queryFallbackWarnRatioPct) {
        checks.push({
            checkId: 'query_fallback_ratio',
            status: 'warn',
            message: 'Query backend fallback ratio exceeds preferred budget.',
            observed: `fallbackRatio=${queryFallbackRatioPct}%`,
            expected: `fallbackRatio<=${thresholds.queryFallbackWarnRatioPct}%`,
        });
    } else {
        checks.push({
            checkId: 'query_fallback_ratio',
            status: 'pass',
            message: 'Query backend fallback ratio is within budget.',
            observed: `fallbackRatio=${queryFallbackRatioPct}%`,
            expected: `fallbackRatio<=${thresholds.queryFallbackWarnRatioPct}%`,
        });
    }

    if (queryExplainabilitySampleCount <= 0) {
        checks.push({
            checkId: 'query_evidence_coverage_ratio',
            status: 'pass',
            message: 'Explainability evidence telemetry is unavailable; quality gate deferred until samples are collected.',
            observed: `sampleCount=${queryExplainabilitySampleCount}, evidenceCoverage=${queryEvidenceCoverageRatioPct}%`,
            expected: `sampleCount>=${thresholds.minQuerySampleSize}`,
        });
        checks.push({
            checkId: 'query_temporal_validity_ratio',
            status: 'pass',
            message: 'Temporal-validity telemetry is unavailable; quality gate deferred until samples are collected.',
            observed: `sampleCount=${queryExplainabilitySampleCount}, temporalValidity=${queryTemporalValidityPassRatioPct}%`,
            expected: `sampleCount>=${thresholds.minQuerySampleSize}`,
        });
    } else if (queryExplainabilitySampleCount < thresholds.minQuerySampleSize) {
        checks.push({
            checkId: 'query_evidence_coverage_ratio',
            status: 'warn',
            message: 'Insufficient query sample size for stable explainability coverage assessment.',
            observed: `sampleCount=${queryExplainabilitySampleCount}, evidenceCoverage=${queryEvidenceCoverageRatioPct}%`,
            expected: `sampleCount>=${thresholds.minQuerySampleSize}`,
        });
        checks.push({
            checkId: 'query_temporal_validity_ratio',
            status: 'warn',
            message: 'Insufficient query sample size for stable temporal validity assessment.',
            observed: `sampleCount=${queryExplainabilitySampleCount}, temporalValidity=${queryTemporalValidityPassRatioPct}%`,
            expected: `sampleCount>=${thresholds.minQuerySampleSize}`,
        });
    } else {
        if (queryEvidenceCoverageRatioPct < thresholds.queryEvidenceCoverageFailRatioPct) {
            checks.push({
                checkId: 'query_evidence_coverage_ratio',
                status: 'fail',
                message: 'Query evidence coverage ratio is below hard explainability floor.',
                observed: `evidenceCoverage=${queryEvidenceCoverageRatioPct}%`,
                expected: `evidenceCoverage>=${thresholds.queryEvidenceCoverageFailRatioPct}%`,
            });
        } else if (queryEvidenceCoverageRatioPct < thresholds.queryEvidenceCoverageWarnRatioPct) {
            checks.push({
                checkId: 'query_evidence_coverage_ratio',
                status: 'warn',
                message: 'Query evidence coverage ratio is below preferred explainability target.',
                observed: `evidenceCoverage=${queryEvidenceCoverageRatioPct}%`,
                expected: `evidenceCoverage>=${thresholds.queryEvidenceCoverageWarnRatioPct}%`,
            });
        } else {
            checks.push({
                checkId: 'query_evidence_coverage_ratio',
                status: 'pass',
                message: 'Query evidence coverage ratio is within explainability target.',
                observed: `evidenceCoverage=${queryEvidenceCoverageRatioPct}%`,
                expected: `evidenceCoverage>=${thresholds.queryEvidenceCoverageWarnRatioPct}%`,
            });
        }

        if (queryTemporalValidityPassRatioPct < thresholds.queryTemporalValidityFailRatioPct) {
            checks.push({
                checkId: 'query_temporal_validity_ratio',
                status: 'fail',
                message: 'Query temporal validity pass ratio is below hard floor.',
                observed: `temporalValidity=${queryTemporalValidityPassRatioPct}%`,
                expected: `temporalValidity>=${thresholds.queryTemporalValidityFailRatioPct}%`,
            });
        } else if (queryTemporalValidityPassRatioPct < thresholds.queryTemporalValidityWarnRatioPct) {
            checks.push({
                checkId: 'query_temporal_validity_ratio',
                status: 'warn',
                message: 'Query temporal validity pass ratio is below preferred target.',
                observed: `temporalValidity=${queryTemporalValidityPassRatioPct}%`,
                expected: `temporalValidity>=${thresholds.queryTemporalValidityWarnRatioPct}%`,
            });
        } else {
            checks.push({
                checkId: 'query_temporal_validity_ratio',
                status: 'pass',
                message: 'Query temporal validity pass ratio is within target.',
                observed: `temporalValidity=${queryTemporalValidityPassRatioPct}%`,
                expected: `temporalValidity>=${thresholds.queryTemporalValidityWarnRatioPct}%`,
            });
        }
    }

    if (queryBackendComparisonSampleCount <= 0) {
        checks.push({
            checkId: 'query_backend_explainability_gap',
            status: 'pass',
            message: 'Backend comparison explainability telemetry is unavailable; gap gate deferred until samples are collected.',
            observed: `sampleCount=${queryBackendComparisonSampleCount}, maxGap=${queryBackendComparisonMaxExplainabilityGapRatioPct}%`,
            expected: `sampleCount>=${thresholds.minQuerySampleSize}`,
        });
    } else if (queryBackendComparisonSampleCount < thresholds.minQuerySampleSize) {
        checks.push({
            checkId: 'query_backend_explainability_gap',
            status: 'warn',
            message: 'Backend comparison sample size is insufficient for stable explainability-gap assessment.',
            observed: [
                `sampleCount=${queryBackendComparisonSampleCount}`,
                `evidenceGap=${queryBackendComparisonEvidenceGapRatioPct}%`,
                `relationGap=${queryBackendComparisonRelationGapRatioPct}%`,
                `temporalGap=${queryBackendComparisonTemporalGapRatioPct}%`,
                `maxGap=${queryBackendComparisonMaxExplainabilityGapRatioPct}%`,
            ].join(', '),
            expected: `sampleCount>=${thresholds.minQuerySampleSize}`,
        });
    } else if (queryBackendComparisonMaxExplainabilityGapRatioPct > thresholds.queryBackendExplainabilityGapFailRatioPct) {
        checks.push({
            checkId: 'query_backend_explainability_gap',
            status: 'fail',
            message: 'Cross-backend explainability gap exceeds hard consistency ceiling.',
            observed: [
                `sampleCount=${queryBackendComparisonSampleCount}`,
                `evidenceGap=${queryBackendComparisonEvidenceGapRatioPct}%`,
                `relationGap=${queryBackendComparisonRelationGapRatioPct}%`,
                `temporalGap=${queryBackendComparisonTemporalGapRatioPct}%`,
                `maxGap=${queryBackendComparisonMaxExplainabilityGapRatioPct}%`,
            ].join(', '),
            expected: `maxGap<=${thresholds.queryBackendExplainabilityGapFailRatioPct}%`,
        });
    } else if (queryBackendComparisonMaxExplainabilityGapRatioPct > thresholds.queryBackendExplainabilityGapWarnRatioPct) {
        checks.push({
            checkId: 'query_backend_explainability_gap',
            status: 'warn',
            message: 'Cross-backend explainability gap exceeds preferred consistency budget.',
            observed: [
                `sampleCount=${queryBackendComparisonSampleCount}`,
                `evidenceGap=${queryBackendComparisonEvidenceGapRatioPct}%`,
                `relationGap=${queryBackendComparisonRelationGapRatioPct}%`,
                `temporalGap=${queryBackendComparisonTemporalGapRatioPct}%`,
                `maxGap=${queryBackendComparisonMaxExplainabilityGapRatioPct}%`,
            ].join(', '),
            expected: `maxGap<=${thresholds.queryBackendExplainabilityGapWarnRatioPct}%`,
        });
    } else {
        checks.push({
            checkId: 'query_backend_explainability_gap',
            status: 'pass',
            message: 'Cross-backend explainability gap is within consistency budget.',
            observed: [
                `sampleCount=${queryBackendComparisonSampleCount}`,
                `evidenceGap=${queryBackendComparisonEvidenceGapRatioPct}%`,
                `relationGap=${queryBackendComparisonRelationGapRatioPct}%`,
                `temporalGap=${queryBackendComparisonTemporalGapRatioPct}%`,
                `maxGap=${queryBackendComparisonMaxExplainabilityGapRatioPct}%`,
            ].join(', '),
            expected: `maxGap<=${thresholds.queryBackendExplainabilityGapWarnRatioPct}%`,
        });
    }

    if (!hasQueryBackendComparisonTrendConfig) {
        checks.push({
            checkId: 'query_backend_trend_config',
            status: 'pass',
            message: 'Backend comparison trend config is unavailable; config sanity gate deferred.',
            observed: 'config=missing',
            expected: 'limit/windowSize/minSamples configured',
        });
    } else if (queryBackendComparisonTrendLimit < queryBackendComparisonTrendRequiredRecords) {
        checks.push({
            checkId: 'query_backend_trend_config',
            status: 'fail',
            message: 'Backend comparison trend config is internally inconsistent for dual-window evaluation.',
            observed: [
                `limit=${queryBackendComparisonTrendLimit}`,
                `windowSize=${queryBackendComparisonTrendWindowSize}`,
                `minSamples=${queryBackendComparisonTrendMinSamples}`,
                `requiredRecords=${queryBackendComparisonTrendRequiredRecords}`,
            ].join(', '),
            expected: `limit>=${queryBackendComparisonTrendRequiredRecords}`,
        });
    } else if (
        queryBackendComparisonSampleCount > 0
        && queryBackendComparisonSampleCount < queryBackendComparisonTrendRequiredRecords
    ) {
        checks.push({
            checkId: 'query_backend_trend_config',
            status: 'warn',
            message: 'Backend comparison trend config needs more history samples to produce stable windows.',
            observed: [
                `sampleCount=${queryBackendComparisonSampleCount}`,
                `limit=${queryBackendComparisonTrendLimit}`,
                `windowSize=${queryBackendComparisonTrendWindowSize}`,
                `minSamples=${queryBackendComparisonTrendMinSamples}`,
                `requiredRecords=${queryBackendComparisonTrendRequiredRecords}`,
            ].join(', '),
            expected: `sampleCount>=${queryBackendComparisonTrendRequiredRecords}`,
        });
    } else {
        checks.push({
            checkId: 'query_backend_trend_config',
            status: 'pass',
            message: 'Backend comparison trend config is compatible with current sample budget.',
            observed: [
                `sampleCount=${queryBackendComparisonSampleCount}`,
                `limit=${queryBackendComparisonTrendLimit}`,
                `windowSize=${queryBackendComparisonTrendWindowSize}`,
                `minSamples=${queryBackendComparisonTrendMinSamples}`,
                `requiredRecords=${queryBackendComparisonTrendRequiredRecords}`,
            ].join(', '),
            expected: `limit>=${queryBackendComparisonTrendRequiredRecords}`,
        });
    }

    if (queryBackendComparisonTrendStatus === 'regressing') {
        if (
            queryBackendComparisonTrendConfidenceRatioPct
            >= thresholds.queryBackendTrendFailConfidenceRatioPct
        ) {
            checks.push({
                checkId: 'query_backend_comparison_trend',
                status: 'fail',
                message: 'Backend comparison trend is regressing with high confidence.',
                observed: queryBackendComparisonTrendObserved,
                expected: [
                    `status in {stable, improving}`,
                    `or regressingConfidence<${thresholds.queryBackendTrendFailConfidenceRatioPct}%`,
                ].join(', '),
            });
        } else {
            checks.push({
                checkId: 'query_backend_comparison_trend',
                status: 'warn',
                message: 'Backend comparison trend is regressing and requires monitoring.',
                observed: queryBackendComparisonTrendObserved,
                expected: [
                    `status in {stable, improving}`,
                    `or regressingConfidence<${thresholds.queryBackendTrendWarnConfidenceRatioPct}%`,
                ].join(', '),
            });
        }
    } else if (queryBackendComparisonTrendStatus === 'insufficient_data') {
        checks.push({
            checkId: 'query_backend_comparison_trend',
            status: 'warn',
            message: 'Backend comparison trend has insufficient data.',
            observed: queryBackendComparisonTrendObserved,
            expected: 'status in {stable, improving, regressing}',
        });
    } else if (
        queryBackendComparisonTrendStatus === 'stable'
        || queryBackendComparisonTrendStatus === 'improving'
    ) {
        checks.push({
            checkId: 'query_backend_comparison_trend',
            status: 'pass',
            message: queryBackendComparisonTrendStatus === 'improving'
                ? 'Backend comparison trend is improving.'
                : 'Backend comparison trend is stable.',
            observed: queryBackendComparisonTrendObserved,
            expected: 'status in {stable, improving}',
        });
    } else {
        if (!hasQueryBackendComparisonTrendSignal) {
            checks.push({
                checkId: 'query_backend_comparison_trend',
                status: 'pass',
                message: 'Backend comparison trend telemetry is unavailable; trend gate deferred until samples are collected.',
                observed: queryBackendComparisonTrendObserved || 'status=unknown',
                expected: 'trend telemetry available',
            });
        } else {
            checks.push({
                checkId: 'query_backend_comparison_trend',
                status: 'warn',
                message: 'Backend comparison trend signal is unavailable.',
                observed: queryBackendComparisonTrendObserved || 'status=unknown',
                expected: 'status in {stable, improving, regressing, insufficient_data}',
            });
        }
    }

    if (hasApiRequestErrorTelemetry) {
        if (apiTraceWindowRequests <= 0) {
            checks.push({
                checkId: 'api_invalid_request_ratio',
                status: 'warn',
                message: 'API request trace has no traffic sample yet for invalid-request governance.',
                observed: apiInvalidRequestObserved,
                expected: 'requests>=1',
            });
        } else if (apiTraceWindowErrors <= 0) {
            checks.push({
                checkId: 'api_invalid_request_ratio',
                status: 'pass',
                message: 'No API validation errors observed in the current trace window.',
                observed: apiInvalidRequestObserved,
                expected: `invalid/error<=${thresholds.apiInvalidRequestWarnRatioPct}%`,
            });
        } else if (apiTraceWindowErrors < thresholds.apiInvalidRequestMinErrorSample) {
            checks.push({
                checkId: 'api_invalid_request_ratio',
                status: 'warn',
                message: 'Insufficient API error sample size for stable invalid-request ratio assessment.',
                observed: apiInvalidRequestObserved,
                expected: `errors>=${thresholds.apiInvalidRequestMinErrorSample}`,
            });
        } else if (apiTraceWindowInvalidRequestRatioPct > thresholds.apiInvalidRequestFailRatioPct) {
            checks.push({
                checkId: 'api_invalid_request_ratio',
                status: 'fail',
                message: 'Invalid-request error ratio exceeds hard API robustness ceiling.',
                observed: apiInvalidRequestObserved,
                expected: `invalid/error<=${thresholds.apiInvalidRequestFailRatioPct}%`,
            });
        } else if (apiTraceWindowInvalidRequestRatioPct > thresholds.apiInvalidRequestWarnRatioPct) {
            checks.push({
                checkId: 'api_invalid_request_ratio',
                status: 'warn',
                message: 'Invalid-request error ratio exceeds preferred API robustness budget.',
                observed: apiInvalidRequestObserved,
                expected: `invalid/error<=${thresholds.apiInvalidRequestWarnRatioPct}%`,
            });
        } else {
            checks.push({
                checkId: 'api_invalid_request_ratio',
                status: 'pass',
                message: 'Invalid-request error ratio is within API robustness budget.',
                observed: apiInvalidRequestObserved,
                expected: `invalid/error<=${thresholds.apiInvalidRequestWarnRatioPct}%`,
            });
        }

        if (apiTraceWindowInvalidRequests <= 0) {
            checks.push({
                checkId: 'api_invalid_request_hotspots',
                status: 'pass',
                message: 'No invalid-request hotspot endpoint detected in the current trace window.',
                observed: apiInvalidRequestObserved,
                expected: `topPathInvalidCount<=${thresholds.apiInvalidRequestHotspotWarnCount}`,
            });
        } else if (apiTraceWindowInvalidRequestTopPaths.length === 0) {
            checks.push({
                checkId: 'api_invalid_request_hotspots',
                status: 'warn',
                message: 'Invalid-request errors detected but hotspot endpoint aggregation is unavailable.',
                observed: apiInvalidRequestObserved,
                expected: 'invalidTopPaths available',
            });
        } else if (apiInvalidRequestHotspotPeakCount >= thresholds.apiInvalidRequestHotspotFailCount) {
            checks.push({
                checkId: 'api_invalid_request_hotspots',
                status: 'fail',
                message: 'Invalid-request errors are concentrated on a hotspot endpoint.',
                observed: apiInvalidRequestObserved,
                expected: `topPathInvalidCount<${thresholds.apiInvalidRequestHotspotFailCount}`,
            });
        } else if (apiInvalidRequestHotspotPeakCount >= thresholds.apiInvalidRequestHotspotWarnCount) {
            checks.push({
                checkId: 'api_invalid_request_hotspots',
                status: 'warn',
                message: 'Invalid-request hotspot endpoint is above preferred concentration budget.',
                observed: apiInvalidRequestObserved,
                expected: `topPathInvalidCount<${thresholds.apiInvalidRequestHotspotWarnCount}`,
            });
        } else {
            checks.push({
                checkId: 'api_invalid_request_hotspots',
                status: 'pass',
                message: 'Invalid-request hotspot concentration is within budget.',
                observed: apiInvalidRequestObserved,
                expected: `topPathInvalidCount<${thresholds.apiInvalidRequestHotspotWarnCount}`,
            });
        }

        if (apiTraceWindowRequests <= 0) {
            checks.push({
                checkId: 'api_server_error_ratio',
                status: 'warn',
                message: 'API request trace has no traffic sample yet for server-error governance.',
                observed: apiServerErrorObserved,
                expected: 'requests>=1',
            });
        } else if (apiTraceWindowRequests < thresholds.apiServerErrorMinRequestSample) {
            checks.push({
                checkId: 'api_server_error_ratio',
                status: 'warn',
                message: 'Insufficient API traffic sample size for stable server-error ratio assessment.',
                observed: apiServerErrorObserved,
                expected: `requests>=${thresholds.apiServerErrorMinRequestSample}`,
            });
        } else if (apiTraceWindowServerErrorRatioPct > thresholds.apiServerErrorFailRatioPct) {
            checks.push({
                checkId: 'api_server_error_ratio',
                status: 'fail',
                message: 'Server-error ratio exceeds hard API reliability ceiling.',
                observed: apiServerErrorObserved,
                expected: `server/total<=${thresholds.apiServerErrorFailRatioPct}%`,
            });
        } else if (apiTraceWindowServerErrorRatioPct > thresholds.apiServerErrorWarnRatioPct) {
            checks.push({
                checkId: 'api_server_error_ratio',
                status: 'warn',
                message: 'Server-error ratio exceeds preferred API reliability budget.',
                observed: apiServerErrorObserved,
                expected: `server/total<=${thresholds.apiServerErrorWarnRatioPct}%`,
            });
        } else {
            checks.push({
                checkId: 'api_server_error_ratio',
                status: 'pass',
                message: 'Server-error ratio is within API reliability budget.',
                observed: apiServerErrorObserved,
                expected: `server/total<=${thresholds.apiServerErrorWarnRatioPct}%`,
            });
        }

        if (apiTraceWindowServerErrors <= 0) {
            checks.push({
                checkId: 'api_server_error_hotspots',
                status: 'pass',
                message: 'No server-error hotspot endpoint detected in the current trace window.',
                observed: apiServerErrorObserved,
                expected: `topPathServerErrorCount<${thresholds.apiServerErrorHotspotWarnCount}`,
            });
        } else if (apiTraceWindowServerErrorTopPaths.length === 0) {
            checks.push({
                checkId: 'api_server_error_hotspots',
                status: 'warn',
                message: 'Server errors detected but hotspot endpoint aggregation is unavailable.',
                observed: apiServerErrorObserved,
                expected: 'serverTopPaths available',
            });
        } else if (apiServerErrorHotspotPeakCount >= thresholds.apiServerErrorHotspotFailCount) {
            checks.push({
                checkId: 'api_server_error_hotspots',
                status: 'fail',
                message: 'Server errors are concentrated on a hotspot endpoint.',
                observed: apiServerErrorObserved,
                expected: `topPathServerErrorCount<${thresholds.apiServerErrorHotspotFailCount}`,
            });
        } else if (apiServerErrorHotspotPeakCount >= thresholds.apiServerErrorHotspotWarnCount) {
            checks.push({
                checkId: 'api_server_error_hotspots',
                status: 'warn',
                message: 'Server-error hotspot endpoint is above preferred concentration budget.',
                observed: apiServerErrorObserved,
                expected: `topPathServerErrorCount<${thresholds.apiServerErrorHotspotWarnCount}`,
            });
        } else {
            checks.push({
                checkId: 'api_server_error_hotspots',
                status: 'pass',
                message: 'Server-error hotspot concentration is within budget.',
                observed: apiServerErrorObserved,
                expected: `topPathServerErrorCount<${thresholds.apiServerErrorHotspotWarnCount}`,
            });
        }

        if (apiTraceWindowRequests <= 0) {
            checks.push({
                checkId: 'api_transient_error_ratio',
                status: 'warn',
                message: 'API request trace has no traffic sample yet for transient-error governance.',
                observed: apiTransientErrorObserved,
                expected: 'requests>=1',
            });
        } else if (apiTraceWindowRequests < thresholds.apiTransientErrorMinRequestSample) {
            checks.push({
                checkId: 'api_transient_error_ratio',
                status: 'warn',
                message: 'Insufficient API traffic sample size for stable transient-error ratio assessment.',
                observed: apiTransientErrorObserved,
                expected: `requests>=${thresholds.apiTransientErrorMinRequestSample}`,
            });
        } else if (apiTraceWindowTransientErrorRatioPct > thresholds.apiTransientErrorFailRatioPct) {
            checks.push({
                checkId: 'api_transient_error_ratio',
                status: 'fail',
                message: 'Transient-error ratio exceeds hard API stability ceiling.',
                observed: apiTransientErrorObserved,
                expected: `transient/total<=${thresholds.apiTransientErrorFailRatioPct}%`,
            });
        } else if (apiTraceWindowTransientErrorRatioPct > thresholds.apiTransientErrorWarnRatioPct) {
            checks.push({
                checkId: 'api_transient_error_ratio',
                status: 'warn',
                message: 'Transient-error ratio exceeds preferred API stability budget.',
                observed: apiTransientErrorObserved,
                expected: `transient/total<=${thresholds.apiTransientErrorWarnRatioPct}%`,
            });
        } else {
            checks.push({
                checkId: 'api_transient_error_ratio',
                status: 'pass',
                message: 'Transient-error ratio is within API stability budget.',
                observed: apiTransientErrorObserved,
                expected: `transient/total<=${thresholds.apiTransientErrorWarnRatioPct}%`,
            });
        }

        if (apiTraceWindowTransientErrors <= 0) {
            checks.push({
                checkId: 'api_transient_error_hotspots',
                status: 'pass',
                message: 'No transient-error hotspot endpoint detected in the current trace window.',
                observed: apiTransientErrorObserved,
                expected: `topPathTransientErrorCount<${thresholds.apiTransientErrorHotspotWarnCount}`,
            });
        } else if (apiTraceWindowTransientErrorTopPaths.length === 0) {
            checks.push({
                checkId: 'api_transient_error_hotspots',
                status: 'warn',
                message: 'Transient errors detected but hotspot endpoint aggregation is unavailable.',
                observed: apiTransientErrorObserved,
                expected: 'transientTopPaths available',
            });
        } else if (apiTransientErrorHotspotPeakCount >= thresholds.apiTransientErrorHotspotFailCount) {
            checks.push({
                checkId: 'api_transient_error_hotspots',
                status: 'fail',
                message: 'Transient errors are concentrated on a hotspot endpoint.',
                observed: apiTransientErrorObserved,
                expected: `topPathTransientErrorCount<${thresholds.apiTransientErrorHotspotFailCount}`,
            });
        } else if (apiTransientErrorHotspotPeakCount >= thresholds.apiTransientErrorHotspotWarnCount) {
            checks.push({
                checkId: 'api_transient_error_hotspots',
                status: 'warn',
                message: 'Transient-error hotspot endpoint is above preferred concentration budget.',
                observed: apiTransientErrorObserved,
                expected: `topPathTransientErrorCount<${thresholds.apiTransientErrorHotspotWarnCount}`,
            });
        } else {
            checks.push({
                checkId: 'api_transient_error_hotspots',
                status: 'pass',
                message: 'Transient-error hotspot concentration is within budget.',
                observed: apiTransientErrorObserved,
                expected: `topPathTransientErrorCount<${thresholds.apiTransientErrorHotspotWarnCount}`,
            });
        }

        if (apiTraceWindowRequests <= 0) {
            checks.push({
                checkId: 'api_latency_p95',
                status: 'warn',
                message: 'API request trace has no traffic sample yet for latency governance.',
                observed: apiLatencyObserved,
                expected: 'requests>=1',
            });
        } else if (apiTraceWindowRequests < thresholds.apiLatencyMinRequestSample) {
            checks.push({
                checkId: 'api_latency_p95',
                status: 'warn',
                message: 'Insufficient API traffic sample size for stable p95 latency assessment.',
                observed: apiLatencyObserved,
                expected: `requests>=${thresholds.apiLatencyMinRequestSample}`,
            });
        } else if (apiTraceP95DurationMs > thresholds.apiLatencyP95FailMs) {
            checks.push({
                checkId: 'api_latency_p95',
                status: 'fail',
                message: 'API p95 latency exceeds hard responsiveness ceiling.',
                observed: apiLatencyObserved,
                expected: `p95<=${thresholds.apiLatencyP95FailMs}ms`,
            });
        } else if (apiTraceP95DurationMs > thresholds.apiLatencyP95WarnMs) {
            checks.push({
                checkId: 'api_latency_p95',
                status: 'warn',
                message: 'API p95 latency exceeds preferred responsiveness budget.',
                observed: apiLatencyObserved,
                expected: `p95<=${thresholds.apiLatencyP95WarnMs}ms`,
            });
        } else {
            checks.push({
                checkId: 'api_latency_p95',
                status: 'pass',
                message: 'API p95 latency is within responsiveness budget.',
                observed: apiLatencyObserved,
                expected: `p95<=${thresholds.apiLatencyP95WarnMs}ms`,
            });
        }

        if (apiTraceSlowTopPaths.length <= 0) {
            checks.push({
                checkId: 'api_latency_hotspots',
                status: 'pass',
                message: 'No latency hotspot endpoint detected in the current trace window.',
                observed: apiLatencyObserved,
                expected: `topPathP95<${thresholds.apiLatencyHotspotWarnMs}ms`,
            });
        } else if (apiLatencyHotspotPeakP95Ms > thresholds.apiLatencyHotspotFailMs) {
            checks.push({
                checkId: 'api_latency_hotspots',
                status: 'fail',
                message: 'API latency is concentrated on a severe hotspot endpoint.',
                observed: apiLatencyObserved,
                expected: `topPathP95<=${thresholds.apiLatencyHotspotFailMs}ms`,
            });
        } else if (apiLatencyHotspotPeakP95Ms > thresholds.apiLatencyHotspotWarnMs) {
            checks.push({
                checkId: 'api_latency_hotspots',
                status: 'warn',
                message: 'API latency hotspot endpoint is above preferred budget.',
                observed: apiLatencyObserved,
                expected: `topPathP95<=${thresholds.apiLatencyHotspotWarnMs}ms`,
            });
        } else {
            checks.push({
                checkId: 'api_latency_hotspots',
                status: 'pass',
                message: 'API latency hotspot profile is within budget.',
                observed: apiLatencyObserved,
                expected: `topPathP95<=${thresholds.apiLatencyHotspotWarnMs}ms`,
            });
        }
    }

    if (trendStatus === 'regressing') {
        checks.push({
            checkId: 'quality_trend_direction',
            status: 'fail',
            message: 'Learning quality trend is regressing and requires intervention.',
            observed: trendObserved,
            expected: 'status in {stable, improving}',
        });
    } else if (trendStatus === 'insufficient_data') {
        checks.push({
            checkId: 'quality_trend_direction',
            status: 'warn',
            message: 'Learning quality trend has insufficient data for stable governance decisions.',
            observed: trendObserved,
            expected: 'status in {stable, improving}',
        });
    } else if (trendStatus === 'improving' || trendStatus === 'stable') {
        checks.push({
            checkId: 'quality_trend_direction',
            status: 'pass',
            message: trendStatus === 'improving'
                ? 'Learning quality trend is improving.'
                : 'Learning quality trend is stable.',
            observed: trendObserved,
            expected: 'status in {stable, improving}',
        });
    } else {
        checks.push({
            checkId: 'quality_trend_direction',
            status: 'warn',
            message: 'Learning quality trend signal is unavailable.',
            observed: trendObserved || 'status=unknown',
            expected: 'status in {stable, improving, regressing, insufficient_data}',
        });
    }

    if (sessionPlanQualityRecords <= 0) {
        checks.push({
            checkId: 'session_plan_quality_gate',
            status: 'warn',
            message: 'Session plan quality gate history is unavailable.',
            observed: 'records=0',
            expected: 'records>=1',
        });
    } else if (sessionPlanQualityFailureStreak >= thresholds.sessionPlanQualityFailFailureStreak) {
        checks.push({
            checkId: 'session_plan_quality_gate',
            status: 'fail',
            message: 'Session plan quality gate is repeatedly failing.',
            observed: [
                `records=${sessionPlanQualityRecords}`,
                `passRate=${sessionPlanQualityPassRatePct}%`,
                `failureStreak=${sessionPlanQualityFailureStreak}`,
                sessionPlanQualityCommonFailedGates
                    ? `failedGates=${sessionPlanQualityCommonFailedGates}`
                    : '',
            ].filter(Boolean).join(', '),
            expected: `failureStreak<${thresholds.sessionPlanQualityFailFailureStreak}`,
        });
    } else if (sessionPlanQualityFailureStreak >= thresholds.sessionPlanQualityWarnFailureStreak) {
        checks.push({
            checkId: 'session_plan_quality_gate',
            status: 'warn',
            message: 'Session plan quality gate recently failed and requires monitoring.',
            observed: [
                `records=${sessionPlanQualityRecords}`,
                `passRate=${sessionPlanQualityPassRatePct}%`,
                `failureStreak=${sessionPlanQualityFailureStreak}`,
                sessionPlanQualityCommonFailedGates
                    ? `failedGates=${sessionPlanQualityCommonFailedGates}`
                    : '',
            ].filter(Boolean).join(', '),
            expected: `failureStreak<${thresholds.sessionPlanQualityWarnFailureStreak}`,
        });
    } else {
        checks.push({
            checkId: 'session_plan_quality_gate',
            status: 'pass',
            message: 'Session plan quality gate is stable.',
            observed: [
                `records=${sessionPlanQualityRecords}`,
                `passRate=${sessionPlanQualityPassRatePct}%`,
                `failureStreak=${sessionPlanQualityFailureStreak}`,
            ].join(', '),
            expected: `failureStreak<${thresholds.sessionPlanQualityWarnFailureStreak}`,
        });
    }

    if (sessionPlanTrendStatus === 'regressing') {
        checks.push({
            checkId: 'session_plan_quality_trend',
            status: 'fail',
            message: 'Session plan quality trend is regressing.',
            observed: sessionPlanTrendObserved,
            expected: 'status in {stable, improving}',
        });
    } else if (sessionPlanTrendStatus === 'insufficient_data') {
        checks.push({
            checkId: 'session_plan_quality_trend',
            status: 'warn',
            message: 'Session plan quality trend has insufficient data.',
            observed: sessionPlanTrendObserved,
            expected: 'status in {stable, improving}',
        });
    } else if (sessionPlanTrendStatus === 'improving' || sessionPlanTrendStatus === 'stable') {
        checks.push({
            checkId: 'session_plan_quality_trend',
            status: 'pass',
            message: sessionPlanTrendStatus === 'improving'
                ? 'Session plan quality trend is improving.'
                : 'Session plan quality trend is stable.',
            observed: sessionPlanTrendObserved,
            expected: 'status in {stable, improving}',
        });
    } else {
        checks.push({
            checkId: 'session_plan_quality_trend',
            status: 'warn',
            message: 'Session plan quality trend signal is unavailable.',
            observed: sessionPlanTrendObserved || 'status=unknown',
            expected: 'status in {stable, improving, regressing, insufficient_data}',
        });
    }

    if (sessionStrategyTotalRecords <= 0) {
        checks.push({
            checkId: 'orchestration_path_strategy_alignment',
            status: 'pass',
            message: 'No session strategy executions recorded yet; alignment check is waiting for telemetry.',
            observed: sessionStrategyObserved,
            expected: 'strategyRecords>=1 after first strategy-enabled execution',
        });
    } else if (sessionStrategyStrategyRecords <= 0) {
        checks.push({
            checkId: 'orchestration_path_strategy_alignment',
            status: 'warn',
            message: 'Path strategy outcome telemetry is unavailable for orchestration alignment checks.',
            observed: sessionStrategyObserved,
            expected: 'strategyRecords>=1',
        });
    } else if (sessionStrategySelectionSourceTrendCount <= 0) {
        checks.push({
            checkId: 'orchestration_path_strategy_alignment',
            status: 'warn',
            message: 'No trend-driven path strategy selections recorded yet.',
            observed: sessionStrategyObserved,
            expected: 'strategy_trend selections>=1',
        });
    } else if (sessionStrategySelectionSourceTrendCount < 3) {
        checks.push({
            checkId: 'orchestration_path_strategy_alignment',
            status: 'warn',
            message: 'Trend-driven path strategy sample size is too small for stable alignment decisions.',
            observed: sessionStrategyObserved,
            expected: 'strategy_trend selections>=3',
        });
    } else if (
        sessionStrategyTrendAutoAverageMasteryDeltaPct < -2
        || sessionStrategyTrendAutoNegativeRatioPct >= 60
    ) {
        checks.push({
            checkId: 'orchestration_path_strategy_alignment',
            status: 'fail',
            message: 'Trend-driven path strategy selections are regressing mastery outcomes.',
            observed: sessionStrategyObserved,
            expected: 'trendAutoAvgDelta>=0% and trendAutoNegative<40%',
        });
    } else if (
        sessionStrategyTrendAutoAverageMasteryDeltaPct < 0
        || sessionStrategyTrendAutoNegativeRatioPct >= 40
    ) {
        checks.push({
            checkId: 'orchestration_path_strategy_alignment',
            status: 'warn',
            message: 'Trend-driven path strategy selections show weak alignment and require monitoring.',
            observed: sessionStrategyObserved,
            expected: 'trendAutoAvgDelta>=0% and trendAutoNegative<40%',
        });
    } else {
        checks.push({
            checkId: 'orchestration_path_strategy_alignment',
            status: 'pass',
            message: 'Trend-driven path strategy selections are aligned with mastery improvements.',
            observed: sessionStrategyObserved,
            expected: 'trendAutoAvgDelta>=0% and trendAutoNegative<40%',
        });
    }

    if (memoryPolicyStatus === 'risk') {
        checks.push({
            checkId: 'memory_policy_health',
            status: 'fail',
            message: 'Memory policy health is at risk and requires immediate cleanup/retraining.',
            observed: memoryPolicyObserved,
            expected: 'status in {healthy, watch}',
        });
    } else if (memoryPolicyStatus === 'watch') {
        checks.push({
            checkId: 'memory_policy_health',
            status: 'warn',
            message: 'Memory policy health is degraded and should be monitored.',
            observed: memoryPolicyObserved,
            expected: 'status=healthy',
        });
    } else if (memoryPolicyStatus === 'healthy') {
        checks.push({
            checkId: 'memory_policy_health',
            status: 'pass',
            message: 'Memory policy health is stable.',
            observed: memoryPolicyObserved,
            expected: 'status=healthy',
        });
    } else if (memoryPolicyStatus === 'insufficient_data') {
        checks.push({
            checkId: 'memory_policy_health',
            status: 'warn',
            message: 'Memory policy diagnostics have insufficient data.',
            observed: memoryPolicyObserved,
            expected: 'status in {healthy, watch, risk}',
        });
    } else {
        checks.push({
            checkId: 'memory_policy_health',
            status: 'warn',
            message: 'Memory policy diagnostics are unavailable.',
            observed: memoryPolicyObserved || 'status=unknown',
            expected: 'status in {healthy, watch, risk, insufficient_data}',
        });
    }

    if (memoryPolicyTrendStatus === 'regressing') {
        checks.push({
            checkId: 'memory_policy_trend',
            status: 'fail',
            message: 'Memory policy trend is regressing.',
            observed: memoryPolicyTrendObserved,
            expected: 'status in {stable, improving}',
        });
    } else if (memoryPolicyTrendStatus === 'insufficient_data') {
        checks.push({
            checkId: 'memory_policy_trend',
            status: 'warn',
            message: 'Memory policy trend has insufficient data.',
            observed: memoryPolicyTrendObserved,
            expected: 'status in {stable, improving}',
        });
    } else if (memoryPolicyTrendStatus === 'improving' || memoryPolicyTrendStatus === 'stable') {
        checks.push({
            checkId: 'memory_policy_trend',
            status: 'pass',
            message: memoryPolicyTrendStatus === 'improving'
                ? 'Memory policy trend is improving.'
                : 'Memory policy trend is stable.',
            observed: memoryPolicyTrendObserved,
            expected: 'status in {stable, improving}',
        });
    } else {
        checks.push({
            checkId: 'memory_policy_trend',
            status: 'warn',
            message: 'Memory policy trend signal is unavailable.',
            observed: memoryPolicyTrendObserved || 'status=unknown',
            expected: 'status in {stable, improving, regressing, insufficient_data}',
        });
    }

    if (params.knowledgeStalenessDiagnostics) {
        if (knowledgeStalenessEvaluatedDocuments <= 0) {
            checks.push({
                checkId: 'knowledge_staleness_data',
                status: 'warn',
                message: 'Knowledge staleness diagnostics are enabled but no documents were evaluated.',
                observed: knowledgeStalenessObserved,
                expected: 'evaluated>=1',
            });
        } else {
            checks.push({
                checkId: 'knowledge_staleness_data',
                status: 'pass',
                message: 'Knowledge staleness diagnostics are available.',
                observed: knowledgeStalenessObserved,
                expected: 'evaluated>=1',
            });
        }

        const severeStaleThreshold = Math.max(3, Math.ceil(knowledgeStalenessEvaluatedDocuments * 0.4));
        if (knowledgeStalenessReadErrorDocuments > 0) {
            checks.push({
                checkId: 'knowledge_staleness_health',
                status: 'fail',
                message: 'Knowledge staleness health is blocked by source read errors.',
                observed: knowledgeStalenessObserved,
                expected: 'readError=0 and stale=0',
            });
        } else if (knowledgeStalenessStaleDocuments >= severeStaleThreshold) {
            checks.push({
                checkId: 'knowledge_staleness_health',
                status: 'fail',
                message: 'Knowledge staleness ratio exceeds hard governance threshold.',
                observed: knowledgeStalenessObserved,
                expected: `stale<${severeStaleThreshold}`,
            });
        } else if (
            knowledgeStalenessStaleDocuments > 0
            || knowledgeStalenessHashMismatchDocuments > 0
            || knowledgeStalenessMissingSourceDocuments > 0
        ) {
            checks.push({
                checkId: 'knowledge_staleness_health',
                status: 'warn',
                message: 'Knowledge staleness requires incremental rebuild monitoring.',
                observed: knowledgeStalenessObserved,
                expected: 'stale=0',
            });
        } else {
            checks.push({
                checkId: 'knowledge_staleness_health',
                status: 'pass',
                message: 'Knowledge staleness health is stable.',
                observed: knowledgeStalenessObserved,
                expected: 'stale=0',
            });
        }
    }

    const hasSessionMemorySignal = Boolean(params.sessionActionTelemetry);
    if (hasSessionMemorySignal) {
        const sessionMemoryObserved = [
            `executions=${sessionActionExecutionCount}`,
            `persisted=${sessionMemoryPersistedCount}`,
            `promotedActions=${sessionMemoryPromotionAppliedCount}`,
            `promotedEntries=${sessionMemoryPromotionCount}`,
            `promotionCoverage=${sessionMemoryPromotionCoveragePct}%`,
        ].join(', ');
        if (sessionActionExecutionCount <= 0) {
            checks.push({
                checkId: 'session_memory_promotion_coverage',
                status: 'warn',
                message: 'Session action telemetry is available but no executions have been recorded yet.',
                observed: sessionMemoryObserved,
                expected: 'executions>=1',
            });
        } else if (sessionMemoryPersistedCount <= 0) {
            checks.push({
                checkId: 'session_memory_promotion_coverage',
                status: 'warn',
                message: 'Session actions executed without memory persistence; promotion coverage cannot be assessed.',
                observed: sessionMemoryObserved,
                expected: 'persisted>=1',
            });
        } else if (sessionMemoryPromotionAppliedCount <= 0) {
            checks.push({
                checkId: 'session_memory_promotion_coverage',
                status: 'warn',
                message: 'Memory persistence is active but no promotion events were observed.',
                observed: sessionMemoryObserved,
                expected: 'promotedActions>=1',
            });
        } else if (sessionMemoryPromotionCoveragePct < 10) {
            checks.push({
                checkId: 'session_memory_promotion_coverage',
                status: 'warn',
                message: 'Memory promotion coverage is low relative to persisted session actions.',
                observed: sessionMemoryObserved,
                expected: 'promotionCoverage>=10%',
            });
        } else {
            checks.push({
                checkId: 'session_memory_promotion_coverage',
                status: 'pass',
                message: 'Session memory promotion coverage is within target range.',
                observed: sessionMemoryObserved,
                expected: 'promotionCoverage>=10%',
            });
        }
    }

    if (String(params.queryDiagnostics.lastError || '').trim()) {
        checks.push({
            checkId: 'query_backend_last_error',
            status: 'warn',
            message: 'Recent query backend error detected.',
            observed: String(params.queryDiagnostics.lastError || '').slice(0, 160),
        });
    } else {
        checks.push({
            checkId: 'query_backend_last_error',
            status: 'pass',
            message: 'No recent query backend error detected.',
            observed: 'none',
        });
    }

    const hasTutorGovernanceSignal = Boolean(
        params.tutorAdapterTelemetry
        || params.tutorRoutingConfig
        || params.tutorTraceDiagnostics
        || params.tutorProviderTrendDiagnostics
        || params.tutorProviderTrendHistory
    );
    if (hasTutorGovernanceSignal) {
        if (tutorAdaptersTotal <= 0) {
            checks.push({
                checkId: 'tutor_adapter_inventory',
                status: 'warn',
                message: 'No tutor adapters are registered for runtime orchestration.',
                observed: 'totalAdapters=0',
                expected: 'totalAdapters>=1',
            });
        } else if (tutorAdaptersActive <= 0 && tutorRequests > 0) {
            checks.push({
                checkId: 'tutor_adapter_inventory',
                status: 'warn',
                message: 'Tutor adapters exist but no adapter is currently active.',
                observed: `totalAdapters=${tutorAdaptersTotal}, activeAdapters=${tutorAdaptersActive}, requests=${tutorRequests}`,
                expected: 'activeAdapters>=1',
            });
        } else {
            checks.push({
                checkId: 'tutor_adapter_inventory',
                status: 'pass',
                message: 'Tutor adapter inventory is available for routing.',
                observed: `totalAdapters=${tutorAdaptersTotal}, activeAdapters=${tutorAdaptersActive}, requests=${tutorRequests}`,
                expected: 'totalAdapters>=1',
            });
        }

        if (tutorRoutingAdapterTimeoutMs < 300 || tutorRoutingAdapterTimeoutMs > 60000) {
            checks.push({
                checkId: 'tutor_adapter_timeout_budget',
                status: 'fail',
                message: 'Tutor adapter timeout is outside hard governance budget.',
                observed: `adapterTimeoutMs=${tutorRoutingAdapterTimeoutMs}`,
                expected: '300<=adapterTimeoutMs<=60000',
            });
        } else if (tutorRoutingAdapterTimeoutMs < 1000 || tutorRoutingAdapterTimeoutMs > 30000) {
            checks.push({
                checkId: 'tutor_adapter_timeout_budget',
                status: 'warn',
                message: 'Tutor adapter timeout is outside the recommended operating window.',
                observed: `adapterTimeoutMs=${tutorRoutingAdapterTimeoutMs}`,
                expected: '1000<=adapterTimeoutMs<=30000',
            });
        } else {
            checks.push({
                checkId: 'tutor_adapter_timeout_budget',
                status: 'pass',
                message: 'Tutor adapter timeout is within recommended governance window.',
                observed: `adapterTimeoutMs=${tutorRoutingAdapterTimeoutMs}`,
                expected: '1000<=adapterTimeoutMs<=30000',
            });
        }

        const dominantFallbackProviderObserved = [
            `providers=${tutorProviderCount}`,
            `fallbackTraces=${tutorFallbackTraceCount}`,
            `dominantProvider=${tutorDominantProviderName || 'none'}`,
            `dominantShare=${tutorDominantProviderSharePct}%`,
            `dominantFallbackProvider=${tutorDominantFallbackProviderName || 'none'}`,
            `dominantFallbackShare=${tutorDominantFallbackProviderSharePct}%`,
        ].join(', ');
        if (!params.tutorTraceDiagnostics) {
            checks.push({
                checkId: 'tutor_provider_concentration',
                status: 'pass',
                message: 'Tutor provider concentration diagnostics are not enabled for this runtime snapshot.',
                observed: dominantFallbackProviderObserved,
                expected: 'enable tutor trace diagnostics for concentration checks',
            });
        } else if (tutorRequests <= 0) {
            checks.push({
                checkId: 'tutor_provider_concentration',
                status: 'warn',
                message: 'No tutor requests recorded yet; provider concentration cannot be evaluated.',
                observed: dominantFallbackProviderObserved,
                expected: 'requests>=1 with provider breakdown',
            });
        } else if (tutorProviderCount <= 0) {
            checks.push({
                checkId: 'tutor_provider_concentration',
                status: 'warn',
                message: 'Tutor trace diagnostics are missing provider breakdown data.',
                observed: dominantFallbackProviderObserved,
                expected: 'providerBreakdown>=1',
            });
        } else if (
            tutorFallbackTraceCount >= 5
            && tutorDominantFallbackProviderSharePct >= 95
        ) {
            checks.push({
                checkId: 'tutor_provider_concentration',
                status: 'fail',
                message: 'Tutor fallback traffic is concentrated on a single provider and risks a single point of failure.',
                observed: dominantFallbackProviderObserved,
                expected: 'dominantFallbackProviderShare<95% when fallbackTraces>=5',
            });
        } else if (
            tutorFallbackTraceCount >= 3
            && tutorDominantFallbackProviderSharePct >= 80
        ) {
            checks.push({
                checkId: 'tutor_provider_concentration',
                status: 'warn',
                message: 'Tutor fallback traffic is skewed toward one provider.',
                observed: dominantFallbackProviderObserved,
                expected: 'dominantFallbackProviderShare<80% when fallbackTraces>=3',
            });
        } else if (
            tutorProviderCount <= 1
            && tutorRequests >= tutorRoutingMinSamples
        ) {
            checks.push({
                checkId: 'tutor_provider_concentration',
                status: 'warn',
                message: 'Tutor routing currently depends on a single provider footprint.',
                observed: dominantFallbackProviderObserved,
                expected: 'providerBreakdown>=2 when requests are stable',
            });
        } else {
            checks.push({
                checkId: 'tutor_provider_concentration',
                status: 'pass',
                message: 'Tutor provider concentration is within acceptable resilience range.',
                observed: dominantFallbackProviderObserved,
                expected: 'dominantFallbackProviderShare<80% when fallbackTraces>=3',
            });
        }

        const tutorProviderTrendObserved = [
            `providers=${tutorProviderTrendProviders.length}`,
            `regressing=${tutorProviderTrendRegressingCount}`,
            `improving=${tutorProviderTrendImprovingCount}`,
            `insufficient=${tutorProviderTrendInsufficientDataCount}`,
            `historyRecords=${tutorProviderTrendHistoryRecords}`,
            `historyRegressing=${tutorProviderTrendHistoryRegressingRecords}`,
            `historyStable=${tutorProviderTrendHistoryStableRecords}`,
            `historyImproving=${tutorProviderTrendHistoryImprovingRecords}`,
            `historyInsufficient=${tutorProviderTrendHistoryInsufficientDataRecords}`,
            `topRegressing=${tutorProviderTrendTopRegressingProviderName || 'none'}`,
            `topScore=${tutorProviderTrendTopRegressingScore}`,
            `topConfidence=${tutorProviderTrendTopRegressingConfidence}`,
            `focus=${tutorProviderTrendRecommendedFocusProviderName || 'none'}`,
        ].join(', ');
        if (!params.tutorProviderTrendDiagnostics) {
            checks.push({
                checkId: 'tutor_provider_trend_regression',
                status: 'pass',
                message: 'Tutor provider trend diagnostics are not enabled for this runtime snapshot.',
                observed: tutorProviderTrendObserved,
                expected: 'enable tutor provider trend diagnostics for regression checks',
            });
        } else if (tutorProviderTrendProviders.length <= 0) {
            checks.push({
                checkId: 'tutor_provider_trend_regression',
                status: 'warn',
                message: 'Tutor provider trend diagnostics returned no provider trend records.',
                observed: tutorProviderTrendObserved,
                expected: 'providers>=1',
            });
        } else if (
            tutorProviderTrendRegressingCount >= 2
            || (
                tutorProviderTrendRegressingCount >= 1
                && tutorProviderTrendTopRegressingConfidence >= 60
                && tutorProviderTrendTopRegressingScore >= 25
            )
            || (
                tutorProviderTrendHistoryRecords >= 5
                && tutorProviderTrendHistoryRegressingRecords >= 3
            )
        ) {
            checks.push({
                checkId: 'tutor_provider_trend_regression',
                status: 'fail',
                message: 'Tutor provider trend diagnostics indicate sustained provider regression.',
                observed: tutorProviderTrendObserved,
                expected: 'regressingProviders=0 or low-confidence transient drift only',
            });
        } else if (tutorProviderTrendRegressingCount >= 1) {
            checks.push({
                checkId: 'tutor_provider_trend_regression',
                status: 'warn',
                message: 'Tutor provider trend diagnostics detected at least one regressing provider.',
                observed: tutorProviderTrendObserved,
                expected: 'regressingProviders=0',
            });
        } else if (
            tutorProviderTrendHistoryRecords >= 3
            && tutorProviderTrendHistoryRegressingRecords >= 1
        ) {
            checks.push({
                checkId: 'tutor_provider_trend_regression',
                status: 'warn',
                message: 'Tutor provider trend history indicates intermittent provider regression.',
                observed: tutorProviderTrendObserved,
                expected: 'historyRegressingRecords=0 across recent windows',
            });
        } else if (
            tutorProviderTrendInsufficientDataCount >= tutorProviderTrendProviders.length
            && tutorRequests >= tutorRoutingMinSamples
        ) {
            checks.push({
                checkId: 'tutor_provider_trend_regression',
                status: 'warn',
                message: 'Tutor trend diagnostics remain sample-starved despite sufficient request volume.',
                observed: tutorProviderTrendObserved,
                expected: 'providers with sufficient trend windows >=1',
            });
        } else {
            checks.push({
                checkId: 'tutor_provider_trend_regression',
                status: 'pass',
                message: 'Tutor provider trend diagnostics show no active regression.',
                observed: tutorProviderTrendObserved,
                expected: 'regressingProviders=0',
            });
        }

        if (!tutorRoutingEnabled) {
            checks.push({
                checkId: 'tutor_routing_health_budget',
                status: 'warn',
                message: 'Adaptive tutor routing is disabled; telemetry health budgets are not enforced.',
                observed: [
                    `enabled=false`,
                    `failedRatio=${tutorFailedRatioPct}%`,
                    `downgradedRatio=${tutorDowngradedRatioPct}%`,
                    `fallbackRatio=${tutorProviderFallbackRatioPct}%`,
                    `avgProviderAttempts=${tutorAverageProviderAttemptCount}`,
                    `avgConfidence=${tutorAverageConfidence}`,
                ].join(', '),
                expected: 'enabled=true',
            });
        } else if (tutorRequests < tutorRoutingMinSamples) {
            checks.push({
                checkId: 'tutor_routing_health_budget',
                status: 'warn',
                message: 'Tutor routing telemetry sample size is insufficient for stable governance.',
                observed: [
                    `requests=${tutorRequests}`,
                    `minSamples=${tutorRoutingMinSamples}`,
                    `failedRatio=${tutorFailedRatioPct}%`,
                    `downgradedRatio=${tutorDowngradedRatioPct}%`,
                    `fallbackRatio=${tutorProviderFallbackRatioPct}%`,
                    `avgProviderAttempts=${tutorAverageProviderAttemptCount}`,
                    `avgConfidence=${tutorAverageConfidence}`,
                ].join(', '),
                expected: `requests>=${tutorRoutingMinSamples}`,
            });
        } else {
            const fallbackWarnRatioPct = Number(clamp(Math.max(60, tutorRoutingMaxDowngradedRatioPct * 1.5), 0, 100).toFixed(4));
            const fallbackFailRatioPct = Number(clamp(Math.max(85, tutorRoutingMaxDowngradedRatioPct * 2), 0, 100).toFixed(4));
            const attemptWarnCount = 2;
            const attemptFailCount = 4;
            const severeConfidenceFloor = Number(clamp(tutorRoutingMinAverageConfidence - 0.2, 0, 1).toFixed(4));
            if (
                tutorFailedRatioPct > tutorRoutingMaxFailedRatioPct
                || tutorDowngradedRatioPct > tutorRoutingMaxDowngradedRatioPct
                || tutorProviderFallbackRatioPct > fallbackFailRatioPct
                || tutorAverageProviderAttemptCount >= attemptFailCount
                || tutorAverageConfidence < severeConfidenceFloor
            ) {
                checks.push({
                    checkId: 'tutor_routing_health_budget',
                    status: 'fail',
                    message: 'Tutor routing telemetry violates hard health budgets.',
                    observed: [
                        `failedRatio=${tutorFailedRatioPct}%`,
                        `downgradedRatio=${tutorDowngradedRatioPct}%`,
                        `fallbackRatio=${tutorProviderFallbackRatioPct}%`,
                        `avgProviderAttempts=${tutorAverageProviderAttemptCount}`,
                        `avgConfidence=${tutorAverageConfidence}`,
                    ].join(', '),
                    expected: [
                        `failedRatio<=${tutorRoutingMaxFailedRatioPct}%`,
                        `downgradedRatio<=${tutorRoutingMaxDowngradedRatioPct}%`,
                        `fallbackRatio<=${fallbackFailRatioPct}%`,
                        `avgProviderAttempts<${attemptFailCount}`,
                        `avgConfidence>=${severeConfidenceFloor}`,
                    ].join(', '),
                });
            } else if (
                tutorFailedRatioPct > tutorRoutingMaxFailedRatioPct * 0.7
                || tutorDowngradedRatioPct > tutorRoutingMaxDowngradedRatioPct * 0.75
                || tutorProviderFallbackRatioPct > fallbackWarnRatioPct
                || tutorAverageProviderAttemptCount >= attemptWarnCount
                || tutorAverageConfidence < tutorRoutingMinAverageConfidence
            ) {
                checks.push({
                    checkId: 'tutor_routing_health_budget',
                    status: 'warn',
                    message: 'Tutor routing telemetry is close to configured health limits.',
                    observed: [
                        `failedRatio=${tutorFailedRatioPct}%`,
                        `downgradedRatio=${tutorDowngradedRatioPct}%`,
                        `fallbackRatio=${tutorProviderFallbackRatioPct}%`,
                        `avgProviderAttempts=${tutorAverageProviderAttemptCount}`,
                        `avgConfidence=${tutorAverageConfidence}`,
                    ].join(', '),
                    expected: [
                        `failedRatio<=${tutorRoutingMaxFailedRatioPct}%`,
                        `downgradedRatio<=${tutorRoutingMaxDowngradedRatioPct}%`,
                        `fallbackRatio<=${fallbackWarnRatioPct}%`,
                        `avgProviderAttempts<${attemptWarnCount}`,
                        `avgConfidence>=${tutorRoutingMinAverageConfidence}`,
                    ].join(', '),
                });
            } else {
                checks.push({
                    checkId: 'tutor_routing_health_budget',
                    status: 'pass',
                    message: 'Tutor routing telemetry is within configured health budgets.',
                    observed: [
                        `failedRatio=${tutorFailedRatioPct}%`,
                        `downgradedRatio=${tutorDowngradedRatioPct}%`,
                        `fallbackRatio=${tutorProviderFallbackRatioPct}%`,
                        `avgProviderAttempts=${tutorAverageProviderAttemptCount}`,
                        `avgConfidence=${tutorAverageConfidence}`,
                    ].join(', '),
                    expected: [
                        `failedRatio<=${tutorRoutingMaxFailedRatioPct}%`,
                        `downgradedRatio<=${tutorRoutingMaxDowngradedRatioPct}%`,
                        `fallbackRatio<=${fallbackWarnRatioPct}%`,
                        `avgProviderAttempts<${attemptWarnCount}`,
                        `avgConfidence>=${tutorRoutingMinAverageConfidence}`,
                    ].join(', '),
                });
            }
        }

        const routingObserved = [
            `requests=${tutorRequests}`,
            `strategy=${tutorLastRoutingStrategy}`,
            `dynamicMode=${tutorRoutingDynamicPreferredMode}`,
            `dynamicSuggested=${tutorRoutingDynamicModeSuggestionActive}`,
            `fallbackRatio=${tutorProviderFallbackRatioPct}%`,
            `avgProviderAttempts=${tutorAverageProviderAttemptCount}`,
            `score=${tutorLastRoutingScore}`,
            tutorLastRoutingReason ? `reason=${tutorLastRoutingReason}` : '',
            tutorRoutingDynamicModeReason ? `dynamicReason=${tutorRoutingDynamicModeReason}` : '',
        ].filter(Boolean).join(', ');
        if (tutorRequests <= 0) {
            checks.push({
                checkId: 'tutor_routing_traceability',
                status: 'warn',
                message: 'No tutor routing decisions recorded yet.',
                observed: routingObserved,
                expected: 'requests>=1 with strategy trace',
            });
        } else if (tutorLastRoutingStrategy === 'unknown') {
            checks.push({
                checkId: 'tutor_routing_traceability',
                status: 'warn',
                message: 'Tutor routing strategy trace is missing from telemetry.',
                observed: routingObserved,
                expected: 'strategy in {explicit_adapter_id, explicit_provider_mode, adaptive_health_routing, fallback_default}',
            });
        } else if (
            tutorRoutingEnabled
            && tutorRequests >= tutorRoutingMinSamples
            && tutorLastRoutingStrategy === 'fallback_default'
        ) {
            checks.push({
                checkId: 'tutor_routing_traceability',
                status: 'warn',
                message: 'Tutor routing frequently falls back to default adapter under active routing.',
                observed: routingObserved,
                expected: 'strategy!=fallback_default when adaptive routing is healthy',
            });
        } else {
            checks.push({
                checkId: 'tutor_routing_traceability',
                status: 'pass',
                message: 'Tutor routing decisions are traceable.',
                observed: routingObserved,
                expected: 'strategy trace available',
            });
        }

        const fallbackWarnRatioPct = Number(
            clamp(Math.max(60, tutorRoutingMaxDowngradedRatioPct * 1.5), 0, 100).toFixed(4)
        );
        const fallbackFailRatioPct = Number(
            clamp(Math.max(85, tutorRoutingMaxDowngradedRatioPct * 2), 0, 100).toFixed(4)
        );
        const severeConfidenceFloor = Number(clamp(tutorRoutingMinAverageConfidence - 0.2, 0, 1).toFixed(4));
        const dynamicAlignmentExpected = (
            tutorRoutingDynamicModeSuggestionActive
                ? `preferredMode=auto or preferredMode=${tutorRoutingDynamicPreferredMode}`
                : 'dynamicSuggested=false or preferredMode matches suggestion'
        );
        const dynamicAlignmentObserved = [
            `preferredMode=${tutorRoutingPreferredMode}`,
            `dynamicMode=${tutorRoutingDynamicPreferredMode}`,
            `dynamicSuggested=${tutorRoutingDynamicModeSuggestionActive}`,
            `strategy=${tutorLastRoutingStrategy}`,
            `requests=${tutorRequests}/${tutorRoutingMinSamples}`,
            `failedRatio=${tutorFailedRatioPct}%`,
            `downgradedRatio=${tutorDowngradedRatioPct}%`,
            `fallbackRatio=${tutorProviderFallbackRatioPct}%`,
            `avgAttempts=${tutorAverageProviderAttemptCount}`,
            `avgConfidence=${tutorAverageConfidence}`,
            tutorRoutingDynamicModeReason ? `dynamicReason=${tutorRoutingDynamicModeReason}` : '',
        ].filter(Boolean).join(', ');
        const hasDynamicModeConflict = (
            tutorRoutingDynamicModeSuggestionActive
            && tutorRoutingPreferredMode !== 'auto'
            && tutorRoutingPreferredMode !== tutorRoutingDynamicPreferredMode
        );
        if (!tutorRoutingEnabled) {
            checks.push({
                checkId: 'tutor_routing_dynamic_mode_alignment',
                status: 'warn',
                message: 'Adaptive tutor routing is disabled; dynamic mode alignment cannot be enforced.',
                observed: dynamicAlignmentObserved,
                expected: dynamicAlignmentExpected,
            });
        } else if (!hasDynamicModeConflict) {
            checks.push({
                checkId: 'tutor_routing_dynamic_mode_alignment',
                status: 'pass',
                message: 'Tutor routing preferred mode is aligned with dynamic mode guidance.',
                observed: dynamicAlignmentObserved,
                expected: dynamicAlignmentExpected,
            });
        } else if (
            tutorRequests < tutorRoutingMinSamples
            || tutorLastRoutingStrategy !== 'adaptive_health_routing'
        ) {
            checks.push({
                checkId: 'tutor_routing_dynamic_mode_alignment',
                status: 'warn',
                message: 'Dynamic mode guidance conflicts with pinned preferred mode, but routing evidence is still limited.',
                observed: dynamicAlignmentObserved,
                expected: dynamicAlignmentExpected,
            });
        } else if (
            tutorFailedRatioPct > tutorRoutingMaxFailedRatioPct
            || tutorDowngradedRatioPct > tutorRoutingMaxDowngradedRatioPct
            || tutorProviderFallbackRatioPct > fallbackFailRatioPct
            || tutorAverageProviderAttemptCount >= 4
            || tutorAverageConfidence < severeConfidenceFloor
        ) {
            checks.push({
                checkId: 'tutor_routing_dynamic_mode_alignment',
                status: 'fail',
                message: 'Pinned preferred mode conflicts with dynamic routing guidance under severe degradation.',
                observed: dynamicAlignmentObserved,
                expected: dynamicAlignmentExpected,
            });
        } else if (
            tutorFailedRatioPct > tutorRoutingMaxFailedRatioPct * 0.7
            || tutorDowngradedRatioPct > tutorRoutingMaxDowngradedRatioPct * 0.75
            || tutorProviderFallbackRatioPct > fallbackWarnRatioPct
            || tutorAverageProviderAttemptCount >= 2
            || tutorAverageConfidence < tutorRoutingMinAverageConfidence
        ) {
            checks.push({
                checkId: 'tutor_routing_dynamic_mode_alignment',
                status: 'warn',
                message: 'Pinned preferred mode conflicts with dynamic routing guidance and health budgets are tightening.',
                observed: dynamicAlignmentObserved,
                expected: dynamicAlignmentExpected,
            });
        } else {
            checks.push({
                checkId: 'tutor_routing_dynamic_mode_alignment',
                status: 'warn',
                message: 'Pinned preferred mode conflicts with current dynamic routing recommendation.',
                observed: dynamicAlignmentObserved,
                expected: dynamicAlignmentExpected,
            });
        }
    }

    const checkDebugTraceHints: Record<string, RuntimeCapabilityDebugTraceHint | undefined> = {
        query_fallback_ratio: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query',
            statusAtLeast: 400,
        }),
        query_evidence_coverage_ratio: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query',
            statusAtLeast: 400,
        }),
        query_temporal_validity_ratio: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query',
            statusAtLeast: 400,
        }),
        query_backend_explainability_gap: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query/compare-backends',
            statusAtLeast: 400,
        }),
        query_backend_comparison_trend: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query/compare-backends/trend',
            statusAtLeast: 400,
        }),
        query_backend_trend_config: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query/compare-backends/trend',
            statusAtLeast: 400,
        }),
        query_backend_last_error: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query',
            statusAtLeast: 400,
        }),
        query_backend_runtime_health: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        store_graphdb_connector_health: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/store-diagnostics',
            statusAtLeast: 400,
        }),
        store_graphdb_connector_budget: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/store-diagnostics',
            statusAtLeast: 400,
        }),
        query_vector_index_status: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        query_vector_index_persistence: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        query_vector_acceleration_mode: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        query_vector_acceleration_representation_consistency: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        query_vector_acceleration_prefilter_effectiveness: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        query_vector_acceleration_health: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        query_vector_acceleration_traceability: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        query_vector_acceleration_circuit_state: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/query-backend-diagnostics',
            statusAtLeast: 400,
        }),
        api_invalid_request_ratio: apiInvalidRequestRatioDebugTraceHint,
        api_invalid_request_hotspots: apiInvalidRequestHotspotsDebugTraceHint,
        api_server_error_ratio: apiServerErrorRatioDebugTraceHint,
        api_server_error_hotspots: apiServerErrorHotspotsDebugTraceHint,
        api_transient_error_ratio: apiTransientErrorRatioDebugTraceHint,
        api_transient_error_hotspots: apiTransientErrorHotspotsDebugTraceHint,
        api_latency_p95: apiLatencyRatioDebugTraceHint,
        api_latency_hotspots: apiLatencyHotspotsDebugTraceHint,
        quality_trend_direction: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/quality',
            statusAtLeast: 400,
        }),
        session_plan_quality_gate: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/session/plan',
            statusAtLeast: 400,
        }),
        session_plan_quality_trend: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/session/plan',
            statusAtLeast: 400,
        }),
        orchestration_path_strategy_alignment: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/session/history',
            statusAtLeast: 400,
        }),
        memory_policy_health: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/memory',
            statusAtLeast: 400,
        }),
        memory_policy_trend: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/memory',
            statusAtLeast: 400,
        }),
        knowledge_staleness_data: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/staleness',
            statusAtLeast: 400,
        }),
        knowledge_staleness_health: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/staleness',
            statusAtLeast: 400,
        }),
        session_memory_promotion_coverage: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/session',
            statusAtLeast: 400,
        }),
        tutor_adapter_inventory: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/tutor',
            statusAtLeast: 400,
        }),
        tutor_provider_concentration: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/tutor/trace-diagnostics',
            statusAtLeast: 400,
        }),
        tutor_provider_trend_regression: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/tutor/trace-diagnostics/providers',
            statusAtLeast: 400,
        }),
        tutor_routing_health_budget: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/tutor',
            statusAtLeast: 400,
        }),
        tutor_routing_traceability: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/tutor',
            statusAtLeast: 400,
        }),
        tutor_routing_dynamic_mode_alignment: normalizeRuntimeCapabilityDebugTraceHint({
            pathPrefix: '/api/knowledge/tutor/trace-diagnostics/providers/history',
            statusAtLeast: 400,
        }),
    };
    const recommendedActionContext: RuntimeCapabilityRecommendedActionContext = {
        thresholds,
        apiScopePathPrefix: defaultApiTraceHintPathPrefix,
        apiScopeMethod: defaultApiTraceHintMethod,
        apiInvalidRequestTopRoute,
        apiServerErrorTopRoute,
        apiTransientErrorTopRoute,
        apiLatencyTopRoute,
        apiTraceP95DurationMs,
        apiLatencyHotspotPeakP95Ms,
        qualityTrendStatus: trendStatus,
        qualityTrendConfidence: trendConfidence,
        sessionPlanQualityFailureStreak,
        sessionPlanQualityPassRatePct,
        sessionPlanTrendStatus,
        memoryPolicyStatus,
        memoryPolicyHealthScore,
        memoryPolicyTrendStatus,
        knowledgeStalenessEvaluatedDocuments,
        knowledgeStalenessStaleDocuments,
        knowledgeStalenessHashMismatchDocuments,
        knowledgeStalenessMissingSourceDocuments,
        knowledgeStalenessReadErrorDocuments,
        knowledgeStalenessFreshnessRatioPct,
        sessionMemoryPromotionCoveragePct,
        sessionStrategyTotalRecords,
        sessionStrategyStrategyRecords,
        sessionStrategyTrendAutoSelectionSharePct,
        sessionStrategyTrendAutoAverageMasteryDeltaPct,
        sessionStrategyTrendAutoNegativeRatioPct,
        sessionStrategyModeFallbackSelectionSharePct,
        sessionStrategySelectionSourceExplicitCount,
        sessionStrategySelectionSourceTrendCount,
        sessionStrategySelectionSourceFallbackCount,
        sessionStrategySelectionSourceUnknownCount,
        sessionStrategyTopAverageStrategy,
        sessionStrategyTopAverageMasteryDeltaPct,
        sessionStrategyTopAverageNegativeRatioPct,
        tutorAdaptersTotal,
        tutorAdaptersActive,
        tutorRequests,
        tutorProviderFallbackResponses,
        tutorProviderFallbackRatioPct,
        tutorAverageProviderAttemptCount,
        tutorProviderCount,
        tutorDominantProviderName,
        tutorDominantProviderSharePct,
        tutorDominantFallbackProviderName,
        tutorDominantFallbackProviderSharePct,
        tutorProviderTrendRegressingCount,
        tutorProviderTrendImprovingCount,
        tutorProviderTrendInsufficientDataCount,
        tutorProviderTrendTopRegressingProvider: tutorProviderTrendTopRegressingProviderName,
        tutorProviderTrendTopRegressingScore,
        tutorProviderTrendTopRegressingConfidence,
        tutorProviderTrendRecommendedFocusProviderName,
        tutorProviderTrendHistoryRecords,
        tutorProviderTrendHistoryRegressingRecords,
        tutorProviderTrendHistoryStableRecords,
        tutorProviderTrendHistoryImprovingRecords,
        tutorProviderTrendHistoryInsufficientDataRecords,
        tutorFailedRatioPct,
        tutorDowngradedRatioPct,
        tutorAverageConfidence,
        tutorRoutingEnabled,
        tutorRoutingPreferredMode,
        tutorRoutingMinSamples,
        tutorRoutingMaxFailedRatioPct,
        tutorRoutingMaxDowngradedRatioPct,
        tutorRoutingMinAverageConfidence,
        tutorRoutingAdapterTimeoutMs,
        tutorLastRoutingStrategy,
        tutorRoutingDynamicPreferredMode,
        tutorRoutingDynamicModeReason,
        tutorRoutingDynamicModeSuggestionActive,
        queryBackendRuntimeReady,
        queryBackendRuntimeId,
        queryVectorIndexEnabled,
        queryVectorIndexStatus,
        queryVectorIndexPersisted,
        queryVectorIndexLoadedFromDisk,
        queryVectorIndexAtomCount,
        queryVectorIndexLocation,
        queryVectorIndexAccelerationEnabled,
        queryVectorIndexAccelerationMode,
        queryVectorIndexAccelerationLastSelectionMode,
        queryVectorIndexAccelerationLastCandidateCount,
        queryVectorIndexAccelerationAdapterId,
        queryVectorIndexAccelerationAdapterError,
        queryVectorIndexAccelerationHealthStatus,
        queryVectorIndexAccelerationHealthMessage,
        queryVectorIndexAccelerationRepresentationVersion,
        queryVectorIndexAccelerationEmbeddingModelId,
        queryVectorIndexAccelerationEmbeddingDimension,
        queryVectorIndexAccelerationIndexSignature,
        queryVectorIndexAccelerationRepresentationStatus,
        queryVectorIndexAccelerationRepresentationStatusReason,
        queryVectorIndexAccelerationRepresentationStrictMode,
        queryVectorIndexAccelerationCircuitState,
        queryVectorIndexAccelerationConsecutiveFailures,
        queryVectorIndexAccelerationRequestCount,
        queryVectorIndexAccelerationRetryCount,
        queryVectorIndexAccelerationShortCircuitCount,
        queryVectorIndexAccelerationSuccessCount,
        queryVectorIndexAccelerationFailureCount,
        queryVectorIndexAccelerationHalfOpenProbeCount,
        queryVectorIndexAccelerationHalfOpenSuccessRatePct,
    };
    const checksWithDebugTraceHints = checks.map((check) => {
        const hint = checkDebugTraceHints[check.checkId];
        const normalizedDebugHint = hint || check.debugTraceHint;
        const priorityScore = computeRuntimeCapabilityPriorityScore(check);
        const recommendedActions = buildRuntimeCapabilityRecommendedActions(
            {
                ...check,
                debugTraceHint: normalizedDebugHint,
            },
            recommendedActionContext
        );
        return {
            ...check,
            debugTraceHint: normalizedDebugHint,
            priorityScore,
            recommendedActions,
        };
    });

    const sortedChecks = sortRuntimeCapabilityChecksByPriority(checksWithDebugTraceHints);
    const failCount = sortedChecks.filter((check) => check.status === 'fail').length;
    const warnCount = sortedChecks.filter((check) => check.status === 'warn').length;
    const passCount = sortedChecks.filter((check) => check.status === 'pass').length;
    const topRiskCheck = sortedChecks.find((check) => check.status === 'fail' || check.status === 'warn') || null;
    const topRiskCheckId = String(topRiskCheck?.checkId || '').trim().toLowerCase();
    const topRiskStatus: RuntimeCapabilityMatrix['signals']['topRiskStatus'] = topRiskCheck
        ? topRiskCheck.status
        : 'none';
    const topRiskPriorityScore = Math.max(0, Math.floor(Number(topRiskCheck?.priorityScore || 0)));
    const topRiskRecommendedActions = Array.isArray(topRiskCheck?.recommendedActions)
        ? topRiskCheck?.recommendedActions
            .map((item) => String(item || '').replace(/\s+/g, ' ').trim().slice(0, 220))
            .filter(Boolean)
            .slice(0, 5)
        : [];
    const overallStatus: RuntimeCapabilityMatrix['overallStatus'] = failCount > 0
        ? 'blocked'
        : (warnCount > 0 ? 'degraded' : 'ready');

    return {
        generatedAt: params.generatedAt,
        overallStatus,
        thresholds,
        checks: sortedChecks,
        summary: {
            passCount,
            warnCount,
            failCount,
        },
        signals: {
            configuredStoreBackend: params.configuredStoreBackend,
            configuredQueryBackend: params.configuredQueryBackend,
            storeType: params.store.storeType,
            storeUsingFallback: params.store.usingFallback === true,
            graphDbConnectorHealthStatus,
            graphDbConnectorHealthMessage,
            graphDbConnectorCircuitState,
            graphDbConnectorRequestCount,
            graphDbConnectorRetryCount,
            graphDbConnectorShortCircuitCount,
            graphDbConnectorSuccessCount,
            graphDbConnectorFailureCount,
            graphDbConnectorFailureRatioPct,
            graphDbConnectorConsecutiveFailures,
            graphDbConnectorShortCircuitRatioPct,
            graphDbConnectorWarnBudgetExceeded,
            graphDbConnectorFailBudgetExceeded,
            graphDbConnectorBudgetStatus,
            graphDbConnectorLastRequestId,
            graphDbConnectorLastErrorCode,
            graphDbConnectorLastStatusCode,
            graphDbConnectorLastRetryAfterMs,
            queryBackendId: params.queryDiagnostics.backendId,
            queryBackendRuntimeReady,
            queryBackendRuntimeId,
            queryVectorIndexEnabled,
            queryVectorIndexStatus,
            queryVectorIndexPersisted,
            queryVectorIndexLoadedFromDisk,
            queryVectorIndexAtomCount,
            queryVectorIndexLocation,
            queryVectorIndexAccelerationEnabled,
            queryVectorIndexAccelerationMode,
            queryVectorIndexAccelerationLastSelectionMode,
            queryVectorIndexAccelerationLastCandidateCount,
            queryVectorIndexAccelerationAdapterId,
            queryVectorIndexAccelerationAdapterError,
            queryVectorIndexAccelerationHealthStatus,
            queryVectorIndexAccelerationHealthMessage,
            queryVectorIndexAccelerationRepresentationVersion,
            queryVectorIndexAccelerationEmbeddingModelId,
            queryVectorIndexAccelerationEmbeddingDimension,
            queryVectorIndexAccelerationIndexSignature,
            queryVectorIndexAccelerationRepresentationStatus,
            queryVectorIndexAccelerationRepresentationStatusReason,
            queryVectorIndexAccelerationRepresentationStrictMode,
            queryVectorIndexAccelerationLastRequestId,
            queryVectorIndexAccelerationLastErrorCode,
            queryVectorIndexAccelerationLastRetryAfterMs,
            queryVectorIndexAccelerationCircuitState,
            queryVectorIndexAccelerationConsecutiveFailures,
            queryVectorIndexAccelerationRequestCount,
            queryVectorIndexAccelerationRetryCount,
            queryVectorIndexAccelerationShortCircuitCount,
            queryVectorIndexAccelerationShortCircuitRatioPct,
            queryVectorIndexAccelerationSuccessCount,
            queryVectorIndexAccelerationFailureCount,
            queryVectorIndexAccelerationHalfOpenProbeCount,
            queryVectorIndexAccelerationHalfOpenSuccessRatePct,
            queryVectorIndexAccelerationCircuitWarnBudgetExceeded,
            queryVectorIndexAccelerationCircuitFailBudgetExceeded,
            queryVectorIndexAccelerationCircuitBudgetStatus,
            queryFallbackCount: safeFallbackCount,
            queryCount: safeQueryCount,
            queryFallbackRatioPct,
            queryExplainabilitySampleCount,
            queryEvidenceCoverageRatioPct,
            queryRelationPathCoverageRatioPct,
            queryTemporalValidityPassRatioPct,
            queryAverageEvidenceSpanCount,
            queryAverageRelationPathLength,
            queryBackendComparisonSampleCount,
            queryBackendComparisonEvidenceGapRatioPct,
            queryBackendComparisonRelationGapRatioPct,
            queryBackendComparisonTemporalGapRatioPct,
            queryBackendComparisonMaxExplainabilityGapRatioPct,
            queryBackendComparisonTrendStatus,
            queryBackendComparisonTrendScore,
            queryBackendComparisonTrendConfidence,
            queryBackendComparisonTrendLimit,
            queryBackendComparisonTrendWindowSize,
            queryBackendComparisonTrendMinSamples,
            queryBackendComparisonTrendRequiredRecords,
            apiTraceWindowRequests,
            apiTraceWindowErrors,
            apiTraceWindowInvalidRequests,
            apiTraceWindowInvalidRequestRatioPct,
            apiTraceWindowInvalidRequestToTotalRatioPct,
            apiTraceWindowServerErrors,
            apiTraceWindowServerErrorRatioPct,
            apiTraceWindowTransientErrors,
            apiTraceWindowTransientErrorRatioPct,
            apiTraceAverageDurationMs,
            apiTraceP95DurationMs,
            apiTraceScopePathPrefix,
            apiTraceScopeMethod,
            apiTraceWindowInvalidRequestTopPaths,
            apiTraceWindowServerErrorTopPaths,
            apiTraceWindowTransientErrorTopPaths,
            apiTraceSlowTopPaths,
            qualityTrendStatus: trendStatus,
            qualityTrendScore: trendScore,
            qualityTrendConfidence: trendConfidence,
            sessionPlanQualityRecords,
            sessionPlanQualityPassRatePct,
            sessionPlanQualityFailureStreak,
            sessionPlanQualityTrendStatus: sessionPlanTrendStatus,
            sessionPlanQualityTrendScore: sessionPlanTrendScore,
            sessionPlanQualityTrendConfidence: sessionPlanTrendConfidence,
            memoryPolicyStatus,
            memoryPolicyHealthScore,
            memoryPolicyTotalEntries,
            memoryPolicyExpiredEntries,
            memoryPolicyStaleEntries,
            memoryPolicyLowConfidenceEntries,
            memoryPolicyTrendStatus,
            memoryPolicyTrendScore,
            memoryPolicyTrendConfidence,
            knowledgeStalenessStaleDocuments,
            knowledgeStalenessFreshnessRatioPct,
            knowledgeStalenessHashMismatchDocuments,
            knowledgeStalenessMissingSourceDocuments,
            knowledgeStalenessReadErrorDocuments,
            sessionActionExecutionCount,
            sessionMemoryPersistedCount,
            sessionMemoryPromotionAppliedCount,
            sessionMemoryPromotionCount,
            sessionMemoryPromotionCoveragePct,
            sessionStrategyTotalRecords,
            sessionStrategyStrategyRecords,
            sessionStrategyTrendAutoSelectionSharePct,
            sessionStrategyTrendAutoAverageMasteryDeltaPct,
            sessionStrategyTrendAutoNegativeRatioPct,
            sessionStrategyModeFallbackSelectionSharePct,
            sessionStrategySelectionSourceExplicitCount,
            sessionStrategySelectionSourceTrendCount,
            sessionStrategySelectionSourceFallbackCount,
            sessionStrategySelectionSourceUnknownCount,
            sessionStrategyTopAverageStrategy,
            sessionStrategyTopAverageMasteryDeltaPct,
            sessionStrategyTopAverageNegativeRatioPct,
            tutorAdaptersTotal,
            tutorAdaptersActive,
            tutorRequests,
            tutorAcceptedResponses,
            tutorDowngradedResponses,
            tutorFailedResponses,
            tutorProviderFallbackResponses,
            tutorProviderFallbackRatioPct,
            tutorAverageProviderAttemptCount,
            tutorProviderCount,
            tutorDominantProviderName,
            tutorDominantProviderSharePct,
            tutorDominantFallbackProviderName,
            tutorDominantFallbackProviderSharePct,
            tutorProviderTrendRegressingCount,
            tutorProviderTrendImprovingCount,
            tutorProviderTrendInsufficientDataCount,
            tutorProviderTrendTopRegressingProvider: tutorProviderTrendTopRegressingProviderName,
            tutorProviderTrendTopRegressingScore,
            tutorProviderTrendTopRegressingConfidence,
            tutorProviderTrendRecommendedFocusProviderName,
            tutorProviderTrendHistoryRecords,
            tutorProviderTrendHistoryRegressingRecords,
            tutorProviderTrendHistoryStableRecords,
            tutorProviderTrendHistoryImprovingRecords,
            tutorProviderTrendHistoryInsufficientDataRecords,
            tutorFailedRatioPct,
            tutorDowngradedRatioPct,
            tutorAverageConfidence,
            tutorRoutingEnabled,
            tutorRoutingPreferredMode,
            tutorRoutingAdapterTimeoutMs,
            tutorLastRoutingStrategy,
            tutorLastRoutingReason,
            tutorLastRoutingScore,
            tutorRoutingDynamicPreferredMode,
            tutorRoutingDynamicModeReason,
            tutorRoutingDynamicModeSuggestionActive,
            topRiskCheckId: topRiskCheckId || '',
            topRiskStatus,
            topRiskPriorityScore,
            topRiskRecommendedActions,
        },
    };
}

function normalizeRuntimeCapabilityCheckIdToken(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, '')
        .slice(0, 128);
}

function toRuntimeCapabilityRunbookCheck(
    check: RuntimeCapabilityCheck | null | undefined
): RuntimeCapabilityRunbookCheck | null {
    if (!check) {
        return null;
    }
    return {
        checkId: normalizeRuntimeCapabilityCheckIdToken(check.checkId),
        status: check.status,
        message: String(check.message || '').trim().slice(0, 280),
        observed: String(check.observed || '').trim().slice(0, 420),
        expected: String(check.expected || '').trim().slice(0, 220) || undefined,
        debugTraceHint: normalizeRuntimeCapabilityDebugTraceHint(check.debugTraceHint),
        priorityScore: Math.max(0, Math.floor(Number(check.priorityScore || 0))),
        recommendedActions: normalizeRuntimeCapabilityRecommendedActions(
            Array.isArray(check.recommendedActions) ? check.recommendedActions : []
        ) || [],
    };
}

function resolveRuntimeCapabilityRunbookVerificationTargets(
    selectedCheck: RuntimeCapabilityRunbookCheck | null
): string[] {
    if (!selectedCheck) {
        return [
            'Re-fetch /api/knowledge/runtime-capability-matrix and confirm overallStatus remains ready.',
        ];
    }
    const targets: string[] = [];
    if (selectedCheck.checkId === 'tutor_provider_trend_regression') {
        targets.push(
            'Query /api/knowledge/tutor/trace-diagnostics/providers?source=llm-adapter and verify regressingProviders decreases.'
        );
        targets.push(
            'Query /api/knowledge/tutor/trace-diagnostics/providers/history?source=llm-adapter and compare the latest two windows for focus provider drift.'
        );
        targets.push(
            'Re-run tutor actions for the focus provider mode and confirm routing reason shows reduced trend penalty.'
        );
    }
    if (selectedCheck.checkId === 'tutor_routing_dynamic_mode_alignment') {
        targets.push(
            'Query /api/knowledge/session/orchestration/config and align preferredMode with dynamic recommendation (auto/local/cloud).'
        );
        targets.push(
            'Query /api/knowledge/tutor/trace-diagnostics/providers/history?source=llm-adapter and verify mode conflict trend is reduced in the latest window.'
        );
        targets.push(
            'Run tutor actions without explicit mode hints and confirm lastRouting dynamicPreferredMode conflict clears.'
        );
    }
    if (selectedCheck.checkId === 'orchestration_path_strategy_alignment') {
        targets.push(
            'Query /api/knowledge/session/history?userId=<userId>&pathStrategySelectionSource=strategy_trend&sinceMinutes=10080 and verify trend-driven strategy selections recover to non-negative mastery delta.'
        );
        targets.push(
            'Query /api/knowledge/quality/trend and confirm strategyBreakdown trend agrees with session history outcome telemetry.'
        );
        targets.push(
            'If trend-driven outcomes remain negative, tighten strategy auto-path confidence settings in /api/knowledge/session/orchestration/config.'
        );
    }
    if (selectedCheck.checkId === 'query_backend_runtime_health') {
        targets.push(
            'Query /api/knowledge/query-backend-diagnostics and verify diagnostics.runtime.ready is true with matching backend ids.'
        );
        targets.push(
            'If runtime readiness fails, switch query backend to local_hybrid via /api/knowledge/query-backend-config and confirm retrieval continuity.'
        );
    }
    if (selectedCheck.checkId === 'store_graphdb_connector_health') {
        targets.push(
            'Query /api/knowledge/store-diagnostics and verify store.connector.healthStatus/healthMessage/circuitState are stable.'
        );
        targets.push(
            'Run /api/knowledge/store/reload and confirm connector telemetry keeps circuitState=closed with controlled retry/shortCircuit counters.'
        );
        targets.push(
            'If connector remains degraded/unavailable, validate endpoint reachability and timeout/retry budgets before restoring strict rollout.'
        );
    }
    if (selectedCheck.checkId === 'store_graphdb_connector_budget') {
        targets.push(
            'Query /api/knowledge/store-diagnostics and validate connector request/failure/shortCircuit/consecutiveFailures counters against configured runtime thresholds.'
        );
        targets.push(
            'Run /api/knowledge/store/reload and replay representative graphdb-backed traffic, then verify failureRatio/shortCircuitRatio return below warn budgets.'
        );
        targets.push(
            'If budgets stay above thresholds, tune NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_* and NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_* circuit/retry env settings before widening strict rollout.'
        );
    }
    if (
        selectedCheck.checkId === 'query_vector_index_status'
        || selectedCheck.checkId === 'query_vector_index_persistence'
        || selectedCheck.checkId === 'query_vector_acceleration_mode'
        || selectedCheck.checkId === 'query_vector_acceleration_representation_consistency'
        || selectedCheck.checkId === 'query_vector_acceleration_prefilter_effectiveness'
        || selectedCheck.checkId === 'query_vector_acceleration_health'
        || selectedCheck.checkId === 'query_vector_acceleration_traceability'
        || selectedCheck.checkId === 'query_vector_acceleration_circuit_state'
    ) {
        targets.push(
            'Query /api/knowledge/query-backend-diagnostics and confirm diagnostics.runtime.vectorIndex.status=ready with persisted=true when local_vector is active.'
        );
        targets.push(
            'Issue /api/knowledge/query requests using local_vector and verify vectorIndex atomCount/signature are populated and stable.'
        );
        targets.push(
            'Verify diagnostics.runtime.vectorIndex.acceleration indicates ann_prefilter mode (or document intentional full_scan fallback).'
        );
        if (selectedCheck.checkId === 'query_vector_acceleration_prefilter_effectiveness') {
            targets.push(
                'Verify diagnostics.runtime.vectorIndex.acceleration.lastSelectionMode is token_prefilter|token_signature_prefilter with non-zero lastCandidateCount under representative ANN traffic.'
            );
        }
        if (selectedCheck.checkId === 'query_vector_acceleration_representation_consistency') {
            targets.push(
                'Verify diagnostics.runtime.vectorIndex.acceleration representationStatus is aligned and representationVersion/embeddingModelId/embeddingDimension/indexSignature are populated for the active adapter.'
            );
            targets.push(
                'If representationStrictMode=true, verify mismatch incidents are blocked and surfaced with vector_acceleration_representation_mismatch diagnostics evidence.'
            );
        }
        if (
            selectedCheck.checkId === 'query_vector_acceleration_health'
            || selectedCheck.checkId === 'query_vector_acceleration_traceability'
            || selectedCheck.checkId === 'query_vector_acceleration_circuit_state'
            || selectedCheck.checkId === 'query_vector_acceleration_mode'
            || selectedCheck.checkId === 'query_vector_index_status'
            || selectedCheck.checkId === 'query_vector_index_persistence'
        ) {
            targets.push(
                'Verify diagnostics.runtime.vectorIndex.acceleration.healthStatus is ready|unknown (or capture degraded/unavailable reason with connector remediation evidence).'
            );
        }
        if (
            selectedCheck.checkId === 'query_vector_acceleration_traceability'
            || selectedCheck.checkId === 'query_vector_acceleration_circuit_state'
        ) {
            targets.push(
                'Verify diagnostics.runtime.vectorIndex.acceleration.circuitState is closed|unknown and shortCircuitCount remains controlled; for external connectors also confirm lastRequestId/lastErrorCode/lastRetryAfterMs are populated after representative query traffic.'
            );
        }
    }
    if (selectedCheck.expected) {
        targets.push(`Satisfy check expectation: ${selectedCheck.expected}`);
    }
    if (selectedCheck.debugTraceHint) {
        const pathPrefix = String(selectedCheck.debugTraceHint.pathPrefix || '').trim() || '/api/knowledge';
        const statusAtLeast = Math.max(0, Math.floor(Number(selectedCheck.debugTraceHint.statusAtLeast || 0)));
        const method = normalizeRuntimeCapabilityHttpMethod(selectedCheck.debugTraceHint.method || '');
        const errorCode = String(selectedCheck.debugTraceHint.errorCode || '').trim();
        targets.push(
            `Collect API evidence via /api/runtime-request-trace filter(pathPrefix=${pathPrefix},statusAtLeast=${statusAtLeast},method=${method || '<all>'},errorCode=${errorCode || '<none>'}).`
        );
    }
    if (selectedCheck.recommendedActions.length > 0) {
        targets.push(`Execute recommended actions and re-evaluate check ${selectedCheck.checkId}.`);
    }
    targets.push(`Re-fetch /api/knowledge/runtime-capability-matrix and verify ${selectedCheck.checkId} status moves to pass.`);
    return normalizeRuntimeCapabilityRecommendedActions(targets) || [];
}

export function buildRuntimeCapabilityRunbook(
    matrix: RuntimeCapabilityMatrix,
    requestedCheckIdRaw?: unknown
): RuntimeCapabilityRunbook {
    const requestedCheckId = normalizeRuntimeCapabilityCheckIdToken(requestedCheckIdRaw);
    const checks = Array.isArray(matrix?.checks)
        ? matrix.checks
        : [];
    const checksById = new Map<string, RuntimeCapabilityCheck>(
        checks.map((check) => [normalizeRuntimeCapabilityCheckIdToken(check?.checkId), check])
    );

    const topRiskSignalCheckId = normalizeRuntimeCapabilityCheckIdToken(matrix?.signals?.topRiskCheckId || '');
    const topRiskFromSignal = topRiskSignalCheckId
        ? checksById.get(topRiskSignalCheckId)
        : null;
    const topRiskFromChecks = checks.find((check) => check.status === 'fail' || check.status === 'warn') || null;
    const topRiskCheck = topRiskFromSignal || topRiskFromChecks || null;

    const requestedCheck = requestedCheckId
        ? (checksById.get(requestedCheckId) || null)
        : null;
    const selectedCheck = requestedCheck || topRiskCheck || null;
    const selectionSource: RuntimeCapabilityRunbook['selectionSource'] = requestedCheck
        ? 'requested'
        : (
            requestedCheckId
                ? (selectedCheck ? 'top_risk_fallback' : 'none')
                : (selectedCheck ? 'top_risk' : 'none')
        );

    const selectedRunbookCheck = toRuntimeCapabilityRunbookCheck(selectedCheck);
    const topRiskRunbookCheck = toRuntimeCapabilityRunbookCheck(topRiskCheck);
    const traceFilter = normalizeRuntimeCapabilityDebugTraceHint(selectedRunbookCheck?.debugTraceHint) || {
        pathPrefix: '/api/knowledge',
        statusAtLeast: selectedRunbookCheck ? 400 : 0,
        method: '',
        errorCode: '',
    };
    const verificationTargets = resolveRuntimeCapabilityRunbookVerificationTargets(selectedRunbookCheck);

    return {
        generatedAt: String(matrix?.generatedAt || new Date().toISOString()),
        overallStatus: matrix?.overallStatus || 'degraded',
        summary: {
            passCount: Math.max(0, Math.floor(Number(matrix?.summary?.passCount || 0))),
            warnCount: Math.max(0, Math.floor(Number(matrix?.summary?.warnCount || 0))),
            failCount: Math.max(0, Math.floor(Number(matrix?.summary?.failCount || 0))),
        },
        requestedCheckId,
        selectionSource,
        selectedCheck: selectedRunbookCheck,
        topRiskCheck: topRiskRunbookCheck,
        traceFilter,
        verificationTargets,
    };
}

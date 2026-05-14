import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { JSDOM } from 'jsdom';

type HarnessResult = {
    controller: any;
    document: Document;
    window: any;
        fetchMock?: jest.Mock;
    pathApp?: {
        init: jest.Mock;
        applyRemoteConfigure: jest.Mock;
        triggerUpdate: jest.Mock;
    };
    graphView?: {
        resolveNodeById: jest.Mock;
        openFocusModeById: jest.Mock;
        getFocusNode: jest.Mock;
    };
};

function createI18nStub() {
    const listeners: Array<(lang: string) => void> = [];
    const dictionaries: Record<string, Record<string, string>> = {
        en: {
            'agentWorkspace.actions.focus': 'Focus',
            'agentWorkspace.actions.learningPath': 'Learning Path',
            'agentWorkspace.actions.quiz': 'Quiz',
            'agentWorkspace.actions.recap': 'Recap',
            'agentWorkspace.actions.transfer': 'Transfer Challenge',
            'agentWorkspace.actions.counterexample': 'Counterexample',
            'agentWorkspace.actions.followUp': 'Follow Up',
            'agentWorkspace.actions.analyzeAnswer': 'Answer Analysis',
            'agentWorkspace.actions.compareQueryBackends': 'Compare Backends',
            'agentWorkspace.actions.queryBackendDiagnostics': 'Backend Diagnostics',
            'agentWorkspace.actions.queryBackendComparisonHistory': 'Comparison History',
            'agentWorkspace.actions.queryBackendComparisonTrend': 'Comparison Trend',
            'agentWorkspace.actions.tutorAdapterTelemetry': 'Tutor Telemetry',
            'agentWorkspace.actions.tutorTraceDiagnostics': 'Tutor Trace',
            'agentWorkspace.actions.learningQualityTrend': 'Learning Trend',
            'agentWorkspace.actions.learningQualityHistory': 'Learning History',
            'agentWorkspace.actions.sessionPlanQualityTrend': 'Session Plan Trend',
            'agentWorkspace.actions.sessionPlanQualityHistory': 'Session Plan History',
            'agentWorkspace.actions.runtimeRunbookVerify': 'Runtime Verify',
            'agentWorkspace.actions.runtimeRunbookHistory': 'Runtime History',
            'agentWorkspace.actions.runtimeRunbookChecks': 'Runtime Checks',
            'agentWorkspace.actions.runtimeRunbookActionQueue': 'Runtime Queue',
            'agentWorkspace.actions.sessionHistory': 'Session History',
            'agentWorkspace.actions.studySession': 'Study Session',
            'agentWorkspace.actions.conversationMemory': 'Conversation Memory',
            'agentWorkspace.actions.conversationTurnCacheDiagnostics': 'Turn Cache',
            'agentWorkspace.actions.conversationTurnCacheAlertTrend': 'Turn Cache Trend',
            'agentWorkspace.actions.fullscreen': 'Fullscreen',
            'agentWorkspace.actions.restore': 'Restore',
            'agentWorkspace.messages.ready': 'Agent workspace ready. Ask for a concept, then open focus or learning path panes from local knowledge points.',
            'agentWorkspace.messages.localNodeUnavailable': 'Local node {nodeId} is not currently available in the graph.',
            'agentWorkspace.tutorAction.cardTitle': 'Tutor Action',
            'agentWorkspace.tutorAction.quizTitle': 'Quiz Prompt',
            'agentWorkspace.tutorAction.recapTitle': 'Recap',
            'agentWorkspace.tutorAction.followUpTitle': 'Follow Up',
            'agentWorkspace.tutorAction.analysisTitle': 'Answer Analysis',
            'agentWorkspace.tutorAction.transferTitle': 'Transfer Challenge',
            'agentWorkspace.tutorAction.counterexampleTitle': 'Counterexample',
            'agentWorkspace.tutorAction.evidenceHeading': 'Evidence',
            'agentWorkspace.tutorAction.emptyEvidence': 'No evidence spans returned.',
            'agentWorkspace.studySession.cardTitle': 'Study Session Plan',
            'agentWorkspace.studySession.summary': '{totalActions} actions, about {totalEstimatedMinutes} minutes.',
            'agentWorkspace.studySession.actionsHeading': 'Recommended Actions',
            'agentWorkspace.studySession.empty': 'No study actions returned.',
            'agentWorkspace.sessionHistory.cardTitle': 'Session History',
            'agentWorkspace.sessionHistory.summary': '{matchedRecordsBeforeLimit} sessions in last {sinceMinutes} minutes; avg mastery delta {averageMasteryDeltaPct}%.',
            'agentWorkspace.sessionHistory.metricsHeading': 'Key Metrics',
            'agentWorkspace.sessionHistory.totalExecutedLabel': 'Total executed actions',
            'agentWorkspace.sessionHistory.updatedMasteryLabel': 'Updated mastery count',
            'agentWorkspace.sessionHistory.averageTutorConfidenceLabel': 'Average tutor confidence',
            'agentWorkspace.sessionHistory.latestExecutedAtLabel': 'Latest executed at',
            'agentWorkspace.sessionHistory.none': 'none',
            'agentWorkspace.conversationTurnCacheDiagnostics.cardTitle': 'Conversation Turn-Cache Diagnostics',
            'agentWorkspace.conversationTurnCacheDiagnostics.summary': 'Entries {totalEntries}/{maxEntries}, cache hit ratio {cacheHitRatioPct}%.',
            'agentWorkspace.conversationTurnCacheDiagnostics.metricsHeading': 'Key Metrics',
            'agentWorkspace.conversationTurnCacheDiagnostics.configLabel': 'TTL / max entries / max events',
            'agentWorkspace.conversationTurnCacheDiagnostics.alertSummaryLabel': 'Alert summary (status/fail/warn/active)',
            'agentWorkspace.conversationTurnCacheDiagnostics.alertTopCheckLabel': 'Top alert check',
            'agentWorkspace.conversationTurnCacheDiagnostics.thresholdProfileLabel': 'Threshold profile (warn/fail)',
            'agentWorkspace.conversationTurnCacheDiagnostics.stateLabel': 'Running/completed/failed/in-flight',
            'agentWorkspace.conversationTurnCacheDiagnostics.utilizationLabel': 'Utilization / stale-eligible',
            'agentWorkspace.conversationTurnCacheDiagnostics.ageLabel': 'Oldest/newest age',
            'agentWorkspace.conversationTurnCacheDiagnostics.cacheLabel': 'Cache hits/misses/hit ratio',
            'agentWorkspace.conversationTurnCacheDiagnostics.replayLabel': 'Replay responses/events',
            'agentWorkspace.conversationTurnCacheDiagnostics.executionLabel': 'Execution start/success/failure',
            'agentWorkspace.conversationTurnCacheDiagnostics.lifecycleLabel': 'Conflicts / in-flight joins / sync reuse',
            'agentWorkspace.conversationTurnCacheDiagnostics.evictionLabel': 'TTL/capacity evictions',
            'agentWorkspace.conversationTurnCacheDiagnostics.timestampsLabel': 'Last prune / last conflict / generated at',
            'agentWorkspace.conversationTurnCacheDiagnostics.statusPass': 'pass',
            'agentWorkspace.conversationTurnCacheDiagnostics.statusWarn': 'warn',
            'agentWorkspace.conversationTurnCacheDiagnostics.statusFail': 'fail',
            'agentWorkspace.conversationTurnCacheDiagnostics.checkUtilizationPct': 'Utilization',
            'agentWorkspace.conversationTurnCacheDiagnostics.checkExecutionFailureRatioPct': 'Execution failure ratio',
            'agentWorkspace.conversationTurnCacheDiagnostics.checkConflictCount': 'Conflict count',
            'agentWorkspace.conversationTurnCacheDiagnostics.checkStaleEligibleEntries': 'Stale-eligible entries',
            'agentWorkspace.conversationTurnCacheDiagnostics.none': 'none',
            'agentWorkspace.conversationTurnCacheAlertTrend.cardTitle': 'Conversation Turn-Cache Alert Trend',
            'agentWorkspace.conversationTurnCacheAlertTrend.summary': 'Trend {trendStatus}, escalation {recommendedEscalation}, records {returnedRecords}/{totalRecords}.',
            'agentWorkspace.conversationTurnCacheAlertTrend.metricsHeading': 'Key Metrics',
            'agentWorkspace.conversationTurnCacheAlertTrend.recordsLabel': 'Returned/total records',
            'agentWorkspace.conversationTurnCacheAlertTrend.statusCountsLabel': 'Status counts (pass/warn/fail)',
            'agentWorkspace.conversationTurnCacheAlertTrend.activeStreakLabel': 'Active warn/fail streak',
            'agentWorkspace.conversationTurnCacheAlertTrend.latestStatusLabel': 'Latest summary status (active/warn/fail)',
            'agentWorkspace.conversationTurnCacheAlertTrend.latestTopCheckLabel': 'Latest top check',
            'agentWorkspace.conversationTurnCacheAlertTrend.latestMetricsLabel': 'Latest metrics (util/fail-ratio/conflict/stale/entries)',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendConfigLabel': 'Trend config (limit/window/min-samples/interval)',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationLabel': 'Escalation recommendation',
            'agentWorkspace.conversationTurnCacheAlertTrend.latestSampledAtLabel': 'Latest sampled at',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusInsufficientData': 'insufficient_data',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusStable': 'stable',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusImproving': 'improving',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusRegressing': 'regressing',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationNormal': 'normal',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationWatch': 'watch',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationHigh': 'high',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationCritical': 'critical',
            'agentWorkspace.conversationTurnCacheAlertTrend.none': 'none',
            'agentWorkspace.queryBackendComparison.cardTitle': 'Backend Comparison',
            'agentWorkspace.queryBackendComparison.summary': 'Query \"{query}\" (topK={topK}): {leftBackend} vs {rightBackend}, preferred {preferredBackendLabel}.',
            'agentWorkspace.queryBackendComparison.metricsHeading': 'Key Metrics',
            'agentWorkspace.queryBackendComparison.overlapRatioLabel': 'Overlap ratio',
            'agentWorkspace.queryBackendComparison.latencyDeltaLabel': 'Latency delta (left-right)',
            'agentWorkspace.queryBackendComparison.evidenceCoverageLabel': 'Evidence coverage (left/right)',
            'agentWorkspace.queryBackendComparison.relationCoverageLabel': 'Relation-path coverage (left/right)',
            'agentWorkspace.queryBackendComparison.temporalPassLabel': 'Temporal pass (left/right)',
            'agentWorkspace.queryBackendComparison.reasonLabel': 'Reason',
            'agentWorkspace.queryBackendComparison.none': 'none',
            'agentWorkspace.queryBackendDiagnostics.cardTitle': 'Query Backend Diagnostics',
            'agentWorkspace.queryBackendDiagnostics.summary': 'Backend {backendId} configured as {configuredBackend}; fallback count {fallbackCount}.',
            'agentWorkspace.queryBackendDiagnostics.metricsHeading': 'Key Metrics',
            'agentWorkspace.queryBackendDiagnostics.comparisonsLabel': 'Comparisons',
            'agentWorkspace.queryBackendDiagnostics.preferredCountsLabel': 'Preferred counts (left/right/tie)',
            'agentWorkspace.queryBackendDiagnostics.latencyDeltaLabel': 'Average latency delta',
            'agentWorkspace.queryBackendDiagnostics.runtimeReadyLabel': 'Runtime ready',
            'agentWorkspace.queryBackendDiagnostics.graphvizRuntimeLabel': 'Graphviz runtime',
            'agentWorkspace.queryBackendDiagnostics.graphvizDotBinaryLabel': 'Graphviz dot binary',
            'agentWorkspace.queryBackendDiagnostics.graphvizReasonLabel': 'Graphviz runtime reason',
            'agentWorkspace.queryBackendDiagnostics.graphvizCheckedAtLabel': 'Graphviz checked at/cache ttl',
            'agentWorkspace.queryBackendDiagnostics.graphvizFreshnessLabel': 'Graphviz probe freshness',
            'agentWorkspace.queryBackendDiagnostics.vectorIndexLabel': 'Vector index status/atoms',
            'agentWorkspace.queryBackendDiagnostics.accelerationLabel': 'Acceleration mode/selection',
            'agentWorkspace.queryBackendDiagnostics.healthLabel': 'Acceleration health/circuit',
            'agentWorkspace.queryBackendDiagnostics.rolloutModeLabel': 'Rollout profile mode',
            'agentWorkspace.queryBackendDiagnostics.accelerationProviderLabel': 'Configured acceleration provider',
            'agentWorkspace.queryBackendDiagnostics.accelerationFailureModeLabel': 'Configured acceleration failure mode',
            'agentWorkspace.queryBackendDiagnostics.accelerationRepresentationStrictLabel': 'Configured acceleration representation strict mode',
            'agentWorkspace.queryBackendDiagnostics.annPrefilterLabel': 'ANN prefilter rollout',
            'agentWorkspace.queryBackendDiagnostics.annPrefilterEnabled': 'enabled',
            'agentWorkspace.queryBackendDiagnostics.annPrefilterDisabled': 'disabled',
            'agentWorkspace.queryBackendDiagnostics.annPrefilterUnknown': 'unknown',
            'agentWorkspace.queryBackendDiagnostics.boolEnabled': 'enabled',
            'agentWorkspace.queryBackendDiagnostics.boolDisabled': 'disabled',
            'agentWorkspace.queryBackendDiagnostics.fallbackBackendLabel': 'Fallback backend',
            'agentWorkspace.queryBackendDiagnostics.lastErrorLabel': 'Last error',
            'agentWorkspace.queryBackendDiagnostics.runtimeLastErrorLabel': 'Runtime last error',
            'agentWorkspace.queryBackendDiagnostics.statusAvailable': 'available',
            'agentWorkspace.queryBackendDiagnostics.statusUnavailable': 'unavailable',
            'agentWorkspace.queryBackendDiagnostics.statusUnknown': 'unknown',
            'agentWorkspace.queryBackendDiagnostics.freshnessFresh': 'fresh',
            'agentWorkspace.queryBackendDiagnostics.freshnessWarn': 'warn',
            'agentWorkspace.queryBackendDiagnostics.freshnessStale': 'stale',
            'agentWorkspace.queryBackendDiagnostics.freshnessUnknown': 'unknown',
            'agentWorkspace.queryBackendDiagnostics.none': 'none',
            'agentWorkspace.queryBackendComparisonHistory.cardTitle': 'Backend Comparison History',
            'agentWorkspace.queryBackendComparisonHistory.summary': '{returnedRecords}/{totalRecords} records, avg overlap {averageOverlapRatioPct}%, avg latency delta {averageLatencyDeltaMs}ms.',
            'agentWorkspace.queryBackendComparisonHistory.metricsHeading': 'Key Metrics',
            'agentWorkspace.queryBackendComparisonHistory.preferredCountsLabel': 'Preferred counts (left/right/tie)',
            'agentWorkspace.queryBackendComparisonHistory.evidenceCoverageLabel': 'Average evidence coverage (left/right)',
            'agentWorkspace.queryBackendComparisonHistory.latestComparedAtLabel': 'Latest compared at',
            'agentWorkspace.queryBackendComparisonHistory.none': 'none',
            'agentWorkspace.queryBackendComparisonTrend.cardTitle': 'Backend Comparison Trend',
            'agentWorkspace.queryBackendComparisonTrend.summary': 'Status {status} (confidence {confidencePct}%, score {score}).',
            'agentWorkspace.queryBackendComparisonTrend.metricsHeading': 'Key Metrics',
            'agentWorkspace.queryBackendComparisonTrend.recordsLabel': 'Evaluated records',
            'agentWorkspace.queryBackendComparisonTrend.overlapDeltaLabel': 'Overlap delta',
            'agentWorkspace.queryBackendComparisonTrend.explainabilityDeltaLabel': 'Explainability gap delta',
            'agentWorkspace.queryBackendComparisonTrend.reasonLabel': 'Reason',
            'agentWorkspace.queryBackendComparisonTrend.latestComparedAtLabel': 'Latest compared at',
            'agentWorkspace.queryBackendComparisonTrend.none': 'none',
            'agentWorkspace.tutorAdapterTelemetry.cardTitle': 'Tutor Adapter Telemetry',
            'agentWorkspace.tutorAdapterTelemetry.summary': '{activeAdapters}/{totalAdapters} adapters active, {totalRequests} requests.',
            'agentWorkspace.tutorAdapterTelemetry.metricsHeading': 'Key Metrics',
            'agentWorkspace.tutorAdapterTelemetry.acceptedFailedLabel': 'Accepted/failed responses',
            'agentWorkspace.tutorAdapterTelemetry.fallbackRatioLabel': 'Provider fallback ratio',
            'agentWorkspace.tutorAdapterTelemetry.averageAttemptsLabel': 'Average provider attempts',
            'agentWorkspace.tutorAdapterTelemetry.averageConfidenceLabel': 'Average confidence',
            'agentWorkspace.tutorAdapterTelemetry.routingLabel': 'Routing strategy / preferred mode',
            'agentWorkspace.tutorAdapterTelemetry.firstAdapterLabel': 'Top adapter',
            'agentWorkspace.tutorAdapterTelemetry.firstAdapterFallbackLabel': 'Top adapter fallback ratio',
            'agentWorkspace.tutorAdapterTelemetry.firstAdapterLastErrorLabel': 'Top adapter last error',
            'agentWorkspace.tutorAdapterTelemetry.none': 'none',
            'agentWorkspace.tutorTraceDiagnostics.cardTitle': 'Tutor Trace Diagnostics',
            'agentWorkspace.tutorTraceDiagnostics.summary': '{returnedTraces}/{matchedTraces} traces (source {source}, action {actionKind}).',
            'agentWorkspace.tutorTraceDiagnostics.metricsHeading': 'Key Metrics',
            'agentWorkspace.tutorTraceDiagnostics.sourceCountsLabel': 'Source counts (llm/rule)',
            'agentWorkspace.tutorTraceDiagnostics.verificationLabel': 'Verification (verified/pending)',
            'agentWorkspace.tutorTraceDiagnostics.fallbackRatioLabel': 'Fallback ratio',
            'agentWorkspace.tutorTraceDiagnostics.averageAttemptsLabel': 'Average provider attempts',
            'agentWorkspace.tutorTraceDiagnostics.topProviderLabel': 'Top provider',
            'agentWorkspace.tutorTraceDiagnostics.topProviderConfidenceLabel': 'Top provider average confidence',
            'agentWorkspace.tutorTraceDiagnostics.firstRecordLabel': 'First trace snapshot',
            'agentWorkspace.tutorTraceDiagnostics.timestampsLabel': 'Latest trace / top provider seen',
            'agentWorkspace.tutorTraceDiagnostics.none': 'none',
            'agentWorkspace.learningQualityTrend.cardTitle': 'Learning Quality Trend',
            'agentWorkspace.learningQualityTrend.summary': 'Status {status} (confidence {confidencePct}%, score {score}).',
            'agentWorkspace.learningQualityTrend.metricsHeading': 'Key Metrics',
            'agentWorkspace.learningQualityTrend.recordsLabel': 'Evaluated records',
            'agentWorkspace.learningQualityTrend.retestDeltaLabel': 'Retest pass delta',
            'agentWorkspace.learningQualityTrend.evidenceDeltaLabel': 'Evidence-backed delta',
            'agentWorkspace.learningQualityTrend.misconceptionDeltaLabel': 'Misconception recurrence delta',
            'agentWorkspace.learningQualityTrend.fallbackDeltaLabel': 'Query fallback delta',
            'agentWorkspace.learningQualityTrend.reasonLabel': 'Reason',
            'agentWorkspace.learningQualityTrend.latestSampledAtLabel': 'Latest sampled at',
            'agentWorkspace.learningQualityTrend.none': 'none',
            'agentWorkspace.sessionPlanQualityTrend.cardTitle': 'Session Plan Quality Trend',
            'agentWorkspace.sessionPlanQualityTrend.summary': 'Status {status} (confidence {confidencePct}%, score {score}).',
            'agentWorkspace.sessionPlanQualityTrend.metricsHeading': 'Key Metrics',
            'agentWorkspace.sessionPlanQualityTrend.recordsLabel': 'Evaluated records',
            'agentWorkspace.sessionPlanQualityTrend.passRateDeltaLabel': 'Pass-rate delta',
            'agentWorkspace.sessionPlanQualityTrend.evidenceDeltaLabel': 'Evidence coverage delta',
            'agentWorkspace.sessionPlanQualityTrend.budgetDeltaLabel': 'Budget deviation delta',
            'agentWorkspace.sessionPlanQualityTrend.recoveryDeltaLabel': 'Recovery-share delta',
            'agentWorkspace.sessionPlanQualityTrend.divergenceDeltaLabel': 'Divergence-share delta',
            'agentWorkspace.sessionPlanQualityTrend.reasonLabel': 'Reason',
            'agentWorkspace.sessionPlanQualityTrend.latestEvaluatedAtLabel': 'Latest evaluated at',
            'agentWorkspace.sessionPlanQualityTrend.none': 'none',
            'agentWorkspace.learningQualityHistory.cardTitle': 'Learning Quality History',
            'agentWorkspace.learningQualityHistory.summary': '{returnedRecords}/{totalRecords} records available.',
            'agentWorkspace.learningQualityHistory.metricsHeading': 'Key Metrics',
            'agentWorkspace.learningQualityHistory.latestRetestPassRateLabel': 'Latest retest pass rate',
            'agentWorkspace.learningQualityHistory.latestEvidenceRatioLabel': 'Latest evidence-backed ratio',
            'agentWorkspace.learningQualityHistory.latestMisconceptionRecurrenceLabel': 'Latest misconception recurrence',
            'agentWorkspace.learningQualityHistory.latestQueryFallbackLabel': 'Latest query fallback ratio',
            'agentWorkspace.learningQualityHistory.latestSampledAtLabel': 'Latest sampled at',
            'agentWorkspace.learningQualityHistory.none': 'none',
            'agentWorkspace.sessionPlanQualityHistory.cardTitle': 'Session Plan Quality History',
            'agentWorkspace.sessionPlanQualityHistory.summary': '{returnedRecords}/{totalRecords} records, pass rate {returnedPassRatePct}% (overall {overallPassRatePct}%).',
            'agentWorkspace.sessionPlanQualityHistory.metricsHeading': 'Key Metrics',
            'agentWorkspace.sessionPlanQualityHistory.consecutiveFailureCountLabel': 'Consecutive failure count',
            'agentWorkspace.sessionPlanQualityHistory.averageBudgetDeviationLabel': 'Average budget deviation',
            'agentWorkspace.sessionPlanQualityHistory.topFailedGateLabel': 'Top failed gate',
            'agentWorkspace.sessionPlanQualityHistory.latestEvaluatedAtLabel': 'Latest evaluated at',
            'agentWorkspace.sessionPlanQualityHistory.none': 'none',
            'agentWorkspace.runtimeRunbookVerify.cardTitle': 'Runtime Runbook Verify',
            'agentWorkspace.runtimeRunbookVerify.summary': 'Check {selectedCheckId}: status {selectedCheckStatus}, escalation {selectedCheckEscalation}.',
            'agentWorkspace.runtimeRunbookVerify.metricsHeading': 'Key Metrics',
            'agentWorkspace.runtimeRunbookVerify.topRiskLabel': 'Top risk check',
            'agentWorkspace.runtimeRunbookVerify.traceErrorLabel': 'Trace errors',
            'agentWorkspace.runtimeRunbookVerify.traceP95Label': 'Trace p95 duration',
            'agentWorkspace.runtimeRunbookVerify.historyStreakLabel': 'Risk/fail streak',
            'agentWorkspace.runtimeRunbookVerify.historyTrendLabel': 'History trend',
            'agentWorkspace.runtimeRunbookVerify.remediationRiskRatioLabel': 'Remediation risk ratio',
            'agentWorkspace.runtimeRunbookVerify.autoFocusLabel': 'Auto focus',
            'agentWorkspace.runtimeRunbookVerify.firstEscalationActionLabel': 'Top escalation action',
            'agentWorkspace.runtimeRunbookVerify.annIndexSyncLabel': 'ANN sync health',
            'agentWorkspace.runtimeRunbookVerify.annIndexSyncCountsLabel': 'ANN sync counts',
            'agentWorkspace.runtimeRunbookVerify.annCircuitLabel': 'ANN circuit budget',
            'agentWorkspace.runtimeRunbookVerify.annCircuitThresholdsLabel': 'ANN circuit thresholds',
            'agentWorkspace.runtimeRunbookVerify.annTraceabilityLabel': 'ANN traceability',
            'agentWorkspace.runtimeRunbookVerify.annTraceabilitySignalsLabel': 'ANN traceability signals',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterLabel': 'ANN prefilter',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterThresholdsLabel': 'ANN prefilter thresholds',
            'agentWorkspace.runtimeRunbookVerify.autoFocusApplied': 'applied ({reason})',
            'agentWorkspace.runtimeRunbookVerify.autoFocusNotApplied': 'not applied',
            'agentWorkspace.runtimeRunbookVerify.none': 'none',
            'agentWorkspace.runtimeRunbookHistory.cardTitle': 'Runtime Runbook History',
            'agentWorkspace.runtimeRunbookHistory.summary': '{returnedRecords}/{matchedRecords} records for {checkId} in {sinceMinutes} minutes; trend {trendStatus}.',
            'agentWorkspace.runtimeRunbookHistory.metricsHeading': 'Key Metrics',
            'agentWorkspace.runtimeRunbookHistory.statusCountsLabel': 'Status counts (pass/warn/fail/unknown)',
            'agentWorkspace.runtimeRunbookHistory.activeStreakLabel': 'Active risk/fail streak',
            'agentWorkspace.runtimeRunbookHistory.averageErrorRatioLabel': 'Average error ratio',
            'agentWorkspace.runtimeRunbookHistory.averageP95Label': 'Average p95 duration',
            'agentWorkspace.runtimeRunbookHistory.deltaLabel': 'Severity/error/p95 delta',
            'agentWorkspace.runtimeRunbookHistory.latestVerifiedAtLabel': 'Latest verified at',
            'agentWorkspace.runtimeRunbookHistory.allChecks': 'all checks',
            'agentWorkspace.runtimeRunbookHistory.none': 'none',
            'agentWorkspace.runtimeRunbookChecks.cardTitle': 'Runtime Runbook Checks',
            'agentWorkspace.runtimeRunbookChecks.summary': '{returnedChecks}/{matchedRecords} checks in {sinceMinutes} minutes; recommended focus {recommendedFocusCheckId}.',
            'agentWorkspace.runtimeRunbookChecks.metricsHeading': 'Key Metrics',
            'agentWorkspace.runtimeRunbookChecks.firstCheckAnnIndexSyncLabel': 'First check ANN sync',
            'agentWorkspace.runtimeRunbookChecks.annCircuitLabel': 'ANN circuit snapshot',
            'agentWorkspace.runtimeRunbookChecks.annCircuitThresholdsLabel': 'ANN circuit threshold snapshot',
            'agentWorkspace.runtimeRunbookChecks.annTraceabilityLabel': 'ANN traceability snapshot',
            'agentWorkspace.runtimeRunbookChecks.annTraceabilitySignalsLabel': 'ANN traceability signal snapshot',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterLabel': 'ANN prefilter snapshot',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterThresholdsLabel': 'ANN prefilter threshold snapshot',
            'agentWorkspace.runtimeRunbookChecks.trendCountsLabel': 'Trend counts (regressing/improving/stable/insufficient)',
            'agentWorkspace.runtimeRunbookChecks.recommendedFocusLabel': 'Recommended focus reason',
            'agentWorkspace.runtimeRunbookChecks.recommendedEscalationLabel': 'Recommended escalation',
            'agentWorkspace.runtimeRunbookChecks.actionQueueLabel': 'Action queue (total/p0/p1/p2)',
            'agentWorkspace.runtimeRunbookChecks.remediationRiskRatioLabel': 'Remediation risk ratio',
            'agentWorkspace.runtimeRunbookChecks.firstCheckLabel': 'First check snapshot',
            'agentWorkspace.runtimeRunbookChecks.topActionLabel': 'Top focus action',
            'agentWorkspace.runtimeRunbookChecks.latestRemediationLabel': 'Latest remediation record',
            'agentWorkspace.runtimeRunbookChecks.none': 'none',
            'agentWorkspace.runtimeRunbookActionQueue.cardTitle': 'Runtime Action Queue',
            'agentWorkspace.runtimeRunbookActionQueue.summary': '{returnedQueueItems}/{filteredQueueItems} queue items (limit {queueLimit}); p0={queueP0}.',
            'agentWorkspace.runtimeRunbookActionQueue.metricsHeading': 'Key Metrics',
            'agentWorkspace.runtimeRunbookActionQueue.priorityCountsLabel': 'Priority counts (p0/p1/p2)',
            'agentWorkspace.runtimeRunbookActionQueue.filtersLabel': 'Filters (priority/category/remediation)',
            'agentWorkspace.runtimeRunbookActionQueue.remediationRiskLabel': 'Remediation risk queue',
            'agentWorkspace.runtimeRunbookActionQueue.recommendedFocusLabel': 'Recommended focus',
            'agentWorkspace.runtimeRunbookActionQueue.firstQueueItemLabel': 'First queue item',
            'agentWorkspace.runtimeRunbookActionQueue.firstRemediationLabel': 'First item remediation',
            'agentWorkspace.runtimeRunbookActionQueue.firstInstructionLabel': 'First instruction',
            'agentWorkspace.runtimeRunbookActionQueue.none': 'none',
            'agentWorkspace.messages.sessionHistoryFailed': 'Session history fetch failed: {error}',
            'agentWorkspace.messages.queryBackendComparisonFailed': 'Query backend comparison failed: {error}',
            'agentWorkspace.messages.queryBackendDiagnosticsFailed': 'Query backend diagnostics fetch failed: {error}',
            'agentWorkspace.messages.queryBackendComparisonHistoryFailed': 'Query backend comparison history fetch failed: {error}',
            'agentWorkspace.messages.queryBackendComparisonTrendFailed': 'Query backend comparison trend fetch failed: {error}',
            'agentWorkspace.messages.tutorAdapterTelemetryFailed': 'Tutor adapter telemetry fetch failed: {error}',
            'agentWorkspace.messages.tutorTraceDiagnosticsFailed': 'Tutor trace diagnostics fetch failed: {error}',
            'agentWorkspace.messages.learningQualityTrendFailed': 'Learning quality trend fetch failed: {error}',
            'agentWorkspace.messages.learningQualityHistoryFailed': 'Learning quality history fetch failed: {error}',
            'agentWorkspace.messages.sessionPlanQualityTrendFailed': 'Session plan quality trend fetch failed: {error}',
            'agentWorkspace.messages.sessionPlanQualityHistoryFailed': 'Session plan quality history fetch failed: {error}',
            'agentWorkspace.messages.runtimeRunbookVerifyFailed': 'Runtime capability runbook verify failed: {error}',
            'agentWorkspace.messages.runtimeRunbookHistoryFailed': 'Runtime capability runbook history fetch failed: {error}',
            'agentWorkspace.messages.runtimeRunbookChecksFailed': 'Runtime capability runbook checks fetch failed: {error}',
            'agentWorkspace.messages.runtimeRunbookActionQueueFailed': 'Runtime capability runbook action queue fetch failed: {error}',
            'agentWorkspace.messages.conversationMemorySearchFailed': 'Conversation memory search failed: {error}',
            'agentWorkspace.messages.conversationTurnCacheDiagnosticsFailed': 'Conversation turn-cache diagnostics fetch failed: {error}',
            'agentWorkspace.messages.conversationTurnCacheAlertTrendFailed': 'Conversation turn-cache alert trend fetch failed: {error}',
            'agentWorkspace.messages.executionKindUnsupported': 'Unsupported capability execution kind: {executionKind}',
            'agentWorkspace.messages.operationResultPresentationUnsupported': 'Unsupported result presentation {resultPresentation} for operation {operationId}; allowed: {allowedResultPresentations}',
            'agentWorkspace.messages.capabilityActionUnsupported': 'Unsupported capability action: {actionId}',
        },
        zh: {
            'agentWorkspace.actions.focus': '聚焦',
            'agentWorkspace.actions.learningPath': '学习路径',
            'agentWorkspace.actions.quiz': '测验',
            'agentWorkspace.actions.recap': '回顾',
            'agentWorkspace.actions.transfer': '迁移挑战',
            'agentWorkspace.actions.counterexample': '反例挑战',
            'agentWorkspace.actions.followUp': '追问',
            'agentWorkspace.actions.analyzeAnswer': '答案分析',
            'agentWorkspace.actions.compareQueryBackends': '后端对比',
            'agentWorkspace.actions.queryBackendDiagnostics': '后端诊断',
            'agentWorkspace.actions.queryBackendComparisonHistory': '对比历史',
            'agentWorkspace.actions.queryBackendComparisonTrend': '对比趋势',
            'agentWorkspace.actions.tutorAdapterTelemetry': '导师适配器遥测',
            'agentWorkspace.actions.tutorTraceDiagnostics': '导师追踪诊断',
            'agentWorkspace.actions.learningQualityTrend': '学习质量趋势',
            'agentWorkspace.actions.learningQualityHistory': '学习质量历史',
            'agentWorkspace.actions.sessionPlanQualityTrend': '会话计划趋势',
            'agentWorkspace.actions.sessionPlanQualityHistory': '会话计划历史',
            'agentWorkspace.actions.runtimeRunbookVerify': '运行时验证',
            'agentWorkspace.actions.runtimeRunbookHistory': '运行时历史',
            'agentWorkspace.actions.runtimeRunbookChecks': '运行时检查',
            'agentWorkspace.actions.runtimeRunbookActionQueue': '运行时队列',
            'agentWorkspace.actions.sessionHistory': '会话历史',
            'agentWorkspace.actions.studySession': '学习会话',
            'agentWorkspace.actions.conversationMemory': '对话记忆',
            'agentWorkspace.actions.conversationTurnCacheDiagnostics': '轮次缓存',
            'agentWorkspace.actions.conversationTurnCacheAlertTrend': '轮次缓存趋势',
            'agentWorkspace.actions.fullscreen': '全屏',
            'agentWorkspace.actions.restore': '还原',
            'agentWorkspace.messages.ready': 'Agent 工作区已就绪。先提一个概念问题，然后从本地知识点里打开聚焦或学习路径 pane。',
            'agentWorkspace.messages.localNodeUnavailable': '本地图中当前找不到节点 {nodeId}。',
            'agentWorkspace.tutorAction.cardTitle': '导师动作',
            'agentWorkspace.tutorAction.quizTitle': '测验提示',
            'agentWorkspace.tutorAction.recapTitle': '回顾',
            'agentWorkspace.tutorAction.followUpTitle': '追问',
            'agentWorkspace.tutorAction.analysisTitle': '答案分析',
            'agentWorkspace.tutorAction.transferTitle': '迁移挑战',
            'agentWorkspace.tutorAction.counterexampleTitle': '反例挑战',
            'agentWorkspace.tutorAction.evidenceHeading': '证据',
            'agentWorkspace.tutorAction.emptyEvidence': '当前没有返回证据片段。',
            'agentWorkspace.studySession.cardTitle': '学习会话计划',
            'agentWorkspace.studySession.summary': '{totalActions} 个动作，约 {totalEstimatedMinutes} 分钟。',
            'agentWorkspace.studySession.actionsHeading': '推荐动作',
            'agentWorkspace.studySession.empty': '当前没有返回学习动作。',
            'agentWorkspace.sessionHistory.cardTitle': '会话历史',
            'agentWorkspace.sessionHistory.summary': '最近 {sinceMinutes} 分钟内匹配 {matchedRecordsBeforeLimit} 条会话；平均掌握度变化 {averageMasteryDeltaPct}%。',
            'agentWorkspace.sessionHistory.metricsHeading': '关键指标',
            'agentWorkspace.sessionHistory.totalExecutedLabel': '累计执行动作',
            'agentWorkspace.sessionHistory.updatedMasteryLabel': '掌握度更新次数',
            'agentWorkspace.sessionHistory.averageTutorConfidenceLabel': '导师平均置信度',
            'agentWorkspace.sessionHistory.latestExecutedAtLabel': '最近执行时间',
            'agentWorkspace.sessionHistory.none': '无',
            'agentWorkspace.conversationTurnCacheDiagnostics.cardTitle': '对话轮次缓存诊断',
            'agentWorkspace.conversationTurnCacheDiagnostics.summary': '缓存条目 {totalEntries}/{maxEntries}，命中率 {cacheHitRatioPct}%。',
            'agentWorkspace.conversationTurnCacheDiagnostics.metricsHeading': '关键指标',
            'agentWorkspace.conversationTurnCacheDiagnostics.configLabel': 'TTL / 最大条目 / 单轮最大事件',
            'agentWorkspace.conversationTurnCacheDiagnostics.alertSummaryLabel': '告警摘要（状态/失败/警告/激活）',
            'agentWorkspace.conversationTurnCacheDiagnostics.alertTopCheckLabel': '最高级别告警检查',
            'agentWorkspace.conversationTurnCacheDiagnostics.thresholdProfileLabel': '阈值配置（警告/失败）',
            'agentWorkspace.conversationTurnCacheDiagnostics.stateLabel': '运行中/完成/失败/进行中',
            'agentWorkspace.conversationTurnCacheDiagnostics.utilizationLabel': '利用率 / 可清理陈旧条目',
            'agentWorkspace.conversationTurnCacheDiagnostics.ageLabel': '最老/最新条目年龄',
            'agentWorkspace.conversationTurnCacheDiagnostics.cacheLabel': '缓存命中/未命中/命中率',
            'agentWorkspace.conversationTurnCacheDiagnostics.replayLabel': '重放响应/重放事件',
            'agentWorkspace.conversationTurnCacheDiagnostics.executionLabel': '执行开始/成功/失败',
            'agentWorkspace.conversationTurnCacheDiagnostics.lifecycleLabel': '冲突 / 并发复用 / 同步复用',
            'agentWorkspace.conversationTurnCacheDiagnostics.evictionLabel': 'TTL/容量驱逐',
            'agentWorkspace.conversationTurnCacheDiagnostics.timestampsLabel': '最近清理 / 最近冲突 / 生成时间',
            'agentWorkspace.conversationTurnCacheDiagnostics.statusPass': '通过',
            'agentWorkspace.conversationTurnCacheDiagnostics.statusWarn': '警告',
            'agentWorkspace.conversationTurnCacheDiagnostics.statusFail': '失败',
            'agentWorkspace.conversationTurnCacheDiagnostics.checkUtilizationPct': '利用率',
            'agentWorkspace.conversationTurnCacheDiagnostics.checkExecutionFailureRatioPct': '执行失败率',
            'agentWorkspace.conversationTurnCacheDiagnostics.checkConflictCount': '冲突计数',
            'agentWorkspace.conversationTurnCacheDiagnostics.checkStaleEligibleEntries': '可清理陈旧条目',
            'agentWorkspace.conversationTurnCacheDiagnostics.none': '无',
            'agentWorkspace.conversationTurnCacheAlertTrend.cardTitle': '对话轮次缓存告警趋势',
            'agentWorkspace.conversationTurnCacheAlertTrend.summary': '趋势 {trendStatus}，升级建议 {recommendedEscalation}，记录 {returnedRecords}/{totalRecords}。',
            'agentWorkspace.conversationTurnCacheAlertTrend.metricsHeading': '关键指标',
            'agentWorkspace.conversationTurnCacheAlertTrend.recordsLabel': '返回/总记录',
            'agentWorkspace.conversationTurnCacheAlertTrend.statusCountsLabel': '状态计数（通过/警告/失败）',
            'agentWorkspace.conversationTurnCacheAlertTrend.activeStreakLabel': '当前警告/失败连续次数',
            'agentWorkspace.conversationTurnCacheAlertTrend.latestStatusLabel': '最近汇总状态（激活/警告/失败）',
            'agentWorkspace.conversationTurnCacheAlertTrend.latestTopCheckLabel': '最近最高优先级检查',
            'agentWorkspace.conversationTurnCacheAlertTrend.latestMetricsLabel': '最近指标（利用率/失败率/冲突/陈旧/条目）',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendConfigLabel': '趋势配置（上限/窗口/最小样本/间隔）',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationLabel': '升级建议',
            'agentWorkspace.conversationTurnCacheAlertTrend.latestSampledAtLabel': '最近采样时间',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusInsufficientData': '数据不足',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusStable': '稳定',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusImproving': '改善',
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusRegressing': '退化',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationNormal': '正常',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationWatch': '观察',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationHigh': '高风险',
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationCritical': '关键风险',
            'agentWorkspace.conversationTurnCacheAlertTrend.none': '无',
            'agentWorkspace.queryBackendComparison.cardTitle': '检索后端对比',
            'agentWorkspace.queryBackendComparison.summary': '查询“{query}”（topK={topK}）：{leftBackend} 对比 {rightBackend}，优选 {preferredBackendLabel}。',
            'agentWorkspace.queryBackendComparison.metricsHeading': '关键指标',
            'agentWorkspace.queryBackendComparison.overlapRatioLabel': '重叠比例',
            'agentWorkspace.queryBackendComparison.latencyDeltaLabel': '延迟差值（左-右）',
            'agentWorkspace.queryBackendComparison.evidenceCoverageLabel': '证据覆盖率（左/右）',
            'agentWorkspace.queryBackendComparison.relationCoverageLabel': '关系路径覆盖率（左/右）',
            'agentWorkspace.queryBackendComparison.temporalPassLabel': '时效通过率（左/右）',
            'agentWorkspace.queryBackendComparison.reasonLabel': '原因',
            'agentWorkspace.queryBackendComparison.none': '无',
            'agentWorkspace.queryBackendDiagnostics.cardTitle': '检索后端诊断',
            'agentWorkspace.queryBackendDiagnostics.summary': '后端 {backendId} 当前配置为 {configuredBackend}；回退次数 {fallbackCount}。',
            'agentWorkspace.queryBackendDiagnostics.metricsHeading': '关键指标',
            'agentWorkspace.queryBackendDiagnostics.comparisonsLabel': '对比次数',
            'agentWorkspace.queryBackendDiagnostics.preferredCountsLabel': '优选计数（左/右/平）',
            'agentWorkspace.queryBackendDiagnostics.latencyDeltaLabel': '平均延迟差值',
            'agentWorkspace.queryBackendDiagnostics.runtimeReadyLabel': '运行时就绪',
            'agentWorkspace.queryBackendDiagnostics.graphvizRuntimeLabel': 'Graphviz 运行时',
            'agentWorkspace.queryBackendDiagnostics.graphvizDotBinaryLabel': 'Graphviz dot 二进制',
            'agentWorkspace.queryBackendDiagnostics.graphvizReasonLabel': 'Graphviz 运行时原因',
            'agentWorkspace.queryBackendDiagnostics.graphvizCheckedAtLabel': 'Graphviz 探测时间/缓存 TTL',
            'agentWorkspace.queryBackendDiagnostics.graphvizFreshnessLabel': 'Graphviz 探测新鲜度',
            'agentWorkspace.queryBackendDiagnostics.vectorIndexLabel': '向量索引状态/原子数',
            'agentWorkspace.queryBackendDiagnostics.accelerationLabel': '加速模式/选择模式',
            'agentWorkspace.queryBackendDiagnostics.healthLabel': '加速健康/熔断状态',
            'agentWorkspace.queryBackendDiagnostics.rolloutModeLabel': '发布策略模式',
            'agentWorkspace.queryBackendDiagnostics.accelerationProviderLabel': '加速提供方配置',
            'agentWorkspace.queryBackendDiagnostics.accelerationFailureModeLabel': '加速失败模式配置',
            'agentWorkspace.queryBackendDiagnostics.accelerationRepresentationStrictLabel': '加速表示一致性严格模式配置',
            'agentWorkspace.queryBackendDiagnostics.annPrefilterLabel': 'ANN 预筛选发布状态',
            'agentWorkspace.queryBackendDiagnostics.annPrefilterEnabled': '开启',
            'agentWorkspace.queryBackendDiagnostics.annPrefilterDisabled': '关闭',
            'agentWorkspace.queryBackendDiagnostics.annPrefilterUnknown': '未知',
            'agentWorkspace.queryBackendDiagnostics.boolEnabled': '开启',
            'agentWorkspace.queryBackendDiagnostics.boolDisabled': '关闭',
            'agentWorkspace.queryBackendDiagnostics.fallbackBackendLabel': '回退后端',
            'agentWorkspace.queryBackendDiagnostics.lastErrorLabel': '最近错误',
            'agentWorkspace.queryBackendDiagnostics.runtimeLastErrorLabel': '运行时最近错误',
            'agentWorkspace.queryBackendDiagnostics.statusAvailable': '可用',
            'agentWorkspace.queryBackendDiagnostics.statusUnavailable': '不可用',
            'agentWorkspace.queryBackendDiagnostics.statusUnknown': '未知',
            'agentWorkspace.queryBackendDiagnostics.freshnessFresh': '新鲜',
            'agentWorkspace.queryBackendDiagnostics.freshnessWarn': '预警',
            'agentWorkspace.queryBackendDiagnostics.freshnessStale': '过期',
            'agentWorkspace.queryBackendDiagnostics.freshnessUnknown': '未知',
            'agentWorkspace.queryBackendDiagnostics.none': '无',
            'agentWorkspace.queryBackendComparisonHistory.cardTitle': '后端对比历史',
            'agentWorkspace.queryBackendComparisonHistory.summary': '记录 {returnedRecords}/{totalRecords}，平均重叠 {averageOverlapRatioPct}%，平均延迟差 {averageLatencyDeltaMs}ms。',
            'agentWorkspace.queryBackendComparisonHistory.metricsHeading': '关键指标',
            'agentWorkspace.queryBackendComparisonHistory.preferredCountsLabel': '优选计数（左/右/平）',
            'agentWorkspace.queryBackendComparisonHistory.evidenceCoverageLabel': '平均证据覆盖率（左/右）',
            'agentWorkspace.queryBackendComparisonHistory.latestComparedAtLabel': '最近对比时间',
            'agentWorkspace.queryBackendComparisonHistory.none': '无',
            'agentWorkspace.queryBackendComparisonTrend.cardTitle': '后端对比趋势',
            'agentWorkspace.queryBackendComparisonTrend.summary': '状态 {status}（置信度 {confidencePct}%，分值 {score}）。',
            'agentWorkspace.queryBackendComparisonTrend.metricsHeading': '关键指标',
            'agentWorkspace.queryBackendComparisonTrend.recordsLabel': '评估记录',
            'agentWorkspace.queryBackendComparisonTrend.overlapDeltaLabel': '重叠变化',
            'agentWorkspace.queryBackendComparisonTrend.explainabilityDeltaLabel': '可解释性差距变化',
            'agentWorkspace.queryBackendComparisonTrend.reasonLabel': '原因',
            'agentWorkspace.queryBackendComparisonTrend.latestComparedAtLabel': '最近对比时间',
            'agentWorkspace.queryBackendComparisonTrend.none': '无',
            'agentWorkspace.tutorAdapterTelemetry.cardTitle': '导师适配器遥测',
            'agentWorkspace.tutorAdapterTelemetry.summary': '{activeAdapters}/{totalAdapters} 个适配器处于活跃状态，请求总数 {totalRequests}。',
            'agentWorkspace.tutorAdapterTelemetry.metricsHeading': '关键指标',
            'agentWorkspace.tutorAdapterTelemetry.acceptedFailedLabel': '接受/失败响应',
            'agentWorkspace.tutorAdapterTelemetry.fallbackRatioLabel': '供应商回退率',
            'agentWorkspace.tutorAdapterTelemetry.averageAttemptsLabel': '平均供应商尝试次数',
            'agentWorkspace.tutorAdapterTelemetry.averageConfidenceLabel': '平均置信度',
            'agentWorkspace.tutorAdapterTelemetry.routingLabel': '路由策略 / 推荐模式',
            'agentWorkspace.tutorAdapterTelemetry.firstAdapterLabel': '头部适配器',
            'agentWorkspace.tutorAdapterTelemetry.firstAdapterFallbackLabel': '头部适配器回退率',
            'agentWorkspace.tutorAdapterTelemetry.firstAdapterLastErrorLabel': '头部适配器最近错误',
            'agentWorkspace.tutorAdapterTelemetry.none': '无',
            'agentWorkspace.tutorTraceDiagnostics.cardTitle': '导师追踪诊断',
            'agentWorkspace.tutorTraceDiagnostics.summary': '追踪 {returnedTraces}/{matchedTraces} 条（来源 {source}，动作 {actionKind}）。',
            'agentWorkspace.tutorTraceDiagnostics.metricsHeading': '关键指标',
            'agentWorkspace.tutorTraceDiagnostics.sourceCountsLabel': '来源计数（llm/rule）',
            'agentWorkspace.tutorTraceDiagnostics.verificationLabel': '验证状态（已验证/待验证）',
            'agentWorkspace.tutorTraceDiagnostics.fallbackRatioLabel': '回退率',
            'agentWorkspace.tutorTraceDiagnostics.averageAttemptsLabel': '平均供应商尝试次数',
            'agentWorkspace.tutorTraceDiagnostics.topProviderLabel': '头部供应商',
            'agentWorkspace.tutorTraceDiagnostics.topProviderConfidenceLabel': '头部供应商平均置信度',
            'agentWorkspace.tutorTraceDiagnostics.firstRecordLabel': '首条追踪快照',
            'agentWorkspace.tutorTraceDiagnostics.timestampsLabel': '最近追踪 / 头部供应商最近出现',
            'agentWorkspace.tutorTraceDiagnostics.none': '无',
            'agentWorkspace.learningQualityTrend.cardTitle': '学习质量趋势',
            'agentWorkspace.learningQualityTrend.summary': '状态 {status}（置信度 {confidencePct}%，分值 {score}）。',
            'agentWorkspace.learningQualityTrend.metricsHeading': '关键指标',
            'agentWorkspace.learningQualityTrend.recordsLabel': '评估记录',
            'agentWorkspace.learningQualityTrend.retestDeltaLabel': '复测通过率变化',
            'agentWorkspace.learningQualityTrend.evidenceDeltaLabel': '证据建议比例变化',
            'agentWorkspace.learningQualityTrend.misconceptionDeltaLabel': '误区复发率变化',
            'agentWorkspace.learningQualityTrend.fallbackDeltaLabel': '检索回退率变化',
            'agentWorkspace.learningQualityTrend.reasonLabel': '原因',
            'agentWorkspace.learningQualityTrend.latestSampledAtLabel': '最近采样时间',
            'agentWorkspace.learningQualityTrend.none': '无',
            'agentWorkspace.sessionPlanQualityTrend.cardTitle': '会话计划质量趋势',
            'agentWorkspace.sessionPlanQualityTrend.summary': '状态 {status}（置信度 {confidencePct}%，分值 {score}）。',
            'agentWorkspace.sessionPlanQualityTrend.metricsHeading': '关键指标',
            'agentWorkspace.sessionPlanQualityTrend.recordsLabel': '评估记录',
            'agentWorkspace.sessionPlanQualityTrend.passRateDeltaLabel': '通过率变化',
            'agentWorkspace.sessionPlanQualityTrend.evidenceDeltaLabel': '证据覆盖率变化',
            'agentWorkspace.sessionPlanQualityTrend.budgetDeltaLabel': '预算偏差变化',
            'agentWorkspace.sessionPlanQualityTrend.recoveryDeltaLabel': '恢复占比变化',
            'agentWorkspace.sessionPlanQualityTrend.divergenceDeltaLabel': '发散占比变化',
            'agentWorkspace.sessionPlanQualityTrend.reasonLabel': '原因',
            'agentWorkspace.sessionPlanQualityTrend.latestEvaluatedAtLabel': '最近评估时间',
            'agentWorkspace.sessionPlanQualityTrend.none': '无',
            'agentWorkspace.learningQualityHistory.cardTitle': '学习质量历史',
            'agentWorkspace.learningQualityHistory.summary': '可用记录 {returnedRecords}/{totalRecords}。',
            'agentWorkspace.learningQualityHistory.metricsHeading': '关键指标',
            'agentWorkspace.learningQualityHistory.latestRetestPassRateLabel': '最近复测通过率',
            'agentWorkspace.learningQualityHistory.latestEvidenceRatioLabel': '最近证据建议比例',
            'agentWorkspace.learningQualityHistory.latestMisconceptionRecurrenceLabel': '最近误区复发率',
            'agentWorkspace.learningQualityHistory.latestQueryFallbackLabel': '最近检索回退率',
            'agentWorkspace.learningQualityHistory.latestSampledAtLabel': '最近采样时间',
            'agentWorkspace.learningQualityHistory.none': '无',
            'agentWorkspace.sessionPlanQualityHistory.cardTitle': '会话计划质量历史',
            'agentWorkspace.sessionPlanQualityHistory.summary': '记录 {returnedRecords}/{totalRecords}，通过率 {returnedPassRatePct}%（总体 {overallPassRatePct}%）。',
            'agentWorkspace.sessionPlanQualityHistory.metricsHeading': '关键指标',
            'agentWorkspace.sessionPlanQualityHistory.consecutiveFailureCountLabel': '连续失败次数',
            'agentWorkspace.sessionPlanQualityHistory.averageBudgetDeviationLabel': '平均预算偏差',
            'agentWorkspace.sessionPlanQualityHistory.topFailedGateLabel': '最高失败门',
            'agentWorkspace.sessionPlanQualityHistory.latestEvaluatedAtLabel': '最近评估时间',
            'agentWorkspace.sessionPlanQualityHistory.none': '无',
            'agentWorkspace.runtimeRunbookVerify.cardTitle': '运行时 Runbook 验证',
            'agentWorkspace.runtimeRunbookVerify.summary': '检查 {selectedCheckId}：状态 {selectedCheckStatus}，升级级别 {selectedCheckEscalation}。',
            'agentWorkspace.runtimeRunbookVerify.metricsHeading': '关键指标',
            'agentWorkspace.runtimeRunbookVerify.topRiskLabel': '最高风险检查',
            'agentWorkspace.runtimeRunbookVerify.traceErrorLabel': 'Trace 错误',
            'agentWorkspace.runtimeRunbookVerify.traceP95Label': 'Trace p95 时延',
            'agentWorkspace.runtimeRunbookVerify.historyStreakLabel': '风险/失败连续次数',
            'agentWorkspace.runtimeRunbookVerify.historyTrendLabel': '历史趋势',
            'agentWorkspace.runtimeRunbookVerify.remediationRiskRatioLabel': '修复风险比率',
            'agentWorkspace.runtimeRunbookVerify.autoFocusLabel': '自动聚焦',
            'agentWorkspace.runtimeRunbookVerify.firstEscalationActionLabel': '首要升级动作',
            'agentWorkspace.runtimeRunbookVerify.annIndexSyncLabel': 'ANN 同步健康度',
            'agentWorkspace.runtimeRunbookVerify.annIndexSyncCountsLabel': 'ANN 同步计数',
            'agentWorkspace.runtimeRunbookVerify.annCircuitLabel': 'ANN 熔断预算',
            'agentWorkspace.runtimeRunbookVerify.annCircuitThresholdsLabel': 'ANN 熔断阈值',
            'agentWorkspace.runtimeRunbookVerify.annTraceabilityLabel': 'ANN 可追踪性',
            'agentWorkspace.runtimeRunbookVerify.annTraceabilitySignalsLabel': 'ANN 可追踪性信号',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterLabel': 'ANN 预筛选',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterThresholdsLabel': 'ANN 预筛选阈值',
            'agentWorkspace.runtimeRunbookVerify.autoFocusApplied': '已应用（{reason}）',
            'agentWorkspace.runtimeRunbookVerify.autoFocusNotApplied': '未应用',
            'agentWorkspace.runtimeRunbookVerify.none': '无',
            'agentWorkspace.runtimeRunbookHistory.cardTitle': '运行时 Runbook 历史',
            'agentWorkspace.runtimeRunbookHistory.summary': '{sinceMinutes} 分钟内 {checkId} 的记录 {returnedRecords}/{matchedRecords}；趋势 {trendStatus}。',
            'agentWorkspace.runtimeRunbookHistory.metricsHeading': '关键指标',
            'agentWorkspace.runtimeRunbookHistory.statusCountsLabel': '状态计数（pass/warn/fail/unknown）',
            'agentWorkspace.runtimeRunbookHistory.activeStreakLabel': '当前风险/失败连续次数',
            'agentWorkspace.runtimeRunbookHistory.averageErrorRatioLabel': '平均错误比率',
            'agentWorkspace.runtimeRunbookHistory.averageP95Label': '平均 p95 时延',
            'agentWorkspace.runtimeRunbookHistory.deltaLabel': '严重度/错误率/p95 变化',
            'agentWorkspace.runtimeRunbookHistory.latestVerifiedAtLabel': '最近验证时间',
            'agentWorkspace.runtimeRunbookHistory.allChecks': '全部检查',
            'agentWorkspace.runtimeRunbookHistory.none': '无',
            'agentWorkspace.runtimeRunbookChecks.cardTitle': '运行时 Runbook 检查',
            'agentWorkspace.runtimeRunbookChecks.summary': '{sinceMinutes} 分钟内检查 {returnedChecks}/{matchedRecords}；推荐聚焦 {recommendedFocusCheckId}。',
            'agentWorkspace.runtimeRunbookChecks.metricsHeading': '关键指标',
            'agentWorkspace.runtimeRunbookChecks.firstCheckAnnIndexSyncLabel': '首个检查的 ANN 同步',
            'agentWorkspace.runtimeRunbookChecks.annCircuitLabel': 'ANN 熔断快照',
            'agentWorkspace.runtimeRunbookChecks.annCircuitThresholdsLabel': 'ANN 熔断阈值快照',
            'agentWorkspace.runtimeRunbookChecks.annTraceabilityLabel': 'ANN 可追踪性快照',
            'agentWorkspace.runtimeRunbookChecks.annTraceabilitySignalsLabel': 'ANN 可追踪性信号快照',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterLabel': 'ANN 预筛选快照',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterThresholdsLabel': 'ANN 预筛选阈值快照',
            'agentWorkspace.runtimeRunbookChecks.trendCountsLabel': '趋势计数（回归/改善/稳定/数据不足）',
            'agentWorkspace.runtimeRunbookChecks.recommendedFocusLabel': '推荐聚焦原因',
            'agentWorkspace.runtimeRunbookChecks.recommendedEscalationLabel': '推荐升级级别',
            'agentWorkspace.runtimeRunbookChecks.actionQueueLabel': '动作队列（总/p0/p1/p2）',
            'agentWorkspace.runtimeRunbookChecks.remediationRiskRatioLabel': '修复风险比率',
            'agentWorkspace.runtimeRunbookChecks.firstCheckLabel': '首个检查快照',
            'agentWorkspace.runtimeRunbookChecks.topActionLabel': '首要聚焦动作',
            'agentWorkspace.runtimeRunbookChecks.latestRemediationLabel': '最近修复记录',
            'agentWorkspace.runtimeRunbookChecks.none': '无',
            'agentWorkspace.runtimeRunbookActionQueue.cardTitle': '运行时动作队列',
            'agentWorkspace.runtimeRunbookActionQueue.summary': '队列项 {returnedQueueItems}/{filteredQueueItems}（上限 {queueLimit}）；p0={queueP0}。',
            'agentWorkspace.runtimeRunbookActionQueue.metricsHeading': '关键指标',
            'agentWorkspace.runtimeRunbookActionQueue.priorityCountsLabel': '优先级计数（p0/p1/p2）',
            'agentWorkspace.runtimeRunbookActionQueue.filtersLabel': '过滤器（优先级/类别/修复）',
            'agentWorkspace.runtimeRunbookActionQueue.remediationRiskLabel': '修复风险队列',
            'agentWorkspace.runtimeRunbookActionQueue.recommendedFocusLabel': '推荐聚焦',
            'agentWorkspace.runtimeRunbookActionQueue.firstQueueItemLabel': '首个队列项',
            'agentWorkspace.runtimeRunbookActionQueue.firstRemediationLabel': '首项修复状态',
            'agentWorkspace.runtimeRunbookActionQueue.firstInstructionLabel': '首条执行指令',
            'agentWorkspace.runtimeRunbookActionQueue.none': '无',
            'agentWorkspace.messages.sessionHistoryFailed': '会话历史获取失败：{error}',
            'agentWorkspace.messages.queryBackendComparisonFailed': '检索后端对比失败：{error}',
            'agentWorkspace.messages.queryBackendDiagnosticsFailed': '检索后端诊断获取失败：{error}',
            'agentWorkspace.messages.queryBackendComparisonHistoryFailed': '检索后端对比历史获取失败：{error}',
            'agentWorkspace.messages.queryBackendComparisonTrendFailed': '检索后端对比趋势获取失败：{error}',
            'agentWorkspace.messages.tutorAdapterTelemetryFailed': '导师适配器遥测获取失败：{error}',
            'agentWorkspace.messages.tutorTraceDiagnosticsFailed': '导师追踪诊断获取失败：{error}',
            'agentWorkspace.messages.learningQualityTrendFailed': '学习质量趋势获取失败：{error}',
            'agentWorkspace.messages.learningQualityHistoryFailed': '学习质量历史获取失败：{error}',
            'agentWorkspace.messages.sessionPlanQualityTrendFailed': '会话计划质量趋势获取失败：{error}',
            'agentWorkspace.messages.sessionPlanQualityHistoryFailed': '会话计划质量历史获取失败：{error}',
            'agentWorkspace.messages.runtimeRunbookVerifyFailed': '运行时能力 runbook 验证失败：{error}',
            'agentWorkspace.messages.runtimeRunbookHistoryFailed': '运行时能力 runbook 历史获取失败：{error}',
            'agentWorkspace.messages.runtimeRunbookChecksFailed': '运行时能力 runbook 检查获取失败：{error}',
            'agentWorkspace.messages.runtimeRunbookActionQueueFailed': '运行时能力 runbook 动作队列获取失败：{error}',
            'agentWorkspace.messages.conversationMemorySearchFailed': '对话记忆检索失败：{error}',
            'agentWorkspace.messages.conversationTurnCacheDiagnosticsFailed': '对话轮次缓存诊断获取失败：{error}',
            'agentWorkspace.messages.conversationTurnCacheAlertTrendFailed': '对话轮次缓存告警趋势获取失败：{error}',
            'agentWorkspace.messages.executionKindUnsupported': '不支持的能力执行类型：{executionKind}',
            'agentWorkspace.messages.operationResultPresentationUnsupported': '操作 {operationId} 不支持结果呈现 {resultPresentation}；允许：{allowedResultPresentations}',
            'agentWorkspace.messages.capabilityActionUnsupported': '不支持的能力动作：{actionId}',
        },
    };

    return {
        currentLanguage: 'en',
        t(key: string, params: Record<string, string> = {}) {
            const dict = dictionaries[this.currentLanguage] || dictionaries.en;
            const template = dict[key] || key;
            return template.replace(/\{(\w+)\}/g, (_match, name) => params[name] ?? '');
        },
        onLanguageChange(callback: (lang: string) => void) {
            listeners.push(callback);
        },
        async setLanguage(lang: string) {
            this.currentLanguage = lang;
            listeners.forEach((listener) => listener(lang));
        },
    };
}

function createWorkspaceHtml() {
    return `
        <!doctype html>
        <html>
          <body>
            <div id="graph-wrapper">
              <div id="agent-workspace-shell">
                <section id="agent-chat-pane">
                  <input id="agent-workspace-user-id" value="path_user_default" />
                  <div id="agent-workspace-chat-messages"></div>
                  <textarea id="agent-workspace-chat-input"></textarea>
                  <button id="btn-agent-workspace-send"></button>
                  <div id="agent-workspace-knowledge-points"></div>
                </section>
                <div id="agent-side-work-area">
                  <section id="agent-graph-focus-pane" class="agent-workspace-pane">
                    <div class="agent-workspace-pane-header">
                      <button id="btn-agent-graph-focus-fullscreen"></button>
                    </div>
                    <div id="agent-graph-focus-body"></div>
                  </section>
                  <section id="agent-learning-path-pane" class="agent-workspace-pane">
                    <div class="agent-workspace-pane-header">
                      <button id="btn-agent-learning-path-fullscreen"></button>
                    </div>
                    <div id="agent-learning-path-body"></div>
                  </section>
                </div>
              </div>
            </div>
            <div id="path-container" style="display: none">
              <button id="btn-exit-path" type="button">Exit</button>
              <div id="path-toolbar"></div>
              <canvas id="path-canvas"></canvas>
              <div id="path-overlay"></div>
            </div>
            <div id="learning-history-sidebar" style="display: none"></div>
            <div id="learning-workbench-sidebar" style="display: none"></div>
          </body>
        </html>
    `;
}

function createBaseSandbox(dom: JSDOM) {
    const sandbox: Record<string, any> = {
        window: dom.window as any,
        document: dom.window.document,
        console: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        },
        fetch: undefined,
        setTimeout,
        clearTimeout,
        Event: dom.window.Event,
        CustomEvent: dom.window.CustomEvent,
        KeyboardEvent: dom.window.KeyboardEvent,
        MouseEvent: dom.window.MouseEvent,
        TextEncoder: typeof TextEncoder === 'function' ? TextEncoder : undefined,
        TextDecoder: typeof TextDecoder === 'function' ? TextDecoder : undefined,
    };
    sandbox.window.console = sandbox.console;
    if (typeof TextEncoder === 'function') {
        sandbox.window.TextEncoder = TextEncoder;
    }
    if (typeof TextDecoder === 'function') {
        sandbox.window.TextDecoder = TextDecoder;
    }
    return sandbox;
}

function loadScriptIntoSandbox(sandbox: Record<string, any>, scriptPath: string, filename: string) {
    const source = fs.readFileSync(scriptPath, 'utf8');
    const context = vm.createContext(sandbox);
    new vm.Script(source, { filename }).runInContext(context);
}

function dispatchDomReady(document: Document) {
    document.dispatchEvent(new document.defaultView!.Event('DOMContentLoaded', { bubbles: true }));
}

function createJsonResponse(result: unknown) {
    return {
        ok: true,
        headers: {
            get(headerName: string) {
                if (String(headerName || '').toLowerCase() === 'content-type') {
                    return 'application/json; charset=utf-8';
                }
                return null;
            },
        },
        text: async () => JSON.stringify({
            success: true,
            result,
        }),
    };
}

function extractCardMetrics(card: Element | null): Record<string, string> {
    const metrics: Record<string, string> = {};
    if (!card) {
        return metrics;
    }
    card.querySelectorAll('.agent-chat-card-list-item').forEach((item) => {
        const title = String(
            item.querySelector('.agent-chat-card-list-title')?.textContent || ''
        ).trim();
        if (!title) {
            return;
        }
        const value = String(
            item.querySelector('.agent-chat-card-list-meta')?.textContent || ''
        ).trim();
        metrics[title] = value;
    });
    return metrics;
}

function createSseResponse(events: Array<{ event: string; payload: unknown }>, options?: { chunkSize?: number }) {
    const serialized = events.map((entry) =>
        [
            `event: ${entry.event}`,
            `data: ${JSON.stringify(entry.payload)}`,
            '',
            '',
        ].join('\n')
    ).join('');
    const encoded = typeof TextEncoder === 'function'
        ? new TextEncoder().encode(serialized)
        : Uint8Array.from(serialized.split('').map((char) => char.charCodeAt(0)));
    const chunkSize = Number(options && options.chunkSize || 0);
    const chunks: Uint8Array[] = [];
    if (chunkSize > 0) {
        for (let index = 0; index < encoded.length; index += chunkSize) {
            chunks.push(encoded.slice(index, index + chunkSize));
        }
    } else {
        chunks.push(encoded);
    }

    return {
        ok: true,
        headers: {
            get(headerName: string) {
                if (String(headerName || '').toLowerCase() === 'content-type') {
                    return 'text/event-stream; charset=utf-8';
                }
                return null;
            },
        },
        body: {
            getReader() {
                let cursor = 0;
                return {
                    async read() {
                        if (cursor >= chunks.length) {
                            return { done: true, value: undefined };
                        }
                        const value = chunks[cursor];
                        cursor += 1;
                        return { done: false, value };
                    },
                };
            },
        },
        text: async () => serialized,
    };
}

function loadWorkspacePanesHarness(options: { withI18n?: boolean } = {}): HarnessResult {
    const repoRoot = path.resolve(__dirname, '..');
    const scriptPath = path.join(repoRoot, 'src', 'frontend', 'workspace_panes.js');
    const dom = new JSDOM(createWorkspaceHtml(), {
        url: 'http://127.0.0.1:3000',
    });
    const sandbox = createBaseSandbox(dom);
    if (options.withI18n) {
        sandbox.window.i18n = createI18nStub();
    }

    loadScriptIntoSandbox(sandbox, scriptPath, 'workspace_panes.js');

    const controller = sandbox.window.NoteConnectionWorkspacePanes;
    if (!controller) {
        throw new Error('workspace panes controller was not attached to window');
    }

    return {
        controller,
        document: dom.window.document,
        window: dom.window as any,
    };
}

function loadAgentWorkspaceHarness(options: { withI18n?: boolean } = {}): HarnessResult {
    const repoRoot = path.resolve(__dirname, '..');
    const workspaceScriptPath = path.join(repoRoot, 'src', 'frontend', 'workspace_panes.js');
    const agentScriptPath = path.join(repoRoot, 'src', 'frontend', 'agent_workspace.js');
    const dom = new JSDOM(createWorkspaceHtml(), {
        url: 'http://127.0.0.1:3000',
    });
    const sandbox = createBaseSandbox(dom);
    if (options.withI18n) {
        sandbox.window.i18n = createI18nStub();
    }

    const fetchMock = jest.fn().mockImplementation(async (url: string, init?: { body?: string }) => {
        if (url === '/api/knowledge/tutor/action') {
            let actionKind = 'generate_quiz';
            if (init && typeof init.body === 'string' && init.body.trim().length > 0) {
                try {
                    const parsed = JSON.parse(init.body);
                    actionKind = String(parsed.actionKind || 'generate_quiz');
                } catch (_error) {
                    actionKind = 'generate_quiz';
                }
            }
            const messageByActionKind: Record<string, string> = {
                generate_quiz: 'Question: Explain Learning Paths in your own words.',
                recap: 'Recap for "Learning Paths":\n- Key evidence: Learning paths sequence concepts.',
                generate_transfer: 'Transfer challenge: apply "Learning Paths" to "Retrieval Foundations".',
                generate_counterexample: 'Counterexample challenge: stress-test "Learning Paths".',
                follow_up: 'Follow-up: compare "Learning Paths" with "Retrieval Foundations".',
                analyze_answer: 'Answer quality: partial.',
            };
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        message: messageByActionKind[actionKind] || messageByActionKind.generate_quiz,
                        evidenceSpans: [
                            {
                                id: 'ev_1',
                                snippet: 'Learning paths sequence concepts into prerequisite-aware progression.',
                            },
                        ],
                        trace: {
                            actionKind,
                        },
                    },
                }),
            };
        }
        if (url === '/api/knowledge/conversation-memory/search') {
            let parsedBody: Record<string, unknown> = {};
            if (init && typeof init.body === 'string' && init.body.trim().length > 0) {
                try {
                    parsedBody = JSON.parse(init.body);
                } catch (_error) {
                    parsedBody = {};
                }
            }
            const query = String(parsedBody.query || 'conversation memory');
            const namespace = String(parsedBody.namespace || 'conversation');
            const userId = String(parsedBody.userId || 'path_user_default');
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        userId,
                        namespace,
                        query,
                        records: [
                            {
                                id: 'cm_1',
                                userId,
                                namespace,
                                content: 'Remember to revisit Focus Node evidence before transfer tasks.',
                                tags: ['focus', 'evidence'],
                                confidence: 0.82,
                                createdAt: '2026-04-11T12:00:00.000Z',
                                updatedAt: '2026-04-11T12:30:00.000Z',
                                feedbackScore: 1,
                                feedbackTrail: [],
                            },
                        ],
                        message: `Conversation memory recall (1/1) for \"${query}\":\n1. [${namespace}] Remember to revisit Focus Node evidence before transfer tasks.`,
                        summary: {
                            totalEntries: 1,
                            matchedEntries: 1,
                            returnedEntries: 1,
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/conversation/turn-cache/diagnostics/trend')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:03:00.000Z',
                        config: {
                            historyLimit: 240,
                            sampleMinIntervalMs: 15000,
                            trendWindowSize: 12,
                            trendMinSamples: 6,
                            escalationWarnStreak: 3,
                            escalationFailStreak: 2,
                            limit: 24,
                            windowSize: 12,
                            minSamples: 6,
                        },
                        summary: {
                            returnedRecords: 6,
                            totalRecords: 12,
                            statusPassCount: 2,
                            statusWarnCount: 3,
                            statusFailCount: 1,
                            activeWarnStreak: 2,
                            activeFailStreak: 1,
                            trendStatus: 'regressing',
                            recommendedEscalation: 'watch',
                            reason: 'warn_or_regressing',
                            latestSampledAt: '2026-04-12T00:02:30.000Z',
                        },
                        latest: {
                            sampledAt: '2026-04-12T00:02:30.000Z',
                            summaryStatus: 'warn',
                            failingCheckCount: 2,
                            warnCheckCount: 1,
                            failCheckCount: 1,
                            topCheckId: 'execution_failure_ratio_pct',
                            topCheckSeverity: 'warn',
                            topCheckValue: 9.5238,
                            utilizationPct: 3.516,
                            executionFailureRatioPct: 9.5238,
                            conflictCount: 3,
                            staleEligibleEntries: 2,
                            totalEntries: 9,
                        },
                        records: [
                            {
                                sampledAt: '2026-04-12T00:00:30.000Z',
                                summaryStatus: 'pass',
                                failingCheckCount: 0,
                                warnCheckCount: 0,
                                failCheckCount: 0,
                                topCheckId: '',
                                topCheckSeverity: 'pass',
                                topCheckValue: 0,
                                utilizationPct: 2.1,
                                executionFailureRatioPct: 1.2,
                                conflictCount: 0,
                                staleEligibleEntries: 0,
                                totalEntries: 5,
                            },
                        ],
                        storage: {
                            filePath: '/tmp/notemd-runtime/agent_conversation_turn_cache_alert_history.v1.json',
                            schemaVersion: 1,
                            totalRecords: 12,
                            configuredHistoryLimit: 240,
                            earliestSampledAt: '2026-04-12T00:00:30.000Z',
                            latestSampledAt: '2026-04-12T00:02:30.000Z',
                            latestSummaryStatus: 'warn',
                            latestTopCheckId: 'execution_failure_ratio_pct',
                            latestTopCheckSeverity: 'warn',
                            lastLoadedAt: '2026-04-12T00:00:00.000Z',
                            lastLoadedRecordCount: 10,
                            lastPersistedAt: '2026-04-12T00:03:00.000Z',
                            lastPersistedRecordCount: 12,
                            lastPersistReason: 'append_alert_record',
                            loadError: '',
                            persistError: '',
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/conversation/turn-cache/diagnostics')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        config: {
                            ttlMs: 180000,
                            maxEntries: 256,
                            maxEventsPerTurn: 128,
                            alertThresholds: {
                                utilizationWarnPct: 70,
                                utilizationFailPct: 90,
                                executionFailureRatioWarnPct: 5,
                                executionFailureRatioFailPct: 20,
                                conflictWarnCount: 2,
                                conflictFailCount: 3,
                                staleEligibleWarnCount: 4,
                                staleEligibleFailCount: 8,
                            },
                        },
                        state: {
                            totalEntries: 9,
                            runningEntries: 1,
                            completedEntries: 7,
                            failedEntries: 1,
                            inFlightEntries: 1,
                            utilizationPct: 3.516,
                            staleEligibleEntries: 2,
                            oldestEntryAgeMs: 91234,
                            newestEntryAgeMs: 1200,
                        },
                        counters: {
                            cacheHitCount: 32,
                            cacheMissCount: 19,
                            cacheHitRatioPct: 62.7451,
                            executionFailureRatioPct: 9.5238,
                            conflictCount: 3,
                            replayResponseCount: 17,
                            replayedEventCount: 98,
                            inFlightJoinCount: 6,
                            executionStartCount: 21,
                            executionSuccessCount: 19,
                            executionFailureCount: 2,
                            syncReuseCount: 5,
                            evictedByTtlCount: 4,
                            evictedByCapacityCount: 1,
                            lastPrunedAt: '2026-04-12T00:01:00.000Z',
                            lastConflictAt: '2026-04-12T00:02:00.000Z',
                        },
                        alerts: {
                            summaryStatus: 'fail',
                            failingCheckCount: 2,
                            warnCheckCount: 1,
                            failCheckCount: 1,
                            checks: [
                                {
                                    checkId: 'utilization_pct',
                                    severity: 'pass',
                                    value: 3.516,
                                    warnThreshold: 70,
                                    failThreshold: 90,
                                    comparison: 'gte',
                                },
                                {
                                    checkId: 'execution_failure_ratio_pct',
                                    severity: 'warn',
                                    value: 9.5238,
                                    warnThreshold: 5,
                                    failThreshold: 20,
                                    comparison: 'gte',
                                },
                                {
                                    checkId: 'conflict_count',
                                    severity: 'fail',
                                    value: 3,
                                    warnThreshold: 2,
                                    failThreshold: 3,
                                    comparison: 'gte',
                                },
                                {
                                    checkId: 'stale_eligible_entries',
                                    severity: 'pass',
                                    value: 2,
                                    warnThreshold: 4,
                                    failThreshold: 8,
                                    comparison: 'gte',
                                },
                            ],
                        },
                    },
                }),
            };
        }
        if (url === '/api/knowledge/session/plan') {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        actions: [
                            { id: 'act_1', atomId: 'atom_paths', kind: 'quiz', rationale: 'Check retrieval.' , estimatedMinutes: 5 },
                            { id: 'act_2', atomId: 'atom_review', kind: 'review', rationale: 'Revisit evidence.', estimatedMinutes: 7 },
                        ],
                        signals: {
                            misconceptions: [],
                            dueRetrainAtoms: [],
                            masteryPathTargets: ['atom_paths'],
                            divergenceTargets: [],
                        },
                        summary: {
                            totalActions: 2,
                            totalEstimatedMinutes: 12,
                            evidenceCoverageRatio: 1,
                        },
                    },
                }),
            };
        }
        if (url === '/api/knowledge/session/history') {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        userId: 'path_user_default',
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        records: [
                            {
                                id: 'sess_1',
                                userId: 'path_user_default',
                                executionKind: 'session',
                                executedAt: '2026-04-11T12:34:56.000Z',
                                plannedActions: 2,
                                attemptedActions: 2,
                                executedCount: 2,
                                updatedMasteryCount: 1,
                                inferredMasteryCount: 1,
                                explicitMasteryCount: 0,
                                analyzedAnswerCount: 1,
                                memoryPersistedCount: 1,
                                memoryPromotionAppliedCount: 0,
                                memoryPromotionCount: 0,
                                averageTutorConfidence: 0.82,
                                averageMasteryDelta: 0.11,
                                improvedAtomCount: 1,
                                regressedAtomCount: 0,
                                unchangedAtomCount: 1,
                                retestActions: 0,
                                stoppedEarly: false,
                            },
                        ],
                        summary: {
                            totalRecords: 1,
                            matchedRecordsBeforeLimit: 1,
                            appliedFilters: {
                                limit: 10,
                                sinceMinutes: 10080,
                                pathStrategy: '',
                                pathStrategySelectionSource: '',
                                refreshSource: 'manual',
                            },
                            totalExecutedActions: 2,
                            totalUpdatedMasteryCount: 1,
                            totalMemoryPromotionAppliedCount: 0,
                            totalMemoryPromotionCount: 0,
                            averageMasteryDelta: 0.11,
                            averageTutorConfidence: 0.82,
                            pathStrategySelectionSourceCounts: {
                                explicit_request: 0,
                                strategy_trend: 0,
                                mode_fallback: 1,
                                unknown: 0,
                            },
                            pathStrategySelectionSourceAverageMasteryDeltaPct: {
                                explicit_request: 0,
                                strategy_trend: 0,
                                mode_fallback: 11,
                                unknown: 0,
                            },
                            pathStrategySelectionSourcePositiveRatioPct: {
                                explicit_request: 0,
                                strategy_trend: 0,
                                mode_fallback: 100,
                                unknown: 0,
                            },
                            pathStrategyOutcomeByStrategy: [],
                        },
                    },
                }),
            };
        }
        if (url === '/api/knowledge/query/compare-backends') {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        comparedAt: '2026-04-12T00:00:00.000Z',
                        query: 'Learning Paths retrieval',
                        topK: 6,
                        configuredQueryBackend: 'local_hybrid',
                        left: {
                            backend: 'local_hybrid',
                            result: {
                                items: [],
                                trace: {
                                    retrievalModes: ['keyword', 'graph_traversal'],
                                    asOf: '2026-04-12T00:00:00.000Z',
                                    totalActiveAtoms: 2,
                                    modeWeights: {
                                        keyword: 0.4,
                                        graph: 0.3,
                                        temporal: 0.2,
                                        semantic: 0.1,
                                    },
                                    latencyMs: 10,
                                    evidenceCoverageRatio: 0.75,
                                    relationPathCoverageRatio: 0.65,
                                    temporalValidityPassRatio: 0.92,
                                    averageEvidenceSpanCount: 1,
                                    averageRelationPathLength: 1,
                                },
                            },
                        },
                        right: {
                            backend: 'keyword_only',
                            result: {
                                items: [],
                                trace: {
                                    retrievalModes: ['keyword'],
                                    asOf: '2026-04-12T00:00:00.000Z',
                                    totalActiveAtoms: 2,
                                    modeWeights: {
                                        keyword: 0.7,
                                        graph: 0.1,
                                        temporal: 0.1,
                                        semantic: 0.1,
                                    },
                                    latencyMs: 14,
                                    evidenceCoverageRatio: 0.6,
                                    relationPathCoverageRatio: 0.55,
                                    temporalValidityPassRatio: 0.84,
                                    averageEvidenceSpanCount: 1,
                                    averageRelationPathLength: 1,
                                },
                            },
                        },
                        summary: {
                            leftResultCount: 4,
                            rightResultCount: 4,
                            overlapAtomCount: 3,
                            overlapRatioPct: 75,
                            leftEvidenceCoverageRatio: 0.75,
                            rightEvidenceCoverageRatio: 0.6,
                            leftRelationPathCoverageRatio: 0.65,
                            rightRelationPathCoverageRatio: 0.55,
                            leftTemporalValidityPassRatio: 0.92,
                            rightTemporalValidityPassRatio: 0.84,
                            leftLatencyMs: 10,
                            rightLatencyMs: 14,
                            latencyDeltaMs: -4,
                            preferredBackend: 'left',
                            reason: 'Left backend keeps stronger evidence coverage.',
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/query-backend-diagnostics')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        backendId: 'graph_query_backend_local_hybrid',
                        configuredBackend: 'local_hybrid',
                        configuredVectorAccelerationProvider: 'external_http',
                        configuredVectorAccelerationFailureMode: 'fail_open',
                        configuredVectorAccelerationRepresentationStrict: true,
                        queryVectorAnnPrefilterEnabled: true,
                        rolloutMode: 'mixed',
                        fallbackCount: 2,
                        fallbackBackendId: 'graph_query_backend_keyword_only',
                        lastError: 'transient_timeout',
                        comparisonTelemetry: {
                            totalComparisons: 18,
                            leftPreferredCount: 11,
                            rightPreferredCount: 5,
                            tieCount: 2,
                            averageOverlapRatioPct: 74.5,
                            averageLatencyDeltaMs: -2.8,
                            lastComparedAt: '2026-04-12T00:00:00.000Z',
                        },
                        runtime: {
                            backendId: 'graph_query_backend_local_hybrid',
                            ready: true,
                            lastError: '',
                            vectorIndex: {
                                enabled: true,
                                status: 'ready',
                                atomCount: 128,
                                acceleration: {
                                    enabled: true,
                                    mode: 'ann_prefilter',
                                    lastSelectionMode: 'token_signature_prefilter',
                                    healthStatus: 'ready',
                                    circuitState: 'closed',
                                },
                            },
                        },
                        rendererRuntime: {
                            graphviz: {
                                backendPngRuntimeAvailable: false,
                                dotBinary: 'dot',
                                reason: "binary 'dot' is unavailable",
                                checkedAtMs: 1712966400000,
                                probeCacheTtlMs: 30000,
                            },
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/query/compare-backends/history')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        records: [
                            {
                                comparedAt: '2026-04-12T00:00:00.000Z',
                                query: 'Learning Paths retrieval',
                                topK: 6,
                                configuredQueryBackend: 'local_hybrid',
                                leftBackend: 'local_hybrid',
                                rightBackend: 'keyword_only',
                                summary: {
                                    leftResultCount: 4,
                                    rightResultCount: 4,
                                    overlapAtomCount: 3,
                                    overlapRatioPct: 75,
                                    leftEvidenceCoverageRatio: 0.75,
                                    rightEvidenceCoverageRatio: 0.6,
                                    leftRelationPathCoverageRatio: 0.65,
                                    rightRelationPathCoverageRatio: 0.55,
                                    leftTemporalValidityPassRatio: 0.92,
                                    rightTemporalValidityPassRatio: 0.84,
                                    leftLatencyMs: 10,
                                    rightLatencyMs: 14,
                                    latencyDeltaMs: -4,
                                    preferredBackend: 'left',
                                    reason: 'Left backend keeps stronger evidence coverage.',
                                },
                            },
                        ],
                        summary: {
                            totalRecords: 1,
                            returnedRecords: 1,
                            latestComparedAt: '2026-04-12T00:00:00.000Z',
                            oldestComparedAt: '2026-04-12T00:00:00.000Z',
                            preferredCounts: {
                                left: 1,
                                right: 0,
                                tie: 0,
                            },
                            averageOverlapRatioPct: 75,
                            averageLatencyDeltaMs: -4,
                            averageLeftEvidenceCoverageRatio: 0.75,
                            averageRightEvidenceCoverageRatio: 0.6,
                            averageLeftRelationPathCoverageRatio: 0.65,
                            averageRightRelationPathCoverageRatio: 0.55,
                            averageLeftTemporalValidityPassRatio: 0.92,
                            averageRightTemporalValidityPassRatio: 0.84,
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/query/compare-backends/trend')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        status: 'stable',
                        score: 0.41,
                        confidence: 0.73,
                        summary: {
                            totalRecords: 12,
                            evaluatedRecords: 8,
                            windowSize: 2,
                            minSamples: 1,
                            latestComparedAt: '2026-04-12T00:00:00.000Z',
                            oldestComparedAt: '2026-04-10T00:00:00.000Z',
                            reason: 'Query backend comparison trend is stable in the configured window.',
                        },
                        deltas: {
                            overlapDeltaPct: 2.5,
                            latencyImbalanceDeltaMs: -0.8,
                            explainabilityGapDeltaPct: -1.2,
                            leftPreferredShareDeltaPct: 0.5,
                            rightPreferredShareDeltaPct: -0.5,
                        },
                        windows: {
                            recent: {
                                averageOverlapRatioPct: 76,
                                averageLatencyDeltaMs: -3.2,
                                averageLatencyImbalanceMs: 1.1,
                                averageEvidenceGapRatioPct: 7.4,
                                averageRelationPathGapRatioPct: 6.3,
                                averageTemporalValidityGapRatioPct: 4.8,
                                averageExplainabilityGapRatioPct: 6.1,
                                leftPreferredSharePct: 58,
                                rightPreferredSharePct: 42,
                            },
                            previous: {
                                averageOverlapRatioPct: 73.5,
                                averageLatencyDeltaMs: -2.4,
                                averageLatencyImbalanceMs: 1.9,
                                averageEvidenceGapRatioPct: 8.6,
                                averageRelationPathGapRatioPct: 7.1,
                                averageTemporalValidityGapRatioPct: 5.4,
                                averageExplainabilityGapRatioPct: 7.3,
                                leftPreferredSharePct: 57.5,
                                rightPreferredSharePct: 42.5,
                            },
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/tutor/telemetry')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        adapters: [
                            {
                                adapterId: 'local_rule_adapter',
                                mode: 'local',
                                totalRequests: 22,
                                successfulResponses: 20,
                                acceptedResponses: 18,
                                downgradedResponses: 2,
                                failedResponses: 2,
                                providerFallbackResponses: 1,
                                providerFallbackRatioPct: 4.55,
                                averageProviderAttemptCount: 1.09,
                                averageConfidence: 0.82,
                                lastUsedAt: '2026-04-12T00:00:00.000Z',
                            },
                            {
                                adapterId: 'cloud_llm_adapter',
                                mode: 'cloud',
                                totalRequests: 9,
                                successfulResponses: 8,
                                acceptedResponses: 6,
                                downgradedResponses: 2,
                                failedResponses: 1,
                                providerFallbackResponses: 2,
                                providerFallbackRatioPct: 22.22,
                                averageProviderAttemptCount: 1.44,
                                averageConfidence: 0.76,
                                lastUsedAt: '2026-04-12T00:00:00.000Z',
                                lastError: 'provider_timeout',
                            },
                        ],
                        summary: {
                            totalAdapters: 2,
                            activeAdapters: 2,
                            totalRequests: 31,
                            successfulResponses: 28,
                            acceptedResponses: 24,
                            downgradedResponses: 4,
                            failedResponses: 3,
                            providerFallbackResponses: 3,
                            providerFallbackRatioPct: 9.68,
                            averageProviderAttemptCount: 1.19,
                            averageConfidence: 0.801,
                            lastRoutingStrategy: 'adaptive_health_routing',
                            lastRoutingDynamicPreferredMode: 'auto',
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/tutor/trace-diagnostics')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        filters: {
                            userId: 'path_user_default',
                            source: 'llm-adapter',
                            limit: 12,
                        },
                        summary: {
                            totalTraces: 42,
                            matchedTraces: 18,
                            returnedTraces: 12,
                            llmAdapterTraces: 18,
                            ruleEngineTraces: 0,
                            verifiedTraces: 15,
                            pendingVerificationTraces: 3,
                            fallbackTraces: 4,
                            fallbackRatioPct: 22.22,
                            averageProviderAttemptCount: 1.31,
                            latestCreatedAt: '2026-04-12T00:00:00.000Z',
                            oldestCreatedAt: '2026-04-10T00:00:00.000Z',
                        },
                        providerBreakdown: [
                            {
                                providerName: 'cloud_llm',
                                traces: 10,
                                fallbackTraces: 3,
                                failedTraces: 1,
                                averageConfidence: 0.79,
                                averageProviderAttemptCount: 1.4,
                                lastSeenAt: '2026-04-12T00:00:00.000Z',
                            },
                        ],
                        records: [
                            {
                                traceId: 'trace_1',
                                userId: 'path_user_default',
                                actionKind: 'generate_quiz',
                                createdAt: '2026-04-12T00:00:00.000Z',
                                confidence: 0.81,
                                evidenceSpanIds: [],
                                relationPathAtomIds: [],
                                source: 'llm-adapter',
                                providerName: 'cloud_llm',
                                verificationStatus: 'verified',
                                verificationReason: 'ok',
                                notes: '',
                            },
                        ],
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/quality/trend')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        userId: 'path_user_default',
                        status: 'stable',
                        score: 0.37,
                        confidence: 0.68,
                        summary: {
                            totalRecords: 16,
                            evaluatedRecords: 10,
                            windowSize: 2,
                            minSamples: 1,
                            latestSampledAt: '2026-04-12T00:00:00.000Z',
                            oldestSampledAt: '2026-04-08T00:00:00.000Z',
                            reason: 'Learning quality trend is stable in the configured window.',
                        },
                        deltas: {
                            retestPassRateDeltaPct: 1.4,
                            evidenceBackedSuggestionDeltaPct: 2.3,
                            pendingVerificationDeltaPct: -0.9,
                            queryBackendFallbackDeltaPct: -1.1,
                            misconceptionRecurrenceDeltaPct: -0.7,
                            pathStrategyExecutionCoverageDeltaPct: 1.6,
                            pathStrategyAverageMasteryDeltaDeltaPct: 0.5,
                        },
                        windows: {
                            recent: {
                                retestPassRatePct: 72,
                                misconceptionRecurrenceRatePct: 18,
                                evidenceBackedSuggestionRatioPct: 76,
                                averagePathMasteryGainPct: 15,
                                randomPathMasteryGainPct: 12,
                                pathStrategyExecutionCoveragePct: 64,
                                pathStrategyAverageMasteryDeltaPct: 7.2,
                                queryEvidenceCoverageRatioPct: 73,
                                queryRelationPathCoverageRatioPct: 67,
                                queryTemporalValidityPassRatioPct: 92,
                                pendingVerificationRatioPct: 8,
                                queryBackendFallbackRatioPct: 4,
                                sessionMemoryPromotionCoveragePct: 62,
                            },
                            previous: {
                                retestPassRatePct: 70.6,
                                misconceptionRecurrenceRatePct: 18.7,
                                evidenceBackedSuggestionRatioPct: 73.7,
                                averagePathMasteryGainPct: 14.5,
                                randomPathMasteryGainPct: 11.8,
                                pathStrategyExecutionCoveragePct: 62.4,
                                pathStrategyAverageMasteryDeltaPct: 6.7,
                                queryEvidenceCoverageRatioPct: 71,
                                queryRelationPathCoverageRatioPct: 65.8,
                                queryTemporalValidityPassRatioPct: 91.3,
                                pendingVerificationRatioPct: 8.9,
                                queryBackendFallbackRatioPct: 5.1,
                                sessionMemoryPromotionCoveragePct: 60,
                            },
                        },
                        strategyBreakdown: [],
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/quality/history')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        userId: 'path_user_default',
                        records: [
                            {
                                sampledAt: '2026-04-12T00:00:00.000Z',
                                snapshot: {
                                    retestPassRatePct: 74.2,
                                    evidenceBackedSuggestionRatioPct: 78.5,
                                    misconceptionRecurrenceRatePct: 17.4,
                                    queryBackendFallbackRatioPct: 3.8,
                                },
                            },
                        ],
                        summary: {
                            totalRecords: 16,
                            returnedRecords: 12,
                            latestSampledAt: '2026-04-12T00:00:00.000Z',
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/quality/baseline/evaluate')) {
            const payload = init && typeof init.body === 'string'
                ? JSON.parse(init.body)
                : {};
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        userId: String(payload.userId || 'path_user_default'),
                        baseline: {
                            userId: String(payload.userId || 'path_user_default'),
                            found: true,
                            storedAt: '2026-04-10T00:00:00.000Z',
                            snapshot: {
                                retestPassRatePct: 70,
                                evidenceBackedSuggestionRatioPct: 75,
                            },
                        },
                        currentSnapshot: {
                            sampledAt: '2026-04-12T00:00:00.000Z',
                            snapshot: {
                                retestPassRatePct: 74,
                                evidenceBackedSuggestionRatioPct: 79,
                            },
                        },
                        evaluation: {
                            evaluatedAt: '2026-04-12T00:00:00.000Z',
                            overallPassed: false,
                            gates: [
                                {
                                    gateId: 'query_p95',
                                    passed: false,
                                    observedValue: 310,
                                    threshold: 280,
                                },
                            ],
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/session/plan/quality/trend')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        userId: 'path_user_default',
                        status: 'improving',
                        score: 0.62,
                        confidence: 0.74,
                        summary: {
                            totalRecords: 20,
                            evaluatedRecords: 12,
                            windowSize: 2,
                            minSamples: 1,
                            latestEvaluatedAt: '2026-04-12T00:00:00.000Z',
                            oldestEvaluatedAt: '2026-04-07T00:00:00.000Z',
                            reason: 'Session plan quality trend is improving in the configured window.',
                        },
                        deltas: {
                            passRateDeltaPct: 3.1,
                            evidenceCoverageDeltaPct: 2.4,
                            budgetDeviationDeltaActions: -0.6,
                            recoveryShareDeltaPct: 1.8,
                            divergenceShareDeltaPct: -1.2,
                        },
                        windows: {
                            recent: {
                                passRatePct: 83,
                                evidenceCoverageRatioPct: 78,
                                averageBudgetDeviationActions: 1.1,
                                recoverySharePct: 55,
                                divergenceSharePct: 23,
                                averageTotalActions: 4.2,
                            },
                            previous: {
                                passRatePct: 79.9,
                                evidenceCoverageRatioPct: 75.6,
                                averageBudgetDeviationActions: 1.7,
                                recoverySharePct: 53.2,
                                divergenceSharePct: 24.2,
                                averageTotalActions: 4.5,
                            },
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/session/plan/quality/history')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        userId: 'path_user_default',
                        records: [
                            {
                                evaluatedAt: '2026-04-12T00:00:00.000Z',
                                passRatePct: 82,
                            },
                        ],
                        summary: {
                            totalRecords: 20,
                            returnedRecords: 12,
                            overallPassRatePct: 80.4,
                            returnedPassRatePct: 82,
                            consecutiveFailureCount: 1,
                            averageBudgetDeviationActions: 1.3,
                            latestEvaluatedAt: '2026-04-12T00:00:00.000Z',
                            commonFailedGates: [
                                {
                                    gateId: 'evidence_coverage',
                                    count: 3,
                                },
                            ],
                        },
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/runtime-capability-runbook/verify')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:00:00.000Z',
                        requestedCheckId: '',
                        focusMode: 'recommended',
                        autoFocusApplied: true,
                        autoFocusReason: 'dynamic_mode_alignment_conflict',
                        autoFocusRecommendedCheckId: 'tutor_routing_dynamic_mode_alignment',
                        selectedCheckId: 'tutor_routing_dynamic_mode_alignment',
                        effectiveCheckId: 'tutor_routing_dynamic_mode_alignment',
                        selectedCheckStatus: 'warn',
                        selectedCheckPriorityScore: 92,
                        selectedCheckMessage: 'Preferred mode diverges from recent provider diagnostics.',
                        topRiskCheckId: 'orchestration_path_strategy_alignment',
                        topRiskStatus: 'warn',
                        traceSummary: {
                            returnedRecords: 20,
                            errorRequests: 2,
                            errorRatioPct: 10,
                            transientReturnedRatioPct: 15,
                            averageDurationMs: 52,
                            p95DurationMs: 118,
                            pathPrefix: '/api/knowledge',
                            statusAtLeast: 400,
                            method: 'GET',
                            errorCode: '',
                        },
                        verificationTargets: [
                            'Verify preferred mode and strategy alignment trend over last 24h.',
                        ],
                        selectedCheckHistory: {
                            checkId: 'tutor_routing_dynamic_mode_alignment',
                            sinceMinutes: 1440,
                            returnedRecords: 12,
                            activeRiskStreak: 3,
                            activeFailStreak: 0,
                            trendStatus: 'regressing',
                        },
                        selectedCheckRemediation: {
                            checkId: 'tutor_routing_dynamic_mode_alignment',
                            riskRatioPct: 41.67,
                        },
                        queryVectorAccelerationIndexSyncHealth: {
                            checkId: 'query_vector_acceleration_index_sync_health',
                            indexSyncStatus: 'ready',
                            indexSyncMessage: 'external_http_index_synced:idx_sync_ok:atoms=128',
                            syncRequestCount: 3,
                            syncSuccessCount: 3,
                            syncFailureCount: 0,
                            syncedAtomCount: 128,
                            lastSyncAt: '2026-04-12T00:00:00.000Z',
                        },
                        queryVectorAccelerationCircuitBudget: {
                            checkId: 'query_vector_acceleration_circuit_state',
                            healthStatus: 'degraded',
                            circuitState: 'half_open',
                            shortCircuitRatioPct: 12.5,
                            budgetStatus: 'warn',
                            warnBudgetExceeded: true,
                            failBudgetExceeded: false,
                            budget: {
                                warn: {
                                    shortCircuitCountLt: 3,
                                    shortCircuitRatioPctLt: 10,
                                    consecutiveFailuresLt: 2,
                                    halfOpenSuccessRatePctGte: 60,
                                },
                                fail: {
                                    shortCircuitCountLt: 5,
                                    shortCircuitRatioPctLt: 20,
                                    consecutiveFailuresLt: 4,
                                    halfOpenSuccessRatePctGte: 40,
                                },
                            },
                        },
                        queryVectorAccelerationTraceability: {
                            checkId: 'query_vector_acceleration_traceability',
                            correlationCoverage: 'partial',
                            missingFields: ['lastErrorCode'],
                            lastRequestId: 'connector-req-42',
                            requestCount: 12,
                            consecutiveFailures: 1,
                            shortCircuitCount: 2,
                        },
                        queryVectorAccelerationPrefilter: {
                            checkId: 'query_vector_acceleration_prefilter_effectiveness',
                            selectionMode: 'token_signature_prefilter',
                            candidateRatioPct: 24.5,
                            budgetStatus: 'ok',
                            fullScanFallback: false,
                            warnBudgetExceeded: false,
                            failBudgetExceeded: false,
                            budget: {
                                minRequestSampleGte: 8,
                                warnCandidateRatioPctLt: 35,
                                failCandidateRatioPctLt: 60,
                            },
                        },
                        selectedCheckEscalation: 'watch',
                        selectedCheckEscalationActions: [
                            'Update preferred mode to auto and verify provider trend convergence.',
                        ],
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/runtime-capability-runbook/history/checks')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        summary: {
                            totalRecords: 36,
                            matchedRecords: 12,
                            returnedChecks: 8,
                            sinceMinutes: 10080,
                            status: '',
                            checkQuery: '',
                            regressingChecks: 3,
                            improvingChecks: 2,
                            stableChecks: 2,
                            insufficientDataChecks: 1,
                            recommendedFocusCheckId: 'tutor_routing_dynamic_mode_alignment',
                            recommendedFocusEscalation: 'watch',
                            recommendedFocusReason: 'dynamic mode alignment keeps regressing.',
                            recommendedFocusTopAction: 'Align dynamic mode routing with provider diagnostics.',
                            actionQueueTotal: 6,
                            actionQueueP0: 2,
                            actionQueueP1: 3,
                            actionQueueP2: 1,
                            remediationRiskRatioPct: 41.67,
                            remediationLatestRecordedAt: '2026-04-12T00:00:00.000Z',
                            queryVectorAccelerationIndexSyncHealthStatus: 'ready',
                            queryVectorAccelerationIndexSyncRequestCount: 3,
                            queryVectorAccelerationIndexSyncSuccessCount: 3,
                            queryVectorAccelerationIndexSyncFailureCount: 0,
                            queryVectorAccelerationCircuitBudget: {
                                checkId: 'query_vector_acceleration_circuit_state',
                                circuitState: 'closed',
                                shortCircuitRatioPct: 4.5,
                                budgetStatus: 'ok',
                                budget: {
                                    warn: {
                                        shortCircuitCountLt: 2,
                                        shortCircuitRatioPctLt: 8,
                                        consecutiveFailuresLt: 1,
                                        halfOpenSuccessRatePctGte: 70,
                                    },
                                    fail: {
                                        shortCircuitCountLt: 4,
                                        shortCircuitRatioPctLt: 15,
                                        consecutiveFailuresLt: 3,
                                        halfOpenSuccessRatePctGte: 50,
                                    },
                                },
                            },
                            queryVectorAccelerationTraceability: {
                                checkId: 'query_vector_acceleration_traceability',
                                correlationCoverage: 'full',
                                missingFields: [],
                                requestCount: 18,
                                consecutiveFailures: 0,
                                shortCircuitCount: 0,
                            },
                            queryVectorAccelerationPrefilter: {
                                checkId: 'query_vector_acceleration_prefilter_effectiveness',
                                selectionMode: 'token_signature_prefilter',
                                candidateRatioPct: 18.2,
                                budgetStatus: 'ok',
                                budget: {
                                    minRequestSampleGte: 10,
                                    warnCandidateRatioPctLt: 25,
                                    failCandidateRatioPctLt: 50,
                                },
                            },
                        },
                        checks: [
                            {
                                checkId: 'query_vector_acceleration_index_sync_health',
                                latestStatus: 'pass',
                                trendStatus: 'stable',
                                queryVectorAccelerationIndexSyncHealth: {
                                    checkId: 'query_vector_acceleration_index_sync_health',
                                    indexSyncStatus: 'ready',
                                    indexSyncMessage: 'external_http_index_synced:idx_sync_ok:atoms=128',
                                    syncRequestCount: 3,
                                    syncSuccessCount: 3,
                                    syncFailureCount: 0,
                                    syncedAtomCount: 128,
                                    lastSyncAt: '2026-04-12T00:00:00.000Z',
                                },
                            },
                        ],
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/runtime-capability-runbook/history/action-queue')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        summary: {
                            totalQueueItems: 16,
                            filteredQueueItems: 9,
                            returnedQueueItems: 9,
                            queueP0: 4,
                            queueP1: 3,
                            queueP2: 2,
                            remediationRiskQueueItems: 5,
                            remediationRegressingQueueItems: 2,
                            remediationAverageRiskRatioPct: 46.25,
                            queueLimit: 9,
                            priorityFilter: 'p0',
                            categoryFilter: 'routing',
                            remediationStatusFilter: 'error',
                            remediationTrendFilter: 'regressing',
                            recommendedFocusCheckId: 'query_vector_acceleration_index_sync_health',
                            recommendedFocusEscalation: 'watch',
                        },
                        actionQueue: [
                            {
                                checkId: 'query_vector_acceleration_index_sync_health',
                                actionId: 'inspect_ann_index_sync_telemetry',
                                priority: 'p0',
                                category: 'evidence',
                                remediationLatestStatus: 'error',
                                remediationTrendStatus: 'regressing',
                                instruction: 'Inspect ANN sync telemetry and attach one diagnostics snapshot.',
                                endpointHint: '/api/knowledge/query-backend-diagnostics',
                                automationHint: 'inspect_ann_index_sync_telemetry',
                            },
                        ],
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/runtime-capability-runbook/history')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        summary: {
                            totalRecords: 36,
                            matchedRecords: 12,
                            returnedRecords: 10,
                            checkId: 'tutor_routing_dynamic_mode_alignment',
                            sinceMinutes: 10080,
                            status: '',
                            statusCounts: {
                                pass: 3,
                                warn: 6,
                                fail: 1,
                                unknown: 0,
                            },
                            activeRiskStreak: 2,
                            activeFailStreak: 0,
                            averageErrorRatioPct: 7.25,
                            averageP95DurationMs: 104.5,
                            latestVerifiedAt: '2026-04-12T00:00:00.000Z',
                            trendStatus: 'stable',
                            trendWindowSize: 2,
                            severityDelta: 0.4,
                            errorRatioDeltaPct: -1.2,
                            p95DurationDeltaMs: -6.5,
                        },
                        records: [],
                    },
                }),
            };
        }
        return {
            ok: true,
            text: async () => JSON.stringify({
                success: true,
                result: {
                    masteryPaths: [
                        { atomId: 'atom_paths', title: 'Learning Paths' },
                    ],
                    recommendedActions: [
                        { atomId: 'atom_review', title: 'Review Evidence' },
                    ],
                },
            }),
        };
    });
    const pathApp = {
        init: jest.fn(),
        applyRemoteConfigure: jest.fn(),
        triggerUpdate: jest.fn(),
    };
    const graphView = {
        resolveNodeById: jest.fn((id: string) => ({ id, label: `Node ${id}` })),
        openFocusModeById: jest.fn(),
        getFocusNode: jest.fn(() => null),
    };

    sandbox.fetch = fetchMock;
    sandbox.window.fetch = fetchMock;
    sandbox.window.pathApp = pathApp;
    sandbox.window.NoteConnectionGraphView = graphView;
    sandbox.window.NoteConnectionRuntime = {
        buildUrl(endpoint: string) {
            return endpoint;
        },
        buildFetchOptions(init: Record<string, unknown>) {
            return init;
        },
    };

    loadScriptIntoSandbox(sandbox, workspaceScriptPath, 'workspace_panes.js');
    loadScriptIntoSandbox(sandbox, agentScriptPath, 'agent_workspace.js');
    dispatchDomReady(dom.window.document);

    return {
        controller: sandbox.window.NoteConnectionWorkspacePanes,
        document: dom.window.document,
        window: dom.window,
        fetchMock,
        pathApp,
        graphView,
    };
}

describe('workspace panes controller', () => {
    test('supports parallel graph-focus and learning-path panes with exclusive workspace promotion state', () => {
        const { controller, document } = loadWorkspacePanesHarness();
        controller.init();

        controller.openGraphFocusPane({
            atomId: 'atom_retrieval',
            title: 'Retrieval Foundations',
            summary: 'Evidence-first retrieval keeps answers grounded.',
        });
        controller.openLearningPathPane({
            atomId: 'atom_paths',
            title: 'Learning Paths',
            items: [
                { atomId: 'atom_paths', title: 'Learning Paths' },
            ],
        });

        const graphPane = document.getElementById('agent-graph-focus-pane');
        const learningPane = document.getElementById('agent-learning-path-pane');
        expect(graphPane?.getAttribute('data-open')).toBe('true');
        expect(learningPane?.getAttribute('data-open')).toBe('true');
        expect(document.body.getAttribute('data-agent-workspace-layout')).toBe('split');

        controller.setPaneFullscreen('graph-focus', true);
        expect(graphPane?.getAttribute('data-fullscreen')).toBe('true');
        expect(learningPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(document.body.getAttribute('data-agent-workspace-promotion')).toBe('graph-focus');

        controller.setPaneFullscreen('learning-path', true);
        expect(graphPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(learningPane?.getAttribute('data-fullscreen')).toBe('true');
        expect(document.body.getAttribute('data-agent-workspace-promotion')).toBe('learning-path');

        controller.setPaneFullscreen('learning-path', false);
        expect(graphPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(learningPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(document.body.hasAttribute('data-agent-workspace-promotion')).toBe(false);
    });

    test('mounts the existing path workspace into the learning-path pane and restores it on clear', () => {
        const { controller, document } = loadWorkspacePanesHarness();
        controller.init();

        const pathContainer = document.getElementById('path-container');
        const originalParent = pathContainer?.parentElement;
        expect(pathContainer).not.toBeNull();
        expect(originalParent).not.toBeNull();

        controller.openLearningPathPane({
            atomId: 'atom_paths',
            title: 'Learning Paths',
            items: [],
        });

        const learningPaneBody = document.getElementById('agent-learning-path-body');
        expect(learningPaneBody?.querySelector('#path-container')).not.toBeNull();
        expect(pathContainer?.style.display).toBe('block');

        controller.clearLearningPathPane();

        expect(originalParent?.querySelector('#path-container')).not.toBeNull();
        expect(pathContainer?.style.display).toBe('none');
    });

    test('rerenders existing knowledge-card action labels when language changes', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        controller.init();
        controller.renderKnowledgePoints([
            {
                atomId: 'atom_paths',
                title: 'Learning Paths',
                summary: 'summary',
                capabilities: [
                    {
                        capabilityId: 'cap_focus_atom_paths',
                        actionId: 'open_focus_mode',
                        targetAtomId: 'atom_paths',
                        label: 'Focus',
                        labelKey: 'agentWorkspace.actions.focus',
                        execution: {
                            kind: 'local_focus_mode',
                        },
                    },
                    {
                        capabilityId: 'cap_learning_path_atom_paths',
                        actionId: 'open_learning_path',
                        targetAtomId: 'atom_paths',
                        label: 'Learning Path',
                        labelKey: 'agentWorkspace.actions.learningPath',
                        execution: {
                            kind: 'knowledge_operation',
                            operationId: 'build_learning_path',
                            resultPresentation: 'learning_path_pane',
                        },
                    },
                ],
            },
        ], {
            onCapability: jest.fn(),
        });

        const buttonsBefore = Array.from(
            document.querySelectorAll('.agent-knowledge-actions button')
        ).map((node) => node.textContent);
        expect(buttonsBefore).toEqual(['Focus', 'Learning Path']);

        await window.i18n.setLanguage('zh');

        const buttonsAfter = Array.from(
            document.querySelectorAll('.agent-knowledge-actions button')
        ).map((node) => node.textContent);
        expect(buttonsAfter).toEqual(['聚焦', '学习路径']);
    });

    test('keeps conversation card append kinds aligned with rerender registry', () => {
        const repoRoot = path.resolve(__dirname, '..');
        const source = fs.readFileSync(
            path.join(repoRoot, 'src', 'frontend', 'workspace_panes.js'),
            'utf8'
        );

        const registryMatch = source.match(
            /const CONVERSATION_CARD_RENDERERS = Object\.freeze\(\{([\s\S]*?)\}\);/
        );
        expect(registryMatch).not.toBeNull();
        const registrySection = String(registryMatch && registryMatch[1] || '');
        const registryKinds = Array.from(
            registrySection.matchAll(/'([^']+)'\s*:\s*render[A-Za-z0-9_]+/g)
        ).map((match) => String(match[1] || '').trim()).filter(Boolean);

        const appendKinds = Array.from(
            source.matchAll(/setAttribute\('data-agent-workspace-card-kind',\s*'([^']+)'\)/g)
        ).map((match) => String(match[1] || '').trim()).filter(Boolean);

        const uniqueSorted = (values: string[]) =>
            Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

        expect(uniqueSorted(registryKinds)).toEqual(uniqueSorted(appendKinds));
    });

    test('ignores legacy action fields when typed capabilities are missing', () => {
        const { controller, document } = loadWorkspacePanesHarness({ withI18n: true });
        controller.init();
        controller.renderKnowledgePoints([
            {
                atomId: 'atom_paths',
                title: 'Learning Paths',
                summary: 'summary',
                availableActions: [
                    'generate_transfer',
                    'generate_counterexample',
                    'follow_up',
                    'compare_query_backends',
                    'inspect_query_backend_comparison_history',
                    'inspect_query_backend_comparison_trend',
                    'inspect_learning_quality_trend',
                    'inspect_learning_quality_history',
                    'inspect_session_plan_quality_trend',
                    'inspect_session_plan_quality_history',
                    'inspect_session_history',
                ],
            },
        ], {
            onCapability: jest.fn(),
        });

        const actionButtons = Array.from(
            document.querySelectorAll('.agent-knowledge-actions button')
        );
        expect(actionButtons.length).toBe(0);
    });

    test('renders actions only for cards with typed capabilities when mixed with legacy fields', () => {
        const { controller, document } = loadWorkspacePanesHarness({ withI18n: true });
        controller.init();

        controller.renderKnowledgePoints([
            {
                atomId: 'atom_paths',
                title: 'Learning Paths',
                summary: 'summary',
                availableActions: ['open_focus_mode'],
            },
            {
                atomId: 'atom_with_typed',
                title: 'Typed Capability Item',
                summary: 'summary',
                capabilities: [
                    {
                        capabilityId: 'cap_focus_atom_with_typed',
                        actionId: 'open_focus_mode',
                        targetAtomId: 'atom_with_typed',
                        label: 'Focus',
                        labelKey: 'agentWorkspace.actions.focus',
                        execution: {
                            kind: 'local_focus_mode',
                        },
                    },
                ],
            },
        ], {
            onCapability: jest.fn(),
        });

        const cards = Array.from(document.querySelectorAll('.agent-knowledge-card'));
        expect(cards.length).toBe(2);

        const firstCardButtons = cards[0]?.querySelectorAll('.agent-knowledge-actions button') || [];
        const secondCardButtons = cards[1]?.querySelectorAll('.agent-knowledge-actions button') || [];
        expect(firstCardButtons.length).toBe(0);
        expect(secondCardButtons.length).toBe(1);
        expect((secondCardButtons[0] as HTMLButtonElement).textContent).toBe('Focus');
    });
});

describe('agent workspace learning-path integration', () => {
    test('exposes capability operation/presentation registry diagnostics', () => {
        const { window } = loadAgentWorkspaceHarness();
        const diagnostics = (window as any).NoteConnectionAgentWorkspace.getCapabilityRegistryDiagnostics();

        expect(Array.isArray(diagnostics.operations)).toBe(true);
        expect(Array.isArray(diagnostics.operationTransports)).toBe(true);
        expect(Array.isArray(diagnostics.operationRequestBuilders)).toBe(true);
        expect(Array.isArray(diagnostics.operationResultPresentationOverrides)).toBe(true);
        expect(typeof diagnostics.operationResultPresentationOverrideMap).toBe('object');
        expect(typeof diagnostics.operationInvalidResultPresentationOverrideMap).toBe('object');
        expect(typeof diagnostics.operationUnknownResultPresentationOverrideMap).toBe('object');
        expect(typeof diagnostics.operationResultPresentationOverrideDriftDetected).toBe('boolean');
        expect(typeof diagnostics.operationResultPresentationInvalidOverrideTokenCount).toBe('number');
        expect(typeof diagnostics.operationResultPresentationUnknownOverrideTokenCount).toBe('number');
        expect(typeof diagnostics.operationDefaultResultPresentations).toBe('object');
        expect(typeof diagnostics.operationAllowedResultPresentations).toBe('object');
        expect(Array.isArray(diagnostics.resultPresentations)).toBe(true);
        expect(Array.isArray(diagnostics.customResultPresentations)).toBe(true);
        expect(Array.isArray(diagnostics.cardResultPresentations)).toBe(true);
        expect(Array.isArray(diagnostics.resultPresentationPayloadBuilders)).toBe(true);
        expect(Array.isArray(diagnostics.executionKinds)).toBe(true);
        expect(Array.isArray(diagnostics.legacyActionFallbacks)).toBe(true);
        expect(diagnostics.operations).toContain('build_learning_path');
        expect(diagnostics.operations).toContain('search_conversation_memory');
        expect(diagnostics.operations).toContain('fetch_conversation_turn_cache_diagnostics');
        expect(diagnostics.operations).toContain('fetch_conversation_turn_cache_alert_trend');
        expect(diagnostics.operations).toContain('fetch_conversation_turn_cache_alert_trend_index');
        expect(diagnostics.operations).toContain('fetch_conversation_turn_cache_alert_trend_export');
        expect(diagnostics.operations).toContain('execute_tutor_action');
        expect(diagnostics.operations).toContain('fetch_query_backend_diagnostics');
        expect(diagnostics.operations).toContain('fetch_tutor_adapter_telemetry');
        expect(diagnostics.operations).toContain('fetch_tutor_trace_diagnostics');
        expect(diagnostics.operations).toContain('evaluate_learning_quality_baseline');
        expect(diagnostics.operations).toContain('verify_runtime_capability_runbook');
        expect(diagnostics.operations).toContain('fetch_runtime_capability_runbook_history');
        expect(diagnostics.operations).toContain('fetch_runtime_capability_runbook_checks');
        expect(diagnostics.operations).toContain('fetch_runtime_capability_runbook_action_queue');
        expect(diagnostics.operationTransports).toContain('build_learning_path');
        expect(diagnostics.operationTransports).toContain('search_conversation_memory');
        expect(diagnostics.operationTransports).toContain('fetch_conversation_turn_cache_diagnostics');
        expect(diagnostics.operationTransports).toContain('fetch_conversation_turn_cache_alert_trend');
        expect(diagnostics.operationTransports).toContain('fetch_conversation_turn_cache_alert_trend_index');
        expect(diagnostics.operationTransports).toContain('fetch_conversation_turn_cache_alert_trend_export');
        expect(diagnostics.operationTransports).toContain('execute_tutor_action');
        expect(diagnostics.operationTransports).toContain('fetch_query_backend_diagnostics');
        expect(diagnostics.operationTransports).toContain('fetch_tutor_adapter_telemetry');
        expect(diagnostics.operationTransports).toContain('fetch_tutor_trace_diagnostics');
        expect(diagnostics.operationTransports).toContain('evaluate_learning_quality_baseline');
        expect(diagnostics.operationTransports).toContain('verify_runtime_capability_runbook');
        expect(diagnostics.operationTransports).toContain('fetch_runtime_capability_runbook_history');
        expect(diagnostics.operationTransports).toContain('fetch_runtime_capability_runbook_checks');
        expect(diagnostics.operationTransports).toContain('fetch_runtime_capability_runbook_action_queue');
        expect(diagnostics.operationRequestBuilders).toContain('build_learning_path');
        expect(diagnostics.operationRequestBuilders).toContain('search_conversation_memory');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_conversation_turn_cache_diagnostics');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_conversation_turn_cache_alert_trend');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_conversation_turn_cache_alert_trend_index');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_conversation_turn_cache_alert_trend_export');
        expect(diagnostics.operationRequestBuilders).toContain('execute_tutor_action');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_query_backend_diagnostics');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_tutor_adapter_telemetry');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_tutor_trace_diagnostics');
        expect(diagnostics.operationRequestBuilders).toContain('evaluate_learning_quality_baseline');
        expect(diagnostics.operationRequestBuilders).toContain('verify_runtime_capability_runbook');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_runtime_capability_runbook_history');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_runtime_capability_runbook_checks');
        expect(diagnostics.operationRequestBuilders).toContain('fetch_runtime_capability_runbook_action_queue');
        expect(diagnostics.operationResultPresentationOverrides).toContain('execute_tutor_action');
        expect(diagnostics.operationResultPresentationOverrideMap.execute_tutor_action).toEqual(
            ['tutor_action_card']
        );
        expect(diagnostics.operationInvalidResultPresentationOverrideMap).toEqual({});
        expect(diagnostics.operationUnknownResultPresentationOverrideMap).toEqual({});
        expect(diagnostics.operationResultPresentationOverrideDriftDetected).toBe(false);
        expect(diagnostics.operationResultPresentationInvalidOverrideTokenCount).toBe(0);
        expect(diagnostics.operationResultPresentationUnknownOverrideTokenCount).toBe(0);
        expect(diagnostics.operationDefaultResultPresentations.execute_tutor_action).toBe('assistant_message');
        expect(diagnostics.operationAllowedResultPresentations.execute_tutor_action).toEqual(
            expect.arrayContaining(['assistant_message', 'tutor_action_card'])
        );
        expect(diagnostics.operationAllowedResultPresentations.build_study_session).toEqual(['study_session_card']);
        expect(new Set(diagnostics.operationResultPresentationOverrides)).toEqual(
            new Set(Object.keys(diagnostics.operationResultPresentationOverrideMap))
        );
        expect(new Set(Object.keys(diagnostics.operationDefaultResultPresentations))).toEqual(
            new Set(diagnostics.operations)
        );
        expect(new Set(Object.keys(diagnostics.operationAllowedResultPresentations))).toEqual(
            new Set(diagnostics.operations)
        );
        expect(new Set(Object.keys(diagnostics.operationUnknownResultPresentationOverrideMap))).toEqual(
            new Set<string>()
        );
        diagnostics.operations.forEach((operationId: string) => {
            const defaultPresentation = String(
                diagnostics.operationDefaultResultPresentations[operationId] || ''
            ).trim();
            const allowedPresentations = Array.isArray(
                diagnostics.operationAllowedResultPresentations[operationId]
            )
                ? diagnostics.operationAllowedResultPresentations[operationId]
                : [];
            const overridePresentations = Array.isArray(
                diagnostics.operationResultPresentationOverrideMap[operationId]
            )
                ? diagnostics.operationResultPresentationOverrideMap[operationId]
                : [];
            expect(defaultPresentation).toBeTruthy();
            expect(allowedPresentations).toContain(defaultPresentation);
            expect(new Set(allowedPresentations).size).toBe(allowedPresentations.length);
            overridePresentations.forEach((presentation: string) => {
                expect(allowedPresentations).toContain(presentation);
            });
            allowedPresentations.forEach((presentation: string) => {
                if (presentation !== defaultPresentation) {
                    expect(overridePresentations).toContain(presentation);
                }
            });
        });
        Object.keys(diagnostics.operationResultPresentationOverrideMap).forEach((operationId) => {
            expect(diagnostics.operations).toContain(operationId);
        });
        Object.keys(diagnostics.operationInvalidResultPresentationOverrideMap).forEach((operationId) => {
            expect(diagnostics.operations).toContain(operationId);
        });
        expect(new Set(diagnostics.operationTransports)).toEqual(new Set(diagnostics.operationRequestBuilders));
        expect(diagnostics.resultPresentations).toContain('learning_path_pane');
        expect(diagnostics.resultPresentations).toContain('tutor_action_card');
        expect(diagnostics.resultPresentations).toContain('conversation_turn_cache_diagnostics_card');
        expect(diagnostics.resultPresentations).toContain('conversation_turn_cache_alert_trend_card');
        expect(diagnostics.resultPresentations).toContain('query_backend_diagnostics_card');
        expect(diagnostics.resultPresentations).toContain('tutor_adapter_telemetry_card');
        expect(diagnostics.resultPresentations).toContain('tutor_trace_diagnostics_card');
        expect(diagnostics.resultPresentations).toContain('learning_quality_baseline_evaluation_card');
        expect(diagnostics.resultPresentations).toContain('runtime_capability_runbook_verify_card');
        expect(diagnostics.resultPresentations).toContain('runtime_capability_runbook_history_card');
        expect(diagnostics.resultPresentations).toContain('runtime_capability_runbook_checks_card');
        expect(diagnostics.resultPresentations).toContain('runtime_capability_runbook_action_queue_card');
        expect(diagnostics.customResultPresentations).toContain('learning_path_pane');
        expect(diagnostics.customResultPresentations).toContain('assistant_message');
        expect(diagnostics.cardResultPresentations).toContain('tutor_action_card');
        expect(diagnostics.cardResultPresentations).toContain('conversation_turn_cache_diagnostics_card');
        expect(diagnostics.cardResultPresentations).toContain('conversation_turn_cache_alert_trend_card');
        expect(diagnostics.cardResultPresentations).toContain('query_backend_diagnostics_card');
        expect(diagnostics.cardResultPresentations).toContain('tutor_adapter_telemetry_card');
        expect(diagnostics.cardResultPresentations).toContain('tutor_trace_diagnostics_card');
        expect(diagnostics.cardResultPresentations).toContain('learning_quality_baseline_evaluation_card');
        expect(diagnostics.cardResultPresentations).toContain('runtime_capability_runbook_verify_card');
        expect(diagnostics.cardResultPresentations).toContain('runtime_capability_runbook_history_card');
        expect(diagnostics.cardResultPresentations).toContain('runtime_capability_runbook_checks_card');
        expect(diagnostics.cardResultPresentations).toContain('runtime_capability_runbook_action_queue_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('tutor_action_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('conversation_turn_cache_diagnostics_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('conversation_turn_cache_alert_trend_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('query_backend_diagnostics_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('tutor_adapter_telemetry_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('tutor_trace_diagnostics_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('learning_quality_baseline_evaluation_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('runtime_capability_runbook_verify_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('runtime_capability_runbook_history_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('runtime_capability_runbook_checks_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('runtime_capability_runbook_action_queue_card');
        expect(new Set(diagnostics.resultPresentations)).toEqual(
            new Set([
                ...diagnostics.customResultPresentations,
                ...diagnostics.cardResultPresentations,
            ])
        );
        expect(new Set(diagnostics.cardResultPresentations)).toEqual(
            new Set(diagnostics.resultPresentationPayloadBuilders)
        );
        expect(diagnostics.executionKinds).toContain('knowledge_operation');
        expect(diagnostics.executionKinds).toContain('local_focus_mode');
        expect(diagnostics.legacyActionFallbacks).toEqual([]);
    });

    test('prefers SSE turn streaming for conversation and renders the completed turn payload', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();
        if (!fetchMock) {
            throw new Error('expected fetch mock');
        }

        fetchMock.mockImplementationOnce(async () => createSseResponse([
            {
                event: 'turn_started',
                payload: {
                    type: 'turn_started',
                    turnId: 'turn_stream_1',
                    emittedAt: '2026-04-13T00:00:00.000Z',
                    request: {
                        userId: 'path_user_default',
                        topK: 6,
                    },
                },
            },
            {
                event: 'capability_progress',
                payload: {
                    type: 'capability_progress',
                    turnId: 'turn_stream_1',
                    emittedAt: '2026-04-13T00:00:00.100Z',
                    stage: 'query_local_knowledge',
                    progressPct: 35,
                },
            },
            {
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_stream_1',
                    emittedAt: '2026-04-13T00:00:00.300Z',
                    result: {
                        assistantMessage: 'streamed assistant response',
                        knowledgePoints: [
                            {
                                atomId: 'atom_stream',
                                title: 'Stream Node',
                                summary: 'Stream summary',
                                evidenceSnippet: 'Stream evidence',
                                score: 0.9,
                                capabilities: [
                                    {
                                        capabilityId: 'cap_focus_atom_stream',
                                        actionId: 'open_focus_mode',
                                        targetAtomId: 'atom_stream',
                                        label: 'Focus',
                                        labelKey: 'agentWorkspace.actions.focus',
                                        execution: {
                                            kind: 'local_focus_mode',
                                        },
                                    },
                                ],
                            },
                        ],
                        summary: {
                            generatedAt: '2026-04-13T00:00:00.300Z',
                            topK: 6,
                            returnedKnowledgePoints: 1,
                            queryEvidenceCoverageRatioPct: 75,
                        },
                    },
                },
            },
        ], { chunkSize: 29 }));

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'focus node';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const fetchCall = fetchMock.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/conversation');
        const requestInit = fetchCall?.[1] || {};
        const requestHeaders = requestInit.headers || {};
        expect(String(requestHeaders.Accept || '')).toBe('text/event-stream');
        expect(String(requestHeaders['X-Agent-Conversation-Turn-Id'] || '')).toMatch(/^turn_client_/);

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('streamed assistant response'))
        ).toBe(true);
        const knowledgeCards = Array.from(document.querySelectorAll('.agent-knowledge-card'));
        expect(knowledgeCards.length).toBeGreaterThan(0);
        expect(String(knowledgeCards[0]?.textContent || '')).toContain('Stream Node');
    });

    test('falls back to sync conversation request when streamed turn payload is incomplete', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();
        if (!fetchMock) {
            throw new Error('expected fetch mock');
        }

        fetchMock.mockImplementationOnce(async () => createSseResponse([
            {
                event: 'turn_started',
                payload: {
                    type: 'turn_started',
                    turnId: 'turn_stream_incomplete',
                    emittedAt: '2026-04-13T00:00:00.000Z',
                    request: {
                        userId: 'path_user_default',
                        topK: 6,
                    },
                },
            },
        ]));
        fetchMock.mockImplementationOnce(async () => createJsonResponse({
            assistantMessage: 'sync fallback response',
            knowledgePoints: [],
            summary: {
                generatedAt: '2026-04-13T00:00:01.000Z',
                topK: 6,
                returnedKnowledgePoints: 0,
                queryEvidenceCoverageRatioPct: 0,
            },
        }));

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'focus node';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
        const firstCall = fetchMock.mock.calls[0];
        const secondCall = fetchMock.mock.calls[1];
        expect(firstCall?.[0]).toBe('/api/knowledge/conversation');
        expect(secondCall?.[0]).toBe('/api/knowledge/conversation');
        const firstHeaders = firstCall?.[1]?.headers || {};
        const secondHeaders = secondCall?.[1]?.headers || {};
        expect(String(firstHeaders.Accept || '')).toBe('text/event-stream');
        expect(String(secondHeaders.Accept || '')).toBe('');
        const firstTurnId = String(firstHeaders['X-Agent-Conversation-Turn-Id'] || '');
        const secondTurnId = String(secondHeaders['X-Agent-Conversation-Turn-Id'] || '');
        expect(firstTurnId).toMatch(/^turn_client_/);
        expect(secondTurnId).toBe('turn_stream_incomplete');
        expect(String(secondHeaders['X-Agent-Conversation-Resume-Turn-Id'] || '')).toBe(secondTurnId);

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('sync fallback response'))
        ).toBe(true);
    });

    test('reuses the existing pathApp runtime for learning-path pane actions', async () => {
        const {
            document,
            window,
            fetchMock,
            pathApp,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.openLearningPath({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        });

        expect(fetchMock).toHaveBeenCalledWith('/api/knowledge/path', expect.objectContaining({
            method: 'POST',
        }));
        expect(pathApp?.init).toHaveBeenCalledWith('atom_paths');
        expect(pathApp?.applyRemoteConfigure).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'diffusion',
            targetId: 'atom_paths',
            targetIds: ['atom_paths'],
        }));
        expect(pathApp?.triggerUpdate).toHaveBeenCalled();
        expect(document.getElementById('agent-learning-path-body')?.querySelector('#path-container')).not.toBeNull();
    });

    test('prefers typed capability request payloads over hardcoded learning-path defaults', async () => {
        const {
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.openLearningPath({
            atomId: 'atom_paths',
            title: 'Learning Paths',
            capabilities: [
                {
                    capabilityId: 'cap_path_atom_paths',
                    actionId: 'open_learning_path',
                    targetAtomId: 'atom_paths',
                    label: 'Learning Path',
                    labelKey: 'agentWorkspace.actions.learningPath',
                    request: {
                        focusAtomIds: ['atom_paths'],
                        maxMasteryPaths: 7,
                        maxDivergencePaths: 1,
                        recommendedActionLimit: 5,
                    },
                },
            ],
        }, {
            capabilityId: 'cap_path_atom_paths',
            actionId: 'open_learning_path',
            targetAtomId: 'atom_paths',
            label: 'Learning Path',
            labelKey: 'agentWorkspace.actions.learningPath',
            request: {
                focusAtomIds: ['atom_paths'],
                maxMasteryPaths: 7,
                maxDivergencePaths: 1,
                recommendedActionLimit: 5,
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/path');
        const init = fetchCall?.[1] || {};
        const requestBody = JSON.parse(String(init.body || '{}'));
        expect(requestBody.focusAtomIds).toEqual(['atom_paths']);
        expect(requestBody.maxMasteryPaths).toBe(7);
        expect(requestBody.maxDivergencePaths).toBe(1);
        expect(requestBody.recommendedActionLimit).toBe(5);
    });

    test('executes tutor quiz capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_quiz_atom_paths',
            actionId: 'generate_quiz',
            targetAtomId: 'atom_paths',
            label: 'Quiz',
            labelKey: 'agentWorkspace.actions.quiz',
            request: {
                actionKind: 'generate_quiz',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'execute_tutor_action',
                resultPresentation: 'tutor_action_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.tutorActionFailed',
                fallbackMessage: 'Tutor action failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/tutor/action');
        const init = fetchCall?.[1] || {};
        const requestBody = JSON.parse(String(init.body || '{}'));
        expect(requestBody.userId).toBe('path_user_default');
        expect(requestBody.atomId).toBe('atom_paths');
        expect(requestBody.actionKind).toBe('generate_quiz');

        const card = document.querySelector('[data-agent-workspace-card-kind="tutor-action"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Quiz Prompt');
        expect(card?.textContent).toContain('Question: Explain Learning Paths in your own words.');
        expect(card?.textContent).toContain('Evidence');
        expect(card?.textContent).toContain('Learning paths sequence concepts into prerequisite-aware progression.');
    });

    test('executes tutor recap capabilities through assistant-message presentation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_recap_atom_paths',
            actionId: 'recap',
            targetAtomId: 'atom_paths',
            label: 'Recap',
            labelKey: 'agentWorkspace.actions.recap',
            request: {
                actionKind: 'recap',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'execute_tutor_action',
                resultPresentation: 'assistant_message',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.tutorActionFailed',
                fallbackMessage: 'Tutor action failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/tutor/action');
        const init = fetchCall?.[1] || {};
        const requestBody = JSON.parse(String(init.body || '{}'));
        expect(requestBody.userId).toBe('path_user_default');
        expect(requestBody.atomId).toBe('atom_paths');
        expect(requestBody.actionKind).toBe('recap');

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => (
                message.includes('Recap for "Learning Paths":')
                && message.includes('Key evidence: Learning paths sequence concepts.')
            ))
        ).toBe(true);
        expect(document.querySelector('[data-agent-workspace-card-kind="tutor-action"]')).toBeNull();
    });

    test('falls back to operation default presentation when capability omits resultPresentation', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_recap_atom_paths_default_presentation',
            actionId: 'recap',
            targetAtomId: 'atom_paths',
            label: 'Recap',
            labelKey: 'agentWorkspace.actions.recap',
            request: {
                actionKind: 'recap',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'execute_tutor_action',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.tutorActionFailed',
                fallbackMessage: 'Tutor action failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/tutor/action');
        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => (
                message.includes('Recap for "Learning Paths":')
                && message.includes('Key evidence: Learning paths sequence concepts.')
            ))
        ).toBe(true);
        expect(document.querySelector('[data-agent-workspace-card-kind="tutor-action"]')).toBeNull();
    });

    test('fails fast when capability result presentation is unsupported', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_atom_paths_unsupported_presentation',
            actionId: 'build_study_session',
            targetAtomId: 'atom_paths',
            label: 'Study Session',
            labelKey: 'agentWorkspace.actions.studySession',
            request: {
                focusAtomIds: ['atom_paths'],
                maxActions: 4,
                pathRecommendedActionLimit: 6,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'build_study_session',
                resultPresentation: 'unknown_card_kind',
            },
            failure: {
                fallbackMessage: 'Study session planning failed: {error}',
            },
        });

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => (
                message.includes('Unsupported result presentation unknown_card_kind for operation build_study_session')
                && message.includes('allowed: study_session_card')
            ))
        ).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('fails fast when result presentation is union-valid but not allowlisted for operation', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_history_atom_paths_mismatched_result_presentation',
            actionId: 'inspect_session_history',
            targetAtomId: 'atom_paths',
            label: 'Session History',
            labelKey: 'agentWorkspace.actions.sessionHistory',
            request: {
                historyLimit: 10,
                sinceMinutes: 10080,
                refreshSource: 'manual',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_session_history',
                resultPresentation: 'study_session_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.sessionHistoryFailed',
                fallbackMessage: 'Session history fetch failed: {error}',
            },
        });

        expect(fetchMock).not.toHaveBeenCalled();
        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => (
                message.includes('Unsupported result presentation study_session_card for operation fetch_session_history')
                && message.includes('allowed: session_history_card')
            ))
        ).toBe(true);
        expect(document.querySelector('[data-agent-workspace-card-kind="study-session"]')).toBeNull();
        expect(document.querySelector('[data-agent-workspace-card-kind="session-history"]')).toBeNull();
    });

    test('fails fast when capability execution kind is unsupported', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_atom_paths_unsupported_execution_kind',
            actionId: 'build_study_session',
            targetAtomId: 'atom_paths',
            label: 'Study Session',
            labelKey: 'agentWorkspace.actions.studySession',
            request: {
                focusAtomIds: ['atom_paths'],
                maxActions: 4,
            },
            execution: {
                kind: 'unknown_execution_kind',
                operationId: 'build_study_session',
                resultPresentation: 'study_session_card',
            },
            failure: {
                fallbackMessage: 'Study session planning failed: {error}',
            },
        });

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('Unsupported capability execution kind: unknown_execution_kind'))
        ).toBe(true);
    });

    test('fails fast when capability execution metadata is missing', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_unknown_action_atom_paths',
            actionId: 'unsupported_action_kind',
            targetAtomId: 'atom_paths',
            label: 'Unknown Action',
            labelKey: 'agentWorkspace.actions.studySession',
        });

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('Unsupported capability execution kind: missing_execution'))
        ).toBe(true);
    });

    test('executes tutor transfer capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_transfer_atom_paths',
            actionId: 'generate_transfer',
            targetAtomId: 'atom_paths',
            label: 'Transfer Challenge',
            labelKey: 'agentWorkspace.actions.transfer',
            request: {
                actionKind: 'generate_transfer',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'execute_tutor_action',
                resultPresentation: 'tutor_action_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.tutorActionFailed',
                fallbackMessage: 'Tutor action failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/tutor/action');
        const init = fetchCall?.[1] || {};
        const requestBody = JSON.parse(String(init.body || '{}'));
        expect(requestBody.userId).toBe('path_user_default');
        expect(requestBody.atomId).toBe('atom_paths');
        expect(requestBody.actionKind).toBe('generate_transfer');

        const card = document.querySelector('[data-agent-workspace-card-kind="tutor-action"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Transfer Challenge');
        expect(card?.textContent).toContain('apply \"Learning Paths\" to \"Retrieval Foundations\"');
    });

    test('executes conversation-memory inspection capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
            summary: 'Sequence prerequisite-aware concepts.',
            evidenceSnippet: 'Focus Node evidence and retrieval path.',
        }, {
            capabilityId: 'cap_conversation_memory_atom_paths',
            actionId: 'inspect_conversation_memory',
            targetAtomId: 'atom_paths',
            label: 'Conversation Memory',
            labelKey: 'agentWorkspace.actions.conversationMemory',
            request: {
                memoryNamespace: 'conversation',
                memoryQuery: 'focus evidence',
                memoryLimit: 6,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'search_conversation_memory',
                resultPresentation: 'assistant_message',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.conversationMemorySearchFailed',
                fallbackMessage: 'Conversation memory search failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/conversation-memory/search');
        const init = fetchCall?.[1] || {};
        const requestBody = JSON.parse(String(init.body || '{}'));
        expect(requestBody.userId).toBe('path_user_default');
        expect(requestBody.namespace).toBe('conversation');
        expect(requestBody.query).toBe('focus evidence');
        expect(requestBody.limit).toBe(6);

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('Conversation memory recall (1/1)'))
        ).toBe(true);
    });

    test('executes conversation turn-cache diagnostics capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_conversation_turn_cache_diagnostics_atom_paths',
            actionId: 'inspect_conversation_turn_cache_diagnostics',
            targetAtomId: 'atom_paths',
            label: 'Turn Cache',
            labelKey: 'agentWorkspace.actions.conversationTurnCacheDiagnostics',
            request: {
                turnCachePrune: true,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_conversation_turn_cache_diagnostics',
                resultPresentation: 'conversation_turn_cache_diagnostics_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.conversationTurnCacheDiagnosticsFailed',
                fallbackMessage: 'Conversation turn-cache diagnostics fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/conversation/turn-cache/diagnostics');
        expect(String(fetchCall?.[0] || '')).toContain('prune=1');

        const card = document.querySelector('[data-agent-workspace-card-kind="conversation-turn-cache-diagnostics"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Conversation Turn-Cache Diagnostics');
        expect(card?.textContent).toContain('Key Metrics');
        expect(card?.textContent).toContain('Alert summary (status/fail/warn/active)');
        expect(card?.textContent).toContain('Threshold profile (warn/fail)');
        expect(card?.textContent).toContain('util=70/90% | failRatio=5/20% | conflict=2/3 | stale=4/8');
        expect(card?.textContent).toContain('Cache hits/misses/hit ratio');
    });

    test('executes conversation turn-cache alert trend capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_conversation_turn_cache_alert_trend_atom_paths',
            actionId: 'inspect_conversation_turn_cache_alert_trend',
            targetAtomId: 'atom_paths',
            label: 'Turn Cache Trend',
            labelKey: 'agentWorkspace.actions.conversationTurnCacheAlertTrend',
            request: {
                turnCacheTrendLimit: 24,
                turnCacheTrendWindowSize: 12,
                turnCacheTrendMinSamples: 6,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_conversation_turn_cache_alert_trend',
                resultPresentation: 'conversation_turn_cache_alert_trend_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.conversationTurnCacheAlertTrendFailed',
                fallbackMessage: 'Conversation turn-cache alert trend fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/conversation/turn-cache/diagnostics/trend');
        expect(String(fetchCall?.[0] || '')).toContain('limit=24');
        expect(String(fetchCall?.[0] || '')).toContain('windowSize=12');
        expect(String(fetchCall?.[0] || '')).toContain('minSamples=6');

        const card = document.querySelector('[data-agent-workspace-card-kind="conversation-turn-cache-alert-trend"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Conversation Turn-Cache Alert Trend');
        expect(card?.textContent).toContain('Key Metrics');
        expect(card?.textContent).toContain('Status counts (pass/warn/fail)');
        expect(card?.textContent).toContain('Drilldown endpoints (index/export)');
        expect(card?.textContent).toContain('/api/knowledge/conversation/turn-cache/diagnostics/trend/index');
        expect(card?.textContent).toContain('regressing');
    });

    test('executes conversation turn-cache alert trend index capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_conversation_turn_cache_alert_trend_index_atom_paths',
            actionId: 'inspect_conversation_turn_cache_alert_trend_index',
            targetAtomId: 'atom_paths',
            label: 'Trend Index',
            labelKey: 'agentWorkspace.actions.conversationTurnCacheAlertTrendIndex',
            request: {
                turnCacheTrendLimit: 12,
                turnCacheTrendWindowSize: 6,
                turnCacheTrendMinSamples: 3,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_conversation_turn_cache_alert_trend_index',
                resultPresentation: 'conversation_turn_cache_alert_trend_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.conversationTurnCacheAlertTrendFailed',
                fallbackMessage: 'Conversation turn-cache alert trend fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/conversation/turn-cache/diagnostics/trend/index');
        expect(String(fetchCall?.[0] || '')).toContain('limit=12');
        expect(String(fetchCall?.[0] || '')).toContain('windowSize=6');
        expect(String(fetchCall?.[0] || '')).toContain('minSamples=3');

        const card = document.querySelector('[data-agent-workspace-card-kind="conversation-turn-cache-alert-trend"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Conversation Turn-Cache Alert Trend');
    });

    test('executes conversation turn-cache alert trend export capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_conversation_turn_cache_alert_trend_export_atom_paths',
            actionId: 'inspect_conversation_turn_cache_alert_trend_export',
            targetAtomId: 'atom_paths',
            label: 'Trend Export',
            labelKey: 'agentWorkspace.actions.conversationTurnCacheAlertTrendExport',
            request: {
                turnCacheTrendLimit: 16,
                turnCacheTrendWindowSize: 8,
                turnCacheTrendMinSamples: 4,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_conversation_turn_cache_alert_trend_export',
                resultPresentation: 'conversation_turn_cache_alert_trend_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.conversationTurnCacheAlertTrendFailed',
                fallbackMessage: 'Conversation turn-cache alert trend fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/conversation/turn-cache/diagnostics/trend/export');
        expect(String(fetchCall?.[0] || '')).toContain('limit=16');
        expect(String(fetchCall?.[0] || '')).toContain('windowSize=8');
        expect(String(fetchCall?.[0] || '')).toContain('minSamples=4');

        const card = document.querySelector('[data-agent-workspace-card-kind="conversation-turn-cache-alert-trend"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Conversation Turn-Cache Alert Trend');
    });

    test('executes query-backend comparison capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_compare_query_backends_atom_paths',
            actionId: 'compare_query_backends',
            targetAtomId: 'atom_paths',
            label: 'Compare Backends',
            labelKey: 'agentWorkspace.actions.compareQueryBackends',
            request: {
                query: 'Learning Paths retrieval',
                topK: 6,
                leftBackend: 'local_hybrid',
                rightBackend: 'keyword_only',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'compare_query_backends',
                resultPresentation: 'query_backend_comparison_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.queryBackendComparisonFailed',
                fallbackMessage: 'Query backend comparison failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/query/compare-backends');
        const init = fetchCall?.[1] || {};
        const requestBody = JSON.parse(String(init.body || '{}'));
        expect(requestBody.query).toBe('Learning Paths retrieval');
        expect(requestBody.topK).toBe(6);
        expect(requestBody.leftBackend).toBe('local_hybrid');
        expect(requestBody.rightBackend).toBe('keyword_only');

        const card = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Backend Comparison');
        expect(card?.textContent).toContain('Key Metrics');
        expect(card?.textContent).toContain('Overlap ratio');
    });

    test('executes query-backend comparison history capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_compare_query_backends_history_atom_paths',
            actionId: 'inspect_query_backend_comparison_history',
            targetAtomId: 'atom_paths',
            label: 'Comparison History',
            labelKey: 'agentWorkspace.actions.queryBackendComparisonHistory',
            request: {
                comparisonHistoryLimit: 8,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_query_backend_comparison_history',
                resultPresentation: 'query_backend_comparison_history_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.queryBackendComparisonHistoryFailed',
                fallbackMessage: 'Query backend comparison history fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/query/compare-backends/history');
        expect(String(fetchCall?.[0] || '')).toContain('limit=8');

        const card = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison-history"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Backend Comparison History');
        expect(card?.textContent).toContain('Key Metrics');
    });

    test('executes query-backend comparison trend capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_compare_query_backends_trend_atom_paths',
            actionId: 'inspect_query_backend_comparison_trend',
            targetAtomId: 'atom_paths',
            label: 'Comparison Trend',
            labelKey: 'agentWorkspace.actions.queryBackendComparisonTrend',
            request: {
                trendLimit: 12,
                trendWindowSize: 2,
                trendMinSamples: 1,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_query_backend_comparison_trend',
                resultPresentation: 'query_backend_comparison_trend_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.queryBackendComparisonTrendFailed',
                fallbackMessage: 'Query backend comparison trend fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/query/compare-backends/trend');
        expect(String(fetchCall?.[0] || '')).toContain('limit=12');
        expect(String(fetchCall?.[0] || '')).toContain('windowSize=2');
        expect(String(fetchCall?.[0] || '')).toContain('minSamples=1');

        const card = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison-trend"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Backend Comparison Trend');
        expect(card?.textContent).toContain('Key Metrics');
    });

    test('executes query-backend diagnostics capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_query_backend_diagnostics_atom_paths',
            actionId: 'inspect_query_backend_diagnostics',
            targetAtomId: 'atom_paths',
            label: 'Backend Diagnostics',
            labelKey: 'agentWorkspace.actions.queryBackendDiagnostics',
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_query_backend_diagnostics',
                resultPresentation: 'query_backend_diagnostics_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.queryBackendDiagnosticsFailed',
                fallbackMessage: 'Query backend diagnostics fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/query-backend-diagnostics');

        const card = document.querySelector('[data-agent-workspace-card-kind="query-backend-diagnostics"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Query Backend Diagnostics');
        expect(card?.textContent).toContain('Key Metrics');
        expect(card?.textContent).toContain('Graphviz runtime');
        expect(card?.textContent).toContain('unavailable');
        expect(card?.textContent).toContain("binary 'dot' is unavailable");
        expect(card?.textContent).toContain('Graphviz probe freshness');
        expect(card?.textContent).toContain('stale');
        expect(card?.querySelector('.agent-chat-card-list-meta.status-chip.status-unavailable')).not.toBeNull();
        expect(card?.querySelector('.agent-chat-card-list-meta.status-chip.status-stale')).not.toBeNull();
        const metrics = extractCardMetrics(card);
        expect(metrics['Rollout profile mode']).toBe('mixed');
        expect(metrics['Configured acceleration provider']).toBe('external_http');
        expect(metrics['Configured acceleration failure mode']).toBe('fail_open');
        expect(metrics['Configured acceleration representation strict mode']).toBe('enabled');
        expect(metrics['ANN prefilter rollout']).toBe('enabled');
    });

    test('classifies graphviz probe freshness as warn when probe age is between ttl and 2x ttl', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();
        const nowMs = Date.now();
        fetchMock?.mockImplementation(async (url: string) => {
            if (String(url).startsWith('/api/knowledge/query-backend-diagnostics')) {
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        success: true,
                        result: {
                            backendId: 'graph_query_backend_local_hybrid',
                            configuredBackend: 'local_hybrid',
                            fallbackCount: 2,
                            fallbackBackendId: 'graph_query_backend_keyword_only',
                            lastError: 'transient_timeout',
                            comparisonTelemetry: {
                                totalComparisons: 18,
                                leftPreferredCount: 11,
                                rightPreferredCount: 5,
                                tieCount: 2,
                                averageOverlapRatioPct: 74.5,
                                averageLatencyDeltaMs: -2.8,
                                lastComparedAt: '2026-04-12T00:00:00.000Z',
                            },
                            runtime: {
                                backendId: 'graph_query_backend_local_hybrid',
                                ready: true,
                                lastError: '',
                                vectorIndex: {
                                    enabled: true,
                                    status: 'ready',
                                    atomCount: 128,
                                    acceleration: {
                                        enabled: true,
                                        mode: 'ann_prefilter',
                                        lastSelectionMode: 'token_signature_prefilter',
                                        healthStatus: 'ready',
                                        circuitState: 'closed',
                                    },
                                },
                            },
                            rendererRuntime: {
                                graphviz: {
                                    backendPngRuntimeAvailable: true,
                                    dotBinary: 'dot',
                                    reason: 'ok',
                                    checkedAtMs: nowMs - 45000,
                                    probeCacheTtlMs: 30000,
                                },
                            },
                        },
                    }),
                } as any;
            }
            return {
                ok: false,
                text: async () => JSON.stringify({
                    success: false,
                    error: `Unhandled fetch in warn freshness test: ${String(url)}`,
                }),
            } as any;
        });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_query_backend_diagnostics_atom_paths',
            actionId: 'inspect_query_backend_diagnostics',
            targetAtomId: 'atom_paths',
            label: 'Backend Diagnostics',
            labelKey: 'agentWorkspace.actions.queryBackendDiagnostics',
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_query_backend_diagnostics',
                resultPresentation: 'query_backend_diagnostics_card',
            },
        });

        const card = document.querySelector('[data-agent-workspace-card-kind="query-backend-diagnostics"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Graphviz probe freshness');
        expect(card?.textContent).toContain('warn');
        expect(card?.querySelector('.agent-chat-card-list-meta.status-chip.status-warn')).not.toBeNull();
        expect(card?.querySelector('.agent-chat-card-list-meta.status-chip.status-available')).not.toBeNull();
    });

    test('executes tutor adapter telemetry capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_tutor_adapter_telemetry_atom_paths',
            actionId: 'inspect_tutor_adapter_telemetry',
            targetAtomId: 'atom_paths',
            label: 'Tutor Telemetry',
            labelKey: 'agentWorkspace.actions.tutorAdapterTelemetry',
            request: {
                tutorTelemetryAdapterLimit: 1,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_tutor_adapter_telemetry',
                resultPresentation: 'tutor_adapter_telemetry_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.tutorAdapterTelemetryFailed',
                fallbackMessage: 'Tutor adapter telemetry fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/tutor/telemetry');

        const card = document.querySelector('[data-agent-workspace-card-kind="tutor-adapter-telemetry"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Tutor Adapter Telemetry');
        expect(card?.textContent).toContain('Top adapter');
    });

    test('executes tutor trace diagnostics capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_tutor_trace_diagnostics_atom_paths',
            actionId: 'inspect_tutor_trace_diagnostics',
            targetAtomId: 'atom_paths',
            label: 'Tutor Trace',
            labelKey: 'agentWorkspace.actions.tutorTraceDiagnostics',
            request: {
                tutorTraceLimit: 7,
                tutorTraceSource: 'rule_engine',
                tutorTraceActionKind: 'generate_quiz',
                tutorTraceProviderName: 'cloud_llm',
                tutorTraceProviderMode: 'cloud',
                tutorTraceFallbackUsed: true,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_tutor_trace_diagnostics',
                resultPresentation: 'tutor_trace_diagnostics_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.tutorTraceDiagnosticsFailed',
                fallbackMessage: 'Tutor trace diagnostics fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/tutor/trace-diagnostics');
        expect(String(fetchCall?.[0] || '')).toContain('userId=path_user_default');
        expect(String(fetchCall?.[0] || '')).toContain('source=rule-engine');
        expect(String(fetchCall?.[0] || '')).toContain('actionKind=generate_quiz');
        expect(String(fetchCall?.[0] || '')).toContain('providerName=cloud_llm');
        expect(String(fetchCall?.[0] || '')).toContain('providerMode=cloud');
        expect(String(fetchCall?.[0] || '')).toContain('fallbackUsed=true');
        expect(String(fetchCall?.[0] || '')).toContain('limit=7');

        const card = document.querySelector('[data-agent-workspace-card-kind="tutor-trace-diagnostics"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Tutor Trace Diagnostics');
        expect(card?.textContent).toContain('Top provider');
    });

    test('executes learning-quality trend capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_learning_quality_trend_atom_paths',
            actionId: 'inspect_learning_quality_trend',
            targetAtomId: 'atom_paths',
            label: 'Learning Trend',
            labelKey: 'agentWorkspace.actions.learningQualityTrend',
            request: {
                learningTrendLimit: 14,
                learningTrendWindowSize: 2,
                learningTrendMinSamples: 1,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_learning_quality_trend',
                resultPresentation: 'learning_quality_trend_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.learningQualityTrendFailed',
                fallbackMessage: 'Learning quality trend fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/quality/trend');
        expect(String(fetchCall?.[0] || '')).toContain('userId=path_user_default');
        expect(String(fetchCall?.[0] || '')).toContain('limit=14');
        expect(String(fetchCall?.[0] || '')).toContain('windowSize=2');
        expect(String(fetchCall?.[0] || '')).toContain('minSamples=1');

        const card = document.querySelector('[data-agent-workspace-card-kind="learning-quality-trend"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Learning Quality Trend');
        expect(card?.textContent).toContain('Key Metrics');
    });

    test('executes session-plan quality trend capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_plan_quality_trend_atom_paths',
            actionId: 'inspect_session_plan_quality_trend',
            targetAtomId: 'atom_paths',
            label: 'Session Plan Trend',
            labelKey: 'agentWorkspace.actions.sessionPlanQualityTrend',
            request: {
                sessionPlanTrendLimit: 16,
                sessionPlanTrendWindowSize: 3,
                sessionPlanTrendMinSamples: 2,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_session_plan_quality_trend',
                resultPresentation: 'session_plan_quality_trend_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.sessionPlanQualityTrendFailed',
                fallbackMessage: 'Session plan quality trend fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/session/plan/quality/trend');
        expect(String(fetchCall?.[0] || '')).toContain('userId=path_user_default');
        expect(String(fetchCall?.[0] || '')).toContain('limit=16');
        expect(String(fetchCall?.[0] || '')).toContain('windowSize=3');
        expect(String(fetchCall?.[0] || '')).toContain('minSamples=2');

        const card = document.querySelector('[data-agent-workspace-card-kind="session-plan-quality-trend"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Session Plan Quality Trend');
        expect(card?.textContent).toContain('Key Metrics');
    });

    test('executes learning-quality history capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_learning_quality_history_atom_paths',
            actionId: 'inspect_learning_quality_history',
            targetAtomId: 'atom_paths',
            label: 'Learning History',
            labelKey: 'agentWorkspace.actions.learningQualityHistory',
            request: {
                learningHistoryLimit: 9,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_learning_quality_history',
                resultPresentation: 'learning_quality_history_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.learningQualityHistoryFailed',
                fallbackMessage: 'Learning quality history fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/quality/history');
        expect(String(fetchCall?.[0] || '')).toContain('userId=path_user_default');
        expect(String(fetchCall?.[0] || '')).toContain('limit=9');

        const card = document.querySelector('[data-agent-workspace-card-kind="learning-quality-history"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Learning Quality History');
        expect(card?.textContent).toContain('Key Metrics');
    });

    test('executes learning-quality baseline evaluation capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_learning_quality_baseline_evaluation_atom_paths',
            actionId: 'evaluate_learning_quality_baseline',
            targetAtomId: 'atom_paths',
            label: 'Baseline Evaluate',
            labelKey: 'agentWorkspace.actions.learningQualityBaselineEvaluate',
            request: {
                learningBaselineSampledAt: '2026-04-12T00:00:00.000Z',
                learningBaselineHistoryWindowDays: 21,
                currentSnapshot: {
                    retestPassRatePct: 73.5,
                    misconceptionRecurrenceRatePct: 18.2,
                    evidenceBackedSuggestionRatioPct: 80.1,
                    averagePathMasteryGainPct: 15.5,
                    randomPathMasteryGainPct: 11.2,
                    queryP95Ms: 250,
                },
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'evaluate_learning_quality_baseline',
                resultPresentation: 'learning_quality_baseline_evaluation_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.learningQualityBaselineEvaluationFailed',
                fallbackMessage: 'Learning quality baseline evaluation failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/quality/baseline/evaluate');
        const requestPayload = JSON.parse(String(fetchCall?.[1]?.body || '{}'));
        expect(String(requestPayload.userId || '')).toBe('path_user_default');
        expect(String(requestPayload.sampledAt || '')).toBe('2026-04-12T00:00:00.000Z');
        expect(Number(requestPayload.historyWindowDays || 0)).toBe(21);
        expect(Number(requestPayload.current?.retestPassRatePct || 0)).toBe(73.5);

        const card = document.querySelector('[data-agent-workspace-card-kind="learning-quality-baseline-evaluation"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Learning Quality Baseline Evaluation');
        expect(card?.textContent).toContain('Key Metrics');
    });

    test('executes session-plan quality history capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_plan_quality_history_atom_paths',
            actionId: 'inspect_session_plan_quality_history',
            targetAtomId: 'atom_paths',
            label: 'Session Plan History',
            labelKey: 'agentWorkspace.actions.sessionPlanQualityHistory',
            request: {
                sessionPlanHistoryLimit: 11,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_session_plan_quality_history',
                resultPresentation: 'session_plan_quality_history_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.sessionPlanQualityHistoryFailed',
                fallbackMessage: 'Session plan quality history fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/session/plan/quality/history');
        expect(String(fetchCall?.[0] || '')).toContain('userId=path_user_default');
        expect(String(fetchCall?.[0] || '')).toContain('limit=11');

        const card = document.querySelector('[data-agent-workspace-card-kind="session-plan-quality-history"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Session Plan Quality History');
        expect(card?.textContent).toContain('Key Metrics');
    });

    test('executes runtime runbook verify capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_verify_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_verify',
            targetAtomId: 'atom_paths',
            label: 'Runtime Verify',
            labelKey: 'agentWorkspace.actions.runtimeRunbookVerify',
            request: {
                runbookFocus: 'recommended',
                runbookFocusLimit: 9,
                runbookSinceMinutes: 720,
                runbookStatus: 'warn',
                runbookCheckQuery: 'dynamic',
                runbookTraceLimit: 15,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'verify_runtime_capability_runbook',
                resultPresentation: 'runtime_capability_runbook_verify_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.runtimeRunbookVerifyFailed',
                fallbackMessage: 'Runtime capability runbook verify failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/runtime-capability-runbook/verify');
        expect(String(fetchCall?.[0] || '')).toContain('focus=recommended');
        expect(String(fetchCall?.[0] || '')).toContain('focusLimit=9');
        expect(String(fetchCall?.[0] || '')).toContain('sinceMinutes=720');
        expect(String(fetchCall?.[0] || '')).toContain('status=warn');
        expect(String(fetchCall?.[0] || '')).toContain('checkQuery=dynamic');
        expect(String(fetchCall?.[0] || '')).toContain('limit=15');

        const card = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-verify"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Runtime Runbook Verify');
        expect(card?.textContent).toContain('Top risk check');
        expect(card?.textContent).toContain('ANN sync health');
        expect(card?.textContent).toContain('ready');
        expect(card?.textContent).toContain('ANN circuit budget');
        expect(card?.textContent).toContain('half_open');
        expect(card?.textContent).toContain('ANN circuit thresholds');
        expect(card?.textContent).toContain('warn count<3');
        expect(card?.textContent).toContain('ANN traceability');
        expect(card?.textContent).toContain('partial');
        expect(card?.textContent).toContain('ANN traceability signals');
        expect(card?.textContent).toContain('requests 12');
        expect(card?.textContent).toContain('ANN prefilter');
        expect(card?.textContent).toContain('token_signature_prefilter');
        expect(card?.textContent).toContain('ANN prefilter thresholds');
        expect(card?.textContent).toContain('sample>=8');
    });

    test('executes runtime runbook history capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_history_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_history',
            targetAtomId: 'atom_paths',
            label: 'Runtime History',
            labelKey: 'agentWorkspace.actions.runtimeRunbookHistory',
            request: {
                runbookHistoryLimit: 7,
                runbookCheckId: 'tutor_routing_dynamic_mode_alignment',
                runbookSinceMinutes: 4320,
                runbookStatus: 'warn',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_history',
                resultPresentation: 'runtime_capability_runbook_history_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.runtimeRunbookHistoryFailed',
                fallbackMessage: 'Runtime capability runbook history fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/runtime-capability-runbook/history');
        expect(String(fetchCall?.[0] || '')).toContain('limit=7');
        expect(String(fetchCall?.[0] || '')).toContain('checkId=tutor_routing_dynamic_mode_alignment');
        expect(String(fetchCall?.[0] || '')).toContain('sinceMinutes=4320');
        expect(String(fetchCall?.[0] || '')).toContain('status=warn');

        const card = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-history"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Runtime Runbook History');
        expect(card?.textContent).toContain('Status counts');
    });

    test('executes runtime runbook checks capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_checks_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_checks',
            targetAtomId: 'atom_paths',
            label: 'Runtime Checks',
            labelKey: 'agentWorkspace.actions.runtimeRunbookChecks',
            request: {
                runbookChecksLimit: 6,
                runbookSinceMinutes: 2880,
                runbookStatus: 'warn',
                runbookCheckQuery: 'routing',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_checks',
                resultPresentation: 'runtime_capability_runbook_checks_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.runtimeRunbookChecksFailed',
                fallbackMessage: 'Runtime capability runbook checks fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/runtime-capability-runbook/history/checks');
        expect(String(fetchCall?.[0] || '')).toContain('limit=6');
        expect(String(fetchCall?.[0] || '')).toContain('sinceMinutes=2880');
        expect(String(fetchCall?.[0] || '')).toContain('status=warn');
        expect(String(fetchCall?.[0] || '')).toContain('checkQuery=routing');

        const card = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-checks"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Runtime Runbook Checks');
        expect(card?.textContent).toContain('Trend counts');
        expect(card?.textContent).toContain('First check ANN sync');
        expect(card?.textContent).toContain('ready');
        expect(card?.textContent).toContain('ANN circuit snapshot');
        expect(card?.textContent).toContain('closed');
        expect(card?.textContent).toContain('ANN circuit threshold snapshot');
        expect(card?.textContent).toContain('warn count<2');
        expect(card?.textContent).toContain('ANN traceability snapshot');
        expect(card?.textContent).toContain('full');
        expect(card?.textContent).toContain('ANN traceability signal snapshot');
        expect(card?.textContent).toContain('requests 18');
        expect(card?.textContent).toContain('ANN prefilter snapshot');
        expect(card?.textContent).toContain('token_signature_prefilter');
        expect(card?.textContent).toContain('ANN prefilter threshold snapshot');
        expect(card?.textContent).toContain('sample>=10');
    });

    test('renders runtime runbook checks cards when index-sync health telemetry is null', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        expect(fetchMock).toBeDefined();
        fetchMock!.mockImplementationOnce(async () => ({
            ok: true,
            text: async () => JSON.stringify({
                success: true,
                result: {
                    summary: {
                        totalRecords: 1,
                        matchedRecords: 1,
                        returnedChecks: 1,
                        sinceMinutes: 1440,
                        regressingChecks: 0,
                        improvingChecks: 0,
                        stableChecks: 0,
                        insufficientDataChecks: 1,
                        recommendedFocusCheckId: 'query_vector_acceleration_index_sync_health',
                        recommendedFocusEscalation: 'normal',
                        recommendedFocusReason: 'latest_activity',
                        recommendedFocusTopAction: 'Inspect ANN sync telemetry.',
                        actionQueueTotal: 3,
                        actionQueueP0: 0,
                        actionQueueP1: 2,
                        actionQueueP2: 1,
                        remediationRiskRatioPct: 0,
                        remediationLatestRecordedAt: '',
                    },
                    checks: [
                        {
                            checkId: 'query_vector_acceleration_index_sync_health',
                            latestStatus: 'pass',
                            trendStatus: 'insufficient_data',
                            queryVectorAccelerationIndexSyncHealth: null,
                        },
                    ],
                },
            }),
        } as any));

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_checks_null_index_sync_health',
            actionId: 'inspect_runtime_capability_runbook_checks',
            targetAtomId: 'atom_paths',
            label: 'Runtime Checks',
            labelKey: 'agentWorkspace.actions.runtimeRunbookChecks',
            request: {
                runbookChecksLimit: 6,
                runbookSinceMinutes: 1440,
                runbookCheckQuery: 'query_vector_acceleration_index_sync_health',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_checks',
                resultPresentation: 'runtime_capability_runbook_checks_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.runtimeRunbookChecksFailed',
                fallbackMessage: 'Runtime capability runbook checks fetch failed: {error}',
            },
        });

        const card = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-checks"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Runtime Runbook Checks');
        expect(card?.textContent).toContain('First check ANN sync');
        expect(card?.textContent).toContain('none (0/0/0)');
    });

    test('executes runtime runbook action-queue capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_action_queue_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_action_queue',
            targetAtomId: 'atom_paths',
            label: 'Runtime Queue',
            labelKey: 'agentWorkspace.actions.runtimeRunbookActionQueue',
            request: {
                runbookChecksLimit: 5,
                runbookQueueLimit: 9,
                runbookSinceMinutes: 10080,
                runbookStatus: 'fail',
                runbookCheckQuery: 'routing',
                runbookQueuePriority: 'P0',
                runbookQueueCategory: 'Routing',
                runbookCheckId: 'tutor_routing_dynamic_mode_alignment',
                runbookRemediationStatus: 'error',
                runbookRemediationTrend: 'regressing',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_action_queue',
                resultPresentation: 'runtime_capability_runbook_action_queue_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.runtimeRunbookActionQueueFailed',
                fallbackMessage: 'Runtime capability runbook action queue fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/runtime-capability-runbook/history/action-queue');
        expect(String(fetchCall?.[0] || '')).toContain('limit=5');
        expect(String(fetchCall?.[0] || '')).toContain('queueLimit=9');
        expect(String(fetchCall?.[0] || '')).toContain('sinceMinutes=10080');
        expect(String(fetchCall?.[0] || '')).toContain('status=fail');
        expect(String(fetchCall?.[0] || '')).toContain('checkQuery=routing');
        expect(String(fetchCall?.[0] || '')).toContain('priority=p0');
        expect(String(fetchCall?.[0] || '')).toContain('category=routing');
        expect(String(fetchCall?.[0] || '')).toContain('checkId=tutor_routing_dynamic_mode_alignment');
        expect(String(fetchCall?.[0] || '')).toContain('remediationStatus=error');
        expect(String(fetchCall?.[0] || '')).toContain('remediationTrend=regressing');

        const card = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-action-queue"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Runtime Action Queue');
        expect(card?.textContent).toContain('Priority counts');
        expect(card?.textContent).toContain('First item endpoint/automation');
        expect(card?.textContent).toContain('query_vector_acceleration_index_sync_health');
        expect(card?.textContent).toContain('/api/knowledge/query-backend-diagnostics');
    });

    test('renders capability failure message when runtime runbook checks request fails', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        expect(fetchMock).toBeDefined();
        fetchMock!.mockImplementationOnce(async () => ({
            ok: false,
            text: async () => JSON.stringify({
                success: false,
                error: 'checks_endpoint_failed',
            }),
        }));

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_checks_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_checks',
            targetAtomId: 'atom_paths',
            label: 'Runtime Checks',
            labelKey: 'agentWorkspace.actions.runtimeRunbookChecks',
            request: {
                runbookChecksLimit: 8,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_checks',
                resultPresentation: 'runtime_capability_runbook_checks_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.runtimeRunbookChecksFailed',
                fallbackMessage: 'Runtime capability runbook checks fetch failed: {error}',
            },
        });

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('Runtime capability runbook checks fetch failed: checks_endpoint_failed'))
        ).toBe(true);
    });

    test('renders capability failure message when runtime runbook action-queue request fails', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        expect(fetchMock).toBeDefined();
        fetchMock!.mockImplementationOnce(async () => ({
            ok: false,
            text: async () => JSON.stringify({
                success: false,
                error: 'action_queue_endpoint_failed',
            }),
        }));

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_action_queue_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_action_queue',
            targetAtomId: 'atom_paths',
            label: 'Runtime Queue',
            labelKey: 'agentWorkspace.actions.runtimeRunbookActionQueue',
            request: {
                runbookChecksLimit: 8,
                runbookQueueLimit: 12,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_action_queue',
                resultPresentation: 'runtime_capability_runbook_action_queue_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.runtimeRunbookActionQueueFailed',
                fallbackMessage: 'Runtime capability runbook action queue fetch failed: {error}',
            },
        });

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('Runtime capability runbook action queue fetch failed: action_queue_endpoint_failed'))
        ).toBe(true);
    });

    test('renders session-plan quality history cards when commonFailedGates is empty', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        expect(fetchMock).toBeDefined();
        fetchMock!.mockImplementationOnce(async () => ({
            ok: true,
            text: async () => JSON.stringify({
                success: true,
                result: {
                    generatedAt: '2026-04-12T00:00:00.000Z',
                    userId: 'path_user_default',
                    records: [],
                    summary: {
                        totalRecords: 0,
                        returnedRecords: 0,
                        overallPassRatePct: 0,
                        returnedPassRatePct: 0,
                        consecutiveFailureCount: 0,
                        averageBudgetDeviationActions: 0,
                        latestEvaluatedAt: '',
                        commonFailedGates: [],
                    },
                },
            }),
        }));

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_plan_quality_history_atom_paths',
            actionId: 'inspect_session_plan_quality_history',
            targetAtomId: 'atom_paths',
            label: 'Session Plan History',
            labelKey: 'agentWorkspace.actions.sessionPlanQualityHistory',
            request: {
                sessionPlanHistoryLimit: 5,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_session_plan_quality_history',
                resultPresentation: 'session_plan_quality_history_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.sessionPlanQualityHistoryFailed',
                fallbackMessage: 'Session plan quality history fetch failed: {error}',
            },
        });

        const card = document.querySelector('[data-agent-workspace-card-kind="session-plan-quality-history"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Session Plan Quality History');
        expect(card?.textContent).toContain('Top failed gate');
        expect(card?.textContent).toContain('none');
    });

    test('executes session-history capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_history_atom_paths',
            actionId: 'inspect_session_history',
            targetAtomId: 'atom_paths',
            label: 'Session History',
            labelKey: 'agentWorkspace.actions.sessionHistory',
            request: {
                historyLimit: 10,
                sinceMinutes: 10080,
                refreshSource: 'manual',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_session_history',
                resultPresentation: 'session_history_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.sessionHistoryFailed',
                fallbackMessage: 'Session history fetch failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/session/history');
        const init = fetchCall?.[1] || {};
        const requestBody = JSON.parse(String(init.body || '{}'));
        expect(requestBody.userId).toBe('path_user_default');
        expect(requestBody.limit).toBe(10);
        expect(requestBody.sinceMinutes).toBe(10080);
        expect(requestBody.refreshSource).toBe('manual');

        const card = document.querySelector('[data-agent-workspace-card-kind="session-history"]') as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card?.textContent).toContain('Session History');
        expect(card?.textContent).toContain('1 sessions in last 10080 minutes');
        expect(card?.textContent).toContain('Key Metrics');
    });

    test('rerenders tutor-action assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_quiz_atom_paths',
            actionId: 'generate_quiz',
            targetAtomId: 'atom_paths',
            label: 'Quiz',
            labelKey: 'agentWorkspace.actions.quiz',
            request: {
                actionKind: 'generate_quiz',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'execute_tutor_action',
                resultPresentation: 'tutor_action_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="tutor-action"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Quiz Prompt');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="tutor-action"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('测验提示');
        expect(cardAfter?.textContent).toContain('证据');
    });

    test('rerenders session-history assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_history_atom_paths',
            actionId: 'inspect_session_history',
            targetAtomId: 'atom_paths',
            label: 'Session History',
            labelKey: 'agentWorkspace.actions.sessionHistory',
            request: {
                historyLimit: 10,
                sinceMinutes: 10080,
                refreshSource: 'manual',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_session_history',
                resultPresentation: 'session_history_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="session-history"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Session History');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="session-history"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('会话历史');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders query-backend comparison assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_compare_query_backends_atom_paths',
            actionId: 'compare_query_backends',
            targetAtomId: 'atom_paths',
            label: 'Compare Backends',
            labelKey: 'agentWorkspace.actions.compareQueryBackends',
            request: {
                query: 'Learning Paths retrieval',
                topK: 6,
                leftBackend: 'local_hybrid',
                rightBackend: 'keyword_only',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'compare_query_backends',
                resultPresentation: 'query_backend_comparison_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Backend Comparison');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('检索后端对比');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders query-backend diagnostics assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_query_backend_diagnostics_atom_paths',
            actionId: 'inspect_query_backend_diagnostics',
            targetAtomId: 'atom_paths',
            label: 'Backend Diagnostics',
            labelKey: 'agentWorkspace.actions.queryBackendDiagnostics',
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_query_backend_diagnostics',
                resultPresentation: 'query_backend_diagnostics_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="query-backend-diagnostics"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Query Backend Diagnostics');
        expect(cardBefore?.textContent).toContain('Configured acceleration representation strict mode');
        expect(cardBefore?.textContent).toContain('enabled');
        const beforeMetrics = extractCardMetrics(cardBefore);
        expect(beforeMetrics['Rollout profile mode']).toBe('mixed');
        expect(beforeMetrics['Configured acceleration provider']).toBe('external_http');
        expect(beforeMetrics['Configured acceleration failure mode']).toBe('fail_open');
        expect(beforeMetrics['Configured acceleration representation strict mode']).toBe('enabled');
        expect(beforeMetrics['ANN prefilter rollout']).toBe('enabled');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="query-backend-diagnostics"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('检索后端诊断');
        expect(cardAfter?.textContent).toContain('关键指标');
        expect(cardAfter?.textContent).toContain('Graphviz 运行时');
        expect(cardAfter?.textContent).toContain('Graphviz 探测新鲜度');
        expect(cardAfter?.textContent).toContain('发布策略模式');
        expect(cardAfter?.textContent).toContain('加速提供方配置');
        expect(cardAfter?.textContent).toContain('加速失败模式配置');
        expect(cardAfter?.textContent).toContain('加速表示一致性严格模式配置');
        expect(cardAfter?.textContent).toContain('ANN 预筛选发布状态');
        expect(cardAfter?.textContent).toContain('开启');
        expect(cardAfter?.textContent).toContain('过期');
        const afterMetrics = extractCardMetrics(cardAfter);
        expect(afterMetrics['发布策略模式']).toBe('mixed');
        expect(afterMetrics['加速提供方配置']).toBe('external_http');
        expect(afterMetrics['加速失败模式配置']).toBe('fail_open');
        expect(afterMetrics['加速表示一致性严格模式配置']).toBe('开启');
        expect(afterMetrics['ANN 预筛选发布状态']).toBe('开启');
    });

    test('rerenders conversation turn-cache diagnostics assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_conversation_turn_cache_diagnostics_atom_paths',
            actionId: 'inspect_conversation_turn_cache_diagnostics',
            targetAtomId: 'atom_paths',
            label: 'Turn Cache',
            labelKey: 'agentWorkspace.actions.conversationTurnCacheDiagnostics',
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_conversation_turn_cache_diagnostics',
                resultPresentation: 'conversation_turn_cache_diagnostics_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="conversation-turn-cache-diagnostics"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Conversation Turn-Cache Diagnostics');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="conversation-turn-cache-diagnostics"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('对话轮次缓存诊断');
        expect(cardAfter?.textContent).toContain('关键指标');
        expect(cardAfter?.textContent).toContain('告警摘要（状态/失败/警告/激活）');
    });

    test('rerenders conversation turn-cache alert-trend assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_conversation_turn_cache_alert_trend_atom_paths',
            actionId: 'inspect_conversation_turn_cache_alert_trend',
            targetAtomId: 'atom_paths',
            label: 'Turn Cache Trend',
            labelKey: 'agentWorkspace.actions.conversationTurnCacheAlertTrend',
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_conversation_turn_cache_alert_trend',
                resultPresentation: 'conversation_turn_cache_alert_trend_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="conversation-turn-cache-alert-trend"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Conversation Turn-Cache Alert Trend');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="conversation-turn-cache-alert-trend"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('对话轮次缓存告警趋势');
        expect(cardAfter?.textContent).toContain('关键指标');
        expect(cardAfter?.textContent).toContain('升级建议');
    });

    test('rerenders tutor adapter telemetry assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_tutor_adapter_telemetry_atom_paths',
            actionId: 'inspect_tutor_adapter_telemetry',
            targetAtomId: 'atom_paths',
            label: 'Tutor Telemetry',
            labelKey: 'agentWorkspace.actions.tutorAdapterTelemetry',
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_tutor_adapter_telemetry',
                resultPresentation: 'tutor_adapter_telemetry_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="tutor-adapter-telemetry"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Tutor Adapter Telemetry');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="tutor-adapter-telemetry"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('导师适配器遥测');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders tutor trace diagnostics assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_tutor_trace_diagnostics_atom_paths',
            actionId: 'inspect_tutor_trace_diagnostics',
            targetAtomId: 'atom_paths',
            label: 'Tutor Trace',
            labelKey: 'agentWorkspace.actions.tutorTraceDiagnostics',
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_tutor_trace_diagnostics',
                resultPresentation: 'tutor_trace_diagnostics_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="tutor-trace-diagnostics"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Tutor Trace Diagnostics');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="tutor-trace-diagnostics"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('导师追踪诊断');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders query-backend comparison history assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_compare_query_backends_history_atom_paths',
            actionId: 'inspect_query_backend_comparison_history',
            targetAtomId: 'atom_paths',
            label: 'Comparison History',
            labelKey: 'agentWorkspace.actions.queryBackendComparisonHistory',
            request: {
                comparisonHistoryLimit: 8,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_query_backend_comparison_history',
                resultPresentation: 'query_backend_comparison_history_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison-history"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Backend Comparison History');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison-history"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('后端对比历史');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders query-backend comparison trend assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_compare_query_backends_trend_atom_paths',
            actionId: 'inspect_query_backend_comparison_trend',
            targetAtomId: 'atom_paths',
            label: 'Comparison Trend',
            labelKey: 'agentWorkspace.actions.queryBackendComparisonTrend',
            request: {
                trendLimit: 12,
                trendWindowSize: 2,
                trendMinSamples: 1,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_query_backend_comparison_trend',
                resultPresentation: 'query_backend_comparison_trend_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison-trend"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Backend Comparison Trend');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="query-backend-comparison-trend"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('后端对比趋势');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders learning-quality trend assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_learning_quality_trend_atom_paths',
            actionId: 'inspect_learning_quality_trend',
            targetAtomId: 'atom_paths',
            label: 'Learning Trend',
            labelKey: 'agentWorkspace.actions.learningQualityTrend',
            request: {
                learningTrendLimit: 12,
                learningTrendWindowSize: 2,
                learningTrendMinSamples: 1,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_learning_quality_trend',
                resultPresentation: 'learning_quality_trend_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="learning-quality-trend"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Learning Quality Trend');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="learning-quality-trend"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('学习质量趋势');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders session-plan quality trend assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_plan_quality_trend_atom_paths',
            actionId: 'inspect_session_plan_quality_trend',
            targetAtomId: 'atom_paths',
            label: 'Session Plan Trend',
            labelKey: 'agentWorkspace.actions.sessionPlanQualityTrend',
            request: {
                sessionPlanTrendLimit: 12,
                sessionPlanTrendWindowSize: 2,
                sessionPlanTrendMinSamples: 1,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_session_plan_quality_trend',
                resultPresentation: 'session_plan_quality_trend_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="session-plan-quality-trend"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Session Plan Quality Trend');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="session-plan-quality-trend"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('会话计划质量趋势');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders learning-quality history assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_learning_quality_history_atom_paths',
            actionId: 'inspect_learning_quality_history',
            targetAtomId: 'atom_paths',
            label: 'Learning History',
            labelKey: 'agentWorkspace.actions.learningQualityHistory',
            request: {
                learningHistoryLimit: 12,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_learning_quality_history',
                resultPresentation: 'learning_quality_history_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="learning-quality-history"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Learning Quality History');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="learning-quality-history"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('学习质量历史');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders session-plan quality history assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_plan_quality_history_atom_paths',
            actionId: 'inspect_session_plan_quality_history',
            targetAtomId: 'atom_paths',
            label: 'Session Plan History',
            labelKey: 'agentWorkspace.actions.sessionPlanQualityHistory',
            request: {
                sessionPlanHistoryLimit: 12,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_session_plan_quality_history',
                resultPresentation: 'session_plan_quality_history_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="session-plan-quality-history"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Session Plan Quality History');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="session-plan-quality-history"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('会话计划质量历史');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders runtime runbook verify assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_verify_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_verify',
            targetAtomId: 'atom_paths',
            label: 'Runtime Verify',
            labelKey: 'agentWorkspace.actions.runtimeRunbookVerify',
            request: {
                runbookFocus: 'recommended',
                runbookFocusLimit: 12,
                runbookSinceMinutes: 1440,
                runbookTraceLimit: 20,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'verify_runtime_capability_runbook',
                resultPresentation: 'runtime_capability_runbook_verify_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-verify"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Runtime Runbook Verify');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-verify"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('运行时 Runbook 验证');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders runtime runbook history assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_history_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_history',
            targetAtomId: 'atom_paths',
            label: 'Runtime History',
            labelKey: 'agentWorkspace.actions.runtimeRunbookHistory',
            request: {
                runbookHistoryLimit: 12,
                runbookSinceMinutes: 10080,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_history',
                resultPresentation: 'runtime_capability_runbook_history_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-history"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Runtime Runbook History');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-history"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('运行时 Runbook 历史');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders runtime runbook checks assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_checks_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_checks',
            targetAtomId: 'atom_paths',
            label: 'Runtime Checks',
            labelKey: 'agentWorkspace.actions.runtimeRunbookChecks',
            request: {
                runbookChecksLimit: 8,
                runbookSinceMinutes: 10080,
                runbookStatus: 'warn',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_checks',
                resultPresentation: 'runtime_capability_runbook_checks_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-checks"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Runtime Runbook Checks');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-checks"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('运行时 Runbook 检查');
        expect(cardAfter?.textContent).toContain('关键指标');
    });

    test('rerenders runtime runbook action-queue assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_runtime_runbook_action_queue_atom_paths',
            actionId: 'inspect_runtime_capability_runbook_action_queue',
            targetAtomId: 'atom_paths',
            label: 'Runtime Queue',
            labelKey: 'agentWorkspace.actions.runtimeRunbookActionQueue',
            request: {
                runbookChecksLimit: 8,
                runbookQueueLimit: 10,
                runbookSinceMinutes: 10080,
                runbookQueuePriority: 'p0',
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_runtime_capability_runbook_action_queue',
                resultPresentation: 'runtime_capability_runbook_action_queue_card',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-action-queue"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Runtime Action Queue');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="runtime-capability-runbook-action-queue"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('运行时动作队列');
        expect(cardAfter?.textContent).toContain('关键指标');
        expect(cardAfter?.textContent).toContain('query_vector_acceleration_index_sync_health');
        expect(cardAfter?.textContent).toContain('/api/knowledge/query-backend-diagnostics');
    });

    test('executes study-session capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_atom_paths',
            actionId: 'build_study_session',
            targetAtomId: 'atom_paths',
            label: 'Study Session',
            labelKey: 'agentWorkspace.actions.studySession',
            request: {
                focusAtomIds: ['atom_paths'],
                maxActions: 4,
                pathRecommendedActionLimit: 6,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'build_study_session',
                resultPresentation: 'study_session_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.studySessionFailed',
                fallbackMessage: 'Study session planning failed: {error}',
            },
        });

        const fetchCall = fetchMock?.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/session/plan');
        const init = fetchCall?.[1] || {};
        const requestBody = JSON.parse(String(init.body || '{}'));
        expect(requestBody.userId).toBe('path_user_default');
        expect(requestBody.focusAtomIds).toEqual(['atom_paths']);
        expect(requestBody.maxActions).toBe(4);
        expect(requestBody.pathRecommendedActionLimit).toBe(6);

        const studySessionCard = document.querySelector('[data-agent-workspace-card-kind="study-session"]') as HTMLElement | null;
        expect(studySessionCard).not.toBeNull();
        expect(studySessionCard?.textContent).toContain('Study Session Plan');
        expect(studySessionCard?.textContent).toContain('2 actions, about 12 minutes.');
        expect(studySessionCard?.textContent).toContain('quiz');
        expect(studySessionCard?.textContent).toContain('atom_paths');
    });

    test('rerenders study-session assistant cards when language changes', async () => {
        const {
            document,
            window,
        } = loadAgentWorkspaceHarness({ withI18n: true });

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_paths',
            title: 'Learning Paths',
        }, {
            capabilityId: 'cap_session_atom_paths',
            actionId: 'build_study_session',
            targetAtomId: 'atom_paths',
            label: 'Study Session',
            labelKey: 'agentWorkspace.actions.studySession',
            request: {
                focusAtomIds: ['atom_paths'],
                maxActions: 4,
                pathRecommendedActionLimit: 6,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'build_study_session',
                resultPresentation: 'study_session_card',
            },
            failure: {
                messageKey: 'agentWorkspace.messages.studySessionFailed',
                fallbackMessage: 'Study session planning failed: {error}',
            },
        });

        const cardBefore = document.querySelector('[data-agent-workspace-card-kind="study-session"]') as HTMLElement | null;
        expect(cardBefore?.textContent).toContain('Study Session Plan');

        await window.i18n.setLanguage('zh');

        const cardAfter = document.querySelector('[data-agent-workspace-card-kind="study-session"]') as HTMLElement | null;
        expect(cardAfter?.textContent).toContain('学习会话计划');
        expect(cardAfter?.textContent).toContain('2 个动作，约 12 分钟。');
    });

    test('rerenders localized system messages with params when language changes', async () => {
        const { document, window, graphView } = loadAgentWorkspaceHarness({ withI18n: true });
        graphView?.resolveNodeById.mockReturnValue(null);

        (window as any).NoteConnectionAgentWorkspace.openGraphFocus({
            atomId: 'atom_missing',
            title: 'Missing Node',
        });

        const messages = document.querySelectorAll('.agent-chat-message-assistant');
        const latestMessage = messages[messages.length - 1] as HTMLElement;
        expect(latestMessage.textContent).toBe('Local node atom_missing is not currently available in the graph.');

        await window.i18n.setLanguage('zh');

        expect(latestMessage.textContent).toBe('本地图中当前找不到节点 atom_missing。');
    });
});

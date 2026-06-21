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
        resolveNodeByKnowledgePoint?: jest.Mock;
        openFocusModeById: jest.Mock;
        getFocusModeSnapshot?: jest.Mock;
        getFocusNode: jest.Mock;
    };
};

function createI18nStub() {
    const listeners: Array<(lang: string) => void> = [];
    const dictionaries: Record<string, Record<string, string>> = {
        en: {
            'agentWorkspace.actions.focus': 'Focus',
            'agentWorkspace.actions.learningPath': 'Guided Learning',
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
            'agentWorkspace.actions.conversationMemory': 'Scoped Memory',
            'agentWorkspace.actions.conversationTurnCacheDiagnostics': 'Conversation Cache',
            'agentWorkspace.actions.conversationTurnCacheAlertTrend': 'Conversation Cache Trend',
            'agentWorkspace.actions.fullscreen': 'Fullscreen',
            'agentWorkspace.actions.restore': 'Restore',
            'agentWorkspace.messages.ready': 'Knowledge workspace ready. Start with a grounded question, then open focus or guided learning from cited knowledge matches.',
            'agentWorkspace.messages.localNodeUnavailable': 'Local node {nodeId} is not currently available in the graph.',
            'agentWorkspace.messages.groundingSummary': 'Grounding: scope={scopeLabel}, {citationCount} citation(s), {memoryCount} recalled memory note(s), {memoryActionCount} memory action(s). {readinessMessage} {missMessage}',
            'agentWorkspace.evidence.title': 'Evidence Inspector',
            'agentWorkspace.evidence.emptyIdle': 'Evidence pane is idle.',
            'agentWorkspace.evidence.groundingTitle': 'Grounding Inspector',
            'agentWorkspace.evidence.scopeLabel': 'Scope',
            'agentWorkspace.evidence.citationsLabel': 'Citations',
            'agentWorkspace.evidence.memoriesLabel': 'Recalled memories',
            'agentWorkspace.evidence.memoryActionsLabel': 'Memory actions',
            'agentWorkspace.evidence.readinessLabel': 'Workspace readiness',
            'agentWorkspace.evidence.missLabel': 'Scope recovery',
            'agentWorkspace.evidence.graphContextLabel': 'Graph context',
            'agentWorkspace.evidence.graphAnchorLabel': 'Anchor',
            'agentWorkspace.evidence.graphAnchorAtomIdLabel': 'Anchor atom',
            'agentWorkspace.evidence.graphAnchorDocumentLabel': 'Anchor document',
            'agentWorkspace.evidence.graphRelationKindsLabel': 'Relation kinds',
            'agentWorkspace.evidence.graphSupportingTitlesLabel': 'Supporting titles',
            'agentWorkspace.evidence.graphSupportingAtomsLabel': 'Supporting atoms',
            'agentWorkspace.evidence.graphRelationSummariesLabel': 'Relation summaries',
            'agentWorkspace.evidence.graphKnowledgePointRelationsLabel': 'Knowledge-point relations',
            'agentWorkspace.evidence.graphConnectionPathsLabel': 'Connection paths',
            'agentWorkspace.evidence.graphConnectionPathLengthLabel': 'Length: {length}',
            'agentWorkspace.evidence.graphPredecessorsLabel': 'Immediate predecessors',
            'agentWorkspace.evidence.graphSuccessorsLabel': 'Immediate successors',
            'agentWorkspace.evidence.graphEvidenceRefsLabel': 'Source references',
            'agentWorkspace.evidence.graphRelationTargetsLabel': 'Targets: {count}',
            'agentWorkspace.evidence.graphRelationSourcesLabel': 'Sources: {sources}',
            'agentWorkspace.evidence.graphRelationConfidenceLabel': 'Avg confidence: {confidence}',
            'agentWorkspace.evidence.graphTemporalLabel': 'Temporal validity',
            'agentWorkspace.evidence.graphTemporalStatusLabel': 'Status',
            'agentWorkspace.evidence.graphTemporalCheckedAtLabel': 'Checked at',
            'agentWorkspace.evidence.graphTemporalReasonsLabel': 'Warning reasons',
            'agentWorkspace.evidence.graphTemporalInvalidTitlesLabel': 'Invalid knowledge points',
            'agentWorkspace.evidence.graphTemporalEdgeKindsLabel': 'Temporal edge kinds',
            'agentWorkspace.evidence.graphTemporalDetailsLabel': 'Temporal edge details',
            'agentWorkspace.evidence.graphDiagnosticsLabel': 'Graph diagnostics',
            'agentWorkspace.evidence.graphDiagnosticsOpsLabel': 'Graph ops',
            'agentWorkspace.evidence.graphDiagnosticsAvailableLabel': 'available',
            'agentWorkspace.evidence.graphDiagnosticsUnavailableLabel': 'unavailable',
            'agentWorkspace.evidence.graphDiagnosticsFallbackLabel': 'Fallback',
            'agentWorkspace.evidence.graphDiagnosticsAnchorReasonLabel': 'Anchor reason',
            'agentWorkspace.evidence.graphDiagnosticsCandidateCountLabel': 'Candidates',
            'agentWorkspace.evidence.graphDiagnosticsSupportCountLabel': 'Support nodes',
            'agentWorkspace.evidence.graphDiagnosticsBudgetLabel': 'Path depth budget',
            'agentWorkspace.evidence.graphDiagnosticsMissingLookupsLabel': 'Missing graph lookups',
            'agentWorkspace.evidence.graphTemporalValid': 'valid',
            'agentWorkspace.evidence.graphTemporalWarning': 'warning',
            'agentWorkspace.graphFocus.relationMapTitle': 'Relation focus',
            'agentWorkspace.graphFocus.relationAnchorNode': 'Anchor',
            'agentWorkspace.graphFocus.relationEdgesUnavailable': 'No bounded relation edges were returned for this hit.',
            'agentWorkspace.knowledge.citation': 'Citation',
            'agentWorkspace.knowledge.score': 'Score',
            'agentWorkspace.knowledge.togglePreview': 'Toggle matched knowledge preview: {file}',
            'agentWorkspace.knowledge.clickHint': 'Left-click a matched file to open the source with highlighted evidence. Use Learning Path for sequence guidance or Related Focus for citation links.',
            'agentWorkspace.knowledge.previewLoading': 'Loading source preview...',
            'agentWorkspace.knowledge.previewUnavailable': 'Source preview unavailable.',
            'agentWorkspace.knowledge.openFile': 'Open matched knowledge point: {file}',
            'agentWorkspace.knowledge.learningPathAction': 'Learning Path',
            'agentWorkspace.knowledge.learningPathActionLabel': 'Show learning path for {file}',
            'agentWorkspace.knowledge.relatedFocusAction': 'Related Focus',
            'agentWorkspace.knowledge.relatedFocusActionLabel': 'Show citation focus for {file}',
            'agentWorkspace.knowledge.actionsMenu': 'Knowledge point actions',
            'agentWorkspace.reply.flashcardBatch.cardTitle': 'Review Card Batch',
            'agentWorkspace.reply.flashcardBatch.summary': '{returnedArtifacts} artifact(s), {remainingCards}/{totalCards} review card(s) remaining.',
            'agentWorkspace.reply.flashcardBatch.metricsHeading': 'Key Metrics',
            'agentWorkspace.reply.flashcardBatch.artifactKindsLabel': 'Artifact kinds',
            'agentWorkspace.reply.flashcardBatch.topPromptLabel': 'Top prompt',
            'agentWorkspace.reply.flashcardBatch.topEvidenceLabel': 'Top evidence',
            'agentWorkspace.reply.flashcardBatch.completedLabel': 'Completed cards',
            'agentWorkspace.reply.flashcardBatch.remainingLabel': 'Remaining cards',
            'agentWorkspace.reply.flashcardBatch.statusLabel': 'Artifact status',
            'agentWorkspace.reply.flashcardBatch.statusActive': 'active',
            'agentWorkspace.reply.flashcardBatch.statusArchived': 'archived',
            'agentWorkspace.reply.flashcardBatch.reviewNow': 'Review Now',
            'agentWorkspace.reply.flashcardBatch.none': 'none',
            'agentWorkspace.reply.structuredAnswer': 'Grounded Answer',
            'agentWorkspace.reply.knowledgeRunInspectRun': 'Inspect Run',
            'agentWorkspace.reply.knowledgeRunCardTitle': 'Knowledge Run Details',
            'agentWorkspace.reply.knowledgeRunCardSummary': 'Run {runId}: {claimCount} claims, quality {qualityStatus}/{qualityScore}.',
            'agentWorkspace.reply.knowledgeRunCardSummaryNoScore': 'Run {runId}: {claimCount} claims, quality {qualityStatus}.',
            'agentWorkspace.reply.knowledgeRunMetricsHeading': 'Key Metrics',
            'agentWorkspace.reply.knowledgeRunQualityGatesLabel': 'Quality gates',
            'agentWorkspace.reply.knowledgeRunScopeLabel': 'Scope',
            'agentWorkspace.reply.knowledgeRunScopeSourceLabel': 'Scope source',
            'agentWorkspace.reply.knowledgeRunArtifactStatusLabel': 'Artifact status',
            'agentWorkspace.reply.knowledgeRunTopClaimSourceLabel': 'Top claim source',
            'agentWorkspace.reply.knowledgeRunReviewProgressLabel': 'Review progress',
            'agentWorkspace.reply.knowledgeRunInspectEvidence': 'Inspect Evidence',
            'agentWorkspace.reply.knowledgeRunBrowseRuns': 'Recent Runs',
            'agentWorkspace.reply.answerReleaseReviewHeading': 'Answer release review',
            'agentWorkspace.reply.answerReleaseReviewGatesLabel': 'Release gates',
            'agentWorkspace.reply.answerReleaseDecisionLabel': 'Decision',
            'agentWorkspace.reply.answerReleaseReviewedAtLabel': 'Reviewed at',
            'agentWorkspace.reply.answerReleaseRevisedLabel': 'Revised',
            'agentWorkspace.reply.answerReleaseFailedGatesLabel': 'Failed gates',
            'agentWorkspace.reply.answerReleaseLeakedFragmentsLabel': 'Leaked fragments',
            'agentWorkspace.reply.answerReleaseReasonLabel': 'Reason',
            'agentWorkspace.reply.answerReleaseOriginalAnswerLabel': 'Original answer',
            'agentWorkspace.reply.answerReleasePublicAnswerLabel': 'Public answer',
            'agentWorkspace.reply.answerReleaseDecisionRelease': 'release',
            'agentWorkspace.reply.answerReleaseDecisionRevise': 'revise',
            'agentWorkspace.reply.answerReleaseDecisionAbstain': 'abstain',
            'agentWorkspace.reply.answerReleaseDecisionOther': 'other',
            'agentWorkspace.reply.answerReleaseBoolYes': 'yes',
            'agentWorkspace.reply.answerReleaseBoolNo': 'no',
            'agentWorkspace.reply.knowledgeRunHistoryCardTitle': 'Knowledge Run History',
            'agentWorkspace.reply.knowledgeRunHistoryCardSummary': '{returnedArtifacts} run artifact(s) returned.',
            'agentWorkspace.reply.answerReleaseAuditSummaryHeading': 'Release audit',
            'agentWorkspace.reply.answerReleaseAuditReviewedRunsLabel': 'Reviewed runs',
            'agentWorkspace.reply.answerReleaseAuditReviewedRunsSummary': '{reviewed}/{total} reviewed; {unreviewed} unreviewed',
            'agentWorkspace.reply.answerReleaseAuditDecisionCountsLabel': 'Decision counts',
            'agentWorkspace.reply.answerReleaseAuditRevisedRunsLabel': 'Revised runs',
            'agentWorkspace.reply.answerReleaseAuditLeakSummaryLabel': 'Leak summary',
            'agentWorkspace.reply.answerReleaseAuditLeakSummary': '{runs} run(s); {fragments} fragment(s)',
            'agentWorkspace.reply.answerReleaseAuditFailedGatesLabel': 'Failed gates',
            'agentWorkspace.reply.answerReleaseAuditFailedGatesSummary': '{runs} run(s); {gates}',
            'agentWorkspace.reply.answerReleaseAuditLatestReviewedAtLabel': 'Latest reviewed at',
            'agentWorkspace.reply.answerReleaseAuditTrendHeading': 'Review trend',
            'agentWorkspace.reply.answerReleaseAuditTrendRecentWindowLabel': 'Recent reviewed window',
            'agentWorkspace.reply.answerReleaseAuditTrendPriorWindowLabel': 'Prior reviewed window',
            'agentWorkspace.reply.answerReleaseAuditTrendWindowSummary': '{reviewed} run(s); {decisions}; revised {revised}; failed {failed}; leaked {leaked}; {latest} -> {earliest}',
            'agentWorkspace.reply.answerReleaseAuditComparisonHeading': 'Review comparison',
            'agentWorkspace.reply.answerReleaseAuditComparisonMetricSummary': 'recent {recent}; prior {prior}; delta {delta}',
            'agentWorkspace.reply.answerReleaseAuditComparisonLatestPairHeading': 'Latest pair',
            'agentWorkspace.reply.answerReleaseAuditComparisonLatestPairSummary': 'decision {previousDecision} -> {latestDecision}; revised {previousRevised} -> {latestRevised}; leak delta {leakDelta}; new {newlyFailed}; resolved {resolved}; persistent {persistent}',
            'agentWorkspace.reply.answerReleaseAuditComparisonGateShiftHeading': 'Gate shifts',
            'agentWorkspace.reply.answerReleaseAuditComparisonGateShiftSummary': 'recent {recent}; prior {prior}; delta {delta}; total {total}; since last failure {runsSince}',
            'agentWorkspace.reply.answerReleaseAuditComparisonFailedGateRunsLabel': 'Failed-gate runs',
            'agentWorkspace.reply.answerReleaseAuditComparisonLeakedRunsLabel': 'Leaked runs',
            'agentWorkspace.reply.answerReleaseAuditGateAgingHeading': 'Gate aging',
            'agentWorkspace.reply.answerReleaseAuditGateAgingSummary': '{count} fail(s); recent {latest}; since last failure {runsSince}; recent window {windowCount}',
            'agentWorkspace.reply.knowledgeRunHistoryRunsHeading': 'Recent Runs',
            'agentWorkspace.reply.knowledgeRunHistoryGraphSignalLabel': 'Graph signal',
            'agentWorkspace.reply.knowledgeRunHistoryInspectRun': 'Inspect Run',
            'agentWorkspace.reply.knowledgeRunHistoryCompareLatest': 'Compare Latest',
            'agentWorkspace.reply.answerReleaseHistoryLabel': 'Release review',
            'agentWorkspace.reply.answerReleaseHistorySummary': '{decision}; revised {revised}; failed {failedGates}',
            'agentWorkspace.reply.knowledgeRunCompareCardTitle': 'Knowledge Run Comparison',
            'agentWorkspace.reply.knowledgeRunCompareCardSummary': 'Comparing {comparedRunId} against latest {latestRunId}.',
            'agentWorkspace.reply.knowledgeRunCompareLatestLabel': 'Latest run',
            'agentWorkspace.reply.knowledgeRunCompareCandidateLabel': 'Compared run',
            'agentWorkspace.reply.knowledgeRunCompareQualityDeltaLabel': 'Quality delta',
            'agentWorkspace.reply.knowledgeRunCompareClaimDeltaLabel': 'Claim delta',
            'agentWorkspace.reply.knowledgeRunCompareWeakClaimDeltaLabel': 'Weak-claim delta',
            'agentWorkspace.reply.knowledgeRunCompareRemainingReviewDeltaLabel': 'Remaining review delta',
            'agentWorkspace.reply.knowledgeRunComparePathDeltaLabel': 'Path delta',
            'agentWorkspace.reply.knowledgeRunCompareTemporalWarningDeltaLabel': 'Temporal-warning delta',
            'agentWorkspace.reply.knowledgeRunCompareGraphFallbackDeltaLabel': 'Graph fallback delta',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseHeading': 'Answer release',
            'agentWorkspace.reply.knowledgeRunCompareLatestAnswerReleaseLabel': 'Latest release review',
            'agentWorkspace.reply.knowledgeRunCompareCandidateAnswerReleaseLabel': 'Compared release review',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseDeltaLabel': 'Release delta',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseDeltaSummary': 'decision {previousDecision} -> {latestDecision}; revised {previousRevised} -> {latestRevised}; leak delta {leakDelta}',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseGateDeltaLabel': 'Gate delta',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseGateDeltaSummary': 'new {newlyFailed}; resolved {resolved}; persistent {persistent}',
            'agentWorkspace.reply.knowledgeRunNone': 'none',
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
            'agentWorkspace.runtimeRunbookVerify.annCircuitBudgetFlagsLabel': 'ANN circuit budget flags',
            'agentWorkspace.runtimeRunbookVerify.annTraceabilityLabel': 'ANN traceability',
            'agentWorkspace.runtimeRunbookVerify.annTraceabilitySignalsLabel': 'ANN traceability signals',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterLabel': 'ANN prefilter',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterThresholdsLabel': 'ANN prefilter thresholds',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterCalibrationLabel': 'ANN prefilter calibration',
            'agentWorkspace.runtimeRunbookVerify.annCalibrationReadinessLabel': 'ANN calibration readiness',
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
            'agentWorkspace.runtimeRunbookChecks.annCircuitBudgetFlagsLabel': 'ANN circuit budget flag snapshot',
            'agentWorkspace.runtimeRunbookChecks.annTraceabilityLabel': 'ANN traceability snapshot',
            'agentWorkspace.runtimeRunbookChecks.annTraceabilitySignalsLabel': 'ANN traceability signal snapshot',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterLabel': 'ANN prefilter snapshot',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterThresholdsLabel': 'ANN prefilter threshold snapshot',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterCalibrationLabel': 'ANN prefilter calibration snapshot',
            'agentWorkspace.runtimeRunbookChecks.annCalibrationReadinessLabel': 'ANN calibration readiness snapshot',
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
            'agentWorkspace.reply.citations': 'Citations',
            'agentWorkspace.reply.citationsEmpty': 'No citations were returned.',
            'agentWorkspace.reply.citationUntitled': 'Untitled citation',
            'agentWorkspace.reply.citationSourceUnavailable': 'Source path unavailable',
            'agentWorkspace.reply.htmlArtifact': 'HTML Artifact',
            'agentWorkspace.reply.htmlArtifactEmpty': 'No HTML content was returned.',
            'agentWorkspace.reply.preview': 'Preview',
            'agentWorkspace.reply.knowledgeActions': 'Knowledge Actions',
            'agentWorkspace.reply.knowledgeActionsSummary': 'Open the scoped knowledge cards below to continue with focus mode or guided learning for {count} node(s).',
            'agentWorkspace.reply.knowledgeActionsEmpty': 'No actionable knowledge nodes were returned.',
            'agentWorkspace.reply.knowledgeRun': 'Knowledge Run',
            'agentWorkspace.reply.knowledgeRunSummary': 'Status: {status}. Quality score: {score}.',
            'agentWorkspace.reply.knowledgeRunStatusOnly': 'Status: {status}.',
            'agentWorkspace.reply.knowledgeRunClaims': 'Evidence claims',
            'agentWorkspace.reply.knowledgeRunClaimUntitled': 'Untitled claim',
            'agentWorkspace.reply.knowledgeRunReviewCards': 'Review cards',
            'agentWorkspace.reply.knowledgeRunReviewPrompt': 'Review the cited claim.',
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
            'agentWorkspace.reply.flashcardBatch.cardTitle': '复习卡片批次',
            'agentWorkspace.reply.flashcardBatch.summary': '{returnedArtifacts} 个 artifact，剩余 {remainingCards}/{totalCards} 张复习卡片。',
            'agentWorkspace.reply.flashcardBatch.metricsHeading': '关键指标',
            'agentWorkspace.reply.flashcardBatch.artifactKindsLabel': 'Artifact 类型',
            'agentWorkspace.reply.flashcardBatch.topPromptLabel': '首张提示',
            'agentWorkspace.reply.flashcardBatch.topEvidenceLabel': '首条证据',
            'agentWorkspace.reply.flashcardBatch.completedLabel': '已完成卡片',
            'agentWorkspace.reply.flashcardBatch.remainingLabel': '剩余卡片',
            'agentWorkspace.reply.flashcardBatch.statusLabel': 'Artifact 状态',
            'agentWorkspace.reply.flashcardBatch.statusActive': '活跃',
            'agentWorkspace.reply.flashcardBatch.statusArchived': '已归档',
            'agentWorkspace.reply.flashcardBatch.reviewNow': '立即复习',
            'agentWorkspace.reply.flashcardBatch.none': '无',
            'agentWorkspace.reply.structuredAnswer': '可信回答',
            'agentWorkspace.reply.knowledgeRunInspectRun': '检查运行',
            'agentWorkspace.reply.knowledgeRunCardTitle': '知识运行详情',
            'agentWorkspace.reply.knowledgeRunCardSummary': '运行 {runId}：{claimCount} 条主张，质量 {qualityStatus}/{qualityScore}。',
            'agentWorkspace.reply.knowledgeRunCardSummaryNoScore': '运行 {runId}：{claimCount} 条主张，质量 {qualityStatus}。',
            'agentWorkspace.reply.knowledgeRunMetricsHeading': '关键指标',
            'agentWorkspace.reply.knowledgeRunQualityGatesLabel': '质量门',
            'agentWorkspace.reply.knowledgeRunScopeLabel': '范围',
            'agentWorkspace.reply.knowledgeRunScopeSourceLabel': '范围来源',
            'agentWorkspace.reply.knowledgeRunArtifactStatusLabel': 'Artifact 状态',
            'agentWorkspace.reply.knowledgeRunTopClaimSourceLabel': '首条主张来源',
            'agentWorkspace.reply.knowledgeRunReviewProgressLabel': '复习进度',
            'agentWorkspace.reply.knowledgeRunInspectEvidence': '检查证据',
            'agentWorkspace.reply.knowledgeRunBrowseRuns': '最近运行',
            'agentWorkspace.reply.knowledgeRunHistoryCardTitle': '知识运行历史',
            'agentWorkspace.reply.knowledgeRunHistoryCardSummary': '返回 {returnedArtifacts} 条运行 artifact。',
            'agentWorkspace.reply.knowledgeRunHistoryRunsHeading': '最近运行',
            'agentWorkspace.reply.knowledgeRunHistoryGraphSignalLabel': '图信号',
            'agentWorkspace.reply.knowledgeRunHistoryInspectRun': '检查运行',
            'agentWorkspace.reply.knowledgeRunHistoryCompareLatest': '对比最新运行',
            'agentWorkspace.reply.knowledgeRunCompareCardTitle': '知识运行对比',
            'agentWorkspace.reply.knowledgeRunCompareCardSummary': '将 {comparedRunId} 与最新运行 {latestRunId} 对比。',
            'agentWorkspace.reply.knowledgeRunCompareLatestLabel': '最新运行',
            'agentWorkspace.reply.knowledgeRunCompareCandidateLabel': '对比运行',
            'agentWorkspace.reply.knowledgeRunCompareQualityDeltaLabel': '质量差值',
            'agentWorkspace.reply.knowledgeRunCompareClaimDeltaLabel': '主张差值',
            'agentWorkspace.reply.knowledgeRunCompareWeakClaimDeltaLabel': '弱主张差值',
            'agentWorkspace.reply.knowledgeRunCompareRemainingReviewDeltaLabel': '剩余复习差值',
            'agentWorkspace.reply.knowledgeRunComparePathDeltaLabel': '路径差值',
            'agentWorkspace.reply.knowledgeRunCompareTemporalWarningDeltaLabel': '时序告警差值',
            'agentWorkspace.reply.knowledgeRunCompareGraphFallbackDeltaLabel': '图回退差值',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseHeading': '发布审核',
            'agentWorkspace.reply.knowledgeRunCompareLatestAnswerReleaseLabel': '最新发布审核',
            'agentWorkspace.reply.knowledgeRunCompareCandidateAnswerReleaseLabel': '对比发布审核',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseDeltaLabel': '发布差值',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseDeltaSummary': '决策 {previousDecision} -> {latestDecision}；改写 {previousRevised} -> {latestRevised}；泄漏差值 {leakDelta}',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseGateDeltaLabel': '门禁差值',
            'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseGateDeltaSummary': '新增 {newlyFailed}；已解决 {resolved}；持续 {persistent}',
            'agentWorkspace.reply.knowledgeRunNone': '无',
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
            'agentWorkspace.runtimeRunbookVerify.annCircuitBudgetFlagsLabel': 'ANN 熔断预算标志',
            'agentWorkspace.runtimeRunbookVerify.annTraceabilityLabel': 'ANN 可追踪性',
            'agentWorkspace.runtimeRunbookVerify.annTraceabilitySignalsLabel': 'ANN 可追踪性信号',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterLabel': 'ANN 预筛选',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterThresholdsLabel': 'ANN 预筛选阈值',
            'agentWorkspace.runtimeRunbookVerify.annPrefilterCalibrationLabel': 'ANN 预筛选校准',
            'agentWorkspace.runtimeRunbookVerify.annCalibrationReadinessLabel': 'ANN 校准就绪态',
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
            'agentWorkspace.runtimeRunbookChecks.annCircuitBudgetFlagsLabel': 'ANN 熔断预算标志快照',
            'agentWorkspace.runtimeRunbookChecks.annTraceabilityLabel': 'ANN 可追踪性快照',
            'agentWorkspace.runtimeRunbookChecks.annTraceabilitySignalsLabel': 'ANN 可追踪性信号快照',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterLabel': 'ANN 预筛选快照',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterThresholdsLabel': 'ANN 预筛选阈值快照',
            'agentWorkspace.runtimeRunbookChecks.annPrefilterCalibrationLabel': 'ANN 预筛选校准快照',
            'agentWorkspace.runtimeRunbookChecks.annCalibrationReadinessLabel': 'ANN 校准就绪态快照',
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
            'agentWorkspace.evidence.title': '证据面板',
            'agentWorkspace.evidence.emptyIdle': '证据面板当前为空。',
            'agentWorkspace.evidence.groundingTitle': '依据检查器',
            'agentWorkspace.evidence.scopeLabel': '范围',
            'agentWorkspace.evidence.citationsLabel': '引用数',
            'agentWorkspace.evidence.memoriesLabel': '召回记忆',
            'agentWorkspace.evidence.memoryActionsLabel': '记忆动作',
            'agentWorkspace.evidence.readinessLabel': '工作区就绪状态',
            'agentWorkspace.evidence.missLabel': '范围恢复',
            'agentWorkspace.evidence.graphContextLabel': '图结构上下文',
            'agentWorkspace.evidence.graphAnchorLabel': '锚点',
            'agentWorkspace.evidence.graphAnchorAtomIdLabel': '锚点原子',
            'agentWorkspace.evidence.graphAnchorDocumentLabel': '锚点文档',
            'agentWorkspace.evidence.graphRelationKindsLabel': '关系类型',
            'agentWorkspace.evidence.graphSupportingTitlesLabel': '支撑标题',
            'agentWorkspace.evidence.graphSupportingAtomsLabel': '支撑原子',
            'agentWorkspace.evidence.graphRelationSummariesLabel': '关系摘要',
            'agentWorkspace.evidence.graphKnowledgePointRelationsLabel': '知识点关系',
            'agentWorkspace.evidence.graphConnectionPathsLabel': '连接路径',
            'agentWorkspace.evidence.graphConnectionPathLengthLabel': '长度：{length}',
            'agentWorkspace.evidence.graphPredecessorsLabel': '直接前置节点',
            'agentWorkspace.evidence.graphSuccessorsLabel': '直接后继节点',
            'agentWorkspace.evidence.graphEvidenceRefsLabel': '来源引用',
            'agentWorkspace.evidence.graphRelationTargetsLabel': '目标数：{count}',
            'agentWorkspace.evidence.graphRelationSourcesLabel': '来源：{sources}',
            'agentWorkspace.evidence.graphRelationConfidenceLabel': '平均置信度：{confidence}',
            'agentWorkspace.evidence.graphTemporalLabel': '时序有效性',
            'agentWorkspace.evidence.graphTemporalStatusLabel': '状态',
            'agentWorkspace.evidence.graphTemporalCheckedAtLabel': '检查时间',
            'agentWorkspace.evidence.graphTemporalReasonsLabel': '告警原因',
            'agentWorkspace.evidence.graphTemporalInvalidTitlesLabel': '失效知识点',
            'agentWorkspace.evidence.graphTemporalEdgeKindsLabel': '时序边类型',
            'agentWorkspace.evidence.graphTemporalDetailsLabel': '时序边细节',
            'agentWorkspace.evidence.graphDiagnosticsLabel': '图诊断',
            'agentWorkspace.evidence.graphDiagnosticsOpsLabel': '图操作',
            'agentWorkspace.evidence.graphDiagnosticsAvailableLabel': '可用',
            'agentWorkspace.evidence.graphDiagnosticsUnavailableLabel': '不可用',
            'agentWorkspace.evidence.graphDiagnosticsFallbackLabel': '回退',
            'agentWorkspace.evidence.graphDiagnosticsAnchorReasonLabel': '锚点选择原因',
            'agentWorkspace.evidence.graphDiagnosticsCandidateCountLabel': '候选数',
            'agentWorkspace.evidence.graphDiagnosticsSupportCountLabel': '支撑节点',
            'agentWorkspace.evidence.graphDiagnosticsBudgetLabel': '路径深度预算',
            'agentWorkspace.evidence.graphDiagnosticsMissingLookupsLabel': '缺失图查询',
            'agentWorkspace.evidence.graphTemporalValid': '有效',
            'agentWorkspace.evidence.graphTemporalWarning': '告警',
            'agentWorkspace.graphFocus.relationMapTitle': '关联聚焦',
            'agentWorkspace.graphFocus.relationAnchorNode': '锚点',
            'agentWorkspace.graphFocus.relationEdgesUnavailable': '当前命中未返回有界关系边。',
            'agentWorkspace.knowledge.togglePreview': '切换命中知识预览：{file}',
            'agentWorkspace.knowledge.clickHint': '左键单击命中文件可打开源文档并高亮命中依据。使用“学习路径”查看顺序引导，使用“关联聚焦”查看引用关系。',
            'agentWorkspace.knowledge.previewLoading': '正在加载源文档预览...',
            'agentWorkspace.knowledge.previewUnavailable': '源文档预览不可用。',
            'agentWorkspace.knowledge.openFile': '打开命中的知识点：{file}',
            'agentWorkspace.knowledge.learningPathAction': '学习路径',
            'agentWorkspace.knowledge.learningPathActionLabel': '显示 {file} 的学习路径',
            'agentWorkspace.knowledge.relatedFocusAction': '关联聚焦',
            'agentWorkspace.knowledge.relatedFocusActionLabel': '显示 {file} 的引用关联聚焦',
            'agentWorkspace.knowledge.actionsMenu': '知识点操作',
            'agentWorkspace.reply.citations': '引用',
            'agentWorkspace.reply.citationsEmpty': '未返回引用。',
            'agentWorkspace.reply.citationUntitled': '未命名引用',
            'agentWorkspace.reply.citationSourceUnavailable': '来源路径不可用',
            'agentWorkspace.reply.htmlArtifact': 'HTML 工件',
            'agentWorkspace.reply.htmlArtifactEmpty': '未返回 HTML 内容。',
            'agentWorkspace.reply.preview': '预览',
            'agentWorkspace.reply.knowledgeActions': '知识动作',
            'agentWorkspace.reply.knowledgeActionsSummary': '请使用下方的 scoped knowledge cards，继续对 {count} 个节点执行聚焦模式或引导式学习。',
            'agentWorkspace.reply.knowledgeActionsEmpty': '未返回可执行的知识节点。',
            'agentWorkspace.reply.knowledgeRun': '知识运行',
            'agentWorkspace.reply.knowledgeRunSummary': '状态：{status}。质量分：{score}。',
            'agentWorkspace.reply.knowledgeRunStatusOnly': '状态：{status}。',
            'agentWorkspace.reply.knowledgeRunClaims': '证据主张',
            'agentWorkspace.reply.knowledgeRunClaimUntitled': '未命名主张',
            'agentWorkspace.reply.knowledgeRunReviewCards': '复习卡片',
            'agentWorkspace.reply.knowledgeRunReviewPrompt': '复习被引用的主张。',
            'agentWorkspace.reply.answerReleaseReviewHeading': '最终回答发布审核',
            'agentWorkspace.reply.answerReleaseReviewGatesLabel': '发布门禁',
            'agentWorkspace.reply.answerReleaseDecisionLabel': '决策',
            'agentWorkspace.reply.answerReleaseReviewedAtLabel': '审核时间',
            'agentWorkspace.reply.answerReleaseRevisedLabel': '是否改写',
            'agentWorkspace.reply.answerReleaseFailedGatesLabel': '失败门禁',
            'agentWorkspace.reply.answerReleaseLeakedFragmentsLabel': '泄漏片段',
            'agentWorkspace.reply.answerReleaseReasonLabel': '原因',
            'agentWorkspace.reply.answerReleaseOriginalAnswerLabel': '原始回答',
            'agentWorkspace.reply.answerReleasePublicAnswerLabel': '公开回答',
            'agentWorkspace.reply.answerReleaseDecisionRelease': '放行',
            'agentWorkspace.reply.answerReleaseDecisionRevise': '改写',
            'agentWorkspace.reply.answerReleaseDecisionAbstain': '拒答',
            'agentWorkspace.reply.answerReleaseDecisionOther': '其他',
            'agentWorkspace.reply.answerReleaseBoolYes': '是',
            'agentWorkspace.reply.answerReleaseBoolNo': '否',
            'agentWorkspace.reply.answerReleaseAuditSummaryHeading': '发布审计',
            'agentWorkspace.reply.answerReleaseAuditReviewedRunsLabel': '已审核运行',
            'agentWorkspace.reply.answerReleaseAuditReviewedRunsSummary': '已审核 {reviewed}/{total}；未审核 {unreviewed}',
            'agentWorkspace.reply.answerReleaseAuditDecisionCountsLabel': '决策计数',
            'agentWorkspace.reply.answerReleaseAuditRevisedRunsLabel': '改写运行',
            'agentWorkspace.reply.answerReleaseAuditLeakSummaryLabel': '泄漏汇总',
            'agentWorkspace.reply.answerReleaseAuditLeakSummary': '{runs} 次运行；{fragments} 个片段',
            'agentWorkspace.reply.answerReleaseAuditFailedGatesLabel': '失败门禁',
            'agentWorkspace.reply.answerReleaseAuditFailedGatesSummary': '{runs} 次运行；{gates}',
            'agentWorkspace.reply.answerReleaseAuditLatestReviewedAtLabel': '最近审核时间',
            'agentWorkspace.reply.answerReleaseAuditTrendHeading': '审核趋势',
            'agentWorkspace.reply.answerReleaseAuditTrendRecentWindowLabel': '近期已审窗口',
            'agentWorkspace.reply.answerReleaseAuditTrendPriorWindowLabel': '前序已审窗口',
            'agentWorkspace.reply.answerReleaseAuditTrendWindowSummary': '{reviewed} 次运行；{decisions}；改写 {revised}；失败 {failed}；泄漏 {leaked}；{latest} -> {earliest}',
            'agentWorkspace.reply.answerReleaseAuditComparisonHeading': '审核对比',
            'agentWorkspace.reply.answerReleaseAuditComparisonMetricSummary': '近期 {recent}；前序 {prior}；差值 {delta}',
            'agentWorkspace.reply.answerReleaseAuditComparisonLatestPairHeading': '最近两次审核',
            'agentWorkspace.reply.answerReleaseAuditComparisonLatestPairSummary': '决策 {previousDecision} -> {latestDecision}；改写 {previousRevised} -> {latestRevised}；泄漏差值 {leakDelta}；新增 {newlyFailed}；已解决 {resolved}；持续 {persistent}',
            'agentWorkspace.reply.answerReleaseAuditComparisonGateShiftHeading': '门禁变化',
            'agentWorkspace.reply.answerReleaseAuditComparisonGateShiftSummary': '近期 {recent}；前序 {prior}；差值 {delta}；总计 {total}；距上次失败 {runsSince}',
            'agentWorkspace.reply.answerReleaseAuditComparisonFailedGateRunsLabel': '失败门禁运行',
            'agentWorkspace.reply.answerReleaseAuditComparisonLeakedRunsLabel': '泄漏运行',
            'agentWorkspace.reply.answerReleaseAuditGateAgingHeading': '门禁老化',
            'agentWorkspace.reply.answerReleaseAuditGateAgingSummary': '{count} 次失败；最近 {latest}；距上次失败 {runsSince} 次已审运行；近期窗口 {windowCount}',
            'agentWorkspace.reply.answerReleaseHistoryLabel': '发布审核',
            'agentWorkspace.reply.answerReleaseHistorySummary': '{decision}；已改写 {revised}；失败门禁 {failedGates}',
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
            <select id="folder-select">
              <option value="ALL_FOLDERS">All folders</option>
              <option value="financial">financial</option>
              <option value="waterglass">waterglass</option>
            </select>
            <div id="graph-wrapper">
              <div id="agent-workspace-shell">
                <section id="agent-chat-pane">
                  <input id="agent-workspace-user-id" value="path_user_default" />
                  <div class="agent-scope-control">
                    <label for="agent-workspace-scope-select">Scope</label>
                    <select id="agent-workspace-scope-select"></select>
                    <div id="agent-workspace-scope-summary"></div>
                  </div>
                  <div id="agent-workspace-chat-messages"></div>
                  <textarea id="agent-workspace-chat-input"></textarea>
                  <button id="btn-agent-workspace-send"></button>
                  <div id="agent-workspace-api-status"></div>
                  <div id="agent-workspace-knowledge-points"></div>
                </section>
                <div id="agent-side-work-area">
                  <section id="agent-graph-focus-pane" class="agent-workspace-pane">
                    <div class="agent-workspace-pane-header">
                      <button id="btn-agent-graph-focus-fullscreen"></button>
                      <button id="btn-agent-graph-focus-close"></button>
                    </div>
                    <div id="agent-graph-focus-body"></div>
                  </section>
                  <section id="agent-evidence-pane" class="agent-workspace-pane">
                    <div class="agent-workspace-pane-header">
                      <button id="btn-agent-evidence-fullscreen"></button>
                      <button id="btn-agent-evidence-close"></button>
                    </div>
                    <div id="agent-evidence-body"></div>
                  </section>
                  <section id="agent-learning-path-pane" class="agent-workspace-pane">
                    <div class="agent-workspace-pane-header">
                      <button id="btn-agent-learning-path-fullscreen"></button>
                      <button id="btn-agent-learning-path-close"></button>
                    </div>
                    <div id="agent-learning-path-body"></div>
                  </section>
                </div>
              </div>
              <div id="graph-container" style="display: block">
                <svg id="graph-svg"></svg>
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
    const markdownRuntimeScriptPath = path.join(repoRoot, 'src', 'frontend', 'markdown_runtime.js');
    const scriptPath = path.join(repoRoot, 'src', 'frontend', 'workspace_panes.js');
    const dom = new JSDOM(createWorkspaceHtml(), {
        url: 'http://127.0.0.1:3000',
    });
    const sandbox = createBaseSandbox(dom);
    if (options.withI18n) {
        sandbox.window.i18n = createI18nStub();
    }
    sandbox.window.__NC_RUNTIME_CAPS = {};

    loadScriptIntoSandbox(sandbox, markdownRuntimeScriptPath, 'markdown_runtime.js');
    loadScriptIntoSandbox(sandbox, scriptPath, 'workspace_panes.js');

    sandbox.window.NoteConnectionStorage = {
        createProvider: () => ({
            readContent: jest.fn(async () => ''),
        }),
    };

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
    const markdownRuntimeScriptPath = path.join(repoRoot, 'src', 'frontend', 'markdown_runtime.js');
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
        if (url === '/api/knowledge/workflow-artifacts/review-follow-up') {
            let parsedBody: Record<string, unknown> = {};
            if (init && typeof init.body === 'string' && init.body.trim().length > 0) {
                try {
                    parsedBody = JSON.parse(init.body);
                } catch (_error) {
                    parsedBody = {};
                }
            }
            const action = parsedBody.action && typeof parsedBody.action === 'object'
                ? parsedBody.action as Record<string, unknown>
                : {};
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        artifact: {
                            artifactId: String(parsedBody.artifactId || 'workflow_artifact_flashcard_batch_1'),
                            kind: 'flashcard_batch',
                            sessionId: String(parsedBody.sessionId || 'session_client_path_user_default_test'),
                            userId: 'path_user_default',
                            workspaceId: 'waterglass',
                            corpusId: 'waterglass',
                            title: 'Knowledge run review cards: Water Glass',
                            sourceResourceIds: ['resource_1'],
                            sourceProjectionIds: ['projection_1'],
                            summary: 'Prepared 1 review card(s); 1 completed and 0 remaining.',
                            status: 'archived',
                            createdAt: '2026-04-12T00:20:00.000Z',
                            updatedAt: '2026-04-12T00:21:00.000Z',
                            payload: {
                                runId: 'knowledge_run_1',
                                reviewCards: [
                                    {
                                        cardId: 'knowledge_run_1_card_1',
                                        sourceClaimId: 'knowledge_run_1_claim_1',
                                        atomId: 'atom_water_glass',
                                        suggestedActionKind: 'review',
                                        prompt: 'What does the cited source establish about Water Glass?',
                                        expectedAnswer: 'A water glass is a physical system.',
                                        evidenceRefs: ['Knowledge_Base/waterglass/water glass.md:3'],
                                        nextReviewAt: '2026-04-13T00:20:00.000Z',
                                    },
                                ],
                                evidenceClaims: [
                                    {
                                        claimId: 'knowledge_run_1_claim_1',
                                        title: 'Water Glass',
                                        status: 'verified',
                                    },
                                ],
                                reviewState: {
                                    consumedCardIds: [String(parsedBody.cardId || 'knowledge_run_1_card_1')],
                                    completedReviewCardCount: 1,
                                    remainingReviewCardCount: 0,
                                    completedAt: '2026-04-12T00:21:00.000Z',
                                },
                            },
                        },
                        relatedKnowledgeRunArtifact: {
                            artifactId: 'workflow_artifact_knowledge_run_1',
                            kind: 'knowledge_run',
                            sessionId: String(parsedBody.sessionId || 'session_client_path_user_default_test'),
                            userId: 'path_user_default',
                            workspaceId: 'waterglass',
                            corpusId: 'waterglass',
                            title: 'Knowledge run: Water Glass',
                            sourceResourceIds: ['resource_1'],
                            sourceProjectionIds: ['projection_1'],
                            summary: 'Generated 1 evidence claim(s); 1 review card(s) completed and 0 remaining.',
                            status: 'archived',
                            createdAt: '2026-04-12T00:20:00.000Z',
                            updatedAt: '2026-04-12T00:21:00.000Z',
                            payload: {},
                        },
                        studySessionAction: {
                            sessionId: String(parsedBody.sessionId || 'session_client_path_user_default_test'),
                            executedAt: '2026-04-12T00:21:00.000Z',
                            tutor: {
                                message: `Reviewed ${String(action.atomId || '')} via ${String(action.kind || '')}.`,
                                suggestedActions: [],
                                evidenceSpans: [
                                    {
                                        id: 'ev_review_1',
                                        snippet: 'A water glass is a physical system.',
                                    },
                                ],
                                trace: {
                                    actionKind: 'recap',
                                    confidence: 0.88,
                                    evidenceSpanIds: ['ev_review_1'],
                                    relationPathAtomIds: [String(action.atomId || '')],
                                    source: 'rule-engine',
                                    notes: 'review execution',
                                    traceId: 'trace_review_1',
                                },
                            },
                            answerAnalysis: null,
                            memory: null,
                            promotedMemory: null,
                            mastery: null,
                            trace: {
                                tutorActionKind: 'recap',
                                persistedMemory: true,
                                updatedMastery: false,
                                analyzedAnswer: false,
                                masterySource: 'none',
                                effectiveOutcome: null,
                                effectiveErrorTag: null,
                            },
                        },
                        consumedCardId: String(parsedBody.cardId || 'knowledge_run_1_card_1'),
                        completedReviewCardCount: 1,
                        remainingReviewCardCount: 0,
                        archivedArtifact: true,
                    },
                }),
            };
        }
        if (String(url).startsWith('/api/knowledge/workflow-artifacts')) {
            const parsedUrl = new URL(String(url), 'http://127.0.0.1:3000');
            const artifactKinds = String(parsedUrl.searchParams.get('artifactKinds') || '').split(',').map((value) => value.trim()).filter(Boolean);
            const artifactIdFilter = String(parsedUrl.searchParams.get('artifactId') || '').trim();
            const runIdFilter = String(parsedUrl.searchParams.get('runId') || '').trim();
            const wantsKnowledgeRunHistory = artifactKinds.includes('knowledge_run')
                && !artifactIdFilter
                && !runIdFilter;
            const wantsKnowledgeRunBlocks1 = artifactKinds.includes('knowledge_run')
                || artifactIdFilter === 'workflow_artifact_knowledge_run_blocks_1'
                || runIdFilter === 'knowledge_run_blocks_1';
            const wantsKnowledgeRunBlocks2 = artifactIdFilter === 'workflow_artifact_knowledge_run_blocks_2'
                || runIdFilter === 'knowledge_run_blocks_2';
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        generatedAt: '2026-04-12T00:20:00.000Z',
                        workspaceId: 'waterglass',
                        sessionId: 'session_client_path_user_default_test',
                        userId: 'path_user_default',
                        returnedArtifacts: 1,
                        artifacts: wantsKnowledgeRunHistory
                            ? [
                                {
                                    artifactId: 'workflow_artifact_knowledge_run_blocks_1',
                                    kind: 'knowledge_run',
                                    sessionId: 'session_blocks_1',
                                    userId: 'path_user_default',
                                    workspaceId: 'waterglass',
                                    corpusId: 'waterglass',
                                    title: 'Knowledge run: Blocks Citation',
                                    sourceResourceIds: ['resource_blocks_1'],
                                    sourceProjectionIds: ['projection_blocks_1'],
                                    summary: 'Generated 1 evidence claim(s) and 1 review card(s) with status pass.',
                                    status: 'active',
                                    createdAt: '2026-04-13T00:01:00.000Z',
                                    updatedAt: '2026-04-13T00:01:00.000Z',
                                    payload: {
                                        knowledgeRun: {
                                            runId: 'knowledge_run_blocks_1',
                                            generatedAt: '2026-04-13T00:01:00.000Z',
                                            status: 'pass',
                                            scope: {
                                                source: 'scoped',
                                                workspaceId: 'waterglass',
                                                corpusId: 'waterglass',
                                                documentIds: [],
                                                atomIds: [],
                                                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                                languages: [],
                                                matchedAtomCount: 1,
                                                scopeSource: 'explicit_request',
                                            },
                                            evidenceClaims: [],
                                            quality: {
                                                score: 100,
                                                status: 'pass',
                                                gates: [],
                                            },
                                            reviewCards: [],
                                            reviewState: {
                                                consumedCardIds: [],
                                                completedReviewCardCount: 0,
                                                remainingReviewCardCount: 1,
                                                completedAt: null,
                                            },
                                            answerReleaseReview: {
                                                reviewedAt: '2026-04-13T00:01:01.000Z',
                                                decision: 'release',
                                                revised: false,
                                                originalAnswer: 'Scoped snippet',
                                                publicAnswer: 'Scoped snippet',
                                                reason: 'Draft answer satisfied the public-release gates.',
                                                failedGateIds: [],
                                                leakedInternalFragments: [],
                                                gates: [
                                                    {
                                                        gateId: 'evidence_sufficiency',
                                                        passed: true,
                                                        message: 'Grounded evidence was available for public release.',
                                                    },
                                                    {
                                                        gateId: 'public_surface_contraction',
                                                        passed: true,
                                                        message: 'Draft answer stayed within the public-surface contraction budget.',
                                                    },
                                                ],
                                            },
                                            summary: {
                                                claimCount: 1,
                                                verifiedClaimCount: 1,
                                                weakClaimCount: 0,
                                                notProvenClaimCount: 0,
                                                rejectedClaimCount: 0,
                                                reviewCardCount: 1,
                                                completedReviewCardCount: 0,
                                                remainingReviewCardCount: 1,
                                            },
                                        },
                                        graphContext: {
                                            anchorAtomId: 'atom_blocks_1',
                                            anchorTitle: 'Blocks Citation',
                                            supportingAtomIds: ['atom_blocks_1_foundation'],
                                            supportingTitles: ['Blocks Foundation'],
                                            relationKinds: ['prerequisite'],
                                            relationSummaries: [],
                                            connectionPaths: [
                                                {
                                                    sourceAtomId: 'atom_blocks_1_foundation',
                                                    sourceTitle: 'Blocks Foundation',
                                                    targetAtomId: 'atom_blocks_1',
                                                    targetTitle: 'Blocks Citation',
                                                    pathAtomIds: ['atom_blocks_1_foundation', 'atom_blocks_1'],
                                                    pathTitles: ['Blocks Foundation', 'Blocks Citation'],
                                                    pathEdges: [],
                                                    length: 1,
                                                },
                                            ],
                                            predecessorWindow: [
                                                {
                                                    atomId: 'atom_blocks_1_foundation',
                                                    title: 'Blocks Foundation',
                                                    relationKind: 'prerequisite',
                                                    confidence: 0.91,
                                                },
                                            ],
                                            successorWindow: [],
                                            evidenceSourceRefs: ['Knowledge_Base/optics/blocks.md:18'],
                                            diagnostics: {
                                                graphOpsAvailable: true,
                                                usedFallback: false,
                                                selectedAnchorReason: 'title_mention',
                                                candidateCount: 1,
                                                supportNodeCount: 1,
                                                supportNodeLimit: 2,
                                                pathDepthLimit: 6,
                                                missingConnectionPathSourceAtomIds: [],
                                                missingPredecessorAtomIds: [],
                                                missingSuccessorAtomIds: [],
                                            },
                                            temporalValidity: {
                                                checkedAt: '2026-04-13T00:01:00.000Z',
                                                allPointsValid: true,
                                                warningReasons: [],
                                                invalidKnowledgePointTitles: [],
                                            },
                                        },
                                    },
                                },
                                {
                                    artifactId: 'workflow_artifact_knowledge_run_blocks_2',
                                    kind: 'knowledge_run',
                                    sessionId: 'session_blocks_2',
                                    userId: 'path_user_default',
                                    workspaceId: 'waterglass',
                                    corpusId: 'waterglass',
                                    title: 'Knowledge run: Absorption',
                                    sourceResourceIds: ['resource_blocks_2'],
                                    sourceProjectionIds: ['projection_blocks_2'],
                                    summary: 'Generated 2 evidence claim(s) and 1 review card(s) with status caution.',
                                    status: 'active',
                                    createdAt: '2026-04-12T23:55:00.000Z',
                                    updatedAt: '2026-04-12T23:55:00.000Z',
                                    payload: {
                                        knowledgeRun: {
                                            runId: 'knowledge_run_blocks_2',
                                            generatedAt: '2026-04-12T23:55:00.000Z',
                                            status: 'caution',
                                            scope: {
                                                source: 'scoped',
                                                workspaceId: 'waterglass',
                                                corpusId: 'waterglass',
                                                documentIds: [],
                                                atomIds: [],
                                                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                                languages: [],
                                                matchedAtomCount: 2,
                                                scopeSource: 'explicit_request',
                                            },
                                            evidenceClaims: [],
                                            quality: {
                                                score: 75,
                                                status: 'caution',
                                                gates: [],
                                            },
                                            reviewCards: [],
                                            reviewState: {
                                                consumedCardIds: [],
                                                completedReviewCardCount: 0,
                                                remainingReviewCardCount: 1,
                                                completedAt: null,
                                            },
                                            answerReleaseReview: {
                                                reviewedAt: '2026-04-12T23:55:01.000Z',
                                                decision: 'revise',
                                                revised: true,
                                                originalAnswer: 'Absorption is grounded by two claims and one weak citation note.',
                                                publicAnswer: 'Absorption depends on material interaction with incident radiation.',
                                                reason: 'Draft answer had usable evidence but required contraction before public release.',
                                                failedGateIds: ['public_surface_contraction'],
                                                leakedInternalFragments: [],
                                                gates: [
                                                    {
                                                        gateId: 'evidence_sufficiency',
                                                        passed: true,
                                                        message: 'Grounded evidence was available for public release.',
                                                    },
                                                    {
                                                        gateId: 'public_surface_contraction',
                                                        passed: false,
                                                        message: 'Draft answer carried too much support or formatting detail for the public answer surface.',
                                                    },
                                                ],
                                            },
                                            summary: {
                                                claimCount: 2,
                                                verifiedClaimCount: 1,
                                                weakClaimCount: 1,
                                                notProvenClaimCount: 0,
                                                rejectedClaimCount: 0,
                                                reviewCardCount: 1,
                                                completedReviewCardCount: 0,
                                                remainingReviewCardCount: 1,
                                            },
                                        },
                                        graphContext: {
                                            anchorAtomId: 'atom_blocks_2',
                                            anchorTitle: 'Absorption',
                                            supportingAtomIds: ['atom_blocks_2_aux'],
                                            supportingTitles: ['Attenuation coupling'],
                                            relationKinds: ['reference'],
                                            relationSummaries: [],
                                            connectionPaths: [],
                                            predecessorWindow: [],
                                            successorWindow: [],
                                            evidenceSourceRefs: ['Knowledge_Base/optics/absorption.md:18'],
                                            diagnostics: {
                                                graphOpsAvailable: false,
                                                usedFallback: true,
                                                selectedAnchorReason: 'retrieval_score',
                                                candidateCount: 2,
                                                supportNodeCount: 1,
                                                supportNodeLimit: 2,
                                                pathDepthLimit: 6,
                                                missingConnectionPathSourceAtomIds: ['atom_blocks_2_aux'],
                                                missingPredecessorAtomIds: [],
                                                missingSuccessorAtomIds: ['atom_blocks_2_future'],
                                            },
                                            temporalValidity: {
                                                checkedAt: '2026-04-12T23:55:00.000Z',
                                                allPointsValid: false,
                                                warningReasons: ['temporal_edge_expired'],
                                                invalidKnowledgePointTitles: ['Attenuation coupling'],
                                            },
                                        },
                                    },
                                },
                            ]
                            : wantsKnowledgeRunBlocks2
                            ? [
                                {
                                    artifactId: 'workflow_artifact_knowledge_run_blocks_2',
                                    kind: 'knowledge_run',
                                    sessionId: 'session_blocks_2',
                                    userId: 'path_user_default',
                                    workspaceId: 'waterglass',
                                    corpusId: 'waterglass',
                                    title: 'Knowledge run: Absorption',
                                    sourceResourceIds: ['resource_blocks_2'],
                                    sourceProjectionIds: ['projection_blocks_2'],
                                    summary: 'Generated 2 evidence claim(s) and 1 review card(s) with status caution.',
                                    status: 'active',
                                    createdAt: '2026-04-12T23:55:00.000Z',
                                    updatedAt: '2026-04-12T23:55:00.000Z',
                                    payload: {
                                        knowledgeRun: {
                                            runId: 'knowledge_run_blocks_2',
                                            generatedAt: '2026-04-12T23:55:00.000Z',
                                            status: 'caution',
                                            scope: {
                                                source: 'scoped',
                                                workspaceId: 'waterglass',
                                                corpusId: 'waterglass',
                                                documentIds: [],
                                                atomIds: [],
                                                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                                languages: [],
                                                matchedAtomCount: 2,
                                                scopeSource: 'explicit_request',
                                            },
                                            evidenceClaims: [
                                                {
                                                    claimId: 'knowledge_run_blocks_2_claim_1',
                                                    status: 'verified',
                                                    title: 'Absorption',
                                                    statement: 'Absorption depends on material interaction with incident radiation.',
                                                    citationId: 'citation_blocks_2_1',
                                                    atomId: 'atom_blocks_2',
                                                    documentId: 'doc_blocks_2',
                                                    sourcePath: 'Knowledge_Base/optics/absorption.md',
                                                    startLine: 9,
                                                    endLine: 12,
                                                    snippet: 'Absorption depends on material interaction with incident radiation.',
                                                    confidence: 0.82,
                                                    reason: 'The primary claim is backed by a direct source span.',
                                                },
                                                {
                                                    claimId: 'knowledge_run_blocks_2_claim_2',
                                                    status: 'weak',
                                                    title: 'Attenuation coupling',
                                                    statement: 'Absorption contributes to attenuation alongside scattering effects.',
                                                    citationId: 'citation_blocks_2_2',
                                                    atomId: 'atom_blocks_2_aux',
                                                    documentId: 'doc_blocks_2',
                                                    sourcePath: 'Knowledge_Base/optics/absorption.md',
                                                    startLine: 18,
                                                    endLine: 22,
                                                    snippet: 'Absorption contributes to attenuation alongside scattering effects.',
                                                    confidence: 0.61,
                                                    reason: 'The secondary claim is grounded, but its support is partial.',
                                                },
                                            ],
                                            quality: {
                                                score: 75,
                                                status: 'caution',
                                                gates: [
                                                    {
                                                        gateId: 'evidence_coverage',
                                                        passed: true,
                                                        observedValue: 1,
                                                        threshold: 0.8,
                                                        message: '2 of 2 claim(s) have citation evidence.',
                                                    },
                                                    {
                                                        gateId: 'claim_strength',
                                                        passed: false,
                                                        observedValue: 0.5,
                                                        threshold: 0.75,
                                                        message: 'One claim remains weak and should be reviewed.',
                                                    },
                                                ],
                                            },
                                            reviewCards: [
                                                {
                                                    cardId: 'knowledge_run_blocks_2_card_1',
                                                    sourceClaimId: 'knowledge_run_blocks_2_claim_2',
                                                    prompt: 'Why is the attenuation coupling claim marked weak?',
                                                    expectedAnswer: 'Its support is only partial relative to the cited span.',
                                                    evidenceRefs: ['Knowledge_Base/optics/absorption.md:18'],
                                                    nextReviewAt: '2026-04-13T23:55:00.000Z',
                                                },
                                            ],
                                            reviewState: {
                                                consumedCardIds: [],
                                                completedReviewCardCount: 0,
                                                remainingReviewCardCount: 1,
                                                completedAt: null,
                                            },
                                            answerReleaseReview: {
                                                reviewedAt: '2026-04-12T23:55:01.000Z',
                                                decision: 'revise',
                                                revised: true,
                                                originalAnswer: 'Absorption is grounded by two claims and one weak citation note.',
                                                publicAnswer: 'Absorption depends on material interaction with incident radiation.',
                                                reason: 'Draft answer had usable evidence but required contraction before public release.',
                                                failedGateIds: ['public_surface_contraction'],
                                                leakedInternalFragments: [],
                                                gates: [
                                                    {
                                                        gateId: 'evidence_sufficiency',
                                                        passed: true,
                                                        message: 'Grounded evidence was available for public release.',
                                                    },
                                                    {
                                                        gateId: 'public_surface_contraction',
                                                        passed: false,
                                                        message: 'Draft answer carried too much support or formatting detail for the public answer surface.',
                                                    },
                                                ],
                                            },
                                            summary: {
                                                claimCount: 2,
                                                verifiedClaimCount: 1,
                                                weakClaimCount: 1,
                                                notProvenClaimCount: 0,
                                                rejectedClaimCount: 0,
                                                reviewCardCount: 1,
                                                completedReviewCardCount: 0,
                                                remainingReviewCardCount: 1,
                                            },
                                        },
                                        graphContext: {
                                            anchorAtomId: 'atom_blocks_2',
                                            anchorTitle: 'Absorption',
                                            supportingAtomIds: ['atom_blocks_2_aux'],
                                            supportingTitles: ['Attenuation coupling'],
                                            relationKinds: ['reference'],
                                            relationSummaries: [],
                                            connectionPaths: [],
                                            predecessorWindow: [],
                                            successorWindow: [],
                                            evidenceSourceRefs: ['Knowledge_Base/optics/absorption.md:18'],
                                            diagnostics: {
                                                graphOpsAvailable: false,
                                                usedFallback: true,
                                                selectedAnchorReason: 'retrieval_score',
                                                candidateCount: 2,
                                                supportNodeCount: 1,
                                                supportNodeLimit: 2,
                                                pathDepthLimit: 6,
                                                missingConnectionPathSourceAtomIds: ['atom_blocks_2_aux'],
                                                missingPredecessorAtomIds: [],
                                                missingSuccessorAtomIds: ['atom_blocks_2_future'],
                                            },
                                            temporalValidity: {
                                                checkedAt: '2026-04-12T23:55:00.000Z',
                                                allPointsValid: false,
                                                warningReasons: ['temporal_edge_expired'],
                                                invalidKnowledgePointTitles: ['Attenuation coupling'],
                                            },
                                        },
                                    },
                                },
                            ]
                            : wantsKnowledgeRunBlocks1
                            ? [
                                {
                                    artifactId: 'workflow_artifact_knowledge_run_blocks_1',
                                    kind: 'knowledge_run',
                                    sessionId: 'session_blocks_1',
                                    userId: 'path_user_default',
                                    workspaceId: 'waterglass',
                                    corpusId: 'waterglass',
                                    title: 'Knowledge run: Blocks Citation',
                                    sourceResourceIds: ['resource_blocks_1'],
                                    sourceProjectionIds: ['projection_blocks_1'],
                                    summary: 'Generated 1 evidence claim(s) and 1 review card(s) with status pass.',
                                    status: 'active',
                                    createdAt: '2026-04-13T00:01:00.000Z',
                                    updatedAt: '2026-04-13T00:01:00.000Z',
                                    payload: {
                                        knowledgeRun: {
                                            runId: 'knowledge_run_blocks_1',
                                            generatedAt: '2026-04-13T00:01:00.000Z',
                                            status: 'pass',
                                            scope: {
                                                source: 'scoped',
                                                workspaceId: 'waterglass',
                                                corpusId: 'waterglass',
                                                documentIds: [],
                                                atomIds: [],
                                                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                                languages: [],
                                                matchedAtomCount: 1,
                                                scopeSource: 'explicit_request',
                                            },
                                            evidenceClaims: [
                                                {
                                                    claimId: 'knowledge_run_blocks_1_claim_1',
                                                    status: 'verified',
                                                    title: 'Blocks Citation',
                                                    statement: 'Scoped snippet',
                                                    citationId: 'citation_blocks_1',
                                                    atomId: 'atom_blocks_1',
                                                    documentId: 'doc_blocks_1',
                                                    sourcePath: 'Knowledge_Base/optics/blocks.md',
                                                    startLine: 18,
                                                    endLine: 21,
                                                    snippet: 'Scoped snippet',
                                                    confidence: 0.88,
                                                    reason: 'The claim is backed by a cited source span with a concrete line reference.',
                                                },
                                            ],
                                            quality: {
                                                score: 100,
                                                status: 'pass',
                                                gates: [
                                                    {
                                                        gateId: 'evidence_coverage',
                                                        passed: true,
                                                        observedValue: 1,
                                                        threshold: 0.8,
                                                        message: '1 of 1 claim(s) have citation evidence.',
                                                    },
                                                    {
                                                        gateId: 'scope_discipline',
                                                        passed: true,
                                                        observedValue: 1,
                                                        threshold: 1,
                                                        message: 'The answer stayed inside the resolved scope contract.',
                                                    },
                                                    {
                                                        gateId: 'recall_transfer',
                                                        passed: true,
                                                        observedValue: 1,
                                                        threshold: 1,
                                                        message: '1 review card(s) were generated from cited claims.',
                                                    },
                                                ],
                                            },
                                            reviewCards: [
                                                {
                                                    cardId: 'knowledge_run_blocks_1_card_1',
                                                    sourceClaimId: 'knowledge_run_blocks_1_claim_1',
                                                    prompt: 'What does the cited source establish about Blocks Citation?',
                                                    expectedAnswer: 'Scoped snippet',
                                                    evidenceRefs: ['Knowledge_Base/optics/blocks.md:18'],
                                                    nextReviewAt: '2026-04-14T00:01:00.000Z',
                                                },
                                            ],
                                            reviewState: {
                                                consumedCardIds: [],
                                                completedReviewCardCount: 0,
                                                remainingReviewCardCount: 1,
                                                completedAt: null,
                                            },
                                            answerReleaseReview: {
                                                reviewedAt: '2026-04-13T00:01:01.000Z',
                                                decision: 'release',
                                                revised: false,
                                                originalAnswer: 'Scoped snippet',
                                                publicAnswer: 'Scoped snippet',
                                                reason: 'Draft answer satisfied the public-release gates.',
                                                failedGateIds: [],
                                                leakedInternalFragments: [],
                                                gates: [
                                                    {
                                                        gateId: 'evidence_sufficiency',
                                                        passed: true,
                                                        message: 'Grounded evidence was available for public release.',
                                                    },
                                                    {
                                                        gateId: 'public_surface_contraction',
                                                        passed: true,
                                                        message: 'Draft answer stayed within the public-surface contraction budget.',
                                                    },
                                                ],
                                            },
                                            summary: {
                                                claimCount: 1,
                                                verifiedClaimCount: 1,
                                                weakClaimCount: 0,
                                                notProvenClaimCount: 0,
                                                rejectedClaimCount: 0,
                                                reviewCardCount: 1,
                                                completedReviewCardCount: 0,
                                                remainingReviewCardCount: 1,
                                            },
                                        },
                                        graphContext: {
                                            anchorAtomId: 'atom_blocks_1',
                                            anchorTitle: 'Blocks Citation',
                                            supportingAtomIds: ['atom_blocks_1_foundation'],
                                            supportingTitles: ['Blocks Foundation'],
                                            relationKinds: ['prerequisite'],
                                            relationSummaries: [],
                                            connectionPaths: [
                                                {
                                                    sourceAtomId: 'atom_blocks_1_foundation',
                                                    sourceTitle: 'Blocks Foundation',
                                                    targetAtomId: 'atom_blocks_1',
                                                    targetTitle: 'Blocks Citation',
                                                    pathAtomIds: ['atom_blocks_1_foundation', 'atom_blocks_1'],
                                                    pathTitles: ['Blocks Foundation', 'Blocks Citation'],
                                                    pathEdges: [
                                                        {
                                                            fromAtomId: 'atom_blocks_1_foundation',
                                                            toAtomId: 'atom_blocks_1',
                                                            relationKind: 'prerequisite',
                                                        },
                                                    ],
                                                    length: 1,
                                                },
                                            ],
                                            predecessorWindow: [
                                                {
                                                    atomId: 'atom_blocks_1_foundation',
                                                    title: 'Blocks Foundation',
                                                    relationKind: 'prerequisite',
                                                    confidence: 0.91,
                                                },
                                            ],
                                            successorWindow: [],
                                            evidenceSourceRefs: ['Knowledge_Base/optics/blocks.md:18'],
                                            diagnostics: {
                                                graphOpsAvailable: true,
                                                usedFallback: false,
                                                selectedAnchorReason: 'title_mention',
                                                candidateCount: 1,
                                                supportNodeCount: 1,
                                                supportNodeLimit: 2,
                                                pathDepthLimit: 6,
                                                missingConnectionPathSourceAtomIds: [],
                                                missingPredecessorAtomIds: [],
                                                missingSuccessorAtomIds: [],
                                            },
                                            temporalValidity: {
                                                checkedAt: '2026-04-13T00:01:00.000Z',
                                                allPointsValid: true,
                                                warningReasons: [],
                                                invalidKnowledgePointTitles: [],
                                            },
                                        },
                                    },
                                },
                            ]
                            : [
                                {
                                    artifactId: 'workflow_artifact_flashcard_batch_1',
                                    kind: 'flashcard_batch',
                                    sessionId: 'session_client_path_user_default_test',
                                    userId: 'path_user_default',
                                    workspaceId: 'waterglass',
                                    corpusId: 'waterglass',
                                    title: 'Knowledge run review cards: Water Glass',
                                    sourceResourceIds: ['resource_1'],
                                    sourceProjectionIds: ['projection_1'],
                                    summary: 'Prepared 1 review card from cited claims.',
                                    status: 'active',
                                    createdAt: '2026-04-12T00:20:00.000Z',
                                    updatedAt: '2026-04-12T00:20:00.000Z',
                                    payload: {
                                        runId: 'knowledge_run_1',
                                        reviewCards: [
                                            {
                                                cardId: 'knowledge_run_1_card_1',
                                                sourceClaimId: 'knowledge_run_1_claim_1',
                                                atomId: 'atom_water_glass',
                                                suggestedActionKind: 'review',
                                                prompt: 'What does the cited source establish about Water Glass?',
                                                expectedAnswer: 'A water glass is a physical system.',
                                                evidenceRefs: ['Knowledge_Base/waterglass/water glass.md:3'],
                                                nextReviewAt: '2026-04-13T00:20:00.000Z',
                                            },
                                        ],
                                        evidenceClaims: [
                                            {
                                                claimId: 'knowledge_run_1_claim_1',
                                                title: 'Water Glass',
                                                status: 'verified',
                                            },
                                        ],
                                        reviewState: {
                                            consumedCardIds: [],
                                            completedReviewCardCount: 0,
                                            remainingReviewCardCount: 1,
                                            completedAt: null,
                                        },
                                    },
                                },
                            ],
                    },
                }),
            };
        }
        if (url === '/api/knowledge/session/action') {
            let parsedBody: Record<string, unknown> = {};
            if (init && typeof init.body === 'string' && init.body.trim().length > 0) {
                try {
                    parsedBody = JSON.parse(init.body);
                } catch (_error) {
                    parsedBody = {};
                }
            }
            const action = parsedBody.action && typeof parsedBody.action === 'object'
                ? parsedBody.action as Record<string, unknown>
                : {};
            return {
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    result: {
                        sessionId: String(parsedBody.sessionId || 'session_client_path_user_default_test'),
                        executedAt: '2026-04-12T00:21:00.000Z',
                        tutor: {
                            message: `Reviewed ${String(action.atomId || '')} via ${String(action.kind || '')}.`,
                            suggestedActions: [],
                            evidenceSpans: [
                                {
                                    id: 'ev_review_1',
                                    snippet: 'A water glass is a physical system.',
                                },
                            ],
                            trace: {
                                actionKind: 'recap',
                                confidence: 0.88,
                                evidenceSpanIds: ['ev_review_1'],
                                relationPathAtomIds: [String(action.atomId || '')],
                                source: 'rule-engine',
                                notes: 'review execution',
                                traceId: 'trace_review_1',
                            },
                        },
                        answerAnalysis: null,
                        memory: null,
                        promotedMemory: null,
                        mastery: null,
                        trace: {
                            tutorActionKind: 'recap',
                            persistedMemory: true,
                            updatedMastery: false,
                            analyzedAnswer: false,
                            masterySource: 'none',
                            effectiveOutcome: null,
                            effectiveErrorTag: null,
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
                            sampleReady: true,
                            selectionActive: true,
                            stableConnector: true,
                            canEvaluateCandidateRatio: true,
                            warnBudgetExceeded: false,
                            failBudgetExceeded: false,
                            budget: {
                                minRequestSampleGte: 8,
                                warnCandidateRatioPctLt: 35,
                                failCandidateRatioPctLt: 60,
                            },
                        },
                        queryVectorAccelerationCalibrationReadiness: {
                            checkId: 'query_vector_acceleration_calibration_readiness',
                            status: 'warn',
                            mode: 'ann_prefilter',
                            externalConnector: true,
                            syncReady: true,
                            sampleReady: true,
                            selectionActive: true,
                            stableConnector: true,
                            canEvaluateCandidateRatio: true,
                            traceabilityReady: false,
                            circuitBudgetStatus: 'warn',
                            prefilterBudgetStatus: 'ok',
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
                                warnBudgetExceeded: false,
                                failBudgetExceeded: false,
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
                                sampleReady: true,
                                selectionActive: true,
                                stableConnector: true,
                                canEvaluateCandidateRatio: true,
                                warnBudgetExceeded: false,
                                failBudgetExceeded: false,
                                budget: {
                                    minRequestSampleGte: 10,
                                    warnCandidateRatioPctLt: 25,
                                    failCandidateRatioPctLt: 50,
                                },
                            },
                            queryVectorAccelerationCalibrationReadiness: {
                                checkId: 'query_vector_acceleration_calibration_readiness',
                                status: 'pass',
                                mode: 'ann_prefilter',
                                externalConnector: true,
                                syncReady: true,
                                sampleReady: true,
                                selectionActive: true,
                                stableConnector: true,
                                canEvaluateCandidateRatio: true,
                                traceabilityReady: true,
                                circuitBudgetStatus: 'ok',
                                prefilterBudgetStatus: 'ok',
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
        resolveNodeByKnowledgePoint: jest.fn(() => null),
        openFocusModeById: jest.fn(),
        getFocusModeSnapshot: jest.fn(() => null),
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

    loadScriptIntoSandbox(sandbox, markdownRuntimeScriptPath, 'markdown_runtime.js');
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
    test('supports parallel graph-focus, evidence, and learning-path panes with exclusive workspace promotion state', () => {
        const { controller, document } = loadWorkspacePanesHarness();
        controller.init();

        controller.openGraphFocusPane({
            atomId: 'atom_retrieval',
            title: 'Retrieval Foundations',
            summary: 'Evidence-first retrieval keeps answers grounded.',
        });
        controller.openEvidencePane({
            kind: 'grounding',
            title: 'Grounding Inspector',
            scopeLabel: 'waterglass',
            citationCount: 2,
            memoryCount: 1,
            memoryActionCount: 1,
        });
        controller.openLearningPathPane({
            atomId: 'atom_paths',
            title: 'Learning Paths',
            items: [
                { atomId: 'atom_paths', title: 'Learning Paths' },
            ],
        });

        const graphPane = document.getElementById('agent-graph-focus-pane');
        const evidencePane = document.getElementById('agent-evidence-pane');
        const learningPane = document.getElementById('agent-learning-path-pane');
        expect(graphPane?.getAttribute('data-open')).toBe('true');
        expect(evidencePane?.getAttribute('data-open')).toBe('true');
        expect(learningPane?.getAttribute('data-open')).toBe('true');
        expect(document.body.getAttribute('data-agent-workspace-layout')).toBe('split');

        controller.setPaneFullscreen('graph-focus', true);
        expect(graphPane?.getAttribute('data-fullscreen')).toBe('true');
        expect(evidencePane?.getAttribute('data-fullscreen')).toBe('false');
        expect(learningPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(document.body.getAttribute('data-agent-workspace-promotion')).toBe('graph-focus');

        controller.setPaneFullscreen('evidence', true);
        expect(graphPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(evidencePane?.getAttribute('data-fullscreen')).toBe('true');
        expect(learningPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(document.body.getAttribute('data-agent-workspace-promotion')).toBe('evidence');

        controller.setPaneFullscreen('learning-path', true);
        expect(graphPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(evidencePane?.getAttribute('data-fullscreen')).toBe('false');
        expect(learningPane?.getAttribute('data-fullscreen')).toBe('true');
        expect(document.body.getAttribute('data-agent-workspace-promotion')).toBe('learning-path');

        controller.setPaneFullscreen('learning-path', false);
        expect(graphPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(evidencePane?.getAttribute('data-fullscreen')).toBe('false');
        expect(learningPane?.getAttribute('data-fullscreen')).toBe('false');
        expect(document.body.hasAttribute('data-agent-workspace-promotion')).toBe(false);
    });

    test('close buttons independently clear right-side knowledge workspace panes', () => {
        const { controller, document } = loadWorkspacePanesHarness({ withI18n: true });
        controller.init();

        controller.openGraphFocusPane({
            atomId: 'atom_focus',
            title: 'Focus Node',
            summary: 'Focus content.',
        });
        controller.openEvidencePane({
            kind: 'grounding',
            title: 'Evidence Inspector',
            scope: 'waterglass',
        });
        controller.openLearningPathPane({
            atomId: 'atom_paths',
            graphTargetId: 'water glass',
            graphTargetLabel: 'water glass',
            title: 'water glass',
            items: [{ atomId: 'atom_paths', title: 'water glass' }],
        });

        controller.setPaneFullscreen('learning-path', true);
        expect(document.getElementById('agent-graph-focus-pane')?.getAttribute('data-open')).toBe('true');
        expect(document.getElementById('agent-evidence-pane')?.getAttribute('data-open')).toBe('true');
        expect(document.getElementById('agent-learning-path-pane')?.getAttribute('data-open')).toBe('true');
        expect(document.body.getAttribute('data-agent-workspace-promotion')).toBe('learning-path');

        (document.getElementById('btn-agent-graph-focus-close') as HTMLButtonElement | null)?.click();
        expect(document.getElementById('agent-graph-focus-pane')?.getAttribute('data-open')).toBe('false');
        expect(String(document.getElementById('agent-graph-focus-body')?.textContent || '')).toContain('Graph focus pane is idle.');

        (document.getElementById('btn-agent-evidence-close') as HTMLButtonElement | null)?.click();
        expect(document.getElementById('agent-evidence-pane')?.getAttribute('data-open')).toBe('false');
        expect(String(document.getElementById('agent-evidence-body')?.textContent || '')).toContain('Evidence pane is idle.');

        (document.getElementById('btn-agent-learning-path-close') as HTMLButtonElement | null)?.click();
        expect(document.getElementById('agent-learning-path-pane')?.getAttribute('data-open')).toBe('false');
        expect(document.getElementById('agent-learning-path-pane')?.getAttribute('data-fullscreen')).toBe('false');
        expect(document.body.hasAttribute('data-agent-workspace-promotion')).toBe(false);
        expect(String(document.getElementById('agent-learning-path-body')?.textContent || '')).toContain('Learning path pane is idle.');
    });

    test('opens and clears the evidence pane with grounding and artifact payloads', () => {
        const { controller, document } = loadWorkspacePanesHarness({ withI18n: true });
        controller.init();

        controller.openEvidencePane({
            kind: 'grounding',
            title: 'Grounding Inspector',
            scopeLabel: 'waterglass',
            citationCount: 3,
            memoryCount: 1,
            memoryActionCount: 2,
            readinessMessage: 'Workspace hydrated.',
            missMessage: 'Recovered document outside requested scope.',
            graphContext: {
                anchorAtomId: 'atom_reflection',
                anchorTitle: 'Reflection',
                anchorDocumentId: 'doc_reflection',
                supportingAtomIds: ['atom_phase', 'atom_interference'],
                supportingTitles: ['Phase Matching', 'Interference'],
                relationKinds: ['prerequisite', 'reference'],
                relationSummaries: [
                    {
                        relationKind: 'prerequisite',
                        edgeIds: ['edge_prereq_1'],
                        targetAtomIds: ['atom_phase'],
                        averageConfidence: 0.92,
                    },
                    {
                        relationKind: 'reference',
                        edgeIds: ['edge_ref_1'],
                        targetAtomIds: ['atom_interference'],
                        averageConfidence: 0.8,
                    },
                ],
                connectionPaths: [
                    {
                        sourceAtomId: 'atom_foundation',
                        sourceTitle: 'Foundation Note',
                        targetAtomId: 'atom_reflection',
                        targetTitle: 'Reflection',
                        pathAtomIds: ['atom_foundation', 'atom_bridge', 'atom_reflection'],
                        pathTitles: ['Foundation Note', 'Bridge Layer', 'Reflection'],
                        pathEdges: [
                            {
                                fromAtomId: 'atom_foundation',
                                toAtomId: 'atom_bridge',
                                relationKind: 'prerequisite',
                            },
                            {
                                fromAtomId: 'atom_bridge',
                                toAtomId: 'atom_reflection',
                                relationKind: 'reference',
                            },
                        ],
                        length: 2,
                    },
                ],
                predecessorWindow: [
                    {
                        atomId: 'atom_bridge',
                        title: 'Bridge Layer',
                        relationKind: 'prerequisite',
                        confidence: 0.91,
                    },
                ],
                successorWindow: [
                    {
                        atomId: 'atom_application',
                        title: 'Application Example',
                        relationKind: 'sequence',
                        confidence: 0.74,
                    },
                ],
                evidenceSourceRefs: [
                    'Knowledge_Base/optics/foundation.md:4',
                    'Knowledge_Base/optics/reflection.md:12',
                ],
                diagnostics: {
                    graphOpsAvailable: true,
                    usedFallback: false,
                    selectedAnchorReason: 'title_mention',
                    candidateCount: 3,
                    supportNodeCount: 2,
                    supportNodeLimit: 3,
                    pathDepthLimit: 6,
                    missingConnectionPathSourceAtomIds: [],
                    missingPredecessorAtomIds: [],
                    missingSuccessorAtomIds: [],
                },
                temporalValidity: {
                    checkedAt: '2026-06-10T09:00:00.000Z',
                    allPointsValid: false,
                    warningReasons: ['temporal_edge_expired'],
                    invalidKnowledgePointTitles: ['Reflection'],
                    edgeKinds: ['supersedes'],
                    details: [
                        {
                            edgeId: 'temporal_support_supersedes',
                            edgeKind: 'supersedes',
                            sourceAtomId: 'atom_support_older',
                            targetAtomId: 'atom_support',
                            validFrom: '2026-06-09T00:00:00.000Z',
                            isActive: true,
                        },
                    ],
                },
            },
        });

        const evidencePane = document.getElementById('agent-evidence-pane');
        const evidenceBody = document.getElementById('agent-evidence-body');
        expect(evidencePane?.getAttribute('data-open')).toBe('true');
        expect(String(evidenceBody?.textContent || '')).toContain('Grounding Inspector');
        expect(String(evidenceBody?.textContent || '')).toContain('waterglass');
        expect(String(evidenceBody?.textContent || '')).toContain('Workspace hydrated.');
        expect(String(evidenceBody?.textContent || '')).toContain('Recovered document outside requested scope.');
        expect(String(evidenceBody?.textContent || '')).toContain('Graph context');
        expect(String(evidenceBody?.textContent || '')).toContain('Reflection');
        expect(String(evidenceBody?.textContent || '')).toContain('Phase Matching');
        expect(String(evidenceBody?.textContent || '')).toContain('Connection paths');
        expect(String(evidenceBody?.textContent || '')).toContain('Foundation Note -> Bridge Layer -> Reflection');
        expect(String(evidenceBody?.textContent || '')).toContain('Length: 2');
        expect(String(evidenceBody?.textContent || '')).toContain('Immediate predecessors');
        expect(String(evidenceBody?.textContent || '')).toContain('Bridge Layer');
        expect(String(evidenceBody?.textContent || '')).toContain('Immediate successors');
        expect(String(evidenceBody?.textContent || '')).toContain('Application Example');
        expect(String(evidenceBody?.textContent || '')).toContain('Source references');
        expect(String(evidenceBody?.textContent || '')).toContain('Knowledge_Base/optics/foundation.md:4');
        expect(String(evidenceBody?.textContent || '')).toContain('Graph diagnostics');
        expect(String(evidenceBody?.textContent || '')).toContain('title_mention');
        expect(String(evidenceBody?.textContent || '')).toContain('Targets: 1');
        expect(String(evidenceBody?.textContent || '')).toContain('Avg confidence: 92%');
        expect(String(evidenceBody?.textContent || '')).toContain('temporal_edge_expired');
        expect(String(evidenceBody?.textContent || '')).toContain('warning');
        expect(String(evidenceBody?.textContent || '')).toContain('supersedes');
        expect(String(evidenceBody?.textContent || '')).toContain('atom_support_older');

        controller.openEvidencePane({
            kind: 'knowledge_run',
            title: 'Knowledge Run Inspector',
            runId: 'knowledge_run_blocks_1',
            qualityStatus: 'pass',
            qualityScore: 100,
            claimCount: 1,
        });
        expect(String(evidenceBody?.textContent || '')).toContain('Knowledge Run Inspector');
        expect(String(evidenceBody?.textContent || '')).toContain('knowledge_run_blocks_1');
        expect(String(evidenceBody?.textContent || '')).toContain('pass');

        controller.clearEvidencePane();
        expect(evidencePane?.getAttribute('data-open')).toBe('false');
        expect(String(evidenceBody?.textContent || '')).toContain('Evidence pane is idle.');
    });

    test('rerenders grounding evidence panes with localized graph-context labels when language changes', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        controller.init();

        controller.openEvidencePane({
            kind: 'grounding',
            title: 'Grounding Inspector',
            scopeLabel: 'waterglass',
            citationCount: 1,
            memoryCount: 0,
            memoryActionCount: 0,
            graphContext: {
                anchorAtomId: 'atom_reflection',
                anchorTitle: 'Reflection',
                anchorDocumentId: 'doc_reflection',
                supportingAtomIds: ['atom_phase'],
                supportingTitles: ['Phase Matching'],
                relationKinds: ['prerequisite'],
                relationSummaries: [
                    {
                        relationKind: 'prerequisite',
                        edgeIds: ['edge_prereq_1'],
                        targetAtomIds: ['atom_phase'],
                        averageConfidence: 0.92,
                    },
                ],
                connectionPaths: [
                    {
                        sourceAtomId: 'atom_foundation',
                        sourceTitle: 'Foundation Note',
                        targetAtomId: 'atom_reflection',
                        targetTitle: 'Reflection',
                        pathAtomIds: ['atom_foundation', 'atom_phase', 'atom_reflection'],
                        pathTitles: ['Foundation Note', 'Phase Matching', 'Reflection'],
                        pathEdges: [
                            {
                                fromAtomId: 'atom_foundation',
                                toAtomId: 'atom_phase',
                                relationKind: 'prerequisite',
                            },
                            {
                                fromAtomId: 'atom_phase',
                                toAtomId: 'atom_reflection',
                                relationKind: 'reference',
                            },
                        ],
                        length: 2,
                    },
                ],
                temporalValidity: {
                    checkedAt: '2026-06-10T09:00:00.000Z',
                    allPointsValid: true,
                    warningReasons: [],
                    invalidKnowledgePointTitles: [],
                    edgeKinds: ['supersedes'],
                    details: [
                        {
                            edgeId: 'temporal_support_supersedes',
                            edgeKind: 'supersedes',
                            sourceAtomId: 'atom_support_older',
                            targetAtomId: 'atom_phase',
                            validFrom: '2026-06-09T00:00:00.000Z',
                            isActive: true,
                        },
                    ],
                },
            },
        });

        const evidenceBody = document.getElementById('agent-evidence-body');
        expect(String(evidenceBody?.textContent || '')).toContain('Graph context');
        expect(String(evidenceBody?.textContent || '')).toContain('Anchor');
        expect(String(evidenceBody?.textContent || '')).toContain('Relation summaries');
        expect(String(evidenceBody?.textContent || '')).toContain('Connection paths');
        expect(String(evidenceBody?.textContent || '')).toContain('Temporal validity');

        await window.i18n.setLanguage('zh');

        expect(String(evidenceBody?.textContent || '')).toContain('图结构上下文');
        expect(String(evidenceBody?.textContent || '')).toContain('锚点');
        expect(String(evidenceBody?.textContent || '')).toContain('关系摘要');
        expect(String(evidenceBody?.textContent || '')).toContain('连接路径');
        expect(String(evidenceBody?.textContent || '')).toContain('时序有效性');
        expect(String(evidenceBody?.textContent || '')).toContain('有效');
        expect(String(evidenceBody?.textContent || '')).toContain('supersedes');
    });

    test('opens Godot Future Path without moving the browser path workspace into the pane', () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const openGodotFuturePathById = jest.fn();
        (window as any).NoteConnectionPathMode = {
            openGodotFuturePathById,
        };
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
        expect(learningPaneBody?.querySelector('[data-agent-godot-future-path-shell="true"]')).not.toBeNull();
        expect(learningPaneBody?.querySelector('#path-container')).toBeNull();
        expect(originalParent?.querySelector('#path-container')).not.toBeNull();
        expect(pathContainer?.style.display).toBe('none');
        expect(openGodotFuturePathById).toHaveBeenCalledWith('atom_paths', expect.objectContaining({
            config: expect.objectContaining({
                mode: 'diffusion',
                strategy: 'core',
                targetId: 'atom_paths',
                targetIds: ['atom_paths'],
            }),
        }));

        controller.clearLearningPathPane();

        expect(originalParent?.querySelector('#path-container')).not.toBeNull();
        expect(pathContainer?.style.display).toBe('none');
    });

    test('renders only fixed graph-learning actions in the primary hit list', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        const graphView = {
            openFocusModeById: jest.fn(() => true),
        };
        (window as any).NoteConnectionGraphView = graphView;
        const onCapability = jest.fn();
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
            onCapability,
        });

        const knowledgeRegion = document.getElementById('agent-workspace-knowledge-points');
        expect(knowledgeRegion?.getAttribute('data-agent-knowledge-scrollable')).toBe('true');
        expect(document.querySelector('.agent-knowledge-click-hint')).toBeNull();
        expect(String(knowledgeRegion?.textContent || '')).not.toContain('Left-click a matched file');

        const helpButton = document.querySelector('[data-agent-knowledge-help-button="true"]') as HTMLButtonElement | null;
        const helpPopover = document.querySelector('[data-agent-knowledge-help-popover="true"]') as HTMLElement | null;
        expect(helpButton).not.toBeNull();
        expect(helpButton?.textContent?.trim()).toBe('?');
        expect(helpButton?.getAttribute('aria-expanded')).toBe('false');
        expect(helpPopover).not.toBeNull();
        expect(helpPopover?.hasAttribute('hidden')).toBe(true);
        const helpPopoverId = helpPopover?.id || '';
        expect(helpPopoverId).toMatch(/^agent-knowledge-help-popover-\d+$/);
        expect(helpButton?.getAttribute('aria-describedby')).toBe(helpPopoverId);

        helpButton?.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));
        expect(helpButton?.getAttribute('aria-expanded')).toBe('true');
        expect(helpPopover?.hasAttribute('hidden')).toBe(false);
        expect(helpPopover?.textContent || '').toContain('Left-click a matched file');

        helpButton?.dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: true }));
        expect(helpButton?.getAttribute('aria-expanded')).toBe('false');
        expect(helpPopover?.hasAttribute('hidden')).toBe(true);

        helpButton?.dispatchEvent(new window.FocusEvent('focus'));
        expect(helpButton?.getAttribute('aria-expanded')).toBe('true');
        expect(helpPopover?.hasAttribute('hidden')).toBe(false);
        expect(helpPopover?.textContent || '').toContain('Left-click a matched file');

        helpButton?.dispatchEvent(new window.FocusEvent('blur', { relatedTarget: document.body }));
        expect(helpButton?.getAttribute('aria-expanded')).toBe('false');
        expect(helpPopover?.hasAttribute('hidden')).toBe(true);

        helpButton?.click();
        expect(helpButton?.getAttribute('aria-expanded')).toBe('true');
        expect(helpPopover?.hasAttribute('hidden')).toBe(false);
        document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        expect(helpButton?.getAttribute('aria-expanded')).toBe('false');
        expect(helpPopover?.hasAttribute('hidden')).toBe(true);

        const buttonsBefore = Array.from(
            document.querySelectorAll('.agent-knowledge-actions button')
        ) as HTMLButtonElement[];
        expect(buttonsBefore.map((node) => node.textContent)).toEqual(['Learning Path', 'Related Focus']);
        expect(buttonsBefore.map((node) => node.getAttribute('data-agent-knowledge-action'))).toEqual([
            'learning-path',
            'related-focus',
        ]);

        buttonsBefore[0]?.click();
        expect(onCapability).toHaveBeenCalledTimes(1);
        expect(onCapability.mock.calls[0]?.[1]?.actionId).toBe('open_learning_path');

        buttonsBefore[1]?.click();
        expect(graphView?.openFocusModeById).toHaveBeenCalledWith('atom_paths');
        expect(document.getElementById('agent-graph-focus-pane')?.getAttribute('data-open')).toBe('true');

        await window.i18n.setLanguage('zh');

        const translatedKnowledgeRegion = document.getElementById('agent-workspace-knowledge-points');
        expect(String(translatedKnowledgeRegion?.textContent || '')).not.toContain('左键单击');
        const translatedHelpButton = document.querySelector('[data-agent-knowledge-help-button="true"]') as HTMLButtonElement | null;
        const translatedHelpPopover = document.querySelector('[data-agent-knowledge-help-popover="true"]') as HTMLElement | null;
        expect(translatedHelpPopover?.id).not.toBe(helpPopoverId);
        expect(translatedHelpButton?.getAttribute('aria-describedby')).toBe(translatedHelpPopover?.id);
        translatedHelpButton?.click();
        expect(translatedHelpPopover?.hasAttribute('hidden')).toBe(false);
        expect(translatedHelpPopover?.textContent || '').toContain('左键单击');

        const buttonsAfter = Array.from(
            document.querySelectorAll('.agent-knowledge-actions button')
        ).map((node) => node.textContent);
        expect(buttonsAfter).toEqual(['学习路径', '关联聚焦']);
    });

    test('keeps the left knowledge workspace pane vertically scrollable when hit actions overflow the viewport', () => {
        const stylesPath = path.join(__dirname, 'frontend', 'styles.css');
        const styles = fs.readFileSync(stylesPath, 'utf8');
        const chatPaneRule = styles.match(/\.agent-chat-pane\s*\{[^}]*\}/)?.[0] || '';

        expect(chatPaneRule).toContain('overflow-x: hidden');
        expect(chatPaneRule).toContain('overflow-y: auto');
        expect(chatPaneRule).toContain('overscroll-behavior: contain');
        expect(chatPaneRule).toContain('scrollbar-gutter: stable');
        expect(chatPaneRule).not.toContain('overflow: hidden');
    });

    test('docks the existing graph Focus mode runtime with resolved node names instead of atom ids', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        const graphView = {
            resolveNodeByKnowledgePoint: jest.fn(() => ({ id: 'water glass', label: 'water glass' })),
            openFocusModeById: jest.fn(() => true),
            getFocusModeSnapshot: jest.fn(),
        };
        (window as any).NoteConnectionGraphView = graphView;
        controller.init();
        const graphContainer = document.getElementById('graph-container') as HTMLElement | null;
        const originalParent = graphContainer?.parentElement;
        const originalNextSibling = graphContainer?.nextSibling;
        let preservedDoubleClickCount = 0;
        graphContainer?.addEventListener('dblclick', () => {
            preservedDoubleClickCount += 1;
        });

        controller.renderKnowledgePoints([
            {
                atomId: 'atom_h',
                title: 'water glass',
                summary: 'A water glass node from the local knowledge graph.',
                relationPath: [
                    { sourceAtomId: 'atom_f', targetAtomId: 'atom_h', relationKind: 'sequence', confidence: 0.98 },
                    { sourceAtomId: 'atom_h', targetAtomId: 'atom_j', relationKind: 'application', confidence: 0.95 },
                    { sourceAtomId: 'atom_h', targetAtomId: 'atom_v', relationKind: 'analogy', confidence: 0.91 },
                ],
                relationKinds: ['sequence', 'application', 'analogy'],
            },
        ]);

        const relatedFocusButton = document.querySelector(
            '[data-agent-knowledge-action="related-focus"]'
        ) as HTMLButtonElement | null;
        relatedFocusButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(graphView.resolveNodeByKnowledgePoint).toHaveBeenCalled();
        expect(graphView.openFocusModeById).toHaveBeenCalledWith('water glass');
        expect(graphView.getFocusModeSnapshot).not.toHaveBeenCalled();

        const runtimeHost = document.querySelector('[data-agent-graph-focus-workspace-host="true"]');
        expect(runtimeHost).not.toBeNull();
        expect(runtimeHost?.querySelector('#graph-container')).toBe(graphContainer);
        expect(graphContainer?.classList.contains('agent-graph-focus-runtime-docked')).toBe(true);
        expect(document.querySelector('[data-agent-focus-mode-preview="true"]')).toBeNull();
        expect(document.querySelector('[data-agent-focus-relation-map="true"]')).toBeNull();
        expect(String(document.getElementById('agent-graph-focus-body')?.textContent || '')).not.toContain('atom_h');

        graphContainer?.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
        expect(preservedDoubleClickCount).toBe(1);

        controller.clearGraphFocusPane();
        expect(originalParent?.querySelector('#graph-container')).toBe(graphContainer);
        expect(graphContainer?.classList.contains('agent-graph-focus-runtime-docked')).toBe(false);
        if (originalNextSibling) {
            expect(graphContainer?.nextSibling).toBe(originalNextSibling);
        }
    });

    test('keeps the moved graph Focus mode runtime alive across repeated runtime pane renders', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        const graphView = {
            openFocusModeById: jest.fn(() => true),
            getFocusModeSnapshot: jest.fn(),
        };
        (window as any).NoteConnectionGraphView = graphView;
        controller.init();

        const graphContainer = document.getElementById('graph-container') as HTMLElement | null;
        const originalParent = graphContainer?.parentElement;
        const originalNextSibling = graphContainer?.nextSibling;
        const retainedRuntimeChild = document.createElement('button');
        retainedRuntimeChild.setAttribute('data-runtime-marker', 'preserved');
        retainedRuntimeChild.textContent = 'runtime control';
        graphContainer?.appendChild(retainedRuntimeChild);
        let preservedDoubleClickCount = 0;
        graphContainer?.addEventListener('dblclick', () => {
            preservedDoubleClickCount += 1;
        });

        controller.openGraphFocusPane({
            atomId: 'atom_h',
            graphNodeId: 'water glass',
            graphNodeLabel: 'water glass',
            title: 'water glass',
            presentationMode: 'focus-mode',
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        const firstRuntimeHost = document.querySelector('[data-agent-graph-focus-workspace-host="true"]');
        expect(firstRuntimeHost?.querySelector('#graph-container')).toBe(graphContainer);
        expect(graphView.openFocusModeById).toHaveBeenLastCalledWith('water glass');

        controller.openGraphFocusPane({
            atomId: 'atom_heat',
            graphNodeId: 'heat transfer',
            graphNodeLabel: 'heat transfer',
            title: 'heat transfer',
            presentationMode: 'focus-mode',
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        const secondRuntimeHost = document.querySelector('[data-agent-graph-focus-workspace-host="true"]');
        expect(secondRuntimeHost?.querySelector('#graph-container')).toBe(graphContainer);
        expect(document.querySelectorAll('#graph-container')).toHaveLength(1);
        expect(graphContainer?.querySelector('[data-runtime-marker="preserved"]')).toBe(retainedRuntimeChild);
        expect(graphContainer?.classList.contains('agent-graph-focus-runtime-docked')).toBe(true);
        expect(graphView.openFocusModeById).toHaveBeenLastCalledWith('heat transfer');
        expect(graphView.getFocusModeSnapshot).not.toHaveBeenCalled();

        graphContainer?.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
        expect(preservedDoubleClickCount).toBe(1);

        controller.clearGraphFocusPane();
        expect(originalParent?.querySelector('#graph-container')).toBe(graphContainer);
        expect(graphContainer?.classList.contains('agent-graph-focus-runtime-docked')).toBe(false);
        if (originalNextSibling) {
            expect(graphContainer?.nextSibling).toBe(originalNextSibling);
        }
    });

    test('shows related-focus backend details only when developer mode is enabled', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        const graphView = {
            resolveNodeByKnowledgePoint: jest.fn(() => ({ id: 'water glass', label: 'water glass' })),
            openFocusModeById: jest.fn(() => true),
            getFocusModeSnapshot: jest.fn(() => ({
                anchorId: 'water glass',
                anchorLabel: 'water glass',
                nodes: [
                    { id: 'water glass', label: 'water glass', role: 'anchor', x: 50, y: 50 },
                    { id: 'sequence', label: 'sequence', role: 'incoming', x: 22, y: 40 },
                    { id: 'application', label: 'application', role: 'outgoing', x: 78, y: 60 },
                ],
                edges: [
                    { sourceId: 'sequence', targetId: 'water glass', relationKind: 'sequence', confidence: 0.98 },
                    { sourceId: 'water glass', targetId: 'application', relationKind: 'application', confidence: 0.95 },
                ],
            })),
        };
        (window as any).NoteConnectionGraphView = graphView;
        (window as any).__NC_AGENT_WORKSPACE_DEVELOPER_MODE = true;
        controller.init();

        controller.renderKnowledgePoints([
            {
                atomId: 'atom_h',
                title: 'water glass',
                summary: 'A water glass node from the local knowledge graph.',
                relationPath: [
                    {
                        sourceAtomId: 'atom_f',
                        sourceTitle: 'sequence',
                        targetAtomId: 'atom_h',
                        targetTitle: 'water glass',
                        relationKind: 'sequence',
                        confidence: 0.98,
                    },
                    {
                        sourceAtomId: 'atom_h',
                        sourceTitle: 'water glass',
                        targetAtomId: 'atom_j',
                        targetTitle: 'application',
                        relationKind: 'application',
                        confidence: 0.95,
                    },
                ],
                relationKinds: ['sequence', 'application'],
            },
        ]);

        const relatedFocusButton = document.querySelector(
            '[data-agent-knowledge-action="related-focus"]'
        ) as HTMLButtonElement | null;
        relatedFocusButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(document.querySelector('[data-agent-graph-focus-workspace-host="true"] #graph-container')).not.toBeNull();
        const relationMap = document.querySelector('[data-agent-focus-relation-map="true"]');
        expect(relationMap?.getAttribute('data-agent-focus-developer-mode')).toBe('true');
        expect(relationMap?.querySelector('[data-agent-focus-developer-details="true"]')).not.toBeNull();
        expect(relationMap?.querySelector('.agent-focus-relation-kinds')?.textContent || '').toContain('sequence');
        expect(relationMap?.querySelector('.agent-focus-relation-edges')).not.toBeNull();
    });

    test('dispatches Godot Future Path with resolved node names for relation hits', () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        const graphView = {
            resolveNodeByKnowledgePoint: jest.fn(() => ({ id: 'water glass', label: 'water glass' })),
        };
        const pathApp = {
            init: jest.fn(),
            switchCentral: jest.fn(),
            applyRemoteConfigure: jest.fn(),
            triggerUpdate: jest.fn(),
        };
        (window as any).NoteConnectionGraphView = graphView;
        (window as any).pathApp = pathApp;
        controller.init();

        controller.renderKnowledgePoints([
            {
                atomId: 'atom_h',
                title: 'water glass',
                summary: 'A water glass node from the local knowledge graph.',
                relationPath: [
                    {
                        sourceAtomId: 'atom_f',
                        sourceTitle: 'sequence',
                        targetAtomId: 'atom_h',
                        targetTitle: 'water glass',
                        relationKind: 'sequence',
                        confidence: 0.98,
                    },
                    {
                        sourceAtomId: 'atom_h',
                        sourceTitle: 'water glass',
                        targetAtomId: 'atom_j',
                        targetTitle: 'application',
                        relationKind: 'application',
                        confidence: 0.95,
                    },
                ],
                relationKinds: ['sequence', 'application'],
            },
        ]);

        const learningPathButton = document.querySelector(
            '[data-agent-knowledge-action="learning-path"]'
        ) as HTMLButtonElement | null;
        learningPathButton?.click();

        expect(document.querySelector('[data-agent-godot-future-path-shell="true"]')).not.toBeNull();
        expect(document.querySelector('#agent-learning-path-body #path-container')).toBeNull();
        expect(document.querySelector('[data-agent-path-mode-preview="true"]')).toBeNull();
        expect(pathApp.init).toHaveBeenCalledWith('water glass');
        expect(pathApp.applyRemoteConfigure).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'diffusion',
            strategy: 'core',
            targetId: 'water glass',
            targetIds: ['water glass'],
        }));
        expect(pathApp.triggerUpdate).toHaveBeenCalled();
        expect(document.getElementById('agent-graph-focus-pane')?.getAttribute('data-open')).not.toBe('true');
        const bodyText = String(document.getElementById('agent-learning-path-body')?.textContent || '');
        expect(bodyText).toContain('water glass');
        expect(bodyText).not.toContain('atom_h');
    });

    test('uses the DAG node id for Godot Future Path while keeping node labels visible', () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        const graphView = {
            resolveNodeByKnowledgePoint: jest.fn(() => ({ id: 'atom_h', label: 'water glass' })),
        };
        const pathApp = {
            init: jest.fn(),
            switchCentral: jest.fn(),
            applyRemoteConfigure: jest.fn(),
            triggerUpdate: jest.fn(),
            runtimeConfig: {},
            nodes: [],
        };
        (window as any).graphData = {
            nodes: [
                { id: 'atom_f', label: 'sequence' },
                { id: 'atom_h', label: 'water glass', sourcePath: 'Knowledge_Base/waterglass/water glass.md' },
                { id: 'atom_j', label: 'application' },
            ],
            edges: [
                { source: 'atom_f', target: 'atom_h', type: 'sequence' },
                { source: 'atom_h', target: 'atom_j', type: 'application' },
            ],
        };
        (window as any).NoteConnectionGraphView = graphView;
        (window as any).pathApp = pathApp;
        controller.init();

        controller.renderKnowledgePoints([
            {
                atomId: 'atom_h',
                title: 'water glass',
                matchedSpans: [
                    {
                        atomId: 'atom_h',
                        title: 'water glass',
                        sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                        snippet: 'A water glass is a physical system.',
                    },
                ],
                relationPath: [
                    {
                        sourceAtomId: 'atom_f',
                        sourceTitle: 'sequence',
                        targetAtomId: 'atom_h',
                        targetTitle: 'water glass',
                        relationKind: 'sequence',
                    },
                ],
            },
        ]);

        const learningPathButton = document.querySelector(
            '[data-agent-knowledge-action="learning-path"]'
        ) as HTMLButtonElement | null;
        learningPathButton?.click();

        expect(pathApp.init).toHaveBeenCalledWith('atom_h');
        expect(pathApp.applyRemoteConfigure).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'diffusion',
            strategy: 'core',
            targetId: 'atom_h',
            targetIds: ['atom_h'],
        }));
        expect((pathApp as any).currentTargetId).toBe('atom_h');
        expect((pathApp as any).centralNodeId).toBe('atom_h');
        const bodyText = String(document.getElementById('agent-learning-path-body')?.textContent || '');
        expect(bodyText).toContain('water glass');
        expect(bodyText).not.toContain('atom_h');
    });

    test('renders knowledge hits as file entries and opens graph focus from the right pane', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'A water glass is a physical system made of a transparent container and water.',
            '',
            'The water glass exchanges heat with the environment.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement, _markdown: string) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Water Glass</h2>
                    <p>A water glass is a physical system made of a transparent container and water.</p>
                    <p>The water glass exchanges heat with the environment.</p>
                </article>
            `;
        });
        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;
        const onCapability = jest.fn();
        controller.init();

        controller.renderKnowledgePoints([
            {
                atomId: 'atom_water_glass',
                documentId: 'doc_water_glass',
                title: 'Water Glass',
                summary: 'A water glass is a transparent container plus water.',
                evidenceSnippet: 'A water glass is a transparent container plus water.',
                matchCount: 2,
                matchedSpans: [
                    {
                        atomId: 'atom_water_glass',
                        title: 'Definition',
                        snippet: 'A water glass is a physical system made of a transparent container and water.',
                        sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                        startLine: 1,
                        score: 0.94,
                    },
                    {
                        atomId: 'atom_water_glass_thermal',
                        title: 'Thermal exchange',
                        snippet: 'The water glass exchanges heat with the environment.',
                        sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                        startLine: 6,
                        score: 0.81,
                    },
                ],
                relationPath: [
                    {
                        edgeId: 'edge_water_glass_material',
                        sourceAtomId: 'atom_glass_container',
                        targetAtomId: 'atom_water_glass',
                        relationKind: 'prerequisite',
                        confidence: 0.88,
                    },
                ],
                relationPathAtomIds: ['atom_glass_container', 'atom_water_glass'],
                relationKinds: ['prerequisite'],
                capabilities: [
                    {
                        actionId: 'open_focus_mode',
                        label: 'Focus',
                    },
                    {
                        actionId: 'open_learning_path',
                        label: 'Guided Learning',
                    },
                ],
            },
        ], {
            onCapability,
        });

        const cards = Array.from(document.querySelectorAll('.agent-knowledge-card'));
        expect(cards).toHaveLength(1);
        const fileButton = cards[0]?.querySelector('.agent-knowledge-file-button') as HTMLButtonElement;
        expect(fileButton).not.toBeNull();
        expect(String(fileButton?.textContent || '')).toBe('water glass.md');
        expect(cards[0]?.querySelector('.agent-knowledge-summary')).toBeNull();
        expect(cards[0]?.querySelectorAll('.agent-knowledge-hit')).toHaveLength(0);
        expect(String(cards[0]?.querySelector('.agent-knowledge-source-path')?.textContent || '')).toContain(
            'Knowledge_Base/waterglass/water glass.md'
        );

        fileButton.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const refreshedCard = document.querySelector('.agent-knowledge-card') as HTMLElement | null;
        const refreshedButton = refreshedCard?.querySelector('.agent-knowledge-file-button') as HTMLButtonElement | null;
        expect(refreshedButton?.getAttribute('aria-expanded')).toBeNull();
        expect(readContent).toHaveBeenCalledWith('Knowledge_Base/waterglass/water glass.md');
        expect(renderMarkdownInto).toHaveBeenCalled();
        expect(refreshedCard?.querySelector('.agent-knowledge-preview')).toBeNull();
        const graphPane = document.getElementById('agent-graph-focus-pane');
        const graphBody = document.getElementById('agent-graph-focus-body');
        expect(graphPane?.getAttribute('data-open')).toBe('true');
        expect(String(graphBody?.textContent || '')).toContain('A water glass is a physical system made of a transparent container and water.');
        expect(String(graphBody?.textContent || '')).toContain('atom_glass_container');
        expect(String(graphBody?.textContent || '')).not.toContain('Relation focus');
        expect(graphBody?.querySelector('[data-agent-focus-developer-details="true"]')).toBeNull();
        expect(graphBody?.querySelector('[data-agent-focus-relation-graph="true"]')).not.toBeNull();
        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted.length).toBeGreaterThan(0);
        expect(String(highlighted[0]?.textContent || '')).toContain('A water glass is a physical system');
        const actionButtons = Array.from(refreshedCard?.querySelectorAll('.agent-knowledge-actions button') || []);
        expect(actionButtons).toHaveLength(2);
        expect(actionButtons.map((button) => button.getAttribute('data-agent-knowledge-action'))).toEqual([
            'learning-path',
            'related-focus',
        ]);
        expect(onCapability).not.toHaveBeenCalled();
    });

    test('keeps file-first hit rendering stable across rerenders for the same result set', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness({ withI18n: true });
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'A water glass is a physical system made of a transparent container and water.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Water Glass</h2>
                    <p>A water glass is a physical system made of a transparent container and water.</p>
                </article>
            `;
        });
        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;
        controller.init();

        const items = [
            {
                atomId: 'atom_water_glass',
                documentId: 'doc_water_glass',
                title: 'Water Glass',
                summary: 'A water glass is a transparent container plus water.',
                evidenceSnippet: 'A water glass is a transparent container plus water.',
                matchedSpans: [
                    {
                        atomId: 'atom_water_glass',
                        title: 'Definition',
                        snippet: 'A water glass is a physical system made of a transparent container and water.',
                        sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                        startLine: 1,
                    },
                ],
                capabilities: [],
            },
        ];
        const handlers = {
            resultSetKey: 'result_set_waterglass_1',
        };

        controller.renderKnowledgePoints(items, handlers);
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        let fileButton = document.querySelector('.agent-knowledge-file-button') as HTMLButtonElement | null;
        expect(fileButton?.getAttribute('aria-expanded')).toBeNull();
        expect(document.querySelector('.agent-knowledge-preview')).toBeNull();

        fileButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        expect(readContent).toHaveBeenCalledWith('Knowledge_Base/waterglass/water glass.md');
        expect(renderMarkdownInto).toHaveBeenCalled();

        controller.renderKnowledgePoints(items, handlers);
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        fileButton = document.querySelector('.agent-knowledge-file-button') as HTMLButtonElement | null;
        expect(fileButton?.getAttribute('aria-expanded')).toBeNull();
        expect(document.querySelector('.agent-knowledge-preview')).toBeNull();

        await window.i18n.setLanguage('zh');

        fileButton = document.querySelector('.agent-knowledge-file-button') as HTMLButtonElement | null;
        expect(fileButton?.getAttribute('aria-expanded')).toBeNull();
        expect(document.querySelector('.agent-knowledge-preview')).toBeNull();
    });

    test('renders graph focus from source markdown and highlights matched passages in place', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Definition',
            '',
            'A water glass is a physical system often used in basic thermodynamics examples.',
            '',
            'The water glass exchanges heat with the environment.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement, markdown: string) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Definition</h2>
                    <p>A water glass is a physical system often used in basic thermodynamics examples.</p>
                    <p>The water glass exchanges heat with the environment.</p>
                </article>
            `;
        });

        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpans: [
                {
                    title: 'Definition',
                    snippet: 'A water glass is a physical system often used in basic thermodynamics examples.',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    startLine: 3,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        expect(readContent).toHaveBeenCalledWith('Knowledge_Base/waterglass/water glass.md');
        expect(renderMarkdownInto).toHaveBeenCalled();

        const graphBody = document.getElementById('agent-graph-focus-body');
        expect(String(graphBody?.textContent || '')).toContain('A water glass is a physical system often used in basic thermodynamics examples.');
        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted.length).toBeGreaterThan(0);
        expect(String(highlighted[0]?.textContent || '')).toContain('A water glass is a physical system');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            requestedSourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpanCount: 1,
            markdownRuntimeAvailable: true,
            storageProviderAvailable: true,
            readSucceeded: true,
            renderSucceeded: true,
            usedFallback: false,
            highlightedNodeCount: expect.any(Number),
            failureReason: '',
        }));
    });

    test('records graph focus diagnostics when source rendering falls back before markdown render', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        delete (window as any).NoteConnectionMarkdownRuntime;
        delete (window as any).NoteConnectionStorage;
        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            summary: 'Fallback summary for graph focus diagnostics.',
            matchedSpans: [
                {
                    atomId: 'atom_water_glass',
                    title: 'Water Glass',
                    snippet: 'A water glass is a physical system often used in examples.',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    startLine: 3,
                    endLine: 3,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphBody = document.getElementById('agent-graph-focus-body');
        expect(String(graphBody?.textContent || '')).toContain('Water Glass');
        expect(String(graphBody?.textContent || '')).not.toContain('Render diagnostics');
        expect(String(graphBody?.textContent || '')).not.toContain('missing_markdown_runtime');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            requestedSourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpanCount: 1,
            markdownRuntimeAvailable: false,
            storageProviderAvailable: false,
            readSucceeded: false,
            renderSucceeded: false,
            usedFallback: true,
            failureReason: 'missing_markdown_runtime',
        }));
    });

    test('falls back to matched-span source paths before giving up on graph focus rendering', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async (sourcePath: string) => {
            if (sourcePath === 'Knowledge_Base/old/location.md') {
                throw new Error('stale_path');
            }
            return '# Water Glass\n\nA water glass is a physical system often used in basic thermodynamics examples.';
        });
        const renderMarkdownInto = jest.fn(async (host: HTMLElement, markdown: string) => {
            host.innerHTML = `<p>${markdown}</p>`;
        });
        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/old/location.md',
            matchedSpans: [
                {
                    title: 'Definition',
                    snippet: 'A water glass is a physical system often used in basic thermodynamics examples.',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    startLine: 3,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        expect(readContent).toHaveBeenNthCalledWith(1, 'Knowledge_Base/old/location.md');
        expect(readContent).toHaveBeenNthCalledWith(2, 'Knowledge_Base/waterglass/water glass.md');
        expect(renderMarkdownInto).toHaveBeenCalled();
        const graphBody = document.getElementById('agent-graph-focus-body');
        expect(String(graphBody?.textContent || '')).toContain('A water glass is a physical system often used in basic thermodynamics examples.');
        expect(String(graphBody?.textContent || '')).not.toContain('Render diagnostics');
        expect(String(graphBody?.textContent || '')).toContain('Knowledge_Base/waterglass/water glass.md');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            requestedSourcePath: 'Knowledge_Base/old/location.md',
            candidateSourcePaths: [
                'Knowledge_Base/old/location.md',
                'Knowledge_Base/waterglass/water glass.md',
            ],
            attemptedSourcePaths: [
                'Knowledge_Base/old/location.md',
                'Knowledge_Base/waterglass/water glass.md',
            ],
            resolvedSourcePath: 'Knowledge_Base/waterglass/water glass.md',
            fallbackSourcePathUsed: true,
            usedFallback: false,
            renderSucceeded: true,
        }));
    });

    test('normalizes citation-backed knowledge hits before opening graph focus', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'A water glass is a physical system often used in basic thermodynamics examples.',
            '',
            'The water glass exchanges heat with the environment.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Water Glass</h2>
                    <p>A water glass is a physical system often used in basic thermodynamics examples.</p>
                    <p>The water glass exchanges heat with the environment.</p>
                </article>
            `;
        });
        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        controller.init();
        controller.renderKnowledgePoints([
            {
                atomId: 'atom_water_glass',
                documentId: 'doc_water_glass',
                title: 'Water Glass',
                summary: 'A water glass is a transparent container plus water.',
                evidenceSnippet: 'A water glass is a transparent container plus water.',
                score: 0.93,
                citation: {
                    title: 'Definition',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    snippet: 'A water glass is a physical system often used in basic thermodynamics examples.',
                    startLine: 3,
                    endLine: 3,
                },
                matchedSpans: [
                    {
                        atomId: 'atom_water_glass',
                        title: 'Definition',
                        snippet: '',
                        sourcePath: '',
                        startLine: undefined,
                        endLine: undefined,
                        score: 0.93,
                        citation: {
                            title: 'Definition',
                            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                            snippet: 'A water glass is a physical system often used in basic thermodynamics examples.',
                            startLine: 3,
                            endLine: 3,
                        },
                    },
                ],
                capabilities: [],
            },
        ], {
            onCapability: jest.fn(),
        });

        const fileButton = document.querySelector('.agent-knowledge-file-button') as HTMLButtonElement | null;
        const sourcePathNode = document.querySelector('.agent-knowledge-source-path') as HTMLElement | null;
        expect(fileButton?.textContent).toBe('water glass.md');
        expect(String(sourcePathNode?.textContent || '')).toContain('Knowledge_Base/waterglass/water glass.md');

        fileButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        expect(readContent).toHaveBeenCalledWith('Knowledge_Base/waterglass/water glass.md');
        expect(renderMarkdownInto).toHaveBeenCalled();
        const graphBody = document.getElementById('agent-graph-focus-body');
        expect(String(graphBody?.textContent || '')).toContain('A water glass is a physical system often used in basic thermodynamics examples.');
        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted.length).toBeGreaterThan(0);
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            requestedSourcePath: 'Knowledge_Base/waterglass/water glass.md',
            candidateSourcePaths: ['Knowledge_Base/waterglass/water glass.md'],
            resolvedSourcePath: 'Knowledge_Base/waterglass/water glass.md',
            renderSucceeded: true,
            highlightedNodeCount: expect.any(Number),
        }));
    });

    test('resolves graph focus source paths from matched-span citations when the top-level hit path is missing', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'A water glass is a physical system often used in basic thermodynamics examples.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Water Glass</h2>
                    <p>A water glass is a physical system often used in basic thermodynamics examples.</p>
                </article>
            `;
        });
        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        controller.init();
        controller.renderKnowledgePoints([
            {
                atomId: 'atom_water_glass',
                documentId: 'doc_water_glass',
                title: 'Water Glass',
                summary: 'A water glass is a transparent container plus water.',
                evidenceSnippet: 'A water glass is a transparent container plus water.',
                score: 0.93,
                citation: null,
                matchedSpans: [
                    {
                        atomId: 'atom_water_glass',
                        title: 'Definition',
                        snippet: '',
                        sourcePath: '',
                        startLine: undefined,
                        endLine: undefined,
                        score: 0.93,
                        citation: {
                            title: 'Definition',
                            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                            snippet: 'A water glass is a physical system often used in basic thermodynamics examples.',
                            startLine: 3,
                            endLine: 3,
                        },
                    },
                ],
                capabilities: [],
            },
        ], {
            onCapability: jest.fn(),
        });

        const fileButton = document.querySelector('.agent-knowledge-file-button') as HTMLButtonElement | null;
        const sourcePathNode = document.querySelector('.agent-knowledge-source-path') as HTMLElement | null;
        expect(fileButton?.textContent).toBe('water glass.md');
        expect(String(sourcePathNode?.textContent || '')).toContain('Knowledge_Base/waterglass/water glass.md');

        fileButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        expect(readContent).toHaveBeenCalledWith('Knowledge_Base/waterglass/water glass.md');
        expect(renderMarkdownInto).toHaveBeenCalled();
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            requestedSourcePath: 'Knowledge_Base/waterglass/water glass.md',
            candidateSourcePaths: ['Knowledge_Base/waterglass/water glass.md'],
            resolvedSourcePath: 'Knowledge_Base/waterglass/water glass.md',
            renderSucceeded: true,
        }));
    });

    test('prefers line-anchored graph focus highlights when repeated snippet text appears in multiple paragraphs', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'Water glass is used in thermodynamics as a closed-system example.',
            '',
            'Water glass is used in thermodynamics as an open-system example.',
            '',
            'Water glass can also describe a sodium silicate material.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Water Glass</h2>
                    <p data-case="closed">Water glass is used in thermodynamics as a closed-system example.</p>
                    <p data-case="open">Water glass is used in thermodynamics as an open-system example.</p>
                    <p data-case="material">Water glass can also describe a sodium silicate material.</p>
                </article>
            `;
        });

        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpans: [
                {
                    title: 'Closed-system definition',
                    snippet: 'Water glass is used in thermodynamics.',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    startLine: 3,
                    endLine: 3,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphBody = document.getElementById('agent-graph-focus-body');
        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted).toHaveLength(1);
        expect((highlighted[0] as HTMLElement)?.dataset.case).toBe('closed');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            matchedSpanCount: 1,
            highlightedNodeCount: 1,
            highlightStrategy: 'line_window',
        }));
    });

    test('uses markdown source-line provenance when identical rendered paragraphs repeat', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'Water glass is used for calibration.',
            '',
            'Water glass is used for calibration.',
        ].join('\n'));

        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        (window as any).marked = {
            parse: jest.fn(() => (
                '<h1>Water Glass</h1>'
                + '<p data-case="first">Water glass is used for calibration.</p>'
                + '<p data-case="second">Water glass is used for calibration.</p>'
            )),
        };

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpans: [
                {
                    title: 'Calibration note',
                    snippet: 'Water glass is used for calibration.',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    startLine: 3,
                    endLine: 3,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphBody = document.getElementById('agent-graph-focus-body');
        const renderedParagraphs = Array.from(graphBody?.querySelectorAll('p[data-case]') || []);
        expect(renderedParagraphs).toHaveLength(2);
        expect((renderedParagraphs[0] as HTMLElement)?.dataset.agentMarkdownSourceStartLine).toBe('3');
        expect((renderedParagraphs[1] as HTMLElement)?.dataset.agentMarkdownSourceStartLine).toBe('5');

        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted).toHaveLength(1);
        expect((highlighted[0] as HTMLElement)?.dataset.case).toBe('first');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            matchedSpanCount: 1,
            highlightedNodeCount: 1,
            highlightStrategy: 'source_line_provenance',
            sourceProvenanceBlockCount: 3,
            sourceProvenanceAttributedNodeCount: 3,
        }));
    });

    test('falls back to snippet-based graph focus highlights when no usable line window exists', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'A water glass exchanges heat with the environment during the example setup.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Water Glass</h2>
                    <p data-case="fallback">A water glass exchanges heat with the environment during the example setup.</p>
                </article>
            `;
        });

        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpans: [
                {
                    title: 'Heat exchange',
                    snippet: 'exchanges heat with the environment',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphBody = document.getElementById('agent-graph-focus-body');
        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted).toHaveLength(1);
        expect((highlighted[0] as HTMLElement)?.dataset.case).toBe('fallback');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            matchedSpanCount: 1,
            highlightedNodeCount: 1,
            highlightStrategy: 'snippet_fallback',
        }));
    });

    test('adds inline graph focus highlight for the matched evidence fragment', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'A water glass exchanges heat with the environment during the example setup.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Water Glass</h2>
                    <p data-case="inline">A water glass exchanges heat with the environment during the example setup.</p>
                </article>
            `;
            return {
                sourceBlockCount: 2,
                attributedNodeCount: 0,
            };
        });

        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpans: [
                {
                    title: 'Heat exchange',
                    snippet: 'exchanges heat with the environment',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphBody = document.getElementById('agent-graph-focus-body');
        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted).toHaveLength(1);
        expect((highlighted[0] as HTMLElement)?.dataset.case).toBe('inline');

        const inlineHighlights = Array.from(graphBody?.querySelectorAll('[data-agent-focus-inline-highlight="true"]') || []);
        expect(inlineHighlights).toHaveLength(1);
        expect(inlineHighlights[0]?.textContent).toBe('exchanges heat with the environment');
    });

    test('uses source-authenticated fragment projection instead of highlighting an entire single-line paragraph', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'A water glass exchanges heat with the environment during the example setup.',
        ].join('\n'));

        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        (window as any).marked = {
            parse: jest.fn(() => (
                '<h1>Water Glass</h1>'
                + '<p data-case="single-line">A water glass exchanges heat with the environment during the example setup.</p>'
            )),
        };

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpans: [
                {
                    title: 'Heat exchange',
                    snippet: 'heat with the environment',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    startLine: 3,
                    endLine: 3,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphBody = document.getElementById('agent-graph-focus-body');
        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted).toHaveLength(1);
        expect((highlighted[0] as HTMLElement)?.dataset.case).toBe('single-line');

        const inlineHighlights = Array.from(graphBody?.querySelectorAll('[data-agent-focus-inline-highlight="true"]') || []);
        expect(inlineHighlights).toHaveLength(1);
        expect(inlineHighlights[0]?.textContent).toBe('heat with the environment');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            matchedSpanCount: 1,
            highlightedNodeCount: 1,
            inlineHighlightCount: 1,
            inlineHighlightStrategy: 'source_fragment_provenance',
            highlightStrategy: 'source_line_provenance',
        }));
    });

    test('projects source-authenticated fragment highlights across nested inline markdown nodes', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const readContent = jest.fn(async () => [
            '# Water Glass',
            '',
            'A water glass exchanges **heat with the environment** during the example setup.',
        ].join('\n'));

        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        (window as any).marked = {
            parse: jest.fn(() => (
                '<h1>Water Glass</h1>'
                + '<p data-case="nested-inline">A water glass exchanges <strong>heat with the environment</strong> during the example setup.</p>'
            )),
        };

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            matchedSpans: [
                {
                    title: 'Heat exchange',
                    snippet: 'heat with the environment',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    startLine: 3,
                    endLine: 3,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphBody = document.getElementById('agent-graph-focus-body');
        const paragraph = graphBody?.querySelector('p[data-case="nested-inline"]') as HTMLElement | null;
        expect(paragraph?.dataset.agentMarkdownSourceStartLine).toBe('3');

        const inlineHighlights = Array.from(graphBody?.querySelectorAll('[data-agent-focus-inline-highlight="true"]') || []);
        expect(inlineHighlights).toHaveLength(1);
        expect(inlineHighlights[0]?.textContent).toBe('heat with the environment');
        expect(inlineHighlights[0]?.parentElement?.tagName.toLowerCase()).toBe('strong');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            matchedSpanCount: 1,
            highlightedNodeCount: 1,
            inlineHighlightCount: 1,
            inlineHighlightStrategy: 'source_fragment_provenance',
            highlightStrategy: 'source_line_provenance',
        }));
    });

    test('uses source offsets to disambiguate repeated fragments inside one authenticated block', async () => {
        const { controller, document, window } = loadWorkspacePanesHarness();
        const markdownSource = [
            '# Repeated Fragment',
            '',
            'Alpha repeats. Alpha repeats. Beta closes.',
        ].join('\n');
        const secondAlphaOffset = markdownSource.indexOf('Alpha repeats.', markdownSource.indexOf('Alpha repeats.') + 1);
        const readContent = jest.fn(async () => markdownSource);

        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        (window as any).marked = {
            parse: jest.fn(() => (
                '<h1>Repeated Fragment</h1>'
                + '<p data-case="repeated-fragment">Alpha repeats. Alpha repeats. Beta closes.</p>'
            )),
        };

        controller.init();
        controller.openGraphFocusPane({
            atomId: 'atom_repeated_fragment',
            title: 'Repeated Fragment',
            sourcePath: 'Knowledge_Base/repeated.md',
            matchedSpans: [
                {
                    title: 'Second repeat',
                    snippet: 'Alpha repeats.',
                    sourcePath: 'Knowledge_Base/repeated.md',
                    startLine: 3,
                    endLine: 3,
                    startOffset: secondAlphaOffset,
                    endOffset: secondAlphaOffset + 'Alpha repeats.'.length,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphBody = document.getElementById('agent-graph-focus-body');
        const paragraph = graphBody?.querySelector('p[data-case="repeated-fragment"]') as HTMLElement | null;
        expect(paragraph?.innerHTML).toContain('Alpha repeats. <mark');
        expect(paragraph?.innerHTML).not.toContain('<mark class="agent-focus-inline-highlight" data-agent-focus-inline-highlight="true">Alpha repeats.</mark> Alpha repeats.');
        expect((controller as any).getLastGraphFocusDiagnostics()).toEqual(expect.objectContaining({
            matchedSpanCount: 1,
            highlightedNodeCount: 1,
            inlineHighlightCount: 1,
            inlineHighlightStrategy: 'source_offset_provenance',
            highlightStrategy: 'source_line_provenance',
        }));
    });

    test('keeps reusable card renderers aligned with chat and evidence owners', () => {
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

        const evidenceOwnedKinds = [
            'flashcard-batch',
            'knowledge-run',
            'knowledge-run-history',
            'knowledge-run-compare',
        ];
        const expectedChatAppendKinds = uniqueSorted(
            registryKinds.filter((kind) => evidenceOwnedKinds.indexOf(kind) < 0)
        );

        expect(uniqueSorted(appendKinds)).toEqual(expectedChatAppendKinds);
        evidenceOwnedKinds.forEach((kind) => {
            expect(registryKinds).toContain(kind);
        });
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
        expect(actionButtons.map((button) => button.getAttribute('data-agent-knowledge-action'))).toEqual([
            'learning-path',
            'related-focus',
        ]);
    });

    test('keeps non-graph capabilities out of the primary knowledge-hit list even when mixed with legacy fields', () => {
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
        expect(Array.from(firstCardButtons).map((button) => button.getAttribute('data-agent-knowledge-action'))).toEqual([
            'learning-path',
            'related-focus',
        ]);
        expect(Array.from(secondCardButtons).map((button) => button.getAttribute('data-agent-knowledge-action'))).toEqual([
            'learning-path',
            'related-focus',
        ]);
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
        expect(diagnostics.operations).toContain('fetch_workflow_artifacts');
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
        expect(diagnostics.operationTransports).toContain('fetch_workflow_artifacts');
        expect(diagnostics.operationTransports).toContain('execute_workflow_artifact_review_follow_up');
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
        expect(diagnostics.operationRequestBuilders).toContain('fetch_workflow_artifacts');
        expect(diagnostics.operationRequestBuilders).toContain('execute_workflow_artifact_review_follow_up');
        expect(diagnostics.operationResultPresentationOverrides).toContain('execute_tutor_action');
        expect(diagnostics.operationResultPresentationOverrides).toContain('fetch_workflow_artifacts');
        expect(diagnostics.operationResultPresentationOverrideMap.execute_tutor_action).toEqual(
            ['tutor_action_card']
        );
        expect(diagnostics.operationResultPresentationOverrideMap.fetch_workflow_artifacts).toEqual(
            ['knowledge_run_card', 'knowledge_run_history_card']
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
        expect(diagnostics.operationAllowedResultPresentations.fetch_workflow_artifacts).toEqual([
            'flashcard_batch_card',
            'knowledge_run_card',
            'knowledge_run_history_card',
        ]);
        expect(diagnostics.operationAllowedResultPresentations.execute_workflow_artifact_review_follow_up).toEqual([
            'workflow_artifact_review_follow_up',
        ]);
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
        expect(diagnostics.cardResultPresentations).toContain('knowledge_run_card');
        expect(diagnostics.cardResultPresentations).toContain('knowledge_run_history_card');
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
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('knowledge_run_card');
        expect(diagnostics.resultPresentationPayloadBuilders).toContain('knowledge_run_history_card');
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

    test('shows a workspace scope selector and uses it for conversation requests', async () => {
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
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_scope_selector',
                    emittedAt: '2026-04-13T00:00:00.100Z',
                    result: {
                        assistantMessage: 'scoped selector response',
                        citations: [],
                        recalledMemories: [],
                        memoryActions: [],
                        knowledgePoints: [],
                        summary: {
                            generatedAt: '2026-04-13T00:00:00.100Z',
                            topK: 6,
                            returnedKnowledgePoints: 0,
                            returnedCitations: 0,
                            recalledMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 0,
                        },
                    },
                },
            },
        ]));

        const scopeSelect = document.getElementById('agent-workspace-scope-select') as HTMLSelectElement;
        expect(scopeSelect).not.toBeNull();
        expect(Array.from(scopeSelect.options).map((option) => option.value)).toEqual([
            'ALL_FOLDERS',
            'financial',
            'waterglass',
        ]);
        scopeSelect.value = 'waterglass';
        scopeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

        const scopeSummary = document.getElementById('agent-workspace-scope-summary');
        expect(String(scopeSummary?.textContent || '')).toContain('waterglass');

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'what is water glass?';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
        expect(requestBody.activeTarget).toBe('waterglass');
        expect(requestBody.scope).toEqual({
            workspaceId: 'waterglass',
            corpusId: 'waterglass',
            sourcePathPrefixes: ['Knowledge_Base/waterglass'],
        });
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

        const readContent = jest.fn(async () => [
            '# Stream Node',
            '',
            'Stream evidence',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Stream Node</h2>
                    <p>Stream evidence</p>
                </article>
            `;
        });
        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

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
                            citations: [
                                {
                                    citationId: 'citation_stream_1',
                                    sourcePath: 'Knowledge_Base/optics/stream.md',
                                    startLine: 12,
                                },
                            ],
                            recalledMemories: [
                                {
                                    memoryId: 'memory_stream_1',
                                },
                            ],
                            memoryActions: [
                                {
                                    kind: 'persist_session_memory',
                                },
                            ],
                            knowledgePoints: [
                                {
                                    atomId: 'atom_stream',
                                    title: 'Stream Node',
                                    summary: 'Stream summary',
                                    evidenceSnippet: 'Stream evidence',
                                    score: 0.9,
                                    citation: {
                                        citationId: 'citation_stream_1',
                                        sourcePath: 'Knowledge_Base/optics/stream.md',
                                        startLine: 12,
                                    },
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

        (window as any).__NC_ACTIVE_SOURCE_TARGET = {
            target: 'waterglass',
            scope: {
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
            },
        };
        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'focus node';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const fetchCall = fetchMock.mock.calls[0];
        expect(fetchCall?.[0]).toBe('/api/knowledge/conversation');
        const requestInit = fetchCall?.[1] || {};
        const requestHeaders = requestInit.headers || {};
        const requestBody = JSON.parse(String(requestInit.body || '{}'));
        expect(String(requestHeaders.Accept || '')).toBe('text/event-stream');
        expect(String(requestHeaders['X-Agent-Conversation-Turn-Id'] || '')).toMatch(/^turn_client_/);
        expect(String(requestBody.userId || '')).toBe('path_user_default');
        expect(String(requestBody.sessionId || '')).toMatch(/^session_client_path_user_default_/);
        expect(String(requestBody.activeTarget || '')).toBe('waterglass');
        expect(String(requestBody.memoryNamespace || '')).toBe('conversation');
        expect(requestBody.scope).toEqual({
            workspaceId: 'waterglass',
            corpusId: 'waterglass',
            sourcePathPrefixes: ['Knowledge_Base/waterglass'],
        });

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('streamed assistant response'))
        ).toBe(true);
        const systemMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-system')
        ).map((node) => String(node.textContent || ''));
        expect(
            systemMessages.some((message) => message.includes('Grounding: scope='))
        ).toBe(false);
        expect((window as any).NoteConnectionAgentWorkspace.getLastConversationGrounding()).toEqual(
            expect.objectContaining({
                scopeLabel: 'waterglass',
                citationCount: 1,
                memoryCount: 1,
                memoryActionCount: 1,
            })
        );
        const status = document.getElementById('agent-workspace-api-status') as HTMLElement | null;
        status?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();
        const evidencePane = document.getElementById('agent-evidence-pane');
        const evidenceBody = document.getElementById('agent-evidence-body');
        expect(evidencePane?.getAttribute('data-open')).toBe('true');
        expect(String(evidenceBody?.textContent || '')).toContain('waterglass');
        expect(String(evidenceBody?.textContent || '')).toContain('1');
        expect(String(evidenceBody?.textContent || '')).toContain('Recalled memories');
        const knowledgeCards = Array.from(document.querySelectorAll('.agent-knowledge-card'));
        expect(knowledgeCards.length).toBeGreaterThan(0);
        const fileButton = knowledgeCards[0]?.querySelector('.agent-knowledge-file-button') as HTMLButtonElement;
        expect(String(fileButton?.textContent || '')).toBe('stream.md');
        expect(knowledgeCards[0]?.querySelector('.agent-knowledge-summary')).toBeNull();
        expect(knowledgeCards[0]?.querySelectorAll('.agent-knowledge-hit')).toHaveLength(0);
        expect(knowledgeCards[0]?.querySelector('.agent-knowledge-preview')).toBeNull();
        fileButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();
        expect(readContent).toHaveBeenCalledWith('Knowledge_Base/optics/stream.md');
        expect(renderMarkdownInto).toHaveBeenCalled();
        expect(String(document.getElementById('agent-graph-focus-body')?.textContent || '')).toContain('Stream evidence');
    });

    test('surfaces graph context in the evidence pane even when grounding only comes from trace.graphContext', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness({ withI18n: true });
        if (!fetchMock) {
            throw new Error('expected fetch mock');
        }

        fetchMock.mockImplementationOnce(async () => createSseResponse([
            {
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_graph_context_only',
                    emittedAt: '2026-06-10T09:00:00.000Z',
                    result: {
                        assistantMessage: 'graph aware response',
                        citations: [],
                        recalledMemories: [],
                        memoryActions: [],
                        knowledgePoints: [],
                        summary: {
                            generatedAt: '2026-06-10T09:00:00.000Z',
                            topK: 6,
                            returnedKnowledgePoints: 0,
                            returnedCitations: 0,
                            recalledMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 0,
                        },
                        trace: {
                            graphContext: {
                                anchorAtomId: 'atom_reflection',
                                anchorTitle: 'Reflection',
                                anchorDocumentId: 'doc_reflection',
                                supportingAtomIds: ['atom_phase'],
                                supportingTitles: ['Phase Matching'],
                                relationKinds: ['prerequisite'],
                                relationSummaries: [
                                    {
                                        relationKind: 'prerequisite',
                                        edgeIds: ['edge_prereq_1'],
                                        targetAtomIds: ['atom_phase'],
                                        averageConfidence: 0.92,
                                    },
                                ],
                                connectionPaths: [
                                    {
                                        sourceAtomId: 'atom_foundation',
                                        sourceTitle: 'Foundation Note',
                                        targetAtomId: 'atom_reflection',
                                        targetTitle: 'Reflection',
                                        pathAtomIds: ['atom_foundation', 'atom_phase', 'atom_reflection'],
                                        pathTitles: ['Foundation Note', 'Phase Matching', 'Reflection'],
                                        pathEdges: [
                                            {
                                                fromAtomId: 'atom_foundation',
                                                toAtomId: 'atom_phase',
                                                relationKind: 'prerequisite',
                                            },
                                            {
                                                fromAtomId: 'atom_phase',
                                                toAtomId: 'atom_reflection',
                                                relationKind: 'reference',
                                            },
                                        ],
                                        length: 2,
                                    },
                                ],
                                temporalValidity: {
                                    checkedAt: '2026-06-10T09:00:00.000Z',
                                    allPointsValid: true,
                                    warningReasons: [],
                                    invalidKnowledgePointTitles: [],
                                },
                            },
                        },
                    },
                },
            },
        ]));

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'show graph context';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        expect((window as any).NoteConnectionAgentWorkspace.getLastConversationGrounding()).toEqual(
            expect.objectContaining({
                scopeLabel: 'global',
                graphContext: expect.objectContaining({
                    anchorTitle: 'Reflection',
                    supportingTitles: ['Phase Matching'],
                }),
            })
        );

        const status = document.getElementById('agent-workspace-api-status') as HTMLElement | null;
        expect(status?.getAttribute('data-agent-inspectable')).toBe('true');
        status?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const evidenceBody = document.getElementById('agent-evidence-body');
        expect(String(evidenceBody?.textContent || '')).toContain('Graph context');
        expect(String(evidenceBody?.textContent || '')).toContain('Reflection');
        expect(String(evidenceBody?.textContent || '')).toContain('Phase Matching');
        expect(String(evidenceBody?.textContent || '')).toContain('Foundation Note -> Phase Matching -> Reflection');
        expect(String(evidenceBody?.textContent || '')).toContain('Temporal validity');
    });

    test('clears stale grounding state when a later conversation turn returns no grounding payload', async () => {
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
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_grounding_present',
                    emittedAt: '2026-06-10T09:00:00.000Z',
                    result: {
                        assistantMessage: 'grounded response',
                        citations: [
                            {
                                citationId: 'citation_grounding_present',
                                sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                                startLine: 2,
                            },
                        ],
                        recalledMemories: [],
                        memoryActions: [],
                        knowledgePoints: [],
                        summary: {
                            generatedAt: '2026-06-10T09:00:00.000Z',
                            topK: 6,
                            returnedKnowledgePoints: 0,
                            returnedCitations: 1,
                            recalledMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 100,
                        },
                    },
                },
            },
        ]));
        fetchMock.mockImplementationOnce(async () => createSseResponse([
            {
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_grounding_absent',
                    emittedAt: '2026-06-10T09:01:00.000Z',
                    result: {
                        assistantMessage: 'ungrounded response',
                        citations: [],
                        recalledMemories: [],
                        memoryActions: [],
                        knowledgePoints: [],
                        summary: {
                            generatedAt: '2026-06-10T09:01:00.000Z',
                            topK: 6,
                            returnedKnowledgePoints: 0,
                            returnedCitations: 0,
                            recalledMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 0,
                        },
                    },
                },
            },
        ]));

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'first turn';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();
        expect((window as any).NoteConnectionAgentWorkspace.getLastConversationGrounding()).toEqual(
            expect.objectContaining({
                citationCount: 1,
            })
        );

        const status = document.getElementById('agent-workspace-api-status') as HTMLElement | null;
        expect(status?.getAttribute('data-agent-inspectable')).toBe('true');

        input.value = 'second turn';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        expect((window as any).NoteConnectionAgentWorkspace.getLastConversationGrounding()).toBeNull();
        expect(status?.getAttribute('data-agent-inspectable')).toBe('false');
        status?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();
        expect(document.getElementById('agent-evidence-pane')?.getAttribute('data-open')).not.toBe('true');
    });

    test('renders structured assistant blocks without breaking scoped conversation flow', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness({ withI18n: true });
        if (!fetchMock) {
            throw new Error('expected fetch mock');
        }

        const renderMathInElement = jest.fn();
        const mermaidRender = jest.fn(async () => ({
            svg: '<svg><text>Rendered Mermaid</text></svg>',
        }));
        (window as any).marked = {
            parse: jest.fn((markdown: string) => {
                if (markdown.includes('## Answer Context')) {
                    return (
                        '<h2>Answer Context</h2>'
                        + '<ul><li>Relevant knowledge points: <strong>1</strong></li></ul>'
                    );
                }
                if (markdown.includes('## Evidence Summary')) {
                    return (
                        '<h2>Evidence Summary</h2>'
                        + '<p>Blocks Citation</p>'
                    );
                }
                if (markdown.includes('## Next Actions')) {
                    if (markdown.includes('side by side')) {
                        return (
                            '<h2>Next Actions</h2>'
                            + '<p>inspect the strongest nodes side by side</p>'
                        );
                    }
                    return (
                        '<h2>Next Actions</h2>'
                        + '<p>Persist the latest user focus to scoped conversation memory.</p>'
                    );
                }
                return (
                    '<h2>Explanation</h2>'
                    + '<p>Blocks Citation is the current best scoped anchor.</p>'
                    + '<p>Inline math $E=mc^2$ and a diagram:</p>'
                    + '<pre><code class="language-mermaid">graph TD;A-->B;</code></pre>'
                );
            }),
        };
        (window as any).renderMathInElement = renderMathInElement;
        (window as any).mermaid = {
            initialize: jest.fn(),
            parse: jest.fn(async () => true),
            render: mermaidRender,
            run: jest.fn(),
        };

        fetchMock.mockImplementationOnce(async () => createSseResponse([
            {
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_blocks_1',
                    emittedAt: '2026-04-13T00:01:00.000Z',
                    result: {
                        assistantMessage: 'Scoped Answer',
                        answer: 'Scoped Answer',
                        assistantBlocks: [
                            {
                                blockId: 'block_structured_answer_1',
                                type: 'structured_answer',
                                title: 'Grounded Answer',
                                directAnswer: 'Scoped Answer',
                                overviewMarkdown: '## Answer Context\n\n- Relevant knowledge points: **1**\n- Citations returned: **1**\n- Scoped memories recalled: **0**',
                                explanationMarkdown: '## Explanation\n\n**Blocks Citation** is the current best scoped anchor.\n\nInline math $E=mc^2$ and a diagram:\n\n```mermaid\ngraph TD;A-->B;\n```',
                                evidenceMarkdown: '## Evidence Summary\n\n1. **Blocks Citation** (Knowledge_Base/optics/blocks.md:18)\n   - Scoped snippet',
                                nextActionsMarkdown: '## Next Actions\n\nUse the scoped knowledge cards below to continue with focus mode or guided learning for the highest-signal nodes:\n- Blocks Citation\n\nSuggested follow-through from the current turn:\n- Persist the latest user focus to scoped conversation memory.',
                                knowledgePointCount: 1,
                                citationCount: 1,
                                recalledMemoryCount: 0,
                            },
                            {
                                blockId: 'block_notice_1',
                                type: 'system_notice',
                                text: 'No scoped memory note was recalled for this turn.',
                            },
                            {
                                blockId: 'block_knowledge_run_1',
                                type: 'knowledge_run_summary',
                                title: 'Knowledge Run',
                                artifactId: 'workflow_artifact_knowledge_run_blocks_1',
                                knowledgeRun: {
                                    runId: 'knowledge_run_blocks_1',
                                    generatedAt: '2026-04-13T00:01:00.000Z',
                                    status: 'pass',
                                    scope: {
                                        source: 'scoped',
                                        workspaceId: 'waterglass',
                                        corpusId: 'waterglass',
                                        documentIds: [],
                                        atomIds: [],
                                        sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                        languages: [],
                                        matchedAtomCount: 1,
                                    },
                                    evidenceClaims: [
                                        {
                                            claimId: 'knowledge_run_blocks_1_claim_1',
                                            status: 'verified',
                                            title: 'Blocks Citation',
                                            statement: 'Scoped snippet',
                                            citationId: 'citation_blocks_1',
                                            atomId: 'atom_blocks_1',
                                            documentId: 'doc_blocks_1',
                                            sourcePath: 'Knowledge_Base/optics/blocks.md',
                                            startLine: 18,
                                            endLine: 21,
                                            snippet: 'Scoped snippet',
                                            confidence: 0.88,
                                            reason: 'The claim is backed by a cited source span with a concrete line reference.',
                                        },
                                    ],
                                    quality: {
                                        score: 100,
                                        status: 'pass',
                                        gates: [
                                            {
                                                gateId: 'evidence_coverage',
                                                passed: true,
                                                observedValue: 1,
                                                threshold: 0.8,
                                                message: '1 of 1 claim(s) have citation evidence.',
                                            },
                                            {
                                                gateId: 'scope_discipline',
                                                passed: true,
                                                observedValue: 1,
                                                threshold: 1,
                                                message: 'The answer stayed inside the resolved scope contract.',
                                            },
                                            {
                                                gateId: 'recall_transfer',
                                                passed: true,
                                                observedValue: 1,
                                                threshold: 1,
                                                message: '1 review card(s) were generated from cited claims.',
                                            },
                                        ],
                                    },
                                    reviewCards: [
                                        {
                                            cardId: 'knowledge_run_blocks_1_card_1',
                                            sourceClaimId: 'knowledge_run_blocks_1_claim_1',
                                            prompt: 'What does the cited source establish about Blocks Citation?',
                                            expectedAnswer: 'Scoped snippet',
                                            evidenceRefs: ['Knowledge_Base/optics/blocks.md:18'],
                                            nextReviewAt: '2026-04-14T00:01:00.000Z',
                                        },
                                    ],
                                    summary: {
                                        claimCount: 1,
                                        verifiedClaimCount: 1,
                                        weakClaimCount: 0,
                                        notProvenClaimCount: 0,
                                        rejectedClaimCount: 0,
                                        reviewCardCount: 1,
                                        completedReviewCardCount: 0,
                                        remainingReviewCardCount: 1,
                                    },
                                    reviewState: {
                                        consumedCardIds: [],
                                        completedReviewCardCount: 0,
                                        remainingReviewCardCount: 1,
                                        completedAt: null,
                                    },
                                },
                            },
                            {
                                blockId: 'block_citations_1',
                                type: 'citations',
                                title: 'Citations',
                                citations: [
                                    {
                                        citationId: 'citation_blocks_1',
                                        atomId: 'atom_blocks_1',
                                        documentId: 'doc_blocks_1',
                                        sourcePath: 'Knowledge_Base/optics/blocks.md',
                                        title: 'Blocks Citation',
                                        snippet: 'Scoped snippet',
                                        startLine: 18,
                                        endLine: 21,
                                        score: 0.88,
                                    },
                                ],
                            },
                        ],
                        citations: [
                            {
                                citationId: 'citation_blocks_1',
                                atomId: 'atom_blocks_1',
                                documentId: 'doc_blocks_1',
                                sourcePath: 'Knowledge_Base/optics/blocks.md',
                                title: 'Blocks Citation',
                                snippet: 'Scoped snippet',
                                startLine: 18,
                                endLine: 21,
                                score: 0.88,
                            },
                        ],
                        knowledgePoints: [],
                        recalledMemories: [],
                        memoryActions: [],
                        summary: {
                            generatedAt: '2026-04-13T00:01:00.000Z',
                            topK: 6,
                            returnedKnowledgePoints: 0,
                            returnedCitations: 1,
                            recalledMemoryCount: 0,
                            appliedMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 90,
                        },
                        trace: {
                            sessionId: 'session_blocks_1',
                            invocationId: 'invocation_blocks_1',
                            retrieval: {
                                retrievalModes: ['keyword'],
                                asOf: '2026-04-13T00:01:00.000Z',
                                totalActiveAtoms: 1,
                                modeWeights: {
                                    keyword: 1,
                                    graph: 0,
                                    temporal: 0,
                                },
                                latencyMs: 3,
                                evidenceCoverageRatio: 0.9,
                            },
                            recalledMemoryCount: 0,
                            appliedMemoryCount: 0,
                            usedScope: {
                                source: 'scoped',
                                workspaceId: 'waterglass',
                                corpusId: 'waterglass',
                                documentIds: [],
                                atomIds: [],
                                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                languages: [],
                                matchedAtomCount: 1,
                            },
                        },
                    },
                },
            },
        ]));

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'render rich reply';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        const assistantNode = document.querySelector('.agent-chat-message-rendered.agent-chat-message-assistant');
        expect(assistantNode).not.toBeNull();
        expect(assistantNode?.querySelector('.agent-chat-inline-card-title')?.textContent).toBe('Grounded Answer');
        expect(String(assistantNode?.textContent || '')).toContain('Scoped Answer');
        expect(assistantNode?.querySelector('h2')).toBeNull();
        expect(String(assistantNode?.textContent || '')).not.toContain('Answer Context');
        expect(String(assistantNode?.textContent || '')).not.toContain('Evidence Summary');
        expect(String(assistantNode?.textContent || '')).not.toContain('Knowledge Run');
        expect(String(assistantNode?.textContent || '')).not.toContain('Inspect Run');
        expect(renderMathInElement).not.toHaveBeenCalled();
        expect((window as any).mermaid.initialize).not.toHaveBeenCalled();
        expect(mermaidRender).not.toHaveBeenCalled();
        expect((window as any).NoteConnectionAgentWorkspace.getLastConversationResult()).toEqual(
            expect.objectContaining({
                answer: 'Scoped Answer',
                assistantBlocks: expect.arrayContaining([
                    expect.objectContaining({ type: 'structured_answer' }),
                    expect.objectContaining({ type: 'knowledge_run_summary' }),
                ]),
            })
        );
    });

    test('inspects durable knowledge-run artifacts from structured conversation blocks', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness({ withI18n: true });
        if (!fetchMock) {
            throw new Error('expected fetch mock');
        }

        const readContent = jest.fn(async () => [
            '# Blocks Citation',
            '',
            'Scoped snippet',
            '',
            'Supporting explanation for the cited block.',
        ].join('\n'));
        const renderMarkdownInto = jest.fn(async (container: HTMLElement, _markdown: string) => {
            container.innerHTML = `
                <article class="reader-block">
                    <h2>Blocks Citation</h2>
                    <p>Scoped snippet</p>
                    <p>Supporting explanation for the cited block.</p>
                </article>
            `;
        });
        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        fetchMock.mockImplementationOnce(async () => createSseResponse([
            {
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_blocks_inspect',
                    emittedAt: '2026-04-13T00:01:00.000Z',
                    result: {
                        assistantMessage: 'Scoped Answer',
                        answer: 'Scoped Answer',
                        assistantBlocks: [
                            {
                                blockId: 'block_knowledge_run_1',
                                type: 'knowledge_run_summary',
                                title: 'Knowledge Run',
                                artifactId: 'workflow_artifact_knowledge_run_blocks_1',
                                knowledgeRun: {
                                    runId: 'knowledge_run_blocks_1',
                                    generatedAt: '2026-04-13T00:01:00.000Z',
                                    status: 'pass',
                                    scope: {
                                        source: 'scoped',
                                        workspaceId: 'waterglass',
                                        corpusId: 'waterglass',
                                        documentIds: [],
                                        atomIds: [],
                                        sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                        languages: [],
                                        matchedAtomCount: 1,
                                    },
                                    evidenceClaims: [
                                        {
                                            claimId: 'knowledge_run_blocks_1_claim_1',
                                            status: 'verified',
                                            title: 'Blocks Citation',
                                            statement: 'Scoped snippet',
                                            atomId: 'atom_blocks_1',
                                            sourcePath: 'Knowledge_Base/optics/blocks.md',
                                            startLine: 18,
                                            endLine: 21,
                                            snippet: 'Scoped snippet',
                                            confidence: 0.88,
                                            reason: 'The claim is backed by a cited source span with a concrete line reference.',
                                        },
                                    ],
                                    quality: {
                                        score: 100,
                                        status: 'pass',
                                        gates: [
                                            {
                                                gateId: 'evidence_coverage',
                                                passed: true,
                                                observedValue: 1,
                                                threshold: 0.8,
                                                message: '1 of 1 claim(s) have citation evidence.',
                                            },
                                        ],
                                    },
                                    reviewCards: [
                                        {
                                            cardId: 'knowledge_run_blocks_1_card_1',
                                            sourceClaimId: 'knowledge_run_blocks_1_claim_1',
                                            prompt: 'What does the cited source establish about Blocks Citation?',
                                            expectedAnswer: 'Scoped snippet',
                                            evidenceRefs: ['Knowledge_Base/optics/blocks.md:18'],
                                            nextReviewAt: '2026-04-14T00:01:00.000Z',
                                        },
                                    ],
                                    reviewState: {
                                        consumedCardIds: [],
                                        completedReviewCardCount: 0,
                                        remainingReviewCardCount: 1,
                                        completedAt: null,
                                    },
                                    summary: {
                                        claimCount: 1,
                                        verifiedClaimCount: 1,
                                        weakClaimCount: 0,
                                        notProvenClaimCount: 0,
                                        rejectedClaimCount: 0,
                                        reviewCardCount: 1,
                                        completedReviewCardCount: 0,
                                        remainingReviewCardCount: 1,
                                    },
                                },
                            },
                        ],
                        citations: [],
                        knowledgePoints: [],
                        recalledMemories: [],
                        memoryActions: [],
                        summary: {
                            generatedAt: '2026-04-13T00:01:00.000Z',
                            topK: 6,
                            returnedKnowledgePoints: 0,
                            returnedCitations: 0,
                            recalledMemoryCount: 0,
                            appliedMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 90,
                        },
                        trace: {
                            sessionId: 'session_blocks_1',
                            invocationId: 'invocation_blocks_1',
                            retrieval: {
                                retrievalModes: ['keyword'],
                                asOf: '2026-04-13T00:01:00.000Z',
                                totalActiveAtoms: 1,
                                modeWeights: {
                                    keyword: 1,
                                    graph: 0,
                                    temporal: 0,
                                },
                                latencyMs: 3,
                                evidenceCoverageRatio: 0.9,
                            },
                            recalledMemoryCount: 0,
                            appliedMemoryCount: 0,
                            usedScope: {
                                source: 'scoped',
                                workspaceId: 'waterglass',
                                corpusId: 'waterglass',
                                documentIds: [],
                                atomIds: [],
                                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                languages: [],
                                matchedAtomCount: 1,
                            },
                        },
                    },
                },
            },
        ]));

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'inspect knowledge run';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        const runtimeResult = (window as any).NoteConnectionAgentWorkspace.getLastConversationResult();
        expect(runtimeResult).toBeTruthy();
        const runBlock = Array.isArray(runtimeResult?.assistantBlocks)
            ? runtimeResult.assistantBlocks.find((block: any) => block && block.type === 'knowledge_run_summary')
            : null;
        expect(runBlock).toBeTruthy();
        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_blocks_1',
            title: 'Knowledge Run',
        }, {
            capabilityId: 'cap_inspect_knowledge_run_blocks_1',
            actionId: 'inspect_knowledge_run',
            label: 'Inspect Run',
            request: {
                artifactKinds: ['knowledge_run'],
                artifactId: String(runBlock?.artifactId || 'workflow_artifact_knowledge_run_blocks_1'),
                runId: String(runBlock?.knowledgeRun?.runId || 'knowledge_run_blocks_1'),
                workspaceId: 'waterglass',
                limit: 1,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_workflow_artifacts',
                resultPresentation: 'knowledge_run_card',
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const fetchCall = fetchMock.mock.calls.find((call) => String(call?.[0] || '').startsWith('/api/knowledge/workflow-artifacts?'));
        expect(String(fetchCall?.[0] || '')).toContain('artifactKinds=knowledge_run');
        expect(String(fetchCall?.[0] || '')).toContain('artifactId=workflow_artifact_knowledge_run_blocks_1');

        const evidencePane = document.getElementById('agent-evidence-pane');
        const evidenceBody = document.getElementById('agent-evidence-body');
        expect(evidencePane?.getAttribute('data-open')).toBe('true');
        expect(String(evidenceBody?.textContent || '')).toContain('Knowledge Run Details');
        expect(String(evidenceBody?.textContent || '')).toContain('Run knowledge_run_blocks_1: 1 claims, quality pass/100.');
        expect(String(evidenceBody?.textContent || '')).toContain('Answer release review');
        expect(String(evidenceBody?.textContent || '')).toContain('Decision');
        expect(String(evidenceBody?.textContent || '')).toContain('release');
        expect(String(evidenceBody?.textContent || '')).toContain('Scoped snippet');
        expect(String(evidenceBody?.textContent || '')).toContain('Release gates');
        expect(String(evidenceBody?.textContent || '')).toContain('Graph context');
        expect(String(evidenceBody?.textContent || '')).toContain('Blocks Citation');
        expect(String(evidenceBody?.textContent || '')).toContain('Blocks Foundation -> Blocks Citation');
        expect(String(evidenceBody?.textContent || '')).toContain('Graph diagnostics');
        expect(String(evidenceBody?.textContent || '')).toContain('title_mention');
        expect(String(evidenceBody?.textContent || '')).toContain('Blocks Citation');
        expect(String(evidenceBody?.textContent || '')).toContain('Knowledge_Base/optics/blocks.md:18');
        expect(String(evidenceBody?.textContent || '')).toContain('Quality gates');
        expect(String(evidenceBody?.textContent || '')).toContain('Review cards');

        const inspectEvidenceButton = evidenceBody?.querySelector('[data-agent-knowledge-run-claim-inspect="0"]') as HTMLButtonElement | null;
        expect(inspectEvidenceButton).not.toBeNull();
        inspectEvidenceButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        expect(readContent).toHaveBeenCalledWith('Knowledge_Base/optics/blocks.md');
        expect(renderMarkdownInto).toHaveBeenCalled();
        const graphPane = document.getElementById('agent-graph-focus-pane');
        const graphBody = document.getElementById('agent-graph-focus-body');
        expect(graphPane?.getAttribute('data-open')).toBe('true');
        expect(String(graphBody?.textContent || '')).toContain('Blocks Citation');
        expect(String(graphBody?.textContent || '')).toContain('Scoped snippet');
        const highlighted = Array.from(graphBody?.querySelectorAll('[data-agent-focus-highlight="true"]') || []);
        expect(highlighted.length).toBeGreaterThan(0);
        expect(String(highlighted[0]?.textContent || '')).toContain('Scoped snippet');
    });

    test('browses recent durable knowledge runs and inspects a selected run', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness({ withI18n: true });
        if (!fetchMock) {
            throw new Error('expected fetch mock');
        }

        fetchMock.mockImplementationOnce(async () => createSseResponse([
            {
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_blocks_history',
                    emittedAt: '2026-04-13T00:01:00.000Z',
                    result: {
                        assistantMessage: 'Scoped Answer',
                        answer: 'Scoped Answer',
                        assistantBlocks: [
                            {
                                blockId: 'block_knowledge_run_1',
                                type: 'knowledge_run_summary',
                                title: 'Knowledge Run',
                                artifactId: 'workflow_artifact_knowledge_run_blocks_1',
                                knowledgeRun: {
                                    runId: 'knowledge_run_blocks_1',
                                    generatedAt: '2026-04-13T00:01:00.000Z',
                                    status: 'pass',
                                    scope: {
                                        source: 'scoped',
                                        workspaceId: 'waterglass',
                                        corpusId: 'waterglass',
                                        documentIds: [],
                                        atomIds: [],
                                        sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                        languages: [],
                                        matchedAtomCount: 1,
                                    },
                                    evidenceClaims: [],
                                    quality: {
                                        score: 100,
                                        status: 'pass',
                                        gates: [],
                                    },
                                    reviewCards: [],
                                    reviewState: {
                                        consumedCardIds: [],
                                        completedReviewCardCount: 0,
                                        remainingReviewCardCount: 1,
                                        completedAt: null,
                                    },
                                    summary: {
                                        claimCount: 1,
                                        verifiedClaimCount: 1,
                                        weakClaimCount: 0,
                                        notProvenClaimCount: 0,
                                        rejectedClaimCount: 0,
                                        reviewCardCount: 1,
                                        completedReviewCardCount: 0,
                                        remainingReviewCardCount: 1,
                                    },
                                },
                            },
                        ],
                        citations: [],
                        knowledgePoints: [],
                        recalledMemories: [],
                        memoryActions: [],
                        summary: {
                            generatedAt: '2026-04-13T00:01:00.000Z',
                            topK: 6,
                            returnedKnowledgePoints: 0,
                            returnedCitations: 0,
                            recalledMemoryCount: 0,
                            appliedMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 90,
                        },
                        trace: {
                            sessionId: 'session_blocks_1',
                            invocationId: 'invocation_blocks_1',
                            retrieval: {
                                retrievalModes: ['keyword'],
                                asOf: '2026-04-13T00:01:00.000Z',
                                totalActiveAtoms: 1,
                                modeWeights: {
                                    keyword: 1,
                                    graph: 0,
                                    temporal: 0,
                                },
                                latencyMs: 3,
                                evidenceCoverageRatio: 0.9,
                            },
                            recalledMemoryCount: 0,
                            appliedMemoryCount: 0,
                            usedScope: {
                                source: 'scoped',
                                workspaceId: 'waterglass',
                                corpusId: 'waterglass',
                                documentIds: [],
                                atomIds: [],
                                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
                                languages: [],
                                matchedAtomCount: 1,
                            },
                        },
                    },
                },
            },
        ]));

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'browse recent runs';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        const runtimeResult = (window as any).NoteConnectionAgentWorkspace.getLastConversationResult();
        const runBlock = Array.isArray(runtimeResult?.assistantBlocks)
            ? runtimeResult.assistantBlocks.find((block: any) => block && block.type === 'knowledge_run_summary')
            : null;
        expect(runBlock).toBeTruthy();
        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_blocks_1',
            title: 'Knowledge Run',
        }, {
            capabilityId: 'cap_browse_knowledge_runs_waterglass',
            actionId: 'browse_knowledge_runs',
            label: 'Recent Runs',
            request: {
                artifactKinds: ['knowledge_run'],
                workspaceId: 'waterglass',
                limit: 6,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_workflow_artifacts',
                resultPresentation: 'knowledge_run_history_card',
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const historyFetchCall = fetchMock.mock.calls.find((call) => String(call?.[0] || '').includes('artifactKinds=knowledge_run') && !String(call?.[0] || '').includes('artifactId=workflow_artifact_knowledge_run_blocks_1'));
        expect(String(historyFetchCall?.[0] || '')).toContain('workspaceId=waterglass');

        const evidencePane = document.getElementById('agent-evidence-pane');
        const evidenceBody = document.getElementById('agent-evidence-body');
        expect(evidencePane?.getAttribute('data-open')).toBe('true');
        expect(String(evidenceBody?.textContent || '')).toContain('Knowledge Run History');
        expect(String(evidenceBody?.textContent || '')).toContain('knowledge_run_blocks_1');
        expect(String(evidenceBody?.textContent || '')).toContain('knowledge_run_blocks_2');
        expect(String(evidenceBody?.textContent || '')).toContain('Release audit');
        expect(String(evidenceBody?.textContent || '')).toContain('2/2 reviewed; 0 unreviewed');
        expect(String(evidenceBody?.textContent || '')).toContain('release 1, revise 1, abstain 0, other 0');
        expect(String(evidenceBody?.textContent || '')).toContain('0 run(s); 0 fragment(s)');
        expect(String(evidenceBody?.textContent || '')).toContain('1 run(s); public_surface_contraction (1)');
        expect(String(evidenceBody?.textContent || '')).toContain('2026-04-13T00:01:01.000Z');
        expect(String(evidenceBody?.textContent || '')).toContain('Review trend');
        expect(String(evidenceBody?.textContent || '')).toContain('Recent reviewed window');
        expect(String(evidenceBody?.textContent || '')).toContain('2 run(s); release 1, revise 1, abstain 0, other 0; revised 1; failed 1; leaked 0; 2026-04-13T00:01:01.000Z -> 2026-04-12T23:55:01.000Z');
        expect(String(evidenceBody?.textContent || '')).toContain('Prior reviewed window');
        expect(String(evidenceBody?.textContent || '')).toContain('Review comparison');
        expect(String(evidenceBody?.textContent || '')).toContain('recent 2; prior 0; delta +2');
        expect(String(evidenceBody?.textContent || '')).toContain('knowledge_run_blocks_2 -> knowledge_run_blocks_1');
        expect(String(evidenceBody?.textContent || '')).toContain('decision revise -> release; revised yes -> no; leak delta 0; new none; resolved public_surface_contraction; persistent none');
        expect(String(evidenceBody?.textContent || '')).toContain('Gate shifts');
        expect(String(evidenceBody?.textContent || '')).toContain('recent 1; prior 0; delta +1; total 1; since last failure 1');
        expect(String(evidenceBody?.textContent || '')).toContain('Gate aging');
        expect(String(evidenceBody?.textContent || '')).toContain('1 fail(s); recent 2026-04-12T23:55:01.000Z; since last failure 1; recent window 1');
        expect(String(evidenceBody?.textContent || '')).toContain('Recent Runs');
        expect(String(evidenceBody?.textContent || '')).toContain('Graph signal');
        expect(String(evidenceBody?.textContent || '')).toContain('Release review');
        expect(String(evidenceBody?.textContent || '')).toContain('revise; revised yes; failed public_surface_contraction');
        expect(String(evidenceBody?.textContent || '')).toContain('available, paths 1, warnings 0');
        expect(String(evidenceBody?.textContent || '')).toContain('fallback, paths 0, warnings 1');

        const compareButton = evidenceBody?.querySelector('[data-agent-knowledge-run-history-compare="1"]') as HTMLButtonElement | null;
        expect(compareButton).not.toBeNull();
        compareButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        expect(String(evidenceBody?.textContent || '')).toContain('Knowledge Run Comparison');
        expect(String(evidenceBody?.textContent || '')).toContain('knowledge_run_blocks_2');
        expect(String(evidenceBody?.textContent || '')).toContain('knowledge_run_blocks_1');
        expect(String(evidenceBody?.textContent || '')).toContain('Quality delta');
        expect(String(evidenceBody?.textContent || '')).toContain('Weak-claim delta');
        expect(String(evidenceBody?.textContent || '')).toContain('Path delta');
        expect(String(evidenceBody?.textContent || '')).toContain('Temporal-warning delta');
        expect(String(evidenceBody?.textContent || '')).toContain('Graph fallback delta');
        expect(String(evidenceBody?.textContent || '')).toContain('Answer release');
        expect(String(evidenceBody?.textContent || '')).toContain('Latest release review');
        expect(String(evidenceBody?.textContent || '')).toContain('Compared release review');
        expect(String(evidenceBody?.textContent || '')).toContain('Release delta');
        expect(String(evidenceBody?.textContent || '')).toContain('Gate delta');
        expect(String(evidenceBody?.textContent || '')).toContain('decision revise -> release; revised yes -> no; leak delta 0');
        expect(String(evidenceBody?.textContent || '')).toContain('new none; resolved public_surface_contraction; persistent none');
        expect(String(evidenceBody?.textContent || '')).toContain('+1');

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_blocks_1',
            title: 'Knowledge Run',
        }, {
            capabilityId: 'cap_browse_knowledge_runs_waterglass',
            actionId: 'browse_knowledge_runs',
            label: 'Recent Runs',
            request: {
                artifactKinds: ['knowledge_run'],
                workspaceId: 'waterglass',
                limit: 6,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_workflow_artifacts',
                resultPresentation: 'knowledge_run_history_card',
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const historyInspectButton = evidenceBody?.querySelector('[data-agent-knowledge-run-history-inspect="1"]') as HTMLButtonElement | null;
        expect(historyInspectButton).not.toBeNull();
        historyInspectButton?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const detailFetchCall = fetchMock.mock.calls.find((call) => String(call?.[0] || '').includes('artifactId=workflow_artifact_knowledge_run_blocks_2'));
        expect(String(detailFetchCall?.[0] || '')).toContain('runId=knowledge_run_blocks_2');

        expect(String(evidenceBody?.textContent || '')).toContain('Knowledge Run Details');
        expect(String(evidenceBody?.textContent || '')).toContain('knowledge_run_blocks_2');
        expect(String(evidenceBody?.textContent || '')).toContain('Answer release review');
        expect(String(evidenceBody?.textContent || '')).toContain('Absorption depends on material interaction with incident radiation.');
    });

    test('updates the knowledge API status panel after a successful conversation call', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();
        if (!fetchMock) {
            throw new Error('expected fetch mock');
        }
        (window as any).__NC_ACTIVE_SOURCE_TARGET = {
            target: 'financial',
            source: 'test',
            scope: {
                workspaceId: 'financial',
                corpusId: 'financial',
                sourcePathPrefixes: ['Knowledge_Base/financial'],
            },
        };

        fetchMock.mockImplementationOnce(async () => createSseResponse([
            {
                event: 'turn_completed',
                payload: {
                    type: 'turn_completed',
                    turnId: 'turn_api_status',
                    emittedAt: '2026-04-13T00:00:00.120Z',
                    result: {
                        assistantMessage: 'grounded status response',
                        citations: [
                            {
                                citationId: 'citation_status_1',
                                sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                                startLine: 3,
                            },
                        ],
                        recalledMemories: [],
                        memoryActions: [],
                        knowledgePoints: [
                            {
                                atomId: 'atom_status',
                                documentId: 'doc_status',
                                title: 'Water Glass',
                                summary: 'A water glass is a physical system.',
                                evidenceSnippet: 'A water glass is a physical system.',
                                matchCount: 1,
                                matchedSpans: [],
                                score: 0.9,
                                capabilities: [],
                            },
                        ],
                        summary: {
                            generatedAt: '2026-04-13T00:00:00.120Z',
                            topK: 6,
                            returnedKnowledgePoints: 1,
                            returnedCitations: 1,
                            recalledMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 100,
                        },
                        trace: {
                            usedScope: {
                                source: 'scoped',
                                workspaceId: null,
                                corpusId: null,
                                documentIds: ['doc_status'],
                                atomIds: [],
                                sourcePathPrefixes: [],
                                languages: [],
                                matchedAtomCount: 1,
                                scopeSource: 'planner_scope_recovery',
                            },
                            retrieval: {
                                retrievalModes: ['keyword', 'planner_scope_recovery'],
                                scopeRecovery: {
                                    reason: 'title_like_document_hit_outside_requested_scope',
                                    recoveredDocumentIds: ['doc_status'],
                                    recoveredSourcePaths: ['Knowledge_Base/waterglass/water glass.md'],
                                },
                            },
                        },
                    },
                },
            },
        ]));

        const input = document.getElementById('agent-workspace-chat-input') as HTMLTextAreaElement;
        input.value = 'what is water glass?';
        await (window as any).NoteConnectionAgentWorkspace.sendConversation();

        const status = document.getElementById('agent-workspace-api-status');
        expect(status).not.toBeNull();
        expect(status?.getAttribute('data-api-state')).toBe('ok');
        const statusText = String(status?.textContent || '');
        expect(statusText).toContain('/api/knowledge/conversation');
        expect(statusText).toContain('SSE');
        expect(statusText).toContain('1 knowledge point');
        expect(statusText).toContain('1 citation');
        expect(statusText).toContain('Scope: financial');
        expect(statusText).toContain('Recovered: Knowledge_Base/waterglass/water glass.md');
        expect(statusText).toMatch(/\d+ ms/);
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
        const firstBody = JSON.parse(String(firstCall?.[1]?.body || '{}'));
        const secondBody = JSON.parse(String(secondCall?.[1]?.body || '{}'));
        expect(String(firstHeaders.Accept || '')).toBe('text/event-stream');
        expect(String(secondHeaders.Accept || '')).toBe('');
        const firstTurnId = String(firstHeaders['X-Agent-Conversation-Turn-Id'] || '');
        const secondTurnId = String(secondHeaders['X-Agent-Conversation-Turn-Id'] || '');
        expect(firstTurnId).toMatch(/^turn_client_/);
        expect(secondTurnId).toBe('turn_stream_incomplete');
        expect(String(secondHeaders['X-Agent-Conversation-Resume-Turn-Id'] || '')).toBe(secondTurnId);
        expect(String(firstBody.sessionId || '')).toMatch(/^session_client_path_user_default_/);
        expect(String(secondBody.sessionId || '')).toBe(String(firstBody.sessionId || ''));

        const assistantMessages = Array.from(
            document.querySelectorAll('.agent-chat-message-assistant')
        ).map((node) => String(node.textContent || ''));
        expect(
            assistantMessages.some((message) => message.includes('sync fallback response'))
        ).toBe(true);
    });

    test('reuses the existing pathApp producer for Godot Future Path pane actions', async () => {
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
            strategy: 'core',
            targetId: 'atom_paths',
            targetIds: ['atom_paths'],
        }));
        expect(pathApp?.triggerUpdate).toHaveBeenCalled();
        expect(document.querySelector('[data-agent-godot-future-path-shell="true"]')).not.toBeNull();
        expect(document.getElementById('agent-learning-path-body')?.querySelector('#path-container')).toBeNull();
    });

    test('keeps atom ids for learning API but configures pathApp with the resolved graph node', async () => {
        const {
            window,
            fetchMock,
            pathApp,
            graphView,
        } = loadAgentWorkspaceHarness();
        graphView?.resolveNodeByKnowledgePoint?.mockReturnValue({ id: 'water glass', label: 'water glass' });

        await (window as any).NoteConnectionAgentWorkspace.openLearningPath({
            atomId: 'atom_h',
            title: 'water glass',
            relationPath: [
                { sourceAtomId: 'atom_f', targetAtomId: 'atom_h', relationKind: 'sequence', confidence: 0.98 },
                { sourceAtomId: 'atom_h', targetAtomId: 'atom_j', relationKind: 'application', confidence: 0.95 },
            ],
        }, {
            capabilityId: 'cap_path_atom_h',
            actionId: 'open_learning_path',
            targetAtomId: 'atom_h',
            label: 'Learning Path',
            request: {
                focusAtomIds: ['atom_h'],
            },
        });

        const fetchCall = fetchMock?.mock.calls.find((call) => call[0] === '/api/knowledge/path');
        const requestBody = JSON.parse(String(fetchCall?.[1]?.body || '{}'));
        expect(requestBody.focusAtomIds).toEqual(['atom_h']);
        expect(graphView?.resolveNodeByKnowledgePoint).toHaveBeenCalled();
        expect(pathApp?.init).toHaveBeenCalledWith('water glass');
        expect(pathApp?.applyRemoteConfigure).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'diffusion',
            strategy: 'core',
            targetId: 'water glass',
            targetIds: ['water glass'],
        }));
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
        expect(card?.textContent).toContain('ANN circuit budget flags');
        expect(card?.textContent).toContain('warn exceeded');
        expect(card?.textContent).toContain('ANN traceability');
        expect(card?.textContent).toContain('partial');
        expect(card?.textContent).toContain('ANN traceability signals');
        expect(card?.textContent).toContain('requests 12');
        expect(card?.textContent).toContain('ANN prefilter');
        expect(card?.textContent).toContain('token_signature_prefilter');
        expect(card?.textContent).toContain('ANN prefilter thresholds');
        expect(card?.textContent).toContain('sample>=8');
        expect(card?.textContent).toContain('ANN prefilter calibration');
        expect(card?.textContent).toContain('sample ready');
        expect(card?.textContent).toContain('ANN calibration readiness');
        expect(card?.textContent).toContain('traceability pending');
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
        expect(card?.textContent).toContain('ANN circuit budget flag snapshot');
        expect(card?.textContent).toContain('warn clear');
        expect(card?.textContent).toContain('ANN traceability snapshot');
        expect(card?.textContent).toContain('full');
        expect(card?.textContent).toContain('ANN traceability signal snapshot');
        expect(card?.textContent).toContain('requests 18');
        expect(card?.textContent).toContain('ANN prefilter snapshot');
        expect(card?.textContent).toContain('token_signature_prefilter');
        expect(card?.textContent).toContain('ANN prefilter threshold snapshot');
        expect(card?.textContent).toContain('sample>=10');
        expect(card?.textContent).toContain('ANN prefilter calibration snapshot');
        expect(card?.textContent).toContain('selection active');
        expect(card?.textContent).toContain('ANN calibration readiness snapshot');
        expect(card?.textContent).toContain('traceability ready');
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

    test('executes workflow-artifact follow-up capabilities through the generic knowledge operation path', async () => {
        const {
            document,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();

        await (window as any).NoteConnectionAgentWorkspace.executeCapability({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
        }, {
            capabilityId: 'cap_flashcard_batch_atom_water_glass',
            actionId: 'inspect_flashcard_batch',
            targetAtomId: 'atom_water_glass',
            label: 'Review Cards',
            request: {
                workspaceId: 'waterglass',
                artifactKinds: ['flashcard_batch'],
                limit: 8,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'fetch_workflow_artifacts',
                resultPresentation: 'flashcard_batch_card',
            },
        });

        const fetchCall = fetchMock?.mock.calls.find((call) => String(call?.[0] || '').startsWith('/api/knowledge/workflow-artifacts'));
        expect(String(fetchCall?.[0] || '')).toContain('/api/knowledge/workflow-artifacts');
        expect(String(fetchCall?.[0] || '')).toContain('workspaceId=waterglass');
        expect(String(fetchCall?.[0] || '')).toContain('artifactKinds=flashcard_batch');

        const evidencePane = document.getElementById('agent-evidence-pane');
        const evidenceBody = document.getElementById('agent-evidence-body');
        expect(evidencePane?.getAttribute('data-open')).toBe('true');
        expect(String(evidenceBody?.textContent || '')).toContain('Review Card Batch');
        expect(String(evidenceBody?.textContent || '')).toContain('1 artifact(s), 1/1 review card(s) remaining.');
        expect(String(evidenceBody?.textContent || '')).toContain('What does the cited source establish about Water Glass?');
        expect(String(evidenceBody?.textContent || '')).toContain('Knowledge_Base/waterglass/water glass.md:3');
        expect(String(evidenceBody?.textContent || '')).toContain('Completed cards');
        expect(String(evidenceBody?.textContent || '')).toContain('Remaining cards');
        expect(String(evidenceBody?.textContent || '')).toContain('Artifact status');

        const followUpButton = evidenceBody?.querySelector('[data-agent-flashcard-follow-up="true"]') as HTMLButtonElement | null;
        expect(followUpButton).not.toBeNull();
        followUpButton?.click();
        for (let attempt = 0; attempt < 6; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 0));
            await Promise.resolve();
        }

        const followUpFetchCall = fetchMock?.mock.calls.find((call) => String(call?.[0] || '') === '/api/knowledge/workflow-artifacts/review-follow-up');
        expect(followUpFetchCall?.[0]).toBe('/api/knowledge/workflow-artifacts/review-follow-up');
        const followUpInit = followUpFetchCall?.[1] || {};
        const followUpBody = JSON.parse(String(followUpInit.body || '{}'));
        expect(followUpBody.userId).toBe('path_user_default');
        expect(followUpBody.artifactId).toBe('workflow_artifact_flashcard_batch_1');
        expect(followUpBody.cardId).toBe('knowledge_run_1_card_1');
        expect(followUpBody.action.atomId).toBe('atom_water_glass');
        expect(followUpBody.action.kind).toBe('review');
        expect(followUpBody.action.source).toBe('flashcard_batch');
        expect(followUpBody.action.prompt).toBe('What does the cited source establish about Water Glass?');

        const assistantMessages = Array.from(document.querySelectorAll('.agent-chat-message-assistant')).map((node) => String(node.textContent || ''));
        expect(assistantMessages.length).toBeGreaterThan(0);
        expect(assistantMessages.some((message) => message.includes('unsupported_operation') || message.includes('Unsupported'))).toBe(false);
        expect(String(evidenceBody?.textContent || '')).toContain('1 artifact(s), 0/1 review card(s) remaining.');
        expect(String(evidenceBody?.textContent || '')).toContain('archived');
        expect(evidenceBody?.querySelector('[data-agent-flashcard-follow-up="true"]')).toBeNull();
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

    test('persists interesting graph-focus diagnostics through the agent workspace runtime boundary', async () => {
        const {
            controller,
            window,
            fetchMock,
        } = loadAgentWorkspaceHarness();
        if (!fetchMock) {
            throw new Error('expected fetch mock');
        }

        const readContent = jest.fn(async (sourcePath: string) => {
            if (sourcePath === 'Knowledge_Base/old/location.md') {
                throw new Error('stale_path');
            }
            return '# Persistence\n\nRecovered source path content.';
        });
        const renderMarkdownInto = jest.fn(async (container: HTMLElement, markdown: string) => {
            container.innerHTML = `<p>${markdown}</p>`;
        });
        (window as any).NoteConnectionStorage = {
            createProvider: () => ({
                readContent,
            }),
        };
        const markdownRuntime = (window as any).NoteConnectionMarkdownRuntime || {};
        markdownRuntime.renderMarkdownInto = renderMarkdownInto;
        (window as any).NoteConnectionMarkdownRuntime = markdownRuntime;

        controller.openGraphFocusPane({
            atomId: 'atom_blocks',
            title: 'Blocks Citation',
            sourcePath: 'Knowledge_Base/old/location.md',
            matchedSpans: [
                {
                    title: 'Blocks Citation',
                    snippet: 'Recovered source path content.',
                    sourcePath: 'Knowledge_Base/optics/blocks.md',
                    startLine: 3,
                },
            ],
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        const graphFocusDiagnosticsCall = fetchMock.mock.calls.find((call) => call?.[0] === '/api/knowledge/session/graph-focus-diagnostics');
        expect(graphFocusDiagnosticsCall).toBeDefined();
        const requestBody = JSON.parse(String(graphFocusDiagnosticsCall?.[1]?.body || '{}'));
        expect(requestBody.userId).toBe('path_user_default');
        expect(String(requestBody.sessionId || '')).toContain('session_client_path_user_default_');
        expect(requestBody.workspaceId).toBe('optics');
        expect(requestBody.corpusId).toBe('optics');
        expect(requestBody.title).toBe('Blocks Citation');
        expect(requestBody.requestedSourcePath).toBe('Knowledge_Base/old/location.md');
        expect(requestBody.resolvedSourcePath).toBe('Knowledge_Base/optics/blocks.md');
        expect(requestBody.fallbackSourcePathUsed).toBe(true);
        expect(requestBody.usedFallback).toBe(false);
        expect(requestBody.candidateSourcePaths).toEqual([
            'Knowledge_Base/old/location.md',
            'Knowledge_Base/optics/blocks.md',
        ]);
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

/**
 * workbench_state.mjs — Extracted workbench state management.
 * Manages learning API request state, session history auto-refresh,
 * and workbench refresh lifecycle. Formerly inline in path_app.js.
 */

export function createWorkbenchState() {
    return {
        // Runtime config for path mode
        runtimeConfig: {
            mode: 'domain',
            strategy: 'foundational',
            layout: 'orbital',
            targetId: null,
            targetIds: [],
            autoReconstruct: true,
            retainHistory: true,
        },

        // Learning API request tracking
        _learningApiRequestCounter: 0,
        _learningSessionHistoryAutoRefreshTimer: null,
        _learningSessionHistoryQueuedRequestState: null,
        _learningSessionHistoryVisibilityListenerRegistered: false,
        _learningSessionHistoryAutoRefreshFailureCount: 0,
        _learningSessionHistoryAutoRefreshLastError: '',
        _learningSessionHistoryAutoRefreshLastTriggeredAt: '',
        _learningSessionHistoryAutoRefreshLastSuccessAt: '',
        _learningSessionHistoryAutoRefreshLastDelaySeconds: 0,

        // Workbench refresh lifecycle
        workbenchRefreshAttemptedAt: '',
        workbenchRefreshLastSuccessAt: '',
        workbenchRefreshDegraded: false,
        workbenchRefreshFailureSources: [],
        workbenchRefreshFailureCount: 0,
        workbenchRefreshLastFailureSummary: '',
        workbenchRefreshRecoveredSources: [],
        workbenchRefreshRecoveredCount: 0,
        workbenchRefreshConsecutiveDegradedCount: 0,
        workbenchRefreshLastDurationMs: 0,
        workbenchRefreshAutoRemediationAt: '',
        workbenchRefreshAutoRemediationApplied: false,
        workbenchRefreshAutoRemediationReason: '',
        workbenchRefreshAutoRemediationCheckId: '',
        workbenchRefreshAutoRemediationCount: 0,
    };
}

/**
 * Reset workbench refresh tracking after a successful refresh.
 */
export function markWorkbenchRefreshSuccess(state, durationMs = 0) {
    state.workbenchRefreshLastSuccessAt = new Date().toISOString();
    state.workbenchRefreshDegraded = false;
    state.workbenchRefreshFailureSources = [];
    state.workbenchRefreshFailureCount = 0;
    state.workbenchRefreshLastFailureSummary = '';
    state.workbenchRefreshConsecutiveDegradedCount = 0;
    state.workbenchRefreshLastDurationMs = durationMs;
}

/**
 * Record a degraded workbench refresh (partial failures).
 */
export function markWorkbenchRefreshDegraded(state, failedSources, summary) {
    state.workbenchRefreshDegraded = true;
    state.workbenchRefreshFailureSources = Array.isArray(failedSources) ? failedSources : [failedSources];
    state.workbenchRefreshFailureCount++;
    state.workbenchRefreshConsecutiveDegradedCount++;
    state.workbenchRefreshLastFailureSummary = String(summary || '');
    state.workbenchRefreshAttemptedAt = new Date().toISOString();
}

/**
 * Record an auto-remediation event.
 */
export function recordAutoRemediation(state, checkId, reason) {
    state.workbenchRefreshAutoRemediationAt = new Date().toISOString();
    state.workbenchRefreshAutoRemediationApplied = true;
    state.workbenchRefreshAutoRemediationReason = String(reason || '');
    state.workbenchRefreshAutoRemediationCheckId = String(checkId || '');
    state.workbenchRefreshAutoRemediationCount++;
}

/**
 * Get a diagnostic summary of the workbench state.
 */
export function getWorkbenchDiagnostics(state) {
    return {
        runtimeMode: state.runtimeConfig.mode,
        runtimeStrategy: state.runtimeConfig.strategy,
        apiRequestCount: state._learningApiRequestCounter,
        lastAutoRefreshSuccess: state._learningSessionHistoryAutoRefreshLastSuccessAt || null,
        autoRefreshFailureCount: state._learningSessionHistoryAutoRefreshFailureCount,
        workbenchDegraded: state.workbenchRefreshDegraded,
        workbenchFailureCount: state.workbenchRefreshFailureCount,
        workbenchConsecutiveDegraded: state.workbenchRefreshConsecutiveDegradedCount,
        autoRemediationCount: state.workbenchRefreshAutoRemediationCount,
    };
}

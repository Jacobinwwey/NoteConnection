#!/usr/bin/env node
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as readline from 'readline';
import { once } from 'events';
import { spawn } from 'child_process';
import { buildGraph } from './index';
import { CrashLogger } from './backend/utils/CrashLogger';
import { createResourceIdentity } from './backend/ResourceIdentity';
import { PathBridge } from './core/PathBridge';
import { GraphMetrics } from './backend/GraphMetrics';
import { LayoutEngine } from './backend/algorithms/LayoutEngine';
import { WasmParityRuntime } from './backend/algorithms/WasmParityRuntime';
import { resolveRuntimePaths } from './utils/RuntimePaths';
import { renderMathPng, renderMermaidPng } from './reader_renderer';
import { copyPngToClipboard } from './native_clipboard';
import {
    DEFAULT_SETTINGS as DEFAULT_NOTEMD_SETTINGS,
    LlmProviderClient,
    NotemdService,
    type LlmProviderConfig,
    type NotemdSettings,
    type ProgressEvent,
    type ProgressReporter,
} from './notemd';
import {
    applyFrontendSettingsToAppConfig,
    applyPathModeSettingsToAppConfig,
    applyNotemdSettingsToAppConfig,
    extractFrontendSettingsFromAppConfig,
    extractPathModeSettingsFromAppConfig,
    extractNotemdSettingsFromAppConfig,
    loadAppConfigToml,
    resolveAppConfigPath,
    type FrontendSettings,
    type PathModeSettings,
    saveAppConfigToml,
} from './notemd/AppConfigToml';
import {
    NOTEMD_PROVIDER_TEMPLATES,
    applyProviderTemplateToSettings,
    getNotemdProviderTemplate,
    mergeProviderTemplatesIntoNotemdSection,
} from './notemd/providerTemplates';
import {
    MarkdownGateway,
    MARKDOWN_PROTOCOL_VERSION,
    normalizeMarkdownRuntimeConfig,
} from './markdown/MarkdownGateway';
import {
    type AgentConversationResponse,
    buildRuntimeCapabilityRunbook,
    buildRuntimeCapabilityMatrix,
    createGraphQueryBackend,
    createGraphDbSnapshotAdapter,
    createVectorAccelerationAdapter,
    createKnowledgeLearningPlatform,
    createKnowledgeGraphStore,
    createRagSufficiencyProviderJudge,
    normalizeGraphQueryBackendType,
    normalizeGraphDbSnapshotAdapterProvider,
    normalizeGraphDbStoreOperationMode,
    normalizeLocalVectorAccelerationFailureMode,
    normalizeKnowledgeGraphStoreBackend,
    normalizeVectorAccelerationAdapterProvider,
    resolveRuntimeCapabilityThresholdsFromEnv,
    type AgentConversationRequest,
    type AgentConversationTurnEvent,
    type ConversationMemoryAddRequest,
    type ConversationMemoryDeleteRequest,
    type ConversationMemoryFeedbackRequest,
    type ConversationMemoryListRequest,
    type ConversationMemorySearchRequest,
    type IngestGuardrailEvaluationRequest,
    InvalidRequestError,
    type KnowledgeIngestRequest,
    type KnowledgeQueryBackendComparisonHistoryRequest,
    type KnowledgeQueryBackendComparisonTrendRequest,
    type KnowledgeQueryBackendComparisonRequest,
    type KnowledgeQueryBackendConfigRequest,
    type KnowledgeQueryBackendDiagnostics,
    type KnowledgeQueryRequest,
    type KnowledgeStalenessDiagnosticsRequest,
    type KnowledgeStalenessRebuildRequest,
    type LearningPathRequest,
    type LearningQualityEvaluationRequest,
    type LearningQualityHistoryRequest,
    type LearningQualitySnapshot,
    type LearningQualitySnapshotRequest,
    type LearningQualityThresholds,
    type LearningQualityTrendRequest,
    type MasteryDiagnosticsRequest,
    type MasteryMisconceptionRequest,
    type MemoryPolicyDiagnosticsHistoryRequest,
    type MemoryPolicyDiagnosticsRequest,
    type MemoryPolicyDiagnosticsTrendRequest,
    type MemoryPolicyRequest,
    type RuntimeCapabilityMatrix,
    type StudySessionActionExecutionRequest,
    type StudySessionHistoryRequest,
    type StudySessionOrchestrationConfigUpdateRequest,
    type StudySessionPlanExecutionRequest,
    type StudySessionPlanQualityEvaluationRequest,
    type StudySessionPlanQualityHistoryRequest,
    type StudySessionPlanQualityRuntimeThresholdDiagnosticsRequest,
    type StudySessionPlanQualityThresholds,
    type StudySessionPlanQualityTrendRequest,
    type StudySessionRequest,
    type TutorActionRequest,
    type TutorAdapter,
    type TutorProviderTrendHistoryRequest,
    type TutorProviderTrendDiagnosticsRequest,
    type TutorTraceDiagnosticsRequest,
} from './learning';
import {
    normalizeAgentConversationRequestPayload,
} from './learning/requestNormalization';
import { projectAnswerForMobile } from './learning/mobileAnswerProjection';
import {
    buildKnowledgeSourceInventoryDiff,
    deriveKnowledgeTargetLookupQueries as deriveKnowledgeTargetLookupQueriesFromMessage,
    markdownPreviewMatchesTitleLikeQueries,
    normalizeKnowledgeSourcePath,
} from './learning/workspaceHydration';
import { registerAllRoutes, type ServerContext, type RouteEntry } from './routes';
import { createRuntimeRunbookRouteOps } from './routes/runtimeRunbookRouteOps';
import { isRequestTokenAuthorized } from './middleware/auth';
import {
    KnowledgeIngestor, KnowledgeQuerier, ConversationManager,
    MasteryEngine, QualityEvaluator, TutorRouter, MemoryPolicyManager,
} from './learning/domains';

// Note: applyCorsHeaders, isAuthorizedRequest, resolveRequestId, ERROR_CODE_HEADER
// are defined locally in this file; the middleware module types are for external consumers.

type WritableProcessStream = NodeJS.WriteStream & {
    __noteConnectionBrokenPipeGuardInstalled?: boolean;
};

function installBrokenPipeGuard(stream: WritableProcessStream | undefined): void {
    if (!stream || stream.__noteConnectionBrokenPipeGuardInstalled) {
        return;
    }
    stream.__noteConnectionBrokenPipeGuardInstalled = true;
    stream.on('error', (error: NodeJS.ErrnoException) => {
        if (error?.code === 'EPIPE' || error?.code === 'ERR_STREAM_DESTROYED') {
            return;
        }
        throw error;
    });
}

installBrokenPipeGuard(process.stdout as WritableProcessStream);
installBrokenPipeGuard(process.stderr as WritableProcessStream);

const IS_JEST_RUNTIME = String(process.env.JEST_WORKER_ID || '').trim().length > 0;

function logDiagnostic(...args: unknown[]): void {
    if (IS_JEST_RUNTIME) {
        return;
    }
    console.log(...args);
}

function warnDiagnostic(...args: unknown[]): void {
    if (IS_JEST_RUNTIME) {
        return;
    }
    console.warn(...args);
}

type GuardedSocketPrototype = typeof net.Socket.prototype & {
    __noteConnectionBrokenPipeGuardInstalled?: boolean;
};

function installJestSocketBrokenPipeGuard(): void {
    if (!IS_JEST_RUNTIME) {
        return;
    }
    const socketPrototype = net.Socket.prototype as GuardedSocketPrototype;
    if (socketPrototype.__noteConnectionBrokenPipeGuardInstalled) {
        return;
    }

    const originalEmit = socketPrototype.emit;
    socketPrototype.__noteConnectionBrokenPipeGuardInstalled = true;
    socketPrototype.emit = function (this: net.Socket, event: string | symbol, ...args: unknown[]): boolean {
        if (
            event === 'error'
            && CrashLogger.isIgnorableProcessWriteError(args[0])
            && (this.destroyed || this.writable === false)
        ) {
            return true;
        }
        return originalEmit.call(this, event, ...args);
    };
}

installJestSocketBrokenPipeGuard();

// Initialize Global Crash Handlers
CrashLogger.initGlobalHandlers();

const LOOPBACK_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const PORT = Number(process.env.NOTE_CONNECTION_PORT || process.env.PORT || DEFAULT_PORT);
const PATH_BRIDGE_PORT = Number(process.env.NOTE_CONNECTION_BRIDGE_PORT || 9876);
let effectivePathBridgePort = PATH_BRIDGE_PORT;
const AUTH_TOKEN = String(process.env.NOTE_CONNECTION_AUTH_TOKEN || '').trim();
const REQUEST_ID_HEADER = 'x-request-id';
const ERROR_CODE_HEADER = 'x-error-code';
const AGENT_CONVERSATION_TURN_ID_HEADER = 'x-agent-conversation-turn-id';
const AGENT_CONVERSATION_RESUME_TURN_ID_HEADER = 'x-agent-conversation-resume-turn-id';
const CORS_ALLOWED_HEADER_NAMES = [
    'Content-Type',
    'Authorization',
    'X-NoteConnection-Token',
    'X-Request-Id',
    'X-Agent-Conversation-Turn-Id',
    'X-Agent-Conversation-Resume-Turn-Id',
];
const CORS_EXPOSED_HEADER_NAMES = [
    'X-Request-Id',
    'X-Error-Code',
    'X-Agent-Conversation-Turn-Id',
    'X-Agent-Conversation-Replay',
];
const AGENT_CONVERSATION_TURN_CACHE_TTL_MS = resolveAgentConversationTurnCacheTtlMs(process.env);
const AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES = resolveAgentConversationTurnCacheMaxEntries(process.env);
const AGENT_CONVERSATION_TURN_CACHE_MAX_EVENTS_PER_TURN = 64;
const AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS =
    resolveAgentConversationTurnCacheAlertThresholds(process.env);
const AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG =
    resolveAgentConversationTurnCacheAlertTrendConfig(process.env);
let pathBridge: PathBridge | null = null;
const MEBIBYTE_BYTES = 1024 * 1024;
const REQUEST_BODY_LIMIT_BYTES = 512 * 1024;
const REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB = {
    min: 64,
    max: 8192,
    default: 256
} as const;
const REQUEST_BODY_SPOOL_LARGE_GRAPH_KB = 1024;
const REQUEST_BODY_SPOOL_EXTREME_GRAPH_KB = 2048;
const REQUEST_BODY_LARGE_GRAPH_NODE_THRESHOLD = 5000;
const REQUEST_BODY_EXTREME_GRAPH_NODE_THRESHOLD = 20000;
const REQUEST_BODY_LARGE_GRAPH_EDGE_THRESHOLD = 500000;
const REQUEST_BODY_EXTREME_GRAPH_EDGE_THRESHOLD = 2000000;
const CLIPBOARD_BODY_LIMIT_RANGE_MB = {
    min: 1,
    max: 512,
    default: 64
} as const;
const CLIPBOARD_BODY_LIMIT_MB = resolveBoundedMegabytesFromEnv({
    envKey: 'NOTE_CONNECTION_CLIPBOARD_BODY_LIMIT_MB',
    defaultMb: CLIPBOARD_BODY_LIMIT_RANGE_MB.default,
    minMb: CLIPBOARD_BODY_LIMIT_RANGE_MB.min,
    maxMb: CLIPBOARD_BODY_LIMIT_RANGE_MB.max
});
const CLIPBOARD_BODY_LIMIT_BYTES = CLIPBOARD_BODY_LIMIT_MB * MEBIBYTE_BYTES;
const REQUEST_BODY_SPOOL_THRESHOLD_POLICY = resolveRequestBodySpoolThresholdPolicy(process.env);
const REQUEST_BODY_SPOOL_THRESHOLD_BYTES = REQUEST_BODY_SPOOL_THRESHOLD_POLICY.selectedBytes;
const ALLOWED_ORIGIN_PATTERNS = parseAllowedOrigins(
    process.env.NOTE_CONNECTION_ALLOWED_ORIGINS ||
    'tauri://localhost,http://tauri.localhost,http://localhost,http://127.0.0.1,capacitor://localhost'
);
const FORCE_FRONTEND_MERMAID_RENDER = String(process.env.NOTE_CONNECTION_READER_FRONTEND_MERMAID || '').trim() === '1';
const runtimePaths = resolveRuntimePaths(__dirname);
const FRONTEND_DIR = runtimePaths.frontendDir;
const RUNTIME_DATA_DIR = runtimePaths.runtimeDataDir;
const AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_SCHEMA_VERSION = 1;
const AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_PATH = path.join(
    RUNTIME_DATA_DIR,
    'agent_conversation_turn_cache_alert_history.v1.json'
);
const RUNTIME_RUNBOOK_CHECK_ID_CONVERSATION_TURN_CACHE_ALERT_TREND = 'conversation_turn_cache_alert_trend';
const AGENT_WORKSPACE_DIAGNOSTICS_DIR = path.join(RUNTIME_DATA_DIR, 'agent_workspace_diagnostics');
const AGENT_WORKSPACE_DIAGNOSTICS_INDEX_PATH = path.join(AGENT_WORKSPACE_DIAGNOSTICS_DIR, 'index.v1.json');
const AGENT_WORKSPACE_DIAGNOSTICS_TRIAGE_POLICY_PATH = path.join(
    AGENT_WORKSPACE_DIAGNOSTICS_DIR,
    'triage_policy.v1.json'
);
const AGENT_WORKSPACE_DIAGNOSTICS_TRIAGE_POLICY_AUDIT_PATH = path.join(
    AGENT_WORKSPACE_DIAGNOSTICS_DIR,
    'triage_policy_audit.v1.json'
);
const AGENT_WORKSPACE_DIAGNOSTICS_MAX_ENTRIES = 40;
const AGENT_WORKSPACE_DIAGNOSTICS_TRIAGE_TOP_LIMIT = 5;
const AGENT_WORKSPACE_DIAGNOSTICS_TRIAGE_TOP_LIMIT_MIN = 1;
const AGENT_WORKSPACE_DIAGNOSTICS_TRIAGE_TOP_LIMIT_MAX = 10;
const REQUEST_BODY_SPOOL_DIR = path.join(runtimePaths.projectRoot, 'tmp', 'request-bodies');
const KNOWLEDGE_WORKSPACE_TITLE_PREVIEW_BYTES = 16 * 1024;
const KNOWLEDGE_WORKSPACE_LARGE_TARGET_FILE_THRESHOLD = 100;
const KNOWLEDGE_WORKSPACE_MAX_SELECTIVE_HYDRATION_FILES = 32;
let KB_ROOT = runtimePaths.kbRoot;
let activeBuildKey: string | null = null;
let activeBuildPromise: Promise<unknown> | null = null;
let ACTIVE_GRAPH_TARGET = 'ALL_FOLDERS';
let lastRestoreKey: string | null = null;
let lastRestoreTs = 0;
const activeKnowledgeWorkspaceSyncs = new Map<string, Promise<{
    target: string;
    documentCount: number;
    summary: {
        ingestedDocuments: number;
        changedDocuments: number;
        deletedDocuments: number;
        activeAtoms: number;
        activeRelationEdges: number;
        recomputedDynamicRelations: boolean;
        invalidatedRelationEdges: number;
        regeneratedRelationEdges: number;
        resolvedRelationRecomputeMode: string;
        relationRecomputeLatencyMs: number;
    };
}>>();
const SIDECAR_RUNTIME_MANIFEST = path.join(runtimePaths.projectRoot, 'tmp', 'active-sidecar-runtime.json');
const notemdService = new NotemdService();
const notemdLlmClient = new LlmProviderClient();
const API_REQUEST_TRACE_MAX_RECORDS = 400;
const RUNTIME_RUNBOOK_VERIFICATION_HISTORY_MAX_RECORDS = 300;
const RUNTIME_RUNBOOK_REMEDIATION_EVENT_MAX_RECORDS = 400;

type ApiRequestStatusBucket = '2xx' | '3xx' | '4xx' | '5xx' | 'other';

type ApiRequestTraceRecord = {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    errorCode?: string;
    durationMs: number;
    startedAt: string;
    finishedAt: string;
    responseContentType: string;
    responseContentLength: number | null;
    requestContentLength: number | null;
    remoteAddress: string;
    userAgent: string;
};

type RuntimeRequestTraceQueryOptions = {
    limit: number;
    pathPrefix: string;
    statusAtLeast: number;
    method: string;
    errorCode: string;
    requestId: string;
};

type RuntimeRunbookVerificationStatus = 'pass' | 'warn' | 'fail' | 'unknown';
type RuntimeRunbookTopRiskStatus = 'pass' | 'warn' | 'fail' | 'none';
type RuntimeRunbookVerificationEscalation = 'normal' | 'watch' | 'high' | 'critical';
type RuntimeRunbookEscalationActionPriority = 'p0' | 'p1' | 'p2';
type RuntimeRunbookEscalationActionCategory =
    | 'stabilize'
    | 'governance'
    | 'trend'
    | 'routing'
    | 'evidence'
    | 'verify'
    | 'monitor';

type RuntimeRunbookEscalationActionItem = {
    actionId: string;
    priority: RuntimeRunbookEscalationActionPriority;
    category: RuntimeRunbookEscalationActionCategory;
    instruction: string;
    endpointHint: string;
    automationHint: string;
};

type RuntimeRunbookCheckActionQueueItem = {
    queueId: string;
    checkId: string;
    checkLatestStatus: RuntimeRunbookVerificationStatus;
    checkLatestEscalation: RuntimeRunbookVerificationEscalation;
    checkTrendStatus: RuntimeRunbookVerificationHistoryTrendStatus;
    remediationLatestStatus: RuntimeRunbookRemediationEventStatus | '';
    remediationTrendStatus: RuntimeRunbookRemediationEventTrendStatus | '';
    remediationActiveRiskStreak: number;
    remediationRiskRatioPct: number;
    actionId: string;
    priority: RuntimeRunbookEscalationActionPriority;
    category: RuntimeRunbookEscalationActionCategory;
    instruction: string;
    endpointHint: string;
    automationHint: string;
};

type RuntimeRunbookVerificationHistoryRecord = {
    verifiedAt: string;
    checkId: string;
    status: RuntimeRunbookVerificationStatus;
    priorityScore: number;
    topRiskCheckId: string;
    topRiskStatus: RuntimeRunbookTopRiskStatus;
    selectionSource: string;
    traceSummary: {
        returnedRecords: number;
        errorRequests: number;
        errorRatioPct: number;
        transientReturnedRatioPct: number;
        averageDurationMs: number;
        p95DurationMs: number;
        pathPrefix: string;
        statusAtLeast: number;
        method: string;
        errorCode: string;
    };
};

type RuntimeRunbookVerificationHistoryQueryOptions = {
    limit: number;
    checkId: string;
    sinceMinutes: number;
    status: RuntimeRunbookVerificationStatus | '';
};

type RuntimeRunbookVerificationHistoryTrendStatus =
    | 'improving'
    | 'stable'
    | 'regressing'
    | 'insufficient_data';

type RuntimeRunbookVerificationHistoryByCheckQueryOptions = {
    limit: number;
    sinceMinutes: number;
    status: RuntimeRunbookVerificationStatus | '';
    checkQuery: string;
    runtimeCapabilityMatrix?: RuntimeCapabilityMatrix | null;
};

type RuntimeRunbookVectorAccelerationCircuitBudgetStatus = 'ok' | 'warn' | 'fail';

type RuntimeRunbookVectorAccelerationCircuitBudgetSummary = {
    checkId: 'query_vector_acceleration_circuit_state';
    mode: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationMode'];
    healthStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationHealthStatus'];
    circuitState: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationCircuitState'];
    lastRequestId: string;
    lastErrorCode: string;
    lastRetryAfterMs: number;
    shortCircuitRatioPct: number;
    warnBudgetExceeded: boolean;
    failBudgetExceeded: boolean;
    budgetStatus: RuntimeRunbookVectorAccelerationCircuitBudgetStatus;
    budget: {
        warn: {
            shortCircuitCountLt: number;
            shortCircuitRatioPctLt: number;
            consecutiveFailuresLt: number;
            halfOpenSuccessRatePctGte: number;
        };
        fail: {
            shortCircuitCountLt: number;
            shortCircuitRatioPctLt: number;
            consecutiveFailuresLt: number;
            halfOpenSuccessRatePctGte: number;
        };
    };
};

type RuntimeRunbookVectorAccelerationTraceabilityCoverage = 'none' | 'partial' | 'full';

type RuntimeRunbookVectorAccelerationIndexSyncHealthSummary = {
    checkId: 'query_vector_acceleration_index_sync_health';
    mode: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationMode'];
    healthStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationHealthStatus'];
    adapterId: string;
    externalConnector: boolean;
    indexSyncStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationIndexSyncStatus'];
    indexSyncMessage: string;
    lastSyncAt: string;
    syncRequestCount: number;
    syncSuccessCount: number;
    syncFailureCount: number;
    syncedIndexSignature: string;
    syncedAtomCount: number;
    hasSyncedTelemetry: boolean;
};

type RuntimeRunbookVectorAccelerationPrefilterBudgetStatus = 'ok' | 'warn' | 'fail';

type RuntimeRunbookVectorAccelerationPrefilterSummary = {
    checkId: 'query_vector_acceleration_prefilter_effectiveness';
    mode: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationMode'];
    healthStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationHealthStatus'];
    circuitState: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationCircuitState'];
    selectionMode: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationLastSelectionMode'];
    requestCount: number;
    candidateCount: number;
    atomCount: number;
    candidateRatioPct: number;
    sampleReady: boolean;
    selectionActive: boolean;
    stableConnector: boolean;
    fullScanFallback: boolean;
    canEvaluateCandidateRatio: boolean;
    warnBudgetExceeded: boolean;
    failBudgetExceeded: boolean;
    budgetStatus: RuntimeRunbookVectorAccelerationPrefilterBudgetStatus;
    budget: {
        minRequestSampleGte: number;
        warnCandidateRatioPctLt: number;
        failCandidateRatioPctLt: number;
    };
};

type RuntimeRunbookVectorAccelerationTraceabilitySummary = {
    checkId: 'query_vector_acceleration_traceability';
    mode: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationMode'];
    healthStatus: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationHealthStatus'];
    circuitState: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationCircuitState'];
    adapterId: string;
    externalConnector: boolean;
    requestCount: number;
    consecutiveFailures: number;
    shortCircuitCount: number;
    lastRequestId: string;
    lastErrorCode: string;
    lastRetryAfterMs: number;
    hasCorrelationSignals: boolean;
    correlationCoverage: RuntimeRunbookVectorAccelerationTraceabilityCoverage;
    missingFields: string[];
};

type RuntimeRunbookVectorAccelerationCalibrationReadinessSummary = {
    checkId: 'query_vector_acceleration_calibration_readiness';
    status: RuntimeRunbookVerificationStatus;
    mode: RuntimeCapabilityMatrix['signals']['queryVectorIndexAccelerationMode'];
    externalConnector: boolean;
    syncReady: boolean;
    sampleReady: boolean;
    selectionActive: boolean;
    stableConnector: boolean;
    canEvaluateCandidateRatio: boolean;
    traceabilityReady: boolean;
    circuitBudgetStatus: RuntimeRunbookVectorAccelerationCircuitBudgetStatus;
    prefilterBudgetStatus: RuntimeRunbookVectorAccelerationPrefilterBudgetStatus;
    observed: string;
    expected: string;
};

type RuntimeRunbookActionQueuePriorityFilter = RuntimeRunbookEscalationActionPriority | 'all';
type RuntimeRunbookActionQueueCategoryFilter = RuntimeRunbookEscalationActionCategory | 'all';
type RuntimeRunbookActionQueueRemediationStatusFilter = RuntimeRunbookRemediationEventStatus | 'all';
type RuntimeRunbookActionQueueRemediationTrendFilter = RuntimeRunbookRemediationEventTrendStatus | 'all';

type RuntimeRunbookVerificationActionQueueQueryOptions = {
    checksQuery: RuntimeRunbookVerificationHistoryByCheckQueryOptions;
    queueLimit: number;
    priorityFilter: RuntimeRunbookActionQueuePriorityFilter;
    categoryFilter: RuntimeRunbookActionQueueCategoryFilter;
    checkIdFilter: string;
    remediationStatusFilter: RuntimeRunbookActionQueueRemediationStatusFilter;
    remediationTrendFilter: RuntimeRunbookActionQueueRemediationTrendFilter;
};

type RuntimeRunbookVerificationFocusMode = 'none' | 'recommended';

type RuntimeRunbookRemediationEventStatus =
    | 'applied'
    | 'not_applied'
    | 'cooldown'
    | 'error'
    | 'ignored';

type RuntimeRunbookRemediationEventRecord = {
    recordedAt: string;
    requestId: string;
    source: string;
    triggerReason: string;
    status: RuntimeRunbookRemediationEventStatus;
    applied: boolean;
    checkId: string;
    degradedStreakCount: number;
    failureCount: number;
    recoveredCount: number;
    failureSources: string[];
    recoveredSources: string[];
    detail: string;
    refreshAttemptedAt: string;
    refreshDurationMs: number;
};

type RuntimeRunbookRemediationEventQueryOptions = {
    limit: number;
    sinceMinutes: number;
    status: RuntimeRunbookRemediationEventStatus | '';
    checkId: string;
    source: string;
};

type RuntimeRunbookRemediationReplayMode = 'risk_only' | 'all';
type RuntimeRunbookRemediationReplaySelectionPolicy =
    | 'history_order'
    | 'risk_ratio_desc'
    | 'risk_streak_desc';
type RuntimeRunbookRemediationReplayScheduleTriggerPolicy =
    | 'always'
    | 'risk_ratio_threshold'
    | 'risk_streak_threshold'
    | 'risk_ratio_or_streak';
type RuntimeRunbookRemediationReplayScheduleAutoExecutionMode =
    | 'recommendation'
    | 'policy_template';

type RuntimeRunbookRemediationReplayRequestOptions = {
    limit: number;
    sinceMinutes: number;
    status: RuntimeRunbookRemediationEventStatus | '';
    checkId: string;
    source: string;
    replayLimit: number;
    replayMode: RuntimeRunbookRemediationReplayMode;
    replayDryRun: boolean;
    replaySelectionPolicy: RuntimeRunbookRemediationReplaySelectionPolicy;
    replayMinRiskRatioPct: number;
};

type RuntimeRunbookRemediationReplayScheduleConfig = {
    enabled: boolean;
    intervalMinutes: number;
    intervalJitterPct: number;
    cooldownMinutes: number;
    replayBudgetWindowMinutes: number;
    maxReplayChecksPerWindow: number;
    triggerPolicy: RuntimeRunbookRemediationReplayScheduleTriggerPolicy;
    triggerMinRiskRatioPct: number;
    triggerMinRiskStreak: number;
    autoExecution: {
        enabled: boolean;
        mode: RuntimeRunbookRemediationReplayScheduleAutoExecutionMode;
        requireDryRunParity: boolean;
        minConsecutiveSkips: number;
    };
    replayOptions: RuntimeRunbookRemediationReplayRequestOptions;
};

type RuntimeRunbookRemediationReplayScheduleRecommendationSeverity = 'critical' | 'warn' | 'info';

type RuntimeRunbookRemediationReplayScheduleRecommendation = {
    code: string;
    severity: RuntimeRunbookRemediationReplayScheduleRecommendationSeverity;
    reason: string;
    action: string;
};

type RuntimeRunbookRemediationReplaySchedulePolicyTemplateId =
    | 'balanced_guarded'
    | 'budget_relief'
    | 'high_risk_response'
    | 'cooldown_relief'
    | 'production_apply';

type RuntimeRunbookRemediationReplaySchedulePolicyTemplate = {
    templateId: RuntimeRunbookRemediationReplaySchedulePolicyTemplateId;
    reason: string;
    patch: {
        intervalMinutes?: number;
        cooldownMinutes?: number;
        replayBudgetWindowMinutes?: number;
        maxReplayChecksPerWindow?: number;
        triggerPolicy?: RuntimeRunbookRemediationReplayScheduleTriggerPolicy;
        triggerMinRiskRatioPct?: number;
        triggerMinRiskStreak?: number;
        replayOptions?: {
            replayLimit?: number;
            replayMode?: RuntimeRunbookRemediationReplayMode;
            replayDryRun?: boolean;
            replaySelectionPolicy?: RuntimeRunbookRemediationReplaySelectionPolicy;
            replayMinRiskRatioPct?: number;
        };
    };
};

type RuntimeRunbookRemediationReplayScheduleSnapshot = {
    config: RuntimeRunbookRemediationReplayScheduleConfig;
    telemetry: {
        lastEvaluatedAt: string;
        lastTriggeredAt: string;
        lastDecision: string;
        lastReason: string;
        lastError: string;
        consecutiveSkips: number;
        lastJitterDelaySeconds: number;
        effectiveIntervalSeconds: number;
        cooldownRemainingSeconds: number;
        budgetWindowStartedAt: string;
        currentWindowReplayChecks: number;
        remainingWindowReplayChecks: number;
        recommendations: RuntimeRunbookRemediationReplayScheduleRecommendation[];
        policyTemplates: RuntimeRunbookRemediationReplaySchedulePolicyTemplate[];
        autoExecution: {
            eligible: boolean;
            blockedReasons: string[];
            decision: string;
            lastAttemptedAt: string;
            lastExecutedAt: string;
        };
        lastOutcome: {
            replayDryRun: boolean;
            replayMode: RuntimeRunbookRemediationReplayMode;
            replayLimit: number;
            replaySelectionPolicy: RuntimeRunbookRemediationReplaySelectionPolicy;
            replayMinRiskRatioPct: number;
            plannedReplayChecks: number;
            plannedReplayCheckIds: string[];
            replayedChecks: number;
            replayedPassChecks: number;
            replayedWarnChecks: number;
            replayedFailChecks: number;
            replayedUnknownChecks: number;
            maxPlannedRiskRatioPct: number;
            maxPlannedRiskStreak: number;
            topPlannedCheckId: string;
            generatedAt: string;
        } | null;
    };
};

type RuntimeRunbookRemediationReplayScheduleExecutionRecord = {
    executedAt: string;
    replayChecks: number;
    dryRun: boolean;
};

type RuntimeRunbookRemediationEventTrendStatus =
    | 'improving'
    | 'stable'
    | 'regressing'
    | 'insufficient_data';

type RuntimeRunbookRemediationCheckSummary = {
    checkId: string;
    sinceMinutes: number;
    source: string;
    totalRecords: number;
    matchedRecords: number;
    returnedRecords: number;
    latestRecordedAt: string;
    latestStatus: RuntimeRunbookRemediationEventStatus | '';
    latestApplied: boolean;
    statusCounts: Record<RuntimeRunbookRemediationEventStatus, number>;
    appliedRatioPct: number;
    cooldownRatioPct: number;
    errorRatioPct: number;
    riskRatioPct: number;
    activeRiskStreak: number;
    activeCooldownStreak: number;
    activeErrorStreak: number;
    activeAppliedStreak: number;
    trendStatus: RuntimeRunbookRemediationEventTrendStatus;
    trendWindowSize: number;
    recentAverageSeverity: number;
    previousAverageSeverity: number;
    severityDelta: number;
};

const runtimeApiRequestTraceRecords: ApiRequestTraceRecord[] = [];
const runtimeRunbookVerificationHistoryRecords: RuntimeRunbookVerificationHistoryRecord[] = [];
const runtimeRunbookRemediationEventRecords: RuntimeRunbookRemediationEventRecord[] = [];
const runtimeRunbookRemediationReplayScheduleState: {
    config: RuntimeRunbookRemediationReplayScheduleConfig;
    lastEvaluatedAt: string;
    lastTriggeredAt: string;
    lastDecision: string;
    lastReason: string;
    lastError: string;
    consecutiveSkips: number;
    lastJitterDelaySeconds: number;
    effectiveIntervalSeconds: number;
    cooldownRemainingSeconds: number;
    budgetWindowStartedAt: string;
    currentWindowReplayChecks: number;
    remainingWindowReplayChecks: number;
    autoExecutionEligible: boolean;
    autoExecutionBlockedReasons: string[];
    autoExecutionDecision: string;
    autoExecutionLastAttemptedAt: string;
    autoExecutionLastExecutedAt: string;
    executionWindowRecords: RuntimeRunbookRemediationReplayScheduleExecutionRecord[];
    lastOutcome: RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry']['lastOutcome'];
} = {
    config: {
        enabled: false,
        intervalMinutes: 60,
        intervalJitterPct: 0,
        cooldownMinutes: 0,
        replayBudgetWindowMinutes: 60,
        maxReplayChecksPerWindow: 24,
        triggerPolicy: 'always',
        triggerMinRiskRatioPct: 50,
        triggerMinRiskStreak: 2,
        autoExecution: {
            enabled: false,
            mode: 'recommendation',
            requireDryRunParity: true,
            minConsecutiveSkips: 2,
        },
        replayOptions: {
            limit: 12,
            sinceMinutes: 1440,
            status: '',
            checkId: '',
            source: '',
            replayLimit: 6,
            replayMode: 'risk_only',
            replayDryRun: false,
            replaySelectionPolicy: 'history_order',
            replayMinRiskRatioPct: 0,
        },
    },
    lastEvaluatedAt: '',
    lastTriggeredAt: '',
    lastDecision: 'idle',
    lastReason: '',
    lastError: '',
    consecutiveSkips: 0,
    lastJitterDelaySeconds: 0,
    effectiveIntervalSeconds: 3600,
    cooldownRemainingSeconds: 0,
    budgetWindowStartedAt: '',
    currentWindowReplayChecks: 0,
    remainingWindowReplayChecks: 24,
    autoExecutionEligible: false,
    autoExecutionBlockedReasons: [],
    autoExecutionDecision: 'idle',
    autoExecutionLastAttemptedAt: '',
    autoExecutionLastExecutedAt: '',
    executionWindowRecords: [],
    lastOutcome: null,
};
const runtimeApiRequestTraceTotals = {
    totalRequests: 0,
    errorRequests: 0,
    statusBuckets: {
        '2xx': 0,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0,
        other: 0,
    } as Record<ApiRequestStatusBucket, number>,
    lastErrorAt: '',
    lastErrorPath: '',
    lastErrorCode: '',
};

function normalizeRuntimeRunbookCheckIdToken(rawValue: unknown): string {
    return String(rawValue || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, '')
        .slice(0, 128);
}

function normalizeRuntimeRunbookVerificationFocusMode(
    rawValue: unknown
): RuntimeRunbookVerificationFocusMode {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'recommended' || normalized === 'auto' || normalized === 'regressing') {
        return 'recommended';
    }
    return 'none';
}

function parseRuntimeRunbookVerificationHistoryLimit(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 20;
    }
    return Math.max(1, Math.min(200, Math.floor(numeric)));
}

function parseRuntimeRunbookVerificationHistorySinceMinutes(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(10080, Math.floor(numeric)));
}

function parseRuntimeRunbookVerificationHistoryByCheckLimit(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 8;
    }
    return Math.max(1, Math.min(50, Math.floor(numeric)));
}

function parseRuntimeRunbookVerificationActionQueueLimit(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 12;
    }
    return Math.max(1, Math.min(100, Math.floor(numeric)));
}

function parseRuntimeRunbookRemediationEventLimit(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 20;
    }
    return Math.max(1, Math.min(200, Math.floor(numeric)));
}

function parseRuntimeRunbookRemediationReplayLimit(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 6;
    }
    return Math.max(1, Math.min(24, Math.floor(numeric)));
}

function parseRuntimeRunbookRemediationReplayMinRiskRatioPct(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Number(Math.max(0, Math.min(100, numeric)).toFixed(4));
}

function parseRuntimeRunbookRemediationReplayScheduleIntervalMinutes(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 60;
    }
    return Math.max(1, Math.min(1440, Math.floor(numeric)));
}

function parseRuntimeRunbookRemediationReplayScheduleIntervalJitterPct(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Number(Math.max(0, Math.min(50, numeric)).toFixed(4));
}

function parseRuntimeRunbookRemediationReplayScheduleCooldownMinutes(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(1440, Math.floor(numeric)));
}

function parseRuntimeRunbookRemediationReplayScheduleBudgetWindowMinutes(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 60;
    }
    return Math.max(1, Math.min(10080, Math.floor(numeric)));
}

function parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 24;
    }
    return Math.max(1, Math.min(500, Math.floor(numeric)));
}

function parseRuntimeRunbookRemediationReplayScheduleTriggerMinRiskStreak(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 2;
    }
    return Math.max(1, Math.min(50, Math.floor(numeric)));
}

function parseRuntimeRunbookRemediationReplayScheduleAutoExecutionMinConsecutiveSkips(
    rawValue: unknown
): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 2;
    }
    return Math.max(0, Math.min(50, Math.floor(numeric)));
}

function normalizeRuntimeRunbookRemediationEventSourceToken(rawValue: unknown): string {
    return String(rawValue || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, '')
        .slice(0, 64);
}

function normalizeRuntimeRunbookRemediationEventStatusValue(
    rawValue: unknown,
    fallback: RuntimeRunbookRemediationEventStatus = 'not_applied'
): RuntimeRunbookRemediationEventStatus {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'applied') {
        return 'applied';
    }
    if (
        normalized === 'cooldown'
        || normalized === 'cooldown_active'
        || normalized === 'cooldown_skipped'
        || normalized === 'skipped_cooldown'
    ) {
        return 'cooldown';
    }
    if (normalized === 'error' || normalized === 'auto_focus_error') {
        return 'error';
    }
    if (
        normalized === 'ignored'
        || normalized === 'below_threshold'
        || normalized === 'not_triggered'
        || normalized === 'below_threshold_streak'
    ) {
        return 'ignored';
    }
    if (
        normalized === 'not_applied'
        || normalized === 'not-applied'
        || normalized === 'notapplied'
    ) {
        return 'not_applied';
    }
    return fallback;
}

function normalizeRuntimeRunbookRemediationEventStatusQueryToken(
    rawValue: unknown
): RuntimeRunbookRemediationEventStatus | '' {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'applied'
        || normalized === 'not_applied'
        || normalized === 'cooldown'
        || normalized === 'error'
        || normalized === 'ignored'
    ) {
        return normalized;
    }
    return '';
}

function normalizeRuntimeRunbookRemediationEventSources(rawValue: unknown): string[] {
    const rawItems = Array.isArray(rawValue)
        ? rawValue
        : String(rawValue || '')
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    const normalizedItems = rawItems
        .map((item) => String(item || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_:-]+/g, '')
            .slice(0, 64)
        )
        .filter((item) => item.length > 0);
    return Array.from(new Set(normalizedItems)).slice(0, 16);
}

function normalizeRuntimeRunbookRemediationEventQueryOptions(
    query: URLSearchParams | null | undefined
): RuntimeRunbookRemediationEventQueryOptions {
    return {
        limit: parseRuntimeRunbookRemediationEventLimit(query?.get('limit')),
        sinceMinutes: parseRuntimeRunbookVerificationHistorySinceMinutes(query?.get('sinceMinutes')),
        status: normalizeRuntimeRunbookRemediationEventStatusQueryToken(query?.get('status')),
        checkId: normalizeRuntimeRunbookCheckIdToken(query?.get('checkId')),
        source: normalizeRuntimeRunbookRemediationEventSourceToken(query?.get('source')),
    };
}

function normalizeRuntimeRunbookRemediationReplayMode(
    rawValue: unknown
): RuntimeRunbookRemediationReplayMode {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'all') {
        return 'all';
    }
    return 'risk_only';
}

function normalizeRuntimeRunbookRemediationReplaySelectionPolicy(
    rawValue: unknown
): RuntimeRunbookRemediationReplaySelectionPolicy {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'risk_ratio_desc'
        || normalized === 'risk-ratio-desc'
        || normalized === 'risk_ratio'
        || normalized === 'risk-ratio'
    ) {
        return 'risk_ratio_desc';
    }
    if (
        normalized === 'risk_streak_desc'
        || normalized === 'risk-streak-desc'
        || normalized === 'risk_streak'
        || normalized === 'risk-streak'
    ) {
        return 'risk_streak_desc';
    }
    return 'history_order';
}

function normalizeRuntimeRunbookRemediationReplayScheduleTriggerPolicy(
    rawValue: unknown
): RuntimeRunbookRemediationReplayScheduleTriggerPolicy {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'risk_ratio_threshold'
        || normalized === 'risk-ratio-threshold'
        || normalized === 'risk_ratio'
        || normalized === 'risk-ratio'
    ) {
        return 'risk_ratio_threshold';
    }
    if (
        normalized === 'risk_streak_threshold'
        || normalized === 'risk-streak-threshold'
        || normalized === 'risk_streak'
        || normalized === 'risk-streak'
    ) {
        return 'risk_streak_threshold';
    }
    if (
        normalized === 'risk_ratio_or_streak'
        || normalized === 'risk-ratio-or-streak'
        || normalized === 'risk_or_streak'
        || normalized === 'risk-or-streak'
    ) {
        return 'risk_ratio_or_streak';
    }
    return 'always';
}

function normalizeRuntimeRunbookRemediationReplayScheduleAutoExecutionMode(
    rawValue: unknown
): RuntimeRunbookRemediationReplayScheduleAutoExecutionMode {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'policy_template'
        || normalized === 'policy-template'
        || normalized === 'template'
        || normalized === 'policy'
    ) {
        return 'policy_template';
    }
    return 'recommendation';
}

function normalizeRuntimeRunbookRemediationReplaySchedulePolicyTemplateId(
    rawValue: unknown
): RuntimeRunbookRemediationReplaySchedulePolicyTemplateId | '' {
    const normalized = String(rawValue || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, '_');
    if (!normalized) {
        return '';
    }
    if (
        normalized === 'balanced_guarded'
        || normalized === 'balanced'
        || normalized === 'balanced_default'
    ) {
        return 'balanced_guarded';
    }
    if (
        normalized === 'budget_relief'
        || normalized === 'budget'
        || normalized === 'budget_recovery'
    ) {
        return 'budget_relief';
    }
    if (
        normalized === 'high_risk_response'
        || normalized === 'high_risk'
        || normalized === 'risk_response'
    ) {
        return 'high_risk_response';
    }
    if (
        normalized === 'cooldown_relief'
        || normalized === 'cooldown'
        || normalized === 'cooldown_recovery'
    ) {
        return 'cooldown_relief';
    }
    if (
        normalized === 'production_apply'
        || normalized === 'go_live'
        || normalized === 'apply'
    ) {
        return 'production_apply';
    }
    return '';
}

function normalizeRuntimeRunbookRemediationReplayRequestPayload(
    payload: unknown
): RuntimeRunbookRemediationReplayRequestOptions {
    const record = isObjectRecord(payload) ? payload : {};
    const limit = parseRuntimeRunbookRemediationEventLimit(
        readFirstPresentValue(record, ['limit', 'historyLimit', 'eventLimit'])
    );
    const sinceMinutes = parseRuntimeRunbookVerificationHistorySinceMinutes(
        readFirstPresentValue(record, ['sinceMinutes', 'windowMinutes'])
    );
    const status = normalizeRuntimeRunbookRemediationEventStatusQueryToken(
        readFirstPresentValue(record, ['status', 'statusFilter'])
    );
    const checkId = normalizeRuntimeRunbookCheckIdToken(
        readFirstPresentValue(record, ['checkId', 'checkIdFilter'])
    );
    const source = normalizeRuntimeRunbookRemediationEventSourceToken(
        readFirstPresentValue(record, ['source', 'sourceFilter'])
    );
    const replayLimit = parseRuntimeRunbookRemediationReplayLimit(
        readFirstPresentValue(record, ['replayLimit', 'checkLimit'])
    );
    const replayMode = normalizeRuntimeRunbookRemediationReplayMode(
        readFirstPresentValue(record, ['replayMode', 'mode'])
    );
    const replayDryRun = parseBooleanFlagOrUndefined(
        readFirstPresentValue(record, [
            'dryRun',
            'dry_run',
            'replayDryRun',
            'replay_dry_run',
            'previewOnly',
            'simulateOnly',
        ])
    ) === true;
    const replaySelectionPolicy = normalizeRuntimeRunbookRemediationReplaySelectionPolicy(
        readFirstPresentValue(record, [
            'replaySelectionPolicy',
            'selectionPolicy',
            'replayPolicy',
            'policy',
        ])
    );
    const replayMinRiskRatioPct = parseRuntimeRunbookRemediationReplayMinRiskRatioPct(
        readFirstPresentValue(record, [
            'replayMinRiskRatioPct',
            'minRiskRatioPct',
            'riskRatioGtePct',
            'riskRatioThresholdPct',
        ])
    );
    return {
        limit,
        sinceMinutes,
        status,
        checkId,
        source,
        replayLimit,
        replayMode,
        replayDryRun,
        replaySelectionPolicy,
        replayMinRiskRatioPct,
    };
}

function applyRuntimeRunbookRemediationReplayScheduleConfigGuardrails(
    config: RuntimeRunbookRemediationReplayScheduleConfig
): {
    config: RuntimeRunbookRemediationReplayScheduleConfig;
    reason: string;
} {
    const replayOptions = normalizeRuntimeRunbookRemediationReplayRequestPayload(
        config?.replayOptions || {}
    );
    let maxReplayChecksPerWindow = parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
        config?.maxReplayChecksPerWindow
    );
    const replayLimit = parseRuntimeRunbookRemediationReplayLimit(
        replayOptions.replayLimit
    );
    const rawAutoExecution: Record<string, unknown> = isObjectRecord(config?.autoExecution)
        ? config.autoExecution
        : {};
    const autoExecutionEnabled = parseBooleanFlagOrUndefined(
        rawAutoExecution.enabled
    ) === true;
    const autoExecutionMode = normalizeRuntimeRunbookRemediationReplayScheduleAutoExecutionMode(
        rawAutoExecution.mode
    );
    const autoExecutionRequireDryRunParity = parseBooleanFlagOrUndefined(
        rawAutoExecution.requireDryRunParity
    );
    const autoExecutionMinConsecutiveSkips =
        parseRuntimeRunbookRemediationReplayScheduleAutoExecutionMinConsecutiveSkips(
            rawAutoExecution.minConsecutiveSkips
        );
    const guardrailReasons: string[] = [];
    if (maxReplayChecksPerWindow < replayLimit) {
        guardrailReasons.push(
            `max_replay_checks_per_window_raised_to_replay_limit:${maxReplayChecksPerWindow}->${replayLimit}`
        );
        maxReplayChecksPerWindow = replayLimit;
    }
    return {
        config: {
            ...config,
            maxReplayChecksPerWindow,
            autoExecution: {
                enabled: autoExecutionEnabled,
                mode: autoExecutionMode,
                requireDryRunParity: typeof autoExecutionRequireDryRunParity === 'boolean'
                    ? autoExecutionRequireDryRunParity
                    : true,
                minConsecutiveSkips: autoExecutionMinConsecutiveSkips,
            },
            replayOptions: {
                ...replayOptions,
            },
        },
        reason: guardrailReasons.join(','),
    };
}

function resolveRuntimeRunbookRemediationReplaySchedulePolicyTemplatePatch(input: {
    templateId: RuntimeRunbookRemediationReplaySchedulePolicyTemplateId;
    config: RuntimeRunbookRemediationReplayScheduleConfig;
}): RuntimeRunbookRemediationReplaySchedulePolicyTemplate['patch'] {
    const config = cloneRuntimeRunbookRemediationReplayScheduleConfig(input.config);
    const replayLimit = parseRuntimeRunbookRemediationReplayLimit(config.replayOptions?.replayLimit);
    if (input.templateId === 'budget_relief') {
        return {
            replayBudgetWindowMinutes: Math.min(
                1440,
                Math.max(
                    parseRuntimeRunbookRemediationReplayScheduleBudgetWindowMinutes(
                        config.replayBudgetWindowMinutes
                    ),
                    240
                )
            ),
            maxReplayChecksPerWindow: Math.min(
                240,
                Math.max(
                    parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
                        config.maxReplayChecksPerWindow
                    ),
                    replayLimit * 3
                )
            ),
            triggerPolicy: 'risk_ratio_or_streak',
            triggerMinRiskRatioPct: Number(
                Math.max(30, Math.min(60, Number(config.triggerMinRiskRatioPct || 0))).toFixed(4)
            ),
            triggerMinRiskStreak: Math.max(
                1,
                Math.min(3, parseRuntimeRunbookRemediationReplayScheduleTriggerMinRiskStreak(
                    config.triggerMinRiskStreak
                ))
            ),
            replayOptions: {
                replayLimit: Math.max(1, Math.min(6, replayLimit)),
                replaySelectionPolicy: 'risk_ratio_desc',
                replayMinRiskRatioPct: Number(
                    Math.max(0, Math.min(70, Number(config.replayOptions?.replayMinRiskRatioPct || 0))).toFixed(4)
                ),
            },
        };
    }
    if (input.templateId === 'high_risk_response') {
        return {
            intervalMinutes: Math.max(
                5,
                Math.min(
                    parseRuntimeRunbookRemediationReplayScheduleIntervalMinutes(config.intervalMinutes),
                    15
                )
            ),
            cooldownMinutes: Math.max(
                0,
                Math.min(
                    parseRuntimeRunbookRemediationReplayScheduleCooldownMinutes(config.cooldownMinutes),
                    5
                )
            ),
            triggerPolicy: 'risk_ratio_or_streak',
            triggerMinRiskRatioPct: Number(
                Math.max(20, Math.min(45, Number(config.triggerMinRiskRatioPct || 0))).toFixed(4)
            ),
            triggerMinRiskStreak: Math.max(
                1,
                Math.min(2, parseRuntimeRunbookRemediationReplayScheduleTriggerMinRiskStreak(
                    config.triggerMinRiskStreak
                ))
            ),
            replayOptions: {
                replayMode: 'all',
                replaySelectionPolicy: 'risk_ratio_desc',
                replayLimit: Math.max(3, Math.min(12, replayLimit)),
                replayMinRiskRatioPct: Number(
                    Math.max(10, Math.min(80, Number(config.replayOptions?.replayMinRiskRatioPct || 0))).toFixed(4)
                ),
            },
        };
    }
    if (input.templateId === 'cooldown_relief') {
        const currentCooldownMinutes = parseRuntimeRunbookRemediationReplayScheduleCooldownMinutes(
            config.cooldownMinutes
        );
        return {
            cooldownMinutes: Math.max(0, Math.floor(currentCooldownMinutes / 2)),
            intervalMinutes: Math.max(
                5,
                Math.min(
                    parseRuntimeRunbookRemediationReplayScheduleIntervalMinutes(config.intervalMinutes),
                    30
                )
            ),
            triggerPolicy: 'risk_ratio_or_streak',
            triggerMinRiskStreak: 1,
            replayOptions: {
                replaySelectionPolicy: 'risk_streak_desc',
            },
        };
    }
    if (input.templateId === 'production_apply') {
        return {
            replayOptions: {
                replayDryRun: false,
                replayMode: 'all',
                replaySelectionPolicy: 'risk_ratio_desc',
            },
        };
    }
    return {
        intervalMinutes: Math.max(
            10,
            Math.min(
                parseRuntimeRunbookRemediationReplayScheduleIntervalMinutes(config.intervalMinutes),
                90
            )
        ),
        cooldownMinutes: Math.max(
            5,
            Math.min(
                parseRuntimeRunbookRemediationReplayScheduleCooldownMinutes(config.cooldownMinutes),
                60
            )
        ),
        replayBudgetWindowMinutes: Math.max(
            parseRuntimeRunbookRemediationReplayScheduleBudgetWindowMinutes(
                config.replayBudgetWindowMinutes
            ),
            120
        ),
        maxReplayChecksPerWindow: Math.max(
            parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
                config.maxReplayChecksPerWindow
            ),
            replayLimit * 2
        ),
        triggerPolicy: 'risk_ratio_or_streak',
        triggerMinRiskRatioPct: Number(
            Math.max(35, Math.min(70, Number(config.triggerMinRiskRatioPct || 0))).toFixed(4)
        ),
        triggerMinRiskStreak: Math.max(
            2,
            Math.min(4, parseRuntimeRunbookRemediationReplayScheduleTriggerMinRiskStreak(
                config.triggerMinRiskStreak
            ))
        ),
        replayOptions: {
            replaySelectionPolicy: 'risk_ratio_desc',
            replayLimit: Math.max(2, Math.min(10, replayLimit)),
            replayMinRiskRatioPct: Number(
                Math.max(0, Math.min(65, Number(config.replayOptions?.replayMinRiskRatioPct || 0))).toFixed(4)
            ),
        },
    };
}

function applyRuntimeRunbookRemediationReplaySchedulePolicyTemplate(
    input: {
        config: RuntimeRunbookRemediationReplayScheduleConfig;
        templateId: RuntimeRunbookRemediationReplaySchedulePolicyTemplateId;
    }
): RuntimeRunbookRemediationReplayScheduleConfig {
    const config = cloneRuntimeRunbookRemediationReplayScheduleConfig(input.config);
    const patch = resolveRuntimeRunbookRemediationReplaySchedulePolicyTemplatePatch({
        templateId: input.templateId,
        config,
    });
    const replayOptions = normalizeRuntimeRunbookRemediationReplayRequestPayload({
        ...config.replayOptions,
        ...(patch.replayOptions || {}),
    });
    return {
        enabled: config.enabled,
        intervalMinutes: typeof patch.intervalMinutes === 'number'
            ? parseRuntimeRunbookRemediationReplayScheduleIntervalMinutes(patch.intervalMinutes)
            : config.intervalMinutes,
        intervalJitterPct: config.intervalJitterPct,
        cooldownMinutes: typeof patch.cooldownMinutes === 'number'
            ? parseRuntimeRunbookRemediationReplayScheduleCooldownMinutes(patch.cooldownMinutes)
            : config.cooldownMinutes,
        replayBudgetWindowMinutes: typeof patch.replayBudgetWindowMinutes === 'number'
            ? parseRuntimeRunbookRemediationReplayScheduleBudgetWindowMinutes(
                patch.replayBudgetWindowMinutes
            )
            : config.replayBudgetWindowMinutes,
        maxReplayChecksPerWindow: typeof patch.maxReplayChecksPerWindow === 'number'
            ? parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
                patch.maxReplayChecksPerWindow
            )
            : config.maxReplayChecksPerWindow,
        triggerPolicy: typeof patch.triggerPolicy === 'string'
            ? normalizeRuntimeRunbookRemediationReplayScheduleTriggerPolicy(patch.triggerPolicy)
            : config.triggerPolicy,
        triggerMinRiskRatioPct: typeof patch.triggerMinRiskRatioPct === 'number'
            ? parseRuntimeRunbookRemediationReplayMinRiskRatioPct(patch.triggerMinRiskRatioPct)
            : config.triggerMinRiskRatioPct,
        triggerMinRiskStreak: typeof patch.triggerMinRiskStreak === 'number'
            ? parseRuntimeRunbookRemediationReplayScheduleTriggerMinRiskStreak(
                patch.triggerMinRiskStreak
            )
            : config.triggerMinRiskStreak,
        autoExecution: {
            ...config.autoExecution,
        },
        replayOptions,
    };
}

function normalizeRuntimeRunbookRemediationReplayScheduleConfigPayload(
    payload: unknown,
    baseline: RuntimeRunbookRemediationReplayScheduleConfig
): {
    config: RuntimeRunbookRemediationReplayScheduleConfig;
    guardrailReason: string;
    policyTemplateId: RuntimeRunbookRemediationReplaySchedulePolicyTemplateId | '';
} {
    const record = isObjectRecord(payload) ? payload : {};
    const scheduleRecord = isObjectRecord(
        readFirstPresentValue(record, ['schedule', 'config', 'replaySchedule', 'replay_schedule'])
    )
        ? readFirstPresentValue(record, [
            'schedule',
            'config',
            'replaySchedule',
            'replay_schedule',
        ]) as Record<string, unknown>
        : record;
    const replayRecord = isObjectRecord(
        readFirstPresentValue(scheduleRecord, ['replayOptions', 'replay', 'replayRequest', 'request'])
    )
        ? readFirstPresentValue(scheduleRecord, [
            'replayOptions',
            'replay',
            'replayRequest',
            'request',
        ]) as Record<string, unknown>
        : {};
    const autoExecutionRecord = isObjectRecord(
        readFirstPresentValue(scheduleRecord, ['autoExecution', 'auto_execution'])
    )
        ? readFirstPresentValue(scheduleRecord, ['autoExecution', 'auto_execution']) as Record<string, unknown>
        : {};
    const policyTemplateId = normalizeRuntimeRunbookRemediationReplaySchedulePolicyTemplateId(
        readFirstPresentValue(scheduleRecord, [
            'policyTemplateId',
            'policyTemplate',
            'templateId',
            'template',
            'scheduleTemplate',
        ])
    );
    const baselineWithTemplate = policyTemplateId
        ? applyRuntimeRunbookRemediationReplaySchedulePolicyTemplate({
            config: baseline,
            templateId: policyTemplateId,
        })
        : cloneRuntimeRunbookRemediationReplayScheduleConfig(baseline);
    const enabledRaw = readFirstPresentValue(scheduleRecord, ['enabled', 'isEnabled', 'active']);
    const enabled = typeof parseBooleanFlagOrUndefined(enabledRaw) === 'boolean'
        ? parseBooleanFlagOrUndefined(enabledRaw) as boolean
        : baselineWithTemplate.enabled;
    const intervalRaw = readFirstPresentValue(scheduleRecord, [
        'intervalMinutes',
        'intervalMins',
        'interval',
        'everyMinutes',
    ]);
    const intervalMinutes = typeof intervalRaw === 'undefined'
        ? baselineWithTemplate.intervalMinutes
        : parseRuntimeRunbookRemediationReplayScheduleIntervalMinutes(intervalRaw);
    const intervalJitterPctRaw = readFirstPresentValue(scheduleRecord, [
        'intervalJitterPct',
        'intervalJitterPercent',
        'jitterPct',
        'tickJitterPct',
    ]);
    const intervalJitterPct = typeof intervalJitterPctRaw === 'undefined'
        ? baselineWithTemplate.intervalJitterPct
        : parseRuntimeRunbookRemediationReplayScheduleIntervalJitterPct(intervalJitterPctRaw);
    const cooldownMinutesRaw = readFirstPresentValue(scheduleRecord, [
        'cooldownMinutes',
        'cooldownMins',
        'cooldown',
    ]);
    const cooldownMinutes = typeof cooldownMinutesRaw === 'undefined'
        ? baselineWithTemplate.cooldownMinutes
        : parseRuntimeRunbookRemediationReplayScheduleCooldownMinutes(cooldownMinutesRaw);
    const replayBudgetWindowMinutesRaw = readFirstPresentValue(scheduleRecord, [
        'replayBudgetWindowMinutes',
        'budgetWindowMinutes',
        'replayWindowMinutes',
    ]);
    const replayBudgetWindowMinutes = typeof replayBudgetWindowMinutesRaw === 'undefined'
        ? baselineWithTemplate.replayBudgetWindowMinutes
        : parseRuntimeRunbookRemediationReplayScheduleBudgetWindowMinutes(
            replayBudgetWindowMinutesRaw
        );
    const maxReplayChecksPerWindowRaw = readFirstPresentValue(scheduleRecord, [
        'maxReplayChecksPerWindow',
        'maxReplayChecks',
        'replayBudgetMaxChecks',
    ]);
    const maxReplayChecksPerWindow = typeof maxReplayChecksPerWindowRaw === 'undefined'
        ? baselineWithTemplate.maxReplayChecksPerWindow
        : parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
            maxReplayChecksPerWindowRaw
        );
    const triggerPolicyRaw = readFirstPresentValue(scheduleRecord, [
        'triggerPolicy',
        'trigger',
        'policy',
    ]);
    const triggerPolicy = typeof triggerPolicyRaw === 'undefined'
        ? baselineWithTemplate.triggerPolicy
        : normalizeRuntimeRunbookRemediationReplayScheduleTriggerPolicy(triggerPolicyRaw);
    const triggerMinRiskRatioPctRaw = readFirstPresentValue(scheduleRecord, [
        'triggerMinRiskRatioPct',
        'minRiskRatioPct',
        'riskRatioThresholdPct',
        'triggerRiskRatioPct',
    ]);
    const triggerMinRiskRatioPct = typeof triggerMinRiskRatioPctRaw === 'undefined'
        ? baselineWithTemplate.triggerMinRiskRatioPct
        : parseRuntimeRunbookRemediationReplayMinRiskRatioPct(triggerMinRiskRatioPctRaw);
    const triggerMinRiskStreakRaw = readFirstPresentValue(scheduleRecord, [
        'triggerMinRiskStreak',
        'minRiskStreak',
        'riskStreakThreshold',
        'triggerRiskStreak',
    ]);
    const triggerMinRiskStreak = typeof triggerMinRiskStreakRaw === 'undefined'
        ? baselineWithTemplate.triggerMinRiskStreak
        : parseRuntimeRunbookRemediationReplayScheduleTriggerMinRiskStreak(triggerMinRiskStreakRaw);
    const autoExecutionEnabledRaw = readFirstPresentValue(
        autoExecutionRecord,
        ['enabled', 'isEnabled', 'active']
    );
    const autoExecutionEnabledScheduleRaw = readFirstPresentValue(
        scheduleRecord,
        ['autoExecutionEnabled', 'auto_execution_enabled']
    );
    const autoExecutionEnabled = (() => {
        const fromAutoExecutionRecord = parseBooleanFlagOrUndefined(autoExecutionEnabledRaw);
        if (typeof fromAutoExecutionRecord === 'boolean') {
            return fromAutoExecutionRecord;
        }
        const fromScheduleRecord = parseBooleanFlagOrUndefined(autoExecutionEnabledScheduleRaw);
        if (typeof fromScheduleRecord === 'boolean') {
            return fromScheduleRecord;
        }
        return baselineWithTemplate.autoExecution.enabled;
    })();
    const autoExecutionModeRaw = readFirstPresentValue(
        autoExecutionRecord,
        ['mode', 'executionMode', 'strategy']
    );
    const autoExecutionModeScheduleRaw = readFirstPresentValue(
        scheduleRecord,
        ['autoExecutionMode', 'auto_execution_mode']
    );
    const autoExecutionMode = (
        typeof autoExecutionModeRaw !== 'undefined'
            ? normalizeRuntimeRunbookRemediationReplayScheduleAutoExecutionMode(autoExecutionModeRaw)
            : (
                typeof autoExecutionModeScheduleRaw !== 'undefined'
                    ? normalizeRuntimeRunbookRemediationReplayScheduleAutoExecutionMode(autoExecutionModeScheduleRaw)
                    : baselineWithTemplate.autoExecution.mode
            )
    );
    const autoExecutionRequireDryRunParityRaw = readFirstPresentValue(
        autoExecutionRecord,
        ['requireDryRunParity', 'requireDryRun', 'dryRunParityRequired']
    );
    const autoExecutionRequireDryRunParityScheduleRaw = readFirstPresentValue(
        scheduleRecord,
        ['autoExecutionRequireDryRunParity', 'auto_execution_require_dry_run_parity']
    );
    const autoExecutionRequireDryRunParity = (() => {
        const fromAutoExecutionRecord = parseBooleanFlagOrUndefined(
            autoExecutionRequireDryRunParityRaw
        );
        if (typeof fromAutoExecutionRecord === 'boolean') {
            return fromAutoExecutionRecord;
        }
        const fromScheduleRecord = parseBooleanFlagOrUndefined(
            autoExecutionRequireDryRunParityScheduleRaw
        );
        if (typeof fromScheduleRecord === 'boolean') {
            return fromScheduleRecord;
        }
        return baselineWithTemplate.autoExecution.requireDryRunParity;
    })();
    const autoExecutionMinConsecutiveSkipsRaw = readFirstPresentValue(
        autoExecutionRecord,
        ['minConsecutiveSkips', 'minSkipStreak', 'minimumSkipStreak']
    );
    const autoExecutionMinConsecutiveSkipsScheduleRaw = readFirstPresentValue(
        scheduleRecord,
        ['autoExecutionMinConsecutiveSkips', 'auto_execution_min_consecutive_skips']
    );
    const autoExecutionMinConsecutiveSkips = (
        typeof autoExecutionMinConsecutiveSkipsRaw !== 'undefined'
            ? parseRuntimeRunbookRemediationReplayScheduleAutoExecutionMinConsecutiveSkips(
                autoExecutionMinConsecutiveSkipsRaw
            )
            : (
                typeof autoExecutionMinConsecutiveSkipsScheduleRaw !== 'undefined'
                    ? parseRuntimeRunbookRemediationReplayScheduleAutoExecutionMinConsecutiveSkips(
                        autoExecutionMinConsecutiveSkipsScheduleRaw
                    )
                    : baselineWithTemplate.autoExecution.minConsecutiveSkips
            )
    );
    const replayOptions = normalizeRuntimeRunbookRemediationReplayRequestPayload({
        ...baselineWithTemplate.replayOptions,
        ...replayRecord,
        ...scheduleRecord,
    });
    const guardrailed = applyRuntimeRunbookRemediationReplayScheduleConfigGuardrails({
        enabled,
        intervalMinutes,
        intervalJitterPct,
        cooldownMinutes,
        replayBudgetWindowMinutes,
        maxReplayChecksPerWindow,
        triggerPolicy,
        triggerMinRiskRatioPct,
        triggerMinRiskStreak,
        autoExecution: {
            enabled: autoExecutionEnabled,
            mode: autoExecutionMode,
            requireDryRunParity: autoExecutionRequireDryRunParity,
            minConsecutiveSkips: autoExecutionMinConsecutiveSkips,
        },
        replayOptions,
    });
    return {
        config: guardrailed.config,
        guardrailReason: guardrailed.reason,
        policyTemplateId,
    };
}

function normalizeRuntimeRunbookRemediationReplayScheduleTickPayload(payload: unknown): {
    force: boolean;
    dryRunOverride: boolean | null;
} {
    const record = isObjectRecord(payload) ? payload : {};
    const force = parseBooleanFlagOrUndefined(
        readFirstPresentValue(record, ['force', 'ignoreInterval', 'runNow', 'run_now'])
    ) === true;
    const dryRunOverrideRaw = parseBooleanFlagOrUndefined(
        readFirstPresentValue(record, ['dryRun', 'dry_run', 'previewOnly', 'simulateOnly'])
    );
    return {
        force,
        dryRunOverride: typeof dryRunOverrideRaw === 'boolean' ? dryRunOverrideRaw : null,
    };
}

function normalizeRuntimeRunbookVerificationActionQueuePriorityFilterToken(
    rawValue: unknown
): RuntimeRunbookActionQueuePriorityFilter {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'p0' || normalized === 'p1' || normalized === 'p2') {
        return normalized;
    }
    return 'all';
}

function normalizeRuntimeRunbookVerificationActionQueueCategoryFilterToken(
    rawValue: unknown
): RuntimeRunbookActionQueueCategoryFilter {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'stabilize'
        || normalized === 'governance'
        || normalized === 'trend'
        || normalized === 'routing'
        || normalized === 'evidence'
        || normalized === 'verify'
        || normalized === 'monitor'
    ) {
        return normalized;
    }
    return 'all';
}

function normalizeRuntimeRunbookVerificationActionQueueRemediationStatusFilterToken(
    rawValue: unknown
): RuntimeRunbookActionQueueRemediationStatusFilter {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'applied'
        || normalized === 'not_applied'
        || normalized === 'cooldown'
        || normalized === 'error'
        || normalized === 'ignored'
    ) {
        return normalized;
    }
    return 'all';
}

function normalizeRuntimeRunbookVerificationActionQueueRemediationTrendFilterToken(
    rawValue: unknown
): RuntimeRunbookActionQueueRemediationTrendFilter {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'improving'
        || normalized === 'stable'
        || normalized === 'regressing'
        || normalized === 'insufficient_data'
    ) {
        return normalized;
    }
    return 'all';
}

function normalizeRuntimeRunbookVerificationStatusToken(
    rawValue: unknown
): RuntimeRunbookVerificationStatus | '' {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'pass'
        || normalized === 'warn'
        || normalized === 'fail'
        || normalized === 'unknown'
    ) {
        return normalized;
    }
    return '';
}

function normalizeRuntimeRunbookVerificationHistoryCheckQueryToken(rawValue: unknown): string {
    return String(rawValue || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, '')
        .slice(0, 64);
}

function getRuntimeRunbookVerificationStatusSeverity(status: RuntimeRunbookVerificationStatus): number {
    if (status === 'fail') {
        return 3;
    }
    if (status === 'warn') {
        return 2;
    }
    if (status === 'pass') {
        return 1;
    }
    return 2;
}

function isRuntimeRunbookVerificationRiskStatus(status: RuntimeRunbookVerificationStatus): boolean {
    return status === 'warn' || status === 'fail';
}

function computeRuntimeRunbookVerificationStatusStreak(
    records: RuntimeRunbookVerificationHistoryRecord[],
    predicate: (status: RuntimeRunbookVerificationStatus) => boolean
): number {
    let streak = 0;
    for (let index = 0; index < records.length; index += 1) {
        const status = records[index]?.status || 'unknown';
        if (!predicate(status)) {
            break;
        }
        streak += 1;
    }
    return streak;
}

function getRuntimeRunbookRemediationEventSeverity(status: RuntimeRunbookRemediationEventStatus): number {
    if (status === 'error') {
        return 4;
    }
    if (status === 'cooldown') {
        return 3;
    }
    if (status === 'not_applied') {
        return 2.5;
    }
    if (status === 'ignored') {
        return 2;
    }
    return 1;
}

function isRuntimeRunbookRemediationRiskStatus(status: RuntimeRunbookRemediationEventStatus): boolean {
    return status === 'error' || status === 'cooldown' || status === 'not_applied';
}

function computeRuntimeRunbookRemediationEventStatusStreak(
    records: RuntimeRunbookRemediationEventRecord[],
    predicate: (status: RuntimeRunbookRemediationEventStatus) => boolean
): number {
    let streak = 0;
    for (let index = 0; index < records.length; index += 1) {
        const status = records[index]?.status || 'ignored';
        if (!predicate(status)) {
            break;
        }
        streak += 1;
    }
    return streak;
}

function getRuntimeRunbookRemediationEventStatusRank(
    status: RuntimeRunbookRemediationEventStatus | ''
): number {
    if (status === 'error') {
        return 5;
    }
    if (status === 'cooldown') {
        return 4;
    }
    if (status === 'not_applied') {
        return 3;
    }
    if (status === 'ignored') {
        return 2;
    }
    if (status === 'applied') {
        return 1;
    }
    return 0;
}

function getRuntimeRunbookRemediationTrendRank(
    trendStatus: RuntimeRunbookRemediationEventTrendStatus | ''
): number {
    if (trendStatus === 'regressing') {
        return 4;
    }
    if (trendStatus === 'stable') {
        return 3;
    }
    if (trendStatus === 'improving') {
        return 2;
    }
    return 1;
}

function resolveRuntimeRunbookVerificationEscalation(
    statusRaw: unknown,
    activeRiskStreakRaw: unknown,
    activeFailStreakRaw: unknown,
    selectedCheckIdRaw: unknown = ''
): RuntimeRunbookVerificationEscalation {
    const status = normalizeRuntimeRunbookVerificationStatusToken(statusRaw);
    const activeRiskStreak = Math.max(0, Math.floor(Number(activeRiskStreakRaw || 0)));
    const activeFailStreak = Math.max(0, Math.floor(Number(activeFailStreakRaw || 0)));
    const selectedCheckId = normalizeRuntimeRunbookCheckIdToken(selectedCheckIdRaw);
    if (
        selectedCheckId === 'query_vector_acceleration_index_sync_health'
        || selectedCheckId === 'query_vector_acceleration_circuit_state'
        || selectedCheckId === 'query_vector_acceleration_calibration_readiness'
        || selectedCheckId === 'query_vector_acceleration_prefilter_effectiveness'
        || selectedCheckId === 'query_vector_acceleration_traceability'
    ) {
        if (status === 'fail' && activeFailStreak >= 1) {
            return 'critical';
        }
        if (
            status === 'fail'
            || activeRiskStreak >= 2
            || (status === 'warn' && activeFailStreak >= 1)
        ) {
            return 'high';
        }
        if (status === 'warn' || activeRiskStreak >= 1) {
            return 'watch';
        }
        return 'normal';
    }
    if (status === 'fail' && activeFailStreak >= 2) {
        return 'critical';
    }
    if (
        status === 'fail'
        || activeRiskStreak >= 3
        || (status === 'warn' && activeFailStreak >= 1)
    ) {
        return 'high';
    }
    if (status === 'warn' || activeRiskStreak >= 1) {
        return 'watch';
    }
    return 'normal';
}

function normalizeRuntimeRunbookVectorAccelerationCircuitBudgetStatus(
    valueRaw: unknown
): RuntimeRunbookVectorAccelerationCircuitBudgetStatus {
    const value = String(valueRaw || '').trim().toLowerCase();
    if (value === 'fail') {
        return 'fail';
    }
    if (value === 'warn') {
        return 'warn';
    }
    return 'ok';
}

function buildRuntimeRunbookVectorAccelerationCircuitBudgetSummary(
    matrixRaw: RuntimeCapabilityMatrix | null | undefined
): RuntimeRunbookVectorAccelerationCircuitBudgetSummary | null {
    if (!matrixRaw || typeof matrixRaw !== 'object') {
        return null;
    }
    const signals = matrixRaw.signals;
    if (!signals || typeof signals !== 'object') {
        return null;
    }
    return {
        checkId: 'query_vector_acceleration_circuit_state',
        mode: signals.queryVectorIndexAccelerationMode,
        healthStatus: signals.queryVectorIndexAccelerationHealthStatus,
        circuitState: signals.queryVectorIndexAccelerationCircuitState,
        lastRequestId: String(signals.queryVectorIndexAccelerationLastRequestId || ''),
        lastErrorCode: String(signals.queryVectorIndexAccelerationLastErrorCode || ''),
        lastRetryAfterMs: Math.max(
            0,
            Math.floor(Number(signals.queryVectorIndexAccelerationLastRetryAfterMs || 0))
        ),
        shortCircuitRatioPct: Number(Number(signals.queryVectorIndexAccelerationShortCircuitRatioPct || 0).toFixed(4)),
        warnBudgetExceeded: Boolean(signals.queryVectorIndexAccelerationCircuitWarnBudgetExceeded),
        failBudgetExceeded: Boolean(signals.queryVectorIndexAccelerationCircuitFailBudgetExceeded),
        budgetStatus: normalizeRuntimeRunbookVectorAccelerationCircuitBudgetStatus(
            signals.queryVectorIndexAccelerationCircuitBudgetStatus
        ),
        budget: {
            warn: {
                shortCircuitCountLt: Number(RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationShortCircuitWarnCount),
                shortCircuitRatioPctLt: Number(RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationShortCircuitWarnRatioPct),
                consecutiveFailuresLt: Number(RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationConsecutiveFailuresWarnCount),
                halfOpenSuccessRatePctGte: Number(RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationHalfOpenSuccessWarnRatioPct),
            },
            fail: {
                shortCircuitCountLt: Number(RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationShortCircuitFailCount),
                shortCircuitRatioPctLt: Number(RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationShortCircuitFailRatioPct),
                consecutiveFailuresLt: Number(RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationConsecutiveFailuresFailCount),
                halfOpenSuccessRatePctGte: Number(RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationHalfOpenSuccessFailRatioPct),
            },
        },
    };
}

function buildRuntimeRunbookVectorAccelerationTraceabilitySummary(
    matrixRaw: RuntimeCapabilityMatrix | null | undefined
): RuntimeRunbookVectorAccelerationTraceabilitySummary | null {
    if (!matrixRaw || typeof matrixRaw !== 'object') {
        return null;
    }
    const signals = matrixRaw.signals;
    if (!signals || typeof signals !== 'object') {
        return null;
    }
    const adapterId = String(signals.queryVectorIndexAccelerationAdapterId || '').trim();
    const externalConnector = adapterId.length > 0 && adapterId.toLowerCase().includes('external');
    const lastRequestId = String(signals.queryVectorIndexAccelerationLastRequestId || '').trim();
    const lastErrorCode = String(signals.queryVectorIndexAccelerationLastErrorCode || '').trim();
    const lastRetryAfterMs = Math.max(
        0,
        Math.floor(Number(signals.queryVectorIndexAccelerationLastRetryAfterMs || 0))
    );
    const hasLastRequestId = lastRequestId.length > 0;
    const hasLastErrorCode = lastErrorCode.length > 0;
    const hasLastRetryAfterMs = lastRetryAfterMs > 0;
    const coverageCount = [hasLastRequestId, hasLastErrorCode, hasLastRetryAfterMs]
        .filter(Boolean)
        .length;
    const correlationCoverage: RuntimeRunbookVectorAccelerationTraceabilityCoverage = coverageCount >= 3
        ? 'full'
        : (coverageCount > 0 ? 'partial' : 'none');
    const missingFields = [
        hasLastRequestId ? '' : 'lastRequestId',
        hasLastErrorCode ? '' : 'lastErrorCode',
        hasLastRetryAfterMs ? '' : 'lastRetryAfterMs',
    ].filter(Boolean);

    return {
        checkId: 'query_vector_acceleration_traceability',
        mode: signals.queryVectorIndexAccelerationMode,
        healthStatus: signals.queryVectorIndexAccelerationHealthStatus,
        circuitState: signals.queryVectorIndexAccelerationCircuitState,
        adapterId,
        externalConnector,
        requestCount: Math.max(0, Math.floor(Number(signals.queryVectorIndexAccelerationRequestCount || 0))),
        consecutiveFailures: Math.max(0, Math.floor(Number(signals.queryVectorIndexAccelerationConsecutiveFailures || 0))),
        shortCircuitCount: Math.max(0, Math.floor(Number(signals.queryVectorIndexAccelerationShortCircuitCount || 0))),
        lastRequestId,
        lastErrorCode,
        lastRetryAfterMs,
        hasCorrelationSignals: coverageCount > 0,
        correlationCoverage,
        missingFields,
    };
}

function buildRuntimeRunbookVectorAccelerationIndexSyncHealthSummary(
    matrixRaw: RuntimeCapabilityMatrix | null | undefined
): RuntimeRunbookVectorAccelerationIndexSyncHealthSummary | null {
    if (!matrixRaw || typeof matrixRaw !== 'object') {
        return null;
    }
    const signals = matrixRaw.signals;
    if (!signals || typeof signals !== 'object') {
        return null;
    }
    const adapterId = String(signals.queryVectorIndexAccelerationAdapterId || '').trim();
    const externalConnector = adapterId.length > 0 && adapterId.toLowerCase().includes('external');
    const syncedIndexSignature = String(signals.queryVectorIndexAccelerationSyncedIndexSignature || '').trim();
    const syncedAtomCount = Math.max(
        0,
        Math.floor(Number(signals.queryVectorIndexAccelerationSyncedAtomCount || 0))
    );
    const syncRequestCount = Math.max(
        0,
        Math.floor(Number(signals.queryVectorIndexAccelerationSyncRequestCount || 0))
    );
    const syncSuccessCount = Math.max(
        0,
        Math.floor(Number(signals.queryVectorIndexAccelerationSyncSuccessCount || 0))
    );
    const syncFailureCount = Math.max(
        0,
        Math.floor(Number(signals.queryVectorIndexAccelerationSyncFailureCount || 0))
    );
    return {
        checkId: 'query_vector_acceleration_index_sync_health',
        mode: signals.queryVectorIndexAccelerationMode,
        healthStatus: signals.queryVectorIndexAccelerationHealthStatus,
        adapterId,
        externalConnector,
        indexSyncStatus: signals.queryVectorIndexAccelerationIndexSyncStatus,
        indexSyncMessage: String(signals.queryVectorIndexAccelerationIndexSyncMessage || '').trim(),
        lastSyncAt: String(signals.queryVectorIndexAccelerationLastSyncAt || '').trim(),
        syncRequestCount,
        syncSuccessCount,
        syncFailureCount,
        syncedIndexSignature,
        syncedAtomCount,
        hasSyncedTelemetry: syncSuccessCount > 0 && syncedAtomCount > 0 && syncedIndexSignature.length > 0,
    };
}

function buildRuntimeRunbookVectorAccelerationPrefilterSummary(
    matrixRaw: RuntimeCapabilityMatrix | null | undefined
): RuntimeRunbookVectorAccelerationPrefilterSummary | null {
    if (!matrixRaw || typeof matrixRaw !== 'object') {
        return null;
    }
    const signals = matrixRaw.signals;
    if (!signals || typeof signals !== 'object') {
        return null;
    }
    const selectionMode = signals.queryVectorIndexAccelerationLastSelectionMode;
    const requestCount = Math.max(0, Math.floor(Number(signals.queryVectorIndexAccelerationRequestCount || 0)));
    const candidateCount = Math.max(0, Math.floor(Number(signals.queryVectorIndexAccelerationLastCandidateCount || 0)));
    const atomCount = Math.max(0, Math.floor(Number(signals.queryVectorIndexAtomCount || 0)));
    const candidateRatioPct = (atomCount > 0 && candidateCount > 0)
        ? Number(((candidateCount / Math.max(1, atomCount)) * 100).toFixed(4))
        : 0;
    const sampleReady = requestCount >= Number(
        RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterMinRequestSample
    );
    const selectionActive = (
        selectionMode === 'token_prefilter'
        || selectionMode === 'token_signature_prefilter'
    );
    const stableConnector = (
        signals.queryVectorIndexAccelerationHealthStatus === 'ready'
        && (
            signals.queryVectorIndexAccelerationCircuitState === 'closed'
            || signals.queryVectorIndexAccelerationCircuitState === 'unknown'
        )
    );
    const fullScanFallback = selectionMode === 'full_scan';
    const canEvaluateCandidateRatio = (
        atomCount > 0
        && candidateCount > 0
        && candidateCount <= atomCount
    );
    const warnBudgetExceeded = (
        sampleReady
        && selectionActive
        && canEvaluateCandidateRatio
        && candidateRatioPct >= Number(
            RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterWarnCandidateRatioPct
        )
    );
    const failBudgetExceeded = (
        sampleReady
        && selectionActive
        && canEvaluateCandidateRatio
        && candidateRatioPct >= Number(
            RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterFailCandidateRatioPct
        )
    );
    const budgetStatus: RuntimeRunbookVectorAccelerationPrefilterBudgetStatus = failBudgetExceeded
        ? 'fail'
        : (warnBudgetExceeded ? 'warn' : 'ok');
    return {
        checkId: 'query_vector_acceleration_prefilter_effectiveness',
        mode: signals.queryVectorIndexAccelerationMode,
        healthStatus: signals.queryVectorIndexAccelerationHealthStatus,
        circuitState: signals.queryVectorIndexAccelerationCircuitState,
        selectionMode,
        requestCount,
        candidateCount,
        atomCount,
        candidateRatioPct,
        sampleReady,
        selectionActive,
        stableConnector,
        fullScanFallback,
        canEvaluateCandidateRatio,
        warnBudgetExceeded,
        failBudgetExceeded,
        budgetStatus,
        budget: {
            minRequestSampleGte: Number(
                RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterMinRequestSample
            ),
            warnCandidateRatioPctLt: Number(
                RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterWarnCandidateRatioPct
            ),
            failCandidateRatioPctLt: Number(
                RUNTIME_CAPABILITY_THRESHOLDS.queryVectorAccelerationPrefilterFailCandidateRatioPct
            ),
        },
    };
}

function buildRuntimeRunbookVectorAccelerationCalibrationReadinessSummary(
    matrixRaw: RuntimeCapabilityMatrix | null | undefined
): RuntimeRunbookVectorAccelerationCalibrationReadinessSummary | null {
    if (!matrixRaw || typeof matrixRaw !== 'object') {
        return null;
    }
    const signals = matrixRaw.signals;
    if (!signals || typeof signals !== 'object') {
        return null;
    }
    const checks = Array.isArray(matrixRaw.checks) ? matrixRaw.checks : [];
    const readinessCheck = checks.find(
        (check) => String(check && check.checkId || '').trim() === 'query_vector_acceleration_calibration_readiness'
    ) || null;
    const adapterId = String(signals.queryVectorIndexAccelerationAdapterId || '').trim();
    const externalConnector = adapterId.length > 0 && adapterId.toLowerCase().includes('external');
    const prefilter = buildRuntimeRunbookVectorAccelerationPrefilterSummary(matrixRaw);
    const circuitBudget = buildRuntimeRunbookVectorAccelerationCircuitBudgetSummary(matrixRaw);
    const traceability = buildRuntimeRunbookVectorAccelerationTraceabilitySummary(matrixRaw);
    const indexSync = buildRuntimeRunbookVectorAccelerationIndexSyncHealthSummary(matrixRaw);
    const syncReady = !externalConnector || Boolean(indexSync && indexSync.hasSyncedTelemetry);
    const traceabilityReady = !externalConnector || Boolean(
        traceability
        && traceability.hasCorrelationSignals
        && traceability.correlationCoverage !== 'none'
    );
    return {
        checkId: 'query_vector_acceleration_calibration_readiness',
        status: normalizeRuntimeRunbookVerificationStatusToken(readinessCheck && readinessCheck.status || 'unknown') || 'unknown',
        mode: signals.queryVectorIndexAccelerationMode,
        externalConnector,
        syncReady,
        sampleReady: Boolean(prefilter && prefilter.sampleReady),
        selectionActive: Boolean(prefilter && prefilter.selectionActive),
        stableConnector: Boolean(prefilter && prefilter.stableConnector),
        canEvaluateCandidateRatio: Boolean(prefilter && prefilter.canEvaluateCandidateRatio),
        traceabilityReady,
        circuitBudgetStatus: circuitBudget
            ? normalizeRuntimeRunbookVectorAccelerationCircuitBudgetStatus(circuitBudget.budgetStatus)
            : 'ok',
        prefilterBudgetStatus: prefilter
            ? prefilter.budgetStatus
            : 'ok',
        observed: String(readinessCheck && readinessCheck.observed || '').trim(),
        expected: String(readinessCheck && readinessCheck.expected || '').trim(),
    };
}

function getRuntimeRunbookVerificationEscalationRank(
    escalation: RuntimeRunbookVerificationEscalation | ''
): number {
    if (escalation === 'critical') {
        return 4;
    }
    if (escalation === 'high') {
        return 3;
    }
    if (escalation === 'watch') {
        return 2;
    }
    return 1;
}

function getRuntimeRunbookEscalationActionPriorityRank(
    priority: RuntimeRunbookEscalationActionPriority
): number {
    if (priority === 'p0') {
        return 1;
    }
    if (priority === 'p1') {
        return 2;
    }
    return 3;
}

const RUNTIME_RUNBOOK_PREFILTER_QUEUE_ACTION_IDS = new Set<string>([
    'inspect_ann_prefilter_selection_telemetry',
    'drive_representative_ann_prefilter_traffic',
    'verify_ann_prefilter_effectiveness_recovery',
]);

const RUNTIME_RUNBOOK_INDEX_SYNC_QUEUE_ACTION_IDS = new Set<string>([
    'inspect_ann_index_sync_telemetry',
    'drive_ann_index_resync',
    'verify_ann_index_sync_recovery',
]);

const RUNTIME_RUNBOOK_TURN_CACHE_ALERT_QUEUE_ACTION_IDS = new Set<string>([
    'inspect_conversation_turn_cache_alert_trend_index',
    'stabilize_conversation_turn_cache_alert_pressure',
    'verify_conversation_turn_cache_alert_trend_recovery',
]);

function getRuntimeRunbookPrefilterQueueRiskBoost(item: RuntimeRunbookCheckActionQueueItem): number {
    const checkId = normalizeRuntimeRunbookCheckIdToken(item?.checkId);
    if (checkId !== 'query_vector_acceleration_prefilter_effectiveness') {
        return 0;
    }
    const actionId = String(item?.actionId || '').trim().toLowerCase();
    if (!RUNTIME_RUNBOOK_PREFILTER_QUEUE_ACTION_IDS.has(actionId)) {
        return 0;
    }
    const latestStatus = normalizeRuntimeRunbookVerificationStatusToken(
        item?.checkLatestStatus
    ) || 'unknown';
    if (latestStatus !== 'warn' && latestStatus !== 'fail') {
        return 0;
    }
    const trendRank = item?.checkTrendStatus === 'regressing'
        ? 4
        : (
            item?.checkTrendStatus === 'stable'
                ? 3
                : (item?.checkTrendStatus === 'improving' ? 2 : 1)
        );
    let boost = latestStatus === 'fail' ? 320 : 220;
    boost += getRuntimeRunbookVerificationEscalationRank(item?.checkLatestEscalation) * 35;
    boost += trendRank * 18;
    if (actionId === 'inspect_ann_prefilter_selection_telemetry') {
        boost += 36;
    } else if (actionId === 'drive_representative_ann_prefilter_traffic') {
        boost += 28;
    } else if (actionId === 'verify_ann_prefilter_effectiveness_recovery') {
        boost += 20;
    }
    return boost;
}

function getRuntimeRunbookIndexSyncQueueRiskBoost(item: RuntimeRunbookCheckActionQueueItem): number {
    const checkId = normalizeRuntimeRunbookCheckIdToken(item?.checkId);
    if (checkId !== 'query_vector_acceleration_index_sync_health') {
        return 0;
    }
    const actionId = String(item?.actionId || '').trim().toLowerCase();
    if (!RUNTIME_RUNBOOK_INDEX_SYNC_QUEUE_ACTION_IDS.has(actionId)) {
        return 0;
    }
    const latestStatus = normalizeRuntimeRunbookVerificationStatusToken(
        item?.checkLatestStatus
    ) || 'unknown';
    if (latestStatus !== 'warn' && latestStatus !== 'fail') {
        return 0;
    }
    let boost = latestStatus === 'fail' ? 300 : 210;
    boost += getRuntimeRunbookVerificationEscalationRank(item?.checkLatestEscalation) * 35;
    if (actionId === 'inspect_ann_index_sync_telemetry') {
        boost += 34;
    } else if (actionId === 'drive_ann_index_resync') {
        boost += 26;
    } else if (actionId === 'verify_ann_index_sync_recovery') {
        boost += 18;
    }
    return boost;
}

function getRuntimeRunbookTurnCacheAlertQueueRiskBoost(item: RuntimeRunbookCheckActionQueueItem): number {
    const checkId = normalizeRuntimeRunbookCheckIdToken(item?.checkId);
    if (checkId !== RUNTIME_RUNBOOK_CHECK_ID_CONVERSATION_TURN_CACHE_ALERT_TREND) {
        return 0;
    }
    const actionId = String(item?.actionId || '').trim().toLowerCase();
    if (!RUNTIME_RUNBOOK_TURN_CACHE_ALERT_QUEUE_ACTION_IDS.has(actionId)) {
        return 0;
    }
    const latestStatus = normalizeRuntimeRunbookVerificationStatusToken(
        item?.checkLatestStatus
    ) || 'unknown';
    if (latestStatus !== 'warn' && latestStatus !== 'fail') {
        return 0;
    }
    const trendRank = item?.checkTrendStatus === 'regressing'
        ? 4
        : (
            item?.checkTrendStatus === 'stable'
                ? 3
                : (item?.checkTrendStatus === 'improving' ? 2 : 1)
        );
    let boost = latestStatus === 'fail' ? 300 : 210;
    boost += getRuntimeRunbookVerificationEscalationRank(item?.checkLatestEscalation) * 32;
    boost += trendRank * 16;
    if (actionId === 'inspect_conversation_turn_cache_alert_trend_index') {
        boost += 32;
    } else if (actionId === 'stabilize_conversation_turn_cache_alert_pressure') {
        boost += 24;
    } else if (actionId === 'verify_conversation_turn_cache_alert_trend_recovery') {
        boost += 18;
    }
    return boost;
}

function normalizeRuntimeRunbookEscalationActionItems(
    itemsRaw: RuntimeRunbookEscalationActionItem[]
): RuntimeRunbookEscalationActionItem[] {
    if (!Array.isArray(itemsRaw)) {
        return [];
    }
    const seen = new Set<string>();
    const normalized: RuntimeRunbookEscalationActionItem[] = [];
    itemsRaw.forEach((item, index) => {
        const actionId = String(item?.actionId || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_:-]+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 64) || `action_${index + 1}`;
        const priorityRaw = String(item?.priority || 'p1').trim().toLowerCase();
        const priority: RuntimeRunbookEscalationActionPriority = (
            priorityRaw === 'p0' || priorityRaw === 'p1' || priorityRaw === 'p2'
        )
            ? priorityRaw
            : 'p1';
        const categoryRaw = String(item?.category || 'governance').trim().toLowerCase();
        const category: RuntimeRunbookEscalationActionCategory = (
            categoryRaw === 'stabilize'
            || categoryRaw === 'governance'
            || categoryRaw === 'trend'
            || categoryRaw === 'routing'
            || categoryRaw === 'evidence'
            || categoryRaw === 'verify'
            || categoryRaw === 'monitor'
        )
            ? categoryRaw
            : 'governance';
        const instruction = String(item?.instruction || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 280);
        if (!instruction) {
            return;
        }
        const endpointHint = String(item?.endpointHint || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160);
        const automationHint = String(item?.automationHint || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_:-]+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 64);
        const dedupeKey = `${actionId}|${instruction.toLowerCase()}`;
        if (seen.has(dedupeKey)) {
            return;
        }
        seen.add(dedupeKey);
        normalized.push({
            actionId,
            priority,
            category,
            instruction,
            endpointHint,
            automationHint,
        });
    });
    return normalized.slice(0, 8);
}

function resolveRuntimeRunbookVerificationEscalationActionItems(input: {
    selectedCheckId: string;
    selectedCheckStatus: RuntimeRunbookVerificationStatus;
    selectedCheckEscalation: RuntimeRunbookVerificationEscalation;
    selectedCheckHistory: {
        returnedRecords: number;
        sinceMinutes: number;
        activeRiskStreak: number;
        activeFailStreak: number;
        trendStatus: RuntimeRunbookVerificationHistoryTrendStatus;
    };
    dynamicModeAlignment: {
        conflictPersistent: boolean;
        conflictStreak: number;
        failStreak: number;
        recommendedFocusCheckId: string;
        recommendedFocusReason: string;
    };
    pathStrategyAlignment: {
        conflictPersistent: boolean;
        conflictStreak: number;
        failStreak: number;
        recommendedFocusCheckId: string;
        recommendedFocusReason: string;
    };
    verificationTargets: string[];
}): RuntimeRunbookEscalationActionItem[] {
    const actions: RuntimeRunbookEscalationActionItem[] = [];
    const addAction = (item: {
        actionId: string;
        priority?: RuntimeRunbookEscalationActionPriority;
        category?: RuntimeRunbookEscalationActionCategory;
        instruction: string;
        endpointHint?: string;
        automationHint?: string;
    }): void => {
        actions.push({
            actionId: item.actionId,
            priority: item.priority || 'p1',
            category: item.category || 'governance',
            instruction: item.instruction,
            endpointHint: String(item.endpointHint || ''),
            automationHint: String(item.automationHint || ''),
        });
    };
    const selectedCheckId = normalizeRuntimeRunbookCheckIdToken(input.selectedCheckId);
    const selectedStatus = normalizeRuntimeRunbookVerificationStatusToken(input.selectedCheckStatus);
    const escalation = String(input.selectedCheckEscalation || 'normal').trim().toLowerCase() as RuntimeRunbookVerificationEscalation;
    const riskStreak = Math.max(0, Math.floor(Number(input.selectedCheckHistory?.activeRiskStreak || 0)));
    const failStreak = Math.max(0, Math.floor(Number(input.selectedCheckHistory?.activeFailStreak || 0)));
    const trendStatus = String(input.selectedCheckHistory?.trendStatus || 'insufficient_data');
    const historySinceMinutes = Math.max(0, Math.floor(Number(input.selectedCheckHistory?.sinceMinutes || 0)));
    const dynamicModeConflictPersistent = Boolean(input.dynamicModeAlignment?.conflictPersistent);
    const dynamicModeConflictStreak = Math.max(0, Math.floor(Number(input.dynamicModeAlignment?.conflictStreak || 0)));
    const pathStrategyConflictPersistent = Boolean(input.pathStrategyAlignment?.conflictPersistent);
    const pathStrategyConflictStreak = Math.max(0, Math.floor(Number(input.pathStrategyAlignment?.conflictStreak || 0)));

    if (escalation === 'critical') {
        addAction({
            actionId: 'mitigate_immediately',
            priority: 'p0',
            category: 'stabilize',
            instruction: 'Trigger immediate mitigation and pause adaptive execution for the affected path until verification returns to warn/pass.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'pause_adaptive_execution',
        });
    } else if (escalation === 'high') {
        addAction({
            actionId: 'prioritize_remediation',
            priority: 'p0',
            category: 'governance',
            instruction: 'Prioritize this check in the next remediation cycle and complete at least one verify iteration immediately after mitigation.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'run_verify_after_mitigation',
        });
    } else if (escalation === 'watch') {
        addAction({
            actionId: 'elevated_monitoring',
            priority: 'p1',
            category: 'monitor',
            instruction: 'Maintain elevated monitoring and re-run verification after the next meaningful configuration or traffic change.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'monitor_then_verify',
        });
    } else {
        addAction({
            actionId: 'standard_verification_cadence',
            priority: 'p2',
            category: 'monitor',
            instruction: 'Continue standard verification cadence and keep this check under periodic governance review.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'periodic_verify',
        });
    }

    if (riskStreak >= 3 || failStreak >= 2) {
        addAction({
            actionId: 'open_governance_incident_note',
            priority: 'p0',
            category: 'governance',
            instruction: `Open a governance incident note: streak risk/fail=${riskStreak}/${failStreak} over last ${historySinceMinutes} minutes.`,
            automationHint: 'create_incident_note',
        });
    } else if (riskStreak >= 1) {
        addAction({
            actionId: 'track_streak_drift',
            priority: 'p1',
            category: 'monitor',
            instruction: `Track streak drift (risk/fail=${riskStreak}/${failStreak}) and verify that it converges in the next window.`,
            automationHint: 'track_streak_drift',
        });
    }

    if (trendStatus === 'regressing') {
        addAction({
            actionId: 'compare_regressing_windows',
            priority: 'p1',
            category: 'trend',
            instruction: 'Trend is regressing; compare the latest two windows and roll back recent risky config changes first.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/history',
            automationHint: 'compare_recent_windows',
        });
    }

    if (selectedCheckId === 'tutor_routing_dynamic_mode_alignment') {
        addAction({
            actionId: 'align_tutor_preferred_mode',
            priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
            category: 'routing',
            instruction: 'Update /api/knowledge/session/orchestration/config so preferredMode aligns with dynamic recommendation (auto/local/cloud).',
            endpointHint: '/api/knowledge/session/orchestration/config',
            automationHint: 'align_preferred_mode',
        });
        addAction({
            actionId: 'verify_tutor_mode_conflict_convergence',
            priority: 'p1',
            category: 'routing',
            instruction: 'Use /api/knowledge/tutor/trace-diagnostics/providers/history?source=llm-adapter to confirm conflict streak is converging.',
            endpointHint: '/api/knowledge/tutor/trace-diagnostics/providers/history',
            automationHint: 'verify_conflict_convergence',
        });
        if (dynamicModeConflictPersistent || dynamicModeConflictStreak >= 2) {
            addAction({
                actionId: 'keep_preferred_mode_auto_during_stabilization',
                priority: 'p0',
                category: 'routing',
                instruction: 'Because dynamic mode conflict persists, keep preferredMode=auto during stabilization and avoid manual mode pinning.',
                endpointHint: '/api/knowledge/session/orchestration/config',
                automationHint: 'pin_auto_mode_temporarily',
            });
        }
    } else if (selectedCheckId === 'orchestration_path_strategy_alignment') {
        addAction({
            actionId: 'review_strategy_alignment_outcomes',
            priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
            category: 'trend',
            instruction: 'Query /api/knowledge/session/history?userId=<userId>&pathStrategySelectionSource=strategy_trend&sinceMinutes=10080 and confirm trend-driven strategy selections recover to non-negative mastery delta.',
            endpointHint: '/api/knowledge/session/history',
            automationHint: 'review_strategy_alignment_outcomes',
        });
        addAction({
            actionId: 'verify_strategy_breakdown_convergence',
            priority: 'p1',
            category: 'verify',
            instruction: 'Query /api/knowledge/quality/trend and verify strategyBreakdown trend agrees with session strategy outcome telemetry.',
            endpointHint: '/api/knowledge/quality/trend',
            automationHint: 'verify_strategy_breakdown_convergence',
        });
        addAction({
            actionId: 'tighten_strategy_auto_path_confidence',
            priority: 'p1',
            category: 'governance',
            instruction: 'If trend-driven outcomes remain negative, raise strategy auto-path confidence threshold via /api/knowledge/session/orchestration/config.',
            endpointHint: '/api/knowledge/session/orchestration/config',
            automationHint: 'tighten_strategy_auto_path_confidence',
        });
        if (pathStrategyConflictPersistent || pathStrategyConflictStreak >= 2) {
            addAction({
                actionId: 'prefer_explicit_path_strategy_during_stabilization',
                priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
                category: 'routing',
                instruction: 'Because path strategy conflict persists, set explicit pathStrategy for high-risk sessions until trend-driven outcomes return to stable or improving.',
                endpointHint: '/api/knowledge/session/execute',
                automationHint: 'prefer_explicit_path_strategy',
            });
        }
    } else if (selectedCheckId === 'query_vector_acceleration_circuit_state') {
        addAction({
            actionId: 'stabilize_vector_acceleration_connector',
            priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
            category: 'stabilize',
            instruction: 'Check acceleration connector availability first and keep circuitState closed|unknown before restoring strict rollout gates.',
            endpointHint: '/api/knowledge/query-backend-diagnostics',
            automationHint: 'stabilize_vector_acceleration_connector',
        });
        addAction({
            actionId: 'tune_vector_acceleration_circuit_budget',
            priority: escalation === 'critical' ? 'p0' : 'p1',
            category: 'governance',
            instruction: 'Tune short-circuit/consecutive-failure/half-open-success thresholds to match workload volatility and avoid repeated circuit churn.',
            endpointHint: '/api/knowledge/runtime-capability-matrix',
            automationHint: 'tune_vector_acceleration_circuit_budget',
        });
        addAction({
            actionId: 'verify_vector_acceleration_circuit_recovery',
            priority: 'p1',
            category: 'verify',
            instruction: 'Run verify again after mitigation and confirm circuit budget status converges to ok with stable shortCircuitRatio and half-open success rate.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'verify_vector_acceleration_circuit_recovery',
        });
    } else if (selectedCheckId === 'query_vector_acceleration_index_sync_health') {
        addAction({
            actionId: 'inspect_ann_index_sync_telemetry',
            priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
            category: 'evidence',
            instruction: 'Inspect ANN sync telemetry (indexSyncStatus/indexSyncMessage/lastSyncAt/syncedIndexSignature/syncedAtomCount) and attach one representative diagnostics snapshot to the remediation note.',
            endpointHint: '/api/knowledge/query-backend-diagnostics',
            automationHint: 'inspect_ann_index_sync_telemetry',
        });
        addAction({
            actionId: 'drive_ann_index_resync',
            priority: escalation === 'critical' ? 'p0' : 'p1',
            category: 'stabilize',
            instruction: 'Issue ingest + local_vector query traffic and confirm the external connector performs a fresh /sync-index cycle before candidate selection.',
            endpointHint: '/api/knowledge/ingest',
            automationHint: 'drive_ann_index_resync',
        });
        addAction({
            actionId: 'verify_ann_index_sync_recovery',
            priority: 'p1',
            category: 'verify',
            instruction: 'Re-run runbook verify and confirm query_vector_acceleration_index_sync_health converges to pass with populated sync counters and synced index metadata.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'verify_ann_index_sync_recovery',
        });
    } else if (selectedCheckId === 'query_vector_acceleration_traceability') {
        addAction({
            actionId: 'collect_vector_acceleration_connector_correlation',
            priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
            category: 'evidence',
            instruction: 'Capture connector correlation snapshots (lastRequestId/lastErrorCode/lastRetryAfterMs) from diagnostics and attach them to the remediation event.',
            endpointHint: '/api/knowledge/query-backend-diagnostics',
            automationHint: 'collect_vector_acceleration_connector_correlation',
        });
        addAction({
            actionId: 'enforce_traceability_in_incident_flow',
            priority: escalation === 'critical' ? 'p0' : 'p1',
            category: 'governance',
            instruction: 'When connector health is degraded or circuit is open, enforce correlation-field capture before closing the incident loop.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/history/checks',
            automationHint: 'enforce_traceability_in_incident_flow',
        });
        addAction({
            actionId: 'verify_vector_acceleration_traceability_recovery',
            priority: 'p1',
            category: 'verify',
            instruction: 'Re-run runbook verify and confirm query_vector_acceleration_traceability converges to pass with non-empty connector correlation fields.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'verify_vector_acceleration_traceability_recovery',
        });
    } else if (selectedCheckId === 'query_vector_acceleration_prefilter_effectiveness') {
        addAction({
            actionId: 'inspect_ann_prefilter_selection_telemetry',
            priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
            category: 'evidence',
            instruction: 'Inspect acceleration.lastSelectionMode and acceleration.lastCandidateCount from diagnostics and attach one representative sample to the remediation note.',
            endpointHint: '/api/knowledge/query-backend-diagnostics',
            automationHint: 'inspect_ann_prefilter_selection_telemetry',
        });
        addAction({
            actionId: 'drive_representative_ann_prefilter_traffic',
            priority: escalation === 'critical' ? 'p0' : 'p1',
            category: 'verify',
            instruction: 'Issue representative local_vector queries and confirm selection mode converges to token_prefilter|token_signature_prefilter with stable candidate telemetry.',
            endpointHint: '/api/knowledge/query',
            automationHint: 'drive_representative_ann_prefilter_traffic',
        });
        addAction({
            actionId: 'verify_ann_prefilter_effectiveness_recovery',
            priority: 'p1',
            category: 'verify',
            instruction: 'Re-run runbook verify and confirm query_vector_acceleration_prefilter_effectiveness converges to pass before tightening ANN rollout gates.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'verify_ann_prefilter_effectiveness_recovery',
        });
    } else if (selectedCheckId === 'query_vector_acceleration_calibration_readiness') {
        addAction({
            actionId: 'inspect_ann_calibration_prerequisites',
            priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
            category: 'evidence',
            instruction: 'Inspect diagnostics for sync telemetry, prefilter sample readiness, connector stability, and correlation-field coverage before changing ANN thresholds.',
            endpointHint: '/api/knowledge/query-backend-diagnostics',
            automationHint: 'inspect_ann_calibration_prerequisites',
        });
        addAction({
            actionId: 'drive_ann_calibration_window',
            priority: escalation === 'critical' ? 'p0' : 'p1',
            category: 'verify',
            instruction: 'Issue ingest plus representative local_vector query traffic until the same runtime window shows sync-ready telemetry, active prefilter selection, evaluable candidate counts, and stable connector state.',
            endpointHint: '/api/knowledge/query',
            automationHint: 'drive_ann_calibration_window',
        });
        addAction({
            actionId: 'verify_ann_calibration_readiness_recovery',
            priority: 'p1',
            category: 'verify',
            instruction: 'Re-run runbook verify and confirm query_vector_acceleration_calibration_readiness converges to pass before tuning release-grade ANN thresholds.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'verify_ann_calibration_readiness_recovery',
        });
    } else if (selectedCheckId === RUNTIME_RUNBOOK_CHECK_ID_CONVERSATION_TURN_CACHE_ALERT_TREND) {
        addAction({
            actionId: 'inspect_conversation_turn_cache_alert_trend_index',
            priority: escalation === 'critical' || escalation === 'high' ? 'p0' : 'p1',
            category: 'trend',
            instruction: 'Inspect persisted trend index and export snapshot first to confirm escalation source, streak behavior, and top alert dimensions.',
            endpointHint: '/api/knowledge/conversation/turn-cache/diagnostics/trend/index',
            automationHint: 'inspect_turn_cache_alert_trend_index',
        });
        addAction({
            actionId: 'stabilize_conversation_turn_cache_alert_pressure',
            priority: escalation === 'critical' ? 'p0' : 'p1',
            category: 'stabilize',
            instruction: 'Inspect /api/knowledge/conversation/turn-cache/diagnostics for utilization/failure/conflict pressure and mitigate root causes before widening thresholds.',
            endpointHint: '/api/knowledge/conversation/turn-cache/diagnostics',
            automationHint: 'stabilize_turn_cache_alert_pressure',
        });
        addAction({
            actionId: 'verify_conversation_turn_cache_alert_trend_recovery',
            priority: 'p1',
            category: 'verify',
            instruction: 'Re-run trend diagnostics and ensure conversation_turn_cache_alert_trend returns to pass with non-regressing trend before closing remediation.',
            endpointHint: '/api/knowledge/conversation/turn-cache/diagnostics/trend',
            automationHint: 'verify_turn_cache_alert_trend_recovery',
        });
    } else if (selectedCheckId.startsWith('api_')) {
        addAction({
            actionId: 'collect_runtime_trace_evidence',
            priority: 'p1',
            category: 'evidence',
            instruction: 'Collect /api/runtime-request-trace evidence with runbook filter and attach requestId samples to the remediation record.',
            endpointHint: '/api/runtime-request-trace',
            automationHint: 'collect_trace_evidence',
        });
    } else if (selectedCheckId.startsWith('query_')) {
        addAction({
            actionId: 'rerun_query_backend_comparison',
            priority: 'p1',
            category: 'verify',
            instruction: 'Re-run /api/knowledge/query/compare-backends and confirm explainability and fallback ratios recover toward threshold.',
            endpointHint: '/api/knowledge/query/compare-backends',
            automationHint: 'rerun_query_backend_comparison',
        });
    } else if (selectedCheckId.startsWith('session_plan_')) {
        addAction({
            actionId: 'rerun_session_plan_quality_trend',
            priority: 'p1',
            category: 'verify',
            instruction: 'Re-run /api/knowledge/session/plan/quality/trend and verify strategy drift is reduced after policy adjustment.',
            endpointHint: '/api/knowledge/session/plan/quality/trend',
            automationHint: 'rerun_session_plan_quality_trend',
        });
    }

    const focusCheckId = normalizeRuntimeRunbookCheckIdToken(
        input.dynamicModeAlignment?.recommendedFocusCheckId
        || input.pathStrategyAlignment?.recommendedFocusCheckId
    );
    const focusReason = String(
        input.dynamicModeAlignment?.recommendedFocusReason
        || input.pathStrategyAlignment?.recommendedFocusReason
        || 'none'
    ).trim();
    if (focusCheckId) {
        addAction({
            actionId: 'align_to_recommended_focus',
            priority: 'p2',
            category: 'governance',
            instruction: `Current focus recommendation is ${focusCheckId} (${focusReason || 'none'}); align remediation order accordingly.`,
            automationHint: 'align_focus_order',
        });
    }

    if (Array.isArray(input.verificationTargets) && input.verificationTargets.length > 0) {
        const firstTarget = String(input.verificationTargets[0] || '').replace(/\s+/g, ' ').trim();
        if (firstTarget) {
            const endpointMatch = firstTarget.match(/\/api\/[A-Za-z0-9/_-]+/);
            addAction({
                actionId: 'execute_primary_verification_target',
                priority: 'p1',
                category: 'verify',
                instruction: `Execute verification target first: ${firstTarget}`,
                endpointHint: endpointMatch ? endpointMatch[0] : '',
                automationHint: 'execute_primary_verification_target',
            });
        }
    }

    if (!selectedStatus || selectedStatus === 'unknown') {
        addAction({
            actionId: 'revalidate_unknown_status',
            priority: 'p1',
            category: 'verify',
            instruction: 'Verification status is unknown; validate telemetry and run verify again before applying irreversible changes.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            automationHint: 'revalidate_unknown_status',
        });
    }

    return normalizeRuntimeRunbookEscalationActionItems(actions);
}

function resolveRuntimeRunbookVerificationEscalationActions(input: Parameters<typeof resolveRuntimeRunbookVerificationEscalationActionItems>[0]): string[] {
    const items = resolveRuntimeRunbookVerificationEscalationActionItems(input);
    return items
        .map((item) => String(item?.instruction || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 8);
}

function buildRuntimeRunbookCheckActionQueue(inputChecks: Array<{
    checkId: string;
    latestStatus: RuntimeRunbookVerificationStatus;
    latestEscalation: RuntimeRunbookVerificationEscalation;
    trendStatus: RuntimeRunbookVerificationHistoryTrendStatus;
    remediation?: {
        latestStatus: RuntimeRunbookRemediationEventStatus | '';
        trendStatus: RuntimeRunbookRemediationEventTrendStatus | '';
        activeRiskStreak: number;
        riskRatioPct: number;
    };
    escalationActionItems: RuntimeRunbookEscalationActionItem[];
}>): RuntimeRunbookCheckActionQueueItem[] {
    const queue: RuntimeRunbookCheckActionQueueItem[] = [];
    const appendQueueItem = (item: RuntimeRunbookCheckActionQueueItem): void => {
        queue.push(item);
    };
    inputChecks.forEach((check, checkIndex) => {
        const checkId = normalizeRuntimeRunbookCheckIdToken(check?.checkId);
        if (!checkId) {
            return;
        }
        const latestStatus = normalizeRuntimeRunbookVerificationStatusToken(check?.latestStatus) || 'unknown';
        const latestEscalationRaw = String(check?.latestEscalation || 'normal').trim().toLowerCase();
        const latestEscalation: RuntimeRunbookVerificationEscalation = (
            latestEscalationRaw === 'watch'
            || latestEscalationRaw === 'high'
            || latestEscalationRaw === 'critical'
        )
            ? latestEscalationRaw
            : 'normal';
        const trendStatusRaw = String(check?.trendStatus || 'insufficient_data').trim().toLowerCase();
        const trendStatus: RuntimeRunbookVerificationHistoryTrendStatus = (
            trendStatusRaw === 'improving'
            || trendStatusRaw === 'stable'
            || trendStatusRaw === 'regressing'
        )
            ? trendStatusRaw
            : 'insufficient_data';
        const remediationLatestStatus = normalizeRuntimeRunbookRemediationEventStatusQueryToken(
            check?.remediation?.latestStatus
        );
        const remediationTrendStatusRaw = String(check?.remediation?.trendStatus || '')
            .trim()
            .toLowerCase();
        const remediationTrendStatus: RuntimeRunbookRemediationEventTrendStatus | '' = (
            remediationTrendStatusRaw === 'improving'
            || remediationTrendStatusRaw === 'stable'
            || remediationTrendStatusRaw === 'regressing'
            || remediationTrendStatusRaw === 'insufficient_data'
        )
            ? remediationTrendStatusRaw
            : '';
        const remediationActiveRiskStreak = Math.max(
            0,
            Math.floor(Number(check?.remediation?.activeRiskStreak || 0))
        );
        const remediationRiskRatioPct = Number(
            Number(check?.remediation?.riskRatioPct || 0).toFixed(4)
        );
        const actionItems = normalizeRuntimeRunbookEscalationActionItems(
            Array.isArray(check?.escalationActionItems) ? check.escalationActionItems : []
        ).slice(0, 3);
        actionItems.forEach((actionItem, actionIndex) => {
            const queueId = `${checkId}:${actionItem.actionId}:${checkIndex + 1}:${actionIndex + 1}`
                .replace(/[^a-z0-9_:-]+/g, '_')
                .replace(/_{2,}/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 96);
            appendQueueItem({
                queueId: queueId || `queue_${checkIndex + 1}_${actionIndex + 1}`,
                checkId,
                checkLatestStatus: latestStatus,
                checkLatestEscalation: latestEscalation,
                checkTrendStatus: trendStatus,
                remediationLatestStatus,
                remediationTrendStatus,
                remediationActiveRiskStreak,
                remediationRiskRatioPct,
                actionId: actionItem.actionId,
                priority: actionItem.priority,
                category: actionItem.category,
                instruction: actionItem.instruction,
                endpointHint: actionItem.endpointHint,
                automationHint: actionItem.automationHint,
            });
        });
    });
    queue.sort((left, right) => {
        const priorityDiff = getRuntimeRunbookEscalationActionPriorityRank(left.priority)
            - getRuntimeRunbookEscalationActionPriorityRank(right.priority);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }
        const prefilterRiskBoostDiff = getRuntimeRunbookPrefilterQueueRiskBoost(right)
            - getRuntimeRunbookPrefilterQueueRiskBoost(left);
        if (prefilterRiskBoostDiff !== 0) {
            return prefilterRiskBoostDiff;
        }
        const indexSyncRiskBoostDiff = getRuntimeRunbookIndexSyncQueueRiskBoost(right)
            - getRuntimeRunbookIndexSyncQueueRiskBoost(left);
        if (indexSyncRiskBoostDiff !== 0) {
            return indexSyncRiskBoostDiff;
        }
        const turnCacheAlertRiskBoostDiff = getRuntimeRunbookTurnCacheAlertQueueRiskBoost(right)
            - getRuntimeRunbookTurnCacheAlertQueueRiskBoost(left);
        if (turnCacheAlertRiskBoostDiff !== 0) {
            return turnCacheAlertRiskBoostDiff;
        }
        const remediationRiskScore = (item: RuntimeRunbookCheckActionQueueItem): number => (
            (getRuntimeRunbookRemediationEventStatusRank(item.remediationLatestStatus) * 100)
            + (getRuntimeRunbookRemediationTrendRank(item.remediationTrendStatus) * 25)
            + (Math.max(0, Math.min(12, Number(item.remediationActiveRiskStreak || 0))) * 6)
            + (Math.max(0, Math.min(100, Number(item.remediationRiskRatioPct || 0))) / 2)
        );
        const remediationScoreDiff = remediationRiskScore(right) - remediationRiskScore(left);
        if (remediationScoreDiff !== 0) {
            return remediationScoreDiff;
        }
        const escalationDiff = getRuntimeRunbookVerificationEscalationRank(right.checkLatestEscalation)
            - getRuntimeRunbookVerificationEscalationRank(left.checkLatestEscalation);
        if (escalationDiff !== 0) {
            return escalationDiff;
        }
        const trendDiff = (
            (left.checkTrendStatus === 'regressing' ? 4 : left.checkTrendStatus === 'stable' ? 3 : left.checkTrendStatus === 'improving' ? 2 : 1)
            - (right.checkTrendStatus === 'regressing' ? 4 : right.checkTrendStatus === 'stable' ? 3 : right.checkTrendStatus === 'improving' ? 2 : 1)
        );
        if (trendDiff !== 0) {
            return -trendDiff;
        }
        const statusDiff = getRuntimeRunbookVerificationStatusSeverity(right.checkLatestStatus)
            - getRuntimeRunbookVerificationStatusSeverity(left.checkLatestStatus);
        if (statusDiff !== 0) {
            return statusDiff;
        }
        const checkIdDiff = left.checkId.localeCompare(right.checkId);
        if (checkIdDiff !== 0) {
            return checkIdDiff;
        }
        return left.actionId.localeCompare(right.actionId);
    });
    const seen = new Set<string>();
    const dedupedQueue: RuntimeRunbookCheckActionQueueItem[] = [];
    queue.forEach((item) => {
        const dedupeKey = [
            item.checkId,
            item.actionId,
            item.priority,
            item.category,
            String(item.instruction || '').toLowerCase(),
        ].join('|');
        if (seen.has(dedupeKey)) {
            return;
        }
        seen.add(dedupeKey);
        dedupedQueue.push(item);
    });
    return dedupedQueue.slice(0, 24);
}

function computeRuntimeRunbookVerificationHistoryTrend(records: RuntimeRunbookVerificationHistoryRecord[]): {
    trendStatus: RuntimeRunbookVerificationHistoryTrendStatus;
    trendWindowSize: number;
    recentAverageSeverity: number;
    previousAverageSeverity: number;
    severityDelta: number;
    recentAverageErrorRatioPct: number;
    previousAverageErrorRatioPct: number;
    errorRatioDeltaPct: number;
    recentAverageP95DurationMs: number;
    previousAverageP95DurationMs: number;
    p95DurationDeltaMs: number;
} {
    if (records.length < 4) {
        return {
            trendStatus: 'insufficient_data',
            trendWindowSize: 0,
            recentAverageSeverity: 0,
            previousAverageSeverity: 0,
            severityDelta: 0,
            recentAverageErrorRatioPct: 0,
            previousAverageErrorRatioPct: 0,
            errorRatioDeltaPct: 0,
            recentAverageP95DurationMs: 0,
            previousAverageP95DurationMs: 0,
            p95DurationDeltaMs: 0,
        };
    }
    const trendWindowSize = Math.max(2, Math.floor(records.length / 2));
    const recentWindow = records.slice(0, trendWindowSize);
    const previousWindow = records.slice(trendWindowSize, trendWindowSize * 2);
    if (recentWindow.length < 2 || previousWindow.length < 2) {
        return {
            trendStatus: 'insufficient_data',
            trendWindowSize: 0,
            recentAverageSeverity: 0,
            previousAverageSeverity: 0,
            severityDelta: 0,
            recentAverageErrorRatioPct: 0,
            previousAverageErrorRatioPct: 0,
            errorRatioDeltaPct: 0,
            recentAverageP95DurationMs: 0,
            previousAverageP95DurationMs: 0,
            p95DurationDeltaMs: 0,
        };
    }

    const avgSeverity = (items: RuntimeRunbookVerificationHistoryRecord[]) => Number((
        items.reduce((sum, record) => (
            sum + getRuntimeRunbookVerificationStatusSeverity(record.status)
        ), 0) / items.length
    ).toFixed(4));
    const avgErrorRatioPct = (items: RuntimeRunbookVerificationHistoryRecord[]) => Number((
        items.reduce((sum, record) => (
            sum + Number(record?.traceSummary?.errorRatioPct || 0)
        ), 0) / items.length
    ).toFixed(4));
    const avgP95DurationMs = (items: RuntimeRunbookVerificationHistoryRecord[]) => Number((
        items.reduce((sum, record) => (
            sum + Number(record?.traceSummary?.p95DurationMs || 0)
        ), 0) / items.length
    ).toFixed(4));

    const recentAverageSeverity = avgSeverity(recentWindow);
    const previousAverageSeverity = avgSeverity(previousWindow);
    const severityDelta = Number((recentAverageSeverity - previousAverageSeverity).toFixed(4));
    const recentAverageErrorRatioPct = avgErrorRatioPct(recentWindow);
    const previousAverageErrorRatioPct = avgErrorRatioPct(previousWindow);
    const errorRatioDeltaPct = Number((recentAverageErrorRatioPct - previousAverageErrorRatioPct).toFixed(4));
    const recentAverageP95DurationMs = avgP95DurationMs(recentWindow);
    const previousAverageP95DurationMs = avgP95DurationMs(previousWindow);
    const p95DurationDeltaMs = Number((recentAverageP95DurationMs - previousAverageP95DurationMs).toFixed(4));

    let trendStatus: RuntimeRunbookVerificationHistoryTrendStatus = 'stable';
    if (severityDelta <= -0.1) {
        trendStatus = 'improving';
    } else if (severityDelta >= 0.1) {
        trendStatus = 'regressing';
    } else if (errorRatioDeltaPct <= -2 || p95DurationDeltaMs <= -50) {
        trendStatus = 'improving';
    } else if (errorRatioDeltaPct >= 2 || p95DurationDeltaMs >= 50) {
        trendStatus = 'regressing';
    }

    return {
        trendStatus,
        trendWindowSize,
        recentAverageSeverity,
        previousAverageSeverity,
        severityDelta,
        recentAverageErrorRatioPct,
        previousAverageErrorRatioPct,
        errorRatioDeltaPct,
        recentAverageP95DurationMs,
        previousAverageP95DurationMs,
        p95DurationDeltaMs,
    };
}

function computeRuntimeRunbookRemediationEventTrend(
    records: RuntimeRunbookRemediationEventRecord[]
): {
    trendStatus: RuntimeRunbookRemediationEventTrendStatus;
    trendWindowSize: number;
    recentAverageSeverity: number;
    previousAverageSeverity: number;
    severityDelta: number;
    recentAppliedRatioPct: number;
    previousAppliedRatioPct: number;
    appliedRatioDeltaPct: number;
    recentErrorRatioPct: number;
    previousErrorRatioPct: number;
    errorRatioDeltaPct: number;
    recentCooldownRatioPct: number;
    previousCooldownRatioPct: number;
    cooldownRatioDeltaPct: number;
} {
    if (records.length < 4) {
        return {
            trendStatus: 'insufficient_data',
            trendWindowSize: 0,
            recentAverageSeverity: 0,
            previousAverageSeverity: 0,
            severityDelta: 0,
            recentAppliedRatioPct: 0,
            previousAppliedRatioPct: 0,
            appliedRatioDeltaPct: 0,
            recentErrorRatioPct: 0,
            previousErrorRatioPct: 0,
            errorRatioDeltaPct: 0,
            recentCooldownRatioPct: 0,
            previousCooldownRatioPct: 0,
            cooldownRatioDeltaPct: 0,
        };
    }
    const trendWindowSize = Math.max(2, Math.floor(records.length / 2));
    const recentWindow = records.slice(0, trendWindowSize);
    const previousWindow = records.slice(trendWindowSize, trendWindowSize * 2);
    if (recentWindow.length < 2 || previousWindow.length < 2) {
        return {
            trendStatus: 'insufficient_data',
            trendWindowSize: 0,
            recentAverageSeverity: 0,
            previousAverageSeverity: 0,
            severityDelta: 0,
            recentAppliedRatioPct: 0,
            previousAppliedRatioPct: 0,
            appliedRatioDeltaPct: 0,
            recentErrorRatioPct: 0,
            previousErrorRatioPct: 0,
            errorRatioDeltaPct: 0,
            recentCooldownRatioPct: 0,
            previousCooldownRatioPct: 0,
            cooldownRatioDeltaPct: 0,
        };
    }
    const avgSeverity = (items: RuntimeRunbookRemediationEventRecord[]) => Number((
        items.reduce((sum, record) => (
            sum + getRuntimeRunbookRemediationEventSeverity(record.status)
        ), 0) / items.length
    ).toFixed(4));
    const ratioByStatus = (
        items: RuntimeRunbookRemediationEventRecord[],
        status: RuntimeRunbookRemediationEventStatus
    ): number => {
        if (items.length <= 0) {
            return 0;
        }
        const matched = items.reduce((count, record) => (
            record.status === status ? count + 1 : count
        ), 0);
        return Number(((matched / items.length) * 100).toFixed(4));
    };

    const recentAverageSeverity = avgSeverity(recentWindow);
    const previousAverageSeverity = avgSeverity(previousWindow);
    const severityDelta = Number((recentAverageSeverity - previousAverageSeverity).toFixed(4));
    const recentAppliedRatioPct = ratioByStatus(recentWindow, 'applied');
    const previousAppliedRatioPct = ratioByStatus(previousWindow, 'applied');
    const appliedRatioDeltaPct = Number((recentAppliedRatioPct - previousAppliedRatioPct).toFixed(4));
    const recentErrorRatioPct = ratioByStatus(recentWindow, 'error');
    const previousErrorRatioPct = ratioByStatus(previousWindow, 'error');
    const errorRatioDeltaPct = Number((recentErrorRatioPct - previousErrorRatioPct).toFixed(4));
    const recentCooldownRatioPct = ratioByStatus(recentWindow, 'cooldown');
    const previousCooldownRatioPct = ratioByStatus(previousWindow, 'cooldown');
    const cooldownRatioDeltaPct = Number((recentCooldownRatioPct - previousCooldownRatioPct).toFixed(4));

    let trendStatus: RuntimeRunbookRemediationEventTrendStatus = 'stable';
    if (severityDelta <= -0.15 || appliedRatioDeltaPct >= 15) {
        trendStatus = 'improving';
    } else if (severityDelta >= 0.15) {
        trendStatus = 'regressing';
    } else if (errorRatioDeltaPct >= 10 || cooldownRatioDeltaPct >= 10) {
        trendStatus = 'regressing';
    } else if (errorRatioDeltaPct <= -10 && cooldownRatioDeltaPct <= -10) {
        trendStatus = 'improving';
    }

    return {
        trendStatus,
        trendWindowSize,
        recentAverageSeverity,
        previousAverageSeverity,
        severityDelta,
        recentAppliedRatioPct,
        previousAppliedRatioPct,
        appliedRatioDeltaPct,
        recentErrorRatioPct,
        previousErrorRatioPct,
        errorRatioDeltaPct,
        recentCooldownRatioPct,
        previousCooldownRatioPct,
        cooldownRatioDeltaPct,
    };
}

function appendRuntimeRunbookVerificationHistoryRecord(
    record: RuntimeRunbookVerificationHistoryRecord
): void {
    runtimeRunbookVerificationHistoryRecords.unshift(record);
    if (runtimeRunbookVerificationHistoryRecords.length > RUNTIME_RUNBOOK_VERIFICATION_HISTORY_MAX_RECORDS) {
        runtimeRunbookVerificationHistoryRecords.length = RUNTIME_RUNBOOK_VERIFICATION_HISTORY_MAX_RECORDS;
    }
}

function appendRuntimeRunbookRemediationEventRecord(
    record: RuntimeRunbookRemediationEventRecord
): void {
    runtimeRunbookRemediationEventRecords.unshift(record);
    if (runtimeRunbookRemediationEventRecords.length > RUNTIME_RUNBOOK_REMEDIATION_EVENT_MAX_RECORDS) {
        runtimeRunbookRemediationEventRecords.length = RUNTIME_RUNBOOK_REMEDIATION_EVENT_MAX_RECORDS;
    }
}

function filterRuntimeRunbookVerificationHistoryRecords(options: {
    checkId?: string;
    sinceMinutes: number;
    status: RuntimeRunbookVerificationStatus | '';
    checkQuery?: string;
}): RuntimeRunbookVerificationHistoryRecord[] {
    const normalizedCheckId = normalizeRuntimeRunbookCheckIdToken(options.checkId || '');
    const normalizedCheckQuery = normalizeRuntimeRunbookVerificationHistoryCheckQueryToken(options.checkQuery || '');
    const nowMs = Date.now();
    const cutoffMs = options.sinceMinutes > 0
        ? nowMs - (options.sinceMinutes * 60 * 1000)
        : 0;
    return runtimeRunbookVerificationHistoryRecords.filter((record) => {
        const recordCheckId = normalizeRuntimeRunbookCheckIdToken(record.checkId);
        if (normalizedCheckId && recordCheckId !== normalizedCheckId) {
            return false;
        }
        if (normalizedCheckQuery && !recordCheckId.includes(normalizedCheckQuery)) {
            return false;
        }
        if (options.status && record.status !== options.status) {
            return false;
        }
        if (cutoffMs > 0) {
            const verifiedAtMs = Date.parse(String(record.verifiedAt || ''));
            if (!Number.isFinite(verifiedAtMs) || verifiedAtMs < cutoffMs) {
                return false;
            }
        }
        return true;
    });
}

function filterRuntimeRunbookRemediationEventRecords(
    options: RuntimeRunbookRemediationEventQueryOptions
): RuntimeRunbookRemediationEventRecord[] {
    const nowMs = Date.now();
    const cutoffMs = options.sinceMinutes > 0
        ? nowMs - (options.sinceMinutes * 60 * 1000)
        : 0;
    return runtimeRunbookRemediationEventRecords.filter((record) => {
        if (options.status && record.status !== options.status) {
            return false;
        }
        if (options.checkId) {
            const recordCheckId = normalizeRuntimeRunbookCheckIdToken(record.checkId);
            if (recordCheckId !== options.checkId) {
                return false;
            }
        }
        if (options.source) {
            const recordSource = normalizeRuntimeRunbookRemediationEventSourceToken(record.source);
            if (recordSource !== options.source) {
                return false;
            }
        }
        if (cutoffMs > 0) {
            const recordedAtMs = Date.parse(String(record.recordedAt || ''));
            if (!Number.isFinite(recordedAtMs) || recordedAtMs < cutoffMs) {
                return false;
            }
        }
        return true;
    });
}

function normalizeRuntimeRunbookVerificationHistoryQueryOptions(
    query: URLSearchParams | null | undefined
): RuntimeRunbookVerificationHistoryQueryOptions {
    return {
        limit: parseRuntimeRunbookVerificationHistoryLimit(query?.get('limit')),
        checkId: normalizeRuntimeRunbookCheckIdToken(query?.get('checkId')),
        sinceMinutes: parseRuntimeRunbookVerificationHistorySinceMinutes(query?.get('sinceMinutes')),
        status: normalizeRuntimeRunbookVerificationStatusToken(query?.get('status')),
    };
}

function normalizeRuntimeRunbookVerificationHistoryByCheckQueryOptions(
    query: URLSearchParams | null | undefined
): RuntimeRunbookVerificationHistoryByCheckQueryOptions {
    return {
        limit: parseRuntimeRunbookVerificationHistoryByCheckLimit(query?.get('limit')),
        sinceMinutes: parseRuntimeRunbookVerificationHistorySinceMinutes(query?.get('sinceMinutes')),
        status: normalizeRuntimeRunbookVerificationStatusToken(query?.get('status')),
        checkQuery: normalizeRuntimeRunbookVerificationHistoryCheckQueryToken(query?.get('checkQuery')),
    };
}

function normalizeRuntimeRunbookVerificationActionQueueQueryOptions(
    query: URLSearchParams | null | undefined
): RuntimeRunbookVerificationActionQueueQueryOptions {
    return {
        checksQuery: normalizeRuntimeRunbookVerificationHistoryByCheckQueryOptions(query),
        queueLimit: parseRuntimeRunbookVerificationActionQueueLimit(query?.get('queueLimit')),
        priorityFilter: normalizeRuntimeRunbookVerificationActionQueuePriorityFilterToken(
            query?.get('priority')
        ),
        categoryFilter: normalizeRuntimeRunbookVerificationActionQueueCategoryFilterToken(
            query?.get('category')
        ),
        checkIdFilter: normalizeRuntimeRunbookCheckIdToken(query?.get('checkId')),
        remediationStatusFilter: normalizeRuntimeRunbookVerificationActionQueueRemediationStatusFilterToken(
            query?.get('remediationStatus')
        ),
        remediationTrendFilter: normalizeRuntimeRunbookVerificationActionQueueRemediationTrendFilterToken(
            query?.get('remediationTrend')
        ),
    };
}

function createRuntimeRunbookRemediationStatusCounts(): Record<RuntimeRunbookRemediationEventStatus, number> {
    return {
        applied: 0,
        not_applied: 0,
        cooldown: 0,
        error: 0,
        ignored: 0,
    };
}

function queryRuntimeRunbookRemediationEventHistory(
    options: RuntimeRunbookRemediationEventQueryOptions
): {
    summary: {
        totalRecords: number;
        matchedRecords: number;
        returnedRecords: number;
        sinceMinutes: number;
        status: RuntimeRunbookRemediationEventStatus | '';
        checkId: string;
        source: string;
        lastRecordedAt: string;
        statusCounts: Record<RuntimeRunbookRemediationEventStatus, number>;
    };
    records: RuntimeRunbookRemediationEventRecord[];
} {
    const filtered = filterRuntimeRunbookRemediationEventRecords(options);
    const matchedRecords = filtered.length;
    const records = filtered.slice(0, options.limit);
    const statusCounts = records.reduce((summary, record) => {
        summary[record.status] += 1;
        return summary;
    }, createRuntimeRunbookRemediationStatusCounts());
    return {
        summary: {
            totalRecords: runtimeRunbookRemediationEventRecords.length,
            matchedRecords,
            returnedRecords: records.length,
            sinceMinutes: options.sinceMinutes,
            status: options.status,
            checkId: options.checkId,
            source: options.source,
            lastRecordedAt: String(records[0]?.recordedAt || ''),
            statusCounts,
        },
        records,
    };
}

function queryRuntimeRunbookRemediationEventCheckSummary(input: {
    checkId: string;
    sinceMinutes: number;
    source: string;
    limit: number;
}): RuntimeRunbookRemediationCheckSummary {
    const checkId = normalizeRuntimeRunbookCheckIdToken(input.checkId);
    const sinceMinutes = parseRuntimeRunbookVerificationHistorySinceMinutes(input.sinceMinutes);
    const source = normalizeRuntimeRunbookRemediationEventSourceToken(input.source);
    if (!checkId) {
        return {
            checkId: '',
            sinceMinutes,
            source,
            totalRecords: runtimeRunbookRemediationEventRecords.length,
            matchedRecords: 0,
            returnedRecords: 0,
            latestRecordedAt: '',
            latestStatus: '',
            latestApplied: false,
            statusCounts: createRuntimeRunbookRemediationStatusCounts(),
            appliedRatioPct: 0,
            cooldownRatioPct: 0,
            errorRatioPct: 0,
            riskRatioPct: 0,
            activeRiskStreak: 0,
            activeCooldownStreak: 0,
            activeErrorStreak: 0,
            activeAppliedStreak: 0,
            trendStatus: 'insufficient_data',
            trendWindowSize: 0,
            recentAverageSeverity: 0,
            previousAverageSeverity: 0,
            severityDelta: 0,
        };
    }

    const result = queryRuntimeRunbookRemediationEventHistory({
        limit: parseRuntimeRunbookRemediationEventLimit(input.limit),
        sinceMinutes,
        status: '',
        checkId,
        source,
    });
    const records = Array.isArray(result.records)
        ? result.records
        : [];
    const statusCounts = records.reduce((summary, record) => {
        summary[record.status] += 1;
        return summary;
    }, createRuntimeRunbookRemediationStatusCounts());
    const returnedRecords = records.length;
    const ratio = (countRaw: unknown): number => {
        if (returnedRecords <= 0) {
            return 0;
        }
        return Number(((Number(countRaw || 0) / returnedRecords) * 100).toFixed(4));
    };
    const trend = computeRuntimeRunbookRemediationEventTrend(records);
    return {
        checkId,
        sinceMinutes,
        source,
        totalRecords: Math.max(0, Math.floor(Number(result.summary?.totalRecords || 0))),
        matchedRecords: Math.max(0, Math.floor(Number(result.summary?.matchedRecords || 0))),
        returnedRecords,
        latestRecordedAt: String(records[0]?.recordedAt || ''),
        latestStatus: records[0]?.status || '',
        latestApplied: Boolean(records[0]?.applied),
        statusCounts,
        appliedRatioPct: ratio(statusCounts.applied),
        cooldownRatioPct: ratio(statusCounts.cooldown),
        errorRatioPct: ratio(statusCounts.error),
        riskRatioPct: ratio(
            Number(statusCounts.not_applied || 0)
            + Number(statusCounts.cooldown || 0)
            + Number(statusCounts.error || 0)
        ),
        activeRiskStreak: computeRuntimeRunbookRemediationEventStatusStreak(
            records,
            isRuntimeRunbookRemediationRiskStatus
        ),
        activeCooldownStreak: computeRuntimeRunbookRemediationEventStatusStreak(
            records,
            (status) => status === 'cooldown'
        ),
        activeErrorStreak: computeRuntimeRunbookRemediationEventStatusStreak(
            records,
            (status) => status === 'error'
        ),
        activeAppliedStreak: computeRuntimeRunbookRemediationEventStatusStreak(
            records,
            (status) => status === 'applied'
        ),
        trendStatus: trend.trendStatus,
        trendWindowSize: trend.trendWindowSize,
        recentAverageSeverity: trend.recentAverageSeverity,
        previousAverageSeverity: trend.previousAverageSeverity,
        severityDelta: trend.severityDelta,
    };
}

async function replayRuntimeRunbookVerificationForCheck(input: {
    checkId: string;
    sinceMinutes: number;
    traceLimit: number;
}): Promise<{
    replayedAt: string;
    requestedCheckId: string;
    resolvedCheckId: string;
    selectedCheckStatus: RuntimeRunbookVerificationStatus;
    selectedCheckEscalation: RuntimeRunbookVerificationEscalation;
    selectedCheckPriorityScore: number;
    selectedCheckMessage: string;
    topRiskCheckId: string;
    topRiskStatus: RuntimeRunbookTopRiskStatus;
    selectionSource: string;
    selectedCheckHistory: {
        activeRiskStreak: number;
        activeFailStreak: number;
        trendStatus: RuntimeRunbookVerificationHistoryTrendStatus;
    };
    selectedCheckRemediation: {
        latestStatus: RuntimeRunbookRemediationEventStatus | '';
        trendStatus: RuntimeRunbookRemediationEventTrendStatus;
        riskRatioPct: number;
    };
    queryVectorAccelerationCircuitBudget: RuntimeRunbookVectorAccelerationCircuitBudgetSummary | null;
    queryVectorAccelerationIndexSyncHealth: RuntimeRunbookVectorAccelerationIndexSyncHealthSummary | null;
    queryVectorAccelerationTraceability: RuntimeRunbookVectorAccelerationTraceabilitySummary | null;
    queryVectorAccelerationPrefilter: RuntimeRunbookVectorAccelerationPrefilterSummary | null;
    queryVectorAccelerationCalibrationReadiness: RuntimeRunbookVectorAccelerationCalibrationReadinessSummary | null;
    verificationTargets: string[];
    traceSummary: {
        returnedRecords: number;
        errorRequests: number;
        errorRatioPct: number;
        averageDurationMs: number;
        p95DurationMs: number;
        pathPrefix: string;
        statusAtLeast: number;
        method: string;
        errorCode: string;
    };
} | null> {
    const requestedCheckId = normalizeRuntimeRunbookCheckIdToken(input.checkId);
    if (!requestedCheckId) {
        return null;
    }
    const generatedAt = new Date().toISOString();
    const runtimePayload = await buildKnowledgeRuntimePayload(generatedAt);
    const runbook = buildRuntimeCapabilityRunbook(
        runtimePayload.runtimeCapabilityMatrix,
        requestedCheckId
    );
    const resolvedCheckId = normalizeRuntimeRunbookCheckIdToken(
        runbook.selectedCheck?.checkId || requestedCheckId
    );
    if (!resolvedCheckId) {
        return null;
    }
    const traceFilter = runbook.traceFilter || {
        pathPrefix: '/api/knowledge',
        statusAtLeast: 0,
        method: '',
        errorCode: '',
    };
    const traceSummary = queryRuntimeApiRequestTrace({
        limit: parseRuntimeRequestTraceLimit(input.traceLimit),
        pathPrefix: String(traceFilter.pathPrefix || '').trim().slice(0, 128),
        statusAtLeast: parseRuntimeRequestTraceStatusAtLeast(traceFilter.statusAtLeast),
        method: (/^[A-Z]+$/).test(String(traceFilter.method || '').trim().toUpperCase())
            ? String(traceFilter.method || '').trim().toUpperCase()
            : '',
        errorCode: normalizeApiErrorCodeToken(traceFilter.errorCode, ''),
        requestId: '',
    }).summary;
    const selectedCheckStatusRaw = String(runbook.selectedCheck?.status || '').trim().toLowerCase();
    const selectedCheckStatus: RuntimeRunbookVerificationStatus = (
        selectedCheckStatusRaw === 'pass'
        || selectedCheckStatusRaw === 'warn'
        || selectedCheckStatusRaw === 'fail'
    )
        ? selectedCheckStatusRaw
        : 'unknown';
    const topRiskStatusRaw = String(runbook.topRiskCheck?.status || '').trim().toLowerCase();
    const topRiskStatus: RuntimeRunbookTopRiskStatus = (
        topRiskStatusRaw === 'pass'
        || topRiskStatusRaw === 'warn'
        || topRiskStatusRaw === 'fail'
    )
        ? topRiskStatusRaw
        : 'none';
    appendRuntimeRunbookVerificationHistoryRecord({
        verifiedAt: generatedAt,
        checkId: resolvedCheckId,
        status: selectedCheckStatus,
        priorityScore: Math.max(0, Math.floor(Number(runbook.selectedCheck?.priorityScore || 0))),
        topRiskCheckId: normalizeRuntimeRunbookCheckIdToken(runbook.topRiskCheck?.checkId || ''),
        topRiskStatus,
        selectionSource: String(runbook.selectionSource || 'none').trim().slice(0, 64),
        traceSummary: {
            returnedRecords: Math.max(0, Math.floor(Number(traceSummary.returnedRecords || 0))),
            errorRequests: Math.max(0, Math.floor(Number(traceSummary.errorRequests || 0))),
            errorRatioPct: Number(Number(traceSummary.errorRatioPct || 0).toFixed(4)),
            transientReturnedRatioPct: Number(Number(traceSummary.transientReturnedRatioPct || 0).toFixed(4)),
            averageDurationMs: Number(Number(traceSummary.averageDurationMs || 0).toFixed(4)),
            p95DurationMs: Number(Number(traceSummary.p95DurationMs || 0).toFixed(4)),
            pathPrefix: String(traceSummary.pathPrefix || '').trim().slice(0, 128),
            statusAtLeast: parseRuntimeRequestTraceStatusAtLeast(traceSummary.statusAtLeast),
            method: (/^[A-Z]+$/).test(String(traceSummary.method || '').trim().toUpperCase())
                ? String(traceSummary.method || '').trim().toUpperCase()
                : '',
            errorCode: normalizeApiErrorCodeToken(traceSummary.errorCode, ''),
        },
    });
    const historySinceMinutes = input.sinceMinutes > 0
        ? parseRuntimeRunbookVerificationHistorySinceMinutes(input.sinceMinutes)
        : 1440;
    const selectedCheckHistory = queryRuntimeRunbookVerificationHistory({
        limit: 200,
        checkId: resolvedCheckId,
        sinceMinutes: historySinceMinutes,
        status: '',
    }).summary;
    const selectedCheckEscalation = resolveRuntimeRunbookVerificationEscalation(
        selectedCheckStatus,
        selectedCheckHistory.activeRiskStreak,
        selectedCheckHistory.activeFailStreak,
        resolvedCheckId
    );
    const selectedCheckRemediation = queryRuntimeRunbookRemediationEventCheckSummary({
        checkId: resolvedCheckId,
        sinceMinutes: historySinceMinutes,
        source: '',
        limit: 200,
    });
    const queryVectorAccelerationCircuitBudget = buildRuntimeRunbookVectorAccelerationCircuitBudgetSummary(
        runtimePayload.runtimeCapabilityMatrix
    );
    const queryVectorAccelerationIndexSyncHealth = buildRuntimeRunbookVectorAccelerationIndexSyncHealthSummary(
        runtimePayload.runtimeCapabilityMatrix
    );
    const queryVectorAccelerationTraceability = buildRuntimeRunbookVectorAccelerationTraceabilitySummary(
        runtimePayload.runtimeCapabilityMatrix
    );
    const queryVectorAccelerationPrefilter = buildRuntimeRunbookVectorAccelerationPrefilterSummary(
        runtimePayload.runtimeCapabilityMatrix
    );
    const queryVectorAccelerationCalibrationReadiness = buildRuntimeRunbookVectorAccelerationCalibrationReadinessSummary(
        runtimePayload.runtimeCapabilityMatrix
    );
    return {
        replayedAt: generatedAt,
        requestedCheckId,
        resolvedCheckId,
        selectedCheckStatus,
        selectedCheckEscalation,
        selectedCheckPriorityScore: Math.max(
            0,
            Math.floor(Number(runbook.selectedCheck?.priorityScore || 0))
        ),
        selectedCheckMessage: String(runbook.selectedCheck?.message || '').trim().slice(0, 280),
        topRiskCheckId: normalizeRuntimeRunbookCheckIdToken(runbook.topRiskCheck?.checkId || ''),
        topRiskStatus,
        selectionSource: String(runbook.selectionSource || 'none').trim().slice(0, 64),
        selectedCheckHistory: {
            activeRiskStreak: Math.max(0, Math.floor(Number(selectedCheckHistory.activeRiskStreak || 0))),
            activeFailStreak: Math.max(0, Math.floor(Number(selectedCheckHistory.activeFailStreak || 0))),
            trendStatus: (
                selectedCheckHistory.trendStatus === 'improving'
                || selectedCheckHistory.trendStatus === 'stable'
                || selectedCheckHistory.trendStatus === 'regressing'
            )
                ? selectedCheckHistory.trendStatus
                : 'insufficient_data',
        },
        selectedCheckRemediation: {
            latestStatus: selectedCheckRemediation.latestStatus || '',
            trendStatus: selectedCheckRemediation.trendStatus,
            riskRatioPct: Number(Number(selectedCheckRemediation.riskRatioPct || 0).toFixed(4)),
        },
        queryVectorAccelerationCircuitBudget,
        queryVectorAccelerationIndexSyncHealth,
        queryVectorAccelerationTraceability,
        queryVectorAccelerationPrefilter,
        queryVectorAccelerationCalibrationReadiness,
        verificationTargets: Array.isArray(runbook.verificationTargets)
            ? runbook.verificationTargets
                .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean)
                .slice(0, 8)
            : [],
        traceSummary: {
            returnedRecords: Math.max(0, Math.floor(Number(traceSummary.returnedRecords || 0))),
            errorRequests: Math.max(0, Math.floor(Number(traceSummary.errorRequests || 0))),
            errorRatioPct: Number(Number(traceSummary.errorRatioPct || 0).toFixed(4)),
            averageDurationMs: Number(Number(traceSummary.averageDurationMs || 0).toFixed(4)),
            p95DurationMs: Number(Number(traceSummary.p95DurationMs || 0).toFixed(4)),
            pathPrefix: String(traceSummary.pathPrefix || '').trim().slice(0, 128),
            statusAtLeast: parseRuntimeRequestTraceStatusAtLeast(traceSummary.statusAtLeast),
            method: (/^[A-Z]+$/).test(String(traceSummary.method || '').trim().toUpperCase())
                ? String(traceSummary.method || '').trim().toUpperCase()
                : '',
            errorCode: normalizeApiErrorCodeToken(traceSummary.errorCode, ''),
        },
    };
}

async function replayRuntimeRunbookRemediationEvents(
    options: RuntimeRunbookRemediationReplayRequestOptions
): Promise<{
    summary: {
        sourceTotalRecords: number;
        sourceMatchedRecords: number;
        sourceReturnedRecords: number;
        replayCandidateRecords: number;
        replayedChecks: number;
        replayedPassChecks: number;
        replayedWarnChecks: number;
        replayedFailChecks: number;
        replayedUnknownChecks: number;
        replayMode: RuntimeRunbookRemediationReplayMode;
        replayLimit: number;
        replayDryRun: boolean;
        replaySelectionPolicy: RuntimeRunbookRemediationReplaySelectionPolicy;
        replayMinRiskRatioPct: number;
        replayEligibleChecks: number;
        plannedReplayChecks: number;
        plannedReplayCheckIds: string[];
        maxPlannedRiskRatioPct: number;
        maxPlannedRiskStreak: number;
        topPlannedCheckId: string;
        limit: number;
        sinceMinutes: number;
        status: RuntimeRunbookRemediationEventStatus | '';
        checkId: string;
        source: string;
        generatedAt: string;
    };
    checks: Array<{
        replayedAt: string;
        requestedCheckId: string;
        resolvedCheckId: string;
        selectedCheckStatus: RuntimeRunbookVerificationStatus;
        selectedCheckEscalation: RuntimeRunbookVerificationEscalation;
        selectedCheckPriorityScore: number;
        selectedCheckMessage: string;
        topRiskCheckId: string;
        topRiskStatus: RuntimeRunbookTopRiskStatus;
        selectionSource: string;
        selectedCheckHistory: {
            activeRiskStreak: number;
            activeFailStreak: number;
            trendStatus: RuntimeRunbookVerificationHistoryTrendStatus;
        };
        selectedCheckRemediation: {
            latestStatus: RuntimeRunbookRemediationEventStatus | '';
            trendStatus: RuntimeRunbookRemediationEventTrendStatus;
            riskRatioPct: number;
        };
        verificationTargets: string[];
        traceSummary: {
            returnedRecords: number;
            errorRequests: number;
            errorRatioPct: number;
            averageDurationMs: number;
            p95DurationMs: number;
            pathPrefix: string;
            statusAtLeast: number;
            method: string;
            errorCode: string;
        };
    }>;
}> {
    const sourceResult = queryRuntimeRunbookRemediationEventHistory({
        limit: options.limit,
        sinceMinutes: options.sinceMinutes,
        status: options.status,
        checkId: options.checkId,
        source: options.source,
    });
    const sourceRecords = Array.isArray(sourceResult.records)
        ? sourceResult.records
        : [];
    const replayCandidateRecords = sourceRecords.filter((record) => {
        const checkId = normalizeRuntimeRunbookCheckIdToken(record?.checkId || '');
        if (!checkId) {
            return false;
        }
        if (options.replayMode === 'risk_only') {
            return isRuntimeRunbookRemediationRiskStatus(record.status);
        }
        return true;
    });
    const replayCheckIds: string[] = [];
    const seenCheckIds = new Set<string>();
    replayCandidateRecords.forEach((record) => {
        const checkId = normalizeRuntimeRunbookCheckIdToken(record?.checkId || '');
        if (!checkId || seenCheckIds.has(checkId)) {
            return;
        }
        seenCheckIds.add(checkId);
        replayCheckIds.push(checkId);
    });
    const replayCandidateChecks = replayCheckIds.map((checkId, historyOrder) => {
        const remediationSummary = queryRuntimeRunbookRemediationEventCheckSummary({
            checkId,
            sinceMinutes: options.sinceMinutes,
            source: options.source,
            limit: 200,
        });
        return {
            checkId,
            historyOrder,
            remediationRiskRatioPct: Number(
                Number(remediationSummary.riskRatioPct || 0).toFixed(4)
            ),
            remediationActiveRiskStreak: Math.max(
                0,
                Math.floor(Number(remediationSummary.activeRiskStreak || 0))
            ),
        };
    });
    const replayEligibleChecks = replayCandidateChecks.filter(
        (item) => item.remediationRiskRatioPct >= options.replayMinRiskRatioPct
    );
    const replayRankedChecks = replayEligibleChecks.slice().sort((left, right) => {
        if (options.replaySelectionPolicy === 'risk_ratio_desc') {
            if (right.remediationRiskRatioPct !== left.remediationRiskRatioPct) {
                return right.remediationRiskRatioPct - left.remediationRiskRatioPct;
            }
            if (right.remediationActiveRiskStreak !== left.remediationActiveRiskStreak) {
                return right.remediationActiveRiskStreak - left.remediationActiveRiskStreak;
            }
        } else if (options.replaySelectionPolicy === 'risk_streak_desc') {
            if (right.remediationActiveRiskStreak !== left.remediationActiveRiskStreak) {
                return right.remediationActiveRiskStreak - left.remediationActiveRiskStreak;
            }
            if (right.remediationRiskRatioPct !== left.remediationRiskRatioPct) {
                return right.remediationRiskRatioPct - left.remediationRiskRatioPct;
            }
        }
        return left.historyOrder - right.historyOrder;
    });
    const replayChecks = replayRankedChecks
        .slice(0, options.replayLimit)
        .map((item) => item.checkId);
    const maxPlannedRiskRatioPct = replayRankedChecks.length > 0
        ? Number(Number(replayRankedChecks[0]?.remediationRiskRatioPct || 0).toFixed(4))
        : 0;
    const maxPlannedRiskStreak = replayRankedChecks.length > 0
        ? Math.max(0, Math.floor(Number(replayRankedChecks[0]?.remediationActiveRiskStreak || 0)))
        : 0;
    const topPlannedCheckId = replayChecks.length > 0
        ? replayChecks[0]
        : '';
    const checks: Array<Awaited<ReturnType<typeof replayRuntimeRunbookVerificationForCheck>>> = [];
    if (!options.replayDryRun) {
        for (let index = 0; index < replayChecks.length; index += 1) {
            const replayCheck = await replayRuntimeRunbookVerificationForCheck({
                checkId: replayChecks[index],
                sinceMinutes: options.sinceMinutes,
                traceLimit: 24,
            });
            if (replayCheck) {
                checks.push(replayCheck);
            }
        }
    }
    const replayedPassChecks = checks.filter((item) => item?.selectedCheckStatus === 'pass').length;
    const replayedWarnChecks = checks.filter((item) => item?.selectedCheckStatus === 'warn').length;
    const replayedFailChecks = checks.filter((item) => item?.selectedCheckStatus === 'fail').length;
    const replayedUnknownChecks = checks.filter((item) => item?.selectedCheckStatus === 'unknown').length;
    return {
        summary: {
            sourceTotalRecords: Math.max(0, Math.floor(Number(sourceResult.summary?.totalRecords || 0))),
            sourceMatchedRecords: Math.max(0, Math.floor(Number(sourceResult.summary?.matchedRecords || 0))),
            sourceReturnedRecords: sourceRecords.length,
            replayCandidateRecords: replayCandidateRecords.length,
            replayedChecks: checks.length,
            replayedPassChecks,
            replayedWarnChecks,
            replayedFailChecks,
            replayedUnknownChecks,
            replayMode: options.replayMode,
            replayLimit: options.replayLimit,
            replayDryRun: options.replayDryRun === true,
            replaySelectionPolicy: options.replaySelectionPolicy,
            replayMinRiskRatioPct: options.replayMinRiskRatioPct,
            replayEligibleChecks: replayEligibleChecks.length,
            plannedReplayChecks: replayChecks.length,
            plannedReplayCheckIds: replayChecks,
            maxPlannedRiskRatioPct,
            maxPlannedRiskStreak,
            topPlannedCheckId,
            limit: options.limit,
            sinceMinutes: options.sinceMinutes,
            status: options.status,
            checkId: options.checkId,
            source: options.source,
            generatedAt: new Date().toISOString(),
        },
        checks: checks.filter(Boolean) as Array<NonNullable<Awaited<ReturnType<typeof replayRuntimeRunbookVerificationForCheck>>>>,
    };
}

function cloneRuntimeRunbookRemediationReplayScheduleConfig(
    config: RuntimeRunbookRemediationReplayScheduleConfig
): RuntimeRunbookRemediationReplayScheduleConfig {
    const guardrailed = applyRuntimeRunbookRemediationReplayScheduleConfigGuardrails({
        enabled: config.enabled === true,
        intervalMinutes: parseRuntimeRunbookRemediationReplayScheduleIntervalMinutes(
            config.intervalMinutes
        ),
        intervalJitterPct: parseRuntimeRunbookRemediationReplayScheduleIntervalJitterPct(
            config.intervalJitterPct
        ),
        cooldownMinutes: parseRuntimeRunbookRemediationReplayScheduleCooldownMinutes(
            config.cooldownMinutes
        ),
        replayBudgetWindowMinutes: parseRuntimeRunbookRemediationReplayScheduleBudgetWindowMinutes(
            config.replayBudgetWindowMinutes
        ),
        maxReplayChecksPerWindow: parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
            config.maxReplayChecksPerWindow
        ),
        triggerPolicy: normalizeRuntimeRunbookRemediationReplayScheduleTriggerPolicy(
            config.triggerPolicy
        ),
        triggerMinRiskRatioPct: parseRuntimeRunbookRemediationReplayMinRiskRatioPct(
            config.triggerMinRiskRatioPct
        ),
        triggerMinRiskStreak: parseRuntimeRunbookRemediationReplayScheduleTriggerMinRiskStreak(
            config.triggerMinRiskStreak
        ),
        autoExecution: {
            enabled: parseBooleanFlagOrUndefined(config.autoExecution?.enabled) === true,
            mode: normalizeRuntimeRunbookRemediationReplayScheduleAutoExecutionMode(
                config.autoExecution?.mode
            ),
            requireDryRunParity: (() => {
                const parsed = parseBooleanFlagOrUndefined(
                    config.autoExecution?.requireDryRunParity
                );
                return typeof parsed === 'boolean' ? parsed : true;
            })(),
            minConsecutiveSkips:
                parseRuntimeRunbookRemediationReplayScheduleAutoExecutionMinConsecutiveSkips(
                    config.autoExecution?.minConsecutiveSkips
                ),
        },
        replayOptions: normalizeRuntimeRunbookRemediationReplayRequestPayload(config.replayOptions),
    });
    return guardrailed.config;
}

function resolveRuntimeRunbookRemediationReplayScheduleOutcome(
    summary: Awaited<ReturnType<typeof replayRuntimeRunbookRemediationEvents>>['summary'] | null | undefined
): RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry']['lastOutcome'] {
    if (!summary || typeof summary !== 'object') {
        return null;
    }
    return {
        replayDryRun: summary.replayDryRun === true,
        replayMode: summary.replayMode,
        replayLimit: summary.replayLimit,
        replaySelectionPolicy: summary.replaySelectionPolicy,
        replayMinRiskRatioPct: Number(Number(summary.replayMinRiskRatioPct || 0).toFixed(4)),
        plannedReplayChecks: Math.max(0, Math.floor(Number(summary.plannedReplayChecks || 0))),
        plannedReplayCheckIds: Array.isArray(summary.plannedReplayCheckIds)
            ? summary.plannedReplayCheckIds
                .map((item) => normalizeRuntimeRunbookCheckIdToken(item))
                .filter(Boolean)
                .slice(0, 24)
            : [],
        replayedChecks: Math.max(0, Math.floor(Number(summary.replayedChecks || 0))),
        replayedPassChecks: Math.max(0, Math.floor(Number(summary.replayedPassChecks || 0))),
        replayedWarnChecks: Math.max(0, Math.floor(Number(summary.replayedWarnChecks || 0))),
        replayedFailChecks: Math.max(0, Math.floor(Number(summary.replayedFailChecks || 0))),
        replayedUnknownChecks: Math.max(0, Math.floor(Number(summary.replayedUnknownChecks || 0))),
        maxPlannedRiskRatioPct: Number(Number(summary.maxPlannedRiskRatioPct || 0).toFixed(4)),
        maxPlannedRiskStreak: Math.max(0, Math.floor(Number(summary.maxPlannedRiskStreak || 0))),
        topPlannedCheckId: normalizeRuntimeRunbookCheckIdToken(summary.topPlannedCheckId || ''),
        generatedAt: String(summary.generatedAt || ''),
    };
}

function sanitizeRuntimeRunbookRemediationReplayScheduleRecommendationText(
    rawValue: unknown,
    maxLength: number
): string {
    const safeMaxLength = Math.max(0, Math.floor(Number(maxLength || 0)));
    if (safeMaxLength <= 0) {
        return '';
    }
    return String(rawValue || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, safeMaxLength);
}

function getRuntimeRunbookRemediationReplayScheduleRecommendationSeverityRank(
    severity: RuntimeRunbookRemediationReplayScheduleRecommendationSeverity
): number {
    if (severity === 'critical') {
        return 3;
    }
    if (severity === 'warn') {
        return 2;
    }
    return 1;
}

function appendRuntimeRunbookRemediationReplayScheduleRecommendation(
    recommendations: RuntimeRunbookRemediationReplayScheduleRecommendation[],
    recommendation: RuntimeRunbookRemediationReplayScheduleRecommendation
): void {
    if (!recommendation || typeof recommendation !== 'object') {
        return;
    }
    const code = String(recommendation.code || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, '_')
        .slice(0, 96);
    if (!code) {
        return;
    }
    if (recommendations.some((item) => item.code === code)) {
        return;
    }
    const severity = recommendation.severity === 'critical' || recommendation.severity === 'warn'
        ? recommendation.severity
        : 'info';
    const reason = sanitizeRuntimeRunbookRemediationReplayScheduleRecommendationText(
        recommendation.reason,
        240
    );
    const action = sanitizeRuntimeRunbookRemediationReplayScheduleRecommendationText(
        recommendation.action,
        240
    );
    if (!reason && !action) {
        return;
    }
    recommendations.push({
        code,
        severity,
        reason,
        action,
    });
}

function sanitizeRuntimeRunbookRemediationReplayScheduleAutoExecutionBlockedReason(
    rawValue: unknown
): string {
    return String(rawValue || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, '_')
        .slice(0, 120);
}

function buildRuntimeRunbookRemediationReplayScheduleAutoExecutionPreviewTelemetry(input: {
    telemetry: Pick<
        RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry'],
        | 'consecutiveSkips'
        | 'cooldownRemainingSeconds'
        | 'currentWindowReplayChecks'
        | 'remainingWindowReplayChecks'
        | 'lastOutcome'
    >;
    previewOutcome: RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry']['lastOutcome'];
}): Pick<
    RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry'],
    | 'lastDecision'
    | 'lastReason'
    | 'consecutiveSkips'
    | 'cooldownRemainingSeconds'
    | 'currentWindowReplayChecks'
    | 'remainingWindowReplayChecks'
    | 'lastOutcome'
> {
    return {
        lastDecision: 'preview_auto_execution_gate',
        lastReason: 'preview_auto_execution_gate',
        consecutiveSkips: Math.max(0, Math.floor(Number(input.telemetry.consecutiveSkips || 0))),
        cooldownRemainingSeconds: Math.max(
            0,
            Math.floor(Number(input.telemetry.cooldownRemainingSeconds || 0))
        ),
        currentWindowReplayChecks: Math.max(
            0,
            Math.floor(Number(input.telemetry.currentWindowReplayChecks || 0))
        ),
        remainingWindowReplayChecks: Math.max(
            0,
            Math.floor(Number(input.telemetry.remainingWindowReplayChecks || 0))
        ),
        lastOutcome: input.previewOutcome,
    };
}

function evaluateRuntimeRunbookRemediationReplayScheduleAutoExecutionEligibility(input: {
    config: RuntimeRunbookRemediationReplayScheduleConfig;
    consecutiveSkips: number;
    cooldownRemainingSeconds: number;
    remainingWindowReplayChecks: number;
    previousDecision: string;
    previousOutcome: RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry']['lastOutcome'];
    previewOutcome: RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry']['lastOutcome'];
}): {
    eligible: boolean;
    blockedReasons: string[];
    recommendationCount: number;
    actionableRecommendationCount: number;
    policyTemplateCount: number;
    actionablePolicyTemplateCount: number;
} {
    const blockedReasons: string[] = [];
    const config = cloneRuntimeRunbookRemediationReplayScheduleConfig(input.config);
    const consecutiveSkips = Math.max(0, Math.floor(Number(input.consecutiveSkips || 0)));
    const cooldownRemainingSeconds = Math.max(
        0,
        Math.floor(Number(input.cooldownRemainingSeconds || 0))
    );
    const remainingWindowReplayChecks = Math.max(
        0,
        Math.floor(Number(input.remainingWindowReplayChecks || 0))
    );
    if (!config.autoExecution.enabled) {
        blockedReasons.push('auto_execution_disabled');
    }
    if (consecutiveSkips < config.autoExecution.minConsecutiveSkips) {
        blockedReasons.push(
            sanitizeRuntimeRunbookRemediationReplayScheduleAutoExecutionBlockedReason(
                `min_consecutive_skips_not_met:${consecutiveSkips}<${config.autoExecution.minConsecutiveSkips}`
            )
        );
    }
    if (cooldownRemainingSeconds > 0) {
        blockedReasons.push(
            sanitizeRuntimeRunbookRemediationReplayScheduleAutoExecutionBlockedReason(
                `cooldown_active:${cooldownRemainingSeconds}s`
            )
        );
    }
    if (remainingWindowReplayChecks <= 0) {
        blockedReasons.push('replay_budget_depleted');
    }
    const previewTelemetry = buildRuntimeRunbookRemediationReplayScheduleAutoExecutionPreviewTelemetry({
        telemetry: {
            consecutiveSkips,
            cooldownRemainingSeconds,
            currentWindowReplayChecks: Math.max(
                0,
                parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
                    config.maxReplayChecksPerWindow
                ) - remainingWindowReplayChecks
            ),
            remainingWindowReplayChecks,
            lastOutcome: input.previousOutcome,
        },
        previewOutcome: input.previewOutcome,
    });
    const recommendations = resolveRuntimeRunbookRemediationReplayScheduleRecommendations({
        config,
        telemetry: previewTelemetry,
    });
    const actionableRecommendations = recommendations.filter((item) => (
        item && (item.severity === 'critical' || item.severity === 'warn')
    ));
    if (
        config.autoExecution.mode === 'recommendation'
        && actionableRecommendations.length <= 0
    ) {
        blockedReasons.push('recommendation_confidence_not_met');
    }
    const policyTemplates = resolveRuntimeRunbookRemediationReplaySchedulePolicyTemplates({
        config,
        telemetry: previewTelemetry,
    });
    const actionablePolicyTemplates = policyTemplates.filter((item) => (
        item && item.templateId !== 'balanced_guarded'
    ));
    if (
        config.autoExecution.mode === 'policy_template'
        && actionablePolicyTemplates.length <= 0
    ) {
        blockedReasons.push('policy_template_not_actionable');
    }
    if (config.autoExecution.requireDryRunParity) {
        const previousDecision = String(input.previousDecision || '').trim().toLowerCase();
        const previousOutcome = input.previousOutcome;
        const dryRunParitySatisfied = Boolean(
            previousDecision === 'executed_dry_run'
            && previousOutcome
            && previousOutcome.replayDryRun === true
            && Number(previousOutcome.plannedReplayChecks || 0) > 0
        );
        if (!dryRunParitySatisfied) {
            blockedReasons.push('dry_run_parity_missing');
        }
    }
    const uniqueBlockedReasons = Array.from(new Set(
        blockedReasons
            .map((item) => sanitizeRuntimeRunbookRemediationReplayScheduleAutoExecutionBlockedReason(item))
            .filter(Boolean)
    )).slice(0, 6);
    return {
        eligible: uniqueBlockedReasons.length <= 0,
        blockedReasons: uniqueBlockedReasons,
        recommendationCount: recommendations.length,
        actionableRecommendationCount: actionableRecommendations.length,
        policyTemplateCount: policyTemplates.length,
        actionablePolicyTemplateCount: actionablePolicyTemplates.length,
    };
}

function resolveRuntimeRunbookRemediationReplayScheduleRecommendations(input: {
    config: RuntimeRunbookRemediationReplayScheduleConfig;
    telemetry: Pick<
        RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry'],
        | 'lastDecision'
        | 'lastReason'
        | 'consecutiveSkips'
        | 'cooldownRemainingSeconds'
        | 'currentWindowReplayChecks'
        | 'remainingWindowReplayChecks'
        | 'lastOutcome'
    >;
}): RuntimeRunbookRemediationReplayScheduleRecommendation[] {
    const recommendations: RuntimeRunbookRemediationReplayScheduleRecommendation[] = [];
    const config = cloneRuntimeRunbookRemediationReplayScheduleConfig(input.config);
    const telemetry = input.telemetry || {
        lastDecision: '',
        lastReason: '',
        consecutiveSkips: 0,
        cooldownRemainingSeconds: 0,
        currentWindowReplayChecks: 0,
        remainingWindowReplayChecks: 0,
        lastOutcome: null,
    };
    const decision = String(telemetry.lastDecision || '').trim().toLowerCase();
    const reason = String(telemetry.lastReason || '').trim();
    const replayLimit = parseRuntimeRunbookRemediationReplayLimit(config.replayOptions?.replayLimit);
    const replayBudgetWindowMinutes = parseRuntimeRunbookRemediationReplayScheduleBudgetWindowMinutes(
        config.replayBudgetWindowMinutes
    );
    const maxReplayChecksPerWindow = parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
        config.maxReplayChecksPerWindow
    );
    const triggerMinRiskRatioPct = parseRuntimeRunbookRemediationReplayMinRiskRatioPct(
        config.triggerMinRiskRatioPct
    );
    const triggerMinRiskStreak = parseRuntimeRunbookRemediationReplayScheduleTriggerMinRiskStreak(
        config.triggerMinRiskStreak
    );
    const currentWindowReplayChecks = Math.max(
        0,
        Math.floor(Number(telemetry.currentWindowReplayChecks || 0))
    );
    const remainingWindowReplayChecks = Math.max(
        0,
        Math.floor(Number(telemetry.remainingWindowReplayChecks || 0))
    );
    const consecutiveSkips = Math.max(0, Math.floor(Number(telemetry.consecutiveSkips || 0)));
    const cooldownRemainingSeconds = Math.max(
        0,
        Math.floor(Number(telemetry.cooldownRemainingSeconds || 0))
    );
    const lastOutcome = telemetry.lastOutcome && typeof telemetry.lastOutcome === 'object'
        ? telemetry.lastOutcome
        : null;
    const plannedReplayChecks = Math.max(
        0,
        Math.floor(Number(lastOutcome?.plannedReplayChecks || 0))
    );
    const maxPlannedRiskRatioPct = Number(Number(lastOutcome?.maxPlannedRiskRatioPct || 0).toFixed(4));
    const maxPlannedRiskStreak = Math.max(0, Math.floor(Number(lastOutcome?.maxPlannedRiskStreak || 0)));
    const topPlannedCheckId = normalizeRuntimeRunbookCheckIdToken(lastOutcome?.topPlannedCheckId || '');

    if (reason.includes('max_replay_checks_per_window_raised_to_replay_limit')) {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_guardrail_budget_auto_raised',
            severity: 'warn',
            reason: `Guardrail raised maxReplayChecksPerWindow to replayLimit (${maxReplayChecksPerWindow}) to keep schedule execution valid.`,
            action: 'Set maxReplayChecksPerWindow explicitly above replayOptions.replayLimit to avoid repeated guardrail rewrites.',
        });
    }

    if (decision === 'skipped_budget') {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_tick_skipped_budget_capacity',
            severity: 'critical',
            reason: `Planned replay checks (${plannedReplayChecks}) exceeded remaining budget (${remainingWindowReplayChecks}) in the ${replayBudgetWindowMinutes}m window.`,
            action: `Reduce replayOptions.replayLimit/filter scope or increase replayBudgetWindowMinutes/maxReplayChecksPerWindow (current max=${maxReplayChecksPerWindow}).`,
        });
    }

    if (config.enabled && currentWindowReplayChecks > 0 && remainingWindowReplayChecks <= 0) {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_budget_window_exhausted',
            severity: decision === 'skipped_budget' ? 'critical' : 'warn',
            reason: `Replay budget window is exhausted (used=${currentWindowReplayChecks}, remaining=${remainingWindowReplayChecks}) over ${replayBudgetWindowMinutes} minutes.`,
            action: `Expand replayBudgetWindowMinutes/maxReplayChecksPerWindow or lower replayOptions.replayLimit from ${replayLimit}.`,
        });
    }

    if (decision === 'skipped_trigger') {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_tick_skipped_trigger_threshold',
            severity: 'warn',
            reason: `Trigger policy ${config.triggerPolicy} did not match candidate risk (maxRiskRatio=${maxPlannedRiskRatioPct.toFixed(2)}%, maxRiskStreak=${maxPlannedRiskStreak}).`,
            action: `Tune triggerMinRiskRatioPct (${triggerMinRiskRatioPct.toFixed(2)}%) / triggerMinRiskStreak (${triggerMinRiskStreak}) or widen replay candidate scope.`,
        });
    }

    if (decision === 'skipped_cooldown' && cooldownRemainingSeconds > 0) {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_tick_skipped_cooldown_window',
            severity: 'info',
            reason: `Cooldown gate blocked schedule execution with ${cooldownRemainingSeconds}s remaining.`,
            action: 'Use force=true for manual validation or lower cooldownMinutes if frequent remediation is expected.',
        });
    }

    if (decision === 'executed_dry_run' && config.replayOptions.replayDryRun === true && plannedReplayChecks > 0) {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_dry_run_only_mode',
            severity: 'info',
            reason: `Schedule executed in dry-run mode with ${plannedReplayChecks} planned checks.`,
            action: 'Switch replayOptions.replayDryRun to false or run a forced non-dry-run tick to apply remediation replay.',
        });
    }

    if (decision === 'auto_execution_dry_run_required') {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_auto_execution_dry_run_required',
            severity: 'warn',
            reason: `Auto execution requires dry-run parity before non-dry-run apply (${reason || 'dry_run_parity_missing'}).`,
            action: 'Run one dry-run tick first, then rerun schedule tick without dryRun override.',
        });
    }

    if (decision === 'auto_execution_blocked') {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_auto_execution_blocked',
            severity: 'warn',
            reason: `Auto execution gate blocked replay apply (${reason || 'auto_execution_blocked'}).`,
            action: 'Inspect telemetry.autoExecution.blockedReasons and adjust autoExecution policy or schedule thresholds.',
        });
    }

    if (consecutiveSkips >= 3) {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_skip_streak_recovery_plan',
            severity: 'warn',
            reason: `Replay schedule has skipped ${consecutiveSkips} consecutive ticks (latest=${decision || 'unknown'}).`,
            action: 'Review decision/reason telemetry and reduce interval/cooldown/trigger strictness to restore effective execution cadence.',
        });
    }

    if (topPlannedCheckId && maxPlannedRiskRatioPct >= 75) {
        appendRuntimeRunbookRemediationReplayScheduleRecommendation(recommendations, {
            code: 'schedule_high_risk_focus_check',
            severity: 'warn',
            reason: `Top planned replay check ${topPlannedCheckId} remains high risk (${maxPlannedRiskRatioPct.toFixed(2)}%).`,
            action: `Prioritize focused verification for ${topPlannedCheckId} and keep replaySelectionPolicy aligned with risk-first ordering.`,
        });
    }

    recommendations.sort((left, right) => {
        const severityDiff = getRuntimeRunbookRemediationReplayScheduleRecommendationSeverityRank(
            right.severity
        ) - getRuntimeRunbookRemediationReplayScheduleRecommendationSeverityRank(left.severity);
        if (severityDiff !== 0) {
            return severityDiff;
        }
        return String(left.code || '').localeCompare(String(right.code || ''));
    });
    return recommendations.slice(0, 4);
}

function resolveRuntimeRunbookRemediationReplaySchedulePolicyTemplates(input: {
    config: RuntimeRunbookRemediationReplayScheduleConfig;
    telemetry: Pick<
        RuntimeRunbookRemediationReplayScheduleSnapshot['telemetry'],
        | 'lastDecision'
        | 'lastReason'
        | 'cooldownRemainingSeconds'
        | 'remainingWindowReplayChecks'
        | 'lastOutcome'
    >;
}): RuntimeRunbookRemediationReplaySchedulePolicyTemplate[] {
    const config = cloneRuntimeRunbookRemediationReplayScheduleConfig(input.config);
    const telemetry = input.telemetry || {
        lastDecision: '',
        lastReason: '',
        cooldownRemainingSeconds: 0,
        remainingWindowReplayChecks: 0,
        lastOutcome: null,
    };
    const decision = String(telemetry.lastDecision || '').trim().toLowerCase();
    const reason = String(telemetry.lastReason || '').trim().toLowerCase();
    const appliedTemplateFromReason = (() => {
        const match = reason.match(/policy_template=([a-z0-9_:-]+)/);
        const matchedTemplateId = normalizeRuntimeRunbookRemediationReplaySchedulePolicyTemplateId(
            match?.[1] || ''
        );
        return matchedTemplateId || '';
    })();
    const remainingWindowReplayChecks = Math.max(
        0,
        Math.floor(Number(telemetry.remainingWindowReplayChecks || 0))
    );
    const cooldownRemainingSeconds = Math.max(
        0,
        Math.floor(Number(telemetry.cooldownRemainingSeconds || 0))
    );
    const plannedReplayChecks = Math.max(
        0,
        Math.floor(Number(telemetry.lastOutcome?.plannedReplayChecks || 0))
    );
    const templateCandidates: Array<{
        templateId: RuntimeRunbookRemediationReplaySchedulePolicyTemplateId;
        reason: string;
        priority: number;
    }> = [
        {
            templateId: 'balanced_guarded',
            reason: 'Balanced default profile for predictable replay cadence with guarded trigger thresholds.',
            priority: 10,
        },
    ];
    if (appliedTemplateFromReason) {
        templateCandidates.unshift({
            templateId: appliedTemplateFromReason,
            reason: `Last schedule config update used policy template ${appliedTemplateFromReason}.`,
            priority: 120,
        });
    }
    if (reason.includes('max_replay_checks_per_window_raised_to_replay_limit')) {
        templateCandidates.unshift({
            templateId: 'budget_relief',
            reason: 'Guardrail raised max replay checks to match replayLimit; budget relief profile helps avoid repeated guardrail adjustments.',
            priority: 95,
        });
    }
    if (decision === 'skipped_budget' || remainingWindowReplayChecks <= 0) {
        templateCandidates.unshift({
            templateId: 'budget_relief',
            reason: 'Budget relief profile to rebalance replay limit and budget window after budget gate skips.',
            priority: 100,
        });
    }
    if (decision === 'skipped_trigger') {
        templateCandidates.unshift({
            templateId: 'high_risk_response',
            reason: 'High-risk response profile to reduce trigger strictness and prioritize risk-first replay selection.',
            priority: 90,
        });
    }
    if (decision === 'skipped_cooldown' && cooldownRemainingSeconds > 0) {
        templateCandidates.unshift({
            templateId: 'cooldown_relief',
            reason: 'Cooldown relief profile to lower cooldown pressure while preserving guarded trigger policy.',
            priority: 80,
        });
    }
    if (decision === 'executed_dry_run' && plannedReplayChecks > 0) {
        templateCandidates.unshift({
            templateId: 'production_apply',
            reason: 'Production apply profile to move from dry-run preview to non-dry-run replay execution.',
            priority: 85,
        });
    }
    const templates: RuntimeRunbookRemediationReplaySchedulePolicyTemplate[] = [];
    templateCandidates
        .sort((left, right) => right.priority - left.priority)
        .forEach((candidate) => {
            if (templates.some((item) => item.templateId === candidate.templateId)) {
                return;
            }
            templates.push({
                templateId: candidate.templateId,
                reason: sanitizeRuntimeRunbookRemediationReplayScheduleRecommendationText(
                    candidate.reason,
                    240
                ),
                patch: resolveRuntimeRunbookRemediationReplaySchedulePolicyTemplatePatch({
                    templateId: candidate.templateId,
                    config,
                }),
            });
        });
    return templates.slice(0, 3);
}

function resolveRuntimeRunbookRemediationReplayScheduleJitterMs(input: {
    seed: string;
    intervalMs: number;
    intervalJitterPct: number;
}): number {
    const intervalMs = Math.max(0, Math.floor(Number(input.intervalMs || 0)));
    const jitterPct = parseRuntimeRunbookRemediationReplayScheduleIntervalJitterPct(
        input.intervalJitterPct
    );
    if (intervalMs <= 0 || jitterPct <= 0) {
        return 0;
    }
    const seed = String(input.seed || '');
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    const ratio = hash / 4294967295;
    const jitterBudgetMs = Math.max(0, Math.floor(intervalMs * (jitterPct / 100)));
    return Math.max(0, Math.floor(jitterBudgetMs * ratio));
}

function refreshRuntimeRunbookRemediationReplayScheduleBudgetTelemetry(
    now: Date,
    config: RuntimeRunbookRemediationReplayScheduleConfig
): {
    currentWindowReplayChecks: number;
    remainingWindowReplayChecks: number;
} {
    const nowMs = now.getTime();
    const windowMs = parseRuntimeRunbookRemediationReplayScheduleBudgetWindowMinutes(
        config.replayBudgetWindowMinutes
    ) * 60 * 1000;
    const cutoffMs = nowMs - windowMs;
    const retained = runtimeRunbookRemediationReplayScheduleState.executionWindowRecords
        .filter((record) => {
            const executedAtMs = Date.parse(String(record.executedAt || ''));
            return Number.isFinite(executedAtMs) && executedAtMs >= cutoffMs;
        })
        .slice(-400);
    runtimeRunbookRemediationReplayScheduleState.executionWindowRecords = retained;
    const currentWindowReplayChecks = retained.reduce((sum, record) => (
        sum + Math.max(0, Math.floor(Number(record.replayChecks || 0)))
    ), 0);
    const maxReplayChecksPerWindow = parseRuntimeRunbookRemediationReplayScheduleMaxReplayChecksPerWindow(
        config.maxReplayChecksPerWindow
    );
    const remainingWindowReplayChecks = Math.max(0, maxReplayChecksPerWindow - currentWindowReplayChecks);
    runtimeRunbookRemediationReplayScheduleState.currentWindowReplayChecks = currentWindowReplayChecks;
    runtimeRunbookRemediationReplayScheduleState.remainingWindowReplayChecks = remainingWindowReplayChecks;
    runtimeRunbookRemediationReplayScheduleState.budgetWindowStartedAt = retained.length > 0
        ? String(retained[0]?.executedAt || '')
        : '';
    return {
        currentWindowReplayChecks,
        remainingWindowReplayChecks,
    };
}

function refreshRuntimeRunbookRemediationReplayScheduleCooldownTelemetry(
    now: Date,
    config: RuntimeRunbookRemediationReplayScheduleConfig
): number {
    const cooldownMs = parseRuntimeRunbookRemediationReplayScheduleCooldownMinutes(
        config.cooldownMinutes
    ) * 60 * 1000;
    if (cooldownMs <= 0) {
        runtimeRunbookRemediationReplayScheduleState.cooldownRemainingSeconds = 0;
        return 0;
    }
    const lastTriggeredMs = Date.parse(runtimeRunbookRemediationReplayScheduleState.lastTriggeredAt || '');
    if (!Number.isFinite(lastTriggeredMs) || lastTriggeredMs <= 0) {
        runtimeRunbookRemediationReplayScheduleState.cooldownRemainingSeconds = 0;
        return 0;
    }
    const remainingMs = Math.max(0, (lastTriggeredMs + cooldownMs) - now.getTime());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    runtimeRunbookRemediationReplayScheduleState.cooldownRemainingSeconds = remainingSeconds;
    return remainingSeconds;
}

function getRuntimeRunbookRemediationReplayScheduleSnapshot():
RuntimeRunbookRemediationReplayScheduleSnapshot {
    const config = cloneRuntimeRunbookRemediationReplayScheduleConfig(
        runtimeRunbookRemediationReplayScheduleState.config
    );
    const telemetryBase = {
        lastEvaluatedAt: runtimeRunbookRemediationReplayScheduleState.lastEvaluatedAt,
        lastTriggeredAt: runtimeRunbookRemediationReplayScheduleState.lastTriggeredAt,
        lastDecision: runtimeRunbookRemediationReplayScheduleState.lastDecision,
        lastReason: runtimeRunbookRemediationReplayScheduleState.lastReason,
        lastError: runtimeRunbookRemediationReplayScheduleState.lastError,
        consecutiveSkips: Math.max(
            0,
            Math.floor(Number(runtimeRunbookRemediationReplayScheduleState.consecutiveSkips || 0))
        ),
        lastJitterDelaySeconds: Math.max(
            0,
            Math.floor(Number(runtimeRunbookRemediationReplayScheduleState.lastJitterDelaySeconds || 0))
        ),
        effectiveIntervalSeconds: Math.max(
            0,
            Math.floor(Number(runtimeRunbookRemediationReplayScheduleState.effectiveIntervalSeconds || 0))
        ),
        cooldownRemainingSeconds: Math.max(
            0,
            Math.floor(Number(runtimeRunbookRemediationReplayScheduleState.cooldownRemainingSeconds || 0))
        ),
        budgetWindowStartedAt: String(
            runtimeRunbookRemediationReplayScheduleState.budgetWindowStartedAt || ''
        ),
        currentWindowReplayChecks: Math.max(
            0,
            Math.floor(Number(runtimeRunbookRemediationReplayScheduleState.currentWindowReplayChecks || 0))
        ),
        remainingWindowReplayChecks: Math.max(
            0,
            Math.floor(Number(runtimeRunbookRemediationReplayScheduleState.remainingWindowReplayChecks || 0))
        ),
        autoExecution: {
            eligible: runtimeRunbookRemediationReplayScheduleState.autoExecutionEligible === true,
            blockedReasons: Array.from(new Set(
                (Array.isArray(runtimeRunbookRemediationReplayScheduleState.autoExecutionBlockedReasons)
                    ? runtimeRunbookRemediationReplayScheduleState.autoExecutionBlockedReasons
                    : []
                )
                    .map((item) => sanitizeRuntimeRunbookRemediationReplayScheduleAutoExecutionBlockedReason(item))
                    .filter(Boolean)
            )).slice(0, 6),
            decision: String(runtimeRunbookRemediationReplayScheduleState.autoExecutionDecision || 'idle')
                .trim()
                .slice(0, 96),
            lastAttemptedAt: String(
                runtimeRunbookRemediationReplayScheduleState.autoExecutionLastAttemptedAt || ''
            ),
            lastExecutedAt: String(
                runtimeRunbookRemediationReplayScheduleState.autoExecutionLastExecutedAt || ''
            ),
        },
        lastOutcome: runtimeRunbookRemediationReplayScheduleState.lastOutcome,
    };
    const recommendations = resolveRuntimeRunbookRemediationReplayScheduleRecommendations({
        config,
        telemetry: {
            lastDecision: telemetryBase.lastDecision,
            lastReason: telemetryBase.lastReason,
            consecutiveSkips: telemetryBase.consecutiveSkips,
            cooldownRemainingSeconds: telemetryBase.cooldownRemainingSeconds,
            currentWindowReplayChecks: telemetryBase.currentWindowReplayChecks,
            remainingWindowReplayChecks: telemetryBase.remainingWindowReplayChecks,
            lastOutcome: telemetryBase.lastOutcome,
        },
    });
    const policyTemplates = resolveRuntimeRunbookRemediationReplaySchedulePolicyTemplates({
        config,
        telemetry: {
            lastDecision: telemetryBase.lastDecision,
            lastReason: telemetryBase.lastReason,
            cooldownRemainingSeconds: telemetryBase.cooldownRemainingSeconds,
            remainingWindowReplayChecks: telemetryBase.remainingWindowReplayChecks,
            lastOutcome: telemetryBase.lastOutcome,
        },
    });
    return {
        config,
        telemetry: {
            ...telemetryBase,
            recommendations,
            policyTemplates,
            autoExecution: telemetryBase.autoExecution,
        },
    };
}

function updateRuntimeRunbookRemediationReplayScheduleConfig(
    payload: unknown
): RuntimeRunbookRemediationReplayScheduleSnapshot {
    const normalized = normalizeRuntimeRunbookRemediationReplayScheduleConfigPayload(
        payload,
        runtimeRunbookRemediationReplayScheduleState.config
    );
    runtimeRunbookRemediationReplayScheduleState.config = normalized.config;
    const now = new Date();
    refreshRuntimeRunbookRemediationReplayScheduleBudgetTelemetry(now, normalized.config);
    refreshRuntimeRunbookRemediationReplayScheduleCooldownTelemetry(now, normalized.config);
    runtimeRunbookRemediationReplayScheduleState.lastJitterDelaySeconds = 0;
    runtimeRunbookRemediationReplayScheduleState.effectiveIntervalSeconds =
        normalized.config.intervalMinutes * 60;
    const guardrailReason = String(normalized.guardrailReason || '').trim();
    const policyTemplateId = String(normalized.policyTemplateId || '').trim();
    runtimeRunbookRemediationReplayScheduleState.lastDecision = guardrailReason
        ? 'config_guardrail_applied'
        : (policyTemplateId ? 'config_template_applied' : 'config_updated');
    runtimeRunbookRemediationReplayScheduleState.lastReason = guardrailReason
        ? `schedule_config_guardrail:${guardrailReason}${policyTemplateId ? `,policy_template=${policyTemplateId}` : ''}`
        : (
            policyTemplateId
                ? `schedule_config_updated:policy_template=${policyTemplateId}`
                : 'schedule_config_updated'
        );
    runtimeRunbookRemediationReplayScheduleState.autoExecutionEligible = false;
    runtimeRunbookRemediationReplayScheduleState.autoExecutionBlockedReasons = normalized.config.autoExecution.enabled
        ? ['awaiting_schedule_tick']
        : ['auto_execution_disabled'];
    runtimeRunbookRemediationReplayScheduleState.autoExecutionDecision = normalized.config.autoExecution.enabled
        ? 'configured'
        : 'disabled';
    runtimeRunbookRemediationReplayScheduleState.lastError = '';
    return getRuntimeRunbookRemediationReplayScheduleSnapshot();
}

function evaluateRuntimeRunbookRemediationReplayScheduleTrigger(
    config: RuntimeRunbookRemediationReplayScheduleConfig,
    previewSummary: Awaited<ReturnType<typeof replayRuntimeRunbookRemediationEvents>>['summary']
): {
    shouldRun: boolean;
    reason: string;
} {
    const plannedReplayChecks = Math.max(0, Math.floor(Number(previewSummary?.plannedReplayChecks || 0)));
    if (plannedReplayChecks <= 0) {
        return {
            shouldRun: false,
            reason: 'no_planned_replay_checks',
        };
    }
    const maxPlannedRiskRatioPct = Number(Number(previewSummary?.maxPlannedRiskRatioPct || 0).toFixed(4));
    const maxPlannedRiskStreak = Math.max(0, Math.floor(Number(previewSummary?.maxPlannedRiskStreak || 0)));
    if (config.triggerPolicy === 'risk_ratio_threshold') {
        const shouldRun = maxPlannedRiskRatioPct >= config.triggerMinRiskRatioPct;
        return {
            shouldRun,
            reason: shouldRun
                ? `risk_ratio_threshold_met:${maxPlannedRiskRatioPct.toFixed(2)}>=${config.triggerMinRiskRatioPct.toFixed(2)}`
                : `risk_ratio_threshold_not_met:${maxPlannedRiskRatioPct.toFixed(2)}<${config.triggerMinRiskRatioPct.toFixed(2)}`,
        };
    }
    if (config.triggerPolicy === 'risk_streak_threshold') {
        const shouldRun = maxPlannedRiskStreak >= config.triggerMinRiskStreak;
        return {
            shouldRun,
            reason: shouldRun
                ? `risk_streak_threshold_met:${maxPlannedRiskStreak}>=${config.triggerMinRiskStreak}`
                : `risk_streak_threshold_not_met:${maxPlannedRiskStreak}<${config.triggerMinRiskStreak}`,
        };
    }
    if (config.triggerPolicy === 'risk_ratio_or_streak') {
        const ratioSatisfied = maxPlannedRiskRatioPct >= config.triggerMinRiskRatioPct;
        const streakSatisfied = maxPlannedRiskStreak >= config.triggerMinRiskStreak;
        const shouldRun = ratioSatisfied || streakSatisfied;
        return {
            shouldRun,
            reason: shouldRun
                ? `risk_ratio_or_streak_met:ratio=${ratioSatisfied ? 'yes' : 'no'},streak=${streakSatisfied ? 'yes' : 'no'}`
                : `risk_ratio_or_streak_not_met:${maxPlannedRiskRatioPct.toFixed(2)}<${config.triggerMinRiskRatioPct.toFixed(2)}&&${maxPlannedRiskStreak}<${config.triggerMinRiskStreak}`,
        };
    }
    return {
        shouldRun: true,
        reason: 'trigger_policy_always',
    };
}

async function tickRuntimeRunbookRemediationReplaySchedule(input: {
    force: boolean;
    dryRunOverride: boolean | null;
    actor: string;
}): Promise<{
    decision: string;
    reason: string;
    forced: boolean;
    actor: string;
    executed: boolean;
    dryRun: boolean;
    previewSummary: Awaited<ReturnType<typeof replayRuntimeRunbookRemediationEvents>>['summary'] | null;
    replayResult: Awaited<ReturnType<typeof replayRuntimeRunbookRemediationEvents>> | null;
    snapshot: RuntimeRunbookRemediationReplayScheduleSnapshot;
}> {
    const actor = String(input.actor || 'manual').trim().slice(0, 64) || 'manual';
    const forced = input.force === true;
    const previousEvaluatedAt = runtimeRunbookRemediationReplayScheduleState.lastEvaluatedAt;
    const now = new Date();
    const nowIso = now.toISOString();
    runtimeRunbookRemediationReplayScheduleState.lastEvaluatedAt = nowIso;
    runtimeRunbookRemediationReplayScheduleState.lastError = '';
    const setAutoExecutionTelemetry = (options: {
        eligible: boolean;
        blockedReasons?: string[];
        decision: string;
        markAttempted?: boolean;
        markExecuted?: boolean;
    }): void => {
        runtimeRunbookRemediationReplayScheduleState.autoExecutionEligible = options.eligible === true;
        runtimeRunbookRemediationReplayScheduleState.autoExecutionBlockedReasons = Array.from(new Set(
            (Array.isArray(options.blockedReasons) ? options.blockedReasons : [])
                .map((item) => sanitizeRuntimeRunbookRemediationReplayScheduleAutoExecutionBlockedReason(item))
                .filter(Boolean)
        )).slice(0, 6);
        runtimeRunbookRemediationReplayScheduleState.autoExecutionDecision = String(options.decision || 'idle')
            .trim()
            .slice(0, 96);
        if (options.markAttempted === true) {
            runtimeRunbookRemediationReplayScheduleState.autoExecutionLastAttemptedAt = nowIso;
        }
        if (options.markExecuted === true) {
            runtimeRunbookRemediationReplayScheduleState.autoExecutionLastExecutedAt = nowIso;
        }
    };

    const config = cloneRuntimeRunbookRemediationReplayScheduleConfig(
        runtimeRunbookRemediationReplayScheduleState.config
    );

    if (!config.enabled) {
        runtimeRunbookRemediationReplayScheduleState.lastJitterDelaySeconds = 0;
        runtimeRunbookRemediationReplayScheduleState.effectiveIntervalSeconds =
            Math.max(0, config.intervalMinutes * 60);
        refreshRuntimeRunbookRemediationReplayScheduleBudgetTelemetry(now, config);
        refreshRuntimeRunbookRemediationReplayScheduleCooldownTelemetry(now, config);
        runtimeRunbookRemediationReplayScheduleState.lastDecision = 'skipped_disabled';
        runtimeRunbookRemediationReplayScheduleState.lastReason = 'schedule_disabled';
        setAutoExecutionTelemetry({
            eligible: false,
            blockedReasons: ['schedule_disabled'],
            decision: 'auto_execution_blocked',
        });
        runtimeRunbookRemediationReplayScheduleState.consecutiveSkips += 1;
        return {
            decision: 'skipped_disabled',
            reason: 'schedule_disabled',
            forced,
            actor,
            executed: false,
            dryRun: config.replayOptions.replayDryRun === true,
            previewSummary: null,
            replayResult: null,
            snapshot: getRuntimeRunbookRemediationReplayScheduleSnapshot(),
        };
    }

    const intervalMs = config.intervalMinutes * 60 * 1000;
    const jitterMs = resolveRuntimeRunbookRemediationReplayScheduleJitterMs({
        seed: `${previousEvaluatedAt || nowIso}:${actor}:${config.intervalMinutes}:${config.intervalJitterPct}`,
        intervalMs,
        intervalJitterPct: config.intervalJitterPct,
    });
    const effectiveIntervalMs = intervalMs + jitterMs;
    runtimeRunbookRemediationReplayScheduleState.lastJitterDelaySeconds = Math.ceil(jitterMs / 1000);
    runtimeRunbookRemediationReplayScheduleState.effectiveIntervalSeconds =
        Math.ceil(effectiveIntervalMs / 1000);
    let budgetSnapshot = refreshRuntimeRunbookRemediationReplayScheduleBudgetTelemetry(now, config);
    const cooldownRemainingSeconds = refreshRuntimeRunbookRemediationReplayScheduleCooldownTelemetry(
        now,
        config
    );
    if (!forced && cooldownRemainingSeconds > 0) {
        const reason = `cooldown_active:${cooldownRemainingSeconds}s`;
        runtimeRunbookRemediationReplayScheduleState.lastDecision = 'skipped_cooldown';
        runtimeRunbookRemediationReplayScheduleState.lastReason = reason;
        setAutoExecutionTelemetry({
            eligible: false,
            blockedReasons: [reason],
            decision: 'auto_execution_blocked',
        });
        runtimeRunbookRemediationReplayScheduleState.consecutiveSkips += 1;
        return {
            decision: 'skipped_cooldown',
            reason,
            forced,
            actor,
            executed: false,
            dryRun: config.replayOptions.replayDryRun === true,
            previewSummary: null,
            replayResult: null,
            snapshot: getRuntimeRunbookRemediationReplayScheduleSnapshot(),
        };
    }

    const previousEvaluatedMs = Date.parse(previousEvaluatedAt || '');
    if (
        !forced
        && Number.isFinite(previousEvaluatedMs)
        && previousEvaluatedMs > 0
        && (now.getTime() - previousEvaluatedMs) < effectiveIntervalMs
    ) {
        const remainingMs = Math.max(0, (previousEvaluatedMs + effectiveIntervalMs) - now.getTime());
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const reason = `interval_not_due:${remainingSeconds}s,jitter=${Math.ceil(jitterMs / 1000)}s`;
        runtimeRunbookRemediationReplayScheduleState.lastDecision = 'skipped_interval';
        runtimeRunbookRemediationReplayScheduleState.lastReason = reason;
        setAutoExecutionTelemetry({
            eligible: false,
            blockedReasons: [reason],
            decision: 'auto_execution_blocked',
        });
        runtimeRunbookRemediationReplayScheduleState.consecutiveSkips += 1;
        return {
            decision: 'skipped_interval',
            reason,
            forced,
            actor,
            executed: false,
            dryRun: config.replayOptions.replayDryRun === true,
            previewSummary: null,
            replayResult: null,
            snapshot: getRuntimeRunbookRemediationReplayScheduleSnapshot(),
        };
    }

    try {
        const previewResult = await replayRuntimeRunbookRemediationEvents({
            ...config.replayOptions,
            replayDryRun: true,
        });
        const previewSummary = previewResult.summary;
        const previousDecision = String(runtimeRunbookRemediationReplayScheduleState.lastDecision || '');
        const previousOutcome = runtimeRunbookRemediationReplayScheduleState.lastOutcome;
        const previewOutcome = resolveRuntimeRunbookRemediationReplayScheduleOutcome(previewSummary);
        const triggerDecision = evaluateRuntimeRunbookRemediationReplayScheduleTrigger(
            config,
            previewSummary
        );
        runtimeRunbookRemediationReplayScheduleState.lastOutcome = previewOutcome;
        if (!triggerDecision.shouldRun) {
            runtimeRunbookRemediationReplayScheduleState.lastDecision = 'skipped_trigger';
            runtimeRunbookRemediationReplayScheduleState.lastReason = triggerDecision.reason;
            setAutoExecutionTelemetry({
                eligible: false,
                blockedReasons: [triggerDecision.reason],
                decision: 'auto_execution_blocked',
            });
            runtimeRunbookRemediationReplayScheduleState.consecutiveSkips += 1;
            return {
                decision: 'skipped_trigger',
                reason: triggerDecision.reason,
                forced,
                actor,
                executed: false,
                dryRun: config.replayOptions.replayDryRun === true,
                previewSummary,
                replayResult: null,
                snapshot: getRuntimeRunbookRemediationReplayScheduleSnapshot(),
            };
        }

        const plannedReplayChecks = Math.max(
            0,
            Math.floor(Number(previewSummary?.plannedReplayChecks || 0))
        );
        if (plannedReplayChecks > budgetSnapshot.remainingWindowReplayChecks) {
            const reason = `replay_budget_exceeded:planned=${plannedReplayChecks},remaining=${budgetSnapshot.remainingWindowReplayChecks},window=${config.replayBudgetWindowMinutes}m,max=${config.maxReplayChecksPerWindow}`;
            runtimeRunbookRemediationReplayScheduleState.lastDecision = 'skipped_budget';
            runtimeRunbookRemediationReplayScheduleState.lastReason = reason;
            setAutoExecutionTelemetry({
                eligible: false,
                blockedReasons: [reason],
                decision: 'auto_execution_blocked',
            });
            runtimeRunbookRemediationReplayScheduleState.consecutiveSkips += 1;
            return {
                decision: 'skipped_budget',
                reason,
                forced,
                actor,
                executed: false,
                dryRun: config.replayOptions.replayDryRun === true,
                previewSummary,
                replayResult: null,
                snapshot: getRuntimeRunbookRemediationReplayScheduleSnapshot(),
            };
        }

        const dryRunOverrideProvided = typeof input.dryRunOverride === 'boolean';
        const dryRun = dryRunOverrideProvided
            ? input.dryRunOverride === true
            : (config.replayOptions.replayDryRun === true);
        const autoExecutionRequested = !dryRun && !dryRunOverrideProvided;
        if (autoExecutionRequested) {
            const autoExecutionEligibility =
                evaluateRuntimeRunbookRemediationReplayScheduleAutoExecutionEligibility({
                    config,
                    consecutiveSkips: runtimeRunbookRemediationReplayScheduleState.consecutiveSkips,
                    cooldownRemainingSeconds,
                    remainingWindowReplayChecks: budgetSnapshot.remainingWindowReplayChecks,
                    previousDecision,
                    previousOutcome,
                    previewOutcome,
                });
            if (!autoExecutionEligibility.eligible) {
                const blockedReasonSummary = autoExecutionEligibility.blockedReasons.join('|') || 'blocked';
                const decision = autoExecutionEligibility.blockedReasons.includes('dry_run_parity_missing')
                    ? 'auto_execution_dry_run_required'
                    : 'auto_execution_blocked';
                const reason = `${decision}:${blockedReasonSummary}`;
                runtimeRunbookRemediationReplayScheduleState.lastDecision = decision;
                runtimeRunbookRemediationReplayScheduleState.lastReason = reason;
                setAutoExecutionTelemetry({
                    eligible: false,
                    blockedReasons: autoExecutionEligibility.blockedReasons,
                    decision,
                    markAttempted: true,
                });
                runtimeRunbookRemediationReplayScheduleState.consecutiveSkips += 1;
                return {
                    decision,
                    reason,
                    forced,
                    actor,
                    executed: false,
                    dryRun: false,
                    previewSummary,
                    replayResult: null,
                    snapshot: getRuntimeRunbookRemediationReplayScheduleSnapshot(),
                };
            }
            setAutoExecutionTelemetry({
                eligible: true,
                blockedReasons: [],
                decision: 'auto_execution_ready',
                markAttempted: true,
            });
        } else if (dryRunOverrideProvided) {
            setAutoExecutionTelemetry({
                eligible: false,
                blockedReasons: [dryRun ? 'manual_override_dry_run' : 'manual_override_non_dry_run'],
                decision: dryRun ? 'manual_override_dry_run' : 'manual_override_non_dry_run',
                markAttempted: true,
            });
        } else {
            setAutoExecutionTelemetry({
                eligible: false,
                blockedReasons: [config.autoExecution.enabled ? 'dry_run_active' : 'auto_execution_disabled'],
                decision: dryRun ? 'dry_run_active' : 'auto_execution_not_requested',
                markAttempted: true,
            });
        }
        const replayResult = dryRun
            ? previewResult
            : await replayRuntimeRunbookRemediationEvents({
                ...config.replayOptions,
                replayDryRun: false,
            });
        runtimeRunbookRemediationReplayScheduleState.lastTriggeredAt = nowIso;
        runtimeRunbookRemediationReplayScheduleState.lastDecision = dryRun
            ? 'executed_dry_run'
            : (autoExecutionRequested ? 'auto_execution_executed' : 'executed');
        runtimeRunbookRemediationReplayScheduleState.lastReason = dryRun
            ? triggerDecision.reason
            : (
                autoExecutionRequested
                    ? `${triggerDecision.reason},mode=${config.autoExecution.mode}`
                    : triggerDecision.reason
            );
        runtimeRunbookRemediationReplayScheduleState.lastError = '';
        runtimeRunbookRemediationReplayScheduleState.consecutiveSkips = 0;
        if (autoExecutionRequested && !dryRun) {
            setAutoExecutionTelemetry({
                eligible: true,
                blockedReasons: [],
                decision: 'auto_execution_executed',
                markAttempted: true,
                markExecuted: true,
            });
        } else if (!dryRun) {
            setAutoExecutionTelemetry({
                eligible: false,
                blockedReasons: ['manual_execution'],
                decision: 'manual_execution',
                markAttempted: true,
                markExecuted: true,
            });
        } else {
            setAutoExecutionTelemetry({
                eligible: false,
                blockedReasons: [config.autoExecution.enabled ? 'dry_run_active' : 'auto_execution_disabled'],
                decision: 'dry_run_active',
                markAttempted: true,
            });
        }
        const executedReplayChecks = Math.max(
            0,
            Math.floor(
                Number(
                    replayResult?.summary?.plannedReplayChecks
                    ?? replayResult?.summary?.replayedChecks
                    ?? plannedReplayChecks
                )
            )
        );
        runtimeRunbookRemediationReplayScheduleState.executionWindowRecords.push({
            executedAt: nowIso,
            replayChecks: executedReplayChecks,
            dryRun,
        });
        refreshRuntimeRunbookRemediationReplayScheduleBudgetTelemetry(now, config);
        refreshRuntimeRunbookRemediationReplayScheduleCooldownTelemetry(now, config);
        runtimeRunbookRemediationReplayScheduleState.lastOutcome =
            resolveRuntimeRunbookRemediationReplayScheduleOutcome(replayResult.summary);
        return {
            decision: runtimeRunbookRemediationReplayScheduleState.lastDecision,
            reason: triggerDecision.reason,
            forced,
            actor,
            executed: true,
            dryRun,
            previewSummary,
            replayResult,
            snapshot: getRuntimeRunbookRemediationReplayScheduleSnapshot(),
        };
    } catch (error) {
        const message = String(error instanceof Error ? error.message : error || 'unknown_error')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 280);
        runtimeRunbookRemediationReplayScheduleState.lastDecision = 'error';
        runtimeRunbookRemediationReplayScheduleState.lastReason = `schedule_tick_error:${message || 'unknown'}`;
        runtimeRunbookRemediationReplayScheduleState.lastError = message;
        setAutoExecutionTelemetry({
            eligible: false,
            blockedReasons: ['schedule_tick_error'],
            decision: 'auto_execution_blocked',
            markAttempted: true,
        });
        runtimeRunbookRemediationReplayScheduleState.consecutiveSkips += 1;
        refreshRuntimeRunbookRemediationReplayScheduleBudgetTelemetry(now, config);
        refreshRuntimeRunbookRemediationReplayScheduleCooldownTelemetry(now, config);
        return {
            decision: 'error',
            reason: runtimeRunbookRemediationReplayScheduleState.lastReason,
            forced,
            actor,
            executed: false,
            dryRun: config.replayOptions.replayDryRun === true,
            previewSummary: null,
            replayResult: null,
            snapshot: getRuntimeRunbookRemediationReplayScheduleSnapshot(),
        };
    }
}

function triggerRuntimeRunbookRemediationReplayScheduleFromEvent(): void {
    void tickRuntimeRunbookRemediationReplaySchedule({
        force: false,
        dryRunOverride: null,
        actor: 'remediation_event',
    });
}

function queryRuntimeRunbookVerificationHistory(options: RuntimeRunbookVerificationHistoryQueryOptions): {
    summary: {
        totalRecords: number;
        matchedRecords: number;
        returnedRecords: number;
        checkId: string;
        sinceMinutes: number;
        status: RuntimeRunbookVerificationStatus | '';
        statusCounts: Record<RuntimeRunbookVerificationStatus, number>;
        activeRiskStreak: number;
        activeFailStreak: number;
        averageErrorRatioPct: number;
        averageP95DurationMs: number;
        latestVerifiedAt: string;
        trendStatus: RuntimeRunbookVerificationHistoryTrendStatus;
        trendWindowSize: number;
        recentAverageSeverity: number;
        previousAverageSeverity: number;
        severityDelta: number;
        recentAverageErrorRatioPct: number;
        previousAverageErrorRatioPct: number;
        errorRatioDeltaPct: number;
        recentAverageP95DurationMs: number;
        previousAverageP95DurationMs: number;
        p95DurationDeltaMs: number;
    };
    records: RuntimeRunbookVerificationHistoryRecord[];
} {
    const filtered = filterRuntimeRunbookVerificationHistoryRecords({
        checkId: options.checkId,
        sinceMinutes: options.sinceMinutes,
        status: options.status,
    });
    const matchedRecords = filtered.length;
    const records = filtered.slice(0, options.limit);
    const statusCounts = records.reduce((summary, record) => {
        const status = record.status;
        summary[status] += 1;
        return summary;
    }, {
        pass: 0,
        warn: 0,
        fail: 0,
        unknown: 0,
    } as Record<RuntimeRunbookVerificationStatus, number>);
    const averageErrorRatioPct = records.length > 0
        ? Number((
            records.reduce((sum, record) => sum + Number(record?.traceSummary?.errorRatioPct || 0), 0)
            / records.length
        ).toFixed(4))
        : 0;
    const averageP95DurationMs = records.length > 0
        ? Number((
            records.reduce((sum, record) => sum + Number(record?.traceSummary?.p95DurationMs || 0), 0)
            / records.length
        ).toFixed(4))
        : 0;
    const activeRiskStreak = computeRuntimeRunbookVerificationStatusStreak(
        records,
        isRuntimeRunbookVerificationRiskStatus
    );
    const activeFailStreak = computeRuntimeRunbookVerificationStatusStreak(
        records,
        (status) => status === 'fail'
    );
    const trend = computeRuntimeRunbookVerificationHistoryTrend(records);
    return {
        summary: {
            totalRecords: runtimeRunbookVerificationHistoryRecords.length,
            matchedRecords,
            returnedRecords: records.length,
            checkId: options.checkId,
            sinceMinutes: options.sinceMinutes,
            status: options.status,
            statusCounts,
            activeRiskStreak,
            activeFailStreak,
            averageErrorRatioPct,
            averageP95DurationMs,
            latestVerifiedAt: String(records[0]?.verifiedAt || ''),
            trendStatus: trend.trendStatus,
            trendWindowSize: trend.trendWindowSize,
            recentAverageSeverity: trend.recentAverageSeverity,
            previousAverageSeverity: trend.previousAverageSeverity,
            severityDelta: trend.severityDelta,
            recentAverageErrorRatioPct: trend.recentAverageErrorRatioPct,
            previousAverageErrorRatioPct: trend.previousAverageErrorRatioPct,
            errorRatioDeltaPct: trend.errorRatioDeltaPct,
            recentAverageP95DurationMs: trend.recentAverageP95DurationMs,
            previousAverageP95DurationMs: trend.previousAverageP95DurationMs,
            p95DurationDeltaMs: trend.p95DurationDeltaMs,
        },
        records,
    };
}

function queryRuntimeRunbookVerificationHistoryByCheck(
    options: RuntimeRunbookVerificationHistoryByCheckQueryOptions
): {
    summary: {
        totalRecords: number;
        matchedRecords: number;
        returnedChecks: number;
        sinceMinutes: number;
        status: RuntimeRunbookVerificationStatus | '';
        checkQuery: string;
        regressingChecks: number;
        improvingChecks: number;
        stableChecks: number;
        insufficientDataChecks: number;
        recommendedFocusCheckId: string;
        recommendedFocusLatestStatus: RuntimeRunbookVerificationStatus | '';
        recommendedFocusTrendStatus: RuntimeRunbookVerificationHistoryTrendStatus | '';
        recommendedFocusReason: string;
        recommendedFocusEscalation: RuntimeRunbookVerificationEscalation | '';
        recommendedFocusTopAction: string;
        actionQueueTotal: number;
        actionQueueP0: number;
        actionQueueP1: number;
        actionQueueP2: number;
        dynamicModeAlignmentRecords: number;
        dynamicModeAlignmentLatestStatus: RuntimeRunbookVerificationStatus | '';
        dynamicModeAlignmentConflictStreak: number;
        dynamicModeAlignmentFailStreak: number;
        pathStrategyAlignmentRecords: number;
        pathStrategyAlignmentLatestStatus: RuntimeRunbookVerificationStatus | '';
        pathStrategyAlignmentConflictStreak: number;
        pathStrategyAlignmentFailStreak: number;
        remediationRecords: number;
        remediationChecksWithEvents: number;
        remediationChecksRegressing: number;
        remediationChecksImproving: number;
        remediationChecksStable: number;
        remediationChecksInsufficientData: number;
        remediationAppliedRatioPct: number;
        remediationCooldownRatioPct: number;
        remediationErrorRatioPct: number;
        remediationRiskRatioPct: number;
        remediationLatestRecordedAt: string;
        recommendedFocusRemediationStatus: RuntimeRunbookRemediationEventStatus | '';
        recommendedFocusRemediationTrendStatus: RuntimeRunbookRemediationEventTrendStatus | '';
        queryVectorAccelerationCircuitBudget: RuntimeRunbookVectorAccelerationCircuitBudgetSummary | null;
        queryVectorAccelerationIndexSyncHealth: RuntimeRunbookVectorAccelerationIndexSyncHealthSummary | null;
        queryVectorAccelerationTraceability: RuntimeRunbookVectorAccelerationTraceabilitySummary | null;
        queryVectorAccelerationPrefilter: RuntimeRunbookVectorAccelerationPrefilterSummary | null;
        queryVectorAccelerationCalibrationReadiness: RuntimeRunbookVectorAccelerationCalibrationReadinessSummary | null;
        generatedAt: string;
    };
    checks: Array<{
        checkId: string;
        records: number;
        latestVerifiedAt: string;
        latestStatus: RuntimeRunbookVerificationStatus;
        statusCounts: Record<RuntimeRunbookVerificationStatus, number>;
        activeRiskStreak: number;
        activeFailStreak: number;
        averageErrorRatioPct: number;
        averageP95DurationMs: number;
        trendStatus: RuntimeRunbookVerificationHistoryTrendStatus;
        trendWindowSize: number;
        severityDelta: number;
        errorRatioDeltaPct: number;
        p95DurationDeltaMs: number;
        topRiskMatchRatioPct: number;
        latestEscalation: RuntimeRunbookVerificationEscalation;
        escalationActionItems: RuntimeRunbookEscalationActionItem[];
        escalationActions: string[];
        remediation: RuntimeRunbookRemediationCheckSummary;
        queryVectorAccelerationCircuitBudget: RuntimeRunbookVectorAccelerationCircuitBudgetSummary | null;
        queryVectorAccelerationIndexSyncHealth: RuntimeRunbookVectorAccelerationIndexSyncHealthSummary | null;
        queryVectorAccelerationTraceability: RuntimeRunbookVectorAccelerationTraceabilitySummary | null;
        queryVectorAccelerationPrefilter: RuntimeRunbookVectorAccelerationPrefilterSummary | null;
        queryVectorAccelerationCalibrationReadiness: RuntimeRunbookVectorAccelerationCalibrationReadinessSummary | null;
    }>;
    actionQueue: RuntimeRunbookCheckActionQueueItem[];
} {
    const filtered = filterRuntimeRunbookVerificationHistoryRecords({
        sinceMinutes: options.sinceMinutes,
        status: options.status,
        checkQuery: options.checkQuery,
    });
    const grouped = new Map<string, RuntimeRunbookVerificationHistoryRecord[]>();
    filtered.forEach((record) => {
        const checkId = normalizeRuntimeRunbookCheckIdToken(record.checkId) || 'unknown_check';
        const bucket = grouped.get(checkId);
        if (bucket) {
            bucket.push(record);
            return;
        }
        grouped.set(checkId, [record]);
    });
    const queryVectorAccelerationCircuitBudget = buildRuntimeRunbookVectorAccelerationCircuitBudgetSummary(
        options.runtimeCapabilityMatrix
    );
    const queryVectorAccelerationIndexSyncHealth = buildRuntimeRunbookVectorAccelerationIndexSyncHealthSummary(
        options.runtimeCapabilityMatrix
    );
    const queryVectorAccelerationTraceability = buildRuntimeRunbookVectorAccelerationTraceabilitySummary(
        options.runtimeCapabilityMatrix
    );
    const queryVectorAccelerationPrefilter = buildRuntimeRunbookVectorAccelerationPrefilterSummary(
        options.runtimeCapabilityMatrix
    );
    const queryVectorAccelerationCalibrationReadiness = buildRuntimeRunbookVectorAccelerationCalibrationReadinessSummary(
        options.runtimeCapabilityMatrix
    );

    const checks = Array.from(grouped.entries()).map(([checkId, records]) => {
        const statusCounts = records.reduce((summary, record) => {
            summary[record.status] += 1;
            return summary;
        }, {
            pass: 0,
            warn: 0,
            fail: 0,
            unknown: 0,
        } as Record<RuntimeRunbookVerificationStatus, number>);
        const activeRiskStreak = computeRuntimeRunbookVerificationStatusStreak(
            records,
            isRuntimeRunbookVerificationRiskStatus
        );
        const activeFailStreak = computeRuntimeRunbookVerificationStatusStreak(
            records,
            (status) => status === 'fail'
        );
        const averageErrorRatioPct = Number((
            records.reduce((sum, record) => sum + Number(record?.traceSummary?.errorRatioPct || 0), 0)
            / records.length
        ).toFixed(4));
        const averageP95DurationMs = Number((
            records.reduce((sum, record) => sum + Number(record?.traceSummary?.p95DurationMs || 0), 0)
            / records.length
        ).toFixed(4));
        const trend = computeRuntimeRunbookVerificationHistoryTrend(records);
        const topRiskHitCount = records.reduce((sum, record) => {
            const topRiskCheckId = normalizeRuntimeRunbookCheckIdToken(record.topRiskCheckId);
            return sum + (topRiskCheckId && topRiskCheckId === checkId ? 1 : 0);
        }, 0);
        const latestStatus = records[0]?.status || 'unknown';
        const latestEscalation = resolveRuntimeRunbookVerificationEscalation(
            latestStatus,
            activeRiskStreak,
            activeFailStreak,
            checkId
        );
        const isDynamicModeAlignmentCheck = checkId === 'tutor_routing_dynamic_mode_alignment';
        const isPathStrategyAlignmentCheck = checkId === 'orchestration_path_strategy_alignment';
        const dynamicModeConflictPersistent = isDynamicModeAlignmentCheck
            && activeRiskStreak >= 2
            && isRuntimeRunbookVerificationRiskStatus(latestStatus || 'unknown');
        const pathStrategyConflictPersistent = isPathStrategyAlignmentCheck
            && activeRiskStreak >= 2
            && isRuntimeRunbookVerificationRiskStatus(latestStatus || 'unknown');
        const escalationActionItems = resolveRuntimeRunbookVerificationEscalationActionItems({
            selectedCheckId: checkId,
            selectedCheckStatus: latestStatus,
            selectedCheckEscalation: latestEscalation,
            selectedCheckHistory: {
                returnedRecords: records.length,
                sinceMinutes: options.sinceMinutes,
                activeRiskStreak,
                activeFailStreak,
                trendStatus: trend.trendStatus,
            },
            dynamicModeAlignment: {
                conflictPersistent: dynamicModeConflictPersistent,
                conflictStreak: isDynamicModeAlignmentCheck ? activeRiskStreak : 0,
                failStreak: isDynamicModeAlignmentCheck ? activeFailStreak : 0,
                recommendedFocusCheckId: '',
                recommendedFocusReason: 'none',
            },
            pathStrategyAlignment: {
                conflictPersistent: pathStrategyConflictPersistent,
                conflictStreak: isPathStrategyAlignmentCheck ? activeRiskStreak : 0,
                failStreak: isPathStrategyAlignmentCheck ? activeFailStreak : 0,
                recommendedFocusCheckId: '',
                recommendedFocusReason: 'none',
            },
            verificationTargets: [],
        });
        const escalationActions = escalationActionItems
            .map((item) => String(item?.instruction || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(0, 4);
        const remediation = queryRuntimeRunbookRemediationEventCheckSummary({
            checkId,
            sinceMinutes: options.sinceMinutes,
            source: '',
            limit: 200,
        });
        return {
            checkId,
            records: records.length,
            latestVerifiedAt: String(records[0]?.verifiedAt || ''),
            latestStatus,
            statusCounts,
            activeRiskStreak,
            activeFailStreak,
            averageErrorRatioPct,
            averageP95DurationMs,
            trendStatus: trend.trendStatus,
            trendWindowSize: trend.trendWindowSize,
            severityDelta: trend.severityDelta,
            errorRatioDeltaPct: trend.errorRatioDeltaPct,
            p95DurationDeltaMs: trend.p95DurationDeltaMs,
            topRiskMatchRatioPct: Number(((topRiskHitCount / records.length) * 100).toFixed(2)),
            latestEscalation,
            escalationActionItems,
            escalationActions,
            remediation,
            queryVectorAccelerationCircuitBudget: checkId === 'query_vector_acceleration_circuit_state'
                ? queryVectorAccelerationCircuitBudget
                : null,
            queryVectorAccelerationIndexSyncHealth: checkId === 'query_vector_acceleration_index_sync_health'
                ? queryVectorAccelerationIndexSyncHealth
                : null,
            queryVectorAccelerationTraceability: checkId === 'query_vector_acceleration_traceability'
                ? queryVectorAccelerationTraceability
                : null,
            queryVectorAccelerationPrefilter: checkId === 'query_vector_acceleration_prefilter_effectiveness'
                ? queryVectorAccelerationPrefilter
                : null,
            queryVectorAccelerationCalibrationReadiness: checkId === 'query_vector_acceleration_calibration_readiness'
                ? queryVectorAccelerationCalibrationReadiness
                : null,
        };
    });

    const getTrendRank = (trendStatus: RuntimeRunbookVerificationHistoryTrendStatus): number => {
        if (trendStatus === 'regressing') {
            return 4;
        }
        if (trendStatus === 'stable') {
            return 3;
        }
        if (trendStatus === 'improving') {
            return 2;
        }
        return 1;
    };
    checks.sort((left, right) => {
        const trendRankDiff = getTrendRank(right.trendStatus) - getTrendRank(left.trendStatus);
        if (trendRankDiff !== 0) {
            return trendRankDiff;
        }
        const statusRankDiff = getRuntimeRunbookVerificationStatusSeverity(right.latestStatus)
            - getRuntimeRunbookVerificationStatusSeverity(left.latestStatus);
        if (statusRankDiff !== 0) {
            return statusRankDiff;
        }
        const recordsDiff = right.records - left.records;
        if (recordsDiff !== 0) {
            return recordsDiff;
        }
        const errorRatioDiff = right.averageErrorRatioPct - left.averageErrorRatioPct;
        if (errorRatioDiff !== 0) {
            return errorRatioDiff;
        }
        return left.checkId.localeCompare(right.checkId);
    });

    const limitedChecks = checks.slice(0, options.limit);
    const recommendedFocusFromRiskRanking = (
        limitedChecks.find((item) => (
            item.trendStatus === 'regressing'
            && (item.latestStatus === 'fail' || item.latestStatus === 'warn')
        ))
        || limitedChecks.find((item) => item.trendStatus === 'regressing')
        || limitedChecks.find((item) => item.latestStatus === 'fail' || item.latestStatus === 'warn')
        || limitedChecks[0]
        || null
    );
    const dynamicModeAlignmentCheck = checks.find(
        (item) => item.checkId === 'tutor_routing_dynamic_mode_alignment'
    ) || null;
    const pathStrategyAlignmentCheck = checks.find(
        (item) => item.checkId === 'orchestration_path_strategy_alignment'
    ) || null;
    const dynamicModeAlignmentConflictStreak = Math.max(
        0,
        Math.floor(Number(dynamicModeAlignmentCheck?.activeRiskStreak || 0))
    );
    const pathStrategyAlignmentConflictStreak = Math.max(
        0,
        Math.floor(Number(pathStrategyAlignmentCheck?.activeRiskStreak || 0))
    );
    const dynamicModeAlignmentShouldOverrideFocus = Boolean(
        dynamicModeAlignmentCheck
        && dynamicModeAlignmentConflictStreak >= 2
        && isRuntimeRunbookVerificationRiskStatus(dynamicModeAlignmentCheck.latestStatus || 'unknown')
    );
    const pathStrategyAlignmentShouldOverrideFocus = Boolean(
        pathStrategyAlignmentCheck
        && pathStrategyAlignmentConflictStreak >= 2
        && isRuntimeRunbookVerificationRiskStatus(pathStrategyAlignmentCheck.latestStatus || 'unknown')
    );
    const overrideCandidates: Array<{
        check: typeof checks[number];
        reason: string;
    }> = [];
    if (dynamicModeAlignmentShouldOverrideFocus && dynamicModeAlignmentCheck) {
        overrideCandidates.push({
            check: dynamicModeAlignmentCheck,
            reason: 'dynamic_mode_alignment_conflict_streak',
        });
    }
    if (pathStrategyAlignmentShouldOverrideFocus && pathStrategyAlignmentCheck) {
        overrideCandidates.push({
            check: pathStrategyAlignmentCheck,
            reason: 'path_strategy_alignment_conflict_streak',
        });
    }
    overrideCandidates.sort((left, right) => {
        const statusRankDiff = getRuntimeRunbookVerificationStatusSeverity(right.check.latestStatus)
            - getRuntimeRunbookVerificationStatusSeverity(left.check.latestStatus);
        if (statusRankDiff !== 0) {
            return statusRankDiff;
        }
        const riskStreakDiff = right.check.activeRiskStreak - left.check.activeRiskStreak;
        if (riskStreakDiff !== 0) {
            return riskStreakDiff;
        }
        const failStreakDiff = right.check.activeFailStreak - left.check.activeFailStreak;
        if (failStreakDiff !== 0) {
            return failStreakDiff;
        }
        const trendRankDiff = getTrendRank(right.check.trendStatus) - getTrendRank(left.check.trendStatus);
        if (trendRankDiff !== 0) {
            return trendRankDiff;
        }
        const recordsDiff = right.check.records - left.check.records;
        if (recordsDiff !== 0) {
            return recordsDiff;
        }
        return left.check.checkId.localeCompare(right.check.checkId);
    });
    const recommendedOverride = overrideCandidates[0] || null;
    const recommendedFocus = recommendedOverride
        ? recommendedOverride.check
        : recommendedFocusFromRiskRanking;
    const recommendedFocusReason = recommendedFocus
        ? (
            recommendedOverride
                ? recommendedOverride.reason
                : (
                    recommendedFocus.trendStatus === 'regressing'
                ? 'regressing_trend'
                : (recommendedFocus.latestStatus === 'fail' || recommendedFocus.latestStatus === 'warn')
                    ? 'latest_failure_risk'
                    : 'latest_activity'
                )
        )
        : 'none';
    const recommendedFocusEscalation = recommendedFocus
        ? resolveRuntimeRunbookVerificationEscalation(
            recommendedFocus.latestStatus,
            recommendedFocus.activeRiskStreak,
            recommendedFocus.activeFailStreak,
            recommendedFocus.checkId
        )
        : '';
    const recommendedFocusTopAction = recommendedFocus
        ? String(recommendedFocus.escalationActionItems?.[0]?.instruction || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 280)
        : '';
    const actionQueue = buildRuntimeRunbookCheckActionQueue(limitedChecks);
    const actionQueueP0 = actionQueue.filter((item) => item.priority === 'p0').length;
    const actionQueueP1 = actionQueue.filter((item) => item.priority === 'p1').length;
    const actionQueueP2 = actionQueue.filter((item) => item.priority === 'p2').length;
    const remediationRecords = limitedChecks.reduce((sum, item) => (
        sum + Math.max(0, Math.floor(Number(item?.remediation?.returnedRecords || 0)))
    ), 0);
    const remediationAppliedRecords = limitedChecks.reduce((sum, item) => (
        sum + Math.max(0, Math.floor(Number(item?.remediation?.statusCounts?.applied || 0)))
    ), 0);
    const remediationCooldownRecords = limitedChecks.reduce((sum, item) => (
        sum + Math.max(0, Math.floor(Number(item?.remediation?.statusCounts?.cooldown || 0)))
    ), 0);
    const remediationErrorRecords = limitedChecks.reduce((sum, item) => (
        sum + Math.max(0, Math.floor(Number(item?.remediation?.statusCounts?.error || 0)))
    ), 0);
    const remediationNotAppliedRecords = limitedChecks.reduce((sum, item) => (
        sum + Math.max(0, Math.floor(Number(item?.remediation?.statusCounts?.not_applied || 0)))
    ), 0);
    const remediationChecksWithEvents = limitedChecks.filter(
        (item) => Number(item?.remediation?.returnedRecords || 0) > 0
    ).length;
    const remediationChecksRegressing = limitedChecks.filter(
        (item) => item?.remediation?.trendStatus === 'regressing'
    ).length;
    const remediationChecksImproving = limitedChecks.filter(
        (item) => item?.remediation?.trendStatus === 'improving'
    ).length;
    const remediationChecksStable = limitedChecks.filter(
        (item) => item?.remediation?.trendStatus === 'stable'
    ).length;
    const remediationChecksInsufficientData = limitedChecks.filter(
        (item) => item?.remediation?.trendStatus === 'insufficient_data'
    ).length;
    const remediationLatestRecordedAt = limitedChecks
        .map((item) => String(item?.remediation?.latestRecordedAt || ''))
        .filter((item) => item.length > 0)
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0]
        || '';
    const remediationRatio = (countRaw: unknown): number => {
        if (remediationRecords <= 0) {
            return 0;
        }
        return Number(((Number(countRaw || 0) / remediationRecords) * 100).toFixed(4));
    };
    const recommendedFocusRemediationStatus = recommendedFocus?.remediation?.latestStatus || '';
    const recommendedFocusRemediationTrendStatus = recommendedFocus?.remediation?.trendStatus || '';

    return {
        summary: {
            totalRecords: runtimeRunbookVerificationHistoryRecords.length,
            matchedRecords: filtered.length,
            returnedChecks: limitedChecks.length,
            sinceMinutes: options.sinceMinutes,
            status: options.status,
            checkQuery: options.checkQuery,
            regressingChecks: limitedChecks.filter((item) => item.trendStatus === 'regressing').length,
            improvingChecks: limitedChecks.filter((item) => item.trendStatus === 'improving').length,
            stableChecks: limitedChecks.filter((item) => item.trendStatus === 'stable').length,
            insufficientDataChecks: limitedChecks.filter((item) => item.trendStatus === 'insufficient_data').length,
            recommendedFocusCheckId: String(recommendedFocus?.checkId || ''),
            recommendedFocusLatestStatus: recommendedFocus?.latestStatus || '',
            recommendedFocusTrendStatus: recommendedFocus?.trendStatus || '',
            recommendedFocusReason,
            recommendedFocusEscalation,
            recommendedFocusTopAction,
            actionQueueTotal: actionQueue.length,
            actionQueueP0,
            actionQueueP1,
            actionQueueP2,
            dynamicModeAlignmentRecords: Math.max(0, Math.floor(Number(dynamicModeAlignmentCheck?.records || 0))),
            dynamicModeAlignmentLatestStatus: dynamicModeAlignmentCheck?.latestStatus || '',
            dynamicModeAlignmentConflictStreak,
            dynamicModeAlignmentFailStreak: Math.max(
                0,
                Math.floor(Number(dynamicModeAlignmentCheck?.activeFailStreak || 0))
            ),
            pathStrategyAlignmentRecords: Math.max(0, Math.floor(Number(pathStrategyAlignmentCheck?.records || 0))),
            pathStrategyAlignmentLatestStatus: pathStrategyAlignmentCheck?.latestStatus || '',
            pathStrategyAlignmentConflictStreak,
            pathStrategyAlignmentFailStreak: Math.max(
                0,
                Math.floor(Number(pathStrategyAlignmentCheck?.activeFailStreak || 0))
            ),
            remediationRecords,
            remediationChecksWithEvents,
            remediationChecksRegressing,
            remediationChecksImproving,
            remediationChecksStable,
            remediationChecksInsufficientData,
            remediationAppliedRatioPct: remediationRatio(remediationAppliedRecords),
            remediationCooldownRatioPct: remediationRatio(remediationCooldownRecords),
            remediationErrorRatioPct: remediationRatio(remediationErrorRecords),
            remediationRiskRatioPct: remediationRatio(
                remediationNotAppliedRecords
                + remediationCooldownRecords
                + remediationErrorRecords
            ),
            remediationLatestRecordedAt,
            recommendedFocusRemediationStatus,
            recommendedFocusRemediationTrendStatus,
            queryVectorAccelerationCircuitBudget,
            queryVectorAccelerationIndexSyncHealth,
            queryVectorAccelerationTraceability,
            queryVectorAccelerationPrefilter,
            queryVectorAccelerationCalibrationReadiness,
            generatedAt: new Date().toISOString(),
        },
        checks: limitedChecks,
        actionQueue,
    };
}

function queryRuntimeRunbookVerificationActionQueue(input: {
    checksQuery: RuntimeRunbookVerificationHistoryByCheckQueryOptions;
    queueLimit: number;
    priorityFilter: RuntimeRunbookActionQueuePriorityFilter;
    categoryFilter: RuntimeRunbookActionQueueCategoryFilter;
    checkIdFilter: string;
    remediationStatusFilter: RuntimeRunbookActionQueueRemediationStatusFilter;
    remediationTrendFilter: RuntimeRunbookActionQueueRemediationTrendFilter;
}): {
    summary: {
        totalRecords: number;
        matchedRecords: number;
        returnedChecks: number;
        sinceMinutes: number;
        status: RuntimeRunbookVerificationStatus | '';
        checkQuery: string;
        queueLimit: number;
        priorityFilter: RuntimeRunbookActionQueuePriorityFilter;
        categoryFilter: RuntimeRunbookActionQueueCategoryFilter;
        checkIdFilter: string;
        remediationStatusFilter: RuntimeRunbookActionQueueRemediationStatusFilter;
        remediationTrendFilter: RuntimeRunbookActionQueueRemediationTrendFilter;
        totalQueueItems: number;
        filteredQueueItems: number;
        returnedQueueItems: number;
        queueP0: number;
        queueP1: number;
        queueP2: number;
        remediationRiskQueueItems: number;
        remediationRegressingQueueItems: number;
        remediationAverageRiskRatioPct: number;
        remediationTopRiskCheckId: string;
        recommendedFocusCheckId: string;
        recommendedFocusEscalation: RuntimeRunbookVerificationEscalation | '';
        generatedAt: string;
    };
    actionQueue: RuntimeRunbookCheckActionQueueItem[];
} {
    const checksResult = queryRuntimeRunbookVerificationHistoryByCheck(input.checksQuery);
    const queueLimit = parseRuntimeRunbookVerificationActionQueueLimit(input.queueLimit);
    const priorityFilter = normalizeRuntimeRunbookVerificationActionQueuePriorityFilterToken(
        input.priorityFilter
    );
    const categoryFilter = normalizeRuntimeRunbookVerificationActionQueueCategoryFilterToken(
        input.categoryFilter
    );
    const checkIdFilter = normalizeRuntimeRunbookCheckIdToken(input.checkIdFilter);
    const remediationStatusFilter = normalizeRuntimeRunbookVerificationActionQueueRemediationStatusFilterToken(
        input.remediationStatusFilter
    );
    const remediationTrendFilter = normalizeRuntimeRunbookVerificationActionQueueRemediationTrendFilterToken(
        input.remediationTrendFilter
    );
    const actionQueueAll = Array.isArray(checksResult.actionQueue)
        ? checksResult.actionQueue
        : [];
    const actionQueueFiltered = actionQueueAll.filter((item) => {
        const itemPriority = String(item?.priority || '').trim().toLowerCase();
        const itemCategory = String(item?.category || '').trim().toLowerCase();
        const itemCheckId = normalizeRuntimeRunbookCheckIdToken(item?.checkId);
        if (priorityFilter !== 'all' && itemPriority !== priorityFilter) {
            return false;
        }
        if (categoryFilter !== 'all' && itemCategory !== categoryFilter) {
            return false;
        }
        if (checkIdFilter && itemCheckId !== checkIdFilter) {
            return false;
        }
        if (
            remediationStatusFilter !== 'all'
            && String(item?.remediationLatestStatus || '') !== remediationStatusFilter
        ) {
            return false;
        }
        if (
            remediationTrendFilter !== 'all'
            && String(item?.remediationTrendStatus || '') !== remediationTrendFilter
        ) {
            return false;
        }
        return true;
    });
    const actionQueue = actionQueueFiltered.slice(0, queueLimit);
    const queueP0 = actionQueue.filter((item) => item.priority === 'p0').length;
    const queueP1 = actionQueue.filter((item) => item.priority === 'p1').length;
    const queueP2 = actionQueue.filter((item) => item.priority === 'p2').length;
    const remediationRiskQueueItems = actionQueue.filter((item) => (
        item.remediationLatestStatus === 'error'
        || item.remediationLatestStatus === 'cooldown'
        || item.remediationLatestStatus === 'not_applied'
        || Number(item.remediationRiskRatioPct || 0) >= 50
    )).length;
    const remediationRegressingQueueItems = actionQueue.filter(
        (item) => item.remediationTrendStatus === 'regressing'
    ).length;
    const remediationAverageRiskRatioPct = actionQueue.length > 0
        ? Number((
            actionQueue.reduce((sum, item) => (
                sum + Number(item.remediationRiskRatioPct || 0)
            ), 0) / actionQueue.length
        ).toFixed(4))
        : 0;
    const remediationTopRiskCheckId = String(actionQueue[0]?.checkId || '');

    return {
        summary: {
            totalRecords: Math.max(0, Math.floor(Number(checksResult.summary?.totalRecords || 0))),
            matchedRecords: Math.max(0, Math.floor(Number(checksResult.summary?.matchedRecords || 0))),
            returnedChecks: Math.max(0, Math.floor(Number(checksResult.summary?.returnedChecks || 0))),
            sinceMinutes: Math.max(0, Math.floor(Number(checksResult.summary?.sinceMinutes || 0))),
            status: checksResult.summary?.status || '',
            checkQuery: String(checksResult.summary?.checkQuery || ''),
            queueLimit,
            priorityFilter,
            categoryFilter,
            checkIdFilter,
            remediationStatusFilter,
            remediationTrendFilter,
            totalQueueItems: actionQueueAll.length,
            filteredQueueItems: actionQueueFiltered.length,
            returnedQueueItems: actionQueue.length,
            queueP0,
            queueP1,
            queueP2,
            remediationRiskQueueItems,
            remediationRegressingQueueItems,
            remediationAverageRiskRatioPct,
            remediationTopRiskCheckId,
            recommendedFocusCheckId: String(checksResult.summary?.recommendedFocusCheckId || ''),
            recommendedFocusEscalation: (
                checksResult.summary?.recommendedFocusEscalation === 'watch'
                || checksResult.summary?.recommendedFocusEscalation === 'high'
                || checksResult.summary?.recommendedFocusEscalation === 'critical'
            )
                ? checksResult.summary.recommendedFocusEscalation
                : (checksResult.summary?.recommendedFocusEscalation === 'normal' ? 'normal' : ''),
            generatedAt: new Date().toISOString(),
        },
        actionQueue,
    };
}

function classifyApiRequestStatusBucket(statusCode: number): ApiRequestStatusBucket {
    const status = Math.floor(Number(statusCode || 0));
    if (status >= 200 && status < 300) {
        return '2xx';
    }
    if (status >= 300 && status < 400) {
        return '3xx';
    }
    if (status >= 400 && status < 500) {
        return '4xx';
    }
    if (status >= 500 && status < 600) {
        return '5xx';
    }
    return 'other';
}

function isTransientApiStatusCode(statusCodeRaw: unknown): boolean {
    const statusCode = Math.floor(Number(statusCodeRaw || 0));
    return (
        statusCode === 408
        || statusCode === 425
        || statusCode === 429
        || statusCode === 502
        || statusCode === 503
        || statusCode === 504
    );
}

function appendRuntimeApiRequestTrace(record: ApiRequestTraceRecord): void {
    runtimeApiRequestTraceRecords.unshift(record);
    if (runtimeApiRequestTraceRecords.length > API_REQUEST_TRACE_MAX_RECORDS) {
        runtimeApiRequestTraceRecords.length = API_REQUEST_TRACE_MAX_RECORDS;
    }

    runtimeApiRequestTraceTotals.totalRequests += 1;
    if (record.statusCode >= 400) {
        runtimeApiRequestTraceTotals.errorRequests += 1;
        runtimeApiRequestTraceTotals.lastErrorAt = record.finishedAt;
        runtimeApiRequestTraceTotals.lastErrorPath = record.path;
        runtimeApiRequestTraceTotals.lastErrorCode = String(record.errorCode || '').trim();
    }
    const bucket = classifyApiRequestStatusBucket(record.statusCode);
    runtimeApiRequestTraceTotals.statusBuckets[bucket] += 1;
}

function parseRuntimeRequestTraceLimit(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 40;
    }
    return Math.max(1, Math.min(200, Math.floor(numeric)));
}

function parseRuntimeRequestTraceStatusAtLeast(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(599, Math.floor(numeric)));
}

function normalizeRuntimeRequestTraceRequestId(rawValue: unknown): string {
    const normalized = String(rawValue || '').trim();
    if (!normalized) {
        return '';
    }
    return normalized.replace(/[^a-zA-Z0-9._:-]+/g, '').slice(0, 96);
}

function normalizeRuntimeRequestTraceQueryOptions(
    query: URLSearchParams | null | undefined
): RuntimeRequestTraceQueryOptions {
    const limit = parseRuntimeRequestTraceLimit(query?.get('limit'));
    const pathPrefix = String(query?.get('pathPrefix') || '').trim().slice(0, 128);
    const statusAtLeast = parseRuntimeRequestTraceStatusAtLeast(query?.get('statusAtLeast'));
    const methodRaw = String(query?.get('method') || '').trim().toUpperCase();
    const method = (/^[A-Z]+$/).test(methodRaw) ? methodRaw : '';
    const errorCode = normalizeApiErrorCodeToken(query?.get('errorCode'), '');
    const requestId = normalizeRuntimeRequestTraceRequestId(query?.get('requestId'));
    return {
        limit,
        pathPrefix,
        statusAtLeast,
        method,
        errorCode,
        requestId,
    };
}

function queryRuntimeApiRequestTrace(options: RuntimeRequestTraceQueryOptions): {
    summary: {
        totalRequests: number;
        errorRequests: number;
        errorRatioPct: number;
        trackedRecords: number;
        returnedRecords: number;
        statusBuckets: Record<ApiRequestStatusBucket, number>;
        averageDurationMs: number;
        p95DurationMs: number;
        lastErrorAt: string;
        lastErrorPath: string;
        lastErrorCode: string;
        errorCodeCounts: Record<string, number>;
        transientReturnedRequests: number;
        transientReturnedRatioPct: number;
        transientTopPaths: Array<{
            path: string;
            count: number;
        }>;
        pathPrefix: string;
        statusAtLeast: number;
        method: string;
        errorCode: string;
        requestId: string;
    };
    records: ApiRequestTraceRecord[];
} {
    const filtered = runtimeApiRequestTraceRecords.filter((record) => {
        if (options.pathPrefix && !record.path.startsWith(options.pathPrefix)) {
            return false;
        }
        if (options.statusAtLeast > 0 && record.statusCode < options.statusAtLeast) {
            return false;
        }
        if (options.method && record.method !== options.method) {
            return false;
        }
        if (options.errorCode) {
            const recordErrorCode = normalizeApiErrorCodeToken(record.errorCode, '');
            if (recordErrorCode !== options.errorCode) {
                return false;
            }
        }
        if (options.requestId && String(record.requestId || '').trim() !== options.requestId) {
            return false;
        }
        return true;
    });
    const records = filtered.slice(0, options.limit);
    const durations = records
        .map((record) => Number(record.durationMs || 0))
        .filter((duration) => Number.isFinite(duration))
        .sort((left, right) => left - right);
    const averageDurationMs = durations.length > 0
        ? Number((durations.reduce((sum, item) => sum + item, 0) / durations.length).toFixed(4))
        : 0;
    const p95DurationMs = durations.length > 0
        ? Number(durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)].toFixed(4))
        : 0;
    const errorRatioPct = runtimeApiRequestTraceTotals.totalRequests > 0
        ? Number((
            (runtimeApiRequestTraceTotals.errorRequests / runtimeApiRequestTraceTotals.totalRequests) * 100
        ).toFixed(4))
        : 0;
    const errorCodeCounts = records.reduce((summary, record) => {
        const errorCode = String(record.errorCode || '').trim();
        if (!errorCode) {
            return summary;
        }
        summary[errorCode] = (summary[errorCode] || 0) + 1;
        return summary;
    }, {} as Record<string, number>);
    const transientReturnedRequests = records.reduce((count, record) => (
        isTransientApiStatusCode(record?.statusCode) ? count + 1 : count
    ), 0);
    const transientReturnedRatioPct = records.length > 0
        ? Number(((transientReturnedRequests / records.length) * 100).toFixed(4))
        : 0;
    const transientPathCounts = records.reduce((summary, record) => {
        if (!isTransientApiStatusCode(record?.statusCode)) {
            return summary;
        }
        const method = String(record?.method || '').trim().toUpperCase();
        const path = String(record?.path || '').trim();
        const route = [method, path].filter(Boolean).join(' ');
        if (!route) {
            return summary;
        }
        summary[route] = (summary[route] || 0) + 1;
        return summary;
    }, {} as Record<string, number>);
    const transientTopPaths = Object.entries(transientPathCounts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([path, count]) => ({
            path,
            count: Math.max(0, Math.floor(Number(count || 0))),
        }));
    return {
        summary: {
            totalRequests: runtimeApiRequestTraceTotals.totalRequests,
            errorRequests: runtimeApiRequestTraceTotals.errorRequests,
            errorRatioPct,
            trackedRecords: runtimeApiRequestTraceRecords.length,
            returnedRecords: records.length,
            statusBuckets: {
                ...runtimeApiRequestTraceTotals.statusBuckets,
            },
            averageDurationMs,
            p95DurationMs,
            lastErrorAt: runtimeApiRequestTraceTotals.lastErrorAt,
            lastErrorPath: runtimeApiRequestTraceTotals.lastErrorPath,
            lastErrorCode: runtimeApiRequestTraceTotals.lastErrorCode,
            errorCodeCounts,
            transientReturnedRequests,
            transientReturnedRatioPct,
            transientTopPaths,
            pathPrefix: options.pathPrefix,
            statusAtLeast: options.statusAtLeast,
            method: options.method,
            errorCode: options.errorCode,
            requestId: options.requestId,
        },
        records,
    };
}

type TutorProviderMode = 'local' | 'cloud';

function normalizeTutorProviderModePreference(rawValue: unknown): TutorProviderMode | 'auto' {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'local') {
        return 'local';
    }
    if (normalized === 'cloud') {
        return 'cloud';
    }
    return 'auto';
}

function classifyTutorProviderMode(provider: LlmProviderConfig): TutorProviderMode {
    const providerName = String(provider.name || '').trim().toLowerCase();
    if (providerName === 'ollama' || providerName === 'lmstudio') {
        return 'local';
    }

    const rawBaseUrl = String(provider.baseUrl || '').trim();
    if (!rawBaseUrl) {
        return 'cloud';
    }

    try {
        const parsed = new URL(rawBaseUrl);
        const host = parsed.hostname.toLowerCase();
        if (
            host === 'localhost'
            || host === '127.0.0.1'
            || host === '::1'
            || host.endsWith('.local')
        ) {
            return 'local';
        }
    } catch (_error) {
        if (/localhost|127\.0\.0\.1|::1/i.test(rawBaseUrl)) {
            return 'local';
        }
    }
    return 'cloud';
}

function resolveTutorProviderForMode(
    settings: NotemdSettings,
    preferredProviderName: string,
    modePreference: TutorProviderMode | 'auto'
): LlmProviderConfig | null {
    const enabledProviders = settings.providers.filter((provider) => provider.enabled !== false);
    if (enabledProviders.length === 0) {
        return null;
    }

    const preferred = preferredProviderName
        ? enabledProviders.find((provider) => provider.name === preferredProviderName)
        : null;
    if (preferred) {
        const preferredMode = classifyTutorProviderMode(preferred);
        if (modePreference === 'auto' || preferredMode === modePreference) {
            return preferred;
        }
    }

    const activeProvider = enabledProviders.find((provider) => provider.name === settings.activeProvider) || null;
    if (modePreference === 'auto') {
        return activeProvider || enabledProviders[0];
    }

    const modeMatched = enabledProviders.filter((provider) => classifyTutorProviderMode(provider) === modePreference);
    if (modeMatched.length === 0) {
        return activeProvider || enabledProviders[0];
    }

    return (
        modeMatched.find((provider) => provider.name === settings.activeProvider)
        || modeMatched[0]
    );
}

function resolveTutorProviderCandidates(
    settings: NotemdSettings,
    preferredProviderName: string,
    modePreference: TutorProviderMode | 'auto'
): LlmProviderConfig[] {
    const enabledProviders = settings.providers.filter((provider) => provider.enabled !== false);
    if (enabledProviders.length === 0) {
        return [];
    }

    const activeProvider = enabledProviders.find((provider) => provider.name === settings.activeProvider) || null;
    const preferredProvider = preferredProviderName
        ? enabledProviders.find((provider) => provider.name === preferredProviderName) || null
        : null;

    const modeMatchedProviders = modePreference === 'auto'
        ? enabledProviders
        : enabledProviders.filter((provider) => classifyTutorProviderMode(provider) === modePreference);
    const fallbackPool = modeMatchedProviders.length > 0 ? modeMatchedProviders : enabledProviders;
    const candidates: LlmProviderConfig[] = [];
    const seenProviderNames = new Set<string>();

    const pushCandidate = (provider: LlmProviderConfig | null): void => {
        if (!provider) {
            return;
        }
        const providerName = String(provider.name || '').trim();
        if (!providerName || seenProviderNames.has(providerName)) {
            return;
        }
        seenProviderNames.add(providerName);
        candidates.push(provider);
    };

    if (
        preferredProvider
        && (modePreference === 'auto' || classifyTutorProviderMode(preferredProvider) === modePreference)
    ) {
        pushCandidate(preferredProvider);
    }
    pushCandidate(fallbackPool.find((provider) => provider.name === settings.activeProvider) || null);
    fallbackPool.forEach((provider) => pushCandidate(provider));

    if (candidates.length === 0) {
        pushCandidate(resolveTutorProviderForMode(settings, preferredProviderName, modePreference));
    }

    return candidates;
}

function buildTutorProviderCatalog(settings: NotemdSettings): Array<{
    name: string;
    mode: TutorProviderMode;
    model: string;
    enabled: boolean;
    isActive: boolean;
}> {
    return settings.providers
        .map((provider) => ({
            name: provider.name,
            mode: classifyTutorProviderMode(provider),
            model: String(provider.model || '').trim(),
            enabled: provider.enabled !== false,
            isActive: provider.name === settings.activeProvider,
        }))
        .sort((left, right) => {
            if (left.isActive !== right.isActive) {
                return left.isActive ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
        });
}

function buildTutorAdapterPrompt(input: {
    actionKind: string;
    atomTitle: string;
    prompt?: string;
    answer?: string;
}): string {
    const normalizedActionKind = String(input.actionKind || '').trim().toLowerCase();
    const actionDirective = (() => {
        if (normalizedActionKind === 'generate_quiz') {
            return 'Generate one concise retrieval question and one evidence-grounded expected answer.';
        }
        if (normalizedActionKind === 'generate_transfer') {
            return 'Generate one transfer challenge with one valid application and one invalid application.';
        }
        if (normalizedActionKind === 'generate_counterexample') {
            return 'Generate one plausible but wrong claim and refute it with explicit evidence.';
        }
        if (normalizedActionKind === 'analyze_answer') {
            return 'Assess learner answer quality, identify misconception risk, and cite evidence.';
        }
        if (normalizedActionKind === 'recap') {
            return 'Provide a concise recap with evidence-first key points.';
        }
        if (normalizedActionKind === 'follow_up') {
            return 'Provide one follow-up comparison question with evidence hints.';
        }
        return '';
    })();
    const parts = [
        'You are an evidence-first learning tutor.',
        `Action: ${input.actionKind}`,
        `Knowledge atom: ${input.atomTitle}`,
        'Use provided evidence spans only. If evidence is insufficient, say it explicitly.',
    ];
    if (String(input.prompt || '').trim()) {
        parts.push(`User prompt: ${String(input.prompt).trim()}`);
    }
    if (String(input.answer || '').trim()) {
        parts.push(`User answer: ${String(input.answer).trim()}`);
    }
    if (actionDirective) {
        parts.push(`Action directive: ${actionDirective}`);
    }
    return parts.join('\n');
}

function buildTutorAdapterEvidenceBlock(input: {
    atomTitle: string;
    atomContent: string;
    evidenceSpans: Array<{ id: string; snippet: string }>;
    relatedAtomIds: string[];
}): string {
    const evidenceLines = input.evidenceSpans
        .slice(0, 8)
        .map((span, index) => `E${index + 1} (${span.id}): ${String(span.snippet || '').trim()}`)
        .filter((line) => line.length > 0);
    return [
        `Atom title: ${input.atomTitle}`,
        `Atom content: ${String(input.atomContent || '').trim().slice(0, 1500)}`,
        `Related atoms: ${input.relatedAtomIds.join(', ') || 'none'}`,
        'Evidence spans:',
        evidenceLines.length > 0 ? evidenceLines.join('\n') : 'No evidence spans available.',
    ].join('\n');
}

function createNotemdTutorAdapter(mode: TutorProviderMode): TutorAdapter {
    return {
        id: `notemd-${mode}`,
        mode,
        async execute(input) {
            const settings = await loadNotemdSettings();
            const preferredProviderName = String(input.providerNameHint || '').trim();
            const modePreference = normalizeTutorProviderModePreference(input.providerModeHint);
            const selectedMode = modePreference === 'auto' ? mode : modePreference;
            const providerCandidates = resolveTutorProviderCandidates(
                settings,
                preferredProviderName,
                selectedMode
            );
            if (providerCandidates.length === 0) {
                throw new Error('No enabled Notemd provider is available for tutor execution.');
            }

            const prompt = buildTutorAdapterPrompt({
                actionKind: input.actionKind,
                atomTitle: input.atom.title,
                prompt: input.prompt,
                answer: input.answer,
            });
            const content = buildTutorAdapterEvidenceBlock({
                atomTitle: input.atom.title,
                atomContent: input.atom.content,
                evidenceSpans: input.evidenceSpans.map((span) => ({
                    id: span.id,
                    snippet: span.snippet,
                })),
                relatedAtomIds: input.relatedAtomIds,
            });
            const attemptedProviders: string[] = [];
            const failedProviderErrors: string[] = [];

            for (let providerIndex = 0; providerIndex < providerCandidates.length; providerIndex += 1) {
                const provider = providerCandidates[providerIndex];
                attemptedProviders.push(provider.name);
                try {
                    const isPrimaryProviderAttempt = providerIndex === 0;
                    const completion = await notemdLlmClient.complete({
                        provider,
                        model: provider.model,
                        prompt,
                        content,
                        maxTokens: 768,
                        maxRetries: isPrimaryProviderAttempt ? 1 : 0,
                        retryDelayMs: isPrimaryProviderAttempt ? 800 : 0,
                    });
                    const responseText = String(completion.text || '').trim();
                    if (!responseText) {
                        throw new Error(`Tutor adapter (${provider.name}) returned empty content.`);
                    }

                    return {
                        message: responseText,
                        confidence: 0.78,
                        evidenceSpanIds: input.evidenceSpans.map((span) => span.id).slice(0, 8),
                        modelId: completion.model,
                        providerName: completion.provider,
                        providerMode: classifyTutorProviderMode(provider),
                        metadata: {
                            adapterIdHint: input.adapterIdHint || null,
                            selectedProvider: provider.name,
                            attemptedProviders,
                            failedProviderCount: failedProviderErrors.length,
                        },
                    };
                } catch (error) {
                    const errorMessage = String((error as Error)?.message || error || 'unknown_error')
                        .trim()
                        .slice(0, 200);
                    failedProviderErrors.push(`${provider.name}:${errorMessage}`);
                }
            }

            const attemptSummary = failedProviderErrors.length > 0
                ? failedProviderErrors.join(' | ')
                : 'no provider attempt was executed';
            throw new Error(
                `No available Notemd provider succeeded for tutor execution (mode=${selectedMode}). ${attemptSummary}`
            );
        },
    };
}

const KNOWLEDGE_GRAPH_STORE_PATH = path.join(RUNTIME_DATA_DIR, 'knowledge_graph_store.v1.json');
const KNOWLEDGE_GRAPH_GRAPHDB_PATH = path.join(RUNTIME_DATA_DIR, 'knowledge_graph_store.graphdb.v1.json');
const KNOWLEDGE_GRAPH_GRAPHDB_SQLITE_PATH = path.join(RUNTIME_DATA_DIR, 'knowledge_graph_store.graphdb.v1.sqlite');
const KNOWLEDGE_QUERY_VECTOR_INDEX_PATH = path.join(RUNTIME_DATA_DIR, 'knowledge_query_vector_index.v1.json');
type RuntimeQualityTrendRequestConfig = {
    limit: number;
    windowSize: number;
    minSamples: number;
};

type RuntimeSessionPlanQualityHistoryConfig = {
    limit: number;
};

type RuntimeSessionPlanQualityTrendConfig = {
    limit: number;
    windowSize: number;
    minSamples: number;
};

type RuntimeQueryBackendComparisonTrendConfig = {
    limit: number;
    windowSize: number;
    minSamples: number;
};

type RuntimeMemoryPolicyDiagnosticsConfig = {
    staleAfterHours: number;
    nearExpiryHours: number;
    lowConfidenceThreshold: number;
    sampleLimit: number;
};

type RuntimeMemoryPolicyHistoryConfig = {
    limit: number;
};

type RuntimeMemoryPolicyTrendConfig = {
    limit: number;
    windowSize: number;
    minSamples: number;
};

type RuntimeKnowledgeStalenessDiagnosticsConfig = {
    limit: number;
    staleOnly: boolean;
    sourcePathPrefix?: string;
};

type RuntimeStudySessionOrchestrationMemorySignalConfig = {
    regressionConfidenceFloor: number;
    improvementConfidenceFloor: number;
    scoreWeight: number;
    confidenceWeight: number;
};

type RuntimeStudySessionOrchestrationTutorRoutingConfig = {
    enabled: boolean;
    minSamples: number;
    maxFailedRatioPct: number;
    maxDowngradedRatioPct: number;
    minAverageConfidence: number;
    preferredMode: 'auto' | 'local' | 'cloud';
    adapterTimeoutMs: number;
};

type RuntimeApiRequestTraceTelemetryConfig = {
    limit: number;
    pathPrefix: string;
    method: string;
};

function resolveRuntimeQualityTrendRequestFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeQualityTrendRequestConfig {
    const parseBoundedInteger = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return fallback;
        }
        const normalized = Math.floor(numericValue);
        if (normalized < minValue) {
            return minValue;
        }
        if (normalized > maxValue) {
            return maxValue;
        }
        return normalized;
    };

    const limit = parseBoundedInteger(env.NOTE_CONNECTION_RUNTIME_QUALITY_TREND_LIMIT, 12, 2, 200);
    const windowSize = parseBoundedInteger(env.NOTE_CONNECTION_RUNTIME_QUALITY_TREND_WINDOW_SIZE, 2, 1, 30);
    const minSamplesFallback = Math.min(2, windowSize);
    const minSamples = parseBoundedInteger(
        env.NOTE_CONNECTION_RUNTIME_QUALITY_TREND_MIN_SAMPLES,
        minSamplesFallback,
        1,
        windowSize
    );

    return {
        limit,
        windowSize,
        minSamples,
    };
}

function resolveRuntimeSessionPlanQualityHistoryConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeSessionPlanQualityHistoryConfig {
    const numericValue = Number(env.NOTE_CONNECTION_RUNTIME_SESSION_PLAN_QUALITY_LIMIT);
    if (!Number.isFinite(numericValue)) {
        return {
            limit: 12,
        };
    }
    return {
        limit: Math.min(200, Math.max(1, Math.floor(numericValue))),
    };
}

function resolveRuntimeSessionPlanQualityTrendConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeSessionPlanQualityTrendConfig {
    const parseBoundedInteger = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return fallback;
        }
        const normalized = Math.floor(numericValue);
        if (normalized < minValue) {
            return minValue;
        }
        if (normalized > maxValue) {
            return maxValue;
        }
        return normalized;
    };
    const limit = parseBoundedInteger(env.NOTE_CONNECTION_RUNTIME_SESSION_PLAN_QUALITY_TREND_LIMIT, 12, 2, 200);
    const windowSize = parseBoundedInteger(env.NOTE_CONNECTION_RUNTIME_SESSION_PLAN_QUALITY_TREND_WINDOW_SIZE, 2, 1, 30);
    const minSamplesFallback = Math.min(2, windowSize);
    const minSamples = parseBoundedInteger(
        env.NOTE_CONNECTION_RUNTIME_SESSION_PLAN_QUALITY_TREND_MIN_SAMPLES,
        minSamplesFallback,
        1,
        windowSize
    );
    return {
        limit,
        windowSize,
        minSamples,
    };
}

function resolveRuntimeMemoryPolicyDiagnosticsConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeMemoryPolicyDiagnosticsConfig {
    const parseBoundedInteger = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return fallback;
        }
        const normalized = Math.floor(numericValue);
        if (normalized < minValue) {
            return minValue;
        }
        if (normalized > maxValue) {
            return maxValue;
        }
        return normalized;
    };
    const parseBoundedRatio = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const clampRatio = (value: number): number => Math.max(minValue, Math.min(maxValue, value));
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return Number(clampRatio(fallback).toFixed(4));
        }
        return Number(clampRatio(numericValue).toFixed(4));
    };
    return {
        staleAfterHours: parseBoundedInteger(
            env.NOTE_CONNECTION_RUNTIME_MEMORY_STALE_AFTER_HOURS,
            96,
            1,
            24 * 365 * 5
        ),
        nearExpiryHours: parseBoundedInteger(
            env.NOTE_CONNECTION_RUNTIME_MEMORY_NEAR_EXPIRY_HOURS,
            24,
            1,
            24 * 365 * 2
        ),
        lowConfidenceThreshold: parseBoundedRatio(
            env.NOTE_CONNECTION_RUNTIME_MEMORY_LOW_CONFIDENCE_THRESHOLD,
            0.45,
            0,
            1
        ),
        sampleLimit: parseBoundedInteger(
            env.NOTE_CONNECTION_RUNTIME_MEMORY_SAMPLE_LIMIT,
            6,
            1,
            20
        ),
    };
}

function resolveRuntimeMemoryPolicyHistoryConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeMemoryPolicyHistoryConfig {
    const numericValue = Number(env.NOTE_CONNECTION_RUNTIME_MEMORY_POLICY_HISTORY_LIMIT);
    if (!Number.isFinite(numericValue)) {
        return {
            limit: 12,
        };
    }
    return {
        limit: Math.min(200, Math.max(1, Math.floor(numericValue))),
    };
}

function resolveRuntimeMemoryPolicyTrendConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeMemoryPolicyTrendConfig {
    const parseBoundedInteger = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return fallback;
        }
        const normalized = Math.floor(numericValue);
        if (normalized < minValue) {
            return minValue;
        }
        if (normalized > maxValue) {
            return maxValue;
        }
        return normalized;
    };
    const limit = parseBoundedInteger(env.NOTE_CONNECTION_RUNTIME_MEMORY_POLICY_TREND_LIMIT, 12, 2, 200);
    const windowSize = parseBoundedInteger(env.NOTE_CONNECTION_RUNTIME_MEMORY_POLICY_TREND_WINDOW_SIZE, 2, 1, 30);
    const minSamplesFallback = Math.min(2, windowSize);
    const minSamples = parseBoundedInteger(
        env.NOTE_CONNECTION_RUNTIME_MEMORY_POLICY_TREND_MIN_SAMPLES,
        minSamplesFallback,
        1,
        windowSize
    );
    return {
        limit,
        windowSize,
        minSamples,
    };
}

function resolveRuntimeQueryBackendComparisonTrendConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeQueryBackendComparisonTrendConfig {
    const parseBoundedInteger = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return fallback;
        }
        const normalized = Math.floor(numericValue);
        if (normalized < minValue) {
            return minValue;
        }
        if (normalized > maxValue) {
            return maxValue;
        }
        return normalized;
    };
    const limit = parseBoundedInteger(
        env.NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_COMPARISON_TREND_LIMIT,
        24,
        2,
        200
    );
    const windowSize = parseBoundedInteger(
        env.NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_COMPARISON_TREND_WINDOW_SIZE,
        3,
        1,
        30
    );
    const minSamplesFallback = Math.min(2, windowSize);
    const minSamples = parseBoundedInteger(
        env.NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_COMPARISON_TREND_MIN_SAMPLES,
        minSamplesFallback,
        1,
        windowSize
    );
    return {
        limit,
        windowSize,
        minSamples,
    };
}

function resolveRuntimeKnowledgeStalenessDiagnosticsConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeKnowledgeStalenessDiagnosticsConfig {
    const parseBoundedInteger = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return fallback;
        }
        const normalized = Math.floor(numericValue);
        if (normalized < minValue) {
            return minValue;
        }
        if (normalized > maxValue) {
            return maxValue;
        }
        return normalized;
    };
    const parseBooleanFlag = (rawValue: unknown, fallback: boolean): boolean => {
        const normalized = String(rawValue || '').trim().toLowerCase();
        if (!normalized) {
            return fallback;
        }
        if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
            return true;
        }
        if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
            return false;
        }
        return fallback;
    };
    const sourcePathPrefix = String(env.NOTE_CONNECTION_RUNTIME_KNOWLEDGE_STALENESS_SOURCE_PATH_PREFIX || '').trim();
    return {
        limit: parseBoundedInteger(
            env.NOTE_CONNECTION_RUNTIME_KNOWLEDGE_STALENESS_LIMIT,
            32,
            1,
            500
        ),
        staleOnly: parseBooleanFlag(
            env.NOTE_CONNECTION_RUNTIME_KNOWLEDGE_STALENESS_STALE_ONLY,
            false
        ),
        sourcePathPrefix: sourcePathPrefix || undefined,
    };
}

function resolveRuntimeStudySessionOrchestrationMemorySignalConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeStudySessionOrchestrationMemorySignalConfig {
    const parseBoundedRatio = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const clampRatio = (value: number): number => Math.max(minValue, Math.min(maxValue, value));
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return Number(clampRatio(fallback).toFixed(4));
        }
        return Number(clampRatio(numericValue).toFixed(4));
    };

    return {
        regressionConfidenceFloor: parseBoundedRatio(
            env.NOTE_CONNECTION_RUNTIME_SESSION_ORCHESTRATION_MEMORY_REGRESSION_CONFIDENCE_FLOOR,
            0.35,
            0,
            1
        ),
        improvementConfidenceFloor: parseBoundedRatio(
            env.NOTE_CONNECTION_RUNTIME_SESSION_ORCHESTRATION_MEMORY_IMPROVEMENT_CONFIDENCE_FLOOR,
            0.6,
            0,
            1
        ),
        scoreWeight: parseBoundedRatio(
            env.NOTE_CONNECTION_RUNTIME_SESSION_ORCHESTRATION_MEMORY_SCORE_WEIGHT,
            0.25,
            0,
            1
        ),
        confidenceWeight: parseBoundedRatio(
            env.NOTE_CONNECTION_RUNTIME_SESSION_ORCHESTRATION_MEMORY_CONFIDENCE_WEIGHT,
            0.2,
            0,
            1
        ),
    };
}

function resolveRuntimeStudySessionOrchestrationTutorRoutingConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeStudySessionOrchestrationTutorRoutingConfig {
    const parseBoundedInteger = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return fallback;
        }
        const normalized = Math.floor(numericValue);
        if (normalized < minValue) {
            return minValue;
        }
        if (normalized > maxValue) {
            return maxValue;
        }
        return normalized;
    };
    const parseBoundedRatioPct = (
        rawValue: unknown,
        fallback: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return Number(Math.max(0, Math.min(100, fallback)).toFixed(4));
        }
        return Number(Math.max(0, Math.min(100, numericValue)).toFixed(4));
    };
    const parseBoundedConfidence = (
        rawValue: unknown,
        fallback: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return Number(Math.max(0, Math.min(1, fallback)).toFixed(4));
        }
        return Number(Math.max(0, Math.min(1, numericValue)).toFixed(4));
    };
    const parsePreferredMode = (rawValue: unknown): RuntimeStudySessionOrchestrationTutorRoutingConfig['preferredMode'] => {
        const normalized = String(rawValue || '').trim().toLowerCase();
        if (normalized === 'local') {
            return 'local';
        }
        if (normalized === 'cloud') {
            return 'cloud';
        }
        return 'auto';
    };

    const enabledRaw = String(env.NOTE_CONNECTION_RUNTIME_TUTOR_ROUTING_ENABLED || '').trim();

    return {
        enabled: enabledRaw ? parseBooleanFlag(enabledRaw) : true,
        minSamples: parseBoundedInteger(env.NOTE_CONNECTION_RUNTIME_TUTOR_ROUTING_MIN_SAMPLES, 3, 1, 5000),
        maxFailedRatioPct: parseBoundedRatioPct(env.NOTE_CONNECTION_RUNTIME_TUTOR_ROUTING_MAX_FAILED_RATIO_PCT, 35),
        maxDowngradedRatioPct: parseBoundedRatioPct(
            env.NOTE_CONNECTION_RUNTIME_TUTOR_ROUTING_MAX_DOWNGRADED_RATIO_PCT,
            55
        ),
        minAverageConfidence: parseBoundedConfidence(
            env.NOTE_CONNECTION_RUNTIME_TUTOR_ROUTING_MIN_AVERAGE_CONFIDENCE,
            0.55
        ),
        preferredMode: parsePreferredMode(env.NOTE_CONNECTION_RUNTIME_TUTOR_ROUTING_PREFERRED_MODE),
        adapterTimeoutMs: parseBoundedInteger(
            env.NOTE_CONNECTION_RUNTIME_TUTOR_ROUTING_ADAPTER_TIMEOUT_MS,
            15000,
            100,
            120000
        ),
    };
}

function resolveRuntimeApiRequestTraceTelemetryConfigFromEnv(
    env: NodeJS.ProcessEnv
): RuntimeApiRequestTraceTelemetryConfig {
    const parseBoundedInteger = (
        rawValue: unknown,
        fallback: number,
        minValue: number,
        maxValue: number
    ): number => {
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return fallback;
        }
        const normalized = Math.floor(numericValue);
        if (normalized < minValue) {
            return minValue;
        }
        if (normalized > maxValue) {
            return maxValue;
        }
        return normalized;
    };
    const normalizeMethod = (rawValue: unknown): string => {
        const normalized = String(rawValue || '').trim().toUpperCase();
        return (/^[A-Z]+$/).test(normalized) ? normalized : '';
    };
    const normalizePathPrefix = (rawValue: unknown): string => {
        const normalized = String(rawValue || '').trim();
        if (!normalized) {
            return '/api/knowledge';
        }
        return normalized.startsWith('/') ? normalized.slice(0, 128) : `/${normalized.slice(0, 127)}`;
    };

    return {
        limit: parseBoundedInteger(
            env.NOTE_CONNECTION_RUNTIME_API_TRACE_LIMIT,
            API_REQUEST_TRACE_MAX_RECORDS,
            1,
            API_REQUEST_TRACE_MAX_RECORDS
        ),
        pathPrefix: normalizePathPrefix(env.NOTE_CONNECTION_RUNTIME_API_TRACE_PATH_PREFIX),
        method: normalizeMethod(env.NOTE_CONNECTION_RUNTIME_API_TRACE_METHOD),
    };
}

const KNOWLEDGE_GRAPH_STORE_BACKEND = normalizeKnowledgeGraphStoreBackend(
    process.env.NOTE_CONNECTION_KNOWLEDGE_STORE_BACKEND || 'graphdb'
);
const KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER = normalizeGraphDbSnapshotAdapterProvider(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER || 'sqlite'
);
const KNOWLEDGE_GRAPHDB_ADAPTER_ID = String(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_ID || 'embedded-sqlite-graphdb'
).trim() || 'embedded-sqlite-graphdb';
const KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT = String(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT || ''
).trim();
const KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS = parseFiniteNumberOrUndefined(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS
);
const KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES = parseFiniteNumberOrUndefined(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES
);
const KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS = parseFiniteNumberOrUndefined(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS
);
const KNOWLEDGE_GRAPHDB_HTTP_CIRCUIT_FAILURE_THRESHOLD = parseFiniteNumberOrUndefined(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_CIRCUIT_FAILURE_THRESHOLD
);
const KNOWLEDGE_GRAPHDB_HTTP_CIRCUIT_COOLDOWN_MS = parseFiniteNumberOrUndefined(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_CIRCUIT_COOLDOWN_MS
);
const KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED = parseBooleanFlagOrUndefined(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED
) !== false;
const KNOWLEDGE_GRAPHDB_OPERATION_MODE = normalizeGraphDbStoreOperationMode(
    process.env.NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_OPERATION_MODE
);
let ACTIVE_KNOWLEDGE_QUERY_BACKEND = normalizeGraphQueryBackendType(process.env.NOTE_CONNECTION_QUERY_BACKEND);
const QUERY_VECTOR_INDEX_PERSIST_ENABLED = parseBooleanFlagOrUndefined(
    process.env.NOTE_CONNECTION_QUERY_VECTOR_INDEX_PERSIST
) !== false;
const QUERY_VECTOR_ANN_PREFILTER_ENABLED = parseBooleanFlagOrUndefined(
    process.env.NOTE_CONNECTION_QUERY_VECTOR_ANN_PREFILTER
) !== false;
const QUERY_VECTOR_ACCELERATION_FAILURE_MODE = normalizeLocalVectorAccelerationFailureMode(
    process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE
);
const QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT_ENABLED = (
    parseBooleanFlagOrUndefined(process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT) === true
);
const QUERY_VECTOR_ACCELERATION_PROVIDER =
    normalizeVectorAccelerationAdapterProvider(process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_PROVIDER);
const QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT =
    String(process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT || '').trim();
const QUERY_VECTOR_ACCELERATION_HTTP_TIMEOUT_MS =
    parseFiniteNumberOrUndefined(process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_TIMEOUT_MS);
const QUERY_VECTOR_ACCELERATION_HTTP_MAX_RETRIES =
    parseFiniteNumberOrUndefined(process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_MAX_RETRIES);
const QUERY_VECTOR_ACCELERATION_HTTP_RETRY_DELAY_MS =
    parseFiniteNumberOrUndefined(process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_RETRY_DELAY_MS);
const QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_FAILURE_THRESHOLD =
    parseFiniteNumberOrUndefined(process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_FAILURE_THRESHOLD);
const QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_COOLDOWN_MS =
    parseFiniteNumberOrUndefined(process.env.NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_COOLDOWN_MS);
const QUERY_VECTOR_ACCELERATION_ADAPTER = createVectorAccelerationAdapter(
    QUERY_VECTOR_ACCELERATION_PROVIDER,
    {
        externalHttp: {
            endpoint: QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT,
            timeoutMs: QUERY_VECTOR_ACCELERATION_HTTP_TIMEOUT_MS,
            maxRetries: QUERY_VECTOR_ACCELERATION_HTTP_MAX_RETRIES,
            retryDelayMs: QUERY_VECTOR_ACCELERATION_HTTP_RETRY_DELAY_MS,
            circuitFailureThreshold: QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_FAILURE_THRESHOLD,
            circuitCooldownMs: QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_COOLDOWN_MS,
        },
    }
);
const KNOWLEDGE_GRAPHDB_ADAPTER = KNOWLEDGE_GRAPH_STORE_BACKEND === 'graphdb'
    ? createGraphDbSnapshotAdapter({
        provider: KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER,
        filePath: KNOWLEDGE_GRAPH_GRAPHDB_PATH,
        sqlitePath: KNOWLEDGE_GRAPH_GRAPHDB_SQLITE_PATH,
        adapterId: KNOWLEDGE_GRAPHDB_ADAPTER_ID,
        httpEndpoint: KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT,
        httpTimeoutMs: KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS,
        httpMaxRetries: KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES,
        httpRetryDelayMs: KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS,
        httpCircuitFailureThreshold: KNOWLEDGE_GRAPHDB_HTTP_CIRCUIT_FAILURE_THRESHOLD,
        httpCircuitCooldownMs: KNOWLEDGE_GRAPHDB_HTTP_CIRCUIT_COOLDOWN_MS,
    })
    : null;
const RUNTIME_CAPABILITY_THRESHOLDS = resolveRuntimeCapabilityThresholdsFromEnv(process.env);
const RUNTIME_QUALITY_TREND_REQUEST = resolveRuntimeQualityTrendRequestFromEnv(process.env);
const LEARNING_QUALITY_THRESHOLDS = resolveLearningQualityThresholdOverridesFromEnv(process.env);
const STUDY_SESSION_PLAN_QUALITY_THRESHOLDS = resolveStudySessionPlanQualityThresholdOverridesFromEnv(process.env);
const STUDY_SESSION_PLAN_QUALITY_ADAPTIVE_THRESHOLDS_ENABLED = parseBooleanFlag(
    process.env.NOTE_CONNECTION_SESSION_PLAN_QUALITY_ADAPTIVE_THRESHOLDS
);
const RUNTIME_SESSION_PLAN_QUALITY_HISTORY_CONFIG = resolveRuntimeSessionPlanQualityHistoryConfigFromEnv(process.env);
const RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST = resolveRuntimeSessionPlanQualityTrendConfigFromEnv(process.env);
const RUNTIME_MEMORY_POLICY_DIAGNOSTICS_CONFIG = resolveRuntimeMemoryPolicyDiagnosticsConfigFromEnv(process.env);
const RUNTIME_MEMORY_POLICY_HISTORY_CONFIG = resolveRuntimeMemoryPolicyHistoryConfigFromEnv(process.env);
const RUNTIME_MEMORY_POLICY_TREND_REQUEST = resolveRuntimeMemoryPolicyTrendConfigFromEnv(process.env);
const RUNTIME_QUERY_BACKEND_COMPARISON_TREND_REQUEST =
    resolveRuntimeQueryBackendComparisonTrendConfigFromEnv(process.env);
const RUNTIME_KNOWLEDGE_STALENESS_DIAGNOSTICS_CONFIG = resolveRuntimeKnowledgeStalenessDiagnosticsConfigFromEnv(process.env);
const RUNTIME_STUDY_SESSION_ORCHESTRATION_MEMORY_SIGNAL_CONFIG =
    resolveRuntimeStudySessionOrchestrationMemorySignalConfigFromEnv(process.env);
const RUNTIME_STUDY_SESSION_ORCHESTRATION_TUTOR_ROUTING_CONFIG =
    resolveRuntimeStudySessionOrchestrationTutorRoutingConfigFromEnv(process.env);
const RUNTIME_STUDY_SESSION_ORCHESTRATION_STRATEGY_AUTO_PATH_ENABLED =
    parseBooleanFlagOrUndefined(process.env.NOTE_CONNECTION_RUNTIME_SESSION_ORCHESTRATION_STRATEGY_AUTO_PATH_ENABLED);
const RUNTIME_STUDY_SESSION_ORCHESTRATION_STRATEGY_MIN_CONFIDENCE =
    parseFiniteNumberOrUndefined(process.env.NOTE_CONNECTION_RUNTIME_SESSION_ORCHESTRATION_STRATEGY_MIN_CONFIDENCE);
const RUNTIME_API_REQUEST_TRACE_TELEMETRY_CONFIG =
    resolveRuntimeApiRequestTraceTelemetryConfigFromEnv(process.env);
const RUNTIME_RAG_SUFFICIENCY_JUDGE_TIMEOUT_MS =
    parseBoundedIntegerValue(process.env.NOTE_CONNECTION_RAG_SUFFICIENCY_JUDGE_TIMEOUT_MS, {
        min: 250,
        max: 20000,
    }) ?? 4000;
const RUNTIME_RAG_SUFFICIENCY_JUDGE_MAX_TOKENS =
    parseBoundedIntegerValue(process.env.NOTE_CONNECTION_RAG_SUFFICIENCY_JUDGE_MAX_TOKENS, {
        min: 32,
        max: 1200,
    }) ?? 320;
const knowledgeGraphStore = createKnowledgeGraphStore({
    backend: KNOWLEDGE_GRAPH_STORE_BACKEND,
    filePath: KNOWLEDGE_GRAPH_STORE_PATH,
    graphDbAdapter: KNOWLEDGE_GRAPHDB_ADAPTER,
    graphDbRequestedProvider: KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER,
    graphDbFallbackEnabled: KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED,
    graphDbOperationMode: KNOWLEDGE_GRAPHDB_OPERATION_MODE,
});
const defaultLocalTutorAdapter = createNotemdTutorAdapter('local');
const defaultCloudTutorAdapter = createNotemdTutorAdapter('cloud');
const knowledgeLearningPlatform = createKnowledgeLearningPlatform({
    store: knowledgeGraphStore,
    learningQualityThresholds: LEARNING_QUALITY_THRESHOLDS,
    studySessionPlanQualityAdaptiveThresholdsEnabled: STUDY_SESSION_PLAN_QUALITY_ADAPTIVE_THRESHOLDS_ENABLED,
    studySessionPlanQualityAdaptiveThresholdRuntimeConfig: {
        historyLimit: RUNTIME_SESSION_PLAN_QUALITY_HISTORY_CONFIG.limit,
        trendLimit: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.limit,
        trendWindowSize: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.windowSize,
        trendMinSamples: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.minSamples,
    },
    studySessionOrchestrationTrendRuntimeConfig: {
        learningQualityTrendLimit: RUNTIME_QUALITY_TREND_REQUEST.limit,
        learningQualityTrendWindowSize: RUNTIME_QUALITY_TREND_REQUEST.windowSize,
        learningQualityTrendMinSamples: RUNTIME_QUALITY_TREND_REQUEST.minSamples,
        sessionPlanQualityTrendLimit: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.limit,
        sessionPlanQualityTrendWindowSize: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.windowSize,
        sessionPlanQualityTrendMinSamples: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.minSamples,
        memoryPolicyTrendLimit: RUNTIME_MEMORY_POLICY_TREND_REQUEST.limit,
        memoryPolicyTrendWindowSize: RUNTIME_MEMORY_POLICY_TREND_REQUEST.windowSize,
        memoryPolicyTrendMinSamples: RUNTIME_MEMORY_POLICY_TREND_REQUEST.minSamples,
        strategyAutoPathEnabled: (
            typeof RUNTIME_STUDY_SESSION_ORCHESTRATION_STRATEGY_AUTO_PATH_ENABLED === 'boolean'
                ? RUNTIME_STUDY_SESSION_ORCHESTRATION_STRATEGY_AUTO_PATH_ENABLED
                : true
        ),
        strategyMinConfidence: Number.isFinite(Number(RUNTIME_STUDY_SESSION_ORCHESTRATION_STRATEGY_MIN_CONFIDENCE))
            ? Number(RUNTIME_STUDY_SESSION_ORCHESTRATION_STRATEGY_MIN_CONFIDENCE)
            : 0.35,
    },
    studySessionOrchestrationMemorySignalConfig: {
        ...RUNTIME_STUDY_SESSION_ORCHESTRATION_MEMORY_SIGNAL_CONFIG,
    },
    studySessionOrchestrationTutorRoutingConfig: {
        ...RUNTIME_STUDY_SESSION_ORCHESTRATION_TUTOR_ROUTING_CONFIG,
    },
    graphQueryBackend: createGraphQueryBackend({
        backend: ACTIVE_KNOWLEDGE_QUERY_BACKEND,
        localVectorIndexPath: QUERY_VECTOR_INDEX_PERSIST_ENABLED ? KNOWLEDGE_QUERY_VECTOR_INDEX_PATH : undefined,
        localVectorAnnPrefilterEnabled: QUERY_VECTOR_ANN_PREFILTER_ENABLED,
        localVectorAccelerationAdapter: QUERY_VECTOR_ACCELERATION_ADAPTER,
        localVectorAccelerationFailureMode: QUERY_VECTOR_ACCELERATION_FAILURE_MODE,
        localVectorAccelerationRepresentationStrict: QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT_ENABLED,
    }),
    graphQueryBackendFactoryOptions: {
        backend: ACTIVE_KNOWLEDGE_QUERY_BACKEND,
        localVectorIndexPath: QUERY_VECTOR_INDEX_PERSIST_ENABLED ? KNOWLEDGE_QUERY_VECTOR_INDEX_PATH : undefined,
        localVectorAnnPrefilterEnabled: QUERY_VECTOR_ANN_PREFILTER_ENABLED,
        localVectorAccelerationAdapter: QUERY_VECTOR_ACCELERATION_ADAPTER,
        localVectorAccelerationFailureMode: QUERY_VECTOR_ACCELERATION_FAILURE_MODE,
        localVectorAccelerationRepresentationStrict: QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT_ENABLED,
    },
    tutorAdapter: defaultLocalTutorAdapter,
    tutorAdapters: [
        defaultLocalTutorAdapter,
        defaultCloudTutorAdapter,
    ],
    ragSufficiencyLlmJudge: createRagSufficiencyProviderJudge({
        settingsProvider: () => loadNotemdSettings(),
        llmClient: notemdLlmClient,
        timeoutMs: RUNTIME_RAG_SUFFICIENCY_JUDGE_TIMEOUT_MS,
        maxTokens: RUNTIME_RAG_SUFFICIENCY_JUDGE_MAX_TOKENS,
    }),
});

let knowledgeLearningPlatformWarmupPromise: Promise<void> | null = null;
let knowledgeLearningPlatformWarmupCompleted = false;
let knowledgeLearningPlatformWarmupScheduled = false;

function warmKnowledgeLearningPlatform(reason: string): Promise<void> {
    if (knowledgeLearningPlatformWarmupCompleted) {
        return Promise.resolve();
    }
    if (!knowledgeLearningPlatformWarmupPromise) {
        const normalizedReason = String(reason || '').trim() || 'unspecified';
        const startedAt = Date.now();
        logDiagnostic('[Learning Workspace] Background hydration started.', {
            reason: normalizedReason,
        });
        knowledgeLearningPlatformWarmupPromise = knowledgeLearningPlatform.ensureReady()
            .then(async () => {
                const hydrationLatencyMs = Date.now() - startedAt;
                const backendWarmup = await knowledgeLearningPlatform.warmQueryBackend({
                    query: 'knowledge workspace warmup',
                    topK: 1,
                });
                knowledgeLearningPlatformWarmupCompleted = true;
                logDiagnostic('[Learning Workspace] Background hydration completed.', {
                    reason: normalizedReason,
                    hydrationLatencyMs,
                    queryBackendWarmupLatencyMs: backendWarmup.latencyMs,
                    queryBackendWarmupCandidateCount: backendWarmup.candidateCount,
                    queryBackendWarmupAtomCount: backendWarmup.totalAtomsInScope,
                    totalLatencyMs: Date.now() - startedAt,
                });
            })
            .catch((error) => {
                warnDiagnostic('[Learning Workspace] Background hydration failed.', {
                    reason: normalizedReason,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            })
            .finally(() => {
                knowledgeLearningPlatformWarmupPromise = null;
            });
    }
    return knowledgeLearningPlatformWarmupPromise;
}

function scheduleKnowledgeLearningPlatformWarmup(reason: string): void {
    if (
        knowledgeLearningPlatformWarmupCompleted
        || knowledgeLearningPlatformWarmupPromise
        || knowledgeLearningPlatformWarmupScheduled
    ) {
        return;
    }
    knowledgeLearningPlatformWarmupScheduled = true;
    const startWarmup = (): void => {
        knowledgeLearningPlatformWarmupScheduled = false;
        void warmKnowledgeLearningPlatform(reason).catch(() => {
            // The next state or query request will retry through the platform hydration path.
        });
    };
    if (typeof setImmediate === 'function') {
        setImmediate(startWarmup);
        return;
    }
    setTimeout(startWarmup, 0);
}

// Domain class wrappers (gradual extraction from monolith)
const knowledgeIngestor = new KnowledgeIngestor(knowledgeLearningPlatform);
const knowledgeQuerier = new KnowledgeQuerier(knowledgeLearningPlatform);
const conversationManager = new ConversationManager(knowledgeLearningPlatform);
const masteryEngine = new MasteryEngine(knowledgeLearningPlatform);
const qualityEvaluator = new QualityEvaluator(knowledgeLearningPlatform, LEARNING_QUALITY_THRESHOLDS);
const tutorRouter = new TutorRouter(knowledgeLearningPlatform);
const memoryPolicyManager = new MemoryPolicyManager(knowledgeLearningPlatform);

let cachedNotemdSettings: NotemdSettings | null = null;
let cachedPathModeSettings: PathModeSettings | null = null;
let cachedFrontendSettings: FrontendSettings | null = null;
const markdownGateway = new MarkdownGateway({
    projectRoot: runtimePaths.projectRoot,
    getKnowledgeBaseRoot: () => KB_ROOT,
    resolveMarkdownPath: async (rawPath: string) => resolvePathWithinKnowledgeBase(rawPath, {
        expectedType: 'file',
    }),
    getRendererRuntimeAvailability: async () => {
        const graphvizAvailability = await getGraphvizDotRuntimeAvailability();
        return {
            graphvizBackendPngAvailable: graphvizAvailability.available,
        };
    },
    logger: {
        info: (...args: unknown[]) => logDiagnostic(...args),
        warn: (...args: unknown[]) => warnDiagnostic(...args),
    },
});

type NotemdOperationState = {
    id: string;
    controller: AbortController;
    status: 'running' | 'done' | 'cancelled' | 'error';
    createdAt: number;
    updatedAt: number;
    logs: ProgressEvent[];
};

const NOTEMD_ACTIVE_OPERATIONS = new Map<string, NotemdOperationState>();

type AgentConversationTurnExecutionFailure = {
    error: string;
    errorCode: string;
};

type AgentConversationTurnCacheRecord = {
    turnId: string;
    requestFingerprint: string;
    createdAtMs: number;
    updatedAtMs: number;
    status: 'running' | 'completed' | 'failed';
    events: AgentConversationTurnEvent[];
    result?: AgentConversationResponse;
    failure?: AgentConversationTurnExecutionFailure;
    inFlight?: Promise<void>;
};

type AgentConversationTurnCacheCounters = {
    cacheHitCount: number;
    cacheMissCount: number;
    conflictCount: number;
    replayResponseCount: number;
    replayedEventCount: number;
    inFlightJoinCount: number;
    executionStartCount: number;
    executionSuccessCount: number;
    executionFailureCount: number;
    syncReuseCount: number;
    evictedByTtlCount: number;
    evictedByCapacityCount: number;
    lastPrunedAt?: string;
    lastConflictAt?: string;
};

type AgentConversationTurnCacheAlertSeverity = 'pass' | 'warn' | 'fail';

type AgentConversationTurnCacheAlertTrendStatus =
    | 'insufficient_data'
    | 'stable'
    | 'improving'
    | 'regressing';

type AgentConversationTurnCacheAlertEscalation =
    | 'normal'
    | 'watch'
    | 'high'
    | 'critical';

type AgentConversationTurnCacheAlertThresholds = {
    utilizationWarnPct: number;
    utilizationFailPct: number;
    executionFailureRatioWarnPct: number;
    executionFailureRatioFailPct: number;
    conflictWarnCount: number;
    conflictFailCount: number;
    staleEligibleWarnCount: number;
    staleEligibleFailCount: number;
};

type AgentConversationTurnCacheAlertCheck = {
    checkId:
        | 'utilization_pct'
        | 'execution_failure_ratio_pct'
        | 'conflict_count'
        | 'stale_eligible_entries';
    severity: AgentConversationTurnCacheAlertSeverity;
    value: number;
    warnThreshold: number;
    failThreshold: number;
    comparison: 'gte';
};

type AgentConversationTurnCacheAlertTrendConfig = {
    historyLimit: number;
    sampleMinIntervalMs: number;
    trendWindowSize: number;
    trendMinSamples: number;
    escalationWarnStreak: number;
    escalationFailStreak: number;
};

type AgentConversationTurnCacheAlertHistoryRecord = {
    sampledAt: string;
    sampledAtMs: number;
    summaryStatus: AgentConversationTurnCacheAlertSeverity;
    failingCheckCount: number;
    warnCheckCount: number;
    failCheckCount: number;
    topCheckId: AgentConversationTurnCacheAlertCheck['checkId'] | '';
    topCheckSeverity: AgentConversationTurnCacheAlertSeverity;
    topCheckValue: number;
    utilizationPct: number;
    executionFailureRatioPct: number;
    conflictCount: number;
    staleEligibleEntries: number;
    totalEntries: number;
};

type AgentConversationTurnCacheAlertTrendRequest = {
    limit: number;
    windowSize: number;
    minSamples: number;
};

const AGENT_CONVERSATION_TURN_CACHE = new Map<string, AgentConversationTurnCacheRecord>();
const AGENT_CONVERSATION_TURN_CACHE_COUNTERS: AgentConversationTurnCacheCounters = {
    cacheHitCount: 0,
    cacheMissCount: 0,
    conflictCount: 0,
    replayResponseCount: 0,
    replayedEventCount: 0,
    inFlightJoinCount: 0,
    executionStartCount: 0,
    executionSuccessCount: 0,
    executionFailureCount: 0,
    syncReuseCount: 0,
    evictedByTtlCount: 0,
    evictedByCapacityCount: 0,
};
const AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY: AgentConversationTurnCacheAlertHistoryRecord[] = [];
const AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE: {
    filePath: string;
    schemaVersion: number;
    lastLoadedAt: string;
    lastLoadedRecordCount: number;
    lastPersistedAt: string;
    lastPersistedRecordCount: number;
    lastPersistReason: string;
    loadError: string;
    persistError: string;
} = {
    filePath: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_PATH,
    schemaVersion: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_SCHEMA_VERSION,
    lastLoadedAt: '',
    lastLoadedRecordCount: 0,
    lastPersistedAt: '',
    lastPersistedRecordCount: 0,
    lastPersistReason: '',
    loadError: '',
    persistError: '',
};
let agentConversationTurnCacheAlertHistoryPersistPromise: Promise<void> | null = null;
let agentConversationTurnCacheAlertHistoryPersistQueued = false;
let agentConversationTurnCacheAlertHistoryQueuedPersistReason = '';
let lastRuntimeRunbookTurnCacheAlertTrendRecordDigest = '';

type MermaidRendererPreference = 'auto' | 'local' | 'frontend';

type ReadJsonBodyOptions = {
    maxBytes?: number;
    spoolThresholdBytes?: number;
};

type ReadBinaryBodyOptions = {
    maxBytes?: number;
    spoolThresholdBytes?: number;
};

type KnowledgeRuntimeRolloutProfile = {
    mode: 'safe_open' | 'mixed' | 'strict_closed';
    store: {
        backend: string;
        provider: string;
        adapterId: string;
        fallbackEnabled: boolean;
        operationMode: 'snapshot_only' | 'ops_preferred';
        strict: boolean;
    };
    vectorAcceleration: {
        provider: string;
        failureMode: 'fail_open' | 'fail_closed';
        representationStrict: boolean;
        strict: boolean;
    };
};

type KnowledgeRuntimePayload = {
    state: ReturnType<typeof knowledgeLearningPlatform.getKnowledgeState>;
    store: Awaited<ReturnType<typeof knowledgeLearningPlatform.getStoreDiagnostics>>;
    queryBackendConfig: ReturnType<typeof knowledgeLearningPlatform.getQueryBackendConfig>;
    queryBackendDiagnostics: ReturnType<typeof knowledgeLearningPlatform.getQueryBackendDiagnostics>;
    tutorAdapterTelemetry: Awaited<ReturnType<typeof knowledgeLearningPlatform.getTutorAdapterTelemetry>>;
    tutorTraceDiagnostics: Awaited<ReturnType<typeof knowledgeLearningPlatform.queryTutorTraceDiagnostics>> | null;
    tutorProviderTrendHistory:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryTutorProviderTrendHistory>> | null;
    tutorProviderTrendDiagnostics:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryTutorProviderTrendDiagnostics>> | null;
    learningQualityTrend: Awaited<ReturnType<typeof knowledgeLearningPlatform.queryLearningQualityTrend>> | null;
    learningQualityTrendConfig: RuntimeQualityTrendRequestConfig;
    sessionPlanQualityHistory: Awaited<ReturnType<typeof knowledgeLearningPlatform.queryStudySessionPlanQualityHistory>> | null;
    sessionPlanQualityHistoryConfig: RuntimeSessionPlanQualityHistoryConfig;
    sessionPlanQualityTrend: Awaited<ReturnType<typeof knowledgeLearningPlatform.queryStudySessionPlanQualityTrend>> | null;
    sessionPlanQualityTrendConfig: RuntimeSessionPlanQualityTrendConfig;
    sessionPlanQualityThresholdRuntime:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryStudySessionPlanQualityRuntimeThresholds>> | null;
    memoryPolicyDiagnostics:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryMemoryPolicyDiagnostics>> | null;
    memoryPolicyDiagnosticsConfig: RuntimeMemoryPolicyDiagnosticsConfig;
    memoryPolicyDiagnosticsHistory:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryMemoryPolicyDiagnosticsHistory>> | null;
    memoryPolicyDiagnosticsHistoryConfig: RuntimeMemoryPolicyHistoryConfig;
    memoryPolicyDiagnosticsTrend:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryMemoryPolicyDiagnosticsTrend>> | null;
    memoryPolicyDiagnosticsTrendConfig: RuntimeMemoryPolicyTrendConfig;
    queryBackendComparisonTrend:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryKnowledgeQueryBackendComparisonTrend>> | null;
    queryBackendComparisonTrendConfig: RuntimeQueryBackendComparisonTrendConfig;
    knowledgeStalenessDiagnostics:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryKnowledgeStalenessDiagnostics>> | null;
    knowledgeStalenessDiagnosticsConfig: RuntimeKnowledgeStalenessDiagnosticsConfig;
    studySessionOrchestrationTrendRuntimeConfig:
        ReturnType<typeof knowledgeLearningPlatform.getStudySessionOrchestrationTrendRuntimeConfig>;
    studySessionOrchestrationMemorySignalConfig:
        ReturnType<typeof knowledgeLearningPlatform.getStudySessionOrchestrationMemorySignalConfig>;
    studySessionOrchestrationTutorRoutingConfig:
        ReturnType<typeof knowledgeLearningPlatform.getStudySessionOrchestrationTutorRoutingConfig>;
    apiRequestTraceTelemetryConfig: RuntimeApiRequestTraceTelemetryConfig;
    apiRequestTraceTelemetry: {
        totalRequests: number;
        errorRequests: number;
        invalidRequestErrors: number;
        serverErrorRequests: number;
        transientErrorRequests: number;
        averageDurationMs: number;
        p95DurationMs: number;
        invalidRequestTopPaths: Array<{
            path: string;
            count: number;
        }>;
        serverErrorTopPaths: Array<{
            path: string;
            count: number;
        }>;
        transientErrorTopPaths: Array<{
            path: string;
            count: number;
        }>;
        slowTopPaths: Array<{
            path: string;
            count: number;
            p95DurationMs: number;
        }>;
    };
    studySessionPlanQualityThresholds: Partial<StudySessionPlanQualityThresholds>;
    studySessionPlanQualityAdaptiveThresholdsEnabled: boolean;
    runtimeCapabilityMatrix: RuntimeCapabilityMatrix;
    learningQualityThresholds: ReturnType<typeof knowledgeLearningPlatform.getLearningQualityThresholds>;
    configuredBackends: {
        store: string;
        query: string;
    };
    rolloutProfile: KnowledgeRuntimeRolloutProfile;
};

function buildKnowledgeRuntimeRolloutProfile(params: {
    storeDiagnostics?: Awaited<ReturnType<typeof knowledgeLearningPlatform.getStoreDiagnostics>> | null;
} = {}): KnowledgeRuntimeRolloutProfile {
    const storeDiagnostics = (
        params.storeDiagnostics
        && typeof params.storeDiagnostics === 'object'
    )
        ? params.storeDiagnostics
        : null;
    const storeBackend = String(KNOWLEDGE_GRAPH_STORE_BACKEND || 'file').trim().toLowerCase() || 'file';
    const storeUsesGraphDbBackend = storeBackend === 'graphdb';
    const storeFallbackEnabled = storeUsesGraphDbBackend
        ? (
            typeof storeDiagnostics?.fallbackEnabled === 'boolean'
                ? storeDiagnostics.fallbackEnabled
                : KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED !== false
        )
        : true;
    const storeProvider = storeUsesGraphDbBackend
        ? (String(KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER || 'none').trim().toLowerCase() || 'none')
        : 'builtin';
    const storeAdapterId = storeUsesGraphDbBackend
        ? (
            String(storeDiagnostics?.adapterId || KNOWLEDGE_GRAPHDB_ADAPTER_ID || 'local-file-graphdb')
                .trim()
            || 'local-file-graphdb'
        )
        : 'builtin';
    const storeStrict = storeUsesGraphDbBackend && storeFallbackEnabled === false;
    const storeOperationMode: 'snapshot_only' | 'ops_preferred' = storeUsesGraphDbBackend
        ? (
            String(storeDiagnostics?.graphDbOperationMode || KNOWLEDGE_GRAPHDB_OPERATION_MODE || 'snapshot_only')
                .trim()
                .toLowerCase() === 'ops_preferred'
            ? 'ops_preferred'
            : 'snapshot_only'
        )
        : 'snapshot_only';
    const vectorFailureMode: 'fail_open' | 'fail_closed' = QUERY_VECTOR_ACCELERATION_FAILURE_MODE === 'fail_closed'
        ? 'fail_closed'
        : 'fail_open';
    const vectorProvider = String(QUERY_VECTOR_ACCELERATION_PROVIDER || 'local').trim().toLowerCase() || 'local';
    const vectorRepresentationStrict = QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT_ENABLED === true;
    const vectorStrict = vectorFailureMode === 'fail_closed' || vectorRepresentationStrict;
    let rolloutMode: KnowledgeRuntimeRolloutProfile['mode'] = 'mixed';
    if (storeStrict && vectorStrict) {
        rolloutMode = 'strict_closed';
    } else if (!storeStrict && !vectorStrict) {
        rolloutMode = 'safe_open';
    }
    return {
        mode: rolloutMode,
        store: {
            backend: storeBackend,
            provider: storeProvider,
            adapterId: storeAdapterId,
            fallbackEnabled: storeFallbackEnabled,
            operationMode: storeOperationMode,
            strict: storeStrict,
        },
        vectorAcceleration: {
            provider: vectorProvider,
            failureMode: vectorFailureMode,
            representationStrict: vectorRepresentationStrict,
            strict: vectorStrict,
        },
    };
}

async function buildKnowledgeRuntimePayload(generatedAt: string): Promise<KnowledgeRuntimePayload> {
    await knowledgeLearningPlatform.ensureReady();
    const state = knowledgeLearningPlatform.getKnowledgeState();
    const store = await knowledgeLearningPlatform.getStoreDiagnostics();
    const queryBackendConfig = knowledgeLearningPlatform.getQueryBackendConfig();
    ACTIVE_KNOWLEDGE_QUERY_BACKEND = queryBackendConfig.configuredBackend;
    const baseQueryBackendDiagnostics = knowledgeLearningPlatform.getQueryBackendDiagnostics();
    const graphvizRuntimeAvailability = await getGraphvizDotRuntimeAvailability();
    const queryBackendDiagnostics = enrichQueryBackendDiagnosticsWithRendererRuntime(
        baseQueryBackendDiagnostics,
        graphvizRuntimeAvailability
    );
    const rolloutProfile = buildKnowledgeRuntimeRolloutProfile({
        storeDiagnostics: store,
    });
    const tutorAdapterTelemetry = await knowledgeLearningPlatform.getTutorAdapterTelemetry();
    let tutorTraceDiagnostics: Awaited<ReturnType<typeof knowledgeLearningPlatform.queryTutorTraceDiagnostics>> | null = null;
    try {
        tutorTraceDiagnostics = await knowledgeLearningPlatform.queryTutorTraceDiagnostics({
            source: 'llm-adapter',
            limit: 80,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to query runtime tutor trace diagnostics:', error);
    }
    let tutorProviderTrendHistory:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryTutorProviderTrendHistory>> | null = null;
    try {
        tutorProviderTrendHistory = await knowledgeLearningPlatform.queryTutorProviderTrendHistory({
            source: 'llm-adapter',
            limit: 24,
            windowSize: 6,
            minSamples: 3,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to query runtime tutor provider trend history:', error);
    }
    let tutorProviderTrendDiagnostics:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryTutorProviderTrendDiagnostics>> | null = null;
    try {
        tutorProviderTrendDiagnostics = await knowledgeLearningPlatform.queryTutorProviderTrendDiagnostics({
            source: 'llm-adapter',
            limit: 12,
            windowSize: 6,
            minSamples: 3,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to query runtime tutor provider trend diagnostics:', error);
    }
    const studySessionOrchestrationTutorRoutingConfig =
        knowledgeLearningPlatform.getStudySessionOrchestrationTutorRoutingConfig();
    let learningQualityTrend: Awaited<ReturnType<typeof knowledgeLearningPlatform.queryLearningQualityTrend>> | null = null;
    let sessionPlanQualityHistory: Awaited<ReturnType<typeof knowledgeLearningPlatform.queryStudySessionPlanQualityHistory>> | null = null;
    let sessionPlanQualityTrend: Awaited<ReturnType<typeof knowledgeLearningPlatform.queryStudySessionPlanQualityTrend>> | null = null;
    let sessionPlanQualityThresholdRuntime:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryStudySessionPlanQualityRuntimeThresholds>> | null = null;
    let memoryPolicyDiagnostics:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryMemoryPolicyDiagnostics>> | null = null;
    let memoryPolicyDiagnosticsHistory:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryMemoryPolicyDiagnosticsHistory>> | null = null;
    let memoryPolicyDiagnosticsTrend:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryMemoryPolicyDiagnosticsTrend>> | null = null;
    let queryBackendComparisonHistory:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryKnowledgeQueryBackendComparisonHistory>> | null = null;
    let queryBackendComparisonTrend:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryKnowledgeQueryBackendComparisonTrend>> | null = null;
    let knowledgeStalenessDiagnostics:
        Awaited<ReturnType<typeof knowledgeLearningPlatform.queryKnowledgeStalenessDiagnostics>> | null = null;
    try {
        learningQualityTrend = await knowledgeLearningPlatform.queryLearningQualityTrend({
            limit: RUNTIME_QUALITY_TREND_REQUEST.limit,
            windowSize: RUNTIME_QUALITY_TREND_REQUEST.windowSize,
            minSamples: RUNTIME_QUALITY_TREND_REQUEST.minSamples,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to compute runtime quality trend signal:', error);
    }
    try {
        sessionPlanQualityHistory = await knowledgeLearningPlatform.queryStudySessionPlanQualityHistory({
            limit: RUNTIME_SESSION_PLAN_QUALITY_HISTORY_CONFIG.limit,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to query runtime session plan quality history:', error);
    }
    try {
        sessionPlanQualityTrend = await knowledgeLearningPlatform.queryStudySessionPlanQualityTrend({
            limit: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.limit,
            windowSize: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.windowSize,
            minSamples: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.minSamples,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to compute runtime session plan quality trend signal:', error);
    }
    try {
        sessionPlanQualityThresholdRuntime = await knowledgeLearningPlatform.queryStudySessionPlanQualityRuntimeThresholds({
            thresholds: {
                ...STUDY_SESSION_PLAN_QUALITY_THRESHOLDS,
            },
            adaptiveThresholdsEnabled: STUDY_SESSION_PLAN_QUALITY_ADAPTIVE_THRESHOLDS_ENABLED,
            historyLimit: RUNTIME_SESSION_PLAN_QUALITY_HISTORY_CONFIG.limit,
            trendLimit: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.limit,
            trendWindowSize: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.windowSize,
            trendMinSamples: RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST.minSamples,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to compute runtime session plan quality threshold diagnostics:', error);
    }
    try {
        memoryPolicyDiagnostics = await knowledgeLearningPlatform.queryMemoryPolicyDiagnostics({
            staleAfterHours: RUNTIME_MEMORY_POLICY_DIAGNOSTICS_CONFIG.staleAfterHours,
            nearExpiryHours: RUNTIME_MEMORY_POLICY_DIAGNOSTICS_CONFIG.nearExpiryHours,
            lowConfidenceThreshold: RUNTIME_MEMORY_POLICY_DIAGNOSTICS_CONFIG.lowConfidenceThreshold,
            sampleLimit: RUNTIME_MEMORY_POLICY_DIAGNOSTICS_CONFIG.sampleLimit,
            persistRecord: false,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to compute runtime memory policy diagnostics:', error);
    }
    try {
        memoryPolicyDiagnosticsHistory = await knowledgeLearningPlatform.queryMemoryPolicyDiagnosticsHistory({
            limit: RUNTIME_MEMORY_POLICY_HISTORY_CONFIG.limit,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to query runtime memory policy diagnostics history:', error);
    }
    try {
        memoryPolicyDiagnosticsTrend = await knowledgeLearningPlatform.queryMemoryPolicyDiagnosticsTrend({
            limit: RUNTIME_MEMORY_POLICY_TREND_REQUEST.limit,
            windowSize: RUNTIME_MEMORY_POLICY_TREND_REQUEST.windowSize,
            minSamples: RUNTIME_MEMORY_POLICY_TREND_REQUEST.minSamples,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to compute runtime memory policy diagnostics trend:', error);
    }
    try {
        queryBackendComparisonHistory = await knowledgeLearningPlatform.queryKnowledgeQueryBackendComparisonHistory({
            limit: 24,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to query runtime query backend comparison history:', error);
    }
    try {
        queryBackendComparisonTrend = await knowledgeLearningPlatform.queryKnowledgeQueryBackendComparisonTrend({
            limit: RUNTIME_QUERY_BACKEND_COMPARISON_TREND_REQUEST.limit,
            windowSize: RUNTIME_QUERY_BACKEND_COMPARISON_TREND_REQUEST.windowSize,
            minSamples: RUNTIME_QUERY_BACKEND_COMPARISON_TREND_REQUEST.minSamples,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to compute runtime query backend comparison trend:', error);
    }
    try {
        knowledgeStalenessDiagnostics = await knowledgeLearningPlatform.queryKnowledgeStalenessDiagnostics({
            limit: RUNTIME_KNOWLEDGE_STALENESS_DIAGNOSTICS_CONFIG.limit,
            statuses: RUNTIME_KNOWLEDGE_STALENESS_DIAGNOSTICS_CONFIG.staleOnly
                ? ['hash_mismatch', 'missing_source', 'read_error']
                : undefined,
            sourcePathPrefix: RUNTIME_KNOWLEDGE_STALENESS_DIAGNOSTICS_CONFIG.sourcePathPrefix,
        });
    } catch (error) {
        warnDiagnostic('[Learning] Failed to compute runtime knowledge staleness diagnostics:', error);
    }
    const runtimeApiTraceSnapshot = queryRuntimeApiRequestTrace({
        limit: RUNTIME_API_REQUEST_TRACE_TELEMETRY_CONFIG.limit,
        pathPrefix: RUNTIME_API_REQUEST_TRACE_TELEMETRY_CONFIG.pathPrefix,
        statusAtLeast: 0,
        method: RUNTIME_API_REQUEST_TRACE_TELEMETRY_CONFIG.method,
        errorCode: '',
        requestId: '',
    });
    const runtimeApiTraceRecords = Array.isArray(runtimeApiTraceSnapshot.records)
        ? runtimeApiTraceSnapshot.records
        : [];
    const apiTraceWindowTotalRequests = runtimeApiTraceRecords.length;
    const apiTraceWindowErrorRequests = runtimeApiTraceRecords.reduce((count, record) => (
        Number(record?.statusCode || 0) >= 400 ? count + 1 : count
    ), 0);
    const apiTraceWindowInvalidRequestErrors = runtimeApiTraceRecords.reduce((count, record) => {
        const normalizedErrorCode = normalizeApiErrorCodeToken(record?.errorCode, '');
        return normalizedErrorCode === 'invalid_request' ? count + 1 : count;
    }, 0);
    const apiTraceWindowServerErrorRequests = runtimeApiTraceRecords.reduce((count, record) => (
        Number(record?.statusCode || 0) >= 500 ? count + 1 : count
    ), 0);
    const apiTraceWindowTransientErrorRequests = runtimeApiTraceRecords.reduce((count, record) => (
        isTransientApiStatusCode(record?.statusCode) ? count + 1 : count
    ), 0);
    const apiTraceWindowInvalidRequestPathCounts = runtimeApiTraceRecords.reduce((summary, record) => {
        const normalizedErrorCode = normalizeApiErrorCodeToken(record?.errorCode, '');
        if (normalizedErrorCode !== 'invalid_request') {
            return summary;
        }
        const method = String(record?.method || '').trim().toUpperCase();
        const path = String(record?.path || '').trim();
        const route = [method, path].filter(Boolean).join(' ');
        if (!route) {
            return summary;
        }
        summary[route] = (summary[route] || 0) + 1;
        return summary;
    }, {} as Record<string, number>);
    const apiTraceWindowInvalidRequestTopPaths = Object.entries(apiTraceWindowInvalidRequestPathCounts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([path, count]) => ({
            path,
            count: Math.max(0, Math.floor(Number(count || 0))),
        }));
    const apiTraceWindowServerErrorPathCounts = runtimeApiTraceRecords.reduce((summary, record) => {
        const statusCode = Number(record?.statusCode || 0);
        if (statusCode < 500) {
            return summary;
        }
        const method = String(record?.method || '').trim().toUpperCase();
        const path = String(record?.path || '').trim();
        const route = [method, path].filter(Boolean).join(' ');
        if (!route) {
            return summary;
        }
        summary[route] = (summary[route] || 0) + 1;
        return summary;
    }, {} as Record<string, number>);
    const apiTraceWindowServerErrorTopPaths = Object.entries(apiTraceWindowServerErrorPathCounts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([path, count]) => ({
            path,
            count: Math.max(0, Math.floor(Number(count || 0))),
        }));
    const apiTraceWindowTransientErrorPathCounts = runtimeApiTraceRecords.reduce((summary, record) => {
        if (!isTransientApiStatusCode(record?.statusCode)) {
            return summary;
        }
        const method = String(record?.method || '').trim().toUpperCase();
        const path = String(record?.path || '').trim();
        const route = [method, path].filter(Boolean).join(' ');
        if (!route) {
            return summary;
        }
        summary[route] = (summary[route] || 0) + 1;
        return summary;
    }, {} as Record<string, number>);
    const apiTraceWindowTransientErrorTopPaths = Object.entries(apiTraceWindowTransientErrorPathCounts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([path, count]) => ({
            path,
            count: Math.max(0, Math.floor(Number(count || 0))),
        }));
    const apiTraceWindowDurations = runtimeApiTraceRecords
        .map((record) => Number(record?.durationMs || 0))
        .filter((duration) => Number.isFinite(duration) && duration >= 0)
        .sort((left, right) => left - right);
    const apiTraceWindowAverageDurationMs = apiTraceWindowDurations.length > 0
        ? Number((
            apiTraceWindowDurations.reduce((sum, item) => sum + item, 0) / apiTraceWindowDurations.length
        ).toFixed(4))
        : 0;
    const apiTraceWindowP95DurationMs = apiTraceWindowDurations.length > 0
        ? Number(
            apiTraceWindowDurations[
                Math.max(0, Math.ceil(apiTraceWindowDurations.length * 0.95) - 1)
            ].toFixed(4)
        )
        : 0;
    const apiTraceWindowSlowPathDurations = runtimeApiTraceRecords.reduce((summary, record) => {
        const method = String(record?.method || '').trim().toUpperCase();
        const path = String(record?.path || '').trim();
        const route = [method, path].filter(Boolean).join(' ');
        const duration = Number(record?.durationMs || 0);
        if (!route || !Number.isFinite(duration) || duration < 0) {
            return summary;
        }
        if (!summary[route]) {
            summary[route] = [];
        }
        summary[route].push(duration);
        return summary;
    }, {} as Record<string, number[]>);
    const apiTraceWindowSlowTopPaths = Object.entries(apiTraceWindowSlowPathDurations)
        .map(([path, durations]) => {
            const sortedDurations = durations
                .filter((value) => Number.isFinite(value) && value >= 0)
                .sort((left, right) => left - right);
            if (sortedDurations.length <= 0) {
                return null;
            }
            const p95DurationMs = Number(
                sortedDurations[
                    Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1)
                ].toFixed(4)
            );
            return {
                path,
                count: sortedDurations.length,
                p95DurationMs,
            };
        })
        .filter((item): item is { path: string; count: number; p95DurationMs: number } => Boolean(item))
        .sort((left, right) => {
            if (right.p95DurationMs !== left.p95DurationMs) {
                return right.p95DurationMs - left.p95DurationMs;
            }
            return right.count - left.count;
        })
        .slice(0, 5);

    const runtimeCapabilityMatrix = buildRuntimeCapabilityMatrix({
        generatedAt,
        configuredStoreBackend: KNOWLEDGE_GRAPH_STORE_BACKEND,
        configuredQueryBackend: queryBackendConfig.configuredBackend,
        store,
        queryDiagnostics: queryBackendDiagnostics,
        queryCount: Number(state.retrievalTelemetry?.queryCount || 0),
        queryExplainabilityTelemetry: {
            sampleCount: Number(state.retrievalTelemetry?.queryExplainabilitySampleCount || 0),
            evidenceCoverageRatioPct: Number(state.retrievalTelemetry?.queryEvidenceCoverageRatioPct || 0),
            relationPathCoverageRatioPct: Number(state.retrievalTelemetry?.queryRelationPathCoverageRatioPct || 0),
            temporalValidityPassRatioPct: Number(state.retrievalTelemetry?.queryTemporalValidityPassRatioPct || 0),
            averageEvidenceSpanCount: Number(state.retrievalTelemetry?.queryAverageEvidenceSpanCount || 0),
            averageRelationPathLength: Number(state.retrievalTelemetry?.queryAverageRelationPathLength || 0),
        },
        queryBackendComparisonTelemetry: queryBackendComparisonHistory
            ? {
                summary: {
                    returnedRecords: queryBackendComparisonHistory.summary?.returnedRecords,
                    averageLeftEvidenceCoverageRatio:
                        queryBackendComparisonHistory.summary?.averageLeftEvidenceCoverageRatio,
                    averageRightEvidenceCoverageRatio:
                        queryBackendComparisonHistory.summary?.averageRightEvidenceCoverageRatio,
                    averageLeftRelationPathCoverageRatio:
                        queryBackendComparisonHistory.summary?.averageLeftRelationPathCoverageRatio,
                    averageRightRelationPathCoverageRatio:
                        queryBackendComparisonHistory.summary?.averageRightRelationPathCoverageRatio,
                    averageLeftTemporalValidityPassRatio:
                        queryBackendComparisonHistory.summary?.averageLeftTemporalValidityPassRatio,
                    averageRightTemporalValidityPassRatio:
                        queryBackendComparisonHistory.summary?.averageRightTemporalValidityPassRatio,
                },
            }
            : null,
        queryBackendComparisonTrend: queryBackendComparisonTrend
            ? {
                status: queryBackendComparisonTrend.status,
                score: queryBackendComparisonTrend.score,
                confidence: queryBackendComparisonTrend.confidence,
                summary: {
                    reason: queryBackendComparisonTrend.summary?.reason,
                },
            }
            : null,
        queryBackendComparisonTrendConfig: {
            ...RUNTIME_QUERY_BACKEND_COMPARISON_TREND_REQUEST,
        },
        apiRequestErrorTelemetry: {
            totalRequests: apiTraceWindowTotalRequests,
            errorRequests: apiTraceWindowErrorRequests,
            invalidRequestErrors: apiTraceWindowInvalidRequestErrors,
            serverErrorRequests: apiTraceWindowServerErrorRequests,
            transientErrorRequests: apiTraceWindowTransientErrorRequests,
            averageDurationMs: apiTraceWindowAverageDurationMs,
            p95DurationMs: apiTraceWindowP95DurationMs,
            scopePathPrefix: RUNTIME_API_REQUEST_TRACE_TELEMETRY_CONFIG.pathPrefix,
            scopeMethod: RUNTIME_API_REQUEST_TRACE_TELEMETRY_CONFIG.method,
            invalidRequestTopPaths: apiTraceWindowInvalidRequestTopPaths,
            serverErrorTopPaths: apiTraceWindowServerErrorTopPaths,
            transientErrorTopPaths: apiTraceWindowTransientErrorTopPaths,
            slowTopPaths: apiTraceWindowSlowTopPaths,
        },
        learningQualityTrend: learningQualityTrend
            ? {
                status: learningQualityTrend.status,
                score: learningQualityTrend.score,
                confidence: learningQualityTrend.confidence,
                reason: learningQualityTrend.summary?.reason,
            }
            : null,
        sessionPlanQualityHistory: sessionPlanQualityHistory
            ? {
                summary: {
                    totalRecords: sessionPlanQualityHistory.summary?.totalRecords,
                    overallPassRatePct: sessionPlanQualityHistory.summary?.overallPassRatePct,
                    consecutiveFailureCount: sessionPlanQualityHistory.summary?.consecutiveFailureCount,
                    commonFailedGates: sessionPlanQualityHistory.summary?.commonFailedGates || [],
                },
            }
            : null,
        sessionPlanQualityTrend: sessionPlanQualityTrend
            ? {
                status: sessionPlanQualityTrend.status,
                score: sessionPlanQualityTrend.score,
                confidence: sessionPlanQualityTrend.confidence,
                reason: sessionPlanQualityTrend.summary?.reason,
            }
            : null,
        memoryPolicyDiagnostics: memoryPolicyDiagnostics
            ? {
                summary: {
                    totalEntries: memoryPolicyDiagnostics.summary?.totalEntries,
                    expiredEntries: memoryPolicyDiagnostics.summary?.expiredEntries,
                    staleEntries: memoryPolicyDiagnostics.summary?.staleEntries,
                    lowConfidenceEntries: memoryPolicyDiagnostics.summary?.lowConfidenceEntries,
                    healthScore: memoryPolicyDiagnostics.summary?.healthScore,
                    status: memoryPolicyDiagnostics.summary?.status,
                    reason: memoryPolicyDiagnostics.summary?.reason,
                },
            }
            : null,
        memoryPolicyTrend: memoryPolicyDiagnosticsTrend
            ? {
                status: memoryPolicyDiagnosticsTrend.status,
                score: memoryPolicyDiagnosticsTrend.score,
                confidence: memoryPolicyDiagnosticsTrend.confidence,
                reason: memoryPolicyDiagnosticsTrend.summary?.reason,
            }
            : null,
        knowledgeStalenessDiagnostics: knowledgeStalenessDiagnostics
            ? {
                summary: {
                    totalDocuments: knowledgeStalenessDiagnostics.summary?.totalDocuments,
                    evaluatedDocuments: knowledgeStalenessDiagnostics.summary?.evaluatedDocuments,
                    returnedRecords: knowledgeStalenessDiagnostics.summary?.returnedRecords,
                    upToDateDocuments: knowledgeStalenessDiagnostics.summary?.upToDateDocuments,
                    hashMismatchDocuments: knowledgeStalenessDiagnostics.summary?.hashMismatchDocuments,
                    missingSourceDocuments: knowledgeStalenessDiagnostics.summary?.missingSourceDocuments,
                    readErrorDocuments: knowledgeStalenessDiagnostics.summary?.readErrorDocuments,
                    staleDocuments: knowledgeStalenessDiagnostics.summary?.staleDocuments,
                    freshnessRatioPct: knowledgeStalenessDiagnostics.summary?.freshnessRatioPct,
                    staleRatioPct: knowledgeStalenessDiagnostics.summary?.staleRatioPct,
                    reason: knowledgeStalenessDiagnostics.summary?.reason,
                },
            }
            : null,
        sessionActionTelemetry: {
            executionCount: state.sessionActionTelemetry?.executionCount,
            memoryPersistedCount: state.sessionActionTelemetry?.memoryPersistedCount,
            memoryPromotionAppliedCount: state.sessionActionTelemetry?.memoryPromotionAppliedCount,
            memoryPromotionCount: state.sessionActionTelemetry?.memoryPromotionCount,
        },
        sessionStrategyTelemetry: state.sessionStrategyTelemetry
            ? {
                totalRecords: state.sessionStrategyTelemetry.totalRecords,
                strategyRecords: state.sessionStrategyTelemetry.strategyRecords,
                trendAutoSelectionSharePct: state.sessionStrategyTelemetry.trendAutoSelectionSharePct,
                trendAutoAverageMasteryDeltaPct: state.sessionStrategyTelemetry.trendAutoAverageMasteryDeltaPct,
                trendAutoNegativeRatioPct: state.sessionStrategyTelemetry.trendAutoNegativeRatioPct,
                modeFallbackSelectionSharePct: state.sessionStrategyTelemetry.modeFallbackSelectionSharePct,
                selectionSourceCounts: {
                    explicit_request: state.sessionStrategyTelemetry.selectionSourceCounts?.explicit_request,
                    strategy_trend: state.sessionStrategyTelemetry.selectionSourceCounts?.strategy_trend,
                    mode_fallback: state.sessionStrategyTelemetry.selectionSourceCounts?.mode_fallback,
                    unknown: state.sessionStrategyTelemetry.selectionSourceCounts?.unknown,
                },
                selectionSourceAverageMasteryDeltaPct: {
                    explicit_request: state.sessionStrategyTelemetry.selectionSourceAverageMasteryDeltaPct?.explicit_request,
                    strategy_trend: state.sessionStrategyTelemetry.selectionSourceAverageMasteryDeltaPct?.strategy_trend,
                    mode_fallback: state.sessionStrategyTelemetry.selectionSourceAverageMasteryDeltaPct?.mode_fallback,
                    unknown: state.sessionStrategyTelemetry.selectionSourceAverageMasteryDeltaPct?.unknown,
                },
                selectionSourcePositiveRatioPct: {
                    explicit_request: state.sessionStrategyTelemetry.selectionSourcePositiveRatioPct?.explicit_request,
                    strategy_trend: state.sessionStrategyTelemetry.selectionSourcePositiveRatioPct?.strategy_trend,
                    mode_fallback: state.sessionStrategyTelemetry.selectionSourcePositiveRatioPct?.mode_fallback,
                    unknown: state.sessionStrategyTelemetry.selectionSourcePositiveRatioPct?.unknown,
                },
                strategyBreakdown: Array.isArray(state.sessionStrategyTelemetry.strategyBreakdown)
                    ? state.sessionStrategyTelemetry.strategyBreakdown.map((item) => ({
                        strategy: item.strategy,
                        executions: item.executions,
                        averageMasteryDeltaPct: item.averageMasteryDeltaPct,
                        positiveRatioPct: item.positiveRatioPct,
                        negativeRatioPct: item.negativeRatioPct,
                    }))
                    : [],
            }
            : null,
        tutorAdapterTelemetry: {
            summary: {
                totalAdapters: tutorAdapterTelemetry.summary?.totalAdapters,
                activeAdapters: tutorAdapterTelemetry.summary?.activeAdapters,
                totalRequests: tutorAdapterTelemetry.summary?.totalRequests,
                successfulResponses: tutorAdapterTelemetry.summary?.successfulResponses,
                acceptedResponses: tutorAdapterTelemetry.summary?.acceptedResponses,
                downgradedResponses: tutorAdapterTelemetry.summary?.downgradedResponses,
                failedResponses: tutorAdapterTelemetry.summary?.failedResponses,
                providerFallbackResponses: tutorAdapterTelemetry.summary?.providerFallbackResponses,
                providerFallbackRatioPct: tutorAdapterTelemetry.summary?.providerFallbackRatioPct,
                averageProviderAttemptCount: tutorAdapterTelemetry.summary?.averageProviderAttemptCount,
                averageConfidence: tutorAdapterTelemetry.summary?.averageConfidence,
                lastRoutingStrategy: state.tutorAdapterTelemetry?.lastRoutingStrategy,
                lastRoutingReason: state.tutorAdapterTelemetry?.lastRoutingReason,
                lastRoutingScore: state.tutorAdapterTelemetry?.lastRoutingScore,
                lastRoutingDynamicPreferredMode: state.tutorAdapterTelemetry?.lastRoutingDynamicPreferredMode,
                lastRoutingDynamicModeReason: state.tutorAdapterTelemetry?.lastRoutingDynamicModeReason,
            },
        },
        tutorTraceDiagnostics: tutorTraceDiagnostics
            ? {
                summary: {
                    matchedTraces: tutorTraceDiagnostics.summary?.matchedTraces,
                    llmAdapterTraces: tutorTraceDiagnostics.summary?.llmAdapterTraces,
                    fallbackTraces: tutorTraceDiagnostics.summary?.fallbackTraces,
                    fallbackRatioPct: tutorTraceDiagnostics.summary?.fallbackRatioPct,
                    averageProviderAttemptCount: tutorTraceDiagnostics.summary?.averageProviderAttemptCount,
                },
                providerBreakdown: Array.isArray(tutorTraceDiagnostics.providerBreakdown)
                    ? tutorTraceDiagnostics.providerBreakdown.map((item: any) => ({
                        providerName: item.providerName,
                        traces: item.traces,
                        fallbackTraces: item.fallbackTraces,
                        failedTraces: item.failedTraces,
                        averageConfidence: item.averageConfidence,
                        averageProviderAttemptCount: item.averageProviderAttemptCount,
                        lastSeenAt: item.lastSeenAt,
                    }))
                    : [],
            }
            : null,
        tutorProviderTrendHistory: tutorProviderTrendHistory
            ? {
                summary: {
                    totalProviders: tutorProviderTrendHistory.summary?.totalProviders,
                    evaluatedProviders: tutorProviderTrendHistory.summary?.evaluatedProviders,
                    totalRecords: tutorProviderTrendHistory.summary?.totalRecords,
                    returnedRecords: tutorProviderTrendHistory.summary?.returnedRecords,
                    regressingRecords: tutorProviderTrendHistory.summary?.regressingRecords,
                    stableRecords: tutorProviderTrendHistory.summary?.stableRecords,
                    improvingRecords: tutorProviderTrendHistory.summary?.improvingRecords,
                    insufficientDataRecords: tutorProviderTrendHistory.summary?.insufficientDataRecords,
                    latestWindowEndAt: tutorProviderTrendHistory.summary?.latestWindowEndAt,
                    oldestWindowEndAt: tutorProviderTrendHistory.summary?.oldestWindowEndAt,
                    recommendedFocusProviderName: tutorProviderTrendHistory.summary?.recommendedFocusProviderName,
                },
                records: Array.isArray(tutorProviderTrendHistory.records)
                    ? tutorProviderTrendHistory.records.map((item: any) => ({
                        providerName: item.providerName,
                        windowIndex: item.windowIndex,
                        sampleCount: item.sampleCount,
                        trendStatus: item.trendStatus,
                        trendScore: item.trendScore,
                        trendConfidence: item.trendConfidence,
                        windowStartAt: item.windowStartAt,
                        windowEndAt: item.windowEndAt,
                    }))
                    : [],
            }
            : null,
        tutorProviderTrendDiagnostics: tutorProviderTrendDiagnostics
            ? {
                summary: {
                    totalProviders: tutorProviderTrendDiagnostics.summary?.totalProviders,
                    evaluatedProviders: tutorProviderTrendDiagnostics.summary?.evaluatedProviders,
                    returnedProviders: tutorProviderTrendDiagnostics.summary?.returnedProviders,
                    regressingProviders: tutorProviderTrendDiagnostics.summary?.regressingProviders,
                    stableProviders: tutorProviderTrendDiagnostics.summary?.stableProviders,
                    improvingProviders: tutorProviderTrendDiagnostics.summary?.improvingProviders,
                    insufficientDataProviders: tutorProviderTrendDiagnostics.summary?.insufficientDataProviders,
                    recommendedFocusProviderName: tutorProviderTrendDiagnostics.summary?.recommendedFocusProviderName,
                    recommendedFocusReason: tutorProviderTrendDiagnostics.summary?.recommendedFocusReason,
                },
                providers: Array.isArray(tutorProviderTrendDiagnostics.providers)
                    ? tutorProviderTrendDiagnostics.providers.map((item: any) => ({
                        providerName: item.providerName,
                        trendStatus: item.trendStatus,
                        trendScore: item.trendScore,
                        trendConfidence: item.trendConfidence,
                        fallbackRatioPct: item.fallbackRatioPct,
                        failedRatioPct: item.failedRatioPct,
                        averageConfidence: item.averageConfidence,
                        deltas: {
                            fallbackRatioDeltaPct: item.deltas?.fallbackRatioDeltaPct,
                            failedRatioDeltaPct: item.deltas?.failedRatioDeltaPct,
                            averageConfidenceDelta: item.deltas?.averageConfidenceDelta,
                        },
                        reason: item.reason,
                        latestSeenAt: item.latestSeenAt,
                    }))
                    : [],
            }
            : null,
        tutorRoutingConfig: {
            ...studySessionOrchestrationTutorRoutingConfig,
        },
        thresholds: RUNTIME_CAPABILITY_THRESHOLDS,
    });
    return {
        state,
        store,
        queryBackendConfig,
        queryBackendDiagnostics,
        tutorAdapterTelemetry,
        tutorTraceDiagnostics,
        tutorProviderTrendHistory,
        tutorProviderTrendDiagnostics,
        learningQualityTrend,
        learningQualityTrendConfig: {
            ...RUNTIME_QUALITY_TREND_REQUEST,
        },
        sessionPlanQualityHistory,
        sessionPlanQualityHistoryConfig: {
            ...RUNTIME_SESSION_PLAN_QUALITY_HISTORY_CONFIG,
        },
        sessionPlanQualityTrend,
        sessionPlanQualityTrendConfig: {
            ...RUNTIME_SESSION_PLAN_QUALITY_TREND_REQUEST,
        },
        sessionPlanQualityThresholdRuntime,
        memoryPolicyDiagnostics,
        memoryPolicyDiagnosticsConfig: {
            ...RUNTIME_MEMORY_POLICY_DIAGNOSTICS_CONFIG,
        },
        memoryPolicyDiagnosticsHistory,
        memoryPolicyDiagnosticsHistoryConfig: {
            ...RUNTIME_MEMORY_POLICY_HISTORY_CONFIG,
        },
        memoryPolicyDiagnosticsTrend,
        memoryPolicyDiagnosticsTrendConfig: {
            ...RUNTIME_MEMORY_POLICY_TREND_REQUEST,
        },
        queryBackendComparisonTrend,
        queryBackendComparisonTrendConfig: {
            ...RUNTIME_QUERY_BACKEND_COMPARISON_TREND_REQUEST,
        },
        knowledgeStalenessDiagnostics,
        knowledgeStalenessDiagnosticsConfig: {
            ...RUNTIME_KNOWLEDGE_STALENESS_DIAGNOSTICS_CONFIG,
        },
        studySessionOrchestrationTrendRuntimeConfig:
            knowledgeLearningPlatform.getStudySessionOrchestrationTrendRuntimeConfig(),
        studySessionOrchestrationMemorySignalConfig:
            knowledgeLearningPlatform.getStudySessionOrchestrationMemorySignalConfig(),
        studySessionOrchestrationTutorRoutingConfig,
        apiRequestTraceTelemetryConfig: {
            ...RUNTIME_API_REQUEST_TRACE_TELEMETRY_CONFIG,
        },
        apiRequestTraceTelemetry: {
            totalRequests: apiTraceWindowTotalRequests,
            errorRequests: apiTraceWindowErrorRequests,
            invalidRequestErrors: apiTraceWindowInvalidRequestErrors,
            invalidRequestTopPaths: apiTraceWindowInvalidRequestTopPaths,
            serverErrorRequests: apiTraceWindowServerErrorRequests,
            serverErrorTopPaths: apiTraceWindowServerErrorTopPaths,
            transientErrorRequests: apiTraceWindowTransientErrorRequests,
            transientErrorTopPaths: apiTraceWindowTransientErrorTopPaths,
            averageDurationMs: apiTraceWindowAverageDurationMs,
            p95DurationMs: apiTraceWindowP95DurationMs,
            slowTopPaths: apiTraceWindowSlowTopPaths,
        },
        studySessionPlanQualityThresholds: {
            ...STUDY_SESSION_PLAN_QUALITY_THRESHOLDS,
        },
        studySessionPlanQualityAdaptiveThresholdsEnabled: STUDY_SESSION_PLAN_QUALITY_ADAPTIVE_THRESHOLDS_ENABLED,
        runtimeCapabilityMatrix,
        learningQualityThresholds: knowledgeLearningPlatform.getLearningQualityThresholds(),
        configuredBackends: {
            store: KNOWLEDGE_GRAPH_STORE_BACKEND,
            query: queryBackendConfig.configuredBackend,
        },
        rolloutProfile,
    };
}

function collectComputeModeSnapshot() {
    return {
        layoutEngine: LayoutEngine.getLastComputeDiagnostics(),
        graphMetrics: GraphMetrics.getLastComputeDiagnostics()
    };
}

type BoundedMegabyteEnvOptions = {
    envKey: string;
    defaultMb: number;
    minMb: number;
    maxMb: number;
};

type RequestBodySpoolThresholdPolicy = {
    selectedKiB: number;
    selectedBytes: number;
    recommendedKiB: number;
    source: 'default' | 'configured' | 'configured-strict' | 'auto-raised';
    strictMode: boolean;
    workloadHint: {
        expectedNodeCount: number;
        expectedEdgeCount: number;
        scale: 'default' | 'large' | 'xlarge' | 'huge';
    };
};

function resolveBoundedMegabytesFromEnv(options: BoundedMegabyteEnvOptions): number {
    const envKey = String(options.envKey || '').trim();
    const defaultMb = Math.max(1, Math.floor(Number(options.defaultMb) || 1));
    const minMb = Math.max(1, Math.floor(Number(options.minMb) || 1));
    const maxMb = Math.max(minMb, Math.floor(Number(options.maxMb) || minMb));
    if (!envKey) {
        return defaultMb;
    }

    const rawValue = String(process.env[envKey] || '').trim();
    if (!rawValue) {
        return defaultMb;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
        warnDiagnostic(`[Config] ${envKey} is not a number ("${rawValue}"). Using default ${defaultMb} MiB.`);
        return defaultMb;
    }

    const normalizedMb = Math.floor(parsedValue);
    if (normalizedMb < minMb) {
        warnDiagnostic(`[Config] ${envKey}=${rawValue} is below minimum ${minMb} MiB. Clamping to ${minMb} MiB.`);
        return minMb;
    }
    if (normalizedMb > maxMb) {
        warnDiagnostic(`[Config] ${envKey}=${rawValue} exceeds maximum ${maxMb} MiB. Clamping to ${maxMb} MiB.`);
        return maxMb;
    }

    return normalizedMb;
}

function parsePositiveIntegerValue(rawValue: unknown): number {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return 0;
    }
    return Math.floor(numericValue);
}

function resolveAgentConversationTurnCacheTtlMs(env: NodeJS.ProcessEnv): number {
    const configuredValue = parsePositiveIntegerValue(env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_TTL_MS);
    if (!configuredValue) {
        return 5 * 60 * 1000;
    }
    return Math.min(30 * 60 * 1000, Math.max(30 * 1000, configuredValue));
}

function resolveAgentConversationTurnCacheMaxEntries(env: NodeJS.ProcessEnv): number {
    const configuredValue = parsePositiveIntegerValue(env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES);
    if (!configuredValue) {
        return 256;
    }
    return Math.min(2048, Math.max(32, configuredValue));
}

function parseBoundedPercentValue(rawValue: unknown, bounds: { min: number; max: number }): number | undefined {
    const parsed = parseFiniteNumberOrUndefined(rawValue);
    if (typeof parsed === 'undefined') {
        return undefined;
    }
    return Math.min(bounds.max, Math.max(bounds.min, parsed));
}

function parseBoundedIntegerValue(rawValue: unknown, bounds: { min: number; max: number }): number | undefined {
    const parsed = parsePositiveIntegerValue(rawValue);
    if (!parsed) {
        return undefined;
    }
    return Math.min(bounds.max, Math.max(bounds.min, parsed));
}

function resolveAgentConversationTurnCacheAlertThresholds(
    env: NodeJS.ProcessEnv
): AgentConversationTurnCacheAlertThresholds {
    return {
        utilizationWarnPct:
            parseBoundedPercentValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_UTILIZATION_WARN_PCT,
                { min: 1, max: 100 }
            ) ?? 70,
        utilizationFailPct:
            parseBoundedPercentValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_UTILIZATION_FAIL_PCT,
                { min: 1, max: 100 }
            ) ?? 90,
        executionFailureRatioWarnPct:
            parseBoundedPercentValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_FAILURE_RATIO_WARN_PCT,
                { min: 0, max: 100 }
            ) ?? 5,
        executionFailureRatioFailPct:
            parseBoundedPercentValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_FAILURE_RATIO_FAIL_PCT,
                { min: 0, max: 100 }
            ) ?? 20,
        conflictWarnCount:
            parseBoundedIntegerValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_CONFLICT_WARN_COUNT,
                { min: 1, max: 100000 }
            ) ?? 3,
        conflictFailCount:
            parseBoundedIntegerValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_CONFLICT_FAIL_COUNT,
                { min: 1, max: 100000 }
            ) ?? 10,
        staleEligibleWarnCount:
            parseBoundedIntegerValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_STALE_WARN_COUNT,
                { min: 1, max: 100000 }
            ) ?? 8,
        staleEligibleFailCount:
            parseBoundedIntegerValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_STALE_FAIL_COUNT,
                { min: 1, max: 100000 }
        ) ?? 32,
    };
}

function resolveAgentConversationTurnCacheAlertTrendConfig(
    env: NodeJS.ProcessEnv
): AgentConversationTurnCacheAlertTrendConfig {
    const historyLimit = Math.min(
        5000,
        Math.max(
            16,
            parseBoundedIntegerValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_LIMIT,
                { min: 16, max: 5000 }
            ) ?? 240
        )
    );
    const sampleMinIntervalMs = Math.min(
        60 * 60 * 1000,
        Math.max(
            1000,
            parseBoundedIntegerValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_SAMPLE_MIN_INTERVAL_MS,
                { min: 1000, max: 60 * 60 * 1000 }
            ) ?? 15 * 1000
        )
    );
    const trendWindowSize = Math.min(
        historyLimit,
        Math.max(
            4,
            parseBoundedIntegerValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_WINDOW_SIZE,
                { min: 4, max: historyLimit }
            ) ?? 24
        )
    );
    const trendMinSamples = Math.min(
        trendWindowSize,
        Math.max(
            3,
            parseBoundedIntegerValue(
                env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_MIN_SAMPLES,
                { min: 3, max: trendWindowSize }
            ) ?? 6
        )
    );
    return {
        historyLimit,
        sampleMinIntervalMs,
        trendWindowSize,
        trendMinSamples,
        escalationWarnStreak: Math.min(
            1000,
            Math.max(
                1,
                parseBoundedIntegerValue(
                    env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_WARN_STREAK,
                    { min: 1, max: 1000 }
                ) ?? 3
            )
        ),
        escalationFailStreak: Math.min(
            1000,
            Math.max(
                1,
                parseBoundedIntegerValue(
                    env.NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_FAIL_STREAK,
                    { min: 1, max: 1000 }
                ) ?? 2
            )
        ),
    };
}

function normalizeTurnCacheAlertThresholdOrdering(
    warnThreshold: number,
    failThreshold: number
): { warnThreshold: number; failThreshold: number } {
    const normalizedWarn = Number.isFinite(Number(warnThreshold)) ? Number(warnThreshold) : 0;
    const normalizedFail = Number.isFinite(Number(failThreshold)) ? Number(failThreshold) : normalizedWarn;
    if (normalizedWarn <= normalizedFail) {
        return {
            warnThreshold: normalizedWarn,
            failThreshold: normalizedFail,
        };
    }
    return {
        warnThreshold: normalizedFail,
        failThreshold: normalizedWarn,
    };
}

function resolveTurnCacheAlertSeverity(value: number, warnThreshold: number, failThreshold: number): AgentConversationTurnCacheAlertSeverity {
    if (value >= failThreshold) {
        return 'fail';
    }
    if (value >= warnThreshold) {
        return 'warn';
    }
    return 'pass';
}

function buildTurnCacheAlertCheck(
    checkId: AgentConversationTurnCacheAlertCheck['checkId'],
    value: number,
    warnThreshold: number,
    failThreshold: number
): AgentConversationTurnCacheAlertCheck {
    const orderedThresholds = normalizeTurnCacheAlertThresholdOrdering(
        warnThreshold,
        failThreshold
    );
    return {
        checkId,
        severity: resolveTurnCacheAlertSeverity(
            value,
            orderedThresholds.warnThreshold,
            orderedThresholds.failThreshold
        ),
        value,
        warnThreshold: orderedThresholds.warnThreshold,
        failThreshold: orderedThresholds.failThreshold,
        comparison: 'gte',
    };
}

function resolveAgentConversationTurnCacheAlertSummaryStatus(
    checks: AgentConversationTurnCacheAlertCheck[]
): AgentConversationTurnCacheAlertSeverity {
    let summaryStatus: AgentConversationTurnCacheAlertSeverity = 'pass';
    for (const check of checks) {
        if (check.severity === 'fail') {
            return 'fail';
        }
        if (check.severity === 'warn') {
            summaryStatus = 'warn';
        }
    }
    return summaryStatus;
}

function resolveTurnCacheAlertTopCheck(
    checks: AgentConversationTurnCacheAlertCheck[]
): AgentConversationTurnCacheAlertCheck | null {
    const failCheck = checks.find((item) => item.severity === 'fail');
    if (failCheck) {
        return failCheck;
    }
    const warnCheck = checks.find((item) => item.severity === 'warn');
    if (warnCheck) {
        return warnCheck;
    }
    return checks[0] || null;
}

function resolveTurnCacheAlertSeverityScore(
    status: AgentConversationTurnCacheAlertSeverity
): number {
    if (status === 'fail') {
        return 2;
    }
    if (status === 'warn') {
        return 1;
    }
    return 0;
}

const TURN_CACHE_ALERT_CHECK_IDS = new Set<AgentConversationTurnCacheAlertCheck['checkId']>([
    'utilization_pct',
    'execution_failure_ratio_pct',
    'conflict_count',
    'stale_eligible_entries',
]);

function normalizeTurnCacheAlertCheckId(
    rawValue: unknown
): AgentConversationTurnCacheAlertCheck['checkId'] | '' {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (TURN_CACHE_ALERT_CHECK_IDS.has(normalized as AgentConversationTurnCacheAlertCheck['checkId'])) {
        return normalized as AgentConversationTurnCacheAlertCheck['checkId'];
    }
    return '';
}

function normalizeTurnCacheAlertSeverityToken(rawValue: unknown): AgentConversationTurnCacheAlertSeverity {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'fail') {
        return 'fail';
    }
    if (normalized === 'warn') {
        return 'warn';
    }
    return 'pass';
}

function normalizeTurnCacheAlertTopRiskStatus(
    rawValue: unknown
): RuntimeRunbookTopRiskStatus {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'fail') {
        return 'fail';
    }
    if (normalized === 'warn') {
        return 'warn';
    }
    if (normalized === 'pass') {
        return 'pass';
    }
    return 'none';
}

function normalizeAgentConversationTurnCacheAlertHistoryRecord(
    rawValue: unknown
): AgentConversationTurnCacheAlertHistoryRecord | null {
    const record = isObjectRecord(rawValue) ? rawValue : null;
    if (!record) {
        return null;
    }
    const sampledAtCandidate = String(record.sampledAt || '').trim();
    const sampledAtMsCandidate = Number(record.sampledAtMs);
    const sampledAtMs = Number.isFinite(sampledAtMsCandidate) && sampledAtMsCandidate > 0
        ? Math.floor(sampledAtMsCandidate)
        : Date.parse(sampledAtCandidate);
    if (!Number.isFinite(sampledAtMs) || sampledAtMs <= 0) {
        return null;
    }
    const sampledAt = new Date(sampledAtMs).toISOString();
    return {
        sampledAt,
        sampledAtMs,
        summaryStatus: normalizeTurnCacheAlertSeverityToken(record.summaryStatus),
        failingCheckCount: Math.max(0, Math.floor(Number(record.failingCheckCount || 0))),
        warnCheckCount: Math.max(0, Math.floor(Number(record.warnCheckCount || 0))),
        failCheckCount: Math.max(0, Math.floor(Number(record.failCheckCount || 0))),
        topCheckId: normalizeTurnCacheAlertCheckId(record.topCheckId),
        topCheckSeverity: normalizeTurnCacheAlertSeverityToken(record.topCheckSeverity),
        topCheckValue: Number(Number(record.topCheckValue || 0).toFixed(4)),
        utilizationPct: Number(Number(record.utilizationPct || 0).toFixed(4)),
        executionFailureRatioPct: Number(Number(record.executionFailureRatioPct || 0).toFixed(4)),
        conflictCount: Math.max(0, Math.floor(Number(record.conflictCount || 0))),
        staleEligibleEntries: Math.max(0, Math.floor(Number(record.staleEligibleEntries || 0))),
        totalEntries: Math.max(0, Math.floor(Number(record.totalEntries || 0))),
    };
}

function compactAgentConversationTurnCacheAlertHistoryRecords(
    records: AgentConversationTurnCacheAlertHistoryRecord[],
    options: { limit: number }
): AgentConversationTurnCacheAlertHistoryRecord[] {
    const dedupedByTimestamp = new Map<number, AgentConversationTurnCacheAlertHistoryRecord>();
    records.forEach((record) => {
        if (!record || !Number.isFinite(Number(record.sampledAtMs))) {
            return;
        }
        dedupedByTimestamp.set(Number(record.sampledAtMs), record);
    });
    const ordered = Array.from(dedupedByTimestamp.values())
        .sort((left, right) => left.sampledAtMs - right.sampledAtMs);
    const normalizedLimit = Math.max(1, Math.floor(Number(options.limit || 1)));
    if (ordered.length > normalizedLimit) {
        return ordered.slice(ordered.length - normalizedLimit);
    }
    return ordered;
}

function snapshotAgentConversationTurnCacheAlertHistoryStorageIndex(): {
    filePath: string;
    schemaVersion: number;
    totalRecords: number;
    configuredHistoryLimit: number;
    earliestSampledAt: string;
    latestSampledAt: string;
    latestSummaryStatus: AgentConversationTurnCacheAlertSeverity | '';
    latestTopCheckId: AgentConversationTurnCacheAlertCheck['checkId'] | '';
    latestTopCheckSeverity: AgentConversationTurnCacheAlertSeverity | '';
    lastLoadedAt: string;
    lastLoadedRecordCount: number;
    lastPersistedAt: string;
    lastPersistedRecordCount: number;
    lastPersistReason: string;
    loadError: string;
    persistError: string;
} {
    const totalRecords = AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY.length;
    const earliestRecord = totalRecords > 0
        ? AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY[0]
        : null;
    const latestRecord = totalRecords > 0
        ? AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY[totalRecords - 1]
        : null;
    return {
        filePath: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.filePath,
        schemaVersion: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.schemaVersion,
        totalRecords,
        configuredHistoryLimit: AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.historyLimit,
        earliestSampledAt: String(earliestRecord?.sampledAt || ''),
        latestSampledAt: String(latestRecord?.sampledAt || ''),
        latestSummaryStatus: latestRecord?.summaryStatus || '',
        latestTopCheckId: latestRecord?.topCheckId || '',
        latestTopCheckSeverity: latestRecord?.topCheckSeverity || '',
        lastLoadedAt: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastLoadedAt,
        lastLoadedRecordCount: Math.max(
            0,
            Math.floor(Number(AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastLoadedRecordCount || 0))
        ),
        lastPersistedAt: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastPersistedAt,
        lastPersistedRecordCount: Math.max(
            0,
            Math.floor(Number(AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastPersistedRecordCount || 0))
        ),
        lastPersistReason: String(AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastPersistReason || ''),
        loadError: String(AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.loadError || ''),
        persistError: String(AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.persistError || ''),
    };
}

async function persistAgentConversationTurnCacheAlertHistoryToDisk(reason: string): Promise<void> {
    const persistedRecords = compactAgentConversationTurnCacheAlertHistoryRecords(
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY,
        {
            limit: AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.historyLimit,
        }
    );
    const generatedAt = new Date().toISOString();
    const payload = {
        schemaVersion: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_SCHEMA_VERSION,
        generatedAt,
        reason: String(reason || '').trim().slice(0, 160),
        config: {
            ...AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG,
        },
        summary: {
            totalRecords: persistedRecords.length,
            earliestSampledAt: String(persistedRecords[0]?.sampledAt || ''),
            latestSampledAt: String(persistedRecords[persistedRecords.length - 1]?.sampledAt || ''),
        },
        records: persistedRecords.map((record) => ({
            ...record,
        })),
    };
    const tmpPath = `${AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_PATH}.tmp-${process.pid}-${Date.now()}`;
    try {
        await ensureRuntimeDataDir();
        await fs.promises.writeFile(
            tmpPath,
            JSON.stringify(payload, null, 2),
            'utf8'
        );
        await fs.promises.rename(tmpPath, AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_PATH);
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.persistError = '';
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastPersistedAt = generatedAt;
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastPersistedRecordCount = persistedRecords.length;
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastPersistReason = String(reason || '')
            .trim()
            .slice(0, 160);
    } catch (error) {
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.persistError = String(
            (error as Error | undefined)?.message || error || 'persist_failed'
        ).slice(0, 240);
        warnDiagnostic('[Runtime] Failed to persist conversation turn-cache alert trend history:', error);
        await safeUnlink(tmpPath);
    }
}

function scheduleAgentConversationTurnCacheAlertHistoryPersist(reason: string): void {
    const normalizedReason = String(reason || '').trim().slice(0, 160) || 'unspecified';
    if (agentConversationTurnCacheAlertHistoryPersistPromise) {
        agentConversationTurnCacheAlertHistoryPersistQueued = true;
        agentConversationTurnCacheAlertHistoryQueuedPersistReason = normalizedReason;
        return;
    }
    agentConversationTurnCacheAlertHistoryPersistPromise = persistAgentConversationTurnCacheAlertHistoryToDisk(
        normalizedReason
    )
        .catch((error) => {
            warnDiagnostic('[Runtime] Unexpected turn-cache alert history persistence failure:', error);
        })
        .finally(() => {
            agentConversationTurnCacheAlertHistoryPersistPromise = null;
            if (!agentConversationTurnCacheAlertHistoryPersistQueued) {
                return;
            }
            const queuedReason = agentConversationTurnCacheAlertHistoryQueuedPersistReason || 'queued_flush';
            agentConversationTurnCacheAlertHistoryPersistQueued = false;
            agentConversationTurnCacheAlertHistoryQueuedPersistReason = '';
            scheduleAgentConversationTurnCacheAlertHistoryPersist(queuedReason);
        });
}

async function loadAgentConversationTurnCacheAlertHistoryFromDisk(): Promise<{
    loaded: boolean;
    loadedRecords: number;
    generatedAt: string;
    schemaVersion: number;
}> {
    const generatedAt = new Date().toISOString();
    try {
        const content = await fs.promises.readFile(
            AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_PATH,
            'utf8'
        );
        const parsed = JSON.parse(content);
        const recordsRaw: unknown[] = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed?.records) ? parsed.records : []);
        const normalizedRecords = compactAgentConversationTurnCacheAlertHistoryRecords(
            recordsRaw
                .map((item: unknown) => normalizeAgentConversationTurnCacheAlertHistoryRecord(item))
                .filter((item: AgentConversationTurnCacheAlertHistoryRecord | null): item is AgentConversationTurnCacheAlertHistoryRecord => Boolean(item)),
            {
                limit: AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.historyLimit,
            }
        );
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY.splice(
            0,
            AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY.length,
            ...normalizedRecords
        );
        const schemaVersionFromPayload = Math.max(
            1,
            Math.floor(Number(parsed?.schemaVersion || AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_SCHEMA_VERSION))
        );
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.schemaVersion = schemaVersionFromPayload;
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastLoadedAt = generatedAt;
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastLoadedRecordCount = normalizedRecords.length;
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.loadError = '';
        return {
            loaded: true,
            loadedRecords: normalizedRecords.length,
            generatedAt,
            schemaVersion: schemaVersionFromPayload,
        };
    } catch (error) {
        if (!isFsNotFoundError(error)) {
            AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.loadError = String(
                (error as Error | undefined)?.message || error || 'load_failed'
            ).slice(0, 240);
            warnDiagnostic('[Runtime] Failed to load conversation turn-cache alert trend history:', error);
        } else {
            AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.loadError = '';
        }
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastLoadedAt = generatedAt;
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.lastLoadedRecordCount = 0;
        return {
            loaded: false,
            loadedRecords: 0,
            generatedAt,
            schemaVersion: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.schemaVersion,
        };
    }
}

function resolveTurnCacheAlertTrendStatus(
    records: AgentConversationTurnCacheAlertHistoryRecord[],
    windowSize: number,
    minSamples: number
): AgentConversationTurnCacheAlertTrendStatus {
    if (records.length < Math.max(2, minSamples)) {
        return 'insufficient_data';
    }
    const effectiveWindowSize = Math.max(2, Math.min(windowSize, records.length));
    const windowRecords = records.slice(-effectiveWindowSize);
    const halfWindowSize = Math.floor(windowRecords.length / 2);
    if (halfWindowSize < 1) {
        return 'insufficient_data';
    }
    const leftWindow = windowRecords.slice(0, halfWindowSize);
    const rightWindow = windowRecords.slice(windowRecords.length - halfWindowSize);
    if (leftWindow.length < 1 || rightWindow.length < 1) {
        return 'insufficient_data';
    }
    const leftScore = leftWindow.reduce(
        (sum, item) => sum + resolveTurnCacheAlertSeverityScore(item.summaryStatus),
        0
    ) / leftWindow.length;
    const rightScore = rightWindow.reduce(
        (sum, item) => sum + resolveTurnCacheAlertSeverityScore(item.summaryStatus),
        0
    ) / rightWindow.length;
    const delta = Number((rightScore - leftScore).toFixed(4));
    if (delta >= 0.25) {
        return 'regressing';
    }
    if (delta <= -0.25) {
        return 'improving';
    }
    return 'stable';
}

function resolveTurnCacheAlertActiveStreak(
    records: AgentConversationTurnCacheAlertHistoryRecord[]
): { warnStreak: number; failStreak: number } {
    let warnStreak = 0;
    let failStreak = 0;
    for (let index = records.length - 1; index >= 0; index -= 1) {
        const status = records[index].summaryStatus;
        if (status === 'pass') {
            break;
        }
        warnStreak += 1;
        if (status === 'fail') {
            failStreak += 1;
            continue;
        }
        break;
    }
    return {
        warnStreak,
        failStreak,
    };
}

function resolveTurnCacheAlertEscalation(
    latestStatus: AgentConversationTurnCacheAlertSeverity,
    activeWarnStreak: number,
    activeFailStreak: number,
    trendStatus: AgentConversationTurnCacheAlertTrendStatus
): { escalation: AgentConversationTurnCacheAlertEscalation; reason: string } {
    if (
        latestStatus === 'fail'
        && activeFailStreak >= (AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.escalationFailStreak + 1)
    ) {
        return {
            escalation: 'critical',
            reason: 'latest_status_fail_with_persistent_fail_streak',
        };
    }
    if (
        latestStatus === 'fail'
        || activeFailStreak >= AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.escalationFailStreak
    ) {
        return {
            escalation: 'high',
            reason: 'latest_status_fail_or_fail_streak_threshold_reached',
        };
    }
    if (
        trendStatus === 'regressing'
        && activeWarnStreak >= AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.escalationWarnStreak
    ) {
        return {
            escalation: 'high',
            reason: 'regressing_trend_with_warn_streak_threshold_reached',
        };
    }
    if (
        latestStatus === 'warn'
        || activeWarnStreak >= AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.escalationWarnStreak
        || trendStatus === 'regressing'
    ) {
        return {
            escalation: 'watch',
            reason: 'warn_or_regressing',
        };
    }
    return {
        escalation: 'normal',
        reason: 'no_active_alerts',
    };
}

function resolveRuntimeRunbookStatusFromTurnCacheAlertStatus(
    status: AgentConversationTurnCacheAlertSeverity
): RuntimeRunbookVerificationStatus {
    if (status === 'fail') {
        return 'fail';
    }
    if (status === 'warn') {
        return 'warn';
    }
    return 'pass';
}

function resolveTurnCacheAlertRunbookPriorityScore(input: {
    status: AgentConversationTurnCacheAlertSeverity;
    escalation: AgentConversationTurnCacheAlertEscalation;
    activeWarnStreak: number;
    activeFailStreak: number;
}): number {
    let priorityScore = input.status === 'fail'
        ? 90
        : (input.status === 'warn' ? 64 : 24);
    if (input.escalation === 'critical') {
        priorityScore += 10;
    } else if (input.escalation === 'high') {
        priorityScore += 6;
    } else if (input.escalation === 'watch') {
        priorityScore += 3;
    }
    priorityScore += Math.max(0, Math.min(8, Number(input.activeWarnStreak || 0)));
    priorityScore += Math.max(0, Math.min(10, Number(input.activeFailStreak || 0))) * 2;
    return Math.max(0, Math.min(100, Math.floor(priorityScore)));
}

function appendAgentConversationTurnCacheAlertHistoryRecord(
    record: AgentConversationTurnCacheAlertHistoryRecord
): void {
    const previousRecord = AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY[
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY.length - 1
    ];
    const shouldAppend = !previousRecord
        || record.summaryStatus !== previousRecord.summaryStatus
        || record.topCheckId !== previousRecord.topCheckId
        || record.topCheckSeverity !== previousRecord.topCheckSeverity
        || record.warnCheckCount !== previousRecord.warnCheckCount
        || record.failCheckCount !== previousRecord.failCheckCount
        || (record.sampledAtMs - previousRecord.sampledAtMs) >= AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.sampleMinIntervalMs;
    if (!shouldAppend) {
        return;
    }
    AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY.push(record);
    const compacted = compactAgentConversationTurnCacheAlertHistoryRecords(
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY,
        {
            limit: AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.historyLimit,
        }
    );
    AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY.splice(
        0,
        AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY.length,
        ...compacted
    );
    scheduleAgentConversationTurnCacheAlertHistoryPersist('append_alert_record');
}

function normalizeAgentConversationTurnCacheAlertTrendRequestFromQuery(
    query: URLSearchParams
): AgentConversationTurnCacheAlertTrendRequest {
    const configuredLimit = AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.historyLimit;
    const configuredWindowSize = AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.trendWindowSize;
    const configuredMinSamples = AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG.trendMinSamples;
    const requestedLimit = parsePositiveIntegerValue(query.get('limit'));
    const requestedWindowSize = parsePositiveIntegerValue(query.get('windowSize'));
    const requestedMinSamples = parsePositiveIntegerValue(query.get('minSamples'));
    const limit = Math.min(
        configuredLimit,
        Math.max(1, requestedLimit || configuredLimit)
    );
    const windowSize = Math.min(
        limit,
        Math.max(2, requestedWindowSize || configuredWindowSize)
    );
    const minSamples = Math.min(
        windowSize,
        Math.max(2, requestedMinSamples || configuredMinSamples)
    );
    return {
        limit,
        windowSize,
        minSamples,
    };
}

function queryAgentConversationTurnCacheAlertTrend(
    request: AgentConversationTurnCacheAlertTrendRequest
): {
    generatedAt: string;
    config: AgentConversationTurnCacheAlertTrendConfig & AgentConversationTurnCacheAlertTrendRequest;
    summary: {
        returnedRecords: number;
        totalRecords: number;
        statusPassCount: number;
        statusWarnCount: number;
        statusFailCount: number;
        activeWarnStreak: number;
        activeFailStreak: number;
        trendStatus: AgentConversationTurnCacheAlertTrendStatus;
        recommendedEscalation: AgentConversationTurnCacheAlertEscalation;
        reason: string;
        latestSampledAt: string;
    };
    latest: Omit<AgentConversationTurnCacheAlertHistoryRecord, 'sampledAtMs'> | null;
    records: Array<Omit<AgentConversationTurnCacheAlertHistoryRecord, 'sampledAtMs'>>;
    storage: ReturnType<typeof snapshotAgentConversationTurnCacheAlertHistoryStorageIndex>;
} {
    const totalRecords = AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY.length;
    const records = AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY
        .slice(-request.limit);
    const statusPassCount = records.filter((record) => record.summaryStatus === 'pass').length;
    const statusWarnCount = records.filter((record) => record.summaryStatus === 'warn').length;
    const statusFailCount = records.filter((record) => record.summaryStatus === 'fail').length;
    const streak = resolveTurnCacheAlertActiveStreak(records);
    const trendStatus = resolveTurnCacheAlertTrendStatus(
        records,
        request.windowSize,
        request.minSamples
    );
    const latestRecord = records.length > 0
        ? records[records.length - 1]
        : null;
    const escalation = resolveTurnCacheAlertEscalation(
        latestRecord ? latestRecord.summaryStatus : 'pass',
        streak.warnStreak,
        streak.failStreak,
        trendStatus
    );
    const stripInternalFields = (
        record: AgentConversationTurnCacheAlertHistoryRecord
    ): Omit<AgentConversationTurnCacheAlertHistoryRecord, 'sampledAtMs'> => ({
        sampledAt: record.sampledAt,
        summaryStatus: record.summaryStatus,
        failingCheckCount: record.failingCheckCount,
        warnCheckCount: record.warnCheckCount,
        failCheckCount: record.failCheckCount,
        topCheckId: record.topCheckId,
        topCheckSeverity: record.topCheckSeverity,
        topCheckValue: record.topCheckValue,
        utilizationPct: record.utilizationPct,
        executionFailureRatioPct: record.executionFailureRatioPct,
        conflictCount: record.conflictCount,
        staleEligibleEntries: record.staleEligibleEntries,
        totalEntries: record.totalEntries,
    });
    return {
        generatedAt: new Date().toISOString(),
        config: {
            ...AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_CONFIG,
            ...request,
        },
        summary: {
            returnedRecords: records.length,
            totalRecords,
            statusPassCount,
            statusWarnCount,
            statusFailCount,
            activeWarnStreak: streak.warnStreak,
            activeFailStreak: streak.failStreak,
            trendStatus,
            recommendedEscalation: escalation.escalation,
            reason: escalation.reason,
            latestSampledAt: latestRecord ? latestRecord.sampledAt : '',
        },
        latest: latestRecord ? stripInternalFields(latestRecord) : null,
        records: records.map(stripInternalFields),
        storage: snapshotAgentConversationTurnCacheAlertHistoryStorageIndex(),
    };
}

function appendRuntimeRunbookVerificationHistoryFromConversationTurnCacheAlertTrend(
    trendResult: ReturnType<typeof queryAgentConversationTurnCacheAlertTrend>
): void {
    const latest = trendResult.latest;
    if (!latest || !latest.sampledAt) {
        return;
    }
    const digest = [
        latest.sampledAt,
        latest.summaryStatus,
        trendResult.summary.trendStatus,
        trendResult.summary.recommendedEscalation,
        trendResult.summary.activeWarnStreak,
        trendResult.summary.activeFailStreak,
        trendResult.summary.statusWarnCount,
        trendResult.summary.statusFailCount,
    ].join('|');
    if (lastRuntimeRunbookTurnCacheAlertTrendRecordDigest === digest) {
        return;
    }
    lastRuntimeRunbookTurnCacheAlertTrendRecordDigest = digest;
    const returnedRecords = Math.max(0, Math.floor(Number(trendResult.summary.returnedRecords || 0)));
    const statusWarnCount = Math.max(0, Math.floor(Number(trendResult.summary.statusWarnCount || 0)));
    const statusFailCount = Math.max(0, Math.floor(Number(trendResult.summary.statusFailCount || 0)));
    const statusRiskCount = statusWarnCount + statusFailCount;
    const errorRatioPct = returnedRecords > 0
        ? Number(((statusRiskCount / returnedRecords) * 100).toFixed(4))
        : 0;
    const transientReturnedRatioPct = returnedRecords > 0
        ? Number(((statusWarnCount / returnedRecords) * 100).toFixed(4))
        : 0;
    const latestStatus = resolveRuntimeRunbookStatusFromTurnCacheAlertStatus(latest.summaryStatus);
    const topRiskStatus = normalizeTurnCacheAlertTopRiskStatus(latest.topCheckSeverity);
    const priorityScore = resolveTurnCacheAlertRunbookPriorityScore({
        status: latest.summaryStatus,
        escalation: trendResult.summary.recommendedEscalation,
        activeWarnStreak: trendResult.summary.activeWarnStreak,
        activeFailStreak: trendResult.summary.activeFailStreak,
    });
    appendRuntimeRunbookVerificationHistoryRecord({
        verifiedAt: String(latest.sampledAt || new Date().toISOString()),
        checkId: RUNTIME_RUNBOOK_CHECK_ID_CONVERSATION_TURN_CACHE_ALERT_TREND,
        status: latestStatus,
        priorityScore,
        topRiskCheckId: normalizeRuntimeRunbookCheckIdToken(
            latest.topCheckId || RUNTIME_RUNBOOK_CHECK_ID_CONVERSATION_TURN_CACHE_ALERT_TREND
        ),
        topRiskStatus,
        selectionSource: 'conversation_turn_cache_alert_trend',
        traceSummary: {
            returnedRecords,
            errorRequests: statusFailCount,
            errorRatioPct,
            transientReturnedRatioPct,
            averageDurationMs: Number(Number(latest.utilizationPct || 0).toFixed(4)),
            p95DurationMs: Number(Number(latest.executionFailureRatioPct || 0).toFixed(4)),
            pathPrefix: '/api/knowledge/conversation/turn-cache/diagnostics/trend',
            statusAtLeast: 0,
            method: 'GET',
            errorCode: normalizeApiErrorCodeToken(
                String(trendResult.summary.reason || '').trim(),
                ''
            ),
        },
    });
}

function queryAgentConversationTurnCacheAlertTrendExport(
    request: AgentConversationTurnCacheAlertTrendRequest
): {
    generatedAt: string;
    schemaVersion: number;
    config: AgentConversationTurnCacheAlertTrendConfig & AgentConversationTurnCacheAlertTrendRequest;
    summary: ReturnType<typeof queryAgentConversationTurnCacheAlertTrend>['summary'];
    storage: ReturnType<typeof snapshotAgentConversationTurnCacheAlertHistoryStorageIndex>;
    records: AgentConversationTurnCacheAlertHistoryRecord[];
} {
    const trend = queryAgentConversationTurnCacheAlertTrend(request);
    const records = AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY
        .slice(-request.limit)
        .map((record) => ({
            ...record,
        }));
    return {
        generatedAt: trend.generatedAt,
        schemaVersion: AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_PERSIST_STATE.schemaVersion,
        config: {
            ...trend.config,
        },
        summary: {
            ...trend.summary,
        },
        storage: {
            ...trend.storage,
        },
        records,
    };
}

function parseBooleanFlag(rawValue: unknown): boolean {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseBooleanFlagOrUndefined(rawValue: unknown): boolean | undefined {
    if (typeof rawValue === 'undefined' || rawValue === null) {
        return undefined;
    }
    if (typeof rawValue === 'boolean') {
        return rawValue;
    }
    const normalized = String(rawValue).trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
        return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
        return false;
    }
    return undefined;
}

function parseFiniteNumberOrUndefined(rawValue: unknown): number | undefined {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
        return undefined;
    }
    return numericValue;
}

function resolveLearningQualityThresholdOverridesFromEnv(
    env: NodeJS.ProcessEnv
): Partial<LearningQualityThresholds> {
    const overrides: Partial<LearningQualityThresholds> = {};
    const mappings: Array<[keyof LearningQualityThresholds, string]> = [
        ['retestPassRateUpliftPct', 'NOTE_CONNECTION_QUALITY_RETEST_UPLIFT_PCT'],
        ['misconceptionRecurrenceReductionPct', 'NOTE_CONNECTION_QUALITY_MISCONCEPTION_REDUCTION_PCT'],
        ['evidenceBackedSuggestionRatioPct', 'NOTE_CONNECTION_QUALITY_EVIDENCE_RATIO_PCT'],
        ['minQueryEvidenceCoverageRatioPct', 'NOTE_CONNECTION_QUALITY_MIN_QUERY_EVIDENCE_COVERAGE_PCT'],
        ['minQueryRelationPathCoverageRatioPct', 'NOTE_CONNECTION_QUALITY_MIN_QUERY_RELATION_PATH_COVERAGE_PCT'],
        ['minQueryTemporalValidityPassRatioPct', 'NOTE_CONNECTION_QUALITY_MIN_QUERY_TEMPORAL_VALIDITY_PASS_PCT'],
        ['maxPendingVerificationRatioPct', 'NOTE_CONNECTION_QUALITY_MAX_PENDING_VERIFICATION_PCT'],
        ['maxQueryBackendFallbackRatioPct', 'NOTE_CONNECTION_QUALITY_MAX_QUERY_BACKEND_FALLBACK_PCT'],
        ['minSessionMemoryPromotionCoveragePct', 'NOTE_CONNECTION_QUALITY_MIN_MEMORY_PROMOTION_COVERAGE_PCT'],
        ['pathEffectivenessLiftPct', 'NOTE_CONNECTION_QUALITY_PATH_EFFECTIVENESS_LIFT_PCT'],
        ['queryP95Ms', 'NOTE_CONNECTION_QUALITY_QUERY_P95_MS'],
    ];

    mappings.forEach(([key, envKey]) => {
        const parsed = parseFiniteNumberOrUndefined(env[envKey]);
        if (typeof parsed === 'number') {
            overrides[key] = parsed;
        }
    });
    return overrides;
}

function resolveStudySessionPlanQualityThresholdOverridesFromEnv(
    env: NodeJS.ProcessEnv
): Partial<StudySessionPlanQualityThresholds> {
    const overrides: Partial<StudySessionPlanQualityThresholds> = {};
    const mappings: Array<[keyof StudySessionPlanQualityThresholds, string]> = [
        ['minTotalActions', 'NOTE_CONNECTION_SESSION_PLAN_QUALITY_MIN_TOTAL_ACTIONS'],
        ['minEvidenceCoverageRatioPct', 'NOTE_CONNECTION_SESSION_PLAN_QUALITY_MIN_EVIDENCE_RATIO_PCT'],
        ['maxBudgetDeviationActions', 'NOTE_CONNECTION_SESSION_PLAN_QUALITY_MAX_BUDGET_DEVIATION_ACTIONS'],
        ['minRecoverySharePctWhenRegressing', 'NOTE_CONNECTION_SESSION_PLAN_QUALITY_MIN_RECOVERY_SHARE_REGRESSING_PCT'],
        ['maxDivergenceSharePctWhenRegressing', 'NOTE_CONNECTION_SESSION_PLAN_QUALITY_MAX_DIVERGENCE_SHARE_REGRESSING_PCT'],
        ['minDivergenceSharePctWhenImproving', 'NOTE_CONNECTION_SESSION_PLAN_QUALITY_MIN_DIVERGENCE_SHARE_IMPROVING_PCT'],
    ];
    mappings.forEach(([key, envKey]) => {
        const parsed = parseFiniteNumberOrUndefined(env[envKey]);
        if (typeof parsed === 'number') {
            overrides[key as string] = parsed;
        }
    });
    return overrides;
}

function normalizeGraphScaleHint(rawValue: unknown): 'default' | 'large' | 'xlarge' | 'huge' {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'large' || normalized === 'l') {
        return 'large';
    }
    if (normalized === 'xlarge' || normalized === 'xl') {
        return 'xlarge';
    }
    if (normalized === 'huge' || normalized === 'xxl' || normalized === 'extreme') {
        return 'huge';
    }
    return 'default';
}

function clampInteger(value: number, minValue: number, maxValue: number): number {
    return Math.min(maxValue, Math.max(minValue, Math.floor(value)));
}

function resolveRequestBodySpoolRecommendedKiB(workloadHint: RequestBodySpoolThresholdPolicy['workloadHint']): number {
    let recommendedKiB: number = REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.default;

    if (workloadHint.scale === 'large' || workloadHint.scale === 'xlarge') {
        recommendedKiB = Math.max(recommendedKiB, REQUEST_BODY_SPOOL_LARGE_GRAPH_KB);
    } else if (workloadHint.scale === 'huge') {
        recommendedKiB = Math.max(recommendedKiB, REQUEST_BODY_SPOOL_EXTREME_GRAPH_KB);
    }

    if (
        workloadHint.expectedNodeCount >= REQUEST_BODY_LARGE_GRAPH_NODE_THRESHOLD ||
        workloadHint.expectedEdgeCount >= REQUEST_BODY_LARGE_GRAPH_EDGE_THRESHOLD
    ) {
        recommendedKiB = Math.max(recommendedKiB, REQUEST_BODY_SPOOL_LARGE_GRAPH_KB);
    }

    if (
        workloadHint.expectedNodeCount >= REQUEST_BODY_EXTREME_GRAPH_NODE_THRESHOLD ||
        workloadHint.expectedEdgeCount >= REQUEST_BODY_EXTREME_GRAPH_EDGE_THRESHOLD
    ) {
        recommendedKiB = Math.max(recommendedKiB, REQUEST_BODY_SPOOL_EXTREME_GRAPH_KB);
    }

    return clampInteger(
        recommendedKiB,
        REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.min,
        REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.max
    );
}

function resolveRequestBodySpoolThresholdPolicy(env: NodeJS.ProcessEnv): RequestBodySpoolThresholdPolicy {
    const workloadHint = {
        expectedNodeCount: parsePositiveIntegerValue(env.NOTE_CONNECTION_EXPECTED_NODE_COUNT),
        expectedEdgeCount: parsePositiveIntegerValue(env.NOTE_CONNECTION_EXPECTED_EDGE_COUNT),
        scale: normalizeGraphScaleHint(env.NOTE_CONNECTION_GRAPH_SCALE)
    } as const;
    const recommendedKiB = resolveRequestBodySpoolRecommendedKiB(workloadHint);
    const strictMode = parseBooleanFlag(env.NOTE_CONNECTION_REQUEST_BODY_SPOOL_STRICT);
    const configuredKiB = parsePositiveIntegerValue(env.NOTE_CONNECTION_REQUEST_BODY_SPOOL_THRESHOLD_KB);

    if (configuredKiB <= 0) {
        return {
            selectedKiB: recommendedKiB,
            selectedBytes: recommendedKiB * 1024,
            recommendedKiB,
            source: recommendedKiB > REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.default ? 'auto-raised' : 'default',
            strictMode,
            workloadHint
        };
    }

    const boundedConfiguredKiB = clampInteger(
        configuredKiB,
        REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.min,
        REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.max
    );

    if (strictMode) {
        return {
            selectedKiB: boundedConfiguredKiB,
            selectedBytes: boundedConfiguredKiB * 1024,
            recommendedKiB,
            source: 'configured-strict',
            strictMode,
            workloadHint
        };
    }

    const selectedKiB = Math.max(boundedConfiguredKiB, recommendedKiB);
    return {
        selectedKiB,
        selectedBytes: selectedKiB * 1024,
        recommendedKiB,
        source: selectedKiB > boundedConfiguredKiB ? 'auto-raised' : 'configured',
        strictMode,
        workloadHint
    };
}

function parseAllowedOrigins(rawValue: string): string[] {
    return rawValue
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

function matchesAllowedOrigin(origin: URL, pattern: string): boolean {
    try {
        const allowed = new URL(pattern);
        if (allowed.protocol !== origin.protocol || allowed.hostname !== origin.hostname) {
            return false;
        }
        if (allowed.port && allowed.port !== origin.port) {
            return false;
        }
        return true;
    } catch (_error) {
        return false;
    }
}

function isAllowedOrigin(originHeader: string | undefined): boolean {
    if (!originHeader || !originHeader.trim()) {
        return true;
    }

    try {
        const origin = new URL(originHeader);
        return ALLOWED_ORIGIN_PATTERNS.some((pattern) => matchesAllowedOrigin(origin, pattern));
    } catch (_error) {
        return false;
    }
}

function applyCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        CORS_ALLOWED_HEADER_NAMES.join(', ')
    );
    res.setHeader('Access-Control-Expose-Headers', CORS_EXPOSED_HEADER_NAMES.join(', '));
    res.setHeader('Access-Control-Max-Age', '86400');

    if (!originHeader) {
        return true;
    }

    if (!isAllowedOrigin(originHeader)) {
        return false;
    }

    res.setHeader('Access-Control-Allow-Origin', originHeader);
    return true;
}

function getRequestPathname(req: http.IncomingMessage): string {
    try {
        const parsed = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${PORT}`);
        return parsed.pathname || '/';
    } catch (_error) {
        return '/';
    }
}

function getRequestContentType(req: http.IncomingMessage): string {
    return typeof req.headers['content-type'] === 'string'
        ? req.headers['content-type'].split(';', 1)[0].trim().toLowerCase()
        : '';
}

function getRawRequestPathname(rawUrl: string | undefined): string {
    const requestTarget = String(rawUrl || '/');
    const queryStart = requestTarget.indexOf('?');
    if (queryStart >= 0) {
        return requestTarget.slice(0, queryStart) || '/';
    }
    return requestTarget || '/';
}

function createRequestId(): string {
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveRequestId(req: http.IncomingMessage): string {
    const rawHeaderValue = req.headers[REQUEST_ID_HEADER];
    const requestIdCandidate = Array.isArray(rawHeaderValue)
        ? String(rawHeaderValue[0] || '').trim()
        : String(rawHeaderValue || '').trim();
    if (
        requestIdCandidate
        && requestIdCandidate.length <= 128
        && (/^[a-zA-Z0-9._:-]+$/).test(requestIdCandidate)
    ) {
        return requestIdCandidate;
    }
    return createRequestId();
}

function isProtectedRequest(req: http.IncomingMessage): boolean {
    const pathname = getRequestPathname(req);
    if (pathname.startsWith('/api/')) {
        return true;
    }

    const filename = path.basename(pathname);
    return isGeneratedGraphAsset(filename);
}

function isAuthorizedRequest(req: http.IncomingMessage): boolean {
    if (!AUTH_TOKEN || !isProtectedRequest(req)) {
        return true;
    }

    return isRequestTokenAuthorized(req, AUTH_TOKEN);
}

function isGeneratedGraphAsset(filename: string): boolean {
    return (
        filename === 'data.js' ||
        filename === 'graph_data.json' ||
        (/^data_[a-z0-9_\-]+\.js$/i).test(filename) ||
        (/^graph_data_[a-z0-9_\-]+\.json$/i).test(filename) ||
        (/^data_cli_[a-z0-9_\-]+\.js$/i).test(filename) ||
        (/^graph_data_cli_[a-z0-9_\-]+\.json$/i).test(filename)
    );
}

async function ensureRuntimeDataDir(): Promise<void> {
    await fs.promises.mkdir(RUNTIME_DATA_DIR, { recursive: true });
}

async function ensureRequestBodySpoolDir(): Promise<void> {
    await fs.promises.mkdir(REQUEST_BODY_SPOOL_DIR, { recursive: true });
}

function isFsNotFoundError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}

function isAccessDeniedError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'EACCES' || code === 'EPERM';
}

function makeAccessDeniedError(message: string): NodeJS.ErrnoException {
    const error = new Error(message) as NodeJS.ErrnoException;
    error.code = 'EACCES';
    return error;
}

function isRequestBodyTooLargeError(error: unknown): boolean {
    return error instanceof Error && error.message === 'Request body is too large.';
}

function makeRequestBodyTooLargeError(): Error {
    return new Error('Request body is too large.');
}

function generatedAssetWritePath(filename: string): string {
    return path.join(RUNTIME_DATA_DIR, filename);
}

async function isRegularFile(candidate: string): Promise<boolean> {
    try {
        const stat = await fs.promises.stat(candidate);
        return stat.isFile();
    } catch (error) {
        if (isFsNotFoundError(error)) {
            return false;
        }
        throw error;
    }
}

async function resolveGeneratedAssetForReadAsync(filename: string): Promise<string | null> {
    const runtimeFile = path.join(RUNTIME_DATA_DIR, filename);
    if (await isRegularFile(runtimeFile)) {
        return runtimeFile;
    }

    const bundledFile = path.join(FRONTEND_DIR, filename);
    if (await isRegularFile(bundledFile)) {
        return bundledFile;
    }

    return null;
}

async function safeUnlink(filePath: string): Promise<void> {
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (!isFsNotFoundError(error)) {
            warnDiagnostic('[Sidecar] Failed to clean up temporary request body file:', error);
        }
    }
}

function isJsonLikeContentType(req: http.IncomingMessage): boolean {
    const contentType = getRequestContentType(req);
    return !contentType || contentType === 'application/json' || contentType.endsWith('+json');
}

function isClipboardBinaryContentType(req: http.IncomingMessage): boolean {
    const contentType = getRequestContentType(req);
    return !contentType || contentType === 'application/octet-stream' || contentType === 'image/png';
}

function isPngBuffer(buffer: Buffer): boolean {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
        return false;
    }
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < pngSignature.length; i += 1) {
        if (buffer[i] !== pngSignature[i]) {
            return false;
        }
    }
    return true;
}

async function readJsonBody(req: http.IncomingMessage, options: ReadJsonBodyOptions = {}): Promise<any> {
    const maxBytes = options.maxBytes ?? REQUEST_BODY_LIMIT_BYTES;
    const spoolThresholdBytes = Math.max(
        64 * 1024,
        Math.min(options.spoolThresholdBytes ?? REQUEST_BODY_SPOOL_THRESHOLD_BYTES, maxBytes)
    );

    if (!isJsonLikeContentType(req)) {
        throw new Error('Unsupported Content-Type. Expected application/json.');
    }

    const declaredLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw makeRequestBodyTooLargeError();
    }

    let totalBytes = 0;
    const chunks: Buffer[] = [];
    let spoolPath: string | null = null;
    let spoolStream: fs.WriteStream | null = null;

    try {
        for await (const rawChunk of req) {
            const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
                const tooLargeError = makeRequestBodyTooLargeError();
                req.destroy(tooLargeError);
                throw tooLargeError;
            }

            if (!spoolStream && totalBytes > spoolThresholdBytes) {
                await ensureRequestBodySpoolDir();
                spoolPath = path.join(
                    REQUEST_BODY_SPOOL_DIR,
                    `body-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
                );
                spoolStream = fs.createWriteStream(spoolPath, { flags: 'wx' });
                for (const buffered of chunks) {
                    if (!spoolStream.write(buffered)) {
                        await once(spoolStream, 'drain');
                    }
                }
                chunks.length = 0;
            }

            if (spoolStream) {
                if (!spoolStream.write(chunk)) {
                    await once(spoolStream, 'drain');
                }
            } else {
                chunks.push(chunk);
            }
        }

        if (spoolStream) {
            await new Promise<void>((resolve, reject) => {
                if (!spoolStream) {
                    resolve();
                    return;
                }
                spoolStream.once('error', reject);
                spoolStream.end(() => resolve());
            });
        }

        const body = spoolPath
            ? await fs.promises.readFile(spoolPath, 'utf8')
            : Buffer.concat(chunks).toString('utf8');

        if (!body.trim()) {
            return {};
        }

        return JSON.parse(body);
    } finally {
        if (spoolStream && !spoolStream.closed) {
            spoolStream.destroy();
        }
        if (spoolPath) {
            await safeUnlink(spoolPath);
        }
    }
}

async function readBinaryBody(req: http.IncomingMessage, options: ReadBinaryBodyOptions = {}): Promise<Buffer> {
    const maxBytes = options.maxBytes ?? REQUEST_BODY_LIMIT_BYTES;
    const spoolThresholdBytes = Math.max(
        64 * 1024,
        Math.min(options.spoolThresholdBytes ?? REQUEST_BODY_SPOOL_THRESHOLD_BYTES, maxBytes)
    );

    if (!isClipboardBinaryContentType(req)) {
        throw new Error('Unsupported Content-Type. Expected image/png or application/octet-stream.');
    }

    const declaredLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw makeRequestBodyTooLargeError();
    }

    let totalBytes = 0;
    const chunks: Buffer[] = [];
    let spoolPath: string | null = null;
    let spoolStream: fs.WriteStream | null = null;

    try {
        for await (const rawChunk of req) {
            const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
                const tooLargeError = makeRequestBodyTooLargeError();
                req.destroy(tooLargeError);
                throw tooLargeError;
            }

            if (!spoolStream && totalBytes > spoolThresholdBytes) {
                await ensureRequestBodySpoolDir();
                spoolPath = path.join(
                    REQUEST_BODY_SPOOL_DIR,
                    `body-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`
                );
                spoolStream = fs.createWriteStream(spoolPath, { flags: 'wx' });
                for (const buffered of chunks) {
                    if (!spoolStream.write(buffered)) {
                        await once(spoolStream, 'drain');
                    }
                }
                chunks.length = 0;
            }

            if (spoolStream) {
                if (!spoolStream.write(chunk)) {
                    await once(spoolStream, 'drain');
                }
            } else {
                chunks.push(chunk);
            }
        }

        if (spoolStream) {
            await new Promise<void>((resolve, reject) => {
                if (!spoolStream) {
                    resolve();
                    return;
                }
                spoolStream.once('error', reject);
                spoolStream.end(() => resolve());
            });
        }

        return spoolPath
            ? await fs.promises.readFile(spoolPath)
            : Buffer.concat(chunks);
    } finally {
        if (spoolStream && !spoolStream.closed) {
            spoolStream.destroy();
        }
        if (spoolPath) {
            await safeUnlink(spoolPath);
        }
    }
}

type ApiErrorEnvelope = {
    success: false;
    error: string;
    errorCode: string;
    requestId?: string;
};

type BodyParseErrorResponseOptions = {
    requestId?: string;
};

type ApiErrorResponseOptions = {
    context: string;
    requestId?: string;
    enableValidationStatus?: boolean;
};

function normalizeApiErrorCodeToken(rawValue: unknown, fallback = 'internal_error'): string {
    const candidate = String(rawValue || '').trim().toLowerCase();
    if (!candidate) {
        return fallback;
    }
    return /^[a-z0-9_]+$/.test(candidate)
        ? candidate
        : fallback;
}

function setApiErrorCodeHeader(res: http.ServerResponse, errorCode: unknown): void {
    const normalized = normalizeApiErrorCodeToken(errorCode, '');
    if (!normalized) {
        return;
    }
    res.setHeader('X-Error-Code', normalized);
}

function createApiErrorEnvelope(params: {
    error: string;
    errorCode: string;
    requestId?: string;
}): ApiErrorEnvelope {
    const normalizedRequestId = String(params.requestId || '').trim();
    return {
        success: false,
        error: String(params.error || 'Unknown error'),
        errorCode: normalizeApiErrorCodeToken(params.errorCode, 'internal_error'),
        requestId: normalizedRequestId || undefined,
    };
}

function writeBodyParseErrorResponse(
    res: http.ServerResponse,
    error: unknown,
    options: BodyParseErrorResponseOptions = {}
): boolean {
    if (isRequestBodyTooLargeError(error)) {
        setApiErrorCodeHeader(res, 'request_body_too_large');
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(createApiErrorEnvelope({
            error: 'Request body is too large.',
            errorCode: 'request_body_too_large',
            requestId: options.requestId,
        })));
        return true;
    }

    if (error instanceof SyntaxError) {
        setApiErrorCodeHeader(res, 'invalid_json');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(createApiErrorEnvelope({
            error: 'Invalid JSON body.',
            errorCode: 'invalid_json',
            requestId: options.requestId,
        })));
        return true;
    }

    if (error instanceof Error && error.message.startsWith('Unsupported Content-Type')) {
        setApiErrorCodeHeader(res, 'unsupported_content_type');
        res.writeHead(415, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(createApiErrorEnvelope({
            error: error.message,
            errorCode: 'unsupported_content_type',
            requestId: options.requestId,
        })));
        return true;
    }

    return false;
}

function classifyApiInputValidationError(error: unknown): { error: string; errorCode: string } | null {
    if (error instanceof InvalidRequestError) {
        return {
            error: String(error.message || 'Invalid request.'),
            errorCode: normalizeApiErrorCodeToken(error.errorCode, 'invalid_request'),
        };
    }

    const message = String((error as Error | undefined)?.message || '').trim();
    if (!message) {
        return null;
    }
    const validationPatterns = [
        /requires a non-empty/i,
        /requires a valid active atomId/i,
        /could not resolve target atom/i,
    ];
    if (validationPatterns.some((pattern) => pattern.test(message))) {
        return {
            error: message,
            errorCode: 'invalid_request',
        };
    }
    return null;
}

function writeApiErrorResponse(
    res: http.ServerResponse,
    error: unknown,
    options: ApiErrorResponseOptions
): void {
    if (writeBodyParseErrorResponse(res, error, { requestId: options.requestId })) {
        return;
    }
    const validation = options.enableValidationStatus === true
        ? classifyApiInputValidationError(error)
        : null;
    if (validation) {
        setApiErrorCodeHeader(res, validation.errorCode);
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(createApiErrorEnvelope({
            error: validation.error,
            errorCode: validation.errorCode,
            requestId: options.requestId,
        })));
        return;
    }

    console.error(error);
    CrashLogger.log(error, options.context);
    setApiErrorCodeHeader(res, 'internal_error');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(createApiErrorEnvelope({
        error: String(error),
        errorCode: 'internal_error',
        requestId: options.requestId,
    })));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readFirstNonEmptyString(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
        const candidate = String(record[key] || '').trim();
        if (candidate) {
            return candidate;
        }
    }
    return undefined;
}

function readFirstPresentValue(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) {
            continue;
        }
        const candidate = record[key];
        if (typeof candidate !== 'undefined' && candidate !== null) {
            return candidate;
        }
    }
    return undefined;
}

function normalizeTutorActionKindOrUndefined(rawValue: unknown): TutorActionRequest['actionKind'] | undefined {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (normalized === 'generate_quiz' || normalized === 'quiz' || normalized === 'generate-quiz') {
        return 'generate_quiz';
    }
    if (
        normalized === 'generate_transfer'
        || normalized === 'transfer'
        || normalized === 'transfer_quiz'
        || normalized === 'generate_transfer_quiz'
    ) {
        return 'generate_transfer';
    }
    if (
        normalized === 'generate_counterexample'
        || normalized === 'counterexample'
        || normalized === 'counter_example'
        || normalized === 'counter-example'
    ) {
        return 'generate_counterexample';
    }
    if (normalized === 'analyze_answer' || normalized === 'analyze' || normalized === 'answer_analysis') {
        return 'analyze_answer';
    }
    if (normalized === 'follow_up' || normalized === 'followup' || normalized === 'follow-up') {
        return 'follow_up';
    }
    if (normalized === 'recap' || normalized === 'summary') {
        return 'recap';
    }
    return undefined;
}

function normalizeTutorActionKind(rawValue: unknown): TutorActionRequest['actionKind'] {
    const normalized = normalizeTutorActionKindOrUndefined(rawValue);
    if (normalized) {
        return normalized;
    }
    return 'follow_up';
}

function normalizeTutorTraceSourceToken(rawValue: unknown): TutorTraceDiagnosticsRequest['source'] | undefined {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'llm'
        || normalized === 'llm_adapter'
        || normalized === 'llm-adapter'
    ) {
        return 'llm-adapter';
    }
    if (
        normalized === 'rule'
        || normalized === 'rule_engine'
        || normalized === 'rule-engine'
    ) {
        return 'rule-engine';
    }
    return undefined;
}

function normalizeTutorVerificationStatusToken(
    rawValue: unknown
): TutorTraceDiagnosticsRequest['verificationStatus'] | undefined {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'verified') {
        return 'verified';
    }
    if (
        normalized === 'pending'
        || normalized === 'pending_verification'
        || normalized === 'pending-verification'
    ) {
        return 'pending_verification';
    }
    return undefined;
}

function normalizeTutorAdapterTraceOutcomeToken(
    rawValue: unknown
): TutorTraceDiagnosticsRequest['adapterOutcome'] | undefined {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'accepted') {
        return 'accepted';
    }
    if (normalized === 'downgraded') {
        return 'downgraded';
    }
    if (normalized === 'failed') {
        return 'failed';
    }
    if (normalized === 'not_used' || normalized === 'not-used' || normalized === 'notused') {
        return 'not_used';
    }
    return undefined;
}

function normalizeTutorTraceDiagnosticsRequestFromQuery(query: URLSearchParams): TutorTraceDiagnosticsRequest {
    const providerMode = normalizeTutorProviderModePreference(query.get('providerMode'));
    const fallbackUsed = parseBooleanFlagOrUndefined(
        query.get('fallbackUsed') ?? query.get('providerFallbackUsed')
    );
    const requestPayload: TutorTraceDiagnosticsRequest = {
        userId: String(query.get('userId') || '').trim() || undefined,
        source: normalizeTutorTraceSourceToken(query.get('source')),
        actionKind: normalizeTutorActionKindOrUndefined(query.get('actionKind')),
        verificationStatus: normalizeTutorVerificationStatusToken(
            query.get('verificationStatus') ?? query.get('verification')
        ),
        adapterOutcome: normalizeTutorAdapterTraceOutcomeToken(
            query.get('adapterOutcome') ?? query.get('outcome')
        ),
        adapterId: String(query.get('adapterId') || '').trim() || undefined,
        providerName: String(query.get('providerName') || '').trim() || undefined,
        providerMode: providerMode === 'local' || providerMode === 'cloud' ? providerMode : undefined,
        fallbackUsed,
        limit: parsePositiveIntegerValue(query.get('limit')) || undefined,
    };
    return requestPayload;
}

function normalizeTutorProviderTrendDiagnosticsRequestFromQuery(
    query: URLSearchParams
): TutorProviderTrendDiagnosticsRequest {
    const providerMode = normalizeTutorProviderModePreference(query.get('providerMode'));
    const requestPayload: TutorProviderTrendDiagnosticsRequest = {
        userId: String(query.get('userId') || '').trim() || undefined,
        source: normalizeTutorTraceSourceToken(query.get('source')),
        providerMode: providerMode === 'local' || providerMode === 'cloud' ? providerMode : undefined,
        limit: parsePositiveIntegerValue(query.get('limit')) || undefined,
        windowSize: parsePositiveIntegerValue(query.get('windowSize') ?? query.get('window')) || undefined,
        minSamples: parsePositiveIntegerValue(query.get('minSamples') ?? query.get('min')) || undefined,
    };
    return requestPayload;
}

function normalizeTutorProviderTrendHistoryRequestFromQuery(
    query: URLSearchParams
): TutorProviderTrendHistoryRequest {
    const providerMode = normalizeTutorProviderModePreference(query.get('providerMode'));
    const requestPayload: TutorProviderTrendHistoryRequest = {
        userId: String(query.get('userId') || '').trim() || undefined,
        source: normalizeTutorTraceSourceToken(query.get('source')),
        providerMode: providerMode === 'local' || providerMode === 'cloud' ? providerMode : undefined,
        limit: parsePositiveIntegerValue(query.get('limit')) || undefined,
        windowSize: parsePositiveIntegerValue(query.get('windowSize') ?? query.get('window')) || undefined,
        minSamples: parsePositiveIntegerValue(query.get('minSamples') ?? query.get('min')) || undefined,
    };
    return requestPayload;
}

function normalizeTutorActionRequestPayload(payload: unknown): TutorActionRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const userId = String(record.userId || '').trim();
    const actionKindRaw = readFirstNonEmptyString(record, ['actionKind', 'tutorActionKind', 'kind']);
    const actionKind = normalizeTutorActionKind(actionKindRaw);
    const providerModeRaw = readFirstNonEmptyString(record, ['providerMode', 'tutorProviderMode']);

    return {
        userId,
        actionKind,
        atomId: readFirstNonEmptyString(record, ['atomId']),
        prompt: readFirstNonEmptyString(record, ['prompt']),
        answer: readFirstNonEmptyString(record, ['answer']),
        adapterId: readFirstNonEmptyString(record, ['adapterId', 'tutorAdapterId']),
        providerName: readFirstNonEmptyString(record, ['providerName', 'tutorProviderName']),
        providerMode: normalizeTutorProviderModePreference(providerModeRaw),
    };
}

function normalizeKnowledgeQueryRequestPayload(payload: unknown): KnowledgeQueryRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const query = readFirstNonEmptyString(record, ['query', 'q']) || '';
    const topKValue = parsePositiveIntegerValue(readFirstPresentValue(record, ['topK', 'k', 'limit']));
    const asOf = readFirstNonEmptyString(record, ['asOf', 'as_of', 'timestamp']);
    const queryBackend = readFirstNonEmptyString(record, ['queryBackend', 'backend', 'query_backend']);
    const nestedScope = isObjectRecord(record.scope) ? record.scope : {};
    const normalizeStringList = (value: unknown, transform?: (entry: string) => string): string[] => {
        const entries = Array.isArray(value) ? value : [];
        return Array.from(new Set(
            entries
                .map((entry) => String(entry || '').trim())
                .map((entry) => transform ? transform(entry) : entry)
                .filter(Boolean)
        ));
    };
    const normalizePathPrefix = (value: string): string => (
        value.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/g, '')
    );
    const workspaceId = readFirstNonEmptyString(record, ['workspaceId', 'workspace_id'])
        || readFirstNonEmptyString(nestedScope, ['workspaceId', 'workspace_id']);
    const corpusId = readFirstNonEmptyString(record, ['corpusId', 'corpus_id'])
        || readFirstNonEmptyString(nestedScope, ['corpusId', 'corpus_id']);
    const documentIds = normalizeStringList(
        readFirstPresentValue(record, ['documentIds', 'document_ids'])
        ?? readFirstPresentValue(nestedScope, ['documentIds', 'document_ids'])
    );
    const atomIds = normalizeStringList(
        readFirstPresentValue(record, ['atomIds', 'atom_ids'])
        ?? readFirstPresentValue(nestedScope, ['atomIds', 'atom_ids'])
    );
    const sourcePathPrefixes = normalizeStringList(
        readFirstPresentValue(record, ['sourcePathPrefixes', 'source_path_prefixes'])
        ?? readFirstPresentValue(nestedScope, ['sourcePathPrefixes', 'source_path_prefixes']),
        normalizePathPrefix
    );
    const languages = normalizeStringList(
        readFirstPresentValue(record, ['languages', 'languageScope'])
        ?? readFirstPresentValue(nestedScope, ['languages', 'languageScope']),
        (entry) => entry.toLowerCase()
    );
    return {
        query,
        topK: topKValue > 0 ? topKValue : undefined,
        asOf,
        queryBackend,
        scope: workspaceId || corpusId || documentIds.length > 0 || atomIds.length > 0 || sourcePathPrefixes.length > 0 || languages.length > 0
            ? {
                workspaceId: workspaceId || undefined,
                corpusId: corpusId || undefined,
                documentIds: documentIds.length > 0 ? documentIds : undefined,
                atomIds: atomIds.length > 0 ? atomIds : undefined,
                sourcePathPrefixes: sourcePathPrefixes.length > 0 ? sourcePathPrefixes : undefined,
                languages: languages.length > 0 ? languages : undefined,
            }
            : undefined,
    };
}

function requestAcceptsEventStream(req: http.IncomingMessage): boolean {
    const acceptHeader = String(req.headers.accept || '').toLowerCase();
    return acceptHeader.includes('text/event-stream');
}

function readSingleHeaderValue(req: http.IncomingMessage, headerName: string): string {
    const raw = req.headers[headerName.toLowerCase()];
    if (Array.isArray(raw)) {
        return String(raw[0] || '').trim();
    }
    return String(raw || '').trim();
}

function normalizeAgentConversationTurnIdCandidate(value: unknown): string {
    const candidate = String(value || '').trim();
    if (!candidate || candidate.length > 160) {
        return '';
    }
    return (/^[a-zA-Z0-9._:-]+$/).test(candidate)
        ? candidate
        : '';
}

function buildAgentConversationTurnId(requestId: string): string {
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const timestamp = Date.now().toString(36);
    return `turn_${requestId}_${timestamp}_${randomSuffix}`;
}

function resolveAgentConversationTurnId(req: http.IncomingMessage, requestId: string): string {
    const requestedTurnId = normalizeAgentConversationTurnIdCandidate(
        readSingleHeaderValue(req, AGENT_CONVERSATION_TURN_ID_HEADER)
    );
    if (requestedTurnId) {
        return requestedTurnId;
    }
    const resumeTurnId = normalizeAgentConversationTurnIdCandidate(
        readSingleHeaderValue(req, AGENT_CONVERSATION_RESUME_TURN_ID_HEADER)
    );
    if (resumeTurnId) {
        return resumeTurnId;
    }
    return buildAgentConversationTurnId(requestId);
}

function normalizeAgentConversationTopK(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 6;
    }
    return Math.max(1, Math.floor(numeric));
}

function buildAgentConversationRequestFingerprint(requestPayload: AgentConversationRequest): string {
    const scope = requestPayload.scope;
    const normalizedScope = scope
        ? {
            workspaceId: String(scope.workspaceId || '').trim(),
            corpusId: String(scope.corpusId || '').trim(),
            documentIds: Array.from(new Set(scope.documentIds || [])).sort(),
            atomIds: Array.from(new Set(scope.atomIds || [])).sort(),
            sourcePathPrefixes: Array.from(new Set(scope.sourcePathPrefixes || [])).sort(),
            languages: Array.from(new Set(scope.languages || [])).sort(),
        }
        : null;
    return JSON.stringify({
        userId: String(requestPayload.userId || '').trim(),
        sessionId: String(requestPayload.sessionId || '').trim(),
        activeTarget: String(requestPayload.activeTarget || '').trim(),
        message: String(requestPayload.message || '').trim(),
        answerLanguage: String(requestPayload.answerLanguage || 'auto').trim(),
        responseProfile: String(requestPayload.responseProfile || 'default').trim(),
        topK: normalizeAgentConversationTopK(requestPayload.topK),
        asOf: String(requestPayload.asOf || '').trim(),
        persistMemory: requestPayload.persistMemory !== false,
        memoryNamespace: String(requestPayload.memoryNamespace || '').trim(),
        scope: normalizedScope,
    });
}

function pruneAgentConversationTurnCache(nowMs = Date.now()): void {
    let evictedByTtl = 0;
    let evictedByCapacity = 0;
    for (const [turnId, record] of AGENT_CONVERSATION_TURN_CACHE.entries()) {
        if (
            record.status !== 'running'
            && nowMs - record.updatedAtMs > AGENT_CONVERSATION_TURN_CACHE_TTL_MS
        ) {
            AGENT_CONVERSATION_TURN_CACHE.delete(turnId);
            evictedByTtl += 1;
        }
    }
    if (AGENT_CONVERSATION_TURN_CACHE.size > AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES) {
        const evictable = Array.from(AGENT_CONVERSATION_TURN_CACHE.entries())
            .filter(([, record]) => record.status !== 'running')
            .sort((left, right) => left[1].updatedAtMs - right[1].updatedAtMs);
        for (const [turnId] of evictable) {
            if (AGENT_CONVERSATION_TURN_CACHE.size <= AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES) {
                break;
            }
            AGENT_CONVERSATION_TURN_CACHE.delete(turnId);
            evictedByCapacity += 1;
        }
    }

    if (evictedByTtl > 0) {
        AGENT_CONVERSATION_TURN_CACHE_COUNTERS.evictedByTtlCount += evictedByTtl;
    }
    if (evictedByCapacity > 0) {
        AGENT_CONVERSATION_TURN_CACHE_COUNTERS.evictedByCapacityCount += evictedByCapacity;
    }
    if (evictedByTtl > 0 || evictedByCapacity > 0) {
        AGENT_CONVERSATION_TURN_CACHE_COUNTERS.lastPrunedAt = new Date(nowMs).toISOString();
    }
}

function getOrCreateAgentConversationTurnCacheRecord(
    turnId: string,
    requestFingerprint: string
): AgentConversationTurnCacheRecord {
    pruneAgentConversationTurnCache();
    const existing = AGENT_CONVERSATION_TURN_CACHE.get(turnId);
    if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
            AGENT_CONVERSATION_TURN_CACHE_COUNTERS.conflictCount += 1;
            AGENT_CONVERSATION_TURN_CACHE_COUNTERS.lastConflictAt = new Date().toISOString();
            throw new InvalidRequestError(
                'Provided turnId does not match the submitted conversation payload.',
                {
                    errorCode: 'turn_id_conflict',
                }
            );
        }
        AGENT_CONVERSATION_TURN_CACHE_COUNTERS.cacheHitCount += 1;
        return existing;
    }

    AGENT_CONVERSATION_TURN_CACHE_COUNTERS.cacheMissCount += 1;
    const nowMs = Date.now();
    const record: AgentConversationTurnCacheRecord = {
        turnId,
        requestFingerprint,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        status: 'running',
        events: [],
    };
    AGENT_CONVERSATION_TURN_CACHE.set(turnId, record);
    pruneAgentConversationTurnCache(nowMs);
    return record;
}

function appendAgentConversationTurnCacheEvent(
    record: AgentConversationTurnCacheRecord,
    event: AgentConversationTurnEvent
): void {
    if (record.events.length >= AGENT_CONVERSATION_TURN_CACHE_MAX_EVENTS_PER_TURN) {
        record.events.shift();
    }
    record.events.push(event);
    record.updatedAtMs = Date.now();
}

function replayAgentConversationTurnEvents(
    res: http.ServerResponse,
    record: AgentConversationTurnCacheRecord,
    requestPayload?: AgentConversationRequest
): void {
    AGENT_CONVERSATION_TURN_CACHE_COUNTERS.replayResponseCount += 1;
    AGENT_CONVERSATION_TURN_CACHE_COUNTERS.replayedEventCount += record.events.length;
    for (const event of record.events) {
        writeSseEvent(res, event.type, projectAgentConversationTurnEvent(event, requestPayload));
    }
}

function buildMobileAgentConversationResponse(result: AgentConversationResponse): Record<string, unknown> {
    const projection = result.mobileProjection || projectAnswerForMobile(result);
    const summary = result.summary || {
        generatedAt: new Date().toISOString(),
        topK: 0,
        queryEvidenceCoverageRatioPct: 0,
    };
    return {
        userId: result.userId,
        sessionId: result.sessionId,
        assistantMessage: projection.directAnswer,
        answer: projection.directAnswer,
        message: projection.directAnswer,
        responseProfile: 'mobile_compact',
        mobileProjection: projection,
        assistantBlocks: [],
        knowledgePoints: [],
        citations: [],
        recalledMemories: [],
        memoryActions: [],
        summary: {
            generatedAt: summary.generatedAt,
            topK: summary.topK,
            returnedKnowledgePoints: projection.route.length,
            returnedCitations: projection.citations.length,
            recalledMemoryCount: 0,
            appliedMemoryCount: 0,
            queryEvidenceCoverageRatioPct: summary.queryEvidenceCoverageRatioPct,
        },
    };
}

function projectAgentConversationTurnEvent(
    event: AgentConversationTurnEvent,
    requestPayload?: AgentConversationRequest
): AgentConversationTurnEvent {
    if (
        requestPayload?.responseProfile !== 'mobile_compact'
        || event.type !== 'turn_completed'
        || !event.result
    ) {
        return event;
    }
    return {
        ...event,
        result: buildMobileAgentConversationResponse(event.result) as unknown as AgentConversationResponse,
    };
}

function buildAgentConversationInitialTurnEvents(params: {
    turnId: string;
    emittedAt: string;
    requestPayload: AgentConversationRequest;
    topK: number;
}): AgentConversationTurnEvent[] {
    return [
        {
            type: 'turn_started',
            turnId: params.turnId,
            emittedAt: params.emittedAt,
            request: {
                userId: params.requestPayload.userId,
                topK: params.topK,
            },
        },
        {
            type: 'capability_planned',
            turnId: params.turnId,
            emittedAt: params.emittedAt,
            capabilities: [
                'query_local_knowledge',
                'compose_assistant_message',
                'emit_typed_capabilities',
            ],
        },
        {
            type: 'capability_progress',
            turnId: params.turnId,
            emittedAt: params.emittedAt,
            stage: 'query_local_knowledge',
            progressPct: 35,
        },
    ];
}

function emitAgentConversationInitialTurnEvents(params: {
    record: AgentConversationTurnCacheRecord;
    requestPayload: AgentConversationRequest;
    topK: number;
    emittedAt: string;
    writeLiveEvent?: (event: AgentConversationTurnEvent) => void;
}): void {
    if (params.record.events.some((event) => event.type === 'turn_started')) {
        return;
    }
    const events = buildAgentConversationInitialTurnEvents({
        turnId: params.record.turnId,
        emittedAt: params.emittedAt,
        requestPayload: params.requestPayload,
        topK: params.topK,
    });
    events.forEach((event) => {
        appendAgentConversationTurnCacheEvent(params.record, event);
        if (params.writeLiveEvent) {
            params.writeLiveEvent(event);
        }
    });
}

async function ensureAgentConversationTurnExecution(
    record: AgentConversationTurnCacheRecord,
    requestPayload: AgentConversationRequest,
    options: {
        emitLiveEvent?: (event: AgentConversationTurnEvent) => void;
    } = {}
): Promise<AgentConversationTurnCacheRecord> {
    if (record.status === 'completed' || record.status === 'failed') {
        return record;
    }
    if (record.inFlight) {
        AGENT_CONVERSATION_TURN_CACHE_COUNTERS.inFlightJoinCount += 1;
        await record.inFlight;
        return record;
    }

    const topK = normalizeAgentConversationTopK(requestPayload.topK);
    const emitLiveEvent = options.emitLiveEvent;
    const emit = (event: AgentConversationTurnEvent): void => {
        appendAgentConversationTurnCacheEvent(record, event);
        if (emitLiveEvent) {
            emitLiveEvent(event);
        }
    };
    const nowIso = (): string => new Date().toISOString();

    const execution = (async () => {
        AGENT_CONVERSATION_TURN_CACHE_COUNTERS.executionStartCount += 1;
        emitAgentConversationInitialTurnEvents({
            record,
            requestPayload,
            topK,
            emittedAt: nowIso(),
            writeLiveEvent: emitLiveEvent,
        });

        try {
            const hydration = await ensureLearningWorkspaceHydratedForConversationRequest(requestPayload);
            emit({
                type: 'capability_result',
                turnId: record.turnId,
                emittedAt: nowIso(),
                stage: 'workspace_readiness_gate',
                summary: {
                    hydrated: hydration.hydrated,
                    target: hydration.target,
                    reason: hydration.reason,
                    workspaceId: hydration.scope?.workspaceId || null,
                    corpusId: hydration.scope?.corpusId || null,
                },
            });
            const result = await knowledgeLearningPlatform.runAgentConversation(requestPayload);
            record.status = 'completed';
            record.result = result;
            record.failure = undefined;
            AGENT_CONVERSATION_TURN_CACHE_COUNTERS.executionSuccessCount += 1;
            emit({
                type: 'capability_result',
                turnId: record.turnId,
                emittedAt: nowIso(),
                stage: 'query_local_knowledge',
                summary: {
                    returnedKnowledgePoints: Number(result.summary.returnedKnowledgePoints || 0),
                    queryEvidenceCoverageRatioPct: Number(result.summary.queryEvidenceCoverageRatioPct || 0),
                },
            });
            emit({
                type: 'turn_completed',
                turnId: record.turnId,
                emittedAt: nowIso(),
                result,
            });
        } catch (executionError) {
            const validation = classifyApiInputValidationError(executionError);
            const failure: AgentConversationTurnExecutionFailure = {
                error: validation?.error || String(
                    (executionError as Error | undefined)?.message
                    || executionError
                    || 'unknown_error'
                ),
                errorCode: validation?.errorCode || 'internal_error',
            };
            if (!validation) {
                console.error(executionError);
                CrashLogger.log(executionError, 'API:POST /api/knowledge/conversation [turn-cache]');
            }
            record.status = 'failed';
            record.result = undefined;
            record.failure = failure;
            AGENT_CONVERSATION_TURN_CACHE_COUNTERS.executionFailureCount += 1;
            emit({
                type: 'turn_failed',
                turnId: record.turnId,
                emittedAt: nowIso(),
                error: failure.error,
                errorCode: failure.errorCode,
            });
        } finally {
            record.updatedAtMs = Date.now();
        }
    })();

    record.inFlight = execution;
    try {
        await execution;
    } finally {
        if (record.inFlight === execution) {
            record.inFlight = undefined;
        }
        pruneAgentConversationTurnCache();
    }
    return record;
}

function throwAgentConversationCachedFailure(failureLike: AgentConversationTurnExecutionFailure | undefined): never {
    const failure = failureLike || {
        error: 'conversation_turn_failed',
        errorCode: 'internal_error',
    };
    if (failure.errorCode && failure.errorCode !== 'internal_error') {
        throw new InvalidRequestError(failure.error, {
            errorCode: failure.errorCode,
        });
    }
    throw new Error(failure.error || 'conversation_turn_failed');
}

function getAgentConversationTurnCacheDiagnostics(options: { prune?: boolean } = {}): {
    generatedAt: string;
    config: {
        ttlMs: number;
        maxEntries: number;
        maxEventsPerTurn: number;
        alertThresholds: AgentConversationTurnCacheAlertThresholds;
    };
    state: {
        totalEntries: number;
        runningEntries: number;
        completedEntries: number;
        failedEntries: number;
        inFlightEntries: number;
        utilizationPct: number;
        staleEligibleEntries: number;
        oldestEntryAgeMs: number;
        newestEntryAgeMs: number;
    };
    counters: AgentConversationTurnCacheCounters & {
        cacheHitRatioPct: number;
        executionFailureRatioPct: number;
    };
    alerts: {
        summaryStatus: AgentConversationTurnCacheAlertSeverity;
        failingCheckCount: number;
        warnCheckCount: number;
        failCheckCount: number;
        checks: AgentConversationTurnCacheAlertCheck[];
    };
} {
    if (options.prune) {
        pruneAgentConversationTurnCache();
    }
    const nowMs = Date.now();
    let runningEntries = 0;
    let completedEntries = 0;
    let failedEntries = 0;
    let inFlightEntries = 0;
    let staleEligibleEntries = 0;
    let oldestCreatedAtMs = nowMs;
    let newestCreatedAtMs = 0;
    for (const record of AGENT_CONVERSATION_TURN_CACHE.values()) {
        if (record.status === 'running') {
            runningEntries += 1;
        } else if (record.status === 'completed') {
            completedEntries += 1;
        } else if (record.status === 'failed') {
            failedEntries += 1;
        }
        if (record.inFlight) {
            inFlightEntries += 1;
        }
        if (
            record.status !== 'running'
            && nowMs - record.updatedAtMs > AGENT_CONVERSATION_TURN_CACHE_TTL_MS
        ) {
            staleEligibleEntries += 1;
        }
        oldestCreatedAtMs = Math.min(oldestCreatedAtMs, record.createdAtMs);
        newestCreatedAtMs = Math.max(newestCreatedAtMs, record.createdAtMs);
    }
    const totalEntries = AGENT_CONVERSATION_TURN_CACHE.size;
    const cacheRequests = (
        AGENT_CONVERSATION_TURN_CACHE_COUNTERS.cacheHitCount
        + AGENT_CONVERSATION_TURN_CACHE_COUNTERS.cacheMissCount
    );
    const cacheHitRatioPct = cacheRequests > 0
        ? Number(
            (
                AGENT_CONVERSATION_TURN_CACHE_COUNTERS.cacheHitCount
                / cacheRequests
                * 100
            ).toFixed(4)
        )
        : 0;
    const executionFailureRatioPct = AGENT_CONVERSATION_TURN_CACHE_COUNTERS.executionStartCount > 0
        ? Number(
            (
                AGENT_CONVERSATION_TURN_CACHE_COUNTERS.executionFailureCount
                / AGENT_CONVERSATION_TURN_CACHE_COUNTERS.executionStartCount
                * 100
            ).toFixed(4)
        )
        : 0;
    const utilizationPct = Number(
        (
            totalEntries
            / Math.max(1, AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES)
            * 100
        ).toFixed(4)
    );
    const alertChecks: AgentConversationTurnCacheAlertCheck[] = [
        buildTurnCacheAlertCheck(
            'utilization_pct',
            utilizationPct,
            AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS.utilizationWarnPct,
            AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS.utilizationFailPct
        ),
        buildTurnCacheAlertCheck(
            'execution_failure_ratio_pct',
            executionFailureRatioPct,
            AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS.executionFailureRatioWarnPct,
            AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS.executionFailureRatioFailPct
        ),
        buildTurnCacheAlertCheck(
            'conflict_count',
            Number(AGENT_CONVERSATION_TURN_CACHE_COUNTERS.conflictCount || 0),
            AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS.conflictWarnCount,
            AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS.conflictFailCount
        ),
        buildTurnCacheAlertCheck(
            'stale_eligible_entries',
            Number(staleEligibleEntries || 0),
            AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS.staleEligibleWarnCount,
            AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS.staleEligibleFailCount
        ),
    ];
    const warnCheckCount = alertChecks.filter((check) => check.severity === 'warn').length;
    const failCheckCount = alertChecks.filter((check) => check.severity === 'fail').length;
    const failingCheckCount = warnCheckCount + failCheckCount;
    const summaryStatus = resolveAgentConversationTurnCacheAlertSummaryStatus(alertChecks);
    const topAlertCheck = resolveTurnCacheAlertTopCheck(alertChecks);
    appendAgentConversationTurnCacheAlertHistoryRecord({
        sampledAt: new Date(nowMs).toISOString(),
        sampledAtMs: nowMs,
        summaryStatus,
        failingCheckCount,
        warnCheckCount,
        failCheckCount,
        topCheckId: topAlertCheck ? topAlertCheck.checkId : '',
        topCheckSeverity: topAlertCheck ? topAlertCheck.severity : 'pass',
        topCheckValue: topAlertCheck ? Number(topAlertCheck.value) : 0,
        utilizationPct,
        executionFailureRatioPct,
        conflictCount: Number(AGENT_CONVERSATION_TURN_CACHE_COUNTERS.conflictCount || 0),
        staleEligibleEntries: Number(staleEligibleEntries || 0),
        totalEntries,
    });
    return {
        generatedAt: new Date(nowMs).toISOString(),
        config: {
            ttlMs: AGENT_CONVERSATION_TURN_CACHE_TTL_MS,
            maxEntries: AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES,
            maxEventsPerTurn: AGENT_CONVERSATION_TURN_CACHE_MAX_EVENTS_PER_TURN,
            alertThresholds: {
                ...AGENT_CONVERSATION_TURN_CACHE_ALERT_THRESHOLDS,
            },
        },
        state: {
            totalEntries,
            runningEntries,
            completedEntries,
            failedEntries,
            inFlightEntries,
            utilizationPct,
            staleEligibleEntries,
            oldestEntryAgeMs: totalEntries > 0
                ? Math.max(0, nowMs - oldestCreatedAtMs)
                : 0,
            newestEntryAgeMs: totalEntries > 0
                ? Math.max(0, nowMs - newestCreatedAtMs)
                : 0,
        },
        counters: {
            ...AGENT_CONVERSATION_TURN_CACHE_COUNTERS,
            cacheHitRatioPct,
            executionFailureRatioPct,
        },
        alerts: {
            summaryStatus,
            failingCheckCount,
            warnCheckCount,
            failCheckCount,
            checks: alertChecks,
        },
    };
}

function normalizeKnowledgeStalenessStatusList(
    rawValue: unknown
): NonNullable<KnowledgeStalenessDiagnosticsRequest['statuses']> {
    const candidates = Array.isArray(rawValue)
        ? rawValue
        : String(rawValue || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    return Array.from(new Set(candidates.map((item) => String(item || '').trim())))
        .filter((status) =>
            status === 'up_to_date'
            || status === 'hash_mismatch'
            || status === 'missing_source'
            || status === 'read_error'
        ) as NonNullable<KnowledgeStalenessDiagnosticsRequest['statuses']>;
}

function normalizeKnowledgeStalenessDiagnosticsRequestFromQuery(
    query: URLSearchParams,
    fallbackLimit: number
): KnowledgeStalenessDiagnosticsRequest {
    const statusCandidates = [
        ...query.getAll('status'),
        ...query.getAll('statuses').flatMap((item) => String(item || '').split(',')),
    ];
    const statuses = normalizeKnowledgeStalenessStatusList(statusCandidates);
    const limit = parsePositiveIntegerValue(query.get('limit')) || fallbackLimit;
    const sourcePathPrefix = String(query.get('sourcePathPrefix') || '').trim().replace(/\\/g, '/');
    return {
        limit,
        sourcePathPrefix: sourcePathPrefix || undefined,
        statuses: statuses.length > 0 ? statuses : undefined,
    };
}

function normalizeRelationRecomputeModeValue(
    rawValue: unknown
): KnowledgeIngestRequest['relationRecomputeMode'] | undefined {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (normalized === 'none' || normalized === 'off' || normalized === 'disable') {
        return 'none';
    }
    if (normalized === 'incremental' || normalized === 'diff' || normalized === 'delta') {
        return 'incremental';
    }
    if (normalized === 'full' || normalized === 'recompute' || normalized === 'rebuild') {
        return 'full';
    }
    if (normalized === 'auto') {
        return 'auto';
    }
    return undefined;
}

function normalizeKnowledgeDocumentInputPayload(
    payload: unknown
): NonNullable<KnowledgeIngestRequest['documents']>[number] | null {
    const record = isObjectRecord(payload) ? payload : {};
    const documentId = readFirstNonEmptyString(record, ['documentId', 'docId', 'id']);
    const sourcePath = readFirstNonEmptyString(record, [
        'sourcePath',
        'source_path',
        'path',
        'filePath',
        'filepath',
        'file',
    ]);
    const contentRaw = readFirstPresentValue(record, ['content', 'text', 'body', 'markdown']);
    const content = typeof contentRaw === 'string'
        ? contentRaw
        : String(contentRaw ?? '');
    const language = readFirstNonEmptyString(record, ['language', 'lang', 'locale']);
    const updatedAt = readFirstNonEmptyString(record, ['updatedAt', 'updated_at', 'timestamp', 'now']);
    const sourceUri = readFirstNonEmptyString(record, ['sourceUri', 'source_uri', 'uri']);
    const revision = readFirstNonEmptyString(record, ['revision', 'sourceRevision', 'source_revision']);
    const identityAliases = normalizeStringArrayValue(
        readFirstPresentValue(record, ['identityAliases', 'identity_aliases', 'aliases'])
    );
    if (!documentId && !sourcePath && !content.trim()) {
        return null;
    }
    return {
        documentId,
        sourcePath: sourcePath || '',
        sourceUri,
        revision,
        identityAliases: identityAliases.length > 0 ? identityAliases : undefined,
        content,
        language,
        updatedAt,
    };
}

function normalizeKnowledgeDocumentDeletePayload(
    payload: unknown
): NonNullable<KnowledgeIngestRequest['deletedDocuments']>[number] | null {
    const record = isObjectRecord(payload) ? payload : {};
    const documentId = readFirstNonEmptyString(record, ['documentId', 'docId', 'id']);
    const sourcePath = readFirstNonEmptyString(record, [
        'sourcePath',
        'source_path',
        'path',
        'filePath',
        'filepath',
        'file',
    ]);
    const sourceUri = readFirstNonEmptyString(record, ['sourceUri', 'source_uri', 'uri']);
    const identityAliases = normalizeStringArrayValue(
        readFirstPresentValue(record, ['identityAliases', 'identity_aliases', 'aliases'])
    );
    if (!documentId && !sourcePath && !sourceUri && identityAliases.length === 0) {
        return null;
    }
    return {
        documentId,
        sourcePath,
        sourceUri,
        identityAliases: identityAliases.length > 0 ? identityAliases : undefined,
    };
}

function normalizeKnowledgeIngestOperationPayload(
    payload: unknown
): NonNullable<KnowledgeIngestRequest['operations']>[number] | null {
    const record = isObjectRecord(payload) ? payload : {};
    const opRaw = readFirstNonEmptyString(record, ['op', 'operation', 'action', 'type']);
    const normalizedOp = String(opRaw || '').trim().toLowerCase();
    const documentRaw = readFirstPresentValue(record, ['document', 'payload', 'item']);
    const operationPayload = typeof documentRaw !== 'undefined' ? documentRaw : payload;
    if (
        normalizedOp === 'move'
        || normalizedOp === 'rename'
    ) {
        const moveRecord = isObjectRecord(operationPayload) ? operationPayload : {};
        const toSourcePath = readFirstNonEmptyString(moveRecord, [
            'toSourcePath',
            'to_source_path',
            'destinationPath',
            'destination_path',
        ]);
        if (!toSourcePath) {
            return null;
        }
        return {
            op: 'move',
            document: {
                documentId: readFirstNonEmptyString(moveRecord, ['documentId', 'docId', 'id']),
                fromSourcePath: readFirstNonEmptyString(moveRecord, ['fromSourcePath', 'from_source_path', 'sourcePath', 'source_path']),
                fromSourceUri: readFirstNonEmptyString(moveRecord, ['fromSourceUri', 'from_source_uri', 'sourceUri', 'source_uri']),
                fromIdentityAliases: normalizeStringArrayValue(
                    readFirstPresentValue(moveRecord, ['fromIdentityAliases', 'from_identity_aliases', 'fromAliases'])
                ),
                toSourcePath,
                toSourceUri: readFirstNonEmptyString(moveRecord, ['toSourceUri', 'to_source_uri', 'destinationUri', 'destination_uri']),
                toIdentityAliases: normalizeStringArrayValue(
                    readFirstPresentValue(moveRecord, ['toIdentityAliases', 'to_identity_aliases', 'aliases'])
                ),
                revision: readFirstNonEmptyString(moveRecord, ['revision', 'sourceRevision', 'source_revision']),
                updatedAt: readFirstNonEmptyString(moveRecord, ['updatedAt', 'updated_at', 'timestamp', 'now']),
            },
        };
    }
    if (
        normalizedOp === 'delete'
        || normalizedOp === 'remove'
        || normalizedOp === 'del'
    ) {
        const normalizedDelete = normalizeKnowledgeDocumentDeletePayload(operationPayload);
        return normalizedDelete ? { op: 'delete', document: normalizedDelete } : null;
    }
    if (
        normalizedOp === 'upsert'
        || normalizedOp === 'insert'
        || normalizedOp === 'update'
        || normalizedOp === 'put'
        || !normalizedOp
    ) {
        const normalizedUpsert = normalizeKnowledgeDocumentInputPayload(operationPayload);
        return normalizedUpsert ? { op: 'upsert', document: normalizedUpsert } : null;
    }
    return null;
}

function normalizeKnowledgeIngestRequestPayload(payload: unknown): KnowledgeIngestRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const documentsRaw = readFirstPresentValue(record, ['documents', 'docs', 'items']);
    const deletedDocumentsRaw = readFirstPresentValue(record, ['deletedDocuments', 'deleted', 'deletes']);
    const operationsRaw = readFirstPresentValue(record, ['operations', 'ops']);
    const docsArray = Array.isArray(documentsRaw)
        ? documentsRaw
        : (Array.isArray(payload) ? payload : (documentsRaw ? [documentsRaw] : []));
    const deletedArray = Array.isArray(deletedDocumentsRaw)
        ? deletedDocumentsRaw
        : (deletedDocumentsRaw ? [deletedDocumentsRaw] : []);
    const operationsArray = Array.isArray(operationsRaw)
        ? operationsRaw
        : (operationsRaw ? [operationsRaw] : []);
    const documents = docsArray
        .map((item) => normalizeKnowledgeDocumentInputPayload(item))
        .filter((item): item is NonNullable<KnowledgeIngestRequest['documents']>[number] => Boolean(item));
    const deletedDocuments = deletedArray
        .map((item) => normalizeKnowledgeDocumentDeletePayload(item))
        .filter((item): item is NonNullable<KnowledgeIngestRequest['deletedDocuments']>[number] => Boolean(item));
    const operations = operationsArray
        .map((item) => normalizeKnowledgeIngestOperationPayload(item))
        .filter((item): item is NonNullable<KnowledgeIngestRequest['operations']>[number] => Boolean(item));
    const incrementalRaw = readFirstPresentValue(record, ['incremental', 'isIncremental', 'diff', 'isDiff']);
    const recomputeRelationsRaw = readFirstPresentValue(record, [
        'recomputeRelations',
        'recompute_relations',
        'recompute',
    ]);
    const relationRecomputeModeRaw = readFirstPresentValue(record, [
        'relationRecomputeMode',
        'relation_recompute_mode',
        'recomputeMode',
        'mode',
    ]);
    const ingestedAt = readFirstNonEmptyString(record, ['ingestedAt', 'timestamp', 'now']);
    const incremental = parseBooleanFlagOrUndefined(incrementalRaw);
    const recomputeRelations = parseBooleanFlagOrUndefined(recomputeRelationsRaw);
    const relationRecomputeMode = normalizeRelationRecomputeModeValue(relationRecomputeModeRaw);
    return {
        documents: documents.length > 0 ? documents : undefined,
        deletedDocuments: deletedDocuments.length > 0 ? deletedDocuments : undefined,
        operations: operations.length > 0 ? operations : undefined,
        incremental,
        recomputeRelations,
        relationRecomputeMode,
        ingestedAt,
    };
}

function normalizeKnowledgeStalenessRebuildRequestPayload(payload: unknown): KnowledgeStalenessRebuildRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const statuses = normalizeKnowledgeStalenessStatusList(
        readFirstPresentValue(record, ['statuses', 'status'])
    );
    const limit = parsePositiveIntegerValue(readFirstPresentValue(record, ['limit', 'max', 'topK']));
    const sourcePathPrefix = String(
        readFirstNonEmptyString(record, ['sourcePathPrefix', 'source_prefix', 'pathPrefix']) || ''
    ).trim().replace(/\\/g, '/');
    const incrementalRaw = readFirstPresentValue(record, ['incremental', 'isIncremental', 'diff']);
    const dryRunRaw = readFirstPresentValue(record, ['dryRun', 'dry_run', 'preview', 'simulateOnly']);
    const batchSize = parsePositiveIntegerValue(
        readFirstPresentValue(record, ['batchSize', 'batch_size', 'chunkSize', 'chunk_size'])
    );
    const relationRecomputeModeRaw = readFirstPresentValue(record, [
        'relationRecomputeMode',
        'relation_recompute_mode',
        'recomputeMode',
        'mode',
    ]);
    const relationRecomputeMode = normalizeRelationRecomputeModeValue(relationRecomputeModeRaw);
    return {
        now: readFirstNonEmptyString(record, ['now', 'timestamp', 'ingestedAt']),
        limit: limit > 0 ? limit : undefined,
        statuses: statuses.length > 0 ? statuses : undefined,
        sourcePathPrefix: sourcePathPrefix || undefined,
        incremental: parseBooleanFlagOrUndefined(incrementalRaw),
        dryRun: parseBooleanFlagOrUndefined(dryRunRaw),
        batchSize: batchSize > 0 ? batchSize : undefined,
        relationRecomputeMode,
    };
}

function normalizeMasteryDiagnosticsRequestPayload(payload: unknown): MasteryDiagnosticsRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const observationsRaw = readFirstPresentValue(record, ['observations', 'items', 'results']);
    const observationCandidates = Array.isArray(observationsRaw)
        ? observationsRaw
        : (isObjectRecord(observationsRaw) ? [observationsRaw] : []);
    const observations = observationCandidates
        .filter((item) => isObjectRecord(item))
        .map((item) => {
            const atomId = readFirstNonEmptyString(item, ['atomId', 'atom_id', 'id']) || '';
            const outcome = normalizeMasteryOutcomeValue(
                readFirstNonEmptyString(item, ['outcome', 'result', 'masteryOutcome'])
            ) || 'skipped';
            const errorTag = readFirstNonEmptyString(item, ['errorTag', 'error_tag', 'mistakeTag']);
            const errorTags = normalizeStringArrayValue(readFirstPresentValue(item, ['errorTags', 'error_tags']));
            const responseTimeMs = parseFiniteNumberOrUndefined(
                readFirstPresentValue(item, ['responseTimeMs', 'response_time_ms', 'latencyMs'])
            );
            const confidence = parseFiniteNumberOrUndefined(readFirstPresentValue(item, ['confidence', 'score']));
            return {
                atomId,
                outcome,
                errorTag,
                errorTags: errorTags.length > 0 ? errorTags : undefined,
                responseTimeMs,
                confidence,
            };
        })
        .filter((item) => item.atomId.length > 0);

    return {
        userId: readFirstNonEmptyString(record, ['userId', 'user_id', 'learnerId']) || '',
        observations,
        observedAt: readFirstNonEmptyString(record, ['observedAt', 'observed_at', 'timestamp', 'now']),
    };
}

function normalizeMasteryMisconceptionRequestPayload(payload: unknown): MasteryMisconceptionRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const atomIds = normalizeStringArrayValue(readFirstPresentValue(record, ['atomIds', 'atom_ids', 'focusAtomIds']));
    const topK = parsePositiveIntegerValue(readFirstPresentValue(record, ['topK', 'k', 'limit']));
    return {
        userId: readFirstNonEmptyString(record, ['userId', 'user_id', 'learnerId']) || '',
        atomIds: atomIds.length > 0 ? atomIds : undefined,
        topK: topK > 0 ? topK : undefined,
        generatedAt: readFirstNonEmptyString(record, ['generatedAt', 'generated_at', 'timestamp', 'now']),
    };
}

function normalizeLearningPathStrategyToken(
    rawValue: unknown
): NonNullable<LearningPathRequest['strategy']> | undefined {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'balanced' || normalized === 'mastery_recovery' || normalized === 'exploration_boost') {
        return normalized;
    }
    return undefined;
}

function normalizeStudySessionPathStrategySelectionSourceFilterToken(
    rawValue: unknown
): StudySessionHistoryRequest['pathStrategySelectionSource'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'explicit_request' || normalized === 'strategy_trend' || normalized === 'mode_fallback') {
        return normalized;
    }
    if (normalized === 'unknown') {
        return 'unknown';
    }
    return undefined;
}

function normalizeStudySessionHistoryRefreshSourceToken(
    rawValue: unknown
): StudySessionHistoryRequest['refreshSource'] {
    const normalized = String(rawValue || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    if (
        normalized === 'manual'
        || normalized === 'auto_refresh'
        || normalized === 'queued_replay'
        || normalized === 'visibility_resume'
        || normalized === 'workbench_refresh'
        || normalized === 'unknown'
    ) {
        return normalized;
    }
    return undefined;
}

function normalizeLearningPathRequestPayload(payload: unknown): LearningPathRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const focusAtomIds = normalizeStringArrayValue(
        readFirstPresentValue(record, ['focusAtomIds', 'focusAtoms', 'atomIds'])
    );
    const maxMasteryPaths = parsePositiveIntegerValue(
        readFirstPresentValue(record, ['maxMasteryPaths', 'max_mastery_paths'])
    );
    const maxDivergencePaths = parsePositiveIntegerValue(
        readFirstPresentValue(record, ['maxDivergencePaths', 'max_divergence_paths'])
    );
    const recommendedActionLimit = parsePositiveIntegerValue(
        readFirstPresentValue(record, ['recommendedActionLimit', 'recommended_action_limit', 'maxActions', 'limit'])
    );
    const strategyRaw = readFirstNonEmptyString(
        record,
        ['strategy', 'pathStrategy', 'path_strategy', 'learningStrategy']
    );
    const strategy = normalizeLearningPathStrategyToken(strategyRaw);
    return {
        userId: readFirstNonEmptyString(record, ['userId', 'user_id', 'learnerId']) || '',
        focusAtomIds: focusAtomIds.length > 0 ? focusAtomIds : undefined,
        maxMasteryPaths: maxMasteryPaths > 0 ? maxMasteryPaths : undefined,
        maxDivergencePaths: maxDivergencePaths > 0 ? maxDivergencePaths : undefined,
        strategy,
        recommendedActionLimit: recommendedActionLimit > 0 ? recommendedActionLimit : undefined,
        generatedAt: readFirstNonEmptyString(record, ['generatedAt', 'generated_at', 'timestamp', 'now']),
    };
}

function normalizeStudySessionRequestPayload(payload: unknown): StudySessionRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const focusAtomIds = normalizeStringArrayValue(
        readFirstPresentValue(record, ['focusAtomIds', 'focusAtoms', 'atomIds'])
    );
    const maxActions = parsePositiveIntegerValue(readFirstPresentValue(record, ['maxActions', 'limit']));
    const pathStrategy = normalizeLearningPathStrategyToken(
        readFirstNonEmptyString(record, ['pathStrategy', 'path_strategy', 'learningPathStrategy', 'strategy'])
    );
    const pathRecommendedActionLimit = parsePositiveIntegerValue(
        readFirstPresentValue(
            record,
            [
                'pathRecommendedActionLimit',
                'path_recommended_action_limit',
                'recommendedActionLimit',
                'recommended_action_limit',
            ]
        )
    );
    return {
        userId: readFirstNonEmptyString(record, ['userId', 'user_id', 'learnerId']) || '',
        focusAtomIds: focusAtomIds.length > 0 ? focusAtomIds : undefined,
        maxActions: maxActions > 0 ? maxActions : undefined,
        includeDivergence: parseBooleanFlagOrUndefined(
            readFirstPresentValue(record, ['includeDivergence', 'withDivergence', 'include_divergence'])
        ),
        includeRetrain: parseBooleanFlagOrUndefined(
            readFirstPresentValue(record, ['includeRetrain', 'withRetrain', 'include_retrain'])
        ),
        pathStrategy,
        pathRecommendedActionLimit: pathRecommendedActionLimit > 0 ? pathRecommendedActionLimit : undefined,
        generatedAt: readFirstNonEmptyString(record, ['generatedAt', 'generated_at', 'timestamp', 'now']),
    };
}

function normalizeStudySessionHistoryRequestPayload(payload: unknown): StudySessionHistoryRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const limit = parsePositiveIntegerValue(readFirstPresentValue(record, ['limit', 'topK', 'k']));
    const sinceMinutes = parsePositiveIntegerValue(
        readFirstPresentValue(record, ['sinceMinutes', 'since_minutes', 'windowMinutes', 'window_minutes'])
    );
    const pathStrategy = normalizeLearningPathStrategyToken(
        readFirstNonEmptyString(record, ['pathStrategy', 'path_strategy', 'learningPathStrategy', 'strategy'])
    );
    const pathStrategySelectionSource = normalizeStudySessionPathStrategySelectionSourceFilterToken(
        readFirstNonEmptyString(
            record,
            [
                'pathStrategySelectionSource',
                'path_strategy_selection_source',
                'strategySelectionSource',
                'selectionSource',
                'strategy_source',
            ]
        )
    );
    const refreshSource = normalizeStudySessionHistoryRefreshSourceToken(
        readFirstNonEmptyString(
            record,
            [
                'refreshSource',
                'refresh_source',
                'requestSource',
                'request_source',
                'historyRefreshSource',
                'history_refresh_source',
            ]
        )
    );
    return {
        userId: readFirstNonEmptyString(record, ['userId', 'user_id', 'learnerId']) || '',
        limit: limit > 0 ? limit : undefined,
        sinceMinutes: sinceMinutes > 0 ? sinceMinutes : undefined,
        pathStrategy,
        pathStrategySelectionSource,
        refreshSource,
    };
}

function normalizeStudySessionHistoryRequestFromQuery(query: URLSearchParams): StudySessionHistoryRequest {
    return normalizeStudySessionHistoryRequestPayload({
        userId: query.get('userId') || '',
        user_id: query.get('user_id') || '',
        learnerId: query.get('learnerId') || '',
        limit: query.get('limit') || '',
        topK: query.get('topK') || '',
        k: query.get('k') || '',
        sinceMinutes: query.get('sinceMinutes') || '',
        since_minutes: query.get('since_minutes') || '',
        windowMinutes: query.get('windowMinutes') || '',
        window_minutes: query.get('window_minutes') || '',
        pathStrategy: query.get('pathStrategy') || '',
        path_strategy: query.get('path_strategy') || '',
        learningPathStrategy: query.get('learningPathStrategy') || '',
        strategy: query.get('strategy') || '',
        pathStrategySelectionSource: query.get('pathStrategySelectionSource') || '',
        path_strategy_selection_source: query.get('path_strategy_selection_source') || '',
        strategySelectionSource: query.get('strategySelectionSource') || '',
        selectionSource: query.get('selectionSource') || '',
        strategy_source: query.get('strategy_source') || '',
        refreshSource: query.get('refreshSource') || '',
        refresh_source: query.get('refresh_source') || '',
        requestSource: query.get('requestSource') || '',
        request_source: query.get('request_source') || '',
        historyRefreshSource: query.get('historyRefreshSource') || '',
        history_refresh_source: query.get('history_refresh_source') || '',
    });
}

function normalizeStudySessionPlanQualityThresholdOverrides(
    rawValue: unknown
): Partial<StudySessionPlanQualityThresholds> | undefined {
    const record = isObjectRecord(rawValue) ? rawValue : {};
    const output: Partial<StudySessionPlanQualityThresholds> = {};
    const mappings: Array<[keyof StudySessionPlanQualityThresholds, string[]]> = [
        ['minTotalActions', ['minTotalActions', 'min_total_actions']],
        ['minEvidenceCoverageRatioPct', ['minEvidenceCoverageRatioPct', 'min_evidence_coverage_ratio_pct', 'minEvidenceRatioPct']],
        ['maxBudgetDeviationActions', ['maxBudgetDeviationActions', 'max_budget_deviation_actions']],
        ['minRecoverySharePctWhenRegressing', ['minRecoverySharePctWhenRegressing', 'min_recovery_share_pct_when_regressing', 'minRecoveryShareRegressingPct']],
        ['maxDivergenceSharePctWhenRegressing', ['maxDivergenceSharePctWhenRegressing', 'max_divergence_share_pct_when_regressing', 'maxDivergenceShareRegressingPct']],
        ['minDivergenceSharePctWhenImproving', ['minDivergenceSharePctWhenImproving', 'min_divergence_share_pct_when_improving', 'minDivergenceShareImprovingPct']],
    ];
    mappings.forEach(([key, keys]) => {
        const parsed = parseFiniteNumberOrUndefined(readFirstPresentValue(record, keys));
        if (typeof parsed === 'number') {
            output[key as string] = parsed;
        }
    });
    return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeStudySessionPlanQualityEvaluationRequestPayload(
    payload: unknown
): StudySessionPlanQualityEvaluationRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const focusAtomIds = normalizeStringArrayValue(
        readFirstPresentValue(record, ['focusAtomIds', 'focusAtoms', 'atomIds'])
    );
    const maxActions = parsePositiveIntegerValue(readFirstPresentValue(record, ['maxActions', 'limit']));
    const thresholds = normalizeStudySessionPlanQualityThresholdOverrides(
        readFirstPresentValue(record, ['thresholds', 'qualityThresholds', 'threshold_overrides'])
    );
    const sessionPlan = readFirstPresentValue(record, ['sessionPlan', 'session_plan', 'plan']);
    return {
        userId: readFirstNonEmptyString(record, ['userId', 'user_id', 'learnerId']) || '',
        sessionPlan: isObjectRecord(sessionPlan)
            ? sessionPlan as unknown as StudySessionPlanQualityEvaluationRequest['sessionPlan']
            : undefined,
        focusAtomIds: focusAtomIds.length > 0 ? focusAtomIds : undefined,
        maxActions: maxActions > 0 ? maxActions : undefined,
        includeDivergence: parseBooleanFlagOrUndefined(
            readFirstPresentValue(record, ['includeDivergence', 'withDivergence', 'include_divergence'])
        ),
        includeRetrain: parseBooleanFlagOrUndefined(
            readFirstPresentValue(record, ['includeRetrain', 'withRetrain', 'include_retrain'])
        ),
        generatedAt: readFirstNonEmptyString(record, ['generatedAt', 'generated_at', 'timestamp', 'now']),
        thresholds,
        adaptiveThresholdsEnabled: parseBooleanFlagOrUndefined(
            readFirstPresentValue(record, ['adaptiveThresholdsEnabled', 'adaptiveEnabled', 'adaptive_thresholds_enabled'])
        ),
    };
}

function normalizeLearningQualitySnapshotPayload(rawValue: unknown): LearningQualitySnapshot {
    const record = isObjectRecord(rawValue) ? rawValue : {};
    const requiredPct = (keys: string[]): number => Number(
        parseFiniteNumberOrUndefined(readFirstPresentValue(record, keys)) ?? 0
    );
    const optionalPct = (keys: string[]): number | undefined => {
        const parsed = parseFiniteNumberOrUndefined(readFirstPresentValue(record, keys));
        return typeof parsed === 'number' ? Number(parsed) : undefined;
    };
    return {
        retestPassRatePct: requiredPct(['retestPassRatePct', 'retest_pass_rate_pct']),
        misconceptionRecurrenceRatePct: requiredPct(['misconceptionRecurrenceRatePct', 'misconception_recurrence_rate_pct']),
        evidenceBackedSuggestionRatioPct: requiredPct(['evidenceBackedSuggestionRatioPct', 'evidence_backed_suggestion_ratio_pct']),
        averagePathMasteryGainPct: requiredPct(['averagePathMasteryGainPct', 'average_path_mastery_gain_pct']),
        randomPathMasteryGainPct: requiredPct(['randomPathMasteryGainPct', 'random_path_mastery_gain_pct']),
        pathStrategyExecutionCoveragePct: optionalPct(['pathStrategyExecutionCoveragePct', 'path_strategy_execution_coverage_pct']),
        pathStrategyAverageMasteryDeltaPct: optionalPct(['pathStrategyAverageMasteryDeltaPct', 'path_strategy_average_mastery_delta_pct']),
        queryEvidenceCoverageRatioPct: optionalPct(['queryEvidenceCoverageRatioPct', 'query_evidence_coverage_ratio_pct']),
        queryRelationPathCoverageRatioPct: optionalPct(['queryRelationPathCoverageRatioPct', 'query_relation_path_coverage_ratio_pct']),
        queryTemporalValidityPassRatioPct: optionalPct(['queryTemporalValidityPassRatioPct', 'query_temporal_validity_pass_ratio_pct']),
        pendingVerificationRatioPct: optionalPct(['pendingVerificationRatioPct', 'pending_verification_ratio_pct']),
        queryBackendFallbackRatioPct: optionalPct(['queryBackendFallbackRatioPct', 'query_backend_fallback_ratio_pct']),
        sessionMemoryPromotionCoveragePct: optionalPct(['sessionMemoryPromotionCoveragePct', 'session_memory_promotion_coverage_pct']),
        queryP95Ms: parseFiniteNumberOrUndefined(readFirstPresentValue(record, ['queryP95Ms', 'query_p95_ms'])),
    };
}

function normalizeLearningQualityThresholdOverridesPayload(
    rawValue: unknown
): Partial<LearningQualityThresholds> | undefined {
    const record = isObjectRecord(rawValue) ? rawValue : {};
    const output: Partial<LearningQualityThresholds> = {};
    const mappings: Array<[keyof LearningQualityThresholds, string[]]> = [
        ['retestPassRateUpliftPct', ['retestPassRateUpliftPct', 'retest_pass_rate_uplift_pct']],
        ['misconceptionRecurrenceReductionPct', ['misconceptionRecurrenceReductionPct', 'misconception_recurrence_reduction_pct']],
        ['evidenceBackedSuggestionRatioPct', ['evidenceBackedSuggestionRatioPct', 'evidence_backed_suggestion_ratio_pct']],
        ['minQueryEvidenceCoverageRatioPct', ['minQueryEvidenceCoverageRatioPct', 'min_query_evidence_coverage_ratio_pct']],
        ['minQueryRelationPathCoverageRatioPct', ['minQueryRelationPathCoverageRatioPct', 'min_query_relation_path_coverage_ratio_pct']],
        ['minQueryTemporalValidityPassRatioPct', ['minQueryTemporalValidityPassRatioPct', 'min_query_temporal_validity_pass_ratio_pct']],
        ['maxPendingVerificationRatioPct', ['maxPendingVerificationRatioPct', 'max_pending_verification_ratio_pct']],
        ['maxQueryBackendFallbackRatioPct', ['maxQueryBackendFallbackRatioPct', 'max_query_backend_fallback_ratio_pct']],
        ['minSessionMemoryPromotionCoveragePct', ['minSessionMemoryPromotionCoveragePct', 'min_session_memory_promotion_coverage_pct']],
        ['pathEffectivenessLiftPct', ['pathEffectivenessLiftPct', 'path_effectiveness_lift_pct']],
        ['queryP95Ms', ['queryP95Ms', 'query_p95_ms']],
    ];
    mappings.forEach(([key, keys]) => {
        const parsed = parseFiniteNumberOrUndefined(readFirstPresentValue(record, keys));
        if (typeof parsed === 'number') {
            output[key] = parsed;
        }
    });
    return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeLearningQualitySnapshotRequestPayload(payload: unknown): LearningQualitySnapshotRequest {
    const record = isObjectRecord(payload) ? payload : {};
    return {
        userId: readFirstNonEmptyString(record, ['userId', 'user_id', 'learnerId']),
        sampledAt: readFirstNonEmptyString(record, ['sampledAt', 'sampled_at', 'timestamp', 'now']),
    };
}

function normalizeLearningQualityEvaluationRequestPayload(payload: unknown): LearningQualityEvaluationRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const baseline = normalizeLearningQualitySnapshotPayload(
        readFirstPresentValue(record, ['baseline', 'before', 'previous'])
    );
    const current = normalizeLearningQualitySnapshotPayload(
        readFirstPresentValue(record, ['current', 'after', 'snapshot'])
    );
    const thresholds = normalizeLearningQualityThresholdOverridesPayload(
        readFirstPresentValue(record, ['thresholds', 'qualityThresholds', 'threshold_overrides'])
    );
    return {
        baseline,
        current,
        thresholds,
        evaluatedAt: readFirstNonEmptyString(record, ['evaluatedAt', 'evaluated_at', 'timestamp', 'now']),
    };
}

function normalizeIngestGuardrailThresholdOverridesPayload(
    rawValue: unknown
): IngestGuardrailEvaluationRequest['thresholds'] {
    const record = isObjectRecord(rawValue) ? rawValue : {};
    const output: NonNullable<IngestGuardrailEvaluationRequest['thresholds']> = {};
    const mappings: Array<[keyof NonNullable<IngestGuardrailEvaluationRequest['thresholds']>, string[]]> = [
        ['maxChangedDocuments', ['maxChangedDocuments', 'max_changed_documents']],
        ['maxDeletedDocuments', ['maxDeletedDocuments', 'max_deleted_documents']],
        ['maxActiveAtoms', ['maxActiveAtoms', 'max_active_atoms']],
        ['maxIngestP95Ms', ['maxIngestP95Ms', 'max_ingest_p95_ms']],
        ['maxRecomputeP95Ms', ['maxRecomputeP95Ms', 'max_recompute_p95_ms']],
    ];
    mappings.forEach(([key, keys]) => {
        const parsed = parseFiniteNumberOrUndefined(readFirstPresentValue(record, keys));
        if (typeof parsed === 'number') {
            output[key] = parsed;
        }
    });
    return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeIngestGuardrailEvaluationRequestPayload(payload: unknown): IngestGuardrailEvaluationRequest {
    const record = isObjectRecord(payload) ? payload : {};
    return {
        thresholds: normalizeIngestGuardrailThresholdOverridesPayload(
            readFirstPresentValue(record, ['thresholds', 'guardrailThresholds', 'threshold_overrides'])
        ),
        evaluatedAt: readFirstNonEmptyString(record, ['evaluatedAt', 'evaluated_at', 'timestamp', 'now']),
    };
}

function normalizeStudySessionOrchestrationConfigPatch(
    rawValue: unknown
): StudySessionOrchestrationConfigUpdateRequest {
    const record = isObjectRecord(rawValue) ? rawValue : {};
    const trendRuntimeConfigRecord = isObjectRecord(
        readFirstPresentValue(record, ['trendRuntimeConfig', 'trendConfig', 'trend_runtime'])
    )
        ? readFirstPresentValue(record, ['trendRuntimeConfig', 'trendConfig', 'trend_runtime']) as Record<string, unknown>
        : {};
    const memorySignalConfigRecord = isObjectRecord(
        readFirstPresentValue(record, ['memorySignalConfig', 'memoryConfig', 'memory_signal'])
    )
        ? readFirstPresentValue(record, ['memorySignalConfig', 'memoryConfig', 'memory_signal']) as Record<string, unknown>
        : {};
    const tutorRoutingConfigRecord = isObjectRecord(
        readFirstPresentValue(record, ['tutorRoutingConfig', 'routingConfig', 'tutor_routing'])
    )
        ? readFirstPresentValue(record, ['tutorRoutingConfig', 'routingConfig', 'tutor_routing']) as Record<string, unknown>
        : {};

    const trendRuntimeConfig: Partial<NonNullable<StudySessionOrchestrationConfigUpdateRequest['trendRuntimeConfig']>> = {};
    const trendMappings: Array<[keyof NonNullable<StudySessionOrchestrationConfigUpdateRequest['trendRuntimeConfig']>, string[]]> = [
        ['learningQualityTrendLimit', ['learningQualityTrendLimit', 'lqLimit']],
        ['learningQualityTrendWindowSize', ['learningQualityTrendWindowSize', 'lqWindowSize']],
        ['learningQualityTrendMinSamples', ['learningQualityTrendMinSamples', 'lqMinSamples']],
        ['sessionPlanQualityTrendLimit', ['sessionPlanQualityTrendLimit', 'planLimit']],
        ['sessionPlanQualityTrendWindowSize', ['sessionPlanQualityTrendWindowSize', 'planWindowSize']],
        ['sessionPlanQualityTrendMinSamples', ['sessionPlanQualityTrendMinSamples', 'planMinSamples']],
        ['memoryPolicyTrendLimit', ['memoryPolicyTrendLimit', 'memoryLimit']],
        ['memoryPolicyTrendWindowSize', ['memoryPolicyTrendWindowSize', 'memoryWindowSize']],
        ['memoryPolicyTrendMinSamples', ['memoryPolicyTrendMinSamples', 'memoryMinSamples']],
    ];
    trendMappings.forEach(([key, keys]) => {
        const parsed = parsePositiveIntegerValue(readFirstPresentValue(trendRuntimeConfigRecord, keys));
        if (parsed > 0) {
            (trendRuntimeConfig as Record<string, unknown>)[key as string] = parsed;
        }
    });
    const strategyAutoPathEnabled = parseBooleanFlagOrUndefined(
        readFirstPresentValue(trendRuntimeConfigRecord, [
            'strategyAutoPathEnabled',
            'strategy_auto_path_enabled',
            'autoPathEnabled',
            'auto_path_enabled',
        ])
    );
    if (typeof strategyAutoPathEnabled === 'boolean') {
        trendRuntimeConfig.strategyAutoPathEnabled = strategyAutoPathEnabled;
    }
    const strategyMinConfidence = parseFiniteNumberOrUndefined(
        readFirstPresentValue(trendRuntimeConfigRecord, [
            'strategyMinConfidence',
            'strategy_min_confidence',
            'autoPathMinConfidence',
            'auto_path_min_confidence',
        ])
    );
    if (typeof strategyMinConfidence === 'number') {
        trendRuntimeConfig.strategyMinConfidence = strategyMinConfidence;
    }

    const memorySignalConfig: Partial<NonNullable<StudySessionOrchestrationConfigUpdateRequest['memorySignalConfig']>> = {};
    const memoryMappings: Array<[keyof NonNullable<StudySessionOrchestrationConfigUpdateRequest['memorySignalConfig']>, string[]]> = [
        ['regressionConfidenceFloor', ['regressionConfidenceFloor', 'regFloor']],
        ['improvementConfidenceFloor', ['improvementConfidenceFloor', 'impFloor']],
        ['scoreWeight', ['scoreWeight', 'scoreW']],
        ['confidenceWeight', ['confidenceWeight', 'confW']],
    ];
    memoryMappings.forEach(([key, keys]) => {
        const parsed = parseFiniteNumberOrUndefined(readFirstPresentValue(memorySignalConfigRecord, keys));
        if (typeof parsed === 'number') {
            memorySignalConfig[key as string] = parsed;
        }
    });

    const tutorRoutingConfig: Partial<NonNullable<StudySessionOrchestrationConfigUpdateRequest['tutorRoutingConfig']>> = {};
    const enabled = parseBooleanFlagOrUndefined(readFirstPresentValue(tutorRoutingConfigRecord, ['enabled']));
    if (typeof enabled === 'boolean') {
        tutorRoutingConfig.enabled = enabled;
    }
    const minSamples = parsePositiveIntegerValue(readFirstPresentValue(tutorRoutingConfigRecord, ['minSamples', 'min_samples']));
    if (minSamples > 0) {
        tutorRoutingConfig.minSamples = minSamples;
    }
    const maxFailedRatioPct = parseFiniteNumberOrUndefined(
        readFirstPresentValue(tutorRoutingConfigRecord, ['maxFailedRatioPct', 'max_failed_ratio_pct'])
    );
    if (typeof maxFailedRatioPct === 'number') {
        tutorRoutingConfig.maxFailedRatioPct = maxFailedRatioPct;
    }
    const maxDowngradedRatioPct = parseFiniteNumberOrUndefined(
        readFirstPresentValue(tutorRoutingConfigRecord, ['maxDowngradedRatioPct', 'max_downgraded_ratio_pct'])
    );
    if (typeof maxDowngradedRatioPct === 'number') {
        tutorRoutingConfig.maxDowngradedRatioPct = maxDowngradedRatioPct;
    }
    const minAverageConfidence = parseFiniteNumberOrUndefined(
        readFirstPresentValue(tutorRoutingConfigRecord, ['minAverageConfidence', 'min_average_confidence'])
    );
    if (typeof minAverageConfidence === 'number') {
        tutorRoutingConfig.minAverageConfidence = minAverageConfidence;
    }
    const preferredMode = normalizeTutorProviderModePreference(
        readFirstNonEmptyString(tutorRoutingConfigRecord, ['preferredMode', 'preferred_mode'])
    );
    if (preferredMode === 'auto' || preferredMode === 'local' || preferredMode === 'cloud') {
        tutorRoutingConfig.preferredMode = preferredMode;
    }
    const adapterTimeoutMs = parsePositiveIntegerValue(
        readFirstPresentValue(tutorRoutingConfigRecord, [
            'adapterTimeoutMs',
            'adapter_timeout_ms',
            'timeoutMs',
            'timeout_ms',
        ])
    );
    if (adapterTimeoutMs > 0) {
        tutorRoutingConfig.adapterTimeoutMs = adapterTimeoutMs;
    }

    return {
        trendRuntimeConfig: Object.keys(trendRuntimeConfig).length > 0 ? trendRuntimeConfig : undefined,
        memorySignalConfig: Object.keys(memorySignalConfig).length > 0 ? memorySignalConfig : undefined,
        tutorRoutingConfig: Object.keys(tutorRoutingConfig).length > 0 ? tutorRoutingConfig : undefined,
    };
}

function normalizeStudySessionOrchestrationConfigUpdateRequestPayload(
    payload: unknown
): StudySessionOrchestrationConfigUpdateRequest {
    return normalizeStudySessionOrchestrationConfigPatch(payload);
}

function normalizeKnowledgeQueryBackendComparisonRequestPayload(
    payload: unknown
): KnowledgeQueryBackendComparisonRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const query = readFirstNonEmptyString(record, ['query', 'q']) || '';
    const topKValue = parsePositiveIntegerValue(readFirstPresentValue(record, ['topK', 'k', 'limit']));
    const asOf = readFirstNonEmptyString(record, ['asOf', 'as_of', 'timestamp']);
    const leftBackend = readFirstNonEmptyString(record, ['leftBackend', 'left_backend', 'backendA', 'backend']);
    const rightBackend = readFirstNonEmptyString(record, ['rightBackend', 'right_backend', 'backendB']);
    return {
        query,
        topK: topKValue > 0 ? topKValue : undefined,
        asOf,
        leftBackend,
        rightBackend,
    };
}

function normalizeQueryBackendConfigRequestPayload(payload: unknown): KnowledgeQueryBackendConfigRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const backend = readFirstNonEmptyString(record, ['backend', 'queryBackend', 'backendType']) || '';
    return {
        backend,
    };
}

function normalizeConversationMemoryNamespaceValue(
    rawValue: unknown,
    fallbackNamespace: ConversationMemoryAddRequest['namespace'] = 'conversation'
): ConversationMemoryAddRequest['namespace'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'conversation') {
        return 'conversation';
    }
    if (normalized === 'learner_profile' || normalized === 'learner-profile' || normalized === 'profile') {
        return 'learner_profile';
    }
    if (normalized === 'study_session' || normalized === 'study-session' || normalized === 'session') {
        return 'study_session';
    }
    if (normalized === 'project') {
        return 'project';
    }
    return fallbackNamespace;
}

function normalizeConversationMemoryFeedbackValue(
    rawValue: unknown,
    fallbackFeedback: ConversationMemoryFeedbackRequest['feedback'] = 'upvote'
): ConversationMemoryFeedbackRequest['feedback'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'upvote' || normalized === 'downvote' || normalized === 'correct') {
        return normalized;
    }
    return fallbackFeedback;
}

function normalizeConversationMemoryAddRequestPayload(payload: unknown): ConversationMemoryAddRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const userId = String(readFirstPresentValue(record, ['userId', 'user_id']) || '').trim();
    const namespace = normalizeConversationMemoryNamespaceValue(
        readFirstPresentValue(record, ['namespace', 'scope']),
        'conversation'
    );
    const content = String(readFirstPresentValue(record, ['content', 'value', 'memory']) || '').trim();
    const tagsRaw = readFirstPresentValue(record, ['tags']);
    const tags = Array.isArray(tagsRaw)
        ? tagsRaw.map((tag) => String(tag || '').trim()).filter(Boolean)
        : [];
    const source = String(readFirstPresentValue(record, ['source']) || '').trim() || undefined;
    const confidence = parseFiniteNumberOrUndefined(
        readFirstPresentValue(record, ['confidence', 'score'])
    );
    const now = String(readFirstPresentValue(record, ['now', 'timestamp']) || '').trim() || undefined;
    return {
        userId,
        namespace,
        content,
        tags,
        source,
        confidence,
        now,
    };
}

function normalizeConversationMemoryListRequestFromQuery(searchParams: URLSearchParams): ConversationMemoryListRequest {
    const namespaceToken = String(searchParams.get('namespace') || searchParams.get('scope') || '').trim();
    const namespace = namespaceToken
        ? normalizeConversationMemoryNamespaceValue(namespaceToken, 'conversation')
        : undefined;
    return {
        userId: String(searchParams.get('userId') || searchParams.get('user_id') || '').trim(),
        namespace,
        limit: parsePositiveIntegerValue(searchParams.get('limit')),
        now: String(searchParams.get('now') || searchParams.get('timestamp') || '').trim() || undefined,
    };
}

function normalizeConversationMemorySearchRequestPayload(payload: unknown): ConversationMemorySearchRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const namespaceToken = String(readFirstPresentValue(record, ['namespace', 'scope']) || '').trim();
    const namespace = namespaceToken
        ? normalizeConversationMemoryNamespaceValue(namespaceToken, 'conversation')
        : undefined;
    return {
        userId: String(readFirstPresentValue(record, ['userId', 'user_id']) || '').trim(),
        namespace,
        query: String(readFirstPresentValue(record, ['query', 'q']) || '').trim(),
        limit: parsePositiveIntegerValue(readFirstPresentValue(record, ['limit', 'topK'])),
        now: String(readFirstPresentValue(record, ['now', 'timestamp']) || '').trim() || undefined,
    };
}

function normalizeConversationMemoryDeleteRequestPayload(payload: unknown): ConversationMemoryDeleteRequest {
    const record = isObjectRecord(payload) ? payload : {};
    return {
        userId: String(readFirstPresentValue(record, ['userId', 'user_id']) || '').trim(),
        namespace: normalizeConversationMemoryNamespaceValue(
            readFirstPresentValue(record, ['namespace', 'scope']),
            'conversation'
        ),
        memoryId: String(readFirstPresentValue(record, ['memoryId', 'id']) || '').trim(),
        now: String(readFirstPresentValue(record, ['now', 'timestamp']) || '').trim() || undefined,
    };
}

function normalizeConversationMemoryFeedbackRequestPayload(payload: unknown): ConversationMemoryFeedbackRequest {
    const record = isObjectRecord(payload) ? payload : {};
    return {
        userId: String(readFirstPresentValue(record, ['userId', 'user_id']) || '').trim(),
        namespace: normalizeConversationMemoryNamespaceValue(
            readFirstPresentValue(record, ['namespace', 'scope']),
            'conversation'
        ),
        memoryId: String(readFirstPresentValue(record, ['memoryId', 'id']) || '').trim(),
        feedback: normalizeConversationMemoryFeedbackValue(
            readFirstPresentValue(record, ['feedback', 'rating']),
            'upvote'
        ),
        reason: String(readFirstPresentValue(record, ['reason']) || '').trim() || undefined,
        correctedContent: String(readFirstPresentValue(record, ['correctedContent', 'corrected_content']) || '').trim() || undefined,
        now: String(readFirstPresentValue(record, ['now', 'timestamp']) || '').trim() || undefined,
    };
}

function normalizeMemoryLayerValue(
    rawValue: unknown,
    fallbackLayer: MemoryPolicyRequest['layer'] = 'session'
): MemoryPolicyRequest['layer'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'session') {
        return 'session';
    }
    if (normalized === 'unit') {
        return 'unit';
    }
    if (normalized === 'long_term' || normalized === 'longterm' || normalized === 'long-term') {
        return 'long_term';
    }
    return fallbackLayer;
}

function normalizeMemoryPolicyOperation(rawValue: unknown): MemoryPolicyRequest['operation'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'write' || normalized === 'upsert') {
        return 'write';
    }
    if (normalized === 'read' || normalized === 'query') {
        return 'read';
    }
    if (normalized === 'evict' || normalized === 'cleanup' || normalized === 'prune') {
        return 'evict';
    }
    if (normalized === 'retrain_plan' || normalized === 'retrain' || normalized === 'retrain-plan') {
        return 'retrain_plan';
    }
    if (normalized === 'promote' || normalized === 'promote_memory' || normalized === 'promote-memory') {
        return 'promote';
    }
    return 'snapshot';
}

function normalizeMemoryPolicyRequestPayload(payload: unknown): MemoryPolicyRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const userId = String(record.userId || '').trim();
    const operationRaw = readFirstNonEmptyString(record, ['operation', 'op']);
    const operation = normalizeMemoryPolicyOperation(operationRaw);
    const layerRaw = readFirstNonEmptyString(record, ['layer', 'fromLayer', 'sourceLayer']);
    const layer = normalizeMemoryLayerValue(layerRaw, 'session');
    const targetLayerRaw = readFirstNonEmptyString(record, ['targetLayer', 'toLayer', 'destinationLayer']);
    const targetLayerNormalized = targetLayerRaw
        ? normalizeMemoryLayerValue(targetLayerRaw, layer)
        : undefined;
    const entriesRaw = Array.isArray(record.entries) ? record.entries : [];
    const entries = entriesRaw
        .filter((item) => isObjectRecord(item))
        .map((item) => ({
            key: String(item.key || '').trim(),
            value: String(item.value || '').trim(),
            tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
            confidence: Number(item.confidence),
            references: Array.isArray(item.references)
                ? item.references.map((ref) => String(ref || '').trim()).filter(Boolean)
                : [],
            createdAt: String(item.createdAt || '').trim(),
            updatedAt: String(item.updatedAt || '').trim(),
            expiresAt: String(item.expiresAt || '').trim() || undefined,
        }));
    const query = readFirstNonEmptyString(record, ['query']);
    const now = readFirstNonEmptyString(record, ['now', 'timestamp']);
    const limitValue = parsePositiveIntegerValue(record.limit);
    const minConfidenceValue = parseFiniteNumberOrUndefined(record.minConfidence);
    const removeFromSourceRaw = readFirstPresentValue(record, ['removeFromSource', 'remove_source']);
    const includeExpiredRaw = readFirstPresentValue(record, ['includeExpired', 'include_expired']);

    return {
        userId,
        operation,
        layer,
        targetLayer: targetLayerNormalized,
        entries,
        query,
        limit: limitValue > 0 ? limitValue : undefined,
        minConfidence: typeof minConfidenceValue === 'number' ? minConfidenceValue : undefined,
        removeFromSource: parseBooleanFlagOrUndefined(removeFromSourceRaw),
        includeExpired: parseBooleanFlagOrUndefined(includeExpiredRaw),
        now,
    };
}

function normalizeLearningActionKind(rawValue: unknown): StudySessionActionExecutionRequest['action']['kind'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'quiz' || normalized === 'practice' || normalized === 'question') {
        return 'quiz';
    }
    if (normalized === 'explain' || normalized === 'explanation') {
        return 'explain';
    }
    if (normalized === 'transfer' || normalized === 'transfer_quiz' || normalized === 'transfer-quiz') {
        return 'transfer';
    }
    if (normalized === 'counterexample' || normalized === 'counter_example' || normalized === 'counter-example') {
        return 'counterexample';
    }
    if (
        normalized === 'reflection'
        || normalized === 'reflect'
        || normalized === 'recap'
        || normalized === 'summary'
        || normalized === 'summarize'
    ) {
        return 'reflection';
    }
    return 'review';
}

function normalizeStudySessionActionSource(
    rawValue: unknown,
    fallbackSource: StudySessionActionExecutionRequest['action']['source'] = 'mastery_path'
): StudySessionActionExecutionRequest['action']['source'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (
        normalized === 'mastery_path'
        || normalized === 'mastery'
        || normalized === 'mastery-path'
        || normalized === 'path'
    ) {
        return 'mastery_path';
    }
    if (
        normalized === 'divergence_path'
        || normalized === 'divergence'
        || normalized === 'divergence-path'
        || normalized === 'exploration'
    ) {
        return 'divergence_path';
    }
    if (
        normalized === 'retrain_plan'
        || normalized === 'retrain'
        || normalized === 'retrain-plan'
        || normalized === 'retest'
    ) {
        return 'retrain_plan';
    }
    if (
        normalized === 'misconception_remediation'
        || normalized === 'misconception'
        || normalized === 'remediation'
    ) {
        return 'misconception_remediation';
    }
    if (
        normalized === 'flashcard_batch'
        || normalized === 'flashcard-batch'
        || normalized === 'flashcard'
        || normalized === 'review_card_batch'
    ) {
        return 'flashcard_batch';
    }
    return fallbackSource;
}

function normalizeMasteryOutcomeValue(rawValue: unknown): StudySessionActionExecutionRequest['outcome'] | undefined {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (
        normalized === 'correct'
        || normalized === 'pass'
        || normalized === 'passed'
        || normalized === 'success'
    ) {
        return 'correct';
    }
    if (
        normalized === 'incorrect'
        || normalized === 'wrong'
        || normalized === 'failed'
        || normalized === 'fail'
    ) {
        return 'incorrect';
    }
    if (normalized === 'partial' || normalized === 'partially_correct' || normalized === 'half_correct') {
        return 'partial';
    }
    if (normalized === 'skipped' || normalized === 'skip') {
        return 'skipped';
    }
    return undefined;
}

function normalizeStudySessionExecutionKind(
    rawValue: unknown
): StudySessionPlanExecutionRequest['executionKind'] {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'retest' || normalized === 'retry') {
        return 'retest';
    }
    if (normalized === 'custom' || normalized === 'manual') {
        return 'custom';
    }
    return 'session';
}

function normalizeStringArrayValue(rawValue: unknown): string[] {
    if (Array.isArray(rawValue)) {
        return rawValue.map((item) => String(item || '').trim()).filter((item) => item.length > 0);
    }
    const text = String(rawValue || '').trim();
    if (!text) {
        return [];
    }
    return text.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
}

function normalizeStringMap(rawValue: unknown): Record<string, string> | undefined {
    if (!isObjectRecord(rawValue)) {
        return undefined;
    }
    const normalizedEntries = Object.entries(rawValue)
        .map(([key, value]) => [String(key || '').trim(), String(value || '').trim()] as const)
        .filter(([key, value]) => key.length > 0 && value.length > 0);
    if (normalizedEntries.length === 0) {
        return undefined;
    }
    return normalizedEntries.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
    }, {});
}

function normalizeRuntimeRunbookRemediationEventPayload(
    payload: unknown,
    requestId: string
): RuntimeRunbookRemediationEventRecord {
    const record = isObjectRecord(payload) ? payload : {};
    const source = normalizeRuntimeRunbookRemediationEventSourceToken(
        readFirstNonEmptyString(record, ['source', 'eventSource', 'refreshSource'])
        || 'learning_workbench_refresh'
    ) || 'learning_workbench_refresh';
    const status = normalizeRuntimeRunbookRemediationEventStatusValue(
        readFirstNonEmptyString(record, [
            'status',
            'resultStatus',
            'outcome',
            'autoRemediationStatus',
        ]),
        'not_applied'
    );
    const appliedFlag = parseBooleanFlagOrUndefined(
        readFirstPresentValue(record, ['applied', 'autoRemediationApplied'])
    );
    const applied = typeof appliedFlag === 'boolean'
        ? appliedFlag
        : status === 'applied';
    const checkId = normalizeRuntimeRunbookCheckIdToken(
        readFirstNonEmptyString(record, ['checkId', 'autoRemediationCheckId'])
    );
    const triggerReason = String(readFirstNonEmptyString(record, [
        'triggerReason',
        'reason',
        'autoRemediationReason',
    ]) || 'unknown')
        .trim()
        .slice(0, 140);
    const detail = String(readFirstNonEmptyString(record, [
        'detail',
        'message',
        'notes',
        'autoRemediationDetail',
        'autoRemediationReason',
    ]) || '')
        .trim()
        .slice(0, 280);
    const degradedStreakCount = Math.max(
        0,
        Math.min(
            10000,
            Math.floor(
                Number(
                    readFirstPresentValue(record, ['degradedStreakCount', 'degradedStreak', 'streak'])
                    || 0
                ) || 0
            )
        )
    );
    const failureCount = Math.max(
        0,
        Math.min(
            10000,
            Math.floor(Number(readFirstPresentValue(record, ['failureCount']) || 0) || 0)
        )
    );
    const recoveredCount = Math.max(
        0,
        Math.min(
            10000,
            Math.floor(Number(readFirstPresentValue(record, ['recoveredCount']) || 0) || 0)
        )
    );
    const refreshDurationMs = Math.max(
        0,
        Math.min(
            300000,
            Math.floor(
                Number(
                    readFirstPresentValue(record, ['refreshDurationMs', 'workbenchRefreshLastDurationMs'])
                    || 0
                ) || 0
            )
        )
    );
    const refreshAttemptedAtRaw = String(readFirstNonEmptyString(record, [
        'refreshAttemptedAt',
        'workbenchRefreshAttemptedAt',
    ]) || '')
        .trim();
    const refreshAttemptedAtMs = Date.parse(refreshAttemptedAtRaw);
    const refreshAttemptedAt = Number.isFinite(refreshAttemptedAtMs)
        ? new Date(refreshAttemptedAtMs).toISOString()
        : '';
    return {
        recordedAt: new Date().toISOString(),
        requestId: String(requestId || '').trim().slice(0, 128),
        source,
        triggerReason,
        status,
        applied,
        checkId,
        degradedStreakCount,
        failureCount,
        recoveredCount,
        failureSources: normalizeRuntimeRunbookRemediationEventSources(
            readFirstPresentValue(record, ['failureSources', 'failedSources'])
        ),
        recoveredSources: normalizeRuntimeRunbookRemediationEventSources(
            readFirstPresentValue(record, ['recoveredSources'])
        ),
        detail,
        refreshAttemptedAt,
        refreshDurationMs,
    };
}

function normalizeStudySessionActionExecutionRequestPayload(payload: unknown): StudySessionActionExecutionRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const actionRecord = isObjectRecord(record.action) ? record.action : {};
    const atomId = readFirstNonEmptyString(actionRecord, ['atomId'])
        || readFirstNonEmptyString(record, ['atomId']);
    const actionKindRaw = readFirstNonEmptyString(actionRecord, ['kind', 'actionKind', 'learningActionKind'])
        || readFirstNonEmptyString(record, ['kind', 'actionKind', 'learningActionKind']);
    const sourceRaw = readFirstNonEmptyString(actionRecord, ['source', 'actionSource'])
        || readFirstNonEmptyString(record, ['source', 'actionSource']);
    const providerModeRaw = readFirstNonEmptyString(record, ['tutorProviderMode', 'providerMode']);
    const memoryLayerRaw = readFirstNonEmptyString(record, ['memoryLayer', 'layer']);
    const autoAnalyzeAnswerRaw = readFirstPresentValue(record, ['autoAnalyzeAnswer', 'analyzeAnswer']);
    const autoUpdateMasteryRaw = readFirstPresentValue(record, [
        'autoUpdateMasteryFromAnswer',
        'updateMasteryFromAnswer',
        'inferMasteryFromAnswer',
    ]);
    const persistMemoryRaw = readFirstPresentValue(record, ['persistMemory', 'persist', 'persist_memory']);
    const autoPromoteMemoryRaw = readFirstPresentValue(record, [
        'autoPromoteMemory',
        'promoteMemory',
        'autoPromote',
        'promote_memory',
    ]);
    const promoteTargetLayerRaw = readFirstNonEmptyString(record, [
        'promoteMemoryTargetLayer',
        'promoteTargetLayer',
        'targetLayer',
        'toLayer',
    ]);
    const promoteMinConfidenceRaw = readFirstPresentValue(record, [
        'promoteMemoryMinConfidence',
        'promoteMinConfidence',
        'minPromotionConfidence',
        'minConfidence',
    ]);
    const promoteRemoveFromSourceRaw = readFirstPresentValue(record, [
        'promoteMemoryRemoveFromSource',
        'promoteRemoveFromSource',
        'removeFromSource',
        'remove_source',
    ]);

    return {
        userId: String(record.userId || '').trim(),
        action: {
            atomId: atomId || '',
            kind: normalizeLearningActionKind(actionKindRaw),
            source: normalizeStudySessionActionSource(sourceRaw),
            prompt: readFirstNonEmptyString(actionRecord, ['prompt'])
                || readFirstNonEmptyString(record, ['prompt']),
            answer: readFirstNonEmptyString(actionRecord, ['answer'])
                || readFirstNonEmptyString(record, ['answer']),
        },
        tutorAdapterId: readFirstNonEmptyString(record, ['tutorAdapterId', 'adapterId']),
        tutorProviderName: readFirstNonEmptyString(record, ['tutorProviderName', 'providerName']),
        tutorProviderMode: normalizeTutorProviderModePreference(providerModeRaw),
        outcome: normalizeMasteryOutcomeValue(
            readFirstNonEmptyString(record, ['outcome', 'result', 'masteryOutcome'])
        ),
        errorTag: readFirstNonEmptyString(record, ['errorTag', 'mistakeTag', 'misconceptionTag']),
        autoAnalyzeAnswer: parseBooleanFlagOrUndefined(autoAnalyzeAnswerRaw),
        autoUpdateMasteryFromAnswer: parseBooleanFlagOrUndefined(autoUpdateMasteryRaw),
        executedAt: readFirstNonEmptyString(record, ['executedAt', 'timestamp', 'now']),
        persistMemory: parseBooleanFlagOrUndefined(persistMemoryRaw),
        memoryLayer: memoryLayerRaw ? normalizeMemoryLayerValue(memoryLayerRaw, 'session') : undefined,
        autoPromoteMemory: parseBooleanFlagOrUndefined(autoPromoteMemoryRaw),
        promoteMemoryTargetLayer: promoteTargetLayerRaw
            ? normalizeMemoryLayerValue(promoteTargetLayerRaw, 'unit')
            : undefined,
        promoteMemoryMinConfidence: parseFiniteNumberOrUndefined(promoteMinConfidenceRaw),
        promoteMemoryRemoveFromSource: parseBooleanFlagOrUndefined(promoteRemoveFromSourceRaw),
    };
}

function normalizeStudySessionPlanExecutionRequestPayload(payload: unknown): StudySessionPlanExecutionRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const providerModeRaw = readFirstNonEmptyString(record, ['tutorProviderMode', 'providerMode']);
    const executionKindRaw = readFirstNonEmptyString(record, ['executionKind', 'kind', 'mode']);
    const focusAtomIdsRaw = readFirstPresentValue(record, ['focusAtomIds', 'focusAtoms', 'atomIds']);
    const maxActionsRaw = readFirstPresentValue(record, ['maxActions', 'max_actions']);
    const includeDivergenceRaw = readFirstPresentValue(record, [
        'includeDivergence',
        'withDivergence',
        'include_divergence',
    ]);
    const includeRetrainRaw = readFirstPresentValue(record, ['includeRetrain', 'withRetrain', 'include_retrain']);
    const pathStrategyRaw = readFirstNonEmptyString(
        record,
        ['pathStrategy', 'path_strategy', 'learningPathStrategy', 'strategy']
    );
    const pathRecommendedActionLimitRaw = readFirstPresentValue(record, [
        'pathRecommendedActionLimit',
        'path_recommended_action_limit',
        'recommendedActionLimit',
        'recommended_action_limit',
    ]);
    const actionLimitRaw = readFirstPresentValue(record, ['actionLimit', 'limit']);
    const autoAnalyzeAnswerRaw = readFirstPresentValue(record, ['autoAnalyzeAnswer', 'analyzeAnswer']);
    const autoUpdateMasteryRaw = readFirstPresentValue(record, [
        'autoUpdateMasteryFromAnswer',
        'updateMasteryFromAnswer',
        'inferMasteryFromAnswer',
    ]);
    const includeRetestPlanRaw = readFirstPresentValue(record, ['includeRetestPlan', 'withRetestPlan']);
    const retestActionLimitRaw = readFirstPresentValue(record, ['retestActionLimit', 'retestLimit']);
    const persistMemoryRaw = readFirstPresentValue(record, ['persistMemory', 'persist', 'persist_memory']);
    const memoryLayerRaw = readFirstNonEmptyString(record, ['memoryLayer', 'layer']);
    const autoPromoteMemoryRaw = readFirstPresentValue(record, [
        'autoPromoteMemory',
        'promoteMemory',
        'autoPromote',
        'promote_memory',
    ]);
    const promoteTargetLayerRaw = readFirstNonEmptyString(record, [
        'promoteMemoryTargetLayer',
        'promoteTargetLayer',
        'targetLayer',
        'toLayer',
    ]);
    const promoteMinConfidenceRaw = readFirstPresentValue(record, [
        'promoteMemoryMinConfidence',
        'promoteMinConfidence',
        'minPromotionConfidence',
        'minConfidence',
    ]);
    const promoteRemoveFromSourceRaw = readFirstPresentValue(record, [
        'promoteMemoryRemoveFromSource',
        'promoteRemoveFromSource',
        'removeFromSource',
        'remove_source',
    ]);
    const stopOnErrorRaw = readFirstPresentValue(record, ['stopOnError', 'haltOnError']);
    const sessionPlanRaw = readFirstPresentValue(record, ['sessionPlan', 'plan']);

    const maxActions = parsePositiveIntegerValue(maxActionsRaw);
    const pathRecommendedActionLimit = parsePositiveIntegerValue(pathRecommendedActionLimitRaw);
    const actionLimit = parsePositiveIntegerValue(actionLimitRaw);
    const retestActionLimit = parsePositiveIntegerValue(retestActionLimitRaw);

    return {
        userId: String(record.userId || '').trim(),
        executionKind: normalizeStudySessionExecutionKind(executionKindRaw),
        tutorAdapterId: readFirstNonEmptyString(record, ['tutorAdapterId', 'adapterId']),
        tutorProviderName: readFirstNonEmptyString(record, ['tutorProviderName', 'providerName']),
        tutorProviderMode: normalizeTutorProviderModePreference(providerModeRaw),
        focusAtomIds: normalizeStringArrayValue(focusAtomIdsRaw),
        maxActions: maxActions > 0 ? maxActions : undefined,
        includeDivergence: parseBooleanFlagOrUndefined(includeDivergenceRaw),
        includeRetrain: parseBooleanFlagOrUndefined(includeRetrainRaw),
        pathStrategy: normalizeLearningPathStrategyToken(pathStrategyRaw),
        pathRecommendedActionLimit: pathRecommendedActionLimit > 0 ? pathRecommendedActionLimit : undefined,
        sessionPlan: isObjectRecord(sessionPlanRaw)
            ? sessionPlanRaw as unknown as StudySessionPlanExecutionRequest['sessionPlan']
            : undefined,
        actionLimit: actionLimit > 0 ? actionLimit : undefined,
        answersByActionId: normalizeStringMap(readFirstPresentValue(record, ['answersByActionId', 'actionAnswers'])),
        answersByAtomId: normalizeStringMap(readFirstPresentValue(record, ['answersByAtomId', 'atomAnswers'])),
        autoAnalyzeAnswer: parseBooleanFlagOrUndefined(autoAnalyzeAnswerRaw),
        autoUpdateMasteryFromAnswer: parseBooleanFlagOrUndefined(autoUpdateMasteryRaw),
        includeRetestPlan: parseBooleanFlagOrUndefined(includeRetestPlanRaw),
        retestActionLimit: retestActionLimit > 0 ? retestActionLimit : undefined,
        persistMemory: parseBooleanFlagOrUndefined(persistMemoryRaw),
        memoryLayer: memoryLayerRaw ? normalizeMemoryLayerValue(memoryLayerRaw, 'session') : undefined,
        autoPromoteMemory: parseBooleanFlagOrUndefined(autoPromoteMemoryRaw),
        promoteMemoryTargetLayer: promoteTargetLayerRaw
            ? normalizeMemoryLayerValue(promoteTargetLayerRaw, 'unit')
            : undefined,
        promoteMemoryMinConfidence: parseFiniteNumberOrUndefined(promoteMinConfidenceRaw),
        promoteMemoryRemoveFromSource: parseBooleanFlagOrUndefined(promoteRemoveFromSourceRaw),
        stopOnError: parseBooleanFlagOrUndefined(stopOnErrorRaw),
        executedAt: readFirstNonEmptyString(record, ['executedAt', 'timestamp', 'now']),
    };
}

function cloneNotemdSettings(settings: NotemdSettings): NotemdSettings {
    return JSON.parse(JSON.stringify(settings)) as NotemdSettings;
}

function clampNotemdInteger(value: unknown, fallback: number, minValue: number, maxValue: number): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }
    return Math.max(minValue, Math.min(maxValue, Math.floor(numericValue)));
}

function normalizeNotemdSettings(rawValue: unknown): NotemdSettings {
    const defaults = cloneNotemdSettings(DEFAULT_NOTEMD_SETTINGS);
    if (!isObjectRecord(rawValue)) {
        return defaults;
    }

    const raw = rawValue as Partial<NotemdSettings> & Record<string, unknown>;
    const merged = {
        ...defaults,
        ...raw,
    } as NotemdSettings;

    if (Array.isArray(raw.providers)) {
        merged.providers = raw.providers
            .map((providerCandidate) => {
                if (!isObjectRecord(providerCandidate)) {
                    return null;
                }
                const providerName = String(providerCandidate.name || '').trim();
                const fallbackProvider = defaults.providers.find((provider) => provider.name === providerName);
                if (!fallbackProvider) {
                    return null;
                }
                return {
                    ...fallbackProvider,
                    ...providerCandidate,
                    name: fallbackProvider.name,
                    apiKey: String(providerCandidate.apiKey || '').trim(),
                    baseUrl: String(providerCandidate.baseUrl || fallbackProvider.baseUrl).trim(),
                    model: String(providerCandidate.model || fallbackProvider.model).trim(),
                    temperature: Number.isFinite(Number(providerCandidate.temperature))
                        ? Number(providerCandidate.temperature)
                        : fallbackProvider.temperature,
                };
            })
            .filter((provider): provider is NotemdSettings['providers'][number] => provider !== null);
    } else {
        merged.providers = defaults.providers;
    }

    const activeProviderExists = merged.providers.some((provider) => provider.name === merged.activeProvider);
    if (!activeProviderExists) {
        merged.activeProvider = defaults.activeProvider;
    }

    merged.chunkWordCount = clampNotemdInteger(raw.chunkWordCount, defaults.chunkWordCount, 300, 20000);
    merged.maxTokens = clampNotemdInteger(raw.maxTokens, defaults.maxTokens, 128, 64000);
    merged.batchConcurrency = clampNotemdInteger(raw.batchConcurrency, defaults.batchConcurrency, 1, 20);
    merged.batchSize = clampNotemdInteger(raw.batchSize, defaults.batchSize, 1, 200);
    merged.batchInterDelayMs = clampNotemdInteger(raw.batchInterDelayMs, defaults.batchInterDelayMs, 0, 600000);
    merged.apiCallIntervalMs = clampNotemdInteger(raw.apiCallIntervalMs, defaults.apiCallIntervalMs, 0, 120000);
    merged.maxRetries = clampNotemdInteger(raw.maxRetries, defaults.maxRetries, 0, 10);
    merged.retryDelayMs = clampNotemdInteger(raw.retryDelayMs, defaults.retryDelayMs, 0, 600000);

    merged.useCustomConceptNoteFolder = raw.useCustomConceptNoteFolder === true;
    merged.useCustomProcessedFileFolder = raw.useCustomProcessedFileFolder === true;
    merged.enableDuplicateDetection = raw.enableDuplicateDetection !== false;
    merged.moveOriginalFileOnProcess = raw.moveOriginalFileOnProcess === true;
    merged.enableBatchParallelism = raw.enableBatchParallelism !== false;
    merged.autoMermaidFixAfterGenerate = raw.autoMermaidFixAfterGenerate === true;
    merged.enableGlobalCustomPrompts = raw.enableGlobalCustomPrompts === true;
    merged.enableFocusedLearning = raw.enableFocusedLearning === true;
    merged.useMultiModelSettings = raw.useMultiModelSettings === true;
    merged.useCustomAddLinksSuffix = raw.useCustomAddLinksSuffix === true;
    merged.useCustomTranslationSuffix = raw.useCustomTranslationSuffix === true;
    merged.useCustomTranslationSavePath = raw.useCustomTranslationSavePath === true;
    merged.useCustomGenerateTitleOutputFolder = raw.useCustomGenerateTitleOutputFolder === true;
    merged.useDifferentLanguagesForTasks = raw.useDifferentLanguagesForTasks === true;
    merged.disableAutoTranslation = raw.disableAutoTranslation === true;
    merged.enableResearchInGenerateContent = raw.enableResearchInGenerateContent === true;
    merged.developerMode = raw.developerMode === true;

    merged.conceptNoteFolder = String(raw.conceptNoteFolder || defaults.conceptNoteFolder).trim();
    merged.processedFileFolder = String(raw.processedFileFolder || defaults.processedFileFolder).trim();
    merged.workspaceFilePath = String(raw.workspaceFilePath || defaults.workspaceFilePath).trim();
    merged.workspaceFolderPath = String(raw.workspaceFolderPath || defaults.workspaceFolderPath).trim();
    merged.workspaceOutputFilePath = String(raw.workspaceOutputFilePath || defaults.workspaceOutputFilePath).trim();
    merged.workspaceOutputFolderPath = String(raw.workspaceOutputFolderPath || defaults.workspaceOutputFolderPath).trim();
    merged.translationCustomSuffix = String(raw.translationCustomSuffix || defaults.translationCustomSuffix).trim();
    merged.translationSavePath = String(raw.translationSavePath || defaults.translationSavePath).trim();
    merged.addLinksCustomSuffix = String(raw.addLinksCustomSuffix || defaults.addLinksCustomSuffix).trim();
    merged.generateTitleOutputFolderName = String(
        raw.generateTitleOutputFolderName || defaults.generateTitleOutputFolderName
    ).trim();
    merged.focusedLearningDomain = String(raw.focusedLearningDomain || defaults.focusedLearningDomain).trim();

    if (Array.isArray(raw.availableLanguages)) {
        merged.availableLanguages = raw.availableLanguages
            .map((languageCandidate) => {
                if (!isObjectRecord(languageCandidate)) {
                    return null;
                }
                const code = String(languageCandidate.code || '').trim();
                const name = String(languageCandidate.name || '').trim();
                if (!code || !name) {
                    return null;
                }
                return { code, name };
            })
            .filter((language): language is NotemdSettings['availableLanguages'][number] => language !== null);
    } else {
        merged.availableLanguages = defaults.availableLanguages;
    }
    if (merged.availableLanguages.length === 0) {
        merged.availableLanguages = defaults.availableLanguages;
    }

    merged.language = String(raw.language || defaults.language).trim() || defaults.language;
    merged.generateTitleLanguage = String(raw.generateTitleLanguage || merged.language).trim() || merged.language;
    merged.researchSummarizeLanguage = String(raw.researchSummarizeLanguage || merged.language).trim() || merged.language;
    merged.addLinksLanguage = String(raw.addLinksLanguage || merged.language).trim() || merged.language;
    merged.summarizeToMermaidLanguage = String(raw.summarizeToMermaidLanguage || merged.language).trim() || merged.language;
    merged.extractConceptsLanguage = String(raw.extractConceptsLanguage || merged.language).trim() || merged.language;
    merged.translateLanguage = String(raw.translateLanguage || merged.language).trim() || merged.language;

    merged.addLinksModel = String(raw.addLinksModel || '').trim();
    merged.researchModel = String(raw.researchModel || '').trim();
    merged.generateTitleModel = String(raw.generateTitleModel || '').trim();
    merged.translateModel = String(raw.translateModel || '').trim();
    merged.summarizeToMermaidModel = String(raw.summarizeToMermaidModel || '').trim();
    merged.extractConceptsModel = String(raw.extractConceptsModel || '').trim();
    merged.extractOriginalTextModel = String(raw.extractOriginalTextModel || '').trim();

    if (!isObjectRecord(raw.customPrompts)) {
        merged.customPrompts = {};
    } else {
        const customPrompts = raw.customPrompts as Record<string, unknown>;
        merged.customPrompts = {};
        Object.keys(customPrompts).forEach((key) => {
            const text = String(customPrompts[key] || '').trim();
            if (text) {
                (merged.customPrompts as Record<string, string>)[key] = text;
            }
        });
    }

    return merged;
}

async function loadNotemdSettings(): Promise<NotemdSettings> {
    if (cachedNotemdSettings) {
        return cloneNotemdSettings(cachedNotemdSettings);
    }

    try {
        const appConfig = await loadAppConfigToml();
        const parsedSettings = extractNotemdSettingsFromAppConfig(appConfig);
        cachedNotemdSettings = normalizeNotemdSettings(parsedSettings);
    } catch (error) {
        warnDiagnostic('[NoteMD] Failed to read settings from TOML, using defaults:', error);
        cachedNotemdSettings = normalizeNotemdSettings(DEFAULT_NOTEMD_SETTINGS);
    }

    return cloneNotemdSettings(cachedNotemdSettings);
}

async function persistNotemdSettings(settingsLike: unknown): Promise<NotemdSettings> {
    const normalized = normalizeNotemdSettings(settingsLike);
    const appConfig = await loadAppConfigToml();
    const nextAppConfig = applyNotemdSettingsToAppConfig(appConfig, normalized);
    await saveAppConfigToml(nextAppConfig);
    cachedNotemdSettings = cloneNotemdSettings(normalized);
    return cloneNotemdSettings(normalized);
}

type NotemdWorkspaceState = {
    filePath: string;
    folderPath: string;
    outputFilePath: string;
    outputFolderPath: string;
};

function extractNotemdWorkspaceState(settings: NotemdSettings): NotemdWorkspaceState {
    return {
        filePath: String(settings.workspaceFilePath || '').trim(),
        folderPath: String(settings.workspaceFolderPath || '').trim(),
        outputFilePath: String(settings.workspaceOutputFilePath || '').trim(),
        outputFolderPath: String(settings.workspaceOutputFolderPath || '').trim(),
    };
}

function normalizeWorkspaceField(
    source: Record<string, unknown>,
    keys: string[],
    fallback: string
): string {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) {
            continue;
        }
        return String(source[key] || '').trim();
    }
    return fallback;
}

function applyWorkspacePatchToSettings(
    settings: NotemdSettings,
    workspacePatch: unknown
): NotemdSettings {
    const next = cloneNotemdSettings(settings);
    if (!isObjectRecord(workspacePatch)) {
        return next;
    }

    next.workspaceFilePath = normalizeWorkspaceField(
        workspacePatch,
        ['filePath', 'file_path', 'workspaceFilePath', 'workspace_file_path'],
        next.workspaceFilePath
    );
    next.workspaceFolderPath = normalizeWorkspaceField(
        workspacePatch,
        ['folderPath', 'folder_path', 'workspaceFolderPath', 'workspace_folder_path'],
        next.workspaceFolderPath
    );
    next.workspaceOutputFilePath = normalizeWorkspaceField(
        workspacePatch,
        ['outputFilePath', 'output_file_path', 'workspaceOutputFilePath', 'workspace_output_file_path'],
        next.workspaceOutputFilePath
    );
    next.workspaceOutputFolderPath = normalizeWorkspaceField(
        workspacePatch,
        ['outputFolderPath', 'output_folder_path', 'workspaceOutputFolderPath', 'workspace_output_folder_path'],
        next.workspaceOutputFolderPath
    );

    return next;
}

async function persistNotemdWorkspacePatch(workspacePatch: unknown): Promise<NotemdWorkspaceState> {
    const settings = await loadNotemdSettings();
    const nextSettings = applyWorkspacePatchToSettings(settings, workspacePatch);
    const persisted = await persistNotemdSettings(nextSettings);
    return extractNotemdWorkspaceState(persisted);
}

async function ensureNotemdProviderTemplatesPersisted(): Promise<{
    configPath: string;
    persisted: boolean;
}> {
    const appConfig = await loadAppConfigToml();
    const currentNotemdSection = isObjectRecord(appConfig.notemd) ? appConfig.notemd : {};
    const nextNotemdSection = mergeProviderTemplatesIntoNotemdSection(currentNotemdSection);
    const persisted = JSON.stringify(currentNotemdSection) !== JSON.stringify(nextNotemdSection);
    if (persisted) {
        await saveAppConfigToml({
            ...appConfig,
            notemd: nextNotemdSection,
        });
    }
    return {
        configPath: resolveAppConfigPath(),
        persisted,
    };
}

function clonePathModeSettings(settings: PathModeSettings): PathModeSettings {
    return JSON.parse(JSON.stringify(settings)) as PathModeSettings;
}

function cloneFrontendSettings(settings: FrontendSettings): FrontendSettings {
    return JSON.parse(JSON.stringify(settings)) as FrontendSettings;
}

async function loadPathModeSettings(): Promise<PathModeSettings> {
    try {
        const appConfig = await loadAppConfigToml();
        cachedPathModeSettings = extractPathModeSettingsFromAppConfig(appConfig);
    } catch (error) {
        warnDiagnostic('[PathMode] Failed to read TOML settings. Falling back to defaults.', error);
        cachedPathModeSettings = extractPathModeSettingsFromAppConfig({});
    }

    return clonePathModeSettings(cachedPathModeSettings);
}

async function persistPathModeSettings(settingsLike: unknown): Promise<PathModeSettings> {
    const appConfig = await loadAppConfigToml();
    const nextAppConfig = applyPathModeSettingsToAppConfig(appConfig, settingsLike);
    await saveAppConfigToml(nextAppConfig);
    const persisted = extractPathModeSettingsFromAppConfig(nextAppConfig);
    cachedPathModeSettings = clonePathModeSettings(persisted);
    return clonePathModeSettings(persisted);
}

async function loadFrontendSettings(): Promise<FrontendSettings> {
    try {
        const appConfig = await loadAppConfigToml();
        cachedFrontendSettings = extractFrontendSettingsFromAppConfig(appConfig);
    } catch (error) {
        warnDiagnostic('[Frontend] Failed to read TOML settings. Falling back to defaults.', error);
        cachedFrontendSettings = extractFrontendSettingsFromAppConfig({});
    }

    return cloneFrontendSettings(cachedFrontendSettings);
}

async function persistFrontendSettings(settingsLike: unknown): Promise<FrontendSettings> {
    const appConfig = await loadAppConfigToml();
    const nextAppConfig = applyFrontendSettingsToAppConfig(appConfig, settingsLike);
    await saveAppConfigToml(nextAppConfig);
    const persisted = extractFrontendSettingsFromAppConfig(nextAppConfig);
    cachedFrontendSettings = cloneFrontendSettings(persisted);
    return cloneFrontendSettings(persisted);
}

function generateNotemdOperationId(): string {
    return `notemd-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createNotemdOperation(operationIdCandidate?: unknown): NotemdOperationState {
    const requestedId = String(operationIdCandidate || '').trim();
    const operationId = requestedId || generateNotemdOperationId();
    const state: NotemdOperationState = {
        id: operationId,
        controller: new AbortController(),
        status: 'running',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        logs: [],
    };
    NOTEMD_ACTIVE_OPERATIONS.set(operationId, state);
    return state;
}

function finalizeNotemdOperation(state: NotemdOperationState, status: NotemdOperationState['status']): void {
    state.status = status;
    state.updatedAt = Date.now();
    setTimeout(() => {
        const current = NOTEMD_ACTIVE_OPERATIONS.get(state.id);
        if (current === state && current.status !== 'running') {
            NOTEMD_ACTIVE_OPERATIONS.delete(state.id);
        }
    }, 60000);
}

function writeSseEvent(res: http.ServerResponse, eventType: string, payload: unknown): void {
    if (res.writableEnded || (res as { destroyed?: boolean }).destroyed) {
        return;
    }
    try {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (_error) {
        // Ignore stream write failures when client disconnected mid-stream.
    }
}

function createNotemdReporter(state: NotemdOperationState, res?: http.ServerResponse): ProgressReporter {
    return {
        report: (eventLike) => {
            const event: ProgressEvent = {
                ...eventLike,
                operationId: state.id,
                timestamp: Date.now(),
            };
            state.logs.push(event);
            state.updatedAt = event.timestamp;
            if (res) {
                writeSseEvent(res, event.type, event);
            }
        },
        isCancelled: () => state.controller.signal.aborted,
    };
}

function shouldStreamNotemdResponse(req: http.IncomingMessage): boolean {
    const acceptHeader = typeof req.headers.accept === 'string' ? req.headers.accept : '';
    if (acceptHeader.includes('text/event-stream')) {
        return true;
    }
    try {
        const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${PORT}`);
        return urlObj.searchParams.get('stream') === '1';
    } catch (_error) {
        return false;
    }
}

async function resolveNearestExistingAncestor(candidatePath: string): Promise<string | null> {
    let current = path.resolve(candidatePath);
    for (;;) {
        try {
            return await fs.promises.realpath(current);
        } catch (error) {
            if (!isFsNotFoundError(error)) {
                throw error;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                return null;
            }
            current = parent;
        }
    }
}

async function resolvePathWithinKnowledgeBase(
    rawPath: unknown,
    options: { expectedType?: 'file' | 'directory' | 'any'; allowMissing?: boolean } = {}
): Promise<string> {
    const requestedPath = String(rawPath || '').trim();
    if (!requestedPath) {
        throw makeAccessDeniedError('Missing path.');
    }

    const kbRootCanonical = await fs.promises.realpath(KB_ROOT);
    const candidate = path.isAbsolute(requestedPath)
        ? path.resolve(requestedPath)
        : path.resolve(kbRootCanonical, requestedPath);

    if ((process as NodeJS.Process & { pkg?: unknown }).pkg && isPkgSnapshotPath(candidate)) {
        throw makeAccessDeniedError('pkg snapshot paths are not allowed.');
    }

    if (options.allowMissing) {
        const ancestor = await resolveNearestExistingAncestor(candidate);
        if (!ancestor || !isPathInsideRoot(ancestor, kbRootCanonical)) {
            throw makeAccessDeniedError('Path is outside configured knowledge base.');
        }
        return candidate;
    }

    const candidateCanonical = await fs.promises.realpath(candidate);
    if (!isPathInsideRoot(candidateCanonical, kbRootCanonical)) {
        throw makeAccessDeniedError('Path is outside configured knowledge base.');
    }

    const stat = await fs.promises.stat(candidateCanonical);
    if (options.expectedType === 'file' && !stat.isFile()) {
        throw makeAccessDeniedError('Expected a file path.');
    }
    if (options.expectedType === 'directory' && !stat.isDirectory()) {
        throw makeAccessDeniedError('Expected a directory path.');
    }
    return candidateCanonical;
}

function parseOptionalPositiveDimension(value: unknown): number | undefined {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return undefined;
    }
    return Math.floor(numericValue);
}

function parseOptionalPositiveScale(value: unknown): number | undefined {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return undefined;
    }
    return Math.min(4, numericValue);
}


function parseOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
            return true;
        }
        if (normalized === 'false' || normalized === '0' || normalized === 'no') {
            return false;
        }
    }
    return undefined;
}

function normalizeMermaidRendererPreference(value: unknown): MermaidRendererPreference {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'local') {
        return 'local';
    }
    if (normalized === 'frontend' || normalized === 'bridge') {
        return 'frontend';
    }
    return FORCE_FRONTEND_MERMAID_RENDER ? 'frontend' : 'auto';
}

const GRAPHVIZ_RENDER_TIMEOUT_MS = 15_000;
const GRAPHVIZ_PROBE_TIMEOUT_MS = 2_500;
const GRAPHVIZ_PROBE_CACHE_TTL_MS = 30_000;

type GraphvizDotRuntimeAvailability = {
    available: boolean;
    reason: string;
    binary: string;
    checkedAt: number;
};

let graphvizDotRuntimeAvailabilityCache: GraphvizDotRuntimeAvailability | null = null;
let graphvizDotRuntimeAvailabilityInFlight: Promise<GraphvizDotRuntimeAvailability> | null = null;

function resolveGraphvizDotBinary(): string {
    const configured = String(process.env.NOTE_CONNECTION_GRAPHVIZ_DOT_BIN || '').trim();
    return configured || 'dot';
}

function buildGraphvizDotRuntimeAvailabilityState(
    available: boolean,
    reason: string,
    binary: string
): GraphvizDotRuntimeAvailability {
    return {
        available,
        reason: String(reason || '').trim(),
        binary: String(binary || '').trim() || 'dot',
        checkedAt: Date.now(),
    };
}

async function probeGraphvizDotRuntimeAvailability(binary: string): Promise<GraphvizDotRuntimeAvailability> {
    return await new Promise<GraphvizDotRuntimeAvailability>((resolve) => {
        let settled = false;
        const settle = (state: GraphvizDotRuntimeAvailability) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(state);
        };

        const child = spawn(binary, ['-V'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let probeOutput = '';
        const timer = setTimeout(() => {
            try {
                child.kill('SIGKILL');
            } catch (_killError) {
                // Best effort.
            }
            settle(buildGraphvizDotRuntimeAvailabilityState(false, 'probe timed out', binary));
        }, GRAPHVIZ_PROBE_TIMEOUT_MS);
        const clear = () => clearTimeout(timer);

        child.stdout.on('data', (chunk: Buffer | string) => {
            probeOutput += String(chunk || '');
        });
        child.stderr.on('data', (chunk: Buffer | string) => {
            probeOutput += String(chunk || '');
        });
        child.on('error', (error) => {
            clear();
            const code = (error as NodeJS.ErrnoException)?.code || '';
            if (code === 'ENOENT') {
                settle(buildGraphvizDotRuntimeAvailabilityState(
                    false,
                    `binary '${binary}' is unavailable`,
                    binary
                ));
                return;
            }
            settle(buildGraphvizDotRuntimeAvailabilityState(
                false,
                String((error as Error)?.message || error),
                binary
            ));
        });
        child.on('close', (code) => {
            clear();
            if (code === 0) {
                settle(buildGraphvizDotRuntimeAvailabilityState(true, 'ok', binary));
                return;
            }
            const detail = String(probeOutput || '').trim().slice(0, 320);
            settle(buildGraphvizDotRuntimeAvailabilityState(
                false,
                detail || `exit code ${String(code)}`,
                binary
            ));
        });
    });
}

async function getGraphvizDotRuntimeAvailability(forceRefresh = false): Promise<GraphvizDotRuntimeAvailability> {
    const now = Date.now();
    if (!forceRefresh && graphvizDotRuntimeAvailabilityCache) {
        const ageMs = now - graphvizDotRuntimeAvailabilityCache.checkedAt;
        if (ageMs >= 0 && ageMs <= GRAPHVIZ_PROBE_CACHE_TTL_MS) {
            return graphvizDotRuntimeAvailabilityCache;
        }
    }
    if (graphvizDotRuntimeAvailabilityInFlight) {
        return graphvizDotRuntimeAvailabilityInFlight;
    }

    const binary = resolveGraphvizDotBinary();
    graphvizDotRuntimeAvailabilityInFlight = probeGraphvizDotRuntimeAvailability(binary)
        .then((state) => {
            graphvizDotRuntimeAvailabilityCache = state;
            return state;
        })
        .catch((error) => {
            const fallbackState = buildGraphvizDotRuntimeAvailabilityState(
                false,
                String((error as Error)?.message || error),
                binary
            );
            graphvizDotRuntimeAvailabilityCache = fallbackState;
            return fallbackState;
        })
        .finally(() => {
            graphvizDotRuntimeAvailabilityInFlight = null;
        });

    return graphvizDotRuntimeAvailabilityInFlight;
}

function enrichQueryBackendDiagnosticsWithRendererRuntime(
    diagnostics: KnowledgeQueryBackendDiagnostics,
    graphvizAvailability: GraphvizDotRuntimeAvailability
): KnowledgeQueryBackendDiagnostics {
    const base = (diagnostics && typeof diagnostics === 'object')
        ? diagnostics
        : {
            backendId: 'unknown',
            fallbackCount: 0,
        };
    return {
        ...base,
        rendererRuntime: {
            graphviz: {
                backendPngRuntimeAvailable: graphvizAvailability.available === true,
                dotBinary: String(graphvizAvailability.binary || '').trim() || 'dot',
                reason: String(graphvizAvailability.reason || '').trim() || undefined,
                checkedAtMs: Number.isFinite(Number(graphvizAvailability.checkedAt))
                    ? Number(graphvizAvailability.checkedAt)
                    : Date.now(),
                probeCacheTtlMs: GRAPHVIZ_PROBE_CACHE_TTL_MS,
            },
        },
    };
}

async function renderGraphvizPngWithDot(source: string): Promise<Record<string, unknown>> {
    const graphSource = String(source || '').trim();
    if (!graphSource) {
        throw new Error('Graphviz source is empty.');
    }

    const dotBinary = resolveGraphvizDotBinary();
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
        const child = spawn(dotBinary, ['-Tpng'], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const stdoutChunks: Buffer[] = [];
        let stderr = '';
        let settled = false;

        const settle = (handler: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            handler();
        };

        const timer = setTimeout(() => {
            settle(() => {
                try {
                    child.kill('SIGKILL');
                } catch (_killError) {
                    // Best effort.
                }
                graphvizDotRuntimeAvailabilityCache = buildGraphvizDotRuntimeAvailabilityState(
                    true,
                    'render timed out',
                    dotBinary
                );
                reject(new Error('Graphviz renderer timed out.'));
            });
        }, GRAPHVIZ_RENDER_TIMEOUT_MS);

        const clear = () => clearTimeout(timer);

        child.stdout.on('data', (chunk: Buffer | string) => {
            const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk || ''), 'utf8');
            if (value.length > 0) {
                stdoutChunks.push(value);
            }
        });
        child.stderr.on('data', (chunk: Buffer | string) => {
            stderr += String(chunk || '');
        });
        child.on('error', (error) => {
            clear();
            settle(() => {
                const code = (error as NodeJS.ErrnoException)?.code || '';
                if (code === 'ENOENT') {
                    graphvizDotRuntimeAvailabilityCache = buildGraphvizDotRuntimeAvailabilityState(
                        false,
                        `binary '${dotBinary}' is unavailable`,
                        dotBinary
                    );
                    reject(new Error(`Graphviz renderer binary '${dotBinary}' is unavailable.`));
                    return;
                }
                graphvizDotRuntimeAvailabilityCache = buildGraphvizDotRuntimeAvailabilityState(
                    false,
                    String((error as Error)?.message || error),
                    dotBinary
                );
                reject(error);
            });
        });
        child.on('close', (code) => {
            clear();
            settle(() => {
                graphvizDotRuntimeAvailabilityCache = buildGraphvizDotRuntimeAvailabilityState(
                    true,
                    code === 0 ? 'ok' : `exit code ${String(code)}`,
                    dotBinary
                );
                if (code !== 0) {
                    const stderrSnippet = String(stderr || '').trim().slice(0, 320);
                    const reason = stderrSnippet || `exit code ${String(code)}`;
                    reject(new Error(`Graphviz render failed: ${reason}`));
                    return;
                }
                const pngBuffer = Buffer.concat(stdoutChunks);
                if (!pngBuffer.length) {
                    reject(new Error('Graphviz renderer returned an empty PNG payload.'));
                    return;
                }
                resolve({
                    pngBase64: pngBuffer.toString('base64'),
                    renderer: 'graphviz-dot',
                });
            });
        });

        try {
            child.stdin.write(graphSource, 'utf8');
            child.stdin.end();
        } catch (error) {
            clear();
            settle(() => reject(error));
        }
    });
}

async function writeSidecarRuntimeManifest(finalPort: number): Promise<void> {
    try {
        const manifestDir = path.dirname(SIDECAR_RUNTIME_MANIFEST);
        await fs.promises.mkdir(manifestDir, { recursive: true });
        await fs.promises.writeFile(
            SIDECAR_RUNTIME_MANIFEST,
            JSON.stringify({
                host: LOOPBACK_HOST,
                port: finalPort,
                baseUrl: `http://${LOOPBACK_HOST}:${finalPort}`,
                bridgePort: effectivePathBridgePort,
                bridgeWsUrl: `ws://${LOOPBACK_HOST}:${effectivePathBridgePort}`,
                authToken: AUTH_TOKEN,
                projectRoot: runtimePaths.projectRoot,
                runtimeDataDir: RUNTIME_DATA_DIR,
                generatedAt: new Date().toISOString(),
                pid: process.pid,
            }, null, 2),
            'utf8'
        );
    } catch (error) {
        warnDiagnostic('[Sidecar] Failed to write runtime manifest:', error);
    }
}

function resolvePathBridgePort(candidate: unknown, fallbackPort: number): number {
    const resolvedPort = Number(candidate);
    return Number.isFinite(resolvedPort) && resolvedPort > 0
        ? Math.floor(resolvedPort)
        : fallbackPort;
}

function resolvePathBridgeInstancePort(candidate: unknown, fallbackPort: number): number {
    const bridgeLike = candidate as {
        getPort?: () => unknown;
        getStatus?: () => { port?: unknown } | undefined;
    } | null | undefined;
    if (bridgeLike && typeof bridgeLike.getPort === 'function') {
        return resolvePathBridgePort(bridgeLike.getPort(), fallbackPort);
    }
    if (bridgeLike && typeof bridgeLike.getStatus === 'function') {
        const status = bridgeLike.getStatus();
        return resolvePathBridgePort(status?.port, fallbackPort);
    }
    return fallbackPort;
}

function isPathBridgeBindDeniedError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'EACCES' || code === 'EPERM' || code === 'EADDRINUSE';
}

async function initializePathBridgeWithFallback(): Promise<void> {
    const allowEphemeralBridgeFallback = parseBooleanFlag(
        process.env.NOTE_CONNECTION_ALLOW_EPHEMERAL_BRIDGE_PORT_FALLBACK
    );
    const createBridge = async (bridgePort: number): Promise<void> => {
        pathBridge = new PathBridge({
            port: bridgePort,
            host: LOOPBACK_HOST,
            authToken: AUTH_TOKEN,
        });
        if (pathBridge && typeof (pathBridge as any).waitUntilReady === 'function') {
            await (pathBridge as any).waitUntilReady();
        }
        effectivePathBridgePort = resolvePathBridgeInstancePort(pathBridge, bridgePort);
    };

    try {
        await createBridge(PATH_BRIDGE_PORT);
    } catch (error) {
        if (!allowEphemeralBridgeFallback || !isPathBridgeBindDeniedError(error)) {
            throw error;
        }
        try {
            if (pathBridge && typeof (pathBridge as any).close === 'function') {
                (pathBridge as any).close();
            }
        } catch (_closeError) {
            // Closing a failed bridge is best-effort; the fallback bind below is the authoritative recovery path.
        }
        pathBridge = null;
        warnDiagnostic(
            `[Sidecar] PathBridge port ${PATH_BRIDGE_PORT} is unavailable. ` +
            'Retrying with an ephemeral loopback bridge port.'
        );
        await createBridge(0);
    }
}
async function renderMermaidWithPreference(
    source: string,
    options: {
        maxWidth?: number;
        maxHeight?: number;
        renderScale?: number;
        includeStages?: boolean;
        includeSvg?: boolean;
        rendererPreference: MermaidRendererPreference;
    }
): Promise<Record<string, unknown>> {
    const includeSvg = options.includeStages === true || options.includeSvg === true;
    const frontendPayload = {
        source,
        theme: 'dark' as const,
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        renderScale: options.renderScale,
        includeStages: options.includeStages === true,
        includeSvg,
    };

    if (options.rendererPreference !== 'local' && pathBridge) {
        try {
            const frontendRendered = await pathBridge.requestFrontendMermaidRender(frontendPayload);
            const frontendResult: Record<string, unknown> = {
                pngBase64: frontendRendered.pngBase64,
                width: frontendRendered.width,
                height: frontendRendered.height,
                renderer: frontendRendered.renderer || 'frontend-bridge',
                stages: frontendRendered.stages,
            };
            if (includeSvg && typeof frontendRendered.svg === 'string' && frontendRendered.svg.trim()) {
                frontendResult.svg = frontendRendered.svg;
            }
            return frontendResult;
        } catch (error) {
            if (options.rendererPreference === 'frontend') {
                throw error;
            }
            warnDiagnostic('[Reader] Frontend Mermaid render unavailable, falling back to local resvg:', error);
        }
    }

    const localRendered = await renderMermaidPng(source, {
        theme: 'dark',
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        renderScale: options.renderScale,
    });
    const localResult: Record<string, unknown> = {
        pngBase64: localRendered.pngBase64,
        width: localRendered.width,
        height: localRendered.height,
        renderer: 'local-resvg',
    };
    if (includeSvg && typeof localRendered.svg === 'string' && localRendered.svg.trim()) {
        localResult.svg = localRendered.svg;
    }
    return localResult;
}
function parseCachedTargetFromFileName(filename: string): string | null {
    if (filename.startsWith('data_cli_') || filename.startsWith('graph_data_cli_')) {
        return null;
    }

    const dataMatch = /^data_([a-z0-9_\-]+)\.js$/i.exec(filename);
    if (dataMatch && dataMatch[1]) {
        return dataMatch[1];
    }

    const graphMatch = /^graph_data_([a-z0-9_\-]+)\.json$/i.exec(filename);
    if (graphMatch && graphMatch[1]) {
        return graphMatch[1];
    }

    return null;
}

async function readDirEntriesSafe(dirPath: string): Promise<fs.Dirent[]> {
    try {
        return await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
        if (isFsNotFoundError(error)) {
            return [];
        }
        throw error;
    }
}

async function collectAvailableTargetsFromPath(kbRoot: string): Promise<string[]> {
    const targets = new Set<string>();

    const kbEntries = await readDirEntriesSafe(kbRoot);
    kbEntries
        .filter((entry) => entry.isDirectory())
        .forEach((entry) => targets.add(entry.name));

    for (const dir of [RUNTIME_DATA_DIR, FRONTEND_DIR]) {
        const entries = await readDirEntriesSafe(dir);
        entries.forEach((entry) => {
            if (!entry.isFile()) {
                return;
            }
            const parsed = parseCachedTargetFromFileName(entry.name);
            if (parsed) {
                targets.add(parsed);
            }
        });
    }

    return Array.from(targets).sort((a, b) => a.localeCompare(b));
}

function normalizeLearningWorkspaceTarget(value: unknown): string {
    const normalized = String(value || '').trim();
    return normalized || 'ALL_FOLDERS';
}

function deriveWorkspaceTargetScope(target: string): AgentConversationRequest['scope'] | undefined {
    const normalizedTarget = normalizeLearningWorkspaceTarget(target);
    if (!normalizedTarget || normalizedTarget === 'ALL_FOLDERS') {
        return undefined;
    }
    const normalizedPathPrefix = `Knowledge_Base/${normalizedTarget}`.replace(/\\/g, '/');
    return {
        workspaceId: normalizedTarget.toLowerCase(),
        corpusId: normalizedTarget.toLowerCase(),
        sourcePathPrefixes: [normalizedPathPrefix],
    };
}

function resolveKnowledgeWorkspaceTargetFromConversationRequest(requestPayload: AgentConversationRequest): string {
    const activeTarget = normalizeLearningWorkspaceTarget(requestPayload.activeTarget);
    if (activeTarget && activeTarget !== 'ALL_FOLDERS') {
        return activeTarget;
    }
    const scope = requestPayload.scope;
    const workspaceId = String(scope?.workspaceId || '').trim();
    if (workspaceId) {
        return workspaceId;
    }
    const corpusId = String(scope?.corpusId || '').trim();
    if (corpusId) {
        return corpusId;
    }
    const firstPrefix = Array.isArray(scope?.sourcePathPrefixes) ? String(scope?.sourcePathPrefixes[0] || '').trim() : '';
    if (firstPrefix) {
        const normalizedPrefix = firstPrefix.replace(/\\/g, '/').replace(/^\/+/, '');
        const marker = 'Knowledge_Base/';
        if (normalizedPrefix.toLowerCase().startsWith(marker.toLowerCase())) {
            const rest = normalizedPrefix.slice(marker.length);
            const [segment] = rest.split('/').filter(Boolean);
            if (segment) {
                return segment;
            }
        }
    }
    return activeTarget;
}

function buildKnowledgeDocumentPayloadFromFile(
    file: {
        filepath: string;
        content: string;
        sourceUri?: string;
        revision?: string;
        identityAliases?: string[];
    }
): NonNullable<KnowledgeIngestRequest['documents']>[number] {
    const sourcePath = buildKnowledgeSourcePathFromFilePath(file.filepath);
    const language = /[\u4e00-\u9fff]/.test(file.content) ? 'zh' : 'en';
    return {
        sourcePath,
        sourceUri: file.sourceUri,
        revision: file.revision,
        identityAliases: file.identityAliases,
        content: file.content,
        language,
    };
}

function buildKnowledgeSourcePathFromFilePath(filePath: string): string {
    const relativePath = path.relative(KB_ROOT, filePath).replace(/\\/g, '/');
    return `Knowledge_Base/${relativePath}`.replace(/\/{2,}/g, '/');
}

async function collectMarkdownFilePaths(targetPath: string): Promise<string[]> {
    const collected: string[] = [];
    const scan = async (currentPath: string): Promise<void> => {
        const entries = await readDirEntriesSafe(currentPath);
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                await scan(fullPath);
                continue;
            }
            if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
                collected.push(fullPath);
            }
        }
    };
    await scan(targetPath);
    return collected;
}

function normalizeKnowledgeTargetLookupQuery(value: unknown): string {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[？?！!。.,;:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function deriveKnowledgeTargetLookupQueries(query: string): string[] {
    return deriveKnowledgeTargetLookupQueriesFromMessage(query);
}

async function findKnowledgeFilesByTitleLikeQueries(targetPath: string, titleLikeQueries: string[]): Promise<string[]> {
    if (titleLikeQueries.length <= 0) {
        return [];
    }
    const normalizedQueries = titleLikeQueries.map((entry) => normalizeKnowledgeTargetLookupQuery(entry)).filter(Boolean);
    const markdownFiles = await collectMarkdownFilePaths(targetPath);
    const exactMatches = markdownFiles.filter((filePath) => {
        const normalizedBaseName = normalizeKnowledgeTargetLookupQuery(path.basename(filePath, path.extname(filePath)));
        return normalizedQueries.some((query) => normalizedBaseName === query);
    });
    if (exactMatches.length > 0) {
        return exactMatches;
    }
    const fuzzyBasenameMatches = markdownFiles.filter((filePath) => {
        const normalizedBaseName = normalizeKnowledgeTargetLookupQuery(path.basename(filePath, path.extname(filePath)));
        return normalizedQueries.some((query) => normalizedBaseName.includes(query));
    });
    if (fuzzyBasenameMatches.length > 0) {
        return fuzzyBasenameMatches;
    }

    const previewMatches: string[] = [];
    for (const filePath of markdownFiles) {
        const preview = await readMarkdownTitlePreview(filePath);
        if (markdownPreviewMatchesTitleLikeQueries({
            sourcePath: buildKnowledgeSourcePathFromFilePath(filePath),
            preview,
            titleLikeQueries: normalizedQueries,
        })) {
            previewMatches.push(filePath);
        }
    }
    return previewMatches;
}

async function readMarkdownTitlePreview(filePath: string): Promise<string> {
    const handle = await fs.promises.open(filePath, 'r');
    try {
        const buffer = Buffer.allocUnsafe(KNOWLEDGE_WORKSPACE_TITLE_PREVIEW_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
        await handle.close();
    }
}

async function buildKnowledgeDocumentPayloadsFromPaths(filePaths: string[]): Promise<NonNullable<KnowledgeIngestRequest['documents']>> {
    const documents: NonNullable<KnowledgeIngestRequest['documents']> = [];
    for (const filePath of filePaths) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const identity = createResourceIdentity(
            path.relative(KB_ROOT, filePath).replace(/\\/g, '/'),
            path.basename(filePath, path.extname(filePath)),
            content,
        );
        documents.push(buildKnowledgeDocumentPayloadFromFile({
            filepath: filePath,
            content,
            ...identity,
        }));
    }
    return documents;
}

async function syncLearningWorkspaceForDocumentPaths(params: {
    target: string;
    filePaths: string[];
    reason: string;
    deletedDocuments?: NonNullable<KnowledgeIngestRequest['deletedDocuments']>;
}): Promise<{
    target: string;
    documentCount: number;
    summary: {
        ingestedDocuments: number;
        changedDocuments: number;
        deletedDocuments: number;
        activeAtoms: number;
        activeRelationEdges: number;
        recomputedDynamicRelations: boolean;
        invalidatedRelationEdges: number;
        regeneratedRelationEdges: number;
        resolvedRelationRecomputeMode: string;
        relationRecomputeLatencyMs: number;
    };
}> {
    const documents = await buildKnowledgeDocumentPayloadsFromPaths(params.filePaths);
    const result = await knowledgeLearningPlatform.ingestKnowledge({
        incremental: true,
        documents,
        deletedDocuments: params.deletedDocuments,
        ingestedAt: new Date().toISOString(),
        relationRecomputeMode: 'incremental',
    });
    logDiagnostic('[Learning Workspace] Synced selected documents into knowledge workspace.', {
        target: params.target,
        reason: params.reason,
        documentCount: documents.length,
        deletedDocumentCount: params.deletedDocuments?.length || 0,
        changedDocuments: result.summary.changedDocuments,
        activeAtoms: result.summary.activeAtoms,
    });
    return {
        target: params.target,
        documentCount: documents.length,
        summary: {
            ...result.summary,
            resolvedRelationRecomputeMode: String(result.summary.resolvedRelationRecomputeMode || 'none'),
        },
    };
}

async function syncLearningWorkspaceForTarget(target: string, reason: string): Promise<{
    target: string;
    documentCount: number;
    summary: {
        ingestedDocuments: number;
        changedDocuments: number;
        deletedDocuments: number;
        activeAtoms: number;
        activeRelationEdges: number;
        recomputedDynamicRelations: boolean;
        invalidatedRelationEdges: number;
        regeneratedRelationEdges: number;
        resolvedRelationRecomputeMode: string;
        relationRecomputeLatencyMs: number;
    };
}> {
    const normalizedTarget = normalizeLearningWorkspaceTarget(target);
    const syncKey = normalizedTarget.toLowerCase();
    const existing = activeKnowledgeWorkspaceSyncs.get(syncKey);
    if (existing) {
        return existing;
    }
    const syncPromise = (async () => {
        let resolvedTargetName = normalizedTarget;
        if (normalizedTarget !== 'ALL_FOLDERS') {
            const availableTargets = await collectAvailableTargetsFromPath(KB_ROOT);
            const matchedTarget = availableTargets.find((entry) => entry.toLowerCase() === normalizedTarget.toLowerCase());
            if (matchedTarget) {
                resolvedTargetName = matchedTarget;
            }
        }
        const targetPath = resolvedTargetName === 'ALL_FOLDERS'
            ? KB_ROOT
            : path.join(KB_ROOT, resolvedTargetName);
        const files = await collectMarkdownFilePaths(targetPath);
        return await syncLearningWorkspaceForDocumentPaths({
            target: resolvedTargetName,
            filePaths: files,
            reason,
        });
    })();
    activeKnowledgeWorkspaceSyncs.set(syncKey, syncPromise);
    try {
        return await syncPromise;
    } finally {
        activeKnowledgeWorkspaceSyncs.delete(syncKey);
    }
}

async function ensureLearningWorkspaceHydratedForConversationRequest(
    requestPayload: AgentConversationRequest
): Promise<{
    hydrated: boolean;
    target: string;
    scope: AgentConversationRequest['scope'];
    reason: string;
}> {
    const target = resolveKnowledgeWorkspaceTargetFromConversationRequest(requestPayload);
    const derivedScope = requestPayload.scope || deriveWorkspaceTargetScope(target);
    requestPayload.scope = derivedScope;
    const readinessBeforeSync = await knowledgeLearningPlatform.inspectKnowledgeWorkspaceRequest({
        query: requestPayload.message,
        scope: derivedScope,
        includeSourceInventory: true,
    });
    if (!target || target === 'ALL_FOLDERS') {
        const explicitAllFoldersTarget = String(requestPayload.activeTarget || '').trim().toUpperCase() === 'ALL_FOLDERS';
        if (explicitAllFoldersTarget) {
            await syncLearningWorkspaceForTarget('ALL_FOLDERS', 'conversation_auto_hydration_all_folders');
            return {
                hydrated: true,
                target: 'ALL_FOLDERS',
                scope: derivedScope,
                reason: 'conversation_auto_hydration_all_folders',
            };
        }
        return {
            hydrated: false,
            target,
            scope: derivedScope,
            reason: readinessBeforeSync.readiness.status,
        };
    }

    const availableTargets = await collectAvailableTargetsFromPath(KB_ROOT);
    const resolvedTarget = availableTargets.find((entry) => entry.toLowerCase() === target.toLowerCase()) || target;
    const targetPath = path.join(KB_ROOT, resolvedTarget);
    const targetPathExists = await pathExists(targetPath);
    const targetFiles = await collectMarkdownFilePaths(targetPath);
    const diskSourcePaths = targetFiles.map(buildKnowledgeSourcePathFromFilePath);
    const indexedSourcePaths = readinessBeforeSync.sourceInventory?.sourcePaths || [];
    const inventoryDiff = buildKnowledgeSourceInventoryDiff({
        diskSourcePaths,
        indexedSourcePaths,
    });
    const indexedItemsByPath = new Map(
        (readinessBeforeSync.sourceInventory?.items || []).map((item) => [
            normalizeKnowledgeSourcePath(item.sourcePath),
            item,
        ])
    );
    // A missing target directory is an unavailable filesystem boundary, not an
    // authoritative empty corpus. API/mobile callers may legitimately ingest a
    // document before its host materializes the directory, and deleting those
    // indexed projections would make the next conversation observe an empty store.
    const deletedDocuments = targetPathExists
        ? inventoryDiff.removedSourcePaths
            .map((sourcePath) => indexedItemsByPath.get(normalizeKnowledgeSourcePath(sourcePath)))
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .map((item) => ({
                documentId: item.documentId,
                sourcePath: item.sourcePath,
            }))
        : [];

    if (
        readinessBeforeSync.readiness.status === 'ready'
        && inventoryDiff.addedSourcePaths.length <= 0
        && deletedDocuments.length <= 0
    ) {
        return {
            hydrated: false,
            target: resolvedTarget,
            scope: derivedScope,
            reason: 'existing_store_ready',
        };
    }

    const titleLikeQueries = deriveKnowledgeTargetLookupQueries(String(requestPayload.message || ''));
    const candidateFiles = await findKnowledgeFilesByTitleLikeQueries(targetPath, titleLikeQueries);
    if (candidateFiles.length > 0) {
        await syncLearningWorkspaceForDocumentPaths({
            target: resolvedTarget,
            filePaths: candidateFiles.slice(0, KNOWLEDGE_WORKSPACE_MAX_SELECTIVE_HYDRATION_FILES),
            deletedDocuments,
            reason: 'conversation_selective_title_hydration',
        });
        return {
            hydrated: true,
            target: resolvedTarget,
            scope: derivedScope,
            reason: 'conversation_selective_title_hydration',
        };
    }

    if (deletedDocuments.length > 0 && readinessBeforeSync.readiness.status === 'ready') {
        await syncLearningWorkspaceForDocumentPaths({
            target: resolvedTarget,
            filePaths: [],
            deletedDocuments,
            reason: 'conversation_stale_source_reconciliation',
        });
        return {
            hydrated: true,
            target: resolvedTarget,
            scope: derivedScope,
            reason: 'conversation_stale_source_reconciliation',
        };
    }

    if (targetFiles.length > KNOWLEDGE_WORKSPACE_LARGE_TARGET_FILE_THRESHOLD) {
        return {
            hydrated: false,
            target: resolvedTarget,
            scope: derivedScope,
            reason: 'conversation_hydration_deferred_large_target',
        };
    }

    await syncLearningWorkspaceForDocumentPaths({
        target: resolvedTarget,
        filePaths: targetFiles,
        deletedDocuments,
        reason: 'conversation_auto_hydration',
    });
    return {
        hydrated: true,
        target: resolvedTarget,
        scope: derivedScope,
        reason: 'conversation_auto_hydration',
    };
}

async function pathExists(candidatePath: string): Promise<boolean> {
    try {
        await fs.promises.access(candidatePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        if (isFsNotFoundError(error)) {
            return false;
        }
        throw error;
    }
}

async function resolveCliPathFallback(argsList: string[]): Promise<string | null> {
    for (const arg of argsList) {
        if (arg.startsWith('-') || arg === 'true') {
            continue;
        }
        if (arg.includes('/') || arg.includes('\\')) {
            return arg;
        }
        const resolved = path.resolve(KB_ROOT, arg);
        if (await pathExists(resolved)) {
            return arg;
        }
    }
    return null;
}

async function findLatestCliBuildForKb(kbName: string): Promise<string | null> {
    const files = (await readDirEntriesSafe(RUNTIME_DATA_DIR))
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    const prefix = `data_cli_${kbName}_`;
    const matches = files
        .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.js'))
        .sort()
        .reverse();
    return matches.length > 0 ? matches[0] : null;
}

function extractRelativePathFromKbMarker(rawFilePath: string): string | null {
    const normalized = rawFilePath.replace(/\\/g, '/');
    const lowered = normalized.toLowerCase();
    const marker = '/knowledge_base/';
    const markerNoPrefix = 'knowledge_base/';

    const markerIndex = lowered.indexOf(marker);
    if (markerIndex >= 0) {
        const relative = normalized.slice(markerIndex + marker.length);
        return relative.length > 0 ? relative : null;
    }

    if (lowered.startsWith(markerNoPrefix)) {
        const relative = normalized.slice(markerNoPrefix.length);
        return relative.length > 0 ? relative : null;
    }

    return null;
}

function resolveContentCandidatePath(kbRoot: string, rawFilePath: string): string {
    const requestedPath = String(rawFilePath || '').trim();
    if (!requestedPath) {
        throw makeAccessDeniedError('Missing content path.');
    }
    if (requestedPath.includes('\0')) {
        throw makeAccessDeniedError('Invalid content path.');
    }

    const normalized = requestedPath.replace(/\\/g, '/');
    const normalizedCandidate = path.normalize(normalized);

    const relativeFromKb = extractRelativePathFromKbMarker(rawFilePath);
    if (relativeFromKb) {
        const markerScopedPath = path.resolve(kbRoot, path.normalize(relativeFromKb));
        if (!isPathInsideRoot(markerScopedPath, kbRoot)) {
            throw makeAccessDeniedError('Requested file is outside configured knowledge base.');
        }
        return markerScopedPath;
    }

    if (path.isAbsolute(normalizedCandidate)) {
        const absoluteCandidate = path.resolve(normalizedCandidate);
        if ((process as NodeJS.Process & { pkg?: unknown }).pkg && isPkgSnapshotPath(absoluteCandidate)) {
            throw makeAccessDeniedError('Absolute pkg snapshot content paths are not allowed.');
        }
        if (!isPathInsideRoot(absoluteCandidate, kbRoot)) {
            throw makeAccessDeniedError('Requested file is outside configured knowledge base.');
        }
        return absoluteCandidate;
    }

    const resolvedCandidate = path.resolve(kbRoot, normalizedCandidate);
    if (!isPathInsideRoot(resolvedCandidate, kbRoot)) {
        throw makeAccessDeniedError('Requested file is outside configured knowledge base.');
    }
    return resolvedCandidate;
}

function normalizePathForComparison(candidatePath: string): string {
    const resolved = path.resolve(candidatePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isPkgSnapshotPath(candidatePath: string): boolean {
    const normalized = normalizePathForComparison(candidatePath).replace(/\\/g, '/');
    return normalized.includes('/snapshot/');
}

function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
    const rootResolved = normalizePathForComparison(rootPath);
    const candidateResolved = normalizePathForComparison(candidatePath);
    const relative = path.relative(rootResolved, candidateResolved);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function hasPathTraversalSegment(rawPathname: string): boolean {
    const normalized = String(rawPathname || '').replace(/\\/g, '/');
    return normalized.split('/').some((segment) => segment === '..');
}

function resolveFrontendStaticPath(rawPathname: string): string | null {
    let decodedPathname = '/';
    try {
        decodedPathname = decodeURIComponent(rawPathname || '/');
    } catch (_error) {
        return null;
    }

    if (decodedPathname.includes('\0')) {
        return null;
    }
    if (hasPathTraversalSegment(decodedPathname)) {
        return null;
    }

    const normalizedPathname = path.posix.normalize(
        decodedPathname === '/' ? '/index.html' : decodedPathname.replace(/\\/g, '/')
    );
    const prefixedPathname = normalizedPathname.startsWith('/') ? normalizedPathname : `/${normalizedPathname}`;
    const resolved = path.resolve(FRONTEND_DIR, `.${prefixedPathname}`);
    if (!isPathInsideRoot(resolved, FRONTEND_DIR)) {
        return null;
    }

    return resolved;
}

function getStaticContentType(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
        case '.html':
            return 'text/html';
        case '.js':
        case '.mjs':
        case '.cjs':
            return 'text/javascript';
        case '.css':
            return 'text/css';
        case '.json':
            return 'application/json';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.svg':
            return 'image/svg+xml';
        case '.ico':
            return 'image/x-icon';
        default:
            return 'application/octet-stream';
    }
}

function buildContentSecurityPolicy(contentType: string): string | null {
    if (contentType === 'text/html') {
        return "frame-ancestors 'none'";
    }
    return null;
}

// CLI Argument Parsing (v0.9.71 Fix)
const args = process.argv.slice(2);
let cliOptions: any = {};
let hasCliBuild = false;

// Helper: Check npm config env vars (npm often passes flags as env vars)
// e.g. npm start -- --gpu -> npm_config_gpu=true
if (process.env.npm_config_path) {
    cliOptions.targetPath = process.env.npm_config_path;
    hasCliBuild = true;
}
if (process.env.npm_config_gpu === 'true' || process.env.npm_config_gpu === '') {
    cliOptions.enableGPU = true;
    cliOptions.enableGPULayout = true;
}
if (process.env.NOTE_CONNECTION_GPU === 'true' || process.env.NOTE_CONNECTION_GPU === '1') {
    cliOptions.enableGPU = true;
    cliOptions.enableGPULayout = true;
}
if (process.env.npm_config_static === 'true' || process.env.npm_config_static === '') {
    logDiagnostic('[CLI] Static mode requested (via env).');
}
if (process.env.npm_config_workers) {
    cliOptions.maxWorkers = parseInt(process.env.npm_config_workers);
}

// Fallback: Check manual args loop (in case direct node execution or npm passed them through)
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--path' && args[i+1]) {
        cliOptions.targetPath = args[++i];
        hasCliBuild = true;
    } else if (arg === '--gpu') {
        cliOptions.enableGPU = true;
        cliOptions.enableGPULayout = true; 
    } else if (arg === '--no-gpu') {
        cliOptions.enableGPU = false;
        cliOptions.enableGPULayout = false;
    } else if (arg === '--static') {
        logDiagnostic('[CLI] Static mode requested (Frontend auto-detects large graphs).');
    } else if (arg === '--workers' && args[i+1]) {
        cliOptions.maxWorkers = parseInt(args[++i]);
    }
    // Heuristic for Positional Args (if flags were stripped)
    // If not a flag (doesn't start with -) and looks like a path (contains / or \)
    else if (!arg.startsWith('-') && (arg.includes('/') || arg.includes('\\'))) {
        // Assume it's the path if we haven't found one yet
        if (!cliOptions.targetPath) {
            cliOptions.targetPath = arg;
            hasCliBuild = true;
        }
    }
    // If number, assume workers
    else if (!arg.startsWith('-') && !isNaN(parseInt(arg)) && parseInt(arg) < 128) {
        if (!cliOptions.maxWorkers) {
            cliOptions.maxWorkers = parseInt(arg);
        }
    }
}

logDiagnostic('[CLI] Parsed Options:', cliOptions);

function getCliFlagValue(argsList: string[], flagName: string): string | undefined {
    const index = argsList.indexOf(flagName);
    if (index < 0 || index + 1 >= argsList.length) {
        return undefined;
    }
    return String(argsList[index + 1] || '').trim() || undefined;
}

export async function executeNotemdCliCommand(subArgs: string[]): Promise<Record<string, unknown>> {
    const command = String(subArgs[0] || '').trim().toLowerCase();
    const action = String(subArgs[1] || '').trim().toLowerCase();

    if (!command) {
        throw new Error('Missing NoteMD CLI command.');
    }

    if (command === 'settings' && action === 'show') {
        return {
            command: 'settings.show',
            settings: await loadNotemdSettings(),
        };
    }

    if (command === 'settings' && action === 'set-api') {
        const settings = await loadNotemdSettings();
        const providerName = getCliFlagValue(subArgs, '--provider');
        if (!providerName) {
            throw new Error('Missing --provider for settings set-api.');
        }
        const provider = settings.providers.find((item) => item.name === providerName);
        if (!provider) {
            throw new Error(`Unknown provider: ${providerName}`);
        }

        const nextSettings = cloneNotemdSettings(settings);
        nextSettings.activeProvider = provider.name;
        nextSettings.providers = nextSettings.providers.map((item) => {
            if (item.name !== provider.name) {
                return item;
            }
            return {
                ...item,
                baseUrl: getCliFlagValue(subArgs, '--base-url') || item.baseUrl,
                model: getCliFlagValue(subArgs, '--model') || item.model,
                apiKey: getCliFlagValue(subArgs, '--api-key') || item.apiKey,
                apiVersion: getCliFlagValue(subArgs, '--api-version') || item.apiVersion,
                temperature: Number.isFinite(Number(getCliFlagValue(subArgs, '--temperature')))
                    ? Number(getCliFlagValue(subArgs, '--temperature'))
                    : item.temperature,
            };
        });

        return {
            command: 'settings.set-api',
            settings: await persistNotemdSettings(nextSettings),
        };
    }

    const settings = await loadNotemdSettings();
    if (command === 'one-click-extract') {
        const filePath = getCliFlagValue(subArgs, '--file');
        if (!filePath) {
            throw new Error('Missing --file for one-click-extract.');
        }
        const resolvedFilePath = await resolvePathWithinKnowledgeBase(filePath, { expectedType: 'file' });
        return {
            command: 'one-click-extract',
            result: await notemdService.oneClickExtract(resolvedFilePath, settings),
        };
    }

    if (command === 'extract-concepts') {
        const filePath = getCliFlagValue(subArgs, '--file');
        if (!filePath) {
            throw new Error('Missing --file for extract-concepts.');
        }
        const resolvedFilePath = await resolvePathWithinKnowledgeBase(filePath, { expectedType: 'file' });
        return {
            command: 'extract-concepts',
            result: await notemdService.extractConcepts(resolvedFilePath, settings),
        };
    }

    if (command === 'batch-generate') {
        const folderPath = getCliFlagValue(subArgs, '--folder');
        if (!folderPath) {
            throw new Error('Missing --folder for batch-generate.');
        }
        const resolvedFolderPath = await resolvePathWithinKnowledgeBase(folderPath, { expectedType: 'directory' });
        return {
            command: 'batch-generate',
            result: await notemdService.generateFolderContent(resolvedFolderPath, settings),
        };
    }

    if (command === 'batch-mermaid-fix') {
        const folderPath = getCliFlagValue(subArgs, '--folder');
        if (!folderPath) {
            throw new Error('Missing --folder for batch-mermaid-fix.');
        }
        const resolvedFolderPath = await resolvePathWithinKnowledgeBase(folderPath, { expectedType: 'directory' });
        return {
            command: 'batch-mermaid-fix',
            result: await notemdService.batchFixMermaid(resolvedFolderPath, true),
        };
    }

    if (command === 'fix-mermaid') {
        const filePath = getCliFlagValue(subArgs, '--file');
        if (!filePath) {
            throw new Error('Missing --file for fix-mermaid.');
        }
        const resolvedFilePath = await resolvePathWithinKnowledgeBase(filePath, { expectedType: 'file' });
        return {
            command: 'fix-mermaid',
            result: await notemdService.fixMermaid(resolvedFilePath, true),
        };
    }

    throw new Error(`Unsupported NoteMD CLI command: ${[command, action].filter(Boolean).join(' ')}`);
}

export const startServer = async (options: { port?: number, targetPath?: string } = {}) => {
    // If options are provided, override CLI/Env defaults or merge them
    if (options.targetPath) {
        cliOptions.targetPath = options.targetPath;
        hasCliBuild = true; // Assume explicit path implies specific build intent or context
    }
    if (cliOptions.targetPath === 'true') {
        const fallbackPath = await resolveCliPathFallback(args);
        if (fallbackPath) {
            cliOptions.targetPath = fallbackPath;
            hasCliBuild = true;
        } else {
            warnDiagnostic("[CLI] Warning: targetPath detected as 'true'. This usually means npm consumed the flag incorrectly. Please check your command syntax.");
            delete cliOptions.targetPath;
            hasCliBuild = false;
        }
    } else if (!cliOptions.targetPath) {
        const fallbackPath = await resolveCliPathFallback(args);
        if (fallbackPath) {
            cliOptions.targetPath = fallbackPath;
            hasCliBuild = true;
        }
    }
    const finalPort = typeof options.port === 'number' ? options.port : PORT;
    let runtimePort = finalPort;

    if (hasCliBuild) {
        const kbName = path.basename(cliOptions.targetPath || 'knowledge_base');
        let useExisting = false;
        
        // Only do interactive prompt if we are in a TTY and effectively running standalone
        // For Electron auto-start, we might want to skip this or handle it differently.
        // For now, if passed via options, we assume 'Regenerate' or 'Load' should be automatic or decided by caller?
        // Let's keep existing logic but realize it might block if no TTY.
        // CHECK: If options.targetPath is passed, do we skip the prompt? 
        // If we are required to not block, we should probably default to "Load" if exists, or "Gen" if not.
        
        const latest = await findLatestCliBuildForKb(kbName);
        if (latest) {
            logDiagnostic(`\n[CLI] Found existing build for '${kbName}': ${latest}`);

            // If specific options passed (embedded mode), default to Load to avoid blocking
            // Otherwise use interactive prompt
            if (options.targetPath) {
                useExisting = true;
                const suffix = latest.replace('data_cli_', '').replace('.js', '');
                cliOptions.outputPrefix = suffix;
                logDiagnostic(`[CLI] Auto-Loading existing data: ${latest}`);
            } else {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise<string>(resolve => {
                    rl.question('[CLI] Do you want to (L)oad existing or (R)egenerate? [L/r]: ', (ans) => {
                        rl.close();
                        resolve(ans.trim().toLowerCase());
                    });
                });

                if (answer === '' || answer === 'l') {
                    useExisting = true;
                    // Extract suffix: data_cli_{suffix}.js
                    // suffix = kbName_time
                    const suffix = latest.replace('data_cli_', '').replace('.js', '');
                    cliOptions.outputPrefix = suffix;
                    logDiagnostic(`[CLI] Loading existing data: ${latest}`);
                }
            }
        }

        if (!useExisting) {
            const now = new Date();
            const timeStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
            cliOptions.outputPrefix = `${kbName}_${timeStr}`;
            
            logDiagnostic(`[CLI] Generating new knowledge graph for: ${cliOptions.targetPath}`);
            try {
                await buildGraph(cliOptions);
                logDiagnostic('[CLI] Generation complete.');
            } catch (e) {
                console.error('[CLI] Build failed:', e);
                process.exit(1);
            }
        }
    }

    // --- Strict Registry Mode ---
    // Why: The inline notemd handlers (~1,147 lines) are a legacy fallback from
    // the pre-modularization era. The route registry intercepts all covered routes
    // first (line ~13170), making the inline handlers unreachable in production.
    // This flag lets us verify 100% coverage in CI before safe deletion.
    // Conditional (off by default): integration tests start the server without
    // full registry init and depend on the inline fallback. Once all tests use
    // the registry, this becomes default and inline handlers can be deleted.
    const STRICT_REGISTRY = process.env.NOTE_CONNECTION_STRICT_REGISTRY === '1';
    const ROUTE_DISPATCH_MODE = String(process.env.NOTE_CONNECTION_ROUTE_DISPATCH_MODE || 'registry')
        .trim()
        .toLowerCase() === 'legacy'
        ? 'legacy'
        : 'registry';
    const USE_REGISTRY_DISPATCH = ROUTE_DISPATCH_MODE === 'registry';

    // --- Route Registry (modular dispatch for extracted route groups) ---
    const runtimeRunbookOps = createRuntimeRunbookRouteOps({
        buildRuntimePayload: buildKnowledgeRuntimePayload,
        normalizeCheckId: normalizeRuntimeRunbookCheckIdToken,
        replayVerificationForCheck: replayRuntimeRunbookVerificationForCheck,
        buildIndexSyncHealthSummary: buildRuntimeRunbookVectorAccelerationIndexSyncHealthSummary,
        queryHistory: queryRuntimeRunbookVerificationHistory,
        parseHistoryLimit: parseRuntimeRunbookVerificationHistoryLimit,
        parseHistorySinceMinutes: parseRuntimeRunbookVerificationHistorySinceMinutes,
        normalizeVerificationStatus: normalizeRuntimeRunbookVerificationStatusToken,
        queryChecks: queryRuntimeRunbookVerificationHistoryByCheck,
        parseChecksLimit: parseRuntimeRunbookVerificationHistoryByCheckLimit,
        queryActionQueue: queryRuntimeRunbookVerificationActionQueue,
        parseActionQueueLimit: parseRuntimeRunbookVerificationActionQueueLimit,
        normalizeActionQueuePriorityFilter: normalizeRuntimeRunbookVerificationActionQueuePriorityFilterToken,
        normalizeActionQueueCategoryFilter: normalizeRuntimeRunbookVerificationActionQueueCategoryFilterToken,
        normalizeActionQueueRemediationStatusFilter:
            normalizeRuntimeRunbookVerificationActionQueueRemediationStatusFilterToken,
        normalizeActionQueueRemediationTrendFilter:
            normalizeRuntimeRunbookVerificationActionQueueRemediationTrendFilterToken,
        queryRemediationHistory: queryRuntimeRunbookRemediationEventHistory,
        parseRemediationLimit: parseRuntimeRunbookRemediationEventLimit,
        normalizeRemediationStatusQuery: normalizeRuntimeRunbookRemediationEventStatusQueryToken,
        normalizeRemediationSource: normalizeRuntimeRunbookRemediationEventSourceToken,
        getReplaySchedule: getRuntimeRunbookRemediationReplayScheduleSnapshot,
        normalizeRemediationEventPayload: normalizeRuntimeRunbookRemediationEventPayload,
        appendRemediationEventRecord: appendRuntimeRunbookRemediationEventRecord,
        getRemediationEventCount: () => runtimeRunbookRemediationEventRecords.length,
        triggerReplayScheduleFromEvent: triggerRuntimeRunbookRemediationReplayScheduleFromEvent,
        normalizeRemediationReplayRequestPayload: normalizeRuntimeRunbookRemediationReplayRequestPayload,
        replayRemediationEvents: replayRuntimeRunbookRemediationEvents,
        updateReplaySchedule: updateRuntimeRunbookRemediationReplayScheduleConfig,
        normalizeReplayScheduleTickPayload: normalizeRuntimeRunbookRemediationReplayScheduleTickPayload,
        tickReplaySchedule: tickRuntimeRunbookRemediationReplaySchedule,
    });

    const routeContext: ServerContext = {
        knowledgeLearningPlatform,
        scheduleKnowledgeLearningPlatformWarmup,
        knowledgeIngestor,
        knowledgeQuerier,
        conversationManager,
        masteryEngine,
        qualityEvaluator,
        tutorRouter,
        memoryPolicyManager,
        notemdService,
        loadNotemdSettings,
        getNotemdOperationSummary: () => ({
            total: NOTEMD_ACTIVE_OPERATIONS.size,
            running: Array.from(NOTEMD_ACTIVE_OPERATIONS.values()).filter(
                (operation) => operation.status === 'running'
            ).length,
        }),
        executeQueryBackendConfigUpdate: async (payload: unknown) => {
            const requestPayload = normalizeQueryBackendConfigRequestPayload(payload);
            const result = await knowledgeLearningPlatform.updateQueryBackendConfig(requestPayload);
            ACTIVE_KNOWLEDGE_QUERY_BACKEND = result.configuredBackend;
            const baseDiagnostics = knowledgeLearningPlatform.getQueryBackendDiagnostics();
            const graphvizRuntimeAvailability = await getGraphvizDotRuntimeAvailability();
            const diagnostics = enrichQueryBackendDiagnosticsWithRendererRuntime(
                baseDiagnostics,
                graphvizRuntimeAvailability
            );
            return {
                result,
                diagnostics,
                configuredVectorAccelerationProvider: QUERY_VECTOR_ACCELERATION_PROVIDER,
                configuredVectorAccelerationFailureMode: QUERY_VECTOR_ACCELERATION_FAILURE_MODE,
                configuredVectorAccelerationRepresentationStrict: QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT_ENABLED,
                queryVectorAnnPrefilterEnabled: QUERY_VECTOR_ANN_PREFILTER_ENABLED,
                rolloutProfile: buildKnowledgeRuntimeRolloutProfile(),
            };
        },
        persistNotemdSettings,
        loadFrontendSettings,
        markdownGateway,
        LOOPBACK_HOST,
        finalPort,
        KNOWLEDGE_GRAPH_STORE_BACKEND,
        KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER,
        KNOWLEDGE_GRAPHDB_ADAPTER_ID,
        KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED,
        KNOWLEDGE_GRAPHDB_OPERATION_MODE,
        kbRoot: KB_ROOT,
        runtimeDataDir: RUNTIME_DATA_DIR,
        runtimeRunbookOps,
        getPathBridge: () => pathBridge,
    };

    // Route migration tracking
    let routeRegistryHits = 0;
    let routeInlineFallbacks = 0;

    const allRoutes = registerAllRoutes(routeContext);
    const routeMap = new Map<string, Map<string, RouteEntry>>();
    const prefixRoutes: RouteEntry[] = [];

    for (const route of allRoutes) {
        if (route.prefix) {
            prefixRoutes.push(route);
        } else {
            const methodMap = routeMap.get(route.method) || new Map();
            methodMap.set(route.path, route);
            routeMap.set(route.method, methodMap);
        }
    }

    const routeMigrationStats = {
        totalModularRoutes: allRoutes.length,
        totalInlineRoutes: 7, // terminal routes (meta/diagnostics/static-serve) — intentionally kept inline
        dispatchMode: ROUTE_DISPATCH_MODE,
        // notemd inline block (~1,147 lines) is 100% registry-covered (30 registry routes > 16 inline).
        // Pending safe deletion after integration test; set NOTE_CONNECTION_STRICT_REGISTRY=1 to skip inline.
        registryHits: () => routeRegistryHits,
        inlineFallbacks: () => routeInlineFallbacks,
        registryHitRate: () => {
            const total = routeRegistryHits + routeInlineFallbacks;
            return total === 0 ? '0.0%' : (routeRegistryHits / total * 100).toFixed(1) + '%';
        },
        migrationProgress: () => {
            const covered = allRoutes.length;
            const total = covered + 7; // 7 terminal routes intentionally kept inline
            return (covered / total * 100).toFixed(1) + '%';
        },
    };

    const server = http.createServer(async (req, res) => {
        const requestId = resolveRequestId(req);
        const requestMethod = String(req.method || 'GET').trim().toUpperCase() || 'GET';
        const requestPath = getRawRequestPathname(req.url);
        const requestStartedAtMs = Date.now();
        const requestStartedAt = new Date(requestStartedAtMs).toISOString();
        const requestContentLengthHeader = Number(req.headers['content-length']);
        const requestContentLength = Number.isFinite(requestContentLengthHeader)
            ? Math.max(0, Math.floor(requestContentLengthHeader))
            : null;
        const requestRemoteAddress = String(req.socket?.remoteAddress || '').trim();
        const requestUserAgent = String(req.headers['user-agent'] || '').trim().slice(0, 180);
        res.setHeader('X-Request-Id', requestId);
        res.on('finish', () => {
            if (!requestPath.startsWith('/api/')) {
                return;
            }
            const responseContentLengthHeader = Number(res.getHeader('content-length'));
            const responseContentLength = Number.isFinite(responseContentLengthHeader)
                ? Math.max(0, Math.floor(responseContentLengthHeader))
                : null;
            const responseErrorCode = normalizeApiErrorCodeToken(
                res.getHeader(ERROR_CODE_HEADER),
                ''
            );
            appendRuntimeApiRequestTrace({
                requestId,
                method: requestMethod,
                path: requestPath,
                statusCode: Number(res.statusCode || 0),
                errorCode: responseErrorCode || undefined,
                durationMs: Number((Date.now() - requestStartedAtMs).toFixed(4)),
                startedAt: requestStartedAt,
                finishedAt: new Date().toISOString(),
                responseContentType: String(res.getHeader('content-type') || '').trim(),
                responseContentLength,
                requestContentLength,
                remoteAddress: requestRemoteAddress,
                userAgent: requestUserAgent,
            });
        });

        if (!applyCorsHeaders(req, res)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Origin is not allowed.' }));
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (!isAuthorizedRequest(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized sidecar request.' }));
            return;
        }

        // Route Registry Dispatch: try modular routes first, fall through to legacy inline chain
        const methodMap = routeMap.get(req.method || 'GET');
        if (USE_REGISTRY_DISPATCH && methodMap) {
            const exactRoute = methodMap.get(requestPath);
            if (exactRoute) {
                routeRegistryHits++;
                await exactRoute.handler(req, res, routeContext);
                return;
            }
            for (const prefixRoute of prefixRoutes) {
                if (requestPath.startsWith(prefixRoute.path) && prefixRoute.method === (req.method || 'GET')) {
                    routeRegistryHits++;
                    await prefixRoute.handler(req, res, routeContext);
                    return;
                }
            }
        }
        if (requestPath.startsWith('/api/')) {
            routeInlineFallbacks++;
        }

        // ── Inline Chain (Legacy) ──────────────────────────────────
        // Route distribution:
        //   Registry-covered: ~80 routes (knowledge:36G+28P, notemd:2G+16P, + data/render)
        //   Terminal inline:  ~7 routes intentionally kept inline:
        //     - runtime-diagnostics, runtime-request-trace (meta: report server state)
        //     - static file serving (requires FRONTEND_DIR + MIME resolution)
        //     - graph asset serving (requires cliOptions + generated asset paths)
        //     - generated asset resolution (requires CLI build output paths)
        //   These are terminal — they require deep server state that can't be
        //   cleanly exposed through ServerContext without circular dependencies.
        //   Total:            ~105 route patterns
        //
        // The registry dispatch (above) intercepts covered routes first.
        // Tag [REGISTRY_COVERED] marks routes already handled by registry.
        // Migration metrics: GET /api/runtime-diagnostics → routeMigration

        if (req.method === 'GET') {
            const getPathname = getRawRequestPathname(req.url);

            // ── Notemd routes (covered by routes/notemd.ts) ──
            // [REGISTRY_COVERED: routes/notemd.ts]
            if (STRICT_REGISTRY && getPathname.startsWith('/api/notemd/')) {
                res.writeHead(501, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'strict_registry: route must be handled by modular registry', path: getPathname }));
                routeInlineFallbacks++;
                return;
            }
            if (getPathname === '/api/notemd/settings') {
                try {
                    const settings = await loadNotemdSettings();
                    const activeOperationCount = Array.from(NOTEMD_ACTIVE_OPERATIONS.values()).filter(
                        (operation) => operation.status === 'running'
                    ).length;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            settings,
                            operationSummary: {
                                total: NOTEMD_ACTIVE_OPERATIONS.size,
                                running: activeOperationCount,
                            },
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/notemd/settings',
                        requestId,
                    });
                }
                return;
            }

            if (getPathname === '/api/notemd/provider-templates') {
                try {
                    const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
                    const persistTemplates = ['1', 'true', 'yes'].includes(
                        String(urlObj.searchParams.get('persist') || '').trim().toLowerCase()
                    );
                    let persistence = { configPath: resolveAppConfigPath(), persisted: false };
                    if (persistTemplates) {
                        persistence = await ensureNotemdProviderTemplatesPersisted();
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            templates: NOTEMD_PROVIDER_TEMPLATES,
                            configPath: persistence.configPath,
                            persisted: persistence.persisted,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/notemd/provider-templates',
                        requestId,
                    });
                }
                return;
            }

            if (getPathname === '/api/notemd/workspace') {
                try {
                    const settings = await loadNotemdSettings();
                    const workspace = extractNotemdWorkspaceState(settings);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            workspace,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/notemd/workspace',
                        requestId,
                    });
                }
                return;
            }

            if (getPathname === '/api/path-mode/settings') {
                try {
                    const settings = await loadPathModeSettings();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            settings,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/path-mode/settings',
                        requestId,
                    });
                }
                return;
            }

            if (getPathname === '/api/frontend/settings') {
                try {
                    const settings = await loadFrontendSettings();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            settings,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/frontend/settings',
                        requestId,
                    });
                }
                return;
            }

            if (getPathname === '/api/runtime-request-trace') {
                try {
                    const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
                    const queryOptions = normalizeRuntimeRequestTraceQueryOptions(urlObj.searchParams);
                    const result = queryRuntimeApiRequestTrace(queryOptions);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            result,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/runtime-request-trace',
                        requestId,
                    });
                }
                return;
            }

            if (req.url === '/api/runtime-diagnostics') {
                try {
                    const graphvizRuntimeAvailability = await getGraphvizDotRuntimeAvailability();
                    const bridgeSummary = pathBridge && typeof (pathBridge as any).getClientSummary === 'function'
                        ? (pathBridge as any).getClientSummary()
                        : null;
                    const bridgeStatus = pathBridge && typeof (pathBridge as any).getStatus === 'function'
                        ? (pathBridge as any).getStatus()
                        : null;
                    const runtimeRequestTraceSummary = queryRuntimeApiRequestTrace({
                        limit: 1,
                        pathPrefix: '',
                        statusAtLeast: 0,
                        method: '',
                        errorCode: '',
                        requestId: '',
                    }).summary;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        runtime: {
                            host: LOOPBACK_HOST,
                            port: runtimePort,
                            bridgePort: effectivePathBridgePort,
                            kbRoot: KB_ROOT,
                            frontendDir: FRONTEND_DIR,
                            runtimeDataDir: RUNTIME_DATA_DIR,
                            authRequired: AUTH_TOKEN.length > 0
                        },
                        ingress: {
                            jsonBodyLimitBytes: REQUEST_BODY_LIMIT_BYTES,
                            requestBodySpoolThresholdBytes: REQUEST_BODY_SPOOL_THRESHOLD_BYTES,
                            requestBodySpoolThresholdKb: REQUEST_BODY_SPOOL_THRESHOLD_POLICY.selectedKiB,
                            requestBodySpoolThresholdSource: REQUEST_BODY_SPOOL_THRESHOLD_POLICY.source,
                            requestBodySpoolThresholdRecommendedKb: REQUEST_BODY_SPOOL_THRESHOLD_POLICY.recommendedKiB,
                            requestBodySpoolThresholdStrictMode: REQUEST_BODY_SPOOL_THRESHOLD_POLICY.strictMode,
                            requestBodySpoolThresholdRangeKb: {
                                min: REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.min,
                                max: REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.max
                            },
                            clipboardBodyLimitBytes: CLIPBOARD_BODY_LIMIT_BYTES,
                            clipboardBodyLimitMb: CLIPBOARD_BODY_LIMIT_MB,
                            clipboardBodyLimitRangeMb: {
                                min: CLIPBOARD_BODY_LIMIT_RANGE_MB.min,
                                max: CLIPBOARD_BODY_LIMIT_RANGE_MB.max
                            }
                        },
                        wasmParity: WasmParityRuntime.getDiagnostics(),
                        computeModes: collectComputeModeSnapshot(),
                        requestTrace: {
                            ...runtimeRequestTraceSummary,
                        },
                        renderers: {
                            graphviz: {
                                backendPngRuntimeAvailable: graphvizRuntimeAvailability.available,
                                dotBinary: graphvizRuntimeAvailability.binary,
                                reason: graphvizRuntimeAvailability.reason,
                                checkedAtMs: graphvizRuntimeAvailability.checkedAt,
                                probeCacheTtlMs: GRAPHVIZ_PROBE_CACHE_TTL_MS,
                            },
                        },
                        pathBridge: {
                            summary: bridgeSummary,
                            status: bridgeStatus
                        },
                        routeMigration: {
                            totalModularRoutes: routeMigrationStats.totalModularRoutes,
                            registryHits: routeMigrationStats.registryHits(),
                            inlineFallbacks: routeMigrationStats.inlineFallbacks(),
                            registryHitRate: routeMigrationStats.registryHitRate(),
                            migrationProgress: routeMigrationStats.migrationProgress(),
                            modularRoutes: routeMigrationStats.totalModularRoutes,
                            inlineOnlyRoutes: routeMigrationStats.totalInlineRoutes,
                            dispatchMode: routeMigrationStats.dispatchMode,
                        },
                        domains: {
                            ingest: knowledgeIngestor.getDiagnostics(),
                            query: knowledgeQuerier.getDiagnosticsSummary(),
                            conversation: conversationManager.getDiagnosticsSummary(),
                            mastery: masteryEngine.getDiagnosticsSummary(),
                            quality: qualityEvaluator.getDiagnosticsSummary(),
                            tutor: tutorRouter.getDiagnosticsSummary(),
                            memory: memoryPolicyManager.getDiagnosticsSummary(),
                        }
                    }));
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/runtime-diagnostics');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }

            if (req.url === '/api/folders') {
                try {
                    // Use configured path or default
                    // Note: KB_ROOT is currently module-level constant. We should probably make it dynamic?
                    // For now, if we pass targetPath, we might be focusing on THAT path.
                    // But /api/folders lists "Knowledge_Base" by default.
                    let entries: fs.Dirent[] = [];
                    try {
                        entries = await fs.promises.readdir(KB_ROOT, { withFileTypes: true });
                    } catch (error) {
                        if (isFsNotFoundError(error)) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ folders: [] }));
                            return;
                        }
                        throw error;
                    }

                    if (!entries.length) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ folders: [] }));
                        return;
                    }

                    // Filter directories
                    const folders = entries
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name)
                        .sort((a, b) => a.localeCompare(b));
                    
                    // Also enable "All" option effectively by logic, but here we just list folders.
                    // The frontend can add an "All" option.
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ folders }));
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/folders');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }

            if (req.url === '/api/available-targets') {
                try {
                    const targets = await collectAvailableTargetsFromPath(KB_ROOT);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ targets }));
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/available-targets');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }
    
            if (req.url?.startsWith('/api/content')) {
                try {
                    const urlObj = new URL(req.url, `http://${LOOPBACK_HOST}:${finalPort}`);
                    const requestedPath = urlObj.searchParams.get('path');
                    
                    if (!requestedPath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing path parameter' }));
                        return;
                    }

                    const decodedPath = decodeURIComponent(requestedPath);
                    const kbRootCanonical = await fs.promises.realpath(KB_ROOT);
                    const candidatePath = resolveContentCandidatePath(kbRootCanonical, decodedPath);
                    const filePathCanonical = await fs.promises.realpath(candidatePath);
                    if (!isPathInsideRoot(filePathCanonical, kbRootCanonical)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Requested file is outside configured knowledge base' }));
                        return;
                    }

                    const fileStat = await fs.promises.stat(filePathCanonical);
                    if (!fileStat.isFile()) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'File not found' }));
                        return;
                    }

                    const content = await fs.promises.readFile(filePathCanonical, 'utf-8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ content }));
    
                } catch (error) {
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    if (isFsNotFoundError(error)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'File not found' }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/content');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }

            // GET any generated graph assets (e.g. data_cli.js, data.js, graph_data.json)
            // Must parse pathname so cache-busting query strings (`?v=...`) still route correctly.
            if (req.url && !req.url.startsWith('/api/')) {
                const assetUrlObj = new URL(req.url, `http://${LOOPBACK_HOST}:${finalPort}`);
                const assetPathname = decodeURIComponent(assetUrlObj.pathname);
                if (assetPathname.endsWith('.js') || assetPathname.endsWith('.json')) {
                    let filename = path.basename(assetPathname);

                    if (hasCliBuild && cliOptions.outputPrefix) {
                        if (filename === 'data.js') {
                            filename = `data_cli_${cliOptions.outputPrefix}.js`;
                        } else if (filename === 'graph_data.json') {
                            filename = `graph_data_cli_${cliOptions.outputPrefix}.json`;
                        }
                    }

                    const generatedPath = isGeneratedGraphAsset(filename)
                        ? await resolveGeneratedAssetForReadAsync(filename)
                        : null;
                    const bundledPath = path.join(FRONTEND_DIR, filename);
                    const filePath = generatedPath || (await isRegularFile(bundledPath) ? bundledPath : null);

                    if (filePath) {
                        const ext = path.extname(filename);
                        const contentType = ext === '.json' ? 'application/json' : 'application/javascript';
                        
                        try {
                            const content = await fs.promises.readFile(filePath);
                    const headers: Record<string, string> = { 'Content-Type': contentType };
                    const cspHeader = buildContentSecurityPolicy(contentType);
                    if (cspHeader) {
                        headers['Content-Security-Policy'] = cspHeader;
                    }
                    res.writeHead(200, headers);
                    res.end(content);
                    return;
                        } catch (err) {
                            CrashLogger.log(err, `AssetRead:${filename}`);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: `Failed to load asset: ${String(err)}` }));
                            return;
                        }
                    }
                }
                // Let it fall through to static serving/404 if not found.
            }

            // GET /api/kb-path â€” Return current Knowledge Base root path
            // Legacy parity mapping: replaced historical desktop IPC getter.
            // è¿”å›žå½“å‰çŸ¥è¯†åº“æ ¹è·¯å¾„ï¼ˆåŽ†å² IPC getter çš„æ¡¥æŽ¥æ›¿ä»£å®žçŽ°ï¼‰ã€‚
            if (req.url?.startsWith('/api/kb-path')) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ kbPath: KB_ROOT }));
                return;
            }

            // GET /api/check-cache?target=financial â€” Check if cached graph exists
            // Legacy parity mapping for previous desktop cache-check flow.
            // æ£€æŸ¥æŒ‡å®šç›®æ ‡çš„å›¾è°±ç¼“å­˜æ˜¯å¦å­˜åœ¨ï¼ˆåŽ†å²æ¡Œé¢ç¼“å­˜æ£€æŸ¥é“¾è·¯çš„æ¡¥æŽ¥å®žçŽ°ï¼‰ã€‚
            if (req.url?.startsWith('/api/check-cache')) {
                try {
                    const urlObj = new URL(req.url, `http://${LOOPBACK_HOST}:${finalPort}`);
                    const target = urlObj.searchParams.get('target');
                    
                    if (!target) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(null));
                        return;
                    }

                    if (target === 'ALL_FOLDERS') {
                        const activeJsPath = await resolveGeneratedAssetForReadAsync('data.js');
                        if (activeJsPath) {
                            const stats = await fs.promises.stat(activeJsPath);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                date: stats.mtime.toLocaleString(),
                                size: stats.size,
                                source: 'active'
                            }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(null));
                        }
                        return;
                    }
                    
                    const targetName = target.replace(/[^a-z0-9_\-]/gi, '_');
                    const cachePath = await resolveGeneratedAssetForReadAsync(`data_${targetName}.js`);
                    
                    if (cachePath) {
                        const stats = await fs.promises.stat(cachePath);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            date: stats.mtime.toLocaleString(),
                            size: stats.size
                        }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(null));
                    }
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/check-cache');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }

            // GET /api/restore-cache?target=financial â€” Restore cached graph as active data
            // Legacy parity mapping for previous desktop cache-restore flow.
            // Copies data_{target}.js â†’ data.js and graph_data_{target}.json â†’ graph_data.json
            // ä»Žç¼“å­˜æ¢å¤å›¾è°±æ•°æ®ï¼ˆåŽ†å²æ¡Œé¢ restoreCache é“¾è·¯çš„æ¡¥æŽ¥å®žçŽ°ï¼‰ã€‚
            if (req.url?.startsWith('/api/restore-cache')) {
                try {
                    const urlObj = new URL(req.url, `http://${LOOPBACK_HOST}:${finalPort}`);
                    const target = urlObj.searchParams.get('target');
                    
                    if (!target) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing target' }));
                        return;
                    }

                    const restoreKey = `restore:${target}`;
                    const now = Date.now();
                    if (lastRestoreKey === restoreKey && (now - lastRestoreTs) < 3000) {
                        logDiagnostic(`[Cache] Duplicate restore suppressed for ${target}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, deduped: true }));
                        return;
                    }
                    lastRestoreKey = restoreKey;
                    lastRestoreTs = now;

                    if (target === 'ALL_FOLDERS') {
                        const activeJsPath = await resolveGeneratedAssetForReadAsync('data.js');
                        if (activeJsPath) {
                            ACTIVE_GRAPH_TARGET = 'ALL_FOLDERS';
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'No active cache found' }));
                        }
                        return;
                    }

                    const targetName = target.replace(/[^a-z0-9_\-]/gi, '_');
                    
                    const cacheJs = await resolveGeneratedAssetForReadAsync(`data_${targetName}.js`);
                    await ensureRuntimeDataDir();
                    const targetJs = generatedAssetWritePath('data.js');
                    const cacheJson = await resolveGeneratedAssetForReadAsync(`graph_data_${targetName}.json`);
                    const targetJson = generatedAssetWritePath('graph_data.json');
                    
                    if (cacheJs) {
                        await fs.promises.copyFile(cacheJs, targetJs);
                        if (cacheJson) {
                            await fs.promises.copyFile(cacheJson, targetJson);
                        }
                        ACTIVE_GRAPH_TARGET = target;
                        const syncResult = await syncLearningWorkspaceForTarget(target, 'restore_cache');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, sync: syncResult }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Cache not found' }));
                    }
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/restore-cache');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            // Serve static frontend files (query-string safe + traversal-safe).
            const staticFilePath = resolveFrontendStaticPath(getRawRequestPathname(req.url));
            if (!staticFilePath) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid static file path' }));
                return;
            }

            try {
                const fileStat = await fs.promises.stat(staticFilePath);
                if (!fileStat.isFile()) {
                    res.writeHead(404);
                    res.end('File not found');
                    return;
                }

                const content = await fs.promises.readFile(staticFilePath);
                res.writeHead(200, { 'Content-Type': getStaticContentType(staticFilePath) });
                res.end(content);
            } catch (error) {
                if (isFsNotFoundError(error)) {
                    res.writeHead(404);
                    res.end('File not found');
                    return;
                }
                CrashLogger.log(error, `StaticFile:${staticFilePath}`);
                res.writeHead(500);
                res.end(`Server Error: ${(error as NodeJS.ErrnoException | undefined)?.code || 'UNKNOWN'}`);
            }
        } else if (req.method === 'POST' || req.method === 'PUT') {
            const postPathname = getRawRequestPathname(req.url);

            if (postPathname === '/api/knowledge/runtime-capability-runbook/remediation-event/replay') {
                try {
                    const rolloutProfile = buildKnowledgeRuntimeRolloutProfile();
                    const payload = await readJsonBody(req);
                    const replayOptions = normalizeRuntimeRunbookRemediationReplayRequestPayload(
                        payload
                    );
                    const result = await replayRuntimeRunbookRemediationEvents(replayOptions);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            result,
                            rolloutProfile,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/runtime-capability-runbook/remediation-event/replay',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (
                postPathname
                === '/api/knowledge/runtime-capability-runbook/remediation-event/replay-schedule/tick'
            ) {
                try {
                    const rolloutProfile = buildKnowledgeRuntimeRolloutProfile();
                    const payload = await readJsonBody(req);
                    const tickOptions = normalizeRuntimeRunbookRemediationReplayScheduleTickPayload(
                        payload
                    );
                    const result = await tickRuntimeRunbookRemediationReplaySchedule({
                        force: tickOptions.force,
                        dryRunOverride: tickOptions.dryRunOverride,
                        actor: 'manual_api',
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            result,
                            rolloutProfile,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/runtime-capability-runbook/remediation-event/replay-schedule/tick',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (
                postPathname
                === '/api/knowledge/runtime-capability-runbook/remediation-event/replay-schedule'
            ) {
                try {
                    const rolloutProfile = buildKnowledgeRuntimeRolloutProfile();
                    const payload = await readJsonBody(req);
                    const result = updateRuntimeRunbookRemediationReplayScheduleConfig(payload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            result,
                            rolloutProfile,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/runtime-capability-runbook/remediation-event/replay-schedule',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/runtime-capability-runbook/remediation-event') {
                try {
                    const rolloutProfile = buildKnowledgeRuntimeRolloutProfile();
                    const payload = await readJsonBody(req);
                    const record = normalizeRuntimeRunbookRemediationEventPayload(payload, requestId);
                    appendRuntimeRunbookRemediationEventRecord(record);
                    triggerRuntimeRunbookRemediationReplayScheduleFromEvent();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            result: {
                                record,
                                summary: {
                                    totalRecords: runtimeRunbookRemediationEventRecords.length,
                                },
                            },
                            rolloutProfile,
                        })
                    );
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/runtime-capability-runbook/remediation-event',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/store/reload') {
                try {
                    const restored = await knowledgeLearningPlatform.reloadFromStore();
                    const state = knowledgeLearningPlatform.getKnowledgeState();
                    const store = await knowledgeLearningPlatform.getStoreDiagnostics();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        configuredBackend: KNOWLEDGE_GRAPH_STORE_BACKEND,
                        configuredGraphDbAdapterProvider: KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER,
                        configuredGraphDbAdapterId: KNOWLEDGE_GRAPHDB_ADAPTER_ID,
                        graphDbFallbackEnabled: KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED,
                        configuredGraphDbOperationMode: KNOWLEDGE_GRAPHDB_OPERATION_MODE,
                        restored,
                        state,
                        store,
                    }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/store/reload',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/staleness/rebuild') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeKnowledgeStalenessRebuildRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.rebuildKnowledgeFromStalenessDiagnostics(
                        requestPayload
                    );
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/staleness/rebuild',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/ingest' || postPathname === '/api/knowledge/ingest-diff') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeKnowledgeIngestRequestPayload(payload);
                    if (postPathname === '/api/knowledge/ingest-diff' && typeof requestPayload.incremental !== 'boolean') {
                        requestPayload.incremental = true;
                    }
                    const result = await knowledgeLearningPlatform.ingestKnowledge(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: `API:POST ${postPathname}`,
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/query-backend-config') {
                try {
                    const payload = await readJsonBody(req);
                    const responsePayload = await routeContext.executeQueryBackendConfigUpdate?.(payload);
                    if (!responsePayload) {
                        throw new Error('Query backend config operation is unavailable.');
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, ...responsePayload }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/query-backend-config',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/query/compare-backends') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeKnowledgeQueryBackendComparisonRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.compareQueryBackends(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/query/compare-backends',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/query') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeKnowledgeQueryRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.queryKnowledge(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/query',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/conversation') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeAgentConversationRequestPayload(payload);
                    const streamRequested = requestAcceptsEventStream(req);
                    const turnId = resolveAgentConversationTurnId(req, requestId);
                    const requestFingerprint = buildAgentConversationRequestFingerprint(requestPayload);
                    const turnRecord = getOrCreateAgentConversationTurnCacheRecord(
                        turnId,
                        requestFingerprint
                    );

                    if (!streamRequested) {
                        const wasCompletedBeforeExecution = turnRecord.status === 'completed';
                        await ensureAgentConversationTurnExecution(turnRecord, requestPayload);
                        if (turnRecord.status === 'completed' && turnRecord.result) {
                            if (wasCompletedBeforeExecution) {
                                AGENT_CONVERSATION_TURN_CACHE_COUNTERS.syncReuseCount += 1;
                            }
                            res.setHeader('X-Agent-Conversation-Turn-Id', turnId);
                            res.setHeader(
                                'X-Agent-Conversation-Replay',
                                wasCompletedBeforeExecution ? 'hit' : 'miss'
                            );
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            const responseResult = requestPayload.responseProfile === 'mobile_compact'
                                ? buildMobileAgentConversationResponse(turnRecord.result)
                                : turnRecord.result;
                            res.end(JSON.stringify({ success: true, result: responseResult }));
                            return;
                        }
                        throwAgentConversationCachedFailure(turnRecord.failure);
                    }

                    const shouldEmitLive = turnRecord.status === 'running'
                        && !turnRecord.inFlight
                        && turnRecord.events.length === 0;
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream; charset=utf-8',
                        'Cache-Control': 'no-cache, no-transform',
                        Connection: 'keep-alive',
                        'X-Accel-Buffering': 'no',
                        'X-Agent-Conversation-Turn-Id': turnId,
                        'X-Agent-Conversation-Replay': shouldEmitLive ? 'miss' : 'hit',
                    });
                    if (typeof (res as { flushHeaders?: () => void }).flushHeaders === 'function') {
                        (res as { flushHeaders?: () => void }).flushHeaders?.();
                    }

                    if (shouldEmitLive) {
                        emitAgentConversationInitialTurnEvents({
                            record: turnRecord,
                            requestPayload,
                            topK: normalizeAgentConversationTopK(requestPayload.topK),
                            emittedAt: new Date().toISOString(),
                            writeLiveEvent: (event) => {
                                writeSseEvent(res, event.type, event);
                            },
                        });
                        await new Promise<void>((resolve) => setImmediate(resolve));
                        await ensureAgentConversationTurnExecution(turnRecord, requestPayload, {
                                emitLiveEvent: (event) => {
                                    writeSseEvent(
                                        res,
                                        event.type,
                                        projectAgentConversationTurnEvent(event, requestPayload)
                                    );
                                },
                            });
                    } else {
                        await ensureAgentConversationTurnExecution(turnRecord, requestPayload);
                        replayAgentConversationTurnEvents(res, turnRecord, requestPayload);
                    }
                    res.end();
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/conversation',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/mastery/diagnose') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeMasteryDiagnosticsRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.diagnoseMastery(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/mastery/diagnose',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/mastery/misconceptions') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeMasteryMisconceptionRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.queryMasteryMisconceptions(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/mastery/misconceptions',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/path') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeLearningPathRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.previewLearningPath(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/path',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/session/plan') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeStudySessionRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.buildStudySession(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/session/plan',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/session/orchestration/config') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeStudySessionOrchestrationConfigUpdateRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.updateStudySessionOrchestrationConfig(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/session/orchestration/config',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/session/plan/evaluate') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeStudySessionPlanQualityEvaluationRequestPayload(payload);
                    const adaptiveEnabled = typeof requestPayload.adaptiveThresholdsEnabled === 'boolean'
                        ? requestPayload.adaptiveThresholdsEnabled
                        : STUDY_SESSION_PLAN_QUALITY_ADAPTIVE_THRESHOLDS_ENABLED;
                    const result = await knowledgeLearningPlatform.evaluateStudySessionPlanQuality({
                        ...requestPayload,
                        thresholds: {
                            ...STUDY_SESSION_PLAN_QUALITY_THRESHOLDS,
                            ...(requestPayload.thresholds || {}),
                        },
                        adaptiveThresholdsEnabled: adaptiveEnabled,
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/session/plan/evaluate',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/session/action') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeStudySessionActionExecutionRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.executeStudySessionAction(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/session/action',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/session/execute') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeStudySessionPlanExecutionRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.executeStudySessionPlan(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/session/execute',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/session/history') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeStudySessionHistoryRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.queryStudySessionHistory(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/session/history',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/quality/snapshot') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeLearningQualitySnapshotRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.captureLearningQualitySnapshot(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/quality/snapshot',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/quality/evaluate') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeLearningQualityEvaluationRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.evaluateLearningQuality(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/quality/evaluate',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/ingest/guardrails/evaluate') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeIngestGuardrailEvaluationRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.evaluateIngestGuardrails(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/ingest/guardrails/evaluate',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/tutor/action') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeTutorActionRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.executeTutorAction(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/tutor/action',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/conversation-memory/add') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeConversationMemoryAddRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.addConversationMemory(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/conversation-memory/add',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/conversation-memory/search') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeConversationMemorySearchRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.searchConversationMemory(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/conversation-memory/search',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/conversation-memory/delete') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeConversationMemoryDeleteRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.deleteConversationMemory(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/conversation-memory/delete',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/conversation-memory/feedback') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeConversationMemoryFeedbackRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.feedbackConversationMemory(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/conversation-memory/feedback',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            if (postPathname === '/api/knowledge/memory/policy') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = normalizeMemoryPolicyRequestPayload(payload);
                    const result = await knowledgeLearningPlatform.applyMemoryPolicy(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/knowledge/memory/policy',
                        requestId,
                        enableValidationStatus: true,
                    });
                }
                return;
            }

            // ── Notemd POST routes (covered by routes/notemd.ts) ──
            // [REGISTRY_COVERED: routes/notemd.ts]
            if (STRICT_REGISTRY && postPathname.startsWith('/api/notemd/')) {
                res.writeHead(501, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'strict_registry: route must be handled by modular registry', path: postPathname }));
                routeInlineFallbacks++;
                return;
            }
            if (postPathname === '/api/notemd/settings') {
                try {
                    const payload = await readJsonBody(req);
                    const settingsCandidate = isObjectRecord(payload) && payload.settings !== undefined
                        ? payload.settings
                        : payload;
                    const settings = await persistNotemdSettings(settingsCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, settings }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/notemd/settings',
                        requestId,
                    });
                }
                return;
            }

            if (postPathname === '/api/notemd/provider-templates/apply') {
                try {
                    const payload = await readJsonBody(req);
                    const rawTemplateId = isObjectRecord(payload)
                        ? String(payload.templateId || payload.template_id || '').trim()
                        : '';
                    if (!rawTemplateId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing templateId.' }));
                        return;
                    }
                    const template = getNotemdProviderTemplate(rawTemplateId);
                    if (!template) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: `Unknown provider template: ${rawTemplateId}` }));
                        return;
                    }

                    const settings = await loadNotemdSettings();
                    const updatedSettings = applyProviderTemplateToSettings(settings, rawTemplateId);
                    const persistedSettings = await persistNotemdSettings(updatedSettings);
                    const persistence = await ensureNotemdProviderTemplatesPersisted();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        template,
                        settings: persistedSettings,
                        configPath: persistence.configPath,
                        persistedTemplates: persistence.persisted,
                    }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/notemd/provider-templates/apply',
                        requestId,
                    });
                }
                return;
            }

            if (postPathname === '/api/notemd/workspace') {
                try {
                    const payload = await readJsonBody(req);
                    const workspaceCandidate = isObjectRecord(payload) && payload.workspace !== undefined
                        ? payload.workspace
                        : payload;
                    const workspace = await persistNotemdWorkspacePatch(workspaceCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, workspace }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/notemd/workspace',
                        requestId,
                    });
                }
                return;
            }

            if (postPathname === '/api/path-mode/settings') {
                try {
                    const payload = await readJsonBody(req);
                    const settingsCandidate = isObjectRecord(payload) && payload.settings !== undefined
                        ? payload.settings
                        : payload;
                    const settings = await persistPathModeSettings(settingsCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, settings }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/path-mode/settings',
                        requestId,
                    });
                }
                return;
            }

            if (postPathname === '/api/frontend/settings') {
                try {
                    const payload = await readJsonBody(req);
                    const settingsCandidate = isObjectRecord(payload) && payload.settings !== undefined
                        ? payload.settings
                        : payload;
                    const settings = await persistFrontendSettings(settingsCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, settings }));
                } catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/frontend/settings',
                        requestId,
                    });
                }
                return;
            }

            if (postPathname === '/api/markdown/index') {
                try {
                    const payload = await readJsonBody(req);
                    const requestBody = isObjectRecord(payload) ? payload : {};
                    const filePath = String(requestBody.filePath || '').trim();
                    if (!filePath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing filePath for /api/markdown/index',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }

                    const frontendSettings = await loadFrontendSettings();
                    const readingConfig = normalizeMarkdownRuntimeConfig(frontendSettings.reading);
                    const result = await markdownGateway.buildIndex(
                        {
                            filePath,
                            forceRebuild: requestBody.forceRebuild === true,
                        },
                        readingConfig
                    );
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: String((error as Error).message || 'Access denied'),
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    if (isFsNotFoundError(error)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Markdown file not found',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/markdown/index');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    }));
                }
                return;
            }

            if (postPathname === '/api/markdown/chunk') {
                try {
                    const payload = await readJsonBody(req);
                    const requestBody = isObjectRecord(payload) ? payload : {};
                    const indexId = String(requestBody.indexId || '').trim();
                    if (!indexId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing indexId for /api/markdown/chunk',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }

                    const result = await markdownGateway.getChunk({
                        indexId,
                        startBlock: Number(requestBody.startBlock) || 0,
                        blockCount: Number(requestBody.blockCount) || 1,
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/markdown/chunk');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    }));
                }
                return;
            }

            if (postPathname === '/api/markdown/resolve-node') {
                try {
                    const payload = await readJsonBody(req);
                    const requestBody = isObjectRecord(payload) ? payload : {};
                    const nodeId = String(requestBody.nodeId || '').trim();
                    if (!nodeId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing nodeId for /api/markdown/resolve-node',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }

                    const frontendSettings = await loadFrontendSettings();
                    const readingConfig = normalizeMarkdownRuntimeConfig(frontendSettings.reading);
                    const result = await markdownGateway.resolveNode(
                        {
                            nodeId,
                            currentFilePath: String(requestBody.currentFilePath || '').trim() || undefined,
                        },
                        readingConfig
                    );
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: String((error as Error).message || 'Access denied'),
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    if (isFsNotFoundError(error)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Markdown file not found',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/markdown/resolve-node');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    }));
                }
                return;
            }

            if (postPathname === '/api/markdown/resolve-wiki') {
                try {
                    const payload = await readJsonBody(req);
                    const requestBody = isObjectRecord(payload) ? payload : {};
                    const wikiTarget = String(requestBody.wikiTarget || '').trim();
                    const currentFilePath = String(requestBody.currentFilePath || '').trim();
                    if (!wikiTarget || !currentFilePath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing wikiTarget or currentFilePath for /api/markdown/resolve-wiki',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }

                    const frontendSettings = await loadFrontendSettings();
                    const readingConfig = normalizeMarkdownRuntimeConfig(frontendSettings.reading);
                    const result = await markdownGateway.resolveWiki(
                        {
                            wikiTarget,
                            currentFilePath,
                        },
                        readingConfig
                    );
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: String((error as Error).message || 'Access denied'),
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    if (isFsNotFoundError(error)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Markdown file not found',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/markdown/resolve-wiki');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    }));
                }
                return;
            }

            if (postPathname === '/api/notemd/cancel') {
                try {
                    const payload = await readJsonBody(req);
                    const operationId = String(payload.operationId || '').trim();
                    if (!operationId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing operationId' }));
                        return;
                    }

                    const operation = NOTEMD_ACTIVE_OPERATIONS.get(operationId);
                    if (!operation) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Operation not found' }));
                        return;
                    }

                    if (operation.status !== 'running') {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(
                            JSON.stringify({
                                success: false,
                                operationId,
                                status: operation.status,
                                message: 'Operation is not running.',
                            })
                        );
                        return;
                    }

                    operation.controller.abort();
                    finalizeNotemdOperation(operation, 'cancelled');

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, operationId, status: 'cancelled' }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/cancel');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/test-llm') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();

                    const providerName = String(payload.providerName || settings.activeProvider).trim();
                    const provider = settings.providers.find((item) => item.name === providerName);
                    if (!provider) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: `Unknown provider: ${providerName}` }));
                        return;
                    }

                    const result = await notemdLlmClient.testConnection(provider);
                    const statusCode = result.success ? 200 : 400;
                    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/test-llm');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/process-file') {
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);

                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }

                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const resolvedOutputPath = payload.outputPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputPath, {
                              expectedType: 'any',
                              allowMissing: true,
                          })
                        : undefined;

                    const result = await notemdService.processFile(
                        {
                            filePath: resolvedFilePath,
                            outputPath: resolvedOutputPath,
                            createConceptNotes: payload.createConceptNotes === true,
                            dryRun: payload.dryRun === true,
                        },
                        settings,
                        reporter,
                        operation.controller.signal
                    );
                    void persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: path.dirname(resolvedFilePath),
                        outputFilePath: resolvedOutputPath || result.outputPath || '',
                        outputFolderPath: path.dirname(resolvedOutputPath || result.outputPath || resolvedFilePath),
                    }).catch((workspaceError) => {
                        warnDiagnostic('[NoteMD] Failed to persist workspace state after process-file.', workspaceError);
                    });

                    finalizeNotemdOperation(operation, 'done');
                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        res.end();
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(
                            JSON.stringify({
                                success: true,
                                operationId: operation.id,
                                result,
                                logs: operation.logs,
                            })
                        );
                    }
                } catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            res.end();
                        } else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/process-file');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        res.end();
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            }

            if (postPathname === '/api/notemd/process-folder') {
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);

                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }

                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const resolvedOutputFolderPath = payload.outputFolderPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputFolderPath, {
                              expectedType: 'any',
                              allowMissing: true,
                          })
                        : undefined;

                    const result = await notemdService.processFolder(
                        {
                            folderPath: resolvedFolderPath,
                            outputFolderPath: resolvedOutputFolderPath,
                            createConceptNotes: payload.createConceptNotes === true,
                            dryRun: payload.dryRun === true,
                        },
                        settings,
                        reporter,
                        operation.controller.signal
                    );
                    void persistNotemdWorkspacePatch({
                        folderPath: resolvedFolderPath,
                        outputFolderPath: resolvedOutputFolderPath || '',
                    }).catch((workspaceError) => {
                        warnDiagnostic('[NoteMD] Failed to persist workspace state after process-folder.', workspaceError);
                    });

                    finalizeNotemdOperation(operation, 'done');
                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        res.end();
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(
                            JSON.stringify({
                                success: true,
                                operationId: operation.id,
                                result,
                                logs: operation.logs,
                            })
                        );
                    }
                } catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            res.end();
                        } else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/process-folder');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        res.end();
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            }

            if (postPathname === '/api/notemd/generate-content') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    let title = String(payload.title || '').trim();
                    const filePathCandidate = String(payload.filePath || '').trim();
                    if (!title && filePathCandidate) {
                        title = path.basename(filePathCandidate, path.extname(filePathCandidate));
                    }
                    if (!title) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing title or filePath' }));
                        return;
                    }

                    const content = await notemdService.generateContent(
                        title,
                        typeof payload.context === 'string' ? payload.context : undefined,
                        settings
                    );

                    let outputPath: string | null = null;
                    if (payload.outputPath) {
                        outputPath = await resolvePathWithinKnowledgeBase(payload.outputPath, {
                            expectedType: 'any',
                            allowMissing: true,
                        });
                    } else if (filePathCandidate) {
                        outputPath = await resolvePathWithinKnowledgeBase(filePathCandidate, {
                            expectedType: 'any',
                            allowMissing: true,
                        });
                    }
                    if (outputPath) {
                        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
                        await fs.promises.writeFile(outputPath, content, 'utf8');
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            title,
                            outputPath,
                            content,
                        })
                    );
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/generate-content');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/translate-file') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const resolvedOutputPath = payload.outputPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputPath, {
                              expectedType: 'any',
                              allowMissing: true,
                          })
                        : undefined;
                    const targetLanguage = String(payload.targetLanguage || settings.translateLanguage || settings.language).trim();
                    if (!targetLanguage) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing targetLanguage' }));
                        return;
                    }

                    const result = await notemdService.translateFile(
                        {
                            filePath: resolvedFilePath,
                            outputPath: resolvedOutputPath,
                            targetLanguage,
                        },
                        settings
                    );

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/translate-file');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/translate-folder') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const targetLanguage = String(payload.targetLanguage || settings.translateLanguage || settings.language).trim();
                    if (!targetLanguage) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing targetLanguage' }));
                        return;
                    }

                    const result = await notemdService.translateFolder(
                        resolvedFolderPath,
                        targetLanguage,
                        settings
                    );

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/translate-folder');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/fix-mermaid') {
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const inPlace = payload.inPlace !== false;
                    const result = await notemdService.fixMermaid(resolvedFilePath, inPlace);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/fix-mermaid');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/fix-formulas') {
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const inPlace = payload.inPlace !== false;
                    const result = await notemdService.fixFormulas(resolvedFilePath, inPlace);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/fix-formulas');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/check-duplicates') {
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.checkDuplicates(resolvedFilePath);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/check-duplicates');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/extract-concepts') {
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);

                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }

                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.extractConcepts(
                        resolvedFilePath,
                        settings,
                        reporter,
                        operation.controller.signal
                    );
                    void persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: path.dirname(resolvedFilePath),
                    }).catch((workspaceError) => {
                        warnDiagnostic('[NoteMD] Failed to persist workspace state after extract-concepts.', workspaceError);
                    });
                    finalizeNotemdOperation(operation, 'done');

                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        res.end();
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, operationId: operation.id, result, logs: operation.logs }));
                    }
                } catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            res.end();
                        } else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/extract-concepts');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        res.end();
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            }

            if (postPathname === '/api/notemd/one-click-extract') {
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId);
                    const reporter = createNotemdReporter(operation);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.oneClickExtract(
                        resolvedFilePath,
                        settings,
                        reporter,
                        operation.controller.signal
                    );
                    void persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: result.outputFolderPath,
                        outputFolderPath: result.outputFolderPath,
                    }).catch((workspaceError) => {
                        warnDiagnostic('[NoteMD] Failed to persist workspace state after one-click-extract.', workspaceError);
                    });
                    finalizeNotemdOperation(operation, 'done');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, operationId: operation.id, result, logs: operation.logs }));
                } catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/one-click-extract');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/batch-fix-mermaid') {
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const result = await notemdService.batchFixMermaid(resolvedFolderPath, payload.inPlace !== false);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/batch-fix-mermaid');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/generate-folder-content') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const result = await notemdService.generateFolderContent(resolvedFolderPath, settings);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/generate-folder-content');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (req.url === '/api/render/math') {
                try {
                    const payload = await readJsonBody(req);
                    const source = typeof payload.source === 'string' ? payload.source : '';
                    const displayMode = payload.displayMode !== false;
                    const maxWidth = parseOptionalPositiveDimension(payload.maxWidth);
                    const maxHeight = parseOptionalPositiveDimension(payload.maxHeight);
                    const renderScale = parseOptionalPositiveScale(payload.renderScale);

                    if (!source.trim()) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing source' }));
                        return;
                    }

                    const rendered = await renderMathPng(source, { displayMode, maxWidth, maxHeight, renderScale });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(rendered));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/render/math');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/render/mermaid') {
                try {
                    const payload = await readJsonBody(req);
                    const source = typeof payload.source === 'string' ? payload.source : '';
                    const maxWidth = parseOptionalPositiveDimension(payload.maxWidth);
                    const maxHeight = parseOptionalPositiveDimension(payload.maxHeight);
                    const renderScale = parseOptionalPositiveScale(payload.renderScale);
                    const includeStages = parseOptionalBoolean(payload.includeStages) === true;
                    const includeSvg = parseOptionalBoolean(payload.includeSvg) === true;
                    const rendererPreference = normalizeMermaidRendererPreference(payload.renderer);

                    if (!source.trim()) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing source' }));
                        return;
                    }

                    const rendered = await renderMermaidWithPreference(source, {
                        maxWidth,
                        maxHeight,
                        renderScale,
                        includeStages,
                        includeSvg,
                        rendererPreference,
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(rendered));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/render/mermaid');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/render/graphviz') {
                try {
                    const payload = await readJsonBody(req);
                    const source = typeof payload.source === 'string' ? payload.source : '';
                    if (!source.trim()) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing source' }));
                        return;
                    }

                    const rendered = await renderGraphvizPngWithDot(source);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(rendered));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/render/graphviz');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/clipboard/image') {
                try {
                    const payload = await readJsonBody(req, {
                        maxBytes: CLIPBOARD_BODY_LIMIT_BYTES,
                        spoolThresholdBytes: REQUEST_BODY_SPOOL_THRESHOLD_BYTES,
                    });
                    const pngBase64 = typeof payload.pngBase64 === 'string' ? payload.pngBase64.trim() : '';
                    if (!pngBase64) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing pngBase64' }));
                        return;
                    }

                    const pngBuffer = Buffer.from(pngBase64, 'base64');
                    if (!pngBuffer.length || !isPngBuffer(pngBuffer)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid PNG payload' }));
                        return;
                    }

                    try {
                        await copyPngToClipboard(pngBuffer);
                    } finally {
                        pngBuffer.fill(0);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/clipboard/image');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/clipboard/image-binary') {
                try {
                    const pngBuffer = await readBinaryBody(req, {
                        maxBytes: CLIPBOARD_BODY_LIMIT_BYTES,
                        spoolThresholdBytes: REQUEST_BODY_SPOOL_THRESHOLD_BYTES,
                    });
                    if (!pngBuffer.length || !isPngBuffer(pngBuffer)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid PNG payload' }));
                        return;
                    }

                    try {
                        await copyPngToClipboard(pngBuffer);
                    } finally {
                        pngBuffer.fill(0);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, transport: 'binary' }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/clipboard/image-binary');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/build') {
                try {
                    const payload = await readJsonBody(req);
                    const { target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug } = payload;
                    const requestedRelationRecomputeMode = payload?.relationRecomputeMode;
                    const relationRecomputeMode = normalizeRelationRecomputeModeValue(requestedRelationRecomputeMode);
                    if (
                        requestedRelationRecomputeMode !== undefined
                        && (!relationRecomputeMode || relationRecomputeMode === 'auto')
                    ) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'relationRecomputeMode must be one of: none, incremental, full',
                        }));
                        return;
                    }
                    logDiagnostic('Received build request for:', target, 'maxWorkers:', maxWorkers, 'enableGPU:', enableGPU, 'enableGPULayout:', enableGPULayout, 'memorySavingMode:', memorySavingMode, 'deepDebug:', deepDebug);
                    const buildKey = JSON.stringify({
                        target,
                        maxWorkers,
                        enableGPU,
                        enableGPULayout,
                        memorySavingMode,
                        deepDebug
                    });

                    // De-duplicate accidental double-submit from frontend.
                    if (activeBuildPromise) {
                        if (activeBuildKey === buildKey) {
                            logDiagnostic('[Build] Duplicate request detected. Waiting for in-flight build.');
                            await activeBuildPromise;
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: true,
                                deduped: true,
                                computeModes: collectComputeModeSnapshot()
                            }));
                            return;
                        }

                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Another build is in progress' }));
                        return;
                    }
                    
                    const buildTarget = target === 'ALL_FOLDERS' ? '' : target;
                    
                    // Resolve to ABSOLUTE path, matching legacy desktop runtime behavior.
                    // NoteConnection.ts uses targetPath directly if absolute, skipping kbRoot fallback.
                    // Without this, the relative path "financial" would be resolved against
                    // dist/Knowledge_Base/ (via __dirname) which does not exist.
                    // å°†ç›¸å¯¹è·¯å¾„è§£æžä¸ºç»å¯¹è·¯å¾„ï¼Œå¯¹é½åŽ†å²æ¡Œé¢è¿è¡Œæ—¶è¯­ä¹‰ã€‚
                    let targetToBuild: string | undefined;
                    if (buildTarget) {
                        targetToBuild = path.join(KB_ROOT, buildTarget);
                    } else {
                        targetToBuild = KB_ROOT;
                    }
                    const normalizedRuntimeTarget = buildTarget || 'ALL_FOLDERS';
                    const buildPromise = (async () => {
                        await buildGraph({
                            targetPath: targetToBuild,
                            maxWorkers,
                            enableGPU,
                            enableGPULayout,
                            memorySavingMode,
                            deepDebug
                        });
                        ACTIVE_GRAPH_TARGET = normalizedRuntimeTarget;
                        return await syncLearningWorkspaceForTarget(normalizedRuntimeTarget, 'build_graph');
                    })();
                    activeBuildKey = buildKey;
                    activeBuildPromise = buildPromise;

                    let syncResult = null;
                    try {
                        syncResult = await buildPromise;
                    } finally {
                        if (activeBuildPromise === buildPromise) {
                            activeBuildPromise = null;
                            activeBuildKey = null;
                        }
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        sync: syncResult,
                        computeModes: collectComputeModeSnapshot()
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/build');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } else if (req.url?.startsWith('/api/kb-path')) {
                try {
                    const payload = await readJsonBody(req);
                    const kbPath = typeof payload.kbPath === 'string' ? payload.kbPath.trim() : '';
                    if (kbPath) {
                        const resolvedKbPath = path.resolve(kbPath);
                        if ((process as NodeJS.Process & { pkg?: unknown }).pkg && isPkgSnapshotPath(resolvedKbPath)) {
                            res.writeHead(403, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: false,
                                error: 'pkg snapshot paths are not allowed as Knowledge Base roots'
                            }));
                            return;
                        }
                        KB_ROOT = resolvedKbPath;
                        logDiagnostic(`[API] Knowledge Base Root updated to: ${KB_ROOT}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, kbPath: KB_ROOT }));
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing kbPath' }));
                    }
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }
        }
    });

    server.on('close', () => {
        try {
            knowledgeGraphStore.close?.();
        } catch (error) {
            warnDiagnostic('[Learning] Failed to close knowledgeGraphStore cleanly during server shutdown.', error);
        }
    });
    
    return new Promise<http.Server>((resolve, reject) => {
        const explicitEphemeralFallback = parseBooleanFlag(
            process.env.NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK
        );
        const hasExplicitPortSetting =
            typeof options.port === 'number' ||
            String(process.env.NOTE_CONNECTION_PORT || '').trim().length > 0 ||
            String(process.env.PORT || '').trim().length > 0;
        const allowEphemeralFallback = explicitEphemeralFallback;

        const initializeRuntime = async (resolvedPort: number): Promise<void> => {
            runtimePort = resolvedPort;
            await ensureRuntimeDataDir();
            const turnCacheAlertHistoryLoadResult = await loadAgentConversationTurnCacheAlertHistoryFromDisk();
            logDiagnostic(`Server running at http://${LOOPBACK_HOST}:${resolvedPort}/`);
            logDiagnostic(`Knowledge Base Root: ${KB_ROOT}`);
            logDiagnostic(`Frontend Root: ${FRONTEND_DIR}`);
            logDiagnostic(`Runtime Data Root: ${RUNTIME_DATA_DIR}`);
            logDiagnostic(
                `[Runtime] Conversation turn-cache alert history loaded=${turnCacheAlertHistoryLoadResult.loaded} records=${turnCacheAlertHistoryLoadResult.loadedRecords} schemaVersion=${turnCacheAlertHistoryLoadResult.schemaVersion}`
            );

            // Initialize PathBridge
            try {
                await initializePathBridgeWithFallback();
                logDiagnostic(`[Sidecar] PathBridge initialized on ws://${LOOPBACK_HOST}:${effectivePathBridgePort}`);
            } catch (e) {
                console.error(`[Sidecar] Failed to initialize PathBridge:`, e);
                effectivePathBridgePort = PATH_BRIDGE_PORT;
            }
            await writeSidecarRuntimeManifest(resolvedPort);
            logDiagnostic(`[Sidecar] Runtime Manifest: ${SIDECAR_RUNTIME_MANIFEST}`);

            if (hasCliBuild) {
                    logDiagnostic('[CLI] Ready.');
            }
            scheduleKnowledgeLearningPlatformWarmup('server_startup');
        };

        const attachListenHandlers = (targetPort: number): void => {
            const onError = (error: NodeJS.ErrnoException): void => {
                server.off('listening', onListening);
                if (error?.code === 'EADDRINUSE' && allowEphemeralFallback && targetPort === finalPort) {
                    warnDiagnostic(
                        `[Sidecar] Port ${finalPort} is already in use. Retrying with an ephemeral loopback port.`
                    );
                    attachListenHandlers(0);
                    return;
                }
                if (error?.code === 'EADDRINUSE' && targetPort === finalPort && !allowEphemeralFallback) {
                    const guidanceError = new Error(
                        `[Sidecar] Port ${finalPort} is already in use. ` +
                        'Ephemeral port fallback is disabled by default to keep origin policy deterministic. ' +
                        'Set NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK=1 to opt in explicitly.'
                    ) as NodeJS.ErrnoException;
                    guidanceError.code = 'EADDRINUSE';
                    reject(guidanceError);
                    return;
                }
                reject(error);
            };

            const onListening = (): void => {
                server.off('error', onError);
                const address = server.address();
                const resolvedPort = (address && typeof address === 'object') ? address.port : targetPort;
                void (async () => {
                    try {
                        await initializeRuntime(resolvedPort);
                        resolve(server);
                    } catch (error) {
                        reject(error as Error);
                    }
                })();
            };

            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(targetPort, LOOPBACK_HOST);
        };

        attachListenHandlers(finalPort);
    });
};

// Only run if called directly
if (require.main === module) {
    if (args[0] === 'notemd') {
        executeNotemdCliCommand(args.slice(1))
            .then((result) => {
                console.log(JSON.stringify(result, null, 2));
                process.exit(0);
            })
            .catch((error) => {
                console.error(`[NoteMD CLI] ${error instanceof Error ? error.message : String(error)}`);
                process.exit(1);
            });
    } else {
        startServer();
    }
}

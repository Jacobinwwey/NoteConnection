/**
 * src/shared/types.ts — Shared contract types
 *
 * This module defines and re-exports the canonical types shared between
 * the frontend (.mjs) and backend (.ts) code. These types constitute the
 * API contract boundary and should be treated as the single source of truth
 * for cross-cutting type definitions.
 *
 * === Usage ===
 * - Backend (TypeScript):  import type { KnowledgeAtom, ... } from '../shared/types';
 * - Frontend (JavaScript): @typedef {import('../shared/types').KnowledgeAtom} KnowledgeAtom
 *
 * === Design Principle ===
 * Types defined here belong to the API contract, not to any single module.
 * They are versioned with the project and must remain backward-compatible
 * within a major version.
 *
 * @module shared/types
 * @version 2.3.0 — added Notemd CLI, workflow, search, diagram contracts
 */

// ── Frontend JSDoc type declarations ──
// For .mjs consumers: copy the @typedef lines below into your module JSDoc header.
//
// /** @typedef {import('../shared/types').RuntimeCapabilityContract} RuntimeCapabilityContract */
// /** @typedef {import('../shared/types').AgentWorkspaceContract} AgentWorkspaceContract */
// /** @typedef {import('../shared/types').NotemdCliOperationContract} NotemdCliOperationContract */
// /** @typedef {import('../shared/types').NotemdCliInvocationContract} NotemdCliInvocationContract */
// /** @typedef {import('../shared/types').NotemdWorkflowStageContract} NotemdWorkflowStageContract */
// /** @typedef {import('../shared/types').NotemdWorkflowResultContract} NotemdWorkflowResultContract */
// /** @typedef {import('../shared/types').SearchResultItemContract} SearchResultItemContract */
// /** @typedef {import('../shared/types').SearchResultContract} SearchResultContract */
// /** @typedef {import('../shared/types').DiagramGenerationContract} DiagramGenerationContract */
// /** @typedef {import('../shared/types').NotemdSettingsContract} NotemdSettingsContract */

// Re-export core data model types from the learning type system
export type {
    RelationKind,
    RelationProvenance,
    TemporalEdgeKind,
    MasteryOutcome,
    MasteryErrorTag,
    LearningActionKind,
    TutorActionKind,
    MemoryLayer,
    KnowledgeRepresentationType,
} from '../learning/types';

export type {
    EvidenceSpan,
    KnowledgeAtom,
    RelationEdge,
    TemporalEdge,
    LearnerConceptState,
    LearningAction,
    TutorTrace,
    MasteryPath,
    DivergencePath,
} from '../learning/types';

// Re-export API request/response contract types
export type {
    KnowledgeDocumentInput,
    KnowledgeDocumentDeleteInput,
    KnowledgeIngestRequest,
    KnowledgeIngestResponse,
    KnowledgeQueryRequest,
    KnowledgeQueryItem,
    KnowledgeQueryResponse,
    MasteryObservation,
    StalenessRecord,
    ErrorTagStat,
    IngestGuardrailGateResult,
    IngestGuardrailThresholds,
    IngestGuardrailEvaluationResponse,
} from '../learning/types';

// Re-export agent conversation contract types
export type {
    AgentConversationRequest,
    AgentConversationResponse,
    AgentConversationTurnEvent,
    ConversationMemoryAddRequest,
    ConversationMemoryDeleteRequest,
    ConversationMemoryFeedbackRequest,
    ConversationMemoryListRequest,
    ConversationMemorySearchRequest,
} from '../learning/types';

// Re-export diagnostic and trend types
export type {
    KnowledgeQueryBackendDiagnostics,
    KnowledgeQueryModeWeights,
    KnowledgeStalenessDiagnosticsRequest,
    KnowledgeStalenessDiagnosticsResponse,
    KnowledgeQueryBackendComparisonRequest,
    KnowledgeQueryBackendComparisonHistoryRequest,
    KnowledgeQueryBackendComparisonTrendRequest,
    TutorAdapterRoutingStrategy,
    TutorTraceDiagnosticsRequest,
    TutorProviderTrendDiagnosticsRequest,
    TutorProviderTrendHistoryRequest,
    MemoryPolicyDiagnosticsHistoryRequest,
    MemoryPolicyDiagnosticsTrendRequest,
    MemoryPolicyDiagnosticsRequest,
    StudySessionOrchestrationConfigUpdateRequest,
    StudySessionPlanQualityTrendRequest,
    StudySessionPlanQualityThresholds,
    StudySessionPlanQualityRuntimeThresholdDiagnosticsRequest,
    StudySessionPlanQualityEvaluationRequest,
    StudySessionPlanQualityHistoryRequest,
    LearningQualityTrendResponse,
    LearningQualityTrendRequest,
    LearningQualityHistoryRequest,
    RelationRecomputeMode,
    KnowledgeIngestOperation,
} from '../learning/types';

/**
 * Runtime capability contract — shared between frontend capability
 * probe and backend runtime capability checks.
 */
export interface RuntimeCapabilityContract {
    capabilityId: string;
    labelKey: string;
    status: 'available' | 'degraded' | 'unavailable';
    checkedAt: string;
    detail?: string;
}

/**
 * Agent workspace contract — shared between frontend pane state
 * and backend conversation/turn management.
 */
export interface AgentWorkspaceContract {
    conversationId: string;
    turnNumber: number;
    activePaneId: string | null;
    paneState: Record<string, unknown>;
    lastUpdatedAt: string;
}

// ── Notemd shared contracts (v2.3) ──

/**
 * Notemd CLI operation contract — describes a single CLI operation
 * that frontend agents can invoke via the notemd API.
 */
export interface NotemdCliOperationContract {
    operationId: string;
    operationVersion: 1;
    inputSchema: Record<string, unknown>;
    resultSchema: Record<string, unknown>;
}

/**
 * Notemd CLI invocation contract — complete set of invocable operations.
 */
export interface NotemdCliInvocationContract {
    version: 1;
    operations: NotemdCliOperationContract[];
}

/**
 * Notemd workflow stage — shared progress tracking between
 * frontend progress UI and backend workflow execution.
 */
export interface NotemdWorkflowStageContract {
    stage: string;
    status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
    percent: number;
    message: string;
    details?: Record<string, unknown>;
}

/**
 * Notemd workflow result — structured result for frontend display.
 */
export interface NotemdWorkflowResultContract {
    sourceFilePath: string;
    outputFolderPath: string;
    stages: NotemdWorkflowStageContract[];
    summary: {
        conceptsExtracted: number;
        wikiLinksAdded: number;
        titlesGenerated: number;
        titlesFailed: number;
        mermaidFilesFixed: number;
        totalElapsedMs: number;
    };
    errors: string[];
}

/**
 * Search result contract — shared between frontend search UI
 * and backend search providers.
 */
export interface SearchResultItemContract {
    title: string;
    url: string;
    content: string;
}

export interface SearchResultContract {
    query: string;
    provider: string;
    results: SearchResultItemContract[];
    totalResults: number;
    searchedAt: string;
}

/**
 * Diagram generation contract.
 */
export interface DiagramGenerationContract {
    diagramType: string;
    spec: string;
    mermaidCode?: string;
    renderErrors: string[];
    intent: string;
    generatedAt: string;
}

/**
 * Notemd settings contract — subset of settings relevant to frontend.
 */
export interface NotemdSettingsContract {
    activeProvider: string;
    searchProvider: string;
    language: string;
    enableExperimentalDiagramPipeline: boolean;
    enableBatchParallelism: boolean;
    developerMode: boolean;
    enableDuplicateDetection: boolean;
}

// ── Agent ↔ Notemd Bridge Contracts (Phase 4 P3) ──

/**
 * Simplified operation description for Agent Workspace consumption.
 * Agents use this to discover and invoke notemd operations.
 */
export interface NotemdAgentOperation {
    operationId: string;
    description: string;
    automationLevel: 'safe' | 'requires-active-file' | 'requires-selection' | 'interactive-ui';
    requiredContext: string;
    sideEffectClass: string;
    /** Whether the agent can auto-execute this without user interaction. */
    agentAutoExecutable: boolean;
    /** Required input parameter names for the operation. */
    requiredParams: string[];
}

/**
 * Agent-oriented manifest — lightweight version of the full CLI
 * capability manifest, designed for Agent Workspace consumption.
 */
export interface NotemdAgentManifest {
    version: 1;
    generatedAt: string;
    totalOperations: number;
    agentExecutableCount: number;
    operations: NotemdAgentOperation[];
}

// ── CI & Infrastructure Contracts (GitNexus cross-ref pattern) ──

/**
 * CI gate status contract — shared between CI workflows and
 * runtime diagnostics dashboard.
 */
export interface CiGateStatusContract {
    gate: string;
    workflow: string;
    status: 'pass' | 'fail' | 'in_progress' | 'skipped';
    lastRunAt: string;
    lastRunSha: string;
    url?: string;
}

/**
 * CI dashboard contract — complete CI health snapshot.
 */
export interface CiDashboardContract {
    generatedAt: string;
    gates: CiGateStatusContract[];
    summary: {
        total: number;
        passed: number;
        failed: number;
    };
}

/**
 * Snapshot staleness contract — shared between store diagnostics
 * and frontend staleness indicators (GitNexus pattern).
 */
export interface SnapshotStalenessContract {
    /** ISO timestamp of last snapshot save. */
    lastSaveAt?: string;
    /** ISO timestamp when the underlying file became newer than the save. */
    staleSince?: string;
    /** Current file mtime for comparison. */
    fileMtime?: string;
    /** Whether the snapshot is stale (file modified after last save). */
    isStale: boolean;
}

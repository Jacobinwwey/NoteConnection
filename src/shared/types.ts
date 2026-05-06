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
 */

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

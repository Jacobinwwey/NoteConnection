import type {
    AgentConversationRequest,
    AgentConversationResponse,
    IngestGuardrailEvaluationRequest,
    IngestGuardrailEvaluationResponse,
    KnowledgeIngestRequest,
    KnowledgeIngestResponse,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    LearningPathRequest,
    LearningPathResponse,
    MasteryDiagnosticsRequest,
    MasteryDiagnosticsResponse,
    MasteryMisconceptionRequest,
    MasteryMisconceptionResponse,
    MemoryPolicyRequest,
    MemoryPolicyResponse,
    StudySessionRequest,
    StudySessionResponse,
    StudySessionHistoryRequest,
    StudySessionHistoryResponse,
    StudySessionActionExecutionRequest,
    StudySessionActionExecutionResponse,
    StudySessionPlanExecutionRequest,
    StudySessionPlanExecutionResponse,
    LearningQualityEvaluationRequest,
    LearningQualityEvaluationResponse,
    LearningQualityBaselineClearRequest,
    LearningQualityBaselineEvaluateRequest,
    LearningQualityBaselineEvaluateResponse,
    LearningQualityBaselineGetRequest,
    LearningQualityBaselineResponse,
    LearningQualityBaselineSetRequest,
    LearningQualitySnapshotRequest,
    LearningQualitySnapshotResponse,
    TutorActionRequest,
    TutorActionResponse,
    WorkflowArtifactReviewFollowUpRequest,
    WorkflowArtifactReviewFollowUpResponse,
    KnowledgeSystemState,
} from './types';
import type { WorkspaceExportBundle, WorkspaceExportBundleRequest } from '../export/types';
import type { WorkflowArtifactRecord } from '../workflows/types';

export interface KnowledgeIngestAPI {
    ingestKnowledge(request: KnowledgeIngestRequest): Promise<KnowledgeIngestResponse>;
}

export interface KnowledgeQueryAPI {
    queryKnowledge(request: KnowledgeQueryRequest): Promise<KnowledgeQueryResponse>;
}

export interface MasteryDiagnosticsAPI {
    diagnoseMastery(request: MasteryDiagnosticsRequest): Promise<MasteryDiagnosticsResponse>;
}

export interface MasteryMisconceptionAPI {
    queryMasteryMisconceptions(request: MasteryMisconceptionRequest): Promise<MasteryMisconceptionResponse>;
}

export interface LearningPathAPI {
    buildLearningPath(request: LearningPathRequest): Promise<LearningPathResponse>;
}

export interface StudySessionAPI {
    buildStudySession(request: StudySessionRequest): Promise<StudySessionResponse>;
}

export interface StudySessionHistoryAPI {
    queryStudySessionHistory(request: StudySessionHistoryRequest): Promise<StudySessionHistoryResponse>;
}

export interface StudySessionActionAPI {
    executeStudySessionAction(request: StudySessionActionExecutionRequest): Promise<StudySessionActionExecutionResponse>;
}

export interface WorkflowArtifactReviewFollowUpAPI {
    executeWorkflowArtifactReviewFollowUp(
        request: WorkflowArtifactReviewFollowUpRequest
    ): Promise<WorkflowArtifactReviewFollowUpResponse>;
}

export interface StudySessionPlanExecutionAPI {
    executeStudySessionPlan(request: StudySessionPlanExecutionRequest): Promise<StudySessionPlanExecutionResponse>;
}

export interface TutorActionAPI {
    executeTutorAction(request: TutorActionRequest): Promise<TutorActionResponse>;
}

export interface MemoryPolicyAPI {
    applyMemoryPolicy(request: MemoryPolicyRequest): Promise<MemoryPolicyResponse>;
}

export interface AgentConversationAPI {
    agentConversation(request: AgentConversationRequest): Promise<AgentConversationResponse>;
}

export interface LearningQualityGateAPI {
    evaluateLearningQuality(request: LearningQualityEvaluationRequest): Promise<LearningQualityEvaluationResponse>;
}

export interface LearningQualitySnapshotAPI {
    captureLearningQualitySnapshot(request: LearningQualitySnapshotRequest): Promise<LearningQualitySnapshotResponse>;
}

export interface LearningQualityBaselineAPI {
    getLearningQualityBaseline(request: LearningQualityBaselineGetRequest): Promise<LearningQualityBaselineResponse>;
    setLearningQualityBaseline(request: LearningQualityBaselineSetRequest): Promise<LearningQualityBaselineResponse>;
    clearLearningQualityBaseline(request: LearningQualityBaselineClearRequest): Promise<LearningQualityBaselineResponse>;
    evaluateLearningQualityAgainstBaseline(
        request: LearningQualityBaselineEvaluateRequest
    ): Promise<LearningQualityBaselineEvaluateResponse>;
}

export interface IngestGuardrailAPI {
    evaluateIngestGuardrails(request: IngestGuardrailEvaluationRequest): Promise<IngestGuardrailEvaluationResponse>;
}

export interface KnowledgeRuntimeStateAPI {
    getKnowledgeState(): KnowledgeSystemState;
}

export interface WorkspaceExportBundleAPI {
    buildWorkspaceExportBundle(request: WorkspaceExportBundleRequest): Promise<WorkspaceExportBundle>;
}

export interface WorkflowArtifactQueryRequest {
    workspaceId?: string;
    sessionId?: string;
    userId?: string;
    artifactId?: string;
    runId?: string;
    artifactKinds?: string[];
    limit?: number;
}

export interface WorkflowArtifactQueryResponse {
    generatedAt: string;
    workspaceId: string | null;
    sessionId: string | null;
    userId: string | null;
    returnedArtifacts: number;
    artifacts: WorkflowArtifactRecord[];
}

export interface KnowledgeLearningPlatformAPI extends
    KnowledgeIngestAPI,
    KnowledgeQueryAPI,
    MasteryDiagnosticsAPI,
    MasteryMisconceptionAPI,
    LearningPathAPI,
    StudySessionAPI,
    StudySessionHistoryAPI,
    StudySessionActionAPI,
    WorkflowArtifactReviewFollowUpAPI,
    StudySessionPlanExecutionAPI,
    TutorActionAPI,
    MemoryPolicyAPI,
    AgentConversationAPI,
    LearningQualityGateAPI,
    LearningQualitySnapshotAPI,
    LearningQualityBaselineAPI,
    IngestGuardrailAPI,
    KnowledgeRuntimeStateAPI,
    WorkspaceExportBundleAPI {
    queryWorkflowArtifacts?(request: WorkflowArtifactQueryRequest): Promise<WorkflowArtifactQueryResponse>;
}

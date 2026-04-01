import type {
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
    LearningQualitySnapshotRequest,
    LearningQualitySnapshotResponse,
    TutorActionRequest,
    TutorActionResponse,
    KnowledgeSystemState,
} from './types';

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

export interface StudySessionPlanExecutionAPI {
    executeStudySessionPlan(request: StudySessionPlanExecutionRequest): Promise<StudySessionPlanExecutionResponse>;
}

export interface TutorActionAPI {
    executeTutorAction(request: TutorActionRequest): Promise<TutorActionResponse>;
}

export interface MemoryPolicyAPI {
    applyMemoryPolicy(request: MemoryPolicyRequest): Promise<MemoryPolicyResponse>;
}

export interface LearningQualityGateAPI {
    evaluateLearningQuality(request: LearningQualityEvaluationRequest): Promise<LearningQualityEvaluationResponse>;
}

export interface LearningQualitySnapshotAPI {
    captureLearningQualitySnapshot(request: LearningQualitySnapshotRequest): Promise<LearningQualitySnapshotResponse>;
}

export interface IngestGuardrailAPI {
    evaluateIngestGuardrails(request: IngestGuardrailEvaluationRequest): Promise<IngestGuardrailEvaluationResponse>;
}

export interface KnowledgeRuntimeStateAPI {
    getKnowledgeState(): KnowledgeSystemState;
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
    StudySessionPlanExecutionAPI,
    TutorActionAPI,
    MemoryPolicyAPI,
    LearningQualityGateAPI,
    LearningQualitySnapshotAPI,
    IngestGuardrailAPI,
    KnowledgeRuntimeStateAPI {
}

import type {
    KnowledgeIngestRequest,
    KnowledgeIngestResponse,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    LearningPathRequest,
    LearningPathResponse,
    MasteryDiagnosticsRequest,
    MasteryDiagnosticsResponse,
    MemoryPolicyRequest,
    MemoryPolicyResponse,
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

export interface LearningPathAPI {
    buildLearningPath(request: LearningPathRequest): Promise<LearningPathResponse>;
}

export interface TutorActionAPI {
    executeTutorAction(request: TutorActionRequest): Promise<TutorActionResponse>;
}

export interface MemoryPolicyAPI {
    applyMemoryPolicy(request: MemoryPolicyRequest): Promise<MemoryPolicyResponse>;
}

export interface KnowledgeRuntimeStateAPI {
    getKnowledgeState(): KnowledgeSystemState;
}

export interface KnowledgeLearningPlatformAPI extends
    KnowledgeIngestAPI,
    KnowledgeQueryAPI,
    MasteryDiagnosticsAPI,
    LearningPathAPI,
    TutorActionAPI,
    MemoryPolicyAPI,
    KnowledgeRuntimeStateAPI {
}

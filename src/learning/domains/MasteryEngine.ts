/**
 * MasteryEngine domain — L3: Mastery diagnostics, misconception detection,
 * learning path generation, study session planning, session history and execution.
 */

import type {
    MasteryDiagnosticsRequest, MasteryDiagnosticsResponse,
    MasteryMisconceptionRequest, MasteryMisconceptionResponse,
    LearningPathRequest, LearningPathResponse,
    StudySessionRequest, StudySessionResponse,
    StudySessionHistoryRequest, StudySessionHistoryResponse,
    StudySessionActionExecutionRequest, StudySessionActionExecutionResponse,
    StudySessionPlanExecutionRequest, StudySessionPlanExecutionResponse,
    StudySessionOrchestrationConfigUpdateRequest,
} from '../types';

export interface MasteryPlatform {
    diagnoseMastery(request: MasteryDiagnosticsRequest): Promise<MasteryDiagnosticsResponse>;
    queryMasteryMisconceptions(request: MasteryMisconceptionRequest): Promise<MasteryMisconceptionResponse>;
    buildLearningPath(request: LearningPathRequest): Promise<LearningPathResponse>;
    buildStudySession(request: StudySessionRequest): Promise<StudySessionResponse>;
    queryStudySessionHistory(request: StudySessionHistoryRequest): Promise<StudySessionHistoryResponse>;
    executeStudySessionAction(request: StudySessionActionExecutionRequest): Promise<StudySessionActionExecutionResponse>;
    executeStudySessionPlan(request: StudySessionPlanExecutionRequest): Promise<StudySessionPlanExecutionResponse>;
    updateStudySessionOrchestrationConfig(request: StudySessionOrchestrationConfigUpdateRequest): Promise<void>;
}

export class MasteryEngine {
    private sessionHistoryCount = 0;
    private pathGenerationCount = 0;

    constructor(private readonly platform: MasteryPlatform) {}

    async diagnoseMastery(request: MasteryDiagnosticsRequest): Promise<MasteryDiagnosticsResponse> {
        return this.platform.diagnoseMastery(request);
    }

    async queryMisconceptions(request: MasteryMisconceptionRequest): Promise<MasteryMisconceptionResponse> {
        return this.platform.queryMasteryMisconceptions(request);
    }

    async buildLearningPath(request: LearningPathRequest): Promise<LearningPathResponse> {
        this.pathGenerationCount++;
        return this.platform.buildLearningPath(request);
    }

    async buildStudySession(request: StudySessionRequest): Promise<StudySessionResponse> {
        return this.platform.buildStudySession(request);
    }

    async querySessionHistory(request: StudySessionHistoryRequest): Promise<StudySessionHistoryResponse> {
        this.sessionHistoryCount++;
        return this.platform.queryStudySessionHistory(request);
    }

    async executeSessionAction(request: StudySessionActionExecutionRequest): Promise<StudySessionActionExecutionResponse> {
        return this.platform.executeStudySessionAction(request);
    }

    async executeSessionPlan(request: StudySessionPlanExecutionRequest): Promise<StudySessionPlanExecutionResponse> {
        return this.platform.executeStudySessionPlan(request);
    }

    async updateOrchestrationConfig(request: StudySessionOrchestrationConfigUpdateRequest): Promise<void> {
        return this.platform.updateStudySessionOrchestrationConfig(request);
    }

    getPathGenerationCount(): number { return this.pathGenerationCount; }
}

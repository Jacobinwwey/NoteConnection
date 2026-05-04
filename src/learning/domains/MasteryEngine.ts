/**
 * MasteryEngine domain — L3: Mastery diagnostics, misconception detection,
 * learning path generation, study session planning, history and execution.
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
    updateStudySessionOrchestrationConfig(request: StudySessionOrchestrationConfigUpdateRequest): Promise<any>;
}

export class MasteryEngine {
    private pathGenerationCount = 0;
    private sessionBuildCount = 0;
    private sessionExecutionCount = 0;
    private actionExecutionCount = 0;
    private masteryDiagnosticCount = 0;
    private misconceptionQueryCount = 0;
    private lastPathGeneratedAt: string | null = null;

    constructor(private readonly platform: MasteryPlatform) {}

    async diagnoseMastery(request: MasteryDiagnosticsRequest): Promise<MasteryDiagnosticsResponse> {
        this.masteryDiagnosticCount++;
        return this.platform.diagnoseMastery(request);
    }

    async queryMisconceptions(request: MasteryMisconceptionRequest): Promise<MasteryMisconceptionResponse> {
        this.misconceptionQueryCount++;
        return this.platform.queryMasteryMisconceptions(request);
    }

    async buildLearningPath(request: LearningPathRequest): Promise<LearningPathResponse> {
        this.pathGenerationCount++;
        this.lastPathGeneratedAt = new Date().toISOString();
        return this.platform.buildLearningPath(request);
    }

    async buildStudySession(request: StudySessionRequest): Promise<StudySessionResponse> {
        this.sessionBuildCount++;
        return this.platform.buildStudySession(request);
    }

    async querySessionHistory(request: StudySessionHistoryRequest): Promise<StudySessionHistoryResponse> {
        return this.platform.queryStudySessionHistory(request);
    }

    async executeSessionAction(request: StudySessionActionExecutionRequest): Promise<StudySessionActionExecutionResponse> {
        this.actionExecutionCount++;
        return this.platform.executeStudySessionAction(request);
    }

    async executeSessionPlan(request: StudySessionPlanExecutionRequest): Promise<StudySessionPlanExecutionResponse> {
        this.sessionExecutionCount++;
        return this.platform.executeStudySessionPlan(request);
    }

    async updateOrchestrationConfig(request: StudySessionOrchestrationConfigUpdateRequest): Promise<any> {
        return this.platform.updateStudySessionOrchestrationConfig(request);
    }

    getPathGenerationCount(): number { return this.pathGenerationCount; }
    getSessionExecutionCount(): number { return this.sessionExecutionCount; }

    getDiagnosticsSummary() {
        return {
            masteryDiagnosticCount: this.masteryDiagnosticCount,
            misconceptionQueryCount: this.misconceptionQueryCount,
            pathGenerationCount: this.pathGenerationCount,
            lastPathGeneratedAt: this.lastPathGeneratedAt,
            sessionBuildCount: this.sessionBuildCount,
            sessionExecutionCount: this.sessionExecutionCount,
            actionExecutionCount: this.actionExecutionCount,
        };
    }
}

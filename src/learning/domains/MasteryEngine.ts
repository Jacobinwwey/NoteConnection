/** MasteryEngine domain — L3: Mastery diagnostics, learning paths, study sessions. */
export interface MasteryPlatform {
    diagnoseMastery(request: any): Promise<any>;
    queryMasteryMisconceptions(request: any): Promise<any>;
    buildLearningPath(request: any): Promise<any>;
    buildStudySession(request: any): Promise<any>;
    queryStudySessionHistory(request: any): Promise<any>;
    executeStudySessionAction(request: any): Promise<any>;
    executeStudySessionPlan(request: any): Promise<any>;
    updateStudySessionOrchestrationConfig(request: any): Promise<any>;
}

export class MasteryEngine {
    private pathGenerationCount = 0;
    private sessionBuildCount = 0;
    private sessionExecutionCount = 0;
    private actionExecutionCount = 0;
    private masteryDiagnosticCount = 0;
    private lastPathGeneratedAt: string | null = null;

    constructor(private readonly platform: MasteryPlatform) {}

    async diagnoseMastery(r: any) { this.masteryDiagnosticCount++; return this.platform.diagnoseMastery(r); }
    async queryMisconceptions(r: any) { return this.platform.queryMasteryMisconceptions(r); }
    async buildLearningPath(r: any) {
        this.pathGenerationCount++;
        this.lastPathGeneratedAt = new Date().toISOString();

        // Domain-level path quality validation
        this.validatePathRequest(r);

        const response = await this.platform.buildLearningPath(r);

        // Augment with domain-level path quality metrics
        return this.augmentPathResponse(response);
    }
    async buildStudySession(r: any) { this.sessionBuildCount++; return this.platform.buildStudySession(r); }
    async querySessionHistory(r: any) { return this.platform.queryStudySessionHistory(r); }
    async executeSessionAction(r: any) { this.actionExecutionCount++; return this.platform.executeStudySessionAction(r); }
    async executeSessionPlan(r: any) { this.sessionExecutionCount++; return this.platform.executeStudySessionPlan(r); }
    async updateOrchestrationConfig(r: any) { return this.platform.updateStudySessionOrchestrationConfig(r); }

    getPathGenerationCount(): number { return this.pathGenerationCount; }
    getSessionExecutionCount(): number { return this.sessionExecutionCount; }

    getDiagnosticsSummary() {
        return { masteryDiagnosticCount: this.masteryDiagnosticCount, pathGenerationCount: this.pathGenerationCount, lastPathGeneratedAt: this.lastPathGeneratedAt, sessionBuildCount: this.sessionBuildCount, sessionExecutionCount: this.sessionExecutionCount, actionExecutionCount: this.actionExecutionCount };
    }

    private validatePathRequest(r: any): void {
        if (!r) throw new Error('Learning path request is required.');
        const targetId = String(r?.targetId ?? '').trim();
        if (!targetId && !r?.targetIds?.length) {
            throw new Error('At least one targetId is required to build a learning path.');
        }
    }

    private augmentPathResponse(response: any): any {
        const nodes = Array.isArray(response?.nodes) ? response.nodes : [];
        return {
            ...response,
            _domain: {
                pathLength: nodes.length,
                generatedAt: this.lastPathGeneratedAt,
                generationNumber: this.pathGenerationCount,
                hasPrerequisites: nodes.some((n: any) => n?.prerequisites?.length > 0),
                estimatedDurationMinutes: nodes.length * 15, // rough estimate: 15 min per concept
            },
        };
    }
}

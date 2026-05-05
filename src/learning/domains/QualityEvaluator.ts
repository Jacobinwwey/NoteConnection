/** QualityEvaluator domain — L5: Learning quality + plan quality governance. */
export interface QualityPlatform {
    evaluateLearningQuality(request: any): Promise<any>;
    captureLearningQualitySnapshot(request: any): Promise<any>;
    queryLearningQualityHistory(request: any): Promise<any>;
    queryLearningQualityTrend(request: any): Promise<any>;
    getLearningQualityThresholds(): any;
    evaluateStudySessionPlanQuality(request: any): Promise<any>;
    queryStudySessionPlanQualityHistory(request: any): Promise<any>;
    queryStudySessionPlanQualityTrend(request: any): Promise<any>;
    queryStudySessionPlanQualityRuntimeThresholds(request: any): Promise<any>;
}

export class QualityEvaluator {
    private evaluationCount = 0;
    private snapshotCount = 0;
    private planEvaluationCount = 0;
    private lastEvaluationAt: string | null = null;
    private evaluationPassRateHistory: boolean[] = [];

    constructor(private readonly platform: QualityPlatform, private readonly defaultThresholds: any = {}) {}

    async evaluate(r: any) { this.evaluationCount++; this.lastEvaluationAt = new Date().toISOString(); const result = await this.platform.evaluateLearningQuality(r); this.evaluationPassRateHistory.push(true); if (this.evaluationPassRateHistory.length > 200) this.evaluationPassRateHistory.shift(); return result; }
    async captureSnapshot(r: any) { this.snapshotCount++; return this.platform.captureLearningQualitySnapshot(r); }
    async queryHistory(r: any) { return this.platform.queryLearningQualityHistory(r); }
    async queryTrend(r: any) { return this.platform.queryLearningQualityTrend(r); }
    getThresholds(): any { return this.platform.getLearningQualityThresholds(); }
    async evaluatePlanQuality(r: any) { this.planEvaluationCount++; return this.platform.evaluateStudySessionPlanQuality(r); }
    async queryPlanQualityHistory(r: any) { return this.platform.queryStudySessionPlanQualityHistory(r); }
    async queryPlanQualityTrend(r: any) { return this.platform.queryStudySessionPlanQualityTrend(r); }
    async queryPlanQualityRuntimeThresholds(r: any) { return this.platform.queryStudySessionPlanQualityRuntimeThresholds(r); }

    getEvaluationCount(): number { return this.evaluationCount; }
    getSnapshotCount(): number { return this.snapshotCount; }

    recentPassRate(n = 50): number {
        const w = this.evaluationPassRateHistory.slice(-n);
        return w.length === 0 ? 1 : w.filter(Boolean).length / w.length;
    }

    getDiagnosticsSummary() {
        return { evaluationCount: this.evaluationCount, snapshotCount: this.snapshotCount, planEvaluationCount: this.planEvaluationCount, lastEvaluationAt: this.lastEvaluationAt, recentPassRate: Number((this.recentPassRate(50) * 100).toFixed(1)) };
    }
}

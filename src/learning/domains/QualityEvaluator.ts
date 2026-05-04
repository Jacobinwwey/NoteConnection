/**
 * QualityEvaluator domain — L5: Learning quality evaluation, snapshots,
 * trend analysis, and plan quality governance.
 */

import type {
    LearningQualityEvaluationRequest, LearningQualityEvaluationResponse,
    LearningQualitySnapshotRequest, LearningQualitySnapshotResponse,
    LearningQualityHistoryRequest, LearningQualityHistoryResponse,
    LearningQualityTrendRequest, LearningQualityTrendResponse,
    LearningQualityThresholds,
    StudySessionPlanQualityEvaluationRequest, StudySessionPlanQualityEvaluationResponse,
    StudySessionPlanQualityHistoryRequest, StudySessionPlanQualityHistoryResponse,
    StudySessionPlanQualityTrendRequest, StudySessionPlanQualityTrendResponse,
    StudySessionPlanQualityRuntimeThresholdDiagnosticsRequest, StudySessionPlanQualityRuntimeThresholdDiagnosticsResponse,
} from '../types';

export interface QualityPlatform {
    evaluateLearningQuality(request: LearningQualityEvaluationRequest): Promise<LearningQualityEvaluationResponse>;
    captureLearningQualitySnapshot(request: LearningQualitySnapshotRequest): Promise<LearningQualitySnapshotResponse>;
    queryLearningQualityHistory(request: LearningQualityHistoryRequest): Promise<LearningQualityHistoryResponse>;
    queryLearningQualityTrend(request: LearningQualityTrendRequest): Promise<LearningQualityTrendResponse>;
    getLearningQualityThresholds(): LearningQualityThresholds;
    evaluateStudySessionPlanQuality(request: StudySessionPlanQualityEvaluationRequest): Promise<StudySessionPlanQualityEvaluationResponse>;
    queryStudySessionPlanQualityHistory(request: StudySessionPlanQualityHistoryRequest): Promise<StudySessionPlanQualityHistoryResponse>;
    queryStudySessionPlanQualityTrend(request: StudySessionPlanQualityTrendRequest): Promise<StudySessionPlanQualityTrendResponse>;
    queryStudySessionPlanQualityRuntimeThresholds(request: StudySessionPlanQualityRuntimeThresholdDiagnosticsRequest): Promise<StudySessionPlanQualityRuntimeThresholdDiagnosticsResponse>;
}

export class QualityEvaluator {
    private evaluationCount = 0;
    private snapshotCount = 0;
    private planEvaluationCount = 0;
    private lastEvaluationAt: string | null = null;
    private evaluationPassRateHistory: boolean[] = [];

    constructor(
        private readonly platform: QualityPlatform,
        private readonly defaultThresholds: Partial<LearningQualityThresholds> = {},
    ) {}

    async evaluate(request: LearningQualityEvaluationRequest): Promise<LearningQualityEvaluationResponse> {
        this.evaluationCount++;
        this.lastEvaluationAt = new Date().toISOString();
        const result = await this.platform.evaluateLearningQuality(request);
        const passed = result.deltas ? Object.keys(result.deltas).length === 0 : true;
        this.evaluationPassRateHistory.push(passed);
        if (this.evaluationPassRateHistory.length > 200) this.evaluationPassRateHistory.shift();
        return result;
    }

    async captureSnapshot(request: LearningQualitySnapshotRequest): Promise<LearningQualitySnapshotResponse> {
        this.snapshotCount++;
        return this.platform.captureLearningQualitySnapshot(request);
    }

    async queryHistory(request: LearningQualityHistoryRequest): Promise<LearningQualityHistoryResponse> {
        return this.platform.queryLearningQualityHistory(request);
    }

    async queryTrend(request: LearningQualityTrendRequest): Promise<LearningQualityTrendResponse> {
        return this.platform.queryLearningQualityTrend(request);
    }

    getThresholds(): LearningQualityThresholds { return this.platform.getLearningQualityThresholds(); }

    async evaluatePlanQuality(request: StudySessionPlanQualityEvaluationRequest): Promise<StudySessionPlanQualityEvaluationResponse> {
        this.planEvaluationCount++;
        return this.platform.evaluateStudySessionPlanQuality(request);
    }

    async queryPlanQualityHistory(request: StudySessionPlanQualityHistoryRequest): Promise<StudySessionPlanQualityHistoryResponse> {
        return this.platform.queryStudySessionPlanQualityHistory(request);
    }

    async queryPlanQualityTrend(request: StudySessionPlanQualityTrendRequest): Promise<StudySessionPlanQualityTrendResponse> {
        return this.platform.queryStudySessionPlanQualityTrend(request);
    }

    async queryPlanQualityRuntimeThresholds(request: StudySessionPlanQualityRuntimeThresholdDiagnosticsRequest): Promise<StudySessionPlanQualityRuntimeThresholdDiagnosticsResponse> {
        return this.platform.queryStudySessionPlanQualityRuntimeThresholds(request);
    }

    getEvaluationCount(): number { return this.evaluationCount; }
    getSnapshotCount(): number { return this.snapshotCount; }

    /** Pass rate over the last N evaluations (default 50). */
    recentPassRate(n = 50): number {
        const window = this.evaluationPassRateHistory.slice(-n);
        if (window.length === 0) return 1;
        return window.filter(Boolean).length / window.length;
    }

    getDiagnosticsSummary() {
        return {
            evaluationCount: this.evaluationCount,
            snapshotCount: this.snapshotCount,
            planEvaluationCount: this.planEvaluationCount,
            lastEvaluationAt: this.lastEvaluationAt,
            recentPassRate: Number((this.recentPassRate(50) * 100).toFixed(1)),
            evaluationPassRateHistorySize: this.evaluationPassRateHistory.length,
        };
    }
}

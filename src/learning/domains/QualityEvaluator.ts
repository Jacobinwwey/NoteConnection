/** QualityEvaluator — L5: Learning quality + plan quality governance.
 * Domain-level analysis complements KLP with:
 * - Multi-metric weighted health scoring (aggregated beyond gate pass/fail)
 * - Metric drift detection between consecutive snapshots
 * - Evaluation trend tracking over sliding window
 * - Quality regression detection for governance alerts
 */
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

    // Domain-level analysis state
    private evaluationHistory: Array<{
        evaluatedAt: string;
        overallPassed: boolean;
        healthScore: number;
        gateResults: Record<string, boolean>;
        deltas: Record<string, number>;
    }> = [];
    private lastSnapshot: { snapshot: any; sampledAt: string } | null = null;
    private regressionCount = 0;
    private lastRegressionAt: string | null = null;

    // Domain health scoring weights for composite metric
    private readonly healthWeights = {
        retestPassRateUplift: 0.25,
        misconceptionReduction: 0.25,
        evidenceRatio: 0.20,
        pathEffectiveness: 0.20,
        queryP95: 0.10,
    };

    constructor(private readonly platform: QualityPlatform, private readonly defaultThresholds: any = {}) {}

    // ─── Public API ─────────────────────────────────────────────────

    async evaluate(r: any) {
        this.validateEvaluationRequest(r);
        this.evaluationCount++;
        this.lastEvaluationAt = new Date().toISOString();

        // Domain-level baseline enrichment: auto-fill baseline from last snapshot
        const enriched = this.enrichWithLastSnapshot(r);

        const result = await this.platform.evaluateLearningQuality(enriched);

        // Domain-level analysis
        const healthScore = this.computeHealthScore(result);
        const driftedMetrics = this.detectMetricDrift(result);
        const regressed = this.detectRegression(result);

        this.evaluationPassRateHistory.push(result.overallPassed);
        if (this.evaluationPassRateHistory.length > 200) this.evaluationPassRateHistory.shift();

        // Record evaluation for trend analysis
        this.recordEvaluation(result, healthScore);

        if (regressed) {
            this.regressionCount++;
            this.lastRegressionAt = new Date().toISOString();
        }

        return this.augmentEvaluationResponse(result, healthScore, driftedMetrics, regressed);
    }

    async captureSnapshot(r: any) {
        this.snapshotCount++;
        const response = await this.platform.captureLearningQualitySnapshot(r);

        // Cache the latest snapshot for auto-baseline in evaluate()
        if (response?.snapshot) {
            this.lastSnapshot = {
                snapshot: response.snapshot,
                sampledAt: response.sampledAt || new Date().toISOString(),
            };
        }

        // Domain-level snapshot metadata
        return {
            ...response,
            _domain: {
                snapshotNumber: this.snapshotCount,
                isReference: this.lastSnapshot === null,
            },
        };
    }

    async queryHistory(r: any) {
        const response = await this.platform.queryLearningQualityHistory(r);
        return {
            ...response,
            _domain: {
                evaluationCount: this.evaluationCount,
                regressionCount: this.regressionCount,
                recentHealthScore: this.evaluationHistory.length > 0
                    ? this.evaluationHistory[this.evaluationHistory.length - 1].healthScore
                    : null,
            },
        };
    }

    async queryTrend(r: any) {
        const response = await this.platform.queryLearningQualityTrend(r);
        const domainTrend = this.computeDomainTrend(10);
        return { ...response, _domain: { domainTrend } };
    }

    getThresholds(): any {
        return this.platform.getLearningQualityThresholds();
    }

    async evaluatePlanQuality(r: any) {
        this.planEvaluationCount++;
        const response = await this.platform.evaluateStudySessionPlanQuality(r);

        // Domain-level plan quality analysis
        const planAnalysis = this.analyzePlanQuality(r, response);

        return {
            ...response,
            _domain: {
                planEvaluationNumber: this.planEvaluationCount,
                planAnalysis,
            },
        };
    }

    async queryPlanQualityHistory(r: any) {
        return this.platform.queryStudySessionPlanQualityHistory(r);
    }

    async queryPlanQualityTrend(r: any) {
        return this.platform.queryStudySessionPlanQualityTrend(r);
    }

    async queryPlanQualityRuntimeThresholds(r: any) {
        return this.platform.queryStudySessionPlanQualityRuntimeThresholds(r);
    }

    // ─── Public accessors ───────────────────────────────────────────

    getEvaluationCount(): number { return this.evaluationCount; }

    recentPassRate(n = 50): number {
        const w = this.evaluationPassRateHistory.slice(-n);
        return w.length === 0 ? 1 : w.filter(Boolean).length / w.length;
    }

    getRegressionCount(): number { return this.regressionCount; }

    getEvaluationHistory(): readonly any[] { return [...this.evaluationHistory]; }

    getDiagnosticsSummary() {
        const trend = this.computeDomainTrend(5);
        return {
            evaluationCount: this.evaluationCount,
            snapshotCount: this.snapshotCount,
            planEvaluationCount: this.planEvaluationCount,
            lastEvaluationAt: this.lastEvaluationAt,
            recentPassRate: Number((this.recentPassRate(50) * 100).toFixed(1)),
            regressionCount: this.regressionCount,
            lastRegressionAt: this.lastRegressionAt,
            currentHealthScore: this.evaluationHistory.length > 0
                ? this.evaluationHistory[this.evaluationHistory.length - 1].healthScore
                : null,
            healthTrend: trend,
        };
    }

    // ─── Private: validation ────────────────────────────────────────

    private validateEvaluationRequest(r: any): void {
        if (!r) throw new Error('Quality evaluation request is required.');
        if (!r?.userId) throw new Error('userId is required for quality evaluation.');
    }

    // ─── Private: augmentation ──────────────────────────────────────

    private augmentEvaluationResponse(
        response: any,
        healthScore: number,
        driftedMetrics: string[],
        regressed: boolean
    ): any {
        return {
            ...response,
            _domain: {
                evaluationNumber: this.evaluationCount,
                snapshotCount: this.snapshotCount,
                recentPassRate: this.recentPassRate(20),
                evaluatedAt: this.lastEvaluationAt,
                healthScore,
                driftedMetrics,
                regressed,
            },
        };
    }

    // ─── Private: health scoring ────────────────────────────────────

    /**
     * Compute a composite health score (0-100) from gate deltas.
     * Weights: retest uplift 25%, misconception reduction 25%,
     * evidence ratio 20%, path effectiveness 20%, query P95 10%.
     */
    private computeHealthScore(result: any): number {
        const deltas = result?.deltas || {};
        const gates = Array.isArray(result?.gates) ? result.gates : [];
        const gateMap = new Map<string, boolean>();
        for (const gate of gates) {
            gateMap.set(gate.gateId, gate.passed);
        }

        let score = 0;

        // Retest uplift: normalize to 0-1 range (expected 0-20% uplift)
        const uplift = Number(deltas.retestPassRateUpliftPct || 0);
        const upliftScore = clamp(uplift / 20, 0, 1);
        score += upliftScore * this.healthWeights.retestPassRateUplift;

        // Misconception reduction: normalize to 0-1 range (expected 0-15% reduction)
        const reduction = Number(deltas.misconceptionRecurrenceReductionPct || 0);
        const reductionScore = clamp(reduction / 15, 0, 1);
        score += reductionScore * this.healthWeights.misconceptionReduction;

        // Evidence ratio: binary gate contributes, plus bonus for high ratio
        const evidencePassed = gateMap.get('evidence_ratio') === true;
        const evidenceScore = evidencePassed ? 0.8 : 0.3;
        score += evidenceScore * this.healthWeights.evidenceRatio;

        // Path effectiveness: normalize to 0-1 range (expected 5-30% lift)
        const pathLift = Number(deltas.pathEffectivenessLiftPct || 0);
        const pathScore = clamp(pathLift / 30, 0, 1);
        score += pathScore * this.healthWeights.pathEffectiveness;

        // Query P95: passed gate = full, otherwise scale by proximity
        const queryPassed = gateMap.get('query_p95') === true;
        const queryScore = queryPassed ? 1.0 : 0.3;
        score += queryScore * this.healthWeights.queryP95;

        return Number((score * 100).toFixed(1));
    }

    // ─── Private: metric drift detection ────────────────────────────

    /**
     * Detect significant metric drift between baseline and current.
     * Flags any metric whose absolute change exceeds reasonable thresholds.
     */
    private detectMetricDrift(result: any): string[] {
        const drifted: string[] = [];
        const baseline = result?.baseline || {};
        const current = result?.current || {};
        const driftThresholds: Record<string, number> = {
            retestPassRatePct: 15,
            misconceptionRecurrenceRatePct: 10,
            evidenceBackedSuggestionRatioPct: 15,
            averagePathMasteryGainPct: 12,
            randomPathMasteryGainPct: 12,
            queryP95Ms: 2000,
        };

        for (const [key, threshold] of Object.entries(driftThresholds)) {
            const delta = Number((current[key] || 0) - (baseline[key] || 0));
            if (Math.abs(delta) > threshold) {
                const direction = delta > 0 ? '+' : '';
                drifted.push(`${key}: ${direction}${Number(delta).toFixed(1)} (threshold: ${threshold})`);
            }
        }

        return drifted;
    }

    // ─── Private: regression detection ──────────────────────────────

    /**
     * Detect quality regression by comparing current gates against
     * the previous evaluation. Regression = previously-passing gate now fails.
     */
    private detectRegression(result: any): boolean {
        if (this.evaluationHistory.length === 0) return false;

        const prev = this.evaluationHistory[this.evaluationHistory.length - 1];
        const currentGates = Array.isArray(result?.gates) ? result.gates : [];
        const currentGateMap = new Map<string, boolean>();
        for (const gate of currentGates) {
            currentGateMap.set(gate.gateId, gate.passed);
        }

        // Check if any previously-passing gate now fails
        for (const [gateId, wasPassed] of Object.entries(prev.gateResults)) {
            if (wasPassed && currentGateMap.get(gateId) === false) {
                return true;
            }
        }

        return false;
    }

    // ─── Private: evaluation history ────────────────────────────────

    private recordEvaluation(result: any, healthScore: number): void {
        const gates = Array.isArray(result?.gates) ? result.gates : [];
        const gateResults: Record<string, boolean> = {};
        for (const gate of gates) {
            gateResults[gate.gateId] = gate.passed;
        }

        this.evaluationHistory.push({
            evaluatedAt: result?.evaluatedAt || new Date().toISOString(),
            overallPassed: result?.overallPassed ?? false,
            healthScore,
            gateResults,
            deltas: { ...(result?.deltas || {}) },
        });
        if (this.evaluationHistory.length > 100) this.evaluationHistory.shift();
    }

    // ─── Private: auto-baseline from last snapshot ──────────────────

    /**
     * If no baseline is explicitly provided, use the last captured snapshot
     * as an implicit baseline, enabling trend analysis without manual setup.
     */
    private enrichWithLastSnapshot(r: any): any {
        if (r?.baseline || !this.lastSnapshot) return r;
        return { ...r, baseline: this.lastSnapshot.snapshot };
    }

    // ─── Private: domain trend computation ──────────────────────────

    private computeDomainTrend(n: number): {
        direction: string;
        recentHealthScore: number;
        windowAvgHealthScore: number;
        healthScoreDelta: number;
        snapshotCount: number;
    } {
        const window = this.evaluationHistory.slice(-n);
        if (window.length < 2) {
            return {
                direction: 'insufficient_data',
                recentHealthScore: window[0]?.healthScore ?? 0,
                windowAvgHealthScore: window[0]?.healthScore ?? 0,
                healthScoreDelta: 0,
                snapshotCount: window.length,
            };
        }

        const mid = Math.floor(window.length / 2);
        const recentAvg = window.slice(-mid).reduce((s, e) => s + e.healthScore, 0) / mid;
        const earlierAvg = window.slice(0, mid).reduce((s, e) => s + e.healthScore, 0) / mid;
        const delta = recentAvg - earlierAvg;

        return {
            direction: delta > 5 ? 'improving' : delta < -5 ? 'degrading' : 'stable',
            recentHealthScore: window[window.length - 1].healthScore,
            windowAvgHealthScore: Number((window.reduce((s, e) => s + e.healthScore, 0) / window.length).toFixed(1)),
            healthScoreDelta: Number(delta.toFixed(1)),
            snapshotCount: window.length,
        };
    }

    // ─── Private: plan quality analysis ─────────────────────────────

    private analyzePlanQuality(request: any, _response: any): {
        actionCount: number;
        hasExplicitFocus: boolean;
        hasPathStrategy: boolean;
        hasAutoPromote: boolean;
    } {
        return {
            actionCount: Array.isArray(request?.actions) ? request.actions.length : 0,
            hasExplicitFocus: Array.isArray(request?.focusAtomIds) && request.focusAtomIds.length > 0,
            hasPathStrategy: typeof request?.pathStrategy === 'string' && request.pathStrategy.length > 0,
            hasAutoPromote: request?.autoPromoteMemory === true,
        };
    }
}

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}
/** TutorRouter — L4: Tutor adapter governance + action routing validation.
 * Domain-level analysis complements KLP's executeTutorAction with:
 * - Confidence distribution tracking across action kinds and sources
 * - Evidence binding quality scoring (rule-engine vs llm-adapter)
 * - Tutor source effectiveness comparison
 * - Adapter downgrade/fallback pattern detection
 * - Trace quality scoring for governance dashboards
 */
export interface TutorPlatform {
    getTutorAdapterCatalog(): Promise<any>;
    getTutorAdapterTelemetry(): Promise<any>;
    queryTutorTraceDiagnostics(request: any): Promise<any>;
    queryTutorProviderTrendDiagnostics(request: any): Promise<any>;
    queryTutorProviderTrendHistory(request: any): Promise<any>;
    executeTutorAction(request: any): Promise<any>;
}

export class TutorRouter {
    private actionExecutionCount = 0;
    private catalogFetchCount = 0;
    private telemetryFetchCount = 0;
    private actionKindCounts: Record<string, number> = {};

    // Domain-level analysis state
    private confidenceHistory: Array<{
        timestamp: string;
        actionKind: string;
        source: string;
        confidence: number;
        evidenceCount: number;
    }> = [];
    private sourceEffectiveness: {
        ruleEngine: { count: number; avgConfidence: number; avgEvidenceCount: number };
        llmAdapter: { count: number; avgConfidence: number; avgEvidenceCount: number; downgradeCount: number; errorCount: number };
    } = {
        ruleEngine: { count: 0, avgConfidence: 0, avgEvidenceCount: 0 },
        llmAdapter: { count: 0, avgConfidence: 0, avgEvidenceCount: 0, downgradeCount: 0, errorCount: 0 },
    };
    private downgradeEvents: Array<{
        timestamp: string;
        actionKind: string;
        reason: string;
        confidence: number;
    }> = [];
    private actionKindEffectiveness: Map<string, {
        count: number;
        totalConfidence: number;
        evidenceBackedCount: number;
    }> = new Map();

    // Domain budgets
    private readonly budgets = {
        minConfidenceForAcceptance: 0.5,
        downgradeAlertThreshold: 10,       // alert when downgrade rate exceeds 10% in window
        minEvidenceBindingRatio: 0.3,       // minimum acceptable evidence-backed trace ratio
    };

    constructor(private readonly platform: TutorPlatform) {}

    // ─── Public API ─────────────────────────────────────────────────

    async getCatalog() {
        this.catalogFetchCount++;
        const catalog = await this.platform.getTutorAdapterCatalog();

        // Domain-level catalog augmentation
        const adapterCount = Array.isArray(catalog?.adapters) ? catalog.adapters.length : 0;

        return {
            ...catalog,
            _domain: {
                catalogFetchNumber: this.catalogFetchCount,
                adapterCount,
                hasFallbackRuleEngine: true,
            },
        };
    }

    async getTelemetry() {
        this.telemetryFetchCount++;
        const telemetry = await this.platform.getTutorAdapterTelemetry();

        // Domain-level source effectiveness summary
        return {
            ...telemetry,
            _domain: {
                telemetryFetchNumber: this.telemetryFetchCount,
                sourceEffectiveness: this.getSourceEffectiveness(),
                downgradeRate: this.getDowngradeRate(50),
                topActionKinds: this.getTopActionKinds(5),
            },
        };
    }

    async queryTraceDiagnostics(r: any) {
        const response = await this.platform.queryTutorTraceDiagnostics(r);

        // Domain-level trace quality analysis
        const traceQuality = this.analyzeTraceQuality(response);

        return { ...response, _domain: { traceQuality } };
    }

    async queryProviderTrendDiagnostics(r: any) {
        const response = await this.platform.queryTutorProviderTrendDiagnostics(r);

        // Domain-level provider preference analysis
        const providerAnalysis = this.analyzeProviderTrend(response);

        return { ...response, _domain: { providerAnalysis } };
    }

    async queryProviderTrendHistory(r: any) {
        return this.platform.queryTutorProviderTrendHistory(r);
    }

    async executeAction(r: any) {
        this.validateActionRequest(r);
        this.actionExecutionCount++;
        const kind = String(r?.actionKind ?? 'unknown');
        this.actionKindCounts[kind] = (this.actionKindCounts[kind] || 0) + 1;

        const response = await this.platform.executeTutorAction(r);

        // Domain-level post-execution analysis
        const trace = response?.trace;
        if (trace) {
            this.recordConfidence(trace, kind);
            this.trackSourceEffectiveness(trace);
            this.trackActionKindEffectiveness(kind, trace);
            this.detectDowngrade(trace, kind);
        }

        return this.augmentActionResponse(response, kind);
    }

    // ─── Public accessors ───────────────────────────────────────────

    getActionExecutionCount(): number { return this.actionExecutionCount; }

    getSourceEffectiveness() {
        return {
            ruleEngine: { ...this.sourceEffectiveness.ruleEngine },
            llmAdapter: { ...this.sourceEffectiveness.llmAdapter },
        };
    }

    getDowngradeRate(windowSize = 50): number {
        const totalLlm = this.sourceEffectiveness.llmAdapter.count;
        if (totalLlm === 0) return 0;
        const downgraded = this.sourceEffectiveness.llmAdapter.downgradeCount;
        return Number(((downgraded / totalLlm) * 100).toFixed(1));
    }

    getConfidenceHistory(): readonly any[] { return [...this.confidenceHistory]; }

    getDowngradeEvents(): readonly any[] { return [...this.downgradeEvents]; }

    getDiagnosticsSummary() {
        return {
            actionExecutionCount: this.actionExecutionCount,
            catalogFetchCount: this.catalogFetchCount,
            telemetryFetchCount: this.telemetryFetchCount,
            actionKindDistribution: { ...this.actionKindCounts },
            sourceEffectiveness: this.getSourceEffectiveness(),
            downgradeRate: this.getDowngradeRate(50),
            downgradeEventCount: this.downgradeEvents.length,
            recentDowngrades: this.downgradeEvents.slice(-5),
            confidenceTrend: this.computeConfidenceTrend(20),
        };
    }

    // ─── Private: validation ────────────────────────────────────────

    private validateActionRequest(r: any): void {
        if (!r) throw new Error('Tutor action request is required.');
        if (!r?.userId) throw new Error('userId is required for tutor actions.');
        if (!r?.actionKind) throw new Error('actionKind is required for tutor actions.');
    }

    // ─── Private: augmentation ──────────────────────────────────────

    private augmentActionResponse(response: any, kind: string): any {
        const trace = response?.trace;
        const evidenceCount = Array.isArray(trace?.evidenceSpanIds) ? trace.evidenceSpanIds.length : 0;
        const source = trace?.source ?? 'unknown';

        return {
            ...response,
            _domain: {
                actionKind: kind,
                executionNumber: this.actionExecutionCount,
                kindCount: this.actionKindCounts[kind] || 1,
                source,
                confidence: trace?.confidence ?? null,
                evidenceBindingCount: evidenceCount,
                evidenceBindingScore: this.scoreEvidenceBinding(evidenceCount, kind),
                qualityFlag: this.flagTraceQuality(trace),
            },
        };
    }

    // ─── Private: confidence tracking ───────────────────────────────

    private recordConfidence(trace: any, actionKind: string): void {
        const evidenceCount = Array.isArray(trace?.evidenceSpanIds) ? trace.evidenceSpanIds.length : 0;

        this.confidenceHistory.push({
            timestamp: trace?.createdAt || new Date().toISOString(),
            actionKind,
            source: trace?.source ?? 'unknown',
            confidence: Number(trace?.confidence ?? 0),
            evidenceCount,
        });
        if (this.confidenceHistory.length > 200) this.confidenceHistory.shift();
    }

    private computeConfidenceTrend(n: number): {
        direction: string;
        recentAvg: number;
        windowAvg: number;
        snapshotCount: number;
    } {
        const window = this.confidenceHistory.slice(-n);
        if (window.length < 2) {
            return {
                direction: 'insufficient_data',
                recentAvg: window[0]?.confidence ?? 0,
                windowAvg: window[0]?.confidence ?? 0,
                snapshotCount: window.length,
            };
        }

        const mid = Math.floor(window.length / 2);
        const recentAvg = window.slice(-mid).reduce((s, e) => s + e.confidence, 0) / mid;
        const earlierAvg = window.slice(0, mid).reduce((s, e) => s + e.confidence, 0) / mid;
        const delta = recentAvg - earlierAvg;

        return {
            direction: delta > 0.1 ? 'improving' : delta < -0.1 ? 'declining' : 'stable',
            recentAvg: Number(recentAvg.toFixed(4)),
            windowAvg: Number((window.reduce((s, e) => s + e.confidence, 0) / window.length).toFixed(4)),
            snapshotCount: window.length,
        };
    }

    // ─── Private: source effectiveness ──────────────────────────────

    private trackSourceEffectiveness(trace: any): void {
        const source = trace?.source;
        const evidenceCount = Array.isArray(trace?.evidenceSpanIds) ? trace.evidenceSpanIds.length : 0;

        if (source === 'rule-engine') {
            const re = this.sourceEffectiveness.ruleEngine;
            re.count++;
            re.avgConfidence = Number(((re.avgConfidence * (re.count - 1) + (trace?.confidence || 0)) / re.count).toFixed(4));
            re.avgEvidenceCount = Number(((re.avgEvidenceCount * (re.count - 1) + evidenceCount) / re.count).toFixed(2));
        } else if (source === 'llm-adapter') {
            const la = this.sourceEffectiveness.llmAdapter;
            la.count++;
            la.avgConfidence = Number(((la.avgConfidence * (la.count - 1) + (trace?.confidence || 0)) / la.count).toFixed(4));
            la.avgEvidenceCount = Number(((la.avgEvidenceCount * (la.count - 1) + evidenceCount) / la.count).toFixed(2));
        }
    }

    // ─── Private: action kind effectiveness ─────────────────────────

    private trackActionKindEffectiveness(kind: string, trace: any): void {
        let entry = this.actionKindEffectiveness.get(kind);
        if (!entry) {
            entry = { count: 0, totalConfidence: 0, evidenceBackedCount: 0 };
            this.actionKindEffectiveness.set(kind, entry);
        }
        entry.count++;
        entry.totalConfidence += Number(trace?.confidence || 0);
        const evidenceCount = Array.isArray(trace?.evidenceSpanIds) ? trace.evidenceSpanIds.length : 0;
        if (evidenceCount > 0) entry.evidenceBackedCount++;
    }

    private getTopActionKinds(n: number): Array<{
        kind: string;
        count: number;
        avgConfidence: number;
        evidenceRatio: number;
    }> {
        return [...this.actionKindEffectiveness.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, n)
            .map(([kind, stats]) => ({
                kind,
                count: stats.count,
                avgConfidence: Number((stats.totalConfidence / stats.count).toFixed(4)),
                evidenceRatio: Number(((stats.evidenceBackedCount / stats.count) * 100).toFixed(1)),
            }));
    }

    // ─── Private: downgrade detection ───────────────────────────────

    private detectDowngrade(trace: any, actionKind: string): void {
        const source = trace?.source;
        const confidence = Number(trace?.confidence || 0);
        const notes = String(trace?.notes || '');

        // Track LLM adapter downgrades (responses rejected due to low confidence)
        if (source === 'llm-adapter' && notes.includes('downgraded')) {
            this.sourceEffectiveness.llmAdapter.downgradeCount++;
            this.downgradeEvents.push({
                timestamp: trace?.createdAt || new Date().toISOString(),
                actionKind,
                reason: notes,
                confidence,
            });
            if (this.downgradeEvents.length > 100) this.downgradeEvents.shift();
        }

        // Track LLM adapter errors (fallback used)
        if (source === 'llm-adapter' && (notes.includes('failed') || notes.includes('fallback'))) {
            this.sourceEffectiveness.llmAdapter.errorCount++;
        }
    }

    // ─── Private: evidence binding scoring ──────────────────────────

    private scoreEvidenceBinding(evidenceCount: number, actionKind: string): {
        score: number;
        level: string;
    } {
        // Different action kinds have different evidence expectations
        const expectedEvidence: Record<string, number> = {
            explain: 2,
            quiz: 1,
            review: 2,
            analyze_answer: 1,
            summarize: 1,
        };
        const expected = expectedEvidence[actionKind] ?? 1;
        const score = evidenceCount >= expected ? 1 : evidenceCount / Math.max(1, expected);

        return {
            score: Number(score.toFixed(2)),
            level: score >= 1 ? 'full' : score >= 0.5 ? 'partial' : 'insufficient',
        };
    }

    // ─── Private: trace quality flagging ────────────────────────────

    private flagTraceQuality(trace: any): string {
        if (!trace) return 'unknown';
        const confidence = Number(trace?.confidence || 0);
        const evidenceCount = Array.isArray(trace?.evidenceSpanIds) ? trace.evidenceSpanIds.length : 0;
        const source = trace?.source;

        if (source === 'llm-adapter' && confidence < this.budgets.minConfidenceForAcceptance) {
            return 'unreliable';
        }
        if (evidenceCount === 0 && source === 'llm-adapter') {
            return 'unverified';
        }
        if (confidence >= 0.8 && evidenceCount >= 2) {
            return 'high_quality';
        }
        if (confidence >= 0.6 && evidenceCount >= 1) {
            return 'acceptable';
        }
        return 'needs_review';
    }

    // ─── Private: trace quality analysis ────────────────────────────

    private analyzeTraceQuality(response: any): {
        qualityDistribution: Record<string, number>;
        evidenceBindingRate: number;
        averageConfidence: number;
    } {
        const items = Array.isArray(response?.items) ? response.items : [];
        const dist: Record<string, number> = {};
        let totalConfidence = 0;
        let evidenceBound = 0;

        for (const item of items) {
            const flag = this.flagTraceQuality(item?.trace);
            dist[flag] = (dist[flag] || 0) + 1;
            totalConfidence += Number(item?.trace?.confidence || 0);
            const evidenceCount = Array.isArray(item?.trace?.evidenceSpanIds) ? item.trace.evidenceSpanIds.length : 0;
            if (evidenceCount > 0) evidenceBound++;
        }

        return {
            qualityDistribution: dist,
            evidenceBindingRate: items.length > 0
                ? Number(((evidenceBound / items.length) * 100).toFixed(1))
                : 0,
            averageConfidence: items.length > 0
                ? Number((totalConfidence / items.length).toFixed(4))
                : 0,
        };
    }

    // ─── Private: provider trend analysis ───────────────────────────

    private analyzeProviderTrend(response: any): {
        providerCount: number;
        hasActiveAdapter: boolean;
        ruleEngineFallbackActive: boolean;
    } {
        const providers = Array.isArray(response?.providers) ? response.providers : [];
        return {
            providerCount: providers.length,
            hasActiveAdapter: this.sourceEffectiveness.llmAdapter.count > 0,
            ruleEngineFallbackActive: true,
        };
    }
}
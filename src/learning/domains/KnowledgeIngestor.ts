/**
 * KnowledgeIngestor domain — L0/L1: Document parsing, atom/evidence extraction,
 * staleness diagnostics, guardrail evaluation. Adds domain-specific value:
 * latency tracking, staleness caching, guardrail history.
 * Note: full type imports pending M8-M10 type stabilization in ../types.
 */

export interface IngestPlatform {
    ingestKnowledge(request: any): Promise<any>;
    queryKnowledgeStalenessDiagnostics(request: any): Promise<any>;
    rebuildKnowledgeFromStalenessDiagnostics(request: any): Promise<any>;
    evaluateIngestGuardrails(request: any): Promise<any>;
}

export class KnowledgeIngestor {
    private ingestLatencyHistoryMs: number[] = [];
    private recomputeLatencyHistoryMs: number[] = [];
    private latestIngestSummary: any = null;
    private stalenessCache = new Map<string, { response: any; generatedAt: string; sourceHash: string }>();
    private stalenessQueryCount = 0;
    private stalenessSnapshots: Array<{ generatedAt: string; freshCount: number; staleCount: number; hashMismatchCount: number; freshnessScore: number }> = [];
    private guardrailEvaluationHistory: Array<{ passed: boolean; timestamp: string }> = [];

    constructor(private readonly platform: IngestPlatform) {}

    async ingestKnowledge(request: any): Promise<any> {
        const startMs = Date.now();
        const response = await this.platform.ingestKnowledge(request);
        this.ingestLatencyHistoryMs.push(Date.now() - startMs);
        if (this.ingestLatencyHistoryMs.length > 200) this.ingestLatencyHistoryMs.shift();
        if (response?.summary) this.latestIngestSummary = response.summary;
        this.stalenessCache.clear();
        return response;
    }

    async queryStalenessDiagnostics(request: any, options?: { skipCache?: boolean }): Promise<any> {
        this.stalenessQueryCount++;
        const cacheKey = this.buildStalenessCacheKey(request);

        // Always serve cached results when available (cache is invalidated on new ingest)
        const cached = !options?.skipCache ? this.stalenessCache.get(cacheKey) : undefined;
        if (cached) return cached.response;

        const response = await this.platform.queryKnowledgeStalenessDiagnostics(request);
        const generatedAt = new Date().toISOString();

        // Domain-level staleness analysis
        const domainAnalysis = this.buildStalenessAnalysis(response);
        const augmented = { ...response, _domain: { stalenessAnalysis: domainAnalysis, generatedAt, queriedAt: generatedAt } };

        this.stalenessCache.set(cacheKey, { response: augmented, generatedAt, sourceHash: cacheKey });
        if (this.stalenessCache.size > 50) { const firstKey = this.stalenessCache.keys().next().value; if (firstKey) this.stalenessCache.delete(firstKey); }

        // Track staleness trend for governance
        this.recordStalenessSnapshot(domainAnalysis);

        return augmented;
    }

    async rebuildFromStalenessDiagnostics(request: any): Promise<any> {
        const startMs = Date.now();
        const response = await this.platform.rebuildKnowledgeFromStalenessDiagnostics(request);
        this.recomputeLatencyHistoryMs.push(Date.now() - startMs);
        if (this.recomputeLatencyHistoryMs.length > 200) this.recomputeLatencyHistoryMs.shift();
        this.stalenessCache.clear();
        return response;
    }

    /**
     * Evaluate ingest guardrails with domain-level gate logic.
     * Augments the platform response with independent gate validation
     * and maintains a pass-rate history for governance dashboards.
     */
    async evaluateGuardrails(request: any): Promise<any> {
        const response = await this.platform.evaluateIngestGuardrails(request);

        // Domain-level gate validation (independent of platform)
        const domainGates = this.buildDomainGuardrailGates(request, response);
        const allPassed = domainGates.every((g: any) => g.passed);

        this.guardrailEvaluationHistory.push({
            passed: allPassed,
            timestamp: new Date().toISOString(),
        });
        if (this.guardrailEvaluationHistory.length > 200) {
            this.guardrailEvaluationHistory.shift();
        }

        // Augment response with domain-level gate telemetry
        return {
            ...response,
            domainGates,
            domainOverallPassed: allPassed,
        };
    }

    getLatestIngestSummary() { return this.latestIngestSummary; }
    getIngestLatencyHistory(): readonly number[] { return [...this.ingestLatencyHistoryMs]; }
    getRecomputeLatencyHistory(): readonly number[] { return [...this.recomputeLatencyHistoryMs]; }

    averageIngestLatencyMs(n = 20): number {
        const w = this.ingestLatencyHistoryMs.slice(-n);
        return w.length === 0 ? 0 : w.reduce((a, b) => a + b, 0) / w.length;
    }

    averageRecomputeLatencyMs(n = 20): number {
        const w = this.recomputeLatencyHistoryMs.slice(-n);
        return w.length === 0 ? 0 : w.reduce((a, b) => a + b, 0) / w.length;
    }

    getStalenessQueryCount(): number { return this.stalenessQueryCount; }

    getGuardrailPassRate(): number {
        if (this.guardrailEvaluationHistory.length === 0) return 1;
        return this.guardrailEvaluationHistory.filter(e => e.passed).length / this.guardrailEvaluationHistory.length;
    }

    invalidateStalenessCache(): void { this.stalenessCache.clear(); }

    getDiagnostics() {
        return {
            ingestCount: this.ingestLatencyHistoryMs.length,
            averageIngestLatencyMs: this.averageIngestLatencyMs(20),
            recomputeCount: this.recomputeLatencyHistoryMs.length,
            averageRecomputeLatencyMs: this.averageRecomputeLatencyMs(20),
            stalenessQueryCount: this.stalenessQueryCount,
            stalenessCacheSize: this.stalenessCache.size,
            stalenessSnapshots: this.stalenessSnapshots.length,
            freshnessTrend: this.getFreshnessTrend(10),
            guardrailEvaluationCount: this.guardrailEvaluationHistory.length,
            guardrailPassRate: Number((this.getGuardrailPassRate() * 100).toFixed(1)),
        };
    }

    /**
     * Build domain-level guardrail gates using ingest telemetry.
     * These gates run independently of the platform's gate evaluation,
     * providing a second layer of governance verification.
     */
    private buildDomainGuardrailGates(request: any, platformResponse: any): any[] {
        const summary = this.latestIngestSummary || {};
        const changedDocs = summary.changedDocuments ?? 0;
        const deletedDocs = summary.deletedDocuments ?? 0;
        const avgLatency = this.averageIngestLatencyMs(20);

        return [
            {
                gateId: 'domain:changed_docs',
                passed: changedDocs <= 500,
                observedValue: changedDocs,
                threshold: 500,
                message: 'Changed document count within domain budget.',
            },
            {
                gateId: 'domain:deleted_docs',
                passed: deletedDocs <= 100,
                observedValue: deletedDocs,
                threshold: 100,
                message: 'Deleted document count within rollback-safe budget.',
            },
            {
                gateId: 'domain:avg_latency_ms',
                passed: avgLatency <= 30000,
                observedValue: Math.round(avgLatency),
                threshold: 30000,
                message: 'Average ingest latency within performance budget.',
            },
            {
                gateId: 'domain:history_available',
                passed: this.ingestLatencyHistoryMs.length >= 3,
                observedValue: this.ingestLatencyHistoryMs.length,
                threshold: 3,
                message: 'Sufficient ingest history for statistical significance.',
            },
        ];
    }

    /**
     * Build domain-level staleness analysis from platform response.
     * Categorizes documents by staleness status and computes a freshness score.
     */
    private buildStalenessAnalysis(response: any): any {
        const records = Array.isArray(response?.records) ? response.records : [];
        const counters: Record<string, number> = { up_to_date: 0, hash_mismatch: 0, missing_source: 0, read_error: 0 };
        const staleBySource = new Map<string, number>();
        let totalDocuments = 0;

        for (const record of records) {
            counters[record.status] = (counters[record.status] || 0) + 1;
            totalDocuments++;

            if (record.status !== 'up_to_date' && record.sourcePath) {
                const dir = String(record.sourcePath).split(/[/\\]/)[0] || 'root';
                staleBySource.set(dir, (staleBySource.get(dir) || 0) + 1);
            }
        }

        const staleCount = counters.hash_mismatch + counters.missing_source + counters.read_error;
        const freshnessScore = totalDocuments > 0
            ? Number(((counters.up_to_date / totalDocuments) * 100).toFixed(1))
            : 100;

        return {
            freshnessScore,
            freshCount: counters.up_to_date,
            staleCount,
            hashMismatchCount: counters.hash_mismatch,
            missingSourceCount: counters.missing_source,
            readErrorCount: counters.read_error,
            totalDocuments,
            staleBySource: Object.fromEntries(staleBySource),
            freshnessRating: freshnessScore >= 95 ? 'excellent' : freshnessScore >= 80 ? 'good' : freshnessScore >= 60 ? 'fair' : 'poor',
        };
    }

    /**
     * Record a staleness snapshot for trend computation.
     * Keeps the last 100 snapshots for governance dashboards.
     */
    private recordStalenessSnapshot(analysis: any): void {
        this.stalenessSnapshots.push({
            generatedAt: new Date().toISOString(),
            freshCount: analysis.freshCount,
            staleCount: analysis.staleCount,
            hashMismatchCount: analysis.hashMismatchCount,
            freshnessScore: analysis.freshnessScore,
        });
        if (this.stalenessSnapshots.length > 100) {
            this.stalenessSnapshots.shift();
        }
    }

    /**
     * Compute the freshness trend over the last N snapshots.
     * Returns trend direction: 'stable', 'improving', or 'regressing'.
     */
    getFreshnessTrend(n = 10): { direction: string; recentScore: number; windowAverage: number; snapshots: number } {
        const window = this.stalenessSnapshots.slice(-n);
        if (window.length < 2) return { direction: 'stable', recentScore: window[0]?.freshnessScore ?? 100, windowAverage: window[0]?.freshnessScore ?? 100, snapshots: window.length };

        const recentScore = window[window.length - 1].freshnessScore;
        const windowAverage = Number((window.reduce((s, e) => s + e.freshnessScore, 0) / window.length).toFixed(1));

        // Compare recent half vs earlier half
        const mid = Math.floor(window.length / 2);
        const recentHalf = window.slice(-mid);
        const earlierHalf = window.slice(0, mid);
        const recentAvg = recentHalf.reduce((s, e) => s + e.freshnessScore, 0) / recentHalf.length;
        const earlierAvg = earlierHalf.reduce((s, e) => s + e.freshnessScore, 0) / earlierHalf.length;

        const delta = recentAvg - earlierAvg;
        return {
            direction: delta > 2 ? 'improving' : delta < -2 ? 'regressing' : 'stable',
            recentScore,
            windowAverage,
            snapshots: window.length,
        };
    }

    getStalenessSnapshots(): readonly any[] { return [...this.stalenessSnapshots]; }

    private buildStalenessCacheKey(request: any): string {
        return [request?.limit ?? 24, request?.sourcePathPrefix ?? '', Array.isArray(request?.statuses) ? request.statuses.join(',') : ''].join('|');
    }
}

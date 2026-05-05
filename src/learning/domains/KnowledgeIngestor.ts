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
        const cached = !options?.skipCache ? this.stalenessCache.get(cacheKey) : undefined;
        if (cached) return cached.response;
        const response = await this.platform.queryKnowledgeStalenessDiagnostics(request);
        this.stalenessCache.set(cacheKey, { response, generatedAt: new Date().toISOString(), sourceHash: cacheKey });
        if (this.stalenessCache.size > 50) { const firstKey = this.stalenessCache.keys().next().value; if (firstKey) this.stalenessCache.delete(firstKey); }
        return response;
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

    private buildStalenessCacheKey(request: any): string {
        return [request?.limit ?? 24, request?.sourcePathPrefix ?? '', Array.isArray(request?.statuses) ? request.statuses.join(',') : ''].join('|');
    }
}

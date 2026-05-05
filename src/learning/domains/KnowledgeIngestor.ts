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

    async evaluateGuardrails(request: any): Promise<any> {
        const response = await this.platform.evaluateIngestGuardrails(request);
        this.guardrailEvaluationHistory.push({ passed: response?.overallPassed ?? true, timestamp: new Date().toISOString() });
        if (this.guardrailEvaluationHistory.length > 100) this.guardrailEvaluationHistory.shift();
        return response;
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

    private buildStalenessCacheKey(request: any): string {
        return [request?.limit ?? 24, request?.sourcePathPrefix ?? '', Array.isArray(request?.statuses) ? request.statuses.join(',') : ''].join('|');
    }
}

/**
 * KnowledgeIngestor domain — L0/L1: Document parsing, atom/evidence extraction,
 * staleness diagnostics, guardrail evaluation.
 *
 * Wraps the KnowledgeLearningPlatform behind a clean domain boundary.
 * Adds domain-specific value: latency tracking, staleness caching, guardrail history.
 */

import type {
    KnowledgeIngestRequest, KnowledgeIngestResponse,
    KnowledgeStalenessDiagnosticsRequest, KnowledgeStalenessDiagnosticsResponse,
    KnowledgeStalenessRebuildRequest, KnowledgeStalenessRebuildResponse,
    IngestGuardrailEvaluationRequest, IngestGuardrailEvaluationResponse,
} from '../types';

export interface IngestPlatform {
    ingestKnowledge(request: KnowledgeIngestRequest): Promise<KnowledgeIngestResponse>;
    queryKnowledgeStalenessDiagnostics(
        request: KnowledgeStalenessDiagnosticsRequest
    ): Promise<KnowledgeStalenessDiagnosticsResponse>;
    rebuildKnowledgeFromStalenessDiagnostics(
        request: KnowledgeStalenessRebuildRequest
    ): Promise<KnowledgeStalenessRebuildResponse>;
    evaluateIngestGuardrails(
        request: IngestGuardrailEvaluationRequest
    ): Promise<IngestGuardrailEvaluationResponse>;
}

interface StalenessCacheEntry {
    response: KnowledgeStalenessDiagnosticsResponse;
    generatedAt: string;
    sourceHash: string;
}

export class KnowledgeIngestor {
    private ingestLatencyHistoryMs: number[] = [];
    private recomputeLatencyHistoryMs: number[] = [];
    private latestIngestSummary: KnowledgeIngestResponse['summary'] | null = null;
    private stalenessCache = new Map<string, StalenessCacheEntry>();
    private stalenessQueryCount = 0;
    private guardrailEvaluationHistory: Array<{ passed: boolean; timestamp: string }> = [];

    constructor(private readonly platform: IngestPlatform) {}

    // ── Ingest ──────────────────────────────────────────────

    async ingestKnowledge(request: KnowledgeIngestRequest): Promise<KnowledgeIngestResponse> {
        const startMs = Date.now();
        const response = await this.platform.ingestKnowledge(request);
        const latencyMs = Date.now() - startMs;

        this.ingestLatencyHistoryMs.push(latencyMs);
        if (this.ingestLatencyHistoryMs.length > 200) this.ingestLatencyHistoryMs.shift();

        if (response.summary) {
            this.latestIngestSummary = response.summary;
        }

        // Invalidate staleness cache on new ingest
        this.stalenessCache.clear();

        return response;
    }

    // ── Staleness Diagnostics ───────────────────────────────

    async queryStalenessDiagnostics(
        request: KnowledgeStalenessDiagnosticsRequest,
        options?: { skipCache?: boolean }
    ): Promise<KnowledgeStalenessDiagnosticsResponse> {
        this.stalenessQueryCount++;

        const cacheKey = this.buildStalenessCacheKey(request);
        const cached = !options?.skipCache ? this.stalenessCache.get(cacheKey) : undefined;

        if (cached) {
            return cached.response;
        }

        const response = await this.platform.queryKnowledgeStalenessDiagnostics(request);

        this.stalenessCache.set(cacheKey, {
            response,
            generatedAt: new Date().toISOString(),
            sourceHash: cacheKey,
        });

        // Keep cache bounded
        if (this.stalenessCache.size > 50) {
            const firstKey = this.stalenessCache.keys().next().value;
            if (firstKey) this.stalenessCache.delete(firstKey);
        }

        return response;
    }

    async rebuildFromStalenessDiagnostics(
        request: KnowledgeStalenessRebuildRequest
    ): Promise<KnowledgeStalenessRebuildResponse> {
        const startMs = Date.now();
        const response = await this.platform.rebuildKnowledgeFromStalenessDiagnostics(request);
        const latencyMs = Date.now() - startMs;

        this.recomputeLatencyHistoryMs.push(latencyMs);
        if (this.recomputeLatencyHistoryMs.length > 200) this.recomputeLatencyHistoryMs.shift();

        // Invalidate staleness cache after rebuild
        this.stalenessCache.clear();

        return response;
    }

    // ── Guardrails ──────────────────────────────────────────

    async evaluateGuardrails(
        request: IngestGuardrailEvaluationRequest
    ): Promise<IngestGuardrailEvaluationResponse> {
        const response = await this.platform.evaluateIngestGuardrails(request);

        this.guardrailEvaluationHistory.push({
            passed: response.overallPassed,
            timestamp: new Date().toISOString(),
        });
        if (this.guardrailEvaluationHistory.length > 100) {
            this.guardrailEvaluationHistory.shift();
        }

        return response;
    }

    // ── Domain Statistics ───────────────────────────────────

    getLatestIngestSummary() { return this.latestIngestSummary; }

    getIngestLatencyHistory(): readonly number[] { return [...this.ingestLatencyHistoryMs]; }
    getRecomputeLatencyHistory(): readonly number[] { return [...this.recomputeLatencyHistoryMs]; }

    averageIngestLatencyMs(n = 20): number {
        const window = this.ingestLatencyHistoryMs.slice(-n);
        if (window.length === 0) return 0;
        return window.reduce((a, b) => a + b, 0) / window.length;
    }

    averageRecomputeLatencyMs(n = 20): number {
        const window = this.recomputeLatencyHistoryMs.slice(-n);
        if (window.length === 0) return 0;
        return window.reduce((a, b) => a + b, 0) / window.length;
    }

    getStalenessQueryCount(): number { return this.stalenessQueryCount; }

    getGuardrailPassRate(): number {
        if (this.guardrailEvaluationHistory.length === 0) return 1;
        const passed = this.guardrailEvaluationHistory.filter(e => e.passed).length;
        return passed / this.guardrailEvaluationHistory.length;
    }

    /** Clear the staleness cache (e.g., after external mutations). */
    invalidateStalenessCache(): void { this.stalenessCache.clear(); }

    /** Diagnostic summary of the domain class state. */
    getDiagnostics() {
        return {
            ingestCount: this.ingestLatencyHistoryMs.length,
            averageIngestLatencyMs: this.averageIngestLatencyMs(20),
            recomputeCount: this.recomputeLatencyHistoryMs.length,
            averageRecomputeLatencyMs: this.averageRecomputeLatencyMs(20),
            stalenessQueryCount: this.stalenessQueryCount,
            stalenessCacheSize: this.stalenessCache.size,
            guardrailEvaluationCount: this.guardrailEvaluationHistory.length,
            guardrailPassRate: this.getGuardrailPassRate(),
        };
    }

    // ── Private helpers ─────────────────────────────────────

    private buildStalenessCacheKey(request: KnowledgeStalenessDiagnosticsRequest): string {
        return [
            request.limit ?? 24,
            request.sourcePathPrefix ?? '',
            Array.isArray(request.statuses) ? request.statuses.join(',') : '',
        ].join('|');
    }
}

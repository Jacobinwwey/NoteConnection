/**
 * KnowledgeQuerier domain — L2: Evidence-first explainable retrieval.
 * Query backends, comparison, backend configuration, and diagnostics.
 */

import type {
    KnowledgeQueryRequest, KnowledgeQueryResponse,
    KnowledgeQueryBackendComparisonRequest, KnowledgeQueryBackendComparisonResponse,
    KnowledgeQueryBackendComparisonHistoryRequest, KnowledgeQueryBackendComparisonHistoryResponse,
    KnowledgeQueryBackendComparisonTrendRequest, KnowledgeQueryBackendComparisonTrendResponse,
    KnowledgeQueryBackendConfigRequest, KnowledgeQueryBackendConfigResponse,
    KnowledgeQueryBackendDiagnostics,
} from '../types';

export interface QueryPlatform {
    queryKnowledge(request: KnowledgeQueryRequest): Promise<KnowledgeQueryResponse>;
    compareQueryBackends(request: KnowledgeQueryBackendComparisonRequest): Promise<KnowledgeQueryBackendComparisonResponse>;
    queryKnowledgeQueryBackendComparisonHistory(request: KnowledgeQueryBackendComparisonHistoryRequest): Promise<KnowledgeQueryBackendComparisonHistoryResponse>;
    queryKnowledgeQueryBackendComparisonTrend(request: KnowledgeQueryBackendComparisonTrendRequest): Promise<KnowledgeQueryBackendComparisonTrendResponse>;
    getQueryBackendConfig(): KnowledgeQueryBackendConfigResponse;
    updateQueryBackendConfig(request: KnowledgeQueryBackendConfigRequest): Promise<void>;
    getQueryBackendDiagnostics(): KnowledgeQueryBackendDiagnostics;
}

export class KnowledgeQuerier {
    private queryLatencyHistoryMs: number[] = [];
    private queryBackendFallbackCount = 0;
    private queryBackendLastError: string | undefined;

    constructor(private readonly platform: QueryPlatform) {}

    async queryKnowledge(request: KnowledgeQueryRequest): Promise<KnowledgeQueryResponse> {
        const startMs = Date.now();
        try {
            const response = await this.platform.queryKnowledge(request);
            this.recordLatency(Date.now() - startMs);
            return response;
        } catch (error) {
            this.queryBackendFallbackCount++;
            this.queryBackendLastError = String(error);
            throw error;
        }
    }

    async compareBackends(request: KnowledgeQueryBackendComparisonRequest): Promise<KnowledgeQueryBackendComparisonResponse> {
        return this.platform.compareQueryBackends(request);
    }

    async queryComparisonHistory(request: KnowledgeQueryBackendComparisonHistoryRequest): Promise<KnowledgeQueryBackendComparisonHistoryResponse> {
        return this.platform.queryKnowledgeQueryBackendComparisonHistory(request);
    }

    async queryComparisonTrend(request: KnowledgeQueryBackendComparisonTrendRequest): Promise<KnowledgeQueryBackendComparisonTrendResponse> {
        return this.platform.queryKnowledgeQueryBackendComparisonTrend(request);
    }

    getConfig(): KnowledgeQueryBackendConfigResponse {
        return this.platform.getQueryBackendConfig();
    }

    async updateConfig(request: KnowledgeQueryBackendConfigRequest): Promise<void> {
        await this.platform.updateQueryBackendConfig(request);
    }

    getDiagnostics(): KnowledgeQueryBackendDiagnostics {
        return this.platform.getQueryBackendDiagnostics();
    }

    getQueryLatencyHistory(): readonly number[] { return [...this.queryLatencyHistoryMs]; }
    getFallbackCount(): number { return this.queryBackendFallbackCount; }
    getLastError(): string | undefined { return this.queryBackendLastError; }

    averageQueryLatencyMs(n = 20): number {
        const window = this.queryLatencyHistoryMs.slice(-n);
        if (window.length === 0) return 0;
        return window.reduce((a, b) => a + b, 0) / window.length;
    }

    private recordLatency(ms: number): void {
        this.queryLatencyHistoryMs.push(ms);
        if (this.queryLatencyHistoryMs.length > 100) this.queryLatencyHistoryMs.shift();
    }
}

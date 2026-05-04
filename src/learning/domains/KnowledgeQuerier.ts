/**
 * KnowledgeQuerier domain — L2: Evidence-first explainable retrieval.
 * Query backends, comparison, backend configuration, diagnostics.
 * Adds domain-specific value: query cache, latency stats, fallback analysis.
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
    updateQueryBackendConfig(request: KnowledgeQueryBackendConfigRequest): Promise<KnowledgeQueryBackendConfigResponse>;
    getQueryBackendDiagnostics(): KnowledgeQueryBackendDiagnostics;
}

interface QueryCacheEntry {
    response: KnowledgeQueryResponse;
    cachedAt: string;
    ttlMs: number;
}

const DEFAULT_QUERY_CACHE_TTL_MS = 60_000; // 1 minute

export class KnowledgeQuerier {
    private queryLatencyHistoryMs: number[] = [];
    private queryBackendFallbackCount = 0;
    private queryBackendLastError: string | undefined;
    private lastQueryAt: string | null = null;
    private queryCache = new Map<string, QueryCacheEntry>();
    private cacheHits = 0;
    private cacheMisses = 0;
    private comparisonCount = 0;
    private readonly cacheTtlMs: number;

    constructor(
        private readonly platform: QueryPlatform,
        options?: { cacheTtlMs?: number }
    ) {
        this.cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_QUERY_CACHE_TTL_MS;
    }

    // ── Query ────────────────────────────────────────────────

    async queryKnowledge(
        request: KnowledgeQueryRequest,
        options?: { skipCache?: boolean }
    ): Promise<KnowledgeQueryResponse> {
        this.lastQueryAt = new Date().toISOString();

        const cacheKey = this.buildQueryCacheKey(request);
        const cached = !options?.skipCache ? this.queryCache.get(cacheKey) : undefined;

        if (cached && (Date.now() - new Date(cached.cachedAt).getTime()) < cached.ttlMs) {
            this.cacheHits++;
            return cached.response;
        }

        this.cacheMisses++;
        const startMs = Date.now();

        try {
            const response = await this.platform.queryKnowledge(request);
            this.recordLatency(Date.now() - startMs);

            this.queryCache.set(cacheKey, {
                response,
                cachedAt: new Date().toISOString(),
                ttlMs: this.cacheTtlMs,
            });
            this.pruneCache();

            return response;
        } catch (error) {
            this.queryBackendFallbackCount++;
            this.queryBackendLastError = String(error);
            throw error;
        }
    }

    // ── Backend Comparison ───────────────────────────────────

    async compareBackends(
        request: KnowledgeQueryBackendComparisonRequest
    ): Promise<KnowledgeQueryBackendComparisonResponse> {
        this.comparisonCount++;
        return this.platform.compareQueryBackends(request);
    }

    async queryComparisonHistory(
        request: KnowledgeQueryBackendComparisonHistoryRequest
    ): Promise<KnowledgeQueryBackendComparisonHistoryResponse> {
        return this.platform.queryKnowledgeQueryBackendComparisonHistory(request);
    }

    async queryComparisonTrend(
        request: KnowledgeQueryBackendComparisonTrendRequest
    ): Promise<KnowledgeQueryBackendComparisonTrendResponse> {
        return this.platform.queryKnowledgeQueryBackendComparisonTrend(request);
    }

    // ── Configuration ────────────────────────────────────────

    getConfig(): KnowledgeQueryBackendConfigResponse {
        return this.platform.getQueryBackendConfig();
    }

    async updateConfig(request: KnowledgeQueryBackendConfigRequest): Promise<KnowledgeQueryBackendConfigResponse> {
        const response = await this.platform.updateQueryBackendConfig(request);
        this.invalidateCache();
        return response;
    }

    getDiagnostics(): KnowledgeQueryBackendDiagnostics {
        return this.platform.getQueryBackendDiagnostics();
    }

    // ── Cache Management ─────────────────────────────────────

    invalidateCache(): void {
        this.queryCache.clear();
    }

    invalidateCacheForPrefix(prefix: string): void {
        for (const key of this.queryCache.keys()) {
            if (key.startsWith(prefix)) this.queryCache.delete(key);
        }
    }

    // ── Domain Statistics ────────────────────────────────────

    getQueryLatencyHistory(): readonly number[] { return [...this.queryLatencyHistoryMs]; }
    getFallbackCount(): number { return this.queryBackendFallbackCount; }
    getLastError(): string | undefined { return this.queryBackendLastError; }
    getLastQueryAt(): string | null { return this.lastQueryAt; }
    getComparisonCount(): number { return this.comparisonCount; }

    averageQueryLatencyMs(n = 20): number {
        const window = this.queryLatencyHistoryMs.slice(-n);
        if (window.length === 0) return 0;
        return window.reduce((a, b) => a + b, 0) / window.length;
    }

    queryLatencyP95(n = 50): number {
        const window = [...this.queryLatencyHistoryMs.slice(-n)].sort((a, b) => a - b);
        if (window.length === 0) return 0;
        return window[Math.ceil(window.length * 0.95) - 1];
    }

    getCacheHitRate(): number {
        const total = this.cacheHits + this.cacheMisses;
        return total === 0 ? 0 : this.cacheHits / total;
    }

    getDiagnosticsSummary() {
        return {
            queryCount: this.queryLatencyHistoryMs.length,
            averageLatencyMs: this.averageQueryLatencyMs(20),
            latencyP95Ms: this.queryLatencyP95(50),
            fallbackCount: this.queryBackendFallbackCount,
            lastError: this.queryBackendLastError ?? null,
            lastQueryAt: this.lastQueryAt,
            cacheSize: this.queryCache.size,
            cacheHitRate: Number((this.getCacheHitRate() * 100).toFixed(1)),
            comparisonCount: this.comparisonCount,
        };
    }

    // ── Private ──────────────────────────────────────────────

    private recordLatency(ms: number): void {
        this.queryLatencyHistoryMs.push(ms);
        if (this.queryLatencyHistoryMs.length > 500) this.queryLatencyHistoryMs.shift();
    }

    private buildQueryCacheKey(request: KnowledgeQueryRequest): string {
        return [
            request.query ?? '',
            String(request.topK ?? 10),
            request.queryBackend ?? 'default',
            request.asOf ?? '',
        ].join('|');
    }

    private pruneCache(): void {
        if (this.queryCache.size <= 200) return;
        const now = Date.now();
        for (const [key, entry] of this.queryCache) {
            if ((now - new Date(entry.cachedAt).getTime()) > entry.ttlMs * 2) {
                this.queryCache.delete(key);
            }
        }
        if (this.queryCache.size > 200) {
            const firstKey = this.queryCache.keys().next().value;
            if (firstKey) this.queryCache.delete(firstKey);
        }
    }
}

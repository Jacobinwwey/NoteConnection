/**
 * KnowledgeQuerier domain — L2: Evidence-first explainable retrieval.
 * Query backends, comparison, configuration, diagnostics.
 * Note: types pending M8-M10 stabilization; using any for now.
 */

export interface QueryPlatform {
    queryKnowledge(request: any): Promise<any>;
    compareQueryBackends(request: any): Promise<any>;
    queryKnowledgeQueryBackendComparisonHistory(request: any): Promise<any>;
    queryKnowledgeQueryBackendComparisonTrend(request: any): Promise<any>;
    getQueryBackendConfig(): any;
    updateQueryBackendConfig(request: any): Promise<any>;
    getQueryBackendDiagnostics(): any;
}

export class KnowledgeQuerier {
    private queryLatencyHistoryMs: number[] = [];
    private queryBackendFallbackCount = 0;
    private queryBackendLastError: string | undefined;
    private lastQueryAt: string | null = null;
    private queryCache = new Map<string, { response: any; cachedAt: string; ttlMs: number }>();
    private cacheHits = 0;
    private cacheMisses = 0;
    private comparisonCount = 0;
    private readonly cacheTtlMs: number;

    constructor(private readonly platform: QueryPlatform, options?: { cacheTtlMs?: number }) {
        this.cacheTtlMs = options?.cacheTtlMs ?? 60_000;
    }

    async queryKnowledge(request: any, options?: { skipCache?: boolean }): Promise<any> {
        this.lastQueryAt = new Date().toISOString();
        const cacheKey = this.buildCacheKey(request);
        const cached = !options?.skipCache ? this.queryCache.get(cacheKey) : undefined;
        if (cached && (Date.now() - new Date(cached.cachedAt).getTime()) < cached.ttlMs) {
            this.cacheHits++;
            return cached.response;
        }
        // Domain-level query validation
        this.validateQueryRequest(request);

        this.cacheMisses++;
        const startMs = Date.now();
        try {
            const response = await this.platform.queryKnowledge(request);
            const latencyMs = Date.now() - startMs;
            this.recordLatency(latencyMs);
            this.queryCache.set(cacheKey, { response, cachedAt: new Date().toISOString(), ttlMs: this.cacheTtlMs });
            this.pruneCache();

            // Augment response with domain-level telemetry
            return this.augmentQueryResponse(response, latencyMs, request);
        } catch (error) {
            this.queryBackendFallbackCount++;
            this.queryBackendLastError = String(error);
            throw error;
        }
    }

    async compareBackends(request: any): Promise<any> { this.comparisonCount++; return this.platform.compareQueryBackends(request); }
    async queryComparisonHistory(request: any): Promise<any> { return this.platform.queryKnowledgeQueryBackendComparisonHistory(request); }
    async queryComparisonTrend(request: any): Promise<any> { return this.platform.queryKnowledgeQueryBackendComparisonTrend(request); }
    getConfig(): any { return this.platform.getQueryBackendConfig(); }
    async updateConfig(request: any): Promise<any> {
        const response = await this.platform.updateQueryBackendConfig(request);
        this.invalidateCache();
        return response;
    }
    getDiagnostics(): any { return this.platform.getQueryBackendDiagnostics(); }
    invalidateCache(): void { this.queryCache.clear(); }

    getQueryLatencyHistory(): readonly number[] { return [...this.queryLatencyHistoryMs]; }
    getFallbackCount(): number { return this.queryBackendFallbackCount; }
    getLastError(): string | undefined { return this.queryBackendLastError; }

    averageQueryLatencyMs(n = 20): number {
        const w = this.queryLatencyHistoryMs.slice(-n);
        if (w.length === 0) return 0;
        return w.reduce((a, b) => a + b, 0) / w.length;
    }

    queryLatencyP95(n = 50): number {
        const w = [...this.queryLatencyHistoryMs.slice(-n)].sort((a, b) => a - b);
        if (w.length === 0) return 0;
        return w[Math.ceil(w.length * 0.95) - 1];
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

    private recordLatency(ms: number): void {
        this.queryLatencyHistoryMs.push(ms);
        if (this.queryLatencyHistoryMs.length > 500) this.queryLatencyHistoryMs.shift();
    }

    private buildCacheKey(request: any): string {
        return [request.query ?? '', String(request.topK ?? 10), request.queryBackend ?? 'default', request.asOf ?? ''].join('|');
    }

    /**
     * Domain-level query validation: ensure the request meets minimum
     * quality standards before dispatching to the platform.
     */
    private validateQueryRequest(request: any): void {
        if (!request) {
            throw new Error('Query request is required.');
        }
        const query = String(request.query ?? '').trim();
        if (!query) {
            throw new Error('Query string must not be empty.');
        }
        if (query.length > 5000) {
            throw new Error('Query string exceeds maximum length (5000 chars).');
        }
    }

    /**
     * Augment the platform response with domain-level telemetry:
     * query latency, cache status, backend identity, and result metadata.
     */
    private augmentQueryResponse(response: any, latencyMs: number, request: any): any {
        const items = Array.isArray(response?.items) ? response.items : [];
        return {
            ...response,
            _domain: {
                latencyMs: Math.round(latencyMs),
                cacheHit: false,
                cacheSize: this.queryCache.size,
                backend: request?.queryBackend ?? 'default',
                resultCount: items.length,
                topScore: items.length > 0 ? items[0]?.score ?? null : null,
            },
        };
    }

    private pruneCache(): void {
        if (this.queryCache.size <= 200) return;
        const now = Date.now();
        for (const [key, entry] of this.queryCache) {
            if ((now - new Date(entry.cachedAt).getTime()) > entry.ttlMs * 2) this.queryCache.delete(key);
        }
        if (this.queryCache.size > 200) {
            const firstKey = this.queryCache.keys().next().value;
            if (firstKey) this.queryCache.delete(firstKey);
        }
    }
}

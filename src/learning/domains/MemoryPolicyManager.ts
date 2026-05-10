/** MemoryPolicyManager — L5: Memory policy governance + layer validation.
 * Domain-level analysis complements KLP's applyMemoryPolicy with:
 * - Per-layer memory budget enforcement (capacity limits)
 * - Eviction rate trend analysis for governance
 * - Layer promotion policy validation
 * - Memory health scoring (fragmentation, staleness, confidence distribution)
 * - Write pattern tracking for anomaly detection
 */
export interface MemoryPlatform {
    applyMemoryPolicy(request: any): Promise<any>;
    queryMemoryPolicyDiagnostics(request: any): Promise<any>;
    queryMemoryPolicyDiagnosticsHistory(request: any): Promise<any>;
    queryMemoryPolicyDiagnosticsTrend(request: any): Promise<any>;
}

export class MemoryPolicyManager {
    private policyApplicationCount = 0;
    private diagnosticsQueryCount = 0;
    private historyQueryCount = 0;
    private trendQueryCount = 0;
    private policyLayerCounts: Record<string, number> = {};

    // Domain-level analysis state
    private evictionHistory: Array<{
        timestamp: string;
        layer: string;
        evictedCount: number;
        remainingCount: number;
    }> = [];
    private writeHistory: Array<{
        timestamp: string;
        layer: string;
        entryCount: number;
        operation: string;
    }> = [];
    private promotionHistory: Array<{
        timestamp: string;
        fromLayer: string;
        toLayer: string;
        entryKeys: string[];
        accepted: boolean;
    }> = [];
    private layerSizes = new Map<string, number>();

    // Domain budget constraints per layer
    private readonly budgets = {
        session: { maxEntries: 200, maxEntrySizeChars: 5000, maxTagsPerEntry: 8 },
        unit: { maxEntries: 500, maxEntrySizeChars: 10000, maxTagsPerEntry: 12 },
        long_term: { maxEntries: 2000, maxEntrySizeChars: 20000, maxTagsPerEntry: 16 },
    };

    // Promotion requirements
    private readonly promotionThresholds = {
        minConfidence: 0.6,
        minAccessCount: 3,
        minAgeDays: 1,           // session → unit
        minAgeDaysLongTerm: 7,    // unit → long_term
    };

    // Health scoring weights
    private readonly healthWeights = {
        fragmentationRisk: 0.25,
        stalenessRatio: 0.25,
        confidenceDistribution: 0.25,
        evictionPressure: 0.25,
    };

    constructor(private readonly platform: MemoryPlatform) {}

    // ─── Public API ─────────────────────────────────────────────────

    async apply(r: any) {
        this.validatePolicyRequest(r);
        this.policyApplicationCount++;
        const layer = String(r?.layer ?? 'unknown');
        this.policyLayerCounts[layer] = (this.policyLayerCounts[layer] || 0) + 1;

        // Domain-level budget validation BEFORE platform execution
        this.validateLayerBudget(r, layer);

        // Domain-level promotion validation
        if (r?.operation === 'write' && r?.promoteFromLayer) {
            const promotionResult = this.validatePromotion(r);
            if (!promotionResult.valid) {
                return {
                    _domain: {
                        layer,
                        applicationNumber: this.policyApplicationCount,
                        promotionBlocked: true,
                        promotionReason: promotionResult.reason,
                    },
                    error: promotionResult.reason,
                };
            }
        }

        const response = await this.platform.applyMemoryPolicy(r);

        // Domain-level post-execution analysis
        this.trackLayerSize(layer, response);
        this.recordOperation(r, response);
        this.trackEviction(layer, response);

        return this.augmentPolicyResponse(response, layer);
    }

    async queryDiagnostics(r: any) {
        this.diagnosticsQueryCount++;
        const response = await this.platform.queryMemoryPolicyDiagnostics(r);

        // Domain-level memory health scoring
        const health = this.computeMemoryHealth(response);

        return {
            ...response,
            _domain: {
                diagnosticsNumber: this.diagnosticsQueryCount,
                health,
            },
        };
    }

    async queryDiagnosticsHistory(r: any) {
        this.historyQueryCount++;
        const response = await this.platform.queryMemoryPolicyDiagnosticsHistory(r);

        // Domain-level history aggregation
        const aggregated = this.aggregateDiagnosticsHistory(response);

        return { ...response, _domain: { aggregated } };
    }

    async queryDiagnosticsTrend(r: any) {
        this.trendQueryCount++;
        const response = await this.platform.queryMemoryPolicyDiagnosticsTrend(r);

        // Domain-level eviction trend
        const evictionTrend = this.computeEvictionTrend(10);

        return { ...response, _domain: { evictionTrend } };
    }

    // ─── Public accessors ───────────────────────────────────────────

    getPolicyApplicationCount(): number { return this.policyApplicationCount; }

    getEvictionHistory(): readonly any[] { return [...this.evictionHistory]; }

    getPromotionHistory(): readonly any[] { return [...this.promotionHistory]; }

    getLayerSizes(): Record<string, number> {
        return Object.fromEntries(this.layerSizes);
    }

    getDiagnosticsSummary() {
        const evictionTrend = this.computeEvictionTrend(10);
        const writePattern = this.analyzeWritePattern(20);

        return {
            policyApplicationCount: this.policyApplicationCount,
            diagnosticsQueryCount: this.diagnosticsQueryCount,
            historyQueryCount: this.historyQueryCount,
            trendQueryCount: this.trendQueryCount,
            policyLayerDistribution: { ...this.policyLayerCounts },
            evictionTrend,
            writePattern,
            promotionCount: this.promotionHistory.length,
            recentPromotions: this.promotionHistory.slice(-5),
            totalEvicted: this.evictionHistory.reduce((s, e) => s + e.evictedCount, 0),
        };
    }

    // ─── Private: validation ────────────────────────────────────────

    private validatePolicyRequest(r: any): void {
        if (!r) throw new Error('Memory policy request is required.');
        if (!r?.userId) throw new Error('userId is required for memory policy operations.');
        if (!r?.layer) throw new Error('Memory layer (session/unit/long_term) is required.');
        const validLayers = ['session', 'unit', 'long_term'];
        if (!validLayers.includes(r.layer)) {
            throw new Error(`Invalid memory layer "${r.layer}". Must be one of: ${validLayers.join(', ')}.`);
        }
    }

    /**
     * Validate that the operation won't exceed per-layer capacity budgets.
     * Rejects writes that would push a layer beyond its max entry limit.
     */
    private validateLayerBudget(r: any, layer: string): void {
        const budget = this.budgets[layer as keyof typeof this.budgets];
        if (!budget || r?.operation !== 'write') return;

        const incomingEntries = Array.isArray(r?.entries) ? r.entries : [];
        const currentSize = this.layerSizes.get(layer) || 0;

        if (currentSize + incomingEntries.length > budget.maxEntries) {
            throw new Error(
                `Layer "${layer}" capacity exceeded: ${currentSize + incomingEntries.length} > ${budget.maxEntries}. ` +
                `Consider eviction or promoting entries to a higher layer.`
            );
        }

        // Validate individual entry sizes
        for (const entry of incomingEntries) {
            const valueSize = String(entry?.value || '').length;
            if (valueSize > budget.maxEntrySizeChars) {
                throw new Error(
                    `Entry value (${valueSize} chars) exceeds layer "${layer}" limit (${budget.maxEntrySizeChars}).`
                );
            }
            const tagCount = Array.isArray(entry?.tags) ? entry.tags.length : 0;
            if (tagCount > budget.maxTagsPerEntry) {
                throw new Error(
                    `Entry tag count (${tagCount}) exceeds layer "${layer}" limit (${budget.maxTagsPerEntry}).`
                );
            }
        }
    }

    /**
     * Validate a layer promotion request (session → unit, unit → long_term).
     * Checks confidence, access count, and age thresholds.
     */
    private validatePromotion(r: any): { valid: boolean; reason?: string } {
        const fromLayer = String(r?.promoteFromLayer || '');
        const toLayer = String(r?.layer || '');

        const validTransitions: Record<string, string> = {
            session: 'unit',
            unit: 'long_term',
        };

        const expectedTarget = validTransitions[fromLayer];
        if (!expectedTarget) {
            return { valid: false, reason: `Promotion from "${fromLayer}" is not supported.` };
        }
        if (toLayer !== expectedTarget) {
            return { valid: false, reason: `Cannot promote directly from "${fromLayer}" to "${toLayer}". Expected target: "${expectedTarget}".` };
        }

        const minAgeDays = toLayer === 'long_term'
            ? this.promotionThresholds.minAgeDaysLongTerm
            : this.promotionThresholds.minAgeDays;

        const entries = Array.isArray(r?.entries) ? r.entries : [];
        const failingEntries: string[] = [];

        for (const entry of entries) {
            const confidence = Number(entry?.confidence || 0);
            const accessCount = Number(entry?.accessCount || entry?._accessCount || 0);

            if (confidence < this.promotionThresholds.minConfidence) {
                failingEntries.push(`${entry.key}: confidence ${confidence} < ${this.promotionThresholds.minConfidence}`);
                continue;
            }
            if (accessCount < this.promotionThresholds.minAccessCount) {
                failingEntries.push(`${entry.key}: accessCount ${accessCount} < ${this.promotionThresholds.minAccessCount}`);
                continue;
            }

            // Age check
            const createdAt = entry?.createdAt;
            if (createdAt) {
                const ageMs = Date.now() - new Date(createdAt).getTime();
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                if (ageDays < minAgeDays) {
                    failingEntries.push(`${entry.key}: age ${ageDays.toFixed(1)} days < ${minAgeDays} days`);
                }
            }
        }

        if (failingEntries.length > 0) {
            return { valid: false, reason: `Promotion requirements not met: ${failingEntries.join('; ')}` };
        }

        // Record promotion for governance
        this.promotionHistory.push({
            timestamp: new Date().toISOString(),
            fromLayer,
            toLayer,
            entryKeys: entries.map((e: any) => String(e.key || '')),
            accepted: true,
        });
        if (this.promotionHistory.length > 100) this.promotionHistory.shift();

        return { valid: true };
    }

    // ─── Private: augmentation ──────────────────────────────────────

    private augmentPolicyResponse(response: any, layer: string): any {
        const budget = this.budgets[layer as keyof typeof this.budgets];
        const currentSize = this.layerSizes.get(layer) || 0;
        const capacityUsedPct = budget
            ? Number(((currentSize / budget.maxEntries) * 100).toFixed(1))
            : 0;

        return {
            ...response,
            _domain: {
                layer,
                applicationNumber: this.policyApplicationCount,
                layerCount: this.policyLayerCounts[layer] || 1,
                layers: Object.keys(this.policyLayerCounts),
                capacityUsedPct,
                capacityLimit: budget?.maxEntries ?? null,
                withinBudget: capacityUsedPct <= 85,
            },
        };
    }

    // ─── Private: layer size tracking ───────────────────────────────

    private trackLayerSize(layer: string, response: any): void {
        const entries = Array.isArray(response?.entries) ? response.entries : [];
        this.layerSizes.set(layer, entries.length);
    }

    // ─── Private: operation recording ───────────────────────────────

    private recordOperation(request: any, response: any): void {
        const layer = String(request?.layer || 'unknown');
        const operation = String(request?.operation || 'unknown');

        if (operation === 'write') {
            const entries = Array.isArray(request?.entries) ? request.entries : [];
            this.writeHistory.push({
                timestamp: new Date().toISOString(),
                layer,
                entryCount: entries.length,
                operation,
            });
            if (this.writeHistory.length > 200) this.writeHistory.shift();
        }
    }

    // ─── Private: eviction tracking ─────────────────────────────────

    private trackEviction(layer: string, response: any): void {
        const evictedCount = Number(response?.evictedCount || 0);
        if (evictedCount === 0) return;

        const entries = Array.isArray(response?.entries) ? response.entries : [];
        this.evictionHistory.push({
            timestamp: new Date().toISOString(),
            layer,
            evictedCount,
            remainingCount: entries.length,
        });
        if (this.evictionHistory.length > 100) this.evictionHistory.shift();
    }

    private computeEvictionTrend(n: number): {
        direction: string;
        recentEvicted: number;
        windowTotalEvicted: number;
        averagePerEvent: number;
        snapshotCount: number;
    } {
        const window = this.evictionHistory.slice(-n);
        if (window.length === 0) {
            return {
                direction: 'none',
                recentEvicted: 0,
                windowTotalEvicted: 0,
                averagePerEvent: 0,
                snapshotCount: 0,
            };
        }

        const totalEvicted = window.reduce((s, e) => s + e.evictedCount, 0);
        const avgPerEvent = Number((totalEvicted / window.length).toFixed(1));
        const recentEvicted = window[window.length - 1].evictedCount;

        if (window.length < 2) {
            return {
                direction: 'insufficient_data',
                recentEvicted,
                windowTotalEvicted: totalEvicted,
                averagePerEvent: avgPerEvent,
                snapshotCount: window.length,
            };
        }

        const mid = Math.floor(window.length / 2);
        const recentAvg = window.slice(-mid).reduce((s, e) => s + e.evictedCount, 0) / mid;
        const earlierAvg = window.slice(0, mid).reduce((s, e) => s + e.evictedCount, 0) / mid;
        const delta = recentAvg - earlierAvg;

        return {
            direction: delta > 3 ? 'increasing' : delta < -3 ? 'decreasing' : 'stable',
            recentEvicted,
            windowTotalEvicted: totalEvicted,
            averagePerEvent: avgPerEvent,
            snapshotCount: window.length,
        };
    }

    // ─── Private: write pattern analysis ────────────────────────────

    private analyzeWritePattern(n: number): {
        totalWrites: number;
        layerDistribution: Record<string, number>;
        averageBatchSize: number;
        writeRatePerMinute: number;
        snapshotCount: number;
    } {
        const window = this.writeHistory.slice(-n);
        const layerDist: Record<string, number> = {};
        let totalEntries = 0;

        for (const write of window) {
            layerDist[write.layer] = (layerDist[write.layer] || 0) + 1;
            totalEntries += write.entryCount;
        }

        const avgBatchSize = window.length > 0
            ? Number((totalEntries / window.length).toFixed(1))
            : 0;

        // Estimate write rate per minute from timestamps
        let writeRatePerMinute = 0;
        if (window.length >= 2) {
            const firstTs = new Date(window[0].timestamp).getTime();
            const lastTs = new Date(window[window.length - 1].timestamp).getTime();
            const elapsedMinutes = (lastTs - firstTs) / (1000 * 60);
            writeRatePerMinute = elapsedMinutes > 0
                ? Number((window.length / elapsedMinutes).toFixed(2))
                : window.length;
        }

        return {
            totalWrites: window.length,
            layerDistribution: layerDist,
            averageBatchSize: avgBatchSize,
            writeRatePerMinute,
            snapshotCount: window.length,
        };
    }

    // ─── Private: memory health scoring ─────────────────────────────

    /**
     * Compute a composite memory health score (0-100) from:
     * - Fragmentation risk (too many small entries per layer)
     * - Staleness ratio (entries past expiry without eviction)
     * - Confidence distribution (ratio of low-confidence entries)
     * - Eviction pressure (how close layers are to capacity)
     */
    private computeMemoryHealth(response: any): {
        score: number;
        fragmentationRisk: number;
        stalenessRatio: number;
        confidenceDistribution: number;
        evictionPressure: number;
    } {
        const stats = response?.stats || {};
        const now = Date.now();

        // Fragmentation risk: average entries per layer vs max
        let fragmentationRisk = 0;
        let totalLayers = 0;
        for (const [layer, budget] of Object.entries(this.budgets)) {
            const size = this.layerSizes.get(layer) || Number(stats[`${layer}Entries`] || 0);
            if (size > 0) {
                // Risk increases as entries approach budget limit
                fragmentationRisk += size / budget.maxEntries;
                totalLayers++;
            }
        }
        fragmentationRisk = totalLayers > 0
            ? Number(clamp(fragmentationRisk / totalLayers, 0, 1).toFixed(4))
            : 0;

        // Staleness ratio: stale entries count
        const staleCount = Number(stats.staleEntryCount || stats.expiredEntryCount || 0);
        const totalEntries = Number(stats.totalEntries || 0);
        const stalenessRatio = totalEntries > 0
            ? Number(clamp(staleCount / totalEntries, 0, 1).toFixed(4))
            : 0;

        // Confidence distribution: how many entries have low confidence
        const lowConfidenceCount = Number(stats.lowConfidenceEntryCount || 0);
        const confidenceDistribution = totalEntries > 0
            ? Number(clamp(1 - lowConfidenceCount / totalEntries, 0, 1).toFixed(4))
            : 1;

        // Eviction pressure: recent eviction rate
        const recentEvictions = this.evictionHistory.slice(-10);
        const evictionPressure = recentEvictions.length > 0
            ? Number(clamp(
                recentEvictions.reduce((s, e) => s + e.evictedCount, 0) / (recentEvictions.length * 20),
                0,
                1
            ).toFixed(4))
            : 0;

        const score = Number((
            (1 - fragmentationRisk) * this.healthWeights.fragmentationRisk +
            (1 - stalenessRatio) * this.healthWeights.stalenessRatio +
            confidenceDistribution * this.healthWeights.confidenceDistribution +
            (1 - evictionPressure) * this.healthWeights.evictionPressure
        ).toFixed(4)) * 100;

        return {
            score: Number(score.toFixed(1)),
            fragmentationRisk: Number((fragmentationRisk * 100).toFixed(1)),
            stalenessRatio: Number((stalenessRatio * 100).toFixed(1)),
            confidenceDistribution: Number((confidenceDistribution * 100).toFixed(1)),
            evictionPressure: Number((evictionPressure * 100).toFixed(1)),
        };
    }

    // ─── Private: diagnostics history aggregation ───────────────────

    private aggregateDiagnosticsHistory(response: any): {
        totalRecords: number;
        policyApplyRate: number;
        topOperations: Record<string, number>;
    } {
        const records = Array.isArray(response?.records) ? response.records : [];
        const opCounts: Record<string, number> = {};
        for (const record of records) {
            const op = String(record?.operation || 'unknown');
            opCounts[op] = (opCounts[op] || 0) + 1;
        }

        return {
            totalRecords: records.length,
            policyApplyRate: this.policyApplicationCount,
            topOperations: opCounts,
        };
    }
}

function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}
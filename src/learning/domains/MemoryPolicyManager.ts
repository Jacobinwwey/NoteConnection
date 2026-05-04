/**
 * MemoryPolicyManager domain — L5: Memory policy application, diagnostics,
 * history, and trend governance.
 */

import type {
    MemoryPolicyRequest, MemoryPolicyResponse,
    MemoryPolicyDiagnosticsRequest, MemoryPolicyDiagnosticsResponse,
    MemoryPolicyDiagnosticsHistoryRequest, MemoryPolicyDiagnosticsHistoryResponse,
    MemoryPolicyDiagnosticsTrendRequest, MemoryPolicyDiagnosticsTrendResponse,
} from '../types';

export interface MemoryPlatform {
    applyMemoryPolicy(request: MemoryPolicyRequest): Promise<MemoryPolicyResponse>;
    queryMemoryPolicyDiagnostics(request: MemoryPolicyDiagnosticsRequest): Promise<MemoryPolicyDiagnosticsResponse>;
    queryMemoryPolicyDiagnosticsHistory(request: MemoryPolicyDiagnosticsHistoryRequest): Promise<MemoryPolicyDiagnosticsHistoryResponse>;
    queryMemoryPolicyDiagnosticsTrend(request: MemoryPolicyDiagnosticsTrendRequest): Promise<MemoryPolicyDiagnosticsTrendResponse>;
}

export class MemoryPolicyManager {
    private policyApplicationCount = 0;
    private diagnosticsQueryCount = 0;
    private historyQueryCount = 0;
    private trendQueryCount = 0;
    private policyLayerCounts: Record<string, number> = {};

    constructor(private readonly platform: MemoryPlatform) {}

    async apply(request: MemoryPolicyRequest): Promise<MemoryPolicyResponse> {
        this.policyApplicationCount++;
        const layer = String(request.layer ?? 'unknown');
        this.policyLayerCounts[layer] = (this.policyLayerCounts[layer] || 0) + 1;
        return this.platform.applyMemoryPolicy(request);
    }

    async queryDiagnostics(request: MemoryPolicyDiagnosticsRequest): Promise<MemoryPolicyDiagnosticsResponse> {
        this.diagnosticsQueryCount++;
        return this.platform.queryMemoryPolicyDiagnostics(request);
    }

    async queryDiagnosticsHistory(request: MemoryPolicyDiagnosticsHistoryRequest): Promise<MemoryPolicyDiagnosticsHistoryResponse> {
        this.historyQueryCount++;
        return this.platform.queryMemoryPolicyDiagnosticsHistory(request);
    }

    async queryDiagnosticsTrend(request: MemoryPolicyDiagnosticsTrendRequest): Promise<MemoryPolicyDiagnosticsTrendResponse> {
        this.trendQueryCount++;
        return this.platform.queryMemoryPolicyDiagnosticsTrend(request);
    }

    getPolicyApplicationCount(): number { return this.policyApplicationCount; }

    getDiagnosticsSummary() {
        return {
            policyApplicationCount: this.policyApplicationCount,
            diagnosticsQueryCount: this.diagnosticsQueryCount,
            historyQueryCount: this.historyQueryCount,
            trendQueryCount: this.trendQueryCount,
            policyLayerDistribution: { ...this.policyLayerCounts },
        };
    }
}

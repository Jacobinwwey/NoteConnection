/** MemoryPolicyManager domain — L5: Memory policy + diagnostics governance. */
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

    constructor(private readonly platform: MemoryPlatform) {}

    async apply(r: any) { this.policyApplicationCount++; const layer = String(r?.layer ?? 'unknown'); this.policyLayerCounts[layer] = (this.policyLayerCounts[layer] || 0) + 1; return this.platform.applyMemoryPolicy(r); }
    async queryDiagnostics(r: any) { this.diagnosticsQueryCount++; return this.platform.queryMemoryPolicyDiagnostics(r); }
    async queryDiagnosticsHistory(r: any) { this.historyQueryCount++; return this.platform.queryMemoryPolicyDiagnosticsHistory(r); }
    async queryDiagnosticsTrend(r: any) { this.trendQueryCount++; return this.platform.queryMemoryPolicyDiagnosticsTrend(r); }

    getPolicyApplicationCount(): number { return this.policyApplicationCount; }

    getDiagnosticsSummary() {
        return { policyApplicationCount: this.policyApplicationCount, diagnosticsQueryCount: this.diagnosticsQueryCount, historyQueryCount: this.historyQueryCount, trendQueryCount: this.trendQueryCount, policyLayerDistribution: { ...this.policyLayerCounts } };
    }
}

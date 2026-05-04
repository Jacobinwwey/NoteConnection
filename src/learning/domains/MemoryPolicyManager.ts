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

    constructor(private readonly platform: MemoryPlatform) {}

    async apply(request: MemoryPolicyRequest): Promise<MemoryPolicyResponse> {
        this.policyApplicationCount++;
        return this.platform.applyMemoryPolicy(request);
    }

    async queryDiagnostics(request: MemoryPolicyDiagnosticsRequest): Promise<MemoryPolicyDiagnosticsResponse> {
        return this.platform.queryMemoryPolicyDiagnostics(request);
    }

    async queryDiagnosticsHistory(request: MemoryPolicyDiagnosticsHistoryRequest): Promise<MemoryPolicyDiagnosticsHistoryResponse> {
        return this.platform.queryMemoryPolicyDiagnosticsHistory(request);
    }

    async queryDiagnosticsTrend(request: MemoryPolicyDiagnosticsTrendRequest): Promise<MemoryPolicyDiagnosticsTrendResponse> {
        return this.platform.queryMemoryPolicyDiagnosticsTrend(request);
    }

    getPolicyApplicationCount(): number { return this.policyApplicationCount; }
}

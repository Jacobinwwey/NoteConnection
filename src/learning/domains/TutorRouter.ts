/**
 * TutorRouter domain — L4: Pluggable tutor adapter catalog, telemetry,
 * trace diagnostics, provider trend analysis, and tutor action execution.
 */

import type {
    TutorActionRequest, TutorActionResponse,
    TutorAdapterCatalogResponse, TutorAdapterTelemetryResponse,
    TutorTraceDiagnosticsRequest, TutorTraceDiagnosticsResponse,
    TutorProviderTrendDiagnosticsRequest, TutorProviderTrendDiagnosticsResponse,
    TutorProviderTrendHistoryRequest, TutorProviderTrendHistoryResponse,
} from '../types';

export interface TutorPlatform {
    getTutorAdapterCatalog(): Promise<TutorAdapterCatalogResponse>;
    getTutorAdapterTelemetry(): Promise<TutorAdapterTelemetryResponse>;
    queryTutorTraceDiagnostics(request: TutorTraceDiagnosticsRequest): Promise<TutorTraceDiagnosticsResponse>;
    queryTutorProviderTrendDiagnostics(request: TutorProviderTrendDiagnosticsRequest): Promise<TutorProviderTrendDiagnosticsResponse>;
    queryTutorProviderTrendHistory(request: TutorProviderTrendHistoryRequest): Promise<TutorProviderTrendHistoryResponse>;
    executeTutorAction(request: TutorActionRequest): Promise<TutorActionResponse>;
}

export class TutorRouter {
    private actionExecutionCount = 0;
    private catalogFetchCount = 0;
    private telemetryFetchCount = 0;
    private traceQueryCount = 0;
    private actionKindCounts: Record<string, number> = {};

    constructor(private readonly platform: TutorPlatform) {}

    async getCatalog(): Promise<TutorAdapterCatalogResponse> {
        this.catalogFetchCount++;
        return this.platform.getTutorAdapterCatalog();
    }

    async getTelemetry(): Promise<TutorAdapterTelemetryResponse> {
        this.telemetryFetchCount++;
        return this.platform.getTutorAdapterTelemetry();
    }

    async queryTraceDiagnostics(request: TutorTraceDiagnosticsRequest): Promise<TutorTraceDiagnosticsResponse> {
        this.traceQueryCount++;
        return this.platform.queryTutorTraceDiagnostics(request);
    }

    async queryProviderTrendDiagnostics(request: TutorProviderTrendDiagnosticsRequest): Promise<TutorProviderTrendDiagnosticsResponse> {
        return this.platform.queryTutorProviderTrendDiagnostics(request);
    }

    async queryProviderTrendHistory(request: TutorProviderTrendHistoryRequest): Promise<TutorProviderTrendHistoryResponse> {
        return this.platform.queryTutorProviderTrendHistory(request);
    }

    async executeAction(request: TutorActionRequest): Promise<TutorActionResponse> {
        this.actionExecutionCount++;
        const kind = String(request.actionKind ?? 'unknown');
        this.actionKindCounts[kind] = (this.actionKindCounts[kind] || 0) + 1;
        return this.platform.executeTutorAction(request);
    }

    getActionExecutionCount(): number { return this.actionExecutionCount; }

    getDiagnosticsSummary() {
        return {
            actionExecutionCount: this.actionExecutionCount,
            catalogFetchCount: this.catalogFetchCount,
            telemetryFetchCount: this.telemetryFetchCount,
            traceQueryCount: this.traceQueryCount,
            actionKindDistribution: { ...this.actionKindCounts },
        };
    }
}

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

    constructor(private readonly platform: TutorPlatform) {}

    async getCatalog(): Promise<TutorAdapterCatalogResponse> {
        return this.platform.getTutorAdapterCatalog();
    }

    async getTelemetry(): Promise<TutorAdapterTelemetryResponse> {
        return this.platform.getTutorAdapterTelemetry();
    }

    async queryTraceDiagnostics(request: TutorTraceDiagnosticsRequest): Promise<TutorTraceDiagnosticsResponse> {
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
        return this.platform.executeTutorAction(request);
    }

    getActionExecutionCount(): number { return this.actionExecutionCount; }
}

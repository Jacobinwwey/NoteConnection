/** TutorRouter domain — L4: Tutor adapter catalog, telemetry, action execution. */
export interface TutorPlatform {
    getTutorAdapterCatalog(): Promise<any>;
    getTutorAdapterTelemetry(): Promise<any>;
    queryTutorTraceDiagnostics(request: any): Promise<any>;
    queryTutorProviderTrendDiagnostics(request: any): Promise<any>;
    queryTutorProviderTrendHistory(request: any): Promise<any>;
    executeTutorAction(request: any): Promise<any>;
}

export class TutorRouter {
    private actionExecutionCount = 0;
    private catalogFetchCount = 0;
    private telemetryFetchCount = 0;
    private actionKindCounts: Record<string, number> = {};

    constructor(private readonly platform: TutorPlatform) {}

    async getCatalog() { this.catalogFetchCount++; return this.platform.getTutorAdapterCatalog(); }
    async getTelemetry() { this.telemetryFetchCount++; return this.platform.getTutorAdapterTelemetry(); }
    async queryTraceDiagnostics(r: any) { return this.platform.queryTutorTraceDiagnostics(r); }
    async queryProviderTrendDiagnostics(r: any) { return this.platform.queryTutorProviderTrendDiagnostics(r); }
    async queryProviderTrendHistory(r: any) { return this.platform.queryTutorProviderTrendHistory(r); }
    async executeAction(r: any) { this.actionExecutionCount++; const kind = String(r?.actionKind ?? 'unknown'); this.actionKindCounts[kind] = (this.actionKindCounts[kind] || 0) + 1; return this.platform.executeTutorAction(r); }

    getActionExecutionCount(): number { return this.actionExecutionCount; }

    getDiagnosticsSummary() {
        return { actionExecutionCount: this.actionExecutionCount, catalogFetchCount: this.catalogFetchCount, telemetryFetchCount: this.telemetryFetchCount, actionKindDistribution: { ...this.actionKindCounts } };
    }
}

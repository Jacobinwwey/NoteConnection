import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';
import * as fs from 'fs';
import * as path from 'path';

function readJsonSafe(filePath: string): Record<string, unknown> | null {
    try {
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function ensureDir(filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

interface AgentWorkspaceDiagnosticsIndexEntry {
    reportId: string;
    timestamp: string;
    status: string;
    strictMode: boolean;
    checks: number;
    passed: number;
}

function readAgentWorkspaceDiagnosticsIndex(indexPath: string): AgentWorkspaceDiagnosticsIndexEntry[] {
    const data = readJsonSafe(indexPath);
    if (!data || !Array.isArray(data.entries)) return [];
    return data.entries as AgentWorkspaceDiagnosticsIndexEntry[];
}

function readAgentWorkspaceDiagnosticsReport(
    workspaceDir: string,
    reportId: string
): { metadata: AgentWorkspaceDiagnosticsIndexEntry; report: Record<string, unknown> } | null {
    const reportPath = path.join(workspaceDir, `${reportId}.json`);
    const report = readJsonSafe(reportPath);
    if (!report) return null;
    return {
        metadata: {
            reportId,
            timestamp: String(report.timestamp || ''),
            status: String(report.status || ''),
            strictMode: Boolean(report.strictMode),
            checks: Number(report.totalChecks || 0),
            passed: Number(report.passedChecks || 0),
        },
        report,
    };
}

function getAlertThresholds(): Record<string, unknown> {
    return {
        conversationTurnCache: { maxAlertRate: 0.3, windowMinutes: 60, minSampleSize: 10 },
        knowledgeGraphHealth: { maxDegradationRate: 0.2, windowMinutes: 120 },
        queryLatency: { maxP95Ms: 5000, windowMinutes: 30 },
        memoryPressure: { maxUsageRatio: 0.85, windowMinutes: 15 },
    };
}

export function registerAgentWorkspaceDiagnosticsRoutes(ctx: ServerContext): RouteEntry[] {
    const { knowledgeLearningPlatform, runtimeDataDir } = ctx;

    const workspaceDir = path.join(runtimeDataDir, 'agent_workspace_diagnostics');
    const indexPath = path.join(workspaceDir, 'index.v1.json');

    const json = (res: any, code: number, data: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    const ok = (res: any, data: unknown) => json(res, 200, { success: true, ...(data as any) });
    const fail = (res: any, error: unknown, label: string) => {
        console.error(error);
        CrashLogger.log(error, label);
        json(res, 500, { success: false, error: String(error) });
    };

    return [
        {
            method: 'GET',
            path: '/api/knowledge/foundation/readiness',
            handler: async (_req, res) => {
                try {
                    await knowledgeLearningPlatform.ensureReady();
                    const readiness = await knowledgeLearningPlatform.getFoundationReadiness();
                    ok(res, { readiness });
                } catch (e) { fail(res, e, 'API:GET /api/knowledge/foundation/readiness'); }
            },
        },
        {
            method: 'GET',
            path: '/api/knowledge/backend/sufficiency',
            handler: async (_req, res) => {
                try {
                    await knowledgeLearningPlatform.ensureReady();
                    const sufficiency = await knowledgeLearningPlatform.getBackendBaselineSufficiency();
                    ok(res, { sufficiency });
                } catch (e) { fail(res, e, 'API:GET /api/knowledge/backend/sufficiency'); }
            },
        },
        {
            method: 'GET',
            path: '/api/knowledge/operator/agent-workspace-diagnostics/index',
            handler: async (_req, res) => {
                try {
                    const index = readAgentWorkspaceDiagnosticsIndex(indexPath);
                    ok(res, { index, count: index.length, maxEntries: 40 });
                } catch (e) { fail(res, e, 'API:GET /api/knowledge/operator/agent-workspace-diagnostics/index'); }
            },
        },
        {
            method: 'GET',
            path: '/api/knowledge/operator/agent-workspace-diagnostics/latest',
            handler: async (_req, res) => {
                try {
                    const index = readAgentWorkspaceDiagnosticsIndex(indexPath);
                    let latest: { metadata: AgentWorkspaceDiagnosticsIndexEntry; report: Record<string, unknown> } | null = null;
                    for (const entry of index) {
                        latest = readAgentWorkspaceDiagnosticsReport(workspaceDir, entry.reportId);
                        if (latest) break;
                    }
                    ok(res, { latest, count: index.length, maxEntries: 40 });
                } catch (e) { fail(res, e, 'API:GET /api/knowledge/operator/agent-workspace-diagnostics/latest'); }
            },
        },
        {
            method: 'GET',
            path: '/api/knowledge/operator/agent-workspace-diagnostics/triage/thresholds',
            handler: async (_req, res) => {
                try {
                    const alertThresholds = getAlertThresholds();
                    ok(res, { alertThresholds });
                } catch (e) { fail(res, e, 'API:GET /api/knowledge/operator/agent-workspace-diagnostics/triage/thresholds'); }
            },
        },
    ];
}

import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';

export function registerKnowledgeRoutes(ctx: ServerContext): RouteEntry[] {
    const {
        knowledgeLearningPlatform,
        knowledgeIngestor,
        LOOPBACK_HOST,
        finalPort,
        KNOWLEDGE_GRAPH_STORE_BACKEND,
        KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER,
        KNOWLEDGE_GRAPHDB_ADAPTER_ID,
        KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED,
        KNOWLEDGE_GRAPHDB_OPERATION_MODE,
    } = ctx;

    const api = (path: string) => `/api/knowledge${path}`;

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

    const readBody = (req: any): Promise<string> =>
        new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
        });

    const parseQuery = (req: any): URLSearchParams =>
        new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`).searchParams;

    return [
        // --- GET routes (self-contained, no external normalize functions) ---
        {
            method: 'GET',
            path: api('/state'),
            handler: async (_req, res) => {
                try {
                    const payload = await knowledgeLearningPlatform.getKnowledgeState();
                    ok(res, payload);
                } catch (e) { fail(res, e, 'GET /api/knowledge/state'); }
            },
        },
        {
            method: 'GET',
            path: api('/store-diagnostics'),
            handler: async (_req, res) => {
                try {
                    const store = await knowledgeLearningPlatform.getStoreDiagnostics();
                    ok(res, {
                        configuredBackend: KNOWLEDGE_GRAPH_STORE_BACKEND,
                        configuredGraphDbAdapterProvider: KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER,
                        configuredGraphDbAdapterId: KNOWLEDGE_GRAPHDB_ADAPTER_ID,
                        graphDbFallbackEnabled: KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED,
                        configuredGraphDbOperationMode: KNOWLEDGE_GRAPHDB_OPERATION_MODE,
                        store,
                    });
                } catch (e) { fail(res, e, 'GET /api/knowledge/store-diagnostics'); }
            },
        },
        {
            method: 'GET',
            path: api('/tutor/catalog'),
            handler: async (_req, res) => {
                try {
                    const catalog = await knowledgeLearningPlatform.getTutorAdapterCatalog();
                    ok(res, { catalog });
                } catch (e) { fail(res, e, 'GET /api/knowledge/tutor/catalog'); }
            },
        },
        {
            method: 'GET',
            path: api('/tutor/telemetry'),
            handler: async (_req, res) => {
                try {
                    const result = await knowledgeLearningPlatform.getTutorAdapterTelemetry();
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/tutor/telemetry'); }
            },
        },
        {
            method: 'GET',
            path: api('/tutor/trace-diagnostics'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryTutorTraceDiagnostics({ limit: Number(params.get('limit')) || 20 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/tutor/trace-diagnostics'); }
            },
        },
        {
            method: 'GET',
            path: api('/query-backend-diagnostics'),
            handler: async (_req, res) => {
                try {
                    const diag = await knowledgeLearningPlatform.getQueryBackendDiagnostics();
                    ok(res, { queryBackendDiagnostics: diag });
                } catch (e) { fail(res, e, 'GET /api/knowledge/query-backend-diagnostics'); }
            },
        },
        {
            method: 'GET',
            path: api('/query-backend-config'),
            handler: async (_req, res) => {
                try {
                    const config = knowledgeLearningPlatform.getQueryBackendConfig();
                    ok(res, { queryBackendConfig: config });
                } catch (e) { fail(res, e, 'GET /api/knowledge/query-backend-config'); }
            },
        },
        {
            method: 'GET',
            path: api('/quality/trend'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryLearningQualityTrend({ limit: Number(params.get('limit')) || 10 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/quality/trend'); }
            },
        },
        {
            method: 'GET',
            path: api('/quality/history'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryLearningQualityHistory({ limit: Number(params.get('limit')) || 20 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/quality/history'); }
            },
        },
        {
            method: 'GET',
            path: api('/session/history'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryStudySessionHistory({ limit: Number(params.get('limit')) || 20 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/session/history'); }
            },
        },
        {
            method: 'GET',
            path: api('/session/plan/quality/trend'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryStudySessionPlanQualityTrend({ limit: Number(params.get('limit')) || 10 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/session/plan/quality/trend'); }
            },
        },
        {
            method: 'GET',
            path: api('/session/plan/quality/history'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryStudySessionPlanQualityHistory({ limit: Number(params.get('limit')) || 20 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/session/plan/quality/history'); }
            },
        },
        {
            method: 'GET',
            path: api('/memory-policy/diagnostics'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryMemoryPolicyDiagnostics({ limit: Number(params.get('limit')) || 20 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/memory-policy/diagnostics'); }
            },
        },
        {
            method: 'GET',
            path: api('/conversation/turn-cache/diagnostics'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.getAgentConversationTurnCacheDiagnostics({ format: params.get('format') || 'summary' });
                    ok(res, result);
                } catch (e) { fail(res, e, 'GET /api/knowledge/conversation/turn-cache/diagnostics'); }
            },
        },
        {
            method: 'GET',
            path: api('/conversation/turn-cache/diagnostics/trend'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.getAgentConversationTurnCacheTrend({ limit: Number(params.get('limit')) || 20, windowSize: Number(params.get('windowSize')) || 6, minSamples: Number(params.get('minSamples')) || 3 });
                    ok(res, result);
                } catch (e) { fail(res, e, 'GET /api/knowledge/conversation/turn-cache/diagnostics/trend'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-matrix'),
            handler: async (_req, res) => {
                try {
                    const matrix = await knowledgeLearningPlatform.getRuntimeCapabilityMatrix();
                    ok(res, { matrix });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-matrix'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook'),
            handler: async (_req, res) => {
                try {
                    const runbook = await knowledgeLearningPlatform.getRuntimeCapabilityRunbook();
                    ok(res, { runbook });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook/verify'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.verifyRuntimeCapabilityRunbook({ limit: Number(params.get('limit')) || 20 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook/verify'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook/history'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.getRuntimeCapabilityRunbookHistory({ limit: Number(params.get('limit')) || 20 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook/history'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook/remediation-history'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.getRuntimeCapabilityRunbookRemediationHistory({ limit: Number(params.get('limit')) || 20 });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook/remediation-history'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook/replay-schedule'),
            handler: async (_req, res) => {
                try {
                    const schedule = await knowledgeLearningPlatform.getRuntimeCapabilityRunbookReplaySchedule();
                    ok(res, { schedule });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook/replay-schedule'); }
            },
        },
        // --- POST routes ---
        {
            method: 'POST',
            path: api('/ingest'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeIngestor.ingestKnowledge(JSON.parse(body));
                    ok(res, { result, ingestStats: { avgLatencyMs: knowledgeIngestor.averageIngestLatencyMs(20) } });
                } catch (e) { fail(res, e, 'POST /api/knowledge/ingest'); }
            },
        },
        {
            method: 'POST',
            path: api('/query'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.queryKnowledge(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/query'); }
            },
        },
        {
            method: 'POST',
            path: api('/conversation'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    const acceptSSE = (req.headers.accept || '').includes('text/event-stream');
                    if (acceptSSE) {
                        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
                        const stream = await knowledgeLearningPlatform.streamAgentConversation(payload);
                        for await (const event of stream) { res.write(`data: ${JSON.stringify(event)}\n\n`); }
                        res.end();
                    } else {
                        const result = await knowledgeLearningPlatform.agentConversation(payload);
                        ok(res, { result });
                    }
                } catch (e) { fail(res, e, 'POST /api/knowledge/conversation'); }
            },
        },
        {
            method: 'POST',
            path: api('/mastery/diagnostics'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.queryMasteryDiagnostics(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/mastery/diagnostics'); }
            },
        },
        {
            method: 'POST',
            path: api('/learning-path'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.generateLearningPath(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/learning-path'); }
            },
        },
        {
            method: 'POST',
            path: api('/session/build'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.buildStudySession(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/session/build'); }
            },
        },
        {
            method: 'POST',
            path: api('/session/execute'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.executeStudySessionPlan(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/session/execute'); }
            },
        },
        {
            method: 'POST',
            path: api('/quality/evaluate'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.evaluateLearningQuality(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/quality/evaluate'); }
            },
        },
        {
            method: 'POST',
            path: api('/quality/snapshot'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.captureLearningQualitySnapshot(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/quality/snapshot'); }
            },
        },
        {
            method: 'POST',
            path: api('/tutor/action'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.executeTutorAction(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/tutor/action'); }
            },
        },
        {
            method: 'POST',
            path: api('/memory-policy'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.applyMemoryPolicy(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/memory-policy'); }
            },
        },
        {
            method: 'POST',
            path: api('/query/compare-backends'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.compareQueryBackends(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/query/compare-backends'); }
            },
        },
        {
            method: 'POST',
            path: api('/store/reload'),
            handler: async (_req, res) => {
                try {
                    await knowledgeLearningPlatform.reloadStore();
                    ok(res, { reloaded: true });
                } catch (e) { fail(res, e, 'POST /api/knowledge/store/reload'); }
            },
        },
        {
            method: 'POST',
            path: api('/query-backend-config'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.updateQueryBackendConfig(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/query-backend-config'); }
            },
        },
        {
            method: 'POST',
            path: api('/ingest/guardrail'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.evaluateIngestGuardrail(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/ingest/guardrail'); }
            },
        },
        {
            method: 'POST',
            path: api('/runtime-capability-runbook/remediation-event'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.recordRuntimeCapabilityRemediationEvent(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/runtime-capability-runbook/remediation-event'); }
            },
        },
        {
            method: 'POST',
            path: api('/runtime-capability-runbook/remediation-event/replay'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.replayRuntimeCapabilityRemediationEvent(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/runtime-capability-runbook/remediation-event/replay'); }
            },
        },
        {
            method: 'POST',
            path: api('/runtime-capability-runbook/replay-schedule'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.updateRuntimeCapabilityReplaySchedule(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/runtime-capability-runbook/replay-schedule'); }
            },
        },
        {
            method: 'POST',
            path: api('/runtime-capability-runbook/replay-schedule/tick'),
            handler: async (_req, res) => {
                try {
                    const result = await knowledgeLearningPlatform.tickRuntimeCapabilityReplaySchedule();
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/runtime-capability-runbook/replay-schedule/tick'); }
            },
        },
        {
            method: 'POST',
            path: api('/session/orchestration/config'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.updateStudySessionOrchestrationConfig(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/session/orchestration/config'); }
            },
        },
        {
            method: 'POST',
            path: api('/conversation-memory/add'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.addConversationMemory(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/conversation-memory/add'); }
            },
        },
        {
            method: 'POST',
            path: api('/conversation-memory/search'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.searchConversationMemory(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/conversation-memory/search'); }
            },
        },
        {
            method: 'POST',
            path: api('/conversation-memory/delete'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.deleteConversationMemory(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/conversation-memory/delete'); }
            },
        },
        {
            method: 'POST',
            path: api('/conversation-memory/feedback'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.feedbackConversationMemory(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/conversation-memory/feedback'); }
            },
        },
    ];
}

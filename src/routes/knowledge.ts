import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';
import {
    normalizeKnowledgeQueryRequestPayload,
    normalizeWorkflowArtifactReviewFollowUpRequestPayload,
} from '../learning/requestNormalization';

export function registerKnowledgeRoutes(ctx: ServerContext): RouteEntry[] {
    const {
        knowledgeLearningPlatform,
        knowledgeIngestor,
        knowledgeQuerier,
        LOOPBACK_HOST,
        finalPort,
        KNOWLEDGE_GRAPH_STORE_BACKEND,
        KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER,
        KNOWLEDGE_GRAPHDB_ADAPTER_ID,
        KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED,
        KNOWLEDGE_GRAPHDB_OPERATION_MODE,
        runtimeRunbookOps,
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
                    const fallbackUsedToken = String(params.get('fallbackUsed') || '').trim().toLowerCase();
                    const result = await knowledgeLearningPlatform.queryTutorTraceDiagnostics({
                        userId: String(params.get('userId') || '').trim() || undefined,
                        source: String(params.get('source') || '').trim() || undefined,
                        actionKind: String(params.get('actionKind') || '').trim() || undefined,
                        providerName: String(params.get('providerName') || '').trim() || undefined,
                        providerMode: String(params.get('providerMode') || '').trim() || undefined,
                        fallbackUsed: fallbackUsedToken === 'true'
                            ? true
                            : fallbackUsedToken === 'false'
                                ? false
                                : undefined,
                        limit: Number(params.get('limit')) || 20,
                    });
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
            path: api('/query/compare-backends/history'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryKnowledgeQueryBackendComparisonHistory({
                        limit: Number(params.get('limit')) || 8,
                    });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/query/compare-backends/history'); }
            },
        },
        {
            method: 'GET',
            path: api('/query/compare-backends/trend'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryKnowledgeQueryBackendComparisonTrend({
                        limit: Number(params.get('limit')) || 12,
                        windowSize: Number(params.get('windowSize')) || 2,
                        minSamples: Number(params.get('minSamples')) || 1,
                    });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/query/compare-backends/trend'); }
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
                    const result = await knowledgeLearningPlatform.queryLearningQualityTrend({
                        userId: String(params.get('userId') || '').trim() || undefined,
                        limit: Number(params.get('limit')) || 10,
                        windowSize: Number(params.get('windowSize')) || undefined,
                        minSamples: Number(params.get('minSamples')) || undefined,
                    });
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
                    const result = await knowledgeLearningPlatform.queryLearningQualityHistory({
                        userId: String(params.get('userId') || '').trim() || undefined,
                        limit: Number(params.get('limit')) || 20,
                    });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/quality/history'); }
            },
        },
        {
            method: 'GET',
            path: api('/quality/baseline'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const userId = String(params.get('userId') || '').trim();
                    const result = await knowledgeLearningPlatform.getLearningQualityBaseline({ userId });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/quality/baseline'); }
            },
        },
        {
            method: 'GET',
            path: api('/session/history'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryStudySessionHistory({
                        userId: String(params.get('userId') || '').trim() || undefined,
                        limit: Number(params.get('limit')) || 20,
                        sinceMinutes: Number(params.get('sinceMinutes')) || undefined,
                        refreshSource: String(params.get('refreshSource') || '').trim() || undefined,
                    });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/session/history'); }
            },
        },
        {
            method: 'GET',
            path: api('/workflow-artifacts'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const artifactKinds = String(params.get('artifactKinds') || '').trim()
                        ? String(params.get('artifactKinds') || '')
                            .split(',')
                            .map((value) => String(value || '').trim())
                            .filter(Boolean)
                        : undefined;
                    const result = await knowledgeLearningPlatform.queryWorkflowArtifacts?.({
                        workspaceId: String(params.get('workspaceId') || '').trim() || undefined,
                        sessionId: String(params.get('sessionId') || '').trim() || undefined,
                        userId: String(params.get('userId') || '').trim() || undefined,
                        artifactId: String(params.get('artifactId') || '').trim() || undefined,
                        runId: String(params.get('runId') || '').trim() || undefined,
                        artifactKinds,
                        limit: Number(params.get('limit')) || 12,
                    });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/workflow-artifacts'); }
            },
        },
        {
            method: 'GET',
            path: api('/session/plan/quality/trend'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const result = await knowledgeLearningPlatform.queryStudySessionPlanQualityTrend({
                        userId: String(params.get('userId') || '').trim() || undefined,
                        limit: Number(params.get('limit')) || 10,
                        windowSize: Number(params.get('windowSize')) || undefined,
                        minSamples: Number(params.get('minSamples')) || undefined,
                    });
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
                    const result = await knowledgeLearningPlatform.queryStudySessionPlanQualityHistory({
                        userId: String(params.get('userId') || '').trim() || undefined,
                        limit: Number(params.get('limit')) || 20,
                    });
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
                    const persistRecordToken = String(params.get('persistRecord') || '').trim().toLowerCase();
                    const result = await knowledgeLearningPlatform.queryMemoryPolicyDiagnostics({
                        limit: Number(params.get('limit')) || undefined,
                        sampleLimit: Number(params.get('sampleLimit')) || undefined,
                        staleAfterHours: Number(params.get('staleAfterHours')) || undefined,
                        nearExpiryHours: Number(params.get('nearExpiryHours')) || undefined,
                        lowConfidenceThreshold: Number(params.get('lowConfidenceThreshold')) || undefined,
                        now: String(params.get('now') || '').trim() || undefined,
                        persistRecord: persistRecordToken === 'false'
                            ? false
                            : persistRecordToken === 'true'
                                ? true
                                : undefined,
                    });
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
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const runbook = runtimeRunbookOps?.getRunbook
                        ? await runtimeRunbookOps.getRunbook({
                            checkId: String(params.get('checkId') || '').trim(),
                        })
                        : await knowledgeLearningPlatform.getRuntimeCapabilityRunbook();
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
                    const request = {
                        checkId: String(params.get('checkId') || '').trim(),
                        focus: String(params.get('focus') || '').trim(),
                        focusLimit: Number(params.get('focusLimit')) || 12,
                        sinceMinutes: Number(params.get('sinceMinutes')) || 1440,
                        status: String(params.get('status') || '').trim(),
                        checkQuery: String(params.get('checkQuery') || '').trim(),
                        limit: Number(params.get('limit')) || 20,
                    };
                    const result = runtimeRunbookOps?.verify
                        ? await runtimeRunbookOps.verify(request)
                        : await knowledgeLearningPlatform.verifyRuntimeCapabilityRunbook(request);
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
                    const request = {
                        limit: Number(params.get('limit')) || 20,
                        checkId: String(params.get('checkId') || '').trim(),
                        sinceMinutes: Number(params.get('sinceMinutes')) || 10080,
                        status: String(params.get('status') || '').trim(),
                    };
                    const result = runtimeRunbookOps?.getHistory
                        ? await runtimeRunbookOps.getHistory(request)
                        : await knowledgeLearningPlatform.getRuntimeCapabilityRunbookHistory(request);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook/history'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook/history/checks'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const request = {
                        limit: Number(params.get('limit')) || 8,
                        sinceMinutes: Number(params.get('sinceMinutes')) || 10080,
                        status: String(params.get('status') || '').trim(),
                        checkQuery: String(params.get('checkQuery') || '').trim(),
                    };
                    const result = runtimeRunbookOps?.getChecks
                        ? await runtimeRunbookOps.getChecks(request)
                        : await knowledgeLearningPlatform.queryRuntimeCapabilityRunbookChecks(request);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook/history/checks'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook/history/action-queue'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const request = {
                        limit: Number(params.get('limit')) || 8,
                        sinceMinutes: Number(params.get('sinceMinutes')) || 10080,
                        status: String(params.get('status') || '').trim(),
                        checkQuery: String(params.get('checkQuery') || '').trim(),
                        queueLimit: Number(params.get('queueLimit')) || 12,
                        priority: String(params.get('priority') || '').trim(),
                        category: String(params.get('category') || '').trim(),
                        checkId: String(params.get('checkId') || '').trim(),
                        remediationStatus: String(params.get('remediationStatus') || '').trim(),
                        remediationTrend: String(params.get('remediationTrend') || '').trim(),
                    };
                    const result = runtimeRunbookOps?.getActionQueue
                        ? await runtimeRunbookOps.getActionQueue(request)
                        : await knowledgeLearningPlatform.queryRuntimeCapabilityRunbookActionQueue(request);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook/history/action-queue'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook/remediation-history'),
            handler: async (req, res) => {
                try {
                    const params = parseQuery(req);
                    const request = {
                        limit: Number(params.get('limit')) || 20,
                        sinceMinutes: Number(params.get('sinceMinutes')) || 10080,
                        status: String(params.get('status') || '').trim(),
                        source: String(params.get('source') || '').trim(),
                        checkId: String(params.get('checkId') || '').trim(),
                    };
                    const result = runtimeRunbookOps?.getRemediationHistory
                        ? await runtimeRunbookOps.getRemediationHistory(request)
                        : await knowledgeLearningPlatform.getRuntimeCapabilityRunbookRemediationHistory(request);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'GET /api/knowledge/runtime-capability-runbook/remediation-history'); }
            },
        },
        {
            method: 'GET',
            path: api('/runtime-capability-runbook/replay-schedule'),
            handler: async (_req, res) => {
                try {
                    const schedule = runtimeRunbookOps?.getReplaySchedule
                        ? await runtimeRunbookOps.getReplaySchedule()
                        : await knowledgeLearningPlatform.getRuntimeCapabilityRunbookReplaySchedule();
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
                    const result = await knowledgeQuerier.queryKnowledge(
                        normalizeKnowledgeQueryRequestPayload(JSON.parse(body))
                    );
                    ok(res, { result, queryStats: knowledgeQuerier.getDiagnosticsSummary() });
                } catch (e) { fail(res, e, 'POST /api/knowledge/query'); }
            },
        },
        {
            method: 'POST',
            path: api('/workspace-readiness'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    const result = await knowledgeLearningPlatform.inspectKnowledgeWorkspaceRequest({
                        query: String(payload?.query || '').trim(),
                        scope: payload?.scope,
                        queryBackend: payload?.queryBackend,
                    });
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/workspace-readiness'); }
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
            path: api('/workflow-artifacts/review-follow-up'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.executeWorkflowArtifactReviewFollowUp(
                        normalizeWorkflowArtifactReviewFollowUpRequestPayload(JSON.parse(body))
                    );
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/workflow-artifacts/review-follow-up'); }
            },
        },
        {
            method: 'POST',
            path: api('/session/graph-focus-diagnostics'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.recordGraphFocusRenderDiagnostics(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/session/graph-focus-diagnostics'); }
            },
        },
        {
            method: 'POST',
            path: api('/export/workspace'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.buildWorkspaceExportBundle(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/export/workspace'); }
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
            path: api('/quality/baseline'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.setLearningQualityBaseline(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/quality/baseline'); }
            },
        },
        {
            method: 'POST',
            path: api('/quality/baseline/clear'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.clearLearningQualityBaseline(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/quality/baseline/clear'); }
            },
        },
        {
            method: 'POST',
            path: api('/quality/baseline/evaluate'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await knowledgeLearningPlatform.evaluateLearningQualityAgainstBaseline(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/quality/baseline/evaluate'); }
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
                    const payload = JSON.parse(body);
                    const result = runtimeRunbookOps?.recordRemediationEvent
                        ? await runtimeRunbookOps.recordRemediationEvent(
                            payload,
                            String((req as any).requestId || req.headers['x-request-id'] || '')
                        )
                        : await knowledgeLearningPlatform.recordRuntimeCapabilityRemediationEvent(payload);
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
                    const payload = JSON.parse(body);
                    const result = runtimeRunbookOps?.replayRemediationEvent
                        ? await runtimeRunbookOps.replayRemediationEvent(payload)
                        : await knowledgeLearningPlatform.replayRuntimeCapabilityRemediationEvent(payload);
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
                    const payload = JSON.parse(body);
                    const result = runtimeRunbookOps?.updateReplaySchedule
                        ? await runtimeRunbookOps.updateReplaySchedule(payload)
                        : await knowledgeLearningPlatform.updateRuntimeCapabilityReplaySchedule(payload);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'POST /api/knowledge/runtime-capability-runbook/replay-schedule'); }
            },
        },
        {
            method: 'POST',
            path: api('/runtime-capability-runbook/replay-schedule/tick'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = body.trim() ? JSON.parse(body) : {};
                    const result = runtimeRunbookOps?.tickReplaySchedule
                        ? await runtimeRunbookOps.tickReplaySchedule(payload)
                        : await knowledgeLearningPlatform.tickRuntimeCapabilityReplaySchedule();
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

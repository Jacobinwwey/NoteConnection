import * as fs from 'fs';
import * as path from 'path';

describe('Knowledge mastery API contract wiring', () => {
    const serverSource = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
    const knowledgeRoutesSource = fs.readFileSync(path.join(__dirname, 'routes', 'knowledge.ts'), 'utf8');
    const learningApiSource = fs.readFileSync(path.join(__dirname, 'learning', 'api.ts'), 'utf8');
    const learningPlatformSource = fs.readFileSync(
        path.join(__dirname, 'learning', 'KnowledgeLearningPlatform.ts'),
        'utf8'
    );

    test('server exposes planned /api/knowledge endpoints', () => {
        const endpoints = [
            '/api/knowledge/state',
            '/api/knowledge/store-diagnostics',
            '/api/knowledge/store/reload',
            '/api/knowledge/ingest',
            '/api/knowledge/ingest-diff',
            '/api/knowledge/query',
            '/api/knowledge/conversation',
            '/api/knowledge/mastery/diagnose',
            '/api/knowledge/mastery/misconceptions',
            '/api/knowledge/path',
            '/api/knowledge/session/plan',
            '/api/knowledge/session/action',
            '/api/knowledge/session/execute',
            '/api/knowledge/session/history',
            '/api/knowledge/quality/snapshot',
            '/api/knowledge/quality/baseline',
            '/api/knowledge/quality/baseline/clear',
            '/api/knowledge/quality/baseline/evaluate',
            '/api/knowledge/quality/evaluate',
            '/api/knowledge/ingest/guardrails/evaluate',
            '/api/knowledge/tutor/action',
            '/api/knowledge/memory/policy',
        ];

        const aggregatedRouteSource = `${serverSource}\n${knowledgeRoutesSource}`;
        endpoints.forEach((endpoint) => {
            expect(aggregatedRouteSource).toContain(endpoint);
        });
    });

    test('server initializes local knowledge learning platform', () => {
        expect(serverSource).toContain("from './learning'");
        expect(serverSource).toContain('createKnowledgeLearningPlatform');
        expect(serverSource).toContain('createKnowledgeGraphStore');
        expect(serverSource).toContain('createGraphDbSnapshotAdapter');
        expect(serverSource).toContain('knowledgeLearningPlatform');
        expect(serverSource).toContain('KNOWLEDGE_GRAPH_STORE_BACKEND');
    });

    test('learning module declares all required public APIs', () => {
        const requiredInterfaces = [
            'interface KnowledgeIngestAPI',
            'interface KnowledgeQueryAPI',
            'interface MasteryDiagnosticsAPI',
            'interface MasteryMisconceptionAPI',
            'interface LearningPathAPI',
            'interface StudySessionAPI',
            'interface StudySessionHistoryAPI',
            'interface StudySessionActionAPI',
            'interface StudySessionPlanExecutionAPI',
            'interface TutorActionAPI',
            'interface MemoryPolicyAPI',
            'interface LearningQualityGateAPI',
            'interface LearningQualitySnapshotAPI',
            'interface IngestGuardrailAPI',
        ];
        requiredInterfaces.forEach((interfaceName) => {
            expect(learningApiSource).toContain(interfaceName);
        });
    });

    test('modular knowledge routes reference concrete platform methods or live runtime-runbook route ops', () => {
        const platformMethods = [
            'queryMasteryDiagnostics',
            'generateLearningPath',
            'queryKnowledgeQueryBackendComparisonHistory',
            'queryKnowledgeQueryBackendComparisonTrend',
            'getAgentConversationTurnCacheDiagnostics',
            'getAgentConversationTurnCacheTrend',
            'getRuntimeCapabilityMatrix',
            'evaluateIngestGuardrail',
        ];
        platformMethods.forEach((methodName) => {
            expect(knowledgeRoutesSource).toContain(`knowledgeLearningPlatform.${methodName}`);
            expect(learningPlatformSource).toContain(`${methodName}(`);
        });

        const runtimeRunbookOpsMethods = [
            'getRunbook',
            'verify',
            'getHistory',
            'getChecks',
            'getActionQueue',
            'getRemediationHistory',
            'getReplaySchedule',
            'recordRemediationEvent',
            'replayRemediationEvent',
            'updateReplaySchedule',
            'tickReplaySchedule',
        ];
        runtimeRunbookOpsMethods.forEach((methodName) => {
            expect(knowledgeRoutesSource).toContain(`runtimeRunbookOps?.${methodName}`);
        });
    });

    test('runtime runbook modular routes forward live query parameters instead of dropping them', () => {
        [
            "params.get('checkId')",
            "params.get('focus')",
            "params.get('focusLimit')",
            "params.get('sinceMinutes')",
            "params.get('status')",
            "params.get('checkQuery')",
            "params.get('queueLimit')",
            "params.get('priority')",
            "params.get('category')",
            "params.get('remediationStatus')",
            "params.get('remediationTrend')",
            'runtimeRunbookOps?.verify',
            'runtimeRunbookOps?.getChecks',
            'runtimeRunbookOps?.getActionQueue',
        ].forEach((token) => {
            expect(knowledgeRoutesSource).toContain(token);
        });
    });

    test('server escalation fast lane covers the full ANN governance family including prefilter effectiveness', () => {
        [
            "selectedCheckId === 'query_vector_acceleration_index_sync_health'",
            "selectedCheckId === 'query_vector_acceleration_circuit_state'",
            "selectedCheckId === 'query_vector_acceleration_calibration_readiness'",
            "selectedCheckId === 'query_vector_acceleration_traceability'",
            "selectedCheckId === 'query_vector_acceleration_prefilter_effectiveness'",
        ].forEach((token) => {
            expect(serverSource).toContain(token);
        });
    });
});

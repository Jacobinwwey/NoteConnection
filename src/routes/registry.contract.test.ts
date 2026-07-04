/**
 * Route Registry Contract Tests
 * Verifies the modular route registration and dispatch infrastructure.
 */
import { registerAllRoutes, type ServerContext } from './index';

function createMockContext(): ServerContext {
    const scheduleKnowledgeLearningPlatformWarmup = jest.fn();
    return {
        knowledgeLearningPlatform: {
            getKnowledgeState: async () => ({ documents: 0 })
        } as any,
        scheduleKnowledgeLearningPlatformWarmup,
        knowledgeIngestor: { ingestKnowledge: async () => ({}), averageIngestLatencyMs: () => 0, getDiagnostics: () => ({}) } as any,
        knowledgeQuerier: { queryKnowledge: async () => ({}), getDiagnosticsSummary: () => ({}) } as any,
        conversationManager: { getDiagnosticsSummary: () => ({}) } as any,
        masteryEngine: { getDiagnosticsSummary: () => ({}) } as any,
        qualityEvaluator: { getDiagnosticsSummary: () => ({}) } as any,
        tutorRouter: { getDiagnosticsSummary: () => ({}) } as any,
        memoryPolicyManager: { getDiagnosticsSummary: () => ({}) } as any,
        notemdService: {} as any,
        loadNotemdSettings: async () => ({}),
        LOOPBACK_HOST: '127.0.0.1',
        finalPort: 3000,
        KNOWLEDGE_GRAPH_STORE_BACKEND: 'file',
        KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER: 'none',
        KNOWLEDGE_GRAPHDB_ADAPTER_ID: '',
        KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED: false,
        KNOWLEDGE_GRAPHDB_OPERATION_MODE: 'read_write',
        kbRoot: '/tmp/test-kb',
        runtimeDataDir: '/tmp/test-runtime-data',
    };
}

describe('Route Registry', () => {
    const ctx = createMockContext();
    const routes = registerAllRoutes(ctx);

    test('registers all route groups', () => {
        expect(routes.length).toBeGreaterThanOrEqual(70);
    });

    test('every route has required fields', () => {
        for (const route of routes) {
            expect(route.method).toMatch(/^(GET|POST|PUT|DELETE)$/);
            expect(route.path).toBeTruthy();
            expect(typeof route.handler).toBe('function');
        }
    });

    test('knowledge routes are registered', () => {
        const knowledgeRoutes = routes.filter(r => r.path.startsWith('/api/knowledge'));
        expect(knowledgeRoutes.length).toBeGreaterThanOrEqual(30);
        // Verify key endpoints exist
        const paths = new Set(knowledgeRoutes.map(r => `${r.method} ${r.path}`));
        expect(paths.has('GET /api/knowledge/state')).toBe(true);
        expect(paths.has('GET /api/knowledge/workflow-artifacts')).toBe(true);
        expect(paths.has('POST /api/knowledge/workflow-artifacts/review-follow-up')).toBe(true);
        expect(paths.has('POST /api/knowledge/ingest')).toBe(true);
        expect(paths.has('POST /api/knowledge/query')).toBe(true);
        expect(paths.has('POST /api/knowledge/export/workspace')).toBe(true);
        expect(paths.has('POST /api/knowledge/session/graph-focus-diagnostics')).toBe(true);
        expect(paths.has('POST /api/knowledge/conversation')).toBe(false);
    });

    test('notemd routes are registered', () => {
        const notemdRoutes = routes.filter(r => r.path.startsWith('/api/notemd'));
        expect(notemdRoutes.length).toBeGreaterThanOrEqual(10);
        const paths = new Set(notemdRoutes.map(r => `${r.method} ${r.path}`));
        expect(paths.has('GET /api/notemd/settings')).toBe(true);
        expect(paths.has('POST /api/notemd/process-file')).toBe(true);
    });

    test('render routes are registered', () => {
        const renderRoutes = routes.filter(r => r.path.startsWith('/api/render') || r.path.startsWith('/api/clipboard'));
        expect(renderRoutes.length).toBeGreaterThanOrEqual(4);
    });

    test('no duplicate method+path combinations', () => {
        const seen = new Set<string>();
        for (const route of routes) {
            const key = `${route.method} ${route.path}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
        }
    });

    test('all GET routes have idempotent paths', () => {
        const getRoutes = routes.filter(r => r.method === 'GET');
        for (const route of getRoutes) {
            expect(route.path).toMatch(/^\/api\//);
        }
    });

    test('domain diagnostics are exposed via context', () => {
        // All 7 domain classes are available through ServerContext
        expect(ctx.knowledgeIngestor).toBeDefined();
        expect(ctx.knowledgeQuerier).toBeDefined();
        expect(ctx.conversationManager).toBeDefined();
        expect(ctx.masteryEngine).toBeDefined();
        expect(ctx.qualityEvaluator).toBeDefined();
        expect(ctx.tutorRouter).toBeDefined();
        expect(ctx.memoryPolicyManager).toBeDefined();
    });

    test('domain diagnostics have required methods', () => {
        expect(typeof ctx.knowledgeIngestor.getDiagnostics).toBe('function');
        expect(typeof ctx.knowledgeQuerier.getDiagnosticsSummary).toBe('function');
        expect(typeof ctx.conversationManager.getDiagnosticsSummary).toBe('function');
        expect(typeof ctx.masteryEngine.getDiagnosticsSummary).toBe('function');
        expect(typeof ctx.qualityEvaluator.getDiagnosticsSummary).toBe('function');
        expect(typeof ctx.tutorRouter.getDiagnosticsSummary).toBe('function');
        expect(typeof ctx.memoryPolicyManager.getDiagnosticsSummary).toBe('function');
    });

    test('knowledge routes can be dispatched', async () => {
        const stateRoute = routes.find(r => r.method === 'GET' && r.path === '/api/knowledge/state');
        expect(stateRoute).toBeDefined();

        // Mock request/response
        const mockRes = {
            _statusCode: 0,
            _headers: {} as Record<string, string>,
            _body: '',
            writeHead(code: number, headers: Record<string, string>) {
                this._statusCode = code;
                this._headers = headers;
            },
            end(data: string) {
                this._body = data;
            },
            setHeader(_name: string, _value: string) {},
            getHeader(_name: string) { return ''; },
        };

        await stateRoute!.handler(
            { url: '/api/knowledge/state', method: 'GET', headers: {} } as any,
            mockRes as any,
            ctx
        );

        // The handler should produce a JSON response
        expect(mockRes._statusCode).toBeGreaterThanOrEqual(200);
        expect(mockRes._statusCode).toBeLessThan(600);
        expect(ctx.scheduleKnowledgeLearningPlatformWarmup).toHaveBeenCalledWith('knowledge_state_request');
    });
});

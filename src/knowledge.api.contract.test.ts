import * as fs from 'fs';
import * as path from 'path';

describe('Knowledge mastery API contract wiring', () => {
    const serverSource = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
    const learningApiSource = fs.readFileSync(path.join(__dirname, 'learning', 'api.ts'), 'utf8');

    test('server exposes planned /api/knowledge endpoints', () => {
        const endpoints = [
            '/api/knowledge/state',
            '/api/knowledge/store-diagnostics',
            '/api/knowledge/store/reload',
            '/api/knowledge/ingest',
            '/api/knowledge/query',
            '/api/knowledge/mastery/diagnose',
            '/api/knowledge/path',
            '/api/knowledge/tutor/action',
            '/api/knowledge/memory/policy',
        ];

        endpoints.forEach((endpoint) => {
            expect(serverSource).toContain(endpoint);
        });
    });

    test('server initializes local knowledge learning platform', () => {
        expect(serverSource).toContain("from './learning'");
        expect(serverSource).toContain('createKnowledgeLearningPlatform');
        expect(serverSource).toContain('createFileBackedKnowledgeGraphStore');
        expect(serverSource).toContain('knowledgeLearningPlatform');
        expect(serverSource).toContain('KNOWLEDGE_GRAPH_STORE_PATH');
    });

    test('learning module declares all required public APIs', () => {
        const requiredInterfaces = [
            'interface KnowledgeIngestAPI',
            'interface KnowledgeQueryAPI',
            'interface MasteryDiagnosticsAPI',
            'interface LearningPathAPI',
            'interface TutorActionAPI',
            'interface MemoryPolicyAPI',
        ];
        requiredInterfaces.forEach((interfaceName) => {
            expect(learningApiSource).toContain(interfaceName);
        });
    });
});

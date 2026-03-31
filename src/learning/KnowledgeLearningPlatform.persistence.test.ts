import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import { createFileBackedKnowledgeGraphStore } from './store';

describe('KnowledgeLearningPlatform persistence', () => {
    let tempRoot: string;
    let snapshotPath: string;
    let nowIso: string;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'knowledge-platform-'));
        snapshotPath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');
        nowIso = '2026-03-31T10:00:00.000Z';
    });

    afterEach(() => {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('restores ingested graph and learner state from local file store', async () => {
        const store = createFileBackedKnowledgeGraphStore({ filePath: snapshotPath });
        const platformA = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            store,
        });

        const ingestResult = await platformA.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_persist',
                    sourcePath: 'Knowledge_Base/persist.md',
                    language: 'en',
                    content: '# Persistence Layer\nKnowledge graph snapshots should survive restarts.',
                },
            ],
        });
        const atomId = ingestResult.atoms[0]?.id as string;
        expect(atomId).toBeDefined();

        await platformA.diagnoseMastery({
            userId: 'user_persist',
            observations: [
                {
                    atomId,
                    outcome: 'incorrect',
                    errorTag: 'recall_gap',
                },
            ],
        });

        await platformA.applyMemoryPolicy({
            userId: 'user_persist',
            layer: 'session',
            operation: 'write',
            entries: [
                {
                    key: 'persist-note',
                    value: 'Learner missed core definition.',
                    tags: ['misconception'],
                    confidence: 0.8,
                    references: [atomId],
                    createdAt: nowIso,
                    updatedAt: nowIso,
                },
            ],
        });
        await platformA.queryKnowledge({
            query: 'persistence graph snapshots',
            topK: 2,
        });

        expect(fs.existsSync(snapshotPath)).toBe(true);

        nowIso = '2026-03-31T11:00:00.000Z';
        const platformB = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            store: createFileBackedKnowledgeGraphStore({ filePath: snapshotPath }),
        });

        await platformB.ensureReady();
        const state = platformB.getKnowledgeState();
        expect(state.documents).toBe(1);
        expect(state.activeAtoms).toBeGreaterThan(0);
        expect(state.masteryStates).toBeGreaterThan(0);
        expect(state.memoryEntries.session).toBeGreaterThan(0);
        expect(state.retrievalTelemetry.queryCount).toBeGreaterThan(0);

        const queryResult = await platformB.queryKnowledge({
            query: 'persistence snapshots restarts',
            topK: 2,
        });
        expect(queryResult.items.length).toBeGreaterThan(0);

        const storeDiagnostics = await platformB.getStoreDiagnostics();
        expect(storeDiagnostics.storeType).toBe('file');
        expect(storeDiagnostics.exists).toBe(true);
        expect(storeDiagnostics.loaded).toBe(true);

        const restored = await platformB.reloadFromStore();
        expect(restored).toBe(true);
    });
});

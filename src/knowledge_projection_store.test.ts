import * as path from 'path';

const projectionContract = require(path.resolve(__dirname, 'frontend', 'knowledge_projection_contract.js')) as {
    createKnowledgeProjection: (graph: unknown, options?: Record<string, unknown>) => any;
};
const projectionStore = require(path.resolve(__dirname, 'frontend', 'knowledge_projection_store.js')) as {
    createProjectionStore: (options?: Record<string, unknown>) => any;
};
const exactAnalyzer = require(path.resolve(__dirname, 'frontend', 'mobile_exact_analyzer.js')) as {
    createMobileExactIndex: (graph: unknown) => any;
};

function createFixture(): any {
    return projectionContract.createKnowledgeProjection({
        workspaceId: 'fixture-workspace',
        revision: 'sha256:fixture',
        nodes: [
            { id: 'A', label: 'Algebra', sourceUri: 'note://workspace/v1/algebra.md', identityAliases: ['algebra.md'] },
            { id: 'B', label: 'Basics', sourceUri: 'note://workspace/v1/basics.md' },
            { id: 'C', label: 'Calculus', sourceUri: 'note://workspace/v1/calculus.md' },
        ],
        edges: [
            { source: 'A', target: 'B', type: 'explicit-prerequisite', evidenceRefs: ['span:a-b'] },
            { source: 'B', target: 'C', type: 'explicit-prerequisite', evidenceRefs: ['span:b-c'] },
        ],
    });
}

describe('cross-host knowledge projection store', () => {
    test('replays identical schema, metadata, search, neighbors, and path results', async () => {
        const fixture = createFixture();
        let persisted = JSON.stringify(fixture);
        const hostStores = ['web', 'tauri', 'capacitor', 'android'].map((host) => ({
            host,
            store: projectionStore.createProjectionStore({
                read: async () => persisted,
                write: async (serialized: string) => {
                    persisted = serialized;
                },
            }),
        }));

        const baseline = {
            projection: fixture,
            metadata: await hostStores[0].store.metadata(),
            search: exactAnalyzer.createMobileExactIndex(fixture).searchExact('Algebra', 10),
            neighbors: exactAnalyzer.createMobileExactIndex(fixture).neighbors('A', 10),
            path: exactAnalyzer.createMobileExactIndex(fixture).shortestPath('A', 'C', 8, 100),
        };

        for (const { host, store } of hostStores) {
            const projection = await store.load();
            const index = exactAnalyzer.createMobileExactIndex(projection);
            expect(projection).toEqual(baseline.projection);
            expect(await store.metadata()).toEqual(baseline.metadata);
            expect(index.searchExact('Algebra', 10)).toEqual(baseline.search);
            expect(index.neighbors('A', 10)).toEqual(baseline.neighbors);
            expect(index.shortestPath('A', 'C', 8, 100)).toEqual(baseline.path);
            expect(host).toMatch(/web|tauri|capacitor|android/);
        }
    });

    test('keeps a successful in-memory projection available during adapter failure', async () => {
        const fixture = createFixture();
        const store = projectionStore.createProjectionStore({
            read: async () => { throw new Error('storage temporarily unavailable'); },
            initialProjection: fixture,
        });

        await expect(store.load()).resolves.toEqual(fixture);
        await expect(store.metadata()).resolves.toEqual(expect.objectContaining({
            nodeCount: 3,
            edgeCount: 2,
        }));
    });

    test('fails closed on an unknown future schema instead of silently downgrading', async () => {
        const store = projectionStore.createProjectionStore({
            read: async () => JSON.stringify({ schemaVersion: 2, nodes: [], edges: [] }),
        });

        await expect(store.load()).rejects.toThrow(/Unsupported knowledge projection schema version/);
    });
});

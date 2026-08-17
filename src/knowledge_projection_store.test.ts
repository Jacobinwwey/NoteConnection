import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const projectionContract = require(path.resolve(__dirname, 'frontend', 'knowledge_projection_contract.js')) as {
    createKnowledgeProjection: (graph: unknown, options?: Record<string, unknown>) => any;
};
const projectionStore = require(path.resolve(__dirname, 'frontend', 'knowledge_projection_store.js')) as {
    createProjectionStore: (options?: Record<string, unknown>) => any;
    createFileProjectionStore: (options?: Record<string, unknown>) => any;
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

    test('does not hide a corrupt or future projection behind a stale cache', async () => {
        const fixture = createFixture();
        const store = projectionStore.createProjectionStore({
            initialProjection: fixture,
            read: async () => JSON.stringify({ schemaVersion: 2, nodes: [], edges: [] }),
        });

        await expect(store.load()).rejects.toThrow(/Unsupported knowledge projection schema version/);
        await expect(store.metadata()).rejects.toThrow(/Unsupported knowledge projection schema version/);
    });

    test('reopens an app-local file projection with identical analysis results', async () => {
        const fixture = createFixture();
        const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'noteconnection-projection-'));
        const projectionPath = path.join(tempRoot, 'graph_data.json');
        const createStore = () => projectionStore.createFileProjectionStore({
            fileName: projectionPath,
            readFile: async (fileName: string) => await fs.promises.readFile(fileName, 'utf8'),
            writeAtomic: async (fileName: string, serialized: string) => {
                const temporaryPath = `${fileName}.tmp-${process.pid}-${Date.now()}`;
                await fs.promises.writeFile(temporaryPath, serialized, 'utf8');
                await fs.promises.rename(temporaryPath, fileName);
            },
        });

        try {
            const firstStore = createStore();
            expect(firstStore.kind).toBe('file-persistent');
            await firstStore.save(fixture);

            const reopenedStore = createStore();
            const replayed = await reopenedStore.load();
            const baselineIndex = exactAnalyzer.createMobileExactIndex(fixture);
            const replayedIndex = exactAnalyzer.createMobileExactIndex(replayed);

            expect(replayed).toEqual(fixture);
            expect(await reopenedStore.metadata()).toEqual(await firstStore.metadata());
            expect(replayedIndex.searchExact('Algebra', 10)).toEqual(baselineIndex.searchExact('Algebra', 10));
            expect(replayedIndex.neighbors('A', 10)).toEqual(baselineIndex.neighbors('A', 10));
            expect(replayedIndex.shortestPath('A', 'C', 8, 100)).toEqual(
                baselineIndex.shortestPath('A', 'C', 8, 100)
            );
        } finally {
            await fs.promises.rm(tempRoot, { recursive: true, force: true });
        }
    });

    test('keeps the last committed file when an atomic write fails', async () => {
        const fixture = createFixture();
        const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'noteconnection-projection-'));
        const projectionPath = path.join(tempRoot, 'graph_data.json');
        let failWrites = false;
        const createStore = () => projectionStore.createFileProjectionStore({
            fileName: projectionPath,
            readFile: async (fileName: string) => await fs.promises.readFile(fileName, 'utf8'),
            writeAtomic: async (fileName: string, serialized: string) => {
                if (failWrites) {
                    throw new Error('storage unavailable');
                }
                const temporaryPath = `${fileName}.tmp-${process.pid}-${Date.now()}`;
                await fs.promises.writeFile(temporaryPath, serialized, 'utf8');
                await fs.promises.rename(temporaryPath, fileName);
            },
        });

        try {
            const committedStore = createStore();
            await committedStore.save(fixture);
            failWrites = true;
            await expect(committedStore.save({ ...fixture, revision: 'sha256:next' })).rejects.toThrow(/storage unavailable/);

            const reopenedStore = createStore();
            await expect(reopenedStore.load()).resolves.toEqual(fixture);
        } finally {
            await fs.promises.rm(tempRoot, { recursive: true, force: true });
        }
    });

    test('rejects truncated app-local files instead of replaying partial JSON', async () => {
        const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'noteconnection-projection-'));
        const projectionPath = path.join(tempRoot, 'graph_data.json');
        try {
            await fs.promises.writeFile(projectionPath, '{"schemaVersion":1,"nodes":[', 'utf8');
            const store = projectionStore.createFileProjectionStore({
                fileName: projectionPath,
                readFile: async (fileName: string) => await fs.promises.readFile(fileName, 'utf8'),
            });

            await expect(store.load()).rejects.toThrow(/Knowledge projection JSON is invalid/);
        } finally {
            await fs.promises.rm(tempRoot, { recursive: true, force: true });
        }
    });

    test('rejects an incomplete app-local adapter instead of silently switching to memory', () => {
        expect(() => projectionStore.createFileProjectionStore({
            fileName: 'graph_data.json',
        })).toThrow(/readFile adapter is required/);
        expect(() => projectionStore.createFileProjectionStore({
            fileName: 'graph_data.json',
            readFile: async () => '',
            write: async () => undefined,
        })).toThrow(/must use the writeAtomic adapter/);
    });
});

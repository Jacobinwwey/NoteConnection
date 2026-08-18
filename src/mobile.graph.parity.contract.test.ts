import * as path from 'path';
import * as vm from 'vm';

describe('Capacitor mobile graph edge contract', () => {
    const modulePath = path.resolve(__dirname, 'frontend', 'storage_provider.js');
    type GraphBuilder = (files: unknown[]) => {
        nodes: Array<Record<string, unknown>>;
        edges: Array<Record<string, unknown>>;
    };
    type WorkerSourceFactory = () => string;
    let graphBuilder: GraphBuilder;
    let workerSourceFactory: WorkerSourceFactory;

    beforeAll(() => {
        const runtimeGlobal = globalThis as unknown as Record<string, unknown>;
        runtimeGlobal.window = {};
        runtimeGlobal.NoteConnectionMobileIdentity = require(
            path.resolve(__dirname, 'frontend', 'mobile_identity_contract.js')
        );
        const providerModule = require(modulePath) as {
            buildCapacitorGraphData: (files: unknown[]) => {
                nodes: Array<Record<string, unknown>>;
                edges: Array<Record<string, unknown>>;
            };
            getCapacitorGraphBuildWorkerSource: WorkerSourceFactory;
        };
        graphBuilder = providerModule.buildCapacitorGraphData;
        workerSourceFactory = providerModule.getCapacitorGraphBuildWorkerSource;
    });

    afterAll(() => {
        const runtimeGlobal = globalThis as unknown as Record<string, unknown>;
        delete runtimeGlobal.window;
        delete runtimeGlobal.NoteConnectionMobileIdentity;
        jest.resetModules();
    });

    test('uses source-to-target orientation and carries portable edge endpoints', () => {
        const graph = graphBuilder([
            {
                id: 'base',
                label: 'Base',
                path: 'financial/base.md',
                sourceUri: 'note://workspace/v1/financial/base.md',
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Base',
            },
            {
                id: 'intro',
                label: 'Intro',
                path: 'financial/intro.md',
                sourceUri: 'note://workspace/v1/financial/intro.md',
                metadata: { tags: [], prerequisites: ['base'], next: [] },
                content: '# Intro\n[[advanced]]',
            },
            {
                id: 'advanced',
                label: 'Advanced',
                path: 'financial/advanced.md',
                sourceUri: 'note://workspace/v1/financial/advanced.md',
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Advanced',
            },
        ]);

        expect(graph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({
                source: 'base',
                target: 'intro',
                sourceUri: 'note://workspace/v1/financial/base.md',
                targetUri: 'note://workspace/v1/financial/intro.md',
                type: 'explicit-prerequisite',
            }),
            expect.objectContaining({
                source: 'intro',
                target: 'advanced',
                sourceUri: 'note://workspace/v1/financial/intro.md',
                targetUri: 'note://workspace/v1/financial/advanced.md',
                type: 'wiki-link',
            }),
        ]));
        expect(graph.edges).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'advanced', target: 'intro', type: 'wiki-link' }),
        ]));
    });

    test('retains a path-derived canonical id alongside the legacy public id', () => {
        const graph = graphBuilder([
            {
                id: 'Index',
                canonicalId: 'algebra/index',
                label: 'Index',
                path: 'algebra/index.md',
                sourceUri: 'note://workspace/v1/algebra/index.md',
                identityAliases: ['Index', 'algebra/index.md'],
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Index',
            },
        ]);

        expect(graph.nodes[0]).toEqual(expect.objectContaining({
            id: 'Index',
            canonicalId: 'algebra/index',
        }));
    });

    test('resolves nested relative and markdown links by canonical path', () => {
        const graph = graphBuilder([
            {
                id: 'base',
                canonicalId: 'shared/base',
                path: 'Knowledge_Base/shared/base.md',
                sourceUri: 'note://workspace/v1/shared/base.md',
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Base',
            },
            {
                id: 'intro',
                canonicalId: 'algebra/intro',
                path: 'Knowledge_Base/algebra/intro.md',
                sourceUri: 'note://workspace/v1/algebra/intro.md',
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Intro\n[base](../shared/base.md)',
            },
        ]);

        expect(graph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({
                source: 'intro',
                target: 'base',
                type: 'markdown-link',
                sourceUri: 'note://workspace/v1/algebra/intro.md',
                targetUri: 'note://workspace/v1/shared/base.md',
            }),
        ]));
    });

    test('fails closed when legacy basenames are ambiguous across directories', () => {
        expect(() => graphBuilder([
            {
                id: 'index',
                canonicalId: 'algebra/index',
                path: 'Knowledge_Base/algebra/index.md',
                sourceUri: 'note://workspace/v1/algebra/index.md',
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Algebra',
            },
            {
                id: 'INDEX',
                canonicalId: 'physics/index',
                path: 'Knowledge_Base/physics/index.md',
                sourceUri: 'note://workspace/v1/physics/index.md',
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Physics',
            },
        ])).toThrow(/ambiguous legacy basename/i);
    });

    test('keeps worker and single-thread resolution equivalent for sourceUri-only files', () => {
        const files = [
            {
                id: 'base',
                sourceUri: 'note://workspace/v1/shared/base.md',
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Base',
            },
            {
                id: 'intro',
                sourceUri: 'note://workspace/v1/algebra/intro.md',
                metadata: { tags: [], prerequisites: [], next: [] },
                content: '# Intro\n[base](../shared/base.md)',
            },
        ];
        const singleThreadGraph = graphBuilder(files.map((file) => ({
            ...file,
            metadata: { ...file.metadata },
        })));
        expect(files[0]).not.toHaveProperty('__canonicalId');
        const messages: Array<{ ok: boolean; graphData?: unknown; error?: string }> = [];
        const context = {
            self: {
                postMessage(message: { ok: boolean; graphData?: unknown; error?: string }) {
                    messages.push(message);
                },
            },
        };
        vm.runInNewContext(workerSourceFactory(), context);
        (context.self as unknown as { onmessage: (event: { data: { files: unknown[] } }) => void }).onmessage({
            data: { files },
        });

        expect(messages).toHaveLength(1);
        expect(messages[0].ok).toBe(true);
        expect(messages[0].error).toBeUndefined();
        expect(messages[0].graphData).toEqual(singleThreadGraph);
    });
});

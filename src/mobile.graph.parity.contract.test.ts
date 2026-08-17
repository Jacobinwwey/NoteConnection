import * as path from 'path';

describe('Capacitor mobile graph edge contract', () => {
    const modulePath = path.resolve(__dirname, 'frontend', 'storage_provider.js');
    type GraphBuilder = (files: unknown[]) => {
        nodes: Array<Record<string, unknown>>;
        edges: Array<Record<string, unknown>>;
    };
    let graphBuilder: GraphBuilder;

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
        };
        graphBuilder = providerModule.buildCapacitorGraphData;
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
});

import * as path from 'path';

// The analyzer is deliberately a browser-compatible CommonJS/IIFE artifact so
// the same projection can be replayed in Capacitor and the desktop test runner.
const analyzer = require(path.resolve(__dirname, 'frontend', 'mobile_exact_analyzer.js')) as {
    createMobileExactIndex: (graph: unknown) => any;
};

describe('mobile exact projection contract', () => {
    test('indexes stable URI aliases and separates explicit from inferred edges', () => {
        const index = analyzer.createMobileExactIndex({
            nodes: [
                {
                    id: 'Legacy A',
                    label: 'A',
                    sourceUri: 'note://workspace/v1/a.md',
                    identityAliases: ['a.md'],
                    metadata: { tags: ['algebra'] },
                },
                { id: 'B', label: 'B' },
            ],
            edges: [
                { source: 'Legacy A', target: 'B', type: 'explicit-prerequisite' },
                { source: 'B', target: 'Legacy A', type: 'vector-association' },
            ],
        });

        expect(index.searchExact('note://workspace/v1/a.md', 5)[0]).toEqual(expect.objectContaining({
            id: 'Legacy A',
            sourceUri: 'note://workspace/v1/a.md',
        }));
        expect(index.neighbors('note://workspace/v1/a.md', 5, ['explicit'])).toEqual([
            expect.objectContaining({ id: 'B', edgeKind: 'explicit' }),
        ]);
        expect(index.statistics({ includeProvenance: true })).toEqual(expect.objectContaining({
            projectionVersion: 1,
            edgeCount: 2,
            explicitEdgeCount: 1,
            inferredEdgeCount: 1,
        }));
    });

    test('resolves a source URI in bounded path queries', () => {
        const index = analyzer.createMobileExactIndex({
            nodes: [
                { id: 'A', sourceUri: 'note://workspace/v1/a.md' },
                { id: 'B', sourceUri: 'note://workspace/v1/b.md' },
            ],
            edges: [{ source: 'A', target: 'B', type: 'sequence' }],
        });

        expect(index.shortestPath(
            'note://workspace/v1/a.md',
            'note://workspace/v1/b.md',
            4,
            10,
        )).toEqual(['A', 'B']);
    });

    test('resolves a path-derived canonical id without changing the legacy node id', () => {
        const index = analyzer.createMobileExactIndex({
            nodes: [{ id: 'Index', canonicalId: 'algebra/index', label: 'Index' }],
            edges: [],
        });

        expect(index.searchExact('algebra/index', 5)).toEqual([
            expect.objectContaining({ id: 'Index', canonicalId: 'algebra/index' }),
        ]);
    });

    test('builds a bounded prerequisite-aware learning route from explicit graph edges', () => {
        const index = analyzer.createMobileExactIndex({
            nodes: [
                { id: 'water', label: 'Water molecules' },
                { id: 'ice', label: 'Amorphous ice' },
                { id: 'rdf', label: 'Radial distribution function g(r)' },
                { id: 'application', label: 'Applications' },
            ],
            edges: [
                { source: 'water', target: 'ice', type: 'explicit-prerequisite' },
                { source: 'ice', target: 'rdf', type: 'sequence' },
                { source: 'ice', target: 'application', type: 'application' },
            ],
        });

        expect(index.learningRoute('ice', 6)).toEqual([
            expect.objectContaining({ nodeId: 'water', role: 'prerequisite', order: 1, orderingBasis: 'explicit_prerequisite' }),
            expect.objectContaining({ nodeId: 'ice', role: 'core', order: 2 }),
            expect.objectContaining({ nodeId: 'rdf', role: 'mechanism', order: 3 }),
            expect.objectContaining({ nodeId: 'application', role: 'application', order: 4 }),
        ]);
        expect(index.learningRoute('ice', 2)).toHaveLength(2);
    });
});

import {
    createResourceIdentity,
    assertUniqueLegacyResourceIds,
    normalizeResourceRelativePath,
} from './backend/ResourceIdentity';
import { Graph } from './core/Graph';

describe('mobile identity migration corpus', () => {
    test('keeps same-content documents isolated while preserving cross-root identity', () => {
        const first = createResourceIdentity('notes/first.md', 'First', 'same body');
        const second = createResourceIdentity('notes/second.md', 'Second', 'same body');
        const fromWindows = createResourceIdentity(
            normalizeResourceRelativePath('C:\\workspace\\Knowledge_Base', 'C:\\workspace\\Knowledge_Base\\Notes\\Cafe\u0301.md'),
            'Cafe',
            'body',
        );
        const fromPosix = createResourceIdentity('notes/caf\u00e9.md', 'Cafe', 'body');

        expect(first.revision).toBe(second.revision);
        expect(first.sourceUri).not.toBe(second.sourceUri);
        expect(fromWindows.sourceUri).toBe(fromPosix.sourceUri);
        expect(fromWindows.revision).toBe(fromPosix.revision);
    });

    test('rejects NFC/case collisions before graph mutation', () => {
        expect(() => assertUniqueLegacyResourceIds([
            { filename: 'Cafe\u0301', filepath: 'one/Cafe\u0301.md' },
            { filename: 'Caf\u00e9', filepath: 'two/Caf\u00e9.md' },
        ])).toThrow(/ambiguous|duplicate/i);
    });

    test('replays a legacy snapshot and rolls back a corrupt candidate atomically', () => {
        const graph = Graph.fromJSON({
            nodes: [
                { id: 'legacy-a', label: 'A', inDegree: 0, outDegree: 1 },
                { id: 'legacy-b', label: 'B', inDegree: 1, outDegree: 0 },
            ],
            edges: [{ source: 'legacy-a', target: 'legacy-b', type: 'legacy-link', weight: 1 }],
        });

        expect(graph.getOutgoingEdges('legacy-a')).toEqual([
            { source: 'legacy-a', target: 'legacy-b', type: 'legacy-link', weight: 1 },
        ]);
        expect(() => graph.restore({
            nodes: [{ id: 'candidate', label: 'Candidate' }],
            edges: [{ source: 'candidate', target: 'missing' }],
        })).toThrow(/undeclared node/i);
        expect(graph.hasNode('legacy-a')).toBe(true);
        expect(graph.hasNode('candidate')).toBe(false);
    });
});

import * as path from 'path';

const contract = require(path.resolve(__dirname, 'frontend', 'knowledge_projection_contract.js')) as {
    schemaVersion: number;
    createKnowledgeProjection: (graph: unknown, options?: Record<string, unknown>) => any;
    replayKnowledgeProjection: (payload: unknown) => any;
};

describe('versioned knowledge projection contract', () => {
    test('creates a body-free projection with identity, provenance, evidence, and bounded adjacency', () => {
        const projection = contract.createKnowledgeProjection({
            nodes: [
                {
                    id: 'Legacy A',
                    label: 'A',
                    content: 'must not be persisted',
                    sourceUri: 'note://workspace/v1/a.md',
                    revision: 'sha256:abc',
                    identityAliases: ['a.md'],
                    evidenceRefs: ['span:1'],
                    metadata: { tags: ['algebra'] },
                },
                { id: 'B', label: 'B' },
            ],
            edges: [
                { source: 'Legacy A', target: 'B', type: 'explicit-prerequisite', evidenceRefs: ['span:2'] },
            ],
        }, { workspaceId: 'mobile-workspace', maxNeighbors: 1 });

        expect(projection).toEqual(expect.objectContaining({
            schemaVersion: 1,
            projectionVersion: 1,
            workspaceId: 'mobile-workspace',
        }));
        expect(projection.nodes[0]).toEqual(expect.objectContaining({
            sourceUri: 'note://workspace/v1/a.md',
            revision: 'sha256:abc',
            evidenceRefs: ['span:1'],
            tags: ['algebra'],
        }));
        expect(projection.nodes[0].content).toBeUndefined();
        expect(projection.edges[0]).toEqual(expect.objectContaining({
            kind: 'explicit',
            provenance: 'explicit-prerequisite',
            sourceUri: 'note://workspace/v1/a.md',
            targetUri: '',
            evidenceRefs: ['span:2'],
        }));
        expect(projection.adjacency).toEqual(expect.arrayContaining([
            expect.objectContaining({ nodeId: 'Legacy A', outgoing: ['B'] }),
        ]));
    });

    test('replays the same serialized projection and rejects unknown future schemas', () => {
        const projection = contract.createKnowledgeProjection({
            nodes: [{ id: 'A', sourceUri: 'note://workspace/v1/a.md' }],
            edges: [],
        });
        const replayed = contract.replayKnowledgeProjection(JSON.stringify(projection));
        expect(replayed).toEqual(projection);
        expect(() => contract.replayKnowledgeProjection({ schemaVersion: contract.schemaVersion + 1, nodes: [], edges: [] }))
            .toThrow(/Unsupported knowledge projection schema version/);
        expect(() => contract.replayKnowledgeProjection({ schemaVersion: 0, nodes: [], edges: [] }))
            .toThrow(/Unsupported knowledge projection schema version/);
    });

    test('preserves graph-level identity metadata when no override is supplied', () => {
        const projection = contract.createKnowledgeProjection({
            workspaceId: 'source-workspace',
            revision: 'sha256:graph',
            nodes: [{ id: 'A' }],
            edges: [],
        });

        expect(projection.workspaceId).toBe('source-workspace');
        expect(projection.revision).toBe('sha256:graph');
    });

    test('fails closed on normalized identity collisions and invalid edge endpoints', () => {
        expect(() => contract.createKnowledgeProjection({
            nodes: [{ id: 'A' }, { id: 'a' }],
            edges: [],
        })).toThrow(/duplicate node id/i);
        expect(() => contract.createKnowledgeProjection({
            nodes: [{ id: 'A' }],
            edges: [{ source: 'A', target: 'missing', type: 'explicit-next' }],
        })).toThrow(/invalid node/i);
        expect(() => contract.createKnowledgeProjection({
            nodes: [
                { id: 'A', canonicalId: 'notes/a' },
                { id: 'B', canonicalId: 'NOTES/A' },
            ],
            edges: [],
        })).toThrow(/duplicate canonical node id/i);
    });
});

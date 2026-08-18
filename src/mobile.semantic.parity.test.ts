import * as path from 'path';

const comparator = require(path.resolve(__dirname, 'frontend', 'mobile_semantic_comparator.js')) as {
    compareSemanticProjections: (left: unknown, right: unknown) => { equal: boolean; extraEdges: string[] };
    assertSemanticParity: (left: unknown, right: unknown, label?: string) => unknown;
};
const projectionContract = require(path.resolve(__dirname, 'frontend', 'knowledge_projection_contract.js')) as {
    createKnowledgeProjection: (graph: unknown) => any;
};

describe('cross-host mobile semantic parity', () => {
    test('matches canonical nodes and directed edge provenance across host-specific ids', () => {
        const left = projectionContract.createKnowledgeProjection({
            nodes: [
                { id: 'base', canonicalId: 'financial/base', sourceUri: 'note://workspace/v1/financial/base.md' },
                { id: 'intro', canonicalId: 'financial/intro', sourceUri: 'note://workspace/v1/financial/intro.md' },
            ],
            edges: [{
                source: 'base',
                target: 'intro',
                sourceUri: 'note://workspace/v1/financial/base.md',
                targetUri: 'note://workspace/v1/financial/intro.md',
                type: 'explicit-prerequisite',
                kind: 'explicit',
                provenance: 'explicit-prerequisite',
            }],
        });
        const right = projectionContract.createKnowledgeProjection({
            nodes: [
                { id: 'financial/base', canonicalId: 'financial/base', sourceUri: 'note://workspace/v1/financial/base.md' },
                { id: 'financial/intro', canonicalId: 'financial/intro', sourceUri: 'note://workspace/v1/financial/intro.md' },
            ],
            edges: [{
                source: 'financial/base',
                target: 'financial/intro',
                type: 'explicit-prerequisite',
                kind: 'explicit',
                provenance: 'explicit-prerequisite',
            }],
        });

        expect(comparator.compareSemanticProjections(left, right).equal).toBe(true);
        expect(() => comparator.assertSemanticParity(left, right, 'fixture')).not.toThrow();
    });

    test('reports provenance changes instead of collapsing same-endpoint edges', () => {
        const left = {
            nodes: [
                { id: 'a', canonicalId: 'a', sourceUri: 'note://workspace/v1/a.md' },
                { id: 'b', canonicalId: 'b', sourceUri: 'note://workspace/v1/b.md' },
            ],
            edges: [{ source: 'a', target: 'b', type: 'wiki-link', provenance: 'wiki-link' }],
        };
        const right = {
            nodes: [
                { id: 'a', canonicalId: 'a', sourceUri: 'note://workspace/v1/a.md' },
                { id: 'b', canonicalId: 'b', sourceUri: 'note://workspace/v1/b.md' },
            ],
            edges: [{ source: 'a', target: 'b', type: 'markdown-link', provenance: 'markdown-link' }],
        };

        const comparison = comparator.compareSemanticProjections(left, right);
        expect(comparison.equal).toBe(false);
        expect(comparison.extraEdges.length).toBeGreaterThan(0);
        expect(() => comparator.assertSemanticParity(left, right, 'provenance')).toThrow(/semantic projection parity failed/);
    });
});

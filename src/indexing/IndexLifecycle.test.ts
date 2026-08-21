import { IndexLifecycle } from './IndexLifecycle';
import type { KnowledgeAtom } from '../learning/types';

describe('IndexLifecycle', () => {
    test('indexes document and atom units, then retires them by document', () => {
        let idCounter = 0;
        const lifecycle = new IndexLifecycle(
            (prefix = 'index') => `${prefix}_${++idCounter}`,
            (value) => `hash_${value.length}`
        );
        const atom: KnowledgeAtom = {
            id: 'atom_1',
            stableKey: 'doc_a::intro',
            documentId: 'doc_a',
            sourcePath: 'Knowledge_Base/optics/doc_a.md',
            title: 'Intro',
            content: 'Absorption affects transmitted intensity.',
            representationType: 'text',
            keywords: ['absorption', 'intensity'],
            evidenceSpanIds: ['evidence_1'],
            createdAt: '2026-05-26T00:00:00.000Z',
            updatedAt: '2026-05-26T00:00:00.000Z',
            metadata: {
                sectionPath: ['Intro'],
                version: 1,
                sourceHash: 'hash_doc_a',
                language: 'en',
            },
        };

        const indexed = lifecycle.syncDocumentIndex({
            resourceId: 'resource_1',
            projectionId: 'projection_1',
            documentId: 'doc_a',
            sourcePath: 'Knowledge_Base/optics/doc_a.md',
            language: 'en',
            workspaceId: 'optics',
            corpusId: 'optics',
            title: 'doc_a',
            content: '# Intro\nAbsorption affects transmitted intensity.',
            atoms: [atom],
            indexedAt: '2026-05-26T00:00:00.000Z',
        });

        expect(indexed.units.length).toBeGreaterThan(0);
        expect(indexed.segments.length).toBeGreaterThan(0);
        expect(lifecycle.hasIndexedSegmentsForAtom('atom_1')).toBe(true);
        expect(lifecycle.listUnitsByProjectionIds(['projection_1']).length).toBe(indexed.units.length);
        expect(lifecycle.listSegmentsByUnitIds(indexed.units.map((unit) => unit.unitId)).length).toBe(indexed.segments.length);

        lifecycle.retireDocumentIndex('doc_a');
        expect(lifecycle.hasIndexedSegmentsForAtom('atom_1')).toBe(false);
        expect(lifecycle.buildSummary().totalUnits).toBe(0);
    });

    test('updates indexed source paths in place during a document move', () => {
        let idCounter = 0;
        const lifecycle = new IndexLifecycle(
            (prefix = 'index') => `${prefix}_${++idCounter}`,
            (value) => `hash_${value.length}`
        );
        const indexed = lifecycle.syncDocumentIndex({
            resourceId: 'resource_move',
            projectionId: 'projection_move',
            documentId: 'doc_move',
            sourcePath: 'Knowledge_Base/old.md',
            language: 'en',
            workspaceId: 'workspace',
            corpusId: 'corpus',
            title: 'old',
            content: '# Move\nContent',
            atoms: [],
            indexedAt: '2026-05-26T06:00:00.000Z',
        });

        expect(lifecycle.updateDocumentSourcePath(
            'doc_move',
            'Knowledge_Base/new.md',
            '2026-05-26T07:00:00.000Z',
        )).toBe(indexed.units.length);
        expect(lifecycle.listUnitsByProjectionIds(['projection_move'])).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    sourcePath: 'Knowledge_Base/new.md',
                    updatedAt: '2026-05-26T07:00:00.000Z',
                }),
            ])
        );
    });
});

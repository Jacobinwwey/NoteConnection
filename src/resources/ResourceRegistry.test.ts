import { ResourceRegistry } from './ResourceRegistry';

describe('ResourceRegistry', () => {
    test('reuses resource ids by source hash and exposes stable projection lookups', () => {
        let idCounter = 0;
        const registry = new ResourceRegistry((prefix = 'resource') => `${prefix}_${++idCounter}`);

        const first = registry.upsertKnowledgeDocument({
            documentId: 'doc_a',
            sourcePath: 'Knowledge_Base/optics/doc_a.md',
            content: '# A\ncontent',
            sourceHash: 'hash_a',
            title: 'doc_a',
            language: 'en',
            version: 1,
            workspaceId: 'optics',
            corpusId: 'optics',
            updatedAt: '2026-05-26T00:00:00.000Z',
        });
        const second = registry.upsertKnowledgeDocument({
            documentId: 'doc_a',
            sourcePath: 'Knowledge_Base/optics/doc_a.md',
            content: '# A\ncontent updated',
            sourceHash: 'hash_a',
            title: 'doc_a',
            language: 'en',
            version: 2,
            workspaceId: 'optics',
            corpusId: 'optics',
            updatedAt: '2026-05-26T01:00:00.000Z',
        });

        expect(second.resource.resourceId).toBe(first.resource.resourceId);
        expect(second.projection.projectionId).toBe(first.projection.projectionId);
        expect(registry.getProjectionByDocumentId('doc_a')?.projectionId).toBe(first.projection.projectionId);
        expect(registry.listResourcesByIds([first.resource.resourceId])).toHaveLength(1);
        expect(registry.listProjectionsByIds([first.projection.projectionId])).toHaveLength(1);
    });

    test('marks document projections deleted and restores from snapshot', () => {
        let idCounter = 0;
        const registry = new ResourceRegistry((prefix = 'resource') => `${prefix}_${++idCounter}`);
        const created = registry.upsertKnowledgeDocument({
            documentId: 'doc_delete',
            sourcePath: 'Knowledge_Base/chem/doc_delete.md',
            content: '# Delete\ncontent',
            sourceHash: 'hash_delete',
            title: 'doc_delete',
            language: 'en',
            version: 1,
            workspaceId: 'chem',
            corpusId: 'chem',
            updatedAt: '2026-05-26T02:00:00.000Z',
        });

        registry.markDocumentProjectionDeleted('doc_delete', '2026-05-26T03:00:00.000Z');
        expect(registry.getProjectionByDocumentId('doc_delete')?.status).toBe('deleted');
        expect(registry.getResourceById(created.resource.resourceId)?.status).toBe('deleted');

        const restored = new ResourceRegistry((prefix = 'resource') => `${prefix}_${++idCounter}`);
        restored.restoreFromSnapshot(registry.buildSnapshot());
        expect(restored.getProjectionByDocumentId('doc_delete')?.status).toBe('deleted');
        expect(restored.listProjectionsByIds([created.projection.projectionId], { includeDeleted: true })).toHaveLength(1);
    });

    test('mirrors a document move without changing resource or projection identity', () => {
        let idCounter = 0;
        const registry = new ResourceRegistry((prefix = 'resource') => `${prefix}_${++idCounter}`);
        const created = registry.upsertKnowledgeDocument({
            documentId: 'doc_move',
            sourcePath: 'Knowledge_Base/old.md',
            content: '# Move',
            sourceHash: 'hash_move',
            title: 'old',
            language: 'en',
            version: 1,
            updatedAt: '2026-05-26T04:00:00.000Z',
            metadata: { sourceUri: 'note://workspace/v1/old.md' },
        });

        expect(registry.updateKnowledgeDocumentIdentity({
            documentId: 'doc_move',
            sourcePath: 'Knowledge_Base/new.md',
            sourceUri: 'note://workspace/v1/new.md',
            revision: 'sha256:new',
            identityAliases: ['old.md', 'Knowledge_Base/new.md'],
            updatedAt: '2026-05-26T05:00:00.000Z',
        })).toBe(true);

        expect(registry.getProjectionByDocumentId('doc_move')).toEqual(expect.objectContaining({
            projectionId: created.projection.projectionId,
            sourcePath: 'Knowledge_Base/new.md',
            metadata: expect.objectContaining({
                sourceUri: 'note://workspace/v1/new.md',
                revision: 'sha256:new',
                identityAliases: ['old.md', 'Knowledge_Base/new.md'],
            }),
        }));
        expect(registry.getResourceById(created.resource.resourceId)).toEqual(expect.objectContaining({
            resourceId: created.resource.resourceId,
            sourcePath: 'Knowledge_Base/new.md',
        }));
    });
});

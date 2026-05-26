import { WorkspaceRegistry } from './WorkspaceRegistry';

describe('WorkspaceRegistry', () => {
    test('ensures workspace from source path and exposes bindings by workspace and document', () => {
        let idCounter = 0;
        const registry = new WorkspaceRegistry((prefix = 'workspace') => `${prefix}_${++idCounter}`);

        const workspace = registry.ensureWorkspace({
            sourcePath: 'Knowledge_Base/optics/absorption.md',
            language: 'zh',
            exportProfileId: 'mobile-slim',
            createdAt: '2026-05-26T00:00:00.000Z',
        });
        expect(workspace.workspaceId).toBe('optics');
        expect(workspace.exportProfileId).toBe('mobile-slim');

        const binding = registry.bindProjection({
            workspaceId: workspace.workspaceId,
            corpusId: workspace.corpusId,
            resourceId: 'resource_1',
            projectionId: 'projection_1',
            documentId: 'doc_optics',
            sourcePath: 'Knowledge_Base/optics/absorption.md',
            boundAt: '2026-05-26T00:01:00.000Z',
        });
        expect(registry.resolveBindingByDocumentId('doc_optics')).toEqual(binding);
        expect(registry.getWorkspaceById('optics')).toEqual(workspace);
        expect(registry.listBindingsByWorkspace('optics')).toHaveLength(1);
    });
});

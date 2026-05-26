import { WorkflowArtifactStore } from './WorkflowArtifactStore';

describe('WorkflowArtifactStore', () => {
    test('records artifacts and lists them by session and workspace', () => {
        let idCounter = 0;
        const store = new WorkflowArtifactStore((prefix = 'workflow_artifact') => `${prefix}_${++idCounter}`);

        const artifact = store.recordArtifact({
            kind: 'research_report',
            sessionId: 'session_a',
            userId: 'user_a',
            workspaceId: 'optics',
            corpusId: 'optics',
            title: 'Grounded answer',
            sourceResourceIds: ['resource_1'],
            sourceProjectionIds: ['projection_1'],
            summary: 'Answer summary',
            payload: {
                citations: 2,
            },
            status: 'active',
            recordedAt: '2026-05-26T00:00:00.000Z',
        });

        expect(store.listBySession('session_a')).toEqual([artifact]);
        expect(store.listByWorkspace('optics')).toHaveLength(1);

        const restored = new WorkflowArtifactStore((prefix = 'workflow_artifact') => `${prefix}_${++idCounter}`);
        restored.restoreFromSnapshot(store.buildSnapshot());
        expect(restored.listByWorkspace('optics')[0]?.artifactId).toBe(artifact.artifactId);
    });
});

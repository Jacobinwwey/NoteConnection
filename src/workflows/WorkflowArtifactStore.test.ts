import { WorkflowArtifactStore } from './WorkflowArtifactStore';

describe('WorkflowArtifactStore', () => {
    test('records artifacts and lists them by session and workspace', () => {
        let idCounter = 0;
        const store = new WorkflowArtifactStore((prefix = 'workflow_artifact') => `${prefix}_${++idCounter}`);

        const artifact = store.recordArtifact({
            kind: 'knowledge_run',
            sessionId: 'session_a',
            userId: 'user_a',
            workspaceId: 'optics',
            corpusId: 'optics',
            title: 'Knowledge run',
            sourceResourceIds: ['resource_1'],
            sourceProjectionIds: ['projection_1'],
            summary: 'Evidence claims recorded',
            payload: {
                knowledgeRun: {
                    runId: 'knowledge_run_1',
                },
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

    test('updates persisted artifacts without exposing mutable internal references', () => {
        let idCounter = 0;
        const store = new WorkflowArtifactStore((prefix = 'workflow_artifact') => `${prefix}_${++idCounter}`);

        const artifact = store.recordArtifact({
            kind: 'flashcard_batch',
            sessionId: 'session_b',
            userId: 'user_b',
            workspaceId: 'optics',
            corpusId: 'optics',
            title: 'Review batch',
            sourceResourceIds: ['resource_2'],
            sourceProjectionIds: ['projection_2'],
            summary: 'Prepared 1 review card.',
            payload: {
                reviewState: {
                    consumedCardIds: [],
                    completedReviewCardCount: 0,
                    remainingReviewCardCount: 1,
                    completedAt: null,
                },
            },
            status: 'active',
            recordedAt: '2026-05-26T01:00:00.000Z',
        });

        const updated = store.updateArtifact(artifact.artifactId, (current) => ({
            ...current,
            status: 'archived',
            updatedAt: '2026-05-26T01:05:00.000Z',
            payload: {
                ...current.payload,
                reviewState: {
                    consumedCardIds: ['card_1'],
                    completedReviewCardCount: 1,
                    remainingReviewCardCount: 0,
                    completedAt: '2026-05-26T01:05:00.000Z',
                },
            },
        }));

        expect(updated).not.toBeNull();
        expect(updated?.status).toBe('archived');
        expect((updated?.payload.reviewState as any).consumedCardIds).toEqual(['card_1']);

        const fetched = store.getArtifactById(artifact.artifactId);
        expect(fetched?.status).toBe('archived');
        expect((fetched?.payload.reviewState as any).remainingReviewCardCount).toBe(0);

        (updated?.payload.reviewState as any).consumedCardIds.push('card_2');
        const refetched = store.getArtifactById(artifact.artifactId);
        expect((refetched?.payload.reviewState as any).consumedCardIds).toEqual(['card_1']);
    });
});

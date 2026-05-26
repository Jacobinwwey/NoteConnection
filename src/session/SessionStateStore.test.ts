import { SessionStateStore } from './SessionStateStore';

describe('SessionStateStore', () => {
    test('upserts session state and lists by workspace', () => {
        let idCounter = 0;
        const store = new SessionStateStore((prefix = 'session_state') => `${prefix}_${++idCounter}`);

        const first = store.upsert({
            sessionId: 'session_a',
            userId: 'user_a',
            workspaceId: 'optics',
            corpusId: 'optics',
            mode: 'grounded_conversation',
            activeResourceIds: ['resource_1'],
            activeProjectionIds: ['projection_1'],
            retrievalSettings: {
                topK: 6,
                queryBackend: 'local_hybrid',
                persistMemory: true,
            },
            memorySettings: {
                namespace: 'conversation',
                enabled: true,
            },
            exportProfileId: 'desktop-full',
            panelState: {
                lastGroundedAnswerAt: '2026-05-26T00:00:00.000Z',
            },
            recordedAt: '2026-05-26T00:00:00.000Z',
        });
        const second = store.upsert({
            sessionId: 'session_a',
            userId: 'user_a',
            workspaceId: 'optics',
            corpusId: 'optics',
            mode: 'study_session',
            activeResourceIds: ['resource_1', 'resource_2'],
            activeProjectionIds: ['projection_1', 'projection_2'],
            retrievalSettings: {
                topK: 0,
                queryBackend: null,
                persistMemory: true,
            },
            memorySettings: {
                namespace: null,
                enabled: true,
            },
            exportProfileId: 'mobile-slim',
            panelState: {
                lastExecutionAt: '2026-05-26T00:05:00.000Z',
            },
            recordedAt: '2026-05-26T00:05:00.000Z',
        });

        expect(second.sessionStateId).toBe(first.sessionStateId);
        expect(store.listByWorkspace('optics')).toHaveLength(1);
        expect(store.listBySessionIds(['session_a'])[0]?.mode).toBe('study_session');
    });
});

import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';

describe('KnowledgeLearningPlatform Program F integration', () => {
    test('produces workspace-scoped export bundles with durable substrate state', async () => {
        const platform = new KnowledgeLearningPlatform(() => new Date('2026-05-26T08:00:00.000Z'));

        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_absorption',
                    sourcePath: 'Knowledge_Base/optics/Absorption.md',
                    language: 'zh',
                    workspaceId: 'optics',
                    corpusId: 'optics',
                    exportProfileId: 'mobile-slim',
                    content: [
                        '# Absorption',
                        'Absorption determines attenuation length.',
                        '',
                        '## Diagram',
                        '```mermaid',
                        'graph TD',
                        'A[Photon] --> B[Absorption]',
                        '```',
                    ].join('\n'),
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;

        await platform.agentConversation({
            userId: 'program_f_user',
            sessionId: 'program_f_session',
            message: 'Explain absorption in this workspace.',
            scope: {
                workspaceId: 'optics',
            },
            persistMemory: true,
        });

        const session = await platform.buildStudySession({
            userId: 'program_f_user',
            sessionId: 'program_f_session',
            focusAtomIds: [atomId],
            maxActions: 4,
            includeDivergence: false,
            includeRetrain: true,
            generatedAt: '2026-05-26T08:05:00.000Z',
        });

        await platform.executeStudySessionAction({
            userId: 'program_f_user',
            sessionId: 'program_f_session',
            action: {
                atomId,
                kind: 'quiz',
                source: 'mastery_path',
                answer: 'Absorption lowers transmitted intensity.',
            },
            persistMemory: true,
            autoPromoteMemory: true,
            promoteMemoryTargetLayer: 'long_term',
            promoteMemoryMinConfidence: 0.6,
            executedAt: '2026-05-26T08:06:00.000Z',
        });

        await platform.executeStudySessionPlan({
            userId: 'program_f_user',
            sessionId: 'program_f_session',
            executionKind: 'session',
            sessionPlan: session,
            actionLimit: 2,
            persistMemory: true,
            autoPromoteMemory: true,
            promoteMemoryTargetLayer: 'long_term',
            executedAt: '2026-05-26T08:07:00.000Z',
        });

        const bundle = await platform.buildWorkspaceExportBundle({
            workspaceId: 'optics',
            userId: 'program_f_user',
            exportProfileId: 'mobile-slim',
        });

        expect(bundle.manifest.platformTarget).toBe('mobile');
        expect(bundle.manifest.packagingMode).toBe('slim');
        expect(bundle.readiness.ready).toBe(true);
        expect(bundle.resources.length).toBeGreaterThan(0);
        expect(bundle.projections.length).toBeGreaterThan(0);
        expect(bundle.index.units.length).toBeGreaterThan(0);
        expect(bundle.index.segments.length).toBeGreaterThan(0);
        expect(bundle.graph.atoms.length).toBeGreaterThan(0);
        expect(bundle.runtime.sessionStates.some((state) => state.sessionId === 'program_f_session')).toBe(true);
        expect(bundle.runtime.workflowArtifacts.some((artifact) => artifact.kind === 'research_report')).toBe(true);
        expect(bundle.runtime.workflowArtifacts.some((artifact) => artifact.kind === 'study_session')).toBe(true);
        expect(bundle.runtime.workflowArtifacts.some((artifact) => artifact.kind === 'review_plan')).toBe(true);
        expect(bundle.memory.entries.length).toBeGreaterThan(0);
        expect(bundle.memory.entries.some((record) => Boolean(record.entry.memoryType))).toBe(true);
        expect(bundle.memory.auditRecords.length).toBeGreaterThan(0);
    });
});

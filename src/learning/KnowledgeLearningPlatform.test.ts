import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';

describe('KnowledgeLearningPlatform', () => {
    let nowIso: string;
    let platform: KnowledgeLearningPlatform;

    beforeEach(() => {
        nowIso = '2026-03-31T08:00:00.000Z';
        platform = new KnowledgeLearningPlatform(() => new Date(nowIso));
    });

    test('ingest supports staleness detection and temporal supersede edges', async () => {
        const firstIngest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_alpha',
                    sourcePath: 'Knowledge_Base/doc_alpha.md',
                    language: 'en',
                    content: '# Graph Foundations\nGraph states and retrieval evidence.\n\n## Query Layer\nUse explainable retrieval.',
                },
            ],
        });

        expect(firstIngest.summary.ingestedDocuments).toBe(1);
        expect(firstIngest.summary.changedDocuments).toBe(1);
        expect(firstIngest.atoms.length).toBeGreaterThan(0);
        expect(firstIngest.evidenceSpans.length).toBeGreaterThan(0);
        expect(firstIngest.staleness[0]?.status).toBe('new');

        nowIso = '2026-03-31T08:10:00.000Z';
        const unchangedIngest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_alpha',
                    sourcePath: 'Knowledge_Base/doc_alpha.md',
                    language: 'en',
                    content: '# Graph Foundations\nGraph states and retrieval evidence.\n\n## Query Layer\nUse explainable retrieval.',
                },
            ],
        });

        expect(unchangedIngest.summary.changedDocuments).toBe(0);
        expect(unchangedIngest.staleness[0]?.status).toBe('unchanged');

        nowIso = '2026-03-31T08:20:00.000Z';
        const updatedIngest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_alpha',
                    sourcePath: 'Knowledge_Base/doc_alpha.md',
                    language: 'en',
                    content: '# Graph Foundations\nGraph states and retrieval evidence with temporal versioning.\n\n## Query Layer\nUse explainable retrieval with evidence paths.',
                },
            ],
        });

        expect(updatedIngest.summary.changedDocuments).toBe(1);
        expect(updatedIngest.staleness[0]?.status).toBe('updated');
        expect(updatedIngest.temporalEdges.length).toBeGreaterThan(0);
    });

    test('query returns evidence-first results with relation path and temporal validity', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_a',
                    sourcePath: 'Knowledge_Base/doc_a.md',
                    language: 'en',
                    content: '# Mastery Loop\nMastery diagnostics and retest update.\n\n## Related\nSee [[Divergence Engine]].',
                },
                {
                    documentId: 'doc_b',
                    sourcePath: 'Knowledge_Base/doc_b.md',
                    language: 'en',
                    content: '# Divergence Engine\nCross-domain expansion and transfer tasks.',
                },
            ],
        });

        const queryResult = await platform.queryKnowledge({
            query: 'mastery diagnostics divergence',
            topK: 3,
            asOf: '2026-03-31T08:30:00.000Z',
        });

        expect(queryResult.items.length).toBeGreaterThan(0);
        expect(queryResult.items[0].evidenceSpans.length).toBeGreaterThan(0);
        expect(Array.isArray(queryResult.items[0].relationPath)).toBe(true);
        expect(queryResult.items[0].temporalValidity.checkedAt).toBe('2026-03-31T08:30:00.000Z');
        expect(queryResult.trace.retrievalModes).toContain('temporal_filter');
    });

    test('mastery diagnostics and path generation produce actionable outputs', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_mastery',
                    sourcePath: 'Knowledge_Base/doc_mastery.md',
                    language: 'en',
                    content: '# Retrieval Practice\nPractice improves mastery probability.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id;
        expect(atomId).toBeDefined();

        const diagnostics = await platform.diagnoseMastery({
            userId: 'user_a',
            observations: [
                {
                    atomId: atomId as string,
                    outcome: 'incorrect',
                    errorTag: 'concept_boundary',
                },
                {
                    atomId: atomId as string,
                    outcome: 'correct',
                },
            ],
        });

        expect(diagnostics.summary.updatedCount).toBe(2);
        expect(diagnostics.updatedStates[0].reviewCount).toBeGreaterThan(0);

        const pathResult = await platform.buildLearningPath({
            userId: 'user_a',
            focusAtomIds: [atomId as string],
            maxMasteryPaths: 2,
            maxDivergencePaths: 2,
        });

        expect(pathResult.masteryPaths.length).toBeGreaterThan(0);
        expect(pathResult.recommendedActions.length).toBeGreaterThan(0);
    });

    test('tutor actions and memory policy APIs are operational', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_tutor',
                    sourcePath: 'Knowledge_Base/doc_tutor.md',
                    language: 'en',
                    content: '# Evidence First\nEvery tutor response must cite evidence spans.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;

        const tutor = await platform.executeTutorAction({
            userId: 'user_tutor',
            actionKind: 'generate_quiz',
            atomId,
        });

        expect(tutor.message).toContain('Question:');
        expect(tutor.trace.source).toBe('rule-engine');
        expect(tutor.evidenceSpans.length).toBeGreaterThan(0);

        const writeResult = await platform.applyMemoryPolicy({
            userId: 'user_tutor',
            layer: 'session',
            operation: 'write',
            entries: [
                {
                    key: 'quiz-1',
                    value: 'Learner confused evidence and inference.',
                    tags: ['misconception'],
                    confidence: 0.82,
                    references: [atomId],
                    createdAt: '2026-03-31T08:40:00.000Z',
                    updatedAt: '2026-03-31T08:40:00.000Z',
                    expiresAt: '2026-04-01T00:00:00.000Z',
                },
                {
                    key: 'expired-1',
                    value: 'old note',
                    tags: [],
                    confidence: 0.2,
                    references: [],
                    createdAt: '2026-03-20T00:00:00.000Z',
                    updatedAt: '2026-03-20T00:00:00.000Z',
                    expiresAt: '2026-03-21T00:00:00.000Z',
                },
            ],
        });
        expect(writeResult.entries.length).toBeGreaterThan(0);
        expect(writeResult.evictedCount).toBeGreaterThanOrEqual(1);

        const readResult = await platform.applyMemoryPolicy({
            userId: 'user_tutor',
            layer: 'session',
            operation: 'read',
            query: 'evidence',
        });
        expect(readResult.entries.length).toBeGreaterThan(0);

        const evictResult = await platform.applyMemoryPolicy({
            userId: 'user_tutor',
            layer: 'session',
            operation: 'evict',
            now: '2026-03-31T23:59:59.000Z',
        });
        expect(evictResult.evictedCount).toBeGreaterThanOrEqual(0);
    });
});

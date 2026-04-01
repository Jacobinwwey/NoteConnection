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
        expect(queryResult.trace.modeWeights.keyword).toBeGreaterThan(0);
        expect(queryResult.trace.modeWeights.graph).toBeGreaterThan(0);
        expect(queryResult.trace.latencyMs).toBeGreaterThanOrEqual(0);
        expect(queryResult.trace.evidenceCoverageRatio).toBeGreaterThan(0);
    });

    test('ingest diff operations support delete and dynamic relation recompute', async () => {
        const seed = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_a',
                    sourcePath: 'Knowledge_Base/doc_a.md',
                    language: 'en',
                    content: '# Topic A\nSee [[Topic B]] for prerequisite context.',
                },
                {
                    documentId: 'doc_b',
                    sourcePath: 'Knowledge_Base/doc_b.md',
                    language: 'en',
                    content: '# Topic B\nLegacy concept that will be removed.',
                },
            ],
        });
        expect(seed.summary.changedDocuments).toBe(2);

        const diffResult = await platform.ingestKnowledge({
            incremental: true,
            recomputeRelations: true,
            operations: [
                {
                    op: 'upsert',
                    document: {
                        documentId: 'doc_a',
                        sourcePath: 'Knowledge_Base/doc_a.md',
                        language: 'en',
                        content: '# Topic A\nUpdated without outbound wiki links.',
                    },
                },
                {
                    op: 'delete',
                    document: {
                        documentId: 'doc_b',
                    },
                },
            ],
        });

        expect(diffResult.summary.ingestedDocuments).toBe(1);
        expect(diffResult.summary.changedDocuments).toBe(1);
        expect(diffResult.summary.deletedDocuments).toBe(1);
        expect(diffResult.summary.recomputedDynamicRelations).toBe(true);
        expect(diffResult.summary.invalidatedRelationEdges).toBeGreaterThanOrEqual(1);
        expect(diffResult.summary.regeneratedRelationEdges).toBeGreaterThanOrEqual(0);
        expect(diffResult.staleness.some((entry) => entry.status === 'deleted' && entry.documentId === 'doc_b')).toBe(true);

        const deletedQuery = await platform.queryKnowledge({
            query: 'Legacy concept removed',
            topK: 5,
            asOf: '2026-03-31T09:00:00.000Z',
        });
        expect(deletedQuery.items.length).toBe(0);
    });

    test('ingest extracts markdown text, code, formula, and mermaid atoms', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_structured',
                    sourcePath: 'Knowledge_Base/doc_structured.md',
                    language: 'en',
                    content: [
                        '# Structured Parsing',
                        'This section includes code, formula, and diagram evidence.',
                        '',
                        '```ts',
                        'const mastery = estimateMastery(state);',
                        '```',
                        '',
                        '$$',
                        'P(A|B) = P(B|A) P(A) / P(B)',
                        '$$',
                        '',
                        '```mermaid',
                        'graph TD',
                        'A[Atom] --> B[Evidence]',
                        '```',
                    ].join('\n'),
                },
            ],
        });

        const representationTypes = new Set(ingest.atoms.map((atom) => atom.representationType));
        expect(representationTypes.has('text')).toBe(true);
        expect(representationTypes.has('code')).toBe(true);
        expect(representationTypes.has('formula')).toBe(true);
        expect(representationTypes.has('mermaid')).toBe(true);

        const mermaidAtom = ingest.atoms.find((atom) => atom.representationType === 'mermaid');
        expect(mermaidAtom).toBeDefined();
        expect(mermaidAtom?.content.toLowerCase()).toContain('graph td');
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

    test('learning quality evaluation enforces mastery and evidence thresholds', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_eval',
                    sourcePath: 'Knowledge_Base/doc_eval.md',
                    language: 'en',
                    content: '# Eval\nQuality gates require evidence and mastery uplift.',
                },
            ],
        });

        await platform.queryKnowledge({ query: 'quality gates evidence mastery', topK: 3 });
        await platform.queryKnowledge({ query: 'quality gates evidence mastery', topK: 3 });

        const passResult = await platform.evaluateLearningQuality({
            baseline: {
                retestPassRatePct: 50,
                misconceptionRecurrenceRatePct: 40,
                evidenceBackedSuggestionRatioPct: 80,
                averagePathMasteryGainPct: 22,
                randomPathMasteryGainPct: 12,
            },
            current: {
                retestPassRatePct: 74,
                misconceptionRecurrenceRatePct: 12,
                evidenceBackedSuggestionRatioPct: 93,
                averagePathMasteryGainPct: 28,
                randomPathMasteryGainPct: 18,
            },
        });

        expect(passResult.overallPassed).toBe(true);
        expect(passResult.deltas.retestPassRateUpliftPct).toBeGreaterThanOrEqual(20);
        expect(passResult.deltas.misconceptionRecurrenceReductionPct).toBeGreaterThanOrEqual(25);
        expect(passResult.gates.find((gate) => gate.gateId === 'evidence_ratio')?.passed).toBe(true);

        const failResult = await platform.evaluateLearningQuality({
            baseline: {
                retestPassRatePct: 65,
                misconceptionRecurrenceRatePct: 30,
                evidenceBackedSuggestionRatioPct: 92,
                averagePathMasteryGainPct: 21,
                randomPathMasteryGainPct: 17,
            },
            current: {
                retestPassRatePct: 70,
                misconceptionRecurrenceRatePct: 28,
                evidenceBackedSuggestionRatioPct: 85,
                averagePathMasteryGainPct: 18,
                randomPathMasteryGainPct: 17,
            },
        });

        expect(failResult.overallPassed).toBe(false);
        expect(failResult.gates.some((gate) => gate.passed === false)).toBe(true);
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

        const state = platform.getKnowledgeState();
        expect(state.ingestTelemetry.ingestCount).toBeGreaterThan(0);
        expect(state.ingestTelemetry.ingestP95Ms).toBeGreaterThanOrEqual(0);
        expect(state.retrievalTelemetry.queryCount).toBeGreaterThanOrEqual(0);
        expect(state.retrievalTelemetry.queryP95Ms).toBeGreaterThanOrEqual(0);
    });

    test('tutor adapter output is guarded by evidence binding and confidence thresholds', async () => {
        const guardedPlatform = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            tutorAdapter: {
                id: 'mock-adapter',
                mode: 'local',
                async execute(input) {
                    return {
                        message: `Synthetic tutor response for ${input.atom.title}`,
                        confidence: 0.42,
                        evidenceSpanIds: [],
                    };
                },
            },
        });

        const ingest = await guardedPlatform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_guardrail',
                    sourcePath: 'Knowledge_Base/doc_guardrail.md',
                    language: 'en',
                    content: '# Guardrails\nTutor output should be evidence bound.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;

        const result = await guardedPlatform.executeTutorAction({
            userId: 'user_guardrail',
            actionKind: 'follow_up',
            atomId,
            prompt: 'Generate a follow-up explanation.',
        });

        expect(result.trace.source).toBe('llm-adapter');
        expect(result.trace.confidence).toBeLessThan(0.65);
        expect(result.message).toContain('Low-confidence tutor output detected');
        expect(result.trace.notes.toLowerCase()).toContain('downgraded');
    });
});

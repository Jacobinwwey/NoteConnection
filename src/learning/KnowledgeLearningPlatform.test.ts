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
        expect(diffResult.summary.resolvedRelationRecomputeMode).toBe('full');
        expect(diffResult.summary.relationRecomputeLatencyMs).toBeGreaterThanOrEqual(0);
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

    test('relation recompute mode supports none and incremental strategies', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            relationRecomputeMode: 'none',
            documents: [
                {
                    documentId: 'doc_target',
                    sourcePath: 'Knowledge_Base/doc_target.md',
                    language: 'en',
                    content: '# Target Topic\nReference target concept.',
                },
            ],
        });

        const noneModeResult = await platform.ingestKnowledge({
            incremental: true,
            relationRecomputeMode: 'none',
            documents: [
                {
                    documentId: 'doc_source',
                    sourcePath: 'Knowledge_Base/doc_source.md',
                    language: 'en',
                    content: '# Source Topic\nSee [[Target Topic]] for details.',
                },
            ],
        });

        expect(noneModeResult.summary.resolvedRelationRecomputeMode).toBe('none');
        expect(noneModeResult.summary.recomputedDynamicRelations).toBe(false);
        expect(noneModeResult.summary.relationRecomputeLatencyMs).toBe(0);
        expect(noneModeResult.relationEdges.some((edge) => edge.relationKind === 'reference')).toBe(false);

        const incrementalResult = await platform.ingestKnowledge({
            incremental: true,
            relationRecomputeMode: 'incremental',
            documents: [
                {
                    documentId: 'doc_source',
                    sourcePath: 'Knowledge_Base/doc_source.md',
                    language: 'en',
                    content: '# Source Topic\nUpdated and still references [[Target Topic]].',
                },
            ],
        });

        expect(incrementalResult.summary.resolvedRelationRecomputeMode).toBe('incremental');
        expect(incrementalResult.summary.recomputedDynamicRelations).toBe(false);
        expect(incrementalResult.summary.relationRecomputeLatencyMs).toBe(0);
        expect(incrementalResult.relationEdges.some((edge) => edge.relationKind === 'reference')).toBe(true);
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
                    errorTags: ['retrieval_failure'],
                },
                {
                    atomId: atomId as string,
                    outcome: 'correct',
                },
            ],
        });

        expect(diagnostics.summary.updatedCount).toBe(2);
        expect(diagnostics.updatedStates[0].reviewCount).toBeGreaterThan(0);
        expect(diagnostics.updatedStates[0].errorTagStats.length).toBeGreaterThan(0);

        const pathResult = await platform.buildLearningPath({
            userId: 'user_a',
            focusAtomIds: [atomId as string],
            maxMasteryPaths: 2,
            maxDivergencePaths: 2,
        });

        expect(pathResult.masteryPaths.length).toBeGreaterThan(0);
        expect(pathResult.recommendedActions.length).toBeGreaterThan(0);
    });

    test('misconception query aggregates recurring error tags and guides path prioritization', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_misconception_a',
                    sourcePath: 'Knowledge_Base/doc_misconception_a.md',
                    language: 'en',
                    content: '# Retrieval Stability\nPractice retrieval under varied prompts.',
                },
                {
                    documentId: 'doc_misconception_b',
                    sourcePath: 'Knowledge_Base/doc_misconception_b.md',
                    language: 'en',
                    content: '# Transfer Bridge\nApply the same concept in new domains.',
                },
            ],
        });
        const atomA = ingest.atoms[0]?.id as string;
        const atomB = ingest.atoms[1]?.id as string;
        expect(atomA).toBeDefined();
        expect(atomB).toBeDefined();

        await platform.diagnoseMastery({
            userId: 'user_misconception',
            observations: [
                { atomId: atomA, outcome: 'incorrect', errorTag: 'retrieval_failure' },
                { atomId: atomA, outcome: 'incorrect', errorTags: ['retrieval_failure', 'evidence_mismatch'] },
                { atomId: atomA, outcome: 'partial', errorTag: 'retrieval_failure' },
                { atomId: atomB, outcome: 'correct' },
            ],
        });

        const misconception = await platform.queryMasteryMisconceptions({
            userId: 'user_misconception',
            topK: 5,
        });
        expect(misconception.summary.totalObservations).toBeGreaterThanOrEqual(3);
        expect(misconception.items.length).toBeGreaterThan(0);
        expect(misconception.items[0].errorTag).toBe('retrieval_failure');
        expect(misconception.items[0].recommendedActionKinds).toContain('quiz');
        expect(misconception.items[0].severityScore).toBeGreaterThan(0);

        const pathResult = await platform.buildLearningPath({
            userId: 'user_misconception',
            focusAtomIds: [atomA, atomB],
            maxMasteryPaths: 2,
            maxDivergencePaths: 1,
        });
        expect(pathResult.masteryPaths.length).toBeGreaterThan(0);
        expect(pathResult.masteryPaths[0]?.targetAtomId).toBe(atomA);
        expect(pathResult.masteryPaths[0]?.actions.some((action) => action.kind === 'quiz')).toBe(true);
    });

    test('study session plan orchestrates misconception remediation, retrain, and mastery actions', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_session_a',
                    sourcePath: 'Knowledge_Base/doc_session_a.md',
                    language: 'en',
                    content: '# Session A\nFocus on retrieval and evidence alignment.',
                },
                {
                    documentId: 'doc_session_b',
                    sourcePath: 'Knowledge_Base/doc_session_b.md',
                    language: 'en',
                    content: '# Session B\nCross-apply the core concept.',
                },
            ],
        });
        const atomA = ingest.atoms[0]?.id as string;
        const atomB = ingest.atoms[1]?.id as string;

        await platform.diagnoseMastery({
            userId: 'user_session',
            observedAt: '2026-03-31T08:00:00.000Z',
            observations: [
                { atomId: atomA, outcome: 'incorrect', errorTag: 'retrieval_failure' },
                { atomId: atomA, outcome: 'incorrect', errorTag: 'evidence_mismatch' },
                { atomId: atomB, outcome: 'partial', errorTag: 'transfer_failure' },
            ],
        });

        const session = await platform.buildStudySession({
            userId: 'user_session',
            focusAtomIds: [atomA, atomB],
            includeDivergence: false,
            includeRetrain: true,
            maxActions: 8,
            generatedAt: '2026-04-20T00:00:00.000Z',
        });

        expect(session.actions.length).toBeGreaterThan(0);
        expect(session.signals.misconceptions.length).toBeGreaterThan(0);
        expect(session.signals.misconceptions[0]?.errorTag).toBe('retrieval_failure');
        expect(session.signals.dueRetrainAtoms).toContain(atomA);
        expect(session.signals.divergenceTargets.length).toBe(0);
        expect(session.actions.some((action) => action.source === 'misconception_remediation')).toBe(true);
        expect(session.actions.some((action) => action.source === 'retrain_plan')).toBe(true);
        expect(session.summary.totalActions).toBe(session.actions.length);
        expect(session.summary.evidenceCoverageRatio).toBeGreaterThan(0);
    });

    test('session action execution orchestrates tutor, memory persistence, and mastery update', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_session_action',
                    sourcePath: 'Knowledge_Base/doc_session_action.md',
                    language: 'en',
                    content: '# Session Action\nExecute learning actions as a closed-loop operation.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;

        const execution = await platform.executeStudySessionAction({
            userId: 'user_session_action',
            action: {
                atomId,
                kind: 'quiz',
                source: 'mastery_path',
            },
            outcome: 'incorrect',
            errorTag: 'retrieval_failure',
            persistMemory: true,
            memoryLayer: 'session',
        });

        expect(execution.trace.tutorActionKind).toBe('generate_quiz');
        expect(execution.trace.persistedMemory).toBe(true);
        expect(execution.trace.analyzedAnswer).toBe(false);
        expect(execution.trace.masterySource).toBe('explicit');
        expect(execution.trace.effectiveOutcome).toBe('incorrect');
        expect(execution.trace.effectiveErrorTag).toBe('retrieval_failure');
        expect(execution.tutor.message).toContain('Question:');
        expect(execution.answerAnalysis).toBeNull();
        expect(execution.memory).not.toBeNull();
        expect(execution.memory?.stats.session).toBeGreaterThan(0);
        expect(execution.mastery).not.toBeNull();
        expect(execution.mastery?.summary.updatedCount).toBe(1);
        const stateAfterExecution = platform.getKnowledgeState();
        expect(stateAfterExecution.sessionActionTelemetry.executionCount).toBe(1);
        expect(stateAfterExecution.sessionActionTelemetry.explicitMasteryUpdateCount).toBe(1);
        expect(stateAfterExecution.sessionActionTelemetry.inferredMasteryUpdateCount).toBe(0);
        expect(stateAfterExecution.sessionActionTelemetry.outcomeCounts.incorrect).toBe(1);

        const memoryRead = await platform.applyMemoryPolicy({
            userId: 'user_session_action',
            layer: 'session',
            operation: 'read',
            query: 'session_action',
            limit: 5,
        });
        expect(memoryRead.entries.length).toBeGreaterThan(0);

        const misconceptions = await platform.queryMasteryMisconceptions({
            userId: 'user_session_action',
            topK: 5,
        });
        expect(misconceptions.items.some((item) => item.errorTag === 'retrieval_failure')).toBe(true);
    });

    test('session action execution auto-analyzes answers and infers mastery diagnostics', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_session_action_auto',
                    sourcePath: 'Knowledge_Base/doc_session_action_auto.md',
                    language: 'en',
                    content: '# Session Action Auto\nAuto diagnostics should infer outcome from answer quality.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;

        const execution = await platform.executeStudySessionAction({
            userId: 'user_session_action_auto',
            action: {
                atomId,
                kind: 'quiz',
                source: 'mastery_path',
                answer: 'xylophone quasar nebula',
            },
            persistMemory: true,
            memoryLayer: 'session',
        });

        expect(execution.trace.tutorActionKind).toBe('generate_quiz');
        expect(execution.trace.analyzedAnswer).toBe(true);
        expect(execution.trace.masterySource).toBe('inferred');
        expect(execution.trace.effectiveOutcome).toBe('incorrect');
        expect(execution.trace.effectiveErrorTag).toBe('retrieval_failure');
        expect(execution.answerAnalysis).not.toBeNull();
        expect(execution.answerAnalysis?.trace.actionKind).toBe('analyze_answer');
        expect(execution.mastery).not.toBeNull();
        expect(execution.mastery?.summary.updatedCount).toBe(1);
        const stateAfterExecution = platform.getKnowledgeState();
        expect(stateAfterExecution.sessionActionTelemetry.executionCount).toBe(1);
        expect(stateAfterExecution.sessionActionTelemetry.analyzedAnswerCount).toBe(1);
        expect(stateAfterExecution.sessionActionTelemetry.inferredMasteryUpdateCount).toBe(1);
        expect(stateAfterExecution.sessionActionTelemetry.explicitMasteryUpdateCount).toBe(0);
        expect(stateAfterExecution.sessionActionTelemetry.outcomeCounts.incorrect).toBe(1);
    });

    test('session plan execution runs top actions and returns aggregate execution summary', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_session_exec_a',
                    sourcePath: 'Knowledge_Base/doc_session_exec_a.md',
                    language: 'en',
                    content: '# Session Execute A\nPractice evidence-backed retrieval for core concept A.',
                },
                {
                    documentId: 'doc_session_exec_b',
                    sourcePath: 'Knowledge_Base/doc_session_exec_b.md',
                    language: 'en',
                    content: '# Session Execute B\nApply concept B to transfer scenarios.',
                },
            ],
        });
        const focusAtomIds = ingest.atoms.map((item) => item.id);
        const sessionPlan = await platform.buildStudySession({
            userId: 'user_session_execute',
            focusAtomIds,
            maxActions: 8,
            includeDivergence: true,
            includeRetrain: true,
        });
        expect(sessionPlan.actions.length).toBeGreaterThan(0);

        const execution = await platform.executeStudySessionPlan({
            userId: 'user_session_execute',
            sessionPlan,
            actionLimit: 3,
            includeRetestPlan: false,
            persistMemory: true,
            memoryLayer: 'session',
        });

        expect(execution.items.length).toBe(3);
        expect(execution.summary.plannedActions).toBe(sessionPlan.actions.length);
        expect(execution.summary.attemptedActions).toBe(3);
        expect(execution.summary.executedCount).toBe(3);
        expect(execution.summary.failedCount).toBe(0);
        expect(execution.summary.skippedCount).toBe(0);
        expect(execution.summary.stoppedEarly).toBe(false);
        expect(execution.summary.averageTutorConfidence).toBeGreaterThan(0);
        expect(execution.summary.averageMasteryBefore).toBeGreaterThanOrEqual(0);
        expect(execution.summary.averageMasteryAfter).toBeGreaterThanOrEqual(0);
        expect(execution.masteryDelta.comparedAtoms).toBeGreaterThan(0);
        expect(execution.masteryDelta.items.length).toBe(execution.masteryDelta.comparedAtoms);
        expect(execution.retestPlan.summary.totalActions).toBe(0);

        const stateAfterExecution = platform.getKnowledgeState();
        expect(stateAfterExecution.sessionActionTelemetry.executionCount).toBeGreaterThanOrEqual(3);
    });

    test('session plan execution consumes answersByActionId for auto analysis and inferred mastery updates', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_session_exec_answers',
                    sourcePath: 'Knowledge_Base/doc_session_exec_answers.md',
                    language: 'en',
                    content: '# Session Execute Answers\nSupport answer-driven diagnostics during batch execution.',
                },
            ],
        });
        const focusAtomIds = ingest.atoms.map((item) => item.id);
        const sessionPlan = await platform.buildStudySession({
            userId: 'user_session_exec_answers',
            focusAtomIds,
            maxActions: 4,
            includeDivergence: false,
            includeRetrain: false,
        });
        expect(sessionPlan.actions.length).toBeGreaterThan(0);
        const firstAction = sessionPlan.actions[0];
        expect(firstAction).toBeDefined();

        const execution = await platform.executeStudySessionPlan({
            userId: 'user_session_exec_answers',
            sessionPlan: {
                ...sessionPlan,
                actions: [firstAction],
            },
            actionLimit: 1,
            answersByActionId: {
                [firstAction.id]: 'xylophone quasar nebula',
            },
            autoAnalyzeAnswer: true,
            autoUpdateMasteryFromAnswer: true,
            persistMemory: true,
            memoryLayer: 'session',
        });

        expect(execution.summary.executedCount).toBe(1);
        expect(execution.summary.analyzedAnswerCount).toBe(1);
        expect(execution.summary.inferredMasteryCount).toBe(1);
        expect(execution.summary.averageMasteryDelta).toBeLessThan(0);
        expect(execution.masteryDelta.regressedCount).toBeGreaterThanOrEqual(1);
        const firstItem = execution.items[0];
        expect(firstItem?.status).toBe('executed');
        expect(firstItem?.result?.answerAnalysis).not.toBeNull();
        expect(firstItem?.result?.trace.masterySource).toBe('inferred');
        expect(execution.masteryDelta.items[0]?.updatedByExecution).toBe(true);
        expect(execution.retestPlan.summary.totalActions).toBeGreaterThanOrEqual(1);
        expect(execution.retestPlan.actions[0]?.source).toBe('retrain_plan');
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

    test('quality snapshot captures runtime learning metrics for governance', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_quality_snapshot',
                    sourcePath: 'Knowledge_Base/doc_quality_snapshot.md',
                    language: 'en',
                    content: '# Snapshot\nQuality metrics should reflect runtime evidence and mastery.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;

        await platform.diagnoseMastery({
            userId: 'user_quality_snapshot',
            observations: [
                { atomId, outcome: 'correct' },
                { atomId, outcome: 'incorrect', errorTag: 'retrieval_failure' },
            ],
        });
        await platform.queryKnowledge({
            query: 'quality snapshot runtime',
            topK: 2,
        });
        await platform.executeTutorAction({
            userId: 'user_quality_snapshot',
            actionKind: 'recap',
            atomId,
        });

        const snapshotResult = await platform.captureLearningQualitySnapshot({
            userId: 'user_quality_snapshot',
        });
        expect(snapshotResult.snapshot.retestPassRatePct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.retestPassRatePct).toBeLessThanOrEqual(100);
        expect(snapshotResult.snapshot.misconceptionRecurrenceRatePct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.evidenceBackedSuggestionRatioPct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.averagePathMasteryGainPct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.queryP95Ms).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.diagnostics.learnerStates).toBeGreaterThan(0);
        expect(snapshotResult.diagnostics.totalTutorTraces).toBeGreaterThan(0);
    });

    test('ingest guardrail evaluation enforces thresholds over latest ingest and telemetry', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            relationRecomputeMode: 'full',
            documents: [
                {
                    documentId: 'doc_guardrail_a',
                    sourcePath: 'Knowledge_Base/doc_guardrail_a.md',
                    language: 'en',
                    content: '# Guardrail A\nIngest guardrails track changed docs and active atoms.',
                },
                {
                    documentId: 'doc_guardrail_b',
                    sourcePath: 'Knowledge_Base/doc_guardrail_b.md',
                    language: 'en',
                    content: '# Guardrail B\nTelemetry should stay under threshold budgets.',
                },
            ],
        });

        const passResult = await platform.evaluateIngestGuardrails({
            thresholds: {
                maxChangedDocuments: 10,
                maxDeletedDocuments: 5,
                maxActiveAtoms: 1000,
                maxIngestP95Ms: 60000,
                maxRecomputeP95Ms: 60000,
            },
        });
        expect(passResult.overallPassed).toBe(true);
        expect(passResult.latestSummary?.changedDocuments).toBe(2);
        expect(passResult.gates.find((gate) => gate.gateId === 'changed_documents')?.passed).toBe(true);

        const failResult = await platform.evaluateIngestGuardrails({
            thresholds: {
                maxChangedDocuments: 0,
                maxDeletedDocuments: 0,
                maxActiveAtoms: 1,
                maxIngestP95Ms: 1,
                maxRecomputeP95Ms: 1,
            },
        });
        expect(failResult.overallPassed).toBe(false);
        expect(failResult.gates.find((gate) => gate.gateId === 'changed_documents')?.passed).toBe(false);
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

        await platform.diagnoseMastery({
            userId: 'user_tutor',
            observations: [
                {
                    atomId,
                    outcome: 'incorrect',
                    errorTag: 'retrieval_failure',
                },
            ],
            observedAt: '2026-03-31T08:40:00.000Z',
        });

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

        const retrainResult = await platform.applyMemoryPolicy({
            userId: 'user_tutor',
            layer: 'session',
            operation: 'retrain_plan',
            limit: 3,
            now: '2026-04-10T00:00:00.000Z',
        });
        expect(retrainResult.recommendedActions?.length).toBeGreaterThan(0);
        expect(retrainResult.recommendedActions?.[0]?.atomId).toBe(atomId);

        const state = platform.getKnowledgeState();
        expect(state.ingestTelemetry.ingestCount).toBeGreaterThan(0);
        expect(state.ingestTelemetry.ingestP95Ms).toBeGreaterThanOrEqual(0);
        expect(state.retrievalTelemetry.queryCount).toBeGreaterThanOrEqual(0);
        expect(state.retrievalTelemetry.queryP95Ms).toBeGreaterThanOrEqual(0);
        expect(state.sessionActionTelemetry.executionCount).toBeGreaterThanOrEqual(0);
    });

    test('tutor action uses misconception context for targeted guidance', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_tutor_focus',
                    sourcePath: 'Knowledge_Base/doc_tutor_focus.md',
                    language: 'en',
                    content: '# Tutor Focus\nAnswers should map claims to source evidence.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;

        await platform.diagnoseMastery({
            userId: 'user_tutor_focus',
            observations: [
                {
                    atomId,
                    outcome: 'incorrect',
                    errorTag: 'evidence_mismatch',
                },
            ],
        });

        const tutor = await platform.executeTutorAction({
            userId: 'user_tutor_focus',
            actionKind: 'analyze_answer',
            atomId,
            answer: 'I summarized the topic without citing exact evidence.',
        });

        expect(tutor.message).toContain('Known misconception to repair: evidence_mismatch.');
        expect(tutor.suggestedActions.some((action) => action.kind === 'review')).toBe(true);
        expect(tutor.trace.notes).toContain('misconception focus: evidence_mismatch');
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

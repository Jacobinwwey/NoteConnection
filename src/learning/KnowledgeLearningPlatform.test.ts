import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import type { GraphQueryBackend, GraphQueryBackendContext } from './queryBackend';
import {
    createGraphDbSnapshotAdapter,
    createKnowledgeGraphStore,
} from './store';
import type { KnowledgeGraphSnapshot, KnowledgeGraphStore } from './store';

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

    test('warmQueryBackend primes the configured backend without recording user query latency', async () => {
        const backendQuery = jest.fn(async (context: GraphQueryBackendContext) => ({
            candidates: context.atoms.slice(0, 1).map((atom) => ({
                atomId: atom.id,
                score: 1,
            })),
            trace: {
                retrievalModes: ['warmup_probe'],
            },
        }));
        const warmPlatform = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            graphQueryBackend: {
                id: 'warmup-test-backend',
                query: backendQuery,
                getDiagnostics: () => ({
                    backendId: 'warmup-test-backend',
                    ready: true,
                }),
            } satisfies GraphQueryBackend,
            graphQueryBackendFactoryOptions: {
                backend: 'local_hybrid',
            },
        });
        await warmPlatform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_warmup_backend',
                    sourcePath: 'Knowledge_Base/warmup/backend.md',
                    language: 'en',
                    content: '# Warmup Backend\nWarmup should prime the configured query backend.',
                },
                {
                    documentId: 'doc_warmup_other',
                    sourcePath: 'Knowledge_Base/other/backend.md',
                    language: 'en',
                    content: '# Other Backend\nThis note stays outside the requested warmup scope.',
                },
            ],
        });

        const before = warmPlatform.getKnowledgeState().retrievalTelemetry.queryCount;
        const result = await warmPlatform.warmQueryBackend({
            query: 'warmup backend',
            topK: 1,
            scope: {
                sourcePathPrefixes: ['Knowledge_Base/warmup'],
            },
        });
        const after = warmPlatform.getKnowledgeState().retrievalTelemetry.queryCount;

        expect(backendQuery).toHaveBeenCalledTimes(1);
        expect(backendQuery.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
            query: 'warmup backend',
            topK: 1,
            atoms: expect.arrayContaining([
                expect.objectContaining({ documentId: 'doc_warmup_backend' }),
            ]),
            indexAtoms: expect.arrayContaining([
                expect.objectContaining({ documentId: 'doc_warmup_backend' }),
                expect.objectContaining({ documentId: 'doc_warmup_other' }),
            ]),
        }));
        expect(backendQuery.mock.calls[0]?.[0].atoms).toHaveLength(1);
        expect(backendQuery.mock.calls[0]?.[0].indexAtoms).toHaveLength(2);
        expect(result).toEqual(expect.objectContaining({
            warmed: true,
            backendId: 'warmup-test-backend',
            totalAtomsInScope: 1,
            candidateCount: 1,
        }));
        expect(after).toBe(before);
    });

    test('queryKnowledge does not persist a read-only query response', async () => {
        const saveSnapshot = jest.fn(async () => undefined);
        const readOnlyPlatform = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            store: {
                loadSnapshot: jest.fn(async () => null),
                saveSnapshot,
                getDiagnostics: () => ({
                    storeType: 'memory',
                    exists: false,
                    loaded: false,
                }),
            },
        });
        await readOnlyPlatform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_read_only_query',
                    sourcePath: 'Knowledge_Base/read_only/query.md',
                    language: 'en',
                    content: '# Read Only Query\nRetrieval should not rewrite the graph store.',
                },
            ],
        });
        expect(saveSnapshot).toHaveBeenCalledTimes(1);
        saveSnapshot.mockClear();

        const result = await readOnlyPlatform.queryKnowledge({
            query: 'read only retrieval',
            topK: 1,
            scope: {
                sourcePathPrefixes: ['Knowledge_Base/read_only'],
            },
        });

        expect(result.items.length).toBeGreaterThan(0);
        expect(saveSnapshot).not.toHaveBeenCalled();
    });

    test('previewLearningPath avoids synchronous snapshot persistence while buildLearningPath keeps artifact durability', async () => {
        const saveSnapshot = jest.fn(async () => undefined);
        const pathPlatform = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            store: {
                loadSnapshot: jest.fn(async () => null),
                saveSnapshot,
                getDiagnostics: () => ({
                    storeType: 'memory',
                    exists: false,
                    loaded: false,
                }),
            },
        });
        const ingest = await pathPlatform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_learning_path_preview',
                    sourcePath: 'Knowledge_Base/path/preview.md',
                    language: 'en',
                    content: '# Learning Path Preview\nPreviewing a learning path should not block on durable artifact persistence.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;
        expect(atomId).toBeDefined();
        expect(saveSnapshot).toHaveBeenCalledTimes(1);
        saveSnapshot.mockClear();

        const preview = await pathPlatform.previewLearningPath({
            userId: 'preview_user',
            focusAtomIds: [atomId],
            maxMasteryPaths: 1,
            maxDivergencePaths: 0,
        });

        expect(preview.masteryPaths.length).toBeGreaterThan(0);
        expect(saveSnapshot).not.toHaveBeenCalled();

        const durable = await pathPlatform.buildLearningPath({
            userId: 'preview_user',
            focusAtomIds: [atomId],
            maxMasteryPaths: 1,
            maxDivergencePaths: 0,
        });

        expect(durable.masteryPaths.length).toBeGreaterThan(0);
        expect(saveSnapshot).toHaveBeenCalledTimes(1);
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

    test('query temporal validity preserves supersession edge details after document updates', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_temporal_detail',
                    sourcePath: 'Knowledge_Base/temporal/detail.md',
                    language: 'en',
                    content: '# Temporal Detail\nInitial revision for temporal detail checks.',
                },
            ],
        });

        nowIso = '2026-03-31T08:45:00.000Z';
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_temporal_detail',
                    sourcePath: 'Knowledge_Base/temporal/detail.md',
                    language: 'en',
                    content: '# Temporal Detail\nUpdated revision for temporal detail checks with supersession lineage.',
                },
            ],
        });

        const queryResult = await platform.queryKnowledge({
            query: 'temporal detail supersession lineage',
            topK: 3,
            asOf: '2026-03-31T08:50:00.000Z',
            scope: {
                sourcePathPrefixes: ['Knowledge_Base/temporal'],
            },
        });

        expect(queryResult.items.length).toBeGreaterThan(0);
        expect(queryResult.items[0].temporalValidity).toEqual(expect.objectContaining({
            checkedAt: '2026-03-31T08:50:00.000Z',
        }));
        expect((queryResult.items[0].temporalValidity as any).details).toEqual(expect.arrayContaining([
            expect.objectContaining({
                edgeKind: 'supersedes',
                targetAtomId: queryResult.items[0].atom.id,
                isActive: true,
            }),
        ]));
    });

    test('query scope constrains retrieval by corpus, language, and source path prefix', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_scope_cn',
                    sourcePath: 'Knowledge_Base/optics/absorption.md',
                    language: 'zh',
                    content: '# 吸收系数\n材料的吸收系数影响光学穿透深度与衰减。',
                },
                {
                    documentId: 'doc_scope_en',
                    sourcePath: 'Knowledge_Base/materials/absorption.md',
                    language: 'en',
                    content: '# Absorption Coefficient\nThe absorption coefficient affects penetration depth.',
                },
            ],
        });

        const queryResult = await platform.queryKnowledge({
            query: '吸收系数 光学',
            topK: 4,
            scope: {
                corpusId: 'optics',
                languages: ['zh'],
                sourcePathPrefixes: ['Knowledge_Base/optics'],
            },
        });

        expect(queryResult.items.length).toBeGreaterThan(0);
        expect(queryResult.items.every((item) => item.atom.documentId === 'doc_scope_cn')).toBe(true);
        expect(queryResult.trace.totalAtomsInScope).toBeGreaterThan(0);
        expect(queryResult.trace.scope).toEqual(expect.objectContaining({
            source: 'scoped',
            corpusId: 'optics',
        }));
    });

    test('query planner resolves compact mixed-language title queries inside an explicit workspace scope', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_water_glass',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    language: 'zh',
                    workspaceId: 'waterglass',
                    corpusId: 'waterglass',
                    content: '# 水杯 water glass\n水杯是由玻璃容器和内部液体组成的系统。',
                },
            ],
        });

        const queryResult = await platform.queryKnowledge({
            query: '什么是waterglass?',
            topK: 5,
            scope: {
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
            },
        });

        expect(queryResult.items.length).toBeGreaterThan(0);
        expect(queryResult.trace.scope).toEqual(expect.objectContaining({
            workspaceId: 'waterglass',
            corpusId: 'waterglass',
            scopeSource: 'explicit_request',
        }));
        expect(queryResult.trace.scope?.documentIds).toContain('doc_water_glass');
        expect(queryResult.trace.scope?.readiness).toEqual(expect.objectContaining({
            status: 'ready',
            workspaceId: 'waterglass',
        }));
        expect(queryResult.trace.planner).toEqual(expect.objectContaining({
            titleLikeQueries: expect.arrayContaining(['water glass', 'waterglass']),
            titleHitDocumentIds: expect.arrayContaining(['doc_water_glass']),
        }));
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
            executionKind: 'session',
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
        expect(execution.record.userId).toBe('user_session_execute');
        expect(execution.record.executionKind).toBe('session');
        expect(execution.record.focusAtomIds.length).toBeGreaterThan(0);
        const history = await platform.queryStudySessionHistory({
            userId: 'user_session_execute',
            limit: 5,
        });
        expect(history.records.length).toBeGreaterThanOrEqual(1);
        expect(history.records[0]?.id).toBe(execution.record.id);
        expect(history.summary.totalExecutedActions).toBeGreaterThan(0);

        const stateAfterExecution = platform.getKnowledgeState();
        expect(stateAfterExecution.sessionActionTelemetry.executionCount).toBeGreaterThanOrEqual(3);
        expect(stateAfterExecution.sessionExecutionHistoryRecords).toBeGreaterThanOrEqual(1);
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
            executionKind: 'retest',
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
        expect(execution.record.executionKind).toBe('retest');
        expect(execution.record.focusAtomIds.length).toBeGreaterThan(0);
    });

    test('session history supports execution-kind filtering, time windows, and pagination', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_session_history_query',
                    sourcePath: 'Knowledge_Base/doc_session_history_query.md',
                    language: 'en',
                    content: '# Session History Query\nFilter and paginate execution records.',
                },
            ],
        });
        const focusAtomIds = ingest.atoms.map((item) => item.id);
        const sessionPlan = await platform.buildStudySession({
            userId: 'user_session_history_query',
            focusAtomIds,
            maxActions: 3,
            includeDivergence: false,
            includeRetrain: false,
        });

        await platform.executeStudySessionPlan({
            userId: 'user_session_history_query',
            executionKind: 'session',
            sessionPlan,
            actionLimit: 1,
            includeRetestPlan: false,
            persistMemory: false,
            executedAt: '2026-04-01T08:00:00.000Z',
        });
        await platform.executeStudySessionPlan({
            userId: 'user_session_history_query',
            executionKind: 'retest',
            sessionPlan,
            actionLimit: 1,
            includeRetestPlan: false,
            persistMemory: false,
            executedAt: '2026-04-02T08:00:00.000Z',
        });
        await platform.executeStudySessionPlan({
            userId: 'user_session_history_query',
            executionKind: 'custom',
            sessionPlan,
            actionLimit: 1,
            includeRetestPlan: false,
            persistMemory: false,
            executedAt: '2026-04-03T08:00:00.000Z',
        });

        const paged = await platform.queryStudySessionHistory({
            userId: 'user_session_history_query',
            limit: 1,
            offset: 1,
        });
        expect(paged.records.length).toBe(1);
        expect(paged.records[0]?.executionKind).toBe('retest');
        expect(paged.records[0]?.focusAtomIds.length).toBeGreaterThan(0);
        expect(paged.page.limit).toBe(1);
        expect(paged.page.offset).toBe(1);
        expect(paged.page.totalFilteredRecords).toBe(3);
        expect(paged.page.hasMore).toBe(true);
        expect(paged.page.nextOffset).toBe(2);
        expect(paged.summary.totalRecords).toBe(3);
        expect(paged.summary.totalExecutedActions).toBeGreaterThanOrEqual(3);

        const retestOnly = await platform.queryStudySessionHistory({
            userId: 'user_session_history_query',
            executionKinds: ['retest'],
            limit: 5,
        });
        expect(retestOnly.records.length).toBe(1);
        expect(retestOnly.records[0]?.executionKind).toBe('retest');
        expect(retestOnly.summary.totalRecords).toBe(1);
        expect(retestOnly.page.totalFilteredRecords).toBe(1);
        expect(retestOnly.summary.executionKindBreakdown.find((item) => item.executionKind === 'retest')?.recordCount).toBe(1);
        expect(retestOnly.summary.executionKindBreakdown.find((item) => item.executionKind === 'session')?.recordCount).toBe(0);

        const rangeFiltered = await platform.queryStudySessionHistory({
            userId: 'user_session_history_query',
            fromExecutedAt: '2026-04-02T00:00:00.000Z',
            toExecutedAt: '2026-04-03T23:59:59.000Z',
            limit: 10,
        });
        expect(rangeFiltered.records.length).toBe(2);
        expect(rangeFiltered.summary.totalRecords).toBe(2);

        const reversedRange = await platform.queryStudySessionHistory({
            userId: 'user_session_history_query',
            fromExecutedAt: '2026-04-03T23:59:59.000Z',
            toExecutedAt: '2026-04-02T00:00:00.000Z',
            limit: 10,
        });
        expect(reversedRange.summary.totalRecords).toBe(2);
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
                historyWindowAverageMasteryDelta: 0.01,
            },
            current: {
                retestPassRatePct: 74,
                misconceptionRecurrenceRatePct: 12,
                evidenceBackedSuggestionRatioPct: 93,
                averagePathMasteryGainPct: 28,
                randomPathMasteryGainPct: 18,
                historyWindowAverageMasteryDelta: 0.04,
            },
        });

        expect(passResult.overallPassed).toBe(true);
        expect(passResult.deltas.retestPassRateUpliftPct).toBeGreaterThanOrEqual(20);
        expect(passResult.deltas.misconceptionRecurrenceReductionPct).toBeGreaterThanOrEqual(25);
        expect(passResult.deltas.historyWindowAverageMasteryDeltaUplift).toBeGreaterThan(0);
        expect(passResult.gates.find((gate) => gate.gateId === 'evidence_ratio')?.passed).toBe(true);
        expect(passResult.gates.find((gate) => gate.gateId === 'history_mastery_delta_uplift')?.passed).toBe(true);

        const failResult = await platform.evaluateLearningQuality({
            baseline: {
                retestPassRatePct: 65,
                misconceptionRecurrenceRatePct: 30,
                evidenceBackedSuggestionRatioPct: 92,
                averagePathMasteryGainPct: 21,
                randomPathMasteryGainPct: 17,
                historyWindowAverageMasteryDelta: 0.03,
            },
            current: {
                retestPassRatePct: 70,
                misconceptionRecurrenceRatePct: 28,
                evidenceBackedSuggestionRatioPct: 85,
                averagePathMasteryGainPct: 18,
                randomPathMasteryGainPct: 17,
                historyWindowAverageMasteryDelta: 0.01,
            },
        });

        expect(failResult.overallPassed).toBe(false);
        expect(failResult.gates.some((gate) => gate.passed === false)).toBe(true);
        expect(failResult.gates.find((gate) => gate.gateId === 'history_mastery_delta_uplift')?.passed).toBe(false);
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
        const sessionPlan = await platform.buildStudySession({
            userId: 'user_quality_snapshot',
            focusAtomIds: [atomId],
            maxActions: 3,
            includeDivergence: false,
            includeRetrain: true,
        });
        await platform.executeStudySessionPlan({
            userId: 'user_quality_snapshot',
            executionKind: 'session',
            sessionPlan,
            actionLimit: 1,
            includeRetestPlan: false,
            persistMemory: false,
            executedAt: '2026-04-02T09:30:00.000Z',
        });
        await platform.executeStudySessionPlan({
            userId: 'user_quality_snapshot',
            executionKind: 'retest',
            sessionPlan,
            actionLimit: 1,
            includeRetestPlan: false,
            persistMemory: false,
            executedAt: '2026-04-03T09:30:00.000Z',
        });

        const snapshotResult = await platform.captureLearningQualitySnapshot({
            userId: 'user_quality_snapshot',
            sampledAt: '2026-04-05T09:30:00.000Z',
            historyWindowDays: 14,
        });
        expect(snapshotResult.snapshot.retestPassRatePct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.retestPassRatePct).toBeLessThanOrEqual(100);
        expect(snapshotResult.snapshot.misconceptionRecurrenceRatePct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.evidenceBackedSuggestionRatioPct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.averagePathMasteryGainPct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.historyWindowDays).toBe(14);
        expect(snapshotResult.snapshot.historyWindowRecords).toBeGreaterThan(0);
        expect(snapshotResult.snapshot.historyWindowAverageMasteryDelta).toBeGreaterThanOrEqual(-1);
        expect(snapshotResult.snapshot.historyWindowAverageMasteryDelta).toBeLessThanOrEqual(1);
        expect(snapshotResult.snapshot.historyWindowRetestPositiveDeltaRatePct).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.snapshot.historyWindowRetestPositiveDeltaRatePct).toBeLessThanOrEqual(100);
        expect(snapshotResult.snapshot.queryP95Ms).toBeGreaterThanOrEqual(0);
        expect(snapshotResult.diagnostics.learnerStates).toBeGreaterThan(0);
        expect(snapshotResult.diagnostics.totalTutorTraces).toBeGreaterThan(0);
        expect(snapshotResult.diagnostics.historyWindowRecords).toBeGreaterThan(0);
        expect(snapshotResult.diagnostics.historyWindowRetestRecords).toBeGreaterThanOrEqual(0);
    });

    test('learning quality baseline APIs support get/set/clear lifecycle', async () => {
        const initialBaseline = await platform.getLearningQualityBaseline({
            userId: 'baseline_user_a',
        });
        expect(initialBaseline.found).toBe(false);
        expect(initialBaseline.storedAt).toBeNull();
        expect(initialBaseline.snapshot).toBeNull();

        const setBaseline = await platform.setLearningQualityBaseline({
            userId: 'baseline_user_a',
            storedAt: '2026-05-10T10:00:00.000Z',
            snapshot: {
                retestPassRatePct: 72,
                misconceptionRecurrenceRatePct: 18,
                evidenceBackedSuggestionRatioPct: 90,
                averagePathMasteryGainPct: 21,
                randomPathMasteryGainPct: 11,
                historyWindowDays: 14,
                historyWindowRecords: 8,
                historyWindowAverageMasteryDelta: 0.12,
                historyWindowRetestPositiveDeltaRatePct: 75,
                queryP95Ms: 120,
            },
        });
        expect(setBaseline.found).toBe(true);
        expect(setBaseline.storedAt).toBe('2026-05-10T10:00:00.000Z');
        expect(setBaseline.snapshot?.retestPassRatePct).toBe(72);

        const loadedBaseline = await platform.getLearningQualityBaseline({
            userId: 'baseline_user_a',
        });
        expect(loadedBaseline.found).toBe(true);
        expect(loadedBaseline.storedAt).toBe('2026-05-10T10:00:00.000Z');
        expect(loadedBaseline.snapshot?.misconceptionRecurrenceRatePct).toBe(18);

        const clearedBaseline = await platform.clearLearningQualityBaseline({
            userId: 'baseline_user_a',
        });
        expect(clearedBaseline.found).toBe(false);
        expect(clearedBaseline.snapshot).toBeNull();
        expect(clearedBaseline.storedAt).toBeNull();
    });

    test('learning quality baseline evaluation uses stored baseline and current snapshot', async () => {
        await platform.setLearningQualityBaseline({
            userId: 'baseline_eval_user',
            storedAt: '2026-05-10T10:00:00.000Z',
            snapshot: {
                retestPassRatePct: 60,
                misconceptionRecurrenceRatePct: 40,
                evidenceBackedSuggestionRatioPct: 70,
                averagePathMasteryGainPct: 18,
                randomPathMasteryGainPct: 10,
                queryP95Ms: 250,
            },
        });

        const result = await platform.evaluateLearningQualityAgainstBaseline({
            userId: 'baseline_eval_user',
            current: {
                retestPassRatePct: 78,
                misconceptionRecurrenceRatePct: 22,
                evidenceBackedSuggestionRatioPct: 88,
                averagePathMasteryGainPct: 24,
                randomPathMasteryGainPct: 12,
                queryP95Ms: 180,
            },
            sampledAt: '2026-05-11T10:00:00.000Z',
        });

        expect(result.userId).toBe('baseline_eval_user');
        expect(result.baseline.found).toBe(true);
        expect(result.currentSnapshot.snapshot.retestPassRatePct).toBe(78);
        expect(result.evaluation.baseline.retestPassRatePct).toBe(60);
        expect(result.evaluation.current.retestPassRatePct).toBe(78);
        expect(typeof result.evaluation.overallPassed).toBe('boolean');
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

    test('phase-3 tutor telemetry and provider trend diagnostics summarize llm traces', async () => {
        let adapterCallCount = 0;
        const telemetryPlatform = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            tutorAdapter: {
                id: 'mock-cloud',
                mode: 'cloud',
                async execute(input) {
                    adapterCallCount += 1;
                    if (adapterCallCount <= 3) {
                        return {
                            message: `Accepted tutor answer for ${input.atom.title}`,
                            confidence: 0.86,
                            evidenceSpanIds: input.evidenceSpans.slice(0, 1).map((span) => span.id),
                            adapterId: 'mock-cloud',
                            providerName: 'cloud_llm',
                            providerMode: 'cloud',
                            metadata: {
                                attemptedProviders: ['cloud_llm'],
                                selectedProvider: 'cloud_llm',
                            },
                        };
                    }
                    return {
                        message: `Fallback-heavy tutor answer for ${input.atom.title}`,
                        confidence: 0.34,
                        evidenceSpanIds: [],
                        adapterId: 'mock-cloud',
                        providerName: 'cloud_llm',
                        providerMode: 'cloud',
                        metadata: {
                            attemptedProviders: ['cloud_llm', 'local_llm'],
                            selectedProvider: 'cloud_llm',
                        },
                    };
                },
            },
        });

        const ingest = await telemetryPlatform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_phase3_tutor',
                    sourcePath: 'Knowledge_Base/doc_phase3_tutor.md',
                    language: 'en',
                    content: '# Tutor Telemetry\nTrack provider routing, fallback, and trace quality.',
                },
            ],
        });
        const atomId = ingest.atoms[0]?.id as string;

        for (let index = 0; index < 6; index += 1) {
            nowIso = `2026-03-31T${String(8 + index).padStart(2, '0')}:00:00.000Z`;
            await telemetryPlatform.executeTutorAction({
                userId: 'phase3_tutor_user',
                actionKind: 'recap',
                atomId,
                prompt: `phase3 tutor trace ${index + 1}`,
            });
        }

        const catalog = await telemetryPlatform.getTutorAdapterCatalog();
        expect(catalog.summary.totalAdapters).toBe(1);
        expect(catalog.adapters[0]?.adapterId).toBe('mock-cloud');

        const telemetry = await telemetryPlatform.getTutorAdapterTelemetry();
        expect(telemetry.summary.totalRequests).toBe(6);
        expect(telemetry.summary.acceptedResponses).toBe(3);
        expect(telemetry.summary.providerFallbackResponses).toBe(3);
        expect(telemetry.summary.averageProviderAttemptCount).toBeGreaterThan(1);
        expect(telemetry.adapters[0]?.adapterId).toBe('mock-cloud');

        const diagnostics = await telemetryPlatform.queryTutorTraceDiagnostics({
            source: 'llm-adapter',
            providerName: 'cloud_llm',
            limit: 4,
        });
        expect(diagnostics.summary.matchedTraces).toBe(6);
        expect(diagnostics.summary.returnedTraces).toBe(4);
        expect(diagnostics.providerBreakdown[0]?.providerName).toBe('cloud_llm');
        expect(diagnostics.providerBreakdown[0]?.fallbackTraces).toBe(3);

        const trendDiagnostics = await telemetryPlatform.queryTutorProviderTrendDiagnostics({
            source: 'llm-adapter',
            limit: 4,
            windowSize: 3,
            minSamples: 2,
        });
        expect(trendDiagnostics.providers[0]?.providerName).toBe('cloud_llm');
        expect(trendDiagnostics.providers[0]?.trendStatus).toBe('regressing');
        expect(Number(trendDiagnostics.providers[0]?.deltas?.fallbackRatioDeltaPct || 0)).toBeGreaterThan(0);

        const trendHistory = await telemetryPlatform.queryTutorProviderTrendHistory({
            source: 'llm-adapter',
            limit: 6,
            windowSize: 3,
            minSamples: 2,
        });
        expect(trendHistory.summary.totalProviders).toBe(1);
        expect(trendHistory.summary.totalRecords).toBeGreaterThan(0);
        expect(trendHistory.records[0]?.providerName).toBe('cloud_llm');
    });

    test('conversation memory lifecycle supports add search feedback list and delete', async () => {
        const addResult = await platform.addConversationMemory({
            userId: 'conversation_memory_user',
            namespace: 'conversation',
            content: 'Remember to revisit focus evidence before transfer tasks.',
            tags: ['focus', 'evidence'],
            source: 'manual_note',
            confidence: 0.74,
            now: '2026-04-02T10:00:00.000Z',
        });
        const memoryId = String(addResult.memory?.memoryId || '');
        expect(addResult.added).toBe(true);
        expect(memoryId).toContain('conv_memory_');

        await platform.addConversationMemory({
            userId: 'conversation_memory_user',
            namespace: 'study_session',
            content: 'Review transfer path sequencing after the recap.',
            tags: ['transfer'],
            now: '2026-04-02T10:05:00.000Z',
        });

        const searchResult = await platform.searchConversationMemory({
            userId: 'conversation_memory_user',
            namespace: 'conversation',
            query: 'focus evidence',
            limit: 5,
            now: '2026-04-02T10:10:00.000Z',
        });
        expect(searchResult.summary.matchedResults).toBe(1);
        expect(searchResult.message).toContain('Conversation memory recall (1/1)');
        expect(searchResult.results[0]?.namespace).toBe('conversation');

        const feedbackResult = await platform.feedbackConversationMemory({
            userId: 'conversation_memory_user',
            namespace: 'conversation',
            memoryId,
            feedback: 'correct',
            correctedContent: 'Remember to revisit focus evidence before transfer tasks and cite the exact span.',
            now: '2026-04-02T10:15:00.000Z',
        });
        expect(feedbackResult.recorded).toBe(true);
        expect(feedbackResult.memory?.content).toContain('cite the exact span');
        expect(Number(feedbackResult.memory?.confidence || 0)).toBeGreaterThanOrEqual(0.9);

        const listResult = await platform.listConversationMemory({
            userId: 'conversation_memory_user',
            namespace: 'conversation',
            limit: 5,
            now: '2026-04-02T10:20:00.000Z',
        });
        expect(listResult.summary.returnedEntries).toBe(1);
        expect(listResult.entries[0]?.memoryId).toBe(memoryId);

        const deleteResult = await platform.deleteConversationMemory({
            userId: 'conversation_memory_user',
            namespace: 'conversation',
            memoryId,
            now: '2026-04-02T10:25:00.000Z',
        });
        expect(deleteResult.deleted).toBe(true);

        const finalList = await platform.listConversationMemory({
            userId: 'conversation_memory_user',
            namespace: 'conversation',
            limit: 5,
            now: '2026-04-02T10:30:00.000Z',
        });
        expect(finalList.summary.returnedEntries).toBe(0);
    });

    test('agent conversation returns grounded citations and persists scoped turn state', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_agent_scope',
                    sourcePath: 'Knowledge_Base/optics/absorption.md',
                    language: 'zh',
                    content: '# 吸收\n吸收系数与光学衰减共同决定材料中的能量损失。',
                },
            ],
        });

        const response = await platform.agentConversation({
            userId: 'agent_scope_user',
            sessionId: 'session_absorption',
            message: '解释一下吸收系数和光学衰减',
            scope: {
                corpusId: 'optics',
                languages: ['zh'],
            },
            persistMemory: true,
        });

        expect(response.answer).toContain('吸收');
        expect(response.citations.length).toBeGreaterThan(0);
        expect(Array.isArray(response.assistantBlocks)).toBe(true);
        expect(response.assistantBlocks?.map((block) => block.type)).toEqual(
            expect.arrayContaining(['structured_answer', 'system_notice', 'citations', 'knowledge_actions', 'knowledge_run_summary'])
        );
        const structuredBlock = (response.assistantBlocks || []).find((block) => block.type === 'structured_answer');
        expect(structuredBlock).toEqual(expect.objectContaining({
            type: 'structured_answer',
        }));
        expect(
            structuredBlock && 'overviewMarkdown' in structuredBlock
                ? String(structuredBlock.overviewMarkdown || '')
                : ''
        ).toContain('## Answer Context');
        expect(
            structuredBlock && 'explanationMarkdown' in structuredBlock
                ? String(structuredBlock.explanationMarkdown || '')
                : ''
        ).toContain('## Explanation');
        expect(
            structuredBlock && 'evidenceMarkdown' in structuredBlock
                ? String(structuredBlock.evidenceMarkdown || '')
                : ''
        ).toContain('## Evidence Summary');
        expect(
            structuredBlock && 'explanationMarkdown' in structuredBlock
                ? String(structuredBlock.explanationMarkdown || '')
                : ''
        ).toContain('best scoped anchor');
        expect(
            structuredBlock && 'nextActionsMarkdown' in structuredBlock
                ? String(structuredBlock.nextActionsMarkdown || '')
                : ''
        ).toContain('## Next Actions');
        expect(
            structuredBlock && 'nextActionsMarkdown' in structuredBlock
                ? String(structuredBlock.nextActionsMarkdown || '')
                : ''
        ).toContain('Persist the latest user focus to scoped conversation memory');
        expect(response.trace.usedScope.corpusId).toBe('optics');
        expect(response.summary.appliedMemoryCount).toBeGreaterThan(0);

        const persistedMemory = await platform.searchConversationMemory({
            userId: 'agent_scope_user',
            namespace: 'conversation',
            query: '吸收系数',
            limit: 5,
        });
        expect(persistedMemory.results.length).toBeGreaterThan(0);
        expect(Array.isArray(persistedMemory.results[0]?.tags)).toBe(true);
        expect(persistedMemory.results[0]?.tags).toContain('scope_corpus:optics');
    });

    test('agent conversation groups matched sections under one knowledge point with evidence spans for compact alias queries', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_water_glass_grouped',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    language: 'en',
                    workspaceId: 'waterglass',
                    corpusId: 'waterglass',
                    content: [
                        '# Water Glass',
                        'A water glass is a physical system made of a transparent container and water.',
                        '',
                        '## Material boundary',
                        'The water glass boundary is commonly soda-lime glass that contains the liquid.',
                        '',
                        '## Thermal exchange',
                        'The water glass exchanges heat with the environment through conduction and convection.',
                    ].join('\n'),
                },
            ],
        });

        const response = await platform.agentConversation({
            userId: 'agent_grouped_user',
            sessionId: 'session_water_glass_grouped',
            message: '什么是waterglass?',
            scope: {
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
            },
            topK: 8,
            persistMemory: false,
        });

        expect(response.answer).toMatch(/^A water glass is/i);
        expect(response.answer).not.toContain('The strongest scoped match is');
        expect(response.knowledgePoints).toHaveLength(1);
        expect(response.summary.returnedKnowledgePoints).toBe(1);
        expect(response.citations.length).toBeGreaterThanOrEqual(2);

        const groupedPoint = response.knowledgePoints[0] as any;
        expect(groupedPoint.title).toBe('Water Glass');
        expect(groupedPoint.documentId).toBe('doc_water_glass_grouped');
        expect(groupedPoint.matchCount).toBeGreaterThanOrEqual(2);
        expect(groupedPoint.matchedSpans.length).toBeGreaterThanOrEqual(2);
        expect(groupedPoint.matchedSpans.map((span: any) => span.title)).toEqual(
            expect.arrayContaining(['Water Glass', 'Material boundary'])
        );
        expect(groupedPoint.citations.length).toBeGreaterThanOrEqual(2);
        expect(new Set(groupedPoint.citations.map((citation: any) => citation.documentId))).toEqual(
            new Set(['doc_water_glass_grouped'])
        );
    });

    test('agent conversation recovers a title-like knowledge point when the active scope misses another corpus', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_financial_scope',
                    sourcePath: 'Knowledge_Base/financial/liquidity.md',
                    language: 'en',
                    workspaceId: 'financial',
                    corpusId: 'financial',
                    content: '# Liquidity\nLiquidity analysis explains cash conversion and working capital timing.',
                },
                {
                    documentId: 'doc_water_glass_scope_recovery',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    language: 'en',
                    workspaceId: 'waterglass',
                    corpusId: 'waterglass',
                    content: [
                        '# Water Glass',
                        'A water glass is a transparent drinking vessel that contains water for use.',
                        '',
                        '## Material role',
                        'The water glass body provides a boundary between the liquid and the environment.',
                    ].join('\n'),
                },
            ],
        });

        const response = await platform.agentConversation({
            userId: 'agent_scope_recovery_user',
            sessionId: 'session_scope_recovery',
            message: 'what is water glass?',
            scope: {
                workspaceId: 'financial',
                corpusId: 'financial',
                sourcePathPrefixes: ['Knowledge_Base/financial'],
            },
            topK: 8,
            persistMemory: false,
        });

        expect(response.answer).toMatch(/^A water glass is/i);
        expect(response.knowledgePoints).toHaveLength(1);
        expect(response.summary.returnedKnowledgePoints).toBe(1);
        expect(response.summary.returnedCitations).toBeGreaterThanOrEqual(2);
        expect(response.trace.usedScope.scopeSource).toBe('planner_scope_recovery');
        expect(response.trace.retrieval.retrievalModes).toContain('planner_scope_recovery');
        expect(response.trace.planner?.titleHitDocumentIds).toContain('doc_water_glass_scope_recovery');

        const recoveredPoint = response.knowledgePoints[0] as any;
        expect(recoveredPoint.documentId).toBe('doc_water_glass_scope_recovery');
        expect(recoveredPoint.sourcePath).toBe('Knowledge_Base/waterglass/water glass.md');
        expect(recoveredPoint.matchCount).toBeGreaterThanOrEqual(2);
        expect(recoveredPoint.matchedSpans.map((span: any) => span.title)).toEqual(
            expect.arrayContaining(['Water Glass', 'Material role'])
        );
    });

    test('workflow artifact review follow-up consumes review cards and archives completed batches', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_follow_up',
                    sourcePath: 'Knowledge_Base/waterglass/water glass.md',
                    language: 'en',
                    workspaceId: 'waterglass',
                    corpusId: 'waterglass',
                    content: '# Water Glass\nA water glass is a transparent drinking vessel that contains water for use.',
                },
            ],
        });

        const conversation = await platform.agentConversation({
            userId: 'follow_up_user',
            sessionId: 'follow_up_session',
            message: 'what is water glass?',
            scope: {
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
            },
            persistMemory: false,
        });

        const artifacts = await platform.queryWorkflowArtifacts({
            workspaceId: 'waterglass',
            userId: 'follow_up_user',
            artifactKinds: ['flashcard_batch', 'knowledge_run'],
            limit: 10,
        });
        const flashcardArtifact = artifacts.artifacts.find((artifact) => artifact.kind === 'flashcard_batch');
        const knowledgeRunArtifact = artifacts.artifacts.find((artifact) => artifact.kind === 'knowledge_run');
        expect(flashcardArtifact).toBeDefined();
        expect(knowledgeRunArtifact).toBeDefined();
        expect((knowledgeRunArtifact?.payload as any)?.graphContext).toEqual(expect.objectContaining({
            anchorTitle: 'Water Glass',
            diagnostics: expect.objectContaining({
                graphOpsAvailable: false,
                usedFallback: true,
            }),
        }));

        const reviewCards = ((flashcardArtifact?.payload || {}) as any).reviewCards || [];
        expect(reviewCards).toHaveLength(1);

        const followUp = await platform.executeWorkflowArtifactReviewFollowUp({
            userId: 'follow_up_user',
            sessionId: 'follow_up_session',
            artifactId: String(flashcardArtifact?.artifactId || ''),
            cardId: String(reviewCards[0]?.cardId || ''),
            action: {
                atomId: String(reviewCards[0]?.atomId || conversation.knowledgePoints[0]?.atomId || ''),
                kind: 'review',
                source: 'flashcard_batch',
                prompt: String(reviewCards[0]?.prompt || ''),
            },
            persistMemory: false,
        });

        expect(followUp.consumedCardId).toBe(String(reviewCards[0]?.cardId || ''));
        expect(followUp.completedReviewCardCount).toBe(1);
        expect(followUp.remainingReviewCardCount).toBe(0);
        expect(followUp.archivedArtifact).toBe(true);
        expect(followUp.artifact.status).toBe('archived');
        expect((followUp.artifact.payload.reviewState as any).consumedCardIds).toEqual([
            String(reviewCards[0]?.cardId || ''),
        ]);
        expect(followUp.relatedKnowledgeRunArtifact?.status).toBe('archived');
        expect(((followUp.relatedKnowledgeRunArtifact?.payload || {}) as any).knowledgeRun.summary.completedReviewCardCount).toBe(1);
        expect(((followUp.relatedKnowledgeRunArtifact?.payload || {}) as any).knowledgeRun.summary.remainingReviewCardCount).toBe(0);

        const refreshedArtifacts = await platform.queryWorkflowArtifacts({
            workspaceId: 'waterglass',
            userId: 'follow_up_user',
            artifactKinds: ['flashcard_batch'],
            limit: 10,
        });
        const refreshedFlashcardArtifact = refreshedArtifacts.artifacts.find((artifact) => artifact.artifactId === flashcardArtifact?.artifactId);
        expect(refreshedFlashcardArtifact?.status).toBe('archived');
        expect((refreshedFlashcardArtifact?.payload.reviewState as any).remainingReviewCardCount).toBe(0);
    });

    test('agent conversation explanation and next actions adapt to comparison-style queries', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_compare_scope',
                    sourcePath: 'Knowledge_Base/optics/reflection.md',
                    language: 'en',
                    content: '# Reflection\nReflection and absorption differ in how optical energy is redirected versus dissipated.\n\n## Support\nSee [[Transmission]].',
                },
                {
                    documentId: 'doc_compare_scope_2',
                    sourcePath: 'Knowledge_Base/optics/transmission.md',
                    language: 'en',
                    content: '# Transmission\nTransmission complements reflection when comparing optical interface behavior.',
                },
            ],
        });

        const response = await platform.agentConversation({
            userId: 'agent_compare_user',
            sessionId: 'session_compare_scope',
            message: 'compare reflection vs absorption',
            scope: {
                corpusId: 'optics',
                languages: ['en'],
            },
            persistMemory: true,
        });

        const structuredBlock = (response.assistantBlocks || []).find((block) => block.type === 'structured_answer');
        expect(
            structuredBlock && 'explanationMarkdown' in structuredBlock
                ? String(structuredBlock.explanationMarkdown || '')
                : ''
        ).toContain('comparison baseline');
        expect(
            structuredBlock && 'overviewMarkdown' in structuredBlock
                ? String(structuredBlock.overviewMarkdown || '')
                : ''
        ).toContain('Graph-supported relations');
        expect(
            structuredBlock && 'explanationMarkdown' in structuredBlock
                ? String(structuredBlock.explanationMarkdown || '')
                : ''
        ).toContain('Supporting comparison nodes');
        expect(
            structuredBlock && 'explanationMarkdown' in structuredBlock
                ? String(structuredBlock.explanationMarkdown || '')
                : ''
        ).toContain('Graph support around');
        expect(
            structuredBlock && 'nextActionsMarkdown' in structuredBlock
                ? String(structuredBlock.nextActionsMarkdown || '')
                : ''
        ).toContain('inspect the strongest nodes side by side');
        expect(response.trace.graphContext).toEqual(expect.objectContaining({
            anchorTitle: 'Reflection',
            relationKinds: expect.arrayContaining(['reference']),
            temporalValidity: expect.objectContaining({
                allPointsValid: true,
            }),
        }));
        expect((response.trace.graphContext as any).relationSummaries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                relationKind: 'reference',
            }),
        ]));
        expect((response.trace.graphContext as any).knowledgePointRelations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                relationKind: 'reference',
                sourceTitle: 'Reflection',
                targetTitle: 'Transmission',
            }),
        ]));
        expect(
            structuredBlock && 'explanationMarkdown' in structuredBlock
                ? String(structuredBlock.explanationMarkdown || '')
                : ''
        ).toContain('Reflection -> reference -> Transmission');
        expect(
            structuredBlock && 'nextActionsMarkdown' in structuredBlock
                ? String(structuredBlock.nextActionsMarkdown || '')
                : ''
        ).toContain('Follow the direct graph path between Reflection and Transmission');
        expect((response.knowledgePoints[0] as any).relationKinds).toContain('reference');
    });

    test('agent conversation enriches graph context with explicit store path chains between returned knowledge points', async () => {
        const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-agent-conversation-paths-'));
        const storePath = path.join(tempDir, 'knowledge_graph.snapshot.json');
        const opsStore = createKnowledgeGraphStore({
            backend: 'file',
            filePath: storePath,
        });
        const opsPlatform = new KnowledgeLearningPlatform({
            nowProvider: () => new Date('2026-06-13T00:00:00.000Z'),
            store: opsStore,
            autoPersist: true,
        });

        try {
            await opsPlatform.ingestKnowledge({
                incremental: true,
                documents: [
                    {
                        documentId: 'doc_foundation',
                        sourcePath: 'Knowledge_Base/optics/foundation.md',
                        language: 'en',
                        content: '# Foundation Note\nFoundation note stabilizes the optics chain.',
                    },
                    {
                        documentId: 'doc_bridge',
                        sourcePath: 'Knowledge_Base/optics/bridge.md',
                        language: 'en',
                        content: '# Bridge Layer\nBridge layer links the foundation into the target concept.\n\nSee [[Ground State]].',
                    },
                    {
                        documentId: 'doc_target',
                        sourcePath: 'Knowledge_Base/optics/ground-state.md',
                        language: 'en',
                        content: '# Ground State\nGround state is the target optical state.\n\nSee [[Foundation Note]].',
                    },
                ],
            });

            const snapshot = await opsStore.loadSnapshot();
            expect(snapshot).not.toBeNull();
            if (!snapshot) {
                throw new Error('Expected persisted snapshot for path query test.');
            }

            const foundationAtom = snapshot.atoms.find((atom) => atom.title === 'Foundation Note');
            const bridgeAtom = snapshot.atoms.find((atom) => atom.title === 'Bridge Layer');
            const targetAtom = snapshot.atoms.find((atom) => atom.title === 'Ground State');
            expect(foundationAtom).toBeDefined();
            expect(bridgeAtom).toBeDefined();
            expect(targetAtom).toBeDefined();

            snapshot.relationEdges.push(
                {
                    id: 'edge_foundation_bridge',
                    sourceAtomId: String(foundationAtom?.id || ''),
                    targetAtomId: String(bridgeAtom?.id || ''),
                    relationKind: 'prerequisite',
                    provenance: 'fact',
                    confidence: 0.91,
                    evidenceSpanIds: [],
                    temporal: {
                        validFrom: '2026-06-13T00:00:00.000Z',
                    },
                },
                {
                    id: 'edge_bridge_target',
                    sourceAtomId: String(bridgeAtom?.id || ''),
                    targetAtomId: String(targetAtom?.id || ''),
                    relationKind: 'reference',
                    provenance: 'fact',
                    confidence: 0.88,
                    evidenceSpanIds: [],
                    temporal: {
                        validFrom: '2026-06-13T00:00:00.000Z',
                    },
                },
            );
            await opsStore.saveSnapshot(snapshot);

            const response = await opsPlatform.agentConversation({
                userId: 'agent_path_user',
                sessionId: 'session_path_user',
                message: 'explain ground state foundation chain',
                scope: {
                    corpusId: 'optics',
                    sourcePathPrefixes: ['Knowledge_Base/optics'],
                    documentIds: ['doc_foundation', 'doc_target'],
                },
                persistMemory: false,
            });

            expect((response.trace.graphContext as any)?.connectionPaths).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    sourceTitle: 'Foundation Note',
                    targetTitle: 'Ground State',
                    pathTitles: ['Foundation Note', 'Bridge Layer', 'Ground State'],
                    length: 2,
                    pathEdges: expect.arrayContaining([
                        expect.objectContaining({
                            fromAtomId: String(foundationAtom?.id || ''),
                            toAtomId: String(bridgeAtom?.id || ''),
                            relationKind: 'prerequisite',
                        }),
                        expect.objectContaining({
                            fromAtomId: String(bridgeAtom?.id || ''),
                            toAtomId: String(targetAtom?.id || ''),
                            relationKind: 'reference',
                        }),
                    ]),
                }),
            ]));
            expect((response.trace.graphContext as any)?.predecessorWindow).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    atomId: String(bridgeAtom?.id || ''),
                    title: 'Bridge Layer',
                    relationKind: 'reference',
                }),
            ]));
            expect((response.trace.graphContext as any)?.diagnostics).toEqual(expect.objectContaining({
                graphOpsAvailable: true,
                usedFallback: false,
                candidateCount: expect.any(Number),
                pathDepthLimit: 6,
            }));
            expect(response.knowledgePoints[0]?.title).toBe('Ground State');

            const structuredBlock = (response.assistantBlocks || []).find((block) => block.type === 'structured_answer');
            expect(
                structuredBlock && 'explanationMarkdown' in structuredBlock
                    ? String(structuredBlock.explanationMarkdown || '')
                    : ''
            ).toContain('Foundation Note -> prerequisite -> Bridge Layer -> reference -> Ground State');
            expect(
                structuredBlock && 'explanationMarkdown' in structuredBlock
                    ? String(structuredBlock.explanationMarkdown || '')
                    : ''
            ).toContain('Immediate predecessor window: Bridge Layer');
            expect(
                structuredBlock && 'nextActionsMarkdown' in structuredBlock
                    ? String(structuredBlock.nextActionsMarkdown || '')
                    : ''
            ).toContain('Review the path order: Foundation Note -> Bridge Layer -> Ground State');
        } finally {
            opsStore.close?.();
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('agent conversation explanation and next actions adapt to how-to queries', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_howto_scope',
                    sourcePath: 'Knowledge_Base/optics/calibration.md',
                    language: 'en',
                    content: '# Calibration\nCalibration sequence requires establishing a baseline measurement, then validating response drift.',
                },
            ],
        });

        const response = await platform.agentConversation({
            userId: 'agent_howto_user',
            sessionId: 'session_howto_scope',
            message: 'how to calibrate optical response',
            scope: {
                corpusId: 'optics',
                languages: ['en'],
            },
            persistMemory: true,
        });

        const structuredBlock = (response.assistantBlocks || []).find((block) => block.type === 'structured_answer');
        expect(
            structuredBlock && 'explanationMarkdown' in structuredBlock
                ? String(structuredBlock.explanationMarkdown || '')
                : ''
        ).toContain('starting anchor for the next concrete steps');
        expect(
            structuredBlock && 'nextActionsMarkdown' in structuredBlock
                ? String(structuredBlock.nextActionsMarkdown || '')
                : ''
        ).toContain('move from explanation into concrete guided-learning or focus-mode steps');
    });

    test('agent conversation assembles document-augmented RAG context for richer scoped answers', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_agent_rag_water_glass',
                    sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
                    language: 'en',
                    workspaceId: 'waterglass',
                    corpusId: 'waterglass',
                    content: [
                        '# Water Glass',
                        '',
                        '## Definition',
                        '',
                        'A water glass is a transparent drinking vessel that contains water.',
                        '',
                        '## Boundary',
                        '',
                        'The vessel boundary and the water surface jointly determine the observed optical behavior.',
                    ].join('\n'),
                },
            ],
        });

        const response = await platform.agentConversation({
            userId: 'agent_rag_user',
            sessionId: 'session_rag_scope',
            message: 'what is water glass?',
            scope: {
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
            },
            persistMemory: false,
        });

        expect(response.trace.ragContextPack).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
        }));
        expect(response.trace.ragContextPack?.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'direct_support',
            }),
            expect.objectContaining({
                role: 'parent_context',
                sourceBoundary: 'full_document',
            }),
            expect.objectContaining({
                role: 'graph_neighbor_support',
                sourceBoundary: 'direct_span_only',
            }),
        ]));
        expect(response.trace.ragSufficiencyReview).toEqual(expect.objectContaining({
            status: 'sufficient',
        }));
        expect(response.trace.answerClaimCitations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                supportStatus: 'supported',
                citationIds: expect.arrayContaining([
                    expect.stringMatching(/^evidence_/),
                ]),
                fragmentIds: expect.arrayContaining([
                    expect.stringContaining('rag_direct_'),
                ]),
                sourcePaths: expect.arrayContaining([
                    'Knowledge_Base/waterglass/water-glass.md',
                ]),
            }),
        ]));
        expect(response.answer).toContain('transparent drinking vessel');
        expect(response.answer).toContain('vessel boundary');
        expect(response.answer).toContain('observed optical behavior');
    });

    test('agent conversation performs one bounded recovery pass when direct spans crowd out document augmentation', async () => {
        const crowdedSections = Array.from({ length: 18 }, (_value, index) => [
            `## Water Glass Evidence ${index + 1}`,
            '',
            `Water glass evidence ${index + 1}: a water glass remains a transparent drinking vessel, and this section repeats the query terms to force a direct retrieval span.`,
        ].join('\n')).join('\n\n');
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_agent_rag_recovery_water_glass',
                    sourcePath: 'Knowledge_Base/waterglass/recovery-water-glass.md',
                    language: 'en',
                    workspaceId: 'waterglass',
                    corpusId: 'waterglass',
                    content: [
                        '# Water Glass Recovery Corpus',
                        '',
                        '## Definition',
                        '',
                        'A water glass is a transparent drinking vessel that contains water.',
                        '',
                        crowdedSections,
                        '',
                        '## Boundary',
                        '',
                        'The full source document also explains that the vessel boundary and water surface determine observed optical behavior.',
                    ].join('\n'),
                },
            ],
        });

        const response = await platform.agentConversation({
            userId: 'agent_rag_recovery_user',
            sessionId: 'session_rag_recovery_scope',
            message: 'what is water glass?',
            topK: 18,
            scope: {
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
            },
            persistMemory: false,
        });

        expect(response.trace.ragRecovery).toEqual(expect.objectContaining({
            attempted: true,
            strategy: 'expanded_context_pack',
            beforeStatus: 'borderline',
            afterStatus: 'sufficient',
            beforeReasons: expect.arrayContaining(['document_augmentation_missing']),
            afterReasons: expect.any(Array),
        }));
        expect(response.trace.ragRecovery?.addedRoleCounts).toEqual(expect.objectContaining({
            parent_context: expect.any(Number),
        }));
        expect(response.trace.ragSufficiencyReview).toEqual(expect.objectContaining({
            status: 'sufficient',
            recoveryAttempted: true,
        }));
        expect(response.trace.ragContextPack).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            budget: expect.objectContaining({
                maxFragments: expect.any(Number),
            }),
        }));
        expect(response.trace.ragContextPack?.budget.maxFragments).toBeGreaterThan(14);
        expect(response.trace.ragContextPack?.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                sourceBoundary: 'full_document',
            }),
        ]));
        expect(response.trace.ragFailureClassifications).toEqual(expect.arrayContaining([
            expect.objectContaining({
                stage: 'context_assembly',
                code: 'context_budget_limited',
                severity: 'warning',
            }),
        ]));
        expect(response.answer).toContain('transparent drinking vessel');
    });

    test('agent conversation uses optional LLM sufficiency judge for borderline legacy source windows', async () => {
        const savedAt = '2026-07-05T00:00:00.000Z';
        const sourcePath = 'tmp/missing-rag-legacy-source/water-glass.md';
        const atomContent = 'A water glass is a transparent drinking vessel that contains water.';
        const snapshot: KnowledgeGraphSnapshot = {
            schemaVersion: 2,
            savedAt,
            idCounter: 1,
            atoms: [
                {
                    id: 'atom_legacy_water_glass',
                    stableKey: 'legacy-water-glass-definition',
                    documentId: 'doc_legacy_water_glass',
                    sourcePath,
                    title: 'Water Glass',
                    content: atomContent,
                    representationType: 'text',
                    keywords: ['water', 'glass', 'transparent', 'vessel'],
                    evidenceSpanIds: ['evidence_legacy_water_glass'],
                    createdAt: savedAt,
                    updatedAt: savedAt,
                    metadata: {
                        sectionPath: ['Water Glass', 'Definition'],
                        version: 1,
                        sourceHash: 'hash_legacy_water_glass',
                        language: 'en',
                    },
                },
            ],
            evidenceSpans: [
                {
                    id: 'evidence_legacy_water_glass',
                    documentId: 'doc_legacy_water_glass',
                    sourcePath,
                    language: 'en',
                    startOffset: 0,
                    endOffset: atomContent.length,
                    startLine: 1,
                    endLine: 1,
                    snippet: atomContent,
                    sourceHash: 'hash_legacy_water_glass',
                    createdAt: savedAt,
                },
            ],
            relationEdges: [],
            temporalEdges: [],
            documents: [
                {
                    documentId: 'doc_legacy_water_glass',
                    sourcePath,
                    sourceHash: 'hash_legacy_water_glass',
                    version: 1,
                    updatedAt: savedAt,
                    atomStableKeyToId: [['legacy-water-glass-definition', 'atom_legacy_water_glass']],
                    atomIds: ['atom_legacy_water_glass'],
                    evidenceSpanIds: ['evidence_legacy_water_glass'],
                    relationEdgeIds: [],
                    temporalEdgeIds: [],
                },
            ],
            activeStableKeyToAtomId: [['legacy-water-glass-definition', 'atom_legacy_water_glass']],
            activeAtomIds: ['atom_legacy_water_glass'],
            learnerStates: [],
            tutorTraces: [],
            ingestLatencyHistoryMs: [],
            recomputeLatencyHistoryMs: [],
            queryLatencyHistoryMs: [],
            latestIngestSummary: {
                ingestedDocuments: 1,
                changedDocuments: 1,
                deletedDocuments: 0,
                activeAtoms: 1,
                activeRelationEdges: 0,
                recomputedDynamicRelations: false,
                invalidatedRelationEdges: 0,
                regeneratedRelationEdges: 0,
                resolvedRelationRecomputeMode: 'none',
                relationRecomputeLatencyMs: 0,
            },
            conversationSessions: [],
            conversationTurns: [],
            conversationInvocations: [],
            userMemory: {},
            relationEdgeSignatures: [],
        };
        const store: KnowledgeGraphStore = {
            async loadSnapshot() {
                return snapshot;
            },
            async saveSnapshot() {
                return undefined;
            },
            getDiagnostics() {
                return {
                    storeType: 'memory',
                    exists: true,
                    loaded: true,
                };
            },
        };
        const ragSufficiencyLlmJudge = jest.fn().mockResolvedValue({
            status: 'sufficient',
            score: 0.81,
            reasons: ['legacy_source_span_answerable'],
            degradationState: 'none',
        });
        const legacyPlatform = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(savedAt),
            store,
            autoPersist: false,
            ragSufficiencyLlmJudge,
        });

        const response = await legacyPlatform.agentConversation({
            userId: 'agent_rag_llm_user',
            sessionId: 'session_rag_llm_scope',
            message: 'what is water glass?',
            persistMemory: false,
        });

        expect(response.trace.ragContextPack?.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                status: 'source_window_unavailable',
            }),
        ]));
        expect(ragSufficiencyLlmJudge).toHaveBeenCalledTimes(1);
        expect(response.trace.ragSufficiencyReview).toEqual(expect.objectContaining({
            status: 'sufficient',
            score: 0.81,
            deterministic: false,
            llmJudgeUsed: true,
            degradationState: 'none',
        }));
        expect(response.trace.ragFailureClassifications).toEqual(expect.arrayContaining([
            expect.objectContaining({
                stage: 'parsing_source',
                code: 'source_window_unavailable',
                severity: 'warning',
                evidence: expect.arrayContaining(['source_window_unavailable']),
            }),
        ]));
    });

    test('agent conversation exposes readiness and miss diagnostics when scoped retrieval is empty', async () => {
        const response = await platform.agentConversation({
            userId: 'agent_miss_user',
            sessionId: 'session_miss_scope',
            message: '什么是water glass',
            scope: {
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
            },
            persistMemory: false,
        });

        expect(response.trace.workspaceReadiness).toEqual(expect.objectContaining({
            status: 'empty_store',
        }));
        expect(response.trace.missDiagnostics).toEqual(expect.objectContaining({
            reason: 'empty_store',
        }));
        expect(response.answer).toContain('当前范围');
        expect(response.answer).toContain('什么是water glass');
        expect(response.answer).not.toContain('No scoped knowledge points matched');
        expect(response.answerReleaseReview).toEqual(expect.objectContaining({
            decision: 'abstain',
            publicAnswer: response.answer,
        }));
        expect(response.trace.answerReleaseReview).toEqual(expect.objectContaining({
            decision: 'abstain',
        }));
    });

    test('memory policy diagnostics records history and improving trend snapshots', async () => {
        await platform.applyMemoryPolicy({
            userId: 'memory_diag_user',
            layer: 'session',
            operation: 'write',
            now: '2026-04-01T00:00:00.000Z',
            entries: [
                {
                    key: 'expired-entry',
                    value: 'Old expired note',
                    tags: ['diagnostic'],
                    confidence: 0.2,
                    references: [],
                    createdAt: '2026-04-01T00:00:00.000Z',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    expiresAt: '2026-04-02T00:00:00.000Z',
                },
                {
                    key: 'stale-entry',
                    value: 'Still relevant but stale',
                    tags: ['diagnostic'],
                    confidence: 0.3,
                    references: [],
                    createdAt: '2026-04-01T00:00:00.000Z',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                },
            ],
        });

        const firstDiagnostics = await platform.queryMemoryPolicyDiagnostics({
            now: '2026-04-03T08:00:00.000Z',
            staleAfterHours: 12,
            nearExpiryHours: 6,
            lowConfidenceThreshold: 0.5,
            sampleLimit: 5,
        });
        expect(firstDiagnostics.summary.expiredEntries).toBeGreaterThan(0);
        expect(firstDiagnostics.summary.lowConfidenceEntries).toBeGreaterThan(0);
        expect(firstDiagnostics.summary.status).toBe('risk');

        await platform.applyMemoryPolicy({
            userId: 'memory_diag_user',
            layer: 'session',
            operation: 'evict',
            now: '2026-04-03T09:00:00.000Z',
        });
        await platform.applyMemoryPolicy({
            userId: 'memory_diag_user',
            layer: 'session',
            operation: 'write',
            now: '2026-04-03T09:00:00.000Z',
            entries: [
                {
                    key: 'stale-entry',
                    value: 'Refreshed confidence-backed note',
                    tags: ['diagnostic'],
                    confidence: 0.92,
                    references: [],
                    createdAt: '2026-04-01T00:00:00.000Z',
                    updatedAt: '2026-04-03T09:00:00.000Z',
                },
            ],
        });

        const secondDiagnostics = await platform.queryMemoryPolicyDiagnostics({
            now: '2026-04-03T09:00:00.000Z',
            staleAfterHours: 12,
            nearExpiryHours: 6,
            lowConfidenceThreshold: 0.5,
            sampleLimit: 5,
        });
        expect(secondDiagnostics.summary.healthScore).toBeGreaterThan(firstDiagnostics.summary.healthScore);
        expect(secondDiagnostics.summary.expiredEntries).toBe(0);

        const history = await platform.queryMemoryPolicyDiagnosticsHistory({
            limit: 5,
        });
        expect(history.summary.totalRecords).toBeGreaterThanOrEqual(2);
        expect(history.records[0]?.recordedAt).toBe('2026-04-03T09:00:00.000Z');

        const trend = await platform.queryMemoryPolicyDiagnosticsTrend({
            limit: 4,
            windowSize: 1,
            minSamples: 1,
        });
        expect(trend.status).toBe('improving');
        expect(Number(trend.deltas.healthScoreDelta || 0)).toBeGreaterThan(0);
    });

    test('query backend config drives runtime queries and comparison diagnostics persist history', async () => {
        await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_query_backend_a',
                    sourcePath: 'Knowledge_Base/doc_query_backend_a.md',
                    language: 'en',
                    content: '# Evidence Router\nUse evidence-backed graph retrieval and relation paths.',
                },
                {
                    documentId: 'doc_query_backend_b',
                    sourcePath: 'Knowledge_Base/doc_query_backend_b.md',
                    language: 'en',
                    content: '# Vector Signals\nSemantic overlap should preserve temporal and evidence coverage.',
                },
            ],
        });

        expect(platform.getQueryBackendConfig().configuredBackend).toBe('local_hybrid');

        await platform.updateQueryBackendConfig({
            configuredBackend: 'keyword_only',
        });
        expect(platform.getQueryBackendConfig().configuredBackend).toBe('keyword_only');

        const keywordQuery = await platform.queryKnowledge({
            query: 'evidence graph retrieval',
            topK: 3,
            asOf: '2026-04-10T02:00:00.000Z',
        });
        expect(keywordQuery.trace.retrievalModes).toContain('keyword');
        expect(keywordQuery.trace.retrievalModes).not.toContain('vector_similarity');

        await platform.updateQueryBackendConfig({
            configuredBackend: 'local_vector',
        });
        expect(platform.getQueryBackendConfig().configuredBackend).toBe('local_vector');

        const vectorQuery = await platform.queryKnowledge({
            query: 'semantic overlap evidence',
            topK: 3,
            asOf: '2026-04-10T02:05:00.000Z',
        });
        expect(vectorQuery.trace.retrievalModes).toContain('vector_similarity');
        expect((vectorQuery.trace as Record<string, unknown>).vectorAcceleration).toBeDefined();

        const firstComparison = await platform.compareQueryBackends({
            query: 'evidence graph retrieval',
            topK: 3,
            leftBackend: 'local_hybrid',
            rightBackend: 'keyword_only',
            comparedAt: '2026-04-10T03:00:00.000Z',
        });
        expect(firstComparison.left.backend).toBe('local_hybrid');
        expect(firstComparison.right.backend).toBe('keyword_only');
        expect(typeof firstComparison.summary.overlapRatioPct).toBe('number');

        const secondComparison = await platform.compareQueryBackends({
            query: 'semantic overlap evidence',
            topK: 3,
            leftBackend: 'local_vector',
            rightBackend: 'local_hybrid',
            comparedAt: '2026-04-10T04:00:00.000Z',
        });
        expect(secondComparison.left.backend).toBe('local_vector');
        expect(secondComparison.right.backend).toBe('local_hybrid');

        const history = await platform.queryKnowledgeQueryBackendComparisonHistory({
            limit: 5,
        });
        expect(history.summary.totalRecords).toBe(2);
        expect(history.summary.returnedRecords).toBe(2);
        expect(history.records[0]?.comparedAt).toBe('2026-04-10T04:00:00.000Z');

        const trend = await platform.queryKnowledgeQueryBackendComparisonTrend({
            limit: 4,
            windowSize: 1,
            minSamples: 1,
        });
        expect(['improving', 'stable', 'regressing', 'insufficient_data']).toContain(trend.status);
        expect(trend.summary.totalRecords).toBe(2);
        expect(trend.summary.latestComparedAt).toBe('2026-04-10T04:00:00.000Z');

        const diagnostics = platform.getQueryBackendDiagnostics();
        expect(diagnostics.configuredBackend).toBe('local_vector');
        expect(diagnostics.comparisonTelemetry.totalComparisons).toBe(2);
        expect(diagnostics.runtime.ready).toBe(true);
    });

    test('knowledge staleness diagnostics and rebuild planning detect source drift', async () => {
        const tmpRoot = path.join(process.cwd(), 'tmp');
        fs.mkdirSync(tmpRoot, { recursive: true });
        const tempDir = fs.mkdtempSync(path.join(tmpRoot, 'klp-staleness-'));
        const filePath = path.join(tempDir, 'doc_staleness.md');
        const originalContent = '# Staleness\nFresh source content for diagnostics.\n';
        fs.writeFileSync(filePath, originalContent, 'utf8');

        try {
            await platform.ingestKnowledge({
                incremental: true,
                documents: [
                    {
                        documentId: 'doc_staleness_runtime',
                        sourcePath: filePath,
                        language: 'en',
                        content: originalContent,
                    },
                ],
            });

            const freshDiagnostics = await platform.queryKnowledgeStalenessDiagnostics({
                limit: 5,
            });
            expect(freshDiagnostics.summary.upToDateDocuments).toBe(1);
            expect(freshDiagnostics.summary.staleDocuments).toBe(0);

            fs.writeFileSync(filePath, `${originalContent}\nChanged downstream source.\n`, 'utf8');

            const staleDiagnostics = await platform.queryKnowledgeStalenessDiagnostics({
                limit: 5,
            });
            expect(staleDiagnostics.summary.hashMismatchDocuments).toBe(1);
            expect(staleDiagnostics.summary.staleDocuments).toBe(1);
            expect(staleDiagnostics.records[0]?.status).toBe('hash_mismatch');

            const rebuild = await platform.rebuildKnowledgeFromStalenessDiagnostics({
                limit: 5,
            });
            expect(rebuild.mode).toBe('plan_only');
            expect(rebuild.rebuilt).toBe(0);
            expect(rebuild.plannedDocuments).toBe(1);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('learning quality and session plan quality diagnostics use execution-backed history', async () => {
        const ingest = await platform.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_quality_a',
                    sourcePath: 'Knowledge_Base/doc_quality_a.md',
                    language: 'en',
                    content: '# Quality A\nRetrieval practice with evidence-backed review loops.',
                },
                {
                    documentId: 'doc_quality_b',
                    sourcePath: 'Knowledge_Base/doc_quality_b.md',
                    language: 'en',
                    content: '# Quality B\nDivergence tasks should stay budget-aware and evidence-bound.',
                },
            ],
        });
        const atomA = ingest.atoms[0]?.id as string;
        const atomB = ingest.atoms[1]?.id as string;
        const evidenceA = ingest.atoms[0]?.evidenceSpanIds?.[0] as string;
        const evidenceB = ingest.atoms[1]?.evidenceSpanIds?.[0] as string;

        await platform.executeStudySessionPlan({
            userId: 'quality_runtime_user',
            executedAt: '2026-04-11T08:05:00.000Z',
            actionLimit: 3,
            sessionPlan: {
                userId: 'quality_runtime_user',
                generatedAt: '2026-04-11T08:00:00.000Z',
                actions: [
                    {
                        id: 'strong-action-1',
                        atomId: atomA,
                        kind: 'review',
                        source: 'mastery_path',
                        priority: 98,
                        expectedGain: 0.18,
                        rationale: 'Repair retrieval precision with cited evidence.',
                        evidenceSpanIds: [evidenceA],
                        relationPathAtomIds: [atomA],
                        estimatedMinutes: 5,
                    },
                    {
                        id: 'strong-action-2',
                        atomId: atomA,
                        kind: 'quiz',
                        source: 'misconception_remediation',
                        priority: 94,
                        expectedGain: 0.16,
                        rationale: 'Verify misconception remediation with a targeted quiz.',
                        evidenceSpanIds: [evidenceA],
                        relationPathAtomIds: [atomA],
                        estimatedMinutes: 4,
                    },
                    {
                        id: 'strong-action-3',
                        atomId: atomB,
                        kind: 'review',
                        source: 'retrain_plan',
                        priority: 88,
                        expectedGain: 0.14,
                        rationale: 'Stage a recovery-oriented follow-up before divergence.',
                        evidenceSpanIds: [evidenceB],
                        relationPathAtomIds: [atomB],
                        estimatedMinutes: 4,
                    },
                ],
                signals: {
                    misconceptions: [],
                    dueRetrainAtoms: [atomB],
                    masteryPathTargets: [atomA],
                    divergenceTargets: [],
                },
                summary: {
                    totalActions: 3,
                    totalEstimatedMinutes: 13,
                    evidenceCoverageRatio: 1,
                },
            },
        });

        await platform.executeStudySessionPlan({
            userId: 'quality_runtime_user',
            executedAt: '2026-04-12T08:05:00.000Z',
            actionLimit: 4,
            maxActions: 4,
            sessionPlan: {
                userId: 'quality_runtime_user',
                generatedAt: '2026-04-12T08:00:00.000Z',
                actions: [
                    {
                        id: 'weak-action-1',
                        atomId: atomB,
                        kind: 'transfer',
                        source: 'divergence_path',
                        priority: 36,
                        expectedGain: 0.06,
                        rationale: 'Push divergence without recovery context.',
                        evidenceSpanIds: [],
                        relationPathAtomIds: [atomB],
                        estimatedMinutes: 4,
                    },
                ],
                signals: {
                    misconceptions: [],
                    dueRetrainAtoms: [],
                    masteryPathTargets: [],
                    divergenceTargets: [atomB],
                },
                summary: {
                    totalActions: 1,
                    totalEstimatedMinutes: 4,
                    evidenceCoverageRatio: 0,
                },
            },
        });

        const learningHistory = await platform.queryLearningQualityHistory({
            userId: 'quality_runtime_user',
            limit: 5,
        });
        expect(learningHistory.summary.totalRecords).toBeGreaterThanOrEqual(2);
        expect(learningHistory.summary.returnedRecords).toBeGreaterThanOrEqual(2);
        expect(learningHistory.records[0]?.snapshot).toBeDefined();

        const learningTrend = await platform.queryLearningQualityTrend({
            userId: 'quality_runtime_user',
            limit: 4,
            windowSize: 1,
            minSamples: 1,
        });
        expect(['improving', 'stable', 'regressing', 'insufficient_data']).toContain(learningTrend.status);
        expect(learningTrend.summary.totalRecords).toBeGreaterThanOrEqual(2);

        const qualityThresholds = platform.getLearningQualityThresholds();
        expect(qualityThresholds.queryP95Ms).toBeGreaterThan(0);
        expect(qualityThresholds.evidenceBackedSuggestionRatioPct).toBeGreaterThan(0);

        const sessionQualityHistory = await platform.queryStudySessionPlanQualityHistory({
            userId: 'quality_runtime_user',
            limit: 5,
        });
        expect(sessionQualityHistory.summary.totalRecords).toBeGreaterThanOrEqual(2);
        expect(sessionQualityHistory.summary.overallPassRatePct).toBeLessThan(100);
        expect(Array.isArray(sessionQualityHistory.summary.commonFailedGates)).toBe(true);

        const sessionQualityTrend = await platform.queryStudySessionPlanQualityTrend({
            userId: 'quality_runtime_user',
            limit: 4,
            windowSize: 1,
            minSamples: 1,
        });
        expect(sessionQualityTrend.status).toBe('regressing');
        expect(sessionQualityTrend.summary.totalRecords).toBeGreaterThanOrEqual(2);

        const runtimeThresholds = await platform.queryStudySessionPlanQualityRuntimeThresholds({
            userId: 'quality_runtime_user',
            adaptiveThresholdsEnabled: true,
            historyLimit: 5,
            trendLimit: 4,
            trendWindowSize: 1,
            trendMinSamples: 1,
        });
        expect(runtimeThresholds.thresholds.minTotalActions).toBeGreaterThan(0);
        expect(runtimeThresholds.summary.totalRecords).toBeGreaterThanOrEqual(2);
        expect(runtimeThresholds.summary.latestEvaluatedAt).toBe('2026-04-12T08:05:00.000Z');
    });

    test('foundation readiness and backend baseline sufficiency reflect embedded graph and ann signals', async () => {
        const tmpRoot = path.join(process.cwd(), 'tmp');
        fs.mkdirSync(tmpRoot, { recursive: true });
        const tempDir = fs.mkdtempSync(path.join(tmpRoot, 'klp-foundation-'));
        const sqlitePath = path.join(tempDir, 'knowledge_graph_store.graphdb.v1.sqlite');
        const fallbackPath = path.join(tempDir, 'knowledge_graph_store.v1.json');
        let adapter: ReturnType<typeof createGraphDbSnapshotAdapter> | null = null;

        try {
            adapter = createGraphDbSnapshotAdapter({
                provider: 'sqlite',
                sqlitePath,
                adapterId: 'embedded-sqlite-graphdb',
            });
            expect(adapter).not.toBeNull();

            const readinessStore = createKnowledgeGraphStore({
                backend: 'graphdb',
                filePath: fallbackPath,
                graphdb: {
                    adapter,
                },
                graphDbFallbackEnabled: false,
                graphDbOperationMode: 'ops_preferred',
            });
            const readinessPlatform = new KnowledgeLearningPlatform({
                nowProvider: () => new Date(nowIso),
                store: readinessStore,
            });

            await readinessPlatform.ingestKnowledge({
                incremental: true,
                documents: [
                    {
                        documentId: 'doc_foundation_readiness',
                        sourcePath: 'Knowledge_Base/doc_foundation_readiness.md',
                        language: 'en',
                        content: '# Foundation Readiness\nEmbedded graph and ANN readiness should be measurable.',
                    },
                ],
            });

            const readiness = await readinessPlatform.getFoundationReadiness();
            expect(readiness.status).toBe('integrated');
            expect(readiness.decision).toBe('go');
            expect(readiness.baseline.storeType).toBe('sqlite');
            expect(readiness.baseline.graphBackendStatus).toBe('independent');
            expect(readiness.baseline.graphBackendSignalKind).toBe('embedded_graphdb');
            expect(readiness.baseline.graphBackendIndependent).toBe(true);
            expect(readiness.baseline.queryBackendDefaultMode).toBe('local_hybrid');
            expect(readiness.baseline.vectorAdapterStatus).toBe('independent');
            expect(readiness.baseline.vectorAdapterSignalKind).toBe('embedding_ann');
            expect(readiness.promotionCriteriaPassed).toBe(readiness.promotionCriteriaTotal);
            expect(readiness.promotionCriteriaSatisfiedIds).toEqual(
                expect.arrayContaining([
                    'store_backend_evidence_present',
                    'graph_backend_independent',
                    'query_backend_boundary_present',
                    'vector_backend_present',
                    'vector_backend_independent',
                    'docs_aligned',
                    'readiness_verifier_present',
                ])
            );
            expect(readiness.mandatoryChecks).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        gateId: 'foundation_runtime_proof',
                        command: 'npm run verify:foundation:sqlite-runtime',
                    }),
                    expect.objectContaining({
                        gateId: 'foundation_runtime_heavy_proof',
                        command: 'npm run verify:foundation:sqlite-runtime:heavy',
                    }),
                    expect.objectContaining({
                        gateId: 'foundation_runtime_matrix_proof',
                        command: 'npm run verify:foundation:sqlite-runtime:matrix',
                    }),
                    expect.objectContaining({
                        gateId: 'foundation_runtime_release_proof',
                        command: 'npm run verify:foundation:sqlite-runtime:release',
                    }),
                    expect.objectContaining({
                        gateId: 'vector_runtime_proof',
                        command: 'npm run verify:foundation:ann-runtime',
                    }),
                    expect.objectContaining({
                        gateId: 'vector_runtime_matrix_proof',
                        command: 'npm run verify:foundation:ann-runtime:matrix',
                    }),
                    expect.objectContaining({
                        gateId: 'vector_runtime_release_proof',
                        command: 'npm run verify:foundation:ann-runtime:release',
                    }),
                    expect.objectContaining({
                        gateId: 'foundation_release_evidence_freshness',
                        command: 'npm run verify:foundation:release-evidence',
                    }),
                    expect.objectContaining({
                        gateId: 'foundation_release_evidence_history',
                        command: 'npm run verify:foundation:release-evidence:strict',
                    }),
                ])
            );

            const sufficiency = await readinessPlatform.getBackendBaselineSufficiency();
            expect(sufficiency.sufficient).toBe(true);
            expect(sufficiency.checks.knowledgeGraph.passed).toBe(true);
            expect(sufficiency.checks.queryBackend.passed).toBe(true);
            expect(sufficiency.checks.vectorIndex.passed).toBe(true);
        } finally {
            try {
                adapter?.close?.();
            } catch {
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

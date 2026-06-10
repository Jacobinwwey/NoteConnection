import { buildWorkspaceExportBundle } from './WorkspaceExportBundle';

describe('WorkspaceExportBundle', () => {
    test('builds deterministic slim bundles with readiness failures when projections lack indexed units', () => {
        const bundle = buildWorkspaceExportBundle({
            request: {
                workspaceId: 'optics',
                exportProfileId: 'mobile-slim',
            },
            workspace: {
                workspaceId: 'optics',
                corpusId: 'optics',
                name: 'optics',
                sourcePathPrefix: 'knowledge_base/optics',
                languages: ['zh', 'en'],
                exportProfileId: 'mobile-slim',
                status: 'active',
                createdAt: '2026-05-26T00:00:00.000Z',
                updatedAt: '2026-05-26T00:00:00.000Z',
            },
            bindings: [],
            resources: [],
            projections: [
                {
                    projectionId: 'projection_1',
                    resourceId: 'resource_1',
                    projectionKind: 'knowledge_document',
                    stableKey: 'knowledge_document:doc_a',
                    status: 'active',
                    documentId: 'doc_a',
                    sourcePath: 'Knowledge_Base/optics/doc_a.md',
                    workspaceId: 'optics',
                    corpusId: 'optics',
                    metadata: {},
                    createdAt: '2026-05-26T00:00:00.000Z',
                    updatedAt: '2026-05-26T00:00:00.000Z',
                    deletedAt: null,
                },
            ],
            indexSummary: {
                totalUnits: 0,
                totalSegments: 0,
                states: {
                    pending: 0,
                    indexing: 0,
                    indexed: 0,
                    failed: 0,
                    disabled: 0,
                },
                activeDocuments: 0,
                activeAtomUnits: 0,
            },
            units: [],
            segments: [],
            atoms: [],
            evidenceSpans: [],
            relationEdges: [],
            temporalEdges: [],
            sessionStates: [],
            conversationSessions: [],
            conversationTurns: [],
            conversationInvocations: [],
            workflowArtifacts: [],
            memoryEntries: [],
            memoryAuditRecords: [],
            generatedAt: '2026-05-26T00:00:00.000Z',
        });

        const secondBundle = buildWorkspaceExportBundle({
            request: {
                workspaceId: 'optics',
                exportProfileId: 'mobile-slim',
            },
            workspace: bundle.workspace,
            bindings: bundle.bindings,
            resources: bundle.resources,
            projections: bundle.projections,
            indexSummary: bundle.index.summary,
            units: bundle.index.units,
            segments: bundle.index.segments,
            atoms: bundle.graph.atoms,
            evidenceSpans: bundle.graph.evidenceSpans,
            relationEdges: bundle.graph.relationEdges,
            temporalEdges: bundle.graph.temporalEdges,
            sessionStates: bundle.runtime.sessionStates,
            conversationSessions: bundle.runtime.conversationSessions,
            conversationTurns: bundle.runtime.conversationTurns,
            conversationInvocations: bundle.runtime.conversationInvocations,
            workflowArtifacts: bundle.runtime.workflowArtifacts,
            memoryEntries: bundle.memory.entries,
            memoryAuditRecords: bundle.memory.auditRecords,
            generatedAt: '2026-05-26T00:00:00.000Z',
        });

        expect(bundle.manifest.packagingMode).toBe('slim');
        expect(bundle.readiness.ready).toBe(false);
        expect(bundle.readiness.missingIndexedProjectionIds).toEqual(['projection_1']);
        expect(bundle.manifest.deterministicHash).toBe(secondBundle.manifest.deterministicHash);
    });

    test('preserves conversation graph context in exported runtime turns', () => {
        const bundle = buildWorkspaceExportBundle({
            request: {
                workspaceId: 'optics',
                exportProfileId: 'mobile-slim',
            },
            workspace: {
                workspaceId: 'optics',
                corpusId: 'optics',
                name: 'optics',
                sourcePathPrefix: 'knowledge_base/optics',
                languages: ['zh', 'en'],
                exportProfileId: 'mobile-slim',
                status: 'active',
                createdAt: '2026-05-26T00:00:00.000Z',
                updatedAt: '2026-05-26T00:00:00.000Z',
            },
            bindings: [],
            resources: [],
            projections: [],
            indexSummary: {
                totalUnits: 0,
                totalSegments: 0,
                states: {
                    pending: 0,
                    indexing: 0,
                    indexed: 0,
                    failed: 0,
                    disabled: 0,
                },
                activeDocuments: 0,
                activeAtomUnits: 0,
            },
            units: [],
            segments: [],
            atoms: [],
            evidenceSpans: [],
            relationEdges: [],
            temporalEdges: [],
            sessionStates: [],
            conversationSessions: [
                {
                    sessionId: 'session_graph_context',
                    userId: 'user_graph_context',
                    workspaceId: 'optics',
                    corpusId: 'optics',
                    namespace: 'conversation',
                    createdAt: '2026-05-26T00:00:00.000Z',
                    updatedAt: '2026-05-26T00:00:00.000Z',
                    turnIds: ['turn_graph_context_1'],
                },
            ],
            conversationTurns: [
                {
                    turnId: 'turn_graph_context_1',
                    invocationId: 'invocation_graph_context_1',
                    sessionId: 'session_graph_context',
                    userId: 'user_graph_context',
                    createdAt: '2026-05-26T00:00:00.000Z',
                    updatedAt: '2026-05-26T00:00:00.000Z',
                    request: {
                        userId: 'user_graph_context',
                        sessionId: 'session_graph_context',
                        message: 'compare reflection vs absorption',
                    },
                    response: {
                        userId: 'user_graph_context',
                        sessionId: 'session_graph_context',
                        assistantMessage: 'Reflection differs from absorption.',
                        answer: 'Reflection differs from absorption.',
                        assistantBlocks: [],
                        knowledgePoints: [
                            {
                                atomId: 'atom_reflection',
                                atomIds: ['atom_reflection'],
                                documentId: 'doc_reflection',
                                sourcePath: 'Knowledge_Base/optics/reflection.md',
                                title: 'Reflection',
                                summary: 'Reflection redirects optical energy.',
                                evidenceSnippet: 'Reflection redirects optical energy.',
                                score: 0.9,
                                citation: null,
                                capabilities: [],
                                relationPath: [
                                    {
                                        edgeId: 'edge_reflection_reference',
                                        sourceAtomId: 'atom_reflection',
                                        targetAtomId: 'atom_transmission',
                                        relationKind: 'reference',
                                        confidence: 0.8,
                                    },
                                ],
                                relationPathAtomIds: ['atom_transmission'],
                                relationKinds: ['reference'],
                                temporalValidity: {
                                    isValid: true,
                                    checkedAt: '2026-05-26T00:00:00.000Z',
                                    reasons: ['atom_active'],
                                },
                            },
                        ],
                        citations: [],
                        recalledMemories: [],
                        memoryActions: [],
                        summary: {
                            generatedAt: '2026-05-26T00:00:00.000Z',
                            topK: 6,
                            returnedKnowledgePoints: 1,
                            returnedCitations: 0,
                            recalledMemoryCount: 0,
                            appliedMemoryCount: 0,
                            queryEvidenceCoverageRatioPct: 0,
                        },
                        trace: {
                            sessionId: 'session_graph_context',
                            invocationId: 'invocation_graph_context_1',
                            retrieval: {
                                retrievalModes: ['keyword', 'graph'],
                                asOf: '2026-05-26T00:00:00.000Z',
                                totalActiveAtoms: 1,
                                modeWeights: {
                                    keyword: 0.5,
                                    graph: 0.5,
                                    temporal: 0,
                                },
                                latencyMs: 4,
                                evidenceCoverageRatio: 0,
                            },
                            recalledMemoryCount: 0,
                            appliedMemoryCount: 0,
                            usedScope: {
                                source: 'scoped',
                                workspaceId: 'optics',
                                corpusId: 'optics',
                                documentIds: ['doc_reflection'],
                                atomIds: ['atom_reflection'],
                                sourcePathPrefixes: ['Knowledge_Base/optics'],
                                languages: ['en'],
                                matchedAtomCount: 1,
                            },
                            graphContext: {
                                anchorAtomId: 'atom_reflection',
                                anchorTitle: 'Reflection',
                                anchorDocumentId: 'doc_reflection',
                                supportingAtomIds: ['atom_transmission'],
                                supportingTitles: ['Transmission'],
                                relationKinds: ['reference'],
                                relationSummaries: [
                                    {
                                        relationKind: 'reference',
                                        edgeIds: ['edge_reflection_reference'],
                                        sourceAtomIds: ['atom_reflection'],
                                        targetAtomIds: ['atom_transmission'],
                                        averageConfidence: 0.8,
                                    },
                                ],
                                temporalValidity: {
                                    checkedAt: '2026-05-26T00:00:00.000Z',
                                    allPointsValid: true,
                                    warningReasons: [],
                                    invalidKnowledgePointTitles: [],
                                    edgeKinds: ['supersedes'],
                                    details: [
                                        {
                                            edgeId: 'temporal_reflection_supersedes',
                                            edgeKind: 'supersedes',
                                            sourceAtomId: 'atom_reflection_old',
                                            targetAtomId: 'atom_reflection',
                                            validFrom: '2026-05-25T00:00:00.000Z',
                                            isActive: true,
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            ],
            conversationInvocations: [],
            workflowArtifacts: [],
            memoryEntries: [],
            memoryAuditRecords: [],
            generatedAt: '2026-05-26T00:00:00.000Z',
        });

        expect(bundle.runtime.conversationTurns).toHaveLength(1);
        expect((bundle.runtime.conversationTurns[0] as any).response.trace.graphContext).toEqual(
            expect.objectContaining({
                anchorAtomId: 'atom_reflection',
                relationKinds: ['reference'],
                relationSummaries: expect.arrayContaining([
                    expect.objectContaining({
                        relationKind: 'reference',
                        sourceAtomIds: ['atom_reflection'],
                    }),
                ]),
                temporalValidity: expect.objectContaining({
                    edgeKinds: ['supersedes'],
                    details: expect.arrayContaining([
                        expect.objectContaining({
                            edgeId: 'temporal_reflection_supersedes',
                            edgeKind: 'supersedes',
                            sourceAtomId: 'atom_reflection_old',
                        }),
                    ]),
                }),
            })
        );
    });
});

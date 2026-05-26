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
});

import { createHash } from 'crypto';
import { resolvePlatformCapabilities } from '../platform/PlatformCapabilities';
import { resolveRenderMaterializationDecision } from '../platform/RenderMaterializer';
import type {
    WorkspaceExportBundle,
    WorkspaceExportGraphFocusReport,
    WorkspaceExportKnowledgeRunAnswerReleaseReviewReport,
    WorkspaceExportKnowledgeRunReport,
    WorkspaceExportBundleRequest,
    WorkspaceScopedMemoryExportRecord,
} from './types';
import type { AgentConversationInvocationRecord, AgentConversationSessionRecord, AgentConversationTurnRecord, EvidenceSpan, KnowledgeAtom, RelationEdge, TemporalEdge } from '../learning/types';
import type { IndexLifecycleSummary, IndexSegmentRecord, IndexUnitRecord } from '../indexing/types';
import type { MemoryAuditRecord } from '../memory/types';
import type { CanonicalResourceRecord, ResourceProjectionRecord } from '../resources/types';
import type { LearningSessionStateRecord } from '../session/types';
import type { WorkflowArtifactRecord } from '../workflows/types';
import type { WorkspaceBindingRecord, WorkspaceRecord } from '../workspace/types';

function compareStrings(left: string, right: string): number {
    return String(left || '').localeCompare(String(right || ''));
}

function cloneJsonRecord<T extends Record<string, unknown>>(value: T): T {
    return { ...value };
}

function sortAndCloneBindings(bindings: WorkspaceBindingRecord[]): WorkspaceBindingRecord[] {
    return bindings
        .slice()
        .sort((left, right) => compareStrings(left.bindingId, right.bindingId))
        .map((binding) => ({ ...binding }));
}

function sortAndCloneResources(resources: CanonicalResourceRecord[]): CanonicalResourceRecord[] {
    return resources
        .slice()
        .sort((left, right) => compareStrings(left.resourceId, right.resourceId))
        .map((resource) => ({
            ...resource,
            metadata: cloneJsonRecord(resource.metadata || {}),
        }));
}

function sortAndCloneProjections(projections: ResourceProjectionRecord[]): ResourceProjectionRecord[] {
    return projections
        .slice()
        .sort((left, right) => compareStrings(left.projectionId, right.projectionId))
        .map((projection) => ({
            ...projection,
            metadata: cloneJsonRecord(projection.metadata || {}),
        }));
}

function sortAndCloneUnits(units: IndexUnitRecord[]): IndexUnitRecord[] {
    return units
        .slice()
        .sort((left, right) => compareStrings(left.unitId, right.unitId))
        .map((unit) => ({
            ...unit,
            segmentIds: [...unit.segmentIds],
        }));
}

function sortAndCloneSegments(segments: IndexSegmentRecord[]): IndexSegmentRecord[] {
    return segments
        .slice()
        .sort((left, right) => compareStrings(left.segmentId, right.segmentId))
        .map((segment) => ({ ...segment }));
}

function sortAndCloneAtoms(atoms: KnowledgeAtom[]): KnowledgeAtom[] {
    return atoms
        .slice()
        .sort((left, right) => compareStrings(left.id, right.id))
        .map((atom) => ({
            ...atom,
            keywords: [...atom.keywords],
            evidenceSpanIds: [...atom.evidenceSpanIds],
            metadata: {
                ...atom.metadata,
                sectionPath: [...atom.metadata.sectionPath],
            },
        }));
}

function sortAndCloneEvidenceSpans(evidenceSpans: EvidenceSpan[]): EvidenceSpan[] {
    return evidenceSpans
        .slice()
        .sort((left, right) => compareStrings(left.id, right.id))
        .map((span) => ({ ...span }));
}

function sortAndCloneRelationEdges(relationEdges: RelationEdge[]): RelationEdge[] {
    return relationEdges
        .slice()
        .sort((left, right) => compareStrings(left.id, right.id))
        .map((edge) => ({
            ...edge,
            evidenceSpanIds: [...edge.evidenceSpanIds],
            temporal: { ...edge.temporal },
        }));
}

function sortAndCloneTemporalEdges(temporalEdges: TemporalEdge[]): TemporalEdge[] {
    return temporalEdges
        .slice()
        .sort((left, right) => compareStrings(left.id, right.id))
        .map((edge) => ({ ...edge }));
}

function sortAndCloneSessionStates(sessionStates: LearningSessionStateRecord[]): LearningSessionStateRecord[] {
    return sessionStates
        .slice()
        .sort((left, right) => compareStrings(left.sessionStateId, right.sessionStateId))
        .map((state) => ({
            ...state,
            activeResourceIds: [...state.activeResourceIds],
            activeProjectionIds: [...state.activeProjectionIds],
            retrievalSettings: { ...state.retrievalSettings },
            memorySettings: { ...state.memorySettings },
            panelState: cloneJsonRecord(state.panelState || {}),
        }));
}

function sortAndCloneConversationSessions(records: AgentConversationSessionRecord[]): AgentConversationSessionRecord[] {
    return records
        .slice()
        .sort((left, right) => compareStrings(left.sessionId, right.sessionId))
        .map((record) => ({
            ...record,
            turnIds: [...record.turnIds],
        }));
}

function sortAndCloneConversationTurns(records: AgentConversationTurnRecord[]): AgentConversationTurnRecord[] {
    return records
        .slice()
        .sort((left, right) => compareStrings(left.turnId, right.turnId))
        .map((record) => ({
            ...record,
            request: { ...record.request },
            response: {
                ...record.response,
                knowledgePoints: record.response.knowledgePoints.map((point) => ({
                    ...point,
                    capabilities: [...point.capabilities],
                    citation: point.citation ? { ...point.citation } : null,
                    citations: Array.isArray(point.citations)
                        ? point.citations.map((citation) => ({ ...citation }))
                        : point.citations,
                    matchedSpans: Array.isArray(point.matchedSpans)
                        ? point.matchedSpans.map((span) => ({
                            ...span,
                            citation: span.citation ? { ...span.citation } : null,
                        }))
                        : point.matchedSpans,
                    relationPath: Array.isArray((point as any).relationPath)
                        ? (point as any).relationPath.map((edge: any) => ({ ...edge }))
                        : (point as any).relationPath,
                    relationPathAtomIds: Array.isArray((point as any).relationPathAtomIds)
                        ? [...(point as any).relationPathAtomIds]
                        : (point as any).relationPathAtomIds,
                    relationKinds: Array.isArray((point as any).relationKinds)
                        ? [...(point as any).relationKinds]
                        : (point as any).relationKinds,
                    temporalValidity: (point as any).temporalValidity
                        ? {
                            ...(point as any).temporalValidity,
                            reasons: Array.isArray((point as any).temporalValidity.reasons)
                                ? [...(point as any).temporalValidity.reasons]
                                : [],
                            details: Array.isArray((point as any).temporalValidity.details)
                                ? (point as any).temporalValidity.details.map((detail: any) => ({ ...detail }))
                                : [],
                        }
                        : (point as any).temporalValidity,
                })),
                citations: record.response.citations.map((citation) => ({ ...citation })),
                recalledMemories: record.response.recalledMemories.map((memory) => ({
                    ...memory,
                    tags: [...memory.tags],
                    references: [...memory.references],
                })),
                memoryActions: record.response.memoryActions.map((action) => ({ ...action })),
                summary: { ...record.response.summary },
                trace: {
                    ...record.response.trace,
                    retrieval: {
                        ...record.response.trace.retrieval,
                        retrievalModes: [...record.response.trace.retrieval.retrievalModes],
                        modeWeights: { ...record.response.trace.retrieval.modeWeights },
                        planner: record.response.trace.retrieval.planner
                            ? {
                                ...record.response.trace.retrieval.planner,
                                titleLikeQueries: [...(record.response.trace.retrieval.planner.titleLikeQueries || [])],
                                titleHitDocumentIds: [...(record.response.trace.retrieval.planner.titleHitDocumentIds || [])],
                            }
                            : undefined,
                        scope: record.response.trace.retrieval.scope ? {
                            ...record.response.trace.retrieval.scope,
                            documentIds: [...record.response.trace.retrieval.scope.documentIds],
                            atomIds: [...record.response.trace.retrieval.scope.atomIds],
                            sourcePathPrefixes: [...record.response.trace.retrieval.scope.sourcePathPrefixes],
                            languages: [...record.response.trace.retrieval.scope.languages],
                        } : undefined,
                    },
                    usedScope: {
                        ...record.response.trace.usedScope,
                        documentIds: [...record.response.trace.usedScope.documentIds],
                        atomIds: [...record.response.trace.usedScope.atomIds],
                        sourcePathPrefixes: [...record.response.trace.usedScope.sourcePathPrefixes],
                        languages: [...record.response.trace.usedScope.languages],
                        readiness: record.response.trace.usedScope.readiness
                            ? { ...record.response.trace.usedScope.readiness }
                            : undefined,
                        missDiagnostics: record.response.trace.usedScope.missDiagnostics
                            ? {
                                ...record.response.trace.usedScope.missDiagnostics,
                                titleLikeQueries: [...(record.response.trace.usedScope.missDiagnostics.titleLikeQueries || [])],
                                titleHitDocumentIds: [...(record.response.trace.usedScope.missDiagnostics.titleHitDocumentIds || [])],
                            }
                            : undefined,
                    },
                    workspaceReadiness: record.response.trace.workspaceReadiness
                        ? { ...record.response.trace.workspaceReadiness }
                        : undefined,
                    missDiagnostics: record.response.trace.missDiagnostics
                        ? {
                            ...record.response.trace.missDiagnostics,
                            titleLikeQueries: [...(record.response.trace.missDiagnostics.titleLikeQueries || [])],
                            titleHitDocumentIds: [...(record.response.trace.missDiagnostics.titleHitDocumentIds || [])],
                        }
                        : undefined,
                    planner: record.response.trace.planner
                        ? {
                            ...record.response.trace.planner,
                            titleLikeQueries: [...(record.response.trace.planner.titleLikeQueries || [])],
                            titleHitDocumentIds: [...(record.response.trace.planner.titleHitDocumentIds || [])],
                        }
                        : undefined,
                    graphContext: (record.response.trace as any).graphContext
                        ? {
                            ...(record.response.trace as any).graphContext,
                            supportingAtomIds: Array.isArray((record.response.trace as any).graphContext.supportingAtomIds)
                                ? [...(record.response.trace as any).graphContext.supportingAtomIds]
                                : [],
                            supportingTitles: Array.isArray((record.response.trace as any).graphContext.supportingTitles)
                                ? [...(record.response.trace as any).graphContext.supportingTitles]
                                : [],
                            relationKinds: Array.isArray((record.response.trace as any).graphContext.relationKinds)
                                ? [...(record.response.trace as any).graphContext.relationKinds]
                                : [],
                            relationSummaries: Array.isArray((record.response.trace as any).graphContext.relationSummaries)
                                ? (record.response.trace as any).graphContext.relationSummaries.map((summary: any) => ({
                                    ...summary,
                                    edgeIds: Array.isArray(summary.edgeIds) ? [...summary.edgeIds] : [],
                                    sourceAtomIds: Array.isArray(summary.sourceAtomIds) ? [...summary.sourceAtomIds] : [],
                                    targetAtomIds: Array.isArray(summary.targetAtomIds) ? [...summary.targetAtomIds] : [],
                                }))
                                : [],
                            knowledgePointRelations: Array.isArray((record.response.trace as any).graphContext.knowledgePointRelations)
                                ? (record.response.trace as any).graphContext.knowledgePointRelations.map((relation: any) => ({
                                    ...relation,
                                }))
                                : [],
                            connectionPaths: Array.isArray((record.response.trace as any).graphContext.connectionPaths)
                                ? (record.response.trace as any).graphContext.connectionPaths.map((connectionPath: any) => ({
                                    ...connectionPath,
                                    pathAtomIds: Array.isArray(connectionPath.pathAtomIds) ? [...connectionPath.pathAtomIds] : [],
                                    pathTitles: Array.isArray(connectionPath.pathTitles) ? [...connectionPath.pathTitles] : [],
                                    pathEdges: Array.isArray(connectionPath.pathEdges)
                                        ? connectionPath.pathEdges.map((edge: any) => ({ ...edge }))
                                        : [],
                                }))
                                : [],
                            predecessorWindow: Array.isArray((record.response.trace as any).graphContext.predecessorWindow)
                                ? (record.response.trace as any).graphContext.predecessorWindow.map((node: any) => ({
                                    ...node,
                                }))
                                : [],
                            successorWindow: Array.isArray((record.response.trace as any).graphContext.successorWindow)
                                ? (record.response.trace as any).graphContext.successorWindow.map((node: any) => ({
                                    ...node,
                                }))
                                : [],
                            evidenceSourceRefs: Array.isArray((record.response.trace as any).graphContext.evidenceSourceRefs)
                                ? [...(record.response.trace as any).graphContext.evidenceSourceRefs]
                                : [],
                            diagnostics: (record.response.trace as any).graphContext.diagnostics
                                ? {
                                    ...(record.response.trace as any).graphContext.diagnostics,
                                    missingConnectionPathSourceAtomIds: Array.isArray((record.response.trace as any).graphContext.diagnostics.missingConnectionPathSourceAtomIds)
                                        ? [...(record.response.trace as any).graphContext.diagnostics.missingConnectionPathSourceAtomIds]
                                        : [],
                                    missingPredecessorAtomIds: Array.isArray((record.response.trace as any).graphContext.diagnostics.missingPredecessorAtomIds)
                                        ? [...(record.response.trace as any).graphContext.diagnostics.missingPredecessorAtomIds]
                                        : [],
                                    missingSuccessorAtomIds: Array.isArray((record.response.trace as any).graphContext.diagnostics.missingSuccessorAtomIds)
                                        ? [...(record.response.trace as any).graphContext.diagnostics.missingSuccessorAtomIds]
                                        : [],
                                }
                                : undefined,
                            temporalValidity: (record.response.trace as any).graphContext.temporalValidity
                                ? {
                                    ...(record.response.trace as any).graphContext.temporalValidity,
                                    warningReasons: Array.isArray((record.response.trace as any).graphContext.temporalValidity.warningReasons)
                                        ? [...(record.response.trace as any).graphContext.temporalValidity.warningReasons]
                                        : [],
                                    invalidKnowledgePointTitles: Array.isArray((record.response.trace as any).graphContext.temporalValidity.invalidKnowledgePointTitles)
                                        ? [...(record.response.trace as any).graphContext.temporalValidity.invalidKnowledgePointTitles]
                                        : [],
                                    edgeKinds: Array.isArray((record.response.trace as any).graphContext.temporalValidity.edgeKinds)
                                        ? [...(record.response.trace as any).graphContext.temporalValidity.edgeKinds]
                                        : [],
                                    details: Array.isArray((record.response.trace as any).graphContext.temporalValidity.details)
                                        ? (record.response.trace as any).graphContext.temporalValidity.details.map((detail: any) => ({ ...detail }))
                                        : [],
                                }
                                : undefined,
                        }
                        : undefined,
                },
            },
        }));
}

function sortAndCloneConversationInvocations(records: AgentConversationInvocationRecord[]): AgentConversationInvocationRecord[] {
    return records
        .slice()
        .sort((left, right) => compareStrings(left.invocationId, right.invocationId))
        .map((record) => ({ ...record }));
}

function sortAndCloneWorkflowArtifacts(records: WorkflowArtifactRecord[]): WorkflowArtifactRecord[] {
    return records
        .slice()
        .sort((left, right) => compareStrings(left.artifactId, right.artifactId))
        .map((record) => ({
            ...record,
            sourceResourceIds: [...record.sourceResourceIds],
            sourceProjectionIds: [...record.sourceProjectionIds],
            payload: cloneJsonRecord(record.payload || {}),
        }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCount(value: unknown): number {
    return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function normalizeOptionalScore(value: unknown): number | null {
    return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : null;
}

function normalizeBoolean(value: unknown): boolean {
    return value === true;
}

function normalizeString(value: unknown): string {
    return String(value || '').trim();
}

function normalizeStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map((entry) => normalizeString(entry)).filter(Boolean)
        : [];
}

function buildAnswerReleaseReviewSummary(
    value: unknown
): WorkspaceExportKnowledgeRunAnswerReleaseReviewReport | null {
    if (!isRecord(value)) {
        return null;
    }
    const reviewedAt = normalizeString(value.reviewedAt);
    const decision = normalizeString(value.decision).toLowerCase();
    const revised = normalizeBoolean(value.revised);
    const failedGateIds = normalizeStringArray(value.failedGateIds);
    const leakedInternalFragmentCount = normalizeStringArray(value.leakedInternalFragments).length;
    const reason = normalizeString(value.reason);
    if (
        !reviewedAt
        && !decision
        && revised !== true
        && failedGateIds.length <= 0
        && leakedInternalFragmentCount <= 0
        && !reason
    ) {
        return null;
    }
    return {
        reviewedAt,
        decision,
        revised,
        failedGateIds,
        leakedInternalFragmentCount,
        reason,
    };
}

function buildKnowledgeRunReports(records: WorkflowArtifactRecord[]): WorkspaceExportKnowledgeRunReport[] {
    return records
        .filter((record) => record.kind === 'knowledge_run')
        .map((record) => {
            const payload = record.payload && typeof record.payload === 'object'
                ? record.payload as Record<string, unknown>
                : {};
            const knowledgeRun = payload.knowledgeRun && typeof payload.knowledgeRun === 'object'
                ? payload.knowledgeRun as Record<string, unknown>
                : {};
            const runSummary = knowledgeRun.summary && typeof knowledgeRun.summary === 'object'
                ? knowledgeRun.summary as Record<string, unknown>
                : {};
            const quality = knowledgeRun.quality && typeof knowledgeRun.quality === 'object'
                ? knowledgeRun.quality as Record<string, unknown>
                : {};
            const scope = knowledgeRun.scope && typeof knowledgeRun.scope === 'object'
                ? knowledgeRun.scope as Record<string, unknown>
                : {};
            const answerReleaseReview = buildAnswerReleaseReviewSummary(
                knowledgeRun.answerReleaseReview ?? payload.answerReleaseReview
            );
            const graphContext = payload.graphContext && typeof payload.graphContext === 'object'
                ? payload.graphContext as Record<string, unknown>
                : {};
            const diagnostics = graphContext.diagnostics && typeof graphContext.diagnostics === 'object'
                ? graphContext.diagnostics as Record<string, unknown>
                : {};
            const temporalValidity = graphContext.temporalValidity && typeof graphContext.temporalValidity === 'object'
                ? graphContext.temporalValidity as Record<string, unknown>
                : {};
            const connectionPathCount = Array.isArray(graphContext.connectionPaths)
                ? graphContext.connectionPaths.filter((value) => Boolean(value && typeof value === 'object')).length
                : 0;
            const temporalWarningCount = Array.isArray(temporalValidity.warningReasons)
                ? temporalValidity.warningReasons.map((value) => String(value || '').trim()).filter(Boolean).length
                : 0;
            const missingLookupCount = (
                (Array.isArray(diagnostics.missingConnectionPathSourceAtomIds)
                    ? diagnostics.missingConnectionPathSourceAtomIds.map((value) => String(value || '').trim()).filter(Boolean).length
                    : 0)
                + (Array.isArray(diagnostics.missingPredecessorAtomIds)
                    ? diagnostics.missingPredecessorAtomIds.map((value) => String(value || '').trim()).filter(Boolean).length
                    : 0)
                + (Array.isArray(diagnostics.missingSuccessorAtomIds)
                    ? diagnostics.missingSuccessorAtomIds.map((value) => String(value || '').trim()).filter(Boolean).length
                    : 0)
            );
            return {
                artifactId: record.artifactId,
                runId: String(knowledgeRun.runId || payload.runId || '').trim(),
                generatedAt: String(knowledgeRun.generatedAt || record.updatedAt || record.createdAt || '').trim(),
                artifactTitle: record.title,
                artifactStatus: String(record.status || '').trim(),
                workspaceId: record.workspaceId,
                corpusId: record.corpusId,
                qualityStatus: String(quality.status || knowledgeRun.status || '').trim(),
                qualityScore: normalizeOptionalScore(quality.score),
                claimCount: normalizeCount(runSummary.claimCount),
                weakClaimCount: normalizeCount(runSummary.weakClaimCount),
                reviewCardCount: normalizeCount(runSummary.reviewCardCount),
                completedReviewCardCount: normalizeCount(runSummary.completedReviewCardCount),
                remainingReviewCardCount: normalizeCount(runSummary.remainingReviewCardCount),
                scopeSource: String(scope.scopeSource || scope.source || '').trim(),
                graphSignal: {
                    graphOpsAvailable: diagnostics.graphOpsAvailable === true,
                    usedFallback: diagnostics.usedFallback === true,
                    selectedAnchorReason: String(diagnostics.selectedAnchorReason || '').trim(),
                    connectionPathCount,
                    temporalWarningCount,
                    supportNodeCount: normalizeCount(diagnostics.supportNodeCount),
                    supportNodeLimit: normalizeCount(diagnostics.supportNodeLimit),
                    pathDepthLimit: Number.isFinite(Number(diagnostics.pathDepthLimit))
                        ? Math.max(0, Math.floor(Number(diagnostics.pathDepthLimit)))
                        : null,
                    missingLookupCount,
                },
                ...(answerReleaseReview ? { answerReleaseReview } : {}),
            };
        });
}

function buildGraphFocusReports(sessionStates: LearningSessionStateRecord[]): WorkspaceExportGraphFocusReport[] {
    return sessionStates
        .flatMap((state) => {
            const panelState = isRecord(state.panelState) ? state.panelState : {};
            const reports = Array.isArray(panelState.graphFocusReports)
                ? panelState.graphFocusReports.filter((entry) => isRecord(entry))
                : [];
            return reports.map((entry) => {
                const candidateSourcePaths = normalizeStringArray(entry.candidateSourcePaths);
                const attemptedSourcePaths = normalizeStringArray(entry.attemptedSourcePaths);
                return {
                    sessionStateId: state.sessionStateId,
                    sessionId: state.sessionId,
                    userId: state.userId,
                    workspaceId: state.workspaceId,
                    corpusId: state.corpusId,
                    mode: state.mode,
                    recordedAt: normalizeString(entry.recordedAt) || state.updatedAt,
                    title: normalizeString(entry.title),
                    requestedSourcePath: normalizeString(entry.requestedSourcePath),
                    resolvedSourcePath: normalizeString(entry.resolvedSourcePath),
                    signal: {
                        usedFallback: normalizeBoolean(entry.usedFallback),
                        fallbackSourcePathUsed: normalizeBoolean(entry.fallbackSourcePathUsed),
                        matchedSpanCount: normalizeCount(entry.matchedSpanCount),
                        highlightTermCount: normalizeCount(entry.highlightTermCount),
                        highlightedNodeCount: normalizeCount(entry.highlightedNodeCount),
                        candidateSourcePathCount: candidateSourcePaths.length,
                        attemptedSourcePathCount: attemptedSourcePaths.length,
                        markdownRuntimeAvailable: normalizeBoolean(entry.markdownRuntimeAvailable),
                        storageProviderAvailable: normalizeBoolean(entry.storageProviderAvailable),
                        readSucceeded: normalizeBoolean(entry.readSucceeded),
                        renderSucceeded: normalizeBoolean(entry.renderSucceeded),
                        failureReason: normalizeString(entry.failureReason),
                    },
                };
            });
        })
        .sort((left, right) => {
            const recordedAtOrder = compareStrings(left.recordedAt, right.recordedAt);
            if (recordedAtOrder !== 0) {
                return recordedAtOrder;
            }
            const sessionOrder = compareStrings(left.sessionStateId, right.sessionStateId);
            if (sessionOrder !== 0) {
                return sessionOrder;
            }
            return compareStrings(left.requestedSourcePath, right.requestedSourcePath);
        });
}

function sortAndCloneMemoryEntries(records: WorkspaceScopedMemoryExportRecord[]): WorkspaceScopedMemoryExportRecord[] {
    return records
        .slice()
        .sort((left, right) => {
            const userOrder = compareStrings(left.userId, right.userId);
            if (userOrder !== 0) {
                return userOrder;
            }
            const layerOrder = compareStrings(left.layer, right.layer);
            if (layerOrder !== 0) {
                return layerOrder;
            }
            return compareStrings(left.entry.key, right.entry.key);
        })
        .map((record) => ({
            userId: record.userId,
            layer: record.layer,
            entry: {
                ...record.entry,
                tags: [...record.entry.tags],
                references: [...record.entry.references],
            },
        }));
}

function sortAndCloneMemoryAuditRecords(records: MemoryAuditRecord[]): MemoryAuditRecord[] {
    return records
        .slice()
        .sort((left, right) => compareStrings(left.auditId, right.auditId))
        .map((record) => ({ ...record }));
}

export function buildWorkspaceExportBundle(input: {
    request: WorkspaceExportBundleRequest;
    workspace: WorkspaceRecord;
    bindings: WorkspaceBindingRecord[];
    resources: CanonicalResourceRecord[];
    projections: ResourceProjectionRecord[];
    indexSummary: IndexLifecycleSummary;
    units: IndexUnitRecord[];
    segments: IndexSegmentRecord[];
    atoms: KnowledgeAtom[];
    evidenceSpans: EvidenceSpan[];
    relationEdges: RelationEdge[];
    temporalEdges: TemporalEdge[];
    sessionStates: LearningSessionStateRecord[];
    conversationSessions: AgentConversationSessionRecord[];
    conversationTurns: AgentConversationTurnRecord[];
    conversationInvocations: AgentConversationInvocationRecord[];
    workflowArtifacts: WorkflowArtifactRecord[];
    memoryEntries: WorkspaceScopedMemoryExportRecord[];
    memoryAuditRecords: MemoryAuditRecord[];
    generatedAt: string;
}): WorkspaceExportBundle {
    const capabilities = resolvePlatformCapabilities({
        exportProfileId: input.request.exportProfileId || input.workspace.exportProfileId,
    });
    const render = resolveRenderMaterializationDecision({
        exportProfileId: capabilities.exportProfileId,
        platformTarget: capabilities.platformTarget,
        includeSvg: true,
    });
    const bindings = sortAndCloneBindings(input.bindings);
    const resources = sortAndCloneResources(input.resources);
    const projections = sortAndCloneProjections(input.projections);
    const units = sortAndCloneUnits(input.units);
    const segments = sortAndCloneSegments(input.segments);
    const atoms = sortAndCloneAtoms(input.atoms);
    const evidenceSpans = sortAndCloneEvidenceSpans(input.evidenceSpans);
    const relationEdges = sortAndCloneRelationEdges(input.relationEdges);
    const temporalEdges = sortAndCloneTemporalEdges(input.temporalEdges);
    const sessionStates = sortAndCloneSessionStates(input.sessionStates);
    const conversationSessions = sortAndCloneConversationSessions(input.conversationSessions);
    const conversationTurns = sortAndCloneConversationTurns(input.conversationTurns);
    const conversationInvocations = sortAndCloneConversationInvocations(input.conversationInvocations);
    const workflowArtifacts = sortAndCloneWorkflowArtifacts(input.workflowArtifacts);
    const knowledgeRunReports = buildKnowledgeRunReports(workflowArtifacts);
    const graphFocusReports = buildGraphFocusReports(sessionStates);
    const memoryEntries = sortAndCloneMemoryEntries(input.memoryEntries);
    const memoryAuditRecords = sortAndCloneMemoryAuditRecords(input.memoryAuditRecords);

    const activeProjectionIds = projections
        .filter((projection) => projection.status === 'active')
        .map((projection) => projection.projectionId);
    const indexedProjectionIds = new Set(
        units
            .filter((unit) => unit.state === 'indexed' && unit.segmentIds.length > 0)
            .map((unit) => unit.projectionId)
    );
    const missingIndexedProjectionIds = activeProjectionIds.filter((projectionId) => !indexedProjectionIds.has(projectionId));
    const reasons: string[] = [];
    if (missingIndexedProjectionIds.length > 0) {
        reasons.push(`Missing indexed segments for ${missingIndexedProjectionIds.length} active projection(s).`);
    }
    if (!render.responseArtifact || !capabilities.render.supportsPngArtifacts) {
        reasons.push('Resolved export profile does not provide a render artifact path.');
    }

    const deterministicPayload = {
        workspace: {
            ...input.workspace,
            languages: [...input.workspace.languages].sort(compareStrings),
        },
        capabilities,
        render,
        bindings,
        resources,
        projections,
        index: {
            summary: input.indexSummary,
            units,
            segments,
        },
        graph: {
            atoms,
            evidenceSpans,
            relationEdges,
            temporalEdges,
        },
        runtime: {
            sessionStates,
            conversationSessions,
            conversationTurns,
            conversationInvocations,
            workflowArtifacts,
            knowledgeRunReports,
            graphFocusReports,
        },
        memory: {
            entries: memoryEntries,
            auditRecords: memoryAuditRecords,
        },
    };
    const deterministicHash = createHash('sha256')
        .update(JSON.stringify(deterministicPayload))
        .digest('hex');
    const bundleId = `workspace_export_${deterministicHash.slice(0, 12)}`;

    return {
        manifest: {
            bundleId,
            workspaceId: input.workspace.workspaceId,
            corpusId: input.workspace.corpusId,
            exportProfileId: capabilities.exportProfileId,
            platformTarget: capabilities.platformTarget,
            packagingMode: capabilities.retrieval.supportsSidecar ? 'full' : 'slim',
            generatedAt: input.generatedAt,
            deterministicHash,
            counts: {
                bindings: bindings.length,
                resources: resources.length,
                projections: projections.length,
                units: units.length,
                segments: segments.length,
                atoms: atoms.length,
                evidenceSpans: evidenceSpans.length,
                relationEdges: relationEdges.length,
                temporalEdges: temporalEdges.length,
                sessionStates: sessionStates.length,
                conversationSessions: conversationSessions.length,
                conversationTurns: conversationTurns.length,
                conversationInvocations: conversationInvocations.length,
                workflowArtifacts: workflowArtifacts.length,
                memoryEntries: memoryEntries.length,
                memoryAuditRecords: memoryAuditRecords.length,
            },
        },
        workspace: {
            ...input.workspace,
            languages: [...input.workspace.languages].sort(compareStrings),
        },
        capabilities,
        readiness: {
            ready: reasons.length <= 0,
            reasons,
            activeProjectionCount: activeProjectionIds.length,
            indexedProjectionCount: indexedProjectionIds.size,
            missingIndexedProjectionIds,
            indexSummary: {
                ...input.indexSummary,
                states: { ...input.indexSummary.states },
            },
            render: {
                responseArtifact: render.responseArtifact,
                rendererPreference: render.rendererPreference,
                includeSvg: render.includeSvg,
                vectorSuppressed: render.vectorSuppressed,
            },
        },
        bindings,
        resources,
        projections,
        index: {
            summary: {
                ...input.indexSummary,
                states: { ...input.indexSummary.states },
            },
            units,
            segments,
        },
        graph: {
            atoms,
            evidenceSpans,
            relationEdges,
            temporalEdges,
        },
        runtime: {
            sessionStates,
            conversationSessions,
            conversationTurns,
            conversationInvocations,
            workflowArtifacts,
            knowledgeRunReports,
            graphFocusReports,
        },
        memory: {
            entries: memoryEntries,
            auditRecords: memoryAuditRecords,
        },
    };
}

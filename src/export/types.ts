import type {
    AgentConversationInvocationRecord,
    AgentConversationSessionRecord,
    AgentConversationTurnRecord,
    EvidenceSpan,
    KnowledgeAtom,
    MemoryEntry,
    MemoryLayer,
    RelationEdge,
    TemporalEdge,
} from '../learning/types';
import type { IndexLifecycleSummary, IndexSegmentRecord, IndexUnitRecord } from '../indexing/types';
import type { MemoryAuditRecord } from '../memory/types';
import type { ExportProfileId, PlatformRenderTarget } from '../platform/ExportProfile';
import type { RenderMaterializationDecision } from '../platform/RenderMaterializer';
import type { PlatformCapabilities } from '../platform/PlatformCapabilities';
import type { CanonicalResourceRecord, ResourceProjectionRecord } from '../resources/types';
import type { LearningSessionStateRecord } from '../session/types';
import type { WorkflowArtifactRecord } from '../workflows/types';
import type { WorkspaceBindingRecord, WorkspaceRecord } from '../workspace/types';

export interface WorkspaceExportBundleRequest {
    workspaceId: string;
    exportProfileId?: ExportProfileId | string;
    userId?: string;
    includeMemory?: boolean;
    includeWorkflowArtifacts?: boolean;
    includeSessionState?: boolean;
    includeConversationHistory?: boolean;
    includeDeleted?: boolean;
    generatedAt?: string;
}

export interface WorkspaceScopedMemoryExportRecord {
    userId: string;
    layer: MemoryLayer;
    entry: MemoryEntry;
}

export interface WorkspaceExportBundleManifest {
    bundleId: string;
    workspaceId: string;
    corpusId: string;
    exportProfileId: ExportProfileId;
    platformTarget: PlatformRenderTarget;
    packagingMode: 'full' | 'slim';
    generatedAt: string;
    deterministicHash: string;
    counts: {
        bindings: number;
        resources: number;
        projections: number;
        units: number;
        segments: number;
        atoms: number;
        evidenceSpans: number;
        relationEdges: number;
        temporalEdges: number;
        sessionStates: number;
        conversationSessions: number;
        conversationTurns: number;
        conversationInvocations: number;
        workflowArtifacts: number;
        memoryEntries: number;
        memoryAuditRecords: number;
    };
}

export interface WorkspaceExportBundleReadiness {
    ready: boolean;
    reasons: string[];
    activeProjectionCount: number;
    indexedProjectionCount: number;
    missingIndexedProjectionIds: string[];
    indexSummary: IndexLifecycleSummary;
    render: Pick<RenderMaterializationDecision, 'responseArtifact' | 'rendererPreference' | 'includeSvg' | 'vectorSuppressed'>;
}

export interface WorkspaceExportKnowledgeRunGraphSignal {
    graphOpsAvailable: boolean;
    usedFallback: boolean;
    selectedAnchorReason: string;
    connectionPathCount: number;
    temporalWarningCount: number;
    supportNodeCount: number;
    supportNodeLimit: number;
    pathDepthLimit: number | null;
    missingLookupCount: number;
}

export interface WorkspaceExportKnowledgeRunReport {
    artifactId: string;
    runId: string;
    generatedAt: string;
    artifactTitle: string;
    artifactStatus: string;
    workspaceId: string | null;
    corpusId: string | null;
    qualityStatus: string;
    qualityScore: number | null;
    claimCount: number;
    weakClaimCount: number;
    reviewCardCount: number;
    completedReviewCardCount: number;
    remainingReviewCardCount: number;
    scopeSource: string;
    graphSignal: WorkspaceExportKnowledgeRunGraphSignal;
}

export interface WorkspaceExportBundle {
    manifest: WorkspaceExportBundleManifest;
    workspace: WorkspaceRecord;
    capabilities: PlatformCapabilities;
    readiness: WorkspaceExportBundleReadiness;
    bindings: WorkspaceBindingRecord[];
    resources: CanonicalResourceRecord[];
    projections: ResourceProjectionRecord[];
    index: {
        summary: IndexLifecycleSummary;
        units: IndexUnitRecord[];
        segments: IndexSegmentRecord[];
    };
    graph: {
        atoms: KnowledgeAtom[];
        evidenceSpans: EvidenceSpan[];
        relationEdges: RelationEdge[];
        temporalEdges: TemporalEdge[];
    };
    runtime: {
        sessionStates: LearningSessionStateRecord[];
        conversationSessions: AgentConversationSessionRecord[];
        conversationTurns: AgentConversationTurnRecord[];
        conversationInvocations: AgentConversationInvocationRecord[];
        workflowArtifacts: WorkflowArtifactRecord[];
        knowledgeRunReports: WorkspaceExportKnowledgeRunReport[];
    };
    memory: {
        entries: WorkspaceScopedMemoryExportRecord[];
        auditRecords: MemoryAuditRecord[];
    };
}

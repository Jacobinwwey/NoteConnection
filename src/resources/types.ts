export type CanonicalResourceKind =
    | 'knowledge_document'
    | 'note'
    | 'attachment'
    | 'retrieval_artifact'
    | 'learning_artifact';

export type CanonicalResourceStatus = 'active' | 'archived' | 'deleted';

export type ResourceProjectionKind =
    | 'knowledge_document'
    | 'learning_path'
    | 'study_session'
    | 'review_plan'
    | 'question_set'
    | 'flashcard_batch'
    | 'research_report';

export type ResourceProjectionStatus = 'active' | 'archived' | 'deleted';

export interface CanonicalResourceRecord {
    resourceId: string;
    resourceHash: string;
    kind: CanonicalResourceKind;
    status: CanonicalResourceStatus;
    title: string;
    sourcePath: string;
    language: string;
    storageMode: 'inline';
    content: string;
    contentLength: number;
    workspaceId: string | null;
    corpusId: string | null;
    sourceDocumentId: string | null;
    version: number;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface ResourceProjectionRecord {
    projectionId: string;
    resourceId: string;
    projectionKind: ResourceProjectionKind;
    stableKey: string;
    status: ResourceProjectionStatus;
    documentId: string | null;
    sourcePath: string | null;
    workspaceId: string | null;
    corpusId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface ResourceProjectionUpsertInput {
    documentId: string;
    sourcePath: string;
    content: string;
    sourceHash: string;
    title: string;
    language: string;
    version: number;
    workspaceId?: string | null;
    corpusId?: string | null;
    updatedAt: string;
    metadata?: Record<string, unknown>;
}

export interface WorkflowArtifactProjectionInput {
    stableKey: string;
    projectionKind: Exclude<ResourceProjectionKind, 'knowledge_document'>;
    title: string;
    content: string;
    sourcePath?: string | null;
    language?: string;
    workspaceId?: string | null;
    corpusId?: string | null;
    sourceDocumentId?: string | null;
    resourceHash: string;
    version: number;
    createdAt: string;
    metadata?: Record<string, unknown>;
}

export interface ResourceRegistrySnapshot {
    resources: CanonicalResourceRecord[];
    projections: ResourceProjectionRecord[];
}

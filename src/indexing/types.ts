export type IndexLifecycleState = 'pending' | 'indexing' | 'indexed' | 'failed' | 'disabled';

export type IndexUnitKind = 'knowledge_document' | 'knowledge_atom' | 'workflow_artifact';

export type IndexSegmentModality = 'text';

export interface IndexUnitRecord {
    unitId: string;
    resourceId: string;
    projectionId: string;
    documentId: string | null;
    atomId: string | null;
    workspaceId: string | null;
    corpusId: string | null;
    sourcePath: string;
    language: string;
    title: string;
    content: string;
    unitKind: IndexUnitKind;
    unitIndex: number;
    contentHash: string;
    state: IndexLifecycleState;
    error: string | null;
    segmentIds: string[];
    createdAt: string;
    updatedAt: string;
}

export interface IndexSegmentRecord {
    segmentId: string;
    unitId: string;
    resourceId: string;
    projectionId: string;
    documentId: string | null;
    atomId: string | null;
    workspaceId: string | null;
    corpusId: string | null;
    modality: IndexSegmentModality;
    segmentIndex: number;
    content: string;
    contentHash: string;
    tokenCount: number;
    state: IndexLifecycleState;
    error: string | null;
    representationVersion: string;
    createdAt: string;
    updatedAt: string;
}

export interface IndexLifecycleSummary {
    totalUnits: number;
    totalSegments: number;
    states: Record<IndexLifecycleState, number>;
    activeDocuments: number;
    activeAtomUnits: number;
}

export interface IndexLifecycleSnapshot {
    units: IndexUnitRecord[];
    segments: IndexSegmentRecord[];
}

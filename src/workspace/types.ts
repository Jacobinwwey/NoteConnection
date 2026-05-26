export type WorkspaceStatus = 'active' | 'archived';

export interface WorkspaceRecord {
    workspaceId: string;
    corpusId: string;
    name: string;
    sourcePathPrefix: string;
    languages: string[];
    exportProfileId: string;
    status: WorkspaceStatus;
    createdAt: string;
    updatedAt: string;
}

export interface WorkspaceBindingRecord {
    bindingId: string;
    workspaceId: string;
    corpusId: string;
    resourceId: string;
    projectionId: string;
    documentId: string | null;
    sourcePath: string;
    createdAt: string;
    updatedAt: string;
}

export interface WorkspaceRegistrySnapshot {
    workspaces: WorkspaceRecord[];
    bindings: WorkspaceBindingRecord[];
}

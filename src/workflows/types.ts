export type WorkflowArtifactKind =
    | 'learning_path'
    | 'study_session'
    | 'review_plan'
    | 'question_set'
    | 'flashcard_batch'
    | 'knowledge_run'
    | 'research_report';

export type WorkflowArtifactStatus = 'active' | 'archived';

export interface WorkflowArtifactRecord {
    artifactId: string;
    kind: WorkflowArtifactKind;
    sessionId: string | null;
    userId: string | null;
    workspaceId: string | null;
    corpusId: string | null;
    title: string;
    sourceResourceIds: string[];
    sourceProjectionIds: string[];
    summary: string;
    payload: Record<string, unknown>;
    status: WorkflowArtifactStatus;
    createdAt: string;
    updatedAt: string;
}

export interface WorkflowArtifactSnapshot {
    artifacts: WorkflowArtifactRecord[];
}

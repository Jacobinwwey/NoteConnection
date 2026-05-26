export type LearningSessionMode =
    | 'grounded_conversation'
    | 'guided_learning'
    | 'study_session'
    | 'review_plan';

export interface LearningSessionStateRecord {
    sessionStateId: string;
    sessionId: string;
    userId: string;
    workspaceId: string | null;
    corpusId: string | null;
    mode: LearningSessionMode;
    activeResourceIds: string[];
    activeProjectionIds: string[];
    retrievalSettings: {
        topK: number;
        queryBackend: string | null;
        persistMemory: boolean;
    };
    memorySettings: {
        namespace: string | null;
        enabled: boolean;
    };
    exportProfileId: string | null;
    panelState: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface SessionStateSnapshot {
    sessionStates: LearningSessionStateRecord[];
}

import type { WorkflowArtifactRecord, WorkflowArtifactSnapshot } from './types';

type NextId = (prefix?: string) => string;

export class WorkflowArtifactStore {
    private readonly artifacts: WorkflowArtifactRecord[] = [];

    public constructor(private readonly nextId: NextId) {}

    public recordArtifact(input: Omit<WorkflowArtifactRecord, 'artifactId' | 'createdAt' | 'updatedAt'> & {
        recordedAt: string;
    }): WorkflowArtifactRecord {
        const record: WorkflowArtifactRecord = {
            artifactId: this.nextId('workflow_artifact'),
            kind: input.kind,
            sessionId: input.sessionId || null,
            userId: input.userId || null,
            workspaceId: input.workspaceId || null,
            corpusId: input.corpusId || null,
            title: input.title,
            sourceResourceIds: Array.from(new Set(input.sourceResourceIds)).filter(Boolean),
            sourceProjectionIds: Array.from(new Set(input.sourceProjectionIds)).filter(Boolean),
            summary: input.summary,
            payload: { ...(input.payload || {}) },
            status: input.status,
            createdAt: input.recordedAt,
            updatedAt: input.recordedAt,
        };
        this.artifacts.unshift(record);
        if (this.artifacts.length > 400) {
            this.artifacts.splice(400);
        }
        return record;
    }

    public listBySession(sessionId: string): WorkflowArtifactRecord[] {
        return this.artifacts.filter((record) => record.sessionId === String(sessionId || '').trim());
    }

    public listByWorkspace(workspaceId: string, userId?: string | null): WorkflowArtifactRecord[] {
        const normalizedWorkspaceId = String(workspaceId || '').trim().toLowerCase();
        const normalizedUserId = String(userId || '').trim();
        if (!normalizedWorkspaceId) {
            return [];
        }
        return this.artifacts
            .filter((record) => record.workspaceId === normalizedWorkspaceId)
            .filter((record) => !normalizedUserId || record.userId === normalizedUserId);
    }

    public buildSnapshot(): WorkflowArtifactSnapshot {
        return {
            artifacts: this.artifacts.map((artifact) => ({
                ...artifact,
                sourceResourceIds: [...artifact.sourceResourceIds],
                sourceProjectionIds: [...artifact.sourceProjectionIds],
                payload: { ...artifact.payload },
            })),
        };
    }

    public restoreFromSnapshot(snapshot: WorkflowArtifactSnapshot | null | undefined): void {
        this.artifacts.length = 0;
        (snapshot?.artifacts || []).forEach((artifact) => {
            this.artifacts.push({
                ...artifact,
                sourceResourceIds: [...artifact.sourceResourceIds],
                sourceProjectionIds: [...artifact.sourceProjectionIds],
                payload: { ...artifact.payload },
            });
        });
    }
}

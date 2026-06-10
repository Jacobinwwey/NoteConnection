import type { WorkflowArtifactRecord, WorkflowArtifactSnapshot } from './types';

type NextId = (prefix?: string) => string;

export class WorkflowArtifactStore {
    private readonly artifacts: WorkflowArtifactRecord[] = [];

    public constructor(private readonly nextId: NextId) {}

    private clonePayload(payload: Record<string, unknown>): Record<string, unknown> {
        return JSON.parse(JSON.stringify(payload || {})) as Record<string, unknown>;
    }

    private cloneArtifact(record: WorkflowArtifactRecord): WorkflowArtifactRecord {
        return {
            ...record,
            sourceResourceIds: [...record.sourceResourceIds],
            sourceProjectionIds: [...record.sourceProjectionIds],
            payload: this.clonePayload(record.payload),
        };
    }

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
            payload: this.clonePayload(input.payload || {}),
            status: input.status,
            createdAt: input.recordedAt,
            updatedAt: input.recordedAt,
        };
        this.artifacts.unshift(record);
        if (this.artifacts.length > 400) {
            this.artifacts.splice(400);
        }
        return this.cloneArtifact(record);
    }

    public getArtifactById(artifactId: string): WorkflowArtifactRecord | null {
        const normalizedArtifactId = String(artifactId || '').trim();
        if (!normalizedArtifactId) {
            return null;
        }
        const record = this.artifacts.find((artifact) => artifact.artifactId === normalizedArtifactId);
        return record ? this.cloneArtifact(record) : null;
    }

    public listAll(): WorkflowArtifactRecord[] {
        return this.artifacts.map((record) => this.cloneArtifact(record));
    }

    public updateArtifact(
        artifactId: string,
        updater: (record: WorkflowArtifactRecord) => WorkflowArtifactRecord
    ): WorkflowArtifactRecord | null {
        const normalizedArtifactId = String(artifactId || '').trim();
        if (!normalizedArtifactId) {
            return null;
        }
        const index = this.artifacts.findIndex((artifact) => artifact.artifactId === normalizedArtifactId);
        if (index < 0) {
            return null;
        }
        const current = this.cloneArtifact(this.artifacts[index]);
        const updated = updater(current);
        this.artifacts[index] = this.cloneArtifact(updated);
        return this.cloneArtifact(this.artifacts[index]);
    }

    public listBySession(sessionId: string): WorkflowArtifactRecord[] {
        return this.artifacts
            .filter((record) => record.sessionId === String(sessionId || '').trim())
            .map((record) => this.cloneArtifact(record));
    }

    public listByWorkspace(workspaceId: string, userId?: string | null): WorkflowArtifactRecord[] {
        const normalizedWorkspaceId = String(workspaceId || '').trim().toLowerCase();
        const normalizedUserId = String(userId || '').trim();
        if (!normalizedWorkspaceId) {
            return [];
        }
        return this.artifacts
            .filter((record) => record.workspaceId === normalizedWorkspaceId)
            .filter((record) => !normalizedUserId || record.userId === normalizedUserId)
            .map((record) => this.cloneArtifact(record));
    }

    public buildSnapshot(): WorkflowArtifactSnapshot {
        return {
            artifacts: this.artifacts.map((artifact) => this.cloneArtifact(artifact)),
        };
    }

    public restoreFromSnapshot(snapshot: WorkflowArtifactSnapshot | null | undefined): void {
        this.artifacts.length = 0;
        (snapshot?.artifacts || []).forEach((artifact) => {
            this.artifacts.push(this.cloneArtifact(artifact));
        });
    }
}

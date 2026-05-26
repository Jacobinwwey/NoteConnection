import type { LearningSessionStateRecord, SessionStateSnapshot } from './types';

type NextId = (prefix?: string) => string;

export class SessionStateStore {
    private readonly sessionStates = new Map<string, LearningSessionStateRecord>();

    public constructor(private readonly nextId: NextId) {}

    public upsert(record: Omit<LearningSessionStateRecord, 'sessionStateId' | 'createdAt' | 'updatedAt'> & {
        recordedAt: string;
    }): LearningSessionStateRecord {
        const existing = this.sessionStates.get(record.sessionId);
        const nextRecord: LearningSessionStateRecord = {
            sessionStateId: existing?.sessionStateId || this.nextId('session_state'),
            sessionId: record.sessionId,
            userId: record.userId,
            workspaceId: record.workspaceId || null,
            corpusId: record.corpusId || null,
            mode: record.mode,
            activeResourceIds: Array.from(new Set(record.activeResourceIds)).filter(Boolean),
            activeProjectionIds: Array.from(new Set(record.activeProjectionIds)).filter(Boolean),
            retrievalSettings: { ...record.retrievalSettings },
            memorySettings: { ...record.memorySettings },
            exportProfileId: record.exportProfileId || null,
            panelState: { ...(record.panelState || {}) },
            createdAt: existing?.createdAt || record.recordedAt,
            updatedAt: record.recordedAt,
        };
        this.sessionStates.set(record.sessionId, nextRecord);
        return nextRecord;
    }

    public get(sessionId: string): LearningSessionStateRecord | null {
        return this.sessionStates.get(String(sessionId || '').trim()) || null;
    }

    public listByWorkspace(workspaceId: string, userId?: string | null): LearningSessionStateRecord[] {
        const normalizedWorkspaceId = String(workspaceId || '').trim().toLowerCase();
        const normalizedUserId = String(userId || '').trim();
        if (!normalizedWorkspaceId) {
            return [];
        }
        return Array.from(this.sessionStates.values())
            .filter((state) => state.workspaceId === normalizedWorkspaceId)
            .filter((state) => !normalizedUserId || state.userId === normalizedUserId)
            .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
    }

    public listBySessionIds(sessionIds: string[]): LearningSessionStateRecord[] {
        const allowedIds = new Set(
            sessionIds
                .map((sessionId) => String(sessionId || '').trim())
                .filter(Boolean)
        );
        if (allowedIds.size <= 0) {
            return [];
        }
        return Array.from(this.sessionStates.values())
            .filter((state) => allowedIds.has(state.sessionId))
            .sort((left, right) => left.sessionId.localeCompare(right.sessionId));
    }

    public buildSnapshot(): SessionStateSnapshot {
        return {
            sessionStates: Array.from(this.sessionStates.values()).map((state) => ({
                ...state,
                activeResourceIds: [...state.activeResourceIds],
                activeProjectionIds: [...state.activeProjectionIds],
                retrievalSettings: { ...state.retrievalSettings },
                memorySettings: { ...state.memorySettings },
                panelState: { ...state.panelState },
            })),
        };
    }

    public restoreFromSnapshot(snapshot: SessionStateSnapshot | null | undefined): void {
        this.sessionStates.clear();
        (snapshot?.sessionStates || []).forEach((state) => {
            this.sessionStates.set(state.sessionId, {
                ...state,
                activeResourceIds: [...state.activeResourceIds],
                activeProjectionIds: [...state.activeProjectionIds],
                retrievalSettings: { ...state.retrievalSettings },
                memorySettings: { ...state.memorySettings },
                panelState: { ...state.panelState },
            });
        });
    }
}

import type { WorkspaceBindingRecord, WorkspaceRecord, WorkspaceRegistrySnapshot } from './types';

type NextId = (prefix?: string) => string;

export class WorkspaceRegistry {
    private readonly workspaces = new Map<string, WorkspaceRecord>();

    private readonly bindings = new Map<string, WorkspaceBindingRecord>();

    private readonly bindingIdsByDocumentId = new Map<string, string>();

    public constructor(private readonly nextId: NextId) {}

    private normalizePathPrefix(value: string): string {
        return String(value || '')
            .trim()
            .replace(/\\/g, '/')
            .replace(/\/{2,}/g, '/')
            .replace(/\/+$/g, '')
            .toLowerCase();
    }

    private inferCorpusIdFromSourcePath(sourcePath: string): string {
        const normalized = String(sourcePath || '').replace(/\\/g, '/');
        const segments = normalized.split('/').filter(Boolean);
        const normalizeSegment = (value: string): string => String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\.[^.]+$/g, '');
        const kbIndex = segments.findIndex((segment) => segment.toLowerCase() === 'knowledge_base');
        if (kbIndex >= 0 && segments[kbIndex + 1]) {
            return normalizeSegment(segments[kbIndex + 1]) || 'default';
        }
        return segments[0] ? normalizeSegment(segments[0]) || 'default' : 'default';
    }

    public ensureWorkspace(params: {
        workspaceId?: string | null;
        corpusId?: string | null;
        sourcePath: string;
        language: string;
        exportProfileId?: string | null;
        createdAt: string;
    }): WorkspaceRecord {
        const corpusId = String(params.corpusId || '').trim().toLowerCase()
            || this.inferCorpusIdFromSourcePath(params.sourcePath);
        const workspaceId = String(params.workspaceId || '').trim().toLowerCase() || corpusId;
        const sourcePathPrefix = this.normalizePathPrefix(params.sourcePath).split('/').slice(0, 2).join('/');
        const existing = this.workspaces.get(workspaceId);
        const nextLanguage = String(params.language || 'unknown').trim().toLowerCase() || 'unknown';
        const languages = Array.from(new Set([...(existing?.languages || []), nextLanguage])).sort((left, right) => left.localeCompare(right));
        const record: WorkspaceRecord = {
            workspaceId,
            corpusId,
            name: corpusId,
            sourcePathPrefix,
            languages,
            exportProfileId: String(params.exportProfileId || existing?.exportProfileId || 'desktop-full').trim() || 'desktop-full',
            status: 'active',
            createdAt: existing?.createdAt || params.createdAt,
            updatedAt: params.createdAt,
        };
        this.workspaces.set(workspaceId, record);
        return record;
    }

    public bindProjection(params: {
        workspaceId: string;
        corpusId: string;
        resourceId: string;
        projectionId: string;
        documentId?: string | null;
        sourcePath: string;
        boundAt: string;
    }): WorkspaceBindingRecord {
        const documentId = String(params.documentId || '').trim();
        const existingBindingId = documentId ? this.bindingIdsByDocumentId.get(documentId) || '' : '';
        const bindingId = existingBindingId || this.nextId('workspace_binding');
        const previousBinding = existingBindingId ? this.bindings.get(existingBindingId) || null : null;
        const record: WorkspaceBindingRecord = {
            bindingId,
            workspaceId: String(params.workspaceId || '').trim().toLowerCase(),
            corpusId: String(params.corpusId || '').trim().toLowerCase(),
            resourceId: params.resourceId,
            projectionId: params.projectionId,
            documentId: documentId || null,
            sourcePath: params.sourcePath,
            createdAt: previousBinding?.createdAt || params.boundAt,
            updatedAt: params.boundAt,
        };
        this.bindings.set(bindingId, record);
        if (documentId) {
            this.bindingIdsByDocumentId.set(documentId, bindingId);
        }
        return record;
    }

    public resolveBindingByDocumentId(documentId: string): WorkspaceBindingRecord | null {
        const bindingId = this.bindingIdsByDocumentId.get(String(documentId || '').trim());
        if (!bindingId) {
            return null;
        }
        return this.bindings.get(bindingId) || null;
    }

    public getWorkspaceById(workspaceId: string): WorkspaceRecord | null {
        return this.workspaces.get(String(workspaceId || '').trim().toLowerCase()) || null;
    }

    public listBindingsByWorkspace(workspaceId: string): WorkspaceBindingRecord[] {
        const normalizedWorkspaceId = String(workspaceId || '').trim().toLowerCase();
        if (!normalizedWorkspaceId) {
            return [];
        }
        return Array.from(this.bindings.values())
            .filter((binding) => binding.workspaceId === normalizedWorkspaceId)
            .sort((left, right) => left.bindingId.localeCompare(right.bindingId));
    }

    public listActiveWorkspaces(): WorkspaceRecord[] {
        return Array.from(this.workspaces.values()).filter((workspace) => workspace.status === 'active');
    }

    public buildSnapshot(): WorkspaceRegistrySnapshot {
        return {
            workspaces: Array.from(this.workspaces.values()).map((workspace) => ({ ...workspace, languages: [...workspace.languages] })),
            bindings: Array.from(this.bindings.values()).map((binding) => ({ ...binding })),
        };
    }

    public restoreFromSnapshot(snapshot: WorkspaceRegistrySnapshot | null | undefined): void {
        this.workspaces.clear();
        this.bindings.clear();
        this.bindingIdsByDocumentId.clear();
        (snapshot?.workspaces || []).forEach((workspace) => {
            this.workspaces.set(workspace.workspaceId, {
                ...workspace,
                languages: [...workspace.languages],
            });
        });
        (snapshot?.bindings || []).forEach((binding) => {
            this.bindings.set(binding.bindingId, { ...binding });
            if (binding.documentId) {
                this.bindingIdsByDocumentId.set(binding.documentId, binding.bindingId);
            }
        });
    }
}

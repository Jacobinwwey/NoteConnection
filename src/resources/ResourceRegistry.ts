import type {
    CanonicalResourceRecord,
    ResourceProjectionRecord,
    ResourceProjectionUpsertInput,
    ResourceRegistrySnapshot,
    WorkflowArtifactProjectionInput,
} from './types';

type ResourceIdFactory = (prefix?: string) => string;

export class ResourceRegistry {
    private readonly resources = new Map<string, CanonicalResourceRecord>();

    private readonly resourceIdsByHash = new Map<string, string>();

    private readonly projections = new Map<string, ResourceProjectionRecord>();

    private readonly projectionIdsByStableKey = new Map<string, string>();

    public constructor(private readonly nextId: ResourceIdFactory) {}

    public upsertKnowledgeDocument(input: ResourceProjectionUpsertInput): {
        resource: CanonicalResourceRecord;
        projection: ResourceProjectionRecord;
    } {
        const existingResourceId = this.resourceIdsByHash.get(input.sourceHash);
        const resourceId = existingResourceId || this.nextId('resource');
        const previousResource = existingResourceId ? this.resources.get(existingResourceId) || null : null;
        const createdAt = previousResource?.createdAt || input.updatedAt;
        const resource: CanonicalResourceRecord = {
            resourceId,
            resourceHash: input.sourceHash,
            kind: 'knowledge_document',
            status: 'active',
            title: input.title,
            sourcePath: input.sourcePath,
            language: input.language,
            storageMode: 'inline',
            content: input.content,
            contentLength: input.content.length,
            workspaceId: input.workspaceId || null,
            corpusId: input.corpusId || null,
            sourceDocumentId: input.documentId,
            version: input.version,
            metadata: {
                ...(previousResource?.metadata || {}),
                ...(input.metadata || {}),
            },
            createdAt,
            updatedAt: input.updatedAt,
            deletedAt: null,
        };
        this.resources.set(resourceId, resource);
        this.resourceIdsByHash.set(input.sourceHash, resourceId);

        const stableKey = `knowledge_document:${input.documentId}`;
        const existingProjectionId = this.projectionIdsByStableKey.get(stableKey);
        const projectionId = existingProjectionId || this.nextId('projection');
        const previousProjection = existingProjectionId ? this.projections.get(existingProjectionId) || null : null;
        const projection: ResourceProjectionRecord = {
            projectionId,
            resourceId,
            projectionKind: 'knowledge_document',
            stableKey,
            status: 'active',
            documentId: input.documentId,
            sourcePath: input.sourcePath,
            workspaceId: input.workspaceId || null,
            corpusId: input.corpusId || null,
            metadata: {
                ...(previousProjection?.metadata || {}),
                sourceHash: input.sourceHash,
                version: input.version,
                ...(input.metadata || {}),
            },
            createdAt: previousProjection?.createdAt || input.updatedAt,
            updatedAt: input.updatedAt,
            deletedAt: null,
        };
        this.projections.set(projectionId, projection);
        this.projectionIdsByStableKey.set(stableKey, projectionId);

        return { resource, projection };
    }

    public upsertWorkflowArtifact(input: WorkflowArtifactProjectionInput): {
        resource: CanonicalResourceRecord;
        projection: ResourceProjectionRecord;
    } {
        const existingResourceId = this.resourceIdsByHash.get(input.resourceHash);
        const resourceId = existingResourceId || this.nextId('resource');
        const previousResource = existingResourceId ? this.resources.get(existingResourceId) || null : null;
        const resource: CanonicalResourceRecord = {
            resourceId,
            resourceHash: input.resourceHash,
            kind: 'learning_artifact',
            status: 'active',
            title: input.title,
            sourcePath: input.sourcePath || '',
            language: input.language || 'unknown',
            storageMode: 'inline',
            content: input.content,
            contentLength: input.content.length,
            workspaceId: input.workspaceId || null,
            corpusId: input.corpusId || null,
            sourceDocumentId: input.sourceDocumentId || null,
            version: input.version,
            metadata: {
                ...(previousResource?.metadata || {}),
                ...(input.metadata || {}),
            },
            createdAt: previousResource?.createdAt || input.createdAt,
            updatedAt: input.createdAt,
            deletedAt: null,
        };
        this.resources.set(resourceId, resource);
        this.resourceIdsByHash.set(input.resourceHash, resourceId);

        const existingProjectionId = this.projectionIdsByStableKey.get(input.stableKey);
        const projectionId = existingProjectionId || this.nextId('projection');
        const previousProjection = existingProjectionId ? this.projections.get(existingProjectionId) || null : null;
        const projection: ResourceProjectionRecord = {
            projectionId,
            resourceId,
            projectionKind: input.projectionKind,
            stableKey: input.stableKey,
            status: 'active',
            documentId: input.sourceDocumentId || null,
            sourcePath: input.sourcePath || null,
            workspaceId: input.workspaceId || null,
            corpusId: input.corpusId || null,
            metadata: {
                ...(previousProjection?.metadata || {}),
                ...(input.metadata || {}),
            },
            createdAt: previousProjection?.createdAt || input.createdAt,
            updatedAt: input.createdAt,
            deletedAt: null,
        };
        this.projections.set(projectionId, projection);
        this.projectionIdsByStableKey.set(input.stableKey, projectionId);
        return { resource, projection };
    }

    /**
     * Keeps the resource/projection owners aligned with a document move without
     * allocating a new resource or changing the stable document projection key.
     * The document store owns the transition journal; this adapter only mirrors
     * the committed identity metadata for export and diagnostics consumers.
     */
    public updateKnowledgeDocumentIdentity(input: {
        documentId: string;
        sourcePath: string;
        sourceUri?: string;
        revision?: string;
        identityAliases?: string[];
        title?: string;
        updatedAt: string;
    }): boolean {
        const projection = this.getProjectionByDocumentId(input.documentId);
        if (!projection) {
            return false;
        }
        const resource = this.resources.get(projection.resourceId);
        const identityMetadata: Record<string, unknown> = {
            ...(input.sourceUri !== undefined ? { sourceUri: input.sourceUri } : {}),
            ...(input.revision !== undefined ? { revision: input.revision } : {}),
            ...(input.identityAliases !== undefined ? { identityAliases: [...input.identityAliases] } : {}),
        };
        this.projections.set(projection.projectionId, {
            ...projection,
            sourcePath: input.sourcePath,
            metadata: {
                ...projection.metadata,
                ...identityMetadata,
            },
            updatedAt: input.updatedAt,
        });
        if (resource) {
            this.resources.set(resource.resourceId, {
                ...resource,
                sourcePath: input.sourcePath,
                title: input.title || resource.title,
                metadata: {
                    ...resource.metadata,
                    ...identityMetadata,
                },
                updatedAt: input.updatedAt,
            });
        }
        return true;
    }

    public markDocumentProjectionDeleted(documentId: string, deletedAt: string): void {
        const stableKey = `knowledge_document:${String(documentId || '').trim()}`;
        const projectionId = this.projectionIdsByStableKey.get(stableKey);
        if (!projectionId) {
            return;
        }
        const projection = this.projections.get(projectionId);
        if (!projection) {
            return;
        }
        this.projections.set(projectionId, {
            ...projection,
            status: 'deleted',
            updatedAt: deletedAt,
            deletedAt,
        });
        const resource = this.resources.get(projection.resourceId);
        if (resource) {
            this.resources.set(resource.resourceId, {
                ...resource,
                status: 'deleted',
                updatedAt: deletedAt,
                deletedAt,
            });
        }
    }

    public getProjectionByDocumentId(documentId: string): ResourceProjectionRecord | null {
        const stableKey = `knowledge_document:${String(documentId || '').trim()}`;
        const projectionId = this.projectionIdsByStableKey.get(stableKey);
        if (!projectionId) {
            return null;
        }
        return this.projections.get(projectionId) || null;
    }

    public getProjectionByStableKey(stableKey: string): ResourceProjectionRecord | null {
        const projectionId = this.projectionIdsByStableKey.get(String(stableKey || '').trim());
        if (!projectionId) {
            return null;
        }
        return this.projections.get(projectionId) || null;
    }

    public getResourceById(resourceId: string): CanonicalResourceRecord | null {
        return this.resources.get(String(resourceId || '').trim()) || null;
    }

    public listResourcesByIds(resourceIds: string[], options: { includeDeleted?: boolean } = {}): CanonicalResourceRecord[] {
        const allowedIds = new Set(
            resourceIds
                .map((resourceId) => String(resourceId || '').trim())
                .filter(Boolean)
        );
        if (allowedIds.size <= 0) {
            return [];
        }
        return Array.from(this.resources.values())
            .filter((resource) => allowedIds.has(resource.resourceId))
            .filter((resource) => options.includeDeleted === true || resource.status === 'active');
    }

    public listProjectionsByIds(projectionIds: string[], options: { includeDeleted?: boolean } = {}): ResourceProjectionRecord[] {
        const allowedIds = new Set(
            projectionIds
                .map((projectionId) => String(projectionId || '').trim())
                .filter(Boolean)
        );
        if (allowedIds.size <= 0) {
            return [];
        }
        return Array.from(this.projections.values())
            .filter((projection) => allowedIds.has(projection.projectionId))
            .filter((projection) => options.includeDeleted === true || projection.status === 'active');
    }

    public listActiveResources(): CanonicalResourceRecord[] {
        return Array.from(this.resources.values()).filter((resource) => resource.status === 'active');
    }

    public listActiveProjections(): ResourceProjectionRecord[] {
        return Array.from(this.projections.values()).filter((projection) => projection.status === 'active');
    }

    public buildSnapshot(): ResourceRegistrySnapshot {
        return {
            resources: Array.from(this.resources.values()).map((resource) => ({ ...resource, metadata: { ...resource.metadata } })),
            projections: Array.from(this.projections.values()).map((projection) => ({ ...projection, metadata: { ...projection.metadata } })),
        };
    }

    public restoreFromSnapshot(snapshot: ResourceRegistrySnapshot | null | undefined): void {
        this.resources.clear();
        this.resourceIdsByHash.clear();
        this.projections.clear();
        this.projectionIdsByStableKey.clear();
        (snapshot?.resources || []).forEach((resource) => {
            this.resources.set(resource.resourceId, {
                ...resource,
                metadata: { ...(resource.metadata || {}) },
            });
            this.resourceIdsByHash.set(resource.resourceHash, resource.resourceId);
        });
        (snapshot?.projections || []).forEach((projection) => {
            this.projections.set(projection.projectionId, {
                ...projection,
                metadata: { ...(projection.metadata || {}) },
            });
            this.projectionIdsByStableKey.set(projection.stableKey, projection.projectionId);
        });
    }
}

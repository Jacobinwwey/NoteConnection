import type {
    KnowledgeDocumentDeleteInput,
    KnowledgeDocumentInput,
    KnowledgeDocumentMoveInput,
    KnowledgeIngestOperation,
    KnowledgeIngestRequest,
} from '../learning/types';

const MAX_DOCUMENTS_PER_REQUEST = 5000;
const MAX_ALIASES_PER_DOCUMENT = 64;
const MAX_ALIAS_LENGTH = 2048;
const MAX_CONTENT_BYTES = 64 * 1024 * 1024;

export class KnowledgePayloadError extends Error {
    readonly statusCode = 400;
    readonly code = 'invalid_knowledge_payload';

    constructor(message: string) {
        super(message);
        this.name = 'KnowledgePayloadError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return undefined;
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return record[key];
        }
    }
    return undefined;
}

function normalizeStringArray(value: unknown, field: string): string[] {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new KnowledgePayloadError(`${field} must be an array of strings.`);
    }
    if (value.length > MAX_ALIASES_PER_DOCUMENT) {
        throw new KnowledgePayloadError(`${field} exceeds ${MAX_ALIASES_PER_DOCUMENT} entries.`);
    }
    const values = Array.from(new Set(value.map((item, index) => {
        if (typeof item !== 'string' || item.trim().length === 0) {
            throw new KnowledgePayloadError(`${field}[${index}] must be a non-empty string.`);
        }
        const normalized = item.trim();
        if (normalized.length > MAX_ALIAS_LENGTH) {
            throw new KnowledgePayloadError(`${field}[${index}] exceeds ${MAX_ALIAS_LENGTH} characters.`);
        }
        return normalized;
    })));
    return values;
}

function normalizeDocument(raw: unknown): KnowledgeDocumentInput {
    if (!isRecord(raw)) {
        throw new KnowledgePayloadError('Each ingest document must be an object.');
    }
    const contentRaw = firstValue(raw, ['content', 'text', 'body', 'markdown']);
    const content = typeof contentRaw === 'string' ? contentRaw : String(contentRaw ?? '');
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
        throw new KnowledgePayloadError(`Document content exceeds ${MAX_CONTENT_BYTES} bytes.`);
    }
    if (!content.trim() && !firstString(raw, ['documentId', 'docId', 'id', 'sourcePath', 'source_path', 'path'])) {
        throw new KnowledgePayloadError('Document requires content or an identity.');
    }
    const identityAliases = normalizeStringArray(
        firstValue(raw, ['identityAliases', 'identity_aliases', 'aliases']),
        'identityAliases',
    );
    return {
        documentId: firstString(raw, ['documentId', 'docId', 'id']),
        sourcePath: firstString(raw, ['sourcePath', 'source_path', 'path', 'filePath', 'filepath', 'file']) || '',
        sourceUri: firstString(raw, ['sourceUri', 'source_uri', 'uri']),
        revision: firstString(raw, ['revision', 'sourceRevision', 'source_revision']),
        identityAliases: identityAliases.length > 0 ? identityAliases : undefined,
        content,
        language: firstString(raw, ['language', 'lang', 'locale']),
        updatedAt: firstString(raw, ['updatedAt', 'updated_at', 'timestamp', 'now']),
        workspaceId: firstString(raw, ['workspaceId', 'workspace_id']),
        corpusId: firstString(raw, ['corpusId', 'corpus_id']),
        exportProfileId: firstString(raw, ['exportProfileId', 'export_profile_id']),
        metadata: isRecord(raw.metadata) ? { ...raw.metadata } : undefined,
    };
}

function normalizeDelete(raw: unknown): KnowledgeDocumentDeleteInput {
    if (!isRecord(raw)) {
        throw new KnowledgePayloadError('Each deleted document must be an object.');
    }
    const identityAliases = normalizeStringArray(
        firstValue(raw, ['identityAliases', 'identity_aliases', 'aliases']),
        'identityAliases',
    );
    const result: KnowledgeDocumentDeleteInput = {
        documentId: firstString(raw, ['documentId', 'docId', 'id']),
        sourcePath: firstString(raw, ['sourcePath', 'source_path', 'path', 'filePath', 'filepath', 'file']),
        sourceUri: firstString(raw, ['sourceUri', 'source_uri', 'uri']),
        identityAliases: identityAliases.length > 0 ? identityAliases : undefined,
    };
    if (!result.documentId && !result.sourcePath && !result.sourceUri && identityAliases.length === 0) {
        throw new KnowledgePayloadError('Delete requires documentId, sourcePath, sourceUri, or identityAliases.');
    }
    return result;
}

function normalizeMove(raw: unknown): KnowledgeDocumentMoveInput {
    if (!isRecord(raw)) {
        throw new KnowledgePayloadError('Each move document must be an object.');
    }
    const toSourcePath = firstString(raw, ['toSourcePath', 'to_source_path', 'destinationPath', 'destination_path']);
    if (!toSourcePath) {
        throw new KnowledgePayloadError('Move requires toSourcePath.');
    }
    const aliases = normalizeStringArray(
        firstValue(raw, ['toIdentityAliases', 'to_identity_aliases', 'aliases']),
        'toIdentityAliases',
    );
    const fromAliases = normalizeStringArray(
        firstValue(raw, ['fromIdentityAliases', 'from_identity_aliases', 'fromAliases']),
        'fromIdentityAliases',
    );
    return {
        documentId: firstString(raw, ['documentId', 'docId', 'id']),
        fromSourcePath: firstString(raw, ['fromSourcePath', 'from_source_path', 'sourcePath', 'source_path']),
        fromSourceUri: firstString(raw, ['fromSourceUri', 'from_source_uri', 'sourceUri', 'source_uri']),
        fromIdentityAliases: fromAliases.length > 0 ? fromAliases : undefined,
        toSourcePath,
        toSourceUri: firstString(raw, ['toSourceUri', 'to_source_uri', 'destinationUri', 'destination_uri']),
        toIdentityAliases: aliases.length > 0 ? aliases : undefined,
        revision: firstString(raw, ['revision', 'sourceRevision', 'source_revision']),
        updatedAt: firstString(raw, ['updatedAt', 'updated_at', 'timestamp', 'now']),
    };
}

function normalizeOperation(raw: unknown): KnowledgeIngestOperation {
    if (!isRecord(raw)) {
        throw new KnowledgePayloadError('Each ingest operation must be an object.');
    }
    const operation = (firstString(raw, ['op', 'operation', 'action', 'type']) || 'upsert').toLowerCase();
    const nested = firstValue(raw, ['document', 'payload', 'item']) ?? raw;
    if (operation === 'delete' || operation === 'remove' || operation === 'del') {
        return { op: 'delete', document: normalizeDelete(nested) };
    }
    if (operation === 'move' || operation === 'rename') {
        return { op: 'move', document: normalizeMove(nested) };
    }
    if (operation === 'upsert' || operation === 'insert' || operation === 'update' || operation === 'put') {
        return { op: 'upsert', document: normalizeDocument(nested) };
    }
    throw new KnowledgePayloadError(`Unsupported ingest operation: ${operation}.`);
}

function asArray(value: unknown): unknown[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

export function parseKnowledgeIngestBody(body: string): KnowledgeIngestRequest {
    let payload: unknown;
    try {
        payload = body.trim() ? JSON.parse(body) : {};
    } catch (_error) {
        throw new KnowledgePayloadError('Request body must be valid JSON.');
    }

    if (!isRecord(payload) && !Array.isArray(payload)) {
        throw new KnowledgePayloadError('Request body must be an object or document array.');
    }

    const record = isRecord(payload) ? payload : {};
    const rawDocuments = firstValue(record, ['documents', 'docs', 'items']);
    const rawDeletes = firstValue(record, ['deletedDocuments', 'deleted', 'deletes']);
    const rawOperations = firstValue(record, ['operations', 'ops']);
    const documents = asArray(rawDocuments ?? (Array.isArray(payload) ? payload : undefined)).map(normalizeDocument);
    const deletedDocuments = asArray(rawDeletes).map(normalizeDelete);
    const operations = asArray(rawOperations).map(normalizeOperation);
    const totalItems = documents.length + deletedDocuments.length + operations.length;
    if (totalItems > MAX_DOCUMENTS_PER_REQUEST) {
        throw new KnowledgePayloadError(`Ingest request exceeds ${MAX_DOCUMENTS_PER_REQUEST} documents/operations.`);
    }

    const incremental = typeof record.incremental === 'boolean' ? record.incremental : undefined;
    const recomputeRelations = typeof record.recomputeRelations === 'boolean' ? record.recomputeRelations : undefined;
    const relationRecomputeMode = firstString(record, ['relationRecomputeMode', 'relation_recompute_mode', 'recomputeMode']);
    if (relationRecomputeMode && !['auto', 'none', 'incremental', 'full'].includes(relationRecomputeMode.toLowerCase())) {
        throw new KnowledgePayloadError('relationRecomputeMode must be one of auto, none, incremental, full.');
    }
    return {
        documents: documents.length > 0 ? documents : undefined,
        deletedDocuments: deletedDocuments.length > 0 ? deletedDocuments : undefined,
        operations: operations.length > 0 ? operations : undefined,
        incremental,
        recomputeRelations,
        relationRecomputeMode: relationRecomputeMode?.toLowerCase() as KnowledgeIngestRequest['relationRecomputeMode'],
        ingestedAt: firstString(record, ['ingestedAt', 'timestamp', 'now']),
    };
}

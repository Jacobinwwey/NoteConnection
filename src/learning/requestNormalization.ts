import type {
    AgentConversationRequest,
    KnowledgeCorpusScope,
    KnowledgeQueryRequest,
} from './types';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readFirstPresentValue(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return record[key];
        }
    }
    return undefined;
}

function readFirstNonEmptyString(record: Record<string, unknown>, keys: string[]): string {
    const value = readFirstPresentValue(record, keys);
    return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveIntegerValue(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return 0;
    }
    return Math.floor(numeric);
}

function normalizeStringList(values: unknown, options: {
    normalize?: (value: string) => string;
} = {}): string[] {
    const list = Array.isArray(values) ? values : [];
    const normalized = list
        .map((value) => String(value || '').trim())
        .map((value) => options.normalize ? options.normalize(value) : value)
        .filter((value) => value.length > 0);
    return Array.from(new Set(normalized));
}

function normalizePathPrefix(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/g, '');
}

export function normalizeKnowledgeCorpusScopePayload(payload: unknown): KnowledgeCorpusScope | undefined {
    const record = isObjectRecord(payload) ? payload : {};
    const nestedScope = isObjectRecord(record.scope) ? record.scope : {};
    const workspaceId = readFirstNonEmptyString(record, ['workspaceId', 'workspace_id'])
        || readFirstNonEmptyString(nestedScope, ['workspaceId', 'workspace_id']);
    const corpusId = readFirstNonEmptyString(record, ['corpusId', 'corpus_id'])
        || readFirstNonEmptyString(nestedScope, ['corpusId', 'corpus_id']);
    const documentIds = normalizeStringList(
        readFirstPresentValue(record, ['documentIds', 'document_ids'])
        ?? readFirstPresentValue(nestedScope, ['documentIds', 'document_ids'])
    );
    const atomIds = normalizeStringList(
        readFirstPresentValue(record, ['atomIds', 'atom_ids'])
        ?? readFirstPresentValue(nestedScope, ['atomIds', 'atom_ids'])
    );
    const sourcePathPrefixes = normalizeStringList(
        readFirstPresentValue(record, ['sourcePathPrefixes', 'source_path_prefixes'])
        ?? readFirstPresentValue(nestedScope, ['sourcePathPrefixes', 'source_path_prefixes']),
        { normalize: normalizePathPrefix }
    );
    const languages = normalizeStringList(
        readFirstPresentValue(record, ['languages', 'languageScope'])
        ?? readFirstPresentValue(nestedScope, ['languages', 'languageScope']),
        { normalize: (value) => value.toLowerCase() }
    );

    if (!workspaceId && !corpusId && documentIds.length <= 0 && atomIds.length <= 0 && sourcePathPrefixes.length <= 0 && languages.length <= 0) {
        return undefined;
    }

    return {
        workspaceId: workspaceId || undefined,
        corpusId: corpusId || undefined,
        documentIds: documentIds.length > 0 ? documentIds : undefined,
        atomIds: atomIds.length > 0 ? atomIds : undefined,
        sourcePathPrefixes: sourcePathPrefixes.length > 0 ? sourcePathPrefixes : undefined,
        languages: languages.length > 0 ? languages : undefined,
    };
}

export function normalizeKnowledgeQueryRequestPayload(payload: unknown): KnowledgeQueryRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const query = readFirstNonEmptyString(record, ['query', 'q']) || '';
    const topKValue = parsePositiveIntegerValue(readFirstPresentValue(record, ['topK', 'k', 'limit']));
    const asOf = readFirstNonEmptyString(record, ['asOf', 'as_of', 'timestamp']);
    const queryBackend = readFirstNonEmptyString(record, ['queryBackend', 'backend', 'query_backend']);
    return {
        query,
        topK: topKValue > 0 ? topKValue : undefined,
        asOf,
        queryBackend,
        scope: normalizeKnowledgeCorpusScopePayload(record),
    };
}

export function normalizeAgentConversationRequestPayload(payload: unknown): AgentConversationRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const topKValue = parsePositiveIntegerValue(readFirstPresentValue(record, ['topK', 'k', 'limit']));
    return {
        userId: String(readFirstPresentValue(record, ['userId', 'user_id', 'learnerId']) || '').trim(),
        sessionId: readFirstNonEmptyString(record, ['sessionId', 'session_id']),
        activeTarget: readFirstNonEmptyString(record, ['activeTarget', 'active_target', 'target']),
        message: readFirstNonEmptyString(record, ['message', 'prompt', 'query', 'q', 'text']) || '',
        topK: topKValue > 0 ? topKValue : undefined,
        asOf: readFirstNonEmptyString(record, ['asOf', 'as_of', 'timestamp', 'now']),
        persistMemory: readFirstPresentValue(record, ['persistMemory', 'persist_memory']) !== false,
        memoryNamespace: readFirstNonEmptyString(record, ['memoryNamespace', 'memory_namespace']),
        scope: normalizeKnowledgeCorpusScopePayload(record),
    };
}

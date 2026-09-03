import type {
    AgentConversationRequest,
    KnowledgeCorpusScope,
    KnowledgeQueryRequest,
    WorkflowArtifactReviewFollowUpRequest,
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

function normalizeAnswerLanguageValue(value: unknown): AgentConversationRequest['answerLanguage'] | undefined {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/_/gu, '-');
    if (!normalized) {
        return undefined;
    }
    if (normalized === 'auto') {
        return 'auto';
    }
    if (
        normalized === 'zh'
        || normalized.startsWith('zh-')
        || ['chinese', 'mandarin', 'simplified-chinese', 'traditional-chinese'].includes(normalized)
    ) {
        return 'zh';
    }
    if (
        normalized === 'en'
        || normalized.startsWith('en-')
        || normalized === 'english'
    ) {
        return 'en';
    }
    return undefined;
}

function normalizeResponseProfileValue(value: unknown): AgentConversationRequest['responseProfile'] | undefined {
    const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/gu, '_');
    if (normalized === 'default') {
        return 'default';
    }
    if (normalized === 'mobile_compact' || normalized === 'mobile') {
        return 'mobile_compact';
    }
    return undefined;
}

function normalizeResponseModeValue(value: unknown): AgentConversationRequest['responseMode'] | undefined {
    const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/gu, '_');
    if (normalized === 'slim' || normalized === 'definition' || normalized === 'compact' || normalized === 'default') {
        return 'slim';
    }
    if (normalized === 'full' || normalized === 'comprehensive' || normalized === 'report') {
        return 'full';
    }
    return undefined;
}

function normalizeResponseBudgetModeValue(value: unknown): AgentConversationRequest['responseBudgetMode'] {
    const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/gu, '_');
    if (!normalized || ['adaptive', 'default', 'standard', 'auto'].includes(normalized)) {
        return 'adaptive';
    }
    if (['unbounded', 'no_cap', 'nocap', 'no_limit', 'nolimit', 'unlimited'].includes(normalized)) {
        return 'unbounded';
    }
    return 'adaptive';
}

function normalizeResponseBudgetCapabilityValue(
    value: unknown
): AgentConversationRequest['responseBudgetCapability'] | undefined {
    if (!isObjectRecord(value)) {
        return undefined;
    }
    const memoryClass = String(value.memoryClass || value.memory_class || '')
        .trim()
        .toLowerCase()
        .replace(/[-\s]+/gu, '_');
    const workload = String(value.workload || value.workload_class || '')
        .trim()
        .toLowerCase()
        .replace(/[-\s]+/gu, '_');
    const normalizePositiveHint = (hint: unknown): number | undefined => {
        const numeric = Number(hint);
        return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : undefined;
    };
    const normalized: NonNullable<AgentConversationRequest['responseBudgetCapability']> = {};
    if (['low', 'standard', 'high'].includes(memoryClass)) {
        normalized.memoryClass = memoryClass as NonNullable<typeof normalized.memoryClass>;
    }
    if (['normal', 'large', 'max'].includes(workload)) {
        normalized.workload = workload as NonNullable<typeof normalized.workload>;
    }
    const maxReportCharsHint = normalizePositiveHint(
        value.maxReportCharsHint ?? value.max_report_chars_hint
    );
    if (maxReportCharsHint !== undefined) {
        normalized.maxReportCharsHint = maxReportCharsHint;
    }
    const maxSerializedBytesHint = normalizePositiveHint(
        value.maxSerializedBytesHint ?? value.max_serialized_bytes_hint
    );
    if (maxSerializedBytesHint !== undefined) {
        normalized.maxSerializedBytesHint = maxSerializedBytesHint;
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
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
    const answerLanguage = normalizeAnswerLanguageValue(
        readFirstPresentValue(record, ['answerLanguage', 'answer_language', 'responseLanguage', 'response_language'])
    );
    const responseProfile = normalizeResponseProfileValue(
        readFirstPresentValue(record, ['responseProfile', 'response_profile', 'profile'])
    );
    const responseMode = normalizeResponseModeValue(
        readFirstPresentValue(record, ['responseMode', 'response_mode', 'answerMode', 'answer_mode', 'detailMode', 'detail_mode'])
    );
    const responseBudgetMode = normalizeResponseBudgetModeValue(
        readFirstPresentValue(record, [
            'responseBudgetMode',
            'response_budget_mode',
            'budgetMode',
            'budget_mode',
        ])
    );
    const responseBudgetCapability = normalizeResponseBudgetCapabilityValue(
        readFirstPresentValue(record, [
            'responseBudgetCapability',
            'response_budget_capability',
            'budgetCapability',
            'budget_capability',
        ])
    );
    return {
        userId: String(readFirstPresentValue(record, ['userId', 'user_id', 'learnerId']) || '').trim(),
        sessionId: readFirstNonEmptyString(record, ['sessionId', 'session_id']),
        activeTarget: readFirstNonEmptyString(record, ['activeTarget', 'active_target', 'target']),
        message: readFirstNonEmptyString(record, ['message', 'prompt', 'query', 'q', 'text']) || '',
        answerLanguage,
        responseMode,
        responseBudgetMode,
        responseBudgetCapability,
        responseProfile,
        topK: topKValue > 0 ? topKValue : undefined,
        asOf: readFirstNonEmptyString(record, ['asOf', 'as_of', 'timestamp', 'now']),
        persistMemory: readFirstPresentValue(record, ['persistMemory', 'persist_memory']) !== false,
        memoryNamespace: readFirstNonEmptyString(record, ['memoryNamespace', 'memory_namespace']),
        scope: normalizeKnowledgeCorpusScopePayload(record),
    };
}

function normalizeBooleanFlagOrUndefined(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!normalized) {
        return undefined;
    }
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
        return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
        return false;
    }
    return undefined;
}

function normalizeMemoryLayerValue(value: unknown): WorkflowArtifactReviewFollowUpRequest['memoryLayer'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'session') {
        return 'session';
    }
    if (normalized === 'unit') {
        return 'unit';
    }
    if (normalized === 'long_term' || normalized === 'long-term' || normalized === 'longterm') {
        return 'long_term';
    }
    return undefined;
}

export function normalizeWorkflowArtifactReviewFollowUpRequestPayload(
    payload: unknown
): WorkflowArtifactReviewFollowUpRequest {
    const record = isObjectRecord(payload) ? payload : {};
    const actionRecord = isObjectRecord(record.action) ? record.action : {};
    const actionSource = readFirstNonEmptyString(actionRecord, ['source', 'actionSource'])
        || readFirstNonEmptyString(record, ['source', 'actionSource']);
    const actionKind = readFirstNonEmptyString(actionRecord, ['kind', 'learningActionKind', 'actionKind'])
        || readFirstNonEmptyString(record, ['kind', 'learningActionKind', 'actionKind']);
    const outcome = readFirstNonEmptyString(record, ['outcome']);

    return {
        userId: String(readFirstPresentValue(record, ['userId', 'user_id', 'learnerId']) || '').trim(),
        sessionId: readFirstNonEmptyString(record, ['sessionId', 'session_id']),
        artifactId: readFirstNonEmptyString(record, ['artifactId', 'artifact_id']),
        cardId: readFirstNonEmptyString(record, ['cardId', 'card_id']),
        action: {
            atomId: readFirstNonEmptyString(actionRecord, ['atomId', 'atom_id'])
                || readFirstNonEmptyString(record, ['atomId', 'atom_id']),
            kind: actionKind
                ? actionKind as NonNullable<WorkflowArtifactReviewFollowUpRequest['action']>['kind']
                : undefined,
            source: (actionSource || 'flashcard_batch') as NonNullable<WorkflowArtifactReviewFollowUpRequest['action']>['source'],
            prompt: readFirstNonEmptyString(actionRecord, ['prompt'])
                || readFirstNonEmptyString(record, ['prompt']),
            answer: readFirstNonEmptyString(actionRecord, ['answer'])
                || readFirstNonEmptyString(record, ['answer']),
        },
        outcome: outcome
            ? outcome as WorkflowArtifactReviewFollowUpRequest['outcome']
            : undefined,
        errorTag: readFirstNonEmptyString(record, ['errorTag', 'mistakeTag', 'misconceptionTag']),
        autoAnalyzeAnswer: normalizeBooleanFlagOrUndefined(readFirstPresentValue(record, ['autoAnalyzeAnswer', 'analyzeAnswer'])),
        autoUpdateMasteryFromAnswer: normalizeBooleanFlagOrUndefined(readFirstPresentValue(record, [
            'autoUpdateMasteryFromAnswer',
            'updateMasteryFromAnswer',
            'inferMasteryFromAnswer',
        ])),
        executedAt: readFirstNonEmptyString(record, ['executedAt', 'timestamp', 'now']),
        persistMemory: normalizeBooleanFlagOrUndefined(readFirstPresentValue(record, ['persistMemory', 'persist', 'persist_memory'])),
        memoryLayer: normalizeMemoryLayerValue(readFirstPresentValue(record, ['memoryLayer', 'layer'])),
        tutorAdapterId: readFirstNonEmptyString(record, ['tutorAdapterId', 'adapterId']),
        tutorProviderName: readFirstNonEmptyString(record, ['tutorProviderName', 'providerName']),
        tutorProviderMode: readFirstNonEmptyString(record, ['tutorProviderMode', 'providerMode']),
        autoPromoteMemory: normalizeBooleanFlagOrUndefined(readFirstPresentValue(record, [
            'autoPromoteMemory',
            'promoteMemory',
            'autoPromote',
            'promote_memory',
        ])),
        promoteMemoryTargetLayer: normalizeMemoryLayerValue(readFirstPresentValue(record, [
            'promoteMemoryTargetLayer',
            'promoteTargetLayer',
            'targetLayer',
            'toLayer',
        ])),
        promoteMemoryMinConfidence: Number.isFinite(Number(readFirstPresentValue(record, [
            'promoteMemoryMinConfidence',
            'promoteMinConfidence',
            'minPromotionConfidence',
            'minConfidence',
        ])))
            ? Number(readFirstPresentValue(record, [
                'promoteMemoryMinConfidence',
                'promoteMinConfidence',
                'minPromotionConfidence',
                'minConfidence',
            ]))
            : undefined,
        promoteMemoryRemoveFromSource: normalizeBooleanFlagOrUndefined(readFirstPresentValue(record, [
            'promoteMemoryRemoveFromSource',
            'promoteRemoveFromSource',
            'removeFromSource',
            'remove_source',
        ])),
    };
}

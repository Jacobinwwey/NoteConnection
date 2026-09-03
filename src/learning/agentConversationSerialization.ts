import type {
    AgentConversationResponse,
    AgentConversationTurnEvent,
} from './types';

export type AgentConversationSerializationResult = {
    json: string;
    result: AgentConversationResponse;
    truncated: boolean;
    reason?: 'runtime_serialized_bytes_limit';
};

function byteLength(value: string): number {
    return Buffer.byteLength(String(value || ''), 'utf8');
}

function countUnescaped(value: string, token: string): number {
    return (String(value || '').match(new RegExp(`(?<!\\\\)${token}`, 'gu')) || []).length;
}

function clipBalancedMarkdown(value: string, maxChars: number): string {
    const source = String(value || '');
    if (source.length <= maxChars) {
        return source;
    }
    const marker = '\n\n[Response truncated by runtime safety governor.]';
    const available = Math.max(64, maxChars - marker.length);
    let clipped = source.slice(0, available).trimEnd();
    if (countUnescaped(clipped, '\$\$') % 2 !== 0) {
        clipped = clipped.slice(0, clipped.lastIndexOf('$$')).trimEnd();
    }
    const withoutDisplayMath = clipped.replace(/(?<!\\)\$\$/gu, '');
    if (countUnescaped(withoutDisplayMath, '\$') % 2 !== 0) {
        clipped = clipped.slice(0, clipped.lastIndexOf('$')).trimEnd();
    }
    return `${clipped}${marker}`.slice(0, maxChars).trimEnd();
}

function compactResponse(result: AgentConversationResponse, answerMaxChars: number): AgentConversationResponse {
    const answer = clipBalancedMarkdown(result.answer, answerMaxChars);
    const summary = {
        ...result.summary,
        responseTruncated: true,
        responseTruncationReason: 'runtime_serialized_bytes_limit',
    };
    return {
        userId: result.userId,
        sessionId: result.sessionId,
        assistantMessage: answer,
        answer,
        responseMode: result.responseMode,
        ...(result.responseProfile ? { responseProfile: result.responseProfile } : {}),
        ...(result.responseBudget ? { responseBudget: result.responseBudget } : {}),
        assistantBlocks: [],
        knowledgePoints: [],
        citations: [],
        recalledMemories: [],
        memoryActions: [],
        summary,
        trace: {
            sessionId: result.trace.sessionId,
            invocationId: result.trace.invocationId,
            retrieval: {} as AgentConversationResponse['trace']['retrieval'],
            recalledMemoryCount: 0,
            appliedMemoryCount: 0,
            usedScope: {
                source: result.trace.usedScope.source,
                workspaceId: result.trace.usedScope.workspaceId,
                corpusId: result.trace.usedScope.corpusId,
                documentIds: [],
                atomIds: [],
                sourcePathPrefixes: [],
                languages: [],
                matchedAtomCount: result.trace.usedScope.matchedAtomCount,
            },
            responseBudget: result.responseBudget
                ? {
                    mode: result.responseBudget.mode,
                    tier: result.responseBudget.tier,
                    productCapDisabled: result.responseBudget.productCapDisabled,
                    rag: {
                        maxFragments: result.responseBudget.rag.maxFragments,
                        maxCharsPerFragment: result.responseBudget.rag.maxCharsPerFragment,
                        maxTotalChars: result.responseBudget.rag.maxTotalChars,
                        ...(result.responseBudget.rag.productCapDisabled
                            ? { productCapDisabled: true }
                            : {}),
                    },
                    runtimeGovernor: result.responseBudget.runtimeGovernor,
                    ...(result.responseBudget.reportMaxChars !== undefined
                        ? { reportMaxChars: result.responseBudget.reportMaxChars }
                        : {}),
                }
                : undefined,
            responseTruncated: true,
            responseTruncationReason: 'runtime_serialized_bytes_limit',
        },
    };
}

function compactResultToBudget(
    result: AgentConversationResponse,
    maxBytes: number
): AgentConversationSerializationResult {
    const governorMaxChars = Number(result.responseBudget?.runtimeGovernor.maxReportChars || 320_000);
    let lower = 0;
    let upper = Math.min(32_000, governorMaxChars);
    let best = compactResponse(result, 0);
    let bestJson = JSON.stringify(best);
    while (lower <= upper) {
        const answerMaxChars = Math.floor((lower + upper) / 2);
        const compact = compactResponse(result, answerMaxChars);
        const json = JSON.stringify(compact);
        if (byteLength(json) <= maxBytes) {
            best = compact;
            bestJson = json;
            lower = answerMaxChars + 1;
        } else {
            upper = answerMaxChars - 1;
        }
    }
    if (byteLength(bestJson) <= maxBytes) {
        return {
            json: bestJson,
            result: best,
            truncated: true,
            reason: 'runtime_serialized_bytes_limit',
        };
    }
    const minimal = {
        userId: result.userId,
        sessionId: result.sessionId,
        assistantMessage: '',
        answer: '',
        responseMode: result.responseMode,
        ...(result.responseProfile ? { responseProfile: result.responseProfile } : {}),
        summary: {
            generatedAt: result.summary.generatedAt,
            topK: result.summary.topK,
            returnedKnowledgePoints: 0,
            returnedCitations: 0,
            recalledMemoryCount: 0,
            appliedMemoryCount: 0,
            queryEvidenceCoverageRatioPct: result.summary.queryEvidenceCoverageRatioPct,
        responseTruncated: true,
        responseTruncationReason: 'runtime_serialized_bytes_limit' as const,
        },
        trace: {
            sessionId: result.sessionId,
            invocationId: result.trace.invocationId,
            retrieval: {} as AgentConversationResponse['trace']['retrieval'],
            recalledMemoryCount: 0,
            appliedMemoryCount: 0,
            usedScope: result.trace.usedScope,
            responseTruncated: true,
            responseTruncationReason: 'runtime_serialized_bytes_limit',
        },
        assistantBlocks: [],
        knowledgePoints: [],
        citations: [],
        recalledMemories: [],
        memoryActions: [],
    } as AgentConversationResponse;
    const json = JSON.stringify(minimal);
    return {
        json,
        result: minimal,
        truncated: true,
        reason: 'runtime_serialized_bytes_limit',
    };
}

export function serializeAgentConversationResponse(
    result: AgentConversationResponse
): AgentConversationSerializationResult {
    const json = JSON.stringify(result);
    const maxBytes = Number(result.responseBudget?.runtimeGovernor.maxSerializedBytes || 0);
    if (!Number.isFinite(maxBytes) || maxBytes <= 0 || byteLength(json) <= maxBytes) {
        return { json, result, truncated: false };
    }
    return compactResultToBudget(result, maxBytes);
}

export function serializeAgentConversationHttpResponse(
    result: AgentConversationResponse
): AgentConversationSerializationResult {
    const serialized = serializeAgentConversationResponse(result);
    const envelope = JSON.stringify({ success: true, result: serialized.result });
    const maxBytes = Number(serialized.result.responseBudget?.runtimeGovernor.maxSerializedBytes || 0);
    if (!serialized.truncated && (!Number.isFinite(maxBytes) || maxBytes <= 0 || byteLength(envelope) <= maxBytes)) {
        return { json: envelope, result, truncated: false };
    }
    if (byteLength(envelope) <= maxBytes || maxBytes <= 0) {
        return { ...serialized, json: envelope };
    }
    let compact = compactResultToBudget(serialized.result, Math.max(256, maxBytes - 128));
    let compactEnvelope = JSON.stringify({ success: true, result: compact.result });
    if (byteLength(compactEnvelope) > maxBytes) {
        compact = compactResultToBudget(compact.result, Math.max(128, maxBytes - 256));
        compactEnvelope = JSON.stringify({ success: true, result: compact.result });
    }
    return {
        ...compact,
        json: compactEnvelope,
    };
}

export function serializeAgentConversationTurnEvent(
    eventType: string,
    payload: unknown
): { json: string; truncated: boolean } {
    if (
        eventType === 'turn_completed'
        && payload
        && typeof payload === 'object'
        && !Array.isArray(payload)
        && 'result' in payload
        && payload.result
        && typeof payload.result === 'object'
    ) {
        const event = payload as AgentConversationTurnEvent;
        const serialized = serializeAgentConversationResponse(event.result as AgentConversationResponse);
        let eventResult = serialized.result;
        let eventJson = JSON.stringify({ ...event, result: eventResult });
        const maxBytes = Number(eventResult.responseBudget?.runtimeGovernor.maxSerializedBytes || 0);
        if (serialized.truncated && maxBytes > 0 && byteLength(eventJson) > maxBytes) {
            const compact = compactResultToBudget(eventResult, Math.max(128, maxBytes - 256));
            eventResult = compact.result;
            eventJson = JSON.stringify({ ...event, result: eventResult });
        }
        return {
            json: eventJson,
            truncated: serialized.truncated,
        };
    }
    return { json: JSON.stringify(payload), truncated: false };
}

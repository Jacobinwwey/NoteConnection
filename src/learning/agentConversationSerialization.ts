import type { AgentConversationResponse, AgentConversationTurnEvent, KnowledgeCitation } from './types';
import { projectAnswerForMobile } from './mobileAnswerProjection';

export type AgentConversationSerializationResult = {
    json: string;
    result: AgentConversationResponse;
    truncated: boolean;
    reason?: 'runtime_serialized_bytes_limit';
};

const TRUNCATION_REASON = 'runtime_serialized_bytes_limit';
// Covers a completed event, its validated 160-byte turn ID, timestamp and SSE framing.
// Every transport reserves the same space to release the same answer.
const TURN_WIRE_RESERVE_BYTES = 288;
const DEFAULT_WIRE_LIMIT = 8 * 1024 * 1024;
const MAX_RELEASE_CITATIONS = 64;
const MAX_RELEASE_CLAIMS = 128;

export class AgentConversationSerializationError extends Error {
    readonly code = TRUNCATION_REASON;
    readonly statusCode = 413;
    constructor() { super(TRUNCATION_REASON); }
}

/** Exact for JSON data; stops before allocating a serialized copy of an oversized response. */
export function measureJsonBytes(value: unknown, limit: number): number {
    let bytes = 0;
    const ancestors = new Set<object>();
    const stringBytes = (text: string): void => {
        bytes += 2;
        for (let i = 0; i < text.length && bytes <= limit; i++) {
            const code = text.charCodeAt(i);
            if (code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13) bytes += 2;
            else if (code < 32) bytes += 6;
            else if (code < 128) bytes++;
            else if (code < 2048) bytes += 2;
            else if (code >= 0xd800 && code <= 0xdbff) {
                const next = text.charCodeAt(i + 1);
                if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; }
                else bytes += 6;
            } else if (code >= 0xdc00 && code <= 0xdfff) bytes += 6;
            else bytes += 3;
        }
    };
    const visit = (item: unknown, depth: number): void => {
        if (bytes > limit) return;
        if (item === null || item === undefined || typeof item === 'function' || typeof item === 'symbol') { bytes += 4; return; }
        if (typeof item === 'string') { stringBytes(item); return; }
        if (typeof item === 'boolean') { bytes += item ? 4 : 5; return; }
        if (typeof item === 'number') { bytes += Number.isFinite(item) ? String(item).length : 4; return; }
        if (typeof item !== 'object') throw new TypeError('Conversation responses must contain JSON data');
        if (ancestors.has(item) || depth > 64) throw new TypeError('Cyclic or excessively nested conversation response');
        if (typeof (item as { toJSON?: unknown }).toJSON === 'function') throw new TypeError('Conversation responses must contain plain JSON data');
        ancestors.add(item);
        bytes += 2;
        if (Array.isArray(item)) {
            for (let i = 0; i < item.length && bytes <= limit; i++) {
                if (i) bytes++;
                visit(item[i], depth + 1);
            }
        } else {
            let first = true;
            for (const key in item) {
                if (bytes > limit) break;
                if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
                const child = (item as Record<string, unknown>)[key];
                if (child === undefined || typeof child === 'function' || typeof child === 'symbol') continue;
                if (!first) bytes++;
                first = false;
                stringBytes(key);
                bytes++;
                visit(child, depth + 1);
            }
        }
        ancestors.delete(item);
    };
    visit(value, 0);
    return bytes;
}

function wireLimit(result: AgentConversationResponse): number {
    const requested = Number(result.responseBudget?.runtimeGovernor.maxSerializedBytes);
    return Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : DEFAULT_WIRE_LIMIT;
}

function countUnescaped(value: string, token: string): number {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    return (value.match(new RegExp(`(?<!\\\\)${escapedToken}`, 'gu')) || []).length;
}

function clipBalancedMarkdown(source: string, maxChars: number): string {
    if (source.length <= maxChars) return source;
    const marker = '\n\n[Response truncated by runtime safety governor.]';
    if (maxChars < marker.length) return '';
    let clipped = source.slice(0, maxChars - marker.length).trimEnd();
    // Keep whole claims when possible, and never leave an unterminated code/math block.
    const boundary = Math.max(clipped.lastIndexOf('\n\n'), clipped.lastIndexOf('. '), clipped.lastIndexOf('。'));
    if (boundary >= clipped.length / 2) clipped = clipped.slice(0, boundary + (clipped[boundary] === '\n' ? 0 : 1)).trimEnd();
    const fences = [...clipped.matchAll(/^\s*(`{3,}|~{3,}).*$/gm)];
    let openFence: { marker: string; index: number } | undefined;
    for (const fence of fences) {
        if (!openFence) openFence = { marker: fence[1], index: fence.index! };
        else if (fence[1][0] === openFence.marker[0] && fence[1].length >= openFence.marker.length) openFence = undefined;
    }
    if (openFence) clipped = clipped.slice(0, openFence.index).trimEnd();
    if (countUnescaped(clipped, '$$') % 2) clipped = clipped.slice(0, clipped.lastIndexOf('$$')).trimEnd();
    if (countUnescaped(clipped.replace(/(?<!\\)\$\$/gu, ''), '$') % 2) clipped = clipped.slice(0, clipped.lastIndexOf('$')).trimEnd();
    if (countUnescaped(clipped.replace(/^\s*`{3,}.*$/gm, ''), '`') % 2) clipped = clipped.slice(0, clipped.lastIndexOf('`')).trimEnd();
    if (clipped.lastIndexOf('[') > clipped.lastIndexOf(']')) clipped = clipped.slice(0, clipped.lastIndexOf('[')).trimEnd();
    if (/[\ud800-\udbff]$/.test(clipped)) clipped = clipped.slice(0, -1);
    return `${clipped}${marker}`.trim();
}

function compactResponse(result: AgentConversationResponse, answerMaxChars: number): AgentConversationResponse {
    const sourceCitations = result.citations || [];
    const sourceClaims = result.trace?.answerClaimCitations || [];
    let answer = clipBalancedMarkdown(result.answer || '', answerMaxChars);
    // Oversized metadata must not leave a retained claim with a dangling citation.
    const boundedEvidence = sourceCitations.length <= MAX_RELEASE_CITATIONS && sourceClaims.length <= MAX_RELEASE_CLAIMS;
    const citations: KnowledgeCitation[] = boundedEvidence ? sourceCitations.map(citation => ({
        citationId: citation.citationId, atomId: citation.atomId, documentId: citation.documentId,
        sourcePath: citation.sourcePath, title: citation.title,
        snippet: citation.snippet.length > 1024 ? `${citation.snippet.slice(0, 1021)}...` : citation.snippet,
        startOffset: citation.startOffset, endOffset: citation.endOffset, startLine: citation.startLine, endLine: citation.endLine,
        score: citation.score,
    })) : [];
    const citationIds = new Set(citations.map(citation => citation.citationId));
    const claims = boundedEvidence ? sourceClaims.filter(claim => answer.includes(claim.text)) : [];
    const claimsSupported = claims.every(claim => claim.citationIds.length <= MAX_RELEASE_CITATIONS
        && claim.citationIds.every(id => citationIds.has(id)));
    if (!boundedEvidence || !claimsSupported) {
        answer = clipBalancedMarkdown('[Response truncated by runtime safety governor. Narrow the request to retain its evidence.]', answerMaxChars);
        citations.length = 0;
        claims.length = 0;
    }
    const compact: AgentConversationResponse = {
        userId: result.userId,
        sessionId: result.sessionId,
        assistantMessage: answer,
        answer,
        responseMode: result.responseMode,
        ...(result.responseProfile ? { responseProfile: result.responseProfile } : {}),
        ...(result.responseBudget ? { responseBudget: result.responseBudget } : {}),
        assistantBlocks: [], knowledgePoints: [], citations, recalledMemories: [], memoryActions: [],
        summary: {
            generatedAt: result.summary.generatedAt,
            topK: result.summary.topK,
            returnedKnowledgePoints: 0,
            returnedCitations: citations.length,
            recalledMemoryCount: 0,
            appliedMemoryCount: 0,
            queryEvidenceCoverageRatioPct: citations.length ? result.summary.queryEvidenceCoverageRatioPct : 0,
            responseTruncated: true,
            responseTruncationReason: TRUNCATION_REASON,
        },
        trace: {
            sessionId: result.sessionId,
            invocationId: result.trace?.invocationId || '',
            retrieval: {} as AgentConversationResponse['trace']['retrieval'],
            recalledMemoryCount: 0,
            appliedMemoryCount: 0,
            usedScope: {
                source: result.trace?.usedScope?.source || 'global',
                workspaceId: result.trace?.usedScope?.workspaceId || null,
                corpusId: result.trace?.usedScope?.corpusId || null,
                documentIds: [], atomIds: [], sourcePathPrefixes: [], languages: [],
                matchedAtomCount: result.trace?.usedScope?.matchedAtomCount || 0,
            },
            ...(claims.length ? { answerClaimCitations: claims } : {}),
            responseTruncated: true,
            responseTruncationReason: TRUNCATION_REASON,
        },
    };
    if (result.responseProfile === 'mobile_compact') compact.mobileProjection = projectAnswerForMobile(compact);
    return compact;
}

function releaseWithinBudget(result: AgentConversationResponse, maxBytes: number): AgentConversationSerializationResult {
    if (measureJsonBytes(result, maxBytes) <= maxBytes) {
        const truncated = result.summary.responseTruncationReason === TRUNCATION_REASON;
        return { json: JSON.stringify(result), result, truncated, ...(truncated ? { reason: TRUNCATION_REASON } : {}) };
    }
    let lower = 0;
    let upper = Math.min(32_000, result.answer.length, result.responseBudget?.runtimeGovernor.maxReportChars || 32_000);
    let best = compactResponse(result, 0);
    if (measureJsonBytes(best, maxBytes) > maxBytes) {
        // If citations cannot fit, release no scientific claims and no obsolete coverage.
        best = compactResponse({ ...result, citations: [], answer: '', trace: { ...result.trace, answerClaimCitations: [] } }, 0);
        delete best.responseBudget;
        if (measureJsonBytes(best, maxBytes) > maxBytes) throw new AgentConversationSerializationError();
        return { json: JSON.stringify(best), result: best, truncated: true, reason: TRUNCATION_REASON };
    }
    while (lower <= upper) {
        const chars = Math.floor((lower + upper) / 2);
        const candidate = compactResponse(result, chars);
        if (measureJsonBytes(candidate, maxBytes) <= maxBytes) { best = candidate; lower = chars + 1; }
        else upper = chars - 1;
    }
    return { json: JSON.stringify(best), result: best, truncated: true, reason: TRUNCATION_REASON };
}

export function serializeAgentConversationResponse(result: AgentConversationResponse): AgentConversationSerializationResult {
    return releaseWithinBudget(result, wireLimit(result) - TURN_WIRE_RESERVE_BYTES);
}

export function serializeAgentConversationHttpResponse(result: AgentConversationResponse): AgentConversationSerializationResult {
    const serialized = serializeAgentConversationResponse(result);
    return { ...serialized, json: `{"success":true,"result":${serialized.json}}` };
}

export function serializeAgentConversationTurnEvent(eventType: string, payload: unknown): { json: string; truncated: boolean } {
    if (eventType === 'turn_completed' && payload && typeof payload === 'object' && 'result' in payload && payload.result) {
        const event = payload as AgentConversationTurnEvent;
        const limit = wireLimit(event.result!);
        const envelope = { ...event, result: null };
        const framingBytes = Buffer.byteLength(`event: ${eventType}\ndata: \n\n`);
        const envelopeBytes = measureJsonBytes(envelope, limit) - 4 + framingBytes;
        const serialized = releaseWithinBudget(event.result!, limit - Math.max(TURN_WIRE_RESERVE_BYTES, envelopeBytes));
        return { json: JSON.stringify({ ...event, result: serialized.result }), truncated: serialized.truncated };
    }
    const payloadLimit = DEFAULT_WIRE_LIMIT - Buffer.byteLength(`event: ${eventType}\ndata: \n\n`);
    if (measureJsonBytes(payload, payloadLimit) > payloadLimit) throw new AgentConversationSerializationError();
    return { json: JSON.stringify(payload), truncated: false };
}

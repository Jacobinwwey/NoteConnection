import {
    measureJsonBytes,
    serializeAgentConversationHttpResponse,
    serializeAgentConversationResponse,
    serializeAgentConversationTurnEvent,
} from './agentConversationSerialization';
import type { AgentConversationResponse } from './types';

function makeResponse(overrides: Partial<AgentConversationResponse> = {}): AgentConversationResponse {
    const answer = overrides.answer || 'A bounded answer.';
    return {
        userId: 'serialization-user',
        sessionId: 'serialization-session',
        assistantMessage: answer,
        answer,
        responseMode: 'full',
        responseBudget: {
            mode: 'unbounded',
            tier: 'unbounded',
            productCapDisabled: true,
            rag: {
                maxFragments: 4096,
                maxCharsPerFragment: 16_000,
                maxTotalChars: 320_000,
                productCapDisabled: true,
                runtimeMaxFragments: 4096,
                runtimeMaxCharsPerFragment: 16_000,
                runtimeMaxTotalChars: 64 * 1024 * 1024,
            },
            runtimeGovernor: {
                timeoutMs: 180_000,
                maxSerializedBytes: 1_200,
                maxFragmentsProcessed: 4096,
                maxReportChars: 320_000,
            },
        },
        knowledgePoints: [],
        citations: [],
        recalledMemories: [],
        memoryActions: [],
        summary: {
            generatedAt: '2026-09-03T00:00:00.000Z',
            topK: 6,
            returnedKnowledgePoints: 0,
            returnedCitations: 0,
            recalledMemoryCount: 0,
            appliedMemoryCount: 0,
            queryEvidenceCoverageRatioPct: 100,
        },
        trace: {
            sessionId: 'serialization-session',
            invocationId: 'serialization-invocation',
            retrieval: {} as AgentConversationResponse['trace']['retrieval'],
            recalledMemoryCount: 0,
            appliedMemoryCount: 0,
            usedScope: {
                source: 'global',
                workspaceId: null,
                corpusId: null,
                documentIds: [],
                atomIds: [],
                sourcePathPrefixes: [],
                languages: [],
                matchedAtomCount: 0,
            },
            responseBudget: undefined,
        },
        ...overrides,
    };
}

describe('agent conversation serialization governor', () => {
    test.each(['知识🧠', 'quotes " \\ \n\t', '\ud800', '\u0000', { nested: [null, undefined, 1, false] }])('measures JSON escaping and UTF-8 before allocation: %p', value => {
        const bytes = Buffer.byteLength(JSON.stringify(value));
        expect(measureJsonBytes(value, bytes)).toBe(bytes);
        expect(measureJsonBytes(value, bytes - 1)).toBeGreaterThan(bytes - 1);
    });

    test('the response fits but the full SSE envelope does not', () => {
        const response = makeResponse();
        response.responseBudget!.runtimeGovernor.maxSerializedBytes = 2000;
        response.answer += 'x'.repeat(Math.max(0, 1998 - Buffer.byteLength(JSON.stringify(response)))) ;
        expect(Buffer.byteLength(JSON.stringify(response))).toBe(1998);
        const event = serializeAgentConversationTurnEvent('turn_completed', {
            type: 'turn_completed', turnId: 'turn_envelope', emittedAt: '2026-09-12T00:00:00.000Z', result: response,
        });
        expect(Buffer.byteLength(`event: turn_completed\ndata: ${event.json}\n\n`)).toBeLessThanOrEqual(2000);
        expect(event.truncated).toBe(true);
        expect(JSON.parse(event.json).result.summary.responseTruncated).toBe(true);
    });

    test('one released projection is reused for JSON, SSE and replay with surviving citations', () => {
        const response = makeResponse({ answer: 'A supported claim. '.repeat(800), assistantMessage: 'A supported claim. '.repeat(800) });
        response.responseBudget!.runtimeGovernor.maxSerializedBytes = 4000;
        response.citations = [{ citationId: 'cite-1', atomId: 'atom-1', documentId: 'doc-1', sourcePath: 'source.md', title: 'Source', snippet: 'A supported claim.', score: 1 }];
        response.summary.returnedCitations = 99;
        response.trace.answerClaimCitations = [{ claimId: 'claim-1', text: 'A supported claim.', citationIds: ['cite-1'], fragmentIds: ['fragment-1'], sourcePaths: ['source.md'], supportStatus: 'supported' }];
        const http = serializeAgentConversationHttpResponse(response);
        const event = { type: 'turn_completed', turnId: 'turn_citations', emittedAt: '2026-09-12T00:00:00.000Z', result: response };
        const live = serializeAgentConversationTurnEvent('turn_completed', event);
        const replay = serializeAgentConversationTurnEvent('turn_completed', { ...event, result: http.result });
        expect(JSON.parse(live.json).result).toEqual(http.result);
        expect(JSON.parse(replay.json).result).toEqual(http.result);
        expect(http.result.answer).toContain('A supported claim.');
        expect(http.result.citations.map(citation => citation.citationId)).toEqual(['cite-1']);
        expect(http.result.summary.returnedCitations).toBe(http.result.citations.length);
        expect(http.result.summary.returnedKnowledgePoints).toBe(http.result.knowledgePoints.length);
    });

    test('does not initially stringify oversized diagnostic collections', () => {
        const response = makeResponse();
        response.trace.retrieval = { hugeDiagnostics: Array.from({ length: 10000 }, () => 'diagnostic'.repeat(50)) } as any;
        const stringify = jest.spyOn(JSON, 'stringify');
        try {
            const serialized = serializeAgentConversationResponse(response);
            expect(stringify).not.toHaveBeenCalledWith(response);
            expect(Buffer.byteLength(serialized.json)).toBeLessThanOrEqual(1200);
            expect(serialized.result.summary.queryEvidenceCoverageRatioPct).toBe(0);
        } finally { stringify.mockRestore(); }
    });

    test('rejects a ceiling too small for the required response contract', () => {
        const response = makeResponse();
        response.responseBudget!.runtimeGovernor.maxSerializedBytes = 64;
        expect(() => serializeAgentConversationHttpResponse(response)).toThrow('runtime_serialized_bytes_limit');
    });
    test('keeps responses unchanged while under the runtime byte limit', () => {
        const response = makeResponse({
            responseBudget: {
                ...makeResponse().responseBudget!,
                runtimeGovernor: {
                    ...makeResponse().responseBudget!.runtimeGovernor,
                    maxSerializedBytes: 100_000,
                },
            },
        });
        const serialized = serializeAgentConversationResponse(response);
        expect(serialized.truncated).toBe(false);
        expect(JSON.parse(serialized.json).answer).toBe(response.answer);
    });

    test('compacts oversized unbounded responses and preserves balanced display math', () => {
        const response = makeResponse({
            answer: `## Report\n\n${'Long evidence. '.repeat(2_000)}\n\n$$\\frac{a}{b}$$`,
            assistantMessage: `## Report\n\n${'Long evidence. '.repeat(2_000)}\n\n$$\\frac{a}{b}$$`,
        });
        const serialized = serializeAgentConversationResponse(response);
        expect(serialized.truncated).toBe(true);
        expect(Buffer.byteLength(serialized.json, 'utf8')).toBeLessThanOrEqual(1_200);
        expect(serialized.result.summary.responseTruncated).toBe(true);
        expect(serialized.result.summary.responseTruncationReason).toBe('runtime_serialized_bytes_limit');
        expect((serialized.result.answer.match(/(?<!\\)\$\$/gu) || []).length % 2).toBe(0);
    });

    test('applies the same governor to a completed SSE event', () => {
        const response = makeResponse({ answer: 'Event payload '.repeat(2_000) });
        const serialized = serializeAgentConversationTurnEvent('turn_completed', {
            type: 'turn_completed',
            turnId: 'turn_serialization',
            emittedAt: '2026-09-03T00:00:00.000Z',
            result: response,
        });
        const event = JSON.parse(serialized.json);
        expect(serialized.truncated).toBe(true);
        expect(event.result.summary.responseTruncated).toBe(true);
    });

    test('serializes the HTTP success envelope within the runtime limit', () => {
        const response = makeResponse({ answer: 'HTTP payload '.repeat(2_000) });
        const serialized = serializeAgentConversationHttpResponse(response);
        expect(serialized.truncated).toBe(true);
        expect(Buffer.byteLength(serialized.json, 'utf8')).toBeLessThanOrEqual(1_200);
        expect(JSON.parse(serialized.json).success).toBe(true);
    });
});

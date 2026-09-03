import {
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

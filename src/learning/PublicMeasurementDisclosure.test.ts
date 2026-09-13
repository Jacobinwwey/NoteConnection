import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import type { AgentConversationRequest } from './types';
import { serializeAgentConversationHttpResponse, serializeAgentConversationTurnEvent } from './agentConversationSerialization';

async function answerMeasurements(request: Pick<AgentConversationRequest, 'message' | 'answerLanguage' | 'responseMode'>, first: string, second: string) {
    const platform = new KnowledgeLearningPlatform({ autoPersist: false });
    await platform.ingestKnowledge({ relationRecomputeMode: 'none', documents: [
        { documentId: 'clock-primary', sourcePath: 'quality/clock-primary.md', content: first },
        { documentId: 'clock-secondary', sourcePath: 'quality/clock-secondary.md', content: second },
    ] });
    return platform.agentConversation({ ...request, persistMemory: false });
}

describe('public measurement conflict disclosure', () => {
    test.each(['slim', 'full'] as const)('keeps conflicting English observations and their citations in %s', async responseMode => {
        const response = await answerMeasurements({ message: 'What is the Echo clock rate?', answerLanguage: 'en', responseMode },
            '# Echo Clock Rate\nThe Echo clock rate is 4 Hz.',
            '# Echo Clock Rate Record\nThe Echo clock rate is 9 Hz.');
        expect(response.trace.ragContextPack?.fragments.some(fragment => fragment.role === 'conflict')).toBe(true);
        expect(response.answer).toMatch(/4\s*Hz/iu);
        expect(response.answer).toMatch(/9\s*Hz/iu);
        expect(response.answer).toMatch(/conflict|contradict|disagree/iu);
        expect(response.citations.map(citation => citation.documentId)).toEqual(expect.arrayContaining(['clock-primary', 'clock-secondary']));
        expect(response.answerReleaseReview?.decision).not.toBe('abstain');
    });

    test.each(['slim', 'full'] as const)('keeps conflicting Chinese observations and their citations in %s', async responseMode => {
        const response = await answerMeasurements({ message: '回声时钟频率是多少？', answerLanguage: 'zh', responseMode },
            '# 回声时钟频率\n回声时钟频率是4赫兹。',
            '# 回声时钟频率记录\n回声时钟频率是9赫兹。');
        expect(response.trace.ragContextPack?.fragments.some(fragment => fragment.role === 'conflict')).toBe(true);
        expect(response.answer).toContain('4赫兹');
        expect(response.answer).toContain('9赫兹');
        expect(response.answer).toMatch(/冲突|矛盾|不一致/u);
        expect(response.citations.map(citation => citation.documentId)).toEqual(expect.arrayContaining(['clock-primary', 'clock-secondary']));
        expect(response.answerReleaseReview?.decision).not.toBe('abstain');
    });

    test.each(['slim', 'full'] as const)('does not manufacture conflicts between equivalent observations in %s', async responseMode => {
        const response = await answerMeasurements({ message: 'What is the Echo clock rate?', answerLanguage: 'en', responseMode },
            '# Echo Clock Rate\nThe Echo clock rate is 1 kHz.',
            '# Echo Clock Rate Record\nThe Echo clock rate is 1000 Hz.');
        expect(response.trace.ragContextPack?.fragments.some(fragment => fragment.role === 'conflict')).toBe(false);
        expect(response.answer).not.toMatch(/conflict|contradict|disagree/iu);
        expect(response.answer).toMatch(/(?:1\s*kHz|1000\s*Hz)/iu);
        expect(response.answerReleaseReview?.decision).not.toBe('abstain');
    });

    test('retains the same conflict and citations through bounded JSON, SSE and replay', async () => {
        const response = await answerMeasurements({ message: 'What is the Echo clock rate?', answerLanguage: 'en', responseMode: 'full' },
            '# Echo Clock Rate\nThe Echo clock rate is 4 Hz.',
            '# Echo Clock Rate Record\nThe Echo clock rate is 9 Hz.');
        response.responseBudget!.runtimeGovernor.maxSerializedBytes = 6000;
        const http = serializeAgentConversationHttpResponse(response);
        const event = { type: 'turn_completed', turnId: 'conflict-disclosure', emittedAt: '2026-09-13T00:00:00.000Z', result: response };
        const live = serializeAgentConversationTurnEvent('turn_completed', event);
        const replay = serializeAgentConversationTurnEvent('turn_completed', { ...event, result: http.result });
        expect(http.truncated).toBe(true);
        expect(JSON.parse(live.json).result).toEqual(http.result);
        expect(JSON.parse(replay.json).result).toEqual(http.result);
        expect(http.result.answer).toMatch(/observations conflict/iu);
        expect(http.result.answer).toMatch(/4\s*Hz/iu);
        expect(http.result.answer).toMatch(/9\s*Hz/iu);
        expect(http.result.citations.map(citation => citation.documentId)).toEqual(expect.arrayContaining(['clock-primary', 'clock-secondary']));
    });
});

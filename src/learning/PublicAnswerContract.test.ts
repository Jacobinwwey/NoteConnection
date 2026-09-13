import fs from 'fs';
import path from 'path';
import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import { parseAnswerQualityCorpus } from './AnswerQualityEvaluation';

// V3's first confirmation is archived. These observed cases are now regression evidence.
const corpus = parseAnswerQualityCorpus(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../fixtures/answer-quality/v3.json'), 'utf8')));
const cases = corpus.cases.filter(entry => [
    'cal-dag-en', 'cal-dag-zh', 'cal-retention-en', 'v3-retry-budget-en', 'v3-idempotency-zh',
    'v3-sets-en', 'v3-index-swap-en', 'v3-memory-fences-en', 'v3-transaction-isolation-zh',
    'v3-channels-zh', 'v3-checksum-en', 'v3-stable-reference-zh',
].includes(entry.id));
const observedV4 = parseAnswerQualityCorpus(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../fixtures/answer-quality/v4.json'), 'utf8')));
cases.push(...observedV4.cases.filter(entry => ['v4-receives-en', 'v4-content-addressing-en'].includes(entry.id)));

describe.each(['slim', 'full'] as const)('public answer contracts in %s', responseMode => {
    test('treats a requested table concept as subject matter', async () => {
        const platform = new KnowledgeLearningPlatform({ autoPersist: false });
        await platform.ingestKnowledge({ relationRecomputeMode: 'none', documents: [
            { documentId: 'dispatch-table', sourcePath: 'quality/dispatch.md', content: '# Dispatch Table\nA dispatch table maps operation codes to executable targets.' },
        ] });
        const response = await platform.agentConversation({ message: 'What is a dispatch table?', answerLanguage: 'en', responseMode, persistMemory: false });
        expect(response.answer).toContain('maps operation codes');
        expect(response.answerReleaseReview?.decision).not.toBe('abstain');
    });

    test('keeps a short Chinese definition and its supported constraint', async () => {
        const platform = new KnowledgeLearningPlatform({ autoPersist: false });
        await platform.ingestKnowledge({ relationRecomputeMode: 'none', documents: [
            { documentId: 'mutex', sourcePath: 'quality/mutex.md', content: '# 互斥锁\n互斥锁保护临界区。同一时刻只有一个持有者。' },
        ] });
        const response = await platform.agentConversation({ message: '什么是互斥锁？', answerLanguage: 'zh', responseMode, persistMemory: false });
        expect(response.answer).toContain('保护临界区');
        expect(response.answer).toContain('同一时刻只有一个持有者');
    });

    test('rejects an attribute assertion about a different entity', async () => {
        const platform = new KnowledgeLearningPlatform({ autoPersist: false });
        await platform.ingestKnowledge({ relationRecomputeMode: 'none', documents: [
            { documentId: 'helium', sourcePath: 'quality/helium.md', content: '# Helium Log\nThe Helium log retention period is 9 days.' },
        ] });
        const response = await platform.agentConversation({ message: 'What is the retention period for the Titanium log?', answerLanguage: 'en', responseMode, persistMemory: false });
        expect(response.answerReleaseReview?.decision).toBe('abstain');
        expect(response.answer).not.toMatch(/9 days/iu);
    });

    test.each(cases)('$id preserves the requested evidence and its ordering', async entry => {
        const platform = new KnowledgeLearningPlatform({ autoPersist: false });
        await platform.ingestKnowledge({ documents: entry.documents, relationRecomputeMode: 'none' });
        const response = await platform.agentConversation({ message: entry.query, answerLanguage: entry.language, responseMode,
            persistMemory: false, scope: { documentIds: entry.documents.map(document => document.documentId!) } });
        expect(response.answerReleaseReview?.decision).not.toBe('abstain');
        for (const fact of entry.reference.facts) {
            expect({ id: fact.id, covered: fact.patterns.some(pattern => new RegExp(pattern, 'iu').test(response.answer)) })
                .toEqual({ id: fact.id, covered: true });
        }
        for (const claim of entry.reference.unsupportedClaims) expect(response.answer).not.toMatch(new RegExp(claim.pattern, 'iu'));
        let previousEnd = 0;
        for (const step of entry.reference.orderedSteps || []) {
            const match = new RegExp(step, 'iu').exec(response.answer.slice(previousEnd));
            expect(match).not.toBeNull();
            previousEnd += match!.index + match![0].length;
        }
    });
});

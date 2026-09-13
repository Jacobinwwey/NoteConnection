import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import type { KnowledgeDocumentInput } from './types';

const regressionCorpus = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../fixtures/answer-quality/v2.json'), 'utf8'));

async function answer(message: string, documents: KnowledgeDocumentInput[], language: 'en' | 'zh' = 'en') {
    const platform = new KnowledgeLearningPlatform({ autoPersist: false });
    await platform.ingestKnowledge({ documents, relationRecomputeMode: 'none' });
    const request = { message, answerLanguage: language, responseMode: 'full' as const, persistMemory: false,
        scope: { documentIds: documents.map(document => document.documentId!) } };
    return { platform, response: await platform.agentConversation(request) };
}

describe('public evidence source selection', () => {
    test.each(['en', 'zh'] as const)('keeps scoped topic distractors out of the %s answer, citations and required claims', async language => {
        const entry = regressionCorpus.cases.find((candidate: { id: string }) => candidate.id === `confirm-wal-${language}`);
        const { platform, response } = await answer(entry.query, entry.documents, language);
        const excludedDocumentId = entry.documents[1].documentId;
        expect(response.answer).not.toMatch(/cardinals|bird.watching|红雀|观鸟/iu);
        expect(response.answer).toMatch(language === 'en' ? /durable log.*reconstruct/iu : /持久日志重建/u);
        expect(response.citations.every(citation => citation.documentId !== excludedDocumentId)).toBe(true);
        expect(response.answerReleaseReview?.auditGraphAnswerPlan?.claims.every(claim => (
            claim.evidenceRefs.every(reference => reference.sourcePath !== entry.documents[1].sourcePath)
        ))).toBe(true);
        expect(response.trace.ragContextPack?.sourceDecisions).toContainEqual(expect.objectContaining({
            documentId: excludedDocumentId, status: 'fragment_dropped', reason: 'query_subject_mismatch', charsRead: 0,
        }));
        const retrieval = await platform.queryKnowledge({ query: entry.query, topK: 12,
            scope: { documentIds: entry.documents.map((document: KnowledgeDocumentInput) => document.documentId!) } });
        expect(retrieval.items.some(item => item.atom.documentId === excludedDocumentId)).toBe(true);
    });

    test('retains a second source whose body establishes the requested subject', async () => {
        const { response } = await answer('Explain recovery point objectives.', [
            { documentId: 'rpo-definition', sourcePath: 'quality/rpo.md', content: '# Recovery Point Objectives\nA recovery point objective bounds the acceptable age of recovered data.' },
            { documentId: 'rpo-scheduling', sourcePath: 'quality/schedule.md', content: '# Scheduling Policy\nRecovery point objectives determine how frequently snapshots must be taken.' },
            { documentId: 'business-objectives', sourcePath: 'quality/business.md', content: '# Business Objectives\nBusiness objectives guide revenue targets and quarterly sales reviews.' },
        ]);
        expect(response.answer).toMatch(/acceptable age/iu);
        expect(response.answer).toMatch(/how frequently snapshots/iu);
        expect(response.answer).not.toMatch(/revenue|quarterly sales/iu);
        expect(response.citations.map(citation => citation.documentId)).toEqual(expect.arrayContaining(['rpo-definition', 'rpo-scheduling']));
    });

    test('retains both comparison operands while rejecting a shared-word distractor', async () => {
        const { response } = await answer('Compare an exclusive lock and a shared lock.', [
            { documentId: 'exclusive', sourcePath: 'quality/exclusive.md', content: '# Exclusive Lock\nAn exclusive lock permits only one owner to access the protected resource.' },
            { documentId: 'shared', sourcePath: 'quality/shared.md', content: '# Shared Lock\nA shared lock permits several readers to access the protected resource concurrently.' },
            { documentId: 'door', sourcePath: 'quality/door.md', content: '# Door Lock\nA door lock may be painted bright yellow to match a wooden door.' },
        ]);
        expect(response.answer).toMatch(/only one owner/iu);
        expect(response.answer).toMatch(/several readers/iu);
        expect(response.answer).not.toMatch(/bright yellow|wooden door/iu);
        expect(response.citations.map(citation => citation.documentId)).not.toContain('door');
    });

    test('does not choose a winner among competing observations of the same subject', async () => {
        const { response } = await answer('What is the Echo clock rate?', [
            { documentId: 'echo-a', sourcePath: 'quality/echo-a.md', content: '# Echo Clock Rate\nThe Echo clock rate is 4 Hz.' },
            { documentId: 'echo-b', sourcePath: 'quality/echo-b.md', content: '# Echo Clock Rate Record\nThe Echo clock rate is 9 Hz.' },
        ]);
        expect(response.answer).toMatch(/4\s*Hz/iu);
        expect(response.answer).toMatch(/9\s*Hz/iu);
        expect(response.citations.map(citation => citation.documentId)).toEqual(expect.arrayContaining(['echo-a', 'echo-b']));
    });
});

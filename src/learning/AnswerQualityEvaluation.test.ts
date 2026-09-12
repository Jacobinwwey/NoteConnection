import fs from 'fs';
import path from 'path';
import { ANSWER_QUALITY_CATEGORIES, measureAnswerQuality, parseAnswerQualityCorpus, summarizeAnswerQuality } from './AnswerQualityEvaluation';
import type { AgentConversationResponse } from './types';

const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../fixtures/answer-quality/v1.json'), 'utf8'));

describe('independent answer-quality measurements', () => {
    test('validates disjoint bilingual calibration/evaluation sets covering every declared category', () => {
        const corpus = parseAnswerQualityCorpus(raw);
        expect(corpus.cases.filter(entry => entry.split === 'calibration')).toHaveLength(6);
        const heldOut = corpus.cases.filter(entry => entry.split === 'evaluation');
        expect(heldOut).toHaveLength(18);
        for (const category of ANSWER_QUALITY_CATEGORIES) expect(heldOut.filter(entry => entry.category === category).map(entry => entry.language).sort()).toEqual(['en', 'zh']);
    });
    test('the confirmation corpus uses disjoint evaluation documents and subjects', () => {
        const confirmation = parseAnswerQualityCorpus(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../fixtures/answer-quality/v2.json'), 'utf8')));
        const original = parseAnswerQualityCorpus(raw);
        const queries = new Set(original.cases.map(entry => entry.query));
        const sourceContents = new Set(original.cases.flatMap(entry => entry.documents.map(document => document.content.replace(/\s+/g, ' ').trim())));
        for (const entry of confirmation.cases.filter(item => item.split === 'evaluation')) {
            expect(queries.has(entry.query)).toBe(false);
            for (const document of entry.documents) expect(sourceContents.has(document.content.replace(/\s+/g, ' ').trim())).toBe(false);
        }
        for (const category of ANSWER_QUALITY_CATEGORIES) expect(confirmation.cases.filter(entry => entry.split === 'evaluation' && entry.category === category).map(entry => entry.language).sort()).toEqual(['en', 'zh']);
    });
    test('rejects source leakage between calibration and evaluation', () => {
        const corpus = structuredClone(raw);
        corpus.cases[6].documents[0].content = corpus.cases[0].documents[0].content;
        expect(() => parseAnswerQualityCorpus(corpus)).toThrow('source leakage');
    });
    test('does not substitute runtime sufficient claims for independently labelled fact coverage', () => {
        const entry = parseAnswerQualityCorpus(raw).cases.find(item => item.id === 'eval-idempotency-en')!;
        const response = { answer: 'It ensures exactly-once network delivery.', citations: [], answerReleaseReview: { decision: 'release' } } as unknown as AgentConversationResponse;
        const measurement = measureAnswerQuality(entry, response);
        expect(measurement.coveredFactIds).toEqual([]);
        expect(measurement.unsupportedClaimIds).toEqual(['unsupported-1']);
        expect(measurement.passed).toBe(false);
    });
    test('retains explicit denominators and reports undefined rates when no opportunities exist', () => {
        const entry = parseAnswerQualityCorpus(raw).cases.find(item => item.id === 'eval-missing-en')!;
        const measurement = measureAnswerQuality(entry, { answer: 'Insufficient evidence.', citations: [], answerReleaseReview: { decision: 'abstain' } } as unknown as AgentConversationResponse);
        const summary = summarizeAnswerQuality([measurement]);
        expect(summary.referenceFactCoverage).toEqual({ numerator: 0, denominator: 0, rate: null });
        expect(summary.correctAbstentionRate).toEqual({ numerator: 1, denominator: 1, rate: 1 });
        expect(summary.missedConflictRate.rate).toBeNull();
    });
    test('catches reversed procedural steps and unbalanced math', () => {
        const entry = parseAnswerQualityCorpus(raw).cases.find(item => item.id === 'eval-replacement-en')!;
        const response = { answer: 'Acknowledge then rename, flush the temporary file. $R_1', citations: [] } as unknown as AgentConversationResponse;
        const measurement = measureAnswerQuality(entry, response);
        expect(measurement.orderedStepsSatisfied).toBe(false);
        expect(measurement.balancedMath).toBe(false);
    });
});

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
    test.each([
        'The archive does not provide a measured melting point for the sample.',
        'The notes contain no measurements of the sample temperature.',
        'The requested measurement has not been recorded in the available sources.',
        'I cannot give a grounded answer from these notes.',
        '星云合金记录 存档没有提供星云合金熔点的测量数据。',
        '现有资料未记录这个样品的测量值。',
        '笔记中没有该参数的测量结果。',
        '当前资料不足以确定这个参数的数值。',
    ])('recognizes an evidence-based unknown answer independently of its release label: %s', answer => {
        const entry = parseAnswerQualityCorpus(raw).cases.find(item => item.id === 'eval-missing-en')!;
        const measurement = measureAnswerQuality(entry, { answer, citations: [], answerReleaseReview: { decision: 'release' } } as unknown as AgentConversationResponse);
        expect(measurement.abstentionSignalled).toBe(true);
    });
    test.each([
        'The journal ensures there is no data loss after acknowledgement.',
        'The source does not report data loss during the experiment.',
        'The database does not provide serializable isolation.',
        'The measured signal is not 12 Hz; it is 18 Hz.',
        'The archive reports no conflict between these measurements.',
        '日志确保确认后没有数据丢失。',
        '资料没有记录任何数据丢失。',
        '定标频率不是12赫兹，而是18赫兹。',
        '实验报告中没有数据泄漏。',
    ])('does not label a factual negation as an unknown answer: %s', answer => {
        const entry = parseAnswerQualityCorpus(raw).cases.find(item => item.id === 'eval-missing-en')!;
        const measurement = measureAnswerQuality(entry, { answer, citations: [] } as unknown as AgentConversationResponse);
        expect(measurement.abstentionSignalled).toBe(false);
    });
    test('does not use an internal abstain label to claim that the public answer discloses uncertainty', () => {
        const entry = parseAnswerQualityCorpus(raw).cases.find(item => item.id === 'eval-missing-en')!;
        const measurement = measureAnswerQuality(entry, { answer: 'The melting point is 900 K.', citations: [], answerReleaseReview: { decision: 'abstain' } } as unknown as AgentConversationResponse);
        expect(measurement.abstentionSignalled).toBe(false);
    });
    test('catches reversed procedural steps and unbalanced math', () => {
        const entry = parseAnswerQualityCorpus(raw).cases.find(item => item.id === 'eval-replacement-en')!;
        const response = { answer: 'Acknowledge then rename, flush the temporary file. $R_1', citations: [] } as unknown as AgentConversationResponse;
        const measurement = measureAnswerQuality(entry, response);
        expect(measurement.orderedStepsSatisfied).toBe(false);
        expect(measurement.balancedMath).toBe(false);
    });
});

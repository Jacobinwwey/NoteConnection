import {
    DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS,
    GRAPH_ANSWER_QUALITY_POLICY_VERSION,
    evaluateGraphAnswerQualityCalibration,
} from './graphAnswerQualityCalibration';
import {
    isPolaritySafeSemanticDuplicate,
    MINIMUM_READABILITY_SCORE,
    SUPPLEMENTAL_DEDUP_SIMILARITY_THRESHOLD,
} from './graphAnswerQualityPolicy';

describe('graph answer quality calibration', () => {
    test('uses an explicit versioned policy and preserves contradictory claims', () => {
        expect(GRAPH_ANSWER_QUALITY_POLICY_VERSION).toBe('2026-07-23.v2');
        expect(SUPPLEMENTAL_DEDUP_SIMILARITY_THRESHOLD).toBe(0.86);
        expect(isPolaritySafeSemanticDuplicate(
            'Glass is transparent and conducts heat.',
            'The glass is transparent and conducts heat.'
        )).toBe(true);
        expect(isPolaritySafeSemanticDuplicate(
            'Glass is transparent and conducts heat.',
            'Glass is not transparent and does not conduct heat.'
        )).toBe(false);
    });

    test('keeps signed and unit-qualified numeric facts distinct', () => {
        expect(isPolaritySafeSemanticDuplicate(
            'The temperature is -5 C.',
            'The temperature is 5 C.'
        )).toBe(false);
        expect(isPolaritySafeSemanticDuplicate(
            'The wall is 5 cm thick.',
            'The wall is 5 mm thick.'
        )).toBe(false);
        expect(isPolaritySafeSemanticDuplicate(
            'The wall is 5 cm thick.',
            'The wall is 5 cm thick.'
        )).toBe(true);
        expect(isPolaritySafeSemanticDuplicate(
            '玻璃壁厚为5厘米。',
            '玻璃壁厚为5毫米。'
        )).toBe(false);
    });

    test('reports all quality dimensions and exact failures for the default corpus', () => {
        const report = evaluateGraphAnswerQualityCalibration(DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS);

        expect(report.version).toBe(GRAPH_ANSWER_QUALITY_POLICY_VERSION);
        expect(report.coverage.sampleCount).toBeGreaterThanOrEqual(24);
        expect(report.sourceQuality.sampleCount).toBeGreaterThanOrEqual(4);
        expect(report.deduplication.sampleCount).toBeGreaterThanOrEqual(4);
        expect(report.branchCoverage.sampleCount).toBeGreaterThanOrEqual(4);
        expect(report.languageConsistency.sampleCount).toBeGreaterThanOrEqual(7);
        expect(report.readability.sampleCount).toBeGreaterThanOrEqual(8);
        expect(report.failedCaseIds).toEqual([]);
        expect(report.jointPass).toBe(true);
        expect(report.sourceQuality.pairwiseAccuracy).toBeGreaterThanOrEqual(0.95);
        expect(report.sourceQuality.minimumObservedMargin).toBeGreaterThan(0);
        expect(report.deduplication.accuracy).toBeGreaterThanOrEqual(0.95);
        expect(report.deduplication.similarityThreshold).toBe(SUPPLEMENTAL_DEDUP_SIMILARITY_THRESHOLD);
        expect(report.branchCoverage.recall).toBeGreaterThanOrEqual(0.95);
        expect(report.languageConsistency.accuracy).toBeGreaterThanOrEqual(0.95);
        expect(report.readability.accuracy).toBeGreaterThanOrEqual(0.95);
        expect(report.readability.minimumAcceptedScore).toBe(MINIMUM_READABILITY_SCORE);
        expect(report.readability.minimumObservedScore).toBeGreaterThanOrEqual(MINIMUM_READABILITY_SCORE);
    });

    test('does not hide dimension-specific failures behind a single aggregate score', () => {
        const report = evaluateGraphAnswerQualityCalibration({
            ...DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS,
            sourceQualityCases: [
                {
                    caseId: 'source_quality_failure',
                    preferredClause: 'This document contains a table.',
                    rejectedClause: 'Glass conducts heat through the wall.',
                },
            ],
        });

        expect(report.jointPass).toBe(false);
        expect(report.sourceQuality.failedCaseIds).toEqual(['source_quality_failure']);
        expect(report.failedCaseIds).toContain('source_quality_failure');
    });

    test('fails closed when the corpus version drifts from the production policy', () => {
        const report = evaluateGraphAnswerQualityCalibration({
            ...DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS,
            version: '2026-07-23.stale',
        });

        expect(report.versionCompatible).toBe(false);
        expect(report.jointPass).toBe(false);
        expect(report.failedCaseIds).toContain('corpus_policy_version_mismatch');
    });

    test('fails closed when a calibration dimension has no cases', () => {
        const report = evaluateGraphAnswerQualityCalibration({
            ...DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS,
            readabilityCases: [],
        });

        expect(report.readability.accuracy).toBe(0);
        expect(report.failedCaseIds).toContain('corpus_empty:readability');
        expect(report.jointPass).toBe(false);
    });
});

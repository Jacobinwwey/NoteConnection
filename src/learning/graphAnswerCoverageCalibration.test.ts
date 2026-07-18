import {
    DEFAULT_GRAPH_ANSWER_COVERAGE_CALIBRATION_CASES,
    evaluateGraphAnswerCoverageCalibration,
} from './graphAnswerCoverageCalibration';

describe('evaluateGraphAnswerCoverageCalibration', () => {
    test('reports false positives and false negatives separately', () => {
        const report = evaluateGraphAnswerCoverageCalibration([
            {
                caseId: 'positive_en',
                statement: 'Heat moves through the glass wall.',
                answer: 'Thermal energy passes through the glass wall.',
                expectedCovered: true,
            },
            {
                caseId: 'negative_en',
                statement: 'Heat moves through the glass wall.',
                answer: 'Heat does not move through the glass wall.',
                expectedCovered: false,
            },
            {
                caseId: 'positive_zh',
                statement: '杯壁把液体与环境隔开。',
                answer: '实体杯壁将杯中液体和外部环境分隔开。',
                expectedCovered: true,
            },
            {
                caseId: 'negative_zh',
                statement: '杯壁把液体与环境隔开。',
                answer: '杯壁并不能把液体与外部环境隔开。',
                expectedCovered: false,
            },
        ]);

        expect(report.sampleCount).toBe(4);
        expect(report.falsePositiveCaseIds).toEqual([]);
        expect(report.falseNegativeCaseIds).toEqual([]);
        expect(report.precision).toBe(1);
        expect(report.recall).toBe(1);
    });

    test('meets the release floor across the versioned multilingual intent corpus', () => {
        const report = evaluateGraphAnswerCoverageCalibration(DEFAULT_GRAPH_ANSWER_COVERAGE_CALIBRATION_CASES);

        expect(report.sampleCount).toBeGreaterThanOrEqual(24);
        expect(report.falsePositiveCaseIds).toEqual([]);
        expect(report.falseNegativeCaseIds).toEqual([]);
        expect(report.precision).toBeGreaterThanOrEqual(0.95);
        expect(report.recall).toBeGreaterThanOrEqual(0.95);
    });
});

import { matchGraphAnswerClaim } from './graphClaimMatcher';

export interface GraphAnswerCoverageCalibrationCase {
    caseId: string;
    statement: string;
    answer: string;
    expectedCovered: boolean;
}

export interface GraphAnswerCoverageCalibrationReport {
    sampleCount: number;
    truePositiveCount: number;
    trueNegativeCount: number;
    falsePositiveCaseIds: string[];
    falseNegativeCaseIds: string[];
    precision: number;
    recall: number;
}

export const DEFAULT_GRAPH_ANSWER_COVERAGE_CALIBRATION_CASES: GraphAnswerCoverageCalibrationCase[] = [
    { caseId: 'definition_en_positive', statement: 'A water glass is a transparent container for water.', answer: 'A water glass is a transparent vessel used to hold water.', expectedCovered: true },
    { caseId: 'definition_en_negative', statement: 'A water glass is a transparent container for water.', answer: 'A water glass is not a transparent container for water.', expectedCovered: false },
    { caseId: 'definition_zh_positive', statement: '水杯是用于盛水的透明容器。', answer: '水杯是一种透明的盛水器皿。', expectedCovered: true },
    { caseId: 'definition_zh_negative', statement: '水杯是用于盛水的透明容器。', answer: '水杯并不是用于盛水的透明容器。', expectedCovered: false },
    { caseId: 'causal_en_positive', statement: 'Heating the sealed glass causes pressure to rise.', answer: 'Pressure rises because heat enters the sealed glass.', expectedCovered: true },
    { caseId: 'causal_en_negative', statement: 'Heating the sealed glass causes pressure to rise.', answer: 'Heating the sealed glass does not cause pressure to rise.', expectedCovered: false },
    { caseId: 'causal_zh_positive', statement: '加热密闭玻璃容器会导致压力上升。', answer: '密闭玻璃容器受热后会造成压力升高。', expectedCovered: true },
    { caseId: 'causal_zh_negative', statement: '加热密闭玻璃容器会导致压力上升。', answer: '加热密闭玻璃容器不会导致压力上升。', expectedCovered: false },
    { caseId: 'compare_en_positive', statement: 'Glass conducts heat better than plastic.', answer: 'Compared with plastic, glass conducts heat better.', expectedCovered: true },
    { caseId: 'compare_en_negative', statement: 'Glass conducts heat better than plastic.', answer: 'Glass does not conduct heat better than plastic.', expectedCovered: false },
    { caseId: 'compare_zh_positive', statement: '玻璃比塑料导热更快。', answer: '与塑料相比，玻璃导热更快。', expectedCovered: true },
    { caseId: 'compare_zh_negative', statement: '玻璃比塑料导热更快。', answer: '玻璃并不比塑料导热更快。', expectedCovered: false },
    { caseId: 'procedure_en_positive', statement: 'Rinse the glass before drying it.', answer: 'Before drying the glass, rinse it thoroughly.', expectedCovered: true },
    { caseId: 'procedure_en_negative', statement: 'Rinse the glass before drying it.', answer: 'Do not rinse the glass before drying it.', expectedCovered: false },
    { caseId: 'procedure_zh_positive', statement: '先冲洗杯子，再将它晾干。', answer: '杯子需要先冲洗，之后再晾干。', expectedCovered: true },
    { caseId: 'procedure_zh_negative', statement: '先冲洗杯子，再将它晾干。', answer: '不要先冲洗杯子再晾干。', expectedCovered: false },
    { caseId: 'temporal_en_positive', statement: 'This guidance applies after 2025.', answer: 'After 2025, this guidance applies.', expectedCovered: true },
    { caseId: 'temporal_en_negative', statement: 'This guidance applies after 2025.', answer: 'This guidance does not apply after 2025.', expectedCovered: false },
    { caseId: 'temporal_zh_positive', statement: '该规则在2025年之后生效。', answer: '2025年以后，该规则开始生效。', expectedCovered: true },
    { caseId: 'temporal_zh_negative', statement: '该规则在2025年之后生效。', answer: '该规则在2025年之后不会生效。', expectedCovered: false },
    { caseId: 'weak_evidence_en_positive', statement: 'Heat passing through the wall raises the liquid temperature.', answer: 'The liquid temperature rises as heat passes through the wall.', expectedCovered: true },
    { caseId: 'weak_evidence_en_negative', statement: 'Heat passing through the wall raises the liquid temperature.', answer: 'The graph contains a node titled Liquid Temperature.', expectedCovered: false },
    { caseId: 'weak_evidence_zh_positive', statement: '热量穿过杯壁会使液体温度上升。', answer: '液体温度会随着热量经杯壁传递而升高。', expectedCovered: true },
    { caseId: 'weak_evidence_zh_negative', statement: '热量穿过杯壁会使液体温度上升。', answer: '图中存在一个名为“液体温度”的节点。', expectedCovered: false },
];

export function evaluateGraphAnswerCoverageCalibration(
    cases: GraphAnswerCoverageCalibrationCase[]
): GraphAnswerCoverageCalibrationReport {
    const falsePositiveCaseIds: string[] = [];
    const falseNegativeCaseIds: string[] = [];
    let truePositiveCount = 0;
    let trueNegativeCount = 0;
    cases.forEach((item) => {
        const covered = matchGraphAnswerClaim(item.answer, item.statement).covered;
        if (covered && item.expectedCovered) truePositiveCount += 1;
        else if (!covered && !item.expectedCovered) trueNegativeCount += 1;
        else if (covered) falsePositiveCaseIds.push(item.caseId);
        else falseNegativeCaseIds.push(item.caseId);
    });
    const precisionDenominator = truePositiveCount + falsePositiveCaseIds.length;
    const recallDenominator = truePositiveCount + falseNegativeCaseIds.length;
    return {
        sampleCount: cases.length,
        truePositiveCount,
        trueNegativeCount,
        falsePositiveCaseIds,
        falseNegativeCaseIds,
        precision: precisionDenominator > 0 ? Number((truePositiveCount / precisionDenominator).toFixed(4)) : 1,
        recall: recallDenominator > 0 ? Number((truePositiveCount / recallDenominator).toFixed(4)) : 1,
    };
}

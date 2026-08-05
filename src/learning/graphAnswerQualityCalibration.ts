import {
    DEFAULT_GRAPH_ANSWER_COVERAGE_CALIBRATION_CASES,
    evaluateGraphAnswerCoverageCalibration,
    type GraphAnswerCoverageCalibrationCase,
    type GraphAnswerCoverageCalibrationReport,
} from './graphAnswerCoverageCalibration';
import { matchGraphAnswerClaim } from './graphClaimMatcher';
import {
    GRAPH_ANSWER_QUALITY_POLICY_VERSION,
    isPolaritySafeSemanticDuplicate,
    MINIMUM_READABILITY_SCORE,
    SUPPLEMENTAL_DEDUP_SIMILARITY_THRESHOLD,
} from './graphAnswerQualityPolicy';
import { scoreRagEvidenceClause, segmentRagEvidenceClauses } from './ragEvidenceQuality';
import { shouldRejectPublicEvidenceClause } from './ragPublicText';

export { GRAPH_ANSWER_QUALITY_POLICY_VERSION } from './graphAnswerQualityPolicy';

type CalibrationLanguage = 'en' | 'zh';

export interface SourceQualityCalibrationCase {
    caseId: string;
    preferredClause: string;
    rejectedClause: string;
}

export interface DeduplicationCalibrationCase {
    caseId: string;
    left: string;
    right: string;
    expectedDuplicate: boolean;
}

export interface BranchCoverageCalibrationCase {
    caseId: string;
    answer: string;
    requiredBranchStatements: string[];
}

export interface LanguageConsistencyCalibrationCase {
    caseId: string;
    query: string;
    answer: string;
    expectedConsistent: boolean;
}

export interface ReadabilityCalibrationCase {
    caseId: string;
    answer: string;
    expectedReadable: boolean;
}

export interface GraphAnswerQualityCalibrationCorpus {
    version: string;
    coverageCases: GraphAnswerCoverageCalibrationCase[];
    sourceQualityCases: SourceQualityCalibrationCase[];
    deduplicationCases: DeduplicationCalibrationCase[];
    branchCoverageCases: BranchCoverageCalibrationCase[];
    languageConsistencyCases: LanguageConsistencyCalibrationCase[];
    readabilityCases: ReadabilityCalibrationCase[];
}

export interface CalibrationAccuracyMetric {
    sampleCount: number;
    passedCount: number;
    failedCaseIds: string[];
    accuracy: number;
}

export interface BranchCoverageCalibrationMetric extends CalibrationAccuracyMetric {
    requiredBranchCount: number;
    coveredBranchCount: number;
    recall: number;
}

export interface GraphAnswerQualityCalibrationReport {
    version: string;
    versionCompatible: boolean;
    coverage: GraphAnswerCoverageCalibrationReport;
    sourceQuality: CalibrationAccuracyMetric & { pairwiseAccuracy: number; minimumObservedMargin: number };
    deduplication: CalibrationAccuracyMetric & { similarityThreshold: number };
    branchCoverage: BranchCoverageCalibrationMetric;
    languageConsistency: CalibrationAccuracyMetric;
    readability: CalibrationAccuracyMetric & { minimumAcceptedScore: number; minimumObservedScore: number };
    failedCaseIds: string[];
    jointPass: boolean;
}

export const DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS: GraphAnswerQualityCalibrationCorpus = {
    version: GRAPH_ANSWER_QUALITY_POLICY_VERSION,
    coverageCases: DEFAULT_GRAPH_ANSWER_COVERAGE_CALIBRATION_CASES,
    sourceQualityCases: [
        {
            caseId: 'source_quality_equation_over_documentary_en',
            preferredClause: 'The thermal flux is q = kA(T1 - T2) / L, so thickness changes the exchange rate.',
            rejectedClause: 'This document will explain the following table as requested.',
        },
        {
            caseId: 'source_quality_complete_fact_over_heading_en',
            preferredClause: 'Glass conducts heat through the wall before the liquid temperature changes.',
            rejectedClause: 'Thermal transfer:',
        },
        {
            caseId: 'source_quality_complete_fact_over_meta_zh',
            preferredClause: '热量穿过杯壁后，液体温度会上升。',
            rejectedClause: '本文档旨在说明以下表格。',
        },
        {
            caseId: 'source_quality_balanced_formula_over_fragment_en',
            preferredClause: 'The pressure is P = rho g h, and the wall stress remains below the material limit.',
            rejectedClause: 'The pressure is P = rho g h (',
        },
    ],
    deduplicationCases: [
        {
            caseId: 'dedup_paraphrase_en',
            left: 'A water glass is a transparent vessel used to hold water.',
            right: 'A water glass is a transparent container used to hold water.',
            expectedDuplicate: true,
        },
        {
            caseId: 'dedup_paraphrase_zh',
            left: '水杯是用于盛水的透明容器。',
            right: '水杯是一种透明的盛水器皿。',
            expectedDuplicate: true,
        },
        {
            caseId: 'dedup_conflicting_value_en',
            left: 'The release date is 2026-07-01.',
            right: 'The release date is 2026-08-15.',
            expectedDuplicate: false,
        },
        {
            caseId: 'dedup_polarity_conflict_en',
            left: 'Glass conducts heat through the wall.',
            right: 'Glass does not conduct heat through the wall.',
            expectedDuplicate: false,
        },
        {
            caseId: 'dedup_distinct_mechanisms_en',
            left: 'Heat passes through the wall by conduction.',
            right: 'The curved vessel changes the path of incoming light.',
            expectedDuplicate: false,
        },
        {
            caseId: 'dedup_same_fact_with_heading_en',
            left: 'The glass wall separates the liquid from the environment.',
            right: 'The glass wall separates liquid from the environment.',
            expectedDuplicate: true,
        },
    ],
    branchCoverageCases: [
        {
            caseId: 'branch_compare_glass_plastic_en',
            answer: 'Plastic is the comparison material, and compared with it, glass conducts heat better and remains more rigid.',
            requiredBranchStatements: ['Glass conducts heat better.', 'Plastic is the comparison material.'],
        },
        {
            caseId: 'branch_compare_glass_plastic_zh',
            answer: '与塑料相比，玻璃导热更快。',
            requiredBranchStatements: ['玻璃导热。', '塑料是比较对象。'],
        },
        {
            caseId: 'branch_compare_environment_versions_en',
            answer: 'Version 1 applies in staging, while version 2 applies in production.',
            requiredBranchStatements: ['Version 1 applies in staging.', 'Version 2 applies in production.'],
        },
        {
            caseId: 'branch_compare_material_boundary_zh',
            answer: '玻璃是透明非晶态固体，塑料杯则是聚合物容器。',
            requiredBranchStatements: ['玻璃是透明固体。', '塑料是聚合物容器。'],
        },
    ],
    languageConsistencyCases: [
        { caseId: 'language_en_definition', query: 'what is a water glass?', answer: 'A water glass is a transparent vessel for water.', expectedConsistent: true },
        { caseId: 'language_zh_definition', query: '什么是水杯？', answer: '水杯是用于盛水的透明容器。', expectedConsistent: true },
        { caseId: 'language_en_compare', query: 'compare glass and plastic', answer: 'Glass conducts heat better than plastic.', expectedConsistent: true },
        { caseId: 'language_zh_compare', query: '比较玻璃和塑料', answer: '与塑料相比，玻璃导热更快。', expectedConsistent: true },
        { caseId: 'language_en_math', query: 'what is the pressure?', answer: 'The pressure is P = rho g h.', expectedConsistent: true },
        { caseId: 'language_mismatch_en_query_zh_answer', query: 'what is a water glass?', answer: '水杯是用于盛水的透明容器。', expectedConsistent: false },
        { caseId: 'language_mismatch_zh_query_en_answer', query: '什么是水杯？', answer: 'A water glass is a transparent vessel for water.', expectedConsistent: false },
    ],
    readabilityCases: [
        { caseId: 'readability_complete_en', answer: 'A water glass is a transparent vessel used to hold water.', expectedReadable: true },
        { caseId: 'readability_complete_zh', answer: '水杯是用于盛水的透明容器。', expectedReadable: true },
        { caseId: 'readability_balanced_math_en', answer: 'The pressure is P = rho g h, so a taller water column increases the load.', expectedReadable: true },
        { caseId: 'readability_two_claims_en', answer: 'Glass conducts heat through the wall. The liquid temperature rises afterward.', expectedReadable: true },
        { caseId: 'readability_two_claims_zh', answer: '热量穿过杯壁后，液体温度会上升。玻璃壁仍然把液体与环境分隔开。', expectedReadable: true },
        { caseId: 'readability_reject_documentary_en', answer: 'This document will explain the following table as requested.', expectedReadable: false },
        { caseId: 'readability_reject_unbalanced_formula_en', answer: 'The pressure is P = rho g h (.', expectedReadable: false },
        { caseId: 'readability_reject_authoring_zh', answer: '本技术文档旨在说明下表。', expectedReadable: false },
        { caseId: 'readability_reject_dangling_heading_en', answer: 'Thermal transfer:', expectedReadable: false },
    ],
};

type CalibrationOutcome = {
    caseId: string;
    passed: boolean;
};

function metricFromOutcomes(outcomes: CalibrationOutcome[]): CalibrationAccuracyMetric {
    const passedCount = outcomes.filter((outcome) => outcome.passed).length;
    return {
        sampleCount: outcomes.length,
        passedCount,
        failedCaseIds: outcomes.filter((outcome) => !outcome.passed).map((outcome) => outcome.caseId),
        accuracy: outcomes.length > 0 ? Number((passedCount / outcomes.length).toFixed(4)) : 0,
    };
}

function detectLanguage(value: string): CalibrationLanguage {
    const cjkCount = (String(value || '').match(/[\u3400-\u9fff]/gu) || []).length;
    const latinCount = (String(value || '').match(/[A-Za-z]/gu) || []).length;
    return cjkCount > latinCount ? 'zh' : 'en';
}

function evaluateSourceQuality(
    cases: SourceQualityCalibrationCase[]
): CalibrationAccuracyMetric & { pairwiseAccuracy: number; minimumObservedMargin: number } {
    const margins: number[] = [];
    const outcomes = cases.map((item): CalibrationOutcome => {
        const margin = scoreRagEvidenceClause(item.preferredClause).score
            - scoreRagEvidenceClause(item.rejectedClause).score;
        margins.push(margin);
        return { caseId: item.caseId, passed: margin > 0 };
    });
    const metric = metricFromOutcomes(outcomes);
    return {
        ...metric,
        pairwiseAccuracy: metric.accuracy,
        minimumObservedMargin: margins.length > 0
            ? Number(Math.min(...margins).toFixed(4))
            : 0,
    };
}

function evaluateDeduplication(
    cases: DeduplicationCalibrationCase[]
): CalibrationAccuracyMetric & { similarityThreshold: number } {
    const outcomes = cases.map((item): CalibrationOutcome => {
        const observedDuplicate = isPolaritySafeSemanticDuplicate(item.left, item.right);
        return { caseId: item.caseId, passed: observedDuplicate === item.expectedDuplicate };
    });
    return {
        ...metricFromOutcomes(outcomes),
        similarityThreshold: SUPPLEMENTAL_DEDUP_SIMILARITY_THRESHOLD,
    };
}

function evaluateBranchCoverage(cases: BranchCoverageCalibrationCase[]): BranchCoverageCalibrationMetric {
    const outcomes: CalibrationOutcome[] = [];
    let requiredBranchCount = 0;
    let coveredBranchCount = 0;
    cases.forEach((item) => {
        const branchResults = item.requiredBranchStatements.map((statement) => matchGraphAnswerClaim(item.answer, statement).covered);
        const covered = branchResults.filter(Boolean).length;
        requiredBranchCount += branchResults.length;
        coveredBranchCount += covered;
        const passed = covered === branchResults.length;
        outcomes.push({ caseId: item.caseId, passed });
    });
    const metric = metricFromOutcomes(outcomes);
    return {
        ...metric,
        requiredBranchCount,
        coveredBranchCount,
        recall: requiredBranchCount > 0 ? Number((coveredBranchCount / requiredBranchCount).toFixed(4)) : 0,
    };
}

function evaluateLanguageConsistency(cases: LanguageConsistencyCalibrationCase[]): CalibrationAccuracyMetric {
    const outcomes = cases.map((item): CalibrationOutcome => {
        const observedConsistent = detectLanguage(item.answer) === detectLanguage(item.query);
        return { caseId: item.caseId, passed: observedConsistent === item.expectedConsistent };
    });
    return metricFromOutcomes(outcomes);
}

function evaluateReadability(
    cases: ReadabilityCalibrationCase[]
): CalibrationAccuracyMetric & { minimumAcceptedScore: number; minimumObservedScore: number } {
    const minimumAcceptedScore = MINIMUM_READABILITY_SCORE;
    const observedScores: number[] = [];
    const outcomes = cases.map((item): CalibrationOutcome => {
        const clauses = segmentRagEvidenceClauses(item.answer);
        const qualities = clauses.map((clause) => ({
            clause,
            quality: scoreRagEvidenceClause(clause),
        }));
        if (item.expectedReadable) {
            qualities.forEach(({ quality }) => observedScores.push(quality.score));
        }
        const observedReadable = qualities.length > 0 && qualities.every(({ clause, quality }) => {
            return quality.score >= minimumAcceptedScore
                && quality.hasBalancedDelimiters
                && !shouldRejectPublicEvidenceClause(clause)
                && !/[：:]$/u.test(clause);
        });
        return { caseId: item.caseId, passed: observedReadable === item.expectedReadable };
    });
    return {
        ...metricFromOutcomes(outcomes),
        minimumAcceptedScore,
        minimumObservedScore: observedScores.length > 0
            ? Number(Math.min(...observedScores).toFixed(4))
            : 0,
    };
}

export function evaluateGraphAnswerQualityCalibration(
    corpus: GraphAnswerQualityCalibrationCorpus = DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS
): GraphAnswerQualityCalibrationReport {
    const coverage = evaluateGraphAnswerCoverageCalibration(corpus.coverageCases);
    const sourceQuality = evaluateSourceQuality(corpus.sourceQualityCases);
    const deduplication = evaluateDeduplication(corpus.deduplicationCases);
    const branchCoverage = evaluateBranchCoverage(corpus.branchCoverageCases);
    const languageConsistency = evaluateLanguageConsistency(corpus.languageConsistencyCases);
    const readability = evaluateReadability(corpus.readabilityCases);
    const versionCompatible = corpus.version === GRAPH_ANSWER_QUALITY_POLICY_VERSION;
    const emptyCalibrationDimensions = [
        ['coverage', corpus.coverageCases],
        ['source_quality', corpus.sourceQualityCases],
        ['deduplication', corpus.deduplicationCases],
        ['branch_coverage', corpus.branchCoverageCases],
        ['language_consistency', corpus.languageConsistencyCases],
        ['readability', corpus.readabilityCases],
    ]
        .filter(([, cases]) => cases.length === 0)
        .map(([dimension]) => `corpus_empty:${dimension}`);
    const failedCaseIds = Array.from(new Set([
        ...(versionCompatible ? [] : ['corpus_policy_version_mismatch']),
        ...emptyCalibrationDimensions,
        ...coverage.falsePositiveCaseIds,
        ...coverage.falseNegativeCaseIds,
        ...sourceQuality.failedCaseIds,
        ...deduplication.failedCaseIds,
        ...branchCoverage.failedCaseIds,
        ...languageConsistency.failedCaseIds,
        ...readability.failedCaseIds,
    ]));
    return {
        version: corpus.version,
        versionCompatible,
        coverage,
        sourceQuality,
        deduplication,
        branchCoverage,
        languageConsistency,
        readability,
        failedCaseIds,
        jointPass: versionCompatible && emptyCalibrationDimensions.length === 0 && failedCaseIds.length === 0,
    };
}

export type WasmParityBenchmarkMetric = 'graphMetrics' | 'layoutEngine';

export interface WasmParityMetricGuardConfig {
    maxCandidateToBaselineP95Ratio?: number | null;
    maxCandidateP95Ms?: number | null;
    maxCandidateToBaselineP99Ratio?: number | null;
    maxCandidateP99Ms?: number | null;
}

export interface WasmParityMetricGuardInput {
    metric: WasmParityBenchmarkMetric;
    baselineP95Ms: number;
    candidateP95Ms: number;
    baselineP99Ms?: number;
    candidateP99Ms?: number;
    config: WasmParityMetricGuardConfig;
}

export interface WasmParityMetricGuardResult {
    metric: WasmParityBenchmarkMetric;
    applied: boolean;
    pass: boolean;
    baselineP95Ms: number;
    candidateP95Ms: number;
    candidateToBaselineP95Ratio: number | null;
    baselineP99Ms: number;
    candidateP99Ms: number;
    candidateToBaselineP99Ratio: number | null;
    failures: string[];
}

export interface WasmParityPerformanceGuardsInput {
    graphMetrics: WasmParityMetricGuardInput;
    layoutEngine: WasmParityMetricGuardInput;
}

export interface WasmParityPerformanceGuardsResult {
    applied: boolean;
    pass: boolean;
    metrics: WasmParityMetricGuardResult[];
}

function toFiniteNonNegative(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        return 0;
    }
    return value;
}

function hasConfigThreshold(config: WasmParityMetricGuardConfig): boolean {
    return (
        (typeof config.maxCandidateToBaselineP95Ratio === 'number' && Number.isFinite(config.maxCandidateToBaselineP95Ratio)) ||
        (typeof config.maxCandidateP95Ms === 'number' && Number.isFinite(config.maxCandidateP95Ms)) ||
        (typeof config.maxCandidateToBaselineP99Ratio === 'number' && Number.isFinite(config.maxCandidateToBaselineP99Ratio)) ||
        (typeof config.maxCandidateP99Ms === 'number' && Number.isFinite(config.maxCandidateP99Ms))
    );
}

export function evaluateWasmParityMetricGuard(input: WasmParityMetricGuardInput): WasmParityMetricGuardResult {
    const baselineP95Ms = toFiniteNonNegative(input.baselineP95Ms);
    const candidateP95Ms = toFiniteNonNegative(input.candidateP95Ms);
    const baselineP99Ms = toFiniteNonNegative(
        typeof input.baselineP99Ms === 'number' ? input.baselineP99Ms : baselineP95Ms
    );
    const candidateP99Ms = toFiniteNonNegative(
        typeof input.candidateP99Ms === 'number' ? input.candidateP99Ms : candidateP95Ms
    );
    const applied = hasConfigThreshold(input.config);
    const failures: string[] = [];
    let ratioP95: number | null = null;
    let ratioP99: number | null = null;

    const maxP95Ratio = input.config.maxCandidateToBaselineP95Ratio;
    const maxCandidateP95Ms = input.config.maxCandidateP95Ms;
    const maxP99Ratio = input.config.maxCandidateToBaselineP99Ratio;
    const maxCandidateP99Ms = input.config.maxCandidateP99Ms;

    if (typeof maxP95Ratio === 'number' && Number.isFinite(maxP95Ratio)) {
        if (baselineP95Ms <= 0) {
            failures.push('baseline-p95-unavailable-for-ratio');
        } else {
            ratioP95 = candidateP95Ms / baselineP95Ms;
            if (ratioP95 > maxP95Ratio) {
                failures.push('candidate-to-baseline-p95-ratio-exceeded');
            }
        }
    }

    if (typeof maxP99Ratio === 'number' && Number.isFinite(maxP99Ratio)) {
        if (baselineP99Ms <= 0) {
            failures.push('baseline-p99-unavailable-for-ratio');
        } else {
            ratioP99 = candidateP99Ms / baselineP99Ms;
            if (ratioP99 > maxP99Ratio) {
                failures.push('candidate-to-baseline-p99-ratio-exceeded');
            }
        }
    }

    if (typeof maxCandidateP95Ms === 'number' && Number.isFinite(maxCandidateP95Ms)) {
        if (candidateP95Ms > maxCandidateP95Ms) {
            failures.push('candidate-p95-exceeded-absolute-threshold');
        }
    }

    if (typeof maxCandidateP99Ms === 'number' && Number.isFinite(maxCandidateP99Ms)) {
        if (candidateP99Ms > maxCandidateP99Ms) {
            failures.push('candidate-p99-exceeded-absolute-threshold');
        }
    }

    return {
        metric: input.metric,
        applied,
        pass: failures.length === 0,
        baselineP95Ms,
        candidateP95Ms,
        candidateToBaselineP95Ratio: ratioP95,
        baselineP99Ms,
        candidateP99Ms,
        candidateToBaselineP99Ratio: ratioP99,
        failures
    };
}

export function evaluateWasmParityPerformanceGuards(
    input: WasmParityPerformanceGuardsInput
): WasmParityPerformanceGuardsResult {
    const metrics = [
        evaluateWasmParityMetricGuard(input.graphMetrics),
        evaluateWasmParityMetricGuard(input.layoutEngine)
    ];
    const applied = metrics.some((metric) => metric.applied);
    const pass = metrics.every((metric) => metric.pass);
    return {
        applied,
        pass,
        metrics
    };
}

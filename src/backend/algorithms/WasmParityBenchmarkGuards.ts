export type WasmParityBenchmarkMetric = 'graphMetrics' | 'layoutEngine';

export interface WasmParityMetricGuardConfig {
    maxCandidateToBaselineP95Ratio: number | null;
    maxCandidateP95Ms: number | null;
}

export interface WasmParityMetricGuardInput {
    metric: WasmParityBenchmarkMetric;
    baselineP95Ms: number;
    candidateP95Ms: number;
    config: WasmParityMetricGuardConfig;
}

export interface WasmParityMetricGuardResult {
    metric: WasmParityBenchmarkMetric;
    applied: boolean;
    pass: boolean;
    baselineP95Ms: number;
    candidateP95Ms: number;
    candidateToBaselineP95Ratio: number | null;
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
        (typeof config.maxCandidateP95Ms === 'number' && Number.isFinite(config.maxCandidateP95Ms))
    );
}

export function evaluateWasmParityMetricGuard(input: WasmParityMetricGuardInput): WasmParityMetricGuardResult {
    const baselineP95Ms = toFiniteNonNegative(input.baselineP95Ms);
    const candidateP95Ms = toFiniteNonNegative(input.candidateP95Ms);
    const applied = hasConfigThreshold(input.config);
    const failures: string[] = [];
    let ratio: number | null = null;

    const maxRatio = input.config.maxCandidateToBaselineP95Ratio;
    const maxCandidateP95Ms = input.config.maxCandidateP95Ms;

    if (typeof maxRatio === 'number' && Number.isFinite(maxRatio)) {
        if (baselineP95Ms <= 0) {
            failures.push('baseline-p95-unavailable-for-ratio');
        } else {
            ratio = candidateP95Ms / baselineP95Ms;
            if (ratio > maxRatio) {
                failures.push('candidate-to-baseline-p95-ratio-exceeded');
            }
        }
    }

    if (typeof maxCandidateP95Ms === 'number' && Number.isFinite(maxCandidateP95Ms)) {
        if (candidateP95Ms > maxCandidateP95Ms) {
            failures.push('candidate-p95-exceeded-absolute-threshold');
        }
    }

    return {
        metric: input.metric,
        applied,
        pass: failures.length === 0,
        baselineP95Ms,
        candidateP95Ms,
        candidateToBaselineP95Ratio: ratio,
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

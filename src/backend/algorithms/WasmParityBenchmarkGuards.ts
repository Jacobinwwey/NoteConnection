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

export interface WasmParityHistoricalMetricGuardInput {
    metric: WasmParityBenchmarkMetric;
    candidateP95Ms: number;
    candidateP99Ms?: number;
    historyBaselineP95SamplesMs: number[];
    historyBaselineP99SamplesMs?: number[];
    config: WasmParityMetricGuardConfig;
}

export interface WasmParityHistoricalMetricGuardResult extends WasmParityMetricGuardResult {
    historySampleCount: number;
    historyBaselineSource: 'none' | 'median';
}

export interface WasmParityHistoricalPerformanceGuardsInput {
    graphMetrics: WasmParityHistoricalMetricGuardInput;
    layoutEngine: WasmParityHistoricalMetricGuardInput;
    minimumHistorySamples?: number;
}

export interface WasmParityHistoricalPerformanceGuardsResult {
    applied: boolean;
    pass: boolean;
    minimumHistorySamples: number;
    metrics: WasmParityHistoricalMetricGuardResult[];
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

function toFinitePositiveSamples(values: number[]): number[] {
    if (!Array.isArray(values)) {
        return [];
    }
    return values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((left, right) => left - right);
}

function toMedian(values: number[]): number | null {
    if (!Array.isArray(values) || values.length === 0) {
        return null;
    }
    const middle = Math.floor(values.length / 2);
    if (values.length % 2 === 0) {
        return (values[middle - 1] + values[middle]) / 2;
    }
    return values[middle];
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

export function evaluateWasmParityHistoricalMetricGuard(
    input: WasmParityHistoricalMetricGuardInput,
    minimumHistorySamples = 1
): WasmParityHistoricalMetricGuardResult {
    const requiredSamples = Math.max(1, Math.floor(Number(minimumHistorySamples) || 1));
    const baselineP95Samples = toFinitePositiveSamples(input.historyBaselineP95SamplesMs);
    const rawBaselineP99Samples = Array.isArray(input.historyBaselineP99SamplesMs)
        ? input.historyBaselineP99SamplesMs
        : [];
    const baselineP99Samples = toFinitePositiveSamples(
        rawBaselineP99Samples.length > 0 ? rawBaselineP99Samples : input.historyBaselineP95SamplesMs
    );

    const baselineP95Ms = toMedian(baselineP95Samples);
    const baselineP99Ms = toMedian(baselineP99Samples);
    const historySampleCount = Math.min(baselineP95Samples.length, baselineP99Samples.length);
    const thresholdsApplied = hasConfigThreshold(input.config);

    if (thresholdsApplied && (historySampleCount < requiredSamples || baselineP95Ms === null || baselineP99Ms === null)) {
        return {
            metric: input.metric,
            applied: true,
            pass: false,
            baselineP95Ms: toFiniteNonNegative(baselineP95Ms === null ? 0 : baselineP95Ms),
            candidateP95Ms: toFiniteNonNegative(input.candidateP95Ms),
            candidateToBaselineP95Ratio: null,
            baselineP99Ms: toFiniteNonNegative(baselineP99Ms === null ? 0 : baselineP99Ms),
            candidateP99Ms: toFiniteNonNegative(
                typeof input.candidateP99Ms === 'number' ? input.candidateP99Ms : input.candidateP95Ms
            ),
            candidateToBaselineP99Ratio: null,
            failures: [
                historySampleCount < requiredSamples
                    ? 'history-baseline-insufficient-samples'
                    : 'history-baseline-unavailable'
            ],
            historySampleCount,
            historyBaselineSource: 'none'
        };
    }

    const evaluated = evaluateWasmParityMetricGuard({
        metric: input.metric,
        baselineP95Ms: baselineP95Ms === null ? 0 : baselineP95Ms,
        candidateP95Ms: input.candidateP95Ms,
        baselineP99Ms: baselineP99Ms === null ? undefined : baselineP99Ms,
        candidateP99Ms: input.candidateP99Ms,
        config: input.config
    });

    return {
        ...evaluated,
        historySampleCount,
        historyBaselineSource: (baselineP95Ms === null || baselineP99Ms === null) ? 'none' : 'median'
    };
}

export function evaluateWasmParityHistoricalPerformanceGuards(
    input: WasmParityHistoricalPerformanceGuardsInput
): WasmParityHistoricalPerformanceGuardsResult {
    const minimumHistorySamples = Math.max(1, Math.floor(Number(input.minimumHistorySamples) || 1));
    const metrics = [
        evaluateWasmParityHistoricalMetricGuard(input.graphMetrics, minimumHistorySamples),
        evaluateWasmParityHistoricalMetricGuard(input.layoutEngine, minimumHistorySamples)
    ];
    const applied = metrics.some((metric) => metric.applied);
    const pass = metrics.every((metric) => metric.pass);
    return {
        applied,
        pass,
        minimumHistorySamples,
        metrics
    };
}

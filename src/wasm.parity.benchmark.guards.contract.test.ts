import {
    evaluateWasmParityHistoricalPerformanceGuards,
    evaluateWasmParityMetricGuard,
    evaluateWasmParityPerformanceGuards
} from './backend/algorithms/WasmParityBenchmarkGuards';

describe('wasm parity benchmark guard contract', () => {
    test('passes when no threshold is configured', () => {
        const result = evaluateWasmParityMetricGuard({
            metric: 'graphMetrics',
            baselineP95Ms: 100,
            candidateP95Ms: 90,
            baselineP99Ms: 120,
            candidateP99Ms: 115,
            config: {
                maxCandidateToBaselineP95Ratio: null,
                maxCandidateP95Ms: null,
                maxCandidateToBaselineP99Ratio: null,
                maxCandidateP99Ms: null
            }
        });

        expect(result.applied).toBe(false);
        expect(result.pass).toBe(true);
        expect(result.failures).toEqual([]);
        expect(result.candidateToBaselineP95Ratio).toBeNull();
        expect(result.candidateToBaselineP99Ratio).toBeNull();
    });

    test('fails when candidate-to-baseline ratio exceeds threshold', () => {
        const result = evaluateWasmParityMetricGuard({
            metric: 'graphMetrics',
            baselineP95Ms: 100,
            candidateP95Ms: 130,
            baselineP99Ms: 150,
            candidateP99Ms: 160,
            config: {
                maxCandidateToBaselineP95Ratio: 1.0,
                maxCandidateP95Ms: null,
                maxCandidateToBaselineP99Ratio: null,
                maxCandidateP99Ms: null
            }
        });

        expect(result.applied).toBe(true);
        expect(result.pass).toBe(false);
        expect(result.candidateToBaselineP95Ratio).toBeCloseTo(1.3, 6);
        expect(result.failures).toContain('candidate-to-baseline-p95-ratio-exceeded');
    });

    test('fails when absolute candidate p95 threshold is exceeded', () => {
        const result = evaluateWasmParityMetricGuard({
            metric: 'layoutEngine',
            baselineP95Ms: 1000,
            candidateP95Ms: 240,
            baselineP99Ms: 1200,
            candidateP99Ms: 260,
            config: {
                maxCandidateToBaselineP95Ratio: null,
                maxCandidateP95Ms: 200,
                maxCandidateToBaselineP99Ratio: null,
                maxCandidateP99Ms: null
            }
        });

        expect(result.applied).toBe(true);
        expect(result.pass).toBe(false);
        expect(result.failures).toContain('candidate-p95-exceeded-absolute-threshold');
    });

    test('fails when candidate-to-baseline p99 ratio exceeds threshold', () => {
        const result = evaluateWasmParityMetricGuard({
            metric: 'graphMetrics',
            baselineP95Ms: 100,
            candidateP95Ms: 90,
            baselineP99Ms: 200,
            candidateP99Ms: 260,
            config: {
                maxCandidateToBaselineP95Ratio: null,
                maxCandidateP95Ms: null,
                maxCandidateToBaselineP99Ratio: 1.0,
                maxCandidateP99Ms: null
            }
        });

        expect(result.applied).toBe(true);
        expect(result.pass).toBe(false);
        expect(result.candidateToBaselineP99Ratio).toBeCloseTo(1.3, 6);
        expect(result.failures).toContain('candidate-to-baseline-p99-ratio-exceeded');
    });

    test('fails when absolute candidate p99 threshold is exceeded', () => {
        const result = evaluateWasmParityMetricGuard({
            metric: 'layoutEngine',
            baselineP95Ms: 180,
            candidateP95Ms: 170,
            baselineP99Ms: 260,
            candidateP99Ms: 310,
            config: {
                maxCandidateToBaselineP95Ratio: null,
                maxCandidateP95Ms: null,
                maxCandidateToBaselineP99Ratio: null,
                maxCandidateP99Ms: 300
            }
        });

        expect(result.applied).toBe(true);
        expect(result.pass).toBe(false);
        expect(result.failures).toContain('candidate-p99-exceeded-absolute-threshold');
    });

    test('aggregates multi-metric guard results', () => {
        const summary = evaluateWasmParityPerformanceGuards({
            graphMetrics: {
                metric: 'graphMetrics',
                baselineP95Ms: 500,
                candidateP95Ms: 150,
                baselineP99Ms: 700,
                candidateP99Ms: 200,
                config: {
                    maxCandidateToBaselineP95Ratio: 0.5,
                    maxCandidateP95Ms: null,
                    maxCandidateToBaselineP99Ratio: 0.5,
                    maxCandidateP99Ms: null
                }
            },
            layoutEngine: {
                metric: 'layoutEngine',
                baselineP95Ms: 500,
                candidateP95Ms: 500,
                baselineP99Ms: 600,
                candidateP99Ms: 620,
                config: {
                    maxCandidateToBaselineP95Ratio: 0.9,
                    maxCandidateP95Ms: null,
                    maxCandidateToBaselineP99Ratio: 0.9,
                    maxCandidateP99Ms: null
                }
            }
        });

        expect(summary.applied).toBe(true);
        expect(summary.pass).toBe(false);
        expect(summary.metrics).toHaveLength(2);
        expect(summary.metrics.some((metric) => metric.pass === false)).toBe(true);
    });

    test('historical guard passes without thresholds even when history samples are missing', () => {
        const result = evaluateWasmParityHistoricalPerformanceGuards({
            minimumHistorySamples: 3,
            graphMetrics: {
                metric: 'graphMetrics',
                candidateP95Ms: 120,
                candidateP99Ms: 140,
                historyBaselineP95SamplesMs: [],
                historyBaselineP99SamplesMs: [],
                config: {}
            },
            layoutEngine: {
                metric: 'layoutEngine',
                candidateP95Ms: 200,
                candidateP99Ms: 260,
                historyBaselineP95SamplesMs: [],
                historyBaselineP99SamplesMs: [],
                config: {}
            }
        });

        expect(result.applied).toBe(false);
        expect(result.pass).toBe(true);
        expect(result.metrics[0].historySampleCount).toBe(0);
        expect(result.metrics[0].historyBaselineSource).toBe('none');
    });

    test('historical guard fails when thresholds are configured but history baseline is insufficient', () => {
        const result = evaluateWasmParityHistoricalPerformanceGuards({
            minimumHistorySamples: 2,
            graphMetrics: {
                metric: 'graphMetrics',
                candidateP95Ms: 130,
                candidateP99Ms: 180,
                historyBaselineP95SamplesMs: [100],
                historyBaselineP99SamplesMs: [120],
                config: {
                    maxCandidateToBaselineP95Ratio: 1.2
                }
            },
            layoutEngine: {
                metric: 'layoutEngine',
                candidateP95Ms: 250,
                candidateP99Ms: 320,
                historyBaselineP95SamplesMs: [240, 245],
                historyBaselineP99SamplesMs: [300, 305],
                config: {}
            }
        });

        expect(result.applied).toBe(true);
        expect(result.pass).toBe(false);
        expect(result.metrics[0].failures).toContain('history-baseline-insufficient-samples');
    });

    test('historical guard uses median baseline and passes ratio checks', () => {
        const result = evaluateWasmParityHistoricalPerformanceGuards({
            minimumHistorySamples: 3,
            graphMetrics: {
                metric: 'graphMetrics',
                candidateP95Ms: 110,
                candidateP99Ms: 130,
                historyBaselineP95SamplesMs: [100, 120, 140, 160, Number.NaN],
                historyBaselineP99SamplesMs: [120, 140, 180, 220],
                config: {
                    maxCandidateToBaselineP95Ratio: 1.0,
                    maxCandidateToBaselineP99Ratio: 1.0
                }
            },
            layoutEngine: {
                metric: 'layoutEngine',
                candidateP95Ms: 220,
                candidateP99Ms: 260,
                historyBaselineP95SamplesMs: [240, 260, 280],
                historyBaselineP99SamplesMs: [280, 320, 360],
                config: {
                    maxCandidateToBaselineP95Ratio: 1.0,
                    maxCandidateToBaselineP99Ratio: 1.0
                }
            }
        });

        expect(result.pass).toBe(true);
        expect(result.metrics[0].historyBaselineSource).toBe('median');
        expect(result.metrics[0].candidateToBaselineP95Ratio).toBeCloseTo(110 / 130, 6);
        expect(result.metrics[0].candidateToBaselineP99Ratio).toBeCloseTo(130 / 160, 6);
    });

    test('historical guard fails when candidate regresses beyond history-based ratio threshold', () => {
        const result = evaluateWasmParityHistoricalPerformanceGuards({
            minimumHistorySamples: 2,
            graphMetrics: {
                metric: 'graphMetrics',
                candidateP95Ms: 180,
                candidateP99Ms: 220,
                historyBaselineP95SamplesMs: [120, 130, 140],
                historyBaselineP99SamplesMs: [150, 160, 170],
                config: {
                    maxCandidateToBaselineP95Ratio: 1.2,
                    maxCandidateToBaselineP99Ratio: 1.2
                }
            },
            layoutEngine: {
                metric: 'layoutEngine',
                candidateP95Ms: 240,
                candidateP99Ms: 300,
                historyBaselineP95SamplesMs: [230, 240, 250],
                historyBaselineP99SamplesMs: [290, 300, 310],
                config: {
                    maxCandidateToBaselineP95Ratio: 1.2,
                    maxCandidateToBaselineP99Ratio: 1.2
                }
            }
        });

        expect(result.pass).toBe(false);
        expect(result.metrics[0].failures).toContain('candidate-to-baseline-p95-ratio-exceeded');
        expect(result.metrics[0].failures).toContain('candidate-to-baseline-p99-ratio-exceeded');
    });
});

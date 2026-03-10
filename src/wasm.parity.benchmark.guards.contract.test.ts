import {
    evaluateWasmParityMetricGuard,
    evaluateWasmParityPerformanceGuards
} from './backend/algorithms/WasmParityBenchmarkGuards';

describe('wasm parity benchmark guard contract', () => {
    test('passes when no threshold is configured', () => {
        const result = evaluateWasmParityMetricGuard({
            metric: 'graphMetrics',
            baselineP95Ms: 100,
            candidateP95Ms: 90,
            config: {
                maxCandidateToBaselineP95Ratio: null,
                maxCandidateP95Ms: null
            }
        });

        expect(result.applied).toBe(false);
        expect(result.pass).toBe(true);
        expect(result.failures).toEqual([]);
        expect(result.candidateToBaselineP95Ratio).toBeNull();
    });

    test('fails when candidate-to-baseline ratio exceeds threshold', () => {
        const result = evaluateWasmParityMetricGuard({
            metric: 'graphMetrics',
            baselineP95Ms: 100,
            candidateP95Ms: 130,
            config: {
                maxCandidateToBaselineP95Ratio: 1.0,
                maxCandidateP95Ms: null
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
            config: {
                maxCandidateToBaselineP95Ratio: null,
                maxCandidateP95Ms: 200
            }
        });

        expect(result.applied).toBe(true);
        expect(result.pass).toBe(false);
        expect(result.failures).toContain('candidate-p95-exceeded-absolute-threshold');
    });

    test('aggregates multi-metric guard results', () => {
        const summary = evaluateWasmParityPerformanceGuards({
            graphMetrics: {
                metric: 'graphMetrics',
                baselineP95Ms: 500,
                candidateP95Ms: 150,
                config: {
                    maxCandidateToBaselineP95Ratio: 0.5,
                    maxCandidateP95Ms: null
                }
            },
            layoutEngine: {
                metric: 'layoutEngine',
                baselineP95Ms: 500,
                candidateP95Ms: 500,
                config: {
                    maxCandidateToBaselineP95Ratio: 0.9,
                    maxCandidateP95Ms: null
                }
            }
        });

        expect(summary.applied).toBe(true);
        expect(summary.pass).toBe(false);
        expect(summary.metrics).toHaveLength(2);
        expect(summary.metrics.some((metric) => metric.pass === false)).toBe(true);
    });
});

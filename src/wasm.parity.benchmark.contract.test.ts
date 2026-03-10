import {
    buildDeterministicBenchmarkGraph,
    summarizeBetweennessDifference,
    summarizeDurations
} from './backend/algorithms/WasmParityBenchmark';

describe('wasm parity benchmark utility contract', () => {
    test('summarizeDurations calculates percentile stats for finite non-negative values', () => {
        const summary = summarizeDurations([10, 20, 30, 40, 50]);
        expect(summary.count).toBe(5);
        expect(summary.minMs).toBe(10);
        expect(summary.p50Ms).toBe(30);
        expect(summary.p95Ms).toBeCloseTo(48, 6);
        expect(summary.p99Ms).toBeCloseTo(49.6, 6);
        expect(summary.maxMs).toBe(50);
        expect(summary.meanMs).toBe(30);
    });

    test('summarizeDurations ignores invalid samples and returns zero summary for empty input', () => {
        const summary = summarizeDurations([Number.NaN, -1, Number.POSITIVE_INFINITY]);
        expect(summary).toEqual({
            count: 0,
            minMs: 0,
            p50Ms: 0,
            p95Ms: 0,
            p99Ms: 0,
            maxMs: 0,
            meanMs: 0
        });
    });

    test('summarizeBetweennessDifference reports within tolerance when deltas are tiny', () => {
        const baseline = new Map<string, number>([
            ['A', 1],
            ['B', 2]
        ]);
        const candidate = new Map<string, number>([
            ['A', 1 + 1e-10],
            ['B', 2 - 1e-10]
        ]);

        const summary = summarizeBetweennessDifference(baseline, candidate, 1e-9);
        expect(summary.withinTolerance).toBe(true);
        expect(summary.missingInBaseline).toBe(0);
        expect(summary.missingInCandidate).toBe(0);
        expect(summary.mismatchedNodeCount).toBe(0);
    });

    test('summarizeBetweennessDifference reports missing nodes and mismatches', () => {
        const baseline = new Map<string, number>([
            ['A', 1],
            ['B', 3]
        ]);
        const candidate = new Map<string, number>([
            ['A', 1.5],
            ['C', 9]
        ]);

        const summary = summarizeBetweennessDifference(baseline, candidate, 1e-9);
        expect(summary.comparedNodes).toBe(3);
        expect(summary.missingInBaseline).toBe(1);
        expect(summary.missingInCandidate).toBe(1);
        expect(summary.mismatchedNodeCount).toBeGreaterThanOrEqual(2);
        expect(summary.withinTolerance).toBe(false);
    });

    test('buildDeterministicBenchmarkGraph builds stable node ids and valid edges', () => {
        const graph = buildDeterministicBenchmarkGraph({
            nodeCount: 24,
            branchStride: 4,
            jumpSpan: 5,
            meshStride: 7
        });

        const nodes = graph.getNodes();
        const edges = graph.getEdges();
        const nodeIds = new Set(nodes.map((node) => node.id));

        expect(nodes.length).toBe(24);
        expect(nodeIds.size).toBe(24);
        expect(edges.length).toBeGreaterThan(23);
        edges.forEach((edge) => {
            expect(nodeIds.has(edge.source)).toBe(true);
            expect(nodeIds.has(edge.target)).toBe(true);
        });
    });
});

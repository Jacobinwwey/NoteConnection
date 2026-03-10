import { Graph } from './core/Graph';
import { config } from './backend/config';
import { GraphMetrics } from './backend/GraphMetrics';
import { LayoutEngine } from './backend/algorithms/LayoutEngine';
import { WasmParityRuntime } from './backend/algorithms/WasmParityRuntime';
import * as WorkerRuntime from './backend/utils/WorkerRuntime';

function createNode(id: string) {
    return { id, label: id, inDegree: 0, outDegree: 0 };
}

describe('wasm parity output-equivalence orchestration contract', () => {
    const originalMemorySavingMode = config.memorySavingMode;
    const originalMaxWorkers = config.maxWorkers;
    const originalAsyncNodeThresholdEnv = process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD;
    const originalAsyncWorkloadRatioEnv = process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD;

    beforeEach(() => {
        GraphMetrics.__resetComputeDiagnosticsForTests();
        LayoutEngine.__resetComputeDiagnosticsForTests();
    });

    afterEach(() => {
        config.memorySavingMode = originalMemorySavingMode;
        config.maxWorkers = originalMaxWorkers;
        if (typeof originalAsyncNodeThresholdEnv === 'undefined') {
            delete process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD;
        } else {
            process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD = originalAsyncNodeThresholdEnv;
        }
        if (typeof originalAsyncWorkloadRatioEnv === 'undefined') {
            delete process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD;
        } else {
            process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD = originalAsyncWorkloadRatioEnv;
        }
        jest.restoreAllMocks();
    });

    test('GraphMetrics returns wasm-provided betweenness map equivalent to sequential baseline map', async () => {
        config.memorySavingMode = false;
        config.maxWorkers = 2;

        const graph = new Graph();
        for (let i = 0; i < 500; i++) {
            graph.addNode(createNode(`n${i}`));
        }
        for (let i = 0; i < 500; i++) {
            graph.addEdge(`n${i}`, `n${(i + 1) % 500}`);
            if (i % 5 === 0) {
                graph.addEdge(`n${i}`, `n${(i + 13) % 500}`);
            }
        }

        const baseline = GraphMetrics.calculateBetweenness(graph);
        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeBetweenness')
            .mockResolvedValue(baseline);

        const result = await GraphMetrics.calculateBetweennessAsync(graph);

        expect(wasmSpy).toHaveBeenCalledTimes(1);
        expect(result.size).toBe(baseline.size);
        baseline.forEach((expectedValue, id) => {
            expect(result.get(id)).toBe(expectedValue);
        });

        const diagnostics = GraphMetrics.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('wasm-adapter');
        expect(diagnostics.nodeCount).toBe(500);
        expect(diagnostics.edgeCount).toBe(graph.getEdges().length);
        expect(diagnostics.durationMs).toBeGreaterThanOrEqual(0);
        expect(diagnostics.reason).toBe('wasm-result-applied');
    });

    test('LayoutEngine applies wasm positions exactly for orchestrated graph layout path', async () => {
        const graph = new Graph();
        graph.addNode(createNode('A'));
        graph.addNode(createNode('B'));
        graph.addNode(createNode('C'));
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'C');

        const wasmPositions = new Map<string, { x: number; y: number }>([
            ['A', { x: 10, y: 20 }],
            ['B', { x: -8, y: 4 }],
            ['C', { x: 0.5, y: -3 }]
        ]);

        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeLayout')
            .mockResolvedValue(wasmPositions);

        await LayoutEngine.computeLayout(graph, { repulsion: 150, distance: 90 });

        expect(wasmSpy).toHaveBeenCalledTimes(1);
        expect(graph.getNode('A')?.x).toBe(10);
        expect(graph.getNode('A')?.y).toBe(20);
        expect(graph.getNode('B')?.x).toBe(-8);
        expect(graph.getNode('B')?.y).toBe(4);
        expect(graph.getNode('C')?.x).toBe(0.5);
        expect(graph.getNode('C')?.y).toBe(-3);

        const diagnostics = LayoutEngine.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('wasm-adapter');
        expect(diagnostics.nodeCount).toBe(3);
        expect(diagnostics.edgeCount).toBe(2);
        expect(diagnostics.durationMs).toBeGreaterThanOrEqual(0);
        expect(diagnostics.reason).toBe('wasm-result-applied');
    });

    test('GraphMetrics marks sequential mode for small-graph threshold path', async () => {
        config.memorySavingMode = false;

        const graph = new Graph();
        graph.addNode(createNode('S1'));
        graph.addNode(createNode('S2'));
        graph.addNode(createNode('S3'));
        graph.addEdge('S1', 'S2');
        graph.addEdge('S2', 'S3');

        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeBetweenness')
            .mockResolvedValue(new Map<string, number>());

        const result = await GraphMetrics.calculateBetweennessAsync(graph);

        expect(wasmSpy).not.toHaveBeenCalled();
        expect(result.size).toBe(3);

        const diagnostics = GraphMetrics.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('sequential');
        expect(diagnostics.nodeCount).toBe(3);
        expect(diagnostics.edgeCount).toBe(2);
        expect(diagnostics.reason).toBe('small-graph-threshold');
    });

    test('GraphMetrics keeps sparse large graph on sequential path via workload-tier threshold', async () => {
        config.memorySavingMode = false;
        config.maxWorkers = 4;

        const graph = new Graph();
        for (let i = 0; i < 500; i++) {
            graph.addNode(createNode(`s${i}`));
        }
        for (let i = 0; i < 12; i++) {
            graph.addEdge(`s${i}`, `s${i + 1}`);
        }

        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeBetweenness')
            .mockResolvedValue(new Map<string, number>());

        const result = await GraphMetrics.calculateBetweennessAsync(graph);

        expect(wasmSpy).not.toHaveBeenCalled();
        expect(result.size).toBe(500);

        const diagnostics = GraphMetrics.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('sequential');
        expect(diagnostics.nodeCount).toBe(500);
        expect(diagnostics.edgeCount).toBe(12);
        expect(diagnostics.reason).toBe('sparse-workload-threshold');
    });

    test('GraphMetrics honors env workload ratio override and routes sparse large graph to wasm path', async () => {
        config.memorySavingMode = false;
        config.maxWorkers = 2;
        process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD = '1';
        process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD = '1';

        const graph = new Graph();
        for (let i = 0; i < 500; i++) {
            graph.addNode(createNode(`w${i}`));
        }
        for (let i = 0; i < 12; i++) {
            graph.addEdge(`w${i}`, `w${i + 1}`);
        }

        const baseline = GraphMetrics.calculateBetweenness(graph);
        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeBetweenness')
            .mockResolvedValue(baseline);

        const result = await GraphMetrics.calculateBetweennessAsync(graph);

        expect(wasmSpy).toHaveBeenCalledTimes(1);
        expect(result.size).toBe(500);

        const diagnostics = GraphMetrics.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('wasm-adapter');
        expect(diagnostics.reason).toBe('wasm-result-applied');
    });

    test('GraphMetrics execution policy falls back to defaults for invalid env values', () => {
        process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD = '-5';
        process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD = 'invalid-number';

        const policy = GraphMetrics.getExecutionPolicy();
        expect(policy).toEqual({
            asyncNodeCountThreshold: 500,
            asyncWorkloadBenefitRatioThreshold: 24
        });
    });

    test('LayoutEngine marks skipped mode when worker runtime is unavailable after wasm miss', async () => {
        const graph = new Graph();
        graph.addNode(createNode('L1'));
        graph.addNode(createNode('L2'));
        graph.addEdge('L1', 'L2');

        jest
            .spyOn(WasmParityRuntime, 'computeLayout')
            .mockResolvedValue(null);

        jest
            .spyOn(WorkerRuntime, 'resolveWorkerRuntimePath')
            .mockReturnValue({
                workerPath: null,
                isTsNode: false,
                candidates: ['missing-layout-worker']
            });

        await LayoutEngine.computeLayout(graph, { repulsion: 120, distance: 90 });

        const diagnostics = LayoutEngine.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('skipped');
        expect(diagnostics.nodeCount).toBe(2);
        expect(diagnostics.edgeCount).toBe(1);
        expect(diagnostics.reason).toBe('worker-script-unavailable');
    });
});

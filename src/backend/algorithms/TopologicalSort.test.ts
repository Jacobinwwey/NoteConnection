import { Graph } from '../../core/Graph';
import { TopologicalSort } from './TopologicalSort';
import { WasmParityRuntime } from './WasmParityRuntime';

describe('TopologicalSort', () => {
    let graph: Graph;

    beforeEach(() => {
        graph = new Graph();
        TopologicalSort.__resetComputeDiagnosticsForTests();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('assignRanks computes expected levels for a simple DAG', () => {
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'C');
        graph.addEdge('A', 'D');

        const ranks = TopologicalSort.assignRanks(graph);
        expect(ranks.get('A')).toBe(0);
        expect(ranks.get('B')).toBe(1);
        expect(ranks.get('C')).toBe(2);
        expect(ranks.get('D')).toBe(1);
    });

    test('assignRanksAsync uses wasm adapter ranks when available', async () => {
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'C');

        const wasmRanks = new Map<string, number>([
            ['A', 0],
            ['B', 1],
            ['C', 2]
        ]);
        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeRanks')
            .mockResolvedValue(wasmRanks);

        const ranks = await TopologicalSort.assignRanksAsync(graph);
        expect(wasmSpy).toHaveBeenCalledTimes(1);
        expect(ranks).toEqual(wasmRanks);

        const diagnostics = TopologicalSort.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('wasm-adapter');
        expect(diagnostics.reason).toBe('wasm-result-applied');
        expect(diagnostics.nodeCount).toBe(3);
        expect(diagnostics.edgeCount).toBe(2);
    });

    test('assignRanksAsync falls back to sequential when wasm returns null', async () => {
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'C');

        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeRanks')
            .mockResolvedValue(null);

        const ranks = await TopologicalSort.assignRanksAsync(graph);
        expect(wasmSpy).toHaveBeenCalledTimes(1);
        expect(ranks.get('A')).toBe(0);
        expect(ranks.get('B')).toBe(1);
        expect(ranks.get('C')).toBe(2);

        const diagnostics = TopologicalSort.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('sequential');
        expect(diagnostics.reason).toBe('wasm-null-fallback');
    });

    test('assignRanksAsync falls back to sequential when wasm result misses nodes', async () => {
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'C');

        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeRanks')
            .mockResolvedValue(
                new Map<string, number>([
                    ['A', 0],
                    ['B', 1]
                ])
            );

        const ranks = await TopologicalSort.assignRanksAsync(graph);
        expect(wasmSpy).toHaveBeenCalledTimes(1);
        expect(ranks.get('C')).toBe(2);

        const diagnostics = TopologicalSort.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('sequential');
        expect(diagnostics.reason).toBe('wasm-incomplete-fallback');
    });
});

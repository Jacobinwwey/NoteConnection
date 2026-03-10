import { Graph } from '../../core/Graph';
import { CycleDetector } from './CycleDetection';
import { WasmParityRuntime } from './WasmParityRuntime';

describe('CycleDetector', () => {
    let graph: Graph;

    beforeEach(() => {
        graph = new Graph();
        CycleDetector.__resetComputeDiagnosticsForTests();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should detect a simple cycle', () => {
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'C');
        graph.addEdge('C', 'A');

        const cycles = CycleDetector.detectCycles(graph);
        expect(cycles.length).toBeGreaterThan(0);
        expect(CycleDetector.hasCycle(graph)).toBe(true);
    });

    test('should respect the limit parameter', () => {
        // Create 3 separate cycles
        // 1: A->B->A
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'A');

        // 2: C->D->C
        graph.addEdge('C', 'D');
        graph.addEdge('D', 'C');

        // 3: E->F->E
        graph.addEdge('E', 'F');
        graph.addEdge('F', 'E');

        // Detect with limit 1
        const cycles1 = CycleDetector.detectCycles(graph, 1);
        expect(cycles1.length).toBe(1);

        // Detect with limit 2
        const cycles2 = CycleDetector.detectCycles(graph, 2);
        expect(cycles2.length).toBe(2);
        
        // Detect with limit 0 (all)
        const cyclesAll = CycleDetector.detectCycles(graph);
        expect(cyclesAll.length).toBeGreaterThanOrEqual(3);
    });

    test('hasCycle should return true if cycle exists', () => {
         graph.addEdge('A', 'B');
         graph.addEdge('B', 'A');
         expect(CycleDetector.hasCycle(graph)).toBe(true);
    });
    
    test('hasCycle should return false for DAG', () => {
         graph.addEdge('A', 'B');
         graph.addEdge('B', 'C');
         expect(CycleDetector.hasCycle(graph)).toBe(false);
    });

    test('detectCyclesAsync uses wasm adapter results when available', async () => {
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'C');
        graph.addEdge('C', 'A');

        const wasmCycles = [['A', 'B', 'C', 'A']];
        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeCycles')
            .mockResolvedValue(wasmCycles);

        const cycles = await CycleDetector.detectCyclesAsync(graph, 10);
        expect(wasmSpy).toHaveBeenCalledTimes(1);
        expect(cycles).toEqual(wasmCycles);

        const diagnostics = CycleDetector.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('wasm-adapter');
        expect(diagnostics.reason).toBe('wasm-result-applied');
        expect(diagnostics.nodeCount).toBe(3);
        expect(diagnostics.edgeCount).toBe(3);
        expect(diagnostics.limit).toBe(10);
    });

    test('detectCyclesAsync falls back to sequential when wasm returns null', async () => {
        graph.addEdge('A', 'B');
        graph.addEdge('B', 'A');

        const wasmSpy = jest
            .spyOn(WasmParityRuntime, 'computeCycles')
            .mockResolvedValue(null);

        const cycles = await CycleDetector.detectCyclesAsync(graph, 1);
        expect(wasmSpy).toHaveBeenCalledTimes(1);
        expect(cycles.length).toBe(1);

        const diagnostics = CycleDetector.getLastComputeDiagnostics();
        expect(diagnostics.mode).toBe('sequential');
        expect(diagnostics.reason).toBe('wasm-null-fallback');
        expect(diagnostics.limit).toBe(1);
    });
});

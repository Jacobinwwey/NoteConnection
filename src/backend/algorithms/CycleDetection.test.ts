import { Graph } from '../../core/Graph';
import { CycleDetector } from './CycleDetection';

describe('CycleDetector', () => {
    let graph: Graph;

    beforeEach(() => {
        graph = new Graph();
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
});

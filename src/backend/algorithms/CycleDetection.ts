import { Graph } from '../../core/Graph';
import { WasmParityRuntime } from './WasmParityRuntime';

export type CycleDetectionComputeMode = 'none' | 'wasm-adapter' | 'sequential';

export interface CycleDetectionComputeDiagnostics {
    mode: CycleDetectionComputeMode;
    nodeCount: number;
    edgeCount: number;
    limit: number;
    durationMs: number;
    reason: string | null;
    updatedAtMs: number;
}

function createDefaultComputeDiagnostics(): CycleDetectionComputeDiagnostics {
    return {
        mode: 'none',
        nodeCount: 0,
        edgeCount: 0,
        limit: 0,
        durationMs: 0,
        reason: null,
        updatedAtMs: 0
    };
}

/**
 * Service to detect cycles in the graph.
 * 用于检测图中循环的服务。
 */
export class CycleDetector {
    private static lastComputeDiagnostics: CycleDetectionComputeDiagnostics = createDefaultComputeDiagnostics();

    private static markComputeMode(
        mode: CycleDetectionComputeMode,
        nodeCount: number,
        edgeCount: number,
        limit: number,
        startedAtMs: number,
        reason: string | null = null
    ): void {
        const updatedAtMs = Date.now();
        this.lastComputeDiagnostics = {
            mode,
            nodeCount,
            edgeCount,
            limit,
            durationMs: Math.max(0, updatedAtMs - startedAtMs),
            reason,
            updatedAtMs
        };
    }

    static getLastComputeDiagnostics(): CycleDetectionComputeDiagnostics {
        return { ...this.lastComputeDiagnostics };
    }

    static __resetComputeDiagnosticsForTests(): void {
        this.lastComputeDiagnostics = createDefaultComputeDiagnostics();
    }

    static async detectCyclesAsync(graph: Graph, limit: number = 0): Promise<string[][]> {
        const startedAtMs = Date.now();
        const nodes = graph.getNodes();
        const nodeCount = nodes.length;
        const edgeCount = graph.getEdges().length;
        const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

        const nodeIds = nodes.map((node) => node.id);
        const adjacency: Record<string, string[]> = {};
        nodeIds.forEach((nodeId) => {
            adjacency[nodeId] = graph.getNeighbors(nodeId);
        });

        try {
            const wasmCycles = await WasmParityRuntime.computeCycles(nodeIds, adjacency, normalizedLimit);
            if (wasmCycles !== null) {
                this.markComputeMode(
                    'wasm-adapter',
                    nodeCount,
                    edgeCount,
                    normalizedLimit,
                    startedAtMs,
                    'wasm-result-applied'
                );
                return wasmCycles;
            }
        } catch (wasmErr) {
            console.warn('[CycleDetector] WASM parity cycle detection failed. Falling back to sequential.', wasmErr);
            const fallbackCycles = this.detectCycles(graph, normalizedLimit);
            this.markComputeMode(
                'sequential',
                nodeCount,
                edgeCount,
                normalizedLimit,
                startedAtMs,
                'wasm-error-fallback'
            );
            return fallbackCycles;
        }

        const fallbackCycles = this.detectCycles(graph, normalizedLimit);
        this.markComputeMode(
            'sequential',
            nodeCount,
            edgeCount,
            normalizedLimit,
            startedAtMs,
            'wasm-null-fallback'
        );
        return fallbackCycles;
    }

    /**
     * Detects all simple cycles in the graph using Iterative DFS.
     * 使用迭代 DFS 检测图中的所有简单循环。
     * 
     * @param graph The graph to analyze.
     * @param limit Optional limit on the number of cycles to return. Defaults to 0 (no limit). | 可选的返回循环数量限制。默认为 0（无限制）。
     * @returns Array of cycles, where each cycle is an array of node IDs.
     */
    static detectCycles(graph: Graph, limit: number = 0): string[][] {
        const visited = new Set<string>();
        const onPath = new Set<string>(); // Tracks nodes in current DFS path
        const path: string[] = []; // Current path for cycle reconstruction
        const cycles: string[][] = [];

        const nodes = graph.getNodes();

        for (const node of nodes) {
            if (cycles.length >= limit && limit > 0) break;
            if (visited.has(node.id)) continue;

            // Iterative DFS Stack
            // Stores: [currentNodeId, neighborsIterator, neighborsArray]
            // We use an iterator approach to simulate the recursion stack frames
            const stack: { id: string; neighbors: string[]; index: number }[] = [];
            
            // Push start node
            stack.push({ 
                id: node.id, 
                neighbors: graph.getNeighbors(node.id), 
                index: 0 
            });
            visited.add(node.id);
            onPath.add(node.id);
            path.push(node.id);

            while (stack.length > 0) {
                const frame = stack[stack.length - 1];
                
                // If we have explored all neighbors of this node
                if (frame.index >= frame.neighbors.length) {
                    onPath.delete(frame.id);
                    path.pop();
                    stack.pop();
                    continue;
                }

                const neighborId = frame.neighbors[frame.index];
                frame.index++; // Advance for next time

                if (onPath.has(neighborId)) {
                    // Cycle detected!
                    // Extract cycle from path
                    const cycleStartIndex = path.indexOf(neighborId);
                    if (cycleStartIndex !== -1) {
                        cycles.push([...path.slice(cycleStartIndex), neighborId]);
                        if (limit > 0 && cycles.length >= limit) {
                            return cycles;
                        }
                    }
                } else if (!visited.has(neighborId)) {
                    // Recurse (Push to stack)
                    visited.add(neighborId);
                    onPath.add(neighborId);
                    path.push(neighborId);
                    stack.push({
                        id: neighborId,
                        neighbors: graph.getNeighbors(neighborId),
                        index: 0
                    });
                }
            }
        }

        return cycles;
    }

    /**
     * Checks if the graph has any cycles.
     * 检查图是否有任何循环。
     */
    static hasCycle(graph: Graph): boolean {
        // Optimized: Stop after finding 1 cycle
        const cycles = this.detectCycles(graph, 1);
        return cycles.length > 0;
    }
}

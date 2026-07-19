import { Graph } from '../../core/Graph';
import { WasmParityRuntime } from './WasmParityRuntime';

export type TopologicalSortComputeMode = 'none' | 'wasm-adapter' | 'sequential';

export interface TopologicalSortComputeDiagnostics {
    mode: TopologicalSortComputeMode;
    nodeCount: number;
    edgeCount: number;
    durationMs: number;
    reason: string | null;
    updatedAtMs: number;
}

function createDefaultComputeDiagnostics(): TopologicalSortComputeDiagnostics {
    return {
        mode: 'none',
        nodeCount: 0,
        edgeCount: 0,
        durationMs: 0,
        reason: null,
        updatedAtMs: 0
    };
}

/**
 * Service to perform Topological Sort and Rank assignment.
 * 执行拓扑排序和等级分配的服务。
 */
export class TopologicalSort {
    private static lastComputeDiagnostics: TopologicalSortComputeDiagnostics = createDefaultComputeDiagnostics();

    private static markComputeMode(
        mode: TopologicalSortComputeMode,
        nodeCount: number,
        edgeCount: number,
        startedAtMs: number,
        reason: string | null = null
    ): void {
        const updatedAtMs = Date.now();
        this.lastComputeDiagnostics = {
            mode,
            nodeCount,
            edgeCount,
            durationMs: Math.max(0, updatedAtMs - startedAtMs),
            reason,
            updatedAtMs
        };
    }

    static getLastComputeDiagnostics(): TopologicalSortComputeDiagnostics {
        return { ...this.lastComputeDiagnostics };
    }

    static __resetComputeDiagnosticsForTests(): void {
        this.lastComputeDiagnostics = createDefaultComputeDiagnostics();
    }

    static async assignRanksAsync(graph: Graph): Promise<Map<string, number>> {
        const startedAtMs = Date.now();
        const nodes = graph.getNodes();
        const nodeCount = nodes.length;
        const edgeCount = graph.getEdges().length;
        const nodeIds = nodes.map((node) => node.id);
        const adjacency: Record<string, string[]> = {};
        const inDegrees: Record<string, number> = {};

        nodes.forEach((node) => {
            adjacency[node.id] = graph.getNeighbors(node.id);
            inDegrees[node.id] = Number(node.inDegree || 0);
        });

        try {
            const wasmRanks = await WasmParityRuntime.computeRanks(nodeIds, adjacency, inDegrees);
            const hasCompleteCoverage = wasmRanks !== null && nodeIds.every((nodeId) => wasmRanks.has(nodeId));
            if (wasmRanks && hasCompleteCoverage) {
                this.markComputeMode('wasm-adapter', nodeCount, edgeCount, startedAtMs, 'wasm-result-applied');
                return wasmRanks;
            }

            if (wasmRanks && !hasCompleteCoverage) {
                const fallbackRanks = this.assignRanks(graph);
                this.markComputeMode('sequential', nodeCount, edgeCount, startedAtMs, 'wasm-incomplete-fallback');
                return fallbackRanks;
            }
        } catch (wasmErr) {
            console.warn('[TopologicalSort] WASM parity rank compute failed. Falling back to sequential.', wasmErr);
            const fallbackRanks = this.assignRanks(graph);
            this.markComputeMode('sequential', nodeCount, edgeCount, startedAtMs, 'wasm-error-fallback');
            return fallbackRanks;
        }

        const fallbackRanks = this.assignRanks(graph);
        this.markComputeMode('sequential', nodeCount, edgeCount, startedAtMs, 'wasm-null-fallback');
        return fallbackRanks;
    }

    /**
     * Assigns a topological rank (level) to each node.
     * 为每个节点分配拓扑等级（层级）。
     * Rank 0 = Roots (No dependencies).
     * Rank N = Dependencies have max rank N-1.
     *
     * @param graph The graph to process.
     * @returns Map of NodeId -> Rank.
     */
    static assignRanks(graph: Graph): Map<string, number> {
        const ranks = new Map<string, number>();
        const inDegrees = new Map<string, number>();
        const nodes = graph.getNodes();

        // 1. Initialize In-Degrees
        nodes.forEach((node) => {
            inDegrees.set(node.id, node.inDegree);
            ranks.set(node.id, 0); // Default rank
        });

        // 2. Queue for nodes with in-degree 0
        const queue: string[] = [];
        nodes.forEach((node) => {
            if (node.inDegree === 0) {
                queue.push(node.id);
            }
        });

        // 3. Process Queue (Kahn's Algorithm variant for Longest Path)
        // We want rank[v] = max(rank[v], rank[u] + 1)
        // Standard Kahn's processes nodes when all dependencies are met.
        // This implicitly ensures we processed all 'u' before 'v'.
        let processedCount = 0;

        while (queue.length > 0) {
            const uId = queue.shift() as string;
            processedCount += 1;

            const uRank = ranks.get(uId) as number;
            const neighbors = graph.getNeighbors(uId);

            for (const vId of neighbors) {
                const currentVRank = ranks.get(vId) || 0;
                if (uRank + 1 > currentVRank) {
                    ranks.set(vId, uRank + 1);
                }

                const d = (inDegrees.get(vId) as number) - 1;
                inDegrees.set(vId, d);

                if (d === 0) {
                    queue.push(vId);
                }
            }
        }

        // 4. Handle Cycles
        if (processedCount < nodes.length) {
            console.warn(`Graph contains cycles! Processed ${processedCount}/${nodes.length} nodes.`);
            // Nodes involved in cycles (or reachable from them) were not processed.
            // Their ranks might be incorrect (default 0 or partial updates).
            // We could identify them and push them to the bottom, or just leave as is.
            // For now, we leave them. The CycleDetector should be used to resolve this separately.
        }

        return ranks;
    }
}

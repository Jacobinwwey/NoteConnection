import { Graph } from '../../core/Graph';

/**
 * Service to detect cycles in the graph.
 * 用于检测图中循环的服务。
 */
export class CycleDetector {
    /**
     * Detects all simple cycles in the graph using DFS.
     * 使用 DFS 检测图中的所有简单循环。
     * Note: Finding ALL cycles is NP-Hard. This implementation finds cycles reachable via DFS traversals.
     * It is sufficient for detecting if the graph is a DAG.
     * 注意：查找所有循环是 NP-Hard 问题。此实现查找通过 DFS 遍历可达的循环。
     * 这对于检测图是否为 DAG 足够了。
     * 
     * @param graph The graph to analyze.
     * @param limit Optional limit on the number of cycles to return. Defaults to 0 (no limit). | 可选的返回循环数量限制。默认为 0（无限制）。
     * @returns Array of cycles, where each cycle is an array of node IDs.
     */
    static detectCycles(graph: Graph, limit: number = 0): string[][] {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const cycles: string[][] = [];
        const path: string[] = [];

        const nodes = graph.getNodes();

        // Recursion breaker flag
        let stop = false;

        const dfs = (nodeId: string) => {
            if (stop) return;

            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);

            const neighbors = graph.getNeighbors(nodeId); // Outgoing neighbors
            for (const neighbor of neighbors) {
                if (stop) break;
                
                if (!visited.has(neighbor)) {
                    dfs(neighbor);
                } else if (recursionStack.has(neighbor)) {
                    // Cycle detected!
                    // Extract the cycle from the current path
                    const cycleStartIndex = path.indexOf(neighbor);
                    if (cycleStartIndex !== -1) {
                        cycles.push([...path.slice(cycleStartIndex), neighbor]);
                        if (limit > 0 && cycles.length >= limit) {
                            stop = true;
                        }
                    }
                }
            }

            recursionStack.delete(nodeId);
            path.pop();
        };

        for (const node of nodes) {
            if (stop) break;
            if (!visited.has(node.id)) {
                dfs(node.id);
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

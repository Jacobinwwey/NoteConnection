import { Graph } from '../../core/Graph';
import { NoteNode } from '../../core/types';

/**
 * Service to perform Topological Sort and Rank assignment.
 * 执行拓扑排序和等级分配的服务。
 */
export class TopologicalSort {
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
        nodes.forEach(node => {
            inDegrees.set(node.id, node.inDegree);
            ranks.set(node.id, 0); // Default rank
        });

        // 2. Queue for nodes with in-degree 0
        const queue: string[] = [];
        nodes.forEach(node => {
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
            const uId = queue.shift()!;
            processedCount++;
            
            const uRank = ranks.get(uId)!;
            const neighbors = graph.getNeighbors(uId);

            for (const vId of neighbors) {
                // Update rank of v
                const currentVRank = ranks.get(vId) || 0;
                if (uRank + 1 > currentVRank) {
                    ranks.set(vId, uRank + 1);
                }

                // Decrement in-degree
                const d = inDegrees.get(vId)! - 1;
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

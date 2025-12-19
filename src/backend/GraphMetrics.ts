import { Graph } from '../core/Graph';
import { NoteNode } from '../core/types';

export class GraphMetrics {
    /**
     * Calculates Betweenness Centrality for all nodes.
     * Brandes Algorithm (Unweighted).
     */
    static calculateBetweenness(graph: Graph): Map<string, number> {
        const nodes = graph.toJSON().nodes;
        const cb = new Map<string, number>();
        
        // Initialize
        nodes.forEach(n => cb.set(n.id, 0));

        // For each node s, calculate dependencies
        nodes.forEach(sNode => {
            const s = sNode.id;
            const stack: string[] = [];
            const P = new Map<string, string[]>(); // Predecessors
            const sigma = new Map<string, number>(); // Number of shortest paths
            const d = new Map<string, number>(); // Distance

            // Init
            nodes.forEach(n => {
                P.set(n.id, []);
                sigma.set(n.id, 0);
                d.set(n.id, -1);
            });

            sigma.set(s, 1);
            d.set(s, 0);

            const Q: string[] = [s];

            while (Q.length > 0) {
                const v = Q.shift()!;
                stack.push(v);

                // Neighbors (Outgoing edges for directed graph?)
                // Betweenness usually considers flow. If directed, use outgoing.
                // However, knowledge graphs can be traversed both ways conceptually.
                // Let's stick to Directed for strict dependency.
                const neighbors = graph.getOutgoingEdges(v).map(e => e.target);

                for (const w of neighbors) {
                    // Path discovery
                    if (d.get(w) === -1) {
                        d.set(w, d.get(v)! + 1);
                        Q.push(w);
                    }
                    // Path counting
                    if (d.get(w) === d.get(v)! + 1) {
                        sigma.set(w, sigma.get(w)! + sigma.get(v)!);
                        P.get(w)!.push(v);
                    }
                }
            }

            const delta = new Map<string, number>();
            nodes.forEach(n => delta.set(n.id, 0));

            // Accumulation
            while (stack.length > 0) {
                const w = stack.pop()!;
                for (const v of P.get(w)!) {
                    delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
                }
                if (w !== s) {
                    cb.set(w, cb.get(w)! + delta.get(w)!);
                }
            }
        });

        // Normalize?
        // Standard betweenness is usually roughly O(N^2), so values can be large.
        // We will leave them raw, visualization can scale them.
        return cb;
    }
}

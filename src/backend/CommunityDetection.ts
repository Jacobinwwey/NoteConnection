import { Graph } from '../core/Graph';

/**
 * Simple Label Propagation Algorithm for Community Detection
 */
export class CommunityDetection {
    static detect(graph: Graph): Map<string, string> {
        const nodes = graph.toJSON().nodes;
        const labels = new Map<string, string>();
        
        // Initialize: each node has its own label
        nodes.forEach(n => labels.set(n.id, n.id));

        const maxIter = 50;
        let changed = true;
        let iter = 0;

        while (changed && iter < maxIter) {
            changed = false;
            iter++;
            
            // Randomize order
            const shuffledNodes = [...nodes].sort(() => Math.random() - 0.5);

            for (const node of shuffledNodes) {
                const neighbors = graph.getIncomingEdges(node.id).map(e => e.source)
                    .concat(graph.getOutgoingEdges(node.id).map(e => e.target));

                if (neighbors.length === 0) continue;

                // Count neighbor labels
                const labelCounts = new Map<string, number>();
                neighbors.forEach(neighborId => {
                    const l = labels.get(neighborId);
                    if (l) labelCounts.set(l, (labelCounts.get(l) || 0) + 1);
                });

                // Find max
                let maxCount = -1;
                let bestLabels: string[] = [];
                labelCounts.forEach((count, label) => {
                    if (count > maxCount) {
                        maxCount = count;
                        bestLabels = [label];
                    } else if (count === maxCount) {
                        bestLabels.push(label);
                    }
                });

                // Pick random best
                if (bestLabels.length > 0) {
                    const newLabel = bestLabels[Math.floor(Math.random() * bestLabels.length)];
                    if (newLabel !== labels.get(node.id)) {
                        labels.set(node.id, newLabel);
                        changed = true;
                    }
                }
            }
        }
        
        return labels;
    }
}

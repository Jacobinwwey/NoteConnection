import { VectorSpace } from './VectorSpace';
import { PerformanceLogger } from '../utils/PerformanceLogger';

interface CooccurrenceMetrics {
    count: number;
    jaccard: number;
    conditionalProb: number;
}

export class HybridEngine {
    /**
     * Infer dependencies using both Statistical and Vector methods.
     * 结合统计和向量方法推断依赖关系。
     * 
     * Rule: 
     * 1. High Vector Similarity (Content Relevance)
     * 2. High Statistical Asymmetry (Directionality)
     */
    static infer(
        matrix: Map<string, Map<string, CooccurrenceMetrics>>,
        vectorSpace: VectorSpace,
        vectorThreshold: number = 0.3,
        asymmetryThreshold: number = 0.1
    ): {source: string, target: string, weight: number, confidence: number, reason: string}[] {
        PerformanceLogger.start('Hybrid Inference Logic');
        console.log(`[HybridEngine] Starting inference on ${matrix.size} nodes...`);

        const results: {source: string, target: string, weight: number, confidence: number, reason: string}[] = [];
        const checkedPairs = new Set<string>();

        let processedCount = 0;
        const totalNodes = matrix.size;

        for (const [nodeA, targets] of matrix) {
            processedCount++;
            if (processedCount % 1000 === 0) {
                const mem = process.memoryUsage();
                console.log(`[HybridEngine] Processed ${processedCount}/${totalNodes} nodes. Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            }

            targets.forEach((metricsAtoB, nodeB) => {
                const pairKey = nodeA < nodeB ? `${nodeA}|${nodeB}` : `${nodeB}|${nodeA}`;
                if (checkedPairs.has(pairKey)) return;
                checkedPairs.add(pairKey);

                // Get Reverse Metrics
                const rowB = matrix.get(nodeB);
                const metricsBtoA = rowB ? rowB.get(nodeA) : null;
                if (!metricsBtoA) return;

                // 1. Check Vector Similarity
                const vecA = vectorSpace.getVector(nodeA);
                const vecB = vectorSpace.getVector(nodeB);
                if (!vecA || !vecB) return;

                // Simple dot product for L2 normalized vectors
                let similarity = 0;
                for(let i=0; i<vecA.length; i++) similarity += vecA[i] * vecB[i];

                if (similarity < vectorThreshold) return;

                // 2. Check Asymmetry
                // P(B|A) = metricsAtoB.conditionalProb
                // P(A|B) = metricsBtoA.conditionalProb
                
                const p_A_given_B = metricsBtoA.conditionalProb;
                const p_B_given_A = metricsAtoB.conditionalProb;
                const diff = p_A_given_B - p_B_given_A;

                if (diff > asymmetryThreshold) {
                    // A is Parent (Context) of B
                    // Because B appears implies A appears (High P(A|B))
                    results.push({
                        source: nodeA,
                        target: nodeB,
                        weight: similarity, // Use similarity as edge weight
                        confidence: diff,
                        reason: `Hybrid: Sim=${similarity.toFixed(2)}, Asym=${diff.toFixed(2)}`
                    });
                } else if (-diff > asymmetryThreshold) {
                    // B is Parent of A
                    results.push({
                        source: nodeB,
                        target: nodeA,
                        weight: similarity,
                        confidence: -diff,
                        reason: `Hybrid: Sim=${similarity.toFixed(2)}, Asym=${(-diff).toFixed(2)}`
                    });
                }
            });
        }

        console.log(`[HybridEngine] Inference complete. Found ${results.length} edges.`);
        PerformanceLogger.end('Hybrid Inference Logic');
        
        // Optimize: Clear checkedPairs to free memory immediately
        checkedPairs.clear();

        return results.sort((a, b) => b.confidence - a.confidence);
    }
}

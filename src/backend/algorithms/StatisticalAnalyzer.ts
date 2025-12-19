import { RawFile } from '../FileLoader';

interface CooccurrenceMetrics {
    count: number;
    jaccard: number; // |A ∩ B| / |A ∪ B|
    conditionalProb: number; // P(B|A) = Count(A ∩ B) / Count(A) - Probability B appears given A
}

export class StatisticalAnalyzer {
    
    /**
     * Analyze co-occurrence of terms across the corpus.
     * 分析语料库中术语的共现情况。
     * @param files All files in the corpus
     * @param terms List of terms (concept IDs) to track
     * @param windowSize Context window (e.g., 'sentence', 'paragraph', or number of words) - currently 'file' for simplicity
     */
    static analyze(files: RawFile[], terms: string[]): Map<string, Map<string, CooccurrenceMetrics>> {
        const matrix = new Map<string, Map<string, CooccurrenceMetrics>>();
        
        // 1. Build Term Frequency Map (Document Frequency)
        // 1. 构建术语频率映射 (文档频率)
        const termDocCounts = new Map<string, number>();
        const fileHasTerm = new Map<string, Set<string>>(); // fileId -> Set<term>

        terms.forEach(term => termDocCounts.set(term, 0));

        // Pre-process files to find term occurrences
        files.forEach(file => {
            const content = file.content.toLowerCase();
            const foundTerms = new Set<string>();
            
            terms.forEach(term => {
                // Simple inclusion check (can be improved with Regex/Tokenization)
                if (content.includes(term.toLowerCase())) {
                    foundTerms.add(term);
                }
            });

            fileHasTerm.set(file.filename, foundTerms);
            
            foundTerms.forEach(term => {
                termDocCounts.set(term, (termDocCounts.get(term) || 0) + 1);
            });
        });

        // 2. Calculate Co-occurrences
        // 2. 计算共现
        terms.forEach(source => {
            const row = new Map<string, CooccurrenceMetrics>();
            matrix.set(source, row);
            
            const sourceCount = termDocCounts.get(source) || 0;
            if (sourceCount === 0) return;

            terms.forEach(target => {
                if (source === target) return;

                let intersection = 0;
                
                // Iterate files
                files.forEach(file => {
                    const termsInFile = fileHasTerm.get(file.filename);
                    if (termsInFile && termsInFile.has(source) && termsInFile.has(target)) {
                        intersection++;
                    }
                });

                if (intersection > 0) {
                    const targetCount = termDocCounts.get(target) || 0;
                    const union = sourceCount + targetCount - intersection;
                    
                    row.set(target, {
                        count: intersection,
                        jaccard: union === 0 ? 0 : intersection / union,
                        conditionalProb: intersection / sourceCount
                    });
                }
            });
        });

        return matrix;
    }

    /**
     * Infer directional dependencies based on Probability Asymmetry.
     * 基于概率不对称性推断有向依赖关系。
     * Logic: If P(Parent | Child) >> P(Child | Parent), then Child implies Parent context.
     * 逻辑：如果 P(父 | 子) >> P(子 | 父)，则子隐含父语境。
     */
    static inferDependencies(matrix: Map<string, Map<string, CooccurrenceMetrics>>, minSupport: number = 0.1, asymmetryThreshold: number = 0.2): {source: string, target: string, weight: number, confidence: number}[] {
        const dependencies: {source: string, target: string, weight: number, confidence: number}[] = [];
        const checkedPairs = new Set<string>();

        matrix.forEach((targets, nodeA) => {
            targets.forEach((metricsAtoB, nodeB) => {
                // Avoid checking A-B and B-A twice
                const pairKey = [nodeA, nodeB].sort().join('|');
                if (checkedPairs.has(pairKey)) return;
                checkedPairs.add(pairKey);

                // Get metrics for B -> A (if exists)
                const rowB = matrix.get(nodeB);
                const metricsBtoA = rowB ? rowB.get(nodeA) : null;

                if (!metricsBtoA) return;

                // metricsAtoB.conditionalProb = P(B|A) (Prob of B given A)
                // metricsBtoA.conditionalProb = P(A|B) (Prob of A given B)

                // Hypothesis: General concepts (A) appear often. Specific concepts (B) appear less often but usually with A.
                // So P(A|B) should be HIGH (If B is there, A is there).
                // P(B|A) might be LOW (A can exist without B).
                
                // If P(A|B) > P(B|A) + threshold
                // Then A is Parent, B is Child. Edge: A -> B.
                
                const p_A_given_B = metricsBtoA.conditionalProb;
                const p_B_given_A = metricsAtoB.conditionalProb;
                
                // Jaccard serves as a baseline "relevance" check
                if (metricsAtoB.jaccard < minSupport) return;

                const diff = p_A_given_B - p_B_given_A;

                if (diff > asymmetryThreshold) {
                    // A is Parent of B
                    dependencies.push({
                        source: nodeA,
                        target: nodeB,
                        weight: metricsAtoB.jaccard,
                        confidence: diff
                    });
                } else if (-diff > asymmetryThreshold) {
                    // B is Parent of A
                    dependencies.push({
                        source: nodeB,
                        target: nodeA,
                        weight: metricsAtoB.jaccard,
                        confidence: -diff
                    });
                }
            });
        });

        return dependencies.sort((a, b) => b.confidence - a.confidence);
    }
}

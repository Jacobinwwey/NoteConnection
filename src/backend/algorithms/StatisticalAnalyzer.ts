import { RawFile } from '../FileLoader';
import * as path from 'path';
import * as os from 'os';
import { Worker } from 'worker_threads';
import { config } from '../config';

interface CooccurrenceMetrics {
    count: number;
    jaccard: number; // |A ∩ B| / |A ∪ B|
    conditionalProb: number; // P(B|A) = Count(A ∩ B) / Count(A) - Probability B appears given A
}

export class StatisticalAnalyzer {
    
    /**
     * Analyze co-occurrence of terms across the corpus using Parallel Workers.
     * 使用并行 Worker 分析语料库中术语的共现情况。
     */
    static async analyzeAsync(files: RawFile[], terms: string[]): Promise<Map<string, Map<string, CooccurrenceMetrics>>> {
        const termDocCounts = new Map<string, number>();
        const fileHasTerm = new Map<string, Set<string>>(); // fileId -> Set<term>
        terms.forEach(term => termDocCounts.set(term, 0));

        // 1. Parallel Term Extraction
        // 1. 并行术语提取
        console.log(`[StatisticalAnalyzer] Starting parallel term extraction for ${files.length} files...`);
        const fileTermsMap = await this.runParallelTermExtraction(files, terms);

        // 2. Aggregate Results
        // 2. 聚合结果
        for (const [filename, foundTerms] of Object.entries(fileTermsMap)) {
            const termSet = new Set(foundTerms);
            fileHasTerm.set(filename, termSet);
            
            foundTerms.forEach(term => {
                termDocCounts.set(term, (termDocCounts.get(term) || 0) + 1);
            });
        }

        // 3. Calculate Co-occurrences (Optimized with Inverted Index)
        // 3. 计算共现 (使用倒排索引优化)
        return this.calculateMatrixOptimized(terms, termDocCounts, fileHasTerm);
    }

    private static async runParallelTermExtraction(files: RawFile[], terms: string[]): Promise<Record<string, string[]>> {
        const numCPUs = os.cpus().length;
        const workerCount = config.maxWorkers ?? Math.max(1, numCPUs - 1);
        const chunkSize = Math.ceil(files.length / workerCount);
        
        const workerPromises: Promise<Record<string, string[]>>[] = [];
        // Worker path resolution (handling ts-node vs dist)
        const workerPath = path.join(__dirname, '..', 'workers', 'statisticalWorker.ts');
        const isTsNode = path.extname(__filename) === '.ts' || process.argv.some(arg => arg.includes('ts-node'));
        const actualWorkerPath = isTsNode ? workerPath : workerPath.replace('.ts', '.js').replace('src', 'dist');

        for (let i = 0; i < workerCount; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, files.length);
            if (start >= files.length) break;

            const filesChunk = files.slice(start, end);
            
            const p = new Promise<Record<string, string[]>>((resolve, reject) => {
                const execArgv = isTsNode ? ['-r', require.resolve('ts-node/register')] : undefined;
                const worker = new Worker(actualWorkerPath, {
                    workerData: { filesChunk, terms },
                    execArgv
                });

                worker.on('message', (result: Record<string, string[]>) => resolve(result));
                worker.on('error', reject);
                worker.on('exit', (code) => {
                    if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
            workerPromises.push(p);
        }

        const results = await Promise.all(workerPromises);
        // Merge results
        return results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    }

    private static calculateMatrixOptimized(
        terms: string[], 
        termDocCounts: Map<string, number>, 
        fileHasTerm: Map<string, Set<string>>
    ): Map<string, Map<string, CooccurrenceMetrics>> {
        const matrix = new Map<string, Map<string, CooccurrenceMetrics>>();
        
        // Build Inverted Index: Term -> Set<FileID>
        const invertedIndex = new Map<string, Set<string>>();
        terms.forEach(term => invertedIndex.set(term, new Set()));

        fileHasTerm.forEach((termSet, fileId) => {
            termSet.forEach(term => {
                invertedIndex.get(term)?.add(fileId);
            });
        });

        // Calculate Matrix
        terms.forEach(source => {
            const row = new Map<string, CooccurrenceMetrics>();
            matrix.set(source, row);
            
            const sourceCount = termDocCounts.get(source) || 0;
            const sourceFiles = invertedIndex.get(source);

            if (sourceCount === 0 || !sourceFiles) return;

            terms.forEach(target => {
                if (source === target) return;

                const targetFiles = invertedIndex.get(target);
                if (!targetFiles) return;

                // Intersection of two sets (Optimization: iterate smaller set)
                let intersection = 0;
                if (sourceFiles.size < targetFiles.size) {
                    sourceFiles.forEach(fileId => {
                        if (targetFiles.has(fileId)) intersection++;
                    });
                } else {
                    targetFiles.forEach(fileId => {
                        if (sourceFiles.has(fileId)) intersection++;
                    });
                }

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

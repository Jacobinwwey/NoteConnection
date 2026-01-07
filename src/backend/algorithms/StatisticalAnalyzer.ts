import { RawFile } from '../FileLoader';
import * as path from 'path';
import * as os from 'os';
import { Worker } from 'worker_threads';
import { config } from '../config';

export interface CooccurrenceMetrics {
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
        // Initialize counts
        terms.forEach(term => termDocCounts.set(term, 0));

        // 1. Parallel Term Extraction
        // 1. 并行术语提取
        console.log(`[StatisticalAnalyzer] Starting parallel term extraction for ${files.length} files...`);
        // Returns filename -> string[] (list of terms in that file)
        const fileTermsMap = await this.runParallelTermExtraction(files, terms);

        // 2. Aggregate Counts
        // 2. 聚合计数
        // We use the array directly to avoid Set overhead during matrix calc
        for (const termsInFile of Object.values(fileTermsMap)) {
            // Deduplicate terms per file for counting (document frequency)
            // A term counts once per document even if it appears multiple times?
            // Usually Co-occurrence is binary (present/absent) or weighted. 
            // Current implementation implies binary presence for Jaccard.
            const uniqueTerms = new Set(termsInFile);
            uniqueTerms.forEach(term => {
                termDocCounts.set(term, (termDocCounts.get(term) || 0) + 1);
            });
        }

        // 3. Calculate Co-occurrences (Optimized Sparse Approach)
        // 3. 计算共现 (优化稀疏方法)
        // Pass the raw map (filename -> terms[]) to avoid reconstructing structures
        return this.calculateMatrixSparse(termDocCounts, fileTermsMap);
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
            const filePaths = filesChunk.map(f => f.filepath);
            
            const p = new Promise<Record<string, string[]>>((resolve, reject) => {
                const execArgv = isTsNode ? ['-r', require.resolve('ts-node/register')] : undefined;
                const worker = new Worker(actualWorkerPath, {
                    workerData: { filePaths, terms },
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
        
        // Merge results efficiently
        const finalMap: Record<string, string[]> = {};
        for (const chunkResult of results) {
            Object.assign(finalMap, chunkResult);
        }
        return finalMap;
    }

    /**
     * Calculates the co-occurrence matrix using a sparse, file-centric approach.
     * 使用稀疏、以文件为中心的方法计算共现矩阵。
     * O(Files * TermsPerFile^2) instead of O(TotalTerms^2).
     */
    private static calculateMatrixSparse(
        termDocCounts: Map<string, number>, 
        fileTermsMap: Record<string, string[]>
    ): Map<string, Map<string, CooccurrenceMetrics>> {
        const matrix = new Map<string, Map<string, CooccurrenceMetrics>>();
        
        // Temporary storage for intersection counts: Source -> Target -> Count
        // 临时存储交集计数：源 -> 目标 -> 计数
        const intersectionCounts = new Map<string, Map<string, number>>();

        // Iterate over files to find co-occurring pairs
        // 遍历文件以查找共现对
        for (const termsInFile of Object.values(fileTermsMap)) {
            // Ensure unique terms per file to avoid self-loops or double counting within same file
            const uniqueTerms = Array.from(new Set(termsInFile));
            
            for (let i = 0; i < uniqueTerms.length; i++) {
                const source = uniqueTerms[i];
                
                // Initialize row if needed
                if (!intersectionCounts.has(source)) {
                    intersectionCounts.set(source, new Map());
                }
                const sourceRow = intersectionCounts.get(source)!;

                for (let j = 0; j < uniqueTerms.length; j++) {
                    if (i === j) continue; // Skip self
                    const target = uniqueTerms[j];

                    // Increment intersection count
                    sourceRow.set(target, (sourceRow.get(target) || 0) + 1);
                }
            }
        }

        // Compute final metrics based on intersection counts
        // 基于交集计数计算最终指标
        intersectionCounts.forEach((targets, source) => {
            const sourceCount = termDocCounts.get(source) || 0;
            if (sourceCount === 0) return;

            const row = new Map<string, CooccurrenceMetrics>();
            matrix.set(source, row);

            targets.forEach((intersection, target) => {
                const targetCount = termDocCounts.get(target) || 0;
                
                // Union = A + B - (A ∩ B)
                const union = sourceCount + targetCount - intersection;
                
                row.set(target, {
                    count: intersection,
                    jaccard: union === 0 ? 0 : intersection / union,
                    conditionalProb: intersection / sourceCount // P(B|A)
                });
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

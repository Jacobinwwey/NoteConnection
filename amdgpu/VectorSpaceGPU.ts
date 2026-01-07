import { VectorSpace } from '../src/backend/algorithms/VectorSpace';
import { RawFile } from '../src/backend/FileLoader';
import { PerformanceLogger } from '../src/backend/utils/PerformanceLogger';

export class VectorSpaceGPU extends VectorSpace {
    private gpu: any;
    private similarityMatrix: number[][] | null = null;
    private fileIndex: string[] = []; // Map index -> fileId

    constructor(files: RawFile[]) {
        super(files);
        try {
            // Dynamically require gpu.js to handle optional dependency failure
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { GPU } = require('gpu.js');
            this.gpu = new GPU();
        } catch (e) {
            console.warn('[VectorSpaceGPU] GPU.js not available or failed to load. Falling back to CPU.');
            this.gpu = null;
        }
        
        if (this.gpu) {
            this.precomputeSimilarityMatrix();
        }
    }

    private precomputeSimilarityMatrix() {
        if (!this.gpu) return;

        console.log('[VectorSpaceGPU] Preparing data for GPU...');
        
        // 1. Convert Map<string, SparseVector> to 2D Array (Dense)
        this.fileIndex = Array.from(this.vectors.keys());
        const vocabSize = this.vocab.size;
        
        const vectorArray: number[][] = this.fileIndex.map(id => {
            const sparse = this.vectors.get(id)!;
            const dense = new Array(vocabSize).fill(0);
            for(let k = 0; k < sparse.indices.length; k++) {
                dense[sparse.indices[k]] = sparse.values[k];
            }
            return dense;
        });

        const numDocs = vectorArray.length;
        
        if (numDocs === 0) return;

        const vectorSize = vectorArray[0].length;
        console.log(`[VectorSpaceGPU] Matrix size: ${numDocs} documents x ${vectorSize} dimensions`);

        // 2. Create Kernel
        // Compute A * A^T
        // Each thread (y, x) computes dot product of Document Y and Document X
        
        // GPU.js optimization: flatten input if needed, but 2D array is standard
        // Note: 7900XT should handle large textures, but let's check basic limits safety later.
        
        try {
            const matrixMul = this.gpu.createKernel(function(this: any, A: number[][]) {
                let sum = 0;
                // this.constants.vectorSize is not directly supported in all modes without passing as var or const
                // We iterate over the vector dimension
                for (let i = 0; i < this.constants.vectorSize; i++) {
                    sum += A[this.thread.y][i] * A[this.thread.x][i];
                }
                return sum;
            })
            .setConstants({ vectorSize: vectorSize })
            .setOutput([numDocs, numDocs])
            //.setPipeline(true) // For larger datasets, pipeline might avoid CPU readback loop if we did top-k on GPU
            .setPrecision('single'); // Use float32

            console.log('[VectorSpaceGPU] Executing GPU Kernel...');
            PerformanceLogger.start('GPU Matrix Kernel');
            
            // Execute
            const result = matrixMul(vectorArray) as number[][];
            
            // GPU.js returns a texture or array depending on mode. 
            // Since we didn't set pipeline: true, it returns JS Array (Float32Array usually)
            
            // Deep copy or use directly? result is usually a distinct object tree.
            // For very large arrays, this might be a Float32Array[] or similar.
            // We need to ensure it's indexable as matrix[y][x].
            this.similarityMatrix = result; // Assuming standard array output mode

            PerformanceLogger.end('GPU Matrix Kernel');
            
            // Cleanup kernel
            matrixMul.destroy();

        } catch (error) {
            console.error('[VectorSpaceGPU] GPU Computation Failed. Falling back to CPU on-demand.', error);
            this.similarityMatrix = null;
        }
    }

    public getSimilar(fileId: string, topK: number = 5): {id: string, score: number}[] {
        // If GPU failed or matrix not built, fall back to super (CPU)
        if (!this.similarityMatrix) {
            return super.getSimilar(fileId, topK);
        }

        const sourceIndex = this.fileIndex.indexOf(fileId);
        if (sourceIndex === -1) return [];

        // Read row from matrix
        const row = this.similarityMatrix[sourceIndex];
        const results: {id: string, score: number}[] = [];

        // Convert row to results
        for (let i = 0; i < row.length; i++) {
            if (i !== sourceIndex) { // Skip self
                const score = row[i];
                if (score > 0) {
                    results.push({ id: this.fileIndex[i], score });
                }
            }
        }

        // Sort and slice
        return results.sort((a, b) => b.score - a.score).slice(0, topK);
    }
    
    public destroy() {
        if (this.gpu) {
            this.gpu.destroy();
        }
    }
}

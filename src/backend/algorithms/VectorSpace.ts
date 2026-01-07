import { RawFile } from '../FileLoader';

interface SparseVector {
    indices: Uint32Array; // Sorted indices of non-zero terms
    values: Float32Array; // Corresponding TF-IDF values
}

export class VectorSpace {
    protected vocab: Map<string, number>; // Term -> Index
    protected idf: Map<string, number>; // Term -> Inverse Document Frequency
    protected vectors: Map<string, SparseVector>; // FileID -> SparseVector

    constructor(files: RawFile[]) {
        this.vocab = new Map();
        this.idf = new Map();
        this.vectors = new Map();
        this.build(files);
    }

    private build(files: RawFile[]) {
        const docCount = files.length;
        const docFreq = new Map<string, number>();
        const tokenizedDocs = new Map<string, string[]>();

        // 1. Tokenize & Build Vocabulary
        files.forEach(file => {
            const tokens = this.tokenize(file.content);
            tokenizedDocs.set(file.filename, tokens);

            const uniqueTokens = new Set(tokens);
            uniqueTokens.forEach(token => {
                docFreq.set(token, (docFreq.get(token) || 0) + 1);
            });
        });

        // 2. Calculate IDF & Build Vocab Index
        let index = 0;
        docFreq.forEach((count, term) => {
            if (count > 1) { // Ignore rare terms (min_doc_freq = 2)
                this.vocab.set(term, index++);
                this.idf.set(term, Math.log(docCount / count));
            }
        });

        console.log(`[VectorSpace] Vocabulary size: ${this.vocab.size}`);

        // 3. Compute TF-IDF Vectors (Sparse)
        tokenizedDocs.forEach((tokens, fileId) => {
            const termCounts = new Map<string, number>();
            tokens.forEach(t => termCounts.set(t, (termCounts.get(t) || 0) + 1));
            
            // Collect non-zero entries
            const tempEntries: { idx: number, val: number }[] = [];

            termCounts.forEach((count, term) => {
                const idx = this.vocab.get(term);
                if (idx !== undefined) {
                    const tf = count / tokens.length;
                    const val = tf * this.idf.get(term)!;
                    tempEntries.push({ idx, val });
                }
            });

            // Sort by index for efficient dot product
            tempEntries.sort((a, b) => a.idx - b.idx);

            // Create TypedArrays
            const indices = new Uint32Array(tempEntries.length);
            const values = new Float32Array(tempEntries.length);

            // L2 Normalization Calculation
            let sumSq = 0;
            for (const e of tempEntries) sumSq += e.val * e.val;
            const norm = Math.sqrt(sumSq);

            for (let i = 0; i < tempEntries.length; i++) {
                indices[i] = tempEntries[i].idx;
                values[i] = norm > 0 ? tempEntries[i].val / norm : 0;
            }

            this.vectors.set(fileId, { indices, values });
        });
    }

    private tokenize(text: string): string[] {
        // Bilingual tokenizer: English words or Chinese characters
        // 双语分词器：匹配英文单词或单个中文字符
        // Matches sequence of Alphanumeric OR Single CJK character
        const regex = /[a-zA-Z0-9]+|[\u4e00-\u9fa5]/g;
        return (text.match(regex) || []).map(t => t.toLowerCase());
    }

    public getVector(fileId: string): SparseVector | undefined {
        return this.vectors.get(fileId);
    }

    public getSimilar(fileId: string, topK: number = 5): {id: string, score: number}[] {
        const sourceVec = this.vectors.get(fileId);
        if (!sourceVec) return [];

        const results: {id: string, score: number}[] = [];

        this.vectors.forEach((targetVec, targetId) => {
            if (fileId !== targetId) {
                const score = this.cosineSimilarity(sourceVec, targetVec);
                if (score > 0) {
                    results.push({ id: targetId, score });
                }
            }
        });

        return results.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    // Public static to be used by HybridEngine if needed, but here it's instance method
    public cosineSimilarity(vecA: SparseVector, vecB: SparseVector): number {
        let dot = 0;
        let i = 0;
        let j = 0;
        
        const lenA = vecA.indices.length;
        const lenB = vecB.indices.length;

        // Efficient sparse dot product (O(min(N, M)))
        while (i < lenA && j < lenB) {
            const idxA = vecA.indices[i];
            const idxB = vecB.indices[j];

            if (idxA < idxB) {
                i++;
            } else if (idxA > idxB) {
                j++;
            } else {
                // Indices match
                dot += vecA.values[i] * vecB.values[j];
                i++;
                j++;
            }
        }
        return dot;
    }
}

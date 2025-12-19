import { RawFile } from '../FileLoader';

export class VectorSpace {
    private vocab: Map<string, number>; // Term -> Index
    private idf: Map<string, number>; // Term -> Inverse Document Frequency
    private vectors: Map<string, number[]>; // FileID -> Vector

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
                this.idf.set(term, Math.log(docCount / (1 + count)));
            }
        });

        // 3. Compute TF-IDF Vectors
        tokenizedDocs.forEach((tokens, fileId) => {
            const vector = new Array(this.vocab.size).fill(0);
            const termCounts = new Map<string, number>();
            
            tokens.forEach(t => termCounts.set(t, (termCounts.get(t) || 0) + 1));
            
            termCounts.forEach((count, term) => {
                const idx = this.vocab.get(term);
                if (idx !== undefined) {
                    const tf = count / tokens.length;
                    vector[idx] = tf * this.idf.get(term)!;
                }
            });

            // L2 Normalize
            const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
            if (norm > 0) {
                for (let i = 0; i < vector.length; i++) vector[i] /= norm;
            }

            this.vectors.set(fileId, vector);
        });
    }

    private tokenize(text: string): string[] {
        // Simple regex tokenizer: alphanumeric, lowercase
        return (text.match(/[a-zA-Z0-9]+/g) || []).map(t => t.toLowerCase());
    }

    public getVector(fileId: string): number[] | undefined {
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

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dot = 0;
        // Since vectors are L2 normalized, cosine sim is just dot product
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
        }
        return dot;
    }
}

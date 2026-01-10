export interface AppConfig {
    matchingStrategy: 'exact-phrase' | 'fuzzy'; // Future: 'fuzzy' could imply Levenshtein or Stemming
    clusteringStrategy: 'label-propagation' | 'folder'; // Strategy for assigning clusterIds
    fuzzyThreshold: number; // Max Levenshtein distance for fuzzy match
    enableTags: boolean; // Create nodes for tags
    enableStatisticalInference: boolean; // Use statistical analysis to infer edges
    enableVectorSimilarity: boolean; // Use TF-IDF/Vector similarity for associations
    enableHybridInference: boolean; // Use Hybrid Engine (Stats + Vector)
    enableGPU: boolean; // Use GPU acceleration where available
    enableGPULayout?: boolean; // Use GPU acceleration for Layout
    memorySavingMode: boolean; // Optimize for low memory usage (Sparse Vectors, filePaths in workers, etc.)
    deepDebug: boolean; // Enable detailed logging
    maxWorkers?: number; // Maximum number of worker threads. If undefined, uses (CPU cores - 1).
    exclusionList: string[]; // List of concept IDs (filenames) to ignore when creating edges
}

export const config: AppConfig = {
    matchingStrategy: 'exact-phrase',
    clusteringStrategy: 'label-propagation', // Default to current behavior
    fuzzyThreshold: 2,
    enableTags: true,
    enableStatisticalInference: true, // Default on
    enableVectorSimilarity: true, // Default on
    enableHybridInference: true, // Default on
    enableGPU: true, // Default on (auto-detects compatibility)
    enableGPULayout: true, // Default on (AMD GPU Layout)
    memorySavingMode: true, // Default to true (optimized)
    deepDebug: false, // Default off
    exclusionList: [
        // Add common words or concepts here that cause too much noise
        // e.g., "Introduction", "Summary", etc.
        // For now, we leave it empty as a template
    ]
};

export interface AppConfig {
    matchingStrategy: 'exact-phrase' | 'fuzzy'; // Future: 'fuzzy' could imply Levenshtein or Stemming
    clusteringStrategy: 'label-propagation' | 'folder'; // Strategy for assigning clusterIds
    fuzzyThreshold: number; // Max Levenshtein distance for fuzzy match
    enableTags: boolean; // Create nodes for tags
    enableStatisticalInference: boolean; // Use statistical analysis to infer edges
    enableVectorSimilarity: boolean; // Use TF-IDF/Vector similarity for associations
    enableHybridInference: boolean; // Use Hybrid Engine (Stats + Vector)
    exclusionList: string[]; // List of concept IDs (filenames) to ignore when creating edges
}

export const config: AppConfig = {
    matchingStrategy: 'exact-phrase',
    clusteringStrategy: 'label-propagation', // Default to current behavior
    fuzzyThreshold: 2,
    enableTags: true,
    enableStatisticalInference: false, // Default off
    enableVectorSimilarity: false, // Default off
    enableHybridInference: false, // Default off
    exclusionList: [
        // Add common words or concepts here that cause too much noise
        // e.g., "Introduction", "Summary", etc.
        // For now, we leave it empty as a template
    ]
};

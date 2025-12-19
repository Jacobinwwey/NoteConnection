export interface AppConfig {
    matchingStrategy: 'exact-phrase' | 'fuzzy'; // Future: 'fuzzy' could imply Levenshtein or Stemming
    exclusionList: string[]; // List of concept IDs (filenames) to ignore when creating edges
}

export const config: AppConfig = {
    matchingStrategy: 'exact-phrase',
    exclusionList: [
        // Add common words or concepts here that cause too much noise
        // e.g., "Introduction", "Summary", etc.
        // For now, we leave it empty as a template
    ]
};

export interface SearchResultItem {
    title: string;
    url: string;
    content: string;
}

export interface SearchQuery {
    query: string;
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
}

export interface SearchProvider {
    readonly name: string;
    search(query: SearchQuery, apiKey?: string, timeout?: number): Promise<SearchResultItem[]>;
}

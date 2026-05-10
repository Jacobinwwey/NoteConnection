import { SearchProvider, SearchQuery, SearchResultItem } from './SearchProvider';

interface TavilyApiResult {
    title?: string;
    url: string;
    content: string;
}

interface TavilyApiResponse {
    results?: TavilyApiResult[];
}

export class TavilyProvider implements SearchProvider {
    readonly name = 'tavily';

    async search(query: SearchQuery, apiKey?: string, timeout = 45000): Promise<SearchResultItem[]> {
        if (!apiKey) throw new Error('Tavily API key is required.');
        const maxResults = query.maxResults ?? 5;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: apiKey,
                    query: query.query,
                    search_depth: query.searchDepth ?? 'basic',
                    max_results: maxResults,
                    include_answer: false,
                    include_raw_content: false
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`Tavily API error (${response.status}): ${errorText}`);
            }

            const data = (await response.json()) as TavilyApiResponse;
            return (data.results ?? []).slice(0, maxResults).map(r => ({
                title: r.title ?? '',
                url: r.url,
                content: r.content
            }));
        } finally {
            clearTimeout(timer);
        }
    }
}

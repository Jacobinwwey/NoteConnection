import { SearchProvider, SearchQuery, SearchResultItem } from './SearchProvider';

interface DDGApiResult {
    AbstractText?: string;
    AbstractURL?: string;
    Results?: Array<{ Text?: string; FirstURL?: string }>;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
}

export class DuckDuckGoProvider implements SearchProvider {
    readonly name = 'duckduckgo';

    async search(query: SearchQuery, _apiKey?: string, timeout = 10000): Promise<SearchResultItem[]> {
        const encoded = encodeURIComponent(query.query);
        const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;
        const maxResults = query.maxResults ?? 5;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) return [];
            const data = (await response.json()) as DDGApiResult;

            const results: SearchResultItem[] = [];

            if (data.AbstractText && data.AbstractURL) {
                results.push({ title: data.AbstractText.slice(0, 100), url: data.AbstractURL, content: data.AbstractText });
            }

            const topics = data.RelatedTopics ?? [];
            for (const topic of topics.slice(0, maxResults)) {
                if (topic.Text && topic.FirstURL) {
                    results.push({ title: topic.Text.slice(0, 100), url: topic.FirstURL, content: topic.Text });
                }
            }

            return results.slice(0, maxResults);
        } catch {
            return [];
        } finally {
            clearTimeout(timer);
        }
    }
}

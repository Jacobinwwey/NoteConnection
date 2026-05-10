import { SearchProvider } from './SearchProvider';
import { DuckDuckGoProvider } from './DuckDuckGoProvider';
import { TavilyProvider } from './TavilyProvider';

export class SearchManager {
    static getProvider(searchProvider: 'tavily' | 'duckduckgo'): SearchProvider {
        if (searchProvider === 'tavily') return new TavilyProvider();
        return new DuckDuckGoProvider();
    }
}

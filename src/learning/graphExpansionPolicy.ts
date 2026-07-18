export interface GraphExpansionPolicy {
    enabled: boolean;
    reason: 'ordinary_query' | 'explicit_depth_request';
    maxSteps: 0 | 1;
    maxNeighbors: number;
    maxPathDepth: number;
}

const EXPLICIT_DEPTH_PATTERN = /\b(?:deep|detailed|comprehensive|thorough|in-depth|in depth|in detail|fully|complete|research)\b|深入|深度|详细|详尽|完整|充分|展开|研究/u;

export function resolveGraphExpansionPolicy(message: string): GraphExpansionPolicy {
    const explicitDepthRequested = EXPLICIT_DEPTH_PATTERN.test(String(message || '').toLowerCase());
    return explicitDepthRequested
        ? {
            enabled: true,
            reason: 'explicit_depth_request',
            maxSteps: 1,
            maxNeighbors: 8,
            maxPathDepth: 8,
        }
        : {
            enabled: false,
            reason: 'ordinary_query',
            maxSteps: 0,
            maxNeighbors: 6,
            maxPathDepth: 6,
        };
}

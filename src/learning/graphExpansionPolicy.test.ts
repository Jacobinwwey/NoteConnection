import { resolveGraphExpansionPolicy } from './graphExpansionPolicy';

describe('resolveGraphExpansionPolicy', () => {
    test.each([
        'what is water glass',
        'explain water glass',
        '为什么杯壁会传热',
    ])('keeps ordinary questions on deterministic bounded retrieval: %s', (message) => {
        expect(resolveGraphExpansionPolicy(message)).toEqual({
            enabled: false,
            reason: 'ordinary_query',
            maxSteps: 0,
            maxNeighbors: 6,
            maxPathDepth: 6,
        });
    });

    test.each([
        'explain water glass in detail',
        'perform a deep analysis of water glass',
        'research the complete thermal mechanism',
        '详细解释水杯的热交换机制',
        '深入研究杯壁与环境的关系',
    ])('enables one replayable bounded expansion for explicit depth: %s', (message) => {
        expect(resolveGraphExpansionPolicy(message)).toEqual({
            enabled: true,
            reason: 'explicit_depth_request',
            maxSteps: 1,
            maxNeighbors: 8,
            maxPathDepth: 8,
        });
    });
});

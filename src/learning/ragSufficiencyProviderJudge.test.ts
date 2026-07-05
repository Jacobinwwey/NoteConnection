import {
    createRagSufficiencyProviderJudge,
    parseRagSufficiencyProviderJudgeReview,
} from './ragSufficiencyProviderJudge';
import type { RagContextPack, RagEvidenceFragment } from './types';
import type { NotemdSettings } from '../notemd/types';

function makeSettings(): NotemdSettings {
    return {
        providers: [
            {
                name: 'OpenAI',
                apiKey: 'test-key',
                baseUrl: 'https://example.test/v1',
                model: 'gpt-test',
                temperature: 0,
                enabled: true,
            },
        ],
        activeProvider: 'OpenAI',
        useMultiModelSettings: false,
    } as NotemdSettings;
}

function makeFragment(overrides: Partial<RagEvidenceFragment> = {}): RagEvidenceFragment {
    const text = overrides.text || 'A water glass is a transparent drinking vessel that contains water.';
    return {
        fragmentId: overrides.fragmentId || 'fragment_direct',
        role: overrides.role || 'direct_support',
        text,
        atomId: overrides.atomId || 'atom_water_glass',
        documentId: overrides.documentId || 'doc_water_glass',
        sourcePath: overrides.sourcePath || 'Knowledge_Base/waterglass/water-glass.md',
        title: overrides.title || 'Water Glass',
        headingPath: overrides.headingPath || ['Water Glass', 'Definition'],
        startOffset: overrides.startOffset,
        endOffset: overrides.endOffset,
        startLine: overrides.startLine,
        endLine: overrides.endLine,
        charCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
        truncated: overrides.truncated === true,
        truncationReason: overrides.truncationReason,
        citationIds: overrides.citationIds || ['evidence_water_glass'],
        relationEdgeIds: overrides.relationEdgeIds || [],
        score: overrides.score ?? 0.91,
        sourceBoundary: overrides.sourceBoundary || 'direct_span_only',
    };
}

function makePack(): RagContextPack {
    const fragments = [
        makeFragment(),
        makeFragment({
            fragmentId: 'fragment_parent',
            role: 'parent_context',
            sourceBoundary: 'full_document',
            text: '## Definition\n\nA water glass is a transparent drinking vessel that contains water.',
        }),
    ];
    return {
        query: 'what is water glass?',
        generatedAt: '2026-07-05T00:00:00.000Z',
        sourceBoundary: 'full_document',
        budget: {
            maxFragments: 8,
            maxCharsPerFragment: 800,
            maxTotalChars: 2400,
        },
        fragments,
        sourceDecisions: [],
        totalCharCount: fragments.reduce((sum, fragment) => sum + fragment.charCount, 0),
        tokenEstimate: fragments.reduce((sum, fragment) => sum + fragment.tokenEstimate, 0),
    };
}

describe('createRagSufficiencyProviderJudge', () => {
    test('calls the configured NoteMD provider with bounded JSON-only review input', async () => {
        const complete = jest.fn().mockResolvedValue({
            text: '```json\n{"status":"sufficient","score":0.84,"reasons":["answerable_from_context"],"degradationState":"none"}\n```',
            provider: 'OpenAI',
            model: 'gpt-test',
        });
        const judge = createRagSufficiencyProviderJudge({
            settingsProvider: makeSettings,
            llmClient: { complete },
            timeoutMs: 250,
            maxTokens: 96,
        });

        const review = await judge({
            query: 'what is water glass?',
            contextPack: makePack(),
            graphContext: null,
        });

        expect(review).toEqual(expect.objectContaining({
            status: 'sufficient',
            score: 0.84,
            reasons: ['answerable_from_context'],
            degradationState: 'none',
        }));
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete).toHaveBeenCalledWith(expect.objectContaining({
            provider: expect.objectContaining({ name: 'OpenAI' }),
            model: 'gpt-test',
            maxTokens: 96,
            maxRetries: 0,
            retryDelayMs: 0,
            signal: expect.any(Object),
        }));
        expect(String(complete.mock.calls[0]?.[0]?.content || '')).toContain('"role":"direct_support"');
    });

    test('rejects on timeout so the deterministic reviewer can record a fallback reason', async () => {
        const complete = jest.fn<Promise<any>, [any]>((request: any) => new Promise((_resolve, reject) => {
            request.signal.addEventListener('abort', () => {
                reject(new Error('Operation cancelled.'));
            }, { once: true });
        }));
        const judge = createRagSufficiencyProviderJudge({
            settingsProvider: makeSettings,
            llmClient: { complete },
            timeoutMs: 5,
            maxTokens: 48,
        });

        await expect(judge({
            query: 'what is water glass?',
            contextPack: makePack(),
            graphContext: null,
        })).rejects.toThrow(/cancelled|timed out/i);
    });
});

describe('parseRagSufficiencyProviderJudgeReview', () => {
    test('parses fenced JSON and discards invalid review fields', () => {
        expect(parseRagSufficiencyProviderJudgeReview([
            '```json',
            '{"status":"sufficient","score":1.2,"reasons":[" complete ",""],"degradationState":"none","deterministic":true}',
            '```',
        ].join('\n'))).toEqual({
            status: 'sufficient',
            score: 1,
            reasons: ['complete'],
            degradationState: 'none',
        });
        expect(parseRagSufficiencyProviderJudgeReview('not json')).toBeNull();
    });
});

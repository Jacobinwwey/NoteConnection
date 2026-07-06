import { reviewRagContextSufficiency } from './ragSufficiencyJudge';
import type {
    RagContextPack,
    RagEvidenceFragment,
    RagEvidenceRole,
} from './types';

function makeFragment(overrides: Partial<RagEvidenceFragment> & {
    role?: RagEvidenceRole;
    text?: string;
} = {}): RagEvidenceFragment {
    const text = overrides.text || 'A water glass is a transparent drinking vessel that contains water.';
    return {
        fragmentId: overrides.fragmentId || `fragment_${overrides.role || 'direct_support'}`,
        role: overrides.role || 'direct_support',
        text,
        atomId: overrides.atomId || 'atom_water_glass',
        documentId: overrides.documentId || 'doc_water_glass',
        sourcePath: overrides.sourcePath || 'Knowledge_Base/test/water-glass.md',
        title: overrides.title || 'Water Glass',
        headingPath: Array.isArray(overrides.headingPath) ? overrides.headingPath : ['Water Glass'],
        startOffset: overrides.startOffset,
        endOffset: overrides.endOffset,
        startLine: overrides.startLine,
        endLine: overrides.endLine,
        charCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
        truncated: overrides.truncated === true,
        truncationReason: overrides.truncationReason,
        citationIds: Array.isArray(overrides.citationIds) ? overrides.citationIds : ['evidence_water_glass'],
        relationEdgeIds: Array.isArray(overrides.relationEdgeIds) ? overrides.relationEdgeIds : [],
        score: Number.isFinite(overrides.score) ? Number(overrides.score) : 0.8,
        sourceBoundary: overrides.sourceBoundary || 'direct_span_only',
    };
}

function makePack(fragments: RagEvidenceFragment[]): RagContextPack {
    return {
        query: 'what is water glass?',
        generatedAt: '2026-07-05T00:00:00.000Z',
        sourceBoundary: fragments.some((fragment) => fragment.sourceBoundary === 'full_document')
            ? 'full_document'
            : 'direct_span_only',
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

describe('reviewRagContextSufficiency', () => {
    test('marks direct citation plus document augmentation as sufficient without using LLM review', async () => {
        const llmJudge = jest.fn();
        const review = await reviewRagContextSufficiency({
            query: 'what is water glass?',
            contextPack: makePack([
                makeFragment({
                    role: 'direct_support',
                    text: 'A water glass is a transparent drinking vessel that contains water.',
                }),
                makeFragment({
                    role: 'parent_context',
                    text: '## Definition\n\nA water glass is a transparent drinking vessel that contains water.\n\nThe vessel boundary and water surface define the observed optical behavior.',
                    sourceBoundary: 'full_document',
                }),
            ]),
            llmJudge,
        });

        expect(review.status).toBe('sufficient');
        expect(review.score).toBeGreaterThanOrEqual(0.75);
        expect(review.deterministic).toBe(true);
        expect(review.llmJudgeUsed).toBe(false);
        expect(llmJudge).not.toHaveBeenCalled();
    });

    test('marks missing direct support as insufficient instead of allowing fluent overreach', async () => {
        const review = await reviewRagContextSufficiency({
            query: 'what is water glass?',
            contextPack: makePack([
                makeFragment({
                    role: 'background',
                    text: 'Background note about liquids and containers.',
                    citationIds: [],
                }),
            ]),
        });

        expect(review.status).toBe('insufficient');
        expect(review.degradationState).toBe('insufficient_evidence');
        expect(review.reasons).toContain('missing_direct_support');
    });

    test('keeps direct-span-only answers borderline so callers can recover once', async () => {
        const review = await reviewRagContextSufficiency({
            query: 'what is water glass?',
            contextPack: makePack([
                makeFragment({
                    role: 'direct_support',
                    text: 'A water glass is a transparent drinking vessel that contains water.',
                }),
            ]),
        });

        expect(review.status).toBe('borderline');
        expect(review.degradationState).toBe('partial_coverage');
        expect(review.reasons).toEqual(expect.arrayContaining([
            'document_augmentation_missing',
        ]));
    });

    test('degrades graph evidence when graph-neighbor source windows are unavailable', async () => {
        const pack = makePack([
            makeFragment({
                role: 'direct_support',
                text: 'A brittle glass vessel is stiff and transparent but has low impact tolerance.',
                documentId: 'doc_brittle_glass',
                sourcePath: 'Knowledge_Base/test/brittle-glass.md',
            }),
            makeFragment({
                role: 'parent_context',
                text: '# Brittle Glass Vessel\n\nA brittle glass vessel is stiff and transparent but has low impact tolerance.',
                documentId: 'doc_brittle_glass',
                sourcePath: 'Knowledge_Base/test/brittle-glass.md',
                sourceBoundary: 'full_document',
            }),
            makeFragment({
                role: 'graph_neighbor_support',
                text: 'Missing neighbor evidence should not be treated as complete graph evidence.',
                atomId: 'atom_missing_neighbor',
                documentId: 'doc_missing_neighbor',
                sourcePath: 'Knowledge_Base/test/missing-neighbor.md',
                title: 'Missing Neighbor Evidence',
                sourceBoundary: 'direct_span_only',
            }),
        ]);
        pack.sourceDecisions = [
            {
                documentId: 'doc_brittle_glass',
                sourcePath: 'Knowledge_Base/test/brittle-glass.md',
                sourceBoundary: 'full_document',
                status: 'read',
            },
            {
                documentId: 'doc_missing_neighbor',
                sourcePath: 'Knowledge_Base/test/missing-neighbor.md',
                sourceBoundary: 'direct_span_only',
                status: 'source_window_unavailable',
                reason: 'source_resolver_returned_no_content:graph_neighbor_support',
            },
        ];

        const review = await reviewRagContextSufficiency({
            query: 'compare brittle glass vessel with missing neighbor evidence',
            contextPack: pack,
            graphContext: {
                anchorAtomId: 'atom_brittle_glass',
                anchorTitle: 'Brittle Glass Vessel',
                anchorDocumentId: 'doc_brittle_glass',
                predecessorWindow: [],
                successorWindow: [
                    {
                        atomId: 'atom_missing_neighbor',
                        title: 'Missing Neighbor Evidence',
                        relationKind: 'analogy',
                        confidence: 0.91,
                    },
                ],
                supportingAtomIds: ['atom_missing_neighbor'],
                supportingTitles: ['Missing Neighbor Evidence'],
                relationKinds: ['analogy'],
                relationSummaries: [],
                knowledgePointRelations: [],
                temporalValidity: {
                    checkedAt: '2026-07-05T00:00:00.000Z',
                    allPointsValid: true,
                    warningReasons: [],
                    invalidKnowledgePointTitles: [],
                    edgeKinds: [],
                    details: [],
                },
            },
        });

        expect(review.status).toBe('borderline');
        expect(review.degradationState).toBe('partial_coverage');
        expect(review.reasons).toContain('graph_neighbor_evidence_missing');
    });
});

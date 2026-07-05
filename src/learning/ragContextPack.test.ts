import { buildRagContextPack } from './ragContextPack';
import type {
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

describe('buildRagContextPack', () => {
    test('middle-truncates oversized fragments while preserving the opening and terminal qualifier', () => {
        const longText = [
            'Opening definition: a water glass is a transparent vessel.',
            'Middle detail '.repeat(30),
            'Terminal qualifier: this claim only covers the scoped note.',
        ].join('\n');

        const pack = buildRagContextPack({
            query: 'what is water glass?',
            fragments: [
                makeFragment({
                    role: 'parent_context',
                    text: longText,
                    sourceBoundary: 'full_document',
                }),
            ],
            sourceDecisions: [],
            budget: {
                maxFragments: 3,
                maxCharsPerFragment: 180,
                maxTotalChars: 220,
            },
            generatedAt: '2026-07-05T00:00:00.000Z',
        });

        expect(pack.fragments).toHaveLength(1);
        expect(pack.fragments[0].truncated).toBe(true);
        expect(pack.fragments[0].text).toContain('Opening definition');
        expect(pack.fragments[0].text).toContain('Terminal qualifier');
        expect(pack.fragments[0].text).toContain('[...]');
        expect(pack.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                status: 'fragment_truncated',
                reason: 'max_chars_per_fragment_exceeded',
            }),
        ]));
    });

    test('uses role priority so weak background cannot displace direct or graph evidence', () => {
        const pack = buildRagContextPack({
            query: 'what is water glass?',
            fragments: [
                makeFragment({
                    fragmentId: 'background_1',
                    role: 'background',
                    text: 'Background note with weak topical overlap.',
                    score: 0.95,
                }),
                makeFragment({
                    fragmentId: 'direct_1',
                    role: 'direct_support',
                    text: 'Direct definition of water glass.',
                    score: 0.7,
                }),
                makeFragment({
                    fragmentId: 'graph_1',
                    role: 'graph_neighbor_support',
                    text: 'Graph neighbor evidence about vessel boundary.',
                    score: 0.6,
                    sourceBoundary: 'full_document',
                }),
            ],
            sourceDecisions: [],
            budget: {
                maxFragments: 2,
                maxCharsPerFragment: 200,
                maxTotalChars: 400,
            },
        });

        expect(pack.fragments.map((fragment) => fragment.fragmentId)).toEqual(['direct_1', 'graph_1']);
        expect(pack.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                status: 'fragment_dropped',
                reason: 'max_fragments_exceeded',
                documentId: 'doc_water_glass',
            }),
        ]));
    });
});

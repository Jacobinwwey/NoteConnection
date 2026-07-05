import { assembleRagEvidenceContext } from './evidenceContextAssembler';
import type {
    EvidenceSpan,
    KnowledgeAtom,
    KnowledgeQueryItem,
    RelationEdge,
} from './types';

function makeAtom(overrides: Partial<KnowledgeAtom> = {}): KnowledgeAtom {
    return {
        id: overrides.id || 'atom_water_glass',
        stableKey: overrides.stableKey || 'water-glass',
        documentId: overrides.documentId || 'doc_water_glass',
        sourcePath: overrides.sourcePath || 'Knowledge_Base/test/water-glass.md',
        title: overrides.title || 'Water Glass',
        content: overrides.content || 'A water glass is a transparent drinking vessel that contains water.',
        representationType: overrides.representationType || 'text',
        keywords: overrides.keywords || ['water', 'glass'],
        evidenceSpanIds: overrides.evidenceSpanIds || ['evidence_water_glass'],
        createdAt: overrides.createdAt || '2026-07-05T00:00:00.000Z',
        updatedAt: overrides.updatedAt || '2026-07-05T00:00:00.000Z',
        metadata: overrides.metadata || {
            sectionPath: ['Water Glass'],
            version: 1,
            sourceHash: 'hash_water_glass',
            language: 'en',
        },
    };
}

function makeEvidenceSpan(overrides: Partial<EvidenceSpan> = {}): EvidenceSpan {
    return {
        id: overrides.id || 'evidence_water_glass',
        documentId: overrides.documentId || 'doc_water_glass',
        sourcePath: overrides.sourcePath || 'Knowledge_Base/test/water-glass.md',
        language: overrides.language || 'en',
        startOffset: Number.isFinite(overrides.startOffset) ? Number(overrides.startOffset) : 0,
        endOffset: Number.isFinite(overrides.endOffset) ? Number(overrides.endOffset) : 72,
        startLine: Number.isFinite(overrides.startLine) ? Number(overrides.startLine) : 5,
        endLine: Number.isFinite(overrides.endLine) ? Number(overrides.endLine) : 5,
        snippet: overrides.snippet || 'A water glass is a transparent drinking vessel that contains water.',
        sourceHash: overrides.sourceHash || 'hash_water_glass',
        createdAt: overrides.createdAt || '2026-07-05T00:00:00.000Z',
    };
}

function makeRelationEdge(overrides: Partial<RelationEdge> = {}): RelationEdge {
    return {
        id: overrides.id || 'edge_water_glass',
        sourceAtomId: overrides.sourceAtomId || 'atom_water_glass',
        targetAtomId: overrides.targetAtomId || 'atom_boundary',
        relationKind: overrides.relationKind || 'reference',
        provenance: overrides.provenance || 'fact',
        confidence: Number.isFinite(overrides.confidence) ? Number(overrides.confidence) : 0.8,
        evidenceSpanIds: Array.isArray(overrides.evidenceSpanIds) ? overrides.evidenceSpanIds : ['evidence_water_glass'],
        temporal: overrides.temporal || {
            validFrom: '2026-07-05T00:00:00.000Z',
        },
    };
}

function makeQueryItem(overrides: {
    atom?: Partial<KnowledgeAtom>;
    evidence?: Partial<EvidenceSpan>;
    score?: number;
    relationPath?: Partial<RelationEdge>[];
} = {}): KnowledgeQueryItem {
    const atom = makeAtom(overrides.atom);
    const evidence = makeEvidenceSpan({
        documentId: atom.documentId,
        sourcePath: atom.sourcePath,
        ...overrides.evidence,
    });
    return {
        atom,
        score: overrides.score == null ? 0.94 : overrides.score,
        evidenceSpans: [evidence],
        relationPath: Array.isArray(overrides.relationPath)
            ? overrides.relationPath.map((edge) => makeRelationEdge(edge))
            : [],
        temporalValidity: {
            isValid: true,
            checkedAt: '2026-07-05T00:00:00.000Z',
            reasons: [],
            details: [],
        },
    };
}

describe('assembleRagEvidenceContext', () => {
    test('turns a direct citation into grounded fragments while treating full document reading as the source boundary', async () => {
        const definition = 'A water glass is a transparent drinking vessel that contains water.';
        const fullDocument = [
            '# Water Glass',
            '',
            'Introductory notes that should be visible only when selected by the context assembler.',
            '',
            '## Definition',
            '',
            definition,
            '',
            'The vessel boundary and the water surface jointly determine the visible optical behavior.',
            '',
            '## Remote Appendix',
            '',
            'A remote maintenance note should not be copied into the model-visible context unless selected.',
        ].join('\n');
        const item = makeQueryItem({
            evidence: {
                startOffset: fullDocument.indexOf(definition),
                endOffset: fullDocument.indexOf(definition) + definition.length,
                startLine: 7,
                endLine: 7,
                snippet: definition,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'what is water glass?',
            items: [item],
            sourceResolver: async () => ({
                documentId: item.atom.documentId,
                sourcePath: item.atom.sourcePath,
                content: fullDocument,
                sourceHash: 'hash_water_glass',
            }),
            budget: {
                maxFragments: 5,
                maxCharsPerFragment: 220,
                maxTotalChars: 700,
            },
        });

        expect(assembly.sourceBoundary).toBe('full_document');
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'direct_support',
                atomId: item.atom.id,
                documentId: item.atom.documentId,
                sourcePath: item.atom.sourcePath,
                citationIds: [item.evidenceSpans[0].id],
                text: definition,
            }),
        ]));
        expect(assembly.fragments.some((fragment) => (
            fragment.role === 'parent_context'
            && fragment.headingPath.includes('Definition')
            && fragment.text.includes('vessel boundary')
        ))).toBe(true);
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).not.toContain('remote maintenance note');
        expect(assembly.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                documentId: item.atom.documentId,
                sourceBoundary: 'full_document',
                status: 'read',
            }),
        ]));
    });

    test('falls back to the direct evidence span when full source content is unavailable', async () => {
        const item = makeQueryItem();

        const assembly = await assembleRagEvidenceContext({
            query: 'what is water glass?',
            items: [item],
            sourceResolver: async () => null,
        });

        expect(assembly.sourceBoundary).toBe('direct_span_only');
        expect(assembly.fragments).toHaveLength(1);
        expect(assembly.fragments[0]).toEqual(expect.objectContaining({
            role: 'direct_support',
            text: item.evidenceSpans[0].snippet,
            citationIds: [item.evidenceSpans[0].id],
        }));
        expect(assembly.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                documentId: item.atom.documentId,
                status: 'source_window_unavailable',
            }),
        ]));
    });

    test('dedupes overlapping windows for repeated hits in the same knowledge point', async () => {
        const firstHit = 'A water glass is a transparent drinking vessel that contains water.';
        const secondHit = 'A water glass can also describe the vessel-water system under observation.';
        const fullDocument = [
            '# Water Glass',
            '',
            '## Definition',
            '',
            firstHit,
            '',
            'Boundary notes connect the vessel wall to the liquid surface.',
            '',
            secondHit,
            '',
            'The same section should remain one selected context block, not two duplicated blocks.',
        ].join('\n');
        const atom = makeAtom({
            documentId: 'doc_repeated',
            sourcePath: 'Knowledge_Base/test/repeated-water-glass.md',
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_first',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(firstHit),
                    endOffset: fullDocument.indexOf(firstHit) + firstHit.length,
                    startLine: 5,
                    endLine: 5,
                    snippet: firstHit,
                }),
                makeEvidenceSpan({
                    id: 'evidence_second',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(secondHit),
                    endOffset: fullDocument.indexOf(secondHit) + secondHit.length,
                    startLine: 9,
                    endLine: 9,
                    snippet: secondHit,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'water glass definition',
            items: [item],
            sourceResolver: async () => ({
                documentId: atom.documentId,
                sourcePath: atom.sourcePath,
                content: fullDocument,
            }),
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 320,
                maxTotalChars: 1200,
            },
        });

        const parentFragments = assembly.fragments.filter((fragment) => fragment.role === 'parent_context');
        expect(parentFragments).toHaveLength(1);
        expect(parentFragments[0].text).toContain(firstHit);
        expect(parentFragments[0].text).toContain(secondHit);
        expect(parentFragments[0].citationIds).toEqual(expect.arrayContaining(['evidence_first', 'evidence_second']));
    });

    test('adds graph neighbor evidence as support fragments instead of title-only context', async () => {
        const anchorItem = makeQueryItem({
            atom: {
                id: 'atom_anchor',
                documentId: 'doc_anchor',
                title: 'Water Glass',
                content: 'A water glass is a transparent drinking vessel that contains water.',
            },
            evidence: {
                id: 'evidence_anchor',
                snippet: 'A water glass is a transparent drinking vessel that contains water.',
            },
        });
        const neighborItem = makeQueryItem({
            atom: {
                id: 'atom_boundary',
                documentId: 'doc_boundary',
                sourcePath: 'Knowledge_Base/test/boundary.md',
                title: 'Vessel Boundary',
                content: 'The vessel boundary explains how the container constrains the water surface.',
            },
            evidence: {
                id: 'evidence_boundary',
                documentId: 'doc_boundary',
                sourcePath: 'Knowledge_Base/test/boundary.md',
                snippet: 'The vessel boundary explains how the container constrains the water surface.',
            },
            relationPath: [
                {
                    id: 'edge_boundary_water_glass',
                    sourceAtomId: 'atom_boundary',
                    targetAtomId: 'atom_anchor',
                    relationKind: 'prerequisite',
                    evidenceSpanIds: ['evidence_boundary'],
                },
            ],
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'what is water glass?',
            items: [anchorItem],
            graphNeighborItems: [neighborItem],
            sourceResolver: async (lookup) => ({
                documentId: lookup.documentId,
                sourcePath: lookup.sourcePath,
                content: lookup.documentId === 'doc_boundary'
                    ? '# Vessel Boundary\n\nThe vessel boundary explains how the container constrains the water surface.'
                    : '# Water Glass\n\nA water glass is a transparent drinking vessel that contains water.',
            }),
        });

        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'graph_neighbor_support',
                atomId: 'atom_boundary',
                documentId: 'doc_boundary',
                citationIds: ['evidence_boundary'],
                relationEdgeIds: ['edge_boundary_water_glass'],
                text: expect.stringContaining('container constrains the water surface'),
            }),
        ]));
    });
});

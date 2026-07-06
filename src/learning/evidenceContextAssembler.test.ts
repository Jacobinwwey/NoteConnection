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

    test('uses line provenance to disambiguate repeated snippets when offsets are stale', async () => {
        const repeatedSnippet = 'The calibration note uses the shared repeated wording.';
        const firstOnly = 'First section context must not be selected for the second hit.';
        const secondOnly = 'Second section context is the intended source window.';
        const fullDocument = [
            '# Repeated Snippet Provenance Probe',
            '',
            '## First Section',
            repeatedSnippet,
            firstOnly,
            '',
            '## Second Section',
            repeatedSnippet,
            secondOnly,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_repeated_snippet_provenance',
            documentId: 'doc_repeated_snippet_provenance',
            sourcePath: 'Knowledge_Base/test/repeated-snippet-provenance.md',
            title: 'Repeated Snippet Provenance Probe',
            content: repeatedSnippet,
            keywords: ['repeated', 'snippet', 'provenance'],
        });
        const item = makeQueryItem({
            atom,
            evidence: {
                id: 'evidence_second_repeated_snippet',
                documentId: atom.documentId,
                sourcePath: atom.sourcePath,
                startOffset: 0,
                endOffset: 1,
                startLine: 8,
                endLine: 8,
                snippet: repeatedSnippet,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'what does the repeated snippet provenance probe say?',
            items: [item],
            sourceResolver: async () => ({
                documentId: atom.documentId,
                sourcePath: atom.sourcePath,
                content: fullDocument,
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 6,
                maxCharsPerFragment: 500,
                maxTotalChars: 1400,
            },
        });

        const parentFragment = assembly.fragments.find((fragment) => (
            fragment.role === 'parent_context'
            && fragment.text.includes(secondOnly)
        ));
        expect(parentFragment).toEqual(expect.objectContaining({
            headingPath: ['Repeated Snippet Provenance Probe', 'Second Section'],
            citationIds: ['evidence_second_repeated_snippet'],
        }));
        expect(parentFragment?.text).toContain(secondOnly);
        expect(parentFragment?.text).not.toContain(firstOnly);
    });

    test('marks adjacent numeric facts about the same tolerance as conflicting evidence', async () => {
        const nominalTolerance = 'The calibration tolerance is +/-0.10 mm in the nominal bench procedure.';
        const overrideTolerance = 'The calibration tolerance is +/-0.50 mm in the field override note.';
        const fullDocument = [
            '# Conflicting Adjacent Evidence Probe',
            '',
            'Calibration tolerance conflict probe validates that adjacent contradictory source facts are not flattened into a stable value.',
            '',
            '## Tolerance Statements',
            nominalTolerance,
            overrideTolerance,
            'Operators must resolve the active procedure before publishing a tolerance value.',
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_tolerance',
            documentId: 'doc_conflicting_tolerance',
            sourcePath: 'Knowledge_Base/ragconflict/calibration tolerance conflict probe.md',
            title: 'Conflicting Adjacent Evidence Probe',
            content: nominalTolerance,
            keywords: ['calibration', 'tolerance', 'conflict'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_nominal_tolerance',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(nominalTolerance),
                    endOffset: fullDocument.indexOf(nominalTolerance) + nominalTolerance.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: nominalTolerance,
                }),
                makeEvidenceSpan({
                    id: 'evidence_override_tolerance',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(overrideTolerance),
                    endOffset: fullDocument.indexOf(overrideTolerance) + overrideTolerance.length,
                    startLine: 7,
                    endLine: 7,
                    snippet: overrideTolerance,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is calibration tolerance conflict probe?',
            items: [item],
            sourceResolver: async () => ({
                documentId: atom.documentId,
                sourcePath: atom.sourcePath,
                content: fullDocument,
            }),
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 500,
                maxTotalChars: 1600,
            },
        });

        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'conflict',
                documentId: atom.documentId,
                sourcePath: atom.sourcePath,
                sourceBoundary: 'full_document',
                citationIds: expect.arrayContaining([
                    'evidence_nominal_tolerance',
                    'evidence_override_tolerance',
                ]),
                text: expect.stringContaining(nominalTolerance),
            }),
        ]));
        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment?.text).toContain(overrideTolerance);
        expect(conflictFragment?.text.match(new RegExp(nominalTolerance.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
        expect(conflictFragment?.text.match(new RegExp(overrideTolerance.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    });

    test('marks non-adjacent numeric facts in the same section as conflicting evidence', async () => {
        const nominalTolerance = 'The calibration tolerance is +/-0.10 mm in the nominal bench procedure.';
        const overrideTolerance = 'The calibration tolerance is +/-0.50 mm in the field override note.';
        const fullDocument = [
            '# Non Adjacent Conflict Probe',
            '',
            'Remote calibration tolerance conflict probe validates that distant contradictory source facts inside one section are not flattened into a stable value.',
            '',
            '## Tolerance Statements',
            nominalTolerance,
            '',
            'Context paragraph one keeps the source section long enough to exceed the local window.',
            '',
            'Context paragraph two keeps the source section long enough to exceed the local window.',
            '',
            'Context paragraph three keeps the source section long enough to exceed the local window.',
            '',
            'Context paragraph four keeps the source section long enough to exceed the local window.',
            '',
            'Context paragraph five keeps the source section long enough to exceed the local window.',
            '',
            'Context paragraph six keeps the source section long enough to exceed the local window.',
            '',
            'Context paragraph seven keeps the source section long enough to exceed the local window.',
            '',
            overrideTolerance,
            'Operators must resolve the active procedure before publishing a tolerance value.',
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_nonadjacent_tolerance',
            documentId: 'doc_conflicting_nonadjacent_tolerance',
            sourcePath: 'Knowledge_Base/ragconflict/remote calibration tolerance conflict probe.md',
            title: 'Non Adjacent Conflict Probe',
            content: nominalTolerance,
            keywords: ['remote', 'calibration', 'tolerance', 'conflict'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_nominal_nonadjacent_tolerance',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(nominalTolerance),
                    endOffset: fullDocument.indexOf(nominalTolerance) + nominalTolerance.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: nominalTolerance,
                }),
                makeEvidenceSpan({
                    id: 'evidence_override_nonadjacent_tolerance',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(overrideTolerance),
                    endOffset: fullDocument.indexOf(overrideTolerance) + overrideTolerance.length,
                    startLine: 22,
                    endLine: 22,
                    snippet: overrideTolerance,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is remote calibration tolerance conflict probe?',
            items: [item],
            sourceResolver: async () => ({
                documentId: atom.documentId,
                sourcePath: atom.sourcePath,
                content: fullDocument,
            }),
            paragraphWindow: 5,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 700,
                maxTotalChars: 2200,
            },
        });

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            documentId: atom.documentId,
            sourcePath: atom.sourcePath,
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_nonadjacent_tolerance',
                'evidence_override_nonadjacent_tolerance',
            ]),
            startLine: 6,
            endLine: 23,
        }));
        expect(conflictFragment?.text).toContain(nominalTolerance);
        expect(conflictFragment?.text).toContain(overrideTolerance);
        expect(conflictFragment?.text.match(new RegExp(nominalTolerance.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
        expect(conflictFragment?.text.match(new RegExp(overrideTolerance.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    });

    test('marks non-adjacent date facts in the same section as conflicting evidence', async () => {
        const announcedDate = 'The migration release date is 2026-07-01.';
        const revisedDate = 'The migration release date is 2026-08-15.';
        const fullDocument = [
            '# Release Date Conflict Probe',
            '',
            'Release date conflict probe validates that date contradictions are treated as evidence conflicts.',
            '',
            '## Release Schedule',
            announcedDate,
            '',
            'Context paragraph one keeps the release schedule section beyond the local window.',
            '',
            'Context paragraph two keeps the release schedule section beyond the local window.',
            '',
            'Context paragraph three keeps the release schedule section beyond the local window.',
            '',
            'Context paragraph four keeps the release schedule section beyond the local window.',
            '',
            'Context paragraph five keeps the release schedule section beyond the local window.',
            '',
            'Context paragraph six keeps the release schedule section beyond the local window.',
            '',
            revisedDate,
            'Operators must resolve the active release record before publishing the schedule.',
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_release_date',
            documentId: 'doc_conflicting_release_date',
            sourcePath: 'Knowledge_Base/ragdateconflict/release date conflict probe.md',
            title: 'Release Date Conflict Probe',
            content: announcedDate,
            keywords: ['release', 'date', 'conflict'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_announced_release_date',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(announcedDate),
                    endOffset: fullDocument.indexOf(announcedDate) + announcedDate.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: announcedDate,
                }),
                makeEvidenceSpan({
                    id: 'evidence_revised_release_date',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(revisedDate),
                    endOffset: fullDocument.indexOf(revisedDate) + revisedDate.length,
                    startLine: 20,
                    endLine: 20,
                    snippet: revisedDate,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is release date conflict probe?',
            items: [item],
            sourceResolver: async () => ({
                documentId: atom.documentId,
                sourcePath: atom.sourcePath,
                content: fullDocument,
            }),
            paragraphWindow: 5,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 700,
                maxTotalChars: 2200,
            },
        });

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            documentId: atom.documentId,
            sourcePath: atom.sourcePath,
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_announced_release_date',
                'evidence_revised_release_date',
            ]),
            startLine: 6,
            endLine: 21,
        }));
        expect(conflictFragment?.text).toContain(announcedDate);
        expect(conflictFragment?.text).toContain(revisedDate);
        expect(conflictFragment?.text.match(new RegExp(announcedDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
        expect(conflictFragment?.text.match(new RegExp(revisedDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    });

    test('marks comparable facts from different documents as conflicting evidence', async () => {
        const nominalTolerance = 'The calibration tolerance is +/-0.10 mm in the nominal procedure.';
        const fieldTolerance = 'The calibration tolerance is +/-0.50 mm in the field procedure.';
        const nominalDocument = [
            '# Nominal Calibration Record',
            '',
            '## Calibration Facts',
            nominalTolerance,
        ].join('\n');
        const fieldDocument = [
            '# Field Calibration Record',
            '',
            '## Calibration Facts',
            fieldTolerance,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_calibration_record',
            documentId: 'doc_nominal_calibration_record',
            sourcePath: 'Knowledge_Base/ragmulticonflict/nominal calibration record.md',
            title: 'Nominal Calibration Record',
            content: nominalTolerance,
            keywords: ['calibration', 'tolerance', 'nominal'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_calibration_record',
            documentId: 'doc_field_calibration_record',
            sourcePath: 'Knowledge_Base/ragmulticonflict/field calibration record.md',
            title: 'Field Calibration Record',
            content: fieldTolerance,
            keywords: ['calibration', 'tolerance', 'field'],
        });
        const nominalItem = makeQueryItem({
            atom: nominalAtom,
            evidence: {
                id: 'evidence_nominal_calibration_tolerance',
                documentId: nominalAtom.documentId,
                sourcePath: nominalAtom.sourcePath,
                startOffset: nominalDocument.indexOf(nominalTolerance),
                endOffset: nominalDocument.indexOf(nominalTolerance) + nominalTolerance.length,
                startLine: 4,
                endLine: 4,
                snippet: nominalTolerance,
            },
        });
        const fieldItem = makeQueryItem({
            atom: fieldAtom,
            evidence: {
                id: 'evidence_field_calibration_tolerance',
                documentId: fieldAtom.documentId,
                sourcePath: fieldAtom.sourcePath,
                startOffset: fieldDocument.indexOf(fieldTolerance),
                endOffset: fieldDocument.indexOf(fieldTolerance) + fieldTolerance.length,
                startLine: 4,
                endLine: 4,
                snippet: fieldTolerance,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'what is multi document calibration tolerance conflict probe?',
            items: [nominalItem, fieldItem],
            sourceResolver: async (lookup) => ({
                documentId: lookup.documentId,
                sourcePath: lookup.sourcePath,
                content: lookup.documentId === nominalAtom.documentId ? nominalDocument : fieldDocument,
            }),
            budget: {
                maxFragments: 10,
                maxCharsPerFragment: 700,
                maxTotalChars: 2400,
            },
        });

        const conflictFragment = assembly.fragments.find((fragment) => (
            fragment.role === 'conflict'
            && fragment.fragmentId.startsWith('rag_conflict_cross_document_')
        ));
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_calibration_tolerance',
                'evidence_field_calibration_tolerance',
            ]),
            text: expect.stringContaining('across documents'),
        }));
        expect(conflictFragment?.text).toContain('Nominal Calibration Record');
        expect(conflictFragment?.text).toContain('Field Calibration Record');
        expect(conflictFragment?.text).toContain(nominalTolerance);
        expect(conflictFragment?.text).toContain(fieldTolerance);
    });

    test('scans complete selected documents for cross-document conflicts beyond the local context window', async () => {
        const nominalIntro = 'Nominal calibration overview establishes the scoped source document.';
        const fieldIntro = 'Field calibration overview establishes the comparison source document.';
        const nominalTolerance = 'The calibration tolerance is +/-0.10 mm in the remote nominal appendix.';
        const fieldTolerance = 'The calibration tolerance is +/-0.50 mm in the remote field appendix.';
        const filler = Array.from({ length: 8 }, (_, index) => `Unselected filler paragraph ${index + 1} keeps the appendix outside the local window.`);
        const nominalDocument = [
            '# Nominal Full Scan Probe',
            '',
            nominalIntro,
            '',
            ...filler.flatMap((line) => [line, '']),
            '## Remote Nominal Appendix',
            nominalTolerance,
        ].join('\n');
        const fieldDocument = [
            '# Field Full Scan Probe',
            '',
            fieldIntro,
            '',
            ...filler.flatMap((line) => [line, '']),
            '## Remote Field Appendix',
            fieldTolerance,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_full_scan_probe',
            documentId: 'doc_nominal_full_scan_probe',
            sourcePath: 'Knowledge_Base/ragfullscan/nominal full scan probe.md',
            title: 'Nominal Full Scan Probe',
            content: nominalIntro,
            keywords: ['nominal', 'calibration', 'full', 'scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_full_scan_probe',
            documentId: 'doc_field_full_scan_probe',
            sourcePath: 'Knowledge_Base/ragfullscan/field full scan probe.md',
            title: 'Field Full Scan Probe',
            content: fieldIntro,
            keywords: ['field', 'calibration', 'full', 'scan'],
        });
        const nominalItem = makeQueryItem({
            atom: nominalAtom,
            evidence: {
                id: 'evidence_nominal_full_scan_intro',
                documentId: nominalAtom.documentId,
                sourcePath: nominalAtom.sourcePath,
                startOffset: nominalDocument.indexOf(nominalIntro),
                endOffset: nominalDocument.indexOf(nominalIntro) + nominalIntro.length,
                startLine: 3,
                endLine: 3,
                snippet: nominalIntro,
            },
        });
        const fieldItem = makeQueryItem({
            atom: fieldAtom,
            evidence: {
                id: 'evidence_field_full_scan_intro',
                documentId: fieldAtom.documentId,
                sourcePath: fieldAtom.sourcePath,
                startOffset: fieldDocument.indexOf(fieldIntro),
                endOffset: fieldDocument.indexOf(fieldIntro) + fieldIntro.length,
                startLine: 3,
                endLine: 3,
                snippet: fieldIntro,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal full scan probe with field full scan probe',
            items: [nominalItem, fieldItem],
            sourceResolver: async (lookup) => ({
                documentId: lookup.documentId,
                sourcePath: lookup.sourcePath,
                content: lookup.documentId === nominalAtom.documentId ? nominalDocument : fieldDocument,
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 2600,
            },
        });

        const conflictFragment = assembly.fragments.find((fragment) => (
            fragment.role === 'conflict'
            && fragment.fragmentId.startsWith('rag_conflict_cross_document_')
        ));
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_full_scan_intro',
                'evidence_field_full_scan_intro',
            ]),
            text: expect.stringContaining('across documents'),
        }));
        expect(conflictFragment?.text).toContain(nominalTolerance);
        expect(conflictFragment?.text).toContain(fieldTolerance);
        expect(assembly.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                documentId: nominalAtom.documentId,
                sourceBoundary: 'full_document',
                status: 'read',
                charsRead: nominalDocument.length,
            }),
            expect.objectContaining({
                documentId: fieldAtom.documentId,
                sourceBoundary: 'full_document',
                status: 'read',
                charsRead: fieldDocument.length,
            }),
        ]));
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

    test('uses the full neighbor source document to expand graph support beyond the matched span', async () => {
        const anchorDefinition = 'A brittle glass vessel is stiff and transparent but has low impact tolerance.';
        const neighborHit = 'A ductile polymer cup flexes under impact and resists fracture.';
        const neighborQualifier = 'Full-document qualifier: the polymer comparison also includes rebound behavior after deformation.';
        const anchorItem = makeQueryItem({
            atom: {
                id: 'atom_brittle_glass',
                documentId: 'doc_brittle_glass',
                title: 'Brittle Glass Vessel',
                content: anchorDefinition,
            },
            evidence: {
                id: 'evidence_brittle_glass',
                snippet: anchorDefinition,
            },
        });
        const neighborItem = makeQueryItem({
            atom: {
                id: 'atom_polymer_cup',
                documentId: 'doc_polymer_cup',
                sourcePath: 'Knowledge_Base/test/ductile-polymer-cup.md',
                title: 'Ductile Polymer Cup Analogy',
                content: neighborHit,
            },
            evidence: {
                id: 'evidence_polymer_cup',
                documentId: 'doc_polymer_cup',
                sourcePath: 'Knowledge_Base/test/ductile-polymer-cup.md',
                snippet: neighborHit,
            },
            relationPath: [
                {
                    id: 'edge_polymer_analogy',
                    sourceAtomId: 'atom_brittle_glass',
                    targetAtomId: 'atom_polymer_cup',
                    relationKind: 'analogy',
                    evidenceSpanIds: ['evidence_polymer_cup'],
                },
            ],
        });
        const neighborDocument = [
            '# Ductile Polymer Cup Analogy',
            '',
            neighborHit,
            '',
            neighborQualifier,
        ].join('\n');

        const assembly = await assembleRagEvidenceContext({
            query: 'compare brittle glass vessel with polymer cup material behavior',
            items: [anchorItem],
            graphNeighborItems: [neighborItem],
            sourceResolver: async (lookup) => ({
                documentId: lookup.documentId,
                sourcePath: lookup.sourcePath,
                content: lookup.documentId === 'doc_polymer_cup'
                    ? neighborDocument
                    : ['# Brittle Glass Vessel', '', anchorDefinition].join('\n'),
            }),
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 600,
                maxTotalChars: 1600,
            },
        });

        const graphNeighborFragments = assembly.fragments.filter((fragment) => (
            fragment.role === 'graph_neighbor_support'
            && fragment.documentId === 'doc_polymer_cup'
        ));
        expect(graphNeighborFragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceBoundary: 'full_document',
                text: expect.stringContaining(neighborQualifier),
            }),
        ]));
        expect(assembly.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                documentId: 'doc_polymer_cup',
                sourceBoundary: 'full_document',
                status: 'read',
                charsRead: neighborDocument.length,
            }),
        ]));
    });

    test('keeps full-document graph neighbor context bounded so document augmentation can survive recovery budgets', async () => {
        const anchorDefinition = 'A water glass is a transparent drinking vessel that contains water.';
        const anchorItem = makeQueryItem({
            atom: {
                id: 'atom_water_glass_anchor',
                documentId: 'doc_water_glass_anchor',
                title: 'Water Glass',
                content: anchorDefinition,
            },
            evidence: {
                id: 'evidence_water_glass_anchor',
                snippet: anchorDefinition,
            },
            score: 0.98,
        });
        const graphNeighborItems = Array.from({ length: 4 }, (_entry, index) => {
            const ordinal = index + 1;
            return makeQueryItem({
                atom: {
                    id: `atom_neighbor_${ordinal}`,
                    documentId: `doc_neighbor_${ordinal}`,
                    sourcePath: `Knowledge_Base/test/neighbor-${ordinal}.md`,
                    title: `Graph Neighbor ${ordinal}`,
                    content: `Graph neighbor ${ordinal} direct evidence.`,
                },
                evidence: {
                    id: `evidence_neighbor_${ordinal}`,
                    documentId: `doc_neighbor_${ordinal}`,
                    sourcePath: `Knowledge_Base/test/neighbor-${ordinal}.md`,
                    snippet: `Graph neighbor ${ordinal} direct evidence.`,
                },
                score: 0.9 - index * 0.01,
                relationPath: [
                    {
                        id: `edge_neighbor_${ordinal}`,
                        sourceAtomId: 'atom_water_glass_anchor',
                        targetAtomId: `atom_neighbor_${ordinal}`,
                        relationKind: 'analogy',
                        evidenceSpanIds: [`evidence_neighbor_${ordinal}`],
                    },
                ],
            });
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'what is water glass?',
            items: [anchorItem],
            graphNeighborItems,
            sourceResolver: async (lookup) => {
                if (lookup.documentId === 'doc_water_glass_anchor') {
                    return {
                        documentId: lookup.documentId,
                        sourcePath: lookup.sourcePath,
                        content: ['# Water Glass', '', anchorDefinition].join('\n'),
                    };
                }
                const neighborNumber = String(lookup.documentId).replace('doc_neighbor_', '');
                return {
                    documentId: lookup.documentId,
                    sourcePath: lookup.sourcePath,
                    content: [
                        `# Graph Neighbor ${neighborNumber}`,
                        '',
                        `Graph neighbor ${neighborNumber} direct evidence.`,
                        '',
                        `Graph neighbor ${neighborNumber} full-document qualifier.`,
                    ].join('\n'),
                };
            },
            budget: {
                maxFragments: 12,
                maxCharsPerFragment: 500,
                maxTotalChars: 3000,
            },
        });

        const fullDocumentGraphNeighborFragments = assembly.fragments.filter((fragment) => (
            fragment.role === 'graph_neighbor_support'
            && fragment.sourceBoundary === 'full_document'
        ));
        expect(fullDocumentGraphNeighborFragments).toHaveLength(2);
        expect(fullDocumentGraphNeighborFragments.map((fragment) => fragment.title)).toEqual([
            'Graph Neighbor 1',
            'Graph Neighbor 2',
        ]);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                sourceBoundary: 'full_document',
                title: 'Water Glass',
            }),
        ]));
    });

    test('marks unavailable graph-neighbor source windows so sufficiency can degrade graph evidence', async () => {
        const anchorDefinition = 'A brittle glass vessel is stiff and transparent but has low impact tolerance.';
        const neighborHit = 'A missing neighbor qualifier should not be treated as complete graph evidence from title alone.';
        const anchorItem = makeQueryItem({
            atom: {
                id: 'atom_brittle_glass_missing_neighbor',
                documentId: 'doc_brittle_glass_missing_neighbor',
                title: 'Brittle Glass Vessel',
                content: anchorDefinition,
            },
            evidence: {
                id: 'evidence_brittle_glass_missing_neighbor',
                snippet: anchorDefinition,
            },
        });
        const neighborItem = makeQueryItem({
            atom: {
                id: 'atom_missing_neighbor',
                documentId: 'doc_missing_neighbor',
                sourcePath: 'Knowledge_Base/test/missing-neighbor.md',
                title: 'Missing Neighbor Evidence',
                content: neighborHit,
            },
            evidence: {
                id: 'evidence_missing_neighbor',
                documentId: 'doc_missing_neighbor',
                sourcePath: 'Knowledge_Base/test/missing-neighbor.md',
                snippet: neighborHit,
            },
            relationPath: [
                {
                    id: 'edge_missing_neighbor',
                    sourceAtomId: 'atom_brittle_glass_missing_neighbor',
                    targetAtomId: 'atom_missing_neighbor',
                    relationKind: 'analogy',
                    evidenceSpanIds: ['evidence_missing_neighbor'],
                },
            ],
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'compare brittle glass vessel with missing neighbor evidence',
            items: [anchorItem],
            graphNeighborItems: [neighborItem],
            sourceResolver: async (lookup) => {
                if (lookup.documentId === 'doc_missing_neighbor') {
                    return null;
                }
                return {
                    documentId: lookup.documentId,
                    sourcePath: lookup.sourcePath,
                    content: '# Brittle Glass Vessel\n\nA brittle glass vessel is stiff and transparent but has low impact tolerance.',
                };
            },
        });

        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'graph_neighbor_support',
                documentId: 'doc_missing_neighbor',
                sourceBoundary: 'direct_span_only',
            }),
        ]));
        expect(assembly.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                documentId: 'doc_missing_neighbor',
                status: 'source_window_unavailable',
                reason: expect.stringContaining('graph_neighbor_support'),
            }),
        ]));
    });

    test('records unavailable source windows for each missing graph-neighbor document', async () => {
        const anchorDefinition = 'A brittle glass vessel is stiff and transparent but has low impact tolerance.';
        const anchorItem = makeQueryItem({
            atom: {
                id: 'atom_brittle_glass_multi_missing_neighbor',
                documentId: 'doc_brittle_glass_multi_missing_neighbor',
                title: 'Brittle Glass Vessel',
                content: anchorDefinition,
            },
            evidence: {
                id: 'evidence_brittle_glass_multi_missing_neighbor',
                snippet: anchorDefinition,
            },
        });
        const neighborItems = [
            makeQueryItem({
                atom: {
                    id: 'atom_missing_polymer_cup',
                    documentId: 'doc_missing_polymer_cup',
                    sourcePath: 'Knowledge_Base/test/missing-polymer-cup.md',
                    title: 'Missing Polymer Cup Evidence',
                    content: 'A missing polymer cup qualifier should not be treated as complete graph evidence.',
                },
                evidence: {
                    id: 'evidence_missing_polymer_cup',
                    documentId: 'doc_missing_polymer_cup',
                    sourcePath: 'Knowledge_Base/test/missing-polymer-cup.md',
                    snippet: 'A missing polymer cup qualifier should not be treated as complete graph evidence.',
                },
                relationPath: [
                    {
                        id: 'edge_missing_polymer_cup',
                        sourceAtomId: 'atom_brittle_glass_multi_missing_neighbor',
                        targetAtomId: 'atom_missing_polymer_cup',
                        relationKind: 'analogy',
                        evidenceSpanIds: ['evidence_missing_polymer_cup'],
                    },
                ],
            }),
            makeQueryItem({
                atom: {
                    id: 'atom_missing_polymer_vessel',
                    documentId: 'doc_missing_polymer_vessel',
                    sourcePath: 'Knowledge_Base/test/missing-polymer-vessel.md',
                    title: 'Missing Polymer Vessel Evidence',
                    content: 'A missing polymer vessel qualifier should not be treated as complete graph evidence.',
                },
                evidence: {
                    id: 'evidence_missing_polymer_vessel',
                    documentId: 'doc_missing_polymer_vessel',
                    sourcePath: 'Knowledge_Base/test/missing-polymer-vessel.md',
                    snippet: 'A missing polymer vessel qualifier should not be treated as complete graph evidence.',
                },
                relationPath: [
                    {
                        id: 'edge_missing_polymer_vessel',
                        sourceAtomId: 'atom_brittle_glass_multi_missing_neighbor',
                        targetAtomId: 'atom_missing_polymer_vessel',
                        relationKind: 'analogy',
                        evidenceSpanIds: ['evidence_missing_polymer_vessel'],
                    },
                ],
            }),
        ];

        const assembly = await assembleRagEvidenceContext({
            query: 'compare brittle glass vessel with polymer cup material behavior',
            items: [anchorItem],
            graphNeighborItems: neighborItems,
            sourceResolver: async (lookup) => {
                if (lookup.documentId.startsWith('doc_missing_polymer_')) {
                    return null;
                }
                return {
                    documentId: lookup.documentId,
                    sourcePath: lookup.sourcePath,
                    content: '# Brittle Glass Vessel\n\nA brittle glass vessel is stiff and transparent but has low impact tolerance.',
                };
            },
        });

        const unavailableNeighborDecisions = assembly.sourceDecisions.filter((decision) => (
            decision.status === 'source_window_unavailable'
            && String(decision.reason || '').includes('graph_neighbor_support')
        ));
        expect(unavailableNeighborDecisions).toHaveLength(2);
        expect(unavailableNeighborDecisions.map((decision) => decision.documentId).sort()).toEqual([
            'doc_missing_polymer_cup',
            'doc_missing_polymer_vessel',
        ]);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'graph_neighbor_support',
                documentId: 'doc_missing_polymer_cup',
                sourceBoundary: 'direct_span_only',
            }),
            expect.objectContaining({
                role: 'graph_neighbor_support',
                documentId: 'doc_missing_polymer_vessel',
                sourceBoundary: 'direct_span_only',
            }),
        ]));
    });
});
